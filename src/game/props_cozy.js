// Cozy prop pack: bakery, picnic, playroom, garden, beach and kitchen worlds.
// Glossy toy/food style built from code geometry only (no external art).
// Conventions: base at y=0, centered on the collider, fronts face +z (the camera),
// vehicles point +x. `fit` = smallest hole diameter that swallows it, `value` ~ 1.6*fit^2.
import * as THREE from 'three';
import { def } from './props.js';
import { box, rbox, cyl, cone, ball, roof, custom, capsule, TINT } from './geo.js';

const TAU = Math.PI * 2, PI = Math.PI;

// ------------------------------------------------------------------ palette
const WHITE = 0xfffaf4, ICING = 0xfffcf7, CREAM = 0xfff0d4, INK = 0x3b2d3f, BLUSH = 0xff9eb8;
const DOUGH = 0xe8a95e, DOUGH_D = 0xc8843f, SPONGE = 0xffe2a6, CHOC = 0x6e3f2b, CHERRY = 0xf0263f;
const WAFFLE = 0xe9b06a, WAFFLE_D = 0xc98a45, CRUST = 0xe2a356, GINGER = 0xc47b3f, GINGER_D = 0xa9622f;
const LEAF = 0x5cc46b, LEAF_D = 0x3d9a52, LEAF_L = 0x8fdd72, STEM = 0x7a5a32, STEM_G = 0x6aa43c;
const WOOD = 0xd39a5e, WOOD_D = 0x9e6a3e, WOOD_L = 0xeec58e, WICKER = 0xdca35e, WICKER_D = 0xb87e40, WICKER_L = 0xe9bb78;
const STEEL = 0xaab4c4, SILVER = 0xe1e7ef, GOLD = 0xffc94a, GLASS = 0x9fdcf5, TIRE = 0x3a3646, NAVY = 0x3a3f52;
const SAND = 0xf4d79c, SAND_D = 0xe0b878, WATER = 0x6ccff5, WATER_L = 0xb4ecff, WARM = 0xffe08a;
const SPRINK = [0xff5c8a, 0x5cc8ff, 0xffd23f, 0x7be07a, 0xb48cff, 0xff9a3a, 0xffffff];
const TOY = { red: 0xff5a5f, blue: 0x4fa3ff, yellow: 0xffd23f, green: 0x5fd16a, purple: 0xb07cff, orange: 0xff9a3a, pink: 0xff7ac0 };
const PASTEL = { pink: 0xff9ec8, mint: 0x9fecc9, sky: 0x9fd2ff, lemon: 0xffe27a, lilac: 0xc9b2ff, peach: 0xffbf94, cream: 0xfff3dc };
const RAINBOW = [0xff5a5f, 0xff9a3a, 0xffd23f, 0x5fd16a, 0x4fa3ff];

// ------------------------------------------------------------------ local helpers
// Rotate (X, then Z, then Y) and move. Helpers below that take x,y,z use it as the CENTER.
function xf(g, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  if (rx) g.rotateX(rx); if (rz) g.rotateZ(rz); if (ry) g.rotateY(ry);
  g.translate(x, y, z); return g;
}
// Ellipsoid centered at (x,y,z) with semi-axes a,b,c.
const egg = (a, b, c, col, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, ws = 14, hs = 10) =>
  custom(xf(new THREE.SphereGeometry(1, ws, hs).scale(a, b, c), x, y, z, rx, ry, rz), col);
// Small round detail (eyes, beads) centered at (x,y,z).
const bead = (r, col, x, y, z) => egg(r, r, r, col, x, y, z, 0, 0, 0, 8, 6);
// Tiny faceted speck (sugar, seeds), centered.
const spark = (r, col, x, y, z) => ball(r, col, x, y - r, z, 0);
const tcyl = (rt, rb, h, col, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, seg = 12) =>
  custom(xf(new THREE.CylinderGeometry(rt, rb, h, seg), x, y, z, rx, ry, rz), col);
const tbox = (w, h, d, col, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) =>
  custom(xf(new THREE.BoxGeometry(w, h, d), x, y, z, rx, ry, rz), col);
// Torus centered at (x,y,z); lies flat by default (rx = PI/2). arc < TAU gives a partial ring.
const tor = (R, t, col, x = 0, y = 0, z = 0, rx = PI / 2, ry = 0, rz = 0, rs = 6, ts = 16, arc = TAU) =>
  custom(xf(new THREE.TorusGeometry(R, t, rs, ts, arc), x, y, z, rx, ry, rz), col);
// Lathe from [radius, height] pairs listed bottom to top (outward-facing). Base at y.
const lathe = (pts, col, x = 0, y = 0, z = 0, seg = 16, phi0 = 0, phiLen = TAU) =>
  custom(new THREE.LatheGeometry(pts.map(([r, h]) => new THREE.Vector2(r, h)), seg, phi0, phiLen).translate(x, y, z), col);
