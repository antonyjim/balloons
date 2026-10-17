// assets.d.ts

declare module '*.wav' {
    const url: string
    export default url
}

declare module '*.mp3' {
    const url: string
    export default url
}

declare module '*.ogg' {
    const url: string
    export default url
}
declare module 'sketchpad-markup' { const value: string; export default value }
declare module 'sketchpad-styles' { const value: string; export default value }

declare module 'matching-styles' { const value: string; export default value }
