const { test } = require('node:test')
const assert = require('node:assert/strict')
const { resetPopsDue, RESET_DEADLINE_SECONDS } = require('../dist-ts/resetTiming')

test('reset schedules every pop within six seconds regardless of scene size', () => {
    for (const count of [0, 1, 10, 80, 250, 1000, 10000]) {
        assert.equal(resetPopsDue(count, 0), 0)
        assert.equal(resetPopsDue(count, 6.001), count)
        assert.equal(resetPopsDue(count, 20), count)
        assert.ok(resetPopsDue(count, 2) <= resetPopsDue(count, 3))
    }
    assert.equal(resetPopsDue(10, .075), 1)
    assert.ok(RESET_DEADLINE_SECONDS < 10)
})
