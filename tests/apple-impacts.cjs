const { test } = require('node:test')
const assert = require('node:assert/strict')
const audio = require('../dist-ts/audio')
const { resolveBalloonCollisions } = require('../dist-ts/physics')
const { getPhysicsOptions } = require('../dist-ts/objects/objectDefinitions')
const { defaultBalloonConfig: config, popBalloon, isBalloonFinished } = require('../dist-ts/objects/balloon')
const { ensureSuspendedBasket } = require('../dist-ts/objects/hotAirBalloon')
function body(finish, x = 300) {
    return { finish, x, y: 300, radius: 40, vx: 0, vy: 0, angle: 0, angularVelocity: 0,
        pointerId: null, growing: false, popped: false, popTime: 0, anchorX: x, anchorY: 300,
        color: '#fff', physics: { watermelonToughnessMin: 1, watermelonToughnessMax: 1 } }
}
test('apple impacts use material thresholds in either pair order, leaving gentle and glancing contacts intact', () => {
    const previous = audio.playPopSound
    audio.playPopSound = () => {}
    try {
        for (const finish of ['bubble', 'paint', 'latex', 'hot-air', 'watermelon', 'duck', 'apple']) {
            const options = getPhysicsOptions(body(finish))
            const threshold = finish === 'watermelon' ? options.watermelonCollisionBreakSpeed : options.appleImpactBreakSpeed
            for (const reverse of [false, true]) {
                for (const [vx, vy, popped] of [[threshold + 20, 0, true], [threshold - 20, 0, false], [-2000, 0, false], [0, 2000, false]]) {
                    const apple = body('apple'), target = body(finish, 365)
                    apple.vx = vx; apple.vy = vy
                    resolveBalloonCollisions(reverse ? [target, apple] : [apple, target], config)
                    assert.equal(target.popped, popped, `${finish} at (${vx}, ${vy})`)
                    if (finish !== 'apple') assert.equal(apple.popped, false)
                    if (target.popped && ['duck', 'apple'].includes(finish)) {
                        target.popTime = finish === 'duck' ? 1.5 : config.popDuration
                        assert.equal(isBalloonFinished(target, config), true)
                    }
                }
            }
        }
    } finally { audio.playPopSound = previous }
})
test('a fast apple can also ignite a hot-air balloon by striking its basket', () => {
    const previous = audio.playPopSound
    audio.playPopSound = () => {}
    try {
        const hot = body('hot-air')
        const basket = ensureSuspendedBasket(hot, getPhysicsOptions(hot))
        const apple = body('apple', basket.x + 25)
        apple.y = basket.y
        apple.vx = -1200
        resolveBalloonCollisions([hot, apple], config)
        assert.equal(hot.popped, true)
        assert.ok(hot.fire)
    } finally { audio.playPopSound = previous }
})
test('ordinary taps still cannot pop apples or rubber birds', () => {
    for (const finish of ['apple', 'duck']) {
        const object = body(finish)
        popBalloon(object)
        assert.equal(object.popped, false)
    }
})
