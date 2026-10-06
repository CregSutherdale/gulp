// Gulp Season 5: 15 levels, ids 76-90, 5 per world (Pet Shop, Under the Sea, Music Room).
// The LONG HAULS season. Season 4 hid targets among look-alikes; Season 5 is harder in a
// different way: the ROUTE is the puzzle.
//   - big boards (up to 32 x 42): with the Hole-It camera she sees a small part of the
//     board, so she plans the trip from the intro overview and works from memory,
//   - targets split into opposite corners and far ends, so every trip costs time,
//   - TWO-STAGE growth gates: a mid-size target only fits after eating one region, and
//     the final target needs most of the board,
//   - scarce-filler boards (79, 84, 89) where the filler just covers the gate (margin 1.3),
//   - 3 target types per board (4 on the finales), one of them a color in a mixed crowd.
// Fair: tools/check_levels.mjs requires 30% spare filler at CHALLENGE growth, and the
// validator must clear every board with a careful bot AND an erratic "human" driver.
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
// Ring facing the camera (rot 0) - characters smile at her.
const ringCam = (id, cx, cz, n, r, tint = 'cycle', phase = 0) =>
  Array.from({ length: n }, (_, i) => { const a = phase + (i * TAU) / n; return at(id, cx + r * Math.cos(a), cz + r * Math.sin(a), tintOf(tint, i), 0); });
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
// A rectangle (x0..x1, z0..z1) filled edge to edge with one prop at spacing gx/gz,
// colors in diagonal runs.
// SP spreads every zone out: big boards stay airy (a few hundred objects), so the long
// trips between regions are the cost, not wading through clutter.
const SP = 1.4;
function zone(id, x0, z0, x1, z1, gx, gz, tints, shift = 1, rot = 0) {
  gx *= SP; gz *= SP;
  const cols = Math.max(1, Math.floor((x1 - x0) / gx) + 1), rows = Math.max(1, Math.floor((z1 - z0) / gz) + 1);
  return diag(id, (x0 + x1) / 2, (z0 + z1) / 2, cols, rows, gx, gz, tints, rot, shift);
}

// ------------------------------------------------------------------ tint names (for reading)
// kibble: 0 brown, 1 orange, 2 green, 3 yellow, 4 pink      fishfood: 0 coral, 1 blue, 2 green, 3 yellow, 4 purple
// dogtreat: 0 tan, 1 pink, 2 green, 3 yellow, 4 lilac, 5 blue
// toymouse: 0 grey, 1 pink, 2 blue, 3 yellow, 4 mint, 5 lilac
// squeakyball / bigsqueaky: 0 pink, 1 blue, 2 yellow, 3 green, 4 purple, 5 orange
// petcollar: 0 red, 1 blue, 2 green, 3 purple, 4 orange, 5 pink    chewbone: 0 pink, 1 blue, 2 green, 3 orange, 4 purple, 5 red
// plushkitten: 0 ginger, 1 grey, 2 pink, 3 cream, 4 blue     plushpuppy: 0 tan, 1 cream, 2 blue, 3 yellow, 4 lilac
// petbowl / scratchpost / petbed: 0 pink, 1 blue, 2 green, 3 yellow, 4 purple
// tankpebble: 0 pink, 1 blue, 2 yellow, 3 green, 4 lilac, 5 white    bubbles: 0 aqua, 1 pink, 2 lilac, 3 mint, 4 lemon
// scallop: 0 coral, 1 pink, 2 yellow, 3 lilac, 4 aqua, 5 white     seastar / musicnote / guitarpick (RAINBOW): 0 red .. 4 blue, 5 purple, 6 pink
// seacoral: 0 coral, 1 orange, 2 purple, 3 yellow, 4 teal, 5 hot pink   toyanchor: 0 red, 1 navy, 2 gold, 3 teal
// toysub / bigsub: 0 yellow, 1 red, 2 blue, 3 green, 4 purple, 5 orange   diverhelmet: 0 brass, 1 copper, 2 silver, 3 teal
// handbell: 0 red, 1 orange, 2 yellow, 3 green, 4 blue, 5 purple    maraca: 0 red, 1 orange, 2 yellow, 3 green, 4 blue, 5 pink
// toydrum / bigdrum: 0 red, 1 blue, 2 yellow, 3 green, 4 purple, 5 pink   tambourine: 0 pink, 1 blue, 2 yellow, 3 green, 4 purple
const SIX = [0, 1, 2, 3, 4, 5];
const FIVE = [0, 1, 2, 3, 4];
const FOUR = [0, 1, 2, 3];
const RB7 = [0, 1, 2, 3, 4, 5, 6];

