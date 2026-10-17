export type ThemeId = 'dawn' | 'day' | 'sunset' | 'night'
export type BalloonFinish =
    | 'latex'
    | 'hot-air'
    | 'bubble'
    | 'paint'
    | 'watermelon'
    | 'apple'
    | 'duck'

export type ThemeMode = 'auto' | ThemeId
export type FinishMode = 'auto' | 'random' | BalloonFinish

export interface Theme {
    id: ThemeId
    name: string
    background: string
    gradient: string
    palette: readonly string[]
    finish: BalloonFinish
}

export interface ThemeState {
    mode: ThemeMode
    finishMode: FinishMode
    theme: Theme
    finish: BalloonFinish
}
