// One round of play: holes, the swallow physics rules, NPC motion, AI rivals,
// targets/timer. Modes: 'level' (target list + timer), 'zen' (endless city, no
// timer), 'race' (city vs rival holes, 2 minutes).
import * as THREE from 'three';
import { R, objOnRing, groups, OBJ_BIT } from '../engine/physics.js';
import { holeUniform, MAX_HOLES } from '../engine/render.js';
import { World } from './world.js';
import { Hole } from './hole.js';
import { buildMap, MAPS } from './maps.js';
import { buildLevel, WORLDS } from './levelbuild.js';
import { THEMES } from './themes.js';

const ZONE_PAD = 3.2;      // how far outside the rim objects switch onto the ring
const NPC_RADIUS = 60;     // NPCs farther than this from the player stay frozen
export const FIT = 0.9;    // an object drops in when fit <= FIT * hole diameter
const FALLTHROUGH = groups(OBJ_BIT, OBJ_BIT); // touches nothing but other objects (and never walls: it's already in the shaft)

export class Round {
  constructor({ phys, renderer, kind, level, mapId, rivals = [], playerName, playerColor, skin, events, autoSteer = false, timeScale = 1 }) {
    this.phys = phys; this.renderer = renderer; this.kind = kind; this.events = events;
    this.level = level; this.autoSteer = autoSteer;
    this.time = 0; this.over = false; this.idleT = 0; this.paused = false;
    this.boost = { magnetT: 0, freezeT: 0 };
    this.overview = kind === 'level'; this.swoopT = 0;
    let data;
    if (kind === 'level' || kind === 'zenworld') {
      data = buildLevel(level); data.world = level.world;
      this.theme = WORLDS[level.world];
      this.duration = kind === 'level' ? Math.round(level.time * timeScale) : 0;
    } else {
      const map = MAPS[mapId];
      this.theme = THEMES[map.theme];
      data = buildMap(mapId, this.theme);
      this.duration = kind === 'race' ? 120 : 0;
    }
    this.left = this.duration;
    renderer.setTheme(this.theme);
    this.world = new World(phys, renderer.scene, data, this.theme);
    this.bounds = { x: this.world.size.w / 2 - 0.3, z: this.world.size.d / 2 - 0.3 };
    phys.setWalls(this.world.size.w / 2, this.world.size.d / 2);
    this.holes = [];
    this.player = this.addHole({ name: playerName, color: playerColor, isPlayer: true, skin });
    for (const rv of rivals) this.addHole(rv);
    this.spreadHoles();
    this.zoneOf = new Map();
    this.camPos = new THREE.Vector3(); this.camLook = new THREE.Vector3();
    this.camR = this.player.rShown; this.camRT = 0;
    this.settle();
    this.targets = kind === 'level' ? this.makeTargets(level.targets) : null;
    this.snapCamera();
  }

  makeTargets(list) {
    return list.map((t) => {
      const match = (o) => o.prop.id === t.id && (t.tint === undefined || o.tint === t.tint);
      const total = this.world.objects.filter(match).length;
      const need = t.n === 'all' ? total : Math.min(t.n, total);
      return { ...t, match, need, need0: need, got: 0 };
    });
  }
  // Let freshly spawned props settle, then put them all to sleep so the round
  // starts perfectly still.
  settle() {
    for (let i = 0; i < 20; i++) this.phys.step();
    for (const o of this.world.objects) {
      const t = o.body.translation();
      if (t.y < -1) { this.world.eat(o); continue; }
      o.body.setLinvel({ x: 0, y: 0, z: 0 }, false); o.body.setAngvel({ x: 0, y: 0, z: 0 }, false);
      o.body.sleep();
      this.world.writeMatrix(o);
    }
    for (const m of this.world.meshes.values()) m.instanceMatrix.needsUpdate = true;
  }

