// Gulp Season 3: 15 levels, ids 46-60, 5 per world (craft, fair, space). This is the
// CHALLENGE season (Amanda beat Season 2 and called it "not even a challenge"), so the
// boards are harder BY DESIGN, not just bigger:
//   - color targets hide among look-alikes (the same prop in 5-7 colors, laid out in
//     diagonal color runs so the target color never forms one tidy row),
//   - targets sit in opposite corners, so routing matters,
//   - decoys: big versions of the target prop (bigyarn, bigbutton, bigplanet) in the
//     target's color, too big to eat until late,
//   - growth gates: the biggest target only fits after most of the board is eaten,
//   - scarce-filler boards (49, 54, 59) where the filler only just covers the gate.
// It stays fair: tools/check_levels.mjs requires 40% spare filler at CHALLENGE growth for
// every level, and validate.html must clear every level with a careful bot AND an erratic
// "human" driver. Same op semantics and helpers as levels_wave2.js (copied, so this file
// stands alone): only grid/ring/line/at ops; the patterns expand to plain `at` ops.
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
// button / balloon (RAINBOW): 0 red, 1 orange, 2 yellow, 3 green, 4 blue, 5 purple, 6 pink
// yarnball / bigyarn: 0 red, 1 orange, 2 yellow, 3 green, 4 blue, 5 purple
// scissors: 0 pink, 1 blue, 2 orange, 3 teal, 4 purple      dressform: 0 pink, 1 blue, 2 mint, 3 yellow, 4 lilac
// prizebunny: 0 pink, 1 blue, 2 yellow, 3 purple, 4 green   bumpercar: 0 red, 1 blue, 2 yellow, 3 green, 4 purple, 5 pink
// popcorncart: 0 red, 1 blue, 2 pink, 3 teal                star: 0 yellow, 1 pink, 2 blue, 3 green, 4 purple, 5 orange
// alien: 0 green, 1 pink, 2 blue, 3 purple, 4 orange        planet / bigplanet: 0 orange, 1 blue, 2 pink, 3 green, 4 purple, 5 yellow
// rocketship: 0 red, 1 blue, 2 yellow, 3 purple             spacepup: 0 red, 1 blue, 2 yellow, 3 purple
const BTN = [0, 1, 2, 3, 4, 5, 6];
const SIX = [0, 1, 2, 3, 4, 5];
const FIVE = [0, 1, 2, 3, 4];

// ------------------------------------------------------------------ reusable bits
// Stargazing: a big five-point star traced in stars, every color mixed in.
const BIG_STAR = starOutline(0, -5.6, 6.2, 2.7);

