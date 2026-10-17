import type { PhysicsOptions } from './objects/physicsOptions'
import { Balloon, BalloonConfig } from './objects/balloonTypes'
import { popBalloon } from './objects/balloon'
import { getPhysicsOptions } from './objects/objectDefinitions'
import { getDeviceTilt, updateDeviceMotion } from './deviceMotion'

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

function clampVelocity(balloon: Balloon, physics = getPhysicsOptions(balloon)): void {
    const sq = balloon.vx * balloon.vx + balloon.vy * balloon.vy
    if (sq <= physics.maxSpeed * physics.maxSpeed) return
    const scale = physics.maxSpeed / Math.sqrt(sq)
    balloon.vx *= scale
    balloon.vy *= scale
}

function clampSpin(balloon: Balloon, physics = getPhysicsOptions(balloon)): void {
    balloon.angularVelocity = Math.max(
        -physics.maxAngularSpeed,
        Math.min(physics.maxAngularSpeed, balloon.angularVelocity)
    )
}

export function popWithForce(balloons: Balloon[], popped: Balloon): void {
    if (popped.popped) return
    const physics = getPhysicsOptions(popped)
    popBalloon(popped)


    const range = popped.radius * physics.popRadiusMultiplier
    const rangeSq = range * range
    for (const balloon of balloons) {
        if (balloon === popped || balloon.popped || balloon.pointerId !== null) continue
        const dx = balloon.x - popped.x
        const dy = balloon.y - popped.y
        const sq = dx * dx + dy * dy
        if (sq < 0.0001 || sq > rangeSq) continue

        const distance = Math.sqrt(sq)
        const falloff = 1 - distance / range
        const impulse = physics.popImpulse * falloff * falloff
        const offset = (Math.random() - 0.5) * 0.3
        const direction = Math.atan2(dy, dx) + offset
        balloon.vx += Math.cos(direction) * impulse
        balloon.vy += Math.sin(direction) * impulse
        balloon.angularVelocity += (Math.random() - 0.5) * impulse * getPhysicsOptions(balloon).rotationTransfer
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
        resolveScreenCollision(balloon, width, height, config)
    }

    resolveBalloonCollisions(balloons, config)

    // Pairwise positional corrections can move objects beyond the screen.
    for (const balloon of balloons) {
        if (!balloon.popped) resolveScreenCollision(balloon, width, height, config)
    }
}

function integrate(
    balloon: Balloon,
    dt: number,
    config: BalloonConfig
): void {
    const physics = getPhysicsOptions(balloon, config)
    if (balloon.pointerId !== null) {
        const follow = 1 - Math.exp(-physics.anchorStrength * dt)

        balloon.x += (balloon.anchorX - balloon.x) * follow
        balloon.y += (balloon.anchorY - balloon.y) * follow

        balloon.vx = 0
        balloon.vy = 0

        balloon.angularVelocity *= Math.exp(-physics.angularDrag * dt)
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
        Math.sin(t * physics.breezeFrequency) * BREEZE_STRENGTH +
        Math.sin(t * 0.19 + 1.7) * BREEZE_STRENGTH * 0.45

    // Independent local movement
    const localBreeze =
        Math.sin(t * 0.72 + phase) * physics.localBreezeAmplitude

    const ax =
        (breeze + localBreeze) * physics.breezeResponse +
        tilt * physics.tiltForce

    // Consistent upward buoyancy
    const ay =
        -physics.buoyancy +
        Math.sin(t * 0.43 + phase) * physics.verticalBreezeAmplitude

    balloon.vx += ax * dt
    balloon.vy += ay * dt

    const drag = Math.exp(-physics.linearDrag * dt)

    balloon.vx *= drag
    balloon.vy *= drag

    clampVelocity(balloon, physics)

    balloon.x += balloon.vx * dt
    balloon.y += balloon.vy * dt

    // Rocking: slow oscillation and a little influence
    // from the local breeze and phone orientation.
    const targetAngle =
        Math.sin(t * physics.rockFrequency + phase) * physics.rockAmplitude +
        Math.sin(t * 0.37 + phase * 0.7) * 0.035 +
        tilt * physics.tiltLean +
        ax * physics.accelerationLean

    const maxLeanOfType = physics.maxLean

    const desiredAngle = Math.max(
        -maxLeanOfType,
        Math.min(maxLeanOfType, targetAngle)
    )

    // Damped angular spring.
    // This pulls the knot back beneath the balloon.
    const error = desiredAngle - balloon.angle

    const angularAcceleration =
        error * physics.rockStiffness -
        balloon.angularVelocity * physics.rockDamping

    balloon.angularVelocity += angularAcceleration * dt

    clampSpin(balloon, physics)

    balloon.angle += balloon.angularVelocity * dt
}

function resolveScreenCollision(
    balloon: Balloon, width: number, height: number, config: Partial<PhysicsOptions>
): void {
    const physics = getPhysicsOptions(balloon, config)
    // Conservative circular bound that includes the knot and rotation.
    const r = balloon.radius * physics.screenRadiusRatio
    const minX = Math.min(r, width * 0.5)
    const maxX = Math.max(minX, width - r)
    const minY = Math.min(r, height * 0.5)
    const maxY = Math.max(minY, height - r)

    if (balloon.x < minX) {
        balloon.x = minX
        if (balloon.vx < 0) balloon.vx = -balloon.vx * physics.wallRetention
    } else if (balloon.x > maxX) {
        balloon.x = maxX
        if (balloon.vx > 0) balloon.vx = -balloon.vx * physics.wallRetention
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
            balloon.vy = -balloon.vy * physics.wallRetention
        }
    }
}

