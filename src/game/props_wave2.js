// Season 2 prop pack: Candy Land, Sunny Farm and Snowy Village.
// Same style and conventions as props_cozy.js: glossy toy/food look from code geometry
// only (no external art), base at y=0, centered on the collider, fronts face +z (the
// camera), vehicles point +x. `fit` = smallest hole diameter that swallows it,
// `value` ~ 1.6*fit^2. tools/check_levels.mjs validates every prop.
import * as THREE from 'three';
import { def } from './props.js';
import { box, rbox, cyl, cone, ball, roof, custom, TINT } from './geo.js';

const TAU = Math.PI * 2, PI = Math.PI;

// ------------------------------------------------------------------ palette
const WHITE = 0xfffaf4, ICING = 0xfffcf7, CREAM = 0xfff0d4, INK = 0x3b2d3f, BLUSH = 0xff9eb8;
const CHOC = 0x6e3f2b, CHOC_D = 0x53301f, CHOC_L = 0x8a5a44, CHERRY = 0xf0263f, PEPPER = 0xf2334f;
const WAFER = 0xf0c27a, WAFER_D = 0xcf9a52, GINGER = 0xc47b3f, GINGER_D = 0x9c5a2a;
const LEAF = 0x5cc46b, LEAF_D = 0x3d9a52, STEM = 0x7a5a32;
const WOOD = 0xd39a5e, WOOD_D = 0x9e6a3e, WOOD_L = 0xeec58e, LOG_END = 0xf0cf98;
const STEEL = 0xaab4c4, SILVER = 0xe1e7ef, GOLD = 0xffc94a, TIRE = 0x3a3646, NAVY = 0x3a3f52;
const WARM = 0xffd77a, SKIN = 0xffd3b4, STONE = 0xc9c1b8, STONE_D = 0xa8a097;
const STRAW = 0xf2cf6b, STRAW_D = 0xd6a644, SOIL = 0x8a5a3c, BURLAP = 0xe6c595, MUZZLE = 0xffb9c6, HOOF = 0x5a4038;
const SNOW = 0xf7fbff, SNOW_S = 0xe4eef9, COAL = 0x3b3646, CARROT = 0xff8a2a;
const SPRINK = [0xff5c8a, 0x5cc8ff, 0xffd23f, 0x7be07a, 0xb48cff, 0xff9a3a, 0xffffff];
const GUMS = [0xff4a5a, 0xffd23f, 0x4fb8ff, 0x6fd16a, 0xff9a3a, 0xb07cff, 0xff7ac0, 0xffffff];

// ------------------------------------------------------------------ local helpers
// (the first block mirrors props_cozy.js so both packs build shapes the same way)
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
// Tiny faceted speck (sugar, snow, fairy lights), centered.
const spark = (r, col, x, y, z) => ball(r, col, x, y - r, z, 0);
const tcyl = (rt, rb, h, col, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, seg = 12) =>
  custom(xf(new THREE.CylinderGeometry(rt, rb, h, seg), x, y, z, rx, ry, rz), col);
const tbox = (w, h, d, col, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) =>
  custom(xf(new THREE.BoxGeometry(w, h, d), x, y, z, rx, ry, rz), col);
// Torus centered at (x,y,z); lies flat by default (rx = PI/2). arc < TAU gives a partial ring.
const tor = (R, t, col, x = 0, y = 0, z = 0, rx = PI / 2, ry = 0, rz = 0, rs = 6, ts = 16, arc = TAU) =>
  custom(xf(new THREE.TorusGeometry(R, t, rs, ts, arc), x, y, z, rx, ry, rz), col);
