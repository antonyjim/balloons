import { getRandomThemeColor } from './colors'
import { themes, themeForTime } from './themes'
import type { BalloonFinish, FinishMode, ThemeId, ThemeMode, ThemeState } from './types'

type Listener = (state: ThemeState) => void

const MODE_KEY = 'balloons.theme.mode'
const FINISH_KEY = 'balloons.theme.finish'

function readStorage(key: string): string | null {
    try { return localStorage.getItem(key) } catch { return null }
}

function writeStorage(key: string, value: string): void {
    try { localStorage.setItem(key, value) } catch { /* storage unavailable */ }
}

function validThemeMode(value: string | null): ThemeMode {
    return value === 'auto' || value === 'dawn' || value === 'day' || value === 'sunset' || value === 'night'
        ? value
        : 'auto'
}

function validFinishMode(value: string | null): FinishMode {
    return value === 'random' || value === 'latex' || value === 'hot-air' || value === 'bubble' || value === 'paint' || value === 'watermelon' || value === 'apple' || value === 'duck'
        ? value
        : 'auto'
}

export class ThemeManager {
    private mode: ThemeMode = validThemeMode(readStorage(MODE_KEY))
    private finishMode: FinishMode = validFinishMode(readStorage(FINISH_KEY))
    private listeners = new Set<Listener>()
    private timer: ReturnType<typeof setInterval> | null = null
    private state: ThemeState
    private randomFinish: BalloonFinish = 'latex'
    private nextFinishChange = 0
    private simpleMode = false

    private readonly finishes: BalloonFinish[] = [
        'latex',
        'hot-air',
        'bubble',
        'paint',
        'apple',
        'duck',
        'watermelon'
    ]
    private readonly handleVisibility = () => this.refresh()

    constructor() {
        this.state = this.resolve()
        this.timer = setInterval(() => this.refresh(), 30_000)
        document.addEventListener('visibilitychange', this.handleVisibility)
        window.addEventListener('focus', this.handleVisibility)
    }

    private resolve(): ThemeState {
        this.updateRandomFinish()

        const id = this.mode === 'auto'
            ? themeForTime()
            : this.mode

        const theme = themes[id]

        return {
            mode: this.mode,
            finishMode: this.finishMode,
            theme,
            finish: this.finishMode === 'auto' || this.finishMode === 'random' ? this.randomFinish : this.finishMode
        }
    }

    get current(): ThemeState { return this.state }

    subscribe(listener: Listener): () => void {
        this.listeners.add(listener)
        listener(this.state)
        return () => { this.listeners.delete(listener) }
    }

    refresh(): void {
        const next = this.resolve()
        if (next.theme.id === this.state.theme.id && next.mode === this.state.mode && next.finish === this.state.finish && next.finishMode === this.state.finishMode) return
        this.state = next

        for (const listener of this.listeners) listener(next)
    }

    setMode(mode: ThemeMode): void {
        this.mode = mode
        this.finishMode = 'auto'

        writeStorage(MODE_KEY, mode)
        writeStorage(FINISH_KEY, 'auto')

        this.refresh()
    }

    setFinish(mode: FinishMode): void {
        this.finishMode = mode
        writeStorage(FINISH_KEY, mode)
        this.refresh()
    }

    setSimpleMode(enabled: boolean): void {
        this.simpleMode = enabled
        if (enabled && this.randomFinish === 'watermelon') this.nextFinishChange = 0
        this.refresh()
    }

    finishForPointer(): BalloonFinish {
        if (this.finishMode !== 'random') return this.state.finish
        const options = this.finishes.filter(finish => !this.simpleMode || finish !== 'watermelon')
        return options[Math.floor(Math.random() * options.length)]
    }

    randomBalloonColor(finish = this.state.finish): string {

        const variation = finish === 'hot-air'
            ? { hue: 18, saturation: 15, lightness: 12 }
            : finish === 'bubble'
                ? { hue: 25, saturation: 8, lightness: 8 }
                : { hue: 12, saturation: 12, lightness: 10 }

        return getRandomThemeColor(
            this.state.theme,
            variation
        )
    }

    private updateRandomFinish(): void {
        const now = Date.now()

        if (now < this.nextFinishChange) return

        const options = this.finishes.filter(
            finish => finish !== this.randomFinish && (!this.simpleMode || finish !== 'watermelon')
        )

        this.randomFinish = options[
            Math.floor(Math.random() * options.length)
        ]

        this.nextFinishChange = now + 60 * 1000
    }

    destroy(): void {
        if (this.timer !== null) clearInterval(this.timer)
        document.removeEventListener('visibilitychange', this.handleVisibility)
        window.removeEventListener('focus', this.handleVisibility)
        this.listeners.clear()
    }
}

export type { BalloonFinish, ThemeId }
