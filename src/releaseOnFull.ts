/** Bias release sizes toward large while staying below pop-at-maximum limits. */
export function releaseRadius(minimum: number, maximum: number, room: number, random = Math.random()): number {
    const ceiling = Math.min(maximum * .96, room * .98)
    return Math.max(minimum, minimum + Math.max(0, ceiling - minimum) * (.4 + .6 * Math.sqrt(Math.max(0, Math.min(1, random)))))
}
