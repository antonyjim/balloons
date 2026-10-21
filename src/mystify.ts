/** Three slowly changing light patterns; animation runs only while the overlay is visible. */
export function createMystify(): { show(): void; hide(): void; visible(): boolean } {
    const canvas = document.createElement('canvas')
    canvas.className = 'mystify-screen'
    canvas.hidden = true
    canvas.setAttribute('aria-label', 'Screensaver. Tap or press a key to return.')
    canvas.setAttribute('role', 'button'); canvas.tabIndex = 0
    document.body.append(canvas)
    const ctx = canvas.getContext('2d')!
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    let active = false, frame = 0, last = 0, elapsed = 0, hue = Math.random() * 360
    let width = 0, height = 0, previousFocus: HTMLElement | null = null
    const points = Array.from({ length: 12 }, () => ({ x: Math.random(), y: Math.random(), vx: (Math.random() < .5 ? -1 : 1) * (.04 + Math.random() * .08), vy: (Math.random() < .5 ? -1 : 1) * (.04 + Math.random() * .08) }))
    const stars = Array.from({ length: 50 }, () => ({ x: Math.random(), y: Math.random(), phase: Math.random() * Math.PI * 2 }))
    const hide = (): void => {
        if (!active) return
        active = false; canvas.hidden = true; cancelAnimationFrame(frame)
        previousFocus?.focus({ preventScroll: true })
    }
    canvas.addEventListener('pointerdown', event => { event.preventDefault(); event.stopImmediatePropagation(); hide() })
    canvas.addEventListener('keydown', event => { event.preventDefault(); event.stopImmediatePropagation(); hide() })
    const draw = (time: number): void => {
        if (!active || document.hidden) return
        const dt = (last ? Math.min(.05, Math.max(0, (time - last) / 1000)) : .016) * (reducedMotion ? .25 : 1)
        last = time; elapsed += dt; hue = (hue + dt * 12) % 360
        if (width !== innerWidth || height !== innerHeight) {
            width = innerWidth; height = innerHeight
            canvas.width = width; canvas.height = height
            ctx.fillStyle = '#080911'; ctx.fillRect(0, 0, width, height)
        }
        ctx.fillStyle = 'rgba(8,9,17,0.075)'; ctx.fillRect(0, 0, width, height)
        for (const star of stars) {
            ctx.fillStyle = `rgba(200,220,255,${.12 + .2 * (.5 + .5 * Math.sin(elapsed * .5 + star.phase))})`
            ctx.beginPath(); ctx.arc(star.x * width, star.y * height, 1, 0, Math.PI * 2); ctx.fill()
        }
        const mode = Math.floor(elapsed / 25) % 3
        ctx.lineWidth = 1.5; ctx.shadowBlur = reducedMotion ? 0 : 8
        for (let layer = 0; layer < 3; layer++) {
            ctx.strokeStyle = `hsl(${hue + layer * 110} 85% 68%)`; ctx.shadowColor = ctx.strokeStyle
            ctx.beginPath()
            if (mode === 0) {
                for (let i = 0; i < 4; i++) {
                    const point = points[layer * 4 + i]
                    point.x += point.vx * dt; point.y += point.vy * dt
                    if (point.x < .03 || point.x > .97) { point.vx *= -1; point.x = Math.max(.03, Math.min(.97, point.x)) }
                    if (point.y < .03 || point.y > .97) { point.vy *= -1; point.y = Math.max(.03, Math.min(.97, point.y)) }
                    if (i === 0) ctx.moveTo(point.x * width, point.y * height)
                    else ctx.lineTo(point.x * width, point.y * height)
                }
                ctx.closePath()
            } else {
                const radius = Math.min(width, height) * .33, phase = elapsed * .18 + layer * Math.PI * 2 / 3
                for (let i = 0; i <= 180; i++) {
                    const a = i / 180 * Math.PI * 2
                    const x = mode === 1 ? Math.sin(3 * a + phase) * (.8 + .1 * Math.sin(phase)) : Math.cos(a + phase) * (.65 + .3 * Math.cos(5 * a - phase))
                    const y = mode === 1 ? Math.sin(2 * a - phase) * .9 : Math.sin(a + phase) * (.65 + .3 * Math.cos(5 * a - phase))
                    if (i === 0) ctx.moveTo(width / 2 + x * radius, height / 2 + y * radius)
                    else ctx.lineTo(width / 2 + x * radius, height / 2 + y * radius)
                }
            }
            ctx.stroke()
        }
        ctx.shadowBlur = 0
        frame = requestAnimationFrame(draw)
    }
    document.addEventListener('visibilitychange', () => {
        if (!active) return
        cancelAnimationFrame(frame); last = 0
        if (!document.hidden) frame = requestAnimationFrame(draw)
    })
    window.addEventListener('resize', () => { if (active) width = 0 })
    return {
        show() {
            if (active) return
            active = true; previousFocus = document.activeElement as HTMLElement | null
            canvas.hidden = false; last = 0; elapsed = 0; width = 0
            canvas.focus(); frame = requestAnimationFrame(draw)
        }, hide, visible: () => active
    }
}
