import { paintOutline, paintWorldOutline, pressPaint } from './paintShape'
import { paintSplatterShapes } from './paintSplatterShapes'
import type { Balloon } from './balloonTypes'
import type { PhysicsOptions } from './physicsOptions'
import { popBalloon } from './balloon'

export const PAINT_BURST_SPEED = 1500

export { paintPhysics } from './paintShape'

/** Thick, opaque latex over liquid. Broad reflected light replaces drawn outlines. */
export function drawPaintBalloon(ctx: CanvasRenderingContext2D, balloon: Balloon): void {
    const r=balloon.radius, stretch=balloon.paintMotion?.stretch ?? 1
    ctx.save()
    // A small contact shadow anchors resting paint to the floor.
    if (balloon.paintMotion?.grounded && balloon.pointerId === null) {
        const points=paintWorldOutline(balloon)
        const bottom=Math.max(...points.map(p=>p.y))
        ctx.save()
        ctx.translate(balloon.x,bottom)
        ctx.scale(1,.14)
        const shadow=ctx.createRadialGradient(0,0,0,0,0,r*.7)
        shadow.addColorStop(0,'rgba(32,25,38,.25)')
        shadow.addColorStop(1,'rgba(32,25,38,0)')
        ctx.fillStyle=shadow
        ctx.fillRect(-r,-r,r*2,r*2)
        ctx.restore()
    }
    ctx.translate(balloon.x,balloon.y)
    ctx.rotate(balloon.angle)
    const trace=(knot=false): void => {
        ctx.beginPath()
        paintOutline(balloon,knot).forEach((p,i)=>{ if(i===0) ctx.moveTo(p.x,p.y); else ctx.lineTo(p.x,p.y) })
        ctx.closePath()
    }
    trace()
    ctx.fillStyle=balloon.color
    ctx.fill()
    ctx.save()
    ctx.clip()
    // Deform the lighting with the rubber so stretched balloons retain volume.
    ctx.scale(1/Math.sqrt(stretch),stretch)
    const volume=ctx.createRadialGradient(-r*.28,-r*.25,r*.08,r*.05,r*.2,r*1.13)
    volume.addColorStop(0,'rgba(255,255,255,.34)')
    volume.addColorStop(.35,'rgba(255,255,255,.08)')
    volume.addColorStop(.64,'rgba(20,12,32,.06)')
    volume.addColorStop(.84,'rgba(25,8,30,.25)')
    volume.addColorStop(1,'rgba(22,8,27,.5)')
    ctx.fillStyle=volume
    ctx.fillRect(-r*2,-r*2,r*4,r*4)
    // Gentle reflected light along the underside keeps the belly round.
    const bounce=ctx.createRadialGradient(r*.25,r*.92,0,r*.25,r*.92,r*.6)
    bounce.addColorStop(0,'rgba(255,206,165,.22)')
    bounce.addColorStop(1,'rgba(255,206,165,0)')
    ctx.fillStyle=bounce
    ctx.fillRect(-r,-r,r*2,r*2.2)
    // Broad soft window reflection on curved rubber, with a restrained core.
    ctx.save()
    ctx.translate(-r*.35,-r*.12)
    ctx.rotate(.35)
    ctx.scale(.48,1)
    const softbox=ctx.createRadialGradient(0,0,0,0,0,r*.5)
    softbox.addColorStop(0,'rgba(255,255,255,.48)')
    softbox.addColorStop(.32,'rgba(255,255,255,.37)')
    softbox.addColorStop(.7,'rgba(255,255,255,.12)')
    softbox.addColorStop(1,'rgba(255,255,255,0)')
    ctx.fillStyle=softbox
    ctx.fillRect(-r*.5,-r*.5,r,r)
    ctx.beginPath()
    ctx.ellipse(-r*.015,-r*.08,r*.055,r*.13,.05,0,Math.PI*2)
    ctx.fillStyle='rgba(255,255,255,.36)'
    ctx.fill()
    ctx.restore()
    // Shallow folds where the stretched rubber gathers below the tie.
    ctx.lineWidth=r*.012
    ctx.lineCap='round'
    for(const side of [-1,1]) {
        ctx.beginPath()
        ctx.moveTo(side*r*.045,-r*.82)
        ctx.quadraticCurveTo(side*r*.075,-r*.66,side*r*.17,-r*.56)
        ctx.strokeStyle='rgba(47,17,40,.12)'
        ctx.stroke()
    }
    ctx.restore()
    trace(true)
    ctx.fillStyle=balloon.color
    ctx.fill()
    ctx.save()
    ctx.clip()
    const knotShade=ctx.createLinearGradient(-r*.1,0,r*.1,0)
    knotShade.addColorStop(0,'rgba(25,8,35,.3)')
    knotShade.addColorStop(.5,'rgba(255,255,255,.2)')
    knotShade.addColorStop(1,'rgba(25,8,35,.24)')
    ctx.fillStyle=knotShade
    ctx.fillRect(-r*.15,-r*1.1*stretch,r*.3,r*.4*stretch)
    ctx.restore()
    ctx.beginPath()
    ctx.ellipse(0,-r*.89*stretch,r*.058/Math.sqrt(stretch),r*.025*stretch,0,0,Math.PI*2)
    ctx.fillStyle='rgba(55,19,43,.25)'
    ctx.fill()
    ctx.restore()
}

