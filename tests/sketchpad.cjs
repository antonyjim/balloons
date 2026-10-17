const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')

class Element extends EventTarget {
    style = {}
    dataset = {}
    classList = { toggle() {} }
    hidden = false
    value = '12'
    setAttribute() {}
    getBoundingClientRect() { return { left: 0, top: 0, width: 100, height: 100 } }
}
class Canvas extends Element {
    width = 0
    height = 0
    content = 'blank'
    captures = new Set()
    context = {
        fillStyle: '', save() {}, restore() {}, setTransform() {}, beginPath() {}, arc() {},
        canvas: this,
        fillRect() { this.canvas.content = 'paper' },
        fill() { this.canvas.content = 'drawn' },
        drawImage(other) { this.canvas.content = other.content }
    }
    getContext() { return this.context }
    setPointerCapture(id) { this.captures.add(id) }
    hasPointerCapture(id) { return this.captures.has(id) }
    releasePointerCapture(id) { this.captures.delete(id) }
    toBlob(callback) { callback(new Blob([this.content])) }
}
test('sketchpad preserves the drawing across view switches and resize and exports it for balloons', async () => {
    const canvas = new Canvas()
    const elements = Object.fromEntries(['color-wheel', 'color-preview', 'brush-size', 'size-toggle', 'size-panel',
        'size-preview', 'clear', 'back-to-balloons', 'use-drawing', 'sketch-status'].map(id => [id, new Element()]))
    elements.canvas = canvas
    const pen = new Element(); pen.dataset.tool = 'pen'
    const root = new Element()
    root.querySelector = selector => elements[selector.slice(1)]
    root.querySelectorAll = () => [pen]
    const host = { attachShadow: () => root }
    const browser = new EventTarget()
    Object.assign(browser, { innerWidth: 800, innerHeight: 600, devicePixelRatio: 1 })
    const module = { exports: {} }
    const context = {
        module, exports: module.exports, window: browser, Blob,
        document: { createElement: () => new Canvas() },
        require(id) {
            if (id === 'sketchpad-markup') return fs.readFileSync('src/sketchpad/index.html', 'utf8')
            if (id === 'sketchpad-styles') return fs.readFileSync('src/sketchpad/style.css', 'utf8')
            if (id === '../activation') return { bindActivation(element, action) {
                if (action) element.addEventListener('click', action)
            } }
            throw new Error(id)
        }
    }
    vm.runInNewContext(fs.readFileSync('dist-ts/sketchpad/index.js', 'utf8'), context)
    const exported = []
    const sketch = module.exports.mountSketchpad(host, async blob => exported.push(await blob.text()))
    assert.ok(!root.innerHTML.includes('<script'))
    canvas.dispatchEvent(Object.assign(new Event('pointerdown', { cancelable: true }),
        { pointerType: 'touch', pointerId: 4, clientX: 200, clientY: 300 }))
    assert.equal(canvas.content, 'drawn')
    sketch.setActive(false)
    assert.equal(canvas.captures.size, 0)
    browser.innerWidth = 1000
    browser.dispatchEvent(new Event('resize'))
    assert.equal(canvas.width, 800, 'hidden sketchpad should not resize or clear its drawing')
    sketch.setActive(true)
    assert.equal(canvas.width, 1000)
    assert.equal(canvas.content, 'drawn')
    assert.equal(await (await sketch.snapshot()).text(), 'drawn')
    elements['use-drawing'].dispatchEvent(new Event('click'))
    await new Promise(resolve => setImmediate(resolve))
    assert.deepEqual(exported, ['drawn'])
})
