const { test } = require('node:test')
const assert = require('node:assert/strict')
const { profileSettings, generationProfiles } = require('../dist-ts/generationProfiles')
const { parseGenerationSettings, generationConfig } = require('../dist-ts/generationSettings')
const { getPhysicsOptions } = require('../dist-ts/objects/objectDefinitions')
const active = settings => Object.keys(settings.weights).filter(type => settings.weights[type] > 0)
test('balloons profile provides the requested mix, size, speed, hold and medium impulses', () => {
    const settings = profileSettings('balloons')
    assert.deepEqual(active(settings), ['latex', 'foil'])
    assert.equal(settings.weights.foil / (settings.weights.foil + settings.weights.latex), 1 / 20)
    assert.equal(settings.inflationSpeed, 1.4)
    assert.equal(settings.releaseOnFull, true)
    assert.equal(settings.releaseImpulse, .6)
    assert.equal(settings.popImpulse, .6)
    assert.equal(settings.pushImpulse, .6)
    assert.equal(settings.minSize, 120); assert.equal(settings.maxSize, 440)
    assert.equal(generationProfiles.balloons.hideMenu, true)
})
test('Floaties and Landies contain their groups; Random reduces apple frequency', () => {
    assert.deepEqual(active(profileSettings('floaties')), ['latex', 'foil', 'hot-air', 'bubble'])
    assert.equal(profileSettings('floaties').releaseOnFull, true)
    assert.equal(generationProfiles.floaties.hideMenu, true)
    assert.deepEqual(active(profileSettings('landies')), ['paint', 'apple', 'duck', 'watermelon'])
    const random = profileSettings('random')
    assert.equal(random.weights.apple / random.weights.bubble, .2)
    for (const id of Object.keys(generationProfiles)) assert.equal(parseGenerationSettings(JSON.parse(JSON.stringify(profileSettings(id)))).profile, id)
})
test('impulse sliders affect resolved forces while preserving type-specific zeroes', () => {
    const base = { initialRadius: 30, growthRate: 80, maxScreenRatio: .3 }
    const config = generationConfig(base, parseGenerationSettings({ releaseImpulse: .6, popImpulse: 0, pushImpulse: .3 }))
    const object = { finish: 'latex' }
    const original = getPhysicsOptions(object), scaled = getPhysicsOptions(object, config)
    assert.equal(scaled.releaseImpulse, original.releaseImpulse * .6)
    assert.equal(scaled.popImpulse, 0)
    assert.equal(scaled.maxPushImpulse, original.maxPushImpulse * .3)
    assert.equal(getPhysicsOptions({ finish: 'apple' }, config).releaseImpulse, 0)
    const corrupt = parseGenerationSettings({ releaseImpulse: -1, popImpulse: Infinity, pushImpulse: '3' })
    assert.equal(corrupt.releaseImpulse, 1); assert.equal(corrupt.popImpulse, 1); assert.equal(corrupt.pushImpulse, 1)
})

test('pop impulse settings reach the live pop force calculation', () => {
    const audio = require('../dist-ts/audio'), { popWithForce } = require('../dist-ts/physics')
    const original = audio.playPopSound
    audio.playPopSound = () => {}
    const body = x => ({ x, y: 100, vx: 0, vy: 0, angularVelocity: 0, angle: 0, radius: 40, finish: 'latex', pointerId: null, popped: false, growing: false })
    try {
        for (const multiplier of [0, .6, 1]) {
            const popped = body(100), nearby = body(180)
            popWithForce([popped, nearby], popped, { popImpulseMultiplier: multiplier })
            assert.equal(popped.popped, true)
            assert.equal(Math.hypot(nearby.vx, nearby.vy) > 0, multiplier > 0)
        }
    } finally { audio.playPopSound = original }
})
