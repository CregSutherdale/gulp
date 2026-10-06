// Season 4 worlds: Tea Party (a garden tea party on a gingham cloth), Flower Shop (a sunny
// shop floor with shelves, buckets and a shop window) and Cozy Library (a reading room with
// tall shelves, a fireplace and lamps). Floors/skies follow levelbuild.js WORLDS; scenery
// follows the backdrops.js contract (outside the rail, low on the near side, merged meshes,
// baked blob shadows, deterministic via the kit's rng). Helpers are copied so this file
// stands alone.
import * as THREE from 'three';
import { box, cyl, cone, ball, custom } from './geo.js';

const TAU = Math.PI * 2, PI = Math.PI;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const _c = new THREE.Color(), _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
const _p = new THREE.Vector3(), _s = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);

// ------------------------------------------------------------------ floors (2D canvas)
function noise(x, w, h, a) {
  const img = x.getImageData(0, 0, w, h), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * a; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  x.putImageData(img, 0, 0);
}

export const WORLDS = {
  tea: {
    // A butter-cream gingham tea cloth on the lawn: pastel china pops on it.
    label: 'Tea Party', sky: 0xd8f0ff, hemiSky: 0xf4fbff, hemiGround: 0xc9dfae, surround: 0x8fcf73, wall: 0xffffff, accent: '#ff7fa6',
    tile: 3, floor: (x, w, h) => {
      x.fillStyle = '#fff7e2'; x.fillRect(0, 0, w, h);
      const n = 6, s = w / n;
      x.fillStyle = 'rgba(150, 196, 160, .26)';
      for (let i = 0; i < n; i += 2) { x.fillRect(i * s, 0, s, h); x.fillRect(0, i * s, w, s); }
      x.strokeStyle = 'rgba(255,255,255,.5)'; x.lineWidth = 1;
      for (let i = 0; i <= n; i++) { x.beginPath(); x.moveTo(i * s + 0.5, 0); x.lineTo(i * s + 0.5, h); x.stroke(); }
      noise(x, w, h, 6);
    },
  },
  florist: {
    // Pale sage stone tiles with cream grout: red blooms and terracotta read clearly.
    label: 'Flower Shop', sky: 0xfff3e6, hemiSky: 0xfffaf2, hemiGround: 0xd9e2d0, surround: 0xd2dccb, wall: 0x9fd0b4, accent: '#ff6f9c',
    tile: 3, floor: (x, w, h) => {
      x.fillStyle = '#f6f1e6'; x.fillRect(0, 0, w, h);
      const n = 2, s = w / n;
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        x.fillStyle = (i + j) % 2 ? '#c6dabd' : '#d5e4cc';
        x.fillRect(i * s + 3, j * s + 3, s - 6, s - 6);
      }
      noise(x, w, h, 7);
      x.fillStyle = 'rgba(255,255,255,.35)';
      for (let i = 0; i < 40; i++) x.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    },
  },
  library: {
    // A warm cream reading-room carpet with a soft diamond weave: bold book colors pop.
    label: 'Cozy Library', sky: 0xf6e6cf, hemiSky: 0xfff6ea, hemiGround: 0xd8c2a2, surround: 0xb98a5e, wall: 0xa86a4a, accent: '#e0465c',
    tile: 4, floor: (x, w, h) => {
      x.fillStyle = '#f1e4cc'; x.fillRect(0, 0, w, h);
      x.strokeStyle = 'rgba(190, 150, 110, .28)'; x.lineWidth = 2;
      const s = w / 4;
      for (let i = -4; i <= 8; i++) {
        x.beginPath(); x.moveTo(i * s, 0); x.lineTo(i * s + h, h); x.stroke();
        x.beginPath(); x.moveTo(i * s, 0); x.lineTo(i * s - h, h); x.stroke();
      }
      x.fillStyle = 'rgba(224, 120, 110, .22)';
      for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { x.beginPath(); x.arc(i * s + s / 2, j * s, 3, 0, 6.3); x.fill(); }
      noise(x, w, h, 6);
    },
  },
};

// ------------------------------------------------------------------ 3D helpers (as backdrops.js)
const ballC = (r, col, x = 0, y = 0, z = 0, det = 1, sy = 1) => ball(r, col, x, y - r * sy, z, det, sy);
const egg = (a, b, c, col, x = 0, y = 0, z = 0, ws = 12, hs = 8) => custom(new THREE.SphereGeometry(1, ws, hs).scale(a, b, c).translate(x, y, z), col);
const dome = (a, b, c, col, x = 0, y = 0, z = 0, ws = 18, hs = 6) => custom(new THREE.SphereGeometry(1, ws, hs, 0, TAU, 0, PI / 2).scale(a, b, c).translate(x, y, z), col);
const lathe = (pts, col, seg = 14, x = 0, y = 0, z = 0) => custom(new THREE.LatheGeometry(pts.map(([r, h]) => new THREE.Vector2(r, h)), seg).translate(x, y, z), col);
const rectXZ = (x0, x1, z0, z1, y, col) => custom(new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-PI / 2).translate((x0 + x1) / 2, y, (z0 + z1) / 2), col);
const disc = (r, col, x = 0, y = 0, z = 0, seg = 16) => custom(new THREE.CircleGeometry(r, seg).rotateX(-PI / 2).translate(x, y, z), col);
// Room floor round the board (never over it): four strips meeting under the rail.
const frame = (hw, hd, x0, x1, z0, z1, y, col) => [rectXZ(x0, x1, z0, -hd - 0.5, y, col), rectXZ(x0, x1, hd + 0.5, z1, y, col),
  rectXZ(x0, -hw - 0.5, -hd - 0.5, hd + 0.5, y, col), rectXZ(hw + 0.5, x1, -hd - 0.5, hd + 0.5, y, col)];
