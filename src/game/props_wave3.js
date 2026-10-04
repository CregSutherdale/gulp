// Season 3 prop pack: Craft Corner, Fun Fair and Moon Camp.
// Same conventions as props_cozy.js / props_wave2.js: glossy toy look from code geometry
// only (no external art), base at y=0, centered on the collider, fronts face +z (the
// camera), vehicles point +x. `fit` = smallest hole diameter that swallows it,
// `value` ~ 1.6*fit^2. tools/check_levels.mjs validates every prop.
// Season 3 is the CHALLENGE season, so several props come in look-alike pairs: a small
// edible one and a big decoy that looks the same (yarnball/bigyarn, button/bigbutton,
// planet/bigplanet), and most small props come in 5-7 colors so color targets can hide.
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

// ======================================================================== CRAFT CORNER
// A sewing button: raised rim, dished middle, four thread holes.
function buttonParts() {
  const p = [lathe([[0, 0], [0.17, 0], [0.198, 0.015], [0.2, 0.05], [0.185, 0.075], [0.16, 0.078], [0.135, 0.062], [0, 0.056]], TINT, 0, 0, 0, 22)];
  for (const [x, z] of [[-0.045, -0.045], [0.045, -0.045], [-0.045, 0.045], [0.045, 0.045]]) p.push(shade(tcyl(0.024, 0.024, 0.012, TINT, x, 0.058, z, 0, 0, 0, 8), 0x5a5a5a));
  p.push(pale(tor(0.155, 0.008, TINT, 0, 0.074, 0, PI / 2, 0, 0, 3, 20), 0.55));
  return p;
}
def('button', {
  label: 'Button', col: { t: 'cyl', r: 0.2, h: 0.08 }, fit: 0.4, value: 1, mass: 0.15,
  tints: RAINBOW,
  build: () => buttonParts(),
});
def('bigbutton', {
  label: 'Big Button', col: { t: 'cyl', r: 0.8, h: 0.24 }, fit: 1.6, value: 4, mass: 0.6,
  tints: RAINBOW,
  build: () => scaled(buttonParts(), 4, 3, 4),
});

def('thimble', {
  label: 'Thimble', col: { t: 'cyl', r: 0.19, h: 0.34 }, fit: 0.38, value: 1, mass: 0.15,
  tints: [0xe1e7ef, 0xffc94a, 0xffa9c4, 0x8fe3c4, 0x9fc8ff],
  build: () => {
    const p = [
      lathe([[0, 0], [0.17, 0], [0.19, 0.015], [0.19, 0.055], [0.172, 0.075], [0.166, 0.25], [0.15, 0.3], [0.11, 0.33], [0.05, 0.34], [0, 0.34]], TINT, 0, 0, 0, 18),
      pale(tor(0.183, 0.012, TINT, 0, 0.05, 0, PI / 2, 0, 0, 3, 18), 0.4),
    ];
    // dimples: rings of dots up the sides and a few on the crown
    for (const [y, rr, n] of [[0.12, 0.17, 12], [0.19, 0.168, 12], [0.26, 0.16, 11]]) for (let i = 0; i < n; i++) {
      const a = (i + (y > 0.15 ? 0.5 : 0)) * TAU / n;
      p.push(shade(spark(0.014, TINT, rr * Math.sin(a), y, rr * Math.cos(a)), 0x8a8a8a));
    }
    for (let i = 0; i < 5; i++) { const a = i * TAU / 5; p.push(shade(spark(0.013, TINT, 0.06 * Math.sin(a), 0.335, 0.06 * Math.cos(a)), 0x8a8a8a)); }
    return p;
  },
});

def('pompom', {
  label: 'Pom-Pom', col: { t: 'ball', r: 0.22 }, fit: 0.44, value: 1, mass: 0.15,
  tints: POPS,
  build: () => {
    const p = [egg(0.18, 0.18, 0.18, TINT, 0, 0.22, 0, 0, 0, 0, 10, 8)];
    fib(16).forEach(([x, y, z], i) => p.push(i % 3 ? egg(0.075, 0.075, 0.075, TINT, x * 0.146, 0.22 + y * 0.146, z * 0.146, 0, 0, 0, 6, 5)
      : pale(egg(0.072, 0.072, 0.072, TINT, x * 0.148, 0.22 + y * 0.148, z * 0.148, 0, 0, 0, 6, 5), 0.75)));
    return p;
  },
});

def('spool', {
  label: 'Thread Spool', col: { t: 'cyl', r: 0.26, h: 0.5 }, fit: 0.52, value: 1, mass: 0.15,
  tints: [0xf2334f, 0x3f8dff, 0xffd23a, 0x5fd16a, 0xa070ff, 0xff7ac0],
  build: () => {
    const p = [
      lathe([[0, 0], [0.24, 0], [0.26, 0.02], [0.26, 0.05], [0.24, 0.065], [0, 0.065]], WOOD_L, 0, 0, 0, 18),
      // the top flange is small, so the thread color reads from above
      lathe([[0, 0], [0.16, 0], [0.175, 0.015], [0.175, 0.04], [0.16, 0.055], [0, 0.055]], WOOD_L, 0, 0.445, 0, 16),
      tcyl(0.245, 0.24, 0.38, TINT, 0, 0.255, 0, 0, 0, 0, 18),
      egg(0.245, 0.03, 0.245, TINT, 0, 0.445, 0, 0, 0, 0, 18, 4),
      tcyl(0.06, 0.06, 0.012, WOOD_D, 0, 0.502, 0, 0, 0, 0, 10),
    ];
    for (const y of [0.13, 0.21, 0.29, 0.37]) p.push(shade(tor(0.244, 0.008, TINT, 0, y, 0, PI / 2, 0, 0, 3, 18), 0xd0d0d0));
    // a loose thread end curling down the front
    p.push(tcyl(0.01, 0.01, 0.2, TINT, 0.06, 0.2, 0.25, 0, 0, 0.25, 4));
    return p;
  },
});

def('tapemeasure', {
  label: 'Tape Measure', col: { t: 'cyl', r: 0.36, h: 0.24 }, fit: 0.72, value: 1, mass: 0.15,
  tints: [0xffd23a, 0xff5c8a, 0x5cc8ff, 0x7be07a, 0xb48cff],
  build: () => {
    const p = [
      lathe([[0, 0], [0.29, 0], [0.32, 0.03], [0.33, 0.12], [0.32, 0.21], [0.29, 0.24], [0, 0.24]], TINT, -0.03, 0, 0, 20),
      tcyl(0.17, 0.17, 0.01, WHITE, -0.03, 0.242, 0, 0, 0, 0, 16),
      tcyl(0.05, 0.05, 0.014, STEEL, -0.03, 0.247, 0, 0, 0, 0, 10),
      // the tape pulled out a little, with its metal tab
      tbox(0.08, 0.05, 0.2, 0xfff1a8, 0.32, 0.03, 0.0),
      tbox(0.015, 0.07, 0.2, STEEL, 0.36, 0.035, 0),
    ];
    for (let i = 0; i < 6; i++) p.push(tbox(0.01, 0.051, 0.03, INK, 0.31 + (i % 2) * 0.004, 0.031, -0.075 + i * 0.03));
    for (let i = 0; i < 4; i++) { const a = i * TAU / 4 + 0.4; p.push(shade(spark(0.02, TINT, -0.03 + 0.23 * Math.sin(a), 0.245, 0.23 * Math.cos(a)), 0x9a9a9a)); }
    return C(p);
  },
});

// Yarn ball: a core wrapped in strands, two knitting needles stuck in the top.
function yarnParts() {
  const p = [egg(0.415, 0.415, 0.415, TINT, 0, 0.45, 0, 0, 0, 0, 14, 10)];
  [[0, 0, 0], [PI / 2, 0, 0.5], [0.9, 0.6, 1.2], [1.6, 1.1, 2.4], [0.4, 2.2, 0.9], [2.4, 0.3, 1.7]].forEach(([rx, ry, rz], i) =>
    p.push(i % 2 ? shade(tor(0.42, 0.02, TINT, 0, 0.45, 0, rx, ry, rz, 3, 20), 0xc8c8c8) : pale(tor(0.42, 0.02, TINT, 0, 0.45, 0, rx, ry, rz, 3, 20), 0.75)));
  for (const s of [-1, 1]) {
    p.push(tcyl(0.02, 0.02, 0.62, s < 0 ? 0xff9ec8 : 0x9fd2ff, s * 0.1, 0.565, -0.02, 0.15, 0, -s * 0.32, 6));
    p.push(bead(0.035, s < 0 ? 0xff6fa0 : 0x5aa8ff, s * 0.1 + s * 0.31 * Math.sin(0.32), 0.565 + 0.31 * Math.cos(0.32), -0.02 - 0.31 * Math.sin(0.15)));
  }
  // the loose end trailing to the floor
  p.push(tcyl(0.02, 0.02, 0.26, TINT, 0.27, 0.13, 0.18, 0, 0, 0.6, 5));
  return p;
}
const YARN = [0xff5c6c, 0xffa94d, 0xffe066, 0x74d680, 0x6fb7ff, 0xc08cff];
def('yarnball', {
  label: 'Yarn Ball', col: { t: 'ball', r: 0.45 }, fit: 0.9, value: 1, mass: 0.2,
  tints: YARN,
  build: () => yarnParts(),
});
def('bigyarn', {
  label: 'Big Yarn Ball', col: { t: 'ball', r: 1.08 }, fit: 2.16, value: 7, mass: 1.4,
  tints: YARN,
  build: () => scaled(yarnParts(), 2.4),
});

def('pincushion', {
  label: 'Pincushion', col: { t: 'cyl', r: 0.5, h: 0.72 }, fit: 1.0, value: 2, mass: 0.2,
  tints: [0xf0263f, 0xff7ac0, 0x6fd16a, 0xa070ff, 0xffa52e],
  build: () => {
    const p = [ribbed(0.48, 0.62, 8, 0.12, TINT, 0, 0, 0)];
    // leafy cap
    p.push(prism(starPts(0.2, 0.42, 6), 0.03, LEAF, 0, 0.585, 0, 0.01));
    p.push(tcyl(0.025, 0.03, 0.07, 0x3d9a52, 0, 0.635, 0, 0, 0, 0, 6));
    // pins with bright heads
    const heads = [0xffd23a, 0x5cc8ff, 0xffffff, 0x7be07a, 0xb48cff, 0xff9a3a, 0xff5c8a];
    [[0.24, 0.1, 0.5], [-0.22, 0.6, 0.45], [0.05, 1.5, 0.35], [0.3, 2.6, 0.5], [-0.28, 3.6, 0.4], [0.18, 4.6, 0.45], [-0.12, 5.5, 0.3]].forEach(([d, a, tilt], i) => {
      const x = Math.abs(d) * Math.sin(a), z = Math.abs(d) * Math.cos(a), y = 0.5 - Math.abs(d) * 0.35;
      const tx = Math.sin(a) * Math.sin(tilt), tz = Math.cos(a) * Math.sin(tilt), ty = Math.cos(tilt);
      p.push(custom(new THREE.CylinderGeometry(0.008, 0.008, 0.22, 4).translate(0, 0.11, 0)
        .applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(tx, ty, tz))).translate(x, y, z), SILVER));
      p.push(bead(0.035, heads[i], x + tx * 0.22, y + ty * 0.22, z + tz * 0.22));
    });
    return p;
  },
});

