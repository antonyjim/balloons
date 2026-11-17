const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const sessionModule = require('../dist-ts/playSession')

for (const activity of ['sketchpad', 'matching', 'puzzle', 'off']) test(`cooldown settings, return balloon, and idle screensaver work with ${activity}`, () => {
    let scheduleSave, scheduleDraft
    let now = 0, interval, timeout, breaks = 0, pops = 0, saverVisible = false, canDismiss
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
        focus() { this.focused = true }
        querySelector(selector) {
            if (!this.children.has(selector)) this.children.set(selector, new Element())
            return this.children.get(selector)
        }
        showModal() { this.open = true }
        close() { this.open = false }
    }
    const target = new Element(), sketch = new Element(), timer = new Element(), elements = [], storage = new Map()
    sketch.shadowRoot = new Element()
    const windowEvents = new Map()
    const location = { hash: '#/balloons' }
    const context = {
        exports: {}, CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init.detail } },
        Date: class extends Date { static now() { return now } }, performance: { now: () => now },
        location, history: { replaceState(a, b, hash) { location.hash = hash } }, queueMicrotask: fn => fn(),
        localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
        document: { hidden: false, body: { append(element) { elements.push(element) } },
            createElement: () => new Element(), querySelector: () => target, getElementById: id => id === 'play-timer' ? timer : sketch },
        window: { setTimeout(fn) { timeout = fn; return 1 }, setInterval(fn) { interval = fn }, addEventListener(name, fn) { windowEvents.set(name, fn) }, dispatchEvent() {} },
        clearTimeout() { timeout = undefined },
        require(name) {
            if (name === './cooldownSchedule') return require('../dist-ts/cooldownSchedule')
            if (name === './cooldownScheduleUI') return { openScheduleBuilder(settings, save) { scheduleDraft = settings; scheduleSave = save } }
            if (name === './playSession') return sessionModule
            if (name === './activation') return { bindActivation(element, action) { element.addEventListener('click', action) } }
            if (name === './mystify') return { createMystify: (dismiss) => { canDismiss = dismiss; return ({ show() { saverVisible = true }, hide() { saverVisible = false }, visible: () => saverVisible }) } }
            if (name === './audio') return { unlockAudio() {}, playPopSound() { pops++ } }
            throw new Error(name)
        }
    }
    vm.runInNewContext(fs.readFileSync('dist-ts/playSessionUI.js', 'utf8'), context)
    const app = context.exports.setupPlaySession(() => { breaks++ })
    const balloon = elements.find(element => element.className === 'cooldown-balloon')
    const dialog = elements.find(element => element.className === 'play-settings')
    windowEvents.get('puzzle-activity-settings')()
    assert.equal(dialog.open, true)
    dialog.close()
    windowEvents.get('puzzle-activity-settings')()
    assert.equal(dialog.open, true, 'activity settings remain available alongside the schedule')
    assert.equal(dialog.querySelector('[name="cooldownApp"]').value, 'sketchpad')
    for (const name of ['timeLimit', 'cooldown']) {
        const input = dialog.querySelector(`[name="${name}"]`)
        dialog.querySelector(`[data-preset="${name}-10"]`).emit('click')
        assert.equal(input.value, '10')
        dialog.querySelector(`[data-adjust="${name}-down"]`).emit('click')
        assert.equal(input.value, '9')
        dialog.querySelector(`[data-adjust="${name}-up"]`).emit('click')
        assert.equal(input.value, '10')
        input.value = '0.1'
        dialog.querySelector(`[data-adjust="${name}-down"]`).emit('click')
        assert.equal(input.value, '0.1', 'touch adjustment respects the minimum')
        input.value = '240'
        dialog.querySelector(`[data-adjust="${name}-up"]`).emit('click')
        assert.equal(input.value, '240', 'touch adjustment respects the maximum')
    }
    now = 4000
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
    const warning = elements.find(element => element.className === 'timeout-countdown')
    assert.equal(warning.hidden, true, 'no warning before play starts')
    now = 20_000
    app.objectCreated()
    assert.equal(warning.hidden, false)
    assert.equal(warning.textContent, 'Timeout in 6 seconds')
    now = 23_000
    app.objectCreated()
    assert.equal(timer.textContent, '0:03', 'timer counts down without resetting for every object')
    assert.equal(warning.textContent, 'Timeout in 3 seconds')
    now = 25_000; interval()
    assert.equal(warning.textContent, 'Timeout in 1 second')
    now = 26_000; interval()
    assert.equal(warning.hidden, true, 'countdown clears when timeout begins')
    const route = activity === 'off' ? 'sketchpad' : activity
    assert.equal(location.hash, activity === 'off' ? '#/balloons' : '/' + route, 'Off cooldown fades over the current app')
    if (activity === 'off') {
        assert.equal(saverVisible, true)
        assert.equal(canDismiss(), false)
        app.objectCreated()
        assert.equal(saverVisible, true, 'object creation cannot dismiss an Off cooldown')
    }
    location.hash = '#/' + route // Browser location normalizes assigned hashes.
    interval()
    assert.equal(balloon.hidden, true)
    assert.equal(app.resolveView('balloons'), route, 'normal return navigation cannot skip cooldown')
    assert.equal(sketch.shadowRoot.querySelector('#back-to-balloons').hidden, true)
    const puzzleReturn = sketch.shadowRoot.querySelector('#puzzle-return')
    if (activity === 'puzzle') {
        assert.equal(puzzleReturn.disabled, true)
        assert.equal(puzzleReturn.textContent, 'Bubbles in 0:06')
        puzzleReturn.onclick()
        assert.equal(app.resolveView('balloons'), 'puzzle')
    }
    now = 32_000; interval()
    if (activity === 'off') { assert.equal(canDismiss(), true); saverVisible = false }
    assert.equal(balloon.hidden, false)
    if (activity === 'puzzle') {
        assert.equal(puzzleReturn.disabled, false)
        assert.equal(puzzleReturn.textContent, 'Return to bubbles')
    }
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
    const beforeManual = breaks
    app.showScreensaver()
    assert.equal(saverVisible, true, 'screensaver can be opened on demand')
    assert.equal(breaks, beforeManual + 1)
    windowEvents.get('shared-cooldown-settings')()
    assert.equal(scheduleDraft.enabled, false)
    const scheduleStart = now
    scheduleSave({ enabled: true, screensaverMinutes: .1, apps: [{ app: 'balloons', minutes: .1 }, { app: 'sketchpad', minutes: .1 }] })
    assert.equal(JSON.parse(storage.get('balloons.cooldown-schedule.v1')).startedAt, scheduleStart)
    assert.equal(app.resolveView('matching'), 'balloons', 'enabled schedule owns the current activity')
    assert.equal(saverVisible, false)
    assert.equal(warning.hidden, false, 'scheduled apps receive an onscreen warning')
    assert.equal(warning.textContent, 'Timeout in 6 seconds')
    now = scheduleStart + 5000; interval()
    assert.equal(warning.textContent, 'Timeout in 1 second')
    now = scheduleStart + 6000; interval()
    assert.equal(saverVisible, true, 'screensaver starts at the app deadline')
    assert.equal(canDismiss(), false, 'touch cannot skip a scheduled screensaver break')
    app.objectCreated()
    assert.equal(saverVisible, true, 'new objects cannot dismiss a scheduled break')
    now = scheduleStart + 12000; interval()
    assert.equal(saverVisible, false)
    assert.equal(app.resolveView('balloons'), 'sketchpad', 'the next checked app starts automatically')
    now = scheduleStart + 24000; interval()
    assert.equal(app.resolveView('puzzle'), 'balloons', 'the complete schedule repeats')
    now = scheduleStart + 30000; interval()
    assert.equal(saverVisible, true)
    windowEvents.get('admin-override')()
    assert.equal(saverVisible, false, 'admin override dismisses a locked screensaver')
    assert.equal(warning.hidden, true)
    assert.equal(timer.textContent, 'Paused')
    now += 60000; interval()
    assert.equal(saverVisible, false, 'paused automation does not immediately restore the screensaver')
    assert.equal(app.resolveView('matching'), 'matching', 'admin may switch apps freely')
    windowEvents.get('resume-automation')()
    assert.equal(app.resolveView('matching'), 'balloons', 'resume starts the schedule afresh')
    assert.equal(JSON.parse(storage.get('balloons.cooldown-schedule.v1')).startedAt, now)
    scheduleSave({ ...scheduleDraft, enabled: false })
    assert.equal(JSON.parse(storage.get('balloons.cooldown-schedule.v1')).settings.enabled, false)
    assert.equal(app.resolveView('matching'), 'matching', 'disabling returns control to normal navigation')
    windowEvents.get('puzzle-screensaver-settings')()
    const saverSettings = elements.filter(element => element.className === 'play-settings')[1]
    saverSettings.querySelector('[name="screensaver-enabled"]').value = 'false'
    saverSettings.querySelector('[name="idle"]').value = '1'
    saverSettings.querySelector('form').emit('submit')
    assert.equal(JSON.parse(storage.get('balloons.play.settings')).screensaverEnabled, false)
    app.showScreensaver(); assert.equal(saverVisible, false, 'manual screensavers are disabled')
    now += 60 * 60000; interval()
    assert.equal(saverVisible, false, 'idle screensavers are disabled')


})
