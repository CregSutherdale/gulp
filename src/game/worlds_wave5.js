// Season 5 worlds: Pet Shop, Under the Sea and Music Room.
//   WORLDS    floor / sky / rail defs (same shape as levelbuild.js WORLDS)
//   BACKDROPS scenery builders, same contract and kit K as backdrops.js:
//             - nothing 3D inside |x| < w/2+1.2 and |z| < d/2+1.2 (flat ground only, and
//               never under the board itself: it would show through the hole),
//             - the near (+z) side stays LOW, tall pieces live far (-z) and at the far sides,
//             - a handful of merged meshes, no lights, baked blob shadows, procedural
//               canvas textures <= 256 px, deterministic (K.R), code-built geometry only.
//   MUSIC     world -> one of the 8 existing tracks (src/engine/audio.js)
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { box, cyl, cone, ball, torus, custom, merge } from './geo.js';
import { patchGround } from '../engine/render.js';

const TAU = Math.PI * 2, PI = Math.PI;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const _c = new THREE.Color(), _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
const _p = new THREE.Vector3(), _s = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);

// ============================================================== floors (arena)
function noise(x, w, h, a) {
  const img = x.getImageData(0, 0, w, h), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * a; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  x.putImageData(img, 0, 0);
}
function rrect(x, l, t, w, h, r) {
  x.beginPath(); x.moveTo(l + r, t); x.arcTo(l + w, t, l + w, t + h, r); x.arcTo(l + w, t + h, l, t + h, r);
  x.arcTo(l, t + h, l, t, r); x.arcTo(l, t, l + w, t, r); x.closePath(); x.fill();
}
function paw2d(x, cx, cy, s, col) {
  x.fillStyle = col;
  x.beginPath(); x.ellipse(cx, cy, 9 * s, 7.5 * s, 0, 0, TAU); x.fill();
  for (const [dx, dy] of [[-9.5, -8], [-3.5, -12.5], [3.5, -12.5], [9.5, -8]]) { x.beginPath(); x.ellipse(cx + dx * s, cy + dy * s, 3.5 * s, 4 * s, 0, 0, TAU); x.fill(); }
}
export const WORLDS = {
  pets: {
    // Soft mint and cream shop tiles with a few faded paw prints: bright toys pop on it.
    label: 'Pet Shop', sky: 0xfff1e2, hemiSky: 0xfff8f0, hemiGround: 0xd8cbb8, surround: 0xe6d8c6, wall: 0x7fd1c0, accent: '#ff7a9c',
    tile: 4, floor: (x, w, h) => {
      const n = 4, s = w / n;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        x.fillStyle = (i + j) % 2 ? '#d6efe6' : '#f6f0e4'; x.fillRect(i * s, j * s, s, s);
      }
      x.strokeStyle = 'rgba(255,255,255,.7)'; x.lineWidth = 2;
      for (let i = 0; i <= n; i++) { x.beginPath(); x.moveTo(i * s, 0); x.lineTo(i * s, h); x.stroke(); x.beginPath(); x.moveTo(0, i * s); x.lineTo(w, i * s); x.stroke(); }
      noise(x, w, h, 6);
      paw2d(x, w * 0.3, h * 0.62, 1.1, 'rgba(160,200,190,.35)');
      paw2d(x, w * 0.78, h * 0.18, 1.0, 'rgba(210,190,170,.35)');
    },
  },
  aquarium: {
    // Pale sea-floor sand with soft ripples and a few colored pebbles, under deep blue water.
    label: 'Under the Sea', sky: 0x3f8fc6, hemiSky: 0xe2f7ff, hemiGround: 0x8fc0c8, surround: 0xe6cf98, wall: 0xffb38a, accent: '#3fb8e0',
    tile: 5, floor: (x, w, h) => {
      x.fillStyle = '#f2e2b4'; x.fillRect(0, 0, w, h);
      noise(x, w, h, 14);
      x.strokeStyle = 'rgba(200,170,110,.35)'; x.lineWidth = 3;
      for (let i = 0; i < 7; i++) { x.beginPath(); for (let k = 0; k <= w; k += 8) x.lineTo(k, i * h / 7 + 10 + Math.sin((k / w) * TAU * 3 + i * 1.7) * 6); x.stroke(); }
      x.strokeStyle = 'rgba(255,255,255,.35)'; x.lineWidth = 2;
      for (let i = 0; i < 7; i++) { x.beginPath(); for (let k = 0; k <= w; k += 8) x.lineTo(k, i * h / 7 + 13 + Math.sin((k / w) * TAU * 3 + i * 1.7) * 6); x.stroke(); }
      const peb = ['#ff9ec0', '#8fd0ff', '#ffe27a', '#9fe6b8', '#c9b2ff'];
      for (let i = 0; i < 18; i++) { x.fillStyle = peb[i % 5]; x.beginPath(); x.ellipse(((i * 97) % 251) * w / 256, ((i * 61 + 17) % 249) * h / 256, 3.5, 2.6, i, 0, TAU); x.fill(); }
    },
  },
  music: {
    // A warm honey stage floor: long planks with a soft sheen; instruments pop on it.
    label: 'Music Room', sky: 0xffe9da, hemiSky: 0xfff6ee, hemiGround: 0xd9b8a0, surround: 0x8a5a3e, wall: 0xff8fa8, accent: '#a070ff',
    tile: 4, floor: (x, w, h) => {
      const planks = 5;
      for (let i = 0; i < planks; i++) {
        x.fillStyle = `hsl(33, 58%, ${70 + (i % 3) * 3}%)`; x.fillRect(0, i * h / planks, w, h / planks);
        x.fillStyle = 'rgba(120,70,30,.28)'; x.fillRect(0, (i + 1) * h / planks - 2, w, 2);
        x.fillRect(((i * 89) % 200) + 20, i * h / planks, 2, h / planks);
      }
      x.strokeStyle = 'rgba(150,90,40,.12)'; x.lineWidth = 1;
      for (let k = 0; k < 18; k++) { const y0 = (k * 37) % h; x.beginPath(); for (let i = 0; i <= w; i += 8) x.lineTo(i, y0 + Math.sin((i / w) * TAU * 2 + k) * 2.5); x.stroke(); }
      noise(x, w, h, 8);
    },
  },
};

export const MUSIC = { pets: 'east_town', aquarium: 'holy_sanctuary', music: 'lively_city' };

// ============================================================== scenery helpers
// (copied from backdrops.js so this file stands alone)
const ballC = (r, col, x = 0, y = 0, z = 0, det = 1, sy = 1) => ball(r, col, x, y - r * sy, z, det, sy);
const egg = (a, b, c, col, x = 0, y = 0, z = 0, ws = 12, hs = 8) =>
  custom(new THREE.SphereGeometry(1, ws, hs).scale(a, b, c).translate(x, y, z), col);
const dome = (a, b, c, col, x = 0, y = 0, z = 0, ws = 18, hs = 6) =>
  custom(new THREE.SphereGeometry(1, ws, hs, 0, TAU, 0, PI / 2).scale(a, b, c).translate(x, y, z), col);
