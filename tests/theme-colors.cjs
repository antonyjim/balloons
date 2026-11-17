const { test } = require('node:test')
const assert = require('node:assert/strict')
const { getRandomLatexColor, hexToHsl, pastelPalette, varyColor } = require('../dist-ts/theme/colors')
const { themes } = require('../dist-ts/theme/themes')
test('latex stays richly pastel across every theme, including dark night colors', () => {
    let seed = 123
    const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 }
    const hues = new Set(), colors = new Set()
    for (const theme of Object.values(themes)) for (let i = 0; i < 200; i++) {
        const color = getRandomLatexColor(theme, random), hsl = hexToHsl(color)
        assert.ok(hsl.s >= 69 && hsl.s <= 95)
        assert.ok(hsl.l >= 63.5 && hsl.l <= 80.5)
        hues.add(Math.floor(hsl.h / 30)); colors.add(color)
    }
    assert.ok(hues.size >= 10, 'pastel selection spans the color wheel')
    assert.ok(colors.size > 500, 'small variations keep individual balloons distinct')
})
test('all themes offer the expanded pastels and general variation avoids muddy colors', () => {
    for (const theme of Object.values(themes)) for (const color of pastelPalette) assert.ok(theme.palette.includes(color))
    for (let i = 0; i < 50; i++) assert.ok(hexToHsl(varyColor('#999999')).s >= 39)
    assert.match(getRandomLatexColor({ palette: [] }), /^#[0-9a-f]{6}$/)
})
