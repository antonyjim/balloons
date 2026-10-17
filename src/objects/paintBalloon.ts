import { paintSplatterShapes } from './paintSplatterShapes'
import type { Balloon } from './balloonTypes'
import type { PhysicsOptions } from './physicsOptions'
import { drawLatexVector } from './latexBalloon'

export const paintPhysics: Readonly<Partial<PhysicsOptions>> = {
    buoyancy: 25,
    linearDrag: 2.2,
    releaseImpulse: 350,
    collisionRadiusRatio: 0.94
}

export function drawPaintBalloon(ctx: CanvasRenderingContext2D, balloon: Balloon): void {
    drawLatexVector(ctx, balloon, { widthRatio: 0.94, opaque: true })
}

export interface PaintSplatter {
    x: number
    y: number
    color: string
    shape: number
    rotation: number
    scaleX: number
    scaleY: number
}

/** Pick and transform an authored silhouette once, preserving it between frames. */
export function createPaintSplatter(
    balloon: Pick<Balloon, 'x' | 'y' | 'radius' | 'color'>,
    random: () => number = Math.random
): PaintSplatter {
    return {
        x: balloon.x,
        y: balloon.y,
        color: balloon.color,
        shape: Math.floor(random() * paintSplatterShapes.length),
        rotation: random() * Math.PI * 2,
        scaleX: balloon.radius / 65 * (0.85 + random() * 0.25) * (random() < 0.5 ? -1 : 1),
        scaleY: balloon.radius / 65 * (0.85 + random() * 0.25)
    }
}

const silhouetteCache = new Map<number, Path2D>()

/** Rasterize each splatter once; memory depends on viewport size, not pop count.
 * Paint lasts until reset or page reload and scales with viewport changes.
 */
export class PaintLayer {
    private canvas: HTMLCanvasElement | null = null
    private width = 0
    private height = 0
    private pending: PaintSplatter[] = []

    add(balloon: Balloon): void {
        this.pending.push(createPaintSplatter(balloon))
    }

    clear(): void {
        this.pending.length = 0
        if (this.canvas) {
            const ctx = this.canvas.getContext('2d')
            if (ctx) {
                ctx.save()
                ctx.setTransform(1, 0, 0, 1, 0, 0)
                ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
                ctx.restore()
            }
        }
    }

    draw(ctx: CanvasRenderingContext2D, width: number, height: number, dpr: number): void {
        if (width <= 0 || height <= 0) return
        if (!this.canvas && this.pending.length === 0) return
        const retainedWidth = Math.max(width, this.width)
        const retainedHeight = Math.max(height, this.height)
        const pixelWidth = Math.max(1, Math.round(retainedWidth * dpr))
        const pixelHeight = Math.max(1, Math.round(retainedHeight * dpr))
        if (!this.canvas || this.canvas.width !== pixelWidth || this.canvas.height !== pixelHeight) {
            const resized = document.createElement('canvas')
            resized.width = pixelWidth
            resized.height = pixelHeight
            const resizedCtx = resized.getContext('2d')
            if (!resizedCtx) return
            if (this.canvas) resizedCtx.drawImage(this.canvas, 0, 0, this.width * dpr, this.height * dpr)
            this.canvas = resized
        }
        this.width = retainedWidth
        this.height = retainedHeight
        const paint = this.canvas.getContext('2d')
        if (!paint) return
        paint.setTransform(pixelWidth / this.width, 0, 0, pixelHeight / this.height, 0, 0)
        for (const splatter of this.pending) {
            paint.save()
            paint.translate(splatter.x, splatter.y)
            paint.rotate(splatter.rotation)
            paint.scale(splatter.scaleX, splatter.scaleY)
            paint.fillStyle = splatter.color
            paint.globalAlpha = 0.88
            let silhouette = silhouetteCache.get(splatter.shape)
            if (!silhouette) {
                silhouette = new Path2D(paintSplatterShapes[splatter.shape])
                silhouetteCache.set(splatter.shape, silhouette)
            }
            paint.fill(silhouette)
            paint.restore()
        }
        this.pending.length = 0
        ctx.drawImage(this.canvas, 0, 0, this.width, this.height)
    }
}

export const paintLayer = new PaintLayer()

export function popPaintBalloon(balloon: Balloon): void {
    paintLayer.add(balloon)
}
