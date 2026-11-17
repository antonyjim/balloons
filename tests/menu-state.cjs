const { test } = require('node:test')
const assert = require('node:assert/strict')
const vm = require('node:vm'), fs = require('node:fs')
const source = fs.readFileSync('dist-ts/menuState.js', 'utf8')
function load(storage) {
    const context = { exports: {}, localStorage: storage }
    vm.runInNewContext(source, context)
    return context.exports
}
test('enabled and collapsed states persist independently across reloads', () => {
    const saved = new Map()
    const storage = { getItem: key => saved.get(key), setItem: (key, value) => saved.set(key, value) }
    let api = load(storage)
    assert.equal(api.loadMenuState().enabled, true)
    assert.equal(api.loadMenuState().collapsed, false)
    for (const enabled of [true, false]) for (const collapsed of [true, false]) {
        api.saveMenuState({ enabled, collapsed }); api = load(storage)
        assert.equal(api.loadMenuState().enabled, enabled)
        assert.equal(api.loadMenuState().collapsed, collapsed)
    }
    api.saveMenuState({ enabled: false, collapsed: true })
    api.saveMenuState({ collapsed: false })
    assert.equal(load(storage).loadMenuState().enabled, false)
    api.saveMenuState({ enabled: true, collapsed: false })
    assert.equal(load(storage).loadMenuState().enabled, true)
})
test('unavailable storage leaves controls usable with safe defaults', () => {
    const api = load({ getItem() { throw Error('blocked') }, setItem() { throw Error('blocked') } })
    assert.equal(api.loadMenuState().enabled, true)
    assert.equal(api.loadMenuState().collapsed, false)
    assert.doesNotThrow(() => api.saveMenuState({ enabled: false, collapsed: true }))
})
