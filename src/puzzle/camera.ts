/** Local camera frames only; media is never recorded or uploaded. */
export function createPuzzleCamera(onFrame: (frame: string) => void, onError: (message: string) => void): { start(): Promise<void>; stop(): void } {
    let stream: MediaStream | null = null, timer: ReturnType<typeof setTimeout> | undefined, token = 0
    let video: HTMLVideoElement | null = null
    const stop = (): void => {
        token++; clearTimeout(timer)
        stream?.getTracks().forEach(track => track.stop()); stream = null
        if (video) { video.pause(); video.srcObject = null; video = null }
    }
    return {
        stop,
        async start() {
            stop()
            const request = token
            try {
                if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera needs HTTPS or localhost and a supported browser.')
                const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } }, audio: false })
                if (request !== token) { media.getTracks().forEach(track => track.stop()); return }
                stream = media
                const player = document.createElement('video'); video = player
                player.muted = true; player.playsInline = true; player.srcObject = media
                await player.play()
                if (request !== token) return
                const canvas = document.createElement('canvas'); canvas.width = canvas.height = 480
                const context = canvas.getContext('2d')
                if (!context) throw new Error('Camera image canvas is unavailable.')
                const frame = (): void => {
                    if (request !== token) return
                    if (player.videoWidth && player.videoHeight) {
                        const side = Math.min(player.videoWidth, player.videoHeight)
                        context.drawImage(player, (player.videoWidth - side) / 2, (player.videoHeight - side) / 2, side, side, 0, 0, 480, 480)
                        onFrame(canvas.toDataURL('image/jpeg', .75))
                    }
                    timer = setTimeout(frame, 100)
                }
                frame()
                for (const track of media.getVideoTracks()) track.onended = () => { if (request === token) { stop(); onError('Camera disconnected. Select Live camera to try again.') } }
            } catch (error) {
                if (request !== token) return
                stop()
                onError(error instanceof Error ? error.message : 'Could not open the camera. Allow camera access and try again.')
            }
        }
    }
}
