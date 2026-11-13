import type { PhysicsOptions } from './physicsOptions'
import type { Balloon } from './balloonTypes'
export interface PaintMotion {
    stretch: number; stretchVelocity: number; time: number; grounded?: boolean; supported?: boolean; contacts?: { nx: number; ny: number; depth: number; target?: number }[]
    flowX?: number; flowY?: number; flowVX?: number; flowVY?: number
    anchorX: number; anchorY: number; anchorVX: number; anchorVY: number
}
type Point = { x: number; y: number }
// Continuous water-balloon profile: a pinched neck flowing into a full belly.
const segments = [
    [[0,-.88],[.13,-.86],[.12,-.69],[.38,-.6]],
    [[.38,-.6],[.72,-.45],[.92,-.2],[.92,.16]],
    [[.92,.16],[.92,.65],[.55,.96],[0,.96]],
    [[0,.96],[-.55,.96],[-.92,.65],[-.92,.16]],
    [[-.92,.16],[-.92,-.2],[-.72,-.45],[-.38,-.6]],
    [[-.38,-.6],[-.12,-.69],[-.13,-.86],[0,-.88]]
]
const base: Point[] = segments.flatMap(points => Array.from({ length: 24 }, (_, i) => {
    const t = i / 24, u = 1 - t
    return { x: u**3*points[0][0]+3*u*u*t*points[1][0]+3*u*t*t*points[2][0]+t**3*points[3][0], y: u**3*points[0][1]+3*u*u*t*points[1][1]+3*u*t*t*points[2][1]+t**3*points[3][1] }
}))
/** One outline drives drawing, pointer hits and screen/contact bounds. */
export function paintOutline(balloon: Balloon, knot = false): Point[] {
    const stretch = balloon.paintMotion?.stretch ?? 1
    const points = knot ? [{ x: -.055, y: -.84 }, { x: -.065, y: -.94 }, { x: -.11, y: -1.03 }, { x: -.045, y: -1.05 }, { x: .015, y: -1.025 }, { x: .08, y: -1.045 }, { x: .07, y: -.96 }, { x: .05, y: -.84 }] : base
    const outline=points.map(({x,y})=>({x:balloon.radius*x/Math.sqrt(stretch),y:balloon.radius*y*stretch}))
    if(knot) return outline
    const area=(polygon: Point[]): number => Math.abs(polygon.reduce((sum,p,i)=>{
        const next=polygon[(i+1)%polygon.length]
        return sum+p.x*next.y-next.x*p.y
    },0))*.5
    const originalArea=area(outline)
    const c=Math.cos(balloon.angle),s=Math.sin(balloon.angle)
    const deformed=outline.map(point=>{
        // A small inertial shear redistributes the liquid without changing its
        // area. It follows movement and impact, rather than a repeating animation.
        const wx=point.x*c-point.y*s,wy=point.x*s+point.y*c
        const flowX=balloon.paintMotion?.flowX ?? 0,flowY=balloon.paintMotion?.flowY ?? 0
        const sx=wx+flowX*wy,sy=wy*(1-flowY)
        let px=(sx*c+sy*s),py=(-sx*s+sy*c)
        for(const contact of balloon.paintMotion?.contacts ?? []) {
            const nx=contact.nx*c+contact.ny*s,ny=-contact.nx*s+contact.ny*c
            const facing=Math.max(0,(point.x*nx+point.y*ny)/Math.max(1,Math.hypot(point.x,point.y)))
            const dent=contact.depth*facing**4
            px-=nx*dent;py-=ny*dent
        }
        return {x:px,y:py}
    })
    // Liquid redistributes inside its skin; contact cannot remove its volume.
    const scale=Math.sqrt(originalArea/Math.max(.001,area(deformed)))
    return deformed.map(p=>({x:p.x*scale,y:p.y*scale}))
}
export function paintWorldOutline(balloon: Balloon): Point[] {
    const c = Math.cos(balloon.angle), s = Math.sin(balloon.angle)
    return [...paintOutline(balloon), ...paintOutline(balloon, true)].map(p => ({ x: balloon.x + p.x*c-p.y*s, y: balloon.y+p.x*s+p.y*c }))
}
export function paintContactRadius(balloon: Balloon, angle: number): number {
    const c = Math.cos(angle), s = Math.sin(angle)
    // Use a fixed-volume envelope for the solver. Visual contact relaxation
    // cannot change separation distance and feed back into the next contact.
    const envelope={...balloon,paintMotion:balloon.paintMotion?{...balloon.paintMotion,contacts:[]}:undefined}
    return Math.max(...paintWorldOutline(envelope).map(p => (p.x-balloon.x)*c+(p.y-balloon.y)*s))
}
export function containsPaintPoint(balloon: Balloon, x: number, y: number): boolean {
    const dx=x-balloon.x, dy=y-balloon.y, c=Math.cos(balloon.angle), s=Math.sin(balloon.angle)
    x=dx*c+dy*s; y=-dx*s+dy*c
    return [false, true].some(knot => {
        const points=paintOutline(balloon,knot)
        let inside=false
        for (let i=0,j=points.length-1;i<points.length;j=i++) {
            const a=points[i], b=points[j]
            if ((a.y>y)!==(b.y>y) && x < (b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x) inside=!inside
        }
        return inside
    })
}

/** Contact deformation is expressed in world space, independent of body rotation. */
export function pressPaint(balloon: Balloon,nx: number,ny: number,depth: number): void {
    if(balloon.finish!=='paint'||!balloon.paintMotion||balloon.pointerId!==null) return
    const contacts=balloon.paintMotion.contacts ??= []
    const existing=contacts.find(p=>p.nx*nx+p.ny*ny>.94)
    const compression=Math.min(balloon.radius*.12,balloon.radius*.04+depth*.1)
    if(existing) { existing.target=Math.max(existing.target ?? 0,compression);existing.nx=nx;existing.ny=ny }
    else if(contacts.length<8) contacts.push({nx,ny,depth:0,target:compression})
    if(ny>.45) balloon.paintMotion.supported=true
}

export const paintPhysics: Readonly<Partial<PhysicsOptions>> = {
    buoyancy: 0,
    linearDrag: .08,
    releaseImpulse: 0,
    collisionRadiusRatio: .9,
    breezeResponse: 0,
    rockAmplitude: 0,
    rotationTransfer: 0,
    collisionRestitution: .02
}