// Lathe from [radius, height] pairs listed bottom to top (outward-facing). Base at y.
const latheGeo = (pts, seg = 16, phi0 = 0, phiLen = TAU) => new THREE.LatheGeometry(pts.map(([r, h]) => new THREE.Vector2(r, h)), seg, phi0, phiLen);
const lathe = (pts, col, x = 0, y = 0, z = 0, seg = 16) => custom(latheGeo(pts, seg).translate(x, y, z), col);
// Radius of a lathe profile at height y (for seating details on a surface).
function lr(pts, y) {
  for (let i = 1; i < pts.length; i++) {
    const [r0, y0] = pts[i - 1], [r1, y1] = pts[i];
    if ((y >= y0 && y <= y1) || (y <= y0 && y >= y1)) return y1 === y0 ? r1 : r0 + (r1 - r0) * (y - y0) / (y1 - y0);
  }
  return 0;
}
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
// Re-center a part list on x/z so the collider sits in the middle of the shape.
function C(parts) {
  parts = parts.flat().filter(Boolean);
  const bb = new THREE.Box3();
  for (const g of parts) { g.computeBoundingBox(); bb.union(g.boundingBox); }
  const cx = (bb.min.x + bb.max.x) / 2, cz = (bb.min.z + bb.max.z) / 2;
  for (const g of parts) g.translate(-cx, 0, -cz);
  return parts;
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

// ---- new in this pack
const _lin = new THREE.Color();
// A TINT part in a darker (gray < white) and/or paler (mask < 1) shade of the instance
// color: the prop shader multiplies the vertex color by mix(1, tint, tmask).
function shade(g, gray = 0xb4b4b4, mask = 1) {
  _lin.set(gray);
  const c = g.attributes.color, m = g.attributes.tmask;
  for (let i = 0; i < c.count; i++) { c.setXYZ(i, _lin.r, _lin.g, _lin.b); m.setX(i, mask); }
  return g;
}
const pale = (g, mask = 0.5) => shade(g, 0xffffff, mask);
// Paint one raw geometry in two colors, triangle by triangle: pick(x, y, z, u, v) at the
// triangle's centroid chooses colA, otherwise colB. Stripes, swirls and spots for free.
function two(geo, pick, colA, colB) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv;
  const out = [[[], []], [[], []]];
  for (let i = 0; i < P.count; i += 3) {
    let x = 0, y = 0, z = 0, u = 0, v = 0;
    for (let k = 0; k < 3; k++) {
      x += P.getX(i + k); y += P.getY(i + k); z += P.getZ(i + k);
      if (U) { u += U.getX(i + k); v += U.getY(i + k); }
    }
    const o = out[pick(x / 3, y / 3, z / 3, u / 3, v / 3) ? 0 : 1];
    for (let k = 0; k < 3; k++) {
      o[0].push(P.getX(i + k), P.getY(i + k), P.getZ(i + k));
      o[1].push(N.getX(i + k), N.getY(i + k), N.getZ(i + k));
    }
  }
  return out.map(([p, n], s) => {
    if (!p.length) return null;
    const b = new THREE.BufferGeometry();
    b.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    b.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3));
    return custom(b, s ? colB : colA);
  });
}
// Keep only the triangles that pass `keep` (centroid test) and turn them inside out, so
// a glass shell shows its inner face from the front.
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
// Thin bar between two points in the XY plane at depth z (trims, braces, icing lines).
function bar(x0, y0, x1, y1, z, w, t, col) {
  return tbox(Math.hypot(x1 - x0, y1 - y0), w, t, col, (x0 + x1) / 2, (y0 + y1) / 2, z, 0, 0, Math.atan2(y1 - y0, x1 - x0));
}
// Cute face on a surface facing +z: ink eyes with a sparkle, blush, little smile.
function face(x, y, z, dx = 0.06, er = 0.022, smile = true) {
  const p = [];
  for (const s of [-1, 1]) {
    p.push(bead(er, INK, x + s * dx, y, z), spark(er * 0.32, 0xffffff, x + s * dx - er * 0.35, y + er * 0.4, z + er * 0.85));
    p.push(egg(er * 1.25, er * 0.7, er * 0.45, BLUSH, x + s * dx * 1.75, y - er * 1.7, z - er * 0.5, 0, s * 0.45, 0, 6, 4));
  }
  if (smile) p.push(tor(dx * 0.5, er * 0.36, INK, x, y - er * 1.5, z + er * 0.1, 0, 0, PI, 4, 8, PI));
  return p;
}
// Pinwheel disc facing +z (peppermint windows, little lollipops).
const pinwheel = (r, t, colA, colB, x, y, z, n = 8) =>
  two(new THREE.CylinderGeometry(r, r, t, n * 3).rotateX(PI / 2).translate(x, y, z),
    (px, py) => ((Math.atan2(py - y, px - x) / TAU) * n + n + 0.5) % 1 < 0.5, colA, colB);

// ======================================================================== CANDY
// Ellipsoid bent into a kidney bean (bows toward -z).
function bean(a, b, c, bend, col, x, y, z) {
  const g = new THREE.SphereGeometry(1, 14, 8).scale(a, b, c);
  const P = g.attributes.position;
  for (let i = 0; i < P.count; i++) { const u = P.getX(i) / a; P.setZ(i, P.getZ(i) - bend * (1 - u * u)); }
  return custom(g.translate(x, y, z), col);
}
def('jellybean', {
  label: 'Jelly Bean', col: { t: 'box', w: 0.38, h: 0.2, d: 0.22 }, fit: 0.44, value: 1, mass: 0.15,
  tints: [0xff3b5c, 0xff9a2e, 0xffd93a, 0x6fd44a, 0xa86bff, 0xff7ac0, 0x4fb8ff],
  build: () => C([
    bean(0.19, 0.1, 0.1, 0.05, TINT, 0, 0.1, 0),
    egg(0.065, 0.014, 0.024, 0xffffff, -0.05, 0.193, -0.035, 0, 0.35, 0, 8, 4),
  ]),
});

const MALLOW = [[0, 0], [0.16, 0], [0.195, 0.02], [0.21, 0.07], [0.21, 0.27], [0.195, 0.32], [0.16, 0.34], [0, 0.34]];
def('marshmallow', {
  label: 'Marshmallow', col: { t: 'cyl', r: 0.21, h: 0.34 }, fit: 0.42, value: 1, mass: 0.15,
  tints: [0xfff6ee, 0xffb8d6, 0xb8f0d8, 0xffeb9c, 0xd6c4ff, 0xa8dcff],
  build: () => [lathe(MALLOW, TINT, 0, 0, 0, 16), ...face(0, 0.2, 0.198, 0.06, 0.022)],
});

def('peppermint', {
  label: 'Peppermint', col: { t: 'cyl', r: 0.25, h: 0.13 }, fit: 0.5, value: 1, mass: 0.15,
  tints: [0xf2334f, 0x2fb36a, 0xff6fb5, 0x3f8dff, 0x9b6bff],
  build: () => {
    const prof = [[0, 0], [0.22, 0], [0.245, 0.02], [0.25, 0.05], [0.24, 0.08], [0.2, 0.105], [0.14, 0.121], [0.07, 0.128], [0, 0.13]];
    // six swirled stripes, like a starlight mint
    return two(latheGeo(prof, 36), (x, y, z) => ((Math.atan2(x, z) / TAU) * 6 + Math.hypot(x, z) * 3.4 + 6) % 1 < 0.5, TINT, WHITE);
  },
});

def('gummybear', {
  label: 'Gummy Bear', col: { t: 'box', w: 0.52, h: 0.82, d: 0.36 }, fit: 0.63, value: 1, mass: 0.15,
  tints: [0xff3b5c, 0xff9a2e, 0xffd23a, 0x6fd44a, 0xa86bff, 0xff7ac0],
  build: () => C([
    egg(0.19, 0.21, 0.15, TINT, 0, 0.29, 0, 0, 0, 0, 12, 9),
    egg(0.12, 0.13, 0.05, TINT, 0, 0.27, 0.11, 0, 0, 0, 10, 6),
    ...[-1, 1].flatMap((s) => [
      egg(0.085, 0.08, 0.11, TINT, s * 0.1, 0.08, 0.05, 0, 0, 0, 10, 6),
      egg(0.065, 0.11, 0.065, TINT, s * 0.185, 0.34, 0.04, 0.3, 0, s * 0.55, 8, 6),
      egg(0.06, 0.06, 0.045, TINT, s * 0.12, 0.755, -0.01, 0, 0, 0, 8, 5),
    ]),
    egg(0.16, 0.15, 0.13, TINT, 0, 0.6, 0, 0, 0, 0, 12, 9),
    egg(0.07, 0.05, 0.05, TINT, 0, 0.555, 0.11, 0, 0, 0, 8, 5),
    bead(0.022, INK, 0, 0.575, 0.158),
    bead(0.021, INK, -0.06, 0.63, 0.118), bead(0.021, INK, 0.06, 0.63, 0.118),
    spark(0.007, 0xffffff, -0.067, 0.638, 0.137), spark(0.007, 0xffffff, 0.053, 0.638, 0.137),
  ]),
});

