import {
    Balloon,
    containsPoint,
    defaultBalloonConfig,
    drawBalloon,
    popBalloon,
    updateBalloon
} from './balloon'
import { popWithForce, RELEASE_IMPULSE, updateBalloonPhysics } from './physics'
import { startInflateSound, stopInflateSound } from './audio'

function requireCanvas(): HTMLCanvasElement {
    const element = document.querySelector<HTMLCanvasElement>('#app')
    if (!element) throw new Error('Canvas not found')
    return element
}

function requireContext(element: HTMLCanvasElement): CanvasRenderingContext2D {
    const context = element.getContext('2d', { alpha: false })
    if (!context) throw new Error('2D canvas unavailable')
    return context
}

const canvas = requireCanvas()
const ctx = requireContext(canvas)

const balloonConfig = {
    ...defaultBalloonConfig,
    maxScreenRatio: 1 / 5,
    popAtMax: false
}

const balloons: Balloon[] = []
const activePointers = new Map<number, Balloon>()
const counterEl = document.getElementById('counter')
const background = new Image()
const backgroundCanvas = document.createElement('canvas')
const backgroundCtx = backgroundCanvas.getContext('2d')

let width = 0
let height = 0
let previousCount = -1
let lastTime = 0

// For popping balloons sequentially when reset is pressed
const RESET_POP_INTERVAL = 0.075

let resetQueue: Balloon[] = []
let resetElapsed = 0
let resetting = false

