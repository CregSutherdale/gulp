// Season 4 prop pack: Tea Party, Flower Shop and Cozy Library.
// Same conventions as props_wave3.js: glossy toy look from code geometry only (no external
// art), base at y=0, centered on the collider, fronts face +z (the camera), carts point +x.
// `fit` = smallest hole diameter that swallows it, `value` ~ 1.6*fit^2.
// Season 4 is the BRAIN TEASER season, so the color-target props come in 7-8 look-alike
// tints (rose next to blush, peach next to apricot...), and three props come in a small
// and a big size that look the same (cuppa/bigcuppa, posy/bigposy, book/bigbook): only
// one size is ever the target, so she has to read the list AND the board.
import * as THREE from 'three';
import { def } from './props.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { rbox, cyl, ball, custom, TINT } from './geo.js';

const TAU = Math.PI * 2, PI = Math.PI;

// ------------------------------------------------------------------ palette
const WHITE = 0xfffaf4, CREAM = 0xfff0d4, INK = 0x3b2d3f, BLUSH = 0xff9eb8;
const WOOD = 0xd39a5e, WOOD_D = 0x9e6a3e, WOOD_L = 0xeec58e;
const SILVER = 0xe1e7ef, GOLD = 0xffc94a, LEAF = 0x5cc46b, LEAF_D = 0x3f9e55, TERRA = 0xe0875a, TEA = 0xb86a3a;
const CAKE = 0xffe2b0, SOIL = 0x6b4a34, PAGE = 0xfff6e2;
// Look-alike tints. Neighbours are close on purpose (but still tell apart at phone size).
// TEA7: 0 rose, 1 blush, 2 peach, 3 apricot, 4 lilac, 5 sky, 6 mint
const TEA7 = [0xff7fa6, 0xffbfd2, 0xffa184, 0xffd27e, 0xc4a3ff, 0x9fd3ff, 0x93e2bd];
// CUP8: 0 pink, 1 coral, 2 butter, 3 mint, 4 blue, 5 periwinkle, 6 lilac, 7 teal
const CUP8 = [0xff7fa3, 0xff9a7a, 0xffd56a, 0x8fdba8, 0x6fbaff, 0x9d9cff, 0xd69bff, 0x5fd3cc];
// FLO8: 0 red, 1 pink, 2 blush, 3 orange, 4 yellow, 5 white, 6 purple, 7 periwinkle
const FLO8 = [0xff4a62, 0xff7fb0, 0xffbcd6, 0xff9a3c, 0xffd93f, 0xfffbf2, 0xb27aff, 0x8b9cff];
// BOOK8: 0 red, 1 terracotta, 2 blue, 3 teal, 4 green, 5 purple, 6 mustard, 7 pink
const BOOK8 = [0xe0465c, 0xec7f52, 0x3f7ee0, 0x37b3c4, 0x4fae6a, 0x8d62d6, 0xf0b53a, 0xf07fae];
const PAINT = [0xffb3c7, 0x9fd8c4, 0xa8ccff, 0xffd98a, 0xcdb4ff];

// ------------------------------------------------------------------ local helpers (as props_wave3.js)
function xf(g, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  if (rx) g.rotateX(rx); if (rz) g.rotateZ(rz); if (ry) g.rotateY(ry);
  g.translate(x, y, z); return g;
}
const egg = (a, b, c, col, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, ws = 14, hs = 10) =>
  custom(xf(new THREE.SphereGeometry(1, ws, hs).scale(a, b, c), x, y, z, rx, ry, rz), col);
const bead = (r, col, x, y, z) => egg(r, r, r, col, x, y, z, 0, 0, 0, 6, 4);
const spark = (r, col, x, y, z) => ball(r, col, x, y - r, z, 0);
const tcyl = (rt, rb_, h, col, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, seg = 12) =>
  custom(xf(new THREE.CylinderGeometry(rt, rb_, h, seg), x, y, z, rx, ry, rz), col);
const tbox = (w, h, d, col, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) =>
  custom(xf(new THREE.BoxGeometry(w, h, d), x, y, z, rx, ry, rz), col);
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
// Scale a finished part list about the origin (the "big" look-alikes).
const scaled = (parts, sx, sy = sx, sz = sx) => parts.flat().filter(Boolean).map((g) => g.scale(sx, sy, sz));
const _lin = new THREE.Color();
// A TINT part in a darker (gray < white) and/or paler (mask < 1) shade of the instance color.
function shade(g, gray = 0xb4b4b4, mask = 1) {
  _lin.set(gray);
  const c = g.attributes.color, m = g.attributes.tmask;
  for (let i = 0; i < c.count; i++) { c.setXYZ(i, _lin.r, _lin.g, _lin.b); m.setX(i, mask); }
  return g;
}
const pale = (g, mask = 0.5) => shade(g, 0xffffff, mask);
// Paint one geometry in several colors, triangle by triangle (stripes, checks, land on a globe).
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
  }).filter(Boolean);
}
// Lathe with soft vertical ribs (meringue swirls, cushions, fluted pots). Base at y.
function ribLathe(pts, ribs, depth, col, x = 0, y = 0, z = 0, seg = 24, twist = 0) {
  const g = latheGeo(pts, seg);
  const p = g.attributes.position;
  const ymax = Math.max(...pts.map((q) => q[1])) || 1;
  for (let i = 0; i < p.count; i++) {
    const px = p.getX(i), pz = p.getZ(i), py = p.getY(i);
    const a = Math.atan2(px, pz) + twist * (py / ymax);
    const k = 1 - depth * (1 - Math.abs(Math.cos((ribs * a) / 2)));
    p.setX(i, px * k); p.setZ(i, pz * k);
  }
  g.computeVertexNormals();
  return custom(g.translate(x, y, z), col);
}
// Cute face on a surface facing +z (the teapot cottage smiles at her).
function face(x, y, z, dx = 0.06, er = 0.022) {
  const p = [];
  for (const s of [-1, 1]) {
    p.push(egg(er, er, er, INK, x + s * dx, y, z, 0, 0, 0, 7, 5), spark(er * 0.32, 0xffffff, x + s * dx - er * 0.35, y + er * 0.4, z + er * 0.85));
    p.push(egg(er * 1.25, er * 0.7, er * 0.45, BLUSH, x + s * dx * 1.75, y - er * 1.7, z - er * 0.5, 0, s * 0.45, 0, 6, 4));
  }
  p.push(tor(dx * 0.5, er * 0.36, INK, x, y - er * 1.5, z + er * 0.1, 0, 0, PI, 4, 8, PI));
  return p;
}
// A five-petal flower head facing up, center at (x, y, z).
// lo = 0 smooth, 1 light, 2 lightest (flowers in crates, carts and shelves).
const BLOOM_SEG = [[8, 5], [5, 3], [4, 2]];
function bloom(r, col, x, y, z, center = 0xffd23a, petals = 5, tilt = 0.25, lo = 0) {
  const p = [], [ws, hs] = BLOOM_SEG[lo];
  for (let i = 0; i < petals; i++) {
    const a = (i / petals) * TAU;
    p.push(egg(r * 0.55, r * 0.2, r * 0.36, col, x + Math.sin(a) * r * 0.5, y, z + Math.cos(a) * r * 0.5, -tilt * Math.cos(a), a, 0, ws, hs));
  }
  p.push(egg(r * 0.28, r * 0.2, r * 0.28, center, x, y + r * 0.08, z, 0, 0, 0, ws, hs));
  return p;
}
// Light china for tea sets that sit on bigger props (fixed colors, few triangles).
function cupLo(col, x, y, z, s = 1) {
  return [
    lathe([[0, 0], [0.4, 0.02], [0.3, 0.05], [0, 0.05]].map(([a, b]) => [a * s, b * s]), WHITE, x, y, z, 12),
    lathe([[0.14, 0], [0.24, 0.1], [0.3, 0.32], [0.26, 0.3], [0, 0.26]].map(([a, b]) => [a * s, b * s]), col, x, y + 0.05 * s, z, 12),
    tor(0.07 * s, 0.022 * s, col, x + 0.32 * s, y + 0.24 * s, z, 0, 0, 0, 3, 8),
  ];
}
function potLo(col, x, y, z, s = 1) {
  return [
    egg(0.34 * s, 0.27 * s, 0.34 * s, col, x, y + 0.29 * s, z, 0, 0, 0, 12, 7),
    lathe([[0.2, 0], [0.17, 0.07], [0, 0.1]].map(([a, b]) => [a * s, b * s]), WHITE, x, y + 0.52 * s, z, 10),
    bead(0.05 * s, GOLD, x, y + 0.64 * s, z),
    tcyl(0.035 * s, 0.07 * s, 0.3 * s, col, x + 0.36 * s, y + 0.38 * s, z, 0, 0, -0.95, 6),
    tor(0.12 * s, 0.03 * s, col, x - 0.36 * s, y + 0.32 * s, z, 0, 0, 0, 4, 8),
  ];
}
// A light terracotta pot with a flower, for crates and shelves.
function potFlower(col, x, y, z, s = 1, lo = 2) {
  return [
    lathe([[0, 0], [0.18 * s, 0], [0.24 * s, 0.3 * s], [0.2 * s, 0.3 * s], [0, 0.28 * s]], TERRA, x, y, z, 8),
    egg(0.13 * s, 0.03 * s, 0.05 * s, LEAF, x + 0.1 * s, y + 0.34 * s, z + 0.05 * s, 0, 0.7, 0, 5, 3),
    ...bloom(0.3 * s, col, x, y + 0.42 * s, z, 0xffd23a, 5, 0.3, lo),
  ];
}
// A rose: a cup of overlapping petals.
function rose(r, col, x, y, z) {
  return [egg(r, r * 0.75, r, col, x, y, z, 0, 0, 0, 8, 5), shade(egg(r * 0.62, r * 0.55, r * 0.62, col, x, y + r * 0.42, z, 0, 0.6, 0, 6, 4), 0xd8d8d8),
    tor(r * 0.5, r * 0.16, col, x, y + r * 0.62, z, PI / 2, 0, 0, 3, 8)];
}

