// Gulp Season 7: GRAND FINALE. 15 levels, ids 106-120, 5 per world (pizza, dino,
// castle). Amanda has beaten every board so far, so this season stacks every hardening
// idea from Seasons 3-6 on the same boards:
//   - look-alike tints: the target color sits next to a near twin (cream vs ivory dough,
//     pink vs peach eggs, ruby vs rose gems), laid out in diagonal color runs,
//   - opposite-corner routing: targets split across far corners, so she must plan a route,
//   - two-stage growth gates: a medium target that needs half the board, then a big one
//     that needs most of it,
//   - precision tiny targets: little targets tucked between big decoys of the same kind,
//   - scarce filler: some boards carry only just enough food (checker margin 1.3),
//   - four target types on most boards.
// Level 120 is the last level of the game: the biggest centerpiece, needing nearly the
// whole board. Every board stays fair: tools/check_levels.mjs (30% spare food at
// CHALLENGE growth) and tools/validate_cli.mjs (careful bot + erratic driver) must pass.
// Same op semantics and helpers as levels_wave3.js (copied so this file stands alone).
const TAU = Math.PI * 2, PI = Math.PI;
const r3 = (v) => Math.round(v * 1000) / 1000;

// ------------------------------------------------------------------ plain ops
const at = (id, x, z, tint = 0, rot = 0) => ({ op: 'at', id, x: r3(x), z: r3(z), tint, rot: r3(rot) });
const tintOf = (tint, i) => (Array.isArray(tint) ? tint[i % tint.length] : typeof tint === 'number' ? tint : i);
function grid(id, x, z, cols, rows, gx, gz = gx, tint = 'cycle', rot) {
  if (Array.isArray(tint)) {
    const out = [];
    for (let r = 0, i = 0; r < rows; r++) for (let c = 0; c < cols; c++, i++) out.push(at(id, x + (c - (cols - 1) / 2) * gx, z + (r - (rows - 1) / 2) * gz, tintOf(tint, i), rot ?? 0));
    return out;
  }
  const o = { op: 'grid', id, x, z, cols, rows, gap: gx, tint };
  if (gz !== gx) { o.gapX = gx; o.gapZ = gz; }
  if (rot !== undefined) o.rot = rot;
  return o;
}
function ring(id, x, z, n, r, tint = 'cycle', rot) {
  if (Array.isArray(tint)) return Array.from({ length: n }, (_, i) => { const a = (i / n) * TAU; return at(id, x + Math.cos(a) * r, z + Math.sin(a) * r, tintOf(tint, i), rot ?? PI / 2 - a); });
  return { op: 'ring', id, x, z, n, r, tint, ...(rot !== undefined ? { rot } : {}) };
}
function line(id, x0, z0, x1, z1, n, tint = 'cycle', rot) {
  if (Array.isArray(tint)) return Array.from({ length: n }, (_, i) => { const t = n === 1 ? 0.5 : i / (n - 1); return at(id, x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, tintOf(tint, i), rot ?? 0); });
  return { op: 'line', id, x0, z0, x1, z1, n, tint, ...(rot !== undefined ? { rot } : {}) };
}

// ------------------------------------------------------------------ patterns -> `at` ops
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
function samples(f, spacing, closed = false) {
  const L = curveLen(f), n = closed ? Math.floor(L / spacing) : Math.floor(L / spacing) + 1;
  return along(f, n, closed);
}
// Props along a curve. face: 'cam' (rot 0), 'along' (local +z along the curve), 'side' (local +x along it).
function path(id, f, spacing, tint = 'cycle', { closed = false, face = 'cam' } = {}) {
  return samples(f, spacing, closed).map(([x, z, h], i) => at(id, x, z, tintOf(tint, i), face === 'along' ? h : face === 'side' ? h - PI / 2 : 0));
}
const arcF = (cx, cz, r, a0, a1) => (t) => { const a = a0 + (a1 - a0) * t; return [cx + r * Math.cos(a), cz + r * Math.sin(a)]; };
const waveF = (x0, x1, z, amp, waves, ph = 0) => (t) => [x0 + (x1 - x0) * t, z + amp * Math.sin(t * waves * TAU + ph)];
const vwaveF = (z0, z1, x, amp, waves, ph = 0) => (t) => [x + amp * Math.sin(t * waves * TAU + ph), z0 + (z1 - z0) * t];
const spiralF = (cx, cz, r0, r1, turns, a0 = 0) => (t) => { const a = a0 + t * turns * TAU, r = r0 + (r1 - r0) * t; return [cx + r * Math.cos(a), cz + r * Math.sin(a)]; };
// Closed polyline through pts (each segment gets an equal share of t; samples() evens it out).
const polyF = (pts) => (t) => {
  const n = pts.length, u = (((t % 1) + 1) % 1) * n, i = Math.min(n - 1, Math.floor(u)), f = u - i, a = pts[i], b = pts[(i + 1) % n];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
};
// Open polyline (constellations).
const openF = (pts) => (t) => {
  const n = pts.length - 1, u = Math.min(0.999999, Math.max(0, t)) * n, i = Math.floor(u), f = u - i, a = pts[i], b = pts[i + 1];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
};
// Five-point star outline (point up the screen) as polyline vertices.
const starOutline = (cx, cz, R, r) => Array.from({ length: 10 }, (_, i) => { const a = -PI / 2 + (i * PI) / 5, rr = i % 2 ? r : R; return [cx + rr * Math.cos(a), cz + rr * Math.sin(a)]; });
// Props along a star outline, edge by edge: one on each sharp tip, then the edges start
// `tipGap` away from the tips so the two sides of a tip never crowd each other.
function starTrace(id, verts, spacing, tints, tipGap = 0.95) {
  const out = [];
  let k = 0;
  for (let i = 0; i < verts.length; i++) {
    const a = verts[i], b = verts[(i + 1) % verts.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (i % 2 === 0) out.push(at(id, a[0], a[1], tintOf(tints, k++), 0));
    const s0 = i % 2 === 0 ? tipGap : 0, s1 = i % 2 === 0 ? L - spacing : L - tipGap;
    const n = Math.floor((s1 - s0) / spacing) + 1, step = n > 1 ? (s1 - s0) / (n - 1) : 0;
    for (let j = 0; j < n; j++) { const t = (s0 + j * step) / L; out.push(at(id, a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, tintOf(tints, k++), 0)); }
  }
  return out;
}
// Ring facing the camera (rot 0) - characters smile at her.
const ringCam = (id, cx, cz, n, r, tint = 'cycle', phase = 0) =>
  Array.from({ length: n }, (_, i) => { const a = phase + (i * TAU) / n; return at(id, cx + r * Math.cos(a), cz + r * Math.sin(a), tintOf(tint, i), 0); });
// Rainbow: concentric half-circle arcs over the top (-z), one tint per band (innermost first).
function rainbow(id, cx, cz, r0, step, tints, spacing, rot) {
  const out = [];
  tints.forEach((t, b) => {
    const r = r0 + b * step, n = Math.floor((PI * r) / spacing) + 1;
    for (let i = 0; i < n; i++) { const a = PI + (PI * i) / (n - 1); out.push(at(id, cx + r * Math.cos(a), cz + r * Math.sin(a), t, rot ?? PI / 2 - a)); }
  });
  return out;
}
// Grid whose tint runs across the columns (a color gradient, left to right).
function gradient(id, cx, cz, cols, rows, gx, gz, tints, rot = 0) {
  const out = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    out.push(at(id, cx + (c - (cols - 1) / 2) * gx, cz + (r - (rows - 1) / 2) * gz, tints[Math.min(tints.length - 1, Math.floor((c * tints.length) / cols))], rot));
  }
  return out;
}
// Grid with each row's colors shifted by one (diagonal color runs: a target color never
// lines up in one column, so she has to look for it).
function diag(id, cx, cz, cols, rows, gx, gz, tints, rot = 0, shift = 1) {
  const out = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out.push(at(id, cx + (c - (cols - 1) / 2) * gx, cz + (r - (rows - 1) / 2) * gz, tints[(c + r * shift) % tints.length], rot));
  return out;
}
// Rectangular fence of props around a box (long props run along each side).
function fence(id, cx, cz, w, d, nx, nz, { tint = 'cycle', gapTop = 0, gapBottom = 0, along = true } = {}) {
  const out = [];
  let k = 0;
  for (const [z, gap] of [[cz - d / 2, gapTop], [cz + d / 2, gapBottom]]) for (let i = 0; i < nx; i++) {
    const x = cx - w / 2 + (w * i) / (nx - 1);
    if (gap && Math.abs(x - cx) < gap / 2) continue;
    out.push(at(id, x, z, tintOf(tint, k++), 0));
  }
  for (const s of [-1, 1]) for (let j = 1; j <= nz; j++) out.push(at(id, cx + (s * w) / 2, cz - d / 2 + (d * j) / (nz + 1), tintOf(tint, k++), along ? PI / 2 : 0));
  return out;
}