  addHole(o) {
    const h = new Hole(this.holes.length, this.phys, this.renderer.scene, o);
    h.ai = !o.isPlayer ? { tx: 0, tz: 0, think: 0, skill: o.skill ?? 0.8, ix: 0, iz: 0 } : null;
    this.holes.push(h);
    return h;
  }
  spreadHoles() {
    const n = this.holes.length;
    this.holes.forEach((h, i) => {
      if (h.isPlayer) {
        const s = this.level ? this.level.start : [0, 0];
        h.place(s[0], s[1]); return;
      }
      const a = (i / n) * Math.PI * 2;
      const rr = Math.min(this.bounds.x, this.bounds.z) * 0.62;
      h.place(Math.cos(a) * rr, Math.sin(a) * rr);
    });
  }

  // ------------------------------------------------------------------ update
  update(dt, input) {
    if (this.over || this.paused) return;
    this.time += dt;
    if (this.boost.freezeT > 0) { this.boost.freezeT -= dt; this.frozen = (this.frozen || 0) + dt; if (this.duration) this.duration += dt; }
    if (this.boost.magnetT > 0) { this.boost.magnetT -= dt; this.magnet(dt); }
    if (this.duration) {
      this.left = Math.max(0, this.duration - this.time);
      if (this.left <= 0) { this.timeUp(); return; }
    }
    this.moveHoles(dt, input);
    this.updateZones(dt);
    this.updateNPCs(dt);
    const steps = Math.max(1, Math.min(2, Math.round(dt * 60)));
    for (let i = 0; i < steps; i++) this.phys.step();
    this.checkEaten(dt);
    this.checkHoleVsHole();
    this.world.sync(dt);
    if (this.kind === 'zenworld') this.zenTick(dt);
    for (const h of this.holes) {
      const before = h.target;
      h.applyRadius(false, dt); h.updateVisual(dt, this.time);
      if (h.isPlayer && h.sizeLevel !== undefined && this.sizeLevel(h) > h.sizeLevel) this.events.sizeUp?.(h, this.sizeLevel(h));
      h.sizeLevel = this.sizeLevel(h);
      void before;
    }
    this.writeHoleUniforms();
    this.updateCamera(dt);
    if (this.kind === 'zen' && this.world.eatenValue >= this.world.totalValue * 0.985) this.finish('cleared');
  }

  // Zen boards never run out: eaten things come back after a while, away from the
  // hole, with a pop. The hole stops growing at a cozy size for the board.
  zenTick(dt) {
    this.zenT = (this.zenT || 0) - dt;
    const p = this.player, capR = 3.4;
    const capMass = (capR * capR - 0.25) / 0.0436;
    if (p.mass > capMass) p.mass = capMass;
    if (this.zenT > 0) return;
    this.zenT = 0.5;
    let n = 0;
    for (const o of this.world.objects) {
      if (!o.eaten || !o.respawnAt || o.respawnAt > this.time) continue;
      if (Math.hypot(o.home[0] - p.x, o.home[1] - p.z) < p.r + o.prop.fit + 2) continue;
      this.world.revive(o); o.respawnAt = 0;
      if (++n >= 6) break; // trickle back, never all at once
    }
  }
  sizeLevel(h) { return Math.max(1, Math.floor(Math.log(h.target / 0.5) / Math.log(1.22)) + 1); }

  speedFor(h) { return 5.0 + Math.min(h.rShown, 8) * 0.5; }

  moveHoles(dt, input) {
    for (const h of this.holes) {
      if (!h.alive) {
        h.respawnT -= dt;
        if (h.respawnT <= 0) this.respawn(h);
        continue;
      }
      h.ghostT = Math.max(0, h.ghostT - dt);
      let ix = 0, iz = 0, speedK = 1;
      if (h.isPlayer) {
        ix = input.x; iz = input.z;
        const active = Math.hypot(ix, iz) > 0.05;
        this.idleT = active ? 0 : this.idleT + dt;
        if (!active && this.autoSteer && this.idleT > 1.2) {
          this.think(h, dt); ix = h.ai.ix; iz = h.ai.iz; speedK = 0.6;
        }
      } else {
        this.think(h, dt); ix = h.ai.ix; iz = h.ai.iz;
        speedK = 0.86 + h.ai.skill * 0.1;
      }
      const sp = this.speedFor(h) * speedK;
      const k = Math.min(1, dt * 9); // ease toward the desired velocity so the hole glides
      h.vx += (ix * sp - h.vx) * k; h.vz += (iz * sp - h.vz) * k;
      const lim = h.rShown * 0.35;
      const x = THREE.MathUtils.clamp(h.x + h.vx * dt, -this.bounds.x + lim, this.bounds.x - lim);
      const z = THREE.MathUtils.clamp(h.z + h.vz * dt, -this.bounds.z + lim, this.bounds.z - lim);
      h.place(x, z);
    }
  }

