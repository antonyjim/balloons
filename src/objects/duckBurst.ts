import type { Balloon } from './balloonTypes'

export const DUCK_BURST_DURATION = 1.5
export function burstDuck(duck: Balloon): void {
    const colors = [duck.color, '#fff5b0', '#ffffff', '#8edcee', '#f5a8c5']
    duck.duckBurst = Array.from({ length: 38 }, (_, i) => {
        const angle = i * Math.PI * 2 / 38 + Math.random() * 0.2
        const speed = (130 + Math.random() * 280) * Math.min(1.8, Math.max(0.7, duck.radius / 40))
        return { x: duck.x, y: duck.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 170,
            angle, spin: (Math.random() - 0.5) * 16, size: duck.radius * (0.06 + Math.random() * 0.12), color: colors[i % colors.length] }
    })
}
export function updateDuckBurst(duck: Balloon, dt: number, width: number, ground: number): void {
    for (const bit of duck.duckBurst ?? []) {
        bit.vy += 650 * dt
        bit.vx *= Math.exp(-dt)
        bit.x += bit.vx * dt
        bit.y += bit.vy * dt
        bit.angle += bit.spin * dt
        if (bit.y > ground - bit.size && bit.vy > 0) { bit.y = ground - bit.size; bit.vy *= -0.3 }
    }
}
export function drawDuckBurst(ctx: CanvasRenderingContext2D, duck: Balloon): void {
    const fade = Math.max(0, Math.min(1, (DUCK_BURST_DURATION - duck.popTime) / 0.5))
    ctx.save()
    if (duck.popTime < 0.45) {
        ctx.beginPath()
        ctx.arc(duck.x, duck.y, duck.radius * (0.8 + duck.popTime * 5), 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(255,240,170,${1 - duck.popTime / 0.45})`
        ctx.lineWidth = Math.max(2, duck.radius * 0.12 * (1 - duck.popTime / 0.45))
        ctx.stroke()
    }
    ctx.globalAlpha = fade
    for (let i = 0; i < (duck.duckBurst?.length ?? 0); i++) {
        const bit = duck.duckBurst![i]
        ctx.save()
        ctx.translate(bit.x, bit.y)
        ctx.rotate(bit.angle)
        ctx.beginPath()
        if (i % 3 === 0) {
            for (let k = 0; k < 10; k++) {
                const angle = k * Math.PI / 5, radius = bit.size * (k % 2 ? 0.42 : 1)
                if (k === 0) ctx.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius)
                else ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius)
            }
            ctx.closePath()
        } else ctx.ellipse(0, 0, bit.size * 0.4, bit.size, 0, 0, Math.PI * 2)
        ctx.fillStyle = bit.color
        ctx.fill()
        ctx.restore()
    }
    ctx.restore()
}
