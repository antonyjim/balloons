import type { PhysicsOptions } from "./physicsOptions"
import type { Balloon } from "./balloonTypes"
import type { PhysicsBody } from "./objectTypes"

export function drawHotAirVector(
    ctx: CanvasRenderingContext2D,
    balloon: Balloon
): void {
    const r = balloon.radius

    const colors = (
        balloon.panelColors?.length
            ? balloon.panelColors
            : [balloon.color]
    )
        .slice(0, 8)
        .map(enrichHotAirColor)

    const count = Math.max(
        1,
        Math.min(5, balloon.panelCount ?? colors.length)
    )

    const panelColors = Array.from(
        { length: count },
        (_, i) => colors[i % colors.length]
    )

    ctx.save()
    ctx.translate(balloon.x, balloon.y)
    ctx.rotate(balloon.angle)

    // Envelope silhouette
    traceClassicEnvelope(ctx, r)
    ctx.fillStyle = enrichHotAirColor(balloon.color)
    ctx.fill()

    // Each gore follows the balloon's curved profile.
    ctx.save()
    traceClassicEnvelope(ctx, r)
    ctx.clip()

    for (let i = 0; i < count; i++) {
        const left = -1 + 2 * i / count
        const right = -1 + 2 * (i + 1) / count

        traceClassicGore(ctx, r, left, right)

        ctx.fillStyle = panelColors[i]
        ctx.fill()
    }

    // Fine curved borders separate the colored gores.
    ctx.strokeStyle = 'rgba(40,28,38,0.55)'
    ctx.lineWidth = Math.max(0.8, r * 0.014)
    ctx.lineJoin = 'round'

    for (let i = 1; i < count; i++) {
        const t = -1 + 2 * i / count

        traceClassicSeam(ctx, r, t)
        ctx.stroke()
    }

    ctx.restore()

    // Outline
    traceClassicEnvelope(ctx, r)
    ctx.lineWidth = Math.max(1.3, r * 0.03)
    ctx.strokeStyle = 'rgba(40,28,38,0.8)'
    ctx.stroke()


    ctx.restore()
}

function drawBurnerFlame(
    ctx: CanvasRenderingContext2D,
    r: number,
    time: number
): void {
    const flicker =
        Math.sin(time * 19) * 0.12 +
        Math.sin(time * 31) * 0.06

    const height = r * (0.32 + flicker)
    const width = r * 0.075

    const y = -r * 0.135

    ctx.save()

    const gradient = ctx.createLinearGradient(
        0, y,
        0, y - height
    )

    gradient.addColorStop(0, '#5dbdff')
    gradient.addColorStop(0.28, '#fff6a0')
    gradient.addColorStop(0.65, '#ff9f1c')
    gradient.addColorStop(1, '#ff4d00')

    ctx.beginPath()
    ctx.moveTo(-width, y)

    ctx.quadraticCurveTo(
        -width * 1.5,
        y - height * 0.55,
        0,
        y - height
    )

    ctx.quadraticCurveTo(
        width * 1.3,
        y - height * 0.55,
        width,
        y
    )

    ctx.closePath()
    ctx.fillStyle = gradient
    ctx.fill()

    ctx.restore()
}

function traceClassicEnvelope(
    ctx: CanvasRenderingContext2D,
    r: number
): void {
    ctx.beginPath()

    ctx.moveTo(0, -r)

    // Wide, rounded crown
    ctx.bezierCurveTo(
        r * 0.63, -r * 1.04,
        r * 1.04, -r * 0.53,
        r * 0.94, r * 0.05
    )

    // Gradual inward sweep into throat
    ctx.bezierCurveTo(
        r * 0.88, r * 0.55,
        r * 0.36, r * 0.84,
        r * 0.25, r * 1.18
    )

    ctx.lineTo(-r * 0.25, r * 1.18)

    ctx.bezierCurveTo(
        -r * 0.36, r * 0.84,
        -r * 0.88, r * 0.55,
        -r * 0.94, r * 0.05
    )

    ctx.bezierCurveTo(
        -r * 1.04, -r * 0.53,
        -r * 0.63, -r * 1.04,
        0, -r
    )

    ctx.closePath()
}

