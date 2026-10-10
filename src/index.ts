import {
    Balloon,
    containsPoint,
    defaultBalloonConfig,
    drawBalloon,
    updateBalloon
} from './balloon'
import { popWithForce, RELEASE_IMPULSE, updateBalloonPhysics } from './physics'
import {
    playPopSound,
    startInflateSound,
    stopInflateSound,
} from './audio'

const balloonConfig = {
    ...defaultBalloonConfig,
    maxScreenRatio: 1 / 5,
    popAtMax: false
}
let lastTime = performance.now()
document.getElementById("reset")?.addEventListener('click', reset)

function frame(time: number): void {
    const dt = Math.min((time - lastTime) / 1000, 0.1)
    lastTime = time

    update(dt)
    render()

    requestAnimationFrame(frame)
}

function reset(e: MouseEvent) {
    while(balloons.length) {
        balloons.pop()
    }
}

function update(dt: number): void {
    const counterEl = document.getElementById("counter") || {innerText: ''}
    counterEl.innerText = balloons.length.toString()
    for (const balloon of balloons) {
        updateBalloon(
            balloon,
            dt,
            window.innerWidth,
            window.innerHeight,
            balloonConfig
        )
    }

    updateBalloonPhysics(
        balloons,
        dt,
        window.innerWidth,
        window.innerHeight,
        balloonConfig
    )

    for (let i = balloons.length - 1; i >= 0; i--) {
        const balloon = balloons[i]

        if (
            balloon.popped &&
            balloon.popTime >= balloonConfig.popDuration
        ) {
            balloons.splice(i, 1)
        }
    }

    const isInflating = balloons.some(
        balloon =>
            balloon.growing &&
            !balloon.popped
    )
}

requestAnimationFrame(frame)

const canvas = document.querySelector<HTMLCanvasElement>('#app')

if (!canvas) {
    throw new Error('Canvas not found')
}

const ctx = canvas.getContext('2d')

if (!ctx) {
    throw new Error('2D canvas unavailable')
}
const background = new Image()
background.src = '/bg.png'

const balloons: Balloon[] = []

canvas.addEventListener('contextmenu', event => {
    event.preventDefault()
})

function resize(): void {
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1
    const width = window.innerWidth
    const height = window.innerHeight

    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)

    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
}

canvas.addEventListener('pointerdown', event => {
    function randomPastelColor(): string {
        const hue = Math.random() * 360
        const saturation = 70 + Math.random() * 15
        const lightness = 70 + Math.random() * 10

        return `hsl(${hue}, ${saturation}%, ${lightness}%)`
    }

    event.preventDefault()

    const rect = canvas.getBoundingClientRect()

    const x = event.clientX - rect.left
    const y = event.clientY - rect.top

    // Iterate backwards so the visually top-most balloon wins.
    for (let i = balloons.length - 1; i >= 0; i--) {
        const balloon = balloons[i]

        if (containsPoint(balloon, x, y)) {
            popWithForce(balloons, balloon)
            return
        }
    }
    void startInflateSound()

    balloons.push({
        pointerId: event.pointerId,

        x,
        y,

        vx: 0,
        vy: 0,

        anchorX: x,
        anchorY: y,

        radius: balloonConfig.initialRadius,
        color: randomPastelColor(),

        angle: Math.random() * Math.PI * 2,
        angularVelocity: 0,

        growing: true,
        popped: false,
        popTime: 0
    })

    canvas.setPointerCapture(event.pointerId)
})

canvas.addEventListener('pointermove', event => {
    const balloon = balloons.find(
        x => x.pointerId === event.pointerId
    )

    if (!balloon) {
        return
    }

    const rect = canvas.getBoundingClientRect()

    balloon.anchorX = event.clientX - rect.left
    balloon.anchorY = event.clientY - rect.top
})

canvas.addEventListener('pointerup', event => {
    releaseBalloon(event.pointerId)
})

canvas.addEventListener('pointercancel', event => {
    releaseBalloon(event.pointerId)
})

function releaseBalloon(pointerId: number): void {
    const balloon = balloons.find(
        x => x.pointerId === pointerId
    )

    if (!balloon) return

    balloon.pointerId = null
    balloon.growing = false

    const angle =
        Math.random() *
        Math.PI *
        2

    const force =
        RELEASE_IMPULSE *
        (0.5 + Math.random() * 0.5)

    balloon.vx +=
        Math.cos(angle) * force

    balloon.vy +=
        Math.sin(angle) * force

    balloon.angularVelocity +=
        (Math.random() - 0.5) * 0.5
    stopInflateSound()
}

function drawBackground(
    ctx: CanvasRenderingContext2D,
    image: HTMLImageElement,
    width: number,
    height: number
): void {
    const scale = Math.max(
        width / image.naturalWidth,
        height / image.naturalHeight
    )

    const sourceWidth = width / scale
    const sourceHeight = height / scale

    const sourceX =
        (image.naturalWidth - sourceWidth) / 2

    const sourceY =
        (image.naturalHeight - sourceHeight) / 2

    ctx.drawImage(
        image,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        width,
        height
    )
}

function render(): void {
    if (!ctx) return
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)
    drawBackground(ctx, background, window.innerWidth, window.innerHeight)

    for (const balloon of balloons) {
        drawBalloon(ctx, balloon)
    }
}

window.addEventListener('resize', resize)

resize()
requestAnimationFrame(frame)