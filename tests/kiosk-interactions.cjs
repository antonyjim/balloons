const { test } = require('node:test')
const assert = require('node:assert/strict')
const { setupKioskInteractions } = require('../dist-ts/kioskInteractions')
function send(target, type, values = {}, path = []) {
    const event = new Event(type, { cancelable: true })
    Object.assign(event, values)
    event.composedPath = () => path
    target.dispatchEvent(event)
    return event
}
test('kiosk guards suppress context menus and browser gestures across shadow content while preserving pointer input', () => {
    const document = new EventTarget()
    setupKioskInteractions(document)
    for (const type of ['contextmenu', 'dragstart', 'gesturestart', 'gesturechange', 'gestureend', 'dblclick']) assert.equal(send(document, type).defaultPrevented, true)
    assert.equal(send(document, 'contextmenu', {}, [{ tagName: 'INPUT' }]).defaultPrevented, true)
    assert.equal(send(document, 'touchmove', { touches: [{}, {}] }).defaultPrevented, true)
    assert.equal(send(document, 'touchstart', { touches: [{}, {}] }).defaultPrevented, true)
    assert.equal(send(document, 'touchmove', { touches: [{}] }).defaultPrevented, false, 'single-finger sidebar scrolling remains available')
    assert.equal(send(document, 'pointerdown', { pointerId: 2, isPrimary: false }).defaultPrevented, false)
    assert.equal(send(document, 'selectstart', {}, [{ tagName: 'INPUT' }]).defaultPrevented, false, 'puzzle names remain editable')
    assert.equal(send(document, 'dblclick', {}, [{ isContentEditable: true }]).defaultPrevented, false)
    assert.equal(send(document, 'wheel', { ctrlKey: true }).defaultPrevented, true)
    assert.equal(send(document, 'wheel', { ctrlKey: false }).defaultPrevented, false)
    assert.equal(send(document, 'keydown', { key: 'F11' }).defaultPrevented, true)
    assert.equal(send(document, 'keydown', { key: '+', ctrlKey: true }).defaultPrevented, true)
    assert.equal(send(document, 'keydown', { key: 'Enter', altKey: true }).defaultPrevented, false, 'hidden menu keyboard access remains available')
})

test('an explicit admin exit temporarily permits F11 while other kiosk protections stay active', () => {
    const document = new EventTarget()
    setupKioskInteractions(document)
    assert.equal(send(document, 'keydown', { key: 'F11' }).defaultPrevented, true)
    document.dispatchEvent(new Event('kiosk-exit-requested'))
    assert.equal(send(document, 'keydown', { key: 'F11' }).defaultPrevented, false)
    assert.equal(send(document, 'contextmenu').defaultPrevented, true)
    assert.equal(send(document, 'keydown', { key: '+', ctrlKey: true }).defaultPrevented, true)
})
