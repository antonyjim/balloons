const { test } = require('node:test')
const assert = require('node:assert/strict')
const { bindActivation } = require('../dist-ts/activation')
class Control extends EventTarget {
    captured = new Set()
    nativeClicks = 0
    setPointerCapture(id) { this.captured.add(id) }
    hasPointerCapture(id) { return this.captured.has(id) }
    releasePointerCapture(id) { this.captured.delete(id) }
    focus() {}
    getBoundingClientRect() { return { left: 0, top: 0, right: 100, bottom: 100 } }
    click() { this.nativeClicks++; this.dispatchEvent(event('click', { detail: 0 })) }
}
function event(type, overrides = {}) {
    return Object.assign(new Event(type, { cancelable: true }), {
        pointerId: 7, pointerType: 'touch', isPrimary: false, button: 0,
        clientX: 40, clientY: 40, detail: 1, ...overrides
    })
}
test('a non-primary touch activates the toolbar once and suppresses its compatibility click', () => {
    const control = new Control()
    let count = 0
    bindActivation(control, () => count++)
    control.dispatchEvent(event('pointerdown'))
    control.dispatchEvent(event('pointerup'))
    assert.equal(count, 1)
    const click = event('click')
    control.dispatchEvent(click)
    assert.equal(click.defaultPrevented, true)
    assert.equal(count, 1)
    control.dispatchEvent(event('click', { detail: 0 }))
    assert.equal(count, 2, 'keyboard activation still works after a touch')
})
test('mouse controls still use click and canceled or dragged touches do not activate', () => {
    const control = new Control()
    let count = 0
    bindActivation(control, () => count++)
    control.dispatchEvent(event('pointerdown', { pointerType: 'mouse' }))
    control.dispatchEvent(event('pointerup', { pointerType: 'mouse' }))
    assert.equal(count, 0)
    control.dispatchEvent(event('click', { pointerType: 'mouse' }))
    assert.equal(count, 1)
    control.dispatchEvent(event('pointerdown'))
    control.dispatchEvent(event('pointercancel'))
    control.dispatchEvent(event('pointerup'))
    assert.equal(count, 1)
    control.dispatchEvent(event('pointerdown'))
    control.dispatchEvent(event('pointerup', { clientX: 120 }))
    assert.equal(count, 1)
})
test('secondary-touch link activation preserves native click navigation', () => {
    const link = new Control()
    bindActivation(link)
    link.dispatchEvent(event('pointerdown'))
    link.dispatchEvent(event('pointerup'))
    assert.equal(link.nativeClicks, 1)
    const duplicate = event('click')
    link.dispatchEvent(duplicate)
    assert.equal(duplicate.defaultPrevented, true)
})
test('controls keep separate pointer captures without taking the canvas pointer', () => {
    const a = new Control(), b = new Control()
    let first = 0, second = 0
    bindActivation(a, () => first++)
    bindActivation(b, () => second++)
    a.dispatchEvent(event('pointerdown', { pointerId: 2 }))
    b.dispatchEvent(event('pointerdown', { pointerId: 3 }))
    assert.deepEqual([...a.captured], [2])
    assert.deepEqual([...b.captured], [3])
    b.dispatchEvent(event('pointerup', { pointerId: 3 }))
    a.dispatchEvent(event('pointerup', { pointerId: 2 }))
    assert.equal(first, 1)
    assert.equal(second, 1)
})