// Standing cane planted in a dollop of frosting, diagonal stripes painted on the tube.
def('candycane', {
  label: 'Candy Cane', col: { t: 'box', w: 0.62, h: 1.24, d: 0.42 }, fit: 0.75, value: 1, mass: 0.15,
  tints: [0xf2334f, 0x2fb36a, 0xff6fb5, 0x3f8dff, 0x9b6bff],
  build: () => {
    const hr = 0.17, top = 1.0, rad = 0.07;
    const pts = [new THREE.Vector3(0, 0.05, 0), new THREE.Vector3(0, 0.55, 0), new THREE.Vector3(0, top, 0)];
    for (let i = 1; i <= 8; i++) { const a = PI - (i / 8) * PI; pts.push(new THREE.Vector3(hr + hr * Math.cos(a), top + hr * Math.sin(a), 0)); }
    pts.push(new THREE.Vector3(2 * hr, top - 0.13, 0));
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    const L = curve.getLength(), end = curve.getPoint(1);
    const p = [
      ...two(new THREE.TubeGeometry(curve, 56, rad, 8, false), (x, y, z, u, v) => ((u * L) / 0.26 + v) % 1 < 0.42, TINT, WHITE),
      bead(rad * 0.98, WHITE, end.x, end.y, end.z),
      egg(0.21, 0.085, 0.21, ICING, 0, 0.085, 0, 0, 0, 0, 12, 6),
    ];
    [[0.6, 0.13], [2.0, 0.15], [3.4, 0.12], [4.6, 0.15], [5.6, 0.11]].forEach(([a, r], i) => {
      const y = 0.085 + 0.085 * Math.sqrt(1 - (r / 0.21) ** 2);
      p.push(tbox(0.06, 0.018, 0.018, SPRINK[i], r * Math.sin(a), y, r * Math.cos(a), 0, a * 1.7, 0));
    });
    return C(p);
  },
});

def('cottoncandy', {
  label: 'Cotton Candy', col: { t: 'cyl', r: 0.4, h: 1.16 }, fit: 0.8, value: 1, mass: 0.15,
  tints: [0xffa6d2, 0xa6d8ff, 0xd2b8ff, 0xa6f0d2, 0xfff0a0],
  build: () => {
    const coneG = new THREE.CylinderGeometry(0.17, 0.025, 0.52, 14).translate(0, 0.31, 0);
    const p = [
      cyl(0.14, 0.16, 0.05, WOOD_L, 0, 0, 0, 12),
      ...two(coneG, (x, y, z) => ((Math.atan2(x, z) / TAU) * 3 + y * 3.2 + 3) % 1 < 0.35, null, WHITE).map((g, i) => (g && i === 0 ? pale(g, 0.6) : g)),
    ];
    [[0, 0.85, 0, 0.3, 0.27], [0.2, 0.8, 0.08, 0.19, 0.17], [-0.2, 0.8, 0.06, 0.19, 0.17], [0.04, 0.79, -0.2, 0.19, 0.16],
      [-0.1, 0.99, 0.11, 0.17, 0.15], [0.13, 0.99, -0.07, 0.16, 0.14], [0.0, 0.72, 0.2, 0.16, 0.13]]
      .forEach(([x, y, z, a, b]) => p.push(egg(a, b, a, TINT, x, y, z, 0, 0, 0, 10, 7)));
    return p;
  },
});

// Big standing lollipop with a two-armed swirl on both faces.
def('swirlpop', {
  label: 'Swirl Pop', col: { t: 'box', w: 0.96, h: 2.04, d: 0.44 }, fit: 1.06, value: 2, mass: 0.2,
  tints: [0xff4f6d, 0x9b6bff, 0x3fb8ff, 0x5fd16a, 0xffa23a, 0xff7ac0],
  build: () => {
    const R = 0.48, cy = 1.56;
    const prof = [[R, 0], [R, 0.015], [0.465, 0.032], [0.42, 0.045], [0.34, 0.053], [0.24, 0.058], [0.12, 0.06], [0, 0.06]];
    const p = [
      egg(0.22, 0.09, 0.22, ICING, 0, 0.09, 0, 0, 0, 0, 12, 6),
      tcyl(0.035, 0.035, 1.12, WHITE, 0, 0.62, 0, 0, 0, 0, 8),
      egg(0.09, 0.05, 0.035, TINT, -0.07, 1.12, 0.03, 0, 0, 0.5, 8, 5), egg(0.09, 0.05, 0.035, TINT, 0.07, 1.12, 0.03, 0, 0, -0.5, 8, 5),
      bead(0.035, TINT, 0, 1.12, 0.04),
    ];
    for (const s of [1, -1]) {
      const g = latheGeo(prof, 30);
      p.push(...two(g, (x, y, z) => ((Math.atan2(x, z) * s / TAU) * 2 + (Math.hypot(x, z) / R) * 1.6 + 4) % 1 < 0.5, TINT, WHITE)
        .filter(Boolean).map((q) => { if (s < 0) q.rotateX(PI); return q.rotateX(PI / 2).translate(0, cy, 0); }));
    }
    return p;
  },
});

