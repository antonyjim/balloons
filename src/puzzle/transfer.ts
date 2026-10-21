import { createPictureId, type SavedPicture } from './storage'
import { restorable, type PuzzleProgress } from './progress'
export const MAX_PUZZLE_FILE_BYTES = 150_000_000
interface PortablePicture { id: string; name: string; image: string; original?: string }
const raster = /^data:image\/(png|jpeg|webp|gif|avif|bmp);base64,/
async function dataURL(blob: Blob): Promise<string> {
    try {
        const bytes = new Uint8Array(await blob.arrayBuffer())
        let binary = ''
        for (let i = 0; i < bytes.length; i += 32768) binary += String.fromCharCode(...bytes.subarray(i, i + 32768))
        return `data:${blob.type};base64,${btoa(binary)}`
    } catch (error) {
        // Some browsers abort arrayBuffer reads of IndexedDB-backed Files.
        // FileReader takes a different read path and can still recover the data.
        if (typeof FileReader === 'undefined') throw error
        return await new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Image read returned no data.'))
            reader.onerror = () => reject(reader.error ?? new Error('Could not read image.'))
            reader.onabort = () => reject(new Error('Image read was interrupted.'))
            reader.readAsDataURL(blob)
        })
    }
}
export interface ExportRecovery {
    randomSize?: boolean
    recoverImage?(picture: SavedPicture): Promise<Blob>
    warn?(message: string): void
}
function decodeImage(value: unknown, maxBytes: number, original = false): Blob {
    if (typeof value !== 'string' || value.length > maxBytes * 1.4 + 100 || !(original ? /^data:(?:image\/[a-zA-Z0-9.+-]+|application\/octet-stream);base64,/.test(value) : raster.test(value))) throw new Error('Invalid puzzle image.')
    const [header, content] = value.split(',')
    const bytes = Uint8Array.from(atob(content), char => char.charCodeAt(0))
    if (bytes.length > maxBytes) throw new Error('Puzzle image is too large.')
    return new Blob([bytes], { type: header.slice(5, header.indexOf(';')) })
}
export async function exportPuzzles(pictures: SavedPicture[], size: number, preview: boolean, progress: Record<string, PuzzleProgress>, recovery: ExportRecovery = {}): Promise<Blob> {
    const records: PortablePicture[] = []
    let estimated = 0
    for (const picture of pictures) {
        const original = picture.original
        estimated += (picture.blob.size + (original?.size ?? 0)) * 1.4 + 1000
        if (estimated > MAX_PUZZLE_FILE_BYTES) throw new Error('Collection is too large. Export puzzles individually.')
        let image: string
        try { image = await dataURL(picture.blob) }
        catch {
            if (!recovery.recoverImage) throw new Error(`Could not read the picture for "${picture.name}". Try reloading and exporting again.`)
            try { image = await dataURL(await recovery.recoverImage(picture)) }
            catch { throw new Error(`Could not read the picture for "${picture.name}". Try reloading and exporting again.`) }
        }
        let originalData: string | undefined
        if (original) {
            try { originalData = await dataURL(original) }
            catch { throw new Error(`The original for "${picture.name}" could not be read. Re-add the original image before exporting; no incomplete backup was created.`) }
        }
        records.push({ id: picture.id, name: picture.name, image, original: originalData })
    }
    const savedProgress: Record<string, PuzzleProgress> = {}
    for (const p of pictures) for (const grid of [3, 4, 5]) {
        const key = `${p.id}:${grid}`
        if (restorable(progress[key], grid, Date.now())) savedProgress[key] = progress[key]
    }
    return new Blob([JSON.stringify({ format: 'balloons-puzzles', version: 1, size, randomSize: recovery.randomSize === true, preview, pictures: records, progress: savedProgress })], { type: 'application/octet-stream' })
}
export function importPuzzles(text: string): { pictures: SavedPicture[]; size: number; randomSize: boolean; preview: boolean; progress: Record<string, PuzzleProgress> } {
    if (text.length > MAX_PUZZLE_FILE_BYTES) throw new Error('Puzzle file is too large.')
    const data = JSON.parse(text)
    if (data.format !== undefined && (data.format !== 'balloons-puzzles' || data.version !== 1)) throw new Error('Unsupported puzzle file version.')
    if (![3, 4, 5].includes(data.size) || !Array.isArray(data.pictures) || !data.pictures.length || data.pictures.length > 20) throw new Error('Choose a puzzle export file containing 1 to 20 puzzles.')
    const progress: Record<string, PuzzleProgress> = {}
    const pictures = data.pictures.map((p: PortablePicture) => {
        if (!p || typeof p.name !== 'string' || !p.name.trim() || p.name.length > 200) throw new Error('Invalid puzzle name.')
        const id = createPictureId()
        if (typeof p.id === 'string') for (const grid of [3, 4, 5]) {
            const state = data.progress?.[`${p.id}:${grid}`]
            // Keep the round ID: it is also the seed for matching jigsaw outlines.
            if (restorable(state, grid, Date.now())) progress[`${id}:${grid}`] = state
        }
        return { id, name: p.name, blob: decodeImage(p.image, 3_000_000), original: p.original === undefined ? undefined : decodeImage(p.original, 30_000_000, true) }
    })
    return { pictures, size: data.size, randomSize: data.randomSize === true, preview: data.preview === true, progress }
}
