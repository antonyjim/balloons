import type { BalloonFinish } from './theme/types'

export const generationTypes = ['latex', 'foil', 'hot-air', 'bubble', 'paint', 'apple', 'duck', 'watermelon'] as const
export type GenerationType = typeof generationTypes[number]
export interface GenerationSettings { weights: Record<GenerationType, number>; showReset: boolean; releaseOnFull: boolean }
const key = 'balloons.generation.settings'
export const generationLabels: Record<GenerationType, string> = { latex: 'Latex balloons', foil: 'Mylar balloons', 'hot-air': 'Hot-air balloons', bubble: 'Bubbles', paint: 'Paint balloons', apple: 'Apples', duck: 'Rubber birds', watermelon: 'Watermelons' }
export function parseGenerationSettings(value: unknown): GenerationSettings {
    const input = value as Partial<GenerationSettings> | null
    const weights = Object.fromEntries(generationTypes.map(type => {
        const n = input?.weights?.[type]
        return [type, typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 100 ? n : type === 'latex' ? 82 : type === 'foil' ? 18 : 100]
    })) as Record<GenerationType, number>
    if (!generationTypes.some(type => weights[type] > 0)) weights.latex = 100
    return { weights, showReset: input?.showReset !== false, releaseOnFull: input?.releaseOnFull === true }
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
