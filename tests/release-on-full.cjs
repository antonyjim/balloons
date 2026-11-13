const { test } = require('node:test')
const assert = require('node:assert/strict')
const { releaseRadius } = require('../dist-ts/releaseOnFull')
const { parseGenerationSettings } = require('../dist-ts/generationSettings')

test('release sizes vary, favor large balloons and stay below the pop limit', () => {
    const samples = Array.from({ length: 1000 }, (_, i) => releaseRadius(10, 100, 1000, i / 1000))
    assert.ok(Math.max(...samples) < 100)
    assert.ok(Math.min(...samples) > 10)
    assert.ok(samples.reduce((sum, n) => sum + n, 0) / samples.length > 75)
    assert.ok(releaseRadius(10, 100, 40, 1) <= 40)
    assert.equal(releaseRadius(10, 100, 5, 1), 10)
})
test('release on full defaults off and saves only an explicit enabled value', () => {
    assert.equal(parseGenerationSettings(null).releaseOnFull, false)
    assert.equal(parseGenerationSettings({ releaseOnFull: true }).releaseOnFull, true)
    assert.equal(parseGenerationSettings({ releaseOnFull: 'true' }).releaseOnFull, false)
})
