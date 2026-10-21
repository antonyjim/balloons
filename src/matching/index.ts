import { createCelebration } from '../celebration'
import styles from 'matching-styles'
import { bindActivation } from '../activation'
import { MatchingGame } from './game'

export interface MatchingApp { setActive(active: boolean): void }
export function mountMatching(host: HTMLElement): MatchingApp {
    const root = host.attachShadow({ mode: 'open' })
    const celebration = createCelebration(root)
    root.innerHTML = `<style>${styles}</style>
        <main class="toy-room">
            <header><div class="brand"><span class="brand-icon" aria-hidden="true">ABC</span><div><h1>Little letter shop</h1><p>A place for every little shape.</p></div></div>
                <nav aria-label="Switch activity"><a href="#/puzzle">Puzzles</a><a id="switch-activity" href="#/sketchpad" title="Open the sketchpad">✎ Draw</a><a id="back-to-balloons" href="#/balloons">Balloons ↗</a></nav>
            </header>
            <section class="cabinet" aria-label="Letter and number shelves">
                <div class="cabinet-top"><span aria-hidden="true">✦</span><span>Find my little home</span><span class="progress">0 / 36</span></div>
                <div class="shelves"></div>
            </section>
            <div class="instruction" role="status" aria-live="polite">Press the sunshine button for a surprise!</div>
            <section class="dispenser" aria-label="Letter dispenser">
                <div class="machine-label"><span aria-hidden="true">✦</span> THE LETTER DROP <small>Letters & numbers, coming right up.</small></div>
                <div class="tray" aria-label="Dispensed shape tray"><span>your next little shape</span></div>
                <button class="dispense" type="button"><span aria-hidden="true">☀</span><strong>Next shape</strong></button>
            </section>
            <button class="piece" type="button" hidden aria-label="Drag the shape to its matching shelf"></button>
        </main>`
    const game = new MatchingGame()
    const shelves = root.querySelector<HTMLElement>('.shelves')!
    const piece = root.querySelector<HTMLButtonElement>('.piece')!
    const dispenser = root.querySelector<HTMLButtonElement>('.dispense')!
    const instruction = root.querySelector<HTMLElement>('.instruction')!
    const progress = root.querySelector<HTMLElement>('.progress')!
    const tray = root.querySelector<HTMLElement>('.tray')!
    const colors = ['#e66064', '#367eaf', '#9962c1', '#df8a29', '#348e79', '#e26694']
    let active = true, pointer: number | null = null, offsetX = 0, offsetY = 0
    const home = (): void => {
        if (!active || piece.hidden) return
        const box = tray.getBoundingClientRect()
        piece.style.left = `${box.left + box.width / 2}px`
        piece.style.top = `${box.top + box.height / 2}px`
    }
    let utteranceInFlight: SpeechSynthesisUtterance | null = null
    let touchInteraction = false
    let queuedSpeech: string | null = null
    const speakNow = (symbol: string): void => {
        if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') return
        const synth = window.speechSynthesis
        const utterance = new SpeechSynthesisUtterance(symbol)
        utterance.lang = 'en-US'
        utterance.rate = 1.05
        utterance.pitch = 1.25
        const voices = synth.getVoices?.() ?? []
        const english = voices.filter(voice => /^en(?:-|_)/i.test(voice.lang))
        utterance.voice = english.find(voice => voice.localService) ?? english[0] ?? null
        const done = (): void => { if (utteranceInFlight === utterance) utteranceInFlight = null }
        utterance.onend = done
        utterance.onerror = done
        try {
            // Retain the utterance until completion; avoid canceling an idle Safari
            // speech queue immediately before asking it to start.
            if (synth.speaking || synth.pending) synth.cancel()
            utteranceInFlight = utterance
            synth.resume?.()
            synth.speak(utterance)
        } catch { done() }
    }
    const speak = (symbol: string): void => {
        if (touchInteraction) queuedSpeech = symbol
        else speakNow(symbol)
    }
    root.addEventListener?.('pointerdown', event => { touchInteraction = (event as PointerEvent).pointerType === 'touch' }, true)
    root.addEventListener?.('touchend', () => {
        touchInteraction = false
        if (queuedSpeech !== null && active) {
            const symbol = queuedSpeech
            queuedSpeech = null
            speakNow(symbol)
        } else if ('speechSynthesis' in window) window.speechSynthesis.resume?.()
    }, { capture: true, passive: true })
    root.addEventListener?.('touchcancel', () => { touchInteraction = false; queuedSpeech = null })
    const place = (symbol: string): boolean => {
        if (!game.place(symbol)) return false
        const slot = shelves.querySelector<HTMLButtonElement>(`[data-symbol="${symbol}"]`)!
        slot.classList.add('matched')
        slot.setAttribute('aria-label', `${symbol}, matched`)
        slot.setAttribute('aria-pressed', 'true')
        piece.hidden = true
        dispenser.disabled = false
        progress.textContent = `${game.matched.size} / ${game.symbols.length}`
        instruction.textContent = game.matched.size === game.symbols.length ? 'A shelf full of smiles! Press for a new collection.' : `Lovely! ${symbol} found its home. Ready for another?`
        dispenser.querySelector('strong')!.textContent = game.matched.size === game.symbols.length ? 'New shelves' : 'Next shape'
        if (game.matched.size === game.symbols.length) celebration.play()
        speak(symbol)
        return true
    }
    const drawShelves = (): void => {
        celebration.stop()
        shelves.replaceChildren()
        game.symbols.forEach((symbol, index) => {
            const slot = document.createElement('button')
            slot.type = 'button'
            slot.className = 'slot'
            slot.dataset.symbol = symbol
            slot.textContent = symbol
            slot.style.setProperty('--toy-color', colors[index % colors.length])
            slot.setAttribute('aria-label', `Place ${symbol} here`)
            slot.setAttribute('aria-pressed', 'false')
            // Keyboard/tap alternative to dragging the dispensed piece.
            bindActivation(slot, () => { if (active && game.pending !== null) place(symbol) })
            shelves.append(slot)
        })
        progress.textContent = `0 / ${game.symbols.length}`
    }
    bindActivation(dispenser, () => {
        if (!active || game.pending !== null) return
        const newRound = game.matched.size === game.symbols.length
        const symbol = game.dispense()!
        if (newRound) drawShelves()
        piece.textContent = symbol
        piece.style.setProperty('--toy-color', colors[game.symbols.indexOf(symbol) % colors.length])
        piece.setAttribute('aria-label', `${symbol}. Drag to its matching silhouette, or tap that shelf.`)
        piece.hidden = false
        dispenser.disabled = true
        instruction.textContent = `Can you find the home for ${symbol}?`
        home()
    })
    piece.addEventListener('pointerdown', event => {
        if (!active || game.pending === null || pointer !== null || event.button !== 0) return
        event.preventDefault()
        const box = piece.getBoundingClientRect()
        offsetX = event.clientX - (box.left + box.width / 2)
        offsetY = event.clientY - (box.top + box.height / 2)
        pointer = event.pointerId
        piece.classList.add('dragging')
        piece.setPointerCapture(pointer)
    })
    piece.addEventListener('pointermove', event => {
        if (event.pointerId !== pointer) return
        piece.style.left = `${event.clientX - offsetX}px`
        piece.style.top = `${event.clientY - offsetY}px`
    })
    const cancel = (): void => {
        const previous = pointer
        pointer = null
        piece.classList.remove('dragging')
        if (previous !== null && piece.hasPointerCapture(previous)) piece.releasePointerCapture(previous)
        home()
    }
    piece.addEventListener('pointerup', event => {
        if (event.pointerId !== pointer || game.pending === null) return
        const slot = shelves.querySelector<HTMLElement>(`[data-symbol="${game.pending}"]`)!
        const box = slot.getBoundingClientRect()
        const x = event.clientX - offsetX, y = event.clientY - offsetY
        if (x >= box.left && x <= box.right && y >= box.top && y <= box.bottom) place(game.pending)
        else instruction.textContent = 'Not quite! Try the shape with the same outline.'
        cancel()
    })
    piece.addEventListener('pointercancel', cancel)
    piece.addEventListener('lostpointercapture', cancel)
    window.addEventListener('blur', cancel)
    window.addEventListener('resize', () => { cancel(); home() })
    root.querySelector<HTMLElement>('.toy-room')?.addEventListener('scroll', () => { if (pointer === null) home() })
    for (const link of root.querySelectorAll<HTMLElement>('nav a')) bindActivation(link)
    drawShelves()
    return { setActive(value) {
        cancel()
        active = value
        if (!active) {
            celebration.stop()
            queuedSpeech = null
            touchInteraction = false
            utteranceInFlight = null
            if ('speechSynthesis' in window) window.speechSynthesis.cancel()
        }
        if (active) requestAnimationFrame(home)
    } }
}
