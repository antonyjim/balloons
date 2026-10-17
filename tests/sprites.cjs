const { test } = require('node:test')
const assert = require('node:assert/strict')
const { drawBalloon } = require('../dist-ts/objects/balloon')

test('inflating reuses a sprite, while appearance changes invalidate it', () => {
    const previous = global.document
    let created = 0
    let vectorCalls = 0
    const context = new Proxy({}, { get: (target, key) => {
        if (key === 'createRadialGradient' || key === 'createLinearGradient') return () => ({ addColorStop() {} })
        return () => { if (key === 'fill' || key === 'stroke') vectorCalls++ }
    } })
    global.document = { createElement() {
        created++
        return { width: 0, height: 0, getContext: () => context }
    } }
    try {
        const balloon = { finish: 'hot-air', radius: 35, x: 0, y: 0, angle: 0,
            color: '#ff8800', panelColors: ['#ff8800', '#00aaff'], popped: false }
        for (let radius = 35; radius < 120; radius++) {
            balloon.radius = radius
            drawBalloon(context, balloon)
        }
        assert.equal(created, 1)
        const beforeChange = vectorCalls
        balloon.panelColors[0] = '#ffaa00'
        drawBalloon(context, balloon)
        assert.equal(created, 1, "changed artwork should fit on the same atlas page")
        assert.ok(vectorCalls > beforeChange)
    } finally { global.document = previous }
})

test('250 baskets share one raster sprite and rigging stays grouped per balloon', () => {
    const { drawSuspendedBasket, drawHotAirRigging } = require('../dist-ts/objects/hotAirBalloon')
    const previous = global.document
    let created = 0, vectorFills = 0, strokes = 0, ropeSegments = 0, images = 0
    const rasterContext = new Proxy({}, { get: (_, key) => () => { if (key === 'fill') vectorFills++ } })
    global.document = { createElement() {
        created++
        return { width: 0, height: 0, getContext: () => rasterContext }
    } }
    const screen = {
        save() {}, restore() {}, translate() {}, rotate() {}, beginPath() {}, moveTo() {},
        lineTo() { ropeSegments++ }, stroke() { strokes++ }, drawImage() { images++ }
    }
    try {
        const balloons = Array.from({ length: 250 }, (_, i) => ({
            finish: 'hot-air', popped: false, x: i * 2, y: 100, radius: 60, angle: 0.1,
            suspension: { x: i * 2 - 5, y: 197, angle: -0.1 }
        }))
        balloons.forEach(balloon => drawHotAirRigging(screen, balloon))
        for (const balloon of balloons) drawSuspendedBasket(screen, balloon)
        assert.equal(created, 1)
        assert.equal(vectorFills, 1)
        assert.equal(strokes, 250)
        assert.equal(ropeSegments, 1000)
        assert.equal(images, 250)
        for (const balloon of balloons) drawSuspendedBasket(screen, balloon)
        assert.equal(vectorFills, 1, 'later frames should only draw raster images')
        balloons.forEach(balloon => { balloon.popped = true })
        balloons.forEach(balloon => drawHotAirRigging(screen, balloon))
        assert.equal(strokes, 250, 'popped objects must not leave rigging behind')
    } finally { global.document = previous }
})

test('sprite atlas packs regions without overlap and preserves older pages', () => {
    const { SpriteAtlas } = require('../dist-ts/objects/spriteAtlas')
    const previous = global.document
    let created = 0
    global.document = { createElement() { created++; return {} } }
    try {
        const atlas = new SpriteAtlas(16)
        const regions = Array.from({ length: 5 }, () => atlas.allocate(8, 8))
        assert.equal(created, 2)
        assert.equal(regions[0].canvas, regions[3].canvas)
        assert.notEqual(regions[0].canvas, regions[4].canvas)
        assert.deepEqual(regions.slice(0, 4).map(r => [r.x, r.y]), [[0, 0], [8, 0], [0, 8], [8, 8]])
        assert.throws(() => atlas.allocate(17, 8))
    } finally { global.document = previous }
})

test('each balloon draws its ropes, basket, and envelope before the next balloon', () => {
    const previous = global.document
    const events = []
    const raster = new Proxy({}, { get: () => () => {} })
    global.document = { createElement: () => ({ width: 0, height: 0, getContext: () => raster }) }
    const screen = new Proxy({}, { get: (_, key) => () => {
        if (key === 'stroke') events.push('ropes')
        if (key === 'drawImage') events.push('sprite')
    } })
    try {
        const balloon = { finish: 'hot-air', radius: 60, x: 100, y: 100, angle: 0,
            color: '#cc8800', panelColors: ['#cc8800'], popped: false,
            suspension: { x: 100, y: 197, angle: 0 } }
        drawBalloon(screen, balloon)
        drawBalloon(screen, { ...balloon, x: 110 })
        assert.deepEqual(events, ['ropes', 'sprite', 'sprite', 'ropes', 'sprite', 'sprite'])
    } finally { global.document = previous }
})
