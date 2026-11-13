const { test } = require('node:test')
const assert = require('node:assert/strict')
const { parseGenerationSettings, weightedFinish } = require('../dist-ts/generationSettings')

test('generation weights combine foil and latex without losing zero exclusions', () => {
    const settings = parseGenerationSettings({ weights: { latex: 0, foil: 20, bubble: 80, paint: 0, apple: 0, duck: 0, watermelon: 0, 'hot-air': 0 }, showReset: false })
    assert.equal(weightedFinish(['latex', 'bubble', 'apple'], settings, 0), 'latex')
    assert.equal(weightedFinish(['latex', 'bubble', 'apple'], settings, .19), 'latex')
    assert.equal(weightedFinish(['latex', 'bubble', 'apple'], settings, .2), 'bubble')
    assert.equal(weightedFinish(['latex', 'bubble', 'apple'], settings, .999), 'bubble')
    assert.equal(settings.showReset, false)
})
test('invalid settings recover and an empty mix remains usable', () => {
    assert.equal(parseGenerationSettings(null).showReset, true)
    assert.equal(parseGenerationSettings({ weights: { foil: -1 } }).weights.foil, 18)
    const settings = parseGenerationSettings({ weights: Object.fromEntries(['latex', 'foil', 'bubble', 'paint', 'apple', 'duck', 'watermelon', 'hot-air'].map(type => [type, 0])) })
    assert.equal(weightedFinish(['latex', 'bubble'], settings), 'latex')
})