def('scissors', {
  label: 'Scissors', col: { t: 'box', w: 1.1, h: 0.12, d: 0.6 }, fit: 1.25, value: 2, mass: 0.15,
  tints: [0xff5c8a, 0x3f9dff, 0xffa52e, 0x2fb3a8, 0xa070ff],
  build: () => {
    const blade = (s) => prism([[-0.05, -0.05], [0.6, -0.008], [0.6, 0.006], [-0.05, 0.05]], 0.035, SILVER, 0, 0.04 + (s > 0 ? 0.035 : 0), 0, 0.006, s * 0.13);
    const p = [blade(-1), blade(1), bead(0.04, STEEL, 0, 0.1, 0)];
    for (const s of [-1, 1]) {
      p.push(tor(0.115, 0.042, TINT, -0.4, 0.06, s * 0.15, PI / 2, 0, 0, 6, 16));
      p.push(tbox(0.22, 0.06, 0.07, TINT, -0.2, 0.06, s * 0.065, 0, -s * 0.5, 0));
    }
    return C(p);
  },
});

def('buttonjar', {
  label: 'Button Jar', col: { t: 'cyl', r: 0.5, h: 1.2 }, fit: 1.0, value: 2, mass: 0.3,
  tints: [0xff6f91, 0x5cc8ff, 0x7be07a, 0xffd23f, 0xb48cff],
  build: () => {
    const p = [
      custom(shellInside(new THREE.CylinderGeometry(0.47, 0.47, 0.9, 16, 1, true).translate(0, 0.5, 0), (x, y, z) => z < 0.12), GLASS),
      lathe([[0, 0], [0.44, 0], [0.47, 0.03], [0.47, 0.06], [0, 0.06]], 0xcfe6f7, 0, 0, 0, 16),
      tor(0.47, 0.02, 0xffffff, 0, 0.95, 0, PI / 2, 0, 0, 3, 20),
      // lid with a gingham cloth cover and a ribbon
      lathe([[0, 0], [0.48, 0], [0.5, 0.04], [0.48, 0.16], [0.4, 0.2], [0, 0.21]], TINT, 0, 0.98, 0, 16),
      pale(tor(0.475, 0.03, TINT, 0, 1.03, 0, PI / 2, 0, 0, 4, 18), 0.4),
      pale(bead(0.06, TINT, 0, 1.17, 0.36), 0.4),
    ];
    // a jumble of buttons, two-thirds full
    let k = 0;
    for (const [y, rr, n] of [[0.1, 0.26, 7], [0.22, 0.27, 7], [0.35, 0.25, 7], [0.48, 0.24, 6], [0.6, 0.12, 3]]) for (let i = 0; i < n; i++, k++) {
      const a = i * TAU / n + y * 7, c = RAINBOW[(k * 3) % 7];
      p.push(tcyl(0.11, 0.11, 0.045, c, rr * Math.sin(a), y, rr * Math.cos(a), 0.4 * Math.sin(k), 0, 0.5 * Math.cos(k * 1.7), 7));
    }
    return p;
  },
});

def('dressform', {
  label: 'Dress Form', col: { t: 'cyl', r: 0.75, h: 2.3 }, fit: 1.5, value: 4, mass: 0.5,
  tints: [0xffa6c9, 0x8fd0ff, 0xa6edd2, 0xffe58a, 0xc8b0ff],
  build: () => {
    const p = [];
    // three wooden feet, a center pole
    for (let i = 0; i < 3; i++) {
      const a = i * TAU / 3 + PI / 6;
      p.push(tbox(0.68, 0.06, 0.08, WOOD, 0.34 * Math.sin(a), 0.03, 0.34 * Math.cos(a), 0, a + PI / 2, 0));
      p.push(egg(0.06, 0.04, 0.06, WOOD_D, 0.7 * Math.sin(a), 0.04, 0.7 * Math.cos(a), 0, 0, 0, 7, 4));
    }
    p.push(tcyl(0.06, 0.07, 0.12, WOOD_D, 0, 0.12, 0), tcyl(0.03, 0.03, 0.75, GOLD, 0, 0.5, 0, 0, 0, 0, 8));
    // torso (the fabric takes the tint), neck cap
    p.push(lathe([[0, 0], [0.26, 0], [0.34, 0.08], [0.36, 0.22], [0.27, 0.48], [0.25, 0.58], [0.33, 0.82], [0.35, 0.98], [0.33, 1.12], [0.22, 1.24], [0.1, 1.28], [0, 1.28]], TINT, 0, 0.86, 0, 18));
    p.push(tcyl(0.09, 0.1, 0.12, WOOD, 0, 2.18, 0, 0, 0, 0, 10), egg(0.11, 0.05, 0.11, WOOD_D, 0, 2.29, 0, 0, 0, 0, 10, 5));
    // a tape measure round the shoulders, hanging down the front
    p.push(tor(0.25, 0.018, 0xfff1a8, 0, 2.04, 0.0, PI / 2 + 0.2, 0, 0, 3, 20));
    for (const s of [-1, 1]) p.push(tbox(0.05, 0.42, 0.015, 0xfff1a8, s * 0.1, 1.82, 0.32, -0.25, 0, s * 0.06));
    // a pin cushion on the shoulder, a sash with a bow
    p.push(egg(0.08, 0.055, 0.08, 0xf0263f, 0.2, 2.1, -0.04, 0, 0, 0.3, 8, 5));
    p.push(shade(tor(0.255, 0.035, TINT, 0, 1.4, 0, PI / 2, 0, 0, 4, 18), 0xd0d0d0));
    for (const s of [-1, 1]) p.push(shade(egg(0.08, 0.05, 0.035, TINT, s * 0.07, 1.4, 0.28, 0, 0, s * 0.4, 7, 5), 0xd0d0d0));
    return p;
  },
});

function basketWeave(rOut, h, colA, colB, x = 0, y = 0, z = 0, seg = 24) {
  const prof = [[rOut * 0.78, 0], [rOut * 0.92, 0.02 * h], [rOut, 0.25 * h], [rOut, 0.9 * h], [rOut * 0.97, h], [rOut * 0.9, h], [rOut * 0.9, 0.06 * h], [0, 0.06 * h]];
  const g = latheGeo(prof, seg).translate(x, y, z);
  return multi(g, (px, py, pz) => ((Math.floor(((Math.atan2(px - x, pz - z) + PI) / TAU) * seg) + Math.floor((py - y) / (h / 6))) % 2), [colA, colB]);
}
def('sewingbasket', {
  label: 'Sewing Basket', col: { t: 'cyl', r: 1.0, h: 1.6 }, fit: 2.0, value: 6, mass: 0.6,
  tints: [0xff8fb8, 0x7fc8ff, 0x8fe3b8, 0xffd36a],
  build: () => {
    const p = [
      ...basketWeave(0.95, 0.72, WOOD_L, WOOD, 0, 0, 0, 20),
      shade(tor(0.9, 0.05, TINT, 0, 0.72, 0, PI / 2, 0, 0, 5, 24), 0xe0e0e0),
      tcyl(0.84, 0.84, 0.02, WOOD_D, 0, 0.62, 0, 0, 0, 0, 20),
      // the handle arching over
      tor(0.82, 0.045, WOOD_D, 0, 0.72, 0, 0, 0, 0, 5, 20, PI),
      // contents: yarn, spools and a pincushion poking out
      egg(0.3, 0.28, 0.3, 0xff7a8a, -0.35, 0.78, 0.15, 0, 0, 0, 9, 6), egg(0.27, 0.25, 0.27, 0x6fb7ff, 0.3, 0.76, 0.22, 0, 0, 0, 9, 6),
      egg(0.26, 0.24, 0.26, 0xffe066, 0.05, 0.8, -0.35, 0, 0, 0, 9, 6),
      tcyl(0.12, 0.12, 0.3, 0xa070ff, 0.45, 0.8, -0.3, 0.4, 0, -0.3, 10), tcyl(0.12, 0.12, 0.3, 0x5fd16a, -0.5, 0.8, -0.3, -0.3, 0, 0.4, 10),
      egg(0.16, 0.12, 0.16, TINT, 0.05, 0.92, 0.25, 0, 0, 0, 10, 6),
      // a bow on the front
      ...[-1, 1].map((s) => egg(0.14, 0.08, 0.04, TINT, s * 0.12, 0.6, 0.96, 0, 0, s * 0.35, 8, 5)), pale(bead(0.05, TINT, 0, 0.6, 0.97), 0.4),
    ];
    return p;
  },
});

def('quiltstack', {
  label: 'Quilt Stack', col: { t: 'box', w: 1.6, h: 1.1, d: 1.2 }, fit: 2.0, value: 6, mass: 0.6,
  tints: [0xff8fb8, 0x6fb7ff, 0x7bd99a, 0xffc35a, 0xb48cff],
  build: () => {
    const LAYERS = [0xfff0d4, 0xbfe6ff, 0xffd6e4, 0xd8f5c4];
    const p = [];
    LAYERS.forEach((c, i) => {
      const y = i * 0.22, dx = [0.0, 0.03, -0.03, 0.02][i];
      p.push(rb(1.52, 0.21, 1.14, c, dx, y, 0, 0.09));
      // stitched edge
      p.push(box(1.535, 0.03, 1.155, i % 2 ? 0xff9ec8 : 0x9fd2ff, dx, y + 0.09, 0));
    });
    // the top quilt: patchwork (tint, cream and pale squares), with a tied ribbon
    p.push(...multi(new THREE.BoxGeometry(1.58, 0.22, 1.18, 6, 1, 4).translate(0, 0.99, 0),
      (x, y, z) => ((Math.floor((x + 0.79) / 0.263) + Math.floor((z + 0.59) / 0.295)) % 3), [TINT, CREAM, 0xffe3ef]));
    p.push(tbox(0.12, 0.01, 1.2, 0xfff6ee, 0.35, 1.1, 0), tbox(0.12, 0.88, 0.02, 0xfff6ee, 0.35, 0.55, 0.585));
    for (const s of [-1, 1]) p.push(egg(0.12, 0.03, 0.07, 0xfff6ee, 0.35 + s * 0.11, 1.08, 0.1, 0, s * 0.4, 0, 7, 4));
    return p;
  },
});

