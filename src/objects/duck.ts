import type { Balloon } from './balloonTypes'

const duckColors = ['#ffd44f', '#f582ae', '#76c7ed', '#a695e5', '#81c99a', '#f5a465'] as const
export function randomDuckAppearance(random = Math.random): { color: string, duckVariant: 'duck' | 'goose' } {
    const goose = random() < 0.08
    return { color: goose ? '#f5f1e5' : duckColors[Math.min(duckColors.length - 1, Math.floor(random() * duckColors.length))], duckVariant: goose ? 'goose' : 'duck' }
}

export function drawDuck(ctx: CanvasRenderingContext2D, duck: Balloon): void {
    if (duck.duckVariant === 'goose') { drawGoose(ctx, duck); return }
    const r = duck.radius
    ctx.save()
    ctx.translate(duck.x, duck.y)
    ctx.rotate(duck.angle)
    ctx.lineJoin = 'round'
    ctx.lineWidth = Math.max(1.3, r * 0.03)
    ctx.strokeStyle = 'rgba(40,28,38,0.8)'
    ctx.beginPath()
    ctx.moveTo(-r * 0.8, -r * 0.1)
    ctx.quadraticCurveTo(-r * 1.16, -r * 0.55, -r * 0.98, r * 0.12)
    ctx.bezierCurveTo(-r, r * 0.95, r * 0.9, r * 0.95, r * 0.85, r * 0.12)
    ctx.quadraticCurveTo(r * 0.8, -r * 0.1, r * 0.65, -r * 0.14)
    ctx.bezierCurveTo(r * 1.1, -r * 1.1, -r * 0.23, -r * 1.22, -r * 0.16, -r * 0.32)
    ctx.quadraticCurveTo(-r * 0.35, -r * 0.02, -r * 0.8, -r * 0.1)
    ctx.closePath()
    ctx.fillStyle = duck.color
    ctx.fill()
    ctx.stroke()
    ctx.beginPath()
    ctx.ellipse(-r * 0.18, r * 0.25, r * 0.45, r * 0.23, -0.15, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(40,28,38,0.13)'
    ctx.fill()
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(r * 0.67, -r * 0.57)
    ctx.quadraticCurveTo(r * 1.2, -r * 0.53, r * 1.03, -r * 0.32)
    ctx.lineTo(r * 0.64, -r * 0.3)
    ctx.closePath()
    ctx.fillStyle = '#f18b35'
    ctx.fill()
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(r * 0.48, -r * 0.68, r * 0.065, 0, Math.PI * 2)
    ctx.fillStyle = '#352d38'
    ctx.fill()
    ctx.restore()
}

function drawGoose(ctx: CanvasRenderingContext2D, goose: Balloon): void {
    const r = goose.radius
    ctx.save()
    ctx.translate(goose.x, goose.y)
    ctx.rotate(goose.angle)
    ctx.lineJoin = 'round'
    ctx.lineWidth = Math.max(1.3, r * 0.03)
    ctx.strokeStyle = 'rgba(40,28,38,0.8)'
    ctx.beginPath()
    ctx.moveTo(-r * 0.85, r * 0.05)
    ctx.lineTo(-r * 1.04, -r * 0.2)
    ctx.bezierCurveTo(-r * 1.08, r, r * 0.7, r * 0.92, r * 0.75, r * 0.15)
    ctx.bezierCurveTo(r * 0.76, -r * 0.2, r * 0.38, -r * 0.35, r * 0.48, -r * 0.71)
    ctx.bezierCurveTo(r * 1.13, -r * 0.69, r * 0.89, -r * 1.21, r * 0.45, -r * 1.08)
    ctx.bezierCurveTo(-r * 0.1, -r * 0.97, r * 0.02, -r * 0.23, r * 0.18, r * 0.04)
    ctx.quadraticCurveTo(-r * 0.35, -r * 0.14, -r * 0.85, r * 0.05)
    ctx.closePath()
    ctx.fillStyle = goose.color
    ctx.fill()
    ctx.stroke()
    ctx.beginPath()
    ctx.ellipse(-r * 0.24, r * 0.28, r * 0.46, r * 0.21, -0.16, 0, Math.PI * 2)
    ctx.fillStyle = '#dad9d2'
    ctx.fill()
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(r * 0.84, -r * 0.98)
    ctx.lineTo(r * 1.14, -r * 0.83)
    ctx.lineTo(r * 0.81, -r * 0.77)
    ctx.closePath()
    ctx.fillStyle = '#ed8d38'
    ctx.fill()
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(r * 0.65, -r * 0.95, r * 0.045, 0, Math.PI * 2)
    ctx.fillStyle = '#352d38'
    ctx.fill()
    ctx.restore()
}
