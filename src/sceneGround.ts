import type { Balloon } from './objects/balloonTypes'

export const SCENERY_GRACE_MS = 2000
/** Per-scene deadlines bridge short gaps between qualifying objects. */
export class ScenePresence {
    private groundUntil = -Infinity
    private waterUntil = -Infinity
    update(objects: readonly Balloon[], now: number): { ground: boolean; water: boolean } {
        for (const object of objects) {
            if (object.apple?.exited) continue
            if (object.finish === 'watermelon' || object.finish === 'apple' || object.finish === 'duck') this.groundUntil = now + SCENERY_GRACE_MS
            if (object.finish === 'duck' && !object.popped) this.waterUntil = now + SCENERY_GRACE_MS
        }
        const water = now < this.waterUntil
        return { ground: water || now < this.groundUntil, water }
    }
    reset(): void { this.groundUntil = this.waterUntil = -Infinity }
}

/** Keep the floor until the last watermelon fragment has finished its animation. */
export function sceneGround(height: number, objects: readonly Pick<Balloon, 'finish'>[], retained = false): { visible: boolean, y: number } {
    const visible = retained || objects.some(object => object.finish === 'watermelon' || object.finish === 'apple' || object.finish === 'duck')
    const depth = visible ? Math.min(height, 72, Math.max(36, height * 0.08)) : 0
    return { visible, y: Math.max(0, height - depth) }
}
