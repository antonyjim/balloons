import { playPopSound } from './audio'
import { Balloon, BalloonConfig, popBalloon } from './balloon'
import { getDeviceTilt, updateDeviceMotion } from './deviceMotion'

const MAX_SPEED = 2000
const MAX_ANGULAR_SPEED = 2.5
const ROTATION_TRANSFER = 0.0015
const WALL_RETENTION = 0.78
const POP_RADIUS_MULTIPLIER = 4
const POP_IMPULSE = 5000
const PUSH_BASE_IMPULSE = 45
const PUSH_PENETRATION_IMPULSE = 2

export const RELEASE_IMPULSE = 525
// Smooth, low-frequency atmospheric acceleration (pixels/second squared).
const BUOYANCY = 60
const BREEZE_FREQUENCY = 0.35
const TILT_FORCE = 110

const LINEAR_DRAG = 1.8
const ANGULAR_DRAG = 2.4

const ROCK_STIFFNESS = 2.5
const ROCK_DAMPING = 3.8
const ROCK_AMPLITUDE = 0.085
const ROCK_FREQUENCY = 0.9
const TILT_LEAN = 0.22

const MAX_LEAN = 0.4

let ambientTime = 0

// Reuse the cells and their arrays between frames.
const cells = new Map<number, Balloon[]>()
const activeCells: Balloon[][] = []
const availableCells: Balloon[][] = []

let BREEZE_STRENGTH = 22

let breezeTarget = 22
let breezeTimer = 0

export function updateBreeze(dt: number): void {
    breezeTimer -= dt

    if (breezeTimer <= 0) {
        // Random strength and direction
        breezeTarget = (Math.random() * 5 - 1) * 35

        // Change target every 2–6 seconds
        breezeTimer = 2 + Math.random() * 4
    }

    // Smoothly approach target, independent of frame rate
    const smoothing = 1 - Math.exp(-0.8 * dt)

    BREEZE_STRENGTH +=
        (breezeTarget - BREEZE_STRENGTH) * smoothing
}

function clampVelocity(balloon: Balloon): void {
    const sq = balloon.vx * balloon.vx + balloon.vy * balloon.vy
    if (sq <= MAX_SPEED * MAX_SPEED) return
    const scale = MAX_SPEED / Math.sqrt(sq)
    balloon.vx *= scale
    balloon.vy *= scale
}

function clampSpin(balloon: Balloon): void {
    balloon.angularVelocity = Math.max(
        -MAX_ANGULAR_SPEED,
        Math.min(MAX_ANGULAR_SPEED, balloon.angularVelocity)
    )
}

export function popWithForce(balloons: Balloon[], popped: Balloon): void {
    if (popped.popped) return
    popBalloon(popped)


    const range = popped.radius * POP_RADIUS_MULTIPLIER
    const rangeSq = range * range
    for (const balloon of balloons) {
        if (balloon === popped || balloon.popped || balloon.pointerId !== null) continue
        const dx = balloon.x - popped.x
        const dy = balloon.y - popped.y
        const sq = dx * dx + dy * dy
        if (sq < 0.0001 || sq > rangeSq) continue

        const distance = Math.sqrt(sq)
        const falloff = 1 - distance / range
        const impulse = POP_IMPULSE * falloff * falloff
        const offset = (Math.random() - 0.5) * 0.3
        const direction = Math.atan2(dy, dx) + offset
        balloon.vx += Math.cos(direction) * impulse
        balloon.vy += Math.sin(direction) * impulse
        balloon.angularVelocity += (Math.random() - 0.5) * impulse * ROTATION_TRANSFER
        clampVelocity(balloon)
        clampSpin(balloon)
    }
}

export function updateBalloonPhysics(
    balloons: Balloon[],
    dt: number,
    width: number,
    height: number,
    config: BalloonConfig
): void {
    if (dt <= 0) return

    ambientTime += dt
    updateDeviceMotion(dt)

    for (const balloon of balloons) {
        if (balloon.popped) continue
        integrate(balloon, dt, config)
        resolveScreenCollision(balloon, width, height)
    }

    resolveBalloonCollisions(balloons, config)

    // Pairwise positional corrections can move objects beyond the screen.
    for (const balloon of balloons) {
        if (!balloon.popped) resolveScreenCollision(balloon, width, height)
    }
}

