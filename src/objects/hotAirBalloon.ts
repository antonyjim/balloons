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

    // Subtle seam definition, not shiny highlights
    ctx.strokeStyle = 'rgba(0,0,0,0.16)'
    ctx.lineWidth = Math.max(0.6, r * 0.008)

    for (let i = 1; i < count; i++) {
        const t = -1 + 2 * i / count

        traceClassicSeam(ctx, r, t)
        ctx.stroke()
    }

    ctx.restore()

    // Outline
    traceClassicEnvelope(ctx, r)
    ctx.lineWidth = Math.max(1, r * 0.025)
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'
    ctx.stroke()

    // Lower structure
    drawClassicBasket(ctx, r)

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

    const y = r * 1.48

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
    // Tapered rigging section
    const topY = r * 1.18
    const bottomY = r * 1.53

    ctx.strokeStyle = '#49352a'
    ctx.lineWidth = Math.max(1, r * 0.027)

    for (const t of [-0.8, -0.27, 0.27, 0.8]) {
        ctx.beginPath()
        ctx.moveTo(t * r * 0.22, topY)
        ctx.lineTo(t * r * 0.16, bottomY)
        ctx.stroke()
    }

    // Top and bottom mounting bars
    ctx.beginPath()
    ctx.moveTo(-r * 0.24, topY)
    ctx.lineTo(r * 0.24, topY)
    ctx.moveTo(-r * 0.19, bottomY)
    ctx.lineTo(r * 0.19, bottomY)
    ctx.stroke()

    // Basket
    const basketY = r * 1.52
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

export const hotAirPhysics: Readonly<Partial<PhysicsOptions>> = { maxLean: 0.2 }
