const { test } = require('node:test')
const assert = require('node:assert/strict')
const { sceneGround } = require('../dist-ts/sceneGround')
const { setupNavigation } = require('../dist-ts/navigation')

test('ground follows watermelons actually in play, including debris, then restores the full sky', () => {
    assert.deepEqual(sceneGround(800, []), { visible: false, y: 800 })
    assert.deepEqual(sceneGround(800, [{ finish: 'hot-air' }, { finish: 'latex' }]), { visible: false, y: 800 })
    const objects = [{ finish: 'watermelon', popped: true, popTime: 1 }]
    assert.deepEqual(sceneGround(800, objects), { visible: true, y: 736 })
    objects.pop()
    assert.deepEqual(sceneGround(800, objects), { visible: false, y: 800 })
    assert.deepEqual(sceneGround(20, [{ finish: 'watermelon' }]), { visible: true, y: 0 })
})

test('navigation accepts a sketchpad deep link and handles back/forward without replacing the document', () => {
    const previous = global.window
    const browser = new EventTarget()
    browser.location = { hash: '#/sketchpad' }
    global.window = browser
    const views = []
    try {
        setupNavigation(view => views.push(view))
        browser.location.hash = '#/balloons'
        browser.dispatchEvent(new Event('hashchange'))
        browser.location.hash = '#/sketchpad'
        browser.dispatchEvent(new Event('hashchange'))
        browser.location.hash = '#unknown'
        browser.dispatchEvent(new Event('hashchange'))
        browser.location.hash = '#/matching'
        browser.dispatchEvent(new Event('hashchange'))
        assert.deepEqual(views, ['sketchpad', 'balloons', 'sketchpad', 'balloons', 'matching'])
        assert.equal(global.window, browser)
    } finally { global.window = previous }
})
