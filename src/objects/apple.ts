import type { Balloon } from './balloonTypes'
import type { PhysicsOptions } from './physicsOptions'

interface DragSample { x: number; y: number; time: number }
const drags = new WeakMap<Balloon, DragSample[]>()
export function sampleAppleDrag(apple: Balloon, x: number, y: number, time: number): void {
    const samples = drags.get(apple) ?? []
    if (samples.length && time <= samples[samples.length - 1].time) return
    samples.push({ x, y, time })
    // Estimate the gesture over a short window, so one tiny final movement
    // cannot erase a fast throw.
    while (samples.length > 2 && samples[0].time < time - 100) samples.shift()
    drags.set(apple, samples)
}

export function releaseAppleThrow(apple: Balloon, time: number): void {
    const samples = drags.get(apple)
    drags.delete(apple)
    apple.vx = apple.vy = 0
    if (!samples || samples.length < 2) return
    const first = samples[0], last = samples[samples.length - 1]
    if (time - last.time > 150) return
    const dt = (last.time - first.time) / 1000
    if (dt <= 0 || dt > 0.25) return
    const vx = (last.x - first.x) / dt, vy = (last.y - first.y) / dt
    const speed = Math.hypot(vx, vy)
    const scale = Math.min(1, (apple.physics?.maxSpeed ?? 2000) / Math.max(1, speed))
    apple.vx = vx * scale
    apple.vy = vy * scale
}

// Canvas artwork shares the hot-air balloon palette and outlined shapes.
export const appleSpriteRevision = (): number => 1
export function drawApple(ctx: CanvasRenderingContext2D, apple: Balloon): void {
    const r = apple.radius
    ctx.save()
    ctx.translate(apple.x, apple.y)
    ctx.rotate(apple.angle)
    const trace = (): void => {
        ctx.beginPath()
        ctx.moveTo(0, -r * 0.72)
        ctx.bezierCurveTo(-r * 0.55, -r * 1.08, -r * 1.12, -r * 0.58, -r * 0.94, r * 0.12)
        ctx.bezierCurveTo(-r * 0.8, r * 0.87, -r * 0.3, r * 1.04, 0, r * 0.86)
        ctx.bezierCurveTo(r * 0.3, r * 1.04, r * 0.8, r * 0.87, r * 0.94, r * 0.12)
        ctx.bezierCurveTo(r * 1.12, -r * 0.58, r * 0.55, -r * 1.08, 0, -r * 0.72)
        ctx.closePath()
    }
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    trace()
    ctx.fillStyle = '#ee514d'
    ctx.fill()
    ctx.save()
    trace()
    ctx.clip()
    ctx.beginPath()
    ctx.moveTo(r * 0.5, -r)
    ctx.bezierCurveTo(r * 0.95, r * 0.1, r * 0.35, r * 0.85, -r * 0.25, r)
    ctx.lineTo(r * 1.2, r)
    ctx.lineTo(r * 1.2, -r)
    ctx.closePath()
    ctx.fillStyle = '#cd3b43'
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(-r * 0.43, -r * 0.34, r * 0.14, r * 0.28, 0.45, 0, Math.PI * 2)
    ctx.fillStyle = '#ffb18c'
    ctx.fill()
    ctx.restore()
    trace()
    ctx.strokeStyle = 'rgba(40,28,38,0.8)'
    ctx.lineWidth = Math.max(1.3, r * 0.03)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(0, -r * 0.74)
    ctx.quadraticCurveTo(-r * 0.04, -r * 0.98, r * 0.12, -r * 1.05)
    ctx.strokeStyle = '#674333'
    ctx.lineWidth = r * 0.09
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(r * 0.04, -r * 0.87)
    ctx.quadraticCurveTo(r * 0.14, -r * 1.14, r * 0.49, -r * 1.02)
    ctx.quadraticCurveTo(r * 0.37, -r * 0.74, r * 0.04, -r * 0.87)
    ctx.fillStyle = '#77ad52'
    ctx.fill()
    ctx.strokeStyle = 'rgba(40,28,38,0.8)'
    ctx.lineWidth = Math.max(1, r * 0.025)
    ctx.stroke()
    ctx.restore()
}

export function updateApple(apple: Balloon, dt: number, width: number, ground: number, physics: Readonly<PhysicsOptions>): void {
    if (apple.pointerId !== null) {
        const follow = 1 - Math.exp(-physics.anchorStrength * dt)
        apple.x += (apple.anchorX - apple.x) * follow
        apple.y += (apple.anchorY - apple.y) * follow
        apple.vx = apple.vy = 0
    } else {
        if (apple.y >= ground - apple.radius - 1) apple.vx *= Math.exp(-physics.watermelonRollingDrag * dt)
        apple.vy += physics.watermelonGravity * dt
        apple.x += apple.vx * dt
        apple.y += apple.vy * dt
        if (apple.finish !== 'duck') apple.angle += apple.vx / Math.max(1, apple.radius) * dt
    }
    constrainApple(apple, width, ground, physics)
}

export function constrainApple(apple: Balloon, width: number, ground: number, physics: Readonly<PhysicsOptions>): void {
    // Side boundaries are open; retire the fruit only once its whole sprite has left.
    if (apple.finish !== 'duck' && (apple.x + apple.radius * 1.1 < 0 || apple.x - apple.radius * 1.1 > width)) {
        (apple.apple ??= { exited: false }).exited = true
    }
    const floor = ground - apple.radius
    if (apple.y >= floor) {
        apple.y = floor
        if (apple.vy > 45) apple.vy *= -0.3
        else if (apple.vy > 0) apple.vy = 0
    }
}
