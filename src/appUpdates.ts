import { bindActivation } from './activation'

/** Check static deployments without an API, including when installed apps resume. */
export function setupAppUpdates(): void {
    if (!('serviceWorker' in navigator)) return
    window.addEventListener('load', () => {
        void navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then(registration => {
            let forceUpdate = false
            let checking = false
            let applying = false
            const button = document.querySelector<HTMLButtonElement>('#app-update')!
            const apply = () => {
                if (!registration.waiting) return
                applying = true
                button.disabled = true
                registration.waiting.postMessage({ type: 'SKIP_WAITING' })
            }
            bindActivation(button, apply)
            const offer = () => {
                if (!registration.waiting) return
                if (forceUpdate) apply()
                else button.hidden = false
            }
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                if (applying) window.location.reload()
            })
            registration.addEventListener('updatefound', () => {
                const worker = registration.installing
                worker?.addEventListener('statechange', () => {
                    if (worker.state === 'installed') offer()
                })
            })
            const check = async () => {
                if (checking || document.hidden || !navigator.onLine) return
                checking = true
                try {
                    const response = await fetch('/version.json', { cache: 'no-store' })
                    if (response.ok) forceUpdate = (await response.json()).forceUpdate === true
                    await registration.update()
                    offer()
                } catch { /* Offline: retry on resume. */ }
                finally { checking = false }
            }
            offer()
            void check()
            window.setInterval(() => { void check() }, 60_000)
            window.addEventListener('online', () => { void check() })
            document.addEventListener('visibilitychange', () => { if (!document.hidden) void check() })
        }).catch(console.error)
    })
}
