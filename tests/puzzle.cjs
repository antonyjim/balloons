const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const game = require('../dist-ts/puzzle/game')
const { viewFromHash } = require('../dist-ts/navigation')

class Element extends EventTarget {
    children = []; dataset = {}; style = {}; attributes = {}; captured = new Set(); hidden = false
    open = false
    showModal() { this.open = true }
    close() { this.open = false; this.dispatchEvent(new Event('close')) }
    classList = { add() {} }
    setAttribute(name, value) { this.attributes[name] = value }
    append(...elements) { for (const el of elements) { el.parent = this; this.children.push(el) } }
    remove() { this.parent.children = this.parent.children.filter(el => el !== this) }
    replaceChildren() { this.children = [] }
    querySelector(selector) { return this.children.find(el => el.dataset.id === selector.match(/data-id="(\d+)"/)?.[1]) }
    querySelectorAll() { return this.children }
    getBoundingClientRect() { return { left: 0, top: 0, width: 316, height: 316 } }
    setPointerCapture(id) { this.captured.add(id) }
    hasPointerCapture(id) { return this.captured.has(id) }
    releasePointerCapture(id) { this.captured.delete(id) }
    cloneNode() { return new Element() }
    getContext() { return { fillRect() {}, drawImage() {} } }
    toBlob(callback) { callback(new Blob(['cropped image'], { type: 'image/jpeg' })) }
}

test('all puzzle sizes have every piece exactly once and deep links open puzzles', () => {
    assert.equal(viewFromHash('#/puzzle'), 'puzzle')
    for (const size of [3, 4, 5]) {
        assert.deepEqual(game.shuffledPieces(size).sort((a, b) => a - b), Array.from({ length: size * size }, (_, i) => i))
        assert.equal((game.piecePath(0, 0, size).match(/ C /g) ?? []).length, 10, 'corners have two interlocking edges')
        assert.equal((game.piecePath(1, 1, size).match(/ C /g) ?? []).length, 20, 'interior pieces have four interlocking edges')
    }
})

