// Season 5 prop pack: Pet Shop, Under the Sea and Music Room.
// Same conventions as props_cozy.js / props_wave2.js / props_wave3.js: glossy toy look
// from code geometry only (no external art), base at y=0, centered on the collider,
// fronts face +z (the camera). `fit` = smallest hole diameter that swallows it,
// `value` ~ 1.6*fit^2. tools/check_levels.mjs validates every prop.
// Season 5 is the LONG HAULS season: big boards, so props come in a wide size ladder
// (tiny filler, small, medium gate pieces, big gate pieces, a centerpiece per world),
// look-alike pairs (squeakyball/bigsqueaky, toysub/bigsub, toydrum/bigdrum) and 5-7
// colors on everything a color target can ask for.
// Pet Shop props are TOYS and supplies only (plush toys, rubber chews): no real animals.
import * as THREE from 'three';
import { def } from './props.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { box, rbox, cyl, cone, ball, custom, TINT } from './geo.js';

const TAU = Math.PI * 2, PI = Math.PI;

// ------------------------------------------------------------------ palette
const WHITE = 0xfffaf4, CREAM = 0xfff0d4, INK = 0x3b2d3f, BLUSH = 0xff9eb8;
const WOOD = 0xd39a5e, WOOD_D = 0x9e6a3e, WOOD_L = 0xeec58e;
const STEEL = 0xaab4c4, SILVER = 0xe1e7ef, GOLD = 0xffc94a, NAVY = 0x3a3f52;
const LEAF = 0x5cc46b, GLASS = 0xbfe6ff, ROPE = 0xe6c48e, ROPE_D = 0xc9a066;
const RAINBOW = [0xff4a5a, 0xff9a2e, 0xffd23a, 0x5fd16a, 0x3f9dff, 0xa070ff, 0xff7ac0];
const POPS = [0xff5c8a, 0x5cc8ff, 0xffd23f, 0x7be07a, 0xb48cff, 0xff9a3a];

// ------------------------------------------------------------------ local helpers
// (mirrors props_wave3.js so all packs build shapes the same way)
function xf(g, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  if (rx) g.rotateX(rx); if (rz) g.rotateZ(rz); if (ry) g.rotateY(ry);
  g.translate(x, y, z); return g;
}
const egg = (a, b, c, col, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, ws = 14, hs = 10) =>
  custom(xf(new THREE.SphereGeometry(1, ws, hs).scale(a, b, c), x, y, z, rx, ry, rz), col);
const bead = (r, col, x, y, z) => egg(r, r, r, col, x, y, z, 0, 0, 0, 8, 6);
const spark = (r, col, x, y, z) => ball(r, col, x, y - r, z, 0);
const tcyl = (rt, rb, h, col, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, seg = 12) =>
  custom(xf(new THREE.CylinderGeometry(rt, rb, h, seg), x, y, z, rx, ry, rz), col);
const tbox = (w, h, d, col, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) =>
  custom(xf(new THREE.BoxGeometry(w, h, d), x, y, z, rx, ry, rz), col);
const tor = (R, t, col, x = 0, y = 0, z = 0, rx = PI / 2, ry = 0, rz = 0, rs = 6, ts = 16, arc = TAU) =>
  custom(xf(new THREE.TorusGeometry(R, t, rs, ts, arc), x, y, z, rx, ry, rz), col);
const latheGeo = (pts, seg = 16) => new THREE.LatheGeometry(pts.map(([r, h]) => new THREE.Vector2(r, h)), seg);
const lathe = (pts, col, x = 0, y = 0, z = 0, seg = 16) => custom(latheGeo(pts, seg).translate(x, y, z), col);
// Flat extruded footprint. pts = [[x,z],...]. Base at y, height h.
function prismGeo(pts, h, bevel = 0) {
  const s = new THREE.Shape(pts.map(([px, pz]) => new THREE.Vector2(px, -pz)));
  const g = new THREE.ExtrudeGeometry(s, {
    depth: Math.max(0.002, h - 2 * bevel), bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel,
    bevelSegments: 2, curveSegments: 5,
  });
  g.rotateX(-PI / 2); g.translate(0, bevel, 0);
  return g;
}
function prism(pts, h, col, x = 0, y = 0, z = 0, bevel = 0, ry = 0) {
  const g = prismGeo(pts, h, bevel);
  if (ry) g.rotateY(ry);
  return custom(g.translate(x, y, z), col);
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
const ellipsePts = (a, b, n = 18, cx = 0, cz = 0) => Array.from({ length: n }, (_, i) => [cx + a * Math.cos((i / n) * TAU), cz + b * Math.sin((i / n) * TAU)]);
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
// Lay an upright part list (built in the x/y plane, thickness t along z) flat on the
// floor, its top pointing away from the camera (-z).
const layFlat = (parts, t) => parts.flat().filter(Boolean).map((g) => g.rotateX(-PI / 2).translate(0, t / 2, 0));
// Ribbed squashed sphere (shells, cushions). Base at y.
function ribbed(r, sy, ribs, depth, col, x = 0, y = 0, z = 0, ws = 22, hs = 10, top = false) {
  const g = top ? new THREE.SphereGeometry(r, ws, hs, 0, TAU, 0, PI / 2) : new THREE.SphereGeometry(r, ws, hs);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const px = p.getX(i), pz = p.getZ(i);
    const k = 1 - depth * (1 - Math.abs(Math.cos((ribs * Math.atan2(px, pz)) / 2)));
    p.setX(i, px * k); p.setZ(i, pz * k); p.setY(i, p.getY(i) * sy);
  }
  g.computeVertexNormals();
  return custom(g.translate(x, y + (top ? 0 : r * sy), z), col);
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
// centroid returns an index into cols (stripes, checks, spots).
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
// A back-facing copy of a painted part (thin shells seen from both sides).
function flipCopy(g) {
  const b = g.clone();
  for (const name of Object.keys(b.attributes)) {
    const a = b.attributes[name], k = a.itemSize;
    for (let i = 0; i < a.count; i += 3) for (let j = 0; j < k; j++) { const t = a.array[(i + 1) * k + j]; a.array[(i + 1) * k + j] = a.array[(i + 2) * k + j]; a.array[(i + 2) * k + j] = t; }
  }
  const n = b.attributes.normal.array;
  for (let i = 0; i < n.length; i++) n[i] = -n[i];
  return b;
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
// Cute face looking UP (on a flat top surface, eyes toward the camera side).
function faceUp(x, y, z, dx = 0.06, er = 0.024) {
  const p = [];
  for (const s of [-1, 1]) {
    p.push(egg(er, er * 0.6, er, INK, x + s * dx, y, z, 0, 0, 0, 7, 4), spark(er * 0.3, 0xffffff, x + s * dx - er * 0.3, y + er * 0.7, z - er * 0.3));
    p.push(egg(er * 1.2, er * 0.3, er * 0.8, BLUSH, x + s * dx * 1.7, y - er * 0.2, z + er * 1.4, 0, 0, 0, 6, 4));
  }
  p.push(tor(dx * 0.45, er * 0.32, INK, x, y, z + er * 1.2, PI / 2, 0, 0, 4, 8, PI));
  return p;
}
// Even points on a sphere (fluff, lights).
const fib = (n) => Array.from({ length: n }, (_, i) => {
  const y = 1 - (2 * i + 1) / n, r = Math.sqrt(1 - y * y), a = i * 2.39996;
  return [Math.cos(a) * r, y, Math.sin(a) * r];
});
// Thin rod between two points.
const _up = new THREE.Vector3(0, 1, 0), _q = new THREE.Quaternion();
function rod(a, b, r, col, seg = 5) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), len = A.distanceTo(B) || 0.001;
  const g = new THREE.CylinderGeometry(r, r, len, seg).translate(0, len / 2, 0);
  g.applyQuaternion(_q.setFromUnitVectors(_up, B.clone().sub(A).normalize())).translate(A.x, A.y, A.z);
  return custom(g, col);
}
// A paw print lying on a surface facing +z (pad + four toes).
function pawZ(x, y, z, s, col) {
  const p = [egg(0.09 * s, 0.075 * s, 0.012, col, x, y, z, 0, 0, 0, 8, 3)];
  [[-0.095, 0.08], [-0.035, 0.125], [0.035, 0.125], [0.095, 0.08]].forEach(([dx, dy]) => p.push(egg(0.035 * s, 0.04 * s, 0.012, col, x + dx * s, y + dy * s, z, 0, 0, 0, 6, 3)));
  return p;
}
// Paw print facing UP on a flat top at height y (toes toward -z).
function pawUp(x, y, z, s, col) {
  const p = [egg(0.09 * s, 0.01, 0.075 * s, col, x, y, z, 0, 0, 0, 8, 3)];
  [[-0.095, -0.08], [-0.035, -0.125], [0.035, -0.125], [0.095, -0.08]].forEach(([dx, dz]) => p.push(egg(0.035 * s, 0.01, 0.04 * s, col, x + dx * s, y, z + dz * s, 0, 0, 0, 6, 3)));
  return p;
}

// ======================================================================== PET SHOP
const KIB = [0xc98a4b, 0xff8a5c, 0x8fd16a, 0xffc94a, 0xff7aa8];
def('kibble', {
  label: 'Kibble', col: { t: 'cyl', r: 0.16, h: 0.13 }, fit: 0.32, value: 1, mass: 0.15,
  tints: KIB,
  build: () => [
    egg(0.075, 0.045, 0.072, TINT, -0.07, 0.045, -0.03, 0, 0.5, 0, 9, 6),
    egg(0.072, 0.045, 0.07, TINT, 0.07, 0.045, -0.04, 0, -0.4, 0, 9, 6),
    egg(0.074, 0.045, 0.07, TINT, 0.0, 0.045, 0.075, 0, 1.2, 0, 9, 6),
    shade(egg(0.068, 0.04, 0.066, TINT, 0.0, 0.092, 0.0, 0, 0.3, 0, 9, 6), 0xd6d6d6),
    // the little holes in each pellet
    ...[[-0.07, 0.09, -0.03], [0.07, 0.09, -0.04], [0, 0.09, 0.075], [0, 0.132, 0]].map(([x, y, z]) => shade(spark(0.018, TINT, x, y, z), 0x8a8a8a)),
  ],
});