// Re-tone a TINT part: vertex color = gray (darkens the tint), tmask = how much tint shows
// (1 = full tint, 0.5 = half way to the gray). The shader multiplies by the instance color.
function tone(g, gray = 0xffffff, mask = 1) {
  const c = new THREE.Color(gray), col = g.attributes.color, m = g.attributes.tmask;
  for (let i = 0; i < col.count; i++) { col.setXYZ(i, c.r, c.g, c.b); m.setX(i, mask); }
  return g;
}
// Radius of a lathe profile at height y (for seating details on a surface).
function lr(pts, y) {
  for (let i = 1; i < pts.length; i++) {
    const [r0, y0] = pts[i - 1], [r1, y1] = pts[i];
    if ((y >= y0 && y <= y1) || (y <= y0 && y >= y1)) return y1 === y0 ? r1 : r0 + (r1 - r0) * (y - y0) / (y1 - y0);
  }
  return 0;
}
// Flat extruded footprint. pts = [[x,z],...] or a THREE.Shape (whose y maps to -z). Base at y, height h.
function prism(pts, h, col, x = 0, y = 0, z = 0, bevel = 0, ry = 0) {
  const s = pts instanceof THREE.Shape ? pts : new THREE.Shape(pts.map(([px, pz]) => new THREE.Vector2(px, -pz)));
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
// Star outline; first arm points to -z (away from the camera).
const starPts = (n, R, r, a0 = 0) => Array.from({ length: n * 2 }, (_, i) => {
  const a = a0 + (i * PI) / n, q = i % 2 ? r : R;
  return [q * Math.sin(a), -q * Math.cos(a)];
});
// Heart outline about `s` wide, lobes toward +v (use [u,-v] to lay it lobes-away).
const heartPts = (s, n = 30) => Array.from({ length: n }, (_, i) => {
  const t = (i / n) * TAU;
  const x = 16 * Math.sin(t) ** 3, y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
  return [(x * s) / 34, ((y + 2.5) * s) / 34];
});
// Flower outline: n rounded petals, radius R.
const petalPts = (n, R, depth = 0.45, m = 48) => Array.from({ length: m }, (_, i) => {
  const a = (i / m) * TAU, r = R * (1 - depth + depth * Math.abs(Math.cos((n * a) / 2)) ** 0.7);
  return [r * Math.sin(a), r * Math.cos(a)];
});
// Re-center a part list on x/z so the collider sits in the middle of the shape.
function C(parts) {
  parts = parts.flat();
  const bb = new THREE.Box3();
  for (const g of parts) { g.computeBoundingBox(); bb.union(g.boundingBox); }
  const cx = (bb.min.x + bb.max.x) / 2, cz = (bb.min.z + bb.max.z) / 2;
  for (const g of parts) g.translate(-cx, 0, -cz);
  return parts;
}
// Faceted pleated cylinder (cupcake cases, waffle cones). Base at y.
function pleat(rt, rb, h, col, x = 0, y = 0, z = 0, n = 12, amp = 0.06) {
  let g = new THREE.CylinderGeometry(rt, rb, h, n * 2, 1, false);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const px = p.getX(i), pz = p.getZ(i);
    if (Math.hypot(px, pz) < 1e-5) continue;
    const k = 1 + amp * Math.cos(n * Math.atan2(px, pz));
    p.setX(i, px * k); p.setZ(i, pz * k);
  }
  g = g.toNonIndexed(); g.computeVertexNormals();
  return custom(g.translate(x, y + h / 2, z), col);
}
// Torus (in its XY plane) whose tube is scaled along the arc by fn(t), t in 0..1. Returns raw geometry.
function shapedTorus(R, tube, arc, fn, rs = 6, ts = 16) {
  const g = new THREE.TorusGeometry(R, tube, rs, ts, arc);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    let a = Math.atan2(y, x); if (a < -1e-4) a += TAU;
    const t = arc >= TAU - 1e-4 ? a / TAU : Math.min(1, Math.max(0, a / arc));
    const cx = R * Math.cos(a), cy = R * Math.sin(a), k = fn(t, a);
    p.setXYZ(i, cx + (x - cx) * k, cy + (y - cy) * k, z * k);
  }
  g.computeVertexNormals();
  return g;
}
// Flat spiral tube in the XZ plane at y=0 (lollipop swirl, rolled blanket ends).
function spiralGeo(r0, r1, turns, tube, segs = 48) {
  const pts = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, a = t * turns * TAU, r = r0 + (r1 - r0) * t;
    pts.push(new THREE.Vector3(r * Math.sin(a), 0, r * Math.cos(a)));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), segs, tube, 5, false);
}
// Ribbed squashed sphere (pumpkins). Base at y.
function ribbed(r, sy, ribs, depth, col, x = 0, y = 0, z = 0, ws = 24, hs = 12) {
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
// Partial disc/cylinder sector (melon slices, arches). Base at y. theta measured from +z toward +x.
const sector = (r, h, col, th0, thLen, x = 0, y = 0, z = 0, seg = 16) =>
  custom(new THREE.CylinderGeometry(r, r, h, seg, 1, false, th0, thLen).translate(x, y + h / 2, z), col);

// ======================================================================== BAKERY
def('sprinkle', {
  label: 'Sprinkle', col: { t: 'box', w: 0.42, h: 0.16, d: 0.16 }, fit: 0.45, value: 1, mass: 0.15,
  tints: [0xff5c8a, 0x5cc8ff, 0xffd23f, 0x7be07a, 0xb48cff, 0xff9a3a],
  build: () => [capsule(0.08, 0.26, TINT, 0, 0.08, 0, PI / 2)],
});

def('candy', {
  label: 'Candy', col: { t: 'box', w: 0.54, h: 0.24, d: 0.26 }, fit: 0.6, value: 1, mass: 0.15,
  tints: [0xff3f6c, 0x7ddc5a, 0xa070ff, 0xffa23a, 0x4fb8ff, 0xffd84a],
  build: () => [
    egg(0.16, 0.12, 0.13, TINT, 0, 0.12, 0, 0, 0, 0, 14, 9),
    tcyl(0.03, 0.12, 0.12, TINT, 0.21, 0.12, 0, 0, 0, PI / 2, 10),
    tcyl(0.12, 0.03, 0.12, TINT, -0.21, 0.12, 0, 0, 0, PI / 2, 10),
    tor(0.112, 0.026, WHITE, 0.07, 0.12, 0, 0, PI / 2, 0, 5, 14),
    tor(0.112, 0.026, WHITE, -0.07, 0.12, 0, 0, PI / 2, 0, 5, 14),
  ],
});

const GUMDROP = [[0, 0], [0.205, 0], [0.22, 0.04], [0.21, 0.13], [0.175, 0.23], [0.115, 0.31], [0.05, 0.35], [0, 0.36]];
def('gumdrop', {
  label: 'Gumdrop', col: { t: 'cyl', r: 0.22, h: 0.36 }, fit: 0.44, value: 1, mass: 0.15,
  tints: [0xff4f6d, 0x6fd65a, 0xff9f3a, 0x9b6bff, 0xffd84a, 0xff8fc8],
  build: () => {
    const p = [lathe(GUMDROP, TINT, 0, 0, 0, 16)];
    [[0.6, 0.08], [2.3, 0.12], [4.1, 0.07], [1.4, 0.2], [3.3, 0.22], [5.2, 0.19], [0.2, 0.29], [2.8, 0.3]].forEach(([a, y]) => {
      const r = lr(GUMDROP, y) - 0.008;
      p.push(spark(0.024, 0xffffff, r * Math.sin(a), y, r * Math.cos(a)));
    });
    return p;
  },
});

def('macaron', {
  label: 'Macaron', col: { t: 'cyl', r: 0.25, h: 0.34 }, fit: 0.5, value: 1, mass: 0.15,
  tints: [0xffa6c9, 0xb5e38a, 0xc9b3ff, 0xffe680, 0x9ff0d8, 0xffc49b],
  build: () => [
    egg(0.24, 0.075, 0.24, TINT, 0, 0.075, 0, 0, 0, 0, 16, 8),
    tor(0.214, 0.03, TINT, 0, 0.13, 0, PI / 2, 0, 0, 4, 18),
    cyl(0.212, 0.212, 0.075, CREAM, 0, 0.125, 0, 18),
    tor(0.214, 0.03, TINT, 0, 0.205, 0, PI / 2, 0, 0, 4, 18),
    egg(0.25, 0.09, 0.25, TINT, 0, 0.25, 0, 0, 0, 0, 16, 8),
  ],
});

def('cookie', {
  label: 'Cookie', col: { t: 'cyl', r: 0.32, h: 0.14 }, fit: 0.64, value: 1, mass: 0.15,
  tints: [0xff9ec8, 0x9fd2ff, 0x9fecc9, 0xffe27a, 0xfffaf4, 0xc9b2ff],
  build: () => {
    const p = [
      cyl(0.31, 0.32, 0.08, DOUGH, 0, 0, 0, 18),
      cyl(0.255, 0.265, 0.035, TINT, 0, 0.08, 0, 18),
      tor(0.255, 0.02, TINT, 0, 0.1, 0, PI / 2, 0, 0, 4, 18),
    ];
    for (let i = 0; i < 7; i++) {
      const a = i * 2.4 + 0.3, r = 0.05 + (i % 3) * 0.065;
      p.push(box(0.07, 0.022, 0.022, SPRINK[i % 6], r * Math.sin(a), 0.112, r * Math.cos(a), a * 1.7));
    }
    return p;
  },
});

def('donut', {
  label: 'Donut', col: { t: 'cyl', r: 0.37, h: 0.28 }, fit: 0.74, value: 1, mass: 0.15,
  tints: [0xff8fbf, 0x7a4632, 0xfff1d6, 0x9ef0cf, 0x8fd3ff, 0xffe27a],
  build: () => {
    const icing = new THREE.TorusGeometry(0.235, 0.125, 8, 20).rotateX(PI / 2).scale(1, 0.62, 1).translate(0, 0.19, 0);
    const p = [tor(0.235, 0.13, DOUGH, 0, 0.13, 0, PI / 2, 0, 0, 8, 20), custom(icing, TINT)];
    for (let i = 0; i < 11; i++) {
      const a = (i * TAU) / 11 + (i % 2) * 0.2, r = 0.235 + (((i * 37) % 5) - 2) * 0.028;
      p.push(box(0.085, 0.024, 0.024, SPRINK[i % 7], r * Math.sin(a), 0.252, r * Math.cos(a), a * 2.3 + i));
    }
    return p;
  },
});

def('cupcake', {
  label: 'Cupcake', col: { t: 'cyl', r: 0.32, h: 0.9 }, fit: 0.64, value: 1, mass: 0.15,
  tints: [0xff9ec4, 0x9fc8ff, 0xa6f0d2, 0xffe680, 0xd2b8ff, 0x8a5a44],
  build: () => {
    const p = [
      pleat(0.3, 0.23, 0.3, 0xfdf0e6, 0, 0, 0, 14, 0.05),
      cyl(0.3, 0.3, 0.05, DOUGH, 0, 0.28, 0, 16),
      egg(0.31, 0.12, 0.31, TINT, 0, 0.42, 0, 0, 0, 0, 16, 8),
      egg(0.23, 0.1, 0.23, TINT, 0, 0.56, 0, 0, 0.5, 0, 14, 7),
      egg(0.13, 0.09, 0.13, TINT, 0, 0.68, 0, 0, 0, 0, 12, 6),
      ball(0.07, CHERRY, 0, 0.73, 0, 1),
      tcyl(0.012, 0.012, 0.1, STEM, 0.02, 0.85, 0, 0, 0, -0.4, 5),
    ];
    for (let i = 0; i < 6; i++) {
      const a = i * 1.05 + 0.4;
      p.push(box(0.07, 0.022, 0.022, SPRINK[i], 0.24 * Math.sin(a), 0.47, 0.24 * Math.cos(a), a * 2));
    }
    return p;
  },
});

def('croissant', {
  label: 'Croissant', col: { t: 'box', w: 0.86, h: 0.3, d: 0.6 }, fit: 1.05, value: 2, mass: 0.15,
  tints: [0xeaa54e, 0xd98c3a, 0xf2bd6b],
  build: () => {
    // [angle, tangential half-size, height, radial half-size]: overlapping rolls around an arc
    const segs = [[0, 0.17, 0.15, 0.22], [0.42, 0.15, 0.135, 0.19], [-0.42, 0.15, 0.135, 0.19],
      [0.84, 0.12, 0.11, 0.15], [-0.84, 0.12, 0.11, 0.15], [1.22, 0.09, 0.08, 0.1], [-1.22, 0.09, 0.08, 0.1],
      [1.52, 0.06, 0.055, 0.065], [-1.52, 0.06, 0.055, 0.065]];
    const Rc = 0.34;
    return C(segs.map(([a, t, h, r], i) => egg(t, h, r, i % 2 ? TINT : TINT, Rc * Math.sin(a), h, -Rc * Math.cos(a), 0, -a, 0, 11, 7)));
  },
});

def('cakeslice', {
  label: 'Cake Slice', col: { t: 'box', w: 0.64, h: 0.53, d: 0.74 }, fit: 0.98, value: 2, mass: 0.15,
  tints: [0xff9ec4, 0x8a5a44, 0xa6f0d2, 0xffe680, 0xfffaf4],
  build: () => {
    const tri = [[0, 0.36], [-0.3, -0.33], [0.3, -0.33]];
    return C([
      prism(tri, 0.13, SPONGE),
      prism(tri, 0.045, CREAM, 0, 0.13),
      prism(tri, 0.12, SPONGE, 0, 0.175),
      prism(tri, 0.06, TINT, 0, 0.295, 0, 0.015),
      box(0.62, 0.31, 0.05, TINT, 0, 0, -0.345),
      egg(0.075, 0.055, 0.075, ICING, 0, 0.39, -0.2, 0, 0, 0, 10, 6),
      egg(0.065, 0.075, 0.065, 0xff3b55, 0, 0.44, -0.2, 0, 0, 0, 10, 7),
      prism(starPts(5, 0.06, 0.025), 0.02, LEAF, 0, 0.505, -0.2),
    ]);
  },
});

def('lollipop', {
  label: 'Lollipop', col: { t: 'box', w: 0.62, h: 0.13, d: 1.03 }, fit: 1.2, value: 2, mass: 0.15,
  tints: [0xff4f6d, 0xb06bff, 0x4fb8ff, 0x7ddc5a, 0xffa23a, 0xff8fd0],
  build: () => C([
    cyl(0.3, 0.3, 0.1, TINT, 0, 0, -0.2, 22),
    custom(spiralGeo(0.03, 0.265, 2.6, 0.026, 56).translate(0, 0.1, -0.2), WHITE),
    tcyl(0.032, 0.032, 0.42, WHITE, 0, 0.034, 0.32, PI / 2, 0, 0, 8),
  ]),
});

def('icecream', {
  label: 'Ice Cream', col: { t: 'cyl', r: 0.29, h: 1.06 }, fit: 0.58, value: 1, mass: 0.15,
  tints: [0xffa6c9, 0xa6f0d2, 0xfff1d0, 0x8a5a44, 0xa9c4ff, 0xffc861],
  build: () => [
    pleat(0.24, 0.035, 0.52, WAFFLE, 0, 0, 0, 9, 0.06),
    tor(0.235, 0.035, WAFFLE_D, 0, 0.52, 0, PI / 2, 0, 0, 5, 18),
    egg(0.27, 0.24, 0.27, TINT, 0, 0.72, 0, 0, 0, 0, 16, 10),
    tor(0.215, 0.06, TINT, 0, 0.56, 0, PI / 2, 0, 0, 6, 18),
    egg(0.05, 0.085, 0.05, TINT, 0.17, 0.5, 0.13, 0, 0, 0, 8, 6),
    egg(0.045, 0.07, 0.045, TINT, -0.2, 0.51, 0.06, 0, 0, 0, 8, 6),
    egg(0.04, 0.06, 0.04, TINT, 0.0, 0.5, -0.21, 0, 0, 0, 8, 6),
    ball(0.07, CHERRY, 0, 0.92, 0, 1),
    tcyl(0.012, 0.012, 0.09, STEM, 0.02, 1.05, 0, 0, 0, -0.4, 5),
  ],
});

const crimp = (R, t, col, y, bumps = 13) =>
  custom(xf(shapedTorus(R, t, TAU, (_, a) => 1 + 0.28 * Math.cos(bumps * a), 6, bumps * 2), 0, y, 0, PI / 2), col);

def('pie', {
  label: 'Pie', col: { t: 'cyl', r: 0.6, h: 0.28 }, fit: 1.2, value: 2, mass: 0.2,
  tints: [0xd8233f, 0x5a4fc0, 0xf0a830, 0x8fcf4a],
  build: () => {
    const p = [
      lathe([[0, 0], [0.45, 0], [0.56, 0.15], [0.6, 0.16], [0.6, 0.18], [0.55, 0.18], [0.5, 0.16]], 0xbfe3ff, 0, 0, 0, 22),
      cyl(0.52, 0.52, 0.06, TINT, 0, 0.13, 0, 22),
      crimp(0.51, 0.065, CRUST, 0.2),
    ];
    for (const o of [-0.25, 0, 0.25]) {
      const L = 2 * Math.sqrt(0.48 * 0.48 - o * o);
      p.push(box(L, 0.035, 0.09, CRUST, 0, 0.19, o), box(0.09, 0.035, L, CRUST, o, 0.205, 0));
    }
    return p;
  },
});

def('cake', {
  label: 'Cake', col: { t: 'cyl', r: 0.82, h: 1.0 }, fit: 1.64, value: 4, mass: 0.6,
  tints: [0xffa6c9, 0xa6edd2, 0xd2bcff, 0xffe58a, 0x8a5a44, 0xa6d8ff],
  build: () => {
    const p = [
      lathe([[0, 0], [0.78, 0], [0.82, 0.04], [0.8, 0.06], [0, 0.06]], WHITE, 0, 0, 0, 22),
      cyl(0.62, 0.62, 0.5, TINT, 0, 0.06, 0, 22),
      cyl(0.635, 0.635, 0.06, ICING, 0, 0.53, 0, 22),
    ];
    for (let i = 0; i < 7; i++) {
      const a = (i * TAU) / 7 + 0.2, L = 0.07 + (i % 3) * 0.035;
      p.push(egg(0.055, L, 0.04, ICING, 0.625 * Math.sin(a), 0.53 - L * 0.5, 0.625 * Math.cos(a), 0, a, 0, 6, 4));
    }
    for (let i = 0; i < 9; i++) {
      const a = (i * TAU) / 9;
      p.push(egg(0.07, 0.055, 0.07, ICING, 0.53 * Math.sin(a), 0.61, 0.53 * Math.cos(a), 0, 0, 0, 7, 4));
    }
    const CAND = [0xff7ac0, 0x6cc8ff, 0xffd23f];
    for (let i = 0; i < 3; i++) {
      const a = (i * TAU) / 3 + 0.5, x = 0.22 * Math.sin(a), z = 0.22 * Math.cos(a);
      p.push(cyl(0.035, 0.035, 0.26, CAND[i], x, 0.59, z, 8), egg(0.035, 0.06, 0.035, 0xffb43a, x, 0.92, z, 0, 0, 0, 6, 5));
    }
    return p;
  },
});

def('layercake', {
  label: 'Layer Cake', col: { t: 'cyl', r: 1.45, h: 2.62 }, fit: 2.9, value: 13, mass: 2.0,
  tints: [0xffa6c9, 0xa6edd2, 0xd2bcff, 0xffe58a, 0xffc4a0],
  build: () => {
    const p = [lathe([[0, 0], [0.7, 0], [0.7, 0.07], [0.28, 0.13], [0.2, 0.34], [1.45, 0.4], [1.45, 0.46], [0, 0.46]], 0xf4f6ff, 0, 0, 0, 22)];
    for (const [r, y, h] of [[1.25, 0.46, 0.6], [0.92, 1.06, 0.55], [0.6, 1.61, 0.5]]) {
      p.push(cyl(r, r, h, TINT, 0, y, 0, 22));
      p.push(cyl(r + 0.015, r + 0.015, 0.06, ICING, 0, y + h - 0.04, 0, 22));
      p.push(tor(r, 0.05, ICING, 0, y + 0.04, 0, PI / 2, 0, 0, 4, 22));
    }
    for (let i = 0; i < 8; i++) { const a = (i * TAU) / 8; p.push(ball(0.1, CHERRY, 1.08 * Math.sin(a), 1.04, 1.08 * Math.cos(a), 1)); }
    for (let i = 0; i < 7; i++) { const a = (i * TAU) / 7 + 0.3; p.push(egg(0.09, 0.07, 0.09, ICING, 0.76 * Math.sin(a), 1.65, 0.76 * Math.cos(a), 0, 0, 0, 7, 4)); }
    p.push(egg(0.2, 0.2, 0.2, CHERRY, 0, 2.28, 0, 0, 0, 0, 12, 8), tcyl(0.02, 0.025, 0.18, STEM, 0.04, 2.5, 0, 0, 0, -0.35, 5));
    return p;
  },
});

def('gingerhouse', {
  label: 'Gingerbread House', col: { t: 'box', w: 4.0, h: 3.98, d: 3.5 }, fit: 5.31, value: 45, mass: 8,
  tints: [0xff9ec8, 0x9fecc9, 0xfff6f0, 0xc9b2ff],
  build: () => {
    const p = [
      rbox(4.0, 0.14, 3.5, ICING, 0, 0, 0, 0.06),
      rbox(3.2, 2.0, 2.6, GINGER, 0, 0.14, 0, 0.08),
      roof(3.7, 1.55, 3.0, TINT, 0, 2.14, 0),
      tcyl(0.1, 0.1, 3.05, ICING, 0, 3.69, 0, PI / 2, 0, 0, 8),
      tcyl(0.08, 0.08, 3.05, ICING, 1.82, 2.16, 0, PI / 2, 0, 0, 8),
      tcyl(0.08, 0.08, 3.05, ICING, -1.82, 2.16, 0, PI / 2, 0, 0, 8),
      // door: arched chocolate with icing frame
      box(0.7, 1.15, 0.08, CHOC, 0, 0.14, 1.3),
      tcyl(0.35, 0.35, 0.08, CHOC, 0, 1.29, 1.3, PI / 2, 0, 0, 14),
      tor(0.4, 0.045, ICING, 0, 1.29, 1.33, 0, 0, 0, 4, 12, PI),
      ball(0.06, GOLD, 0.2, 0.66, 1.34, 1),
      // chimney
      box(0.45, 0.9, 0.45, GINGER_D, 0.95, 2.75, -0.6),
      box(0.56, 0.1, 0.56, ICING, 0.95, 3.6, -0.6),
      // stepping cookie
      cyl(0.22, 0.22, 0.04, DOUGH, 0, 0.14, 1.55, 12),
    ];
    // gable trims, front and back
    for (const z of [1.52, -1.52]) for (const s of [-1, 1]) p.push(tcyl(0.08, 0.08, 2.42, ICING, s * 0.925, 2.915, z, 0, 0, s * 0.874, 6));
    // warm windows with icing frames (front + sides)
    for (const s of [-1, 1]) {
      p.push(box(0.74, 0.74, 0.04, ICING, s * 1.0, 0.78, 1.3), box(0.58, 0.58, 0.06, WARM, s * 1.0, 0.86, 1.3),
        box(0.58, 0.05, 0.08, ICING, s * 1.0, 1.125, 1.31), box(0.05, 0.58, 0.08, ICING, s * 1.0, 0.86, 1.31));
      for (const z of [-0.6, 0.6]) p.push(box(0.04, 0.74, 0.74, ICING, s * 1.6, 0.78, z), box(0.06, 0.58, 0.58, WARM, s * 1.6, 0.86, z));
    }
    // gumdrops along the ridge
    const GD = [0xff4f6d, 0x6fd65a, 0xffd84a, 0x9b6bff, 0xff9f3a];
    for (let i = 0; i < 5; i++) p.push(lathe(GUMDROP.map(([r, y]) => [r * 0.7, y * 0.7]), GD[i], 0, 3.74, -1.2 + i * 0.6, 8));
    // candy canes at the front corners
    for (const s of [-1, 1]) {
      for (let k = 0; k < 5; k++) p.push(cyl(0.07, 0.07, 0.336, k % 2 ? WHITE : 0xff3b55, s * 1.78, 0.14 + k * 0.336, 1.55, 7));
      p.push(tor(0.16, 0.07, 0xff3b55, s * 1.62, 1.82, 1.55, 0, 0, 0, 5, 8, PI));
    }
    return p;
  },
});

// ======================================================================== PICNIC
def('grape', {
  label: 'Grape', col: { t: 'ball', r: 0.16 }, fit: 0.32, value: 1, mass: 0.15,
  tints: [0x9b59d0, 0xa6d85a, 0xd2456a],
  build: () => [ball(0.16, TINT, 0, 0, 0, 2), tcyl(0.014, 0.018, 0.04, STEM, 0, 0.33, 0, 0, 0, 0, 5)],
});

def('cherry', {
  label: 'Cherry', col: { t: 'box', w: 0.52, h: 0.54, d: 0.27 }, fit: 0.59, value: 1, mass: 0.15,
  tints: [0xe8193c, 0xffc23a, 0x9e0f3a],
  build: () => C([
    ball(0.13, TINT, -0.125, 0, 0, 2), ball(0.13, TINT, 0.125, 0, 0.005, 2),
    tcyl(0.016, 0.016, 0.29, STEM_G, -0.0625, 0.37, 0, 0, 0, -0.45, 5),
    tcyl(0.016, 0.016, 0.29, STEM_G, 0.0625, 0.37, 0, 0, 0, 0.45, 5),
    egg(0.1, 0.018, 0.05, LEAF, 0.09, 0.5, 0, 0, 0.3, -0.35, 8, 5),
    bead(0.025, STEM_G, 0, 0.5, 0),
  ]),
});

const BERRY = [[0, 0], [0.07, 0.035], [0.16, 0.125], [0.23, 0.25], [0.245, 0.355], [0.21, 0.435], [0.115, 0.49], [0, 0.5]];
def('strawberry', {
  label: 'Strawberry', col: { t: 'cyl', r: 0.25, h: 0.6 }, fit: 0.5, value: 1, mass: 0.15,
  tints: [0xff3355, 0xff6f91, 0xffd1dc],
  build: () => {
    const p = [lathe(BERRY, TINT, 0, 0, 0, 14),
      prism(starPts(6, 0.2, 0.08), 0.035, LEAF, 0, 0.47, 0, 0.008),
      tcyl(0.02, 0.026, 0.1, LEAF_D, 0, 0.54, 0, 0, 0, 0.15, 5)];
    for (let i = 0; i < 12; i++) {
      const a = i * 2.39, y = 0.1 + (i % 4) * 0.08, r = lr(BERRY, y) - 0.006;
      p.push(spark(0.018, 0xfff2a0, r * Math.sin(a), y, r * Math.cos(a)));
    }
    return p;
  },
});

def('lemon', {
  label: 'Lemon', col: { t: 'box', w: 0.65, h: 0.42, d: 0.42 }, fit: 0.77, value: 1, mass: 0.15,
  tints: [0xffe14a, 0x8ad94a, 0xffc93a],
  build: () => [
    egg(0.27, 0.2, 0.205, TINT, 0, 0.2, 0, 0, 0, 0, 16, 10),
    tcyl(0.0, 0.065, 0.07, TINT, 0.29, 0.2, 0, 0, 0, -PI / 2, 8),
    tcyl(0.065, 0.0, 0.07, TINT, -0.29, 0.2, 0, 0, 0, -PI / 2, 8),
    egg(0.09, 0.015, 0.045, LEAF, -0.06, 0.4, 0.04, 0, 0.5, 0, 8, 5),
  ],
});

def('apple', {
  label: 'Apple', col: { t: 'cyl', r: 0.33, h: 0.66 }, fit: 0.66, value: 1, mass: 0.15,
  tints: [0xff4a4a, 0x8fd14f, 0xffd84a],
  build: () => [
    lathe([[0, 0.03], [0.1, 0], [0.24, 0.05], [0.315, 0.18], [0.325, 0.32], [0.29, 0.45], [0.2, 0.53], [0.1, 0.55], [0.04, 0.52], [0, 0.5]], TINT, 0, 0, 0, 18),
    tcyl(0.02, 0.026, 0.14, STEM, 0.015, 0.57, 0, 0, 0, -0.2, 6),
    egg(0.1, 0.018, 0.055, LEAF, 0.1, 0.61, 0.02, 0, -0.3, -0.35, 8, 5),
  ],
});

def('orange', {
  label: 'Orange', col: { t: 'cyl', r: 0.35, h: 0.62 }, fit: 0.7, value: 1, mass: 0.15,
  tints: [0xff9a2e, 0xff7b1c, 0xffb347],
  build: () => [
    lathe([[0, 0], [0.15, 0.01], [0.27, 0.07], [0.34, 0.18], [0.35, 0.3], [0.31, 0.44], [0.2, 0.54], [0.08, 0.58], [0, 0.585]], TINT, 0, 0, 0, 18),
    bead(0.03, 0x8a7a2a, 0, 0.585, 0),
    egg(0.11, 0.02, 0.06, LEAF, 0.08, 0.6, 0, 0, 0.4, -0.25, 8, 5),
  ],
});

def('banana', {
  label: 'Banana', col: { t: 'box', w: 0.8, h: 0.2, d: 0.36 }, fit: 0.88, value: 1, mass: 0.15,
  tints: [0xffe14a, 0xd7e85a, 0xffcf3a],
  build: () => {
    const R = 0.42, arc = 1.75, tube = 0.1, beta = arc / 2 - PI / 2;
    const prof = (t) => 0.42 + 0.58 * Math.pow(Math.sin(PI * t), 0.6);
    const body = custom(xf(shapedTorus(R, tube, arc, prof, 5, 18), 0, tube, 0, PI / 2, beta), TINT);
    const ps0 = -beta, ps1 = arc - beta;        // end angles after the spin, from +x toward +z
    const tip = [R * Math.cos(ps0), R * Math.sin(ps0)], end = [R * Math.cos(ps1), R * Math.sin(ps1)];
    const tg = [-Math.sin(ps1), Math.cos(ps1)];
    return C([
      body,
      bead(0.045, 0x6b4a2a, tip[0] + Math.sin(ps0) * 0.02, tube, tip[1] - Math.cos(ps0) * 0.02),
      tcyl(0.03, 0.042, 0.12, 0x9a7a3a, end[0] + tg[0] * 0.05, tube, end[1] + tg[1] * 0.05, PI / 2, Math.atan2(tg[0], tg[1]), 0, 6),
    ]);
  },
});

def('grapes', {
  label: 'Grapes', col: { t: 'box', w: 0.84, h: 0.36, d: 0.9 }, fit: 1.24, value: 2, mass: 0.15,
  tints: [0x9b59d0, 0xa6d85a, 0xd2456a],
  build: () => {
    const p = [];
    [[-0.3, -0.26], [-0.1, -0.28], [0.1, -0.28], [0.3, -0.26], [-0.2, -0.08], [0, -0.09], [0.2, -0.08], [-0.1, 0.1], [0.1, 0.1], [0, 0.28]]
      .forEach(([x, z]) => p.push(ball(0.12, TINT, x, 0, z, 1)));
    [[-0.1, -0.18], [0.1, -0.18], [0, 0.01]].forEach(([x, z]) => p.push(ball(0.12, TINT, x, 0.11, z, 1)));
    p.push(tcyl(0.025, 0.035, 0.2, STEM, 0, 0.2, -0.44, PI / 2, 0, 0, 6));
    p.push(egg(0.16, 0.018, 0.12, LEAF, 0.15, 0.25, -0.42, 0, 0.5, -0.15, 8, 5));
    return C(p);
  },
});

def('juicebox', {
  label: 'Juice Box', col: { t: 'box', w: 0.42, h: 0.8, d: 0.33 }, fit: 0.53, value: 1, mass: 0.15,
  tints: [0xff9a2e, 0x8fd14f, 0xff5a8a, 0x9b6bff],
  build: () => [
    rbox(0.42, 0.56, 0.3, TINT, 0, 0, 0, 0.05),
    box(0.32, 0.3, 0.02, WHITE, 0, 0.12, 0.15),
    tcyl(0.085, 0.085, 0.02, TINT, 0, 0.27, 0.165, PI / 2, 0, 0, 14),
    egg(0.045, 0.02, 0.012, LEAF, 0.06, 0.37, 0.168, 0, 0, 0.5, 8, 5),
    box(0.07, 0.01, 0.07, 0xd8d8e0, 0.1, 0.56, -0.05),
    tcyl(0.018, 0.018, 0.2, 0xff8fbf, 0.1, 0.655, -0.05, 0, 0, 0, 6),
    tcyl(0.018, 0.018, 0.09, 0xff8fbf, 0.073, 0.77, -0.05, 0, 0, 1.0, 6),
  ],
});

def('sandwich', {
  label: 'Sandwich', col: { t: 'box', w: 0.8, h: 0.69, d: 0.8 }, fit: 1.13, value: 2, mass: 0.15,
  tints: [0xff9fae, 0xffd84a, 0x9be07a, 0xc93a6b],
  build: () => [
    rbox(0.74, 0.12, 0.74, CRUST, 0, 0, 0, 0.05),
    rbox(0.8, 0.035, 0.8, 0x8bd65a, 0, 0.12, 0, 0.015),
    rbox(0.76, 0.08, 0.76, TINT, 0, 0.155, 0, 0.03),
    rbox(0.74, 0.13, 0.74, CRUST, 0, 0.235, 0, 0.05),
    box(0.62, 0.014, 0.62, 0xfbe7bf, 0, 0.358, 0),
    tcyl(0.013, 0.013, 0.36, WOOD_L, 0.1, 0.48, 0.1, 0, 0, 0, 5),
    bead(0.05, 0x6b9e3a, 0.1, 0.56, 0.1),
    egg(0.06, 0.05, 0.06, TINT, 0.1, 0.64, 0.1, 0, 0, 0, 8, 5),
  ],
});

def('melonslice', {
  label: 'Melon Slice', col: { t: 'box', w: 1.0, h: 0.17, d: 0.5 }, fit: 1.12, value: 2, mass: 0.15,
  tints: [0xff4d64, 0xff7d95, 0xffd84a],
  build: () => {
    const p = [sector(0.5, 0.14, 0x3fa34d, -PI / 2, PI, 0, 0, 0, 18), sector(0.465, 0.15, 0xe9f7d4, -PI / 2, PI, 0, 0, 0, 18),
      sector(0.43, 0.165, TINT, -PI / 2, PI, 0, 0, 0, 18), box(1.0, 0.14, 0.01, 0x3fa34d, 0, 0, 0.005), box(0.86, 0.165, 0.012, TINT, 0, 0, 0.007)];
    for (let i = 0; i < 6; i++) {
      const a = -1.1 + i * 0.44, r = 0.24 + (i % 2) * 0.08;
      p.push(egg(0.022, 0.012, 0.038, INK, r * Math.sin(a), 0.165, r * Math.cos(a), 0, a, 0, 6, 4));
    }
    return C(p);
  },
});

def('watermelon', {
  label: 'Watermelon', col: { t: 'box', w: 1.64, h: 1.1, d: 1.1 }, fit: 1.97, value: 6, mass: 0.4,
  tints: [0x8fd86e, 0xb5e37a, 0x6cc65a],
  build: () => {
    const prof = [];
    for (let i = 0; i <= 10; i++) { const t = (i / 10) * PI; prof.push(new THREE.Vector2(0.55 * Math.sin(t), -0.78 * Math.cos(t))); }
    const p = [];
    for (let k = 0; k < 10; k++) {
      const g = new THREE.LatheGeometry(prof, 3, (k * TAU) / 10, TAU / 10);
      g.rotateZ(PI / 2); g.translate(0, 0.55, 0);
      p.push(custom(g, k % 2 ? 0x2f8a3c : TINT));
    }
    p.push(tcyl(0.04, 0.05, 0.08, STEM, -0.8, 0.55, 0, 0, 0, PI / 2, 6));
    return C(p);
  },
});

def('blanketroll', {
  label: 'Blanket Roll', col: { t: 'box', w: 1.36, h: 0.65, d: 0.7 }, fit: 1.53, value: 4, mass: 0.2,
  tints: [0xff6b6b, 0x5aa9ff, 0x6fcf7a, 0xffc94a],
  build: () => {
    const p = [tcyl(0.3, 0.3, 1.3, TINT, 0, 0.3, 0, 0, 0, PI / 2, 18)];
    for (const x of [-0.45, -0.15, 0.15, 0.45]) p.push(tcyl(0.304, 0.304, 0.07, WHITE, x, 0.3, 0, 0, 0, PI / 2, 18));
    for (const x of [-0.3, 0.3]) p.push(tor(0.31, 0.035, 0x8b5a3c, x, 0.3, 0, 0, PI / 2, -0.3, 5, 14, PI + 0.6), box(0.08, 0.03, 0.1, GOLD, x, 0.615, 0));
    for (const s of [-1, 1]) p.push(custom(spiralGeo(0.03, 0.26, 3, 0.016, 32).rotateZ(PI / 2).translate(s * 0.658, 0.3, 0), WHITE));
    return p;
  },
});

def('basket', {
  label: 'Picnic Basket', col: { t: 'box', w: 1.26, h: 1.5, d: 1.12 }, fit: 1.69, value: 5, mass: 0.6,
  tints: [0xff5a5f, 0x5aa9ff, 0x6fcf7a, 0xffb02e],
  build: () => {
    const p = [rbox(1.2, 0.7, 0.8, WICKER, 0, 0, 0, 0.08), box(1.24, 0.06, 0.84, WICKER_D, 0, 0.67, 0)];
    for (const y of [0.13, 0.3, 0.47]) p.push(box(1.22, 0.04, 0.82, WICKER_D, 0, y, 0));
    for (const x of [-0.45, -0.15, 0.15, 0.45]) p.push(box(0.04, 0.6, 0.82, WICKER_L, x, 0.05, 0));
    p.push(
      // closed half lid, open half propped up at the back
      box(0.6, 0.06, 0.84, WICKER_L, -0.3, 0.72, 0), box(0.6, 0.012, 0.03, WICKER_D, -0.3, 0.78, -0.2), box(0.6, 0.012, 0.03, WICKER_D, -0.3, 0.78, 0.2),
      tbox(0.58, 0.05, 0.8, WICKER_L, 0.3, 1.1, -0.54, 1.27),
      // gingham cloth puffing out + a baguette
      egg(0.27, 0.1, 0.3, TINT, 0.3, 0.74, 0.02, 0, 0, 0, 10, 6), egg(0.16, 0.08, 0.14, TINT, 0.38, 0.8, 0.22, 0, 0.5, 0, 8, 5),
      spark(0.035, WHITE, 0.25, 0.83, 0.05), spark(0.035, WHITE, 0.42, 0.82, -0.1), spark(0.035, WHITE, 0.15, 0.81, 0.2), spark(0.03, WHITE, 0.4, 0.87, 0.24),
      capsule(0.075, 0.48, CRUST, 0.22, 1.02, -0.12, -0.55),
      tbox(0.09, 0.015, 0.05, 0xf6d79a, 0.13, 0.95, -0.05, 0, 0, -0.55), tbox(0.09, 0.015, 0.05, 0xf6d79a, 0.28, 1.17, -0.05, 0, 0, -0.55),
      tor(0.38, 0.045, WOOD_D, -0.3, 0.72, 0, 0, PI / 2, 0, 5, 14, PI),
      box(0.42, 0.3, 0.03, TINT, -0.3, 0.38, 0.415), box(0.1, 0.12, 0.04, GOLD, 0.25, 0.52, 0.415),
    );
    for (const [dx, dy] of [[-0.42, 0.55], [-0.24, 0.55], [-0.33, 0.45], [-0.42, 0.4], [-0.24, 0.4]]) p.push(box(0.07, 0.07, 0.035, WHITE, dx, dy, 0.43));
    return C(p);
  },
});

def('fruitcart', {
  label: 'Fruit Cart', col: { t: 'box', w: 4.2, h: 3.58, d: 2.8 }, fit: 5.05, value: 41, mass: 7,
  tints: [0xff6b6b, 0x5aa9ff, 0x6fcf7a, 0xffb02e],
  build: () => {
    const p = [];
    for (const s of [-1, 1]) {
      p.push(tor(0.62, 0.08, WOOD_D, -0.5, 0.7, s * 1.25, 0, 0, 0, 6, 18));
      p.push(tcyl(0.12, 0.12, 0.16, GOLD, -0.5, 0.7, s * 1.25, PI / 2, 0, 0, 10));
      for (let k = 0; k < 4; k++) p.push(tbox(0.06, 1.2, 0.05, WOOD_D, -0.5, 0.7, s * 1.25, 0, 0, (k * PI) / 4));
      p.push(box(0.12, 0.8, 0.12, WOOD_D, 1.35, 0, s * 0.85));
      p.push(tcyl(0.05, 0.05, 0.36, WOOD_D, -1.88, 1.05, s * 0.7, 0, 0, PI / 2, 6));
    }
    p.push(rbox(3.4, 0.75, 2.2, TINT, 0, 0.75, 0, 0.08), box(3.5, 0.08, 2.3, WHITE, 0, 1.44, 0), box(3.42, 0.07, 2.22, WHITE, 0, 0.9, 0));
    p.push(box(1.3, 0.34, 0.05, CREAM, 0, 1.0, 1.11), tcyl(0.1, 0.1, 0.03, 0xff4a4a, -0.35, 1.17, 1.14, PI / 2, 0, 0, 12),
      tcyl(0.1, 0.1, 0.03, 0xffb02e, 0, 1.17, 1.14, PI / 2, 0, 0, 12), tcyl(0.1, 0.1, 0.03, 0xffe14a, 0.35, 1.17, 1.14, PI / 2, 0, 0, 12));
    for (const [x, c] of [[-1.1, 0xff9a2e], [0, 0xff4a4a], [1.1, 0xffe14a]]) {
      p.push(egg(0.5, 0.22, 0.95, c, x, 1.5, 0, 0, 0, 0, 12, 6));
      for (const [dx, dz] of [[-0.18, -0.35], [0.15, 0.3]]) p.push(ball(0.2, c, x + dx, 1.5, dz, 1));
    }
    for (const x of [-0.55, 0.55]) p.push(box(0.06, 0.22, 2.2, WOOD_L, x, 1.45, 0));
    for (const [x, z] of [[-1.6, -1.0], [1.6, -1.0], [-1.6, 1.0], [1.6, 1.0]]) p.push(cyl(0.06, 0.06, 1.55, WHITE, x, 1.5, z, 8));
    for (let k = 0; k < 8; k++) {
      p.push(roof(2.6, 0.55, 0.5, k % 2 ? WHITE : TINT).rotateY(PI / 2).translate(-1.75 + k * 0.5, 3.0, 0));
      p.push(custom(new THREE.CylinderGeometry(0.25, 0.25, 0.04, 8, 1, false, -PI / 2, PI).rotateX(PI / 2).translate(-1.75 + k * 0.5, 3.0, 1.28), k % 2 ? WHITE : TINT));
    }
    return p;
  },
});

// ======================================================================== PLAYROOM
def('block', {
  label: 'Toy Block', col: { t: 'box', w: 0.54, h: 0.54, d: 0.54 }, fit: 0.76, value: 1, mass: 0.15,
  tints: [TOY.red, TOY.blue, TOY.yellow, TOY.green, TOY.purple, TOY.orange],
  build: () => [
    rbox(0.52, 0.52, 0.52, TINT, 0, 0, 0, 0.07),
    box(0.38, 0.38, 0.02, WHITE, 0, 0.07, 0.255), box(0.38, 0.38, 0.02, WHITE, 0, 0.07, -0.255),
    box(0.02, 0.38, 0.38, WHITE, 0.255, 0.07, 0), box(0.02, 0.38, 0.38, WHITE, -0.255, 0.07, 0),
    box(0.38, 0.02, 0.38, WHITE, 0, 0.51, 0),
    tcyl(0.1, 0.1, 0.02, 0xff5a8a, 0, 0.26, 0.27, PI / 2, 0, 0, 14),
    prism(starPts(5, 0.13, 0.055), 0.02, 0xffb02e, 0, 0.53, 0),
    tbox(0.02, 0.15, 0.15, 0x4fb8ff, 0.27, 0.26, 0, PI / 4),
    vprism(heartPts(0.2), 0.02, 0x5fd16a, 0, 0.17, -0.27, PI),
  ],
});

def('toyball', {
  label: 'Toy Ball', col: { t: 'ball', r: 0.38 }, fit: 0.76, value: 1, mass: 0.15,
  tints: [TOY.red, TOY.blue, TOY.yellow, TOY.green, TOY.purple],
  build: () => {
    const R = 0.38, band = (t0, t1, col) => custom(new THREE.SphereGeometry(R, 18, 4, 0, TAU, t0 * PI, (t1 - t0) * PI).translate(0, R, 0), col);
    return [band(0, 0.36, TINT), band(0.36, 0.64, WHITE), band(0.64, 1, TINT), prism(starPts(5, 0.15, 0.065), 0.04, WHITE, 0, 2 * R - 0.035, 0)];
  },
});

def('duck', {
  label: 'Rubber Duck', col: { t: 'box', w: 0.74, h: 0.78, d: 0.86 }, fit: 1.14, value: 2, mass: 0.15,
  tints: [0xffd83a, 0xff9ec8, 0x8fd0ff, 0xa6edc0],
  build: () => C([
    egg(0.3, 0.2, 0.37, TINT, 0, 0.2, -0.03),
    egg(0.12, 0.13, 0.1, TINT, 0, 0.34, -0.36, -0.7),
    egg(0.2, 0.2, 0.19, TINT, 0, 0.56, 0.14),
    egg(0.12, 0.045, 0.11, 0xff8a2a, 0, 0.52, 0.33, 0, 0, 0, 10, 6),
    ...[-1, 1].flatMap((s) => [
      bead(0.034, INK, s * 0.085, 0.6, 0.29), spark(0.012, 0xffffff, s * 0.075, 0.615, 0.318),
      egg(0.045, 0.025, 0.02, BLUSH, s * 0.14, 0.53, 0.265, 0, s * 0.6, 0, 8, 5),
      egg(0.08, 0.12, 0.2, TINT, s * 0.28, 0.24, -0.04, 0, 0, s * 0.35, 10, 7),
    ]),
  ]),
});

def('crayon', {
  label: 'Crayon', col: { t: 'box', w: 0.84, h: 0.22, d: 0.26 }, fit: 0.88, value: 1, mass: 0.15,
  tints: [TOY.red, TOY.blue, TOY.yellow, TOY.green, TOY.purple, TOY.orange, TOY.pink],
  build: () => {
    const r = 0.115, cy = (r + 0.012) * 0.866;
    const hex = (rr, len, col, x) => custom(new THREE.CylinderGeometry(rr, rr, len, 6).rotateZ(PI / 2).translate(x, cy, 0), col);
    return C([
      hex(r, 0.62, TINT, -0.05), hex(r + 0.008, 0.42, 0xfff3dc, -0.08),
      hex(r + 0.012, 0.035, INK, -0.25), hex(r + 0.012, 0.035, INK, 0.09),
      custom(new THREE.CylinderGeometry(0.02, r, 0.22, 6).rotateZ(-PI / 2).translate(0.37, cy, 0), TINT),
    ]);
  },
});

def('stackrings', {
  label: 'Stacking Rings', col: { t: 'cyl', r: 0.4, h: 1.02 }, fit: 0.8, value: 1, mass: 0.2,
  tints: [TOY.blue, TOY.pink, TOY.purple, TOY.green, 0xffffff],
  build: () => {
    const p = [cyl(0.38, 0.4, 0.1, TINT, 0, 0, 0, 16), cyl(0.05, 0.05, 0.78, WOOD_L, 0, 0.1, 0, 8)];
    let y = 0.1;
    [[0.25, 0.1], [0.21, 0.088], [0.17, 0.076], [0.135, 0.066], [0.105, 0.056]].forEach(([R, t], i) => {
      // Rings alternate full tint / light tint so the toy's color reads at a glance.
      p.push(tone(tor(R, t, TINT, 0, y + t, 0, PI / 2, 0, 0, 6, 16), 0xffffff, i % 2 ? 0.45 : 1)); y += 2 * t - 0.01;
    });
    p.push(ball(0.1, TINT, 0, y - 0.02, 0, 1));
    return p;
  },
});

def('rocket', {
  label: 'Rocket', col: { t: 'cyl', r: 0.45, h: 1.25 }, fit: 0.9, value: 1, mass: 0.2,
  tints: [TOY.red, TOY.blue, TOY.orange, TOY.purple],
  build: () => {
    const p = [
      lathe([[0.15, 0.1], [0.22, 0.18], [0.255, 0.4], [0.26, 0.62], [0.24, 0.85]], WHITE, 0, 0, 0, 16),
      lathe([[0.24, 0.85], [0.2, 0.98], [0.13, 1.12], [0.06, 1.22], [0, 1.25]], TINT, 0, 0, 0, 16),
      cyl(0.13, 0.17, 0.12, STEEL, 0, 0, 0, 12),
      tcyl(0.09, 0.09, 0.04, GLASS, 0, 0.6, 0.25, PI / 2, 0, 0, 14),
      tor(0.095, 0.022, SILVER, 0, 0.6, 0.262, 0, 0, 0, 5, 14),
      tor(0.258, 0.022, TINT, 0, 0.3, 0, PI / 2, 0, 0, 4, 16),
    ];
    for (let k = 0; k < 4; k++) p.push(vprism([[0.18, 0.6], [0.18, 0.12], [0.43, 0.0], [0.45, 0.07], [0.32, 0.45]], 0.05, TINT, 0, 0, 0, PI / 4 + (k * PI) / 2));
    return p;
  },
});

def('toycar', {
  label: 'Toy Car', col: { t: 'box', w: 0.96, h: 0.58, d: 0.62 }, fit: 1.14, value: 2, mass: 0.15,
  tints: [TOY.red, TOY.blue, TOY.yellow, TOY.green, TOY.pink],
  build: () => {
    const p = [
      rbox(0.9, 0.26, 0.52, TINT, 0, 0.1, 0, 0.1),
      rbox(0.52, 0.25, 0.46, TINT, -0.07, 0.33, 0, 0.11),
      box(0.5, 0.12, 0.475, GLASS, -0.07, 0.38, 0),
      box(0.06, 0.08, 0.46, SILVER, 0.45, 0.12, 0),
      bead(0.05, 0xfff1a8, 0.44, 0.27, 0.15), bead(0.05, 0xfff1a8, 0.44, 0.27, -0.15),
    ];
    for (const [x, z] of [[-0.27, -0.26], [-0.27, 0.26], [0.27, -0.26], [0.27, 0.26]]) {
      p.push(tcyl(0.14, 0.14, 0.1, TIRE, x, 0.14, z, PI / 2, 0, 0, 14), tcyl(0.065, 0.065, 0.11, WHITE, x, 0.14, z, PI / 2, 0, 0, 10));
    }
    return C(p);
  },
});

def('robot', {
  label: 'Robot', col: { t: 'box', w: 0.98, h: 1.56, d: 0.5 }, fit: 1.1, value: 2, mass: 0.3,
  tints: [TOY.blue, TOY.red, TOY.green, TOY.orange, TOY.purple],
  build: () => [
    box(0.2, 0.34, 0.24, STEEL, -0.15, 0, 0), box(0.2, 0.34, 0.24, STEEL, 0.15, 0, 0),
    box(0.24, 0.08, 0.3, NAVY, -0.15, 0, 0.03), box(0.24, 0.08, 0.3, NAVY, 0.15, 0, 0.03),
    rbox(0.66, 0.56, 0.46, TINT, 0, 0.32, 0, 0.12),
    box(0.36, 0.26, 0.02, WHITE, 0, 0.46, 0.23),
    spark(0.035, 0xff4a4a, -0.1, 0.64, 0.245), spark(0.035, 0xffd23f, 0, 0.64, 0.245), spark(0.035, 0x5fd16a, 0.1, 0.64, 0.245),
    vprism(heartPts(0.13), 0.02, 0xff7ac0, 0, 0.47, 0.245),
    tcyl(0.07, 0.07, 0.42, STEEL, -0.4, 0.6, 0, 0, 0, 0, 8), tcyl(0.07, 0.07, 0.42, STEEL, 0.4, 0.6, 0, 0, 0, 0, 8),
    ball(0.09, TINT, -0.4, 0.27, 0, 1), ball(0.09, TINT, 0.4, 0.27, 0, 1),
    cyl(0.08, 0.08, 0.08, STEEL, 0, 0.88, 0, 8),
    rbox(0.52, 0.38, 0.42, SILVER, 0, 0.94, 0, 0.12),
    tcyl(0.075, 0.075, 0.03, 0x6ff0ff, -0.12, 1.15, 0.21, PI / 2, 0, 0, 12), tcyl(0.075, 0.075, 0.03, 0x6ff0ff, 0.12, 1.15, 0.21, PI / 2, 0, 0, 12),
    spark(0.035, INK, -0.12, 1.15, 0.225), spark(0.035, INK, 0.12, 1.15, 0.225),
    tor(0.07, 0.014, INK, 0, 1.07, 0.212, 0, 0, PI, 4, 8, PI),
    tcyl(0.06, 0.06, 0.06, TINT, -0.29, 1.13, 0, 0, 0, PI / 2, 10), tcyl(0.06, 0.06, 0.06, TINT, 0.29, 1.13, 0, 0, 0, PI / 2, 10),
    cyl(0.015, 0.015, 0.16, STEEL, 0, 1.32, 0, 5), ball(0.05, 0xff4a4a, 0, 1.46, 0, 1),
  ],
});

const trainWheels = (xs, z) => xs.flatMap((x) => [-1, 1].flatMap((s) => [
  tcyl(0.17, 0.17, 0.08, NAVY, x, 0.17, s * z, PI / 2, 0, 0, 14), tcyl(0.06, 0.06, 0.09, GOLD, x, 0.17, s * (z + 0.005), PI / 2, 0, 0, 8),
]));
def('locomotive', {
  label: 'Toy Train', col: { t: 'box', w: 1.7, h: 1.2, d: 0.76 }, fit: 1.86, value: 6, mass: 0.5,
  tints: [TOY.blue, TOY.red, TOY.green, TOY.purple],
  build: () => C([
    box(1.5, 0.14, 0.62, NAVY, 0, 0.18, 0),
    ...trainWheels([-0.45, 0, 0.42], 0.33),
    tcyl(0.27, 0.27, 0.9, TINT, 0.2, 0.6, 0, 0, 0, PI / 2, 16),
    tor(0.275, 0.025, GOLD, 0.0, 0.6, 0, 0, PI / 2, 0, 4, 16), tor(0.275, 0.025, GOLD, 0.4, 0.6, 0, 0, PI / 2, 0, 4, 16),
    tcyl(0.2, 0.2, 0.04, NAVY, 0.66, 0.6, 0, 0, 0, PI / 2, 14), bead(0.07, 0xfff1a8, 0.69, 0.62, 0),
    lathe([[0.08, 0], [0.08, 0.18], [0.15, 0.3], [0.15, 0.36], [0, 0.36]], NAVY, 0.45, 0.84, 0, 10),
    ball(0.11, GOLD, 0.12, 0.8, 0, 1),
    rbox(0.5, 0.6, 0.64, TINT, -0.46, 0.32, 0, 0.06), box(0.64, 0.08, 0.76, NAVY, -0.46, 0.92, 0),
    box(0.3, 0.2, 0.66, GLASS, -0.44, 0.62, 0),
    vprism([[0, 0], [0.2, 0], [0, 0.24]], 0.56, TOY.red, 0.72, 0.04, 0),
  ]),
});

def('traincar', {
  label: 'Train Car', col: { t: 'box', w: 1.34, h: 0.94, d: 0.74 }, fit: 1.53, value: 4, mass: 0.3,
  tints: [TOY.yellow, TOY.green, TOY.pink, TOY.blue, TOY.orange],
  build: () => C([
    box(1.1, 0.12, 0.6, NAVY, 0, 0.18, 0), box(0.14, 0.08, 0.12, NAVY, -0.6, 0.2, 0), box(0.14, 0.08, 0.12, NAVY, 0.6, 0.2, 0),
    ...trainWheels([-0.32, 0.32], 0.33),
    rbox(1.06, 0.42, 0.64, TINT, 0, 0.3, 0, 0.06),
    box(1.12, 0.06, 0.7, WHITE, 0, 0.69, 0),
    tbox(0.28, 0.28, 0.28, TOY.red, -0.3, 0.74, -0.05, 0, 0.3), tbox(0.26, 0.26, 0.26, TOY.blue, 0.03, 0.73, 0.1, 0, -0.2),
    ball(0.16, 0xffffff, 0.33, 0.62, -0.05, 1),
  ]),
});

def('teddy', {
  label: 'Teddy Bear', col: { t: 'box', w: 0.86, h: 1.46, d: 0.72 }, fit: 1.12, value: 2, mass: 0.3,
  tints: [0xd99a5b, 0x9b6545, 0xffb3c8, 0xf2d9b0, 0xb9a6e8],
  build: () => {
    const PAD = 0xfff0d8;
    return C([
      egg(0.34, 0.38, 0.3, TINT, 0, 0.4, -0.04, 0, 0, 0, 12, 8),
      egg(0.21, 0.24, 0.12, PAD, 0, 0.38, 0.16, 0, 0, 0, 8, 6),
      ...[-1, 1].flatMap((s) => [
        egg(0.13, 0.12, 0.17, TINT, s * 0.2, 0.12, 0.17, 0, 0, 0, 8, 6),
        egg(0.085, 0.085, 0.03, PAD, s * 0.2, 0.12, 0.33, 0, 0, 0, 8, 4),
        egg(0.1, 0.21, 0.11, TINT, s * 0.3, 0.5, 0.1, -0.5, 0, s * 0.35, 8, 6),
        egg(0.1, 0.1, 0.1, TINT, s * 0.24, 1.36, -0.02, 0, 0, 0, 7, 5), egg(0.06, 0.06, 0.02, PAD, s * 0.24, 1.37, 0.07, 0, 0, 0, 7, 4),
        egg(0.036, 0.036, 0.036, INK, s * 0.11, 1.18, 0.255, 0, 0, 0, 6, 4), spark(0.011, 0xffffff, s * 0.1, 1.195, 0.288),
        egg(0.045, 0.025, 0.02, BLUSH, s * 0.18, 1.08, 0.245, 0, s * 0.5, 0, 5, 3),
        tcyl(0.0, 0.07, 0.1, 0xff5a8a, s * 0.06, 0.8, 0.21, 0, 0, s * PI / 2, 8),
      ]),
      egg(0.31, 0.28, 0.28, TINT, 0, 1.12, 0, 0, 0, 0, 12, 8),
      egg(0.12, 0.09, 0.08, PAD, 0, 1.05, 0.25, 0, 0, 0, 10, 6),
      egg(0.045, 0.032, 0.03, INK, 0, 1.1, 0.325, 0, 0, 0, 7, 4),
      egg(0.035, 0.035, 0.035, 0xff5a8a, 0, 0.8, 0.23, 0, 0, 0, 7, 5),
    ]);
  },
});

def('rockinghorse', {
  label: 'Rocking Horse', col: { t: 'box', w: 1.54, h: 1.45, d: 0.5 }, fit: 1.62, value: 4, mass: 0.4,
  tints: [0xfff3e6, 0xd99a5b, 0xffb3d1, 0x9fd0ff],
  build: () => {
    const MANE = 0xffc23a, p = [];
    for (const s of [-1, 1]) {
      p.push(tor(1.3, 0.045, WOOD_D, 0, 1.345, s * 0.2, 0, 0, -PI / 2 - 0.5, 4, 14, 1.0));
      p.push(tcyl(0.04, 0.05, 0.475, TINT, 0.36, 0.37, s * 0.2, 0, 0, 0.256, 6), tcyl(0.04, 0.05, 0.475, TINT, -0.36, 0.37, s * 0.2, 0, 0, -0.256, 6));
      p.push(egg(0.03, 0.03, 0.03, INK, 0.66, 1.28, s * 0.115, 0, 0, 0, 6, 4), tcyl(0.0, 0.05, 0.12, TINT, 0.52, 1.39, s * 0.06, 0, 0, 0, 6));
    }
    for (const x of [-0.55, 0.55]) p.push(tcyl(0.025, 0.025, 0.42, WOOD_D, x, 0.2, 0, PI / 2, 0, 0, 6));
    p.push(
      egg(0.45, 0.2, 0.2, TINT, 0, 0.75, 0, 0, 0, 0, 12, 8),
      tcyl(0.12, 0.15, 0.42, TINT, 0.4, 1.0, 0, 0, 0, -0.55, 10),
      egg(0.25, 0.14, 0.14, TINT, 0.6, 1.22, 0, 0, 0, -0.35, 12, 7),
      egg(0.1, 0.1, 0.12, 0xffc8c0, 0.79, 1.14, 0, 0, 0, 0, 8, 5),
      egg(0.08, 0.2, 0.08, MANE, -0.52, 0.8, 0, 0, 0, 0.7, 8, 5),
      rbox(0.36, 0.06, 0.44, 0xff5a8a, -0.02, 0.92, 0, 0.03),
      tcyl(0.025, 0.025, 0.42, GOLD, 0.58, 1.25, 0, PI / 2, 0, 0, 6),
    );
    for (let i = 0; i < 5; i++) { const t = i / 4; p.push(egg(0.07, 0.09, 0.075, MANE, 0.24 + t * 0.32, 0.98 + t * 0.4, 0, 0, 0, -0.5, 6, 4)); }
    return C(p);
  },
});

def('dollhouse', {
  label: 'Dollhouse', col: { t: 'box', w: 2.7, h: 3.22, d: 1.98 }, fit: 3.36, value: 18, mass: 3,
  tints: [0xffb3c8, 0x9fecc9, 0xffe27a, 0x9fd2ff],
  build: () => {
    const ROOF = 0xff7a8a, p = [
      rbox(2.6, 0.12, 1.9, WOOD_L, 0, 0, 0, 0.04),
      box(2.3, 2.0, 1.6, TINT, 0, 0.12, 0),
      box(2.36, 0.08, 1.66, WHITE, 0, 1.1, 0),
      roof(2.7, 1.1, 1.98, ROOF, 0, 2.12, 0),
      box(0.42, 0.74, 0.06, 0x8a5a3c, 0, 0.12, 0.81), bead(0.035, GOLD, 0.12, 0.48, 0.85),
      tcyl(0.17, 0.17, 0.05, GLASS, 0, 2.55, 0.97, PI / 2, 0, 0, 14), tor(0.18, 0.03, WHITE, 0, 2.55, 0.995, 0, 0, 0, 4, 14),
      box(0.3, 0.6, 0.3, 0xd86a5a, 0.7, 2.6, -0.3),
    ];
    const win = (x, y) => [box(0.46, 0.46, 0.04, WHITE, x, y - 0.05, 0.81), box(0.36, 0.36, 0.05, GLASS, x, y, 0.815),
      box(0.36, 0.03, 0.06, WHITE, x, y + 0.165, 0.82), box(0.03, 0.36, 0.06, WHITE, x, y, 0.82)];
    for (const x of [-0.75, 0.75]) p.push(...win(x, 0.45), box(0.46, 0.08, 0.12, WOOD, x, 0.36, 0.86),
      bead(0.045, 0xff6f91, x - 0.12, 0.47, 0.87), bead(0.045, 0xffd23f, x, 0.47, 0.87), bead(0.045, 0xb07cff, x + 0.12, 0.47, 0.87));
    for (const x of [-0.75, 0, 0.75]) p.push(...win(x, 1.45));
    for (const s of [-1, 1]) p.push(box(0.05, 0.4, 0.4, GLASS, s * 1.15, 0.5, 0), box(0.05, 0.4, 0.4, GLASS, s * 1.15, 1.5, 0));
    return p;
  },
});

def('playcastle', {
  label: 'Play Castle', col: { t: 'box', w: 4.1, h: 4.8, d: 3.1 }, fit: 5.14, value: 42, mass: 8,
  tints: [0xff8fc8, 0x8fc8ff, 0xb48cff, 0xffc94a],
  build: () => {
    const WALL = 0xf6f0ff, WALL2 = 0xebe2ff, p = [
      rbox(3.2, 1.6, 2.2, WALL, 0, 0, 0, 0.06),
      rbox(1.6, 1.7, 1.2, WALL2, 0, 1.6, -0.3, 0.06),
      cyl(0.42, 0.44, 0.7, WALL, 0, 3.3, -0.3, 14), cone(0.55, 0.8, TINT, 0, 4.0, -0.3, 14),
      box(0.8, 1.0, 0.06, 0x8a5a3c, 0, 0, 1.11),
      custom(new THREE.CylinderGeometry(0.4, 0.4, 0.06, 12, 1, false, -PI / 2, PI).rotateX(PI / 2).translate(0, 1.0, 1.11), 0x8a5a3c),
      vprism(heartPts(0.5), 0.06, TINT, 0, 1.25, 1.12),
      tcyl(0.18, 0.18, 0.05, NAVY, 0, 2.6, 0.31, PI / 2, 0, 0, 12),
    ];
    // crenellations along the outer wall
    for (let i = 0; i < 6; i++) { const x = -1.35 + i * 0.54; p.push(box(0.26, 0.24, 0.26, WALL, x, 1.6, 0.97), box(0.26, 0.24, 0.26, WALL, x, 1.6, -0.97)); }
    for (const s of [-1, 1]) for (const z of [-0.45, 0, 0.45]) p.push(box(0.26, 0.24, 0.26, WALL, s * 1.47, 1.6, z));
    for (let i = 0; i < 4; i++) { const x = -0.6 + i * 0.4; p.push(box(0.2, 0.2, 0.2, WALL2, x, 3.3, 0.2)); }
    // corner towers with cone roofs and pennants
    for (const [x, z] of [[-1.5, -1.0], [1.5, -1.0], [-1.5, 1.0], [1.5, 1.0]]) {
      p.push(cyl(0.46, 0.48, 2.5, WALL, x, 0, z, 14), cone(0.55, 1.05, TINT, x, 2.5, z, 14));
      p.push(cyl(0.015, 0.015, 0.4, STEEL, x, 3.55, z, 4), box(0.26, 0.14, 0.02, GOLD, x + 0.13, 3.8, z));
      p.push(tcyl(0.1, 0.1, 0.04, NAVY, x, 1.7, z + 0.46, PI / 2, 0, 0, 10), box(0.2, 0.1, 0.04, NAVY, x, 1.6, z + 0.46));
    }
    return p;
  },
});

// ======================================================================== GARDEN
def('tulip', {
  label: 'Tulip', col: { t: 'cyl', r: 0.21, h: 0.78 }, fit: 0.42, value: 1, mass: 0.15,
  tints: [0xff4a6a, 0xff8fc8, 0xffd23f, 0xb07cff, 0xff8a3a],
  build: () => {
    const p = [tcyl(0.025, 0.03, 0.46, STEM_G, 0, 0.23, 0, 0, 0, 0, 6),
      egg(0.06, 0.22, 0.025, LEAF, 0.09, 0.2, 0.02, 0, -0.3, -0.35, 8, 6),
      egg(0.13, 0.17, 0.13, TINT, 0, 0.6, 0, 0, 0, 0, 12, 8)];
    for (let k = 0; k < 3; k++) { const a = (k * TAU) / 3; p.push(egg(0.09, 0.17, 0.07, TINT, 0.075 * Math.sin(a), 0.6, 0.075 * Math.cos(a), 0.25, a, 0, 10, 7)); }
    return p;
  },
});

def('daisy', {
  label: 'Daisy', col: { t: 'cyl', r: 0.29, h: 0.62 }, fit: 0.58, value: 1, mass: 0.15,
  tints: [0xffffff, 0xff9ec8, 0xffe066, 0xc9b3ff, 0x9fd8ff],
  build: () => [
    tcyl(0.025, 0.03, 0.5, STEM_G, 0, 0.25, 0, 0, 0, 0, 6),
    egg(0.09, 0.02, 0.04, LEAF, 0.08, 0.22, 0, 0, 0.4, -0.3, 8, 5), egg(0.08, 0.02, 0.035, LEAF, -0.07, 0.3, 0.02, 0, -0.5, 0.3, 8, 5),
    prism(petalPts(8, 0.27), 0.05, TINT, 0, 0.49, 0, 0.012),
    egg(0.09, 0.05, 0.09, 0xffb52e, 0, 0.56, 0, 0, 0, 0, 12, 6),
  ],
});

def('mushroom', {
  label: 'Mushroom', col: { t: 'cyl', r: 0.33, h: 0.48 }, fit: 0.66, value: 1, mass: 0.15,
  tints: [0xff4f4f, 0xff9a3a, 0xb07cff, 0x4fa3ff, 0xff8fc8],
  build: () => {
    const p = [
      lathe([[0.1, 0], [0.13, 0.02], [0.125, 0.12], [0.1, 0.28], [0, 0.28]], CREAM, 0, 0, 0, 12),
      cyl(0.3, 0.16, 0.04, 0xffe2c4, 0, 0.23, 0, 16),
      custom(new THREE.SphereGeometry(0.32, 16, 6, 0, TAU, 0, PI / 2).scale(1, 0.7, 1).translate(0, 0.255, 0), TINT),
      bead(0.022, INK, -0.045, 0.14, 0.12), bead(0.022, INK, 0.045, 0.14, 0.12),
      egg(0.025, 0.015, 0.01, BLUSH, -0.08, 0.11, 0.115, 0, -0.5, 0, 6, 4), egg(0.025, 0.015, 0.01, BLUSH, 0.08, 0.11, 0.115, 0, 0.5, 0, 6, 4),
    ];
    for (const [a, rho] of [[0, 0], [0.4, 0.2], [2.3, 0.21], [4.2, 0.19], [1.4, 0.27], [3.3, 0.27], [5.3, 0.26]]) {
      const y = 0.255 + 0.7 * Math.sqrt(Math.max(0, 0.32 * 0.32 - rho * rho));
      p.push(egg(0.05, 0.018, 0.05, WHITE, rho * Math.sin(a), y, rho * Math.cos(a), (rho / 0.32) * 0.9, a, 0, 8, 4));
    }
    return p;
  },
});

def('gnome', {
  label: 'Garden Gnome', col: { t: 'cyl', r: 0.33, h: 1.25 }, fit: 0.66, value: 1, mass: 0.2,
  tints: [0xff4a4a, 0x5fc96a, 0x9f6bff, 0xff9a3a],
  build: () => [
    egg(0.1, 0.07, 0.14, 0x6b4a32, -0.1, 0.07, 0.04, 0, 0, 0, 8, 6), egg(0.1, 0.07, 0.14, 0x6b4a32, 0.1, 0.07, 0.04, 0, 0, 0, 8, 6),
    lathe([[0, 0.06], [0.26, 0.06], [0.27, 0.12], [0.22, 0.4], [0.16, 0.52], [0, 0.54]], 0x4f8fe0, 0, 0, 0, 14),
    tor(0.235, 0.025, 0x4a3424, 0, 0.3, 0, PI / 2, 0, 0, 4, 14), box(0.08, 0.07, 0.03, GOLD, 0, 0.265, 0.25),
    egg(0.07, 0.15, 0.07, 0x4f8fe0, -0.22, 0.38, 0.03, 0, 0, -0.4, 7, 5), egg(0.07, 0.15, 0.07, 0x4f8fe0, 0.22, 0.38, 0.03, 0, 0, 0.4, 7, 5),
    bead(0.055, 0xffcfa8, -0.27, 0.27, 0.06), bead(0.055, 0xffcfa8, 0.27, 0.27, 0.06),
    egg(0.17, 0.2, 0.11, WHITE, 0, 0.5, 0.11, 0, 0, 0, 10, 6),
    egg(0.13, 0.13, 0.13, 0xffcfa8, 0, 0.65, 0.02, 0, 0, 0, 12, 8),
    bead(0.05, 0xff9a8a, 0, 0.62, 0.15),
    bead(0.02, INK, -0.055, 0.69, 0.12), bead(0.02, INK, 0.055, 0.69, 0.12),
    lathe([[0.19, 0], [0.17, 0.12], [0.11, 0.33], [0.045, 0.48], [0, 0.53]], TINT, 0, 0.71, 0, 14),
    tor(0.17, 0.035, TINT, 0, 0.73, 0, PI / 2, 0, 0, 5, 14),
  ],
});

const POT = [[0, 0], [0.22, 0], [0.28, 0.3], [0.32, 0.31], [0.32, 0.4], [0.27, 0.4], [0.26, 0.35], [0, 0.35]];
def('potplant', {
  label: 'Pot Plant', col: { t: 'cyl', r: 0.33, h: 0.92 }, fit: 0.66, value: 1, mass: 0.2,
  tints: [0xff9ec8, 0x8fd0ff, 0xffe066, 0xc9b3ff, 0xffffff],
  build: () => [
    lathe(POT, TINT, 0, 0, 0, 16),
    cyl(0.26, 0.26, 0.02, 0x6b4a32, 0, 0.35, 0, 12),
    egg(0.29, 0.21, 0.29, LEAF, 0, 0.56, 0, 0, 0, 0, 14, 8),
    egg(0.19, 0.17, 0.19, LEAF_L, 0.11, 0.7, 0.05, 0, 0, 0, 12, 7),
    egg(0.17, 0.15, 0.17, LEAF_D, -0.12, 0.68, -0.07, 0, 0, 0, 12, 7),
    bead(0.06, TINT, 0.12, 0.85, 0.08), bead(0.055, TINT, -0.15, 0.8, 0.1), bead(0.055, TINT, 0.02, 0.78, -0.2),
    bead(0.025, 0xffd23f, 0.12, 0.89, 0.12), bead(0.022, 0xffd23f, -0.15, 0.84, 0.14),
  ],
});

def('birdhouse', {
  label: 'Birdhouse', col: { t: 'box', w: 0.6, h: 1.2, d: 0.58 }, fit: 0.83, value: 1, mass: 0.2,
  tints: [0x8fd0ff, 0xffe066, 0xff9ec8, 0xa6edc0],
  build: () => [
    cyl(0.26, 0.29, 0.08, WOOD_D, 0, 0, 0, 12),
    cyl(0.05, 0.05, 0.44, WOOD_D, 0, 0.08, 0, 8),
    rbox(0.46, 0.42, 0.42, TINT, 0, 0.5, 0, 0.04),
    tone(roof(0.6, 0.28, 0.54, TINT, 0, 0.92, 0), 0xd2d2d2),
    tcyl(0.08, 0.08, 0.03, INK, 0, 0.74, 0.21, PI / 2, 0, 0, 12),
    tcyl(0.015, 0.015, 0.08, WOOD_D, 0, 0.6, 0.24, PI / 2, 0, 0, 5),
    vprism(heartPts(0.1), 0.02, 0xff6f91, 0, 0.84, 0.215),
  ],
});

def('wateringcan', {
  label: 'Watering Can', col: { t: 'box', w: 0.96, h: 0.68, d: 0.56 }, fit: 1.11, value: 2, mass: 0.2,
  tints: [0x5fc96a, 0x4fa3ff, 0xff8fc8, 0xffd23f],
  build: () => C([
    lathe([[0, 0], [0.26, 0], [0.28, 0.05], [0.28, 0.38], [0.24, 0.44], [0, 0.46]], TINT, -0.1, 0, 0, 16),
    tor(0.2, 0.02, SILVER, -0.1, 0.44, 0, PI / 2, 0, 0, 4, 14),
    tcyl(0.03, 0.06, 0.5, TINT, 0.33, 0.33, 0, 0, 0, -0.95, 8),
    tcyl(0.08, 0.04, 0.06, SILVER, 0.55, 0.49, 0, 0, 0, -0.95, 10),
    tor(0.17, 0.035, TINT, -0.1, 0.46, 0, 0, 0, 0, 6, 12, PI),
    vprism(petalPts(5, 0.1), 0.02, WHITE, -0.1, 0.22, 0.28), bead(0.03, 0xffd23f, -0.1, 0.22, 0.29),
  ]),
});

def('pumpkin', {
  label: 'Pumpkin', col: { t: 'cyl', r: 0.5, h: 0.9 }, fit: 1.0, value: 2, mass: 0.3,
  tints: [0xff8a2a, 0xffb347, 0xf4ece0],
  build: () => [
    ribbed(0.5, 0.72, 8, 0.1, TINT),
    tcyl(0.05, 0.07, 0.2, 0x7a5a2a, 0.02, 0.78, 0, 0, 0, -0.2, 6),
    egg(0.15, 0.02, 0.1, LEAF, 0.16, 0.73, 0.06, 0, -0.4, -0.3, 8, 5),
    tor(0.06, 0.012, LEAF_D, -0.1, 0.75, 0.05, 0, 0.5, 0, 4, 10, 4.5),
  ],
});

def('hedge', {
  label: 'Hedge', col: { t: 'box', w: 1.1, h: 1.07, d: 1.1 }, fit: 1.56, value: 4, mass: 0.4,
  tints: [0x5cbf5a, 0x4aa64f, 0x7fd36a],
  build: () => {
    const p = [rbox(1.0, 0.96, 1.0, TINT, 0, 0, 0, 0.2)];
    // irregular leafy clumps breaking up the silhouette on top and along the upper edges
    [[-0.2, 0.93, 0.08, 0.2], [0.18, 0.95, -0.15, 0.17], [0.05, 0.94, 0.28, 0.15], [-0.3, 0.9, -0.28, 0.13], [0.33, 0.9, 0.3, 0.12],
      [0.42, 0.72, -0.05, 0.11], [-0.42, 0.7, 0.18, 0.11], [0.1, 0.7, 0.42, 0.11], [-0.2, 0.74, -0.42, 0.11]]
      .forEach(([x, y, z, r]) => p.push(egg(r * 1.15, r * 0.7, r * 1.15, TINT, x, y, z, 0, x * 3, 0, 8, 5)));
    const FL = [0xff8fc8, 0xffffff, 0xffd23f];
    [[-0.3, 0.6, 0.5], [0.2, 0.35, 0.5], [0.33, 0.75, 0.48], [-0.1, 0.25, 0.5], [0.5, 0.5, 0.2], [0.5, 0.25, -0.25], [-0.5, 0.55, -0.1], [0.05, 1.03, 0.1], [-0.25, 1.0, -0.25]]
      .forEach(([x, y, z], i) => p.push(spark(0.04, FL[i % 3], x, y, z)));
    return p;
  },
});

def('gardenbench', {
  label: 'Garden Bench', col: { t: 'box', w: 1.7, h: 0.98, d: 0.6 }, fit: 1.8, value: 5, mass: 0.6,
  tints: [0xffffff, 0x8fd8c8, 0x8fc8ff, 0xffb3c8, 0xc98b55],
  build: () => {
    const F = 0x3f6b4f, p = [];
    for (const s of [-1, 1]) {
      p.push(box(0.08, 0.45, 0.5, F, s * 0.8, 0, 0.02), box(0.08, 0.06, 0.56, F, s * 0.8, 0.66, 0.02),
        box(0.08, 0.98, 0.08, F, s * 0.8, 0, -0.26), box(0.07, 0.2, 0.07, F, s * 0.8, 0.45, 0.24));
    }
    for (const z of [-0.15, 0.02, 0.19]) p.push(box(1.62, 0.05, 0.14, TINT, 0, 0.45, z));
    for (const y of [0.58, 0.72, 0.86]) p.push(box(1.62, 0.1, 0.05, TINT, 0, y, -0.26));
    return C(p);
  },
});

def('gardenfountain', {
  label: 'Fountain', col: { t: 'cyl', r: 0.98, h: 1.56 }, fit: 1.96, value: 6, mass: 1.2,
  tints: [0xf2efe8, 0xf6d5d5, 0xd5e2ef, 0xe8f0d8],
  build: () => {
    const p = [
      lathe([[0, 0], [0.95, 0], [0.98, 0.3], [0.9, 0.32], [0.88, 0.12], [0, 0.12]], TINT, 0, 0, 0, 22),
      cyl(0.89, 0.89, 0.04, WATER, 0, 0.2, 0, 22),
      lathe([[0.16, 0], [0.12, 0.3], [0.1, 0.6], [0.16, 0.8]], TINT, 0, 0.2, 0, 12),
      lathe([[0, 0], [0.1, 0], [0.42, 0.12], [0.45, 0.18], [0.4, 0.18], [0.38, 0.15], [0, 0.12]], TINT, 0, 0.98, 0, 18),
      cyl(0.385, 0.385, 0.02, WATER, 0, 1.11, 0, 16),
      egg(0.07, 0.2, 0.07, WATER_L, 0, 1.32, 0, 0, 0, 0, 10, 8), bead(0.06, WATER_L, 0, 1.5, 0),
      cyl(0.17, 0.17, 0.02, LEAF, 0.55, 0.23, 0.35, 10), bead(0.05, 0xff8fc8, 0.55, 0.28, 0.35),
      cyl(0.14, 0.14, 0.02, LEAF, -0.6, 0.23, -0.2, 10),
    ];
    for (let k = 0; k < 4; k++) { const a = (k * TAU) / 4 + PI / 4; p.push(tcyl(0.02, 0.025, 0.85, WATER_L, 0.43 * Math.sin(a), 0.62, 0.43 * Math.cos(a), 0, 0, 0, 5)); }
    return p;
  },
});

def('gazebo', {
  label: 'Gazebo', col: { t: 'cyl', r: 2.55, h: 4.12 }, fit: 5.1, value: 42, mass: 7,
  tints: [0xff8fb0, 0x7fc8ff, 0x8fdcae, 0xffb86b],
  build: () => {
    const p = [
      cyl(2.3, 2.4, 0.3, 0xf3e8dc, 0, 0, 0, 8),
      box(1.0, 0.15, 0.4, 0xe6d6c4, 0, 0, 2.15),
      cyl(2.55, 2.55, 0.14, WHITE, 0, 2.45, 0, 8),
      cone(2.55, 1.35, TINT, 0, 2.59, 0, 8),
      cyl(0.12, 0.12, 0.25, WHITE, 0, 3.75, 0, 8), ball(0.13, GOLD, 0, 3.9, 0, 1),
      cyl(1.0, 1.0, 0.06, WHITE, 0, 0.9, 0, 14), cyl(0.08, 0.1, 0.6, WHITE, 0, 0.3, 0, 8),
      cyl(0.25, 0.25, 0.04, 0xff8fc8, 0, 0.96, 0, 10),
    ];
    for (let i = 0; i < 8; i++) {
      const a = (i * TAU) / 8;
      p.push(cyl(0.08, 0.08, 2.15, WHITE, 2.05 * Math.sin(a), 0.3, 2.05 * Math.cos(a), 8));
      p.push(bead(0.11, [0xff8fc8, 0xffffff, 0xffd23f][i % 3], 2.05 * Math.sin(a), 2.2, 2.05 * Math.cos(a)));
      const m = a + PI / 8, rc = 2.05 * Math.cos(PI / 8);
      if (i === 7) continue; // the front bay stays open
      for (const y of [0.75, 1.1]) p.push(tbox(1.57, 0.07, 0.07, WHITE, rc * Math.sin(m), y, rc * Math.cos(m), 0, m));
    }
    return p;
  },
});

// ======================================================================== BEACH
def('shell', {
  label: 'Seashell', col: { t: 'box', w: 0.48, h: 0.11, d: 0.39 }, fit: 0.62, value: 1, mass: 0.15,
  tints: [0xff8fae, 0xb09cff, 0x6fd3d8, 0xffb06b],
  build: () => {
    const R = 0.27, o = -0.17, fan = [];
    fan.push([-0.1, -0.24], [-0.09, -0.15]);
    for (let i = 0; i <= 20; i++) {
      const th = -1.0 + i * 0.1, r = R * (1 - 0.06 * (1 - Math.abs(Math.cos(th * 9 * PI / 2))));
      fan.push([r * Math.sin(th), o + r * Math.cos(th)]);
    }
    fan.push([0.09, -0.15], [0.1, -0.24]);
    const p = [prism(fan, 0.09, TINT, 0, 0, 0, 0.025)];
    for (let k = 0; k < 7; k++) { const th = -0.85 + k * 0.283; p.push(tbox(0.028, 0.022, 0.2, WHITE, 0.14 * Math.sin(th), 0.098, o + 0.14 * Math.cos(th), 0, th)); }
    return C(p);
  },
});

def('starfish', {
  label: 'Starfish', col: { t: 'cyl', r: 0.36, h: 0.14 }, fit: 0.72, value: 1, mass: 0.15,
  tints: [0xff8a4a, 0xff7aa0, 0xa07cff, 0xffc93a],
  build: () => {
    const p = [prism(starPts(5, 0.33, 0.14), 0.1, TINT, 0, 0, 0, 0.03), egg(0.1, 0.03, 0.1, TINT, 0, 0.1, 0, 0, 0, 0, 10, 5)];
    for (let k = 0; k < 5; k++) for (const r of [0.11, 0.2]) { const a = (k * TAU) / 5; p.push(spark(0.022, 0xfff3e6, r * Math.sin(a), 0.105, -r * Math.cos(a))); }
    return p;
  },
});

def('bucket', {
  label: 'Sand Pail', col: { t: 'cyl', r: 0.37, h: 0.88 }, fit: 0.74, value: 1, mass: 0.15,
  tints: [TOY.red, TOY.blue, TOY.yellow, TOY.green, TOY.pink],
  build: () => [
    lathe([[0, 0], [0.26, 0], [0.34, 0.46], [0.36, 0.47], [0.36, 0.52], [0.33, 0.52], [0.32, 0.48], [0.25, 0.05], [0, 0.05]], TINT, 0, 0, 0, 18),
    cyl(0.315, 0.315, 0.02, SAND, 0, 0.42, 0, 16),
    egg(0.2, 0.06, 0.2, SAND, 0.03, 0.44, 0.02, 0, 0, 0, 10, 5),
    tor(0.31, 0.022, WHITE, 0, 0.2, 0, PI / 2, 0, 0, 4, 18),
    tor(0.345, 0.02, WHITE, 0, 0.5, 0, 0, 0, 0, 4, 14, PI),
    prism(starPts(5, 0.07, 0.03), 0.02, 0xff8a4a, 0.08, 0.47, -0.05, 0, 0),
  ],
});

def('spade', {
  label: 'Spade', col: { t: 'box', w: 1.0, h: 0.11, d: 0.34 }, fit: 1.06, value: 2, mass: 0.15,
  tints: [TOY.red, TOY.blue, TOY.yellow, TOY.green],
  build: () => C([
    egg(0.2, 0.05, 0.165, TINT, 0.25, 0.05, 0, 0, 0, 0, 14, 6),
    tor(0.165, 0.02, TINT, 0.25, 0.06, 0, PI / 2, 0, 0, 4, 16),
    tcyl(0.04, 0.04, 0.16, TINT, 0.0, 0.045, 0, 0, 0, PI / 2, 8),
    tcyl(0.042, 0.042, 0.45, WHITE, -0.29, 0.045, 0, 0, 0, PI / 2, 8),
    tcyl(0.045, 0.045, 0.26, TINT, -0.52, 0.045, 0, PI / 2, 0, 0, 8),
  ]),
});

def('crab', {
  label: 'Crab', col: { t: 'box', w: 0.92, h: 0.46, d: 0.66 }, fit: 1.13, value: 2, mass: 0.15,
  tints: [0xff6b5a, 0xff9a3a, 0xff7aa8, 0xb07cff],
  build: () => {
    const p = [egg(0.3, 0.14, 0.22, TINT, 0, 0.16, 0, 0, 0, 0, 14, 8)];
    for (const s of [-1, 1]) {
      for (const z of [-0.12, 0, 0.12]) p.push(tcyl(0.022, 0.028, 0.22, TINT, s * 0.33, 0.09, z, 0, s * z * 1.2, s * 1.15, 5));
      p.push(tcyl(0.03, 0.03, 0.18, TINT, s * 0.22, 0.17, 0.22, 0, s * 0.6, s * 1.1, 6));
      p.push(egg(0.1, 0.08, 0.09, TINT, s * 0.27, 0.19, 0.33, 0, 0, 0, 10, 7));
      p.push(egg(0.05, 0.04, 0.08, TINT, s * 0.22, 0.24, 0.42, 0, s * 0.4, 0, 8, 5));
      p.push(tcyl(0.02, 0.02, 0.12, TINT, s * 0.08, 0.33, 0.1, 0, 0, s * -0.2, 5));
      p.push(bead(0.055, WHITE, s * 0.09, 0.42, 0.1), bead(0.03, INK, s * 0.09, 0.43, 0.145));
      p.push(egg(0.035, 0.02, 0.015, BLUSH, s * 0.15, 0.17, 0.2, 0, s * 0.6, 0, 6, 4));
    }
    p.push(tor(0.05, 0.012, INK, 0, 0.19, 0.21, 0, 0, PI, 4, 8, PI));
    return C(p);
  },
});

def('parasol', {
  label: 'Beach Umbrella', col: { t: 'cyl', r: 0.33, h: 2.2 }, fit: 0.66, value: 1, mass: 0.2,
  tints: [TOY.red, TOY.blue, TOY.orange, TOY.green, TOY.pink],
  build: () => {
    const p = [custom(new THREE.SphereGeometry(0.33, 14, 4, 0, TAU, 0, PI / 2).scale(1, 0.3, 1), SAND), cyl(0.03, 0.03, 2.1, WHITE, 0, 0, 0, 6)];
    const prof = [[0.035, 0.7], [0.18, 0.9], [0.25, 1.25], [0.21, 1.7], [0.1, 1.98], [0.03, 2.08]];
    for (let k = 0; k < 8; k++) p.push(lathe(prof, k % 2 ? WHITE : TINT, 0, 0, 0, 2, (k * TAU) / 8, TAU / 8));
    p.push(tor(0.205, 0.022, TINT, 0, 1.45, 0, PI / 2, 0, 0, 4, 12), bead(0.06, WHITE, 0, 2.12, 0));
    return p;
  },
});

def('beachball', {
  label: 'Beach Ball', col: { t: 'ball', r: 0.6 }, fit: 1.2, value: 2, mass: 0.15,
  tints: [TOY.red, TOY.blue, 0xffb02e, TOY.green, TOY.pink],
  build: () => {
    const R = 0.6, p = [];
    for (let k = 0; k < 6; k++) p.push(custom(new THREE.SphereGeometry(R, 4, 12, (k * TAU) / 6, TAU / 6).translate(0, R, 0), k % 2 ? WHITE : TINT));
    p.push(custom(new THREE.SphereGeometry(R + 0.004, 12, 2, 0, TAU, 0, 0.22).translate(0, R, 0), WHITE));
    p.push(custom(new THREE.SphereGeometry(R + 0.004, 12, 2, 0, TAU, PI - 0.22, 0.22).translate(0, R, 0), WHITE));
    return p;
  },
});

def('lifering', {
  label: 'Life Ring', col: { t: 'cyl', r: 0.63, h: 0.3 }, fit: 1.26, value: 3, mass: 0.15,
  tints: [0xff5a3a, 0xff8a2a, 0xff5a8a, 0x4fa3ff],
  build: () => {
    const p = [];
    for (let i = 0; i < 8; i++) p.push(tor(0.48, 0.15, i % 2 ? WHITE : TINT, 0, 0.15, 0, PI / 2, (i * PI) / 4, 0, 8, 6, PI / 4));
    return p;
  },
});

def('deckchair', {
  label: 'Deck Chair', col: { t: 'box', w: 0.94, h: 1.04, d: 1.06 }, fit: 1.42, value: 3, mass: 0.3,
  tints: [TOY.red, TOY.blue, TOY.green, 0xffb02e, TOY.pink],
  build: () => {
    const p = [];
    for (const s of [-1, 1]) {
      p.push(tbox(0.05, 1.345, 0.05, WOOD, s * 0.44, 0.5, 0, -0.733));
      p.push(tbox(0.05, 0.71, 0.05, WOOD, s * 0.44, 0.275, -0.275, 0.686));
    }
    p.push(tcyl(0.025, 0.025, 0.92, WOOD, 0, 0.98, -0.45, 0, 0, PI / 2, 6), tcyl(0.025, 0.025, 0.92, WOOD, 0, 0.06, 0.45, 0, 0, PI / 2, 6));
    for (let i = 0; i < 5; i++) p.push(tbox(0.168, 1.2, 0.02, i % 2 ? WHITE : TINT, -0.336 + i * 0.168, 0.52, 0.0, -0.733));
    return C(p);
  },
});

const boardPts = () => {
  const top = [], bot = [];
  for (let i = 0; i <= 18; i++) {
    const u = i / 18, x = -1.1 + 2.2 * u;
    const hw = Math.max(0.1, 0.32 * Math.pow(Math.sin(PI * Math.min(1, u * 0.92 + 0.08)), 0.7)) * (u > 0.97 ? 0.3 : 1);
    top.push([x, -hw]); bot.push([x, hw]);
  }
  return [...top, ...bot.reverse()];
};
def('surfboard', {
  label: 'Surfboard', col: { t: 'box', w: 2.26, h: 0.1, d: 0.7 }, fit: 2.37, value: 8, mass: 0.3,
  tints: [0x4fd1e8, 0xff8a5a, 0xffd23f, 0xff7ac8, 0x8f7cff],
  build: () => C([
    prism(boardPts(), 0.1, TINT, 0, 0, 0, 0.03),
    box(1.9, 0.012, 0.08, WHITE, -0.05, 0.095, 0),
    prism(starPts(5, 0.11, 0.05), 0.012, WHITE, 0.55, 0.095, 0),
  ]),
});

const TOWER = [[0.32, 0], [0.28, 0.85], [0.31, 0.87], [0.31, 1.0], [0, 1.0]];
def('sandcastle', {
  label: 'Sandcastle', col: { t: 'box', w: 2.34, h: 2.3, d: 2.34 }, fit: 3.31, value: 17, mass: 2.5,
  tints: [TOY.red, TOY.blue, 0xffd23f, TOY.pink],
  build: () => {
    const p = [
      lathe([[0, 0], [1.15, 0], [1.1, 0.12], [0.98, 0.22], [0, 0.22]], SAND_D, 0, 0, 0, 20),
      rbox(1.6, 0.8, 1.6, SAND, 0, 0.18, 0, 0.06),
      lathe([[0.44, 0], [0.38, 0.85], [0.41, 0.87], [0.41, 0.98], [0, 0.98]], SAND, 0, 0.95, 0, 16),
      box(0.3, 0.42, 0.04, 0xc99a5c, 0, 0.18, 0.8),
      tcyl(0.15, 0.15, 0.04, 0xc99a5c, 0, 0.6, 0.8, PI / 2, 0, 0, 10),
      cyl(0.02, 0.02, 0.4, WOOD_D, 0, 1.93, 0, 5), vprism([[0, 0], [0.3, 0.09], [0, 0.18]], 0.02, TINT, 0.02, 2.12, 0),
      egg(0.07, 0.025, 0.06, 0xffb3c8, -0.35, 0.55, 0.8, PI / 2, 0, 0, 8, 4), egg(0.06, 0.025, 0.05, 0xfff1dc, 0.4, 0.4, 0.8, PI / 2, 0, 0, 8, 4),
    ];
    for (let i = 0; i < 4; i++) { const a = (i * TAU) / 4 + PI / 4; p.push(box(0.16, 0.14, 0.16, SAND, 0.33 * Math.sin(a), 1.92, 0.33 * Math.cos(a))); }
    for (const [x, z] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) {
      p.push(lathe(TOWER, SAND, x, 0.15, z, 14));
      for (let i = 0; i < 4; i++) { const a = (i * TAU) / 4; p.push(box(0.12, 0.12, 0.12, SAND, x + 0.22 * Math.sin(a), 1.15, z + 0.22 * Math.cos(a))); }
      p.push(cyl(0.015, 0.015, 0.32, WOOD_D, x, 1.27, z, 4), vprism([[0, 0], [0.2, 0.06], [0, 0.12]], 0.02, TINT, x + 0.015, 1.45, z));
      p.push(box(0.08, 0.18, 0.04, 0xc99a5c, x, 0.65, z + 0.3));
    }
    for (let i = 0; i < 5; i++) { const x = -0.6 + i * 0.3; p.push(box(0.14, 0.12, 0.14, SAND, x, 0.98, 0.72), box(0.14, 0.12, 0.14, SAND, x, 0.98, -0.72)); }
    return p;
  },
});

def('lifeguard', {
  label: 'Lifeguard Tower', col: { t: 'box', w: 2.7, h: 4.69, d: 3.6 }, fit: 4.5, value: 32, mass: 5,
  tints: [0x5fd3e8, 0xffd23f, 0xff9ec8, 0x8fdcae],
  build: () => {
    const p = [];
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) p.push(tbox(0.12, 2.2, 0.12, WHITE, sx * 1.15, 1.19, sz * 1.15 - 0.2, sz * 0.13, 0, -sx * 0.13));
    for (const s of [-1, 1]) p.push(tbox(0.06, 2.4, 0.06, WHITE, s * 1.15, 1.1, -0.2, 0.75, 0, 0), tbox(0.06, 2.4, 0.06, WHITE, s * 1.15, 1.1, -0.2, -0.75, 0, 0));
    p.push(
      box(2.6, 0.15, 2.6, WOOD, 0, 2.2, -0.2),
      rbox(1.9, 1.35, 1.6, TINT, 0, 2.35, -0.35, 0.06),
      box(1.2, 0.6, 0.04, NAVY, 0, 2.95, 0.46),
      box(1.3, 0.06, 0.08, WHITE, 0, 3.55, 0.47),
      roof(2.5, 0.75, 2.2, 0xff5a5f, 0, 3.7, -0.35),
      cyl(0.02, 0.02, 0.5, STEEL, 0, 4.18, -0.35, 4), vprism([[0, 0], [0.42, 0.1], [0, 0.2]], 0.02, 0xff5a5f, 0.02, 4.5, -0.35),
      tor(0.24, 0.07, 0xff5a3a, 0.65, 2.75, 0.47, 0, 0, 0, 6, 12), tor(0.24, 0.072, WHITE, 0.65, 2.75, 0.47, 0, 0, PI / 4, 6, 4, PI / 2),
      tor(0.24, 0.072, WHITE, 0.65, 2.75, 0.47, 0, 0, PI + PI / 4, 6, 4, PI / 2),
      vprism(heartPts(0.36), 0.04, 0xff5a5f, -0.6, 2.6, 0.47),
    );
    // front deck railing
    for (const x of [-1.25, -0.6, 0.6, 1.25]) p.push(box(0.06, 0.55, 0.06, WHITE, x, 2.35, 1.05));
    p.push(box(2.56, 0.06, 0.06, WHITE, 0, 2.86, 1.05));
    // ladder down to the sand
    for (const s of [-1, 1]) p.push(tbox(0.07, 2.5, 0.07, WOOD_D, s * 0.32, 1.17, 1.5, -0.42));
    for (let i = 0; i < 6; i++) { const y = 0.25 + i * 0.36, z = 1.5 - (y - 1.17) * Math.tan(0.42); p.push(box(0.64, 0.05, 0.1, WOOD_D, 0, y, z)); }
    return C(p);
  },
});

