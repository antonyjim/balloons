export const pageScales = [75, 90, 100, 110, 125, 150] as const
const key = 'balloons.page-scale'
let scale = 1
export function parsePageScale(value: unknown): number {
    const percent = typeof value === 'number' ? value : Number(value)
    return pageScales.some(option => option === percent) ? percent : 100
}
/** Convert viewport coordinates into CSS layout coordinates under CSS zoom. */
export function layoutPixels(pixels: number): number { return pixels / scale }
export function setupPageScale(): void {
    const root = document.documentElement
    const viewport = (): void => {
        root.style.setProperty('--page-width', `${layoutPixels(window.innerWidth)}px`)
        root.style.setProperty('--page-height', `${layoutPixels(window.innerHeight)}px`)
    }
    const apply = (value: unknown): void => {
        scale = parsePageScale(value) / 100
        root.style.setProperty('--page-scale', scale === 1 ? 'normal' : String(scale))
        viewport()
        window.dispatchEvent(new Event('resize'))
    }
    let saved: string | null = null
    try { saved = localStorage.getItem(key) } catch { /* default */ }
    apply(saved)
    window.addEventListener('resize', viewport)
    window.addEventListener('page-scale-change', event => {
        const percent = parsePageScale((event as CustomEvent).detail)
        try { localStorage.setItem(key, String(percent)) } catch { /* session only */ }
        apply(percent)
    })
    window.addEventListener('storage', event => { if (event.key === key || event.key === null) { try { apply(localStorage.getItem(key)) } catch { /* keep current size */ } } })
}
