import { stopInflateSound } from "./audio"

export interface Balloon {
    pointerId: number | null

    x: number
    y: number

    vx: number
    vy: number

    anchorX: number
    anchorY: number

    radius: number
    color: string

    angle: number
    angularVelocity: number

    growing: boolean
    popped: boolean
    popTime: number
}

export interface BalloonConfig {
    initialRadius: number
    growthRate: number
    maxScreenRatio: number

    popAtMax: boolean
    popDuration: number

    damping: number
    anchorStrength: number
    collisionRestitution: number
    collisionPadding: number
}

export const defaultBalloonConfig: BalloonConfig = {
    initialRadius: 5,
    growthRate: 80,
    maxScreenRatio: 1 / 3,

    popAtMax: true,
    popDuration: 0.5,

    damping: 5,
    anchorStrength: 20,
    collisionRestitution: 0.15,
    collisionPadding: 2
}

const isControlled = (balloon: Balloon) =>
    balloon.pointerId !== null && balloon.growing


export function updateBalloon(
    balloon: Balloon,
    dt: number,
    viewportWidth: number,
    viewportHeight: number,
    config: BalloonConfig
): void {
    if (balloon.popped) {
        balloon.popTime += dt
        return
    }

    if (balloon.growing) {
        const maxRadius =
            Math.min(viewportWidth, viewportHeight) *
            config.maxScreenRatio /
            2

        balloon.radius +=
            config.growthRate * dt

        if (balloon.radius >= maxRadius) {
            balloon.radius = maxRadius

            if (config.popAtMax) {
                balloon.growing = false
                balloon.popped = true
                balloon.popTime = 0
                return
            }
        }
    }

    if (balloon.pointerId !== null) {
        const dx =
            balloon.anchorX - balloon.x

        const dy =
            balloon.anchorY - balloon.y

        balloon.vx +=
            dx *
            config.anchorStrength *
            dt

        balloon.vy +=
            dy *
            config.anchorStrength *
            dt
    }
}

export function drawBalloon(
    ctx: CanvasRenderingContext2D,
    balloon: Balloon
): void {
    if (balloon.popped) {
        drawPop(ctx, balloon)
        return
    }

    const r = balloon.radius
    const w = r * 0.78

    ctx.save()

    ctx.translate(balloon.x, balloon.y)
    ctx.rotate(balloon.angle)

    // Shadow applies to body + knot
    // ctx.shadowColor = 'rgba(0, 0, 0, 0.3)'
    // ctx.shadowBlur = r * 0.12
    // ctx.shadowOffsetX = r * 0.06
    // ctx.shadowOffsetY = r * 0.08

    // Body - full/rounded with a sharp taper near the knot

    ctx.beginPath()

    // Top center
    ctx.moveTo(0, -r)

    // Upper-right: quickly expands outward
    ctx.bezierCurveTo(
        w * 0.65, -r,
        w, -r * 0.62,
        w, -r * 0.20
    )

    // Right side: broad through the middle
    ctx.bezierCurveTo(
        w, r * 0.25,
        w * 0.82, r * 0.52,
        w * 0.55, r * 0.72
    )

    // Lower-right: long taper directly into neck
    ctx.bezierCurveTo(
        w * 0.35, r * 0.87,
        w * 0.14, r * 0.98,
        0, r
    )

    // Lower-left
    ctx.bezierCurveTo(
        -w * 0.14, r * 0.98,
        -w * 0.35, r * 0.87,
        -w * 0.55, r * 0.72
    )

    // Left side
    ctx.bezierCurveTo(
        -w * 0.82, r * 0.52,
        -w, r * 0.25,
        -w, -r * 0.20
    )

    // Upper-left
    ctx.bezierCurveTo(
        -w, -r * 0.62,
        -w * 0.65, -r,
        0, -r
    )

    ctx.closePath()

    ctx.fillStyle = balloon.color
    ctx.fill()

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)'
    ctx.lineWidth = Math.max(1, r * 0.025)
    ctx.stroke()

    ctx.fillStyle = balloon.color
    ctx.fill()

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.28)'
    ctx.lineWidth = Math.max(1, r * 0.025)
    ctx.stroke()

    // Knot - proportional to balloon
    const knotWidth = r * 0.14
    const knotHeight = r * 0.16

    ctx.beginPath()

    ctx.moveTo(0, r * 0.96)

    ctx.lineTo(
        -knotWidth,
        r + knotHeight
    )

    ctx.lineTo(
        knotWidth,
        r + knotHeight
    )

    ctx.closePath()

    ctx.fillStyle = balloon.color
    ctx.fill()

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.28)'
    ctx.lineWidth = Math.max(1, r * 0.025)
    ctx.stroke()

    // Don't shadow the highlight
    ctx.shadowColor = 'transparent'
    ctx.shadowBlur = 0
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = 0

    // Highlight
    ctx.beginPath()

    ctx.ellipse(
        -r * 0.27,
        -r * 0.32,
        r * 0.09,
        r * 0.22,
        -0.4,
        0,
        Math.PI * 2
    )

    ctx.fillStyle = 'rgba(255, 255, 255, 0.42)'
    ctx.fill()

    ctx.restore()
}

function drawPop(
    ctx: CanvasRenderingContext2D,
    balloon: Balloon
): void {
    const duration = 0.5
    const progress = Math.min(balloon.popTime / duration, 1)

    const size = balloon.radius * (0.8 + progress * 0.5)
    const inner = size * 0.3

    ctx.save()

    ctx.translate(balloon.x, balloon.y)
    ctx.globalAlpha = 1 - progress

    ctx.beginPath()

    ctx.moveTo(0, -size)
    ctx.lineTo(inner, -inner)
    ctx.lineTo(size, 0)
    ctx.lineTo(inner, inner)
    ctx.lineTo(0, size)
    ctx.lineTo(-inner, inner)
    ctx.lineTo(-size, 0)
    ctx.lineTo(-inner, -inner)

    ctx.closePath()

    ctx.fillStyle = '#ff3f3f'
    ctx.fill()

    ctx.restore()
}

export function containsPoint(
    balloon: Balloon,
    x: number,
    y: number
): boolean {
    if (balloon.popped) {
        return false
    }

    const rx = balloon.radius * 0.8
    const ry = balloon.radius

    const dx = x - balloon.x
    const dy = y - balloon.y

    return (
        (dx * dx) / (rx * rx) +
        (dy * dy) / (ry * ry)
    ) <= 1
}

export function popBalloon(balloon: Balloon): void {
    balloon.growing = false
    balloon.pointerId = null
    balloon.popped = true
    balloon.popTime = 0
}