def('chocbar', {
  label: 'Chocolate Bar', col: { t: 'box', w: 0.98, h: 0.15, d: 0.52 }, fit: 1.11, value: 2, mass: 0.15,
  tints: [0xe8344f, 0x3f7fe0, 0x8a5ad0, 0x2fb3a8, 0xff6fa8, 0xffa52e],
  build: () => {
    const p = [
      box(0.56, 0.08, 0.46, CHOC_D, 0.2, 0, 0),
      box(0.05, 0.125, 0.5, SILVER, -0.07, 0, 0),
      rbox(0.47, 0.15, 0.52, TINT, -0.255, 0, 0, 0.05),
      box(0.07, 0.152, 0.525, WHITE, -0.4, 0, 0),
      prism(heartPts(0.16).map(([u, v]) => [u, -v]), 0.012, WHITE, -0.22, 0.15, 0),
    ];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) p.push(box(0.15, 0.04, 0.19, CHOC, 0.02 + i * 0.18, 0.08, (j - 0.5) * 0.215));
    return C(p);
  },
});

def('gumballmachine', {
  label: 'Gumball Machine', col: { t: 'cyl', r: 0.5, h: 1.68 }, fit: 1.0, value: 2, mass: 0.3,
  tints: [0xe8423c, 0x3f7fe0, 0xff6fa8, 0x2fb3a8, 0x9b6bff],
  build: () => {
    const R = 0.46, cy = 0.62 + R - 0.04;
    const p = [
      lathe([[0, 0], [0.32, 0], [0.33, 0.03], [0.3, 0.08], [0.23, 0.12], [0.2, 0.5], [0.25, 0.56], [0.25, 0.64], [0, 0.64]], TINT, 0, 0, 0, 16),
      tcyl(0.09, 0.09, 0.04, SILVER, 0, 0.38, 0.2, PI / 2, 0, 0, 12), box(0.035, 0.12, 0.03, STEEL, 0, 0.32, 0.225),
      box(0.12, 0.08, 0.06, NAVY, 0, 0.15, 0.19), bead(0.04, GUMS[0], 0, 0.19, 0.24),
      egg(R, R, R, 0xe2f4ff, 0, cy, 0, 0, 0, 0, 14, 10),
      lathe([[0.25, 0], [0.235, 0.07], [0.16, 0.12], [0, 0.14]], TINT, 0, cy + R - 0.07, 0, 16),
      bead(0.05, TINT, 0, cy + R + 0.11, 0),
      tor(R * 0.8, 0.02, 0xffffff, -0.05, cy + 0.08, 0.2, -0.35, -0.4, 0, 3, 8, 0.9),
    ];
    // gumballs pressed against the glass, the dome three-quarters full
    for (let i = 0, N = 30; i < N; i++) {
      const yy = 1 - ((i + 0.5) / N) * 2;
      if (yy > 0.45) continue;
      const rr = Math.sqrt(1 - yy * yy), th = i * 2.39996, q = R - 0.035;
      p.push(egg(0.085, 0.085, 0.085, GUMS[i % GUMS.length], q * rr * Math.sin(th), cy + q * yy, q * rr * Math.cos(th), 0, 0, 0, 6, 4));
    }
    return p;
  },
});

// Three tiers of mini cupcakes; the frosting takes the tint.
const CASES = [0xffc4dd, 0xbfe6ff, 0xc9f2dc, 0xfff0b0];
const miniCupcake = (x, y, z, s, k) => [
  cyl(0.15 * s, 0.11 * s, 0.15 * s, CASES[k % 4], x, y, z, 10),
  egg(0.165 * s, 0.11 * s, 0.165 * s, TINT, x, y + 0.2 * s, z, 0, 0, 0, 8, 5),
  spark(0.05 * s, CHERRY, x, y + 0.34 * s, z),
];
def('cupcaketower', {
  label: 'Cupcake Tower', col: { t: 'cyl', r: 1.25, h: 2.16 }, fit: 2.5, value: 10, mass: 1.2,
  tints: [0xffa6c9, 0xa6edd2, 0xd2bcff, 0xffe58a, 0xa6d8ff],
  build: () => {
    const PLATE = 0xfff4fa;
    const plate = (R, y) => lathe([[0, 0], [R - 0.06, 0], [R, 0.05], [R - 0.02, 0.07], [R - 0.08, 0.045], [0, 0.045]], PLATE, 0, y, 0, 20);
    const p = [
      lathe([[0, 0], [0.45, 0], [0.43, 0.06], [0.14, 0.12], [0.08, 0.2], [0, 0.2]], PLATE, 0, 0, 0, 16),
      cyl(0.05, 0.05, 1.36, GOLD, 0, 0.2, 0, 8),
      plate(1.25, 0.2), plate(0.86, 0.85), plate(0.48, 1.5),
    ];
    for (let i = 0; i < 7; i++) { const a = (i * TAU) / 7 + 0.2; p.push(...miniCupcake(0.95 * Math.sin(a), 0.245, 0.95 * Math.cos(a), 1, i)); }
    for (let i = 0; i < 5; i++) { const a = (i * TAU) / 5; p.push(...miniCupcake(0.58 * Math.sin(a), 0.895, 0.58 * Math.cos(a), 1, i + 1)); }
    p.push(...miniCupcake(0, 1.545, 0, 1.6, 2));
    return p;
  },
});