def('dogtreat', {
  label: 'Dog Treat', col: { t: 'box', w: 0.5, h: 0.12, d: 0.23 }, fit: 0.55, value: 1, mass: 0.15,
  tints: [0xe0a96a, 0xff9ab0, 0x9fdc8a, 0xffd36a, 0xb9a0ff, 0x8fd0ff],
  build: () => {
    const p = [rb(0.3, 0.11, 0.13, TINT, 0, 0, 0, 0.045)];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.push(egg(0.066, 0.058, 0.066, TINT, sx * 0.183, 0.058, sz * 0.05, 0, 0, 0, 10, 7));
    for (const x of [-0.07, 0, 0.07]) p.push(shade(spark(0.014, TINT, x, 0.113, 0), 0x9a9a9a));
    return p;
  },
});

def('toymouse', {
  label: 'Toy Mouse', col: { t: 'box', w: 0.33, h: 0.3, d: 0.63 }, fit: 0.71, value: 1, mass: 0.15,
  tints: [0xb9b2c8, 0xff9cc0, 0x8fd0ff, 0xffd36a, 0x9fe0b4, 0xc8a8ff],
  build: () => {
    const p = [
      egg(0.15, 0.12, 0.21, TINT, 0, 0.12, 0, 0, 0, 0, 14, 9),
      bead(0.032, 0xff7aa0, 0, 0.11, 0.225),
      ...[-1, 1].flatMap((s) => [
        egg(0.075, 0.075, 0.022, TINT, s * 0.092, 0.22, 0.07, 0, s * 0.25, 0, 10, 6),
        egg(0.048, 0.05, 0.012, BLUSH, s * 0.094, 0.218, 0.09, 0, s * 0.25, 0, 8, 4),
        bead(0.022, INK, s * 0.05, 0.16, 0.18),
      ]),
      // stitched seam down the back, and the curly yarn tail
      pale(tor(0.15, 0.008, TINT, 0, 0.12, 0, 0, PI / 2, 0, 3, 18, PI), 0.4),
      tor(0.09, 0.02, 0xff7aa0, 0, 0.022, -0.29, PI / 2, 0, 0, 4, 14, PI * 1.6),
    ];
    return C(p);
  },
});

def('fishfood', {
  label: 'Fish Food', col: { t: 'cyl', r: 0.18, h: 0.44 }, fit: 0.36, value: 1, mass: 0.15,
  tints: [0xff7a5a, 0x5cb8ff, 0x7be07a, 0xffc94a, 0xb48cff],
  build: () => {
    const p = [
      lathe([[0, 0], [0.165, 0], [0.178, 0.02], [0.178, 0.34], [0, 0.34]], WHITE, 0, 0, 0, 16),
      tcyl(0.181, 0.181, 0.2, TINT, 0, 0.17, 0, 0, 0, 0, 16),
      lathe([[0, 0], [0.17, 0], [0.18, 0.06], [0.16, 0.1], [0, 0.1]], TINT, 0, 0.34, 0, 16),
      // a little fish on the label
      egg(0.06, 0.04, 0.012, 0xffa53a, -0.01, 0.17, 0.18, 0, 0, 0, 10, 5),
      vprism([[0, 0], [0.05, 0.035], [0.05, -0.035]], 0.012, 0xffa53a, 0.04, 0.17, 0.18),
      bead(0.009, INK, -0.04, 0.18, 0.19),
    ];
    for (let i = 0; i < 6; i++) { const a = i * TAU / 6; p.push(spark(0.016, INK, 0.08 * Math.sin(a), 0.44, 0.08 * Math.cos(a))); }
    p.push(spark(0.016, INK, 0, 0.44, 0));
    return p;
  },
});

function squeakyParts() {
  return [
    egg(0.33, 0.33, 0.33, TINT, 0, 0.34, 0, 0, 0, 0, 16, 12),
    tor(0.326, 0.014, WHITE, 0, 0.34, 0, 0.5, 0, 0.3, 3, 24),
    tor(0.326, 0.014, WHITE, 0, 0.34, 0, -0.5, 0, -0.3 + PI / 2, 3, 24),
    ...fib(6).map(([x, y, z]) => pale(spark(0.04, TINT, x * 0.31, 0.34 + y * 0.31, z * 0.31), 0.35)),
  ];
}
def('squeakyball', {
  label: 'Squeaky Ball', col: { t: 'ball', r: 0.34 }, fit: 0.68, value: 1, mass: 0.15,
  tints: POPS,
  build: () => squeakyParts(),
});
def('bigsqueaky', {
  label: 'Big Squeaky Ball', col: { t: 'ball', r: 0.93 }, fit: 1.86, value: 6, mass: 0.6,
  tints: POPS,
  build: () => scaled(squeakyParts(), 2.75),
});

def('petcollar', {
  label: 'Collar', col: { t: 'cyl', r: 0.36, h: 0.15 }, fit: 0.72, value: 1, mass: 0.15,
  tints: [0xff4a6a, 0x3f9dff, 0x5fd16a, 0xa070ff, 0xff9a2e, 0xff7ac0],
  build: () => {
    const p = [tor(0.29, 0.06, TINT, 0, 0.06, 0, PI / 2, 0, 0, 6, 26), tbox(0.13, 0.11, 0.1, SILVER, 0, 0.06, -0.29), tbox(0.03, 0.12, 0.04, STEEL, 0, 0.06, -0.33)];
    for (let i = 0; i < 9; i++) { const a = PI * 0.2 + i * (PI * 1.6) / 8 + PI / 2; p.push(spark(0.022, GOLD, 0.29 * Math.cos(a), 0.12, -0.29 * Math.sin(a))); }
    // a gold bone-shaped name tag on its ring at the front
    p.push(tor(0.04, 0.01, SILVER, 0, 0.12, 0.29, PI / 2, 0, 0, 3, 10));
    p.push(rb(0.1, 0.022, 0.05, GOLD, 0, 0.115, 0.33, 0.01));
    for (const sx of [-1, 1]) p.push(egg(0.022, 0.012, 0.022, GOLD, sx * 0.055, 0.126, 0.33, 0, 0, 0, 7, 4));
    return p;
  },
});

def('petbowl', {
  label: 'Pet Bowl', col: { t: 'cyl', r: 0.48, h: 0.3 }, fit: 0.96, value: 2, mass: 0.2,
  tints: [0xff6f91, 0x5cb8ff, 0x7be07a, 0xffc94a, 0xb48cff],
  build: () => {
    const p = [
      lathe([[0, 0], [0.4, 0], [0.47, 0.04], [0.48, 0.18], [0.45, 0.28], [0.41, 0.3], [0.37, 0.27], [0.33, 0.1], [0, 0.09]], TINT, 0, 0, 0, 18),
      pale(tor(0.46, 0.012, TINT, 0, 0.15, 0, PI / 2, 0, 0, 3, 24), 0.25),
    ];
    // a heap of kibble
    const kc = [0xc98a4b, 0xb5763c, 0xd99a58];
    for (let i = 0; i < 11; i++) { const a = i * 2.4, d = i < 6 ? 0.2 : i < 10 ? 0.1 : 0.0, y = i < 6 ? 0.13 : i < 10 ? 0.18 : 0.21; p.push(egg(0.075, 0.048, 0.07, kc[i % 3], d * Math.cos(a), y, d * Math.sin(a), 0, a, 0, 6, 4)); }
    // paw prints round the outside
    for (const a of [0, PI * 0.66, PI * 1.33]) p.push(...pawZ(0, 0, 0, 0.7, WHITE).map((g) => g.translate(0, 0.14, 0.47).rotateY(a)));
    return p;
  },
});

def('chewbone', {
  label: 'Chew Bone', col: { t: 'box', w: 1.28, h: 0.32, d: 0.56 }, fit: 1.4, value: 3, mass: 0.2,
  tints: [0xff5c8a, 0x3fb8ff, 0x7be07a, 0xffb02e, 0xa070ff, 0xff4a4a],
  build: () => {
    const p = [tcyl(0.12, 0.12, 0.84, TINT, 0, 0.16, 0, 0, 0, PI / 2, 14)];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.push(egg(0.16, 0.16, 0.16, TINT, sx * 0.48, 0.16, sz * 0.12, 0, 0, 0, 12, 8));
    for (const x of [-0.24, -0.08, 0.08, 0.24]) p.push(shade(tor(0.125, 0.018, TINT, x, 0.16, 0, 0, PI / 2, 0, 4, 14), 0xc4c4c4));
    for (const sx of [-1, 1]) p.push(pale(egg(0.07, 0.04, 0.06, TINT, sx * 0.5, 0.295, 0, 0, 0, 0, 8, 4), 0.5));
    return p;
  },
});

function plushBase(s) {
  // sitting plush body + head; s = body color tag (TINT)
  return [
    egg(0.34, 0.38, 0.3, TINT, 0, 0.38, 0, 0, 0, 0, 12, 8),
    pale(egg(0.2, 0.24, 0.1, TINT, 0, 0.34, 0.24, 0, 0, 0, 8, 5), 0.45),
    ...[-1, 1].map((k) => pale(egg(0.1, 0.07, 0.12, TINT, k * 0.15, 0.07, 0.27, 0, 0, 0, 8, 5), 0.6)),
  ];
}
def('plushkitten', {
  label: 'Plush Kitty', col: { t: 'cyl', r: 0.48, h: 1.28 }, fit: 0.96, value: 2, mass: 0.2,
  tints: [0xffb06a, 0xb9b2c8, 0xff9cc0, 0xfff2dc, 0x8fd0ff],
  build: () => {
    const p = [...plushBase()];
    p.push(egg(0.3, 0.26, 0.27, TINT, 0, 0.94, 0.04, 0, 0, 0, 12, 8));
    for (const s of [-1, 1]) {
      p.push(tcyl(0.0, 0.11, 0.2, TINT, s * 0.17, 1.17, 0.02, 0, 0, -s * 0.28, 4));
      p.push(tcyl(0.0, 0.06, 0.12, BLUSH, s * 0.16, 1.16, 0.065, 0, 0, -s * 0.28, 4));
      // whiskers
      for (const dy of [-0.012, 0.018]) p.push(tbox(0.13, 0.008, 0.008, INK, s * 0.17, 0.89 + dy, 0.27, 0, 0, s * dy * 6));
    }
    p.push(...face(0, 0.97, 0.29, 0.09, 0.03, false), bead(0.025, 0xff7aa0, 0, 0.9, 0.31), tor(0.035, 0.008, INK, 0, 0.865, 0.305, 0, 0, PI, 3, 8, PI));
    // stripes on the forehead, a striped curled tail, a ribbon
    for (const dx of [-0.06, 0, 0.06]) p.push(shade(tbox(0.022, 0.07, 0.02, TINT, dx, 1.11, 0.27, -0.4), 0xb0b0b0));
    p.push(shade(tor(0.18, 0.055, TINT, 0.24, 0.055, -0.14, PI / 2, 0, 0, 5, 12, PI * 1.25), 0xd0d0d0));
    p.push(tor(0.2, 0.03, 0xff5c8a, 0, 0.72, 0.03, PI / 2 - 0.15, 0, 0, 4, 18));
    for (const s of [-1, 1]) p.push(egg(0.07, 0.045, 0.03, 0xff5c8a, s * 0.07, 0.72, 0.25, 0, 0, s * 0.4, 8, 5));
    return C(p);
  },
});

