import type { Balloon } from './balloonTypes'

/** Inflated Mylar: colored metal, curved reflections and a heat-welded rim. */
export function drawFoilBalloon(ctx: CanvasRenderingContext2D, balloon: Balloon): void {
    const r = balloon.radius, w = r
    ctx.save()
    ctx.translate(balloon.x, balloon.y)
    ctx.rotate(balloon.angle)
    const body = (): void => {
        ctx.beginPath()
        ctx.arc(0, 0, r, 0, Math.PI * 2)
        ctx.closePath()
    }
    // An opaque colored foundation keeps foil distinct from translucent latex.
    body()
    ctx.fillStyle = balloon.color
    ctx.fill()
    ctx.save()
    ctx.clip()
    const volume = ctx.createRadialGradient(-w * .32, -r * .38, r * .04, 0, 0, r * 1.1)
    volume.addColorStop(0, 'rgba(255,255,255,.58)')
    volume.addColorStop(.35, 'rgba(255,255,255,.08)')
    volume.addColorStop(.67, 'rgba(21,19,48,.12)')
    volume.addColorStop(.86, 'rgba(18,20,42,.55)')
    volume.addColorStop(.95, 'rgba(255,255,255,.66)')
    volume.addColorStop(1, 'rgba(17,22,42,.7)')
    ctx.fillStyle = volume
    ctx.fillRect(-w, -r, w * 2, r * 2)

    // A broad, dark reflected horizon gives the lower face its mirror finish.
    const horizon = ctx.createLinearGradient(0, -r * .25, 0, r)
    horizon.addColorStop(0, 'rgba(25,17,45,0)')
    horizon.addColorStop(.28, 'rgba(30,17,48,.08)')
    horizon.addColorStop(.48, 'rgba(22,15,40,.5)')
    horizon.addColorStop(.58, 'rgba(30,22,45,.34)')
    horizon.addColorStop(.7, 'rgba(255,239,220,.26)')
    horizon.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = horizon
    ctx.fillRect(-w, -r, w * 2, r * 2)

    // Two curved softbox reflections follow the rounded shoulders.
    const softbox = ctx.createLinearGradient(-w * .8, 0, -w * .1, r * .3)
    softbox.addColorStop(0, 'rgba(255,255,255,.12)')
    softbox.addColorStop(.4, 'rgba(255,255,255,.92)')
    softbox.addColorStop(.74, 'rgba(255,255,255,.45)')
    softbox.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = softbox
    ctx.beginPath()
    ctx.moveTo(-w * .72, -r * .46)
    ctx.bezierCurveTo(-w * .6, -r * .76, -w * .24, -r * .85, w * .02, -r * .71)
    ctx.bezierCurveTo(-w * .25, -r * .69, -w * .51, -r * .46, -w * .53, -r * .12)
    ctx.bezierCurveTo(-w * .66, -r * .1, -w * .77, -r * .23, -w * .72, -r * .46)
    ctx.fill()
    const edgeLight = ctx.createLinearGradient(w * .55, 0, w, 0)
    edgeLight.addColorStop(0, 'rgba(255,255,255,0)')
    edgeLight.addColorStop(.65, 'rgba(255,255,255,.62)')
    edgeLight.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = edgeLight
    ctx.beginPath()
    ctx.ellipse(w * .69, r * .05, w * .1, r * .49, .14, 0, Math.PI * 2)
    ctx.fill()

    // Small irregular compression wrinkles cluster at the welded perimeter.
    // Narrow tapered facets avoid a drawn-on radial spoke pattern.
    for (let i = 0; i < 38; i++) {
        const a = i * Math.PI * 2 / 38 + .025 * Math.sin(i * 5.3)
        const depth = .025 + .065 * (.5 + .5 * Math.sin(i * 7.31))
        const bend = .025 * Math.sin(i * 3.7)
        ctx.beginPath()
        ctx.moveTo(Math.cos(a - .009) * w * .98, Math.sin(a - .009) * r * .98)
        ctx.quadraticCurveTo(Math.cos(a + bend) * w * .95, Math.sin(a + bend) * r * .95, Math.cos(a + bend) * w * (1 - depth), Math.sin(a + bend) * r * (1 - depth))
        ctx.lineTo(Math.cos(a + .009) * w * .98, Math.sin(a + .009) * r * .98)
        ctx.fillStyle = i % 3 ? 'rgba(255,255,255,.28)' : 'rgba(24,18,42,.26)'
        ctx.fill()
    }
    // Softbox glint, with a smaller crisp highlight at its leading edge.
    ctx.save()
    ctx.translate(-w * .32, -r * .48)
    ctx.rotate(-.45)
    const glint = ctx.createRadialGradient(0, 0, 0, 0, 0, r * .3)
    glint.addColorStop(0, 'rgba(255,255,255,.95)')
    glint.addColorStop(.3, 'rgba(255,255,255,.5)')
    glint.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.scale(.45, 1)
    ctx.fillStyle = glint
    ctx.fillRect(-r * .3, -r * .3, r * .6, r * .6)
    ctx.restore()
    ctx.restore()

    body()
    ctx.strokeStyle = 'rgba(24,27,47,.8)'
    ctx.lineWidth = Math.max(.7, r * .018)
    ctx.stroke()
    ctx.save()
    ctx.scale(.974, .977)
    body()
    ctx.strokeStyle = 'rgba(245,249,255,.8)'
    ctx.lineWidth = r * .012
    ctx.stroke()
    ctx.restore()
    // A flat sealed valve replaces the tied latex-style knot.
    ctx.beginPath()
    ctx.moveTo(-r * .055, r * .975)
    ctx.lineTo(-r * .075, r * 1.12)
    ctx.lineTo(r * .075, r * 1.12)
    ctx.lineTo(r * .055, r * .975)
    ctx.closePath()
    const valve = ctx.createLinearGradient(-r * .075, 0, r * .075, 0)
    valve.addColorStop(0, balloon.color)
    valve.addColorStop(.45, '#f5f3ff')
    valve.addColorStop(.65, balloon.color)
    valve.addColorStop(1, '#444157')
    ctx.fillStyle = valve
    ctx.fill()
    ctx.strokeStyle = 'rgba(24,27,47,.6)'
    ctx.lineWidth = r * .012
    ctx.stroke()
    ctx.restore()
}
