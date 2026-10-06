// Season 6 worlds: Bubble Spa, Pumpkin Patch, Holiday Morning.
//   WORLDS    floor/sky defs (same shape as levelbuild.js WORLDS)
//   BACKDROPS scenery builders taking the kit K from backdrops.js (K.add, K.blob, K.around...)
//   MUSIC     world -> track key (existing tracks only)
// Same contract as backdrops.js: decorative only, nothing 3D inside |x| < w/2+1.2 and
// |z| < d/2+1.2, the near (+z) side stays low, a handful of merged meshes, no lights,
// code-built geometry and procedural canvas textures only. Private helpers are copied from
// backdrops.js / levelbuild.js so this file stands alone.
import * as THREE from 'three';
import { box, rbox, cyl, cone, ball, custom, merge } from './geo.js';
import { patchGround } from '../engine/render.js';

const TAU = Math.PI * 2, PI = Math.PI;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const _c = new THREE.Color(), _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
const _p = new THREE.Vector3(), _s = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);

// ============================================================== floor helpers (levelbuild.js)
function noise(x, w, h, a) {
  const img = x.getImageData(0, 0, w, h), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * a; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  x.putImageData(img, 0, 0);
}
function rrect(x, l, t, w, h, r) {
  x.beginPath(); x.moveTo(l + r, t); x.arcTo(l + w, t, l + w, t + h, r); x.arcTo(l + w, t + h, l, t + h, r);
  x.arcTo(l, t + h, l, t, r); x.arcTo(l, t, l + w, t, r); x.closePath(); x.fill();
}

// ============================================================== WORLDS
export const WORLDS = {
  spa: {
    // A soft aqua bath mat with little white rounded tiles: pastel soaps and pearls pop on it.
    label: 'Bubble Spa', sky: 0xe6f6f8, hemiSky: 0xf6feff, hemiGround: 0xcfe6e6, surround: 0xe9f1ef, wall: 0xfdfcfb, accent: '#3fbcc8',
    tile: 3, floor: (x, w, h) => {
      x.fillStyle = '#9edcd8'; x.fillRect(0, 0, w, h);
      const n = 4, s = w / n;
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        x.fillStyle = ['#b6e7e3', '#addfdc', '#bde9e5', '#a7dcd9'][(i + j * 3) % 4];
        rrect(x, i * s + 4, j * s + 4, s - 8, s - 8, 14);
      }
      noise(x, w, h, 5);
      x.fillStyle = 'rgba(255,255,255,.55)';
      for (let i = 0; i < 18; i++) { x.beginPath(); x.arc(Math.random() * w, Math.random() * h, 1.5 + Math.random() * 2.5, 0, TAU); x.fill(); }
    },
  },
  pumpkin: {
    // Raked soil rows with straw: orange pumpkins and red leaves pop on the brown.
    label: 'Pumpkin Patch', sky: 0xffe6c4, hemiSky: 0xfff6e6, hemiGround: 0xc9b07c, surround: 0xb7bf5e, wall: 0xb07a4a, accent: '#ff8a1f',
    tile: 4, floor: (x, w, h) => {
      for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#a77b52' : '#b38858'; x.fillRect(0, i * h / 8, w, h / 8); }
      noise(x, w, h, 14);
      for (let i = 0; i < 420; i++) {
        x.strokeStyle = `rgba(${235 + Math.random() * 20},${200 + Math.random() * 30},${100 + Math.random() * 40},.55)`; x.lineWidth = 1.2;
        const px = Math.random() * w, py = Math.random() * h, a = Math.random() * PI;
        x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * 6, py + Math.sin(a) * 6); x.stroke();
      }
    },
  },
  holiday: {
    // A soft cream-and-sage plaid rug on the living-room floor: red and gold toys pop on it.
    label: 'Holiday Morning', sky: 0xfff0e2, hemiSky: 0xfff8f0, hemiGround: 0xd8c0a8, surround: 0xb27a4e, wall: 0xc8303c, accent: '#e8333f',
    tile: 4, floor: (x, w, h) => {
      x.fillStyle = '#f3ead8'; x.fillRect(0, 0, w, h);
      x.fillStyle = 'rgba(126,168,132,.32)';
      for (let i = 0; i < 4; i++) { x.fillRect(i * w / 4 + w / 16, 0, w / 8, h); x.fillRect(0, i * h / 4 + h / 16, w, h / 8); }
      x.fillStyle = 'rgba(214,92,92,.35)';
      for (let i = 0; i < 4; i++) { x.fillRect(i * w / 4 + w / 8 - 1.5, 0, 3, h); x.fillRect(0, i * h / 4 + h / 8 - 1.5, w, 3); }
      noise(x, w, h, 7);
    },
  },
};

export const MUSIC = { spa: 'holy_sanctuary', pumpkin: 'long_journey', holiday: 'peaceful_village' };

// ============================================================== scenery helpers (backdrops.js)
const ballC = (r, col, x = 0, y = 0, z = 0, det = 1, sy = 1) => ball(r, col, x, y - r * sy, z, det, sy);
const egg = (a, b, c, col, x = 0, y = 0, z = 0, ws = 12, hs = 8) =>
  custom(new THREE.SphereGeometry(1, ws, hs).scale(a, b, c).translate(x, y, z), col);
const dome = (a, b, c, col, x = 0, y = 0, z = 0, ws = 18, hs = 6) =>
  custom(new THREE.SphereGeometry(1, ws, hs, 0, TAU, 0, PI / 2).scale(a, b, c).translate(x, y, z), col);
const boxS = (w, h, d, col, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) =>
  custom(new THREE.BoxGeometry(w, h, d, sx, sy, sz).translate(x, y + h / 2, z), col);
const lathe = (pts, col, seg = 14, x = 0, y = 0, z = 0) =>
  custom(new THREE.LatheGeometry(pts.map(([r, h]) => new THREE.Vector2(r, h)), seg).translate(x, y, z), col);
const rectXZ = (x0, x1, z0, z1, y, col, sx = 1, sz = 1) =>
  custom(new THREE.PlaneGeometry(x1 - x0, z1 - z0, sx, sz).rotateX(-PI / 2).translate((x0 + x1) / 2, y, (z0 + z1) / 2), col);