const LIST = [
  // ======================================================== PET SHOP
  {
    // A kibble trail snakes up the middle of the shop. Pink toy mice hide in mixed-color
    // clusters on both sides. TWO-STAGE: the pet beds along the back fit after the near
    // half; the two dog houses (far left, middle right) need most of the shop.
    id: 76, name: 'Kibble Trail', world: 'pets', arena: { w: 24, d: 32 }, time: 220, start: [0, 13.8],
    targets: [{ id: 'toymouse', n: 'all', tint: 1 }, { id: 'petbed', n: 'all' }, { id: 'doghouse', n: 'all' }],
    place: [
      ...path('kibble', vwaveF(12.0, -13.6, 0, 2.0, 1.5), 0.46, FIVE),
      // starter field
      ...zone('dogtreat', -10.4, 11.4, -4.0, 14.2, 0.64, 0.4, [0, 2, 3, 4, 5, 1], 2),
      ...zone('fishfood', 4.0, 11.4, 10.6, 14.2, 0.5, 0.5, FIVE, 2),
      // mice and squeaky balls up both sides
      ...zone('toymouse', -10.6, 4.4, -4.4, 8.6, 0.6, 0.8, SIX, 2),
      ...zone('squeakyball', 4.4, 4.4, 10.6, 8.6, 0.82, 0.82, SIX, 1),
      line('kibblebag', -10.2, 1.6, -4.6, 1.6, 5, 'cycle', 0),
      line('chewbone', 5.2, 1.6, 10.0, 1.6, 4, 'cycle', 0),
      // the right dog house in the middle of the shop
      at('doghouse', 9.4, -2.6, 2), line('petbowl', 5.0, -4.6, 5.0, -0.6, 3),
      ...grid('plushkitten', -7.6, -2.6, 4, 2, 1.25, 1.3, [0, 3, 1, 4, 2, 0, 3, 1]),
      ...zone('toymouse', 4.6, -8.8, 10.6, -6.0, 0.6, 0.8, [3, 5, 1, 0, 4, 2], 2),
      ...zone('dogtreat', -10.4, -8.6, -4.6, -6.2, 0.64, 0.4, [1, 0, 3, 5, 2, 4], 2),
      // the far end: the left dog house, the beds along the back
      at('doghouse', -9.4, -13.4, 0),
      at('petbed', -4.4, -13.6, 0), at('petbed', 7.8, -13.6, 3), at('petbed', 4.0, -13.6, 1),
      line('scratchpost', 3.4, -10.0, 9.6, -10.0, 4, 'cycle', 0),
      at('toymouse', -10.6, -10.0, 1), at('toymouse', 10.6, 9.9, 1),
    ],
  },
  {
    // Toy Aisle: rainbow aisles of squeaky balls down both sides (blue is the target), with
    // big BLUE squeaky balls as decoys. Chew bones wait top left, scratching posts bottom
    // right of the far half: the posts only fit after a good meal.
    id: 77, name: 'Toy Aisle', world: 'pets', arena: { w: 26, d: 36 }, time: 200, start: [0, 15.8],
    targets: [{ id: 'squeakyball', n: 'all', tint: 1 }, { id: 'chewbone', n: 'all' }, { id: 'scratchpost', n: 'all' }],
    place: [
      // two rainbow aisles (gradients, so blue is a band you must find on each side)
      ...gradient('squeakyball', -8.4, -4.0, 6, 9, 0.82, 0.82, [5, 2, 3, 1, 4, 0]),
      ...gradient('squeakyball', 8.4, 2.0, 6, 9, 0.82, 0.82, [0, 4, 1, 3, 2, 5]),
      // decoys: big squeaky balls down the middle, blue ones among them
      line('bigsqueaky', 0, -11.0, 0, 7.0, 7, [1, 0, 1, 2, 1, 3, 4]),
      // chew bones in the far left corner, scratching posts in the far right half
      ...grid('chewbone', -8.6, -14.6, 3, 2, 1.6, 1.0, SIX),
      ...grid('scratchpost', 9.0, -8.0, 2, 2, 1.6, 1.6, FIVE),
      at('scratchpost', -10.6, 9.6, 3),
      ...zone('kibble', 3.0, -15.6, 11.2, -12.6, 0.46, 0.46, FIVE, 2),
      ...zone('fishfood', -4.2, -15.4, 1.8, -12.2, 0.5, 0.5, FIVE, 1),
      ...zone('dogtreat', 3.2, -4.2, 11.0, -2.4, 0.64, 0.42, [0, 1, 2, 3, 4, 5], 2),
      ...zone('toymouse', -11.2, 3.2, -5.2, 6.4, 0.6, 0.8, SIX, 2),
      line('petcollar', -11.0, 8.0, -5.0, 8.0, 7),
      line('plushpuppy', 4.6, 9.6, 11.0, 9.6, 6, 'cycle', 0),
      // the starter field by the door
      ...zone('kibble', -11.2, 11.6, -2.0, 13.4, 0.46, 0.46, FIVE, 2),
      ...zone('dogtreat', 2.0, 11.6, 11.2, 13.6, 0.64, 0.42, [5, 2, 0, 3, 1, 4], 2),
      ...zone('fishfood', -11.0, 14.8, -2.2, 16.6, 0.5, 0.5, FIVE, 2),
      ...zone('squeakyball', 2.2, 14.8, 11.0, 16.4, 0.82, 0.82, [2, 1, 4, 0, 3, 5], 2),
    ],
  },
  {
    // Collar Counter: TWO-STAGE. Green collars hide among a counter of colors. Pet carriers
    // in the middle fit after eating the near half; the two dog houses stand at the far
    // left and the near right, and need most of the shop.
    id: 78, name: 'Collar Counter', world: 'pets', arena: { w: 28, d: 38 }, time: 230, start: [0, 16.8],
    targets: [{ id: 'petcollar', n: 'all', tint: 2 }, { id: 'petcarrier', n: 'all' }, { id: 'doghouse', n: 'all' }],
    place: [
      at('doghouse', -10.2, -15.2, 0), at('doghouse', 10.4, 9.6, 2),
      // the collar counter: diagonal color runs across the top
      ...zone('petcollar', -6.4, -16.6, 11.6, -13.2, 0.86, 0.86, SIX, 2),
      // carriers in the middle, around a bed of plush toys
      ...grid('petcarrier', 0, -6.2, 3, 2, 3.4, 2.6, FOUR),
      ...grid('plushkitten', -9.4, -9.6, 4, 2, 1.25, 1.3, [0, 3, 1, 4, 2, 0, 3, 1]),
      ...grid('kibblebag', 9.6, -9.8, 4, 2, 1.1, 1.0, FOUR),
      ...zone('squeakyball', -11.8, -4.8, -6.4, -1.0, 0.82, 0.82, SIX, 1),
      ...zone('kibble', -4.2, -1.4, 4.2, 0.6, 0.46, 0.46, FIVE, 2),
      line('chewbone', -11.4, 1.6, -4.2, 1.6, 6, 'cycle', 0),
      line('scratchpost', 4.0, 1.8, 11.6, 1.8, 5),
      ...zone('toymouse', -11.6, 3.8, -4.4, 7.4, 0.6, 0.8, SIX, 2),
      ...zone('petcollar', -3.2, 3.8, 3.2, 6.4, 0.86, 0.86, [0, 3, 2, 5, 1, 4], 2),
      line('petbowl', -11.4, 9.0, -4.4, 9.0, 7),
      line('plushpuppy', -2.6, 9.4, 4.6, 9.4, 7, 'cycle', 0),
      // the near half (eat this to fit the carriers)
      ...zone('fishfood', 2.2, 12.4, 12.4, 14.0, 0.5, 0.5, FIVE, 1),
      ...zone('dogtreat', -12.2, 14.6, -2.4, 17.6, 0.64, 0.42, [3, 0, 5, 1, 4, 2], 2),
      ...zone('squeakyball', 2.4, 15.0, 12.4, 17.6, 0.82, 0.82, [4, 0, 3, 5, 2, 1], 2),
      at('petcollar', 12.4, -6.0, 2), at('petcollar', -12.6, 10.2, 2),
    ],
  },
  {
    // SCARCE FILLER: bedtime. Pink plush kitties nap in a wide arc, pet beds wait in three
    // far-apart corners, and the one dog house at the very back needs nearly everything.
    id: 79, name: 'Bedtime Basket', world: 'pets', arena: { w: 28, d: 38 }, time: 240, start: [0, 16.8],
    targets: [{ id: 'plushkitten', n: 'all', tint: 2 }, { id: 'petbed', n: 'all' }, { id: 'doghouse', n: 'all' }],
    place: [
      at('doghouse', 0, -16.0, 1),
      at('petbed', -11.2, -15.6, 1), at('petbed', 11.2, -3.0, 3), at('petbed', -11.2, 15.6, 4),
      ...path('plushkitten', arcF(0, -5.0, 7.0, PI * 1.08, PI * 1.92), 1.3, [0, 2, 3, 1, 4, 2, 0, 3, 1, 2]),
      ...path('plushkitten', arcF(0, 1.0, 7.0, PI * 0.15, PI * 0.85), 1.3, [1, 4, 2, 0, 3, 2, 1, 4, 0]),
      ...ringCam('plushpuppy', 0, -1.5, 7, 2.6, FIVE),
      ...zone('kibble', -1.2, -2.6, 1.2, -0.4, 0.46, 0.46, FIVE, 2),
      ...zone('toymouse', -12.4, -11.6, -9.2, -8.0, 0.6, 0.8, SIX, 2),
      ...zone('dogtreat', 8.8, -11.6, 12.4, -8.4, 0.64, 0.42, SIX, 2),
      ...zone('fishfood', -12.4, -4.0, -9.0, 2.0, 0.5, 0.5, FIVE, 2),
      ...zone('squeakyball', 8.0, 2.0, 12.4, 6.4, 0.82, 0.82, SIX, 1),
      line('chewbone', -12.0, 8.4, -7.0, 8.4, 4, 'cycle', 0),
      line('petbowl', -5.6, 11.2, 5.6, 11.2, 8),
      ...zone('kibble', -8.4, 13.2, -2.4, 14.6, 0.46, 0.46, FIVE, 2),
      at('plushkitten', 12.4, 15.6, 2), at('plushkitten', -12.4, -6.0, 2),
    ],
  },
  {
    // CENTERPIECE: the cat tree at the very back. A dog house stands in each near corner,
    // blue plush puppies are spread over all four quarters, kibble bags line the walls.
    id: 80, name: 'Cat Tree Tower', world: 'pets', arena: { w: 32, d: 42 }, time: 300, start: [0, 18.8],
    targets: [{ id: 'cattree', n: 'all' }, { id: 'doghouse', n: 'all' }, { id: 'plushpuppy', n: 'all', tint: 2 }, { id: 'kibblebag', n: 'all' }],
    place: [
      at('cattree', 0, -17.8, 0),
      at('doghouse', -12.6, 13.8, 0), at('doghouse', 12.6, -6.0, 3),
      // four quarters of puppies (blue mixed in)
      ...grid('plushpuppy', -9.6, -13.6, 4, 2, 1.2, 1.25, [0, 2, 1, 3, 4, 2, 0, 1]),
      ...grid('plushpuppy', 9.6, -13.6, 4, 2, 1.2, 1.25, [1, 3, 2, 4, 0, 1, 2, 3]),
      ...grid('plushpuppy', -9.6, 3.6, 4, 2, 1.2, 1.25, [4, 2, 0, 1, 3, 4, 0, 2]),
      ...grid('plushpuppy', 9.6, 6.0, 4, 2, 1.2, 1.25, [2, 0, 4, 3, 1, 2, 3, 0]),
      line('kibblebag', -14.3, -10.0, -14.3, -1.0, 8, 'cycle', 0), line('kibblebag', 14.3, 0.0, 14.3, 7.8, 7, 'cycle', 0),
      // the middle: pet beds and carriers to grow on
      ...grid('petbed', 0, -9.6, 3, 1, 2.6, 2.6, [0, 2, 4]),
      ...grid('petcarrier', 0, -5.6, 3, 1, 2.6, 2.0, FOUR),
      line('scratchpost', -11.4, -6.4, -7.2, -6.4, 3), line('scratchpost', 7.2, -9.8, 10.8, -9.8, 3),
      line('bigsqueaky', -5.0, -1.6, 5.0, -1.6, 5),
      ...zone('chewbone', -12.6, -3.6, -8.6, -1.0, 1.42, 0.7, SIX, 2),
      ...zone('squeakyball', 7.0, -3.4, 11.2, 2.2, 0.82, 0.82, SIX, 1),
      ...zone('petbowl', -5.4, 1.6, 5.4, 3.0, 1.1, 1.1, FIVE, 2),
      ...zone('plushkitten', -5.4, 4.8, 5.4, 6.2, 1.15, 1.25, FIVE, 2),
      ...zone('toymouse', -14.4, 7.8, -6.4, 10.2, 0.6, 0.8, SIX, 2),
      ...zone('petcollar', 2.4, 8.6, 13.0, 10.4, 0.86, 0.86, SIX, 2),
      ...zone('dogtreat', -4.8, 8.4, 0.8, 10.6, 0.64, 0.42, SIX, 2),
      // the starter field
      ...zone('kibble', -9.6, 12.2, 9.6, 14.6, 0.46, 0.46, FIVE, 2),
      ...zone('fishfood', -8.6, 15.6, -2.4, 19.6, 0.5, 0.5, FIVE, 2),
      ...zone('dogtreat', 2.4, 15.6, 9.6, 19.6, 0.64, 0.42, SIX, 2),
      ...zone('squeakyball', 10.4, 12.6, 14.6, 19.6, 0.82, 0.82, SIX, 1),
    ],
  },

  // ======================================================== UNDER THE SEA
  {
    // Pebble Garden: a big pebble spiral fills the middle; yellow sea stars are scattered
    // through star beds of every color; treasure chests wait in opposite corners.
    id: 81, name: 'Pebble Garden', world: 'aquarium', arena: { w: 24, d: 34 }, time: 180, start: [0, 14.8],
    targets: [{ id: 'seastar', n: 'all', tint: 2 }, { id: 'conch', n: 'all' }, { id: 'treasurechest', n: 'all' }],
    place: [
      ...path('tankpebble', spiralF(0, -2.0, 1.75, 6.2, 2.4, 0), 0.52, SIX),
      at('giantclam', 0, -2.0, 1),
      at('treasurechest', -9.6, -14.6, 0), at('treasurechest', 9.6, -14.6, 2), at('treasurechest', 9.8, 10.6, 3),
      ...zone('seastar', -10.6, -12.2, -3.6, -9.8, 0.9, 0.9, RB7, 3),
      ...zone('seastar', 3.6, 6.4, 10.6, 8.8, 0.9, 0.9, RB7, 2),
      ...zone('scallop', 3.0, -15.6, 7.6, -12.0, 0.74, 0.74, SIX, 2),
      ...zone('scallop', -10.6, 5.6, -5.6, 9.0, 0.74, 0.74, SIX, 2),
      ...zone('bubbles', -6.6, -16.0, 0.8, -14.2, 0.68, 0.68, FIVE, 1),
      line('seacoral', -10.4, -7.6, -10.4, 3.6, 10),
      line('seacoral', 10.4, -10.6, 10.4, 3.6, 13),
      line('conch', -8.4, -6.4, -8.4, 2.6, 7, 'cycle', 0),
      line('diverhelmet', 8.2, -9.0, 8.2, 2.6, 6),
      ...zone('tankpebble', -10.4, 10.8, -2.2, 12.8, 0.45, 0.45, SIX, 2),
      ...zone('bubbles', 2.2, 12.6, 10.6, 15.6, 0.68, 0.68, FIVE, 2),
      ...zone('scallop', -10.6, 13.4, -2.4, 15.8, 0.74, 0.74, SIX, 2),
      at('seastar', -10.4, 10.0, 2), at('seastar', 10.6, -16.0 + 0.4, 2),
    ],
  },
  {
    // Coral Reef: teal corals hide in a reef of six colors. TWO-STAGE: toy subs swim in the
    // middle (eat the near reef first), the giant clams sit in the two far corners.
    id: 82, name: 'Coral Reef', world: 'aquarium', arena: { w: 26, d: 36 }, time: 210, start: [0, 15.8],
    targets: [{ id: 'seacoral', n: 'all', tint: 4 }, { id: 'toysub', n: 'all' }, { id: 'giantclam', n: 'all' }],
    place: [
      at('giantclam', -10.2, -15.0, 0), at('giantclam', 10.2, -15.0, 2),
      ...zone('seacoral', -6.6, -16.6, 6.6, -12.6, 1.08, 1.08, SIX, 2),
      // the subs in a convoy line through the middle
      ...grid('toysub', 0, -6.4, 3, 3, 3.0, 1.6, SIX),
      ...zone('seacoral', -11.6, -10.6, -6.0, -2.4, 1.08, 1.08, [1, 4, 0, 3, 5, 2], 2),
      ...zone('seacoral', 6.0, -10.6, 11.6, -2.4, 1.08, 1.08, [5, 2, 4, 0, 1, 3], 2),
      ...zone('scallop', -5.0, -1.0, 5.0, 1.4, 0.74, 0.74, SIX, 2),
      line('treasurechest', -11.0, 2.8, -4.8, 2.8, 4),
      line('conch', 4.8, 2.8, 11.2, 2.8, 5, 'cycle', 0),
      ...zone('seastar', -11.6, 4.4, -2.0, 6.4, 0.9, 0.9, RB7, 2),
      ...zone('bubbles', 2.0, 4.0, 11.6, 6.8, 0.68, 0.68, FIVE, 2),
      ...ring('seacoral', 0, 9.6, 9, 1.6, [0, 4, 2, 5, 1, 4, 3, 0, 2]), at('diverhelmet', 0, 9.6, 3),
      line('toyanchor', -11.0, 9.6, -4.0, 9.6, 5, 'cycle', 0),
      line('toyanchor', 4.0, 9.6, 11.0, 9.6, 5, 'cycle', 0),
      // near reef: eat it to fit the subs
      ...zone('tankpebble', -11.6, 12.2, -2.0, 14.2, 0.45, 0.45, SIX, 2),
      ...zone('scallop', -11.6, 15.0, -2.4, 16.6, 0.74, 0.74, SIX, 2),
      ...zone('bubbles', 2.4, 15.0, 11.6, 16.6, 0.68, 0.68, FIVE, 2),
      at('seacoral', -11.4, 11.4, 4),
    ],
  },
  {
    // Anchors Away: red anchors in a fleet of four colors; tank castles at the two far
    // corners of one side; the big subs (the final gate) wait at the opposite far ends.
    id: 83, name: 'Anchors Away', world: 'aquarium', arena: { w: 28, d: 38 }, time: 230, start: [0, 16.8],
    targets: [{ id: 'toyanchor', n: 'all', tint: 0 }, { id: 'tankcastle', n: 'all' }, { id: 'bigsub', n: 'all' }],
    place: [
      at('bigsub', 9.4, -16.6, 1), at('bigsub', -9.4, 12.4, 2),
      at('tankcastle', -11.0, -15.8, 0), at('tankcastle', 11.4, 4.6, 2),
      ...zone('toyanchor', -6.6, -12.0, 6.6, -8.4, 1.24, 1.5, FOUR, 1),
      ...zone('toyanchor', -12.0, -2.0, -4.6, 1.0, 1.24, 1.5, [1, 2, 0, 3], 1),
      ...zone('treasurechest', 3.4, -6.0, 9.6, -2.0, 1.55, 1.35, FOUR, 1),
      ...zone('toysub', -12.0, -7.4, -4.4, -4.4, 1.8, 1.0, SIX, 2),
      ...zone('seacoral', -5.4, -16.6, 3.6, -14.4, 1.08, 1.08, SIX, 2),
      ...zone('scallop', 2.0, 1.6, 12.2, 2.6, 0.74, 0.74, SIX, 2),
      ...zone('seastar', -3.4, -3.0, 1.6, 2.6, 0.9, 0.9, RB7, 2),
      ...zone('diverhelmet', -3.6, 4.6, 3.6, 7.6, 1.5, 1.5, FOUR, 1),
      ...zone('conch', 4.6, 7.4, 12.2, 9.4, 1.4, 0.8, FIVE, 2),
      ...zone('bubbles', -12.0, 3.6, -5.2, 7.6, 0.68, 0.68, FIVE, 2),
      ...zone('scallop', -3.6, 12.4, 12.2, 14.0, 0.74, 0.74, SIX, 2),
      ...zone('tankpebble', -12.2, 15.2, -2.2, 17.4, 0.45, 0.45, SIX, 3),
      at('toyanchor', 12.2, -12.4, 0), at('toyanchor', -12.2, 8.8, 0),
    ],
  },
  {
    // SCARCE FILLER: deep dive. Teal diver helmets among brass, copper and silver ones,
    // giant clams in three far-apart spots, and a big sub at the very back that needs
    // nearly the whole sea floor.
    id: 84, name: 'Deep Dive', world: 'aquarium', arena: { w: 28, d: 38 }, time: 240, start: [0, 16.8],
    targets: [{ id: 'diverhelmet', n: 'all', tint: 3 }, { id: 'giantclam', n: 'all' }, { id: 'bigsub', n: 'all' }],
    place: [
      at('bigsub', 0, -16.4, 3),
      at('giantclam', -11.0, -15.6, 1), at('giantclam', 11.0, -2.0, 4), at('giantclam', -11.0, 14.8, 0),
      ...ringCam('diverhelmet', 0, -6.0, 8, 3.2, [0, 3, 1, 2, 3, 0, 2, 1]), at('tankcastle', 0, -6.0, 3),
      ...zone('diverhelmet', 6.0, -14.8, 12.0, -10.8, 1.5, 1.5, [1, 0, 2, 3], 1),
      ...zone('seacoral', -12.0, -11.6, -6.6, -6.0, 1.08, 1.08, SIX, 2),
      ...zone('seastar', 6.0, -8.6, 12.2, -5.2, 0.9, 0.9, RB7, 2),
      ...zone('bubbles', -4.6, 0.4, 4.6, 3.2, 0.68, 0.68, FIVE, 2),
      line('conch', 5.4, 2.6, 12.0, 2.6, 5, 'cycle', 0),
      line('toyanchor', -12.0, 6.8, -7.0, 6.8, 4, 'cycle', 0),
      ...zone('tankpebble', -5.6, 13.0, 5.6, 14.6, 0.45, 0.45, SIX, 2),
      ...zone('scallop', -5.6, 15.6, -2.2, 17.4, 0.74, 0.74, SIX, 2),
      at('diverhelmet', 11.6, 10.6, 3), at('diverhelmet', -12.0, 4.4, 3),
    ],
  },
  {
    // CENTERPIECE: the sunken ship at the far end. Big subs at the near corners, treasure
    // chests spread to all four quarters, pink bubbles drifting all over the sea floor.
    id: 85, name: 'Sunken Ship', world: 'aquarium', arena: { w: 32, d: 42 }, time: 300, start: [0, 18.8],
    targets: [{ id: 'sunkenship', n: 'all' }, { id: 'bigsub', n: 'all' }, { id: 'treasurechest', n: 'all' }, { id: 'bubbles', n: 'all', tint: 1 }],
    place: [
      at('sunkenship', 0, -18.2, 0),
      at('bigsub', -12.4, 15.4, 0), at('bigsub', 12.4, 11.0, 4),
      ...[[-13.4, -18.6], [13.4, -18.6], [-13.6, -2.0], [13.6, 2.0], [0, 6.4]].map(([x, z], k) => at('treasurechest', x, z, k % 4)),
      ...grid('tankcastle', 0, -12.2, 3, 1, 4.6, 3, FOUR),
      ...grid('giantclam', 0, -7.6, 4, 1, 3.4, 3, [0, 2, 4, 1]),
      ...zone('toysub', -14.0, -14.6, -7.6, -10.4, 1.8, 1.0, SIX, 2),
      ...zone('toyanchor', 8.0, -15.0, 14.2, -10.6, 1.24, 1.5, FOUR, 1),
      ...zone('bubbles', -14.2, -5.6, -7.4, -3.6, 0.68, 0.68, FIVE, 2),
      ...zone('bubbles', 7.4, -5.6, 14.2, -3.4, 0.68, 0.68, [1, 3, 0, 4, 2], 2),
      ...zone('diverhelmet', -5.6, -3.6, 5.6, -0.6, 1.5, 1.5, FOUR, 1),
      ...zone('seacoral', -12.2, 0.4, -5.6, 4.2, 1.08, 1.08, SIX, 2),
      ...zone('conch', 5.6, 3.6, 12.2, 6.6, 1.4, 0.8, FIVE, 2),
      ...zone('seastar', -4.4, 1.6, 4.4, 3.6, 0.9, 0.9, RB7, 2),
      ...zone('scallop', -14.2, 6.6, -2.4, 9.0, 0.74, 0.74, SIX, 2),
      ...zone('bubbles', 2.4, 8.2, 9.0, 9.8, 0.68, 0.68, [4, 1, 2, 0, 3], 2),
      ...zone('tankpebble', -10.4, 11.2, 10.0, 13.6, 0.45, 0.45, SIX, 2),
      ...zone('scallop', -9.2, 15.0, 9.4, 16.6, 0.74, 0.74, SIX, 2),
      ...zone('bubbles', -9.0, 17.6, -2.4, 19.6, 0.68, 0.68, FIVE, 2),
      ...zone('tankpebble', 2.4, 17.6, 14.6, 19.6, 0.45, 0.45, SIX, 2),
      ...zone('tankpebble', -14.6, -9.0, -6.6, -7.6, 0.45, 0.45, SIX, 3),
      ...zone('seastar', 7.0, -9.0, 14.4, -7.4, 0.9, 0.9, RB7, 2),
    ],
  },

  // ======================================================== MUSIC ROOM
  {
    // Note Parade: notes march in a long wave up the room (the blue ones are targets), hand
    // bells ring the far corners, ukuleles rest at opposite ends.
    id: 86, name: 'Note Parade', world: 'music', arena: { w: 24, d: 34 }, time: 180, start: [0, 14.8],
    targets: [{ id: 'musicnote', n: 'all', tint: 4 }, { id: 'tambourine', n: 'all' }, { id: 'ukulele', n: 'all' }],
    place: [
      ...path('musicnote', vwaveF(12.6, -14.6, -2.6, 2.0, 2), 1.0, RB7),
      ...path('musicnote', vwaveF(12.6, -14.6, 2.6, 2.0, 2, PI), 1.0, [3, 5, 4, 0, 6, 2, 1]),
      at('ukulele', -9.2, -14.6, 0), at('ukulele', 9.2, 12.0, 3), at('ukulele', 9.2, -5.0, 5),
      ...zone('handbell', -10.6, -11.6, -6.8, -8.6, 0.7, 0.7, SIX, 2),
      ...zone('handbell', 6.8, -15.6, 10.6, -12.2, 0.7, 0.7, [3, 4, 5, 0, 1, 2], 2),
      ...zone('guitarpick', 6.8, -10.0, 10.6, -7.4, 0.58, 0.58, RB7, 3),
      ...zone('harmonica', -10.6, -6.4, -6.6, -2.0, 0.78, 0.4, FOUR, 1),
      line('tambourine', 6.4, -2.0, 9.8, -2.0, 3), at('tambourine', -10.2, -12.6, 2), at('tambourine', 8.4, 10.6, 1),
      line('maraca', -10.4, 0.4, -7.0, 0.4, 3, 'cycle', 0),
      ...zone('guitarpick', 6.8, 0.6, 10.6, 3.6, 0.58, 0.58, RB7, 2),
      ...zone('handbell', -10.6, 2.6, -6.8, 6.0, 0.7, 0.7, SIX, 3),
      line('drumsticks', 6.8, 5.6, 10.6, 5.6, 1, 'cycle', 0), line('drumsticks', 6.8, 6.6, 10.6, 6.6, 1, 'cycle', 0),
      line('toydrum', 7.4, 8.4, 10.4, 8.4, 3),
      ...zone('musicnote', -10.6, 8.0, -6.6, 10.6, 0.56, 0.8, RB7, 3),
      ...zone('guitarpick', -10.6, 12.0, -5.4, 15.8, 0.58, 0.58, RB7, 2),
      ...zone('harmonica', 5.0, 14.2, 10.6, 15.8, 0.78, 0.4, FOUR, 1),
      at('handbell', 10.6, 10.4, 4), at('musicnote', -10.6, -15.6, 4, 0),
    ],
  },
  {
    // Drum Circle: TWO-STAGE. Yellow toy drums in a big circle of every color; trumpets
    // wait at the far right after the circle is eaten; the big drums stand at the far
    // left corner and the near right, and need most of the room.
    id: 87, name: 'Drum Circle', world: 'music', arena: { w: 26, d: 36 }, time: 210, start: [0, 15.8],
    targets: [{ id: 'toydrum', n: 'all', tint: 2 }, { id: 'trumpet', n: 'all' }, { id: 'bigdrum', n: 'all' }],
    place: [
      at('bigdrum', -9.8, -14.6, 1), at('bigdrum', 9.6, 9.6, 4),
      ...ring('toydrum', 0, -4.0, 14, 4.4, [0, 2, 1, 3, 4, 5, 2]),
      ...ring('tambourine', 0, -4.0, 8, 2.2, FIVE), at('bigdrum', 0, -4.0, 2),
      ...grid('trumpet', 8.6, -14.6, 2, 3, 2.2, 1.3, FOUR),
      ...zone('guitarpick', -5.6, -16.6, 3.6, -14.6, 0.58, 0.58, RB7, 2),
      ...zone('handbell', -11.6, -10.0, -7.4, -6.6, 0.7, 0.7, SIX, 2),
      ...zone('maraca', 7.6, -8.8, 11.6, -5.6, 1.24, 0.56, SIX, 2),
      ...zone('musicnote', 7.4, -2.4, 11.6, 1.8, 0.56, 0.8, RB7, 2),
      line('xylophone', -10.8, 4.6, -5.4, 4.6, 3, 'cycle', 0),
      ...zone('drumsticks', -3.6, 3.4, 3.6, 6.0, 1.3, 0.4, FIVE, 2),
      line('toydrum', 5.6, 4.8, 11.4, 4.8, 5, [0, 1, 2, 3, 5]),
      ...zone('guitarpick', -11.6, 7.4, -2.4, 9.6, 0.58, 0.58, RB7, 2),
      ...zone('handbell', -11.6, 11.0, -2.4, 12.4, 0.7, 0.7, SIX, 2),
      ...zone('musicnote', 2.4, 12.4, 10.0, 13.4, 0.56, 0.8, RB7, 3),
      ...zone('harmonica', -11.6, 14.4, -2.4, 16.8, 0.78, 0.4, FOUR, 1),
      ...zone('guitarpick', 2.4, 14.4, 7.0, 16.8, 0.58, 0.58, RB7, 2),
      at('toydrum', -11.4, -16.4, 2), at('toydrum', 11.4, 11.6, 2),
    ],
  },
  {
    // Band Practice: pink maracas in a shaker band of six colors; xylophones in the far
    // left corner; gramophones at the far right and the near left (the long way round).
    id: 88, name: 'Band Practice', world: 'music', arena: { w: 28, d: 38 }, time: 230, start: [0, 16.8],
    targets: [{ id: 'maraca', n: 'all', tint: 5 }, { id: 'xylophone', n: 'all' }, { id: 'gramophone', n: 'all' }],
    place: [
      at('gramophone', 10.8, -15.6, 1), at('gramophone', -11.0, 14.6, 3), at('gramophone', 11.0, 2.0, 0),
      ...zone('xylophone', -12.0, -16.4, -5.6, -12.0, 1.85, 1.15, FOUR, 1),
      ...zone('maraca', -2.8, -16.4, 7.6, -13.4, 1.24, 0.56, SIX, 2),
      ...zone('maraca', -12.0, -8.4, -4.6, -4.4, 1.24, 0.56, [5, 0, 2, 4, 1, 3], 2),
      line('trumpet', 5.0, -8.6, 11.4, -8.6, 3, 'cycle', 0),
      ...zone('toydrum', -3.2, -10.0, 2.4, -6.6, 1.35, 1.35, SIX, 1),
      line('ukulele', -11.0, 0.0, -5.0, 0.0, 2, 'cycle', 0),
      ...zone('tambourine', -2.6, -4.0, 3.6, 0.4, 1.04, 1.04, FIVE, 2),
      ...zone('handbell', 5.6, -4.4, 12.2, -1.4, 0.7, 0.7, SIX, 2),
      ...zone('musicnote', -12.2, 3.6, -5.2, 5.6, 0.56, 0.8, RB7, 2),
      ...zone('maraca', 5.4, 6.4, 12.2, 9.4, 1.24, 0.56, [3, 5, 1, 0, 4, 2], 2),
      ...zone('harmonica', -7.6, 7.0, 3.6, 9.2, 0.78, 0.4, FOUR, 1),
      ...zone('handbell', 2.4, 10.8, 12.2, 12.2, 0.7, 0.7, SIX, 2),
      ...zone('guitarpick', 2.2, 14.6, 12.2, 17.6, 0.58, 0.58, RB7, 3),
      ...zone('musicnote', -8.6, 14.6, -2.2, 17.4, 0.56, 0.8, RB7, 2),
      at('maraca', 11.6, 13.6, 5), at('maraca', -11.6, 8.4, 5),
    ],
  },
  {
    // SCARCE FILLER: quiet hour. Green hand bells hide in a bell choir; toy keyboards line
    // the far left and the near right; two big drums at the far corners need nearly all.
    id: 89, name: 'Quiet Hour', world: 'music', arena: { w: 28, d: 38 }, time: 240, start: [0, 16.8],
    targets: [{ id: 'handbell', n: 'all', tint: 3 }, { id: 'toykeyboard', n: 'all' }, { id: 'bigdrum', n: 'all' }],
    place: [
      at('bigdrum', -10.6, -15.2, 0), at('bigdrum', 10.6, -15.2, 3),
      line('toykeyboard', -11.0, -10.4, -11.0, -5.0, 3, 'cycle', PI / 2), line('toykeyboard', 11.0, 8.0, 11.0, 13.4, 3, 'cycle', PI / 2),
      // the bell choir: rows in six colors
      ...zone('handbell', -4.6, -16.4, 4.6, -12.6, 0.72, 0.72, SIX, 2),
      ...zone('handbell', -3.6, -2.0, 3.6, 1.6, 0.72, 0.72, [3, 1, 5, 0, 4, 2], 2),
      ...zone('guitarpick', 5.6, -2.4, 9.4, 1.8, 0.58, 0.58, RB7, 2),
      ...zone('musicnote', -8.4, 12.6, 6.4, 13.6, 0.56, 0.8, RB7, 3),
      ...zone('harmonica', -7.4, 15.6, -2.4, 17.6, 0.78, 0.4, FOUR, 1),
      ...zone('guitarpick', 2.4, 15.2, 7.4, 17.6, 0.58, 0.58, RB7, 2),
      at('handbell', 12.2, 4.6, 3), at('handbell', -12.2, 4.8 + 6.0, 3),
    ],
  },
  {
    // CENTERPIECE: the grand piano on the far stage. Gramophones in the near corners, big
    // drums at the far sides, blue guitar picks scattered across the whole room.
    id: 90, name: 'Grand Recital', world: 'music', arena: { w: 32, d: 42 }, time: 300, start: [0, 18.8],
    targets: [{ id: 'grandpiano', n: 'all' }, { id: 'gramophone', n: 'all' }, { id: 'bigdrum', n: 'all' }, { id: 'guitarpick', n: 'all', tint: 4 }],
    place: [
      at('grandpiano', 0, -17.6, 0),
      at('gramophone', -13.6, 17.6, 0), at('gramophone', 13.6, 13.6, 2),
      at('bigdrum', -12.6, -17.4, 1), at('bigdrum', 12.6, -6.0, 4),
      ...grid('toykeyboard', 0, -11.0, 3, 1, 3.4, 2, FIVE),
      ...grid('xylophone', -9.6, -12.6, 2, 2, 2.4, 1.6, FOUR), ...grid('ukulele', 9.6, -12.8, 2, 2, 2.5, 1.3, SIX),
      ...zone('trumpet', -14.0, -8.0, -7.4, -5.0, 1.65, 0.65, FOUR, 1),
      ...ring('toydrum', 0, -4.4, 10, 3.0, SIX), at('tambourine', 0, -4.4, 0),
      ...zone('maraca', 6.0, -2.0, 12.0, 1.4, 1.24, 0.56, SIX, 2),
      ...zone('drumsticks', -12.6, -2.6, -5.8, 0.2, 1.3, 0.4, FIVE, 2),
      ...zone('guitarpick', -4.4, 0.6, 4.4, 2.4, 0.58, 0.58, RB7, 2),
      ...zone('handbell', -14.2, 2.6, -6.2, 5.4, 0.7, 0.7, SIX, 2),
      ...zone('tambourine', 4.2, 3.6, 12.2, 5.8, 1.04, 1.04, FIVE, 2),
      ...zone('musicnote', -4.4, 4.0, 2.4, 6.6, 0.56, 0.8, RB7, 2),
      ...zone('guitarpick', -14.2, 8.0, -4.4, 10.4, 0.58, 0.58, RB7, 3),
      ...zone('harmonica', -2.4, 8.0, 8.6, 10.4, 0.78, 0.4, FOUR, 1),
      ...zone('handbell', 9.4, 7.8, 14.4, 10.6, 0.7, 0.7, SIX, 2),
      ...zone('guitarpick', -10.2, 12.4, 10.2, 13.8, 0.58, 0.58, RB7, 2),
      ...zone('musicnote', -11.0, 15.4, -2.4, 16.6, 0.56, 0.8, RB7, 2),
      ...zone('harmonica', 2.4, 15.4, 11.0, 19.6, 0.78, 0.4, FOUR, 1),
      ...zone('guitarpick', -10.6, 17.8, -2.4, 19.6, 0.58, 0.58, RB7, 2),
      ...zone('guitarpick', -5.6, -14.6, 5.6, -13.0, 0.58, 0.58, RB7, 3),
      at('guitarpick', -14.6, -14.6, 4), at('guitarpick', 14.6, 19.6, 4),
    ],
  },
];