/**
 * Normalized horizontal panel position.
 * -1 = left edge, 0 = center, 1 = right edge.
 *
 * The curve expands across the crown and contracts
 * toward the narrow lower throat.
 */
function traceClassicSeam(
    ctx: CanvasRenderingContext2D,
    r: number,
    t: number
): void {
    const a = Math.asin(Math.max(-1, Math.min(1, t)))
    const s = Math.sin(a)

    ctx.beginPath()
    ctx.moveTo(s * r * 0.10, -r)

    ctx.bezierCurveTo(
        s * r * 0.65, -r * 0.72,
        s * r * 0.97, -r * 0.10,
        s * r * 0.83, r * 0.38
    )

    ctx.bezierCurveTo(
        s * r * 0.69, r * 0.70,
        s * r * 0.29, r * 1.03,
        s * r * 0.22, r * 1.18
    )
}

function traceClassicGore(
    ctx: CanvasRenderingContext2D,
    r: number,
    left: number,
    right: number
): void {
    // Build two opposing seam curves as one closed region.
    // Using the canvas path API avoids Safari Path2D issues.

    const lx = Math.sin(Math.asin(left))
    const rx = Math.sin(Math.asin(right))

    ctx.beginPath()

    ctx.moveTo(lx * r * 0.10, -r)

    ctx.bezierCurveTo(
        lx * r * 0.65, -r * 0.72,
        lx * r * 0.97, -r * 0.10,
        lx * r * 0.83, r * 0.38
    )

    ctx.bezierCurveTo(
        lx * r * 0.69, r * 0.70,
        lx * r * 0.29, r * 1.03,
        lx * r * 0.22, r * 1.18
    )

    ctx.lineTo(rx * r * 0.22, r * 1.18)

    ctx.bezierCurveTo(
        rx * r * 0.29, r * 1.03,
        rx * r * 0.69, r * 0.70,
        rx * r * 0.83, r * 0.38
    )

    ctx.bezierCurveTo(
        rx * r * 0.97, -r * 0.10,
        rx * r * 0.65, -r * 0.72,
        rx * r * 0.10, -r
    )

    ctx.closePath()
}

function drawClassicBasket(
    ctx: CanvasRenderingContext2D,
    r: number
): void {
    // Basket
    const basketY = -r * 0.095
    const basketW = r * 0.37
    const basketH = r * 0.19

    ctx.beginPath()
    ctx.moveTo(-basketW * 0.55, basketY)
    ctx.lineTo(basketW * 0.55, basketY)
    ctx.lineTo(basketW * 0.46, basketY + basketH)
    ctx.quadraticCurveTo(
        0, basketY + basketH * 1.12,
        -basketW * 0.46, basketY + basketH
    )
    ctx.closePath()

    ctx.fillStyle = '#795032'
    ctx.fill()

    ctx.strokeStyle = '#49301e'
    ctx.lineWidth = Math.max(1, r * 0.02)
    ctx.stroke()
}

function enrichHotAirColor(color: string): string {
    const match = /^#([0-9a-f]{6})$/i.exec(color)
    if (!match) return color

    const hex = match[1]
    const r = parseInt(hex.slice(0, 2), 16) / 255
    const g = parseInt(hex.slice(2, 4), 16) / 255
    const b = parseInt(hex.slice(4, 6), 16) / 255

    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const delta = max - min

    let h = 0
    let s = 0
    let l = (max + min) / 2

    if (delta !== 0) {
        s = delta / (1 - Math.abs(2 * l - 1))

        switch (max) {
            case r:
                h = ((g - b) / delta) % 6
                break
            case g:
                h = (b - r) / delta + 2
                break
            default:
                h = (r - g) / delta + 4
        }

        h *= 60
        if (h < 0) h += 360
    }

    s = Math.min(1, s * 1.25)
    l = Math.max(0, l * 0.85)

    return `hsl(${h} ${s * 100}% ${l * 100}%)`
}