def('sewingmachine', {
  label: 'Sewing Machine', col: { t: 'box', w: 2.4, h: 1.7, d: 1.1 }, fit: 2.64, value: 11, mass: 1.2,
  tints: [0x7fd6c0, 0xff9cbc, 0x8fc4ff, 0xffd36a],
  build: () => {
    const p = [
      rbox(2.4, 0.28, 1.1, WOOD, 0, 0, 0, 0.06),
      rbox(2.0, 0.2, 0.8, TINT, 0.05, 0.28, -0.05, 0.08),
      rbox(0.55, 1.05, 0.75, TINT, 0.72, 0.42, -0.05, 0.14),
      rbox(2.0, 0.42, 0.72, TINT, 0.0, 1.12, -0.05, 0.16),
      rbox(0.5, 0.62, 0.7, TINT, -0.78, 0.9, -0.05, 0.12),
      // gold pinstripes
      tbox(1.4, 0.035, 0.01, GOLD, 0.05, 1.4, 0.315), tbox(1.4, 0.02, 0.01, GOLD, 0.05, 1.22, 0.315),
      tbox(0.02, 0.6, 0.01, GOLD, 0.6, 0.75, 0.33),
      // needle, presser foot, thread
      tcyl(0.012, 0.012, 0.3, SILVER, -0.82, 0.62, 0.1, 0, 0, 0, 4), tbox(0.14, 0.04, 0.16, STEEL, -0.82, 0.5, 0.1),
      tcyl(0.05, 0.05, 0.1, STEEL, -0.82, 0.86, 0.1, 0, 0, 0, 8),
      // hand wheel on the right side
      tcyl(0.32, 0.32, 0.1, SILVER, 1.12, 1.0, -0.05, 0, 0, PI / 2, 18), tcyl(0.12, 0.12, 0.14, STEEL, 1.15, 1.0, -0.05, 0, 0, PI / 2, 10),
      // spool pin with a spool on top
      tcyl(0.015, 0.015, 0.18, SILVER, 0.35, 1.63, -0.15, 0, 0, 0, 4),
      tcyl(0.1, 0.1, 0.03, WOOD_L, 0.35, 1.56, -0.15, 0, 0, 0, 10), tcyl(0.08, 0.08, 0.1, 0xff5c8a, 0.35, 1.62, -0.15, 0, 0, 0, 10), tcyl(0.1, 0.1, 0.03, WOOD_L, 0.35, 1.685, -0.15, 0, 0, 0, 10),
      // a little fabric under the needle
      tbox(0.8, 0.02, 0.45, 0xffe066, -0.6, 0.49, 0.15, 0, 0.2, 0),
    ];
    for (let i = 0; i < 4; i++) p.push(tbox(0.06, 0.021, 0.45, 0xffffff, -0.9 + i * 0.2, 0.495, 0.15, 0, 0.2, 0));
    return p;
  },
});

def('comfychair', {
  label: 'Comfy Chair', col: { t: 'box', w: 2.5, h: 2.7, d: 2.5 }, fit: 3.54, value: 20, mass: 2,
  tints: [0xff9cbc, 0x8fc4ff, 0x9fe0b8, 0xffcf6a, 0xc5a8ff],
  build: () => {
    const p = [
      ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => tcyl(0.08, 0.06, 0.22, WOOD_D, sx * 1.05, 0.11, sz * 0.95, 0, 0, 0, 8)),
      rbox(2.4, 0.6, 2.2, TINT, 0, 0.2, 0, 0.2),
      rbox(1.7, 0.32, 1.7, 0xfff6ec, 0, 0.8, 0.2, 0.15),
      rbox(2.4, 1.85, 0.5, TINT, 0, 0.75, -0.85, 0.24),
      ...[-1, 1].map((s) => rb(0.38, 0.75, 2.2, TINT, s * 1.01, 0.75, 0.0, 0.17)),
    ];
    // tufted buttons on the back
    for (const [x, y] of [[-0.5, 1.7], [0, 1.85], [0.5, 1.7], [-0.25, 2.1], [0.25, 2.1]]) p.push(shade(bead(0.05, TINT, x, y, -0.59), 0x9a9a9a));
    // a striped knitted blanket draped over the back and arm
    p.push(...multi(new THREE.BoxGeometry(0.95, 0.06, 0.9, 1, 1, 5).rotateX(-0.25).translate(0.75, 2.55, -0.78), (x, y, z) => Math.floor((z + 2) / 0.19) % 3, [0xfff0d4, 0xff7a8a, 0x74c7ff]));
    p.push(...multi(new THREE.BoxGeometry(0.95, 1.2, 0.06, 1, 6, 1).translate(0.75, 1.9, -0.06), (x, y) => Math.floor(y / 0.2) % 3, [0xfff0d4, 0xff7a8a, 0x74c7ff]));
    // yarn and needles on the seat
    p.push(egg(0.28, 0.26, 0.28, 0xffd23a, -0.45, 1.36, 0.45, 0, 0, 0, 12, 8));
    p.push(tor(0.28, 0.02, 0xffb92a, -0.45, 1.36, 0.45, 0.5, 0, 0.8, 3, 16), tor(0.28, 0.02, 0xffb92a, -0.45, 1.36, 0.45, 1.6, 0.4, 0, 3, 16));
    for (const s of [-1, 1]) p.push(tcyl(0.02, 0.02, 0.8, s < 0 ? 0xff9ec8 : 0x9fd2ff, -0.2 + s * 0.08, 1.2, 0.55, PI / 2 - 0.15, 0.5 + s * 0.2, 0, 6));
    return p;
  },
});

def('yarnbasket', {
  label: 'Giant Yarn Basket', col: { t: 'cyl', r: 2.8, h: 2.9 }, fit: 5.6, value: 50, mass: 8,
  tints: [0xff7a9c, 0x6fb7ff, 0x7bd99a, 0xb48cff],
  build: () => {
    const p = [
      ...basketWeave(2.72, 1.6, WOOD_L, WOOD, 0, 0, 0, 22),
      shade(tor(2.6, 0.13, TINT, 0, 1.6, 0, PI / 2, 0, 0, 4, 24), 0xe8e8e8),
      tcyl(2.4, 2.4, 0.04, WOOD_D, 0, 1.4, 0, 0, 0, 0, 24),
    ];
    // a heap of big yarn balls
    const heap = [[0, 2.0, 0, 0.9, 0], [-1.2, 1.75, 0.6, 0.78, 1], [1.2, 1.75, 0.55, 0.78, 2], [-0.8, 1.8, -1.0, 0.8, 3], [0.9, 1.8, -1.0, 0.8, 4],
      [0.1, 1.7, 1.25, 0.7, 5], [-1.6, 1.6, -0.3, 0.6, 2], [1.65, 1.6, -0.2, 0.6, 0]];
    heap.forEach(([x, y, z, r, c]) => {
      p.push(egg(r, r * 0.92, r, YARN[c], x, y, z, 0, 0, 0, 10, 6));
      p.push(tor(r * 0.97, 0.035, new THREE.Color(YARN[c]).multiplyScalar(0.85).getHex(), x, y, z, 0.7 + c, c * 0.5, 0.4, 3, 14));
    });
    // knitting needles standing out of the heap
    for (const [x, z, rz, c] of [[-0.3, -0.2, 0.25, 0xff9ec8], [0.35, -0.3, -0.3, 0x9fd2ff]]) {
      p.push(tcyl(0.045, 0.045, 1.4, c, x, 2.15, z, 0, 0, rz, 6));
      p.push(bead(0.08, c, x - Math.sin(rz) * 0.7, 2.15 + Math.cos(rz) * 0.7, z));
    }
    // a half-knitted striped scarf hanging over the front rim (takes the tint)
    p.push(...multi(new THREE.BoxGeometry(0.9, 1.3, 0.08, 1, 8, 1).translate(0.4, 1.0, 2.6), (x, y) => Math.floor(y / 0.17) % 2, [TINT, 0xfff4ea]));
    p.push(...multi(new THREE.BoxGeometry(0.9, 0.08, 0.7, 1, 1, 4).translate(0.4, 1.68, 2.3), (x, y, z) => Math.floor(z / 0.17) % 2, [TINT, 0xfff4ea]));
    for (let i = 0; i < 5; i++) p.push(tcyl(0.025, 0.025, 0.2, TINT, 0.04 + i * 0.18, 0.28, 2.62, 0, 0, 0, 4));
    return p;
  },
});

// ======================================================================== FUN FAIR
def('ticket', {
  label: 'Ticket', col: { t: 'box', w: 0.44, h: 0.05, d: 0.22 }, fit: 0.49, value: 1, mass: 0.15,
  tints: [0xff5d73, 0xffd23f, 0x5cc8ff, 0x7be07a, 0xb48cff],
  build: () => {
    // a plain rectangle with notched ends, a stub line and a star
    const s = [[-0.22, -0.11], [0.22, -0.11], [0.22, -0.04], [0.19, 0], [0.22, 0.04], [0.22, 0.11], [-0.22, 0.11], [-0.22, 0.04], [-0.19, 0], [-0.22, -0.04]];
    const p = [prism(s, 0.04, TINT, 0, 0, 0, 0.005), prism(starPts(0.055, 0.45), 0.012, WHITE, -0.04, 0.04, 0)];
    for (let i = 0; i < 4; i++) p.push(tbox(0.01, 0.012, 0.025, WHITE, 0.11, 0.046, -0.08 + i * 0.053));
    p.push(tbox(0.06, 0.01, 0.022, WHITE, 0.15, 0.045, -0.05), tbox(0.06, 0.01, 0.022, WHITE, 0.15, 0.045, 0.02));
    return p;
  },
});

def('popcorn', {
  label: 'Popcorn', col: { t: 'box', w: 0.4, h: 0.62, d: 0.4 }, fit: 0.57, value: 1, mass: 0.15,
  tints: [0xff4a5a, 0x3f9dff, 0xff7ac0, 0x2fb3a8],
  build: () => {
    // a striped carton, flaring a little toward the top
    const g = new THREE.BoxGeometry(0.34, 0.46, 0.34, 8, 1, 8).translate(0, 0.23, 0);
    const P = g.attributes.position;
    for (let i = 0; i < P.count; i++) { const k = 0.82 + 0.18 * (P.getY(i) / 0.46) * 1.0 + 0.0; P.setX(i, P.getX(i) * k * 1.12); P.setZ(i, P.getZ(i) * k * 1.12); }
    g.computeVertexNormals();
    const p = [
      ...two(g, (x, y, z) => (Math.abs(Math.abs(x) - Math.abs(z)) < 0.01 ? false : Math.floor(((Math.abs(x) > Math.abs(z) ? z : x) + 1) / 0.0475) % 2 === 0), TINT, WHITE),
    ];
    // popcorn heaped over the top
    fib(22).forEach(([x, y, z], i) => { if (y > -0.2) p.push(egg(0.055, 0.05, 0.055, i % 4 ? 0xfff3c8 : 0xffe08a, x * 0.13, 0.5 + y * 0.07, z * 0.13, 0, 0, 0, 6, 4)); });
    p.push(egg(0.06, 0.055, 0.06, 0xfff3c8, 0, 0.565, 0, 0, 0, 0, 6, 4));
    return p;
  },
});

def('balloon', {
  label: 'Balloon', col: { t: 'cyl', r: 0.28, h: 1.4 }, fit: 0.56, value: 1, mass: 0.15,
  tints: RAINBOW,
  build: () => [
    tcyl(0.1, 0.11, 0.1, 0x9aa3b8, 0, 0.05, 0, 0, 0, 0, 10), egg(0.08, 0.03, 0.08, 0x9aa3b8, 0, 0.1, 0, 0, 0, 0, 8, 4),
    tcyl(0.008, 0.008, 0.66, 0xffffff, 0.01, 0.43, 0, 0, 0, 0.03, 4),
    egg(0.26, 0.32, 0.25, TINT, 0, 1.07, 0, 0, 0, 0, 14, 10),
    tcyl(0.025, 0.05, 0.06, TINT, 0, 0.74, 0, 0, 0, 0, 6),
    pale(egg(0.06, 0.1, 0.03, TINT, -0.1, 1.18, 0.2, 0.3, -0.4, 0.3, 7, 5), 0.25),
  ],
});

