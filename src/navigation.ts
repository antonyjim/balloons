export type AppView = 'balloons' | 'sketchpad'
export function viewFromHash(hash: string): AppView {
    return hash === '#/sketchpad' ? 'sketchpad' : 'balloons'
}

/** Hash navigation keeps one document and supports browser back/forward and deep links. */
export function setupNavigation(show: (view: AppView) => void): void {
    window.addEventListener('hashchange', () => show(viewFromHash(window.location.hash)))
    show(viewFromHash(window.location.hash))
}
