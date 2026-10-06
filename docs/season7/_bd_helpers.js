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
