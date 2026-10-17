const { test } = require('node:test')
const assert = require('node:assert/strict')
const { HiddenExitSequence, exitAppFullscreen } = require('../dist-ts/hiddenExit')
test('reset, counter, reset exits only within the hidden sequence window', () => {
    const sequence = new HiddenExitSequence()
    assert.equal(sequence.press('reset', 0), false)
    assert.equal(sequence.press('counter', 1000), false)
    assert.equal(sequence.press('reset', 2000), true)
    assert.equal(sequence.press('reset', 3000), false)
    sequence.press('counter', 4000)
    assert.equal(sequence.press('reset', 12_000), false)
    sequence.press('counter', 12_100)
    sequence.press('counter', 12_200)
    assert.equal(sequence.press('reset', 12_300), false)
})
test('escape exits browser fullscreen and expands simple mode without navigating or deleting data', () => {
    const previous = global.document
    let exited = 0, expanded = 0
    global.document = {
        fullscreenElement: {}, exitFullscreen() { exited++; return Promise.resolve() },
        getElementById(id) { return id === 'balloons-view' ? { classList: { contains: () => true } } : { click() { expanded++ } } }
    }
    try { exitAppFullscreen(); assert.equal(exited, 1); assert.equal(expanded, 1) }
    finally { global.document = previous }
})
