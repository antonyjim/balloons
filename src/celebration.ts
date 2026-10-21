/** A brief, non-interactive celebration shared by the learning activities. */
export function createCelebration(root: ShadowRoot): { play(): void; stop(): void } {
    let overlay: HTMLDivElement | null = null
    let timeout: ReturnType<typeof setTimeout> | undefined
    const stop = (): void => { clearTimeout(timeout); overlay?.remove(); overlay = null }
    return {
        stop,
        play() {
            stop()
            overlay = document.createElement('div')
            overlay.setAttribute('aria-hidden', 'true')
            overlay.style.cssText = 'position:fixed;inset:0;z-index:1000;pointer-events:none;overflow:hidden'
            root.append(overlay)
            const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
            const colors = ['#ffcb47', '#ff718e', '#63d6ff', '#a193ff', '#70e0ab']
            for (let burst = 0; burst < 5; burst++) {
                const x = 15 + burst * 17.5, y = 20 + Math.random() * 35
                for (let ray = 0; ray < (reduced ? 5 : 22); ray++) {
                    const spark = document.createElement('span')
                    const angle = ray * Math.PI * 2 / (reduced ? 5 : 22)
                    const radius = 65 + Math.random() * 75
                    spark.style.cssText = `position:absolute;left:${x}%;top:${y}%;width:8px;height:8px;border-radius:50%;background:${colors[(ray + burst) % colors.length]};box-shadow:0 0 8px currentColor;color:${colors[(ray + burst) % colors.length]}`
                    overlay.append(spark)
                    spark.animate?.(reduced ? [{ opacity: 0 }, { opacity: 1 }, { opacity: 0 }] : [
                        { transform: 'translate(0,0) scale(.3)', opacity: 0 },
                        { opacity: 1, offset: .15 },
                        { transform: `translate(${Math.cos(angle) * radius}px,${Math.sin(angle) * radius + 45}px) scale(.1)`, opacity: 0 }
                    ], { duration: reduced ? 1200 : 1500, delay: burst * 220, fill: 'both', easing: 'ease-out' })
                }
            }
            timeout = setTimeout(stop, 2600)
        }
    }
}
