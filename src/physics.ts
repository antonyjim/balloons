import { applyWater, waterSurface } from './water'
import { getWatermelonToughness } from './objects/watermelon'
import { updateBubbleMotion, disturbBubble, bubbleRadiusAt } from './objects/bubble'
import { shouldIgniteHotAir } from './objects/hotAirFire'
import { updateHotAirSuspension, updateHotAirBurner, ensureSuspendedBasket } from './objects/hotAirBalloon'
import type { PhysicsOptions } from './objects/physicsOptions'
import { Balloon, BalloonConfig } from './objects/balloonTypes'
import { popBalloon } from './objects/balloon'
import { getPhysicsOptions, getObjectDefinition } from './objects/objectDefinitions'
import { getDeviceTilt, updateDeviceMotion } from './deviceMotion'

let ambientTime = 0

// Resolve overrides once per body, rather than allocating settings for every candidate pair.
const frameOptions = new Map<Balloon, Readonly<PhysicsOptions>>()
const typeOptions = new Map<Balloon["finish"], Readonly<PhysicsOptions>>()
function collectOptions(balloons: Balloon[], config: BalloonConfig): ReadonlyMap<Balloon, Readonly<PhysicsOptions>> {
    frameOptions.clear()
    typeOptions.clear()
    for (const balloon of balloons) {
        if (balloon.popped) continue
        if (balloon.physics) {
            frameOptions.set(balloon, getPhysicsOptions(balloon, config))
        } else {
            let options = typeOptions.get(balloon.finish)
            if (!options) {
                options = getPhysicsOptions(balloon, config)
                typeOptions.set(balloon.finish, options)
            }
            frameOptions.set(balloon, options)
        }
    }
    return frameOptions
}

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

function clampVelocity(balloon: { vx: number, vy: number }, physics: Readonly<PhysicsOptions>): void {
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
    if (popped.popped || (popped.finish === 'apple' || popped.finish === 'duck')) return
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
        clampVelocity(balloon, getPhysicsOptions(balloon))
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

    const options = collectOptions(balloons, config) as Map<Balloon, Readonly<PhysicsOptions>>
    const surface = waterSurface(height, balloons)
    for (const balloon of balloons) if (!balloon.popped && balloon.finish === 'bubble') updateBubbleMotion(balloon, dt)
    for (const balloon of balloons) {
        if (balloon.popped) continue
        let physics = options.get(balloon)!
        applyWater(balloon, surface, dt)
        if (surface !== null && balloon.finish === 'watermelon' && balloon.y + balloon.radius > surface) {
            physics = { ...physics, watermelonBurstHeightRatio: Infinity }
            options.set(balloon, physics)
        }
        const definition = getObjectDefinition(balloon.finish)
        if (definition.updatePhysics) definition.updatePhysics(balloon, dt, width, height, physics, balloons)
        else {
            integrate(balloon, dt, physics, height)
            resolveScreenCollision(balloon, width, height, physics)
        }
    }

    resolveBalloonCollisions(balloons, config, options)

    // Pairwise positional corrections can move objects beyond the screen.
    for (const balloon of balloons) {
        if (balloon.popped) continue
        const physics = options.get(balloon)!
        const definition = getObjectDefinition(balloon.finish)
        if (definition.constrain) definition.constrain(balloon, width, height, physics, balloons)
        else resolveScreenCollision(balloon, width, height, physics)
        if (balloon.finish === 'hot-air') {
            updateHotAirSuspension(balloon, dt, width, height, physics)
            clampVelocity(balloon, physics)
            clampSpin(balloon, physics)
            if (shouldIgniteHotAir(balloon, physics)) popBalloon(balloon)
        }
    }
}

