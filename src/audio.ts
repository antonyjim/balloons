const latexInflateUrl = '/sounds/latex-inflate.wav'
const latexPopUrl = '/sounds/latex-pop.wav'

const bubbleInflateUrl = '/sounds/bubble-inflate.wav'
const bubblePopUrl = '/sounds/bubble-pop.wav'

const hotAirInflateUrl = '/sounds/hot-air-inflate.wav'
const hotAirPopUrl = '/sounds/hot-air-pop.wav'

import { BalloonFinish } from './theme/types'

type SoundType = 'inflate' | 'pop'
type SoundKey = `${BalloonFinish}:${SoundType}`

const SOUND_URLS: Record<SoundKey, string> = {
    'latex:inflate': latexInflateUrl,
    'latex:pop': latexPopUrl,
    'paint:inflate': latexInflateUrl,
    'paint:pop': latexPopUrl,
    'watermelon:inflate': latexInflateUrl,
    'watermelon:pop': latexPopUrl,
    'apple:inflate': latexInflateUrl,
    'apple:pop': latexPopUrl,
    'duck:inflate': latexInflateUrl,
    'duck:pop': latexPopUrl,

    'bubble:inflate': bubbleInflateUrl,
    'bubble:pop': bubblePopUrl,

    'hot-air:inflate': hotAirInflateUrl,
    'hot-air:pop': hotAirPopUrl
}

const INFLATE_VOLUME = 0.35
const POP_VOLUME = 0.6

const buffers = new Map<SoundKey, AudioBuffer>()

let context: AudioContext | null = null
let preloadPromise: Promise<void> | null = null

let inflateRequested = false
let requestedFinish: BalloonFinish = 'latex'
let playingFinish: BalloonFinish | null = null

let inflateSource: AudioBufferSourceNode | null = null
let inflateGain: GainNode | null = null

function getContext(): AudioContext {
    if (!context || context.state === 'closed') {
        context = new AudioContext()
        context.addEventListener('statechange', () => { syncInflateSource(); syncBurnerSource() })
    }
    return context
}

function soundKey(finish: BalloonFinish, type: SoundType): SoundKey {
    return `${finish}:${type}`
}

// Fetching can happen before a gesture; context creation and resume happen on tap.
const rawSounds = new Map<string, ArrayBuffer>()
let decodePromise: Promise<void> | null = null
let unlockPromise: Promise<void> | null = null
let audioGeneration = 0