export function updatePaintBalloon(balloon: Balloon, dt: number, width: number, ground: number, physics: Readonly<PhysicsOptions>): void {
    const motion = balloon.paintMotion ??= { stretch: 1, stretchVelocity: 0, time: 0, anchorX: balloon.anchorX, anchorY: balloon.anchorY, anchorVX: 0, anchorVY: 0 }
    motion.time += dt
    const step = Math.max(.001, dt)
    const held = balloon.pointerId !== null
    // Relax toward the previous contact load monotonically, without a spring.
    if(motion.contacts) motion.contacts=motion.contacts.map(p=>({
        ...p,depth:p.depth+((p.target ?? 0)-p.depth)*(1-Math.exp(-10*dt)),target:0
    })).filter(p=>p.depth>.001)
    const resting=motion.grounded||motion.supported
    motion.supported=false
    motion.stretchVelocity=0
    motion.stretch += (1-motion.stretch)*(1-Math.exp(-14*dt))
    if (held) {
        motion.grounded=false
        motion.contacts=[]
        // Project the inertial body onto a fixed-length tether. There is no
        // upright spring or angular speed cap fighting a circular pointer path.
        const length=balloon.radius*1.05*motion.stretch
        const oldX=balloon.x,oldY=balloon.y,oldAngle=balloon.angle
        let dx=balloon.x+balloon.vx*dt-balloon.anchorX
        let dy=balloon.y+(balloon.vy+900*dt)*dt-balloon.anchorY
        let distance=Math.hypot(dx,dy)
        if(distance<.001) { dx=-Math.sin(balloon.angle);dy=Math.cos(balloon.angle);distance=1 }
        balloon.x=balloon.anchorX+dx/distance*length
        balloon.y=balloon.anchorY+dy/distance*length
        const angle=Math.atan2(-dx,dy)
        const turn=Math.atan2(Math.sin(angle-oldAngle),Math.cos(angle-oldAngle))
        balloon.angle+=turn
        balloon.angularVelocity=turn/step
        balloon.vx=(balloon.x-oldX)/step
        balloon.vy=(balloon.y-oldY)/step
        motion.anchorX=balloon.anchorX;motion.anchorY=balloon.anchorY
    } else {
        const oldVX=balloon.vx
        if(resting) {
            // Rolling resistance acts once per step and removes a fixed amount
            // of momentum, rather than multiplying it on every collision pass.
            const loss=180*dt
            balloon.vx=Math.sign(balloon.vx)*Math.max(0,Math.abs(balloon.vx)-loss)
            const rolling=balloon.vx/Math.max(15,balloon.radius)*.8
            balloon.angularVelocity+=(rolling-balloon.angularVelocity)*(1-Math.exp(-12*dt))
            if(Math.abs(balloon.vx)<2 && Math.abs(balloon.angularVelocity)<.04) balloon.angularVelocity=0
        } else balloon.angularVelocity*=Math.exp(-1.5*dt)
        motion.flowVX=(motion.flowVX ?? 0)+(oldVX-balloon.vx)*.0009
        balloon.vy+=900*dt
        const drag=Math.exp(-physics.linearDrag*dt)
        balloon.vx*=drag;balloon.vy*=drag
        const speed=Math.hypot(balloon.vx,balloon.vy)
        if(speed>physics.maxSpeed) { balloon.vx*=physics.maxSpeed/speed;balloon.vy*=physics.maxSpeed/speed }
        balloon.x+=balloon.vx*dt;balloon.y+=balloon.vy*dt
        balloon.angle+=balloon.angularVelocity*dt
    }
    // Damped internal slosh persists briefly after an impact, then relaxes.
    motion.flowVX=(motion.flowVX ?? 0)+(-(motion.flowX ?? 0)*38-(motion.flowVX ?? 0)*8)*dt
    motion.flowVY=(motion.flowVY ?? 0)+(-(motion.flowY ?? 0)*38-(motion.flowVY ?? 0)*8)*dt
    motion.flowX=Math.max(-.12,Math.min(.12,(motion.flowX ?? 0)+motion.flowVX*dt))
    motion.flowY=Math.max(-.1,Math.min(.16,(motion.flowY ?? 0)+motion.flowVY*dt))
    constrainPaintBalloon(balloon, width, ground, physics)
}