// ======================================================================== KITCHEN
def('cup', {
  label: 'Teacup', col: { t: 'cyl', r: 0.31, h: 0.3 }, fit: 0.62, value: 1, mass: 0.15,
  tints: [0xff9ec8, 0x8fd0ff, 0xa6edc0, 0xffe066, 0xc9b3ff],
  build: () => [
    lathe([[0, 0], [0.22, 0], [0.3, 0.04], [0.31, 0.05], [0.29, 0.055], [0.2, 0.03], [0, 0.03]], TINT, 0, 0, 0, 18),
    lathe([[0, 0.03], [0.1, 0.03], [0.12, 0.05], [0.19, 0.17], [0.205, 0.27], [0.2, 0.28], [0.185, 0.26], [0.17, 0.2], [0, 0.18]], TINT, 0, 0, 0, 18),
    cyl(0.18, 0.18, 0.012, 0xc98a4a, 0, 0.225, 0, 16),
    tor(0.24, 0.012, WHITE, 0, 0.045, 0, PI / 2, 0, 0, 3, 18),
    tor(0.205, 0.012, GOLD, 0, 0.275, 0, PI / 2, 0, 0, 4, 18),
    tor(0.065, 0.018, TINT, 0.215, 0.17, 0, 0, 0, 0, 5, 10),
  ],
});

