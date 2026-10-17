const CACHE = 'balloons-__BUILD_VERSION__'
const ASSETS = ["__PRECACHE__"]

self.addEventListener('install', event => {
    event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS.map(url =>
        new Request(url, { cache: 'reload' })))))
})
self.addEventListener('message', event => {
    if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})
self.addEventListener('activate', event => {
    event.waitUntil((async () => {
        await Promise.all((await caches.keys()).filter(key =>
            key.startsWith('balloons-') && key !== CACHE).map(key => caches.delete(key)))
        await self.clients.claim()
    })())
})
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url)
    if (event.request.method !== 'GET' || url.origin !== self.location.origin) return
    if (url.pathname === '/version.json' || url.pathname === '/sw.js') return
    event.respondWith((async () => {
        const cache = await caches.open(CACHE)
        const cached = await cache.match(event.request.mode === 'navigate' ? '/index.html' : event.request)
        if (cached) return cached
        return fetch(event.request)
    })())
})