def('candyhouse', {
  label: 'Candy Cottage', col: { t: 'box', w: 2.62, h: 2.42, d: 2.2 }, fit: 3.42, value: 19, mass: 3,
  tints: [0xffb3d1, 0xa6e3ff, 0xbfeea0, 0xd8c4ff, 0xfff0a0],
  build: () => {
    const WY = 0.12, top = 1.42, RH = 0.9, HW = 1.25, ang = Math.atan2(RH, HW), SL = Math.hypot(RH, HW);
    const p = [
      rbox(2.6, 0.12, 2.2, ICING, 0, 0, 0, 0.05),
      rbox(2.0, top - WY, 1.6, TINT, 0, WY, -0.1, 0.08),
      roof(2 * HW, RH, 2.0, WAFER, 0, top, -0.1),
    ];
    // waffle grid on both slopes
    for (const s of [-1, 1]) {
      const nx = s * Math.sin(ang) * 0.012, ny = Math.cos(ang) * 0.012;
      for (const t of [0.25, 0.5, 0.75]) p.push(tbox(0.035, 0.03, 2.0, WAFER_D, s * HW * (1 - t) + nx, top + RH * t + ny, -0.1, 0, 0, -s * ang));
      for (const z of [-0.85, -0.45, -0.05, 0.35, 0.75]) p.push(tbox(SL, 0.03, 0.035, WAFER_D, s * HW / 2 + nx, top + RH / 2 + ny, z, 0, 0, -s * ang));
      // icing along the eaves, with drips
      p.push(tcyl(0.06, 0.06, 2.05, ICING, s * HW, top, -0.1, PI / 2, 0, 0, 8));
      for (const z of [-0.75, -0.15, 0.45]) p.push(egg(0.05, 0.1, 0.05, ICING, s * (HW + 0.02), top - 0.08, z, 0, 0, 0, 8, 5));
      // icing on the front gable edges
      p.push(bar(s * HW, top, 0, top + RH, 0.92, 0.09, 0.08, ICING));
    }
    // chocolate-bar door with a round top
    p.push(box(0.56, 0.72, 0.06, CHOC, 0, WY, 0.71),
      custom(new THREE.CylinderGeometry(0.28, 0.28, 0.06, 12, 1, false, -PI / 2, PI).rotateX(PI / 2).translate(0, WY + 0.72, 0.71), CHOC),
      bead(0.04, GOLD, 0.17, WY + 0.38, 0.75));
    for (let j = 0; j < 3; j++) for (const s of [-1, 1]) p.push(box(0.2, 0.18, 0.03, CHOC_L, s * 0.12, WY + 0.08 + j * 0.24, 0.745));
    // peppermint windows (front and sides) and one in the gable
    for (const s of [-1, 1]) p.push(...pinwheel(0.2, 0.05, PEPPER, WHITE, s * 0.62, 0.8, 0.72));
    p.push(...pinwheel(0.17, 0.05, PEPPER, WHITE, 0, top + 0.36, 0.92));
    for (const s of [-1, 1]) p.push(...pinwheel(0.2, 0.05, PEPPER, WHITE, 0, 0.8, 0).map((g) => g && g.rotateY(PI / 2).translate(s * 1.01, 0, -0.1)));
    // marshmallow chimney and gumdrops on the ridge
    p.push(lathe(MALLOW.map(([r, h]) => [r * 1.25, h * 1.4]), 0xffc4dd, 0.62, top + 0.35, -0.55, 14));
    [0xff4f6d, 0x6fd65a, 0xffd84a, 0x9b6bff].forEach((c, i) => p.push(bead(0.09, c, 0, top + RH + 0.02, -0.85 + i * 0.5)));
    // two little pinwheel lollipops by the door
    for (const s of [-1, 1]) {
      p.push(tcyl(0.025, 0.025, 0.72, WHITE, s * 1.02, WY + 0.36, 0.86, 0, 0, 0, 6));
      p.push(...pinwheel(0.19, 0.06, s < 0 ? 0xff5a8a : 0x5ad1ff, WHITE, s * 1.02, WY + 0.9, 0.86));
    }
    return p.filter(Boolean);
  },
});

def('cottoncastle', {
  label: 'Cotton Candy Castle', col: { t: 'box', w: 4.6, h: 4.86, d: 3.7 }, fit: 5.9, value: 56, mass: 8,
  tints: [0xffa6d2, 0xa6d8ff, 0xd2b8ff, 0xa6f0d2],
  build: () => {
    const WALL = 0xfff6fb, KZ = -0.35;
    const p = [
      box(4.6, 0.14, 3.7, ICING),
      rbox(2.7, 1.7, 1.8, TINT, 0, 0.14, KZ, 0.1),
      box(3.0, 1.0, 0.36, WALL, 0, 0.14, 1.15),
      box(0.36, 0.9, 1.9, WALL, -1.75, 0.14, 0), box(0.36, 0.9, 1.9, WALL, 1.75, 0.14, 0),
      // gate
      box(0.62, 0.62, 0.05, CHOC, 0, 0.14, 1.34),
      custom(new THREE.CylinderGeometry(0.31, 0.31, 0.05, 12, 1, false, -PI / 2, PI).rotateX(PI / 2).translate(0, 0.76, 1.34), CHOC),
      vprism(heartPts(0.34), 0.04, TINT, 0, 0.9, 1.35),
    ];
    // marshmallow crenellations on the curtain wall and the keep
    for (let i = 0; i < 5; i++) p.push(pale(cyl(0.12, 0.12, 0.2, TINT, -1.0 + i * 0.5, 1.14, 1.15, 8), 0.45));
    for (let i = 0; i < 5; i++) p.push(pale(cyl(0.12, 0.12, 0.2, TINT, -1.1 + i * 0.55, 1.84, KZ + 0.82, 8), 0.45));
    for (const s of [-1, 1]) for (const z of [KZ - 0.55, KZ + 0.15]) p.push(pale(cyl(0.12, 0.12, 0.2, TINT, s * 1.27, 1.84, z, 8), 0.45));
    // central tower with a soft-serve swirl roof and a cherry
    const SW = [[0.66, 0], [0.7, 0.1], [0.6, 0.24], [0.58, 0.3], [0.6, 0.38], [0.5, 0.52], [0.47, 0.58], [0.48, 0.66], [0.38, 0.8],
      [0.34, 0.86], [0.35, 0.94], [0.24, 1.06], [0.2, 1.12], [0.18, 1.18], [0.08, 1.32], [0, 1.4]];
    p.push(cyl(0.55, 0.6, 1.25, WALL, 0, 1.84, KZ - 0.1, 14), tor(0.565, 0.05, TINT, 0, 2.5, KZ - 0.1, PI / 2, 0, 0, 3, 14),
      lathe(SW, TINT, 0, 3.09, KZ - 0.1, 14), bead(0.13, CHERRY, 0, 4.58, KZ - 0.1), tcyl(0.02, 0.025, 0.2, STEM, 0.04, 4.78, KZ - 0.1, 0, 0, -0.35, 5));
    // four striped corner towers with wafer-cone roofs
    for (const [x, z] of [[-1.75, -1.2], [1.75, -1.2], [-1.75, 1.15], [1.75, 1.15]]) {
      p.push(cyl(0.45, 0.48, 2.3, WALL, x, 0.14, z, 12), tor(0.465, 0.05, TINT, x, 1.0, z, PI / 2, 0, 0, 3, 12),
        tor(0.46, 0.05, TINT, x, 1.9, z, PI / 2, 0, 0, 3, 12), cone(0.56, 1.0, WAFER, x, 2.44, z, 12), spark(0.09, CHERRY, x, 3.5, z));
    }
    // cotton candy puffs at the foot of the walls
    for (const [x, z, a] of [[-0.95, 1.62, 0.34], [0.95, 1.62, 0.34], [-2.02, 0.05, 0.3]]) p.push(pale(egg(a, a * 0.75, a * 0.75, TINT, x, a * 0.75 + 0.1, z, 0, 0, 0, 10, 6), 0.7));
    return p;
  },
});

