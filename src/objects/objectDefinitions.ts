import { materialRevision } from './balloonMaterials'
import { drawWatermelon, watermelonSpriteRevision, watermelonPhysics, updateWatermelon, constrainWatermelon, smashWatermelon, updateWatermelonChunks, drawWatermelonChunks } from './watermelon'
import { igniteHotAir, updateHotAirFire } from './hotAirFire'
import { drawPaintBalloon, paintPhysics, popPaintBalloon } from './paintBalloon'
import { defaultPhysicsOptions, type PhysicsOptions } from './physicsOptions'
import type { Balloon, BalloonConfig } from './balloonTypes'
import type { BalloonFinish } from '../theme/types'
import { drawLatexVector, latexPhysics } from './latexBalloon'
import { drawBubbleVector, bubblePhysics, bubbleFrame } from './bubble'
import { drawHotAirVector, hotAirPhysics } from './hotAirBalloon'

/** Settings for the current family of growing, floating objects. */
interface ObjectDefinition {
    draw(ctx: CanvasRenderingContext2D, object: Balloon): void
    spriteKey(object: Balloon): unknown
    spriteRevision?(): number
    spriteHeight: number
    hitRadiusRatio?: number
    popAtMax: boolean
    onPop?(object: Balloon): void
    updatePopped?(object: Balloon, dt: number, width: number, height: number, config: BalloonConfig): void
    isFinished?(object: Balloon): boolean
    drawPopped?(ctx: CanvasRenderingContext2D, object: Balloon): void
    updatePhysics?(object: Balloon, dt: number, width: number, height: number, physics: Readonly<PhysicsOptions>, objects: Balloon[]): void
    constrain?(object: Balloon, width: number, height: number, physics: Readonly<PhysicsOptions>, objects: Balloon[]): void
    physics: Readonly<Partial<PhysicsOptions>>
}

const definitions = {
    watermelon: {
        draw: drawWatermelon, spriteRevision: watermelonSpriteRevision, spriteKey: () => null, spriteHeight: 2.3, hitRadiusRatio: 1,
        popAtMax: false, physics: watermelonPhysics,
        updatePhysics: updateWatermelon, constrain: constrainWatermelon,
        onPop: smashWatermelon, updatePopped: updateWatermelonChunks,
        drawPopped: drawWatermelonChunks, isFinished: object => object.popTime >= 1.8
    },
    paint: {
        draw: drawPaintBalloon,
        spriteRevision: () => materialRevision("latex"),
        spriteKey: object => object.color,
        spriteHeight: 2.4,
        popAtMax: true,
        hitRadiusRatio: 0.94,
        physics: paintPhysics,
        onPop: popPaintBalloon
    },
    latex: {
        draw: drawLatexVector,
        spriteRevision: () => materialRevision("latex"),
        spriteKey: object => object.color,
        spriteHeight: 2.4,
        popAtMax: false,
        physics: latexPhysics
    },
    bubble: {
        draw: drawBubbleVector,
        spriteKey: bubbleFrame,
        spriteHeight: 2.3,
        popAtMax: true,
        physics: bubblePhysics
    },
    'hot-air': {
        draw: drawHotAirVector,
        spriteRevision: () => materialRevision("fabric"),
        spriteKey: object => [object.color, object.panelColors, object.panelCount],
        spriteHeight: 2.4,
        hitRadiusRatio: 0.94,
        popAtMax: false,
        physics: hotAirPhysics,
        onPop: igniteHotAir,
        updatePopped: updateHotAirFire,
        isFinished: object => object.fire?.removed ?? true
    }
} satisfies Record<BalloonFinish, ObjectDefinition>

export function getObjectDefinition(finish: BalloonFinish): ObjectDefinition {
    return definitions[finish]
}

/** Precedence: shared defaults < scene settings < type overrides < instance overrides. */
export function getPhysicsOptions(
    object: Balloon,
    scene: Partial<PhysicsOptions> = {}
): Readonly<PhysicsOptions> {
    return {
        ...defaultPhysicsOptions,
        ...scene,
        ...getObjectDefinition(object.finish).physics,
        ...object.physics
    }
}
