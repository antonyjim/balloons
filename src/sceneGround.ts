import type { Balloon } from './objects/balloonTypes'

/** Keep the floor until the last watermelon fragment has finished its animation. */
export function sceneGround(height: number, objects: readonly Pick<Balloon, 'finish'>[]): { visible: boolean, y: number } {
    const visible = objects.some(object => object.finish === 'watermelon' || object.finish === 'apple' || object.finish === 'duck')
    const depth = visible ? Math.min(height, 72, Math.max(36, height * 0.08)) : 0
    return { visible, y: Math.max(0, height - depth) }
}
