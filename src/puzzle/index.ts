import { exportPuzzles, importPuzzles, MAX_PUZZLE_FILE_BYTES } from './transfer'
import { restorable, type PuzzleProgress } from './progress'
import { createPuzzleCamera } from './camera'
import { piecePath, shuffledPieces } from './game'

import { bindActivation } from '../activation'
import { exitAppFullscreen } from '../hiddenExit'
import { loadCollection, saveCollection, createPictureId, type SavedPicture } from './storage'
import { cropRect, adjustCrop, type CropRect, type CropHandle } from './crop'

type Picture = SavedPicture & { image: string }
export function mountPuzzle(host: HTMLElement, audit: (kind: 'activity' | 'solve', detail: string, solved?: boolean, id?: string) => void = () => {}, showScreensaver: () => void = () => {}): { setActive(value: boolean): void } {
    const root = host.attachShadow({ mode: 'open' })
    const accent = `hsl(${Math.floor(Math.random() * 360)} 48% 34%)`
    root.innerHTML = `<style>
    :host{--accent:${accent};font:16px system-ui;color:#344559}*{box-sizing:border-box}[hidden]{display:none!important}
    main{height:100dvh;overflow:auto;background:#f8f3e9;padding:clamp(14px,3vw,36px)}header{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;max-width:1100px;margin:auto}h1{font-size:clamp(24px,4vw,36px);margin:0;touch-action:none;user-select:none}p{margin:8px 0 18px;color:#657182}nav,.controls,.actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap}button,a,select,.upload{font:inherit;border:1px solid #c7d1cb;border-radius:12px;background:white;color:inherit;padding:10px 16px;cursor:pointer;text-decoration:none}button:focus-visible,a:focus-visible,select:focus-visible,.upload:focus-within,h1:focus-visible{outline:3px solid var(--accent);outline-offset:3px}button:disabled{opacity:.5;cursor:default}.upload input{position:absolute;width:1px;height:1px;opacity:0}.controls{max-width:1100px;margin:24px auto}select{max-width:100%}.gallery{display:flex;gap:12px;flex-wrap:wrap;margin:18px 0}.picture{width:120px;padding:6px;text-align:left}.picture img{width:106px;height:80px;object-fit:cover;border-radius:8px}.picture span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.picture[aria-pressed=true]{outline:3px solid var(--accent)}.workspace{max-width:1100px;margin:24px auto;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:30px}.board-wrap{position:relative;align-self:start;border:8px solid white;border-radius:12px;overflow:hidden;background:#e2e8df;box-shadow:0 8px 30px #34455918}.board{position:relative;display:grid;aspect-ratio:1}.reference{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:grayscale(1);opacity:.28;pointer-events:none}.slot{position:relative;border:0;border-radius:0;padding:0;background:transparent;aspect-ratio:1;min-width:0}.slot svg{position:absolute;left:-30%;top:-30%;width:160%;height:160%;overflow:visible;pointer-events:none}.slot.filled{border-color:transparent;z-index:1}.tray{display:grid;gap:8px;align-content:start}.piece{padding:0;border:0;background:transparent;aspect-ratio:1;min-width:0;touch-action:none}.piece svg{width:100%;height:100%;overflow:visible;filter:drop-shadow(0 3px 2px #243b5070);pointer-events:none}.piece[aria-pressed=true]{outline:3px solid var(--accent)}.ghost{position:fixed;z-index:100;pointer-events:none;opacity:.9}.message{max-width:1100px;margin:18px auto;min-height:24px}dialog{border:0;border-radius:20px;color:inherit;background:#f8f3e9;width:min(740px,94vw);max-height:90dvh;padding:24px;overflow:auto}dialog::backdrop{background:#182a3b88}dialog header{margin-bottom:20px}h2{margin:0;font-size:24px}.settings{display:flex;flex-wrap:wrap;gap:18px;margin:20px 0}.settings label{display:flex;align-items:center;gap:8px}.crop-stage{position:relative;width:min(100%,520px);margin:24px auto;user-select:none;touch-action:none}.crop-canvas{display:block;width:100%;height:auto}.crop-selection{position:absolute;border:2px solid white;outline:1px solid #253e50;box-shadow:0 0 0 100vmax #17263488;cursor:move;touch-action:none}.crop-stage{overflow:hidden}.crop-selection:focus-visible{outline:3px solid var(--accent)}.crop-handle{position:absolute;width:28px;height:28px;padding:0;border:0;border-radius:0;background:transparent;transform:translate(-50%,-50%);touch-action:none}.crop-handle::after{content:"";display:block;position:absolute;inset:8px;background:white;border:2px solid #253e50}.crop-handle[data-handle=nw],.crop-handle[data-handle=se]{cursor:nwse-resize}.crop-handle[data-handle=ne],.crop-handle[data-handle=sw]{cursor:nesw-resize}.crop-handle[data-handle=n],.crop-handle[data-handle=s]{cursor:ns-resize}.crop-handle[data-handle=e],.crop-handle[data-handle=w]{cursor:ew-resize}.menu-status{min-height:24px}small{display:block;margin:16px 0;color:#657182}@media(max-width:650px){.workspace{gap:16px;grid-template-columns:1fr}.tray{gap:12px}nav{gap:6px}nav a,nav button{padding:8px}.picture{width:95px}.picture img{width:81px;height:60px}}
    .puzzle-layout{display:grid;grid-template-columns:170px minmax(0,1fr);gap:24px;max-width:1300px;margin:24px auto}.puzzle-pane{position:sticky;top:0;align-self:start;max-height:80dvh;overflow:auto;padding:12px;background:color-mix(in srgb,var(--accent) 12%,#f8f3e9);border-radius:14px}.puzzle-list{display:grid;gap:12px;margin-top:18px}.puzzle-list .picture{width:100%}.puzzle-list .picture img{width:100%;height:auto;aspect-ratio:4/3;object-fit:cover}.puzzle-list .picture span{white-space:normal;overflow-wrap:anywhere}.puzzle-content{min-width:0}.puzzle-content .controls{margin:0 auto}.puzzle-content .workspace{gap:18px}@media(max-width:650px){.puzzle-layout{grid-template-columns:100px minmax(0,1fr);gap:12px}.puzzle-pane{padding:8px}.puzzle-pane h2{font-size:18px}}
    h1,.puzzle-pane h2{color:var(--accent)}
    </style><main><header><h1 id="puzzle-title" tabindex="0" title="Hold 2.5 seconds for puzzle menu; Alt+Enter with keyboard">Picture puzzles</h1><nav aria-label="Switch activity"><a href="#/sketchpad">Drawing</a><a href="#/matching">Letters</a><button id="puzzle-return" type="button">Return to bubbles</button></nav></header>
    <div class="puzzle-layout"><aside class="puzzle-pane" aria-label="Choose a puzzle"><h2>Puzzles</h2><div class="puzzle-list"></div></aside><div class="puzzle-content"><div class="controls"><button id="restart" disabled>Reset</button><button id="screensaver" type="button">Screensaver</button></div>
    <div class="message" role="status" aria-live="polite">Loading puzzles...</div><section class="workspace" hidden><div class="board-wrap"><img class="reference" alt="" hidden><div class="board" aria-label="Puzzle board"></div></div><div class="tray" aria-label="Puzzle pieces"></div></section></div></div></main>
    <dialog id="menu" aria-labelledby="menu-title"><header><h2 id="menu-title">Puzzle menu</h2><button id="close-menu">Done</button></header>
    <div class="settings"><label>Pieces <select id="size"><option value="random">Random (3, 4 or 5)</option><option value="3">3 x 3</option><option value="4">4 x 4</option><option value="5">5 x 5</option></select></label><label><input id="preview" type="checkbox"> Show picture underneath</label></div>
    <label>Puzzle name <input id="puzzle-name" maxlength="200"></label><h3>Saved pictures</h3><div class="gallery" aria-label="Saved pictures"></div><div class="actions"><label class="upload">Add image<input id="photos" type="file" accept="image/*"></label><button id="edit">Edit crop</button><button id="remove">Delete selected image</button></div>
    <div class="menu-status" role="status" aria-live="polite"></div><p><a id="puzzle-download" hidden>Download puzzle file</a></p><div class="actions"><button id="export-puzzle">Export selected puzzle</button><button id="save">Export all puzzles</button><label class="upload">Import puzzles<input id="load" type="file" accept=".dat,.txt,.json,application/octet-stream,text/plain,application/json"></label><button id="exit-fullscreen">Exit fullscreen</button></div><small>Images stay on this device in browser storage. Save a collection to keep a backup.</small></dialog>
    <dialog id="crop-dialog" aria-labelledby="crop-title"><header><h2 id="crop-title">Crop image</h2></header><label>Picture name <input id="picture-name" maxlength="200" required></label><p>Drag the corner or edge handles to crop. Drag inside the square to move it.</p><div class="crop-stage"><canvas id="crop-canvas" class="crop-canvas" width="800" height="800" aria-label="Original image"></canvas><div id="crop-selection" class="crop-selection" tabindex="0" aria-label="Crop area. Use arrow keys to move."></div></div><div class="actions"><button id="crop-save">Save image</button><button id="crop-cancel">Cancel</button></div><p id="crop-status" role="status"></p></dialog>`
    const get = <T extends HTMLElement>(selector: string): T => root.querySelector<T>(selector)!
    const gallery = get('.gallery'), board = get('.board'), tray = get('.tray'), message = get('.message')
    const sizeSelect = get<HTMLSelectElement>('#size'), reference = get<HTMLImageElement>('.reference')
    const puzzleList = get('.puzzle-list'), menu = get<HTMLDialogElement>('#menu')
    const menuStatus = get('.menu-status'), preview = get<HTMLInputElement>('#preview')
    let pictures: Picture[] = [], current = 0, size = 3, active = true, selected: number | null = null
    let placed = new Set<number>(), loaded = false
    let cameraMode = false, cameraFrame = '', cameraPreview = ''
    let progress: Record<string, PuzzleProgress> = {}, order: number[] = [], roundId = '', roundKey = '', savedAt = 0, randomSize = false
    const progressKey = (): string => `${cameraMode ? 'camera' : pictures[current]?.id ?? ''}:${size}`
    const checkpoint = (): void => {
        if (!roundKey || !roundId) return
        progress[roundKey] = { placed: [...placed], order: [...order], savedAt, solved: placed.size === size * size, activityId: roundId }
    }

    const puzzleLabel = (): string => `${cameraMode ? 'Live camera' : pictures[current]?.name ?? 'Puzzle'} (${size} x ${size})`
    const camera = createPuzzleCamera(frame => {
        if (!cameraMode || !active) return
        const first = !cameraFrame; cameraFrame = frame
        if (first) {
            if (!cameraPreview) cameraPreview = frame
            drawGallery(); start(); save()
        }
        for (const image of root.querySelectorAll<SVGImageElement>('.camera-frame')) image.setAttribute('href', frame)
    }, error => {
        stopCamera(); drawGallery(); start(); message.textContent = error
    })
    const stopCamera = (): void => { camera.stop(); cameraMode = false; cameraFrame = '' }

    const drags = new Map<number, { id: number; piece: HTMLButtonElement; ghost: HTMLElement; x: number; y: number }>()
    let saveQueue = Promise.resolve()
    const persist = (): Promise<void> => {
        const collection = { pictures: pictures.map(({ image, ...p }) => p), size, preview: preview.checked, current: pictures[current]?.id, progress: structuredClone(progress), cameraPreview, randomSize }
        const work = saveQueue.then(() => saveCollection(collection))
        saveQueue = work.catch(() => { menuStatus.textContent = 'Could not save on this device. Save a text collection as a backup, then try again.' })
        return work
    }
    const save = (): void => { void persist().catch(() => {}) }
    const cancelDrag = (pointer: number): void => {
        const previous = drags.get(pointer); drags.delete(pointer)
        previous?.ghost.remove()
        if (previous?.piece.hasPointerCapture(pointer)) previous.piece.releasePointerCapture(pointer)
    }
    const cancel = (): void => { for (const pointer of [...drags.keys()]) cancelDrag(pointer) }
    const svg = (id: number): SVGSVGElement => {
        const ns = 'http://www.w3.org/2000/svg', el = document.createElementNS(ns, 'svg')
        el.setAttribute('viewBox', '-30 -30 160 160')
        const clipId = `puzzle-${id}-${Math.random().toString(36).slice(2)}`
        el.innerHTML = `<defs><clipPath id="${clipId}"><path d="${piecePath(Math.floor(id / size), id % size, size, roundId)}"/></clipPath></defs>`
        const image = document.createElementNS(ns, 'image')
        image.setAttribute('href', cameraMode ? cameraFrame : pictures[current].image)
        if (cameraMode) image.setAttribute('class', 'camera-frame')
        image.setAttribute('x', String(-(id % size) * 100)); image.setAttribute('y', String(-Math.floor(id / size) * 100))
        image.setAttribute('width', String(size * 100)); image.setAttribute('height', String(size * 100))
        image.setAttribute('preserveAspectRatio', 'xMidYMid slice'); image.setAttribute('clip-path', `url(#${clipId})`)
        el.append(image)
        const outline = document.createElementNS(ns, 'path')
        outline.setAttribute('d', piecePath(Math.floor(id / size), id % size, size, roundId)); outline.setAttribute('fill', 'none'); outline.setAttribute('stroke', '#34455999'); outline.setAttribute('stroke-width', '1')
        el.append(outline)
        return el
    }
    const select = (id: number): void => {
        if (placed.has(id)) return
        selected = id
        for (const piece of tray.querySelectorAll<HTMLElement>('[data-id]')) piece.setAttribute('aria-pressed', String(Number(piece.dataset.id) === id))
    }
    const place = (slot: number, pieceId: number | null = selected): void => {
        if (!active || menu.open || pieceId === null || placed.has(slot)) return
        if (slot !== pieceId) { message.textContent = 'Try another space for this piece.'; return }
        placed.add(slot)
        const target = board.children[slot] as HTMLElement
        target.append(svg(slot)); target.classList.add('filled'); target.setAttribute('aria-label', `Space ${slot + 1}, complete`)
        tray.querySelector<HTMLElement>(`[data-id="${slot}"]`)!.hidden = true
        if (selected === pieceId) selected = null
        if (placed.size === size * size) audit('solve', puzzleLabel(), true, roundId)
        savedAt = Date.now(); checkpoint(); save()
        message.textContent = placed.size === size * size ? 'You did it! Your picture is complete.' : `${placed.size} of ${size * size} pieces in place.`
    }
    const start = (reset = false): void => {
        if (randomSize) {
            const prefix = `${cameraMode ? 'camera' : pictures[current]?.id ?? ''}:`
            const previousGrid = reset ? undefined : [3, 4, 5].filter(grid => restorable(progress[`${prefix}${grid}`], grid, Date.now()))
                .sort((a, b) => progress[`${prefix}${b}`].savedAt - progress[`${prefix}${a}`].savedAt)[0]
            size = previousGrid ?? [3, 4, 5][Math.floor(Math.random() * 3)]
        }
        cancel(); placed = new Set(); selected = null; board.replaceChildren(); tray.replaceChildren()
        get('.workspace').hidden = !cameraMode && pictures.length === 0
        get<HTMLButtonElement>('#remove').disabled = cameraMode || pictures.length === 0
        get<HTMLButtonElement>('#export-puzzle').disabled = cameraMode || pictures.length === 0
        get<HTMLButtonElement>('#edit').disabled = cameraMode || pictures.length === 0
        get<HTMLButtonElement>('#restart').disabled = !cameraMode && pictures.length === 0
        if (!cameraMode && !pictures.length) { roundKey = ''; roundId = ''; order = []; message.textContent = 'No puzzles yet. Hold the title to add a picture.'; return }
        roundKey = progressKey()
        const previous = reset ? undefined : progress[roundKey]
        const restored = restorable(previous, size, Date.now()) ? previous : undefined
        placed = new Set(restored?.placed ?? [])
        order = restored?.order ?? shuffledPieces(size)
        roundId = restored?.activityId ?? createPictureId(); savedAt = restored?.savedAt ?? Date.now()
        audit('activity', puzzleLabel(), false, roundId)
        checkpoint()
        reference.src = cameraMode ? cameraPreview : pictures[current].image
        reference.hidden = !preview.checked
        board.style.gridTemplateColumns = `repeat(${size},1fr)`
        tray.style.gridTemplateColumns = `repeat(${size},1fr)`
        for (let id = 0; id < size * size; id++) {
            const slot = document.createElement('button'); slot.type = 'button'; slot.className = 'slot'
            slot.setAttribute('aria-label', `Place piece in row ${Math.floor(id / size) + 1}, column ${id % size + 1}`)
            const silhouette = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
            silhouette.setAttribute('viewBox', '-30 -30 160 160')
            const cut = document.createElementNS('http://www.w3.org/2000/svg', 'path')
            cut.setAttribute('d', piecePath(Math.floor(id / size), id % size, size, roundId))
            cut.setAttribute('fill', '#ffffff18'); cut.setAttribute('stroke', '#6a8076'); cut.setAttribute('stroke-width', '1')
            silhouette.append(cut); slot.append(silhouette)
            slot.onclick = () => place(id); board.append(slot)
            if (placed.has(id)) { slot.append(svg(id)); slot.classList.add('filled'); slot.setAttribute('aria-label', `Space ${id + 1}, complete`) }
        }
        for (const id of order) {
            const piece = document.createElement('button'); piece.type = 'button'; piece.className = 'piece'; piece.dataset.id = String(id); piece.hidden = placed.has(id)
            piece.setAttribute('aria-label', `Piece ${id + 1}. Select then choose a space, or drag.`); piece.setAttribute('aria-pressed', 'false'); piece.append(svg(id))
            let suppressClick = false
            piece.onclick = () => { if (suppressClick) { suppressClick = false; return } if (active) select(id) }
            piece.onpointerdown = event => {
                if (!active || menu.open || event.button !== 0 || placed.has(id) || drags.has(event.pointerId) || [...drags.values()].some(drag => drag.id === id)) return
                select(id)
                const rect = piece.getBoundingClientRect(), ghost = piece.cloneNode(true) as HTMLElement
                ghost.classList.add('ghost'); ghost.style.width = `${rect.width}px`; ghost.style.left = `${rect.left}px`; ghost.style.top = `${rect.top}px`; root.append(ghost)
                suppressClick = false
                drags.set(event.pointerId, { id, piece, ghost, x: event.clientX - rect.left, y: event.clientY - rect.top })
                piece.setPointerCapture(event.pointerId)
            }
            piece.onpointermove = event => {
                const drag = drags.get(event.pointerId)
                if (!drag || drag.id !== id) return
                suppressClick = true
                drag.ghost.style.left = `${event.clientX - drag.x}px`; drag.ghost.style.top = `${event.clientY - drag.y}px`
            }
            piece.onpointerup = event => {
                const drag = drags.get(event.pointerId)
                if (!drag || drag.id !== id) return
                const rect = board.getBoundingClientRect(), border = 0
                const x = (event.clientX - rect.left - border) / (rect.width - border * 2), y = (event.clientY - rect.top - border) / (rect.height - border * 2)
                if (x >= 0 && x < 1 && y >= 0 && y < 1) place(Math.floor(y * size) * size + Math.floor(x * size), drag.id)
                cancelDrag(event.pointerId)
            }
            piece.onpointercancel = event => cancelDrag(event.pointerId)
            piece.onlostpointercapture = event => cancelDrag(event.pointerId)
            tray.append(piece)
        }
        message.textContent = placed.size ? `${placed.size} of ${size * size} pieces restored.` : 'Drag a piece to its home, or select a piece and tap a space.'
    }
    const choosePuzzle = (index: number | 'camera'): void => {
        checkpoint(); save()
        stopCamera()
        if (index === 'camera') {
            cameraMode = true; reference.hidden = true
            get('.workspace').hidden = true; message.textContent = 'Opening camera...'
            drawGallery(); void camera.start()
        } else { current = index; drawGallery(); start(); save() }
    }
    const drawGallery = (): void => {
        gallery.replaceChildren(); puzzleList.replaceChildren()
        const nameInput = get<HTMLInputElement>('#puzzle-name')
        nameInput.value = cameraMode ? 'Live camera' : pictures[current]?.name ?? ''
        nameInput.disabled = cameraMode || !pictures.length
        const makeButton = (picture: Picture, index: number): HTMLButtonElement => {
            const button = document.createElement('button'); button.type = 'button'; button.className = 'picture'; button.setAttribute('aria-pressed', String(!cameraMode && index === current))
            const image = document.createElement('img'); image.src = picture.image; image.alt = ''
            const name = document.createElement('span'); name.textContent = picture.name
            button.append(image, name); button.onclick = () => choosePuzzle(index)
            return button
        }
        pictures.forEach((picture, index) => { gallery.append(makeButton(picture, index)); puzzleList.append(makeButton(picture, index)) })
        const cameraButton = document.createElement('button'); cameraButton.type = 'button'; cameraButton.className = 'picture'
        cameraButton.setAttribute('aria-pressed', String(cameraMode))
        if (cameraPreview) { const image = document.createElement('img'); image.src = cameraPreview; image.alt = ''; cameraButton.append(image) }
        const name = document.createElement('span'); name.textContent = 'Live camera'; cameraButton.append(name)
        cameraButton.onclick = () => choosePuzzle('camera'); puzzleList.append(cameraButton)
    }
    get<HTMLInputElement>('#puzzle-name').onchange = event => {
        const input = event.target as HTMLInputElement, name = input.value.trim().slice(0, 200)
        if (!cameraMode && pictures[current] && name) { pictures[current].name = name; drawGallery(); save(); if (roundId) audit('activity', puzzleLabel(), false, roundId) }
    }
    sizeSelect.onchange = () => { checkpoint(); randomSize = sizeSelect.value === 'random'; if (!randomSize) size = Number(sizeSelect.value); start(true); save() }
    get('#screensaver').onclick = () => { checkpoint(); save(); cancel(); showScreensaver() }
    get('#restart').onclick = () => { start(true); save() }
    get('#remove').onclick = () => {
        checkpoint()
        const removed = pictures.splice(current, 1)[0]
        current = Math.min(current, Math.max(0, pictures.length - 1)); drawGallery(); start(); save()
        if (removed) {
            for (const key of Object.keys(progress)) if (key.startsWith(`${removed.id}:`)) delete progress[key]
            URL.revokeObjectURL(removed.image); save()
        }
    }
    preview.onchange = () => { reference.hidden = !preview.checked; save() }
    get('#exit-fullscreen').onclick = async () => {
        menuStatus.textContent = await exitAppFullscreen() ?? 'Fullscreen exit requested.'
    }

    const title = get('#puzzle-title')
    let hold: ReturnType<typeof setTimeout> | undefined, holdPointer: number | null = null, holdX = 0, holdY = 0
    const cancelHold = (): void => { clearTimeout(hold); hold = undefined; holdPointer = null }
    const openMenu = (): void => {
        cancelHold(); cancel()
        if (active && loaded && !menu.open) menu.showModal()
    }
    title.onpointerdown = event => {
        if (event.button !== 0 || holdPointer !== null) return
        holdPointer = event.pointerId; holdX = event.clientX; holdY = event.clientY
        title.setPointerCapture(event.pointerId)
        hold = setTimeout(openMenu, 2500)
    }
    title.onpointermove = event => {
        if (event.pointerId === holdPointer && Math.hypot(event.clientX - holdX, event.clientY - holdY) > 12) cancelHold()
    }
    title.onpointerup = cancelHold; title.onpointercancel = cancelHold; title.onlostpointercapture = cancelHold
    title.oncontextmenu = event => event.preventDefault()
    title.onkeydown = event => { if (event.altKey && event.key === 'Enter') { event.preventDefault(); openMenu() } }
    get('#close-menu').onclick = () => menu.close()

    const cropDialog = get<HTMLDialogElement>('#crop-dialog'), canvas = get<HTMLCanvasElement>('#crop-canvas')
    const cropSelection = get('#crop-selection')
    let crop: CropRect = { x: 0, y: 0, side: 1 }
    const cropStatus = get('#crop-status'), cropSave = get<HTMLButtonElement>('#crop-save')
    let edit: { source: Blob; image: HTMLImageElement; url: string; name: string; id?: string } | null = null
    let cropToken = 0, busyCrop = false
    let pan: { pointer: number; x: number; y: number; rect: CropRect; handle: CropHandle } | null = null
    const stopPan = (): void => {
        const previous = pan; pan = null
        if (previous && cropSelection.hasPointerCapture(previous.pointer)) cropSelection.releasePointerCapture(previous.pointer)
    }
    const closeCrop = (): void => {
        cropToken++; stopPan()
        if (edit) URL.revokeObjectURL(edit.url)
        edit = null
    }
    const renderCrop = (): void => {
        if (!edit) return
        const width = edit.image.naturalWidth, height = edit.image.naturalHeight
        cropSelection.style.left = `${crop.x / width * 100}%`
        cropSelection.style.top = `${crop.y / height * 100}%`
        cropSelection.style.width = `${crop.side / width * 100}%`
        cropSelection.style.height = `${crop.side / height * 100}%`
    }
    const openCrop = async (source: Blob, name: string, id?: string): Promise<void> => {
        closeCrop()
        const token = cropToken, url = URL.createObjectURL(source)
        try {
            if (source.size > 30_000_000) throw new Error()
            const image = new Image(); image.src = url; await image.decode()
            if (token !== cropToken || !active || !menu.open) { URL.revokeObjectURL(url); return }
            edit = { source, image, url, name, id }
            get<HTMLInputElement>('#picture-name').value = name
            crop = cropRect(image.naturalWidth, image.naturalHeight, 1, .5, .5)
            const scale = 800 / Math.max(image.naturalWidth, image.naturalHeight)
            canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
            canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
            canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height)
            cropStatus.textContent = ''; cropSave.disabled = false; renderCrop(); cropDialog.showModal()
        } catch { URL.revokeObjectURL(url); menuStatus.textContent = 'Could not open this image. Choose an image smaller than 30 MB.' }
    }
    const beginCropDrag = (event: PointerEvent, handle: CropHandle): void => {
        if (!edit || busyCrop || event.button !== 0 || pan) return
        event.preventDefault(); event.stopPropagation()
        pan = { pointer: event.pointerId, x: event.clientX, y: event.clientY, rect: { ...crop }, handle }
        cropSelection.setPointerCapture(event.pointerId)
    }
    cropSelection.onpointerdown = event => beginCropDrag(event, 'move')
    const handles: [CropHandle, number, number, string][] = [
        ['nw', 0, 0, 'top left'], ['n', 50, 0, 'top'], ['ne', 100, 0, 'top right'], ['e', 100, 50, 'right'],
        ['se', 100, 100, 'bottom right'], ['s', 50, 100, 'bottom'], ['sw', 0, 100, 'bottom left'], ['w', 0, 50, 'left']
    ]
    for (const [handle, x, y, label] of handles) {
        const button = document.createElement('button'); button.type = 'button'; button.className = 'crop-handle'; button.dataset.handle = handle
        button.style.left = `${x}%`; button.style.top = `${y}%`
        button.setAttribute('aria-label', `Resize crop from ${label}. Use arrow keys to resize.`)
        button.onpointerdown = event => beginCropDrag(event, handle)
        cropSelection.append(button)
    }
    cropSelection.onpointermove = event => {
        if (!edit || pan?.pointer !== event.pointerId) return
        const box = canvas.getBoundingClientRect()
        if (box.width <= 0 || box.height <= 0) return
        crop = adjustCrop(pan.rect, pan.handle, (event.clientX - pan.x) * edit.image.naturalWidth / box.width,
            (event.clientY - pan.y) * edit.image.naturalHeight / box.height, edit.image.naturalWidth, edit.image.naturalHeight)
        renderCrop()
    }
    cropSelection.onkeydown = event => {
        if (!edit || busyCrop || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return
        event.preventDefault()
        const step = Math.min(edit.image.naturalWidth, edit.image.naturalHeight) / (event.shiftKey ? 20 : 100)
        const handle = (event.target as HTMLElement).dataset.handle as CropHandle | undefined
        crop = adjustCrop(crop, handle ?? 'move', event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0,
            event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0, edit.image.naturalWidth, edit.image.naturalHeight)
        renderCrop()
    }
    cropSelection.onpointerup = stopPan; cropSelection.onpointercancel = stopPan; cropSelection.onlostpointercapture = stopPan
    cropDialog.addEventListener('close', closeCrop)
    cropDialog.addEventListener('cancel', event => { if (busyCrop) event.preventDefault() })
    get('#crop-cancel').onclick = () => { if (!busyCrop) cropDialog.close() }
    cropSave.onclick = async () => {
        if (!edit || busyCrop) return
        const editing = edit, token = cropToken
        busyCrop = true; cropSave.disabled = true; cropStatus.textContent = 'Saving image...'
        try {
            stopPan()
            const output = document.createElement('canvas'); output.width = output.height = 800
            const context = output.getContext('2d')
            if (!context) throw new Error('Image canvas is unavailable.')
            context.fillStyle = '#fff'; context.fillRect(0, 0, 800, 800)
            context.drawImage(editing.image, crop.x, crop.y, crop.side, crop.side, 0, 0, 800, 800)
            const blob = await new Promise<Blob>((resolve, reject) => output.toBlob(value => value ? resolve(value) : reject(new Error()), 'image/jpeg', .9))
            if (token !== cropToken) return
            const record: SavedPicture = { id: editing.id ?? createPictureId(), name: get<HTMLInputElement>('#picture-name').value.trim().slice(0, 200) || editing.name, blob, original: editing.source }
            const image = URL.createObjectURL(blob)
            const index = pictures.findIndex(p => p.id === record.id), previous = index < 0 ? undefined : pictures[index]
            if (index < 0) { pictures.push({ ...record, image }); current = pictures.length - 1 }
            else { pictures[index] = { ...record, image }; current = index }
            checkpoint()
            for (const key of Object.keys(progress)) if (key.startsWith(`${record.id}:`)) delete progress[key]
            stopCamera(); drawGallery(); start()
            try {
                await persist()
                menuStatus.textContent = 'Image saved.'
            } catch {
                menuStatus.textContent = 'Image is available for this visit only. Save a collection backup or try saving again.'
            }
            if (previous) URL.revokeObjectURL(previous.image)
            if (token === cropToken) cropDialog.close()
        } catch (error) {
            console.error('Could not save puzzle crop', error)
            cropStatus.textContent = 'Could not create the cropped image. Please try another image.'
        }
        finally { busyCrop = false; cropSave.disabled = false }
    }
    const photos = get<HTMLInputElement>('#photos')
    photos.onchange = () => {
        const file = photos.files?.[0]; photos.value = ''; menuStatus.textContent = ''
        if (!file) return
        if (pictures.length >= 20) { menuStatus.textContent = 'Keep up to 20 pictures per collection. Delete one before adding another.'; return }
        void (async () => {
            try {
                // Copy file bytes now; uploaded File handles can become unreadable
                // after reload or after the source file moves on the device.
                const original = new Blob([await file.arrayBuffer()], { type: file.type || 'application/octet-stream' })
                await openCrop(original, file.name.slice(0, 200))
            } catch { menuStatus.textContent = 'Could not read the original image. Select the file again.' }
        })()
    }
    get('#edit').onclick = () => { const p = pictures[current]; if (p) void openCrop(p.original ?? p.blob, p.name, p.id) }
    const downloadLink = get<HTMLAnchorElement>('#puzzle-download')
    let exportURL: string | null = null, exporting = false
    const recoverExportImage = async (picture: SavedPicture): Promise<Blob> => {
        const loaded = pictures.find(p => p.id === picture.id)
        if (!loaded) throw new Error('Picture no longer available.')
        const image = new Image(); image.src = loaded.image; await image.decode()
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = 800
        const context = canvas.getContext('2d')
        if (!context) throw new Error('Image canvas unavailable.')
        context.drawImage(image, 0, 0, 800, 800)
        return await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Image recovery failed.')), 'image/jpeg', .95))
    }
    const download = async (selectedOnly: boolean): Promise<void> => {
        if (exporting) return
        const selectedPictures = selectedOnly ? (cameraMode || !pictures[current] ? [] : [pictures[current]]) : [...pictures]
        if (!selectedPictures.length) { menuStatus.textContent = 'Add an image puzzle before exporting. Live camera is not exported.'; return }
        checkpoint(); exporting = true
        get<HTMLButtonElement>('#save').disabled = true; get<HTMLButtonElement>('#export-puzzle').disabled = true
        menuStatus.textContent = 'Preparing puzzle file...'
        const warnings: string[] = []
        try {
            const blob = await exportPuzzles(selectedPictures, size, preview.checked, structuredClone(progress), {
                randomSize, recoverImage: recoverExportImage, warn: message => warnings.push(message)
            })
            const url = URL.createObjectURL(blob)
            const previous = exportURL; exportURL = url
            const filename = selectedOnly ? selectedPictures[0].name.replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 80) || 'puzzle' : 'puzzle-collection'
            // A real user click keeps browser download permission. Retain the URL
            // so slower browsers can finish consuming large puzzle collections.
            downloadLink.href = url; downloadLink.download = `${filename}.dat`; downloadLink.hidden = false
            downloadLink.textContent = `Download ${selectedPictures.length === 1 ? selectedPictures[0].name : 'all puzzles'} (.dat)`
            if (previous) URL.revokeObjectURL(previous)
            menuStatus.textContent = `File ready. Tap the download link to save it.${warnings.length ? ` ${warnings.join(' ')}` : ''}`
        } catch (error) { menuStatus.textContent = error instanceof Error ? error.message : 'Could not prepare puzzles. Try again.' }
        finally {
            exporting = false; get<HTMLButtonElement>('#save').disabled = false
            get<HTMLButtonElement>('#export-puzzle').disabled = cameraMode || pictures.length === 0
        }
    }
    get('#save').onclick = () => { void download(false) }
    get('#export-puzzle').onclick = () => { void download(true) }
    let importing = false
    get<HTMLInputElement>('#load').onchange = async event => {
        const input = event.target as HTMLInputElement, file = input.files?.[0]; input.value = ''
        if (!file || importing) return
        importing = true
        const imported: Picture[] = []
        try {
            if (file.size > MAX_PUZZLE_FILE_BYTES) throw new Error('Puzzle file is too large.')
            const data = importPuzzles(await file.text())
            if (pictures.length + data.pictures.length > 20) throw new Error('Import would exceed 20 saved puzzles. Delete some puzzles first.')
            for (const p of data.pictures) {
                const image = URL.createObjectURL(p.blob)
                imported.push({ ...p, image })
                const decoded = new Image(); decoded.src = image; await decoded.decode()
                if (p.original) {
                    const originalURL = URL.createObjectURL(p.original)
                    try { const original = new Image(); original.src = originalURL; await original.decode() }
                    finally { URL.revokeObjectURL(originalURL) }
                }
            }
            if (pictures.length + imported.length > 20) throw new Error('Import would exceed 20 saved puzzles.')
            checkpoint(); stopCamera()
            current = pictures.length; pictures.push(...imported)
            progress = { ...progress, ...data.progress }; size = data.size; randomSize = data.randomSize; preview.checked = data.preview
            sizeSelect.value = randomSize ? 'random' : String(size); drawGallery(); start()
            try { await persist(); menuStatus.textContent = `Imported ${imported.length} puzzle${imported.length === 1 ? '' : 's'}.` }
            catch { menuStatus.textContent = 'Puzzles imported for this visit, but browser storage failed. Export a backup to keep them.' }
        } catch (error) {
            imported.forEach(p => URL.revokeObjectURL(p.image))
            menuStatus.textContent = error instanceof Error ? error.message : 'Could not import puzzles. Choose a puzzle export text file.'
        } finally { importing = false }
    }
    get('#puzzle-return').onclick = () => { location.hash = '/balloons' }
    for (const link of root.querySelectorAll<HTMLElement>('nav a, #puzzle-return')) bindActivation(link)
    window.addEventListener('pagehide', () => { checkpoint(); save() })
    document.addEventListener('visibilitychange', () => { if (document.hidden) { checkpoint(); save() } if (document.hidden && cameraMode) { stopCamera(); drawGallery(); start() } })
    document.addEventListener('activity-idle', () => { if (cameraMode) { stopCamera(); drawGallery(); start() } })
    window.addEventListener('blur', () => { cancel(); cancelHold(); stopPan() })
    window.addEventListener('resize', () => { cancel(); cancelHold(); stopPan() })
    void loadCollection().then(collection => {
        progress = collection.progress ?? {}; cameraPreview = collection.cameraPreview ?? ''
        pictures = collection.pictures.map(p => ({ ...p, image: URL.createObjectURL(p.blob) }))
        size = collection.size; randomSize = collection.randomSize === true; preview.checked = collection.preview; sizeSelect.value = randomSize ? 'random' : String(size)
        current = Math.max(0, pictures.findIndex(p => p.id === collection.current))
        loaded = true; drawGallery(); start(); save()
    }).catch(() => {
        loaded = true; drawGallery(); start()
        menuStatus.textContent = 'Browser storage is unavailable. Added images may last only for this visit; use Save collection to keep a backup.'
    })
    return { setActive(value) {
        const resuming = value && !active
        active = value
        if (resuming && loaded && !cameraMode) { start(); save() }
        if (!value) { checkpoint(); save(); if (cameraMode) { stopCamera(); drawGallery(); start() } cancel(); cancelHold(); closeCrop(); if (cropDialog.open) cropDialog.close(); if (menu.open) menu.close() }
    } }
}