const panel = (w, h, col, x = 0, y = 0, z = 0) => custom(new THREE.PlaneGeometry(w, h).translate(x, y + h / 2, z), col);
function rod(a, b, r0, r1, col, seg = 6) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), len = A.distanceTo(B) || 0.001;
  const g = new THREE.CylinderGeometry(r1, r0, len, seg).translate(0, len / 2, 0);
  g.applyQuaternion(_q.setFromUnitVectors(_up, B.clone().sub(A).normalize())).translate(A.x, A.y, A.z);
  return custom(g, col);
}
function put(parts, x = 0, y = 0, z = 0, ry = 0, s = 1) {
  const list = [parts].flat(Infinity);
  _e.set(0, ry, 0, 'YXZ'); _s.set(s, s, s);
  _m4.compose(_p.set(x, y, z), _q.setFromEuler(_e), _s);
  for (const g of list) g.applyMatrix4(_m4);
  return list;
}
function recolor(parts, fn) {
  for (const g of [parts].flat(Infinity)) {
    const p = g.attributes.position, c = g.attributes.color;
    for (let i = 0; i < p.count; i++) { _c.setRGB(c.getX(i), c.getY(i), c.getZ(i)); fn(p.getX(i), p.getY(i), p.getZ(i), _c); c.setXYZ(i, _c.r, _c.g, _c.b); }
  }
  return parts;
}
const shadeY = (parts, y0, y1, lo, hi) => recolor(parts, (x, y, z, c) => c.multiplyScalar(lo + (hi - lo) * clamp01((y - y0) / (y1 - y0))));
// Many flat discs in one geometry: [x, y, z, r, colour, seg=7, sx=1, sz=1, ry=0].
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
      nor[k * 3 + 1] = 1; col[k * 3] = _c.r; col[k * 3 + 1] = _c.g; col[k * 3 + 2] = _c.b; k++;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('tmask', new THREE.BufferAttribute(tm, 1));
  return g;
}
// Sagging cord with little pennant flags hanging from it.
function bunting(K, a, b, sag, cols) {
  const at = (t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - Math.sin(t * PI) * sag, a[2] + (b[2] - a[2]) * t];
  let prev = a;
  for (let i = 1; i <= 8; i++) { const p = at(i / 8); K.glossy.push(rod(prev, p, 0.035, 0.035, 0x8a7a80, 3)); prev = p; }
  const n = Math.max(3, Math.round(Math.hypot(b[0] - a[0], b[2] - a[2]) / 0.9));
  const dx = (b[0] - a[0]), dz = (b[2] - a[2]), L = Math.hypot(dx, dz) || 1, ux = dx / L, uz = dz / L;
  for (let i = 1; i < n; i++) {
    const [x, y, z] = at(i / n), w = 0.32;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([x - ux * w, y, z - uz * w, x + ux * w, y, z + uz * w, x, y - 0.75, z, x + ux * w, y, z + uz * w, x - ux * w, y, z - uz * w, x, y - 0.75, z], 3));
    g.computeVertexNormals();
    K.glossy.push(custom(g, cols[i % cols.length]));
  }
}
const LEAVES = [0x7fcf6a, 0x8fd87a, 0x72c460, 0x6cbf5c];
function roundTree(K, h, cr, leaf) {
  const th = Math.max(1.2, h - cr * 1.7), cy = th + cr * 0.75;
  const can = [egg(cr, cr, cr, leaf, 0, cy, 0, 12, 8)];
  for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU + K.R(); can.push(ballC(cr * K.rnd(0.5, 0.66), leaf, Math.cos(a) * cr * 0.68, cy + K.rnd(-0.38, 0.2) * cr, Math.sin(a) * cr * 0.68, 1)); }
  shadeY(can, cy - cr * 1.1, cy + cr * 1.2, 0.62, 1.15);
  return [cyl(cr * 0.13, cr * 0.19, th + cr * 0.5, 0x9a6a44, 0, 0, 0, 7), ...can];
}
// A rounded bush dotted with roses.
function roseBush(K, r, leaf, rose) {
  const parts = [ballC(r, leaf, 0, r * 0.8, 0, 1, 0.85)];
  for (let i = 0; i < 3; i++) { const a = i * 2.1 + K.R(); parts.push(ballC(r * 0.7, leaf, Math.cos(a) * r * 0.7, r * 0.6, Math.sin(a) * r * 0.7, 1)); }
  shadeY(parts, 0, r * 1.7, 0.62, 1.1);
  for (let i = 0; i < 9; i++) {
    const y = K.rnd(0.35, 1.0), a = K.R() * TAU, rr = r * Math.sqrt(Math.max(0.05, 1 - (y - 0.45) * (y - 0.45) * 1.6)) * 0.95;
    parts.push(ballC(0.16 * r + 0.08, rose, Math.cos(a) * rr, r * 0.15 + y * r * 1.35, Math.sin(a) * rr, 0));
  }
  return parts;
}
// A big teacup used as a garden planter (the tea party's signature scenery).
function cupPlanter(K, s, col) {
  const p = [lathe([[0, 0], [1.2, 0], [1.3, 0.12], [1.0, 0.18], [0, 0.18]], 0xfffaf4, 18),
    lathe([[0.45, 0], [0.7, 0.3], [1.0, 1.0], [1.08, 1.5], [0.98, 1.5], [0.9, 1.0], [0, 0.9]], col, 18, 0, 0.18, 0),
    custom(new THREE.TorusGeometry(1.05, 0.05, 4, 18).rotateX(PI / 2).translate(0, 1.66, 0), 0xffc95a),
    custom(new THREE.TorusGeometry(0.32, 0.09, 5, 10).translate(1.12, 1.05, 0), col),
    dome(0.95, 0.5, 0.95, 0x5cb85a, 0, 1.5, 0, 12, 4)];
  for (let i = 0; i < 7; i++) { const a = i * TAU / 7; p.push(ballC(0.2, K.pick([0xff7fa6, 0xffffff, 0xffd23f, 0xc4a3ff]), Math.cos(a) * 0.55, 1.95, Math.sin(a) * 0.55, 0)); }
  return put(p, 0, 0, 0, 0, s);
}
function gazebo(K, R, col) {
  const p = [lathe([[0, 0], [R + 0.4, 0], [R + 0.4, 0.4], [0, 0.4]], 0xf2ebe0, 16)];
  for (let i = 0; i < 8; i++) { const a = i * TAU / 8; p.push(cyl(0.16, 0.16, 3.6, 0xffffff, Math.cos(a) * R, 0.4, Math.sin(a) * R, 8)); }
  p.push(custom(new THREE.TorusGeometry(R, 0.14, 4, 16).rotateX(PI / 2).translate(0, 4.0, 0), 0xffffff));
  const roof = custom(new THREE.ConeGeometry(R + 0.8, 2.6, 16).translate(0, 4.0 + 1.3, 0), col);
  recolor(roof, (x, y, z, c) => { const a = Math.atan2(z, x); if (Math.floor((a / TAU + 1) * 16) % 2) c.lerp(new THREE.Color(0xffffff), 0.85); });
  p.push(roof, ballC(0.3, 0xffc95a, 0, 7.0, 0, 1));
  return p;
}
function lantern(col) {
  return [cyl(0.06, 0.06, 2.6, 0x6a5a6a, 0, 0, 0, 6), egg(0.32, 0.4, 0.32, col, 0, 2.95, 0, 10, 7), cyl(0.18, 0.2, 0.12, 0x6a5a6a, 0, 3.3, 0, 8)];
}

