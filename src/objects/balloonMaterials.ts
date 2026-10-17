type Material = 'latex' | 'fabric'
interface Surface {
    image: HTMLImageElement | null
    revision: number
    pending: Promise<void> | null
}
const surfaces: Record<Material, Surface> = {
    latex: { image: null, revision: 0, pending: null },
    fabric: { image: null, revision: 0, pending: null }
}
export function materialRevision(material: Material): number { return surfaces[material].revision }
function load(material: Material): Promise<void> {
    const surface = surfaces[material]
    if (surface.pending) return surface.pending
    const image = new Image()
    image.src = `/textures/${material}-surface.png`
    surface.pending = image.decode().then(() => {
        surface.image = image
        surface.revision++
    }).catch(error => { surface.pending = null; throw error })
    return surface.pending
}
export async function preloadBalloonMaterials(): Promise<void> {
    const results = await Promise.allSettled([load('latex'), load('fabric')])
    for (const result of results) if (result.status === 'rejected') console.warn('Balloon material failed:', result.reason)
}

/** Composite into the cached sprite only; the caller supplies the silhouette clip. */
export function drawBalloonMaterial(ctx: CanvasRenderingContext2D, material: Material, r: number): void {
    const image = surfaces[material].image
    if (!image) return
    ctx.save()
    ctx.globalCompositeOperation = material === 'fabric' ? 'multiply' : 'soft-light'
    ctx.globalAlpha = material === 'fabric' ? 0.32 : 0.3
    ctx.drawImage(image, -r, -r, r * 2, r * (material === 'fabric' ? 2.2 : 2))
    ctx.restore()
}
