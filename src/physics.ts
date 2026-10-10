import { playPopSound } from './audio'
import { Balloon, BalloonConfig, popBalloon } from './balloon'

const VELOCITY_DAMPING = 0.995
const ANGULAR_DAMPING = 0.999

const COLLISION_SPEED_RETENTION = 0.94

const MIN_SPEED = 0.01
const MIN_ANGULAR_SPEED = 0.0005

const MAX_SPEED = 2000
const MAX_ANGULAR_SPEED = 3

const ROTATION_TRANSFER = 0.002

const POP_RADIUS_MULTIPLIER = 4
const FLOAT_FORCE = 6

const PUSH_BASE_IMPULSE = 700
const PUSH_PENETRATION_IMPULSE = 50

export const RELEASE_IMPULSE = 500
const POP_IMPULSE = 1000

const WALL_RETENTION = 0.92
const BALLON_RESTITUTION = 0.96

function applyFloat(balloon: Balloon, dt: number): void {
    if (balloon.pointerId !== null || balloon.popped) {
        return
    }

    balloon.vx +=
        (Math.random() - 0.5) *
        FLOAT_FORCE *
        dt

    balloon.vy +=
        (Math.random() - 0.5) *
        FLOAT_FORCE *
        dt
}

export function popWithForce(
    balloons: Balloon[],
    popped: Balloon
): void {
    popBalloon(popped)
    playPopSound()

    const effectRadius =
        popped.radius *
        POP_RADIUS_MULTIPLIER

    for (const balloon of balloons) {
        if (
            balloon === popped ||
            balloon.popped ||
            balloon.pointerId !== null
        ) {
            continue
        }

        const dx =
            balloon.x - popped.x

        const dy =
            balloon.y - popped.y

        const distance =
            Math.hypot(dx, dy)

        if (
            distance <= 0 ||
            distance > effectRadius
        ) {
            continue
        }

        const nx = dx / distance
        const ny = dy / distance

        // Strong near the popped balloon,
        // smoothly declining farther away.
        const falloff =
            1 - distance / effectRadius

        const force =
            POP_IMPULSE *
            falloff *
            falloff

        const deviation =
            (Math.random() - 0.5) * 0.3

        const cos = Math.cos(deviation)
        const sin = Math.sin(deviation)

        const pushX =
            nx * cos - ny * sin

        const pushY =
            nx * sin + ny * cos

        balloon.vx += pushX * force
        balloon.vy += pushY * force

        // Imperfection gives it some rotational life.
        balloon.angularVelocity +=
            (Math.random() - 0.5) *
            force *
            ROTATION_TRANSFER

        clampVelocity(balloon)
        clampAngularVelocity(balloon)
    }
}

export function updateBalloonPhysics(
    balloons: Balloon[],
    dt: number,
    width: number,
    height: number,
    config: BalloonConfig
): void {
    for (const balloon of balloons) {
        if (balloon.popped) {
            continue
        }

        integrate(balloon, dt)
        resolveScreenCollision(balloon, width, height)
    }

    resolveBalloonCollisions(balloons, config)
}

function integrate(
    balloon: Balloon,
    dt: number
): void {
    // Pointer-controlled balloons are kinematic.
    if (balloon.pointerId !== null) {
        balloon.vx = 0
        balloon.vy = 0

        balloon.angularVelocity *= Math.pow(
            ANGULAR_DAMPING,
            dt * 60
        )

        balloon.angle += balloon.angularVelocity * dt
        return
    }

    applyFloat(balloon, dt)
    balloon.x += balloon.vx * dt
    balloon.y += balloon.vy * dt

    balloon.angle += balloon.angularVelocity * dt

    const velocityDamping =
        Math.pow(VELOCITY_DAMPING, dt * 60)

    const angularDamping =
        Math.pow(ANGULAR_DAMPING, dt * 60)

    balloon.vx *= velocityDamping
    balloon.vy *= velocityDamping

    balloon.angularVelocity *= angularDamping

    const speedSq =
        balloon.vx * balloon.vx +
        balloon.vy * balloon.vy

    if (speedSq < 0.0001) {
        balloon.vx = 0
        balloon.vy = 0
    }

    if (
        Math.abs(balloon.angularVelocity) <
        MIN_ANGULAR_SPEED
    ) {
        balloon.angularVelocity = 0
    }

    clampVelocity(balloon)
}

function resolveScreenCollision(
    balloon: Balloon,
    width: number,
    height: number
): void {
    const rx = balloon.radius * 0.8
    const ry = balloon.radius

    let hitX = false
    let hitY = false

    if (balloon.x - rx < 0) {
        balloon.x = rx

        if (balloon.vx < 0) {
            balloon.vx = -balloon.vx
            hitX = true
        }
    } else if (balloon.x + rx > width) {
        balloon.x = width - rx

        if (balloon.vx > 0) {
            balloon.vx = -balloon.vx
            hitX = true
        }
    }

    if (balloon.y - ry < 0) {
        balloon.y = ry

        if (balloon.vy < 0) {
            balloon.vy = -balloon.vy
            hitY = true
        }
    } else if (balloon.y + ry > height) {
        balloon.y = height - ry

        if (balloon.vy > 0) {
            balloon.vy = -balloon.vy
            hitY = true
        }
    }

    if (!hitX && !hitY) {
        return
    }

    balloon.vx *= WALL_RETENTION
    balloon.vy *= WALL_RETENTION

    // Glancing wall impacts induce some rotation.
    if (hitX) {
        balloon.angularVelocity +=
            balloon.vy * ROTATION_TRANSFER
    }

    if (hitY) {
        balloon.angularVelocity -=
            balloon.vx * ROTATION_TRANSFER
    }

    clampAngularVelocity(balloon)
}

