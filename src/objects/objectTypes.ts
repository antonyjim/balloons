import type { PhysicsOptions } from "./physicsOptions"

/** Motion shared by scene objects, independent of their appearance or effects. */
export interface PhysicsBody {
    /** Instance overrides take precedence over the object type and scene defaults. */
    physics?: Partial<PhysicsOptions>
    x: number
    y: number
    vx: number
    vy: number
    angle: number
    angularVelocity: number
}

/** Pointer-controlled objects that grow while held. */
export interface InteractiveObject extends PhysicsBody {
    pointerId: number | null
    anchorX: number
    anchorY: number
    growing: boolean
}

/** A capability for objects with a timed pop animation. */
export interface PopState {
    popped: boolean
    popTime: number
}
