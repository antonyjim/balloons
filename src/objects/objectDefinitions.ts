import { drawPaintBalloon, paintPhysics, popPaintBalloon } from './paintBalloon'
import { defaultPhysicsOptions, type PhysicsOptions } from './physicsOptions'
import type { Balloon } from './balloonTypes'
import type { BalloonFinish } from '../theme/types'
import { drawLatexVector, latexPhysics } from './latexBalloon'
import { drawBubbleVector, bubblePhysics } from './bubble'
import { drawHotAirVector, hotAirPhysics } from './hotAirBalloon'

/** Settings for the current family of growing, floating objects. */
interface ObjectDefinition {
    draw(ctx: CanvasRenderingContext2D, object: Balloon): void
    spriteKey(object: Balloon): unknown
    spriteHeight: number
    hitRadiusRatio?: number
    popAtMax: boolean
    onPop?(object: Balloon): void
    physics: Readonly<Partial<PhysicsOptions>>
}

const definitions = {
    paint: {
        draw: drawPaintBalloon,
        spriteKey: object => object.color,
        spriteHeight: 2.4,
        popAtMax: true,
        hitRadiusRatio: 0.94,
        physics: paintPhysics,
        onPop: popPaintBalloon
    },
    latex: {
        draw: drawLatexVector,
        spriteKey: object => object.color,
        spriteHeight: 2.4,
        popAtMax: false,
        physics: latexPhysics
    },
    bubble: {
        draw: drawBubbleVector,
        spriteKey: () => null,
        spriteHeight: 2.3,
        popAtMax: true,
        physics: bubblePhysics
    },
    'hot-air': {
        draw: drawHotAirVector,
        spriteKey: object => [object.color, object.panelColors, object.panelCount],
        spriteHeight: 3.1,
        popAtMax: false,
        physics: hotAirPhysics
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
