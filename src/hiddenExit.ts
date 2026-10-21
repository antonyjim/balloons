/** A discreet escape sequence that leaves normal Reset behavior available. */
export class HiddenExitSequence {
    private step = 0
    private started = 0
    press(control: 'reset' | 'counter', now: number): boolean {
        if (now - this.started > 8000) this.step = 0
        if (control === 'reset' && this.step === 2) { this.step = 0; return true }
        if (control === 'reset') { this.step = 1; this.started = now }
        else this.step = this.step === 1 ? 2 : 0
        return false
    }
}

export async function exitAppFullscreen(): Promise<string> {
    const page = document as Document & {
        webkitFullscreenElement?: Element; webkitCurrentFullScreenElement?: Element; webkitIsFullScreen?: boolean
        webkitExitFullscreen?: () => void | Promise<void>; webkitCancelFullScreen?: () => void | Promise<void>
    }
    // The explicit admin action temporarily enables the browser's own exit key.
    page.dispatchEvent?.(new Event('kiosk-exit-requested'))
    const view = page.getElementById('balloons-view')
    if (view?.classList.contains('simple-mode')) page.getElementById('exit-simple-mode')?.click()
    try {
        if (page.fullscreenElement && page.exitFullscreen) {
            await page.exitFullscreen()
            return 'Exited fullscreen.'
        }
        if (page.webkitFullscreenElement || page.webkitCurrentFullScreenElement || page.webkitIsFullScreen) {
            const exit = page.webkitExitFullscreen ?? page.webkitCancelFullScreen
            if (exit) { await exit.call(page); return 'Exited fullscreen.' }
        }
    } catch {
        return 'The browser could not exit fullscreen. F11 is enabled for one minute; try F11 or the browser exit control. Managed kiosks require the device administrator to exit.'
    }
    return 'This page is not in webpage fullscreen. For browser fullscreen, F11 is enabled for one minute. Installed apps and managed kiosks must be exited using the browser or device controls.'
}
