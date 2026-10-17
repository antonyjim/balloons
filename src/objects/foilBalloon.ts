import type { Balloon } from './balloonTypes'

/** Opaque metallic bands and a crimped seam distinguish foil from latex. */
export function drawFoilBalloon(ctx: CanvasRenderingContext2D, balloon: Balloon): void {
    const r = balloon.radius, w = r * 0.84
    ctx.save()
    ctx.translate(balloon.x, balloon.y)
    ctx.rotate(balloon.angle)
    ctx.beginPath()
    ctx.ellipse(0, 0, w, r, 0, 0, Math.PI * 2)
    const metal = ctx.createLinearGradient(-w, -r * 0.3, w, r * 0.4)
    for (const [stop, color] of [[0, '#50596b'], [0.12, balloon.color], [0.29, '#f7fcff'], [0.38, '#b6c8dc'], [0.49, balloon.color], [0.63, '#5e6c88'], [0.76, '#f5fbff'], [0.87, balloon.color], [1, '#515e76']] as const) metal.addColorStop(stop, color)
    ctx.fillStyle = metal
    ctx.fill()
    ctx.strokeStyle = '#495065'
    ctx.lineWidth = Math.max(1.3, r * 0.03)
    ctx.stroke()
    ctx.beginPath()
    ctx.ellipse(0, 0, w * 0.95, r * 0.96, 0, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'
    ctx.lineWidth = r * 0.015
    ctx.stroke()
    ctx.strokeStyle = 'rgba(55,65,85,0.35)'
    for (let i = 0; i < 32; i++) {
        const angle = i * Math.PI / 16
        ctx.beginPath()
        ctx.moveTo(Math.cos(angle) * w * 0.98, Math.sin(angle) * r * 0.98)
        ctx.lineTo(Math.cos(angle) * w * 0.89, Math.sin(angle) * r * 0.89)
        ctx.stroke()
    }
    ctx.beginPath()
    ctx.moveTo(0, r * 0.96)
    ctx.lineTo(-r * 0.1, r * 1.12)
    ctx.lineTo(r * 0.1, r * 1.12)
    ctx.closePath()
    ctx.fillStyle = balloon.color
    ctx.fill()
    ctx.strokeStyle = '#495065'
    ctx.stroke()
    ctx.restore()
}
