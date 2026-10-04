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
    p.push(egg(er, er, er, INK, x + s * dx, y, z, 0, 0, 0, 7, 5), spark(er * 0.32, 0xffffff, x + s * dx - er * 0.35, y + er * 0.4, z + er * 0.85));
    p.push(egg(er * 1.25, er * 0.7, er * 0.45, BLUSH, x + s * dx * 1.75, y - er * 1.7, z - er * 0.5, 0, s * 0.45, 0, 6, 4));
  }
  if (smile) p.push(tor(dx * 0.5, er * 0.36, INK, x, y - er * 1.5, z + er * 0.1, 0, 0, PI, 4, 8, PI));
  return p;
}
// Like two(), for any number of colors: pick(...) returns an index into cols.
function multi(geo, pick, cols) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const P = g.attributes.position, N = g.attributes.normal;
  const out = cols.map(() => [[], []]);
  for (let i = 0; i < P.count; i += 3) {
    let x = 0, y = 0, z = 0;
    for (let k = 0; k < 3; k++) { x += P.getX(i + k); y += P.getY(i + k); z += P.getZ(i + k); }
    const o = out[pick(x / 3, y / 3, z / 3)];
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
// Pinwheel disc facing +z (peppermint windows, little lollipops).
const pinwheel = (r, t, colA, colB, x, y, z, n = 8) =>
  two(new THREE.CylinderGeometry(r, r, t, n * 3).rotateX(PI / 2).translate(x, y, z),
    (px, py) => ((Math.atan2(py - y, px - x) / TAU) * n + n + 0.5) % 1 < 0.5, colA, colB);

// ======================================================================== CANDY
// Capsule lying along x, slightly flattened and bent into a kidney bean (bows toward -z).
function bean(r, len, flat, bend, col, x, y, z) {
  const g = new THREE.CapsuleGeometry(r, len, 4, 12).rotateZ(PI / 2).scale(1, flat, 1);
  const P = g.attributes.position, half = len / 2 + r;
  for (let i = 0; i < P.count; i++) { const u = P.getX(i) / half; P.setZ(i, P.getZ(i) - bend * (1 - u * u)); }
  g.computeVertexNormals();
  return custom(g.translate(x, y, z), col);
}
def('jellybean', {
  label: 'Jelly Bean', col: { t: 'box', w: 0.38, h: 0.22, d: 0.23 }, fit: 0.44, value: 1, mass: 0.15,
  tints: [0xff3b5c, 0xff9a2e, 0xffd93a, 0x6fd44a, 0xa86bff, 0xff7ac0, 0x4fb8ff],
  build: () => C([
    bean(0.105, 0.17, 0.95, 0.045, TINT, 0, 0.1, 0),
    pale(egg(0.05, 0.01, 0.016, TINT, -0.07, 0.196, -0.035, 0, 0.25, 0, 8, 4), 0.4),
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
    const prof = [[0, 0], [0.22, 0], [0.245, 0.02], [0.25, 0.05], [0.24, 0.08], [0.21, 0.1], [0.17, 0.114], [0.12, 0.123], [0.06, 0.128], [0, 0.13]];
    // six swirled stripes, like a starlight mint
    return two(latheGeo(prof, 54), (x, y, z) => ((Math.atan2(x, z) / TAU) * 6 + Math.hypot(x, z) * 3.4 + 6) % 1 < 0.5, TINT, WHITE).filter(Boolean);
  },
});

def('gummybear', {
  label: 'Gummy Bear', col: { t: 'box', w: 0.52, h: 0.82, d: 0.34 }, fit: 0.62, value: 1, mass: 0.15,
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
      ...two(coneG, (x, y, z) => ((Math.atan2(x, z) / TAU) * 3 + y * 3.2 + 3) % 1 < 0.35, TINT, WHITE).map((g, i) => (g && i === 0 ? pale(g, 0.6) : g)).filter(Boolean),
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

// Glass drawn like the snow globe's (inner back half + bright rim) so the pile of real
// gumballs inside is visible from the game camera.
def('gumballmachine', {
  label: 'Gumball Machine', col: { t: 'cyl', r: 0.5, h: 1.66 }, fit: 1.0, value: 2, mass: 0.3,
  tints: [0xe8423c, 0x3f7fe0, 0xff6fa8, 0x2fb3a8, 0x9b6bff],
  build: () => {
    const R = 0.48, cy = 0.62 + R - 0.06, pitch = 1.0, vy = Math.sin(pitch), vz = Math.cos(pitch);
    const p = [
      lathe([[0, 0], [0.32, 0], [0.33, 0.03], [0.3, 0.08], [0.23, 0.12], [0.2, 0.5], [0.25, 0.56], [0.25, 0.64], [0, 0.64]], TINT, 0, 0, 0, 12),
      tcyl(0.09, 0.09, 0.04, SILVER, 0, 0.38, 0.2, PI / 2, 0, 0, 10), box(0.035, 0.12, 0.03, STEEL, 0, 0.32, 0.225),
      box(0.12, 0.08, 0.06, NAVY, 0, 0.15, 0.19), egg(0.04, 0.04, 0.04, GUMS[0], 0, 0.19, 0.24, 0, 0, 0, 6, 4),
      custom(shellInside(new THREE.SphereGeometry(R, 14, 10), (x, y, z) => y * vy + z * vz < 0.02).translate(0, cy, 0), 0xdcefff),
      custom(new THREE.TorusGeometry(R, 0.018, 3, 28).rotateX(-pitch).translate(0, cy, 0), 0xffffff),
      custom(new THREE.TorusGeometry(R * 0.84, 0.022, 3, 7, 0.75).rotateZ(1.95).rotateX(-pitch).translate(0, cy, 0), 0xffffff),
      lathe([[0.25, 0], [0.235, 0.07], [0.16, 0.12], [0, 0.14]], TINT, 0, cy + R - 0.06, 0, 12),
      egg(0.05, 0.05, 0.05, TINT, 0, cy + R + 0.12, 0, 0, 0, 0, 7, 5),
    ];
    // a heap of gumballs: 3 + 5 + 3 in layers, three-quarters full
    let k = 0;
    for (const [dy, n, rr, a0] of [[-0.3, 3, 0.14, 0], [-0.08, 5, 0.26, 0.6], [0.13, 3, 0.15, 1.0]]) {
      for (let i = 0; i < n; i++, k++) {
        const a = a0 + (i * TAU) / n;
        p.push(egg(0.125, 0.125, 0.125, GUMS[(k * 3) % 7], rr * Math.sin(a), cy + dy, rr * Math.cos(a), 0, 0, 0, 8, 5));
      }
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
    const plate = (R, y) => pale(lathe([[0, 0], [R - 0.06, 0], [R, 0.05], [R - 0.02, 0.07], [R - 0.08, 0.045], [0, 0.045]], TINT, 0, y, 0, 20), 0.3);
    const p = [
      pale(lathe([[0, 0], [0.45, 0], [0.43, 0.06], [0.14, 0.12], [0.08, 0.2], [0, 0.2]], TINT, 0, 0, 0, 16), 0.3),
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
  label: 'Candy Cottage', col: { t: 'box', w: 2.64, h: 2.43, d: 2.25 }, fit: 3.47, value: 19, mass: 3,
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
      for (const z of [-0.75, -0.15, 0.45]) p.push(egg(0.05, 0.1, 0.05, ICING, s * (HW + 0.02), top - 0.08, z, 0, 0, 0, 6, 4));
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
    [0xff4f6d, 0x6fd65a, 0xffd84a, 0x9b6bff].forEach((c, i) => p.push(egg(0.09, 0.09, 0.09, c, 0, top + RH + 0.02, -0.85 + i * 0.5, 0, 0, 0, 7, 5)));
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
    for (let i = 0; i < 5; i++) p.push(pale(cyl(0.12, 0.12, 0.2, TINT, -1.0 + i * 0.5, 1.14, 1.15, 7), 0.45));
    for (let i = 0; i < 5; i++) p.push(pale(cyl(0.12, 0.12, 0.2, TINT, -1.1 + i * 0.55, 1.84, KZ + 0.82, 7), 0.45));
    for (const s of [-1, 1]) for (const z of [KZ - 0.55, KZ + 0.15]) p.push(pale(cyl(0.12, 0.12, 0.2, TINT, s * 1.27, 1.84, z, 7), 0.45));
    // central tower with a soft-serve swirl roof and a cherry
    const SW = [[0.66, 0], [0.7, 0.1], [0.6, 0.24], [0.58, 0.3], [0.6, 0.38], [0.5, 0.52], [0.47, 0.58], [0.48, 0.66], [0.38, 0.8],
      [0.34, 0.86], [0.35, 0.94], [0.24, 1.06], [0.2, 1.12], [0.18, 1.18], [0.08, 1.32], [0, 1.4]];
    p.push(cyl(0.55, 0.6, 1.25, WALL, 0, 1.84, KZ - 0.1, 14), tor(0.565, 0.05, TINT, 0, 2.5, KZ - 0.1, PI / 2, 0, 0, 3, 14),
      lathe(SW, TINT, 0, 3.09, KZ - 0.1, 12), egg(0.13, 0.13, 0.13, CHERRY, 0, 4.58, KZ - 0.1, 0, 0, 0, 8, 5), tcyl(0.02, 0.025, 0.2, STEM, 0.04, 4.78, KZ - 0.1, 0, 0, -0.35, 5));
    // four striped corner towers with wafer-cone roofs
    for (const [x, z] of [[-1.75, -1.2], [1.75, -1.2], [-1.75, 1.15], [1.75, 1.15]]) {
      p.push(cyl(0.45, 0.48, 2.3, WALL, x, 0.14, z, 10), tor(0.46, 0.055, TINT, x, 1.9, z, PI / 2, 0, 0, 3, 12),
        cone(0.56, 1.0, WAFER, x, 2.44, z, 10), spark(0.09, CHERRY, x, 3.5, z));
    }
    // fluffy cotton candy clouds at the front corners
    for (const s of [-1, 1]) {
      for (const [dx, dy, dz, a] of [[0, 0.3, 0, 0.3], [0.26, 0.22, 0.06, 0.2], [-0.2, 0.24, 0.1, 0.19]]) {
        p.push(pale(egg(a, a * 0.85, a * 0.8, TINT, s * (0.95 + dx), dy + 0.08, 1.58 + dz, 0, 0, 0, 7, 5), 0.65));
      }
    }
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

// Swims toward +x in profile (long boat body, perky tail), head turned to the camera.
def('duckling', {
  label: 'Duckling', col: { t: 'box', w: 0.61, h: 0.49, d: 0.36 }, fit: 0.71, value: 1, mass: 0.15,
  tints: [0xffe066, 0xfff6c8, 0xa8956a, 0xffcf9a],
  build: () => {
    const p = [
      egg(0.22, 0.13, 0.155, TINT, -0.03, 0.13, 0, 0, 0, 0, 12, 8),
      egg(0.075, 0.045, 0.065, TINT, -0.25, 0.2, 0, 0, 0, 0.75, 8, 5),
      ...[-1, 1].flatMap((s) => [
        egg(0.13, 0.065, 0.04, TINT, -0.06, 0.16, s * 0.135, 0, s * 0.15, -0.3, 8, 5),
        egg(0.05, 0.012, 0.035, 0xff9a3a, 0.05, 0.006, s * 0.07, 0, 0, 0, 6, 4),
      ]),
    ];
    const head = [
      egg(0.115, 0.115, 0.115, TINT, 0, 0, 0, 0, 0, 0, 12, 8),
      egg(0.075, 0.022, 0.06, 0xff9a3a, 0.115, -0.025, 0, 0, 0, -0.12, 10, 5),
      egg(0.022, 0.05, 0.02, TINT, -0.02, 0.13, 0, 0, 0, -0.45, 6, 4),
      ...[-1, 1].flatMap((s) => [
        egg(0.019, 0.019, 0.019, INK, 0.06, 0.035, s * 0.085, 0, 0, 0, 7, 5), spark(0.006, 0xffffff, 0.068, 0.043, s * 0.1),
        egg(0.024, 0.013, 0.01, BLUSH, 0.045, -0.02, s * 0.1, 0, s * 0.9, 0, 6, 4),
      ]),
    ];
    for (const g of head) p.push(g.rotateY(-0.55).translate(0.13, 0.31, 0.02));
    return C(p);
  },
});

def('piglet', {
  label: 'Piglet', col: { t: 'box', w: 0.54, h: 0.66, d: 0.89 }, fit: 1.04, value: 2, mass: 0.3,
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
  label: 'Sheep', col: { t: 'box', w: 0.78, h: 0.88, d: 1.14 }, fit: 1.38, value: 3, mass: 0.4,
  tints: [0xfbf8f2, 0xf2e2c2, 0xc9c4cc, 0x4a4552, 0xffd0e0],
  build: () => {
    const FACE = 0x4a4250, p = [egg(0.31, 0.26, 0.4, TINT, 0, 0.5, -0.04, 0, 0, 0, 12, 8)];
    [[0.2, 0.58, 0.18, 0.17], [-0.2, 0.58, 0.18, 0.17], [0.21, 0.56, -0.22, 0.18], [-0.21, 0.56, -0.22, 0.18],
      [0, 0.72, 0.12, 0.17], [0, 0.71, -0.24, 0.17], [0.14, 0.7, -0.05, 0.15], [-0.14, 0.7, -0.05, 0.15], [0, 0.55, -0.42, 0.14]]
      .forEach(([x, y, z, r]) => p.push(egg(r, r * 0.9, r, TINT, x, y, z, 0, 0, 0, 7, 5)));
    for (const [a, b] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) p.push(tcyl(0.045, 0.05, 0.3, FACE, a * 0.15, 0.15, b * 0.2 - 0.03, 0, 0, 0, 6));
    p.push(egg(0.15, 0.17, 0.15, FACE, 0, 0.56, 0.4, 0.35, 0, 0, 10, 7), egg(0.12, 0.075, 0.1, TINT, 0, 0.71, 0.36, 0, 0, 0, 8, 5));
    for (const s of [-1, 1]) {
      p.push(egg(0.09, 0.035, 0.05, FACE, s * 0.17, 0.62, 0.36, 0, s * 0.3, s * -0.4, 8, 4));
      p.push(egg(0.032, 0.032, 0.032, 0xffffff, s * 0.06, 0.6, 0.53, 0, 0, 0, 7, 5), egg(0.019, 0.019, 0.019, INK, s * 0.06, 0.6, 0.555, 0, 0, 0, 6, 4), egg(0.03, 0.017, 0.01, BLUSH, s * 0.1, 0.52, 0.52, 0, s * 0.5, 0, 6, 4));
    }
    return C(p);
  },
});

// Chunky cow in profile (head at +x) glancing at the camera. The spots take the tint.
def('cow', {
  label: 'Cow', col: { t: 'box', w: 1.68, h: 1.22, d: 0.74 }, fit: 1.84, value: 5, mass: 0.6,
  tints: [0x3d3846, 0x8a5a3c, 0xd9a066, 0x8d93a0],
  build: () => {
    const HIDE = 0xfbfaf6, HORN = 0xfff2d6;
    const spots = [[0.55, 0.62, 0.56], [-0.45, 0.72, 0.52], [0.05, 0.95, -0.3], [-0.55, 0.3, -0.78], [0.62, 0.15, -0.77], [-0.1, 0.25, 0.97], [-0.92, 0.3, 0.2]]
      .map(([x, y, z]) => new THREE.Vector3(x, y, z).normalize());
    const bodyG = new THREE.SphereGeometry(1, 15, 10);
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
      egg(0.21, 0.2, 0.2, HIDE, 0, 0, 0, 0, 0, 0, 10, 7),
      egg(0.13, 0.11, 0.16, MUZZLE, 0.17, -0.08, 0, 0, 0, 0, 10, 6),
      bead(0.025, 0xc0637a, 0.29, -0.05, -0.06), bead(0.025, 0xc0637a, 0.29, -0.05, 0.06),
      ...[-1, 1].flatMap((s) => [
        egg(0.03, 0.03, 0.03, INK, 0.12, 0.07, s * 0.13, 0, 0, 0, 7, 5), spark(0.009, 0xffffff, 0.14, 0.08, s * 0.14),
        tcyl(0.015, 0.035, 0.14, HORN, -0.03, 0.22, s * 0.11, s * 0.5, 0, 0, 6),
        egg(0.1, 0.035, 0.055, HIDE, -0.03, 0.09, s * 0.22, s * 0.35, s * -0.3, 0, 8, 4),
      ]),
      egg(0.07, 0.04, 0.05, TINT, -0.04, 0.17, -0.02, 0, 0, 0, 8, 4),
      tor(0.17, 0.025, 0xff5a5f, -0.04, -0.17, 0, PI / 2, 0, 0.35, 4, 12), egg(0.055, 0.055, 0.055, GOLD, 0.02, -0.25, 0.0, 0, 0, 0, 7, 5),
    ];
    for (const g of head) p.push(g.rotateY(-0.65).translate(0.66, 0.92, 0.05));
    return C(p);
  },
});

def('haybale', {
  label: 'Hay Bale', col: { t: 'box', w: 1.06, h: 0.53, d: 0.58 }, fit: 1.21, value: 2, mass: 0.3,
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
  label: 'Carrot', col: { t: 'box', w: 0.81, h: 0.2, d: 0.25 }, fit: 0.85, value: 1, mass: 0.15,
  tints: [0xff8a2a, 0x9b4fd0, 0xffc93a],
  build: () => {
    const p = [tcyl(0.1, 0.022, 0.52, TINT, 0.06, 0.1, 0, 0, 0, PI / 2, 12), egg(0.05, 0.1, 0.1, TINT, -0.2, 0.1, 0, 0, 0, 0, 12, 6)];
    for (const [x, r] of [[-0.06, 0.085], [0.08, 0.066], [0.2, 0.046]]) p.push(shade(tor(r, 0.008, TINT, x, 0.1, 0, 0, PI / 2, 0, 3, 10), 0xc8c8c8));
    for (const a of [-0.45, 0, 0.45]) p.push(egg(0.13, 0.025, 0.045, LEAF, -0.36 - 0.02 * Math.abs(a), 0.15, Math.sin(a) * 0.12, 0, -a, 0.1, 8, 4));
    p.push(tcyl(0.02, 0.02, 0.1, LEAF_D, -0.3, 0.13, 0, 0, 0, PI / 2, 5));
    return C(p);
  },
});


// Points +x: one front wheel, two handles, a load of little pumpkins.
def('wheelbarrow', {
  label: 'Wheelbarrow', col: { t: 'box', w: 1.86, h: 0.9, d: 0.66 }, fit: 1.97, value: 6, mass: 0.5,
  tints: [0xe8423c, 0x3fa34d, 0x3f7fe0, 0xffc21a],
  build: () => {
    const p = [
      vprism([[-0.42, 0], [0.3, 0], [0.5, 0.34], [-0.5, 0.34]], 0.62, TINT, 0, 0.3, 0),
      shade(box(1.02, 0.04, 0.04, TINT, 0, 0.62, 0.31), 0x9a9a9a), shade(box(1.02, 0.04, 0.04, TINT, 0, 0.62, -0.31), 0x9a9a9a),
      shade(box(0.04, 0.04, 0.66, TINT, 0.5, 0.62, 0), 0x9a9a9a), shade(box(0.04, 0.04, 0.66, TINT, -0.5, 0.62, 0), 0x9a9a9a),
      box(0.96, 0.02, 0.58, SOIL, 0, 0.625, 0),
      tor(0.18, 0.065, TIRE, 0.66, 0.245, 0, 0, 0, 0, 6, 16), tcyl(0.07, 0.07, 0.16, GOLD, 0.66, 0.245, 0, PI / 2, 0, 0, 10),
    ];
    for (const s of [-1, 1]) {
      p.push(bar(0.24, 0.42, 0.66, 0.245, s * 0.09, 0.04, 0.03, NAVY));
      p.push(bar(-0.4, 0.56, -0.8, 0.49, s * 0.25, 0.05, 0.05, WOOD_D), bar(-0.78, 0.492, -0.95, 0.465, s * 0.25, 0.065, 0.065, NAVY));
      p.push(box(0.05, 0.32, 0.05, WOOD_D, -0.3, 0, s * 0.22), box(0.09, 0.03, 0.09, NAVY, -0.3, 0, s * 0.22));
    }
    for (const [x, z, r] of [[-0.25, 0.1, 0.13], [0.06, -0.1, 0.14], [0.3, 0.1, 0.12]]) {
      p.push(ribbed(r, 0.78, 8, 0.1, 0xff8a2a, x, 0.635, z, 12, 6), tcyl(0.018, 0.024, 0.06, STEM, x + 0.01, 0.645 + r * 1.56, z, 0, 0, -0.3, 5));
    }
    p.push(egg(0.09, 0.016, 0.05, LEAF, -0.12, 0.66, -0.12, 0, 0.5, 0, 6, 4));
    return C(p);
  },
});

// Classic little tractor pointing +x: big back wheels, small front wheels, sun roof.
def('tractor', {
  label: 'Tractor', col: { t: 'box', w: 2.14, h: 1.67, d: 1.56 }, fit: 2.65, value: 11, mass: 1.5,
  tints: [0xe8423c, 0x3fa34d, 0x3f7fe0, 0xffc21a, 0xff8a3d],
  build: () => {
    const p = [
      box(1.6, 0.18, 0.4, NAVY, 0.1, 0.36, 0),
      rbox(1.2, 0.5, 0.62, TINT, 0.38, 0.5, 0, 0.1),
      box(0.04, 0.38, 0.46, NAVY, 0.98, 0.54, 0),
      bead(0.06, WARM, 0.97, 0.9, 0.21), bead(0.06, WARM, 0.97, 0.9, -0.21),
      rbox(0.72, 0.55, 0.92, TINT, -0.56, 0.5, 0, 0.1),
      box(0.3, 0.08, 0.38, NAVY, -0.6, 1.05, 0), box(0.06, 0.32, 0.38, NAVY, -0.8, 1.05, 0),
      tor(0.14, 0.022, NAVY, -0.22, 1.27, 0, PI / 2, 0, 0.6, 4, 12), bar(-0.17, 1.2, -0.05, 1.0, 0, 0.03, 0.03, NAVY),
      tcyl(0.045, 0.045, 0.62, STEEL, 0.62, 1.31, 0.16, 0, 0, 0, 8), tcyl(0.06, 0.06, 0.05, NAVY, 0.62, 1.64, 0.16, 0, 0, 0, 8),
    ];
    for (let i = 0; i < 3; i++) p.push(box(0.045, 0.3, 0.025, SILVER, 1.0, 0.58, (i - 1) * 0.13));
    for (const s of [-1, 1]) {
      p.push(tcyl(0.52, 0.52, 0.3, TIRE, -0.5, 0.52, s * 0.6, PI / 2, 0, 0, 18), tcyl(0.3, 0.3, 0.31, WHITE, -0.5, 0.52, s * 0.6, PI / 2, 0, 0, 12),
        tcyl(0.1, 0.1, 0.33, TINT, -0.5, 0.52, s * 0.6, PI / 2, 0, 0, 8));
      p.push(tcyl(0.3, 0.3, 0.22, TIRE, 0.72, 0.3, s * 0.5, PI / 2, 0, 0, 14), tcyl(0.16, 0.16, 0.23, WHITE, 0.72, 0.3, s * 0.5, PI / 2, 0, 0, 10));
      p.push(custom(new THREE.CylinderGeometry(0.6, 0.6, 0.36, 12, 1, true, PI / 2, PI).rotateX(PI / 2).translate(-0.5, 0.52, s * 0.6), TINT));
    }
    return C(p);
  },
});

// Friendly scarecrow on a post: plaid shirt (tinted), burlap head, straw hat, a crow pal.
def('scarecrow', {
  label: 'Scarecrow', col: { t: 'box', w: 1.6, h: 1.8, d: 0.64 }, fit: 1.72, value: 5, mass: 0.4,
  tints: [0xe8423c, 0x3f7fe0, 0x3fa34d, 0x9b6bff, 0xff8a3d],
  build: () => {
    const ROPE = 0xa0703a, PL = 0x8c8c8c;
    const p = [
      egg(0.24, 0.07, 0.24, SOIL, 0, 0.07, 0, 0, 0, 0, 8, 4),
      tcyl(0.045, 0.05, 1.25, WOOD_D, 0, 0.625, 0, 0, 0, 0, 6),
      tcyl(0.04, 0.04, 1.2, WOOD_D, 0, 1.12, -0.03, 0, 0, PI / 2, 6),
      tcyl(0.2, 0.24, 0.52, TINT, 0, 0.98, 0, 0, 0, 0, 10), egg(0.2, 0.06, 0.13, TINT, 0, 1.24, 0, 0, 0, 0, 10, 4),
      shade(box(0.055, 0.5, 0.02, TINT, -0.09, 0.73, 0.205), PL), shade(box(0.055, 0.5, 0.02, TINT, 0.09, 0.73, 0.205), PL),
      shade(tor(0.231, 0.024, TINT, 0, 0.86, 0, PI / 2, 0, 0, 3, 12), PL), shade(tor(0.216, 0.024, TINT, 0, 1.06, 0, PI / 2, 0, 0, 3, 12), PL),
      box(0.12, 0.12, 0.03, 0xf2d06b, 0.13, 0.76, 0.19),
      egg(0.18, 0.19, 0.17, BURLAP, 0, 1.43, 0, 0, 0, 0, 10, 7),
      egg(0.03, 0.03, 0.03, INK, -0.065, 1.47, 0.152, 0, 0, 0, 6, 4), egg(0.03, 0.03, 0.03, INK, 0.065, 1.47, 0.152, 0, 0, 0, 6, 4),
      tcyl(0, 0.04, 0.12, CARROT, 0, 1.41, 0.21, PI / 2, 0, 0, 7),
      tor(0.07, 0.012, INK, 0, 1.37, 0.148, 0, 0, PI, 3, 8, PI),
      tor(0.1, 0.02, ROPE, 0, 1.26, 0, PI / 2, 0, 0, 3, 10),
      cyl(0.31, 0.31, 0.035, STRAW, 0, 1.56, 0, 14), cyl(0.15, 0.18, 0.2, STRAW, 0, 1.59, 0, 10), cyl(0.183, 0.183, 0.05, TINT, 0, 1.6, 0, 10),
      spark(0.045, 0xff7ac0, 0.15, 1.64, 0.08), spark(0.018, 0xffd23f, 0.16, 1.66, 0.12),
    ];
    for (const x of [-0.07, -0.025, 0.025, 0.07]) p.push(tbox(0.006, 0.03, 0.006, INK, x, 1.345 - Math.abs(x) * 0.25, 0.158));
    for (const s of [-1, 1]) {
      p.push(tcyl(0.09, 0.08, 0.46, TINT, s * 0.44, 1.12, 0, 0, 0, PI / 2, 8));
      for (const a of [-0.35, 0, 0.35]) p.push(egg(0.08, 0.024, 0.03, STRAW, s * 0.72, 1.12 + a * 0.1, a * 0.08, 0, 0, s * a, 6, 4));
    }
    for (const x of [-0.11, 0, 0.11]) p.push(egg(0.025, 0.08, 0.025, STRAW, x, 0.68, 0.08, 0, 0, x * 2, 6, 4));
    // a little crow friend on the left arm
    p.push(egg(0.075, 0.06, 0.1, INK, -0.55, 1.26, 0, 0, 0.4, 0, 7, 5), egg(0.05, 0.05, 0.05, INK, -0.53, 1.35, 0.06, 0, 0, 0, 7, 5), tcyl(0, 0.022, 0.06, 0xffb52e, -0.52, 1.35, 0.115, PI / 2, 0, 0, 5),
      spark(0.01, 0xffffff, -0.505, 1.37, 0.095), egg(0.03, 0.02, 0.07, INK, -0.6, 1.27, -0.12, 0.4, 0.4, 0, 6, 4));
    return p;
  },
});

// Big red barn with a gambrel roof, X-braced doors, hayloft, silo and a rooster vane.
const GAMBREL = [[-1.95, 0], [1.95, 0], [1.6, 0.95], [0, 1.6], [-1.6, 0.95]];
def('barn', {
  label: 'Red Barn', col: { t: 'box', w: 4.72, h: 4.74, d: 3.46 }, fit: 5.85, value: 55, mass: 8,
  tints: [0xd9443a, 0x6fa8dc, 0xf2c14e, 0x7fb77e],
  build: () => {
    const ROOF = 0x8a4538, TRIM = 0xfffaf2, WY = 0.15, top = 2.35, G2 = GAMBREL.map(([u, v]) => [u * 0.86, v * 0.86]);
    const p = [
      box(3.6, 0.15, 3.3, STONE),
      box(3.4, top - WY, 3.1, TINT, 0, WY, 0),
      vprism(GAMBREL, 3.3, ROOF, 0, top, 0),
      bar(-1.7, top - 0.04, 1.7, top - 0.04, 1.565, 0.08, 0.03, TRIM),
    ];
    for (const z of [1.665, -1.665]) p.push(vprism(G2, 0.03, TINT, 0, top, z));
    for (let i = 0; i < 4; i++) { const [a, b] = [G2[(i + 1) % 5], G2[(i + 2) % 5]]; p.push(bar(a[0], top + a[1], b[0], top + b[1], 1.69, 0.08, 0.03, TRIM)); }
    for (const [x, z] of [[-1.7, 1.55], [1.7, 1.55], [-1.7, -1.55], [1.7, -1.55]]) p.push(box(0.1, top - WY, 0.1, TRIM, x, WY, z));
    // big double doors with white X braces
    for (const s of [-1, 1]) {
      p.push(shade(box(0.6, 1.45, 0.04, TINT, s * 0.32, WY, 1.565), 0x9a9a9a));
      p.push(bar(s * 0.03, WY + 0.06, s * 0.6, WY + 1.4, 1.595, 0.06, 0.02, TRIM), bar(s * 0.03, WY + 1.4, s * 0.6, WY + 0.06, 1.595, 0.06, 0.02, TRIM));
      p.push(bar(s * 0.66, WY, s * 0.66, WY + 1.52, 1.59, 0.08, 0.03, TRIM));
    }
    p.push(bar(-0.7, WY + 1.5, 0.7, WY + 1.5, 1.59, 0.08, 0.03, TRIM), bar(0, WY, 0, WY + 1.47, 1.59, 0.05, 0.03, TRIM));
    // hayloft door with hay peeking out
    p.push(box(0.62, 0.55, 0.04, 0x6b3b2a, 0, top + 0.18, 1.69), egg(0.24, 0.1, 0.07, STRAW, 0, top + 0.22, 1.71, 0, 0, 0, 10, 5));
    p.push(bar(-0.34, top + 0.16, 0.34, top + 0.16, 1.715, 0.06, 0.02, TRIM), bar(-0.34, top + 0.75, 0.34, top + 0.75, 1.715, 0.06, 0.02, TRIM),
      bar(-0.34, top + 0.16, -0.34, top + 0.75, 1.715, 0.06, 0.02, TRIM), bar(0.34, top + 0.16, 0.34, top + 0.75, 1.715, 0.06, 0.02, TRIM));
    // side windows
    for (const s of [-1, 1]) for (const z of [-0.75, 0.75]) {
      p.push(box(0.03, 0.5, 0.5, TRIM, s * 1.71, 1.0, z), box(0.035, 0.38, 0.38, 0x5d7f99, s * 1.715, 1.06, z));
      p.push(box(0.04, 0.04, 0.4, TRIM, s * 1.72, 1.23, z), box(0.04, 0.4, 0.04, TRIM, s * 1.72, 1.05, z));
    }
    // silo tucked against the right side
    p.push(cyl(0.72, 0.72, 3.4, 0xdfe3e8, 2.0, 0, -0.85, 16), egg(0.74, 0.5, 0.74, SILVER, 2.0, 3.4, -0.85, 0, 0, 0, 16, 7), bead(0.08, STEEL, 2.0, 3.92, -0.85));
    for (const y of [1.1, 2.2, 3.3]) p.push(tor(0.73, 0.03, STEEL, 2.0, y, -0.85, PI / 2, 0, 0, 3, 16));
    // rooster weather vane on the ridge
    const vy = top + 1.6;
    p.push(tcyl(0.025, 0.025, 0.55, NAVY, 0, vy + 0.27, 0, 0, 0, 0, 5), box(0.55, 0.025, 0.025, NAVY, 0, vy + 0.33, 0),
      egg(0.12, 0.08, 0.045, GOLD, 0, vy + 0.6, 0, 0, 0, 0, 8, 5), bead(0.05, GOLD, 0.1, vy + 0.68, 0), bead(0.028, CHERRY, 0.1, vy + 0.745, 0),
      egg(0.05, 0.085, 0.03, GOLD, -0.12, vy + 0.66, 0, 0, 0, 0.5, 6, 4), tcyl(0, 0.02, 0.05, 0xffb52e, 0.165, vy + 0.68, 0, 0, 0, -PI / 2, 5));
    return C(p);
  },
});

// ======================================================================== SNOW
// The snow floor is a soft icy blue, so white snow gets cool blue-grey shading on its
// underside (three bands) to keep a crisp silhouette at phone size.
const COOL = [0xffffff, 0xdde7f4, 0xb9cbe3];
const bandOf = (y, cy, b) => { const t = (y - cy) / b; return t > -0.15 ? 0 : t > -0.6 ? 1 : 2; };
function snowEgg(a, b, c, x, y, z, ws = 12, hs = 8) {
  const g = new THREE.SphereGeometry(1, ws, hs).scale(a, b, c).translate(x, y, z);
  return multi(g, (px, py) => bandOf(py, y, b), [SNOW, COOL[1], COOL[2]]).filter(Boolean);
}
def('snowball', {
  label: 'Snowball', col: { t: 'ball', r: 0.18 }, fit: 0.36, value: 1, mass: 0.15,
  tints: [0xffffff, 0xd9ecff, 0xeee4ff],
  build: () => {
    const g = new THREE.SphereGeometry(0.18, 14, 10).translate(0, 0.18, 0);
    const p = multi(g, (x, y) => bandOf(y, 0.18, 0.18), [TINT, TINT, TINT]).map((q, i) => (q && i ? shade(q, COOL[i]) : q)).filter(Boolean);
    for (const [x, y, z] of [[0.08, 0.3, 0.1], [-0.1, 0.25, 0.1], [0.02, 0.35, -0.07], [0.12, 0.22, -0.08]]) p.push(spark(0.022, 0x9ccaff, x, y, z));
    return p;
  },
});

def('jinglebell', {
  label: 'Jingle Bell', col: { t: 'cyl', r: 0.19, h: 0.44 }, fit: 0.38, value: 1, mass: 0.15,
  tints: [0xffc93a, 0xdfe6ee, 0xe8423c, 0x3fbf6f, 0x4f8dff],
  build: () => [
    egg(0.18, 0.17, 0.18, TINT, 0, 0.17, 0, 0, 0, 0, 14, 10),
    shade(tor(0.181, 0.016, TINT, 0, 0.2, 0, PI / 2, 0, 0, 4, 18), 0xb0b0b0),
    egg(0.09, 0.02, 0.03, INK, 0, 0.075, 0.135, -0.75, 0, 0, 8, 4),
    shade(tor(0.045, 0.014, TINT, 0, 0.375, 0, 0, 0, 0, 4, 10), 0xc0c0c0),
    egg(0.08, 0.018, 0.04, LEAF_D, -0.07, 0.345, 0.03, 0, 0.3, 0.3, 6, 4), egg(0.08, 0.018, 0.04, LEAF_D, 0.07, 0.345, 0.03, 0, -0.3, -0.3, 6, 4),
    bead(0.026, CHERRY, 0, 0.36, 0.07), bead(0.024, CHERRY, -0.035, 0.355, 0.05), bead(0.024, CHERRY, 0.035, 0.355, 0.05),
  ],
});

def('ornament', {
  label: 'Ornament', col: { t: 'ball', r: 0.28 }, fit: 0.56, value: 1, mass: 0.15,
  tints: [0xe8334f, 0xffc23a, 0x3f8dff, 0x2fb36a, 0x9b6bff, 0xff6fb5],
  build: () => {
    const p = [
      egg(0.25, 0.25, 0.25, TINT, 0, 0.25, 0, 0, 0, 0, 16, 12),
      tor(0.252, 0.022, WHITE, 0, 0.25, 0, PI / 2, 0, 0, 4, 20),
      tcyl(0.07, 0.075, 0.06, GOLD, 0, 0.52, 0, 0, 0, 0, 10),
      tor(0.03, 0.009, GOLD, 0, 0.57, 0, 0, 0, 0, 4, 10),
    ];
    for (let k = 0; k < 10; k++) {
      const a = (k * TAU) / 10 + (k % 2) * 0.3, y = k % 2 ? 0.335 : 0.165, r = Math.sqrt(0.25 ** 2 - (y - 0.25) ** 2);
      p.push(spark(0.022, WHITE, r * Math.sin(a), y, r * Math.cos(a)));
    }
    return p;
  },
});

// Flat gingerbread cookie: icing face, cuffs and tinted gumdrop buttons + bow tie.
function gingerOutline(s) {
  const P = [], arc = (cx, cz, r, a0, a1, n) => { for (let i = 0; i <= n; i++) { const a = a0 + ((a1 - a0) * i) / n; P.push([cx + r * Math.cos(a), cz + r * Math.sin(a)]); } };
  P.push([0, 0.15], [0.035, 0.17]);
  arc(0.115, 0.28, 0.055, PI, 0, 6);
  P.push([0.135, 0.12], [0.135, 0.045], [0.27, 0.045]);
  arc(0.27, -0.01, 0.055, PI / 2, -PI / 2, 6);
  P.push([0.12, -0.065], [0.065, -0.085]);
  arc(0, -0.205, 0.136, Math.atan2(0.12, 0.065), -PI / 2, 10);
  const right = P.slice();
  for (let i = right.length - 2; i >= 1; i--) P.push([-right[i][0], right[i][1]]);
  return P.map(([x, z]) => [x * s, z * s]);
}
def('gingerman', {
  label: 'Gingerbread Man', col: { t: 'box', w: 0.58, h: 0.11, d: 0.6 }, fit: 0.83, value: 1, mass: 0.15,
  tints: [0xe8423c, 0x3fbf6f, 0xff7ac0, 0x4f8dff, 0xffc93a],
  build: () => {
    const s = 0.82, T = 0.08;
    const p = [
      prism(gingerOutline(s), T, GINGER, 0, 0, 0, 0.02),
      bead(0.022, WHITE, -0.04, T, -0.19), bead(0.022, WHITE, 0.04, T, -0.19),
      tor(0.04, 0.011, WHITE, 0, T + 0.004, -0.15, PI / 2, 0, 0, 3, 8, PI),
      egg(0.035, 0.018, 0.026, TINT, -0.03, T + 0.008, -0.07, 0, 0, 0, 6, 4), egg(0.035, 0.018, 0.026, TINT, 0.03, T + 0.008, -0.07, 0, 0, 0, 6, 4), bead(0.016, TINT, 0, T + 0.008, -0.07),
    ];
    for (const z of [-0.015, 0.035, 0.085]) p.push(egg(0.026, 0.02, 0.026, TINT, 0, T + 0.006, z, 0, 0, 0, 8, 5));
    for (const sx of [-1, 1]) {
      for (const dx of [0, 0.03]) p.push(tbox(0.012, 0.012, 0.075, WHITE, sx * (0.19 + dx), T + 0.005, -0.008));
      for (const dz of [0, 0.03]) p.push(tbox(0.075, 0.012, 0.012, WHITE, sx * 0.095, T + 0.005, 0.19 + dz));
    }
    return C(p);
  },
});

const stadium = (x0, z0, x1, z1, r, n = 6) => {
  const a = Math.atan2(z1 - z0, x1 - x0), pts = [];
  for (let i = 0; i <= n; i++) { const t = a + PI / 2 + (i / n) * PI; pts.push([x0 + r * Math.cos(t), z0 + r * Math.sin(t)]); }
  for (let i = 0; i <= n; i++) { const t = a - PI / 2 + (i / n) * PI; pts.push([x1 + r * Math.cos(t), z1 + r * Math.sin(t)]); }
  return pts;
};
def('mitten', {
  label: 'Mitten', col: { t: 'box', w: 0.52, h: 0.13, d: 0.52 }, fit: 0.74, value: 1, mass: 0.15,
  tints: [0xe8423c, 0x3f7fe0, 0x2fb36a, 0x9b6bff, 0xff6fb5],
  build: () => {
    const palm = [[0.15, 0.08]];
    for (let i = 0; i <= 10; i++) { const a = -(i / 10) * PI; palm.push([0.15 * Math.cos(a), -0.14 + 0.15 * Math.sin(a)]); }
    palm.push([-0.15, 0.08]);
    const p = [
      prism(palm, 0.12, TINT, 0, 0, 0, 0.03),
      prism(stadium(0.1, 0.0, 0.24, -0.12, 0.06), 0.11, TINT, 0, 0, 0, 0.03),
      prism(heartPts(0.14).map(([u, v]) => [u, -v]), 0.012, WHITE, 0, 0.12, -0.13),
    ];
    for (const x of [-0.12, -0.04, 0.04, 0.12]) p.push(egg(0.075, 0.065, 0.07, WHITE, x, 0.07, 0.13, 0, 0, 0, 8, 5));
    for (const x of [-0.1, 0, 0.1]) p.push(shade(tbox(0.018, 0.012, 0.12, TINT, x, 0.122, -0.01), 0xc4c4c4, 1));
    return C(p);
  },
});

def('present', {
  label: 'Present', col: { t: 'box', w: 0.7, h: 0.76, d: 0.7 }, fit: 0.99, value: 2, mass: 0.2,
  tints: [0xff4d5a, 0x3fbf6f, 0x4f8dff, 0xa070ff, 0xff7ac0, 0x2ec9c0],
  build: () => {
    const RIB = 0xfff3d6;
    const p = [
      rbox(0.66, 0.5, 0.66, TINT, 0, 0, 0, 0.035),
      shade(box(0.7, 0.1, 0.7, TINT, 0, 0.44, 0), 0xdcdcdc),
      box(0.12, 0.545, 0.705, RIB, 0, 0, 0), box(0.705, 0.545, 0.12, RIB, 0, 0, 0),
      bead(0.06, RIB, 0, 0.565, 0),
    ];
    for (const s of [-1, 1]) {
      p.push(tor(0.1, 0.035, RIB, s * 0.1, 0.615, 0, 0, s * 0.35, -s * 0.5, 5, 12));
      p.push(tbox(0.05, 0.012, 0.17, RIB, s * 0.06, 0.552, 0.14, 0, s * 0.4, 0));
    }
    return p;
  },
});

def('snowman', {
  label: 'Snowman', col: { t: 'box', w: 1.2, h: 1.84, d: 0.86 }, fit: 1.48, value: 3, mass: 0.4,
  tints: [0xe8423c, 0x3f7fe0, 0x2fb36a, 0x9b6bff, 0xff8a3d],
  build: () => {
    const p = [
      ...snowEgg(0.42, 0.38, 0.42, 0, 0.38, 0, 12, 8),
      ...snowEgg(0.31, 0.29, 0.31, 0, 0.97, 0, 12, 8),
      ...snowEgg(0.23, 0.22, 0.23, 0, 1.42, 0, 12, 8),
      ...[[0, 1.03, 0.295, 0.035], [0, 0.9, 0.3, 0.035], [0, 0.55, 0.39, 0.04], [-0.075, 1.48, 0.205, 0.03], [0.075, 1.48, 0.205, 0.03]]
        .map(([x, y, z, r]) => egg(r, r, r, COAL, x, y, z, 0, 0, 0, 6, 4)),
      tcyl(0, 0.045, 0.2, CARROT, 0, 1.42, 0.31, PI / 2, 0, 0, 8),
      tor(0.235, 0.06, TINT, 0, 1.22, 0, PI / 2, 0, 0, 5, 14),
      tbox(0.11, 0.32, 0.05, TINT, 0.13, 1.06, 0.255, 0.22, 0, 0.12),
      shade(tbox(0.115, 0.04, 0.055, TINT, 0.135, 1.01, 0.266, 0.22, 0, 0.12), 0xffffff, 0.35),
      shade(tbox(0.115, 0.04, 0.055, TINT, 0.14, 0.94, 0.282, 0.22, 0, 0.12), 0xffffff, 0.35),
      egg(0.215, 0.16, 0.215, TINT, 0, 1.58, -0.01, 0, 0, 0, 10, 6),
      pale(tor(0.205, 0.042, TINT, 0, 1.57, -0.01, PI / 2, 0, 0, 4, 14), 0.4),
      egg(0.075, 0.075, 0.075, WHITE, 0, 1.76, -0.01, 0, 0, 0, 7, 5),
    ];
    for (let i = -2; i <= 2; i++) p.push(spark(0.016, COAL, i * 0.042, 1.355 + Math.abs(i) * 0.014, 0.212 - Math.abs(i) * 0.012));
    for (const s of [-1, 1]) {
      p.push(egg(0.04, 0.022, 0.012, BLUSH, s * 0.13, 1.4, 0.19, 0, s * 0.6, 0, 6, 4));
      p.push(tcyl(0.018, 0.025, 0.4, WOOD_D, s * 0.42, 1.12, 0, 0, 0, -s * 1.0, 5), tcyl(0.012, 0.015, 0.12, WOOD_D, s * 0.54, 1.27, 0, 0, 0, -s * 0.2, 4));
    }
    return p;
  },
});

// A kid cheering on a saucer sled: jacket and bobble hat take the tint, the scarf and
// mittens stay sunny yellow, a fringe of hair peeks out under the hat.
def('sledkid', {
  label: 'Sledding Kid', col: { t: 'cyl', r: 0.53, h: 0.9 }, fit: 1.06, value: 2, mass: 0.3,
  tints: [0xe8423c, 0x3f7fe0, 0x2fb36a, 0x9b6bff, 0xff8a3d, 0xff6fb5],
  build: () => {
    const SCARF = 0xffd23f, HAIR = 0x8a5a3c;
    const p = [
      lathe([[0, 0], [0.3, 0], [0.45, 0.04], [0.52, 0.1], [0.53, 0.13], [0.5, 0.145], [0.44, 0.1], [0, 0.07]], 0x45b4ff, 0, 0, 0, 16),
      egg(0.18, 0.21, 0.15, TINT, 0, 0.33, -0.03, 0, 0, 0, 10, 7),
      tor(0.1, 0.04, SCARF, 0, 0.53, -0.02, PI / 2, 0, 0, 4, 10), tbox(0.07, 0.16, 0.03, SCARF, 0.07, 0.46, 0.1, 0.3, 0, 0.25),
      egg(0.13, 0.13, 0.125, SKIN, 0, 0.66, 0, 0, 0, 0, 10, 7),
      egg(0.06, 0.04, 0.05, HAIR, -0.08, 0.72, 0.08, 0, 0, 0.5, 6, 4), egg(0.06, 0.04, 0.05, HAIR, 0.08, 0.72, 0.08, 0, 0, -0.5, 6, 4),
      ...face(0, 0.655, 0.118, 0.045, 0.018, true),
      egg(0.135, 0.1, 0.135, TINT, 0, 0.75, -0.01, 0, 0, 0, 10, 6),
      shade(tor(0.125, 0.03, TINT, 0, 0.74, -0.01, PI / 2, 0, 0, 3, 10), 0xb0b0b0),
      egg(0.05, 0.05, 0.05, WHITE, 0, 0.865, -0.01, 0, 0, 0, 7, 5),
    ];
    for (const s of [-1, 1]) {
      p.push(tcyl(0.07, 0.075, 0.3, NAVY, s * 0.09, 0.16, 0.16, PI / 2 - 0.15, 0, 0, 8), egg(0.075, 0.065, 0.1, 0x6b4a3a, s * 0.09, 0.2, 0.33, 0, 0, 0, 7, 5));
      p.push(tcyl(0.055, 0.065, 0.3, TINT, s * 0.21, 0.55, -0.02, 0, 0, -s * 0.55, 8), egg(0.06, 0.06, 0.06, SCARF, s * 0.3, 0.69, -0.02, 0, 0, 0, 7, 5));
    }
    return p;
  },
});

def('sled', {
  label: 'Sled', col: { t: 'box', w: 1.36, h: 0.27, d: 0.58 }, fit: 1.48, value: 3, mass: 0.3,
  tints: [0xe8423c, 0x3f7fe0, 0x3fa34d, 0xd39a5e],
  build: () => {
    const RUN = 0x4a4f63, p = [];
    for (const s of [-1, 1]) {
      p.push(box(1.1, 0.04, 0.05, RUN, -0.05, 0, s * 0.24));
      p.push(custom(new THREE.TorusGeometry(0.11, 0.022, 4, 10, PI * 1.1).rotateZ(-PI * 0.5).translate(0.5, 0.13, s * 0.24), RUN));
      for (const x of [-0.42, 0.0, 0.36]) p.push(box(0.04, 0.17, 0.04, RUN, x, 0.03, s * 0.24));
    }
    for (let i = 0; i < 4; i++) p.push(box(1.15, 0.05, 0.12, TINT, -0.05, 0.2, -0.195 + i * 0.13));
    p.push(box(0.08, 0.04, 0.58, WOOD_D, -0.45, 0.16, 0), box(0.08, 0.04, 0.58, WOOD_D, 0.3, 0.16, 0));
    p.push(custom(new THREE.TorusGeometry(0.22, 0.015, 3, 12, PI).rotateZ(-PI / 2).rotateX(PI / 2).translate(0.5, 0.235, 0), 0xf2d6a0));
    return C(p);
  },
});

def('snowpine', {
  label: 'Snowy Pine', col: { t: 'cyl', r: 0.8, h: 2.46 }, fit: 1.6, value: 4, mass: 0.6,
  tints: [0x2e8b57, 0x247a4a, 0x3d8f88, 0x4fa860],
  build: () => {
    const p = [egg(0.55, 0.06, 0.55, SNOW, 0, 0.06, 0, 0, 0, 0, 12, 4), tcyl(0.11, 0.14, 0.5, 0x7a5233, 0, 0.3, 0, 0, 0, 0, 8)];
    for (const [R, H, y] of [[0.8, 1.05, 0.38], [0.63, 0.95, 0.95], [0.45, 0.85, 1.5]]) {
      p.push(cone(R, H, TINT, 0, y, 0, 10), cone(R * 0.55, H * 0.55, SNOW, 0, y + H * 0.45 + 0.014, 0, 10));
      for (let k = 0; k < 5; k++) { const a = (k * TAU) / 5 + y * 2; p.push(egg(0.11, 0.05, 0.09, SNOW, R * 0.84 * Math.sin(a), y + 0.07, R * 0.84 * Math.cos(a), 0, a, 0, 6, 4)); }
    }
    p.push(egg(0.09, 0.08, 0.09, SNOW, 0, 2.38, 0, 0, 0, 0, 8, 5));
    return p;
  },
});

// Snow globe: the glass is drawn as its inner back half plus a bright rim, so the little
// winter scene inside stays visible from the game camera.
def('snowglobe', {
  label: 'Snow Globe', col: { t: 'cyl', r: 0.41, h: 0.94 }, fit: 0.82, value: 1, mass: 0.2,
  tints: [0xe8423c, 0x3f7fe0, 0x2fb36a, 0x9b6bff, 0xffc23a],
  build: () => {
    const R = 0.4, cy = 0.62, pitch = 1.0, vy = Math.sin(pitch), vz = Math.cos(pitch);
    const glass = shellInside(new THREE.SphereGeometry(R, 20, 14), (x, y, z) => y * vy + z * vz < 0.02);
    const p = [
      lathe([[0, 0], [0.38, 0], [0.4, 0.03], [0.38, 0.08], [0.31, 0.2], [0.3, 0.26], [0, 0.26]], TINT, 0, 0, 0, 18),
      tor(0.33, 0.02, GOLD, 0, 0.18, 0, PI / 2, 0, 0, 3, 18),
      custom(glass.translate(0, cy, 0), 0xc4def4),
      cyl(0.235, 0.235, 0.05, SNOW, 0, 0.26, 0, 16),
      box(0.16, 0.13, 0.13, 0xe8584a, -0.08, 0.31, -0.04), roof(0.2, 0.1, 0.17, SNOW, -0.08, 0.44, -0.04), box(0.04, 0.07, 0.01, WARM, -0.08, 0.31, 0.03),
      tcyl(0.025, 0.025, 0.06, 0x7a5233, 0.11, 0.33, 0.0, 0, 0, 0, 5), cone(0.1, 0.17, 0x2e8b57, 0.11, 0.34, 0.0, 8), cone(0.07, 0.14, 0x2e8b57, 0.11, 0.45, 0.0, 8), cone(0.04, 0.07, SNOW, 0.11, 0.53, 0.0, 8),
      custom(new THREE.TorusGeometry(R, 0.016, 3, 32).rotateX(-pitch).translate(0, cy, 0), 0xffffff),
      custom(new THREE.TorusGeometry(R * 0.84, 0.02, 3, 8, 0.75).rotateZ(1.95).rotateX(-pitch).translate(0, cy, 0), 0xffffff),
    ];
    [[0.12, 0.8, -0.05], [-0.15, 0.72, 0.0], [0.02, 0.92, -0.1], [-0.05, 0.62, 0.12], [0.2, 0.65, 0.08], [-0.2, 0.86, -0.12]]
      .forEach(([x, y, z]) => p.push(spark(0.016, 0xffffff, x, y, z)));
    return p;
  },
});

def('iceskate', {
  label: 'Ice Skate', col: { t: 'box', w: 0.66, h: 0.66, d: 0.3 }, fit: 0.72, value: 1, mass: 0.15,
  tints: [0xfafafa, 0xff9ec8, 0x8fc8ff, 0xc9b2ff, 0xff5a5f],
  build: () => {
    const p = [
      box(0.58, 0.035, 0.03, SILVER, 0.04, 0, 0),
      custom(new THREE.TorusGeometry(0.06, 0.016, 4, 8, PI * 0.9).rotateZ(-PI * 0.45).translate(0.33, 0.075, 0), SILVER),
      box(0.04, 0.12, 0.03, STEEL, -0.16, 0.03, 0), box(0.04, 0.12, 0.03, STEEL, 0.2, 0.03, 0),
      box(0.5, 0.04, 0.19, NAVY, 0.02, 0.15, 0),
      egg(0.27, 0.11, 0.105, TINT, 0.05, 0.27, 0, 0, 0, 0, 14, 8),
      tcyl(0.11, 0.115, 0.34, TINT, -0.1, 0.45, 0, 0, 0, 0, 12),
      tor(0.112, 0.035, WHITE, -0.1, 0.62, 0, PI / 2, 0, 0, 5, 12),
      pale(bead(0.04, TINT, 0.03, 0.6, 0.05), 0.45), pale(bead(0.04, TINT, 0.03, 0.6, -0.05), 0.45),
    ];
    for (const y of [0.33, 0.41, 0.49]) for (const s of [-1, 1]) p.push(tbox(0.01, 0.012, 0.15, WHITE, 0.014, y, 0, s * 0.5, 0, 0));
    return C(p);
  },
});

def('igloo', {
  label: 'Igloo', col: { t: 'box', w: 2.4, h: 1.56, d: 2.86 }, fit: 3.73, value: 22, mass: 3,
  tints: [0xf6faff, 0xbfe0ff, 0xc4f0de, 0xd9cfff],
  build: () => {
    const R = 1.2, SEAM = 0x8e9db6, BASE = 0xc2d0e4;
    const dome = Array.from({ length: 9 }, (_, i) => { const a = (i / 8) * (PI / 2); return [R * Math.cos(a), R * Math.sin(a)]; });
    dome[8][0] = 0;
    const tunnel = new THREE.CylinderGeometry(0.5, 0.5, 0.7, 12, 1, false, PI / 2, PI).rotateX(PI / 2).translate(0, 0, 1.3);
    const p = [
      ...two(latheGeo(dome, 24), (x, y) => y > 0.3, TINT, TINT).map((q, i) => (q && i ? shade(q, BASE) : q)),
      ...two(tunnel, (x, y) => y > 0.22, TINT, TINT).map((q, i) => (q && i ? shade(q, BASE) : q)),
      custom(new THREE.CylinderGeometry(0.34, 0.34, 0.02, 10, 1, false, PI / 2, PI).rotateX(PI / 2).translate(0, 0, 1.655), 0x2f3d5c),
      shade(tor(0.5, 0.035, TINT, 0, 0, 1.63, 0, 0, 0, 3, 10, PI), SEAM),
      tcyl(0.015, 0.015, 0.42, WOOD_D, 0.3, 1.34, 0.2, 0, 0, 0, 5), vprism([[0, 0], [0.24, 0.07], [0, 0.14]], 0.02, 0xff5a5f, 0.31, 1.4, 0.2),
    ];
    // a string of fairy lights over the doorway
    [0xff4a5a, 0xffd23f, 0x4fb8ff, 0x6fd16a, 0xff7ac0].forEach((c, i) => { const a = 0.35 + (i * (PI - 0.7)) / 4; p.push(spark(0.045, c, 0.56 * Math.cos(a), 0.56 * Math.sin(a), 1.64)); });
    const rows = [0, 0.32, 0.64, 0.93];
    for (const y of rows.slice(1)) p.push(shade(tor(Math.sqrt(R * R - y * y) + 0.004, 0.022, TINT, 0, y, 0, PI / 2, 0, 0, 3, 24), SEAM));
    for (let k = 0; k < 3; k++) {
      const y = (rows[k] + rows[k + 1]) / 2, phi = Math.asin(y / R), r = R * Math.cos(phi) + 0.004, n = [9, 8, 6][k];
      for (let i = 0; i < n; i++) {
        const a = ((i + (k % 2) * 0.5) * TAU) / n;
        if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.35 && k < 2) continue; // keep the tunnel side clear
        p.push(shade(tbox(0.03, rows[k + 1] - rows[k], 0.03, TINT, r * Math.sin(a), y, r * Math.cos(a), -phi, a, 0), SEAM));
      }
    }
    return C(p);
  },
});

// Cozy log cabin under deep snow: warm windows, a wreath, fairy lights and chimney smoke.
def('cabin', {
  label: 'Cozy Cabin', col: { t: 'box', w: 4.76, h: 5.68, d: 3.96 }, fit: 6.19, value: 61, mass: 9,
  tints: [0xc98b55, 0x9b6b43, 0xc8453b, 0x8fae8a],
  build: () => {
    const WY = 0.25, top = 2.45, HW = 2.25, RH = 1.55, ang = Math.atan2(RH, HW), SL = Math.hypot(RH, HW);
    const DOOR = 0x7a452a, EAVE = 0x5a3a2a, FRAME = 0xf6e7cf, SMOKE = 0xeef2f7, ICE = 0xd6efff;
    const log = (L, x, y, z, alongZ, r = 0.165) => two(new THREE.CylinderGeometry(r, r, L, 7).rotateZ(alongZ ? 0 : PI / 2).rotateX(alongZ ? PI / 2 : 0).translate(x, y, z),
      (px, py, pz) => (alongZ ? Math.abs(pz - z) : Math.abs(px - x)) > L / 2 - 0.02, LOG_END, TINT);
    const p = [
      box(3.9, WY, 3.3, STONE),
      shade(box(3.3, 2.15, 2.75, TINT, 0, WY, 0), 0x8a8a8a),
      shade(roof(2 * HW, RH, 3.3, TINT, 0, top, 0), 0xdedede),
    ];
    for (let i = 0; i < 7; i++) {
      for (const s of [-1, 1]) p.push(...log(3.8, 0, 0.42 + i * 0.31, s * 1.45, false), ...log(3.2, s * 1.65, 0.575 + i * 0.31, 0, true));
    }
    // roof: dark eaves under thick snow, a snow roll on the ridge, icicles
    for (const s of [-1, 1]) {
      const nx = s * Math.sin(ang), ny = Math.cos(ang), mx = (s * HW) / 2, my = top + RH / 2;
      // the snow blanket stops short of the eave so a band of roof shows along the edge
      const ux = -s * Math.cos(ang), uy = Math.sin(ang);
      p.push(tbox(SL + 0.14, 0.1, 3.9, EAVE, mx + nx * 0.05, my + ny * 0.05, 0, 0, 0, -s * ang));
      p.push(tbox(SL - 0.16, 0.17, 3.95, SNOW, mx + nx * 0.16 + ux * 0.15, my + ny * 0.16 + uy * 0.15, 0, 0, 0, -s * ang));

      for (const z of [-1.4, -0.7, 0, 0.7, 1.4]) p.push(tcyl(0.04, 0, 0.17, ICE, s * (HW + 0.05), top - 0.05, z + 0.1 * s, 0, 0, 0, 6));
    }
    p.push(tcyl(0.15, 0.15, 3.95, SNOW, 0, top + RH + 0.12, 0, PI / 2, 0, 0, 8));
    // chimney with smoke
    p.push(box(0.55, 1.45, 0.55, STONE, 1.1, 3.05, -0.7), box(0.65, 0.12, 0.65, STONE_D, 1.1, 4.45, -0.7), box(0.6, 0.07, 0.6, SNOW, 1.1, 4.57, -0.7),
      egg(0.22, 0.18, 0.22, SMOKE, 1.22, 4.92, -0.74, 0, 0, 0, 7, 5), egg(0.17, 0.14, 0.17, SMOKE, 1.42, 5.25, -0.8, 0, 0, 0, 7, 5), egg(0.12, 0.1, 0.12, SMOKE, 1.6, 5.56, -0.86, 0, 0, 0, 7, 5));
    // front: door with a wreath, warm windows with snowy sills, a round gable window
    const F = 1.62;
    p.push(box(0.75, 1.3, 0.06, DOOR, 0, WY, F), bar(-0.4, WY, -0.4, WY + 1.35, F + 0.04, 0.07, 0.04, FRAME), bar(0.4, WY, 0.4, WY + 1.35, F + 0.04, 0.07, 0.04, FRAME),
      bar(-0.43, WY + 1.35, 0.43, WY + 1.35, F + 0.04, 0.07, 0.04, FRAME), spark(0.04, GOLD, 0.24, WY + 0.62, F + 0.05));
    p.push(tor(0.17, 0.055, LEAF_D, 0, 1.25, F + 0.07, 0, 0, 0, 4, 10), spark(0.04, CHERRY, 0, 1.08, F + 0.11), egg(0.06, 0.035, 0.02, CHERRY, -0.05, 1.1, F + 0.11, 0, 0, 0.5, 6, 4), egg(0.06, 0.035, 0.02, CHERRY, 0.05, 1.1, F + 0.11, 0, 0, -0.5, 6, 4));
    for (const [a, r] of [[0.6, 0.17], [1.9, 0.17], [2.6, 0.17], [-0.5, 0.17]]) p.push(spark(0.025, CHERRY, Math.cos(a) * r, 1.25 + Math.sin(a) * r, F + 0.12));
    for (const x of [-1.05, 1.05]) {
      p.push(box(0.62, 0.62, 0.05, FRAME, x, 0.84, F + 0.01), box(0.5, 0.5, 0.06, WARM, x, 0.9, F + 0.02),
        box(0.04, 0.5, 0.07, FRAME, x, 0.9, F + 0.03), box(0.5, 0.04, 0.07, FRAME, x, 1.13, F + 0.03), box(0.72, 0.06, 0.16, SNOW, x, 0.8, F + 0.06));
    }
    p.push(tcyl(0.22, 0.22, 0.05, WARM, 0, 3.0, 1.66, PI / 2, 0, 0, 14), tor(0.22, 0.035, FRAME, 0, 3.0, 1.68, 0, 0, 0, 4, 14),
      box(0.03, 0.4, 0.03, FRAME, 0, 2.8, 1.69), box(0.4, 0.03, 0.03, FRAME, 0, 2.985, 1.69));
    // side windows
    for (const s of [-1, 1]) p.push(box(0.05, 0.62, 0.62, FRAME, s * 1.82, 0.95, 0), box(0.06, 0.5, 0.5, WARM, s * 1.825, 1.01, 0));
    // fairy lights along the front roof edges
    const LIGHTS = [0xff4a5a, 0xffd23f, 0x4fb8ff, 0x6fd16a];
    for (let i = 0; i < 9; i++) {
      const t = i / 8, x = -HW + 2 * HW * t, y = top + RH * (1 - Math.abs(2 * t - 1)) - 0.12 - 0.06 * Math.sin(t * PI * 4) ** 2;
      p.push(spark(0.05, LIGHTS[i % 4], x * 0.98, y, 1.9));
    }
    // a little woodpile under the left eave
    for (const [y, z] of [[0.1, 0.5], [0.1, 0.71], [0.27, 0.6]]) p.push(...log(0.55, -2.0, y, z, false, 0.1));
    return C(p);
  },
});

export const WAVE2_WORLDS = {
  candy: ['jellybean', 'marshmallow', 'peppermint', 'gummybear', 'candycane', 'cottoncandy', 'gumballmachine', 'swirlpop', 'chocbar', 'cupcaketower', 'candyhouse', 'cottoncastle'],
  farm: ['chick', 'milkcan', 'duckling', 'carrot', 'applecrate', 'piglet', 'haybale', 'sheep', 'scarecrow', 'cow', 'wheelbarrow', 'tractor', 'barn'],
  snow: ['snowball', 'jinglebell', 'ornament', 'mitten', 'iceskate', 'snowglobe', 'gingerman', 'present', 'sledkid', 'snowman', 'sled', 'snowpine', 'igloo', 'cabin'],
};
