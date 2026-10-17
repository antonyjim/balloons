import { randomDuckAppearance } from './objects/duck'
import { drawWater, waterSurface, waterTime } from './water'
import { setupWorkspace } from './workspace'
import { resetPopsDue, RESET_DEADLINE_SECONDS } from './resetTiming'
import { maximumRadius, availableRadius, enforceSizeLimits } from './objects/sizeLimits'
import { setupAppUpdates } from './appUpdates'
import { containsBasketPoint, moveHotAirAssembly } from './objects/hotAirBalloon'
import { sceneGround } from './sceneGround'
import { bindActivation } from './activation'
import { preloadBalloonMaterials } from './objects/balloonMaterials'
import { sampleAppleDrag, releaseAppleThrow } from './objects/apple'
import { paintLayer } from './objects/paintBalloon'
import { setupObjectPicker } from './objectPicker'
import { getPhysicsOptions } from './objects/objectDefinitions'
import {
    containsPoint,
    defaultBalloonConfig,
    drawBalloon,
    isBalloonFinished,
    updateBalloon
} from './objects/balloon'
import { popWithForce, updateBalloonPhysics, updateBreeze } from './physics'
import { onOrientation } from './deviceMotion'
import { BalloonFinish, ThemeManager } from './theme/ThemeManager'
import { BackgroundRenderer } from './theme/background'
import { getRandomPanelColors } from './theme/colors'
import {
    playDuckCall,
    preloadSounds,
    setBurnerSoundLevel,
    stopBurnerSound,
    unlockAudio,
    startInflateSound,
    stopInflateSound,
} from './audio'
import { Balloon, BalloonConfig } from './objects/balloonTypes'


function requireCanvas(): HTMLCanvasElement {
    const element = document.querySelector<HTMLCanvasElement>('#app')
    if (!element) throw new Error('Canvas not found')
    return element
}

function requireContext(element: HTMLCanvasElement): CanvasRenderingContext2D {
    const context = element.getContext('2d', { alpha: true })
    if (!context) throw new Error('2D canvas unavailable')
    return context
}

void preloadBalloonMaterials()
const canvas = requireCanvas()
const ctx = requireContext(canvas)
let balloonViewActive = true
void preloadSounds().catch(error => console.warn("Sound preload failed:", error))

const isMobile = window.matchMedia('(pointer: coarse)').matches

setupAppUpdates()

canvas.addEventListener('contextmenu', e => {
    e.preventDefault()
})

const balloonConfig: BalloonConfig = {
    ...defaultBalloonConfig,
    initialRadius: isMobile ? 22 : 40,
    minRadius: isMobile ? 18 : 24,
    maxRadius: isMobile ? 100 : 190,
    maxRadiusScreenRatio: isMobile ? 0.24 : 0.27,
    maxObjectAreaRatio: 0.12,
    maxSceneAreaRatio: isMobile ? 0.65 : 0.8,
    growthRate: isMobile ? 45 : 80,
    maxScreenRatio: isMobile ? 0.65 : 1 / 2.75
}

const balloons: Balloon[] = []
const activePointers = new Map<number, Balloon>()
const themeManager = new ThemeManager()
const background = new BackgroundRenderer()
let customBackground: string | null = null
setupObjectPicker(themeManager)

function applyTheme(): void {
    const theme = themeManager.current
    const label = document.getElementById("counter-label")

    if (label) label.innerText = theme.finishMode === "random" ? "OBJECTS" : theme.finish === "duck" ? "RUBBER DUCKS" : theme.finish === "apple" ? "APPLES" : theme.finish === "watermelon" ? "WATERMELONS" : theme.finish === "bubble" ? "BUBBLES" : "BALLOONS"

    void background.setBackground(customBackground ?? theme.theme.background)
}

applyTheme()
themeManager.subscribe(applyTheme)


let width = 0
let height = 0
let groundY = 0
let previousCount = -1
let lastTime = 0

// For popping balloons sequentially when reset is pressed
let resetQueue: Balloon[] = []
let resetStartedAt = 0
let resetCount = 0
let resetting = false


