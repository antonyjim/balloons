const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const gameModule = require('../dist-ts/matching/game')

class Element extends EventTarget {
    style = { setProperty() {} }
    dataset = {}
    hidden = false
    disabled = false
    children = []
    captured = new Set()
    classes = new Set()
    classList = { add: name => this.classes.add(name), remove: name => this.classes.delete(name) }
    box = { left: 100, right: 200, top: 100, bottom: 200, width: 100, height: 100 }
    setAttribute() {}
    getBoundingClientRect() { return this.box }
    setPointerCapture(id) { this.captured.add(id) }
    hasPointerCapture(id) { return this.captured.has(id) }
    releasePointerCapture(id) { this.captured.delete(id) }
    replaceChildren() { this.children = [] }
    append(element) { this.children.push(element) }
    querySelector(selector) {
        const symbol = selector.match(/data-symbol="([A-Z0-9])"/)?.[1]
        if (symbol) return this.children.find(element => element.dataset.symbol === symbol)
        return this.strong ??= new Element()
    }
}
function pointer(type, values = {}) {
    return Object.assign(new Event(type, { cancelable: true }), { pointerId: 2, button: 0, clientX: 150, clientY: 150, ...values })
}

test('dispenser, touch drag matching, speech, cancellation, and view switching form one playable flow', () => {
    const elements = Object.fromEntries(['shelves', 'piece', 'dispense', 'instruction', 'progress', 'tray'].map(name => [name, new Element()]))
    const links = [new Element(), new Element()]
    const root = Object.assign(new EventTarget(), { innerHTML: '', querySelector: selector => elements[selector.slice(1)], querySelectorAll: () => links })
    const browser = new EventTarget(), spoken = []
    let speechCancels = 0
    browser.speechSynthesis = { cancel() { speechCancels++ }, speak(utterance) { spoken.push(utterance.text) } }
    const context = {
        exports: {}, window: browser, document: { createElement: () => new Element() }, requestAnimationFrame: fn => fn(),
        SpeechSynthesisUtterance: class { constructor(text) { this.text = text } },
        require(name) {
            if (name === '../celebration') return { createCelebration() { return { play() {}, stop() {} } } }
            if (name === 'matching-styles') return { default: '' }
            if (name === './game') return gameModule
            if (name === '../activation') return { bindActivation(element, action) { if (action) element.addEventListener('click', action) } }
            throw new Error(name)
        }
    }
    vm.runInNewContext(fs.readFileSync('dist-ts/matching/index.js', 'utf8'), context)
    const app = context.exports.mountMatching({ attachShadow: () => root })
    const { piece, dispense, shelves } = elements
    assert.equal(shelves.children.length, 36)
    dispense.dispatchEvent(new Event('click'))
    const symbol = piece.textContent
    assert.ok(symbol)
    assert.equal(piece.hidden, false)
    assert.equal(dispense.disabled, true)
    dispense.dispatchEvent(new Event('click'))
    assert.equal(piece.textContent, symbol)
    piece.dispatchEvent(pointer('pointerdown'))
    piece.dispatchEvent(pointer('pointerup', { clientX: 900, clientY: 900 }))
    assert.equal(spoken.length, 0, 'wrong drop does not speak or consume the shape')
    assert.equal(piece.hidden, false)
    assert.equal(dispense.disabled, true)
    piece.dispatchEvent(pointer('pointerdown'))
    piece.dispatchEvent(pointer('pointerup'))
    assert.equal(piece.hidden, true)
    assert.equal(dispense.disabled, false)
    assert.ok(shelves.children.find(slot => slot.dataset.symbol === symbol).classes.has('matched'))
    assert.equal(spoken[0], symbol)
    assert.equal(elements.progress.textContent, '1 / 36')
    dispense.dispatchEvent(new Event('click'))
    piece.dispatchEvent(pointer('pointerdown'))
    piece.dispatchEvent(pointer('pointercancel'))
    assert.equal(piece.captured.size, 0)
    assert.equal(piece.hidden, false)
    root.dispatchEvent(pointer('pointerdown', { pointerType: 'touch' }))
    piece.dispatchEvent(pointer('pointerdown', { pointerType: 'touch' }))
    piece.dispatchEvent(pointer('pointerup', { pointerType: 'touch' }))
    assert.equal(spoken.length, 1, 'touch speech waits for the native touch-end activation')
    root.dispatchEvent(new Event('touchend'))
    assert.equal(spoken.length, 2)
    dispense.dispatchEvent(new Event('click'))
    app.setActive(false)
    assert.ok(speechCancels >= 1)
    app.setActive(true)
    assert.equal(piece.hidden, false, 'returning preserves the pending piece and the shelf progress')
})
