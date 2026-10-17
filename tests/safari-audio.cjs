const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
test('trusted touch-end retries a stuck interrupted context and selects the playback session', async () => {
    const listeners = {}, session = { type: 'auto' }
    let instance
    class SafariContext {
        state = 'suspended'
        sampleRate = 44100
        destination = {}
        resumes = 0
        constructor() { instance = this }
        addEventListener() {}
        resume() {
            this.resumes++
            if (this.resumes === 1) return new Promise(() => {}) // Safari's interrupted pending resume.
            this.state = 'running'
            return Promise.resolve()
        }
        createBuffer() { return {} }
        createBufferSource() { return { connect() {}, disconnect() {}, start() {} } }
        decodeAudioData() { return Promise.resolve({}) }
        close() { return Promise.resolve() }
    }
    const context = {
        exports: {}, AudioContext: SafariContext, performance,
        navigator: { audioSession: session }, console,
        document: { addEventListener(name, listener) { listeners[name] = listener } },
        fetch: async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(4) })
    }
    vm.runInNewContext(fs.readFileSync('dist-ts/audio.js', 'utf8'), context)
    context.exports.setupAudioGestures()
    context.exports.unlockAudio()
    assert.equal(instance.resumes, 1)
    instance.state = 'interrupted'
    listeners.touchend({ isTrusted: false })
    assert.equal(instance.resumes, 1)
    listeners.touchend({ isTrusted: true })
    assert.equal(instance.resumes, 2, 'a previous pending resume cannot block a new permitted gesture')
    assert.equal(instance.state, 'running')
    assert.equal(session.type, 'playback')
    await new Promise(resolve => setImmediate(resolve))
    context.exports.disposeSounds()
})
