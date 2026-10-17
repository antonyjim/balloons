const { test } = require('node:test')
const assert = require('node:assert/strict')
const audio = require('../dist-ts/audio')
const { popBalloon, updateBalloon, isBalloonFinished, defaultBalloonConfig } = require('../dist-ts/objects/balloon')
const { shouldIgniteHotAir, drawBurningEnvelope } = require('../dist-ts/objects/hotAirFire')
const { getPhysicsOptions } = require('../dist-ts/objects/objectDefinitions')
function hot() {
    return { x: 500, y: 200, vx: 0, vy: -50, angle: 0, angularVelocity: 0,
        anchorX: 500, anchorY: 200, pointerId: null, radius: 60,
        color: '#ffffff', finish: 'hot-air', popped: false, growing: false, popTime: 0,
        physics: { basketDetachDelay: 0.45 },
        burner: { active: true, intensity: 1, remaining: 4, elapsed: 1, phase: 0 },
        suspension: { x: 500, y: 297, vx: 0, vy: 0, angle: 0, angularVelocity: 0, radius: 60 } }
}
function popWithoutAudio(balloon) {
    const previous = audio.playPopSound
    audio.playPopSound = () => {}
    try { popBalloon(balloon) } finally { audio.playPopSound = previous }
}
test('only a lit, sufficiently tilted basket ignites; angle wrapping is respected', () => {
    const balloon = hot()
    const options = getPhysicsOptions(balloon)
    assert.equal(shouldIgniteHotAir(balloon, options), false)
    balloon.suspension.angle = 1.2
    assert.equal(shouldIgniteHotAir(balloon, options), true)
    balloon.burner.active = false
    assert.equal(shouldIgniteHotAir(balloon, options), false)
    balloon.burner.active = true
    balloon.suspension.angle = Math.PI * 2 + 0.1
    assert.equal(shouldIgniteHotAir(balloon, options), false)
    balloon.suspension.angle = -1.2
    assert.equal(shouldIgniteHotAir(balloon, options), true)
})
test('popping ignites once, releases the pointer, and disables lift', () => {
    const balloon = hot()
    balloon.pointerId = 7
    popWithoutAudio(balloon)
    const fire = balloon.fire
    assert.ok(fire)
    assert.equal(balloon.pointerId, null)
    assert.equal(balloon.burner.active, false)
    assert.equal(balloon.burner.intensity, 0)
    assert.ok(balloon.vy > 0)
    popWithoutAudio(balloon)
    assert.equal(balloon.fire, fire)
})
test('burning survives the usual pop timeout; basket detaches and falls faster', () => {
    const balloon = hot()
    popWithoutAudio(balloon)
    balloon.fire.phase = 1
    for (let i = 0; i < 60; i++) updateBalloon(balloon, 1/60, 1000, 800, defaultBalloonConfig, [balloon])
    assert.equal(balloon.fire.detached, true)
    assert.equal(isBalloonFinished(balloon, defaultBalloonConfig), false)
    assert.ok(balloon.y > 200)
    assert.ok(balloon.suspension.vy > balloon.vy)
    assert.ok(balloon.suspension.y > balloon.y + 97)
    assert.notEqual(balloon.x, 500)
    for (let i = 0; i < 900 && !balloon.fire.removed; i++) {
        updateBalloon(balloon, 1/60, 1000, 800, defaultBalloonConfig, [balloon])
    }
    assert.equal(isBalloonFinished(balloon, defaultBalloonConfig), true)
})
test('timeout removes stalled debris and ordinary pop timing is unchanged', () => {
    const balloon = hot()
    popWithoutAudio(balloon)
    const config = { ...defaultBalloonConfig, fireMaxDuration: 1, fireGravity: 0, basketGravity: 0 }
    for (let i = 0; i < 70; i++) updateBalloon(balloon, 1/60, 1000, 10000, config, [balloon])
    assert.equal(isBalloonFinished(balloon, config), true)
    const latex = { ...hot(), finish: 'latex' }
    popWithoutAudio(latex)
    updateBalloon(latex, 0.6, 1000, 800, config, [latex])
    assert.equal(latex.fire, undefined)
    assert.equal(isBalloonFinished(latex, config), true)
})
test('rippling reuses the envelope raster and shared fire sprites', () => {
    const previous = global.document
    let created = 0
    const draws = []
    const transforms = []
    const raster = new Proxy({}, { get: (_, key) => {
        if (key === 'createLinearGradient') return () => ({ addColorStop() {} })
        return (...args) => { if (key === 'drawImage') draws.push(args); if (key === 'transform') transforms.push(args) }
    } })
    global.document = { createElement() { created++; return { getContext: () => raster } } }
    const screenDraws = []
    const screen = new Proxy({}, { get: (_, key) => (...args) => { if (key === 'drawImage') screenDraws.push(args) } })
    try {
        const balloon = hot()
        balloon.fire = { elapsed: 1, phase: 0, detached: true, removed: false }
        const sprite = { canvas: {}, sourceX: 0, sourceY: 0, sourceWidth: 222, sourceHeight: 231,
            radius: 64, left: -73.6, top: -73.6, width: 147.2, height: 153.6 }
        drawBurningEnvelope(screen, balloon, sprite)
        const initialCanvases = created
        drawBurningEnvelope(screen, balloon, sprite)
        assert.equal(created, initialCanvases, 'repeated frames reuse raster flames')
        assert.ok(created >= 3 && created <= 6, "one shared ripple buffer and varied cached flames")
        assert.equal(screenDraws.filter(args => args.length === 9).length, 0, 'individual strips never reach the screen')
        assert.equal(screenDraws.length, 12, 'one assembled envelope and five flames per frame')
        assert.equal(draws.filter(args => args.length === 9).length, 48)
        const slices = draws.filter(args => args.length === 9).slice(0, 24)
        const mappings = transforms.slice(0, 24)
        assert.ok(mappings.some(mapping => Math.abs(mapping[2]) > 0.001))
        for (let i = 0; i < 23; i++) {
            assert.ok(slices[i][6] + slices[i][8] > slices[i + 1][6], 'strips overlap in buffer pixels')
            const edgeY = slices[i + 1][6]
            const end = mappings[i][2] * edgeY + mappings[i][4]
            const next = mappings[i + 1][2] * edgeY + mappings[i + 1][4]
            assert.ok(Math.abs(end - next) < 1e-8, 'neighboring strips must meet without an edge jump')
        }
    } finally { global.document = previous }
})

test('ignition follows the configured angle threshold', () => {
    const balloon = hot()
    const options = getPhysicsOptions(balloon)
    balloon.suspension.angle = options.ignitionAngle - Math.PI / 180
    assert.equal(shouldIgniteHotAir(balloon, options), false)
    balloon.suspension.angle = options.ignitionAngle + Math.PI / 180
    assert.equal(shouldIgniteHotAir(balloon, options), true)
})

test('burning envelope drops noticeably within one second while the basket stays faster', () => {
    const balloon = hot()
    popWithoutAudio(balloon)
    for (let i = 0; i < 60; i++) updateBalloon(balloon, 1/60, 1000, 2000, defaultBalloonConfig, [balloon])
    assert.ok(balloon.y - 200 > 200)
    assert.ok(balloon.vy > 350)
    assert.ok(balloon.suspension.vy > balloon.vy)
})
