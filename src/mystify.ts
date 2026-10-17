/** A small bouncing polygon trail, redrawn only while the idle overlay is visible. */
export function createMystify(): { show(): void; hide(): void; visible(): boolean } {
    const canvas = document.createElement('canvas')
    canvas.className = 'mystify-screen'
    canvas.hidden = true
    canvas.setAttribute('aria-label', 'Idle screensaver. Press or tap to dismiss.')
    canvas.setAttribute('role', 'button')
    canvas.tabIndex = 0
    document.body.append(canvas)
    const ctx = canvas.getContext('2d')!
    let active = false, frame = 0, last = 0, hue = 0
    let width = 0, height = 0
    const points = Array.from({ length: 8 }, () => ({ x: Math.random(), y: Math.random(), vx: 0.04 + Math.random() * 0.08, vy: 0.04 + Math.random() * 0.08 }))
    const hide = (): void => { active = false; canvas.hidden = true; cancelAnimationFrame(frame) }
    canvas.addEventListener('pointerdown', event => { event.preventDefault(); event.stopImmediatePropagation(); hide() })
    canvas.addEventListener('keydown', event => { event.preventDefault(); hide() })
    const draw = (time: number): void => {
        if (!active) return
        const dt = Math.min(0.05, (time - last) / 1000 || 0.016)
        last = time
        if (width !== innerWidth || height !== innerHeight) {
            width = innerWidth; height = innerHeight
            canvas.width = width; canvas.height = height
            ctx.fillStyle = '#080911'; ctx.fillRect(0, 0, width, height)
        }
        ctx.fillStyle = 'rgba(8,9,17,0.065)'
        ctx.fillRect(0, 0, width, height)
        for (const point of points) {
            point.x += point.vx * dt; point.y += point.vy * dt
            if (point.x < 0 || point.x > 1) { point.vx *= -1; point.x = Math.max(0, Math.min(1, point.x)) }
            if (point.y < 0 || point.y > 1) { point.vy *= -1; point.y = Math.max(0, Math.min(1, point.y)) }
        }
        hue += dt * 24
        for (let polygon = 0; polygon < 2; polygon++) {
            ctx.beginPath()
            for (let i = 0; i < 4; i++) {
                const point = points[polygon * 4 + i]
                if (i === 0) ctx.moveTo(point.x * width, point.y * height)
                else ctx.lineTo(point.x * width, point.y * height)
            }
            ctx.closePath()
            ctx.strokeStyle = `hsl(${hue + polygon * 120} 85% 65%)`
            ctx.lineWidth = 1.5
            ctx.stroke()
        }
        frame = requestAnimationFrame(draw)
    }
    return { show() { if (active) return; active = true; canvas.hidden = false; last = 0; canvas.focus(); frame = requestAnimationFrame(draw) }, hide, visible: () => active }
}