// ======================================================================== TEA PARTY
const PENN = [0xff9fb8, 0xffd36e, 0x9fe0c4, 0x9fc8ff, 0xc9b2ff];
function tea(K) {
  const { hw, hd, ns } = K;
  K.shadow = 0x3f6b3a;
  const G = K.glossy, X0 = hw + 0.5, Z0 = hd + 0.5, PB = 2.2, PX = X0 + PB, PZ = Z0 + PB;
  const dots = [];
  // A pale flagstone border round the cloth, then lawn with clover and daisies.
  K.flat.push(rectXZ(-PX, PX, Z0, PZ, 0.02, 0xe8dcc6), rectXZ(-PX, PX, -PZ, -Z0, 0.02, 0xe8dcc6), rectXZ(X0, PX, -Z0, Z0, 0.02, 0xe8dcc6), rectXZ(-PX, -X0, -Z0, Z0, 0.02, 0xe8dcc6));
  for (let z = -PZ + 0.6, row = 0; z < PZ; z += 1.1, row++) for (let x = -PX + 0.6 + (row % 2) * 0.55; x < PX; x += 1.1) {
    if (Math.abs(x) < X0 + 0.1 && Math.abs(z) < Z0 + 0.1) continue;
    dots.push([x, 0.03, z, K.rnd(0.42, 0.5), K.pick([0xf6eee0, 0xf0e4d0, 0xfaf4ea]), 6, 1, 1, K.R()]);
  }
  for (let i = 0; i < 50; i++) { const [x, z] = K.around(PB + 2.2, 30, 18); dots.push([x, 0.01 + (i % 3) * 0.01, z, K.rnd(1.6, 3.8), K.pick([0x86c86a, 0x9ad77c, 0x80c066]), 12, 1, K.rnd(0.6, 1), K.R() * PI]); }
  for (let i = 0; i < 150; i++) { const [x, z] = K.around(PB + 1.2, 26, 18); dots.push([x, 0.09, z, 0.12, K.pick([0xffffff, 0xffffff, 0xfff27a, 0xffc2dc]), 5]); }

  // Far side: a white gazebo with a pink-striped roof, rose hedges, lanterns and bunting.
  const gz = -(hd + 9), gx = Math.max(hw * 0.35, 3.5);
  K.add(gazebo(K, 3.0, 0xff9fb8), gx, 0, gz); K.blob(gx, 0.02, gz, 4.2, 4.0, 0.4); K.claim(gx, gz, 4.6);
  for (let i = 0; i < 3; i++) { const a = i * TAU / 3 + 0.4; K.add(put([cyl(0.1, 0.1, 0.9, 0xffffff, 0, 0, 0, 6), cyl(0.7, 0.7, 0.08, 0xffffff, 0, 0.9, 0, 14)], Math.cos(a) * 1.2, 0.4, Math.sin(a) * 1.2), gx, 0, gz); }
  K.add([lathe([[0, 0], [0.4, 0], [0.4, 0.5], [0, 0.5]], 0xff9fb8, 10), ballC(0.25, 0xffc95a, 0, 0.75, 0, 1)], gx, 1.4, gz);
  const hz = -(PZ + 1.6);
  for (let x = -(hw + 6); x <= hw + 6; x += 2.2) {
    if (Math.abs(x - gx) < 4.2) continue;
    K.add(roseBush(K, 1.0, K.pick(LEAVES), K.pick([0xff7fa6, 0xffffff, 0xff9fb8, 0xffd23f])), x, 0, hz + K.rnd(-0.2, 0.2), K.R() * TAU);
    K.blob(x, 0.02, hz, 1.3, 1.1, 0.3);
  }
  const archX = -Math.max(hw * 0.45, 4);
  for (const s of [-1, 1]) K.add([cyl(0.12, 0.12, 3.4, 0xffffff, s * 1.4, 0, 0, 6)], archX, 0, hz - 0.2);
  K.add([custom(new THREE.TorusGeometry(1.4, 0.12, 5, 14, PI).translate(0, 3.4, 0), 0xffffff)], archX, 0, hz - 0.2);
  for (let i = 0; i < 12; i++) { const a = (i / 11) * PI; K.add([ballC(0.26, i % 2 ? 0xff7fa6 : 0x6cbf5c, Math.cos(a) * 1.4, 3.4 + Math.sin(a) * 1.4, 0, 1)], archX, 0, hz - 0.2); }
  // Lantern posts round the lawn with bunting strung between them.
  const LX = PX + 0.8, fzL = -(PZ + 0.4), posts = [];
  for (const s of [-1, 1]) for (const z of [fzL, -hd * 0.3, hd * 0.45]) posts.push([s * LX, z]);
  for (const [x, z] of posts) { K.add(lantern(0xfff1c4), x, 0, z); K.blob(x, 0.02, z, 0.6, 0.6, 0.35); K.halos.push([x, 2.95, z + 0.3, 0.9, 0.9, 0.35, 0xffd28a, true]); }
  for (const s of [-1, 1]) { bunting(K, [s * LX, 3.3, fzL], [s * LX, 3.3, -hd * 0.3], 0.7, PENN); bunting(K, [s * LX, 3.3, -hd * 0.3], [s * LX, 3.3, hd * 0.45], 0.7, PENN); }
  bunting(K, [-LX, 3.3, fzL], [LX, 3.3, fzL], 1.2, PENN);

  // Sides: giant teacup planters, a garden bench with cushions, round trees beyond.
  const SX = PX + 4.2;
  [[-1, -hd * 0.5, 0xff9cbc], [1, -hd * 0.65, 0x8fd0ff], [-1, hd * 0.25, 0xffd27e], [1, hd * 0.15, 0x9fe0b8]].forEach(([s, z, c]) => {
    K.add(cupPlanter(K, 1.2, c), s * SX, 0, z, s < 0 ? 0 : PI); K.blob(s * SX, 0.02, z, 1.8, 1.7, 0.35); K.claim(s * SX, z, 2);
  });
  const bx = -(SX + 0.6), bz = -hd * 0.02;
  K.add([box(0.12, 0.6, 2.6, 0xffffff, 0.5, 0, 0), box(0.12, 0.6, 2.6, 0xffffff, -0.5, 0, 0), box(1.2, 0.14, 2.8, 0xffffff, 0, 0.6, 0), box(0.14, 1.0, 2.8, 0xffffff, -0.55, 0.74, 0),
    box(0.9, 0.2, 0.9, 0xff9cbc, 0.05, 0.74, -0.6), box(0.9, 0.2, 0.9, 0x9fd8c4, 0.05, 0.74, 0.5)], bx, 0, bz, 0);
  K.blob(bx, 0.02, bz, 1.0, 1.7, 0.3);
  const tree = (x, z, h, cr) => { if (!K.free(x, z, cr + 0.3)) return; K.claim(x, z, cr + 0.3); K.add(roundTree(K, h, cr, K.pick(LEAVES)), x, 0, z, K.R() * TAU); K.blob(x + 0.4, 0.02, z + 0.4, cr * 1.1, cr * 0.95, 0.32); };
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) tree(s * (hw + K.rnd(11, 22)), K.rnd(-(hd + 8), hd + 8), K.rnd(5, 7.5), K.rnd(1.8, 2.6));
  for (let x = -(hw + 28); x <= hw + 28; x += K.rnd(6.5, 9)) tree(x, -(hd + K.rnd(15, 22)), K.rnd(6, 8.5), K.rnd(2.2, 2.9));
  for (let i = 0; i < 6; i++) { const h = dome(K.rnd(12, 22), K.rnd(3.5, 7), K.rnd(8, 14), K.pick([0x8cc96a, 0x9fd47c, 0x80bf60]), K.rnd(-(hw + 60), hw + 60), -0.3, -(hd + K.rnd(30, 55)), 16, 5); shadeY(h, 0, 7, 0.82, 1.08); K.matte.push(h); }

  // Near strip (low): a picnic rug corner, a flower bed, sugar cubes spilled from a bowl.
  const nz = hd + PB + 2.6 * ns;
  K.flat.push(rectXZ(-hw * 0.7 - 2.2, -hw * 0.7 + 2.2, nz - 1.4, nz + 1.4, 0.03, 0xffc4d2), rectXZ(-hw * 0.7 - 1.9, -hw * 0.7 + 1.9, nz - 1.1, nz + 1.1, 0.04, 0xfff6ea));
  for (let i = 0; i < 18; i++) dots.push([hw * 0.55 + K.rnd(-2.4, 2.4), 0.12, nz + K.rnd(-0.8, 0.8), 0.18, K.pick([0xff7fa6, 0xffd23f, 0xffffff, 0xc4a3ff]), 6]);
  K.add([dome(2.6, 0.5, 1.0, 0x6cbf5c, 0, 0, 0, 12, 3)], hw * 0.55, 0, nz);
  K.add(cupPlanter(K, 0.7, 0xc4a3ff), -hw * 0.7, 0.05, nz, 0.3);
  K.flat.push(discBatch(dots));
}

