import type { Balloon } from './objects/balloonTypes'

const CURRENT_SPEED = 28
let waveTime = 0
export function advanceWater(dt: number): void { waveTime += dt }
export function waterTime(): number { return waveTime }
export function waveHeight(x: number, time: number): number {
    return Math.sin((x - time * CURRENT_SPEED) * 0.035) * 3
        + Math.sin(x * 0.021 - time * 1.65) * 2
}

export function waterSurface(ground: number, objects: readonly Balloon[]): number | null {
    return objects.some(object => object.finish === 'duck' && !object.popped && !object.apple?.exited)
        ? Math.max(0, ground - Math.min(165, ground * 0.23)) : null
}

/** Ducks and apples float; dense fruit sinks through the water to the solid floor. */
export function applyWater(object: Balloon, surface: number | null, dt: number): void {
    if (object.finish === 'hot-air') {
        const bottom = object.suspension ? object.suspension.y + object.radius * 0.23 : object.y + object.radius * 1.5
        object.waterEscape = surface !== null && bottom > surface - 25
    }
    if (surface === null || object.popped || object.pointerId !== null || object.duckFlight?.flying) return
    const localSurface = surface + waveHeight(object.x, waveTime)
    const submerged = Math.max(0, Math.min(1, (object.y + object.radius - localSurface) / (object.radius * 2)))
    if (submerged === 0) return
    object.vx += (CURRENT_SPEED - object.vx) * (1 - Math.exp(-2 * submerged * dt))
    object.vy *= Math.exp(-5 * submerged * dt)
    if (object.finish === 'duck' || object.finish === 'apple') {
        // Counter gravity at half immersion; additional depth provides restoring lift.
        object.vy -= 1800 * submerged * dt
        if (object.finish === 'duck') {
            const halfWidth = Math.max(1, object.radius * 0.8)
            const slope = (waveHeight(object.x + halfWidth, waveTime)
                - waveHeight(object.x - halfWidth, waveTime)) / (2 * halfWidth)
            const targetAngle = Math.atan(slope)
            object.angularVelocity += ((targetAngle - object.angle) * 18 - object.angularVelocity * 4) * dt
            object.angle += object.angularVelocity * dt
        }
    }
}

export function drawWater(ctx: CanvasRenderingContext2D, width: number, ground: number, surface: number | null, time: number, foreground = false): void {
    if (surface === null) return
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(0, surface)
    for (let x = 0; x <= width + 12; x += 12) {
        ctx.lineTo(x, surface + waveHeight(x, time))
    }
    ctx.lineTo(width, ground)
    ctx.lineTo(0, ground)
    ctx.closePath()
    ctx.fillStyle = foreground ? 'rgba(67,170,220,0.3)' : 'rgba(40,136,196,0.42)'
    ctx.fill()
    if (foreground) {
        ctx.beginPath()
        for (let x = 0; x <= width + 12; x += 12) {
            const y = surface + waveHeight(x, time)
            if (x === 0) ctx.moveTo(x, y)
            else ctx.lineTo(x, y)
        }
        ctx.strokeStyle = '#bceeff'
        ctx.lineWidth = 2
        ctx.stroke()
        ctx.strokeStyle = 'rgba(210,245,255,0.45)'
        ctx.lineWidth = 1.5
        for (let row = 0; row < 3; row++) {
            const y = surface + (ground - surface) * (row + 1) / 4
            const spacing = 150
            const offset = (time * CURRENT_SPEED + row * 47) % spacing
            for (let x = offset - spacing; x < width; x += spacing) {
                ctx.beginPath()
                ctx.moveTo(x, y)
                ctx.quadraticCurveTo(x + 13, y - 3, x + 28, y)
                ctx.stroke()
            }
        }
    }
    ctx.restore()
}
