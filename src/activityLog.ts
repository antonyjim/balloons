export type Activity = 'balloons' | 'sketchpad' | 'matching' | 'puzzle'
export interface ActivityEvent {
    at: number; name: string; activity: Activity; kind: 'start' | 'end' | 'activity'
    id?: string; solved?: boolean; detail?: string; duration?: number; reason?: string
}
export const INACTIVITY_MS = 5 * 60_000
export class ActivityLog {
    events: ActivityEvent[] = []
    name = ''
    activity: Activity = 'balloons'
    current: { start: number; last: number; name: string; activity: Activity } | null = null
    constructor(events: ActivityEvent[] = [], name = '') { this.events = events; this.name = name }
    private add(event: ActivityEvent): void { this.events.push(event) }
    tick(now: number): boolean {
        if (!this.current || now - this.current.last < INACTIVITY_MS) return false
        this.end(this.current.last, 'inactive')
        return true
    }
    input(now: number): void {
        this.tick(now)
        if (!this.current) {
            this.current = { start: now, last: now, name: this.name, activity: this.activity }
            this.add({ at: now, name: this.name, activity: this.activity, kind: 'start' })
        }
        this.current.last = now
    }
    end(now: number, reason: string): void {
        if (!this.current) return
        const current = this.current
        const end = now - current.last >= INACTIVITY_MS ? current.last : now
        this.add({ at: end, name: current.name, activity: current.activity, kind: 'end', duration: Math.max(0, end - current.start), reason })
        this.current = null
    }
    view(activity: Activity, now: number): void {
        if (activity === this.activity) return
        this.end(now, 'switched activity'); this.activity = activity
    }
    rename(name: string, now: number): void {
        const next = name.trim().slice(0, 100)
        if (next === this.name) return
        this.end(now, 'changed name'); this.name = next
    }
    puzzle(kind: 'activity' | 'solve', detail: string, solved: boolean | undefined, now: number, id?: string): void {
        let event = id ? this.events.find(e => e.kind === 'activity' && e.id === id) : undefined
        if (!event) {
            event = { at: now, name: '', activity: 'puzzle', kind: 'activity', detail, id, solved: false }
            this.add(event)
        }
        event.detail = detail
        if (kind === 'solve' || solved) event.solved = true
    }
    totals(now: number, name?: string): Record<Activity, number> {
        this.tick(now)
        const totals = { balloons: 0, sketchpad: 0, matching: 0, puzzle: 0 }
        for (const event of this.events) if (event.kind === 'end' && (name === undefined || event.name === name)) totals[event.activity] += event.duration ?? 0
        if (this.current && (name === undefined || this.current.name === name)) totals[this.current.activity] += Math.max(0, now - this.current.start)
        return totals
    }
}
