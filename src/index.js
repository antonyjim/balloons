import { drawBalloon } from './balloon';
const canvas = document.querySelector('#app');
if (!canvas) {
    throw new Error('Canvas not found');
}
const ctx = canvas.getContext('2d');
if (!ctx) {
    throw new Error('2D canvas unavailable');
}
const balloons = [];
function resize() {
    if (!canvas || !ctx)
        return;
    const dpr = window.devicePixelRatio || 1;
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
canvas.addEventListener('pointerdown', event => {
    const rect = canvas.getBoundingClientRect();
    balloons.push({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
        radius: 40,
        color: '#e53935'
    });
});
function render() {
    if (!ctx)
        return;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    for (const balloon of balloons) {
        drawBalloon(ctx, balloon);
    }
}
function frame() {
    render();
    requestAnimationFrame(frame);
}
window.addEventListener('resize', resize);
resize();
requestAnimationFrame(frame);