// ======================================================================== TEA PARTY
def('sugarcube', {
  label: 'Sugar Cube', col: { t: 'box', w: 0.3, h: 0.3, d: 0.3 }, fit: 0.42, value: 1, mass: 0.15,
  tints: TEA7,
  build: () => {
    const p = [rb(0.3, 0.29, 0.3, TINT, 0, 0, 0, 0.05)];
    for (const [x, z] of [[-0.07, -0.05], [0.06, 0.07], [0.08, -0.08], [-0.06, 0.08], [0, 0]]) p.push(spark(0.022, 0xffffff, x, 0.305, z));
    p.push(pale(rb(0.24, 0.02, 0.24, TINT, 0, 0.285, 0, 0.01), 0.8));
    return p;
  },
});

def('teaspoon', {
  label: 'Teaspoon', col: { t: 'box', w: 0.62, h: 0.08, d: 0.16 }, fit: 0.64, value: 1, mass: 0.15,
  tints: [0xe1e7ef, 0xffc94a, 0xffa9c4, 0xb9e8d6, 0xd2c2ff],
  build: () => C([
    egg(0.1, 0.034, 0.078, TINT, -0.2, 0.034, 0, 0, 0, 0, 12, 6),
    shade(egg(0.08, 0.012, 0.06, TINT, -0.2, 0.062, 0, 0, 0, 0, 10, 4), 0xd6d6d6),
    tbox(0.36, 0.028, 0.05, TINT, 0.0, 0.05, 0, 0, 0, 0.1),
    egg(0.07, 0.02, 0.05, TINT, 0.24, 0.068, 0, 0, 0, 0, 10, 5),
    bead(0.022, 0xff7fa6, 0.24, 0.086, 0),
  ]),
});

def('petitfour', {
  label: 'Petit Four', col: { t: 'box', w: 0.36, h: 0.32, d: 0.36 }, fit: 0.51, value: 1, mass: 0.15,
  tints: TEA7,
  build: () => [
    rb(0.33, 0.1, 0.33, CAKE, 0, 0, 0, 0.03), rb(0.335, 0.03, 0.335, 0xfff6ec, 0, 0.1, 0, 0.012), rb(0.33, 0.08, 0.33, CAKE, 0, 0.13, 0, 0.03),
    rb(0.36, 0.08, 0.36, TINT, 0, 0.2, 0, 0.04),
    ...bloom(0.09, 0xffffff, 0, 0.29, 0, GOLD, 5, 0.1),
  ],
});

def('meringue', {
  label: 'Meringue', col: { t: 'cyl', r: 0.2, h: 0.32 }, fit: 0.4, value: 1, mass: 0.15,
  tints: TEA7,
  build: () => [
    ribLathe([[0, 0], [0.19, 0], [0.2, 0.04], [0.17, 0.12], [0.11, 0.2], [0.06, 0.26], [0.025, 0.3], [0, 0.32]], 8, 0.2, TINT, 0, 0, 0, 24, 1.6),
    pale(lathe([[0, 0], [0.19, 0], [0.19, 0.012], [0, 0.012]], TINT, 0, 0, 0, 16), 0.4),
  ],
});

def('teasandwich', {
  label: 'Tea Sandwich', col: { t: 'box', w: 0.5, h: 0.19, d: 0.42 }, fit: 0.65, value: 1, mass: 0.15,
  tints: [0x8fd36a, 0xffd85a, 0xff9f8a, 0xff6a7f],
  build: () => {
    const tri = [[-0.25, 0.21], [0.25, 0.21], [0, -0.21]];
    const inner = [[-0.2, 0.18], [0.2, 0.18], [0, -0.15]];
    return [
      prism(tri, 0.07, 0xf3d9a8, 0, 0, 0, 0.012), prism(inner, 0.07, 0xfff8ea, 0, 0.002, 0, 0),
      prism([[-0.235, 0.2], [0.235, 0.2], [0, -0.195]], 0.045, TINT, 0, 0.07, 0, 0.01),
      prism(tri, 0.07, 0xf3d9a8, 0, 0.115, 0, 0.012), prism(inner, 0.003, 0xfff8ea, 0, 0.183, 0, 0),
    ];
  },
});

def('creamjug', {
  label: 'Cream Jug', col: { t: 'cyl', r: 0.28, h: 0.5 }, fit: 0.56, value: 1, mass: 0.15,
  tints: [0xff9cbc, 0x8fc4ff, 0x9fe0b8, 0xffd27e],
  build: () => [
    lathe([[0, 0], [0.13, 0], [0.15, 0.02], [0.19, 0.14], [0.19, 0.3], [0.15, 0.4], [0.15, 0.46], [0.17, 0.48], [0, 0.48]], TINT, 0, 0, 0, 16),
    tor(0.188, 0.018, WHITE, 0, 0.22, 0, PI / 2, 0, 0, 3, 16), tor(0.16, 0.015, GOLD, 0, 0.47, 0, PI / 2, 0, 0, 3, 16),
    egg(0.1, 0.03, 0.07, 0xfff8ec, 0, 0.46, 0, 0, 0, 0, 8, 4),
    tcyl(0.03, 0.06, 0.12, TINT, 0.0, 0.45, 0.18, 0.9, 0, 0, 8),
    tor(0.07, 0.022, TINT, 0, 0.27, -0.17, 0, PI / 2, 0, 5, 10),
  ],
});

function cuppaParts() {
  const cup = [[0.13, 0], [0.15, 0.02], [0.23, 0.1], [0.285, 0.24], [0.3, 0.33], [0.29, 0.34], [0.27, 0.31], [0.22, 0.2], [0.14, 0.1], [0, 0.09]];
  return [
    pale(lathe([[0, 0], [0.36, 0], [0.42, 0.035], [0.41, 0.06], [0.3, 0.05], [0, 0.05]], TINT, 0, 0, 0, 22), 0.85),
    shade(tor(0.395, 0.016, TINT, 0, 0.05, 0, PI / 2, 0, 0, 3, 22), 0xe0e0e0),
    lathe(cup, TINT, 0, 0.05, 0, 18),
    tor(0.295, 0.014, GOLD, 0, 0.385, 0, PI / 2, 0, 0, 3, 18),
    pale(tor(0.25, 0.02, TINT, 0, 0.2, 0, PI / 2, 0, 0, 3, 18), 0.25),
    lathe([[0, 0], [0.2, 0], [0, 0.002]], TEA, 0, 0.29, 0, 16),
    tor(0.075, 0.022, TINT, 0.33, 0.24, 0, 0, 0, 0, 5, 10),
  ];
}
def('cuppa', {
  label: 'Teacup', col: { t: 'cyl', r: 0.42, h: 0.42 }, fit: 0.84, value: 1, mass: 0.15,
  tints: CUP8,
  build: () => cuppaParts(),
});
def('bigcuppa', {
  label: 'Big Teacup', col: { t: 'cyl', r: 0.97, h: 0.94 }, fit: 1.94, value: 6, mass: 0.8,
  tints: CUP8,
  build: () => scaled(cuppaParts(), 2.3, 2.25, 2.3),
});

function teapotParts() {
  return [
    egg(0.34, 0.27, 0.34, TINT, 0, 0.31, 0, 0, 0, 0, 16, 10),
    lathe([[0, 0], [0.24, 0], [0.24, 0.05], [0, 0.05]], WHITE, 0, 0.02, 0, 16),
    pale(tor(0.335, 0.025, TINT, 0, 0.3, 0, PI / 2, 0, 0, 3, 18), 0.3),
    lathe([[0.2, 0], [0.21, 0.03], [0.17, 0.07], [0.08, 0.1], [0, 0.1]], TINT, 0, 0.54, 0, 14),
    bead(0.05, GOLD, 0, 0.67, 0),
    tcyl(0.035, 0.075, 0.3, TINT, 0.36, 0.38, 0, 0, 0, -0.95, 8),
    tor(0.13, 0.03, TINT, -0.36, 0.33, 0, 0, 0, 0, 5, 12),
    ...[0, 1, 2, 3].map((i) => { const a = i * PI / 2 + PI / 4; return bead(0.05, 0xffffff, Math.sin(a) * 0.3, 0.35, Math.cos(a) * 0.3); }),
  ];
}
def('tinyteapot', {
  label: 'Little Teapot', col: { t: 'cyl', r: 0.5, h: 0.72 }, fit: 1.0, value: 2, mass: 0.2,
  tints: CUP8,
  build: () => teapotParts(),
});

