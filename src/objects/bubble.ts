import type { PhysicsOptions } from "./physicsOptions"
import type { Balloon } from "./balloonTypes"

export interface BubbleMotion { time: number; impact: number; direction: number }
export function updateBubbleMotion(bubble: Balloon, dt: number): void {
    const motion = bubble.bubbleMotion ??= { time: (bubble.x + bubble.y) * 0.01, impact: 0, direction: 0 }
    motion.time += dt
    motion.impact *= Math.exp(-3.5 * dt)
}
export function disturbBubble(bubble: Balloon, nx: number, ny: number, strength: number): void {
    if (bubble.finish !== 'bubble') return
    const motion = bubble.bubbleMotion ??= { time: 0, impact: 0, direction: 0 }
    motion.impact = Math.min(1, motion.impact + Math.max(0.15, strength / 250))
    motion.direction = Math.atan2(ny, nx)
}
/** A small shared set of raster frames avoids rebuilding every bubble each frame. */
export function bubbleFrame(bubble: Balloon): number {
    const motion = bubble.bubbleMotion
    const phase = Math.floor((motion?.time ?? 0) * 10) % 12
    const level = (motion?.impact ?? 0) > 0.5 ? 2 : (motion?.impact ?? 0) > 0.12 ? 1 : 0
    return level * 12 + phase
}

export function drawBubbleVector(
    ctx: CanvasRenderingContext2D,
    balloon: Balloon
): void {
    const r = balloon.radius

    ctx.save()

    const base = ctx.createRadialGradient(
        -r * 0.3, -r * 0.35, 0,
        0, 0, r
    )

    base.addColorStop(0, 'rgba(255,255,255,0.02)')
    base.addColorStop(0.65, 'rgba(180,225,255,0.05)')
    base.addColorStop(0.88, 'rgba(130,160,255,0.12)')
    base.addColorStop(1, 'rgba(255,140,210,0.35)')

    ctx.beginPath()
    for (let i = 0; i <= 64; i++) {
        const angle = i / 64 * Math.PI * 2
        const radius = bubbleRadiusAt(balloon, angle)
        const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
    }
    ctx.closePath()

    ctx.fillStyle = base
    ctx.fill()

    const rim = ctx.createLinearGradient(
        -r, -r, r, r
    )

    rim.addColorStop(0, 'rgba(110,220,255,0.8)')
    rim.addColorStop(0.3, 'rgba(210,150,255,0.65)')
    rim.addColorStop(0.6, 'rgba(255,160,190,0.7)')
    rim.addColorStop(1, 'rgba(120,255,220,0.65)')

    ctx.strokeStyle = rim
    ctx.lineWidth = Math.max(1.5, r * 0.035)
    ctx.stroke()

    // Upper-left specular highlight
    ctx.beginPath()
    ctx.ellipse(
        -r * 0.38,
        -r * 0.43,
        r * 0.10,
        r * 0.30,
        Math.PI / 4,
        0,
        Math.PI * 2
    )

    ctx.fillStyle = 'rgba(255,255,255,0.55)'
    ctx.fill()

    // Lower reflection
    ctx.beginPath()
    ctx.arc(
        0, 0,
        r * 0.82,
        Math.PI * 0.18,
        Math.PI * 0.43
    )

    ctx.strokeStyle = 'rgba(220,250,255,0.45)'
    ctx.lineWidth = r * 0.045
    ctx.stroke()

    ctx.restore()
}


/** Artwork, contacts, and touch picking share the same animated radial profile. */
export function bubbleRadiusAt(bubble: Balloon, angle: number): number {
    const frame = bubbleFrame(bubble)
    const phase = (frame % 12) / 12 * Math.PI * 2
    const amplitude = 0.012 + Math.floor(frame / 12) * 0.022
    return bubble.radius * (1 + amplitude * (Math.sin(angle * 3 + phase)
        + 0.4 * Math.sin(angle * 5 - phase)) + amplitude * Math.cos(angle * 2) * Math.sin(phase))
}

export const bubblePhysics: Readonly<Partial<PhysicsOptions>> = {
    collisionRadiusRatio: 1, collisionPadding: 0, screenRadiusRatio: 1.1
}
