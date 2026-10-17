export const RESET_DEADLINE_SECONDS = 9

/** Keep small resets leisurely; finish the pop sequence within six seconds. */
export function resetPopsDue(count: number, elapsedSeconds: number): number {
    if (count <= 0) return 0
    const interval = Math.min(0.075, 6 / count)
    return Math.min(count, Math.floor(Math.max(0, elapsedSeconds) / interval))
}
