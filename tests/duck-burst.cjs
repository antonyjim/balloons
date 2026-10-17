const { test } = require('node:test')
const assert = require('node:assert/strict')
const audio = require('../dist-ts/audio')
const { popBalloon, updateBalloon, isBalloonFinished, defaultBalloonConfig: config } = require('../dist-ts/objects/balloon')
const { resolveBalloonCollisions } = require('../dist-ts/physics')
function body(finish, x) {
    return { finish, x, y: 300, radius: 40, vx: 0, vy: 0, angle: 0, angularVelocity: 0,
        pointerId: null, popped: false, growing: false, popTime: 0, color: '#ffd44f' }
}
test('only a hard apple hit starts a moving duck confetti burst that outlasts a normal pop', () => {
    const previous = audio.playPopSound
    audio.playPopSound = () => {}
    try {
        const duck = body('duck', 360)
        popBalloon(duck)
        assert.equal(duck.duckBurst, undefined)
        const apple = body('apple', 300)
        apple.vx = 1800
        resolveBalloonCollisions([apple, duck], config)
        assert.equal(duck.popped, true)
        assert.equal(duck.duckBurst.length, 38)
        assert.ok(new Set(duck.duckBurst.map(bit => bit.color)).size > 3)
        const startY = duck.duckBurst[0].y
        updateBalloon(duck, 0.1, 1000, 800, config, [duck])
        assert.notEqual(duck.duckBurst[0].y, startY)
        duck.popTime = config.popDuration
        assert.equal(isBalloonFinished(duck, config), false)
        duck.popTime = 1.5
        assert.equal(isBalloonFinished(duck, config), true)
    } finally { audio.playPopSound = previous }
})
