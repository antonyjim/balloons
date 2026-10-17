const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const flush = () => new Promise(resolve => setImmediate(resolve))

function app({ failRegistration = false, readyState = 'complete' } = {}) {
    const browser = new EventTarget(), document = new EventTarget(), serviceWorker = new EventTarget(), registration = new EventTarget()
    const button = new EventTarget()
    Object.assign(button, { hidden: true, disabled: false, textContent: '' })
    const state = { registrations: 0, updates: 0, reloads: 0, messages: [], timeouts: new Map(), interval: null }
    let timeout = 0
    Object.assign(browser, {
        location: { reload() { state.reloads++ } },
        setTimeout(fn) { state.timeouts.set(++timeout, fn); return timeout },
        setInterval(fn) { state.interval = fn }
    })
    Object.assign(document, { hidden: false, readyState, querySelector: () => button })
    Object.assign(registration, {
        waiting: { postMessage(message) { state.messages.push(message) } }, installing: null,
        async update() { state.updates++ }
    })
    Object.assign(serviceWorker, {
        controller: {},
        async register() {
            state.registrations++
            if (failRegistration && state.registrations === 1) throw new Error('transient registration failure')
            return registration
        }
    })
    const context = {
        exports: {}, navigator: { serviceWorker, onLine: true }, window: browser, document,
        AbortController, clearTimeout(id) { state.timeouts.delete(id) }, console: { warn() {} },
        fetch: async () => { throw new Error('metadata offline') },
        require: () => ({ bindActivation(element, action) { element.addEventListener('click', action) } })
    }
    vm.runInNewContext(fs.readFileSync('dist-ts/appUpdates.js', 'utf8'), context)
    context.exports.setupAppUpdates()
    return { state, button, browser, document, serviceWorker, registration }
}

test('a metadata failure does not block worker updates or the waiting release control', async () => {
    const client = app()
    await flush()
    assert.equal(client.state.updates, 1)
    assert.equal(client.button.hidden, false)
    client.button.dispatchEvent(new Event('click'))
    assert.equal(client.button.disabled, true)
    assert.equal(client.state.messages[0].type, 'SKIP_WAITING')
    client.serviceWorker.controller = {}
    client.serviceWorker.dispatchEvent(new Event('controllerchange'))
    assert.equal(client.state.reloads, 1)
})

test('registration retries on reconnect without clearing storage or requiring reinstall', async () => {
    const client = app({ failRegistration: true })
    await flush()
    assert.equal(client.state.registrations, 1)
    client.browser.dispatchEvent(new Event('online'))
    await flush()
    assert.equal(client.state.registrations, 2)
    assert.equal(client.state.updates, 1)
})

test('activation in another tab offers reload without discarding this tab immediately', async () => {
    const client = app()
    await flush()
    client.registration.waiting = null
    client.serviceWorker.controller = {}
    client.serviceWorker.dispatchEvent(new Event('controllerchange'))
    assert.equal(client.state.reloads, 0)
    assert.equal(client.button.hidden, false)
    client.button.dispatchEvent(new Event('click'))
    assert.equal(client.state.reloads, 1)
})

test('an unresponsive waiting worker re-enables the update button for retry', async () => {
    const client = app()
    await flush()
    client.button.dispatchEvent(new Event('click'))
    assert.equal(client.button.disabled, true)
    for (const fn of client.state.timeouts.values()) fn()
    assert.equal(client.button.disabled, false)
    client.button.dispatchEvent(new Event('click'))
    assert.equal(client.state.messages.length, 2)
})

test('setup before window load registers once after load', async () => {
    const client = app({ readyState: 'loading' })
    assert.equal(client.state.registrations, 0)
    client.browser.dispatchEvent(new Event('load'))
    await flush()
    client.browser.dispatchEvent(new Event('load'))
    assert.equal(client.state.registrations, 1)
})