def('cakestand', {
  label: 'Cake Stand', col: { t: 'cyl', r: 0.75, h: 1.1 }, fit: 1.5, value: 4, mass: 0.5,
  tints: [0xff9cc6, 0xffd27e, 0x9fe0c4, 0xc4a3ff, 0x9fd3ff],
  build: () => {
    const p = [
      lathe([[0, 0], [0.28, 0], [0.3, 0.04], [0.1, 0.1], [0.07, 0.3], [0.12, 0.34], [0, 0.34]], WHITE, 0, 0, 0, 16),
      lathe([[0, 0], [0.73, 0], [0.75, 0.04], [0.7, 0.06], [0, 0.06]], WHITE, 0, 0.34, 0, 24),
      tor(0.74, 0.015, GOLD, 0, 0.38, 0, PI / 2, 0, 0, 3, 24),
      lathe([[0, 0], [0.52, 0], [0.52, 0.42], [0, 0.42]], CAKE, 0, 0.4, 0, 22),
      ribLathe([[0, 0], [0.55, 0], [0.56, 0.06], [0.48, 0.14], [0, 0.16]], 14, 0.06, TINT, 0, 0.74, 0, 28),
      pale(tor(0.53, 0.03, TINT, 0, 0.44, 0, PI / 2, 0, 0, 4, 22), 0.6),
    ];
    for (let i = 0; i < 7; i++) { const a = i * TAU / 7; p.push(spark(0.055, 0xff3f5e, Math.sin(a) * 0.36, 0.95, Math.cos(a) * 0.36)); }
    p.push(bead(0.08, 0xff3f5e, 0, 0.94, 0), tcyl(0.008, 0.008, 0.08, 0x3f9e55, 0.02, 1.06, 0, 0, 0, 0.4, 4));
    return p;
  },
});

def('tieredtray', {
  label: 'Tiered Tray', col: { t: 'cyl', r: 0.9, h: 1.9 }, fit: 1.8, value: 5, mass: 0.6,
  tints: [0xff9cc6, 0x9fe0c4, 0xffd27e, 0xc4a3ff],
  build: () => {
    const p = [tcyl(0.035, 0.035, 1.7, GOLD, 0, 0.85, 0, 0, 0, 0, 8), tor(0.11, 0.025, GOLD, 0, 1.79, 0, 0, 0, 0, 4, 12)];
    const TREAT = [0xff7fa6, 0x93e2bd, 0xffd27e, 0xc4a3ff, 0xffbfd2, 0x9fd3ff];
    [[0.9, 0.0, 6], [0.68, 0.62, 4], [0.46, 1.18, 3]].forEach(([r, y, n], t) => {
      p.push(lathe([[0, 0], [r - 0.04, 0], [r, 0.07], [r - 0.08, 0.04], [0, 0.04]], WHITE, 0, y, 0, 14));
      p.push(shade(tor(r - 0.01, 0.022, TINT, 0, y + 0.07, 0, PI / 2, 0, 0, 3, 12), 0xe8e8e8));
      for (let i = 0; i < n; i++) {
        const a = (i + t * 0.5) * TAU / n, x = Math.sin(a) * (r - 0.22), z = Math.cos(a) * (r - 0.22), c = TREAT[(i + t * 2) % TREAT.length];
        if ((i + t) % 2) p.push(tcyl(0.09, 0.1, 0.05, c, x, y + 0.085, z, 0, 0, 0, 7), tcyl(0.085, 0.085, 0.03, 0xfff4e6, x, y + 0.125, z, 0, 0, 0, 7), tcyl(0.1, 0.09, 0.05, c, x, y + 0.165, z, 0, 0, 0, 7));
        else p.push(tbox(0.17, 0.15, 0.17, CAKE, x, y + 0.135, z), tbox(0.18, 0.045, 0.18, c, x, y + 0.23, z), spark(0.035, 0xff3f5e, x, y + 0.29, z));
      }
    });
    return p;
  },
});

def('teachair', {
  label: 'Garden Chair', col: { t: 'box', w: 1.3, h: 2.0, d: 1.3 }, fit: 1.84, value: 5, mass: 0.6,
  tints: [0xffffff, 0xffc4d6, 0xb9ead6, 0xc9d6ff, 0xffe6a8],
  build: () => {
    const p = [];
    for (const [x, z] of [[-0.55, -0.5], [0.55, -0.5], [-0.55, 0.55], [0.55, 0.55]]) p.push(tcyl(0.045, 0.04, 0.85, TINT, x, 0.425, z, 0, 0, 0, 8));
    p.push(rb(1.3, 0.1, 1.2, TINT, 0, 0.82, 0.05, 0.04), rb(1.1, 0.12, 1.0, 0xff9cbc, 0, 0.92, 0.1, 0.06));
    // curly back: a hoop with a heart
    p.push(tor(0.5, 0.045, TINT, 0, 1.45, -0.55, 0, 0, 0, 5, 20));
    for (const s of [-1, 1]) p.push(tcyl(0.045, 0.045, 1.1, TINT, s * 0.5, 1.4, -0.55, 0, 0, 0, 8));
    p.push(...[[0, 1.48], [-0.2, 1.62], [0.2, 1.62]].map(([x, y]) => tor(0.12, 0.025, TINT, x, y, -0.55, 0, 0, 0, 4, 10)));
    for (const s of [-1, 1]) p.push(tcyl(0.03, 0.03, 1.1, TINT, s * 0.55, 0.3, 0.02, PI / 2, 0, 0, 6));
    return p;
  },
});

def('teatable', {
  label: 'Tea Table', col: { t: 'cyl', r: 1.4, h: 1.52 }, fit: 2.8, value: 13, mass: 1.4,
  tints: [0xffb3c7, 0x9fd8c4, 0xa8ccff, 0xffd98a, 0xcdb4ff],
  build: () => {
    const p = [
      ribLathe([[1.38, 0], [1.36, 0.1], [1.3, 0.5], [1.26, 0.9], [1.24, 0.98], [1.2, 1.0], [0, 1.02]], 16, 0.05, TINT, 0, 0, 0, 32),
      pale(tor(1.37, 0.05, TINT, 0, 0.07, 0, PI / 2, 0, 0, 4, 32), 0.2),
      pale(tor(1.235, 0.04, TINT, 0, 0.98, 0, PI / 2, 0, 0, 4, 28), 0.15),
    ];
    // lace scallops round the top
    for (let i = 0; i < 16; i++) { const a = i * TAU / 16; p.push(egg(0.2, 0.12, 0.04, WHITE, Math.sin(a) * 1.25, 0.86, Math.cos(a) * 1.25, 0, a, 0, 6, 3)); }
    // a little tea set on top
    p.push(...potLo(0xffffff, -0.2, 1.02, -0.15, 0.7));
    for (const [x, z, c] of [[0.55, 0.35, 0xff9cbc], [0.3, -0.6, 0x8fc4ff], [-0.65, 0.5, 0xffd27e]]) p.push(...cupLo(c, x, 1.02, z, 0.75));
    p.push(lathe([[0, 0], [0.25, 0], [0.27, 0.03], [0, 0.03]], WHITE, 0.6, 1.02, -0.25, 12));
    for (let i = 0; i < 3; i++) p.push(tbox(0.1, 0.08, 0.1, [0xffbfd2, 0x93e2bd, 0xffd27e][i], 0.52 + (i % 2) * 0.12, 1.09, -0.32 + i * 0.07));
    return p;
  },
});

def('teatrolley', {
  label: 'Tea Trolley', col: { t: 'box', w: 2.6, h: 1.9, d: 1.4 }, fit: 2.95, value: 14, mass: 1.4,
  tints: [0xff9cbc, 0x8fc4ff, 0x9fe0b8, 0xffcf6a, 0xc5a8ff],
  build: () => {
    const p = [];
    for (const [x, z] of [[-1.05, -0.55], [1.05, -0.55], [-1.05, 0.55], [1.05, 0.55]]) {
      p.push(tcyl(0.05, 0.05, 1.1, GOLD, x, 0.75, z, 0, 0, 0, 8));
      p.push(tcyl(0.16, 0.16, 0.08, 0x5a4a5a, x, 0.16, z, PI / 2, 0, 0, 10), spark(0.05, GOLD, x, 0.21, z + 0.05));
    }
    p.push(rb(2.3, 0.08, 1.2, TINT, 0, 0.42, 0), rb(2.3, 0.1, 1.2, TINT, 0, 1.2, 0), pale(rb(2.0, 0.02, 0.95, TINT, 0, 1.3, 0, 0.01), 0.35));
    p.push(tor(0.25, 0.04, GOLD, 1.3, 1.28, 0, 0, PI / 2, 0, 4, 12, PI));
    p.push(tcyl(0.04, 0.04, 1.2, GOLD, 1.3, 1.53, 0, PI / 2, 0, 0, 8));
    // top: a cake on a stand and a teapot; bottom: cups and a stack of plates
    p.push(lathe([[0, 0], [0.3, 0], [0.32, 0.03], [0, 0.03]], WHITE, -0.55, 1.3, 0), lathe([[0, 0], [0.26, 0], [0.26, 0.26], [0, 0.26]], CAKE, -0.55, 1.33, 0, 16));
    p.push(ribLathe([[0, 0], [0.28, 0], [0.24, 0.08], [0, 0.09]], 10, 0.06, 0xff9ec0, -0.55, 1.56, 0, 16), bead(0.06, 0xff3f5e, -0.55, 1.63, 0));
    p.push(...potLo(0xfffaf4, 0.45, 1.3, 0, 0.75));
    for (const [x, z, c] of [[-0.7, 0.25, 0xff9cbc], [-0.2, -0.25, 0x9fe0b8], [0.3, 0.25, 0x8fc4ff]]) p.push(...cupLo(c, x, 0.5, z, 0.8));
    p.push(lathe([[0, 0], [0.3, 0], [0.32, 0.18], [0.28, 0.2], [0, 0.18]], WHITE, 0.75, 0.5, -0.1, 14));
    return C(p);
  },
});

