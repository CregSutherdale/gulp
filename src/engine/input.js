// Unified steering input: floating touch/mouse joystick (drag anywhere), keyboard,
// and gamepad. Output is a world-space direction {x, z} with length 0..1.
export class Input {
  constructor(el, stickEl) {
    this.x = 0; this.z = 0; this.el = el; this.stick = stickEl;
    this.keys = new Set(); this.drag = null; this.enabled = false;
    this.maxPx = 58;
    el.addEventListener('pointerdown', (e) => {
      if (!this.enabled) return;
      el.setPointerCapture?.(e.pointerId);
      this.drag = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY };
      this.showStick();
    });
    el.addEventListener('pointermove', (e) => {
      if (!this.drag || e.pointerId !== this.drag.id) return;
      this.drag.x = e.clientX; this.drag.y = e.clientY;
      // Let the anchor trail behind a long drag so reversing direction is instant.
      const dx = this.drag.x - this.drag.ox, dy = this.drag.y - this.drag.oy, d = Math.hypot(dx, dy);
      if (d > this.maxPx) { const k = (d - this.maxPx) / d; this.drag.ox += dx * k; this.drag.oy += dy * k; }
      this.showStick();
    });
    const end = (e) => { if (this.drag && e.pointerId === this.drag.id) { this.drag = null; this.showStick(); } };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
    addEventListener('keydown', (e) => this.keys.add(e.code));
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => { this.keys.clear(); this.drag = null; });
  }
  showStick() {
    const s = this.stick; if (!s) return;
    if (!this.drag) { s.style.opacity = 0; return; }
    s.style.opacity = 1;
    s.style.transform = `translate(${this.drag.ox}px, ${this.drag.oy}px)`;
    const knob = s.firstElementChild;
    knob.style.transform = `translate(${this.drag.x - this.drag.ox}px, ${this.drag.y - this.drag.oy}px)`;
  }
  poll() {
    let x = 0, z = 0;
    if (this.drag) {
      const dx = this.drag.x - this.drag.ox, dy = this.drag.y - this.drag.oy;
      const d = Math.hypot(dx, dy);
      if (d > 6) { const m = Math.min(1, d / (this.maxPx * 0.6)); x = (dx / d) * m; z = (dy / d) * m; }
    }
    const k = this.keys;
    const kx = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    const kz = (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) - (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0);
    if (kx || kz) { const n = Math.hypot(kx, kz); x = kx / n; z = kz / n; }
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p) continue;
      const gx = p.axes[0] || 0, gz = p.axes[1] || 0, d = Math.hypot(gx, gz);
      if (d > 0.18) { const m = Math.min(1, (d - 0.18) / 0.7); x = (gx / d) * m; z = (gz / d) * m; }
    }
    this.x = x; this.z = z;
    return this;
  }
  // Edge-triggered gamepad buttons for menus: returns 'a' | 'b' | 'start' | null.
  padButton() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let pressed = null;
    for (const p of pads) {
      if (!p) continue;
      const now = { a: p.buttons[0]?.pressed, b: p.buttons[1]?.pressed, start: p.buttons[9]?.pressed };
      const prev = this._pad || {};
      for (const k of ['a', 'b', 'start']) if (now[k] && !prev[k]) pressed = k;
      this._pad = now;
    }
    return pressed;
  }
}
