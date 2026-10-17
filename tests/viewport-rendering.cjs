const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const source = fs.readFileSync('dist-ts/index.js', 'utf8')
function extract(name) {
    const start = source.indexOf(`\nfunction ${name}(`) + 1
    return source.slice(start, source.indexOf('\n}', start) + 2)
}

test('each frame clears the entire viewport at fractional and high pixel densities', () => {
    for (const dpr of [0.25, 0.5, 0.8, 1, 1.25, 2]) {
        const width = 1600, height = 1200, canvas = { width: width * dpr, height: height * dpr }
        let cleared
        const context = {
            width, height, canvas, currentDpr: dpr, groundY: 1100, balloons: [], scenery: { water: false },
            ctx: { clearRect(x, y, w, h) { cleared = [x, y, w * dpr, h * dpr] } },
            paintBalloon_1: { paintLayer: { draw() {} } },
            water_1: { waterSurface: () => null, drawWater() {}, waterTime: () => 0 }
        }
        vm.runInNewContext(extract('render') + '\nrender()', context)
        assert.deepEqual(cleared, [0, 0, canvas.width, canvas.height], `DPR ${dpr}`)
    }
})

test('CSS viewport changes refresh the transform even if rounded backing dimensions stay the same', () => {
    const transforms = []
    const context = {
        balloonViewActive: true, width: 1000, height: 800,
        currentPixelWidth: 500, currentPixelHeight: 400, currentDpr: 0.5,
        window: { devicePixelRatio: 0.5 }, syncGround() {},
        canvas: { width: 500, height: 400, getBoundingClientRect: () => ({ width: 1000.4, height: 800.4 }) },
        ctx: { setTransform(...values) { transforms.push(values) } }
    }
    vm.runInNewContext(extract('resize') + '\nresize()', context)
    assert.equal(context.width, 1000.4)
    assert.equal(context.height, 800.4)
    assert.equal(transforms.length, 1)
    assert.equal(transforms[0][0], 500 / 1000.4)
})

test('paint reset clears every backing pixel when zoomed out and restores its drawing transform', () => {
    const { PaintLayer } = require('../dist-ts/objects/paintBalloon')
    const previousDocument = global.document, previousPath = global.Path2D
    global.Path2D = class {}
    try {
        for (const dpr of [0.5, 0.8, 2]) {
            const stack = []
            let sx = 1, sy = 1, cleared
            const ctx = {
                save() { stack.push([sx, sy]) }, restore() { [sx, sy] = stack.pop() },
                setTransform(a, b, c, d) { sx = a; sy = d },
                clearRect(x, y, width, height) { cleared = [width * sx, height * sy] },
                translate() {}, rotate() {}, scale() {}, fill() {}
            }
            global.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) }
            const layer = new PaintLayer()
            layer.add({ x: 400, y: 300, radius: 30, color: '#f00' })
            layer.draw({ drawImage() {} }, 1600, 1200, dpr)
            layer.clear()
            assert.deepEqual(cleared, [1600 * dpr, 1200 * dpr])
            assert.deepEqual([sx, sy], [dpr, dpr])
        }
    } finally { global.document = previousDocument; global.Path2D = previousPath }
})
