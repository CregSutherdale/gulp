// Season 7 prop pack (GRAND FINALE): Pizza Parlor, Dino Dig and Fairy Castle.
// Same conventions as props_wave3.js: glossy toy look from code geometry only (no
// external art, nothing generated), base at y=0, centered on the collider, fronts face
// +z (the camera), vehicles point +x. `fit` = smallest hole diameter that swallows it,
// `value` ~ 1.6*fit^2. tools/check_levels.mjs validates every prop.
// This is the hardest season, so the packs are built for hard boards: most small props
// come in 5-7 colors (some deliberately close: dough shades, cheese shades, gem shades),
// and every world has look-alike pairs: a small edible one and a big decoy of the same
// shape (slice/whole pizza, cheese wedge/wheel, dino egg/big egg, gem/big gem).
import * as THREE from 'three';
import { def } from './props.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { box, rbox, cyl, cone, ball, custom, TINT } from './geo.js';

const TAU = Math.PI * 2, PI = Math.PI;

// ------------------------------------------------------------------ palette
const WHITE = 0xfffaf4, CREAM = 0xfff0d4, INK = 0x3b2d3f, BLUSH = 0xff9eb8;
const WOOD = 0xd39a5e, WOOD_D = 0x9e6a3e, WOOD_L = 0xeec58e;
const STEEL = 0xaab4c4, SILVER = 0xe1e7ef, GOLD = 0xffc94a, TIRE = 0x3a3646, NAVY = 0x3a3f52;
const LEAF = 0x5cc46b, GLASS = 0xdcefff, SKIN = 0xffd3b4;
const RAINBOW = [0xff4a5a, 0xff9a2e, 0xffd23a, 0x5fd16a, 0x3f9dff, 0xa070ff, 0xff7ac0];
const POPS = [0xff5c8a, 0x5cc8ff, 0xffd23f, 0x7be07a, 0xb48cff, 0xff9a3a];

// ------------------------------------------------------------------ local helpers
// (mirrors props_wave2.js so all packs build shapes the same way)
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
// Light rounded box (one bevel segment, ~1/3 the triangles of geo.js rbox). Base at y.
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
// Ribbed squashed sphere (tomato pincushion). Base at y.
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
const two = (geo, pick, a, b) => multi(geo, (x, y, z) => (pick(x, y, z) ? 0 : 1), [a, b]);
// Keep only the triangles that pass `keep` and turn them inside out (glass shells: the
// inner back half shows from the front).
function shellInside(geo, keep) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const P = g.attributes.position, N = g.attributes.normal, p = [], n = [];
  for (let i = 0; i < P.count; i += 3) {
    let x = 0, y = 0, z = 0;
    for (let k = 0; k < 3; k++) { x += P.getX(i + k); y += P.getY(i + k); z += P.getZ(i + k); }
    if (!keep(x / 3, y / 3, z / 3)) continue;
    for (const k of [0, 2, 1]) {
      p.push(P.getX(i + k), P.getY(i + k), P.getZ(i + k));
      n.push(-N.getX(i + k), -N.getY(i + k), -N.getZ(i + k));
    }
  }
  const b = new THREE.BufferGeometry();
  b.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  b.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3));
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
// Even points on a sphere (fluff, yarn wraps, lights).
const fib = (n) => Array.from({ length: n }, (_, i) => {
  const y = 1 - (2 * i + 1) / n, r = Math.sqrt(1 - y * y), a = i * 2.39996;
  return [Math.cos(a) * r, y, Math.sin(a) * r];
});


// Flat-shaded lathe (cut gems, faceted crowns).
const facet = (pts, seg, col, x = 0, y = 0, z = 0) => {
  const g = latheGeo(pts, seg).toNonIndexed(); g.computeVertexNormals();
  return custom(g.translate(x, y, z), col);
};
// Rod between two points (handles, necks, tails).
function rod(a, b, r0, r1, col, seg = 8) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), len = A.distanceTo(B) || 0.001;
  const g = new THREE.CylinderGeometry(r1, r0, len, seg).translate(0, len / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize())).translate(A.x, A.y, A.z);
  return custom(g, col);
}
// Points on a leaf / almond outline along x (half width w at the middle).
const leafPts = (L, w, n = 8) => {
  const top = [], bot = [];
  for (let i = 0; i <= n; i++) { const t = i / n, x = -L / 2 + L * t, h = w * Math.pow(Math.sin(PI * t), 0.8); top.push([x, h]); bot.push([x, -h]); }
  return [...top, ...bot.reverse().slice(1, -1)];
};
// Upright shield outline (u = x, v = y), point at the bottom (v = 0).
const shieldPts = (w, h) => {
  const p = [[0, 0]];
  for (let i = 1; i <= 6; i++) { const t = i / 6; p.push([(w / 2) * Math.sin((t * PI) / 2), h * 0.55 * (1 - Math.cos((t * PI) / 2))]); }
  p.push([w / 2, h], [-w / 2, h]);
  for (let i = 6; i >= 1; i--) { const t = i / 6; p.push([-(w / 2) * Math.sin((t * PI) / 2), h * 0.55 * (1 - Math.cos((t * PI) / 2))]); }
  return p;
};
// Heart outline (u = x, v = y), centered.
const heartPts = (r) => Array.from({ length: 20 }, (_, i) => {
  const t = (i / 20) * TAU, x = 16 * Math.sin(t) ** 3, y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
  return [(x / 17) * r, (y / 17) * r];
});
// Arch outline (u = x, v = y): a doorway w wide, straight sides to h0, round top.
const archPts = (w, h0) => [[-w / 2, 0], [w / 2, 0], [w / 2, h0], ...Array.from({ length: 9 }, (_, i) => { const a = (i / 8) * PI; return [(w / 2) * Math.cos(a), h0 + (w / 2) * Math.sin(a)]; }), [-w / 2, h0]];
const DOUGH = 0xf3d29a, CRUST = 0xe2a95e, SAUCE = 0xe8473c, MOZZ = 0xffe9a6, BASIL = 0x3fae4a;
const SAND = 0xf1d39a, SAND_D = 0xd9b479, BONE = 0xfff4dc;
const PEARL = 0xfff6fb, ROSE = 0xffb3cf;

// ======================================================================== PIZZA PARLOR
// Topping colors shared by the slice and the whole pizza (a look-alike pair):
// 0 pepperoni red, 1 green pepper, 2 mushroom tan, 3 pineapple yellow, 4 olive black.
const TOPPING = [0xe0403a, 0x4fbf5a, 0xc8a07a, 0xffd23a, 0x3b3542];
// Cheese wedge / cheese wheel: 0 yellow, 1 orange, 2 cream, 3 pale yellow (look-alikes).
const CHEESES = [0xffd23f, 0xff9f2e, 0xfff0b8, 0xffe680];

def('pepperoni', {
  label: 'Pepperoni', col: { t: 'cyl', r: 0.2, h: 0.07 }, fit: 0.4, value: 1, mass: 0.15,
  tints: [0xe0403a, 0xff8a3d, 0xff7fa8, 0x9a5a3a, 0xb8324a],
  build: () => {
    const p = [lathe([[0, 0], [0.18, 0], [0.2, 0.02], [0.195, 0.05], [0.16, 0.07], [0, 0.068]], TINT, 0, 0, 0, 18)];
    for (const [x, z] of [[0.06, 0.04], [-0.07, 0.06], [-0.02, -0.08], [0.09, -0.06], [-0.1, -0.02]]) p.push(pale(spark(0.022, TINT, x, 0.064, z), 0.45));
    return p;
  },
});

def('olive', {
  label: 'Olive', col: { t: 'cyl', r: 0.15, h: 0.22 }, fit: 0.3, value: 1, mass: 0.15,
  tints: [0x3b3542, 0x6f9a3a, 0x7a3f6e, 0x9aa04a],
  build: () => [
    egg(0.14, 0.11, 0.1, TINT, -0.01, 0.11, 0, 0, 0, 0, 12, 8),
    egg(0.03, 0.045, 0.04, 0xff4a3d, 0.125, 0.11, 0, 0, 0, 0, 7, 5),
    pale(egg(0.05, 0.02, 0.03, TINT, -0.04, 0.2, 0.02, 0, 0, 0, 6, 4), 0.35),
  ],
});

def('mushslice', {
  label: 'Mushroom', col: { t: 'cyl', r: 0.22, h: 0.34 }, fit: 0.44, value: 1, mass: 0.15,
  tints: [0xf2e6d8, 0xc89a6a, 0x8a5a3a, 0xe8b0a0],
  build: () => [
    lathe([[0, 0], [0.09, 0], [0.1, 0.03], [0.08, 0.16], [0, 0.16]], 0xfff6ea, 0, 0, 0, 12),
    lathe([[0, 0], [0.2, 0], [0.22, 0.03], [0.21, 0.08], [0.16, 0.15], [0.08, 0.19], [0, 0.2]], TINT, 0, 0.13, 0, 16),
    pale(spark(0.03, TINT, 0.07, 0.29, 0.06), 0.4), pale(spark(0.025, TINT, -0.08, 0.27, -0.03), 0.4),
  ],
});

def('basil', {
  label: 'Basil Leaf', col: { t: 'box', w: 0.5, h: 0.06, d: 0.28 }, fit: 0.57, value: 1, mass: 0.15,
  tints: [0x3fae4a, 0x6cc75a, 0x2f8a4e, 0x9ad65a],
  build: () => [
    prism(leafPts(0.5, 0.14), 0.05, TINT, 0, 0, 0, 0.012),
    pale(tbox(0.4, 0.012, 0.016, TINT, 0, 0.055, 0), 0.5),
    ...[-0.1, 0, 0.1].flatMap((x) => [-1, 1].map((s) => pale(tbox(0.09, 0.01, 0.012, TINT, x + 0.03, 0.054, s * 0.04, 0, s * 0.7, 0), 0.5))),
  ],
});

