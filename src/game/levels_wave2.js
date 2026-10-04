// Gulp Season 2: 15 levels, ids 31-45, 5 per world (candy, farm, snow). She has mastered
// Season 1, so these boards are bigger (20x28 up to 30x40), carry 2-3 target types with a
// color-specific one from level 32 on, and build to a big centerpiece every 5th level.
// Op semantics follow levelbuild.js: grid `gap` = centre pitch (gapX/gapZ override), ring
// item i sits at angle 2*PI*i/n from +x and faces outward unless `rot` is given, line spaces
// n items end to end, `at` is one prop. Fronts face +z (the camera). Only these four
// deterministic ops are used; the patterns below (arcs, spirals, rainbows, pens, forests,
// figure-eights) expand to plain `at` ops, so every position is fixed data.
// tools/check_levels.mjs validates spacing, bounds, targets and solvability.
const TAU = Math.PI * 2, PI = Math.PI;
const r3 = (v) => Math.round(v * 1000) / 1000;

// ------------------------------------------------------------------ plain ops
// buildLevel() understands numeric, 'cycle' and 'random' tints. A tint list ([0, 2, 1]...)
// cycles through those colors instead, so grid/ring/line ops with a list expand into `at`
// ops at exactly the positions (and facings) the placer would use.
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
// Sample a curve f(t) (t in 0..1) and return n points evenly spaced by arc length, each
// with the curve's heading (a rot whose local +z points along it).
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
// Points along a curve every `spacing` units (closed curves wrap).
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
const ellipseF = (cx, cz, rx, rz) => (t) => [cx + rx * Math.cos(t * TAU), cz + rz * Math.sin(t * TAU)];
// Figure-eight (lemniscate of Bernoulli), `a` = half width.
const eightF = (cx, cz, a) => (t) => { const u = t * TAU, d = 1 + Math.sin(u) ** 2; return [cx + (a * Math.cos(u)) / d, cz + (a * Math.sin(u) * Math.cos(u)) / d]; };
// Archimedean spiral from radius r0 to r1 over `turns`.
const spiralF = (cx, cz, r0, r1, turns, a0 = 0) => (t) => { const a = a0 + t * turns * TAU, r = r0 + (r1 - r0) * t; return [cx + r * Math.cos(a), cz + r * Math.sin(a)]; };
// Classic heart curve, `size` wide, lobes toward -z (up the screen), point toward the camera.
const heartF = (cx, cz, size) => (t) => {
  const a = t * TAU, k = size / 32;
  const x = 16 * Math.sin(a) ** 3, y = 13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a);
  return [cx + x * k, cz - (y + 2.5) * k];
};
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
// Ring as `at` ops with a custom facing: rot = PI/2 - a + turn (0 = outward, PI = swims
// counter-clockwise for props whose nose is local +x, like the duckling and cow).
function ringAt(id, cx, cz, n, r, tint = 'cycle', turn = 0, phase = 0) {
  return Array.from({ length: n }, (_, i) => { const a = phase + (i * TAU) / n; return at(id, cx + r * Math.cos(a), cz + r * Math.sin(a), tintOf(tint, i), PI / 2 - a + turn); });
}
// Ring facing the camera (rot 0) - for characters that should smile at her.
const ringCam = (id, cx, cz, n, r, tint = 'cycle', phase = 0) =>
  Array.from({ length: n }, (_, i) => { const a = phase + (i * TAU) / n; return at(id, cx + r * Math.cos(a), cz + r * Math.sin(a), tintOf(tint, i), 0); });
// Rainbow: concentric half-circle arcs over the top, one tint per band (innermost first).
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
// Rectangular pen of wall props (hay bales...) with optional one-slot gates.
// Long props run along each wall: rot 0 on the top/bottom rows, PI/2 on the sides.
// `gateN` middle slots of the `gate` side stay open.
function pen(id, cx, cz, nx, nz, pitch, sidePitch, { gate = null, gateN = 1, tint = 'cycle' } = {}) {
  const out = [], hw = ((nx - 1) * pitch) / 2, hd = (nz * sidePitch) / 2 + 0.06;
  let k = 0;
  for (const [z, side] of [[cz - hd - 0.32, 'top'], [cz + hd + 0.32, 'bottom']]) {
    for (let i = 0; i < nx; i++) {
      if (side === gate && Math.abs(i - (nx - 1) / 2) < gateN / 2) continue;
      out.push(at(id, cx - hw + i * pitch, z, tintOf(tint, k++), 0));
    }
  }
  for (const s of [-1, 1]) for (let j = 0; j < nz; j++) out.push(at(id, cx + s * (hw + pitch / 2 - 0.28), cz - ((nz - 1) * sidePitch) / 2 + j * sidePitch, tintOf(tint, k++), PI / 2));
  return out;
}
// Triangle of rows, widest at the bottom (z0), pointing up the screen: a little tree.
function triangle(id, cx, z0, rows, pitchX, pitchZ, tint = 'cycle') {
  const out = []; let k = 0;
  for (let j = 0; j < rows; j++) for (let i = 0; i < rows - j; i++) out.push(at(id, cx + (i - (rows - j - 1) / 2) * pitchX, z0 - j * pitchZ, tintOf(tint, k++), 0));
  return out;
}
// Staggered orchard/forest: rows offset by half a pitch, skipping spots too close to the
// given keep-out points ([x, z, r]); tint(c, r) picks the color per cell.
function forest(id, x0, x1, z0, z1, gx, gz, keepOut, tint, rot = 0) {
  const out = [];
  for (let r = 0, z = z0; z <= z1 + 1e-6; r++, z += gz) {
    for (let c = 0, x = x0 + (r % 2) * gx * 0.5; x <= x1 + 1e-6; c++, x += gx) {
      if (keepOut.some(([kx, kz, kr]) => Math.hypot(x - kx, z - kz) < kr)) continue;
      out.push(at(id, x, z, typeof tint === 'function' ? tint(c, r) : tint, rot));
    }
  }
  return out;
}