function integrate(
    balloon: Balloon,
    dt: number,
    physics: Readonly<PhysicsOptions>,
    viewportHeight: number
): void {
    const burnerLift = balloon.finish === 'hot-air' ? updateHotAirBurner(balloon, dt, physics, viewportHeight) : 0
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
        -physics.buoyancy - burnerLift +
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
    balloon: Balloon, width: number, height: number, physics: Readonly<PhysicsOptions>
): void {
    // Conservative circular bound that includes the knot and rotation.
    const r = balloon.radius * physics.screenRadiusRatio
    const minX = Math.min(r, width * 0.5)
    const maxX = Math.max(minX, width - r)
    const minY = Math.min(r, height * 0.5)
    const maxY = Math.max(minY, height - r)

    if (balloon.finish === 'bubble') {
        const impact = Math.max(
            balloon.x < minX ? -balloon.vx : 0,
            balloon.x > maxX ? balloon.vx : 0,
            balloon.y < minY ? -balloon.vy : 0,
            balloon.y > maxY ? balloon.vy : 0)
        if (impact >= physics.bubbleImpactBreakSpeed) { popBalloon(balloon); return }
    }
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

const impactVelocities = new Map<Balloon, { x: number, y: number, vx: number, vy: number }>()
const collisionBreaks = new Set<Balloon>()

export function resolveBalloonCollisions(
    balloons: Balloon[],
    config: BalloonConfig,
    options = collectOptions(balloons, config)
): void {
    collisionBreaks.clear()
    impactVelocities.clear()
    let maxRadius = 0
    for (const balloon of balloons) {
        if (balloon.popped) continue
        const physics = options.get(balloon)!
        impactVelocities.set(balloon, { x: balloon.x, y: balloon.y, vx: balloon.vx, vy: balloon.vy })
        maxRadius = Math.max(maxRadius,
            balloon.radius * physics.collisionRadiusRatio * (balloon.finish === 'bubble' ? 1.15 : 1) + physics.collisionPadding / 2)
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
                    resolveCollision(cell[i], other[j], options)
                }
            }
        }
    }
    // Query the same spatial grid around each basket, including baskets far below
    // their envelope. Narrow phase uses the rotated basket rather than its ropes.
    for (const owner of balloons) {
        if (owner.popped || owner.finish !== 'hot-air') continue
        const physics = options.get(owner)!
        const basket = ensureSuspendedBasket(owner, physics)
        const reach = maxRadius + owner.radius * 0.25
        for (let cy = Math.floor((basket.y - reach) / cellSize); cy <= Math.floor((basket.y + reach) / cellSize); cy++) {
            for (let cx = Math.floor((basket.x - reach) / cellSize); cx <= Math.floor((basket.x + reach) / cellSize); cx++) {
                for (const other of cells.get(cy * columns + cx) ?? []) {
                    if (other === owner || other.popped) continue
                    resolveBasketContact(owner, other, physics, options.get(other)!)
                }
            }
        }
    }
    // Finish identifying contacts before popping, so every fruit in a hard impact breaks.
    for (const melon of collisionBreaks) popBalloon(melon)
    collisionBreaks.clear()
    impactVelocities.clear()
}

function resolveBasketContact(owner: Balloon, other: Balloon, physics: Readonly<PhysicsOptions>, otherPhysics: Readonly<PhysicsOptions>): void {
    const basket = owner.suspension!
    const c = Math.cos(basket.angle), s = Math.sin(basket.angle)
    const dx = other.x - basket.x, dy = other.y - basket.y
    const lx = dx * c + dy * s, ly = -dx * s + dy * c
    const hw = owner.radius * 0.205, hh = owner.radius * 0.105
    let qx = Math.max(-hw, Math.min(hw, lx)), qy = Math.max(-hh, Math.min(hh, ly))
    let nx = lx - qx, ny = ly - qy
    let distance = Math.hypot(nx, ny)
    const radius = (other.finish === 'bubble' ? bubbleRadiusAt(other, Math.atan2(-dy, -dx)) : other.radius)
        * otherPhysics.collisionRadiusRatio + otherPhysics.collisionPadding / 2
    if (distance >= radius) return
    if (other.finish === 'bubble') { collisionBreaks.add(other); return }
    if (distance < 0.00001) {
        if (hw - Math.abs(lx) < hh - Math.abs(ly)) {
            nx = lx < 0 ? -1 : 1; ny = 0; qx = nx * hw
            distance = -(hw - Math.abs(lx))
        } else {
            nx = 0; ny = ly < 0 ? -1 : 1; qy = ny * hh
            distance = -(hh - Math.abs(ly))
        }
    } else { nx /= distance; ny /= distance }
    const wx = nx * c - ny * s, wy = nx * s + ny * c
    const rx = qx * c - qy * s, ry = qx * s + qy * c
    const torque = rx * wy - ry * wx
    const inverseMass = 1 / Math.max(0.01, physics.basketMassRatio)
    const inverseInertia = 12 * inverseMass / (owner.radius ** 2 * (0.37 ** 2 + 0.19 ** 2))
    const otherMass = other.pointerId === null ? 1 : 0
    const weight = inverseMass + otherMass + torque * torque * inverseInertia
    const correction = (radius - distance) / weight
    basket.x -= wx * correction * inverseMass
    basket.y -= wy * correction * inverseMass
    basket.angle -= torque * correction * inverseInertia
    other.x += wx * correction * otherMass
    other.y += wy * correction * otherMass
    const closing = (other.vx - basket.vx + basket.angularVelocity * ry) * wx
        + (other.vy - basket.vy - basket.angularVelocity * rx) * wy
    const push = otherMass === 0 ? Math.min(physics.maxPushImpulse,
        physics.pushBaseImpulse + (radius - distance) * physics.pushPenetrationImpulse) : 0
    const impulse = Math.max(push, -(1 + physics.collisionRestitution) * closing / weight, 0)
    basket.vx -= wx * impulse * inverseMass
    basket.vy -= wy * impulse * inverseMass
    basket.angularVelocity = Math.max(-8, Math.min(8, basket.angularVelocity - torque * impulse * inverseInertia))
    other.vx += wx * impulse * otherMass
    other.vy += wy * impulse * otherMass
    clampVelocity(basket, physics)
    clampVelocity(other, otherPhysics)
}

