import { loadGenerationSettings } from './generationSettings'
import { saveMenuState } from './menuState'
import { setupPageScale, layoutPixels } from './pageScale'
import { setupSharedMenu } from './sharedMenu'
import { setupActivityLog } from './activityLogUI'
import { mountPuzzle } from './puzzle'
import { mountMatching, type MatchingApp } from './matching'
import { bindActivation } from './activation'
import { setupNavigation, type AppView } from './navigation'
import { mountSketchpad, type Sketchpad } from './sketchpad'
import { themes } from './theme/themes'

interface WorkspaceOptions {
    showScreensaver?(): void
    resolveView?(view: AppView): AppView
    setSimpleMode(enabled: boolean): void
    showBalloons(active: boolean): void
    setBackground(url: string | null): Promise<void>
}

export function setupWorkspace(options: WorkspaceOptions): void {
    const activityLog = setupActivityLog()
    const balloons = document.getElementById('balloons-view')!
    const sketchHost = document.getElementById('sketchpad-view')!
    const matchingHost = document.getElementById('matching-view')!
    const trigger = document.getElementById('background-toggle')!
    const panel = document.getElementById('background-menu')!
    const input = document.querySelector<HTMLInputElement>('#background-file')!
    const drawingButton = document.querySelector<HTMLButtonElement>('#drawing-background')!
    const status = document.getElementById('background-status')!
    let sketch: Sketchpad | null = null
    let matching: MatchingApp | null = null
    const puzzleHost = document.getElementById('puzzle-view')!
    let puzzle: ReturnType<typeof mountPuzzle> | null = null
    const sharedMenu = setupSharedMenu(() => {
        if (!puzzle) { puzzle = mountPuzzle(puzzleHost, activityLog.puzzle, options.showScreensaver, true); puzzle.setActive(!puzzleHost.hidden) }
    })
    setupPageScale()
    // Reserve the toolbar's actual height, including wrapping on narrow screens.
    const toolbar = document.getElementById('shared-toolbar')!
    const syncMenuSpace = (): void => {
        matchingHost.style.setProperty('--shared-menu-bottom', `${layoutPixels(toolbar.getBoundingClientRect().bottom)}px`)
    }
    const menuResize = new ResizeObserver(syncMenuSpace)
    menuResize.observe(toolbar)
    window.addEventListener('resize', syncMenuSpace)
    syncMenuSpace()
    let ownedUrl: string | null = null
    let request = 0
    const close = (): void => { panel.hidden = true; trigger.setAttribute('aria-expanded', 'false') }
    const exitSimple = document.getElementById('exit-simple-mode')!
    const syncCollapseControl = (): void => {
        const collapsed = toolbar.classList.contains('menu-collapsed')
        saveMenuState({ collapsed })
        const label = collapsed ? 'Expand' : 'Collapse'
        document.getElementById('toolbar-collapse-label')!.textContent = label
        exitSimple.setAttribute('aria-label', `${label} toolbar`)
        exitSimple.setAttribute('title', `${label} toolbar`)
        exitSimple.setAttribute('aria-expanded', String(!collapsed))
    }
    new MutationObserver(syncCollapseControl).observe(toolbar, { attributes: true, attributeFilter: ['class'] })
    syncCollapseControl()
    bindActivation(document.getElementById('simple-mode')!, () => {
        request++
        options.setSimpleMode(true)
        report(apply(null).then(() => {
            balloons.classList.add('simple-mode')
            document.getElementById('shared-toolbar')!.classList.add('menu-collapsed')
            exitSimple.hidden = false
            exitSimple.focus()
        }))
    })
    bindActivation(exitSimple, () => {
        options.setSimpleMode(false)
        balloons.classList.remove('simple-mode')
        const collapsed = document.getElementById('shared-toolbar')!.classList.toggle('menu-collapsed')
        exitSimple.setAttribute('aria-expanded', String(!collapsed))
        exitSimple.hidden = false
        if (document.getElementById('shared-toolbar')!.classList.contains('menu-collapsed')) exitSimple.focus()
        else trigger.focus()
    })
    const apply = async (url: string | null, owned = false): Promise<void> => {
        const previous = ownedUrl
        await options.setBackground(url)
        ownedUrl = owned ? url : null
        if (previous && previous !== ownedUrl) window.setTimeout(() => URL.revokeObjectURL(previous), 3000)
        status.textContent = ''
        close()
    }
    const useBlob = async (blob: Blob): Promise<void> => {
        const token = ++request
        const url = URL.createObjectURL(blob)
        try {
            const image = new Image()
            image.src = url
            await image.decode()
            if (token !== request) { URL.revokeObjectURL(url); return }
            await apply(url, true)
        } catch (error) { URL.revokeObjectURL(url); throw error }
    }
    const report = (work: Promise<void>): void => {
        status.textContent = 'Loading image?'
        void work.catch(() => { status.textContent = 'Could not load that image. Please try another.' })
    }
    // Simple mode changes the controls, preserving the saved object selection.
    balloons.classList.add('simple-mode')
    exitSimple.hidden = false
    options.setSimpleMode(!loadGenerationSettings().profile)
    report(apply(null))
    bindActivation(trigger, () => {
        const open = panel.hidden
        panel.hidden = !open
        trigger.setAttribute('aria-expanded', String(open))
        if (open) {
            const bounds = trigger.getBoundingClientRect()
            const anchor = trigger.parentElement!.getBoundingClientRect()
            const menuWidth = Math.min(260, layoutPixels(window.innerWidth) - 32)
            const left = Math.max(16, Math.min(layoutPixels(bounds.left), layoutPixels(window.innerWidth) - menuWidth - 16))
            panel.style.left = `${left - layoutPixels(anchor.left)}px`
            panel.style.right = 'auto'
            panel.style.maxHeight = `${Math.max(120, layoutPixels(window.innerHeight - bounds.bottom) - 24)}px`
            panel.style.overflowY = 'auto'
            panel.querySelector<HTMLButtonElement>('button')?.focus()
        }
    })
    for (const button of panel.querySelectorAll<HTMLButtonElement>('[data-background]')) {
        bindActivation(button, () => {
            request++
            const id = button.dataset.background!
            const url = id === 'auto' ? null : themes[id as keyof typeof themes].background
            report(apply(url))
        })
    }
    bindActivation(document.getElementById('upload-background')!, () => input.click())
    input.addEventListener('change', () => {
        const file = input.files?.[0]
        input.value = ''
        if (file) report(useBlob(file))
    })
    bindActivation(drawingButton, () => {
        if (sketch) report(sketch.snapshot().then(useBlob))
    })
    panel.addEventListener('keydown', event => {
        if (event.key === 'Escape') { close(); trigger.focus() }
    })
    document.addEventListener('pointerdown', event => {
        const target = event.target as Node
        if (!panel.contains(target) && !trigger.contains(target)) close()
    })
    setupNavigation(requestedView => {
        const view = sharedMenu.resolve(options.resolveView?.(sharedMenu.resolve(requestedView)) ?? sharedMenu.resolve(requestedView))
        sharedMenu.view(view)
        activityLog.view(view)
        const drawing = view === 'sketchpad'
        const playing = view === 'matching'
        const balloonView = view === 'balloons'
        puzzleHost.hidden = view !== 'puzzle'
        if (view === 'puzzle' && !puzzle) puzzle = mountPuzzle(puzzleHost, activityLog.puzzle, options.showScreensaver, true)
        puzzle?.setActive(view === 'puzzle')
        close()
        if (!balloonView) options.showBalloons(false)
        balloons.hidden = !balloonView
        sketchHost.hidden = !drawing
        matchingHost.hidden = !playing
        if (playing && !matching) matching = mountMatching(matchingHost)
        matching?.setActive(playing)
        if (drawing && !sketch) {
            sketch = mountSketchpad(sketchHost, async (blob, target) => {
                if (target === 'puzzle') {
                    if (!puzzle) { puzzle = mountPuzzle(puzzleHost, activityLog.puzzle, options.showScreensaver, true); puzzle.setActive(false) }
                    await puzzle.setBackground(blob)
                    window.location.hash = '/puzzle'
                    return
                }
                await useBlob(blob)
                window.location.hash = '/balloons'
            })
            drawingButton.disabled = false
        }
        sketch?.setActive(drawing)
        // Resize only after the balloon canvas is visible again.
        if (balloonView) options.showBalloons(true)
        document.title = view === 'puzzle' ? 'Picture puzzles | Balloons' : drawing ? 'Sketchpad | Balloons' : playing ? 'Little letter shop | Balloons' : 'Balloons'
    })
}
