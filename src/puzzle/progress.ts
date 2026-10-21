export interface PuzzleProgress { placed: number[]; order: number[]; savedAt: number; solved: boolean; activityId: string }
export const PROGRESS_TTL = 60 * 60_000
export function restorable(progress: PuzzleProgress | undefined, size: number, now: number): progress is PuzzleProgress {
    return !!progress && !progress.solved && now >= progress.savedAt && now - progress.savedAt < PROGRESS_TTL
        && typeof progress.activityId === 'string' && Array.isArray(progress.placed) && Array.isArray(progress.order)
        && progress.order.length === size * size && new Set(progress.order).size === size * size
        && progress.order.every(id => Number.isInteger(id) && id >= 0 && id < size * size)
        && new Set(progress.placed).size === progress.placed.length && progress.placed.length < size * size
        && progress.placed.every(id => progress.order.includes(id))
}