def('bottle', {
  label: 'Milk Bottle', col: { t: 'cyl', r: 0.2, h: 0.66 }, fit: 0.4, value: 1, mass: 0.15,
  tints: [0xff8fb0, 0x9b6545, 0xffd84a, 0x8fa8ff],
  build: () => [
    lathe([[0, 0], [0.17, 0], [0.19, 0.03], [0.19, 0.38], [0.16, 0.48], [0.09, 0.56], [0.085, 0.6], [0, 0.6]], 0xfffdf6, 0, 0, 0, 16),
    cyl(0.196, 0.196, 0.26, TINT, 0, 0.07, 0, 16),
    vprism(heartPts(0.12), 0.02, WHITE, 0, 0.14, 0.2),
    cyl(0.1, 0.1, 0.06, TINT, 0, 0.595, 0, 12),
  ],
});

def('jar', {
  label: 'Jam Jar', col: { t: 'cyl', r: 0.27, h: 0.57 }, fit: 0.54, value: 1, mass: 0.15,
  tints: [0xe8344f, 0xff9a2e, 0x7a4ad0, 0xffc23a],
  build: () => [
    lathe([[0, 0], [0.22, 0], [0.24, 0.03], [0.24, 0.36], [0.2, 0.42], [0.2, 0.44], [0, 0.44]], TINT, 0, 0, 0, 16),
    cyl(0.245, 0.245, 0.14, CREAM, 0, 0.12, 0, 16),
    vprism(petalPts(5, 0.06), 0.015, TINT, 0, 0.19, 0.247),
    egg(0.26, 0.07, 0.26, WHITE, 0, 0.47, 0, 0, 0, 0, 14, 6),
    tor(0.205, 0.02, TINT, 0, 0.44, 0, PI / 2, 0, 0, 4, 16),
    bead(0.04, TINT, 0.0, 0.45, 0.2),
  ],
});

