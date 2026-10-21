const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
function harness(getMedia) {
    let timer, stopped = 0, paused = 0
    const frames = [], errors = [], requests = []
    const track = { stop() { stopped++ } }
    const media = { getTracks: () => [track], getVideoTracks: () => [track] }
    const player = { videoWidth: 640, videoHeight: 480, async play() {}, pause() { paused++ } }
    const context = {
        exports: {},
        navigator: { mediaDevices: { async getUserMedia(options) { requests.push(options); return getMedia ? getMedia(media) : media } } },
        document: { createElement: type => type === 'video' ? player : { getContext: () => ({ drawImage() {} }), toDataURL: () => 'data:image/jpeg;base64,frame' } },
        setTimeout(fn) { timer = fn; return 1 }, clearTimeout() { timer = undefined }
    }
    vm.runInNewContext(fs.readFileSync('dist-ts/puzzle/camera.js', 'utf8'), context)
    const camera = context.exports.createPuzzleCamera(frame => frames.push(frame), error => errors.push(error))
    return { camera, frames, errors, requests, player, stopped: () => stopped, paused: () => paused, timer: () => timer }
}

test('camera provides local piece frames, never requests audio, and releases all tracks on stop', async () => {
    const app = harness()
    await app.camera.start()
    assert.equal(app.requests[0].audio, false)
    assert.equal(app.frames.length, 1)
    app.timer()()
    assert.equal(app.frames.length, 2)
    app.camera.stop()
    assert.equal(app.stopped(), 1)
    assert.equal(app.paused(), 1)
    assert.equal(app.player.srcObject, null)
    assert.equal(app.timer(), undefined)
})

test('leaving puzzles while camera permission is pending releases a late stream without showing frames', async () => {
    let grant
    const app = harness(media => new Promise(resolve => { grant = () => resolve(media) }))
    const pending = app.camera.start()
    app.camera.stop(); grant(); await pending
    assert.equal(app.stopped(), 1)
    assert.equal(app.frames.length, 0)
})

test('camera denial leaves no running stream or render loop', async () => {
    const app = harness(() => { throw new Error('Camera permission denied') })
    await app.camera.start()
    assert.equal(app.errors.length, 1)
    assert.equal(app.frames.length, 0)
    assert.equal(app.timer(), undefined)
})