function cheeseWedge() {
  const p = [prism([[-0.25, -0.18], [0.25, 0], [-0.25, 0.18]], 0.3, TINT, 0, 0, 0, 0.015)];
  p.push(pale(tbox(0.03, 0.29, 0.34, TINT, -0.24, 0.15, 0), 0.6));
  for (const [x, y, z, r] of [[-0.05, 0.12, 0.1, 0.035], [-0.15, 0.2, 0.14, 0.03], [0.08, 0.09, 0.045, 0.026], [-0.12, 0.08, -0.13, 0.03], [0.02, 0.2, -0.07, 0.025]]) p.push(shade(egg(r, r, r * 0.5, TINT, x, y, z, 0, z > 0 ? -0.6 : PI + 0.6, 0, 7, 5), 0xc89a3a));
  return p;
}
def('cheese', {
  label: 'Cheese Wedge', col: { t: 'box', w: 0.5, h: 0.32, d: 0.36 }, fit: 0.62, value: 1, mass: 0.15,
  tints: CHEESES,
  build: () => C(cheeseWedge()),
});

def('doughball', {
  label: 'Dough Ball', col: { t: 'ball', r: 0.32 }, fit: 0.64, value: 1, mass: 0.15,
  tints: [0xf6deb0, 0xe0b27a, 0xfbefe2, 0xc99a60],
  build: () => {
    const p = [egg(0.32, 0.295, 0.32, TINT, 0, 0.295, 0, 0, 0, 0, 16, 10)];
    for (const [x, y, z] of fib(9)) if (y > 0.2) p.push(pale(egg(0.04, 0.015, 0.04, TINT, x * 0.26, 0.295 + y * 0.28, z * 0.26, 0, 0, 0, 6, 3), 0.25));
    return p;
  },
});

def('tomato', {
  label: 'Tomato', col: { t: 'ball', r: 0.38 }, fit: 0.76, value: 1, mass: 0.15,
  tints: [0xff4a3d, 0xff9a2e, 0xffd23a, 0x8fd45a],
  build: () => [
    ribbed(0.38, 0.9, 6, 0.08, TINT, 0, 0, 0, 20, 10),
    pale(egg(0.1, 0.05, 0.07, TINT, -0.12, 0.6, 0.14, 0, 0, 0, 7, 4), 0.4),
    prism(starPts(0.17, 0.35, 5), 0.025, 0x3f9a3a, 0, 0.665, 0),
    tcyl(0.025, 0.035, 0.08, 0x3f8a3a, 0, 0.72, 0, 0, 0, 0, 6),
  ],
});

def('sodacup', {
  label: 'Soda Cup', col: { t: 'cyl', r: 0.3, h: 0.85 }, fit: 0.6, value: 1, mass: 0.15,
  tints: [0xff5c6a, 0x4f9dff, 0x5fd16a, 0xb48cff, 0xff9a3a],
  build: () => {
    const g = latheGeo([[0, 0], [0.22, 0], [0.24, 0.02], [0.29, 0.66], [0, 0.66]], 18);
    return [
      ...two(g, (x, y) => y > 0.24 && y < 0.42, WHITE, TINT),
      lathe([[0, 0], [0.3, 0], [0.3, 0.05], [0.24, 0.08], [0, 0.085]], WHITE, 0, 0.65, 0, 18),
      rod([0.05, 0.7, 0], [0.12, 0.88, 0.02], 0.03, 0.03, TINT, 6),
      egg(0.06, 0.06, 0.015, TINT, 0, 0.33, 0.266, 0, 0, 0, 10, 5),
    ];
  },
});

function sliceParts() {
  const tri = [[-0.5, -0.31], [0.5, 0], [-0.5, 0.31]];
  const p = [
    prism(tri, 0.06, DOUGH, 0, 0, 0, 0.01),
    prism([[-0.44, -0.25], [0.42, 0], [-0.44, 0.25]], 0.025, SAUCE, 0, 0.055, 0),
    prism([[-0.45, -0.24], [0.4, 0], [-0.45, 0.24]], 0.03, MOZZ, 0, 0.07, 0, 0.006),
    custom(new THREE.CapsuleGeometry(0.075, 0.5, 4, 10).rotateX(PI / 2).translate(-0.445, 0.075, 0), CRUST),
  ];
  for (const [x, z] of [[-0.22, -0.1], [-0.2, 0.12], [0.05, 0.02], [0.24, -0.02], [-0.33, 0.0]]) p.push(tcyl(0.07, 0.07, 0.03, TINT, x, 0.11, z, 0, 0, 0, 10));
  p.push(egg(0.05, 0.012, 0.03, BASIL, -0.05, 0.106, -0.12, 0, 0.6, 0, 6, 3));
  return p;
}
def('pizzaslice', {
  label: 'Pizza Slice', col: { t: 'box', w: 1.0, h: 0.16, d: 0.62 }, fit: 1.18, value: 2, mass: 0.15,
  tints: TOPPING,
  build: () => C(sliceParts()),
});

def('flour', {
  label: 'Flour Sack', col: { t: 'box', w: 1.1, h: 1.2, d: 0.8 }, fit: 1.36, value: 3, mass: 0.3,
  tints: [0xfaf3e6, 0xffd9e4, 0xd8ecff, 0xe6f5d6],
  build: () => {
    const sack = new THREE.SphereGeometry(1, 16, 10).scale(0.53, 0.5, 0.38).translate(0, 0.5, 0);
    const p = [
      ...two(sack, (x, y) => y > 0.62 && y < 0.72, 0xff7a6a, TINT),
      lathe([[0.22, 0], [0.14, 0.12], [0.09, 0.2], [0.16, 0.3], [0, 0.32]], TINT, 0, 0.86, 0, 12),
      tor(0.11, 0.025, 0xc8915c, 0, 1.05, 0, PI / 2, 0, 0, 3, 12),
      egg(0.22, 0.2, 0.03, 0xfffaf0, 0, 0.42, 0.36, -0.2, 0, 0, 12, 6),
    ];
    for (let i = 0; i < 3; i++) p.push(egg(0.035, 0.09, 0.015, 0xe8b45a, -0.07 + i * 0.07, 0.44, 0.39, -0.2, 0, (i - 1) * 0.35, 6, 4));
    return p;
  },
});

def('rollingpin', {
  label: 'Rolling Pin', col: { t: 'box', w: 1.7, h: 0.32, d: 0.32 }, fit: 1.73, value: 5, mass: 0.2,
  tints: [0xff8fb0, 0x6fb7ff, 0x7bd99a, 0xffc35a, 0xb48cff],
  build: () => [
    tcyl(0.16, 0.16, 1.06, WOOD_L, 0, 0.16, 0, 0, 0, PI / 2, 16),
    ...[-1, 1].flatMap((s) => [
      tcyl(0.05, 0.05, 0.08, WOOD, s * 0.57, 0.16, 0, 0, 0, PI / 2, 8),
      tcyl(0.065, 0.075, 0.2, TINT, s * 0.71, 0.16, 0, 0, 0, PI / 2, 12),
      egg(0.035, 0.075, 0.075, TINT, s * 0.81, 0.16, 0, 0, 0, 0, 10, 6),
    ]),
    pale(tor(0.162, 0.012, TINT, -0.3, 0.16, 0, 0, PI / 2, 0, 3, 16), 0.3), pale(tor(0.162, 0.012, TINT, 0.3, 0.16, 0, 0, PI / 2, 0, 3, 16), 0.3),
  ],
});

def('cheesewheel', {
  label: 'Cheese Wheel', col: { t: 'cyl', r: 0.9, h: 0.6 }, fit: 1.8, value: 5, mass: 0.6,
  tints: CHEESES,
  build: () => {
    const p = [lathe([[0, 0], [0.82, 0], [0.88, 0.04], [0.9, 0.12], [0.9, 0.48], [0.88, 0.56], [0.82, 0.6], [0, 0.6]], TINT, 0, 0, 0, 24)];
    p.push(pale(tcyl(0.8, 0.8, 0.012, TINT, 0, 0.605, 0, 0, 0, 0, 24), 0.6));
    for (let i = 0; i < 9; i++) { const a = i * 2.39996, r = 0.25 + (i % 3) * 0.2; p.push(shade(egg(0.07, 0.012, 0.07, TINT, r * Math.sin(a), 0.607, r * Math.cos(a), 0, 0, 0, 7, 3), 0xc89a3a)); }
    for (let i = 0; i < 6; i++) { const a = i * TAU / 6 + 0.3; p.push(shade(egg(0.06, 0.07, 0.03, TINT, 0.87 * Math.sin(a), 0.22 + (i % 2) * 0.18, 0.87 * Math.cos(a), 0, a, 0, 7, 4), 0xc89a3a)); }
    return p;
  },
});

def('wholepizza', {
  label: 'Whole Pizza', col: { t: 'cyl', r: 1.0, h: 0.22 }, fit: 2.0, value: 6, mass: 0.3,
  tints: TOPPING,
  build: () => {
    const p = [
      lathe([[0, 0], [0.94, 0], [1.0, 0.04], [1.0, 0.14], [0.94, 0.2], [0.86, 0.16], [0.84, 0.1], [0, 0.1]], CRUST, 0, 0, 0, 28),
      tcyl(0.84, 0.84, 0.03, SAUCE, 0, 0.11, 0, 0, 0, 0, 28),
      lathe([[0, 0], [0.8, 0], [0.82, 0.02], [0.78, 0.04], [0, 0.045]], MOZZ, 0, 0.115, 0, 28),
    ];
    for (let i = 0; i < 4; i++) p.push(tbox(1.66, 0.012, 0.025, 0xd99a4a, 0, 0.162, 0, 0, (i * PI) / 4, 0));
    for (let i = 0; i < 15; i++) { const a = i * 2.39996, r = 0.18 + 0.55 * Math.sqrt((i + 0.5) / 15); p.push(tcyl(0.085, 0.085, 0.03, TINT, r * Math.cos(a), 0.175, r * Math.sin(a), 0, 0, 0, 10)); }
    for (let i = 0; i < 5; i++) { const a = i * TAU / 5 + 0.4; p.push(egg(0.07, 0.012, 0.04, BASIL, 0.45 * Math.cos(a), 0.17, 0.45 * Math.sin(a), 0, a, 0, 6, 3)); }
    return p;
  },
});

