const { test } = require('node:test')
const assert = require('node:assert/strict')
const { waterSurface, applyWater } = require('../dist-ts/water')
const { sceneGround } = require('../dist-ts/sceneGround')
const { updateBalloonPhysics } = require('../dist-ts/physics')
const { popBalloon, updateBalloon, defaultBalloonConfig: config } = require('../dist-ts/objects/balloon')
const { updateDuck } = require('../dist-ts/objects/duck')
const { getPhysicsOptions } = require('../dist-ts/objects/objectDefinitions')
const { updateHotAirBurner } = require('../dist-ts/objects/hotAirBalloon')
function body(finish, x = 300, y = 100) {
    return { finish, x, y, anchorX: x, anchorY: y, radius: 35,
        vx: 0, vy: 0, angle: 0, angularVelocity: 0, pointerId: null,
        growing: false, popped: false, popTime: 0, color: '#fff' }
}
function simulate(objects, seconds = 10) {
    for (let i = 0; i < seconds * 120; i++) updateBalloonPhysics(objects, 1/120, 1000, 728, config)
}
test('ducks and geese bounce off side walls before takeoff but can fly out afterward', () => {
    for (const duckVariant of ['duck', 'goose']) {
        for (const [x, vx] of [[-100, -800], [1100, 800]]) {
            const duck = body('duck', x, 400)
            duck.duckVariant = duckVariant
            duck.vx = vx
            const physics = getPhysicsOptions(duck)
            updateDuck(duck, 1/60, 1000, 728, physics)
            assert.ok(duck.x >= duck.radius && duck.x <= 1000 - duck.radius)
            assert.equal(duck.apple?.exited ?? false, false)
            assert.equal(Math.sign(duck.vx), -Math.sign(vx))
            duck.duckFlight.flying = true
            duck.x = x
            updateDuck(duck, 1/60, 1000, 728, physics)
            assert.equal(duck.apple.exited, true)
        }
    }
})
test('bird press feedback stays while held and eases away without changing physical size', () => {
    const duck = body('duck')
    duck.duckPress = 1
    duck.pointerId = 1
    const physics = getPhysicsOptions(duck)
    updateDuck(duck, 0.1, 1000, 728, physics)
    assert.equal(duck.duckPress, 1)
    assert.equal(duck.radius, 35)
    duck.pointerId = null
    updateDuck(duck, 0.05, 1000, 728, physics)
    assert.ok(duck.duckPress > 0 && duck.duckPress < 1)
    for (let i = 0; i < 60; i++) updateDuck(duck, 1/60, 1000, 728, physics)
    assert.ok(duck.duckPress < 0.001)
    assert.equal(duck.radius, 35)
})
test('birds choose a 30–90 second stay and then fly up and out, waiting for release', () => {
    const duck = body('duck', 400, 500)
    const physics = getPhysicsOptions(duck)
    updateDuck(duck, 1/60, 1000, 728, physics)
    assert.ok(duck.duckFlight.delay >= 30 && duck.duckFlight.delay <= 90)
    duck.duckFlight.age = duck.duckFlight.delay - 0.1
    duck.pointerId = 1
    updateDuck(duck, 0.2, 1000, 728, physics)
    assert.equal(duck.duckFlight.flying, false)
    duck.pointerId = null
    updateDuck(duck, 1/60, 1000, 728, physics)
    assert.equal(duck.duckFlight.flying, true)
    const startY = duck.y
    for (let i = 0; i < 1200 && !duck.apple?.exited; i++) {
        applyWater(duck, 508, 1/120)
        updateDuck(duck, 1/120, 1000, 728, physics)
    }
    assert.ok(duck.y < startY)
    assert.equal(duck.apple.exited, true)
})
test('a hot-air basket near water triggers sustained escape thrust, even above the usual ignition altitude', () => {
    const hot = body('hot-air', 400, 100)
    hot.suspension = { x: 400, y: 510 }
    applyWater(hot, 508, 1/60)
    assert.equal(hot.waterEscape, true)
    const physics = getPhysicsOptions(hot)
    for (let i = 0; i < 600; i++) updateHotAirBurner(hot, 1/60, physics, 728, () => 0.5)
    assert.equal(hot.burner.active, true)
    assert.equal(hot.burner.intensity, 1)
    const lift = updateHotAirBurner(hot, 1/60, physics, 728)
    assert.ok(lift > physics.burnerLift * 2)
    hot.suspension.y = 450
    applyWater(hot, 508, 1/60)
    assert.equal(hot.waterEscape, false)
})
test('floating birds rock gently as waves pass and held birds stay under pointer control', () => {
    for (const duckVariant of ['duck', 'goose']) {
        const duck = body('duck', 200, 510)
        duck.duckVariant = duckVariant
        let min = Infinity, max = -Infinity
        for (let i = 0; i < 720; i++) {
            updateBalloonPhysics([duck], 1/120, 2000, 728, config)
            min = Math.min(min, duck.angle)
            max = Math.max(max, duck.angle)
        }
        assert.ok(max - min > 0.025)
        assert.ok(Math.max(Math.abs(min), Math.abs(max)) < 0.3)
        duck.pointerId = 1
        const angle = duck.angle
        simulate([duck], 1)
        assert.equal(duck.angle, angle)
    }
})
test('holding new ducks and geese grows them to the size limit; releasing preserves their size', () => {
    for (const duckVariant of ['duck', 'goose']) {
        const duck = body('duck')
        Object.assign(duck, { duckVariant, growing: true, pointerId: 1 })
        const limits = { ...config, maxRadius: 100, maxRadiusScreenRatio: 0.3, maxObjectAreaRatio: 0.12 }
        updateBalloon(duck, 0.5, 1000, 728, limits, [duck])
        assert.equal(duck.radius, 75)
        updateBalloon(duck, 10, 1000, 728, limits, [duck])
        assert.equal(duck.radius, 100)
        assert.equal(duck.popped, false)
        duck.growing = false
        duck.pointerId = null
        updateBalloon(duck, 1, 1000, 728, limits, [duck])
        assert.equal(duck.radius, 100)
    }
})
test('current carries submerged objects rightward, leaves held and dry objects alone, and preserves fast throws', () => {
    const duck = body('duck', 300, 520)
    applyWater(duck, 508, 1)
    assert.ok(duck.vx > 0 && duck.vx < 28)
    const melon = body('watermelon', 300, 650)
    applyWater(melon, 508, 1)
    assert.ok(melon.vx > duck.vx)
    const held = body('duck', 300, 520)
    held.pointerId = 1
    applyWater(held, 508, 1)
    assert.equal(held.vx, 0)
    const dry = body('apple')
    applyWater(dry, 508, 1)
    assert.equal(dry.vx, 0)
    const thrown = body('apple', 300, 520)
    thrown.vx = -1000
    applyWater(thrown, 508, 1/60)
    assert.ok(thrown.vx < -900)
})
test('a duck adds water above solid ground and the last duck leaving removes water', () => {
    const duck = body('duck')
    assert.equal(sceneGround(800, [duck]).visible, true)
    assert.equal(sceneGround(800, [duck]).y, 736)
    assert.ok(waterSurface(736, [duck]) < 736)
    duck.apple = { exited: true }
    assert.equal(waterSurface(736, [duck]), null)
    assert.equal(waterSurface(736, [body('watermelon')]), null)
})
test('ducks and apples settle floating upright while watermelons sink intact to the floor', () => {
    const duck = body('duck', 150), apple = body('apple', 450), melon = body('watermelon', 750)
    const objects = [duck, apple, melon]
    simulate(objects)
    const surface = waterSurface(728, objects)
    for (const floating of [duck, apple]) {
        assert.ok(Math.abs(floating.y - surface) < 12, `${floating.finish}: ${floating.y}`)
        assert.ok(Math.abs(floating.vy) < 5)
    }
    assert.ok(melon.y > surface + melon.radius)
    assert.equal(melon.watermelon.grounded, true)
    assert.equal(melon.popped, false)
    assert.ok(Math.abs(duck.angle) < 0.1)
})
test('ducks can be dragged underwater and float back up after release without popping', () => {
    const duck = body('duck')
    duck.pointerId = 1
    duck.anchorY = 650
    simulate([duck], 1)
    assert.ok(duck.y > 640)
    duck.pointerId = null
    popBalloon(duck)
    assert.equal(duck.popped, false)
    simulate([duck])
    assert.ok(Math.abs(duck.y - waterSurface(728, [duck])) < 12)
})