  fits(o, h) { return o.prop.fit <= h.r * 2 * FIT; }

  // Decide which objects stand on which hole's ring (and so can fall in).
  updateZones(dt) {
    const best = new Map();
    const wob = []; // too-big objects to jiggle AFTER the query (Rapier forbids mutation inside it)
    const w = this.phys.world;
    const rot = { x: 0, y: 0, z: 0, w: 1 };
    for (const h of this.holes) {
      if (!h.alive) continue;
      const shape = new R.Cylinder(8, h.r + ZONE_PAD);
      w.intersectionsWithShape({ x: h.x, y: 0, z: h.z }, rot, shape, (col) => {
        const o = this.world.byHandle.get(col.handle);
        if (!o || o.eaten || o.captured >= 0) return true;
        const t = o.body.translation();
        const d = Math.hypot(t.x - h.x, t.z - h.z);
        if (!this.fits(o, h)) {
          if (d < h.r * 0.95) wob.push(o, h);
          return true;
        }
        const score = d / h.r;
        const cur = best.get(o);
        if (!cur || score < cur.score) best.set(o, { h, d, score, t });
        return true;
      });
    }
    for (let i = 0; i < wob.length; i += 2) this.wobble(wob[i], wob[i + 1], dt);
    for (const [o] of this.zoneOf) if (!best.has(o) && o.captured < 0 && !o.eaten) this.world.setOnGround(o);
    this.zoneOf = best;
    for (const [o, z] of best) {
      const { h, d, t } = z;
      if (o.ring !== h.k) { o.ring = h.k; o.collider.setCollisionGroups(objOnRing(h.k)); }
      if (d < h.r + 0.6) {
        if (o.body.isSleeping()) o.body.wakeUp();
        if (o.locked) { o.body.lockRotations(false, true); o.locked = false; }
        // A gentle pull toward the middle once the center of mass is over the rim:
        // physics alone works, but this makes the gulp feel decisive, not fiddly.
        if (d < h.r * 1.02) {
          const m = o.prop.mass, s = Math.min(1, (h.r - d) / h.r + 0.3);
          const dx = h.x - t.x, dz = h.z - t.z, inv = 1 / Math.max(0.001, Math.hypot(dx, dz));
          o.body.applyImpulse({ x: dx * inv * m * 5.0 * s * dt, y: -m * 8 * dt, z: dz * inv * m * 5.0 * s * dt }, true);
        }
      }
      if ((t.y < o.hh - 0.12 && d < h.r) || t.y < -0.1) { o.captured = h.k; o.capT = 0; o.capY = t.y; }
    }
  }

  wobble(o, h, dt) {
    o.wobT = (o.wobT || 0) - dt;
    if (o.wobT > 0) return;
    o.wobT = 0.16 + Math.random() * 0.2;
    if (o.body.isSleeping()) o.body.wakeUp();
    const m = o.prop.mass * 0.06;
    o.body.applyTorqueImpulse({ x: (Math.random() - 0.5) * m, y: 0, z: (Math.random() - 0.5) * m }, true);
    if (h.isPlayer) this.events.tooBig?.(o);
  }