export function preloadSounds(): Promise<void> {
    if (preloadPromise) return preloadPromise
    const generation = audioGeneration
    preloadPromise = Promise.all(
        [...new Set(Object.values(SOUND_URLS))].map(async url => {
            if (rawSounds.has(url)) return
            const response = await fetch(url)
            if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`)
            const data = await response.arrayBuffer()
            if (generation === audioGeneration) rawSounds.set(url, data)
        })
    ).then(() => {}).catch(error => {
        if (generation === audioGeneration) preloadPromise = null
        throw error
    })
    return preloadPromise
}

function decodeSounds(): Promise<void> {
    if (decodePromise) return decodePromise
    const ctx = getContext()
    const generation = audioGeneration
    decodePromise = preloadSounds().then(async () => {
        if (generation !== audioGeneration) return
        // Paint reuses latex audio without decoding the same file twice.
        const decoded = new Map<string, Promise<AudioBuffer>>()
        await Promise.all(Object.entries(SOUND_URLS).map(async ([key, url]) => {
            if (buffers.has(key as SoundKey)) return
            let pending = decoded.get(url)
            if (!pending) {
                pending = ctx.decodeAudioData(rawSounds.get(url)!.slice(0))
                decoded.set(url, pending)
            }
            const buffer = await pending
            if (generation === audioGeneration) buffers.set(key as SoundKey, buffer)
        }))
        if (generation === audioGeneration) syncInflateSource()
    }).catch(error => {
        if (generation === audioGeneration) decodePromise = null
        throw error
    })
    return decodePromise
}

export function unlockAudio(init = false): void {
    const ctx = getContext()
    // Call resume synchronously inside the pointer handler, before loading awaits.
    if (ctx.state !== 'running' && !unlockPromise) {
        const generation = audioGeneration
        unlockPromise = ctx.resume().then(() => { syncInflateSource(); syncBurnerSource() }).catch(error => {
            console.warn('AudioContext resume failed:', error)
        }).finally(() => {
            if (generation === audioGeneration) unlockPromise = null
        })
    }
    if (init) {
        const source = ctx.createBufferSource()
        source.buffer = ctx.createBuffer(1, 1, ctx.sampleRate)
        source.connect(ctx.destination)
        source.onended = () => source.disconnect()
        source.start(0)
    }
    void decodeSounds().catch(error => console.warn('Sound loading failed:', error))
    syncInflateSource()
}

function stopInflateSource(): void {
    if (inflateSource) {
        inflateSource.stop()
        inflateSource.disconnect()
        inflateSource = null
    }

    if (inflateGain) {
        inflateGain.disconnect()
        inflateGain = null
    }

    playingFinish = null
}

function syncInflateSource(): void {
    const ctx = context

    if (!inflateRequested || !ctx || ctx.state !== 'running') {
        stopInflateSource()
        return
    }

    const finish = requestedFinish

    if (inflateSource && playingFinish === finish) {
        return
    }

    stopInflateSource()

    const buffer = buffers.get(soundKey(finish, 'inflate'))
    if (!buffer) return

    const source = ctx.createBufferSource()
    const gain = ctx.createGain()

    source.buffer = buffer
    source.loop = true

    gain.gain.value = INFLATE_VOLUME

    source.connect(gain)
    gain.connect(ctx.destination)

    inflateSource = source
    inflateGain = gain
    playingFinish = finish

    source.start()
}

export function startInflateSound(
    finish: BalloonFinish = 'latex'
): void {
    // Set desired state BEFORE any asynchronous operation.
    inflateRequested = true
    requestedFinish = finish

    unlockAudio()
    syncInflateSource()
}

export function stopInflateSound(): void {
    // Invalidate any pending asynchronous start.
    inflateRequested = false
    stopInflateSource()
}

export function playPopSound(finish: BalloonFinish = 'latex'): void {
    const requestedAt = performance.now()
    unlockAudio()
    const ctx = context!
    const generation = audioGeneration
    const play = (): void => {
        // Discard stale pops after slow loading or a blocked resume.
        if (generation !== audioGeneration || performance.now() - requestedAt > 150) return
        if (ctx.state !== 'running') return
        const buffer = buffers.get(soundKey(finish, 'pop'))
        if (!buffer) return
        const source = ctx.createBufferSource()
        const gain = ctx.createGain()
        source.buffer = buffer
        gain.gain.value = POP_VOLUME
        source.connect(gain)
        gain.connect(ctx.destination)
        source.onended = () => {
            source.disconnect()
            gain.disconnect()
        }
        source.start()
    }
    if (buffers.has(soundKey(finish, 'pop')) && ctx.state === 'running') play()
    else void Promise.all([decodeSounds(), unlockPromise]).then(play)
        .catch(error => console.warn('Pop audio failed:', error))
}

/** A short nasal call when a bird is pressed; no extra sound download. */
export function playDuckCall(goose = false): void {
    const ctx = context
    if (!ctx || ctx.state !== 'running') return
    const start = ctx.currentTime
    const source = ctx.createOscillator()
    const filter = ctx.createBiquadFilter()
    const gain = ctx.createGain()
    source.type = 'sawtooth'
    filter.type = 'bandpass'
    filter.frequency.value = goose ? 750 : 1200
    filter.Q.value = 2.5
    const pitch = goose ? 165 : 270
    source.frequency.setValueAtTime(pitch * 1.3, start)
    source.frequency.exponentialRampToValueAtTime(pitch, start + 0.06)
    source.frequency.exponentialRampToValueAtTime(pitch * 0.65, start + 0.24)
    gain.gain.setValueAtTime(0, start)
    gain.gain.linearRampToValueAtTime(0.22, start + 0.015)
    gain.gain.linearRampToValueAtTime(0.12, start + 0.09)
    gain.gain.linearRampToValueAtTime(0.19, start + 0.13)
    gain.gain.linearRampToValueAtTime(0, start + 0.26)
    source.connect(filter)
    filter.connect(gain)
    gain.connect(ctx.destination)
    source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect() }
    source.start(start)
    source.stop(start + 0.28)
}

export function suspendSounds(): void {
    stopInflateSound()
    stopBurnerSound()

    if (context?.state === 'running') {
        void context.suspend()
    }
}

export function disposeSounds(): void {
    stopInflateSound()
    stopBurnerSound()
    burnerBuffer = null

    const ctx = context
    audioGeneration++
    context = null
    unlockPromise = null
    decodePromise = null
    rawSounds.clear()

    if (ctx && ctx.state !== 'closed') {
        void ctx.close()
    }

    buffers.clear()
    preloadPromise = null
}
let burnerSource: AudioBufferSourceNode | null = null
let burnerGain: GainNode | null = null
let burnerBuffer: AudioBuffer | null = null
let burnerLevel = 0

/** Mix all burners into one quiet noise bed, rather than creating hundreds of loops. */
export function setBurnerSoundLevel(intensity: number): void {
    burnerLevel = Math.min(0.022, 0.007 * Math.sqrt(Math.max(0, intensity)))
    syncBurnerSource()
}
export function stopBurnerSound(): void {
    burnerLevel = 0
    syncBurnerSource()
}
function syncBurnerSource(): void {
    const ctx = context
    if (!ctx || ctx.state !== 'running' || burnerLevel <= 0) {
        if (burnerSource) { burnerSource.stop(); burnerSource.disconnect(); burnerSource = null }
        if (burnerGain) { burnerGain.disconnect(); burnerGain = null }
        return
    }
    if (!burnerSource) {
        if (!burnerBuffer) {
            burnerBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
            const data = burnerBuffer.getChannelData(0)
            let low = 0, rumble = 0
            let seed = 731
            for (let i = 0; i < data.length; i++) {
                seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
                const noise = seed / 2147483648 - 1
                low += (noise - low) * 0.12
                rumble += (noise - rumble) * 0.015
                data[i] = (low * 0.8 + rumble * 2) * 1.5
            }
            // Crossfade the loop seam once, keeping the live path allocation-free.
            const fade = Math.min(2048, data.length / 4)
            for (let i = 0; i < fade; i++) {
                const t = i / fade
                data[i] = data[data.length - fade + i] * (1 - t) + data[i] * t
            }
        }
        burnerSource = ctx.createBufferSource()
        burnerGain = ctx.createGain()
        burnerGain.gain.value = 0
        burnerSource.buffer = burnerBuffer
        burnerSource.loop = true
        burnerSource.connect(burnerGain)
        burnerGain.connect(ctx.destination)
        burnerSource.start()
    }
    burnerGain!.gain.setTargetAtTime(burnerLevel, ctx.currentTime, 0.1)
}