const boxS = (w, h, d, col, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) =>
  custom(new THREE.BoxGeometry(w, h, d, sx, sy, sz).translate(x, y + h / 2, z), col);
const rb = (w, h, d, col, x = 0, y = 0, z = 0, r = 0.1) =>
  custom(new RoundedBoxGeometry(w, h, d, 1, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001)).translate(x, y + h / 2, z), col);
const lathe = (pts, col, seg = 14, x = 0, y = 0, z = 0) =>
  custom(new THREE.LatheGeometry(pts.map(([r, h]) => new THREE.Vector2(r, h)), seg).translate(x, y, z), col);
const rectXZ = (x0, x1, z0, z1, y, col, sx = 1, sz = 1) =>
  custom(new THREE.PlaneGeometry(x1 - x0, z1 - z0, sx, sz).rotateX(-PI / 2).translate((x0 + x1) / 2, y, (z0 + z1) / 2), col);
function disc(r, col, x = 0, y = 0, z = 0, seg = 16, sx = 1, sz = 1) {
  return custom(new THREE.CircleGeometry(r, seg).rotateX(-PI / 2).scale(sx, 1, sz).translate(x, y, z), col);
}
function panel(w, h, col, x = 0, y = 0, z = 0, ry = 0) {
  const g = new THREE.PlaneGeometry(w, h).translate(0, h / 2, 0); if (ry) g.rotateY(ry);
  return custom(g.translate(x, y, z), col);
}
const vdisc = (r, col, x = 0, y = 0, z = 0, seg = 20) => custom(new THREE.CircleGeometry(r, seg).translate(x, y, z), col);
function rod(a, b, r0, r1, col, seg = 6) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), len = A.distanceTo(B) || 0.001;
  const g = new THREE.CylinderGeometry(r1, r0, len, seg).translate(0, len / 2, 0);
  g.applyQuaternion(_q.setFromUnitVectors(_up, B.clone().sub(A).normalize())).translate(A.x, A.y, A.z);
  return custom(g, col);
}
function starShape(r = 1, inner = 0.45, n = 5) {
  const s = new THREE.Shape();
  for (let i = 0; i <= n * 2; i++) {
    const a = PI / 2 + (i / (n * 2)) * TAU, rr = i % 2 ? r * inner : r;
    if (i === 0) s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  return s;
}
const shapeZ = (shape, col, x = 0, y = 0, z = 0, s = 1) => custom(new THREE.ShapeGeometry(shape).scale(s, s, s).translate(x, y, z), col);
function noteShape(s = 1) {
  // an eighth note facing +z: head, stem and flag
  const sh = new THREE.Shape();
  sh.absellipse(0, 0, 0.42 * s, 0.3 * s, 0, TAU, false, 0.4);
  const st = new THREE.Shape();
  st.moveTo(0.3 * s, 0.05 * s); st.lineTo(0.42 * s, 0.05 * s); st.lineTo(0.42 * s, 1.5 * s); st.quadraticCurveTo(0.95 * s, 1.15 * s, 0.85 * s, 0.6 * s);
  st.quadraticCurveTo(0.8 * s, 0.95 * s, 0.42 * s, 1.1 * s); st.lineTo(0.3 * s, 1.1 * s); st.lineTo(0.3 * s, 0.05 * s);
  return [sh, st];
}
function put(parts, x = 0, y = 0, z = 0, ry = 0, s = 1, rx = 0, rz = 0) {
  const list = [parts].flat(Infinity);
  _e.set(rx, ry, rz, 'YXZ');
  if (typeof s === 'number') _s.set(s, s, s); else _s.set(s[0], s[1], s[2]);
  _m4.compose(_p.set(x, y, z), _q.setFromEuler(_e), _s);
  for (const g of list) g.applyMatrix4(_m4);
  return list;
}
function recolor(parts, fn) {
  for (const g of [parts].flat(Infinity)) {
    const p = g.attributes.position, c = g.attributes.color;
    for (let i = 0; i < p.count; i++) {
      _c.setRGB(c.getX(i), c.getY(i), c.getZ(i));
      fn(p.getX(i), p.getY(i), p.getZ(i), _c);
      c.setXYZ(i, _c.r, _c.g, _c.b);
    }
  }
  return parts;
}
const shadeY = (parts, y0, y1, lo, hi) => recolor(parts, (x, y, z, c) => c.multiplyScalar(lo + (hi - lo) * clamp01((y - y0) / (y1 - y0))));
function jitter(parts, R, amt) {
  for (const g of [parts].flat(Infinity)) {
    const c = g.attributes.color;
    for (let i = 0; i < c.count; i += 3) {
      const k = 1 + (R() - 0.5) * amt;
      for (let j = i; j < i + 3 && j < c.count; j++) c.setXYZ(j, c.getX(j) * k, c.getY(j) * k, c.getZ(j) * k);
    }
  }
  return parts;
}
function twoSided(parts) {
  const out = [];
  for (const g of [parts].flat(Infinity)) {
    const b = g.clone(), n = b.attributes.normal;
    for (const att of Object.values(b.attributes)) {
      const k = att.itemSize;
      for (let i = 0; i + 2 < att.count; i += 3) for (let c = 0; c < k; c++) { const t = att.array[(i + 1) * k + c]; att.array[(i + 1) * k + c] = att.array[(i + 2) * k + c]; att.array[(i + 2) * k + c] = t; }
    }
    for (let i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i));
    out.push(g, b);
  }
  return out;
}
function worldUV(g, tile) {
  const p = g.attributes.position, n = g.attributes.normal, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const nx = n.getX(i), ny = n.getY(i), nz = n.getZ(i), ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz);
    let u, v;
    if (ay >= ax && ay >= az) { u = p.getX(i); v = -p.getZ(i); }
    else if (ax >= az) { u = -p.getZ(i) * Math.sign(nx); v = p.getY(i); }
    else { u = p.getX(i) * Math.sign(nz); v = p.getY(i); }
    uv[i * 2] = u / tile; uv[i * 2 + 1] = v / tile;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}