def('pizzabox', {
  label: 'Pizza Box Stack', col: { t: 'box', w: 1.6, h: 0.9, d: 1.6 }, fit: 2.26, value: 8, mass: 0.6,
  tints: [0xff6f7f, 0x5cc8ff, 0x7bd99a, 0xffc35a],
  build: () => {
    const p = [];
    [[0, 0, 0], [0.02, 0.3, 0.06], [-0.02, 0.6, -0.04]].forEach(([dx, y, ry], i) => {
      p.push(rb(1.5, 0.27, 1.5, i === 1 ? WHITE : TINT, dx, y, 0, 0.04).rotateY(ry));
      p.push(tbox(1.52, 0.02, 0.06, i === 1 ? TINT : WHITE, dx, y + 0.135, 0.75).rotateY(ry));
    });
    p.push(tcyl(0.42, 0.42, 0.02, WHITE, -0.02, 0.88, -0.02, 0, 0, 0, 20), tcyl(0.34, 0.34, 0.025, TINT, -0.02, 0.89, -0.02, 0, 0, 0, 20));
    p.push(prism([[-0.16, -0.1], [0.18, 0], [-0.16, 0.1]], 0.02, 0xffd23f, -0.02, 0.895, -0.02));
    return p;
  },
});

def('scooter', {
  label: 'Delivery Scooter', col: { t: 'box', w: 2.8, h: 1.9, d: 1.2 }, fit: 3.05, value: 15, mass: 0.9,
  tints: [0xff5c6a, 0x4f9dff, 0x7bd99a, 0xffc35a, 0xff8fc8],
  build: () => {
    const p = [
      ...[-0.85, 0.9].flatMap((x) => [tcyl(0.38, 0.38, 0.26, TIRE, x, 0.38, 0, PI / 2, 0, 0, 18), tcyl(0.2, 0.2, 0.28, SILVER, x, 0.38, 0, PI / 2, 0, 0, 12)]),
      egg(0.75, 0.38, 0.42, TINT, -0.45, 0.78, 0, 0, 0, 0, 16, 8),
      rb(0.8, 0.12, 0.5, 0x4a4458, 0.25, 0.5, 0, 0.05),
      rb(0.75, 0.16, 0.48, 0x4a4458, -0.45, 1.12, 0, 0.07),
      rod([0.75, 0.45, 0], [0.95, 1.5, 0], 0.14, 0.12, TINT, 10),
      tcyl(0.025, 0.025, 1.0, SILVER, 0.95, 1.55, 0, PI / 2, 0, 0, 6),
      ...[-1, 1].map((s) => egg(0.05, 0.05, 0.09, 0x4a4458, 0.95, 1.55, s * 0.5, 0, 0, 0, 6, 4)),
      egg(0.13, 0.13, 0.07, 0xfff3c8, 1.08, 1.4, 0, 0, PI / 2, 0, 10, 6),
      egg(0.3, 0.42, 0.08, TINT, 0.84, 0.95, 0, 0, PI / 2, 0, 12, 6),
      tcyl(0.4, 0.4, 0.1, TINT, 0.9, 0.62, 0, PI / 2, 0, 0, 16),
      rb(0.8, 0.62, 0.78, WHITE, -1.05, 1.18, 0, 0.08),
      tbox(0.82, 0.08, 0.8, TINT, -1.05, 1.5, 0),
      tcyl(0.18, 0.18, 0.02, 0xffd23f, -1.05, 1.5, 0.4, PI / 2, 0, 0, 14),
      ...[[0.06, 0.03], [-0.06, -0.05], [0.02, -0.08]].map(([dx, dy]) => tcyl(0.035, 0.035, 0.02, 0xe0403a, -1.05 + dx, 1.5 + dy, 0.41, PI / 2, 0, 0, 8)),
    ];
    return C(p);
  },
});

def('pizzaoven', {
  label: 'Brick Pizza Oven', col: { t: 'box', w: 4.6, h: 4.2, d: 4.3 }, fit: 6.3, value: 64, mass: 9,
  tints: [0xd9714e, 0xe88a9a, 0xe9b872, 0x8fa3c8],
  build: () => {
    const p = [];
    // brick base (alternate bricks a shade darker), a stone counter top, a log store
    const base = new THREE.BoxGeometry(4.5, 1.3, 3.9, 6, 3, 5).translate(0, 0.65, 0);
    const bb = multi(base, (x, y, z) => { const row = Math.floor(y / 0.33); return (Math.floor((x + z + 4.5 + (row % 2) * 0.22) / 0.45) + row) % 2; }, [TINT, TINT]);
    if (bb[1]) shade(bb[1], 0xe2e2e2);
    p.push(...bb, rb(4.6, 0.18, 4.0, 0xf3ece2, 0, 1.3, 0, 0.06), rb(1.8, 0.7, 0.1, 0x6a4a3a, 0, 0.3, 1.92, 0.04));
    for (let i = 0; i < 6; i++) p.push(tcyl(0.1, 0.1, 0.3, i % 2 ? WOOD : WOOD_D, -0.6 + (i % 3) * 0.6, 0.42 + Math.floor(i / 3) * 0.2, 1.88, PI / 2, 0, 0, 7));
    // the dome, brick-banded
    const dome = new THREE.SphereGeometry(1.85, 16, 6, 0, TAU, 0, PI / 2).scale(1, 1.0, 0.95).translate(0, 1.48, -0.1);
    const db = multi(dome, (x, y, z) => { const row = Math.floor((y - 1.48) / 0.3); return (Math.floor(((Math.atan2(x, z + 0.1) + PI) / TAU) * 16 + (row % 2) * 0.5) + row) % 2; }, [TINT, TINT]);
    if (db[1]) shade(db[1], 0xdedede);
    p.push(...db);
    // mouth: a cream arch, a glowing fire inside, a pizza on its peel
    p.push(vprism(archPts(1.8, 0.7), 0.3, 0xfff0d4, 0, 1.48, 1.6));
    p.push(vprism(archPts(1.4, 0.6), 0.1, 0x3a2430, 0, 1.5, 1.72));
    p.push(egg(0.5, 0.4, 0.06, 0xff9a2e, 0, 1.9, 1.76, 0, 0, 0, 12, 6), egg(0.3, 0.28, 0.05, 0xffe066, 0, 1.8, 1.8, 0, 0, 0, 10, 5));
    p.push(rb(0.4, 0.06, 1.0, WOOD_L, 0.75, 1.48, 1.45, 0.02), tcyl(0.45, 0.45, 0.06, CRUST, 0.75, 1.57, 1.2, 0, 0, 0, 16), tcyl(0.38, 0.38, 0.03, SAUCE, 0.75, 1.6, 1.2, 0, 0, 0, 16));
    for (let i = 0; i < 5; i++) p.push(tcyl(0.07, 0.07, 0.025, 0xe0403a, 0.75 + 0.22 * Math.cos(i * 1.3), 1.625, 1.2 + 0.22 * Math.sin(i * 1.3), 0, 0, 0, 8));
    // chimney with a puff of smoke, a shop sign on a post
    p.push(rb(0.7, 1.6, 0.7, TINT, 0.9, 2.42, -1.05, 0.06), rb(0.86, 0.18, 0.86, 0xf3ece2, 0.9, 4.0, -1.05, 0.05));
    p.push(egg(0.42, 0.26, 0.32, 0xfffaf4, 0.35, 3.9, -0.7, 0, 0, 0, 10, 6));
    p.push(rb(1.4, 0.45, 0.08, 0xfff6e8, -0.2, 3.25, 1.2, 0.05), egg(0.16, 0.16, 0.02, 0xff5c6a, -0.62, 3.475, 1.25, 0, 0, 0, 10, 5), egg(0.16, 0.16, 0.02, 0x5fd16a, 0.22, 3.475, 1.25, 0, 0, 0, 10, 5));
    p.push(tbox(0.4, 0.06, 0.02, 0xffd23f, -0.2, 3.475, 1.25));
    p.push(rod([-0.2, 3.0, 0.9], [-0.2, 3.25, 1.18], 0.03, 0.03, WOOD_D, 5));
    // a basil pot and a cheese dome on the counter
    p.push(lathe([[0, 0], [0.22, 0], [0.28, 0.35], [0, 0.35]], 0xd9714e, -1.75, 1.48, 1.45, 10), ...[0, 1, 2, 3].map((i) => egg(0.13, 0.06, 0.08, BASIL, -1.75 + 0.12 * Math.cos(i * 1.6), 1.88 + (i % 2) * 0.05, 1.45 + 0.12 * Math.sin(i * 1.6), 0, i, 0, 6, 3)));
    p.push(rb(0.5, 0.35, 0.5, WHITE, 1.8, 1.48, 1.4, 0.05), egg(0.2, 0.1, 0.2, MOZZ, 1.8, 1.83, 1.4, 0, 0, 0, 8, 4));
    return p;
  },
});