export function constrainPaintBalloon(balloon: Balloon, width: number, ground: number, _physics: Readonly<PhysicsOptions>): void {
    if (balloon.popped) return
    if (balloon.pointerId !== null) {
        // Collision separation may move the body, but cannot move the gripped knot.
        const length=balloon.radius*1.05*(balloon.paintMotion?.stretch ?? 1)
        balloon.x=balloon.anchorX-Math.sin(balloon.angle)*length
        balloon.y=balloon.anchorY+Math.cos(balloon.angle)*length
        return
    }
    const points=paintWorldOutline(balloon)
    const left=Math.min(...points.map(p=>p.x)), right=Math.max(...points.map(p=>p.x))
    const top=Math.min(...points.map(p=>p.y)), bottom=Math.max(...points.map(p=>p.y))
    const impact = (bottom >= ground && balloon.vy > PAINT_BURST_SPEED) ||
        (left <= 0 && balloon.vx < -PAINT_BURST_SPEED) ||
        (right >= width && balloon.vx > PAINT_BURST_SPEED) ||
        (top <= 0 && balloon.vy < -PAINT_BURST_SPEED)
    if (balloon.paintMotion) balloon.paintMotion.grounded = bottom >= ground-.5 && balloon.vy >= 0
    if (bottom >= ground) {
        pressPaint(balloon,0,1,balloon.radius*.8)
        if(balloon.paintMotion && balloon.vy>60) {
            balloon.paintMotion.flowVY=(balloon.paintMotion.flowVY ?? 0)+Math.min(1.8,balloon.vy*.002)
        }
        balloon.y -= bottom-ground
        if (balloon.vy > 0) balloon.vy = balloon.vy > 160 ? -balloon.vy*.08 : 0
    }
    if (left < 0) { balloon.x -= left; if (balloon.vx < 0) balloon.vx *= -.25 }
    else if (right > width) { balloon.x -= right-width; if (balloon.vx > 0) balloon.vx *= -.25 }
    if (top < 0) { balloon.y -= top; if (balloon.vy < 0) balloon.vy *= -.25 }
    if ((balloon.paintMotion?.grounded || balloon.paintMotion?.supported) && Math.abs(balloon.vy)<35) {
        balloon.vy=0
        if(Math.abs(balloon.vx)<2 && Math.abs(balloon.angularVelocity)<.04) balloon.angularVelocity=0
    }
    if (impact) popBalloon(balloon)
}

