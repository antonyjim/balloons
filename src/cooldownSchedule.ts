import type { AppView } from './navigation'
export const scheduleApps: Record<AppView, string> = { balloons: 'Balloons', sketchpad: 'Drawing', matching: 'Letters', puzzle: 'Puzzles' }
export interface ScheduleSettings { enabled: boolean; screensaverMinutes: number; apps: { app: AppView; minutes: number }[] }
export const defaultSchedule: ScheduleSettings = { enabled: false, screensaverMinutes: 2, apps: [{ app: 'balloons', minutes: 5 }, { app: 'sketchpad', minutes: 5 }] }
const minutes = (value: unknown, fallback: number): number => typeof value === 'number' && Number.isFinite(value) && value >= .1 && value <= 240 ? value : fallback
export function parseSchedule(value: unknown): ScheduleSettings {
    const input = value as Partial<ScheduleSettings> | null
    const apps: ScheduleSettings['apps'] = []
    if (Array.isArray(input?.apps)) for (const item of input.apps.slice(0, 4)) {
        if (item && Object.hasOwn(scheduleApps, item.app) && !apps.some(row => row.app === item.app)) apps.push({ app: item.app, minutes: minutes(item.minutes, 5) })
    }
    return { enabled: input?.enabled === true && apps.length > 0, apps: apps.length ? apps : defaultSchedule.apps.map(row => ({ ...row })), screensaverMinutes: minutes(input?.screensaverMinutes, 2) }
}
export class CooldownSchedule {
    constructor(public settings: ScheduleSettings = parseSchedule(null), public startedAt = 0) {}
    current(now: number, allowed: AppView[] = Object.keys(scheduleApps) as AppView[], screensaverEnabled = true): { app: AppView; screensaver: boolean; remaining: number } | null {
        if (!this.settings.enabled) return null
        const apps = this.settings.apps.filter(row => allowed.includes(row.app))
        if (!apps.length) return null
        const pause = screensaverEnabled ? this.settings.screensaverMinutes * 60_000 : 0
        const cycle = apps.reduce((sum, row) => sum + row.minutes * 60_000 + pause, 0)
        let offset = Math.max(0, now - this.startedAt) % cycle
        for (const row of apps) {
            const duration = row.minutes * 60_000
            if (offset < duration) return { app: row.app, screensaver: false, remaining: duration - offset }
            offset -= duration
            if (offset < pause) return { app: row.app, screensaver: true, remaining: pause - offset }
            offset -= pause
        }
        return null
    }
}