def('mug', {
  label: 'Mug', col: { t: 'box', w: 0.66, h: 0.48, d: 0.48 }, fit: 0.82, value: 1, mass: 0.15,
  tints: [0xff7aa8, 0x4fa3ff, 0xffd23f, 0x5fd16a, 0xffffff],
  build: () => C([
    lathe([[0, 0], [0.22, 0], [0.235, 0.02], [0.235, 0.46], [0.22, 0.48], [0.205, 0.46], [0.205, 0.4], [0, 0.4]], TINT, 0, 0, 0, 18),
    cyl(0.24, 0.24, 0.06, WHITE, 0, 0.3, 0, 18),
    cyl(0.205, 0.205, 0.02, 0x8a5a3c, 0, 0.4, 0, 16),
    prism(heartPts(0.16).map(([u, v]) => [u, -v]), 0.01, CREAM, 0, 0.42, 0),
    tor(0.13, 0.04, TINT, 0.25, 0.25, 0, 0, 0, 0, 6, 12),
  ]),
});

const PLATE = [[0, 0], [0.3, 0], [0.42, 0.045], [0.44, 0.055], [0.42, 0.06], [0.3, 0.03], [0, 0.03]];
def('platestack', {
  label: 'Plates', col: { t: 'cyl', r: 0.44, h: 0.29 }, fit: 0.88, value: 1, mass: 0.2,
  tints: [0x8fd0ff, 0xff9ec8, 0xa6edc0, 0xffe066],
  build: () => [0, 1, 2, 3, 4].map((i) => lathe(PLATE, i % 2 ? WHITE : TINT, 0, i * 0.055, 0, 20)),
});