function disc(r, col, x = 0, y = 0, z = 0, seg = 16, sx = 1, sz = 1, ry = 0) {
  const g = new THREE.CircleGeometry(r, seg).rotateX(-PI / 2).scale(sx, 1, sz); if (ry) g.rotateY(ry);
  return custom(g.translate(x, y, z), col);
}
function panel(w, h, col, x = 0, y = 0, z = 0, ry = 0) {
  const g = new THREE.PlaneGeometry(w, h).translate(0, h / 2, 0); if (ry) g.rotateY(ry);
  return custom(g.translate(x, y, z), col);
}
const vdisc = (r, col, x = 0, y = 0, z = 0, seg = 20) => custom(new THREE.CircleGeometry(r, seg).translate(x, y, z), col);
function rod(a, b, r0, r1, col, seg = 6) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const len = A.distanceTo(B) || 0.001;
  const g = new THREE.CylinderGeometry(r1, r0, len, seg).translate(0, len / 2, 0);
  g.applyQuaternion(_q.setFromUnitVectors(_up, B.clone().sub(A).normalize())).translate(A.x, A.y, A.z);
  return custom(g, col);
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
const planksTex = (R, hue, sat, light, n = 4) => canvasTex(256, (x, s) => {
  const pw = s / n;
  for (let i = 0; i < n; i++) {
    const cut = R() * s;
    for (const [y0, y1] of [[cut - s, cut], [cut, cut + s]]) {
      const l = light + (R() - 0.5) * 7;
      x.fillStyle = `hsl(${hue + (R() - 0.5) * 4},${sat}%,${l}%)`;
      for (const oy of [-s, 0, s]) x.fillRect(i * pw, y0 + oy, pw, y1 - y0);
      for (const oy of [-s, 0, s]) { x.fillStyle = 'rgba(70,40,20,0.35)'; x.fillRect(i * pw, y1 + oy - 1, pw, 2); }
    }
    x.fillStyle = 'rgba(60,35,15,0.45)'; x.fillRect(i * pw, 0, 2, s);
  }
  speckle(x, s, R, 8);
});
// Square tiles with grout (spa floor and walls).
const tilesTex = (R, a, b, grout) => canvasTex(128, (x, s) => {
  x.fillStyle = grout; x.fillRect(0, 0, s, s);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    x.fillStyle = (i + j) % 3 ? a : b; x.fillRect(i * s / 4 + 1.5, j * s / 4 + 1.5, s / 4 - 3, s / 4 - 3);
    const g = x.createLinearGradient(i * s / 4, j * s / 4, i * s / 4 + s / 4, j * s / 4 + s / 4);
    g.addColorStop(0, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(i * s / 4 + 1.5, j * s / 4 + 1.5, s / 4 - 3, s / 4 - 3);
  }
  speckle(x, s, R, 4);
});
function texMesh(parts, tex, tile, { patched = false, name = 'tex' } = {}) {
  const list = [parts].flat(Infinity);
  for (const g of list) worldUV(g, tile);
  let mat = new THREE.MeshLambertMaterial({ map: tex, vertexColors: true });
  if (patched) mat = patchGround(mat);
  const m = new THREE.Mesh(merge(list), mat);
  m.name = name; m.receiveShadow = true;
  return m;
}
// Floor around the board: four bands from under the rail outwards (never under the board).
function floorRing(hw, hd, out, y = 0) {
  const X0 = hw + 0.5, Z0 = hd + 0.5;
  return [
    rectXZ(-hw - out, hw + out, Z0, hd + out, y, 0xffffff, 6, 3), rectXZ(-hw - out, hw + out, -hd - out, -Z0, y, 0xffffff, 6, 3),
    rectXZ(X0, hw + out, -Z0, Z0, y, 0xffffff, 3, 6), rectXZ(-hw - out, -X0, -Z0, Z0, y, 0xffffff, 3, 6),
  ];
}
const lighten = (hex, t) => new THREE.Color(hex).lerp(new THREE.Color(0xffffff), t).getHex();
const WHITE = 0xfffaf4, GOLD = 0xffc95a, INK = 0x4a3a4a;

// ============================================================== shared bits
function pottedPalm(K, h = 3.2, pot = 0xf2e6d8) {
  const s = [lathe([[0, 0], [0.7, 0], [0.85, 1.0], [0.95, 1.1], [0.95, 1.25], [0, 1.25]], pot, 14)];
  s.push(disc(0.85, 0x7a5a3a, 0, 1.2, 0, 12));
  for (let i = 0; i < 3; i++) s.push(rod([0, 1.2, 0], [K.rnd(-0.3, 0.3), 1.2 + h * 0.5, K.rnd(-0.3, 0.3)], 0.08, 0.06, 0x8a6a3a));
  for (let i = 0; i < 9; i++) {
    const a = i * TAU / 9 + K.R() * 0.3, L = K.rnd(1.4, 2.2);
    const g = new THREE.SphereGeometry(1, 8, 4).scale(L, 0.08, 0.35).translate(L * 0.9, 0, 0).rotateZ(-0.35 - K.R() * 0.3).rotateY(a).translate(0, 1.2 + h * 0.5, 0);
    s.push(custom(g, i % 2 ? 0x4fb060 : 0x3e9a52));
  }
  return s;
}
function hangingLights(K, x0, x1, y, z, sag, n, cols) {
  for (let k = 0; k < n; k++) {
    const t = (k + 0.5) / n, x = x0 + (x1 - x0) * t, yy = y - Math.sin(t * PI) * sag;
    K.lit.push(ballC(0.16, cols[k % cols.length], x, yy, z, 0));
    K.halos.push([x, yy, z + 0.2, 0.6, 0.6, 0.38, cols[k % cols.length], true]);
  }
  const pts = [];
  for (let i = 0; i <= 16; i++) { const t = i / 16; pts.push([x0 + (x1 - x0) * t, y + 0.12 - Math.sin(t * PI) * sag, z]); }
  for (let i = 1; i < pts.length; i++) K.glossy.push(rod(pts[i - 1], pts[i], 0.03, 0.03, 0x4a5a3a, 4));
}
// Rising/bobbing things: one mesh that moves gently (bubbles, snow, leaves).
function bobMesh(K, parts, name, mat, fn) {
  if (!parts.length) return;
  const m = new THREE.Mesh(merge(parts), mat);
  m.name = name; m.frustumCulled = false;
  K.meshes.push(m);
  K.tick.push((t) => fn(m, t));
}

