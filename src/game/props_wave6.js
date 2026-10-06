// Season 6 prop pack: Bubble Spa, Pumpkin Patch and Holiday Morning.
// Same conventions as props_cozy.js / props_wave3.js: glossy toy look from code geometry
// only (no external art, nothing generated), base at y=0, centered on the collider, fronts
// face +z (the camera), long things lie along x. `fit` = smallest hole diameter that
// swallows it, `value` ~ 1.6*fit^2. tools/check_levels.mjs validates every prop.
// Season 6 is TIGHT SQUEEZE: the targets are TINY (bath beads, acorns, baubles, bows,
// fit 0.26-0.44) and come in 6-7 colors, so they hide in carpets of slightly bigger
// look-alikes (bath bombs, leaves, gift boxes). Big decoys (bigbubble, bigpumpkin, bigbox)
// look like the small ones but only fit late.
import * as THREE from 'three';
import { def } from './props.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { cyl, cone, ball, custom, TINT } from './geo.js';

const TAU = Math.PI * 2, PI = Math.PI;

// ------------------------------------------------------------------ palette
// The engine multiplies the instance tint into EVERY part (render.js patchProps never
// matches; see docs/season6/NOTES.md), so props whose color is in the baked details use
// near-white tints: they look exactly as authored, with a faint warm/cool variation.
const NEUTRAL = [0xffffff, 0xfff5ec, 0xf1f6ff, 0xfffbe8, 0xf3fff3];
const WHITE = 0xfffaf4, CREAM = 0xfff0d4, INK = 0x3b2d3f, BLUSH = 0xff9eb8;
const WOOD = 0xd39a5e, WOOD_D = 0x9e6a3e, WOOD_L = 0xeec58e;
const GOLD = 0xffc94a, SILVER = 0xe1e7ef, LEAF = 0x5cb85c, LEAF_D = 0x3f8f4a, STEM = 0x7a5a32;
const HAY = 0xf2cf6b, HAY_D = 0xd9ad48, FOAM = 0xfdfbff, WATER = 0x9fe3f0;

// ------------------------------------------------------------------ local helpers
// (mirrors props_wave3.js so all packs build shapes the same way)
function xf(g, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  if (rx) g.rotateX(rx); if (rz) g.rotateZ(rz); if (ry) g.rotateY(ry);
  g.translate(x, y, z); return g;
}
// Centered ellipsoid.
const egg = (a, b, c, col, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, ws = 14, hs = 10) =>
  custom(xf(new THREE.SphereGeometry(1, ws, hs).scale(a, b, c), x, y, z, rx, ry, rz), col);
const bead = (r, col, x, y, z) => egg(r, r, r, col, x, y, z, 0, 0, 0, 8, 6);
const spark = (r, col, x, y, z) => ball(r, col, x, y - r, z, 0);
// Centered cylinder / box.
const tcyl = (rt, rb, h, col, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, seg = 12) =>
  custom(xf(new THREE.CylinderGeometry(rt, rb, h, seg), x, y, z, rx, ry, rz), col);
const tbox = (w, h, d, col, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) =>
  custom(xf(new THREE.BoxGeometry(w, h, d), x, y, z, rx, ry, rz), col);
// Torus, flat by default (rx = PI/2), centered at y.
const tor = (R, t, col, x = 0, y = 0, z = 0, rx = PI / 2, ry = 0, rz = 0, rs = 6, ts = 16, arc = TAU) =>
  custom(xf(new THREE.TorusGeometry(R, t, rs, ts, arc), x, y, z, rx, ry, rz), col);
const latheGeo = (pts, seg = 16) => new THREE.LatheGeometry(pts.map(([r, h]) => new THREE.Vector2(r, h)), seg);
const lathe = (pts, col, x = 0, y = 0, z = 0, seg = 16) => custom(latheGeo(pts, seg).translate(x, y, z), col);
// Flat extruded footprint. pts = [[x,z],...]. Base at y, height h.
function prism(pts, h, col, x = 0, y = 0, z = 0, bevel = 0, ry = 0) {
  const s = new THREE.Shape(pts.map(([px, pz]) => new THREE.Vector2(px, -pz)));
  const g = new THREE.ExtrudeGeometry(s, {
    depth: Math.max(0.002, h - 2 * bevel), bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel,
    bevelSegments: 2, curveSegments: 5,
  });
  g.rotateX(-PI / 2); if (ry) g.rotateY(ry); g.translate(x, y + bevel, z);
  return custom(g, col);
}
// Upright plate: shape in (u = x, v = y), thickness t along z (centered), then spun by ry.
function vprism(pts, t, col, x = 0, y = 0, z = 0, ry = 0, bevel = 0) {
  const s = new THREE.Shape(pts.map(([u, v]) => new THREE.Vector2(u, v)));
  const g = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 5 });
  g.translate(0, 0, -t / 2); if (ry) g.rotateY(ry); g.translate(x, y, z);
  return custom(g, col);
}
const starPts = (r, inner = 0.48, n = 5, a0 = PI / 2) => Array.from({ length: n * 2 }, (_, i) => {
  const a = a0 + (i * PI) / n, rr = i % 2 ? r * inner : r;
  return [Math.cos(a) * rr, Math.sin(a) * rr];
});
// Light rounded box (one bevel segment). Base at y.
const rb = (w, h, d, col, x = 0, y = 0, z = 0, r = 0.06) =>
  custom(new RoundedBoxGeometry(w, h, d, 1, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001)).translate(x, y + h / 2, z), col);
// Re-center a part list on x/z so the collider sits in the middle of the shape.
function C(parts) {
  parts = parts.flat().filter(Boolean);
  const bb = new THREE.Box3();
  for (const g of parts) { g.computeBoundingBox(); bb.union(g.boundingBox); }
  const cx = (bb.min.x + bb.max.x) / 2, cz = (bb.min.z + bb.max.z) / 2;
  for (const g of parts) g.translate(-cx, 0, -cz);
  return parts;
}
// Scale a finished part list about the origin (decoy "big" versions of small props).
const scaled = (parts, sx, sy = sx, sz = sx) => parts.flat().filter(Boolean).map((g) => g.scale(sx, sy, sz));
// Ribbed squashed sphere (pumpkins, gourds). Base at y.
function ribbed(r, sy, ribs, depth, col, x = 0, y = 0, z = 0, ws = 22, hs = 10) {
  const g = new THREE.SphereGeometry(r, ws, hs);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const px = p.getX(i), pz = p.getZ(i);
    const k = 1 - depth * (1 - Math.abs(Math.cos((ribs * Math.atan2(px, pz)) / 2)));
    p.setX(i, px * k); p.setZ(i, pz * k); p.setY(i, p.getY(i) * sy);
  }
  g.computeVertexNormals();
  return custom(g.translate(x, y + r * sy, z), col);
}
const _lin = new THREE.Color();
// A TINT part in a darker (gray < white) and/or paler (mask < 1) shade of the instance color.
function shade(g, gray = 0xb4b4b4, mask = 1) {
  _lin.set(gray);
  const c = g.attributes.color, m = g.attributes.tmask;
  for (let i = 0; i < c.count; i++) { c.setXYZ(i, _lin.r, _lin.g, _lin.b); m.setX(i, mask); }
  return g;
}
const pale = (g, mask = 0.5) => shade(g, 0xffffff, mask);
// Paint one geometry in several colors, triangle by triangle: pick(x, y, z) at the
// centroid returns an index into cols (stripes, checks, kernels).
function multi(geo, pick, cols) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const P = g.attributes.position, N = g.attributes.normal;
  const out = cols.map(() => [[], []]);
  for (let i = 0; i < P.count; i += 3) {
    let x = 0, y = 0, z = 0;
    for (let k = 0; k < 3; k++) { x += P.getX(i + k); y += P.getY(i + k); z += P.getZ(i + k); }
    const k = pick(x / 3, y / 3, z / 3), o = out[((k % cols.length) + cols.length) % cols.length];
    for (let k = 0; k < 3; k++) {
      o[0].push(P.getX(i + k), P.getY(i + k), P.getZ(i + k));
      o[1].push(N.getX(i + k), N.getY(i + k), N.getZ(i + k));
    }
  }
  return out.map(([p, n], k) => {
    if (!p.length) return null;
    const b = new THREE.BufferGeometry();
    b.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    b.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3));
    return custom(b, cols[k]);
  });
}
// Cute face on a surface facing +z: ink eyes with a sparkle, blush, little smile.
function face(x, y, z, dx = 0.06, er = 0.022, smile = true) {
  const p = [];
  for (const s of [-1, 1]) {
    p.push(egg(er, er, er, INK, x + s * dx, y, z, 0, 0, 0, 7, 5), spark(er * 0.32, 0xffffff, x + s * dx - er * 0.35, y + er * 0.4, z + er * 0.85));
    p.push(egg(er * 1.25, er * 0.7, er * 0.45, BLUSH, x + s * dx * 1.75, y - er * 1.7, z - er * 0.5, 0, s * 0.45, 0, 6, 4));
  }
  if (smile) p.push(tor(dx * 0.5, er * 0.36, INK, x, y - er * 1.5, z + er * 0.1, 0, 0, PI, 4, 8, PI));
  return p;
}
// Even points on a sphere.
const fib = (n) => Array.from({ length: n }, (_, i) => {
  const y = 1 - (2 * i + 1) / n, r = Math.sqrt(1 - y * y), a = i * 2.39996;
  return [Math.cos(a) * r, y, Math.sin(a) * r];
});

