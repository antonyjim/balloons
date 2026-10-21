const { test } = require('node:test')
const assert = require('node:assert/strict')
const { exportPuzzles, importPuzzles } = require('../dist-ts/puzzle/transfer')

test('puzzle exports round-trip names, images, originals, options and unfinished progress', async () => {
    const picture = { id: 'garden', name: 'Garden flowers', blob: new Blob(['cropped'], { type: 'image/jpeg' }), original: new Blob(['original'], { type: 'image/png' }) }
    const state = { placed: [0, 4], order: [8, 7, 6, 5, 4, 3, 2, 1, 0], savedAt: Date.now(), solved: false, activityId: 'saved-shapes' }
    const file = await exportPuzzles([picture], 3, true, { 'garden:3': state })
    assert.equal(file.type, 'text/plain')
    const restored = importPuzzles(await file.text())
    assert.equal(restored.pictures[0].name, picture.name)
    assert.notEqual(restored.pictures[0].id, picture.id, 'imports get independent library IDs')
    assert.equal(await restored.pictures[0].blob.text(), 'cropped')
    assert.equal(await restored.pictures[0].original.text(), 'original')
    assert.equal(restored.size, 3)
    assert.equal(restored.preview, true)
    assert.deepEqual(restored.progress[`${restored.pictures[0].id}:3`], state)
})

test('older text collections still import and unsupported formats fail before mutating the library', () => {
    const legacy = { size: 4, pictures: [{ name: 'Beach', image: 'data:image/jpeg;base64,YWJj' }] }
    const result = importPuzzles(JSON.stringify(legacy))
    assert.equal(result.pictures.length, 1)
    assert.equal(result.size, 4)
    assert.equal(result.preview, false)
    assert.throws(() => importPuzzles(JSON.stringify({ ...legacy, format: 'balloons-puzzles', version: 999 })), /version/)
    assert.throws(() => importPuzzles(JSON.stringify({ ...legacy, pictures: [{ name: 'Bad', image: 'data:image/svg+xml;base64,YQ==' }] })), /Invalid puzzle image/)
    assert.throws(() => importPuzzles(JSON.stringify({ ...legacy, pictures: [] })), /1 to 20/)
    assert.throws(() => importPuzzles('{bad json'))
})

test('collection export includes multiple pictures but omits expired/solved progress and non-raster originals', async () => {
    const photo = id => ({ id, name: id, blob: new Blob(['photo'], { type: 'image/jpeg' }), original: new Blob(['svg'], { type: 'image/svg+xml' }) })
    const progress = { placed: [], order: Array.from({ length: 9 }, (_, i) => i), savedAt: Date.now() - 3600001, solved: false, activityId: 'round' }
    const file = await exportPuzzles([photo('one'), photo('two')], 5, false, { 'one:3': progress, 'two:3': { ...progress, savedAt: Date.now(), solved: true } })
    const data = JSON.parse(await file.text())
    assert.equal(data.pictures.length, 2)
    assert.deepEqual(data.progress, {})
    assert.equal(data.pictures[0].original, undefined)
    assert.equal(importPuzzles(await file.text()).pictures.length, 2)
})

test('aborted cropped image reads recover without losing the puzzle', async () => {
    const broken = new Blob(['unreadable'], { type: 'image/jpeg' })
    broken.arrayBuffer = async () => { throw new DOMException('The operation was aborted', 'AbortError') }
    let recovered = 0
    const file = await exportPuzzles([{ id: 'broken', name: 'Recovered garden', blob: broken }], 3, false, {}, {
        recoverImage: async picture => { assert.equal(picture.id, 'broken'); recovered++; return new Blob(['recovered pixels'], { type: 'image/jpeg' }) }
    })
    assert.equal(recovered, 1)
    const restored = importPuzzles(await file.text())
    assert.equal(await restored.pictures[0].blob.text(), 'recovered pixels')
})

test('an aborted optional original does not block export of the cropped puzzle', async () => {
    const original = new Blob(['unreadable'], { type: 'image/png' })
    original.arrayBuffer = async () => { throw new DOMException('The operation was aborted', 'AbortError') }
    const warnings = []
    const file = await exportPuzzles([{ id: 'photo', name: 'Garden', blob: new Blob(['crop'], { type: 'image/jpeg' }), original }], 3, false, {}, { warn: message => warnings.push(message) })
    assert.equal(warnings.length, 1)
    const result = importPuzzles(await file.text())
    assert.equal(await result.pictures[0].blob.text(), 'crop')
    assert.equal(result.pictures[0].original, undefined)
})

test('FileReader retries an aborted arrayBuffer read before needing image recovery', async () => {
    const fs = require('node:fs'), vm = require('node:vm')
    let fallbackReads = 0
    const context = {
        exports: {}, Blob, btoa, atob,
        FileReader: class {
            readAsDataURL() { fallbackReads++; this.result = 'data:image/jpeg;base64,cmVjb3ZlcmVk'; queueMicrotask(() => this.onload()) }
        },
        require(name) {
            if (name === './storage') return require('../dist-ts/puzzle/storage')
            if (name === './progress') return require('../dist-ts/puzzle/progress')
            throw new Error(name)
        }
    }
    vm.runInNewContext(fs.readFileSync('dist-ts/puzzle/transfer.js', 'utf8'), context)
    const broken = { size: 10, type: 'image/jpeg', arrayBuffer: async () => { throw new Error('The operation was aborted') } }
    const file = await context.exports.exportPuzzles([{ id: 'photo', name: 'Photo', blob: broken }], 3, false, {})
    assert.equal(fallbackReads, 1)
    assert.equal(await importPuzzles(await file.text()).pictures[0].blob.text(), 'recovered')
})