test('puzzles support correct and incorrect drops, tap completion, cancellation, saved sizes and view persistence', async () => {
    const elements = new Map()
    const root = new Element()
    root.querySelector = selector => { if (!elements.has(selector)) elements.set(selector, new Element()); return elements.get(selector) }
    const listeners = new Map()
    const saves = [], draws = [], audit = []
    let hold, exits = 0, screensavers = 0
    const context = {
        exports: {}, URL, structuredClone, crypto: require('node:crypto').webcrypto,
        Image: class { naturalWidth = 1200; naturalHeight = 800; async decode() {} },
        setTimeout: fn => { hold = fn; return 1 }, clearTimeout: () => { hold = undefined },
        require(name) {
            if (name === '../celebration') return { createCelebration() { return { play() {}, stop() {} } } }
            if (name === './transfer') return require('../dist-ts/puzzle/transfer')
            if (name === './progress') return require('../dist-ts/puzzle/progress')
            if (name === './camera') return { createPuzzleCamera: () => ({ start: async () => {}, stop() {} }) }
            if (name === '../activation') return { bindActivation() {} }
            if (name === './game') return game
            if (name === './crop') return require('../dist-ts/puzzle/crop')
            if (name === '../hiddenExit') return { exitAppFullscreen() { exits++ } }
            if (name === './storage') return {
                createPictureId: () => 'new-picture',
                loadCollection: async () => ({ size: 3, preview: true, pictures: [{ id: 'saved', name: 'My picture', blob: new Blob(['picture']) }] }),
                saveCollection: async value => saves.push(value)
            }
            throw new Error(name)
        },
        localStorage: { getItem: () => JSON.stringify({ size: 3, pictures: [{ name: 'My picture', image: 'data:image/jpeg;base64,AA==' }] }), setItem() {} },
        document: { addEventListener() {}, createElement: tag => { const el = new Element(); if (tag === 'canvas') el.getContext = () => ({ fillRect() {}, drawImage(...args) { draws.push(args) } }); return el }, createElementNS: () => new Element() },
        window: { addEventListener: (type, fn) => listeners.set(type, fn) },
    }
    vm.runInNewContext(fs.readFileSync('dist-ts/puzzle/index.js', 'utf8'), context)
    const app = context.exports.mountPuzzle({ attachShadow: () => root }, (...args) => audit.push(args), () => { screensavers++ })
    await new Promise(resolve => setImmediate(resolve))
    const board = elements.get('.board'), tray = elements.get('.tray'), status = elements.get('.message')
    assert.equal(board.children.length, 9)
    elements.get('#screensaver').onclick()
    assert.equal(screensavers, 1)

    elements.get('#export-puzzle').onclick()
    await new Promise(resolve => setImmediate(resolve))
    const download = elements.get('#puzzle-download')
    assert.equal(download.hidden, false, 'export exposes an attached link for a direct user download')
    assert.match(download.href, /^blob:/)
    assert.equal(download.download, 'My-picture.txt')
    assert.match(elements.get('.menu-status').textContent, /File ready/)

    const piece = tray.children.find(el => el.dataset.id === '0')
    piece.onclick()
    board.children[1].onclick()
    assert.match(status.textContent, /Try another/)
    assert.equal(piece.hidden, false)
    piece.onpointerdown({ button: 0, pointerId: 1, clientX: 10, clientY: 10 })
    piece.onpointerup({ pointerId: 1, clientX: 40, clientY: 40 })
    assert.equal(piece.hidden, true)
    assert.equal(piece.captured.size, 0)
    assert.match(status.textContent, /1 of 9/)
    const originalOrder = tray.children.map(piece => piece.dataset.id)
    elements.get('.puzzle-list').children.at(-1).onclick()
    elements.get('.puzzle-list').children[0].onclick()
    assert.deepEqual(tray.children.map(piece => piece.dataset.id), originalOrder, 'switching puzzles retains tray order')
    assert.equal(tray.children.find(piece => piece.dataset.id === '0').hidden, true)
    await new Promise(resolve => setImmediate(resolve))
    assert.deepEqual(Array.from(saves.at(-1).progress['saved:3'].placed), [0])
    const next = tray.children.find(el => el.dataset.id === '1')
    next.onpointerdown({ button: 0, pointerId: 2, clientX: 10, clientY: 10 })
    app.setActive(false)
    assert.equal(next.captured.size, 0)
    board.children[1].onclick()
    assert.equal(next.hidden, false, 'inactive view cannot place pieces')
    app.setActive(true)
    assert.equal(piece.hidden, true, 'view switching preserves completed pieces')
    for (let id = 1; id < 9; id++) {
        tray.children.find(el => el.dataset.id === String(id)).onclick()
        board.children[id].onclick()
    }
    assert.match(status.textContent, /complete/)
    assert.equal(audit.filter(e => e[0] === 'solve').length, 1)
    assert.equal(audit.filter(e => e[0] === 'attempt').length, 0)
    assert.equal(audit[0][0], 'activity')
    assert.equal(audit[0][2], false)
    app.setActive(false); app.setActive(true)
    assert.ok(tray.children.every(piece => !piece.hidden), 'a completed puzzle starts fresh when revisited')
    const firstTouch = tray.children.find(piece => piece.dataset.id === '0')
    const secondTouch = tray.children.find(piece => piece.dataset.id === '1')
    firstTouch.onpointerdown({ button: 0, pointerId: 20, clientX: 10, clientY: 10, pointerType: 'touch', isPrimary: true })
    secondTouch.onpointerdown({ button: 0, pointerId: 21, clientX: 10, clientY: 10, pointerType: 'touch', isPrimary: false })
    assert.equal(firstTouch.captured.size, 1)
    assert.equal(secondTouch.captured.size, 1)
    secondTouch.onpointerup({ pointerId: 21, clientX: 140, clientY: 40 })
    assert.equal(secondTouch.hidden, true)
    assert.equal(firstTouch.captured.size, 1, 'dropping one piece leaves the other touch active')
    firstTouch.onpointerup({ pointerId: 20, clientX: 40, clientY: 40 })
    assert.equal(firstTouch.hidden, true, 'each finger drops its own piece even when another piece was selected last')
    elements.get('#restart').onclick()
    const a = tray.children.find(piece => piece.dataset.id === '0'), b = tray.children.find(piece => piece.dataset.id === '1')
    a.onpointerdown({ button: 0, pointerId: 22, clientX: 10, clientY: 10 })
    b.onpointerdown({ button: 0, pointerId: 23, clientX: 10, clientY: 10 })
    a.onpointercancel({ pointerId: 22 })
    assert.equal(a.captured.size, 0)
    assert.equal(b.captured.size, 1)
    listeners.get('blur')()
    assert.equal(b.captured.size, 0, 'blur cancels all outstanding touches')
    elements.get('#size').value = '5'
    elements.get('#size').onchange()
    assert.equal(board.children.length, 25)
    assert.equal(tray.children.length, 25)
    elements.get('#restart').onclick()
    assert.ok(tray.children.every(piece => !piece.hidden), 'Reset clears placements')
    const reference = elements.get('.reference'), preview = elements.get('#preview')
    assert.equal(reference.hidden, false, 'saved preview setting is restored')
    preview.checked = false; preview.onchange()
    assert.equal(reference.hidden, true)
    const title = elements.get('#puzzle-title'), menu = elements.get('#menu')
    assert.equal(menu.open, false)
    title.onpointerdown({ button: 0, pointerId: 4, clientX: 0, clientY: 0 })
    title.onpointerup()
    assert.equal(hold, undefined, 'short taps do not open settings')
    title.onpointerdown({ button: 0, pointerId: 5, clientX: 0, clientY: 0 })
    title.onpointermove({ pointerId: 5, clientX: 30, clientY: 0 })
    assert.equal(hold, undefined, 'moving cancels title hold')
    title.onpointerdown({ button: 0, pointerId: 6, clientX: 0, clientY: 0 })
    hold()
    assert.equal(menu.open, true)
    const photos = elements.get('#photos'), cropDialog = elements.get('#crop-dialog')
    const source = new Blob(['original photograph'], { type: 'image/png' }); source.name = 'New photograph'
    photos.files = [source]; photos.onchange()
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(cropDialog.open, true, 'new uploads open the crop editor before adding them')
    assert.equal(elements.get('.gallery').children.length, 1)
    const selection = elements.get('#crop-selection')
    assert.equal(selection.children.length, 8, 'crop has four edge and four corner handles')
    const handle = selection.children.find(el => el.dataset.handle === 'se')
    handle.onpointerdown({ button: 0, pointerId: 7, clientX: 0, clientY: 0, preventDefault() {}, stopPropagation() {} })
    selection.onpointermove({ pointerId: 7, clientX: -100, clientY: -100 })
    selection.onpointerup()
    assert.equal(selection.captured.size, 0)
    selection.onpointerdown({ button: 0, pointerId: 8, clientX: 0, clientY: 0, preventDefault() {}, stopPropagation() {} })
    selection.onpointermove({ pointerId: 8, clientX: 10000, clientY: 10000 })
    selection.onpointerup()
    await elements.get('#crop-save').onclick()
    assert.equal(cropDialog.open, false)
    const [, x, y, side] = draws.at(-1)
    assert.ok(x >= 0 && y >= 0 && side > 0)
    assert.ok(Math.abs(x + side - 1200) < 1e-6 && Math.abs(y + side - 800) < 1e-6, 'crop saves exactly against both bottom/right boundaries')
    assert.equal(elements.get('.gallery').children.length, 2)
    assert.equal(await saves.at(-1).pictures[1].blob.text(), 'cropped image')
    assert.equal(await saves.at(-1).pictures[1].original.text(), 'original photograph')
    elements.get('#edit').onclick()
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(cropDialog.open, true, 'saved images can be recropped')
    const count = saves.length
    elements.get('#crop-cancel').onclick()
    assert.equal(cropDialog.open, false)
    assert.equal(saves.length, count, 'canceling the editor leaves the saved crop untouched')
    elements.get('#remove').onclick()
    elements.get('#exit-fullscreen').onclick()
    assert.equal(exits, 1)
    elements.get('#remove').onclick()
    assert.equal(elements.get('.puzzle-list').children.length, 1, 'camera remains available in the left pane')
    assert.equal(elements.get('.workspace').hidden, true)
    app.setActive(false)
    assert.equal(menu.open, false, 'leaving the activity closes its menu')
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(saves.at(-1).pictures.length, 0, 'deletion is saved to IndexedDB')
})