def('candyapple', {
  label: 'Candy Apple', col: { t: 'cyl', r: 0.24, h: 0.66 }, fit: 0.48, value: 1, mass: 0.15,
  tints: [0xe8233a, 0x6fd16a, 0xd9913e, 0xff6fb5],
  build: () => [
    egg(0.22, 0.2, 0.22, TINT, 0, 0.2, 0, 0, 0, 0, 14, 10),
    shade(tor(0.19, 0.045, TINT, 0, 0.045, 0, PI / 2, 0, 0, 5, 16), 0xd8d8d8),
    pale(egg(0.05, 0.07, 0.03, TINT, -0.09, 0.28, 0.17, 0.3, -0.4, 0, 7, 5), 0.2),
    tcyl(0.025, 0.025, 0.3, WOOD_L, 0, 0.5, 0, 0, 0, 0.08, 6),
    ...[0x5cc8ff, 0xffd23f, 0xffffff, 0x7be07a, 0xb48cff].map((c, i) => { const a = i * 1.3; return tbox(0.035, 0.012, 0.012, c, 0.16 * Math.sin(a), 0.36, 0.16 * Math.cos(a), 0, a, 0.5); }),
  ],
});

def('goldfishbag', {
  label: 'Goldfish Bag', col: { t: 'cyl', r: 0.28, h: 0.72 }, fit: 0.56, value: 1, mass: 0.15,
  tints: [0xff5d73, 0xffd23f, 0x5cc8ff, 0xb48cff, 0x7be07a],
  build: () => {
    const p = [
      egg(0.27, 0.25, 0.27, 0xbfe8ff, 0, 0.25, 0, 0, 0, 0, 14, 9),
      lathe([[0.2, 0], [0.12, 0.08], [0.06, 0.16], [0.07, 0.22], [0, 0.22]], 0xd8f0ff, 0, 0.4, 0, 10),
      shade(tor(0.06, 0.025, TINT, 0, 0.58, 0, PI / 2, 0, 0, 4, 10), 0xe0e0e0),
      pale(egg(0.06, 0.08, 0.03, 0xffffff, -0.12, 0.33, 0.21, 0.3, -0.4, 0), 0),
      egg(0.05, 0.05, 0.01, 0x7fd0ff, 0.1, 0.12, 0.23, 0, 0.3, 0, 6, 4),
    ];
    // the bow: two loops and ribbon tails
    for (const s of [-1, 1]) p.push(egg(0.085, 0.05, 0.03, TINT, s * 0.08, 0.64, 0.03, 0, 0, s * 0.5, 7, 5), tbox(0.025, 0.12, 0.01, TINT, s * 0.04, 0.53, 0.07, 0, 0, s * 0.3));
    // a goldfish swimming on the front of the bag
    p.push(egg(0.09, 0.06, 0.04, 0xff8a2a, 0.02, 0.25, 0.25, 0, 0.25, 0, 10, 6), tcyl(0.0, 0.06, 0.07, 0xffa24a, -0.09, 0.25, 0.235, 0, 0.25, PI / 2, 6),
      bead(0.012, INK, 0.08, 0.27, 0.27));
    return p;
  },
});

def('pinwheel', {
  label: 'Pinwheel', col: { t: 'box', w: 0.56, h: 1.1, d: 0.26 }, fit: 0.62, value: 1, mass: 0.15,
  tints: [0xff5c8a, 0x5cc8ff, 0xffd23f, 0x7be07a, 0xb48cff],
  build: () => {
    const cy = 0.82;
    const p = [
      lathe([[0, 0], [0.12, 0], [0.13, 0.02], [0.1, 0.09], [0, 0.09]], 0xfff3d6, 0, 0, 0, 12),
      tcyl(0.016, 0.016, cy, WHITE, 0, 0.45, 0, 0, 0, 0, 6),
      bead(0.035, GOLD, 0, cy, 0.07),
    ];
    // four folded blades, alternating tint and white
    for (let i = 0; i < 4; i++) {
      const a = (i * PI) / 2 + 0.3;
      const g = new THREE.BufferGeometry();
      const v = [0, 0, 0.03, 0.27, 0.0, 0.0, 0.13, 0.13, 0.08];
      g.setAttribute('position', new THREE.Float32BufferAttribute([...v, v[0], v[1], v[2], v[6], v[7], v[8], v[3], v[4], v[5]], 3));
      g.computeVertexNormals();
      g.rotateZ(a).translate(0, cy, 0);
      p.push(i % 2 ? custom(g, WHITE) : custom(g, TINT));
    }
    return p;
  },
});

def('prizebunny', {
  label: 'Prize Bunny', col: { t: 'box', w: 0.5, h: 0.95, d: 0.5 }, fit: 0.71, value: 1, mass: 0.15,
  tints: [0xff9cc6, 0x8fd0ff, 0xffe27a, 0xc5a8ff, 0x9fe6b5],
  build: () => {
    const p = [
      egg(0.22, 0.2, 0.2, TINT, 0, 0.2, -0.02, 0, 0, 0, 11, 7),
      egg(0.17, 0.155, 0.15, TINT, 0, 0.5, 0.02, 0, 0, 0, 11, 7),
      pale(egg(0.11, 0.1, 0.05, TINT, 0, 0.21, 0.15, 0, 0, 0, 10, 6), 0.3),
      egg(0.055, 0.035, 0.03, 0xffffff, 0, 0.46, 0.16, 0, 0, 0, 7, 4),
      bead(0.022, 0xff7a9a, 0, 0.49, 0.168),
      ...face(0, 0.52, 0.14, 0.065, 0.021, false),
      egg(0.06, 0.06, 0.06, WHITE, 0, 0.12, -0.22, 0, 0, 0, 7, 5),
    ];
    for (const s of [-1, 1]) {
      p.push(egg(0.06, 0.19, 0.04, TINT, s * 0.08, 0.76, 0.0, 0, 0, s * 0.18, 9, 6), pale(egg(0.035, 0.14, 0.02, TINT, s * 0.08, 0.76, 0.025, 0, 0, s * 0.18, 7, 5), 0.35));
      p.push(egg(0.07, 0.06, 0.1, TINT, s * 0.13, 0.06, 0.12, 0, 0, 0, 8, 5), egg(0.05, 0.08, 0.05, TINT, s * 0.19, 0.27, 0.07, 0, 0, s * 0.5, 7, 5));
      p.push(egg(0.06, 0.04, 0.025, 0xffd23a, s * 0.07, 0.36, 0.15, 0, 0, s * 0.4, 7, 4));
    }
    p.push(bead(0.03, 0xffb92a, 0, 0.36, 0.16));
    return C(p);
  },
});

def('milkbottles', {
  label: 'Bottle Stack', col: { t: 'box', w: 0.8, h: 0.95, d: 0.4 }, fit: 0.89, value: 1, mass: 0.2,
  tints: [0xff4a5a, 0x3f9dff, 0x5fd16a, 0xffa52e],
  build: () => {
    const bottle = (x, y) => [
      lathe([[0, 0], [0.14, 0], [0.155, 0.02], [0.155, 0.2], [0.12, 0.27], [0.07, 0.32], [0.065, 0.38], [0.075, 0.4], [0, 0.4]], WHITE, x, y, 0, 12),
      tcyl(0.157, 0.157, 0.06, TINT, x, y + 0.11, 0, 0, 0, 0, 14),
      tcyl(0.077, 0.077, 0.03, TINT, x, y + 0.385, 0, 0, 0, 0, 10),
    ];
    return [rb(0.8, 0.08, 0.4, WOOD, 0, 0, 0, 0.03), ...bottle(-0.2, 0.08), ...bottle(0.2, 0.08), rb(0.5, 0.04, 0.34, WOOD_L, 0, 0.48, 0, 0.015), ...bottle(0, 0.52)];
  },
});

// A carousel horse on a brass pole: white body, the mane, saddle and blanket take the tint.
function horseParts(withBase = true) {
  const HORSE = 0xfffaf4;
  const p = [];
  if (withBase) p.push(lathe([[0, 0], [0.26, 0], [0.275, 0.03], [0.26, 0.07], [0, 0.07]], GOLD, 0, 0, 0, 14));
  p.push(tcyl(0.035, 0.035, withBase ? 2.13 : 2.2, GOLD, 0, withBase ? 1.135 : 1.1, 0, 0, 0, 0, 8));
  p.push(bead(0.07, GOLD, 0, withBase ? 2.13 : 2.13, 0));
  const y = 1.0;
  p.push(egg(0.42, 0.2, 0.18, HORSE, 0, y, 0, 0, 0, 0, 11, 7));
  p.push(egg(0.12, 0.24, 0.11, HORSE, 0.36, y + 0.25, 0, 0, 0, -0.5, 10, 6));
  p.push(egg(0.17, 0.09, 0.09, HORSE, 0.5, y + 0.46, 0, 0, 0, -0.3, 10, 6));
  p.push(bead(0.025, INK, 0.5, y + 0.5, 0.075), bead(0.025, INK, 0.5, y + 0.5, -0.075));
  for (const s of [-1, 1]) p.push(tcyl(0.0, 0.035, 0.1, HORSE, 0.42, y + 0.58, s * 0.05, 0, 0, 0, 5));
  // mane, saddle, blanket, tail
  for (let i = 0; i < 4; i++) p.push(egg(0.07, 0.05, 0.05, TINT, 0.27 + i * 0.065, y + 0.24 + i * 0.07, 0, 0, 0, -0.6, 7, 4));
  p.push(shade(egg(0.18, 0.08, 0.2, TINT, -0.05, y + 0.18, 0, 0, 0, 0, 10, 5), 0xd0d0d0));
  p.push(...[-1, 1].map((s) => tbox(0.32, 0.22, 0.02, TINT, -0.05, y, s * 0.18)));
  p.push(egg(0.06, 0.2, 0.06, TINT, -0.44, y - 0.05, 0, 0, 0, 0.6, 7, 5));
  // legs: front pair prancing, back pair down
  for (const s of [-1, 1]) {
    p.push(tcyl(0.04, 0.035, 0.36, HORSE, 0.3, y - 0.18, s * 0.08, 0, 0, 0.9, 6), tcyl(0.035, 0.03, 0.3, HORSE, -0.28, y - 0.3, s * 0.08, 0, 0, -0.25, 6));
    p.push(bead(0.04, GOLD, 0.47, y - 0.28, s * 0.08), bead(0.04, GOLD, -0.24, y - 0.45, s * 0.08));
  }
  return p;
}
// Low-poly horse for the carousel ride (six of them must fit the prop's triangle budget).
function horseLo(k) {
  const HORSE = 0xfffaf4, y = 0.85, c = [0xff7ac0, 0x5cc8ff, 0xffd23a, 0xb48cff, 0x7be07a, 0xff9a3a][k % 6];
  const p = [
    egg(0.36, 0.17, 0.15, HORSE, 0, y, 0, 0, 0, 0, 8, 4),
    egg(0.1, 0.2, 0.09, HORSE, 0.3, y + 0.21, 0, 0, 0, -0.5, 6, 4),
    egg(0.14, 0.075, 0.075, HORSE, 0.42, y + 0.39, 0, 0, 0, -0.3, 6, 4),
    egg(0.15, 0.06, 0.17, c, -0.04, y + 0.15, 0, 0, 0, 0, 6, 3),
    egg(0.05, 0.17, 0.05, c, -0.37, y - 0.04, 0, 0, 0, 0.6, 5, 3),
    egg(0.17, 0.05, 0.04, c, 0.3, y + 0.31, 0, 0, 0, -0.9, 5, 3),
  ];
  p.push(tbox(0.3, 0.06, 0.2, HORSE, 0.27, y - 0.14, 0, 0, 0, 0.9), tbox(0.06, 0.28, 0.2, HORSE, -0.25, y - 0.26, 0, 0, 0, -0.25));
  return p;
}
def('carouselhorse', {
  label: 'Carousel Horse', col: { t: 'box', w: 1.22, h: 2.2, d: 0.56 }, fit: 1.34, value: 3, mass: 0.3,
  tints: [0xff7ac0, 0x5cc8ff, 0xffb92a, 0x7be07a, 0xb48cff],
  build: () => C(horseParts(true)),
});

