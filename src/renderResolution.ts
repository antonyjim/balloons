/** Reduce backing pixels only after sustained slow frames; recover quality gradually. */
export class RenderResolution {
    cap = 2
    private elapsed = 0
    private frames = 0
    reset(): void { this.elapsed = 0; this.frames = 0 }
    sample(frameMs: number): boolean {
        // Ignore background/resume gaps and invalid samples.
        if (!Number.isFinite(frameMs) || frameMs <= 0 || frameMs > 250) { this.reset(); return false }
        this.elapsed += frameMs; this.frames++
        if (this.frames < 90) return false
        const fps = this.frames * 1000 / this.elapsed
        if (fps < 45 && this.cap > 1) {
            this.cap = Math.max(1, this.cap - .25); this.reset(); return true
        }
        if (fps >= 58 && this.frames >= 600 && this.cap < 2) {
            this.cap = Math.min(2, this.cap + .25); this.reset(); return true
        }
        if (fps < 58 || this.frames >= 600) this.reset()
        return false
    }
}
