import { bindActivation } from './activation'
import { PlaySession, defaultPlaySettings, parsePlaySettings } from './playSession'
import { createMystify } from './mystify'
import { playPopSound, unlockAudio } from './audio'
import type { AppView } from './navigation'

const SETTINGS_KEY = 'balloons.play.settings'
export function setupPlaySession(onBreak: () => void): { objectCreated(): void; resolveView(view: AppView): AppView } {
    let saved = defaultPlaySettings
    try { saved = parsePlaySettings(JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? 'null')) } catch { /* use defaults */ }
    const session = new PlaySession(saved, Date.now())
    const saver = createMystify()
    let idleShown = false
    const returnBalloon = document.createElement('button')
    returnBalloon.type = 'button'
    returnBalloon.className = 'cooldown-balloon'
    returnBalloon.hidden = true
    returnBalloon.setAttribute('aria-label', 'Pop balloon to return to Balloons')
    returnBalloon.innerHTML = '<img src="/icons/objects/latex.svg" alt="" draggable="false"><span>Pop to play</span>'
    document.body.append(returnBalloon)
    const sync = (): void => {
        const timer = document.getElementById('play-timer')
        if (timer) {
            const now = Date.now()
            const remaining = session.phase === 'cooldown' ? session.cooldownUntil - now
                : session.phase === 'ready' ? 0
                : session.settings.timeLimit * 60_000 - (session.startedAt === null || session.idle(now) ? 0 : now - session.startedAt)
            const seconds = Math.max(0, Math.ceil(remaining / 1000))
            timer.textContent = session.settings.enabled ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` : 'Off'
            timer.setAttribute('aria-label', session.settings.enabled ? `Play time remaining: ${timer.textContent}` : 'Play timer disabled')
            timer.parentElement?.setAttribute('title', session.settings.enabled ? 'Starts with the first object; resets after an idle cooldown' : 'Play timer disabled')
        }
        const drawing = location.hash === '#/sketchpad'
        returnBalloon.hidden = session.phase !== 'ready' || !drawing
        for (const id of ['back-to-balloons', 'use-drawing']) {
            const control = document.getElementById('sketchpad-view')?.shadowRoot?.querySelector<HTMLElement>(`#${id}`)
            if (control) control.hidden = session.phase !== 'play'
        }
    }
    const popReturnBalloon = (): void => {
        if (session.phase !== 'ready' || returnBalloon.hidden) return
        unlockAudio()
        playPopSound('latex')
        session.returnToPlay(Date.now())
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
        <h2 id="play-settings-title">Play timer</h2>
        <label>Time limit <span>(minutes)</span><input name="timeLimit" type="number" min="0.1" max="240" step="0.1" required></label>
        <label>Cooldown <span>(minutes)</span><input name="cooldown" type="number" min="0.1" max="240" step="0.1" required></label>
        <label>Status<select name="enabled"><option value="false">Disabled</option><option value="true">Enabled</option></select></label>
        <p>The timer starts with the first new object. After an idle cooldown, the next object starts a fresh session. The screensaver waits for 10 minutes without a new object, or the time limit if longer.</p>
        <div class="play-settings-actions"><button type="button" data-cancel>Cancel</button><button type="submit">Save</button></div>
    </form>`
    document.body.append(dialog)
    const field = (name: string): HTMLInputElement | HTMLSelectElement => dialog.querySelector(`[name="${name}"]`)!
    const openSettings = (): void => {
        field('timeLimit').value = String(session.settings.timeLimit)
        field('cooldown').value = String(session.settings.cooldown)
        field('enabled').value = String(session.settings.enabled)
        if (!dialog.open) dialog.showModal()
    }
    dialog.querySelector('[data-cancel]')!.addEventListener('click', () => dialog.close())
    dialog.querySelector('form')!.addEventListener('submit', event => {
        event.preventDefault()
        const settings = parsePlaySettings({ enabled: field('enabled').value === 'true', timeLimit: Number(field('timeLimit').value), cooldown: Number(field('cooldown').value) })
        session.configure(settings, Date.now())
        try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)) } catch { /* storage unavailable */ }
        dialog.close()
        sync()
    })

    // Hidden from ordinary taps; hold Automatic sky for a second to configure.
    const target = document.querySelector<HTMLElement>('#background-menu [data-background="auto"]')!
    target.title = 'Automatic sky · hold for play timer settings'
    let hold: number | undefined, pointer: number | null = null, x = 0, y = 0, suppressUntil = 0, heldOpen = false
    const cancelHold = (): void => { clearTimeout(hold); hold = undefined; pointer = null }
    target.addEventListener('pointerdown', event => {
        if (event.button !== 0 || pointer !== null) return
        heldOpen = false
        pointer = event.pointerId; x = event.clientX; y = event.clientY
        hold = window.setTimeout(() => { heldOpen = true; suppressUntil = performance.now() + 1500; openSettings() }, 900)
    }, true)
    target.addEventListener('pointermove', event => {
        if (event.pointerId === pointer && Math.hypot(event.clientX - x, event.clientY - y) > 12) cancelHold()
    }, true)
    target.addEventListener('pointerup', event => {
        const held = heldOpen
        heldOpen = false
        cancelHold()
        if (held) { suppressUntil = performance.now() + 800; event.preventDefault(); event.stopImmediatePropagation() }
    }, true)
    for (const name of ['pointercancel', 'lostpointercapture']) target.addEventListener(name, cancelHold)
    target.addEventListener('pointerleave', event => { if (event.pointerType === 'mouse') cancelHold() })
    target.addEventListener('click', event => {
        if (performance.now() < suppressUntil) { event.preventDefault(); event.stopImmediatePropagation() }
    }, true)
    target.addEventListener('contextmenu', event => { event.preventDefault() })
    target.addEventListener('keydown', event => {
        if (event.altKey && event.key === 'Enter') { event.preventDefault(); openSettings() }
    })
    window.addEventListener('blur', cancelHold)
    window.addEventListener('pointerup', cancelHold)
    window.addEventListener('pointercancel', cancelHold)

    window.setInterval(() => {
        if (document.hidden) return
        const before = session.phase
        const now = Date.now()
        session.tick(now)
        if (before === 'play' && session.phase !== 'play') {
            onBreak()
            location.hash = '/sketchpad'
        }
        if (session.screensaverDue(now) && !idleShown && !dialog.open) {
            idleShown = true
            onBreak()
            saver.show()
        }
        sync()
    }, 250)
    return {
        objectCreated() { session.objectCreated(Date.now()); idleShown = false; saver.hide(); sync() },
        resolveView(view) {
            queueMicrotask(sync)
            if (session.phase !== 'play' && view !== 'sketchpad') {
                history.replaceState(null, '', '#/sketchpad')
                return 'sketchpad'
            }
            return view
        }
    }
}
