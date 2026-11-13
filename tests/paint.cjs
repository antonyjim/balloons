const { paintSplatterShapes } = require('../dist-ts/objects/paintSplatterShapes')
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { PaintLayer, paintLayer, createPaintSplatter } = require('../dist-ts/objects/paintBalloon')
const audio = require('../dist-ts/audio')
const { popBalloon } = require('../dist-ts/objects/balloon')

function balloon(finish = 'paint') {
    return { x: 100, y: 150, radius: 30, color: '#ff4466', finish,
        popped: false, growing: true, pointerId: 1, popTime: 0 }
}

test('only paint balloons emit paint, and repeated popping emits once', () => {
    const previousSound = audio.playPopSound
    const previousAdd = paintLayer.add
    let splatters = 0
    audio.playPopSound = () => {}
    paintLayer.add = () => { splatters++ }
    try {
        const paint = balloon()
        popBalloon(paint)
        popBalloon(paint)
        popBalloon(balloon('latex'))
        assert.equal(splatters, 1)
        assert.equal(paint.pointerId, null)
        assert.equal(paint.growing, false)
    } finally {
        audio.playPopSound = previousSound
        paintLayer.add = previousAdd
    }
})

test('splatter preserves position and color and generates bounded geometry', () => {
    const splatter = createPaintSplatter(balloon(), () => 0.5)
    assert.equal(splatter.x, 100)
    assert.equal(splatter.y, 150)
    assert.equal(splatter.color, '#ff4466')
    assert.ok(splatter.shape >= 0 && splatter.shape < paintSplatterShapes.length)
    assert.ok(Math.abs(splatter.scaleX) < 30 / 50)
    assert.ok(splatter.scaleY < 30 / 50)
})

test('static paint is cached between frames and each splash expires at 60 seconds', () => {
    const previousPath=global.Path2D,previousDocument=global.document
    global.Path2D=class {}
    let now=0,fills=0,images=0,clears=0
    const positions=[]
    const paint={setTransform(){},clearRect(){clears++},save(){},restore(){},rotate(){},scale(){},translate(x,y){positions.push([x,y])},fill(){fills++}}
    global.document={createElement:()=>({width:0,height:0,getContext:()=>paint})}
    const layer=new PaintLayer(()=>now)
    const ctx={drawImage(){images++}}
    const draw=(width=400,height=600,dpr=2)=>layer.draw(ctx,width,height,dpr)
    try {
        layer.add(balloon());draw()
        assert.equal(fills,1)
        assert.deepEqual(positions[0],[100,150])
        for(let i=0;i<300;i++) { now+=100;draw() }
        assert.equal(fills,1,'unchanged frames never redraw paths')
        assert.equal(clears,1)
        assert.equal(images,301)
        draw(600,400)
        assert.equal(fills,2,'resize rebuilds the cache')
        assert.deepEqual(positions[1],[100,150],'paint does not ooze or drift')
        layer.add(balloon());now=55000;draw()
        assert.equal(fills,4)
        now=60000;draw()
        assert.equal(fills,5,'expiry redraws only the younger splash')
        now=90000;const before=images;draw()
        assert.equal(images,before,'expired paint is not drawn')
        layer.add(balloon());draw();layer.clear()
        const after=images;draw()
        assert.equal(images,after,'reset drops the cached paint')
        layer.add(balloon());now+=120000;draw()
        assert.equal(images,after,'background time counts toward expiration')
    } finally {global.Path2D=previousPath;global.document=previousDocument}
})

test('paint balloons pop at maximum size and emit one splatter', () => {
    const { updateBalloon, defaultBalloonConfig } = require('../dist-ts/objects/balloon')
    const previousSound = audio.playPopSound
    const previousAdd = paintLayer.add
    let splatters = 0
    audio.playPopSound = () => {}
    paintLayer.add = () => { splatters++ }
    try {
        const paint = balloon()
        paint.radius = 9
        updateBalloon(paint, 0.1, 90, 90, defaultBalloonConfig, [paint])
        assert.equal(paint.radius, 10)
        assert.equal(paint.popped, true)
        assert.equal(splatters, 1)
        updateBalloon(paint, 0.1, 90, 90, defaultBalloonConfig, [paint])
        assert.equal(splatters, 1)
    } finally {
        audio.playPopSound = previousSound
        paintLayer.add = previousAdd
    }
})

