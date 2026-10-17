const { test } = require('node:test')
const assert = require('node:assert/strict')
const { preloadBalloonMaterials, materialRevision } = require('../dist-ts/objects/balloonMaterials')
const { drawBalloon } = require('../dist-ts/objects/balloon')

test('material loading refreshes cached sprites once, then returns to raster-only rendering', async () => {
    const originalImage = global.Image, originalDocument = global.document
    let images = 0, vectorCalls = 0, materialDraws = 0
    const ready = []
    global.Image = class {
        constructor() { images++ }
        decode() { return new Promise(resolve => ready.push(resolve)) }
    }
    const raster = new Proxy({}, { get: (_, key) => {
        if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => ({ addColorStop() {} })
        return () => {
            if (key === 'fill' || key === 'stroke') vectorCalls++
            if (key === 'drawImage') materialDraws++
        }
    } })
    global.document = { createElement: () => ({ width: 0, height: 0, getContext: () => raster }) }
    const screen = new Proxy({}, { get: () => () => {} })
    try {
        const balloon = { finish: 'hot-air', radius: 60, x: 100, y: 100, angle: 0,
            color: '#d88344', panelColors: ['#d88344', '#334488'], popped: false }
        drawBalloon(screen, balloon)
        const beforeLoad = vectorCalls
        const pending = preloadBalloonMaterials()
        assert.equal(images, 2)
        assert.equal(materialRevision('fabric'), 0)
        ready.forEach(resolve => resolve())
        await pending
        assert.equal(materialRevision('fabric'), 1)
        assert.equal(materialRevision('latex'), 1)
        drawBalloon(screen, balloon)
        assert.ok(vectorCalls > beforeLoad)
        assert.equal(materialDraws, 0)
        const afterLoad = vectorCalls
        for (let i = 0; i < 20; i++) drawBalloon(screen, balloon)
        assert.equal(vectorCalls, afterLoad)
        assert.equal(materialDraws, 0)
        await preloadBalloonMaterials()
        assert.equal(images, 2)
    } finally { global.Image = originalImage; global.document = originalDocument }
})