function resolveCollision(a: Balloon, b: Balloon, options: ReadonlyMap<Balloon, Readonly<PhysicsOptions>>): void {
    if (a.popped || b.popped) return
    const aPhysics = options.get(a)!
    const bPhysics = options.get(b)!
    let dx = b.x - a.x
    let dy = b.y - a.y
    let distSq = dx * dx + dy * dy
    const direction = Math.atan2(dy, dx)
    const minDistance = (a.finish === 'bubble' ? bubbleRadiusAt(a, direction) : a.radius) * aPhysics.collisionRadiusRatio
        + (b.finish === 'bubble' ? bubbleRadiusAt(b, direction + Math.PI) : b.radius) * bPhysics.collisionRadiusRatio +
        (aPhysics.collisionPadding + bPhysics.collisionPadding) / 2
    if ((a.finish === 'watermelon' && (b.finish === 'watermelon' || b.finish === 'apple'))
        || (b.finish === 'watermelon' && a.finish === 'apple')) {
        // Incoming poses and velocities preserve all contacts in a multi-melon impact.
        const av = impactVelocities.get(a)!
        const bv = impactVelocities.get(b)!
        const contactX = bv.x - av.x, contactY = bv.y - av.y
        const contactSq = contactX * contactX + contactY * contactY
        if (contactSq < minDistance * minDistance) {
            const relativeX = bv.vx - av.vx, relativeY = bv.vy - av.vy
            const closingSpeed = contactSq > 0.000001
                ? -(relativeX * contactX + relativeY * contactY) / Math.sqrt(contactSq)
                : Math.sqrt(relativeX * relativeX + relativeY * relativeY)
            const threshold = Math.min(
                a.finish === 'watermelon' ? aPhysics.watermelonCollisionBreakSpeed * getWatermelonToughness(a, aPhysics) : Infinity,
                b.finish === 'watermelon' ? bPhysics.watermelonCollisionBreakSpeed * getWatermelonToughness(b, bPhysics) : Infinity)
            if (closingSpeed >= threshold && closingSpeed > 0) {
                if (a.finish === 'watermelon') collisionBreaks.add(a)
                if (b.finish === 'watermelon') collisionBreaks.add(b)
            }
        }
    }
    if (distSq >= minDistance * minDistance) return
    if (a.finish === 'bubble' && b.finish === 'hot-air') { collisionBreaks.add(a); return }
    if (b.finish === 'bubble' && a.finish === 'hot-air') { collisionBreaks.add(b); return }

    if (distSq < 0.000001) {
        dx = 1
        dy = 0
        distSq = 1
    }
    const distance = Math.sqrt(distSq)
    const nx = dx / distance
    const ny = dy / distance
    const av = impactVelocities.get(a)!, bv = impactVelocities.get(b)!
    const closingSpeed = Math.max(0, -((bv.vx - av.vx) * nx + (bv.vy - av.vy) * ny))
    if (a.finish === 'bubble' && closingSpeed >= aPhysics.bubbleImpactBreakSpeed) collisionBreaks.add(a)
    if (b.finish === 'bubble' && closingSpeed >= bPhysics.bubbleImpactBreakSpeed) collisionBreaks.add(b)
    const penetration = Math.max(0, minDistance - distance)
    const impact = Math.max(0, -((b.vx - a.vx) * nx + (b.vy - a.vy) * ny)) + penetration * 3
    disturbBubble(a, nx, ny, impact)
    disturbBubble(b, -nx, -ny, impact)
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
