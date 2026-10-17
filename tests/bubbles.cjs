const { test } = require('node:test')
const assert = require('node:assert/strict')
const audio = require('../dist-ts/audio')
const { defaultBalloonConfig } = require('../dist-ts/objects/balloon')
const { drawBalloon } = require('../dist-ts/objects/balloon')
const { containsPoint } = require('../dist-ts/objects/balloon')
const { bubbleRadiusAt } = require('../dist-ts/objects/bubble')

test('touch boundary follows the animated wavy silhouette rather than a narrow ellipse', () => {
    const bubble = body({ bubbleMotion: { time: .3, impact: 1, direction: 0 } })
    for (let i = 0; i < 64; i++) {
        const angle = i / 64 * Math.PI * 2
        const radius = bubbleRadiusAt(bubble, angle)
        const hit = offset => containsPoint(bubble,
            bubble.x + Math.cos(angle) * (radius + offset),
            bubble.y + Math.sin(angle) * (radius + offset))
        assert.equal(hit(-.1), true)
        assert.equal(hit(.1), false)
    }
})

test('bubble contacts begin at the visible rim, including outward wave crests', () => {
    const a = body({ bubbleMotion: { time: .3, impact: 1, direction: 0 } })
    const b = body({ bubbleMotion: { time: .3, impact: 1, direction: 0 } })
    const contact = bubbleRadiusAt(a, 0) + bubbleRadiusAt(b, Math.PI)
    b.x = a.x + contact - .2
    resolveBalloonCollisions([a, b], defaultBalloonConfig)
    assert.ok(b.x - a.x >= contact - 1e-8)
    const distant = body({ x: 600 })
    resolveBalloonCollisions([a, distant], defaultBalloonConfig)
    assert.equal(distant.bubbleMotion, undefined)
})
const { resolveBalloonCollisions } = require('../dist-ts/physics')
const { updateBubbleMotion, disturbBubble, bubbleFrame, drawBubbleVector } = require('../dist-ts/objects/bubble')
const { ensureSuspendedBasket } = require('../dist-ts/objects/hotAirBalloon')
const { getPhysicsOptions } = require('../dist-ts/objects/objectDefinitions')
const body = overrides => ({ x: 300, y: 300, radius: 40, vx: 0, vy: 0, angle: 0, angularVelocity: 0,
    anchorX: 300, anchorY: 300, pointerId: null, popped: false, growing: false, finish: 'bubble', ...overrides })

test('collision direction and body spin do not rotate the bubble artwork', () => {
    const previous = global.document
    const raster = new Proxy({}, { get: (_, key) => {
        if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => ({ addColorStop() {} })
        return () => {}
    } })
    global.document = { createElement: () => ({ width: 0, height: 0, getContext: () => raster }) }
    const rotations = []
    const screen = new Proxy({}, { get: (_, key) => (...args) => { if (key === 'rotate') rotations.push(args[0]) } })
    try {
        const bubble = body({ angle: 1.7 })
        for (const [nx, ny] of [[1, 0], [0, 1], [-1, 0]]) {
            disturbBubble(bubble, nx, ny, 200)
            bubble.angle += 1
            drawBalloon(screen, bubble)
        }
        assert.deepEqual(rotations, [0, 0, 0])
    } finally { global.document = previous }
})

test('bubble contacts excite a bounded wobble which decays back to gentle motion', () => {
    const a = body({ vx: 100 }), b = body({ x: 365, vx: -100 })
    resolveBalloonCollisions([a, b], defaultBalloonConfig)
    assert.ok(a.bubbleMotion.impact > 0.5)
    assert.ok(b.bubbleMotion.impact > 0.5)
    assert.equal(a.popped, false)
    updateBubbleMotion(a, 3)
    assert.ok(a.bubbleMotion.impact < .01)
    assert.ok(bubbleFrame(a) < 12)
    disturbBubble(a, 0, 1, 100000)
    assert.equal(a.bubbleMotion.impact, 1)
})

test('bubbles pop against hot-air envelopes and baskets in either pair order', () => {
    const previous = audio.playPopSound
    audio.playPopSound = () => {}
    try {
        for (const reverse of [false, true]) {
            for (const basketContact of [false, true]) {
                const hot = body({ finish: 'hot-air', pointerId: 7 })
                const basket = ensureSuspendedBasket(hot, getPhysicsOptions(hot))
                const bubble = body({ radius: 12, x: hot.x, y: basketContact ? basket.y + 6 : hot.y - 30 })
                resolveBalloonCollisions(reverse ? [bubble, hot] : [hot, bubble], defaultBalloonConfig)
                assert.equal(bubble.popped, true)
                assert.equal(hot.popped, false)
            }
        }
    } finally { audio.playPopSound = previous }
})

test('wavy rim closes smoothly and remains within the sprite padding', () => {
    const points = []
    const ctx = new Proxy({}, { get: (_, key) => {
        if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => ({ addColorStop() {} })
        return (...args) => { if (key === 'moveTo' || key === 'lineTo') points.push(args) }
    } })
    drawBubbleVector(ctx, body({ bubbleMotion: { time: .3, impact: 1, direction: 0 } }))
    assert.equal(points.length, 65)
    for (const [x, y] of points) assert.ok(Math.hypot(x, y) < 40 * 1.15)
    assert.ok(Math.hypot(points[0][0] - points[64][0], points[0][1] - points[64][1]) < 1e-8)
    assert.ok(Math.max(...points.map(([x, y]) => Math.hypot(x, y))) - Math.min(...points.map(([x, y]) => Math.hypot(x, y))) > 1)
})