def('teapothouse', {
  label: 'Teapot Cottage', col: { t: 'cyl', r: 2.6, h: 4.5 }, fit: 5.2, value: 43, mass: 8,
  tints: [0xff9cbc, 0x8fd0ff, 0xffd27e, 0x9fe0b8],
  build: () => {
    const body = egg(1.9, 1.55, 1.9, TINT, 0, 1.6, 0, 0, 0, 0, 18, 10);
    const p = [
      lathe([[0, 0], [1.5, 0], [1.55, 0.12], [1.3, 0.22], [0, 0.22]], WHITE, 0, 0, 0, 18),
      body,
      pale(tor(1.87, 0.09, TINT, 0, 1.6, 0, PI / 2, 0, 0, 3, 24), 0.25),
      pale(tor(1.5, 0.07, TINT, 0, 2.55, 0, PI / 2, 0, 0, 3, 20), 0.25),
      // polka dots
      ...Array.from({ length: 8 }, (_, i) => { const a = (i + 0.5) * TAU / 8, y = i % 2 ? 2.15 : 1.05, rr = i % 2 ? 1.72 : 1.78; return egg(0.17, 0.17, 0.05, 0xffffff, Math.sin(a) * rr, y, Math.cos(a) * rr, 0, a, 0, 6, 3); }),
      // the lid is a little roof with a chimney knob
      lathe([[1.2, 0], [1.25, 0.08], [1.05, 0.4], [0.6, 0.72], [0.2, 0.86], [0, 0.88]], TINT, 0, 2.95, 0, 18),
      shade(lathe([[1.24, 0], [1.3, 0.05], [1.24, 0.1], [0, 0.1]], TINT, 0, 2.92, 0, 18), 0xd8d8d8),
      lathe([[0, 0], [0.28, 0], [0.32, 0.25], [0.25, 0.42], [0.1, 0.5], [0, 0.5]], GOLD, 0, 3.8, 0, 12),
      bead(0.12, 0xffffff, 0.28, 4.32, 0.05), bead(0.09, 0xffffff, 0.48, 4.42, 0.08),
      // spout (+x) and handle (-x)
      tcyl(0.22, 0.42, 1.25, TINT, 1.95, 2.1, 0, 0, 0, -0.85, 14),
      tor(0.24, 0.06, GOLD, 2.42, 2.55, 0, PI / 2 - 0.85, 0, 0, 3, 10),
      tor(0.55, 0.15, TINT, -1.9, 1.75, 0, 0, 0, 0, 4, 12, PI * 1.2),
      // front door, windows with boxes of flowers, a path stone and a smile
      vprism([[-0.38, 0], [0.38, 0], [0.38, 0.8], [0, 1.15], [-0.38, 0.8]], 0.12, WOOD, 0, 0.22, 1.62, 0),
      bead(0.05, GOLD, 0.22, 0.75, 1.72), vprism([[-0.3, 0], [0.3, 0], [0.3, 0.06], [-0.3, 0.06]], 0.2, WHITE, 0, 1.4, 1.66),
      ...[-1, 1].flatMap((s) => [
        egg(0.32, 0.32, 0.06, 0x8fd0ff, s * 1.05, 1.95, 1.48, 0, s * 0.62, 0, 10, 5),
        tor(0.32, 0.05, WHITE, s * 1.05, 1.95, 1.49, 0, s * 0.62, 0, 3, 14),
        tbox(0.7, 0.16, 0.2, WOOD, s * 1.1, 1.55, 1.5, 0, s * 0.62, 0),
        ...[-0.22, 0, 0.22].map((d, k) => spark(0.1, [0xff4a62, 0xffd93f, 0xff7fb0][k], s * 1.1 + Math.cos(s * 0.62) * d, 1.7, 1.5 - Math.sin(s * 0.62) * d * s)),
      ]),
      ...face(0, 2.85, 1.37, 0.32, 0.09),
      tcyl(0.5, 0.55, 0.06, 0xd9c8b4, 0, 0.03, 1.95, 0, 0, 0, 10),
    ];
    return scaled(C(p), 0.95, 1, 0.95);
  },
});

// ======================================================================== FLOWER SHOP
def('petal', {
  label: 'Petal', col: { t: 'cyl', r: 0.17, h: 0.07 }, fit: 0.34, value: 1, mass: 0.15,
  tints: FLO8,
  build: () => [
    egg(0.17, 0.03, 0.11, TINT, 0, 0.03, 0, 0, 0.3, 0, 12, 6),
    pale(egg(0.12, 0.012, 0.035, TINT, 0.01, 0.055, 0, 0, 0.3, 0, 8, 4), 0.45),
  ],
});

def('rosebud', {
  label: 'Rosebud', col: { t: 'box', w: 0.62, h: 0.2, d: 0.2 }, fit: 0.65, value: 1, mass: 0.15,
  tints: FLO8,
  build: () => C([
    tcyl(0.025, 0.025, 0.44, LEAF_D, -0.08, 0.1, 0, 0, 0, PI / 2, 6),
    egg(0.09, 0.03, 0.05, LEAF, -0.06, 0.07, 0.05, 0, -0.6, 0, 8, 5),
    egg(0.12, 0.08, 0.08, TINT, 0.2, 0.1, 0, 0, 0, PI / 2 - 0.2, 10, 8),
    shade(egg(0.07, 0.05, 0.06, TINT, 0.27, 0.12, 0, 0, 0, 0, 8, 6), 0xd0d0d0),
    ...[-1, 1].map((s) => egg(0.08, 0.02, 0.035, LEAF_D, 0.12, 0.1, s * 0.05, 0, s * 0.4, 0, 6, 4)),
  ]),
});

def('seedpacket', {
  label: 'Seed Packet', col: { t: 'box', w: 0.36, h: 0.06, d: 0.48 }, fit: 0.6, value: 1, mass: 0.15,
  tints: [0xff9fb8, 0xffd36e, 0x9fe0b4, 0x9fc8ff, 0xc9a8ff],
  build: () => [
    rb(0.36, 0.05, 0.48, TINT, 0, 0, 0, 0.015),
    tbox(0.28, 0.006, 0.22, 0xffffff, 0, 0.053, 0.05),
    ...bloom(0.12, 0xff6f9c, 0, 0.06, 0.05, 0xffd23a, 5, 0),
    tbox(0.3, 0.006, 0.06, 0xffffff, 0, 0.053, -0.17),
  ],
});

function posyParts() {
  return [
    lathe([[0, 0], [0.18, 0], [0.22, 0.27], [0.25, 0.28], [0.25, 0.34], [0.2, 0.34], [0, 0.32]], TERRA, 0, 0, 0, 16),
    tor(0.24, 0.02, 0xf3a57a, 0, 0.31, 0, PI / 2, 0, 0, 3, 16),
    egg(0.2, 0.04, 0.2, SOIL, 0, 0.32, 0, 0, 0, 0, 10, 4),
    ...[0, 1, 2, 3].map((i) => egg(0.11, 0.03, 0.06, LEAF, Math.sin(i * PI / 2 + 0.4) * 0.15, 0.38, Math.cos(i * PI / 2 + 0.4) * 0.15, 0, i * PI / 2 + 0.4 + PI / 2, 0, 8, 4)),
    tcyl(0.02, 0.02, 0.2, LEAF_D, 0, 0.44, 0, 0, 0, 0, 5),
    ...bloom(0.32, TINT, 0, 0.56, 0, 0xffd23a, 5, 0.3),
  ];
}
def('posy', {
  label: 'Flower Pot', col: { t: 'cyl', r: 0.3, h: 0.62 }, fit: 0.6, value: 1, mass: 0.15,
  tints: FLO8,
  build: () => posyParts(),
});
def('bigposy', {
  label: 'Big Flower Pot', col: { t: 'cyl', r: 0.78, h: 1.68 }, fit: 1.56, value: 4, mass: 0.6,
  tints: FLO8,
  build: () => scaled(posyParts(), 2.6),
});

def('ribbonroll', {
  label: 'Ribbon Roll', col: { t: 'cyl', r: 0.3, h: 0.3 }, fit: 0.6, value: 1, mass: 0.15,
  tints: [0xff7fa6, 0xffbfd2, 0xffd27e, 0x93e2bd, 0x9fd3ff, 0xc4a3ff],
  build: () => [
    pale(lathe([[0, 0], [0.28, 0], [0.28, 0.03], [0, 0.03]], TINT, 0, 0, 0, 20), 0.35),
    lathe([[0.1, 0], [0.26, 0], [0.26, 0.22], [0.1, 0.22]], TINT, 0, 0.03, 0, 20),
    pale(tor(0.262, 0.012, TINT, 0, 0.14, 0, PI / 2, 0, 0, 3, 20), 0.5),
    pale(lathe([[0.08, 0], [0.28, 0], [0.28, 0.03], [0.08, 0.03]], TINT, 0, 0.25, 0, 20), 0.35),
    tcyl(0.08, 0.08, 0.27, 0xd9b48a, 0, 0.14, 0, 0, 0, 0, 10),
    tbox(0.12, 0.006, 0.05, TINT, 0.2, 0.003, 0.12, 0, 0.5, 0),
  ],
});