def('bumpercar', {
  label: 'Bumper Car', col: { t: 'box', w: 1.6, h: 1.5, d: 1.15 }, fit: 1.97, value: 6, mass: 0.6,
  tints: [0xff4a5a, 0x3f9dff, 0xffd23a, 0x5fd16a, 0xa070ff, 0xff7ac0],
  build: () => {
    const p = [
      rbox(1.6, 0.22, 1.15, 0x4a4458, 0, 0.02, 0, 0.1),
      rbox(1.45, 0.45, 1.0, TINT, 0, 0.2, 0, 0.2),
      rb(0.55, 0.35, 0.9, TINT, -0.45, 0.6, 0, 0.14),
      rb(0.5, 0.12, 0.75, 0x3a3646, 0.05, 0.62, 0, 0.05),
      tcyl(0.025, 0.025, 0.3, 0x6a6478, 0.42, 0.7, 0, 0, 0, 0.4, 6), tor(0.13, 0.025, 0x6a6478, 0.5, 0.86, 0, PI / 2 - 0.5, 0, 0, 3, 14),
      pale(tbox(0.3, 0.02, 0.5, TINT, 0.5, 0.66, 0), 0.6),
      bead(0.06, 0xfff3c8, 0.73, 0.42, 0.3), bead(0.06, 0xfff3c8, 0.73, 0.42, -0.3),
      // the pole up to the ceiling grid, with a spark at the top
      tcyl(0.025, 0.025, 0.65, SILVER, -0.62, 1.15, 0, 0, 0, 0, 6), egg(0.06, 0.06, 0.06, 0xffe066, -0.62, 1.45, 0, 0, 0, 0, 7, 5),
      pale(prism(starPts(0.13, 0.45), 0.02, TINT, 0, 0.66, 0), 0),
    ];
    return C(p);
  },
});

def('teacup', {
  label: 'Teacup Ride', col: { t: 'cyl', r: 1.14, h: 1.25 }, fit: 2.28, value: 8, mass: 0.8,
  tints: [0xff9cc6, 0x8fd0ff, 0xffe27a, 0xc5a8ff, 0x9fe6b5],
  build: () => {
    const cupProf = [[0.5, 0], [0.62, 0.05], [0.8, 0.35], [0.86, 0.7], [0.87, 0.95], [0.82, 0.95], [0.78, 0.7], [0.7, 0.4], [0.5, 0.25], [0, 0.25]];
    const g = latheGeo(cupProf, 24).translate(0, 0.25, 0);
    const p = [
      lathe([[0, 0], [0.9, 0], [1.02, 0.08], [1.0, 0.16], [0.8, 0.22], [0, 0.25]], WHITE, 0, 0, 0, 24),
      shade(tor(0.98, 0.04, TINT, 0, 0.14, 0, PI / 2, 0, 0, 4, 24), 0xd0d0d0),
      ...two(g, (x, y, z) => { const a = Math.atan2(x, z) * 6 / PI, b = y * 6; return ((Math.round(a) - a) ** 2 + (Math.round(b) - b) ** 2) < 0.07; }, WHITE, TINT),
      tor(0.86, 0.035, GOLD, 0, 1.2, 0, PI / 2, 0, 0, 4, 24),
      // handle on the side
      tor(0.16, 0.055, TINT, 0.9, 0.75, 0, 0, 0, 0, 5, 12),
      // the wheel in the middle and a seat ring
      tcyl(0.06, 0.06, 0.5, SILVER, 0, 0.75, 0, 0, 0, 0, 8), tor(0.22, 0.035, 0xff5c8a, 0, 1.0, 0, PI / 2, 0, 0, 4, 14),
      tcyl(0.6, 0.6, 0.06, 0xfff0d4, 0, 0.62, 0, 0, 0, 0, 18),
    ];
    return p;
  },
});

def('popcorncart', {
  label: 'Popcorn Cart', col: { t: 'box', w: 2.1, h: 2.4, d: 1.36 }, fit: 2.5, value: 10, mass: 0.9,
  tints: [0xff4a5a, 0x3f9dff, 0xff7ac0, 0x2fb3a8],
  build: () => {
    const p = [
      rbox(1.5, 0.75, 1.0, TINT, 0, 0.3, 0, 0.08),
      tbox(1.52, 0.06, 1.02, GOLD, 0, 1.08, 0), tbox(1.52, 0.04, 1.02, GOLD, 0, 0.33, 0),
      // glass case full of popcorn (back glass from the inside, bright corner posts)
      custom(shellInside(new THREE.BoxGeometry(1.4, 0.7, 0.9).translate(0, 1.46, 0), (x, y, z) => z < 0.3), GLASS),
      ...[[-0.7, -0.45], [0.7, -0.45], [-0.7, 0.45], [0.7, 0.45]].map(([x, z]) => tbox(0.05, 0.72, 0.05, GOLD, x, 1.46, z)),
      egg(0.62, 0.3, 0.38, 0xfff3c8, 0, 1.15, -0.02, 0, 0, 0, 12, 6),
      // wheels and handle
      ...[-1, 1].map((s) => tcyl(0.32, 0.32, 0.08, 0xff5c8a, -0.45, 0.32, s * 0.55, PI / 2, 0, 0, 16)),
      ...[-1, 1].map((s) => tcyl(0.08, 0.08, 0.1, GOLD, -0.45, 0.32, s * 0.6, PI / 2, 0, 0, 8)),
      tcyl(0.05, 0.06, 0.32, NAVY, 0.6, 0.16, 0, 0, 0, 0, 8),
      tcyl(0.025, 0.025, 0.5, SILVER, 0.93, 0.9, 0, 0, 0, 0.9, 6), tcyl(0.03, 0.03, 0.6, SILVER, 1.05, 1.08, 0, PI / 2, 0, 0, 6),
      // posts and a striped awning on top
      ...[-1, 1].map((s) => tcyl(0.025, 0.025, 0.3, GOLD, s * 0.6, 1.95, 0, 0, 0, 0, 6)),
    ];
    const roofG = new THREE.CylinderGeometry(0.08, 0.95, 0.35, 12).scale(1.0, 1, 0.68).translate(0, 2.25, 0);
    p.push(...two(roofG, (x, y, z) => Math.floor(((Math.atan2(x, z) + PI) / TAU) * 12) % 2 === 0, TINT, WHITE));
    for (let i = 0; i < 12; i++) { const a = (i + 0.5) * TAU / 12; p.push(egg(0.13, 0.07, 0.06, i % 2 ? TINT : WHITE, 0.92 * Math.sin(a), 2.07, 0.63 * Math.cos(a), 0, a, 0, 6, 4)); }
    p.push(bead(0.07, GOLD, 0, 2.43 - 0.07, 0));
    return C(p);
  },
});

def('ticketbooth', {
  label: 'Ticket Booth', col: { t: 'box', w: 1.8, h: 2.7, d: 1.84 }, fit: 2.57, value: 11, mass: 0.9,
  tints: [0xff5d8f, 0x5cc8ff, 0xffb92a, 0x7bd99a],
  build: () => {
    const p = [
      rbox(1.6, 1.8, 1.4, TINT, 0, 0, 0, 0.08),
      tbox(1.62, 0.12, 1.42, WHITE, 0, 0.06, 0),
      // window with a counter
      box(1.0, 0.6, 0.04, 0x9fd8ff, 0, 0.9, 0.7), box(1.1, 0.06, 0.06, WHITE, 0, 1.5, 0.71),
      ...[-1, 1].map((s) => box(0.06, 0.66, 0.06, WHITE, s * 0.53, 0.86, 0.71)),
      rbox(1.3, 0.08, 0.28, WOOD_L, 0, 0.82, 0.78, 0.03),
      // a little stack of tickets on the counter
      box(0.18, 0.08, 0.1, 0xffd23f, 0.35, 0.9, 0.78), box(0.18, 0.03, 0.1, 0xff5d73, 0.35, 0.98, 0.78),
      bead(0.06, 0xffd3b4, -0.2, 1.1, 0.6), egg(0.09, 0.05, 0.08, 0x8a5a3c, -0.2, 1.15, 0.58, 0, 0, 0, 8, 5),
    ];
    // striped pointed roof with a pennant
    const roofG = new THREE.ConeGeometry(1.25, 0.8, 4, 1).rotateY(PI / 4).scale(1.0, 1, 0.9).translate(0, 2.2, 0);
    p.push(...two(roofG, (x, y, z) => Math.floor((Math.abs(x) > Math.abs(z) ? z : x) / 0.22 + 10) % 2 === 0, TINT, WHITE));
    p.push(tbox(1.78, 0.1, 1.58, WHITE, 0, 1.82, 0));
    for (let i = 0; i < 7; i++) p.push(egg(0.1, 0.06, 0.04, i % 2 ? TINT : 0xffd23f, -0.75 + i * 0.25, 1.74, 0.8, 0, 0, 0, 6, 4));
    p.push(tcyl(0.015, 0.015, 0.1, WOOD_D, 0, 2.65, 0, 0, 0, 0, 4), vprism([[0, 0], [0.18, 0.04], [0, 0.08]], 0.01, 0xffd23f, 0.01, 2.6, 0));
    return p;
  },
});

def('prizestall', {
  label: 'Prize Stall', col: { t: 'box', w: 3.0, h: 2.9, d: 1.8 }, fit: 3.5, value: 20, mass: 1.8,
  tints: [0xff5d8f, 0x5cc8ff, 0xb48cff, 0x7bd99a],
  build: () => {
    const p = [
      rb(2.8, 0.9, 1.4, WOOD_L, 0, 0, 0.1, 0.06),
      ...multi(new THREE.BoxGeometry(2.82, 0.5, 1.42, 8, 1, 1).translate(0, 0.55, 0.1), (x) => Math.floor((x + 1.41) / 0.3525) % 2, [TINT, WHITE]),
      box(2.9, 0.08, 1.5, WHITE, 0, 0.9, 0.1),
      box(2.8, 1.5, 0.12, 0xfff0d4, 0, 0.9, -0.7),
      ...[[-1.38, 0.75], [1.38, 0.75], [-1.38, -0.7], [1.38, -0.7]].map(([x, z]) => cyl(0.05, 0.05, 1.5, WHITE, x, 0.98, z, 8)),
    ];
    // shelves of prizes on the back wall: bunnies, ducks, stars
    const prize = [0xff9cc6, 0x8fd0ff, 0xffe27a, 0xc5a8ff, 0x9fe6b5, 0xffb38a];
    for (let i = 0; i < 6; i++) {
      p.push(egg(0.17, 0.2, 0.13, prize[i], -1.1 + i * 0.44, 1.65, -0.55, 0, 0, 0, 6, 4), egg(0.13, 0.12, 0.1, prize[i], -1.1 + i * 0.44, 1.9, -0.55, 0, 0, 0, 6, 4));
      p.push(bead(0.02, INK, -1.14 + i * 0.44, 1.93, -0.46), bead(0.02, INK, -1.06 + i * 0.44, 1.93, -0.46));
    }
    p.push(box(2.7, 0.06, 0.3, WOOD, 0, 1.43, -0.55));
    // balloons on the front counter
    for (let i = 0; i < 5; i++) p.push(egg(0.13, 0.16, 0.13, RAINBOW[i + 1], -0.9 + i * 0.45, 1.25, 0.55, 0, 0, 0, 7, 5), tcyl(0.006, 0.006, 0.3, WHITE, -0.9 + i * 0.45, 1.0, 0.55, 0, 0, 0, 3));
    // striped awning, scalloped edge, a star on top
    p.push(...multi(new THREE.BoxGeometry(3.0, 0.08, 1.8, 10, 1, 1).rotateX(0.32).translate(0, 2.55, 0.0), (x) => Math.floor((x + 1.5) / 0.3) % 2, [TINT, WHITE]));
    for (let i = 0; i < 10; i++) p.push(egg(0.15, 0.08, 0.05, i % 2 ? WHITE : TINT, -1.35 + i * 0.3, 2.22, 0.86, 0, 0, 0, 6, 3));
    p.push(vprism(starPts(0.24, 0.45), 0.08, 0xffd23f, 0, 2.53, -0.85));
    return C(p);
  },
});

