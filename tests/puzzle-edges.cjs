const { test } = require('node:test')
const assert = require('node:assert/strict')
const { piecePath, jigsawEdge } = require('../dist-ts/puzzle/game')
function curves(row, col, size, seed) {
    let point
    const result = []
    for (const [, command, values] of piecePath(row, col, size, seed).matchAll(/([MLCZ])([^MLCZ]*)/g)) {
        const numbers = values.trim().split(/\s+/).map(Number)
        if (command === 'M' || command === 'L') point = [numbers[0] + col * 100, numbers[1] + row * 100]
        if (command === 'C') {
            const points = [point]
            for (let i = 0; i < 6; i += 2) points.push([numbers[i] + col * 100, numbers[i + 1] + row * 100])
            result.push(points); point = points[3]
        }
    }
    return result
}
function matches(a, b) {
    const reverse = b.toReversed().map(points => points.toReversed())
    for (let i = 0; i < a.length; i++) for (let j = 0; j < 4; j++) for (let k = 0; k < 2; k++) {
        assert.ok(Math.abs(a[i][j][k] - reverse[i][j][k]) < 1e-8, 'shared cuts must coincide in reverse directions')
    }
}
test('randomized tabs and sockets fit exactly across every shared edge at every grid size', () => {
    for (const size of [3, 4, 5]) for (const seed of ['round-one', 'round-two', 'camera']) {
        for (let row = 0; row < size; row++) for (let col = 0; col < size; col++) {
            const piece = curves(row, col, size, seed)
            if (col < size - 1) {
                const offset = row > 0 ? 5 : 0
                matches(piece.slice(offset, offset + 5), curves(row, col + 1, size, seed).slice(-5))
            }
            if (row < size - 1) {
                const offset = (row > 0 ? 5 : 0) + (col < size - 1 ? 5 : 0)
                matches(piece.slice(offset, offset + 5), curves(row + 1, col, size, seed).slice(0, 5))
            }
        }
    }
})
test('round IDs preserve restored shapes while new rounds vary inserts and socket directions', () => {
    assert.equal(piecePath(1, 1, 4, 'saved-round'), piecePath(1, 1, 4, 'saved-round'))
    assert.notEqual(piecePath(1, 1, 4, 'saved-round'), piecePath(1, 1, 4, 'new-round'))
    const edges = Array.from({ length: 30 }, (_, i) => jigsawEdge('round', 'h', i, 0))
    assert.deepEqual(new Set(edges.map(edge => edge.sign)), new Set([-1, 1]))
    assert.ok(new Set(edges.map(edge => edge.center)).size > 20)
})


test('pieces have large inserts and curved shoulders instead of square internal edges', () => {
    const path = piecePath(1, 1, 3, 'visible-jigsaw')
    assert.equal((path.match(/L /g) ?? []).length, 0, 'interior pieces have no straight edges')
    const edges = Array.from({ length: 20 }, (_, i) => jigsawEdge('visible-jigsaw', 'h', i, 0))
    assert.ok(edges.every(edge => edge.depth >= 25 && edge.radius >= 15 && edge.bow >= 4))
})