// ======================================================================== FARM
def('chick', {
  label: 'Chick', col: { t: 'cyl', r: 0.22, h: 0.55 }, fit: 0.44, value: 1, mass: 0.15,
  tints: [0xffd84a, 0xfff0b8, 0xffb86b, 0xc8956a],
  build: () => [
    egg(0.18, 0.16, 0.18, TINT, 0, 0.17, -0.02, 0, 0, 0, 12, 8),
    egg(0.135, 0.13, 0.13, TINT, 0, 0.35, 0.03, 0, 0, 0, 12, 8),
    ...[-1, 1].flatMap((s) => [
      egg(0.05, 0.085, 0.1, TINT, s * 0.17, 0.18, -0.03, 0, 0, s * 0.45, 8, 5),
      box(0.05, 0.02, 0.08, 0xff9a2e, s * 0.07, 0, 0.07),
    ]),
    ...face(0, 0.385, 0.143, 0.052, 0.02, false),
    tcyl(0, 0.035, 0.07, 0xff9a2e, 0, 0.345, 0.185, PI / 2, 0, 0, 6),
    egg(0.018, 0.05, 0.018, TINT, -0.012, 0.5, 0.03, 0, 0, 0.35, 6, 4), egg(0.016, 0.045, 0.016, TINT, 0.02, 0.495, 0.02, 0, 0, -0.45, 6, 4),
  ],
});

def('duckling', {
  label: 'Duckling', col: { t: 'box', w: 0.36, h: 0.46, d: 0.5 }, fit: 0.62, value: 1, mass: 0.15,
  tints: [0xffe066, 0xfff6c8, 0xa8956a, 0xffcf9a],
  build: () => C([
    egg(0.16, 0.13, 0.21, TINT, 0, 0.13, -0.03, 0, 0, 0, 12, 8),
    egg(0.06, 0.045, 0.07, TINT, 0, 0.21, -0.22, -0.6, 0, 0, 8, 5),
    egg(0.12, 0.12, 0.12, TINT, 0, 0.32, 0.09, 0, 0, 0, 12, 8),
    egg(0.07, 0.024, 0.075, 0xff9a3a, 0, 0.295, 0.2, 0, 0, 0, 10, 5),
    ...[-1, 1].flatMap((s) => [
      egg(0.045, 0.075, 0.13, TINT, s * 0.15, 0.15, -0.05, 0, 0, s * 0.3, 8, 5),
      bead(0.02, INK, s * 0.05, 0.35, 0.19), spark(0.007, 0xffffff, s * 0.05 - 0.007, 0.357, 0.208),
      egg(0.024, 0.014, 0.01, BLUSH, s * 0.085, 0.31, 0.18, 0, s * 0.6, 0, 6, 4),
    ]),
    egg(0.02, 0.045, 0.02, TINT, 0, 0.45, 0.07, -0.3, 0, 0, 6, 4),
  ]),
});

def('piglet', {
  label: 'Piglet', col: { t: 'box', w: 0.56, h: 0.66, d: 0.86 }, fit: 1.03, value: 2, mass: 0.3,
  tints: [0xffb3c6, 0xffd6df, 0xf0c49b, 0xb5826a],
  build: () => C([
    egg(0.27, 0.22, 0.34, TINT, 0, 0.33, -0.03, 0, 0, 0, 14, 9),
    ...[[-1, -1], [-1, 1], [1, -1], [1, 1]].flatMap(([a, b]) => [
      tcyl(0.06, 0.065, 0.16, TINT, a * 0.13, 0.1, b * 0.16 - 0.02, 0, 0, 0, 8), tcyl(0.066, 0.066, 0.04, HOOF, a * 0.13, 0.02, b * 0.16 - 0.02, 0, 0, 0, 8),
    ]),
    egg(0.2, 0.19, 0.18, TINT, 0, 0.41, 0.26, 0, 0, 0, 12, 9),
    tcyl(0.08, 0.085, 0.07, MUZZLE, 0, 0.37, 0.45, PI / 2, 0, 0, 12),
    bead(0.018, 0xc0637a, -0.03, 0.375, 0.487), bead(0.018, 0xc0637a, 0.03, 0.375, 0.487),
    ...[-1, 1].flatMap((s) => [
      tcyl(0, 0.07, 0.13, TINT, s * 0.13, 0.59, 0.23, -0.2, 0, -s * 0.45, 6),
      bead(0.024, INK, s * 0.08, 0.46, 0.41), spark(0.008, 0xffffff, s * 0.08 - 0.008, 0.469, 0.432),
      egg(0.035, 0.02, 0.012, BLUSH, s * 0.14, 0.38, 0.4, 0, s * 0.6, 0, 6, 4),
    ]),
    tor(0.045, 0.014, TINT, 0, 0.42, -0.375, 0, 0, 0, 4, 10, 4.6),
  ]),
});