def('carousel', {
  label: 'Carousel', col: { t: 'cyl', r: 2.9, h: 4.7 }, fit: 5.8, value: 54, mass: 9,
  tints: [0xff7ac0, 0x5cc8ff, 0xffb92a, 0xb48cff],
  build: () => {
    const p = [
      lathe([[0, 0], [2.75, 0], [2.85, 0.05], [2.85, 0.32], [2.75, 0.38], [0, 0.38]], 0xfff0d4, 0, 0, 0, 24),
      shade(tor(2.84, 0.06, TINT, 0, 0.2, 0, PI / 2, 0, 0, 3, 24), 0xd8d8d8),
      tcyl(0.55, 0.6, 3.4, 0xfff6ee, 0, 2.08, 0, 0, 0, 0, 14),
      tor(0.58, 0.05, GOLD, 0, 2.2, 0, PI / 2, 0, 0, 3, 14),
    ];
    // six horses on poles, every other one up
    for (let i = 0; i < 6; i++) {
      const a = (i * TAU) / 6 + PI / 6, hp = horseLo(i);
      const lift = i % 2 ? 0.25 : 0;
      for (const g of hp) { g.translate(0, 0.38 + lift, 0); g.rotateY(a + PI); g.translate(1.95 * Math.sin(a), 0, 1.95 * Math.cos(a)); }
      p.push(...hp);
      p.push(tcyl(0.035, 0.035, 3.3, GOLD, 1.95 * Math.sin(a), 2.03, 1.95 * Math.cos(a), 0, 0, 0, 6));
    }
    // canopy: scalloped striped tent with lights, a flag on top
    const roofG = new THREE.ConeGeometry(2.88, 0.95, 24, 1, true).translate(0, 4.2, 0);
    p.push(...two(roofG, (x, y, z) => Math.floor(((Math.atan2(x, z) + PI) / TAU) * 12) % 2 === 0, TINT, WHITE));
    p.push(tcyl(2.88, 2.88, 0.32, 0xfff6ee, 0, 3.73, 0, 0, 0, 0, 24, 1));
    for (let i = 0; i < 12; i++) {
      const a = (i + 0.5) * TAU / 12;
      p.push(egg(0.42, 0.18, 0.1, i % 2 ? WHITE : TINT, 2.8 * Math.sin(a), 3.52, 2.8 * Math.cos(a), 0, a, 0, 6, 3));
      if (i % 2) p.push(spark(0.08, 0xfff2a0, 2.78 * Math.sin(a + 0.26), 3.9, 2.78 * Math.cos(a + 0.26)));
    }
    p.push(tcyl(0.03, 0.03, 0.45, WOOD_D, 0, 4.5, 0, 0, 0, 0, 5), vprism([[0, 0], [0.4, 0.09], [0, 0.18]], 0.02, 0xffd23f, 0.02, 4.47, 0));
    return p;
  },
});

// ======================================================================== MOON CAMP
def('star', {
  label: 'Star', col: { t: 'cyl', r: 0.23, h: 0.16 }, fit: 0.46, value: 1, mass: 0.15,
  tints: [0xffd23a, 0xff7ac0, 0x5cc8ff, 0x7be07a, 0xb48cff, 0xff9a3a],
  build: () => [
    custom(new THREE.ExtrudeGeometry(new THREE.Shape(starPts(0.205, 0.5).map(([x, z]) => new THREE.Vector2(x, z))), { depth: 0.06, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.025, bevelSegments: 2, curveSegments: 4 }).rotateX(-PI / 2).translate(0, 0.05, 0), TINT),
    ...face(0, 0.162, 0.03, 0.04, 0.016, true).map((g) => g.rotateX(-PI / 2 + 0.0).translate(0, 0.15, 0.14)),
  ],
});

def('moonrock', {
  label: 'Moon Rock', col: { t: 'cyl', r: 0.25, h: 0.34 }, fit: 0.5, value: 1, mass: 0.15,
  tints: [0xc6c0e8, 0xf2c6d8, 0xbfe6d8, 0xffe0a8],
  build: () => {
    const g = new THREE.IcosahedronGeometry(1, 1);
    const P = g.attributes.position;
    for (let i = 0; i < P.count; i++) {
      const x = P.getX(i), y = P.getY(i), z = P.getZ(i), k = 0.88 + 0.12 * Math.sin(x * 5.1 + y * 3.3) * Math.cos(z * 4.2);
      P.setXYZ(i, x * k, y * k, z * k);
    }
    g.computeVertexNormals();
    g.scale(0.24, 0.17, 0.23).translate(0, 0.17, 0);
    return [custom(g, TINT), shade(egg(0.07, 0.025, 0.07, TINT, 0.06, 0.315, 0.03, 0, 0, 0, 8, 4), 0x9a9a9a), shade(egg(0.045, 0.02, 0.045, TINT, -0.09, 0.27, 0.12, 0.5, 0, 0, 8, 4), 0x9a9a9a)];
  },
});

def('alien', {
  label: 'Little Alien', col: { t: 'cyl', r: 0.26, h: 0.74 }, fit: 0.52, value: 1, mass: 0.15,
  tints: [0x7be07a, 0xff9cc6, 0x6fc8ff, 0xb48cff, 0xffb347],
  build: () => {
    const p = [
      egg(0.17, 0.17, 0.15, TINT, 0, 0.17, 0, 0, 0, 0, 12, 8),
      egg(0.2, 0.17, 0.18, TINT, 0, 0.42, 0.01, 0, 0, 0, 12, 8),
      egg(0.075, 0.08, 0.04, 0xffffff, 0, 0.44, 0.165, 0, 0, 0, 10, 6),
      egg(0.04, 0.045, 0.02, INK, 0, 0.44, 0.198, 0, 0, 0, 8, 5), spark(0.012, 0xffffff, -0.015, 0.46, 0.215),
      tor(0.035, 0.01, INK, 0, 0.35, 0.165, 0, 0, PI, 3, 8, PI),
    ];
    for (const s of [-1, 1]) {
      p.push(tcyl(0.012, 0.012, 0.16, TINT, s * 0.08, 0.64, 0, 0, 0, -s * 0.35, 5));
      p.push(egg(0.045, 0.045, 0.045, 0xffe066, s * 0.115, 0.715 - 0.045, 0, 0, 0, 0, 7, 5));
      p.push(egg(0.045, 0.09, 0.045, TINT, s * 0.19, 0.24, 0.02, 0, 0, s * 0.8, 7, 5));
      p.push(egg(0.06, 0.035, 0.08, TINT, s * 0.08, 0.035, 0.05, 0, 0, 0, 7, 4));
      p.push(egg(0.035, 0.022, 0.012, BLUSH, s * 0.12, 0.38, 0.15, 0, s * 0.6, 0, 6, 4));
    }
    return p;
  },
});

def('spacepup', {
  label: 'Space Pup', col: { t: 'cyl', r: 0.34, h: 0.84 }, fit: 0.68, value: 1, mass: 0.15,
  tints: [0xff7a8a, 0x5cc8ff, 0xffd23a, 0xa070ff],
  build: () => {
    const FUR = 0xf2d2a2, EAR = 0xb07a4a;
    const p = [
      egg(0.22, 0.2, 0.2, TINT, 0, 0.2, -0.02, 0, 0, 0, 11, 7),
      shade(tor(0.15, 0.04, TINT, 0, 0.38, -0.01, PI / 2, 0, 0, 4, 12), 0xd8d8d8),
      egg(0.17, 0.15, 0.16, FUR, 0, 0.55, 0.0, 0, 0, 0, 11, 7),
      egg(0.08, 0.06, 0.07, 0xfff2dc, 0, 0.51, 0.13, 0, 0, 0, 8, 5), bead(0.03, INK, 0, 0.54, 0.2),
      ...face(0, 0.6, 0.145, 0.065, 0.02, false),
      // the bubble helmet: back half from inside, a bright rim
      custom(shellInside(new THREE.SphereGeometry(0.31, 12, 8).translate(0, 0.53, 0), (x, y, z) => z < 0.05 && y > 0.36), GLASS),
      tor(0.3, 0.02, 0xffffff, 0, 0.53, 0.03, 0.15, 0, 0, 3, 24),
      tor(0.21, 0.035, SILVER, 0, 0.38, 0, PI / 2, 0, 0, 4, 16),
      tcyl(0.012, 0.012, 0.1, SILVER, 0.12, 0.84 - 0.08, -0.05, 0, 0, -0.3, 4), bead(0.025, 0xff5c8a, 0.14, 0.82, -0.05),
    ];
    for (const s of [-1, 1]) {
      p.push(egg(0.05, 0.11, 0.04, EAR, s * 0.17, 0.53, 0, 0, 0, s * 0.3, 6, 4));
      p.push(egg(0.06, 0.05, 0.08, TINT, s * 0.11, 0.05, 0.12, 0, 0, 0, 7, 4));
      p.push(egg(0.05, 0.09, 0.05, TINT, s * 0.2, 0.22, 0.04, 0, 0, s * 0.5, 6, 4));
    }
    p.push(egg(0.03, 0.08, 0.03, FUR, 0, 0.22, -0.22, -0.8, 0, 0, 6, 4));
    return p;
  },
});

