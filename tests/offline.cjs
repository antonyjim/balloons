const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')

test('worker waits for approval, bypasses update metadata and deletes only owned caches', async () => {
    const events = {}, removed = []
    let skipped = 0, claimed = 0, requested = []
    const cache = { addAll: async urls => { requested = urls }, match: async () => 'offline-document' }
    const source = fs.readFileSync('public/sw.js', 'utf8').replace('["__PRECACHE__"]', '["/index.html","/app.js"]')
    vm.runInNewContext(source, {
        self: { location: { origin: 'https://balloons.test' }, addEventListener: (name, fn) => events[name] = fn,
            skipWaiting: () => skipped++, clients: { claim: async () => claimed++ } },
        caches: { open: async () => cache, keys: async () => ['balloons-old', 'another-app'],
            delete: async key => removed.push(key) },
        Request: class { constructor(url, options) { this.url = url; this.cache = options.cache } },
        URL, fetch: () => { throw new Error('offline') }
    })
    await new Promise((resolve, reject) => events.install({ waitUntil: promise => promise.then(resolve, reject) }))
    assert.equal(requested.length, 2)
    assert.equal(requested[0].cache, 'reload')
    assert.equal(skipped, 0)
    events.message({ data: { type: 'SKIP_WAITING' } })
    assert.equal(skipped, 1)
    await new Promise((resolve, reject) => events.activate({ waitUntil: promise => promise.then(resolve, reject) }))
    assert.deepEqual(removed, ['balloons-old'])
    assert.equal(claimed, 1)
    events.fetch({ request: { url: 'https://balloons.test/version.json', method: 'GET' }, respondWith: () => assert.fail('metadata must bypass cache') })
    let response
    events.fetch({ request: { url: 'https://balloons.test/', method: 'GET', mode: 'navigate' }, respondWith: promise => response = promise })
    assert.equal(await response, 'offline-document')
})
