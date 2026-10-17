import type { Theme, ThemeId } from './types'


export const themes = {
    dawn: {
        id: 'dawn',
        name: 'Dawn',
        background: '/backgrounds/dawn.webp',
        gradient: 'linear-gradient(#71a7d8, #f8b5a2)',
        palette: [
            '#f6bbd6', '#c6b2f1', '#a2d9d5', '#ffe0ac',
            '#f7a8c4', '#eab6ff', '#9fd4f2', '#ffd3a8',
            '#ffb7b2', '#d8c3ff', '#b9ead7', '#ffe7b8',
            '#f4c2c2', '#b8d8ff', '#f9d5a7', '#e6b3cc',
            '#d4b5ff', '#a7e0dc', '#ffd6c0', '#fbc4ab',
            '#cde7ff', '#e2c2ff', '#d9f0c7', '#ffe0b2',
            '#f8bbd0', '#c5cae9', '#b2dfdb', '#fff1b8',
            '#f5b7b1', '#d1c4e9', '#aed9e0', '#fdd9a0'
        ],
        finish: 'hot-air'
    },

    day: {
        id: 'day',
        name: 'Day',
        background: '/backgrounds/day.webp',
        gradient: 'linear-gradient(#238cf0, #c5edff)',
        palette: [
            '#f44366', '#ffb943', '#8b66ed', '#44cda5', '#f46ecb',
            '#ff5252', '#ff7043', '#ffca28', '#66bb6a', '#26c6da',
            '#29b6f6', '#42a5f5', '#5c6bc0', '#7e57c2', '#ab47bc',
            '#ec407a', '#ef5350', '#ffa726', '#d4e157', '#9ccc65',
            '#26a69a', '#26c6da', '#00acc1', '#1e88e5', '#7cb342',
            '#c0ca33', '#fdd835', '#fb8c00', '#f4511e', '#8e24aa',
            '#d81b60', '#43a047', '#00bfa5', '#00e5ff', '#7c4dff'
        ],
        finish: 'latex'
    },

    sunset: {
        id: 'sunset',
        name: 'Sunset',
        background: '/backgrounds/sunset.webp',
        gradient: 'linear-gradient(#8563a6, #ff9a72)',
        palette: [
            '#f4ac65', '#f06f85', '#b87bdd', '#ffdd85',
            '#ff9e7a', '#ffb3c1', '#c79bff', '#ffd6a5',
            '#ffc09f', '#f497b6', '#cdb4db', '#ffe29a',
            '#ff8fab', '#f6bd60', '#e5989b', '#b8c0ff',
            '#ffd166', '#f28482', '#d0a2f7', '#f7b267',
            '#ffcad4', '#f4a261', '#e76f51', '#e9c46a',
            '#f1a7c4', '#c77dff', '#ffcb77', '#ffaaa5',
            '#f2c6de', '#f7a072', '#d291bc', '#ffe5a5'
        ],
        finish: 'bubble'
    },

    night: {
        id: 'night',
        name: 'Night',
        background: '/backgrounds/night.webp',
        gradient: 'linear-gradient(#11275d, #6153a4)',
        palette: [
            '#b077ef', '#3de5d1', '#fa7cce', '#648cff',
            '#9b5de5', '#00bbf9', '#00f5d4', '#f15bb5',
            '#7b2cbf', '#5a189a', '#4895ef', '#4cc9f0',
            '#56cfe1', '#72efdd', '#80ffdb', '#c77dff',
            '#e0aaff', '#f72585', '#b5179e', '#7209b7',
            '#4361ee', '#4ea8de', '#64dfdf', '#155724',
            '#a3c4f3', '#b9fbc0', '#ffc6ff', '#ffd6ff',
            '#90dbf4', '#98f5e1', '#a9def9', '#caffbf',
            '#f4ac65', '#f06f85', '#b87bdd', '#ffdd85',
            '#ff9e7a', '#ffb3c1', '#c79bff', '#ffd6a5',
            '#ffc09f', '#f497b6', '#cdb4db', '#ffe29a',
            '#ff8fab', '#f6bd60', '#e5989b', '#b8c0ff',
            '#ffd166', '#f28482', '#d0a2f7', '#f7b267',
            '#ffcad4', '#f4a261', '#e76f51', '#e9c46a',
            '#f1a7c4', '#c77dff', '#ffcb77', '#ffaaa5',
            '#f2c6de', '#f7a072', '#d291bc', '#ffe5a5'
        ],
        finish: 'latex'
    }
} as const


export function themeForTime(date = new Date()): ThemeId {
    const hour = date.getHours() + date.getMinutes() / 60

    if (hour >= 5 && hour < 8) return 'dawn'
    if (hour >= 8 && hour < 17) return 'day'
    if (hour >= 17 && hour < 20) return 'sunset'
    return 'night'
}