def('astronaut', {
  label: 'Astronaut', col: { t: 'box', w: 0.7, h: 1.05, d: 0.52 }, fit: 0.87, value: 1, mass: 0.2,
  tints: [0xff5d73, 0x3f9dff, 0xffd23a, 0x5fd16a, 0xa070ff],
  build: () => {
    const SUIT = 0xf6f7fb, VISOR = 0x4a5fa8;
    const p = [
      rb(0.42, 0.42, 0.3, SUIT, 0, 0.2, 0, 0.12),
      rb(0.36, 0.38, 0.14, 0xd8dce8, 0, 0.24, -0.2, 0.05),
      box(0.18, 0.12, 0.03, TINT, 0, 0.38, 0.15),
      ...[0xff5c8a, 0xffd23f, 0x5cc8ff].map((c, i) => bead(0.018, c, -0.05 + i * 0.05, 0.35, 0.166)),
      egg(0.23, 0.22, 0.22, SUIT, 0, 0.8, 0, 0, 0, 0, 12, 8),
      egg(0.17, 0.13, 0.08, VISOR, 0, 0.8, 0.16, 0, 0, 0, 10, 6),
      pale(egg(0.05, 0.03, 0.02, 0xffffff, -0.07, 0.85, 0.235, 0, 0, 0.4, 6, 4), 0),
      shade(tor(0.16, 0.03, TINT, 0, 0.62, 0, PI / 2, 0, 0, 4, 14), 0xffffff),
      tcyl(0.012, 0.012, 0.12, SILVER, 0.14, 0.98, 0, 0, 0, -0.3, 4), bead(0.025, TINT, 0.16, 1.03, 0),
    ];
    for (const s of [-1, 1]) {
      p.push(tcyl(0.07, 0.075, 0.2, SUIT, s * 0.1, 0.1, 0.02, 0, 0, 0, 10), rb(0.15, 0.08, 0.2, TINT, s * 0.1, 0, 0.05, 0.03));
      p.push(egg(0.07, 0.15, 0.07, SUIT, s * 0.26, 0.36, 0.0, 0, 0, s * 0.5, 8, 5), egg(0.055, 0.055, 0.055, TINT, s * 0.29, 0.21, 0.04, 0, 0, 0, 6, 4));
    }
    return C(p);
  },
});

function planetParts() {
  const g = new THREE.SphereGeometry(0.24, 18, 12).translate(0, 0.245, 0);
  return [
    ...multi(g, (x, y) => (Math.floor((y - 0.02) / 0.075) % 3 === 1 ? 1 : Math.floor((y - 0.02) / 0.075) % 3 === 2 ? 2 : 0), [TINT, 0xffffff, TINT]).map((q, i) => (i === 1 ? pale(q, 0.45) : i === 2 ? shade(q, 0xcfcfcf) : q)),
    tor(0.36, 0.035, 0xfff3c8, 0, 0.245, 0, PI / 2 + 0.35, 0, 0.15, 3, 26),
    tor(0.3, 0.02, 0xffd6a0, 0, 0.245, 0, PI / 2 + 0.35, 0, 0.15, 3, 26),
    ...[[0.1, 0.42, 0.14], [-0.14, 0.32, 0.17], [0.18, 0.2, 0.12]].map(([x, y, z]) => spark(0.018, 0xffffff, x, y, z)),
  ];
}
const PLANETS = [0xff9a5a, 0x6fb7ff, 0xff7ac0, 0x7bd99a, 0xb48cff, 0xffd23a];
def('planet', {
  label: 'Planet', col: { t: 'cyl', r: 0.38, h: 0.5 }, fit: 0.76, value: 1, mass: 0.15,
  tints: PLANETS,
  build: () => planetParts(),
});
def('bigplanet', {
  label: 'Big Planet', col: { t: 'cyl', r: 0.99, h: 1.3 }, fit: 1.98, value: 6, mass: 1.0,
  tints: PLANETS,
  build: () => scaled(planetParts(), 2.6),
});

def('ufo', {
  label: 'Flying Saucer', col: { t: 'cyl', r: 0.62, h: 0.64 }, fit: 1.24, value: 2, mass: 0.3,
  tints: [0xff7ac0, 0x5cc8ff, 0x7be07a, 0xffb92a, 0xb48cff],
  build: () => {
    const p = [
      lathe([[0, 0], [0.3, 0], [0.5, 0.05], [0.62, 0.11], [0.6, 0.15], [0.45, 0.2], [0, 0.22]], TINT, 0, 0.18, 0, 22),
      tor(0.6, 0.025, SILVER, 0, 0.29, 0, PI / 2, 0, 0, 3, 24),
      // glass dome with a little green pilot
      egg(0.27, 0.25, 0.27, 0xcfeaff, 0, 0.38, 0, 0, 0, 0, 14, 8),
      egg(0.1, 0.1, 0.09, 0x7be07a, 0, 0.5, 0.05, 0, 0, 0, 10, 6),
      bead(0.025, INK, -0.035, 0.52, 0.13), bead(0.025, INK, 0.035, 0.52, 0.13),
      pale(egg(0.06, 0.08, 0.03, 0xffffff, -0.12, 0.5, 0.2, 0.3, -0.4, 0, 6, 4), 0),
    ];
    for (let i = 0; i < 8; i++) { const a = i * TAU / 8; p.push(spark(0.035, [0xffe066, 0xff5c8a, 0x5cc8ff, 0x7be07a][i % 4], 0.52 * Math.sin(a), 0.32, 0.52 * Math.cos(a))); }
    for (let i = 0; i < 3; i++) {
      const a = i * TAU / 3 + PI / 3;
      p.push(tcyl(0.025, 0.025, 0.24, SILVER, 0.3 * Math.sin(a), 0.11, 0.3 * Math.cos(a), 0, a, 0.35, 5).rotateY(0));
      p.push(egg(0.06, 0.02, 0.06, STEEL, 0.34 * Math.sin(a), 0.02, 0.34 * Math.cos(a), 0, 0, 0, 7, 3));
    }
    return p;
  },
});

def('telescope', {
  label: 'Telescope', col: { t: 'box', w: 0.8, h: 1.5, d: 1.0 }, fit: 1.28, value: 3, mass: 0.3,
  tints: [0x5cc8ff, 0xff7ac0, 0xffb92a, 0xa070ff],
  build: () => {
    const p = [];
    for (let i = 0; i < 3; i++) {
      const a = i * TAU / 3 + 0.4;
      p.push(tcyl(0.025, 0.03, 0.9, WOOD, 0.22 * Math.sin(a), 0.42, 0.22 * Math.cos(a), 0, a, 0.5, 6).rotateY(0));
    }
    p.push(tcyl(0.06, 0.06, 0.1, WOOD_D, 0, 0.85, 0, 0, 0, 0, 8));
    // the tube points up toward the sky (-z), eyepiece toward the camera
    const tube = [
      tcyl(0.16, 0.12, 1.1, TINT, 0, 0, 0, 0, 0, 0, 14),
      tor(0.165, 0.025, GOLD, 0, 0.5, 0, PI / 2, 0, 0, 3, 14), tor(0.13, 0.02, GOLD, 0, -0.2, 0, PI / 2, 0, 0, 3, 12),
      tcyl(0.17, 0.17, 0.04, 0x2a3a6a, 0, 0.55, 0, 0, 0, 0, 14),
      tcyl(0.04, 0.05, 0.15, NAVY, 0, -0.6, 0, 0, 0, 0, 8),
      shade(vprism(starPts(0.07, 0.45), 0.02, TINT, 0, 0.15, 0.13), 0xffffff, 0.15),
    ];
    for (const g of tube) { g.rotateX(-0.95); g.rotateY(0.6); g.translate(0, 1.0, 0); }
    p.push(...tube);
    return C(p);
  },
});

def('satellite', {
  label: 'Satellite', col: { t: 'box', w: 1.82, h: 1.0, d: 0.74 }, fit: 1.96, value: 6, mass: 0.4,
  tints: [0xffc94a, 0xff8fb8, 0x8fe3c4, 0xb48cff],
  build: () => {
    const p = [
      ...[-1, 1].map((s) => tcyl(0.02, 0.04, 0.3, STEEL, s * 0.12, 0.15, 0, 0, 0, s * 0.3, 5)),
      rbox(0.42, 0.4, 0.42, TINT, 0, 0.28, 0, 0.06),
      tbox(0.44, 0.04, 0.44, SILVER, 0, 0.48, 0),
    ];
    for (const s of [-1, 1]) {
      p.push(tcyl(0.02, 0.02, 0.18, SILVER, s * 0.3, 0.48, 0, 0, 0, PI / 2, 5));
      p.push(...multi(new THREE.BoxGeometry(0.52, 0.03, 0.56, 3, 1, 3).translate(s * 0.64, 0.48, 0), (x, y, z) => (Math.floor((x + 2) / 0.173) + Math.floor((z + 2) / 0.187)) % 2, [0x3f6fd8, 0x6f9cf0]));
      p.push(tbox(0.54, 0.032, 0.02, SILVER, s * 0.64, 0.485, 0.28), tbox(0.54, 0.032, 0.02, SILVER, s * 0.64, 0.485, -0.28));
    }
    // dish and antenna on top
    p.push(lathe([[0, 0], [0.04, 0], [0.22, 0.1], [0.24, 0.13], [0.2, 0.12], [0.03, 0.03], [0, 0.03]], 0xf6f7fb, 0, 0.6, 0, 16).rotateX(0.3));
    p.push(tcyl(0.04, 0.05, 0.12, STEEL, 0, 0.55, 0, 0, 0, 0, 6));
    p.push(tcyl(0.008, 0.008, 0.2, SILVER, 0, 0.82, -0.02, 0.3, 0, 0, 4), bead(0.03, 0xff5c8a, 0, 0.92, -0.05));
    return C(p);
  },
});

def('moonrover', {
  label: 'Moon Rover', col: { t: 'box', w: 1.7, h: 1.15, d: 1.2 }, fit: 2.08, value: 7, mass: 0.7,
  tints: [0xffb92a, 0x5cc8ff, 0xff7ac0, 0x7bd99a],
  build: () => {
    const p = [
      rb(1.45, 0.25, 0.85, TINT, 0, 0.32, 0, 0.08),
      rb(0.55, 0.3, 0.7, 0xf6f7fb, -0.3, 0.55, 0, 0.1),
      rb(0.35, 0.22, 0.8, TINT, 0.5, 0.55, 0, 0.08),
      tbox(0.4, 0.1, 0.5, 0x3f6fd8, -0.35, 0.86, 0, 0, 0, 0.15),
      bead(0.06, 0xfff3c8, 0.72, 0.5, 0.25), bead(0.06, 0xfff3c8, 0.72, 0.5, -0.25),
      tcyl(0.015, 0.015, 0.3, SILVER, -0.62, 0.72, -0.25, 0, 0, 0, 4),
      lathe([[0, 0], [0.03, 0], [0.16, 0.07], [0.17, 0.09], [0.02, 0.02], [0, 0.02]], 0xf6f7fb, -0.62, 0.86, -0.25, 12),
      bead(0.03, 0xff5c8a, -0.62, 1.1, -0.25),
    ];
    for (const x of [-0.55, 0, 0.55]) for (const s of [-1, 1]) {
      p.push(tcyl(0.2, 0.2, 0.16, TIRE, x, 0.2, s * 0.5, PI / 2, 0, 0, 12), tcyl(0.09, 0.09, 0.17, SILVER, x, 0.2, s * 0.505, PI / 2, 0, 0, 8));
    }
    return C(p);
  },
});

