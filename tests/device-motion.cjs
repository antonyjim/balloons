const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
function load(Orientation, angle = 0) {
    const events = [], context = { exports: {}, screen: { orientation: { angle } },
        window: { DeviceOrientationEvent: Orientation, addEventListener(name, listener) { events.push([name, listener]) } } }
    vm.runInNewContext(fs.readFileSync('dist-ts/deviceMotion.js', 'utf8'), context)
    return { api: context.exports, events }
}
test('iOS permission is requested synchronously, then a single sensor listener is installed', async () => {
    let requests = 0, resolve
    const app = load({ requestPermission() { requests++; return new Promise(done => { resolve = done }) } })
    const first = app.api.enableDeviceMotion()
    assert.equal(requests, 1)
    app.api.enableDeviceMotion()
    assert.equal(requests, 1)
    resolve('granted')
    assert.equal(await first, true)
    assert.equal(await app.api.enableDeviceMotion(), true)
    assert.equal(app.events.length, 1)
})
test('missing sensors and denied permission fail gracefully; portrait and landscape use screen axes', async () => {
    assert.equal(await load(undefined).api.enableDeviceMotion(), false)
    const denied = load({ requestPermission: async () => 'denied' })
    assert.equal(await denied.api.enableDeviceMotion(), false)
    assert.equal(denied.events.length, 0)
    for (const [angle, beta, gamma, expected] of [[0, 0, 17.5, 0.5], [90, 17.5, 0, -0.5], [-90, 17.5, 0, 0.5]]) {
        const app = load({}, angle)
        app.api.onOrientation({ beta, gamma })
        app.api.updateDeviceMotion(10)
        assert.ok(Math.abs(app.api.getDeviceTilt() - expected) < 0.001)
    }
})
