import type { PhysicsOptions } from "./physicsOptions"
import { BalloonFinish } from "../theme/types"
import type { InteractiveObject, PopState } from "./objectTypes"

export interface Balloon extends InteractiveObject, PopState {
    radius: number
    color: string
    panelColors?: string[]
    panelCount?: number
    finish: BalloonFinish
}

export interface BalloonConfig extends Partial<PhysicsOptions> {
    initialRadius: number
    growthRate: number
    maxScreenRatio: number

    popAtMax: boolean
    popDuration: number

    damping: number
    anchorStrength: number
    collisionRestitution: number
    collisionPadding: number
}

// Preserve the existing type import while keeping hot-air details in their module.
export type { HotAirBalloon } from "./hotAirBalloon"
