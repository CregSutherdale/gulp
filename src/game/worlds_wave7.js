// Season 7 worlds (GRAND FINALE): Pizza Parlor, Dino Dig and Fairy Castle.
// WORLDS: floor/sky defs (same shape as levelbuild.js WORLDS). BACKDROPS: scenery
// builders (same kit K as backdrops.js). MUSIC: world -> track key (src/engine/audio.js).
// Scenery follows the backdrops.js contract: nothing 3D inside the rail band, the near (+z)
// side stays low, tall pieces live far away; a handful of merged meshes, code-built only.
import * as THREE from 'three';
import { box, rbox, cyl, cone, ball, torus, capsule, custom, merge } from './geo.js';
import { patchGround } from '../engine/render.js';

function noise(x, w, h, a) {
  const img = x.getImageData(0, 0, w, h), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * a; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  x.putImageData(img, 0, 0);
}

export const WORLDS = {
  pizza: {
    // A cool blue-gray marble counter, dusted with flour: warm toppings pop on it.
    label: 'Pizza Parlor', sky: 0xffeedd, hemiSky: 0xfff7ee, hemiGround: 0xe0c8b0, surround: 0x9c6b47, wall: 0xc8553d, accent: '#e8473c',
    tile: 5, floor: (x, w, h) => {
      x.fillStyle = '#d3e0e6'; x.fillRect(0, 0, w, h);
      for (let i = 0; i < 9; i++) {
        const g = x.createRadialGradient(Math.random() * w, Math.random() * h, 0, Math.random() * w, Math.random() * h, 60 + Math.random() * 60);
        g.addColorStop(0, 'rgba(240,246,250,.45)'); g.addColorStop(1, 'rgba(240,246,250,0)');
        x.fillStyle = g; x.fillRect(0, 0, w, h);
      }
      x.lineWidth = 1.4;
      for (let v = 0; v < 5; v++) {
        let px = Math.random() * w, py = Math.random() * h, a = Math.random() * 6.3;
        x.strokeStyle = `rgba(150,170,185,${0.25 + Math.random() * 0.2})`; x.beginPath(); x.moveTo(px, py);
        for (let k = 0; k < 30; k++) { a += (Math.random() - 0.5) * 0.6; px += Math.cos(a) * 9; py += Math.sin(a) * 9; x.lineTo(px, py); }
        x.stroke();
      }
      noise(x, w, h, 6);
      for (let i = 0; i < 160; i++) { x.fillStyle = `rgba(255,255,255,${0.25 + Math.random() * 0.35})`; x.beginPath(); x.arc(Math.random() * w, Math.random() * h, 0.8 + Math.random() * 1.6, 0, 6.3); x.fill(); }
    },
  },
  dino: {
    // Caramel dig-site sand with the string grid of a real dig: ivory bones and pastel
    // eggs read clearly on it.
    label: 'Dino Dig', sky: 0xcdeeff, hemiSky: 0xf2fbff, hemiGround: 0xd8b98a, surround: 0x8fcf6a, wall: 0xb07a4a, accent: '#ff9a3a',
    tile: 4, floor: (x, w, h) => {
      x.fillStyle = '#d9b47c'; x.fillRect(0, 0, w, h);
      noise(x, w, h, 16);
      for (let i = 0; i < 70; i++) { x.fillStyle = `rgba(${150 + Math.random() * 40},${110 + Math.random() * 30},70,.35)`; const r = 1 + Math.random() * 3; x.beginPath(); x.arc(Math.random() * w, Math.random() * h, r, 0, 6.3); x.fill(); }
      for (let i = 0; i < 4; i++) { x.strokeStyle = 'rgba(255,240,215,.22)'; x.lineWidth = 2; x.beginPath(); for (let k = 0; k <= w; k += 8) x.lineTo(k, i * h / 4 + 30 + Math.sin(k * 0.04 + i * 2) * 5); x.stroke(); }
      // the dig grid: white string with pegs at the crossings
      x.strokeStyle = 'rgba(255,255,255,.6)'; x.lineWidth = 1.5;
      x.beginPath(); x.moveTo(1, 0); x.lineTo(1, h); x.moveTo(0, 1); x.lineTo(w, 1); x.stroke();
      x.fillStyle = '#ff6f5a'; x.fillRect(0, 0, 4, 4);
    },
  },
  castle: {
    // Pale periwinkle courtyard flagstones with white grout: saturated gems pop on it.
    label: 'Fairy Castle', sky: 0xe6dcff, hemiSky: 0xfaf6ff, hemiGround: 0xc9c4ea, surround: 0x9fdc8f, wall: 0xffffff, accent: '#b58cff',
    tile: 6, floor: (x, w, h) => {
      x.fillStyle = '#f4f2ff'; x.fillRect(0, 0, w, h);
      const n = 3, s = w / n, pal = ['#d6dcf2', '#d0d4ee', '#dce0f5', '#d3d8f0', '#dad6f2'];
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        x.fillStyle = pal[(i * 2 + j * 3) % pal.length];
        const l = i * s + 4, t = j * s + 4, ww = s - 8, hh = s - 8, r = 12;
        x.beginPath(); x.moveTo(l + r, t); x.arcTo(l + ww, t, l + ww, t + hh, r); x.arcTo(l + ww, t + hh, l, t + hh, r); x.arcTo(l, t + hh, l, t, r); x.arcTo(l, t, l + ww, t, r); x.closePath(); x.fill();
      }
      noise(x, w, h, 5);
      const sp = ['#ffffff', '#fff2a8', '#ffd6ec'];
      for (let i = 0; i < 18; i++) { x.fillStyle = sp[i % 3]; x.beginPath(); const cx = Math.random() * w, cy = Math.random() * h; for (let k = 0; k <= 8; k++) { const a = k * Math.PI / 4, rr = k % 2 ? 1.2 : 3.4; x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } x.fill(); }
    },
  },
};

// ---------------------------------------------------------------- scenery kit helpers
// (copied from backdrops.js so this file stands alone)
const TAU = Math.PI * 2, PI = Math.PI;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const _c = new THREE.Color(), _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
const _p = new THREE.Vector3(), _s = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);

// ============================================================== primitives
// Centred variants of the geo.js helpers (those sit on their base).
const ballC = (r, col, x = 0, y = 0, z = 0, det = 1, sy = 1) => ball(r, col, x, y - r * sy, z, det, sy);
const egg = (a, b, c, col, x = 0, y = 0, z = 0, ws = 12, hs = 8) =>
  custom(new THREE.SphereGeometry(1, ws, hs).scale(a, b, c).translate(x, y, z), col);
// Upper half of an ellipsoid standing on y (hills, dunes, mounds, cushions).
const dome = (a, b, c, col, x = 0, y = 0, z = 0, ws = 18, hs = 6) =>
  custom(new THREE.SphereGeometry(1, ws, hs, 0, TAU, 0, PI / 2).scale(a, b, c).translate(x, y, z), col);
const boxS = (w, h, d, col, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) =>
  custom(new THREE.BoxGeometry(w, h, d, sx, sy, sz).translate(x, y + h / 2, z), col);
// Profile [[radius, height], ...] listed bottom to top (outer surface faces out).
const lathe = (pts, col, seg = 14, x = 0, y = 0, z = 0) =>
  custom(new THREE.LatheGeometry(pts.map(([r, h]) => new THREE.Vector2(r, h)), seg).translate(x, y, z), col);
// Flat pieces facing up.
const rectXZ = (x0, x1, z0, z1, y, col, sx = 1, sz = 1) =>
  custom(new THREE.PlaneGeometry(x1 - x0, z1 - z0, sx, sz).rotateX(-PI / 2).translate((x0 + x1) / 2, y, (z0 + z1) / 2), col);
