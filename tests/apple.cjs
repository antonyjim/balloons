const { test } = require('node:test')
const assert = require('node:assert/strict')
const { updateBalloonPhysics, popWithForce } = require('../dist-ts/physics')
const { sampleAppleDrag, releaseAppleThrow } = require('../dist-ts/objects/apple')
test('a tiny final pointer movement does not cancel a fast apple throw', () => {
    const fruit = apple()
    sampleAppleDrag(fruit, 100, 200, 1000)
    sampleAppleDrag(fruit, 180, 200, 1040)
    sampleAppleDrag(fruit, 181, 200, 1050)
    releaseAppleThrow(fruit, 1050)
    assert.equal(fruit.vx, 1620)
    updateBalloonPhysics([fruit], 1/60, 2000, 1000, config)
    assert.equal(fruit.vx, 1620)
    assert.ok(fruit.x > 200)
})
test('a thrown apple breaks a melon on a hard hit and survives, in either pair order', () => {
    const audio = require('../dist-ts/audio')
    const previous = audio.playPopSound
    audio.playPopSound = () => {}
    try {
        for (const reverse of [false, true]) {
            for (const speed of [100, 1800]) {
                const fruit = apple()
                const melon = apple({ finish: 'watermelon', x: 280, radius: 65 })
                sampleAppleDrag(fruit, 0, 100, 1000)
                sampleAppleDrag(fruit, speed / 20, 100, 1050)
                releaseAppleThrow(fruit, 1050)
                const bodies = reverse ? [melon, fruit] : [fruit, melon]
                for (let i = 0; i < 8; i++) updateBalloonPhysics(bodies, 1/120, 2000, 1000, config)
                assert.equal(melon.popped, speed === 1800)
                assert.equal(fruit.popped, false)
            }
        }
    } finally { audio.playPopSound = previous }
})
test('apple throws retain pointer velocity and a pause releases without a throw', () => {
    const fruit = apple()
    sampleAppleDrag(fruit, 100, 200, 1000)
    sampleAppleDrag(fruit, 140, 180, 1050)
    releaseAppleThrow(fruit, 1060)
    assert.equal(fruit.vx, 800)
    assert.equal(fruit.vy, -400)
    const paused = apple()
    sampleAppleDrag(paused, 100, 200, 1000)
    sampleAppleDrag(paused, 140, 180, 1050)
    releaseAppleThrow(paused, 1400)
    assert.equal(paused.vx, 0)
    assert.equal(paused.vy, 0)
})
const { popBalloon, updateBalloon, isBalloonFinished, defaultBalloonConfig: config } = require('../dist-ts/objects/balloon')
function apple(overrides = {}) {
    return { x: 200, y: 100, vx: 0, vy: 0, radius: 30, angle: 0, angularVelocity: 0,
        anchorX: 200, anchorY: 100, pointerId: null, finish: 'apple', color: '#fff',
        popped: false, growing: false, popTime: 0, ...overrides }
}
test('apples survive popping and high falls without emitting an explosion', () => {
    const fruit = apple()
    const neighbor = apple({ x: 270 })
    popBalloon(fruit)
    popWithForce([fruit, neighbor], fruit)
    assert.equal(fruit.popped, false)
    assert.equal(neighbor.vx, 0)
    for (let i = 0; i < 300; i++) updateBalloonPhysics([fruit], 1/60, 800, 600, config)
    assert.equal(fruit.popped, false)
    assert.ok(Math.abs(fruit.y - 570) < 1)
})
test('held apples follow their anchor without inflating', () => {
    const fruit = apple({ pointerId: 1, anchorX: 400, anchorY: 200, growing: true })
    for (let i = 0; i < 60; i++) {
        updateBalloon(fruit, 1/60, 800, 600, config, [fruit])
        updateBalloonPhysics([fruit], 1/60, 800, 600, config)
    }
    assert.ok(Math.abs(fruit.x - 400) < 0.01)
    assert.ok(Math.abs(fruit.y - 200) < 0.01)
    assert.equal(fruit.radius, 30)
})
test('apples pass through both side walls and finish only after fully leaving', () => {
    for (const [x, vx] of [[5, -200], [795, 200]]) {
        const fruit = apple({ x, vx })
        updateBalloonPhysics([fruit], 1/60, 800, 600, config)
        assert.equal(fruit.vx, vx)
        assert.equal(isBalloonFinished(fruit, config), false)
        for (let i = 0; i < 30; i++) updateBalloonPhysics([fruit], 1/60, 800, 600, config)
        assert.equal(isBalloonFinished(fruit, config), true)
        assert.equal(fruit.popped, false)
    }
})