def('teapot', {
  label: 'Teapot', col: { t: 'box', w: 1.26, h: 0.68, d: 0.8 }, fit: 1.49, value: 3, mass: 0.3,
  tints: [0x8fd0ff, 0xff9ec8, 0xa6edc0, 0xffe066, 0xc9b3ff],
  build: () => {
    const BODY = [[0, 0], [0.3, 0], [0.36, 0.08], [0.4, 0.25], [0.36, 0.44], [0.26, 0.52], [0, 0.53]];
    const p = [
      lathe(BODY, TINT, 0, 0, 0, 18),
      lathe([[0, 0], [0.22, 0], [0.2, 0.05], [0.1, 0.1], [0, 0.1]], TINT, 0, 0.5, 0, 14),
      bead(0.06, WHITE, 0, 0.62, 0),
      tcyl(0.04, 0.08, 0.4, TINT, 0.47, 0.32, 0, 0, 0, -0.85, 10),
      tor(0.16, 0.04, TINT, -0.4, 0.3, 0, 0, 0, 0, 6, 12),
    ];
    for (const [a, y] of [[0, 0.3], [0.7, 0.17], [-0.7, 0.17], [0.55, 0.4], [-0.55, 0.4], [2.6, 0.28], [-2.6, 0.28]]) {
      const r = lr(BODY, y);
      p.push(egg(0.045, 0.045, 0.015, WHITE, r * Math.sin(a), y, r * Math.cos(a), 0, a, 0, 8, 5));
    }
    return C(p);
  },
});