// ======================================================================== BUBBLE SPA
const PEARL = [0xff8fb8, 0xb48cff, 0x5fd3e0, 0xffb066, 0x7ddc98, 0xf4f0ff, 0xffd84a];
const BUBBLE = [0xa8e4ff, 0xffc4e6, 0xd2c0ff, 0xbff2d8, 0xfff0a8, 0xffd2b0];
const BOMB = [0xff7fae, 0x9f7bff, 0x45cbe0, 0xffc14d, 0x6fd68a, 0xff8a5c];
const DUCKIE = [0xffd23f, 0xff8fbf, 0x6cc4ff, 0x6fe0a6, 0xb48cff, 0xff9a3a];
const SOAP = [0xffa6c0, 0xa8dcff, 0xd2bcff, 0xb8eec4, 0xfff09a, 0xffc9a0, 0xfffaf2];
const TOWEL = [0xff8fb1, 0x7fc8f8, 0xffd36b, 0x8fdcab, 0xbfa0ff, 0xfffaf2, 0xff9f7a];

def('bathbead', {
  label: 'Bath Pearl', col: { t: 'ball', r: 0.13 }, fit: 0.26, value: 1, mass: 0.15,
  tints: PEARL,
  build: () => [
    egg(0.13, 0.13, 0.13, TINT, 0, 0.13, 0, 0, 0, 0, 12, 8),
    pale(egg(0.07, 0.05, 0.04, TINT, -0.04, 0.2, 0.07, 0.5, 0, 0.4, 7, 5), 0.25),
    spark(0.026, 0xffffff, -0.05, 0.215, 0.075),
  ],
});

function bubbleParts() {
  return [
    pale(egg(0.18, 0.18, 0.18, TINT, 0, 0.18, 0, 0, 0, 0, 14, 10), 0.75),
    // a film band and a bright window glint
    shade(tor(0.172, 0.012, TINT, 0, 0.2, 0, 1.2, 0.5, 0.3, 3, 18), 0xd8d8ff, 1),
    egg(0.06, 0.032, 0.02, 0xffffff, -0.07, 0.27, 0.12, 0.6, -0.5, 0.5, 8, 5),
    spark(0.022, 0xffffff, 0.06, 0.1, 0.15),
  ];
}
def('spabubble', {
  label: 'Bubble', col: { t: 'ball', r: 0.18 }, fit: 0.36, value: 1, mass: 0.15,
  tints: BUBBLE,
  build: () => bubbleParts(),
});
def('bigbubble', {
  label: 'Big Bubble', col: { t: 'ball', r: 0.8 }, fit: 1.6, value: 4, mass: 0.4,
  tints: BUBBLE,
  build: () => scaled(bubbleParts(), 0.8 / 0.18),
});

def('bathbomb', {
  label: 'Bath Bomb', col: { t: 'ball', r: 0.23 }, fit: 0.46, value: 1, mass: 0.15,
  tints: BOMB,
  build: () => {
    const p = [
      egg(0.23, 0.225, 0.23, TINT, 0, 0.225, 0, 0, 0, 0, 14, 10),
      pale(tor(0.226, 0.014, TINT, 0, 0.225, 0, PI / 2, 0, 0, 3, 20), 0.45),
    ];
    // fizzy speckles and dried petals on top
    fib(18).forEach(([x, y, z], i) => { if (y > -0.2) p.push(spark(0.016, i % 3 ? 0xffffff : 0xfff2a0, x * 0.226, 0.225 + y * 0.222, z * 0.226)); });
    p.push(pale(egg(0.05, 0.02, 0.035, TINT, 0.03, 0.44, -0.02, 0, 0.6, 0, 6, 4), 0.3), egg(0.045, 0.02, 0.03, 0xffe680, -0.04, 0.44, 0.03, 0, -0.4, 0, 6, 4));
    return p;
  },
});

def('squeakduck', {
  label: 'Bath Duckie', col: { t: 'box', w: 0.48, h: 0.42, d: 0.3 }, fit: 0.57, value: 1, mass: 0.15,
  tints: DUCKIE,
  build: () => C([
    egg(0.17, 0.13, 0.15, TINT, -0.03, 0.13, 0, 0, 0, 0, 12, 8),
    egg(0.06, 0.05, 0.07, TINT, -0.19, 0.19, 0, 0, 0, 0.5, 7, 5),
    pale(egg(0.09, 0.05, 0.03, TINT, -0.05, 0.16, 0.13, 0, 0, -0.3, 8, 5), 0.6),
    pale(egg(0.09, 0.05, 0.03, TINT, -0.05, 0.16, -0.13, 0, 0, -0.3, 8, 5), 0.6),
    egg(0.1, 0.1, 0.1, TINT, 0.1, 0.31, 0, 0, 0, 0, 12, 8),
    egg(0.05, 0.022, 0.045, 0xff8a2a, 0.195, 0.29, 0, 0, 0, -0.1, 8, 5),
    // eyes on both sides plus a little foam cap
    ...[-1, 1].flatMap((s) => [bead(0.017, INK, 0.165, 0.34, s * 0.06), spark(0.006, 0xffffff, 0.172, 0.348, s * 0.068)]),
    egg(0.06, 0.035, 0.06, FOAM, 0.09, 0.39, 0, 0, 0, 0, 8, 5),
  ]),
});

def('soapbar', {
  label: 'Soap Bar', col: { t: 'box', w: 0.52, h: 0.2, d: 0.3 }, fit: 0.6, value: 1, mass: 0.15,
  tints: SOAP,
  build: () => [
    rb(0.52, 0.15, 0.3, TINT, 0, 0, 0, 0.07),
    pale(rb(0.36, 0.03, 0.16, TINT, 0, 0.135, 0, 0.015), 0.45),
    spark(0.032, FOAM, 0.17, 0.18, 0.06), spark(0.024, FOAM, 0.21, 0.17, -0.02), spark(0.02, FOAM, -0.18, 0.165, 0.08),
  ],
});

def('spacandle', {
  label: 'Candle', col: { t: 'cyl', r: 0.2, h: 0.54 }, fit: 0.4, value: 1, mass: 0.15,
  tints: [0xfff4e0, 0xffbcd2, 0xbfe2ff, 0xdccbff, 0xc6efd2, 0xffdf9e],
  build: () => {
    const p = [
      lathe([[0, 0], [0.19, 0], [0.2, 0.02], [0.2, 0.34], [0.185, 0.37], [0.12, 0.365], [0, 0.355]], TINT, 0, 0, 0, 16),
      tcyl(0.012, 0.012, 0.06, INK, 0, 0.385, 0, 0, 0, 0, 4),
      egg(0.042, 0.075, 0.042, 0xffb42e, 0, 0.455, 0, 0, 0, 0, 8, 6),
      egg(0.022, 0.045, 0.022, 0xfffbe0, 0, 0.44, 0.02, 0, 0, 0, 6, 4),
    ];
    // wax drips over the rim
    for (let i = 0; i < 5; i++) { const a = i * TAU / 5 + 0.3; p.push(pale(egg(0.03, 0.06 + (i % 2) * 0.03, 0.02, TINT, 0.198 * Math.sin(a), 0.31, 0.198 * Math.cos(a), 0, a, 0, 6, 4), 0.5)); }
    return p;
  },
});

def('lotion', {
  label: 'Lotion Bottle', col: { t: 'cyl', r: 0.24, h: 0.72 }, fit: 0.48, value: 1, mass: 0.15,
  tints: [0xff9ec0, 0x8fd3ff, 0xb9a0ff, 0x8fe3b8, 0xffd27a, 0xff9f80],
  build: () => [
    lathe([[0, 0], [0.22, 0], [0.24, 0.03], [0.24, 0.42], [0.2, 0.5], [0.09, 0.53], [0, 0.53]], TINT, 0, 0, 0, 16),
    custom(new THREE.CylinderGeometry(0.243, 0.243, 0.17, 16, 1, true).translate(0, 0.23, 0), WHITE),
    tor(0.13, 0.012, 0xff9eb8, 0, 0.23, 0.16, 0, 0, 0, 3, 10),
    tcyl(0.06, 0.07, 0.07, WHITE, 0, 0.565, 0, 0, 0, 0, 10),
    tcyl(0.025, 0.025, 0.08, WHITE, 0, 0.64, 0, 0, 0, 0, 6),
    rb(0.09, 0.04, 0.2, WHITE, 0, 0.68, 0.06, 0.015),
  ],
});

