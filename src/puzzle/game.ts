export interface JigsawEdge { center: number; neck: number; radius: number; depth: number; bow: number; sign: number }
/** A shared boundary is keyed once, so its two pieces always have complementary cuts. */
export function jigsawEdge(seed: string, axis: 'h' | 'v', row: number, col: number): JigsawEdge {
    let state = 2166136261
    for (const char of `${seed}:${axis}:${row}:${col}`) state = Math.imul(state ^ char.charCodeAt(0), 16777619)
    const random = (): number => {
        state += 0x6d2b79f5
        let value = Math.imul(state ^ state >>> 15, state | 1)
        value ^= value + Math.imul(value ^ value >>> 7, value | 61)
        return ((value ^ value >>> 14) >>> 0) / 4294967296
    }
    return { center: 43 + random() * 14, neck: 5 + random() * 2, radius: 15 + random() * 3, depth: 25 + random() * 4, bow: 4 + random() * 5, sign: random() < .5 ? -1 : 1 }
}

/** Coordinates use 100 units per tile. The round ID keeps restored shapes stable. */
export function piecePath(row: number, col: number, size: number, seed = 'default'): string {
    const points: string[] = ['M 0 0']
    const segment = (originX: number, originY: number, dx: number, dy: number, edge?: JigsawEdge, reverse = false): void => {
        const xy = (a: number, b: number): string => `${originX + a * dx - b * dy} ${originY + a * dy + b * dx}`
        if (!edge) { points.push(`L ${xy(100, 0)}`); return }
        const center = reverse ? 100 - edge.center : edge.center
        const sign = reverse ? -edge.sign : edge.sign
        const { neck, radius, depth, bow } = edge
        const curve = (a: number, b: number): string => xy(center + a, -b * depth * sign)
        points.push(`C ${xy(12, bow * sign)} ${xy(center - neck - 12, bow * sign)} ${curve(-neck, 0)}`)
        points.push(`C ${curve(-neck, .2)} ${curve(-radius, .2)} ${curve(-radius, .6)}`)
        points.push(`C ${curve(-radius, 1.15)} ${curve(radius, 1.15)} ${curve(radius, .6)}`)
        points.push(`C ${curve(radius, .2)} ${curve(neck, .2)} ${curve(neck, 0)}`)
        points.push(`C ${xy(center + neck + 12, bow * sign)} ${xy(88, bow * sign)} ${xy(100, 0)}`)
    }
    segment(0, 0, 1, 0, row === 0 ? undefined : jigsawEdge(seed, 'h', row, col))
    segment(100, 0, 0, 1, col === size - 1 ? undefined : jigsawEdge(seed, 'v', row, col + 1))
    segment(100, 100, -1, 0, row === size - 1 ? undefined : jigsawEdge(seed, 'h', row + 1, col), true)
    segment(0, 100, 0, -1, col === 0 ? undefined : jigsawEdge(seed, 'v', row, col), true)
    return points.join(' ') + ' Z'
}
export function shuffledPieces(size: number): number[] {
    const values = Array.from({ length: size * size }, (_, i) => i)
    for (let i = values.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[values[i], values[j]] = [values[j], values[i]]
    }
    return values
}