function canvasTex(size, draw) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}
function speckle(x, s, R, amt) {
  const img = x.getImageData(0, 0, s, s), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (R() - 0.5) * amt; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  x.putImageData(img, 0, 0);
}
function texMesh(parts, tex, tile, name) {
  const list = [parts].flat(Infinity);
  for (const g of list) worldUV(g, tile);
  const m = new THREE.Mesh(merge(list), patchGround(new THREE.MeshLambertMaterial({ map: tex, vertexColors: true })));
  m.name = name; m.receiveShadow = true;
  return m;
}
// Many flat, upward discs in ONE geometry: [x, y, z, r, colour, seg=7, sx=1, sz=1, ry=0].
function discBatch(items) {
  let n = 0;
  for (const it of items) n += (it[5] || 7) * 3;
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), nor = new Float32Array(n * 3), tm = new Float32Array(n);
  let k = 0;
  for (const [x, y, z, r, c, seg = 7, sx = 1, sz = 1, ry = 0] of items) {
    _c.set(c);
    const cs = Math.cos(ry), sn = Math.sin(ry);
    for (let i = 0; i < seg; i++) for (const a of [-1, (i + 1) / seg, i / seg]) {
      let px = 0, pz = 0;
      if (a >= 0) { px = Math.cos(a * TAU) * r * sx; pz = Math.sin(a * TAU) * r * sz; }
      pos[k * 3] = x + px * cs + pz * sn; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z - px * sn + pz * cs;
      nor[k * 3 + 1] = 1; col[k * 3] = _c.r; col[k * 3 + 1] = _c.g; col[k * 3 + 2] = _c.b;
      k++;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('tmask', new THREE.BufferAttribute(tm, 1));
  return g;
}
// The floor round the board in four bands (never under the board: it would show in the hole).
function ringFloor(hw, hd, X, Z0, Z1, y = -0.01) {
  const x0 = hw + 0.5, z0 = hd + 0.5;
  return [rectXZ(-X, X, z0, Z1, y, 0xffffff, 8, 4), rectXZ(-X, X, Z0, -z0, y, 0xffffff, 8, 4), rectXZ(x0, X, -z0, z0, y, 0xffffff, 4, 8), rectXZ(-X, -x0, -z0, z0, y, 0xffffff, 4, 8)];
}
const lighten = (hex, t) => new THREE.Color(hex).lerp(new THREE.Color(0xffffff), t).getHex();
const darken = (hex, k) => new THREE.Color(hex).multiplyScalar(k).getHex();
const WHITE = 0xfffaf4, GOLD = 0xffc95a, INK = 0x4a3a4a, CHROME = 0xe6ebf1;
const PASTEL = [0xff9ec8, 0x9fe6cc, 0x9fd2ff, 0xffe27a, 0xc9b2ff, 0xffbf94];

// ============================================================== PET SHOP
const tileTex = (R) => canvasTex(128, (x, s) => {
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { x.fillStyle = (i + j) % 2 ? '#e9dcc8' : '#f7efe2'; x.fillRect(i * s / 2, j * s / 2, s / 2, s / 2); }
  x.strokeStyle = 'rgba(255,255,255,.6)'; x.lineWidth = 2;
  for (let k = 0; k <= 2; k++) { x.beginPath(); x.moveTo(k * s / 2, 0); x.lineTo(k * s / 2, s); x.stroke(); x.beginPath(); x.moveTo(0, k * s / 2); x.lineTo(s, k * s / 2); x.stroke(); }
  speckle(x, s, R, 6);
});
// A product on a shelf: bags, cans, boxes, balls (small shop goods).
function product(K, kind, col) {
  if (kind === 0) return [rb(0.7, 1.0, 0.45, col, 0, 0, 0, 0.1), box(0.72, 0.1, 0.12, darken(col, 0.85), 0, 1.0, 0), rb(0.46, 0.34, 0.03, WHITE, 0, 0.3, 0.22, 0.04)];
  if (kind === 1) return [0, 1, 2].flatMap((i) => [cyl(0.18, 0.18, 0.36, col, -0.4 + i * 0.4, 0, 0, 10), cyl(0.185, 0.185, 0.12, WHITE, -0.4 + i * 0.4, 0.12, 0, 10)]);
  if (kind === 2) return [rb(0.9, 0.6, 0.5, col, 0, 0, 0, 0.05), rb(0.5, 0.3, 0.03, WHITE, 0, 0.15, 0.25, 0.04)];
  return [0, 1, 2].map((i) => ballC(0.2, PASTEL[(i * 2 + 1) % 6], -0.42 + i * 0.42, 0.2, 0, 1));
}
function shelfUnit(K, w, h, d, levels, col, along = 'x') {
  const s = [boxS(w, 0.25, d, darken(col, 0.9), 0, 0, 0), boxS(w, h, 0.12, lighten(col, 0.25), 0, 0, -d / 2 + 0.06)];
  for (const sx of [-1, 1]) s.push(boxS(0.14, h, d, col, sx * (w / 2 - 0.07), 0, 0));
  for (let l = 1; l <= levels; l++) {
    const y = (l * h) / (levels + 0.4);
    s.push(boxS(w, 0.12, d, col, 0, y, 0));
    for (let x = -w / 2 + 0.9; x < w / 2 - 0.6; x += 1.25) s.push(...put(product(K, Math.floor(K.R() * 4), K.pick([0xff8a8a, 0x7fc4ff, 0x9fe0a8, 0xffd36a, 0xc8a8ff, 0xffa36b])), x, y + 0.12, 0.05));
  }
  s.push(boxS(w + 0.1, 0.18, d + 0.1, darken(col, 0.85), 0, h, 0));
  return s;
}
function fishTank(K, w, h, d) {
  const s = [rb(w + 0.3, 0.3, d + 0.3, 0x5a6a8a, 0, 0, 0, 0.05), rb(w + 0.3, 0.25, d + 0.3, 0x5a6a8a, 0, h + 0.3, 0, 0.05)];
  const g = [boxS(w, h, d, 0xbfeaff, 0, 0.3, 0)];
  const l = [rectXZ(-w / 2, w / 2, -d / 2, d / 2, 0.32 + h * 0.85, 0x7fd6ff)];
  // gravel, plants, a little castle and bright fish (seen through the glass)
  s.push(boxS(w - 0.1, 0.3, d - 0.1, 0xf6d7a6, 0, 0.3, 0));
  for (let i = 0; i < 5; i++) { const x = -w / 2 + 0.5 + i * (w - 1) / 4; s.push(rod([x, 0.6, 0], [x + K.rnd(-0.2, 0.2), 0.6 + h * K.rnd(0.4, 0.7), K.rnd(-0.2, 0.2)], 0.08, 0.04, 0x6cc46b, 5)); }
  for (let i = 0; i < 5; i++) {
    const x = K.rnd(-w / 2 + 0.6, w / 2 - 0.6), y = 0.3 + h * K.rnd(0.35, 0.75), c = K.pick([0xff9a3a, 0xff6f91, 0xffd23f, 0x5cc8ff]);
    s.push(egg(0.28, 0.18, 0.08, c, x, y, d / 2 - 0.25, 8, 6), custom(new THREE.ConeGeometry(0.14, 0.24, 4).rotateZ(PI / 2).translate(x - 0.36, y, d / 2 - 0.25), c));
  }
  return { s, g, l };
}
function pets(K) {
  const { hw, hd, ns } = K;
  K.shadow = 0x6a5a48;
  const G = K.glossy, M = K.matte;
  const BZ = -(hd + 12), RX = hw + 16, SZ = hd + 24;
  // Shop tiles round the board, a long doormat on the near side.
  K.meshes.push(texMesh(ringFloor(hw, hd, RX, BZ, SZ), tileTex(K.R), 3, 'shopfloor'));
  const mz = hd + 4.2 * ns;
  K.flat.push(rectXZ(-hw * 0.5, hw * 0.5, mz - 1.1, mz + 1.1, 0.01, 0x8fd1c0), rectXZ(-hw * 0.5 + 0.25, hw * 0.5 - 0.25, mz - 0.85, mz + 0.85, 0.015, 0x6fbfae));
  const dots = [];
  for (let i = 0; i < 6; i++) dots.push(...[[0, 0], [-0.4, -0.4], [-0.13, -0.6], [0.13, -0.6], [0.4, -0.4]].map(([dx, dz], k) => [-hw * 0.4 + i * hw * 0.16 + dx * 0.7, 0.02, mz + 0.25 + dz * 0.7, k ? 0.13 : 0.24, WHITE, 8]));

  // Back wall: mint wainscot, cream wall with big paw prints, the shop's shelves of goods.
  const wall = boxS(2 * RX, 22, 1, 0xfff3e4, 0, 0, BZ - 0.5, 1, 6, 1);
  shadeY(wall, 0, 22, 0.84, 1.03);
  M.push(wall, box(2 * RX, 4.5, 0.3, 0x8fd1c0, 0, 0, BZ + 0.15));
  G.push(box(2 * RX, 0.35, 0.45, WHITE, 0, 4.5, BZ + 0.2));
  for (const s of [-1, 1]) {
    const sw = boxS(1, 22, SZ - BZ, 0xfff3e4, s * (RX + 0.5), 0, (SZ + BZ) / 2, 1, 6, 1);
    shadeY(sw, 0, 22, 0.78, 0.98);
    M.push(sw, box(0.3, 4.5, SZ - BZ, 0x8fd1c0, s * (RX - 0.15), 0, (SZ + BZ) / 2));
  }
  const nb = Math.max(2, Math.round((2 * hw) / 7));
  for (let i = 0; i < nb; i++) {
    const x = -hw + 1.5 + (i * (2 * hw - 3)) / Math.max(1, nb - 1), z = BZ + 1.5;
    if (i % 2 === 0) K.add(shelfUnit(K, 5.2, 6.5, 2.2, 3, 0xffb3c6), x, 0, z);
    else { const t = fishTank(K, 4.6, 2.6, 1.8); K.add(boxS(5.0, 2.4, 2.0, 0x9a7ab8, 0, 0, 0), x, 0, z); K.add(t, x, 2.4, z); K.halos.push([x, 3.8, z + 1.2, 2.8, 1.8, 0.35, 0x7fd6ff, true]); }
    K.blob(x, 0.02, z + 0.3, 3.0, 1.6, 0.4);
  }
  // A big paw sign on the wall, with hanging bunting under it.
  const sy = 10.5;
  G.push(...put([vdisc(2.6, 0xff9ec0, 0, 0, 0, 24), vdisc(2.2, WHITE, 0, 0, 0.02, 24)], 0, sy, BZ + 0.05));
  const paw = [egg(0.95, 0.8, 0.12, 0xff7a9c, 0, -0.3, 0, 12, 6), ...[[-0.95, 0.55], [-0.35, 1.0], [0.35, 1.0], [0.95, 0.55]].map(([x, y]) => egg(0.32, 0.38, 0.12, 0xff7a9c, x, y, 0, 10, 6))];
  G.push(...put(paw, 0, sy, BZ + 0.2));
  const BUN = [0xff9ec0, 0xffe27a, 0x9fd2ff, 0x9fe6cc];
  for (let i = 0; i < 18; i++) {
    const x = -hw * 0.9 + (i * 1.8 * hw) / 17, y = 7.6 - Math.sin((i / 17) * PI) * 1.2;
    const pg = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.5, 0, 0), new THREE.Vector3(0, -0.9, 0), new THREE.Vector3(0.5, 0, 0)]);
    pg.computeVertexNormals();
    K.add([custom(pg, BUN[i % 4])], x, y, BZ + 0.6);
  }
  // Side aisles: tall shelves running toward the camera, far half only.
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) {
    const z = -hd + 3 + k * 6.2;
    if (z > hd * 0.35) continue;
    K.add(shelfUnit(K, 5.6, 5.5, 2.0, 3, k % 2 ? 0x9fd2ff : 0xffd36a), s * (hw + 6.5), 0, z, -s * PI / 2);
    K.blob(s * (hw + 6.5), 0.02, z, 1.5, 3.2, 0.35);
  }
  // Cash counter at the far left corner, a dog bed + basket of balls far right.
  const cx = -(hw + 6.5), cz = -(hd + 6.5);
  K.add([rb(4.5, 2.4, 2.0, 0xff9ec0, 0, 0, 0, 0.15), rb(4.7, 0.2, 2.2, WHITE, 0, 2.4, 0, 0.08), rb(1.3, 0.9, 1.0, 0x9fd2ff, 0.9, 2.6, 0, 0.1), box(0.9, 0.35, 0.05, 0x5a6a8a, 0.9, 3.0, 0.52)], cx, 0, cz, 0.2);
  K.blob(cx, 0.02, cz, 3.0, 1.8, 0.4, 0.2);
  const bx = hw + 6.2, bz = -(hd + 5.8);
  K.add([lathe([[0, 0], [1.9, 0], [2.2, 0.3], [2.2, 0.8], [1.9, 1.0], [1.6, 0.6], [0, 0.4]], 0x8fc4ff, 18), dome(1.6, 0.25, 1.6, 0xfff0d4, 0, 0.4, 0, 14, 4)], bx, 0, bz);
  K.blob(bx, 0.02, bz, 2.6, 2.6, 0.4);
  K.add([lathe([[0, 0], [1.1, 0], [1.3, 1.1], [1.25, 1.2], [0, 1.0]], 0xd9a066, 14), ...[0, 1, 2, 3, 4].map((i) => ballC(0.45, PASTEL[i], Math.cos(i * 1.3) * 0.5, 1.3 + (i % 2) * 0.25, Math.sin(i * 1.3) * 0.5, 1))], bx - 4.0, 0, bz + 2.6);
  K.blob(bx - 4.0, 0.02, bz + 2.6, 1.5, 1.5, 0.4);
  // Near side (low): a few toys spilled on the tiles, a little rubber bone, chew rings.
  const toys = [[-hw - 2.6, hd * 0.6], [hw + 2.8, hd * 0.75], [-hw * 0.75, hd + 2.6], [hw * 0.7, hd + 2.9], [hw + 3.0, -hd * 0.2], [-hw - 3.0, -hd * 0.1]];
  toys.forEach(([x, z], i) => {
    if (i % 3 === 0) K.add([ballC(0.5, PASTEL[i % 6], 0, 0.5, 0, 1), torus(0.5, 0.04, WHITE, 0, 0.5, 0, 0.6)], x, 0, z);
    else if (i % 3 === 1) K.add([cyl(0.2, 0.2, 1.4, 0xff7a9c, 0, 0.25, 0, 8, 0, PI / 2), ...[-1, 1].flatMap((s) => [ballC(0.27, 0xff7a9c, s * 0.7, 0.27, 0.18, 1), ballC(0.27, 0xff7a9c, s * 0.7, 0.27, -0.18, 1)])], x, 0, z, K.R() * TAU);
    else K.add([torus(0.5, 0.15, 0x7fd6ff, 0, 0.15, 0)], x, 0, z);
    K.blob(x, 0.02, z, 0.9, 0.8, 0.3);
  });
  K.flat.push(discBatch(dots));
}

