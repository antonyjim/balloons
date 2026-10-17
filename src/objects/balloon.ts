import { playPopSound } from "../audio"
import { Balloon, BalloonConfig } from "./balloonTypes"
import { popWithForce } from "../physics"
import { getObjectDefinition } from "./objectDefinitions"


export const defaultBalloonConfig: BalloonConfig = {
    initialRadius: 35,
    growthRate: 80,
    maxScreenRatio: 1 / 3,

    popAtMax: false,
    popDuration: 0.5,

    damping: 5,
    anchorStrength: 20,
    collisionRestitution: 0.15,
    collisionPadding: 3
}

export function updateBalloon(
    balloon: Balloon,
    dt: number,
    viewportWidth: number,
    viewportHeight: number,
    config: BalloonConfig,
    balloons: Balloon[]
): void {
    if (balloon.popped) {
        balloon.popTime += dt
        return
    }

    if (balloon.growing) {
        const maxRadius =
            Math.min(viewportWidth, viewportHeight) *
            config.maxScreenRatio /
            3

        balloon.radius +=
            config.growthRate * dt

        if (balloon.radius >= maxRadius) {
            balloon.radius = maxRadius

            if (config.popAtMax || getObjectDefinition(balloon.finish).popAtMax) {
                // balloon.growing = false
                // balloon.popped = true
                // balloon.popTime = 0
                popWithForce(balloons, balloon)
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

    const finish = balloon.finish ?? 'latex'
    const definition = getObjectDefinition(finish)
    const key = JSON.stringify([finish, definition.spriteKey(balloon), radius])

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
    const finish = balloon.finish ?? 'latex'

    const left = -radius * 1.15
    const top = -radius * 1.15
    const width = radius * 2.3

    const height = radius * getObjectDefinition(finish).spriteHeight

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
    getObjectDefinition(finish).draw(ctx, {
        ...balloon,
        x: 0,
        y: 0,
        angle: 0,
        radius
    })

    return { canvas, radius, color: balloon.color, left, top, width, height }
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

    const rx = balloon.radius * (getObjectDefinition(balloon.finish).hitRadiusRatio ?? 0.8)
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


export function popBalloon(balloon: Balloon): void {
    if (balloon.popped) return
    playPopSound(balloon.finish)
    balloon.growing = false
    balloon.pointerId = null
    balloon.popped = true
    balloon.popTime = 0
    getObjectDefinition(balloon.finish).onPop?.(balloon)
}

