import { ActivityLog, type Activity, type ActivityEvent } from './activityLog'
const KEY = 'balloons.activity-log.v1'
const labels: Record<Activity, string> = { balloons: 'Bubbles', sketchpad: 'Drawing', matching: 'Letters', puzzle: 'Puzzles' }
const duration = (ms: number): string => `${Math.floor(ms / 60_000)}m ${Math.floor(ms / 1000) % 60}s`
export function setupActivityLog(): { view(activity: Activity): void; puzzle(kind: 'activity' | 'solve', detail: string, solved?: boolean, id?: string): void } {
    let events: ActivityEvent[] = []
    try {
        const data = JSON.parse(localStorage.getItem(KEY) ?? 'null')
        if (Array.isArray(data?.events)) events = data.events.filter((e: ActivityEvent) => e && e.activity in labels && ['start', 'end', 'activity'].includes(e.kind) && Number.isFinite(e.at) && typeof e.name === 'string' && (e.duration === undefined || (Number.isFinite(e.duration) && e.duration >= 0)))
    } catch { /* Start an empty local log. */ }
    const log = new ActivityLog(events)
    const host = document.createElement('aside'); host.id = 'activity-log'
    host.hidden = true
    const root = host.attachShadow({ mode: 'open' })
    root.innerHTML = `<style>:host{position:fixed;right:12px;bottom:12px;z-index:45;font:15px system-ui;color:#344559}*{box-sizing:border-box}details{background:#fffdf6;border:1px solid #bbc9c2;border-radius:14px;box-shadow:0 4px 24px #17263422}summary{padding:12px 18px;cursor:pointer;min-height:44px}details[open]{width:min(380px,calc(100vw - 24px))}.panel{padding:0 16px 16px;max-height:75dvh;overflow:auto}label{display:block;margin:12px 0}input,button{font:inherit;border:1px solid #bbc9c2;border-radius:8px;padding:8px;max-width:100%}input{width:100%;margin-top:6px}table{width:100%;border-collapse:collapse}td,th{text-align:left;padding:6px 2px}ol{padding-left:20px}li{padding:8px 0;border-bottom:1px solid #e1e7e1}small{color:#657182}button{cursor:pointer}h2{font-size:18px}.status{color:#9c3b30}</style><details><summary>Activity log</summary><div class="panel"><p>Active time by activity</p><table><thead><tr><th>Activity</th><th>Time</th></tr></thead><tbody></tbody></table><p id="counts"></p><small>Five minutes without input ends an activity. That idle period is removed. Time may adjust when an activity ends.</small><p><button id="export" style="display: none">Export log</button></p><p class="status" role="status"></p><h2>History</h2><ol></ol></div></details>`
    document.body.append(host)
    const details = root.querySelector('details')!
    let dirty = false
    const persist = (): void => {
        try { localStorage.setItem(KEY, JSON.stringify({ events: log.events })); dirty = false }
        catch { root.querySelector<HTMLElement>('.status')!.textContent = 'Log storage is full or unavailable. Export the log to keep a copy.' }
    }
    const render = (): void => {
        if (!details.open) return
        const now = Date.now(), totals = log.totals(now)
        const body = root.querySelector('tbody')!; body.replaceChildren()
        for (const activity of Object.keys(labels) as Activity[]) {
            const row = document.createElement('tr'), label = document.createElement('td'), time = document.createElement('td')
            label.textContent = labels[activity]; time.textContent = duration(totals[activity]); row.append(label, time); body.append(row)
        }
        root.querySelector('#counts')!.textContent = `${log.events.filter(e => e.kind === 'activity').length} puzzle activities / ${log.events.filter(e => e.kind === 'activity' && e.solved).length} solved`
        const history = root.querySelector('ol')!; history.replaceChildren()
        for (const event of log.events.slice(-200).reverse()) {
            const li = document.createElement('li')
            li.textContent = `${new Date(event.at).toLocaleString()} - ${labels[event.activity]}: ${event.kind}${event.kind === 'activity' ? ` (solved = ${event.solved === true})` : ''}${event.detail ? ` - ${event.detail}` : ''}${event.duration !== undefined ? ` - ${duration(event.duration)} (${event.reason})` : ''}`
            history.append(li)
        }
    }

    details.addEventListener('toggle', render)
    const recordInput = (event: Event): void => {
        if (event.composedPath().includes(host) || document.hidden) return
        if (event.type === 'pointermove' && !(event as PointerEvent).buttons) return
        log.input(Date.now()); dirty = true
    }
    for (const type of ['pointerdown', 'pointermove', 'keydown', 'wheel']) document.addEventListener(type, recordInput, { capture: true, passive: true })
    const end = (): void => { log.end(log.current?.last ?? Date.now(), 'page hidden'); persist(); render() }
    document.addEventListener('visibilitychange', () => { if (document.hidden) end() })
    window.addEventListener('pagehide', end)
    window.setInterval(() => { if (log.tick(Date.now())) { dirty = true; document.dispatchEvent(new Event('activity-idle')) } if (dirty) persist(); render() }, 1000)
    root.querySelector<HTMLButtonElement>('#export')!.onclick = () => {
        const now = Date.now()
        const url = URL.createObjectURL(new Blob([JSON.stringify({ totals: log.totals(now), events: log.events, current: log.current, exportedAt: now }, null, 2)], { type: 'application/json' }))
        const a = document.createElement('a'); a.href = url; a.download = 'activity-log.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
    }
    return {
        view(activity) {
            host.hidden = activity !== 'puzzle'
            if (host.hidden) details.open = false
            log.view(activity, Date.now()); persist(); render()
        },
        puzzle(kind, detail, solved, id) { log.puzzle(kind, detail, solved, Date.now(), id); persist(); render() }
    }
}
