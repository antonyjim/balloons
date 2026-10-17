export interface SpriteRegion {
    canvas: HTMLCanvasElement
    x: number
    y: number
    width: number
    height: number
}

/** Pack immutable sprites into shared textures. Live regions are never overwritten. */
export class SpriteAtlas {
    private page: HTMLCanvasElement | null = null
    private x = 0
    private y = 0
    private rowHeight = 0

    constructor(private readonly pageSize = 1024) {}

    allocate(width: number, height: number): SpriteRegion {
        if (width > this.pageSize || height > this.pageSize || width <= 0 || height <= 0) {
            throw new Error('Sprite dimensions exceed atlas page size')
        }
        if (this.x + width > this.pageSize) {
            this.x = 0
            this.y += this.rowHeight
            this.rowHeight = 0
        }
        if (!this.page || this.y + height > this.pageSize) {
            this.page = document.createElement('canvas')
            this.page.width = this.pageSize
            this.page.height = this.pageSize
            this.x = 0
            this.y = 0
            this.rowHeight = 0
        }
        const region = { canvas: this.page, x: this.x, y: this.y, width, height }
        this.x += width
        this.rowHeight = Math.max(this.rowHeight, height)
        return region
    }
}
