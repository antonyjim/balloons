const { test } = require('node:test')
const assert = require('node:assert/strict')
const { CornerConfigurationSequence } = require('../dist-ts/hiddenExit')
const { parseEnabledGames } = require('../dist-ts/sharedMenu')
test('configuration requires three clockwise circuits beginning at top left', () => {
    const sequence = new CornerConfigurationSequence()
    for (let i = 0; i < 11; i++) assert.equal(sequence.press(i % 4, i * 500), false)
    assert.equal(sequence.press(3, 5500), true)
    assert.equal(sequence.press(3, 5600), false)
})
test('wrong corners, cancellation and timeout cannot unlock configuration', () => {
    for (const interrupt of [s => s.press(3, 200), s => s.reset(), s => s.press(1, 20000)]) {
        const sequence = new CornerConfigurationSequence()
        sequence.press(0, 0); interrupt(sequence)
        for (let i = 1; i < 12; i++) assert.equal(sequence.press(i % 4, 21000 + i * 100), false)
    }
})
test('saved game selection rejects unknown games and always keeps one available', () => {
    assert.deepEqual(parseEnabledGames(['puzzle', 'unknown']), ['puzzle'])
    assert.deepEqual(parseEnabledGames([]), ['balloons'])
    assert.deepEqual(parseEnabledGames(null), ['balloons', 'sketchpad', 'matching', 'puzzle'])
})

test('reuses the balloons toolbar and exposes existing settings without unlocking configuration', () => {
    const fs = require('node:fs'), vm = require('node:vm')
    class Element {
        hidden = false; children = []; attributes = {}; nodes = new Map(); dataset = {}
        classes = new Set()
        classList = { remove: name => this.classes.delete(name), contains: name => this.classes.has(name), toggle: (name, value) => { if (value) this.classes.add(name); else this.classes.delete(name); return !!value } }
        setAttribute(name, value) { this.attributes[name] = value }
        append(...nodes) { this.children.push(...nodes) }
        prepend(node) { this.children.unshift(node) }
        querySelector(selector) {
            if (!this.nodes.has(selector)) this.nodes.set(selector, new Element())
            return this.nodes.get(selector)
        }
        querySelectorAll(selector) {
            if (selector === '[data-settings]') return ['activity', 'cooldown', 'screensaver', 'balloon', 'puzzle'].map(section => {
                const button = this.querySelector(section); button.dataset.settings = section; return button
            })
            return []
        }
    }
    const toolbar = new Element(), panel = new Element(), trigger = new Element(), body = new Element()
    panel.hidden = true
    trigger.click = () => { panel.hidden = false }
    const created = [], events = [], listeners = new Map(), documentEvents = new Map(), storage = new Map()
    const backgroundOptions = new Element()
    const context = {
        exports: {}, performance, setTimeout, clearTimeout, CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init.detail } }, Event,
        localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
        document: { body, querySelector: () => toolbar, getElementById: id => id === 'background-menu' ? panel : id === 'balloon-background-options' ? backgroundOptions : trigger,
            createElement: tag => { const element = new Element(); created.push({ tag, element }); return element }, addEventListener: (name, listener) => documentEvents.set(name, listener) },
        window: { innerWidth: 1000, innerHeight: 800, addEventListener: (type, listener) => listeners.set(type, listener), dispatchEvent: event => events.push(event), location: { hash: '' } },
        require(name) {
            if (name === './menuState') return { loadMenuState: () => ({ enabled: storage.get('balloons.show-menu') !== 'false', collapsed: storage.get('balloons.menu-collapsed') === 'true' }), saveMenuState: state => { if (state.enabled !== undefined) storage.set('balloons.show-menu', String(state.enabled)); if (state.collapsed !== undefined) storage.set('balloons.menu-collapsed', String(state.collapsed)) } }
            if (name === '../pageScale' || name === './pageScale') return require('../dist-ts/pageScale')
            if (name === './activation') return { bindActivation: (element, action) => { element.activate = action } }
            if (name === './hiddenExit') return require('../dist-ts/hiddenExit')
            throw new Error(name)
        }
    }
    vm.runInNewContext(fs.readFileSync('dist-ts/sharedMenu.js', 'utf8'), context)
    let settingsMounted = 0
    const menu = context.exports.setupSharedMenu(() => settingsMounted++)
    assert.equal(body.children[0], toolbar, 'moves the original toolbar outside the hidden game host')
    assert.equal(created.some(({ tag }) => tag === 'dialog'), false)
    const config = panel.children[0]
    assert.equal(config.hidden, false, 'settings are available immediately')
    for (const section of ['activity', 'cooldown', 'screensaver', 'balloon', 'puzzle']) config.querySelector(section).activate()
    assert.equal(settingsMounted, 2)
    assert.deepEqual(events.map(event => event.type), ['puzzle-activity-settings', 'shared-cooldown-settings', 'puzzle-screensaver-settings', 'shared-game-settings', 'shared-game-settings'])
    assert.deepEqual(events.slice(3).map(event => event.detail), ['balloon', 'puzzle'])
    for (const view of ['balloons', 'sketchpad', 'matching', 'puzzle']) {
        menu.view(view)
        assert.equal(body.attributes['data-app'], view, 'menu palette follows the active app')
        assert.equal(backgroundOptions.hidden, view !== 'balloons', 'background options only appear in Balloons')
    }
    const timer = toolbar.querySelector('.timer-card'), showTimer = config.querySelector('#show-timer')
    assert.equal(timer.hidden, false)
    showTimer.checked = false; showTimer.onchange()
    assert.equal(timer.hidden, true)
    assert.equal(storage.get('balloons.show-timer'), 'false')
    menu.view('matching'); assert.equal(timer.hidden, true, 'navigation preserves timer visibility')
    storage.set('balloons.show-timer', 'true')
    listeners.get('storage')({ key: 'balloons.show-timer' })
    assert.equal(timer.hidden, false, 'saved visibility changes sync across tabs')
    const scale = config.querySelector('#page-scale')
    assert.equal(scale.value, '100')
    scale.value = '125'; scale.onchange()
    assert.equal(events.at(-1).type, 'page-scale-change')
    assert.equal(events.at(-1).detail, 125)
    config.querySelector('#reset-page-scale').activate()
    assert.equal(scale.value, '100')
    assert.equal(events.at(-1).detail, 100)
    const balloonLink = created.find(({ tag }) => tag === 'a').element
    assert.equal(balloonLink.children[0].src, '/icons/objects/latex.svg')
    assert.equal(balloonLink.attributes['aria-label'], 'Open Balloons')
    listeners.get('open-shared-menu')()
    assert.equal(panel.hidden, false)
    config.querySelector('#show-menu').checked = false
    config.querySelector('#show-menu').onchange()
    assert.equal(toolbar.hidden, true)
    const progress = created.find(({ element }) => element.id === 'menu-unlock-progress').element
    const corners = [[100, 100], [900, 100], [900, 700], [100, 700]]
    for (let i = 0; i < 12; i++) {
        const [clientX, clientY] = corners[i % 4]
        const event = { isPrimary: true, button: 0, pointerId: 1, clientX, clientY }
        documentEvents.get('pointerdown')(event); documentEvents.get('pointerup')(event)
        if (i === 3) {
            assert.equal(progress.hidden, false)
            assert.equal(progress.dataset.remaining, '8')
            assert.equal(progress.attributes['aria-hidden'], 'true')
            assert.ok(!progress.innerHTML.includes('unlock-corner'), 'corner hitboxes remain invisible')
            assert.ok(!progress.innerHTML.includes('rounds'), 'feedback contains no visible words')
        }
        if (i >= 4 && i < 11) assert.equal(progress.dataset.remaining, String(11 - i))
    }
    assert.equal(progress.hidden, true)
    assert.equal(toolbar.hidden, false, 'one sequence restores the hidden menu')
    assert.equal(config.hidden, false, 'restoration keeps settings visible')
    assert.equal(storage.get('balloons.show-menu'), 'true')
    assert.equal(events.filter(event => event.type === 'admin-override').length, 1)
    menu.view('balloons')
    toolbar.hidden = true
    trigger.hidden = true; trigger.disabled = true
    for (const corner of [0, 3, 2, 1]) {
        const [clientX, clientY] = corners[corner]
        const event = { isPrimary: true, button: 0, pointerId: 2, clientX, clientY }
        documentEvents.get('pointerdown')(event); documentEvents.get('pointerup')(event)
    }
    const resets = events.filter(event => event.type === 'hidden-game-reset')
    assert.equal(resets.length, 1)
    assert.equal(resets[0].detail, 'balloons', 'reset targets the active game without activating a button')
    assert.equal(toolbar.hidden, true, 'reset does not reveal the menu')
    assert.equal(progress.hidden, true, 'counterclockwise reset shows no menu-unlock feedback')
    storage.set('balloons.show-menu', 'false'); storage.set('balloons.menu-collapsed', 'true')
    listeners.get('storage')({ key: 'balloons.menu-collapsed' })
    assert.equal(toolbar.hidden, true)
    assert.equal(toolbar.classList.contains('menu-collapsed'), true)
    assert.equal(config.querySelector('#show-menu').checked, false)
    listeners.get('open-shared-menu')()
    assert.equal(toolbar.hidden, false)
    assert.equal(toolbar.classList.contains('menu-collapsed'), false)
    assert.equal(storage.get('balloons.show-menu'), 'true')
    assert.equal(storage.get('balloons.menu-collapsed'), 'false')
    listeners.get('menu-enabled-change')({ detail: false })
    assert.equal(toolbar.hidden, true, 'profiles can hide the shared menu immediately')
    assert.equal(storage.get('balloons.show-menu'), 'false')



})

