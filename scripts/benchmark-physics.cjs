const { performance } = require('node:perf_hooks')
const { updateBalloonPhysics } = require('../dist-ts/physics')
const { defaultBalloonConfig } = require('../dist-ts/objects/balloon')
function run(finish, count = 300, radius = 28, width = 1600, height = 1000, dt = 1 / 60) {
    const bodies = Array.from({ length: count }, (_, i) => ({
        x: 100 + (i % 20) * 70, y: 100 + Math.floor(i / 20) * 50,
        vx: (i % 7) * 5, vy: 0, angle: 0, angularVelocity: 0,
        anchorX: i * 7, anchorY: i * 11, pointerId: null,
        radius, color: '#ff8800', finish,
        growing: false, popped: false, popTime: 0
    }))
    for (let i = 0; i < 100; i++) updateBalloonPhysics(bodies, dt, width, height, defaultBalloonConfig)
    const samples = []
    for (let i = 0; i < 400; i++) {
        const start = performance.now()
        updateBalloonPhysics(bodies, dt, width, height, defaultBalloonConfig)
        samples.push(performance.now() - start)
    }
    samples.sort((a, b) => a - b)
    console.log(`${finish}: ${count} objects, radius ${radius}, ${width}x${height}, median ${samples[200].toFixed(2)}ms, p95 ${samples[380].toFixed(2)}ms`)
}
run('latex')
run('hot-air')
run('hot-air', 250, 60, 900, 650, 1 / 30)
