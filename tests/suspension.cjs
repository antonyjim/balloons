const { test } = require('node:test')
const assert = require('node:assert/strict')
const { updateBalloonPhysics } = require('../dist-ts/physics')
const { defaultBalloonConfig, containsPoint } = require('../dist-ts/objects/balloon')
const { ensureSuspendedBasket, updateHotAirSuspension } = require('../dist-ts/objects/hotAirBalloon')
const { getPhysicsOptions } = require('../dist-ts/objects/objectDefinitions')
const { resolveBalloonCollisions } = require('../dist-ts/physics')
const { shouldIgniteHotAir } = require('../dist-ts/objects/hotAirFire')
const { moveHotAirAssembly } = require('../dist-ts/objects/hotAirBalloon')

test('basket dragging translates the envelope and basket together without changing their pose', () => {
    const balloon = hot({ vx: 80, vy: -40 })
    const basket = ensureSuspendedBasket(balloon, getPhysicsOptions(balloon))
    const offset = { x: basket.x - balloon.x, y: basket.y - balloon.y }
    basket.angle = 0.2
    moveHotAirAssembly(balloon, 70, -90)
    assert.equal(balloon.x, 570)
    assert.equal(balloon.y, 210)
    assert.equal(basket.x - balloon.x, offset.x)
    assert.equal(basket.y - balloon.y, offset.y)
    assert.equal(basket.angle, 0.2)
    assert.equal(balloon.anchorX, balloon.x)
    assert.equal(balloon.anchorY, balloon.y)
    assert.equal(balloon.vx, 0)
    assert.equal(basket.vy, 0)
})

test('an object below an offset basket pushes it upward and can tip a lit burner into ignition', () => {
    const balloon = hot({ burner: { active: true, intensity: 1 } })
    const physics = getPhysicsOptions(balloon)
    const basket = ensureSuspendedBasket(balloon, physics)
    const before = basket.y
    const other = hot({ finish: 'latex', radius: 24, x: basket.x + 10,
        y: basket.y + 20, vy: -250, pointerId: 2 })
    resolveBalloonCollisions([balloon, other], defaultBalloonConfig)
    assert.ok(basket.y < before)
    assert.ok(basket.vy < 0)
    assert.ok(Math.abs(basket.angularVelocity) > 0)
    for (let i = 0; i < 180 && !shouldIgniteHotAir(balloon, physics); i++) {
        updateHotAirSuspension(balloon, 1/60, 2000, 2000, physics)
        other.x = basket.x + 10 * Math.cos(basket.angle) - 20 * Math.sin(basket.angle)
        other.y = basket.y + 10 * Math.sin(basket.angle) + 20 * Math.cos(basket.angle)
        resolveBalloonCollisions([balloon, other], defaultBalloonConfig)
    }
    assert.ok(shouldIgniteHotAir(balloon, physics))
})

test('suspension permits slack when a basket is lifted toward its envelope', () => {
    const balloon = hot()
    const physics = getPhysicsOptions(balloon)
    const basket = ensureSuspendedBasket(balloon, physics)
    basket.y -= 12
    const before = basket.y
    updateHotAirSuspension(balloon, 1/120, 2000, 2000, physics)
    assert.ok(basket.y - before < 1)
})
function hot(overrides = {}) {
    return { x: 500, y: 300, vx: 0, vy: 0, angle: 0, angularVelocity: 0,
        anchorX: 500, anchorY: 300, pointerId: 1, radius: 60,
        color: '#ffffff', finish: 'hot-air', popped: false, growing: false, popTime: 0, ...overrides }
}
function ropeErrors(balloon) {
    const b = balloon.suspension, r = balloon.radius
    return [-1, 1].map(side => {
        const ex = balloon.x + side * r * 0.22 * Math.cos(balloon.angle) - r * 1.18 * Math.sin(balloon.angle)
        const ey = balloon.y + side * r * 0.22 * Math.sin(balloon.angle) + r * 1.18 * Math.cos(balloon.angle)
        const bx = b.x + side * r * 0.16 * Math.cos(b.angle) + r * 0.095 * Math.sin(b.angle)
        const by = b.y + side * r * 0.16 * Math.sin(b.angle) - r * 0.095 * Math.cos(b.angle)
        return Math.abs(Math.hypot(bx - ex, by - ey) - Math.hypot(r * 0.06, r * 0.34))
    })
}
test('basket settles below a held envelope with both suspension lengths preserved', () => {
    const balloon = hot()
    for (let i = 0; i < 300; i++) updateBalloonPhysics([balloon], 1/60, 2000, 2000, defaultBalloonConfig)
    assert.equal(balloon.x, 500)
    assert.equal(balloon.y, 300)
    assert.ok(Math.abs(balloon.suspension.y - balloon.y - 96.9) < 0.1)
    assert.ok(ropeErrors(balloon).every(error => error < 0.1))
    assert.ok(containsPoint(balloon, balloon.suspension.x, balloon.suspension.y))
})
test('a moving envelope produces independent basket lag and rotation', () => {
    const balloon = hot()
    updateBalloonPhysics([balloon], 1/60, 2000, 2000, defaultBalloonConfig)
    balloon.pointerId = null
    balloon.vx = 300
    updateBalloonPhysics([balloon], 1/60, 2000, 2000, defaultBalloonConfig)
    assert.ok(Math.abs(balloon.suspension.vx - balloon.vx) > 1)
    assert.ok(Math.abs(balloon.suspension.angle - balloon.angle) > 0.001)
    assert.ok(ropeErrors(balloon).every(error => error < 1))
})
test('basket tension transfers motion back into a free envelope', () => {
    const balloon = hot({ pointerId: null })
    const physics = getPhysicsOptions(balloon)
    const basket = ensureSuspendedBasket(balloon, physics)
    basket.vx = 250
    updateHotAirSuspension(balloon, 1/60, 2000, 2000, physics)
    assert.ok(Math.abs(balloon.vx) > 0.01)
})
test('growth, dragging, variable frame times, and walls remain finite and bounded', () => {
    const balloon = hot({ physics: { ignitionAngle: Math.PI + 1 } })
    for (let i = 0; i < 500; i++) {
        balloon.radius = Math.min(100, 35 + i * 0.5)
        balloon.anchorX = 500 + Math.sin(i * 0.08) * 450
        balloon.anchorY = 400 + Math.cos(i * 0.06) * 380
        if (i === 250) { balloon.pointerId = null; balloon.vx = 600; balloon.vy = 600 }
        updateBalloonPhysics([balloon], i % 3 === 0 ? 1/30 : 1/120, 1000, 800, defaultBalloonConfig)
        for (const body of [balloon, balloon.suspension]) {
            for (const key of ['x', 'y', 'vx', 'vy', 'angle', 'angularVelocity']) assert.ok(Number.isFinite(body[key]))
            assert.ok(body.x >= 0 && body.x <= 1000)
            assert.ok(body.y >= 0 && body.y <= 800)
        }
    }
})
