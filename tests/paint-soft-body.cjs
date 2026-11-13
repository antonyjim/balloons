const { test } = require('node:test')
const assert = require('node:assert/strict')
const { updatePaintBalloon, constrainPaintBalloon } = require('../dist-ts/objects/paintBalloon')
const { paintOutline, containsPaintPoint } = require('../dist-ts/objects/paintShape')
const { defaultPhysicsOptions: physics } = require('../dist-ts/objects/physicsOptions')
const { containsPoint } = require('../dist-ts/objects/balloon')
function paint(radius=40) {
    return { finish:'paint', radius, x:300,y:300, anchorX:300,anchorY:200, angle:0, angularVelocity:0, vx:0,vy:0, pointerId:1, growing:false, popped:false }
}
function assertKnotAtPointer(b) {
    const length=b.radius*1.05*(b.paintMotion?.stretch ?? 1)
    assert.ok(Math.abs(b.x+Math.sin(b.angle)*length-b.anchorX)<1e-7)
    assert.ok(Math.abs(b.y-Math.cos(b.angle)*length-b.anchorY)<1e-7)
}
test('paint hangs and swings from the knot, even after collision correction', () => {
    const b=paint()
    for (let i=0;i<60;i++) {
        b.anchorX+=3
        updatePaintBalloon(b,1/120,1200,1000,physics)
        assertKnotAtPointer(b)
        assert.ok(Number.isFinite(b.angle))
    }
    assert.ok(Math.abs(b.angle)>.02)
    b.x+=30; b.y+=20
    constrainPaintBalloon(b,1200,1000,physics)
    assertKnotAtPointer(b)
})
test('rapid circular dragging makes full rotations without inflating the body', () => {
    const b=paint()
    b.anchorX=700;b.anchorY=500;b.x=700;b.y=542
    let maxSpeed=0
    for(let i=1;i<=480;i++) {
        const angle=i/240*Math.PI*2*3
        b.anchorX=550+150*Math.cos(angle);b.anchorY=500+150*Math.sin(angle)
        updatePaintBalloon(b,1/240,1500,1500,physics)
        assertKnotAtPointer(b)
        assert.ok(Math.abs(b.paintMotion.stretch-1)<.001)
        maxSpeed=Math.max(maxSpeed,Math.abs(b.angularVelocity))
    }
    assert.ok(b.angle>Math.PI*8,'body follows repeated complete circles')
    assert.ok(maxSpeed>10,'fast circular motion is not capped at the old limit')
})
test('a rotated pile deforms at its contacts and settles without righting or spinning', () => {
    const { updateBalloonPhysics }=require('../dist-ts/physics')
    const { defaultBalloonConfig }=require('../dist-ts/objects/balloon')
    const angles=[.9,2,-1,1.3,2.5]
    const bodies=angles.map((angle,i)=>({...paint(),x:45+(i%2)*65,y:400-Math.floor(i/2)*75,angle,pointerId:null}))
    const low=bodies.map(()=>Infinity),high=bodies.map(()=>-Infinity)
    for(let i=0;i<900;i++) {
        updateBalloonPhysics(bodies,1/120,180,600,defaultBalloonConfig)
        if(i>780) bodies.forEach((b,k)=>{low[k]=Math.min(low[k],b.y);high[k]=Math.max(high[k],b.y)})
    }
    assert.ok(high.every((v,i)=>v-low[i]<.5),'settled stacks move less than half a pixel over the last second')
    assert.ok(bodies.some(b=>b.y<500),'the balloons form a supported stack')
    for(const [i,b] of bodies.entries()) {
        assert.equal(b.popped,false)
        assert.ok(Number.isFinite(b.angle),'contact-driven rolling remains finite')
        assert.ok(Math.abs(b.angularVelocity)<.15,'rolling settles without perpetual spin')
        assert.ok(Math.abs(b.vy)<1,'supported bodies stop falling')
        assert.ok(b.paintMotion.contacts.length>0)
        const deformed=paintOutline(b)
        const undeformed=paintOutline({...b,paintMotion:{...b.paintMotion,contacts:[]}})
        assert.ok(deformed.some((p,j)=>Math.hypot(p.x-undeformed[j].x,p.y-undeformed[j].y)>.1))
    }
})
test('pointer hits follow the rendered deformed outline, including the knot and rotated belly', () => {
    for(const angle of [0,.7,2.3]) for(const stretch of [1,1.6]) {
        const b=paint(80)
        b.angle=angle
        b.paintMotion={ stretch, time:.9 }
        const body=paintOutline(b)
        const c=Math.cos(angle),s=Math.sin(angle)
        for(let i=4;i<body.length-4;i+=4) {
            const p=body[i], prev=body[i-1], next=body[(i+1)%body.length]
            const tx=next.x-prev.x,ty=next.y-prev.y,length=Math.hypot(tx,ty)
            const nx=ty/length,ny=-tx/length
            for(const [offset,expected] of [[-2,true],[2,false]]) {
                const x=p.x+nx*offset,y=p.y+ny*offset
                const wx=b.x+x*c-y*s,wy=b.y+x*s+y*c
                assert.equal(containsPaintPoint(b,wx,wy),expected)
                assert.equal(containsPoint(b,wx,wy),expected)
            }
        }
        const ky=-b.radius*stretch
        assert.equal(containsPoint(b,b.x-ky*s,b.y+ky*c),true)
    }
})