// ------------------------------------------------------------------ reusable bits
// A peppermint trail through the candy cane forest (shared by the trail and the forest's keep-out).
const CANE_TRAIL = (t) => [3.3 * Math.sin(t * 2 * PI), 8.6 - 21.4 * t];
const trailPts = samples(CANE_TRAIL, 0.85);
// Spiral for Sprinkle Swirl: jelly beans on one arm, peppermints on the other.
const SPIRAL_A = spiralF(0, -2.2, 2.25, 8.3, 2.4, 0), SPIRAL_B = spiralF(0, -2.2, 2.25, 8.3, 2.4, PI);
// Rainbow run of colors along a path: `run` items per color.
const runs = (order, run) => (i) => order[Math.floor(i / run) % order.length];

// Skating Pond: skates along a figure-eight, blades along the curve, none crowding the crossing.
const SKATES = (() => {
  const kept = [];
  for (const q of samples(eightF(0, -3.6, 5.8), 0.92, true)) if (kept.every((k) => Math.hypot(q[0] - k[0], q[1] - k[1]) >= 0.85)) kept.push(q);
  return kept.map(([x, z, h], i) => at('iceskate', x, z, i % 5, h - PI / 2));
})();
// Sledding Hill: two mirrored hills, each with two tracks of three sleds between snowball
// edges, every sled pointing downhill toward the middle of the board.
const SLED_RUNS = [-1, 1].flatMap((s) => {
  const d = [-0.8 * s, 0.6], n = [-0.6 * s, -0.8], B = [5.6 * s, -7.6], rot = Math.atan2(-d[1], d[0]), out = [];
  let k = s < 0 ? 0 : 2;
  for (const j of [-1, 1]) for (const t of [-1, 0, 1]) out.push(at('sled', B[0] + j * 1.2 * n[0] + t * 3 * d[0], B[1] + j * 1.2 * n[1] + t * 3 * d[1], k++ % 4, rot));
  for (const m of [-2.4, 0, 2.4]) {
    const cx = B[0] + m * n[0], cz = B[1] + m * n[1];
    out.push(line('snowball', r3(cx - 3.9 * d[0]), r3(cz - 3.9 * d[1]), r3(cx + 3.9 * d[0]), r3(cz + 3.9 * d[1]), 15, 0));
  }
  return out;
});

