import type { Balloon, BalloonConfig } from './balloonTypes'
import type { PhysicsOptions } from './physicsOptions'
import { popWithForce } from '../physics'

interface MelonChunk {
    x: number; y: number; vx: number; vy: number; angle: number; spin: number; size: number
}
export interface WatermelonState {
    /** Stable sample in [0, 1), mapped to the configured toughness range. */
    toughness: number
    rollBias: number
    impacts: number
    grounded: boolean
    highestBottom: number
    chunks: MelonChunk[]
}
export const watermelonPhysics: Readonly<Partial<PhysicsOptions>> = {
    releaseImpulse: 0, collisionRadiusRatio: 0.9, collisionRestitution: 0.08,
    popImpulse: 1800, popRadiusMultiplier: 2.5
}
function stateFor(melon: Balloon): WatermelonState {
    return melon.watermelon ??= { toughness: Math.random(), rollBias: Math.random() < 0.5 ? -1 : 1,
        impacts: 0, grounded: false, highestBottom: melon.y + melon.radius * 0.85, chunks: [] }
}

export function getWatermelonToughness(melon: Balloon, physics: Readonly<PhysicsOptions>): number {
    return physics.watermelonToughnessMin + stateFor(melon).toughness
        * Math.max(0, physics.watermelonToughnessMax - physics.watermelonToughnessMin)
}

let watermelonArt: HTMLImageElement | null = null
let artReady = false
let artPromise: Promise<void> | null = null
export const watermelonSpriteRevision = (): number => artReady ? 1 : 0
export function preloadWatermelonArt(): Promise<void> {
    if (artPromise) return artPromise
    const image = new Image()
    image.src = '/textures/watermelon.png'
    artPromise = image.decode().then(() => { watermelonArt = image; artReady = true })
        .catch(error => { artPromise = null; throw error })
    return artPromise
}

export function drawWatermelon(ctx: CanvasRenderingContext2D, melon: Balloon): void {
    const r = melon.radius
    if (artReady && watermelonArt) {
        ctx.save()
        ctx.translate(melon.x, melon.y)
        ctx.rotate(melon.angle)
        ctx.drawImage(watermelonArt,
            watermelonArt.naturalWidth * 0.03, watermelonArt.naturalHeight * 0.085,
            watermelonArt.naturalWidth * 0.94, watermelonArt.naturalHeight * 0.85,
            -r, -r * 0.85, r * 2, r * 1.7)
        ctx.restore()
        return
    }
    ctx.save()
    ctx.translate(melon.x, melon.y)
    ctx.rotate(melon.angle)
    ctx.beginPath()
    ctx.ellipse(0, 0, r, r * 0.85, 0, 0, Math.PI * 2)
    const skin = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 0, 0, 0, r)
    skin.addColorStop(0, '#7ba83b')
    skin.addColorStop(0.6, '#39752d')
    skin.addColorStop(1, '#154a26')
    ctx.fillStyle = skin
    ctx.fill()
    ctx.save()
    ctx.clip()
    ctx.strokeStyle = '#a2ba55'
    ctx.lineWidth = r * 0.11
    for (let i = -2; i <= 2; i++) {
        const x = i * r * 0.35
        ctx.beginPath()
        ctx.moveTo(x * 0.65, -r)
        ctx.bezierCurveTo(x + r * 0.12, -r * 0.4, x - r * 0.18, r * 0.4, x * 0.6, r)
        ctx.stroke()
    }
    ctx.restore()
    ctx.strokeStyle = '#254c21'
    ctx.lineWidth = r * 0.025
    ctx.beginPath()
    ctx.ellipse(0, 0, r, r * 0.85, 0, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
}

export function updateWatermelon(
    melon: Balloon, dt: number, width: number, ground: number,
    physics: Readonly<PhysicsOptions>, objects: Balloon[]
): void {
    const state = stateFor(melon)
    if (melon.pointerId !== null) {
        const follow = 1 - Math.exp(-physics.anchorStrength * dt)
        melon.x += (melon.anchorX - melon.x) * follow
        melon.y += (melon.anchorY - melon.y) * follow
        melon.vx = melon.vy = 0
        state.grounded = false
        state.highestBottom = melon.y + melon.radius * 0.85
        return
    }
    state.highestBottom = Math.min(state.highestBottom, melon.y + melon.radius * 0.85)
    if (!state.grounded) melon.vy += physics.watermelonGravity * dt
    else {
        melon.vx *= Math.exp(-physics.watermelonRollingDrag * dt)
        if (Math.abs(melon.vx) < 1) melon.vx = 0
    }
    melon.x += melon.vx * dt
    melon.y += melon.vy * dt
    melon.angle += (melon.vx / Math.max(1, melon.radius)) * dt
    constrainWatermelon(melon, width, ground, physics, objects)
}

