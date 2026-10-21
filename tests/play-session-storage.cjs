const { test } = require('node:test')
const assert = require('node:assert/strict')
const { PlaySession } = require('../dist-ts/playSession')

test('shared state preserves deadlines, activity rotation and settings across reloads', () => {
    const first = new PlaySession({ enabled: true, timeLimit: .1, cooldown: 1, cooldownApp: 'alternate' }, 0)
    first.objectCreated(1000)
    const second = new PlaySession({ enabled: false, timeLimit: 5, cooldown: 2 }, 3000)
    second.restore(JSON.parse(JSON.stringify(first.snapshot())))
    second.objectCreated(4000)
    assert.equal(second.startedAt, 1000)
    second.tick(7000)
    assert.equal(second.phase, 'cooldown')
    assert.equal(second.cooldownUntil, 67000)
    first.restore(second.snapshot())
    first.tick(67000)
    assert.equal(first.phase, 'ready')
    first.returnToPlay(68000)
    first.objectCreated(68000)
    first.tick(74000)
    assert.equal(first.cooldownActivity, 'matching')
})

test('corrupt shared state leaves the current session intact', () => {
    const session = new PlaySession({ enabled: true, timeLimit: 2, cooldown: 3 }, 1000)
    const before = session.snapshot()
    for (const value of [null, {}, { ...before, startedAt: 'bad' }, { ...before, cooldownUntil: -1 }]) {
        session.restore(value)
        assert.deepEqual(session.snapshot(), before)
    }
})
