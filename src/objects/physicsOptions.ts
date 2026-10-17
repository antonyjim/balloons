/** Motion values use pixels, seconds, and radians. Positive buoyancy lifts upward.
 * Zero disables forces such as buoyancy, breeze response, and rocking.
 */
export interface PhysicsOptions {
    /** Per-melon multipliers for the base breaking height. */
    bubbleImpactBreakSpeed: number
    watermelonToughnessMin: number
    watermelonToughnessMax: number
    /** Closing speed along the contact normal, before toughness scaling (px/s). */
    watermelonCollisionBreakSpeed: number
    watermelonBounce: number
    watermelonRollingDrag: number
    watermelonGravity: number
    watermelonBurstHeightRatio: number
    /** Basket/envelope relative angle in radians that ignites an active burner. */
    ignitionAngle: number
    fireGravity: number
    fireWind: number
    fireMaxDuration: number
    basketDetachDelay: number
    /** Maximum ignition altitude, measured up from the bottom of the viewport. */
    burnerMaxAltitudeRatio: number
    burnerMinDuration: number
    burnerMaxDuration: number
    burnerMinPause: number
    burnerMaxPause: number
    /** Upward acceleration during a burn, after compensating for basket weight. */
    burnerLift: number
    /** Downward acceleration in pixels per second squared. */
    basketGravity: number
    basketMassRatio: number
    basketDrag: number
    suspensionLengthRatio: number
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
    bubbleImpactBreakSpeed: 400,
    watermelonToughnessMin: 1.25,
    watermelonToughnessMax: 2.2,
    watermelonCollisionBreakSpeed: 650,
    watermelonBounce: 0.38,
    watermelonRollingDrag: 1.5,
    watermelonGravity: 900,
    watermelonBurstHeightRatio: 0.46,
    ignitionAngle: 20 * Math.PI / 180,
    fireGravity: 360,
    fireWind: 65,
    fireMaxDuration: 12,
    basketDetachDelay: 1.45,
    burnerMaxAltitudeRatio: 0.75,
    burnerMinDuration: 2,
    burnerMaxDuration: 5,
    burnerMinPause: 4,
    burnerMaxPause: 12,
    burnerLift: 180,
    basketGravity: 1500,
    basketMassRatio: 0.14,
    basketDrag: 0.7,
    suspensionLengthRatio: 0.34,
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
    breezeResponse: 1.5,
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