function randomPastelColor(): string {
    const hue = Math.random() * 360
    const saturation = 70 + Math.random() * 15
    const lightness = 70 + Math.random() * 10
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`
}

function drawBackground(): void {
    if (!backgroundCtx) return
    backgroundCanvas.width = width
    backgroundCanvas.height = height
    backgroundCtx.fillStyle = '#cde5f2'
    backgroundCtx.fillRect(0, 0, width, height)

    if (!background.complete || !background.naturalWidth) return

    const scale = Math.max(
        width / background.naturalWidth,
        height / background.naturalHeight
    )
    const sourceWidth = width / scale
    const sourceHeight = height / scale
    const sourceX = (background.naturalWidth - sourceWidth) * 0.5
    const sourceY = (background.naturalHeight - sourceHeight) * 0.5

    backgroundCtx.drawImage(
        background,
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

function resize(): void {
    width = window.innerWidth
    height = window.innerHeight
    // Avoid expensive 3x/4x pixel buffers on high-density screens.
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    canvas.style.touchAction = 'none'
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    drawBackground()
}

function reset(): void {
    balloons.length = 0
    activePointers.clear()
    stopInflateSound()
    updateCounter()
}

function resetBalloons(): void {
    if (resetting) return

    resetting = true
    resetElapsed = 0

    resetQueue = balloons.filter(b => !b.popped)

    // Randomize the popping order
    for (let i = resetQueue.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))

        const temp = resetQueue[i]
        resetQueue[i] = resetQueue[j]
        resetQueue[j] = temp
    }
}

function updateReset(dt: number): void {
    if (!resetting) return

    resetElapsed += dt

    while (
        resetQueue.length > 0 &&
        resetElapsed >= RESET_POP_INTERVAL
    ) {
        resetElapsed -= RESET_POP_INTERVAL

        const balloon = resetQueue.pop()!

        if (!balloon.popped) {
            popBalloon(balloon)
        }
    }

    if (resetQueue.length === 0) {
        reset()
        resetting = false
    }
}

function updateCounter(): void {
    if (balloons.length === previousCount) return
    previousCount = balloons.length
    if (counterEl) counterEl.textContent = String(previousCount)
}

function update(dt: number): void {
    updateReset(dt)

    for (const balloon of balloons) {
        updateBalloon(balloon, dt, width, height, balloonConfig)
    }

    updateBalloonPhysics(balloons, dt, width, height, balloonConfig)

    for (let i = balloons.length - 1; i >= 0; i--) {
        const balloon = balloons[i]

        if (
            balloon.popped &&
            balloon.popTime >= balloonConfig.popDuration
        ) {
            balloons.splice(i, 1)
        }
    }
    updateCounter()
    syncInflateSound()
}

function render(): void {
    if (backgroundCanvas.width && backgroundCanvas.height) {
        ctx.drawImage(backgroundCanvas, 0, 0)
    } else {
        ctx.fillStyle = '#cde5f2'
        ctx.fillRect(0, 0, width, height)
    }

    for (const balloon of balloons) drawBalloon(ctx, balloon)
}

let profileFrames = 0
let profileUpdate = 0
let profileRender = 0
let profileStart = performance.now()

function frame(time: number): void {
    if (lastTime === 0) lastTime = time

    const dt = Math.min((time - lastTime) / 1000, 1 / 30)
    lastTime = time

    const t0 = performance.now()
    update(dt)

    const t1 = performance.now()
    render()

    const t2 = performance.now()

    profileUpdate += t1 - t0
    profileRender += t2 - t1
    profileFrames++

    if (time - profileStart >= 5000) {
        console.log({
            balloons: balloons.length,
            fps: Math.round(
                profileFrames * 1000 /
                (time - profileStart)
            ),
            physicsMs: +(profileUpdate / profileFrames).toFixed(2),
            renderMs: +(profileRender / profileFrames).toFixed(2)
        })

        profileFrames = 0
        profileUpdate = 0
        profileRender = 0
        profileStart = time
    }

    requestAnimationFrame(frame)
}

function canvasPosition(event: PointerEvent): { x: number, y: number } {
    const rect = canvas.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
}

canvas.addEventListener('contextmenu', event => event.preventDefault())

canvas.addEventListener('pointerdown', event => {
    event.preventDefault()
    if (resetting) return
    const { x, y } = canvasPosition(event)

    for (let i = balloons.length - 1; i >= 0; i--) {
        const balloon = balloons[i]
        if (!containsPoint(balloon, x, y)) continue
        // A balloon being inflated by another pointer is not popped.
        if (balloon.pointerId !== null) return
        popWithForce(balloons, balloon)
        return
    }

    const balloon: Balloon = {
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
    }

    balloons.push(balloon)
    activePointers.set(event.pointerId, balloon)
    canvas.setPointerCapture(event.pointerId)
    if (activePointers.size === 1) void startInflateSound()
    updateCounter()
})

canvas.addEventListener('pointermove', event => {
    const balloon = activePointers.get(event.pointerId)
    if (!balloon || balloon.popped) return
    const { x, y } = canvasPosition(event)
    balloon.anchorX = x
    balloon.anchorY = y
})

function releaseBalloon(pointerId: number): void {
    const balloon = activePointers.get(pointerId)
    if (!balloon) return
    activePointers.delete(pointerId)
    balloon.pointerId = null
    balloon.growing = false

    if (!balloon.popped) {
        const angle = Math.random() * Math.PI * 2
        const impulse = Math.max(RELEASE_IMPULSE / 2, RELEASE_IMPULSE * (0.5 + Math.random() * 0.5))
        balloon.vx += Math.cos(angle) * impulse
        balloon.vy += Math.sin(angle) * impulse
        balloon.angularVelocity += (Math.random() - 0.5) * 0.5
    }
    if (activePointers.size === 0) stopInflateSound()
}

function syncInflateSound(): void {
    const inflating = balloons.some(
        balloon =>
            balloon.growing &&
            !balloon.popped &&
            balloon.pointerId !== null
    )

    if (!inflating) {
        stopInflateSound()
    }
}

canvas.addEventListener('pointerup', event => releaseBalloon(event.pointerId))
canvas.addEventListener('pointercancel', event => releaseBalloon(event.pointerId))
canvas.addEventListener('lostpointercapture', event => releaseBalloon(event.pointerId))

window.addEventListener('resize', resize)
document.getElementById('reset')?.addEventListener('click', resetBalloons)
background.addEventListener('load', drawBackground)
background.src = '/bg.png'
resize()
updateCounter()
requestAnimationFrame(frame)
