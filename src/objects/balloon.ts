import { drawDuckFlight } from './duck'
import { drawBurningEnvelope } from './hotAirFire'
import { bubbleFrame, bubbleRadiusAt } from './bubble'
import { maximumRadius, availableRadius } from './sizeLimits'
import { SpriteAtlas } from './spriteAtlas'
import { drawSuspendedBasket, drawHotAirRigging, drawHotAirGlow, containsBasketPoint } from './hotAirBalloon'
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
        getObjectDefinition(balloon.finish).updatePopped?.(balloon, dt, viewportWidth, viewportHeight, config)
        return
    }

    if (balloon.growing && balloon.finish !== 'apple') {
        const maxRadius = maximumRadius(viewportWidth, viewportHeight, config)
        const growthLimit = Math.min(maxRadius, availableRadius(balloon, balloons, viewportWidth, viewportHeight, config))

        balloon.radius = Math.min(growthLimit, balloon.radius + config.growthRate * dt)

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
    sourceX: number
    sourceY: number
    sourceWidth: number
    sourceHeight: number
    radius: number
    color: string
    left: number
    top: number
    width: number
    height: number
}

const spriteCache = new Map<string, BalloonSprite>()
const atlas = new SpriteAtlas()
interface ObjectSprite {
    duckVariant: Balloon['duckVariant']
    bubbleFrame: number
    sprite: BalloonSprite
    revision: number
    finish: Balloon['finish']
    color: string
    panelCount: number | undefined
    panelColors: string[] | undefined
}
const objectSprites = new WeakMap<Balloon, ObjectSprite>()

function matchesAppearance(balloon: Balloon, cached: ObjectSprite): boolean {
    if (balloon.duckVariant !== cached.duckVariant) return false
    if (balloon.finish === 'bubble' && bubbleFrame(balloon) !== cached.bubbleFrame) return false
    if (balloon.finish !== cached.finish || balloon.color !== cached.color || balloon.panelCount !== cached.panelCount) return false
    const panels = balloon.panelColors
    if (!panels || !cached.panelColors) return panels === cached.panelColors
    if (panels.length !== cached.panelColors.length) return false
    for (let i = 0; i < panels.length; i++) if (panels[i] !== cached.panelColors[i]) return false
    return true
}
let cachedPixels = 0
const MAX_CACHED_PIXELS = 4 * 1024 * 1024

const SPRITE_RADIUS = 64
const SPRITE_SCALE = 1.5