const counterEl = document.getElementById('counter')
if (counterEl) bindActivation(counterEl, () => {
    let enabled = false
    const Orientation = DeviceOrientationEvent as typeof DeviceOrientationEvent & {
        requestPermission?: () => Promise<string>
    }

    if (typeof Orientation.requestPermission === 'function') {
        Orientation.requestPermission()
            .then(permission => {
                console.log('Orientation permission:', permission)

                if (permission === 'granted') {
                    enabled = true
                    window.addEventListener(
                        'deviceorientation',
                        onOrientation
                    )
                }
            })
            .catch(console.error)
    } else {
        window.addEventListener(
            'deviceorientation',
            onOrientation
        )
        enabled = true
    }

    if (!enabled && counterEl) {
        counterEl.style = "color: red"
    } else {
        counterEl.style = "color: green"
    }
})

let currentDpr = 0
let currentPixelWidth = 0
let currentPixelHeight = 0

function syncGround(): void {
    const state = sceneGround(height, balloons)
    groundY = state.y
    const ground = document.getElementById('ground')
    if (ground) { ground.hidden = !state.visible; ground.style.height = `${height - groundY}px` }
}

function resize(): void {
    if (!balloonViewActive) return
    const rect = canvas.getBoundingClientRect()

    const nextWidth = rect.width
    const nextHeight = rect.height

    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    const pixelWidth = Math.round(nextWidth * dpr)
    const pixelHeight = Math.round(nextHeight * dpr)

    if (
        pixelWidth === currentPixelWidth &&
        pixelHeight === currentPixelHeight &&
        dpr === currentDpr
    ) {
        return
    }

    currentDpr = dpr
    currentPixelWidth = pixelWidth
    currentPixelHeight = pixelHeight

    width = nextWidth
    height = nextHeight
    syncGround()

    canvas.width = pixelWidth
    canvas.height = pixelHeight

    ctx.setTransform(
        pixelWidth / width,
        0,
        0,
        pixelHeight / height,
        0,
        0
    )
}


function reset(): void {
    paintLayer.clear()
    stopBurnerSound()
    balloons.length = 0
    syncGround()
    activePointers.clear()
    stopInflateSound()
    updateCounter()
}

function resetBalloons(): void {
    if (resetting) return

    resetting = true
    resetStartedAt = performance.now()

    resetQueue = balloons.filter(b => !b.popped)
    resetCount = resetQueue.length

    // Randomize the popping order
    for (let i = resetQueue.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))

        const temp = resetQueue[i]
        resetQueue[i] = resetQueue[j]
        resetQueue[j] = temp
    }
}

