import { playPopSound } from "./audio"

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
    initialRadius: 35,
    growthRate: 80,
    maxScreenRatio: 1 / 3,

    popAtMax: true,
    popDuration: 0.5,

    damping: 5,
    anchorStrength: 20,
    collisionRestitution: 0.15,
    collisionPadding: 2
}

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


}

type BalloonSprite = {
    canvas: HTMLCanvasElement
    radius: number
    color: string
    left: number
    top: number
    width: number
    height: number
}

const spriteCache = new Map<string, BalloonSprite>()

const SPRITE_BUCKET = 4
const SPRITE_SCALE = 1.5


export function drawBalloon(
    ctx: CanvasRenderingContext2D,
    balloon: Balloon
): void {
    if (balloon.popped) {
        drawPop(ctx, balloon)
        return
    }

    const radius = Math.max(
        SPRITE_BUCKET,
        Math.ceil(balloon.radius / SPRITE_BUCKET) * SPRITE_BUCKET
    )

    const key = `${balloon.color}:${radius}`

    let sprite = spriteCache.get(key)

    if (!sprite) {
        sprite = createBalloonSprite(balloon, radius)
        spriteCache.set(key, sprite)
    }

    const scale = balloon.radius / sprite.radius

    ctx.save()
    ctx.translate(balloon.x, balloon.y)
    ctx.rotate(balloon.angle)
    ctx.drawImage(
        sprite.canvas,
        sprite.left * scale,
        sprite.top * scale,
        sprite.width * scale,
        sprite.height * scale
    )
    ctx.restore()
}

function createBalloonSprite(balloon: Balloon, radius: number): BalloonSprite {
    // Margin includes the knot and antialiased stroke.
    const left = -radius * 1.05
    const top = -radius * 1.1
    const width = radius * 2.1
    const height = radius * 2.4

    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(width * SPRITE_SCALE)
    canvas.height = Math.ceil(height * SPRITE_SCALE)

    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Unable to create balloon sprite')

    ctx.setTransform(
        SPRITE_SCALE, 0, 0, SPRITE_SCALE,
        -left * SPRITE_SCALE,
        -top * SPRITE_SCALE
    )

    // Draw once at the bucket radius, centered around the local origin.
    drawBalloonVector(ctx, {
        ...balloon,
        x: 0,
        y: 0,
        angle: 0,
        radius
    })

    return { canvas, radius, color: balloon.color, left, top, width, height }
}