// Fluffy wool cloud (tinted) around a dark face. tint 3 is the black sheep.
def('sheep', {
  label: 'Sheep', col: { t: 'box', w: 0.78, h: 0.9, d: 1.05 }, fit: 1.31, value: 3, mass: 0.4,
  tints: [0xfbf8f2, 0xf2e2c2, 0xc9c4cc, 0x4a4552, 0xffd0e0],
  build: () => {
    const FACE = 0x4a4250, p = [egg(0.31, 0.26, 0.4, TINT, 0, 0.5, -0.04, 0, 0, 0, 12, 8)];
    [[0.2, 0.58, 0.18, 0.17], [-0.2, 0.58, 0.18, 0.17], [0.21, 0.56, -0.22, 0.18], [-0.21, 0.56, -0.22, 0.18],
      [0, 0.72, 0.12, 0.17], [0, 0.71, -0.24, 0.17], [0.14, 0.7, -0.05, 0.15], [-0.14, 0.7, -0.05, 0.15], [0, 0.55, -0.42, 0.14]]
      .forEach(([x, y, z, r]) => p.push(egg(r, r * 0.9, r, TINT, x, y, z, 0, 0, 0, 8, 6)));
    for (const [a, b] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) p.push(tcyl(0.045, 0.05, 0.3, FACE, a * 0.15, 0.15, b * 0.2 - 0.03, 0, 0, 0, 6));
    p.push(egg(0.15, 0.17, 0.15, FACE, 0, 0.56, 0.4, 0.35, 0, 0, 12, 8), egg(0.12, 0.075, 0.1, TINT, 0, 0.71, 0.36, 0, 0, 0, 8, 5));
    for (const s of [-1, 1]) {
      p.push(egg(0.09, 0.035, 0.05, FACE, s * 0.17, 0.62, 0.36, 0, s * 0.3, s * -0.4, 8, 4));
      p.push(bead(0.032, 0xffffff, s * 0.06, 0.6, 0.53), bead(0.019, INK, s * 0.06, 0.6, 0.555), egg(0.03, 0.017, 0.01, BLUSH, s * 0.1, 0.52, 0.52, 0, s * 0.5, 0, 6, 4));
    }
    return C(p);
  },
});

// Chunky cow in profile (head at +x) glancing at the camera. The spots take the tint.
def('cow', {
  label: 'Cow', col: { t: 'box', w: 1.56, h: 1.24, d: 0.8 }, fit: 1.75, value: 5, mass: 0.6,
  tints: [0x3d3846, 0x8a5a3c, 0xd9a066, 0x8d93a0],
  build: () => {
    const HIDE = 0xfbfaf6, HORN = 0xfff2d6;
    const spots = [[0.55, 0.62, 0.56], [-0.45, 0.72, 0.52], [0.05, 0.95, -0.3], [-0.55, 0.3, -0.78], [0.62, 0.15, -0.77], [-0.1, 0.25, 0.97], [-0.92, 0.3, 0.2]]
      .map(([x, y, z]) => new THREE.Vector3(x, y, z).normalize());
    const bodyG = new THREE.SphereGeometry(1, 16, 11);
    const p = [
      ...two(bodyG, (x, y, z) => { const d = new THREE.Vector3(x, y, z).normalize(); return spots.some((s) => s.dot(d) > 0.9); }, TINT, HIDE)
        .filter(Boolean).map((g) => g.scale(0.55, 0.36, 0.36).translate(0, 0.64, 0)),
    ];
    for (const [a, b] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
      p.push(tcyl(0.085, 0.08, 0.32, HIDE, a * 0.32, 0.22, b * 0.17, 0, 0, 0, 8), tcyl(0.088, 0.088, 0.08, HOOF, a * 0.32, 0.04, b * 0.17, 0, 0, 0, 8));
    }
    p.push(tcyl(0.018, 0.018, 0.42, HIDE, -0.6, 0.62, -0.05, 0, 0, -0.35, 5), egg(0.045, 0.07, 0.045, INK, -0.67, 0.42, -0.05, 0, 0, 0, 6, 4));
    // head, built facing +x around its own center, then turned toward the camera
    const head = [
      egg(0.21, 0.2, 0.2, HIDE, 0, 0, 0, 0, 0, 0, 12, 8),
      egg(0.13, 0.11, 0.16, MUZZLE, 0.17, -0.08, 0, 0, 0, 0, 12, 7),
      bead(0.025, 0xc0637a, 0.29, -0.05, -0.06), bead(0.025, 0xc0637a, 0.29, -0.05, 0.06),
      ...[-1, 1].flatMap((s) => [
        bead(0.03, INK, 0.12, 0.07, s * 0.13), spark(0.009, 0xffffff, 0.14, 0.08, s * 0.14),
        tcyl(0.015, 0.035, 0.14, HORN, -0.03, 0.22, s * 0.11, s * 0.5, 0, 0, 6),
        egg(0.1, 0.035, 0.055, HIDE, -0.03, 0.09, s * 0.22, s * 0.35, s * -0.3, 0, 8, 4),
      ]),
      egg(0.07, 0.04, 0.05, TINT, -0.04, 0.17, -0.02, 0, 0, 0, 8, 4),
      tor(0.17, 0.025, 0xff5a5f, -0.04, -0.17, 0, PI / 2, 0, 0.35, 4, 12), bead(0.055, GOLD, 0.02, -0.25, 0.0),
    ];
    for (const g of head) p.push(g.rotateY(-0.65).translate(0.66, 0.92, 0.05));
    return C(p);
  },
});