def('florcan', {
  label: 'Watering Can', col: { t: 'box', w: 0.9, h: 0.7, d: 0.42 }, fit: 0.99, value: 2, mass: 0.2,
  tints: [0x8fd0ff, 0xff9cbc, 0x9fe0b8, 0xffd27e, 0xc5a8ff],
  build: () => C([
    lathe([[0, 0], [0.19, 0], [0.21, 0.02], [0.21, 0.4], [0.18, 0.43], [0, 0.43]], TINT, 0, 0, 0, 16),
    pale(tor(0.21, 0.018, TINT, 0, 0.12, 0, PI / 2, 0, 0, 3, 16), 0.4),
    ...[0, 1, 2, 3, 4].map((i) => { const a = i * TAU / 5; return egg(0.05, 0.05, 0.012, 0xffffff, Math.sin(a) * 0.05, 0.24 + Math.cos(a) * 0.05, 0.208, 0, 0, 0, 6, 4); }), egg(0.03, 0.03, 0.014, 0xffd23a, 0, 0.24, 0.21, 0, 0, 0, 6, 4),
    tcyl(0.025, 0.045, 0.42, TINT, 0.33, 0.33, 0, 0, 0, -1.0, 8),
    lathe([[0, 0], [0.07, 0.02], [0.08, 0.06], [0, 0.06]], SILVER, 0.49, 0.47, 0, 10),
    tor(0.16, 0.03, TINT, 0, 0.5, 0, 0, 0, 0, 5, 12, PI),
    tor(0.11, 0.03, TINT, -0.22, 0.3, 0, 0, 0, 0, 5, 10, PI),
  ].map((g) => g)),
});

def('bouquet', {
  label: 'Bouquet', col: { t: 'cyl', r: 0.4, h: 1.0 }, fit: 0.8, value: 1, mass: 0.15,
  tints: FLO8,
  build: () => {
    const p = [
      lathe([[0.06, 0], [0.12, 0.05], [0.32, 0.62], [0.34, 0.66], [0.06, 0.2]], 0xf6e4c8, 0, 0, 0, 12),
      lathe([[0.07, 0.04], [0.3, 0.6], [0.29, 0.62], [0.05, 0.05]], 0xffffff, 0, 0.02, 0, 12),
      tor(0.12, 0.03, 0xff7fb0, 0, 0.18, 0, PI / 2, 0, 0, 4, 12),
      egg(0.08, 0.05, 0.03, 0xff7fb0, 0.09, 0.15, 0.13, 0, 0, 0.6, 6, 4), egg(0.08, 0.05, 0.03, 0xff7fb0, -0.09, 0.15, 0.13, 0, 0, -0.6, 6, 4),
    ];
    for (let i = 0; i < 6; i++) { const a = i * TAU / 6; p.push(egg(0.12, 0.03, 0.06, LEAF, Math.sin(a) * 0.27, 0.66, Math.cos(a) * 0.27, 0.4 * Math.cos(a), a + PI / 2, 0, 6, 3)); }
    p.push(...rose(0.11, TINT, 0, 0.78, 0));
    for (let i = 0; i < 5; i++) { const a = i * TAU / 5 + 0.3; p.push(...rose(0.09, TINT, Math.sin(a) * 0.19, 0.72, Math.cos(a) * 0.19)); }
    for (let i = 0; i < 5; i++) { const a = i * TAU / 5 + 0.9; p.push(spark(0.035, 0xffffff, Math.sin(a) * 0.26, 0.8, Math.cos(a) * 0.26)); }
    return p;
  },
});

def('vase', {
  label: 'Vase', col: { t: 'cyl', r: 0.27, h: 1.12 }, fit: 0.54, value: 1, mass: 0.15,
  tints: [0x9fd3ff, 0xffbfd2, 0x93e2bd, 0xffd27e, 0xc4a3ff, 0xffffff],
  build: () => {
    const p = [
      ribLathe([[0, 0], [0.16, 0], [0.24, 0.12], [0.26, 0.3], [0.18, 0.5], [0.12, 0.58], [0.15, 0.64], [0, 0.62]], 10, 0.07, TINT, 0, 0, 0, 20),
      pale(tor(0.25, 0.02, TINT, 0, 0.24, 0, PI / 2, 0, 0, 3, 18), 0.4),
    ];
    const T = [0xff4a62, 0xffd93f, 0xff7fb0];
    [[0, 0, 1.0, 0], [-0.17, 0.05, 0.86, -0.3], [0.17, -0.04, 0.88, 0.3]].forEach(([x, z, h, rz], i) => {
      p.push(tcyl(0.018, 0.018, h - 0.55, LEAF_D, x * 0.5, 0.55 + (h - 0.55) / 2, z * 0.5, 0, 0, rz * 0.3, 5));
      p.push(lathe([[0, 0], [0.07, 0.02], [0.09, 0.1], [0.08, 0.16], [0.05, 0.15], [0.03, 0.17], [0, 0.12]], T[i], x, h - 0.06, z, 10));
    });
    p.push(egg(0.13, 0.03, 0.05, LEAF, 0.12, 0.7, 0.05, 0, 0.3, 0.6, 8, 4), egg(0.13, 0.03, 0.05, LEAF, -0.12, 0.66, -0.05, 0, -0.3, -0.6, 8, 4));
    return p;
  },
});

def('flowerbucket', {
  label: 'Flower Bucket', col: { t: 'cyl', r: 0.55, h: 1.1 }, fit: 1.1, value: 2, mass: 0.3,
  tints: FLO8,
  build: () => {
    const p = [
      lathe([[0, 0], [0.34, 0], [0.42, 0.62], [0.45, 0.66], [0, 0.68]], 0xc8d2dc, 0, 0, 0, 14),
      tor(0.37, 0.022, 0xa8b4c2, 0, 0.18, 0, PI / 2, 0, 0, 3, 14), tor(0.415, 0.022, 0xa8b4c2, 0, 0.5, 0, PI / 2, 0, 0, 3, 14),
      tbox(0.3, 0.16, 0.02, 0xfff6e2, 0, 0.3, 0.4, -0.12, 0, 0),
    ];
    for (let i = 0; i < 6; i++) { const a = i * TAU / 6; p.push(egg(0.16, 0.03, 0.07, LEAF, Math.sin(a) * 0.36, 0.76, Math.cos(a) * 0.36, 0.5 * Math.cos(a), a + PI / 2, 0, 6, 3)); }
    p.push(...bloom(0.26, TINT, 0, 0.98, 0, 0xffd23a, 6, 0.2, 1));
    for (let i = 0; i < 4; i++) { const a = i * TAU / 4 + 0.4; p.push(...bloom(0.24, TINT, Math.sin(a) * 0.3, 0.88, Math.cos(a) * 0.3, i % 2 ? 0xffffff : 0xffd23a, 5, 0.35, 1)); }
    return p;
  },
});

def('flowercrate', {
  label: 'Crate of Blooms', col: { t: 'box', w: 1.6, h: 0.72, d: 1.1 }, fit: 1.94, value: 6, mass: 0.6,
  tints: FLO8,
  build: () => {
    const p = [box0(1.56, 0.06, 1.06, WOOD_D, 0, 0, 0)];
    for (const y of [0.08, 0.3]) {
      p.push(tbox(1.6, 0.16, 0.06, WOOD, 0, y + 0.08, 0.52), tbox(1.6, 0.16, 0.06, WOOD, 0, y + 0.08, -0.52));
      p.push(tbox(0.06, 0.16, 1.0, WOOD, 0.77, y + 0.08, 0), tbox(0.06, 0.16, 1.0, WOOD, -0.77, y + 0.08, 0));
    }
    for (const [x, z] of [[-0.77, -0.52], [0.77, -0.52], [-0.77, 0.52], [0.77, 0.52]]) p.push(tbox(0.1, 0.5, 0.1, WOOD_D, x, 0.25, z));
    p.push(tbox(1.48, 0.06, 0.98, SOIL, 0, 0.42, 0));
    for (let i = 0; i < 6; i++) {
      const x = -0.48 + (i % 3) * 0.48, z = i < 3 ? -0.24 : 0.24;
      p.push(egg(0.17, 0.03, 0.07, LEAF, x - 0.12, 0.5, z + 0.1, 0, 0.6, 0, 5, 3), egg(0.17, 0.03, 0.07, LEAF, x + 0.12, 0.5, z - 0.1, 0, 0.6, 0, 5, 3));
      p.push(...bloom(0.4, i % 2 ? TINT : pickCol(i), x, 0.6, z, i % 2 ? 0xffd23a : 0xffffff, 5, 0.3, 1));
    }
    return p;
  },
});
function box0(w, h, d, col, x, y, z) { return tbox(w, h, d, col, x, y + h / 2, z); }
const pickCol = (i) => [0xfffbf2, 0xffd93f, 0xff7fb0, 0xb27aff, 0xff9a3c, 0xffbcd6][i % 6];