def('loofah', {
  label: 'Loofah', col: { t: 'box', w: 0.8, h: 0.37, d: 0.38 }, fit: 0.89, value: 1, mass: 0.15,
  tints: [0xf0d9a8, 0xff9ec0, 0x9fe0c8, 0xc7a8ff, 0xffbf94, 0x9fd2ff],
  build: () => {
    const p = [egg(0.35, 0.16, 0.16, TINT, 0, 0.17, 0, 0, 0, 0, 12, 8)];
    // spongy bumps all over
    for (let i = 0; i < 22; i++) {
      const t = (i % 11) / 10 - 0.5, a = (i < 11 ? 0.6 : 2.2) + i * 1.3;
      const sx = t * 0.6, rr = 0.16 * Math.sqrt(Math.max(0.15, 1 - (sx / 0.35) ** 2));
      const y = 0.17 + Math.cos(a) * rr, z = Math.sin(a) * rr;
      if (y < 0.06) continue;
      p.push(i % 3 ? egg(0.05, 0.04, 0.05, TINT, sx, y, z, 0, 0, 0, 6, 4) : pale(egg(0.045, 0.035, 0.045, TINT, sx, y, z, 0, 0, 0, 6, 4), 0.6));
    }
    // a rope loop on one end
    p.push(tor(0.07, 0.014, WHITE, 0.36, 0.2, 0, 0, PI / 2, 0, 4, 12));
    return C(p);
  },
});

function towelRollParts() {
  const p = [tcyl(0.2, 0.2, 0.84, TINT, 0, 0.2, 0, 0, 0, PI / 2, 16)];
  for (const s of [-1, 1]) {
    p.push(pale(tcyl(0.204, 0.204, 0.07, TINT, s * 0.29, 0.2, 0, 0, 0, PI / 2, 16), 0.2));
    for (const [R, t] of [[0.15, 0.03], [0.09, 0.028], [0.035, 0.024]]) p.push(shade(tor(R, t, TINT, s * 0.405, 0.2, 0, 0, PI / 2, 0, 4, 14), 0xd2d2d2));
  }
  // the loose flap lying on top
  p.push(rb(0.6, 0.03, 0.12, TINT, 0, 0.385, 0.07, 0.012));
  return p;
}
def('towelroll', {
  label: 'Rolled Towel', col: { t: 'box', w: 0.9, h: 0.42, d: 0.42 }, fit: 0.99, value: 2, mass: 0.15,
  tints: TOWEL,
  build: () => towelRollParts(),
});

def('towelstack', {
  label: 'Towel Stack', col: { t: 'box', w: 1.3, h: 1.0, d: 0.9 }, fit: 1.58, value: 4, mass: 0.6,
  tints: TOWEL,
  build: () => {
    const p = [];
    [[0, 1.26, TINT, 0], [0.25, 1.2, WHITE, 0.03], [0.5, 1.14, TINT, -0.02]].forEach(([y, w, col, dx]) => {
      const g = rb(w, 0.24, 0.78, col, dx, y, -0.04, 0.09);
      p.push(col === TINT && y > 0.3 ? pale(g, 0.75) : g);
      p.push(tcyl(0.12, 0.12, w - 0.04, col === TINT && y > 0.3 ? 0xffffff : col, dx, y + 0.12, 0.33, 0, 0, PI / 2, 10));
      if (col === TINT) p.push(pale(tcyl(0.123, 0.123, 0.06, TINT, dx + w * 0.3, y + 0.12, 0.33, 0, 0, PI / 2, 10), 0.2));
    });
    // a soap and a little flower on top
    p.push(rb(0.4, 0.12, 0.24, 0xffc4d6, -0.2, 0.74, -0.08, 0.05));
    for (let i = 0; i < 5; i++) { const a = i * TAU / 5; p.push(egg(0.06, 0.03, 0.06, 0xfff4fa, 0.28 + 0.06 * Math.sin(a), 0.78, 0.05 + 0.06 * Math.cos(a), 0, 0, 0, 6, 4)); }
    p.push(bead(0.035, GOLD, 0.28, 0.8, 0.05));
    p.push(egg(0.12, 0.03, 0.06, LEAF, 0.4, 0.76, -0.06, 0, 0.5, 0, 6, 4), tcyl(0.012, 0.012, 0.2, LEAF_D, 0.3, 0.86, -0.02, 0.4, 0, 0, 4));
    return C(p);
  },
});

def('bathstool', {
  label: 'Bath Stool', col: { t: 'cyl', r: 0.6, h: 0.72 }, fit: 1.2, value: 2, mass: 0.4,
  tints: NEUTRAL,
  build: () => {
    const p = [
      lathe([[0, 0], [0.56, 0], [0.6, 0.04], [0.6, 0.09], [0.56, 0.12], [0, 0.12]], 0x9fd8c8, 0, 0.6, 0, 20),
      tor(0.4, 0.02, TINT, 0, 0.72, 0, PI / 2, 0, 0, 3, 18),
    ];
    for (let i = 0; i < 3; i++) {
      const a = i * TAU / 3 + 0.5;
      p.push(tcyl(0.05, 0.06, 0.64, WOOD, 0.42 * Math.sin(a), 0.31, 0.42 * Math.cos(a), 0.12 * Math.cos(a), 0, -0.12 * Math.sin(a), 8));
    }
    p.push(tor(0.4, 0.025, WOOD_D, 0, 0.25, 0, PI / 2, 0, 0, 3, 16));
    return p;
  },
});

def('spabucket', {
  label: 'Wash Bucket', col: { t: 'cyl', r: 0.72, h: 1.2 }, fit: 1.44, value: 3, mass: 0.5,
  tints: NEUTRAL,
  build: () => {
    const body = latheGeo([[0, 0], [0.55, 0], [0.66, 0.78], [0.6, 0.78], [0.5, 0.08], [0, 0.08]], 20);
    const p = [...multi(body, (x, y, z) => Math.floor((Math.atan2(z, x) + PI) / TAU * 20) % 2, [WOOD, WOOD_L])];
    for (const [y, R] of [[0.18, 0.575], [0.6, 0.635]]) p.push(tor(R, 0.035, GOLD, 0, y, 0, PI / 2, 0, 0, 4, 22));
    p.push(lathe([[0, 0], [0.62, 0], [0, 0.001]], WATER, 0, 0.68, 0, 18));
    // foam on the water, a dipper resting in the bucket
    for (let i = 0; i < 7; i++) { const a = i * 0.9; p.push(egg(0.13, 0.08, 0.13, TINT, 0.38 * Math.sin(a), 0.72, 0.38 * Math.cos(a), 0, 0, 0, 8, 5)); }
    p.push(tcyl(0.03, 0.03, 0.6, WOOD_D, 0.18, 0.9, -0.12, 0, 0, -0.6, 6));
    p.push(lathe([[0, 0], [0.13, 0.02], [0.15, 0.14], [0, 0.12]], WOOD_L, -0.03, 0.66, -0.12, 10));
    return p;
  },
});

def('spabench', {
  label: 'Spa Bench', col: { t: 'box', w: 3.0, h: 1.22, d: 1.1 }, fit: 3.2, value: 16, mass: 4,
  tints: NEUTRAL,
  build: () => {
    const p = [];
    for (const sx of [-1.3, 1.3]) for (const sz of [-0.42, 0.42]) p.push(rb(0.14, 0.42, 0.14, WOOD_D, sx, 0, sz, 0.03));
    for (let i = 0; i < 5; i++) p.push(rb(2.96, 0.08, 0.18, i % 2 ? WOOD : WOOD_L, 0, 0.42, -0.44 + i * 0.22, 0.03));
    p.push(rb(2.8, 0.08, 0.1, WOOD_D, 0, 0.18, 0, 0.03));
    // a cushion pad, a towel stack, two candles and a basket of soaps
    p.push(rb(1.1, 0.12, 0.9, 0xa8e0d0, -0.8, 0.5, 0, 0.05));
    [[0, 0xffc4d6], [0.2, TINT], [0.4, 0xfff0b0]].forEach(([y, c], k) => p.push(rb(0.7 - k * 0.06, 0.2, 0.62, c, -0.85, 0.62 + y, 0, 0.07)));
    for (const [x, z, h] of [[0.25, -0.2, 0.36], [0.55, 0.15, 0.26]]) {
      p.push(tcyl(0.13, 0.13, h, 0xfff4e0, x, 0.5 + h / 2, z, 0, 0, 0, 12));
      p.push(egg(0.035, 0.07, 0.035, 0xffb42e, x, 0.5 + h + 0.08, z, 0, 0, 0, 6, 4));
    }
    p.push(lathe([[0, 0], [0.42, 0], [0.5, 0.26], [0.45, 0.26], [0.38, 0.03], [0, 0.03]], WOOD_L, 1.05, 0.5, 0, 14));
    [[0.95, 0.08, 0xffb3c8], [1.18, -0.08, 0xa8dcff], [1.05, -0.12, 0xfff09a], [1.0, 0.18, 0xb8eec4]].forEach(([x, z, c], i) => p.push(rb(0.24, 0.13, 0.16, c, x, 0.62 + (i % 2) * 0.05, z, 0.04)));
    return p;
  },
});