const LIST = [
  // ======================================================== CRAFT CORNER
  {
    // Four button trays in the corners with the colors running diagonally, so the red
    // buttons are scattered; a red BIG button decoy sits in the middle row.
    id: 46, name: 'Button Box', world: 'craft', arena: { w: 22, d: 28 }, time: 160, start: [0, 11.8],
    targets: [{ id: 'button', n: 'all', tint: 0 }, { id: 'spool', n: 'all' }, { id: 'pincushion', n: 'all' }],
    place: [
      ...[[-6.6, -10.2], [6.6, -10.2], [-6.6, 3.6], [6.6, 3.6]].flatMap(([x, z], k) => diag('button', x, z, 6, 5, 0.56, 0.56, BTN, 0, k % 2 ? 2 : 3)),
      // the spool rainbow, a jar of buttons for the pot of gold
      ...rainbow('spool', 0, 0.8, 2.2, 0.7, [5, 4, 3], 0.7, 0),
      at('buttonjar', 0, 0.2, 0),
      // pincushions: top middle in a ring of spools, and one on each side ringed by thimbles
      at('pincushion', 0, -10.4, 0), ring('spool', 0, -10.4, 10, 1.45, 'cycle'),
      ...[-1, 1].flatMap((s) => [at('pincushion', s * 8.6, -1.2, s < 0 ? 1 : 3), ring('thimble', s * 8.6, -1.2, 9, 1.2, 'cycle')]),
      // decoys: big buttons (a red one among them) across the middle
      line('bigbutton', -8.0, -5.6, 8.0, -5.6, 5, 'cycle', 0),
      // the starter field: buttons, thimbles, tape measures, spools
      ...diag('button', 0, 7.2, 10, 2, 0.56, 0.56, BTN, 0, 3),
      line('thimble', -9.6, 7.0, -5.0, 7.0, 6), line('thimble', 5.0, 7.0, 9.6, 7.0, 6),
      line('tapemeasure', -8.6, 10.2, -3.6, 10.2, 4), line('tapemeasure', 3.6, 10.2, 8.6, 10.2, 4),
      line('spool', -4.2, 12.6, -1.8, 12.6, 4), line('spool', 1.8, 12.6, 4.2, 12.6, 4),
      ...[-1, 1].map((s) => at('button', s * 9.4, 12.4, s < 0 ? 0 : 4)),
    ],
  },
  {
    // A yarn rainbow (blue is the second band) with a BIG blue yarn ball decoy in the
    // middle, and more blue balls hiding in the baskets and by the start.
    id: 47, name: 'Yarn Rainbow', world: 'craft', arena: { w: 24, d: 30 }, time: 160, start: [0, 12.8],
    targets: [{ id: 'yarnball', n: 'all', tint: 4 }, { id: 'pompom', n: 'all' }],
    place: [
      ...rainbow('yarnball', 0, -4.6, 2.6, 1.02, [5, 4, 3, 2, 1, 0], 1.0, 0),
      at('bigyarn', 0, -4.6, 4), ring('pompom', 0, -4.6, 9, 1.65, 'cycle'),
      at('bigyarn', -9.8, -12.6, 4), at('bigyarn', 9.8, -12.6, 1),
      ...[-1, 1].flatMap((s) => [at('sewingbasket', s * 8.5, 1.6, s < 0 ? 0 : 2), ...ring('yarnball', s * 8.5, 1.6, 7, 2.0, s < 0 ? [4, 0, 2, 3, 4, 5, 1] : [1, 5, 4, 0, 3, 4, 2])]),
      ...path('pompom', waveF(-5.4, 5.4, 1.4, 0.35, 2), 0.6),
      ...path('pompom', waveF(-5.4, 5.4, 3.0, 0.35, 2, PI), 0.6),
      line('scissors', -8.4, 6.2, 8.4, 6.2, 8, 'cycle', 0),
      ...diag('button', 0, 9.0, 12, 2, 0.56, 0.56, BTN, 0, 2),
      line('thimble', -9.8, 9.0, -4.6, 9.0, 6), line('thimble', 4.6, 9.0, 9.8, 9.0, 6),
      line('spool', -9.6, 11.2, -2.4, 11.2, 9), line('spool', 2.4, 11.2, 9.6, 11.2, 9),
      at('yarnball', -5.2, 13.0, 4), at('yarnball', 5.2, 13.0, 2),
      at('tapemeasure', -9.6, 13.2, 0), at('tapemeasure', 9.6, 13.2, 1),
      ...[-1, 1].map((s) => line('tapemeasure', s * 10.6, -9.6, s * 10.6, -2.6, 5)),
    ],
  },
  {
    // GROWTH GATE: two sewing machines in opposite corners only fit after a lot of the
    // table is eaten. Blue scissors hide in a drawer of five colors; thimbles everywhere.
    id: 48, name: 'Sewing Table', world: 'craft', arena: { w: 24, d: 32 }, time: 190, start: [0, 13.8],
    targets: [{ id: 'sewingmachine', n: 'all' }, { id: 'scissors', n: 'all', tint: 1 }, { id: 'thimble', n: 'all' }],
    place: [
      at('sewingmachine', -8.4, -13.4, 0), line('spool', -10.4, -11.6, -6.4, -11.6, 6),
      ...gradient('button', 1.2, -12.6, 12, 4, 0.56, 0.56, BTN),
      at('pincushion', 8.6, -12.6, 2), ring('thimble', 8.6, -12.6, 10, 1.25, 'cycle'),
      line('dressform', -8.4, -7.8, 8.4, -7.8, 5, 'cycle'),
      line('yarnball', -6.3, -5.2, 6.3, -5.2, 8, 'cycle'),
      // the scissor drawer: 6 columns of 5 colors, so the blue ones run diagonally
      ...diag('scissors', -1.6, -1.9, 6, 3, 1.4, 1.0, FIVE, 0, 1),
      at('scissors', -9.6, -1.2, 1, PI / 2), at('scissors', 4.8, -3.6, 1, 0),
      at('sewingmachine', 8.4, 0.4, 2), line('spool', 7.0, -1.6, 10.2, -1.6, 4),
      line('buttonjar', -8.4, 3.6, -3.0, 3.6, 4),
      ...gradient('pompom', 4.4, 4.2, 8, 3, 0.6, 0.6, SIX),
      // the lane by the start: spool rails with a buttons-and-thimbles lane between
      line('spool', -10.4, 6.6, 10.4, 6.6, 27),
      ...diag('button', 0, 8.1, 16, 2, 0.6, 0.56, BTN, 0, 3),
      line('thimble', -10.2, 8.1, -5.6, 8.1, 6), line('thimble', 5.6, 8.1, 10.2, 8.1, 6),
      line('spool', -10.4, 9.6, 10.4, 9.6, 27),
      line('tapemeasure', -10.0, 11.6, -3.2, 11.6, 5), line('tapemeasure', 3.2, 11.6, 10.0, 11.6, 5),
      ...[-1, 1].flatMap((s) => [at('tapemeasure', s * 9.2, 13.6, 3), ring('thimble', s * 9.2, 13.6, 7, 0.85, 'cycle')]),
    ],
  },
  {
    // SCARCE FILLER: the two comfy chairs (opposite corners) need almost the whole board.
    // A quilting circle of dress forms; the mint ones are targets, two more in far corners.
    id: 49, name: 'Quilting Bee', world: 'craft', arena: { w: 26, d: 34 }, time: 200, start: [0, 14.8],
    targets: [{ id: 'comfychair', n: 'all' }, { id: 'dressform', n: 'all', tint: 2 }, { id: 'quiltstack', n: 'all' }],
    place: [
      at('comfychair', -9.6, -13.6, 0), at('comfychair', 9.6, 0.8, 3),
      at('quiltstack', 0, -4.0, 0), ring('thimble', 0, -4.0, 12, 1.75, 'cycle'),
      ...ringCam('dressform', 0, -4.0, 8, 3.2, [0, 2, 1, 3, 4, 0, 2, 1], PI / 8),
      at('dressform', 10.4, -14.4, 2), at('dressform', -10.6, 9.4, 2),
      at('quiltstack', 0, -13.4, 1), at('quiltstack', -9.6, -4.4, 2), at('quiltstack', 6.6, 9.8, 3),
      at('sewingbasket', -5.6, -13.4, 1), at('sewingbasket', 5.6, -13.4, 3),
      at('bigbutton', -3.0, -13.4, 2), at('bigbutton', 3.0, -13.4, 5),
      line('yarnball', -6.0, -9.4, 6.0, -9.4, 7),
      ...[-1, 1].map((s) => at('pincushion', s * 6.0, -3.6, s < 0 ? 0 : 2)),
      ...[-1, 1].map((s) => at('pincushion', s * 4.6, 4.4, s < 0 ? 1 : 4)),
      ...[-1, 1].flatMap((s) => [at('scissors', s * 7.6, -9.2, s < 0 ? 0 : 3, 0), at('scissors', s * 8.8, 4.6, s < 0 ? 2 : 4, PI / 2)]),
      line('buttonjar', -2.0, 3.6, 2.0, 3.6, 3),
      ...[-1, 1].map((s) => line('spool', s * 11.4, -10.0, s * 11.4, 5.0, 13)),
      ...path('pompom', waveF(-8.0, 8.0, 6.8, 0.4, 2), 0.7),
      ...diag('button', 0, 10.6, 14, 2, 0.56, 0.56, BTN, 0, 3),
      line('tapemeasure', -6.0, 13.2, -2.4, 13.2, 3), line('tapemeasure', 2.4, 13.2, 6.0, 13.2, 3),
    ],
  },
  {
    // CENTERPIECE: the giant yarn basket. Orange BIG yarn balls hide among big balls of
    // every color down both sides; four sewing baskets sit in the far corners.
    id: 50, name: 'Giant Yarn Basket', world: 'craft', arena: { w: 28, d: 36 }, time: 180, start: [0, 15.8],
    targets: [{ id: 'yarnbasket', n: 'all' }, { id: 'bigyarn', n: 'all', tint: 1 }, { id: 'sewingbasket', n: 'all' }],
    place: [
      at('yarnbasket', 0, -13.0, 0),
      at('comfychair', -7.6, -14.4, 1), at('comfychair', 7.6, -14.4, 4),
      at('quiltstack', -4.4, -15.8, 0), at('quiltstack', 4.4, -15.8, 2),
      ...[-1, 1].map((s) => line('bigyarn', s * 11.6, -10.0, s * 11.6, 8.0, 6, s < 0 ? [0, 1, 4, 3, 5, 2] : [3, 5, 2, 1, 0, 1])),
      ...[-1, 1].flatMap((s) => [at('sewingmachine', s * 7.4, -8.6, s < 0 ? 0 : 1), at('bigbutton', s * 3.6, -9.6, s < 0 ? 3 : 1), at('dressform', s * 7.6, -3.4, s < 0 ? 4 : 0)]),
      // a spiral of buttons round a pincushion
      at('pincushion', 0, -4.4, 1), ...path('button', spiralF(0, -4.4, 1.0, 3.6, 3, 0), 0.5, BTN),
      // two sewing baskets in rings of yarn, thimbles round a jar between them
      ...[-1, 1].flatMap((s) => [at('sewingbasket', s * 5.4, 2.4, s < 0 ? 2 : 0), ...ring('yarnball', s * 5.4, 2.4, 8, 2.1, s < 0 ? [0, 2, 3, 4, 5, 0, 2, 3] : [5, 4, 3, 2, 0, 5, 4, 3])]),
      at('buttonjar', 0, 2.4, 3), ring('thimble', 0, 2.4, 9, 1.2, 'cycle'),
      ...gradient('pompom', 0, 7.6, 18, 4, 0.6, 0.6, SIX),
      ...[-1, 1].map((s) => line('scissors', s * 4.0, 10.6, s * 9.6, 10.6, 4, 'cycle', 0)),
      // the starter field
      ...diag('button', 0, 12.4, 16, 3, 0.56, 0.56, BTN, 0, 2),
      line('thimble', -10.0, 12.4, -5.6, 12.4, 6), line('thimble', 5.6, 12.4, 10.0, 12.4, 6),
      line('spool', -9.0, 14.4, -2.2, 14.4, 9), line('spool', 2.2, 14.4, 9.0, 14.4, 9),
      ...[-1, 1].map((s) => at('sewingbasket', s * 11.4, 15.4, s < 0 ? 1 : 3)),
      line('tapemeasure', -4.0, 16.4, -2.0, 16.4, 2), line('tapemeasure', 2.0, 16.4, 4.0, 16.4, 2),
    ],
  },

  // ======================================================== FUN FAIR
  {
    // Balloon bunches in every corner, two or three red balloons in each; goldfish
    // prizes at opposite corners of the fair.
    id: 51, name: 'Balloon Bunches', world: 'fair', arena: { w: 22, d: 30 }, time: 160, start: [0, 12.8],
    targets: [{ id: 'balloon', n: 'all', tint: 0 }, { id: 'goldfishbag', n: 'all' }],
    place: [
      ...grid('balloon', -7.0, -11.0, 4, 3, 0.7, 0.7, [4, 0, 2, 6, 3, 5, 1, 0, 2, 4, 6, 3]),
      ...grid('balloon', 7.0, -8.8, 4, 3, 0.7, 0.7, [1, 3, 5, 0, 6, 2, 4, 1, 0, 3, 5, 2]),
      ...grid('balloon', 0, -6.0, 4, 3, 0.7, 0.7, [2, 5, 1, 3, 0, 4, 6, 2, 5, 1, 4, 3]),
      ...grid('balloon', -7.0, -1.0, 4, 3, 0.7, 0.7, [6, 2, 4, 1, 3, 5, 0, 6, 2, 1, 0, 4]),
      ...grid('balloon', 7.0, 1.6, 4, 3, 0.7, 0.7, [3, 1, 6, 2, 5, 0, 4, 3, 1, 6, 2, 5]),
      line('goldfishbag', 2.4, -13.4, 9.6, -13.4, 8), line('goldfishbag', -9.6, 8.6, -4.4, 8.6, 6),
      at('carouselhorse', 0, -1.4, 0, 0), ...ringCam('pinwheel', 0, -1.4, 10, 2.1, FIVE),
      ...diag('candyapple', 0, -10.6, 6, 2, 0.6, 0.6, [0, 1, 2, 3], 0, 1),
      ...[-1, 1].map((s) => line('balloon', s * 2.6, -4.4, s * 5.4, -4.4, 5, s < 0 ? [3, 0, 5, 1, 6] : [2, 4, 0, 6, 1], 0)),
      ...[-1, 1].map((s) => gradient('popcorn', s * 7.6, 4.6, 5, 2, 0.6, 0.6, [0, 1, 2, 3])),
      ...diag('ticket', 0, 3.8, 12, 3, 0.62, 0.42, FIVE, 0, 2),
      ...[-1, 1].map((s) => line('candyapple', s * 9.6, -5.0, s * 9.6, -2.6, 3)),
      line('candyapple', -3.6, -13.4, 0.6, -13.4, 6),
      line('prizebunny', -6.0, 6.6, 6.0, 6.6, 9, 'cycle', 0),
      line('popcorn', 4.0, 8.6, 9.4, 8.6, 7),
      line('popcorn', -6.0, 10.6, -1.8, 10.6, 5), line('popcorn', 1.8, 10.6, 6.0, 10.6, 5),
      ...grid('balloon', -4.0, 12.8, 2, 2, 0.7, 0.7, [0, 3, 5, 2]), ...grid('balloon', 4.0, 12.8, 2, 2, 0.7, 0.7, [4, 1, 0, 6]),
      ...[-1, 1].map((s) => at('milkbottles', s * 9.0, 12.8, s < 0 ? 0 : 1, 0)),
    ],
  },
  {
    // Prize Alley: stalls too big to eat line the top, a shelf of bunnies in five colors
    // (purple is the target) and bottle stacks down both sides of the alley.
    id: 52, name: 'Prize Alley', world: 'fair', arena: { w: 24, d: 30 }, time: 210, start: [0, 12.8],
    targets: [{ id: 'milkbottles', n: 'all' }, { id: 'prizebunny', n: 'all', tint: 3 }, { id: 'popcorn', n: 'all' }],
    place: [
      at('prizestall', -7.8, -12.6, 0), at('prizestall', 7.8, -12.6, 1),
      ...diag('prizebunny', 0, -12.0, 7, 3, 0.7, 0.75, FIVE, 0, 2),
      ...[-1, 1].map((s) => line('milkbottles', s * 3.6, -8.0, s * 3.6, 4.0, 7, 'cycle', 0)),
      line('popcorn', 0, -8.4, 0, 4.4, 14),
      ...[-1, 1].map((s) => gradient('ticket', s * 7.6, -6.0, 6, 4, 0.62, 0.42, FIVE)),
      ...[-1, 1].flatMap((s) => [at('ticketbooth', s * 8.0, -0.8, s < 0 ? 0 : 2), ...ring('candyapple', s * 8.0, -0.8, 12, 2.0, [0, 1, 2, 3])]),
      ...[-1, 1].map((s) => grid('prizebunny', s * 8.8, 4.6, 3, 2, 0.7, 0.75, s < 0 ? [0, 3, 1, 2, 4, 0] : [2, 4, 0, 3, 1, 2])),
      ...[-1, 1].map((s) => line('pinwheel', s * 2.0, 6.4, s * 6.0, 6.4, 6, 'cycle', 0)),
      ...diag('ticket', 0, 8.4, 14, 2, 0.62, 0.42, FIVE, 0, 2),
      ...[-1, 1].map((s) => grid('prizebunny', s * 8.8, 9.8, 3, 2, 0.7, 0.75, s < 0 ? [1, 2, 3, 4, 0, 1] : [4, 0, 1, 2, 3, 4])),
      line('popcorn', -6.0, 10.6, -2.0, 10.6, 5), line('popcorn', 2.0, 10.6, 6.0, 10.6, 5),
      line('goldfishbag', -5.4, 12.8, -2.4, 12.8, 4), line('goldfishbag', 2.4, 12.8, 5.4, 12.8, 4),
      ...[-1, 1].map((s) => at('milkbottles', s * 9.6, 13.2, s < 0 ? 2 : 3, 0)),
    ],
  },
  {
    // GROWTH GATE: the two yellow bumper cars (one in the rink, one in the far corner)
    // fit only after a good meal. Carousel horses circle a ticket booth; tickets everywhere.
    id: 53, name: 'Bumper Cars', world: 'fair', arena: { w: 24, d: 32 }, time: 190, start: [0, 13.8],
    targets: [{ id: 'bumpercar', n: 'all', tint: 2 }, { id: 'carouselhorse', n: 'all' }, { id: 'ticket', n: 'all' }],
    place: [
      ...grid('bumpercar', 0, -10.4, 4, 3, 2.2, 1.6, [0, 3, 1, 4, 5, 2, 0, 1, 3, 4, 5, 0]),
      ...fence('milkbottles', 0, -10.4, 10.8, 6.8, 7, 3, { tint: [0, 1, 2, 3], gapBottom: 3.0 }),
      line('ticket', 7.6, -14.4, 10.4, -14.4, 5),
      at('ticketbooth', 7.6, -1.6, 0), ...ring('carouselhorse', 7.6, -1.6, 6, 2.6, [0, 1, 2, 3, 4, 0]),
      line('carouselhorse', -9.6, -5.4, -9.6, 1.4, 4, 'cycle', PI / 2),
      ...diag('ticket', -2.6, 1.6, 8, 3, 0.62, 0.45, FIVE, 0, 2),
      ...[-1, 1].map((s) => line('candyapple', s * 2.0, -5.6, s * 6.2, -5.6, 6)),
      line('balloon', -6.4, -2.6, -6.4, 3.4, 9, 'cycle', 0),
      ...grid('bumpercar', -6.6, 6.6, 3, 1, 2.2, 1.6, [1, 2, 5]),
      line('pinwheel', -1.6, 6.0, 4.8, 6.0, 8),
      ...gradient('popcorn', 3.6, 8.2, 8, 2, 0.62, 0.62, [0, 1, 2, 3]),
      ...diag('ticket', 0, 10.2, 14, 2, 0.62, 0.45, FIVE, 0, 3),
      line('goldfishbag', -10.4, 9.0, -10.4, 12.6, 5),
      line('prizebunny', -6.6, 12.2, -2.2, 12.2, 5), line('prizebunny', 2.2, 12.2, 6.0, 12.2, 4),
      at('bumpercar', 9.6, 13.4, 2, 0),
      line('ticket', -5.0, 14.6, -2.6, 14.6, 3), line('ticket', 2.6, 14.6, 5.0, 14.6, 3),
    ],
  },
  {
    // SCARCE FILLER: a full fair, but the two prize stalls are a big gate: the filler only
    // just covers them, so she has to eat nearly everything. Teacups twirl in the middle,
    // blue popcorn carts and the stalls sit in opposite corners.
    id: 54, name: 'Teacup Twirl', world: 'fair', arena: { w: 26, d: 34 }, time: 180, start: [0, 14.8],
    targets: [{ id: 'teacup', n: 'all' }, { id: 'popcorncart', n: 'all', tint: 1 }, { id: 'prizestall', n: 'all' }],
    place: [
      at('teacup', 0, -4.4, 0), ...ring('teacup', 0, -4.4, 5, 3.0, [1, 2, 3, 4, 0], 0),
      ring('candyapple', 0, -4.4, 22, 5.0, 'cycle'),
      at('prizestall', -8.8, -14.4, 0), at('prizestall', 8.8, 8.6, 3),
      at('popcorncart', 9.6, -14.2, 1), at('popcorncart', -9.6, 8.4, 1),
      at('popcorncart', -10.2, -3.0, 0), at('popcorncart', 10.2, -3.0, 2),
      ...grid('balloon', -3.6, -13.0, 4, 3, 0.7, 0.7, [4, 0, 2, 6, 3, 5, 1, 0, 2, 4, 6, 3]),
      ...grid('balloon', 3.6, -13.0, 4, 3, 0.7, 0.7, [1, 3, 5, 0, 6, 2, 4, 1, 0, 3, 5, 2]),
      ...diag('prizebunny', 0, 3.6, 12, 2, 0.75, 0.75, FIVE, 0, 2),
      ...[-1, 1].map((s) => line('popcorn', s * 8.0, 1.6, s * 8.0, 5.6, 6)),
      ...path('pinwheel', waveF(-6.0, 6.0, 7.2, 0.3, 2), 0.8, FIVE),
      ...diag('ticket', 0, 11.0, 16, 2, 0.62, 0.42, FIVE, 0, 2),
      ...[-1, 1].map((s) => line('candyapple', s * 6.0, 11.6, s * 10.0, 11.6, 5)),
      ...[-1, 1].map((s) => at('milkbottles', s * 10.6, 14.6, s < 0 ? 1 : 3, 0)),
    ],
  },
  {
    // CENTERPIECE: the grand carousel. Three prize stalls (two up top, one in the far
    // bottom corner) and purple balloons tucked into bunches all over the fair.
    id: 55, name: 'Grand Carousel', world: 'fair', arena: { w: 28, d: 38 }, time: 280, start: [0, 16.8],
    targets: [{ id: 'carousel', n: 'all' }, { id: 'prizestall', n: 'all' }, { id: 'balloon', n: 'all', tint: 5 }],
    place: [
      at('carousel', 0, -14.4, 0),
      at('prizestall', -9.0, -16.0, 0), at('prizestall', 9.0, -16.0, 2), at('prizestall', -10.0, 15.4, 1),
      ...[-1, 1].flatMap((s) => [at('bumpercar', s * 6.0, -13.0, s < 0 ? 1 : 3, 0), at('bumpercar', s * 10.6, -12.6, s < 0 ? 4 : 0, 0)]),
      // a two-row horse parade below the carousel
      line('carouselhorse', -9.6, -10.6, 9.6, -10.6, 8, 'cycle', 0),
      line('carouselhorse', -11.0, -9.5, 11.0, -9.5, 12, [2, 4, 1, 0, 3], 0),
      ...grid('bumpercar', -6.8, -5.2, 2, 3, 2.3, 1.7, [0, 3, 1, 2, 4, 5]),
      ...grid('teacup', 6.6, -5.4, 2, 2, 2.6, 2.6, [0, 2, 4, 1]), at('teacup', 11.4, -6.4, 3),
      ...grid('balloon', -11.4, -6.6, 2, 4, 0.7, 0.7, [0, 5, 3, 1, 6, 2, 5, 4]),
      ...grid('balloon', 11.4, -1.0, 2, 4, 0.7, 0.7, [2, 4, 5, 0, 3, 6, 1, 5]),
      ...grid('balloon', 0, -5.4, 3, 4, 0.7, 0.7, [1, 3, 6, 5, 0, 2, 4, 6, 5, 3, 1, 0]),
      ...diag('ticket', 0, -0.6, 14, 3, 0.62, 0.42, FIVE, 0, 2),
      ...diag('ticket', 0, 1.6, 14, 2, 0.62, 0.42, FIVE, 0, 3),
      ...[-1, 1].map((s) => at('bumpercar', s * 12.0, 2.0, s < 0 ? 2 : 5, 0)),
      ...[-1, 1].flatMap((s) => [at('popcorncart', s * 9.6, 4.0, s < 0 ? 0 : 2), at('ticketbooth', s * 4.2, 4.0, s < 0 ? 1 : 3)]),
      at('teacup', 0, 4.0, 2),
      ...path('pinwheel', waveF(-11.0, 11.0, 7.6, 0.4, 3), 0.8),
      ...path('candyapple', waveF(-11.0, 11.0, 9.0, 0.4, 3, PI), 0.7),
      ...diag('prizebunny', 0, 11.0, 12, 2, 0.75, 0.75, FIVE, 0, 2),
      ...grid('balloon', 9.6, 11.4, 4, 3, 0.7, 0.7, [5, 0, 3, 1, 2, 6, 4, 5, 1, 3, 0, 2]),
      ...grid('balloon', -6.0, 12.0, 3, 3, 0.7, 0.7, [3, 1, 5, 0, 6, 2, 4, 5, 1]),
      line('milkbottles', -12.0, 12.6, -8.6, 12.6, 3, 'cycle', 0),
      line('popcorn', -3.4, 13.6, 3.4, 13.6, 7), line('goldfishbag', -3.8, 15.0, -1.8, 15.0, 3), line('goldfishbag', 1.8, 15.0, 3.8, 15.0, 3),
      line('milkbottles', 5.4, 15.6, 11.8, 15.6, 6, 'cycle', 0),
    ],
  },

  // ======================================================== MOON CAMP
  {
    // A big star traced in stars of every color (the yellow ones are the target), four
    // telescopes pointing up from the corners, little constellations on the sides.
    id: 56, name: 'Stargazing', world: 'space', arena: { w: 22, d: 30 }, time: 140, start: [0, 12.8],
    targets: [{ id: 'star', n: 'all', tint: 0 }, { id: 'telescope', n: 'all' }],
    place: [
      ...starTrace('star', BIG_STAR, 0.58, [1, 2, 0, 3, 4, 5, 2, 1, 4, 3, 0, 5]),
      at('planet', 0, -5.6, 1), ring('moonrock', 0, -5.6, 8, 1.2, 'cycle'),
      ...[[-9.0, -13.0], [9.0, -13.0], [-9.0, 6.0], [9.0, 6.0]].map(([x, z], k) => at('telescope', x, z, k % 4, 0)),
      ...path('star', openF([[-9.6, -8.6], [-8.4, -7.0], [-9.2, -5.0], [-8.0, -3.0], [-9.4, -1.0], [-8.6, 1.6]]), 0.62, [3, 0, 4, 1, 5, 2]),
      ...path('star', openF([[9.6, -8.6], [8.4, -6.4], [9.4, -4.4], [8.2, -2.0], [9.6, 0.0], [8.8, 2.4]]), 0.62, [2, 5, 0, 4, 1, 3]),
      line('alien', -6.0, 2.8, 6.0, 2.8, 11, 'cycle', 0),
      ...[-1, 1].map((s) => line('spacepup', s * 3.6, 4.6, s * 6.6, 4.6, 3, 'cycle', 0)),
      ...diag('moonrock', 0, 6.8, 12, 2, 0.62, 0.62, [0, 1, 2, 3], 0, 1),
      line('planet', -6.0, 8.8, 6.0, 8.8, 9),
      ...diag('star', 0, 10.6, 14, 2, 0.6, 0.58, SIX, 0, 2),
      ...[-1, 1].map((s) => line('astronaut', s * 5.6, 12.8, s * 9.6, 12.8, 3, 'cycle', 0)),
      ...[-1, 1].map((s) => line('moonrock', s * 2.0, 13.4, s * 3.6, 13.4, 2)),
    ],
  },
  {
    // Alien picnics round four parked saucers; green aliens hide among five colors and
    // two more saucers wait in the far corners. Big planets are decoys.
    id: 57, name: 'Alien Picnic', world: 'space', arena: { w: 24, d: 30 }, time: 180, start: [0, 12.8],
    targets: [{ id: 'alien', n: 'all', tint: 0 }, { id: 'ufo', n: 'all' }],
    place: [
      ...[[-6.0, -9.6], [6.0, -9.6], [-6.0, 0.2], [6.0, 0.2]].flatMap(([x, z], k) => [
        at('ufo', x, z, k), ...ringCam('alien', x, z, 9, 1.55, [[1, 0, 2, 3, 4, 0, 1, 3, 2], [2, 4, 0, 1, 3, 2, 4, 0, 1], [3, 1, 4, 0, 2, 3, 1, 4, 2], [4, 2, 1, 3, 0, 4, 2, 1, 3]][k], PI / 9),
      ]),
      at('bigplanet', 0, -11.8, 0), at('bigplanet', 0, -4.6, 1),
      ring('moonrock', 0, -11.8, 12, 1.8, 'cycle'), ring('star', 0, -4.6, 12, 1.7, 'cycle'),
      at('ufo', -10.2, -13.2, 4), at('ufo', 10.2, 12.8, 0),
      ...path('alien', waveF(-9.6, 9.6, 5.0, 0.5, 2), 0.66, [2, 3, 0, 1, 4, 3, 2, 1, 4, 0]),
      ...[-1, 1].map((s) => line('planet', s * 10.6, -9.0, s * 10.6, 1.8, 8)),
      ...diag('star', 0, 7.4, 16, 2, 0.6, 0.58, SIX, 0, 2),
      ...[-1, 1].map((s) => line('spacepup', s * 2.4, 9.4, s * 7.4, 9.4, 5, 'cycle', 0)),
      ...diag('moonrock', 0, 10.6, 12, 2, 0.62, 0.62, [0, 1, 2, 3], 0, 1),
      line('astronaut', -9.6, 12.4, -6.0, 12.4, 3, 'cycle', 0),
      ...[-1, 1].map((s) => line('alien', s * 2.0, 13.4, s * 3.6, 13.4, 3, s < 0 ? [0, 3, 1] : [2, 0, 4], 0)),
    ],
  },
  {
    // GROWTH GATE + DECOYS: blue planets orbit a big sun, and big BLUE planets (too big
    // early) sit in the corners. Satellites wait in opposite corners; astronauts march.
    id: 58, name: 'Planet Parade', world: 'space', arena: { w: 24, d: 32 }, time: 190, start: [0, 13.8],
    targets: [{ id: 'planet', n: 'all', tint: 1 }, { id: 'satellite', n: 'all' }, { id: 'astronaut', n: 'all' }],
    place: [
      at('bigplanet', 0, -7.0, 5),
      ring('planet', 0, -7.0, 10, 2.4, 'cycle'), ring('planet', 0, -7.0, 15, 3.8, [2, 0, 3, 1, 4, 5]), ring('planet', 0, -7.0, 20, 5.2, [4, 5, 2, 0, 1, 3, 0]),
      ...[[-9.6, -13.6, 1], [9.6, -13.6, 2], [-9.6, -1.0, 3], [9.6, -1.0, 1]].map(([x, z, t]) => at('bigplanet', x, z, t)),
      at('satellite', -9.4, 4.0, 0, 0), at('satellite', 9.4, -8.6, 2, PI / 2), at('satellite', 0, 3.2, 1, 0),
      ...[-1, 1].map((s) => line('star', s * 6.6, -14.6, s * 10.6, -10.6, 6)),
      ...[-1, 1].map((s) => line('moonrock', s * 4.2, 1.2, s * 7.6, 3.6, 5)),
      line('astronaut', -6.0, 8.6, 6.0, 8.6, 9, 'cycle', 0),
      at('astronaut', 10.4, 14.6, 2), at('astronaut', -10.4, -6.2, 3),
      ...path('planet', waveF(-9.6, 9.6, 9.9, 0.3, 2), 1.0, [3, 1, 0, 5, 2, 4, 0, 5]),
      ...diag('star', 0, 11.6, 14, 2, 0.6, 0.58, SIX, 0, 2),
      ...[-1, 1].map((s) => line('alien', s * 7.2, 6.0, s * 10.6, 6.0, 5)),
      ...[-1, 1].map((s) => line('spacepup', s * 2.4, 14.6, s * 6.0, 14.6, 4, 'cycle', 0)),
    ],
  },
  {
    // SCARCE FILLER: launch day. Yellow rockets in a row of five colors, rovers and moon
    // domes spread to opposite corners; the filler only just covers the domes.
    id: 59, name: 'Launch Day', world: 'space', arena: { w: 22, d: 30 }, time: 140, start: [0, 12.8],
    targets: [{ id: 'rocketship', n: 'all', tint: 2 }, { id: 'moonrover', n: 'all' }, { id: 'domehab', n: 'all' }],
    place: [
      line('rocketship', -8.4, -12.6, 8.4, -12.6, 5, [0, 2, 1, 3, 2]),
      at('domehab', -7.6, -2.4, 0), at('domehab', 7.6, 3.6, 1), at('domehab', 0, -6.6, 2),
      at('moonrover', 7.6, -6.0, 0, 0), at('moonrover', -7.6, 5.6, 1, 0), at('moonrover', 0, 1.2, 3, 0),
      at('rocketship', 9.0, 12.0, 2), at('rocketship', -9.0, -8.6, 3),
      ...path('moonrock', arcF(0, -6.6, 2.4, PI * 0.15, PI * 0.85), 0.62),
      ...[-1, 1].map((s) => line('alien', s * 3.8, -4.0, s * 3.8, -0.8, 6)),
      at('ufo', -4.0, 3.2, 2), at('ufo', 4.6, 1.2, 3),
      ...diag('planet', 0, 5.0, 6, 2, 1.0, 0.9, SIX, 0, 2),
      ...[-1, 1].map((s) => line('spacepup', s * 5.2, 8.6, s * 9.0, 8.6, 4, 'cycle', 0)),
      ...diag('star', 0, 9.4, 12, 2, 0.6, 0.58, SIX, 0, 2),
      line('moonrock', -4.0, 11.4, -1.8, 11.4, 4), line('moonrock', 1.8, 11.4, 4.0, 11.4, 4),
    ],
  },
  {
    // CENTERPIECE: the moon base, with landers in both top corners. Blue space pups
    // hide among pups of four colors all over the camp.
    id: 60, name: 'Moon Base', world: 'space', arena: { w: 30, d: 40 }, time: 260, start: [0, 17.8],
    targets: [{ id: 'moonbase', n: 'all' }, { id: 'lander', n: 'all' }, { id: 'spacepup', n: 'all', tint: 1 }],
    place: [
      at('moonbase', 0, -16.4, 0),
      at('lander', -10.6, -15.6, 0), at('lander', 10.6, -15.6, 3),
      ...[-1, 1].map((s) => at('rocketship', s * 6.4, -16.4, s < 0 ? 1 : 0)),
      ...[-1, 1].flatMap((s) => [at('domehab', s * 5.6, -9.6, s < 0 ? 1 : 3), at('domehab', s * 11.2, -9.6, s < 0 ? 0 : 2)]),
      ...[[-2.4, -11.4], [2.4, -11.4]].map(([x, z], k) => at('satellite', x, z, k, 0)),
      ...[-1, 1].map((s) => at('rocketship', s * 8.4, -12.6, s < 0 ? 2 : 3)), line('star', -1.6, -13.4, 1.6, -13.4, 6),
      // the crater in the middle: moon rocks, stars, and pups all round it
      ring('moonrock', 0, -4.6, 16, 2.4, 'cycle'), ring('star', 0, -4.6, 9, 1.2, 'cycle'),
      ...ringCam('spacepup', 0, -4.6, 6, 3.4, [0, 1, 2, 3, 2, 0]),
      ...[-1, 1].flatMap((s) => [at('bigplanet', s * 6.6, -4.6, s < 0 ? 0 : 2), ...ringCam('alien', s * 6.6, -4.6, 9, 1.6, FIVE)]),
      at('bigplanet', -12.0, -4.0, 3), at('satellite', 12.0, -4.0, 3, PI / 2),
      ...[-1, 1].map((s) => at('telescope', s * 9.6, -1.8, s < 0 ? 0 : 2, 0)),
      ...[-1, 1].flatMap((s) => [at('domehab', s * 11.6, 1.6, s < 0 ? 2 : 0), at('moonrover', s * 7.0, 1.0, s < 0 ? 0 : 2, 0)]),
      ...diag('star', 0, 1.2, 14, 2, 0.6, 0.58, SIX, 0, 2),
      ring('ufo', 0, 5.6, 5, 1.9, 'cycle'), ring('moonrock', 0, 5.6, 6, 0.7, 'cycle'), at('star', 0, 5.6, 0),
      ...[-1, 1].map((s) => line('alien', s * 2.4, 3.2, s * 5.2, 3.2, 5)),
      ...[-1, 1].map((s) => at('telescope', s * 13.2, 4.0, s < 0 ? 3 : 1, 0)),
      ...[-1, 1].flatMap((s) => [at('bigplanet', s * 6.0, 6.0, s < 0 ? 4 : 1), at('moonrover', s * 10.4, 5.8, s < 0 ? 3 : 1, 0)]),
      ...path('star', waveF(-13.0, 13.0, 9.0, 0.4, 3), 0.6, [0, 1, 2, 3, 4, 5, 2, 0]),
      ...diag('spacepup', 0, 10.8, 10, 2, 0.8, 0.8, [0, 2, 3, 1, 0, 2, 3], 0, 2),
      ...[-1, 1].map((s) => line('alien', s * 5.6, 11.0, s * 12.6, 11.0, 9)),
      ...[-1, 1].map((s) => line('planet', s * 4.8, 12.8, s * 4.8, 15.6, 4)),
      ...diag('moonrock', 0, 13.4, 12, 5, 0.62, 0.62, [0, 1, 2, 3], 0, 1),
      ...[-1, 1].flatMap((s) => [at('rocketship', s * 12.0, 13.2, s < 0 ? 1 : 0), at('moonrover', s * 7.8, 13.4, s < 0 ? 3 : 1, 0)]),
      ...[-1, 1].map((s) => line('star', s * 2.2, 16.6, s * 7.6, 16.6, 10)),
      ...[-1, 1].map((s) => line('astronaut', s * 9.0, 16.6, s * 12.6, 16.6, 3, 'cycle', 0)),
      at('spacepup', -13.4, 18.4, 1), at('spacepup', 13.4, -12.4, 1),
    ],
  },
];

export const LEVELS = LIST.map((L) => ({ ...L, place: L.place.flat() }));