def('flowershelf', {
  label: 'Flower Shelf', col: { t: 'box', w: 2.4, h: 2.2, d: 1.0 }, fit: 2.6, value: 11, mass: 0.9,
  tints: PAINT,
  build: () => {
    const p = [];
    for (const s of [-1, 1]) for (const z of [-0.41, 0.41]) p.push(tbox(0.08, 1.75, 0.08, TINT, s * 1.16, 0.875, z));
    const COLS = [0xff4a62, 0xffd93f, 0xff7fb0, 0xb27aff, 0xffffff, 0xff9a3c];
    [[0.2, 0.9], [0.85, 0.7], [1.5, 0.5]].forEach(([y, d], k) => {
      p.push(rb(2.4, 0.07, d, TINT, 0, y, 0.45 - d / 2, 0.02));
      for (let i = 0; i < 3; i++) p.push(...potFlower(COLS[(i + k * 2) % COLS.length], -0.75 + i * 0.75, y + 0.07, 0.45 - d / 2, 1.2, 1));
    });
    return p;
  },
});

def('potbench', {
  label: 'Potting Bench', col: { t: 'box', w: 3.0, h: 2.0, d: 1.4 }, fit: 3.31, value: 18, mass: 1.6,
  tints: PAINT,
  build: () => {
    const p = [];
    for (const [x, z] of [[-1.4, -0.6], [1.4, -0.6], [-1.4, 0.6], [1.4, 0.6]]) p.push(tbox(0.12, 1.0, 0.12, TINT, x, 0.5, z));
    p.push(rb(3.0, 0.12, 1.4, WOOD_L, 0, 1.0, 0, 0.03), rb(2.8, 0.06, 1.2, TINT, 0, 0.3, 0, 0.02));
    p.push(rb(3.0, 0.9, 0.1, TINT, 0, 1.1, -0.65, 0.03), rb(3.0, 0.08, 0.3, WOOD_L, 0, 1.92, -0.55, 0.02));
    // pots on top and below, a can, a sack of soil, tools on the back board
    const COLS = [0xff4a62, 0xffd93f, 0xff7fb0, 0xb27aff, 0xffffff];
    [-1.0, -0.2, 0.6].forEach((x, i) => p.push(...potFlower(COLS[i], x, 1.12, 0.2, 1.3, 1)));
    for (let i = 0; i < 3; i++) p.push(lathe([[0, 0], [0.16, 0], [0.2, 0.25], [0, 0.25]], TERRA, -0.9 + i * 0.12, 0.36 + i * 0.22, 0.1, 12));
    p.push(rb(0.7, 0.5, 0.45, 0xd8c19a, 0.6, 0.36, 0.1, 0.12), tbox(0.4, 0.2, 0.01, 0x7fbf6a, 0.6, 0.62, 0.33));
    p.push(lathe([[0, 0], [0.2, 0], [0.22, 0.38], [0, 0.38]], 0x8fd0ff, 1.1, 1.12, -0.25, 14), tcyl(0.02, 0.04, 0.3, 0x8fd0ff, 1.28, 1.35, -0.25, 0, 0, -1.0, 6));
    for (const [x, c] of [[-1.0, SILVER], [-0.6, WOOD_D], [0.2, SILVER]]) { p.push(tbox(0.04, 0.45, 0.03, c, x, 1.55, -0.58)); p.push(tbox(0.16, 0.2, 0.03, SILVER, x, 1.25, -0.58)); }
    return p;
  },
});

def('flowercart', {
  label: 'Flower Cart', col: { t: 'box', w: 4.6, h: 3.5, d: 2.4 }, fit: 5.19, value: 43, mass: 8,
  tints: [0xff7fa6, 0x6fbaff, 0x8fdba8, 0xffb84a],
  build: () => {
    const p = [];
    // wheels on the sides (cart points +x), the body, handles out the back (-x)
    for (const s of [-1, 1]) {
      p.push(tcyl(0.75, 0.75, 0.12, WOOD_D, 0.4, 0.75, s * 1.12, PI / 2, 0, 0, 16), tcyl(0.62, 0.62, 0.14, WOOD_L, 0.4, 0.75, s * 1.12, PI / 2, 0, 0, 16));
      p.push(tcyl(0.14, 0.14, 0.2, GOLD, 0.4, 0.75, s * 1.15, PI / 2, 0, 0, 10));
      for (let i = 0; i < 6; i++) p.push(tbox(0.06, 1.15, 0.06, WOOD_D, 0.4, 0.75, s * 1.13, 0, 0, i * PI / 6));
      p.push(tcyl(0.05, 0.05, 1.6, WOOD_D, -2.0, 1.15, s * 0.8, 0, 0, PI / 2 - 0.2, 8));
    }
    p.push(rb(3.4, 0.9, 1.9, TINT, 0.2, 0.75, 0, 0.08), pale(rb(3.45, 0.16, 1.95, TINT, 0.2, 1.62, 0, 0.05), 0.35));
    for (let i = 0; i < 5; i++) p.push(tbox(0.04, 0.6, 0.02, 0xffffff, -1.2 + i * 0.7, 1.2, 0.96));
    // posts and a striped awning
    for (const [x, z] of [[-1.35, -0.85], [1.75, -0.85], ]) p.push(tcyl(0.05, 0.05, 1.6, WHITE, x, 2.45, z, 0, 0, 0, 8));
    const aw = new THREE.CylinderGeometry(0.85, 0.85, 3.6, 16, 1, false, -PI / 2, PI).rotateZ(PI / 2).scale(1, 0.42, 1).translate(0.2, 3.1, -0.4);
    p.push(...multi(aw, (x) => Math.floor((x + 2) / 0.45) % 2, [TINT, 0xfffaf4]));
    for (let i = 0; i < 8; i++) p.push(egg(0.24, 0.16, 0.06, i % 2 ? 0xfffaf4 : TINT, -1.4 + i * 0.46, 3.05, 0.42, 0, 0, 0, 6, 3));
    // buckets of flowers in rows
    const COLS = [0xff4a62, 0xffd93f, 0xff7fb0, 0xb27aff, 0xfffbf2, 0xff9a3c, 0x8b9cff, 0xffbcd6];
    for (let r = 0; r < 2; r++) for (let i = 0; i < 4; i++) {
      const x = -1.0 + i * 0.85, z = r ? 0.42 : -0.42, c = COLS[(i * 3 + r * 5) % COLS.length];
      p.push(lathe([[0, 0], [0.26, 0], [0.32, 0.4], [0, 0.4]], 0xc8d2dc, x, 1.62, z, 8));
      p.push(...bloom(0.44, c, x, 2.08, z, 0xffd23a, 5, 0.25, 2));
      p.push(egg(0.2, 0.03, 0.08, LEAF, x - 0.18, 2.0, z - 0.12, 0.3, 0.7, 0, 4, 3), egg(0.2, 0.03, 0.08, LEAF, x + 0.18, 2.0, z + 0.12, 0.3, 0.7, 0, 4, 3));
    }
    p.push(vprism([[-0.7, 0], [0.7, 0], [0.7, 0.4], [-0.7, 0.4]], 0.06, 0xfff6e2, 0.2, 3.62 - 0.4, 0.0, 0, 0.02));
    for (const [x, c] of [[-0.3, 0xff4a62], [0.2, 0xffd93f], [0.7, 0xb27aff]]) p.push(egg(0.12, 0.12, 0.03, c, x, 3.42, 0.06, 0, 0, 0, 6, 4), egg(0.05, 0.05, 0.04, 0xffd23a, x, 3.42, 0.08, 0, 0, 0, 5, 3));
    return scaled(C(p), 0.95);
  },
});

// ======================================================================== COZY LIBRARY
def('bookmark', {
  label: 'Bookmark', col: { t: 'box', w: 0.16, h: 0.04, d: 0.5 }, fit: 0.52, value: 1, mass: 0.15,
  tints: BOOK8,
  build: () => [
    vprism([[-0.08, -0.2], [0.08, -0.2], [0.08, 0.25], [0, 0.2], [-0.08, 0.25]].map(([u, v]) => [u, v]), 0.02, TINT, 0, 0, 0, 0).rotateX(-PI / 2).translate(0, 0.01, 0),
    pale(tbox(0.11, 0.004, 0.06, TINT, 0, 0.022, -0.1), 0.6),
    egg(0.035, 0.015, 0.035, GOLD, 0, 0.02, -0.15, 0, 0, 0, 8, 4),
    tbox(0.012, 0.01, 0.06, GOLD, 0, 0.02, -0.21), egg(0.025, 0.018, 0.035, GOLD, 0, 0.018, -0.235, 0, 0, 0, 6, 4),
  ],
});

def('pencil', {
  label: 'Pencil', col: { t: 'box', w: 0.64, h: 0.1, d: 0.1 }, fit: 0.65, value: 1, mass: 0.15,
  tints: [0xffd23a, 0xff7fa6, 0x6fbaff, 0x8fdba8, 0xc4a3ff, 0xff9a3c],
  build: () => C([
    tcyl(0.05, 0.05, 0.44, TINT, 0, 0.05, 0, 0, 0, PI / 2, 6),
    tcyl(0.012, 0.05, 0.1, 0xf3d1a0, 0.27, 0.05, 0, 0, 0, -PI / 2, 6),
    tcyl(0.002, 0.014, 0.03, INK, 0.33, 0.05, 0, 0, 0, -PI / 2, 6),
    tcyl(0.052, 0.052, 0.05, SILVER, -0.245, 0.05, 0, 0, 0, PI / 2, 8),
    tcyl(0.048, 0.048, 0.06, 0xff9eb8, -0.3, 0.05, 0, 0, 0, PI / 2, 8),
  ]),
});

