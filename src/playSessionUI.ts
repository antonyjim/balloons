import { CooldownSchedule, parseSchedule } from './cooldownSchedule'
import { openScheduleBuilder } from './cooldownScheduleUI'
import { bindActivation } from './activation'
import { PlaySession, defaultPlaySettings, parsePlaySettings } from './playSession'
import { createMystify } from './mystify'
import { playPopSound, unlockAudio } from './audio'
import type { AppView } from './navigation'

const SETTINGS_KEY = 'balloons.play.settings'
const SESSION_KEY = 'balloons.play.session.v1'
export function setupPlaySession(onBreak: () => void): { objectCreated(): void; resolveView(view: AppView): AppView; showScreensaver(): void } {
    let saved = defaultPlaySettings
    try { saved = parsePlaySettings(JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? 'null')) } catch { /* use defaults */ }
    let adminPaused = false
    const schedule = new CooldownSchedule()
    const scheduleKey = 'balloons.cooldown-schedule.v1'
    const readSchedule = (): void => {
        try {
            const saved = JSON.parse(localStorage.getItem(scheduleKey) ?? 'null')
            schedule.settings = parseSchedule(saved?.settings)
            schedule.startedAt = typeof saved?.startedAt === 'number' && Number.isFinite(saved.startedAt) ? saved.startedAt : Date.now()
        } catch { /* retain current schedule if storage is unavailable */ }
    }
    readSchedule()
    const scheduleState = () => {
        if (adminPaused || !schedule.settings.enabled) return null
        let allowed: AppView[] | undefined
        try { const saved = JSON.parse(localStorage.getItem('balloons.enabled-games') ?? 'null'); if (Array.isArray(saved) && saved.length) allowed = saved } catch { /* all apps */ }
        return schedule.current(Date.now(), allowed, session.settings.screensaverEnabled !== false)
    }
    const session = new PlaySession(saved, Date.now())
    const readSession = (): void => {
        try { session.restore(JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null')) } catch { /* storage unavailable */ }
    }
    const saveSession = (): void => {
        try { localStorage.setItem(SESSION_KEY, JSON.stringify(session.snapshot())) } catch { /* keep playing in memory */ }
    }
    readSession()
    session.tick(Date.now())
    saveSession()
    const saver = createMystify(() => { session.tick(Date.now()); return adminPaused || !scheduleState()?.screensaver && !( !scheduleState() && session.phase === 'cooldown' && session.settings.cooldownApp === 'off') })
    let idleShown = false
    const returnBalloon = document.createElement('button')
    returnBalloon.type = 'button'
    returnBalloon.className = 'cooldown-balloon'
    returnBalloon.hidden = true
    returnBalloon.setAttribute('aria-label', 'Pop balloon to return to Balloons')
    returnBalloon.innerHTML = '<img src="/icons/objects/latex.svg" alt="" draggable="false"><span>Pop to play</span>'
    document.body.append(returnBalloon)
    const countdown = document.createElement('div')
    countdown.className = 'timeout-countdown'
    countdown.hidden = true
    countdown.setAttribute('role', 'status')
    countdown.setAttribute('aria-live', 'polite')
    countdown.setAttribute('aria-atomic', 'true')
    document.body.append(countdown)
    const sync = (): void => {
        const scheduled = scheduleState()
        const idleRemaining = session.screensaverDurationMs - (Date.now() - session.lastObjectAt)
        const idleWarning = session.settings.screensaverEnabled !== false && idleRemaining > 0 && idleRemaining <= 10000 ? Math.ceil(idleRemaining / 1000) : null
        const warning = adminPaused ? null : scheduled ? (!scheduled.screensaver && scheduled.remaining > 0 && scheduled.remaining <= 10000 ? Math.ceil(scheduled.remaining / 1000) : null) : session.countdownSeconds(Date.now()) ?? idleWarning
        countdown.hidden = warning === null || document.hidden || saver.visible()
        if (!countdown.hidden) {
            const message = `Timeout in ${warning} ${warning === 1 ? 'second' : 'seconds'}`
            if (countdown.textContent !== message) countdown.textContent = message
        }

        const timer = document.getElementById('play-timer')
        if (timer) {
            const now = Date.now()
            const remaining = scheduled ? scheduled.remaining : session.phase === 'cooldown' ? session.cooldownUntil - now
                : session.phase === 'ready' ? 0
                : session.settings.timeLimit * 60_000 - (session.startedAt === null || session.idle(now) ? 0 : now - session.startedAt)
            const seconds = Math.max(0, Math.ceil(remaining / 1000))
            timer.textContent = adminPaused ? 'Paused' : (scheduled || session.settings.enabled) ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` : 'Off'
            timer.setAttribute('aria-label', adminPaused ? 'Automatic switching paused by administrator' : scheduled ? `${scheduled.screensaver ? 'Screensaver' : scheduled.app} time remaining: ${timer.textContent}` : session.settings.enabled ? `Play time remaining: ${timer.textContent}` : 'Play timer disabled')
            timer.parentElement?.setAttribute('title', session.settings.enabled ? 'Starts with the first object; resets after an idle cooldown' : 'Play timer disabled')
        }
        const drawing = location.hash === '#/sketchpad' || location.hash === '#/matching' || location.hash === '#/puzzle'
        returnBalloon.hidden = !!scheduled || session.phase !== 'ready' || !drawing
        const puzzleReturn = document.getElementById('puzzle-view')?.shadowRoot?.querySelector<HTMLButtonElement>('#puzzle-return')
        if (puzzleReturn) {
            puzzleReturn.disabled = !!scheduled || session.phase === 'cooldown'
            const wait = Math.max(0, Math.ceil((session.cooldownUntil - Date.now()) / 1000))
            puzzleReturn.textContent = session.phase === 'cooldown' ? `Bubbles in ${Math.floor(wait / 60)}:${String(wait % 60).padStart(2, '0')}` : 'Return to bubbles'
            puzzleReturn.onclick = () => {
                readSession(); if (scheduleState() || session.phase === 'cooldown') return; session.returnToPlay(Date.now()); saveSession(); location.hash = '/balloons'; sync()
            }
        }
        for (const id of ['back-to-balloons', 'use-drawing']) {
            for (const host of ['sketchpad-view', 'matching-view', 'puzzle-view']) {
                const control = document.getElementById(host)?.shadowRoot?.querySelector<HTMLElement>(`#${id}`)
                if (control) control.hidden = !!scheduled || session.phase !== 'play'
            }
        }
    }
    const popReturnBalloon = (): void => {
        if (session.phase !== 'ready' || returnBalloon.hidden) return
        unlockAudio()
        playPopSound('latex')
        readSession()
        if (session.phase !== 'ready') return
        session.returnToPlay(Date.now())
        saveSession()
        idleShown = false
        returnBalloon.hidden = true
        location.hash = '/balloons'
        sync()
    }
    // Pop on contact, like objects in the main canvas. Do not require a precise
    // pointer-up inside a moving target or a synthesized touch click.
    returnBalloon.addEventListener('pointerdown', event => {
        if (event.button !== 0) return
        event.preventDefault()
        event.stopPropagation()
        popReturnBalloon()
    })
    returnBalloon.addEventListener('click', popReturnBalloon) // Keyboard activation.

    const dialog = document.createElement('dialog')
    dialog.className = 'play-settings'
    dialog.setAttribute('aria-labelledby', 'play-settings-title')
    dialog.innerHTML = `<form method="dialog">
        <h2 id="play-settings-title">Activity timer settings</h2>
        <div class="timer-duration"><label for="timer-timeLimit">Time limit <span>(minutes)</span></label><div class="timer-stepper"><button type="button" data-adjust="timeLimit-down" aria-label="Decrease time limit by one minute">-</button><input id="timer-timeLimit" name="timeLimit" type="number" inputmode="decimal" min="0.1" max="240" step="0.1" required><button type="button" data-adjust="timeLimit-up" aria-label="Increase time limit by one minute">+</button></div><div class="timer-presets" role="group" aria-label="Time limit presets">${[1, 5, 10, 15].map(minutes => `<button type="button" data-preset="timeLimit-${minutes}" aria-label="Set time limit to ${minutes} minutes">${minutes} min</button>`).join('')}</div></div>
        <div class="timer-duration"><label for="timer-cooldown">Cooldown <span>(minutes)</span></label><div class="timer-stepper"><button type="button" data-adjust="cooldown-down" aria-label="Decrease cooldown by one minute">-</button><input id="timer-cooldown" name="cooldown" type="number" inputmode="decimal" min="0.1" max="240" step="0.1" required><button type="button" data-adjust="cooldown-up" aria-label="Increase cooldown by one minute">+</button></div><div class="timer-presets" role="group" aria-label="Cooldown presets">${[1, 5, 10, 15].map(minutes => `<button type="button" data-preset="cooldown-${minutes}" aria-label="Set cooldown to ${minutes} minutes">${minutes} min</button>`).join('')}</div></div>
        <label>Cooldown activity<select name="cooldownApp"><option value="off">Off (screensaver until timer ends)</option><option value="sketchpad">Drawing</option><option value="matching">Letters & numbers</option><option value="puzzle">Puzzles</option><option value="alternate">Rotate drawing, letters & puzzles</option></select></label>
        <label>Status<select name="enabled"><option value="false">Disabled</option><option value="true">Enabled</option></select></label>
        <p>The timer starts with the first new object. After an idle cooldown, the next object starts a fresh session. The screensaver waits for 10 minutes without a new object, or the time limit if longer.</p>
        <div class="play-settings-actions"><button type="button" data-cancel>Cancel</button><button type="submit">Save</button></div>
    </form>`
    document.body.append(dialog)
    const field = (name: string): HTMLInputElement | HTMLSelectElement => dialog.querySelector(`[name="${name}"]`)!
    for (const name of ['timeLimit', 'cooldown']) {
        for (const [direction, delta] of [['down', -1], ['up', 1]] as const) {
            bindActivation(dialog.querySelector<HTMLElement>(`[data-adjust="${name}-${direction}"]`)!, () => {
                const input = field(name)
                const current = Number(input.value)
                const next = (Number.isFinite(current) ? current : 1) + delta
                input.value = String(Math.round(Math.max(.1, Math.min(240, next)) * 10) / 10)
            })
        }
        for (const minutes of [1, 5, 10, 15]) {
            bindActivation(dialog.querySelector<HTMLElement>(`[data-preset="${name}-${minutes}"]`)!, () => { field(name).value = String(minutes) })
        }
    }
    const openSettings = (): void => {
        field('timeLimit').value = String(session.settings.timeLimit)
        field('cooldown').value = String(session.settings.cooldown)
        field('enabled').value = String(session.settings.enabled)
        field('cooldownApp').value = session.settings.cooldownApp ?? 'sketchpad'
        if (!dialog.open) dialog.showModal()
    }
    dialog.querySelector('[data-cancel]')!.addEventListener('click', () => dialog.close())
    dialog.querySelector('form')!.addEventListener('submit', event => {
        event.preventDefault()
        const settings = parsePlaySettings({ enabled: field('enabled').value === 'true', timeLimit: Number(field('timeLimit').value), cooldown: Number(field('cooldown').value), cooldownApp: field('cooldownApp').value, screensaverMinutes: session.settings.screensaverMinutes, screensaverEnabled: session.settings.screensaverEnabled })
        session.configure(settings, Date.now())
        try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)) } catch { /* storage unavailable */ }
        saveSession()
        dialog.close()
        sync()
    })

    window.addEventListener('puzzle-activity-settings', openSettings)
    window.addEventListener('shared-cooldown-settings', () => {
        readSchedule()
        openScheduleBuilder(schedule.settings, settings => {
            schedule.settings = settings; schedule.startedAt = Date.now()
            try { localStorage.setItem(scheduleKey, JSON.stringify({ settings, startedAt: schedule.startedAt })) } catch { /* session only */ }
            if (!settings.enabled) { session.returnToPlay(Date.now()); saveSession(); saver.hide(); idleShown = false }
            saver.hide(); scheduledSaver = false; idleShown = false
            adminPaused = false; window.dispatchEvent(new CustomEvent('automation-paused', { detail: false }))
            applySchedule(); sync()
        }, session.settings.screensaverEnabled !== false)
    })
    const screensaverDialog = document.createElement('dialog')
    screensaverDialog.className = 'play-settings'
    screensaverDialog.innerHTML = `<form method="dialog"><h2>Screensaver settings</h2><label>Screensaver<select name="screensaver-enabled"><option value="true">Enabled</option><option value="false">Disabled</option></select></label><label>Idle time (minutes)<input name="idle" type="number" min="0.1" max="240" step="0.1" required></label><p>Disabling skips idle screensavers and scheduled screensaver breaks. An Off cooldown still locks Balloons until its timer ends.</p><div class="play-settings-actions"><button type="button">Cancel</button><button type="submit">Save</button></div></form>`
    document.body.append(screensaverDialog)
    const idleField = screensaverDialog.querySelector<HTMLInputElement>('[name="idle"]')!
    window.addEventListener('puzzle-screensaver-settings', () => {
        screensaverDialog.querySelector<HTMLSelectElement>('[name="screensaver-enabled"]')!.value = String(session.settings.screensaverEnabled !== false)
        idleField.value = String(session.settings.screensaverMinutes ?? Math.max(10, session.settings.timeLimit))
        screensaverDialog.showModal()
    })
    screensaverDialog.querySelector('button')!.addEventListener('click', () => screensaverDialog.close())
    screensaverDialog.querySelector('form')!.addEventListener('submit', event => {
        event.preventDefault()
        session.settings = parsePlaySettings({ ...session.settings, screensaverEnabled: screensaverDialog.querySelector<HTMLSelectElement>('[name="screensaver-enabled"]')!.value !== 'false', screensaverMinutes: Number(idleField.value) })
        try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(session.settings)) } catch { /* storage unavailable */ }
        saveSession()
        screensaverDialog.close()
        if (session.settings.screensaverEnabled === false) { saver.hide(); scheduledSaver = false; idleShown = false; applySchedule() }
    })

    let scheduledSaver = false
    const applySchedule = (): boolean => {
        const state = scheduleState()
        if (!state) {
            if (scheduledSaver) { saver.hide(); scheduledSaver = false; idleShown = false }
            return false
        }
        if (state.screensaver) {
            if (!saver.visible()) { onBreak(); saver.show() }
            scheduledSaver = true
        } else {
            if (scheduledSaver) { saver.hide(); scheduledSaver = false; idleShown = false }
            if (location.hash !== `#/${state.app}`) { onBreak(); location.hash = `/${state.app}` }
        }
        return true
    }
    window.addEventListener('admin-override', () => {
        const app = scheduleState()?.app
        adminPaused = true
        saver.hide(); scheduledSaver = false; idleShown = false
        session.returnToPlay(Date.now()); saveSession()
        if (app && location.hash !== `#/${app}`) location.hash = `/${app}`
        window.dispatchEvent(new CustomEvent('automation-paused', { detail: true }))
        sync()
    })
    window.addEventListener('resume-automation', () => {
        adminPaused = false
        schedule.startedAt = Date.now()
        try { localStorage.setItem(scheduleKey, JSON.stringify({ settings: schedule.settings, startedAt: schedule.startedAt })) } catch { /* session only */ }
        session.returnToPlay(Date.now()); saveSession()
        saver.hide(); scheduledSaver = false; idleShown = false
        applySchedule(); sync()
        window.dispatchEvent(new CustomEvent('automation-paused', { detail: false }))
    })
    window.addEventListener('storage', event => {
        if (adminPaused) return
        if (event.key === scheduleKey || event.key === 'balloons.enabled-games' || event.key === null) { readSchedule(); if (applySchedule()) { sync(); return } }
        if (event.key !== SESSION_KEY && event.key !== null) return
        readSession()
        session.tick(Date.now())
        if (session.phase !== 'play' && location.hash === '#/balloons' && !(session.phase === 'cooldown' && session.settings.cooldownApp === 'off')) {
            onBreak()
            location.hash = `/${session.cooldownActivity}`
        }
        sync()
    })
    window.setInterval(() => {
        if (document.hidden) return
        if (adminPaused) { sync(); return }
        if (applySchedule()) { sync(); return }
        readSession()
        const before = session.phase
        const now = Date.now()
        session.tick(now)
        if (before !== session.phase) saveSession()
        if (session.phase !== 'play' && (before === 'play' || location.hash === '#/balloons') && !(session.phase === 'cooldown' && session.settings.cooldownApp === 'off')) {
            onBreak()
            location.hash = `/${session.cooldownActivity}`
        }
        if (session.screensaverDue(now) && !idleShown && !dialog.open && !screensaverDialog.open) {
            idleShown = true
            onBreak()
            saver.show()
        }
        if (session.settings.screensaverEnabled !== false && session.phase === 'cooldown' && session.settings.cooldownApp === 'off' && !saver.visible()) { idleShown = true; onBreak(); saver.show() }
        sync()
    }, 250)
    return {
        showScreensaver() { if (session.settings.screensaverEnabled === false) return; onBreak(); idleShown = true; saver.show() },
        objectCreated() { if (adminPaused) { sync(); return } if (scheduleState()) { sync(); return } readSession(); session.tick(Date.now()); if (session.phase === 'cooldown') return; session.objectCreated(Date.now()); saveSession(); idleShown = false; saver.hide(); sync() },
        resolveView(view) {
            if (adminPaused) { queueMicrotask(sync); return view }
            const state = scheduleState()
            if (state) {
                applySchedule(); queueMicrotask(sync)
                if (view !== state.app) history.replaceState(null, '', `#/${state.app}`)
                return state.app
            }
            readSession()
            session.tick(Date.now())
            queueMicrotask(sync)
            if (session.phase !== 'play' && view === 'balloons') {
                const activity = session.cooldownActivity
                history.replaceState(null, '', `#/${activity}`)
                return activity
            }
            return view
        }
    }
}
