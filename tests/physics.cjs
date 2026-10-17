const { test } = require('node:test')
const assert = require('node:assert/strict')
const { updateBalloonPhysics, resolveBalloonCollisions } = require('../dist-ts/physics')
const { defaultBalloonConfig } = require('../dist-ts/objects/balloon')
const { getPhysicsOptions } = require('../dist-ts/objects/objectDefinitions')

function balloon(overrides = {}) {
    return {
        x: 500, y: 500, vx: 0, vy: 0, angle: 0, angularVelocity: 0,
        anchorX: 500, anchorY: 500, pointerId: null, radius: 20,
        color: '#ffffff', finish: 'latex', growing: false, popped: false,
        popTime: 0, ...overrides
    }
}
const still = {
    buoyancy: 0, breezeResponse: 0, verticalBreezeAmplitude: 0,
    tiltForce: 0, linearDrag: 0, rockStiffness: 0, rockDamping: 0
}

test('type and instance overrides win over scene settings, including zero', () => {
    const hot = balloon({ finish: 'hot-air' })
    assert.equal(getPhysicsOptions(hot, { maxLean: 0.8 }).maxLean, 0.2)
    hot.physics = { maxLean: 0, buoyancy: 0 }
    const options = getPhysicsOptions(hot, { buoyancy: 100 })
    assert.equal(options.maxLean, 0)
    assert.equal(options.buoyancy, 0)
    assert.equal(getPhysicsOptions(balloon()).buoyancy, 60)
})

test('scene speed limit applies, while an instance can disable forces and drag', () => {
    const a = balloon({ vx: 100, physics: still })
    updateBalloonPhysics([a], 0.1, 2000, 2000,
        { ...defaultBalloonConfig, maxSpeed: 10 })
    assert.equal(a.vx, 10)
    assert.equal(a.x, 501)
    assert.equal(a.vy, 0)
    assert.equal(a.y, 500)
})

test('custom wall bounds and retention are used', () => {
    const a = balloon({ x: 10, vx: -100, physics: {
        ...still, screenRadiusRatio: 2, wallRetention: 0.5
    } })
    updateBalloonPhysics([a], 0.1, 2000, 2000, defaultBalloonConfig)
    assert.equal(a.x, 40)
    assert.equal(a.vx, 50)
})

test('broad phase finds collisions with expanded instance bounds', () => {
    const a = balloon({ x: 100, physics: { collisionRadiusRatio: 4 } })
    const b = balloon({ x: 180, physics: { collisionRadiusRatio: 2 } })
    resolveBalloonCollisions([a, b], defaultBalloonConfig)
    assert.ok(Math.abs((b.x - a.x) - 123) < 1e-8)
})
