const { test } = require('node:test')
const assert = require('node:assert/strict')
const audio = require('../dist-ts/audio')
const { updateBalloonPhysics, resolveBalloonCollisions } = require('../dist-ts/physics')
const { updateBalloon, popBalloon, isBalloonFinished, defaultBalloonConfig } = require('../dist-ts/objects/balloon')
function melon(y) {
    return { x: 300, y, vx: 0, vy: 0, angle: 0, angularVelocity: 0,
        anchorX: 300, anchorY: y, pointerId: null, radius: 35,
        color: '#fff', finish: 'watermelon', popped: false, growing: false, popTime: 0 }
}
function withoutSound(run) {
    const previous = audio.playPopSound
    audio.playPopSound = () => {}
    try { run() } finally { audio.playPopSound = previous }
}
test('a low drop settles on the floor and stays intact', () => {
    const fruit = melon(800 - 35 * 0.85 - 60)
    for (let i = 0; i < 180; i++) updateBalloonPhysics([fruit], 1/60, 1000, 800, defaultBalloonConfig)
    assert.equal(fruit.popped, false)
    assert.equal(fruit.watermelon.grounded, true)
    const bottom = fruit.radius * Math.sqrt(0.85 ** 2 * Math.cos(fruit.angle) ** 2 + Math.sin(fruit.angle) ** 2)
    assert.ok(Math.abs(fruit.y + bottom - 800) < 1e-8)
    assert.equal(fruit.vy, 0)
})
test('a high drop bursts on impact and produces watermelon fragments', () => withoutSound(() => {
    const fruit = melon(-200)
    for (let i = 0; i < 180 && !fruit.popped; i++) updateBalloonPhysics([fruit], 1/60, 1000, 800, defaultBalloonConfig)
    assert.equal(fruit.popped, true)
    assert.equal(fruit.watermelon.chunks.length, 9)
    assert.ok(fruit.watermelon.chunks.some(chunk => chunk.vy < 0))
}))
test('a resting melon can be tapped to burst; debris updates and eventually cleans up', () => withoutSound(() => {
    const fruit = melon(770.25)
    updateBalloonPhysics([fruit], 1/60, 1000, 800, defaultBalloonConfig)
    assert.equal(fruit.watermelon.grounded, true)
    popBalloon(fruit)
    const initialY = fruit.watermelon.chunks[0].y
    updateBalloon(fruit, 0.1, 1000, 800, defaultBalloonConfig, [fruit])
    assert.notEqual(fruit.watermelon.chunks[0].y, initialY)
    assert.equal(isBalloonFinished(fruit, defaultBalloonConfig), false)
    for (let i = 0; i < 120; i++) updateBalloon(fruit, 1/60, 1000, 800, defaultBalloonConfig, [fruit])
    assert.equal(isBalloonFinished(fruit, defaultBalloonConfig), true)
}))
test('held melons follow the pointer and measure drop height from the release location', () => withoutSound(() => {
    const fruit = melon(100)
    fruit.pointerId = 1
    fruit.anchorY = 710
    for (let i = 0; i < 60; i++) updateBalloonPhysics([fruit], 1/60, 1000, 800, defaultBalloonConfig)
    assert.equal(fruit.popped, false)
    fruit.pointerId = null
    for (let i = 0; i < 120; i++) updateBalloonPhysics([fruit], 1/60, 1000, 800, defaultBalloonConfig)
    assert.equal(fruit.popped, false)
    assert.equal(fruit.watermelon.grounded, true)
}))
test('the break-height threshold can be tuned per melon', () => withoutSound(() => {
    const fruit = melon(710)
    fruit.physics = { watermelonBurstHeightRatio: 0.02 }
    for (let i = 0; i < 120 && !fruit.popped; i++) updateBalloonPhysics([fruit], 1/60, 1000, 800, defaultBalloonConfig)
    assert.equal(fruit.popped, true)
}))

test('individual toughness is stable and allows the same drop to break only the weaker melon', () => withoutSound(() => {
    const { getPhysicsOptions } = require('../dist-ts/objects/objectDefinitions')
    const options = getPhysicsOptions(melon(0))
    const dropHeight = 800 * options.watermelonBurstHeightRatio
        * (options.watermelonToughnessMin + options.watermelonToughnessMax) / 2
    const weak = melon(800 - 35 * 0.85 - dropHeight)
    const tough = melon(weak.y)
    for (const [fruit, toughness] of [[weak, 0], [tough, 1]]) {
        fruit.watermelon = { toughness, rollBias: 1, impacts: 0, grounded: false,
            highestBottom: fruit.y + 35 * 0.85, chunks: [] }
        for (let i = 0; i < 240 && !fruit.popped; i++) updateBalloonPhysics([fruit], 1/60, 1000, 800, defaultBalloonConfig)
        assert.equal(fruit.watermelon.toughness, toughness)
    }
    assert.equal(weak.popped, true)
    assert.equal(tough.popped, false)
}))
test('surviving ground impacts bounce and impart rolling motion', () => {
    const fruit = melon(800 - 35 * 0.85 - 70)
    for (let i = 0; i < 120 && !fruit.watermelon?.impacts; i++) updateBalloonPhysics([fruit], 1/60, 1000, 800, defaultBalloonConfig)
    assert.ok(fruit.vy < 0)
    assert.ok(Math.abs(fruit.vx) > 1)
    const landedX = fruit.x
    for (let i = 0; i < 180; i++) updateBalloonPhysics([fruit], 1/60, 1000, 800, defaultBalloonConfig)
    assert.ok(Math.abs(fruit.x - landedX) > 5)
    assert.ok(Math.abs(fruit.angle) > 0.1)
    assert.equal(fruit.popped, false)
})

test('hard watermelon contact breaks both fruits, including the stationary target', () => withoutSound(() => {
    const a = melon(300), b = melon(360)
    a.vy = 1800
    resolveBalloonCollisions([a, b], defaultBalloonConfig)
    assert.equal(a.popped, true)
    assert.equal(b.popped, true)
    assert.equal(a.watermelon.chunks.length, 9)
    assert.equal(b.watermelon.chunks.length, 9)
}))
test('gentle, tangential, or separating contact leaves melons intact', () => {
    for (const [vx, vy] of [[0, 50], [1000, 0], [0, -1000]]) {
        const a = melon(300), b = melon(360)
        a.vx = vx; a.vy = vy
        resolveBalloonCollisions([a, b], defaultBalloonConfig)
        assert.equal(a.popped, false)
        assert.equal(b.popped, false)
    }
})
test('all fruits in a simultaneous hard impact break regardless of pair order', () => withoutSound(() => {
    for (const reverse of [false, true]) {
        const falling = melon(245), left = melon(300), right = melon(300)
        left.x = 270; right.x = 330; falling.vy = 1800
        const objects = reverse ? [right, left, falling] : [falling, left, right]
        resolveBalloonCollisions(objects, defaultBalloonConfig)
        assert.ok(objects.every(object => object.popped))
    }
}))
test('watermelon impact speed can be overridden and other object types do not trigger it', () => {
    const a = melon(300), b = melon(360)
    a.vy = 1000
    a.physics = b.physics = { watermelonCollisionBreakSpeed: 5000 }
    resolveBalloonCollisions([a, b], defaultBalloonConfig)
    assert.equal(a.popped, false)
    assert.equal(b.popped, false)
    const c = melon(300), latex = { ...melon(360), finish: 'latex' }
    c.vy = 1000
    resolveBalloonCollisions([c, latex], defaultBalloonConfig)
    assert.equal(c.popped, false)
    assert.equal(latex.popped, false)
})
