// Lightweight canvas confetti for wins.
const COLORS = ['#ff5fa2', '#ffc93c', '#2fd39a', '#48b8ff', '#8c6cff', '#ff7a59'];
export class Confetti {
  constructor(cv) { this.cv = cv; this.ctx = cv.getContext('2d'); this.p = []; this.resize(); addEventListener('resize', () => this.resize()); }
  resize() { const d = Math.min(devicePixelRatio, 2); this.d = d; this.cv.width = innerWidth * d; this.cv.height = innerHeight * d; }
  burst(n = 140) {
    for (let i = 0; i < n; i++) {
      const left = i % 2 === 0;
      this.p.push({
        x: left ? -10 : innerWidth + 10, y: innerHeight * (0.55 + Math.random() * 0.3),
        vx: (left ? 1 : -1) * (180 + Math.random() * 360), vy: -(420 + Math.random() * 520),
        r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 14, w: 7 + Math.random() * 7, h: 4 + Math.random() * 5,
        c: COLORS[i % COLORS.length], life: 2.6 + Math.random(),
      });
    }
  }
  update(dt) {
    const c = this.ctx;
    if (!this.p.length) { if (this.dirty) { c.clearRect(0, 0, this.cv.width, this.cv.height); this.dirty = false; } return; }
    this.dirty = true;
    c.setTransform(this.d, 0, 0, this.d, 0, 0);
    c.clearRect(0, 0, innerWidth, innerHeight);
    this.p = this.p.filter((p) => (p.life -= dt) > 0);
    for (const p of this.p) {
      p.vy += 900 * dt; p.vx *= 1 - dt * 1.2; p.vy *= 1 - dt * 0.6;
      p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt;
      c.save(); c.translate(p.x, p.y); c.rotate(p.r); c.globalAlpha = Math.min(1, p.life);
      c.fillStyle = p.c; c.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 2)));
      c.restore();
    }
  }
}
