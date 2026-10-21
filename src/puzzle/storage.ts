import type { PuzzleProgress } from './progress'
export interface SavedPicture { id: string; name: string; blob: Blob; original?: Blob }
export interface PuzzleCollection { pictures: SavedPicture[]; size: number; preview: boolean; current?: string; progress?: Record<string, PuzzleProgress>; cameraPreview?: string; randomSize?: boolean }
const LEGACY_KEY = 'balloons.puzzles.v1'

export function openPuzzleDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        let blocked = false
        const request = indexedDB.open('balloons-puzzles', 1)
        request.onupgradeneeded = () => request.result.createObjectStore('state')
        request.onsuccess = () => {
            const db = request.result
            if (blocked) { db.close(); return }
            db.onversionchange = () => db.close()
            resolve(db)
        }
        request.onerror = () => reject(request.error)
        request.onblocked = () => { blocked = true; reject(new Error('Close other puzzle tabs and try again.')) }
    })
}
async function transaction<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await openPuzzleDatabase()
    try {
        return await new Promise<T>((resolve, reject) => {
            const tx = db.transaction('state', mode)
            const request = action(tx.objectStore('state'))
            tx.oncomplete = () => resolve(request.result)
            tx.onabort = () => reject(tx.error ?? new Error('Puzzle storage was interrupted.'))
            tx.onerror = () => reject(tx.error)
        })
    } finally { db.close() }
}
export async function saveCollection(collection: PuzzleCollection): Promise<void> {
    await transaction('readwrite', store => store.put(collection, 'collection'))
}
export function imageBlob(value: unknown): Blob {
    if (typeof value !== 'string' || value.length > 3_000_000 || !/^data:image\/(png|jpeg|webp);base64,/.test(value)) throw new Error('Invalid image')
    const [header, data] = value.split(',')
    const bytes = Uint8Array.from(atob(data), c => c.charCodeAt(0))
    return new Blob([bytes], { type: header.slice(5, header.indexOf(';')) })
}
export async function loadCollection(): Promise<PuzzleCollection> {
    const existing = await transaction<PuzzleCollection | undefined>('readonly', store => store.get('collection'))
    if (existing) return existing
    let legacy: string | null = null
    try { legacy = localStorage.getItem(LEGACY_KEY) } catch { /* No legacy storage. */ }
    const empty: PuzzleCollection = { pictures: [], size: 3, preview: false }
    if (!legacy) return empty
    let migrated: PuzzleCollection
    try {
        const parsed = JSON.parse(legacy)
        migrated = { pictures: parsed.pictures.slice(0, 20).map((p: { name: string; image: string }, index: number) => ({
            id: `legacy-${index}`, name: String(p.name).slice(0, 200), blob: imageBlob(p.image)
        })), size: [3, 4, 5].includes(parsed.size) ? parsed.size : 3, preview: false }
    } catch { return empty }
    await saveCollection(migrated)
    // Remove the old image data only after the IndexedDB transaction commits.
    try { localStorage.removeItem(LEGACY_KEY) } catch { /* Migration is already durable. */ }
    return migrated
}

/** IDs also work on local kiosk HTTP pages where randomUUID is unavailable. */
export function createPictureId(): string {
    return globalThis.crypto?.randomUUID?.() ?? `picture-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`
}