def('plushpuppy', {
  label: 'Plush Puppy', col: { t: 'cyl', r: 0.5, h: 1.2 }, fit: 1.0, value: 2, mass: 0.2,
  tints: [0xe8b47a, 0xfff2dc, 0x8fd0ff, 0xffc94a, 0xc8a8ff],
  build: () => {
    const p = [...plushBase()];
    p.push(egg(0.3, 0.27, 0.28, TINT, 0, 0.92, 0.02, 0, 0, 0, 12, 8));
    // snout, nose, floppy ears, an eye patch
    p.push(pale(egg(0.15, 0.11, 0.12, TINT, 0, 0.85, 0.24, 0, 0, 0, 10, 7), 0.55), bead(0.045, INK, 0, 0.9, 0.355));
    p.push(tor(0.04, 0.008, INK, 0, 0.8, 0.355, 0, 0, PI, 3, 8, PI));
    for (const s of [-1, 1]) p.push(shade(egg(0.1, 0.22, 0.06, TINT, s * 0.3, 0.86, 0.0, 0, 0, s * 0.35, 8, 5), 0xb0b0b0));
    p.push(...face(0, 1.0, 0.28, 0.1, 0.03, false));
    p.push(shade(egg(0.07, 0.06, 0.02, TINT, -0.1, 1.0, 0.27, 0, 0, 0, 8, 5), 0x9a9a9a));
    // a wagging tail and a red collar with a tag
    p.push(tcyl(0.04, 0.06, 0.3, TINT, 0, 0.35, -0.36, -0.9, 0, 0, 8));
    p.push(tor(0.21, 0.035, 0xff4a5a, 0, 0.73, 0.02, PI / 2 - 0.1, 0, 0, 4, 18), tcyl(0.045, 0.045, 0.015, GOLD, 0, 0.66, 0.24, PI / 2 - 0.3, 0, 0, 10));
    return C(p);
  },
});

def('kibblebag', {
  label: 'Kibble Bag', col: { t: 'box', w: 0.92, h: 1.32, d: 0.82 }, fit: 1.23, value: 2, mass: 0.3,
  tints: [0xff7a5a, 0x5cb8ff, 0x7be07a, 0xb48cff],
  build: () => {
    const p = [
      rb(0.9, 1.2, 0.5, TINT, 0, 0, 0, 0.12),
      shade(tbox(0.92, 0.12, 0.14, TINT, 0, 1.26, 0), 0xc8c8c8),
      rb(0.62, 0.5, 0.03, WHITE, 0, 0.36, 0.245, 0.05),
      ...pawZ(0, 0.66, 0.262, 1.4, 0xc98a4b),
      // a little picture of a bowl, the brand band, kibble spilled at the front
      shade(tbox(0.9, 0.08, 0.51, TINT, 0, 1.0, 0), 0xffffff, 0.35),
      egg(0.16, 0.06, 0.012, 0xff5c8a, 0, 0.47, 0.262, 0, 0, 0, 10, 4),
    ];
    const kc = [0xc98a4b, 0xb5763c, 0xd99a58];
    [[-0.2, 0.32], [0.05, 0.36], [0.24, 0.3], [-0.05, 0.27], [0.14, 0.27]].forEach(([x, z], i) => p.push(egg(0.055, 0.04, 0.05, kc[i % 3], x, 0.04, z, 0, i, 0, 7, 5)));
    return p;
  },
});

def('scratchpost', {
  label: 'Scratching Post', col: { t: 'box', w: 1.2, h: 1.78, d: 1.2 }, fit: 1.7, value: 5, mass: 0.5,
  tints: [0xff9cc0, 0x8fd0ff, 0x9fe0b8, 0xffcf6a, 0xc5a8ff],
  build: () => {
    const p = [
      rb(1.2, 0.14, 1.2, TINT, 0, 0, 0, 0.05),
      tcyl(0.2, 0.2, 1.52, ROPE, 0, 0.9, 0, 0, 0, 0, 14),
      rb(0.9, 0.12, 0.9, TINT, 0, 1.64, 0, 0.05),
      pale(egg(0.32, 0.04, 0.32, TINT, 0, 1.76, 0, 0, 0, 0, 12, 4), 0.4),
    ];
    for (let y = 0.26; y < 1.6; y += 0.16) p.push(tor(0.202, 0.014, ROPE_D, 0, y, 0, PI / 2, 0, 0, 3, 12));
    // a pom-pom toy dangling on a string from the top
    p.push(tcyl(0.008, 0.008, 0.6, WHITE, 0.36, 1.34, 0.36, 0, 0, 0, 4), bead(0.09, 0xff5c8a, 0.36, 1.0, 0.36));
    for (const [x, z] of [[-0.4, 0.4], [0.4, -0.4], [-0.38, -0.38]]) p.push(...pawUp(x, 0.142, z, 0.9, WHITE));
    return p;
  },
});

def('petbed', {
  label: 'Pet Bed', col: { t: 'cyl', r: 1.1, h: 0.58 }, fit: 2.2, value: 8, mass: 0.6,
  tints: [0xff9cc0, 0x8fc4ff, 0x9fe0b8, 0xffcf6a, 0xc5a8ff],
  build: () => {
    const p = [
      lathe([[0, 0], [0.95, 0], [1.07, 0.1], [1.1, 0.32], [1.02, 0.52], [0.9, 0.58], [0.78, 0.48], [0.74, 0.28], [0, 0.2]], TINT, 0, 0, 0, 20),
      egg(0.76, 0.1, 0.76, CREAM, 0, 0.22, 0, 0, 0, 0, 16, 4),
      pale(tor(0.9, 0.03, TINT, 0, 0.56, 0, PI / 2, 0, 0, 4, 28), 0.4),
    ];
    for (const [x, z] of [[-0.3, -0.25], [0.32, 0.2], [-0.15, 0.4]]) p.push(...pawUp(x, 0.3, z, 0.9, 0xffd0dc));
    // a toy bone resting on the cushion
    p.push(tcyl(0.05, 0.05, 0.36, 0xffffff, 0.08, 0.36, 0.05, 0, 0.5, PI / 2, 8));
    for (const s of [-1, 1]) for (const t of [-1, 1]) p.push(bead(0.065, 0xffffff, 0.08 + s * 0.18 * Math.cos(0.5) + t * 0.04 * Math.sin(0.5), 0.36, 0.05 - s * 0.18 * Math.sin(0.5) + t * 0.04 * Math.cos(0.5)));
    return p;
  },
});

def('petcarrier', {
  label: 'Pet Carrier', col: { t: 'box', w: 1.6, h: 1.36, d: 1.04 }, fit: 1.91, value: 6, mass: 0.6,
  tints: [0xff7a9c, 0x5cb8ff, 0x7bd99a, 0xffc35a],
  build: () => {
    const p = [
      rb(1.6, 0.5, 1.0, TINT, 0, 0, 0, 0.12),
      pale(rb(1.56, 0.5, 0.96, TINT, 0, 0.48, 0, 0.14), 0.35),
      tbox(1.62, 0.05, 1.02, WHITE, 0, 0.5, 0),
      // the door: a frame and steel bars
      rb(0.8, 0.72, 0.04, WHITE, 0.0, 0.14, 0.5, 0.06),
      tbox(0.64, 0.56, 0.02, 0x4a4060, 0, 0.5, 0.505),
    ];
    for (let i = 0; i < 7; i++) p.push(tcyl(0.016, 0.016, 0.56, SILVER, -0.27 + i * 0.09, 0.5, 0.525, 0, 0, 0, 5));
    p.push(tcyl(0.016, 0.016, 0.62, SILVER, 0, 0.5, 0.525, 0, 0, PI / 2, 5));
    // vents down the sides, a handle on top
    for (const s of [-1, 1]) for (let i = 0; i < 4; i++) p.push(tbox(0.022, 0.24, 0.07, 0x4a4060, s * 0.8, 0.6, -0.27 + i * 0.18));
    p.push(tor(0.25, 0.05, WHITE, 0, 0.99, 0, 0, 0, 0, 5, 12, PI));
    for (const s of [-1, 1]) p.push(...pawZ(s * 0.6, 0.28, 0.51, 0.9, WHITE));
    return p;
  },
});

def('doghouse', {
  label: 'Dog House', col: { t: 'box', w: 2.66, h: 2.86, d: 2.84 }, fit: 3.89, value: 24, mass: 2,
  tints: [0xff9cbc, 0x8fc4ff, 0x9fe0b8, 0xffcf6a],
  build: () => {
    const roofSlab = (s) => tbox(1.62, 0.14, 2.62, s > 0 ? 0xff5a5a : 0xff6b6b, s * 0.66, 2.24, 0, 0, 0, -s * 0.72);
    const p = [
      rb(2.2, 1.75, 2.2, TINT, 0, 0, 0, 0.08),
      // the front and back gables
      ...[-1, 1].map((s) => vprism([[-1.1, 0], [1.1, 0], [0, 0.95]], 0.06, TINT, 0, 1.72, s * 1.07)),
      roofSlab(-1), roofSlab(1),
      tbox(0.2, 0.2, 2.7, WHITE, 0, 2.7, 0, 0, 0, PI / 4),
      // arched door, name plate, trim
      vprism([[-0.42, 0], [0.42, 0], [0.42, 0.75], ...Array.from({ length: 7 }, (_, i) => { const a = (i / 6) * PI; return [0.42 * Math.cos(a), 0.75 + 0.42 * Math.sin(a)]; }), [-0.42, 0.75]], 0.05, 0x4a3448, 0, 0.01, 1.105),
      rb(1.0, 0.12, 0.06, WHITE, 0, 0, 1.11, 0.03),
      rb(0.7, 0.24, 0.04, WHITE, 0, 1.38, 1.12, 0.06),
      ...pawZ(0, 1.5, 1.145, 0.8, 0xff5c8a),
    ];
    for (const s of [-1, 1]) p.push(tbox(0.08, 1.75, 0.08, WHITE, s * 1.08, 0.875, 1.08));
    // a bowl by the door and a bone on the roof ridge
    p.push(lathe([[0, 0], [0.2, 0], [0.24, 0.04], [0.24, 0.12], [0.2, 0.14], [0.18, 0.06], [0, 0.05]], 0x5cb8ff, 0.8, 0, 1.25, 14));
    p.push(egg(0.17, 0.04, 0.17, 0xc98a4b, 0.8, 0.09, 1.25, 0, 0, 0, 10, 4));
    return C(p);
  },
});