/** Draft deflation model; the live scene still uses Balloon's timed pop. */
export interface HotAirBalloon extends PhysicsBody {
    width: number
    height: number
    panelCount: number
    panelColors: string[]
    basketWidth: number
    basketHeight: number
    popped: boolean
    deflating: boolean
    deflateTime: number
    deflateDuration: number
    removed: boolean
}

export function popHotAirBalloon(balloon: HotAirBalloon): void {
    if (balloon.deflating || balloon.removed) return
    balloon.popped = true
    balloon.deflating = true
    balloon.deflateTime = 0
    balloon.deflateDuration = 2.5
    balloon.vy = Math.max(balloon.vy, 30)
    balloon.angularVelocity += (Math.random() - 0.5) * 1.5
}

export function updateHotAirBalloon(
    balloon: HotAirBalloon,
    dt: number,
    viewportWidth: number,
    viewportHeight: number,
    windTime: number
): void {
    if (balloon.removed) return
    if (balloon.deflating) {
        balloon.deflateTime += dt
        const wind =
            Math.sin(windTime * 0.8 + balloon.x * 0.01) * 18 +
            Math.sin(windTime * 2.3 + balloon.y * 0.02) * 6
        balloon.vx += wind * dt
        balloon.vy += 220 * dt
        balloon.vx *= Math.exp(-0.35 * dt)
        balloon.angularVelocity *= Math.exp(-0.7 * dt)
        balloon.angle += balloon.angularVelocity * dt
        balloon.x += balloon.vx * dt
        balloon.y += balloon.vy * dt
        balloon.angle += Math.sin(windTime * 3 + balloon.x * 0.02) * 0.002
        if (balloon.y - balloon.height > viewportHeight + 200) {
            balloon.removed = true
        }
        return
    }
    // Intact balloon behavior is handled by the shared physics in the live scene.
}

export const hotAirPhysics: Readonly<Partial<PhysicsOptions>> = {
    maxLean: 0.2, buoyancy: 180, maxSpeed: 650, releaseImpulse: 180
}

/** Independent rigid basket, connected to the envelope at two attachment points. */
export interface SuspendedBasket extends PhysicsBody {
    radius: number
}

export function ensureSuspendedBasket(balloon: Balloon, physics: Readonly<PhysicsOptions>): SuspendedBasket {
    const r = balloon.radius
    if (!balloon.suspension) {
        const offset = r * (1.18 + physics.suspensionLengthRatio + 0.095)
        balloon.suspension = {
            x: balloon.x - Math.sin(balloon.angle) * offset,
            y: balloon.y + Math.cos(balloon.angle) * offset,
            vx: balloon.vx, vy: balloon.vy,
            angle: balloon.angle, angularVelocity: balloon.angularVelocity,
            radius: r
        }
    }
    const basket = balloon.suspension
    if (basket.radius !== r) {
        const scale = r / basket.radius
        basket.x = balloon.x + (basket.x - balloon.x) * scale
        basket.y = balloon.y + (basket.y - balloon.y) * scale
        basket.radius = r
    }
    return basket
}

