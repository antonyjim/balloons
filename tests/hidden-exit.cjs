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

test('browser-controlled fullscreen gives visible guidance and enables the administrator escape key', async () => {
    const previous = global.document
    let requested = 0
    global.document = {
        getElementById: () => null,
        dispatchEvent(event) { assert.equal(event.type, 'kiosk-exit-requested'); requested++ }
    }
    try {
        const message = await exitAppFullscreen()
        assert.match(message, /F11 is enabled/)
        assert.match(message, /managed kiosks/)
        assert.equal(requested, 1)
    } finally { global.document = previous }
})

test('fullscreen API rejection is reported instead of failing silently', async () => {
    const previous = global.document
    global.document = { fullscreenElement: {}, exitFullscreen: async () => { throw new Error('blocked') }, getElementById: () => null }
    try { assert.match(await exitAppFullscreen(), /could not exit fullscreen/) }
    finally { global.document = previous }
})

test('older Safari fullscreen state and exit methods are supported', async () => {
    const previous = global.document
    let exited = false
    global.document = { webkitIsFullScreen: true, webkitCancelFullScreen() { exited = true }, getElementById: () => null }
    try { assert.equal(await exitAppFullscreen(), 'Exited fullscreen.'); assert.equal(exited, true) }
    finally { global.document = previous }
})
