const { test } = require('node:test')
const assert = require('node:assert/strict')
const { maximumRadius, availableRadius, enforceSizeLimits, objectArea } = require('../dist-ts/objects/sizeLimits')
const { updateBalloon, defaultBalloonConfig } = require('../dist-ts/objects/balloon')
const config = { ...defaultBalloonConfig, minRadius: 18, maxRadius: 64,
    maxRadiusScreenRatio: .16, maxObjectAreaRatio: .05, maxSceneAreaRatio: .65 }
const object = overrides => ({ finish: 'latex', radius: 40, growing: true, popped: false, ...overrides })

test('mobile maximum fits both the short screen dimension and object area cap', () => {
    for (const [width, height] of [[390, 844], [844, 390], [180, 300]]) {
        const max = maximumRadius(width, height, config)
        assert.ok(max <= 64 && max <= Math.min(width, height) * .16)
        assert.ok(objectArea(object({ finish: 'hot-air', radius: max })) <= width * height * .05 + 1e-8)
    }
})

test('scene budget bounds existing objects after resize and ignores popped debris', () => {
    const objects = Array.from({ length: 80 }, () => object({ finish: 'hot-air', radius: 100 }))
    const debris = object({ popped: true, radius: 200 })
    enforceSizeLimits([...objects, debris], 320, 500, config)
    assert.ok(objects.reduce((sum, item) => sum + objectArea(item), 0) <= 320 * 500 * .65 + 1e-6)
    assert.equal(debris.radius, 200)
    assert.ok(availableRadius(object({}), objects, 320, 500, config) < config.minRadius)
})

test('simultaneous inflation shares the remaining area and resumes when space is freed', () => {
    const limited = { ...config, maxSceneAreaRatio: .02 }
    const objects = [object({ radius: 10 }), object({ radius: 10 })]
    for (const item of objects) updateBalloon(item, 1, 390, 844, limited, objects)
    assert.ok(objects.reduce((sum, item) => sum + objectArea(item), 0) <= 390 * 844 * .02 + 1e-6)
    const previous = objects[1].radius
    objects[0].popped = true
    updateBalloon(objects[1], 1, 390, 844, limited, objects)
    assert.ok(objects[1].radius > previous)
})