def('clawtub', {
  label: 'Clawfoot Tub', col: { t: 'box', w: 4.9, h: 2.7, d: 2.3 }, fit: 5.41, value: 47, mass: 20,
  tints: [0xffb3c8, 0x9fdcd0, 0xb8d8ff, 0xfff1dc, 0xd8c4ff],
  build: () => {
    const SX = 2.1;
    const body = latheGeo([[0, 0], [0.82, 0], [0.98, 0.18], [1.06, 0.6], [1.1, 1.05], [1.12, 1.18], [0, 1.18]], 20).scale(SX, 1, 1).translate(0, 0.42, 0);
    const p = [custom(body, TINT)];
    p.push(custom(new THREE.TorusGeometry(1.08, 0.08, 4, 22).rotateX(PI / 2).scale(SX, 1, 1).translate(0, 1.6, 0), WHITE));
    p.push(pale(custom(new THREE.TorusGeometry(1.0, 0.03, 3, 20).rotateX(PI / 2).scale(SX, 1, 1).translate(0, 0.9, 0), TINT), 0.35));
    // golden claw feet
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const x = sx * 1.55, z = sz * 0.62;
      p.push(egg(0.2, 0.28, 0.2, GOLD, x, 0.36, z, 0, 0, -sx * 0.25, 8, 6));
      for (const k of [-1, 1]) p.push(egg(0.08, 0.07, 0.1, GOLD, x + sx * 0.12, 0.07, z + k * 0.07, 0, 0, 0, 6, 4));
    }
    // a big heap of bubbles over the top
    [[0, 1.7, 0, 0.75], [-1.1, 1.66, 0.1, 0.6], [1.1, 1.66, -0.1, 0.62], [-0.55, 1.7, -0.35, 0.55], [0.6, 1.72, 0.35, 0.55],
      [-1.75, 1.6, 0, 0.42], [1.75, 1.6, 0.05, 0.4], [0.2, 2.15, 0.1, 0.42], [-0.6, 2.05, 0.2, 0.36], [0.95, 2.0, -0.2, 0.34]].forEach(([x, y, z, r]) =>
      p.push(egg(r, r * 0.72, r * 0.95, FOAM, x, y, z, 0, 0, 0, 9, 5)));
    // a duckie floating on the foam
    p.push(egg(0.22, 0.16, 0.18, 0xffd23f, -0.55, 2.42, 0.25, 0, 0, 0, 8, 6), egg(0.13, 0.13, 0.13, 0xffd23f, -0.35, 2.58, 0.25, 0, 0, 0, 8, 6));
    p.push(egg(0.06, 0.03, 0.05, 0xff8a2a, -0.22, 2.56, 0.25, 0, 0, 0, 6, 4), bead(0.022, INK, -0.28, 2.62, 0.35));
    // a few loose bubbles and the faucet at one end
    for (const [x, y, z, r] of [[0.4, 2.35, 0.7, 0.12], [1.4, 2.15, 0.5, 0.1], [-1.3, 2.05, -0.5, 0.11], [1.6, 2.4, -0.4, 0.09]]) p.push(pale(egg(r, r, r, 0xbfe8ff, x, y, z, 0, 0, 0, 7, 5), 0));
    p.push(tcyl(0.06, 0.06, 0.9, GOLD, -2.32, 1.95, 0, 0, 0, 0, 8), tcyl(0.05, 0.05, 0.5, GOLD, -2.12, 2.42, 0, 0, 0, PI / 2, 8));
    for (const s of [-1, 1]) p.push(tcyl(0.08, 0.08, 0.06, WHITE, -2.32, 2.3, s * 0.18, PI / 2, 0, 0, 8));
    return p;
  },
});

// ======================================================================== PUMPKIN PATCH
const NUT = [0xc98a4b, 0xa0582e, 0xe0a845, 0x9aa04a, 0xc0503a, 0x7a4a2e];
const FALL = [0xe8402e, 0xff8a1f, 0xffd23a, 0xc79a2b, 0xb0243c, 0x8a5a2e, 0x7fb84a];
const SQUASH = [0xff8a1f, 0xfff3e0, 0x9fc86a, 0xe8553a, 0xe0b88a, 0xffc23a];
const APPLES = [0xe8333f, 0x8fd14f, 0xffd447, 0xff6f7a, 0xb0243c];

def('acorn', {
  label: 'Acorn', col: { t: 'cyl', r: 0.15, h: 0.36 }, fit: 0.3, value: 1, mass: 0.15,
  tints: NUT,
  build: () => {
    const p = [
      egg(0.125, 0.15, 0.125, TINT, 0, 0.15, 0, 0, 0, 0, 12, 8),
      lathe([[0, 0], [0.12, 0], [0.148, 0.035], [0.14, 0.075], [0.09, 0.105], [0, 0.11]], 0x7a5230, 0, 0.215, 0, 14),
      tcyl(0.016, 0.02, 0.05, 0x5a3a20, 0.01, 0.34, 0, 0, 0, -0.3, 5),
      pale(egg(0.04, 0.055, 0.02, TINT, -0.05, 0.13, 0.105, 0, 0, 0.3, 6, 4), 0.4),
    ];
    for (let i = 0; i < 8; i++) { const a = i * TAU / 8; p.push(spark(0.016, 0x9a6e44, 0.136 * Math.sin(a), 0.265, 0.136 * Math.cos(a))); }
    return p;
  },
});

// Maple leaf outline: five lobes, a little serration, a stem at the bottom.
const LEAF_PTS = (() => {
  const pts = [];
  for (let i = 0; i < 40; i++) {
    const a = PI / 2 + (i / 40) * TAU, k = Math.abs(Math.cos(2.5 * (a - PI / 2)));
    const bottom = Math.max(0, -Math.sin(a)) ** 4;
    const r = (0.1 + 0.1 * k ** 1.3 + 0.012 * Math.cos(15 * a)) * (1 - 0.45 * bottom);
    pts.push([Math.cos(a) * r, -Math.sin(a) * r]);
  }
  return pts;
})();
def('autumnleaf', {
  label: 'Leaf', col: { t: 'cyl', r: 0.22, h: 0.08 }, fit: 0.44, value: 1, mass: 0.15,
  tints: FALL,
  build: () => {
    const p = [prism(LEAF_PTS, 0.04, TINT, 0, 0, 0)];
    // veins from the stem out to the lobes, the stem itself
    for (let i = 0; i < 5; i++) {
      const a = PI / 2 + i * TAU / 5, L = 0.16;
      p.push(shade(tbox(L, 0.006, 0.012, TINT, Math.cos(a) * L / 2, 0.042, -Math.sin(a) * L / 2, 0, a, 0), 0xc4c4c4));
    }
    p.push(tbox(0.016, 0.02, 0.09, 0x7a5232, 0, 0.03, 0.17));
    return C(p);
  },
});

def('minigourd', {
  label: 'Little Gourd', col: { t: 'cyl', r: 0.25, h: 0.44 }, fit: 0.5, value: 1, mass: 0.15,
  tints: SQUASH,
  build: () => [
    ribbed(0.25, 0.68, 8, 0.14, TINT, 0, 0, 0, 16, 8),
    pale(ribbed(0.13, 0.5, 8, 0.12, TINT, 0, 0.27, 0, 10, 6), 0.45),
    tcyl(0.025, 0.035, 0.12, STEM, 0.01, 0.38, 0, 0, 0, -0.25, 6),
  ],
});

def('orchardapple', {
  label: 'Orchard Apple', col: { t: 'ball', r: 0.26 }, fit: 0.52, value: 1, mass: 0.15,
  tints: APPLES,
  build: () => [
    egg(0.26, 0.235, 0.26, TINT, 0, 0.235, 0, 0, 0, 0, 14, 10),
    shade(egg(0.08, 0.02, 0.08, TINT, 0, 0.465, 0, 0, 0, 0, 8, 4), 0x9a9a9a),
    tcyl(0.016, 0.02, 0.1, STEM, 0.01, 0.49, 0, 0, 0, -0.25, 5),
    egg(0.09, 0.016, 0.045, LEAF, 0.08, 0.5, 0, 0, 0.3, 0.25, 7, 4),
    egg(0.07, 0.05, 0.03, 0xffffff, -0.12, 0.33, 0.17, 0.4, -0.6, 0.3, 7, 4),
  ],
});

def('cornear', {
  label: 'Corn Cob', col: { t: 'box', w: 0.84, h: 0.28, d: 0.28 }, fit: 0.89, value: 1, mass: 0.15,
  tints: [0xffd23a, 0xfff2c4, 0xe8573a, 0x9a5ad8, 0xff9a2e],
  build: () => {
    const cob = new THREE.SphereGeometry(1, 16, 10).scale(0.3, 0.13, 0.13).translate(0.06, 0.135, 0);
    const k = multi(cob, (x, y, z) => (Math.floor((x + 1) / 0.05) + Math.floor((Math.atan2(z, y - 0.135) + PI) / 0.4)) % 2, [TINT, TINT]);
    const p = [k[0], k[1] && shade(k[1], 0xd8d8d8)];
    // three husk leaves pulled back
    for (const [rz, ry, y] of [[0.35, 0.45, 0.16], [0.25, -0.5, 0.15], [-0.1, 0, 0.24]]) p.push(egg(0.2, 0.025, 0.07, 0x9ccf5a, -0.28, y, 0, 0, ry, rz, 8, 4));
    p.push(tcyl(0.04, 0.05, 0.08, 0x8ab44a, -0.25, 0.135, 0, 0, 0, PI / 2, 6));
    return C(p);
  },
});

