import type { PhysicsOptions } from "./physicsOptions"
import { BalloonFinish } from "../theme/types"
import type { InteractiveObject, PopState } from "./objectTypes"

export interface Balloon extends InteractiveObject, PopState {
    bubbleMotion?: import('./bubble').BubbleMotion
    watermelon?: import("./watermelon").WatermelonState
    fire?: import("./hotAirFire").HotAirFireState
    burner?: import("./hotAirBalloon").BurnerState
    suspension?: import("./hotAirBalloon").SuspendedBasket
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
    minRadius?: number
    maxRadius?: number
    maxRadiusScreenRatio?: number
    maxObjectAreaRatio?: number
    maxSceneAreaRatio?: number

    popAtMax: boolean
    popDuration: number

    damping: number
    anchorStrength: number
    collisionRestitution: number
    collisionPadding: number
}

// Preserve the existing type import while keeping hot-air details in their module.
export type { HotAirBalloon } from "./hotAirBalloon"