// ------------------------------------------------------------------ tint names (for reading)
// pepperoni: 0 red, 1 orange, 2 pink, 3 brown, 4 maroon      olive: 0 black, 1 green, 2 purple, 3 drab
// mushslice: 0 white, 1 tan, 2 brown, 3 pink                 basil: 0 green, 1 light, 2 dark, 3 lime
// cheese / cheesewheel: 0 yellow, 1 orange, 2 cream, 3 pale  doughball: 0 cream, 1 golden, 2 ivory, 3 brown
// tomato: 0 red, 1 orange, 2 yellow, 3 green                 sodacup: 0 red, 1 blue, 2 green, 3 purple, 4 orange
// pizzaslice / wholepizza: 0 pepperoni, 1 pepper, 2 mushroom, 3 pineapple, 4 olive
// rollingpin: 0 pink, 1 blue, 2 mint, 3 yellow, 4 lilac     pizzabox: 0 red, 1 blue, 2 green, 3 yellow
// scooter: 0 red, 1 blue, 2 green, 3 yellow, 4 pink         pizzaoven: 0 brick, 1 rose, 2 sand, 3 slate
// dinoegg / bigegg / nest: 0 mint, 1 pink, 2 blue, 3 yellow, 4 lilac, 5 peach, 6 white
// babydino / stego / longneck: 0 green, 1 blue, 2 pink, 3 orange, 4 purple, 5 yellow
// toybone: 0 ivory, 1 cream, 2 blush, 3 ice               ammonite: 0 tan, 1 stone, 2 coral, 3 slate
// brush / sandbucket: 0 red, 1 blue, 2 yellow, 3 green, 4 purple    shovel / digcart: 0 red, 1 blue, 2 yellow, 3 green, 4 purple
// fossiltile: 0 sand, 1 lilac, 2 coral, 3 sage   sandpile: 0 gold, 1 peach, 2 pale   digtent: 0 red, 1 blue, 2 green, 3 orange
// gem / biggem: 0 ruby, 1 sapphire, 2 emerald, 3 topaz, 4 amethyst, 5 rose, 6 aqua
// crown: 0 gold, 1 silver, 2 rose gold, 3 pink, 4 lilac      wand: 0 yellow, 1 pink, 2 blue, 3 purple, 4 green
// tinyshield: 0 red, 1 blue, 2 green, 3 purple, 4 orange      potion: 0 pink, 1 blue, 2 green, 3 purple, 4 orange
// toyknight: 0 red, 1 blue, 2 green, 3 purple, 4 orange       chest: 0 red, 1 blue, 2 green, 3 purple, 4 orange
// towerblock / carriage / fairytower / gatehouse: 0 pink, 1 lilac, 2 mint, 3 sky, 4 butter
// throne: 0 pink, 1 blue, 2 mint, 3 purple, 4 coral   dragonplush: 0 green, 1 purple, 2 pink, 3 blue, 4 orange
const PASTEL5 = [0, 1, 2, 3, 4], P5 = [0, 1, 2, 3, 4], P4 = [0, 1, 2, 3], P7 = [0, 1, 2, 3, 4, 5, 6], P6 = [0, 1, 2, 3, 4, 5];
const mirror = (f) => [-1, 1].flatMap((s) => [f(s)].flat());

