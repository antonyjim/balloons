/** Page-level kiosk guards. OS/browser escape gestures still require managed kiosk mode. */
export function setupKioskInteractions(target: Document = document): void {
    let allowExitUntil = 0
    target.addEventListener('kiosk-exit-requested', () => { allowExitUntil = Date.now() + 60_000 })
    const editable = (event: Event): boolean => event.composedPath().some(node => {
        const el = node as HTMLElement
        return el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA' || el?.isContentEditable === true
    })
    const prevent = (event: Event): void => { if (event.cancelable) event.preventDefault() }
    target.addEventListener('contextmenu', prevent, { capture: true })
    target.addEventListener('dragstart', prevent, { capture: true })
    target.addEventListener('selectstart', event => { if (!editable(event)) prevent(event) }, { capture: true })
    target.addEventListener('dblclick', event => { if (!editable(event)) prevent(event) }, { capture: true })
    for (const type of ['gesturestart', 'gesturechange', 'gestureend']) target.addEventListener(type, prevent, { capture: true, passive: false })
    const multiTouch = (event: TouchEvent): void => { if (event.touches.length > 1) prevent(event) }
    target.addEventListener('touchstart', multiTouch, { capture: true, passive: false })
    target.addEventListener('touchmove', multiTouch, { capture: true, passive: false })
    target.addEventListener('wheel', event => { if (event.ctrlKey || event.metaKey) prevent(event) }, { capture: true, passive: false })
    target.addEventListener('keydown', event => {
        if ((event.key === 'F11' && Date.now() >= allowExitUntil) || ((event.ctrlKey || event.metaKey) && ['+', '=', '-', '_', '0'].includes(event.key))) prevent(event)
    }, { capture: true })
}
