import markup from 'sketchpad-markup'
import styles from 'sketchpad-styles'
import { bindActivation } from '../activation'

export interface Sketchpad {
  setActive(active: boolean): void
  snapshot(): Promise<Blob>
}

export function mountSketchpad(host: HTMLElement, useDrawing: (image: Blob) => Promise<void>): Sketchpad {
const root = host.attachShadow({ mode: 'open' })
const body = markup.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? ''
root.innerHTML = `<style>${styles.replace(':root', ':host')}</style>${body.replace(/<script[\s\S]*?<\/script>/gi, '')}`
let active = true
type Tool = 'pen' | 'marker' | 'glow' | 'spray' | 'fill' | 'eraser'
type Point = { x: number, y: number }

const canvas = root.querySelector<HTMLCanvasElement>('#canvas')!
const ctx = canvas.getContext('2d', { willReadFrequently: true })!
const colorWheel = root.querySelector<HTMLElement>('#color-wheel')!
const colorPreview = root.querySelector<HTMLElement>('#color-preview')!
const sizeInput = root.querySelector<HTMLInputElement>('#brush-size')!
const sizeButton = root.querySelector<HTMLButtonElement>('#size-toggle')!
const sizePanel = root.querySelector<HTMLElement>('#size-panel')!
const sizePreview = root.querySelector<HTMLElement>('#size-preview')!
const toolButtons = root.querySelectorAll<HTMLButtonElement>('[data-tool]')
const paper = '#f4f3f9'

let tool: Tool = 'pen'
let color = '#7657ec'
let brushSize = 24
const pointers = new Map<number, { last: Point, tool: Tool, color: string, size: number }>()
let ratio = 1
let width = 0
let height = 0
let retained: HTMLCanvasElement | null = null
let retainedWidth = 0, retainedHeight = 0

function resize() {
  if (!active) return
  const w = window.innerWidth
  const h = window.innerHeight
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  if (w === width && h === height && dpr === ratio) return

  // Keep offscreen drawing at its original CSS size rather than stretching it
  // to the new aspect ratio. The retained surface preserves cropped regions.
  const nextWidth = Math.max(w, retainedWidth, width)
  const nextHeight = Math.max(h, retainedHeight, height)
  const previous = document.createElement('canvas')
  previous.width = Math.round(nextWidth * dpr)
  previous.height = Math.round(nextHeight * dpr)
  const saved = previous.getContext('2d')!
  saved.setTransform(dpr, 0, 0, dpr, 0, 0)
  saved.fillStyle = paper
  saved.fillRect(0, 0, nextWidth, nextHeight)
  if (retained) saved.drawImage(retained, 0, 0, retained.width, retained.height, 0, 0, retainedWidth, retainedHeight)
  if (width && height) saved.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, width, height)
  retained = previous
  retainedWidth = nextWidth
  retainedHeight = nextHeight
  width = w
  height = h
  ratio = dpr
  canvas.width = Math.round(w * dpr)
  canvas.height = Math.round(h * dpr)
  ctx.setTransform(canvas.width / w, 0, 0, canvas.height / h, 0, 0)
  ctx.drawImage(retained, 0, 0, retained.width, retained.height, 0, 0, retainedWidth, retainedHeight)
}

function point(event: PointerEvent): Point {
  return { x: event.clientX, y: event.clientY }
}

function setupStroke(brush: Tool, ink: string, size: number) {
  ctx.globalCompositeOperation = 'source-over'
  ctx.shadowBlur = 0
  ctx.globalAlpha = 1
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  if (brush === 'pen') {
    ctx.strokeStyle = ink
    ctx.fillStyle = ink
    ctx.lineWidth = size * 0.3
  } else if (brush === 'marker') {
    ctx.strokeStyle = ink
    ctx.fillStyle = ink
    ctx.lineWidth = size * 1.5
    ctx.globalAlpha = 0.2
  } else if (brush === 'glow') {
    ctx.strokeStyle = ink
    ctx.fillStyle = ink
    ctx.lineWidth = size * 0.5
    ctx.shadowColor = ink
    ctx.shadowBlur = size * 1.3
  } else if (brush === 'eraser') {
    ctx.strokeStyle = paper
    ctx.fillStyle = paper
    ctx.lineWidth = size * 2.5
  }
}