// ======================================================================== FLOWER SHOP
const BLOOMS = [0xff4a62, 0xff7fb0, 0xffbcd6, 0xff9a3c, 0xffd93f, 0xfffbf2, 0xb27aff, 0x8b9cff];
function flowerHead(K, r, col, x, y, z) {
  const p = [];
  for (let i = 0; i < 5; i++) { const a = i * TAU / 5; p.push(egg(r * 0.55, r * 0.22, r * 0.38, col, x + Math.cos(a) * r * 0.5, y, z + Math.sin(a) * r * 0.5, 5, 3)); }
  p.push(ballC(r * 0.28, col === 0xffd93f ? 0xff9a3c : 0xffd23a, x, y + r * 0.2, z, 0));
  return p;
}
function bucketOfFlowers(K, col, s = 1) {
  const p = [lathe([[0, 0], [0.42, 0], [0.55, 0.85], [0, 0.85]], 0xc8d2dc, 10), custom(new THREE.TorusGeometry(0.5, 0.03, 3, 10).rotateX(PI / 2).translate(0, 0.6, 0), 0xa8b4c2)];
  for (let i = 0; i < 5; i++) { const a = i * TAU / 5 + K.R(); p.push(egg(0.3, 0.06, 0.12, 0x5cc46b, Math.cos(a) * 0.4, 1.0, Math.sin(a) * 0.4, 5, 3)); }
  p.push(...flowerHead(K, 0.5, col, 0, 1.3, 0));
  for (let i = 0; i < 4; i++) { const a = i * TAU / 4 + 0.5; p.push(...flowerHead(K, 0.4, col, Math.cos(a) * 0.38, 1.15, Math.sin(a) * 0.38)); }
  return put(p, 0, 0, 0, 0, s);
}
function hangingBasket(K, col) {
  const p = [lathe([[0, 0], [0.4, 0.05], [0.7, 0.45], [0, 0.45]], 0xc9955a, 10), dome(0.7, 0.4, 0.7, 0x5cc46b, 0, 0.45, 0, 10, 3)];
  for (let i = 0; i < 6; i++) { const a = i * TAU / 6; p.push(ballC(0.16, col, Math.cos(a) * 0.55, 0.65, Math.sin(a) * 0.55, 0)); p.push(egg(0.1, 0.35, 0.1, 0x5cc46b, Math.cos(a) * 0.62, 0.1, Math.sin(a) * 0.62, 5, 3)); }
  for (let i = 0; i < 3; i++) { const a = i * TAU / 3; p.push(rod([Math.cos(a) * 0.6, 0.45, Math.sin(a) * 0.6], [0, 2.0, 0], 0.02, 0.02, 0x6a5a5a, 3)); }
  return p;
}
function florist(K) {
  const { hw, hd, ns } = K;
  K.shadow = 0x56664c;
  const G = K.glossy, M = K.matte;
  const BZ = -(hd + 10), RX = hw + 12, TOP = 14;
  const WALL = 0xfaf1e4, WAIN = 0x9fd0b4, TRIM = 0xffffff;
  // Shop floor: big cream tiles beyond the board, a doormat by the near edge.
  const dots = [];
  for (let z = BZ + 0.75; z < hd + 22; z += 1.5) for (let x = -RX + 0.75; x < RX; x += 1.5) {
    if (Math.abs(x) < hw + 0.9 && Math.abs(z) < hd + 0.9) continue;
    dots.push([x, 0.02, z, 0.66, ((Math.floor(x / 1.5) + Math.floor(z / 1.5)) & 1) ? 0xe2eadb : 0xeef2e8, 4, 1, 1, PI / 4]);
  }
  K.flat.push(...frame(hw, hd, -RX, RX, BZ, hd + 24, 0.005, 0xf6f1e6));
  // Back wall: wainscot, a long shelf of potted plants, a big arched shop window with sky.
  const wall = box(2 * RX + 2, TOP, 1, WALL, 0, 0, BZ - 0.5); shadeY(wall, 0, TOP, 0.84, 1.03);
  M.push(wall, box(2 * RX, 3.2, 0.3, WAIN, 0, 0, BZ + 0.15));
  G.push(box(2 * RX, 0.3, 0.45, TRIM, 0, 3.2, BZ + 0.22));
  for (const s of [-1, 1]) {
    const sw = box(1, TOP, hd * 2 + 22 - BZ, WALL, s * (RX + 0.5), 0, (BZ + hd + 22) / 2 - 0.5); shadeY(sw, 0, TOP, 0.78, 0.98);
    M.push(sw, box(0.3, 3.2, hd + 22 - BZ, WAIN, s * (RX - 0.15), 0, (BZ + hd + 22) / 2));
    G.push(box(0.45, 0.3, hd + 22 - BZ, TRIM, s * (RX - 0.22), 3.2, (BZ + hd + 22) / 2));
  }
  const ww = Math.min(12, hw * 1.0), wy = 4.6, wh = 7.5;
  K.lit.push(panel(ww, wh, 0xcfeeff, 0, wy, BZ + 0.06), custom(new THREE.CircleGeometry(ww / 2, 20, 0, PI).translate(0, wy + wh, BZ + 0.06), 0xcfeeff));
  for (let i = 0; i < 4; i++) K.lit.push(egg(K.rnd(1.2, 2), K.rnd(0.5, 0.8), 0.05, 0xffffff, K.rnd(-ww * 0.35, ww * 0.35), wy + K.rnd(2, 8), BZ + 0.08, 8, 5));
  G.push(box(ww + 0.6, 0.35, 0.6, TRIM, 0, wy - 0.35, BZ + 0.3));
  for (let i = 1; i < 4; i++) G.push(box(0.16, wh, 0.12, TRIM, -ww / 2 + (ww * i) / 4, wy, BZ + 0.12));
  G.push(box(ww, 0.16, 0.12, TRIM, 0, wy + wh * 0.5, BZ + 0.12));
  G.push(custom(new THREE.TorusGeometry(ww / 2, 0.2, 4, 20, PI).translate(0, wy + wh, BZ + 0.15), TRIM));
  for (const s of [-1, 1]) G.push(box(0.4, wh, 0.3, TRIM, s * (ww / 2 + 0.1), wy, BZ + 0.15));
  // Striped awning sign over the window, with the shop name plaque.
  const aw = new THREE.CylinderGeometry(1.2, 1.2, ww + 1.6, 16, 1, false, -PI / 2, PI).rotateZ(PI / 2).scale(1, 0.5, 1).translate(0, wy + wh + ww / 2 + 0.6, BZ + 0.4);
  const awp = custom(aw, 0xff9fb8); recolor(awp, (x, y, z, c) => { if (Math.floor((x + 40) / 0.9) % 2) c.setHex(0xffffff); }); G.push(awp);
  // Shelves of potted plants along the back wall, left and right of the window.
  const COLS = BLOOMS;
  for (const s of [-1, 1]) {
    const x0 = s * (ww / 2 + 1.0), x1 = s * (RX - 1.2), cx = (x0 + x1) / 2, w = Math.abs(x1 - x0);
    for (const y of [3.6, 6.2, 8.8]) {
      G.push(box(w, 0.2, 1.2, 0xd8b48a, cx, y, BZ + 0.6));
      for (let x = Math.min(x0, x1) + 0.8; x < Math.max(x0, x1) - 0.5; x += 1.5) {
        G.push(...put([lathe([[0, 0], [0.3, 0], [0.4, 0.55], [0, 0.55]], 0xe0875a, 8), ...(K.R() < 0.4 ? [egg(0.45, 0.6, 0.45, 0x5cb85a, 0, 1.0, 0, 7, 5)] : flowerHead(K, 0.45, K.pick(COLS), 0, 0.8, 0)), egg(0.25, 0.08, 0.12, 0x5cc46b, 0.25, 0.7, 0, 5, 3)], x, y + 0.2, BZ + 0.6));
      }
    }
    for (let i = 0; i < 3; i++) { const hx = s * (ww / 2 + 2.5 + i * 3); if (Math.abs(hx) < RX - 1.5) K.add(hangingBasket(K, K.pick(COLS)), hx, 10.4, BZ + 2.0); }
  }
  G.push(box(2 * RX, 0.3, 0.3, 0x9e6a3e, 0, 12.6, BZ + 2.0));
  // Sides: buckets of flowers on tiered stands, a shop counter with a till and ribbon rolls.
  const SX = hw + 4.0;
  for (const s of [-1, 1]) {
    for (let k = 0; k < 4; k++) {
      const z = -hd * 0.85 + k * (hd * 0.55);
      if (s > 0 && k === 2) continue;
      G.push(...put([box(2.4, 0.6, 1.8, 0xd8b48a, 0, 0, 0), box(2.4, 0.6, 0.9, 0xd8b48a, 0, 0.6, -0.45)], s * SX, 0, z, s < 0 ? PI / 2 : -PI / 2));
      K.add(bucketOfFlowers(K, K.pick(COLS), 0.8), s * (SX - 0.45), 0.6, z - 0.6);
      K.add(bucketOfFlowers(K, K.pick(COLS), 0.8), s * (SX - 0.45), 0.6, z + 0.6);
      K.add(bucketOfFlowers(K, K.pick(COLS), 0.9), s * (SX + 0.45), 1.2, z);
      K.blob(s * SX, 0.02, z, 1.6, 1.4, 0.35);
    }
  }
  const cx = SX + 1.0, cz = hd * 0.12;
  G.push(...put([box(2.0, 2.0, 4.6, 0xffffff, 0, 0, 0), box(2.3, 0.2, 4.9, 0xd8b48a, 0, 2.0, 0), box(0.06, 1.6, 4.0, 0x9fd0b4, -1.02, 0.2, 0),
    box(0.9, 0.6, 0.8, 0xff9fb8, 0.1, 2.2, -1.3), box(0.7, 0.3, 0.5, 0xffffff, 0.1, 2.8, -1.4),
    ...[0, 1, 2, 3].map((i) => cyl(0.25, 0.25, 0.3, [0xff7fa6, 0xffd27e, 0x93e2bd, 0x9fd3ff][i], 0.2, 2.2, 0.2 + i * 0.6, 12)),
    ...flowerHead(K, 0.6, 0xff4a62, 0.1, 2.7, 1.9)], cx, 0, cz));
  K.blob(cx, 0.02, cz, 1.6, 2.8, 0.4);
  // Near strip (low): a round doormat, petals, a watering can and seed packets.
  const nz = hd + 3.2 * ns;
  K.flat.push(disc(2.0, 0xc89a6a, -hw * 0.5, 0.03, nz, 24), disc(1.7, 0xdcb382, -hw * 0.5, 0.035, nz, 24));
  K.add([lathe([[0, 0], [0.5, 0], [0.55, 0.9], [0, 0.9]], 0x8fd0ff, 12), rod([0.5, 0.6, 0], [1.3, 1.1, 0], 0.08, 0.1, 0x8fd0ff), custom(new THREE.TorusGeometry(0.4, 0.07, 4, 10, PI).translate(0, 0.9, 0), 0x8fd0ff)], hw * 0.55, 0, nz, 0.4, ns);
  K.blob(hw * 0.55, 0.02, nz, 1.0, 0.8, 0.3);
  K.flat.push(discBatch(dots));
  K.surroundY = -0.05;
}