function integrate(
    balloon: Balloon,
    dt: number,
    config: BalloonConfig
): void {
    if (balloon.pointerId !== null) {
        const follow = 1 - Math.exp(-config.anchorStrength * dt)

        balloon.x += (balloon.anchorX - balloon.x) * follow
        balloon.y += (balloon.anchorY - balloon.y) * follow

        balloon.vx = 0
        balloon.vy = 0

        balloon.angularVelocity *= Math.exp(-ANGULAR_DRAG * dt)
        balloon.angle += balloon.angularVelocity * dt

        return
    }

    const t = ambientTime

    const phase =
        balloon.anchorX * 0.013 +
        balloon.anchorY * 0.019

    const tilt = getDeviceTilt()

    // Slowly changing atmospheric movement
    const breeze =
        Math.sin(t * BREEZE_FREQUENCY) * BREEZE_STRENGTH +
        Math.sin(t * 0.19 + 1.7) * BREEZE_STRENGTH * 0.45

    // Independent local movement
    const localBreeze =
        Math.sin(t * 0.72 + phase) * 13

    const ax =
        breeze +
        localBreeze +
        tilt * TILT_FORCE

    // Consistent upward buoyancy
    const ay =
        -BUOYANCY +
        Math.sin(t * 0.43 + phase) * 7

    balloon.vx += ax * dt
    balloon.vy += ay * dt

    const drag = Math.exp(-LINEAR_DRAG * dt)

    balloon.vx *= drag
    balloon.vy *= drag

    clampVelocity(balloon)

    balloon.x += balloon.vx * dt
    balloon.y += balloon.vy * dt

    // Rocking: slow oscillation and a little influence
    // from the local breeze and phone orientation.
    const targetAngle =
        Math.sin(t * ROCK_FREQUENCY + phase) * ROCK_AMPLITUDE +
        Math.sin(t * 0.37 + phase * 0.7) * 0.035 +
        tilt * TILT_LEAN +
        ax * 0.0006

    const desiredAngle = Math.max(
        -MAX_LEAN,
        Math.min(MAX_LEAN, targetAngle)
    )

    // Damped angular spring.
    // This pulls the knot back beneath the balloon.
    const error = desiredAngle - balloon.angle

    const angularAcceleration =
        error * ROCK_STIFFNESS -
        balloon.angularVelocity * ROCK_DAMPING

    balloon.angularVelocity += angularAcceleration * dt

    clampSpin(balloon)

    balloon.angle += balloon.angularVelocity * dt
}

function resolveScreenCollision(balloon: Balloon, width: number, height: number): void {
    // Conservative circular bound that includes the knot and rotation.
    const r = balloon.radius * 1.17
    const minX = Math.min(r, width * 0.5)
    const maxX = Math.max(minX, width - r)
    const minY = Math.min(r, height * 0.5)
    const maxY = Math.max(minY, height - r)

    if (balloon.x < minX) {
        balloon.x = minX
        if (balloon.vx < 0) balloon.vx = -balloon.vx * WALL_RETENTION
    } else if (balloon.x > maxX) {
        balloon.x = maxX
        if (balloon.vx > 0) balloon.vx = -balloon.vx * WALL_RETENTION
    }
    if (balloon.y < minY) {
        balloon.y = minY

        // Don't bounce off the ceiling.
        // Buoyancy keeps the balloon pressed against it.
        if (balloon.vy < 0) {
            balloon.vy = 0
        }
    } else if (balloon.y > maxY) {
        balloon.y = maxY

        if (balloon.vy > 0) {
            balloon.vy = -balloon.vy * WALL_RETENTION
        }
    }
}