def('toaster', {
  label: 'Toaster', col: { t: 'box', w: 0.92, h: 0.74, d: 0.5 }, fit: 1.05, value: 2, mass: 0.3,
  tints: [0x9fd8ff, 0xff9ec8, 0xa6edc0, 0xffe066, 0xff6b6b],
  build: () => {
    const p = [
      rbox(0.8, 0.5, 0.48, TINT, 0, 0.05, 0, 0.14),
      rbox(0.82, 0.06, 0.5, SILVER, 0, 0.12, 0, 0.02),
      box(0.05, 0.1, 0.1, SILVER, 0.43, 0.32, 0),
      tcyl(0.05, 0.05, 0.03, SILVER, 0.22, 0.32, 0.245, PI / 2, 0, 0, 10),
    ];
    for (const z of [-0.09, 0.09]) {
      p.push(box(0.6, 0.02, 0.09, INK, 0, 0.535, z));
      p.push(rbox(0.5, 0.36, 0.06, CRUST, 0, 0.38, z, 0.06), box(0.42, 0.27, 0.065, 0xfbe1a8, 0, 0.42, z));
    }
    for (const [x, z] of [[-0.3, -0.16], [0.3, -0.16], [-0.3, 0.16], [0.3, 0.16]]) p.push(cyl(0.04, 0.04, 0.05, STEEL, x, 0, z, 6));
    return p;
  },
});