def('haybale', {
  label: 'Hay Bale', col: { t: 'box', w: 1.0, h: 0.52, d: 0.56 }, fit: 1.15, value: 2, mass: 0.3,
  tints: [0xf2cf6b, 0xf7e3a3, 0xe3b04e, 0xcfd77a],
  build: () => {
    const p = [rbox(1.0, 0.52, 0.56, TINT, 0, 0, 0, 0.08)];
    for (const x of [-0.27, 0.27]) p.push(box(0.05, 0.525, 0.565, 0xa0703a, x, 0, 0));
    // straw strands on the top and front
    [[-0.35, 0.1, 0.3], [-0.1, -0.15, -0.2], [0.12, 0.12, 0.4], [0.38, -0.08, -0.3], [0.0, 0.02, 0.1]].forEach(([x, z, a]) => p.push(tbox(0.22, 0.014, 0.014, STRAW_D, x, 0.525, z, 0, a, 0)));
    [[-0.4, 0.3, 0.2], [-0.12, 0.18, -0.25], [0.13, 0.33, 0.3], [0.4, 0.2, -0.2]].forEach(([x, y, a]) => p.push(tbox(0.2, 0.014, 0.014, STRAW_D, x, y, 0.283, 0, 0, a)));
    // loose tufts sticking out of the cut ends
    for (const s of [-1, 1]) for (const [y, z] of [[0.15, -0.12], [0.36, 0.1]]) p.push(egg(0.035, 0.03, 0.06, STRAW_D, s * 0.5, y, z, 0, 0, s * 0.4, 6, 4));
    return p;
  },
});

const CAN = [[0, 0], [0.19, 0], [0.21, 0.03], [0.21, 0.42], [0.17, 0.5], [0.11, 0.57], [0.11, 0.64], [0.135, 0.66], [0.135, 0.7], [0, 0.71]];
def('milkcan', {
  label: 'Milk Can', col: { t: 'cyl', r: 0.23, h: 0.72 }, fit: 0.46, value: 1, mass: 0.15,
  tints: [0xff5a5f, 0x4f8dff, 0x3fbf6f, 0xffc93a],
  build: () => [
    lathe(CAN, SILVER, 0, 0, 0, 16),
    cyl(0.215, 0.215, 0.12, TINT, 0, 0.14, 0, 16),
    cyl(0.142, 0.142, 0.025, TINT, 0, 0.69, 0, 14),
    tor(0.06, 0.016, STEEL, -0.16, 0.5, 0, 0, PI / 2, 0, 4, 8, PI), tor(0.06, 0.016, STEEL, 0.16, 0.5, 0, 0, PI / 2, 0, 4, 8, PI),
    vprism(heartPts(0.09), 0.012, WHITE, 0, 0.165, 0.215),
  ],
});

def('applecrate', {
  label: 'Apple Crate', col: { t: 'box', w: 0.8, h: 0.62, d: 0.56 }, fit: 0.98, value: 2, mass: 0.3,
  tints: [0xff4a4a, 0x8fd14f, 0xffd84a],
  build: () => {
    const p = [box(0.74, 0.04, 0.5, WOOD_D, 0, 0, 0)];
    for (const y of [0.04, 0.22]) {
      for (const s of [-1, 1]) p.push(box(0.8, 0.14, 0.035, WOOD, 0, y, s * 0.262), box(0.035, 0.14, 0.49, WOOD, s * 0.382, y, 0));
    }
    for (const [a, b] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) p.push(box(0.06, 0.4, 0.06, WOOD_D, a * 0.37, 0, b * 0.25));
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
      const x = (i - 1) * 0.235, z = (j - 0.5) * 0.23;
      p.push(ball(0.12, TINT, x, 0.3, z, 1), tcyl(0.012, 0.016, 0.07, STEM, x + 0.01, 0.56, z, 0, 0, -0.25, 5));
    }
    p.push(egg(0.07, 0.014, 0.035, LEAF, 0.04, 0.575, -0.12, 0, -0.4, -0.3, 6, 4), egg(0.07, 0.014, 0.035, LEAF, -0.2, 0.575, 0.12, 0, 0.5, 0.3, 6, 4));
    return p;
  },
});

def('carrot', {
  label: 'Carrot', col: { t: 'box', w: 0.78, h: 0.2, d: 0.28 }, fit: 0.83, value: 1, mass: 0.15,
  tints: [0xff8a2a, 0x9b4fd0, 0xffc93a],
  build: () => {
    const p = [tcyl(0.1, 0.022, 0.52, TINT, 0.06, 0.1, 0, 0, 0, -PI / 2, 12), egg(0.1, 0.1, 0.1, TINT, -0.2, 0.1, 0, 0, 0, 0, 10, 6)];
    for (const [x, r] of [[-0.06, 0.085], [0.08, 0.066], [0.2, 0.046]]) p.push(shade(tor(r, 0.008, TINT, x, 0.1, 0, 0, PI / 2, 0, 3, 10), 0xc8c8c8));
    for (const a of [-0.45, 0, 0.45]) p.push(egg(0.13, 0.025, 0.045, LEAF, -0.36 - 0.02 * Math.abs(a), 0.15, Math.sin(a) * 0.12, 0, -a, 0.1, 8, 4));
    p.push(tcyl(0.02, 0.02, 0.1, LEAF_D, -0.3, 0.13, 0, 0, 0, PI / 2, 5));
    return C(p);
  },
});

// Points +x: one front wheel, two handles, a load of little pumpkins.
def('wheelbarrow', {
  label: 'Wheelbarrow', col: { t: 'box', w: 1.86, h: 0.86, d: 0.64 }, fit: 1.97, value: 6, mass: 0.5,
  tints: [0xe8423c, 0x3fa34d, 0x3f7fe0, 0xffc21a],
  build: () => {
    const p = [
      vprism([[-0.42, 0], [0.3, 0], [0.5, 0.34], [-0.5, 0.34]], 0.62, TINT, 0, 0.3, 0),
      box(1.0, 0.04, 0.64, shade(null) ? 0 : 0x333333, 0, 0, 0),
    ];
    return p;
  },
});

// ======================================================================== SNOW
export const WAVE2_WORLDS = {
  candy: ['jellybean', 'marshmallow', 'peppermint', 'gummybear', 'candycane', 'cottoncandy', 'gumballmachine', 'swirlpop', 'chocbar', 'cupcaketower', 'candyhouse', 'cottoncastle'],
};