// ======================================================================== DINO DIG
// Dino egg / big egg / nest share colors: 0 mint, 1 pink, 2 blue, 3 yellow, 4 lilac,
// 5 peach, 6 white (pink/peach and mint/blue are the look-alike pairs).
const EGGS = [0x9fe6c4, 0xffa6c9, 0x8fc8ff, 0xffe27a, 0xc8b0ff, 0xffbf94, 0xf4f1ea];
const DINOS = [0x7bd99a, 0x6fb7ff, 0xff9cc6, 0xffb35a, 0xb48cff, 0xffd84a];

function eggParts() {
  const p = [egg(0.2, 0.26, 0.2, TINT, 0, 0.26, 0, 0, 0, 0, 14, 10)];
  fib(10).forEach(([x, y, z], i) => { if (y > -0.6) p.push(pale(egg(0.035, 0.035, 0.012, TINT, x * 0.19, 0.26 + y * 0.25, z * 0.19, 0, Math.atan2(x, z), 0, 6, 4), i % 2 ? 0.2 : 0.45)); });
  return p;
}
def('dinoegg', {
  label: 'Dino Egg', col: { t: 'cyl', r: 0.22, h: 0.52 }, fit: 0.44, value: 1, mass: 0.15,
  tints: EGGS,
  build: () => eggParts(),
});
def('bigegg', {
  label: 'Giant Dino Egg', col: { t: 'cyl', r: 0.75, h: 1.7 }, fit: 1.5, value: 4, mass: 0.6,
  tints: EGGS,
  build: () => scaled(eggParts(), 3.6, 3.27, 3.6),
});

def('toybone', {
  label: 'Toy Bone', col: { t: 'box', w: 0.56, h: 0.14, d: 0.18 }, fit: 0.59, value: 1, mass: 0.15,
  tints: [0xfff6e0, 0xf2dcb8, 0xffe0e8, 0xe0ecff],
  build: () => [
    tcyl(0.045, 0.045, 0.4, TINT, 0, 0.065, 0, 0, 0, PI / 2, 8),
    ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => egg(0.065, 0.065, 0.065, TINT, sx * 0.215, 0.067, sz * 0.045, 0, 0, 0, 8, 6))),
  ],
});

def('ammonite', {
  label: 'Fossil Shell', col: { t: 'cyl', r: 0.24, h: 0.16 }, fit: 0.48, value: 1, mass: 0.15,
  tints: [0xe6c9a0, 0xc0bcc8, 0xf0b8a8, 0xa8c4d8],
  build: () => {
    const p = [lathe([[0, 0], [0.2, 0], [0.235, 0.03], [0.24, 0.08], [0.22, 0.13], [0.15, 0.16], [0, 0.155]], TINT, 0, 0, 0, 18)];
    for (let i = 0; i < 16; i++) { const t = i / 15, a = t * TAU * 1.6, r = 0.2 * (1 - t * 0.85); p.push(shade(egg(0.03, 0.012, 0.03, TINT, r * Math.cos(a), 0.152 + 0.02 * (1 - t) - 0.02, r * Math.sin(a), 0, 0, 0, 6, 3), 0x9a8a7a)); }
    return p;
  },
});

def('brush', {
  label: 'Dig Brush', col: { t: 'box', w: 0.62, h: 0.12, d: 0.16 }, fit: 0.64, value: 1, mass: 0.15,
  tints: [0xff7a8a, 0x5cc8ff, 0xffd23f, 0x7be07a, 0xb48cff],
  build: () => C([
    tcyl(0.04, 0.05, 0.36, TINT, -0.1, 0.055, 0, 0, 0, PI / 2, 8),
    egg(0.05, 0.05, 0.05, TINT, -0.28, 0.055, 0, 0, 0, 0, 8, 6),
    tcyl(0.055, 0.055, 0.06, SILVER, 0.11, 0.06, 0, 0, 0, PI / 2, 10),
    rb(0.17, 0.11, 0.15, 0xfff0c8, 0.21, 0.005, 0, 0.03),
  ]),
});

def('sandbucket', {
  label: 'Sand Bucket', col: { t: 'cyl', r: 0.36, h: 0.82 }, fit: 0.72, value: 1, mass: 0.15,
  tints: [0xff7a8a, 0x5cc8ff, 0xffd23f, 0x7be07a, 0xb48cff],
  build: () => [
    lathe([[0, 0], [0.25, 0], [0.27, 0.02], [0.33, 0.5], [0.3, 0.5], [0, 0.48]], TINT, 0, 0, 0, 16),
    pale(tor(0.33, 0.03, TINT, 0, 0.5, 0, PI / 2, 0, 0, 4, 18), 0.5),
    egg(0.29, 0.07, 0.29, SAND, 0, 0.49, 0, 0, 0, 0, 12, 5),
    tor(0.3, 0.018, SILVER, 0, 0.5, 0, 0, 0, 0, 3, 12, PI),
    pale(tcyl(0.32, 0.3, 0.06, TINT, 0, 0.3, 0, 0, 0, 0, 16), 0.6),
  ],
});

function babyDino(scale = 1) {
  const p = [
    egg(0.26, 0.2, 0.17, TINT, -0.04, 0.3, 0, 0, 0, 0, 12, 8),
    pale(egg(0.2, 0.13, 0.12, TINT, -0.02, 0.26, 0.06, 0, 0, 0, 10, 6), 0.6),
    egg(0.17, 0.15, 0.15, TINT, 0.24, 0.5, 0, 0, 0, 0, 12, 8),
    rod([-0.26, 0.3, 0], [-0.4, 0.12, 0], 0.08, 0.02, TINT, 8),
    ...[[-0.14, -0.09], [-0.14, 0.09], [0.08, -0.09], [0.08, 0.09]].map(([x, z]) => tcyl(0.06, 0.065, 0.16, TINT, x, 0.08, z, 0, 0, 0, 8)),
    ...[-0.2, -0.06, 0.08].map((x, i) => pale(cone(0.045, 0.08, TINT, x, 0.47 - i * 0.0 + (i === 1 ? 0.02 : 0), 0, 6), 0.5)),
    ...face(0.28, 0.54, 0.135, 0.06, 0.022, true),
  ];
  return scale === 1 ? p : scaled(p, scale);
}
def('babydino', {
  label: 'Baby Dino', col: { t: 'box', w: 0.8, h: 0.7, d: 0.4 }, fit: 0.89, value: 1, mass: 0.15,
  tints: DINOS,
  build: () => C(babyDino()),
});

def('shovel', {
  label: 'Toy Shovel', col: { t: 'box', w: 1.1, h: 0.1, d: 0.36 }, fit: 1.16, value: 2, mass: 0.15,
  tints: [0xff5c6a, 0x4f9dff, 0xffd23f, 0x5fd16a, 0xa070ff],
  build: () => C([
    tcyl(0.035, 0.035, 0.5, TINT, -0.15, 0.05, 0, 0, 0, PI / 2, 8),
    tcyl(0.035, 0.035, 0.22, TINT, -0.42, 0.05, 0, PI / 2, 0, 0, 8),
    prism([[0, -0.17], [0.3, -0.15], [0.42, 0], [0.3, 0.15], [0, 0.17], [-0.04, 0]], 0.06, TINT, 0.12, 0.01, 0, 0.02),
    pale(prism([[0.04, -0.12], [0.28, -0.1], [0.36, 0], [0.28, 0.1], [0.04, 0.12]], 0.015, TINT, 0.12, 0.09, 0), 0.5),
  ]),
});

def('fossiltile', {
  label: 'Fossil Slab', col: { t: 'box', w: 0.9, h: 0.18, d: 0.9 }, fit: 1.27, value: 3, mass: 0.2,
  tints: [0xd9c7a8, 0xc8c0d4, 0xe8c0a8, 0xb8ccb8],
  build: () => {
    const p = [rb(0.88, 0.14, 0.88, TINT, 0, 0, 0, 0.05)];
    // a little fish skeleton pressed into the stone
    p.push(shade(prism(leafPts(0.32, 0.07), 0.02, TINT, -0.04, 0.14, 0), 0xfff2e0));
    p.push(shade(prism([[0, 0], [0.12, -0.1], [0.1, 0], [0.12, 0.1]], 0.02, TINT, -0.33, 0.14, 0), 0xfff2e0));
    for (let i = 0; i < 5; i++) p.push(shade(tbox(0.016, 0.02, 0.2, TINT, -0.15 + i * 0.055, 0.17, 0), 0xfff8f0));
    p.push(shade(spark(0.025, TINT, 0.08, 0.15, 0.02), 0x5a4a3a));
    for (const [x, z, r] of [[0.28, 0.28, 0.05], [-0.3, -0.28, 0.04], [0.3, -0.25, 0.035]]) p.push(shade(egg(r, 0.015, r, TINT, x, 0.14, z, 0, 0, 0, 7, 3), 0x8a8a8a));
    return p;
  },
});

const EGG_NEST = [[-0.22, -0.15], [0.22, -0.12], [0, 0.2]];
def('nest', {
  label: 'Dino Nest', col: { t: 'cyl', r: 0.95, h: 0.7 }, fit: 1.9, value: 6, mass: 0.5,
  tints: EGGS,
  build: () => {
    const p = [lathe([[0, 0], [0.85, 0], [0.95, 0.12], [0.92, 0.32], [0.8, 0.36], [0.6, 0.22], [0, 0.2]], 0xc8915c, 0, 0, 0, 20)];
    for (let i = 0; i < 14; i++) { const a = i * TAU / 14; p.push(tcyl(0.025, 0.025, 0.5, i % 2 ? 0xe2b277 : 0xa8723f, 0.86 * Math.sin(a), 0.3, 0.86 * Math.cos(a), 0, a, PI / 2 - 0.3, 5)); }
    EGG_NEST.forEach(([x, z]) => p.push(egg(0.21, 0.25, 0.21, TINT, x, 0.45, z, 0, 0, 0, 10, 7), pale(egg(0.05, 0.05, 0.015, TINT, x - 0.08, 0.55, z + 0.18, 0, -0.4, 0, 6, 4), 0.3)));
    return p;
  },
});

