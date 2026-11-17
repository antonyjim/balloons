const { test } = require('node:test')
const assert = require('node:assert/strict')
const { CooldownSchedule, parseSchedule } = require('../dist-ts/cooldownSchedule')
const minute = 60000
const settings = { enabled: true, screensaverMinutes: 2, apps: [{ app: 'balloons', minutes: 5 }, { app: 'sketchpad', minutes: 3 }] }
test('timed apps alternate with locked screensaver breaks and repeat without an end', () => {
    const schedule = new CooldownSchedule(settings, 1000)
    const state = minutes => schedule.current(1000 + minutes * minute)
    assert.deepEqual(state(0), { app: 'balloons', screensaver: false, remaining: 5 * minute })
    assert.deepEqual(state(5), { app: 'balloons', screensaver: true, remaining: 2 * minute })
    assert.deepEqual(state(7), { app: 'sketchpad', screensaver: false, remaining: 3 * minute })
    assert.deepEqual(state(10), { app: 'sketchpad', screensaver: true, remaining: 2 * minute })
    assert.deepEqual(state(12), state(0))
    assert.deepEqual(state(1200007), state(7), 'long background gaps catch up without looping over elapsed cycles')
})
test('disabled games are skipped and schedules survive reload without restarting their deadline', () => {
    const schedule = new CooldownSchedule(settings, 1000)
    assert.deepEqual(schedule.current(1000, ['sketchpad']), { app: 'sketchpad', screensaver: false, remaining: 3 * minute })
    assert.equal(schedule.current(1000, []), null)
    const saved = JSON.parse(JSON.stringify({ settings, startedAt: 1000 }))
    const restored = new CooldownSchedule(parseSchedule(saved.settings), saved.startedAt)
    assert.deepEqual(restored.current(1000 + 6 * minute), schedule.current(1000 + 6 * minute))
    restored.settings.enabled = false
    assert.equal(restored.current(1000), null)
})
test('invalid selections and durations recover safely; one app still cycles through its break', () => {
    assert.equal(parseSchedule({ enabled: true, apps: [] }).enabled, false)
    assert.equal(parseSchedule({ enabled: true, apps: [{ app: '__proto__' }] }).enabled, false)
    const parsed = parseSchedule({ enabled: true, screensaverMinutes: -1, apps: [{ app: 'puzzle', minutes: Infinity }, { app: 'puzzle', minutes: 2 }, { app: 'unknown' }] })
    assert.deepEqual(parsed, { enabled: true, screensaverMinutes: 2, apps: [{ app: 'puzzle', minutes: 5 }] })
    const schedule = new CooldownSchedule(parsed)
    assert.equal(schedule.current(5 * minute).screensaver, true)
    assert.equal(schedule.current(7 * minute).screensaver, false)
})

test('disabling screensavers removes their time from the cycle', () => {
    const schedule = new CooldownSchedule(settings, 0)
    assert.deepEqual(schedule.current(5 * minute, undefined, false), { app: 'sketchpad', screensaver: false, remaining: 3 * minute })
    assert.deepEqual(schedule.current(8 * minute, undefined, false), { app: 'balloons', screensaver: false, remaining: 5 * minute })
})
