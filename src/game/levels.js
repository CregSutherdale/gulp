// Gulp's 30 levels: 5 per world (bakery, picnic, playroom, garden, beach, kitchen).
// Op semantics follow levelbuild.js: grid `gap` = centre pitch (gapX/gapZ override),
// ring item i sits at angle 2*PI*i/n from +x and faces outward unless `rot` is given,
// line spaces n items end to end, `at` is one prop. Fronts face +z (the camera).
// Patterns (hearts, arcs, waves, spirals, train loops) expand to plain `at` ops here,
// so every position is fixed data. tools/check_levels.mjs validates the result.
const TAU = Math.PI * 2;
const r3 = (v) => Math.round(v * 1000) / 1000;

// ------------------------------------------------------------------ plain ops
function grid(id, x, z, cols, rows, gx, gz = gx, tint = 'cycle', rot) {
  const o = { op: 'grid', id, x, z, cols, rows, gap: gx, tint };
  if (gz !== gx) { o.gapX = gx; o.gapZ = gz; }
  if (rot !== undefined) o.rot = rot;
  return o;
}
const ring = (id, x, z, n, r, tint = 'cycle', rot) => ({ op: 'ring', id, x, z, n, r, tint, ...(rot !== undefined ? { rot } : {}) });
const line = (id, x0, z0, x1, z1, n, tint = 'cycle', rot) => ({ op: 'line', id, x0, z0, x1, z1, n, tint, ...(rot !== undefined ? { rot } : {}) });
const at = (id, x, z, tint = 0, rot = 0) => ({ op: 'at', id, x: r3(x), z: r3(z), tint, rot: r3(rot) });
const tintOf = (tint, i) => (Array.isArray(tint) ? tint[i % tint.length] : typeof tint === 'number' ? tint : i);

