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

export function exitAppFullscreen(): void {
    const page = document as Document & { webkitFullscreenElement?: Element; webkitExitFullscreen?: () => void }
    if (page.fullscreenElement && page.exitFullscreen) void page.exitFullscreen().catch(console.warn)
    else if (page.webkitFullscreenElement && page.webkitExitFullscreen) page.webkitExitFullscreen()
    // Also expose the controls when fullscreen refers to the simplified app UI.
    const view = document.getElementById('balloons-view')
    if (view?.classList.contains('simple-mode')) document.getElementById('exit-simple-mode')?.click()
}