// ============================================================== BUBBLE SPA
function spa(K) {
  const { hw, hd, ns } = K;
  K.shadow = 0x4a7a7a;
  const G = K.glossy, M = K.matte;
  const BZ = -(hd + 12), RX = hw + 16, TOP = 16;
  // Tiled spa floor round the mat; a pebble border just outside the rail.
  K.meshes.push(texMesh(floorRing(hw, hd, 40), tilesTex(K.R, '#f6fbfa', '#e3f2ef', '#c9dcd8'), 2.2, { patched: true, name: 'spafloor' }));
  const peb = [];
  for (let i = 0; i < 160; i++) {
    const side = i % 4, t = K.rnd(-1, 1);
    const x = side < 2 ? t * (hw + 1.6) : (side === 2 ? -1 : 1) * (hw + 1.6 + K.rnd(0, 0.4));
    const z = side < 2 ? (side === 0 ? -1 : 1) * (hd + 1.6 + K.rnd(0, 0.4)) : t * (hd + 1.6);
    peb.push(egg(K.rnd(0.12, 0.2), 0.08, K.rnd(0.1, 0.17), K.pick([0xe8e2da, 0xd6d0c8, 0xf4f0ea, 0xcfd8d4]), x, 0.03, z, 9, 5));
  }
  M.push(...peb);

  // Back wall: soft tiles, a wide arched window with a garden view, shelves of towels.
  const wallG = boxS(2 * RX, TOP, 1, 0xffffff, 0, 0, BZ - 0.5, 1, 6, 1);
  K.meshes.push(texMesh([wallG], tilesTex(K.R, '#e6f5f3', '#d4eeea', '#bcd9d4'), 2.0, { name: 'spawall' }));
  for (const s of [-1, 1]) K.meshes.push(texMesh([boxS(1, TOP, 60, 0xe8f0ee, s * (RX + 0.5), 0, BZ + 29.5, 1, 6, 6)], tilesTex(K.R, '#e6f5f3', '#d4eeea', '#bcd9d4'), 2.0, { name: 'spaside' }));
  G.push(box(2 * RX, 0.5, 0.6, 0xffffff, 0, 0, BZ + 0.2), box(2 * RX, 0.4, 0.5, 0xd8b37a, 0, 5.5, BZ + 0.15));
  const ww = Math.min(12, hw * 1.1), wy = 3.2, wh = 7.5;
  const view = panel(ww, wh, 0xbfe8f8, 0, wy, BZ + 0.05);
  recolor(view, (x, y, z, c) => c.lerp(new THREE.Color(0xf2fbff), clamp01((wy + wh - y) / wh) * 0.7));
  G.push(view);
  for (let i = 0; i < 7; i++) G.push(egg(K.rnd(1.2, 2.2), K.rnd(1.0, 1.6), 0.2, K.pick([0x7ccf7a, 0x5fbf6a, 0x8fd88a]), -ww / 2 + (i + 0.5) * ww / 7, wy + K.rnd(0.6, 1.6), BZ + 0.12, 10, 6));
  const arch = new THREE.TorusGeometry(ww / 2, 0.3, 6, 24, PI).translate(0, wy + wh, BZ + 0.3);
  G.push(custom(arch, WHITE), box(0.6, wh, 0.6, WHITE, -ww / 2, wy, BZ + 0.3), box(0.6, wh, 0.6, WHITE, ww / 2, wy, BZ + 0.3), box(ww + 1.2, 0.4, 0.9, WHITE, 0, wy - 0.4, BZ + 0.4));
  G.push(custom(new THREE.CircleGeometry(ww / 2, 20, 0, PI).translate(0, wy + wh, BZ + 0.05), 0xd8f2ff));
  G.push(box(0.2, wh + ww / 2, 0.25, WHITE, 0, wy, BZ + 0.35), box(ww, 0.2, 0.25, WHITE, 0, wy + wh * 0.55, BZ + 0.35));
  K.glass.push(panel(ww, wh, 0xffffff, 0, wy, BZ + 0.4));
  for (const s of [-1, 1]) {
    const sx = s * (ww / 2 + 4.2);
    for (const y of [2.2, 4.6]) {
      G.push(box(4.6, 0.25, 1.4, 0xd8b37a, sx, y, BZ + 0.8));
      for (let i = 0; i < 3; i++) {
        const c = K.pick([0xff9ec0, 0x9fd8f0, 0xfff0b0, 0xc8f0d8, 0xffffff]);
        G.push(...put([rbox(1.1, 0.35, 1.0, c, 0, 0, 0, 0.12), rbox(1.05, 0.35, 1.0, lighten(c, 0.3), 0, 0.36, 0, 0.12)], sx - 1.4 + i * 1.4, y + 0.25, BZ + 0.85));
      }
    }
    // candles on the sill with soft glow
    for (let i = 0; i < 3; i++) {
      const x = s * (ww / 2 - 1.0 - i * 1.0), h = 0.5 + i * 0.25;
      G.push(cyl(0.22, 0.22, h, 0xfff4e0, x, wy, BZ + 0.6));
      K.lit.push(egg(0.08, 0.16, 0.08, 0xffc04a, x, wy + h + 0.15, BZ + 0.6, 6, 4));
      K.halos.push([x, wy + h + 0.2, BZ + 0.9, 0.8, 0.8, 0.45, 0xffc46b, true]);
    }
  }
  // A round mirror and two hanging ferns.
  for (const s of [-1, 1]) {
    const x = s * (ww / 2 + 4.2);
    G.push(custom(new THREE.TorusGeometry(1.5, 0.18, 6, 24).translate(x, 9.6, BZ + 0.2), GOLD), vdisc(1.45, 0xdcefff, x, 9.6, BZ + 0.1, 24));
    G.push(rod([s * (ww / 2 + 1.2), TOP, BZ + 2], [s * (ww / 2 + 1.2), 12.2, BZ + 2], 0.03, 0.03, 0x8a7a6a, 3));
    G.push(lathe([[0, 0], [0.7, 0.05], [0.8, 0.8], [0, 0.8]], 0xf2e6d8, 12, s * (ww / 2 + 1.2), 11.4, BZ + 2));
    for (let i = 0; i < 8; i++) { const a = i * TAU / 8; G.push(egg(0.18, 1.0, 0.18, i % 2 ? 0x4fb060 : 0x3e9a52, s * (ww / 2 + 1.2) + Math.sin(a) * 0.6, 11.4, BZ + 2 + Math.cos(a) * 0.6, 6, 4)); }
  }

  // Left: a little sunken hot tub with steam; right: a wooden lounger with towels.
  const tx = -(hw + 7.5), tz = -hd * 0.2, tr = Math.min(4.6, hd * 0.35);
  M.push(disc(tr + 0.9, 0xd8b37a, tx, 0.03, tz, 24), disc(tr, 0x5fcfe0, tx, 0.05, tz, 24));
  G.push(custom(new THREE.TorusGeometry(tr + 0.45, 0.45, 5, 28).rotateX(PI / 2).scale(1, 0.6, 1).translate(tx, 0.18, tz), 0xf4ece0));
  for (let i = 0; i < 6; i++) K.halos.push([tx + K.rnd(-tr, tr) * 0.6, 0.08, tz + K.rnd(-tr, tr) * 0.6, 1.4, 1.4, 0.18, 0xffffff, false]);
  K.add(pottedPalm(K, 3.4), -(hw + 4.2), 0, -(hd + 4.5));
  K.blob(-(hw + 4.2), 0.02, -(hd + 4.5), 1.6, 1.5, 0.4);
  K.add(pottedPalm(K, 2.8, 0xd8eef0), hw + 4.2, 0, -(hd + 4.5));
  K.blob(hw + 4.2, 0.02, -(hd + 4.5), 1.6, 1.5, 0.4);
  const lx = hw + 5.2, lz = -hd * 0.1;
  const lounger = [box(2.0, 0.5, 5.2, 0xd8b37a, 0, 0, 0), rbox(1.8, 0.3, 3.6, 0xbfe6e0, 0, 0.5, 0.6, 0.12), rbox(1.8, 0.3, 1.6, 0xbfe6e0, 0, 0.9, -1.8, 0.12)];
  for (let i = 0; i < 3; i++) lounger.push(rbox(1.2, 0.25, 0.8, K.pick([0xff9ec0, 0xfff0b0, 0xffffff]), 0, 0.8 + i * 0.25, 1.6, 0.1));
  K.add(lounger, lx, 0, lz, 0);
  K.blob(lx, 0.02, lz, 1.6, 3.0, 0.38);
  // Near side (low): a fluffy bath mat, flip-flops, loose petals.
  const nz = hd + 2.6 + 1.2 * ns;
  M.push(...put([rbox(4.2, 0.12, 2.0, 0xffc4d6, 0, 0, 0, 0.06)], -hw * 0.45, 0, nz, 0.08, ns));
  for (const s of [-1, 1]) M.push(...put([egg(0.32, 0.06, 0.75, 0x6fd0e0, 0, 0.06, 0, 10, 4), custom(new THREE.TorusGeometry(0.2, 0.04, 4, 10, PI).translate(0, 0.12, -0.3), 0xffffff)], hw * 0.5 + s * 0.45, 0, nz + 0.2, 0.2, ns));
  // a low basket of rolled towels and a little stack of smooth stones
  const bk = [lathe([[0, 0], [1.1, 0], [1.3, 0.55], [1.2, 0.55], [1.0, 0.06], [0, 0.06]], 0xd8b37a, 16)];
  [[-0.45, 0.1, 0xff9ec0], [0.45, 0.1, 0x9fd8f0], [0, -0.35, 0xfff0b0], [0, 0.5, 0xffffff]].forEach(([x, z, c]) => bk.push(custom(new THREE.CylinderGeometry(0.28, 0.28, 0.9, 10).rotateZ(PI / 2).translate(x, 0.45, z), c)));
  K.add(bk, -hw * 0.08, 0, nz + 1.2, 0.3, ns); K.blob(-hw * 0.08, 0.02, nz + 1.2, 1.4 * ns, 1.2 * ns, 0.3);
  const st = [];
  [[0.75, 0.3], [0.6, 0.25], [0.45, 0.22], [0.3, 0.18]].reduce((y, [r, h], i) => { st.push(egg(r, h / 2, r * 0.8, [0x9aa6a4, 0xb8c2c0, 0x8e9a98, 0xc8d0ce][i], 0, y + h / 2, 0, 12, 6)); return y + h * 0.9; }, 0);
  K.add(st, hw * 0.28, 0, nz + 1.0, 0, ns); K.blob(hw * 0.28, 0.02, nz + 1.0, 0.9 * ns, 0.8 * ns, 0.3);
  const pet = [];
  for (let i = 0; i < 40; i++) { const [x, z] = K.around(1.7, 9, 5); pet.push(egg(0.14, 0.02, 0.09, K.pick([0xff9ec0, 0xffc4d6, 0xffffff]), x, 0.03, z, 6, 3)); }
  M.push(...pet);
  // Bubbles drifting up beside the board (glassy, bobbing).
  const bub2 = [];
  for (let i = 0; i < 26; i++) {
    const [x, z] = K.around(2.0, 10, 3);
    if (z > hd + 2) continue;
    const r = K.rnd(0.2, 0.55);
    bub2.push(egg(r, r, r, K.pick([0xd8f4ff, 0xffe2f4, 0xe8e0ff]), x, K.rnd(1.0, 5.0), z, 10, 8));
  }
  bobMesh(K, bub2, 'bubbles', new THREE.MeshPhongMaterial({ vertexColors: true, transparent: true, opacity: 0.55, shininess: 120, specular: 0xffffff, depthWrite: false }), (m, t) => { m.position.y = Math.sin(t * 0.8) * 0.35; });
}