def('sandpile', {
  label: 'Sand Pile', col: { t: 'cyl', r: 1.05, h: 0.9 }, fit: 2.1, value: 7, mass: 0.8,
  tints: [0xf1d39a, 0xf7c0a0, 0xe9e0b8],
  build: () => {
    const g = new THREE.SphereGeometry(1.0, 20, 8, 0, TAU, 0, PI / 2).scale(1.04, 0.8, 1.04);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = pos.getZ(i), k = 1 + 0.05 * Math.sin(Math.atan2(x, z) * 5); pos.setX(i, x * k / 1.05); pos.setZ(i, z * k / 1.05); }
    g.computeVertexNormals();
    const p = [custom(g, TINT)];
    for (let i = 0; i < 10; i++) { const a = i * 2.39996, r = 0.3 + (i % 3) * 0.2; p.push(pale(egg(0.08, 0.03, 0.08, TINT, r * Math.sin(a), 0.8 * Math.sqrt(Math.max(0, 1 - r * r)) - 0.01, r * Math.cos(a), 0, 0, 0, 6, 3), 0.6)); }
    p.push(tcyl(0.02, 0.02, 0.5, WHITE, 0.1, 0.62, 0, 0, 0, 0, 5), vprism([[0, 0], [0.24, 0.06], [0, 0.13]], 0.01, 0xff5c6a, 0.11, 0.73, 0));
    p.push(rod([-0.45, 0.45, 0.25], [-0.7, 0.85, 0.35], 0.03, 0.03, 0x4f9dff, 6), egg(0.12, 0.03, 0.09, 0x4f9dff, -0.4, 0.45, 0.24, 0.5, 0, 0.8, 8, 4));
    return p;
  },
});

def('stego', {
  label: 'Toy Stego', col: { t: 'box', w: 2.0, h: 1.4, d: 0.9 }, fit: 2.19, value: 8, mass: 0.6,
  tints: DINOS,
  build: () => {
    const p = [
      egg(0.62, 0.42, 0.38, TINT, -0.05, 0.62, 0, 0, 0, 0, 16, 10),
      pale(egg(0.5, 0.25, 0.3, TINT, 0, 0.5, 0.08, 0, 0, 0, 12, 6), 0.55),
      egg(0.2, 0.17, 0.17, TINT, 0.8, 0.45, 0, 0, 0, -0.2, 12, 8),
      rod([0.5, 0.6, 0], [0.78, 0.47, 0], 0.18, 0.13, TINT, 10),
      rod([-0.6, 0.6, 0], [-0.98, 0.35, 0], 0.17, 0.04, TINT, 10),
      ...[[-0.35, -0.22], [-0.35, 0.22], [0.3, -0.22], [0.3, 0.22]].map(([x, z]) => tcyl(0.12, 0.13, 0.32, TINT, x, 0.16, z, 0, 0, 0, 10)),
      ...face(0.88, 0.48, 0.15, 0.065, 0.025, true),
    ];
    // back plates (lighter) and tail spikes
    [[-0.55, 0.92, 0.18], [-0.25, 1.06, 0.24], [0.08, 1.06, 0.24], [0.38, 0.95, 0.18]].forEach(([x, y, s]) => p.push(pale(vprism([[0, -s], [s * 0.85, 0], [0, s * 1.3], [-s * 0.85, 0]], 0.08, TINT, x, y, 0, PI / 2 * 0), 0.45)));
    p.push(...[-1, 1].map((s) => pale(rod([-0.92, 0.4, 0], [-0.98, 0.5, s * 0.36], 0.04, 0.01, TINT, 6), 0.45)));
    return C(p);
  },
});

def('digcart', {
  label: 'Dig Cart', col: { t: 'box', w: 2.0, h: 1.1, d: 1.1 }, fit: 2.28, value: 8, mass: 0.5,
  tints: [0xff5c6a, 0x4f9dff, 0xffc35a, 0x5fd16a, 0xa070ff],
  build: () => {
    const tray = new THREE.CylinderGeometry(0.62, 0.42, 0.5, 4, 1).rotateY(PI / 4).scale(1.25, 1, 0.95).translate(0, 0.62, 0);
    const p = [
      custom(tray, TINT),
      egg(0.72, 0.16, 0.5, SAND, 0, 0.86, 0, 0, 0, 0, 12, 5),
      tcyl(0.27, 0.27, 0.12, TIRE, 0.72, 0.27, 0, PI / 2, 0, 0, 14), tcyl(0.12, 0.12, 0.14, SILVER, 0.72, 0.27, 0, PI / 2, 0, 0, 10),
      ...[-1, 1].flatMap((s) => [rod([0.6, 0.3, s * 0.08], [-0.98, 0.62, s * 0.42], 0.035, 0.035, SILVER, 6), tcyl(0.045, 0.045, 0.16, TINT, -0.92, 0.6, s * 0.42, 0, 0, PI / 2 - 0.2, 8), rod([-0.4, 0.4, s * 0.3], [-0.4, 0, s * 0.3], 0.03, 0.03, SILVER, 6)]),
      // a bone and an egg on the sand
      tcyl(0.035, 0.035, 0.3, BONE, 0.1, 0.98, 0.05, 0, 0.5, PI / 2, 6), ...[-1, 1].map((s) => egg(0.05, 0.05, 0.05, BONE, 0.1 + s * 0.14 * Math.cos(0.5), 0.98, 0.05 - s * 0.14 * Math.sin(0.5), 0, 0, 0, 6, 4)),
      egg(0.1, 0.13, 0.1, 0xffa6c9, -0.25, 1.0, -0.1, 0, 0, 0.3, 8, 6),
    ];
    return C(p);
  },
});

def('digtent', {
  label: 'Dig Tent', col: { t: 'box', w: 2.8, h: 2.8, d: 2.4 }, fit: 3.69, value: 22, mass: 1.6,
  tints: [0xff7a6a, 0x4f9dff, 0x5fd16a, 0xffb83a],
  build: () => {
    const roofG = new THREE.ConeGeometry(1.95, 0.9, 4, 1).rotateY(PI / 4).scale(1.0, 1, 0.84).translate(0, 1.95, 0);
    const p = [
      ...two(roofG, (x, y, z) => Math.floor(((Math.abs(x) > Math.abs(z) * 1.18 ? z : x) + 3) / 0.28) % 2 === 0, TINT, WHITE),
      ...[[-1.3, -1.1], [1.3, -1.1], [-1.3, 1.1], [1.3, 1.1]].map(([x, z]) => tcyl(0.05, 0.06, 1.55, WOOD, x, 0.775, z, 0, 0, 0, 6)),
      ...multi(new THREE.BoxGeometry(2.7, 0.2, 2.3, 10, 1, 1).translate(0, 1.42, 0), (x) => Math.floor((x + 1.35) / 0.27) % 2, [TINT, WHITE]),
      // a little camp table with a map, a lantern and a magnifier
      rb(1.2, 0.08, 0.7, WOOD_L, 0, 0.62, 0.0, 0.03),
      ...[[-0.5, -0.28], [0.5, -0.28], [-0.5, 0.28], [0.5, 0.28]].map(([x, z]) => tcyl(0.03, 0.03, 0.62, WOOD_D, x, 0.31, z, 0, 0, 0, 5)),
      tbox(0.6, 0.012, 0.45, 0xfff3d0, -0.15, 0.71, 0.0, 0, 0.1, 0), egg(0.06, 0.006, 0.06, 0xff5c6a, -0.05, 0.72, 0.05, 0, 0, 0, 6, 3),
      tcyl(0.08, 0.1, 0.22, 0xffe08a, 0.38, 0.81, -0.05, 0, 0, 0, 8), tcyl(0.1, 0.1, 0.03, 0x4a4458, 0.38, 0.94, -0.05, 0, 0, 0, 8),
      tor(0.07, 0.015, 0x4a4458, 0.25, 0.71, 0.18, PI / 2, 0, 0, 3, 10), egg(0.065, 0.006, 0.065, 0xdcefff, 0.25, 0.71, 0.18, 0, 0, 0, 8, 3),
      // crates and a pennant
      rb(0.5, 0.42, 0.45, WOOD, -0.95, 0, 0.7, 0.03), rb(0.4, 0.34, 0.36, WOOD_L, -0.9, 0.42, 0.68, 0.03),
      tcyl(0.02, 0.02, 0.5, WOOD_D, 0, 2.55, 0, 0, 0, 0, 4), vprism([[0, 0], [0.3, 0.06], [0, 0.13]], 0.01, 0xffd23f, 0.01, 2.62, 0),
    ];
    return p;
  },
});

def('longneck', {
  label: 'Toy Longneck', col: { t: 'box', w: 3.6, h: 3.4, d: 1.4 }, fit: 3.86, value: 24, mass: 2,
  tints: DINOS,
  build: () => {
    const p = [
      egg(0.95, 0.62, 0.62, TINT, -0.35, 1.25, 0, 0, 0, 0, 18, 10),
      pale(egg(0.78, 0.38, 0.5, TINT, -0.3, 1.0, 0.12, 0, 0, 0, 14, 6), 0.55),
      rod([0.4, 1.4, 0], [1.25, 2.9, 0], 0.32, 0.17, TINT, 12),
      egg(0.36, 0.24, 0.26, TINT, 1.38, 3.06, 0, 0, 0, -0.15, 12, 8),
      rod([-1.15, 1.3, 0], [-1.75, 0.45, 0], 0.3, 0.05, TINT, 10),
      ...[[-0.85, -0.36], [-0.85, 0.36], [0.2, -0.36], [0.2, 0.36]].map(([x, z]) => tcyl(0.2, 0.22, 0.9, TINT, x, 0.45, z, 0, 0, 0, 10)),
      ...face(1.48, 3.08, 0.24, 0.1, 0.035, true),
    ];
    for (const [x, y, z] of [[-0.7, 1.75, 0.3], [-0.2, 1.8, -0.25], [0.15, 1.6, 0.42], [-0.9, 1.45, -0.45], [0.7, 2.0, 0.22]]) p.push(pale(egg(0.13, 0.08, 0.13, TINT, x, y, z, 0, 0, 0, 8, 5), 0.5));
    return C(p);
  },
});