function flat(w, d, col, x = 0, y = 0, z = 0, ry = 0) {
  const g = new THREE.PlaneGeometry(w, d).rotateX(-PI / 2); if (ry) g.rotateY(ry);
  return custom(g.translate(x, y, z), col);
}
function disc(r, col, x = 0, y = 0, z = 0, seg = 16, sx = 1, sz = 1, ry = 0) {
  const g = new THREE.CircleGeometry(r, seg).rotateX(-PI / 2).scale(sx, 1, sz); if (ry) g.rotateY(ry);
  return custom(g.translate(x, y, z), col);
}
const ringXZ = (r0, r1, col, x = 0, y = 0, z = 0, seg = 32, sx = 1, sz = 1) =>
  custom(new THREE.RingGeometry(r0, r1, seg).rotateX(-PI / 2).scale(sx, 1, sz).translate(x, y, z), col);
// Many flat, upward discs in ONE geometry: [x, y, z, r, colour, seg=7, sx=1, sz=1, ry=0].
// (Sprinkles, pebbles, ground patches, footprints: hundreds of parts become one.)
function discBatch(items) {
  let n = 0;
  for (const it of items) n += (it[5] || 7) * 3;
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), nor = new Float32Array(n * 3), tm = new Float32Array(n);
  let k = 0;
  for (const [x, y, z, r, c, seg = 7, sx = 1, sz = 1, ry = 0] of items) {
    _c.set(c);
    const cs = Math.cos(ry), sn = Math.sin(ry);
    for (let i = 0; i < seg; i++) {
      for (const a of [-1, (i + 1) / seg, i / seg]) {
        let px = 0, pz = 0;
        if (a >= 0) { px = Math.cos(a * TAU) * r * sx; pz = Math.sin(a * TAU) * r * sz; }
        pos[k * 3] = x + px * cs + pz * sn; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z - px * sn + pz * cs;
        nor[k * 3 + 1] = 1;
        col[k * 3] = _c.r; col[k * 3 + 1] = _c.g; col[k * 3 + 2] = _c.b;
        k++;
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('tmask', new THREE.BufferAttribute(tm, 1));
  return g;
}
// Upright rectangle / disc facing +z.
function panel(w, h, col, x = 0, y = 0, z = 0, ry = 0) {
  const g = new THREE.PlaneGeometry(w, h).translate(0, h / 2, 0); if (ry) g.rotateY(ry);
  return custom(g.translate(x, y, z), col);
}
const vdisc = (r, col, x = 0, y = 0, z = 0, seg = 20) => custom(new THREE.CircleGeometry(r, seg).translate(x, y, z), col);
// Rod between two points (trunks, cords, handles), radius r0 at a, r1 at b.
function rod(a, b, r0, r1, col, seg = 6) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const len = A.distanceTo(B) || 0.001;
  const g = new THREE.CylinderGeometry(r1, r0, len, seg).translate(0, len / 2, 0);
  g.applyQuaternion(_q.setFromUnitVectors(_up, B.clone().sub(A).normalize())).translate(A.x, A.y, A.z);
  return custom(g, col);
}
// Triangles from point triples, each wound to face `facing` (default up).
function tris(pts, col, facing = _up) {
  const out = [], a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i + 2 < pts.length; i += 3) {
    a.fromArray(pts[i]); b.fromArray(pts[i + 1]); c.fromArray(pts[i + 2]);
    const n = b.clone().sub(a).cross(c.clone().sub(a));
    if (n.dot(facing) < 0) out.push(...pts[i], ...pts[i + 2], ...pts[i + 1]);
    else out.push(...pts[i], ...pts[i + 1], ...pts[i + 2]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(out, 3));
  g.computeVertexNormals();
  return custom(g, col);
}
// A flat shape (THREE.Shape) facing +z, e.g. stars and hearts.
const shapeZ = (shape, col, x = 0, y = 0, z = 0, s = 1) => custom(new THREE.ShapeGeometry(shape).scale(s, s, s).translate(x, y, z), col);
function starShape(r = 1, inner = 0.45, n = 5) {
  const s = new THREE.Shape();
  for (let i = 0; i <= n * 2; i++) {
    const a = PI / 2 + (i / (n * 2)) * TAU, rr = i % 2 ? r * inner : r;
    if (i === 0) s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  return s;
}

// Move, turn and scale a set of parts in place (Y turn, then optional tilt).
function put(parts, x = 0, y = 0, z = 0, ry = 0, s = 1, rx = 0, rz = 0) {
  const list = [parts].flat(Infinity);
  _e.set(rx, ry, rz, 'YXZ');
  if (typeof s === 'number') _s.set(s, s, s); else _s.set(s[0], s[1], s[2]);
  _m4.compose(_p.set(x, y, z), _q.setFromEuler(_e), _s);
  for (const g of list) g.applyMatrix4(_m4);
  return list;
}
// Per-vertex recolour: fn(x, y, z, colour) edits the (linear) colour in place.
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
// Brightness ramp lo..hi between heights y0..y1 (baked ambient occlusion / sky light).
const shadeY = (parts, y0, y1, lo, hi) => recolor(parts, (x, y, z, c) => c.multiplyScalar(lo + (hi - lo) * clamp01((y - y0) / (y1 - y0))));
function tintY(parts, y0, y1, hex, amt) {
  const t = new THREE.Color(hex);
  return recolor(parts, (x, y, z, c) => c.lerp(t, amt * clamp01((y - y0) / (y1 - y0))));
}
// Per-triangle brightness noise (stops big flat colours from looking like plastic sheets).
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
// Box-projected world UVs so a texture lines up across separate pieces.
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
function speckle(x, s, R, amt, alpha = 1) {
  const img = x.getImageData(0, 0, s, s), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (R() - 0.5) * amt; d[i] += n; d[i + 1] += n; d[i + 2] += n; d[i + 3] *= alpha; }
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
    x.strokeStyle = 'rgba(90,55,25,0.13)'; x.lineWidth = 1;
    for (let k = 0; k < 7; k++) {
      const gx = i * pw + 4 + R() * (pw - 8), amp = 1 + R() * 2.5, f = 0.02 + R() * 0.03, ph = R() * 6;
      x.beginPath(); for (let y = 0; y <= s; y += 4) x.lineTo(gx + Math.sin(y * f + ph) * amp, y); x.stroke();
    }
    x.fillStyle = 'rgba(60,35,15,0.45)'; x.fillRect(i * pw, 0, 2, s);
  }
  speckle(x, s, R, 8);
});
function texMesh(parts, tex, tile, { patched = false, phong = false, name = 'tex', shininess = 40 } = {}) {
  const list = [parts].flat(Infinity);
  for (const g of list) worldUV(g, tile);
  let mat = phong
    ? new THREE.MeshPhongMaterial({ map: tex, vertexColors: true, shininess, specular: 0x2c2c2c })
    : new THREE.MeshLambertMaterial({ map: tex, vertexColors: true });
  if (patched) mat = patchGround(mat);
  const m = new THREE.Mesh(merge(list), mat);
  m.name = name; m.receiveShadow = true;
  return m;
}

const WHITE = 0xfffaf4, GOLD = 0xffc95a, CHROME = 0xe6ebf1, CHROME_D = 0xb3bdc9, INK = 0x4a3a4a;
const PASTEL = [0xff9ec8, 0x9fe6cc, 0x9fd2ff, 0xffe27a, 0xc9b2ff, 0xffbf94];
const FLOWER = [0xff6f9c, 0xffd23f, 0xffffff, 0xff9a3a, 0xc58cff, 0xff5a6e, 0x7fc8ff];

