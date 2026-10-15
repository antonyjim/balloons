export class BackgroundRenderer {
    private layers: HTMLDivElement[] = []
    private activeIndex = 0
    private currentUrl = ''
    private requestId = 0

    constructor(
        parent: HTMLElement =
            document.getElementById('background')!
    ) {
        for (let i = 0; i < 2; i++) {
            const layer = document.createElement('div')

            Object.assign(layer.style, {
                position: 'absolute',
                inset: '0',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
                opacity: i === 0 ? '1' : '0',
                transition: 'opacity 2.5s ease',
                pointerEvents: 'none'
            })

            parent.appendChild(layer)
            this.layers.push(layer)
        }
    }

    async setBackground(url: string): Promise<void> {
        if (url === this.currentUrl) return

        const requestId = ++this.requestId
        const img = new Image()
        img.src = url

        try {
            await img.decode()
        } catch {
            return
        }

        // Prevent an older image load overriding a newer request
        if (requestId !== this.requestId) return

        const nextIndex = 1 - this.activeIndex
        const next = this.layers[nextIndex]
        const current = this.layers[this.activeIndex]

        next.style.backgroundImage = `url("${url}")`
        next.style.opacity = '1'
        current.style.opacity = '0'

        // Place incoming layer above outgoing layer
        next.style.zIndex = '1'
        current.style.zIndex = '0'

        this.activeIndex = nextIndex
        this.currentUrl = url
    }

    dispose(): void {
        for (const layer of this.layers) {
            layer.remove()
        }
        this.layers = []
    }
}