def('volcano', {
  label: 'Volcano Play Set', col: { t: 'cyl', r: 3.2, h: 4.1 }, fit: 6.4, value: 66, mass: 9,
  tints: [0xff7a2e, 0xff4f8a, 0xffc12e, 0x8a6bff],
  build: () => {
    const p = [lathe([[0, 0], [3.0, 0], [3.2, 0.12], [3.12, 0.32], [0, 0.32]], 0x8fd46a, 0, 0, 0, 28)];
    // the mountain: rocky brown with lava rivers running down from the crater
    const mtn = latheGeo([[2.35, 0], [2.15, 0.6], [1.7, 1.6], [1.25, 2.6], [0.95, 3.3], [0.75, 3.55], [0.55, 3.45], [0.4, 3.3]], 18).translate(0, 0.3, 0);
    p.push(...multi(mtn, (x, y, z) => { const a = Math.atan2(x, z), wob = Math.sin(y * 3 + a * 2) * 0.12; return [0.3, 2.4, 4.4].some((c) => Math.abs(((a - c + wob + 3 * PI) % TAU) - PI) < 0.16 * (y / 3.8 + 0.25)) ? 1 : (Math.floor(y / 0.7) % 2 ? 0 : 2); }, [0xa8735a, TINT, 0x93644e]));
    p.push(tcyl(0.62, 0.55, 0.12, TINT, 0, 3.66, 0, 0, 0, 0, 16), egg(0.45, 0.18, 0.45, 0xffe066, 0, 3.72, 0, 0, 0, 0, 12, 5));
    p.push(egg(0.35, 0.22, 0.3, 0xfffaf4, 0.15, 3.86, -0.1, 0, 0, 0, 10, 6));
    // palm trees, rocks and two little dinos on the grass ring
    for (const [x, z, h] of [[2.2, 1.0, 1.5], [-2.3, 0.6, 1.3], [-1.0, -2.3, 1.6]]) {
      p.push(rod([x, 0.3, z], [x + 0.15, 0.3 + h, z], 0.09, 0.06, 0xb07a4a, 6));
      for (let i = 0; i < 5; i++) { const a = i * TAU / 5; p.push(egg(0.3, 0.04, 0.1, 0x4fbf5a, x + 0.15 + 0.24 * Math.cos(a), 0.25 + h, z + 0.24 * Math.sin(a), 0, -a, -0.35, 6, 3)); }
    }
    for (const [x, z, r] of [[1.4, 2.5, 0.22], [-2.6, -1.0, 0.2], [2.7, -0.9, 0.18], [0.3, 2.85, 0.15]]) p.push(egg(r, r * 0.7, r, 0x9a8a8a, x, 0.3 + r * 0.5, z, 0, 0, 0, 7, 5));
    for (const [x, z, c] of [[-0.9, 2.55, 0xffa6c9], [-0.55, 2.7, 0x9fe6c4], [1.95, -1.9, 0x8fc8ff]]) p.push(egg(0.17, 0.22, 0.17, c, x, 0.52, z, 0, 0, 0, 8, 6));
    return p;
  },
});
// ======================================================================== FAIRY CASTLE
// Gem / big gem: 0 ruby, 1 sapphire, 2 emerald, 3 topaz, 4 amethyst, 5 rose, 6 aqua
// (ruby/rose and emerald/aqua are the look-alike pairs).
const GEMS = [0xff3d6e, 0x3f7dff, 0x2fd08a, 0xffc12e, 0xa45cff, 0xff9cc6, 0x5ce6e6];
const PASTELS = [0xff9cc6, 0xb9a0ff, 0x8fe3c4, 0x9fd2ff, 0xffd27a];
const CASTLE_W = 0xfff6fb;

function gemParts() {
  return [
    facet([[0, 0], [0.09, 0], [0.17, 0.13], [0.17, 0.17], [0.1, 0.3], [0, 0.3]], 6, TINT),
    pale(facet([[0, 0], [0.07, 0], [0, 0.012]], 6, TINT, 0, 0.296, 0), 0.4),
    spark(0.025, 0xffffff, -0.05, 0.25, 0.07),
  ];
}
def('gem', {
  label: 'Gem', col: { t: 'cyl', r: 0.17, h: 0.3 }, fit: 0.34, value: 1, mass: 0.15,
  tints: GEMS,
  build: () => gemParts(),
});
def('biggem', {
  label: 'Giant Gem', col: { t: 'cyl', r: 0.8, h: 1.4 }, fit: 1.6, value: 4, mass: 0.6,
  tints: GEMS,
  build: () => scaled(gemParts(), 4.7, 4.67, 4.7),
});

def('crown', {
  label: 'Crown', col: { t: 'cyl', r: 0.24, h: 0.3 }, fit: 0.48, value: 1, mass: 0.15,
  tints: [0xffc94a, 0xdfe6ef, 0xffb39a, 0xff9cc6, 0xb9a0ff],
  build: () => {
    const p = [lathe([[0.19, 0], [0.22, 0], [0.22, 0.14], [0.19, 0.14], [0.19, 0]], TINT, 0, 0, 0, 16),
      pale(tor(0.215, 0.022, TINT, 0, 0.015, 0, PI / 2, 0, 0, 3, 16), 0.4)];
    for (let i = 0; i < 5; i++) {
      const a = i * TAU / 5;
      p.push(custom(new THREE.ConeGeometry(0.055, 0.13, 6).translate(0.21 * Math.sin(a), 0.2, 0.21 * Math.cos(a)), TINT));
      p.push(egg(0.025, 0.025, 0.025, 0xffffff, 0.21 * Math.sin(a), 0.275, 0.21 * Math.cos(a), 0, 0, 0, 6, 4));
      p.push(egg(0.03, 0.03, 0.012, GEMS[i % 5], 0.215 * Math.sin(a + PI / 5), 0.075, 0.215 * Math.cos(a + PI / 5), 0, a + PI / 5, 0, 6, 4));
    }
    return p;
  },
});

def('wand', {
  label: 'Magic Wand', col: { t: 'box', w: 0.66, h: 0.1, d: 0.18 }, fit: 0.68, value: 1, mass: 0.15,
  tints: [0xffd23a, 0xff7ac0, 0x5cc8ff, 0xb48cff, 0x7be07a],
  build: () => C([
    tcyl(0.022, 0.026, 0.46, CASTLE_W, -0.08, 0.035, 0, 0, 0, PI / 2, 8),
    pale(tor(0.024, 0.008, TINT, -0.2, 0.035, 0, 0, PI / 2, 0, 3, 8), 0.5), pale(tor(0.024, 0.008, TINT, -0.1, 0.035, 0, 0, PI / 2, 0, 3, 8), 0.5),
    prism(starPts(0.09, 0.48), 0.06, TINT, 0.24, 0.0, 0, 0.018),
    spark(0.02, 0xffffff, 0.22, 0.08, 0.03),
  ]),
});

def('tinyshield', {
  label: 'Tiny Shield', col: { t: 'box', w: 0.44, h: 0.56, d: 0.16 }, fit: 0.47, value: 1, mass: 0.15,
  tints: [0xff7a8a, 0x5c9dff, 0x5fd16a, 0xb48cff, 0xffc35a],
  build: () => [
    vprism(shieldPts(0.42, 0.5), 0.07, TINT, 0, 0.05, 0.01, 0, 0.01),
    vprism(shieldPts(0.32, 0.38), 0.02, CASTLE_W, 0, 0.11, 0.05),
    vprism(heartPts(0.08), 0.02, TINT, 0, 0.32, 0.065),
    rb(0.3, 0.06, 0.15, 0xffc94a, 0, 0, 0, 0.02),
  ],
});

def('potion', {
  label: 'Potion', col: { t: 'cyl', r: 0.2, h: 0.5 }, fit: 0.4, value: 1, mass: 0.15,
  tints: [0xff5ca8, 0x5cc8ff, 0x7be07a, 0xb48cff, 0xffb83a],
  build: () => [
    egg(0.19, 0.18, 0.19, TINT, 0, 0.18, 0, 0, 0, 0, 14, 9),
    pale(egg(0.17, 0.05, 0.17, TINT, 0, 0.27, 0, 0, 0, 0, 12, 4), 0.35),
    tcyl(0.07, 0.08, 0.12, 0xe6f4ff, 0, 0.39, 0, 0, 0, 0, 10),
    tcyl(0.06, 0.055, 0.07, WOOD, 0, 0.465, 0, 0, 0, 0, 8),
    spark(0.03, 0xffffff, -0.08, 0.26, 0.13), egg(0.04, 0.04, 0.012, 0xffffff, 0.06, 0.12, 0.17, 0, 0.3, 0, 6, 4),
  ],
});

