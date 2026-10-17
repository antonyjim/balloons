import { bindActivation } from './activation'
import { setupNavigation, type AppView } from './navigation'
import { mountSketchpad, type Sketchpad } from './sketchpad'
import { themes } from './theme/themes'

interface WorkspaceOptions {
    resolveView?(view: AppView): AppView
    setAuto(): void
    setSimpleMode(enabled: boolean): void
    showBalloons(active: boolean): void
    setBackground(url: string | null): Promise<void>
}

export function setupWorkspace(options: WorkspaceOptions): void {
    const balloons = document.getElementById('balloons-view')!
    const sketchHost = document.getElementById('sketchpad-view')!
    const trigger = document.getElementById('background-toggle')!
    const panel = document.getElementById('background-menu')!
    const input = document.querySelector<HTMLInputElement>('#background-file')!
    const drawingButton = document.querySelector<HTMLButtonElement>('#drawing-background')!
    const status = document.getElementById('background-status')!
    let sketch: Sketchpad | null = null
    let ownedUrl: string | null = null
    let request = 0
    const close = (): void => { panel.hidden = true; trigger.setAttribute('aria-expanded', 'false') }
    const exitSimple = document.getElementById('exit-simple-mode')!
    bindActivation(document.getElementById('simple-mode')!, () => {
        request++
        options.setSimpleMode(true)
        options.setAuto()
        report(apply(null).then(() => {
            balloons.classList.add('simple-mode')
            exitSimple.hidden = false
            exitSimple.focus()
        }))
    })
    bindActivation(exitSimple, () => {
        options.setSimpleMode(false)
        balloons.classList.remove('simple-mode')
        exitSimple.hidden = true
        trigger.focus()
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
    // Start with automatic settings even if a previous session saved a manual choice.
    balloons.classList.add('simple-mode')
    exitSimple.hidden = false
    options.setSimpleMode(true)
    options.setAuto()
    report(apply(null))
    bindActivation(trigger, () => {
        const open = panel.hidden
        panel.hidden = !open
        trigger.setAttribute('aria-expanded', String(open))
        if (open) {
            const bounds = trigger.getBoundingClientRect()
            const anchor = trigger.parentElement!.getBoundingClientRect()
            const menuWidth = Math.min(260, window.innerWidth - 32)
            const left = Math.max(16, Math.min(bounds.left, window.innerWidth - menuWidth - 16))
            panel.style.left = `${left - anchor.left}px`
            panel.style.right = 'auto'
            panel.style.maxHeight = `${Math.max(120, window.innerHeight - bounds.bottom - 24)}px`
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
        const view = options.resolveView?.(requestedView) ?? requestedView
        const drawing = view === 'sketchpad'
        close()
        if (drawing) options.showBalloons(false)
        balloons.hidden = drawing
        sketchHost.hidden = !drawing
        if (drawing && !sketch) {
            sketch = mountSketchpad(sketchHost, async blob => {
                await useBlob(blob)
                window.location.hash = '/balloons'
            })
            drawingButton.disabled = false
        }
        sketch?.setActive(drawing)
        // Resize only after the balloon canvas is visible again.
        if (!drawing) options.showBalloons(true)
        document.title = drawing ? 'Sketchpad | Balloons' : 'Balloons'
    })
}