// ============================================================== UNDER THE SEA
const sandTex = (R) => canvasTex(128, (x, s) => {
  x.fillStyle = '#dcc28a'; x.fillRect(0, 0, s, s);
  speckle(x, s, R, 18);
  x.strokeStyle = 'rgba(190,160,100,.3)'; x.lineWidth = 2;
  for (let i = 0; i < 4; i++) { x.beginPath(); for (let k = 0; k <= s; k += 6) x.lineTo(k, i * s / 4 + 8 + Math.sin((k / s) * TAU * 2 + i) * 4); x.stroke(); }
});
function rockPile(K, n, s, cols) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const r = K.rnd(0.6, 1.2) * s, a = K.R() * TAU, d = i ? K.rnd(0.5, 1.1) * s : 0;
    const g = custom(new THREE.IcosahedronGeometry(r, 1).scale(1, K.rnd(0.6, 0.95), K.rnd(0.8, 1.1)).rotateY(K.R() * TAU).translate(Math.cos(a) * d, r * 0.45 + (i > 2 ? r * 0.5 : 0), Math.sin(a) * d), K.pick(cols));
    shadeY(g, 0, r * 2, 0.75, 1.08);
    out.push(jitter(g, K.R, 0.12));
  }
  return out;
}
function kelp(K, h, col) {
  const out = [];
  const n = 3 + Math.floor(K.R() * 3);
  for (let i = 0; i < n; i++) {
    const x0 = K.rnd(-0.5, 0.5), z0 = K.rnd(-0.5, 0.5), hh = h * K.rnd(0.6, 1.1), segs = 5;
    let p = [x0, 0, z0];
    for (let k = 1; k <= segs; k++) {
      const q = [x0 + Math.sin(k * 1.3 + i) * 0.35, (hh * k) / segs, z0 + Math.cos(k * 1.1 + i) * 0.2];
      out.push(rod(p, q, 0.16 * (1 - k / (segs + 2)) + 0.05, 0.16 * (1 - (k + 1) / (segs + 2)) + 0.04, col, 5));
      out.push(custom(new THREE.SphereGeometry(1, 6, 4).scale(0.32, 0.12, 0.16).rotateZ(0.6 * (k % 2 ? 1 : -1)).translate(q[0] + (k % 2 ? 0.25 : -0.25), q[1] - 0.2, q[2]), lighten(col, 0.15)));
      p = q;
    }
  }
  return shadeY(out, 0, h, 0.7, 1.15);
}
function coralTree(K, h, col) {
  const out = [];
  const grow = (a, dir, len, depth) => {
    const b = [a[0] + dir[0] * len, a[1] + dir[1] * len, a[2] + dir[2] * len];
    out.push(rod(a, b, 0.14 * (depth + 1) * 0.6, 0.12 * (depth + 1) * 0.5, col, 5));
    if (depth === 0) { out.push(ballC(0.18, lighten(col, 0.25), b[0], b[1], b[2], 0)); return; }
    for (const s of [-1, 1]) { const tw = K.rnd(0.35, 0.7) * s; grow(b, [dir[0] + Math.sin(tw), dir[1], dir[2] + Math.cos(tw) * 0.3 * s], len * 0.7, depth - 1); }
  };
  grow([0, 0, 0], [0, 1, 0], h * 0.4, 3);
  return out;
}
function brainCoral(r, col) {
  const d = dome(r, r * 0.7, r, col, 0, 0, 0, 16, 6);
  recolor(d, (x, y, z, c) => c.multiplyScalar(0.85 + 0.2 * Math.abs(Math.sin(x * 5 + Math.cos(z * 4) * 2))));
  return [d];
}
function fanCoral(K, s, col) {
  const out = [];
  for (let i = 0; i < 9; i++) { const a = -0.9 + (i * 1.8) / 8; out.push(rod([0, 0, 0], [Math.sin(a) * 1.4 * s, Math.cos(a) * 1.6 * s, 0], 0.07 * s, 0.03 * s, col, 4)); }
  for (const r of [0.6, 1.0, 1.4]) out.push(custom(new THREE.TorusGeometry(r * s, 0.04 * s, 3, 12, 1.8).rotateZ(PI / 2 - 0.9).translate(0, 0, 0), col));
  return out;
}
function bigShell(col) {
  const g = new THREE.SphereGeometry(1, 16, 6, 0, PI, 0, PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), k = 1 - 0.08 * (1 - Math.abs(Math.cos(9 * Math.atan2(x, z)))); p.setX(i, x * k); p.setZ(i, z * k); p.setY(i, p.getY(i) * 0.45); }
  g.computeVertexNormals();
  return [custom(g.rotateY(PI / 2), col)];
}
function seaChest() {
  const lid = new THREE.CylinderGeometry(0.8, 0.8, 2.4, 12, 1, false, 0, PI).rotateZ(PI / 2);
  return [rb(2.4, 1.2, 1.6, 0xb8764a, 0, 0, 0, 0.08), custom(lid.rotateX(-0.6).translate(0, 1.2, -0.3), 0xa8663a), box(0.18, 1.22, 1.62, GOLD, -0.8, 0, 0), box(0.18, 1.22, 1.62, GOLD, 0.8, 0, 0),
    ...[0, 1, 2, 3, 4, 5].map((i) => cyl(0.22, 0.22, 0.08, GOLD, -0.6 + (i % 3) * 0.6, 1.2 + Math.floor(i / 3) * 0.1, -0.2 + Math.floor(i / 3) * 0.3, 10)), ballC(0.2, 0xfff8f0, 0.3, 1.45, 0.3, 1)];
}
function aquarium(K) {
  const { hw, hd, ns } = K;
  K.shadow = 0x3a6a7a;
  const M = K.matte;
  const RX = hw + 60, BZ = -(hd + 60), SZ = hd + 60;
  K.meshes.push(texMesh(ringFloor(hw, hd, RX, BZ, SZ), sandTex(K.R), 4, 'sand'));
  const dots = [];
  for (let i = 0; i < 160; i++) { const [x, z] = K.around(1.6, 26, 14); dots.push([x, 0.02, z, K.rnd(0.08, 0.2), K.pick([0xff9ec0, 0x8fd0ff, 0xffe27a, 0x9fe6b8, 0xc9b2ff, 0xd8c08a]), 6]); }
  for (let i = 0; i < 30; i++) { const [x, z] = K.around(3, 30, 16); dots.push([x, 0.012, z, K.rnd(1.5, 4), K.pick([0xdcc48e, 0xf2e0b0]), 16, 1, K.rnd(0.5, 0.9), K.R() * PI]); }
  const ROCK = [0x9fa6c8, 0x8f96bc, 0xb2b0d4, 0x8aa8c0];
  const CORAL = [0xff7a8a, 0xff9a3a, 0xb48cff, 0xffd23a, 0x5fd1c8, 0xff5ca8];
  const KELP = [0x4fbf6a, 0x3fae7a, 0x6fcf5a];
  const sway = [];
  const placeRock = (x, z, n, s) => { if (!K.free(x, z, s * 1.4)) return; K.claim(x, z, s * 1.4); M.push(...put(rockPile(K, n, s, ROCK), x, 0, z)); K.blob(x, 0.02, z, s * 1.8, s * 1.6, 0.35); };
  // Far: a big rock arch, rock piles, kelp forest, fan corals, a treasure chest.
  const ax = -hw * 0.35, az = -(hd + 8);
  K.claim(ax, az, 6);
  for (const s of [-1, 1]) M.push(...put(rockPile(K, 5, 1.5, ROCK), ax + s * 3.6, 0, az));
  const arch = custom(new THREE.TorusGeometry(3.6, 1.0, 6, 14, PI), 0x9fa6c8);
  shadeY(arch, 0, 4.6, 0.8, 1.05);
  M.push(...put([jitter(arch, K.R, 0.1)], ax, 0, az));
  K.blob(ax, 0.02, az, 5.5, 2.2, 0.35);
  K.add(seaChest(), hw * 0.45, 0, -(hd + 5.5), -0.3);
  K.claim(hw * 0.45, -(hd + 5.5), 2.5); K.blob(hw * 0.45, 0.02, -(hd + 5.5), 2.0, 1.4, 0.4, -0.3);
  K.halos.push([hw * 0.45, 1.6, -(hd + 4.4), 1.6, 1.0, 0.4, 0xffe08a, true]);
  for (let i = 0; i < 26; i++) {
    const far = i < 16, [x, z] = far ? [K.rnd(-(hw + 14), hw + 14), -(hd + K.rnd(3, 14))] : [(K.R() < 0.5 ? -1 : 1) * (hw + K.rnd(2.5, 12)), K.rnd(-hd, hd * 0.3)];
    if (!K.free(x, z, 1.2)) continue;
    K.claim(x, z, 1.2);
    const k = i % 4;
    if (k === 0) sway.push(...put(kelp(K, far ? K.rnd(5, 8) : K.rnd(3, 5), K.pick(KELP)), x, 0, z));
    else if (k === 1) K.add(coralTree(K, K.rnd(2.2, 3.6), K.pick(CORAL)), x, 0, z, K.R() * TAU);
    else if (k === 2) K.add(fanCoral(K, K.rnd(1.0, 1.6), K.pick(CORAL)), x, 0, z, K.rnd(-0.4, 0.4));
    else K.add(brainCoral(K.rnd(0.9, 1.5), K.pick(CORAL)), x, 0, z);
    K.blob(x, 0.02, z, 1.4, 1.2, 0.3);
  }
  for (let i = 0; i < 10; i++) { const [x, z] = K.around(3, 22, 0); if (z < hd * 0.4) placeRock(x, z, 3 + (i % 3), K.rnd(0.8, 1.6)); }
  // Near side (low): shells, sea stars and pebbles on the sand.
  const SH = [0xffc0d6, 0xffd98a, 0xfff4e8, 0xc8b4ff];
  for (let i = 0; i < 7; i++) {
    const x = K.rnd(-(hw + 6), hw + 6), z = hd + K.rnd(2.2, 9);
    if (Math.abs(x) < hw + 1.6 && z < hd + 2.2) continue;
    if (i % 2) K.add(bigShell(K.pick(SH)), x, 0, z, K.R() * TAU, K.rnd(0.6, 0.9));
    else K.add([custom(new THREE.ExtrudeGeometry(starShape(0.7, 0.45), { depth: 0.18, bevelEnabled: false }).rotateX(-PI / 2), K.pick(CORAL))], x, 0, z, K.R() * TAU);
    K.blob(x, 0.02, z, 0.8, 0.8, 0.25);
  }
  for (const s of [-1, 1]) { sway.push(...put(kelp(K, 3.2, KELP[0]), s * (hw + 3.2), 0, hd * 0.75)); K.blob(s * (hw + 3.2), 0.02, hd * 0.75, 1.2, 1.2, 0.3); }
  // Swaying kelp: one mesh, tips bend in the vertex shader.
  if (sway.length) {
    const uTime = { value: 0 };
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = uTime;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nfloat sw = transformed.y * 0.06;\ntransformed.x += sin(uTime * 1.1 + position.x * 0.3 + position.z * 0.2) * sw;\ntransformed.z += cos(uTime * 0.9 + position.x * 0.2) * sw * 0.5;');
    };
    mat.customProgramCacheKey = () => 'wave5-kelp';
    const m = new THREE.Mesh(merge(sway), mat); m.name = 'kelp'; m.frustumCulled = false;
    K.meshes.push(m); K.tick.push((t) => { uTime.value = t; });
  }
  // Rising bubbles: one mesh, each bubble loops upward in the vertex shader.
  const bub = [];
  for (let i = 0; i < 70; i++) {
    const [x, z] = i < 50 ? [K.rnd(-(hw + 16), hw + 16), -(hd + K.rnd(2, 16))] : [(K.R() < 0.5 ? -1 : 1) * (hw + K.rnd(2.5, 10)), K.rnd(-hd, hd * 0.2)];
    const r = K.rnd(0.12, 0.32), ph = K.R() * 12;
    const g = new THREE.IcosahedronGeometry(r, 1).translate(x, 0, z);
    g.setAttribute('ph', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count).fill(ph), 1));
    bub.push(custom(g, i % 3 ? 0xeafaff : 0xd8f4ff));
  }
  const bT = { value: 0 };
  const bm = new THREE.MeshPhongMaterial({ vertexColors: true, transparent: true, opacity: 0.6, shininess: 120, specular: 0xffffff, emissive: 0x2a5a7a });
  bm.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = bT;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float ph;\nuniform float uTime;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nfloat yy = mod(uTime * 0.9 + ph, 12.0);\ntransformed.y += yy + 0.2;\ntransformed.x += sin(uTime * 2.0 + ph * 3.0) * 0.25;');
  };
  bm.customProgramCacheKey = () => 'wave5-bubbles';
  const bmesh = new THREE.Mesh(merge(bub), bm); bmesh.name = 'bubbles'; bmesh.frustumCulled = false;
  K.meshes.push(bmesh); K.tick.push((t) => { bT.value = t; });
  // Sun rays slanting down from the surface on the far side.
  for (let i = 0; i < 6; i++) K.halos.push([-hw - 8 + i * (2 * hw + 16) / 5, 7, -(hd + 10 + (i % 2) * 4), 2.2, 7, 0.16, 0xdff6ff, true]);
  for (let i = 0; i < 8; i++) { const [x, z] = K.around(2, 20, 6); K.halos.push([x, 0.04, z, K.rnd(2, 4), K.rnd(1.5, 3), 0.12, 0xe8fbff, false]); }
  K.flat.push(discBatch(dots));
}