function pumpkinParts() {
  return [
    ribbed(0.5, 0.62, 10, 0.12, TINT, 0, 0, 0, 20, 10),
    pale(egg(0.12, 0.05, 0.12, TINT, 0, 0.6, 0, 0, 0, 0, 8, 4), 0.3),
    tcyl(0.05, 0.075, 0.18, STEM, 0.02, 0.69, 0, 0, 0, -0.25, 7),
    tor(0.06, 0.012, LEAF_D, 0.12, 0.66, 0.06, 0.3, 0.5, 0, 3, 10, PI * 1.6),
    egg(0.14, 0.02, 0.09, LEAF, -0.14, 0.62, 0.08, 0, 0.6, -0.2, 7, 4),
  ];
}
def('patchpumpkin', {
  label: 'Pumpkin', col: { t: 'cyl', r: 0.5, h: 0.78 }, fit: 1.0, value: 2, mass: 0.6,
  tints: SQUASH,
  build: () => pumpkinParts(),
});
def('bigpumpkin', {
  label: 'Big Pumpkin', col: { t: 'cyl', r: 1.0, h: 1.56 }, fit: 2.0, value: 6, mass: 2,
  tints: SQUASH,
  build: () => scaled(pumpkinParts(), 2),
});

def('patchgourd', {
  label: 'Bottle Gourd', col: { t: 'cyl', r: 0.26, h: 0.78 }, fit: 0.52, value: 1, mass: 0.15,
  tints: [0x9fc86a, 0xffd86a, 0xff9a3a, 0xe8d8b0, 0x6aa84a],
  build: () => {
    const body = latheGeo([[0, 0], [0.18, 0.01], [0.25, 0.1], [0.26, 0.24], [0.2, 0.38], [0.11, 0.46], [0.09, 0.56], [0.11, 0.63], [0.07, 0.68], [0, 0.69]], 14);
    const k = multi(body, (x, y, z) => Math.floor((Math.atan2(z, x) + PI) / TAU * 8) % 2, [TINT, TINT]);
    return [k[0], k[1] && pale(k[1], 0.55), tcyl(0.02, 0.025, 0.1, STEM, 0.015, 0.73, 0, 0, 0, -0.3, 5)];
  },
});

def('hayroll', {
  label: 'Hay Roll', col: { t: 'box', w: 1.2, h: 1.2, d: 1.2 }, fit: 1.7, value: 5, mass: 1.5,
  tints: NEUTRAL,
  build: () => {
    const body = new THREE.CylinderGeometry(0.6, 0.6, 1.16, 18, 4).rotateZ(PI / 2).translate(0, 0.6, 0);
    const p = [...multi(body, (x, y, z) => Math.floor(Math.atan2(z, y - 0.6) * 4 + x * 9) % 2, [HAY, HAY_D])];
    for (const s of [-1, 1]) {
      p.push(tcyl(0.59, 0.59, 0.02, HAY_D, s * 0.58, 0.6, 0, 0, 0, PI / 2, 18));
      for (const [R, c] of [[0.42, HAY], [0.24, 0xe6bd55]]) p.push(tor(R, 0.035, c, s * 0.59, 0.6, 0, 0, PI / 2, 0, 3, 16));
      p.push(tor(0.596, 0.02, 0xe8402e, s * 0.3, 0.6, 0, 0, PI / 2, 0, 3, 20));
    }
    for (let i = 0; i < 6; i++) p.push(egg(0.03, 0.09, 0.03, 0xf8dc80, -0.4 + i * 0.16, 1.15, 0.05 * (i % 2 ? 1 : -1), 0.3 * (i % 2 ? 1 : -1), 0, 0.3, 4, 3));
    p.push(tbox(0.12, 0.08, 0.02, TINT, 0.3, 0.75, 0.6));
    return p;
  },
});

def('applebasket', {
  label: 'Apple Basket', col: { t: 'cyl', r: 0.62, h: 1.08 }, fit: 1.24, value: 3, mass: 0.5,
  tints: NEUTRAL,
  build: () => {
    const body = latheGeo([[0, 0], [0.45, 0], [0.6, 0.55], [0.56, 0.55], [0.42, 0.06], [0, 0.06]], 18);
    const p = [...multi(body, (x, y, z) => (Math.floor(y / 0.09) + Math.floor((Math.atan2(z, x) + PI) / TAU * 18)) % 2, [WOOD_L, WOOD])];
    p.push(tor(0.59, 0.035, WOOD_D, 0, 0.55, 0, PI / 2, 0, 0, 4, 20));
    [[0, 0.68, 0], [0.26, 0.6, 0.18], [-0.27, 0.6, 0.15], [0.2, 0.6, -0.26], [-0.2, 0.6, -0.25], [0.02, 0.6, 0.33]].forEach(([x, y, z], i) => {
      p.push(egg(0.15, 0.14, 0.15, [0xe8333f, 0x8fd14f, 0xe8333f, 0xffd447, 0xb0243c, 0xe8333f][i], x, y, z, 0, 0, 0, 10, 7));
      p.push(tcyl(0.012, 0.012, 0.06, STEM, x, y + 0.16, z, 0, 0, 0, 4));
    });
    p.push(tor(0.5, 0.03, WOOD_D, 0, 0.55, 0, 0, 0, 0, 4, 16, PI));
    // a cloth napkin tucked over the front rim
    p.push(egg(0.26, 0.04, 0.16, TINT, 0.05, 0.56, 0.5, 0.5, 0.2, 0, 8, 4));
    return p;
  },
});

def('scarebuddy', {
  label: 'Scarecrow Pal', col: { t: 'box', w: 1.2, h: 2.0, d: 0.5 }, fit: 1.3, value: 3, mass: 0.8,
  tints: NEUTRAL,
  build: () => {
    const p = [
      rb(0.1, 1.5, 0.1, WOOD_D, 0, 0, -0.04, 0.02),
      tcyl(0.04, 0.04, 1.04, WOOD_D, 0, 1.25, -0.04, 0, 0, PI / 2, 6),
      rb(0.46, 0.55, 0.28, 0xe8573a, 0, 0.82, 0, 0.1),
      rb(0.14, 0.14, 0.02, TINT, 0.1, 1.0, 0.14, 0.02),
      tcyl(0.1, 0.12, 0.4, 0xe8573a, -0.37, 1.25, 0, 0, 0, PI / 2, 8), tcyl(0.1, 0.12, 0.4, 0xe8573a, 0.37, 1.25, 0, 0, 0, -PI / 2, 8),
      rb(0.34, 0.36, 0.24, 0x5a7ad0, 0, 0.5, 0, 0.08),
      egg(0.2, 0.2, 0.19, 0xf0d8a8, 0, 1.58, 0, 0, 0, 0, 12, 8),
      ...face(0, 1.6, 0.18, 0.07, 0.024),
      egg(0.03, 0.03, 0.03, 0xff8a3a, 0, 1.56, 0.2, 0, 0, 0, 6, 4),
      tcyl(0.25, 0.25, 0.03, HAY, 0, 1.74, 0, 0, 0, 0, 14),
      tcyl(0.13, 0.15, 0.22, HAY_D, 0, 1.87, 0, 0, 0, 0, 12),
      tcyl(0.152, 0.152, 0.04, 0xe8402e, 0, 1.79, 0, 0, 0, 0, 12),
    ];
    // straw poking from the cuffs and collar
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) p.push(egg(0.025, 0.025, 0.07, HAY, s * 0.6, 1.25 + (i - 1) * 0.05, (i - 1) * 0.04, 0, 0, s * (PI / 2 - 0.2 * (i - 1)), 4, 3));
    for (let i = 0; i < 5; i++) p.push(egg(0.02, 0.07, 0.02, HAY, -0.1 + i * 0.05, 1.38, 0.1, 0.3, 0, 0.2 * (i - 2), 4, 3));
    return p;
  },
});

def('pumpkincart', {
  label: 'Pumpkin Cart', col: { t: 'box', w: 2.3, h: 1.46, d: 1.32 }, fit: 2.65, value: 11, mass: 2.5,
  tints: NEUTRAL,
  build: () => {
    const p = [
      rb(1.6, 0.36, 1.0, 0xe8402e, -0.2, 0.42, 0, 0.05),
      rb(1.5, 0.04, 0.9, WOOD_L, -0.2, 0.78, 0, 0.02),
    ];
    for (const s of [-1, 1]) {
      p.push(rb(1.6, 0.12, 0.06, WOOD, -0.2, 0.78, s * 0.47, 0.02));
      p.push(tcyl(0.38, 0.38, 0.08, WOOD_D, -0.45, 0.38, s * 0.6, PI / 2, 0, 0, 14), tcyl(0.1, 0.1, 0.12, GOLD, -0.45, 0.38, s * 0.6, PI / 2, 0, 0, 8));
      p.push(tcyl(0.035, 0.035, 0.8, WOOD_D, 0.9, 0.56, s * 0.36, 0, 0, 1.15, 6), tcyl(0.05, 0.05, 0.16, WOOD_D, 1.18, 0.44, s * 0.36, 0, 0, PI / 2, 6));
      p.push(tbox(0.06, 0.4, 0.06, WOOD_D, 0.42, 0.2, s * 0.36));
    }
    // pumpkins piled in the bed
    [[-0.6, 0.82, 0.18, 0.3, 0xff8a1f], [-0.05, 0.82, -0.15, 0.32, 0xff9a2e], [0.4, 0.82, 0.2, 0.26, TINT], [-0.35, 1.04, -0.1, 0.25, 0xffa53a]].forEach(([x, y, z, r, c]) => {
      p.push(ribbed(r, 0.66, 8, 0.12, c, x, y, z, 12, 7));
      p.push(tcyl(0.03, 0.045, 0.1, STEM, x, y + r * 1.32 + 0.04, z, 0, 0, 0.2, 5));
    });
    return C(p);
  },
});

