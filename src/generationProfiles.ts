import { generationTypes, parseGenerationSettings, type GenerationType, type GenerationSettings } from './generationSettings'
export const generationProfiles = {
    balloons: { label: 'Balloons only', description: 'Balloons with 5% Mylar; 1.4x inflation, continuous spawning, medium impulses, 120-440px diameters. Hides the menu.', hideMenu: true },
    floaties: { label: 'Floaties only', description: 'Balloons, Mylar, bubbles and hot-air balloons; continuous spawning. Hides the menu.', hideMenu: true },
    landies: { label: 'Landies only', description: 'Apples, ducks, watermelons and paint balloons.', hideMenu: false },
    random: { label: 'Random', description: 'All objects, with apples weighted one-fifth as often as other groups.', hideMenu: false }
} as const
export type GenerationProfile = keyof typeof generationProfiles
export function profileSettings(id: GenerationProfile): GenerationSettings {
    const weights = Object.fromEntries(generationTypes.map(type => [type, 0])) as Record<GenerationType, number>
    const set = (types: GenerationType[]): void => { for (const type of types) weights[type] = 100 }
    if (id === 'landies') set(['apple', 'duck', 'watermelon', 'paint'])
    else {
        weights.latex = 95; weights.foil = 5
        if (id !== 'balloons') set(['bubble', 'hot-air'])
        if (id === 'random') { set(['duck', 'watermelon', 'paint']); weights.apple = 20 }
    }
    return parseGenerationSettings({ profile: id, weights, releaseOnFull: id === 'balloons' || id === 'floaties',
        ...(id === 'balloons' ? { inflationSpeed: 1.4, minSize: 120, maxSize: 440, releaseImpulse: .6, popImpulse: .6, pushImpulse: .6 } : {}) })
}
