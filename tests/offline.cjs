const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const origin = 'https://balloons.test'
const assets = [{ url: '/', integrity: 'sha256-document' }, { url: '/app.js', integrity: 'sha256-script' }]
function redirected(body = '<h1>app</h1>') {
    const response = new Response(body, { headers: { 'content-type': 'text/html', 'content-length': '999', 'content-encoding': 'gzip' } })
    Object.defineProperty(response, 'redirected', { value: true })
    return response
}
function worker() {
    const events = {}, stores = new Map(), removed = [], requests = []
    let skipped = 0, claimed = 0
    const state = { cacheBroken: false, network: async request => new Response(request.url.endsWith('/app.js') ? 'app()' : '<h1>app</h1>') }
    const caches = {
        async open(key) {
            if (state.cacheBroken) throw new Error('cache unavailable')
            if (!stores.has(key)) stores.set(key, new Map())
            const data = stores.get(key)
            return {
                async put(key, response) { data.set(key, response) },
                async match(key) { const response = data.get(key); return response?.redirected ? redirected() : response?.clone() }
            }
        },
        async keys() { return [...stores.keys()] },
        async delete(key) { removed.push(key); return stores.delete(key) }
    }
    const source = fs.readFileSync('public/sw.js', 'utf8').replace('__BUILD_VERSION__', 'new').replace('["__PRECACHE__"]', JSON.stringify(assets))
    vm.runInNewContext(source, {
        self: { location: { origin }, addEventListener: (name, fn) => events[name] = fn,
            skipWaiting: async () => { skipped++ }, clients: { claim: async () => { claimed++ } } },
        caches, Request, Response, Headers, URL, console: { warn() {} },
        fetch: async request => { requests.push(request); return state.network(request) }
    })
    const lifecycle = name => {
        let promise
        events[name]({ waitUntil(value) { promise = value } })
        return promise
    }
    function request(path = '/', options = {}) {
        let promise
        const input = { url: origin + path, method: 'GET', mode: 'navigate', headers: new Headers(), ...options }
        events.fetch({ request: input, respondWith(value) { promise = value } })
        return promise
    }
    return { events, state, stores, removed, requests, lifecycle, request, skipped: () => skipped, claimed: () => claimed }
}

test('complete releases cache the canonical root with integrity, wait for approval, and remove only owned caches', async () => {
    const app = worker()
    app.stores.set('balloons-old', new Map())
    app.stores.set('another-app', new Map())
    await app.lifecycle('install')
    assert.equal(app.requests.length, 2)
    assert.equal(app.requests[0].url, origin + '/')
    assert.equal(app.requests[0].cache, 'no-store')
    assert.equal(app.requests[0].integrity, assets[0].integrity)
    assert.equal(app.skipped(), 0)
    assert.ok(app.stores.has('balloons-old'), 'installation preserves the active release')
    let messagePromise
    app.events.message({ data: { type: 'SKIP_WAITING' }, waitUntil(value) { messagePromise = value } })
    await messagePromise
    assert.equal(app.skipped(), 1)
    await app.lifecycle('activate')
    assert.deepEqual(app.removed, ['balloons-old'])
    assert.equal(app.claimed(), 1)
    app.state.network = async () => { throw new Error('offline') }
    assert.equal(await (await app.request()).text(), '<h1>app</h1>')
})

test('followed redirects are normalized before caching, including legacy navigation responses', async () => {
    const app = worker()
    app.state.network = async request => request.url.endsWith('/') ? redirected() : new Response('app()')
    await app.lifecycle('install')
    const response = await app.request()
    assert.equal(response.redirected, false)
    assert.equal(response.url, '')
    assert.equal(response.headers.has('content-encoding'), false)
    assert.equal(response.headers.has('content-length'), false)
    assert.equal(await response.text(), '<h1>app</h1>')
    app.stores.get('balloons-new').set('/', redirected())
    assert.equal((await app.request()).redirected, false)
})

test('a broken legacy redirect cache allows a complete repair release to activate without the broken UI', async () => {
    const app = worker()
    app.stores.set('balloons-old', new Map([['/index.html', redirected()]]))
    await app.lifecycle('install')
    assert.equal(app.skipped(), 1)
    assert.ok(app.stores.get('balloons-new').has('/app.js'))
})

test('failed downloads, integrity failures, and HTML asset fallbacks cannot replace the current release', async () => {
    for (const failure of ['http', 'integrity', 'html']) {
        const app = worker()
        app.stores.set('balloons-old', new Map())
        app.state.network = async request => {
            if (!request.url.endsWith('/app.js')) return new Response('<h1>app</h1>')
            if (failure === 'integrity') throw new TypeError('integrity mismatch')
            return new Response('bad response', { status: failure === 'http' ? 404 : 200, headers: { 'content-type': 'text/html' } })
        }
        await assert.rejects(app.lifecycle('install'))
        assert.equal(app.skipped(), 0)
        assert.ok(app.stores.has('balloons-old'))
        assert.equal(app.stores.has('balloons-new'), false)
    }
})

test('cache read errors use the network and fully offline misses produce a recoverable page', async () => {
    const app = worker()
    app.state.cacheBroken = true
    assert.equal((await app.request()).status, 200)
    app.state.network = async () => { throw new Error('offline') }
    const response = await app.request()
    assert.equal(response.status, 503)
    assert.match(await response.text(), /Try again/)
})

test('metadata, unknown assets, non-GET, cross-origin, and range requests bypass the worker', () => {
    const app = worker()
    for (const path of ['/version.json', '/sw.js', '/unknown.png']) assert.equal(app.request(path, { mode: 'cors' }), undefined)
    assert.equal(app.request('/', { method: 'POST' }), undefined)
    assert.equal(app.request('/', { url: 'https://another.test/' }), undefined)
    assert.equal(app.request('/app.js', { mode: 'cors', headers: new Headers({ range: 'bytes=0-10' }) }), undefined)
})