def('haywagon', {
  label: 'Hay Wagon', col: { t: 'box', w: 4.2, h: 2.1, d: 2.0 }, fit: 4.65, value: 35, mass: 8,
  tints: NEUTRAL,
  build: () => {
    const p = [rb(3.3, 0.4, 1.6, 0xd8402e, -0.3, 0.55, 0, 0.06)];
    for (const s of [-1, 1]) {
      p.push(rb(3.3, 0.38, 0.08, 0xd8402e, -0.3, 0.95, s * 0.76, 0.03));
      for (let i = 0; i < 4; i++) p.push(rb(0.08, 0.38, 0.1, WOOD_L, -1.85 + i * 1.033, 0.95, s * 0.8, 0.02));
      for (const x of [-1.3, 0.75]) {
        p.push(tcyl(0.5, 0.5, 0.12, WOOD_D, x, 0.5, s * 0.92, PI / 2, 0, 0, 10));
        p.push(tcyl(0.38, 0.38, 0.13, WOOD_L, x, 0.5, s * 0.92, PI / 2, 0, 0, 12), tcyl(0.1, 0.1, 0.16, GOLD, x, 0.5, s * 0.92, PI / 2, 0, 0, 6));
      }
    }
    // tongue out front
    p.push(tbox(0.9, 0.08, 0.1, WOOD_D, 1.75, 0.55, 0), tbox(0.08, 0.08, 0.6, WOOD_D, 2.15, 0.55, 0));
    // the hay load: two bales and a loose heap, a pumpkin and a cheerful flag
    p.push(rb(1.4, 0.5, 1.2, HAY, -1.1, 0.95, 0, 0.1), rb(1.2, 0.5, 1.1, HAY_D, 0.4, 0.95, 0.05, 0.1), rb(1.2, 0.45, 1.0, HAY, -0.6, 1.45, -0.05, 0.1));
    for (const [x, z] of [[-1.1, 0.5], [0.4, 0.55], [-0.6, 0.45]]) p.push(tbox(1.0, 0.02, 0.04, 0xc0503a, x, x === -0.6 ? 1.68 : 1.2, z + 0.06));
    p.push(ribbed(0.32, 0.66, 8, 0.12, 0xff8a1f, 0.55, 1.45, 0.1, 12, 7), tcyl(0.035, 0.05, 0.1, STEM, 0.55, 1.92, 0.1, 0, 0, 0.2, 5));
    p.push(tcyl(0.025, 0.025, 0.7, WOOD_D, -1.8, 1.7, 0.5, 0, 0, 0, 5), vprism([[0, 0], [0.42, 0.09], [0, 0.18]], 0.02, TINT, -1.78, 1.86, 0.5));
    for (let i = 0; i < 6; i++) p.push(egg(0.03, 0.12, 0.03, 0xf8dc80, -1.6 + i * 0.5, 1.5 + (i % 3) * 0.05, -0.4 + (i % 4) * 0.25, 0.3 * ((i % 2) * 2 - 1), 0, 0.35 * ((i % 3) - 1), 4, 3));
    return C(p);
  },
});

def('prizepumpkin', {
  label: 'Prize Pumpkin', col: { t: 'cyl', r: 2.6, h: 3.6 }, fit: 5.2, value: 43, mass: 18,
  tints: NEUTRAL,
  build: () => {
    const p = [
      ribbed(2.3, 0.64, 12, 0.11, 0xff8a1f, 0, 0, 0, 30, 12),
      egg(0.5, 0.15, 0.5, 0xffb060, 0, 2.9, 0, 0, 0, 0, 10, 4),
      tcyl(0.2, 0.32, 0.7, STEM, 0.06, 3.22, 0, 0, 0, -0.18, 8),
      tor(0.3, 0.05, LEAF_D, 0.55, 3.05, 0.3, 0.3, 0.5, 0, 3, 14, PI * 1.6),
    ];
    // big leaves and vine curling round the base
    for (let i = 0; i < 6; i++) { const a = i * TAU / 6 + 0.4; p.push(egg(0.55, 0.06, 0.32, i % 2 ? LEAF : LEAF_D, 2.05 * Math.sin(a), 0.06, 2.05 * Math.cos(a), 0, a, 0, 9, 4)); }
    for (let i = 0; i < 3; i++) { const a = i * 2.1 + 1.0; p.push(tor(0.18, 0.035, LEAF_D, 2.2 * Math.sin(a), 0.1, 2.2 * Math.cos(a), PI / 2, 0, 0, 3, 10, PI * 1.5)); }
    // the blue ribbon rosette on the front
    const rz = 2.02, ry = 1.4;
    p.push(vprism(starPts(0.42, 0.78, 12), 0.05, 0x2f6fe8, 0, ry, rz + 0.02, 0, 0));
    p.push(tcyl(0.27, 0.27, 0.06, TINT, 0, ry, rz + 0.05, PI / 2, 0, 0, 16), tcyl(0.18, 0.18, 0.08, GOLD, 0, ry, rz + 0.06, PI / 2, 0, 0, 14));
    for (const s of [-1, 1]) p.push(vprism([[0, 0], [0.16, 0], [0.16, -0.6], [0.08, -0.5], [0, -0.6]], 0.03, 0x2f6fe8, s * 0.06 - 0.08, ry - 0.2, rz + 0.05, s * 0.12));
    p.push(...face(0, 2.1, 1.82, 0.32, 0.09));
    return p;
  },
});

// ======================================================================== HOLIDAY MORNING
const ORN = [0xe8333f, 0x2fae5a, 0x3f8fff, 0xffc83a, 0xc8d4e8, 0xb06ae8, 0xff7ab8];
const WRAP = [0xe8333f, 0x2fae5a, 0x3f8fff, 0xffc83a, 0xb06ae8, 0xff7ab8, 0x2fc8c8, 0xf8f4ec];
const FESTIVE = [0xe8333f, 0x2fae5a, 0x3f8fff, 0xffc83a, 0xb06ae8, 0xff7ab8];

def('bauble', {
  label: 'Bauble', col: { t: 'ball', r: 0.16 }, fit: 0.32, value: 1, mass: 0.15,
  tints: ORN,
  build: () => {
    const sph = new THREE.SphereGeometry(0.145, 12, 9).translate(0, 0.145, 0);
    const k = multi(sph, (x, y) => (Math.abs(y - 0.145) < 0.03 ? 1 : 0), [TINT, TINT]);
    return [
      k[0], k[1] && pale(k[1], 0.35),
      tcyl(0.045, 0.05, 0.05, GOLD, 0, 0.3, 0, 0, 0, 0, 8),
      tor(0.022, 0.007, GOLD, 0, 0.34, 0, 0, 0, 0, 3, 8),
      spark(0.024, 0xffffff, -0.05, 0.21, 0.11),
    ];
  },
});

def('giftbow', {
  label: 'Gift Bow', col: { t: 'cyl', r: 0.21, h: 0.17 }, fit: 0.42, value: 1, mass: 0.15,
  tints: ORN,
  build: () => {
    const p = [];
    for (const s of [-1, 1]) {
      p.push(tor(0.075, 0.032, TINT, s * 0.1, 0.09, -0.02, 0, s * 0.35, s * 0.25, 5, 12));
      p.push(shade(prism([[0, 0], [0.05, 0], [0.09 * s, 0.14], [0.05 * s - 0.02, 0.16]], 0.025, TINT, s * 0.015, 0, 0.02), 0xd8d8d8));
    }
    p.push(egg(0.045, 0.045, 0.045, TINT, 0, 0.09, -0.02, 0, 0, 0, 8, 6), pale(egg(0.02, 0.012, 0.012, TINT, -0.01, 0.12, 0.01, 0, 0, 0, 5, 4), 0.2));
    return C(p);
  },
});

def('minicane', {
  label: 'Candy Cane', col: { t: 'box', w: 0.46, h: 0.07, d: 0.22 }, fit: 0.51, value: 1, mass: 0.15,
  tints: FESTIVE,
  build: () => {
    const R = 0.034, H = 0.07, stripe = (x, y, z) => Math.floor((x + z * 1.4) / 0.045) % 2 === 0 ? 0 : 1;
    const shaft = new THREE.CylinderGeometry(R, R, 0.34, 10, 6).rotateZ(PI / 2).translate(-0.07, R, 0);
    const hook = new THREE.TorusGeometry(0.075, R, 8, 12, PI).rotateX(-PI / 2).rotateY(-PI / 2).translate(0.1, R, -0.075);
    const p = [];
    for (const g of [shaft, hook]) { const k = multi(g, stripe, [TINT, TINT]); p.push(k[0], k[1] && shade(k[1], 0x8a8a8a)); }
    void H;
    return C(p);
  },
});