// Cheap tree for the distance (hills, beyond fences): one canopy + one bump.
function farTree(K, h, cr, leaf, trunk = 0x9a6a44) {
  const can = [egg(cr, cr * 0.95, cr, leaf, 0, h - cr, 0, 9, 6), ballC(cr * 0.6, leaf, cr * 0.55, h - cr * 1.1, cr * 0.2, 0)];
  shadeY(can, h - cr * 2, h, 0.62, 1.15);
  return [cyl(cr * 0.14, cr * 0.2, h - cr * 1.3, trunk, 0, 0, 0, 5), ...can];
}
// Fluffy round tree: trunk + a cluster of balls, darker underneath, sunlit on top.
function roundTree(K, h, cr, leaf, trunk = 0x9a6a44) {
  const th = Math.max(1.2, h - cr * 1.7);
  const parts = [cyl(cr * 0.13, cr * 0.19, th + cr * 0.5, trunk, 0, 0, 0, 7)];
  const cy = th + cr * 0.75, can = [egg(cr, cr, cr, leaf, 0, cy, 0, 12, 8)];
  const n = 3 + Math.floor(K.R() * 2);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + K.R(), rr = cr * K.rnd(0.5, 0.66);
    can.push(ballC(rr, leaf, Math.cos(a) * cr * 0.68, cy + K.rnd(-0.38, 0.2) * cr, Math.sin(a) * cr * 0.68, 1));
  }
  can.push(ballC(cr * 0.55, leaf, K.rnd(-0.2, 0.2) * cr, cy + cr * 0.62, K.rnd(-0.2, 0.2) * cr, 1));
  shadeY(can, cy - cr * 1.1, cy + cr * 1.2, 0.6, 1.18);
  tintY(can, cy, cy + cr * 1.3, 0xd8f59a, 0.22);
  return parts.concat(can);
}
function pineTree(K, h, r, leaf, trunk = 0x8a5a3a) {
  const parts = [cyl(r * 0.12, r * 0.16, h * 0.3, trunk, 0, 0, 0, 6)];
  const tiers = [];
  for (let i = 0; i < 3; i++) tiers.push(cone(r * (1 - i * 0.24), h * 0.42, leaf, 0, h * 0.2 + i * h * 0.2, 0, 9));
  shadeY(tiers, h * 0.2, h, 0.62, 1.12);
  return parts.concat(tiers);
}
function bush(K, r, leaf) {
  const parts = [ballC(r, leaf, 0, r * 0.75, 0, 1)];
  for (let i = 0; i < 3; i++) { const a = i * 2.1 + K.R(); parts.push(ballC(r * 0.7, leaf, Math.cos(a) * r * 0.75, r * 0.55, Math.sin(a) * r * 0.75, 1)); }
  shadeY(parts, 0, r * 1.7, 0.62, 1.12);
  return parts;
}
// Grass tuft: three thin open cones, dark at the root.
function tuft(K, h, col) {
  const parts = [];
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU + K.R(), g = new THREE.ConeGeometry(0.1, h * K.rnd(0.7, 1.1), 3, 1, true);
    g.translate(0, h * 0.45, 0).rotateZ(Math.cos(a) * 0.3).rotateX(Math.sin(a) * 0.3).translate(Math.cos(a) * 0.12, 0, Math.sin(a) * 0.12);
    parts.push(custom(g, col));
  }
  return shadeY(parts, 0, h, 0.55, 1.15);
}
// Flowers seen from above: petal disc + centre, on a low leafy mound.
function flowerClump(K, r, col) {
  const parts = [dome(r, r * 0.55, r, 0x4fa64a, 0, 0, 0, 8, 3)];
  shadeY(parts, 0, r * 0.55, 0.7, 1.1);
  const n = 4 + Math.floor(K.R() * 4);
  for (let i = 0; i < n; i++) {
    const a = K.R() * TAU, d = Math.sqrt(K.R()) * r * 0.75, x = Math.cos(a) * d, z = Math.sin(a) * d, y = r * 0.42 + K.R() * 0.15;
    const pr = K.rnd(0.22, 0.32);
    parts.push(disc(pr, col, x, y, z, 7), disc(pr * 0.4, col === 0xffd23f ? 0xff9a3a : 0xffe066, x, y + 0.02, z, 6));
  }
  return parts;
}
// Rustic post-and-rail fence from (x0,z0) to (x1,z1).
function railFence(x0, z0, x1, z1, gap = 2.6, h = 1.7, col = 0xc8915c) {
  const parts = [], len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(len / gap));
  const ang = Math.atan2(z1 - z0, x1 - x0);
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
    parts.push(box(0.36, h, 0.36, col, x, 0, z, -ang), cone(0.27, 0.3, col, x, h, z, 4));
  }
  for (const y of [h * 0.38, h * 0.74]) {
    const g = new THREE.BoxGeometry(len, 0.22, 0.14).translate(0, y, 0).rotateY(-ang).translate((x0 + x1) / 2, 0, (z0 + z1) / 2 + 0.2 * Math.cos(ang));
    parts.push(custom(g, 0xdaa673));
  }
  return parts;
}
// White picket fence from (x0,z0) to (x1,z1); pickets face the board.
function picketFence(x0, z0, x1, z1, h = 2.0, gap = 0.62) {
  const parts = [], len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(len / gap));
  const ang = Math.atan2(z1 - z0, x1 - x0);
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
    const big = i % 6 === 0;
    parts.push(box(big ? 0.4 : 0.34, big ? h + 0.25 : h, 0.12, WHITE, x, 0, z, -ang));
    const tip = new THREE.ConeGeometry(big ? 0.29 : 0.24, 0.38, 4, 1, true).rotateY(PI / 4).translate(0, (big ? h + 0.25 : h) + 0.19, 0).scale(1, 1, 0.42).rotateY(-ang).translate(x, 0, z);
    parts.push(custom(tip, WHITE));
  }
  for (const y of [h * 0.28, h * 0.72]) {
    const g = new THREE.BoxGeometry(len, 0.2, 0.12).translate(0, y, -0.12).rotateY(-ang).translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
    parts.push(custom(g, 0xf0ebe4));
  }
  return parts;
}
// Puffy cloud, centred on its origin.
function cloudPuff(K, s, tint = WHITE, shade = _cloudShade) {
  const parts = [egg(1.7 * s, 0.95 * s, 1.15 * s, tint, 0, 0, 0, 12, 7)];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + K.R() * 0.6;
    parts.push(egg(s * K.rnd(0.75, 1.0), s * K.rnd(0.62, 0.85), s * K.rnd(0.7, 0.9), tint, Math.cos(a) * s * 1.35, K.rnd(0.0, 0.45) * s, Math.sin(a) * s * 0.75, 10, 6));
  }
  recolor(parts, (x, y, z, c) => c.lerp(shade, 1 - clamp01((y + 0.7 * s) / (1.5 * s))));
  return parts;
}
const _cloudShade = new THREE.Color(0xc9d6ef);
// Drifting clouds: one mesh, each cloud wraps around independently in the vertex shader.
function cloudLayer(K, list, span, tints = null) {
  const parts = [];
  for (const [x, y, z, s] of list) {
    const tint = tints ? K.pick(tints) : null;
    const c = tint ? cloudPuff(K, s, tint, new THREE.Color(tint).lerp(new THREE.Color(0x9fb6ff), 0.35)) : cloudPuff(K, s);
    put(c, x, y, z, K.rnd(-0.3, 0.3));
    for (const g of c) g.setAttribute('cx', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count).fill(x), 1));
    parts.push(...c);
  }
  const uTime = { value: 0 };
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x3a4048 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float cx;\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float nx = mod(cx + uTime * 0.45 + ${span.toFixed(1)}, ${(2 * span).toFixed(1)}) - ${span.toFixed(1)};
        transformed.x += nx - cx;`);
  };
  mat.customProgramCacheKey = () => 'backdrop-clouds';
  const m = new THREE.Mesh(merge(parts), mat);
  m.name = 'clouds'; m.frustumCulled = false;
  K.meshes.push(m);
  K.tick.push((t) => { uTime.value = t; });
}
function swag(list, a, b, sag, col, r = 0.09, seg = 5) {
  let prev = a;
  for (let i = 1; i <= 8; i++) {
    const t = i / 8, pt = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - Math.sin(t * PI) * sag, a[2] + (b[2] - a[2]) * t];
    list.push(rod(prev, pt, r, r, col, seg));
    prev = pt;
  }
}
// Ribbon along a curve on the ground: pts [[x, z], ...], width, colour, height.
function groundRibbon(pts, width, col, y, R = null, jit = 0) {
  const out = [];
  for (let i = 0; i + 1 < pts.length; i++) {
    const [xa, za] = pts[i], [xb, zb] = pts[i + 1];
    const [xp, zp] = pts[Math.max(0, i - 1)], [xn, zn] = pts[Math.min(pts.length - 1, i + 2)];
    const na = norm2(xb - xp, zb - zp), nb = norm2(xn - xa, zn - za);
    const w = width / 2;
    const a0 = [xa - na[1] * w, y, za + na[0] * w], a1 = [xa + na[1] * w, y, za - na[0] * w];
    const b0 = [xb - nb[1] * w, y, zb + nb[0] * w], b1 = [xb + nb[1] * w, y, zb - nb[0] * w];
    out.push(tris([a0, a1, b1, a0, b1, b0], col));
  }
  if (R && jit) jitter(out, R, jit);
  return out;
}
function norm2(x, z) { const l = Math.hypot(x, z) || 1; return [x / l, z / l]; }

function cord(list, pts, r, col, seg = 4) {
  for (let i = 1; i < pts.length; i++) list.push(rod(pts[i - 1], pts[i], r, r, col, seg));
  return list;
}
// A local point (x, z) turned by ry exactly as put() turns it.
const turn = (x, z, ry) => [x * Math.cos(ry) + z * Math.sin(ry), -x * Math.sin(ry) + z * Math.cos(ry)];
// Thin ring with a low-poly tube (trim, bands, hoops): torus() with 4 sides instead of 8.
const thinRing = (R, tube, col, x = 0, y = 0, z = 0, rx = PI / 2, seg = 16, sides = 4) => custom(new THREE.TorusGeometry(R, tube, sides, seg).rotateX(rx).translate(x, y, z), col);
const lighten = (hex, t) => new THREE.Color(hex).lerp(new THREE.Color(0xffffff), t).getHex();
const darken = (hex, k) => new THREE.Color(hex).multiplyScalar(k).getHex();

// ============================================================== PIZZA PARLOR
// The board is a marble counter top in a little pizza parlor: honey wood round the
// marble, the counter drops to a red-and-cream tiled floor, a brick wall at the back
// with a chalk menu, pendant lamps and shelves; toppings, jars and boxes on the counter.
function PIZZA(K) {
  const { hw, hd, ns } = K;
  const FL = -8, TOP = 22;
  const X0 = hw + 0.5, Z0 = hd + 0.5, TX = hw + 9.5, TZN = hd + 5 + 2 * ns, TZF = -(hd + 10);
  const BZ = -(hd + 14), RX = hw + 15;
  K.floorY = FL; K.shadow = 0x5a3a26;
  const G = K.glossy, M = K.matte, U = K.under;
  const EDGE = 0xb5784a, BRICKS = [0xd9714e, 0xcf6646, 0xe07d58, 0xc95f40];

  // counter top (wood) round the marble, an edge and a red-painted front down to the floor
  const top = [
    rectXZ(-TX, TX, Z0, TZN, 0, 0xffffff, 10, 2), rectXZ(-TX, TX, TZF, -Z0, 0, 0xffffff, 10, 3),
    rectXZ(X0, TX, -Z0, Z0, 0, 0xffffff, 3, 10), rectXZ(-TX, -X0, -Z0, Z0, 0, 0xffffff, 3, 10),
  ];
  recolor(top, (x, y, z, c) => c.multiplyScalar(0.86 + 0.14 * smooth(TX, TX - 3, Math.abs(x)) * smooth(TZN, TZN - 2, z)));
  K.meshes.push(texMesh(top, planksTex(K.R, 30, 48, 66), 13, { patched: true, name: 'counter' }));
  U.push(rbox(2 * TX + 0.2, 0.9, 1.1, EDGE, 0, -0.91, TZN - 0.5, 0.3), rbox(2 * TX + 0.2, 0.9, 1.1, EDGE, 0, -0.91, TZF + 0.5, 0.3));
  for (const s of [-1, 1]) U.push(rbox(1.1, 0.9, TZN - TZF, EDGE, s * (TX - 0.5), -0.91, (TZN + TZF) / 2, 0.3));
  const front = boxS(2 * TX - 1, -0.9 - FL, 0.6, 0xc8553d, 0, FL, TZN - 0.9, 8, 4, 1);
  shadeY(front, FL, -1, 0.7, 1.0);
  U.push(front);
  for (let i = 0; i < 6; i++) U.push(box(0.12, -1.2 - FL - 0.6, 0.1, 0xfff0d4, -TX + 1.5 + i * ((2 * TX - 3) / 5), FL + 0.3, TZN - 0.58));
  U.push(box(2 * TX - 1, 0.3, 0.2, 0xfff0d4, 0, -1.6, TZN - 0.55), box(2 * TX - 1, 0.6, 0.7, 0x6a3a2a, 0, FL, TZN - 0.6));

  // red-and-cream tiled floor and the brick back wall with a cream band
  K.meshes.push(texMesh([rectXZ(-RX, RX, BZ, hd + 70, FL, 0xffffff)], checkerTex(K.R, '#f2d9c4', '#e05a4a'), 4, { name: 'floor' }));
  K.blob(0, FL + 0.08, TZN + 0.4, TX + 0.5, 1.2, 0.5);
  const wall = boxS(2 * RX + 2, TOP - FL, 1, BRICKS[0], 0, FL, BZ - 0.5, 24, 30, 1);
  recolor(wall, (x, y, z, c) => {
    const row = Math.floor((y - FL) / 0.75), col = Math.floor((x + RX + (row % 2) * 0.8) / 1.6);
    c.set(BRICKS[(row * 7 + col * 3) % 4]); c.multiplyScalar(0.8 + 0.22 * clamp01((y - FL) / (TOP - FL)));
  });
  M.push(wall, box(2 * RX, 3.2, 0.3, 0xfff0d4, 0, FL, BZ + 0.15));
  G.push(box(2 * RX, 0.3, 0.45, 0x6a3a2a, 0, FL + 3.2, BZ + 0.22));
  for (const s of [-1, 1]) {
    const sw = boxS(1, TOP - FL, hd + 30 - BZ, 0xf3e3cf, s * (RX + 0.5), FL, (hd + 30 + BZ) / 2, 1, 8, 1);
    shadeY(sw, FL, TOP, 0.74, 0.96);
    M.push(sw, box(0.3, 3.2, hd + 30 - BZ, 0xc8553d, s * (RX - 0.15), FL, (hd + 30 + BZ) / 2));
  }
  // chalk menu board, a round clock and two shelves of jars and pizza boxes
  const mw = Math.min(10, hw * 0.85);
  G.push(rbox(mw + 0.8, 5.2, 0.3, 0x8a5a36, 0, 3.6, BZ + 0.2, 0.15), box(mw, 4.4, 0.1, 0x2f3a36, 0, 4.0, BZ + 0.4));
  K.lit.push(...[0, 1, 2, 3].map((i) => box(mw * (0.55 - i * 0.07), 0.16, 0.02, 0xf4f1e8, -mw * 0.12, 7.4 - i * 0.9, BZ + 0.46)));
  K.lit.push(...[0, 1, 2, 3].map((i) => box(0.7, 0.16, 0.02, 0xffd36e, mw * 0.36, 7.4 - i * 0.9, BZ + 0.46)));
  K.lit.push(disc(0.45, 0xff7a6a, mw * 0.36, 0, 0, 12).rotateX(PI / 2).translate(0, 4.4, BZ + 0.47));
  const ck = mw / 2 + 3.2;
  G.push(cyl(1.3, 1.3, 0.25, 0xfff6e8, ck, 0, BZ + 0.2, 20, PI / 2).translate(0, 9.4, 0), torus(1.3, 0.12, 0xc8553d, ck, 9.4, BZ + 0.35, 0, 20));
  G.push(box(0.12, 0.8, 0.05, INK, ck, 9.4, BZ + 0.36), box(0.6, 0.12, 0.05, INK, ck + 0.25, 9.4, BZ + 0.36));
  for (const s of [-1, 1]) {
    const sx = s * (mw / 2 + 4.6);
    for (const sy of [4.2, 7.4]) {
      G.push(box(5.4, 0.25, 1.4, 0xb5784a, sx, sy, BZ + 0.75));
      if (sy < 5) for (let i = 0; i < 4; i++) K.add([cyl(0.45, 0.45, 1.2, 0xe8f4ff, 0, 0, 0, 12), cyl(0.48, 0.48, 0.25, K.pick([0xe0403a, 0xffd23f, 0x5fd16a]), 0, 1.2, 0, 12), cyl(0.38, 0.38, 0.8, K.pick([0xfff3d6, 0xe8473c, 0x7bc96f, 0xffd8a0]), 0, 0.1, 0, 10)], sx - 1.8 + i * 1.2, sy + 0.25, BZ + 0.75);
      else for (let i = 0; i < 3; i++) K.add([rbox(1.5, 0.3, 1.2, i % 2 ? 0xfff6e8 : 0xe05a4a, 0, 0, 0, 0.04), rbox(1.5, 0.3, 1.2, i % 2 ? 0xe05a4a : 0xfff6e8, 0, 0.32, 0, 0.04)], sx - 1.6 + i * 1.6, sy + 0.25, BZ + 0.75);
    }
  }
  // pendant lamps over the counter, glowing warm
  const LZ = -(hd + 4.5);
  for (const lx of [-hw * 0.55, 0, hw * 0.55]) {
    G.push(rod([lx, TOP, LZ], [lx, 9.6, LZ], 0.04, 0.04, INK, 4), lathe([[0.15, 0], [1.1, -0.9], [1.15, -1.05], [0.15, -0.35]], 0xc8553d, 16, lx, 9.6, LZ));
    K.lit.push(ballC(0.32, 0xfff1c4, lx, 8.6, LZ, 1));
    K.halos.push([lx, 8.5, LZ + 0.5, 2.4, 1.8, 0.4, 0xffc46b, true]);
  }

  // on the counter, far side: a tomato-can tower, a flour bin, a basil pot, stacked boxes
  const cans = [[0, 0, 0], [1.25, 0, 0], [0.62, 1.5, 0]];
  const can = (lab) => [cyl(0.6, 0.6, 1.4, 0xd8dee6, 0, 0, 0, 14), cyl(0.62, 0.62, 0.8, lab, 0, 0.3, 0, 14), cyl(0.62, 0.62, 0.12, 0xfff6e8, 0, 0.52, 0, 14), ballC(0.22, 0xe0403a, 0, 0.75, 0.55, 1)];
  const cx0 = -(hw * 0.6 + 1.5), cz0 = -(hd + 4.6);
  cans.forEach(([dx, dy]) => K.add(can(0xe8473c), cx0 + dx, dy, cz0));
  K.blob(cx0 + 0.6, 0.02, cz0, 2.0, 1.2, 0.4);
  K.add([lathe([[0, 0], [1.0, 0], [1.1, 1.8], [0, 1.8]], 0xfaf3e6, 16), lathe([[0, 0], [1.15, 0], [1.1, 0.25], [0.3, 0.5], [0, 0.5]], 0xc8553d, 16, 0, 1.8), ballC(0.2, 0xc8553d, 0, 2.5, 0, 1)], hw * 0.2 + 1.5, 0, -(hd + 4.2));
  K.blob(hw * 0.2 + 1.5, 0.02, -(hd + 4.2), 1.5, 1.4, 0.4);
  const basil = [lathe([[0, 0], [0.7, 0], [0.9, 1.0], [0, 1.0]], 0xd9714e, 12)];
  for (let i = 0; i < 9; i++) { const a = i * 2.4, d = 0.2 + (i % 3) * 0.22; basil.push(egg(0.35, 0.12, 0.22, 0x3fae4a, Math.cos(a) * d, 1.2 + (i % 2) * 0.25, Math.sin(a) * d, 8, 4)); }
  K.add(shadeY(basil, 0, 1.6, 0.75, 1.1), hw * 0.62 + 2.5, 0, -(hd + 5.4));
  K.blob(hw * 0.62 + 2.5, 0.02, -(hd + 5.4), 1.3, 1.2, 0.4);
  K.add([rbox(2.4, 0.4, 2.4, 0xe05a4a, 0, 0, 0, 0.06), rbox(2.4, 0.4, 2.4, 0xfff6e8, 0.05, 0.42, 0, 0.06), rbox(2.4, 0.4, 2.4, 0xe05a4a, -0.04, 0.84, 0, 0.06), disc(0.7, 0xffd23f, 0, 1.25, 0, 14)], -(hw * 0.15 + 1), 0, -(hd + 6.6), 0.15);
  K.blob(-(hw * 0.15 + 1), 0.02, -(hd + 6.6), 1.9, 1.9, 0.4);

  // the sides: a big pizza on a board with a cutter wheel; a cheese block and grater
  const pz = (r) => {
    const p = [lathe([[0, 0], [r, 0], [r + 0.1, 0.15], [r - 0.1, 0.25], [0, 0.18]], 0xe2a95e, 24), disc(r - 0.15, 0xe8473c, 0, 0.2, 0, 24), disc(r - 0.3, 0xffe9a6, 0, 0.22, 0, 24)];
    for (let i = 0; i < 12; i++) { const a = i * 2.4, d = (r - 0.6) * Math.sqrt((i + 0.5) / 12); p.push(disc(0.22, i % 3 ? 0xe0403a : 0x3fae4a, Math.cos(a) * d, 0.24, Math.sin(a) * d, 10)); }
    return p;
  };
  const bx = -(hw + 4.8);
  K.add([cyl(2.6, 2.6, 0.2, 0xd39a5e, 0, 0, 0, 24), box(1.2, 0.2, 0.6, 0xd39a5e, 2.9, 0, 0), ...put(pz(2.2), 0, 0.2, 0)], bx, 0, hd * 0.35, 0.3);
  K.blob(bx, 0.02, hd * 0.35, 2.9, 2.8, 0.42);
  K.add([cyl(0.8, 0.8, 0.12, 0xdfe6ef, 0, 0.6, 0, 18, PI / 2), cyl(0.2, 0.2, 0.3, INK, 0, 0.6, 0, 8, PI / 2), rod([0, 0.6, 0], [1.6, 0.4, 0], 0.15, 0.15, 0xc8553d, 8)], bx + 1.0, 0, -hd * 0.25, -0.5);
  K.blob(bx + 1.6, 0.02, -hd * 0.25, 1.6, 0.8, 0.3, -0.5);
  const gx = hw + 4.6;
  K.add([box(2.4, 1.4, 1.6, 0xffd23f, 0, 0, 0), box(0.8, 1.4, 1.6, 0xffe680, 1.6, 0, 0, 0.3)], gx, 0, hd * 0.25, -0.2);
  K.blob(gx + 0.5, 0.02, hd * 0.25, 2.2, 1.4, 0.4, -0.2);
  K.add([box(1.4, 2.6, 0.9, 0xdfe6ef, 0, 0, 0), box(1.0, 0.3, 0.2, INK, 0, 2.6, 0)], gx + 0.4, 0, -hd * 0.35, 0.3);
  K.blob(gx + 0.4, 0.02, -hd * 0.35, 1.2, 0.9, 0.4);
  K.add([cyl(0.9, 1.1, 1.2, 0xfaf3e6, 0, 0, 0, 14), egg(0.8, 0.4, 0.8, 0xfffaf2, 0, 1.2, 0, 12, 6)], gx + 1.4, 0, -hd * 0.8);
  K.blob(gx + 1.4, 0.02, -hd * 0.8, 1.4, 1.3, 0.4);
  for (const [x, z] of [[-(hw + 3.2), -hd * 0.7], [hw + 3.2, hd * 0.65]]) K.add([cyl(0.7, 0.7, 0.9, 0xe8f4ff, 0, 0, 0, 12), cyl(0.72, 0.72, 0.2, 0xc8553d, 0, 0.9, 0, 12), cyl(0.6, 0.6, 0.6, 0x9a5a3a, 0, 0.1, 0, 10)], x, 0, z);

  // near strip (seen at every start): flat flour dust, basil leaves, a pizza cutter
  const nz = (hd + 1.2 + TZN) / 2, dots = [];
  for (let i = 0; i < 70; i++) dots.push([K.rnd(-hw - 3, hw + 3), 0.015, K.rnd(hd + 1.2, TZN - 1.1), K.rnd(0.05, 0.16), K.pick([0xfdf8ef, 0xf4e6cf]), 7, 1, K.rnd(0.6, 1)]);
  for (let i = 0; i < 10; i++) dots.push([K.rnd(-hw, hw), 0.03, K.rnd(hd + 1.4, TZN - 1.2), 0.16, 0x3fae4a, 8, 1.8, 1, K.R() * PI]);
  K.flat.push(discBatch(dots));
  K.add([cyl(0.6, 0.6, 0.08, 0xdfe6ef, 0, 0, 0, 16), rod([0, 0.08, 0], [1.6, 0.12, 0.3], 0.12, 0.12, 0xc8553d, 8)], -hw * 0.5, 0, nz, 0.4, ns);
  K.add(pz(1.1), hw * 0.5, 0, nz, 0, ns);
  K.blob(hw * 0.5, 0.02, nz, 1.3 * ns, 1.3 * ns, 0.3);
}
function checkerTex(R, a, b) {
  return canvasTex(128, (x, s) => {
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { x.fillStyle = (i + j) % 2 ? a : b; x.fillRect(i * s / 2, j * s / 2, s / 2, s / 2); }
    x.strokeStyle = 'rgba(255,255,255,0.4)'; x.lineWidth = 2;
    for (let k = 0; k <= 2; k++) { x.beginPath(); x.moveTo(k * s / 2, 0); x.lineTo(k * s / 2, s); x.stroke(); x.beginPath(); x.moveTo(0, k * s / 2); x.lineTo(s, k * s / 2); x.stroke(); }
    speckle(x, s, R, 6);
  });
}

// ============================================================== DINO DIG
// A toy dig site in a sunny jungle clearing: a sand apron with rope posts round the dig,
// palms and ferns, big round boulders, a striped tent and a toy volcano far behind, and
// a friendly longneck statue peeking over the trees.
function DINO(K) {
  const { hw, hd, ns } = K;
  K.shadow = 0x5a6a3a;
  const G = K.glossy, M = K.matte;
  const X0 = hw + 0.5, Z0 = hd + 0.5, SB = 3.2, SX = X0 + SB, SZ = Z0 + SB;
  const dots = [];
  // sand apron round the dig (flat), with a rope fence on posts
  K.flat.push(rectXZ(-SX, SX, Z0, SZ, 0.02, 0xe6c58e), rectXZ(-SX, SX, -SZ, -Z0, 0.02, 0xe6c58e), rectXZ(X0, SX, -Z0, Z0, 0.02, 0xe6c58e), rectXZ(-SX, -X0, -Z0, Z0, 0.02, 0xe6c58e));
  for (let i = 0; i < 160; i++) { const [x, z] = K.around(0.6, SB - 0.3, SB - 0.3); dots.push([x, 0.03, z, K.rnd(0.05, 0.12), K.pick([0xd4ad72, 0xf0d6a0, 0xc99a60]), 6]); }
  // jungle grass beyond, darker patches and little flowers
  for (let i = 0; i < 50; i++) { const [x, z] = K.around(SB + 1.5, 30, 20); dots.push([x, 0.01 + (i % 3) * 0.01, z, K.rnd(1.6, 4.2), K.pick([0x7cc25e, 0x8fcf6a, 0x6fb655, 0x9ad877]), 12, 1, K.rnd(0.6, 1), K.R() * PI]); }
  for (let i = 0; i < 90; i++) { const [x, z] = K.around(SB + 1.2, 26, 18); dots.push([x, 0.08, z, 0.14, K.pick([0xffffff, 0xffe066, 0xff9fc8]), 5]); }
  const ropePosts = [];
  const RX = SX - 0.6, RZ = SZ - 0.6, nx = Math.max(4, Math.round(RX / 3.2)), nzp = Math.max(4, Math.round(RZ / 3.2));
  for (let i = -nx; i <= nx; i++) ropePosts.push([(i / nx) * RX, -RZ]);
  for (let j = -nzp + 1; j < nzp; j++) ropePosts.push([-RX, (j / nzp) * RZ], [RX, (j / nzp) * RZ]);
  for (const [x, z] of ropePosts) { G.push(cyl(0.16, 0.18, 1.2, 0xb07a4a, x, 0, z, 6), ballC(0.2, 0xff7a5a, x, 1.3, z, 0)); K.blob(x, 0.03, z, 0.35, 0.35, 0.3); }
  for (let i = -nx; i < nx; i++) swag(G, [(i / nx) * RX, 1.05, -RZ], [((i + 1) / nx) * RX, 1.05, -RZ], 0.25, 0xfff0c8, 0.04, 4);
  for (const s of [-1, 1]) for (let j = -nzp + 1; j < nzp - 1; j++) swag(G, [s * RX, 1.05, (j / nzp) * RZ], [s * RX, 1.05, ((j + 1) / nzp) * RZ], 0.25, 0xfff0c8, 0.04, 4);

  // the toy volcano and a longneck statue far behind; palms and boulders round the clearing
  const vz = -(hd + 30), vx = -Math.min(hw * 0.4, 6);
  const vol = [lathe([[16, 0], [12, 5], [7.5, 11], [4.2, 15.5], [3.2, 16.3], [2.4, 15.8]], 0xa8735a, 20)];
  shadeY(vol, 0, 16, 0.7, 1.08);
  for (const a of [0.2, -0.6, 0.9]) vol.push(rod([Math.sin(a) * 3, 16, Math.cos(a) * 3], [Math.sin(a) * 11, 6, Math.cos(a) * 11], 0.9, 1.4, 0xff7a2e, 6));
  vol.push(egg(2.8, 0.8, 2.8, 0xffb03a, 0, 16.2, 0, 12, 5), egg(3.6, 2.4, 3.0, 0xfffaf4, 1.0, 20, -0.5, 10, 6), egg(2.6, 1.8, 2.2, 0xfffaf4, 3.8, 22.6, -1.0, 10, 6));
  K.add(vol, vx, 0, vz);
  K.halos.push([vx, 16.5, vz + 4, 5, 2.4, 0.35, 0xff9a3a, true]);
  const ln = [egg(3.4, 2.2, 2.2, 0x7bd99a, 0, 5.4, 0, 14, 8), rod([2.2, 6.0, 0], [5.2, 12.5, 0], 1.1, 0.7, 0x7bd99a, 10), egg(1.4, 0.95, 1.0, 0x7bd99a, 5.7, 13.0, 0, 12, 8), rod([-2.8, 5.6, 0], [-6.8, 1.8, 0], 1.0, 0.25, 0x7bd99a, 8)];
  for (const [x, z] of [[-1.6, -1.0], [-1.6, 1.0], [1.6, -1.0], [1.6, 1.0]]) ln.push(cyl(0.75, 0.8, 3.6, 0x7bd99a, x, 0, z, 10));
  for (const [x, y] of [[-1.2, 7.3], [0.6, 7.5], [-2.4, 6.6]]) ln.push(egg(0.6, 0.3, 0.6, 0xc8f0d4, x, y, 0.8, 8, 4));
  ln.push(ballC(0.16, INK, 6.4, 13.3, 0.85, 1), ballC(0.16, INK, 6.4, 13.3, -0.85, 1));
  K.add(shadeY(ln, 0, 14, 0.75, 1.08), Math.max(hw * 0.55, 6) + 4, 0, -(hd + 15), -0.5);
  K.blob(Math.max(hw * 0.55, 6) + 4, 0.03, -(hd + 15), 5.5, 3.5, 0.4, -0.5);
  const palm = (h, lean) => {
    const p = [];
    for (let i = 0; i < 6; i++) { const t0 = i / 6, t1 = (i + 1) / 6; p.push(rod([lean * t0 * t0 * h, t0 * h, 0], [lean * t1 * t1 * h, t1 * h, 0], 0.42 - t0 * 0.15, 0.4 - t1 * 0.15, i % 2 ? 0xb07a4a : 0x9a6a3e, 7)); }
    const tx = lean * h;
    for (let i = 0; i < 7; i++) { const a = (i / 7) * TAU; p.push(egg(2.6, 0.18, 0.7, i % 2 ? 0x4fb84a : 0x3fa648, tx + Math.cos(a) * 2.0, h - 0.4, Math.sin(a) * 2.0, 8, 4).rotateY(0)); }
    for (const p2 of p.slice(6)) { p2.computeBoundingBox(); }
    p.push(ballC(0.45, 0x8a5a2a, tx + 0.3, h - 0.5, 0.2, 1), ballC(0.45, 0x8a5a2a, tx - 0.2, h - 0.6, -0.35, 1));
    return p;
  };
  const spots = [[-(hw + 8), -(hd + 6), 13, 0.12], [-(hw + 6.5), hd * 0.1, 10, -0.1], [hw + 7, -(hd + 4), 12, -0.1], [hw + 8.5, hd * 0.3, 9, 0.1], [-(hw + 12), -(hd * 0.5), 11, 0.08], [hw + 12, -hd * 0.6, 11, -0.08], [-hw * 0.2, -(hd + 11), 12, 0.05], [hw * 0.3 + 3, -(hd + 8), 9, -0.06]];
  for (const [x, z, h, l] of spots) { K.add(palm(h, l), x, 0, z, K.R() * TAU); K.blob(x, 0.03, z, 2.4, 2.4, 0.38); }
  for (let i = 0; i < 14; i++) {
    const [x, z] = K.around(SB + 2.5, 16, 6);
    if (z > hd + SB + 3) continue;
    const r = K.rnd(1.0, 2.4);
    K.add(shadeY([egg(r, r * 0.7, r * 0.9, K.pick([0xb8ada0, 0xa89c90, 0xc4b8aa]), 0, r * 0.45, 0, 10, 6)], 0, r * 1.2, 0.72, 1.08), x, 0, z, K.R() * TAU);
    K.blob(x, 0.03, z, r * 1.2, r * 1.0, 0.35);
  }
  for (let i = 0; i < 26; i++) {
    const [x, z] = K.around(SB + 1.6, 20, 4);
    const f = [];
    for (let k = 0; k < 6; k++) { const a = (k / 6) * TAU + K.R(); f.push(egg(1.0, 0.12, 0.3, K.pick([0x4fb84a, 0x5fc85a, 0x3fa648]), Math.cos(a) * 0.8, 0.6, Math.sin(a) * 0.8, 6, 3)); }
    K.add(f, x, 0, z, K.R() * TAU, K.rnd(0.8, 1.4));
  }
  // a striped dig tent on the left, crates and a sieve on the right (outside the posts)
  const tx = -(SX + 5.5), tz = -hd * 0.45;
  const roof = new THREE.ConeGeometry(4.2, 2.4, 4, 1).rotateY(PI / 4).translate(0, 5.6, 0);
  const rp = [];
  { const g = roof.toNonIndexed(), P = g.attributes.position; for (let i = 0; i < P.count; i += 3) { const cxm = (P.getX(i) + P.getX(i + 1) + P.getX(i + 2)) / 3, czm = (P.getZ(i) + P.getZ(i + 1) + P.getZ(i + 2)) / 3; rp.push(Math.floor(((Math.atan2(cxm, czm) + PI) / TAU) * 16) % 2); } }
  K.add([custom(roof, 0xff7a6a), ...[[-2.6, -2.6], [2.6, -2.6], [-2.6, 2.6], [2.6, 2.6]].map(([x, z]) => cyl(0.12, 0.12, 4.4, 0xb07a4a, x, 0, z, 6)), rbox(3.0, 1.0, 1.6, 0xd39a5e, 0, 0, 0, 0.06), box(1.6, 0.05, 1.0, 0xfff3d0, 0, 1.0, 0)], tx, 0, tz, 0.3);
  K.blob(tx, 0.03, tz, 3.8, 3.8, 0.4);
  const cx = SX + 4.6;
  K.add([rbox(1.6, 1.2, 1.4, 0xb07a4a, 0, 0, 0, 0.06), rbox(1.3, 1.0, 1.2, 0xd39a5e, 0.2, 1.2, 0, 0.06), cyl(1.0, 1.0, 0.3, 0xd39a5e, 2.2, 0, 0.6, 16), egg(0.8, 0.2, 0.8, 0xe6c58e, 2.2, 0.32, 0.6, 10, 4)], cx, 0, -hd * 0.1, -0.3);
  K.blob(cx + 0.8, 0.03, -hd * 0.1, 2.4, 1.6, 0.4);

  // near side (low): toy buckets and a shovel on the sand, bones and pebbles
  const nz = hd + SB + 2.4 * ns;
  K.add([lathe([[0, 0], [0.5, 0], [0.62, 0.9], [0, 0.9]], 0xff7a8a, 12), torus(0.62, 0.05, 0xff9fb0, 0, 0.9, 0)], -hw * 0.45, 0, nz, 0, ns);
  K.add([lathe([[0, 0], [0.5, 0], [0.62, 0.9], [0, 0.9]], 0x5cc8ff, 12), torus(0.62, 0.05, 0x8fd8ff, 0, 0.9, 0)], hw * 0.55, 0, nz + 0.8, 0, ns);
  K.add([rod([0, 0.08, 0], [1.6, 0.08, 0], 0.07, 0.07, 0xffd23f, 6), box(0.8, 0.08, 0.7, 0xffd23f, 1.9, 0.04, 0)], -hw * 0.1, 0, nz + 1.4, 0.4, ns);
  for (const [x, z] of [[-hw * 0.45, nz], [hw * 0.55, nz + 0.8]]) K.blob(x, 0.03, z, 0.8 * ns, 0.8 * ns, 0.3);
  for (let i = 0; i < 8; i++) K.add([rod([-0.35, 0.08, 0], [0.35, 0.08, 0], 0.07, 0.07, 0xfff4dc, 6), ballC(0.1, 0xfff4dc, -0.4, 0.1, 0.06, 0), ballC(0.1, 0xfff4dc, -0.4, 0.1, -0.06, 0), ballC(0.1, 0xfff4dc, 0.4, 0.1, 0.06, 0), ballC(0.1, 0xfff4dc, 0.4, 0.1, -0.06, 0)], K.rnd(-hw - 6, hw + 6), 0, K.rnd(hd + SB + 1.5, hd + SB + 12), K.R() * TAU);
  K.flat.push(discBatch(dots));
  cloudLayer(K, [[-20, 26, -(hd + 40), 4], [6, 30, -(hd + 46), 5], [26, 24, -(hd + 38), 3.6], [-34, 22, -(hd + 30), 3.4]], 60);
}

// ============================================================== FAIRY CASTLE
// A fairy-tale courtyard: a stone path round the board, hedges and flower beds, round
// pastel trees, a big pastel castle on the hill behind with towers and flags, a rainbow,
// soft clouds; little lanterns and flowers on the near side.
function CASTLE(K) {
  const { hw, hd, ns } = K;
  K.shadow = 0x4a6a4a;
  const G = K.glossy;
  const X0 = hw + 0.5, Z0 = hd + 0.5, PB = 2.6, PX = X0 + PB, PZ = Z0 + PB;
  const dots = [], STONE = [0xe6def2, 0xdfd6ee, 0xebe4f6, 0xd9d0ea];
  K.flat.push(rectXZ(-PX, PX, Z0, PZ, 0.02, 0xd8cfe8), rectXZ(-PX, PX, -PZ, -Z0, 0.02, 0xd8cfe8), rectXZ(X0, PX, -Z0, Z0, 0.02, 0xd8cfe8), rectXZ(-PX, -X0, -Z0, Z0, 0.02, 0xd8cfe8));
  for (let z = -PZ + 0.35, row = 0; z < PZ; z += 0.7, row++) for (let x = -PX + 0.35 + (row % 2) * 0.35; x < PX; x += 0.7) {
    if (Math.abs(x) < X0 + 0.1 && Math.abs(z) < Z0 + 0.1) continue;
    dots.push([x, 0.03, z, K.rnd(0.27, 0.31), K.pick(STONE), 8, 1, 1, K.R()]);
  }
  for (let i = 0; i < 46; i++) { const [x, z] = K.around(PB + 2, 30, 18); dots.push([x, 0.01 + (i % 4) * 0.01, z, K.rnd(1.6, 4.0), K.pick([0x9fdc8f, 0xa9e39a, 0x93d184, 0xb3e8a4]), 12, 1, K.rnd(0.6, 1), K.R() * PI]); }
  for (let i = 0; i < 140; i++) { const [x, z] = K.around(PB + 1.2, 26, 18); dots.push([x, 0.09, z, 0.13, K.pick([0xffffff, 0xffd6ec, 0xfff2a8, 0xd9c6ff]), 5]); }
  // hedge walls down both sides with pastel flower beds and topiary balls
  const HX = PX + 1.6;
  for (const s of [-1, 1]) {
    const hz0 = -(hd + 8), hz1 = hd + 4;
    const hedge = [];
    for (let z = hz0; z < hz1; z += 1.6) hedge.push(rbox(1.4, 1.6, 1.7, 0x5fbf5a, s * HX, 0, z + 0.8, 0.5));
    K.add(shadeY(hedge, 0, 1.6, 0.7, 1.1));
    for (let z = hz0 + 3; z < hz1; z += 6) {
      K.add(shadeY([cyl(0.25, 0.3, 1.0, 0xb07a4a, 0, 0, 0, 6), ballC(1.1, 0x6fcf6a, 0, 2.0, 0, 1), ballC(0.7, 0x6fcf6a, 0, 3.2, 0, 1)], 0, 3.9, 0.7, 1.1), s * (HX + 2.2), 0, z);
      K.blob(s * (HX + 2.2), 0.03, z, 1.2, 1.2, 0.35);
    }
    for (let z = hz0 + 1; z < hz1; z += 3.2) K.add(flowerClump(K, 0.9, K.pick(FLOWER)), s * (HX + 0.1) - s * 1.4, 0, z);
  }
  // the castle on the hill behind (big pastel scenery, far side)
  const cz = -(hd + 34);
  K.add(shadeY([dome(30, 6, 12, 0x93d184, 0, 0, 0, 24, 6)], 0, 6, 0.8, 1.1), 0, 0, cz + 2);
  const C2 = [], WALL = 0xfff6fb, ROOFS = [0xff9cc6, 0xb9a0ff, 0x9fd2ff, 0x8fe3c4];
  C2.push(box(18, 8, 6, WALL, 0, 5, 0));
  for (let i = 0; i < 12; i++) C2.push(box(0.9, 1.0, 0.9, WALL, -8.2 + i * 1.5, 13, 2.6));
  C2.push(box(8, 10, 5, WALL, 0, 5, -2), cone(5.4, 6, ROOFS[0], 0, 15, -2, 4).rotateY(0));
  for (const [x, z, h, r, k] of [[-9.5, 2, 13, 2.2, 1], [9.5, 2, 13, 2.2, 2], [-5.5, -3, 17, 1.8, 3], [5.5, -3, 17, 1.8, 2], [0, -4, 22, 1.6, 0]]) {
    C2.push(cyl(r, r * 1.05, h, WALL, x, 5, z, 14), cone(r * 1.35, r * 2.6, ROOFS[k], x, 5 + h, z, 14));
    C2.push(rod([x, 5 + h + r * 2.6, z], [x, 5 + h + r * 2.6 + 1.6, z], 0.08, 0.08, 0x8a5a36, 4), box(1.4, 0.7, 0.05, ROOFS[(k + 1) % 4], x + 0.7, 5 + h + r * 2.6 + 0.9, z));
    for (let w = 0; w < 2; w++) C2.push(box(0.6, 1.0, 0.1, 0xffe9a8, x, 5 + h * (0.35 + w * 0.3), z + r + 0.02));
  }
  C2.push(box(3.2, 4.2, 0.2, 0x8a6aa8, 0, 5, 3.05), cyl(1.6, 1.6, 0.2, 0x8a6aa8, 0, 9.2, 3.05, 14, PI / 2));
  for (let i = 0; i < 5; i++) C2.push(box(0.9, 1.6, 0.1, 0xffe9a8, -6 + i * 3, 9.6, 3.05));
  K.add(shadeY(C2, 5, 30, 0.85, 1.05), 0, 0, cz + 2);
  K.halos.push([0, 12, cz + 6, 12, 6, 0.18, 0xfff0ff, true]);
  // rainbow arc behind it
  const RB = [0xff9cc6, 0xffc79a, 0xfff0a0, 0xb8f0c0, 0x9fd2ff, 0xc9b2ff];
  RB.forEach((c, i) => K.lit.push(custom(new THREE.TorusGeometry(34 - i * 1.6, 0.8, 4, 40, PI).translate(0, 0, cz - 14), c)));
  // round pastel trees on the far side and sides
  const TREES = [0xff9cc6, 0xc9b2ff, 0x8fe3c4, 0x9fd2ff, 0x7cc95e];
  for (let i = 0; i < 18; i++) {
    const [x, z] = K.around(PB + 6, 22, -4);
    if (z > hd - 2 || Math.abs(x) < HX + 4 && z > -(hd + 6)) continue;
    if (!K.free(x, z, 3)) continue;
    K.claim(x, z, 3);
    const h = K.rnd(6, 10);
    K.add(roundTree(K, h, K.rnd(2.0, 2.8), K.pick(TREES), 0xb07a4a), x, 0, z);
    K.blob(x, 0.03, z, 2.6, 2.4, 0.38);
  }
  // near side (low): a stone lantern pair, flower beds, little crowns of stones
  const nz = hd + PB + 2.6 * ns;
  for (const s of [-1, 1]) {
    K.add([cyl(0.5, 0.6, 0.3, 0xe9e2f7, 0, 0, 0, 8), cyl(0.2, 0.25, 0.8, 0xe9e2f7, 0, 0.3, 0, 8), box(0.8, 0.6, 0.8, 0xfaf6ff, 0, 1.1, 0), cone(0.7, 0.5, 0xb9a0ff, 0, 1.7, 0, 4)], s * hw * 0.55, 0, nz, 0, ns);
    K.lit.push(box(0.5, 0.35, 0.82, 0xfff1c4, s * hw * 0.55, 1.2 * ns, nz));
    K.blob(s * hw * 0.55, 0.03, nz, 0.8 * ns, 0.8 * ns, 0.3);
  }
  for (const [x, z] of [[-hw * 0.85, nz + 1.5], [-hw * 0.15, nz + 2.4], [hw * 0.15, nz + 3.2], [hw * 0.85, nz + 1.2], [-hw * 0.5, nz + 5], [hw * 0.45, nz + 6]]) K.add(flowerClump(K, 0.9, K.pick(FLOWER)), x, 0, z, K.R() * TAU);
  K.flat.push(discBatch(dots));
  cloudLayer(K, [[-22, 24, -(hd + 30), 4], [8, 30, -(hd + 44), 5], [28, 22, -(hd + 34), 3.5], [-36, 20, -(hd + 24), 3.2]], 60, [0xffffff, 0xffeaf6, 0xf0eaff]);
}


export const BACKDROPS = { pizza: PIZZA, dino: DINO, castle: CASTLE };
export const MUSIC = { pizza: 'east_town', dino: 'spirits_forest', castle: 'holy_sanctuary' };
