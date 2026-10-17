const { test } = require('node:test')
const assert = require('node:assert/strict')
const { drawBalloon } = require('../dist-ts/objects/balloon')
test('foil artwork stays stable during growth and does not reuse a latex sprite of the same color', () => {
    const previousDocument = global.document, previousPath = global.Path2D
    let vectorCalls = 0
    const ctx = new Proxy({}, { get(target, key) {
        if (key in target) return target[key]
        if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => ({ addColorStop() {} })
        return () => { if (key === 'fill' || key === 'stroke') vectorCalls++ }
    } })
    global.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) }
    global.Path2D = class { constructor() { return new Proxy({}, { get: () => () => {} }) } }
    try {
        const balloon = { finish: 'latex', x: 0, y: 0, angle: 0, radius: 40, color: '#ee7799', foil: true }
        drawBalloon(ctx, balloon)
        const foilCalls = vectorCalls
        balloon.radius = 80
        drawBalloon(ctx, balloon)
        assert.equal(vectorCalls, foilCalls)
        balloon.foil = false
        drawBalloon(ctx, balloon)
        assert.ok(vectorCalls > foilCalls)
    } finally { global.document = previousDocument; global.Path2D = previousPath }
})