function giftParts() {
  const p = [
    rb(0.36, 0.28, 0.36, TINT, 0, 0, 0, 0.03),
    pale(rb(0.4, 0.07, 0.4, TINT, 0, 0.27, 0, 0.025), 0.85),
    tbox(0.37, 0.29, 0.06, GOLD, 0, 0.145, 0), tbox(0.06, 0.29, 0.37, GOLD, 0, 0.145, 0),
    tbox(0.41, 0.072, 0.065, GOLD, 0, 0.306, 0), tbox(0.065, 0.072, 0.41, GOLD, 0, 0.306, 0),
  ];
  for (const s of [-1, 1]) p.push(tor(0.05, 0.02, GOLD, s * 0.05, 0.38, 0, 0, s * 0.4, 0, 4, 10));
  p.push(bead(0.025, GOLD, 0, 0.36, 0));
  return p;
}
def('giftbox', {
  label: 'Little Present', col: { t: 'box', w: 0.4, h: 0.44, d: 0.4 }, fit: 0.57, value: 1, mass: 0.15,
  tints: WRAP,
  build: () => giftParts(),
});
def('bigbox', {
  label: 'Big Present', col: { t: 'box', w: 1.4, h: 1.54, d: 1.4 }, fit: 1.98, value: 6, mass: 0.8,
  tints: WRAP,
  build: () => scaled(giftParts(), 3.5),
});

def('nutsoldier', {
  label: 'Toy Soldier', col: { t: 'cyl', r: 0.17, h: 0.8 }, fit: 0.34, value: 1, mass: 0.15,
  tints: [0xe8333f, 0x2f6fe8, 0x2fae5a, 0xb06ae8, 0xffc83a, 0xf8f4ec],
  build: () => {
    const p = [
      tcyl(0.13, 0.14, 0.04, 0x3a8a4a, 0, 0.02, 0, 0, 0, 0, 12),
      ...[-1, 1].flatMap((s) => [rb(0.07, 0.1, 0.1, INK, s * 0.045, 0.04, 0.01, 0.025), tcyl(0.035, 0.035, 0.16, 0xfaf6ee, s * 0.045, 0.22, 0, 0, 0, 0, 6)]),
      lathe([[0, 0], [0.105, 0], [0.11, 0.06], [0.1, 0.2], [0, 0.2]], TINT, 0, 0.29, 0, 12),
      tcyl(0.112, 0.112, 0.035, 0xfaf6ee, 0, 0.32, 0, 0, 0, 0, 12),
      ...[0.37, 0.42, 0.47].map((y) => spark(0.014, GOLD, 0, y, 0.105)),
      ...[-1, 1].map((s) => tcyl(0.03, 0.035, 0.18, TINT, s * 0.135, 0.41, 0, 0, 0, s * 0.12, 6)),
      ...[-1, 1].map((s) => ball(0.025, 0xffe2c8, s * 0.145, 0.29, 0, 0)),
      egg(0.075, 0.075, 0.07, 0xffe2c8, 0, 0.555, 0, 0, 0, 0, 10, 7),
      ...face(0, 0.56, 0.065, 0.028, 0.011),
      egg(0.045, 0.025, 0.02, 0xfaf6ee, 0, 0.52, 0.055, 0, 0, 0, 6, 4),
      tcyl(0.07, 0.075, 0.17, INK, 0, 0.69, 0, 0, 0, 0, 10),
      tcyl(0.077, 0.077, 0.03, GOLD, 0, 0.62, 0, 0, 0, 0, 10),
      shade(egg(0.03, 0.04, 0.03, TINT, 0, 0.785, 0, 0, 0, 0, 6, 4), 0xffffff, 0.7),
    ];
    return p;
  },
});

def('stocking', {
  label: 'Stocking', col: { t: 'box', w: 0.46, h: 0.16, d: 0.72 }, fit: 0.85, value: 1, mass: 0.15,
  tints: FESTIVE,
  build: () => {
    const sock = [[-0.13, -0.24], [0.11, -0.24], [0.11, 0.12], [0.2, 0.17], [0.23, 0.26], [0.17, 0.33], [0.0, 0.33], [-0.12, 0.27], [-0.14, 0.15]];
    const p = [prism(sock, 0.11, TINT, 0, 0, 0, 0.02)];
    p.push(rb(0.34, 0.15, 0.13, WHITE, -0.01, 0, -0.29, 0.05));
    p.push(pale(prism([[0.06, 0.17], [0.2, 0.17], [0.23, 0.26], [0.17, 0.33], [0.08, 0.33]], 0.01, TINT, 0, 0.11, 0), 0.25));
    p.push(pale(prism([[-0.12, 0.2], [0.0, 0.2], [0.0, 0.33], [-0.12, 0.27]], 0.01, TINT, 0, 0.11, 0), 0.25));
    for (const z of [-0.12, -0.02, 0.06]) p.push(spark(0.022, WHITE, 0.0, 0.135, z));
    p.push(tor(0.04, 0.01, GOLD, -0.12, 0.15, -0.32, 0, 0, 0, 3, 8));
    return C(p);
  },
});

def('toydrum', {
  label: 'Toy Drum', col: { t: 'cyl', r: 0.34, h: 0.52 }, fit: 0.68, value: 1, mass: 0.15,
  tints: FESTIVE,
  build: () => {
    const p = [
      tcyl(0.3, 0.3, 0.3, TINT, 0, 0.19, 0, 0, 0, 0, 16),
      tcyl(0.29, 0.29, 0.012, 0xfffaf2, 0, 0.346, 0, 0, 0, 0, 16),
      tor(0.305, 0.035, GOLD, 0, 0.345, 0, PI / 2, 0, 0, 4, 18), tor(0.305, 0.035, GOLD, 0, 0.035, 0, PI / 2, 0, 0, 4, 18),
    ];
    // zig-zag cord round the side
    for (let i = 0; i < 8; i++) {
      const a0 = i * TAU / 8, a1 = (i + 0.5) * TAU / 8, a2 = (i + 1) * TAU / 8;
      for (const [aa, ab, ya, yb] of [[a0, a1, 0.06, 0.32], [a1, a2, 0.32, 0.06]]) {
        const xa = 0.305 * Math.sin(aa), za = 0.305 * Math.cos(aa), xb = 0.305 * Math.sin(ab), zb = 0.305 * Math.cos(ab);
        const len = Math.hypot(xb - xa, yb - ya, zb - za);
        const g = new THREE.CylinderGeometry(0.01, 0.01, len, 4).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(xb - xa, yb - ya, zb - za).normalize()));
        p.push(custom(g.translate((xa + xb) / 2, (ya + yb) / 2, (za + zb) / 2), WHITE));
      }
    }
    for (const s of [-1, 1]) {
      p.push(tcyl(0.018, 0.018, 0.44, WOOD_L, s * 0.06, 0.39, 0.02, 0, s * 0.6, s * 1.2, 5));
      p.push(bead(0.04, WOOD_D, s * 0.06 + s * 0.2 * Math.sin(1.2) * Math.cos(0.6), 0.39 + 0.22 * Math.cos(1.2) + 0.05, 0.02 - s * 0.2 * Math.sin(0.6)));
    }
    return p;
  },
});

def('wreath', {
  label: 'Wreath', col: { t: 'cyl', r: 0.6, h: 0.3 }, fit: 1.2, value: 2, mass: 0.3,
  tints: NEUTRAL,
  build: () => {
    const p = [tor(0.44, 0.14, 0x2f8f4a, 0, 0.14, 0, PI / 2, 0, 0, 6, 20)];
    for (let i = 0; i < 14; i++) { const a = i * TAU / 14, rr = 0.44 + (i % 2 ? 0.07 : -0.07); p.push(egg(0.11, 0.035, 0.055, i % 3 ? 0x3fae5a : 0x237a3e, rr * Math.sin(a), 0.24, rr * Math.cos(a), 0, a + 0.6, 0.2, 6, 4)); }
    for (let i = 0; i < 9; i++) { const a = i * TAU / 9 + 0.2, rr = 0.44 + (i % 2 ? 0.1 : -0.06); p.push(spark(0.035, 0xe8333f, rr * Math.sin(a), 0.26, rr * Math.cos(a))); }
    for (const s of [-1, 1]) {
      p.push(tor(0.08, 0.035, 0xe8333f, s * 0.1, 0.22, 0.46, 0, s * 0.3, 0, 5, 12));
      p.push(shade(prism([[0, 0], [0.06, 0], [0.1 * s, 0.1], [0.06 * s - 0.02, 0.12]], 0.025, 0xc82a36, s * 0.02, 0.2, 0.48), 0xd0d0d0));
    }
    p.push(egg(0.05, 0.05, 0.05, 0xe8333f, 0, 0.22, 0.46, 0, 0, 0, 8, 6));
    // a dusting of snow on the leaves
    for (let i = 0; i < 7; i++) { const a = i * TAU / 7 + 0.5; p.push(egg(0.06, 0.02, 0.04, TINT, 0.44 * Math.sin(a), 0.28, 0.44 * Math.cos(a), 0, a, 0, 6, 3)); }
    return C(p);
  },
});

def('giftstack', {
  label: 'Gift Stack', col: { t: 'box', w: 1.2, h: 1.5, d: 1.0 }, fit: 1.56, value: 4, mass: 0.5,
  tints: NEUTRAL,
  build: () => {
    const p = [
      rb(1.1, 0.6, 0.9, 0xe8333f, 0, 0, 0, 0.04),
      tbox(1.12, 0.61, 0.1, 0xfffaf2, 0, 0.3, 0), tbox(0.1, 0.61, 0.92, 0xfffaf2, 0.2, 0.3, 0),
      rb(0.78, 0.44, 0.66, TINT, -0.05, 0.6, 0.02, 0.04),
      tbox(0.8, 0.45, 0.08, 0xe8333f, -0.05, 0.825, 0.02), tbox(0.08, 0.45, 0.68, 0xe8333f, -0.05, 0.825, 0.02),
      rb(0.5, 0.32, 0.44, 0x2fae5a, 0.02, 1.04, -0.02, 0.03),
      tbox(0.52, 0.33, 0.06, GOLD, 0.02, 1.2, -0.02), tbox(0.06, 0.33, 0.46, GOLD, 0.02, 1.2, -0.02),
    ];
    for (const s of [-1, 1]) p.push(tor(0.07, 0.028, GOLD, 0.02 + s * 0.07, 1.42, -0.02, 0, s * 0.4, 0, 4, 10));
    return p;
  },
});