export function constrainWatermelon(
    melon: Balloon, width: number, ground: number, physics: Readonly<PhysicsOptions>, objects: Balloon[]
): void {
    if (melon.popped) return
    const state = stateFor(melon)
    const bottom = melon.radius * Math.sqrt(0.85 ** 2 * Math.cos(melon.angle) ** 2 + Math.sin(melon.angle) ** 2)
    const floor = Math.max(bottom, ground - bottom)
    const margin = Math.min(melon.radius, width / 2)
    if (melon.x < margin || melon.x > width - margin) melon.vx *= -0.3
    melon.x = Math.max(margin, Math.min(width - margin, melon.x))
    if (melon.y >= floor) {
        melon.y = floor
        // The collision pass can constrain twice in one frame; preserve a bounce
        // that already sent the melon upward on the first pass.
        if (melon.pointerId === null && melon.vy < 0) return
        const incoming = Math.max(0, melon.vy)
        const toughness = getWatermelonToughness(melon, physics)
        if (melon.pointerId === null && !state.grounded
            && ground - state.highestBottom >= ground * physics.watermelonBurstHeightRatio * toughness) {
            popWithForce(objects, melon)
            return
        }
        if (melon.pointerId === null && !state.grounded && incoming > 45) {
            state.impacts++
            // A slightly off-center landing sends a surviving melon rolling.
            if (state.impacts === 1) melon.vx += state.rollBias * Math.min(85, incoming * 0.18)
            melon.vy = -incoming * physics.watermelonBounce
            state.grounded = false
            state.highestBottom = ground
        } else {
            melon.vy = 0
            state.grounded = melon.pointerId === null
            state.highestBottom = ground
        }
    } else if (state.grounded && melon.y < floor - 1) {
        state.grounded = false
        state.highestBottom = melon.y + bottom
    } else if (state.grounded) {
        // Follow the changing support radius of an oval as it rolls.
        melon.y = floor
    }
}

export function smashWatermelon(melon: Balloon): void {
    const state = stateFor(melon)
    state.grounded = false
    state.chunks = Array.from({ length: 9 }, (_, i) => {
        const angle = Math.PI + Math.random() * Math.PI
        const speed = 120 + Math.random() * 260
        return { x: melon.x, y: melon.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 90,
            angle: i * 0.8, spin: (Math.random() - 0.5) * 10, size: melon.radius * (0.25 + Math.random() * 0.2) }
    })
}
export function updateWatermelonChunks(melon: Balloon, dt: number, width: number, ground: number, _config: BalloonConfig): void {
    for (const chunk of melon.watermelon?.chunks ?? []) {
        chunk.vy += 700 * dt
        chunk.x += chunk.vx * dt
        chunk.y += chunk.vy * dt
        chunk.angle += chunk.spin * dt
        if (chunk.y > ground - chunk.size * 0.4) {
            chunk.y = ground - chunk.size * 0.4
            if (chunk.vy > 0) chunk.vy *= -0.25
            chunk.vx *= Math.exp(-7 * dt)
            chunk.spin *= Math.exp(-7 * dt)
        }
    }
}
let chunkSprite: HTMLCanvasElement | null = null
export function drawWatermelonChunks(ctx: CanvasRenderingContext2D, melon: Balloon): void {
    if (!chunkSprite) {
        const canvas = document.createElement('canvas')
        canvas.width = canvas.height = 64
        const art = canvas.getContext('2d')
        if (!art) return
        art.beginPath()
        art.moveTo(32, 7)
        art.lineTo(59, 46)
        art.quadraticCurveTo(33, 65, 5, 46)
        art.closePath()
        art.fillStyle = '#287d36'
        art.fill()
        art.beginPath()
        art.moveTo(32, 9)
        art.lineTo(54, 44)
        art.quadraticCurveTo(32, 57, 10, 44)
        art.closePath()
        art.fillStyle = '#d7e5a0'
        art.fill()
        art.beginPath()
        art.moveTo(32, 10)
        art.lineTo(50, 42)
        art.quadraticCurveTo(32, 52, 14, 42)
        art.closePath()
        art.fillStyle = '#ed4860'
        art.fill()
        art.fillStyle = '#45272c'
        for (const [x, y] of [[30, 25], [24, 36], [39, 37]]) {
            art.beginPath(); art.ellipse(x, y, 1.5, 3, -0.2, 0, Math.PI * 2); art.fill()
        }
        chunkSprite = canvas
    }
    for (const chunk of melon.watermelon?.chunks ?? []) {
        ctx.save()
        ctx.globalAlpha = Math.max(0, Math.min(1, (1.8 - melon.popTime) / 0.5))
        ctx.translate(chunk.x, chunk.y)
        ctx.rotate(chunk.angle)
        ctx.drawImage(chunkSprite, -chunk.size / 2, -chunk.size / 2, chunk.size, chunk.size)
        ctx.restore()
    }
}
