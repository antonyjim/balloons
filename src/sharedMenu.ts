import { loadMenuState, saveMenuState } from './menuState'
import { pageScales, parsePageScale } from './pageScale'
import type { AppView } from './navigation'
import { exitAppFullscreen, CornerConfigurationSequence, CornerResetSequence, configurationCorner } from './hiddenExit'
import { bindActivation } from './activation'

export const games: Record<AppView, string> = { balloons: 'Balloons', sketchpad: 'Drawing', matching: 'Letters', puzzle: 'Puzzles' }
const key = 'balloons.enabled-games'
export function parseEnabledGames(value: unknown): AppView[] {
    const enabled = Array.isArray(value) ? Object.keys(games).filter(game => value.includes(game)) as AppView[] : Object.keys(games) as AppView[]
    return enabled.length ? enabled : ['balloons']
}
export function setupSharedMenu(ensureSettings: () => void): { resolve(view: AppView): AppView; view(view: AppView): void } {
    let enabled = Object.keys(games) as AppView[]
    try { enabled = parseEnabledGames(JSON.parse(localStorage.getItem(key) ?? 'null')) } catch { /* defaults */ }
    let current: AppView = 'balloons', configuration = true
    // Promote the existing balloons controls; keep their DOM, styling and handlers.
    const toolbar = document.querySelector<HTMLElement>('#balloons-view .overlay')!
    toolbar.id = 'shared-toolbar'
    toolbar.setAttribute('aria-label', 'Game controls')
    document.body.append(toolbar)
    const panel = document.getElementById('background-menu')!
    const trigger = document.getElementById('background-toggle')!
    trigger.setAttribute('aria-label', 'Menu and settings')
    trigger.title = 'Menu and settings'
    panel.setAttribute('aria-label', 'Menu and settings')
    const config = document.createElement('section')
    config.id = 'shared-configuration'
    config.innerHTML = `<h3>Configuration</h3><button type="button" id="resume-automation" hidden>Resume schedule</button><button type="button" data-settings="activity">Activity timer settings</button><button type="button" data-settings="cooldown">Cooldown schedule</button><button type="button" data-settings="screensaver">Screensaver settings</button><button type="button" data-settings="balloon">Balloon settings</button><button type="button" data-settings="puzzle">Puzzle settings</button><label><input id="show-menu" type="checkbox" checked> Show menu</label><label><input id="show-timer" type="checkbox" checked> Show timer</label><label>Page zoom <select id="page-scale">${pageScales.map(percent => `<option value="${percent}">${percent}%</option>`).join('')}</select></label><button type="button" id="reset-page-scale">Reset zoom to 100%</button><h3>Enabled games</h3><div id="enabled-games"></div><p role="status"></p><button type="button" id="exit-fullscreen">Exit fullscreen</button>`
    panel.prepend(config)
    const resume = config.querySelector<HTMLButtonElement>('#resume-automation')!
    bindActivation(resume, () => window.dispatchEvent(new Event('resume-automation')))
    window.addEventListener('automation-paused', event => { resume.hidden = (event as CustomEvent).detail !== true })
    const status = config.querySelector<HTMLElement>('[role=status]')!
    const gameLink = document.createElement('a')
    gameLink.className = 'action-button'
    gameLink.href = '#/balloons'; gameLink.setAttribute('aria-label', 'Open Balloons')
    const balloonIcon = document.createElement('img')
    balloonIcon.src = '/icons/objects/latex.svg'; balloonIcon.width = 24; balloonIcon.height = 28; balloonIcon.alt = ''
    gameLink.append(balloonIcon, 'Balloons')
    bindActivation(gameLink)
    toolbar.querySelector('.reset-card')!.prepend(gameLink)
    const currentAction = document.createElement('button')
    currentAction.type = 'button'; currentAction.className = 'action-button'
    toolbar.querySelector('.reset-card')!.append(currentAction, document.getElementById('exit-simple-mode')!)
    const close = (): void => { panel.hidden = true; trigger.setAttribute('aria-expanded', 'false') }
    const render = (): void => {
        document.body.setAttribute('data-app', current)
        document.getElementById('balloon-background-options')!.hidden = current !== 'balloons'
        for (const link of toolbar.querySelectorAll<HTMLAnchorElement>('a[href^="#/"]')) {
            const game = link.hash.slice(2) as AppView
            link.hidden = !enabled.includes(game) || game === current
        }
        for (const selector of ['#object-picker', '#reset', '.counter-card:not(.timer-card)']) toolbar.querySelector<HTMLElement>(selector)!.hidden = current !== 'balloons'
        const labels: Partial<Record<AppView, string>> = { sketchpad: 'Clear drawing', matching: 'Next shape', puzzle: 'Reset puzzle' }
        currentAction.hidden = current === 'balloons'
        currentAction.textContent = labels[current] ?? ''
    }
    bindActivation(currentAction, () => {
        const selectors: Partial<Record<AppView, string>> = { sketchpad: '#clear', matching: '.dispense', puzzle: '#restart' }
        const selector = selectors[current]
        if (selector) document.getElementById(`${current}-view`)?.shadowRoot?.querySelector<HTMLButtonElement>(selector)?.click()
    })
    const settings = (section: string): void => {
        close()
        if (section === 'cooldown') { window.dispatchEvent(new Event('shared-cooldown-settings')); return }
        if (section === 'balloon' || section === 'puzzle') ensureSettings()
        if (section === 'activity' || section === 'screensaver') window.dispatchEvent(new Event(`puzzle-${section}-settings`))
        else window.dispatchEvent(new CustomEvent('shared-game-settings', { detail: section }))
    }
    const open = (): void => {
        window.dispatchEvent(new Event('shared-menu-requested'))
        toolbar.hidden = false; toolbar.classList.remove('menu-collapsed')
        visibility.checked = true
        saveMenuState({ enabled: true, collapsed: false })
        if (panel.hidden) trigger.click()
    }
    window.addEventListener('open-shared-menu', open)
    for (const button of config.querySelectorAll<HTMLElement>('[data-settings]')) bindActivation(button, () => settings(button.dataset.settings!))
    for (const game of Object.keys(games) as AppView[]) {
        const label = document.createElement('label'), input = document.createElement('input'); input.type = 'checkbox'; input.checked = enabled.includes(game)
        label.append(input, ` ${games[game]}`); config.querySelector('#enabled-games')!.append(label)
        input.onchange = () => {
            if (!input.checked && enabled.length === 1) { input.checked = true; status.textContent = 'Keep at least one game enabled.'; return }
            enabled = input.checked ? [...enabled, game] : enabled.filter(item => item !== game)
            try { localStorage.setItem(key, JSON.stringify(enabled)) } catch { status.textContent = 'Changes apply for this visit; browser storage is unavailable.' }
            if (!enabled.includes(current)) window.location.hash = `/${enabled[0]}`
            render()
        }
    }
    bindActivation(config.querySelector<HTMLElement>('#exit-fullscreen')!, () => { void exitAppFullscreen().then(message => { status.textContent = message }) })
    const visibility = config.querySelector<HTMLInputElement>('#show-menu')!
    visibility.onchange = () => {
        toolbar.hidden = !visibility.checked
        saveMenuState({ enabled: visibility.checked })
    }
    window.addEventListener('menu-enabled-change', event => { visibility.checked = (event as CustomEvent).detail === true; visibility.onchange!(new Event('change')) })
    const restoreMenu = (): void => {
        const state = loadMenuState()
        visibility.checked = state.enabled
        toolbar.hidden = !state.enabled
        toolbar.classList.toggle('menu-collapsed', state.collapsed)
    }
    restoreMenu()
    const timerVisibility = config.querySelector<HTMLInputElement>('#show-timer')!
    const syncTimer = (): void => {
        try { timerVisibility.checked = localStorage.getItem('balloons.show-timer') !== 'false' } catch { timerVisibility.checked = true }
        toolbar.querySelector<HTMLElement>('.timer-card')!.hidden = !timerVisibility.checked
    }
    timerVisibility.onchange = () => {
        toolbar.querySelector<HTMLElement>('.timer-card')!.hidden = !timerVisibility.checked
        try { localStorage.setItem('balloons.show-timer', String(timerVisibility.checked)) } catch { /* session only */ }
    }
    window.addEventListener('storage', event => { if (event.key === 'balloons.show-timer' || event.key === null) syncTimer(); if (event.key === 'balloons.page-scale' || event.key === null) syncPageScale(); if (event.key === 'balloons.show-menu' || event.key === 'balloons.menu-collapsed' || event.key === null) restoreMenu() })
    syncTimer()
    const pageScale = config.querySelector<HTMLSelectElement>('#page-scale')!
    const syncPageScale = (): void => { try { pageScale.value = String(parsePageScale(localStorage.getItem('balloons.page-scale'))) } catch { pageScale.value = '100' } }
    pageScale.onchange = () => window.dispatchEvent(new CustomEvent('page-scale-change', { detail: Number(pageScale.value) }))
    bindActivation(config.querySelector<HTMLElement>('#reset-page-scale')!, () => { pageScale.value = '100'; pageScale.onchange!(new Event('change')) })
    syncPageScale()
    const sequence = new CornerConfigurationSequence()
    const resetSequence = new CornerResetSequence()
    const feedback = document.createElement('div')
    feedback.id = 'menu-unlock-progress'; feedback.hidden = true
    feedback.setAttribute('aria-hidden', 'true')
    const ring = (radius: number, offset: number): string => Array.from({ length: 4 }, (_, quarter) =>
        `<path data-step="${offset + quarter}" d="M ${-radius} 0 A ${radius} ${radius} 0 0 1 0 ${-radius}" transform="rotate(${quarter * 90})"/>`).join('')
    feedback.innerHTML = `<svg viewBox="-32 -32 64 64" fill="none" aria-hidden="true"><g class="unlock-quarters">${ring(27, 0)}${ring(20, 4)}</g><path class="unlock-icon" d="M-7 -5H7M-7 0H7M-7 5H7"/></svg>`
    document.body.append(feedback)
    let feedbackTimer: ReturnType<typeof setTimeout> | undefined
    const hideFeedback = (): void => { clearTimeout(feedbackTimer); feedback.hidden = true }
    const showProgress = (): void => {
        if (sequence.progress < 4) { hideFeedback(); return }
        feedback.hidden = false
        feedback.dataset.remaining = String(12 - sequence.progress)
        for (const quarter of feedback.querySelectorAll<SVGElement>('[data-step]')) {
            quarter.dataset.complete = String(Number(quarter.dataset.step) < sequence.progress - 4)
        }
        clearTimeout(feedbackTimer)
        feedbackTimer = setTimeout(() => { sequence.reset(); hideFeedback() }, 15000)
    }
    let start: { id: number; x: number; y: number } | null = null
    document.addEventListener('pointerdown', event => { if (event.isPrimary && event.button === 0) start = { id: event.pointerId, x: event.clientX, y: event.clientY } }, true)
    document.addEventListener('pointercancel', () => { start = null; sequence.reset(); resetSequence.reset(); hideFeedback() }, true)
    document.addEventListener('pointerup', event => {
        const tap = start; start = null
        if (!tap || tap.id !== event.pointerId || Math.hypot(tap.x - event.clientX, tap.y - event.clientY) > 20) return
        const corner = configurationCorner(event.clientX, event.clientY, window.innerWidth, window.innerHeight)
        if (corner < 0) { sequence.reset(); resetSequence.reset(); hideFeedback(); return }
        if (resetSequence.press(corner, performance.now())) {
            sequence.reset(); hideFeedback()
            window.dispatchEvent(new CustomEvent('hidden-game-reset', { detail: current }))
            return
        }
        if (sequence.press(corner, performance.now())) {
            window.dispatchEvent(new Event('admin-override'))
            hideFeedback()
            // Recover hidden controls in a single sequence, even if configuration was already enabled.
            configuration = true
            config.hidden = !configuration
            if (configuration) open()
        } else showProgress()
    }, true)
    render()
    return { resolve(view) { return enabled.includes(view) ? view : enabled[0] }, view(view) { sequence.reset(); resetSequence.reset(); hideFeedback(); current = view; render() } }
}
