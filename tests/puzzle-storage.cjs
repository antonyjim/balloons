const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const { cropRect, adjustCrop } = require('../dist-ts/puzzle/crop')

function database({ legacy = null, stored, failWrite = false } = {}) {
    let removed = false, value = stored, closes = 0
    const context = {
        exports: {}, Blob, atob,
        localStorage: { getItem: () => legacy, removeItem() { removed = true } },
        indexedDB: { open() {
            const request = {}
            request.result = {
                close() { closes++ },
                transaction(name, mode) {
                    assert.equal(name, 'state')
                    const tx = { objectStore() { return {
                        get() { const r = { result: value }; queueMicrotask(() => tx.oncomplete()); return r },
                        put(data) {
                            const r = { result: 'collection' }
                            queueMicrotask(() => {
                                if (failWrite) { tx.error = new Error('quota'); tx.onabort() }
                                else { value = structuredClone(data); tx.oncomplete() }
                            })
                            return r
                        }
                    } } }
                    return tx
                }
            }
            queueMicrotask(() => request.onsuccess())
            return request
        } }
    }
    vm.runInNewContext(fs.readFileSync('dist-ts/puzzle/storage.js', 'utf8'), context)
    return { api: context.exports, removed: () => removed, value: () => value, closes: () => closes }
}

test('legacy picture migration commits blobs before removing localStorage images', async () => {
    const db = database({ legacy: JSON.stringify({ size: 4, pictures: [{ name: 'Photo', image: 'data:image/jpeg;base64,YWJj' }] }) })
    const collection = await db.api.loadCollection()
    assert.equal(collection.size, 4)
    assert.ok(collection.pictures[0].blob instanceof Blob)
    assert.equal(await collection.pictures[0].blob.text(), 'abc')
    assert.equal(db.removed(), true)
    assert.equal(db.closes(), 2)
    const saved = await db.api.loadCollection()
    assert.equal(saved.pictures[0].name, 'Photo')
})

test('failed IndexedDB commit preserves legacy pictures for another migration attempt', async () => {
    const db = database({ legacy: JSON.stringify({ pictures: [{ name: 'Photo', image: 'data:image/png;base64,YQ==' }] }), failWrite: true })
    await assert.rejects(db.api.loadCollection(), /quota/)
    assert.equal(db.removed(), false)
    assert.equal(db.value(), undefined)
})

test('saved image blobs, originals and puzzle options survive a reload', async () => {
    const db = database()
    await db.api.saveCollection({ pictures: [{ id: 'photo', name: 'Photo', blob: new Blob(['crop']), original: new Blob(['original']) }], size: 5, preview: true, current: 'photo' })
    const saved = await db.api.loadCollection()
    assert.equal(await saved.pictures[0].blob.text(), 'crop')
    assert.equal(await saved.pictures[0].original.text(), 'original')
    assert.equal(saved.size, 5)
    assert.equal(saved.preview, true)
    assert.equal(saved.current, 'photo')
})

test('square crop honors landscape/portrait offsets and bounds zoom and pan', () => {
    assert.deepEqual(cropRect(1200, 800, 1, .5, .5), { x: 200, y: 0, side: 800 })
    assert.deepEqual(cropRect(800, 1200, 2, 1, 1), { x: 400, y: 800, side: 400 })
    assert.deepEqual(cropRect(800, 1200, 99, -1, 2), { x: 0, y: 1000, side: 200 })
    const db = database()
    assert.throws(() => db.api.imageBlob('data:image/svg+xml;base64,AA=='), /Invalid image/)
})


test('crop handles keep portrait, landscape and square crops bounded even at maximum axes', () => {
    for (const [width, height] of [[1200, 800], [800, 1200], [800, 800]]) {
        const initial = cropRect(width, height, 1, .5, .5)
        for (const handle of ['move', 'nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']) {
            for (const dx of [-10000, -50, 0, 50, 10000]) {
                for (const dy of [-10000, 0, 10000]) {
                    const rect = adjustCrop(initial, handle, dx, dy, width, height)
                    assert.ok(Object.values(rect).every(Number.isFinite))
                    assert.ok(rect.side > 0 && rect.x >= -1e-8 && rect.y >= -1e-8)
                    assert.ok(rect.x + rect.side <= width + 1e-8 && rect.y + rect.side <= height + 1e-8)
                }
            }
        }
    }
    assert.deepEqual(adjustCrop({ x: 200, y: 100, side: 400 }, 'nw', 100, 100, 1200, 800), { x: 300, y: 200, side: 300 })
    assert.deepEqual(adjustCrop({ x: 200, y: 100, side: 400 }, 'e', 100, 0, 1200, 800), { x: 200, y: 50, side: 500 })
})

test('saving new pictures works without crypto.randomUUID on HTTP kiosk pages', () => {
    const db = database()
    const first = db.api.createPictureId(), second = db.api.createPictureId()
    assert.equal(typeof first, 'string')
    assert.ok(first.length > 10)
    assert.notEqual(first, second)
})