def('toyknight', {
  label: 'Toy Knight', col: { t: 'box', w: 0.6, h: 0.9, d: 0.42 }, fit: 0.73, value: 1, mass: 0.15,
  tints: [0xff5c6a, 0x4f9dff, 0x5fd16a, 0xa070ff, 0xffb83a],
  build: () => [
    lathe([[0, 0], [0.17, 0], [0.18, 0.04], [0.15, 0.4], [0.1, 0.44], [0, 0.44]], TINT, 0, 0, 0, 14),
    tor(0.15, 0.025, 0xffc94a, 0, 0.25, 0, PI / 2, 0, 0, 3, 14),
    egg(0.15, 0.15, 0.15, SILVER, 0, 0.58, 0, 0, 0, 0, 12, 8),
    egg(0.1, 0.07, 0.03, SKIN, 0, 0.56, 0.125, 0, 0, 0, 10, 5),
    egg(0.016, 0.02, 0.01, INK, -0.04, 0.565, 0.152, 0, 0, 0, 6, 4), egg(0.016, 0.02, 0.01, INK, 0.04, 0.565, 0.152, 0, 0, 0, 6, 4),
    pale(egg(0.06, 0.12, 0.05, TINT, 0, 0.77, -0.04, -0.4, 0, 0, 8, 5), 0.3),
    vprism(shieldPts(0.22, 0.26), 0.04, TINT, -0.2, 0.08, 0.08, -0.6),
    vprism(heartPts(0.05), 0.012, 0xffc94a, -0.205, 0.2, 0.105, -0.6),
    tcyl(0.018, 0.018, 0.34, SILVER, 0.2, 0.32, 0.08, 0, 0, 0, 5), tbox(0.12, 0.025, 0.03, 0xffc94a, 0.2, 0.2, 0.08),
  ],
});

def('towerblock', {
  label: 'Toy Tower', col: { t: 'cyl', r: 0.42, h: 1.3 }, fit: 0.84, value: 1, mass: 0.15,
  tints: PASTELS,
  build: () => {
    const p = [lathe([[0, 0], [0.34, 0], [0.36, 0.03], [0.32, 0.7], [0.4, 0.74], [0.42, 0.8], [0, 0.8]], CASTLE_W, 0, 0, 0, 14)];
    p.push(custom(new THREE.ConeGeometry(0.4, 0.46, 14).translate(0, 1.03, 0), TINT));
    p.push(vprism(archPts(0.13, 0.08), 0.03, 0x6a5a8a, 0, 0.36, 0.33), vprism(archPts(0.16, 0.05), 0.03, TINT, 0, 0.02, 0.35));
    p.push(tcyl(0.012, 0.012, 0.1, WOOD_D, 0, 1.27, 0, 0, 0, 0, 4), vprism([[0, 0], [0.12, 0.025], [0, 0.05]], 0.01, TINT, 0.01, 1.25, 0));
    return p;
  },
});

def('chest', {
  label: 'Treasure Chest', col: { t: 'box', w: 0.9, h: 0.7, d: 0.6 }, fit: 1.08, value: 2, mass: 0.2,
  tints: [0xff7a8a, 0x5cc8ff, 0x7be07a, 0xb48cff, 0xffb83a],
  build: () => {
    const p = [
      rb(0.86, 0.4, 0.56, TINT, 0, 0, 0, 0.04),
      custom(new THREE.CylinderGeometry(0.28, 0.28, 0.86, 14, 1, false, 0, PI).rotateZ(PI / 2).translate(0, 0.4, 0), TINT),
      ...[-0.3, 0.3].flatMap((x) => [tbox(0.08, 0.41, 0.58, 0xffc94a, x, 0.205, 0), tor(0.285, 0.035, 0xffc94a, x, 0.4, 0, 0, PI / 2, 0, 3, 14, PI)]),
      rb(0.14, 0.16, 0.05, 0xffc94a, 0, 0.3, 0.28, 0.02), egg(0.025, 0.035, 0.01, INK, 0, 0.36, 0.31, 0, 0, 0, 6, 4),
      egg(0.07, 0.05, 0.02, 0xff3d6e, -0.15, 0.52, 0.26, -0.5, 0, 0, 6, 4), egg(0.06, 0.05, 0.02, 0x3f7dff, 0.16, 0.54, 0.25, -0.5, 0, 0, 6, 4),
    ];
    return p;
  },
});

def('throne', {
  label: 'Little Throne', col: { t: 'box', w: 1.1, h: 1.6, d: 1.0 }, fit: 1.49, value: 4, mass: 0.4,
  tints: [0xff7ac0, 0x5c9dff, 0x7bd99a, 0xb48cff, 0xff8a5a],
  build: () => C([
    rb(1.0, 0.45, 0.9, 0xffc94a, 0, 0, 0, 0.06),
    rb(0.84, 0.16, 0.8, TINT, 0, 0.45, 0.04, 0.07),
    rb(0.9, 1.0, 0.18, 0xffc94a, 0, 0.45, -0.38, 0.06),
    rb(0.7, 0.75, 0.08, TINT, 0, 0.58, -0.28, 0.05),
    vprism(heartPts(0.17), 0.05, 0xff3d6e, 0, 1.6 - 0.2 - 0.18, -0.38),
    ...[-1, 1].flatMap((s) => [rb(0.12, 0.3, 0.8, 0xffc94a, s * 0.48, 0.45, 0.04, 0.05), egg(0.08, 0.08, 0.08, 0xffe680, s * 0.42, 1.45, -0.38, 0, 0, 0, 8, 6)]),
  ]),
});

def('dragonplush', {
  label: 'Dragon Plush', col: { t: 'box', w: 1.8, h: 1.2, d: 0.9 }, fit: 2.01, value: 6, mass: 0.4,
  tints: [0x7bd99a, 0xb48cff, 0xff8fb8, 0x6fb7ff, 0xffb35a],
  build: () => {
    const p = [
      egg(0.5, 0.45, 0.42, TINT, -0.1, 0.45, 0, 0, 0, 0, 14, 10),
      pale(egg(0.36, 0.34, 0.2, TINT, -0.05, 0.42, 0.25, 0, 0, 0, 12, 6), 0.65),
      egg(0.32, 0.28, 0.3, TINT, 0.38, 0.85, 0.05, 0, 0, 0, 14, 8),
      pale(egg(0.17, 0.12, 0.17, TINT, 0.6, 0.78, 0.12, 0, 0, 0, 10, 6), 0.5),
      ...[-1, 1].map((s) => pale(cone(0.06, 0.18, TINT, 0.32 + s * 0.0, 1.07, s * 0.16, 6), 0.6)),
      ...face(0.45, 0.9, 0.33, 0.1, 0.035, true),
      rod([-0.55, 0.4, 0], [-0.88, 0.2, 0.25], 0.16, 0.05, TINT, 8),
      pale(cone(0.08, 0.14, TINT, -0.86, 0.18, 0.28, 4), 0.5),
      ...[[-0.3, 0.3], [0.15, 0.3], [-0.3, -0.3], [0.15, -0.3]].map(([x, z]) => egg(0.13, 0.1, 0.13, TINT, x, 0.1, z, 0, 0, 0, 8, 5)),
    ];
    for (const s of [-1, 1]) p.push(pale(vprism([[0, 0], [0.4, 0.35], [0.28, 0.12], [0.3, -0.05]], 0.04, TINT, -0.15, 0.6, s * 0.4, s * 0.4), 0.6));
    for (let i = 0; i < 4; i++) p.push(pale(cone(0.07, 0.13, TINT, -0.35 + i * 0.18, 0.86 - Math.abs(i - 1.5) * 0.04, 0, 5), 0.6));
    return C(p);
  },
});

def('carriage', {
  label: 'Fairy Carriage', col: { t: 'box', w: 2.4, h: 1.9, d: 1.7 }, fit: 2.94, value: 14, mass: 0.8,
  tints: PASTELS,
  build: () => {
    const p = [
      ...ribbedAt(0.82, 0.78, 8, 0.07, TINT, 0, 0.25, 0),
      rb(0.5, 0.65, 0.06, CASTLE_W, 0, 0.5, 0.74, 0.08),
      egg(0.18, 0.2, 0.03, 0xbfe3ff, 0, 0.88, 0.78, 0, 0, 0, 10, 6),
      tcyl(0.08, 0.04, 0.2, 0xffc94a, 0, 1.6, 0, 0, 0, 0, 8), egg(0.08, 0.08, 0.08, 0xffc94a, 0, 1.75, 0, 0, 0, 0, 8, 6),
    ];
    for (const [x, z] of [[-0.75, -0.55], [0.75, -0.55], [-0.75, 0.55], [0.75, 0.55]]) {
      p.push(tor(0.28, 0.04, 0xffc94a, x, 0.3, z, 0, 0, 0, 3, 16), tcyl(0.06, 0.06, 0.1, 0xffc94a, x, 0.3, z, PI / 2, 0, 0, 8));
      for (let i = 0; i < 3; i++) p.push(tbox(0.02, 0.5, 0.02, 0xffc94a, x, 0.3, z, 0, 0, (i * PI) / 3));
    }
    p.push(rod([-0.75, 0.3, -0.55], [-0.75, 0.3, 0.55], 0.03, 0.03, 0xffc94a, 5), rod([0.75, 0.3, -0.55], [0.75, 0.3, 0.55], 0.03, 0.03, 0xffc94a, 5));
    p.push(rod([0.75, 0.42, 0], [1.18, 0.45, 0], 0.03, 0.03, 0xffc94a, 5));
    return C(p);
  },
});
// Ribbed squash (pumpkin coach) centered on (x, y + r*sy, z).
function ribbedAt(r, sy, ribs, depth, col, x, y, z) { return [ribbed(r, sy, ribs, depth, col, x, y, z, 22, 12)]; }

