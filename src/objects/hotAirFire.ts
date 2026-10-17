import type { Balloon, BalloonConfig } from './balloonTypes'
import type { PhysicsOptions } from './physicsOptions'
import { getPhysicsOptions } from './objectDefinitions'
import { ensureSuspendedBasket } from './hotAirBalloon'

export interface HotAirFireState {
    elapsed: number
    phase: number
    detached: boolean
    removed: boolean
}

export function shouldIgniteHotAir(balloon: Balloon, physics: Readonly<PhysicsOptions>): boolean {
    if (balloon.popped || !balloon.suspension || !balloon.burner?.active || balloon.burner.intensity < 0.1) return false
    const angle = balloon.suspension.angle - balloon.angle
    return Math.abs(Math.atan2(Math.sin(angle), Math.cos(angle))) >= physics.ignitionAngle
}

/** Called by the common pop lifecycle for both a tap and a tipped burner. */
export function igniteHotAir(balloon: Balloon): void {
    if (balloon.fire) return
    ensureSuspendedBasket(balloon, getPhysicsOptions(balloon))
    balloon.fire = { elapsed: 0, phase: Math.random() * Math.PI * 2, detached: false, removed: false }
    if (balloon.burner) {
        balloon.burner.active = false
        balloon.burner.intensity = 0
    }
    balloon.vy = Math.max(70, balloon.vy)
    balloon.angularVelocity += (Math.random() - 0.5) * 0.8
}

export function updateHotAirFire(
    balloon: Balloon, dt: number, width: number, height: number, config: BalloonConfig
): void {
    const fire = balloon.fire
    const basket = balloon.suspension
    if (!fire || fire.removed || dt <= 0) return
    const physics = getPhysicsOptions(balloon, config)
    const steps = Math.max(1, Math.ceil(Math.min(dt, 0.1) * 60))
    const h = Math.min(dt, 0.1) / steps
    for (let i = 0; i < steps; i++) {
        fire.elapsed += h
        const wind = Math.sin(fire.elapsed * 1.3 + fire.phase) * physics.fireWind
            + Math.sin(fire.elapsed * 3.7 + fire.phase) * physics.fireWind * 0.3
        balloon.vx = (balloon.vx + wind * h) * Math.exp(-0.65 * h)
        balloon.vy = (balloon.vy + physics.fireGravity * h) * Math.exp(-0.18 * h)
        balloon.x += balloon.vx * h
        balloon.y += balloon.vy * h
        balloon.angularVelocity *= Math.exp(-0.5 * h)
        balloon.angle += (balloon.angularVelocity + Math.sin(fire.elapsed * 4 + fire.phase) * 0.12) * h
        // Detached debris falls freely through the bottom, without live-object collisions.
        if (basket) {
            if (!fire.detached && fire.elapsed >= physics.basketDetachDelay) {
                fire.detached = true
                basket.vy = Math.max(basket.vy, balloon.vy + 70)
                basket.angularVelocity += Math.sin(fire.phase) * 2
            }
            if (fire.detached) {
                basket.vx = (basket.vx + wind * 0.2 * h) * Math.exp(-0.2 * h)
                basket.vy += physics.basketGravity * h
                basket.x += basket.vx * h
                basket.y += basket.vy * h
                basket.angle += basket.angularVelocity * h
            } else {
                const offset = balloon.radius * (1.18 + physics.suspensionLengthRatio + 0.095)
                basket.x = balloon.x - Math.sin(balloon.angle) * offset
                basket.y = balloon.y + Math.cos(balloon.angle) * offset
                basket.angle = balloon.angle
                basket.vx = balloon.vx
                basket.vy = balloon.vy
            }
        }
        const bothBelow = balloon.y - balloon.radius * 2 > height
            && (!basket || basket.y - balloon.radius > height)
        fire.removed = bothBelow || fire.elapsed >= physics.fireMaxDuration
        // Keep drifting artwork near the viewport until it falls below it.
        balloon.x = Math.max(-balloon.radius * 2, Math.min(width + balloon.radius * 2, balloon.x))
    }
}

interface EnvelopeSprite {
    canvas: HTMLCanvasElement
    sourceX: number
    sourceY: number
    sourceWidth: number
    sourceHeight: number
    radius: number
    left: number
    top: number
    width: number
    height: number
}

