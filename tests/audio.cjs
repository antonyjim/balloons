const { test } = require('node:test')
const assert = require('node:assert/strict')
const audio = require('../dist-ts/audio')
const flush = () => new Promise(resolve => setImmediate(resolve))

test('one gesture unlocks the playback context; loading is shared and stopping cancels pending inflation', async () => {
    const originalContext = global.AudioContext
    const originalFetch = global.fetch
    const contexts = []
    let requests = 0
    let releaseFetch
    const fetchGate = new Promise(resolve => { releaseFetch = resolve })
    class FakeAudioContext {
        state = 'suspended'
        destination = {}
        sampleRate = 44100
        sources = []
        resumes = 0
        decodes = 0
        constructor() { contexts.push(this) }
        addEventListener() {}
        resume() { this.resumes++; this.state = 'running'; return Promise.resolve() }
        close() { this.state = 'closed'; return Promise.resolve() }
        decodeAudioData() { this.decodes++; return Promise.resolve({ decoded: true }) }
        createBuffer() { return { silent: true } }
        createGain() { return { gain: {}, connect() {}, disconnect() {} } }
        createBufferSource() {
            const source = { started: false, stopped: false, loop: false,
                connect() {}, disconnect() {},
                start() { this.started = true }, stop() { this.stopped = true }
            }
            this.sources.push(source)
            return source
        }
    }
    global.AudioContext = FakeAudioContext
    global.fetch = async () => {
        requests++
        await fetchGate
        return { ok: true, arrayBuffer: async () => new ArrayBuffer(16) }
    }
    try {
        const preload = audio.preloadSounds()
        assert.equal(contexts.length, 0, 'preloading must not create a context before a gesture')
        audio.unlockAudio(true)
        audio.startInflateSound('bubble')
        assert.equal(contexts.length, 1)
        assert.equal(contexts[0].resumes, 1, 'resume must happen synchronously on the gesture')
        audio.stopInflateSound()
        releaseFetch()
        await preload
        await flush()
        assert.equal(requests, 6, 'shared sound URLs are fetched once')
        assert.equal(contexts[0].decodes, 6)
        assert.equal(contexts[0].sources.filter(source => source.loop).length, 0,
            'release before decoding must not start a late inflation loop')
        audio.startInflateSound('bubble')
        const loop = contexts[0].sources.find(source => source.loop)
        assert.ok(loop?.started, 'inflation uses the unlocked context')
        audio.startInflateSound('bubble')
        assert.equal(contexts[0].sources.filter(source => source.loop).length, 1)
        audio.playPopSound('paint')
        assert.ok(contexts[0].sources.some(source => source.buffer?.decoded && !source.loop && source.started))
        audio.stopInflateSound()
        assert.equal(loop.stopped, true)
        await flush()
        assert.equal(requests, 6)
        assert.equal(contexts.length, 1)
    } finally {
        audio.disposeSounds()
        global.AudioContext = originalContext
        global.fetch = originalFetch
    }
})