function drawBalloonVector(
    ctx: CanvasRenderingContext2D,
    balloon: Balloon
): void {
    const r = balloon.radius
    const w = r * 0.78
    const rgb = colorToRgb(ctx, balloon.color)

    ctx.save()
    ctx.translate(balloon.x, balloon.y)
    ctx.rotate(balloon.angle)

    // --------------------------------------------------
    // Balloon silhouette
    // --------------------------------------------------

    const body = new Path2D()

    body.moveTo(0, -r)

    body.bezierCurveTo(
        w * 0.65, -r,
        w, -r * 0.62,
        w, -r * 0.20
    )

    body.bezierCurveTo(
        w, r * 0.25,
        w * 0.82, r * 0.52,
        w * 0.55, r * 0.72
    )

    body.bezierCurveTo(
        w * 0.35, r * 0.87,
        w * 0.14, r * 0.98,
        0, r
    )

    body.bezierCurveTo(
        -w * 0.14, r * 0.98,
        -w * 0.35, r * 0.87,
        -w * 0.55, r * 0.72
    )

    body.bezierCurveTo(
        -w * 0.82, r * 0.52,
        -w, r * 0.25,
        -w, -r * 0.20
    )

    body.bezierCurveTo(
        -w, -r * 0.62,
        -w * 0.65, -r,
        0, -r
    )

    body.closePath()

    // --------------------------------------------------
    // Translucent base
    // --------------------------------------------------

    const base = ctx.createRadialGradient(
        -r * 0.18, -r * 0.28, r * 0.05,
        0, 0, r * 1.05
    )

    base.addColorStop(0, rgba(rgb, 0.12))
    base.addColorStop(0.45, rgba(rgb, 0.24))
    base.addColorStop(0.75, rgba(rgb, 0.52))
    base.addColorStop(1, rgba(rgb, 0.88))

    ctx.fillStyle = base
    ctx.fill(body)

    // All internal effects remain inside the balloon
    ctx.save()
    ctx.clip(body)

    // --------------------------------------------------
    // Dark lower-right interior reflection
    // --------------------------------------------------

    const shade = ctx.createRadialGradient(
        r * 0.34, r * 0.28, 0,
        r * 0.34, r * 0.28, r * 0.78
    )

    shade.addColorStop(0, 'rgba(10, 16, 24, 0.16)')
    shade.addColorStop(0.55, 'rgba(18, 20, 35, 0.06)')
    shade.addColorStop(1, 'rgba(0, 0, 0, 0)')


    ctx.fillStyle = shade
    ctx.fillRect(-r, -r, r * 2, r * 2.2)

    // --------------------------------------------------
    // Colored rim illumination
    // --------------------------------------------------

    const rim = ctx.createRadialGradient(
        -r * 0.12, -r * 0.12, r * 0.35,
        0, 0, r * 1.02
    )

    rim.addColorStop(0, 'rgba(255, 255, 255, 0)')
    rim.addColorStop(0.65, rgba(rgb, 0.02))
    rim.addColorStop(0.87, rgba(rgb, 0.22))
    rim.addColorStop(1, rgba(rgb, 0.55))

    ctx.fillStyle = rim
    ctx.fillRect(-r, -r, r * 2, r * 2.2)

    // --------------------------------------------------
    // Large irregular glossy reflection
    // --------------------------------------------------

    const reflection = new Path2D()

    reflection.moveTo(-r * 0.37, -r * 0.72)

    reflection.bezierCurveTo(
        -r * 0.52, -r * 0.66,
        -r * 0.55, -r * 0.35,
        -r * 0.47, -r * 0.07
    )

    reflection.bezierCurveTo(
        -r * 0.39, r * 0.10,
        -r * 0.28, r * 0.14,
        -r * 0.20, r * 0.06
    )

    reflection.bezierCurveTo(
        -r * 0.29, -r * 0.13,
        -r * 0.36, -r * 0.40,
        -r * 0.20, -r * 0.64
    )

    reflection.bezierCurveTo(
        -r * 0.26, -r * 0.72,
        -r * 0.32, -r * 0.75,
        -r * 0.37, -r * 0.72
    )

    reflection.closePath()

    const gloss = ctx.createLinearGradient(
        -r * 0.5, -r * 0.5,
        -r * 0.1, r * 0.1
    )

    gloss.addColorStop(0, 'rgba(255, 255, 255, 0.65)')
    gloss.addColorStop(0.35, 'rgba(255, 255, 255, 0.68)')
    gloss.addColorStop(1, 'rgba(255, 255, 255, 0.04)')

    ctx.fillStyle = gloss
    ctx.fill(reflection)

    // --------------------------------------------------
    // Soft glow around reflection
    // --------------------------------------------------

    const glow = ctx.createRadialGradient(
        -r * 0.32, -r * 0.38, 0,
        -r * 0.32, -r * 0.38, r * 0.48
    )

    glow.addColorStop(0, 'rgba(255, 255, 255, 0.22)')
    glow.addColorStop(0.5, 'rgba(255, 255, 255, 0.09)')
    glow.addColorStop(1, 'rgba(255, 255, 255, 0)')

    ctx.fillStyle = glow
    ctx.fillRect(-r, -r, r * 2, r * 2)

    // --------------------------------------------------
    // Secondary curved reflection on right edge
    // --------------------------------------------------

    ctx.beginPath()

    ctx.moveTo(r * 0.42, -r * 0.63)

    ctx.bezierCurveTo(
        r * 0.68, -r * 0.40,
        r * 0.71, r * 0.05,
        r * 0.48, r * 0.34
    )

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.40)'
    ctx.lineWidth = Math.max(1, r * 0.065)
    ctx.lineCap = 'round'
    ctx.stroke()

    // --------------------------------------------------
    // Lower internal colored reflection
    // --------------------------------------------------

    const lower = ctx.createRadialGradient(
        -r * 0.18, r * 0.48, 0,
        -r * 0.18, r * 0.48, r * 0.50
    )

    lower.addColorStop(0, 'rgba(255, 255, 255, 0.24)')
    lower.addColorStop(0.45, rgba(rgb, 0.18))
    lower.addColorStop(1, rgba(rgb, 0))

    ctx.fillStyle = lower
    ctx.fillRect(-r, 0, r * 2, r)

    ctx.restore()

    // --------------------------------------------------
    // Outline
    // --------------------------------------------------

    ctx.strokeStyle = rgba(rgb, 0.85)
    ctx.lineWidth = Math.max(1.2, r * 0.035)
    ctx.stroke(body)

    // Thin dark edge for definition
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.28)'
    ctx.lineWidth = Math.max(0.7, r * 0.012)
    ctx.stroke(body)

    // --------------------------------------------------
    // Knot
    // --------------------------------------------------

    const knotWidth = r * 0.14
    const knotHeight = r * 0.16

    const knot = new Path2D()

    knot.moveTo(0, r * 0.96)
    knot.lineTo(-knotWidth, r + knotHeight)
    knot.lineTo(knotWidth, r + knotHeight)
    knot.closePath()

    const knotGradient = ctx.createLinearGradient(
        -knotWidth, r,
        knotWidth, r + knotHeight
    )

    knotGradient.addColorStop(0, rgba(rgb, 0.95))
    knotGradient.addColorStop(0.5, rgba(rgb, 0.55))
    knotGradient.addColorStop(1, rgba(rgb, 0.95))

    ctx.fillStyle = knotGradient
    ctx.fill(knot)

    ctx.strokeStyle = rgba(rgb, 0.9)
    ctx.lineWidth = Math.max(1, r * 0.025)
    ctx.stroke(knot)

    ctx.restore()
}