def('cattree', {
  label: 'Cat Tree', col: { t: 'box', w: 4.0, h: 5.5, d: 3.2 }, fit: 5.12, value: 42, mass: 6,
  tints: [0xff9cc0, 0x8fc4ff, 0x9fe0b8, 0xc5a8ff],
  build: () => {
    const post = (x, z, y0, y1) => {
      const q = [tcyl(0.22, 0.22, y1 - y0, ROPE, x, (y0 + y1) / 2, z, 0, 0, 0, 10)];
      for (let y = y0 + 0.2; y < y1 - 0.1; y += 0.3) q.push(custom(new THREE.CylinderGeometry(0.228, 0.228, 0.05, 10, 1, true).translate(x, y, z), ROPE_D));
      return q;
    };
    const deck = (x, z, y, r) => [tcyl(r, r, 0.16, TINT, x, y + 0.08, z, 0, 0, 0, 16), pale(egg(r * 0.85, 0.04, r * 0.85, TINT, x, y + 0.16, z, 0, 0, 0, 12, 3), 0.45)];
    const p = [
      rb(4.0, 0.3, 3.2, TINT, 0, 0, 0, 0.1),
      ...post(-1.3, -0.8, 0.3, 2.3), ...deck(-1.3, -0.8, 2.3, 0.75),
      ...post(1.1, -0.7, 0.3, 3.5), ...deck(1.1, -0.7, 3.5, 0.8),
      ...post(-0.2, -0.4, 2.46, 4.8), ...post(0.3, 0.6, 0.3, 1.6),
      // the condo: a cubby with a round door at the front right
      rb(1.5, 1.2, 1.3, TINT, 0.95, 0.3, 0.75, 0.12),
      tcyl(0.36, 0.36, 0.03, 0x4a3448, 0.95, 0.9, 1.405, PI / 2, 0, 0, 18),
      pale(tor(0.36, 0.045, TINT, 0.95, 0.9, 1.41, 0, 0, 0, 4, 18), 0.5),
      ...deck(0.95, 0.75, 1.5, 0.62),
      // the top bed: a round bowl with a cushion
      lathe([[0, 0], [0.7, 0], [0.82, 0.14], [0.84, 0.36], [0.74, 0.42], [0.66, 0.3], [0, 0.18]], TINT, -0.2, 4.8, -0.4, 16),
      egg(0.62, 0.08, 0.62, CREAM, -0.2, 5.0, -0.4, 0, 0, 0, 14, 4),
    ];
    // dangling toys
    for (const [x, z, y, c] of [[-1.85, -0.8, 2.3, 0xff5c8a], [1.75, -0.4, 3.5, 0x5cc8ff], [0.95, 1.2, 1.5, 0xffd23a]]) {
      p.push(tcyl(0.008, 0.008, 0.7, WHITE, x, y - 0.35, z, 0, 0, 0, 3), egg(0.1, 0.1, 0.1, c, x, y - 0.75, z, 0, 0, 0, 6, 4));
    }
    p.push(...pawUp(-1.0, 0.305, 1.15, 1.6, WHITE));
    // a toy mouse waiting on the top bed
    p.push(egg(0.16, 0.12, 0.22, 0xb9b2c8, -0.2, 5.15, -0.3, 0, 0.6, 0, 8, 5));
    return C(p);
  },
});

// ======================================================================== UNDER THE SEA
def('tankpebble', {
  label: 'Pebble', col: { t: 'cyl', r: 0.16, h: 0.18 }, fit: 0.32, value: 1, mass: 0.15,
  tints: [0xff8fb8, 0x6fc4ff, 0xffe066, 0x7fe0a0, 0xc8a8ff, 0xffffff],
  build: () => [
    egg(0.16, 0.09, 0.13, TINT, 0, 0.09, 0, 0, 0.4, 0, 12, 8),
    pale(egg(0.06, 0.02, 0.04, TINT, -0.04, 0.165, -0.02, 0, 0.4, 0, 7, 4), 0.2),
  ],
});

def('scallop', {
  label: 'Scallop Shell', col: { t: 'cyl', r: 0.3, h: 0.12 }, fit: 0.6, value: 1, mass: 0.15,
  tints: [0xff9a8a, 0xffc0d6, 0xffd98a, 0xc8b4ff, 0x9fe0d8, 0xfff4e8],
  build: () => {
    const pts = [[-0.07, -0.2], [0.07, -0.2]];
    for (let i = 0; i <= 14; i++) {
      const a = -1.15 + (2.3 * i) / 14, R = 0.33 + (i % 2 ? 0.012 : -0.012);
      pts.push([Math.sin(a) * R, -0.13 + Math.cos(a) * R]);
    }
    pts.reverse();
    const g = prismGeo([[-0.07, -0.2], ...pts.slice(0, -2), [0.07, -0.2]].reverse(), 0.07, 0.02);
    const p = [...multi(g, (x, y, z) => Math.floor((Math.atan2(x, z + 0.13) + 1.2) / 0.16) % 2, [TINT, CREAM])];
    for (let i = 0; i < 8; i++) { const a = -1.0 + (2.0 * i) / 7; p.push(shade(tbox(0.022, 0.02, 0.27, TINT, Math.sin(a) * 0.14, 0.075, -0.13 + Math.cos(a) * 0.14, 0, a, 0), 0xc8c8c8)); }
    p.push(rb(0.18, 0.06, 0.07, CREAM, 0, 0, -0.18, 0.02));
    return C(p);
  },
});

def('bubbles', {
  label: 'Bubbles', col: { t: 'cyl', r: 0.27, h: 0.48 }, fit: 0.54, value: 1, mass: 0.15,
  tints: [0x9fe8ff, 0xffb8e0, 0xd2c0ff, 0xb8f5d0, 0xfff0a0],
  build: () => {
    const p = [];
    for (const [x, y, z, r] of [[-0.05, 0.19, 0.0, 0.19], [0.15, 0.13, 0.08, 0.12], [0.08, 0.39, -0.04, 0.09]]) {
      p.push(pale(egg(r, r, r, TINT, x, y, z, 0, 0, 0, 12, 9), 0.55));
      p.push(spark(r * 0.22, 0xffffff, x - r * 0.4, y + r * 0.45, z + r * 0.55), tor(r * 0.72, r * 0.05, 0xffffff, x, y, z, 0.4, 0, 0.5, 3, 10, PI * 0.6));
    }
    return C(p);
  },
});

def('seastar', {
  label: 'Sea Star', col: { t: 'cyl', r: 0.38, h: 0.17 }, fit: 0.76, value: 1, mass: 0.15,
  tints: RAINBOW,
  build: () => {
    const p = [prism(starPts(0.34, 0.5, 5, -PI / 2), 0.13, TINT, 0, 0, 0, 0.04)];
    for (let i = 0; i < 5; i++) { const a = -PI / 2 + i * TAU / 5; for (const d of [0.17, 0.25]) p.push(pale(spark(0.022, TINT, Math.cos(a) * d, 0.165, -Math.sin(a) * d), 0.3)); }
    p.push(...faceUp(0, 0.165, 0.0, 0.055, 0.024));
    return p;
  },
});

def('seacoral', {
  label: 'Coral', col: { t: 'cyl', r: 0.47, h: 0.96 }, fit: 0.94, value: 1, mass: 0.15,
  tints: [0xff7a8a, 0xff9a3a, 0xb48cff, 0xffd23a, 0x5fd1c8, 0xff5ca8],
  build: () => {
    const p = [egg(0.3, 0.1, 0.26, 0xb7b0d6, 0, 0.1, 0, 0, 0, 0, 10, 5)];
    const br = [[0, 0, 0.72, 0, 0], [-0.12, 0.05, 0.5, 0, 0.55], [0.13, -0.03, 0.55, 0.15, -0.5], [0.02, 0.12, 0.45, 0.6, 0.1], [-0.05, -0.12, 0.48, -0.55, -0.15]];
    br.forEach(([x, z, h, rx, rz]) => {
      const tip = [x - Math.sin(rz) * h + 0, 0.12 + Math.cos(rx) * Math.cos(rz) * h, z + Math.sin(rx) * h];
      p.push(rod([x, 0.1, z], tip, 0.05, TINT, 6), bead(0.075, TINT, tip[0], tip[1], tip[2]));
      p.push(pale(spark(0.03, TINT, tip[0], tip[1] + 0.06, tip[2] + 0.02), 0.3));
    });
    // a little side branch with buds
    p.push(rod([-0.21, 0.4, 0.05], [-0.3, 0.62, 0.05], 0.035, TINT, 5), bead(0.05, TINT, -0.3, 0.64, 0.05));
    p.push(rod([0.23, 0.42, -0.06], [0.33, 0.58, -0.1], 0.035, TINT, 5), bead(0.05, TINT, 0.33, 0.6, -0.1));
    return C(p);
  },
});

