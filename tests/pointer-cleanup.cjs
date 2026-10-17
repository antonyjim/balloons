const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')

test('focus loss stops growth and releases captures even for an orphaned held object', () => {
    const source = fs.readFileSync('dist-ts/index.js', 'utf8')
    const start = source.indexOf('function cancelCanvasPointers()')
    const end = source.indexOf('\n}', start) + 2
    const balloons = [{ pointerId: 1, growing: true }, { pointerId: 2, growing: true }]
    const activePointers = new Map([[1, balloons[0]]])
    const basketDrags = new Map([[1, {}]])
    const released = []
    let audioStops = 0
    const context = {
        balloons, activePointers, basketDrags,
        canvas: { hasPointerCapture: () => true, releasePointerCapture(id) {
            assert.equal(activePointers.size, 0, 'clear ownership before lost capture can fire')
            released.push(id)
        } },
        audio_1: { stopBurnerSound() {}, stopInflateSound() { audioStops++ } }
    }
    vm.runInNewContext(source.slice(start, end) + '\ncancelCanvasPointers()', context)
    assert.ok(balloons.every(object => !object.growing && object.pointerId === null))
    assert.deepEqual(released, [1, 2])
    assert.equal(basketDrags.size, 0)
    assert.equal(audioStops, 1)
})