function updateReset(): void {
    if (!resetting) return

    // Use elapsed real time, since simulation dt is capped on slow devices.
    const elapsed = (performance.now() - resetStartedAt) / 1000
    const due = resetPopsDue(resetCount, elapsed)

    while (
        resetQueue.length > 0 &&
        resetCount - resetQueue.length < due
    ) {
        const balloon = resetQueue.pop()!

        if ((balloon.finish === 'apple' || balloon.finish === 'duck')) {
            balloon.apple = { exited: true }
        } else if (!balloon.popped) {
            popWithForce(balloons, balloon)
        }
    }

    if (elapsed >= RESET_DEADLINE_SECONDS ||
        (resetQueue.length === 0 && balloons.every(balloon => isBalloonFinished(balloon, balloonConfig)))) {
        resetQueue.length = 0
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
    syncGround()
    enforceSizeLimits(balloons, width, groundY, balloonConfig)
    updateReset()

    for (const balloon of balloons) {
        updateBalloon(balloon, dt, width, groundY, balloonConfig, balloons)
    }

    updateBalloonPhysics(balloons, dt, width, groundY, balloonConfig)

    for (let i = balloons.length - 1; i >= 0; i--) {
        const balloon = balloons[i]

        if (
            isBalloonFinished(balloon, balloonConfig)
        ) {
            if (balloon.pointerId !== null) releaseBalloon(balloon.pointerId)
            balloons.splice(i, 1)
        }
    }
    syncGround()
    updateCounter()
    syncInflateSound()
    let burnerIntensity = 0
    if (!document.hidden) {
        for (const balloon of balloons) if (!balloon.popped) burnerIntensity += balloon.burner?.intensity ?? 0
    }
    setBurnerSoundLevel(burnerIntensity)
}

// function render(): void {
//     ctx.clearRect(0, 0, canvas.width, canvas.height)

//     for (const balloon of balloons) {
//         drawBalloon(ctx, balloon)
//     }
// }

function render(): void {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    paintLayer.draw(ctx, width, height, currentDpr)
    const surface = waterSurface(groundY, balloons)
    drawWater(ctx, width, groundY, surface, waterTime())

    for (const balloon of balloons) {
        drawBalloon(ctx, balloon)
    }
    drawWater(ctx, width, groundY, surface, waterTime(), true)

}


let profileFrames = 0
let profileUpdate = 0
let profileRender = 0
let profileStart = performance.now()

function frame(time: number): void {
    if (!balloonViewActive || document.hidden) {
        lastTime = 0
        requestAnimationFrame(frame)
        return
    }
    if (lastTime === 0) lastTime = time

    const dt = Math.min((time - lastTime) / 1000, 1 / 30)
    lastTime = time

    const t0 = performance.now()
    updateBreeze(dt)
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

function canvasPosition(
    event: PointerEvent
): { x: number, y: number } {
    const rect = canvas.getBoundingClientRect()

    return {
        x: (event.clientX - rect.left) * width / rect.width,
        y: (event.clientY - rect.top) * height / rect.height
    }
}

canvas.addEventListener('contextmenu', event => event.preventDefault())

let runAudioInit = true
const basketDrags = new Map<number, { x: number, y: number }>()

canvas.addEventListener('pointerdown', event => {
    if (runAudioInit) {
        runAudioInit = false
        unlockAudio(true)
    } else {
        unlockAudio()
    }
    event.preventDefault()
    if (resetting) return

    const { x, y } = canvasPosition(event)

    for (let i = balloons.length - 1; i >= 0; i--) {
        const balloon = balloons[i]
        if (!containsPoint(balloon, x, y)) continue
        // A balloon being inflated by another pointer is not popped.
        if (balloon.pointerId !== null) return
        if (balloon.finish === 'hot-air' && containsBasketPoint(balloon, x, y)) {
            balloon.pointerId = event.pointerId
            balloon.growing = false
            balloon.anchorX = balloon.x
            balloon.anchorY = balloon.y
            basketDrags.set(event.pointerId, { x, y })
            activePointers.set(event.pointerId, balloon)
            canvas.setPointerCapture(event.pointerId)
            return
        }
        if ((balloon.finish === 'apple' || balloon.finish === 'duck')) {
            if (balloon.finish === 'duck') playDuckCall(balloon.duckVariant === 'goose')
            sampleAppleDrag(balloon, x, y, event.timeStamp)
            balloon.pointerId = event.pointerId
            balloon.anchorX = balloon.x
            balloon.anchorY = balloon.y
            activePointers.set(event.pointerId, balloon)
            canvas.setPointerCapture(event.pointerId)
            return
        }
        popWithForce(balloons, balloon)
        return
    }

    const finish = themeManager.finishForPointer()
    const balloon: Balloon = {
        pointerId: event.pointerId,
        x,
        y,
        vx: 0,
        vy: 0,
        anchorX: x,
        anchorY: y,
        radius: finish === "duck" ? (isMobile ? 30 : 42) : finish === "apple" ? (isMobile ? 23 : 30) : finish === "watermelon" ? (isMobile ? 30 : 42) : balloonConfig.initialRadius,
        color: themeManager.randomBalloonColor(finish),
        panelColors: getRandomPanelColors(themeManager.current.theme, Math.max(1, Math.floor(Math.random() * 5))),
        finish,
        angle: (finish === "hot-air" || finish === "duck") ? 0 : Math.random() * Math.PI * 2,
        angularVelocity: 0,
        growing: finish !== "apple",
        popped: false,
        popTime: 0
    }


    if (balloon.finish === "duck") Object.assign(balloon, randomDuckAppearance())
    const maxSize = maximumRadius(width, groundY, balloonConfig)
    const room = availableRadius(balloon, balloons, width, groundY, balloonConfig)
    const minimum = Math.min(balloonConfig.minRadius ?? balloonConfig.initialRadius, maxSize)
    if (room < minimum || maxSize <= 0) return
    balloon.radius = Math.max(minimum, Math.min(balloon.radius, maxSize, room))
    if ((balloon.finish === "apple" || balloon.finish === "duck")) sampleAppleDrag(balloon, x, y, event.timeStamp)
    balloons.push(balloon)
    syncGround()
    activePointers.set(event.pointerId, balloon)
    canvas.setPointerCapture(event.pointerId)
    if (activePointers.size === 1 && balloon.finish !== "watermelon" && balloon.finish !== "apple" && balloon.finish !== "duck") startInflateSound(balloon.finish)
    updateCounter()
})

canvas.addEventListener('pointermove', event => {
    const balloon = activePointers.get(event.pointerId)
    try {
        if (!balloon || balloon.popped) return
        const { x, y } = canvasPosition(event)
        const drag = basketDrags.get(event.pointerId)
        if (drag) {
            moveHotAirAssembly(balloon, x - drag.x, y - drag.y)
            drag.x = x
            drag.y = y
            return
        }
        if ((balloon.finish === "apple" || balloon.finish === "duck")) sampleAppleDrag(balloon, x, y, event.timeStamp)
        balloon.anchorX = x
        balloon.anchorY = y
    } catch {
        if (balloon) {
            balloon.anchorX = screenX / 2
            balloon.anchorY = screenY / 2
        }
    }

})

function releaseBalloon(pointerId: number, time = performance.now()): void {
    const basketDrag = basketDrags.delete(pointerId)
    const balloon = activePointers.get(pointerId)
    if (!balloon) return
    activePointers.delete(pointerId)
    balloon.pointerId = null
    balloon.growing = false

    if ((balloon.finish === "apple" || balloon.finish === "duck")) releaseAppleThrow(balloon, time)
    if (!balloon.popped && !basketDrag && balloon.finish !== "apple" && balloon.finish !== "duck") {
        const angle = Math.random() * Math.PI * 2
        const { releaseImpulse } = getPhysicsOptions(balloon, balloonConfig)
        const impulse = Math.max(releaseImpulse / 2, releaseImpulse * (0.9 + Math.random() * 0.5))
        balloon.vx += Math.cos(angle) * impulse
        balloon.vy += Math.sin(angle) * impulse
        balloon.angularVelocity += (Math.random() - 0.5) * 0.5
    }
    if (activePointers.size === 0) stopInflateSound()
}

let lastInflating = false
let lastInflateFinish: BalloonFinish | null = null

function syncInflateSound(): void {
    const balloon = balloons.find(
        balloon =>
            balloon.finish !== "watermelon" && balloon.finish !== "apple" && balloon.finish !== "duck" &&
            balloon.growing &&
            !balloon.popped &&
            balloon.pointerId !== null
    )

    const finish = balloon?.finish ?? 'latex'
    const inflating = !!balloon && !document.hidden

    if (
        inflating === lastInflating &&
        (!inflating || finish === lastInflateFinish)
    ) {
        return
    }

    lastInflating = inflating
    lastInflateFinish = inflating ? finish : null

    if (inflating) {
        startInflateSound(finish)
    }
    else {
        stopInflateSoundFactory()()
    }
}

function stopInflateSoundFactory() {
    return () => {
        stopBurnerSound()
        stopInflateSound(activePointers)
    }
}


canvas.addEventListener('pointerup', event => {
    const apple = activePointers.get(event.pointerId)
    if (apple && (apple.finish === 'apple' || apple.finish === 'duck')) {
        const { x, y } = canvasPosition(event)
        sampleAppleDrag(apple, x, y, event.timeStamp)
    }
    releaseBalloon(event.pointerId, event.timeStamp)
})
canvas.addEventListener('pointercancel', event => releaseBalloon(event.pointerId))
canvas.addEventListener('lostpointercapture', event => releaseBalloon(event.pointerId))

// Backgrounding
window.addEventListener('blur', stopInflateSoundFactory())
window.addEventListener('pagehide', stopInflateSoundFactory())

document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        stopInflateSoundFactory()()
    }
})

window.addEventListener('resize', resize)
window.visualViewport?.addEventListener(
    'resize',
    resize
)
const resetButton = document.getElementById('reset')
if (resetButton) bindActivation(resetButton, resetBalloons)
const sketchLink = document.querySelector<HTMLAnchorElement>('.sketch-button')
if (sketchLink) bindActivation(sketchLink)
// background.addEventListener('load', drawBackground)
// background.src = '/bg.png'
setupWorkspace({
    setAuto() { themeManager.setMode('auto') },
    setSimpleMode(enabled) { themeManager.setSimpleMode(enabled) },
    showBalloons(active) {
        if (!active) {
            for (const pointerId of [...activePointers.keys()]) {
                releaseBalloon(pointerId)
                if (canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId)
            }
            stopInflateSound()
            stopBurnerSound()
            lastInflating = false
            lastInflateFinish = null
        }
        balloonViewActive = active
        lastTime = 0
        profileStart = performance.now()
        profileFrames = profileUpdate = profileRender = 0
        if (active) resize()
    },
    async setBackground(url) {
        customBackground = url
        await background.setBackground(url ?? themeManager.current.theme.background)
    }
})
resize()
updateCounter()
requestAnimationFrame(frame)