/** Four small steps keep the light basket stable during release impulses and dragging. */
export function updateHotAirSuspension(
    balloon: Balloon, dt: number, width: number, height: number,
    physics: Readonly<PhysicsOptions>
): void {
    if (dt <= 0 || balloon.popped) return
    const basket = ensureSuspendedBasket(balloon, physics)
    const r = balloon.radius
    const held = balloon.pointerId !== null
    const invMass = held ? 0 : 1
    const massRatio = Math.max(0.01, physics.basketMassRatio)
    const basketInvMass = 1 / massRatio
    const invInertia = invMass / (0.6 * r * r)
    const basketInvInertia = 12 / (massRatio * r * r * (0.37 ** 2 + 0.19 ** 2))
    const length = r * Math.sqrt(0.06 ** 2 + Math.max(0.05, physics.suspensionLengthRatio) ** 2)
    const steps = Math.max(1, Math.ceil(Math.min(dt, 0.1) / (1 / 120)))
    const h = Math.min(dt, 0.1) / steps
    const drag = Math.exp(-physics.basketDrag * h)
    const margin = r * physics.screenRadiusRatio
    const minX = Math.min(margin, width / 2), maxX = Math.max(width / 2, width - margin)
    const minY = Math.min(margin, height / 2), maxY = Math.max(height / 2, height - margin)
    const basketMargin = r * 0.23
    const basketMinX = Math.min(basketMargin, width / 2), basketMaxX = Math.max(width / 2, width - basketMargin)
    const basketMinY = Math.min(basketMargin, height / 2), basketMaxY = Math.max(height / 2, height - basketMargin)
    // Shared physics already advanced the envelope; substep that displacement here.
    if (!held) {
        balloon.x -= balloon.vx * Math.min(dt, 0.1)
        balloon.y -= balloon.vy * Math.min(dt, 0.1)
        balloon.angle -= balloon.angularVelocity * Math.min(dt, 0.1)
    }
    for (let step = 0; step < steps; step++) {
        const oldX = balloon.x, oldY = balloon.y, oldAngle = balloon.angle
        const oldBX = basket.x, oldBY = basket.y, oldBAngle = basket.angle
        if (!held) {
            balloon.x += balloon.vx * h
            balloon.y += balloon.vy * h
            balloon.angle += balloon.angularVelocity * h
        }
        basket.vy += physics.basketGravity * h
        basket.vx *= drag
        basket.vy *= drag
        basket.angularVelocity *= drag
        basket.x += basket.vx * h
        basket.y += basket.vy * h
        basket.angle += basket.angularVelocity * h
        for (let iteration = 0; iteration < 6; iteration++) {
            for (let side = -1; side <= 1; side += 2) {
                const ec = Math.cos(balloon.angle), es = Math.sin(balloon.angle)
                const bc = Math.cos(basket.angle), bs = Math.sin(basket.angle)
                const ex = side * r * 0.22 * ec - r * 1.18 * es
                const ey = side * r * 0.22 * es + r * 1.18 * ec
                const bx = side * r * 0.16 * bc + r * 0.095 * bs
                const by = side * r * 0.16 * bs - r * 0.095 * bc
                const dx = basket.x + bx - balloon.x - ex
                const dy = basket.y + by - balloon.y - ey
                const distance = Math.sqrt(dx * dx + dy * dy)
                // Ropes carry tension, allowing a basket to be pushed upward.
                if (distance <= length) continue
                const nx = dx / distance, ny = dy / distance
                const envelopeTorque = ex * ny - ey * nx
                const basketTorque = bx * ny - by * nx
                const weight = invMass + basketInvMass + envelopeTorque ** 2 * invInertia
                    + basketTorque ** 2 * basketInvInertia
                const correction = (distance - length) / weight
                balloon.x += nx * correction * invMass
                balloon.y += ny * correction * invMass
                balloon.angle += envelopeTorque * correction * invInertia
                basket.x -= nx * correction * basketInvMass
                basket.y -= ny * correction * basketInvMass
                basket.angle -= basketTorque * correction * basketInvInertia
            }
            // Screen bounds for both parts; constraints are re-solved on the next pass.
            balloon.x = Math.max(minX, Math.min(maxX, balloon.x))
            balloon.y = Math.max(minY, Math.min(maxY, balloon.y))
            basket.x = Math.max(basketMinX, Math.min(basketMaxX, basket.x))
            basket.y = Math.max(basketMinY, Math.min(basketMaxY, basket.y))
        }
        if (!held) {
            balloon.vx = (balloon.x - oldX) / h
            balloon.vy = (balloon.y - oldY) / h
            balloon.angularVelocity = Math.max(-physics.maxAngularSpeed,
                Math.min(physics.maxAngularSpeed, (balloon.angle - oldAngle) / h))
        }
        basket.vx = Math.max(-physics.maxSpeed, Math.min(physics.maxSpeed, (basket.x - oldBX) / h))
        basket.vy = Math.max(-physics.maxSpeed, Math.min(physics.maxSpeed, (basket.y - oldBY) / h))
        basket.angularVelocity = Math.max(-8, Math.min(8, (basket.angle - oldBAngle) / h))
    }
}