  updateNPCs(dt) {
    const p = this.player;
    for (const o of this.world.objects) {
      if (o.eaten || !o.locked) continue;
      if (!o.path && !o.prop.walker) continue;
      const t = o.body.translation();
      if (Math.abs(t.x - p.x) > NPC_RADIUS || Math.abs(t.z - p.z) > NPC_RADIUS) continue;
      let vx = 0, vz = 0;
      if (o.prop.walker) { // people run from any hole that could swallow them
        for (const h of this.holes) {
          if (!h.alive || !this.fits(o, h)) continue;
          const dx = t.x - h.x, dz = t.z - h.z, d = Math.hypot(dx, dz) || 1;
          const run = this.kind === 'level' ? 1.5 : 2.6;
          if (d < h.r + 3.5) { vx += (dx / d) * run; vz += (dz / d) * run; }
        }
      }
      if (!vx && !vz && o.path) {
        const P = o.path, pts = P.pts;
        const tgt = pts[P.dir > 0 ? (P.seg + 1) % 4 : P.seg];
        const dx = tgt[0] - t.x, dz = tgt[1] - t.z, d = Math.hypot(dx, dz);
        if (d < 0.4) P.seg = (P.seg + (P.dir > 0 ? 1 : 3)) % 4;
        else { vx = (dx / d) * P.speed; vz = (dz / d) * P.speed; }
      }
      if (!vx && !vz) continue;
      const v = o.body.linvel();
      o.body.setLinvel({ x: vx, y: Math.min(v.y, 0), z: vz }, true);
      const yaw = Math.atan2(vx, vz) + (o.prop.driver ? -Math.PI / 2 : 0);
      o.body.setRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) }, true);
    }
  }

  checkEaten(dt) {
    for (const o of this.world.objects) {
      if (o.eaten) continue;
      if (o.captured >= 0) { this.tryEat(o, dt); continue; }
      if (o.body.isSleeping()) continue;
      // Anything below ground went down SOME hole, even in physics edge cases where
      // no hole had claimed it. Credit the nearest hole so nothing is ever lost.
      const t = o.body.translation();
      if (t.y < -1.5) { this.rescued = (this.rescued || 0) + 1; this.credit(o, this.nearestHole(t.x, t.z), t); }
    }
    if (this.targets) {
      this.auditT = (this.auditT || 0) - dt;
      if (this.auditT <= 0) { this.auditT = 0.5; this.auditTargets(); }
    }
  }
  nearestHole(x, z) {
    let best = null, bd = Infinity;
    for (const h of this.holes) { if (!h.alive) continue; const d = Math.hypot(h.x - x, h.z - z); if (d < bd) { bd = d; best = h; } }
    return best;
  }
  credit(o, h, t) {
    this.world.eat(o);
    if (this.kind === 'zenworld') o.respawnAt = this.time + 30 + Math.random() * 30;
    this.eatenCount = (this.eatenCount || 0) + (h && h.isPlayer ? 1 : 0);
    if (!h) return;
    h.feed(o.prop.value);
    if (this.targets && h.isPlayer) {
      let hit = false;
      this.targets.forEach((tg, i) => {
        if (tg.got < tg.need && tg.match(o)) { tg.got++; hit = true; this.events.target?.(i, tg); }
      });
      if (hit && this.remaining() === 1) this.events.lastOne?.();
      this.checkWin();
    }
    this.events.ate?.(h, o, t);
  }
  checkWin() {
    if (this.targets.every((tg) => tg.got >= tg.need)) this.finish('win');
  }
  // Safety net: a level can never ask for more of something than still exists.
  auditTargets() {
    let changed = false;
    this.targets.forEach((tg, i) => {
      const left = this.world.objects.reduce((n, o) => n + (!o.eaten && tg.match(o) ? 1 : 0), 0);
      if (tg.got + left < tg.need) { tg.need = tg.got + left; changed = true; this.events.target?.(i, tg); }
    });
    if (changed) this.checkWin();
  }
  remaining() { return this.targets ? this.targets.reduce((n, t) => n + Math.max(0, t.need - t.got), 0) : 0; }
  // Remaining target objects (for the "here are the stragglers" arrows).
  leftovers() {
    if (!this.targets) return [];
    const open = this.targets.filter((tg) => tg.got < tg.need);
    return this.world.objects.filter((o) => !o.eaten && open.some((tg) => tg.match(o)));
  }
  tryEat(o, dt) {
    const t = o.body.translation();
    const h = this.holes[o.captured];
    // Below ground = swallowed. Count it even if the hole has already moved on.
    const d = Math.hypot(t.x - h.x, t.z - h.z);
    if (t.y < -(o.hh + 0.35)) {
      if (d > h.r + 0.8) this.rescued = (this.rescued || 0) + 1; // the old code dropped these
      this.credit(o, h.alive ? h : this.nearestHole(t.x, t.z), t); return;
    }
    if (d > h.r + 2 && t.y > -0.5) { o.captured = -1; return; } // slid back out over the rim
    // Unstick: anything that stops sinking for a moment drops straight through. A
    // wedged object must never block the hole.
    o.capT += dt;
    if (t.y < o.capY - 0.04) { o.capY = t.y; o.capT = 0; }
    if (o.capT > 0.7 && d < h.r) {
      o.collider.setCollisionGroups(FALLTHROUGH);
      o.body.wakeUp();
      o.body.applyImpulse({ x: 0, y: -o.prop.mass * 2, z: 0 }, true);
    }
  }

  checkHoleVsHole() {
    if (this.kind !== 'race') return;
    for (const a of this.holes) for (const b of this.holes) {
      if (a === b || !a.alive || !b.alive || b.ghostT > 0 || a.ghostT > 0) continue;
      if (a.r < b.r * 1.18) continue;
      const d = Math.hypot(a.x - b.x, a.z - b.z);
      if (d < a.r - b.r * 0.4) {
        a.feed(Math.max(6, b.mass * 0.45));
        b.alive = false; b.respawnT = 3; b.mass *= 0.3;
        this.events.holeEaten?.(a, b);
      }
    }
  }
  respawn(h) {
    let bx = 0, bz = 0, bestD = -1;
    for (let i = 0; i < 12; i++) {
      const x = (Math.random() * 2 - 1) * this.bounds.x * 0.85, z = (Math.random() * 2 - 1) * this.bounds.z * 0.85;
      const others = this.holes.filter((o) => o !== h && o.alive);
      const d = others.length ? Math.min(...others.map((o) => Math.hypot(o.x - x, o.z - z) - o.r)) : 99;
      if (d > bestD) { bestD = d; bx = x; bz = z; }
    }
    h.alive = true; h.ghostT = 2.5; h.vx = h.vz = 0;
    h.place(bx, bz);
    h.applyRadius(true);
    if (h.isPlayer) this.snapCamera();
  }

  // ------------------------------------------------------------------ AI (also auto-steer)
  think(h, dt) {
    const ai = h.ai || (h.ai = { tx: h.x, tz: h.z, think: 0, skill: 1, ix: 0, iz: 0 });
    ai.think -= dt;
    if (ai.think <= 0) {
      ai.think = 0.35 + Math.random() * 0.35;
      let best = -1, tx = h.x, tz = h.z;
      const wantTargets = h.isPlayer && this.targets;
      for (const o of this.world.objects) {
        if (o.eaten || !this.fits(o, h)) continue;
        const t = o.lastPos;
        if (!t) continue;
        const d = Math.hypot(t[0] - h.x, t[1] - h.z);
        if (d > 30) continue;
        let v = o.prop.value;
        if (wantTargets && this.targets.some((tg) => tg.got < tg.need && tg.match(o))) v *= 3;
        const s = v / (d + 2.5);
        if (s > best) { best = s; tx = t[0]; tz = t[1]; }
      }
      let fx = 0, fz = 0;
      for (const o of this.holes) {
        if (o === h || !o.alive || o.ghostT > 0) continue;
        const d = Math.hypot(o.x - h.x, o.z - h.z) || 1;
        if (h.r > o.r * 1.25 && d < 14 && !h.isPlayer) {
          const s = ((o.mass * 0.5 + 6) / (d + 2)) * ai.skill;
          if (s > best) { best = s; tx = o.x; tz = o.z; }
        } else if (o.r > h.r * 1.18 && d < o.r + 7) {
          fx += (h.x - o.x) / d; fz += (h.z - o.z) / d;
        }
      }
      if (best < 0) { tx = (Math.random() * 2 - 1) * this.bounds.x * 0.7; tz = (Math.random() * 2 - 1) * this.bounds.z * 0.7; }
      ai.tx = tx; ai.tz = tz; ai.fx = fx; ai.fz = fz;
    }
    let dx = ai.tx - h.x, dz = ai.tz - h.z;
    const d = Math.hypot(dx, dz);
    dx = d > 0.2 ? dx / d : 0; dz = d > 0.2 ? dz / d : 0;
    if (d < 0.6) { dx *= d / 0.6; dz *= d / 0.6; } // settle under the target instead of orbiting it
    dx += (ai.fx || 0) * 1.6; dz += (ai.fz || 0) * 1.6;
    const wob = h.isPlayer ? 0 : Math.sin(this.time * 1.7 + h.k * 2.1) * 0.25;
    let ix = dx - wob * dz, iz = dz + wob * dx;
    const m = Math.hypot(ix, iz);
    if (m > 1) { ix /= m; iz /= m; }
    ai.ix = ix; ai.iz = iz;
  }

  // ------------------------------------------------------------------ helpers (boosters)
  useBooster(kind) {
    const h = this.player;
    if (kind === 'magnet') this.boost.magnetT = 5;
    else if (kind === 'freeze') this.boost.freezeT = 10;
    else if (kind === 'grow') {
      // Jump straight to the next size: r_next = 0.5 * 1.22^level.
      const rNext = 0.5 * Math.pow(1.22, this.sizeLevel(h)) * 1.03;
      h.mass = Math.max(h.mass, (rNext * rNext - 0.25) / 0.0436);
      h.pulse = 1;
    }
  }
  // Pull everything the hole could swallow toward it (and out of corners).
  magnet(dt) {
    const h = this.player, R2 = Math.pow(3 + h.r * 3.5, 2);
    for (const o of this.world.objects) {
      if (o.eaten || o.captured >= 0 || !this.fits(o, h) || !o.lastPos) continue;
      const dx = h.x - o.lastPos[0], dz = h.z - o.lastPos[1], d2 = dx * dx + dz * dz;
      if (d2 > R2 || d2 < 0.01) continue;
      if (o.body.isSleeping()) o.body.wakeUp();
      if (o.locked) { o.body.lockRotations(false, true); o.locked = false; }
      const d = Math.sqrt(d2), m = o.prop.mass;
      o.body.applyImpulse({ x: (dx / d) * m * 10 * dt, y: 0, z: (dz / d) * m * 10 * dt }, true);
    }
  }
  // While a menu is up (level intro, pause, results): keep the camera and hole
  // visuals alive without running any gameplay.
  idle(dt) {
    for (const h of this.holes) h.updateVisual(dt, this.time);
    this.writeHoleUniforms();
    this.updateCamera(dt);
  }
  endOverview() { if (this.overview) { this.overview = false; this.swoopT = 1.8; } }
  celebrate() { this.overview = true; this.swoopT = 2.5; }

  // ------------------------------------------------------------------ camera + misc
  // Keep the hole a steady share of the screen width (portrait-aware), pitched 56
  // degrees. The zoom waits a beat after a growth so you SEE the hole get bigger.
  camTarget() {
    const p = this.player, cam = this.renderer.camera;
    if (this.overview) {
      // Frame the whole arena (portrait-aware), looking from the near side.
      const tanV = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)), tanH = tanV * cam.aspect;
      const W = this.world.size.w, Dp = this.world.size.d;
      const dist = Math.max((W / 2 + 1.5) / tanH, (Dp * 0.5 + 1.5) / tanV * 0.62) * 1.05;
      const pitch = THREE.MathUtils.degToRad(62);
      const lz = this.over ? 0 : Dp * 0.3; // intro: push the board up, the card sits below it
      return { x: 0, y: dist * Math.sin(pitch), z: dist * Math.cos(pitch) + lz, lx: 0, lz };
    }
    const r = this.camR;
    const share = THREE.MathUtils.lerp(0.23, 0.15, Math.min(1, (r - 0.5) / 6));
    const tanH = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * Math.min(cam.aspect, 1.1);
    // Levels are small boards: always keep ~70% of the board's width in view so she
    // can plan (like Hole It), and only pull back further as the hole grows.
    const minD = this.kind === 'level' ? (this.world.size.w * 0.7 / 2) / tanH : this.kind === 'zenworld' ? (12 / 2) / tanH : 11;
    const D = Math.max(minD, r / (share * tanH));
    const pitch = THREE.MathUtils.degToRad(56);
    const lead = 0.18;
    return { x: p.x + p.vx * lead, y: D * Math.sin(pitch), z: p.z + p.vz * lead + D * Math.cos(pitch), lx: p.x + p.vx * lead, lz: p.z + p.vz * lead };
  }
  snapCamera() {
    this.camR = this.player.rShown;
    const c = this.camTarget();
    this.camPos.set(c.x, c.y, c.z); this.camLook.set(c.lx, 0, c.lz);
    this.applyCamera();
  }
  updateCamera(dt) {
    const p = this.player;
    if (Math.abs(p.rShown - this.camR) > 0.01) {
      this.camRT += dt;
      if (this.camRT > 0.35) this.camR += (p.rShown - this.camR) * Math.min(1, dt * 2.5);
    } else this.camRT = 0;
    const c = this.camTarget();
    this.swoopT = Math.max(0, this.swoopT - dt);
    const k = 1 - Math.exp(-dt * (this.swoopT > 0 ? 2.4 : 7));
    this.camPos.x += (c.x - this.camPos.x) * k; this.camPos.z += (c.z - this.camPos.z) * k;
    this.camPos.y += (c.y - this.camPos.y) * k;
    this.camLook.x += (c.lx - this.camLook.x) * k; this.camLook.z += (c.lz - this.camLook.z) * k;
    this.applyCamera();
  }
  applyCamera() {
    const cam = this.renderer.camera;
    cam.position.copy(this.camPos);
    if (this.shake > 0) { cam.position.x += (Math.random() - 0.5) * this.shake; cam.position.y += (Math.random() - 0.5) * this.shake; }
    cam.lookAt(this.camLook);
    this.renderer.followSun(this.camLook.x, this.camLook.z);
    this.renderer.setShadowSpan(Math.max(18, this.camPos.y * 1.1));
  }
  writeHoleUniforms() {
    const u = holeUniform.value;
    for (let i = 0; i < MAX_HOLES; i++) {
      const h = this.holes[i];
      if (h && h.alive) u[i].set(h.x, h.z, h.rShown, 1); else u[i].set(0, 0, 0, 0);
    }
  }
  playTime() { return this.time - (this.frozen || 0); } // clock time that counts toward stars
  progress() { return this.world.eatenValue / Math.max(1, this.world.totalValue); }
  standings() { return [...this.holes].sort((a, b) => b.score - a.score); }
  timeUp() {
    if (this.kind === 'level') { this.paused = true; this.events.timeUp?.(this); }
    else this.finish('time');
  }
  addTime(s) { this.duration += s; this.left = this.duration - this.time; this.paused = false; this.usedExtra = true; }
  finish(why) {
    if (this.over) return;
    this.over = true;
    this.events.finished?.(this, why);
  }
  dispose() {
    const s = this.renderer.scene;
    s.remove(this.world.root);
    for (const h of this.holes) {
      s.remove(h.mesh);
      for (const c of h.ring.colliders) this.phys.world.removeCollider(c, false);
      this.phys.world.removeRigidBody(h.ring.body);
    }
    for (const o of this.world.objects) if (!o.eaten) this.phys.remove(o.body);
    const free = (root) => root.traverse((m) => {
      m.geometry?.dispose();
      for (const mat of [].concat(m.material || [])) { mat.map?.dispose(); mat.dispose(); }
      m.dispose?.(); // InstancedMesh frees its instance buffers
    });
    free(this.world.root);
    for (const h of this.holes) free(h.mesh);
    for (const v of holeUniform.value) v.set(0, 0, 0, 0);
  }
}
