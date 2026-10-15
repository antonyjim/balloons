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

// export async function enableDeviceMotion(): Promise<boolean> {
//     if (!('DeviceOrientationEvent' in window)) {
//         return false
//     }
//     if (enabled) return true



//     const Orientation = DeviceOrientationEvent as typeof DeviceOrientationEvent & {
//         requestPermission?: () => Promise<string>
//     }

//     if (typeof Orientation.requestPermission === 'function') {
//         try {
//             const permission = await Orientation.requestPermission()
//             if (permission !== 'granted') {
//                  return false
//             }
//         } catch (err: any) {
//             return false
//         }
//     }

//     window.addEventListener('deviceorientation', onOrientation)
//     enabled = true

//     return true
// }

export function updateDeviceMotion(dt: number): void {
    const smoothing = 1 - Math.exp(-4 * dt)
    tiltX += (targetTiltX - tiltX) * smoothing
}

export function getDeviceTilt(): number {
    return tiltX
}