const fireFrames: HTMLCanvasElement[] = []
function fireSprite(frame: number): HTMLCanvasElement {
    if (fireFrames[frame]) return fireFrames[frame]
    const canvas = document.createElement('canvas')
    canvas.width = 96
    canvas.height = 160
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Unable to create fire sprite')
    const sway = Math.sin(frame * Math.PI / 4) * 11
    const curl = Math.cos(frame * Math.PI / 4) * 7
    const gradient = ctx.createLinearGradient(0, 154, 0, 0)
    gradient.addColorStop(0, 'rgba(255,220,96,0.9)')
    gradient.addColorStop(0.25, '#ffb52e')
    gradient.addColorStop(0.6, 'rgba(255,87,12,0.85)')
    gradient.addColorStop(1, 'rgba(218,46,6,0)')
    ctx.fillStyle = gradient
    // Three uneven tongues curl and split independently across eight cached frames.
    ctx.beginPath()
    ctx.moveTo(48, 156)
    ctx.bezierCurveTo(9, 159, 3, 125, 22, 100)
    ctx.bezierCurveTo(30, 86, 17 + curl, 78, 22 + curl, 58)
    ctx.bezierCurveTo(34, 76, 39, 79, 35, 102)
    ctx.bezierCurveTo(57, 83, 30 + sway, 47, 48 + sway, 5)
    ctx.bezierCurveTo(45 + sway, 51, 79, 63, 59, 106)
    ctx.bezierCurveTo(74, 98, 61, 82, 78 + curl, 65)
    ctx.bezierCurveTo(69, 99, 98, 114, 82, 140)
    ctx.bezierCurveTo(74, 154, 60, 157, 48, 156)
    ctx.fill()
    const core = ctx.createLinearGradient(0, 156, 0, 66)
    core.addColorStop(0, '#fffbe0')
    core.addColorStop(0.4, '#ffe78b')
    core.addColorStop(1, 'rgba(255,193,52,0)')
    ctx.fillStyle = core
    ctx.beginPath()
    ctx.moveTo(32, 150)
    ctx.bezierCurveTo(21, 130, 44, 119, 39, 96)
    ctx.bezierCurveTo(50, 105, 43, 113, 48, 119)
    ctx.bezierCurveTo(61, 103, 47, 85, 55 + sway * 0.4, 66)
    ctx.bezierCurveTo(53, 107, 77, 124, 65, 146)
    ctx.bezierCurveTo(58, 159, 40, 158, 32, 150)
    ctx.fill()
    fireFrames[frame] = canvas
    return canvas
}

/** Continuous sheared strips share edge positions, avoiding staircase-shaped ripples. */
export function drawBurningEnvelope(ctx: CanvasRenderingContext2D, balloon: Balloon, sprite: EnvelopeSprite): void {
    const fire = balloon.fire
    if (!fire || fire.removed) return
    const r = balloon.radius
    const collapse = Math.min(1, fire.elapsed / 5)
    const scale = r / sprite.radius
    ctx.save()
    ctx.translate(balloon.x, balloon.y)
    ctx.rotate(balloon.angle)
    ctx.scale(1 - collapse * 0.5, 1 - collapse * 0.2)
    ctx.globalAlpha = 1 - collapse * 0.25
    ctx.imageSmoothingEnabled = true
    const bands = 24
    const bandHeight = sprite.height * scale / bands
    const amplitude = r * (0.025 + collapse * 0.055)
    const phase = fire.elapsed * 8 + fire.phase
    const sourceBandHeight = sprite.sourceHeight / bands
    for (let i = 0; i < bands; i++) {
        const y = sprite.top * scale + bandHeight * i
        const startOffset = Math.sin(phase + i / bands * 10.8) * amplitude
        const endOffset = Math.sin(phase + (i + 1) / bands * 10.8) * amplitude
        const shear = (endOffset - startOffset) / bandHeight
        const translation = startOffset - shear * y
        // Adjacent strips meet at the same offset. A half-texel overlap hides
        // antialiasing seams and samples the matching rows, rather than stretching them.
        const sourceY = sprite.sourceHeight * i / bands
        const sourceHeight = Math.min(sourceBandHeight + 0.5, sprite.sourceHeight - sourceY)
        ctx.transform(1, 0, shear, 1, translation, 0)
        ctx.drawImage(sprite.canvas,
            sprite.sourceX, sprite.sourceY + sourceY,
            sprite.sourceWidth, sourceHeight,
            sprite.left * scale, y,
            sprite.width * scale, sourceHeight / sprite.sourceHeight * sprite.height * scale)
        ctx.transform(1, 0, -shear, 1, -translation, 0)
    }
    ctx.restore()
    // Fire trails upward in world space, rather than rotating rigidly with the fabric.
    const ec = Math.cos(balloon.angle), es = Math.sin(balloon.angle)
    const stretch = 1 + Math.min(0.7, Math.max(0, balloon.vy) / 700)
    for (let i = 0; i < 5; i++) {
        const phase = fire.elapsed * 16 + fire.phase + i * 1.7
        const frame = Math.floor(phase) % 8
        const localX = (i - 2) * r * 0.22 * (1 - collapse * 0.5)
        const localY = r * (0.88 - (i % 3) * 0.24) * (1 - collapse * 0.2)
        const x = balloon.x + localX * ec - localY * es
        const y = balloon.y + localX * es + localY * ec
        const size = r * (0.34 + Math.sin(phase * 0.73) * 0.07)
        const lean = Math.max(-0.55, Math.min(0.55, balloon.vx / 250 + Math.sin(phase * 0.4) * 0.12))
        ctx.save()
        ctx.translate(x, y)
        ctx.transform(1, 0, lean, 1, 0, 0)
        ctx.globalAlpha = 0.82 + Math.sin(phase) * 0.12
        ctx.drawImage(fireSprite(frame), -size / 2, -size * 2.1 * stretch, size, size * 2.1 * stretch)
        ctx.restore()
    }
}
