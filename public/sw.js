const CACHE = 'balloons-__BUILD_VERSION__'
const ASSETS = ["__PRECACHE__"]

// Do not replay a followed redirect as a navigation response, notably on iOS.
function cleanResponse(response) {
    const headers = new Headers(response.headers)
    headers.delete('content-length')
    headers.delete('content-encoding')
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
}

self.addEventListener('install', event => {
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE)
        let next = 0
        const tasks = Array.from({ length: Math.min(4, ASSETS.length) }, async () => {
            while (next < ASSETS.length) {
                const asset = ASSETS[next++]
                const request = new Request(new URL(asset.url, self.location.origin), {
                    cache: 'no-store', mode: 'same-origin', credentials: 'same-origin',
                    redirect: 'follow', integrity: asset.integrity
                })
                const response = await fetch(request)
                if (!response.ok || response.type === 'opaque' || response.type === 'opaqueredirect') {
                    throw new Error(`Offline asset failed: ${asset.url} (${response.status})`)
                }
                if (asset.url !== '/' && !asset.url.endsWith('.html')
                    && response.headers.get('content-type')?.includes('text/html')) {
                    throw new Error(`HTML returned instead of offline asset: ${asset.url}`)
                }
                await cache.put(asset.url, cleanResponse(response))
            }
        })
        // Finish outstanding writes before removing an incomplete install.
        const results = await Promise.allSettled(tasks)
        const failure = results.find(result => result.status === 'rejected')
        if (failure) {
            await caches.delete(CACHE)
            throw failure.reason
        }
        // Old releases cached Cloudflare's /index.html redirect. Those workers
        // can fail before the app/update button loads, so allow a complete fixed
        // release to replace that broken worker without waiting for its UI.
        try {
            for (const key of await caches.keys()) {
                if (!key.startsWith('balloons-') || key === CACHE) continue
                const previous = await caches.open(key)
                const document = await previous.match('/index.html')
                if (document?.redirected) { await self.skipWaiting(); break }
            }
        } catch (error) { console.warn('Could not inspect legacy cache', error) }
    })())
})
self.addEventListener('message', event => {
    if (event.data?.type === 'SKIP_WAITING') event.waitUntil(self.skipWaiting())
})
self.addEventListener('activate', event => {
    event.waitUntil((async () => {
        try {
            await Promise.all((await caches.keys()).filter(key =>
                key.startsWith('balloons-') && key !== CACHE).map(key => caches.delete(key)))
        } catch (error) { console.warn('Old offline caches could not be removed', error) }
        await self.clients.claim()
    })())
})
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url)
    if (event.request.method !== 'GET' || url.origin !== self.location.origin) return
    if (url.pathname === '/version.json' || url.pathname === '/sw.js') return
    const navigation = event.request.mode === 'navigate'
    if (!navigation && !ASSETS.some(asset => asset.url === url.pathname)) return
    if (event.request.headers.has('range')) return
    event.respondWith((async () => {
        try {
            const cache = await caches.open(CACHE)
            const cached = await cache.match(navigation ? '/' : url.pathname)
            if (cached) return cached.redirected ? cleanResponse(cached) : cached
        } catch (error) { console.warn('Offline cache unavailable; trying network', error) }
        try {
            return await fetch(event.request)
        } catch {
            return new Response(navigation
                ? '<!doctype html><meta name="viewport" content="width=device-width"><title>Balloons is offline</title><h1>Balloons is offline</h1><p>Reconnect and reload to finish loading the app. Your saved settings are still here.</p><button onclick="location.reload()">Try again</button>'
                : 'This resource is unavailable offline. Reconnect and reload.', {
                status: 503, headers: { 'Content-Type': navigation ? 'text/html; charset=utf-8' : 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }
            })
        }
    })())
})