// Every board opens with a little arc of the world's tiniest filler just ahead of the
// hole, so the first second of play is eating, not driving across empty floor.
const STARTER = { pets: ['kibble', FIVE], aquarium: ['tankpebble', SIX], music: ['guitarpick', RB7] };
const starter = (L) => { if (L.id === 76) return []; const [id, t] = STARTER[L.world]; return path(id, arcF(L.start[0], L.start[1], 1.9, PI * 1.17, PI * 1.83), 0.6, t); }; // 76 opens on its kibble trail
export const LEVELS = LIST.map((L) => ({ ...L, place: [...L.place.flat(), ...starter(L)] }));

// Per-level CHALLENGE tuning (filled from validator runs: see docs/season5/TUNING.md).
//   times: ceil5(1.35 * B + 6), B = slower bot clear of two CHALLENGE runs
//   pars:  [ceil5(B + 3), ceil5(1.15B + 5)]     relaxedPars: Easy run E -> [ceil5(2.2E + 15), ceil5(3.4E + 25)]
export const TUNING = {
  times: {},
  grow: { 76: 0.6, 77: 0.55, 78: 0.58, 79: 0.57, 80: 0.62, 81: 0.6, 82: 0.55, 83: 0.58, 84: 0.6, 85: 0.68, 86: 0.6, 87: 0.57, 88: 0.57, 89: 0.55, 90: 0.62 },
  pars: {},
  relaxedPars: {},
};
