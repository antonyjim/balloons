let tiltX = 0
let targetTiltX = 0
let enabled = false

const MAX_TILT = 35

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value))
}

export function onOrientation(event: DeviceOrientationEvent): void {
    if (event.beta === null || event.gamma === null) return

    const angle = screen.orientation?.angle ??
        (typeof window.orientation === 'number'
            ? window.orientation
            : 0)

    const radians = angle * Math.PI / 180

    // Transform tilt into screen coordinates
    const x =
        event.gamma * Math.cos(radians) -
        event.beta * Math.sin(radians)

    targetTiltX = clamp(x / MAX_TILT, -1, 1)
}

let permissionPending: Promise<boolean> | null = null
export function enableDeviceMotion(): Promise<boolean> {
    if (enabled) return Promise.resolve(true)
    if (permissionPending) return permissionPending
    const Orientation = window.DeviceOrientationEvent as (typeof DeviceOrientationEvent & { requestPermission?: () => Promise<string> }) | undefined
    if (!Orientation) return Promise.resolve(false)
    const attach = (): boolean => { window.addEventListener('deviceorientation', onOrientation); enabled = true; return true }
    if (!Orientation.requestPermission) return Promise.resolve(attach())
    // Invoke synchronously within a tap, before any await loses user activation.
    try {
        permissionPending = Orientation.requestPermission().then(result => result === 'granted' ? attach() : false)
            .catch(() => false).finally(() => { permissionPending = null })
        return permissionPending
    } catch { return Promise.resolve(false) }
}

export function updateDeviceMotion(dt: number): void {
    const smoothing = 1 - Math.exp(-4 * dt)
    tiltX += (targetTiltX - tiltX) * smoothing
}

export function getDeviceTilt(): number {
    return tiltX
}