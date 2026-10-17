/** Activate touch/pen controls independently of the primary canvas pointer.
 * Native click remains the mouse/keyboard path; suppress only the follow-up
 * compatibility click from a touch activation.
 */
export function bindActivation(element: HTMLElement, action?: () => void): void {
    const touches = new Map<number, { x: number, y: number }>()
    let lastTouch: { time: number, x: number, y: number } | null = null
    element.addEventListener('pointerdown', event => {
        if (event.pointerType !== 'touch' && event.pointerType !== 'pen') return
        if (event.button !== 0 || (element as HTMLButtonElement).disabled) return
        event.preventDefault()
        touches.set(event.pointerId, { x: event.clientX, y: event.clientY })
        element.setPointerCapture(event.pointerId)
        element.focus({ preventScroll: true })
    })
    element.addEventListener('pointercancel', event => { touches.delete(event.pointerId) })
    element.addEventListener('lostpointercapture', event => { touches.delete(event.pointerId) })
    element.addEventListener('pointerup', event => {
        const start = touches.get(event.pointerId)
        if (!start) return
        touches.delete(event.pointerId)
        event.preventDefault()
        if (element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId)
        const bounds = element.getBoundingClientRect()
        const inside = event.clientX >= bounds.left && event.clientX <= bounds.right
            && event.clientY >= bounds.top && event.clientY <= bounds.bottom
        const moved = Math.hypot(event.clientX - start.x, event.clientY - start.y) > 12
        // Remember even canceled taps so a synthetic click cannot undo drag cancellation.
        lastTouch = { time: performance.now(), x: event.clientX, y: event.clientY }
        if (!inside || moved || (element as HTMLButtonElement).disabled) return
        if (action) action()
        else element.click() // Preserve the anchor's native navigation behavior.
    })
    element.addEventListener('click', event => {
        if (event.detail !== 0 && lastTouch && performance.now() - lastTouch.time < 800
            && Math.hypot(event.clientX - lastTouch.x, event.clientY - lastTouch.y) <= 12) {
            event.preventDefault()
            event.stopImmediatePropagation()
            return
        }
        if (action) action()
    })
}
