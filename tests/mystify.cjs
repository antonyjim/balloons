const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs'), vm = require('node:vm')
function harness(reduced = false) {
    const events = new Map(), browserEvents = new Map(), handlers = new Map()
    let scheduled, canceled = 0, restored = 0, lines = 0
    const canvas = { hidden: true, setAttribute() {}, focus() {}, addEventListener: (name, fn) => handlers.set(name, fn), getContext: () => ({ fillRect() {}, beginPath() {}, arc() {}, fill() {}, moveTo() {}, lineTo() { lines++ }, closePath() {}, stroke() {} }) }
    const document = { hidden: false, activeElement: { focus() { restored++ } }, createElement: () => canvas, body: { append() {} }, addEventListener: (name, fn) => events.set(name, fn) }
    const context = {
        exports: {}, document, innerWidth: 800, innerHeight: 600,
        window: { matchMedia: () => ({ matches: reduced }), addEventListener: (name, fn) => browserEvents.set(name, fn) },
        requestAnimationFrame(fn) { scheduled = fn; return 1 }, cancelAnimationFrame() { scheduled = undefined; canceled++ }
    }
    vm.runInNewContext(fs.readFileSync('dist-ts/mystify.js', 'utf8'), context)
    const saver = context.exports.createMystify()
    return { saver, canvas, document, events, handlers, restored: () => restored, lines: () => lines, canceled: () => canceled, scheduled: () => scheduled,
        frame(time) { const fn = scheduled; scheduled = undefined; fn?.(time) } }
}
test('screensaver varies its patterns, pauses in background and returns focus when dismissed', () => {
    const app = harness()
    app.saver.show(); assert.equal(app.saver.visible(), true)
    app.frame(1000)
    for (let i = 1; i <= 510; i++) app.frame(1000 + i * 50)
    const before = app.lines(); app.frame(26600)
    assert.ok(app.lines() - before > 100, 'screensaver moves from polygons to looping light patterns')
    app.document.hidden = true; app.events.get('visibilitychange')()
    assert.equal(app.scheduled(), undefined)
    app.document.hidden = false; app.events.get('visibilitychange')()
    assert.equal(typeof app.scheduled(), 'function')
    app.handlers.get('pointerdown')({ preventDefault() {}, stopImmediatePropagation() {} })
    assert.equal(app.saver.visible(), false)
    assert.equal(app.canvas.hidden, true)
    assert.equal(app.restored(), 1)
    assert.equal(app.scheduled(), undefined)
})
test('reduced-motion screensaver draws once and keyboard dismissal still works', () => {
    const app = harness(true)
    app.saver.show(); app.frame(1000)
    assert.equal(app.scheduled(), undefined)
    app.handlers.get('keydown')({ preventDefault() {}, stopImmediatePropagation() {} })
    assert.equal(app.saver.visible(), false)
})
