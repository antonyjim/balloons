export interface ThemePalette {
    palette: readonly string[]
}

export interface ColorVariation {
    hue?: number
    saturation?: number
    lightness?: number
}

interface Hsl {
    h: number
    s: number
    l: number
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value))
}

function randomOffset(amount: number): number {
    return (Math.random() * 2 - 1) * amount
}

export function hexToHsl(hex: string): Hsl {
    const value = hex.replace('#', '')

    const r = parseInt(value.slice(0, 2), 16) / 255
    const g = parseInt(value.slice(2, 4), 16) / 255
    const b = parseInt(value.slice(4, 6), 16) / 255

    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const delta = max - min

    let h = 0
    let s = 0

    const l = (max + min) / 2

    if (delta !== 0) {
        s = delta / (1 - Math.abs(2 * l - 1))

        switch (max) {
            case r:
                h = ((g - b) / delta) % 6
                break
            case g:
                h = (b - r) / delta + 2
                break
            default:
                h = (r - g) / delta + 4
        }

        h *= 60
    }

    return {
        h: (h + 360) % 360,
        s: s * 100,
        l: l * 100
    }
}

export function hslToHex(h: number, s: number, l: number): string {
    h = ((h % 360) + 360) % 360
    s = clamp(s, 0, 100) / 100
    l = clamp(l, 0, 100) / 100

    const chroma = (1 - Math.abs(2 * l - 1)) * s
    const x = chroma * (1 - Math.abs((h / 60) % 2 - 1))
    const m = l - chroma / 2

    let r = 0
    let g = 0
    let b = 0

    if (h < 60) {
        r = chroma
        g = x
    } else if (h < 120) {
        r = x
        g = chroma
    } else if (h < 180) {
        g = chroma
        b = x
    } else if (h < 240) {
        g = x
        b = chroma
    } else if (h < 300) {
        r = x
        b = chroma
    } else {
        r = chroma
        b = x
    }

    return '#' + [r, g, b]
        .map(value =>
            Math.round((value + m) * 255)
                .toString(16)
                .padStart(2, '0')
        )
        .join('')
}

export function varyColor(
    hex: string,
    variation: ColorVariation = {}
): string {
    const {
        hue = 12,
        saturation = 12,
        lightness = 10
    } = variation

    const hsl = hexToHsl(hex)

    return hslToHex(
        hsl.h + randomOffset(hue),
        clamp(hsl.s + randomOffset(saturation), 25, 100),
        clamp(hsl.l + randomOffset(lightness), 25, 85)
    )
}

export function getRandomThemeColor(
    theme: ThemePalette,
    variation: ColorVariation = {}
): string {
    if (theme.palette.length === 0) {
        return '#ff6699'
    }

    const base = theme.palette[
        Math.floor(Math.random() * theme.palette.length)
    ]

    return varyColor(base, variation)
}

export function getRandomPanelColors(
    theme: ThemePalette,
    count = 6
): string[] {
    if (theme.palette.length === 0) {
        return Array(count).fill('#ff6699')
    }

    const shuffled = [...theme.palette]

    // Fisher-Yates shuffle
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))

        const temp = shuffled[i]
        shuffled[i] = shuffled[j]
        shuffled[j] = temp
    }

    return Array.from({ length: count }, (_, i) =>
        varyColor(
            shuffled[i % shuffled.length],
            {
                hue: 8,
                saturation: 8,
                lightness: 6
            }
        )
    )
}