def('inkpot', {
  label: 'Ink Bottle', col: { t: 'cyl', r: 0.2, h: 0.36 }, fit: 0.4, value: 1, mass: 0.15,
  tints: [0x2f4ea8, 0x2f9c94, 0x7a3fa8, 0x3a3346],
  build: () => [
    lathe([[0, 0], [0.18, 0], [0.2, 0.03], [0.2, 0.15], [0.12, 0.22], [0.08, 0.24], [0.08, 0.27], [0, 0.27]], TINT, 0, 0, 0, 12),
    tbox(0.2, 0.08, 0.01, PAGE, 0, 0.1, 0.19), tcyl(0.07, 0.06, 0.07, 0xc8955a, 0, 0.3, 0, 0, 0, 0, 8),
    egg(0.03, 0.02, 0.03, 0xffffff, -0.08, 0.2, 0.1, 0, 0, 0, 6, 4),
  ],
});

function bookParts() {
  return [
    rb(0.5, 0.14, 0.7, TINT, 0, 0, 0, 0.025),
    tbox(0.47, 0.1, 0.66, PAGE, 0.02, 0.07, 0),
    shade(tbox(0.04, 0.142, 0.7, TINT, -0.23, 0.071, 0), 0xa0a0a0),
    tbox(0.3, 0.004, 0.06, GOLD, 0.02, 0.141, -0.15), tbox(0.2, 0.004, 0.03, GOLD, 0.02, 0.141, -0.06),
    egg(0.07, 0.006, 0.07, 0xfff6e2, 0.02, 0.14, 0.13, 0, 0, 0, 10, 3),
  ];
}
def('book', {
  label: 'Book', col: { t: 'box', w: 0.5, h: 0.14, d: 0.7 }, fit: 0.86, value: 1, mass: 0.15,
  tints: BOOK8,
  build: () => bookParts(),
});
def('bigbook', {
  label: 'Big Book', col: { t: 'box', w: 1.15, h: 0.32, d: 1.61 }, fit: 1.98, value: 6, mass: 0.7,
  tints: BOOK8,
  build: () => scaled(bookParts(), 2.3),
});

def('bookstack', {
  label: 'Book Stack', col: { t: 'box', w: 0.82, h: 0.98, d: 1.0 }, fit: 1.29, value: 3, mass: 0.3,
  tints: BOOK8,
  build: () => {
    const p = [];
    const COLS = [0x3f7ee0, 0xf0b53a, 0x4fae6a, 0xe0465c];
    let y = 0;
    [[0.8, 0.2, 0.98, 0.0], [0.72, 0.16, 0.9, 0.08], [0.76, 0.18, 0.86, -0.06], [0.66, 0.14, 0.8, 0.12]].forEach(([w, h, d, ry], i) => {
      const g = [rb(w, h, d, COLS[i], 0, 0, 0, 0.02), tbox(w - 0.05, h - 0.04, d - 0.04, PAGE, 0.03, h / 2, 0)];
      for (const q of g) q.rotateY(ry).translate(0, y, 0);
      p.push(...g); y += h;
    });
    p.push(...bookParts().map((g) => g.scale(1.0, 1.0, 1.0).rotateY(0.2).translate(0, y, 0)));
    // a cup of cocoa on top
    p.push(lathe([[0, 0], [0.1, 0], [0.11, 0.16], [0, 0.16]], 0xfffaf4, 0.1, y + 0.14, 0.1, 10), egg(0.09, 0.01, 0.09, 0x8a5a3a, 0.1, y + 0.3, 0.1, 0, 0, 0, 8, 3));
    return C(p);
  },
});

def('readlamp', {
  label: 'Reading Lamp', col: { t: 'cyl', r: 0.45, h: 1.4 }, fit: 0.9, value: 1, mass: 0.15,
  tints: [0xffbfd2, 0x93e2bd, 0xffd27e, 0x9fd3ff, 0xc4a3ff],
  build: () => [
    lathe([[0, 0], [0.26, 0], [0.27, 0.04], [0.2, 0.08], [0, 0.08]], GOLD, 0, 0, 0, 16),
    tcyl(0.03, 0.03, 0.9, GOLD, 0, 0.53, 0, 0, 0, 0, 8),
    lathe([[0.45, 0], [0.44, 0.03], [0.28, 0.4], [0.26, 0.42], [0.2, 0.42]], TINT, 0, 0.94, 0, 18),
    pale(tor(0.445, 0.02, TINT, 0, 0.95, 0, PI / 2, 0, 0, 3, 18), 0.4),
    tor(0.27, 0.015, GOLD, 0, 1.35, 0, PI / 2, 0, 0, 3, 16),
    ball(0.12, 0xfff3b0, 0, 0.9, 0, 1),
    bead(0.04, GOLD, 0, 1.38, 0),
  ],
});

def('globe', {
  label: 'Globe', col: { t: 'cyl', r: 0.5, h: 1.2 }, fit: 1.0, value: 2, mass: 0.2,
  tints: [0x6fbaff, 0x5fd3cc, 0x9d9cff, 0x7fd0f0],
  build: () => {
    const g = new THREE.IcosahedronGeometry(0.4, 3).translate(0, 0.72, 0);
    const land = (x, y, z) => { const a = Math.atan2(x, z), b = (y - 0.72) / 0.4; return (Math.sin(a * 2 + b * 3) + Math.cos(a * 3 - b * 2) * 0.8 + Math.sin(b * 5)) > 0.9 ? 1 : 0; };
    return [
      lathe([[0, 0], [0.3, 0], [0.32, 0.05], [0.12, 0.12], [0.06, 0.24], [0, 0.24]], WOOD_D, 0, 0, 0, 14),
      tcyl(0.03, 0.03, 0.14, GOLD, 0, 0.28, 0, 0, 0, 0, 6),
      ...multi(g, land, [TINT, 0x7fcf6a]),
      tor(0.47, 0.025, GOLD, 0, 0.72, 0, 0, 0, 0.4, 4, 24, PI * 1.25),
      bead(0.04, GOLD, 0.2, 1.15, 0),
    ];
  },
});

def('cushion', {
  label: 'Floor Cushion', col: { t: 'cyl', r: 0.6, h: 0.4 }, fit: 1.2, value: 2, mass: 0.2,
  tints: [0xff9cbc, 0x8fc4ff, 0x9fe0b8, 0xffcf6a, 0xc5a8ff, 0xffa184],
  build: () => [
    ribLathe([[0, 0], [0.45, 0], [0.58, 0.06], [0.6, 0.2], [0.55, 0.32], [0.4, 0.38], [0, 0.4]], 8, 0.08, TINT, 0, 0, 0, 32),
    shade(egg(0.07, 0.04, 0.07, TINT, 0, 0.39, 0, 0, 0, 0, 8, 5), 0x9a9a9a),
    ...[0, 1, 2, 3].map((i) => { const a = i * PI / 2 + PI / 4; return bead(0.04, 0xfff6e2, Math.sin(a) * 0.58, 0.03, Math.cos(a) * 0.58); }),
  ],
});

def('footstool', {
  label: 'Footstool', col: { t: 'box', w: 1.2, h: 0.7, d: 0.9 }, fit: 1.5, value: 4, mass: 0.4,
  tints: [0xff9cbc, 0x8fc4ff, 0x9fe0b8, 0xffcf6a, 0xc5a8ff],
  build: () => {
    const p = [];
    for (const [x, z] of [[-0.48, -0.33], [0.48, -0.33], [-0.48, 0.33], [0.48, 0.33]]) p.push(lathe([[0.05, 0], [0.07, 0.08], [0.05, 0.2], [0.07, 0.3], [0, 0.3]], WOOD_D, x, 0, z, 8));
    p.push(rb(1.12, 0.12, 0.84, WOOD, 0, 0.28, 0, 0.04), rbox(1.2, 0.3, 0.9, TINT, 0, 0.38, 0, 0.14));
    for (const [x, z] of [[-0.3, -0.2], [0.3, -0.2], [0, 0], [-0.3, 0.2], [0.3, 0.2]]) p.push(shade(bead(0.04, TINT, x, 0.67, z), 0x9a9a9a));
    return p;
  },
});

def('readchair', {
  label: 'Reading Chair', col: { t: 'box', w: 2.2, h: 2.5, d: 2.2 }, fit: 3.11, value: 15, mass: 1.6,
  tints: [0xe0465c, 0x3f7ee0, 0x4fae6a, 0x8d62d6, 0xf0b53a],
  build: () => {
    const p = [
      ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => tcyl(0.07, 0.05, 0.22, WOOD_D, sx * 0.9, 0.11, sz * 0.8, 0, 0, 0, 8)),
      rbox(2.1, 0.55, 1.9, TINT, 0, 0.2, 0, 0.18),
      rbox(1.5, 0.28, 1.5, 0xfff6ec, 0, 0.74, 0.18, 0.12),
      rbox(2.1, 1.65, 0.45, TINT, 0, 0.75, -0.78, 0.2),
      ...[-1, 1].map((s) => rb(0.4, 0.7, 1.9, TINT, s * 0.9, 0.72, 0.0, 0.16)),
      ...[-1, 1].map((s) => rb(0.3, 0.9, 0.9, TINT, s * 0.95, 1.4, -0.6, 0.14)),
      pale(tbox(1.6, 0.04, 0.04, TINT, 0, 1.2, -0.55), 0.5),
    ];
    for (const [x, y] of [[-0.5, 1.75], [0, 1.9], [0.5, 1.75], [-0.25, 2.12], [0.25, 2.12]]) p.push(shade(bead(0.05, TINT, x, y, -0.55), 0x9a9a9a));
    // an open book and a knitted throw
    p.push(rb(0.5, 0.05, 0.38, 0x8a5a3a, -0.3, 1.02, 0.4, 0.02), tbox(0.22, 0.05, 0.34, PAGE, -0.42, 1.06, 0.4, 0, 0, 0.1), tbox(0.22, 0.05, 0.34, PAGE, -0.18, 1.06, 0.4, 0, 0, -0.1));
    p.push(...multi(new THREE.BoxGeometry(0.9, 0.06, 0.8, 1, 1, 5).rotateX(-0.25).translate(0.5, 2.38, -0.72), (x, y, z) => Math.floor((z + 2) / 0.17) % 3, [0xfff0d4, 0xffb3c7, 0x9fd8c4]));
    p.push(...multi(new THREE.BoxGeometry(0.9, 1.1, 0.06, 1, 6, 1).translate(0.5, 1.75, -0.48), (x, y) => Math.floor(y / 0.2) % 3, [0xfff0d4, 0xffb3c7, 0x9fd8c4]));
    return p;
  },
});

