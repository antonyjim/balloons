const { paintSplatterShapes } = require('../dist-ts/objects/paintSplatterShapes')
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { PaintLayer, paintLayer, createPaintSplatter } = require('../dist-ts/objects/paintBalloon')
const audio = require('../dist-ts/audio')
const { popBalloon } = require('../dist-ts/objects/balloon')

function balloon(finish = 'paint') {
    return { x: 100, y: 150, radius: 30, color: '#ff4466', finish,
        popped: false, growing: true, pointerId: 1, popTime: 0 }
}

test('only paint balloons emit paint, and repeated popping emits once', () => {
    const previousSound = audio.playPopSound
    const previousAdd = paintLayer.add
    let splatters = 0
    audio.playPopSound = () => {}
    paintLayer.add = () => { splatters++ }
    try {
        const paint = balloon()
        popBalloon(paint)
        popBalloon(paint)
        popBalloon(balloon('latex'))
        assert.equal(splatters, 1)
        assert.equal(paint.pointerId, null)
        assert.equal(paint.growing, false)
    } finally {
        audio.playPopSound = previousSound
        paintLayer.add = previousAdd
    }
})

test('splatter preserves position and color and generates bounded geometry', () => {
    const splatter = createPaintSplatter(balloon(), () => 0.5)
    assert.equal(splatter.x, 100)
    assert.equal(splatter.y, 150)
    assert.equal(splatter.color, '#ff4466')
    assert.ok(splatter.shape >= 0 && splatter.shape < paintSplatterShapes.length)
    assert.ok(Math.abs(splatter.scaleX) < 30 / 50)
    assert.ok(splatter.scaleY < 30 / 50)
})

test('paint is stamped once, retained across frames and resize, and cleared on reset', () => {
    const previousDocument = global.document
    const previousPath = global.Path2D
    global.Path2D = class { constructor(path) { assert.ok(path.includes("C")) } }
    const contexts = []
    const makeContext = () => ({
        fills: 0, images: 0, clears: 0,
        setTransform() {}, save() {}, restore() {}, translate() {}, rotate() {}, scale() {},
        beginPath() {}, moveTo() {}, lineTo() {}, quadraticCurveTo() {}, closePath() {}, arc() {},
        fill() { this.fills++ }, drawImage() { this.images++ },
        clearRect() { this.clears++ }
    })
    global.document = { createElement() {
        const context = makeContext()
        contexts.push(context)
        return { width: 0, height: 0, getContext: () => context }
    } }
    try {
        const layer = new PaintLayer()
        const screen = makeContext()
        layer.add(balloon())
        layer.draw(screen, 400, 600, 2)
        const stamped = contexts[0].fills
        assert.equal(stamped, 1)
        layer.draw(screen, 400, 600, 2)
        assert.equal(contexts[0].fills, stamped)
        assert.equal(screen.images, 2)
        layer.draw(screen, 600, 400, 2)
        assert.equal(contexts.length, 2)
        assert.equal(contexts[1].images, 1)
        assert.equal(contexts[1].fills, 0)
        layer.add(balloon())
        layer.clear()
        assert.equal(contexts[1].clears, 1)
        layer.draw(screen, 600, 400, 2)
        assert.equal(contexts[1].fills, 0)
    } finally {
        global.document = previousDocument
        global.Path2D = previousPath
    }
})

test('paint balloons pop at maximum size and emit one splatter', () => {
    const { updateBalloon, defaultBalloonConfig } = require('../dist-ts/objects/balloon')
    const previousSound = audio.playPopSound
    const previousAdd = paintLayer.add
    let splatters = 0
    audio.playPopSound = () => {}
    paintLayer.add = () => { splatters++ }
    try {
        const paint = balloon()
        paint.radius = 9
        updateBalloon(paint, 0.1, 90, 90, defaultBalloonConfig, [paint])
        assert.equal(paint.radius, 10)
        assert.equal(paint.popped, true)
        assert.equal(splatters, 1)
        updateBalloon(paint, 0.1, 90, 90, defaultBalloonConfig, [paint])
        assert.equal(splatters, 1)
    } finally {
        audio.playPopSound = previousSound
        paintLayer.add = previousAdd
    }
})

test('random samples choose different authored silhouettes and transforms', () => {
    const a = createPaintSplatter(balloon(), () => 0.1)
    const b = createPaintSplatter(balloon(), () => 0.8)
    assert.notEqual(a.shape, b.shape)
    assert.notEqual(a.rotation, b.rotation)
    assert.notEqual(a.scaleX, b.scaleX)
})

test('all expanded splatter silhouettes can be selected', () => {
    assert.equal(paintSplatterShapes.length, 28)
    assert.equal(new Set(paintSplatterShapes).size, 28)
    const indices = new Set()
    for (let i = 0; i < paintSplatterShapes.length; i++) indices.add(createPaintSplatter(balloon(), () => (i + 0.5) / paintSplatterShapes.length).shape)
    assert.equal(indices.size, 28)
})