test('shared controls are stacked above every full-screen game host', () => {
    const html = require('node:fs').readFileSync('public/index.html', 'utf8')
    const rules = [...html.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    const layer = selector => {
        const layers = rules.filter(([, selectors]) => selectors.split(',').some(part => part.trim() === selector))
            .map(([, , body]) => body.match(/z-index:\s*(\d+)/)?.[1]).filter(Boolean).map(Number)
        assert.ok(layers.length, `${selector} has a stacking level`)
        return layers.at(-1)
    }
    for (const game of ['sketchpad', 'matching', 'puzzle']) {
        assert.ok(layer('#shared-toolbar') > layer(`#${game}-view`), `menu must receive input above ${game}`)
    }
})

test('corner targets accept taps away from the edges and slow clockwise rounds', () => {
    const { configurationCorner } = require('../dist-ts/hiddenExit')
    assert.equal(configurationCorner(100, 100, 1000, 800), 0)
    assert.equal(configurationCorner(900, 100, 1000, 800), 1)
    assert.equal(configurationCorner(900, 700, 1000, 800), 2)
    assert.equal(configurationCorner(100, 700, 1000, 800), 3)
    assert.equal(configurationCorner(500, 400, 1000, 800), -1)
    const sequence = new CornerConfigurationSequence()
    for (let i = 0; i < 12; i++) assert.equal(sequence.press(i % 4, i * 12000), i === 11)
})