const SPINES = [0xe0465c, 0x3f7ee0, 0x4fae6a, 0xf0b53a, 0x8d62d6, 0x37b3c4, 0xec7f52, 0xf07fae, 0xfff0d4, 0x6a4a3a];
// A row of upright books filling [x0, x1] on a shelf at height y, depth d, front at zf.
function bookRow(p, x0, x1, y, hmax, d, zf, seed) {
  let x = x0, k = seed;
  while (x < x1 - 0.1) {
    k = (k * 1103515245 + 12345) & 0x7fffffff;
    const w = 0.14 + (k % 7) * 0.025, h = hmax * (0.72 + ((k >> 4) % 5) * 0.06);
    if (x + w > x1) break;
    const col = SPINES[(k >> 8) % SPINES.length];
    if ((k >> 12) % 9 === 0 && x + h < x1) { p.push(tbox(h, w, d * 0.9, col, x + h / 2, y + w / 2, zf - d / 2)); x += h + 0.02; continue; }
    p.push(tbox(w, h, d * 0.9, col, x + w / 2, y + h / 2, zf - d / 2));
    if ((k >> 3) % 3 === 0) p.push(tbox(w * 0.7, 0.03, 0.005, GOLD, x + w / 2, y + h * 0.75, zf + 0.002));
    x += w + 0.01;
  }
}
def('bookcart', {
  label: 'Book Cart', col: { t: 'box', w: 2.4, h: 1.5, d: 1.2 }, fit: 2.68, value: 11, mass: 1.0,
  tints: PAINT,
  build: () => {
    const p = [];
    for (const [x, z] of [[-1.0, -0.45], [1.0, -0.45], [-1.0, 0.45], [1.0, 0.45]]) {
      p.push(tcyl(0.13, 0.13, 0.08, 0x5a4a5a, x, 0.13, z, PI / 2, 0, 0, 12), tbox(0.08, 1.2, 0.08, TINT, x, 0.86, z));
    }
    p.push(rb(2.3, 0.08, 1.1, TINT, 0, 0.26, 0), rb(2.3, 0.08, 1.1, TINT, 0, 0.84, 0));
    for (const z of [-0.45, 0.45]) p.push(tcyl(0.045, 0.045, 2.08, TINT, 0, 1.44, z, 0, 0, PI / 2, 8));
    for (const x of [-1.0, 1.0]) p.push(tcyl(0.045, 0.045, 0.9, TINT, x, 1.44, 0, PI / 2, 0, 0, 8));
    bookRow(p, -1.0, 1.0, 0.34, 0.45, 0.42, 0.5, 7);
    bookRow(p, -1.0, 1.0, 0.34, 0.45, 0.42, -0.02, 11);
    bookRow(p, -1.0, 1.0, 0.92, 0.45, 0.42, 0.5, 3);
    bookRow(p, -1.0, 1.0, 0.92, 0.45, 0.42, -0.02, 5);
    return p;
  },
});

def('bookcase', {
  label: 'Grand Bookcase', col: { t: 'box', w: 4.8, h: 5.7, d: 1.8 }, fit: 5.13, value: 42, mass: 8,
  tints: [0x8a5a3a, 0x5f7fa8, 0x6f9f78, 0xa86a7a],
  build: () => {
    const p = [];
    const W = 4.4, D = 1.2, zf = 0.6 - 0.3, H = 5.0;
    // carcass: sides, back, crown, plinth
    for (const s of [-1, 1]) p.push(tbox(0.16, H, D, TINT, s * (W / 2 - 0.08), H / 2, zf - D / 2));
    p.push(tbox(W, H, 0.08, shadeHex(), 0, H / 2, zf - D + 0.04));
    p.push(tbox(W + 0.4, 0.3, D + 0.2, TINT, 0, H + 0.15, zf - D / 2 + 0.1), tbox(W + 0.2, 0.25, D + 0.12, TINT, 0, 0.125, zf - D / 2 + 0.06));
    p.push(pale(tbox(W + 0.42, 0.06, D + 0.22, TINT, 0, H + 0.03, zf - D / 2 + 0.1), 0.4));
    const shelves = [0.25, 1.2, 2.15, 3.1, 4.05];
    for (const y of shelves) p.push(tbox(W - 0.3, 0.08, D, TINT, 0, y + 0.04, zf - D / 2));
    shelves.forEach((y, i) => {
      if (i === 2) {
        // middle shelf: a clock, a plant and a little globe between two book runs
        bookRow(p, -W / 2 + 0.2, -0.55, y + 0.08, 0.8, 0.9, zf - 0.05, 17);
        bookRow(p, 0.95, W / 2 - 0.2, y + 0.08, 0.8, 0.9, zf - 0.05, 23);
        p.push(lathe([[0, 0], [0.22, 0], [0.26, 0.35], [0, 0.35]], TERRA, -0.15, y + 0.08, zf - 0.5, 12), egg(0.3, 0.25, 0.3, LEAF, -0.15, y + 0.6, zf - 0.5, 0, 0, 0, 10, 6));
        p.push(rb(0.5, 0.65, 0.3, WOOD_L, 0.55, y + 0.08, zf - 0.4, 0.08), egg(0.18, 0.18, 0.02, 0xfffaf4, 0.55, y + 0.42, zf - 0.24, 0, 0, 0, 12, 6));
        p.push(tbox(0.02, 0.13, 0.01, INK, 0.55, y + 0.47, zf - 0.22), tbox(0.1, 0.02, 0.01, INK, 0.59, y + 0.42, zf - 0.22));
      } else bookRow(p, -W / 2 + 0.2, W / 2 - 0.2, y + 0.08, 0.8, 0.9, zf - 0.05, 31 + i * 13);
    });
    // on top: a plant, a lamp and a stack; in front: a rolling ladder
    p.push(lathe([[0, 0], [0.26, 0], [0.3, 0.32], [0, 0.32]], TERRA, -1.6, H + 0.3, zf - 0.6, 12));
    for (let i = 0; i < 5; i++) { const a = i * TAU / 5; p.push(egg(0.3, 0.06, 0.12, LEAF, -1.6 + Math.sin(a) * 0.22, H + 0.6 - 0.1 * (i % 2), zf - 0.6 + Math.cos(a) * 0.22, 0.5 * Math.cos(a), a + PI / 2, 0, 8, 4)); }
    p.push(rb(0.7, 0.18, 0.5, 0x3f7ee0, 1.4, H + 0.3, zf - 0.6), rb(0.62, 0.14, 0.46, 0xf0b53a, 1.42, H + 0.48, zf - 0.6));
    for (const s of [-1, 1]) p.push(tcyl(0.035, 0.035, 4.9, WOOD_D, 0.9 + s * 0.35, 2.45, zf + 0.25, -0.12, 0, 0, 8));
    for (let i = 0; i < 8; i++) p.push(tcyl(0.03, 0.03, 0.7, WOOD_D, 0.9, 0.35 + i * 0.6, zf + 0.25 + Math.sin(0.12) * (2.45 - (0.35 + i * 0.6)), 0, 0, PI / 2, 6));
    p.push(tcyl(0.04, 0.04, W, GOLD, 0, 4.85, zf + 0.05, 0, 0, PI / 2, 8));
    return C(p);
  },
});
function shadeHex() { return 0x6a4a36; }

// World -> its new props (smallest first). Used by the dev galleries and the backdrop preview.
export const WAVE4_WORLDS = {
  tea: ['sugarcube', 'meringue', 'petitfour', 'creamjug', 'teaspoon', 'teasandwich', 'cuppa', 'tinyteapot', 'cakestand', 'tieredtray', 'teachair', 'bigcuppa', 'teatable', 'teatrolley', 'teapothouse'],
  florist: ['petal', 'seedpacket', 'posy', 'ribbonroll', 'rosebud', 'vase', 'bouquet', 'florcan', 'flowerbucket', 'bigposy', 'flowercrate', 'flowershelf', 'potbench', 'flowercart'],
  library: ['inkpot', 'bookmark', 'pencil', 'book', 'readlamp', 'globe', 'cushion', 'bookstack', 'footstool', 'bigbook', 'bookcart', 'readchair', 'bookcase'],
};
