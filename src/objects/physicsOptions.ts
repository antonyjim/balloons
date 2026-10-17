/** Motion values use pixels, seconds, and radians. Positive buoyancy lifts upward.
 * Zero disables forces such as buoyancy, breeze response, and rocking.
 */
export interface PhysicsOptions {
    maxSpeed: number
    maxAngularSpeed: number
    rotationTransfer: number
    wallRetention: number
    popRadiusMultiplier: number
    popImpulse: number
    pushBaseImpulse: number
    pushPenetrationImpulse: number
    maxPushImpulse: number
    releaseImpulse: number
    buoyancy: number
    breezeFrequency: number
    breezeResponse: number
    tiltForce: number
    linearDrag: number
    angularDrag: number
    rockStiffness: number
    rockDamping: number
    rockAmplitude: number
    rockFrequency: number
    tiltLean: number
    maxLean: number
    anchorStrength: number
    collisionRestitution: number
    collisionPadding: number
    collisionRadiusRatio: number
    screenRadiusRatio: number
    localBreezeAmplitude: number
    verticalBreezeAmplitude: number
    accelerationLean: number
}

export const defaultPhysicsOptions: Readonly<PhysicsOptions> = Object.freeze({
    maxSpeed: 2000,
    maxAngularSpeed: 2.5,
    rotationTransfer: 0.0015,
    wallRetention: 0.78,
    popRadiusMultiplier: 4,
    popImpulse: 5000,
    pushBaseImpulse: 45,
    pushPenetrationImpulse: 2,
    maxPushImpulse: 100,
    releaseImpulse: 525,
    buoyancy: 60,
    breezeFrequency: 0.35,
    breezeResponse: 1,
    tiltForce: 110,
    linearDrag: 1.8,
    angularDrag: 2.4,
    rockStiffness: 2.5,
    rockDamping: 3.8,
    rockAmplitude: 0.085,
    rockFrequency: 0.9,
    tiltLean: 0.22,
    maxLean: 0.4,
    anchorStrength: 20,
    collisionRestitution: 0.15,
    collisionPadding: 3,
    collisionRadiusRatio: 0.8,
    screenRadiusRatio: 1.17,
    localBreezeAmplitude: 13,
    verticalBreezeAmplitude: 7,
    accelerationLean: 0.0006,
})