// ------------------------------------------------------------------ patterns -> `at` ops
// Sample a curve f(t) (t in 0..1) and return n points evenly spaced by arc length,
// each with the heading of the curve (as a rot whose local +z points along it).
function along(f, n, closed) {
  const S = 800, P = [], acc = [0];
  for (let i = 0; i <= S; i++) P.push(f(i / S));
  for (let i = 1; i <= S; i++) acc.push(acc[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  const L = acc[S], out = [], m = closed ? n : n - 1;
  for (let k = 0; k < n; k++) {
    const s = m ? (L * k) / m : L / 2;
    let j = 1; while (j < S && acc[j] < s) j++;
    const u = (s - acc[j - 1]) / (acc[j] - acc[j - 1] || 1), p = P[j - 1], q = P[j];
    out.push([p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u, Math.atan2(q[0] - p[0], q[1] - p[1])]);
  }
  return out;
}
function curveLen(f) { let L = 0, p = f(0); for (let i = 1; i <= 800; i++) { const q = f(i / 800); L += Math.hypot(q[0] - p[0], q[1] - p[1]); p = q; } return L; }
// Place props along a curve every `spacing` units. face: 'cam' (rot 0), 'along', 'side' (local x along the curve).
function path(id, f, spacing, tint = 'cycle', { closed = false, face = 'cam', minD = 0 } = {}) {
  const L = curveLen(f), n = closed ? Math.floor(L / spacing) : Math.floor(L / spacing) + 1;
  const kept = [];
  for (const p of along(f, n, closed)) if (kept.every((q) => Math.hypot(p[0] - q[0], p[1] - q[1]) >= minD)) kept.push(p);
  return kept.map(([x, z, h], i) => at(id, x, z, tintOf(tint, i), face === 'along' ? h : face === 'side' ? h - Math.PI / 2 : 0));
}
const arcF = (cx, cz, r, a0, a1) => (t) => { const a = a0 + (a1 - a0) * t; return [cx + r * Math.cos(a), cz + r * Math.sin(a)]; };
const waveF = (x0, x1, z, amp, waves, ph = 0) => (t) => [x0 + (x1 - x0) * t, z + amp * Math.sin(t * waves * TAU + ph)];
// Classic heart curve, `size` wide, lobes toward -z (up the screen), point toward the camera.
const heartF = (cx, cz, size) => (t) => {
  const a = t * TAU, k = size / 32;
  const x = 16 * Math.sin(a) ** 3, y = 13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a);
  return [cx + x * k, cz - (y + 2.5) * k];
};
const starPts = (cx, cz, R, r) => Array.from({ length: 10 }, (_, i) => {
  const a = (i * Math.PI) / 5, q = i % 2 ? r : R;
  return [cx + q * Math.sin(a), cz - q * Math.cos(a)];
});
// Star outline as props: each corner plus each edge midpoint.
function starOutline(id, cx, cz, R, r, tint = 'cycle') {
  const v = starPts(cx, cz, R, r), out = [];
  v.forEach((p, i) => { const q = v[(i + 1) % 10]; out.push(p, [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]); });
  return out.map(([x, z], i) => at(id, x, z, tintOf(tint, i), 0));
}
// Archimedean spiral from radius r0 to r1 over `turns`.
const spiralF = (cx, cz, r0, r1, turns, a0 = 0) => (t) => { const a = a0 + t * turns * TAU, r = r0 + (r1 - r0) * t; return [cx + r * Math.cos(a), cz + r * Math.sin(a)]; };
// Filled heart on a square lattice; edge cells get `tintEdge`.
function heartFill(id, cx, cz, width, pitch, tintIn, tintEdge = tintIn) {
  const k = width / 2.3;
  const inside = (x, z) => { const u = (x - cx) / k, v = -(z - cz) / k, a = u * u + v * v - 1; return a * a * a - u * u * v * v * v <= 0; };
  const out = [], N = Math.ceil((1.2 * k) / pitch);
  for (let j = -N * 2; j <= N * 2; j++) for (let i = -N; i <= N; i++) {
    const x = cx + i * pitch, z = cz + j * pitch;
    if (!inside(x, z)) continue;
    const edge = !inside(x + pitch, z) || !inside(x - pitch, z) || !inside(x, z + pitch) || !inside(x, z - pitch);
    out.push(at(id, x, z, edge ? tintEdge : tintIn, 0));
  }
  return out;
}
// Heart outline of one prop filled with a smaller heart of another; fill keeps clear of the rim.
function heartPair(rimId, fillId, cx, cz, size, spacing, fillWidth, pitch, fillTint = 0, clear = 0.7) {
  const rim = path(rimId, heartF(cx, cz, size), spacing, 'cycle', { closed: true, minD: spacing * 0.92 });
  const fill = heartFill(fillId, cx, cz, fillWidth, pitch, fillTint).filter((f) => rim.every((r) => Math.hypot(r.x - f.x, r.z - f.z) >= clear));
  return [...rim, ...fill];
}
// Ring as `at` ops with a custom facing: rot = PI/2 - a + turn (turn 0 = outward, PI/2 = radial along local x).
function ringAt(id, cx, cz, n, r, tint = 'cycle', turn = 0, phase = 0) {
  return Array.from({ length: n }, (_, i) => { const a = phase + (i * TAU) / n; return at(id, cx + r * Math.cos(a), cz + r * Math.sin(a), tintOf(tint, i), Math.PI / 2 - a + turn); });
}
// Closed train: one prop id per slot, cars facing along the loop.
const loop = (ids, cx, cz, r, phase = 0) => ids.map((id, i) => {
  const a = phase + (i * TAU) / ids.length;
  return at(id, cx + r * Math.cos(a), cz + r * Math.sin(a), i, Math.PI / 2 - a);
});
// Rainbow: concentric half-circle arcs (upper half), one tint per band, blocks facing out.
function rainbow(id, cx, cz, r0, step, tints, spacing) {
  const out = [];
  tints.forEach((t, b) => {
    const r = r0 + b * step, n = Math.floor((Math.PI * r) / spacing) + 1;
    for (let i = 0; i < n; i++) { const a = Math.PI + (Math.PI * i) / (n - 1); out.push(at(id, cx + r * Math.cos(a), cz + r * Math.sin(a), t, Math.PI / 2 - a)); }
  });
  return out;
}
// Triangle rack (pointing toward the camera), rows of n, n-1, ... 1.
function rack(id, cx, z0, n, pitch, tint = 'cycle') {
  const out = []; let k = 0;
  for (let j = 0; j < n; j++) for (let i = 0; i < n - j; i++) out.push(at(id, cx + (i - (n - j - 1) / 2) * pitch, z0 + j * pitch * 0.866, tintOf(tint, k++), 0));
  return out;
}

// ------------------------------------------------------------------ levels
export const LEVELS = [
  // ======================================================== BAKERY
  {
    id: 1, name: 'Sprinkle Morning', world: 'bakery', arena: { w: 14, d: 20 }, time: 75, start: [0, 7.6],
    targets: [{ id: 'donut', n: 'all' }],
    place: [
      ...heartFill('donut', 0, -2.2, 6.9, 0.86, 0, 1),
      ring('cookie', 0, -7.6, 8, 1.05),
      at('macaron', 0, -7.6, 0),
      line('gumdrop', -5.7, -8.0, -5.7, 2.4, 7),
      line('gumdrop', 5.7, -8.0, 5.7, 2.4, 7),
      line('candy', -5.0, 4.3, 5.0, 4.3, 11),
      line('candy', -4.5, 5.25, 4.5, 5.25, 10),
      line('sprinkle', -5.2, 8.5, -2.2, 8.5, 5),
      line('sprinkle', 2.2, 8.5, 5.2, 8.5, 5),
    ],
  },
  {
    id: 2, name: 'Cupcake Parade', world: 'bakery', arena: { w: 14, d: 20 }, time: 80, start: [0, 7.6],
    targets: [{ id: 'cupcake', n: 'all' }],
    place: [
      ...[0, 1, 2, 3].map((j) => line('cupcake', -2.4, -6.2 + j * 1.15, 2.4, -6.2 + j * 1.15, 5, j)),
      ring('macaron', -4.5, -4.4, 8, 1.0), at('icecream', -4.5, -4.4, 0),
      ring('macaron', 4.5, -4.4, 8, 1.0), at('icecream', 4.5, -4.4, 1),
      line('icecream', -4.5, -8.4, 4.5, -8.4, 10),
      ...path('donut', arcF(0, -2.2, 4.3, 0.42, Math.PI - 0.42), 1.25),
      grid('candy', 0, 4.6, 8, 3, 0.72, 0.5),
      line('gumdrop', -5.6, 2.2, -5.6, 8.4, 6),
      line('gumdrop', 5.6, 2.2, 5.6, 8.4, 6),
    ],
  },
  {
    id: 3, name: 'Croissant Corner', world: 'bakery', arena: { w: 14, d: 20 }, time: 85, start: [0, 7.6],
    targets: [{ id: 'croissant', n: 'all' }],
    place: [
      grid('croissant', 0, -6.9, 4, 3, 1.15, 0.85),
      ring('macaron', -4.7, -7.4, 6, 0.8), at('gumdrop', -4.7, -7.4, 1),
      ring('macaron', 4.7, -7.4, 6, 0.8), at('gumdrop', 4.7, -7.4, 3),
      ring('cookie', 0, -0.7, 14, 2.6),
      ring('macaron', 0, -0.7, 7, 0.95), at('gumdrop', 0, -0.7, 0),
      line('donut', -5.5, -4.9, -5.5, 1.6, 6),
      line('donut', 5.5, -4.9, 5.5, 1.6, 6),
      line('gumdrop', -4.0, 3.55, 4.0, 3.55, 9),
      line('sprinkle', -4.5, 4.45, 4.5, 4.45, 10),
      line('candy', -5.0, 5.35, 5.0, 5.35, 11),
    ],
  },
  {
    id: 4, name: 'Sweet Shop', world: 'bakery', arena: { w: 18, d: 26 }, time: 120, start: [0, 10.8],
    targets: [{ id: 'cake', n: 'all' }, { id: 'cupcake', n: 8, tint: 0 }],
    place: [
      at('cake', 0, -2.0, 0), at('cake', -2.6, -4.6, 1), at('cake', 2.6, -4.6, 2), at('cake', -2.6, 0.6, 3), at('cake', 2.6, 0.6, 5),
      ring('cupcake', 0, -2.0, 9, 1.4),
      ...[0, 1, 4].map((t, j) => line('cupcake', -4.75, -8.6 - j, 4.75, -8.6 - j, 11, t)),
      line('icecream', -5.0, -11.65, 5.0, -11.65, 11),
      line('cakeslice', -7.0, -11.0, -7.0, 5.0, 13, 'cycle', 0),
      line('croissant', 7.0, -11.0, 7.0, 5.0, 17, 'cycle', 0),
      ring('donut', -4.6, 4.2, 7, 1.0), at('cookie', -4.6, 4.2, 0),
      ring('donut', 4.6, 4.2, 7, 1.0), at('cookie', 4.6, 4.2, 1),
      grid('macaron', 0, 3.6, 6, 3, 0.62, 0.62),
      grid('gumdrop', 0, 5.6, 10, 1, 0.6),
      line('icecream', -5.0, -7.2, -5.0, -1.6, 6),
      line('icecream', 5.0, -7.2, 5.0, -1.6, 6),
      grid('candy', 0, 7.4, 10, 3, 0.72, 0.48),
      line('gumdrop', -6.2, 9.6, -2.0, 9.6, 5),
      line('gumdrop', 2.0, 9.6, 6.2, 9.6, 5),
      line('macaron', -7.0, 11.6, -3.0, 11.6, 5),
      line('macaron', 3.0, 11.6, 7.0, 11.6, 5),
    ],
  },
  {
    id: 5, name: 'Gingerbread Lane', world: 'bakery', arena: { w: 24, d: 32 }, time: 240, start: [0, 13.8],
    targets: [{ id: 'gingerhouse', n: 'all' }, { id: 'lollipop', n: 'all' }],
    place: [
      at('gingerhouse', 0, -11.6, 0),
      line('gumdrop', -3.4, -9.25, 3.4, -9.25, 8),
      line('lollipop', -1.8, -7.9, -1.8, 8.6, 13, 'cycle', 0),
      line('lollipop', 1.8, -7.9, 1.8, 8.6, 13, 'cycle', 0),
      line('cookie', 0, -8.2, 0, 9.0, 16),
      grid('layercake', -7.3, -8.6, 2, 3, 3.1, 3.1),
      grid('layercake', 7.3, -8.6, 2, 3, 3.1, 3.1),
      grid('cake', -7.3, -1.4, 2, 2, 2.0, 1.9),
      grid('cake', 7.3, -1.4, 2, 2, 2.0, 1.9),
      grid('pie', -7.3, 2.8, 3, 2, 1.35, 1.35),
      grid('pie', 7.3, 2.8, 3, 2, 1.35, 1.35),
      grid('donut', -7.3, 7.6, 5, 4, 0.95, 0.95),
      grid('cupcake', 7.3, 7.6, 5, 4, 0.95, 0.95),
      grid('candy', 0, 11.2, 12, 2, 0.74, 0.5),
      line('sprinkle', -10.75, -14.6, -10.75, 14.6, 40),
      line('sprinkle', 10.75, -14.6, 10.75, 14.6, 40),
      line('icecream', -9.6, -14.6, -4.4, -14.6, 6),
      line('icecream', 4.4, -14.6, 9.6, -14.6, 6),
      line('macaron', -9.4, 12.6, -3.6, 12.6, 7),
      line('macaron', 3.6, 12.6, 9.4, 12.6, 7),
    ],
  },

  // ======================================================== PICNIC
  {
    id: 6, name: 'Berry Blanket', world: 'picnic', arena: { w: 18, d: 24 }, time: 120, start: [0, 9.8],
    targets: [{ id: 'strawberry', n: 'all' }, { id: 'apple', n: 8, tint: 0 }],
    place: [
      at('basket', 0, -0.6, 0),
      ring('cherry', 0, -0.6, 12, 1.75, 0),
      ring('strawberry', 0, -0.6, 20, 2.9),
      grid('apple', -4.1, -4.4, 3, 2, 0.85, 0.85, 0),
      grid('apple', 4.1, -4.4, 3, 2, 0.85, 0.85, 1),
      grid('apple', -4.1, 3.3, 3, 2, 0.85, 0.85, 2),
      grid('apple', 4.1, 3.3, 3, 2, 0.85, 0.85, 0),
      line('melonslice', -2.4, 4.85, 2.4, 4.85, 3),
      line('lemon', -7.0, -10.2, 7.0, -10.2, 13, 'cycle', 0),
      line('orange', -6.5, -8.5, 6.5, -8.5, 10),
      line('juicebox', -7.3, -6.4, -7.3, 6.4, 12, 'cycle', 0),
      line('cherry', 7.3, -6.4, 7.3, 6.4, 14, 'cycle', 0),
      line('grape', -6.3, -6.0, -6.3, 6.0, 20),
      line('grape', 6.3, -6.0, 6.3, 6.0, 20),
      line('apple', -4.8, 6.3, 4.8, 6.3, 8),
      line('grapes', -5.5, -6.9, 5.5, -6.9, 6, 'cycle', 0),
      grid('grape', 0, 7.6, 12, 2, 0.55, 0.55),
      line('lemon', -7.0, 9.6, -2.6, 9.6, 5, 'cycle', 0),
      line('lemon', 2.6, 9.6, 7.0, 9.6, 5, 'cycle', 0),
    ],
  },
  {
    id: 7, name: 'Fruit Salad', world: 'picnic', arena: { w: 20, d: 28 }, time: 140, start: [0, 11.8],
    targets: [{ id: 'banana', n: 'all' }, { id: 'grapes', n: 6, tint: 1 }],
    place: [
      at('watermelon', 0, -1.0, 0),
      ring('banana', 0, -1.0, 10, 2.0),
      ring('strawberry', 0, -1.0, 18, 3.0),
      ring('grape', 0, -1.0, 26, 3.75),
      grid('apple', -4.6, -4.8, 2, 2, 0.8, 0.8, 0),
      grid('orange', 4.6, -4.8, 2, 2, 0.8, 0.8),
      grid('lemon', -4.6, 2.8, 2, 2, 0.85, 0.62),
      grid('cherry', 4.6, 2.8, 2, 3, 0.7, 0.5, 0),
      line('grapes', -7.0, -10.9, 7.0, -10.9, 8, 1, 0),
      line('grapes', -6.0, -8.6, 6.0, -8.6, 7, 0, 0),
      line('banana', -8.2, -6.5, -8.2, 6.5, 13, 'cycle', 0),
      line('banana', 8.2, -6.5, 8.2, 6.5, 13, 'cycle', 0),
      line('lemon', -6.9, -6.0, -6.9, 6.0, 12, 'cycle', 0),
      line('lemon', 6.9, -6.0, 6.9, 6.0, 12, 'cycle', 0),
      grid('strawberry', 0, 5.0, 10, 2, 0.7, 0.7),
      line('cherry', -5.6, -6.9, 5.6, -6.9, 12, 'cycle', 0),
      line('juicebox', -6.0, 7.4, 6.0, 7.4, 11, 'cycle', 0),
      grid('cherry', 0, 9.2, 9, 2, 0.75, 0.55),
      line('orange', -7.2, 11.6, -2.4, 11.6, 5),
      line('orange', 2.4, 11.6, 7.2, 11.6, 5),
    ],
  },
  {
    id: 8, name: 'Sandwich Social', world: 'picnic', arena: { w: 20, d: 28 }, time: 150, start: [0, 11.8],
    targets: [{ id: 'sandwich', n: 'all' }, { id: 'juicebox', n: 6, tint: 2 }, { id: 'melonslice', n: 'all' }],
    place: [
      grid('sandwich', 0, -1.0, 4, 3, 1.3, 1.3),
      line('juicebox', -3.2, -2.6, -3.2, 0.6, 4, 'cycle', 0),
      line('juicebox', 3.2, -2.6, 3.2, 0.6, 4, 'cycle', 0),
      line('juicebox', -2.4, -3.6, 2.4, -3.6, 5, 2, 0),
      line('juicebox', -2.4, 1.6, 2.4, 1.6, 5, 2, 0),
      line('melonslice', -4.5, -5.0, 4.5, -5.0, 6, 'cycle', 0),
      line('melonslice', -4.5, 3.0, 4.5, 3.0, 6, 'cycle', Math.PI),
      grid('orange', -5.0, -1.0, 2, 3, 0.8, 0.8),
      grid('apple', 5.0, -1.0, 2, 3, 0.8, 0.8),
      line('blanketroll', -6.5, -10.6, 6.5, -10.6, 5, 'cycle', 0),
      line('basket', -6.0, -8.2, 6.0, -8.2, 4, 'cycle', 0),
      line('lemon', -8.3, -6.0, -8.3, 6.0, 12, 'cycle', 0),
      line('cherry', 8.4, -6.0, 8.4, 6.0, 14, 'cycle', 0),
      line('grape', -7.0, -6.0, -7.0, 6.0, 20),
      line('grape', 7.0, -6.0, 7.0, 6.0, 20),
      line('strawberry', -6.0, -6.45, 6.0, -6.45, 13),
      grid('cherry', 0, 4.9, 12, 2, 0.75, 0.6),
      line('orange', -6.0, 6.9, 6.0, 6.9, 9),
      grid('grape', 0, 9.0, 14, 2, 0.5, 0.5),
      line('strawberry', -7.4, 10.8, -2.4, 10.8, 6),
      line('strawberry', 2.4, 10.8, 7.4, 10.8, 6),
    ],
  },
  {
    id: 9, name: 'Melon Meadow', world: 'picnic', arena: { w: 22, d: 30 }, time: 170, start: [0, 12.8],
    targets: [{ id: 'watermelon', n: 'all' }, { id: 'cherry', n: 20, tint: 0 }],
    place: [
      at('watermelon', 0, -1.0, 1),
      ring('melonslice', 0, -1.0, 10, 2.4),
      ring('cherry', 0, -1.0, 18, 3.4, 0),
      ring('cherry', -4.7, 3.6, 6, 0.8, 0), at('strawberry', -4.7, 3.6, 0),
      ring('cherry', 4.7, 3.6, 6, 0.8, 0), at('strawberry', 4.7, 3.6, 1),
      grid('lemon', -4.5, -4.6, 2, 2, 0.85, 0.62),
      grid('orange', 4.5, -4.6, 2, 2, 0.8, 0.8),
      grid('watermelon', 0, -9.6, 4, 2, 2.3, 1.6),
      line('juicebox', -6.4, -12.8, 6.4, -12.8, 12, 'cycle', 0),
      line('strawberry', -9.0, -12.6, -9.0, 7.4, 17),
      line('strawberry', 9.0, -12.6, 9.0, 7.4, 17),
      grid('apple', -7.4, -2.2, 2, 6, 0.85, 0.85),
      grid('orange', 7.4, -2.2, 2, 6, 0.85, 0.85),
      line('cherry', -6.0, -7.0, 6.0, -7.0, 13, 'cycle', 0),
      line('grape', -5.95, -6.0, -5.95, 1.6, 12),
      line('grape', 5.95, -6.0, 5.95, 1.6, 12),
      line('strawberry', -3.0, 5.8, 3.0, 5.8, 7),
      line('banana', -5.0, 7.0, 5.0, 7.0, 9, 'cycle', 0),
      at('watermelon', -7.4, 8.8, 0), at('watermelon', 7.4, 8.8, 2),
      grid('juicebox', 0, 8.6, 10, 1, 0.6),
      grid('grape', 0, 10.2, 16, 2, 0.5, 0.5),
      line('cherry', -9.2, 11.8, -4.6, 11.8, 6, 'cycle', 0),
      line('cherry', 4.6, 11.8, 9.2, 11.8, 6, 'cycle', 0),
    ],
  },
  {
    id: 10, name: 'Market Day', world: 'picnic', arena: { w: 24, d: 32 }, time: 240, start: [0, 13.8],
    targets: [{ id: 'fruitcart', n: 'all' }, { id: 'basket', n: 'all' }],
    place: [
      at('fruitcart', 0, -12.2, 0),
      at('basket', -4.1, -12.2, 0), at('basket', 4.1, -12.2, 2),
      grid('grapes', -8.6, -12.6, 3, 2, 1.1, 1.1),
      grid('sandwich', 8.6, -12.6, 3, 2, 1.1, 1.1),
      line('melonslice', -8.6, -9.5, 8.6, -9.5, 8, 'cycle', 0),
      line('basket', -6.0, -7.4, 6.0, -7.4, 5, 'cycle', 0),
      grid('apple', -4.0, -3.4, 3, 3, 0.8, 0.8, 0), grid('orange', 0, -3.4, 3, 3, 0.8, 0.8), grid('lemon', 4.0, -3.4, 3, 3, 0.8, 0.8, 0),
      grid('apple', -4.0, 0.8, 3, 3, 0.8, 0.8, 1), grid('strawberry', 0, 0.8, 3, 3, 0.8, 0.8, 0), grid('cherry', 4.0, 0.8, 3, 3, 0.8, 0.8),
      line('juicebox', -10.4, -9.0, -10.4, 2.0, 10, 'cycle', 0),
      line('juicebox', 10.4, -9.0, 10.4, 2.0, 10, 'cycle', 0),
      at('watermelon', -7.6, -3.4, 0), at('watermelon', 7.6, -3.4, 2), at('watermelon', -7.6, 0.8, 1), at('watermelon', 7.6, 0.8, 0),
      line('watermelon', -8.6, 4.6, 8.6, 4.6, 6, 'cycle', 0),
      line('blanketroll', -8.4, 7.1, 8.4, 7.1, 6, 'cycle', 0),
      line('lemon', -6.0, 3.0, 6.0, 3.0, 11, 'cycle', 0),
      line('orange', -6.0, 8.25, 6.0, 8.25, 9),
      line('cherry', -9.3, -8.0, -9.3, 2.0, 11, 'cycle', 0),
      line('cherry', 9.3, -8.0, 9.3, 2.0, 11, 'cycle', 0),
      grid('cherry', 0, 9.4, 12, 2, 0.7, 0.5),
      grid('strawberry', -8.2, 11.0, 4, 4, 0.7, 0.7),
      grid('strawberry', 8.2, 11.0, 4, 4, 0.7, 0.7),
      grid('grape', 0, 11.4, 16, 2, 0.5, 0.5),
    ],
  },

  // ======================================================== PLAYROOM
  {
    id: 11, name: 'Rainbow Blocks', world: 'playroom', arena: { w: 20, d: 26 }, time: 140, start: [0, 10.8],
    targets: [{ id: 'block', n: 12, tint: 0 }, { id: 'toyball', n: 'all' }],
    place: [
      // red, orange, yellow, green, blue, purple from the outside in
      ...rainbow('block', 0, 1.5, 3.45, 0.75, [4, 1, 3, 2, 5, 0], 0.95),
      ring('toyball', -7.4, 4.0, 6, 0.95), at('toyball', -7.4, 4.0, 1),
      ring('toyball', 7.4, 4.0, 6, 0.95), at('toyball', 7.4, 4.0, 2),
      ring('stackrings', 0, 0.8, 6, 1.3), at('rocket', 0, 0.8, 0),
      line('robot', -6.0, -8.7, 6.0, -8.7, 7, 'cycle', 0),
      line('rocket', -7.5, -10.9, 7.5, -10.9, 11),
      grid('stackrings', -7.6, -6.0, 2, 3, 1.0, 1.0),
      grid('stackrings', 7.6, -6.0, 2, 3, 1.0, 1.0),
      grid('toycar', -6.0, 6.5, 2, 2, 1.15, 0.8, 'cycle', 0),
      grid('toycar', 6.0, 6.5, 2, 2, 1.15, 0.8, 'cycle', 0),
      grid('crayon', 0, 6.6, 6, 4, 1.0, 0.46),
      line('duck', -7.5, 8.7, -2.6, 8.7, 5, 'cycle', 0),
      line('duck', 2.6, 8.7, 7.5, 8.7, 5, 'cycle', 0),
      line('block', -8.0, 11.4, -2.4, 11.4, 7),
      line('block', 2.4, 11.4, 8.0, 11.4, 7),
    ],
  },
  {
    id: 12, name: 'Bubble Bath Ducks', world: 'playroom', arena: { w: 20, d: 28 }, time: 150, start: [0, 11.8],
    targets: [{ id: 'duck', n: 'all' }, { id: 'stackrings', n: 5, tint: 0 }],
    place: [
      line('duck', 0, 1.6, -6.4, -6.4, 9, 'cycle', 0),
      line('duck', 0.8, 0.6, 6.4, -6.4, 8, 'cycle', 0),
      ring('duck', 0, -9.4, 8, 2.0, 'cycle', 0), at('toyball', 0, -9.4, 1),
      grid('block', 0, -3.6, 5, 3, 0.75, 0.75),
      at('stackrings', -8.0, -12.0, 0), at('stackrings', 8.0, -12.0, 0), at('stackrings', -5.0, -12.0, 0), at('stackrings', 5.0, -12.0, 0),
      line('toycar', -6.4, -11.9, -3.4, -11.9, 2, 'cycle', 0), line('toycar', 3.4, -11.9, 6.4, -11.9, 2, 'cycle', 0),
      line('block', -8.4, -9.6, -8.4, 7.6, 18),
      line('block', 8.4, -9.6, 8.4, 7.6, 18),
      line('toyball', -6.6, -3.2, -6.6, 3.2, 6),
      line('toyball', 6.6, -3.2, 6.6, 3.2, 6),
      line('stackrings', -3.6, 4.4, 3.6, 4.4, 5),
      line('rocket', -6.0, 6.2, 6.0, 6.2, 9),
      grid('crayon', 0, 8.6, 5, 4, 1.0, 0.45),
      grid('crayon', -5.2, -9.0, 3, 4, 1.0, 0.46),
      grid('crayon', 5.2, -9.0, 3, 4, 1.0, 0.46),
      grid('block', -5.4, 8.1, 4, 2, 0.75, 0.75),
      grid('block', 5.4, 8.1, 4, 2, 0.75, 0.75),
      line('toyball', -7.4, 10.0, -3.4, 10.0, 5),
      line('toyball', 3.4, 10.0, 7.4, 10.0, 5),
      line('duck', -7.0, 12.2, -3.0, 12.2, 4, 'cycle', 0),
      line('duck', 3.0, 12.2, 7.0, 12.2, 4, 'cycle', 0),
    ],
  },
  {
    id: 13, name: 'Choo-Choo Loop', world: 'playroom', arena: { w: 22, d: 30 }, time: 170, start: [0, 12.8],
    targets: [{ id: 'traincar', n: 'all' }, { id: 'rocket', n: 5, tint: 1 }],
    place: [
      ...loop(['locomotive', ...Array(11).fill('traincar')], 0, -2.0, 4.4, -Math.PI / 2),
      ring('crayon', 0, -2.0, 20, 3.2),
      ring('crayon', 0, -2.0, 34, 5.6),
      ring('rocket', 0, -2.0, 7, 1.6), at('robot', 0, -2.0, 0),
      grid('block', 0, -10.2, 9, 2, 0.75, 0.75),
      line('rocket', -8.0, -12.6, 8.0, -12.6, 9, 1),
      grid('duck', -7.3, -9.9, 2, 2, 1.0, 1.1, 'cycle', 0),
      grid('duck', 7.3, -9.9, 2, 2, 1.0, 1.1, 'cycle', 0),
      grid('toycar', -8.3, -2.0, 2, 6, 1.1, 0.85, 'cycle', 0),
      grid('toycar', 8.3, -2.0, 2, 6, 1.1, 0.85, 'cycle', 0),
      grid('stackrings', 0, 6.2, 7, 1, 1.0),
      grid('rocket', -8.2, 3.6, 2, 3, 1.05, 1.05),
      grid('rocket', 8.2, 3.6, 2, 3, 1.05, 1.05),
      line('toyball', -8.6, 7.6, -4.2, 7.6, 5),
      line('toyball', 4.2, 7.6, 8.6, 7.6, 5),
      grid('crayon', 0, 9.6, 6, 3, 1.0, 0.45),
      line('block', -8.6, 11.8, -2.6, 11.8, 7),
      line('block', 2.6, 11.8, 8.6, 11.8, 7),
    ],
  },
  {
    id: 14, name: 'Teddy Tea Party', world: 'playroom', arena: { w: 24, d: 30 }, time: 180, start: [0, 12.8],
    targets: [{ id: 'teddy', n: 'all' }, { id: 'rockinghorse', n: 'all' }],
    place: [
      at('cake', 0, -2.0, 0),
      ring('cup', 0, -2.0, 8, 1.5),
      ring('teddy', 0, -2.0, 9, 3.0, 'cycle', 0),
      at('teapot', -7.0, -2.0, 1), ring('teddy', -7.0, -2.0, 5, 1.95, 'cycle', 0),
      at('teapot', 7.0, -2.0, 0), ring('teddy', 7.0, -2.0, 5, 1.95, 'cycle', 0),
      line('rockinghorse', -8.4, -11.6, 8.4, -11.6, 6, 'cycle', 0),
      grid('block', 0, -8.4, 12, 2, 0.75, 0.75),
      grid('robot', -8.6, -8.4, 2, 2, 1.15, 0.8, 'cycle', 0),
      grid('robot', 8.6, -8.4, 2, 2, 1.15, 0.8, 'cycle', 0),
      line('toycar', -10.4, -5.6, -10.4, 7.4, 11, 'cycle', Math.PI / 2),
      line('toycar', 10.4, -5.6, 10.4, 7.4, 11, 'cycle', -Math.PI / 2),
      grid('crayon', 0, 4.6, 8, 2, 1.0, 0.45),
      line('cup', -3.2, 2.8, 3.2, 2.8, 8),
      ring('toyball', -6.8, 4.8, 6, 1.0), at('block', -6.8, 4.8, 0),
      ring('toyball', 6.8, 4.8, 6, 1.0), at('block', 6.8, 4.8, 1),
      grid('stackrings', 0, 7.2, 6, 1, 1.0),
      grid('block', 0, 10.0, 10, 2, 0.75, 0.75),
      grid('duck', -7.6, 10.6, 3, 2, 1.0, 1.1, 'cycle', 0),
      grid('duck', 7.6, 10.6, 3, 2, 1.0, 1.1, 'cycle', 0),
    ],
  },
  {
    id: 15, name: 'Castle Keep', world: 'playroom', arena: { w: 26, d: 34 }, time: 240, start: [0, 14.8],
    targets: [{ id: 'playcastle', n: 'all' }, { id: 'dollhouse', n: 'all' }],
    place: [
      at('playcastle', 0, -12.8, 0),
      at('dollhouse', -7.0, -13.0, 0), at('dollhouse', 7.0, -13.0, 1), at('dollhouse', -9.4, -8.0, 2), at('dollhouse', 9.4, -8.0, 3),
      line('teddy', -1.5, -9.9, 1.5, -9.9, 3, 'cycle', 0),
      line('rockinghorse', -2.5, -8.2, -2.5, 6.4, 7, 'cycle', Math.PI / 2),
      line('rockinghorse', 2.5, -8.2, 2.5, 6.4, 7, 'cycle', Math.PI / 2),
      line('block', 0, -7.6, 0, 6.0, 16, 0),
      line('toyball', -7.6, -5.0, -7.6, 4.0, 8),
      line('toyball', 7.6, -5.0, 7.6, 4.0, 8),
      at('locomotive', -6.2, -4.6, 0, Math.PI / 2), line('traincar', -6.2, -2.8, -6.2, 4.4, 5, 'cycle', Math.PI / 2),
      at('locomotive', 6.2, -4.6, 1, Math.PI / 2), line('traincar', 6.2, -2.8, 6.2, 4.4, 5, 'cycle', Math.PI / 2),
      line('duck', -4.3, -6.0, -4.3, 6.0, 9, 'cycle', 0),
      line('duck', 4.3, -6.0, 4.3, 6.0, 9, 'cycle', 0),
      grid('block', -9.8, 0.8, 3, 8, 0.75, 0.75),
      grid('crayon', 9.8, 0.8, 2, 10, 1.0, 0.45),
      grid('toycar', -9.6, 7.2, 2, 3, 1.15, 0.8, 'cycle', 0),
      grid('toycar', 9.6, 7.2, 2, 3, 1.15, 0.8, 'cycle', 0),
      grid('stackrings', 0, 8.4, 6, 1, 1.0),
      line('robot', -10.4, 10.4, -4.4, 10.4, 5, 'cycle', 0),
      line('robot', 4.4, 10.4, 10.4, 10.4, 5, 'cycle', 0),
      grid('toyball', 0, 11.2, 7, 2, 0.95, 0.95),
      grid('block', -8.6, 13.6, 6, 3, 0.75, 0.75),
      grid('block', 8.6, 13.6, 6, 3, 0.75, 0.75),
    ],
  },

  // ======================================================== GARDEN
  {
    id: 16, name: 'Tulip Fields', world: 'garden', arena: { w: 22, d: 28 }, time: 160, start: [0, 11.8],
    targets: [{ id: 'tulip', n: 24, tint: 0 }, { id: 'mushroom', n: 'all' }],
    place: [
      // five colour bands, two rows each: red, pink, yellow, purple, orange
      ...[0, 1, 2, 3, 4].flatMap((t, b) => [0, 1].map((r) => line('tulip', -4.65, -11.6 + b * 1.8 + r * 0.62, 4.65, -11.6 + b * 1.8 + r * 0.62, 16, t))),
      line('hedge', -7.8, -11.6, -7.8, -3.2, 7),
      line('hedge', 7.8, -11.6, 7.8, -3.2, 7),
      ring('mushroom', -5.0, 2.4, 9, 1.6), at('gnome', -5.0, 2.4, 0),
      ring('mushroom', 5.0, 2.4, 9, 1.6), at('gnome', 5.0, 2.4, 1),
      ring('potplant', 0, 2.4, 6, 1.25), at('wateringcan', 0, 2.4, 0),
      ...path('daisy', waveF(-6.5, 6.5, -1.6, 0.6, 2), 0.72),
      line('birdhouse', -9.3, -0.6, -9.3, 9.4, 6, 'cycle', 0),
      line('birdhouse', 9.3, -0.6, 9.3, 9.4, 6, 'cycle', 0),
      grid('daisy', 0, 7.6, 12, 3, 0.75, 0.75),
      grid('gnome', -6.4, 10.8, 3, 2, 0.85, 0.85),
      grid('gnome', 6.4, 10.8, 3, 2, 0.85, 0.85),
    ],
  },
  {
    id: 17, name: 'Gnome Village', world: 'garden', arena: { w: 22, d: 30 }, time: 170, start: [0, 12.8],
    targets: [{ id: 'gnome', n: 'all' }, { id: 'birdhouse', n: 4, tint: 2 }],
    place: [
      at('gardenfountain', 0, -3.0, 0),
      ring('gnome', 0, -3.0, 12, 2.4, 'cycle', 0),
      ...[[-5.8, -8.2], [5.8, -8.2], [-5.8, 2.0], [5.8, 2.0]].flatMap(([x, z], i) => [at('pumpkin', x, z, i % 2 ? 2 : 0), ring('mushroom', x, z, 7, 1.15)]),
      line('birdhouse', -8.8, -12.5, 8.8, -12.5, 9, 'cycle', 0),
      line('hedge', -6.3, -10.9, 6.3, -10.9, 9),
      line('gnome', -3.6, -9.3, 3.6, -9.3, 7, 'cycle', 0),
      line('birdhouse', -9.3, -9.4, -9.3, 5.6, 6, 2, 0),
      line('birdhouse', 9.3, -9.4, 9.3, 5.6, 6, 2, 0),
      grid('tulip', -7.4, -3.6, 3, 6, 0.62, 0.62),
      grid('tulip', 7.4, -3.6, 3, 6, 0.62, 0.62),
      grid('tulip', 0, 3.6, 10, 2, 0.6, 0.6),
      line('daisy', -3.4, 1.6, 3.4, 1.6, 8),
      grid('tulip', 0, 7.6, 12, 1, 0.62),
      line('gnome', -4.2, 6.0, 4.2, 6.0, 8, 'cycle', 0),
      grid('potplant', -7.2, 8.2, 3, 2, 0.85, 0.85),
      grid('potplant', 7.2, 8.2, 3, 2, 0.85, 0.85),
      grid('daisy', 0, 9.6, 10, 2, 0.75, 0.75),
      grid('mushroom', -7.2, 11.6, 3, 2, 0.85, 0.85),
      grid('mushroom', 7.2, 11.6, 3, 2, 0.85, 0.85),
    ],
  },
  {
    id: 18, name: 'Pumpkin Patch', world: 'garden', arena: { w: 24, d: 30 }, time: 180, start: [0, 12.8],
    targets: [{ id: 'pumpkin', n: 'all' }, { id: 'wateringcan', n: 5, tint: 1 }],
    place: [
      grid('pumpkin', 0, -7.0, 6, 4, 1.4, 1.4),
      grid('daisy', 0, -7.0, 5, 3, 1.4, 1.4),
      grid('pumpkin', -8.6, -7.0, 2, 4, 1.4, 1.4),
      grid('pumpkin', 8.6, -7.0, 2, 4, 1.4, 1.4),
      line('wateringcan', -9.6, -12.4, 9.6, -12.4, 9, 'cycle', 0),
      at('wateringcan', -5.2, -2.6, 1), at('wateringcan', 5.2, -2.6, 1), at('wateringcan', 0, -2.6, 1),
      line('gnome', -3.6, -2.6, -1.6, -2.6, 3, 'cycle', 0), line('gnome', 1.6, -2.6, 3.6, -2.6, 3, 'cycle', 0),
      line('mushroom', -10.4, -3.2, -6.8, -3.2, 5), line('mushroom', 6.8, -3.2, 10.4, -3.2, 5),
      line('gardenbench', -7.5, 0.4, 7.5, 0.4, 4, 'cycle', 0),
      line('hedge', -9.6, 2.4, 9.6, 2.4, 13),
      line('mushroom', -9.6, 3.9, 9.6, 3.9, 16),
      grid('daisy', -10.0, 7.0, 2, 4, 0.75, 0.75),
      grid('daisy', 10.0, 7.0, 2, 4, 0.75, 0.75),
      ...path('tulip', spiralF(-5.6, 7.4, 0.55, 2.5, 2.1), 0.62),
      ...path('daisy', spiralF(5.6, 7.4, 0.6, 2.5, 1.9), 0.72),
      grid('mushroom', 0, 10.4, 6, 2, 0.85, 0.85),
      grid('potplant', 0, 6.4, 4, 2, 0.85, 0.85),
      grid('potplant', -9.6, 11.8, 2, 3, 0.85, 0.85),
      grid('potplant', 9.6, 11.8, 2, 3, 0.85, 0.85),
    ],
  },
  {
    id: 19, name: 'Hedge Maze', world: 'garden', arena: { w: 24, d: 32 }, time: 200, start: [0, 13.8],
    targets: [{ id: 'hedge', n: 'all' }, { id: 'gardenfountain', n: 'all' }],
    place: [
      at('gardenfountain', 0, -2.0, 0),
      ring('tulip', 0, -2.0, 12, 2.0),
      // inner wall (gap at the top) and outer wall (gap at the bottom)
      ...squareWall('hedge', 0, -2.0, 3.75, 1.25, 'top'),
      ...squareWall('hedge', 0, -2.0, 6.25, 1.25, 'bottom'),
      ...squareWall('daisy', 0, -2.0, 5.0, 1.25, 'none'),
      at('gardenfountain', -8.8, -12.6, 1), at('gardenfountain', 8.8, -12.6, 2),
      at('gardenfountain', -8.8, 6.6, 3), at('gardenfountain', 8.8, 6.6, 0),
      grid('potplant', 0, -11.8, 10, 2, 0.8, 0.8),
      grid('tulip', -8.8, -6.5, 4, 6, 0.62, 0.62),
      grid('tulip', 8.8, -6.5, 4, 6, 0.62, 0.62),
      grid('mushroom', -8.6, 2.0, 2, 6, 0.85, 0.85),
      grid('mushroom', 8.6, 2.0, 2, 6, 0.85, 0.85),
      grid('daisy', 0, 7.2, 14, 3, 0.75, 0.75),
      grid('gnome', -8.6, 10.6, 3, 2, 0.85, 0.85),
      grid('gnome', 8.6, 10.6, 3, 2, 0.85, 0.85),
      grid('tulip', 0, 10.6, 16, 2, 0.62, 0.62),
    ],
  },
  {
    id: 20, name: 'Gazebo Garden', world: 'garden', arena: { w: 26, d: 34 }, time: 240, start: [0, 14.8],
    targets: [{ id: 'gazebo', n: 'all' }, { id: 'gardenbench', n: 'all' }],
    place: [
      at('gazebo', 0, -10.6, 0),
      ring('potplant', 0, -10.6, 18, 3.5),
      ring('daisy', 0, -10.6, 24, 4.45),
      at('gardenbench', -6.6, -12.6, 0, 0), at('gardenbench', 6.6, -12.6, 1, 0),
      line('gardenbench', -3.0, -3.6, -3.0, 6.4, 5, 'cycle', Math.PI / 2),
      line('gardenbench', 3.0, -3.6, 3.0, 6.4, 5, 'cycle', -Math.PI / 2),
      line('tulip', -1.3, -5.2, -1.3, 7.4, 18),
      line('tulip', 1.3, -5.2, 1.3, 7.4, 18),
      grid('birdhouse', -10.6, -13.5, 2, 2, 1.0, 1.0),
      grid('birdhouse', 10.6, -13.5, 2, 2, 1.0, 1.0),
      grid('pumpkin', -9.6, -9.0, 2, 3, 1.2, 1.2),
      grid('pumpkin', 9.6, -9.0, 2, 3, 1.2, 1.2),
      grid('hedge', -9.5, -3.6, 2, 3, 1.3, 1.3),
      grid('hedge', 9.5, -3.6, 2, 3, 1.3, 1.3),
      at('gardenfountain', -7.0, 4.0, 1), ring('tulip', -7.0, 4.0, 14, 1.6),
      at('gardenfountain', 7.0, 4.0, 2), ring('tulip', 7.0, 4.0, 14, 1.6),
      line('mushroom', -4.3, -5.6, -4.3, 1.4, 7),
      line('mushroom', 4.3, -5.6, 4.3, 1.4, 7),
      grid('tulip', -6.4, -7.0, 3, 3, 0.62, 0.62),
      grid('tulip', 6.4, -7.0, 3, 3, 0.62, 0.62),
      grid('gnome', -9.8, 9.0, 2, 3, 0.85, 0.85),
      grid('gnome', 9.8, 9.0, 2, 3, 0.85, 0.85),
      grid('mushroom', 0, 9.2, 8, 1, 0.85),
      grid('potplant', -7.0, 12.6, 4, 3, 0.8, 0.8),
      grid('potplant', 7.0, 12.6, 4, 3, 0.8, 0.8),
      grid('daisy', 0, 11.6, 12, 2, 0.75, 0.75),
    ],
  },

  // ======================================================== BEACH
  {
    id: 21, name: 'Seashell Shore', world: 'beach', arena: { w: 22, d: 28 }, time: 160, start: [0, 11.8],
    targets: [{ id: 'shell', n: 'all' }, { id: 'starfish', n: 6, tint: 2 }],
    place: [
      line('parasol', -9.0, -12.2, 9.0, -12.2, 10),
      ...[-10.0, -7.8, -5.6].flatMap((z, k) => path('shell', waveF(-8.6, 8.6, z, 0.5, 2, k), 0.82)),
      ...starOutline('starfish', 0, 0.8, 4.2, 1.75),
      at('bucket', 0, 0.8, 0),
      grid('bucket', -8.2, 2.0, 2, 3, 0.9, 0.9),
      grid('spade', 8.0, 2.0, 1, 4, 1.0, 0.6, 'cycle', 0),
      line('crab', -8.0, 6.2, 8.0, 6.2, 9, 'cycle', 0),
      grid('starfish', 0, 9.2, 8, 2, 0.85, 0.85),
      grid('shell', -6.4, 9.6, 5, 3, 0.62, 0.5),
      grid('shell', 6.4, 9.6, 5, 3, 0.62, 0.5),
    ],
  },
  {
    id: 22, name: 'Sandy Pails', world: 'beach', arena: { w: 22, d: 30 }, time: 170, start: [0, 12.8],
    targets: [{ id: 'bucket', n: 'all' }, { id: 'spade', n: 6, tint: 0 }],
    place: [
      at('sandcastle', 0, -6.0, 0),
      ring('bucket', 0, -6.0, 12, 2.6),
      ...ringAt('spade', 0, -6.0, 16, 3.95, 'cycle', Math.PI / 2),
      grid('shell', -7.8, -11.6, 5, 4, 0.62, 0.5),
      grid('starfish', 7.8, -11.6, 4, 3, 0.85, 0.85),
      line('crab', -8.6, -8.4, -8.6, 0.0, 5, 'cycle', 0),
      line('beachball', 8.6, -8.4, 8.6, 0.0, 5),
      line('parasol', -4.8, -12.4, 4.8, -12.4, 7),
      line('starfish', -6.4, -8.4, -6.4, -0.6, 8),
      line('starfish', 6.4, -8.4, 6.4, -0.6, 8),
      line('spade', -3.6, 8.6, 3.6, 8.6, 4, 'cycle', 0),
      line('bucket', -8.5, 2.2, 8.5, 2.2, 10),
      line('spade', -6.0, 4.4, 6.0, 4.4, 7, 0, 0),
      line('lifering', -7.5, 5.8, 7.5, 5.8, 7),
      line('parasol', -9.0, 7.4, 9.0, 7.4, 10),
      grid('starfish', -6.5, 9.8, 3, 3, 0.85, 0.85),
      grid('starfish', 6.5, 9.8, 3, 3, 0.85, 0.85),
      grid('shell', 0, 10.2, 10, 2, 0.62, 0.5),
    ],
  },
  {
    id: 23, name: 'Crab Cove', world: 'beach', arena: { w: 24, d: 30 }, time: 180, start: [0, 12.8],
    targets: [{ id: 'crab', n: 'all' }, { id: 'beachball', n: 'all' }],
    place: [
      ...rack('beachball', 0, -11.4, 5, 1.36),
      ring('shell', -7.0, -9.6, 10, 1.3), at('starfish', -7.0, -9.6, 0),
      ring('shell', 7.0, -9.6, 10, 1.3), at('starfish', 7.0, -9.6, 1),
      line('parasol', -10.4, -13.4, -4.6, -13.4, 4), line('parasol', 4.6, -13.4, 10.4, -13.4, 4),
      line('lifering', -9.6, -5.4, -5.0, -5.4, 3), line('lifering', 5.0, -5.4, 9.6, -5.4, 3),
      ...path('crab', waveF(-9.4, 9.4, -1.6, 2.0, 1.0), 1.55, 'cycle', { face: 'side' }),
      grid('bucket', 0, 3.4, 7, 1, 1.0),
      at('sandcastle', -8.4, 5.2, 0), at('sandcastle', 8.4, 5.2, 1),
      grid('spade', 0, 5.4, 4, 2, 1.2, 0.6, 'cycle', 0),
      line('crab', -4.8, 7.6, 4.8, 7.6, 5, 'cycle', 0),
      grid('shell', -5.6, 4.6, 3, 4, 0.62, 0.5),
      grid('shell', 5.6, 4.6, 3, 4, 0.62, 0.5),
      grid('starfish', 0, 9.6, 9, 2, 0.85, 0.85),
      grid('shell', -7.4, 9.8, 5, 4, 0.62, 0.5),
      grid('shell', 7.4, 9.8, 5, 4, 0.62, 0.5),
    ],
  },
  {
    id: 24, name: "Surf's Up", world: 'beach', arena: { w: 24, d: 32 }, time: 200, start: [0, 13.8],
    targets: [{ id: 'surfboard', n: 'all' }, { id: 'lifering', n: 6, tint: 0 }],
    place: [
      line('surfboard', -8.4, -11.8, 8.4, -11.8, 7, 'cycle', Math.PI / 2),
      line('surfboard', -7.0, -8.6, 7.0, -8.6, 6, 'cycle', Math.PI / 2),
      grid('shell', -9.9, -13.6, 3, 3, 0.62, 0.5),
      grid('shell', 9.9, -13.6, 3, 3, 0.62, 0.5),
      line('beachball', -10.0, -9.0, -10.0, -2.0, 4),
      line('beachball', 10.0, -9.0, 10.0, -2.0, 4),
      line('lifering', -8.4, -5.4, 8.4, -5.4, 7),
      line('deckchair', -7.5, -1.6, 7.5, -1.6, 6, 'cycle', 0),
      line('parasol', -6.0, -1.6, 6.0, -1.6, 5),
      line('lifering', -6.0, 2.2, 6.0, 2.2, 5, 0),
      at('sandcastle', -7.8, 5.6, 2), at('sandcastle', 7.8, 5.6, 3),
      line('starfish', -6.0, 3.65, 6.0, 3.65, 8),
      grid('crab', -9.6, 1.2, 1, 3, 1.0, 0.85, 'cycle', 0),
      grid('crab', 9.6, 1.2, 1, 3, 1.0, 0.85, 'cycle', 0),
      grid('bucket', 0, 5.4, 6, 2, 1.0, 1.0),
      ...path('shell', waveF(-9.6, 9.6, 8.0, 0.35, 2), 0.78),
      grid('shell', 0, 9.8, 12, 2, 0.62, 0.5),
      grid('crab', -7.8, 10.6, 2, 3, 1.1, 0.8, 'cycle', 0),
      grid('crab', 7.8, 10.6, 2, 3, 1.1, 0.8, 'cycle', 0),
      grid('starfish', 0, 11.6, 8, 1, 0.85),
    ],
  },
  {
    id: 25, name: 'Lifeguard Lookout', world: 'beach', arena: { w: 26, d: 34 }, time: 240, start: [0, 14.8],
    targets: [{ id: 'lifeguard', n: 'all' }, { id: 'sandcastle', n: 'all' }],
    place: [
      at('lifeguard', 0, -12.8, 0),
      at('sandcastle', -6.2, -12.6, 0), at('sandcastle', 6.2, -12.6, 1),
      at('sandcastle', -9.4, 0.6, 2), at('sandcastle', 9.4, 0.6, 3),
      grid('starfish', -10.0, -14.4, 3, 2, 0.85, 0.85), grid('starfish', 10.0, -14.4, 3, 2, 0.85, 0.85),
      ring('lifering', 0, -4.4, 10, 3.4),
      ring('beachball', 0, -4.4, 6, 1.36), at('beachball', 0, -4.4, 0),
      line('surfboard', -10.6, -9.4, -10.6, -3.0, 3, 'cycle', Math.PI / 2),
      line('surfboard', -8.8, -9.4, -8.8, -3.0, 3, 'cycle', Math.PI / 2),
      line('surfboard', 8.8, -9.4, 8.8, -3.0, 3, 'cycle', Math.PI / 2),
      line('surfboard', 10.6, -9.4, 10.6, -3.0, 3, 'cycle', Math.PI / 2),
      grid('deckchair', 0, 3.4, 6, 1, 2.0, 2.0, 'cycle', 0),
      line('parasol', -4.0, 3.4, 4.0, 3.4, 5),
      line('crab', -9.5, 6.4, 9.5, 6.4, 9, 'cycle', 0),
      line('shell', -6.0, 1.2, 6.0, 1.2, 15),
      grid('starfish', -6.4, -5.0, 2, 5, 0.9, 0.9),
      grid('starfish', 6.4, -5.0, 2, 5, 0.9, 0.9),
      grid('starfish', 0.3, 9.0, 3, 2, 0.85, 0.85),
      grid('bucket', -8.6, 3.8, 3, 2, 0.95, 0.95),
      grid('bucket', 8.6, 3.8, 3, 2, 0.95, 0.95),
      grid('bucket', -5.0, 9.0, 6, 2, 1.0, 1.0),
      grid('spade', 5.0, 9.0, 3, 3, 1.4, 0.6, 'cycle', 0),
      grid('starfish', -9.6, 12.0, 3, 3, 0.85, 0.85),
      grid('starfish', 9.6, 12.0, 3, 3, 0.85, 0.85),
      grid('shell', 0, 12.0, 12, 2, 0.62, 0.5),
    ],
  },

  // ======================================================== KITCHEN
  {
    id: 26, name: 'Tea for Two', world: 'kitchen', arena: { w: 22, d: 28 }, time: 160, start: [0, 11.8],
    targets: [{ id: 'cup', n: 'all' }, { id: 'teapot', n: 3, tint: 1 }],
    place: [
      line('teapot', -6.0, -10.6, 6.0, -10.6, 5, 'cycle', 0),
      grid('bottle', 0, -7.8, 14, 2, 0.55, 0.55),
      grid('jar', -6.2, -7.0, 3, 3, 0.7, 0.7),
      grid('jar', 6.2, -7.0, 3, 3, 0.7, 0.7),
      at('teapot', -2.5, -3.6, 1), ring('cup', -2.5, -3.6, 7, 1.5),
      at('teapot', 2.5, -3.6, 1), ring('cup', 2.5, -3.6, 7, 1.5),
      line('platestack', -8.6, -11.0, -8.6, 5.0, 12),
      line('platestack', 8.6, -11.0, 8.6, 5.0, 12),
      ...heartPair('cup', 'jar', 0, 3.9, 6.8, 0.8, 4.6, 0.66),
      grid('mug', -6.3, -2.2, 2, 4, 0.9, 0.75, 'cycle', 0),
      grid('mug', 6.3, -2.2, 2, 4, 0.9, 0.75, 'cycle', 0),
      grid('jar', -6.2, 2.6, 3, 3, 0.7, 0.7),
      grid('jar', 6.2, 2.6, 3, 3, 0.7, 0.7),
      grid('bottle', -6.0, 6.2, 4, 2, 0.52, 0.52),
      grid('bottle', 6.0, 6.2, 4, 2, 0.52, 0.52),
      grid('cup', -6.4, 9.6, 3, 3, 0.75, 0.75),
      grid('cup', 6.4, 9.6, 3, 3, 0.75, 0.75),
      grid('mug', 0, 9.4, 6, 2, 0.85, 0.65, 'cycle', 0),
    ],
  },
  {
    id: 27, name: 'Breakfast Nook', world: 'kitchen', arena: { w: 24, d: 30 }, time: 180, start: [0, 12.8],
    targets: [{ id: 'toaster', n: 'all' }, { id: 'mug', n: 8, tint: 0 }],
    place: [
      line('toaster', -9.0, -11.8, 9.0, -11.8, 10, 'cycle', 0),
      grid('jar', 0, -9.6, 12, 2, 0.7, 0.7),
      ...[[-4.0, -6.2], [4.0, -6.2], [-4.0, -1.2], [4.0, -1.2]].flatMap(([x, z], i) => [at('platestack', x, z, i), ring('cup', x, z, 6, 1.1)]),
      at('fruitbowl', 0, -3.7, 0),
      at('teapot', 0, -6.4, 2), at('teapot', 0, -1.0, 3),
      grid('jar', -7.6, -3.7, 3, 6, 0.75, 0.75),
      grid('jar', 7.6, -3.7, 3, 6, 0.75, 0.75),
      grid('cup', 0, 5.6, 8, 1, 0.8),
      line('toaster', -10.2, -8.0, -10.2, 2.0, 6, 'cycle', Math.PI / 2),
      line('toaster', 10.2, -8.0, 10.2, 2.0, 6, 'cycle', Math.PI / 2),
      ...[0, 1, 2].map((t, j) => line('mug', -4.5, 2.6 + j * 0.8, 4.5, 2.6 + j * 0.8, 8, t, 0)),
      grid('bottle', -8.0, 4.0, 3, 4, 0.52, 0.52),
      grid('bottle', 8.0, 4.0, 3, 4, 0.52, 0.52),
      line('pan', -7.5, 7.2, 7.5, 7.2, 5, 'cycle', 0),
      grid('cup', 0, 10.0, 8, 2, 0.8, 0.8),
      grid('bottle', -7.5, 10.4, 5, 3, 0.52, 0.52),
      grid('bottle', 7.5, 10.4, 5, 3, 0.52, 0.52),
    ],
  },
  {
    id: 28, name: 'Jam Session', world: 'kitchen', arena: { w: 24, d: 32 }, time: 200, start: [0, 13.8],
    targets: [{ id: 'jar', n: 'all' }, { id: 'bottle', n: 10, tint: 0 }, { id: 'fruitbowl', n: 'all' }],
    place: [
      ...[0, 1, 2, 3].map((t, j) => line('jar', -6.5, -12.6 + j, 6.5, -12.6 + j, 14, t)),
      grid('platestack', -9.6, -11.0, 2, 4, 1.0, 1.0),
      grid('platestack', 9.6, -11.0, 2, 4, 1.0, 1.0),
      grid('bottle', -7.5, -7.2, 5, 3, 0.52, 0.52, 0),
      grid('bottle', 7.5, -7.2, 5, 3, 0.52, 0.52, 2),
      at('mixer', 0, -2.8, 0), ring('fruitbowl', 0, -2.8, 6, 2.2),
      at('fruitbowl', -7.5, -2.8, 1), at('fruitbowl', 7.5, -2.8, 2),
      grid('cup', -9.8, -2.0, 2, 4, 0.8, 0.8),
      grid('cup', 9.8, -2.0, 2, 4, 0.8, 0.8),
      grid('bottle', 0, 10.25, 12, 1, 0.52),
      line('toaster', -8.0, 2.4, 8.0, 2.4, 5, 'cycle', 0),
      ...heartFill('strawberry', 0, 6.6, 5.4, 0.62, 0, 1),
      grid('cup', -7.2, 7.0, 3, 4, 0.8, 0.8),
      grid('mug', 7.2, 7.0, 2, 4, 0.9, 0.8, 'cycle', 0),
      grid('jar', 0, 11.6, 8, 1, 0.7),
      grid('cup', -7.0, 11.6, 4, 3, 0.8, 0.8),
      grid('cup', 7.0, 11.6, 4, 3, 0.8, 0.8),
    ],
  },
  {
    id: 29, name: 'Sunday Brunch', world: 'kitchen', arena: { w: 26, d: 34 }, time: 220, start: [0, 14.8],
    targets: [{ id: 'pan', n: 'all' }, { id: 'mixer', n: 3, tint: 3 }, { id: 'teapot', n: 'all' }],
    place: [
      line('mixer', -10.0, -14.6, 10.0, -14.6, 9, 'cycle', 0),
      at('fridge', 0, -9.0, 0),
      ...ringAt('pan', 0, -9.0, 12, 3.05, 'cycle', Math.PI / 2),
      at('mixer', -7.6, -9.4, 3), at('mixer', 7.6, -9.4, 3),
      grid('jar', -9.6, -11.8, 3, 2, 0.75, 0.75), grid('jar', 9.6, -11.8, 3, 2, 0.75, 0.75),
      grid('teapot', -8.4, -4.0, 2, 3, 1.6, 1.1, 'cycle', 0),
      grid('teapot', 8.4, -4.0, 2, 3, 1.6, 1.1, 'cycle', 0),
      grid('platestack', 0, -1.6, 5, 2, 1.0, 1.0),
      ring('cup', -4.6, 2.4, 7, 1.15), at('mug', -4.6, 2.4, 0),
      ring('cup', 4.6, 2.4, 7, 1.15), at('mug', 4.6, 2.4, 1),
      at('fruitbowl', 0, 2.4, 0),
      grid('jar', -7.75, 2.4, 3, 4, 0.75, 0.75),
      grid('jar', 7.75, 2.4, 3, 4, 0.75, 0.75),
      line('cup', -3.0, -3.9, 3.0, -3.9, 7),
      line('toaster', -9.0, 6.0, 9.0, 6.0, 7, 'cycle', 0),
      grid('bottle', -10.2, 2.2, 3, 4, 0.52, 0.52),
      grid('bottle', 10.2, 2.2, 3, 4, 0.52, 0.52),
      grid('mug', 0, 8.6, 8, 2, 0.85, 0.65, 'cycle', 0),
      grid('cup', -8.4, 9.8, 4, 3, 0.8, 0.8),
      grid('cup', 8.4, 9.8, 4, 3, 0.8, 0.8),
      grid('bottle', 0, 11.4, 14, 2, 0.52, 0.52),
      grid('jar', -6.0, 13.4, 6, 2, 0.7, 0.7),
      grid('jar', 6.0, 13.4, 6, 2, 0.7, 0.7),
    ],
  },
  {
    id: 30, name: 'Grand Kitchen', world: 'kitchen', arena: { w: 28, d: 36 }, time: 300, start: [0, 15.8],
    targets: [{ id: 'stove', n: 'all' }, { id: 'fridge', n: 'all' }, { id: 'cup', n: 'all' }],
    place: [
      at('stove', 0, -14.6, 0),
      at('fridge', -6.4, -14.6, 1), at('fridge', 6.4, -14.6, 3),
      line('mixer', -12.0, -15.6, -9.2, -15.6, 3, 'cycle', 0), line('mixer', 9.2, -15.6, 12.0, -15.6, 3, 'cycle', 0),
      line('teapot', -10.0, -11.2, 10.0, -11.2, 8, 'cycle', 0),
      // a heart of teacups, pink with a lilac border
      ...heartFill('cup', 0, -3.0, 9.0, 0.78, 0, 4),
      line('pan', -11.6, -8.6, -11.6, 4.6, 5, 'cycle', Math.PI / 2),
      line('pan', 11.6, -8.6, 11.6, 4.6, 5, 'cycle', -Math.PI / 2),
      grid('toaster', -8.0, -6.6, 2, 3, 1.2, 1.0, 'cycle', 0),
      grid('toaster', 8.0, -6.6, 2, 3, 1.2, 1.0, 'cycle', 0),
      grid('fruitbowl', -8.0, 1.2, 2, 2, 1.5, 1.5),
      grid('fruitbowl', 8.0, 1.2, 2, 2, 1.5, 1.5),
      line('platestack', -6.0, 3.8, 6.0, 3.8, 10),
      grid('mug', 0, 6.0, 10, 2, 0.85, 0.65, 'cycle', 0),
      grid('jar', -9.4, 6.6, 4, 3, 0.7, 0.7),
      grid('jar', 9.4, 6.6, 4, 3, 0.7, 0.7),
      line('teapot', -9.0, 9.4, 9.0, 9.4, 7, 'cycle', 0),
      grid('bottle', 0, 11.6, 18, 2, 0.52, 0.52),
      grid('bottle', -9.8, 12.6, 5, 4, 0.52, 0.52),
      grid('bottle', 9.8, 12.6, 5, 4, 0.52, 0.52),
      grid('jar', 0, 13.4, 10, 1, 0.7),
    ],
  },
];

// Square ring of props (hedge walls, flower borders) with an optional one-slot gap.
function squareWall(id, cx, cz, half, pitch, gap) {
  const n = Math.round((2 * half) / pitch), out = [], seen = new Set();
  for (let i = 0; i <= n; i++) {
    const t = -half + i * pitch;
    for (const [x, z, side] of [[t, -half, 'top'], [t, half, 'bottom'], [-half, t, 'left'], [half, t, 'right']]) {
      const key = `${x.toFixed(2)},${z.toFixed(2)}`;
      if (seen.has(key)) continue; seen.add(key);
      if (side === gap && Math.abs(x) < 1e-6) continue;
      out.push(at(id, cx + x, cz + z, out.length, 0));
    }
  }
  return out;
}