// ======================================================================== COZY LIBRARY
const SPINE = [0xc9445a, 0x3f6fc0, 0x3f9c64, 0xd9a032, 0x7d56c0, 0x2f9fb0, 0xd8714a, 0xe07fa0, 0xf2e6cf, 0x6a4a3a];
// A tall bookshelf facing +z: w wide, h tall, rows of books.
function bigShelf(K, w, h, wood) {
  const p = [box(w, h, 1.4, wood, 0, 0, -0.1), box(w + 0.4, 0.5, 1.8, wood, 0, h, 0)];
  const rows = Math.round(h / 1.8), rh = (h - 0.4) / rows;
  for (let r = 0; r < rows; r++) {
    const y = 0.4 + r * rh;
    p.push(box(w - 0.4, rh - 0.15, 0.1, 0x4a3226, 0, y, 0.55));
    let x = -w / 2 + 0.35;
    while (x < w / 2 - 0.5) {
      const bw = K.rnd(0.18, 0.34), bh = rh * K.rnd(0.6, 0.85);
      if (K.R() < 0.06) { x += 0.4; continue; }
      p.push(box(bw, bh, 0.9, K.pick(SPINE), x + bw / 2, y, 0.7));
      x += bw + 0.03;
    }
    p.push(box(w - 0.3, 0.15, 1.3, wood, 0, y - 0.15, 0.1));
  }
  for (const s of [-1, 1]) p.push(box(0.25, h, 1.5, wood, s * (w / 2 - 0.12), 0, 0));
  return p;
}
function floorLamp(col) {
  return [cyl(0.5, 0.6, 0.15, 0xc9a24a, 0, 0, 0, 12), cyl(0.07, 0.07, 4.2, 0xc9a24a, 0, 0.15, 0, 6), lathe([[1.0, 0], [0.6, 1.0], [0.55, 1.0]], col, 14, 0, 3.6, 0)];
}
function armchair(col) {
  return [box(2.4, 1.0, 2.2, col, 0, 0.2, 0), box(2.4, 2.2, 0.5, col, 0, 0.2, -0.9), box(0.5, 1.6, 2.2, col, -1.1, 0.2, 0), box(0.5, 1.6, 2.2, col, 1.1, 0.2, 0),
    box(1.5, 0.3, 1.5, 0xfff3e2, 0, 1.2, 0.2), ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => cyl(0.1, 0.08, 0.25, 0x6a4a3a, a * 1.0, 0, b * 0.9, 6))];
}
function library(K) {
  const { hw, hd, ns } = K;
  K.shadow = 0x5a3a26;
  const G = K.glossy, M = K.matte;
  const BZ = -(hd + 11), RX = hw + 13, TOP = 18;
  const WALL = 0xf3e2c8, WOOD = 0x8a5a3a, WOOD_D = 0x6a4430;
  // Parquet floor beyond the board (planks in two tones) with a red border rug edge.
  const dots = [];
  K.flat.push(...frame(hw, hd, -RX, RX, BZ, hd + 24, 0.005, 0xb98a5e));
  for (let z = BZ + 0.5; z < hd + 24; z += 1.0) for (let x = -RX + 1.2, k = 0; x < RX; x += 2.4, k++) {
    if (Math.abs(x) < hw + 1.8 && Math.abs(z) < hd + 0.9) continue;
    dots.push([x + ((Math.round(z) & 1) ? 1.2 : 0), 0.01, z, 1.15, ((k + Math.round(z)) % 3) ? 0xc4956a : 0xae7f55, 4, 1, 0.38, PI / 4]);
  }
  K.flat.push(rectXZ(-hw - 1.6, hw + 1.6, -hd - 1.6, -hd - 0.5, 0.02, 0xb84a4a), rectXZ(-hw - 1.6, hw + 1.6, hd + 0.5, hd + 1.6, 0.02, 0xb84a4a),
    rectXZ(-hw - 1.6, -hw - 0.5, -hd - 0.5, hd + 0.5, 0.02, 0xb84a4a), rectXZ(hw + 0.5, hw + 1.6, -hd - 0.5, hd + 0.5, 0.02, 0xb84a4a));
  for (let t = -hw - 1; t <= hw + 1; t += 1.0) dots.push([t, 0.03, -hd - 1.05, 0.2, 0xf2c45a, 4], [t, 0.03, hd + 1.05, 0.2, 0xf2c45a, 4]);
  for (let t = -hd; t <= hd; t += 1.0) dots.push([-hw - 1.05, 0.03, t, 0.2, 0xf2c45a, 4], [hw + 1.05, 0.03, t, 0.2, 0xf2c45a, 4]);
  // Walls, then shelves floor to ceiling on the back wall round a stone fireplace.
  const wall = box(2 * RX + 2, TOP, 1, WALL, 0, 0, BZ - 0.5); shadeY(wall, 0, TOP, 0.76, 1.0); M.push(wall);
  for (const s of [-1, 1]) { const sw = box(1, TOP, hd + 24 - BZ, WALL, s * (RX + 0.5), 0, (BZ + hd + 24) / 2); shadeY(sw, 0, TOP, 0.72, 0.95); M.push(sw); }
  const FW = 7;
  // fireplace
  G.push(box(FW, 6.0, 1.6, 0xd9cbb8, 0, 0, BZ + 0.8), box(FW + 1.0, 0.5, 2.0, 0xc9b9a4, 0, 6.0, BZ + 1.0), box(4.0, 3.2, 0.3, 0x3a2a26, 0, 0.6, BZ + 1.62));
  G.push(box(FW + 0.4, 0.6, 2.4, 0xc9b9a4, 0, 0, BZ + 1.2));
  for (let i = 0; i < 3; i++) G.push(cyl(0.25, 0.25, 2.6, 0x7a4a2a, -0.7 + i * 0.7, 0.85, BZ + 1.4, 6));
  K.lit.push(cone(1.0, 1.6, 0xffa23a, 0, 0.8, BZ + 1.5, 7), cone(0.6, 1.1, 0xffe07a, 0, 0.85, BZ + 1.7, 6));
  K.halos.push([0, 1.8, BZ + 2.2, 3.0, 2.2, 0.55, 0xff9a3a, true], [0, 0.05, BZ + 4.0, 5.0, 3.0, 0.3, 0xffb36a, false]);
  G.push(box(5.6, 3.6, 0.2, 0xffc95a, 0, 7.5, BZ + 0.2), box(5.0, 3.0, 0.1, 0x9fc0d8, 0, 7.8, BZ + 0.32));
  G.push(...put([lathe([[0, 0], [0.3, 0], [0.4, 0.6], [0, 0.6]], 0xc94a5a, 8)], -2.8, 6.5, BZ + 1.0), ...put([cyl(0.4, 0.4, 0.8, 0xfff0d4, 0, 0, 0, 12), cyl(0.42, 0.42, 0.1, 0xc9a24a, 0, 0.8, 0, 12)], 2.6, 6.5, BZ + 1.0));
  for (const s of [-1, 1]) {
    const x0 = s * (FW / 2 + 0.2), x1 = s * (RX - 0.3), w = Math.abs(x1 - x0);
    K.add(bigShelf(K, w, TOP - 2, WOOD), (x0 + x1) / 2, 0, BZ + 0.8);
    // side walls: shelves too, with an arched window between them
    const zs = [BZ + 6, -hd * 0.1, hd + 6];
    zs.forEach((z, i) => { if (i === 1) return; K.add(put(bigShelf(K, 8, 12, WOOD_D), 0, 0, 0, -s * PI / 2), s * (RX - 0.8), 0, z); });
    K.lit.push(...put([panel(5, 7, 0xd8ecff, 0, 4, 0), custom(new THREE.CircleGeometry(2.5, 16, 0, PI).translate(0, 11, 0), 0xd8ecff)], s * (RX - 0.05), 0, -hd * 0.1, -s * PI / 2));
    G.push(...put([box(5.6, 0.4, 0.6, 0xffffff, 0, 3.6, 0), box(0.3, 7.4, 0.3, 0xffffff, 0, 4, 0.05), box(5.2, 0.25, 0.3, 0xffffff, 0, 7.6, 0.05)], s * (RX - 0.15), 0, -hd * 0.1, -s * PI / 2));
    K.halos.push([s * (RX - 0.5), 7.5, -hd * 0.1, 3.5, 4.0, 0.25, 0xfff2d0, true]);
  }
  // Reading corners: armchairs with floor lamps on both sides, a side table with tea.
  [[-1, -hd * 0.55, 0xc9445a], [1, -hd * 0.6, 0x3f6fc0], [-1, hd * 0.4, 0x3f9c64]].forEach(([s, z, col]) => {
    const x = s * (hw + 5.4);
    K.add(armchair(col), x, 0, z, s < 0 ? PI / 2 : -PI / 2); K.blob(x, 0.02, z, 1.8, 1.8, 0.4);
    const lx = x, lz = z - 2.4;
    K.add(floorLamp(0xfff0c8), lx, 0, lz); K.blob(lx, 0.02, lz, 0.9, 0.9, 0.35);
    K.halos.push([lx, 4.0, lz + 0.6, 1.6, 1.4, 0.45, 0xffc46b, true], [lx, 0.04, lz, 3.0, 2.6, 0.28, 0xffd28a, false]);
  });
  const tx = hw + 5.0, tz = hd * 0.35;
  G.push(...put([cyl(1.0, 1.0, 0.12, WOOD, 0, 1.2, 0, 16), cyl(0.12, 0.2, 1.2, WOOD_D, 0, 0, 0, 8), cyl(0.5, 0.6, 0.1, WOOD_D, 0, 0, 0, 10),
    egg(0.35, 0.3, 0.35, 0xffffff, -0.2, 1.62, 0, 10, 6), cyl(0.2, 0.18, 0.3, 0xff9cbc, 0.45, 1.32, 0.3, 10), box(0.7, 0.2, 0.5, 0x3f6fc0, 0.2, 1.32, -0.45)], tx, 0, tz));
  K.blob(tx, 0.02, tz, 1.2, 1.2, 0.35);
  // A rolling ladder against the back shelves, a globe and stacks of books on the floor.
  const lx = -(FW / 2 + 3);
  for (const s of [-1, 1]) G.push(rod([lx + s * 0.6, 0, BZ + 3.2], [lx + s * 0.6, 12, BZ + 1.9], 0.1, 0.1, 0x6a4430));
  for (let i = 1; i < 12; i++) G.push(rod([lx - 0.6, i, BZ + 3.2 - i * 0.108], [lx + 0.6, i, BZ + 3.2 - i * 0.108], 0.06, 0.06, 0x6a4430));
  K.blob(lx, 0.02, BZ + 3.2, 1.0, 0.5, 0.3);
  const gx = FW / 2 + 2.6;
  K.add([lathe([[0, 0], [0.6, 0], [0.2, 0.6], [0.1, 1.6], [0, 1.6]], WOOD_D, 10), ballC(0.9, 0x6fbaff, 0, 2.5, 0, 2), custom(new THREE.TorusGeometry(1.0, 0.06, 4, 16, PI * 1.3).rotateZ(0.4).translate(0, 2.5, 0), 0xc9a24a)], gx, 0, BZ + 3.2);
  K.blob(gx, 0.02, BZ + 3.2, 0.9, 0.8, 0.35);
  const stack = (x, z, n) => { const p = []; let y = 0; for (let i = 0; i < n; i++) { const h = K.rnd(0.25, 0.4); p.push(box(K.rnd(1.0, 1.3), h, K.rnd(0.8, 1.0), K.pick(SPINE), K.rnd(-0.1, 0.1), y, K.rnd(-0.08, 0.08), K.rnd(-0.3, 0.3))); y += h; } K.add(p, x, 0, z, K.R()); K.blob(x, 0.02, z, 0.9, 0.8, 0.3); };
  stack(-(hw + 3.2), -hd * 0.05, 5); stack(hw + 3.0, -hd * 0.25, 4); stack(-(hw + 3.6), -hd * 0.95, 6);
  // Near strip (low): a cushion, an open book, a sleepy cat on a rug.
  const nz = hd + 3.0 * ns;
  K.flat.push(disc(2.2, 0x8fa8d8, hw * 0.5, 0.03, nz, 24), disc(1.8, 0xb8c8ec, hw * 0.5, 0.035, nz, 24));
  K.add([egg(0.8, 0.45, 0.6, 0xf0a050, 0, 0.45, 0, 10, 6), ballC(0.45, 0xf0a050, 0.7, 0.85, 0.2, 1), cone(0.15, 0.3, 0xf0a050, 0.55, 1.15, 0.2, 4), cone(0.15, 0.3, 0xf0a050, 0.9, 1.15, 0.2, 4),
    custom(new THREE.TorusGeometry(0.5, 0.12, 4, 10, PI).rotateX(PI / 2).translate(-0.3, 0.12, 0.2), 0xf0a050)], hw * 0.5, 0.04, nz, -0.3, ns);
  K.blob(hw * 0.5, 0.05, nz, 1.1, 0.8, 0.3);
  K.add([egg(1.0, 0.35, 1.0, 0xffb3c7, 0, 0.35, 0, 12, 5)], -hw * 0.6, 0, nz - 0.4, 0, ns);
  K.flat.push(discBatch(dots));
  K.surroundY = -0.05;
}

export const BACKDROPS = { tea, florist, library };
export const MUSIC = { tea: 'east_town', florist: 'peaceful_village', library: 'wood_forest_town' };
