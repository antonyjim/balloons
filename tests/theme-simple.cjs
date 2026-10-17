const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const { createRequire } = require('node:module')
const path = require('node:path')

test('simple mode defaults to random per pointer and preserves every saved object mode, including auto', () => {
    const filename = path.resolve('dist-ts/theme/ThemeManager.js')
    for (const saved of [null, 'auto', 'random', 'latex', 'hot-air', 'bubble', 'paint', 'watermelon', 'apple', 'duck']) {
        const module = { exports: {} }, writes = []
        const context = {
            module, exports: module.exports, require: createRequire(filename),
            localStorage: { getItem: key => key === 'balloons.theme.finish' ? saved : null, setItem: (...args) => writes.push(args) },
            setInterval() {}, clearInterval() {},
            document: { addEventListener() {}, removeEventListener() {} },
            window: { addEventListener() {}, removeEventListener() {} }
        }
        vm.runInNewContext(fs.readFileSync(filename, 'utf8'), context)
        const manager = new module.exports.ThemeManager()
        manager.setSimpleMode(true)
        assert.equal(manager.current.finishMode, saved ?? 'random')
        manager.setSimpleMode(false)
        manager.setSimpleMode(true)
        assert.equal(manager.current.finishMode, saved ?? 'random')
        assert.equal(writes.length, 0, 'opening or toggling simple mode must not overwrite preferences')
    }
})

test('simple mode excludes watermelon immediately and throughout automatic rotation', () => {
    const filename = path.resolve('dist-ts/theme/ThemeManager.js')
    let now = Date.now()
    const clock = class extends Date { static now() { return now } }
    const module = { exports: {} }
    const context = {
        module, exports: module.exports, require: createRequire(filename), Date: clock,
        Math: Object.assign(Object.create(Math), { random: () => 0.999 }),
        setInterval() {}, clearInterval() {},
        document: { addEventListener() {}, removeEventListener() {} },
        window: { addEventListener() {}, removeEventListener() {} }
    }
    vm.runInNewContext(fs.readFileSync(filename, 'utf8'), context)
    const manager = new module.exports.ThemeManager()
    assert.equal(manager.current.finishMode, 'random')
    manager.setFinish('auto')
    assert.equal(manager.current.finish, 'watermelon')
    manager.setSimpleMode(true)
    assert.notEqual(manager.current.finish, 'watermelon')
    for (let i = 0; i < 20; i++) {
        now += 61_000
        manager.refresh()
        assert.notEqual(manager.current.finish, 'watermelon')
    }
    manager.setSimpleMode(false)
    now += 61_000
    manager.refresh()
    assert.equal(manager.current.finish, 'watermelon')
    manager.setFinish('watermelon')
    assert.equal(manager.current.finish, 'watermelon')
    assert.equal(manager.finishForPointer(), 'watermelon')
    manager.setFinish('random')
    context.Math.random = () => 0
    assert.equal(manager.finishForPointer(), 'latex')
    context.Math.random = () => 0.999
    assert.equal(manager.finishForPointer(), 'watermelon')
    assert.equal(manager.current.finishMode, 'random')
    manager.setSimpleMode(true)
    assert.notEqual(manager.finishForPointer(), 'watermelon')
})