def('pan', {
  label: 'Frying Pan', col: { t: 'box', w: 1.42, h: 0.15, d: 0.94 }, fit: 1.7, value: 5, mass: 0.3,
  tints: [0xff6b5a, 0x4fa3ff, 0x5fd16a, 0xffd23f],
  build: () => {
    const blob = Array.from({ length: 24 }, (_, i) => {
      const a = (i / 24) * TAU, r = 0.22 * (1 + 0.12 * Math.sin(3 * a) + 0.06 * Math.cos(5 * a));
      return [r * Math.sin(a), r * Math.cos(a)];
    });
    return C([
      lathe([[0, 0], [0.4, 0], [0.46, 0.1], [0.47, 0.12], [0.44, 0.12], [0.4, 0.03], [0, 0.03]], TINT, 0, 0, 0, 22),
      cyl(0.4, 0.4, 0.01, NAVY, 0, 0.03, 0, 18),
      rbox(0.5, 0.06, 0.1, WOOD_D, 0.7, 0.06, 0, 0.03), box(0.08, 0.04, 0.1, STEEL, 0.47, 0.07, 0),
      prism(blob, 0.03, WHITE, -0.02, 0.04, 0.02, 0.008),
      egg(0.08, 0.045, 0.08, 0xffb52e, 0.0, 0.08, 0.03, 0, 0, 0, 12, 6),
    ]);
  },
});

def('fruitbowl', {
  label: 'Fruit Bowl', col: { t: 'cyl', r: 0.6, h: 0.64 }, fit: 1.2, value: 2, mass: 0.3,
  tints: [0xfffaf4, 0x8fd0ff, 0xff9ec8, 0xffe066, 0xa6edc0],
  build: () => {
    const R = 0.42, arc = 1.6, b = arc / 2 - PI / 2;
    return [
      lathe([[0, 0], [0.3, 0], [0.32, 0.04], [0.55, 0.3], [0.6, 0.36], [0.56, 0.37], [0.5, 0.3], [0, 0.15]], TINT, 0, 0, 0, 20),
      ball(0.17, 0xff9a2e, -0.18, 0.18, 0.08, 1), ball(0.16, 0xff4a4a, 0.17, 0.18, 0.1, 1), ball(0.14, 0x8ad94a, 0.0, 0.2, -0.18, 1),
      custom(xf(shapedTorus(R * 0.6, 0.07, arc, (t) => 0.45 + 0.55 * Math.sin(PI * t) ** 0.6, 5, 12), 0, 0.5, -0.12, PI / 2, b), 0xffe14a),
      ...[[-0.25, -0.15], [-0.32, -0.02], [-0.22, -0.28]].map(([x, z]) => ball(0.07, 0x9b59d0, x, 0.32, z, 1)),
    ];
  },
});

def('mixer', {
  label: 'Stand Mixer', col: { t: 'box', w: 0.86, h: 0.96, d: 0.5 }, fit: 0.99, value: 2, mass: 0.4,
  tints: [0xff8fb0, 0x8fe0c8, 0xffd84a, 0x9fc8ff, 0xff6b6b],
  build: () => C([
    rbox(0.8, 0.14, 0.5, TINT, 0, 0, 0, 0.06),
    rbox(0.2, 0.62, 0.3, TINT, -0.26, 0.1, 0, 0.08),
    capsule(0.17, 0.5, TINT, 0, 0.78, 0, PI / 2),
    tor(0.172, 0.02, SILVER, 0.18, 0.78, 0, 0, PI / 2, 0, 4, 14),
    lathe([[0, 0], [0.13, 0], [0.2, 0.08], [0.24, 0.3], [0.25, 0.32], [0.23, 0.32], [0.22, 0.3], [0, 0.22]], SILVER, 0.15, 0.14, 0, 16),
    egg(0.17, 0.08, 0.17, CREAM, 0.15, 0.42, 0, 0, 0, 0, 12, 6),
    tcyl(0.02, 0.02, 0.2, STEEL, 0.15, 0.55, 0, 0, 0, 0, 5),
  ]),
});

def('fridge', {
  label: 'Fridge', col: { t: 'box', w: 2.0, h: 4.08, d: 1.76 }, fit: 2.67, value: 11, mass: 4,
  tints: [0x9fecc9, 0xffb3c8, 0xfff1c8, 0x9fd2ff],
  build: () => {
    const p = [
      rbox(2.0, 3.4, 1.6, TINT, 0, 0.15, 0, 0.3),
      box(1.98, 0.04, 0.02, SILVER, 0, 2.5, 0.8),
      rbox(0.1, 0.9, 0.12, SILVER, -0.75, 1.2, 0.82, 0.04), rbox(0.1, 0.4, 0.12, SILVER, -0.75, 2.75, 0.82, 0.04),
      rbox(0.7, 0.18, 0.04, SILVER, 0.3, 3.15, 0.8, 0.06),
      vprism(heartPts(0.3), 0.04, 0xff5a8a, 0.4, 1.9, 0.81),
      vprism(starPts(5, 0.14, 0.06).map(([x, z]) => [x, -z]), 0.04, 0xffd23f, -0.2, 1.55, 0.81),
      vprism(petalPts(6, 0.14), 0.04, 0x4fa3ff, 0.5, 1.2, 0.81), bead(0.05, 0xffd23f, 0.5, 1.2, 0.83),
      box(0.36, 0.46, 0.02, WHITE, 0.0, 0.85, 0.81),
      lathe([[0, 0], [0.22, 0], [0.26, 0.24], [0, 0.24]], 0xff8a5a, 0.4, 3.55, -0.2, 12),
      egg(0.24, 0.16, 0.24, LEAF, 0.4, 3.92, -0.2, 0, 0, 0, 12, 7),
    ];
    for (const [x, z] of [[-0.8, -0.6], [0.8, -0.6], [-0.8, 0.6], [0.8, 0.6]]) p.push(cyl(0.07, 0.07, 0.15, STEEL, x, 0, z, 8));
    return p;
  },
});

def('stove', {
  label: 'Stove', col: { t: 'box', w: 3.4, h: 3.13, d: 2.24 }, fit: 4.07, value: 26, mass: 6,
  tints: [0x9fd8c8, 0xffb3c8, 0xfff1c8, 0x9fc8ff, 0xff6b6b],
  build: () => {
    const p = [
      rbox(3.4, 2.0, 2.0, TINT, 0, 0.15, 0, 0.18),
      box(3.3, 0.06, 1.9, SILVER, 0, 2.12, -0.02),
      box(3.4, 0.75, 0.22, CREAM, 0, 2.15, -0.89),
      tcyl(0.22, 0.22, 0.04, WHITE, 0, 2.55, -0.77, PI / 2, 0, 0, 16), tor(0.22, 0.03, SILVER, 0, 2.55, -0.76, 0, 0, 0, 4, 16),
      box(0.02, 0.15, 0.03, INK, 0, 2.6, -0.74), box(0.11, 0.02, 0.03, INK, 0.05, 2.55, -0.74),
      box(2.1, 1.2, 0.06, CREAM, -0.4, 0.4, 1.0),
      box(1.5, 0.66, 0.07, 0xffa95a, -0.4, 0.62, 1.01),
      box(1.2, 0.08, 0.1, WOOD_D, -0.4, 1.12, 1.03),
      tcyl(0.04, 0.04, 1.7, SILVER, -0.4, 1.46, 1.08, 0, 0, PI / 2, 8),
      box(0.9, 1.2, 0.06, CREAM, 1.1, 0.4, 1.0), box(0.1, 0.4, 0.08, SILVER, 0.75, 0.8, 1.04),
    ];
    for (let i = 0; i < 6; i++) p.push(tcyl(0.09, 0.09, 0.08, SILVER, -1.25 + i * 0.5, 1.82, 1.02, PI / 2, 0, 0, 8));
    for (const [x, z] of [[-1.05, -0.4], [1.05, -0.4], [-1.05, 0.45], [1.05, 0.45]]) p.push(cyl(0.38, 0.38, 0.03, NAVY, x, 2.18, z, 12), tor(0.25, 0.03, STEEL, x, 2.22, z, PI / 2, 0, 0, 3, 12));
    // kettle (back left) and a little pot (front right)
    p.push(lathe([[0, 0], [0.32, 0], [0.38, 0.15], [0.34, 0.4], [0.2, 0.52], [0, 0.54]], WHITE, -1.05, 2.21, -0.4, 16),
      tcyl(0.04, 0.08, 0.34, WHITE, -0.68, 2.5, -0.4, 0, 0, -1.0, 8), tor(0.22, 0.035, NAVY, -1.05, 2.75, -0.4, 0, 0, 0, 5, 12, PI), bead(0.05, NAVY, -1.05, 2.76, -0.4));
    p.push(cyl(0.34, 0.34, 0.38, 0xff5a5f, 1.05, 2.21, 0.45, 16), cyl(0.36, 0.36, 0.05, 0xff5a5f, 1.05, 2.59, 0.45, 16), bead(0.06, NAVY, 1.05, 2.69, 0.45),
      tbox(0.3, 0.05, 0.08, NAVY, 1.55, 2.5, 0.45));
    p.push(egg(0.12, 0.18, 0.12, 0xffffff, 1.05, 2.92, 0.45, 0, 0, 0, 8, 6), egg(0.09, 0.13, 0.09, 0xffffff, 1.12, 3.0, 0.4, 0, 0, 0, 8, 6));
    for (const [x, z] of [[-1.4, -0.8], [1.4, -0.8], [-1.4, 0.8], [1.4, 0.8]]) p.push(cyl(0.08, 0.08, 0.15, STEEL, x, 0, z, 8));
    return p;
  },
});

export const COZY_WORLDS = {
  bakery: ['sprinkle', 'candy', 'gumdrop', 'macaron', 'cookie', 'donut', 'cupcake', 'icecream', 'croissant', 'cakeslice', 'lollipop', 'pie', 'cake', 'layercake', 'gingerhouse'],
  picnic: ['grape', 'cherry', 'strawberry', 'lemon', 'apple', 'orange', 'banana', 'grapes', 'juicebox', 'sandwich', 'melonslice', 'watermelon', 'blanketroll', 'basket', 'fruitcart'],
  playroom: ['block', 'toyball', 'duck', 'crayon', 'stackrings', 'rocket', 'toycar', 'robot', 'traincar', 'locomotive', 'teddy', 'rockinghorse', 'dollhouse', 'playcastle'],
  garden: ['tulip', 'daisy', 'mushroom', 'gnome', 'potplant', 'birdhouse', 'wateringcan', 'pumpkin', 'hedge', 'gardenbench', 'gardenfountain', 'gazebo'],
  beach: ['shell', 'starfish', 'bucket', 'parasol', 'spade', 'crab', 'beachball', 'lifering', 'deckchair', 'surfboard', 'sandcastle', 'lifeguard'],
  kitchen: ['cup', 'bottle', 'jar', 'mug', 'platestack', 'toaster', 'teapot', 'mixer', 'fruitbowl', 'pan', 'fridge', 'stove'],
};