let basketSprite: HTMLCanvasElement | null = null

function getBasketSprite(): HTMLCanvasElement {
    if (basketSprite) return basketSprite
    const canvas = document.createElement('canvas')
    canvas.width = 96
    canvas.height = 60
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Unable to create basket sprite')
    ctx.setTransform(3, 0, 0, 3, 48, 30)
    drawClassicBasket(ctx, 64)
    basketSprite = canvas
    return canvas
}

/** One small raster image is shared by every basket, regardless of size or angle. */
export function drawSuspendedBasket(ctx: CanvasRenderingContext2D, balloon: Balloon): void {
    const basket = balloon.suspension
    if (!basket) return
    const r = balloon.radius
    const sprite = getBasketSprite()
    ctx.save()
    ctx.translate(basket.x, basket.y)
    ctx.rotate(basket.angle)
    drawBasketFlame(ctx, balloon)
    ctx.drawImage(sprite, -r * 0.25, -r * 0.15625, r * 0.5, r * 0.3125)
    ctx.restore()
}

const ropePositions = [-1, -0.33, 0.33, 1]

/** Draw rigging with its owner so later balloons occlude the entire assembly. */
export function drawHotAirRigging(ctx: CanvasRenderingContext2D, balloon: Balloon): void {
    const basket = balloon.suspension
    if (balloon.finish !== 'hot-air' || (balloon.popped && !balloon.fire) || balloon.fire?.detached || !basket) return
    const r = balloon.radius
    const ec = Math.cos(balloon.angle), es = Math.sin(balloon.angle)
    const bc = Math.cos(basket.angle), bs = Math.sin(basket.angle)
    ctx.save()
    ctx.strokeStyle = '#49352a'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    for (let i = 0; i < ropePositions.length; i++) {
        const side = ropePositions[i]
        ctx.moveTo(balloon.x + side * r * 0.22 * ec - r * 1.18 * es,
            balloon.y + side * r * 0.22 * es + r * 1.18 * ec)
        ctx.lineTo(basket.x + side * r * 0.16 * bc + r * 0.095 * bs,
            basket.y + side * r * 0.16 * bs - r * 0.095 * bc)
    }
    ctx.stroke()
    ctx.restore()
}

export function containsBasketPoint(balloon: Balloon, x: number, y: number): boolean {
    const basket = balloon.suspension
    if (!basket || balloon.popped) return false
    const dx = x - basket.x, dy = y - basket.y
    const cos = Math.cos(basket.angle), sin = Math.sin(basket.angle)
    return Math.abs(dx * cos + dy * sin) <= balloon.radius * 0.22
        && Math.abs(-dx * sin + dy * cos) <= balloon.radius * 0.12
}

/** Translate both parts together while keeping their current suspension pose. */
export function moveHotAirAssembly(balloon: Balloon, dx: number, dy: number): void {
    balloon.x += dx
    balloon.y += dy
    balloon.anchorX = balloon.x
    balloon.anchorY = balloon.y
    balloon.vx = balloon.vy = 0
    if (balloon.suspension) {
        balloon.suspension.x += dx
        balloon.suspension.y += dy
        balloon.suspension.vx = balloon.suspension.vy = 0
    }
}

export interface BurnerState {
    active: boolean
    remaining: number
    elapsed: number
    intensity: number
    phase: number
}

