const { test } = require('node:test')
const assert = require('node:assert/strict')
const { PlaySession, parsePlaySettings } = require('../dist-ts/playSession')
const settings = { enabled: true, timeLimit: 2, cooldown: 3 }

test('Alternate is saved and switches activities once per cooldown, not on subsequent ticks', () => {
    const selected = parsePlaySettings({ enabled: true, timeLimit: 0.1, cooldown: 1, cooldownApp: 'alternate' })
    assert.equal(selected.cooldownApp, 'alternate')
    const session = new PlaySession(selected, 0)
    for (const [index, expected] of ['sketchpad', 'matching', 'puzzle', 'sketchpad', 'matching', 'puzzle'].entries()) {
        const now = index * 100_000
        session.returnToPlay(now)
        session.objectCreated(now)
        session.tick(now + 6000)
        assert.equal(session.cooldownActivity, expected)
        session.tick(now + 7000)
        assert.equal(session.cooldownActivity, expected)
    }
})

test('screensaver waits for the greater of ten minutes or the time limit, independently of cooldown', () => {
    for (const timeLimit of [2, 10, 15]) {
        const session = new PlaySession({ ...settings, timeLimit, cooldown: 0.1 }, 1000)
        const delay = Math.max(10, timeLimit) * 60_000
        assert.equal(session.screensaverDue(1000 + delay - 1), false)
        assert.equal(session.screensaverDue(1000 + delay), true)
        session.objectCreated(1000 + delay)
        assert.equal(session.screensaverDue(1000 + delay), false)
        assert.equal(session.idleDurationMs, 6000)
    }
})

test('timer waits for the first object, expires once, then offers return only after cooldown', () => {
    const session = new PlaySession(settings, 0)
    session.tick(120_000)
    assert.equal(session.phase, 'play')
    session.objectCreated(120_000)
    session.objectCreated(180_000)
    assert.equal(session.startedAt, 120_000, 'ordinary new objects do not reset the time limit')
    session.tick(239_999)
    assert.equal(session.phase, 'play')
    session.tick(240_000)
    assert.equal(session.phase, 'cooldown')
    session.objectCreated(250_000)
    assert.equal(session.lastObjectAt, 180_000, 'cooldown cannot start another play timer')
    session.tick(419_999)
    assert.equal(session.phase, 'cooldown')
    session.tick(420_000)
    assert.equal(session.phase, 'ready')
    session.returnToPlay(430_000)
    session.tick(900_000)
    assert.equal(session.phase, 'play')
    assert.equal(session.startedAt, null)
    session.objectCreated(900_000)
    assert.equal(session.startedAt, 900_000)
})

test('the cooldown sets the idle delay and the next object starts a fresh timer', () => {
    const session = new PlaySession({ ...settings, timeLimit: 15 }, 0)
    session.objectCreated(1000)
    assert.equal(session.idle(session.idleDurationMs + 999), false)
    assert.equal(session.idle(session.idleDurationMs + 1000), true)
    session.tick(session.idleDurationMs + 1000)
    assert.equal(session.phase, 'play')
    session.objectCreated(session.idleDurationMs + 2000)
    assert.equal(session.startedAt, session.idleDurationMs + 2000)
    assert.equal(session.idle(session.idleDurationMs + 2000), false)
})

test('disabled timer still tracks inactivity, settings are bounded, and disabling clears cooldown', () => {
    assert.deepEqual(parsePlaySettings({ enabled: true, timeLimit: -2, cooldown: Infinity }), { enabled: true, timeLimit: 5, cooldown: 2 })
    assert.equal(parsePlaySettings(null).enabled, false)
    const session = new PlaySession({ ...settings, enabled: false }, 0)
    session.objectCreated(0)
    session.tick(120_000)
    assert.equal(session.phase, 'play')
    assert.equal(session.idle(session.idleDurationMs), true)
    session.configure(settings, 200_000)
    session.objectCreated(200_000)
    session.tick(320_000)
    assert.equal(session.phase, 'cooldown')
    session.configure({ ...settings, enabled: false }, 321_000)
    assert.equal(session.phase, 'play')
    assert.equal(session.startedAt, null)
})

test('cooldown deadlines catch up after a backgrounded tab resumes', () => {
    const session = new PlaySession(settings, 0)
    session.objectCreated(0)
    session.tick(120_000)
    session.tick(600_000)
    assert.equal(session.phase, 'ready')
})


test('puzzles can be selected as a fixed break activity and bubbles stay locked until ready', () => {
    const selected = parsePlaySettings({ enabled: true, timeLimit: 0.1, cooldown: 1, cooldownApp: 'puzzle' })
    assert.equal(selected.cooldownApp, 'puzzle')
    const session = new PlaySession(selected, 0)
    session.objectCreated(0)
    session.tick(6000)
    assert.equal(session.cooldownActivity, 'puzzle')
    assert.equal(session.phase, 'cooldown')
    session.tick(65999)
    assert.equal(session.phase, 'cooldown')
    session.tick(66000)
    assert.equal(session.phase, 'ready')
})
