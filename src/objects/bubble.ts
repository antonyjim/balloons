import type { PhysicsOptions } from "./physicsOptions"
import type { Balloon } from "./balloonTypes"

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
    ctx.arc(0, 0, r, 0, Math.PI * 2)

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


export const bubblePhysics: Readonly<Partial<PhysicsOptions>> = {}