/** Independent timers stagger burners; weight compensation lets heavy baskets rise too. */
export function updateHotAirBurner(
    balloon: Balloon, dt: number, physics: Readonly<PhysicsOptions>,
    viewportHeight = 0, random: () => number = Math.random
): number {
    if (balloon.popped || dt <= 0) return 0
    const sample = (min: number, max: number): number => Math.max(0.1, min + random() * Math.max(0, max - min))
    const burner = balloon.burner ??= {
        active: false,
        remaining: sample(physics.burnerMinPause, physics.burnerMaxPause),
        elapsed: 0, intensity: 0, phase: random() * Math.PI * 2
    }
    const basket = balloon.suspension
    // Use the same padded basket bound as the suspension solver's floor contact.
    const grounded = viewportHeight > 0 && !!basket && !balloon.fire?.detached
        && basket.y + balloon.radius * 0.23 >= viewportHeight - 0.5
    if (grounded && !burner.active) burner.remaining = 0
    burner.remaining -= dt
    burner.elapsed += dt
    const canStart = grounded || viewportHeight <= 0
        || balloon.y >= viewportHeight * (1 - physics.burnerMaxAltitudeRatio)
    while (burner.remaining <= 0) {
        if (!burner.active && !canStart) {
            // Leave the expired pause ready for when the balloon descends again.
            burner.remaining = 0
            burner.elapsed = 0
            break
        }
        const overshoot = -burner.remaining
        burner.active = !burner.active
        burner.remaining += burner.active
            ? sample(physics.burnerMinDuration, physics.burnerMaxDuration)
            : sample(physics.burnerMinPause, physics.burnerMaxPause)
        burner.elapsed = overshoot
    }
    burner.intensity = burner.active
        ? Math.max(0, Math.min(1, burner.elapsed / 0.25, burner.remaining / 0.35))
        : 0
    const weight = physics.basketGravity * Math.max(0.01, physics.basketMassRatio)
    return burner.intensity * (Math.max(0, weight - physics.buoyancy)
        + physics.burnerLift * (1 + Math.max(0.01, physics.basketMassRatio)))
}

let glowSprite: HTMLCanvasElement | null = null
const flameSprites: HTMLCanvasElement[] = []

function getGlowSprite(): HTMLCanvasElement {
    if (glowSprite) return glowSprite
    const canvas = document.createElement('canvas')
    canvas.width = 222
    canvas.height = 231
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Unable to create burner glow')
    ctx.setTransform(1.5, 0, 0, 1.5, 110.4, 110.4)
    traceClassicEnvelope(ctx, 64)
    ctx.clip()
    const glow = ctx.createRadialGradient(0, 64, 0, 0, 36, 110)
    glow.addColorStop(0, 'rgba(255,245,166,0.95)')
    glow.addColorStop(0.3, 'rgba(255,177,55,0.65)')
    glow.addColorStop(0.7, 'rgba(255,131,25,0.22)')
    glow.addColorStop(1, 'rgba(255,126,20,0)')
    ctx.fillStyle = glow
    ctx.fillRect(-74, -74, 148, 154)
    glowSprite = canvas
    return canvas
}

/** Called in envelope-local coordinates, keeping its owner's stacking order. */
export function drawHotAirGlow(ctx: CanvasRenderingContext2D, balloon: Balloon): void {
    const burner = balloon.burner
    if (!burner || burner.intensity <= 0 || balloon.popped) return
    const r = balloon.radius
    const flicker = 0.92 + Math.sin(burner.elapsed * 23 + burner.phase) * 0.08
    ctx.save()
    ctx.globalAlpha = burner.intensity * flicker
    ctx.drawImage(getGlowSprite(), -r * 1.15, -r * 1.15, r * 2.3125, r * 2.40625)
    ctx.restore()
}

function drawBasketFlame(ctx: CanvasRenderingContext2D, balloon: Balloon): void {
    const burner = balloon.burner
    if (!burner || burner.intensity <= 0 || balloon.popped) return
    const frame = Math.floor(burner.elapsed * 14 + burner.phase) % 4
    let sprite = flameSprites[frame]
    if (!sprite) {
        sprite = document.createElement('canvas')
        sprite.width = 40
        sprite.height = 80
        const flame = sprite.getContext('2d')
        if (!flame) return
        flame.setTransform(2, 0, 0, 2, 20, 74)
        drawBurnerFlame(flame, 64, frame * 0.11)
        flameSprites[frame] = sprite
    }
    ctx.save()
    ctx.globalAlpha = burner.intensity
    ctx.drawImage(sprite, -balloon.radius * 0.15625, -balloon.radius * 0.578125,
        balloon.radius * 0.3125, balloon.radius * 0.625)
    ctx.restore()
}