export function resolveBalloonCollisions(
    balloons: Balloon[],
    config: BalloonConfig
): void {
    let maxRadius = 0
    for (const balloon of balloons) {
        if (!balloon.popped && balloon.radius > maxRadius) maxRadius = balloon.radius
    }
    if (maxRadius === 0) return

    // With this cell size, colliding circle centers can differ by at most
    // one cell in either direction. Each pair is tested exactly once.
    const cellSize = Math.max(24, maxRadius * 1.6 + config.collisionPadding)
    const columns = Math.max(1, Math.ceil(100000 / cellSize))
    for (const cell of activeCells) {
        cell.length = 0
        availableCells.push(cell)
    }
    activeCells.length = 0
    cells.clear()

    for (const balloon of balloons) {
        if (balloon.popped) continue
        const cx = Math.floor(balloon.x / cellSize)
        const cy = Math.floor(balloon.y / cellSize)
        const key = cy * columns + cx
        let cell = cells.get(key)
        if (!cell) {
            cell = availableCells.pop() || []
            cells.set(key, cell)
            activeCells.push(cell)
        }
        cell.push(balloon)
    }

    // Only search the same cell and four forward neighbors.
    const offsets = [0, 1, columns - 1, columns, columns + 1]
    for (const [key, cell] of cells) {
        for (let k = 0; k < offsets.length; k++) {
            const other = cells.get(key + offsets[k])
            if (!other) continue
            for (let i = 0; i < cell.length; i++) {
                const start = k === 0 ? i + 1 : 0
                for (let j = start; j < other.length; j++) {
                    resolveCollision(cell[i], other[j], config)
                }
            }
        }
    }
}

function resolveCollision(a: Balloon, b: Balloon, config: BalloonConfig): void {
    let dx = b.x - a.x
    let dy = b.y - a.y
    let distSq = dx * dx + dy * dy
    const minDistance = (a.radius + b.radius) * 0.8 + config.collisionPadding
    if (distSq >= minDistance * minDistance) return

    if (distSq < 0.000001) {
        dx = 1
        dy = 0
        distSq = 1
    }
    const distance = Math.sqrt(distSq)
    const nx = dx / distance
    const ny = dy / distance
    const penetration = Math.max(0, minDistance - distance)
    const ac = a.pointerId !== null
    const bc = b.pointerId !== null

    if (ac && bc) return
    if (ac) {
        b.x += nx * penetration
        b.y += ny * penetration
        pushFromControlledBalloon(b, nx, ny, penetration)
        return
    }
    if (bc) {
        a.x -= nx * penetration
        a.y -= ny * penetration
        pushFromControlledBalloon(a, -nx, -ny, penetration)
        return
    }

    const correction = penetration * 0.5
    a.x -= nx * correction
    a.y -= ny * correction
    b.x += nx * correction
    b.y += ny * correction

    const rvx = b.vx - a.vx
    const rvy = b.vy - a.vy
    const normalSpeed = rvx * nx + rvy * ny
    if (normalSpeed >= 0) return

    const impulse = -(1 + config.collisionRestitution) * normalSpeed * 0.5
    a.vx -= nx * impulse
    a.vy -= ny * impulse
    b.vx += nx * impulse
    b.vy += ny * impulse

    const tangentialSpeed = -rvx * ny + rvy * nx
    const spin = tangentialSpeed * ROTATION_TRANSFER
    a.angularVelocity += spin
    b.angularVelocity -= spin
    clampVelocity(a)
    clampVelocity(b)
    clampSpin(a)
    clampSpin(b)
}

function pushFromControlledBalloon(
    target: Balloon,
    nx: number,
    ny: number,
    penetration: number
): void {
    // Restrict the impulse to keep crowded systems stable.
    const impulse = Math.min(100, PUSH_BASE_IMPULSE + penetration * PUSH_PENETRATION_IMPULSE)
    target.vx += nx * impulse
    target.vy += ny * impulse
    target.angularVelocity += (-ny * target.vx + nx * target.vy) * ROTATION_TRANSFER
    clampVelocity(target)
    clampSpin(target)
}
