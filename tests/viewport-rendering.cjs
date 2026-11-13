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

test('static paint cache uses the full backing canvas and reset drops it at any pixel density', () => {
    const { PaintLayer }=require('../dist-ts/objects/paintBalloon')
    const previousPath=global.Path2D,previousDocument=global.document
    global.Path2D=class {}
    try {
        for(const dpr of [.5,.8,2]) {
            let cleared,depth=0,images=0
            const paint={setTransform(){},clearRect(x,y,w,h){cleared=[w,h]},save(){depth++},restore(){depth--},translate(){},rotate(){},scale(){},fill(){}}
            global.document={createElement:()=>({width:0,height:0,getContext:()=>paint})}
            const layer=new PaintLayer(()=>0),ctx={drawImage(){images++}}
            layer.add({x:400,y:300,radius:30,color:'#f00'})
            layer.draw(ctx,1600,1200,dpr)
            assert.deepEqual(cleared,[1600*dpr,1200*dpr])
            assert.equal(depth,0)
            assert.equal(images,1)
            layer.clear();layer.draw(ctx,1600,1200,dpr)
            assert.equal(images,1,'reset paint never draws again')
        }
    } finally {global.Path2D=previousPath;global.document=previousDocument}
})