function coneRoof(r, h, y, col, x = 0, z = 0, seg = 14) { return custom(new THREE.ConeGeometry(r, h, seg).translate(x, y + h / 2, z), col); }
function battlements(r, y, n, col, x = 0, z = 0) {
  const p = [];
  for (let i = 0; i < n; i++) { const a = (i * TAU) / n; p.push(tbox(0.16, 0.16, 0.12, col, x + r * Math.sin(a), y + 0.08, z + r * Math.cos(a), 0, a, 0)); }
  return p;
}
def('fairytower', {
  label: 'Fairy Tower', col: { t: 'cyl', r: 1.4, h: 4.0 }, fit: 2.8, value: 13, mass: 1.6,
  tints: PASTELS,
  build: () => {
    const p = [
      lathe([[0, 0], [1.32, 0], [1.4, 0.06], [1.32, 0.16], [0, 0.16]], 0x9fe08a, 0, 0, 0, 22),
      lathe([[0, 0], [0.72, 0], [0.74, 0.04], [0.66, 2.4], [0.8, 2.5], [0.82, 2.66], [0, 2.66]], CASTLE_W, 0, 0.16, 0, 18),
      ...battlements(0.8, 2.82, 10, CASTLE_W),
      coneRoof(0.95, 1.05, 2.82, TINT, 0, 0, 18),
      tcyl(0.015, 0.015, 0.2, WOOD_D, 0, 3.95, 0, 0, 0, 0, 4), vprism([[0, 0], [0.22, 0.04], [0, 0.09]], 0.01, 0xffd23f, 0.01, 3.86, 0),
      vprism(archPts(0.42, 0.3), 0.06, TINT, 0, 0.16, 0.72), egg(0.02, 0.02, 0.02, 0xffc94a, 0.12, 0.38, 0.76, 0, 0, 0, 5, 3),
      vprism(archPts(0.24, 0.16), 0.05, 0xffe9a8, 0, 1.6, 0.68), vprism(archPts(0.2, 0.12), 0.05, 0xffe9a8, -0.45, 1.05, 0.52, -0.7),
    ];
    for (let i = 0; i < 8; i++) { const a = i * TAU / 8 + 0.3; p.push(egg(0.2, 0.16, 0.2, i % 2 ? 0x6fcf6a : 0x5fbf5a, 1.08 * Math.sin(a), 0.26, 1.08 * Math.cos(a), 0, 0, 0, 8, 5)); if (i % 2) p.push(egg(0.06, 0.04, 0.06, PASTELS[i % 5], 1.08 * Math.sin(a), 0.42, 1.08 * Math.cos(a), 0, 0, 0, 6, 3)); }
    // ivy hearts climbing the tower
    for (let i = 0; i < 4; i++) { const a = -0.5 + i * 0.35; p.push(vprism(heartPts(0.07), 0.02, 0x5fbf5a, 0.7 * Math.sin(a), 0.6 + i * 0.4, 0.7 * Math.cos(a), a)); }
    return p;
  },
});

def('gatehouse', {
  label: 'Castle Gate', col: { t: 'box', w: 4.5, h: 3.2, d: 1.8 }, fit: 4.85, value: 38, mass: 2.5,
  tints: PASTELS,
  build: () => {
    const p = [rb(2.0, 1.9, 1.1, CASTLE_W, 0, 0, 0, 0.06)];
    for (let i = 0; i < 6; i++) p.push(tbox(0.22, 0.24, 0.24, CASTLE_W, -0.82 + i * 0.33, 2.02, 0.35));
    p.push(vprism(archPts(0.9, 0.6), 0.1, 0x6a5a8a, 0, 0.0, 0.52));
    for (let i = 0; i < 4; i++) p.push(tbox(0.04, 1.0, 0.04, 0xffc94a, -0.3 + i * 0.2, 0.55, 0.6));
    for (let j = 0; j < 3; j++) p.push(tbox(0.8, 0.04, 0.04, 0xffc94a, 0, 0.2 + j * 0.3, 0.6));
    p.push(vprism(archPts(1.12, 0.6), 0.06, TINT, 0, 0.0, 0.49));
    for (const s of [-1, 1]) {
      p.push(lathe([[0, 0], [0.66, 0], [0.67, 0.04], [0.6, 2.0], [0.7, 2.1], [0.72, 2.3], [0, 2.3]], CASTLE_W, s * 1.4, 0, 0.05, 16));
      p.push(...battlements(0.68, 2.3, 9, CASTLE_W, s * 1.4, 0.05), coneRoof(0.84, 0.88, 2.32, TINT, s * 1.4, 0.05, 16));
      p.push(vprism(archPts(0.22, 0.14), 0.05, 0xffe9a8, s * 1.4, 1.25, 0.66));
      p.push(vprism([[-0.18, 0], [0.18, 0], [0.18, -0.6], [0, -0.48], [-0.18, -0.6]], 0.03, TINT, s * 0.6, 1.8, 0.57), vprism(heartPts(0.07), 0.02, CASTLE_W, s * 0.6, 1.48, 0.59));
    }
    return p;
  },
});

def('castle', {
  label: 'Pastel Castle', col: { t: 'box', w: 5.6, h: 6.0, d: 4.4 }, fit: 7.12, value: 81, mass: 12,
  tints: [0xff9cc6, 0xb9a0ff, 0x8fe3c4, 0x9fd2ff],
  build: () => {
    const p = [rb(5.4, 0.2, 4.2, 0x9fe08a, 0, 0, 0, 0.1)];
    // curtain walls with battlements, a big gate with a golden portcullis
    p.push(rb(3.8, 1.8, 2.6, CASTLE_W, 0, 0.2, 0, 0.05));
    for (let i = 0; i < 9; i++) p.push(tbox(0.24, 0.26, 0.24, CASTLE_W, -1.6 + i * 0.4, 2.13, 1.2), tbox(0.24, 0.26, 0.24, CASTLE_W, -1.6 + i * 0.4, 2.13, -1.2));
    p.push(vprism(archPts(1.0, 0.55), 0.08, 0x6a5a8a, 0, 0.2, 1.31));
    for (let i = 0; i < 4; i++) p.push(tbox(0.04, 1.0, 0.04, 0xffc94a, -0.33 + i * 0.22, 0.7, 1.36));
    p.push(vprism(archPts(1.22, 0.55), 0.06, TINT, 0, 0.2, 1.29));
    // the keep: a tall pastel block with a big roof and a heart window
    p.push(rb(2.2, 2.4, 1.6, CASTLE_W, 0, 2.0, -0.35, 0.05));
    for (let i = 0; i < 6; i++) p.push(tbox(0.22, 0.24, 0.22, CASTLE_W, -0.9 + i * 0.36, 4.52, 0.42));
    p.push(custom(new THREE.ConeGeometry(1.25, 1.2, 4).rotateY(PI / 4).scale(1.15, 1, 0.85).translate(0, 4.4 + 0.6, -0.35), TINT));
    p.push(tcyl(0.02, 0.02, 0.4, WOOD_D, 0, 5.75, -0.35, 0, 0, 0, 4), vprism([[0, 0], [0.4, 0.07], [0, 0.15]], 0.01, 0xff7ac0, 0.01, 5.78, -0.35));
    p.push(vprism(heartPts(0.32), 0.06, 0xffe9a8, 0, 3.4, 0.46), vprism(heartPts(0.22), 0.07, 0xff7ac0, 0, 3.4, 0.47));
    p.push(...[-0.6, 0.6].map((x) => vprism(archPts(0.26, 0.18), 0.05, 0xffe9a8, x, 2.45, 0.46)));
    // four corner towers with cone roofs and flags
    for (const [x, z, h] of [[-2.0, 1.4, 2.6], [2.0, 1.4, 2.6], [-2.0, -1.4, 3.2], [2.0, -1.4, 3.2]]) {
      p.push(lathe([[0, 0], [0.6, 0], [0.62, 0.04], [0.55, h - 0.25], [0.68, h - 0.15], [0.7, h], [0, h]], CASTLE_W, x, 0.2, z, 10));
      p.push(...battlements(0.68, h + 0.2, 6, CASTLE_W, x, z), coneRoof(0.8, 1.1, h + 0.2, TINT, x, z, 10));
      p.push(tcyl(0.015, 0.015, 0.4, WOOD_D, x, h + 1.4, z, 0, 0, 0, 4), vprism([[0, 0], [0.32, 0.06], [0, 0.13]], 0.01, 0xffd23f, x + 0.01, h + 1.45, z));
      p.push(vprism(archPts(0.22, 0.14), 0.04, 0xffe9a8, x + 0.08 * Math.sign(x), h * 0.55, z + 0.58));
    }
    // a garden path, flower beds and a few hearts in the grass
    p.push(tbox(0.9, 0.03, 0.9, 0xfff0d4, 0, 0.215, 1.7));
    for (let i = 0; i < 8; i++) { const x = (i < 4 ? -1 : 1) * (0.7 + (i % 4) * 0.3); p.push(egg(0.1, 0.06, 0.1, PASTELS[i % 5], x, 0.28, 1.92, 0, 0, 0, 6, 3)); }
    return p;
  },
});

// World -> its new props (smallest first). Used by the dev galleries and the Gulp Book.
export const WAVE7_WORLDS = {
  pizza: ['olive', 'pepperoni', 'mushslice', 'basil', 'sodacup', 'cheese', 'doughball', 'tomato', 'pizzaslice', 'flour', 'rollingpin', 'cheesewheel', 'wholepizza', 'pizzabox', 'scooter', 'pizzaoven'],
  dino: ['dinoegg', 'ammonite', 'toybone', 'brush', 'sandbucket', 'babydino', 'shovel', 'fossiltile', 'bigegg', 'nest', 'sandpile', 'stego', 'digcart', 'digtent', 'longneck', 'volcano'],
  castle: ['gem', 'tinyshield', 'potion', 'crown', 'toyknight', 'wand', 'towerblock', 'chest', 'throne', 'biggem', 'dragonplush', 'fairytower', 'carriage', 'gatehouse', 'castle'],
};