def('conch', {
  label: 'Conch Shell', col: { t: 'box', w: 1.21, h: 0.54, d: 0.6 }, fit: 1.35, value: 2, mass: 0.2,
  tints: [0xffb0c4, 0xffcf9a, 0xfff0d8, 0xd2bfff, 0xa8e8e0],
  build: () => {
    const p = [
      egg(0.4, 0.26, 0.28, TINT, 0.08, 0.26, 0, 0, 0, 0, 14, 9),
      tcyl(0.02, 0.24, 0.5, TINT, -0.42, 0.27, 0, 0, 0, PI / 2, 12),
      egg(0.07, 0.07, 0.07, TINT, 0.47, 0.22, 0, 0, 0, 0, 8, 6),
      // the pink opening on the camera side
      egg(0.26, 0.17, 0.07, 0xffc4d4, 0.16, 0.24, 0.24, 0, 0.25, 0, 12, 6),
      egg(0.16, 0.09, 0.04, 0xffe2ea, 0.18, 0.25, 0.28, 0, 0.25, 0, 10, 5),
    ];
    for (const [x, r] of [[-0.24, 0.17], [-0.38, 0.12], [-0.51, 0.075]]) p.push(shade(tor(r, 0.022, TINT, x, 0.27, 0, 0, PI / 2, 0, 3, 14), 0xc4c4c4));
    for (let i = 0; i < 5; i++) { const a = i * 0.7 - 1.4; p.push(pale(spark(0.04, TINT, 0.08 + Math.cos(a + PI / 2) * 0.2, 0.5, Math.sin(a) * 0.16 - 0.04), 0.4)); }
    return C(p);
  },
});

def('toyanchor', {
  label: 'Anchor', col: { t: 'box', w: 1.06, h: 0.2, d: 1.32 }, fit: 1.69, value: 4, mass: 0.4,
  tints: [0xff4a5a, 0x3f6fd8, 0xffc94a, 0x2fb3a8],
  build: () => {
    const T = 0.2;
    const fluke = (s) => vprism([[0, 0.13], [0.11, -0.1], [-0.11, -0.1]], T * 0.9, TINT, s * 0.42, 0.42, 0, 0);
    const up = [
      tbox(0.13, 0.86, T, TINT, 0, 0.62, 0),
      tor(0.13, 0.045, TINT, 0, 1.18, 0, 0, 0, 0, 5, 16),
      tbox(0.62, 0.09, T * 0.8, WOOD, 0, 0.92, 0), bead(0.065, WOOD_D, -0.31, 0.92, 0), bead(0.065, WOOD_D, 0.31, 0.92, 0),
      tor(0.42, 0.06, TINT, 0, 0.5, 0, 0, 0, PI, 6, 18, PI),
      fluke(-1), fluke(1),
      // a coil of rope round the shank
      tor(0.1, 0.025, ROPE, 0, 0.66, 0, PI / 2 - 0.3, 0, 0, 3, 12), tor(0.1, 0.025, ROPE, 0, 0.74, 0, PI / 2 + 0.3, 0, 0, 3, 12),
    ];
    return C(layFlat(up, T));
  },
});

function subParts() {
  const p = [
    egg(0.74, 0.3, 0.3, TINT, 0, 0.3, 0, 0, 0, 0, 16, 10),
    pale(egg(0.3, 0.24, 0.25, TINT, 0.5, 0.3, 0, 0, 0, 0, 10, 8), 0.45),
    rb(0.36, 0.24, 0.24, TINT, -0.04, 0.5, 0, 0.08),
    tcyl(0.025, 0.025, 0.24, STEEL, 0.05, 0.84, 0, 0, 0, 0, 6), tcyl(0.035, 0.035, 0.12, STEEL, 0.1, 0.95, 0, 0, 0, PI / 2, 6),
    // propeller and tail fins at the back (-x)
    tcyl(0.05, 0.08, 0.12, STEEL, -0.78, 0.3, 0, 0, 0, PI / 2, 8),
    ...[0, 1, 2].map((k) => tbox(0.03, 0.2, 0.08, GOLD, -0.86, 0.3, 0, k * TAU / 3, 0, 0)),
    vprism([[0, 0], [-0.2, 0.18], [-0.24, 0.18], [-0.12, 0]], 0.04, TINT, -0.5, 0.48, 0),
  ];
  for (let i = 0; i < 3; i++) {
    const x = -0.3 + i * 0.28;
    p.push(tor(0.075, 0.022, SILVER, x, 0.32, 0.27, 0, 0, 0, 4, 12), tcyl(0.07, 0.07, 0.03, GLASS, x, 0.32, 0.27, PI / 2, 0, 0, 12));
  }
  return p;
}
def('toysub', {
  label: 'Toy Sub', col: { t: 'box', w: 1.64, h: 1.0, d: 0.62 }, fit: 1.75, value: 5, mass: 0.4,
  tints: [0xffd23a, 0xff5a5a, 0x3fa0ff, 0x5fd16a, 0xa070ff, 0xff9a2e],
  build: () => C(subParts()),
});
def('bigsub', {
  label: 'Big Sub', col: { t: 'box', w: 3.28, h: 2.0, d: 1.24 }, fit: 3.51, value: 20, mass: 1.5,
  tints: [0xffd23a, 0xff5a5a, 0x3fa0ff, 0x5fd16a, 0xa070ff, 0xff9a2e],
  build: () => scaled(C(subParts()), 2.0),
});

def('treasurechest', {
  label: 'Treasure Chest', col: { t: 'box', w: 1.36, h: 1.06, d: 1.14 }, fit: 1.77, value: 5, mass: 0.5,
  tints: [0xb8764a, 0xff6a6a, 0x3fb3c0, 0xa070ff],
  build: () => {
    const lid = new THREE.CylinderGeometry(0.43, 0.43, 1.3, 14, 1, false, 0, PI);
    const p = [
      rb(1.3, 0.62, 0.86, TINT, 0, 0, 0, 0.05),
      custom(xf(lid, 0, 0.62, 0, 0, 0, PI / 2).rotateX(0).translate(0, 0, 0), TINT),
      ...[-1, 1].flatMap((s) => [tbox(0.09, 0.63, 0.88, GOLD, s * 0.45, 0.315, 0), tor(0.432, 0.045, GOLD, s * 0.45, 0.62, 0, 0, PI / 2, 0, 4, 14, PI)]),
      rb(0.2, 0.24, 0.06, GOLD, 0, 0.42, 0.43, 0.04), tbox(0.04, 0.08, 0.02, INK, 0, 0.5, 0.465),
    ];
    // gold coins and pearls spilled in front
    for (const [x, z, k] of [[-0.35, 0.5, 0], [-0.1, 0.55, 1], [0.2, 0.5, 2], [0.42, 0.56, 3], [0.05, 0.62, 4]]) {
      p.push(tcyl(0.09, 0.09, 0.03, GOLD, x, 0.016 + (k % 2) * 0.025, z, (k - 2) * 0.12, 0, 0, 12));
    }
    p.push(bead(0.05, 0xfff8f0, -0.22, 0.05, 0.62), bead(0.045, 0xffe8f0, 0.32, 0.045, 0.66));
    return C(p);
  },
});

def('diverhelmet', {
  label: 'Diver Helmet', col: { t: 'cyl', r: 0.66, h: 1.42 }, fit: 1.32, value: 3, mass: 0.4,
  tints: [0xffc94a, 0xff9a6a, 0xd8dee8, 0x5fd1c8],
  build: () => {
    const p = [
      lathe([[0, 0], [0.62, 0], [0.66, 0.06], [0.62, 0.22], [0.42, 0.3], [0, 0.3]], TINT, 0, 0, 0, 20),
      egg(0.52, 0.5, 0.52, TINT, 0, 0.72, 0, 0, 0, 0, 16, 10),
      tcyl(0.25, 0.25, 0.05, GLASS, 0, 0.72, 0.51, PI / 2, 0, 0, 18), tor(0.25, 0.05, SILVER, 0, 0.72, 0.52, 0, 0, 0, 5, 18),
      tbox(0.03, 0.46, 0.02, SILVER, 0, 0.72, 0.54), tbox(0.46, 0.03, 0.02, SILVER, 0, 0.72, 0.54),
      tcyl(0.08, 0.1, 0.12, SILVER, 0, 1.25, 0, 0, 0, 0, 10),
    ];
    for (const s of [-1, 1]) p.push(tcyl(0.13, 0.13, 0.04, GLASS, s * 0.5, 0.78, 0.1, 0, 0, PI / 2, 12), tor(0.13, 0.03, SILVER, s * 0.51, 0.78, 0.1, 0, PI / 2, 0, 4, 12));
    for (let i = 0; i < 10; i++) { const a = i * TAU / 10; p.push(spark(0.035, SILVER, 0.6 * Math.sin(a), 0.28, 0.6 * Math.cos(a))); }
    // bubbles rising from the valve
    p.push(bead(0.05, 0xd8f4ff, 0.05, 1.37, 0.02));
    return p;
  },
});

def('giantclam', {
  label: 'Giant Clam', col: { t: 'cyl', r: 1.21, h: 1.91 }, fit: 2.42, value: 9, mass: 0.6,
  tints: [0xffa6c9, 0x8fe0e8, 0xc8b0ff, 0xffc89a, 0x9fe8b8],
  build: () => {
    const top = ribbed(0.88, 0.32, 10, 0.12, TINT, 0, 0, 0, 22, 6, true);
    top.rotateX(-(PI / 2 + 0.35));
    { const P = top.attributes.position; let k = 0; for (let i = 1; i < P.count; i++) if (P.getY(i) < P.getY(k)) k = i; top.translate(0, 0.32 - P.getY(k), -0.72 - P.getZ(k)); }
    const p = [
      ribbed(0.9, 0.3, 10, 0.12, TINT, 0, 0, 0, 22, 8),
      top, shade(flipCopy(top), 0xe8d8e0, 0.6),
      egg(0.66, 0.1, 0.6, 0xffb8c8, 0, 0.5, 0.05, 0, 0, 0, 14, 5),
      bead(0.21, 0xfffaf4, 0, 0.7, 0.1),
      spark(0.05, 0xffffff, -0.07, 0.81, 0.24),
    ];
    return C(p);
  },
});

