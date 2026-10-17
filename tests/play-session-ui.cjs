const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const sessionModule = require('../dist-ts/playSession')

for (const activity of ['sketchpad', 'matching']) test(`cooldown settings, return balloon, and idle screensaver work with ${activity}`, () => {
    let now = 0, interval, timeout, breaks = 0, pops = 0, saverVisible = false
    class Element {
        events = new Map()
        hidden = false
        open = false
        value = ''
        children = new Map()
        addEventListener(name, fn, capture = false) {
            const listeners = this.events.get(name) ?? []
            listeners.push({ fn, capture })
            this.events.set(name, listeners)
        }
        emit(name, values = {}) {
            let stopped = false
            const event = { button: 0, pointerId: 1, clientX: 10, clientY: 10, preventDefault() {},
                stopPropagation() {},
                stopImmediatePropagation() { stopped = true }, ...values }
            for (const { fn } of [...(this.events.get(name) ?? [])].sort((a, b) => Number(b.capture) - Number(a.capture))) {
                fn(event)
                if (stopped) break
            }
        }
        setAttribute() {}
        querySelector(selector) {
            if (!this.children.has(selector)) this.children.set(selector, new Element())
            return this.children.get(selector)
        }
        showModal() { this.open = true }
        close() { this.open = false }
    }
    const target = new Element(), sketch = new Element(), timer = new Element(), elements = [], storage = new Map()
    sketch.shadowRoot = new Element()
    const location = { hash: '#/balloons' }
    const context = {
        exports: {}, Date: class extends Date { static now() { return now } }, performance: { now: () => now },
        location, history: { replaceState(a, b, hash) { location.hash = hash } }, queueMicrotask: fn => fn(),
        localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
        document: { hidden: false, body: { append(element) { elements.push(element) } },
            createElement: () => new Element(), querySelector: () => target, getElementById: id => id === 'play-timer' ? timer : sketch },
        window: { setTimeout(fn) { timeout = fn; return 1 }, setInterval(fn) { interval = fn }, addEventListener() {} },
        clearTimeout() { timeout = undefined },
        require(name) {
            if (name === './playSession') return sessionModule
            if (name === './activation') return { bindActivation(element, action) { element.addEventListener('click', action) } }
            if (name === './mystify') return { createMystify: () => ({ show() { saverVisible = true }, hide() { saverVisible = false }, visible: () => saverVisible }) }
            if (name === './audio') return { unlockAudio() {}, playPopSound() { pops++ } }
            throw new Error(name)
        }
    }
    vm.runInNewContext(fs.readFileSync('dist-ts/playSessionUI.js', 'utf8'), context)
    const app = context.exports.setupPlaySession(() => { breaks++ })
    const balloon = elements.find(element => element.className === 'cooldown-balloon')
    const dialog = elements.find(element => element.className === 'play-settings')
    let ordinaryClicks = 0
    target.addEventListener('click', () => ordinaryClicks++)
    target.emit('pointerdown'); target.emit('pointerup'); target.emit('click')
    assert.equal(ordinaryClicks, 1, 'a short press remains an ordinary background selection')
    target.emit('pointerdown'); now = 1000; timeout()
    assert.equal(dialog.open, true)
    now = 4000
    target.emit('pointerup'); target.emit('click')
    assert.equal(ordinaryClicks, 1, 'a long hold must not apply the sky selection')
    dialog.querySelector('[name="cooldownApp"]').value = activity
    dialog.querySelector('[name="enabled"]').value = 'true'
    dialog.querySelector('[name="timeLimit"]').value = '0.1'
    dialog.querySelector('[name="cooldown"]').value = '0.1'
    dialog.querySelector('form').emit('submit')
    assert.equal(dialog.open, false)
    assert.equal(JSON.parse(storage.get('balloons.play.settings')).enabled, true)
    assert.equal(timer.textContent, '0:06')
    now = 5000; interval()
    assert.equal(breaks, 0, 'saving settings does not start the timer')
    now = 20_000
    app.objectCreated()
    now = 23_000
    app.objectCreated()
    assert.equal(timer.textContent, '0:03', 'timer counts down without resetting for every object')
    now = 26_000; interval()
    assert.equal(location.hash, '/' + activity)
    location.hash = '#/' + activity // Browser location normalizes assigned hashes.
    interval()
    assert.equal(balloon.hidden, true)
    assert.equal(app.resolveView('balloons'), activity, 'normal return navigation cannot skip cooldown')
    assert.equal(sketch.shadowRoot.querySelector('#back-to-balloons').hidden, true)
    now = 32_000; interval()
    assert.equal(balloon.hidden, false)
    balloon.emit('pointerdown', { pointerType: 'touch', isPrimary: false })
    assert.equal(pops, 1, 'a secondary touch pops on contact without waiting for click or pointer-up')
    balloon.emit('click')
    assert.equal(pops, 1, 'a follow-up click must not pop twice')
    assert.equal(balloon.hidden, true)
    assert.equal(app.resolveView('balloons'), 'balloons')
    now += 6000; interval()
    assert.equal(saverVisible, false, 'a short cooldown must not trigger the screensaver')
    now += 594_000; interval()
    assert.equal(saverVisible, true)
    app.objectCreated()
    assert.equal(saverVisible, false)
})