def('toysled', {
  label: 'Toy Sled', col: { t: 'box', w: 1.56, h: 0.65, d: 0.84 }, fit: 1.77, value: 5, mass: 0.6,
  tints: NEUTRAL,
  build: () => {
    const p = [];
    for (const s of [-1, 1]) {
      p.push(tbox(1.3, 0.05, 0.06, 0xc8d0dc, -0.1, 0.025, s * 0.32));
      p.push(tor(0.2, 0.03, 0xc8d0dc, 0.55, 0.22, s * 0.32, 0, 0, 0, 4, 10, PI * 0.8), tor(0.2, 0.03, 0xc8d0dc, 0.55, 0.22, s * 0.32, 0, 0, -PI / 2, 4, 6, PI * 0.3));
      for (const x of [-0.55, 0.15]) p.push(tbox(0.05, 0.22, 0.05, WOOD_D, x, 0.16, s * 0.32));
    }
    for (let i = 0; i < 5; i++) p.push(rb(0.22, 0.05, 0.72, i % 2 ? 0xe8333f : WOOD_L, -0.55 + i * 0.25, 0.27, 0, 0.02));
    p.push(rb(1.25, 0.05, 0.08, 0xe8333f, -0.05, 0.27, 0.38, 0.02), rb(1.25, 0.05, 0.08, 0xe8333f, -0.05, 0.27, -0.38, 0.02));
    p.push(tor(0.3, 0.018, 0xc0503a, 0.62, 0.32, 0, 0, PI / 2, 0, 3, 12, PI));
    // a scarf left on the seat
    p.push(...multi(new THREE.BoxGeometry(0.6, 0.04, 0.2, 6, 1, 1).translate(-0.3, 0.33, 0.05), (x) => Math.floor((x + 1) / 0.1) % 2, [TINT, 0x3f8fff]));
    return C(p);
  },
});

def('giftsleigh', {
  label: 'Gift Sleigh', col: { t: 'box', w: 2.8, h: 1.76, d: 1.55 }, fit: 3.2, value: 16, mass: 5,
  tints: NEUTRAL,
  build: () => {
    const side = [[-1.4, 0.3], [0.7, 0.3], [1.1, 0.5], [1.35, 0.9], [1.2, 1.15], [1.0, 1.0], [0.75, 0.75], [-0.6, 0.8], [-1.0, 1.35], [-1.4, 1.35]];
    const p = [];
    for (const s of [-1, 1]) {
      p.push(vprism(side, 0.1, 0xd8283a, 0, 0, s * 0.62));
      p.push(vprism(side.map(([u, v]) => [u * 0.9 - 0.05, v * 0.88 + 0.08]), 0.02, GOLD, 0, 0.0, s * 0.68));
      // curly golden runners
      p.push(tbox(2.4, 0.06, 0.08, GOLD, -0.2, 0.03, s * 0.72));
      p.push(tor(0.28, 0.04, GOLD, 1.0, 0.31, s * 0.72, 0, 0, 0, 4, 12, PI * 1.2));
      for (const x of [-0.9, 0.3]) p.push(tbox(0.06, 0.3, 0.06, GOLD, x, 0.18, s * 0.72));
    }
    p.push(rb(2.0, 0.12, 1.2, 0xd8283a, -0.25, 0.3, 0, 0.04), rb(0.7, 0.3, 1.18, TINT, -0.7, 0.42, 0, 0.1), rb(0.15, 0.55, 1.18, 0xfff4e8, -1.15, 0.6, 0, 0.06));
    // presents piled in the back
    [[-0.95, 0.72, -0.25, 0.5, 0.42, 0x3f8fff, 0.1], [-0.4, 0.72, 0.2, 0.55, 0.45, 0xffc83a, -0.2], [-0.75, 1.14, 0.1, 0.42, 0.38, 0xb06ae8, 0.3], [0.2, 0.42, -0.2, 0.5, 0.4, 0x2fae5a, 0.2], [-0.95, 0.72, 0.38, 0.32, 0.3, 0xff7ab8, 0]].forEach(([x, y, z, w, h, c, ry]) => {
      p.push(rb(w, h, w, c, x, y, z, 0.03));
      p.push(tbox(w + 0.01, h + 0.01, 0.05, 0xfffaf2, x, y + h / 2, z, 0, ry * 0, 0), tbox(0.05, h + 0.01, w + 0.01, 0xfffaf2, x, y + h / 2, z));
    });
    for (const s of [-1, 1]) p.push(tor(0.12, 0.04, 0xffc83a, -0.75 + s * 0.12, 1.6, 0.1, 0, s * 0.4, 0, 4, 10));
    p.push(egg(0.06, 0.06, 0.06, 0xffc83a, -0.75, 1.58, 0.1, 0, 0, 0, 6, 4));
    return C(p);
  },
});

def('holidaytree', {
  label: 'Holiday Tree', col: { t: 'cyl', r: 2.6, h: 6.6 }, fit: 5.2, value: 43, mass: 16,
  tints: NEUTRAL,
  build: () => {
    const p = [
      lathe([[0, 0], [2.0, 0], [2.0, 0.04], [0, 0.04]], TINT, 0, 0, 0, 20),
      lathe([[2.0, 0], [2.55, 0], [2.55, 0.035], [2.0, 0.035]], 0xd8283a, 0, 0, 0, 20),
      tcyl(0.3, 0.36, 1.0, 0x8a5a32, 0, 0.5, 0, 0, 0, 0, 10),
    ];
    const tiers = [[0.6, 2.3, 2.0, 0x2f8f4a], [1.8, 1.85, 1.8, 0x35a055], [2.9, 1.4, 1.6, 0x2f8f4a], [3.9, 0.95, 1.4, 0x35a055], [4.8, 0.55, 1.15, 0x2f8f4a]];
    for (const [y, r, h, c] of tiers) p.push(cone(r, h, c, 0, y, 0, 18));
    // gold bead garlands spiralling down, ornaments and the star
    for (let i = 0; i < 34; i++) {
      const t = i / 34, y = 1.0 + t * 4.3, R = 2.1 * (1 - t * 0.85) + 0.05, a = t * TAU * 3.2;
      p.push(ball(0.06, i % 2 ? GOLD : 0xfff4d0, R * Math.sin(a), y, R * Math.cos(a), 0));
    }
    let k = 0;
    for (const [y, R, n] of [[0.9, 1.95, 9], [2.05, 1.55, 8], [3.1, 1.15, 7], [4.05, 0.75, 5], [4.9, 0.45, 3]]) for (let i = 0; i < n; i++, k++) {
      const a = i * TAU / n + y, c = k % 3 === 0 ? 0xe8333f : [0xfff4e8, 0xc8d4e8, 0xff7ab8][k % 3];
      p.push(ball(0.16, c, R * Math.sin(a), y - 0.1, R * Math.cos(a), 0));
    }
    p.push(vprism(starPts(0.5, 0.45, 5), 0.16, GOLD, 0, 6.05, 0, 0, 0.03), tcyl(0.06, 0.06, 0.25, GOLD, 0, 5.9, 0, 0, 0, 0, 6));
    // presents at the foot
    [[1.2, 0.6, 0.55, 0xe8333f], [-1.3, 0.4, 0.45, 0x3f8fff], [0.2, 1.4, 0.4, 0xb06ae8], [-0.4, -1.5, 0.5, 0xffc83a]].forEach(([x, z, s, c]) => {
      p.push(rb(s, s * 0.9, s, c, x, 0.04, z, 0.03), tbox(s + 0.01, s * 0.9 + 0.01, 0.06, 0xfffaf2, x, 0.04 + s * 0.45, z), tbox(0.06, s * 0.9 + 0.01, s + 0.01, 0xfffaf2, x, 0.04 + s * 0.45, z));
    });
    return p;
  },
});

// World -> its new props (smallest first). Used by the dev galleries and the Gulp Book.
export const WAVE6_WORLDS = {
  spa: ['bathbead', 'spabubble', 'spacandle', 'bathbomb', 'lotion', 'squeakduck', 'soapbar', 'loofah', 'towelroll', 'bathstool', 'spabucket', 'towelstack', 'bigbubble', 'spabench', 'clawtub'],
  pumpkin: ['acorn', 'autumnleaf', 'minigourd', 'orchardapple', 'patchgourd', 'cornear', 'patchpumpkin', 'applebasket', 'scarebuddy', 'hayroll', 'bigpumpkin', 'pumpkincart', 'haywagon', 'prizepumpkin'],
  holiday: ['bauble', 'nutsoldier', 'giftbow', 'minicane', 'giftbox', 'toydrum', 'stocking', 'wreath', 'giftstack', 'toysled', 'bigbox', 'giftsleigh', 'holidaytree'],
};