def('tankcastle', {
  label: 'Tank Castle', col: { t: 'cyl', r: 1.25, h: 2.86 }, fit: 2.5, value: 10, mass: 1,
  tints: [0xffb0c4, 0xffd89a, 0xc8b4ff, 0x9fe0d8],
  build: () => {
    const tower = (x, z, r, h, roof) => {
      const q = [tcyl(r, r * 1.06, h, TINT, x, h / 2 + 0.12, z, 0, 0, 0, 14), pale(tcyl(r * 1.08, r * 1.08, 0.12, TINT, x, h + 0.18, z, 0, 0, 0, 14), 0.5)];
      for (let i = 0; i < 6; i++) { const a = i * TAU / 6; q.push(pale(tbox(0.12, 0.14, 0.12, TINT, x + Math.sin(a) * r, h + 0.31, z + Math.cos(a) * r, 0, a), 0.5)); }
      if (roof) q.push(cone(r * 0.95, roof, 0x6f8cff, x, h + 0.24, z, 12));
      q.push(tbox(0.12, 0.22, 0.02, 0x4a3448, x, h * 0.65 + 0.12, z + r + 0.01));
      return q;
    };
    const p = [
      egg(1.2, 0.16, 1.1, 0xb7b0d6, 0, 0.16, 0, 0, 0, 0, 16, 6),
      ...tower(0, -0.2, 0.52, 1.7, 0.85),
      ...tower(-0.72, 0.42, 0.34, 1.0, 0.6),
      ...tower(0.74, 0.38, 0.34, 1.25, 0),
      // a wall between the towers with an arched gate
      rb(1.3, 0.75, 0.3, TINT, 0, 0.12, 0.52, 0.04),
      vprism([[-0.22, 0], [0.22, 0], [0.22, 0.32], [0.16, 0.44], [0, 0.5], [-0.16, 0.44], [-0.22, 0.32]], 0.04, 0x4a3448, 0, 0.12, 0.68),
      tcyl(0.012, 0.012, 0.5, SILVER, 0, 2.64, -0.2, 0, 0, 0, 4), vprism([[0, 0], [0.3, 0.08], [0, 0.18]], 0.01, 0xff5c8a, 0.0, 2.68, -0.2),
    ];
    // moss and little shells round the base
    for (let i = 0; i < 9; i++) { const a = i * 0.7 + 0.3, d = 0.95; p.push(egg(0.13, 0.08, 0.13, i % 3 ? LEAF : 0xff9ab8, Math.sin(a) * d, 0.12, Math.cos(a) * d * 0.9, 0, 0, 0, 7, 4)); }
    return p;
  },
});

def('sunkenship', {
  label: 'Sunken Ship', col: { t: 'box', w: 5.47, h: 3.76, d: 1.9 }, fit: 5.79, value: 54, mass: 6,
  tints: [0xb8764a, 0x5f8fd8, 0xc86a8a, 0x5fae9a],
  build: () => {
    const hullPts = [[-2.4, -0.85], [1.4, -0.85], [2.45, 0], [1.4, 0.85], [-2.4, 0.85]];
    const deckPts = [[-2.3, -0.72], [1.35, -0.72], [2.25, 0], [1.35, 0.72], [-2.3, 0.72]];
    const p = [
      prism([[-2.2, -0.62], [1.3, -0.62], [2.1, 0], [1.3, 0.62], [-2.2, 0.62]], 0.3, 0x6a4a3a, 0, 0, 0, 0.05),
      prism(hullPts, 0.75, TINT, 0, 0.25, 0, 0.06),
      prism(deckPts, 0.08, WOOD_L, 0, 1.0, 0, 0.02),
      // a gold stripe and portholes along the camera side
      shade(prism(hullPts.map(([x, z]) => [x * 1.005, z * 1.01]), 0.06, TINT, 0, 0.8, 0, 0.01), 0xffe08a),
      // the raised stern cabin with windows
      rb(1.2, 0.9, 1.5, TINT, -1.75, 1.0, 0, 0.08), pale(rb(1.26, 0.1, 1.56, TINT, -1.75, 1.88, 0, 0.04), 0.5),
      // the broken main mast, a tattered sail, the bowsprit
      tcyl(0.09, 0.11, 2.6, WOOD_D, 0.3, 2.3, 0, 0, 0, 0.12, 8),
      tcyl(0.06, 0.06, 1.5, WOOD_D, 0.15, 2.9, 0, 0, 0, PI / 2 + 0.12, 6),
      vprism([[-0.62, 0], [0.62, 0], [0.5, -0.9], [0.18, -0.7], [-0.1, -1.05], [-0.55, -0.8]], 0.03, 0xfff0d8, 0.18, 2.88, 0.06, 0, 0),
      tcyl(0.05, 0.07, 0.95, WOOD_D, 2.55, 1.15, 0, 0, 0, -1.25, 6),
      // a little crow's nest with a flag
      tcyl(0.22, 0.18, 0.2, WOOD, 0.45, 3.5, 0, 0, 0, 0, 10), vprism([[0, 0], [0.32, 0.09], [0, 0.18]], 0.01, INK, 0.47, 3.58, 0),
    ];
    for (let i = 0; i < 4; i++) {
      const x = -0.9 + i * 0.6;
      p.push(tor(0.11, 0.03, GOLD, x, 0.55, 0.86, 0, 0, 0, 4, 12), tcyl(0.1, 0.1, 0.03, 0x2a3c5a, x, 0.55, 0.855, PI / 2, 0, 0, 12));
    }
    for (const z of [-0.4, 0.4]) p.push(tbox(0.04, 0.3, 0.32, 0xffe08a, -1.15, 1.25, z * 1.4 > 0 ? 0.55 : -0.55, 0, PI / 2, 0));
    // treasure on deck, seaweed and barnacles
    p.push(rb(0.5, 0.3, 0.36, 0xb8764a, 1.05, 1.08, 0.2, 0.04), tbox(0.52, 0.06, 0.38, GOLD, 1.05, 1.24, 0.2));
    for (const [x, z] of [[0.9, -0.3], [1.3, -0.15], [1.6, 0.35]]) p.push(tcyl(0.09, 0.09, 0.03, GOLD, x, 1.1, z, 0.2, 0, 0, 10));
    for (const [x, z, h] of [[-0.6, 0.85, 1.0], [1.8, 0.62, 0.8], [-2.25, 0.4, 1.3], [0.9, -0.88, 0.9]]) {
      p.push(rod([x, 0.1, z], [x + 0.1, h, z + 0.05], 0.05, LEAF, 5), rod([x + 0.1, h, z + 0.05], [x - 0.05, h + 0.35, z], 0.04, 0x7fd88a, 5));
    }
    for (const [x, z] of [[1.9, 0.4], [-0.2, 0.86], [0.5, 0.86]]) p.push(egg(0.07, 0.05, 0.04, 0xf0e8f8, x, 0.4, z + 0.01, 0, 0, 0, 7, 4));
    return C(p);
  },
});

// ======================================================================== MUSIC ROOM
def('musicnote', {
  label: 'Music Note', col: { t: 'box', w: 0.42, h: 0.12, d: 0.66 }, fit: 0.78, value: 1, mass: 0.15,
  tints: RAINBOW,
  build: () => {
    const T = 0.12;
    const up = [
      egg(0.14, 0.1, T / 2, TINT, 0, 0.1, 0, 0, 0, 0.45, 14, 7),
      tbox(0.045, 0.46, T * 0.8, TINT, 0.115, 0.36, 0),
      vprism([[0, 0], [0.05, -0.04], [0.16, -0.12], [0.2, -0.24], [0.16, -0.34], [0.17, -0.22], [0.1, -0.15], [0, -0.13]], T * 0.7, TINT, 0.1, 0.6, 0),
      pale(egg(0.05, 0.03, T * 0.52, TINT, -0.04, 0.13, 0.0, 0, 0, 0.45, 8, 4), 0.25),
    ];
    return C(layFlat(up, T));
  },
});