// ============================================================== MUSIC ROOM
const planksTex = (R) => canvasTex(256, (x, s) => {
  const n = 4, pw = s / n;
  for (let i = 0; i < n; i++) {
    const cut = R() * s;
    for (const [y0, y1] of [[cut - s, cut], [cut, cut + s]]) {
      x.fillStyle = `hsl(${24 + (R() - 0.5) * 4},40%,${52 + (R() - 0.5) * 7}%)`;
      for (const oy of [-s, 0, s]) x.fillRect(i * pw, y0 + oy, pw, y1 - y0);
      for (const oy of [-s, 0, s]) { x.fillStyle = 'rgba(70,40,20,0.35)'; x.fillRect(i * pw, y1 + oy - 1, pw, 2); }
    }
    x.fillStyle = 'rgba(60,35,15,0.45)'; x.fillRect(i * pw, 0, 2, s);
  }
  speckle(x, s, R, 8);
});
const stripeTex = (R) => canvasTex(128, (x, s) => {
  x.fillStyle = '#ffe2ea'; x.fillRect(0, 0, s, s);
  x.fillStyle = '#ffd0dc'; for (let i = 0; i < 4; i++) x.fillRect(i * 32, 0, 14, s);
  speckle(x, s, R, 3);
});
function drumKit() {
  const s = [];
  const drum = (r, h, x, y, z, rx, col) => s.push(...put([cyl(r, r, h, col, 0, -h / 2, 0, 18), torus(r + 0.02, 0.05, CHROME, 0, h / 2, 0), torus(r + 0.02, 0.05, CHROME, 0, -h / 2, 0), cyl(r - 0.02, r - 0.02, 0.02, WHITE, 0, h / 2, 0, 18)], x, y, z, 0, 1, rx));
  drum(1.3, 1.0, 0, 1.3, 0, PI / 2, 0xff5a7a);
  s.push(...put([vdisc(0.7, WHITE, 0, 0, 0, 20)], 0, 1.3, 0.52));
  drum(0.6, 0.55, -0.9, 2.9, -0.2, 0.4, 0xff5a7a); drum(0.6, 0.55, 0.9, 2.9, -0.2, 0.4, 0xff5a7a);
  drum(0.75, 0.6, 2.1, 1.4, 0.6, 0, 0xff5a7a);
  for (const [x, z, h] of [[-2.4, 0.2, 3.6], [2.6, -0.8, 3.9]]) s.push(cyl(0.06, 0.06, h, CHROME, x, 0, z, 6), cyl(1.0, 0.1, 0.12, GOLD, x, h, z, 18));
  s.push(cyl(0.06, 0.06, 2.4, CHROME, 3.1, 0, 0.8, 6), cyl(0.6, 0.1, 0.1, GOLD, 3.1, 2.4, 0.8, 16), cyl(0.6, 0.1, 0.1, GOLD, 3.1, 2.55, 0.8, 16));
  return s;
}
function harp() {
  const s = [];
  const pts = [[0, 0], [0.4, 0.3], [1.0, 2.0], [1.4, 3.6], [1.2, 4.4], [0.6, 4.6], [0.1, 4.3]];
  for (let i = 1; i < pts.length; i++) s.push(rod([pts[i - 1][0], pts[i - 1][1], 0], [pts[i][0], pts[i][1], 0], 0.18, 0.16, GOLD, 6));
  s.push(rod([0, 0, 0], [0.1, 4.3, 0], 0.22, 0.16, GOLD, 6), lathe([[0, 0], [0.6, 0], [0.7, 0.2], [0.5, 0.35], [0, 0.35]], GOLD, 12));
  for (let i = 1; i < 10; i++) { const t = i / 10, y0 = 0.3 + t * 3.6, x1 = 0.1 + t * 1.2; s.push(rod([0.1, y0, 0], [x1, Math.min(4.4, y0 + 0.9 + t * 0.4), 0], 0.015, 0.015, WHITE, 3)); }
  return s;
}
function cello(col) {
  const body = [egg(0.85, 1.1, 0.35, col, 0, 1.3, 0, 14, 8), egg(0.68, 0.8, 0.33, col, 0, 2.6, 0, 14, 8)];
  return [...body, box(0.2, 2.2, 0.15, 0x3a2a24, 0, 2.6, 0.3), box(0.25, 0.4, 0.2, col, 0, 4.7, 0), ballC(0.15, col, 0, 5.2, 0.05, 1),
    vdisc(0.1, 0x3a2a24, -0.3, 1.9, 0.36, 8), vdisc(0.1, 0x3a2a24, 0.3, 1.9, 0.36, 8), cyl(0.04, 0.04, 0.5, CHROME, 0, -0.1, 0, 5)];
}
function speaker(col) {
  return [rb(1.8, 3.0, 1.4, col, 0, 0, 0, 0.12), ...[[0, 0.9, 0.55], [0, 2.2, 0.35]].flatMap(([x, y, r]) => [vdisc(r + 0.08, 0x8a7a9a, x, y, 0.71, 20), vdisc(r, 0x3a3046, x, y, 0.72, 20), vdisc(r * 0.35, 0x5a5068, x, y, 0.73, 12)])];
}
function musicStand() {
  return [cyl(0.05, 0.05, 2.6, INK, 0, 0, 0, 6), ...[0, 1, 2].map((i) => custom(new THREE.CylinderGeometry(0.03, 0.03, 1.0, 4).rotateZ(1.0).rotateY(i * TAU / 3).translate(0, 0.25, 0), INK)),
    ...put([box(1.4, 1.0, 0.05, INK, 0, 0, 0), box(1.1, 0.8, 0.02, WHITE, 0, 0.12, 0.04)], 0, 2.4, 0, 0, 1, -0.35)];
}
function music(K) {
  const { hw, hd, ns } = K;
  K.shadow = 0x5a3a2a;
  const G = K.glossy, M = K.matte;
  const BZ = -(hd + 11), RX = hw + 15, SZ = hd + 24;
  K.meshes.push(texMesh(ringFloor(hw, hd, RX, BZ, SZ), planksTex(K.R), 6, 'stage'));
  // Back wall: striped wallpaper, wainscot, framed notes, a round window, string lights.
  const wp = custom(new THREE.PlaneGeometry(2 * RX, 22).translate(0, 11, BZ), 0xffffff);
  K.meshes.push(texMesh([wp], stripeTex(K.R), 4, 'wallpaper'));
  for (const s of [-1, 1]) M.push(...shadeY([boxS(1, 22, SZ - BZ, 0xffe2ea, s * (RX + 0.5), 0, (SZ + BZ) / 2, 1, 6, 1)], 0, 22, 0.78, 0.98));
  M.push(box(2 * RX, 4.0, 0.3, 0xc98a5a, 0, 0, BZ + 0.15));
  for (const s of [-1, 1]) M.push(box(0.3, 4.0, SZ - BZ, 0xc98a5a, s * (RX - 0.15), 0, (SZ + BZ) / 2));
  G.push(box(2 * RX, 0.35, 0.45, WHITE, 0, 4.0, BZ + 0.2));
  const NOTE = [0xff7a9c, 0xffd23a, 0x5cc8ff, 0xa070ff];
  for (let i = 0; i < 4; i++) {
    const x = -hw * 0.8 + i * (hw * 1.6) / 3, y = 9 + (i % 2) * 1.6;
    G.push(...put([box(3.0, 3.0, 0.2, GOLD, 0, -1.5, 0), box(2.6, 2.6, 0.05, WHITE, 0, -1.3, 0.11)], x, y + 1.5, BZ + 0.1));
    G.push(...noteShape(1.1).map((sh) => shapeZ(sh, NOTE[i], x - 0.35, y - 0.4, BZ + 0.26)));
  }
  // String lights across the wall.
  const LB = [0xfff1c4, 0xffd6e0, 0xfff8e6, 0xd8f0ff];
  for (let i = 0; i < 24; i++) {
    const t = i / 23, x = -RX + 2 + t * (2 * RX - 4), y = 14 - Math.sin(t * PI * 3) ** 2 * 1.4;
    K.lit.push(ballC(0.2, LB[i % 4], x, y, BZ + 0.5, 0));
    K.halos.push([x, y, BZ + 0.7, 0.7, 0.7, 0.4, 0xffc67a, true]);
  }
  // Far corners: the drum kit, the harp; a cello and a tall speaker on each side.
  const dx = -(hw * 0.45 + 2), dz = -(hd + 6);
  K.add(drumKit(), dx, 0, dz, 0.2); K.blob(dx, 0.02, dz, 3.6, 2.2, 0.4, 0.2); K.claim(dx, dz, 4);
  const hx = hw * 0.5 + 2, hz = -(hd + 6.2);
  K.add(harp(), hx, 0, hz, -0.3); K.blob(hx + 0.5, 0.02, hz, 1.6, 1.2, 0.4);
  K.add(cello(0xc8743a), hx + 3.5, 0, hz + 1.2, -0.25, 1, -0.12); K.blob(hx + 3.5, 0.02, hz + 1.2, 1.2, 0.8, 0.4);
  for (const s of [-1, 1]) {
    K.add(speaker(0x6a5a86), s * (hw + 6), 0, -(hd + 2), -s * 0.4); K.blob(s * (hw + 6), 0.02, -(hd + 2), 1.4, 1.2, 0.4);
    K.add(musicStand(), s * (hw + 4.5), 0, -hd * 0.25, s * 1.2); K.blob(s * (hw + 4.5), 0.02, -hd * 0.25, 0.9, 0.9, 0.3);
  }
  // A record shelf down the left side, a big gramophone down the right.
  const rx = -(hw + 7);
  K.add([boxS(2.0, 3.6, 7.0, 0xb8865a, 0, 0, 0), ...[0, 1, 2].flatMap((l) => Array.from({ length: 12 }, (_, i) => box(0.9, 1.0, 0.08, K.pick([0xff7a9c, 0x5cc8ff, 0xffd23a, 0x7be07a, 0xa070ff, 0x3a3046]), 1.0, 0.25 + l * 1.15, -3.0 + i * 0.5)))], rx, 0, hd * 0.0);
  K.blob(rx, 0.02, 0, 1.6, 3.8, 0.4);
  const gx = hw + 6.5, gz = hd * 0.15;
  const horn = custom(new THREE.LatheGeometry([[0.2, 0], [0.3, 1.0], [0.6, 2.0], [1.4, 2.8], [2.0, 3.1]].map(([r, h]) => new THREE.Vector2(r, h)), 18).rotateX(1.0).translate(0, 2.4, 0), 0xffc94a);
  K.add([rb(2.4, 1.6, 2.4, 0x9e6a3e, 0, 0, 0, 0.1), cyl(1.0, 1.0, 0.08, 0x3a3046, 0, 1.6, 0, 20), cyl(0.3, 0.3, 0.1, 0xff7a9c, 0, 1.62, 0, 12), ...twoSided([horn])], gx, 0, gz, -PI / 2 - 0.3);
  K.blob(gx, 0.02, gz, 1.8, 1.8, 0.4);
  // Near side (low): a round rug, sheet music sheets, a tambourine and picks on the floor.
  const rz = hd + 5.5 * ns;
  K.flat.push(disc(4.2, 0xa070ff, 0, 0.01, rz, 32, 1.3, 0.55), disc(3.7, 0xc9b2ff, 0, 0.015, rz, 32, 1.3, 0.55), disc(3.1, 0xa070ff, 0, 0.02, rz, 32, 1.3, 0.55));
  const papers = [[-hw - 2.4, hd * 0.55, 0.3], [hw + 2.6, hd * 0.4, -0.4], [-hw * 0.7, hd + 2.4, 0.6], [hw * 0.75, hd + 2.6, -0.2]];
  for (const [x, z, r] of papers) {
    K.flat.push(...put([rectXZ(-0.6, 0.6, -0.8, 0.8, 0.03, WHITE)], x, 0, z, r));
    for (let k = 0; k < 4; k++) K.flat.push(...put([rectXZ(-0.45, 0.45, -0.5 + k * 0.3, -0.48 + k * 0.3, 0.035, 0x6a5a86)], x, 0, z, r));
  }
  K.add([cyl(0.7, 0.7, 0.2, 0xff7a9c, 0, 0, 0, 18), cyl(0.66, 0.66, 0.02, 0xfff0d4, 0, 0.2, 0, 18)], -hw - 3.2, 0, hd * 0.85);
  K.blob(-hw - 3.2, 0.02, hd * 0.85, 0.9, 0.9, 0.3);
  for (let i = 0; i < 5; i++) { const x = hw + 2.2 + (i % 3) * 0.9, z = hd * 0.8 + i * 0.7; K.add([custom(new THREE.ExtrudeGeometry(starShape(0.3, 0.9, 3), { depth: 0.04, bevelEnabled: false }).rotateX(-PI / 2), PASTEL[i])], x, 0, z, K.R() * TAU); }
  // Floating notes drifting over the far wall (one mesh, bob in the vertex shader).
  const notes = [];
  for (let i = 0; i < 10; i++) {
    const x = K.rnd(-(hw + 8), hw + 8), y = K.rnd(6, 12), z = -(hd + K.rnd(4, 9)), c = K.pick(NOTE);
    for (const sh of noteShape(0.8)) { const g = new THREE.ExtrudeGeometry(sh, { depth: 0.12, bevelEnabled: false }).translate(x, y, z); notes.push(custom(g, c)); }
  }
  const nT = { value: 0 };
  const nm = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 40, emissive: 0x2a2020 });
  nm.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = nT;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed.y += sin(uTime * 1.3 + position.x * 0.5) * 0.4;');
  };
  nm.customProgramCacheKey = () => 'wave5-notes';
  const nmesh = new THREE.Mesh(merge(notes), nm); nmesh.name = 'notes'; nmesh.frustumCulled = false;
  K.meshes.push(nmesh); K.tick.push((t) => { nT.value = t; });
}

export const BACKDROPS = { pets, aquarium, music };
