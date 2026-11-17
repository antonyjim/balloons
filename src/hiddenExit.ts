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

/** Three clockwise circuits, beginning at the top left. */
export class CornerConfigurationSequence {
    private step = 0
    private last = 0
    get progress(): number { return this.step }
    press(corner: number, now: number): boolean {
        if (now - this.last > 15000) this.step = 0
        this.last = now
        if (corner !== this.step % 4) { this.step = corner === 0 ? 1 : 0; return false }
        if (++this.step === 12) { this.step = 0; return true }
        return false
    }
    reset(): void { this.step = 0 }
}

/** Generous corner targets without requiring contact with the screen edge. */
export function configurationCorner(x: number, y: number, width: number, height: number): number {
    const edge = Math.min(112, width * .22, height * .22)
    const left = x >= 0 && x <= edge, right = x <= width && x >= width - edge
    const top = y >= 0 && y <= edge, bottom = y <= height && y >= height - edge
    return top && left ? 0 : top && right ? 1 : bottom && right ? 2 : bottom && left ? 3 : -1
}

/** One counterclockwise circuit from top left, independent of visible controls. */
export class CornerResetSequence {
    private step = 0
    private last = 0
    press(corner: number, now: number): boolean {
        if (now - this.last > 15000) this.step = 0
        this.last = now
        if (corner !== [0, 3, 2, 1][this.step]) { this.step = corner === 0 ? 1 : 0; return false }
        if (++this.step === 4) { this.step = 0; return true }
        return false
    }
    reset(): void { this.step = 0 }
}