export function drawBalloon(
    ctx: CanvasRenderingContext2D,
    balloon: Balloon
): void {
    if (balloon.popped && !balloon.fire) {
        const drawPopped = getObjectDefinition(balloon.finish).drawPopped
        if (drawPopped) drawPopped(ctx, balloon)
        else drawPop(ctx, balloon)
        return
    }

    // Reuse one high-resolution sprite while growing instead of creating every 4px size.
    const radius = SPRITE_RADIUS

    const finish = balloon.finish ?? 'latex'
    const definition = getObjectDefinition(finish)
    const previous = objectSprites.get(balloon)
    let sprite: BalloonSprite
    if (previous && previous.revision === (definition.spriteRevision?.() ?? 0) && matchesAppearance(balloon, previous)) {
        sprite = previous.sprite
    } else {
        const key = JSON.stringify([finish, definition.spriteKey(balloon), radius, definition.spriteRevision?.() ?? 0])
        let shared = spriteCache.get(key)
        if (!shared) {
            shared = createBalloonSprite(balloon, radius)
            spriteCache.set(key, shared)
            cachedPixels += shared.sourceWidth * shared.sourceHeight
            while (cachedPixels > MAX_CACHED_PIXELS && spriteCache.size > 1) {
                const oldestKey = spriteCache.keys().next().value!
                const oldest = spriteCache.get(oldestKey)!
                cachedPixels -= oldest.sourceWidth * oldest.sourceHeight
                spriteCache.delete(oldestKey)
            }
        }
        sprite = shared
        objectSprites.set(balloon, { duckVariant: balloon.duckVariant, sprite, bubbleFrame: bubbleFrame(balloon), revision: definition.spriteRevision?.() ?? 0, finish: balloon.finish, color: balloon.color,
            panelCount: balloon.panelCount, panelColors: balloon.panelColors?.slice() })
    }
    if (finish === 'hot-air') {
        drawHotAirRigging(ctx, balloon)
        drawSuspendedBasket(ctx, balloon)
    }
    if (balloon.fire) {
        drawBurningEnvelope(ctx, balloon, sprite)
        return
    }
    const scale = balloon.radius / sprite.radius

    ctx.save()
    ctx.translate(balloon.x, balloon.y)
    // Bubble reflections stay anchored to the light rather than snapping to
    // each collision normal or spinning with rigid-body angular impulses.
    ctx.rotate(finish === 'bubble' ? 0 : balloon.angle)
    if (finish === 'duck') {
        const press = balloon.duckPress ?? 0
        ctx.scale(1 - press * 0.08, 1 - press * 0.16)
        if (press > 0.01) {
            ctx.shadowColor = `rgba(255,239,155,${press * 0.85})`
            ctx.shadowBlur = balloon.radius * 0.4 * press
        }
    }
    ctx.drawImage(
        sprite.canvas,
        sprite.sourceX, sprite.sourceY, sprite.sourceWidth, sprite.sourceHeight,
        sprite.left * scale,
        sprite.top * scale,
        sprite.width * scale,
        sprite.height * scale
    )
    if (finish === 'hot-air') drawHotAirGlow(ctx, balloon)
    ctx.restore()
    if (finish === 'duck') drawDuckFlight(ctx, balloon)
}

function createBalloonSprite(balloon: Balloon, radius: number): BalloonSprite {
    // Margin includes the knot and antialiased stroke.
    const finish = balloon.finish ?? 'latex'

    const left = -radius * 1.15
    const top = -radius * 1.15
    const width = radius * 2.3

    const height = radius * getObjectDefinition(finish).spriteHeight

    const region = atlas.allocate(Math.ceil(width * SPRITE_SCALE), Math.ceil(height * SPRITE_SCALE))
    const canvas = region.canvas
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Unable to create balloon sprite')

    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.beginPath()
    ctx.rect(region.x, region.y, region.width, region.height)
    ctx.clip()
    ctx.setTransform(
        SPRITE_SCALE, 0, 0, SPRITE_SCALE,
        region.x - left * SPRITE_SCALE,
        region.y - top * SPRITE_SCALE
    )

    // Draw once at the bucket radius, centered around the local origin.
    getObjectDefinition(finish).draw(ctx, {
        ...balloon,
        x: 0,
        y: 0,
        angle: 0,
        radius
    })

    ctx.restore()
    return { canvas, sourceX: region.x, sourceY: region.y,
        sourceWidth: region.width, sourceHeight: region.height,
        radius, color: balloon.color, left, top, width, height }
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

    if (balloon.finish === 'bubble') {
        const dx = x - balloon.x, dy = y - balloon.y
        return Math.hypot(dx, dy) <= bubbleRadiusAt(balloon, Math.atan2(dy, dx))
    }
    if (balloon.finish === 'hot-air' && containsBasketPoint(balloon, x, y)) return true
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
    if (balloon.popped || (balloon.finish === 'apple' || balloon.finish === 'duck')) return
    playPopSound(balloon.finish)
    balloon.growing = false
    balloon.pointerId = null
    balloon.popped = true
    balloon.popTime = 0
    getObjectDefinition(balloon.finish).onPop?.(balloon)
}


export function isBalloonFinished(balloon: Balloon, config: BalloonConfig): boolean {
    if ((balloon.finish === 'apple' || balloon.finish === 'duck')) return balloon.apple?.exited ?? false
    if (!balloon.popped) return false
    const definition = getObjectDefinition(balloon.finish)
    return definition.isFinished ? definition.isFinished(balloon) : balloon.popTime >= config.popDuration
}
