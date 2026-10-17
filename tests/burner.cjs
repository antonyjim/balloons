const { test } = require('node:test')
const assert = require('node:assert/strict')
const { updateHotAirBurner, drawHotAirGlow, drawSuspendedBasket } = require('../dist-ts/objects/hotAirBalloon')
const { getPhysicsOptions } = require('../dist-ts/objects/objectDefinitions')
const { updateBalloonPhysics } = require('../dist-ts/physics')
const { defaultBalloonConfig } = require('../dist-ts/objects/balloon')
function hot(overrides = {}) {
    return { x: 500, y: 500, vx: 0, vy: 0, angle: 0, angularVelocity: 0,
        anchorX: 500, anchorY: 500, pointerId: null, radius: 60,
        color: '#ffffff', finish: 'hot-air', popped: false, growing: false, popTime: 0, ...overrides }
}
test('burners alternate random pauses and burns lasting two to five seconds', () => {
    for (const sample of [0, 0.5, 0.999]) {
        const balloon = hot()
        const options = getPhysicsOptions(balloon)
        updateHotAirBurner(balloon, 0.01, options, 0, () => sample)
        assert.equal(balloon.burner.active, false)
        assert.ok(balloon.burner.remaining >= 3.99 && balloon.burner.remaining <= 12)
        balloon.burner.remaining = 0.01
        updateHotAirBurner(balloon, 0.01, options, 0, () => sample)
        assert.equal(balloon.burner.active, true)
        assert.ok(balloon.burner.remaining >= 2 && balloon.burner.remaining <= 5)
        updateHotAirBurner(balloon, 0.25, options, 0, () => sample)
        assert.equal(balloon.burner.intensity, 1)
        balloon.burner.remaining = 0.01
        updateHotAirBurner(balloon, 0.01, options, 0, () => sample)
        assert.equal(balloon.burner.active, false)
        assert.equal(balloon.burner.intensity, 0)
    }
})
test('an active burner lifts the coupled basket and envelope at gravity 1000', () => {
    const balloon = hot({
        physics: { basketGravity: 1000, breezeResponse: 0, verticalBreezeAmplitude: 0 },
        burner: { active: true, remaining: 5, elapsed: 1, intensity: 1, phase: 0 }
    })
    for (let i = 0; i < 120; i++) updateBalloonPhysics([balloon], 1/60, 2000, 2000, defaultBalloonConfig)
    assert.ok(balloon.y < 450)
    assert.ok(balloon.vy < -20)
    assert.ok(balloon.suspension.vy < -20)
})
test('burner lift compensates for larger basket mass and popped balloons stop burning', () => {
    const balloon = hot({ physics: { basketMassRatio: 2, basketGravity: 1000 },
        burner: { active: true, remaining: 4, elapsed: 1, intensity: 1, phase: 0 } })
    const options = getPhysicsOptions(balloon)
    assert.ok(updateHotAirBurner(balloon, 0.01, options) > 2000 - options.buoyancy)
    balloon.popped = true
    assert.equal(updateHotAirBurner(balloon, 0.01, options), 0)
})
test('flames and envelope glow share cached raster artwork across balloons and frames', () => {
    const previous = global.document
    let canvases = 0, gradients = 0, images = 0
    const raster = new Proxy({}, { get: (_, key) => {
        if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => {
            gradients++; return { addColorStop() {} }
        }
        return () => {}
    } })
    global.document = { createElement() { canvases++; return { getContext: () => raster } } }
    const screen = new Proxy({}, { get: (_, key) => () => { if (key === 'drawImage') images++ } })
    try {
        for (let i = 0; i < 100; i++) {
            const balloon = hot({ burner: { active: true, remaining: 3, elapsed: i / 14, intensity: 1, phase: 0 },
                suspension: { x: 500, y: 597, angle: 0 } })
            drawHotAirGlow(screen, balloon)
            drawSuspendedBasket(screen, balloon)
        }
        assert.equal(canvases, 6, 'one glow, four flame frames, one basket')
        assert.equal(gradients, 5)
        assert.equal(images, 300)
    } finally { global.document = previous }
})

test('top-quarter altitude blocks new burns but lets an existing burn finish', () => {
    const balloon = hot({ y: 199, burner: { active: false, remaining: 0.01, elapsed: 0, intensity: 0, phase: 0 } })
    const options = getPhysicsOptions(balloon)
    assert.equal(updateHotAirBurner(balloon, 0.1, options, 800, () => 0.5), 0)
    assert.equal(balloon.burner.active, false)
    balloon.y = 200
    updateHotAirBurner(balloon, 0.1, options, 800, () => 0.5)
    assert.equal(balloon.burner.active, true)
    const remaining = balloon.burner.remaining
    balloon.y = 100
    assert.ok(updateHotAirBurner(balloon, 0.3, options, 800, () => 0.5) > 0)
    assert.ok(Math.abs(balloon.burner.remaining - (remaining - 0.3)) < 1e-8)
    updateHotAirBurner(balloon, balloon.burner.remaining, options, 800, () => 0.5)
    assert.equal(balloon.burner.active, false)
    updateHotAirBurner(balloon, 20, options, 800, () => 0.5)
    assert.equal(balloon.burner.active, false)
})

test('basket floor contact bypasses the pause without extending an active burn', () => {
    const balloon = hot({ y: 690,
        suspension: { x: 500, y: 800 - 60 * 0.23, vx: 0, vy: 0, angle: 0, angularVelocity: 0, radius: 60 },
        burner: { active: false, remaining: 10, elapsed: 0, intensity: 0, phase: 0 } })
    const options = getPhysicsOptions(balloon)
    updateHotAirBurner(balloon, 0.1, options, 800, () => 0.5)
    assert.equal(balloon.burner.active, true)
    assert.ok(balloon.burner.remaining >= 2 && balloon.burner.remaining <= 5)
    const remaining = balloon.burner.remaining
    updateHotAirBurner(balloon, 0.1, options, 800, () => 0.5)
    assert.ok(Math.abs(balloon.burner.remaining - remaining + 0.1) < 1e-8)
    const airborne = hot({ burner: { active: false, remaining: 10, elapsed: 0, intensity: 0, phase: 0 },
        suspension: { ...balloon.suspension, y: 700 } })
    updateHotAirBurner(airborne, 0.1, options, 800, () => 0.5)
    assert.equal(airborne.burner.active, false)
    balloon.popped = true
    balloon.burner.active = false
    assert.equal(updateHotAirBurner(balloon, 0.1, options, 800), 0)
    assert.equal(balloon.burner.active, false)
})
