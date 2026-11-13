import type { Balloon } from './balloonTypes'
import { paintOutline } from './paintShape'
type Point={x:number;y:number}
let outlines=new WeakMap<Balloon,Point[]>()
export function beginPaintContacts(): void { outlines=new WeakMap() }
function outline(b: Balloon): Point[] {
    const saved=outlines.get(b)
    if(saved) return saved
    const c=Math.cos(b.angle),s=Math.sin(b.angle)
    const points=paintOutline(b).filter((_,i)=>i%4===0).map(p=>({x:p.x*c-p.y*s,y:p.x*s+p.y*c})).sort((a,b)=>a.x-b.x||a.y-b.y)
    const cross=(a:Point,b:Point,c:Point)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x)
    const half=(source:Point[])=>{const h:Point[]=[];for(const p of source){while(h.length>1&&cross(h[h.length-2],h[h.length-1],p)<=0)h.pop();h.push(p)}h.pop();return h}
    const hull=[...half(points),...half([...points].reverse())]
    outlines.set(b,hull)
    return hull
}
/** Convex body contact follows the rendered liquid surface, with no padding. */
export function paintPairContact(a:Balloon,b:Balloon): {nx:number;ny:number;depth:number}|null {
    const pa=outline(a),pb=outline(b)
    let depth=Infinity,nx=0,ny=0
    for(const polygon of [pa,pb]) for(let i=0;i<polygon.length;i++) {
        const p=polygon[i],q=polygon[(i+1)%polygon.length]
        const length=Math.hypot(q.x-p.x,q.y-p.y)
        if(length<.0001)continue
        const ax=-(q.y-p.y)/length,ay=(q.x-p.x)/length
        let amin=Infinity,amax=-Infinity,bmin=Infinity,bmax=-Infinity
        for(const v of pa){const d=v.x*ax+v.y*ay;amin=Math.min(amin,d);amax=Math.max(amax,d)}
        const offset=(b.x-a.x)*ax+(b.y-a.y)*ay
        for(const v of pb){const d=v.x*ax+v.y*ay+offset;bmin=Math.min(bmin,d);bmax=Math.max(bmax,d)}
        const overlap=Math.min(amax-bmin,bmax-amin)
        if(overlap<-.25)return null
        if(overlap<depth){depth=overlap;nx=ax;ny=ay}
    }
    if((b.x-a.x)*nx+(b.y-a.y)*ny<0){nx=-nx;ny=-ny}
    return {nx,ny,depth:Math.max(0,depth)}
}

export function paintContactBounds(b:Balloon): {left:number;right:number;top:number;bottom:number} {
    const body=outline(b),c=Math.cos(b.angle),s=Math.sin(b.angle)
    const points=[...body,...paintOutline(b,true).map(p=>({x:p.x*c-p.y*s,y:p.x*s+p.y*c}))]
    let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity
    for(const p of points){left=Math.min(left,p.x);right=Math.max(right,p.x);top=Math.min(top,p.y);bottom=Math.max(bottom,p.y)}
    return {left:left+b.x,right:right+b.x,top:top+b.y,bottom:bottom+b.y}
}
