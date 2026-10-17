import { bindActivation } from './activation'

/** Install complete releases, retry transient failures, and reload only on request. */
export function setupAppUpdates(): void {
    if (!('serviceWorker' in navigator)) return
    const start = (): void => {
        let registration: ServiceWorkerRegistration | null = null
        let checking = false, applying = false, forceUpdate = false, switched = false
        let controller = navigator.serviceWorker.controller
        let applyTimeout: number | undefined
        const button = document.querySelector<HTMLButtonElement>('#app-update')
        const resetButton = (): void => {
            applying = false
            clearTimeout(applyTimeout)
            if (button) { button.disabled = false; button.textContent = 'Update available ? Reload' }
        }
        const apply = (): void => {
            if (applying) return
            if (switched) { window.location.reload(); return }
            const waiting = registration?.waiting
            if (!waiting) return
            applying = true
            if (button) { button.disabled = true; button.textContent = 'Applying update?' }
            // Failed/redundant workers must not strand a disabled update control.
            applyTimeout = window.setTimeout(resetButton, 15_000)
            try { waiting.postMessage({ type: 'SKIP_WAITING' }) }
            catch { resetButton() }
        }
        const offer = (): void => {
            if (!registration?.waiting && !switched) return
            if (button) button.hidden = false
            if (forceUpdate) apply()
        }
        if (button) bindActivation(button, apply)
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            const previous = controller
            controller = navigator.serviceWorker.controller
            if (!previous) return // First installation is not an upgrade.
            if (applying) { clearTimeout(applyTimeout); window.location.reload() }
            else { switched = true; offer() } // Another tab activated it: preserve this drawing until reload.
        })
        const watch = (value: ServiceWorkerRegistration): void => {
            const installing = (): void => {
                const worker = value.installing
                worker?.addEventListener('statechange', () => {
                    if (worker.state === 'installed') offer()
                    if (worker.state === 'redundant' && applying) resetButton()
                })
            }
            value.addEventListener('updatefound', installing)
            installing()
        }
        const check = async (): Promise<void> => {
            if (checking || document.hidden || navigator.onLine === false) return
            checking = true
            try {
                if (!registration) {
                    registration = await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
                    watch(registration)
                    offer()
                }
                // A broken/missing version.json must never block checking the worker itself.
                await Promise.allSettled([
                    (async () => {
                        const controller = new AbortController()
                        const timeout = window.setTimeout(() => controller.abort(), 10_000)
                        try {
                            const response = await fetch('/version.json', { cache: 'no-store', signal: controller.signal })
                            if (response.ok) forceUpdate = (await response.json()).forceUpdate === true
                        } finally { clearTimeout(timeout) }
                    })(),
                    registration.update()
                ])
                offer()
            } catch (error) { console.warn('App update check failed; will retry on resume or reconnect', error) }
            finally { checking = false }
        }
        void check()
        window.setInterval(() => { void check() }, 60_000)
        window.addEventListener('online', () => { void check() })
        document.addEventListener('visibilitychange', () => { if (!document.hidden) void check() })
    }
    if (document.readyState === 'complete') start()
    else window.addEventListener('load', start, { once: true })
}
