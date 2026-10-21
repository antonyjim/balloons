export type CropHandle = 'move' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'
export interface CropRect { x: number; y: number; side: number }
const clamp = (value: number, low: number, high: number): number => Math.max(low, Math.min(high, value))

export function cropRect(width: number, height: number, zoom: number, x: number, y: number): CropRect {
    const side = Math.min(width, height) / clamp(zoom, 1, 4)
    return { x: (width - side) * clamp(x, 0, 1), y: (height - side) * clamp(y, 0, 1), side }
}

/** Resize against the opposite corner/edge, keeping a square entirely inside the photo. */
export function adjustCrop(rect: CropRect, handle: CropHandle, dx: number, dy: number, width: number, height: number): CropRect {
    if (handle === 'move') return { ...rect, x: clamp(rect.x + dx, 0, width - rect.side), y: clamp(rect.y + dy, 0, height - rect.side) }
    const horizontal = handle.includes('e') ? 1 : handle.includes('w') ? -1 : 0
    const vertical = handle.includes('s') ? 1 : handle.includes('n') ? -1 : 0
    const anchorX = rect.x + (horizontal < 0 ? rect.side : horizontal > 0 ? 0 : rect.side / 2)
    const anchorY = rect.y + (vertical < 0 ? rect.side : vertical > 0 ? 0 : rect.side / 2)
    const maxX = horizontal > 0 ? width - anchorX : horizontal < 0 ? anchorX : 2 * Math.min(anchorX, width - anchorX)
    const maxY = vertical > 0 ? height - anchorY : vertical < 0 ? anchorY : 2 * Math.min(anchorY, height - anchorY)
    const delta = (horizontal * dx + vertical * dy) / (horizontal && vertical ? 2 : 1)
    const side = clamp(rect.side + delta, Math.min(width, height) / 20, Math.min(maxX, maxY))
    return { x: anchorX - (horizontal < 0 ? side : horizontal > 0 ? 0 : side / 2), y: anchorY - (vertical < 0 ? side : vertical > 0 ? 0 : side / 2), side }
}
