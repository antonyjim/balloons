const inflateSound = new Audio('/sounds/inflate.wav')

inflateSound.loop = true
inflateSound.volume = 0.35

const POP_VOLUME = 0.6
const POP_POOL_SIZE = 8

let inflatePlaying = false

let audioContext: AudioContext | null = null
let inflateBuffer: AudioBuffer | null = null
let inflateSource: AudioBufferSourceNode | null = null

async function initAudio(): Promise<void> {
  if (audioContext) return

  audioContext = new AudioContext()

  const response = await fetch('/sounds/inflate.wav')
  const data = await response.arrayBuffer()

  inflateBuffer =
    await audioContext.decodeAudioData(data)
}

export async function startInflateSound(): Promise<void> {
  await initAudio()

  if (!audioContext || !inflateBuffer || inflateSource) {
    return
  }

  if (audioContext.state === 'suspended') {
    await audioContext.resume()
  }

  const source =
    audioContext.createBufferSource()

  source.buffer = inflateBuffer
  source.loop = true

  source.connect(audioContext.destination)
  source.start()

  inflateSource = source
}

export function stopInflateSound(): void {
  if (!inflateSource) return

  inflateSource.stop()
  inflateSource.disconnect()
  inflateSource = null
}


const popSounds = Array.from(
  { length: POP_POOL_SIZE },
  () => {
    const audio = new Audio('/sounds/pop.wav')
    audio.volume = POP_VOLUME
    return audio
  }
)

let nextPopSound = 0

export function playPopSound(): void {
  const sound =
    popSounds[nextPopSound]

  nextPopSound =
    (nextPopSound + 1) %
    POP_POOL_SIZE

  sound.currentTime = 0

  void sound.play()
}