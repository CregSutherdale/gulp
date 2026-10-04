import { makeHoleMesh } from '../engine/render.js';

export const R0 = 0.5;          // starting radius
export const GROW = 0.0436;     // r^2 grows linearly with eaten value: area ~ value
export const radiusFor = (mass) => Math.sqrt(R0 * R0 + GROW * mass);

export class Hole {
  constructor(k, phys, scene, { name, color, isPlayer = false, x = 0, z = 0, skin = null, growMul = 1 }) {
    this.growMul = growMul; // < 1 = grows slower (Challenge difficulty)
    this.k = k; this.phys = phys; this.name = name; this.color = color; this.isPlayer = isPlayer;
    this.x = x; this.z = z; this.vx = 0; this.vz = 0;
    this.mass = 0; this.score = 0; this.r = R0; this.rShown = R0;
    this.alive = true; this.respawnT = 0; this.ghostT = 0; this.pulse = 0;
    this.combo = 0; this.comboT = 0;
    this.ring = phys.createRing(k);
    this.mesh = makeHoleMesh(color);
    if (skin) skin(this.mesh);
    scene.add(this.mesh);
    this.applyRadius(true);
  }
  get target() { return Math.sqrt(R0 * R0 + GROW * this.growMul * this.mass); }
  massFor(r) { return (r * r - R0 * R0) / (GROW * this.growMul); }
  depth() { return 3 + this.rShown * 2.6; }
  // Smoothly approach the target radius; rebuild the physical ring when the shown
  // radius drifts more than 2% from it so the ground cut and the real opening agree.
  applyRadius(force = false, dt = 0) {
    const t = this.target;
    if (force) this.rShown = t;
    else this.rShown += (t - this.rShown) * Math.min(1, dt * 5);
    if (force || Math.abs(this.rShown - this.ring.r) / this.ring.r > 0.02) {
      this.phys.rebuildRing(this.ring, this.rShown, this.depth());
    }
    this.r = this.ring.r;
  }
  feed(value) {
    this.mass += value; this.score += value;
    this.pulse = 1;
    this.combo = this.comboT > 0 ? this.combo + 1 : 1;
    this.comboT = 1.1;
  }
  place(x, z) { this.x = x; this.z = z; this.phys.moveRing(this.ring, x, z); }
  updateVisual(dt, time) {
    this.pulse = Math.max(0, this.pulse - dt * 3.5);
    this.comboT = Math.max(0, this.comboT - dt);
    const m = this.mesh, u = m.userData;
    m.visible = this.alive;
    const bump = 1 + this.pulse * 0.06;
    m.position.set(this.x, 0, this.z);
    m.scale.set(this.rShown * bump, 1, this.rShown * bump);
    u.depthGroup.scale.y = this.depth();
    u.halo.rotation.y = time * 0.4;
    u.haloMat.opacity = 0.45 + this.pulse * 0.4 + (this.ghostT > 0 ? Math.sin(time * 20) * 0.3 : 0);
    u.rimMat.opacity = this.ghostT > 0 ? 0.4 + 0.4 * Math.sin(time * 20) : 0.95;
  }
}