def('guitarpick', {
  label: 'Guitar Pick', col: { t: 'cyl', r: 0.22, h: 0.06 }, fit: 0.44, value: 1, mass: 0.15,
  tints: RAINBOW,
  build: () => {
    // rounded triangle: the hull of a small tip circle and two wide shoulder circles
    const cs = [];
    for (const [cx, cz, r] of [[0, 0.17, 0.035], [-0.11, -0.08, 0.1], [0.11, -0.08, 0.1]]) for (let i = 0; i < 24; i++) cs.push([cx + r * Math.cos((i / 24) * TAU), cz + r * Math.sin((i / 24) * TAU)]);
    cs.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], hi = [];
    for (const p of cs) { while (lo.length > 1 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
    for (const p of [...cs].reverse()) { while (hi.length > 1 && cross(hi[hi.length - 2], hi[hi.length - 1], p) <= 0) hi.pop(); hi.push(p); }
    const pts = lo.slice(0, -1).concat(hi.slice(0, -1));
    return C([prism(pts, 0.05, TINT, 0, 0, 0, 0.012), pale(prism(ellipsePts(0.05, 0.05, 10), 0.012, TINT, 0, 0.055, -0.03), 0.3)]);
  },
});

def('handbell', {
  label: 'Hand Bell', col: { t: 'cyl', r: 0.28, h: 0.76 }, fit: 0.56, value: 1, mass: 0.15,
  tints: [0xff4a5a, 0xff9a2e, 0xffd23a, 0x5fd16a, 0x3f9dff, 0xa070ff],
  build: () => [
    lathe([[0, 0], [0.26, 0], [0.28, 0.03], [0.23, 0.1], [0.18, 0.24], [0.16, 0.36], [0.11, 0.44], [0, 0.46]], TINT, 0, 0, 0, 18),
    pale(tor(0.255, 0.018, TINT, 0, 0.05, 0, PI / 2, 0, 0, 3, 18), 0.3),
    tcyl(0.04, 0.05, 0.2, WOOD, 0, 0.55, 0, 0, 0, 0, 8),
    egg(0.07, 0.08, 0.07, WOOD_L, 0, 0.68, 0, 0, 0, 0, 10, 7),
    tcyl(0.08, 0.08, 0.03, SILVER, 0, 0.46, 0, 0, 0, 0, 10),
  ],
});

def('harmonica', {
  label: 'Harmonica', col: { t: 'box', w: 0.64, h: 0.18, d: 0.25 }, fit: 0.69, value: 1, mass: 0.15,
  tints: [0x3f9dff, 0xff4a5a, 0xffc94a, 0x7be07a],
  build: () => {
    const p = [
      rb(0.6, 0.1, 0.22, WOOD_L, 0, 0.04, 0, 0.02),
      rb(0.64, 0.05, 0.25, TINT, 0, 0, 0, 0.02), rb(0.64, 0.05, 0.25, TINT, 0, 0.13, 0, 0.02),
      pale(tbox(0.4, 0.004, 0.1, TINT, 0, 0.181, 0), 0.25),
    ];
    for (let i = 0; i < 8; i++) p.push(tbox(0.035, 0.05, 0.01, INK, -0.245 + i * 0.07, 0.09, 0.11));
    return p;
  },
});

def('tambourine', {
  label: 'Tambourine', col: { t: 'cyl', r: 0.45, h: 0.16 }, fit: 0.9, value: 1, mass: 0.15,
  tints: [0xff5c8a, 0x3fa0ff, 0xffc94a, 0x5fd16a, 0xa070ff],
  build: () => {
    const p = [
      custom(new THREE.CylinderGeometry(0.42, 0.42, 0.14, 24, 1, true).translate(0, 0.07, 0), TINT),
      tcyl(0.405, 0.405, 0.012, CREAM, 0, 0.13, 0, 0, 0, 0, 24),
      pale(tor(0.42, 0.016, TINT, 0, 0.14, 0, PI / 2, 0, 0, 3, 24), 0.4),
      tcyl(0.405, 0.405, 0.01, TINT, 0, 0.01, 0, 0, 0, 0, 24),
    ];
    for (let i = 0; i < 5; i++) {
      const a = i * TAU / 5 + 0.3;
      for (const dy of [0.05, 0.09]) p.push(tcyl(0.06, 0.06, 0.012, SILVER, 0.41 * Math.sin(a), dy, 0.41 * Math.cos(a), PI / 2, a, 0, 10));
    }
    // a painted star on the skin
    p.push(prism(starPts(0.12, 0.45, 5, -PI / 2), 0.008, 0xff9ac8, 0, 0.136, 0));
    return p;
  },
});

def('maraca', {
  label: 'Maraca', col: { t: 'box', w: 1.09, h: 0.42, d: 0.42 }, fit: 1.17, value: 2, mass: 0.15,
  tints: [0xff4a5a, 0xff9a2e, 0xffd23a, 0x5fd16a, 0x3f9dff, 0xff7ac0],
  build: () => {
    const p = [
      egg(0.27, 0.21, 0.2, TINT, 0.2, 0.21, 0, 0, 0, 0, 14, 10),
      tcyl(0.045, 0.06, 0.52, WOOD, -0.3, 0.12, 0, 0, 0, PI / 2 + 0.12, 8),
      egg(0.065, 0.06, 0.06, WOOD_D, -0.56, 0.06, 0, 0, 0, 0, 8, 5),
    ];
    for (const x of [0.06, 0.32]) p.push(pale(tor(0.19, 0.018, TINT, x, 0.21, 0, 0, PI / 2, 0, 3, 16), 0.2));
    for (const [y, z] of [[0.35, 0.08], [0.3, -0.12], [0.24, 0.17], [0.38, -0.02]]) p.push(spark(0.03, WHITE, 0.2 + (z * 0.8), y, z));
    return C(p);
  },
});

def('drumsticks', {
  label: 'Drumsticks', col: { t: 'box', w: 1.16, h: 0.1, d: 0.26 }, fit: 1.19, value: 2, mass: 0.15,
  tints: [0xff5c8a, 0x3fa0ff, 0xffc94a, 0x5fd16a, 0xa070ff],
  build: () => {
    const p = [];
    for (const [z, ry] of [[-0.06, 0.05], [0.06, -0.05]]) {
      p.push(tcyl(0.032, 0.048, 1.04, WOOD_L, 0, 0.048, z, 0, ry, PI / 2, 8));
      p.push(egg(0.05, 0.045, 0.045, WOOD_L, -0.54, 0.048, z - Math.sin(ry) * 0.54, 0, 0, 0, 8, 5));
      p.push(tcyl(0.051, 0.051, 0.28, TINT, 0.36, 0.05, z + Math.sin(ry) * 0.36, 0, ry, PI / 2, 8));
    }
    return C(p);
  },
});

function drumParts() {
  const p = [
    tcyl(0.55, 0.55, 0.5, TINT, 0, 0.35, 0, 0, 0, 0, 20),
    tor(0.56, 0.05, WHITE, 0, 0.1, 0, PI / 2, 0, 0, 5, 22), tor(0.56, 0.05, WHITE, 0, 0.6, 0, PI / 2, 0, 0, 5, 22),
    tcyl(0.54, 0.54, 0.02, CREAM, 0, 0.62, 0, 0, 0, 0, 20),
  ];
  for (let i = 0; i < 10; i++) {
    const a0 = i * TAU / 10, a1 = (i + 0.5) * TAU / 10, a2 = (i + 1) * TAU / 10;
    p.push(rod([0.565 * Math.sin(a0), 0.14, 0.565 * Math.cos(a0)], [0.565 * Math.sin(a1), 0.56, 0.565 * Math.cos(a1)], 0.014, GOLD, 4));
    p.push(rod([0.565 * Math.sin(a1), 0.56, 0.565 * Math.cos(a1)], [0.565 * Math.sin(a2), 0.14, 0.565 * Math.cos(a2)], 0.014, GOLD, 4));
  }
  // two sticks crossed on the skin
  for (const s of [-1, 1]) p.push(tcyl(0.025, 0.035, 0.85, WOOD_L, 0, 0.67, 0, 0, s * 0.5, PI / 2, 6), bead(0.04, WOOD_L, -0.425 * Math.cos(s * 0.5), 0.67, 0.425 * Math.sin(s * 0.5)));
  return p.map((g) => g.translate(0, -0.05, 0));
}
def('toydrum', {
  label: 'Toy Drum', col: { t: 'cyl', r: 0.6, h: 0.66 }, fit: 1.2, value: 2, mass: 0.3,
  tints: [0xff4a5a, 0x3f9dff, 0xffd23a, 0x5fd16a, 0xa070ff, 0xff7ac0],
  build: () => drumParts(),
});
def('bigdrum', {
  label: 'Big Drum', col: { t: 'cyl', r: 1.5, h: 1.64 }, fit: 3.0, value: 14, mass: 1.2,
  tints: [0xff4a5a, 0x3f9dff, 0xffd23a, 0x5fd16a, 0xa070ff, 0xff7ac0],
  build: () => scaled(drumParts(), 2.5),
});

def('trumpet', {
  label: 'Trumpet', col: { t: 'box', w: 1.5, h: 0.5, d: 0.5 }, fit: 1.58, value: 4, mass: 0.2,
  tints: [0xffc94a, 0xd8dee8, 0xff9cbc, 0x6fb7ff],
  build: () => {
    const Y = 0.25;
    const bell = custom(latheGeo([[0.04, 0], [0.06, 0.25], [0.12, 0.4], [0.24, 0.5], [0.25, 0.52]], 16).rotateZ(-PI / 2).translate(0.2, Y, 0), TINT);
    const p = [
      bell,
      tcyl(0.04, 0.04, 0.9, TINT, -0.25, Y, 0, 0, 0, PI / 2, 8),
      tcyl(0.035, 0.035, 0.6, TINT, -0.1, Y, -0.16, 0, 0, PI / 2, 8),
      tor(0.08, 0.035, TINT, -0.4, Y, -0.08, PI / 2, PI / 2, 0, 5, 10, PI).rotateY(0),
      tor(0.08, 0.035, TINT, 0.2, Y, -0.08, PI / 2, -PI / 2, 0, 5, 10, PI),
      lathe([[0.02, 0], [0.04, 0.04], [0.06, 0.1], [0.04, 0.12]], SILVER, 0, 0, 0, 10),
    ];
    p[p.length - 1].rotateZ(PI / 2).translate(-0.7, Y, 0);
    for (let i = 0; i < 3; i++) {
      const x = -0.18 + i * 0.12;
      p.push(tcyl(0.045, 0.045, 0.22, TINT, x, Y + 0.02, -0.08, 0, 0, 0, 8), tcyl(0.05, 0.05, 0.04, 0xfff8f0, x, Y + 0.16, -0.08, 0, 0, 0, 10));
    }
    return C(p);
  },
});

def('ukulele', {
  label: 'Ukulele', col: { t: 'box', w: 1.95, h: 0.26, d: 0.75 }, fit: 2.09, value: 7, mass: 0.3,
  tints: [0xff7a5a, 0x3fb8ff, 0xffd23a, 0x5fd16a, 0xa070ff, 0xff7ac0],
  build: () => {
    const body = [...ellipsePts(0.36, 0.36, 22, -0.32, 0)];
    const p = [
      prism(body, 0.2, TINT, 0, 0, 0, 0.02),
      prism(ellipsePts(0.28, 0.29, 20, 0.12, 0), 0.198, TINT, 0, 0, 0, 0.02),
      pale(prism(ellipsePts(0.32, 0.32, 22, -0.32, 0), 0.012, TINT, 0, 0.2, 0), 0.5),
      pale(prism(ellipsePts(0.24, 0.25, 20, 0.12, 0), 0.012, TINT, 0, 0.198, 0), 0.5),
      tcyl(0.1, 0.1, 0.02, INK, -0.12, 0.215, 0, 0, 0, 0, 16),
      rb(0.08, 0.04, 0.3, WOOD_D, -0.5, 0.21, 0, 0.015),
      // the neck, fretboard, headstock and pegs
      rb(0.72, 0.08, 0.13, WOOD, 0.68, 0.12, 0, 0.03),
      tbox(0.7, 0.012, 0.11, WOOD_D, 0.68, 0.205, 0),
      rb(0.26, 0.08, 0.2, TINT, 1.12, 0.12, 0, 0.04),
    ];
    for (let i = 0; i < 5; i++) p.push(tbox(0.012, 0.016, 0.11, SILVER, 0.42 + i * 0.12, 0.214, 0));
    for (const s of [-1, 1]) for (const dx of [-0.06, 0.06]) p.push(tcyl(0.025, 0.025, 0.1, WHITE, 1.12 + dx, 0.16, s * 0.14, PI / 2, 0, 0, 6));
    for (let i = 0; i < 4; i++) p.push(tbox(1.5, 0.008, 0.008, WHITE, 0.35, 0.23, -0.045 + i * 0.03));
    return C(p);
  },
});

def('xylophone', {
  label: 'Xylophone', col: { t: 'box', w: 1.7, h: 0.22, d: 1.0 }, fit: 1.97, value: 7, mass: 0.4,
  tints: [0xff7ac0, 0x3f9dff, 0xffd23a, 0x5fd16a],
  build: () => {
    const p = [
      tbox(1.7, 0.12, 0.1, TINT, 0, 0.06, -0.26, 0, 0.16, 0), tbox(1.7, 0.12, 0.1, TINT, 0, 0.06, 0.26, 0, -0.16, 0),
    ];
    for (let i = 0; i < 8; i++) {
      const x = -0.7 + i * 0.2, L = 0.82 - i * 0.065;
      p.push(tbox(0.16, 0.07, L, [0xff4a5a, 0xff9a2e, 0xffd23a, 0x5fd16a, 0x3fc8c0, 0x3f9dff, 0xa070ff, 0xff7ac0][i], x, 0.155, 0));
      for (const s of [-1, 1]) p.push(tcyl(0.02, 0.02, 0.01, SILVER, x, 0.195, s * (L / 2 - 0.08), 0, 0, 0, 5));
    }
    // four wheels and two mallets lying in front
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.push(tcyl(0.07, 0.07, 0.05, WHITE, sx * 0.72, 0.07, sz * (0.32 - sx * 0.1), PI / 2, 0, 0, 6));
    for (const [z, ry] of [[0.44, 0.1], [0.46, -0.15]]) p.push(tcyl(0.02, 0.02, 0.7, WOOD_L, 0.1, 0.03, z, 0, ry, PI / 2, 6), bead(0.045, z > 0.45 ? 0xff4a5a : 0x3f9dff, 0.1 + 0.36 * Math.cos(ry), 0.045, z - 0.36 * Math.sin(ry)));
    return C(p);
  },
});

def('toykeyboard', {
  label: 'Toy Keyboard', col: { t: 'box', w: 2.5, h: 0.4, d: 1.0 }, fit: 2.69, value: 12, mass: 0.6,
  tints: [0xff7ac0, 0x3f9dff, 0xffc94a, 0x5fd16a, 0xa070ff],
  build: () => {
    const p = [rb(2.5, 0.3, 1.0, TINT, 0, 0, 0, 0.1), pale(tbox(2.3, 0.01, 0.36, TINT, 0, 0.3, -0.26), 0.35)];
    const n = 15, kw = 2.1 / n;
    for (let i = 0; i < n; i++) p.push(tbox(kw - 0.015, 0.06, 0.46, WHITE, -1.05 + (i + 0.5) * kw, 0.31, 0.2));
    for (let i = 0; i < n - 1; i++) if ([0, 1, 3, 4, 5].includes(i % 7)) p.push(tbox(kw * 0.6, 0.06, 0.28, INK, -1.05 + (i + 1) * kw, 0.35, 0.1));
    // speakers, a little screen and colorful buttons
    for (const s of [-1, 1]) {
      p.push(tcyl(0.16, 0.16, 0.02, 0x5a5068, s * 0.92, 0.31, -0.26, 0, 0, 0, 14));
      for (let k = 0; k < 6; k++) { const a = k * TAU / 6; p.push(spark(0.018, INK, s * 0.92 + 0.08 * Math.cos(a), 0.33, -0.26 + 0.08 * Math.sin(a))); }
    }
    p.push(rb(0.5, 0.03, 0.2, 0x9fe8d0, 0, 0.3, -0.27, 0.02));
    [0xff4a5a, 0xffd23a, 0x5fd16a, 0x3f9dff].forEach((c, i) => p.push(tcyl(0.045, 0.045, 0.04, c, -0.55 + i * 0.12, 0.31, -0.27, 0, 0, 0, 10)));
    [0xa070ff, 0xff9a2e].forEach((c, i) => p.push(tcyl(0.045, 0.045, 0.04, c, 0.45 + i * 0.12, 0.31, -0.27, 0, 0, 0, 10)));
    return p;
  },
});

def('gramophone', {
  label: 'Gramophone', col: { t: 'box', w: 1.64, h: 2.44, d: 2.24 }, fit: 2.78, value: 12, mass: 0.8,
  tints: [0xffc94a, 0xff9cbc, 0x8fc4ff, 0x9fe0b8, 0xc5a8ff],
  build: () => {
    const horn = latheGeo([[0.07, 0], [0.09, 0.3], [0.16, 0.6], [0.32, 0.86], [0.62, 1.04], [0.78, 1.1]], 18);
    const hornIn = latheGeo([[0.76, 1.1], [0.6, 1.0], [0.3, 0.84], [0.12, 0.6]], 18);
    const place = (g) => g.rotateX(1.05).translate(0, 1.18, -0.05);
    const p = [
      rb(1.2, 0.5, 1.1, WOOD, 0, 0, -0.35, 0.06), rb(1.24, 0.06, 1.14, WOOD_D, 0, 0.5, -0.35, 0.03),
      tcyl(0.46, 0.46, 0.03, INK, 0, 0.57, -0.35, 0, 0, 0, 22), tcyl(0.14, 0.14, 0.035, 0xff5c8a, 0, 0.575, -0.35, 0, 0, 0, 12),
      tor(0.3, 0.006, 0x5a5068, 0, 0.59, -0.35, PI / 2, 0, 0, 3, 20),
      custom(place(horn), TINT), shade(custom(place(hornIn), TINT), 0xd8d8d8),
      // the tone arm rising from the back right into the horn's neck
      tcyl(0.06, 0.08, 0.6, GOLD, 0.42, 0.85, -0.7, 0, 0, 0, 8),
      rod([0.42, 1.15, -0.7], [0.0, 1.2, -0.08], 0.07, GOLD, 8),
      rod([0.3, 0.75, -0.62], [0.12, 0.62, -0.25], 0.02, SILVER, 4),
      tcyl(0.05, 0.05, 0.12, GOLD, 0.62, 0.3, 0.2, 0, 0, PI / 2, 8),
    ];
    p.push(tor(0.78, 0.04, GOLD, 0, 0, 0, PI / 2, 0, 0, 4, 22).translate(0, 1.1, 0));
    place(p[p.length - 1]);
    return C(p);
  },
});

def('grandpiano', {
  label: 'Grand Piano', col: { t: 'box', w: 2.8, h: 3.55, d: 4.24 }, fit: 5.08, value: 41, mass: 6,
  tints: [0xfff6ee, 0xffc4d8, 0xbfdcff, 0xd8c4ff],
  build: () => {
    // footprint: straight left side, the curved right side, keyboard at the front (+z)
    const shape = [[-1.35, 1.2], [1.35, 1.2], [1.35, 0.3]];
    for (let i = 0; i <= 10; i++) { const t = i / 10; shape.push([1.35 - 0.9 * Math.sin(t * PI / 2) * 0.6 - t * 0.2, 0.3 - 1.4 * t + 0.3 * Math.sin(t * PI)]); }
    for (let i = 0; i <= 8; i++) { const a = (i / 8) * PI; shape.push([-0.0 + 0.65 * Math.cos(a) + -0.0, -1.3 - 0.55 * Math.sin(a) - 0.0]); }
    shape.push([-1.35, -1.3]);
    const p = [
      prism(shape, 0.8, TINT, 0, 1.15, 0, 0.04),
      pale(prism(shape.map(([x, z]) => [x * 0.95, z * 0.97]), 0.02, TINT, 0, 1.96, 0), 0.15),
      // the strings' gold harp inside, seen with the lid up
      prism(shape.map(([x, z]) => [x * 0.8, z * 0.82 - 0.05]), 0.02, 0xffd57a, 0, 1.97, 0),
      // keyboard block, keys, music stand
      rb(2.7, 0.3, 0.6, TINT, 0, 1.15, 1.45, 0.05),
      tbox(2.3, 0.06, 0.4, WHITE, 0, 1.48, 1.5),
      vprism([[-0.6, 0], [0.6, 0], [0.5, 0.5], [-0.5, 0.5]], 0.04, TINT, 0, 1.98, 1.0),
      vprism([[-0.25, 0.05], [0.25, 0.05], [0.25, 0.4], [-0.25, 0.4]], 0.01, WHITE, 0, 1.98, 1.03),
    ];
    for (let i = 0; i < 16; i++) if ([0, 1, 3, 4, 5].includes(i % 7)) p.push(tbox(0.07, 0.06, 0.24, INK, -1.08 + (i + 1) * (2.3 / 17), 1.52, 1.42));
    // the lid, propped open on the curved side
    const lid = custom(prismGeo(shape, 0.06).translate(1.35, 0, 0).rotateZ(0.6).translate(-1.35, 1.98, 0), TINT);
    p.push(lid, rod([1.0, 1.98, -0.2], [1.0 - 0.0, 1.98 + 2.35 * Math.sin(0.6) * 0.5, -0.2], 0.03, GOLD, 4));
    // legs with gold casters, the pedal lyre
    for (const [x, z] of [[-1.15, 1.0], [1.15, 1.0], [-0.3, -1.4]]) p.push(tcyl(0.13, 0.1, 1.15, TINT, x, 0.575, z, 0, 0, 0, 10), spark(0.07, GOLD, x, 0.07, z));
    p.push(tbox(0.3, 0.75, 0.1, TINT, 0, 0.4, 1.3), tbox(0.34, 0.04, 0.16, GOLD, 0, 0.1, 1.38));
    // the bench in front
    p.push(rb(1.4, 0.16, 0.55, TINT, 0, 0.62, 2.05, 0.05), pale(rb(1.3, 0.08, 0.48, TINT, 0, 0.78, 2.05, 0.04), 0.4));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.push(tcyl(0.05, 0.04, 0.62, TINT, sx * 0.6, 0.31, 2.05 + sz * 0.2, 0, 0, 0, 6));
    return C(p);
  },
});

// World -> its new props (smallest first). Used by the dev galleries and the backdrop preview.
export const WAVE5_WORLDS = {
  pets: ['kibble', 'fishfood', 'dogtreat', 'squeakyball', 'toymouse', 'petcollar', 'petbowl', 'plushkitten', 'plushpuppy', 'kibblebag', 'chewbone', 'scratchpost', 'bigsqueaky', 'petcarrier', 'petbed', 'doghouse', 'cattree'],
  aquarium: ['tankpebble', 'bubbles', 'scallop', 'seastar', 'seacoral', 'conch', 'diverhelmet', 'toyanchor', 'toysub', 'treasurechest', 'giantclam', 'tankcastle', 'bigsub', 'sunkenship'],
  music: ['guitarpick', 'handbell', 'harmonica', 'musicnote', 'tambourine', 'maraca', 'drumsticks', 'toydrum', 'trumpet', 'ukulele', 'xylophone', 'gramophone', 'toykeyboard', 'bigdrum', 'grandpiano'],
};
