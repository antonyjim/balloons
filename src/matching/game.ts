export const SYMBOLS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
export class MatchingGame {
    symbols: string[] = []
    matched = new Set<string>()
    pending: string | null = null
    constructor(private random: () => number = Math.random) { this.newRound() }
    newRound(): void {
        this.symbols = [...SYMBOLS]
        this.matched.clear()
        this.pending = null
    }
    dispense(): string | null {
        if (this.pending !== null) return this.pending
        if (this.matched.size === this.symbols.length) this.newRound()
        const choices = this.symbols.filter(symbol => !this.matched.has(symbol))
        this.pending = choices[Math.floor(this.random() * choices.length)]
        return this.pending
    }
    place(symbol: string): boolean {
        if (this.pending === null || this.pending !== symbol || this.matched.has(symbol)) return false
        this.matched.add(symbol)
        this.pending = null
        return true
    }
}