export interface PaintSplatter {
    x: number
    y: number
    color: string
    shape: number
    rotation: number
    scaleX: number
    scaleY: number
}

/** Pick and transform an authored silhouette once, preserving it between frames. */
export function createPaintSplatter(
    balloon: Pick<Balloon, 'x' | 'y' | 'radius' | 'color'>,
    random: () => number = Math.random
): PaintSplatter {
    return {
        x: balloon.x,
        y: balloon.y,
        color: balloon.color,
        shape: Math.floor(random() * paintSplatterShapes.length),
        rotation: random() * Math.PI * 2,
        scaleX: balloon.radius / 65 * (0.85 + random() * 0.25) * (random() < 0.5 ? -1 : 1),
        scaleY: balloon.radius / 65 * (0.85 + random() * 0.25)
    }
}

const silhouetteCache = new Map<number, Path2D>()

export const PAINT_LIFETIME_MS = 60_000
const MAX_SPLATTERS = 256
interface TimedSplatter { splatter: PaintSplatter; createdAt: number }

/** Static splashes are composited only when paint changes, not every frame. */
export class PaintLayer {
    private splatters: TimedSplatter[] = []
    private canvas: HTMLCanvasElement | null = null
    private dirty = true
    private width = 0
    private height = 0
    constructor(private readonly now: () => number = Date.now) {}

    add(balloon: Balloon): void {
        const now = this.now()
        this.expire(now)
        this.splatters.push({ splatter: createPaintSplatter(balloon), createdAt: now })
        if (this.splatters.length > MAX_SPLATTERS) this.splatters.shift()
        this.dirty = true
    }

    clear(): void {
        this.splatters.length = 0
        this.canvas = null
        this.dirty = true
    }

    private expire(now: number): void {
        const retained = this.splatters.filter(paint => now - paint.createdAt < PAINT_LIFETIME_MS)
        if (retained.length !== this.splatters.length) { this.splatters = retained; this.dirty = true }
    }

    draw(ctx: CanvasRenderingContext2D, width: number, height: number, dpr: number): void {
        this.expire(this.now())
        if (!this.splatters.length) { this.canvas = null; return }
        if (width <= 0 || height <= 0) return
        const pixelWidth = Math.max(1, Math.round(width * dpr))
        const pixelHeight = Math.max(1, Math.round(height * dpr))
        if (!this.canvas) this.canvas = document.createElement('canvas')
        if (this.canvas.width !== pixelWidth || this.canvas.height !== pixelHeight || this.width !== width || this.height !== height) {
            this.canvas.width = pixelWidth
            this.canvas.height = pixelHeight
            this.width = width; this.height = height
            this.dirty = true
        }
        if (this.dirty) {
            const paint = this.canvas.getContext('2d')
            if (!paint) return
            paint.setTransform(1, 0, 0, 1, 0, 0)
            paint.clearRect(0, 0, pixelWidth, pixelHeight)
            paint.setTransform(pixelWidth / width, 0, 0, pixelHeight / height, 0, 0)
            for (const { splatter } of this.splatters) {
                paint.save()
                paint.globalAlpha = .88
                paint.fillStyle = splatter.color
                paint.translate(splatter.x, splatter.y)
                paint.rotate(splatter.rotation)
                paint.scale(splatter.scaleX, splatter.scaleY)
                let silhouette = silhouetteCache.get(splatter.shape)
                if (!silhouette) {
                    silhouette = new Path2D(paintSplatterShapes[splatter.shape])
                    silhouetteCache.set(splatter.shape, silhouette)
                }
                paint.fill(silhouette)
                paint.restore()
            }
            this.dirty = false
        }
        ctx.drawImage(this.canvas, 0, 0, width, height)
    }
}

export const paintLayer = new PaintLayer()

export function popPaintBalloon(balloon: Balloon): void {
    paintLayer.add(balloon)
}
