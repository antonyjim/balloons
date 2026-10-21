const { test } = require('node:test')
const assert = require('node:assert/strict')
const { restorable, PROGRESS_TTL } = require('../dist-ts/puzzle/progress')
const { ActivityLog } = require('../dist-ts/activityLog')

test('unfinished puzzles restore the same order and pieces for one hour; solved/expired states start fresh', () => {
    const progress = { placed: [0, 4], order: [8, 7, 6, 5, 4, 3, 2, 1, 0], savedAt: 1000, solved: false, activityId: 'round-1' }
    assert.equal(restorable(progress, 3, 1000 + PROGRESS_TTL - 1), true)
    assert.equal(restorable(progress, 3, 1000 + PROGRESS_TTL), false)
    assert.equal(restorable({ ...progress, solved: true }, 3, 1001), false)
    assert.equal(restorable(progress, 4, 1001), false)
    assert.equal(restorable({ ...progress, placed: [9] }, 3, 1001), false)
    assert.equal(restorable({ ...progress, order: Array(9).fill(0) }, 3, 1001), false)
})

test('restoring an unfinished round updates the same activity and completion sets solved=true without drop records', () => {
    const log = new ActivityLog()
    log.puzzle('activity', 'Garden (3 x 3)', false, 1000, 'garden-1')
    log.puzzle('activity', 'Beach (4 x 4)', false, 2000, 'beach-1')
    log.puzzle('activity', 'Garden (3 x 3)', false, 3000, 'garden-1')
    assert.equal(log.events.length, 2)
    assert.equal(log.events[0].solved, false)
    log.puzzle('solve', 'Garden (3 x 3)', true, 4000, 'garden-1')
    assert.equal(log.events.length, 2)
    assert.equal(log.events[0].solved, true)
    log.puzzle('activity', 'Garden (3 x 3)', false, 5000, 'garden-2')
    assert.equal(log.events.length, 3)
    assert.equal(log.events[2].solved, false)
})