test('paint keeps airborne momentum while ground friction slows sliding over time', () => {
    const { getPhysicsOptions }=require('../dist-ts/objects/objectDefinitions')
    for(const grounded of [false,true]) {
        const b={...paint(),pointerId:null,x:3000,y:grounded?960:100,vx:600}
        const options=getPhysicsOptions(b)
        for(let i=0;i<120;i++) {
            if(!grounded) { b.y=100;b.vy=0 }
            updatePaintBalloon(b,1/120,10000,1000,options)
        }
        assert.ok(b.vx>(grounded?100:540),`momentum survives ${grounded?'sliding':'flight'}: ${b.vx}`)
    }
})
test('contact preserves liquid area and cannot feed changing shape back into collision support', () => {
    const { pressPaint, paintContactRadius }=require('../dist-ts/objects/paintShape')
    const b={...paint(),pointerId:null,y:300,vx:0,vy:0}
    updatePaintBalloon(b,1/120,2000,2000,physics)
    const area=points=>Math.abs(points.reduce((sum,p,i)=>{const q=points[(i+1)%points.length];return sum+p.x*q.y-q.x*p.y},0))/2
    const original=area(paintOutline(b))
    const support=paintContactRadius(b,0)
    const depths=[]
    for(let i=0;i<120;i++) {
        pressPaint(b,1,0,10)
        b.y=300;b.vy=0
        updatePaintBalloon(b,1/120,2000,2000,physics)
        depths.push(b.paintMotion.contacts[0].depth)
        assert.ok(Math.abs(area(paintOutline(b))-original)<1e-7)
        assert.ok(Math.abs(paintContactRadius(b,0)-support)<1e-7)
    }
    assert.ok(depths.every((d,i)=>i===0||d>=depths[i-1]),'steady pressure relaxes without oscillating')
})
test('a stationary held paint balloon does not inject velocity on contact', () => {
    const { resolveBalloonCollisions }=require('../dist-ts/physics')
    const { defaultBalloonConfig }=require('../dist-ts/objects/balloon')
    const held={...paint(),x:200,y:300}
    const free={...paint(),x:250,y:300,pointerId:null}
    resolveBalloonCollisions([held,free],defaultBalloonConfig)
    assert.equal(free.vx,0)
    assert.equal(free.vy,0)
    assert.ok(free.x>250,'contact still separates the bodies')
})


test('floor contact produces rolling and liquid deformation, then settles', () => {
    const { getPhysicsOptions }=require('../dist-ts/objects/objectDefinitions')
    const b={...paint(50),pointerId:null,x:200,y:500,vx:350,vy:300}
    const options=getPhysicsOptions(b)
    let sawRoll=false,sawSlosh=false,initialSlide=0
    for(let i=0;i<600;i++) {
        updatePaintBalloon(b,1/120,2000,600,options)
        if(i===100) initialSlide=b.vx
        if(b.paintMotion.grounded && Math.abs(b.angularVelocity)>.5) sawRoll=true
        if(Math.abs(b.paintMotion.flowY ?? 0)>.01) sawSlosh=true
    }
    assert.equal(b.popped,false)
    assert.ok(sawRoll,'the knot and body turn while moving across the ground')
    assert.ok(sawSlosh,'impact redistributes the liquid instead of holding a rigid silhouette')
    assert.ok(initialSlide>100,'first contact does not stop the throw immediately')
    assert.ok(Math.abs(b.vx)<2,'floor friction eventually stops the slide')
    assert.ok(Math.abs(b.angularVelocity)<.04,'rolling stops with the body')
    assert.ok(Math.abs(b.paintMotion.flowY ?? 0)<.001,'internal motion settles')
})


test('rotated paint bodies meet within one pixel at their deformed visible surfaces', () => {
    const { resolveBalloonCollisions }=require('../dist-ts/physics')
    const { defaultBalloonConfig }=require('../dist-ts/objects/balloon')
    const { paintWorldOutline }=require('../dist-ts/objects/paintShape')
    const gap=(a,b)=>{
        const pa=paintWorldOutline(a).slice(0,paintOutline(a).length),pb=paintWorldOutline(b).slice(0,paintOutline(b).length)
        let minimum=Infinity
        for(const [points,edges] of [[pa,pb],[pb,pa]]) for(const p of points) for(let i=0;i<edges.length;i++) {
            const u=edges[i],v=edges[(i+1)%edges.length],dx=v.x-u.x,dy=v.y-u.y
            const t=Math.max(0,Math.min(1,((p.x-u.x)*dx+(p.y-u.y)*dy)/(dx*dx+dy*dy)))
            minimum=Math.min(minimum,Math.hypot(p.x-u.x-t*dx,p.y-u.y-t*dy))
        }
        return minimum
    }
    for(const [angle,direction] of [[0,0],[1.3,0],[0,Math.PI/2],[1.3,.6]]) {
        const motion=()=>({stretch:1,stretchVelocity:0,time:0,contacts:[{nx:1,ny:0,depth:2}]})
        const a={...paint(),pointerId:null,angle,paintMotion:motion()}
        const b={...paint(55),pointerId:null,x:300+Math.cos(direction)*45,y:300+Math.sin(direction)*45,angle:-.6,paintMotion:motion()}
        resolveBalloonCollisions([a,b],defaultBalloonConfig)
        assert.ok(gap(a,b)<1,`visible contact gap at ${angle}, ${direction}: ${gap(a,b)}`)
    }
})
