export function drawBalloon(ctx, balloon) {
    ctx.save();
    // Body
    ctx.beginPath();
    ctx.ellipse(balloon.x, balloon.y, balloon.radius * 0.8, balloon.radius, 0, 0, Math.PI * 2);
    ctx.fillStyle = balloon.color;
    ctx.fill();
    // Knot
    ctx.beginPath();
    ctx.moveTo(balloon.x, balloon.y + balloon.radius);
    ctx.lineTo(balloon.x - 6, balloon.y + balloon.radius + 10);
    ctx.lineTo(balloon.x + 6, balloon.y + balloon.radius + 10);
    ctx.closePath();
    ctx.fillStyle = balloon.color;
    ctx.fill();
    // Highlight
    ctx.beginPath();
    ctx.ellipse(balloon.x - balloon.radius * 0.25, balloon.y - balloon.radius * 0.3, balloon.radius * 0.1, balloon.radius * 0.22, -0.4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.fill();
    ctx.restore();
}
