const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs'), vm = require('node:vm')
test('CSS scale restores preferences, resizes the logical viewport and converts drag coordinates', () => {
    const props = new Map(), saved = new Map([['balloons.page-scale', '125']])
    const browser = new EventTarget()
    browser.innerWidth = 1000; browser.innerHeight = 800
    let resizes = 0; browser.addEventListener('resize', () => resizes++)
    const context = { exports: {}, Event, window: browser,
        document: { documentElement: { style: { setProperty: (name, value) => props.set(name, value) } } },
        localStorage: { getItem: key => saved.get(key), setItem: (key, value) => saved.set(key, value) } }
    vm.runInNewContext(fs.readFileSync('dist-ts/pageScale.js', 'utf8'), context)
    const api = context.exports
    api.setupPageScale()
    assert.equal(props.get('--page-scale'), '1.25')
    assert.equal(props.get('--page-width'), '800px')
    assert.equal(props.get('--page-height'), '640px')
    assert.equal(api.layoutPixels(250), 200)
    const change = new Event('page-scale-change'); change.detail = 150; browser.dispatchEvent(change)
    assert.equal(saved.get('balloons.page-scale'), '150')
    assert.equal(api.layoutPixels(300), 200)
    assert.equal(resizes, 2)
    browser.innerWidth = 900; browser.dispatchEvent(new Event('resize'))
    assert.equal(props.get('--page-width'), '600px')
    saved.set('balloons.page-scale', '100')
    const storage = new Event('storage'); storage.key = 'balloons.page-scale'; browser.dispatchEvent(storage)
    assert.equal(props.get('--page-width'), '900px')
    assert.equal(api.layoutPixels(200), 200)
    for (const value of [null, undefined, 'nonsense', 0, -1, 999, Infinity]) assert.equal(api.parsePageScale(value), 100)
})
