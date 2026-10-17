export interface PlaySettings { enabled: boolean; timeLimit: number; cooldown: number; cooldownApp?: 'matching' | 'sketchpad' | 'alternate' }
export const defaultPlaySettings: PlaySettings = { enabled: false, timeLimit: 5, cooldown: 2 }
export function parsePlaySettings(value: unknown): PlaySettings {
    const input = value as Partial<PlaySettings> | null
    const minutes = (value: unknown, fallback: number): number =>
        typeof value === 'number' && Number.isFinite(value) && value >= 0.1 && value <= 240 ? value : fallback
    return { enabled: input?.enabled === true, timeLimit: minutes(input?.timeLimit, 5), cooldown: minutes(input?.cooldown, 2), ...(input?.cooldownApp === 'matching' || input?.cooldownApp === 'alternate' ? { cooldownApp: input.cooldownApp } : {}) }
}

/** Wall-clock deadlines keep background tabs from extending a play session. */
export class PlaySession {
    startedAt: number | null = null
    lastObjectAt: number
    phase: 'play' | 'cooldown' | 'ready' = 'play'
    cooldownUntil = 0
    cooldownActivity: 'sketchpad' | 'matching' = 'sketchpad'
    private nextAlternate: 'sketchpad' | 'matching' = 'sketchpad'
    constructor(public settings: PlaySettings, now: number) { this.lastObjectAt = now }
    get idleDurationMs(): number { return this.settings.cooldown * 60_000 }
    get screensaverDurationMs(): number { return Math.max(10, this.settings.timeLimit) * 60_000 }
    screensaverDue(now: number): boolean { return now - this.lastObjectAt >= this.screensaverDurationMs }
    objectCreated(now: number): void {
        if (this.phase !== 'play') return
        if (this.startedAt === null || now - this.lastObjectAt >= this.idleDurationMs) this.startedAt = now
        this.lastObjectAt = now
    }
    tick(now: number): void {
        if (this.phase === 'play' && this.settings.enabled && this.startedAt !== null
            && now - this.lastObjectAt < this.idleDurationMs && now - this.startedAt >= this.settings.timeLimit * 60_000) {
            this.phase = 'cooldown'
            this.cooldownActivity = this.settings.cooldownApp === 'alternate' ? this.nextAlternate
                : this.settings.cooldownApp === 'matching' ? 'matching' : 'sketchpad'
            if (this.settings.cooldownApp === 'alternate') {
                this.nextAlternate = this.cooldownActivity === 'sketchpad' ? 'matching' : 'sketchpad'
            }
            this.cooldownUntil = this.startedAt + (this.settings.timeLimit + this.settings.cooldown) * 60_000
        }
        if (this.phase === 'cooldown' && now >= this.cooldownUntil) this.phase = 'ready'
    }
    idle(now: number): boolean { return now - this.lastObjectAt >= this.idleDurationMs }
    returnToPlay(now: number): void {
        this.phase = 'play'
        this.startedAt = null
        this.lastObjectAt = now
    }
    configure(settings: PlaySettings, now: number): void {
        this.settings = settings
        this.returnToPlay(now)
    }
}