const LIST = [
  // ======================================================== PIZZA PARLOR
  {
    // Four topping trays with the colors running diagonally (red pepperoni beside maroon
    // and orange, purple olives beside black), cream cheese among pale yellow, and four
    // rolling pins in four different corners.
    id: 106, name: 'Topping Line', world: 'pizza', arena: { w: 24, d: 32 }, time: 170, start: [0, 13.8],
    targets: [{ id: 'pepperoni', n: 'all', tint: 0 }, { id: 'olive', n: 'all', tint: 2 }, { id: 'cheese', n: 'all', tint: 2 }, { id: 'rollingpin', n: 'all' }],
    place: [
      ...mirror((s) => diag('pepperoni', s * 7.4, -11.6, 6, 5, 0.52, 0.52, P5, 0, s < 0 ? 2 : 3)),
      ...mirror((s) => diag('olive', s * 7.4, -4.0, 6, 4, 0.44, 0.44, P4, 0, s < 0 ? 1 : 3)),
      at('wholepizza', 0, -9.0, 0), ring('pizzaslice', 0, -9.0, 8, 2.0, [0, 3, 1, 4, 2, 0, 1, 3]),
      at('rollingpin', -9.6, -14.4, 0), at('rollingpin', 9.6, -0.6, 2), at('rollingpin', -9.6, 6.6, 1), at('rollingpin', 9.6, 14.2, 3),
      ...diag('cheese', 0, -3.8, 8, 3, 0.62, 0.5, P4, 0, 1),
      ...diag('cheese', 0, 1.2, 12, 2, 0.62, 0.5, P4, 0, 2),
      at('cheesewheel', -5.4, 1.2, 2), at('cheesewheel', 5.4, 1.2, 3),
      line('basil', -10.4, 3.6, 10.4, 3.6, 21),
      line('tomato', -6.6, 5.4, 6.6, 5.4, 12),
      line('sodacup', -7.6, 7.6, 7.6, 7.6, 9),
      line('mushslice', -6.0, 9.4, 6.0, 9.4, 13),
      ...diag('pepperoni', 0, 11.2, 10, 2, 0.52, 0.52, P5, 0, 2),
      ...mirror((s) => line('olive', s * 2.4, 12.8, s * 5.6, 12.8, 8, [2, 0, 1, 3, 2, 1, 0, 3])),
      ...mirror((s) => grid('doughball', s * 8.6, 12.0, 3, 3, 0.8)),
      ...mirror((s) => line('mushslice', s * 10.4, -12.0, s * 10.4, -3.0, 10)),
    ],
  },
  {
    // Green-pepper slices hide in four slice fans round GREEN whole pizzas (too big to eat
    // early). Purple soda and yellow tomatoes sit in diagonal color runs; four pizza boxes
    // wait in far corners.
    id: 107, name: 'Slice Shop', world: 'pizza', arena: { w: 24, d: 34 }, time: 180, start: [0, 14.8],
    targets: [{ id: 'pizzaslice', n: 'all', tint: 1 }, { id: 'sodacup', n: 'all', tint: 3 }, { id: 'tomato', n: 'all', tint: 2 }, { id: 'pizzabox', n: 'all' }],
    place: [
      ...[[-6.0, -11.0], [6.0, -11.0], [-6.0, -2.4], [6.0, -2.4]].flatMap(([x, z], k) => [
        at('wholepizza', x, z, 1),
        ring('pizzaslice', x, z, 7, 2.05, [[1, 0, 2, 3, 4, 0, 2], [0, 3, 1, 2, 4, 3, 0], [4, 2, 0, 1, 3, 2, 4], [2, 4, 3, 0, 1, 4, 3]][k]),
      ]),
      at('pizzabox', -9.6, -15.2, 0), at('pizzabox', 9.6, -6.8, 1), at('pizzabox', -9.6, 6.0, 2), at('pizzabox', 9.6, 14.6, 3),
      ...diag('tomato', 0, -6.7, 4, 3, 0.95, 0.95, P4, 0, 1),
      ...diag('tomato', 0, -15.0, 8, 2, 0.95, 0.95, P4, 0, 3),
      ...mirror((s) => line('flour', s * 10.4, -12.4, s * 10.4, -9.2, 2, 'cycle', 0)),
      ...mirror((s) => line('pepperoni', s * 10.4, -4.4, s * 10.4, 2.6, 13)),
      ...diag('sodacup', 0, 2.6, 12, 2, 0.75, 0.75, P5, 0, 2),
      ...diag('cheese', 0, 5.2, 14, 2, 0.62, 0.5, P4, 0, 1),
      line('pizzaslice', -7.0, 7.4, 7.0, 7.4, 8, [3, 1, 0, 4, 2, 1, 3, 0], 0),
      line('basil', -9.0, 9.2, 9.0, 9.2, 19),
      line('mushslice', -8.0, 10.8, 8.0, 10.8, 17),
      ...diag('olive', 0, 12.4, 12, 2, 0.44, 0.44, P4, 0, 1),
      ...mirror((s) => line('pepperoni', s * 2.4, 13.6, s * 6.4, 13.6, 8)),
      ...mirror((s) => grid('doughball', s * 8.4, 12.2, 3, 2, 0.8)),
    ],
  },
  {
    // TWO-STAGE GATE: orange cheese wheels need half the board, then two delivery scooters
    // in opposite corners need most of it. Ivory dough balls hide among cream ones.
    id: 108, name: 'Dough Station', world: 'pizza', arena: { w: 26, d: 36 }, time: 210, start: [0, 15.8],
    targets: [{ id: 'doughball', n: 'all', tint: 2 }, { id: 'flour', n: 'all' }, { id: 'cheesewheel', n: 'all', tint: 1 }, { id: 'scooter', n: 'all' }],
    place: [
      at('scooter', -10.0, -15.8, 0), at('scooter', 10.0, 9.8, 1),
      ...mirror((s) => diag('doughball', s * 7.0, -12.6, 5, 4, 0.82, 0.82, P4, 0, s < 0 ? 1 : 3)),
      at('flour', 0, -13.4, 0), at('flour', 0, -4.6, 1), at('flour', -10.6, -1.0, 2), at('flour', 10.6, -5.6, 3),
      ring('cheesewheel', 0, -4.6, 6, 2.6, [1, 0, 2, 3, 1, 2]),
      ring('mushslice', 0, -4.6, 18, 4.3, 'cycle'),
      ...mirror((s) => [at('cheesewheel', s * 8.4, -6.0, s < 0 ? 3 : 1), at('wholepizza', s * 8.4, -2.0, s < 0 ? 0 : 3)]),
      ...mirror((s) => line('rollingpin', s * 4.6, -9.6, s * 9.6, -9.6, 2, 'cycle', 0)),
      ...mirror((s) => line('basil', s * 11.0, -14.0, s * 11.0, -10.6, 5)),
      ...diag('doughball', 0, 1.6, 12, 2, 0.82, 0.82, P4, 0, 1),
      line('tomato', -10.4, 3.6, 10.4, 3.6, 17),
      ...mirror((s) => [at('pizzabox', s * 9.6, 6.0, s < 0 ? 0 : 2), at('cheesewheel', s * 5.6, 6.0, s < 0 ? 0 : 1)]),
      ...diag('cheese', 0, 6.0, 6, 2, 0.62, 0.5, P4, 0, 1),
      line('pizzaslice', -8.0, 8.4, 6.0, 8.4, 8, 'cycle', 0),
      line('sodacup', -9.6, 10.2, 7.0, 10.2, 12),
      line('mushslice', -8.4, 11.8, 8.4, 11.8, 17),
      ...diag('pepperoni', 0, 13.4, 14, 2, 0.52, 0.52, P5, 0, 2),
      ...mirror((s) => line('olive', s * 2.4, 14.9, s * 6.4, 14.9, 9)),
      ...mirror((s) => grid('doughball', s * 9.6, 14.2, 3, 2, 0.82, 0.82, [0, 1, 3])),
    ],
  },
  {
    // SCARCE FILLER + OPPOSITE CORNERS: the red scooters wait in two far corners with
    // look-alike decoy scooters in between; pizza boxes stack along both sides. The food
    // on the board only just covers the scooters.
    id: 109, name: 'Rush Hour', world: 'pizza', arena: { w: 26, d: 36 }, time: 200, start: [0, 15.8],
    targets: [{ id: 'scooter', n: 'all', tint: 0 }, { id: 'pizzabox', n: 'all' }, { id: 'basil', n: 'all', tint: 0 }, { id: 'mushslice', n: 'all', tint: 1 }],
    place: [
      at('scooter', -9.8, -15.8, 0), at('scooter', 9.8, 2.4, 0), at('scooter', -9.8, 2.4, 1),
      ...mirror((s) => line('pizzabox', s * 10.4, -11.6, s * 10.4, -2.4, 4, 'cycle')),
      ...[[-4.4, -13.6], [4.4, -7.0]].flatMap(([x, z], k) => [at('wholepizza', x, z, k ? 2 : 1), ring('mushslice', x, z, 12, 1.65, [1, 3, 0, 2, 3, 1, 2, 0, 3, 2, 0, 1])]),
      ...[[4.4, -13.6], [-4.4, -7.0]].flatMap(([x, z]) => [at('cheesewheel', x, z, 2), ring('basil', x, z, 9, 1.7, [0, 1, 3, 2, 1, 3, 0, 2, 3], 0)]),
      ...diag('basil', 0, 1.8, 14, 2, 0.62, 0.42, P4, 0, 1),
      ...diag('mushslice', 0, 4.6, 16, 2, 0.56, 0.56, P4, 0, 3),
      ...mirror((s) => at('pizzabox', s * 10.4, 8.2, s < 0 ? 3 : 1)),
      ...diag('olive', 0, 12.6, 6, 2, 0.44, 0.44, P4, 0, 1),
      ...mirror((s) => line('pepperoni', s * 2.4, 15.1, s * 6.4, 15.1, 8)),
    ],
  },
  {
    // CENTERPIECE: the brick pizza oven at the back of the parlor. Pineapple pizzas sit
    // among look-alike slices, red pepperoni hides in color runs, and boxes are stacked
    // in all four corners. The oven needs nearly everything else eaten first.
    id: 110, name: 'Brick Oven', world: 'pizza', arena: { w: 30, d: 40 }, time: 270, start: [0, 17.8],
    targets: [{ id: 'pizzaoven', n: 'all' }, { id: 'wholepizza', n: 'all', tint: 3 }, { id: 'pepperoni', n: 'all', tint: 0 }, { id: 'pizzabox', n: 'all' }],
    place: [
      at('pizzaoven', 0, -15.6, 0),
      ...mirror((s) => [at('scooter', s * 9.4, -17.6, s < 0 ? 1 : 2), at('pizzabox', s * 12.6, -17.4, s < 0 ? 0 : 1), at('pizzabox', s * 12.6, 15.6, s < 0 ? 2 : 3)]),
      ...mirror((s) => line('rollingpin', s * 4.0, -12.2, s * 11.0, -12.2, 3, 'cycle', 0)),
      ...mirror((s) => diag('pepperoni', s * 9.6, -14.6, 6, 3, 0.52, 0.52, P5, 0, s < 0 ? 2 : 3)),
      // two pizza tables: pizzas ringed by slices (pineapple ones among them)
      ...[[-6.4, -6.8], [6.4, -6.8], [0, -1.6]].flatMap(([x, z], k) => [
        at('wholepizza', x, z, [3, 0, 1][k]), ring('pizzaslice', x, z, 7, 2.05, [[3, 0, 1, 3, 2, 4, 0], [1, 3, 4, 0, 3, 2, 1], [2, 4, 3, 0, 1, 3, 4]][k]),
      ]),
      ...mirror((s) => [at('wholepizza', s * 12.4, -6.8, s < 0 ? 2 : 3), at('cheesewheel', s * 12.4, -10.0, s < 0 ? 0 : 1), at('cheesewheel', s * 12.4, -3.6, s < 0 ? 3 : 2)]),
      ...mirror((s) => [at('scooter', s * 8.6, 3.4, s < 0 ? 3 : 4), at('wholepizza', s * 12.4, 0.0, s < 0 ? 3 : 4)]),
      ...diag('cheese', 0, 2.4, 6, 2, 0.62, 0.5, P4, 0, 1),
      ...mirror((s) => line('pizzabox', s * 3.6, 5.0, s * 7.2, 5.0, 3, 'cycle')),
      ...diag('tomato', 0, 7.0, 16, 2, 0.95, 0.95, P4, 0, 1),
      ...mirror((s) => [at('pizzabox', s * 12.6, 7.6, s < 0 ? 1 : 0), at('rollingpin', s * 12.4, 4.4, s < 0 ? 4 : 0, PI / 2)]),
      ...diag('pepperoni', 0, 9.4, 18, 2, 0.52, 0.52, P5, 0, 2),
      ...mirror((s) => [at('wholepizza', s * 4.6, 11.8, s < 0 ? 4 : 3), at('cheesewheel', s * 8.6, 11.6, s < 0 ? 2 : 0), at('scooter', s * 12.2, 11.6, s < 0 ? 3 : 2)]),
      at('pizzaslice', 0, 11.8, 3),
      line('basil', -11.0, 13.8, 11.0, 13.8, 23),
      line('sodacup', -11.0, 15.4, -3.4, 15.4, 9), line('sodacup', 3.4, 15.4, 11.0, 15.4, 9),
      ...diag('olive', 0, 15.2, 10, 2, 0.44, 0.44, P4, 0, 1),
      ...mirror((s) => line('mushslice', s * 2.6, 18.0, s * 8.0, 18.0, 10)),
      ...mirror((s) => grid('doughball', s * 9.6, 17.0, 3, 2, 0.82)),
    ],
  },

  // ======================================================== DINO DIG
  {
    // Egg clutches round four nests: pink eggs hide among PEACH ones (and a big pink egg
    // decoy). Fossil shells sit in two opposite corners; orange baby dinos parade.
    id: 111, name: 'Egg Hunt', world: 'dino', arena: { w: 24, d: 32 }, time: 170, start: [0, 13.8],
    targets: [{ id: 'dinoegg', n: 'all', tint: 1 }, { id: 'ammonite', n: 'all' }, { id: 'brush', n: 'all', tint: 2 }, { id: 'babydino', n: 'all', tint: 3 }],
    place: [
      ...[[-6.0, -11.0], [6.0, -11.0], [-6.0, -3.4], [6.0, -3.4]].flatMap(([x, z], k) => [
        at('nest', x, z, [5, 1, 0, 2][k]),
        ...ringCam('dinoegg', x, z, 10, 1.75, [[1, 5, 0, 5, 2, 1, 3, 5, 4, 6], [5, 2, 1, 6, 5, 4, 1, 0, 5, 3], [6, 5, 3, 1, 0, 5, 2, 4, 1, 5], [5, 1, 4, 5, 6, 2, 5, 1, 0, 3]][k], 0.3),
      ]),
      at('bigegg', 0, -7.2, 1), at('bigegg', 0, -13.6, 5),
      grid('ammonite', -9.4, -13.8, 3, 3, 0.64, 0.64, 'cycle'), grid('ammonite', 9.4, 6.4, 3, 3, 0.64, 0.64, 'cycle'),
      ...mirror((s) => line('toybone', s * 10.2, -10.0, s * 10.2, 2.0, 11, 'cycle', PI / 2)),
      ...diag('brush', 0, 0.6, 10, 2, 0.8, 0.34, P5, 0, 2),
      line('babydino', -8.0, 3.2, 8.0, 3.2, 9, [3, 0, 5, 3, 1, 2, 3, 4, 0], 0),
      ...diag('dinoegg', 0, 5.2, 16, 2, 0.6, 0.6, [1, 5, 0, 2, 3, 4, 6], 0, 2),
      line('sandbucket', -8.0, 7.2, 6.0, 7.2, 8),
      line('shovel', -9.0, 8.8, 9.0, 8.8, 8, 'cycle', 0),
      line('fossiltile', -6.0, 10.6, 6.0, 10.6, 6, 'cycle', 0),
      ...mirror((s) => line('toybone', s * 2.4, 12.6, s * 6.4, 12.6, 6, 'cycle', 0)),
      ...mirror((s) => grid('ammonite', s * 9.0, 12.8, 2, 3, 0.64, 0.64, 'cycle')),
      line('brush', -1.6, 11.8, 1.6, 11.8, 4, [0, 2, 4, 1], 0),
    ],
  },
  {
    // A toy skeleton laid out in bones: cream bones hide among ivory and blush ones.
    // Blue shovels mix with four other colors; two stegos guard opposite corners.
    id: 112, name: 'Bone Yard', world: 'dino', arena: { w: 24, d: 34 }, time: 180, start: [0, 14.8],
    targets: [{ id: 'toybone', n: 'all', tint: 1 }, { id: 'fossiltile', n: 'all' }, { id: 'shovel', n: 'all', tint: 1 }, { id: 'stego', n: 'all' }],
    place: [
      // the skeleton: a spine curve with rib pairs
      ...path('toybone', (t) => [-7.0 + 14.0 * t, -8.0 - 2.6 * Math.sin(t * PI)], 0.72, [0, 2, 1, 0, 3, 2, 0, 1, 2, 3], { face: 'along' }),
      ...[-4.2, -2.4, -0.6, 1.2, 3.0, 4.8].flatMap((x, i) => {
        const z0 = -8.0 - 2.6 * Math.sin(((x + 7) / 14) * PI);
        return [-1, 1].flatMap((s) => [at('toybone', x, z0 + s * 1.0, [2, 1, 0, 3][(i + (s > 0 ? 1 : 0)) % 4], PI / 2), at('toybone', x, z0 + s * 1.75, [0, 3, 1, 2][(i + (s > 0 ? 2 : 0)) % 4], PI / 2)]);
      }),
      at('fossiltile', -8.6, -8.0, 0), at('fossiltile', 8.6, -8.0, 1),
      at('stego', -9.0, -15.0, 0, 0), at('stego', 9.0, 4.2, 2, 0),
      at('fossiltile', 9.6, -15.0, 2), at('fossiltile', -9.6, 4.2, 3),
      ...diag('ammonite', 0, -14.6, 12, 2, 0.6, 0.6, P4, 0, 1),
      ...diag('shovel', 0, -2.0, 4, 4, 1.3, 0.5, P5, 0, 2),
      ...mirror((s) => [at('bigegg', s * 6.0, -2.0, s < 0 ? 1 : 3), ring('dinoegg', s * 6.0, -2.0, 10, 1.4, 'cycle')]),
      ...mirror((s) => line('sandbucket', s * 10.2, -12.4, s * 10.2, -2.4, 8)),
      ...diag('toybone', 0, 1.6, 12, 2, 0.7, 0.36, P4, 0, 1),
      line('babydino', -6.0, 3.6, 6.0, 3.6, 7, 'cycle', 0),
      line('shovel', -9.0, 6.0, 9.0, 6.0, 8, [2, 1, 0, 4, 3, 1, 2, 0], 0),
      line('brush', -9.4, 7.6, 9.4, 7.6, 16, 'cycle', 0),
      line('dinoegg', -9.0, 9.0, 9.0, 9.0, 25),
      ...mirror((s) => line('fossiltile', s * 3.0, 10.8, s * 9.6, 10.8, 4, 'cycle', 0)),
      ...diag('toybone', 0, 12.6, 8, 2, 0.7, 0.36, P4, 0, 2),
      ...mirror((s) => line('ammonite', s * 2.6, 14.4, s * 8.6, 14.4, 10)),
    ],
  },
  {
    // TWO-STAGE GATE: a mint nest among blue look-alike nests opens stage one; two dig
    // tents in opposite corners need most of the dig. Pink baby dinos hide in a crowd.
    id: 113, name: 'Nest Watch', world: 'dino', arena: { w: 26, d: 36 }, time: 210, start: [0, 15.8],
    targets: [{ id: 'nest', n: 'all', tint: 0 }, { id: 'babydino', n: 'all', tint: 2 }, { id: 'sandbucket', n: 'all', tint: 4 }, { id: 'digtent', n: 'all' }],
    place: [
      at('digtent', -9.6, -15.0, 0), at('digtent', 9.6, 8.6, 2),
      ...[[-3.0, -13.4], [3.0, -13.4], [9.6, -13.6], [-9.6, -6.2], [-3.0, -6.6], [3.0, -6.6], [9.6, -6.2]].map(([x, z], k) => at('nest', x, z, [2, 0, 2, 0, 2, 2, 0][k])),
      ...mirror((s) => ringCam('babydino', s * 6.0, -10.0, 6, 1.7, s < 0 ? [2, 1, 0, 2, 4, 3] : [4, 2, 3, 0, 2, 1])),
      ...diag('sandbucket', 0, -2.4, 12, 2, 0.9, 0.9, P5, 0, 2),
      ...mirror((s) => [at('sandpile', s * 9.6, -1.6, s < 0 ? 0 : 1), at('stego', s * 9.4, 1.6, s < 0 ? 1 : 3, 0)]),
      ...mirror((s) => [at('digcart', s * 4.6, 1.4, s < 0 ? 0 : 3, 0), at('bigegg', s * 1.4, 1.4, s < 0 ? 4 : 2)]),
      ...diag('dinoegg', 0, 4.0, 18, 2, 0.6, 0.6, P7, 0, 2),
      line('babydino', -10.4, 6.0, 4.4, 6.0, 9, [0, 2, 1, 4, 2, 3, 5, 2, 1], 0),
      line('shovel', -10.0, 7.8, 4.4, 7.8, 7, 'cycle', 0),
      line('fossiltile', -10.4, 9.6, 4.6, 9.6, 8, 'cycle', 0),
      ...diag('ammonite', 0, 11.4, 18, 2, 0.6, 0.6, P4, 0, 1),
      line('sandbucket', -10.0, 13.2, 10.0, 13.2, 13, [0, 4, 1, 2, 4, 3, 0, 1, 4, 2, 3, 4, 1]),
      ...mirror((s) => line('toybone', s * 2.4, 14.8, s * 7.4, 14.8, 7, 'cycle', 0)),
      ...mirror((s) => grid('dinoegg', s * 10.0, 15.2, 3, 2, 0.6, 0.6, 'cycle')),
      ...mirror((s) => line('brush', s * 11.4, -12.0, s * 11.4, -9.0, 5, 'cycle', PI / 2)),
    ],
  },
  {
    // SCARCE FILLER + OPPOSITE CORNERS: two toy longnecks in far corners, yellow dig carts
    // among look-alike carts, mint eggs among blue ones. Just enough food for the longnecks.
    id: 114, name: 'Dig Site', world: 'dino', arena: { w: 26, d: 36 }, time: 210, start: [0, 15.8],
    targets: [{ id: 'longneck', n: 'all' }, { id: 'digcart', n: 'all', tint: 2 }, { id: 'dinoegg', n: 'all', tint: 0 }, { id: 'fossiltile', n: 'all', tint: 2 }],
    place: [
      at('longneck', -8.6, -15.6, 1, 0), at('longneck', 8.6, 6.6, 4, 0),
      at('digtent', 8.8, -14.8, 3), at('digtent', -9.0, 6.0, 1),
      ...[[-4.0, -10.6], [3.6, -9.2], [-9.6, -5.4], [9.6, -1.8], [0.4, -4.6], [-3.6, 2.2]].map(([x, z], k) => at('digcart', x, z, [2, 0, 1, 2, 4, 3][k], 0)),
      ...mirror((s) => [at('stego', s * 9.4, -9.6, s < 0 ? 0 : 5, 0), at('sandpile', s * 5.2, -1.6, s < 0 ? 2 : 0)]),
      ...[[-1.0, -14.4], [-9.8, -0.2], [5.2, 2.4], [9.8, -5.8]].map(([x, z], k) => at('fossiltile', x, z, [2, 0, 2, 1][k])),
      ...mirror((s) => ring('dinoegg', s * 3.4, -14.0, 7, 1.1, s < 0 ? [0, 2, 0, 6, 2, 4, 2] : [2, 0, 2, 3, 2, 0, 1])),
      ...diag('dinoegg', 0, -7.0, 8, 2, 0.6, 0.6, [0, 2, 6, 1], 0, 1),
      ...diag('fossiltile', 0, 5.2, 6, 1, 1.4, 1.4, [0, 2, 3, 1, 0, 3]),
      ...diag('dinoegg', 0, 7.6, 14, 2, 0.6, 0.6, [0, 2, 5, 3, 4, 2, 6], 0, 3),
      line('shovel', -7.4, 9.6, 7.4, 9.6, 6, 'cycle', 0),
      line('babydino', -6.0, 11.2, 6.0, 11.2, 7, 'cycle', 0),
      ...diag('ammonite', 0, 12.8, 14, 2, 0.6, 0.6, P4, 0, 1),
      ...mirror((s) => line('toybone', s * 2.4, 14.8, s * 7.4, 14.8, 7, 'cycle', 0)),
      ...mirror((s) => grid('brush', s * 10.0, 13.6, 2, 4, 0.8, 0.36, 'cycle')),
    ],
  },
  {
    // CENTERPIECE: the volcano play set at the back of the dig. Peach eggs hide among
    // pink ones, green babies in every herd, stegos in all four corners.
    id: 115, name: 'Volcano Day', world: 'dino', arena: { w: 30, d: 40 }, time: 270, start: [0, 17.8],
    targets: [{ id: 'volcano', n: 'all' }, { id: 'dinoegg', n: 'all', tint: 5 }, { id: 'babydino', n: 'all', tint: 0 }, { id: 'stego', n: 'all' }],
    place: [
      at('volcano', 0, -14.8, 0),
      ...mirror((s) => [at('stego', s * 12.2, -18.0, s < 0 ? 1 : 2, 0), at('stego', s * 12.2, 17.2, s < 0 ? 4 : 3, 0)]),
      ...mirror((s) => [at('longneck', s * 7.2, -18.0, s < 0 ? 0 : 3, 0), at('digtent', s * 11.6, -12.6, s < 0 ? 0 : 2)]),
      at('digtent', 0, -7.0, 1),
      ...mirror((s) => [at('nest', s * 5.0, -7.4, s < 0 ? 5 : 1), ringCam('dinoegg', s * 5.0, -7.4, 9, 1.65, s < 0 ? [5, 1, 0, 5, 1, 2, 5, 1, 3] : [1, 5, 4, 1, 5, 6, 1, 5, 2])]),
      ...mirror((s) => [at('longneck', s * 11.4, -6.4, s < 0 ? 5 : 1, 0), at('digcart', s * 11.6, -2.4, s < 0 ? 1 : 4, 0)]),
      ...mirror((s) => [at('sandpile', s * 7.8, -2.4, s < 0 ? 0 : 2), at('bigegg', s * 4.8, -2.6, s < 0 ? 1 : 5), at('bigegg', s * 2.2, -2.6, s < 0 ? 5 : 1)]),
      ...diag('babydino', 0, 0.4, 14, 1, 1.0, 1.0, [0, 2, 3, 1, 0, 4, 5]),
      ...mirror((s) => [at('nest', s * 12.2, 3.0, s < 0 ? 0 : 3), at('digcart', s * 8.8, 3.2, s < 0 ? 2 : 0, 0), at('fossiltile', s * 5.6, 3.0, s < 0 ? 0 : 3), at('stego', s * 2.0, 3.2, s < 0 ? 0 : 5, 0)]),
      ...diag('dinoegg', 0, 5.6, 22, 2, 0.6, 0.6, [5, 1, 0, 2, 3, 4, 6], 0, 2),
      ...mirror((s) => [at('sandpile', s * 12.2, 7.6, s < 0 ? 1 : 0), at('nest', s * 8.6, 7.6, s < 0 ? 2 : 4), at('bigegg', s * 5.4, 7.6, s < 0 ? 3 : 0), at('fossiltile', s * 2.4, 7.6, s < 0 ? 1 : 2)]),
      line('shovel', -12.0, 9.8, 12.0, 9.8, 12, 'cycle', 0),
      line('babydino', -12.0, 11.4, 12.0, 11.4, 13, [0, 3, 1, 4, 0, 2, 5, 3, 0, 1, 4, 2, 0], 0),
      ...diag('sandbucket', 0, 13.2, 22, 1, 1.0, 1.0, P5),
      ...diag('ammonite', 0, 14.8, 16, 2, 0.6, 0.6, P4, 0, 1),
      ...mirror((s) => [line('toybone', s * 2.4, 16.6, s * 6.4, 16.6, 6, 'cycle', 0), grid('brush', s * 8.4, 17.2, 2, 3, 0.8, 0.36, 'cycle')]),
      ...mirror((s) => line('dinoegg', s * 2.0, 18.2, s * 5.6, 18.2, 7, [1, 5, 0, 2, 5, 1, 3])),
    ],
  },

  // ======================================================== FAIRY CASTLE
  {
    // PRECISION TINY TARGETS: ruby gems (beside look-alike ROSE gems) are tucked between
    // giant gems she cannot eat yet. Gold crowns in color runs, chests in far corners.
    id: 116, name: 'Gem Vault', world: 'castle', arena: { w: 24, d: 32 }, time: 170, start: [0, 13.8],
    targets: [{ id: 'gem', n: 'all', tint: 0 }, { id: 'crown', n: 'all', tint: 0 }, { id: 'chest', n: 'all' }, { id: 'potion', n: 'all', tint: 1 }],
    place: [
      ...[[-6.0, -10.6], [6.0, -10.6], [0, -5.0], [-6.0, 0.6], [6.0, 0.6]].flatMap(([x, z], k) => [
        at('chest', x, z, k % 5),
        ring('biggem', x, z, 4, 1.75, [[0, 5, 0, 5], [5, 0, 6, 0], [0, 5, 4, 5], [5, 3, 0, 5], [6, 0, 5, 0]][k], 0),
        ring('gem', x, z, 4, 1.75, [[0, 5, 1, 0], [5, 0, 2, 5], [6, 0, 5, 3], [0, 4, 5, 0], [5, 0, 0, 2]][k], 0).map((o) => ({ ...o, x: r3(x + (o.x - x) * 0.75 * Math.SQRT1_2 - (o.z - z) * 0.75 * Math.SQRT1_2), z: r3(z + (o.x - x) * 0.75 * Math.SQRT1_2 + (o.z - z) * 0.75 * Math.SQRT1_2) })),
      ]),
      at('chest', -9.6, -14.2, 1), at('chest', 9.6, 7.6, 3),
      ...mirror((s) => diag('crown', s * 9.2, -6.0, 3, 6, 0.6, 0.6, P5, 0, 2)),
      ...diag('potion', 0, -14.2, 12, 2, 0.55, 0.55, P5, 0, 2),
      ...diag('crown', 0, 4.4, 14, 2, 0.6, 0.6, P5, 0, 3),
      ...diag('gem', 0, 6.2, 18, 2, 0.48, 0.48, P7, 0, 2),
      line('towerblock', -8.0, 8.2, 8.0, 8.2, 9),
      ...diag('potion', 0, 10.0, 16, 2, 0.55, 0.55, P5, 0, 2),
      ...mirror((s) => line('tinyshield', s * 2.4, 12.0, s * 8.0, 12.0, 8, 'cycle', 0)),
      ...mirror((s) => grid('gem', s * 4.0, 13.4, 5, 2, 0.48, 0.48, [5, 1, 3, 6, 4, 2, 5, 3, 1, 4])),
      ...mirror((s) => grid('wand', s * 9.6, 13.6, 2, 3, 0.8, 0.4, 'cycle')),
    ],
  },
  {
    // Knights drill in color ranks (blue among purple and green), purple shields hang in
    // diagonal runs, yellow wands hide among pink ones, four thrones in far corners.
    id: 117, name: 'Knight School', world: 'castle', arena: { w: 24, d: 34 }, time: 180, start: [0, 14.8],
    targets: [{ id: 'toyknight', n: 'all', tint: 1 }, { id: 'tinyshield', n: 'all', tint: 3 }, { id: 'wand', n: 'all', tint: 0 }, { id: 'throne', n: 'all' }],
    place: [
      at('throne', -9.6, -15.0, 0), at('throne', 9.6, -6.4, 1), at('throne', -9.6, 2.4, 3), at('throne', 9.6, 12.8, 4),
      ...diag('toyknight', 0, -12.4, 9, 4, 0.85, 0.85, [3, 1, 2, 0, 1, 4], 0, 2),
      ...mirror((s) => [at('dragonplush', s * 6.6, -6.4, s < 0 ? 0 : 2, 0), ring('wand', s * 6.6, -6.4, 8, 1.9, s < 0 ? [0, 1, 0, 3, 1, 0, 4, 1] : [1, 0, 1, 2, 0, 1, 3, 0])]),
      ...diag('tinyshield', 0, -6.4, 4, 4, 0.6, 0.6, P5, 0, 2),
      ...mirror((s) => line('chest', s * 10.0, -12.2, s * 10.0, -9.0, 3, 'cycle', PI / 2)),
      ...diag('tinyshield', 0, -1.0, 16, 2, 0.6, 0.45, P5, 0, 3),
      ...mirror((s) => [at('biggem', s * 6.0, 2.4, s < 0 ? 1 : 4), ringCam('toyknight', s * 6.0, 2.4, 7, 1.75, s < 0 ? [1, 3, 0, 1, 2, 3, 4] : [3, 1, 4, 2, 1, 0, 3])]),
      line('towerblock', -2.6, 2.4, 2.6, 2.4, 4),
      ...diag('wand', 0, 5.8, 12, 2, 0.8, 0.4, P5, 0, 2),
      ...diag('potion', 0, 7.6, 16, 2, 0.55, 0.55, P5, 0, 1),
      line('toyknight', -9.0, 9.4, 9.0, 9.4, 13, [0, 1, 3, 2, 4, 3, 1, 0, 2, 3, 4, 1, 3], 0),
      ...diag('crown', 0, 11.2, 14, 2, 0.6, 0.6, P5, 0, 2),
      ...mirror((s) => line('gem', s * 2.2, 13.4, s * 7.0, 13.4, 9)),
      ...mirror((s) => line('gem', s * 2.2, 15.2, s * 7.0, 15.2, 9)),
    ],
  },
  {
    // TWO-STAGE GATE: green dragon plushies (purple and blue look-alikes all round) open
    // stage one; two fairy carriages in opposite corners need most of the garden.
    // Aqua gems hide among emerald ones in the flower beds.
    id: 118, name: 'Dragon Garden', world: 'castle', arena: { w: 26, d: 36 }, time: 210, start: [0, 15.8],
    targets: [{ id: 'dragonplush', n: 'all', tint: 0 }, { id: 'gem', n: 'all', tint: 6 }, { id: 'towerblock', n: 'all', tint: 2 }, { id: 'carriage', n: 'all' }],
    place: [
      at('carriage', -9.8, -15.6, 0, 0), at('carriage', 9.8, 8.2, 3, 0),
      ...[[-3.6, -14.8], [3.6, -14.8], [9.6, -14.6], [-9.6, -9.2], [-3.4, -9.4], [3.4, -9.4], [9.6, -9.2]].map(([x, z], k) => at('dragonplush', x, z, [1, 0, 3, 0, 2, 1, 0][k], 0)),
      ...mirror((s) => [at('fairytower', s * 6.6, -3.4, s < 0 ? 1 : 3), ring('gem', s * 6.6, -3.4, 14, 1.8, s < 0 ? [6, 2, 2, 6, 1, 2, 6, 5, 2, 6, 3, 2, 6, 2] : [2, 6, 2, 4, 6, 2, 2, 6, 0, 2, 6, 3, 2, 6])]),
      ...diag('towerblock', 0, -3.4, 3, 3, 1.05, 1.05, PASTEL5, 0, 2),
      ...mirror((s) => line('towerblock', s * 11.2, -6.0, s * 11.2, 1.6, 7, [2, 1, 3, 0, 2, 4, 3])),
      ...diag('gem', 0, 1.6, 20, 2, 0.48, 0.48, [2, 6, 1, 6, 2, 5, 2], 0, 2),
      ...mirror((s) => [at('throne', s * 3.0, 4.4, s < 0 ? 2 : 1), at('biggem', s * 6.4, 4.4, s < 0 ? 6 : 2), at('chest', s * 9.2, 4.4, s < 0 ? 2 : 0, 0)]),
      at('potion', 0, 4.4, 2),
      ...diag('crown', 0, 6.6, 12, 2, 0.6, 0.6, P5, 0, 2),
      line('toyknight', -10.4, 8.4, 5.4, 8.4, 12, 'cycle', 0),
      line('tinyshield', -10.4, 10.0, 5.6, 10.0, 15, 'cycle', 0),
      ...diag('potion', 0, 11.6, 20, 2, 0.55, 0.55, P5, 0, 2),
      line('towerblock', -9.0, 13.4, 9.0, 13.4, 13, [2, 0, 4, 1, 2, 3, 0, 2, 1, 4, 2, 3, 0]),
      ...mirror((s) => line('gem', s * 2.2, 15.0, s * 6.6, 15.0, 9, 'cycle')),
      ...mirror((s) => grid('wand', s * 9.6, 15.4, 2, 3, 0.8, 0.4, 'cycle')),
    ],
  },
  {
    // SCARCE FILLER + OPPOSITE CORNERS: a royal parade of carriages (the pink ones are
    // the target, look-alike lilac ones beside them), fairy towers at the four corners.
    // There is only just enough on the road to grow for the carriages.
    id: 119, name: 'Royal Parade', world: 'castle', arena: { w: 26, d: 36 }, time: 210, start: [0, 15.8],
    targets: [{ id: 'carriage', n: 'all', tint: 0 }, { id: 'fairytower', n: 'all' }, { id: 'crown', n: 'all', tint: 2 }, { id: 'toyknight', n: 'all', tint: 4 }],
    place: [
      at('fairytower', -10.4, -15.4, 1), at('fairytower', 10.4, -15.4, 3), at('fairytower', -10.4, 4.6, 2), at('fairytower', 10.4, 4.6, 4),
      line('carriage', -6.0, -15.0, 6.0, -15.0, 3, [0, 1, 4], 0),
      ...mirror((s) => at('carriage', s * 9.6, -5.4, s < 0 ? 1 : 0, 0)),
      ...path('toyknight', (t) => [-7.0 + 14.0 * t, -10.4 + 0.6 * Math.sin(t * TAU)], 0.9, [4, 0, 1, 4, 2, 3, 0, 4, 1]),
      ...diag('crown', 0, -6.0, 8, 3, 0.6, 0.6, [2, 3, 0, 1, 4], 0, 2),
      ...mirror((s) => [at('dragonplush', s * 4.4, -1.0, s < 0 ? 2 : 4, 0), at('throne', s * 10.2, -1.0, s < 0 ? 0 : 2)]),
      ...diag('tinyshield', 0, 1.6, 12, 2, 0.6, 0.45, P5, 0, 2),
      ...diag('crown', 0, 9.0, 12, 2, 0.6, 0.6, [2, 3, 1, 0, 4], 0, 1),
      line('toyknight', -6.0, 10.8, 6.0, 10.8, 9, [4, 0, 3, 4, 1, 2, 4, 0, 3], 0),
      ...mirror((s) => line('potion', s * 2.4, 13.4, s * 7.0, 13.4, 8)),
      ...mirror((s) => grid('gem', s * 9.6, 14.8, 3, 2, 0.48, 0.48, 'cycle')),
      ...mirror((s) => line('gem', s * 2.2, 15.0, s * 6.2, 15.0, 7)),
    ],
  },
  {
    // THE GRAND FINALE: the pastel castle, the last level of the game. Four fairy towers
    // stand at the far corners of the grounds, amethysts hide among lilac look-alikes,
    // blue knights in every rank. The castle needs nearly the whole board eaten first.
    id: 120, name: 'Pastel Castle', world: 'castle', arena: { w: 32, d: 42 }, time: 300, start: [0, 18.8],
    targets: [{ id: 'castle', n: 'all' }, { id: 'fairytower', n: 'all' }, { id: 'gem', n: 'all', tint: 4 }, { id: 'toyknight', n: 'all', tint: 1 }],
    place: [
      at('castle', 0, -16.6, 0),
      ...mirror((s) => [at('fairytower', s * 13.2, -18.2, s < 0 ? 1 : 3), at('fairytower', s * 13.2, 8.4, s < 0 ? 2 : 0)]),
      ...mirror((s) => [at('gatehouse', s * 7.4, -10.6, s < 0 ? 0 : 1), at('carriage', s * 8.0, -16.6, s < 0 ? 4 : 2, 0), at('throne', s * 13.4, -12.6, s < 0 ? 1 : 3)]),
      at('gatehouse', 0, -5.0, 2),
      ...mirror((s) => [at('dragonplush', s * 5.6, -6.6, s < 0 ? 0 : 3, 0), at('biggem', s * 10.4, -6.0, s < 0 ? 4 : 1), at('chest', s * 13.4, -7.2, s < 0 ? 1 : 2, PI / 2)]),
      ...mirror((s) => ringCam('toyknight', s * 10.4, -6.0, 8, 1.55, s < 0 ? [1, 3, 0, 1, 4, 2, 1, 3] : [3, 1, 2, 4, 1, 0, 3, 1])),
      ...mirror((s) => [at('gatehouse', s * 9.4, 0.8, s < 0 ? 3 : 4), at('carriage', s * 3.4, 0.6, s < 0 ? 1 : 3, 0)]),
      ...diag('gem', 0, -1.8, 22, 2, 0.48, 0.48, [4, 5, 1, 4, 0, 3, 4, 6, 2], 0, 2),
      ...mirror((s) => [at('throne', s * 13.4, 3.6, s < 0 ? 4 : 0), at('biggem', s * 6.0, 3.8, s < 0 ? 4 : 1), at('dragonplush', s * 9.6, 4.4, s < 0 ? 1 : 2, 0), at('chest', s * 2.4, 3.8, s < 0 ? 0 : 4, 0)]),
      ...diag('towerblock', 0, 6.0, 12, 1, 1.0, 1.0, PASTEL5),
      ...mirror((s) => [at('carriage', s * 9.4, 8.4, s < 0 ? 0 : 2, 0), at('throne', s * 5.2, 8.4, s < 0 ? 3 : 1), at('biggem', s * 2.2, 8.4, s < 0 ? 5 : 4)]),
      ...diag('toyknight', 0, 10.6, 18, 2, 0.85, 0.85, [1, 3, 0, 2, 1, 4], 0, 2),
      ...mirror((s) => [at('dragonplush', s * 12.6, 11.6, s < 0 ? 4 : 0, 0), at('chest', s * 12.6, 13.4, s < 0 ? 3 : 1, 0)]),
      ...diag('crown', 0, 12.8, 20, 2, 0.6, 0.6, P5, 0, 2),
      ...diag('potion', 0, 14.6, 24, 2, 0.55, 0.55, P5, 0, 1),
      ...mirror((s) => [line('tinyshield', s * 10.0, 16.6, s * 14.0, 16.6, 7, 'cycle', 0), grid('wand', s * 12.0, 18.4, 4, 3, 0.8, 0.4, 'cycle')]),
      ...diag('gem', 0, 16.4, 16, 2, 0.48, 0.48, [4, 1, 5, 4, 3, 6, 4, 2, 0], 0, 3),
      ...mirror((s) => line('gem', s * 2.2, 18.6, s * 7.4, 18.6, 11, 'cycle')),
    ],
  },
];

