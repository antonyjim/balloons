import type { Balloon, BalloonConfig } from './balloonTypes'

// Include some extra occupied area for the hot-air basket and rigging.
export function objectArea(object: Pick<Balloon, 'radius' | 'finish'>): number {
    return Math.PI * object.radius ** 2 * (object.finish === 'hot-air' ? 1.15 : 1)
}

export function maximumRadius(width: number, height: number, config: BalloonConfig): number {
    const shortSide = Math.max(0, Math.min(width, height))
    return Math.max(0, Math.min(
        config.maxRadius ?? Infinity,
        shortSide * (config.maxRadiusScreenRatio ?? config.maxScreenRatio / 3),
        Math.sqrt(width * height * (config.maxObjectAreaRatio ?? Infinity) / (Math.PI * 1.15))
    ))
}

export function availableRadius(object: Pick<Balloon, 'finish'>, objects: Balloon[], width: number, height: number, config: BalloonConfig): number {
    const used = objects.reduce((area, other) => area + (other === object || other.popped ? 0 : objectArea(other)), 0)
    const remaining = Math.max(0, width * height * (config.maxSceneAreaRatio ?? Infinity) - used)
    return Math.sqrt(remaining / (Math.PI * (object.finish === 'hot-air' ? 1.15 : 1)))
}

/** Resizing must also bound existing objects, not just newly inflated ones. */
export function enforceSizeLimits(objects: Balloon[], width: number, height: number, config: BalloonConfig): void {
    const max = maximumRadius(width, height, config)
    let total = 0
    for (const object of objects) {
        if (object.popped) continue
        object.radius = Math.min(object.radius, max)
        total += objectArea(object)
    }
    const budget = width * height * (config.maxSceneAreaRatio ?? Infinity)
    if (total <= budget || total === 0) return
    const scale = Math.sqrt(budget / total)
    for (const object of objects) if (!object.popped) object.radius *= scale
}