const LIST = [
  // ======================================================== CANDY LAND
  {
    id: 31, name: 'Gummy Rainbow', world: 'candy', arena: { w: 20, d: 28 }, time: 150, start: [0, 11.6],
    targets: [{ id: 'gummybear', n: 'all' }, { id: 'cottoncandy', n: 'all' }],
    place: [
      // a rainbow of gummy bears, red outside to green inside, every bear smiling at you
      ...rainbow('gummybear', 0, -2.4, 3.4, 0.75, [3, 2, 1, 0], 0.8, 0),
      // cotton candy clouds where the rainbow touches down
      ...[-1, 1].flatMap((s) => [at('cottoncandy', s * 7.3, -1.6, s < 0 ? 0 : 1), ...ringCam('cottoncandy', s * 7.3, -1.6, 4, 0.95, s < 0 ? [0, 2, 0, 3] : [1, 4, 1, 3], PI / 4)]),
      // and a pot of gold: a gumball machine in a ring of yellow jelly beans
      at('gumballmachine', 0, -2.4, 0),
      ring('jellybean', 0, -2.4, 12, 1.25, 2),
      line('swirlpop', -7.6, -11.8, 7.6, -11.8, 9, 'cycle', 0),
      line('marshmallow', -7.5, -9.6, 7.5, -9.6, 16),
      line('macaron', -8.3, -8.2, -8.3, -4.6, 5), line('macaron', 8.3, -8.2, 8.3, -4.6, 5),
      line('gumdrop', -5.0, 3.3, 5.0, 3.3, 11),
      ...gradient('jellybean', 0, 6.0, 10, 3, 1.0, 0.6, [0, 1, 2, 3, 6, 4, 5]),
      ...path('marshmallow', arcF(0, 6.8, 3.0, 0.35, PI - 0.35), 0.75),
      ...[-1, 1].flatMap((s) => [at('cupcake', s * 4.6, 10.4, s < 0 ? 0 : 1), ring('gumdrop', s * 4.6, 10.4, 6, 0.75)]),
      line('peppermint', -7.6, 1.0, -7.6, 12.0, 12), line('peppermint', 7.6, 1.0, 7.6, 12.0, 12),
    ],
  },
  {
    id: 32, name: 'Candy Cane Forest', world: 'candy', arena: { w: 22, d: 30 }, time: 170, start: [0, 12.8],
    targets: [{ id: 'candycane', n: 'all', tint: 0 }, { id: 'peppermint', n: 'all' }, { id: 'swirlpop', n: 'all' }],
    place: [
      // a winding peppermint trail through the forest, gateposts of swirl pops at both ends
      ...trailPts.map(([x, z], i) => at('peppermint', x, z, i % 5, 0)),
      at('swirlpop', -1.7, 9.4, 0), at('swirlpop', 1.7, 9.4, 4),
      at('swirlpop', -1.8, -13.2, 2), at('swirlpop', 1.8, -13.2, 5),
      // the forest: staggered canes in diagonal color stripes (red canes are the target)
      ...forest('candycane', -9.6, 9.6, -12.0, 4.3, 1.35, 1.15,
        [...trailPts.map(([x, z]) => [x, z, 1.25]), [-6.3, -7.2, 1.9], [6.4, -1.4, 1.9], [-6.2, 3.0, 1.7]],
        (c, r) => (c + 2 * r) % 5),
      // clearings: a cotton candy grove, a gumball machine, a marshmallow ring
      at('gumballmachine', -6.3, -7.2, 3), ring('marshmallow', -6.3, -7.2, 8, 1.05),
      at('cottoncandy', 6.4, -1.4, 3), ...ringCam('cottoncandy', 6.4, -1.4, 4, 0.95, [0, 1, 2, 4], PI / 4),
      at('gumballmachine', -6.2, 3.0, 2), ring('jellybean', -6.2, 3.0, 10, 1.05, 'cycle'),
      line('chocbar', -8.6, -13.6, -3.8, -13.6, 4, 'cycle', 0), line('chocbar', 3.8, -13.6, 8.6, -13.6, 4, 'cycle', 0),
      // the meadow by the start
      ...gradient('jellybean', 0, 11.6, 4, 2, 0.6, 0.6, [0, 2, 3, 4]).map((o) => ({ ...o, x: o.x - 4.6 })),
      ...gradient('jellybean', 0, 11.6, 4, 2, 0.6, 0.6, [5, 1, 6, 0]).map((o) => ({ ...o, x: o.x + 4.6 })),
      line('marshmallow', -5.6, 7.4, -2.8, 7.4, 4), line('marshmallow', 2.8, 7.4, 5.6, 7.4, 4),
      ...[-1, 1].flatMap((s) => [at('cupcake', s * 7.6, 10.6, s < 0 ? 2 : 3), ring('peppermint', s * 7.6, 10.6, 8, 1.05)]),
      line('gumdrop', -9.7, 6.0, -9.7, 13.6, 9), line('gumdrop', 9.7, 6.0, 9.7, 13.6, 9),
    ],
  },

  {
    id: 33, name: 'Sweet Shop', world: 'candy', arena: { w: 24, d: 30 }, time: 180, start: [0, 12.8],
    targets: [{ id: 'gumballmachine', n: 'all' }, { id: 'chocbar', n: 'all', tint: 1 }, { id: 'jellybean', n: 'all', tint: 0 }],
    place: [
      // the chocolate wall: one wrapper color per shelf (the blue shelf is the target)
      ...[0, 1, 2, 3, 4, 5].map((t, r) => grid('chocbar', 0, -12.85 + r * 0.66, 8, 1, 1.12, 1.12, t, 0)),
      at('swirlpop', -6.0, -11.2, 0), at('swirlpop', 6.0, -11.2, 3),
      grid('icecream', -8.9, -11.2, 2, 4, 0.8, 0.8), grid('icecream', 8.9, -11.2, 2, 4, 0.8, 0.8),
      // the counter: a row of gumball machines with a peppermint trim
      line('gumballmachine', -7.2, -6.6, 7.2, -6.6, 7, 'cycle', 0),
      line('peppermint', -7.0, -5.1, 7.0, -5.1, 15),
      // a big heart of pink jelly beans outlined in red (the red ones are the target)
      ...heartFill('jellybean', 0, 0.4, 6.4, 0.5, 5, 0),
      ...[-1, 1].flatMap((s) => [
        at('cake', s * 7.6, -0.6, s < 0 ? 0 : 2), ring('gumdrop', s * 7.6, -0.6, 12, 1.45),
        grid('gummybear', s * 7.6, 4.0, 3, 2, 0.75, 0.9, 'cycle', 0),
        at('cottoncandy', s * 9.0, 12.0, s < 0 ? 1 : 3), ring('sprinkle', s * 9.0, 12.0, 9, 1.0),
      ]),
      line('marshmallow', -10.4, -4.2, -10.4, 6.2, 12), line('marshmallow', 10.4, -4.2, 10.4, 6.2, 12),
      // by the door: a jelly bean rainbow, wrapped candies, peppermints
      ...gradient('jellybean', 0, 7.6, 12, 2, 0.75, 0.6, [1, 2, 3, 6, 4, 5]),
      line('candy', -6.0, 10.2, -1.6, 10.2, 6), line('candy', 1.6, 10.2, 6.0, 10.2, 6),
      line('peppermint', -5.6, 13.5, -2.0, 13.5, 5), line('peppermint', 2.0, 13.5, 5.6, 13.5, 5),
    ],
  },
  {
    id: 34, name: 'Sprinkle Swirl', world: 'candy', arena: { w: 26, d: 32 }, time: 210, start: [0, 13.8],
    targets: [{ id: 'cupcaketower', n: 'all' }, { id: 'cottoncandy', n: 'all', tint: 1 }, { id: 'cupcake', n: 'all' }],
    place: [
      at('cupcaketower', 0, -2.2, 0),
      // a two-armed swirl: rainbow runs of jelly beans on one arm, peppermints on the other
      ...samples(SPIRAL_A, 0.56).map(([x, z, h], i) => at('jellybean', x, z, runs([0, 1, 2, 3, 6, 4, 5], 9)(i), h - PI / 2)),
      ...samples(SPIRAL_B, 0.8).map(([x, z], i) => at('peppermint', x, z, i % 5, 0)),
      // frosted corners: a cupcake tower in a ring of cupcakes, swirl pops between them
      ...[-1, 1].flatMap((s) => [at('cupcaketower', s * 9.6, -12.6, s < 0 ? 2 : 4), ring('cupcake', s * 9.6, -12.6, 10, 2.0)]),
      line('swirlpop', -5.6, -13.6, 5.6, -13.6, 5, 'cycle', 0),
      // cotton candy clouds; the blue ones are the target
      ...[[-10.6, -5.0, 1], [10.6, -5.0, 0], [-10.6, 3.8, 2], [10.6, 3.8, 1]].flatMap(([x, z, t]) => [at('cottoncandy', x, z, t), ...ringCam('cottoncandy', x, z, 4, 0.95, t, PI / 4)]),
      // the bakery counter by the start
      ...path('donut', waveF(-8.5, 8.5, 8.6, 0.45, 2), 0.95),
      ...gradient('macaron', 0, 10.6, 14, 2, 0.62, 0.62, [0, 3, 1, 2, 4, 5]),
      ...[-1, 1].flatMap((s) => [at('gumballmachine', s * 9.8, 11.6, s < 0 ? 0 : 2), ring('marshmallow', s * 9.8, 11.6, 9, 1.1)]),
      line('sprinkle', -5.0, 13.0, -1.8, 13.0, 5), line('sprinkle', 1.8, 13.0, 5.0, 13.0, 5),
    ],
  },
  {
    id: 35, name: 'Cotton Candy Castle', world: 'candy', arena: { w: 28, d: 36 }, time: 270, start: [0, 15.8],
    targets: [{ id: 'cottoncastle', n: 'all' }, { id: 'candyhouse', n: 'all' }, { id: 'gummybear', n: 'all', tint: 4 }],
    place: [
      at('cottoncastle', 0, -14.2, 0),
      at('candyhouse', -9.4, -14.4, 0), at('candyhouse', 9.4, -14.4, 1), at('candyhouse', -9.4, -6.6, 3), at('candyhouse', 9.4, -6.6, 2),
      // candy cane fence before the castle, with a gap for the lane
      line('candycane', -6.6, -11.3, -1.8, -11.3, 5, 'cycle', 0), line('candycane', 1.8, -11.3, 6.6, -11.3, 5, 'cycle', 0),
      // lollipop lane guarded by purple gummy bears (the target), red and yellow ones behind
      line('swirlpop', -2.3, -9.6, -2.3, 2.8, 7, 'cycle', 0), line('swirlpop', 2.3, -9.6, 2.3, 2.8, 7, 'cycle', 0),
      line('gummybear', -3.5, -9.6, -3.5, 2.8, 12, 4, 0), line('gummybear', 3.5, -9.6, 3.5, 2.8, 12, 4, 0),
      line('gummybear', -4.4, -9.6, -4.4, 2.8, 12, 0, 0), line('gummybear', 4.4, -9.6, 4.4, 2.8, 12, 2, 0),
      ...[-1, 1].flatMap((s) => [
        at('gumballmachine', s * 9.4, -10.6, s < 0 ? 4 : 1), ring('marshmallow', s * 9.4, -10.6, 9, 1.1),
        line('chocbar', s * 6.2, -9.6, s * 6.2, 2.4, 9, 'cycle', PI / 2),
        at('layercake', s * 9.8, -2.4, s < 0 ? 0 : 2), at('cupcaketower', s * 9.8, 2.2, s < 0 ? 1 : 3),
        at('cake', s * 7.2, 6.8, 1), at('cupcaketower', s * 10.0, 6.4, s < 0 ? 4 : 0), at('layercake', s * 10.6, 10.4, 4),
        at('layercake', s * 5.8, -15.4, s < 0 ? 1 : 3),
        line('candycane', s * 12.4, -16.2, s * 12.4, -3.4, 9, 'cycle', 0),
        grid('candycane', s * 7.8, 14.2, 4, 3, 0.95, 0.75, 'cycle', 0),
        at('cottoncandy', s * 4.4, 15.4, s < 0 ? 0 : 1), ring('jellybean', s * 4.4, 15.4, 8, 0.95, 'cycle'),
      ]),
      // the sweet meadow by the start
      ...gradient('jellybean', 0, 6.6, 14, 3, 0.62, 0.55, [0, 1, 2, 3, 6, 5]),
      grid('gummybear', 0, 9.3, 8, 2, 0.75, 0.9, [0, 1, 2, 3, 5], 0),
      ...path('marshmallow', arcF(0, 9.2, 4.4, 0.45, PI - 0.45), 0.7),
      line('peppermint', -2.8, 14.6, -1.4, 14.6, 3), line('peppermint', 1.4, 14.6, 2.8, 14.6, 3),
    ],
  },

  // ======================================================== SUNNY FARM
  {
    id: 36, name: 'Chick Parade', world: 'farm', arena: { w: 22, d: 28 }, time: 160, start: [0, 11.8],
    targets: [{ id: 'chick', n: 'all' }, { id: 'duckling', n: 'all', tint: 2 }],
    place: [
      // the nursery pen full of chicks, its gate open at the bottom
      ...pen('haybale', 0, -9.4, 7, 3, 1.18, 1.18, { gate: 'bottom', gateN: 3, tint: [0, 0, 2, 0, 0, 1] }),
      grid('chick', 0, -9.4, 7, 3, 0.9, 0.9, [0, 0, 1, 0, 2, 0, 3]),
      // two chick parades marching out of the gate
      ...path('chick', (t) => [-1.0 + 1.3 * Math.sin(t * TAU), -6.4 + 9.6 * t], 0.62, [0, 0, 1, 0, 0, 2]),
      ...path('chick', (t) => [1.0 + 1.3 * Math.sin(t * TAU), -6.4 + 9.6 * t], 0.62, [0, 3, 0, 0, 1, 0]),
      // duck ponds: ducklings swimming laps around a rubber duck mama (brown ducklings = target)
      ...[-1, 1].flatMap((s) => [
        at('duck', s * 6.4, -1.2, 0, 0),
        ...ringAt('duckling', s * 6.4, -1.2, 7, 1.85, s < 0 ? [0, 2, 1, 0, 3, 2, 0] : [1, 0, 2, 0, 3, 0, 2], PI),
        ...ringAt('duckling', s * 6.4, -1.2, 4, 1.0, s < 0 ? [2, 0, 1, 3] : [0, 3, 2, 1], 0, PI / 4),
        ring('daisy', s * 6.4, -1.2, 14, 2.75, [0, 2, 0, 1, 0, 4, 0, 3]),
        line('milkcan', s * 8.0, -12.0, s * 8.0, -5.4, 7),
        at('milkcan', s * 3.6, 9.8, s < 0 ? 0 : 1), ring('chick', s * 3.6, 9.8, 7, 0.78, [0, 1, 0, 2, 0, 0, 3]),
        grid('pumpkin', s * 7.8, 10.4, 2, 2, 1.2, 1.2, [0, 1]),
      ]),
      // flower rows and a carrot row in the meadow
      ...gradient('tulip', 0, 5.2, 16, 1, 0.75, 0.6, [0, 1, 2, 4, 3]),
      ...gradient('daisy', 0, 6.0, 14, 1, 0.82, 0.6, [0, 1, 2, 3, 4]),
      line('carrot', -5.4, 7.2, 5.4, 7.2, 7, 'cycle', 0),
      line('haybale', -9.6, 2.4, -9.6, 8.0, 5, [0, 1], PI / 2), line('haybale', 9.6, 2.4, 9.6, 8.0, 5, [0, 1], PI / 2),
    ],
  },
  {
    id: 37, name: 'Piglet Pens', world: 'farm', arena: { w: 24, d: 30 }, time: 190, start: [0, 12.8],
    targets: [{ id: 'piglet', n: 'all' }, { id: 'haybale', n: 'all' }, { id: 'carrot', n: 'all', tint: 1 }],
    place: [
      // four hay bale pens, one piglet color each
      ...[[-5.7, -9.6, 0], [5.7, -9.6, 1], [-5.7, -3.0, 2], [5.7, -3.0, 3]].flatMap(([x, z, t]) => [
        ...pen('haybale', x, z, 4, 2, 1.18, 1.18, { gate: 'bottom', gateN: 2, tint: [0, 0, 1, 0, 2] }),
        grid('piglet', x, z, 3, 2, 1.05, 1.1, t, 0),
      ]),
      // the lane between the pens: apple crates and milk cans
      line('applecrate', 0, -11.6, 0, -1.2, 7, 'cycle', 0),
      line('milkcan', -1.5, -11.6, -1.5, -1.2, 9), line('milkcan', 1.5, -11.6, 1.5, -1.2, 9),
      line('pumpkin', -10.2, -12.4, -10.2, -1.4, 8, [0, 1, 2]), line('pumpkin', 10.2, -12.4, 10.2, -1.4, 8, [1, 0, 2]),
      // the vegetable patch: rows of carrots by color (purple is the target)
      ...[0, 2, 1, 2, 0].map((t, r) => line('carrot', -6.5, 2.4 + r * 0.8, 6.5, 2.4 + r * 0.8, 11, t, 0)),
      at('scarecrow', 9.0, 3.6, 0), at('scarecrow', -9.0, 5.2, 3),
      // by the start: chicks round the milk cans, ducklings on a stroll, apples
      ...[-1, 1].flatMap((s) => [at('milkcan', s * 4.4, 10.2, s < 0 ? 2 : 3), ring('chick', s * 4.4, 10.2, 7, 0.78, [0, 1, 0, 2, 0, 0, 3])]),
      ...path('duckling', waveF(-8.0, 8.0, 8.0, 0.3, 2), 1.0, [0, 1, 0, 3], { face: 'side' }),
      grid('apple', -8.6, 11.6, 3, 2, 0.8, 0.8, [0, 1, 2]), grid('apple', 8.6, 11.6, 3, 2, 0.8, 0.8, [2, 0, 1]),
      line('daisy', -6.4, 13.4, -3.4, 13.4, 4), line('daisy', 3.4, 13.4, 6.4, 13.4, 4),
    ],
  },
  {
    id: 38, name: 'Black Sheep', world: 'farm', arena: { w: 24, d: 32 }, time: 200, start: [0, 13.8],
    targets: [{ id: 'sheep', n: 'all', tint: 3 }, { id: 'scarecrow', n: 'all' }, { id: 'applecrate', n: 'all' }],
    place: [
      // the flock around the old tree; three black sheep hide among them
      at('tree', 0, -6.0, 0),
      ring('sheep', 0, -6.0, 7, 2.3, [0, 0, 1, 0, 2, 0, 0]),
      ring('sheep', 0, -6.0, 12, 3.85, [0, 2, 0, 0, 1, 3, 0, 0, 0, 0, 1, 0]),
      ring('sheep', 0, -6.0, 17, 5.4, [0, 0, 1, 3, 2, 0, 0, 4, 0, 0, 1, 0, 0, 3, 0, 2, 0]),
      // hay bale fence with a gate, the vegetable garden below it, a scarecrow at each corner
      line('haybale', -10.4, 2.0, -2.2, 2.0, 7), line('haybale', 2.2, 2.0, 10.4, 2.0, 7),
      ...[3.6, 4.4, 5.2, 6.0, 6.8, 7.6].map((z, r) => line('carrot', -6.4, z, 6.4, z, 10, (r * 2) % 3, 0)),
      at('scarecrow', -8.9, 3.6, 0), at('scarecrow', 8.9, 3.6, 1), at('scarecrow', -8.9, 7.4, 2), at('scarecrow', 8.9, 7.4, 4),
      // apple crates stacked in the corners, milk cans and hay by the flock
      grid('applecrate', -9.2, -13.6, 2, 2, 1.0, 0.75, 'cycle', 0), grid('applecrate', 9.2, -13.6, 2, 2, 1.0, 0.75, 'cycle', 0),
      grid('applecrate', -9.6, -2.4, 2, 2, 1.0, 0.75, 'cycle', 0), grid('applecrate', 9.6, -2.4, 2, 2, 1.0, 0.75, 'cycle', 0),
      line('milkcan', -7.6, -10.8, -7.6, -5.0, 6), line('milkcan', 7.6, -10.8, 7.6, -5.0, 6),
      line('haybale', -10.4, -9.6, -10.4, -6.0, 3, [0, 2], PI / 2), line('haybale', 10.4, -9.6, 10.4, -6.0, 3, [1, 0], PI / 2),
      // the farmyard by the start
      ...gradient('tulip', 0, 10.0, 12, 2, 0.6, 0.6, [0, 1, 2, 3, 4]),
      ...[-1, 1].flatMap((s) => [at('milkcan', s * 7.6, 11.6, 0), ring('chick', s * 7.6, 11.6, 8, 0.85, [0, 0, 1, 0, 2, 0, 3, 0])]),
      line('pumpkin', -4.6, 12.6, -2.6, 12.6, 2), line('pumpkin', 2.6, 12.6, 4.6, 12.6, 2),
    ],
  },
  {
    id: 39, name: 'Moo Meadow', world: 'farm', arena: { w: 26, d: 34 }, time: 230, start: [0, 14.8],
    targets: [{ id: 'cow', n: 'all' }, { id: 'applecrate', n: 'all' }, { id: 'wheelbarrow', n: 'all', tint: 2 }],
    place: [
      // the orchard, apple crates between the trees
      grid('tree', 0, -5.0, 3, 3, 2.4, 2.4, [0, 1, 2, 3]),
      ...[[-1.2, -6.2], [1.2, -6.2], [-1.2, -3.8], [1.2, -3.8]].map(([x, z], i) => at('applecrate', x, z, i % 3, 0)),
      // milk cans round the orchard, a dozen cows strolling laps around everything
      ring('milkcan', 0, -5.0, 20, 5.0),
      ...ringAt('cow', 0, -5.0, 12, 6.6, 'cycle', PI),
      // the barrow line along the top (blue ones are the target), hay and crates down the sides
      line('wheelbarrow', -10.0, -14.9, 10.0, -14.9, 6, [0, 2, 1, 3, 2, 0], 0),
      line('haybale', -11.2, -12.4, -11.2, -1.6, 7, [0, 1, 2], PI / 2), line('haybale', 11.2, -12.4, 11.2, -1.6, 7, [2, 0, 1], PI / 2),
      line('applecrate', -9.4, -12.0, -9.4, -3.0, 6, 'cycle', 0), line('applecrate', 9.4, -12.0, 9.4, -3.0, 6, 'cycle', 0),
      // the duck pond and the barrow stop
      at('duck', -7.4, 7.0, 1), ...ringAt('duckling', -7.4, 7.0, 7, 1.6, [0, 1, 2, 0, 3, 1, 0], PI),
      at('wheelbarrow', 7.6, 5.4, 2, 0), at('wheelbarrow', 7.6, 7.4, 3, 0),
      grid('piglet', 2.6, 6.4, 3, 1, 0.9, 1, [0, 1, 2], 0),
      // the start: chick parades, carrot rows, apples
      ...path('chick', waveF(-6.0, 6.0, 9.8, 0.35, 2), 0.62, [0, 0, 1, 0, 2]),
      ...[0, 2, 0].map((t, r) => line('carrot', -9.6, 11.4 + r * 0.7, -2.4, 11.4 + r * 0.7, 6, t, 0)),
      ...[1, 0, 2].map((t, r) => line('carrot', 2.4, 11.4 + r * 0.7, 9.6, 11.4 + r * 0.7, 6, t, 0)),
      grid('apple', -10.2, 14.6, 3, 2, 0.8, 0.8, [0, 1, 2]), grid('apple', 10.2, 14.6, 3, 2, 0.8, 0.8, [1, 2, 0]),
      line('milkcan', -3.6, 3.6, 3.6, 3.6, 7),
    ],
  },
  {
    id: 40, name: 'Big Red Barn', world: 'farm', arena: { w: 28, d: 38 }, time: 280, start: [0, 16.8],
    targets: [{ id: 'barn', n: 'all' }, { id: 'tractor', n: 'all' }, { id: 'scarecrow', n: 'all', tint: 0 }],
    place: [
      at('barn', 0, -15.2, 0),
      at('tree', -5.0, -12.2, 0), at('tree', 5.0, -12.2, 2), at('cow', -9.6, 12.0, 1, 0), at('cow', 9.6, 12.0, 3, 0),
      grid('haybale', -6.2, -15.6, 2, 3, 1.18, 0.7, [0, 1, 0], 0), grid('haybale', 6.2, -15.6, 2, 3, 1.18, 0.7, [1, 0, 2], 0),
      // sheep pens in the top corners
      ...[-1, 1].flatMap((s) => [...pen('haybale', s * 10.2, -14.6, 3, 2, 1.18, 1.18, { gate: 'bottom', tint: [0, 2] }), line('sheep', s * 10.7, -14.6, s * 9.7, -14.6, 2, [0, 1], 0)]),
      // the tractors parked in a row
      line('tractor', -9.0, -9.4, 9.0, -9.4, 4, [0, 1, 2, 3], 0),
      // fields: carrots on the left, pumpkins on the right, scarecrows watching (red ones = target)
      ...[-6.2, -5.4, -4.6, -3.8, -3.0, -2.2].map((z, r) => line('carrot', -11.6, z, -3.6, z, 7, r % 3, 0)),
      grid('pumpkin', 7.6, -4.2, 6, 4, 1.25, 1.25, [0, 1, 0, 2]),
      at('scarecrow', -7.6, -7.2, 0), at('scarecrow', 7.6, -7.4, 1), at('scarecrow', -7.6, -0.9, 3), at('scarecrow', 7.6, -0.8, 0),
      at('scarecrow', -11.6, 13.2, 2, PI / 2), at('scarecrow', 11.6, 13.2, 0, PI / 2),
      // the farm lane: milk cans down the middle, chicks following
      line('milkcan', -1.0, -7.4, -1.0, 0.6, 8), line('milkcan', 1.0, -7.4, 1.0, 0.6, 8),
      // the sheep meadow and the pig pen
      grid('sheep', -8.0, 5.6, 3, 3, 1.2, 1.6, [0, 0, 1, 0, 2, 0, 0, 3, 0], 0),
      ...pen('haybale', 8.0, 5.6, 4, 2, 1.18, 1.18, { gate: 'top', gateN: 2, tint: [0, 1] }), grid('piglet', 8.0, 5.6, 3, 2, 1.05, 1.1, [0, 1, 2], 0),
      line('cow', -10.0, 10.4, -6.0, 10.4, 2, 'cycle', 0), line('cow', 6.0, 10.4, 10.0, 10.4, 2, 'cycle', 0),
      at('wheelbarrow', -3.6, 10.6, 0, 0), at('wheelbarrow', 3.6, 10.6, 3, 0),
      ...path('chick', vwaveF(1.8, 8.6, 0, 0.6, 1.5), 0.62, [0, 0, 1, 0, 3]),
      line('applecrate', -5.4, 13.2, -2.0, 13.2, 3, 'cycle', 0), line('applecrate', 2.0, 13.2, 5.4, 13.2, 3, 'cycle', 0),
      line('chick', -4.4, 15.0, -1.6, 15.0, 5, [0, 1, 0, 2, 0]), line('chick', 1.6, 15.0, 4.4, 15.0, 5, [0, 3, 0, 1, 0]),
      ...[-1, 1].flatMap((s) => [at('tree', s * 11.6, 16.0, 1), ring('chick', s * 7.0, 16.0, 7, 0.78, [0, 1, 0, 2, 0, 3, 0]), at('milkcan', s * 7.0, 16.0, 1)]),
    ],
  },

  // ======================================================== SNOWY VILLAGE
  {
    id: 41, name: 'First Snow', world: 'snow', arena: { w: 22, d: 30 }, time: 160, start: [0, 12.8],
    targets: [{ id: 'snowman', n: 'all' }, { id: 'mitten', n: 'all', tint: 0 }],
    place: [
      // a ring of snowmen around the first snowy pine, snowballs at its feet
      at('snowpine', 0, -5.6, 0), ring('snowball', 0, -5.6, 12, 1.5),
      ...ringCam('snowman', 0, -5.6, 8, 4.1, 'cycle', PI / 8),
      // snowball pyramids and a jingle bell garland across the top
      ...[[-7.4, -10.4], [7.4, -10.4], [-7.8, -0.4], [7.8, -0.4]].flatMap(([x, z]) => triangle('snowball', x, z, 5, 0.47, 0.42, 0)),
      ...path('jinglebell', waveF(-8.6, 8.6, -13.2, 0.35, 3), 0.62),
      // two washing lines of mittens (the red ones are the target)
      ...path('mitten', waveF(-6.6, 6.6, 1.6, 0.25, 1.5), 1.05, [0, 1, 2, 3, 4]),
      ...path('mitten', waveF(-6.6, 6.6, 3.4, 0.25, 1.5, PI), 1.05, [2, 0, 4, 1, 3]),
      // a cocoa break, presents ringed with bells, pines in the corners
      line('mug', -4.4, 6.0, 4.4, 6.0, 7),
      ...[-1, 1].flatMap((s) => [at('present', s * 6.6, 7.6, s < 0 ? 0 : 2), ring('jinglebell', s * 6.6, 7.6, 10, 1.0), at('snowpine', s * 9.2, 12.6, s < 0 ? 1 : 3)]),
      line('snowball', -4.6, 8.4, 4.6, 8.4, 11, 0),
      line('mitten', -3.2, 10.4, -1.4, 10.4, 3, [0, 3, 1], 0.2), line('mitten', 1.4, 10.4, 3.2, 10.4, 3, [2, 0, 4], -0.2),
      line('jinglebell', -9.6, -8.6, -9.6, -3.0, 9), line('jinglebell', 9.6, -8.6, 9.6, -3.0, 9),
    ],
  },
  {
    id: 42, name: 'Gift Tree', world: 'snow', arena: { w: 24, d: 30 }, time: 180, start: [0, 12.8],
    targets: [{ id: 'present', n: 'all', tint: 0 }, { id: 'ornament', n: 'all' }, { id: 'gingerman', n: 'all' }],
    place: [
      // a tree stacked from presents, a golden ornament for the star, a gingerbread trunk
      ...triangle('present', 0, -1.8, 7, 0.84, 0.82, [0, 1, 2, 3, 4, 5, 2]),
      at('ornament', 0, -7.6, 1),
      at('gingerman', 0, -0.8, 0), at('gingerman', 0, 0.0, 3),
      // snowy pines dressed in rings of ornaments
      ...[[-7.6, -6.6], [7.6, -6.6], [-7.6, 0.8], [7.6, 0.8]].flatMap(([x, z], k) => [at('snowpine', x, z, k % 4), ring('ornament', x, z, 10, 1.55, 'cycle')]),
      // garland, candy canes from Candy Land and a gingerbread parade along the top
      ...path('jinglebell', waveF(-9.6, 9.6, -12.8, 0.4, 3), 0.62),
      line('candycane', -8.0, -11.6, 8.0, -11.6, 11, 'cycle', 0),
      line('gingerman', -8.4, -10.2, 8.4, -10.2, 13, 'cycle', 0),
      // the lower village: another parade, little present piles, mittens and snowballs
      line('gingerman', -6.0, 4.6, 6.0, 4.6, 9, 'cycle', 0),
      ...[-1, 1].flatMap((s) => [
        grid('present', s * 7.4, 7.0, 2, 2, 0.84, 0.84, s < 0 ? [1, 0, 3, 4] : [2, 5, 0, 1]),
        ring('snowball', s * 7.4, 7.0, 12, 1.55, 0),
        at('snowman', s * 9.6, 11.8, s < 0 ? 1 : 3),
      ]),
      ...gradient('mitten', 0, 7.4, 8, 1, 0.75, 0.6, [1, 2, 3, 4]),
      line('jinglebell', -4.2, 9.0, 4.2, 9.0, 13),
      line('snowball', -4.6, 10.6, -1.6, 10.6, 6, 0), line('snowball', 1.6, 10.6, 4.6, 10.6, 6, 0),
    ],
  },
  {
    id: 43, name: 'Skating Pond', world: 'snow', arena: { w: 24, d: 32 }, time: 200, start: [0, 13.8],
    targets: [{ id: 'iceskate', n: 'all' }, { id: 'snowglobe', n: 'all', tint: 1 }, { id: 'mug', n: 'all' }],
    place: [
      // the pond: a snowball rim around a figure-eight of skates
      ...path('snowball', ellipseF(0, -3.6, 7.6, 5.4), 0.56, 0, { closed: true }),
      ...SKATES,
      // snow globes on a shelf up top (blue ones are the target), pines in the corners
      line('snowglobe', -7.0, -12.8, 7.0, -12.8, 8, [0, 1, 2, 3, 4, 1, 2, 1], 0),
      ...[-1, 1].flatMap((s) => [
        at('snowpine', s * 10.0, -13.2, 0), at('snowpine', s * 10.0, -10.8, 2),
        at('gardenbench', s * 10.2, -3.6, s < 0 ? 1 : 2, PI / 2),
        at('sledkid', s * 9.6, -8.6, s < 0 ? 0 : 4), at('sledkid', s * 9.6, 1.4, s < 0 ? 2 : 5),
        at('snowman', s * 9.6, 12.4, s < 0 ? 0 : 2),
        ...triangle('snowball', s * 5.8, 11.6, 4, 0.47, 0.42, 0),
      ]),
      // the cocoa stand: a row of mugs, gingerbread waiting in line
      line('mug', -4.2, 3.6, 4.2, 3.6, 7),
      line('gingerman', -7.2, 6.4, 7.2, 6.4, 10, 'cycle', 0),
      ...gradient('jinglebell', 0, 8.6, 14, 1, 0.75, 0.6, [0, 2, 3, 4, 1]),
      line('mitten', -4.0, 10.4, -1.6, 10.4, 3, 'cycle', 0.2), line('mitten', 1.6, 10.4, 4.0, 10.4, 3, 'cycle', -0.2),
    ],
  },
  {
    id: 44, name: 'Sledding Hill', world: 'snow', arena: { w: 26, d: 34 }, time: 230, start: [0, 14.8],
    targets: [{ id: 'sled', n: 'all' }, { id: 'sledkid', n: 'all', tint: 3 }],
    place: [
      // two snowy hills with sled runs: snowball-edged tracks, sleds pointing downhill
      ...SLED_RUNS,
      // a pine forest along the top and down the sides
      line('snowpine', -10.4, -15.0, 10.4, -15.0, 9, 'cycle'),
      line('snowpine', -11.1, -12.6, -11.1, 1.4, 8, 'cycle'), line('snowpine', 11.1, -12.6, 11.1, 1.4, 8, 'cycle'),
      // a cheering crowd round a snowman at the bottom of the hill (purple jackets = target)
      at('snowman', 0, 3.0, 2), ...ringCam('sledkid', 0, 3.0, 8, 2.6, [0, 1, 3, 2, 4, 5, 3, 1], PI / 8),
      ...[-1, 1].flatMap((s) => [
        at('sled', s * 8.2, -1.4, s < 0 ? 0 : 1, 0), at('sled', s * 8.2, 0.4, s < 0 ? 2 : 3, 0),
        at('sledkid', s * 6.4, 6.6, s < 0 ? 3 : 0),
        grid('present', s * 9.6, 6.8, 2, 2, 0.84, 0.84, s < 0 ? [0, 2, 4, 1] : [3, 5, 0, 2]),
        ring('snowball', s * 7.2, 11.4, 10, 1.15, 0), at('mug', s * 7.2, 11.4, s < 0 ? 0 : 2),
      ]),
      // the bottom of the run: cocoa, cookies, mittens and bells
      line('mug', -3.6, 7.8, 3.6, 7.8, 6),
      ...gradient('cookie', 0, 9.4, 10, 1, 0.8, 0.6, [0, 1, 2, 3, 4, 5]),
      ...path('jinglebell', waveF(-4.8, 4.8, 11.2, 0.25, 2), 0.62),
      line('mitten', -4.4, 12.8, -1.6, 12.8, 4, 'cycle', 0.2), line('mitten', 1.6, 12.8, 4.4, 12.8, 4, 'cycle', -0.2),
    ],
  },
  {
    id: 45, name: 'Cozy Cabin', world: 'snow', arena: { w: 30, d: 40 }, time: 300, start: [0, 17.8],
    targets: [{ id: 'cabin', n: 'all' }, { id: 'igloo', n: 'all' }, { id: 'snowman', n: 'all', tint: 1 }],
    place: [
      at('cabin', 0, -16.6, 0),
      ...triangle('present', -4.7, -14.0, 4, 0.84, 0.82, [0, 2, 4, 1]), ...triangle('present', 4.7, -14.0, 4, 0.84, 0.82, [3, 5, 0, 2]),
      at('igloo', -10.4, -16.2, 0), at('igloo', 10.4, -16.2, 1), at('igloo', -10.4, 2.0, 2), at('igloo', 10.4, 2.0, 3),
      // the snowman family out front (blue scarves are the target)
      line('snowman', -6.6, -11.2, 6.6, -11.2, 5, [1, 0, 1, 4, 1]),
      // the village square: a frozen pond rim, a skating ring, a decorated pine in the middle
      ...path('snowball', ellipseF(0, -3.4, 6.4, 4.9), 0.56, 0, { closed: true }),
      ...ringAt('iceskate', 0, -3.4, 16, 3.5, 'cycle', PI),
      ring('jinglebell', 0, -3.4, 16, 2.45),
      at('snowpine', 0, -3.4, 0), ring('ornament', 0, -3.4, 10, 1.55),
      // the forest on both sides
      ...forest('snowpine', -13.2, -10.8, -13.0, 15.0, 2.4, 1.9, [[-10.4, 2.0, 3.0], [-10.4, -16.2, 3.0]], (c, r) => (c + r) % 4),
      ...forest('snowpine', 10.8, 13.2, -13.0, 15.0, 2.4, 1.9, [[10.4, 2.0, 3.0], [10.4, -16.2, 3.0]], (c, r) => (c + r + 1) % 4),
      // sleds, kids and teddies by the pond
      ...[-1, 1].flatMap((s) => [
        at('sled', s * 7.6, -8.4, s < 0 ? 0 : 2, 0), at('sled', s * 7.6, 1.6, s < 0 ? 1 : 3, 0),
        at('sledkid', s * 8.0, -5.6, s < 0 ? 3 : 1), at('teddy', s * 8.0, -1.6, s < 0 ? 0 : 2),
        at('snowman', s * 6.4, 6.0, s < 0 ? 0 : 1),
        grid('present', s * 6.4, 9.4, 2, 2, 0.84, 0.84, s < 0 ? [1, 3, 4, 0] : [2, 4, 5, 3]),
        line('gingerman', s * 3.2, 4.6, s * 3.2, 9.4, 6, 'cycle', 0),
      ]),
      // the walk from the start: cocoa, mittens, bells and snowballs
      line('mug', -5.2, 12.2, 5.2, 12.2, 8),
      ...gradient('mitten', 0, 13.8, 10, 1, 0.8, 0.6, [0, 1, 2, 3, 4]),
      ...path('jinglebell', waveF(-6.4, 6.4, 15.4, 0.25, 2), 0.62),
      line('snowball', -2.2, 6.6, 2.2, 6.6, 9, 0), line('snowball', -2.2, 8.6, 2.2, 8.6, 9, 0),
    ],
  },
];

export const LEVELS = LIST.map((L) => ({ ...L, place: L.place.flat() }));