export function resolveBalloonCollisions(
    balloons: Balloon[],
    config: BalloonConfig
): void {
    let maxRadius = 0
    for (const balloon of balloons) {
        if (balloon.popped) continue
        const physics = getPhysicsOptions(balloon, config)
        maxRadius = Math.max(maxRadius,
            balloon.radius * physics.collisionRadiusRatio + physics.collisionPadding / 2)
    }
    if (maxRadius === 0) return

    // With this cell size, colliding circle centers can differ by at most
    // one cell in either direction. Each pair is tested exactly once.
    const cellSize = Math.max(24, maxRadius * 2)
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
    const aPhysics = getPhysicsOptions(a, config)
    const bPhysics = getPhysicsOptions(b, config)
    let dx = b.x - a.x
    let dy = b.y - a.y
    let distSq = dx * dx + dy * dy
    const minDistance = a.radius * aPhysics.collisionRadiusRatio + b.radius * bPhysics.collisionRadiusRatio +
        (aPhysics.collisionPadding + bPhysics.collisionPadding) / 2
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
        pushFromControlledBalloon(b, nx, ny, penetration, bPhysics)
        return
    }
    if (bc) {
        a.x -= nx * penetration
        a.y -= ny * penetration
        pushFromControlledBalloon(a, -nx, -ny, penetration, aPhysics)
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

    const impulse = -(1 + (aPhysics.collisionRestitution + bPhysics.collisionRestitution) / 2) * normalSpeed * 0.5
    a.vx -= nx * impulse
    a.vy -= ny * impulse
    b.vx += nx * impulse
    b.vy += ny * impulse

    const tangentialSpeed = -rvx * ny + rvy * nx
    a.angularVelocity += tangentialSpeed * aPhysics.rotationTransfer
    b.angularVelocity -= tangentialSpeed * bPhysics.rotationTransfer
    clampVelocity(a, aPhysics)
    clampVelocity(b, bPhysics)
    clampSpin(a, aPhysics)
    clampSpin(b, bPhysics)
}

function pushFromControlledBalloon(
    target: Balloon,
    nx: number,
    ny: number,
    penetration: number,
    physics: Readonly<PhysicsOptions>
): void {
    // Restrict the impulse to keep crowded systems stable.
    const impulse = Math.min(physics.maxPushImpulse, physics.pushBaseImpulse + penetration * physics.pushPenetrationImpulse)
    target.vx += nx * impulse
    target.vy += ny * impulse
    target.angularVelocity += (-ny * target.vx + nx * target.vy) * physics.rotationTransfer
    clampVelocity(target, physics)
    clampSpin(target, physics)
}