export function resolveBalloonCollisions(
    balloons: Balloon[],
    config: BalloonConfig
): void {
    for (let i = 0; i < balloons.length; i++) {
        const a = balloons[i]

        if (a.popped) {
            continue
        }

        for (let j = i + 1; j < balloons.length; j++) {
            const b = balloons[j]

            if (b.popped) {
                continue
            }

            resolveCollision(a, b, config)
        }
    }
}

function resolveCollision(
    a: Balloon,
    b: Balloon,
    config: BalloonConfig
): void {
    let dx = b.x - a.x
    let dy = b.y - a.y

    let distanceSq = dx * dx + dy * dy

    const radiusA = a.radius * 0.8
    const radiusB = b.radius * 0.8

    const minDistance =
        radiusA +
        radiusB +
        config.collisionPadding

    if (distanceSq >= minDistance * minDistance) {
        return
    }

    if (distanceSq < 0.0001) {
        dx = 1
        dy = 0
        distanceSq = 1
    }

    const distance = Math.sqrt(distanceSq)

    const nx = dx / distance
    const ny = dy / distance

    const penetration = minDistance - distance

    const aControlled = a.pointerId !== null
    const bControlled = b.pointerId !== null

    /*
     * Positional correction.
     *
     * A controlled balloon does not get pushed away from
     * the user's pointer.
     */
    if (aControlled && !bControlled) {
        b.x += nx * penetration
        b.y += ny * penetration
    } else if (bControlled && !aControlled) {
        a.x -= nx * penetration
        a.y -= ny * penetration
    } else if (!aControlled && !bControlled) {
        const correction = penetration * 0.5

        a.x -= nx * correction
        a.y -= ny * correction

        b.x += nx * correction
        b.y += ny * correction
    }

    /*
     * Growing/controlled balloons act as pushers.
     *
     * Penetration generates velocity away from the growing
     * balloon instead of merely teleporting its neighbor.
     */
    if (aControlled && !bControlled) {
        pushFromControlledBalloon(
            a,
            b,
            nx,
            ny,
            penetration
        )

        return
    }

    if (bControlled && !aControlled) {
        pushFromControlledBalloon(
            b,
            a,
            -nx,
            -ny,
            penetration
        )

        return
    }

    if (aControlled && bControlled) {
        return
    }

    const rvx = b.vx - a.vx
    const rvy = b.vy - a.vy

    const separatingVelocity =
        rvx * nx +
        rvy * ny

    if (separatingVelocity >= 0) {
        return
    }

    const speedA =
        Math.hypot(a.vx, a.vy)

    const speedB =
        Math.hypot(b.vx, b.vy)

    const impulse =
        -(1 + BALLON_RESTITUTION) *
        separatingVelocity *
        0.5

    const impulseX = nx * impulse
    const impulseY = ny * impulse

    a.vx -= impulseX
    a.vy -= impulseY

    b.vx += impulseX
    b.vy += impulseY

    /*
     * If one balloon was basically stationary, the incoming
     * balloon loses approximately 30% of its velocity.
     */
    // if (speedA < MIN_SPEED && speedB >= MIN_SPEED) {
    //     b.vx *= COLLISION_SPEED_RETENTION
    //     b.vy *= COLLISION_SPEED_RETENTION
    // }

    // if (speedB < MIN_SPEED && speedA >= MIN_SPEED) {
    //     a.vx *= COLLISION_SPEED_RETENTION
    //     a.vy *= COLLISION_SPEED_RETENTION
    // }

    /*
     * Tangential relative velocity creates spin.
     *
     * tangent = perpendicular to collision normal
     */
    const tx = -ny
    const ty = nx

    const tangentialVelocity =
        rvx * tx +
        rvy * ty

    const spin =
        tangentialVelocity *
        ROTATION_TRANSFER

    a.angularVelocity += spin
    b.angularVelocity -= spin

    clampVelocity(a)
    clampVelocity(b)

    clampAngularVelocity(a)
    clampAngularVelocity(b)
}

function pushFromControlledBalloon(
    source: Balloon,
    target: Balloon,
    nx: number,
    ny: number,
    penetration: number
): void {
    const impulse =
        PUSH_BASE_IMPULSE +
        penetration * PUSH_PENETRATION_IMPULSE

    target.vx += nx * impulse
    target.vy += ny * impulse

    const tangentX = -ny
    const tangentY = nx

    const tangent =
        (Math.random() - 0.5) *
        impulse *
        0.08

    target.vx += tangentX * tangent
    target.vy += tangentY * tangent

    target.angularVelocity +=
        tangent * ROTATION_TRANSFER

    clampVelocity(target)
    clampAngularVelocity(target)
}

function clampVelocity(
    balloon: Balloon
): void {
    const speed =
        Math.hypot(
            balloon.vx,
            balloon.vy
        )

    if (speed <= MAX_SPEED) {
        return
    }

    const scale =
        MAX_SPEED / speed

    balloon.vx *= scale
    balloon.vy *= scale
}

function clampAngularVelocity(
    balloon: Balloon
): void {
    balloon.angularVelocity =
        Math.max(
            -MAX_ANGULAR_SPEED,
            Math.min(
                MAX_ANGULAR_SPEED,
                balloon.angularVelocity
            )
        )
}