// CONTRACT (owned by the scenery lane):
//   buildBackdrop(worldKey, arena, root) -> { update(timeSeconds) } | null
// Decorative, non-physics scenery OUTSIDE the arena rail for one world.
// `arena` = { w, d } (centered on 0,0). Add meshes to `root` (the round's root
// group; it is removed and its geometries disposed when the round ends).
//
// How this file keeps the game safe and fast:
//  - No 3D piece inside |x| < w/2+1.2 and |z| < d/2+1.2. Only flat ground bands (y <= 0)
//    start under the rail (w/2+0.5) so there is never a seam between rail and scenery.
//  - The near (+z) side stays LOW: the camera looks over it. Tall pieces live on the far
//    (-z) side and at the far sides, where perspective leans them away from the board.
//  - Nothing sits under the board between y=-6 and y=0 (it would show inside the hole).
//  - Every world merges into a handful of meshes (<= 10 draw calls, < 40k triangles), no
//    lights, no shadow casting: baked blob shadows + vertex-colour AO instead. Canvas
//    textures are procedural and <= 256px. Everything is code-built geometry.
//  - Deterministic: one seeded rng per world + arena size.
//  - Tabletop worlds (bakery, kitchen) move the arena's 600x600 surround plane down to
//    their room floor so the counter/table edge can drop away to a real floor below.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { box, rbox, cyl, cone, ball, torus, capsule, custom, merge } from './geo.js';
import { rng } from './maps.js';
import { patchGround } from '../engine/render.js';

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

// ============================================================== textures (procedural)
const WRAP9 = [[-1, -1], [0, -1], [1, -1], [-1, 0], [0, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
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
const marbleTex = (R) => canvasTex(256, (x, s) => {
  x.fillStyle = '#fdf6f7'; x.fillRect(0, 0, s, s);
  for (let i = 0; i < 12; i++) {
    const cx = R() * s, cy = R() * s, rr = 30 + R() * 70, tone = R() < 0.5 ? '244,222,230' : '232,230,240';
    for (const [ox, oy] of WRAP9) {
      const X = cx + ox * s, Y = cy + oy * s;
      if (X + rr < 0 || X - rr > s || Y + rr < 0 || Y - rr > s) continue;
      const g = x.createRadialGradient(X, Y, 0, X, Y, rr);
      g.addColorStop(0, `rgba(${tone},0.5)`); g.addColorStop(1, `rgba(${tone},0)`);
      x.fillStyle = g; x.fillRect(X - rr, Y - rr, rr * 2, rr * 2);
    }
  }
  for (let v = 0; v < 4; v++) {
    const pts = []; let px = R() * s, py = R() * s, a = R() * TAU;
    for (let k = 0; k < 26; k++) { a += (R() - 0.5) * 0.5; px += Math.cos(a) * 9; py += Math.sin(a) * 9; pts.push([px, py]); }
    const wdt = 1.2 + R() * 1.4, al = 0.16 + R() * 0.16;
    for (const [ox, oy] of WRAP9) {
      x.beginPath();
      pts.forEach(([a1, b1], k) => (k ? x.lineTo(a1 + ox * s, b1 + oy * s) : x.moveTo(a1 + ox * s, b1 + oy * s)));
      x.strokeStyle = `rgba(226,200,212,${al * 0.6})`; x.lineWidth = wdt * 4; x.stroke();
      x.strokeStyle = `rgba(206,176,190,${al})`; x.lineWidth = wdt; x.stroke();
    }
  }
  speckle(x, s, R, 5);
});
const checkerTex = (R, a, b) => canvasTex(128, (x, s) => {
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
    x.fillStyle = (i + j) % 2 ? a : b; x.fillRect(i * s / 2, j * s / 2, s / 2, s / 2);
    const g = x.createLinearGradient(i * s / 2, j * s / 2, i * s / 2 + s / 2, j * s / 2 + s / 2);
    g.addColorStop(0, 'rgba(255,255,255,0.22)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(i * s / 2, j * s / 2, s / 2, s / 2);
  }
  x.strokeStyle = 'rgba(255,255,255,0.55)'; x.lineWidth = 2;
  for (let k = 0; k <= 2; k++) { x.beginPath(); x.moveTo(k * s / 2, 0); x.lineTo(k * s / 2, s); x.stroke(); x.beginPath(); x.moveTo(0, k * s / 2); x.lineTo(s, k * s / 2); x.stroke(); }
  speckle(x, s, R, 6);
});
// Glossy pastel tiles (bakery backsplash).
const tileTex = (R, pal, pattern) => canvasTex(256, (x, s) => {
  const n = 4, t = s / n;
  x.fillStyle = '#ffffff'; x.fillRect(0, 0, s, s);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    x.fillStyle = pal[pattern(i, j)]; x.fillRect(i * t + 3, j * t + 3, t - 6, t - 6);
    const g = x.createLinearGradient(i * t, j * t, i * t + t, j * t + t);
    g.addColorStop(0, 'rgba(255,255,255,0.45)'); g.addColorStop(0.45, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,0.06)');
    x.fillStyle = g; x.fillRect(i * t + 3, j * t + 3, t - 6, t - 6);
  }
  speckle(x, s, R, 4);
});
// White subway tiles (kitchen backsplash).
const subwayTex = (R) => canvasTex(128, (x, s) => {
  x.fillStyle = '#d9d2c8'; x.fillRect(0, 0, s, s);
  const tw = s / 2, th = s / 4;
  for (let j = 0; j < 4; j++) for (let i = -1; i < 3; i++) {
    const ox = (j % 2) * tw / 2, X = i * tw + ox, Y = j * th;
    x.fillStyle = '#fbf9f5'; x.fillRect(X + 2, Y + 2, tw - 4, th - 4);
    const g = x.createLinearGradient(0, Y, 0, Y + th);
    g.addColorStop(0, 'rgba(255,255,255,0.7)'); g.addColorStop(1, 'rgba(160,150,140,0.18)');
    x.fillStyle = g; x.fillRect(X + 2, Y + 2, tw - 4, th - 4);
  }
  speckle(x, s, R, 3);
});
// Floorboards running along the texture's v axis (world z on floors).
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
// Kid's-room wallpaper: soft stripes with little stars.
const wallpaperTex = (R) => canvasTex(128, (x, s) => {
  x.fillStyle = '#e7ddff'; x.fillRect(0, 0, s, s);
  x.fillStyle = '#efe8ff'; for (let i = 0; i < 4; i++) x.fillRect(i * 32, 0, 16, s);
  const star = (cx, cy, r, col) => {
    x.fillStyle = col; x.beginPath();
    for (let i = 0; i <= 10; i++) { const a = -PI / 2 + i * PI / 5, rr = i % 2 ? r * 0.45 : r; x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
    x.fill();
  };
  for (const [cx, cy, c] of [[16, 20, '#ffffff'], [48, 60, '#fff3b8'], [16, 100, '#ffd6e8'], [80, 28, '#d8f6ff'], [112, 76, '#ffffff'], [80, 116, '#ffffff']]) star(cx, cy, 7, c);
  x.fillStyle = 'rgba(255,255,255,0.8)';
  for (const [cx, cy] of [[40, 8], [104, 44], [56, 92], [120, 118], [8, 60], [72, 76]]) { x.beginPath(); x.arc(cx, cy, 2.2, 0, TAU); x.fill(); }
  speckle(x, s, R, 3);
});
const blobTex = () => {
  const t = canvasTex(64, (x, s) => {
    const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(255,255,255,0.62)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, s, s);
  });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
};

// ============================================================== kit
function makeKit(worldKey, arena) {
  let seed = 2166136261;
  for (const ch of worldKey) seed = Math.imul(seed ^ ch.charCodeAt(0), 16777619) >>> 0;
  seed = (seed ^ Math.imul(Math.round(arena.w * 10) + 1, 2654435761) ^ Math.imul(Math.round(arena.d * 10) + 3, 40503)) >>> 0;
  const R = rng(seed);
  const K = {
    hw: arena.w / 2, hd: arena.d / 2, R,
    rnd: (a = 0, b = 1) => a + (b - a) * R(),
    pick: (arr) => arr[Math.floor(R() * arr.length) % arr.length],
    glossy: [], matte: [], flat: [], glass: [], blobs: [], meshes: [], tick: [], occ: [],
    shadow: 0x334433, floorY: 0,
    ns: Math.min(1.15, Math.max(0.68, arena.w / 22)), under: [], lit: [], halos: [],
  };
  // Place an item: a part list, or { s: glossy, m: matte, g: glass, f: flat ground, l: lit } lists.
  K.add = (item, x = 0, y = 0, z = 0, ry = 0, s = 1, rx = 0, rz = 0) => {
    const it = Array.isArray(item) ? { s: item } : item;
    for (const [key, list] of [['s', K.glossy], ['m', K.matte], ['g', K.glass], ['f', K.flat], ['l', K.lit]]) {
      if (it[key]?.length) list.push(...put(it[key], x, y, z, ry, s, rx, rz));
    }
    return K;
  };
  K.blob = (x, y, z, rx, rz = rx, a = 0.3, rot = 0) => K.blobs.push([x, y, z, rx, rz, a, rot]);
  // Random point outside the board by at least minD, within maxD (nearMax on the +z side).
  K.around = (minD, maxD, nearMax = maxD) => {
    for (let k = 0; k < 80; k++) {
      const x = K.rnd(-(K.hw + maxD), K.hw + maxD), z = K.rnd(-(K.hd + maxD), K.hd + nearMax);
      if (Math.abs(x) < K.hw + minD && Math.abs(z) < K.hd + minD) continue;
      return [x, z];
    }
    return [K.hw + maxD, -K.hd];
  };
  K.free = (x, z, r) => K.occ.every(([ox, oz, or]) => Math.hypot(ox - x, oz - z) > or + r);
  K.claim = (x, z, r) => K.occ.push([x, z, r]);
  return K;
}

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

function blobMesh(blobs, color) {
  const n = blobs.length, pos = new Float32Array(n * 18), uv = new Float32Array(n * 12), col = new Float32Array(n * 24);
  const cn = [[-1, -1], [-1, 1], [1, 1], [-1, -1], [1, 1], [1, -1]];
  blobs.forEach(([x, y, z, rx, rz, a, rot], i) => {
    const cs = Math.cos(rot), sn = Math.sin(rot);
    cn.forEach(([u, v], k) => {
      const j = i * 6 + k, lx = u * rx, lz = v * rz;
      pos[j * 3] = x + lx * cs + lz * sn; pos[j * 3 + 1] = y; pos[j * 3 + 2] = z - lx * sn + lz * cs;
      uv[j * 2] = (u + 1) / 2; uv[j * 2 + 1] = (v + 1) / 2;
      col[j * 4] = col[j * 4 + 1] = col[j * 4 + 2] = 1; col[j * 4 + 3] = a;
    });
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.BufferAttribute(col, 4));
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({
    map: blobTex(), color, transparent: true, depthWrite: false, vertexColors: true, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  }));
  m.name = 'blobs'; m.renderOrder = 1;
  return m;
}

// Soft additive glows: [x, y, z, rx, ry, alpha, colour, upright]. Upright quads face the
// camera side (+z); the others lie on the ground (light pools under lamps).
function haloMesh(list) {
  const n = list.length, pos = new Float32Array(n * 18), uv = new Float32Array(n * 12), col = new Float32Array(n * 24);
  const cn = [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]];
  list.forEach(([x, y, z, rx, ry, a, c, up], i) => {
    _c.set(c);
    cn.forEach(([u, v], k) => {
      const j = i * 6 + k;
      if (up) { pos[j * 3] = x + u * rx; pos[j * 3 + 1] = y + v * ry; pos[j * 3 + 2] = z; }
      else { pos[j * 3] = x + u * rx; pos[j * 3 + 1] = y; pos[j * 3 + 2] = z - v * ry; }
      uv[j * 2] = (u + 1) / 2; uv[j * 2 + 1] = (v + 1) / 2;
      col[j * 4] = _c.r; col[j * 4 + 1] = _c.g; col[j * 4 + 2] = _c.b; col[j * 4 + 3] = a;
    });
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.BufferAttribute(col, 4));
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({
    map: blobTex(), transparent: true, depthWrite: false, vertexColors: true, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
  }));
  m.name = 'glow'; m.renderOrder = 2;
  return m;
}

function finish(K, root) {
  const group = new THREE.Group();
  group.name = 'backdrop';
  const mk = (parts, mat, name, recv = true) => {
    if (!parts.length) return;
    const m = new THREE.Mesh(merge(parts), mat);
    m.name = name; m.receiveShadow = recv;
    group.add(m);
  };
  mk(K.glossy, new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 30, specular: 0x242424 }), 'glossy');
  mk(K.matte, new THREE.MeshLambertMaterial({ vertexColors: true }), 'matte');
  mk(K.flat, patchGround(new THREE.MeshLambertMaterial({ vertexColors: true })), 'ground');
  mk(K.under, patchGround(new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 30, specular: 0x242424 })), 'under');
  mk(K.glass, new THREE.MeshPhongMaterial({ vertexColors: true, transparent: true, opacity: 0.32, shininess: 120, specular: 0xffffff, depthWrite: false }), 'glass', false);
  mk(K.lit, new THREE.MeshBasicMaterial({ vertexColors: true }), 'lit', false);
  if (K.blobs.length) group.add(blobMesh(K.blobs, K.shadow));
  if (K.halos.length) group.add(haloMesh(K.halos));
  for (const m of K.meshes) group.add(m);
  root.add(group);
  const ticks = K.tick;
  return { update(t) { for (const f of ticks) f(t); } };
}

// The arena's big surround plane (600x600) - found by size, not by position in the tree.
function surroundOf(root) {
  let s = null;
  root.traverse((m) => { const p = m.isMesh && m.geometry?.parameters; if (p && p.width >= 300 && p.height >= 300) s = m; });
  return s;
}

// ============================================================== shared scenery pieces
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
// Phong material whose vertices flap (gulls, butterflies): attribute fl = (weight, phase).
function flapMaterial(uTime, rate, amp) {
  const mat = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 20, specular: 0x111111 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 fl;\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        transformed.y += fl.x * sin(uTime * ${rate.toFixed(2)} + fl.y) * ${amp.toFixed(2)};`);
  };
  mat.customProgramCacheKey = () => 'backdrop-flap-' + rate;
  return mat;
}
function setFlap(parts, fn, phase) {
  for (const g of parts) {
    const p = g.attributes.position, a = new Float32Array(p.count * 2);
    for (let i = 0; i < p.count; i++) { a[i * 2] = fn(p.getX(i), p.getY(i), p.getZ(i)); a[i * 2 + 1] = phase; }
    g.setAttribute('fl', new THREE.BufferAttribute(a, 2));
  }
  return parts;
}
// Duplicate flat parts with reversed winding so both faces render with a FrontSide material.
function twoSided(parts) {
  const out = [];
  for (const g of [parts].flat(Infinity)) {
    const b = g.clone(), p = b.attributes.position, n = b.attributes.normal;
    for (let i = 0; i + 2 < p.count; i += 3) {
      for (const att of Object.values(b.attributes)) {
        const k = att.itemSize;
        for (let c = 0; c < k; c++) { const t = att.array[(i + 1) * k + c]; att.array[(i + 1) * k + c] = att.array[(i + 2) * k + c]; att.array[(i + 2) * k + c] = t; }
      }
    }
    for (let i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i));
    out.push(g, b);
  }
  return out;
}
// Butterflies over the flowers: one mesh; each one loops and flaps in the vertex shader.
function butterflies(K, spots) {
  const parts = [];
  for (const [x, y, z] of spots) {
    const c = K.pick([0xffffff, 0xffd23f, 0xff9ec8, 0x9fd2ff, 0xffb05a, 0xc9a8ff]), ph = K.R() * TAU;
    const b = [cyl(0.035, 0.035, 0.4, 0x4a3a4a, 0, 0, 0, 4, 0, PI / 2)];
    for (const sd of [-1, 1]) {
      b.push(tris([[0.05, 0.02, 0.02 * sd], [0.36, 0.02, 0.5 * sd], [-0.03, 0.02, 0.62 * sd]], c));
      b.push(tris([[-0.02, 0.02, 0.02 * sd], [-0.03, 0.02, 0.5 * sd], [-0.3, 0.02, 0.36 * sd]], c));
    }
    setFlap(b, (px, py, pz) => clamp01(Math.abs(pz) / 0.62), ph);
    parts.push(...put(b, x, y, z, K.R() * TAU));
  }
  const uTime = { value: 0 };
  const mat = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 20, specular: 0x111111 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 fl;\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float bph = fl.y;
        transformed.x += sin(uTime * 0.6 + bph) * 1.3 + sin(uTime * 1.7 + bph * 2.0) * 0.25;
        transformed.z += cos(uTime * 0.45 + bph * 1.3) * 0.7;
        transformed.y += sin(uTime * 2.2 + bph) * 0.18 + fl.x * sin(uTime * 15.0 + bph) * 0.28;`);
  };
  mat.customProgramCacheKey = () => 'backdrop-butterflies';
  const m = new THREE.Mesh(merge(parts), mat);
  m.name = 'butterflies'; m.frustumCulled = false;
  K.meshes.push(m);
  K.tick.push((t) => { uTime.value = t; });
}
// Simple bird seen from above, flying along +x. Wings flap via setFlap.
function gull() {
  const body = [egg(0.55, 0.24, 0.26, WHITE), ballC(0.2, WHITE, 0.5, 0.12, 0, 1), custom(new THREE.ConeGeometry(0.07, 0.3, 5).rotateZ(-PI / 2).translate(0.82, 0.14, 0), 0xffa53a)];
  const wing = (s) => tris([[-0.25, 0.05, 0], [0.25, 0.05, 0], [-0.05, 0.22, s * 1.5], [0.25, 0.05, 0], [0.05, 0.22, s * 0.9], [-0.05, 0.22, s * 1.5]], 0xf2f4f7);
  const tip = (s) => tris([[-0.05, 0.22, s * 1.5], [0.05, 0.22, s * 0.9], [-0.12, 0.26, s * 1.85]], 0x4a4f5a);
  return [...body, wing(1), wing(-1), tip(1), tip(-1)];
}

// ============================================================== BAKERY
function bakery(K) {
  const { hw, hd } = K;
  const FL = -9, TOP = 26;
  const X0 = hw + 0.5, Z0 = hd + 0.5;
  const CX = hw + 12, CZ = hd + 3.6, BZ = -(hd + 6), RX = hw + 22, SZ = hd + 16;
  const FZ = CZ - 0.75;   // cabinet face plane
  K.floorY = FL; K.shadow = 0x8c4a64;
  const G = K.glossy, M = K.matte;
  const SLAB = 0xf8eff1, BODY = 0x9edcc6, DOOR = 0xc8f1df, DOOR2 = 0xb2e8d2, KICK = 0x5f9e88;
  const WALL = 0xfff0e8, WAIN = 0xf8c6d6, CAP = 0xff9fc2, SHELF = 0xfff7f2;

  // Marble counter top around the board: flush with it, starts under the rail.
  const top = [
    rectXZ(-CX, CX, Z0, CZ, 0, 0xffffff, 10, 2), rectXZ(-CX, CX, BZ, -Z0, 0, 0xffffff, 10, 5),
    rectXZ(X0, CX, -Z0, Z0, 0, 0xffffff, 3, 10), rectXZ(-CX, -X0, -Z0, Z0, 0, 0xffffff, 3, 10),
  ];
  recolor(top, (x, y, z, c) => c.multiplyScalar(0.8 + 0.2 * smooth(BZ, BZ + 3.5, z)));
  K.meshes.push(texMesh(top, marbleTex(K.R), 16, { patched: true, phong: true, name: 'marble', shininess: 60 }));
  // Rounded slab edge + the cabinet run below it (a shell: nothing under the board).
  G.push(rbox(2 * CX + 0.5, 0.75, 1.1, SLAB, 0, -0.76, CZ - 0.5, 0.32));
  for (const s of [-1, 1]) G.push(rbox(1.1, 0.75, CZ - BZ + 0.1, SLAB, s * (CX - 0.5), -0.76, (CZ + BZ) / 2, 0.32));
  const cab = [box(2 * CX - 0.4, -0.76 - (FL + 1), 0.5, BODY, 0, FL + 1, FZ - 0.25), box(2 * CX - 0.4, 1.0, 0.5, KICK, 0, FL, FZ - 0.75)];
  for (const s of [-1, 1]) cab.push(box(0.5, -0.76 - FL, CZ - BZ - 1, BODY, s * (CX - 0.75), FL, (FZ + BZ) / 2));
  const n = Math.max(3, Math.round((2 * CX - 1.6) / 4.4)), dw = (2 * CX - 1.6) / n;
  for (let i = 0; i < n; i++) {
    const x = -CX + 0.8 + dw * (i + 0.5);
    cab.push(box(dw - 0.4, 1.5, 0.2, DOOR, x, -2.6, FZ + 0.1), cyl(0.11, 0.11, dw * 0.32, GOLD, x, -1.85, FZ + 0.32, 8, 0, PI / 2));
    cab.push(box(dw - 0.4, -3.05 - (FL + 1.3), 0.2, DOOR, x, FL + 1.3, FZ + 0.1), box(dw - 1.3, -3.05 - (FL + 1.3) - 0.9, 0.12, DOOR2, x, FL + 1.75, FZ + 0.24));
    cab.push(ballC(0.22, GOLD, x + (i % 2 ? -1 : 1) * (dw / 2 - 0.75), -3.75, FZ + 0.42, 1));
  }
  G.push(...shadeY(cab, FL, 0, 0.8, 1.0));

  // Room: checker floor, walls with a pink wainscot, a cut-away top trim.
  const floor = [
    rectXZ(-RX, RX, FZ - 0.5, hd + 70, FL, 0xffffff),
    rectXZ(CX - 1, RX, BZ, FZ - 0.5, FL, 0xffffff), rectXZ(-RX, -(CX - 1), BZ, FZ - 0.5, FL, 0xffffff),
  ];
  K.meshes.push(texMesh(floor, checkerTex(K.R, '#ffcfdd', '#fff7ef'), 7, { name: 'floor' }));
  for (let x = -CX + 1; x <= CX - 1; x += 2.4) K.blob(x, FL + 0.03, FZ + 0.7, 2.3, 1.5, 0.42);
  for (const s of [-1, 1]) {
    for (let z = BZ + 1; z <= FZ; z += 2.4) K.blob(s * (CX - 0.4), FL + 0.03, z, 1.6, 2.3, 0.38);
    for (let z = BZ + 1; z <= SZ; z += 3) K.blob(s * (RX - 0.6), FL + 0.03, z, 1.6, 2.6, 0.3);
  }
  const wall = boxS(2 * RX + 2, TOP - FL, 1, WALL, 0, FL, BZ - 0.5, 1, 8, 1);
  shadeY(wall, FL, TOP, 0.84, 1.04);
  M.push(wall);
  for (const s of [-1, 1]) {
    const sw = boxS(1, TOP - FL, SZ - BZ + 1, WALL, s * (RX + 0.5), FL, (SZ + BZ - 1) / 2, 1, 8, 1);
    shadeY(sw, FL, TOP, 0.78, 0.98);
    M.push(sw);
    M.push(box(RX - CX + 0.5, 6.5, 0.3, WAIN, s * (CX + RX) / 2, FL, BZ + 0.15));
    M.push(box(0.3, 6.5, SZ - BZ, WAIN, s * (RX - 0.15), FL, (SZ + BZ) / 2));
    G.push(box(RX - CX + 0.5, 0.4, 0.5, WHITE, s * (CX + RX) / 2, FL + 6.5, BZ + 0.25));
    G.push(box(0.5, 0.4, SZ - BZ, WHITE, s * (RX - 0.25), FL + 6.5, (SZ + BZ) / 2));
    G.push(box(RX - CX + 0.5, 0.8, 0.45, WHITE, s * (CX + RX) / 2, FL, BZ + 0.22));
    G.push(box(0.45, 0.8, SZ - BZ, WHITE, s * (RX - 0.22), FL, (SZ + BZ) / 2));
    G.push(box(1.7, 0.9, SZ - BZ + 1.7, CAP, s * (RX + 0.5), TOP, (SZ + BZ - 1) / 2));
  }
  G.push(box(2 * RX + 2.8, 0.9, 1.7, CAP, 0, TOP, BZ - 0.5));
  const mhX = CX + Math.min(5, (RX - CX) * 0.5);
  G.push(custom(new THREE.CircleGeometry(0.95, 14, 0, PI).translate(mhX, FL, BZ + 0.47), 0x3a2630));
  G.push(custom(new THREE.TorusGeometry(0.95, 0.09, 4, 14, PI).translate(mhX, FL, BZ + 0.47), WHITE));
  K.add([custom(new THREE.ExtrudeGeometry(gableShape(0.9, 0.55), { depth: 0.45, bevelEnabled: false }).rotateX(-PI / 2), 0xffd84a)], mhX + 1.6, FL, BZ + 1.4, 0.5);
  G.push(box(2 * RX, 0.6, 0.6, WHITE, 0, TOP - 0.6, BZ + 0.3));

  // Backsplash of pastel tiles.
  const pal = ['#ffd2e0', '#d2f3e5', '#fff6ec', '#ffeec2'];
  K.meshes.push(texMesh([panel(2 * CX, 7.6, 0xffffff, 0, 0, BZ + 0.04)], tileTex(K.R, pal, (i, j) => ((i + j) % 2 ? 2 : [0, 1, 0, 3][(i + 3 * j) % 4])), 4.4, { phong: true, name: 'tiles', shininess: 70 }));
  G.push(box(2 * CX + 0.4, 0.4, 0.45, WHITE, 0, 7.6, BZ + 0.22));

  // Shelves with jars, cake stands, mugs and plants; a clock in the middle.
  const span = Math.min(CX - 1.5, hw + 9);
  for (const [y, gapMid] of [[8.8, 3.6], [13.8, 3.6]]) {
    for (const s of [-1, 1]) {
      const a = s > 0 ? gapMid : -span, b = s > 0 ? span : -gapMid;
      G.push(box(b - a, 0.38, 2.5, SHELF, (a + b) / 2, y, BZ + 1.25));
      for (const x of [a + 0.7, b - 0.7]) G.push(box(0.3, 1.1, 1.7, WHITE, x, y - 1.1, BZ + 0.85));
      let x = a + 0.9;
      while (x < b - 1.2) {
        const it = shelfItem(K);
        if (x + it.w > b - 0.6) break;
        K.add(it, x + it.w / 2, y + 0.38, BZ + 1.3, K.rnd(-0.3, 0.3));
        x += it.w + K.rnd(0.25, 0.8);
      }
    }
  }
  K.add(wallClock(0xff8fb8), 0, 11.4, BZ + 0.05);

  // Pendant lamps over the back counter.
  const nl = Math.max(2, Math.round((2 * hw) / 9));
  for (let i = 0; i < nl; i++) {
    const x = -(hw - 2.5) + (2 * hw - 5) * (i / (nl - 1));
    K.add(pendant([0xff8fb8, 0x8fdcc4, 0xffd36e][i % 3], (TOP - 7.8) / 0.85 - 2.2), x, 7.8, -(hd + 3.4), 0, 0.85);
    G.push(cyl(0.7, 0.45, 0.4, WHITE, x, TOP - 0.4, -(hd + 3.4), 12));
  }

  // Counter-top pieces (beyond the rail, profile toward the camera).
  K.add(standMixer(0x9fe0cf), hw + 6.4, 0, -hd * 0.42, PI, 1.25);
  K.blob(hw + 6.6, 0.02, -hd * 0.42, 3.4, 2.4, 0.38);
  K.add(flourSack(K), -(hw + 5.8), 0, -hd * 0.28, 0.4, 1.05);
  K.blob(-(hw + 5.8), 0.02, -hd * 0.28, 2.8, 2.6, 0.38);
  K.add(rollingPin(), -(hw + 5.2), 0, hd * 0.45, 1.25, 1.0);
  K.blob(-(hw + 5.2), 0.02, hd * 0.45, 1.6, 3.4, 0.25, 1.25);
  K.add(mixingBowls(), hw + 5.8, 0, hd * 0.38, 0.3, 1.0);
  K.blob(hw + 5.8, 0.02, hd * 0.38, 2.6, 2.6, 0.3);
  K.add(eggCarton(), hw + 9.0, 0, hd * 0.02, -0.25, 1.0);
  K.blob(hw + 9.0, 0.02, hd * 0.02, 2.2, 1.6, 0.25, -0.25);
  const backZ = -(hd + 3.95);
  const row = [
    () => [cakeDome(K, 0xffb6cf, 0xfffaf4), 4.6, 2.5], () => [{ s: canisters() }, 6.4, 3.0], () => [candyJarBig(K), 3.2, 1.6],
    () => [cakeDome(K, 0xffe3a6, 0xc98a5b), 4.6, 2.5], () => [{ s: crock() }, 3.0, 1.6], () => [breadBoard(K), 5.4, 2.6],
    () => [cakeDome(K, 0xc9f0e0, 0xff9ec8), 4.6, 2.5], () => [{ s: [...plates(K), ...put(plates(K), 2.5, 0, 0.3)] }, 5.0, 2.4],
  ];
  let rx = -(CX - 1.2), ri = Math.floor(K.R() * row.length);
  while (rx < CX - 2) {
    const [it, w, br] = row[ri++ % row.length]();
    if (rx + w > CX - 0.8) break;
    K.add(it, rx + w / 2, 0, backZ - K.rnd(0, 0.45), K.rnd(-0.3, 0.3));
    K.blob(rx + w / 2, 0.02, backZ, br + 0.4, 2.2, 0.32);
    rx += w + K.rnd(0.6, 1.6);
  }

  // Near counter strip (seen at every level start): low, flat pieces only.
  K.add(teaTowel(), -hw * 0.5, 0, hd + 2.4, 0.12, K.ns);
  K.blob(-hw * 0.5, 0.02, hd + 2.4, 1.7 * K.ns, 1.1 * K.ns, 0.18, 0.12);
  K.add(pipingBag(), hw * 0.45, 0, hd + 2.5, -0.5, K.ns);
  K.blob(hw * 0.45, 0.02, hd + 2.5, 1.9 * K.ns, 0.9 * K.ns, 0.2, -0.5);

  // Floor below the counter: a rug runner, cake boxes and a bread crate.
  const rw = Math.min(hw * 1.3, 14);
  M.push(rectXZ(-rw, rw, FZ + 1.6, FZ + 5.2, FL + 0.03, 0xff9ec0), rectXZ(-rw + 0.35, rw - 0.35, FZ + 1.95, FZ + 4.85, FL + 0.05, 0xfff1f5));
  for (let x = -rw + 1.2; x < rw - 0.8; x += 1.6) M.push(disc(0.35, 0xffc2d6, x, FL + 0.07, FZ + 3.4, 10));
  K.add(cakeBoxes(), -(CX - 3.2), FL, FZ + 4.6, 0.3);
  K.blob(-(CX - 3.2), FL + 0.03, FZ + 4.6, 3.0, 2.6, 0.38);
  K.add(breadCrate(K), CX - 3.5, FL, FZ + 5.5, -0.35);
  K.blob(CX - 3.5, FL + 0.03, FZ + 5.5, 3.2, 2.4, 0.38, -0.35);
  M.push(ringXZ(2.0, 3.2, 0xff9ec0, -(CX - 4), FL + 0.03, FZ + 6, 28), disc(2.0, 0xffe7ef, -(CX - 4), FL + 0.03, FZ + 6, 28));
}

function pipingBag() {
  // A piping bag of pink frosting lying on the counter, its star tip and a little swirl.
  const p = [custom(new THREE.ConeGeometry(0.55, 2.6, 14).rotateZ(PI / 2).translate(0, 0.5, 0), 0xffb6cf),
    egg(0.6, 0.48, 0.55, 0xffb6cf, 1.45, 0.5, 0, 12, 8), custom(new THREE.TorusGeometry(0.36, 0.1, 6, 10).rotateY(PI / 2).translate(1.95, 0.5, 0), 0xffffff),
    custom(new THREE.ConeGeometry(0.16, 0.42, 8).rotateZ(PI / 2).translate(-1.45, 0.5, 0), CHROME)];
  p.push(...put([custom(new THREE.TorusGeometry(0.32, 0.13, 6, 14).rotateX(PI / 2), 0xffc7da), custom(new THREE.TorusGeometry(0.2, 0.11, 6, 12).rotateX(PI / 2).translate(0, 0.17, 0), 0xffd3e2),
    custom(new THREE.ConeGeometry(0.16, 0.3, 8).translate(0, 0.38, 0), 0xffe0ea)], -2.2, 0.12, 0.35));
  return p;
}
function teaTowel() {
  return [box(2.6, 0.14, 1.5, 0xfff7f9, 0, 0, 0), box(2.62, 0.02, 0.22, 0xff8fb8, 0, 0.14, -0.45), box(2.62, 0.02, 0.22, 0xff8fb8, 0, 0.14, 0.45),
    rod([-0.6, 0.32, 0.95], [1.6, 0.26, 0.2], 0.08, 0.1, 0xd9a066), egg(0.42, 0.12, 0.3, 0xd9a066, -0.95, 0.3, 1.1)];
}
function candyJarBig(K) {
  const j = candyJar(K);
  return { s: put(j.s, 0, 0, 0, 0, 1.45), g: put(j.g, 0, 0, 0, 0, 1.45) };
}
function breadBoard(K) {
  const B = 0xe8a95e, BD = 0xc8843f;
  const p = [rbox(4.8, 0.35, 2.6, 0xd9a066, 0, 0, 0, 0.12), capsule(0.42, 3.0, B, -0.3, 0.75, -0.55, PI / 2), capsule(0.38, 2.6, BD, 0.2, 0.7, 0.45, PI / 2)];
  for (let i = 0; i < 4; i++) p.push(custom(new THREE.SphereGeometry(1, 6, 4).scale(0.32, 0.08, 0.12).rotateY(0.6).translate(-1.5 + i * 0.85, 1.15, -0.55), 0xfff3e0));
  p.push(dome(0.95, 0.7, 0.8, B, 1.6, 0.35, 0.0, 12, 4));
  return { s: p };
}
function cakeBoxes() {
  const p = [], cols = [0xffc2d6, 0xc9f0e0, 0xfff0c2];
  let y = 0;
  for (let i = 0; i < 3; i++) {
    const w = 3.0 - i * 0.5, h = 1.5 - i * 0.15, ry = (i - 1) * 0.25;
    p.push(box(w, h, w, cols[i], 0, y, 0, ry), box(w + 0.02, h + 0.02, 0.28, 0xff8fb8, 0, y, 0, ry), box(0.28, h + 0.02, w + 0.02, 0xff8fb8, 0, y, 0, ry));
    y += h;
  }
  p.push(torus(0.35, 0.1, 0xff6f9c, -0.25, y + 0.25, 0, 0, 10), torus(0.35, 0.1, 0xff6f9c, 0.25, y + 0.25, 0, 0, 10));
  return p;
}
function shelfItem(K) {
  const k = Math.floor(K.R() * 8);
  if (k === 0 || k === 1) return candyJar(K);
  if (k === 2) { const c = K.pick(PASTEL); return { s: canister(c, K.rnd(1.6, 2.4), 0.75), w: 1.8 }; }
  if (k === 3) return { s: plates(K), w: 2.3 };
  if (k === 4) return { s: [...mug(K.pick(PASTEL), -0.65), ...mug(K.pick(PASTEL), 0.75)], w: 2.6 };
  if (k === 5) return { s: pottedPlant(K, 0.6), w: 1.6 };
  if (k === 6) return { s: books(K), w: 1.9 };
  return { s: teapot(K.pick(PASTEL)), w: 2.4 };
}
function candyJar(K) {
  const s = [cyl(0.74, 0.74, 1.45, K.pick([0xff8fb8, 0xffd36e, 0x9fe0cf, 0xc9b2ff]), 0, 0.05, 0, 12)];
  for (let i = 0; i < 5; i++) s.push(ballC(0.27, K.pick(FLOWER), K.rnd(-0.4, 0.4), 1.62, K.rnd(-0.4, 0.4), 0));
  s.push(cyl(0.95, 0.95, 0.3, K.pick(PASTEL), 0, 2.0, 0, 12), ballC(0.22, GOLD, 0, 2.52, 0, 1));
  return { s, g: [cyl(0.88, 0.88, 2.0, 0xe8f6ff, 0, 0, 0, 14)], w: 2.0 };
}
function canister(c, h, r = 0.9) {
  return [cyl(r, r, h, c, 0, 0, 0, 14), cyl(r + 0.02, r + 0.02, 0.55, WHITE, 0, h * 0.42, 0, 14),
    cyl(r + 0.06, r + 0.06, 0.3, WHITE, 0, h, 0, 14), ballC(r * 0.28, GOLD, 0, h + 0.5, 0, 1)];
}
function canisters() {
  return [...put(canister(0xff9ec8, 3.0, 1.05), -2.3, 0, 0), ...put(canister(0x9fe6cc, 2.4, 0.9), 0, 0, 0.3), ...put(canister(0xffe27a, 1.8, 0.75), 1.9, 0, 0.5)];
}
function plates(K) {
  const out = [], a = K.pick(PASTEL), b = WHITE;
  for (let i = 0; i < 5; i++) out.push(cyl(1.08, 0.82, 0.17, i % 2 ? a : b, 0, i * 0.18, 0, 16));
  return out;
}
function mug(c, x = 0) {
  return [cyl(0.55, 0.5, 1.15, c, x, 0, 0, 12), torus(0.32, 0.09, c, x + 0.6, 0.6, 0, 0, 10), disc(0.48, 0x7a4a32, x, 1.1, 0, 12)];
}
function pottedPlant(K, s = 1) {
  const p = [cyl(0.62 * s, 0.46 * s, 0.9 * s, 0xe9895f, 0, 0, 0, 10), cyl(0.68 * s, 0.68 * s, 0.22 * s, 0xf09a70, 0, 0.82 * s, 0, 10)];
  const leaves = [];
  for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU + K.R(); leaves.push(ballC(0.42 * s, 0x5cc46b, Math.cos(a) * 0.4 * s, 1.35 * s + K.R() * 0.3 * s, Math.sin(a) * 0.4 * s, 1)); }
  leaves.push(ballC(0.5 * s, 0x6fd07a, 0, 1.75 * s, 0, 1));
  shadeY(leaves, 0.9 * s, 2.2 * s, 0.7, 1.12);
  return p.concat(leaves);
}
function books(K) {
  const out = []; let x = -0.75;
  for (let i = 0; i < 4; i++) { const w = K.rnd(0.3, 0.45), h = K.rnd(1.5, 2.1); out.push(box(w, h, 1.4, K.pick([0xff8fa8, 0x8fc8ff, 0xffd36e, 0x9fe0b4, 0xc9a8ff]), x + w / 2, 0, 0)); x += w + 0.04; }
  return out;
}
function teapot(c) {
  return [egg(0.95, 0.75, 0.95, c, 0, 0.75, 0, 14, 10), rod([0.7, 0.7, 0], [1.45, 1.35, 0], 0.22, 0.1, c), torus(0.42, 0.1, c, -0.95, 0.85, 0, 0, 10),
    egg(0.5, 0.2, 0.5, c, 0, 1.45, 0, 10, 6), ballC(0.15, GOLD, 0, 1.75, 0, 1)];
}
function wallClock(col) {
  const p = [vdisc(2.0, WHITE, 0, 0, 0.3, 28), torus(2.05, 0.24, col, 0, 0, 0.3, 0, 28), ballC(0.18, INK, 0, 0, 0.42, 1)];
  for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; p.push(box(0.12, 0.3, 0.05, INK, Math.cos(a) * 1.65, Math.sin(a) * 1.65 - 0.15, 0.32)); }
  p.push(custom(new THREE.BoxGeometry(0.16, 1.1, 0.06).translate(0, 0.5, 0.36).rotateZ(-0.6), INK));
  p.push(custom(new THREE.BoxGeometry(0.12, 1.55, 0.06).translate(0, 0.72, 0.4).rotateZ(1.9), INK));
  return p;
}
function pendant(col, cord) {
  return [
    lathe([[1.9, 0], [1.78, 0.35], [1.25, 1.15], [0.6, 1.75], [0.24, 1.95], [0.24, 2.25]], col, 18),
    torus(1.88, 0.1, GOLD, 0, 0.02, 0, PI / 2, 24), ballC(0.55, 0xfff4cf, 0, 0.2, 0, 1),
    cyl(0.06, 0.06, cord, 0x6b5560, 0, 2.2, 0, 5),
  ];
}
function standMixer(col) {
  return [
    rbox(4.4, 0.7, 2.7, col, -0.2, 0, 0, 0.3), rbox(1.5, 4.3, 1.9, col, -1.55, 0.4, 0, 0.55),
    capsule(1.0, 2.7, col, 0.15, 4.75, 0, PI / 2),
    cyl(1.06, 1.06, 0.32, CHROME, 1.3, 4.75, 0, 18, 0, PI / 2), cyl(0.42, 0.42, 0.3, CHROME, 2.5, 4.75, 0, 12, 0, PI / 2),
    lathe([[0.75, 0], [1.15, 0.15], [1.5, 0.9], [1.65, 1.7], [1.68, 2.1], [1.5, 2.1], [1.4, 1.7], [1.1, 0.7], [0, 0.45]], CHROME, 18, 0.35, 0.7, 0),
    cyl(0.13, 0.13, 1.5, CHROME_D, 0.35, 2.3, 0, 6), egg(0.55, 0.7, 0.14, CHROME_D, 0.35, 2.15, 0),
    ballC(0.28, CHROME, -1.55, 3.7, 0.98, 1),
  ];
}
function flourSack(K) {
  const B = 0xead6ae, BAND = 0x8fb7e8;
  const p = [
    lathe([[0, 0], [1.6, 0.02], [2.05, 0.5], [2.2, 1.6], [2.2, 1.95]], B, 16),
    lathe([[2.2, 1.95], [2.18, 2.6]], BAND, 16),
    lathe([[2.18, 2.6], [2.05, 2.8], [1.5, 3.7], [1.05, 4.15], [1.2, 4.45], [1.45, 4.7], [1.25, 4.8]], B, 16),
    dome(1.25, 0.55, 1.25, WHITE, 0, 4.55, 0, 14, 4), torus(1.08, 0.13, 0xa0703f, 0, 4.2, 0, PI / 2, 16),
    rod([0.3, 4.6, 0.2], [1.8, 6.0, 1.0], 0.12, 0.12, 0xd9a066), egg(0.5, 0.25, 0.5, CHROME, 0.5, 4.95, 0.3),
  ];
  jitter(p.slice(0, 3), K.R, 0.08);
  p.push(...put([disc(1.6, WHITE, 0, 0.02, 0, 12, 1.4, 0.8)], 1.8, 0, 2.0, 0.6));
  return p;
}
function rollingPin() {
  const W = 0xe8b77f, WD = 0xc98f55;
  return [
    flat(5.5, 4.2, 0xf3d9b5, 0, 0.012, 0), dome(2.6, 0.18, 1.9, 0xf6dfbd, 0, 0, 0, 16, 3),
    cyl(0.62, 0.62, 5.6, W, 0, 0.8, 0, 16, 0, PI / 2), cyl(0.24, 0.24, 1.5, WD, 3.4, 0.8, 0, 8, 0, PI / 2),
    cyl(0.24, 0.24, 1.5, WD, -3.4, 0.8, 0, 8, 0, PI / 2), ballC(0.32, WD, 4.2, 0.8, 0, 1), ballC(0.32, WD, -4.2, 0.8, 0, 1),
    torus(0.55, 0.1, 0xff8fb8, 1.6, 0.3, 1.4, PI / 2, 12), torus(0.45, 0.1, 0x8fdcc4, -1.8, 0.3, -1.3, PI / 2, 12),
  ];
}
function mixingBowls() {
  const bowl = (r, c) => lathe([[r * 0.35, 0], [r * 0.6, 0.05], [r * 0.9, 0.5 * r], [r, 0.85 * r], [r * 0.9, 0.85 * r], [r * 0.8, 0.55 * r], [0, 0.2 * r]], c, 18);
  return [bowl(2.1, 0xff9ec8), ...put([bowl(1.5, 0xffe27a)], 2.4, 0, -1.6), ...put([bowl(1.1, 0x9fd2ff)], -1.9, 0, 1.6),
    rod([0.9, 1.5, 0.2], [3.6, 0.3, 1.6], 0.12, 0.12, 0xff8fb8), egg(0.55, 0.32, 0.9, CHROME, 0.1, 1.95, -0.3)];
}
function eggCarton() {
  const p = [box(3.6, 0.7, 2.4, 0xd9c3a5, 0, 0, 0)];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) p.push(egg(0.42, 0.55, 0.42, (i + j) % 2 ? 0xfff3e2 : 0xf2cfa3, -1.15 + i * 1.15, 0.85, -0.55 + j * 1.1, 10, 7));
  return p;
}
function cakeDome(K, cakeCol, frost) {
  const s = [
    lathe([[1.0, 0], [1.0, 0.15], [0.32, 0.3], [0.22, 1.4], [0.5, 1.55], [2.15, 1.62], [2.15, 1.78], [0, 1.8]], WHITE, 20),
    cyl(1.45, 1.45, 1.3, cakeCol, 0, 1.8, 0, 18), cyl(1.52, 1.52, 0.3, frost, 0, 3.08, 0, 18),
  ];
  for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU; s.push(egg(0.2, 0.42, 0.2, frost, Math.cos(a) * 1.48, 2.85, Math.sin(a) * 1.48, 6, 4)); }
  for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU + 0.3; s.push(ballC(0.22, 0xf0263f, Math.cos(a) * 0.9, 3.62, Math.sin(a) * 0.9, 1)); }
  s.push(ballC(0.3, GOLD, 0, 5.75, 0, 1));
  const g = [lathe([[2.0, 1.8], [2.0, 3.3], [1.75, 4.5], [1.1, 5.2], [0.25, 5.45], [0, 5.46]], 0xeef8ff, 22)];
  return { s, g };
}
function crock() {
  return [
    lathe([[0, 0], [1.0, 0], [1.15, 0.4], [1.15, 2.4], [1.25, 2.6], [1.05, 2.6], [1.0, 2.3], [0, 2.3]], 0xfff0e6, 16),
    rod([0.2, 2.0, 0.1], [0.6, 5.6, 0.4], 0.1, 0.1, 0xd9a066), egg(0.3, 0.5, 0.14, 0xd9a066, 0.65, 5.9, 0.42),
    rod([-0.2, 2.0, 0], [-0.9, 5.4, -0.2], 0.1, 0.1, 0xff8fb8), egg(0.38, 0.75, 0.38, CHROME, -0.98, 5.9, -0.22, 10, 7),
    rod([0, 2.0, -0.2], [0.1, 5.2, -0.9], 0.1, 0.1, 0x8fdcc4), box(0.7, 0.9, 0.08, 0xffe27a, 0.1, 5.1, -0.95),
  ];
}
function breadCrate(K) {
  const W = 0xd6a46c, B = 0xe8a95e, BD = 0xc8843f;
  const p = [box(4.6, 0.3, 3.0, W, 0, 0, 0)];
  for (const y of [0.5, 1.5]) for (const s of [-1, 1]) { p.push(box(4.6, 0.6, 0.18, W, 0, y, s * 1.45)); p.push(box(0.18, 0.6, 3.0, W, s * 2.2, y, 0)); }
  for (let i = 0; i < 5; i++) p.push(capsule(0.36, 3.4, i % 2 ? B : BD, -1.5 + i * 0.75, 2.1 + K.R() * 0.4, K.rnd(-0.6, 0.6), 0.9 + K.rnd(-0.2, 0.25)));
  p.push(dome(1.0, 0.75, 0.85, B, 1.6, 2.0, 0.6, 12, 4));
  return p;
}

// ============================================================== KITCHEN
function kitchen(K) {
  const { hw, hd } = K;
  const FL = -8, TOP = 24;
  const X0 = hw + 0.5, Z0 = hd + 0.5, TX = hw + 2.0, TZ = hd + 2.0;
  const BZ = -(hd + 13), RX = hw + 19, SZ = hd + 14;
  K.floorY = FL; K.shadow = 0x4a2a16;
  const G = K.glossy, M = K.matte;
  const BAND = 0xbb8a5c, EDGE = 0xa77650, APRON = 0x9a6a46, LEG = 0xa87a52;
  const CAB = 0xa9d3ae, DOOR = 0xc2e3c4, KNOB = 0xe8b44a, TOPC = 0xecc896, WALL = 0xfff2dc, CAP = 0xffb36b;

  // Table: a plank band around the board (flush, under the rail), rounded edge, apron, legs.
  const band = [
    rectXZ(-TX, TX, Z0, TZ, 0, BAND, 8, 1), rectXZ(-TX, TX, -TZ, -Z0, 0, BAND, 8, 1),
    rectXZ(X0, TX, -Z0, Z0, 0, BAND, 1, 8), rectXZ(-TX, -X0, -Z0, Z0, 0, BAND, 1, 8),
  ];
  jitter(band, K.R, 0.07);
  K.flat.push(...band);
  const U = K.under;
  U.push(rbox(2 * TX + 0.1, 1.0, 1.1, EDGE, 0, -1.01, TZ - 0.5, 0.32), rbox(2 * TX + 0.1, 1.0, 1.1, EDGE, 0, -1.01, -(TZ - 0.5), 0.32));
  for (const s of [-1, 1]) U.push(rbox(1.1, 1.0, 2 * TZ, EDGE, s * (TX - 0.5), -1.01, 0, 0.32));
  U.push(box(2 * TX - 2.6, 1.3, 0.35, APRON, 0, -2.3, TZ - 1.25), box(2 * TX - 2.6, 1.3, 0.35, APRON, 0, -2.3, -(TZ - 1.25)));
  for (const s of [-1, 1]) U.push(box(0.35, 1.3, 2 * TZ - 2.6, APRON, s * (TX - 1.25), -2.3, 0));
  const legP = [[0.38, 0], [0.48, 0.25], [0.4, 0.6], [0.34, 1.6], [0.42, 2.8], [0.6, 3.3], [0.45, 3.8], [0.5, 4.6], [0.62, 5.0], [0.62, 7.0]];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    U.push(lathe(legP, LEG, 10, sx * (TX - 1.15), FL, sz * (TZ - 1.15)));
    K.blob(sx * (TX - 1.15), FL + 0.04, sz * (TZ - 1.15), 1.3, 1.3, 0.45);
  }

  // Floor, braided rug under the table, soft shadow under the table top.
  K.meshes.push(texMesh([rectXZ(-RX, RX, BZ, hd + 70, FL, 0xffffff)], planksTex(K.R, 27, 42, 47), 14, { name: 'floor' }));
  const rugC = [0xb8644f, 0xeedcc2, 0xe8d3b6, 0xd49a5a, 0xeedcc2, 0xe8d3b6, 0x93ad8a, 0xeedcc2, 0xe8d3b6, 0xeedcc2];
  const rx = TX + 3.6, rz = TZ + 3.2, nr = rugC.length;
  for (let i = 0; i < nr; i++) {
    const r0 = 1 - ((i + 1) / nr) * 0.36, r1 = 1 - (i / nr) * 0.36;
    M.push(ringXZ(r0 + 0.004, r1, rugC[i], 0, FL + 0.03, 0, 64, rx, rz));
  }
  M.push(disc(0.64, 0xe8cfae, 0, FL + 0.03, 0, 48, rx, rz));
  K.blob(0, FL + 0.06, 0, TX + 1.2, TZ + 1.2, 0.5);

  // Chairs around the sides and the far end (never the near side: it faces the camera).
  const chairPal = [[0xffe08a, 0xe2bf5a, 0xff9eb8], [0x9fe0cf, 0x76c2ab, 0xffe08a], [0x9fd2ff, 0x77afe0, 0xff9eb8], [0xffb3c7, 0xe0909f, 0x9fe0cf]];
  let ci = 0;
  const place = (x, z, ry) => {
    const [c, cd, cu] = chairPal[ci++ % chairPal.length];
    K.under.push(...put(chair(c, cd, cu), x, FL, z, ry));
    K.blob(x, FL + 0.05, z, 2.4, 2.4, 0.4);
  };
  const nSide = Math.max(1, Math.floor((2 * hd - 6) / 11));
  for (const s of [-1, 1]) for (let i = 0; i < nSide; i++) place(s * (TX + 0.9), -hd + 3.5 + (2 * hd - 8) * ((i + 0.5) / nSide), -s * PI / 2);
  const nFar = Math.max(1, Math.floor((2 * hw - 2) / 11));
  for (let i = 0; i < nFar; i++) place(-hw + 2 + (2 * hw - 4) * ((i + 0.5) / nFar), -(TZ + 0.9), 0);

  // Walls.
  const wall = boxS(2 * RX + 2, TOP - FL, 1, WALL, 0, FL, BZ - 0.5, 1, 8, 1);
  shadeY(wall, FL, TOP, 0.82, 1.03);
  M.push(wall);
  for (const s of [-1, 1]) {
    const sw = boxS(1, TOP - FL, SZ - BZ + 1, WALL, s * (RX + 0.5), FL, (SZ + BZ - 1) / 2, 1, 8, 1);
    shadeY(sw, FL, TOP, 0.76, 0.97);
    M.push(sw);
    G.push(box(0.45, 0.9, SZ - BZ, WHITE, s * (RX - 0.22), FL, (SZ + BZ) / 2), box(1.7, 0.9, SZ - BZ + 1.7, CAP, s * (RX + 0.5), TOP, (SZ + BZ - 1) / 2));
    for (let z = BZ + 1; z <= SZ; z += 3) K.blob(s * (RX - 0.6), FL + 0.04, z, 1.5, 2.6, 0.3);
  }
  G.push(box(2 * RX + 2.8, 0.9, 1.7, CAP, 0, TOP, BZ - 0.5), box(2 * RX, 0.6, 0.6, WHITE, 0, TOP - 0.6, BZ + 0.3));

  // Back wall: base cabinets, butcher-block counter, subway backsplash, upper cabinets
  // either side of the window, the stove, the sink and a retro fridge.
  const KX0 = -(hw + 13), KX1 = hw + 3.2, CD = 4.2, cz = BZ + CD, CT = FL + 8.8;
  G.push(box(KX1 - KX0, CT - (FL + 0.8), CD - 0.3, CAB, (KX0 + KX1) / 2, FL + 0.8, BZ + (CD - 0.3) / 2));
  G.push(box(KX1 - KX0, 0.8, CD - 0.9, 0x6f9a74, (KX0 + KX1) / 2, FL, BZ + (CD - 0.9) / 2));
  G.push(box(KX1 - KX0 + 0.6, 0.6, CD + 0.3, TOPC, (KX0 + KX1) / 2, CT, BZ + (CD + 0.3) / 2));
  for (let x = KX0 + 1; x < KX1; x += 2.4) K.blob(x, FL + 0.04, cz + 0.6, 2.2, 1.4, 0.42);
  const SX0 = -(hw + 10), SX1 = -(hw + 4.6);           // stove
  const nd = Math.max(3, Math.round((KX1 - KX0) / 4.4)), dw = (KX1 - KX0) / nd;
  for (let i = 0; i < nd; i++) {
    const x = KX0 + dw * (i + 0.5);
    if (x > SX0 - 0.5 && x < SX1 + 0.5) continue;
    G.push(box(dw - 0.4, 1.6, 0.2, DOOR, x, CT - 2.0, cz), box(dw - 0.4, CT - 2.5 - (FL + 1.0), 0.2, DOOR, x, FL + 1.0, cz));
    G.push(box(dw - 1.3, CT - 3.4 - (FL + 1.0), 0.12, CAB, x, FL + 1.45, cz + 0.15));
    G.push(cyl(0.11, 0.11, dw * 0.3, KNOB, x, CT - 1.25, cz + 0.3, 8, 0, PI / 2), ballC(0.22, KNOB, x + (i % 2 ? -1 : 1) * (dw / 2 - 0.7), CT - 3.4, cz + 0.32, 1));
  }
  // Stove: oven door with a window, knobs, dark cooktop with burners, a kettle.
  const sxm = (SX0 + SX1) / 2, sw2 = SX1 - SX0;
  G.push(box(sw2, CT - FL - 0.8, 0.3, 0xfff6ea, sxm, FL + 0.8, cz + 0.05));
  G.push(box(sw2 - 1.4, 3.2, 0.12, 0x3c3442, sxm, FL + 2.4, cz + 0.25), cyl(0.12, 0.12, sw2 - 1.6, CHROME, sxm, FL + 6.0, cz + 0.55, 8, 0, PI / 2));
  for (let i = 0; i < 4; i++) G.push(cyl(0.3, 0.3, 0.3, INK, SX0 + 1 + i * (sw2 - 2) / 3, CT - 1.0, cz + 0.4, 10, PI / 2));
  G.push(box(sw2, 0.08, CD - 0.4, 0x4a4250, sxm, CT + 0.6, BZ + CD / 2));
  for (const [dx, dz] of [[-1.3, -1], [1.3, -1], [-1.3, 1], [1.3, 1]]) G.push(torus(0.75, 0.09, 0x2a2430, sxm + dx, CT + 0.72, BZ + CD / 2 + dz * 0.95, PI / 2, 16));
  K.add([egg(1.1, 0.9, 1.1, 0x7fd4c8, 0, 0.85, 0, 14, 9), rod([0.9, 0.9, 0], [1.75, 1.6, 0], 0.22, 0.1, 0x7fd4c8), torus(0.7, 0.1, CHROME, 0, 1.75, 0, 0, 14), ballC(0.2, 0xff8fb8, 0, 1.9, 0, 1)], sxm - 1.3, CT + 0.65, BZ + CD / 2 - 0.95, 0.4);
  // Backsplash, window, sink.
  K.meshes.push(texMesh([panel(KX1 - KX0, 6.3, 0xffffff, (KX0 + KX1) / 2, CT + 0.6, BZ + 0.04)], subwayTex(K.R), 4, { phong: true, name: 'subway', shininess: 60 }));
  const ww = Math.min(9, 0.45 * 2 * hw), wx = -1.5, wy0 = CT + 7.2, wh = 8.5;
  K.add(windowView(K, ww, wh, 0xffffff, true), wx, wy0, BZ + 0.05);
  K.add({ s: [box(ww + 1.6, 0.4, 1.4, WHITE, 0, -0.4, 0.7)] }, wx, wy0, BZ);
  for (let i = 0; i < 3; i++) K.add(pottedPlant(K, 0.75), wx - ww / 3 + i * ww / 3, wy0, BZ + 0.75, K.R() * 3);
  G.push(flat(5.2, 2.6, 0x8a96a3, wx, CT + 0.62, BZ + CD / 2 + 0.2), flat(4.6, 2.1, 0x5f6b78, wx, CT + 0.63, BZ + CD / 2 + 0.2));
  G.push(rod([wx, CT + 0.6, BZ + 0.9], [wx, CT + 3.0, BZ + 0.9], 0.18, 0.18, CHROME), rod([wx, CT + 3.0, BZ + 0.9], [wx, CT + 3.2, BZ + 2.2], 0.16, 0.12, CHROME));
  // Upper cabinets.
  for (const [a, b] of [[KX0, wx - ww / 2 - 0.9], [wx + ww / 2 + 0.9, KX1]]) {
    if (b - a < 2) continue;
    G.push(box(b - a, 7.2, 2.4, CAB, (a + b) / 2, CT + 7.0, BZ + 1.2), box(b - a + 0.4, 0.4, 2.7, WHITE, (a + b) / 2, CT + 14.2, BZ + 1.35));
    const m = Math.max(1, Math.round((b - a) / 3.4)), w2 = (b - a) / m;
    for (let i = 0; i < m; i++) {
      const x = a + w2 * (i + 0.5);
      G.push(box(w2 - 0.35, 6.6, 0.18, DOOR, x, CT + 7.3, BZ + 2.45), ballC(0.2, KNOB, x + (i % 2 ? -1 : 1) * (w2 / 2 - 0.6), CT + 7.9, BZ + 2.65, 1));
    }
  }
  // Hanging utensils on a rail.
  const ux0 = KX0 + 2, ux1 = Math.min(wx - ww / 2 - 1.2, KX0 + 12);
  G.push(rod([ux0, CT + 5.4, BZ + 0.45], [ux1, CT + 5.4, BZ + 0.45], 0.1, 0.1, CHROME));
  const utensils = [ladle, spatula, whisk, ladle, spatula];
  for (let i = 0, x = ux0 + 0.9; x < ux1 - 0.6; i++, x += 1.6) K.add(utensils[i % utensils.length](K.pick([0xff8fb8, 0x8fdcc4, 0xffd36e, 0xd9a066])), x, CT + 5.4, BZ + 0.55);
  // Fridge.
  const FX = hw + 7.4, fz = BZ + 2.4;
  G.push(rbox(7.0, 22.0, 4.6, 0xffe7a0, FX, FL, fz, 1.0));
  G.push(box(6.6, 0.14, 0.1, 0xd9bb6a, FX, FL + 15.2, fz + 2.32), rbox(0.45, 4.2, 0.5, CHROME, FX - 2.6, FL + 16.0, fz + 2.5, 0.2), rbox(0.45, 6.0, 0.5, CHROME, FX - 2.6, FL + 8.2, fz + 2.5, 0.2));
  for (let i = 0; i < 6; i++) G.push(vdisc(0.28, K.pick(FLOWER), FX - 1.4 + K.rnd(0, 3.2), FL + 9 + K.rnd(0, 4.5), fz + 2.33, 10));
  K.add([panel(2.0, 2.5, WHITE), vdisc(0.42, 0xffd23f, -0.45, 1.85, 0.02, 12), tris([[0.1, 0.4, 0.02], [0.8, 0.4, 0.02], [0.45, 1.2, 0.02]], 0xff5a6e, new THREE.Vector3(0, 0, 1)), panel(1.7, 0.25, 0x5cc46b, 0, 0.12, 0.02)], FX + 0.9, FL + 9.6, fz + 2.34);
  K.add(pottedPlant(K, 1.0), FX + 1.2, FL + 22.0, fz);
  K.blob(FX, FL + 0.04, fz + 0.6, 4.3, 3.3, 0.45);
  K.add(wallClock(0xff9a3c), wx, CT + 18.4, BZ + 0.05);

  // A sleepy cat on its bed by the near-left corner of the table.
  const ns = K.ns, catX = -Math.min(hw * 0.5, 6), catZ = TZ + 2.6 + 3.0 * ns;
  const cb = catBed();
  K.add(cb.bed, catX, FL, catZ, 0.5, ns);
  const cat = new THREE.Mesh(merge(put(cb.cat, 0, 0, 0, 0.5, ns)), new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 30, specular: 0x242424 }));
  cat.name = 'cat'; cat.position.set(catX, FL + 0.3 * ns, catZ);
  K.meshes.push(cat);
  K.tick.push((t) => { const b = Math.sin(t * 1.4); cat.scale.set(1 + b * 0.012, 1 + b * 0.035, 1 + b * 0.012); });
  K.blob(catX, FL + 0.04, catZ, 3.0 * ns, 2.6 * ns, 0.4);
  K.add([cyl(0.9, 0.7, 0.55, 0xff8fb8, 0, 0, 0, 14), disc(0.75, 0x7fc8ff, 0, 0.5, 0, 14)], catX + 3.6 * ns, FL, catZ + 1.2 * ns, 0, ns);
  K.blob(catX + 3.6 * ns, FL + 0.04, catZ + 1.2 * ns, 1.1 * ns, 1.1 * ns, 0.35);
}
function chair(col, colD, cushion) {
  const P = [box(3.6, 0.45, 3.4, col, 0, 4.2, 0), rbox(3.2, 0.4, 3.0, cushion, 0, 4.62, 0.1, 0.18)];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.push(cyl(0.17, 0.2, 4.2, colD, sx * 1.48, 0, sz * 1.38, 6));
  for (const sx of [-1, 1]) P.push(box(0.36, 7.4, 0.36, col, sx * 1.48, 4.6, -1.55));
  P.push(rbox(3.7, 1.2, 0.42, col, 0, 10.6, -1.55, 0.2), box(3.0, 0.32, 0.3, col, 0, 7.3, -1.55));
  for (const sx of [-0.75, 0, 0.75]) P.push(cyl(0.11, 0.11, 3.0, col, sx, 7.6, -1.55, 6), cyl(0.11, 0.11, 2.7, col, sx, 4.65, -1.55, 6));
  return P;
}
function ladle(c) { return [rod([0, 0, 0], [0, -3.2, 0], 0.1, 0.1, c), lathe([[0, 0], [0.55, 0.05], [0.75, 0.45], [0.6, 0.48], [0, 0.2]], CHROME, 12, 0, -3.75, 0.2)]; }
function spatula(c) { return [rod([0, 0, 0], [0, -2.4, 0], 0.11, 0.11, c), box(0.95, 1.2, 0.08, CHROME, 0, -3.6, 0)]; }
function whisk(c) { return [rod([0, 0, 0], [0, -1.8, 0], 0.13, 0.13, c), egg(0.48, 1.0, 0.48, CHROME, 0, -2.75, 0, 8, 8)]; }
function windowView(K, w, h, frame, curtains) {
  // Frame facing +z with a little painted view (sky, hills, a cloud) and a glass sheen.
  const s = [], g = [];
  const view = panel(w - 0.6, h - 0.6, 0xbfe8ff, 0, 0.3, 0.02);
  recolor(view, (x, y, z, c) => c.lerp(new THREE.Color(0xe9f8ff), clamp01((h - y) / h) * 0.6));
  s.push(view);
  const hill = new THREE.Shape();
  hill.moveTo(-w / 2 + 0.3, 0.3);
  for (let i = 0; i <= 12; i++) { const t = i / 12; hill.lineTo(-w / 2 + 0.3 + t * (w - 0.6), 0.3 + h * (0.24 + Math.sin(t * PI * 2.2 + 0.6) * 0.07)); }
  hill.lineTo(w / 2 - 0.3, 0.3);
  s.push(shapeZ(hill, 0x8fd16a, 0, 0, 0.04));
  s.push(...put([vdisc(0.7, WHITE, 0, 0, 0, 10), vdisc(0.55, WHITE, 0.75, -0.1, 0, 10), vdisc(0.5, WHITE, -0.7, -0.12, 0, 10)], -w * 0.18, h * 0.72, 0.05));
  for (const x of [-w / 2 + 0.2, w / 2 - 0.2]) s.push(box(0.4, h, 0.5, frame, x, 0, 0.2));
  for (const y of [0, h - 0.4]) s.push(box(w, 0.4, 0.5, frame, 0, y, 0.2));
  s.push(box(0.22, h - 0.6, 0.3, frame, 0, 0.3, 0.25), box(w - 0.6, 0.22, 0.3, frame, 0, h / 2, 0.25));
  g.push(panel(w - 0.6, h - 0.6, 0xffffff, 0, 0.3, 0.3));
  if (curtains) {
    s.push(rod([-w / 2 - 1.2, h + 0.5, 0.7], [w / 2 + 1.2, h + 0.5, 0.7], 0.12, 0.12, 0xd9a066));
    const val = [];
    for (let i = 0; i < 7; i++) val.push(custom(new THREE.CircleGeometry(w / 14 + 0.12, 10, PI, PI).translate(-w / 2 + (i + 0.5) * w / 7, h + 0.2, 0.75), i % 2 ? 0xffffff : 0xff8a7a));
    s.push(box(w + 0.6, 0.9, 0.12, 0xff8a7a, 0, h - 0.1, 0.7), ...val);
  }
  return { s, g };
}
function catBed() {
  const FUR = 0xf4a85e, FURL = 0xffd2a0, y = -0.3;
  const bed = [torus(2.0, 0.65, 0xff9ec0, 0, 0.6, 0, PI / 2, 22), disc(1.95, 0xffd6e4, 0, 0.35, 0, 20), cyl(2.0, 2.1, 0.35, 0xff9ec0, 0, 0, 0, 20)];
  const cat = [
    egg(1.35, 0.75, 1.05, FUR, 0, 0.95 + y, 0, 14, 9), ballC(0.62, FUR, 1.0, 1.25 + y, 0.55, 1), ballC(0.32, FURL, 1.38, 1.05 + y, 0.72, 1),
    cone(0.22, 0.42, FUR, 0.75, 1.65 + y, 0.75, 6), cone(0.22, 0.42, FUR, 1.25, 1.62 + y, 0.25, 6),
    custom(new THREE.TorusGeometry(1.15, 0.24, 6, 14, PI * 1.1).rotateX(PI / 2).rotateY(0.2).translate(0, 0.85 + y, 0), FUR),
    box(0.06, 0.05, 0.35, INK, 1.42, 1.32 + y, 0.98), box(0.35, 0.05, 0.06, INK, 1.6, 1.32 + y, 0.6),
  ];
  for (const [sx, k] of [[-0.55, 0.92], [-0.1, 1.0], [0.35, 0.97]]) cat.push(custom(new THREE.TorusGeometry(1, 0.07, 4, 12, PI).rotateY(PI / 2).scale(1, 0.77 * k, 1.07 * k).translate(sx, 0.95 + y, 0), 0xd9843e));
  return { bed, cat };
}

// ============================================================== PLAYROOM
function playroom(K) {
  const { hw, hd } = K;
  const X0 = hw + 0.5, Z0 = hd + 0.5, B = 1.8;
  const BZ = -(hd + 8), RX = hw + 14, SZ = hd + 9, TOP = 26, ns = K.ns;
  K.shadow = 0x5a4458;
  const G = K.glossy;

  // Honey floorboards around the board, a foam-tile rug border right at the rail.
  const fl = [
    rectXZ(-RX, RX, Z0, hd + 70, 0, 0xffffff), rectXZ(-RX, RX, BZ, -Z0, 0, 0xffffff),
    rectXZ(X0, RX, -Z0, Z0, 0, 0xffffff), rectXZ(-RX, -X0, -Z0, Z0, 0, 0xffffff),
  ];
  K.meshes.push(texMesh(fl, planksTex(K.R, 33, 48, 74), 13, { patched: true, name: 'floor' }));
  const tiles = [0xff8fab, 0xffd166, 0x8fe3b0, 0x8fc8ff, 0xc8a8ff];
  let ti = 0;
  const tileStrip = (x0, x1, z0, z1) => {
    const alongX = x1 - x0 >= z1 - z0, len = alongX ? x1 - x0 : z1 - z0, n = Math.max(1, Math.round(len / B)), st = len / n;
    K.flat.push(rectXZ(x0, x1, z0, z1, 0.02, WHITE));
    for (let i = 0; i < n; i++) {
      const a = (alongX ? x0 : z0) + i * st, b = a + st, c = tiles[ti++ % tiles.length];
      K.flat.push(alongX ? rectXZ(a + 0.08, b - 0.08, z0 + 0.08, z1 - 0.08, 0.04, c) : rectXZ(x0 + 0.08, x1 - 0.08, a + 0.08, b - 0.08, 0.04, c));
    }
  };
  tileStrip(-(X0 + B), X0 + B, Z0, Z0 + B);
  tileStrip(-(X0 + B), X0 + B, -(Z0 + B), -Z0);
  tileStrip(X0, X0 + B, -Z0, Z0);
  tileStrip(-(X0 + B), -X0, -Z0, Z0);

  // Walls with wallpaper, baseboards and a cut-away top trim.
  const walls = [boxS(2 * RX + 2, TOP, 1, 0xffffff, 0, 0, BZ - 0.5, 1, 8, 1)];
  for (const s of [-1, 1]) walls.push(boxS(1, TOP, SZ - BZ + 1, 0xffffff, s * (RX + 0.5), 0, (SZ + BZ - 1) / 2, 1, 8, 1));
  shadeY(walls, 0, TOP, 0.84, 1.02);
  recolor(walls.slice(1), (x, y, z, c) => c.multiplyScalar(0.92));
  K.meshes.push(texMesh(walls, wallpaperTex(K.R), 9, { name: 'wallpaper' }));
  G.push(box(2 * RX, 1.1, 0.45, WHITE, 0, 0, BZ + 0.22), box(2 * RX + 2.8, 0.9, 1.7, 0x9fd2ff, 0, TOP, BZ - 0.5));
  for (const s of [-1, 1]) G.push(box(0.45, 1.1, SZ - BZ, WHITE, s * (RX - 0.22), 0, (SZ + BZ) / 2), box(1.7, 0.9, SZ - BZ + 1.7, 0x9fd2ff, s * (RX + 0.5), TOP, (SZ + BZ - 1) / 2));
  for (let x = -RX + 1; x <= RX - 1; x += 2.8) K.blob(x, 0.03, BZ + 0.9, 2.2, 1.4, 0.3);
  for (const s of [-1, 1]) for (let z = BZ + 1; z <= SZ; z += 2.8) K.blob(s * (RX - 0.9), 0.03, z, 1.4, 2.2, 0.28);

  // Window with curtains in the middle of the back wall, bunting above.
  const ww = Math.min(11, 0.55 * 2 * hw), wy = 7.5, wh = 10;
  const win = windowView(K, ww, wh, WHITE, false);
  K.add(win, 0, wy, BZ + 0.05);
  G.push(box(ww + 1.8, 0.45, 1.5, WHITE, 0, wy - 0.45, BZ + 0.75));
  for (const s of [-1, 1]) K.add(curtain(K, 3.0, wh + 2.4), s * (ww / 2 + 1.0), wy - 1.2, BZ + 0.9);
  G.push(rod([-(ww / 2 + 3.2), wy + wh + 1.3, BZ + 1.0], [ww / 2 + 3.2, wy + wh + 1.3, BZ + 1.0], 0.14, 0.14, 0xffc95a));
  for (const s of [-1, 1]) G.push(ballC(0.3, 0xffc95a, s * (ww / 2 + 3.35), wy + wh + 1.3, BZ + 1.0, 1));
  K.add(pottedPlant(K, 0.8), -ww / 2 + 1.4, wy, BZ + 0.85);
  K.add(starLamp(), ww / 2 - 1.4, wy, BZ + 0.85);
  bunting(K, -(RX - 1.5), RX - 1.5, 20.5, BZ + 0.7);

  // Toy shelf left of the window, framed pictures above it.
  const shX = -(ww / 2 + 3.6 + 5.0);
  K.add(cubbyShelf(K), shX, 0, BZ + 1.5);
  K.blob(shX, 0.03, BZ + 1.8, 5.8, 2.2, 0.4);
  K.add(picture(3.4, 2.8, 0xff9ec8, 'rainbow'), shX - 2.2, 10.6, BZ + 0.05);
  K.add(picture(2.8, 3.4, 0x9fd2ff, 'sun'), shX + 2.6, 10.2, BZ + 0.05);

  // Bed in the far-right corner.
  const bedW = 8.6, bedL = 12.5, bx = RX - bedW / 2 - 0.4;
  K.add(bed(K, bedW, bedL), bx, 0, BZ + 0.2);
  K.blob(bx, 0.03, BZ + bedL / 2, bedW / 2 + 1, bedL / 2 + 1, 0.42);
  K.add(picture(3.0, 3.0, 0xffe27a, 'heart'), bx, 13.4, BZ + 0.05);

  // Toy box (left) and block tower (right) beside the board.
  K.add(toyChest(K), -(hw + 6.2), 0, -hd * 0.22, PI / 2);
  K.blob(-(hw + 6.2), 0.03, -hd * 0.22, 2.8, 3.6, 0.42);
  K.add(blockTower(K, 6), hw + 4.6, 0, hd * 0.12, 0.2);
  K.blob(hw + 4.6, 0.03, hd * 0.12, 2.2, 2.2, 0.4);
  K.add(blockTower(K, 3), hw + 7.6, 0, hd * 0.12 + 2.6, -0.4);
  K.blob(hw + 7.6, 0.03, hd * 0.12 + 2.6, 2.0, 2.0, 0.35);

  // Near side, all low: a wooden train track loop and floor cushions.
  const trx = Math.min(hw - 0.5, 10 * ns), trz = 3.0 * ns, tcz = Z0 + B + 1.3 + trz;
  trainTrack(K, 0, tcz, trx, trz);
  const rugR = [0xff8fab, 0xffd166, 0x8fe3b0, 0x8fc8ff, 0xc8a8ff];
  rugR.forEach((c, i) => K.flat.push(ringXZ(1.0 - (i + 1) * 0.16, 1.0 - i * 0.16, c, 0, 0.03, tcz, 40, trx * 0.62, trz * 0.68)));
  K.flat.push(disc(0.2, WHITE, 0, 0.03, tcz, 30, trx * 0.62, trz * 0.68));
  K.add(xylophone(), -trx * 0.3, 0, tcz, 0.15, ns * 0.9);
  K.blob(-trx * 0.3, 0.035, tcz, 2.2 * ns, 1.4 * ns, 0.3);
  K.add(bookStack(K), trx * 0.32, 0, tcz - 0.2, -0.3, ns * 0.9);
  K.blob(trx * 0.32, 0.035, tcz - 0.2, 1.6 * ns, 1.3 * ns, 0.3);
  for (const s of [-1, 1]) {
    const cx = s * (X0 + B + 3.6 * ns), cz = Z0 + B + 2.2 * ns;
    K.add([egg(2.2, 0.85, 2.2, s > 0 ? 0xffb3c7 : 0x9fe0cf, 0, 0.5, 0, 18, 8), torus(1.1, 0.16, WHITE, 0, 1.18, 0, PI / 2, 16)], cx, 0, cz, 0, ns);
    K.blob(cx, 0.035, cz, 2.7 * ns, 2.7 * ns, 0.4);
  }
  K.add(shapeStar(0xffd23f), -(X0 + B + 2.0 * ns), 0, tcz + trz + 2.4 * ns, 0.3, ns);
  K.add(shapeStar(0xff9ec8), X0 + B + 2.6 * ns, 0, tcz + trz + 3.0 * ns, -0.5, ns);
}
function xylophone() {
  const p = [box(4.2, 0.35, 0.3, 0xd9a066, 0, 0.15, -0.9), box(4.2, 0.35, 0.3, 0xd9a066, 0, 0.15, 0.9)];
  const c = [0xff5a5f, 0xff9a3a, 0xffd23f, 0x5fd16a, 0x4fa3ff, 0xb07cff];
  c.forEach((col, i) => p.push(rbox(0.55, 0.22, 2.4 - i * 0.18, col, -1.7 + i * 0.68, 0.5, 0, 0.08)));
  p.push(rod([1.2, 0.85, 1.4], [2.6, 0.75, 2.4], 0.07, 0.07, 0xd9a066), ballC(0.2, 0xff5a5f, 1.2, 0.85, 1.4, 1));
  return p;
}
function bookStack(K) {
  const p = []; let y = 0;
  for (let i = 0; i < 3; i++) { const h = 0.32; p.push(box(2.2 - i * 0.2, h, 1.6 - i * 0.1, K.pick([0xff8fa8, 0x8fc8ff, 0xffd36e, 0x9fe0b4, 0xc9a8ff]), 0, y, 0, (i - 1) * 0.2)); y += h; }
  return p;
}
function curtain(K, w, h) {
  const p = [], n = 6;
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + (i + 0.5) * (w / n);
    p.push(cyl(w / n * 0.62, w / n * 0.72, h, i % 2 ? 0xff9ec8 : 0xffb6d4, x, 0, 0, 6));
  }
  p.push(torus(w * 0.42, 0.16, 0xffffff, 0, h * 0.45, 0, PI / 2, 12));
  shadeY(p, 0, h, 0.82, 1.04);
  return p;
}
function bunting(K, x0, x1, y, z) {
  const col = [0xff6f9c, 0xffd23f, 0x5fd16a, 0x4fa3ff, 0xb07cff, 0xff9a3a];
  const sag = 2, n = Math.max(2, Math.round((x1 - x0) / 12));
  const seg = (x1 - x0) / n;
  const yAt = (x) => { const t = ((x - x0) % seg) / seg; return y - Math.sin(t * PI) * sag; };
  for (let k = 0; k < n; k++) {
    let prev = null;
    for (let i = 0; i <= 10; i++) {
      const x = x0 + seg * (k + i / 10), pt = [x, i === 10 ? y : yAt(x), z];
      if (prev) K.glossy.push(rod(prev, pt, 0.05, 0.05, 0xfff3d6, 4));
      prev = pt;
    }
  }
  let c = 0;
  for (let x = x0 + 0.8; x < x1 - 0.6; x += 1.5) {
    const yy = yAt(x);
    K.glossy.push(tris([[x - 0.6, yy, z], [x + 0.6, yy, z], [x, yy - 1.35, z + 0.35]], col[c++ % col.length], new THREE.Vector3(0, 0.3, 1)));
  }
}
function picture(w, h, col, kind) {
  const p = [box(w, h, 0.25, col, 0, 0, 0.12), panel(w - 0.6, h - 0.6, WHITE, 0, 0.3, 0.26)];
  if (kind === 'rainbow') {
    [0xff6f9c, 0xffa53a, 0xffd23f, 0x5fd16a, 0x4fa3ff].forEach((c, i) => p.push(custom(new THREE.RingGeometry(0.95 - i * 0.16, 1.1 - i * 0.16, 16, 1, 0, PI).translate(0, h * 0.28, 0.28 + i * 0.002), c)));
  } else if (kind === 'sun') {
    p.push(vdisc(0.7, 0xffd23f, 0, h * 0.55, 0.28, 16));
    for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; p.push(custom(new THREE.BoxGeometry(0.14, 0.45, 0.02).translate(0, 1.0, 0).rotateZ(a).translate(0, h * 0.55, 0.28), 0xffa53a)); }
  } else {
    const hs = new THREE.Shape(); hs.moveTo(0, -0.7); hs.bezierCurveTo(-1.2, 0.1, -0.7, 1.0, 0, 0.45); hs.bezierCurveTo(0.7, 1.0, 1.2, 0.1, 0, -0.7);
    p.push(shapeZ(hs, 0xff6f9c, 0, h * 0.5, 0.28));
  }
  return p;
}
function starLamp() {
  return [cyl(0.55, 0.65, 0.4, 0xc9b2ff, 0, 0, 0, 12), cyl(0.09, 0.09, 1.2, WHITE, 0, 0.4, 0, 6), shapeZ(starShape(0.85), 0xffe27a, 0, 2.15, 0.0)];
}
function cubbyShelf(K) {
  const W = 9.6, H = 7.0, D = 2.8, t = 0.36, col = 0xffffff, back = 0xbfe3ff;
  const p = [box(W, t, D, col, 0, 0, 0), box(W, t, D, col, 0, H - t, 0), box(t, H, D, col, -W / 2 + t / 2, 0, 0), box(t, H, D, col, W / 2 - t / 2, 0, 0),
    box(W, H, 0.15, back, 0, 0, -D / 2 + 0.08), box(W - 2 * t, t, D - 0.2, col, 0, H / 2 - t / 2, 0.1)];
  for (const x of [-W / 6, W / 6]) p.push(box(t, H, D - 0.2, col, x, 0, 0.1));
  const cw = W / 3;
  const bins = [0xff9ec8, 0x9fe6cc, 0xffe27a];
  for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) {
    const cx = -W / 3 + c * cw, y0 = r ? H / 2 + t / 2 : t;
    const k = (r * 3 + c + Math.floor(K.R() * 6)) % 6;
    if (k === 0) p.push(ballC(1.05, K.pick([0xff5a5f, 0x4fa3ff, 0x5fd16a]), cx, y0 + 1.05, 0.2, 2));
    else if (k === 1) for (let i = 0; i < 4; i++) p.push(box(0.4, K.rnd(1.6, 2.4), 1.8, K.pick(FLOWER), cx - 0.9 + i * 0.5, y0, 0.2));
    else if (k === 2) p.push(rbox(2.5, 1.8, 2.2, bins[c % 3], cx, y0, 0.2, 0.2), box(1.0, 0.35, 0.1, WHITE, cx, y0 + 1.1, 1.32));
    else if (k === 3) p.push(cyl(0.9, 0.9, 1.4, 0xff5a5f, cx, y0, 0.2, 14), torus(0.9, 0.1, GOLD, cx, y0 + 1.4, 0.2, PI / 2, 14), disc(0.88, WHITE, cx, y0 + 1.42, 0.2, 14));
    else if (k === 4) p.push(box(1.2, 1.2, 1.2, 0xffd23f, cx - 0.55, y0, 0.2, 0.3), box(1.0, 1.0, 1.0, 0x4fa3ff, cx + 0.6, y0, 0.3, -0.2), box(0.9, 0.9, 0.9, 0x5fd16a, cx, y0 + 1.2, 0.2, 0.5));
    else p.push(ballC(0.9, 0xc98a5b, cx, y0 + 0.9, 0.3, 2), ballC(0.32, 0xc98a5b, cx - 0.6, y0 + 1.6, 0.3, 1), ballC(0.32, 0xc98a5b, cx + 0.6, y0 + 1.6, 0.3, 1), ballC(0.3, 0xffe2c4, cx, y0 + 0.75, 0.95, 1));
  }
  return p;
}
function bed(K, w, l) {
  const FR = 0xffffff, Q = [0xff9ec8, 0xffe27a, 0x9fe6cc, 0x9fd2ff, 0xc9b2ff, 0xffbf94];
  const p = [box(w, 1.6, l, FR, 0, 0.5, l / 2), rbox(w - 0.3, 1.5, l - 0.6, 0xfffaf2, 0, 2.0, l / 2 + 0.15, 0.4)];
  for (const sx of [-1, 1]) for (const z of [0.4, l - 0.4]) p.push(cyl(0.35, 0.3, 0.6, FR, sx * (w / 2 - 0.4), 0, z, 8));
  p.push(box(w + 0.6, 6.8, 0.6, 0xc9b2ff, 0, 0, 0.3), cyl(w / 2 + 0.3, w / 2 + 0.3, 0.6, 0xc9b2ff, 0, 6.8, 0.3, 24, PI / 2));
  p.push(box(w + 0.4, 3.8, 0.5, 0xc9b2ff, 0, 0, l - 0.25));
  // patchwork quilt over the lower 2/3, folded edge, pillows
  const qz0 = l * 0.32, qz1 = l - 0.5, cols = 4, rows = 5, cw = (w - 0.2) / cols, rh = (qz1 - qz0) / rows;
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) p.push(rectXZ(-w / 2 + 0.1 + i * cw, -w / 2 + 0.1 + (i + 1) * cw, qz0 + j * rh, qz0 + (j + 1) * rh, 3.52, Q[(i + j * 2 + Math.floor(K.R() * 2)) % Q.length]));
  p.push(box(w - 0.1, 0.25, 0.9, 0xffffff, 0, 3.4, qz0 - 0.2), box(0.12, 2.6, qz1 - qz0, Q[0], -w / 2 - 0.02, 1.0, (qz0 + qz1) / 2));
  p.push(rbox(w * 0.38, 0.9, 2.3, 0xffffff, -w * 0.22, 3.3, 1.9, 0.35), rbox(w * 0.38, 0.9, 2.3, 0xffe3ee, w * 0.22, 3.3, 1.9, 0.35));
  return p;
}
function toyChest(K) {
  const p = [rbox(5.6, 3.4, 3.6, 0x6fb8ff, 0, 0, 0, 0.3), rbox(5.9, 0.7, 3.9, 0xff6f8e, 0, 3.3, 0, 0.25)];
  p.push(shapeZ(starShape(0.65), 0xffe27a, -1.5, 1.7, 1.82), shapeZ(starShape(0.5), WHITE, 0, 1.6, 1.82), shapeZ(starShape(0.65), 0xffe27a, 1.5, 1.7, 1.82));
  for (const s of [-1, 1]) p.push(custom(new THREE.TorusGeometry(0.4, 0.09, 6, 10).rotateY(PI / 2).translate(s * 2.85, 2.2, 0), GOLD));
  p.push(ballC(0.95, 0xff5a5f, -1.6, 4.4, 0.4, 2), ballC(0.45, 0xffd23f, 0.6, 4.25, -0.6, 1));
  return p;
}
function blockTower(K, n) {
  const cols = [0xff5a5f, 0x4fa3ff, 0xffd23f, 0x5fd16a, 0xb07cff, 0xff9a3a];
  const p = []; let y = 0;
  for (let i = 0; i < n; i++) {
    const s = 2.3 - i * 0.08, c = cols[(i + Math.floor(K.R() * 6)) % 6], c2 = cols[(i + 3) % 6], ry = K.rnd(-0.35, 0.35);
    const blk = [rbox(s, s, s, c, 0, 0, 0, 0.16)];
    const ins = i % 3 === 0 ? starShape(s * 0.3) : null;
    for (const [nx, nz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const g = ins ? new THREE.ShapeGeometry(ins) : new THREE.CircleGeometry(s * 0.28, 16);
      g.translate(0, 0, s / 2 + 0.012).rotateY(Math.atan2(nx, nz)).translate(0, s / 2, 0);
      blk.push(custom(g, c2));
    }
    blk.push(disc(s * 0.28, c2, 0, s + 0.012, 0, 16));
    p.push(...put(blk, K.rnd(-0.12, 0.12), y, K.rnd(-0.12, 0.12), ry));
    y += s;
  }
  return p;
}
function trainTrack(K, cx, cz, rx, rz) {
  const N = 72, pts = [];
  for (let i = 0; i < N; i++) { const a = (i / N) * TAU; pts.push([cx + Math.cos(a) * rx, cz + Math.sin(a) * rz]); }
  const tie = 0xb98455, rail = 0xe8c48e;
  for (let i = 0; i < N; i += 2) {
    const [x, z] = pts[i], [x2, z2] = pts[(i + 1) % N], ang = Math.atan2(z2 - z, x2 - x);
    K.glossy.push(box(0.35, 0.16, 1.7, tie, x, 0, z, -ang));
  }
  for (const off of [-0.55, 0.55]) {
    for (let i = 0; i < N; i++) {
      const [xa, za] = pts[i], [xb, zb] = pts[(i + 1) % N];
      const nxa = Math.cos((i / N) * TAU) / rx, nza = Math.sin((i / N) * TAU) / rz, la = Math.hypot(nxa, nza);
      const nxb = Math.cos(((i + 1) / N) * TAU) / rx, nzb = Math.sin(((i + 1) / N) * TAU) / rz, lb = Math.hypot(nxb, nzb);
      const a = [xa + (nxa / la) * off, za + (nza / la) * off], b = [xb + (nxb / lb) * off, zb + (nzb / lb) * off];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]), ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      K.glossy.push(box(len + 0.02, 0.14, 0.24, rail, (a[0] + b[0]) / 2, 0.14, (a[1] + b[1]) / 2, -ang));
    }
  }
  for (let i = 0; i < N; i += 6) K.blob(pts[i][0], 0.02, pts[i][1], 1.6, 1.6, 0.12);
}
function shapeStar(col) { return [custom(new THREE.ExtrudeGeometry(starShape(1.4), { depth: 0.6, bevelEnabled: true, bevelSize: 0.15, bevelThickness: 0.15, bevelSegments: 1 }).rotateX(-PI / 2), col)]; }

// ============================================================== PICNIC
function picnic(K) {
  const { hw, hd } = K;
  K.shadow = 0x2c5224;
  const G = K.glossy;
  const GREENS = [0x7cc35a, 0x8fd06a, 0x6cb84f, 0xa3da7a, 0x79c46a];

  // Pond (left side) with ducks, reeds, lily pads and stones.
  const px = -(hw + 9.5), pz = -hd * 0.12, prx = 4.8, prz = 6.2;
  const stx = hw + 8.5, stz = -hd * 0.1;   // the swing tree (built further down)
  K.claim(px, pz, 7.5);
  K.claim(stx - 1.5, stz, 5.0);
  pondWithDucks(K, px, pz, prx, prz);

  // Rustic fence along the far side.
  const fz = -(hd + 6.5);
  G.push(...railFence(-(hw + 18), fz, -2.2, fz), ...railFence(2.2, fz, hw + 18, fz));
  G.push(box(0.5, 2.6, 0.5, 0xc8915c, -2.2, 0, fz), box(0.5, 2.6, 0.5, 0xc8915c, 2.2, 0, fz), box(4.9, 0.5, 0.4, 0xdaa673, 0, 2.3, fz));
  for (let x = -(hw + 18); x <= hw + 18; x += 2.6) K.blob(x, 0.02, fz + 0.3, 1.0, 0.6, 0.25);

  // Trees: a row behind the fence, clusters at the sides, smaller ones on the hills.
  const plantTree = (x, z, s, kind) => {
    if (!K.free(x, z, 2.2 * s)) return false;
    K.claim(x, z, 2.2 * s);
    const leaf = K.pick(kind === 'pine' ? [0x3f9a55, 0x4aa860, 0x358a4c] : [0x5cbf55, 0x6ccb5e, 0x4fb04f, 0x7dd36a]);
    K.add(kind === 'pine' ? pineTree(K, 7.5 * s, 2.4 * s, leaf) : roundTree(K, 7.5 * s, 2.5 * s, leaf), x, 0, z, K.R() * TAU);
    K.blob(x + 0.6 * s, 0.02, z + 0.4 * s, 2.9 * s, 2.5 * s, 0.38);
    return true;
  };
  for (let x = -(hw + 16); x <= hw + 16; x += K.rnd(4.5, 6.5)) plantTree(x + K.rnd(-1, 1), fz - K.rnd(2.8, 6), K.rnd(0.85, 1.25), K.R() < 0.25 ? 'pine' : 'round');
  for (const s of [-1, 1]) {
    for (let i = 0; i < 12; i++) {
      const x = s * (hw + K.rnd(5.5, 22)), z = K.rnd(-(hd + 4), hd + 6);
      plantTree(x, z, K.rnd(0.7, 1.15), K.R() < 0.3 ? 'pine' : 'round');
    }
  }
  // Rolling hills behind, with trees dotted on them.
  for (let i = 0; i < 14; i++) {
    const x = K.rnd(-(hw + 60), hw + 60), z = -(hd + K.rnd(15, 48)), rx = K.rnd(11, 22), ry = K.rnd(3.5, 8.5), rz = K.rnd(8, 14);
    const h = dome(rx, ry, rz, K.pick(GREENS), x, -0.3, z, 18, 6);
    shadeY(h, 0, ry, 0.82, 1.08);
    K.matte.push(h);
    if (K.R() < 0.7) { const tx = x + K.rnd(-rx, rx) * 0.4, tz = z + K.rnd(-rz, rz) * 0.3; K.add(farTree(K, 5, 1.7, K.pick([0x4fb04f, 0x5cbf55])), tx, ry * 0.8, tz); }
  }
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) {
    const h = dome(K.rnd(9, 15), K.rnd(3, 6), K.rnd(9, 14), K.pick(GREENS), s * (hw + K.rnd(26, 40)), -0.3, K.rnd(-hd, hd + 10), 20, 6);
    shadeY(h, 0, 6, 0.85, 1.06);
    K.matte.push(h);
  }

  // Ground: soft patches, a path along the near side, flowers and grass tufts.
  const dots = [];
  for (let i = 0; i < 60; i++) {
    const [x, z] = K.around(2.5, 26, 16), r = K.rnd(1.6, 4.5);
    if (!K.free(x, z, r * 0.6)) continue;
    dots.push([x, 0.01 + (i % 4) * 0.01, z, r, K.pick([0x80c25c, 0x8dcb66, 0x7aba57, 0x93ce6b]), 20, 1, K.rnd(0.6, 1.0), K.R() * PI]);
  }
  const pathZ = hd + 3.9 + 3.4 * K.ns;
  const pw = [];
  for (let x = -(hw + 24); x < hw + 24; x += 1.5) {
    const z0 = pathZ + Math.sin(x * 0.12) * 1.4, z1 = pathZ + Math.sin((x + 1.5) * 0.12) * 1.4;
    pw.push(tris([[x, 0.06, z0 - 1.1], [x + 1.5, 0.06, z1 - 1.1], [x + 1.5, 0.06, z1 + 1.1], [x, 0.06, z0 - 1.1], [x + 1.5, 0.06, z1 + 1.1], [x, 0.06, z0 + 1.1]], 0xe9d2a1));
  }
  jitter(pw, K.R, 0.1);
  K.flat.push(...pw);
  for (let i = 0; i < 26; i++) {
    const x = K.rnd(-(hw + 20), hw + 20), z = pathZ + Math.sin(x * 0.12) * 1.4 + K.rnd(-0.8, 0.8);
    dots.push([x, 0.075, z, K.rnd(0.14, 0.24), 0xd8c095, 9]);
  }
  // a flower border along the near side (the part of the world seen at every level start)
  for (let x = -(hw + 8); x <= hw + 8; x += K.rnd(1.7, 2.6)) {
    const z = hd + K.rnd(2.5, 3.7);
    K.add(flowerClump(K, K.rnd(0.7, 1.05), K.pick(FLOWER)), x, 0, z);
    K.claim(x, z, 0.8);
  }
  for (let i = 0; i < 30; i++) {
    const [x, z] = K.around(2.5, 20, 16);
    if (!K.free(x, z, 0.9) || Math.abs(z - pathZ - Math.sin(x * 0.12) * 1.4) < 1.8) continue;
    K.add(flowerClump(K, K.rnd(0.7, 1.1), K.pick(FLOWER)), x, 0, z);
  }
  for (let i = 0; i < 260; i++) {
    const [x, z] = K.around(1.6, 24, 16);
    if (Math.abs(z - pathZ - Math.sin(x * 0.12) * 1.4) < 1.4) continue;
    dots.push([x, 0.09, z, 0.14, K.pick([0xffffff, 0xffffff, 0xfff27a, 0xffb3d1]), 5]);
  }
  K.flat.push(discBatch(dots));
  for (let i = 0; i < 110; i++) {
    const [x, z] = K.around(1.6, 24, 16);
    if (Math.abs(z - pathZ - Math.sin(x * 0.12) * 1.4) < 1.5) continue;
    K.add(tuft(K, K.rnd(0.6, 1.0), 0x5aa844), x, 0, z);
  }
  for (const s of [-1, 1]) { K.add(bush(K, 1.2, 0x5cbf55), s * (hw + 3.2), 0, hd + 3.6); K.blob(s * (hw + 3.2), 0.02, hd + 3.6, 2.0, 1.8, 0.35); }
  // A big shady tree with a rope swing beside the board (right side).
  K.add(swingTree(K), stx, 0, stz);
  K.blob(stx - 1.5, 0.02, stz + 0.5, 5.5, 4.5, 0.42);
  K.blob(stx - 4.2, 0.02, stz, 1.0, 0.7, 0.3);

  const nb = Math.max(4, Math.round(K.hw / 2.5)), bsp = [];
  for (let i = 0; i < nb; i++) bsp.push([K.rnd(-(hw + 5), hw + 5), K.rnd(1.3, 1.8), hd + K.rnd(4.0, 4.8)]);
  butterflies(K, bsp);
  // A red kite tugging at the sky over the far right, and clouds.
  const kite = [tris([[0, 0, 0], [0.9, 0.9, 0.05], [0, 2.4, 0], [0, 0, 0], [0, 2.4, 0], [-0.9, 0.9, 0.05]], 0xff5a6e, new THREE.Vector3(0, 0.2, 1)),
    tris([[0, 0, 0.02], [0.9, 0.9, 0.07], [0, 0.9, 0.04]], 0xffd23f, new THREE.Vector3(0, 0.2, 1)), rod([0, 0, 0], [-1.6, -5.5, 2.0], 0.03, 0.03, WHITE, 3)];
  for (let i = 0; i < 4; i++) kite.push(custom(new THREE.BoxGeometry(0.35, 0.18, 0.05).rotateZ(0.6).translate(0.2 * Math.sin(i), -0.9 - i * 0.9, 0.1), FLOWER[i]));
  const km = new THREE.Mesh(merge(twoSided(kite)), new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 30, specular: 0x242424 }));
  km.name = 'kite'; km.position.set(hw + 9, 9.5, -(hd + 11));
  K.meshes.push(km);
  K.tick.push((t) => { km.rotation.z = Math.sin(t * 1.3) * 0.18; km.position.y = 9.5 + Math.sin(t * 0.9) * 0.5; km.position.x = hw + 9 + Math.sin(t * 0.5) * 0.8; });
  const span = hw + 70, cl = [];
  for (let i = 0; i < 5; i++) cl.push([K.rnd(-span, span), K.rnd(7.5, 11), -(hd + K.rnd(14, 34)), K.rnd(1.6, 2.6)]);
  cloudLayer(K, cl, span);
}
// A little pond: muddy rim, glossy water (cut by the hole like the ground), lily pads,
// pebbles, cattails and a family of ducks swimming in a slow circle.
function pondWithDucks(K, px, pz, prx, prz) {
  const G = K.glossy;
  const pond = (r, col, y) => {
    const g = new THREE.CircleGeometry(1, 40).rotateX(-PI / 2), p = g.attributes.position;
    for (let i = 1; i < p.count; i++) { const a = Math.atan2(p.getZ(i), p.getX(i)), k = r * (1 + Math.sin(a * 3 + 1) * 0.07 + Math.sin(a * 5 + 2) * 0.04); p.setXYZ(i, p.getX(i) * k * prx, y, p.getZ(i) * k * prz); }
    p.setY(0, y);
    return custom(g.translate(px, 0, pz), col);
  };
  K.flat.push(pond(1.12, 0xbfa26a, 0.006));
  const water = pond(1.0, 0x5cc8ef, 0.012);
  recolor(water, (x, y, z, c) => c.lerp(new THREE.Color(0xa8ecff), clamp01(Math.hypot((x - px) / prx, (z - pz) / prz) - 0.25)));
  const wm = new THREE.Mesh(merge([water]), patchGround(new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 90, specular: 0xffffff })));
  wm.name = 'pond'; wm.receiveShadow = true;
  K.meshes.push(wm);
  for (let i = 0; i < 5; i++) {
    const a = K.R() * TAU, d = K.rnd(0.3, 0.75);
    G.push(custom(new THREE.CircleGeometry(K.rnd(0.5, 0.8), 10, 0.4, TAU - 0.8).rotateX(-PI / 2).rotateY(K.R() * TAU).translate(px + Math.cos(a) * prx * d, 0.03, pz + Math.sin(a) * prz * d), 0x4fae4f));
  }
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU + K.R() * 0.2;
    G.push(ballC(K.rnd(0.35, 0.6), K.pick([0xb8b2a8, 0xcfc8bc, 0xa39d94]), px + Math.cos(a) * prx * 1.08, 0.12, pz + Math.sin(a) * prz * 1.08, 0, 0.55));
  }
  for (const a of [2.2, 3.4, 5.6]) {
    const rx0 = px + Math.cos(a) * prx * 0.95, rz0 = pz + Math.sin(a) * prz * 0.95;
    for (let i = 0; i < 6; i++) {
      const x = rx0 + K.rnd(-0.5, 0.5), z = rz0 + K.rnd(-0.5, 0.5), h = K.rnd(1.6, 2.6), lean = K.rnd(-0.25, 0.25);
      G.push(rod([x, 0, z], [x + lean, h, z], 0.06, 0.04, 0x5c9e3c, 4), cyl(0.13, 0.13, 0.55, 0x8a5a33, x + lean * 0.82, h * 0.72, z, 6));
    }
  }
  // Ducks swim in a slow circle.
  const ducks = [];
  [[2.3, 0, 1.0, WHITE], [2.3, 0.9, 0.55, 0xffe066], [2.3, 1.45, 0.55, 0xffe066], [2.3, PI, 1.0, WHITE], [2.3, PI + 0.8, 0.55, 0xffe066]].forEach(([r, a, s, c]) => {
    const d = duck(c);
    ducks.push(...put(d, Math.cos(a) * r, 0, Math.sin(a) * r, PI / 2 - a, s));
  });
  const dm = new THREE.Mesh(merge(ducks), new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 40, specular: 0x333333 }));
  dm.name = 'ducks'; dm.position.set(px, 0.02, pz);
  K.meshes.push(dm);
  K.tick.push((t) => { dm.rotation.y = t * 0.16; dm.position.y = 0.02 + Math.sin(t * 2.1) * 0.03; });
}
function swingTree(K) {
  const p = roundTree(K, 11, 3.8, 0x5cbf55);
  p.push(rod([0, 6.0, 0], [-4.8, 7.4, 0.2], 0.42, 0.26, 0x9a6a44));
  p.push(...shadeY([ballC(1.5, 0x5cbf55, -4.6, 8.0, 0.2, 1), ballC(1.1, 0x6ccb5e, -3.6, 8.6, -0.6, 1)], 6.8, 9.6, 0.68, 1.12));
  for (const dz of [-0.75, 0.75]) p.push(rod([-4.2, 7.2, dz], [-4.2, 1.35, dz], 0.05, 0.05, 0xe8d6b0, 4));
  p.push(box(1.0, 0.18, 1.9, 0xd98c5a, -4.2, 1.25, 0));
  return p;
}
function duck(body) {
  const beak = 0xff9a2e;
  return [egg(0.8, 0.5, 0.55, body, 0, 0.32, 0, 10, 6), ballC(0.36, body, 0.62, 0.8, 0, 1), egg(0.26, 0.09, 0.15, beak, 0.98, 0.76, 0, 6, 4),
    egg(0.3, 0.2, 0.2, body, -0.72, 0.6, 0, 8, 6), ballC(0.06, INK, 0.82, 0.92, 0.2, 0), ballC(0.06, INK, 0.82, 0.92, -0.2, 0)];
}

// ============================================================== GARDEN
function garden(K) {
  const { hw, hd } = K;
  K.shadow = 0x234a1c;
  const G = K.glossy;
  const HEDGE = 0x4aa851, SOIL = 0x7a5232, BEDW = 0xb07a4c;

  // Ground patches + clover sprinkle.
  const dots = [];
  for (let i = 0; i < 50; i++) {
    const [x, z] = K.around(2.6, 26, 16), r = K.rnd(1.5, 4.0);
    dots.push([x, 0.01 + (i % 4) * 0.01, z, r, K.pick([0x67ad4c, 0x7bbd57, 0x62a648]), 14, 1, K.rnd(0.6, 1.0), K.R() * PI]);
  }
  for (let i = 0; i < 200; i++) { const [x, z] = K.around(1.6, 24, 16); dots.push([x, 0.06, z, 0.13, K.pick([0xffffff, 0xfff27a, 0xffc2dc]), 5]); }
  K.flat.push(discBatch(dots));
  const blossoms = [];

  // Stepping stones: from the near rail toward the camera, and from the far rail to the gate.
  const stones = (x0, z0, dir, n, sc) => {
    for (let i = 0; i < n; i++) {
      const x = x0 + Math.sin(i * 0.9) * 0.55 * sc, z = z0 + dir * i * 1.55 * sc, r = K.rnd(0.5, 0.66) * sc;
      G.push(...put([cyl(r, r * 1.06, 0.13, K.pick([0xcfc9bf, 0xd8d3c9, 0xc4beb3]), 0, 0, 0, 9)], x, 0, z, K.R() * TAU, [K.rnd(1.0, 1.3), 1, K.rnd(0.8, 1.0)]));
      K.blob(x, 0.015, z, r * 1.25, r * 1.1, 0.18);
    }
  };
  stones(0, hd + 2.3, 1, Math.round(13 / Math.max(0.8, K.ns)), K.ns);
  stones(0, -(hd + 2.4), -1, 7, 1);

  // Raised flowerbeds in two rows on the near side (low), split for the path.
  const bed = (x0, x1, z, d, fs = 1) => {
    const L = x1 - x0, cx = (x0 + x1) / 2;
    G.push(box(L, 0.5, 0.25, BEDW, cx, 0, z - d / 2 + 0.12), box(L, 0.5, 0.25, BEDW, cx, 0, z + d / 2 - 0.12));
    G.push(box(0.25, 0.5, d, BEDW, x0 + 0.12, 0, z), box(0.25, 0.5, d, BEDW, x1 - 0.12, 0, z));
    K.flat.push(rectXZ(x0 + 0.2, x1 - 0.2, z - d / 2 + 0.2, z + d / 2 - 0.2, 0.42, SOIL));
    const rows = Math.max(1, Math.round(d / (1.1 * fs))), col = K.pick(FLOWER), col2 = K.pick(FLOWER);
    for (let r = 0; r < rows; r++) for (let x = x0 + 0.7 * fs; x < x1 - 0.5 * fs; x += 0.95 * fs) {
      const zz = z - d / 2 + (r + 0.5) * (d / rows), c = r % 2 ? col : col2;
      G.push(cone(0.36 * fs, 0.5, 0x4fa64a, x, 0.45, zz, 5), disc(0.3 * fs, c, x, 0.98, zz, 7), disc(0.12 * fs, 0xffe066, x, 1.0, zz, 5));
    }
    K.blob(cx, 0.015, z, L / 2 + 0.4, d / 2 + 0.4, 0.25);
  };
  const rowSpan = hw + 7, fs = K.ns, d1 = 2.0 * fs, d2 = 2.2 * fs;
  for (const [z, d] of [[hd + 1.4 + d1 / 2, d1], [hd + 1.4 + d1 + 2.1 * fs + d2 / 2, d2]]) {
    for (const s of [-1, 1]) {
      let a = 1.4 * fs;
      while (a < rowSpan - 1.5) {
        const len = Math.min(K.rnd(5, 7) * fs, rowSpan - a);
        bed(s > 0 ? a : -(a + len), s > 0 ? a + len : -a, z, d, fs);
        a += len + 1.3 * fs;
      }
    }
  }

  const ngb = Math.max(4, Math.round(K.hw / 2.5)), gsp = [];
  for (let i = 0; i < ngb; i++) gsp.push([K.rnd(-(hw + 5), hw + 5), K.rnd(1.3, 1.7), hd + 1.4 + d1 + 1.05 * fs + K.rnd(0.6, 1.2)]);
  butterflies(K, gsp);
  // Hedges along both sides with topiary balls at the ends; long beds beyond them.
  for (const s of [-1, 1]) {
    let z = -(hd + 1.5);
    while (z < hd + 1.5) {
      const len = Math.min(K.rnd(6, 9), hd + 1.5 - z);
      if (len > 1.5) {
        const hx = s * (hw + 2.9), h = rbox(1.9, 2.5, len, HEDGE, hx, 0, z + len / 2, 0.55);
        shadeY(h, 0, 2.5, 0.7, 1.12); tintY(h, 1.5, 2.5, 0xa6dc72, 0.3);
        G.push(h);
        for (let k = 0; k < len * 1.3; k++) blossoms.push([hx + K.rnd(-0.75, 0.75), 2.52, z + K.rnd(0.4, len - 0.4), 0.15, K.pick([0xffffff, 0xffc2dc, 0xfff27a]), 6]);
        K.blob(hx + 0.4, 0.015, z + len / 2, 1.6, len / 2 + 0.6, 0.38);
      }
      z += len + 1.2;
    }
    for (const z2 of [-(hd + 2.6), hd + 2.6]) {
      K.add([cyl(0.7, 0.55, 1.1, 0xe9895f, 0, 0, 0, 10), cyl(0.12, 0.12, 0.8, 0x8a5a3a, 0, 1.0, 0, 5), ...shadeY([ballC(1.15, HEDGE, 0, 2.85, 0, 2)], 1.7, 4.0, 0.7, 1.12)], s * (hw + 2.9), 0, z2);
      K.blob(s * (hw + 2.9), 0.015, z2, 1.3, 1.3, 0.35);
    }
    for (let z3 = -(hd - 1); z3 < hd - 1; z3 += 7) bedAlongZ(K, s * (hw + 7.2), z3, Math.min(5.6, hd - 1 - z3), 2.2, BEDW, SOIL);
  }

  G.push(discBatch(blossoms));
  // Bird bath on the left, sunflowers along the right.
  K.add(birdBath(), -(hw + 11), 0, hd * 0.15);
  K.blob(-(hw + 11), 0.015, hd * 0.15, 1.8, 1.8, 0.4);
  for (let i = 0; i < 6; i++) {
    const x = hw + 11 + K.rnd(-0.6, 0.6), z = -hd * 0.6 + i * 2.1;
    K.add(sunflower(K, K.rnd(4.2, 5.6)), x, 0, z, K.rnd(-0.4, 0.4));
    K.blob(x, 0.015, z, 1.0, 1.0, 0.3);
  }

  // Far side: shed (left), greenhouse (right), picket fence with a rose arch gate.
  const fz = -(hd + 12.5);
  const shedX = -(Math.max(hw * 0.5, 4) + 4.5), ghX = Math.max(hw * 0.5, 4) + 4.5;
  K.add(shed(K), shedX, 0, -(hd + 7.2));
  K.blob(shedX + 0.5, 0.015, -(hd + 7.0), 4.6, 3.8, 0.42);
  K.add(greenhouse(K), ghX, 0, -(hd + 7.6));
  K.blob(ghX + 0.4, 0.015, -(hd + 7.6), 5.0, 3.8, 0.32);
  G.push(...picketFence(-(hw + 15), fz, -1.9, fz), ...picketFence(1.9, fz, hw + 15, fz));
  for (const s of [-1, 1]) G.push(...picketFence(s * (hw + 15), fz, s * (hw + 15), hd * 0.4));
  for (let x = -(hw + 15); x < hw + 15; x += 2.5) K.blob(x, 0.015, fz + 0.35, 1.3, 0.5, 0.25);
  K.add(roseArch(K), 0, 0, fz);

  // Beyond the fence: trees and soft hills.
  for (let x = -(hw + 26); x <= hw + 26; x += K.rnd(5, 7.5)) {
    const z = fz - K.rnd(3.5, 10), s = K.rnd(0.85, 1.3);
    const t = K.R() < 0.35 ? pineTree(K, 8 * s, 2.4 * s, K.pick([0x3f9a55, 0x358a4c])) : (Math.abs(x) > hw + 6 ? farTree(K, 7.5 * s, 2.6 * s, K.pick([0x5cbf55, 0x4fb04f])) : roundTree(K, 7.5 * s, 2.6 * s, K.pick([0x5cbf55, 0x4fb04f, 0x6ccb5e])));
    K.add(t, x, 0, z, K.R() * TAU);
    K.blob(x + 0.6, 0.015, z + 0.4, 2.8 * s, 2.4 * s, 0.35);
  }
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) {
    const x = s * (hw + K.rnd(19, 30)), z = K.rnd(-(hd + 8), hd + 8), sc = K.rnd(0.8, 1.2);
    K.add(farTree(K, 7 * sc, 2.4 * sc, K.pick([0x5cbf55, 0x4fb04f])), x, 0, z, K.R() * TAU);
    K.blob(x + 0.5, 0.015, z + 0.4, 2.7 * sc, 2.3 * sc, 0.35);
  }
  for (let i = 0; i < 12; i++) {
    const rx = K.rnd(11, 20), ry = K.rnd(3.5, 7), h = dome(rx, ry, K.rnd(8, 13), K.pick([0x6fb453, 0x82c25e, 0x5fa648]), K.rnd(-(hw + 55), hw + 55), -0.3, fz - K.rnd(14, 40), 22, 7);
    shadeY(h, 0, ry, 0.82, 1.08);
    K.matte.push(h);
  }
  const span = hw + 70, cl = [];
  for (let i = 0; i < 4; i++) cl.push([K.rnd(-span, span), K.rnd(7.5, 11), fz - K.rnd(6, 26), K.rnd(1.6, 2.5)]);
  cloudLayer(K, cl, span);
}
function bedAlongZ(K, x, z0, len, d, wood, soil) {
  if (len < 2) return;
  const z1 = z0 + len, cz = (z0 + z1) / 2;
  K.glossy.push(box(0.25, 0.5, len, wood, x - d / 2 + 0.12, 0, cz), box(0.25, 0.5, len, wood, x + d / 2 - 0.12, 0, cz), box(d, 0.5, 0.25, wood, x, 0, z0 + 0.12), box(d, 0.5, 0.25, wood, x, 0, z1 - 0.12));
  K.flat.push(rectXZ(x - d / 2 + 0.2, x + d / 2 - 0.2, z0 + 0.2, z1 - 0.2, 0.42, soil));
  const c = K.pick(FLOWER);
  for (let z = z0 + 0.7; z < z1 - 0.5; z += 0.95) for (const dx of [-0.5, 0.5]) {
    K.glossy.push(cyl(0.3, 0.16, 0.45, c, x + dx, 1.0, z, 5), ballC(0.3, 0x58ad4c, x + dx, 0.62, z, 0, 0.6));
  }
  K.blob(x, 0.015, cz, d / 2 + 0.4, len / 2 + 0.4, 0.25);
}
function birdBath() {
  return [lathe([[1.0, 0], [1.0, 0.25], [0.45, 0.45], [0.32, 1.4], [0.4, 2.2], [0.6, 2.4], [1.55, 2.6], [1.65, 2.95], [1.4, 3.0], [1.2, 2.75], [0, 2.7]], 0xe2ddd3, 16),
    disc(1.25, 0x7fd6f2, 0, 2.86, 0, 16), ...put(birdOnRim(), 1.2, 2.95, 0.4, 2.4)];
}
function birdOnRim() { return [egg(0.42, 0.3, 0.3, 0x5fa8ff, 0, 0.3, 0, 10, 7), ballC(0.22, 0x5fa8ff, 0.38, 0.55, 0, 1), custom(new THREE.ConeGeometry(0.07, 0.2, 4).rotateZ(-PI / 2).translate(0.66, 0.55, 0), 0xffb02e), egg(0.3, 0.12, 0.16, 0x3f86e0, -0.42, 0.42, 0, 8, 5), ballC(0.15, 0xff8a5a, 0.18, 0.18, 0, 1)]; }
function sunflower(K, h) {
  const p = [cyl(0.1, 0.13, h, 0x4f9a3a, 0, 0, 0, 5)];
  for (let i = 0; i < 2; i++) p.push(egg(0.7, 0.12, 0.35, 0x58ad4c, (i ? -1 : 1) * 0.55, h * (0.4 + i * 0.2), 0, 8, 4));
  // Petals as one pointed star (two layers, offset) instead of 12 little spheres.
  const head = [shapeZ(starShape(1.25, 0.55, 12), 0xffd23f, 0, 0, 0), custom(new THREE.ShapeGeometry(starShape(1.05, 0.6, 12)).rotateZ(PI / 12).translate(0, 0, 0.03), 0xffb52e),
    cyl(0.55, 0.55, 0.25, 0x7a4a22, 0, 0, 0.05, 12, PI / 2)];
  p.push(...put(head, 0, h, 0.2, 0, 1, -0.9));
  return p;
}
function shed(K) {
  const W = 7, H = 5.2, D = 5.5, WOOD = 0xb88355, WOODD = 0x9a6a42, ROOF = 0xe8556a;
  const walls = boxS(W, H, D, WOOD, 0, 0, 0, 1, 1, 1);
  const p = [walls];
  for (let x = -W / 2 + 0.7; x < W / 2; x += 0.7) p.push(box(0.06, H, 0.05, WOODD, x, 0, D / 2 + 0.02));
  p.push(roofSlab(W + 1.3, 2.7, D + 1.2, 0.4, ROOF, H - 0.1));
  p.push(custom(new THREE.ExtrudeGeometry(gableShape(W, 2.4), { depth: D, bevelEnabled: false }).translate(0, H, -D / 2), WOOD));
  p.push(box(2.0, 3.8, 0.12, 0x7fc8a8, -1.2, 0, D / 2 + 0.06), vdisc(0.45, 0xbfe8ff, -1.2, 3.0, D / 2 + 0.14, 12), ballC(0.13, GOLD, -0.45, 1.9, D / 2 + 0.2, 1));
  p.push(box(1.8, 1.5, 0.12, WHITE, 1.7, 2.3, D / 2 + 0.06), box(1.5, 1.2, 0.08, 0xbfe8ff, 1.7, 2.45, D / 2 + 0.11), box(2.1, 0.5, 0.6, 0x9a6a42, 1.7, 1.75, D / 2 + 0.35));
  for (let i = 0; i < 4; i++) p.push(ballC(0.26, K.pick(FLOWER), 1.0 + i * 0.47, 2.35, D / 2 + 0.4, 0));
  p.push(...put(wheelbarrow(), -W / 2 - 1.6, 0, 1.2, 0.5, 0.7));
  shadeY(p.slice(0, 1), 0, H, 0.85, 1.02);
  return p;
}
function roofSlab(w, h, d, t, col, y = 0) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0); s.lineTo(0, h); s.lineTo(w / 2, 0); s.lineTo(w / 2 - t * 1.3, 0); s.lineTo(0, h - t * 1.4); s.lineTo(-w / 2 + t * 1.3, 0); s.lineTo(-w / 2, 0);
  return custom(new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false }).translate(0, y, -d / 2), col);
}
function gableShape(w, h) { const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, h); s.lineTo(-w / 2, 0); return s; }
function wheelbarrow() {
  return [lathe([[0.4, 0], [1.3, 0.1], [1.5, 0.9], [1.3, 0.9], [0, 0.3]], 0x6fb8ff, 12, 0, 0.7, 0), dome(1.2, 0.35, 1.2, 0x7a5232, 0, 1.45, 0, 10, 3),
    torus(0.42, 0.13, INK, 1.6, 0.45, 0, 0, 12), rod([1.4, 0.6, 0], [-1.9, 1.0, 0.6], 0.07, 0.07, 0x9a6a42), rod([1.4, 0.6, 0], [-1.9, 1.0, -0.6], 0.07, 0.07, 0x9a6a42)];
}
function greenhouse(K) {
  const W = 8, H = 4.2, D = 6, RH = 2.6, F = WHITE;
  const s = [box(W, 0.8, D, 0xd9cfc2, 0, 0, 0)], g = [];
  for (const x of [-W / 2, -W / 4, 0, W / 4, W / 2]) for (const z of [-D / 2, D / 2]) s.push(box(0.16, H, 0.16, F, x, 0.8, z));
  for (const z of [-D / 2, -D / 6, D / 6, D / 2]) for (const x of [-W / 2, W / 2]) s.push(box(0.16, H, 0.16, F, x, 0.8, z));
  for (const y of [0.8 + H]) { s.push(box(W, 0.16, 0.16, F, 0, y, D / 2), box(W, 0.16, 0.16, F, 0, y, -D / 2), box(0.16, 0.16, D, F, W / 2, y, 0), box(0.16, 0.16, D, F, -W / 2, y, 0)); }
  s.push(box(W + 0.2, 0.18, 0.18, F, 0, 0.8 + H + RH, 0));
  for (const x of [-W / 2, -W / 4, 0, W / 4, W / 2]) s.push(rod([x, 0.8 + H, D / 2], [x, 0.8 + H + RH, 0], 0.08, 0.08, F, 4), rod([x, 0.8 + H, -D / 2], [x, 0.8 + H + RH, 0], 0.08, 0.08, F, 4));
  g.push(box(W, H, D, 0xcff3ff, 0, 0.8, 0));
  g.push(tris([[-W / 2, 0.8 + H, D / 2], [W / 2, 0.8 + H, D / 2], [W / 2, 0.8 + H + RH, 0], [-W / 2, 0.8 + H, D / 2], [W / 2, 0.8 + H + RH, 0], [-W / 2, 0.8 + H + RH, 0]], 0xcff3ff, new THREE.Vector3(0, 1, 1)));
  g.push(tris([[-W / 2, 0.8 + H, -D / 2], [W / 2, 0.8 + H, -D / 2], [W / 2, 0.8 + H + RH, 0], [-W / 2, 0.8 + H, -D / 2], [W / 2, 0.8 + H + RH, 0], [-W / 2, 0.8 + H + RH, 0]], 0xcff3ff, new THREE.Vector3(0, 1, -1)));
  for (let i = 0; i < 7; i++) {
    const x = -W / 2 + 1 + i * (W - 2) / 6, z = K.rnd(-1.5, 1.5);
    s.push(cyl(0.45, 0.35, 0.7, 0xe9895f, x, 0.8, z, 8), ballC(K.rnd(0.6, 0.95), K.pick([0x4fb04f, 0x5cbf55, 0x6ccb5e]), x, 1.5, z, 1));
    if (K.R() < 0.6) s.push(ballC(0.22, K.pick([0xff5a5f, 0xffd23f]), x + 0.3, 2.2, z + 0.3, 0));
  }
  return { s, g };
}
function roseArch(K) {
  const p = [];
  for (const s of [-1, 1]) p.push(box(0.5, 4.2, 0.5, WHITE, s * 1.9, 0, 0));
  p.push(custom(new THREE.TorusGeometry(1.9, 0.22, 6, 20, PI).translate(0, 4.2, 0), WHITE));
  for (let i = 0; i < 26; i++) {
    const a = K.R() * PI, onPost = K.R() < 0.45, s = K.R() < 0.5 ? -1 : 1;
    const x = onPost ? s * 1.9 + K.rnd(-0.3, 0.3) : Math.cos(a) * 1.9, y = onPost ? K.rnd(0.8, 4.2) : 4.2 + Math.sin(a) * 1.9;
    p.push(ballC(K.rnd(0.35, 0.5), 0x4fa64a, x, y, K.rnd(-0.3, 0.3), 0));
    if (K.R() < 0.6) p.push(ballC(0.22, K.pick([0xff5a7e, 0xff8fab, 0xffffff]), x + K.rnd(-0.2, 0.2), y + 0.25, 0.35, 1));
  }
  return p;
}

// ============================================================== BEACH
function beach(K) {
  const { hw, hd } = K;
  K.shadow = 0x9a6a3a; K.surroundY = -1.5;
  const G = K.glossy;
  const SH = -(hd + 7.5);
  const shoreAt = (x) => SH + Math.sin(x * 0.11 + 0.7) * 1.2 + Math.sin(x * 0.047 + 2.1) * 1.6;
  const SAND = new THREE.Color(0xf6dea6), WET = new THREE.Color(0xd9b97c), DRY = new THREE.Color(0xfbe8bb);

  // Sand around the board (darker and wetter toward the waterline).
  const X0 = hw + 0.5, Z0 = hd + 0.5, EX = hw + 120;
  const sand = [
    rectXZ(-EX, EX, Z0, hd + 80, 0, 0xffffff, 40, 12), rectXZ(-EX, EX, SH - 6, -Z0, 0, 0xffffff, 80, 12),
    rectXZ(X0, EX, -Z0, Z0, 0, 0xffffff, 20, 10), rectXZ(-EX, -X0, -Z0, Z0, 0, 0xffffff, 20, 10),
  ];
  for (const g of sand) {
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const under = shoreAt(p.getX(i)) - p.getZ(i); if (under > 0) p.setY(i, -0.6 * smooth(0, 5, under)); }
  }
  recolor(sand, (x, y, z, c) => {
    const d = z - shoreAt(x);
    c.copy(SAND).lerp(DRY, 0.5 + 0.5 * Math.sin(x * 0.23 + z * 0.17) * Math.sin(x * 0.07 - z * 0.11));
    c.lerp(WET, 1 - smooth(0, 4.5, d));
  });
  K.flat.push(...sand);

  // Ocean with rolling swell, a washing waterline and foam lines (one shader mesh).
  K.meshes.push(ocean(K, shoreAt, SH));

  // Dunes with beach grass.
  for (let i = 0; i < 16; i++) {
    const [x, z] = K.around(4.5, 26, 14);
    if (z < SH + 6 || (Math.abs(x) < hw + 3 && z > 0)) continue;
    const rx = K.rnd(3, 7), ry = K.rnd(0.8, 1.9), rz = K.rnd(2.5, 5);
    if (Math.abs(x) - rx < hw + 1.6 && Math.abs(z) - rz < hd + 1.6) continue;
    if (!K.free(x, z, Math.max(rx, rz) * 0.7)) continue;
    K.claim(x, z, Math.max(rx, rz) * 0.6);
    const dn = dome(rx, ry, rz, 0xf3d79a, x, -0.15, z, 18, 5);
    shadeY(dn, 0, ry, 0.9, 1.06);
    K.matte.push(dn);
    for (let k = 0; k < 5; k++) K.add(tuft(K, K.rnd(0.9, 1.5), 0x8cbf4a), x + K.rnd(-rx, rx) * 0.5, ry * 0.55, z + K.rnd(-rz, rz) * 0.5);
  }

  // Beach huts in a row on the left, facing the board.
  const nh = Math.max(3, Math.min(5, Math.round(hd / 4.5)));
  const hutCols = [[0xff9ec8, 0xffffff, 0xff6f9c], [0x8fdcc4, 0xffffff, 0x3fbf98], [0xffe27a, 0xffffff, 0xffb52e], [0x9fd2ff, 0xffffff, 0x4f9dff], [0xc9b2ff, 0xffffff, 0x9a7cff]];
  for (let i = 0; i < nh; i++) {
    const z = -hd * 0.62 + i * 5.2, x = -(hw + 8.2);
    K.claim(x, z, 3.0);
    K.add(beachHut(K, ...hutCols[i % hutCols.length]), x, 0, z, PI / 2);
    K.blob(x + 0.4, 0.02, z, 2.8, 3.0, 0.38);
  }
  // Palms.
  const palms = [[hw + 6.2, hd * 0.25], [hw + 9.0, -hd * 0.35], [hw + 5.6, -(hd + 4.6)], [-(hw + 5.4), -(hd + 4.8)], [-(hw + 13), hd * 0.1], [-(hw + 12.5), -hd * 0.65], [hw + 14, hd * 0.6], [hw + 16, -hd * 0.6], [-(hw + 6.4), hd + 5.5]];
  for (const [x, z] of palms) {
    if (!K.free(x, z, 1.5)) continue;
    K.claim(x, z, 1.5);
    const h = K.rnd(8, 11.5), lean = K.rnd(1.2, 2.8) * (x > 0 ? 1 : -1);
    K.add(palm(K, h, lean), x, 0, z, K.rnd(-0.5, 0.5));
    K.blob(x + lean, 0.02, z, 3.2, 2.8, 0.3);
    K.blob(x, 0.02, z, 0.9, 0.9, 0.35);
  }
  // Wooden pier into the sea on the right.
  const pierX = hw + 11, p0 = shoreAt(pierX) + 4, p1 = SH - 22;
  G.push(box(3.4, 0.3, p0 - p1, 0xc9935f, pierX, 1.1, (p0 + p1) / 2));
  for (let z = p1 + 0.4; z < p0; z += 1.2) G.push(box(3.4, 0.06, 0.08, 0xa8744a, pierX, 1.41, z));
  for (let z = p1 + 0.6; z < p0; z += 3) for (const s of [-1, 1]) G.push(cyl(0.22, 0.22, 3.0, 0x9a6a42, pierX + s * 1.5, -1.6, z, 6), cyl(0.12, 0.12, 1.4, 0x9a6a42, pierX + s * 1.6, 1.4, z, 5));
  for (const s of [-1, 1]) G.push(box(0.14, 0.14, p0 - p1, 0xdaa673, pierX + s * 1.6, 2.5, (p0 + p1) / 2));
  G.push(torus(0.6, 0.18, 0xff5a5f, pierX + 1.72, 2.0, p1 + 6, 0, 14));
  for (let z = p1 + 1; z < p0; z += 3) K.blob(pierX, 0.03, z + 0.6, 2.2, 1.6, 0.18);
  // Rocks at the waterline.
  for (const x of [-(hw + 6), hw * 0.45, hw + 19, -(hw + 23)]) {
    const z = shoreAt(x) + 1.0;
    for (let k = 0; k < 3; k++) G.push(ballC(K.rnd(0.3, 0.6), K.pick([0xd2c6b2, 0xc4b8a4, 0xe0d6c4]), x + K.rnd(-0.9, 0.9), 0.08, z + K.rnd(-0.5, 0.5), 1, 0.55));
  }

  // Near side, all low: towels with a hat and flip-flops, footprints, a little sand mound.
  const towel = (cols) => {
    const p = [];
    cols.forEach((c, i) => p.push(rectXZ(-1.4, 1.4, -2.4 + i * (4.8 / cols.length), -2.4 + (i + 1) * (4.8 / cols.length), 0.03, c)));
    return p;
  };
  const ns = K.ns, tx = Math.max(3.6, hw * 0.5), tz = hd + 2.3 + 2.4 * ns;
  K.add({ s: towel([0xff6f9c, 0xffffff, 0xff6f9c, 0xffffff, 0xff6f9c, 0xffffff]) }, -tx, 0, tz, 0.3, 0.8 * ns);
  K.add({ s: towel([0x4fa3ff, 0xffe27a, 0x4fa3ff, 0xffe27a, 0x4fa3ff]) }, tx, 0, tz + 0.5 * ns, -0.35, 0.8 * ns);
  K.add([dome(0.62, 0.45, 0.62, 0xffe08a, 0, 0.05, 0, 14, 4), disc(1.15, 0xffe08a, 0, 0.06, 0, 18), torus(0.65, 0.07, 0xff6f9c, 0, 0.11, 0, PI / 2, 16)], -tx + 0.3 * ns, 0, tz - 0.9 * ns, 0, ns);
  for (const dx of [-0.3, 0.3]) K.add([egg(0.24, 0.05, 0.5, 0x4fa3ff, 0, 0.06, 0, 8, 4), torus(0.15, 0.035, WHITE, 0, 0.11, -0.17, PI / 2, 8)], tx + (dx + 0.4) * ns, 0, tz - 1.0 * ns, 0.2, ns);
  // A heart drawn in the sand, with a trail of footprints walking up to it.
  const hcx = 0, hcz = hd + 2.4 + 4.6 * ns, hs = 1.25 * ns;
  const marks = [];
  for (let i = 0; i < 64; i++) {
    const t = (i / 64) * TAU, x = 16 * Math.pow(Math.sin(t), 3), y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    marks.push([hcx + x * 0.1 * hs, 0.02, hcz - y * 0.1 * hs, 0.2, 0xd2ae70, 7]);
  }
  let fx = -(hw + 3), fzz = hcz + 6 * ns;
  for (let i = 0; i < 30; i++) {
    const a = Math.atan2(hcz + 1.2 - fzz, hcx - 2.4 - fx) + Math.sin(i * 0.55) * 0.22;
    fx += Math.cos(a) * 0.9; fzz += Math.sin(a) * 0.9;
    if (Math.hypot(fx - hcx + 2.4, fzz - hcz - 1.2) < 1.2) break;
    const side = i % 2 ? 1 : -1, ox = -Math.sin(a) * 0.25 * side, oz = Math.cos(a) * 0.25 * side;
    marks.push([fx + ox, 0.02, fzz + oz, 0.2, 0xd8b679, 7, 1, 1.6, -a + PI / 2]);
  }
  K.flat.push(discBatch(marks));
  K.add([dome(1.6, 0.9, 1.4, 0xf0d394, 0, 0, 0, 14, 4), rod([0, 0.8, 0], [0, 2.4, 0], 0.05, 0.05, 0x9a6a42, 4), tris([[0, 2.4, 0], [0, 1.8, 0], [0.8, 2.1, 0.05]], 0xff5a6e, new THREE.Vector3(0, 0.3, 1))], hw + 4.2, 0, hd + 6.5);

  // Sailboat on the horizon, gulls overhead, clouds over the sea.
  const boat = sailboat();
  const bm = new THREE.Mesh(merge(boat), new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 40, specular: 0x333333 }));
  bm.name = 'boat';
  const bx0 = -hw * 0.4, bz = SH - 30;
  bm.position.set(bx0, 0.3, bz);
  K.meshes.push(bm);
  K.tick.push((t) => {
    bm.position.x = bx0 + Math.sin(t * 0.045) * 12;
    bm.position.y = 0.3 + Math.sin(t * 1.4) * 0.12;
    bm.rotation.z = Math.sin(t * 1.1) * 0.05; bm.rotation.x = Math.sin(t * 0.8 + 1) * 0.03;
  });
  const uT = { value: 0 }, gl = [];
  [[7.0, 0.0, 5.6], [8.5, 2.0, 6.2], [6.0, 3.4, 6.8], [9.5, 4.6, 5.2]].forEach(([r, a, y], i) => {
    const g = gull();
    setFlap(g, (x, yy, z) => clamp01((Math.abs(z) - 0.25) / 1.4), i * 1.7);
    gl.push(...put(g, Math.cos(a) * r, y, Math.sin(a) * r, PI / 2 - a, 0.72));
  });
  const gm = new THREE.Mesh(merge(gl), flapMaterial(uT, 7.5, 0.45));
  gm.name = 'gulls'; gm.position.set(hw * 0.2, 0, -(hd + 15));
  K.meshes.push(gm);
  K.tick.push((t) => { uT.value = t; gm.rotation.y = t * 0.32; });
  const span = hw + 70, cl = [];
  for (let i = 0; i < 6; i++) cl.push([K.rnd(-span, span), K.rnd(7, 10), SH - K.rnd(8, 28), K.rnd(1.6, 2.6)]);
  cloudLayer(K, cl, span);
}
function ocean(K, shoreAt, SH) {
  const NI = 110, NJ = 36, X = 220, DEPTH = 190;
  const pos = [], shore = [], idx = [];
  for (let j = 0; j <= NJ; j++) {
    const d = DEPTH * Math.pow(j / NJ, 1.7);
    for (let i = 0; i <= NI; i++) {
      const x = -X + (2 * X * i) / NI;
      pos.push(x, 0.03, shoreAt(x) + 0.6 - d);
      shore.push(d);
    }
  }
  for (let j = 0; j < NJ; j++) for (let i = 0; i < NI; i++) {
    const a = j * (NI + 1) + i, b = a + 1, c = a + NI + 1, d = c + 1;
    idx.push(a, b, d, a, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aShore', new THREE.Float32BufferAttribute(shore, 1));
  g.setIndex(idx);
  g.computeVertexNormals();
  if (g.attributes.normal.getY(0) < 0) { idx.reverse(); g.setIndex(idx); g.computeVertexNormals(); }
  const uTime = { value: 0 };
  const mat = new THREE.MeshPhongMaterial({ color: 0xffffff, shininess: 70, specular: 0xd8f6ff });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aShore;\nuniform float uTime;\nvarying float vShore;')
      .replace('#include <beginnormal_vertex>', `
        float wAmp = (0.10 + 0.16 * smoothstep(3.0, 40.0, aShore)) * smoothstep(0.0, 2.5, aShore);
        float ph1 = position.x * 0.31 + position.z * 0.52 + uTime * 1.45;
        float ph2 = position.x * -0.19 + position.z * 0.81 + uTime * 1.05 + 1.3;
        float wy = (sin(ph1) * 0.6 + sin(ph2) * 0.4) * wAmp;
        float dydx = (cos(ph1) * 0.6 * 0.31 + cos(ph2) * 0.4 * -0.19) * wAmp;
        float dydz = (cos(ph1) * 0.6 * 0.52 + cos(ph2) * 0.4 * 0.81) * wAmp;
        vec3 objectNormal = normalize(vec3(-dydx, 1.0, -dydz));
        #ifdef USE_TANGENT
          vec3 objectTangent = vec3( tangent.xyz );
        #endif`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        transformed.y += wy;
        float swash = sin(uTime * 0.75 + position.x * 0.045) * 0.5 + 0.5;
        transformed.z += (1.0 - smoothstep(0.0, 3.0, aShore)) * (swash * 1.6 - 0.3);
        vShore = aShore;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nvarying float vShore;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 shallow = vec3(0.30, 0.80, 0.82), mid = vec3(0.10, 0.56, 0.78), deep = vec3(0.05, 0.36, 0.66);
        vec3 wc = mix(shallow, mid, smoothstep(0.5, 9.0, vShore));
        wc = mix(wc, deep, smoothstep(12.0, 70.0, vShore));
        float edge = 1.0 - smoothstep(0.15, 0.9, vShore);
        float band = fract(vShore * 0.16 - uTime * 0.16);
        float line = smoothstep(0.0, 0.05, band) * (1.0 - smoothstep(0.05, 0.15, band)) * (1.0 - smoothstep(2.5, 12.0, vShore)) * smoothstep(0.8, 1.6, vShore);
        diffuseColor.rgb = mix(wc, vec3(1.0), clamp(edge * 0.95 + line * 0.6, 0.0, 1.0));`);
  };
  mat.customProgramCacheKey = () => 'backdrop-ocean';
  const m = new THREE.Mesh(g, mat);
  m.name = 'ocean'; m.receiveShadow = true; m.frustumCulled = false;
  K.tick.push((t) => { uTime.value = t; });
  return m;
}
function beachHut(K, col, trim, roofCol) {
  const W = 3.8, H = 4.3, D = 3.4;
  const p = [box(W + 1.0, 0.5, D + 1.8, 0xc9935f, 0, 0, 0.5)];
  for (let i = 0; i < 7; i++) p.push(box(W / 7, H, D, i % 2 ? trim : col, -W / 2 + (i + 0.5) * W / 7, 0.5, 0));
  p.push(custom(new THREE.ExtrudeGeometry(gableShape(W, 1.85), { depth: D, bevelEnabled: false }).translate(0, H + 0.5, -D / 2), trim));
  p.push(roofSlab(W + 1.0, 2.1, D + 1.0, 0.35, roofCol, H + 0.42));
  p.push(box(0.4, 0.3, D + 1.1, WHITE, 0, H + 0.42 + 1.95, 0));
  p.push(box(1.5, 3.0, 0.12, trim, 0, 0.5, D / 2 + 0.06), box(1.2, 2.7, 0.1, col, 0, 0.62, D / 2 + 0.12), ballC(0.1, GOLD, 0.45, 2.0, D / 2 + 0.2, 0));
  p.push(vdisc(0.42, 0xbfe8ff, 0, H + 1.15, D / 2 + 0.5, 12));
  return p;
}
function palm(K, h, lean) {
  const p = [], N = 8;
  const at = (t) => [lean * Math.pow(t, 1.8), h * t, 0];
  for (let i = 0; i < N; i++) {
    const a = at(i / N), b = at((i + 1) / N);
    p.push(rod(a, [b[0] * 1.0, b[1] + 0.12, b[2]], 0.55 - i * 0.035, 0.42 - i * 0.03, i % 2 ? 0xc9955f : 0xb07d4c, 7));
  }
  const top = at(1);
  const leaves = [];
  const nf = 8;
  for (let f = 0; f < nf; f++) {
    const ang = (f / nf) * TAU + K.rnd(-0.2, 0.2), len = K.rnd(4.2, 5.4), wid = K.rnd(0.75, 0.95), droop = K.rnd(0.85, 1.15);
    const pts = [], seg = 6;
    const P = (s, side) => {
      const x = s * len, y = len * (0.34 * s - 0.62 * droop * s * s), wv = wid * Math.pow(Math.sin(PI * Math.min(1, s * 1.08)), 0.8);
      return [x, y - wv * 0.22 * Math.abs(side), side * wv];
    };
    for (let k = 0; k < seg; k++) {
      const s0 = k / seg, s1 = (k + 1) / seg;
      const c0 = P(s0, 0), c1 = P(s1, 0), l0 = P(s0, -1), l1 = P(s1, -1), r0 = P(s0, 1), r1 = P(s1, 1);
      pts.push(c0, l0, l1, c0, l1, c1, c0, c1, r1, c0, r1, r0);
    }
    const fr = tris(pts, 0x4fae4f);
    recolor(fr, (x, y, z, c) => c.lerp(new THREE.Color(0x8fd65a), clamp01(1 - Math.abs(z) / wid) * 0.45));
    leaves.push(...put([fr], top[0], top[1] + 0.1, top[2], ang));
  }
  shadeY(leaves, top[1] - 4, top[1] + 1.5, 0.75, 1.1);
  p.push(...leaves);
  for (let i = 0; i < 3; i++) { const a = (i / 3) * TAU; p.push(ballC(0.36, 0x7a4a26, top[0] + Math.cos(a) * 0.4, top[1] - 0.45, Math.sin(a) * 0.4, 1)); }
  return p;
}
function sailboat() {
  const hull = [rbox(4.6, 1.0, 1.8, 0xff5a6e, 0, 0, 0, 0.4), box(4.0, 0.2, 1.4, 0xfff3e0, 0, 0.95, 0), box(4.4, 0.18, 1.82, WHITE, 0, 0.62, 0)];
  const mast = [cyl(0.09, 0.09, 6.2, 0x9a6a42, 0.3, 1.0, 0, 6)];
  const sail = twoSided([tris([[0.4, 1.4, 0], [0.4, 7.0, 0], [2.6, 1.5, 0]], WHITE, new THREE.Vector3(0, 0, 1)), tris([[0.2, 1.6, 0], [0.2, 6.2, 0], [-1.9, 1.6, 0]], 0xffe3ee, new THREE.Vector3(0, 0, 1))]);
  const flag = twoSided([tris([[0.35, 7.2, 0], [0.35, 6.7, 0], [1.1, 6.95, 0]], 0x4fa3ff, new THREE.Vector3(0, 0, 1))]);
  return [...hull, ...mast, ...sail, ...flag];
}

// ============================================================== SEASON 2 shared pieces
const SPRINKLES = [0xff5c8a, 0x5cc8ff, 0xffd23f, 0x7be07a, 0xb48cff, 0xff9a3a, 0xffffff];
// Radius of a lathe profile [[r, h], ...] at height y (piecewise linear).
function profileR(pts, y) {
  for (let i = 1; i < pts.length; i++) {
    const [r0, h0] = pts[i - 1], [r1, h1] = pts[i];
    if (y >= Math.min(h0, h1) && y <= Math.max(h0, h1) && h1 !== h0) return r0 + (r1 - r0) * ((y - h0) / (h1 - h0));
  }
  return 0;
}
// A sagging rope between two points (licorice swags, string lights).
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

// ============================================================== CANDY LAND
function candy(K) {
  const { hw, hd } = K;
  K.shadow = 0x9a4a7a;
  const G = K.glossy, ns = K.ns;
  const X0 = hw + 0.5, Z0 = hd + 0.5;
  const RZ = -(hd + 9.5), FENCE_Z = -(hd + 16);
  const riverAt = (x) => RZ + Math.sin(x * 0.075 + 1.0) * 2.0 + Math.sin(x * 0.031 + 0.4) * 1.2;
  K.claim(-(hw + 9), -hd * 0.15, 4.5);   // chocolate fountain

  // Frosting ground: pastel patches and rainbow sprinkles (one geometry), icing border at the rail.
  const dots = [];
  for (let i = 0; i < 36; i++) {
    const [x, z] = K.around(2.6, 28, 16), r = K.rnd(1.6, 3.8);
    if (Math.abs(z - riverAt(x)) < r + 3.5) continue;
    dots.push([x, 0.01 + (i % 4) * 0.01, z, r, K.pick([0xffd3ed, 0xffbfe3, 0xffdcf0, 0xf8c6ef, 0xd9f2ea]), 18, 1, K.rnd(0.6, 1.0), K.R() * PI]);
  }
  for (let i = 0; i < 300; i++) {
    const [x, z] = K.around(2.0, 26, 16);
    if (Math.abs(z - riverAt(x)) < 4) continue;
    dots.push([x, 0.07, z, 0.12, K.pick(SPRINKLES), 5, 0.42, 1.9, K.R() * PI]);
  }
  const B = 0.9, IY = 0.055;
  K.flat.push(rectXZ(-(X0 + B), X0 + B, Z0, Z0 + B, IY, WHITE), rectXZ(-(X0 + B), X0 + B, -(Z0 + B), -Z0, IY, WHITE),
    rectXZ(X0, X0 + B, -Z0, Z0, IY, WHITE), rectXZ(-(X0 + B), -X0, -Z0, Z0, IY, WHITE));
  for (let x = -(X0 + B); x <= X0 + B + 0.01; x += 1.0) dots.push([x, IY, Z0 + B, 0.5, WHITE, 8], [x, IY, -(Z0 + B), 0.5, WHITE, 8]);
  for (let z = -(Z0 + B); z <= Z0 + B + 0.01; z += 1.0) dots.push([X0 + B, IY, z, 0.5, WHITE, 8], [-(X0 + B), IY, z, 0.5, WHITE, 8]);
  K.flat.push(discBatch(dots));

  // Near side (low, seen at every level start): candy-button strips and chocolate coins.
  const bz = hd + 2.6 + 1.6 * ns;
  K.add({ f: candyButtons(5.4, 1.3) }, -hw * 0.42, 0, bz, 0.1, ns);
  K.add({ f: candyButtons(5.4, 1.3) }, hw * 0.4, 0, bz + 0.6 * ns, -0.12, ns);
  for (const [x, z] of [[-hw * 0.05, bz + 2.2 * ns], [hw * 0.16, bz + 1.5 * ns], [-hw * 0.78, bz + 2.4 * ns], [hw * 0.82, bz + 2.0 * ns], [-(hw + 4), hd + 3], [hw + 3.6, hd + 4.2]]) {
    K.add(chocCoin(), x, 0, z, K.R() * TAU, ns);
    K.blob(x, 0.02, z, 0.8 * ns, 0.8 * ns, 0.25);
  }

  // Candy-cane posts with licorice swags down both sides (hooks curl outward).
  const nc = Math.max(3, Math.round((2 * hd + 2) / 9) + 1);
  for (const s of [-1, 1]) {
    let prev = null;
    for (let i = 0; i < nc; i++) {
      const z = -(hd + 1) + (2 * hd + 2) * (i / (nc - 1)), x = s * (hw + 2.8);
      K.add(candyCane(6.2, 0.3), x, 0, z, s > 0 ? PI : 0);
      K.blob(x, 0.02, z, 0.9, 0.9, 0.35);
      const top = [x, 5.5, z];
      if (prev) swag(G, prev, top, 1.3, 0xe8325a, 0.09, 4);
      prev = top;
    }
  }

  // Lollipop trees and sugared gumdrops at the sides (bigger ones further out).
  const LOLLY = [[0xff5c8a, 0xfff1f8], [0x5cc8ff, 0xffffff], [0xffd23f, 0xff7ab8], [0x7be07a, 0xffffff], [0xb48cff, 0xffe7f6]];
  const GUM = [0x9be36b, 0xffa24a, 0xb48cff, 0xff6b8a, 0xffe066, 0x5cc8ff];
  const lolly = (x, z, h, R) => {
    if (!K.free(x, z, R + 0.6)) return;
    K.claim(x, z, R + 0.6);
    const [a, b] = K.pick(LOLLY);
    K.add(lollipopTree(K, h, R, a, b), x, 0, z, K.rnd(-0.35, 0.35));
    K.blob(x, 0.02, z + 0.6, R * 0.9, R * 0.6, 0.32);
  };
  const gum = (x, z, r) => {
    if (!K.free(x, z, r + 0.3)) return;
    K.claim(x, z, r + 0.3);
    K.add(gumdrop(K, r, r * 1.25, K.pick(GUM), true), x, 0, z, K.R() * TAU);
    K.blob(x + 0.2, 0.02, z + 0.2, r * 1.25, r * 1.1, 0.35);
  };
  for (const s of [-1, 1]) {
    lolly(s * (hw + 5.2), hd + 3.8, 6.5, 2.0);
    for (let i = 0; i < 9; i++) lolly(s * (hw + K.rnd(6, 22)), K.rnd(-(hd + 4), hd + 8), K.rnd(6, 9.5), K.rnd(1.8, 2.8));
    for (let i = 0; i < 9; i++) gum(s * (hw + K.rnd(4.6, 20)), K.rnd(-(hd + 3), hd + 9), K.rnd(0.9, 1.8));
  }
  K.add(chocoFountain(), -(hw + 9), 0, -hd * 0.15);
  K.blob(-(hw + 9), 0.02, -hd * 0.15, 4.0, 3.6, 0.38);

  // A chocolate river across the far side with cookie-crumb banks and a wafer bridge.
  const rpts = [];
  for (let x = -(hw + 80); x <= hw + 80; x += 2) rpts.push([x, riverAt(x)]);
  K.flat.push(...groundRibbon(rpts, 7.2, 0xd9a066, 0.035, K.R, 0.12));
  K.meshes.push(chocolateRiver(K, rpts, 5.2));
  K.add(waferBridge(riverAt(0)), 0, 0, 0);

  // Gingerbread fence (with gingerbread men) and a candy-cane arch gate beyond the river.
  G.push(...gingerFence(-(hw + 18), -2.6, FENCE_Z), ...gingerFence(2.6, hw + 18, FENCE_Z));
  K.add(candyCane(5.4, 0.3), -2.3, 0, FENCE_Z, PI);
  K.add(candyCane(5.4, 0.3), 2.3, 0, FENCE_Z, 0);
  for (let x = -(hw + 18); x < hw + 18; x += 2.5) K.blob(x, 0.02, FENCE_Z + 0.4, 1.3, 0.5, 0.25);

  // Beyond: gumdrop hills, more lollipops, a rainbow, cotton-candy clouds.
  for (let i = 0; i < 9; i++) {
    const r = K.rnd(5, 10), x = K.rnd(-(hw + 50), hw + 50), z = FENCE_Z - K.rnd(6, 34);
    const g = gumdrop(K, r, r * K.rnd(0.6, 0.85), K.pick(GUM), false);
    K.matte.push(...put(g, x, -0.2, z));
  }
  for (let i = 0; i < 7; i++) lolly(K.rnd(-(hw + 26), hw + 26), FENCE_Z - K.rnd(2.5, 10), K.rnd(7, 10), K.rnd(2.2, 3.0));
  const rb = [0xff7a9a, 0xffb36b, 0xffe27a, 0x9be89b, 0x8fd0ff, 0xc9a8ff];
  rb.forEach((c, i) => K.matte.push(custom(new THREE.TorusGeometry(26 - i * 1.1, 0.58, 5, 36, PI).translate(0, -3, FENCE_Z - 40), c)));
  const span = hw + 70, cl = [];
  for (let i = 0; i < 5; i++) cl.push([K.rnd(-span, span), K.rnd(7, 10.5), FENCE_Z + K.rnd(-18, 2), K.rnd(1.6, 2.5)]);
  cloudLayer(K, cl, span, [0xffc2e6, 0xc2e4ff, 0xe6d2ff]);
}
function candyButtons(L, Wd) {
  const p = [flat(L, Wd, 0xfffdf8, 0, 0.06, 0)];
  const cols = [0xff8fc4, 0x8fd0ff, 0xffe27a];
  for (let r = 0; r < 3; r++) for (let i = 0; i < 10; i++) p.push(disc(0.17, cols[(i + r) % 3], -L / 2 + (i + 0.5) * (L / 10), 0.075, -Wd / 2 + (r + 0.5) * (Wd / 3), 8));
  return p;
}
function chocCoin() {
  return [cyl(0.6, 0.6, 0.12, 0xf2b93c, 0, 0, 0, 16), torus(0.56, 0.06, 0xffd96b, 0, 0.13, 0, PI / 2, 16), disc(0.34, 0xffe08a, 0, 0.125, 0, 12)];
}
function candyCane(h, r) {
  const RED = 0xe8325a, R = 0.85, n = 7, p = [];
  for (let i = 0; i < n; i++) p.push(cyl(r, r, h / n + 0.01, i % 2 ? WHITE : RED, 0, (h / n) * i, 0, 7));
  for (let i = 0; i < 6; i++) p.push(custom(new THREE.TorusGeometry(R, r, 6, 2, PI / 6).rotateZ(i * PI / 6).translate(-R, h, 0), i % 2 ? RED : WHITE));
  p.push(cyl(r, r, 0.45, WHITE, -2 * R, h - 0.45, 0, 8), ballC(r, RED, -2 * R, h - 0.45 - r * 0.5, 0, 0));
  return p;
}
function lollipopTree(K, h, R, a, b) {
  const p = [cyl(0.16, 0.2, h, WHITE, 0, 0, 0, 8)];
  const head = [custom(new THREE.CylinderGeometry(R, R, 0.5, 24).rotateX(PI / 2), b)];
  const turns = 3, N = 56, w = (R / turns) * 0.24, pts = [];
  const at = (t, off) => { const th = t * turns * TAU, rr = Math.max(0, t * R * 0.93 + off); return [Math.cos(th) * rr, Math.sin(th) * rr, 0.26]; };
  for (let i = 0; i < N; i++) {
    const t0 = i / N, t1 = (i + 1) / N, a0 = at(t0, -w), a1 = at(t1, -w), b0 = at(t0, w), b1 = at(t1, w);
    pts.push(a0, b0, b1, a0, b1, a1);
  }
  head.push(tris(pts, a, new THREE.Vector3(0, 0, 1)));
  p.push(...put(head, 0, h + R * 0.85, 0, 0, 1, -0.32));
  p.push(...put([tris([[0, 0, 0], [0.7, 0.32, 0.05], [0.7, -0.32, 0.05], [0, 0, 0], [-0.7, -0.32, 0.05], [-0.7, 0.32, 0.05]], a, new THREE.Vector3(0, 0, 1)), ballC(0.14, a, 0, 0, 0.06, 0)], 0, h - 0.2, 0.22));
  return p;
}
function gumdrop(K, r, h, col, sugar) {
  const prof = [[0, 0], [r, 0], [r * 0.98, h * 0.42], [r * 0.86, h * 0.76], [r * 0.6, h * 0.95], [0, h]];
  const p = [lathe(prof, col, sugar ? 16 : 22)];
  shadeY(p, 0, h, 0.82, 1.08);
  if (sugar) {
    // sugar crystals: tiny tetrahedra (4 triangles each) scattered over the surface
    const n = Math.min(12, Math.round(r * 7));
    for (let i = 0; i < n; i++) {
      const y = h * (0.12 + 0.8 * K.R()), a = K.R() * TAU, rr = profileR(prof.slice(1), y) * 1.01;
      p.push(custom(new THREE.TetrahedronGeometry(0.09 + r * 0.03).rotateY(K.R() * TAU).translate(Math.cos(a) * rr, y, Math.sin(a) * rr), 0xffffff));
    }
  }
  return p;
}
function chocoFountain() {
  const GL = 0xffd77a, CH = 0x6b3a1f, CHL = 0x8a4a28;
  const p = [lathe([[0, 0], [3.2, 0], [3.4, 0.5], [3.3, 0.9], [3.0, 0.9], [2.9, 0.55], [0, 0.5]], GL, 24), disc(2.95, CH, 0, 0.62, 0, 24), cyl(0.35, 0.45, 5.4, GL, 0, 0.5, 0, 10)];
  const tiers = [[2.2, 2.2], [1.5, 3.8], [0.9, 5.2]];
  tiers.forEach(([r, y], i) => {
    p.push(lathe([[0.3, 0], [r, 0.25], [r * 1.05, 0.55], [r * 0.9, 0.5], [0, 0.35]], GL, 18, 0, y, 0));
    const floor = i === 0 ? 0.62 : tiers[i - 1][1] + 0.5;
    p.push(lathe([[r * 1.2, floor - y - 0.05], [r * 1.12, 0.1], [r * 1.05, 0.56]], CHL, 18, 0, y, 0));
  });
  p.push(dome(0.6, 0.5, 0.6, CH, 0, 5.75, 0, 12, 4));
  return p;
}
// Melted chocolate: a ribbon whose swirls drift downstream (fragment shader).
function chocolateRiver(K, pts, width) {
  const pos = [], flow = [], idx = [];
  pts.forEach(([x, z], i) => {
    const [xp, zp] = pts[Math.max(0, i - 1)], [xn, zn] = pts[Math.min(pts.length - 1, i + 1)], n = norm2(xn - xp, zn - zp);
    for (const s of [-1, 1]) { pos.push(x - n[1] * s * width / 2, 0.07, z + n[0] * s * width / 2); flow.push(x, s); }
  });
  for (let i = 0; i + 1 < pts.length; i++) { const a = i * 2, b = a + 1, c = a + 2, d = a + 3; idx.push(a, b, d, a, d, c); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('flow', new THREE.Float32BufferAttribute(flow, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  if (g.attributes.normal.getY(0) < 0) { idx.reverse(); g.setIndex(idx); g.computeVertexNormals(); }
  const uTime = { value: 0 };
  const mat = new THREE.MeshPhongMaterial({ color: 0xffffff, shininess: 85, specular: 0x7a5640 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 flow;\nvarying vec2 vFlow;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFlow = flow;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nvarying vec2 vFlow;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        float sw = sin(vFlow.x * 0.55 - uTime * 1.2 + vFlow.y * 2.2 + sin(vFlow.x * 0.17 + uTime * 0.35) * 2.0);
        vec3 dark = vec3(0.10, 0.035, 0.012), milk = vec3(0.22, 0.09, 0.035), cream = vec3(0.42, 0.20, 0.09);
        vec3 choc = mix(dark, milk, 0.5 + 0.5 * sin(vFlow.x * 0.21 + vFlow.y * 1.3 - uTime * 0.6));
        choc = mix(choc, cream, smoothstep(0.62, 0.98, sw) * 0.65);
        choc *= 1.0 - smoothstep(0.7, 1.0, abs(vFlow.y)) * 0.35;
        diffuseColor.rgb = choc;`);
  };
  mat.customProgramCacheKey = () => 'backdrop-choc-river';
  const m = new THREE.Mesh(g, mat);
  m.name = 'river'; m.receiveShadow = true; m.frustumCulled = false;
  K.tick.push((t) => { uTime.value = t; });
  return m;
}
function waferBridge(rz) {
  const p = [], WAF = 0xe8b977, WAFD = 0xcf9a55, n = 9, L = 9.5;
  for (let i = 0; i < n; i++) {
    const t0 = i / n, t1 = (i + 1) / n, z0 = rz + L / 2 - t0 * L, z1 = rz + L / 2 - t1 * L;
    const y0 = 0.3 + Math.sin(t0 * PI) * 1.3, y1 = 0.3 + Math.sin(t1 * PI) * 1.3, len = Math.hypot(z1 - z0, y1 - y0);
    p.push(custom(new THREE.BoxGeometry(3.4, 0.32, len + 0.04).rotateX(Math.atan2(y1 - y0, -(z1 - z0))).translate(0, (y0 + y1) / 2, (z0 + z1) / 2), i % 2 ? WAF : WAFD));
  }
  for (const s of [-1, 1]) {
    let prev = null;
    for (let i = 0; i <= 6; i++) {
      const t = i / 6, z = rz + L / 2 - t * L, y = 0.3 + Math.sin(t * PI) * 1.3;
      p.push(cyl(0.12, 0.12, 1.1, i % 2 ? 0xe8325a : WHITE, s * 1.6, y, z, 6));
      const top = [s * 1.6, y + 1.1, z];
      if (prev) p.push(rod(prev, top, 0.1, 0.1, i % 2 ? WHITE : 0xe8325a, 5));
      prev = top;
    }
  }
  return p;
}
function picketShape(w, h) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, h - w / 2); s.absarc(0, h - w / 2, w / 2, 0, PI, false); s.lineTo(-w / 2, 0);
  return s;
}
function gingerFence(x0, x1, z) {
  const p = [], GB = 0xc47b3f, IC = 0xfffaf2, n = Math.max(1, Math.round((x1 - x0) / 1.25));
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n;
    if (i % 6 === 3) { p.push(...put(gingerMan(), x, 0, z)); continue; }
    p.push(custom(new THREE.ExtrudeGeometry(picketShape(0.9, 2.3), { depth: 0.3, bevelEnabled: false, curveSegments: 4 }).translate(x, 0, z - 0.15), GB));
    for (let k = 0; k < 2; k++) p.push(custom(new THREE.BoxGeometry(0.72, 0.07, 0.05).rotateZ(k % 2 ? 0.45 : -0.45).translate(x, 0.75 + k * 0.7, z + 0.18), IC));
  }
  for (const y of [0.7, 1.65]) p.push(rod([x0, y, z - 0.25], [x1, y, z - 0.25], 0.09, 0.09, IC, 5));
  return p;
}
function gingerMan() {
  const GB = 0xc47b3f, IC = 0xfffaf2;
  const p = [custom(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 12).rotateX(PI / 2).translate(0, 2.15, 0), GB), box(0.95, 1.05, 0.3, GB, 0, 0.85, 0)];
  for (const s of [-1, 1]) {
    p.push(rod([s * 0.4, 1.7, 0], [s * 1.05, 1.35, 0], 0.17, 0.17, GB, 5), rod([s * 0.25, 0.9, 0], [s * 0.45, 0.0, 0], 0.2, 0.2, GB, 5));
    p.push(box(0.09, 0.09, 0.04, IC, s * 0.15, 2.22, 0.17), box(0.06, 0.26, 0.04, IC, s * 0.88, 1.27, 0.18));
  }
  for (let k = 0; k < 3; k++) p.push(box(0.12, 0.12, 0.05, k === 1 ? 0xff5c8a : IC, 0, 1.0 + k * 0.28, 0.17));
  p.push(box(0.3, 0.06, 0.04, IC, 0, 1.98, 0.17));
  return p;
}

// ============================================================== SUNNY FARM
function farm(K) {
  const { hw, hd } = K;
  K.shadow = 0x2f5a24;
  const G = K.glossy, ns = K.ns;
  const FZ = -(hd + 5.5);
  const barnX = -(Math.max(hw * 0.45, 5) + 3), barnZ = -(hd + 15);
  const siloX = barnX + 10.5, siloZ = barnZ - 1.5, millX = hw + 10, millZ = -(hd + 10);
  const pondX = hw + 9.5, pondZ = hd * 0.42;
  K.claim(barnX, barnZ, 9); K.claim(siloX, siloZ, 3.5); K.claim(millX, millZ, 4.5); K.claim(pondX, pondZ, 6.5);

  // Ground: grass patches and clover.
  const dots = [];
  for (let i = 0; i < 50; i++) {
    const [x, z] = K.around(2.6, 26, 16), r = K.rnd(1.6, 4.2);
    dots.push([x, 0.01 + (i % 4) * 0.01, z, r, K.pick([0x86bd57, 0x9acd65, 0x82b852, 0xa5d470]), 18, 1, K.rnd(0.6, 1.0), K.R() * PI]);
  }
  for (let i = 0; i < 200; i++) { const [x, z] = K.around(1.8, 24, 16); dots.push([x, 0.09, z, 0.13, K.pick([0xffffff, 0xfff27a, 0xffffff, 0xffc2dc]), 5]); }
  K.flat.push(discBatch(dots));

  // A dirt lane up the left side, through the fence gate to the barn doors.
  const lane = new THREE.CatmullRomCurve3([[-(hw + 7), hd + 24], [-(hw + 4.6), hd + 4], [-(hw + 5.0), -hd * 0.4], [barnX + 1.5, FZ + 1], [barnX + 0.5, barnZ + 6.5]].map(([x, z]) => new THREE.Vector3(x, 0, z)));
  const lp = lane.getSpacedPoints(70).map((v) => [v.x, v.z]);
  K.flat.push(...groundRibbon(lp, 3.4, 0xcfae7c, 0.05, K.R, 0.1), ...groundRibbon(lp, 0.55, 0x8fbf5a, 0.06));
  for (const off of [-0.95, 0.95]) {
    const rut = lp.map(([x, z], i) => { const [xn, zn] = lp[Math.min(lp.length - 1, i + 1)], [xp, zp] = lp[Math.max(0, i - 1)], n = norm2(xn - xp, zn - zp); return [x - n[1] * off, z + n[0] * off]; });
    K.flat.push(...groundRibbon(rut, 0.3, 0xb08d5e, 0.065));
  }

  // Vegetable garden on the near side (low rows), a scarecrow keeping watch at the corner.
  const rowSpan = hw - 0.8;
  [['cabbage', 0], ['carrot', 1], ['lettuce', 2]].forEach(([kind, r]) => {
    const z = hd + 2.1 + r * 1.55 * ns;
    K.add([custom(new THREE.CylinderGeometry(0.55, 0.55, 2 * rowSpan, 8, 1, false, 0, PI).rotateZ(PI / 2).scale(1, 0.4, 1), 0x8a5a36)], 0, 0, z, 0, [1, 1, ns]);
    for (let x = -rowSpan + 0.6; x < rowSpan - 0.4; x += 1.05 * ns) K.add(veg(K, kind), x + K.rnd(-0.1, 0.1), 0.15, z, K.R() * TAU, ns);
  });
  K.blob(0, 0.02, hd + 2.1 + 1.55 * ns, rowSpan + 0.6, 2.4 * ns, 0.18);
  K.add(scarecrow(), -(hw + 2.6), 0, hd + 2.4 + 1.5 * ns, 0.3);
  K.blob(-(hw + 2.6), 0.02, hd + 2.4 + 1.5 * ns, 1.3, 1.0, 0.35);

  // Rail fences: the far side (with a gate for the lane) and the left side along the lane.
  const gateX = barnX + 1.5;
  G.push(...railFence(-(hw + 20), FZ, gateX - 2.4, FZ), ...railFence(gateX + 2.4, FZ, hw + 20, FZ));
  G.push(...railFence(-(hw + 2.6), FZ + 2.5, -(hw + 2.6), hd + 1.5), ...railFence(hw + 3.4, FZ + 2.5, hw + 3.4, -hd * 0.05));
  for (let x = -(hw + 20); x < hw + 20; x += 2.6) K.blob(x, 0.02, FZ + 0.3, 1.0, 0.6, 0.25);

  // Barnyard: red barn, silo, haybales; a windmill turning on the right.
  K.add(barn(K), barnX, 0, barnZ);
  K.blob(barnX + 0.6, 0.02, barnZ + 0.6, 7.5, 6.0, 0.42);
  K.add(silo(), siloX, 0, siloZ);
  K.blob(siloX + 0.5, 0.02, siloZ + 0.5, 3.0, 3.0, 0.4);
  for (const [x, z, ry] of [[barnX - 7.5, barnZ + 5.5, 0.4], [barnX + 7.0, barnZ + 6.5, -0.3], [barnX + 9.0, barnZ + 4.6, 1.2], [-(hw + 8.5), -hd * 0.55, 0.2], [hw + 6.5, FZ + 3.0, -0.6]]) {
    K.add(hayBale(), x, 0, z, ry);
    K.blob(x, 0.02, z, 1.9, 1.5, 0.38, ry);
  }
  K.add(hayStack(K), barnX - 6.0, 0, barnZ + 1.5, 0.3);
  K.blob(barnX - 6.0, 0.02, barnZ + 1.5, 3.0, 2.4, 0.38);
  const mill = windmill(K);
  K.add(mill.tower, millX, 0, millZ);
  K.blob(millX + 0.6, 0.02, millZ + 0.6, 3.6, 3.0, 0.42);
  const rotor = new THREE.Mesh(merge(mill.rotor), new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 30, specular: 0x242424 }));
  rotor.name = 'windmill'; rotor.position.set(millX, mill.hubY, millZ + mill.hubZ);
  K.meshes.push(rotor);
  K.tick.push((t) => { rotor.rotation.z = -t * 0.55; });

  // Apple orchard on the right, a duck pond in front of it.
  const cols = 3, rows = Math.max(2, Math.round((hd + 6) / 6.5));
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x = hw + 7.5 + c * 5.4 + (r % 2) * 1.2, z = FZ + 4.5 + r * 5.6;
    if (z > pondZ - 7.5 || !K.free(x, z, 2.6)) continue;
    K.claim(x, z, 2.6);
    K.add(appleTree(K, c === 0), x, 0, z, K.R() * TAU);
    K.blob(x + 0.6, 0.02, z + 0.4, 2.7, 2.3, 0.38);
  }
  pondWithDucks(K, pondX, pondZ, 4.2, 5.2);

  // Trees and hills on the horizon; butterflies over the garden; clouds.
  for (let x = -(hw + 30); x <= hw + 30; x += K.rnd(5.5, 8.5)) {
    const z = FZ - K.rnd(17, 27);
    if (!K.free(x, z, 2.5)) continue;
    K.add(farTree(K, K.rnd(6, 8.5), K.rnd(2.2, 2.9), K.pick([0x5cbf55, 0x4fb04f, 0x6ccb5e])), x, 0, z, K.R() * TAU);
  }
  for (let i = 0; i < 12; i++) {
    const rx = K.rnd(12, 22), ry = K.rnd(3.5, 8), h = dome(rx, ry, K.rnd(8, 14), K.pick([0x8cc65c, 0x9fd36e, 0x7fbd52, 0xb0dc7c]), K.rnd(-(hw + 60), hw + 60), -0.3, FZ - K.rnd(26, 52), 18, 6);
    shadeY(h, 0, ry, 0.82, 1.08);
    K.matte.push(h);
  }
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
    const h = dome(K.rnd(9, 15), K.rnd(3, 6), K.rnd(9, 14), K.pick([0x8cc65c, 0x9fd36e]), s * (hw + K.rnd(28, 40)), -0.3, K.rnd(-hd, hd + 10), 18, 6);
    shadeY(h, 0, 6, 0.85, 1.06);
    K.matte.push(h);
  }
  const bsp = [];
  for (let i = 0; i < Math.max(4, Math.round(hw / 2.5)); i++) bsp.push([K.rnd(-(hw - 1), hw - 1), K.rnd(1.3, 1.7), hd + 2.1 + 3.1 * ns + K.rnd(1.6, 2.2)]);
  butterflies(K, bsp);
  const span = hw + 70, cl = [];
  for (let i = 0; i < 5; i++) cl.push([K.rnd(-span, span), K.rnd(7.5, 11), FZ - K.rnd(8, 30), K.rnd(1.6, 2.6)]);
  cloudLayer(K, cl, span);
}
function veg(K, kind) {
  if (kind === 'cabbage') return [ballC(0.42, 0x6fc25a, 0, 0.3, 0, 1, 0.8), ballC(0.3, 0xb6ea8e, 0, 0.52, 0, 1, 0.7)];
  if (kind === 'carrot') return [disc(0.16, 0xff8a2a, 0, 0.2, 0, 8), ...[0, 2.1, 4.2].map((a) => custom(new THREE.ConeGeometry(0.07, 0.6, 4, 1, true).translate(0, 0.3, 0).rotateZ(0.35).rotateY(a).translate(0, 0.18, 0), 0x4fae4f))];
  return [dome(0.4, 0.3, 0.4, 0x9fdc6a, 0, 0.15, 0, 9, 3), dome(0.26, 0.24, 0.26, 0xc4ee8e, 0, 0.2, 0, 8, 3)];
}
function scarecrow() {
  const W = 0x9a6a42, HAY = 0xf2cc5c;
  return [cyl(0.12, 0.14, 3.6, W, 0, 0, 0, 6), box(3.0, 0.2, 0.2, W, 0, 2.55, 0), box(1.3, 1.4, 0.7, 0x6f9bd8, 0, 1.6, 0), box(1.32, 0.18, 0.72, 0xd9483b, 0, 2.3, 0),
    ballC(0.48, 0xf0dcae, 0, 3.4, 0, 1), cone(0.55, 0.75, 0xe0b45a, 0, 3.75, 0, 10), cyl(0.95, 0.95, 0.08, 0xe0b45a, 0, 3.72, 0, 14),
    cone(0.14, 0.4, HAY, -1.55, 2.45, 0, 5), cone(0.14, 0.4, HAY, 1.55, 2.45, 0, 5), ballC(0.05, INK, -0.17, 3.5, 0.44, 0), ballC(0.05, INK, 0.17, 3.5, 0.44, 0),
    box(0.75, 0.6, 0.72, 0x3f5f9a, 0, 1.0, 0), cone(0.18, 0.45, HAY, 0, 0.62, 0, 5)];
}
function barn(K) {
  const W = 11, H = 6.5, D = 9.5, RED = 0xd9493e, REDD = 0xb83a31, TR = 0xffffff, ROOF = 0x6f5550;
  const p = [boxS(W, H, D, RED, 0, 0, 0)];
  for (let x = -W / 2 + 0.55; x < W / 2; x += 0.55) p.push(box(0.05, H, 0.04, REDD, x, 0, D / 2 + 0.02));
  const g = new THREE.Shape(), gw = W / 2 + 0.5;
  g.moveTo(-gw, 0); g.lineTo(-gw * 0.62, 2.9); g.lineTo(0, 4.4); g.lineTo(gw * 0.62, 2.9); g.lineTo(gw, 0); g.lineTo(-gw, 0);
  p.push(custom(new THREE.ExtrudeGeometry(g, { depth: D + 1.0, bevelEnabled: false }).translate(0, H, -(D + 1.0) / 2), ROOF));
  const gi = new THREE.Shape(), iw = W / 2;
  gi.moveTo(-iw, 0); gi.lineTo(-iw * 0.62, 2.55); gi.lineTo(0, 3.95); gi.lineTo(iw * 0.62, 2.55); gi.lineTo(iw, 0); gi.lineTo(-iw, 0);
  p.push(custom(new THREE.ShapeGeometry(gi).translate(0, H, D / 2 + 0.52), RED));
  for (const [a, b] of [[[-gw, 0], [-gw * 0.62, 2.9]], [[-gw * 0.62, 2.9], [0, 4.4]], [[0, 4.4], [gw * 0.62, 2.9]], [[gw * 0.62, 2.9], [gw, 0]]]) p.push(rod([a[0], H + a[1], D / 2 + 0.56], [b[0], H + b[1], D / 2 + 0.56], 0.13, 0.13, TR, 4));
  for (const s of [-1, 1]) p.push(box(0.3, H, 0.3, TR, s * (W / 2 - 0.1), 0, D / 2 - 0.05));
  p.push(box(W + 0.2, 0.3, 0.3, TR, 0, H - 0.3, D / 2 + 0.05));
  for (const s of [-1, 1]) {
    const dx = s * 1.35;
    p.push(box(2.5, 4.4, 0.14, REDD, dx, 0, D / 2 + 0.08), box(2.5, 0.22, 0.2, TR, dx, 4.2, D / 2 + 0.12), box(0.22, 4.4, 0.2, TR, dx + s * 1.15, 0, D / 2 + 0.12));
    p.push(custom(new THREE.BoxGeometry(0.2, 4.9, 0.1).rotateZ(s * 0.52).translate(dx, 2.2, D / 2 + 0.16), TR), custom(new THREE.BoxGeometry(0.2, 4.9, 0.1).rotateZ(-s * 0.52).translate(dx, 2.2, D / 2 + 0.16), TR));
  }
  p.push(box(2.2, 1.9, 0.12, REDD, 0, H + 0.35, D / 2 + 0.56), box(1.8, 0.8, 0.14, 0xf2cc5c, 0, H + 0.4, D / 2 + 0.6), box(0.25, 0.25, 1.6, 0x8a5a3a, 0, H + 2.5, D / 2 + 1.0));
  p.push(rod([0, H + 4.4, 0], [0, H + 6.0, 0], 0.05, 0.05, INK, 4), box(1.1, 0.06, 0.06, INK, 0, H + 5.4, 0), cone(0.12, 0.3, INK, 0.62, H + 5.25, 0, 4));
  p.push(...put([egg(0.32, 0.26, 0.08, INK), ballC(0.1, INK, 0.25, 0.18, 0, 0), cone(0.09, 0.25, 0xd9483b, 0.25, 0.28, 0, 4)], 0, H + 5.85, 0));
  shadeY(p.slice(0, 1), 0, H, 0.85, 1.02);
  return p;
}
function silo() {
  const S = 0xdcdcd4, SD = 0xb9bcb8;
  const p = [cyl(2.4, 2.4, 14, S, 0, 0, 0, 16), dome(2.5, 1.9, 2.5, 0xb8c4cf, 0, 14, 0, 16, 5)];
  for (const y of [3.5, 7, 10.5]) p.push(cyl(2.46, 2.46, 0.22, SD, 0, y, 0, 16));
  for (const s of [-1, 1]) p.push(box(0.1, 13.6, 0.1, 0x8a8f94, s * 0.3, 0.2, 2.45));
  for (let y = 0.8; y < 13.6; y += 0.8) p.push(box(0.6, 0.07, 0.07, 0x8a8f94, 0, y, 2.47));
  return p;
}
function hayBale() {
  const H = 0xe8c25a, HD = 0xcda443;
  const p = [custom(new THREE.CylinderGeometry(1.1, 1.1, 1.6, 14).rotateZ(PI / 2).translate(0, 1.1, 0), H)];
  for (const s of [-1, 1]) for (const r of [0.8, 0.45]) p.push(custom(new THREE.RingGeometry(r - 0.08, r, 14).rotateY(s * PI / 2).translate(s * 0.81, 1.1, 0), HD));
  return p;
}
function hayStack(K) {
  const H = 0xe8c25a;
  const p = [];
  for (const [x, y, z] of [[-1.3, 0, 0], [1.3, 0, 0], [0, 1.1, 0]]) p.push(box(2.4, 1.1, 1.3, H, x, y, z), box(2.42, 1.12, 0.08, 0xb08a3a, x, y, z + 0.3), box(2.42, 1.12, 0.08, 0xb08a3a, x, y, z - 0.3));
  jitter(p, K.R, 0.08);
  return p;
}
function windmill(K) {
  const T = 0xfff2dc, TD = 0xe6d2b4, ROOF = 0xd9493e;
  const tower = [custom(new THREE.CylinderGeometry(1.7, 2.7, 10, 8).translate(0, 5, 0), T), cone(2.3, 2.4, ROOF, 0, 10, 0, 8)];
  shadeY(tower, 0, 10, 0.85, 1.03);
  tower.push(box(1.2, 2.2, 0.12, 0x8a5a3a, 0, 0, 2.45), box(0.8, 0.8, 0.1, 0x9fd2ff, 0, 5.2, 2.0), box(0.95, 0.95, 0.06, TD, 0, 5.12, 1.97), box(4.0, 0.25, 1.2, TD, 0, 2.6, 2.0));
  const hubY = 9.2, hubZ = 2.55;
  tower.push(cyl(0.35, 0.35, 0.9, 0x6b5560, 0, hubY, hubZ - 0.5, 8, PI / 2));
  const rotor = [cyl(0.45, 0.45, 0.4, 0x6b5560, 0, 0, 0.2, 10, PI / 2)];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + 0.4, sail = [box(0.22, 5.4, 0.18, 0x8a5a3a, 0, 0.2, 0.25)];
    sail.push(box(1.3, 4.2, 0.06, 0xfff8ee, 0.78, 1.2, 0.33));
    for (let k = 0; k < 4; k++) sail.push(box(1.4, 0.07, 0.08, 0x8a5a3a, 0.75, 1.4 + k * 1.15, 0.37));
    rotor.push(...put(sail, 0, 0, 0, 0, 1, 0, a));
  }
  return { tower, rotor, hubY, hubZ };
}
function appleTree(K, front) {
  const t = front ? roundTree(K, 7.5, 2.6, 0x5cbf55) : farTree(K, 7.2, 2.6, 0x55b84f);
  const cy = front ? Math.max(1.2, 7.5 - 2.6 * 1.7) + 2.6 * 0.75 : 7.2 - 2.6;
  for (let i = 0; i < 9; i++) {
    const a = K.R() * TAU, e = K.rnd(-0.2, 0.75), r = 2.6 * 1.0;
    t.push(ballC(0.22, i % 4 ? 0xe8323f : 0xffd23f, Math.cos(a) * Math.cos(e) * r, cy + Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r, 0));
  }
  return t;
}

// ============================================================== SNOWY VILLAGE
function snow(K) {
  const { hw, hd } = K;
  K.shadow = 0x5a78a8;
  const G = K.glossy, ns = K.ns;
  const VZ = -(hd + 11);
  const pondX = -(hw + 10.5), pondZ = -hd * 0.05, hillX = hw + 16, hillZ = -hd * 0.45;
  K.claim(pondX, pondZ, 7.5); K.claim(hillX, hillZ, 11); K.claim(hw + 4.6, hd * 0.3, 2.2);

  // Snow ground: soft blue shadows and glints.
  const dots = [];
  for (let i = 0; i < 46; i++) {
    const [x, z] = K.around(2.6, 26, 16), r = K.rnd(1.6, 4.2);
    dots.push([x, 0.01 + (i % 4) * 0.01, z, r, K.pick([0xdde9f8, 0xf4f9ff, 0xe3edfa]), 18, 1, K.rnd(0.6, 1.0), K.R() * PI]);
  }
  for (let i = 0; i < 260; i++) { const [x, z] = K.around(1.7, 24, 16); dots.push([x, 0.06, z, K.rnd(0.06, 0.12), K.pick([0xffffff, 0xcfe6ff, 0xffffff]), 5]); }

  // Near side (low): drifts, a snow angel with footprints walking up to it, a snowball pile.
  const az = hd + 2.4 + 3.6 * ns, ax = -hw * 0.25;
  const ANG = 0xd2e2f6;
  dots.push([ax, 0.08, az, 0.6 * ns, ANG, 14, 1.1, 1.5, 0], [ax, 0.08, az - 1.3 * ns, 0.42 * ns, ANG, 12]);
  for (const sd of [-1, 1]) {
    dots.push([ax + sd * 1.0 * ns, 0.08, az - 0.45 * ns, 0.6 * ns, ANG, 14, 1.6, 0.55, sd * 0.55]);
    dots.push([ax + sd * 0.55 * ns, 0.08, az + 1.0 * ns, 0.6 * ns, ANG, 12, 0.9, 1.3, -sd * 0.3]);
  }
  let fx = -(hw + 4), fz = az + 6.5 * ns;
  for (let i = 0; i < 24; i++) {
    const a = Math.atan2(az + 1.6 * ns - fz, ax - 1.0 - fx) + Math.sin(i * 0.6) * 0.2;
    fx += Math.cos(a) * 0.85; fz += Math.sin(a) * 0.85;
    if (Math.hypot(fx - ax + 1.0, fz - az - 1.6 * ns) < 1.2) break;
    const sd = i % 2 ? 1 : -1;
    dots.push([fx - Math.sin(a) * 0.24 * sd, 0.08, fz + Math.cos(a) * 0.24 * sd, 0.19, 0xcfdff3, 7, 1, 1.7, -a + PI / 2]);
  }
  K.flat.push(discBatch(dots));
  K.add(snowballPile(), hw * 0.35, 0, az - 0.4 * ns, 0.4, ns);
  K.blob(hw * 0.35, 0.02, az - 0.4 * ns, 1.4 * ns, 1.2 * ns, 0.3);
  for (const [x, z, r] of [[-(hw + 4.5), hd + 3.4, 2.4], [hw + 5.2, hd + 4.6, 2.0], [hw * 0.8, hd + 2.6 + 6.5 * ns, 1.6], [-hw * 0.75, hd + 2.6 + 7.4 * ns, 1.8]]) {
    const dr = dome(r, 0.45, r * 0.7, 0xf6faff, x, -0.05, z, 14, 4);
    shadeY(dr, 0, 0.45, 0.88, 1.05);
    K.matte.push(dr);
  }

  // A garland of coloured lights lying in the snow around the board (frames the white board).
  garland(K, hw + 1.45, hd + 1.45);
  // Lampposts along both sides of the board.
  for (const s of [-1, 1]) for (const z of [-hd * 0.55, hd * 0.45]) addLamp(K, s * (hw + 2.7), z);

  // Snowman on the right; frozen pond with skaters on the left; sled hill far right.
  K.add(snowman(), hw + 4.6, 0, hd * 0.3, -0.5);
  K.blob(hw + 4.6, 0.02, hd * 0.3, 2.0, 1.8, 0.35);
  frozenPond(K, pondX, pondZ, 5.0, 6.4);
  const hill = dome(12, 6.5, 10, 0xf6faff, hillX, -0.2, hillZ, 22, 7);
  shadeY(hill, 0, 6.5, 0.86, 1.04);
  K.matte.push(hill);
  for (const off of [-0.6, 0.6]) {
    let prev = null;
    for (let i = 0; i <= 12; i++) {
      const t = i / 12, x = hillX - 1.5 - t * 9.5, z = hillZ + 2.0 + t * 2.4 + off;
      const e = Math.max(0, 1 - ((x - hillX) / 12) ** 2 - ((z - hillZ) / 10) ** 2), y = 6.5 * Math.sqrt(e) - 0.2 + 0.06;
      const pt = [x, Math.max(0.06, y), z];
      if (prev) G.push(rod(prev, pt, 0.11, 0.11, 0x9fb8d8, 4));
      prev = pt;
    }
  }
  for (const [dx, dz, h] of [[2.5, -4.5, 6.5], [-3.5, -5.5, 5.5], [5.5, -1.5, 7]]) {
    const x = hillX + dx, z = hillZ + dz, e = Math.max(0, 1 - (dx / 12) ** 2 - (dz / 10) ** 2);
    K.add(snowPine(K, h, h * 0.33), x, 6.5 * Math.sqrt(e) - 0.6, z, K.R() * TAU);
  }
  K.add(sled(), hillX - 12.0, 0, hillZ + 5.0, -0.25);
  K.blob(hillX - 12.0, 0.02, hillZ + 5.0, 1.8, 1.0, 0.3, -0.25);

  // The village: cottages with lit windows, string lights and chimney smoke; lamps on the lane.
  const nCot = Math.max(3, Math.round((2 * hw + 22) / 9.5));
  const COT = [[0xfff1d6, 0xd9564a], [0xbfdcff, 0x4f86d9], [0xffd0dc, 0xd9566f], [0xc8f0dc, 0x3fa97a], [0xffe9a8, 0xd98a3a]];
  const smokeSrc = [];
  for (let i = 0; i < nCot; i++) {
    const x = -(hw + 11) + (2 * hw + 22) * (i / (nCot - 1)), z = VZ - K.rnd(0, 2.2);
    const [wall, trim] = COT[i % COT.length];
    const c = cottage(K, wall, trim);
    K.add(c, x, 0, z);
    for (const h of c.halo) K.halos.push([h[0] + x, h[1], h[2] + z, ...h.slice(3)]);
    smokeSrc.push([c.smoke[0] + x, c.smoke[1], c.smoke[2] + z]);
    K.blob(x + 0.5, 0.02, z + 0.5, 4.2, 3.6, 0.4);
    if (i < nCot - 1) addLamp(K, x + (2 * hw + 22) / (nCot - 1) / 2, VZ + 4.2);
  }
  smokeLayer(K, smokeSrc);

  // Snowy pines all around, falling snow beyond the board.
  const pine = (x, z, h) => {
    if (!K.free(x, z, h * 0.32)) return;
    K.claim(x, z, h * 0.32);
    K.add(snowPine(K, h, h * 0.33), x, 0, z, K.R() * TAU);
    K.blob(x + 0.5, 0.02, z + 0.4, h * 0.36, h * 0.3, 0.32);
  };
  for (const s of [-1, 1]) for (let i = 0; i < 14; i++) pine(s * (hw + K.rnd(5, 24)), K.rnd(-(hd + 6), hd + 9), K.rnd(5.5, 9.5));
  for (let x = -(hw + 30); x <= hw + 30; x += K.rnd(3.5, 6)) pine(x, VZ - K.rnd(5.5, 16), K.rnd(6.5, 10.5));
  for (let i = 0; i < 10; i++) {
    const rx = K.rnd(12, 22), ry = K.rnd(3.5, 8), h = dome(rx, ry, K.rnd(8, 14), K.pick([0xf2f7ff, 0xe8f1fd]), K.rnd(-(hw + 60), hw + 60), -0.3, VZ - K.rnd(20, 46), 18, 6);
    shadeY(h, 0, ry, 0.84, 1.04);
    K.matte.push(h);
  }
  snowfall(K, hw, hd, 420);
}
function garland(K, gx, gz) {
  const cols = [0xff5a5f, 0x5fd16a, 0xffd23f, 0x4fa3ff, 0xff8fd8];
  const pts = [[-gx, gz], [gx, gz], [gx, -gz], [-gx, -gz], [-gx, gz]];
  let c = 0;
  for (let k = 0; k < 4; k++) {
    const [ax, az] = pts[k], [bx, bz] = pts[k + 1], len = Math.hypot(bx - ax, bz - az), n = Math.round(len / 1.1);
    K.glossy.push(rod([ax, 0.06, az], [bx, 0.06, bz], 0.035, 0.035, 0x2f4a3a, 3));
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
      K.lit.push(custom(new THREE.OctahedronGeometry(0.13).scale(1, 1.35, 1).translate(x, 0.17, z), cols[c++ % cols.length]));
    }
  }
}
function snowPine(K, h, r) {
  const p = [cyl(r * 0.12, r * 0.16, h * 0.3, 0x7a5a3a, 0, 0, 0, 6)];
  for (let i = 0; i < 3; i++) {
    const R = r * (1 - i * 0.24), H = h * 0.42, y = h * 0.2 + i * h * 0.2;
    p.push(cone(R, H, K.pick([0x2f7a4f, 0x358a55, 0x2a6e48]), 0, y, 0, 9), cone(R * 0.47, H * 0.45, 0xf6faff, 0, y + H * 0.55 - 0.02, 0, 9));
  }
  p.push(dome(r * 0.8, 0.35, r * 0.8, 0xf6faff, 0, 0, 0, 10, 3));
  return p;
}
function cottage(K, wall, trim) {
  const W = 6, H = 4.2, D = 5.2, SNOWC = 0xf6faff, LIT = 0xffd36b;
  const s = [boxS(W, H, D, wall, 0, 0, 0)], l = [], halo = [];
  shadeY(s, 0, H, 0.84, 1.02);
  s.push(custom(new THREE.ExtrudeGeometry(gableShape(W, 2.45), { depth: D, bevelEnabled: false }).translate(0, H, -D / 2), wall));
  s.push(roofSlab(W + 1.0, 2.75, D + 0.9, 0.3, trim, H - 0.32), roofSlab(W + 1.2, 2.95, D + 1.0, 0.42, SNOWC, H - 0.12));
  s.push(box(0.9, 2.5, 0.9, 0xb4533f, W * 0.24, H + 0.6, -D * 0.15), box(1.08, 0.3, 1.08, SNOWC, W * 0.24, H + 3.1, -D * 0.15));
  s.push(box(1.3, 2.4, 0.12, 0x8a5a3a, -W * 0.24, 0, D / 2 + 0.06), torus(0.4, 0.11, 0x3f9a55, -W * 0.24, 1.85, D / 2 + 0.15, 0, 12), ballC(0.1, 0xe8323f, -W * 0.24 - 0.1, 1.48, D / 2 + 0.24, 0), ballC(0.1, 0xe8323f, -W * 0.24 + 0.1, 1.48, D / 2 + 0.24, 0));
  for (const [x, y] of [[W * 0.22, 1.5]]) {
    l.push(box(1.2, 1.05, 0.08, LIT, x, y, D / 2 + 0.04));
    s.push(box(1.4, 0.12, 0.14, WHITE, x, y + 1.05, D / 2 + 0.07), box(1.4, 0.12, 0.14, WHITE, x, y - 0.1, D / 2 + 0.07), box(0.1, 1.1, 0.13, WHITE, x, y, D / 2 + 0.07), box(1.4, 0.1, 0.12, WHITE, x, y + 0.48, D / 2 + 0.08));
    s.push(box(1.5, 0.2, 0.45, SNOWC, x, y - 0.3, D / 2 + 0.2));
    halo.push([x, y + 0.5, D / 2 + 0.3, 1.5, 1.3, 0.55, 0xffb347, true]);
  }
  l.push(vdisc(0.42, LIT, 0, H + 1.0, D / 2 + 0.02, 12));
  halo.push([0, H + 1.0, D / 2 + 0.3, 1.0, 1.0, 0.45, 0xffb347, true]);
  const bulbs = [0xff5a5f, 0x5fd16a, 0xffd23f, 0x4fa3ff];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12, side = t < 0.5 ? -1 : 1, u = side < 0 ? t * 2 : (1 - t) * 2;
    l.push(ballC(0.12, bulbs[i % 4], side * (W + 1.2) / 2 * (1 - u) * 0.98, H - 0.2 + u * 2.95 - 0.1, D / 2 + 0.55, 0));
  }
  return { s, l, halo, smoke: [W * 0.24, H + 3.4, -D * 0.15] };
}
function addLamp(K, x, z) {
  const P = 0x2f3d4a, h = 5.2;
  K.add({ s: [cyl(0.3, 0.38, 0.5, P, 0, 0, 0, 8), cyl(0.11, 0.13, h, P, 0, 0.5, 0, 6), box(0.85, 0.12, 0.85, P, 0, h + 0.45, 0),
    box(0.1, 0.95, 0.1, P, 0.38, h + 0.55, 0.38), box(0.1, 0.95, 0.1, P, -0.38, h + 0.55, 0.38), box(0.1, 0.95, 0.1, P, 0.38, h + 0.55, -0.38), box(0.1, 0.95, 0.1, P, -0.38, h + 0.55, -0.38),
    cone(0.68, 0.55, P, 0, h + 1.5, 0, 4), ballC(0.12, P, 0, h + 2.15, 0, 0)], l: [box(0.62, 0.86, 0.62, 0xffe08a, 0, h + 0.6, 0)] }, x, 0, z, PI / 4);
  K.halos.push([x, h + 1.0, z + 0.5, 1.2, 1.2, 0.6, 0xffb347, true], [x, 0.05, z, 2.2, 2.2, 0.32, 0xffcf7a, false]);
  K.blob(x, 0.02, z, 0.7, 0.7, 0.35);
}
function snowman() {
  const S = 0xf8fbff, COAL = 0x2b2a33;
  const p = [ballC(1.25, S, 0, 1.15, 0, 2), ballC(0.92, S, 0, 2.95, 0, 2), ballC(0.66, S, 0, 4.3, 0, 2)];
  shadeY(p, 0, 5, 0.86, 1.04);
  p.push(custom(new THREE.ConeGeometry(0.13, 0.75, 8).rotateX(PI / 2).translate(0, 4.33, 0.98), 0xff8a2a));
  for (const s of [-1, 1]) p.push(ballC(0.08, COAL, s * 0.22, 4.5, 0.58, 0));
  for (let i = 0; i < 3; i++) p.push(ballC(0.09, COAL, 0, 2.55 + i * 0.4, 0.86 - Math.abs(i - 1) * 0.06, 0));
  p.push(cyl(0.48, 0.48, 0.1, COAL, 0, 4.85, 0, 14), cyl(0.33, 0.35, 0.75, COAL, 0, 4.9, 0, 12), cyl(0.355, 0.355, 0.16, 0xe8323f, 0, 4.98, 0, 12));
  p.push(torus(0.62, 0.15, 0xe8323f, 0, 3.75, 0, PI / 2, 14), box(0.3, 0.8, 0.12, 0xe8323f, 0.4, 2.95, 0.62));
  for (const s of [-1, 1]) p.push(rod([s * 0.8, 3.1, 0], [s * 1.9, 3.75, 0.1], 0.06, 0.04, 0x7a5a3a, 4), rod([s * 1.6, 3.6, 0.05], [s * 1.85, 4.05, 0.1], 0.03, 0.03, 0x7a5a3a, 3));
  return p;
}
function frozenPond(K, px, pz, prx, prz) {
  const g = new THREE.CircleGeometry(1, 36).rotateX(-PI / 2), q = g.attributes.position;
  for (let i = 1; i < q.count; i++) { const a = Math.atan2(q.getZ(i), q.getX(i)), k = 1 + Math.sin(a * 3 + 0.5) * 0.06; q.setXYZ(i, q.getX(i) * k * prx, 0.03, q.getZ(i) * k * prz); }
  q.setY(0, 0.03);
  const ice = custom(g.translate(px, 0, pz), 0xbfe6ff);
  recolor(ice, (x, y, z, c) => c.lerp(new THREE.Color(0xeaf7ff), clamp01(Math.hypot((x - px) / prx, (z - pz) / prz) * 1.2 - 0.2)));
  const scr = [];
  for (let i = 0; i < 6; i++) {
    const r = K.rnd(1, 3.6);
    scr.push(custom(new THREE.RingGeometry(r, r + 0.07, 18, 1, K.R() * TAU, K.rnd(0.8, 1.8)).rotateX(-PI / 2).translate(px + K.rnd(-0.6, 0.6), 0.045, pz + K.rnd(-0.8, 0.8)), 0xffffff));
  }
  const im = new THREE.Mesh(merge([ice, ...scr]), patchGround(new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 110, specular: 0xffffff })));
  im.name = 'ice'; im.receiveShadow = true;
  K.meshes.push(im);
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * TAU + K.R() * 0.2;
    K.matte.push(ballC(K.rnd(0.4, 0.75), 0xf6faff, px + Math.cos(a) * prx * 1.06, 0.1, pz + Math.sin(a) * prz * 1.06, 1, 0.55));
  }
  [[-1.6, -1.2, 0xe8323f, 0x4f86d9, 0.4], [1.4, 0.9, 0x4fa3ff, 0xffd23f, 2.4], [0.2, 2.6, 0x5fd16a, 0xff5a8a, 4.4]].forEach(([dx, dz, coat, hat, ry]) => {
    K.add(skater(coat, hat), px + dx, 0.03, pz + dz, ry, 1, 0, 0.18);
    K.blob(px + dx, 0.05, pz + dz, 0.8, 0.6, 0.3);
  });
}
function skater(coat, hat) {
  const SK = 0xffd9b8, P = 0x3a3f58;
  return [rod([0, 1.05, 0.15], [0.35, 0.15, 0.2], 0.1, 0.09, P, 5), rod([0, 1.05, -0.15], [-0.25, 0.25, -0.22], 0.1, 0.09, P, 5),
    box(0.55, 0.06, 0.1, CHROME, 0.4, 0.0, 0.2), box(0.55, 0.06, 0.1, CHROME, -0.2, 0.1, -0.22),
    cone(0.52, 1.25, coat, 0, 0.85, 0, 10), torus(0.2, 0.07, 0xffffff, 0, 2.05, 0, PI / 2, 10), ballC(0.3, SK, 0, 2.08, 0, 1),
    dome(0.31, 0.3, 0.31, hat, 0, 2.3, 0, 10, 4), ballC(0.1, WHITE, 0, 2.62, 0, 0),
    rod([0, 1.8, 0.25], [0.25, 1.5, 0.95], 0.08, 0.08, coat, 5), rod([0, 1.8, -0.25], [-0.25, 1.5, -0.95], 0.08, 0.08, coat, 5),
    ballC(0.1, hat, 0.25, 1.5, 0.95, 0), ballC(0.1, hat, -0.25, 1.5, -0.95, 0)];
}
function sled() {
  const RED = 0xe8323f, W = 0x9a6a42;
  const p = [];
  for (const s of [-1, 1]) {
    p.push(box(2.6, 0.08, 0.12, CHROME, -0.1, 0.02, s * 0.55), custom(new THREE.TorusGeometry(0.32, 0.06, 4, 8, PI).rotateZ(-PI / 2).translate(1.2, 0.34, s * 0.55), CHROME));
    for (const x of [-0.8, 0.5]) p.push(box(0.08, 0.35, 0.08, CHROME, x, 0.05, s * 0.55));
  }
  for (let i = 0; i < 4; i++) p.push(box(0.42, 0.1, 1.3, i % 2 ? RED : 0xff6f6f, -0.85 + i * 0.5, 0.4, 0));
  p.push(rod([1.3, 0.55, 0], [2.4, 0.08, 0.3], 0.03, 0.03, 0xffe08a, 3));
  return p;
}
function snowballPile() {
  const p = [], S = 0xf8fbff;
  for (const [x, z] of [[-0.45, -0.3], [0.45, -0.3], [0, 0.45], [-0.9, 0.45], [0.9, 0.45], [0, -1.05]]) p.push(ballC(0.42, S, x, 0.42, z, 1));
  for (const [x, z] of [[-0.22, 0.05], [0.22, 0.05], [0, -0.45]]) p.push(ballC(0.4, S, x, 1.05, z, 1));
  p.push(ballC(0.38, S, 0, 1.62, -0.12, 1));
  return shadeY(p, 0, 2, 0.86, 1.04);
}
// Chimney smoke: puffs that rise, drift, swell and shrink away (all in the vertex shader).
function smokeLayer(K, sources) {
  const parts = [];
  sources.forEach(([x, y, z], si) => {
    for (let i = 0; i < 5; i++) {
      const g = custom(new THREE.IcosahedronGeometry(0.55, 1).translate(x, y, z), 0xf2f5fa);
      const n = g.attributes.position.count, pc = new Float32Array(n * 4);
      for (let k = 0; k < n; k++) { pc[k * 4] = x; pc[k * 4 + 1] = y; pc[k * 4 + 2] = z; pc[k * 4 + 3] = i / 5 + si * 0.137; }
      g.setAttribute('pc', new THREE.BufferAttribute(pc, 4));
      parts.push(g);
    }
  });
  const uTime = { value: 0 };
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x4a4e58 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 pc;\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float life = fract(uTime * 0.11 + pc.w);
        float sz = sin(life * 3.14159) * (0.55 + life * 1.3);
        vec3 c = pc.xyz + vec3(sin(life * 5.0 + pc.w * 17.0) * 0.5 + life * 1.8, life * 6.5, 0.0);
        transformed = c + (transformed - pc.xyz) * sz;`);
  };
  mat.customProgramCacheKey = () => 'backdrop-smoke';
  const m = new THREE.Mesh(merge(parts), mat);
  m.name = 'smoke'; m.frustumCulled = false;
  K.meshes.push(m);
  K.tick.push((t) => { uTime.value = t; });
}
// Gentle snowfall as points, only outside the board (sides and far side).
function snowfall(K, hw, hd, n) {
  const pos = new Float32Array(n * 3), ph = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let x, z;
    if (K.R() < 0.5) { x = K.rnd(-(hw + 30), hw + 30); z = -(hd + K.rnd(2.2, 30)); }
    else { x = (K.R() < 0.5 ? -1 : 1) * (hw + K.rnd(2.2, 26)); z = K.rnd(-(hd + 2), hd + 12); }
    pos[i * 3] = x; pos[i * 3 + 1] = K.rnd(0, 12); pos[i * 3 + 2] = z; ph[i] = K.R();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('ph', new THREE.BufferAttribute(ph, 1));
  const uTime = { value: 0 };
  // Flake sprite: white core with a faint blue-grey rim so it reads on snow and on pines.
  const tex = canvasTex(64, (x, sz) => {
    const g = x.createRadialGradient(sz / 2, sz / 2, 0, sz / 2, sz / 2, sz / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(255,255,255,1)');
    g.addColorStop(0.72, 'rgba(160,186,220,0.85)'); g.addColorStop(1, 'rgba(160,186,220,0)');
    x.fillStyle = g; x.fillRect(0, 0, sz, sz);
  });
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  const mat = new THREE.PointsMaterial({ size: 1.1, map: tex, transparent: true, depthWrite: false, color: 0xffffff });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float ph;\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        transformed.y = mod(position.y - uTime * (0.6 + ph * 0.5), 12.0);
        transformed.x += sin(uTime * 0.8 + ph * 20.0) * 0.3;
        transformed.z += cos(uTime * 0.6 + ph * 13.0) * 0.2;`);
  };
  mat.customProgramCacheKey = () => 'backdrop-snowfall';
  const m = new THREE.Points(g, mat);
  m.name = 'snowfall'; m.frustumCulled = false;
  K.meshes.push(m);
  K.tick.push((t) => { uTime.value = t; });
}

// ============================================================== season 3 helpers
// Colour whole triangles by their centre (crisp stripes on tents, canopies, planets).
function paintTris(parts, fn) {
  for (const g of [parts].flat(Infinity)) {
    const p = g.attributes.position, c = g.attributes.color;
    for (let i = 0; i + 2 < p.count; i += 3) {
      const hex = fn((p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3, (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3, (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3);
      if (hex == null) continue;
      _c.set(hex);
      for (let j = i; j < i + 3; j++) c.setXYZ(j, _c.r, _c.g, _c.b);
    }
  }
  return parts;
}
// Which of n equal pie slices (around y) a point falls in (lines up with cones/lathes).
const slice = (x, z, n) => Math.floor((Math.atan2(z, x) / TAU + 1) * n) % n;
// A thin cord through a list of points (threads, wires, strings).
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

// ============================================================== CRAFT CORNER
const YARN = [0xff9fb2, 0x9fd8c4, 0xffd47a, 0xb9a6f0, 0x8ec8f0, 0xffb38a, 0xf6efe2];
const FABRIC = [0xffc4d2, 0xc4e8d4, 0xfff0b4, 0xdccbf6, 0xffd6b4, 0xc8e4f8];
function craft(K) {
  const { hw, hd, ns } = K;
  const FL = -8, TOP = 24;
  const X0 = hw + 0.5, Z0 = hd + 0.5;
  const TX = hw + 9.5, TZN = hd + 5 + 2 * ns, TZF = -(hd + 10);
  const BZ = -(hd + 14), RX = hw + 15, SZ = hd + 16;
  K.floorY = FL; K.shadow = 0x6e4526;
  const G = K.glossy, M = K.matte, U = K.under;
  const EDGE = 0xc68c5a, APRON = 0xb27a4b, LEG = 0xbf8656, WALL = 0xfff2e4, WAIN = 0xcbe5d0, CAP = 0xffb59a;

  // The craft table: honey planks round the mat (flush, starting under the rail), a
  // rounded edge, an apron and turned legs down to the room floor.
  const top = [
    rectXZ(-TX, TX, Z0, TZN, 0, 0xffffff, 10, 2), rectXZ(-TX, TX, TZF, -Z0, 0, 0xffffff, 10, 3),
    rectXZ(X0, TX, -Z0, Z0, 0, 0xffffff, 3, 10), rectXZ(-TX, -X0, -Z0, Z0, 0, 0xffffff, 3, 10),
  ];
  recolor(top, (x, y, z, c) => c.multiplyScalar(0.84 + 0.16 * smooth(TX, TX - 3, Math.abs(x)) * smooth(TZF, TZF + 3, z) * smooth(TZN, TZN - 2, z)));
  K.meshes.push(texMesh(top, planksTex(K.R, 31, 50, 68), 13, { patched: true, name: 'table' }));
  U.push(rbox(2 * TX + 0.2, 0.9, 1.1, EDGE, 0, -0.91, TZN - 0.5, 0.3), rbox(2 * TX + 0.2, 0.9, 1.1, EDGE, 0, -0.91, TZF + 0.5, 0.3));
  for (const s of [-1, 1]) U.push(rbox(1.1, 0.9, TZN - TZF, EDGE, s * (TX - 0.5), -0.91, (TZN + TZF) / 2, 0.3));
  U.push(box(2 * TX - 2.6, 1.3, 0.35, APRON, 0, -2.2, TZN - 1.25), box(2 * TX - 2.6, 1.3, 0.35, APRON, 0, -2.2, TZF + 1.25));
  for (const s of [-1, 1]) U.push(box(0.35, 1.3, TZN - TZF - 2.6, APRON, s * (TX - 1.25), -2.2, (TZN + TZF) / 2));
  const legP = [[0.45, 0], [0.56, 0.25], [0.47, 0.6], [0.4, 1.6], [0.5, 2.8], [0.68, 3.3], [0.52, 3.8], [0.58, 4.6], [0.72, 5.0], [0.72, 7.1]];
  for (const sx of [-1, 1]) for (const z of [TZN - 1.2, TZF + 1.2]) {
    U.push(lathe(legP, LEG, 10, sx * (TX - 1.2), FL, z));
    K.blob(sx * (TX - 1.2), FL + 0.08, z, 1.4, 1.4, 0.45);
  }

  // Room: warm floorboards, a patchwork rug in front of the table, sage wainscot.
  K.meshes.push(texMesh([rectXZ(-RX, RX, BZ, hd + 70, FL, 0xffffff)], planksTex(K.R, 24, 36, 54), 12, { name: 'floor' }));
  K.blob(0, FL + 0.08, (TZN + TZF) / 2, TX + 1.6, (TZN - TZF) / 2 + 1.6, 0.5);
  const qw = Math.min(hw + 4, TX - 1), q0 = TZN + 1.6, sq = 2.4, nzq = 5, q1 = q0 + nzq * sq;
  M.push(rectXZ(-qw - 0.6, qw + 0.6, q0 - 0.6, q1 + 0.6, FL + 0.03, 0xff9f8f), rectXZ(-qw - 0.15, qw + 0.15, q0 - 0.15, q1 + 0.15, FL + 0.04, 0xfff7ec));
  const nq = Math.round((2 * qw) / sq), qx = (2 * qw) / nq;
  for (let i = 0; i < nq; i++) for (let j = 0; j < nzq; j++) {
    const x = -qw + i * qx, z = q0 + j * sq;
    M.push(rectXZ(x + 0.1, x + qx - 0.1, z + 0.1, z + sq - 0.1, FL + 0.05, FABRIC[(i * 2 + j * 3 + (K.R() < 0.25 ? 1 : 0)) % FABRIC.length]));
    if ((i + j) % 2 === 0) M.push(disc(0.6, (i + 2 * j) % 3 ? WHITE : 0xff9f8f, x + qx / 2, FL + 0.06, z + sq / 2, 4));
  }
  const fz = q0 + 3.4, bkx = -Math.min(hw * 0.5, 7), pfx = Math.min(hw * 0.52, 7.5);
  K.add(yarnBasket(K), bkx, FL, fz, 0.4);
  K.blob(bkx, FL + 0.08, fz, 2.7, 2.7, 0.42);
  K.add(pouf(K), pfx, FL, fz + 1.4);
  K.blob(pfx, FL + 0.08, fz + 1.4, 2.7, 2.7, 0.4);

  const wall = boxS(2 * RX + 2, TOP - FL, 1, WALL, 0, FL, BZ - 0.5, 1, 8, 1);
  shadeY(wall, FL, TOP, 0.82, 1.03);
  M.push(wall, box(2 * RX, 7, 0.3, WAIN, 0, FL, BZ + 0.15));
  G.push(box(2 * RX, 0.35, 0.45, WHITE, 0, FL + 7, BZ + 0.22), box(2 * RX + 2.8, 0.9, 1.7, CAP, 0, TOP, BZ - 0.5));
  for (const s of [-1, 1]) {
    const sw = boxS(1, TOP - FL, SZ - BZ + 1, WALL, s * (RX + 0.5), FL, (SZ + BZ - 1) / 2, 1, 8, 1);
    shadeY(sw, FL, TOP, 0.76, 0.97);
    M.push(sw, box(0.3, 7, SZ - BZ, WAIN, s * (RX - 0.15), FL, (SZ + BZ) / 2));
    G.push(box(0.45, 0.35, SZ - BZ, WHITE, s * (RX - 0.22), FL + 7, (SZ + BZ) / 2), box(0.45, 0.8, SZ - BZ, WHITE, s * (RX - 0.22), FL, (SZ + BZ) / 2));
    G.push(box(1.7, 0.9, SZ - BZ + 1.7, CAP, s * (RX + 0.5), TOP, (SZ + BZ - 1) / 2));
    for (let z = BZ + 1; z <= SZ; z += 3) K.blob(s * (RX - 0.6), FL + 0.06, z, 1.5, 2.6, 0.3);
  }

  // Yarn cubbies along the back wall (their top rows peek over the table), fairy lights
  // on the top edge, a window with curtains above, embroidery hoops either side.
  const CW = Math.min(hw + 4, RX - 5), ncol = Math.min(10, Math.max(5, Math.round((2 * CW) / 3.2))), cw = (2 * CW) / ncol;
  const SD = 3.0, sz = BZ + SD / 2 + 0.1, sy0 = -5.6, STOP = 4.4, rows = 3, ch = (STOP - sy0) / rows, SH = 0xfffaf2;
  G.push(box(2 * CW + 0.4, sy0 - FL, SD, 0xe8d8c4, 0, FL, sz), box(2 * CW, STOP - sy0, 0.15, 0xf6dccb, 0, sy0, BZ + 0.18));
  for (let r = 0; r <= rows; r++) G.push(box(2 * CW + 0.4, 0.3, SD, SH, 0, r === rows ? STOP - 0.3 : sy0 + r * ch, sz));
  for (let c = 0; c <= ncol; c++) G.push(box(0.28, STOP - sy0, SD, SH, -CW + c * cw, sy0, sz));
  for (let r = 0; r < rows; r++) for (let c = 0; c < ncol; c++) craftCubby(K, G, r === 0 ? 3 : Math.floor(K.R() * 3), -CW + (c + 0.5) * cw, sy0 + r * ch + 0.3, sz + 0.2, cw - 0.28);
  for (let x = -CW + 1.7, i = Math.floor(K.R() * 4); x < CW - 1.2; x += 4.4, i++) {
    const k = i % 4;
    if (k === 0) K.add(pottedPlant(K, 0.8), x, STOP, sz);
    else if (k === 1) K.add(books(K), x, STOP, sz - 0.3);
    else if (k === 2) K.add([...put(yarnBall(K, 0.62, K.pick(YARN), 2, 1), -0.5, 0, 0), ...put(yarnBall(K, 0.55, K.pick(YARN), 2, 1), 0.7, 0, 0.3)], x, STOP, sz);
    else K.add([...spool(K, 1.4, 0.4, K.pick(YARN), undefined, 10, 1), ...put(spool(K, 1.1, 0.34, K.pick(YARN), undefined, 10, 1), 0, 1.4, 0)], x, STOP, sz);
  }
  const LB = [0xfff1c4, 0xffd6e0, 0xfff8e6, 0xd8f0ff], lz = sz + SD / 2 + 0.12, nseg = Math.max(3, Math.round((2 * CW) / 4.5)), segW = (2 * CW) / nseg;
  for (let k = 0; k < nseg; k++) {
    const a = [-CW + k * segW, STOP - 0.1, lz], b = [-CW + (k + 1) * segW, STOP - 0.1, lz];
    swag(G, a, b, 0.6, 0x8a7a6a, 0.035, 3);
    for (let i = 1; i < 5; i++) {
      const t = i / 5, x = a[0] + (b[0] - a[0]) * t, y = a[1] - Math.sin(t * PI) * 0.6 - 0.14;
      K.lit.push(ballC(0.15, LB[(k * 4 + i) % LB.length], x, y, lz + 0.04, 0));
      K.halos.push([x, y, lz + 0.2, 0.55, 0.55, 0.42, 0xffc67a, true]);
    }
  }
  const ww = Math.min(11, hw * 0.9), wy = 6.2, wh = 8.5;
  K.add(windowView(K, ww, wh, WHITE, true), 0, wy, BZ + 0.05);
  for (const s of [-1, 1]) K.add(curtain(K, 2.4, wh + 0.6), s * (ww / 2 + 1.4), wy, BZ + 0.9);
  const HX = ww / 2 + 4.8;
  [[-HX, 7.6, 1.7, 0xfff7ec, 0], [HX, 7.4, 1.9, 0xeaf4ff, 1], [-(HX + 4.3), 9.4, 1.3, 0xfff0f4, 2]].forEach(([x, y, r, cloth, m]) => {
    if (Math.abs(x) + r < RX - 1) K.add(hoop(K, r, cloth, m), x, y, BZ + 0.05);
  });
  K.add(dressForm(K), CW + 3.2, FL, BZ + 2.8, -0.4);
  K.blob(CW + 3.2, FL + 0.06, BZ + 2.8, 2.6, 2.4, 0.4);
  K.add(pottedPlant(K, 4.4), -(CW + 3.0), FL, BZ + 2.6, 0.5);
  K.blob(-(CW + 3.0), FL + 0.06, BZ + 2.6, 2.8, 2.6, 0.4);

  // On the table, far side: the sewing machine, the lamp, fabric, pencils and a ruler.
  const smx = -Math.max(hw * 0.22, 2.4), smz = -(hd + 5.6);
  K.add(sewingMachine(K), smx, 0, smz, 0.04);
  K.blob(smx + 0.3, 0.02, smz + 0.2, 4.8, 2.6, 0.4);
  const lampX = Math.max(hw * 0.58, 5), lampZ = -(hd + 6.4), lamp = deskLamp(0xff9f8f);
  K.add(lamp, lampX, 0, lampZ, -0.3);
  K.blob(lampX, 0.02, lampZ, 2.0, 1.8, 0.4);
  const [lbx, lbz] = turn(lamp.bulb[0], lamp.bulb[2], -0.3);
  K.halos.push([lampX + lbx, lamp.bulb[1], lampZ + lbz + 0.8, 2.0, 1.6, 0.55, 0xffc46b, true], [lampX + lbx, 0.05, lampZ + lbz, 3.4, 2.8, 0.3, 0xffd28a, false]);
  const fsx = -(hw * 0.75 + 3);
  K.add(fabricStack(K), fsx, 0, -(hd + 4.6), 0.15);
  K.blob(fsx, 0.02, -(hd + 4.6), 2.6, 1.9, 0.38, 0.15);
  K.add(pencilCup(K), hw * 0.18 + 2, 0, -(hd + 3.4));
  K.blob(hw * 0.18 + 2, 0.02, -(hd + 3.4), 1.1, 1.0, 0.35);
  K.add(ruler(8), hw * 0.1 + 1, 0, -(hd + 8.8), 0.05);
  K.add(spool(K, 2.2, 0.62, YARN[1]), lampX + 3.8, 0, lampZ + 2.6);
  K.blob(lampX + 3.8, 0.02, lampZ + 2.6, 1.0, 1.0, 0.35);

  // Down the left side: scissors, the tomato pincushion, big spools, the button jar.
  const thr = [];
  K.add(scissors(), -(hw + 4.6), 0, hd * 0.72, 2.6);
  K.blob(-(hw + 4.4), 0.02, hd * 0.72 - 0.8, 2.6, 1.3, 0.25, 2.6);
  K.add(pincushion(K), -(hw + 4.6), 0, hd * 0.3);
  K.blob(-(hw + 4.6), 0.02, hd * 0.3, 1.8, 1.7, 0.42);
  const spx = -(hw + 4.6), spz = -hd * 0.12;
  [[0, 0, 3.0, 0.82, 0], [1.7, 1.1, 2.3, 0.7, 3], [-1.5, 1.3, 1.9, 0.6, 5]].forEach(([dx, dz, h, r, ci]) => {
    K.add(spool(K, h, r, YARN[ci]), spx + dx, 0, spz + dz);
    K.blob(spx + dx, 0.02, spz + dz, r * 1.6, r * 1.5, 0.4);
  });
  threadLine(K, thr, [[spx + 0.75, 2.4, spz + 0.2], [spx + 1.5, 0.05, spz + 0.6]], -(hw + 1.7), hd * 0.08, YARN[0], 0.5);
  K.add(buttonJar(K), -(hw + 3.6), 0, -hd * 0.62);
  K.blob(-(hw + 3.6), 0.02, -hd * 0.62, 1.7, 1.6, 0.42);
  const BTN = [0xff8fa8, 0x8fd0ff, 0xffd36e, 0x9fe0b4, 0xc9a8ff, 0xffa36b];
  for (const [dx, dz] of [[1.6, 0.9], [1.4, -1.5], [0.4, 1.9], [-1.6, 1.5]]) K.add(craftButton(K.pick(BTN), K.rnd(0.34, 0.48)), -(hw + 3.6) + dx, 0, -hd * 0.62 + dz, K.R() * TAU);

  // Down the right side: knitting in progress, more yarn, a thimble, a tall spool.
  K.add(knitting(K, YARN[3]), hw + 3.6, 0, hd * 0.6, -0.3);
  K.blob(hw + 4.6, 0.02, hd * 0.6, 3.0, 2.0, 0.35, -0.3);
  const yb = [[hw + 3.9, hd * 0.06, 1.15, YARN[0]], [hw + 6.5, -hd * 0.06, 1.35, YARN[2]]];
  for (const [x, z, r, c] of yb) { K.add(yarnBall(K, r, c, 4, 2), x, 0, z, K.R() * TAU); K.blob(x, 0.02, z, r * 1.3, r * 1.2, 0.42); }
  threadLine(K, thr, [[yb[0][0] - 0.9, 0.5, yb[0][1] + 0.5], [yb[0][0] - 1.4, 0.05, yb[0][1] + 0.9]], hw + 1.7, hd * 0.32, YARN[0], 0.45);
  K.add(thimble(), hw + 3.4, 0, -hd * 0.36);
  K.blob(hw + 3.4, 0.02, -hd * 0.36, 0.8, 0.8, 0.35);
  K.add(lyingSpool(K, 2.0, 0.55, YARN[4]), hw + 5.4, 0, -hd * 0.42, 0.5);
  K.blob(hw + 5.4, 0.02, -hd * 0.42, 1.4, 0.9, 0.3, 0.5);
  K.add(spool(K, 2.8, 0.78, YARN[5]), hw + 4.2, 0, -hd * 0.78);
  K.blob(hw + 4.2, 0.02, -hd * 0.78, 1.3, 1.2, 0.4);
  G.push(...thr);

  // Near strip (seen at every level start): flat, low pieces only.
  const nzM = (hd + 1.2 + TZN) / 2;
  K.add(patternPaper(K), -hw * 0.42, 0, nzM, 0.1, ns);
  K.blob(-hw * 0.42, 0.02, nzM, 3.0 * ns, 2.1 * ns, 0.12, 0.1);
  K.add(tapeMeasure(K, [[hw * 0.5, nzM + 0.3], [hw * 0.5 - 1.1, nzM - 0.1], [hw * 0.3, hd + 2.3], [hw * 0.02, hd + 2.2], [-hw * 0.07, hd + 3.6], [hw * 0.04, hd + 5.2], [hw * 0.2, TZN - 1.3]]), 0, 0, 0);
  K.blob(hw * 0.5, 0.02, nzM + 0.3, 1.3, 1.2, 0.3);
  K.add(thimble(), -hw * 0.82, 0, hd + 2.4, 0, ns);
  K.blob(-hw * 0.82, 0.02, hd + 2.4, 0.7 * ns, 0.7 * ns, 0.3);
  K.add(lyingSpool(K, 1.6, 0.42, YARN[0]), hw * 0.8, 0, hd + 2.6, -0.4, ns);
  K.blob(hw * 0.8, 0.02, hd + 2.6, 1.1 * ns, 0.7 * ns, 0.28, -0.4);
  for (const [x, z] of [[-hw * 0.08, hd + 1.9], [hw * 0.33, TZN - 1.0], [-hw * 0.72, TZN - 1.2], [hw * 0.66, TZN - 1.6], [-hw * 0.2, TZN - 0.9], [hw * 0.12, hd + 6.2]]) {
    if (z > TZN - 0.7) continue;
    K.add(craftButton(K.pick(BTN), K.rnd(0.32, 0.46)), x, 0, z, K.R() * TAU, ns);
  }
}
function spool(K, h, r, thread, wood = 0xebc896, seg = 14, bands = 3) {
  const f = r * 1.28, p = [cyl(f, f, 0.22, wood, 0, 0, 0, seg), custom(new THREE.CylinderGeometry(r, r, h - 0.44, seg, 1, true).translate(0, h / 2, 0), thread), cyl(f, f, 0.22, wood, 0, h - 0.22, 0, seg), disc(r * 0.3, 0x8a5a36, 0, h + 0.01, 0, 8)];
  const hi = lighten(thread, 0.4);
  for (let i = 1; i <= bands; i++) p.push(custom(new THREE.CylinderGeometry(r + 0.02, r + 0.02, 0.06, seg, 1, true).translate(0, 0.25 + (h - 0.44) * (i / (bands + 1)), 0), hi));
  return p;
}
// A spool lying on its side (axis along x), resting on y=0.
function lyingSpool(K, h, r, thread) {
  return put(put(spool(K, h, r, thread), 0, -h / 2, 0), 0, r * 1.28, 0, 0, 1, 0, PI / 2);
}
function yarnBall(K, r, col, wraps = 5, det = 2) {
  const p = [ballC(r, col, 0, r, 0, det)], d = darken(col, 0.84);
  for (let i = 0; i < wraps; i++) {
    const g = new THREE.TorusGeometry(r * 0.99, r * 0.07, 3, det > 1 ? 18 : 12).rotateX(K.R() * PI).rotateZ(K.R() * PI).translate(0, r, 0);
    p.push(custom(g, i % 2 ? d : col));
  }
  return shadeY(p, 0, 2 * r, 0.78, 1.08);
}
// A loose thread from a start (pts0, ending on the table) wandering to (x1, z1).
function threadLine(K, list, pts0, x1, z1, col, wig = 0.5) {
  const [x0, , z0] = pts0[pts0.length - 1], len = Math.hypot(x1 - x0, z1 - z0) || 1, n = Math.max(4, Math.round(len / 0.6)), ph = K.R() * TAU;
  const px = -(z1 - z0) / len, pz = (x1 - x0) / len, pts = [...pts0];
  for (let i = 1; i <= n; i++) {
    const t = i / n, w = Math.sin(t * PI * 2.4 + ph) * wig * Math.sin(t * PI);
    pts.push([x0 + (x1 - x0) * t + px * w, 0.05, z0 + (z1 - z0) * t + pz * w]);
  }
  return cord(list, pts, 0.045, col, 4);
}
function craftCubby(K, list, kind, cx, y, z, w) {
  if (kind === 0) {
    const n = w > 2.75 ? 3 : 2;
    for (let i = 0; i < n; i++) list.push(...put(yarnBall(K, K.rnd(0.6, 0.76), K.pick(YARN), 1, 1), cx - w / 2 + (i + 0.5) * (w / n), y, z + K.rnd(-0.3, 0.3)));
  } else if (kind === 1) {
    let yy = y;
    for (let i = 0; i < 4; i++) { const h = K.rnd(0.4, 0.55); list.push(box(w - 0.6 - K.rnd(0, 0.3), h, 2.2, K.pick(FABRIC), cx + K.rnd(-0.1, 0.1), yy, z - 0.1)); yy += h; }
  } else if (kind === 2) {
    for (let i = 0; i < 3; i++) list.push(...put(spool(K, 1.3, 0.34, K.pick(YARN), undefined, 8, 0), cx + (i - 1) * w * 0.3, y, z + 0.3));
    for (let i = 0; i < 2; i++) list.push(...put(spool(K, 1.1, 0.3, K.pick(YARN), undefined, 8, 0), cx + (i - 0.5) * w * 0.3, y + 1.3, z + 0.3));
  } else {
    list.push(box(w - 0.4, 2.3, 2.4, K.pick(PASTEL), cx, y, z - 0.1), box(w * 0.4, 0.5, 0.06, WHITE, cx, y + 1.3, z + 1.12));
  }
}
function yarnBasket(K) {
  const W = 0xd9a86a, WD = 0xbf8a4f;
  const p = [lathe([[1.5, 0], [1.85, 0.3], [2.05, 2.0], [2.1, 2.2]], W, 18), disc(1.98, 0x9a6a44, 0, 1.75, 0, 18)];
  jitter(p.slice(0, 1), K.R, 0.1);
  for (let i = 0; i < 4; i++) p.push(thinRing(1.84 + i * 0.06, 0.07, WD, 0, 0.45 + i * 0.45, 0, PI / 2, 18));
  p.push(thinRing(2.1, 0.15, WD, 0, 2.2, 0, PI / 2, 20));
  [[-0.7, -0.5], [0.75, -0.35], [0.0, 0.7], [-0.15, -0.1]].forEach(([x, z], i) => p.push(...put(yarnBall(K, i === 3 ? 0.85 : 0.75, K.pick(YARN), 3, 1), x, i === 3 ? 2.0 : 1.55, z)));
  p.push(rod([0.3, 2.2, 0.2], [1.6, 4.0, -0.6], 0.07, 0.07, 0xffd36e, 5), ballC(0.16, 0xff8f9f, 1.6, 4.0, -0.6, 0), rod([0.0, 2.2, 0.4], [1.1, 4.1, 0.9], 0.07, 0.07, 0xffd36e, 5), ballC(0.16, 0xff8f9f, 1.1, 4.1, 0.9, 0));
  return p;
}
function pouf(K) {
  const C = 0xbcdcec, p = [dome(2.2, 1.7, 2.2, C, 0, 0, 0, 20, 6)];
  for (let i = 0; i < 6; i++) p.push(custom(new THREE.TorusGeometry(1, 0.04, 3, 16, PI).scale(2.21, 1.71, 2.21).rotateY(i * PI / 6), darken(C, 0.86)));
  shadeY(p, 0, 1.7, 0.78, 1.06);
  p.push(ballC(0.22, darken(C, 0.8), 0, 1.78, 0, 1));
  return p;
}
function dressForm(K) {
  const F = 0xffb8bf, W = 0xc89262, p = [];
  for (let i = 0; i < 3; i++) { const a = (i / 3) * TAU + 0.3; p.push(rod([0, 2.6, 0], [Math.cos(a) * 2.1, 0, Math.sin(a) * 2.1], 0.15, 0.12, W, 6)); }
  p.push(cyl(0.34, 0.34, 0.5, W, 0, 2.3, 0, 10), rod([0, 2.6, 0], [0, 7.3, 0], 0.17, 0.17, W, 8));
  const torso = lathe([[0.25, 7.0], [1.75, 7.15], [2.05, 8.1], [1.62, 9.6], [1.48, 10.2], [1.85, 11.4], [2.0, 12.3], [1.72, 13.1], [0.62, 13.55], [0.5, 14.2], [0.66, 14.45], [0.01, 14.55]], F, 18);
  put(torso, 0, 0, 0, 0, [1, 1, 0.82]);
  shadeY(torso, 7, 14.5, 0.84, 1.06);
  p.push(torso, custom(new THREE.TorusGeometry(0.7, 0.09, 4, 14).rotateX(PI / 2 - 0.25).translate(0, 13.5, 0), 0xffe27a));
  for (const sx of [-0.42, 0.42]) p.push(box(0.34, 3.0, 0.05, 0xffe27a, sx, 10.4, 1.74));
  for (const [x, z, c] of [[-1.2, 0.3, 0xff8fa8], [-0.9, -0.4, 0xffd23f], [1.1, 0.2, 0x8fdcc4]]) p.push(rod([x, 12.6, z], [x * 1.25, 13.4, z * 1.4], 0.03, 0.03, CHROME, 3), ballC(0.13, c, x * 1.25, 13.4, z * 1.4, 0));
  return p;
}
function hoop(K, r, cloth, motif) {
  const p = [vdisc(r, cloth, 0, 0, 0.06, 24), thinRing(r + 0.02, 0.13, 0xe0ab70, 0, 0, 0.1, 0, 24), thinRing(r + 0.17, 0.08, 0xc8915a, 0, 0, 0.1, 0, 24), box(0.36, 0.5, 0.3, 0xc8915a, 0, r + 0.05, -0.05)];
  if (motif === 0) {
    const c = K.pick([0xff8fa8, 0xffb36b, 0xb9a6f0]);
    for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU + PI / 2; p.push(vdisc(r * 0.2, c, Math.cos(a) * r * 0.22, r * 0.12 + Math.sin(a) * r * 0.22, 0.08, 10)); }
    p.push(vdisc(r * 0.13, 0xffd23f, 0, r * 0.12, 0.09, 10), box(0.08, r * 0.62, 0.02, 0x5fae5a, 0, -r * 0.62, 0.08));
    p.push(...put([vdisc(r * 0.12, 0x6cc46b, 0, 0, 0, 8)], r * 0.13, -r * 0.35, 0.08, 0, [1.5, 0.7, 1]));
  } else if (motif === 1) {
    const hs = new THREE.Shape(); hs.moveTo(0, -0.7); hs.bezierCurveTo(-1.2, 0.1, -0.7, 1.0, 0, 0.45); hs.bezierCurveTo(0.7, 1.0, 1.2, 0.1, 0, -0.7);
    p.push(shapeZ(hs, 0xff8fa8, 0, 0, 0.08, r * 0.55));
  } else {
    [0xff8fa8, 0xffb36b, 0xffe27a, 0x8fdcc4, 0x8fc8ff].forEach((c, i) => p.push(custom(new THREE.RingGeometry(r * (0.5 - i * 0.07), r * (0.57 - i * 0.07), 16, 1, 0, PI).translate(0, -r * 0.2, 0.08 + i * 0.002), c)));
  }
  return p;
}
function pincushion(K) {
  const RED = 0xff7f86, p = [egg(1.45, 0.95, 1.45, RED, 0, 0.92, 0, 14, 9)];
  for (let i = 0; i < 6; i++) p.push(custom(new THREE.TorusGeometry(1, 0.05, 3, 18).scale(1.46, 0.96, 1.46).rotateY(i * PI / 6).translate(0, 0.92, 0), 0xe8646e));
  shadeY(p, 0, 1.9, 0.78, 1.08);
  p.push(custom(new THREE.ExtrudeGeometry(starShape(0.8, 0.42, 5), { depth: 0.1, bevelEnabled: false }).rotateX(-PI / 2).translate(0, 1.82, 0), 0x6cc46b), cyl(0.09, 0.12, 0.4, 0x4fa64a, 0, 1.85, 0, 6));
  const heads = [0xffd23f, 0x5cc8ff, 0xffffff, 0xb48cff, 0x7be07a, 0xff5c8a];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU + K.R() * 0.4, e = K.rnd(0.25, 1.0), ce = Math.cos(e), se = Math.sin(e);
    const b = [1.3 * ce * Math.cos(a), 0.92 + 0.86 * se, 1.3 * ce * Math.sin(a)], t = [b[0] + ce * Math.cos(a) * 0.75, b[1] + se * 0.75 + 0.2, b[2] + ce * Math.sin(a) * 0.75];
    p.push(rod(b, t, 0.035, 0.035, CHROME, 3), ballC(0.15, heads[i % heads.length], t[0], t[1], t[2], 0));
  }
  cord(p, [[1.1, 1.1, 0.7], [1.8, 0.9, 1.0], [2.2, 0.62, 1.12]], 0.03, 0x4fa64a);
  p.push(custom(new THREE.ConeGeometry(0.3, 0.6, 8).rotateX(PI).translate(2.25, 0.3, 1.15), 0xff5a6e));
  return p;
}
function buttonJar(K) {
  const s = [], BTN = [0xff8fa8, 0x8fd0ff, 0xffd36e, 0x9fe0b4, 0xc9a8ff, 0xffffff, 0xffa36b];
  for (let i = 0; i < 26; i++) {
    const y = 0.15 + (i / 26) * 1.6 + K.rnd(-0.1, 0.1), a = K.R() * TAU, d = Math.sqrt(K.R()) * 0.8;
    s.push(...put([cyl(0.32, 0.32, 0.1, K.pick(BTN), 0, -0.05, 0, 7)], Math.cos(a) * d, y, Math.sin(a) * d, K.R() * TAU, 1, K.rnd(-0.6, 0.6), K.rnd(-0.6, 0.6)));
  }
  s.push(cyl(1.08, 1.08, 0.42, 0xff9fb2, 0, 2.55, 0, 16), disc(1.08, 0xffd2dc, 0, 2.98, 0, 16), torus(1.1, 0.08, WHITE, 0, 2.62, 0, PI / 2, 16));
  s.push(panel(1.2, 0.75, WHITE, 0, 0.75, 1.25), panel(0.9, 0.12, 0xff7f86, 0, 1.1, 1.26));
  return { s, g: [lathe([[0, 0], [1.15, 0], [1.22, 0.15], [1.22, 2.2], [1.05, 2.5], [1.0, 2.6]], 0xe8f6ff, 18)] };
}
function craftButton(col, r = 0.42) {
  const d = darken(col, 0.8);
  return [cyl(r, r, 0.14, col, 0, 0, 0, 12), ringXZ(r * 0.62, r * 0.74, d, 0, 0.145, 0, 12), ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => disc(0.055, d, a * r * 0.2, 0.15, b * r * 0.2, 6))];
}
function scissors() {
  const H = 0xff8a8a;
  const blade = (a) => custom(new THREE.ConeGeometry(0.34, 4.0, 4).rotateZ(-PI / 2).scale(1, 0.22, 1).translate(2.0, 0.1, 0).rotateY(a), CHROME);
  const p = [blade(0.1), blade(-0.1)];
  for (const s of [-1, 1]) {
    p.push(rod([0, 0.12, 0], [-1.0, 0.12, s * 0.62], 0.13, 0.13, H, 6));
    p.push(custom(new THREE.TorusGeometry(0.62, 0.17, 6, 16).rotateX(PI / 2).scale(1.25, 1, 1).translate(-1.75, 0.17, s * 0.85), H));
  }
  p.push(cyl(0.2, 0.2, 0.14, CHROME_D, 0, 0.18, 0, 10));
  return p;
}
function fabricStack(K) {
  const p = [], o = Math.floor(K.R() * FABRIC.length);
  let y = 0;
  for (let i = 0; i < 5; i++) {
    const h = K.rnd(0.36, 0.5), c = FABRIC[(i * 2 + o) % FABRIC.length];
    p.push(custom(new RoundedBoxGeometry(4.2 - i * 0.12, h, 2.9, 1, 0.14).rotateY(K.rnd(-0.05, 0.05)).translate(K.rnd(-0.15, 0.15), y + h / 2, K.rnd(-0.1, 0.1)), c));
    p.push(box(3.8 - i * 0.12, 0.05, 0.05, darken(c, 0.82), 0, y + h * 0.5, 1.58));
    y += h;
  }
  for (let i = 0; i < 9; i++) p.push(disc(0.15, WHITE, -1.4 + (i % 3) * 1.2 + (Math.floor(i / 3) % 2) * 0.6, y + 0.012, -0.9 + Math.floor(i / 3) * 0.9, 8));
  p.push(box(0.34, y + 0.05, 3.0, 0xff8f9f, 0.9, 0, 0), torus(0.3, 0.09, 0xff8f9f, 0.62, y + 0.14, 0, PI / 2, 10), torus(0.3, 0.09, 0xff8f9f, 1.18, y + 0.14, 0, PI / 2, 10));
  return p;
}
function sewingMachine(K) {
  const B = 0x9fdcc6, CR = 0xfff6ea, TH = 0xff8f9f;
  const p = [
    rbox(7.8, 0.9, 3.6, CR, 0, 0, 0, 0.3), rbox(2.0, 4.8, 2.6, B, 2.6, 0.7, -0.2, 0.6), rbox(7.2, 1.9, 2.5, B, -0.2, 4.4, -0.2, 0.8),
    rbox(1.7, 3.1, 2.3, B, -3.0, 2.2, -0.2, 0.55),
  ];
  shadeY(p, 0, 6.3, 0.86, 1.05);
  p.push(box(5.4, 0.14, 0.06, GOLD, -0.4, 5.3, 1.06), cyl(1.15, 1.15, 0.42, CR, 3.85, 4.9, -0.2, 20, 0, PI / 2), cyl(0.42, 0.42, 0.5, CHROME, 4.05, 4.9, -0.2, 10, 0, PI / 2),
    vdisc(0.5, CR, 2.6, 3.3, 1.12, 16), box(0.1, 0.42, 0.05, INK, 2.6, 3.3, 1.14),
    rod([-3.25, 2.3, 0.62], [-3.25, 1.05, 0.62], 0.06, 0.06, CHROME, 5), rod([-2.85, 2.3, 0.5], [-2.85, 1.15, 0.5], 0.09, 0.09, CHROME, 5),
    box(0.75, 0.12, 0.6, CHROME, -2.95, 0.98, 0.62), box(1.6, 0.04, 1.3, CHROME_D, -3.0, 0.9, 0.45),
    rod([0.9, 6.3, -0.2], [0.9, 7.5, -0.2], 0.05, 0.05, CHROME, 5));
  p.push(...put(spool(K, 1.1, 0.36, TH, undefined, 10, 1), 0.9, 6.3, -0.2));
  cord(p, [[0.9, 7.0, 0.2], [-0.8, 6.85, 0.95], [-2.6, 6.45, 1.0], [-3.35, 4.9, 0.98], [-3.3, 2.4, 0.72], [-3.25, 1.3, 0.64]], 0.03, TH, 3);
  p.push(box(3.6, 0.06, 2.2, 0xffd6b4, -2.7, 0.9, 0.6));
  for (let i = 0; i < 6; i++) p.push(box(0.3, 0.03, 0.07, TH, -4.2 + i * 0.5, 0.96, 1.2));
  return p;
}
function deskLamp(col) {
  const s = [cyl(1.4, 1.6, 0.45, col, 0, 0, 0, 18), ballC(0.3, CHROME, 0, 0.7, 0, 1)];
  const a = [0, 0.6, 0], b = [-1.4, 4.6, 0.2], c = [1.2, 7.4, 0.5];
  s.push(rod(a, b, 0.13, 0.13, CHROME_D, 6), rod([0.3, 0.6, 0], [b[0] + 0.3, b[1], b[2]], 0.05, 0.05, CHROME_D, 4), ballC(0.32, col, ...b, 1), rod(b, c, 0.12, 0.12, CHROME_D, 6), ballC(0.26, col, ...c, 1));
  const shade = lathe([[1.7, 0], [1.55, 0.35], [1.0, 1.35], [0.5, 1.8], [0.3, 2.05]], col, 18);
  s.push(...put([shade], c[0] + 0.8, c[1] - 2.1, c[2], 0, 1, 0, -0.3));
  return { s, l: [ballC(0.62, 0xfff3c8, c[0] + 0.75, c[1] - 1.75, c[2], 1)], bulb: [c[0] + 0.8, c[1] - 2.0, c[2]] };
}
function pencilCup(K) {
  const p = [cyl(0.85, 0.75, 1.9, 0xbfe4f4, 0, 0, 0, 14), torus(0.85, 0.08, WHITE, 0, 1.9, 0, PI / 2, 14), disc(0.8, 0x6b5a50, 0, 1.7, 0, 14)];
  const cols = [0xff6f7a, 0xffd23f, 0x5fd16a, 0x4fa3ff, 0xb07cff, 0xff9a3a];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + 0.3, b = [Math.cos(a) * 0.35, 0.4, Math.sin(a) * 0.35], h = K.rnd(3.0, 3.7);
    const d = new THREE.Vector3(Math.cos(a) * 0.28, 1, Math.sin(a) * 0.28).normalize();
    const t = [b[0] + d.x * h, b[1] + d.y * h, b[2] + d.z * h], tip = [t[0] + d.x * 0.5, t[1] + d.y * 0.5, t[2] + d.z * 0.5];
    p.push(rod(b, t, 0.13, 0.13, cols[i], 6), rod(t, tip, 0.13, 0.02, 0xf6d6a8, 6));
  }
  return p;
}
function ruler(len) {
  const p = [box(len, 0.14, 1.1, 0xfff1b8, 0, 0, 0)];
  for (let i = 0, x = -len / 2 + 0.3; x < len / 2 - 0.2; i++, x += 0.4) p.push(box(0.05, 0.02, i % 5 ? 0.25 : 0.5, 0x8a6a4a, x, 0.14, -0.55 + (i % 5 ? 0.125 : 0.25)));
  return p;
}
const thimble = () => [lathe([[0, 0], [0.55, 0], [0.6, 0.12], [0.56, 0.85], [0.42, 1.1], [0, 1.18]], CHROME, 14), torus(0.6, 0.06, GOLD, 0, 0.12, 0, PI / 2, 14)];
function knitting(K, col) {
  const p = [...yarnBall(K, 1.3, col, 6, 2)], d = darken(col, 0.84), sw = [box(2.6, 0.16, 3.0, col, 0, 0, 0)];
  for (let i = 0; i < 6; i++) sw.push(box(0.12, 0.05, 2.9, d, -1.0 + i * 0.4, 0.16, 0));
  p.push(...put(sw, 2.9, 0, 0.6, 0.2));
  p.push(rod([1.2, 0.3, -0.7], [4.9, 0.32, -1.6], 0.08, 0.08, 0xd9a066, 6), ballC(0.2, 0xff8fa8, 1.2, 0.3, -0.7, 1), rod([1.6, 0.3, -1.5], [4.6, 0.36, -0.4], 0.08, 0.08, 0xd9a066, 6), ballC(0.2, 0x8fdcc4, 1.6, 0.3, -1.5, 1));
  return cord(p, [[1.0, 1.0, 0.5], [1.5, 0.35, 0.6], [1.9, 0.12, 0.2]], 0.05, col);
}
// Tape measure: the case at pts[0], the yellow tape (with tick marks) along the rest.
function tapeMeasure(K, pts) {
  const p = [], [cx, cz] = pts[0];
  p.push(cyl(1.0, 1.0, 0.72, 0xff9f8f, cx, 0, cz, 20), cyl(0.56, 0.56, 0.06, WHITE, cx, 0.72, cz, 16), cyl(0.24, 0.24, 0.1, CHROME, cx, 0.76, cz, 10));
  const curve = new THREE.CatmullRomCurve3(pts.slice(1).map(([x, z]) => new THREE.Vector3(x, 0, z)));
  const sp = curve.getSpacedPoints(Math.max(8, Math.round(curve.getLength() / 0.3))).map((v) => [v.x, v.z]);
  p.push(...groundRibbon(sp, 0.62, 0xffe27a, 0.035));
  for (let i = 1; i < sp.length - 1; i++) {
    const [x, z] = sp[i], [dx, dz] = norm2(sp[i + 1][0] - sp[i - 1][0], sp[i + 1][1] - sp[i - 1][1]), L = i % 5 ? 0.16 : 0.32, nx = -dz, nz = dx;
    p.push(...put([box(0.045, 0.01, L, 0x6b4a3a, 0, 0, 0)], x + nx * (0.31 - L / 2), 0.04, z + nz * (0.31 - L / 2), Math.atan2(nx, nz)));
  }
  const [ex, ez] = sp[sp.length - 1], [dx, dz] = norm2(ex - sp[sp.length - 2][0], ez - sp[sp.length - 2][1]);
  p.push(...put([box(0.72, 0.22, 0.2, CHROME, 0, 0, 0)], ex, 0.03, ez, Math.atan2(-dx, -dz)));
  return p;
}
function patternPaper(K) {
  const p = [flat(5.6, 3.8, 0xfbf1dc, 0, 0.02, 0), flat(4.8, 3.2, 0xfff9ee, 0.5, 0.03, 0.2, 0.12)];
  const out = [[-1.7, 1.3], [-1.1, -1.3], [0.1, -1.4], [0.5, -0.9], [1.8, -1.1], [1.7, 1.3], [-1.7, 1.3]];
  for (let k = 0; k + 1 < out.length; k++) {
    const [ax, az] = out[k], [bx, bz] = out[k + 1], n = Math.floor(Math.hypot(bx - ax, bz - az) / 0.34), ang = Math.atan2(-(bz - az), bx - ax);
    for (let i = 0; i < n; i++) { const t = (i + 0.3) / n; p.push(...put([box(0.18, 0.012, 0.06, 0x7d8fd8, 0, 0, 0)], ax + (bx - ax) * t, 0.045, az + (bz - az) * t, ang)); }
  }
  p.push(box(0.05, 0.012, 1.6, 0x7d8fd8, 0.3, 0.045, 0.1), custom(new THREE.ConeGeometry(0.16, 0.3, 3).rotateX(-PI / 2).translate(0.3, 0.06, -0.8), 0x7d8fd8));
  for (const [x, z, a, c] of [[-1.9, -1.5, 0.4, 0xff8fa8], [2.0, 1.5, -0.7, 0xffd23f], [1.9, -1.4, 2.0, 0x8fdcc4]]) p.push(...put([rod([0, 0, 0], [1.1, 0, 0], 0.03, 0.03, CHROME, 3), ballC(0.13, c, 0, 0, 0, 0)], x, 0.08, z, a));
  return p;
}

// ============================================================== FUN FAIR
const BULB = [0xfff1b0, 0xffd0dc, 0xd2f0ff, 0xfff8e6, 0xe2d4ff];
const PENNANT = [0xff8fb0, 0xffd36e, 0x8fdcc4, 0x9fc8ff, 0xc9b2ff];
const BALLOON = [0xff7f9f, 0xffd36e, 0x7fd8ff, 0x9fe08a, 0xc9a2ff, 0xff9f6a];
function fair(K) {
  const { hw, hd, ns } = K;
  K.shadow = 0x3f6b3a;
  const G = K.glossy;
  const X0 = hw + 0.5, Z0 = hd + 0.5, PB = 2.4, PX = X0 + PB, PZ = Z0 + PB;
  const FZ = -(hd + 27);
  const Rw = 7.6, hubY = Rw + 3.0, wheelX = -Math.max(hw * 0.42, 4.6), wheelZ = -(hd + 10.5);
  const Rc = 4.6, carX = Math.max(hw * 0.5, 5) + 4.5, carZ = -(hd + 8.6);
  const tied = [], free = [];
  K.claim(wheelX, wheelZ, Rw + 1); K.claim(carX, carZ, Rc + 1.4);

  // Ground: grass patches, clover, a cobbled plaza ring and paths out to the rides.
  const dots = [];
  for (let i = 0; i < 46; i++) {
    const [x, z] = K.around(PB + 2.4, 28, 18), r = K.rnd(1.6, 4.0);
    dots.push([x, 0.01 + (i % 4) * 0.01, z, r, K.pick([0x86c86a, 0x9ad77c, 0x80c066, 0xa6dd88]), 12, 1, K.rnd(0.6, 1), K.R() * PI]);
  }
  for (let i = 0; i < 120; i++) { const [x, z] = K.around(PB + 1.4, 26, 18); dots.push([x, 0.09, z, 0.13, K.pick([0xffffff, 0xfff27a, 0xffc2dc, 0xffffff]), 5]); }
  const CB = [0xf6ead9, 0xf0e0cb, 0xfaf1e4, 0xead8c2], PAVE = 0xdcc6aa;
  K.flat.push(rectXZ(-PX, PX, Z0, PZ, 0.02, PAVE), rectXZ(-PX, PX, -PZ, -Z0, 0.02, PAVE), rectXZ(X0, PX, -Z0, Z0, 0.02, PAVE), rectXZ(-PX, -X0, -Z0, Z0, 0.02, PAVE));
  for (let z = -PZ + 0.5, row = 0; z < PZ; z += 0.95, row++) for (let x = -PX + 0.5 + (row % 2) * 0.47; x < PX; x += 0.95) {
    if (Math.abs(x) < X0 + 0.1 && Math.abs(z) < Z0 + 0.1) continue;
    dots.push([x, 0.03, z, K.rnd(0.36, 0.42), K.pick(CB), 5, 1, 1, K.R()]);
  }
  for (let t = -PX; t <= PX + 0.01; t += 1.0) dots.push([t, 0.04, PZ, 0.42, 0xc9b192, 5], [t, 0.04, -PZ, 0.42, 0xc9b192, 5]);
  for (let t = -PZ; t <= PZ + 0.01; t += 1.0) dots.push([PX, 0.04, t, 0.42, 0xc9b192, 5], [-PX, 0.04, t, 0.42, 0xc9b192, 5]);
  const path = (ctrl, w) => {
    const sp = new THREE.CatmullRomCurve3(ctrl.map(([x, z]) => new THREE.Vector3(x, 0, z))).getSpacedPoints(40).map((v) => [v.x, v.z]);
    K.flat.push(...groundRibbon(sp, w, PAVE, 0.022, K.R, 0.05));
    for (const [x, z] of sp) dots.push([x + K.rnd(-0.32, 0.32) * w, 0.032, z + K.rnd(-0.32, 0.32) * w, 0.34, K.pick(CB), 6]);
  };
  path([[wheelX * 0.6, -PZ + 0.3], [wheelX * 0.9, wheelZ + 5.8], [wheelX, wheelZ + 3.8]], 3.0);
  path([[carX * 0.55, -PZ + 0.3], [carX * 0.8, carZ + Rc + 1.8], [carX, carZ + Rc + 0.6]], 3.0);
  path([[0, PZ - 0.3], [hw * 0.08, hd + 14], [-hw * 0.1, hd + 30]], 3.4);
  for (let i = 0; i < 70; i++) dots.push([K.rnd(-hw, hw), 0.1, K.rnd(PZ + 0.4, hd + 16), 0.11, K.pick(PENNANT), 4, 1.8, 0.7, K.R() * PI]);

  // Near side (low): a hook-a-duck pool, a flower planter, a bench, hay bales, balloons.
  const nz = hd + PB + 3.4 * ns;
  K.add(duckPool(K, 2.1 * ns), -hw * 0.42, 0, nz + 0.4);
  K.blob(-hw * 0.42, 0.02, nz + 0.4, 2.7 * ns, 2.7 * ns, 0.3);
  K.add(planter(K, 3.6), hw * 0.42, 0, nz - 0.6, 0.08, ns);
  K.blob(hw * 0.42, 0.02, nz - 0.6, 2.2 * ns, 0.9 * ns, 0.3, 0.08);
  K.add(parkBench(0xff9fb8), hw * 0.5, 0, nz + 3.6 * ns, -0.1, ns);
  K.blob(hw * 0.5, 0.02, nz + 3.6 * ns, 2.0 * ns, 0.9 * ns, 0.3, -0.1);
  for (let i = 0; i < 14; i++) dots.push([hw * 0.5 + K.rnd(-1.6, 1.6), 0.09, nz + 3.6 * ns + K.rnd(0.6, 1.6), 0.12, K.pick([0xfff6e0, 0xffe9a8]), 5]);
  for (const [x, z, ry] of [[-(hw + 3.8), hd + 3.4, 0.3], [-(hw + 5.9), hd + 4.8, 1.4]]) { K.add(hayBale(), x, 0, z, ry); K.blob(x, 0.02, z, 1.9, 1.5, 0.38, ry); }
  for (const [fx, fzz] of [[-hw * 0.78, hd + 9.5], [-hw * 0.3, hd + 11.5], [hw * 0.3, hd + 12.5], [hw * 0.85, hd + 10.5], [-hw * 0.62, hd + 15], [hw * 0.62, hd + 16]]) {
    K.add(flowerClump(K, 0.9, K.pick(FLOWER)), fx, 0, fzz, K.R() * TAU);
    K.blob(fx, 0.02, fzz, 1.0, 0.9, 0.22);
  }
  const bsx = hw + 3.3, bsz = hd + 3.2;
  K.add([cyl(0.5, 0.6, 0.35, 0xff9fb8, 0, 0, 0, 12), ...[0, 1, 2, 3, 4].map((i) => cyl(0.1, 0.1, 0.32, i % 2 ? 0xff9fb8 : WHITE, 0, 0.35 + i * 0.32, 0, 8)), ballC(0.18, GOLD, 0, 2.0, 0, 1)], bsx, 0, bsz);
  K.blob(bsx, 0.02, bsz, 0.9, 0.9, 0.35);
  for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + K.R(), d = K.rnd(0.5, 1.2); tied.push([bsx, 1.95, bsz, bsx + Math.cos(a) * d, K.rnd(4.4, 5.7), bsz + Math.sin(a) * d * 0.7, BALLOON[i % BALLOON.length]]); }

  // String lights down both sides and pennant bunting across the far side.
  const LX = PX + 0.6, PH = 6.2, fzL = -(PZ + 0.6), nl = Math.max(3, Math.round((hd + 1 - fzL) / 8) + 1);
  for (const s of [-1, 1]) {
    let prev = null;
    for (let i = 0; i < nl; i++) {
      const z = fzL + (hd + 1 - fzL) * (i / (nl - 1)), x = s * LX;
      K.add(lightPost(PH), x, 0, z);
      K.blob(x, 0.02, z, 0.7, 0.7, 0.35);
      const top = [x, PH - 0.3, z];
      if (prev) lightString(K, prev, top, 1.1, 0.95, false);
      prev = top;
    }
  }
  const nf = Math.max(3, Math.round((2 * LX) / 8) + 1);
  for (let i = 0, prev = null; i < nf; i++) {
    const x = -LX + 2 * LX * (i / (nf - 1));
    if (i > 0 && i < nf - 1) { K.add(lightPost(PH), x, 0, fzL); K.blob(x, 0.02, fzL, 0.7, 0.7, 0.35); }
    const top = [x, PH - 0.3, fzL];
    if (prev) lightString(K, prev, top, 1.2, 0.9, true);
    prev = top;
  }

  // Game stalls down the sides (facing the board), a popcorn cart, the ticket booth.
  const SX = PX + 4.4, STC = [0xff9fb8, 0x8fdcc4, 0xffd36e];
  [[-1, hd * 0.42], [-1, -hd * 0.3], [1, -hd * 0.22]].forEach(([s, z], i) => {
    const ry = -s * PI / 2;
    K.add(fairStall(K, STC[i], i % 2), s * SX, 0, z, ry);
    K.blob(s * SX, 0.02, z, 2.6, 3.6, 0.38);
    K.claim(s * SX, z, 4);
    for (const lx of [-2.95, 2.95]) {
      const [ox, oz] = turn(lx, 2.3, ry), [bx, bz] = turn(lx * 1.08, 2.7, ry);
      tied.push([s * SX + ox, 4.0, z + oz, s * SX + bx, K.rnd(5.6, 6.4), z + bz, K.pick(BALLOON)]);
    }
  });
  K.add(popcornCart(K), SX - 0.6, 0, hd * 0.45, -PI / 2);
  K.blob(SX - 0.6, 0.02, hd * 0.45, 1.6, 2.2, 0.38);
  K.claim(SX - 0.6, hd * 0.45, 2.8);
  const tbx = -(hw + 4.8), tbz = -(PZ + 3.4), tb = ticketBooth(K);
  K.add(tb, tbx, 0, tbz);
  K.blob(tbx, 0.02, tbz, 2.2, 2.0, 0.4);
  K.halos.push([tbx, 2.35, tbz + 1.9, 1.3, 1.3, 0.45, 0xffc27a, true]);
  K.claim(tbx, tbz, 2.6);

  // The Ferris wheel (gondolas stay level as it turns) and the carousel (horses bob).
  const fw = ferrisWheel(K, Rw, hubY);
  K.add(fw.frame, wheelX, 0, wheelZ);
  K.blob(wheelX, 0.02, wheelZ, Rw * 0.78, 3.6, 0.42);
  const wm = new THREE.Mesh(merge(fw.rotor), fw.mat);
  wm.name = 'ferris'; wm.position.set(wheelX, hubY, wheelZ); wm.frustumCulled = false;
  K.meshes.push(wm);
  K.tick.push((t) => { const a = t * 0.16; wm.rotation.z = a; fw.ang.value = a; });
  const cr = carousel(K, Rc);
  K.add(cr.base, carX, 0, carZ);
  K.blob(carX, 0.02, carZ, Rc + 1.3, Rc + 1.1, 0.42);
  const cm = new THREE.Mesh(merge(cr.rotor), cr.mat);
  cm.name = 'carousel'; cm.position.set(carX, 0, carZ); cm.frustumCulled = false;
  K.meshes.push(cm);
  K.tick.push((t) => { cm.rotation.y = t * 0.32; cr.time.value = t; });
  for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; K.halos.push([carX + Math.cos(a) * (Rc + 0.9), 5.0, carZ + Math.sin(a) * (Rc + 0.9) + 0.3, 1.3, 1.0, 0.32, 0xffc27a, true]); }

  // Beyond: a striped big top, a white fence, trees, rolling hills, warm clouds.
  const btx = Math.max(hw * 0.12, 1.5) + 1.5, btz = -(hd + 21);
  K.add(bigTop(K, 5.6), btx, 0, btz);
  K.blob(btx, 0.02, btz, 6.6, 6.2, 0.4);
  K.claim(btx, btz, 6.4); K.claim(wheelX, wheelZ - 4, 6);
  G.push(...picketFence(-(hw + 20), FZ, hw + 20, FZ, 2.0, 1.0));
  for (let x = -(hw + 20); x < hw + 20; x += 2.6) K.blob(x, 0.02, FZ + 0.3, 1.2, 0.5, 0.22);
  const LEAF = [0x7fcf6a, 0x8fd87a, 0x72c460, 0xffc2d6];
  const tree = (x, z, h, crr, leaf, far) => {
    if (!K.free(x, z, crr + 0.4)) return;
    K.claim(x, z, crr + 0.4);
    K.add(far ? farTree(K, h, crr, leaf) : roundTree(K, h, crr, leaf), x, 0, z, K.R() * TAU);
    K.blob(x + 0.4, 0.02, z + 0.4, crr * 1.1, crr * 0.95, 0.34);
  };
  for (const s of [-1, 1]) for (let i = 0; i < 5; i++) tree(s * (hw + K.rnd(11, 24)), K.rnd(-(hd + 8), hd + 12), K.rnd(5, 7.5), K.rnd(1.8, 2.6), K.pick(LEAF), i > 0);
  for (let x = -(hw + 30); x <= hw + 30; x += K.rnd(6.5, 9.5)) tree(x, FZ - K.rnd(2.5, 9), K.rnd(6, 8.5), K.rnd(2.2, 2.9), K.pick(LEAF), true);
  for (let i = 0; i < 6; i++) {
    const rx = K.rnd(12, 22), ry = K.rnd(3.5, 7), h = dome(rx, ry, K.rnd(8, 14), K.pick([0x8cc96a, 0x9fd47c, 0x80bf60]), K.rnd(-(hw + 60), hw + 60), -0.3, FZ - K.rnd(14, 40), 16, 5);
    shadeY(h, 0, ry, 0.82, 1.08);
    K.matte.push(h);
  }
  for (const s of [-1, 1]) for (let i = 0; i < 2; i++) {
    const h = dome(K.rnd(9, 15), K.rnd(3, 6), K.rnd(9, 14), K.pick([0x8cc96a, 0x9fd47c]), s * (hw + K.rnd(30, 42)), -0.3, K.rnd(-hd, hd + 10), 16, 5);
    shadeY(h, 0, 6, 0.85, 1.06);
    K.matte.push(h);
  }
  for (let i = 0; i < 4; i++) free.push([K.rnd(-(hw + 8), hw + 8), K.rnd(1.5, 3), -(hd + K.rnd(6, 22)), BALLOON[i % BALLOON.length]]);
  K.flat.push(discBatch(dots));
  balloonMesh(K, tied, free);
  const span = hw + 70, cl = [];
  for (let i = 0; i < 3; i++) cl.push([K.rnd(-span, span), K.rnd(8, 11), FZ + K.rnd(-14, 8), K.rnd(1.8, 2.6)]);
  cloudLayer(K, cl, span, [0xffe6d8, 0xffdce8, 0xfff0e2]);
}
function lightPost(h) {
  const p = [cyl(0.32, 0.4, 0.35, 0xa898c0, 0, 0, 0, 8)];
  for (let i = 0; i < 5; i++) p.push(custom(new THREE.CylinderGeometry(0.12, 0.12, (h - 0.35) / 5, 6, 1, true).translate(0, 0.35 + ((i + 0.5) * (h - 0.35)) / 5, 0), i % 2 ? 0xff9fb8 : WHITE));
  p.push(ballC(0.22, GOLD, 0, h + 0.15, 0, 0));
  return p;
}
// A sagging wire with glowing bulbs (and pennants every other step when asked).
function lightString(K, a, b, sag, step, pennants) {
  const n = Math.max(2, Math.round(Math.hypot(b[0] - a[0], b[2] - a[2]) / step));
  const at = (t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - Math.sin(t * PI) * sag, a[2] + (b[2] - a[2]) * t];
  let prev = a;
  for (let i = 1; i <= 8; i++) { const p = at(i / 8); K.glossy.push(rod(prev, p, 0.035, 0.035, 0x7a6a80, 3)); prev = p; }
  for (let i = 1; i < n; i++) {
    const [x, y, z] = at(i / n);
    if (pennants && i % 2) { K.glossy.push(tris([[x - 0.42, y, z], [x + 0.42, y, z], [x, y - 0.95, z + 0.12]], PENNANT[(i >> 1) % PENNANT.length], new THREE.Vector3(0, 0.3, 1))); continue; }
    K.lit.push(custom(new THREE.OctahedronGeometry(0.17).scale(1, 1.25, 1).translate(x, y - 0.16, z), BULB[i % BULB.length]));
    K.halos.push([x, y - 0.14, z + 0.1, 0.6, 0.6, 0.4, 0xffc27a, true]);
  }
}
function fairStall(K, stripe, kind) {
  const W = 6, D = 3.6, H = 3.2, s = [], n = 8, sw = (W + 0.6) / n;
  s.push(box(W, 1.5, 0.9, stripe, 0, 0, D / 2 - 0.45), box(W + 0.3, 0.2, 1.2, WHITE, 0, 1.5, D / 2 - 0.45));
  for (let i = 0; i < 6; i++) s.push(box(0.4, 1.5, 0.04, WHITE, -W / 2 + 0.5 + (i * (W - 1)) / 5, 0, D / 2 + 0.01));
  s.push(box(W, H + 1.7, 0.3, 0xfff3ea, 0, 0, -D / 2 + 0.15));
  for (const sx of [-1, 1]) s.push(box(0.3, H + 0.8, 0.3, WHITE, sx * (W / 2 - 0.15), 0, D / 2 - 0.15), box(0.25, H + 1.7, D - 0.3, 0xfff3ea, sx * (W / 2 - 0.12), 0, 0));
  for (let i = 0; i < n; i++) {
    const x = -W / 2 - 0.3 + (i + 0.5) * sw, c = i % 2 ? WHITE : stripe;
    s.push(custom(new THREE.BoxGeometry(sw, 0.18, D + 1.0).rotateX(0.28).translate(x, H + 1.25, 0.2), c));
    s.push(custom(new THREE.CircleGeometry(sw / 2, 8, PI, PI).translate(x, H + 0.62, 2.45), i % 2 ? stripe : WHITE));
  }
  s.push(box(3.0, 1.0, 0.25, WHITE, 0, H + 1.9, -D / 2 + 0.2), shapeZ(starShape(0.38), stripe, 0, H + 2.4, -D / 2 + 0.34));
  if (kind === 0) {
    s.push(box(W - 0.6, 0.15, 0.8, WHITE, 0, 2.3, -D / 2 + 0.7));
    for (let i = 0; i < 4; i++) s.push(...put(plush(K.pick([0xffd6a8, 0xffc2dc, 0xc9e8ff, 0xe2d4ff])), -1.95 + i * 1.3, 2.45, -D / 2 + 0.7, 0, 0.8));
    for (let i = 0; i < 2; i++) s.push(...put(plush(K.pick([0xfff0b0, 0xc4f0dc, 0xffc2dc])), -1.2 + i * 2.4, 0.3, -D / 2 + 0.9, 0, 0.9));
  } else {
    for (let r = 0; r < 3; r++) for (let i = 0; i <= 2 - r; i++) s.push(cyl(0.2, 0.22, 0.55, WHITE, (i - (2 - r) / 2) * 0.48, 1.7 + r * 0.56, D / 2 - 0.45, 8), cyl(0.21, 0.21, 0.1, 0xff8fa8, (i - (2 - r) / 2) * 0.48, 1.9 + r * 0.56, D / 2 - 0.45, 8));
    for (let i = 0; i < 3; i++) s.push(ballC(0.22, K.pick(PENNANT), 1.6 + i * 0.5, 1.7, D / 2 - 0.4, 0));
    for (let i = 0; i < 4; i++) s.push(...put(plush(K.pick([0xffd6a8, 0xffc2dc, 0xc9e8ff])), -2.4 + i * 1.2, 2.4, -D / 2 + 0.45, 0, 0.6));
  }
  return s;
}
function plush(col) {
  return [egg(0.42, 0.42, 0.42, col, 0, 0.42, 0, 7, 4), egg(0.32, 0.32, 0.32, col, 0, 1.08, 0, 7, 4), ballC(0.12, col, -0.24, 1.36, 0, 0), ballC(0.12, col, 0.24, 1.36, 0, 0), ballC(0.11, 0xfff3ea, 0, 1.0, 0.28, 0)];
}
function popcornCart(K) {
  const RED = 0xff8f9f, p = [box(3.2, 1.5, 1.9, RED, 0, 0.9, 0)];
  for (let i = 0; i < 4; i++) p.push(box(0.34, 1.5, 0.04, WHITE, -1.2 + i * 0.8, 0.9, 0.96));
  for (const sx of [-1.05, 1.05]) for (const sz of [-1.03, 1.03]) p.push(cyl(0.72, 0.72, 0.16, WHITE, sx, 0.72, sz, 14, PI / 2), cyl(0.2, 0.2, 0.2, GOLD, sx, 0.72, sz, 8, PI / 2));
  p.push(box(3.0, 0.12, 1.7, WHITE, 0, 2.4, 0));
  for (const sx of [-1.4, 1.4]) for (const sz of [-0.75, 0.75]) p.push(box(0.1, 1.8, 0.1, GOLD, sx, 2.5, sz));
  p.push(box(3.1, 0.35, 1.8, RED, 0, 4.3, 0), box(3.12, 0.12, 1.82, WHITE, 0, 4.5, 0));
  for (let i = 0; i < 30; i++) { const x = K.rnd(-1.25, 1.25); p.push(custom(new THREE.OctahedronGeometry(0.24).rotateY(K.R() * 2).translate(x, 2.7 + K.R() * 0.8 * (1 - Math.abs(x) / 1.6), K.rnd(-0.62, 0.62)), K.pick([0xfff6e0, 0xfff0c0, 0xffe9a8]))); }
  p.push(rod([-1.6, 1.9, 0.5], [-2.4, 2.2, 0.5], 0.06, 0.06, GOLD, 5), rod([-1.6, 1.9, -0.5], [-2.4, 2.2, -0.5], 0.06, 0.06, GOLD, 5), rod([-2.4, 2.2, -0.6], [-2.4, 2.2, 0.6], 0.08, 0.08, WHITE, 6));
  const can = cone(2.0, 0.9, WHITE, 0, 4.62, 0, 12);
  paintTris(can, (x, y, z) => (slice(x, z, 12) % 2 ? RED : null));
  p.push(can, ballC(0.16, GOLD, 0, 5.55, 0, 1));
  return p;
}
function ticketBooth(K) {
  const W = 0xfff3ea, P = 0xff8fb0;
  const s = [rbox(3.2, 3.6, 3.0, W, 0, 0, 0, 0.25), box(3.3, 0.9, 3.1, P, 0, 0, 0), box(1.9, 0.14, 0.6, WHITE, 0, 1.45, 1.75), thinRing(0.86, 0.1, GOLD, 0, 2.35, 1.53, 0, 18)];
  const roof = cone(2.6, 2.4, WHITE, 0, 3.6, 0, 12);
  paintTris(roof, (x, y, z) => (slice(x, z, 12) % 2 ? P : null));
  s.push(roof, ballC(0.22, GOLD, 0, 6.05, 0, 1), rod([0, 6.1, 0], [0, 7.3, 0], 0.04, 0.04, INK, 4), tris([[0, 7.3, 0], [0, 6.75, 0], [0.95, 7.0, 0]], 0xffd36e, new THREE.Vector3(0, 0, 1)));
  s.push(box(1.5, 0.62, 0.06, 0xffe08a, 0, 0.5, 1.56), disc(0.12, P, -0.75, 0.81, 1.6, 8));
  return { s, l: [vdisc(0.8, 0xfff0c4, 0, 2.35, 1.51, 18)] };
}
function duckPool(K, r) {
  const ring = custom(new THREE.TorusGeometry(r, 0.36, 6, 32).rotateX(PI / 2).translate(0, 0.36, 0), WHITE);
  paintTris(ring, (x, y, z) => (slice(x, z, 8) % 2 ? 0xff9fb8 : null));
  shadeY(ring, 0, 0.72, 0.85, 1.05);
  const p = [disc(r - 0.1, 0x7fd0f0, 0, 0.32, 0, 28), ringXZ(r * 0.4, r * 0.46, 0xaee8fa, 0, 0.33, 0, 20), ring];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU + K.R() * 0.3, d = r * K.rnd(0.3, 0.58), c = i % 3 ? 0xffe066 : K.pick([0xff9fb8, 0x8fdcc4, WHITE]);
    p.push(...put([egg(0.8, 0.5, 0.55, c, 0, 0.32, 0, 8, 5), egg(0.36, 0.36, 0.36, c, 0.62, 0.8, 0, 7, 5), egg(0.26, 0.09, 0.15, 0xff9a2e, 0.98, 0.76, 0, 5, 3), egg(0.3, 0.2, 0.2, c, -0.72, 0.6, 0, 5, 3)], Math.cos(a) * d, 0.3, Math.sin(a) * d, K.R() * TAU, 0.42));
  }
  return p;
}
function planter(K, len) {
  const p = [box(len, 0.8, 1.2, 0xffd6e0, 0, 0, 0), box(len + 0.2, 0.15, 1.4, WHITE, 0, 0.8, 0), box(len - 0.3, 0.05, 0.95, 0x8a6a4a, 0, 0.9, 0)];
  for (let x = -len / 2 + 0.6; x < len / 2 - 0.4; x += 0.9) p.push(...put(flowerClump(K, 0.55, K.pick(FLOWER)), x, 0.88, 0));
  return p;
}
function parkBench(col) {
  const L = 0x7d6e8a, p = [];
  for (let i = 0; i < 3; i++) p.push(box(3.4, 0.12, 0.3, col, 0, 0.9, -0.36 + i * 0.36));
  for (let i = 0; i < 2; i++) p.push(box(3.4, 0.3, 0.1, col, 0, 1.25 + i * 0.42, -0.62));
  for (const sx of [-1.4, 1.4]) p.push(box(0.14, 0.9, 1.1, L, sx, 0, -0.05), box(0.12, 1.1, 0.12, L, sx, 0.9, -0.66));
  return p;
}
function bigTop(K, R) {
  const P = 0xff9fb8, wall = cyl(R, R, 3.0, WHITE, 0, 0, 0, 24);
  paintTris(wall, (x, y, z) => (slice(x, z, 24) % 2 ? P : null));
  shadeY(wall, 0, 3, 0.85, 1.02);
  const roof = lathe([[R + 0.5, 3.0], [R * 0.72, 4.3], [R * 0.3, 6.2], [0.3, 7.4], [0.01, 7.5]], WHITE, 24);
  paintTris(roof, (x, y, z) => (slice(x, z, 24) % 2 ? P : null));
  const p = [wall, roof, box(2.2, 2.4, 0.3, 0x8a5a6a, 0, 0, R - 0.05), ballC(0.3, GOLD, 0, 7.5, 0, 1), rod([0, 7.6, 0], [0, 9.2, 0], 0.05, 0.05, INK, 4),
    tris([[0, 9.2, 0], [0, 8.5, 0], [1.3, 8.85, 0]], 0xffd36e, new THREE.Vector3(0, 0, 1))];
  for (const s of [-1, 1]) p.push(tris([[s * 1.1, 2.4, R + 0.12], [s * 0.2, 2.4, R + 0.12], [s * 1.1, 0.2, R + 0.12]], P, new THREE.Vector3(0, 0, 1)));
  for (let i = 0; i < 24; i++) { const a = ((i + 0.5) / 24) * TAU; p.push(ballC(0.26, i % 2 ? P : 0xffd36e, Math.cos(a) * (R + 0.5), 2.9, Math.sin(a) * (R + 0.5), 0)); }
  return p;
}
function ferrisWheel(K, R, hubY) {
  const frame = [], rotor = [], gond = [], ST = 0xffffff, ST2 = 0xece6f6, RIM = 0xff8fb0;
  for (const sz of [-1, 1]) {
    for (const sx of [-1, 1]) frame.push(rod([sx * R * 0.55, 0.4, sz * 2.3], [0, hubY, sz * 1.45], 0.26, 0.2, ST, 8));
    frame.push(rod([-R * 0.36, hubY * 0.38, sz * 1.95], [R * 0.36, hubY * 0.38, sz * 1.95], 0.13, 0.13, ST2, 6));
  }
  frame.push(cyl(0.42, 0.42, 3.4, 0xffd36e, 0, hubY, 0, 12, PI / 2));
  frame.push(rbox(R * 1.4, 0.4, 5.6, 0xf3ecf8, 0, 0, 0, 0.15), rbox(3.2, 0.25, 2.2, 0xff9fb8, 0, 0, 3.6, 0.1));
  for (const z of [-0.95, 0.95]) {
    rotor.push(thinRing(R, 0.17, RIM, 0, 0, z, 0, 48, 3), thinRing(R * 0.5, 0.09, 0xffd36e, 0, 0, z, 0, 20, 3));
    for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; rotor.push(rod([0, 0, z], [Math.cos(a) * R, Math.sin(a) * R, z], 0.055, 0.055, ST, 4)); }
  }
  rotor.push(cyl(0.8, 0.8, 2.3, ST, 0, 0, 0, 14, PI / 2), cyl(1.05, 1.05, 0.25, 0xffd36e, 0, 0, 1.2, 16, PI / 2), cyl(1.05, 1.05, 0.25, 0xffd36e, 0, 0, -1.2, 16, PI / 2));
  for (let i = 0; i < 32; i++) { const a = ((i + 0.5) / 32) * TAU; rotor.push(custom(new THREE.OctahedronGeometry(0.17).translate(Math.cos(a) * R, Math.sin(a) * R, 1.16), i % 2 ? 0xfff6c4 : 0xffd6e2)); }
  const GC = [0xff9fb8, 0x8fdcc4, 0xffd36e, 0xb9a6f0, 0x8fc8ff], n = 10;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU, px = Math.cos(a) * R, py = Math.sin(a) * R, c = GC[i % GC.length];
    rotor.push(rod([px, py, -1.05], [px, py, 1.05], 0.07, 0.07, CHROME_D, 5));
    const g = [rod([0, 0, 0], [0, -0.7, 0], 0.07, 0.07, CHROME_D, 4), dome(0.95, 0.42, 0.85, c, 0, -0.84, 0, 10, 3),
      cyl(0.9, 0.72, 0.85, c, 0, -2.45, 0, 10), thinRing(0.9, 0.08, WHITE, 0, -1.6, 0, PI / 2, 10, 3)];
    for (const sx of [-0.7, 0.7]) g.push(rod([sx, -1.6, 0], [sx, -0.84, 0], 0.05, 0.05, WHITE, 4));
    if (i % 2) g.push(ballC(0.26, 0xffe0c4, -0.3, -1.25, 0.15, 0), ballC(0.24, 0xf6d0b0, 0.32, -1.3, 0.1, 0));
    for (const gg of put(g, px, py, 0, 0, [1, 1, 0.66])) { gg.userData.piv = [px, py]; gond.push(gg); }
  }
  for (const g of rotor) g.setAttribute('gp', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3), 3));
  for (const g of gond) {
    const k = g.attributes.position.count, a = new Float32Array(k * 3);
    for (let i = 0; i < k; i++) a.set([g.userData.piv[0], g.userData.piv[1], 1], i * 3);
    g.setAttribute('gp', new THREE.BufferAttribute(a, 3));
    rotor.push(g);
  }
  // Gondolas counter-rotate about their pins so they always hang level.
  const ang = { value: 0 };
  const mat = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 30, specular: 0x242424 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uAng = ang;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 gp;\nuniform float uAng;')
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
        float gC = cos(uAng * gp.z), gS = sin(uAng * gp.z);
        mat2 gR = mat2(gC, -gS, gS, gC);
        objectNormal.xy = gR * objectNormal.xy;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        transformed.xy = gp.xy + gR * (transformed.xy - gp.xy);`);
  };
  mat.customProgramCacheKey = () => 'backdrop-ferris';
  return { frame, rotor, mat, ang };
}
function carousel(K, R) {
  const base = [], rotor = [], horses = [], GD = 0xffd36e, P = 0xff9fb8;
  base.push(cyl(R + 0.35, R + 0.5, 0.7, 0xf3ecf8, 0, 0, 0, 28), torus(R + 0.42, 0.08, GD, 0, 0.7, 0, PI / 2, 28));
  for (let i = 0; i < 3; i++) base.push(box(2.4 - i * 0.2, 0.24, 0.6, WHITE, 0, i * 0.23, R + 1.15 - i * 0.3));
  const deck = cyl(R, R, 0.3, 0xffe8f0, 0, 0.7, 0, 32);
  paintTris(deck, (x, y, z) => (y > 0.99 && slice(x, z, 16) % 2 ? 0xfff8fb : null));
  const canopy = cone(R + 0.8, 2.6, WHITE, 0, 5.4, 0, 16);
  paintTris(canopy, (x, y, z) => (slice(x, z, 16) % 2 ? P : null));
  shadeY(canopy, 5.4, 8, 0.9, 1.05);
  rotor.push(deck, canopy, cyl(R + 0.82, R + 0.82, 0.55, GD, 0, 4.85, 0, 32), cyl(0.75, 0.75, 4.4, 0xfff0f5, 0, 1.0, 0, 16));
  for (const y of [1.5, 3.0, 4.5]) rotor.push(cyl(0.79, 0.79, 0.22, GD, 0, y, 0, 16));
  rotor.push(ballC(0.35, GD, 0, 8.05, 0, 1), rod([0, 8.3, 0], [0, 9.4, 0], 0.04, 0.04, INK, 4), tris([[0, 9.4, 0], [0, 8.9, 0], [0.9, 9.15, 0]], P, new THREE.Vector3(0, 0, 1)));
  for (let i = 0; i < 20; i++) {
    const a = ((i + 0.5) / 20) * TAU, cx = Math.cos(a), cz = Math.sin(a);
    rotor.push(ballC(0.22, i % 2 ? P : WHITE, cx * (R + 0.84), 4.78, cz * (R + 0.84), 0), custom(new THREE.OctahedronGeometry(0.13).translate(cx * (R + 0.86), 5.12, cz * (R + 0.86)), 0xfff6c4));
  }
  const HC = [[WHITE, 0xffd36e, P], [0xffd6e4, 0xb9a6f0, 0x8fdcc4], [0xd8f2e8, P, 0xffd36e], [0xfff0c4, 0x8fc8ff, P]];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU, x = Math.cos(a) * R * 0.7, z = Math.sin(a) * R * 0.7, [b, m, sd] = HC[i % HC.length];
    rotor.push(rod([x, 1.0, z], [x, 5.4, z], 0.07, 0.07, GD, 6));
    horses.push(...put(horse(b, m, sd), x, 2.5 + (i % 2) * 0.4, z, PI / 2 - a).map((g) => { g.userData.ph = i * 1.7; return g; }));
  }
  for (const g of rotor) g.setAttribute('hb', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  for (const g of horses) {
    const k = g.attributes.position.count, a = new Float32Array(k * 2);
    for (let i = 0; i < k; i++) { a[i * 2] = 1; a[i * 2 + 1] = g.userData.ph; }
    g.setAttribute('hb', new THREE.BufferAttribute(a, 2));
    rotor.push(g);
  }
  const time = { value: 0 };
  const mat = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 40, specular: 0x2a2a2a });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = time;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 hb;\nuniform float uTime;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed.y += hb.x * sin(uTime * 2.2 + hb.y) * 0.32;');
  };
  mat.customProgramCacheKey = () => 'backdrop-carousel';
  return { base, rotor, mat, time };
}
function horse(body, mane, saddle) {
  const p = [egg(1.0, 0.48, 0.42, body, 0, 0, 0, 9, 6), rod([0.65, 0.15, 0], [1.05, 0.9, 0], 0.27, 0.2, body, 6), egg(0.52, 0.26, 0.24, body, 1.32, 0.98, 0, 8, 5),
    cone(0.08, 0.26, body, 1.12, 1.14, 0.12, 4), cone(0.08, 0.26, body, 1.12, 1.14, -0.12, 4),
    egg(0.5, 0.13, 0.11, mane, 0.8, 0.8, 0, 6, 4), egg(0.38, 0.16, 0.12, mane, -1.15, 0.05, 0, 6, 4),
    box(0.62, 0.1, 0.72, saddle, 0, 0.42, 0)];
  for (const sz of [-0.2, 0.2]) {
    p.push(rod([0.6, -0.2, sz], [1.05, -0.75, sz], 0.1, 0.08, body, 5), rod([1.05, -0.75, sz], [0.85, -1.15, sz], 0.08, 0.07, body, 5));
    p.push(rod([-0.6, -0.2, sz], [-0.95, -1.05, sz], 0.1, 0.08, body, 5));
  }
  return p;
}
// Balloons: tied ones sway on their strings, free ones drift up and away (vertex shader).
function balloonMesh(K, tied, free) {
  const parts = [];
  const tag = (geos, cx, cy, cz, ph, mode, wf) => {
    for (const g of geos) {
      const n = g.attributes.position.count, p = g.attributes.position, bc = new Float32Array(n * 4), bm = new Float32Array(n * 2);
      for (let i = 0; i < n; i++) { bc.set([cx, cy, cz, ph], i * 4); bm[i * 2] = mode; bm[i * 2 + 1] = wf ? wf(p.getY(i)) : 1; }
      g.setAttribute('bc', new THREE.BufferAttribute(bc, 4));
      g.setAttribute('bm', new THREE.BufferAttribute(bm, 2));
      parts.push(g);
    }
  };
  const balloon = (col) => [egg(0.55, 0.68, 0.55, col, 0, 0, 0, 10, 7), custom(new THREE.ConeGeometry(0.12, 0.18, 6).translate(0, -0.74, 0), col), ballC(0.12, lighten(col, 0.7), -0.2, 0.3, 0.4, 0)];
  for (const [ax, ay, az, bx, by, bz, col] of tied) {
    const ph = K.R();
    tag(put(balloon(col), bx, by, bz), bx, by, bz, ph, 0, null);
    tag([rod([ax, ay, az], [bx, by - 0.82, bz], 0.022, 0.022, 0xf6f2ee, 3)], bx, by, bz, ph, 0, (y) => clamp01((y - ay) / (by - ay)));
  }
  for (const [x, y, z, col] of free) {
    const ph = K.R();
    tag([...put(balloon(col), x, y, z), rod([x, y - 0.82, z], [x + 0.1, y - 2.4, z], 0.022, 0.022, 0xf6f2ee, 3)], x, y, z, ph, 1, null);
  }
  const uTime = { value: 0 };
  const mat = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 70, specular: 0x555555 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 bc;\nattribute vec2 bm;\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        if (bm.x < 0.5) {
          transformed.x += sin(uTime * 1.1 + bc.w * 6.3) * 0.35 * bm.y;
          transformed.z += cos(uTime * 0.8 + bc.w * 4.1) * 0.2 * bm.y;
          transformed.y += sin(uTime * 1.6 + bc.w * 5.0) * 0.1 * bm.y;
        } else {
          float life = fract(uTime * 0.022 + bc.w);
          float sz = smoothstep(0.0, 0.05, life) * (1.0 - smoothstep(0.8, 1.0, life));
          transformed = bc.xyz + (transformed - bc.xyz) * sz + vec3(sin(uTime * 0.6 + bc.w * 9.0) * 1.2, life * 32.0, 0.0);
        }`);
  };
  mat.customProgramCacheKey = () => 'backdrop-balloons';
  const m = new THREE.Mesh(merge(parts), mat);
  m.name = 'balloons'; m.frustumCulled = false;
  K.meshes.push(m);
  K.tick.push((t) => { uTime.value = t; });
}

// ============================================================== MOON CAMP
function space(K) {
  const { hw, hd, ns } = K;
  K.shadow = 0x4a437c;
  const M = K.matte;
  const baseX = -(Math.max(hw * 0.42, 4.5) + 2), baseZ = -(hd + 9.5);
  const padX = Math.max(hw * 0.5, 5) + 3, padZ = -(hd + 8.5);
  const roverX = hw + 5.4, roverZ = hd * 0.28, dishX = -(hw + 5.2), dishZ = hd * 0.12;
  const bX = baseX - 6.6, bZ = baseZ + 3.6, gX = baseX + 6.0, gZ = baseZ + 2.4;
  K.claim(baseX, baseZ, 6); K.claim(bX, bZ, 3.6); K.claim(gX, gZ, 3.4); K.claim(padX + 1.2, padZ, 5.5);
  K.claim(roverX, roverZ, 3.4); K.claim(dishX, dishZ, 2.8); K.claim(hw + 6, -hd * 0.5, 4.2);

  // Moon dust: soft patches and specks, craters with a raised rim and a sunlit inner edge.
  const dots = [];
  for (let i = 0; i < 44; i++) {
    const [x, z] = K.around(2.6, 28, 16), r = K.rnd(1.6, 4.2);
    dots.push([x, 0.01 + (i % 4) * 0.01, z, r, K.pick([0xa6a0cf, 0x958fc1, 0xb0abd8, 0x9e98c9]), 18, 1, K.rnd(0.6, 1), K.R() * PI]);
  }
  for (let i = 0; i < 220; i++) { const [x, z] = K.around(1.8, 26, 16); dots.push([x, 0.06, z, K.rnd(0.06, 0.13), K.pick([0xd4d0ee, 0x8780b4, 0xc8c3e8]), 5]); }
  const crater = (x, z, r) => {
    if (!K.free(x, z, r + 0.4)) return;
    K.claim(x, z, r + 0.4);
    dots.push([x, 0.035, z, r * 0.92, 0x8a84b6, 18], [x + r * 0.1, 0.04, z + r * 0.1, r * 0.62, 0x837dae, 14]);
    M.push(custom(new THREE.TorusGeometry(r, r * 0.17, 4, 22).rotateX(PI / 2).scale(1, 0.55, 1).translate(x, 0, z), 0xbab5dc));
    K.flat.push(custom(new THREE.RingGeometry(r * 0.66, r * 0.86, 14, 1, PI * 0.45, PI * 0.6).rotateX(-PI / 2).translate(x, 0.045, z), 0xc6c1e6));
  };
  crater(hw * 0.12, hd + 5.4 * ns, 1.3);
  for (let i = 0; i < 16; i++) { const r = K.rnd(1.2, 3.0), [x, z] = K.around(r + 1.8, 24, 14); crater(x, z, r); }
  for (let i = 0; i < 34; i++) {
    const r = K.rnd(0.25, 0.9), [x, z] = K.around(r + 1.6, 24, 14);
    if (!K.free(x, z, r)) continue;
    const g = custom(new THREE.IcosahedronGeometry(r, 0).scale(1, K.rnd(0.5, 0.75), K.rnd(0.8, 1.1)).rotateY(K.R() * TAU).translate(x, r * 0.25, z), K.pick([0x8f89b9, 0xa29dcb, 0x8580b0]));
    M.push(jitter(g, K.R, 0.18));
    K.blob(x, 0.02, z, r * 1.3, r * 1.1, 0.3);
  }

  // Landing lights frame the board; rover tracks and boot prints cross the near side.
  const ML = [0x9ff0d8, 0xffb8dc, 0xfff0a0], mx = hw + 1.7, mz = hd + 1.7;
  let mi = 0;
  for (const [ax, az, bx, bz] of [[-mx, mz, mx, mz], [mx, mz, mx, -mz], [mx, -mz, -mx, -mz], [-mx, -mz, -mx, mz]]) {
    const n = Math.round(Math.hypot(bx - ax, bz - az) / 2.6);
    for (let i = 0; i < n; i++) {
      const t = i / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t, c = ML[mi++ % 3];
      K.add({ s: [cyl(0.26, 0.3, 0.1, 0xcfcae8, 0, 0, 0, 10)], l: [dome(0.2, 0.18, 0.2, c, 0, 0.1, 0, 10, 3)] }, x, 0, z);
      K.halos.push([x, 0.06, z, 0.75, 0.75, 0.26, c, false]);
    }
  }
  const trk = new THREE.CatmullRomCurve3([[roverX - 0.3, roverZ + 3.0], [hw + 3.4, hd + 3.4], [hw * 0.35, hd + 3.8 + 0.8 * ns], [-hw * 0.3, hd + 5.8 * ns], [-hw * 0.55, hd + 11], [-hw * 0.4, hd + 28]].map(([x, z]) => new THREE.Vector3(x, 0, z))).getSpacedPoints(70).map((v) => [v.x, v.z]);
  for (const off of [-0.85, 0.85]) {
    const tp = trk.map(([x, z], i) => { const [xn, zn] = trk[Math.min(trk.length - 1, i + 1)], [xp, zp] = trk[Math.max(0, i - 1)], n = norm2(xn - xp, zn - zp); return [x - n[1] * off, z + n[0] * off, Math.atan2(n[1], n[0])]; });
    K.flat.push(...groundRibbon(tp, 0.5, 0x8d87b9, 0.045));
    for (let i = 0; i < tp.length; i += 1) dots.push([tp[i][0], 0.05, tp[i][1], 0.2, 0x7f79ab, 4, 1.3, 0.45, -tp[i][2]]);
  }
  const bp = new THREE.CatmullRomCurve3([[baseX + 4.0, baseZ + 4.6], [-(hw + 2.6), -hd * 0.5], [-(hw + 2.4), hd * 0.4], [-(hw + 1.9), hd + 2.6], [-hw * 0.62, hd + 3.4 + 0.6 * ns]].map(([x, z]) => new THREE.Vector3(x, 0, z))).getSpacedPoints(80).map((v) => [v.x, v.z]);
  for (let i = 1; i < bp.length - 4; i += 1) {
    const [x, z] = bp[i], [xn, zn] = bp[i + 1], a = Math.atan2(zn - z, xn - x), sd = i % 2 ? 1 : -1;
    dots.push([x - Math.sin(a) * 0.26 * sd, 0.055, z + Math.cos(a) * 0.26 * sd, 0.17, 0x8780b4, 7, 1, 1.6, -a + PI / 2]);
  }

  // Near side (low): a patch of glowing crystals, a camp flag.
  const crys = (x, z, n, s) => {
    K.add({ l: crystals(K, n, s) }, x, 0, z, K.R() * TAU);
    K.halos.push([x, 0.06, z, 1.9 * s, 1.7 * s, 0.22, 0xd8b8ff, false], [x, 0.8 * s, z + 0.5, 1.3 * s, 1.0 * s, 0.18, 0xffc8f0, true]);
    K.blob(x, 0.02, z, 1.0 * s, 0.9 * s, 0.25);
  };
  crys(-hw * 0.66, hd + 3.4 + 0.6 * ns, 5, ns);
  crys(hw * 0.5, hd + 10.5, 4, 1.1);
  crys(-hw * 0.15, hd + 15, 3, 0.9);
  K.add(moonFlag(0x8fdcc4, 0xffe27a), hw * 0.62, 0, hd + 5.8, -0.3);
  K.blob(hw * 0.62, 0.02, hd + 5.8, 0.5, 0.5, 0.35);

  // Sides: the parked rover, a dish antenna, solar panels, more crystals, flags.
  const rv = rover(K);
  K.add(rv, roverX, 0, roverZ, PI / 2);
  K.blob(roverX, 0.02, roverZ, 1.9, 2.9, 0.42);
  for (const [lx, ly, lz] of rv.lights) { const [x, z] = turn(lx, lz, PI / 2); K.halos.push([roverX + x, ly, roverZ + z + 0.3, 0.8, 0.8, 0.5, 0xfff0b8, true]); }
  K.halos.push([roverX, 0.05, roverZ - 4.2, 1.5, 2.4, 0.22, 0xfff0b8, false]);
  const da = dishAntenna(K);
  K.add(da, dishX, 0, dishZ, 0.5);
  K.blob(dishX, 0.02, dishZ, 1.9, 1.9, 0.4);
  const [dbx, dbz] = turn(da.beacon[0], da.beacon[2], 0.5);
  K.halos.push([dishX + dbx, da.beacon[1], dishZ + dbz + 0.3, 0.9, 0.9, 0.55, 0xff9fc8, true]);
  K.add(solarPanels(3), hw + 6, 0, -hd * 0.5);
  K.blob(hw + 6, 0.02, -hd * 0.5, 1.8, 4.6, 0.3);
  crys(-(hw + 3.6), -hd * 0.62, 5, 1.1);
  crys(hw + 3.4, hd * 0.8, 4, 0.9);
  crys(-(hw + 6.5), hd * 0.62, 4, 1.0);
  K.add(moonFlag(0xffb8dc, WHITE), -(hw + 3.2), 0, hd + 3.0, 0.4);
  K.blob(-(hw + 3.2), 0.02, hd + 3.0, 0.5, 0.5, 0.35);

  // Far: the moon base (two domes, a glass garden dome, tubes), the rocket on its pad.
  const A = moonDome(K, 4.2, 0xf3f0fb, 2, true), B = moonDome(K, 2.8, 0xe8f2ff, 1, false);
  K.add(A, baseX, 0, baseZ); K.add(B, bX, 0, bZ);
  for (const [d, x, z] of [[A, baseX, baseZ], [B, bX, bZ]]) for (const h of d.halo) K.halos.push([h[0] + x, h[1], h[2] + z, ...h.slice(3)]);
  K.blob(baseX + 0.4, 0.02, baseZ + 0.4, 5.4, 5.0, 0.42); K.blob(bX + 0.3, 0.02, bZ + 0.3, 3.7, 3.4, 0.42);
  K.add(moonGarden(K, 2.6), gX, 0, gZ);
  K.blob(gX + 0.3, 0.02, gZ + 0.3, 3.4, 3.2, 0.4);
  const tube = (ax, az, ra, bx, bz, rb) => {
    const [dx, dz] = norm2(bx - ax, bz - az), a = [ax + dx * (ra - 0.5), 1.1, az + dz * (ra - 0.5)], b = [bx - dx * (rb - 0.5), 1.1, bz - dz * (rb - 0.5)];
    K.glossy.push(rod(a, b, 0.72, 0.72, 0xd9d5ee, 12));
    for (const t of [0.2, 0.5, 0.8]) { const c = [a[0] + (b[0] - a[0]) * t, 1.1, a[2] + (b[2] - a[2]) * t]; K.glossy.push(rod(c, [c[0] + dx * 0.3, 1.1, c[2] + dz * 0.3], 0.82, 0.82, 0xbcb6de, 12)); }
    K.blob((a[0] + b[0]) / 2, 0.02, (a[2] + b[2]) / 2, Math.abs(b[0] - a[0]) / 2 + 0.8, Math.abs(b[2] - a[2]) / 2 + 0.8, 0.3);
  };
  tube(baseX, baseZ, 4.2, bX, bZ, 2.8); tube(baseX, baseZ, 4.2, gX, gZ, 2.6);
  const rk = rocket(K);
  K.add(rk, padX, 0, padZ);
  K.halos.push([padX, 7.2, padZ + 2.0, 1.2, 1.2, 0.5, 0xffc87a, true]);
  K.add(gantry(K, 11.5), padX + 3.5, 0, padZ - 0.3);
  K.halos.push([padX + 3.5, 12.1, padZ + 0.3, 1.0, 1.0, 0.55, 0xff9fc8, true]);
  K.blob(padX + 0.8, 0.02, padZ + 0.4, 5.2, 4.4, 0.42);

  // Beyond: rounded moon hills, a ringed planet rising behind them, a crescent world,
  // a satellite drifting by, and twinkling stars (never over the board).
  const hill = (x, z, rx, ry, rz) => { const h = dome(rx, ry, rz, K.pick([0xa59fcf, 0x9690c3, 0xb0aad6]), x, -0.3, z, 18, 6); shadeY(h, 0, ry, 0.8, 1.06); M.push(jitter(h, K.R, 0.05)); };
  const PLX = hw * 0.12, PLZ = -(hd + 22), PLY = 3.4, PLR = 4.4;
  hill(PLX - 2, PLZ + 6.5, 10, 3.0, 4.5);
  for (let i = 0; i < 12; i++) { const rz = K.rnd(5, 9); hill(K.rnd(-(hw + 50), hw + 50), -(hd + 16) - rz - K.rnd(0, 16), K.rnd(8, 16), K.rnd(2.5, 5.5), rz); }
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) hill(s * (hw + K.rnd(26, 40)), K.rnd(-hd, hd + 10), K.rnd(9, 14), K.rnd(3, 6), K.rnd(9, 13));
  const planet = custom(new THREE.SphereGeometry(PLR, 28, 16), 0xffc9b0);
  const PB = [0xffc9b0, 0xffdcc4, 0xf6b4b8, 0xffe8d0, 0xf2c0d8, 0xffd2b8, 0xf6b4b8, 0xffe0c8, 0xffc9b0];
  // Bands follow the sphere's 16 latitude strips so their edges stay clean.
  paintTris(planet, (x, y) => PB[Math.floor((Math.min(15, Math.floor((Math.asin(Math.max(-1, Math.min(1, y / PLR))) / PI + 0.5) * 16)) * 9) / 16)]);
  recolor(planet, (x, y, z, c) => c.multiplyScalar(0.7 + 0.36 * clamp01((x * 0.7 + z * 0.5 + y * 0.3) / PLR * 0.5 + 0.55)));
  const ring = custom(new THREE.RingGeometry(PLR * 1.35, PLR * 2.0, 48, 3).rotateX(-PI / 2), 0xfff0e0);
  paintTris(ring, (x, y, z) => { const d = Math.hypot(x, z) / PLR; return d < 1.55 ? 0xfff0dc : d < 1.75 ? 0xe8d4f6 : 0xffd6e4; });
  K.add({ m: put([planet, ...twoSided([ring])], 0, 0, 0, 0.4, 1, 0.32, 0.18) }, PLX, PLY, PLZ);
  const ex = -(hw + 4), ey = 6.2, ez = -(hd + 15), ER = 2.0;
  const earth = custom(new THREE.SphereGeometry(ER, 20, 12), 0x7fc8f0);
  paintTris(earth, (x, y, z) => (Math.sin(x * 2.1 + 1) * Math.sin(y * 2.4) * Math.sin(z * 1.7 + 0.5) > 0.12 ? 0x8fdc9a : null));
  const night = new THREE.Color(0x4a4a8a);
  recolor(earth, (x, y, z, c) => c.lerp(night, 1 - smooth(-0.05, 0.7, (x * 0.85 + y * 0.35) / ER)));
  K.add({ m: [earth] }, ex, ey, ez);
  K.halos.push([ex, ey, ez + 2.2, 3.2, 3.2, 0.22, 0x8fd0ff, true]);
  const sat = new THREE.Mesh(merge(satellite()), new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 60, specular: 0x444444 }));
  const stx = -hw * 0.18, sty = 8.4, stz = -(hd + 12.5);
  sat.name = 'satellite'; sat.position.set(stx, sty, stz); sat.rotation.z = 0.35;
  K.meshes.push(sat);
  K.tick.push((t) => { sat.rotation.y = t * 0.35; sat.position.set(stx + Math.sin(t * 0.12) * 3.0, sty + Math.sin(t * 0.7) * 0.25, stz + Math.cos(t * 0.12) * 1.2); });
  K.flat.push(discBatch(dots));
  starfield(K, hw, hd, 320);
}
function crystals(K, n, s) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const h = K.rnd(0.9, 1.8) * s, a = K.R() * TAU, d = i ? K.rnd(0.35, 0.75) * s : 0, col = K.pick([0xffb3e0, 0xa8f0e0, 0xd2b8ff, 0xfff0a8]);
    const g = custom(new THREE.OctahedronGeometry(0.4 * s, 0).scale(1, h / (0.8 * s), 1).translate(0, h * 0.5, 0), col);
    recolor(g, (x, y, z, c) => c.multiplyScalar(0.72 + 0.28 * clamp01(y / h)).lerp(new THREE.Color(0xffffff), clamp01(y / h - 0.6) * 0.6));
    out.push(...put([g], Math.cos(a) * d, -0.05, Math.sin(a) * d, K.R() * TAU, 1, K.rnd(-0.3, 0.3), K.rnd(-0.3, 0.3)));
  }
  return out;
}
function moonFlag(col, star) {
  return [cyl(0.07, 0.07, 3.2, CHROME, 0, 0, 0, 6), ballC(0.12, GOLD, 0, 3.3, 0, 0), ...twoSided([panel(1.7, 1.05, col, 0.87, 2.05, 0)]), shapeZ(starShape(0.32), star, 0.87, 2.58, 0.012)];
}
function moonDome(K, r, col, nWin, mast) {
  const s = [cyl(r + 0.3, r + 0.45, 0.55, 0xbcb6de, 0, 0, 0, 24)], l = [], halo = [], line = darken(col, 0.86);
  const d = dome(r, r * 0.9, r, col, 0, 0.5, 0, 24, 8);
  shadeY(d, 0.5, r, 0.84, 1.05);
  s.push(d);
  for (const lat of [0.42, 0.9]) s.push(torus(r * Math.cos(lat) + 0.02, 0.07, line, 0, 0.5 + r * 0.9 * Math.sin(lat), 0, PI / 2, 24));
  for (let k = 0; k < 4; k++) s.push(custom(new THREE.TorusGeometry(1, 0.06 / r, 3, 20, PI).scale(r + 0.02, r * 0.9 + 0.02, r + 0.02).rotateY(k * PI / 4).translate(0, 0.5, 0), line));
  for (let i = 0; i < nWin; i++) {
    const a = -0.25 + (i - (nWin - 1) / 2) * 0.62, lat = 0.38, cl = Math.cos(lat);
    const x = Math.sin(a) * r * cl * 1.01, y = 0.5 + r * 0.9 * Math.sin(lat), z = Math.cos(a) * r * cl * 1.01;
    l.push(...put([vdisc(0.55, 0xffe6a8, 0, 0, 0, 16)], x, y, z, a, 1, -lat));
    s.push(...put([torus(0.6, 0.11, 0xd7d2ee, 0, 0, 0.02, 0, 16)], x, y, z, a, 1, -lat));
    halo.push([x, y, z + 0.4, 1.3, 1.1, 0.5, 0xffc87a, true]);
  }
  const da = 1.1, door = [rbox(1.8, 2.3, 1.8, col, 0, 0.3, 0, 0.3), box(1.1, 1.75, 0.06, 0xff9fb8, 0, 0.45, 0.91), ballC(0.08, GOLD, 0.35, 1.3, 0.96, 0)];
  const dl = [vdisc(0.22, 0xffe6a8, 0, 1.75, 0.95, 12)];
  s.push(...put(door, Math.sin(da) * (r - 0.2), 0, Math.cos(da) * (r - 0.2), da));
  l.push(...put(dl, Math.sin(da) * (r - 0.2), 0, Math.cos(da) * (r - 0.2), da));
  if (mast) {
    s.push(rod([0, 0.5 + r * 0.9, 0], [0, 0.5 + r * 0.9 + 3.0, 0], 0.07, 0.05, CHROME_D, 5), rod([-0.6, 0.5 + r * 0.9 + 2.2, 0], [0.6, 0.5 + r * 0.9 + 2.2, 0], 0.04, 0.04, CHROME_D, 4));
    l.push(ballC(0.18, 0xff9fc8, 0, 0.5 + r * 0.9 + 3.15, 0, 1));
    halo.push([0, 0.5 + r * 0.9 + 3.15, 0.3, 0.9, 0.9, 0.55, 0xff9fc8, true]);
  }
  return { s, l, halo };
}
function moonGarden(K, r) {
  const s = [cyl(r + 0.2, r + 0.35, 0.5, 0xbcb6de, 0, 0, 0, 22), disc(r, 0x9a7a6a, 0, 0.52, 0, 22)];
  for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + K.R(), d = r * K.rnd(0.35, 0.6); s.push(...put(bush(K, K.rnd(0.42, 0.62), K.pick([0x7fcf8a, 0x8fd87a, 0x6cc46b])), Math.cos(a) * d, 0.5, Math.sin(a) * d)); }
  s.push(...put(bush(K, 0.85, 0x7fcf8a), 0, 0.5, 0));
  for (let i = 0; i < 7; i++) { const a = K.R() * TAU, d = r * K.rnd(0.1, 0.6); s.push(disc(0.16, K.pick([0xff9fc8, 0xffe27a, WHITE]), Math.cos(a) * d, 1.7 + K.rnd(-0.3, 0.2), Math.sin(a) * d, 7)); }
  for (let k = 0; k < 3; k++) s.push(custom(new THREE.TorusGeometry(1, 0.05 / r, 3, 18, PI).scale(r + 0.02, r * 0.92 + 0.02, r + 0.02).rotateY(k * PI / 3).translate(0, 0.5, 0), WHITE));
  return { s, g: [dome(r, r * 0.92, r, 0xe8f6ff, 0, 0.5, 0, 22, 8)] };
}
function rocket(K) {
  const s = [], l = [];
  const pad = cyl(3.4, 3.7, 0.7, 0xcac5e6, 0, 0, 0, 24);
  paintTris(pad, (x, y, z) => (y > 0.69 && slice(x, z, 12) % 2 ? 0xffe27a : null));
  s.push(pad, torus(3.45, 0.1, 0xfff6ea, 0, 0.7, 0, PI / 2, 24));
  const body = lathe([[0.01, 0], [1.2, 0.05], [1.45, 0.7], [1.55, 2.5], [1.55, 6.6], [1.38, 8.2], [1.0, 9.6], [0.5, 10.6], [0.01, 11.1]], 0xfff6ea, 22, 0, 1.3, 0);
  paintTris(body, (x, y) => (y > 9.9 ? 0xff9f9f : y > 5.2 && y < 5.9 ? 0x8fdcc4 : y > 2.0 && y < 2.4 ? 0xff9f9f : null));
  shadeY(body, 1.3, 12.4, 0.86, 1.05);
  s.push(body, lathe([[1.0, 0], [0.75, 0.4], [0.6, 0.6]], CHROME_D, 14, 0, 0.7, 0), ballC(0.14, GOLD, 0, 12.45, 0, 1));
  const fin = new THREE.Shape(); fin.moveTo(1.35, 1.5); fin.lineTo(2.9, 0.7); fin.lineTo(2.9, 1.6); fin.lineTo(1.5, 4.2); fin.lineTo(1.35, 1.5);
  for (let i = 0; i < 4; i++) s.push(custom(new THREE.ExtrudeGeometry(fin, { depth: 0.32, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 1 }).translate(0, 0, -0.16).rotateY(i * PI / 2 + PI / 4), 0xff9f9f));
  s.push(torus(0.62, 0.13, CHROME, 0, 7.2, 1.5, 0, 18), shapeZ(starShape(0.36), 0xffd36e, 0, 4.0, 1.57));
  l.push(vdisc(0.56, 0xfff0b8, 0, 7.2, 1.52, 18));
  return { s, l };
}
function gantry(K, H) {
  const C = 0xffb3c4, W = 0xfff6ea, s = [];
  for (const sx of [-0.9, 0.9]) for (const sz of [-0.9, 0.9]) s.push(box(0.22, H, 0.22, C, sx, 0, sz));
  for (let y = 1.5; y < H - 0.5; y += 1.8) {
    s.push(box(2.0, 0.16, 0.16, W, 0, y, 0.9), box(2.0, 0.16, 0.16, W, 0, y, -0.9), box(0.16, 0.16, 2.0, W, 0.9, y, 0), box(0.16, 0.16, 2.0, W, -0.9, y, 0));
    s.push(rod([-0.9, y, 0.95], [0.9, Math.min(H, y + 1.8), 0.95], 0.06, 0.06, W, 4));
  }
  s.push(box(2.4, 0.2, 2.4, C, 0, H, 0), box(1.1, 0.3, 0.5, W, -1.45, H * 0.62, 0), rod([0, H + 0.2, 0], [0, H + 0.6, 0], 0.05, 0.05, CHROME_D, 4));
  return { s, l: [ballC(0.18, 0xff9fc8, 0, H + 0.6, 0, 1)] };
}
function rover(K) {
  const CR = 0xfff6ea, B = 0x9fdcc6, WH = 0x7d77a8;
  const s = [rbox(4.4, 0.7, 2.3, CR, 0, 1.0, 0, 0.3), rbox(1.9, 1.0, 1.9, B, 0.9, 1.6, 0, 0.35), box(0.06, 0.7, 1.5, 0x9fd0f4, 1.86, 1.8, 0),
    rbox(0.9, 1.0, 1.4, 0xff9fb8, -0.85, 1.65, 0, 0.25), box(0.6, 0.6, 1.8, 0xffd36e, -1.9, 1.65, 0)];
  for (const x of [-1.5, 0, 1.5]) for (const z of [-1.35, 1.35]) s.push(cyl(0.6, 0.6, 0.45, WH, x, 0.6, z, 14, PI / 2), cyl(0.26, 0.26, 0.5, CHROME, x, 0.6, z, 8, PI / 2));
  s.push(rod([-1.7, 2.2, 0.7], [-2.0, 4.2, 0.9], 0.05, 0.04, CHROME_D, 4), ballC(0.2, 0xffd36e, -2.0, 4.2, 0.9, 1));
  s.push(...put(twoSided([lathe([[0.05, 0], [0.4, 0.1], [0.65, 0.3]], WHITE, 12)]), -1.5, 2.45, -0.6, 0, 1, 0.6), rod([-1.5, 2.25, -0.6], [-1.5, 2.5, -0.6], 0.05, 0.05, CHROME_D, 4));
  const lights = [[2.25, 1.35, 0.7], [2.25, 1.35, -0.7]];
  return { s, l: lights.map(([x, y, z]) => ballC(0.2, 0xfff6c8, x, y, z, 1)), lights };
}
function dishAntenna(K) {
  const W = 0xfff6ea, s = [];
  for (let i = 0; i < 3; i++) { const a = (i / 3) * TAU; s.push(rod([0, 2.2, 0], [Math.cos(a) * 1.5, 0, Math.sin(a) * 1.5], 0.1, 0.08, CHROME_D, 5)); }
  s.push(cyl(0.3, 0.32, 0.9, W, 0, 1.9, 0, 10));
  const tilt = 0.75, dish = twoSided([lathe([[0.05, 0], [0.9, 0.1], [1.7, 0.42], [2.35, 0.92], [2.45, 1.02]], 0xe2ddf2, 22)]);
  recolor(dish, (x, y, z, c) => c.multiplyScalar(0.82 + 0.18 * clamp01(Math.hypot(x, z) / 2.4)));
  const ribs = [0.9, 1.7].map((r, i) => thinRing(r, 0.05, 0xb9b2dc, 0, [0.1, 0.42][i] + 0.04, 0, PI / 2, 20, 3));
  for (let k = 0; k < 3; k++) { const a = (k / 3) * TAU; ribs.push(rod([Math.cos(a) * 2.3, 0.95, Math.sin(a) * 2.3], [0, 1.7, 0], 0.04, 0.04, CHROME_D, 3)); }
  s.push(...put([...dish, ...ribs, rod([0, 0, 0], [0, 1.7, 0], 0.06, 0.06, CHROME_D, 4), torus(2.45, 0.08, 0xffb3c4, 0, 1.02, 0, PI / 2, 24)], 0, 2.7, 0, 0, 0.85, tilt));
  const by = 2.7 + 1.82 * 0.85 * Math.cos(tilt), bz = 1.82 * 0.85 * Math.sin(tilt);
  return { s, l: [ballC(0.2, 0xff9fc8, 0, by, bz, 1)], beacon: [0, by, bz] };
}
function solarPanels(n) {
  const p = [];
  for (let i = 0; i < n; i++) {
    const z = (i - (n - 1) / 2) * 3.0, pan = [box(2.4, 0.08, 2.6, 0x7f9fe8, 0, 0, 0)];
    p.push(rod([0, 0, z], [0, 1.6, z], 0.1, 0.1, CHROME_D, 6));
    for (let k = 1; k < 4; k++) pan.push(box(0.04, 0.02, 2.6, 0xd8e4ff, -1.2 + k * 0.6, 0.08, 0), box(2.4, 0.02, 0.04, 0xd8e4ff, 0, 0.08, -1.3 + k * 0.65));
    p.push(...put(pan, 0, 1.7, z, 0, 1, 0, 0.5));
  }
  return p;
}
function satellite() {
  const p = [rbox(1.3, 1.3, 1.3, 0xffd98a, 0, -0.65, 0, 0.2), cyl(0.5, 0.5, 0.25, 0xfff6ea, 0, 0.65, 0, 12)];
  for (const s of [-1, 1]) {
    p.push(rod([s * 0.65, 0, 0], [s * 1.3, 0, 0], 0.07, 0.07, CHROME, 4));
    const pan = [box(2.6, 0.08, 1.3, 0x86a8f0, 0, -0.04, 0), box(2.6, 0.02, 0.04, 0xe2ebff, 0, 0.04, 0)];
    for (let k = 1; k < 4; k++) pan.push(box(0.04, 0.02, 1.3, 0xe2ebff, -1.3 + k * 0.65, 0.04, 0));
    p.push(...put(pan, s * 2.65, 0, 0));
  }
  p.push(...twoSided([lathe([[0.05, 0], [0.5, 0.12], [0.8, 0.35]], WHITE, 14, 0, 0.9, 0)]), rod([0, 0.9, 0], [0, 1.6, 0], 0.04, 0.04, CHROME, 4), ballC(0.1, 0xff9fb8, 0, 1.65, 0, 0));
  return p;
}
// Twinkling stars as points, only outside the board (far side and wide sides).
function starfield(K, hw, hd, n) {
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), ph = new Float32Array(n);
  const SC = [0xfff6c8, 0xffffff, 0xffe0f0, 0xfff0a0];
  for (let i = 0; i < n; i++) {
    let x, y, z;
    // Mostly low and far: the top-down camera only sees a band of 'sky' just above the horizon.
    if (K.R() < 0.65) { x = K.rnd(-(hw + 40), hw + 40); z = -(hd + K.rnd(7, 40)); y = K.rnd(2.5, 13); }
    else { x = (K.R() < 0.5 ? -1 : 1) * (hw + K.rnd(8, 32)); z = K.rnd(-(hd + 4), hd + 12); y = K.rnd(3, 11); }
    pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
    _c.set(K.pick(SC)); col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b;
    ph[i] = K.R();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('ph', new THREE.BufferAttribute(ph, 1));
  const tex = canvasTex(64, (x, s) => {
    const gr = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.18, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.45, 'rgba(255,240,255,0.25)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = gr; x.fillRect(0, 0, s, s);
    x.fillStyle = 'rgba(255,255,255,0.7)'; x.fillRect(s / 2 - 1, 6, 2, s - 12); x.fillRect(6, s / 2 - 1, s - 12, 2);
  });
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  const uTime = { value: 0 };
  const mat = new THREE.PointsMaterial({ size: 2.0, map: tex, transparent: true, depthWrite: false, vertexColors: true });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float ph;\nuniform float uTime;')
      .replace('#include <fog_vertex>', '#include <fog_vertex>\ngl_PointSize *= 0.6 + 0.4 * sin(uTime * (1.2 + ph * 2.0) + ph * 40.0);');
  };
  mat.customProgramCacheKey = () => 'backdrop-stars';
  const m = new THREE.Points(g, mat);
  m.name = 'stars'; m.frustumCulled = false;
  K.meshes.push(m);
  K.tick.push((t) => { uTime.value = t; });
}

// ============================================================== entry
const BUILDERS = { bakery, kitchen, playroom, picnic, garden, beach, candy, farm, snow, craft, fair, space };

export function buildBackdrop(worldKey, arena, root) {
  const build = BUILDERS[worldKey];
  if (!build || !arena || !root) return null;
  const K = makeKit(worldKey, arena);
  build(K);
  // Tabletop worlds drop the surround to their room floor; outdoor/floor worlds tuck it
  // just under the ground decals so nothing z-fights at a distance.
  const sur = surroundOf(root);
  if (sur) sur.position.y = K.surroundY ?? K.floorY - 0.05;
  return finish(K, root);
}