function drawPop(
    ctx: CanvasRenderingContext2D,
    balloon: Balloon
): void {
    const duration = 0.5
    const progress = Math.min(balloon.popTime / duration, 1)

    if (progress >= 1) return

    const count = 35
    const fade = Math.pow(1 - progress, 1.5)

    ctx.save()
    ctx.translate(balloon.x, balloon.y)

    for (let i = 0; i < count; i++) {
        const angle = i * 2.399963229728653
        const random = (Math.sin(i * 127.1 + 78.233) * 43758.5453) % 1
        const variation = Math.abs(random)

        const distance =
            balloon.radius * (0.15 + variation * 0.65) +
            balloon.radius * progress * (0.3 + variation * 0.9)

        const x = Math.cos(angle) * distance
        const y = Math.sin(angle) * distance

        const size =
            Math.max(0.7, balloon.radius * (0.012 + variation * 0.035)) *
            (1 - progress * 0.6)

        ctx.globalAlpha = fade * (0.45 + variation * 0.55)
        ctx.fillStyle = '#ffffff'

        ctx.beginPath()
        ctx.arc(x, y, size, 0, Math.PI * 2)
        ctx.fill()
    }

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
    const cos = Math.cos(balloon.angle)
    const sin = Math.sin(balloon.angle)
    const localX = dx * cos + dy * sin
    const localY = -dx * sin + dy * cos

    return (
        (localX * localX) / (rx * rx) +
        (localY * localY) / (ry * ry)
    ) <= 1
}


function colorToRgb(
    colorCtx: CanvasRenderingContext2D,
    color: string): [number, number, number] {
    colorCtx.fillStyle = '#000000'
    colorCtx.fillStyle = color

    const hex = colorCtx.fillStyle

    if (hex.startsWith('#')) {
        const value = hex.slice(1)
        const expanded = value.length === 3
            ? value.split('').map(c => c + c).join('')
            : value

        const n = parseInt(expanded.slice(0, 6), 16)

        return [
            (n >> 16) & 255,
            (n >> 8) & 255,
            n & 255
        ]
    }

    const values = hex.match(/[\d.]+/g)?.map(Number) ?? []

    return [
        values[0] ?? 0,
        values[1] ?? 0,
        values[2] ?? 0
    ]
}

function rgba(
    rgb: [number, number, number],
    alpha: number
): string {
    return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`
}

export function popBalloon(balloon: Balloon): void {
    playPopSound()
    balloon.growing = false
    balloon.pointerId = null
    balloon.popped = true
    balloon.popTime = 0
}