// ============================================================== PUMPKIN PATCH
const AUTUMN = [0xff8a1f, 0xe8502e, 0xffc23a, 0xd8402e, 0xc98a2b];
function autumnTree(K, h, cr) {
  const s = [lathe([[0.3, 0], [0.22, h * 0.5], [0.16, h * 0.62]], 0x8a5a36, 8)];
  const a = K.pick(AUTUMN), b = K.pick(AUTUMN);
  s.push(egg(cr, cr * 0.85, cr, a, 0, h * 0.62 + cr * 0.5, 0, 12, 8), egg(cr * 0.7, cr * 0.6, cr * 0.7, b, cr * 0.45, h * 0.62 + cr * 1.0, 0.2, 10, 6), egg(cr * 0.65, cr * 0.55, cr * 0.65, b, -cr * 0.5, h * 0.62 + cr * 0.8, -0.2, 10, 6));
  return shadeY(s, 0, h + cr, 0.8, 1.08);
}
function patchPumpkin(K, r, col) {
  const g = new THREE.SphereGeometry(r, 12, 7), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const k = 1 - 0.12 * (1 - Math.abs(Math.cos(5 * Math.atan2(p.getX(i), p.getZ(i))))); p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); p.setY(i, p.getY(i) * 0.65); }
  g.computeVertexNormals();
  return [custom(g.translate(0, r * 0.65, 0), col), cyl(r * 0.1, r * 0.14, r * 0.35, 0x7a5a32, 0, r * 1.2)];
}
function barnSmall() {
  const RED = 0xc8443a;
  const s = [box(7, 4.5, 5, RED, 0, 0, 0), box(7.3, 0.3, 5.3, WHITE, 0, 4.5, 0)];
  const roofSh = new THREE.Shape(); roofSh.moveTo(-3.9, 0); roofSh.lineTo(0, 2.6); roofSh.lineTo(3.9, 0); roofSh.lineTo(-3.9, 0);
  s.push(custom(new THREE.ExtrudeGeometry(roofSh, { depth: 5.6, bevelEnabled: false }).translate(0, 4.7, -2.8), 0x6a4a3a));
  s.push(box(2.6, 3.2, 0.1, 0xa83a30, 0, 0, 2.52), box(2.8, 0.25, 0.12, WHITE, 0, 3.2, 2.55));
  for (const s2 of [-1, 1]) s.push(box(0.2, 3.2, 0.12, WHITE, s2 * 1.35, 0, 2.55), rod([s2 * 1.3, 0.1, 2.58], [-s2 * 1.3, 3.1, 2.58], 0.08, 0.08, WHITE, 4));
  s.push(box(1.2, 1.0, 0.1, WHITE, 0, 5.0, 2.55), box(1.0, 0.8, 0.12, 0x5a3a2a, 0, 5.1, 2.57));
  return s;
}
function pumpkin(K) {
  const { hw, hd, ns } = K;
  K.shadow = 0x5a4a24;
  const G = K.glossy, M = K.matte;
  const FZ = -(hd + 5);
  // Grass with fallen leaves and straw.
  const dots = [];
  for (let i = 0; i < 46; i++) {
    const [x, z] = K.around(2.4, 26, 16);
    dots.push(disc(K.rnd(1.6, 4.0), K.pick([0xa8b752, 0xbcc468, 0x9fae4a, 0xc8c070]), x, 0.01 + (i % 4) * 0.008, z, 14, 1, K.rnd(0.6, 1.0), K.R() * PI));
  }
  for (let i = 0; i < 220; i++) { const [x, z] = K.around(1.6, 22, 14); dots.push(disc(0.18, K.pick(AUTUMN), x, 0.05, z, 5, 1, 0.6, K.R() * TAU)); }
  K.flat.push(...dots);
  // A soil border round the board, vines with little pumpkins on the near side.
  const X0 = hw + 0.5, Z0 = hd + 0.5;
  K.flat.push(rectXZ(-X0 - 1.2, X0 + 1.2, Z0, Z0 + 1.2, 0.02, 0x9a7048), rectXZ(-X0 - 1.2, X0 + 1.2, -Z0 - 1.2, -Z0, 0.02, 0x9a7048), rectXZ(X0, X0 + 1.2, -Z0, Z0, 0.02, 0x9a7048), rectXZ(-X0 - 1.2, -X0, -Z0, Z0, 0.02, 0x9a7048));
  const nz = hd + 2.4 + 1.4 * ns;
  const vine = [];
  for (let x = -hw; x <= hw; x += 0.5) vine.push([x, 0.08, nz + Math.sin(x * 0.6) * 0.6]);
  for (let i = 1; i < vine.length; i++) G.push(rod(vine[i - 1], vine[i], 0.06, 0.06, 0x4f8a3a, 4));
  for (let i = 0; i < vine.length; i += 3) G.push(egg(0.45, 0.06, 0.32, i % 2 ? 0x5fa84a : 0x4f9a3e, vine[i][0], 0.1, vine[i][2] + 0.3, 8, 3));
  for (let x = -hw + 1.5; x < hw; x += K.rnd(2.6, 4.0)) { const z = nz + Math.sin(x * 0.6) * 0.6 - 0.4; K.add(patchPumpkin(K, K.rnd(0.35, 0.6) * ns, K.pick([0xff8a1f, 0xff9a2e, 0xfff0d8, 0xffb03a])), x, 0, z, K.R() * TAU); K.blob(x, 0.03, z, 0.7 * ns, 0.6 * ns, 0.3); }
  // Far side: a split-rail fence, the barn, trees in fall colours, hills.
  for (let x = -(hw + 20); x < hw + 20; x += 2.8) {
    G.push(box(0.2, 1.4, 0.2, 0xb08858, x, 0, FZ));
    G.push(rod([x, 0.5, FZ], [x + 2.8, 0.55, FZ], 0.08, 0.08, 0xc89a68, 4), rod([x, 1.1, FZ], [x + 2.8, 1.05, FZ], 0.08, 0.08, 0xc89a68, 4));
    K.blob(x, 0.02, FZ + 0.2, 1.0, 0.5, 0.2);
  }
  const bx = -Math.max(hw * 0.5, 5) - 2, bz = FZ - 9;
  K.add(barnSmall(), bx, 0, bz, 0.15); K.blob(bx, 0.02, bz + 0.5, 5.2, 4.2, 0.42); K.claim(bx, bz, 6);
  for (const [x, z] of [[bx + 5.5, bz + 3.2], [bx + 6.8, bz + 1.5], [bx - 5.2, bz + 3.0]]) {
    const hb = [custom(new THREE.CylinderGeometry(0.9, 0.9, 1.4, 14).rotateZ(PI / 2).translate(0, 0.9, 0), 0xf0cc68), custom(new THREE.CircleGeometry(0.75, 14).rotateY(PI / 2).translate(0.71, 0.9, 0), 0xd9ad48)];
    K.add(hb, x, 0, z, K.R() * PI); K.blob(x, 0.02, z, 1.3, 1.1, 0.35);
  }
  for (let x = -(hw + 26); x <= hw + 26; x += K.rnd(4.5, 7)) {
    const z = FZ - K.rnd(6, 18);
    if (!K.free(x, z, 2.6)) continue;
    K.claim(x, z, 2.6);
    K.add(autumnTree(K, K.rnd(4.5, 6.5), K.rnd(1.8, 2.6)), x, 0, z, K.R() * TAU);
    K.blob(x + 0.5, 0.02, z + 0.4, 2.2, 1.9, 0.35);
  }
  for (let i = 0; i < 10; i++) {
    const rx = K.rnd(12, 22), ry = K.rnd(3, 7), h = dome(rx, ry, K.rnd(8, 14), K.pick([0xc8b85a, 0xd8a85a, 0xb8b050, 0xe0b868]), K.rnd(-(hw + 60), hw + 60), -0.3, FZ - K.rnd(28, 50), 18, 6);
    shadeY(h, 0, ry, 0.82, 1.06); M.push(h);
  }
  // Sides: corn rows on the right, a cider stand + scarecrow on the left.
  for (let r = 0; r < 4; r++) for (let z = -hd + 1; z < hd * 0.6; z += K.rnd(0.8, 1.1)) {
    const x = hw + 3.2 + r * 1.7 + K.rnd(-0.2, 0.2), h = K.rnd(2.0, 2.9);
    G.push(rod([x, 0, z], [x, h, z], 0.07, 0.05, 0xc8b060, 4));
    for (let i = 0; i < 3; i++) { const y = h * (0.4 + i * 0.2), a = K.R() * TAU; G.push(egg(0.6, 0.05, 0.12, i % 2 ? 0xd8c070 : 0xbfae58, x + Math.cos(a) * 0.45, y, z + Math.sin(a) * 0.45, 6, 3)); }
  }
  K.blob(hw + 5.8, 0.02, -hd * 0.2, 3.6, hd * 0.8, 0.25);
  const sx = -(hw + 5.5), sz = -hd * 0.35;
  const stand = [box(3.6, 1.2, 1.4, 0xd8a868, 0, 0, 0), box(3.8, 0.15, 1.6, 0xb07a48, 0, 1.2, 0)];
  for (const s of [-1, 1]) stand.push(box(0.15, 2.4, 0.15, 0xb07a48, s * 1.75, 1.2, -0.6));
  for (let i = 0; i < 8; i++) stand.push(box(0.5, 0.15, 1.8, i % 2 ? 0xffffff : 0xe8502e, -1.75 + i * 0.5, 3.6, -0.1));
  for (let i = 0; i < 5; i++) stand.push(cyl(0.15, 0.15, 0.35, i % 2 ? 0xe8a040 : 0xc8402e, -1.2 + i * 0.6, 1.35, 0.2, 8));
  K.add(stand, sx, 0, sz, PI / 2 - 0.15); K.blob(sx, 0.02, sz, 1.6, 2.6, 0.38);
  for (const [x, z] of [[-(hw + 3.5), hd * 0.25], [-(hw + 4.6), hd * 0.4], [-(hw + 3.2), hd * 0.55]]) { K.add(patchPumpkin(K, K.rnd(0.6, 1.0), K.pick([0xff8a1f, 0xfff0d8, 0x9fc86a])), x, 0, z); K.blob(x, 0.02, z, 1.1, 1.0, 0.35); }
  // Leaves drifting down (one gently moving mesh).
  const lv = [];
  for (let i = 0; i < 40; i++) { const [x, z] = K.around(1.8, 14, 2); if (z > hd + 1) continue; lv.push(egg(0.18, 0.02, 0.12, K.pick(AUTUMN), x, K.rnd(1.5, 7), z, 6, 3)); }
  bobMesh(K, lv, 'leaves', new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), (m, t) => { m.position.y = -((t * 0.4) % 3); m.position.x = Math.sin(t * 0.7) * 0.6; });
  // Soft late-afternoon clouds.
  for (let i = 0; i < 5; i++) { const x = K.rnd(-(hw + 40), hw + 40), y = K.rnd(9, 13), z = FZ - K.rnd(20, 40), s = K.rnd(1.6, 2.6); M.push(egg(1.7 * s, 0.9 * s, 1.1 * s, 0xfff4e8, x, y, z, 12, 7), egg(s, 0.8 * s, s, 0xfff4e8, x + 1.4 * s, y + 0.2, z, 10, 6), egg(s, 0.7 * s, s, 0xffe8d8, x - 1.3 * s, y - 0.1, z, 10, 6)); }
}