function spray(from: Point, to: Point, ink: string, size: number) {
  const distance = Math.hypot(to.x - from.x, to.y - from.y)
  const steps = Math.max(1, Math.ceil(distance / Math.max(1, size / 4)))
  ctx.save()
  ctx.fillStyle = ink
  ctx.globalAlpha = 0.65
  for (let step = 0; step < steps; step++) {
    const t = (step + 1) / steps
    const x = from.x + (to.x - from.x) * t
    const y = from.y + (to.y - from.y) * t
    for (let i = 0; i < 9; i++) {
      const angle = Math.random() * Math.PI * 2
      const radius = Math.sqrt(Math.random()) * size * 1.3
      ctx.beginPath()
      ctx.arc(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius, Math.max(0.3, size * 0.045) + Math.random() * size * 0.06, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.restore()
}

function stroke(from: Point, to: Point, brush: Tool, ink: string, size: number) {
  if (brush === 'spray') {
    spray(from, to, ink, size)
    return
  }
  ctx.save()
  setupStroke(brush, ink, size)
  ctx.beginPath()
  ctx.moveTo(from.x, from.y)
  ctx.lineTo(to.x, to.y)
  ctx.stroke()
  ctx.restore()
}

function dot(at: Point, brush: Tool, ink: string, size: number) {
  if (brush === 'spray') {
    spray(at, at, ink, size)
    return
  }
  ctx.save()
  setupStroke(brush, ink, size)
  ctx.beginPath()
  ctx.arc(at.x, at.y, ctx.lineWidth / 2, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function rgb(hex: string): [number, number, number] {
  return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number]
}

// Scanline flood fill: avoids a large per-pixel object queue or recursive stack.
function fill(at: Point) {
  const w = canvas.width
  const h = canvas.height
  const sx = Math.floor(at.x * ratio)
  const sy = Math.floor(at.y * ratio)
  if (sx < 0 || sy < 0 || sx >= w || sy >= h) return

  const image = ctx.getImageData(0, 0, w, h)
  const pixels = image.data
  const start = (sy * w + sx) * 4
  const target = [pixels[start], pixels[start + 1], pixels[start + 2], pixels[start + 3]]
  const next = rgb(color)
  if (target[3] === 255 && next.every((v, i) => Math.abs(v - target[i]) < 12)) return

  const tolerance = 24
  const matches = (index: number) =>
    Math.abs(pixels[index] - target[0]) <= tolerance &&
    Math.abs(pixels[index + 1] - target[1]) <= tolerance &&
    Math.abs(pixels[index + 2] - target[2]) <= tolerance &&
    Math.abs(pixels[index + 3] - target[3]) <= tolerance

  const visited = new Uint8Array(w * h)
  const stack: number[] = [sy * w + sx]

  while (stack.length) {
    const seed = stack.pop()!
    const y = Math.floor(seed / w)
    let x = seed % w
    let idx = y * w + x
    if (visited[idx] || !matches(idx * 4)) continue

    while (x > 0 && !visited[idx - 1] && matches((idx - 1) * 4)) {
      x--
      idx--
    }

    let above = false
    let below = false
    while (x < w && !visited[idx] && matches(idx * 4)) {
      visited[idx] = 1
      const p = idx * 4
      pixels[p] = next[0]
      pixels[p + 1] = next[1]
      pixels[p + 2] = next[2]
      pixels[p + 3] = 255

      if (y > 0) {
        const a = idx - w
        const hit = !visited[a] && matches(a * 4)
        if (hit && !above) stack.push(a)
        above = hit
      }
      if (y < h - 1) {
        const b = idx + w
        const hit = !visited[b] && matches(b * 4)
        if (hit && !below) stack.push(b)
        below = hit
      }
      x++
      idx++
    }
  }
  ctx.putImageData(image, 0, 0)
}

canvas.addEventListener('pointerdown', event => {
  if (event.pointerType === 'mouse' && event.button !== 0) return
  event.preventDefault()
  const at = point(event)
  if (tool === 'fill') {
    fill(at)
    return
  }
  pointers.set(event.pointerId, { last: at, tool, color, size: brushSize })
  canvas.setPointerCapture(event.pointerId)
  dot(at, tool, color, brushSize)
})

canvas.addEventListener('pointermove', event => {
  const pointer = pointers.get(event.pointerId)
  if (!pointer) return
  event.preventDefault()
  const events = event.getCoalescedEvents?.() ?? [event]
  for (const e of events) {
    const next = point(e)
    stroke(pointer.last, next, pointer.tool, pointer.color, pointer.size)
    pointer.last = next
  }
})

function stop(event: PointerEvent) {
  if (!pointers.delete(event.pointerId)) return
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId)
}
canvas.addEventListener('pointerup', stop)
canvas.addEventListener('pointercancel', stop)
canvas.addEventListener('lostpointercapture', event => pointers.delete(event.pointerId))
canvas.addEventListener('contextmenu', event => event.preventDefault())
root.addEventListener('selectstart', event => event.preventDefault())

const colorPointers = new Set<number>()
function setColor(next: string) {
  color = next
  colorPreview.style.background = color
  for (const pointer of pointers.values()) pointer.color = color
}
root.querySelectorAll<HTMLButtonElement>('[data-color]').forEach(button => {
  bindActivation(button, () => {
    setColor(button.dataset.color!)
  })
})
function selectColor(event: PointerEvent) {
  const bounds = colorWheel.getBoundingClientRect()
  const dx = event.clientX - (bounds.left + bounds.width / 2)
  const dy = event.clientY - (bounds.top + bounds.height / 2)
  if (Math.hypot(dx, dy) < bounds.width * 0.18) return
  const hue = (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360
  setColor(hslToHex(hue, 95, 58))
}
colorWheel.addEventListener('pointerdown', event => {
  if (event.pointerType === 'mouse' && event.button !== 0) return
  event.preventDefault()
  colorPointers.add(event.pointerId)
  colorWheel.setPointerCapture(event.pointerId)
  selectColor(event)
})
colorWheel.addEventListener('pointermove', event => {
  if (!colorPointers.has(event.pointerId)) return
  event.preventDefault()
  selectColor(event)
})
function stopColor(event: PointerEvent) {
  colorPointers.delete(event.pointerId)
  if (colorWheel.hasPointerCapture(event.pointerId)) colorWheel.releasePointerCapture(event.pointerId)
}
colorWheel.addEventListener('pointerup', stopColor)
colorWheel.addEventListener('pointercancel', stopColor)
colorWheel.addEventListener('lostpointercapture', event => colorPointers.delete(event.pointerId))

function hslToHex(h: number, s: number, l: number): string {
  s /= 100
  l /= 100
  const a = s * Math.min(l, 1 - l)
  const component = (n: number) => {
    const k = (n + h / 30) % 12
    const value = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
    return Math.round(255 * value).toString(16).padStart(2, '0')
  }
  return `#${component(0)}${component(8)}${component(4)}`
}

bindActivation(sizeButton, () => {
  const open = sizePanel.hidden
  sizePanel.hidden = !open
  sizeButton.setAttribute('aria-expanded', String(open))
})

sizeInput.addEventListener('input', () => {
  brushSize = Number(sizeInput.value)
  sizePreview.style.width = `${brushSize}px`
  sizePreview.style.height = `${brushSize}px`
  sizeInput.setAttribute('aria-valuetext', `${brushSize} pixels`)
})

toolButtons.forEach(button => {
  bindActivation(button, () => {
    tool = button.dataset.tool as Tool
    toolButtons.forEach(other => {
      const selected = other === button
      other.classList.toggle('active', selected)
      other.setAttribute('aria-pressed', String(selected))
    })
  })
})

bindActivation(root.querySelector<HTMLButtonElement>('#clear')!, () => {
  retained = null
  retainedWidth = retainedHeight = 0
  ctx.save()
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'
  ctx.fillStyle = paper
  ctx.fillRect(0, 0, width, height)
  ctx.restore()
})

const releasePointers = (): void => {
  for (const id of [...colorPointers]) {
    colorPointers.delete(id)
    if (colorWheel.hasPointerCapture(id)) colorWheel.releasePointerCapture(id)
  }
  for (const id of [...pointers.keys()]) {
    pointers.delete(id)
    if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id)
  }
}
const snapshot = (): Promise<Blob> => {
  releasePointers()
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not export drawing')), 'image/png'))
}
bindActivation(root.querySelector<HTMLElement>('#back-to-balloons')!)
const puzzleLink = root.querySelector<HTMLElement>('#open-puzzle')
if (puzzleLink) bindActivation(puzzleLink)
const matchingLink = root.querySelector<HTMLElement>('#open-matching')
if (matchingLink) bindActivation(matchingLink)
const useButton = root.querySelector<HTMLButtonElement>('#use-drawing')!
const status = root.querySelector<HTMLElement>('#sketch-status')!
bindActivation(useButton, () => {
  useButton.disabled = true
  status.textContent = 'Preparing drawing?'
  void snapshot().then(useDrawing).then(() => { status.textContent = '' })
    .catch(() => { status.textContent = 'Could not use drawing. Please try again.' })
    .finally(() => { useButton.disabled = false })
})
window.addEventListener('blur', releasePointers)
window.addEventListener('resize', resize)
window.visualViewport?.addEventListener('resize', resize)
if (typeof ResizeObserver !== 'undefined') new ResizeObserver(resize).observe(canvas)
window.addEventListener('orientationchange', () => {
  requestAnimationFrame(resize)
  window.setTimeout(resize, 100)
  window.setTimeout(resize, 350)
})
resize()

return {
  snapshot,
  setActive(value) {
    active = value
    if (active) resize()
    else { releasePointers(); sizePanel.hidden = true; sizeButton.setAttribute('aria-expanded', 'false') }
  }
}
}
