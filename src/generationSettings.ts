import type { BalloonConfig } from './objects/balloonTypes'
import type { BalloonFinish } from './theme/types'

export const generationTypes = ['latex', 'foil', 'hot-air', 'bubble', 'paint', 'apple', 'duck', 'watermelon'] as const
export type GenerationType = typeof generationTypes[number]
export interface GenerationSettings { profile?: 'balloons' | 'floaties' | 'landies' | 'random'; weights: Record<GenerationType, number>; showReset: boolean; releaseOnFull: boolean; inflationSpeed: number; minSize: number | null; maxSize: number | null; releaseImpulse: number; popImpulse: number; pushImpulse: number }
const key = 'balloons.generation.settings'
export const generationLabels: Record<GenerationType, string> = { latex: 'Latex balloons', foil: 'Mylar balloons', 'hot-air': 'Hot-air balloons', bubble: 'Bubbles', paint: 'Paint balloons', apple: 'Apples', duck: 'Rubber birds', watermelon: 'Watermelons' }
export function parseGenerationSettings(value: unknown): GenerationSettings {
    const input = value as Partial<GenerationSettings> | null
    const weights = Object.fromEntries(generationTypes.map(type => {
        const n = input?.weights?.[type]
        return [type, typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 100 ? n : type === 'latex' ? 82 : type === 'foil' ? 18 : 100]
    })) as Record<GenerationType, number>
    if (!generationTypes.some(type => weights[type] > 0)) weights.latex = 100
    const size = (n: unknown): number | null => typeof n === 'number' && Number.isFinite(n) && n >= 10 && n <= 1000 ? n : null
    const minSize = size(input?.minSize), maxSize = size(input?.maxSize)
    const speed = input?.inflationSpeed
    const impulse = (n: unknown): number => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 3 ? n : 1
    return { ...(['balloons', 'floaties', 'landies', 'random'].includes(String(input?.profile)) ? { profile: input!.profile } : {}), releaseImpulse: impulse(input?.releaseImpulse), popImpulse: impulse(input?.popImpulse), pushImpulse: impulse(input?.pushImpulse), inflationSpeed: typeof speed === 'number' && Number.isFinite(speed) && speed >= .1 && speed <= 5 ? speed : 1,
        minSize: minSize !== null && maxSize !== null ? Math.min(minSize, maxSize) : minSize, maxSize,
        weights, showReset: input?.showReset !== false, releaseOnFull: input?.releaseOnFull === true }
}
export function loadGenerationSettings(): GenerationSettings {
    try { return parseGenerationSettings(JSON.parse(localStorage.getItem(key) ?? 'null')) } catch { return parseGenerationSettings(null) }
}
export function saveGenerationSettings(settings: GenerationSettings): void {
    try { localStorage.setItem(key, JSON.stringify(settings)) } catch { /* keep this session usable */ }
    window.dispatchEvent(new Event('generation-settings-changed'))
}
export function weightedFinish(options: BalloonFinish[], settings: GenerationSettings, random = Math.random()): BalloonFinish {
    const weight = (type: BalloonFinish): number => settings.weights[type] + (type === 'latex' ? settings.weights.foil : 0)
    const total = options.reduce((sum, type) => sum + weight(type), 0)
    if (!total) return 'latex'
    let remaining = random * total
    for (const type of options) { remaining -= weight(type); if (remaining < 0) return type }
    return options[options.length - 1] ?? 'latex'
}

/** Apply user choices to device defaults without compounding the speed multiplier. */
export function generationConfig(base: BalloonConfig, settings: GenerationSettings): BalloonConfig {
    const maxRadius = settings.maxSize === null ? base.maxRadius : settings.maxSize / 2
    const minRadius = Math.min(settings.minSize === null ? base.minRadius ?? base.initialRadius : settings.minSize / 2, maxRadius ?? Infinity)
    return { ...base, releaseImpulseMultiplier: settings.releaseImpulse, popImpulseMultiplier: settings.popImpulse, pushImpulseMultiplier: settings.pushImpulse, growthRate: base.growthRate * settings.inflationSpeed, minRadius, maxRadius,
        initialRadius: settings.minSize === null ? Math.min(base.initialRadius, maxRadius ?? Infinity) : minRadius }
}