test('random samples choose different authored silhouettes and transforms', () => {
    const a = createPaintSplatter(balloon(), () => 0.1)
    const b = createPaintSplatter(balloon(), () => 0.8)
    assert.notEqual(a.shape, b.shape)
    assert.notEqual(a.rotation, b.rotation)
    assert.notEqual(a.scaleX, b.scaleX)
})

test('all expanded splatter silhouettes can be selected', () => {
    assert.equal(paintSplatterShapes.length, 28)
    assert.equal(new Set(paintSplatterShapes).size, 28)
    const indices = new Set()
    for (let i = 0; i < paintSplatterShapes.length; i++) indices.add(createPaintSplatter(balloon(), () => (i + 0.5) / paintSplatterShapes.length).shape)
    assert.equal(indices.size, 28)
})


test('paint balloons settle after ordinary drops, remain pickable, and burst on hard throws', () => {
    const { updateBalloonPhysics } = require('../dist-ts/physics')
    const { defaultBalloonConfig } = require('../dist-ts/objects/balloon')
    const sound = audio.playPopSound, add = paintLayer.add
    let splashes = 0
    audio.playPopSound = () => {}
    paintLayer.add = () => splashes++
    const make = () => ({ ...balloon(), x: 200, y: 100, anchorX: 200, anchorY: 100, vx: 0, vy: 0, angle: 0, angularVelocity: 0, pointerId: null, growing: false })
    try {
        const paint = make()
        updateBalloonPhysics([paint], 1/60, 800, 600, defaultBalloonConfig)
        assert.ok(paint.vy > 0)
        assert.ok(paint.y > 100)
        paint.pointerId = 1; paint.anchorY = 600
        for (let i = 0; i < 60; i++) updateBalloonPhysics([paint], 1/60, 800, 600, defaultBalloonConfig)
        assert.equal(paint.popped, false, 'holding near the floor does not burst it')
        paint.pointerId = null
        for (let i = 0; i < 120; i++) updateBalloonPhysics([paint], 1/60, 800, 600, defaultBalloonConfig)
        assert.equal(paint.popped, false)
        assert.equal(splashes, 0)
        for (let i=0;i<600;i++) updateBalloonPhysics([paint],1/120,800,600,defaultBalloonConfig)
        assert.ok(Math.abs(paint.vy)<10, 'paint settles instead of repeatedly bouncing')
        const { paintWorldOutline } = require('../dist-ts/objects/paintShape')
        const bottom=Math.max(...paintWorldOutline(paint).map(p=>p.y))
        assert.ok(Math.abs(bottom-600)<1, 'the visible body rests on the floor')
        paint.pointerId=1;paint.anchorX=300;paint.anchorY=200
        updateBalloonPhysics([paint],1/60,800,600,defaultBalloonConfig)
        assert.equal(paint.popped,false)
        assert.ok(paint.y<400,'a settled balloon can be picked up again')
        const thrown = make()
        const { sampleAppleDrag, releaseAppleThrow } = require('../dist-ts/objects/apple')
        sampleAppleDrag(thrown, 100, 100, 0)
        sampleAppleDrag(thrown, 180, 100, 50)
        releaseAppleThrow(thrown, 50)
        assert.ok(thrown.vx > 1000)
        thrown.x=740; thrown.vx=1950
        for (let i = 0; i < 120; i++) updateBalloonPhysics([thrown], 1/60, 800, 600, defaultBalloonConfig)
        assert.equal(thrown.popped, true)
        assert.equal(splashes, 1)
    } finally { audio.playPopSound = sound; paintLayer.add = add }
})

test('hard collisions burst free paint in either pair order; gentle or held contacts survive', () => {
    const { updateBalloonPhysics } = require('../dist-ts/physics')
    const { defaultBalloonConfig } = require('../dist-ts/objects/balloon')
    const sound = audio.playPopSound, add = paintLayer.add
    audio.playPopSound = () => {}; paintLayer.add = () => {}
    try {
        for (const reverse of [false, true]) for (const held of [false, true]) for (const speed of [30, 1000, 1800]) {
            const paint = { ...balloon(), x: 200, y: 200, anchorX: 200, anchorY: 200, vx: speed, vy: 0, angle: 0, angularVelocity: 0, pointerId: held ? 1 : null, growing: false }
            const other = { ...paint, finish: 'latex', x: 250, anchorX: 250, vx: held ? -speed : 0, pointerId: null }
            updateBalloonPhysics(reverse ? [other, paint] : [paint, other], .001, 800, 600, defaultBalloonConfig)
            assert.equal(paint.popped, !held && speed === 1800)
        }
    } finally { audio.playPopSound = sound; paintLayer.add = add }
})

