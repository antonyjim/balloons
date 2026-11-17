import { bindActivation } from './activation'
import { defaultSchedule, parseSchedule, scheduleApps, type ScheduleSettings } from './cooldownSchedule'
import type { AppView } from './navigation'

export function openScheduleBuilder(settings: ScheduleSettings, save: (settings: ScheduleSettings) => void, screensaverEnabled = true): void {
    const dialog = document.createElement('dialog')
    dialog.className = 'play-settings schedule-settings'
    dialog.setAttribute('aria-label', 'Cooldown schedule builder')
    const draft = structuredClone(settings)
    const order = [...draft.apps.map(row => row.app), ...(Object.keys(scheduleApps) as AppView[]).filter(app => !draft.apps.some(row => row.app === app))]
    let allowed = Object.keys(scheduleApps) as AppView[]
    try { const saved = JSON.parse(localStorage.getItem('balloons.enabled-games') ?? 'null'); if (Array.isArray(saved) && saved.length) allowed = allowed.filter(app => saved.includes(app)) } catch { /* all apps */ }
    dialog.innerHTML = `<form><h2>Cooldown schedule</h2><label class="schedule-check"><input name="enabled" type="checkbox"> Enable repeating schedule</label><p>Choose apps, set their minutes, and arrange the order. ${screensaverEnabled ? 'A screensaver break follows every app.' : 'Screensaver is disabled; apps follow each other without breaks.'} The sequence repeats forever.</p><div class="schedule-apps"></div><label>Screensaver after each app (minutes)<input name="pause" type="number" min="0.1" max="240" step="0.1" required></label><p class="schedule-preview" aria-live="polite"></p><p role="status"></p><p>Saving an enabled schedule starts the first app immediately. During scheduled screensaver breaks, touch cannot skip the break. The schedule replaces the activity timer while enabled.</p><div class="play-settings-actions"><button type="button" data-cancel>Cancel</button><button type="submit">Save schedule</button></div></form>`
    document.body.append(dialog)
    const enabled = dialog.querySelector<HTMLInputElement>('[name=enabled]')!, pause = dialog.querySelector<HTMLInputElement>('[name=pause]')!
    enabled.checked = draft.enabled; pause.value = String(draft.screensaverMinutes); pause.disabled = !screensaverEnabled
    const preview = (): void => {
        const selected = order.filter(app => draft.apps.some(row => row.app === app) && allowed.includes(app))
        dialog.querySelector('.schedule-preview')!.textContent = selected.map(app => `${scheduleApps[app]} (${draft.apps.find(row => row.app === app)!.minutes} min)${screensaverEnabled ? ` \u2192 Screensaver (${pause.value} min)` : ''}`).join(' \u2192 ') + (selected.length ? ' \u2192 \u221e Repeat' : 'Choose at least one enabled app.')
    }
    const render = (): void => {
        const list = dialog.querySelector('.schedule-apps')!; list.replaceChildren()
        order.forEach((app, index) => {
            const row = document.createElement('div'); row.className = 'schedule-row'
            row.innerHTML = `<label class="schedule-check"><input type="checkbox"> ${scheduleApps[app]}${allowed.includes(app) ? '' : ' (disabled in menu)'}</label><label class="schedule-minutes">Minutes<input type="number" min="0.1" max="240" step="0.1" required aria-label="${scheduleApps[app]} minutes"></label><div><button type="button" data-up aria-label="Move ${scheduleApps[app]} earlier">&#8593;</button><button type="button" data-down aria-label="Move ${scheduleApps[app]} later">&#8595;</button></div>`
            const check = row.querySelector<HTMLInputElement>('[type=checkbox]')!, duration = row.querySelector<HTMLInputElement>('[type=number]')!
            check.disabled = !allowed.includes(app); check.checked = allowed.includes(app) && draft.apps.some(item => item.app === app)
            duration.value = String(draft.apps.find(item => item.app === app)?.minutes ?? 5); duration.disabled = !check.checked
            check.onchange = () => { draft.apps = draft.apps.filter(item => item.app !== app); if (check.checked) draft.apps.push({ app, minutes: Number(duration.value) }); duration.disabled = !check.checked; preview() }
            duration.oninput = () => { const item = draft.apps.find(item => item.app === app); if (item) item.minutes = Number(duration.value); preview() }
            for (const [selector, delta] of [['[data-up]', -1], ['[data-down]', 1]] as const) {
                const button = row.querySelector<HTMLButtonElement>(selector)!; button.disabled = index + delta < 0 || index + delta >= order.length
                bindActivation(button, () => { [order[index], order[index + delta]] = [order[index + delta], order[index]]; render() })
            }
            list.append(row)
        }); preview()
    }
    pause.oninput = preview
    bindActivation(dialog.querySelector<HTMLElement>('[data-cancel]')!, () => dialog.close())
    dialog.addEventListener('close', () => dialog.remove())
    dialog.querySelector('form')!.onsubmit = event => {
        event.preventDefault()
        const apps = order.filter(app => allowed.includes(app)).flatMap(app => { const item = draft.apps.find(row => row.app === app); return item ? [item] : [] })
        if (enabled.checked && !apps.length) { dialog.querySelector('[role=status]')!.textContent = 'Choose at least one app.'; return }
        save(parseSchedule({ enabled: enabled.checked, screensaverMinutes: Number(pause.value), apps: apps.length ? apps : defaultSchedule.apps }))
        dialog.close()
    }
    render(); dialog.showModal()
}