export const LEVELS = LIST.map((L) => ({ ...L, place: L.place.flat() }));
// CHALLENGE tuning, measured with tools/validate_cli.mjs (2026-10-05). B = slowest bot clear of
// four CHALLENGE runs (the validator is non-deterministic, about +-10%): times = ceil5(1.32B + 6), pars = [ceil5(B + 3), ceil5(1.15B + 5)].
// relaxedPars from an Easy run (E = bot clear): [ceil5(2.2E + 15), ceil5(3.4E + 25)].
// grow: 0.55-0.58 on normal boards; finales only as high as check_levels needs (30% spare).
export const TUNING = {
  times: { 106: 60, 107: 80, 108: 85, 109: 75, 110: 80, 111: 65, 112: 65, 113: 100, 114: 100, 115: 90, 116: 80, 117: 80, 118: 90, 119: 75, 120: 95 },
  grow: { 106: 0.55, 107: 0.57, 108: 0.58, 109: 0.55, 110: 0.84, 111: 0.55, 112: 0.57, 113: 0.58, 114: 0.55, 115: 0.78, 116: 0.55, 117: 0.57, 118: 0.58, 119: 0.55, 120: 0.75 },
  pars: { 106: [45, 50], 107: [60, 70], 108: [60, 70], 109: [55, 65], 110: [60, 70], 111: [50, 55], 112: [45, 55], 113: [75, 90], 114: [75, 90], 115: [70, 80], 116: [60, 70], 117: [60, 70], 118: [70, 80], 119: [55, 65], 120: [70, 80] },
  relaxedPars: { 106: [90, 140], 107: [95, 150], 108: [110, 175], 109: [100, 160], 110: [120, 190], 111: [95, 150], 112: [105, 165], 113: [125, 190], 114: [95, 150], 115: [140, 215], 116: [110, 175], 117: [105, 165], 118: [125, 190], 119: [115, 175], 120: [130, 200] },
};