// ============================================================== HOLIDAY MORNING
function armchair(col) {
  return [rbox(2.6, 1.0, 2.4, col, 0, 0.3, 0, 0.3), rbox(2.6, 1.9, 0.6, col, 0, 0.3, -0.9, 0.3), rbox(0.5, 1.4, 2.4, col, -1.25, 0.3, 0, 0.22), rbox(0.5, 1.4, 2.4, col, 1.25, 0.3, 0, 0.22),
    rbox(1.6, 0.35, 1.6, lighten(col, 0.25), 0, 1.25, 0.2, 0.15), ...[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([a, b]) => cyl(0.1, 0.08, 0.3, 0x6a4a32, a * 1.1, 0, b * 1.0, 8))];
}
function holiday(K) {
  const { hw, hd, ns } = K;
  K.shadow = 0x5a3a2a;
  const G = K.glossy, M = K.matte;
  const BZ = -(hd + 11), RX = hw + 15, TOP = 16;
  // Wood floor around the rug.
  K.meshes.push(texMesh(floorRing(hw, hd, 40), planksTex(K.R, 26, 42, 50), 10, { patched: true, name: 'woodfloor' }));
  // Back wall: wallpaper, wainscot, the fireplace with stockings, a frosty window each side.
  M.push(...shadeY([boxS(2 * RX, TOP, 1, 0xf6e6d0, 0, 0, BZ - 0.5, 1, 6, 1)], 0, TOP, 0.85, 1.02));
  for (let x = -RX + 1; x < RX; x += 2) M.push(box(0.4, TOP - 4, 0.05, 0xeedac0, x, 4, BZ + 0.02));
  G.push(box(2 * RX, 4, 0.3, 0x7a9a7a, 0, 0, BZ + 0.15), box(2 * RX, 0.3, 0.5, WHITE, 0, 4, BZ + 0.25));
  for (const s of [-1, 1]) M.push(boxS(1, TOP, 50, 0xf0dcc4, s * (RX + 0.5), 0, BZ + 25, 1, 6, 4));
  // fireplace
  const fw = 7, fh = 5.2;
  G.push(box(fw, fh, 1.6, 0xc8604a, 0, 0, BZ + 0.8), box(fw + 1.0, 0.45, 2.0, WHITE, 0, fh, BZ + 0.9), box(3.4, 2.8, 0.2, 0x2a1a1a, 0, 0, BZ + 1.62));
  for (let i = 0; i < 12; i++) G.push(box(0.9, 0.42, 0.06, 0xd8705a, -3.0 + (i % 6) * 1.2 + (Math.floor(i / 6) % 2) * 0.6, 3.2 + Math.floor(i / 6) * 0.9, BZ + 1.62));
  K.lit.push(egg(0.7, 0.9, 0.3, 0xffa030, -0.4, 0.9, BZ + 1.5, 8, 6), egg(0.6, 0.75, 0.3, 0xffc84a, 0.5, 0.8, BZ + 1.5, 8, 6), egg(0.35, 0.5, 0.2, 0xfff0a0, 0, 0.7, BZ + 1.6, 8, 6));
  K.halos.push([0, 1.2, BZ + 2.2, 3.0, 2.2, 0.55, 0xffa040, true], [0, 0.05, BZ + 3.4, 4.0, 2.4, 0.35, 0xffb050, false]);
  G.push(cyl(0.25, 0.25, 2.2, 0x8a5a36, 0, 0.3, BZ + 1.4, 8, 0, PI / 2));
  // garland + stockings on the mantel, candles
  const ml = [];
  for (let i = 0; i <= 14; i++) { const t = i / 14; ml.push([-fw / 2 - 0.3 + t * (fw + 0.6), fh + 0.3 - Math.sin(t * PI * 3) ** 2 * 0.5, BZ + 2.0]); }
  for (let i = 1; i < ml.length; i++) G.push(rod(ml[i - 1], ml[i], 0.22, 0.22, 0x2f8a4a, 6));
  for (let i = 1; i < ml.length; i += 2) K.lit.push(ballC(0.12, [0xff5050, 0xffd050, 0x50a0ff][i % 3], ml[i][0], ml[i][1] - 0.15, ml[i][2] + 0.2, 0));
  [0xe8333f, 0x2fae5a, 0xe8333f].forEach((c, i) => {
    const x = -2.2 + i * 2.2;
    G.push(box(0.7, 1.2, 0.25, c, x, fh - 1.3, BZ + 2.0), box(1.0, 0.4, 0.3, c, x + 0.15, fh - 1.6, BZ + 2.0), box(0.85, 0.35, 0.32, WHITE, x, fh - 0.35, BZ + 2.02));
  });
  for (const s of [-1, 1]) { G.push(cyl(0.2, 0.2, 0.9, 0xfff4e0, s * 3.0, fh + 0.45, BZ + 1.0)); K.lit.push(egg(0.08, 0.16, 0.08, 0xffc04a, s * 3.0, fh + 1.5, BZ + 1.0, 6, 4)); K.halos.push([s * 3.0, fh + 1.5, BZ + 1.3, 0.8, 0.8, 0.5, 0xffc46b, true]); }
  // windows with snow outside
  for (const s of [-1, 1]) {
    const wx = s * (fw / 2 + 4.6), wy = 4.6, ww = 4.6, wh = 6.4;
    const v = panel(ww, wh, 0x9fc4ec, wx, wy, BZ + 0.05);
    recolor(v, (x, y, z, c) => c.lerp(new THREE.Color(0xe6f2ff), clamp01((wy + wh - y) / wh)));
    G.push(v, custom(new THREE.PlaneGeometry(ww, 1.6).translate(wx, wy + 0.8, BZ + 0.08), 0xf4f8ff));
    for (let i = 0; i < 3; i++) G.push(cone(0.7, 2.2, 0x3f8a5a, wx - 1.4 + i * 1.4, wy + 0.8, BZ + 0.1, 6));
    for (const x of [wx - ww / 2, wx + ww / 2]) G.push(box(0.35, wh, 0.4, WHITE, x, wy, BZ + 0.2));
    for (const y of [wy, wy + wh]) G.push(box(ww + 0.35, 0.35, 0.4, WHITE, wx, y - 0.1, BZ + 0.2));
    G.push(box(0.2, wh, 0.3, WHITE, wx, wy, BZ + 0.2), box(ww, 0.2, 0.3, WHITE, wx, wy + wh / 2, BZ + 0.2));
    // wreath on the window
    G.push(custom(new THREE.TorusGeometry(0.8, 0.25, 6, 16).translate(wx, wy + wh / 2, BZ + 0.6), 0x2f8a4a));
    G.push(egg(0.25, 0.18, 0.1, 0xe8333f, wx, wy + wh / 2 - 0.8, BZ + 0.85, 8, 5));
  }
  // snowflakes falling outside (behind the glass, on the wall plane)
  const flakes = [];
  for (let i = 0; i < 60; i++) { const s = i % 2 ? 1 : -1; flakes.push(ballC(0.07, 0xffffff, s * (fw / 2 + 4.6) + K.rnd(-2.1, 2.1), K.rnd(4.8, 11), BZ + 0.12, 0)); }
  bobMesh(K, flakes, 'snow', new THREE.MeshBasicMaterial({ vertexColors: true }), (m, t) => { m.position.y = -((t * 0.5) % 1.6); });
  // Fairy lights across the top of the wall.
  hangingLights(K, -RX + 2, RX - 2, TOP - 1.5, BZ + 0.5, 1.2, 26, [0xff6060, 0xffd060, 0x60c0ff, 0x80e080, 0xff90d0]);

  // Sides: an armchair with a blanket and a side table with cookies (left); a toy rocking
  // horse and a tall present pile (right).
  K.add(armchair(0x7a9a7a), -(hw + 5.0), 0, -hd * 0.25, 0.9); K.blob(-(hw + 5.0), 0.02, -hd * 0.25, 2.2, 2.2, 0.42);
  const tbl = [cyl(0.9, 0.9, 0.1, 0x9a6a44, 0, 1.4), cyl(0.12, 0.2, 1.4, 0x8a5a36, 0, 0), cyl(0.6, 0.6, 0.06, WHITE, 0, 1.5), cyl(0.15, 0.15, 0.5, 0xfff4e0, 0.45, 1.5)];
  for (let i = 0; i < 5; i++) tbl.push(cyl(0.15, 0.15, 0.06, 0xc8844a, Math.sin(i * 1.3) * 0.3 - 0.1, 1.56 + (i % 2) * 0.06, Math.cos(i * 1.3) * 0.3, 10));
  K.add(tbl, -(hw + 4.6), 0, hd * 0.25); K.blob(-(hw + 4.6), 0.02, hd * 0.25, 1.2, 1.2, 0.35);
  const pile = [];
  [[0, 0, 1.6, 1.2, 0xe8333f], [1.2, 0.4, 1.2, 0.9, 0x2fae5a], [-1.0, 0.6, 1.0, 1.0, 0x3f8fff], [0.2, 1.2, 1.1, 0.8, 0xffc83a], [0.3, 2.0, 0.8, 0.7, 0xb06ae8]].forEach(([x, y, s, h, c], i) => {
    const z = i === 1 ? 0.6 : i === 2 ? -0.4 : 0;
    pile.push(rbox(s, h, s, c, x, i < 3 ? 0 : y, z, 0.05), box(s + 0.02, h + 0.02, 0.15, GOLD, x, i < 3 ? 0 : y, z), box(0.15, h + 0.02, s + 0.02, GOLD, x, i < 3 ? 0 : y, z));
  });
  K.add(pile, hw + 4.6, 0, -hd * 0.45); K.blob(hw + 4.6, 0.02, -hd * 0.45, 2.0, 1.6, 0.4);
  const horse = [box(2.2, 0.15, 0.5, 0xd8402e, 0, 0, 0)];
  for (const s of [-1, 1]) horse.push(custom(new THREE.TorusGeometry(1.4, 0.08, 4, 16, PI * 0.5).rotateZ(PI * 1.25).translate(0, 1.4, s * 0.35), 0xd8402e));
  horse.push(egg(0.9, 0.5, 0.4, 0xf4e8d8, 0, 1.2, 0, 10, 6), egg(0.35, 0.5, 0.3, 0xf4e8d8, 0.8, 1.8, 0, 8, 6), egg(0.3, 0.2, 0.25, 0xf4e8d8, 1.1, 1.75, 0, 8, 5), egg(0.5, 0.12, 0.42, 0xe8333f, -0.1, 1.65, 0, 8, 4));
  for (const [x, y] of [[-0.5, 0.5], [0.5, 0.5]]) horse.push(cyl(0.09, 0.09, 0.8, 0xf4e8d8, x, y));
  K.add(horse, hw + 4.4, 0, hd * 0.3, -0.5); K.blob(hw + 4.4, 0.02, hd * 0.3, 1.6, 1.0, 0.35);
  // Near side (low): wrapping paper rolls, ribbon curls, a plate of cookies.
  const nz = hd + 2.4 + 1.2 * ns;
  [[0xe8333f, -hw * 0.6], [0x2fae5a, -hw * 0.6 + 1.4], [0x3f8fff, hw * 0.55]].forEach(([c, x], i) => {
    K.add([cyl(0.25, 0.25, 3.0, c, 0, 0.25, 0, 10, 0, PI / 2), ...[-1, 0, 1].map((k) => cyl(0.26, 0.26, 0.15, WHITE, k * 0.9, 0.25, 0, 10, 0, PI / 2))], x, 0, nz + i * 0.4, 0.2 * (i - 1), ns);
  });
  K.add([cyl(0.8, 0.8, 0.06, WHITE, 0, 0, 0, 16), ...[0, 1, 2, 3].map((i) => cyl(0.22, 0.22, 0.06, 0xc8844a, Math.sin(i * 1.6) * 0.38, 0.06, Math.cos(i * 1.6) * 0.38, 10))], hw * 0.1, 0, nz + 0.6, 0, ns);
  const rib = [];
  for (let i = 0; i < 30; i++) { const [x, z] = K.around(1.7, 7, 4); rib.push(custom(new THREE.TorusGeometry(0.15, 0.03, 3, 10, PI * 1.5).rotateX(PI / 2).translate(x, 0.04, z), K.pick([0xe8333f, 0xffc83a, 0x3f8fff, 0x2fae5a]))); }
  M.push(...rib);
  void INK;
}

export const BACKDROPS = { spa, pumpkin, holiday };