def('rocketship', {
  label: 'Rocket Ship', col: { t: 'cyl', r: 0.95, h: 3.4 }, fit: 1.9, value: 6, mass: 0.8,
  tints: [0xff5d73, 0x5cc8ff, 0xffb92a, 0xa070ff],
  build: () => {
    const p = [
      lathe([[0, 0], [0.42, 0], [0.5, 0.3], [0.55, 0.9], [0.55, 1.7], [0.5, 2.2], [0.4, 2.5], [0, 2.5]], 0xf6f7fb, 0, 0.2, 0, 20),
      lathe([[0.4, 0], [0.3, 0.3], [0.15, 0.55], [0, 0.7]], TINT, 0, 2.7, 0, 20),
      shade(tcyl(0.555, 0.555, 0.18, TINT, 0, 1.25, 0, 0, 0, 0, 20), 0xffffff),
      tcyl(0.38, 0.3, 0.22, STEEL, 0, 0.11, 0, 0, 0, 0, 14),
      // porthole
      tor(0.17, 0.04, SILVER, 0, 1.75, 0.53, 0, 0, 0, 4, 16), egg(0.15, 0.15, 0.04, 0x8fd0ff, 0, 1.75, 0.52, 0, 0, 0, 12, 6),
      pale(egg(0.04, 0.06, 0.02, 0xffffff, -0.05, 1.8, 0.56, 0, 0, 0, 6, 4), 0),
      bead(0.06, 0xffe066, 0, 3.4 - 0.06, 0),
    ];
    // three fins
    for (let i = 0; i < 3; i++) {
      const a = i * TAU / 3 + PI / 3;
      p.push(vprism([[0, 0], [0.42, -0.25], [0.42, -0.05], [0, 0.85]], 0.08, TINT, 0, 0.25, 0, a - PI / 2).translate(0.5 * Math.sin(a), 0, 0.5 * Math.cos(a)));
      p.push(egg(0.06, 0.03, 0.06, STEEL, 0.9 * Math.sin(a), 0.02, 0.9 * Math.cos(a), 0, 0, 0, 7, 3));
    }
    return p;
  },
});

def('domehab', {
  label: 'Moon Dome', col: { t: 'cyl', r: 1.4, h: 1.75 }, fit: 2.8, value: 13, mass: 1.2,
  tints: [0xff8fb8, 0x6fb7ff, 0x7bd99a, 0xffc35a],
  build: () => {
    const domeG = new THREE.SphereGeometry(1.25, 20, 8, 0, TAU, 0, PI / 2).translate(0, 0.14, 0);
    const p = [
      lathe([[0, 0], [1.32, 0], [1.38, 0.06], [1.32, 0.16], [0, 0.16]], 0xb9b5d6, 0, 0, 0, 22),
      ...two(domeG, (x, y, z) => (Math.floor(((Math.atan2(x, z) + PI) / TAU) * 10) + Math.floor((y - 0.14) / 0.42)) % 2 === 0, 0xf6f7fb, TINT),
      // door tunnel toward the camera
      rbox(0.7, 0.75, 0.5, 0xf6f7fb, 0, 0.1, 1.05, 0.15),
      rbox(0.42, 0.55, 0.05, TINT, 0, 0.12, 1.31, 0.08), bead(0.03, GOLD, 0.12, 0.38, 1.34),
      // round window glowing warm
      tor(0.18, 0.04, SILVER, 0.65, 0.95, 0.75, -0.75, 0.7, 0, 4, 14),
      egg(0.16, 0.16, 0.04, 0xffe08a, 0.65, 0.95, 0.75, -0.75, 0.7, 0, 10, 5),
      // antenna on top
      tcyl(0.02, 0.02, 0.4, SILVER, 0, 1.5, 0, 0, 0, 0, 5), bead(0.06, 0xff5c8a, 0, 1.69, 0),
    ];
    return p;
  },
});

def('lander', {
  label: 'Moon Lander', col: { t: 'box', w: 3.0, h: 2.8, d: 3.0 }, fit: 4.24, value: 29, mass: 2.5,
  tints: [0xffc94a, 0xff8fb8, 0x8fe3c4, 0x9fc8ff],
  build: () => {
    const p = [
      rbox(1.7, 0.9, 1.7, TINT, 0, 0.75, 0, 0.12),
      lathe([[0, 0], [0.75, 0], [0.8, 0.1], [0.72, 0.5], [0.45, 0.85], [0, 0.95]], 0xf6f7fb, 0, 1.65, 0, 16),
      // windows, hatch, ladder
      egg(0.17, 0.17, 0.05, 0x8fd0ff, -0.3, 2.05, 0.6, -0.55, 0, 0, 10, 5), egg(0.17, 0.17, 0.05, 0x8fd0ff, 0.3, 2.05, 0.6, -0.55, 0, 0, 10, 5),
      rbox(0.5, 0.55, 0.06, 0xf6f7fb, 0, 0.85, 0.86, 0.06),
      tcyl(0.025, 0.025, 0.9, SILVER, -0.2, 0.45, 1.1, -0.35, 0, 0, 4), tcyl(0.025, 0.025, 0.9, SILVER, 0.2, 0.45, 1.1, -0.35, 0, 0, 4),
      ...[0.15, 0.4, 0.65].map((y) => tbox(0.4, 0.03, 0.03, SILVER, 0, y, 1.2 - y * 0.36)),
      // antenna dish and flag
      tcyl(0.02, 0.02, 0.4, SILVER, 0.45, 2.6, -0.3, 0, 0, 0, 4),
      lathe([[0, 0], [0.03, 0], [0.22, 0.09], [0.03, 0.03], [0, 0.03]], 0xf6f7fb, 0.45, 2.7, -0.3, 12),
      tcyl(0.015, 0.015, 0.7, SILVER, -0.55, 2.0, -0.4, 0, 0, 0, 4), vprism([[0, 0], [0.35, 0], [0.35, 0.22], [0, 0.22]], 0.01, TINT, -0.37, 2.1, -0.4),
    ];
    // four legs with round feet
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const fx = sx * 1.3, fz = sz * 1.3;
      p.push(custom(new THREE.CylinderGeometry(0.045, 0.045, 1.25, 6).translate(0, 0.625, 0)
        .applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(-sx * 0.55, 0.85, -sz * 0.55).normalize())).translate(fx, 0.06, fz), SILVER));
      p.push(lathe([[0, 0], [0.18, 0], [0.2, 0.04], [0.12, 0.08], [0, 0.08]], STEEL, fx, 0, fz, 10));
    }
    return p;
  },
});

def('moonbase', {
  label: 'Moon Base', col: { t: 'box', w: 5.0, h: 3.4, d: 3.6 }, fit: 6.16, value: 61, mass: 9,
  tints: [0xff8fb8, 0x6fb7ff, 0x7bd99a, 0xffc35a],
  build: () => {
    const dome = (r, x, z, seg = 16) => two(new THREE.SphereGeometry(r, seg, 7, 0, TAU, 0, PI / 2).translate(x, 0.2, z),
      (px, py, pz) => (Math.floor(((Math.atan2(px - x, pz - z) + PI) / TAU) * 10) + Math.floor((py - 0.2) / (r / 3))) % 2 === 0, 0xf6f7fb, TINT);
    const p = [
      rbox(5.0, 0.2, 3.6, 0xb9b5d6, 0, 0, 0, 0.1),
      ...dome(1.45, -0.3, 0.1, 14),
      ...dome(0.85, -1.65, 0.6, 12), ...dome(0.85, 1.6, 0.7, 12),
      // connecting tubes
      tcyl(0.3, 0.3, 0.8, 0xf6f7fb, -1.0, 0.5, 0.4, 0, 0.2, PI / 2, 10), tcyl(0.3, 0.3, 0.7, 0xf6f7fb, 0.9, 0.5, 0.45, 0, -0.15, PI / 2, 10),
      // the big window glowing warm, a door toward the camera
      egg(0.42, 0.3, 0.06, 0xffe08a, -0.3, 1.0, 1.42, -0.5, 0, 0, 12, 6), tor(0.42, 0.04, SILVER, -0.3, 1.0, 1.42, -0.5, 0, 0, 3, 18).scale(1, 0.75, 1).translate(0, 0.25, 0),
      rb(0.6, 0.7, 0.4, 0xf6f7fb, -0.3, 0.2, 1.48, 0.12), rb(0.36, 0.5, 0.04, TINT, -0.3, 0.22, 1.69, 0.06),
      // radar tower at the back left
      tcyl(0.12, 0.16, 2.6, 0xf6f7fb, -1.9, 1.5, -1.1, 0, 0, 0, 10),
      ...[1.0, 1.8, 2.5].map((y) => tor(0.15, 0.03, TINT, -1.9, y, -1.1, PI / 2, 0, 0, 3, 10)),
      lathe([[0, 0], [0.05, 0], [0.5, 0.2], [0.55, 0.26], [0.45, 0.24], [0.05, 0.06], [0, 0.06]], 0xf6f7fb, -1.9, 2.8, -1.1, 16),
      bead(0.08, 0xff5c8a, -1.9, 3.3, -1.1),
      // a little rocket on its pad at the back right
      tcyl(0.65, 0.65, 0.1, 0x9b96c4, 1.7, 0.25, -1.0, 0, 0, 0, 16),
      lathe([[0, 0], [0.3, 0], [0.36, 0.4], [0.36, 1.6], [0.28, 2.0], [0, 2.05]], 0xf6f7fb, 1.7, 0.35, -1.0, 14),
      lathe([[0.28, 0], [0.18, 0.35], [0, 0.6]], TINT, 1.7, 2.4, -1.0, 14),
      tor(0.12, 0.03, SILVER, 1.7, 1.5, -0.65, 0, 0, 0, 3, 12), egg(0.1, 0.1, 0.03, 0x8fd0ff, 1.7, 1.5, -0.65, 0, 0, 0, 8, 4),
      bead(0.06, 0xffe066, 1.7, 4.6 - 0.06 - 1.6, -1.0),
      // a flag and a little rover parked out front
      tcyl(0.02, 0.02, 1.0, SILVER, 1.9, 0.7, 1.1, 0, 0, 0, 4), vprism([[0, 0], [0.45, 0], [0.45, 0.28], [0, 0.28]], 0.01, TINT, 1.91, 0.88, 1.1),
    ];
    for (let i = 0; i < 3; i++) { const a = i * TAU / 3 + 0.5; p.push(vprism([[0, 0], [0.25, -0.1], [0.25, 0.1], [0, 0.5]], 0.05, TINT, 1.7 + 0.3 * Math.sin(a), 0.35, -1.0 + 0.3 * Math.cos(a), a - PI / 2)); }
    // landing lights along the front edge
    for (let i = 0; i < 7; i++) p.push(spark(0.06, i % 2 ? 0xffe066 : 0x8fd0ff, -2.1 + i * 0.7, 0.27, 1.65));
    return p;
  },
});

// World -> its new props (smallest first). Used by the dev galleries and the backdrop preview.
export const WAVE3_WORLDS = {
  craft: ['thimble', 'button', 'pompom', 'spool', 'tapemeasure', 'yarnball', 'pincushion', 'buttonjar', 'scissors', 'dressform', 'bigbutton', 'sewingbasket', 'quiltstack', 'bigyarn', 'sewingmachine', 'comfychair', 'yarnbasket'],
  fair: ['candyapple', 'ticket', 'balloon', 'goldfishbag', 'popcorn', 'pinwheel', 'prizebunny', 'milkbottles', 'carouselhorse', 'bumpercar', 'teacup', 'ticketbooth', 'popcorncart', 'prizestall', 'carousel'],
  space: ['star', 'moonrock', 'alien', 'spacepup', 'planet', 'astronaut', 'ufo', 'telescope', 'satellite', 'rocketship', 'bigplanet', 'moonrover', 'domehab', 'lander', 'moonbase'],
};
