// Gulp Season 6: 15 levels, ids 91-105, 5 per world (spa, pumpkin, holiday).
// Theme: TIGHT SQUEEZE. Harder in a new way (not look-alikes alone, not long routes):
// PRECISION. The targets are the TINIEST things on the board (fit 0.26-0.44: bath pearls,
// acorns, baubles, bows) and they sit
//   - NESTLED in the gaps of dense carpets of slightly bigger filler (bath bombs, leaves,
//     little presents), so sloppy steering eats the carpet and wastes time,
//   - as 1 of 6-7 colors in those carpets (the pink pearls hide among pink bath bombs),
//   - THREADED along narrow curving lanes between big props that only fit late (big
//     bubbles, big pumpkins, big presents, towel stacks, hay rolls),
// and every board pairs that precision phase early with a growth gate late (a big target
// that only fits after most of the board is eaten). Growth 0.55-0.6 (TUNING.grow).
// Fair: tools/check_levels.mjs requires 30% spare filler at CHALLENGE growth, and the
// validator must clear every board with a careful bot and an erratic "human" driver.
// Only grid/ring/line/at ops; the patterns expand to plain `at` ops (same helpers as
// levels_wave3.js, copied so this file stands alone).
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
// A wall of props running beside a curve, `off` to its right (negative = left). Used for
// the big props that hem in a lane of tiny targets. skip(i, x, z) drops a slot.
// `room` = [w, d] footprint (axis-aligned) that must stay clear of the earlier pieces: on the
// inside of a bend the offset points bunch up, and the crowded ones are dropped.
function rail(id, f, spacing, off, tint = 'cycle', { room = null, zmin = -Infinity, zmax = Infinity } = {}) {
  const out = [], kept = [];
  samples(f, spacing).forEach(([x, z, h], i) => {
    const px = x + Math.cos(h) * off, pz = z - Math.sin(h) * off;
    if (pz < zmin || pz > zmax) return;
    if (room && kept.some(([qx, qz]) => Math.abs(qx - px) < room[0] + 0.12 && Math.abs(qz - pz) < room[1] + 0.12)) return;
    kept.push([px, pz]);
    out.push(at(id, px, pz, tintOf(tint, kept.length - 1), 0));
  });
  return out;
}
const waveF = (x0, x1, z, amp, waves, ph = 0) => (t) => [x0 + (x1 - x0) * t, z + amp * Math.sin(t * waves * TAU + ph)];
const vwaveF = (z0, z1, x, amp, waves, ph = 0) => (t) => [x + amp * Math.sin(t * waves * TAU + ph), z0 + (z1 - z0) * t];
const arcF = (cx, cz, r, a0, a1) => (t) => { const a = a0 + (a1 - a0) * t; return [cx + r * Math.cos(a), cz + r * Math.sin(a)]; };
const spiralF = (cx, cz, r0, r1, turns, a0 = 0) => (t) => { const a = a0 + t * turns * TAU, r = r0 + (r1 - r0) * t; return [cx + r * Math.cos(a), cz + r * Math.sin(a)]; };
// Grid with each row's colors shifted (diagonal color runs: a target color never lines up).
function diag(id, cx, cz, cols, rows, gx, gz, tints, rot = 0, shift = 1) {
  const out = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out.push(at(id, cx + (c - (cols - 1) / 2) * gx, cz + (r - (rows - 1) / 2) * gz, tints[(c + r * shift) % tints.length], rot));
  return out;
}
// TIGHT SQUEEZE: tiny props tucked into the gaps of a carpet laid by diag()/grid() with the
// same center, size and spacing. One goes in every `every`-th gap (scattered, not in rows);
// tints cycle through `tints` starting at `t0`, so the target color lands here and there.
function nestle(id, cx, cz, cols, rows, gx, gz, tints, every = 1, t0 = 0) {
  const out = [];
  let k = 0;
  for (let r = 0; r < rows - 1; r++) for (let c = 0; c < cols - 1; c++) {
    if ((c * 3 + r * 5) % every) continue;
    out.push(at(id, cx + (c + 0.5 - (cols - 1) / 2) * gx, cz + (r + 0.5 - (rows - 1) / 2) * gz, tints[(t0 + k++) % tints.length], 0));
  }
  return out;
}
// carpet + nestled tiny props in one call
const carpet = (id, tid, cx, cz, cols, rows, gx, gz, tints, ttints, every = 1, t0 = 0, shift = 1) =>
  [...diag(id, cx, cz, cols, rows, gx, gz, tints, 0, shift), ...nestle(tid, cx, cz, cols, rows, gx, gz, ttints, every, t0)];

// ------------------------------------------------------------------ tint names (for reading)
// bathbead: 0 pink, 1 lilac, 2 aqua, 3 peach, 4 mint, 5 pearl white, 6 gold
// spabubble / bigbubble: 0 blue, 1 pink, 2 lilac, 3 mint, 4 yellow, 5 peach
// bathbomb: 0 pink, 1 purple, 2 teal, 3 yellow, 4 green, 5 coral
// squeakduck: 0 yellow, 1 pink, 2 blue, 3 mint, 4 lilac, 5 orange
// soapbar (7) / towelroll / towelstack: 0 pink, 1 blue, 2 yellow, 3 green, 4 lilac, 5 white, 6 coral
// loofah: 0 natural, 1 pink, 2 mint, 3 lilac, 4 peach, 5 blue
// acorn: 0 tan, 1 chestnut, 2 gold, 3 olive, 4 rust, 5 cocoa
// autumnleaf: 0 red, 1 orange, 2 yellow, 3 ochre, 4 crimson, 5 brown, 6 green
// minigourd / patchpumpkin / bigpumpkin: 0 orange, 1 white, 2 green, 3 red, 4 tan, 5 gold
// orchardapple / applebasket: 0 red, 1 green, 2 yellow, 3 pink, 4 deep red
// cornear: 0 yellow, 1 cream, 2 red, 3 purple, 4 orange
// bauble / giftbow: 0 red, 1 green, 2 blue, 3 gold, 4 silver, 5 purple, 6 pink
// giftbox / bigbox / giftstack: 0 red, 1 green, 2 blue, 3 gold, 4 purple, 5 pink, 6 teal, 7 cream
// minicane / stocking / toydrum: 0 red, 1 green, 2 blue, 3 gold, 4 purple, 5 pink
// nutsoldier: 0 red, 1 blue, 2 green, 3 purple, 4 gold, 5 white
const SIX = [0, 1, 2, 3, 4, 5];
const SEVEN = [0, 1, 2, 3, 4, 5, 6];
const EIGHT = [0, 1, 2, 3, 4, 5, 6, 7];
const FIVE = [0, 1, 2, 3, 4];

// Carpet spacing: the gap between four carpet pieces fits one tiny prop with 0.1 to spare.
const BG = 0.68;   // bath bombs (r 0.23) + pearls (r 0.13) / leaves (r 0.22) + acorns (r 0.15)
const GB = 0.8;    // little presents (0.4 box) + baubles (r 0.16)
// The winding lanes (Bubble Lane, Ribbon Road).
const LANE92 = vwaveF(9.6, -12.4, 0, 4.4, 1.0);
const LANE102 = vwaveF(9.6, -12.4, 0, 4.6, 1.0, PI);

const LIST = [
  // ======================================================== BUBBLE SPA
  {
    // Pink bath pearls tucked between bath bombs of six colors (the pink bombs hide them
    // best), blue duckies in two parade rows, and four towel stacks that need a bit of size.
    id: 91, name: 'Pearl Hunt', world: 'spa', arena: { w: 22, d: 30 }, time: 170, start: [0, 12.8],
    targets: [{ id: 'bathbead', n: 'all', tint: 0 }, { id: 'squeakduck', n: 'all', tint: 2 }, { id: 'towelstack', n: 'all' }],
    place: [
      carpet('bathbomb', 'bathbead', -5.4, -10.6, 8, 5, BG, BG, SIX, SEVEN, 1, 0),
      carpet('bathbomb', 'bathbead', 5.4, -10.6, 8, 5, BG, BG, SIX, SEVEN, 1, 3, 2),
      carpet('bathbomb', 'bathbead', 0, -3.4, 10, 5, BG, BG, SIX, SEVEN, 1, 5),
      ...[[-8.6, -5.6], [8.6, -5.6], [-8.6, 4.6], [8.6, 4.6]].map(([x, z], k) => at('towelstack', x, z, [0, 1, 4, 3][k])),
      ...[-1, 1].flatMap((s) => [at('spabucket', s * 8.4, -0.6, s < 0 ? 1 : 2), ring('spacandle', s * 8.4, -0.6, 9, 1.35, 'cycle')]),
      line('squeakduck', -6.0, 1.4, 6.0, 1.4, 13, 'cycle', 0),
      line('squeakduck', -5.5, 2.6, 5.5, 2.6, 12, [4, 1, 3, 2, 5, 0], 0),
      ...diag('soapbar', 0, 5.0, 9, 2, 0.72, 0.52, SEVEN, 0, 3),
      line('spabubble', -6.6, 6.6, 6.6, 6.6, 15),
      carpet('bathbomb', 'bathbead', 0, 9.0, 12, 3, BG, BG, SIX, SEVEN, 1, 2),
      line('spacandle', -9.4, 11.8, -2.6, 11.8, 8), line('spacandle', 2.6, 11.8, 9.4, 11.8, 8),
      line('lotion', -9.4, 13.4, -6.8, 13.4, 3), line('lotion', 6.8, 13.4, 9.4, 13.4, 3),
      line('spabubble', -7.4, 7.9, -5.0, 7.9, 4), line('spabubble', 5.0, 7.9, 7.4, 7.9, 4),
    ],
  },
  {
    // A winding bubble lane hemmed in by big bubbles: the pink bubbles on the lane are the
    // targets (one in six), and the big PINK bubbles in the walls are the late gate.
    id: 92, name: 'Bubble Lane', world: 'spa', arena: { w: 24, d: 32 }, time: 170, start: [0, 13.8],
    targets: [{ id: 'spabubble', n: 'all', tint: 1 }, { id: 'lotion', n: 'all' }, { id: 'bigbubble', n: 'all', tint: 1 }],
    place: [
      ...path('spabubble', LANE92, 0.6, [0, 2, 1, 3, 4, 5, 2, 0, 3, 1, 5, 4]),
      ...rail('bigbubble', LANE92, 0.5, 2.05, [1, 0, 2, 3, 4, 5, 3], { room: [1.6, 1.6], zmin: -13.6, zmax: 10.8 }),
      ...rail('bigbubble', LANE92, 0.5, -2.05, [3, 4, 1, 0, 5, 2, 0], { room: [1.6, 1.6], zmin: -13.6, zmax: 10.8 }),
      ...[-1, 1].map((s) => line('lotion', s * 9.8, -13.6, s * 9.8, 7.6, 10, 'cycle')),
      ...[-1, 1].map((s) => line('spacandle', s * 8.5, -12.8, s * 8.5, 6.8, 21)),
      ...[-1, 1].map((s) => diag('soapbar', s * 6.6, -13.8, 3, 2, 0.72, 0.52, SEVEN, 0, 2)),
      ...[-1, 1].flatMap((s) => [at('spabucket', s * 9.4, 10.6, s < 0 ? 3 : 4), ring('spabubble', s * 9.4, 10.6, 10, 1.35, 'cycle')]),
      ...[-1, 1].map((s) => diag('bathbomb', s * 5.9, 12.5, 6, 2, BG, BG, SIX, 0, 2)),
      ...[-1, 1].map((s) => line('squeakduck', s * 3.4, 14.6, s * 7.6, 14.6, 6, 'cycle', 0)),
      ...[-1, 1].map((s) => line('towelroll', s * 9.0, 8.6, s * 6.8, 8.6, 2, 'cycle', 0)),
    ],
  },
  {
    // GROWTH GATE: three spa benches only fit late. Yellow bath bombs hide in four carpets
    // of six colors; candles ring two wash buckets.
    id: 93, name: 'Fizz Factory', world: 'spa', arena: { w: 26, d: 34 }, time: 200, start: [0, 14.8],
    targets: [{ id: 'bathbomb', n: 'all', tint: 3 }, { id: 'spacandle', n: 'all' }, { id: 'spabench', n: 'all' }],
    place: [
      at('spabench', 0, -15.0, 1), at('spabench', -9.4, 5.4, 2, PI / 2), at('spabench', 9.4, -5.0, 0, PI / 2),
      ...[[-6.2, -11.0, 1], [6.2, -11.0, 2], [-6.0, -2.4, 3], [4.6, 3.2, 1]].map(([x, z, sh]) => diag('bathbomb', x, z, 7, 5, BG, BG, SIX, 0, sh)),
      ...[[-6.2, -11.0], [6.2, -11.0], [-6.0, -2.4], [4.6, 3.2]].map(([x, z], k) => nestle('bathbead', x, z, 7, 5, BG, BG, SEVEN, 2, k)),
      at('spabucket', 0, -6.6, 2), ring('spacandle', 0, -6.6, 10, 1.4, 'cycle'),
      at('spabucket', -1.6, 3.6, 4), ring('spacandle', -1.6, 3.6, 10, 1.4, 'cycle'),
      ...[-1, 1].map((s) => line('lotion', s * 11.0, -14.8, s * 11.0, -9.0, 4)),
      line('bigbubble', -2.6, -11.4, 2.6, -11.4, 2, [0, 4]),
      line('towelstack', 9.8, 1.4, 9.8, 5.4, 2, 'cycle', PI / 2),
      line('bathstool', -10.6, -2.0, -10.6, 0.8, 2, 'cycle'),
      ...diag('soapbar', 0, 7.8, 14, 2, 0.72, 0.52, SEVEN, 0, 3),
      ...diag('bathbomb', 0, 10.2, 14, 2, BG, BG, SIX, 0, 2),
      line('spacandle', -10.4, 12.0, -3.2, 12.0, 9), line('spacandle', 3.2, 12.0, 10.4, 12.0, 9),
      line('spabubble', -6.4, 13.6, -2.4, 13.6, 6), line('spabubble', 2.4, 13.6, 6.4, 13.6, 6),
      ...[-1, 1].map((s) => line('loofah', s * 9.4, 14.8, s * 9.4, 13.8, 2, 'cycle', 0)),
    ],
  },
  {
    // Two pearl lanes thread between towel-stack walls and big bubbles; the mint pearls on
    // them are targets (one in seven). Mint loofahs hide in a loofah rack; wash buckets sit
    // in the corners and two spa benches are the late gate.
    id: 94, name: 'Steam Room', world: 'spa', arena: { w: 28, d: 36 }, time: 220, start: [0, 15.8],
    targets: [{ id: 'bathbead', n: 'all', tint: 4 }, { id: 'loofah', n: 'all', tint: 2 }, { id: 'spabucket', n: 'all' }, { id: 'spabench', n: 'all' }],
    place: [
      at('spabench', -7.0, -16.0, 1), at('spabench', 7.0, -16.0, 3),
      ...[[-11.8, -15.6], [11.8, -15.6], [-11.6, 9.6], [11.6, 9.6]].map(([x, z], k) => at('spabucket', x, z, k)),
      // lane 1 (top): pearls between towel stacks
      ...path('bathbead', waveF(-11.0, 11.0, -10.6, 1.0, 2), 0.46, [0, 1, 2, 3, 4, 5, 6, 2, 5]),
      ...rail('towelstack', waveF(-11.0, 11.0, -10.6, 1.0, 2), 0.5, 1.5, 'cycle', { room: [1.3, 0.9] }),
      ...rail('towelstack', waveF(-11.0, 11.0, -10.6, 1.0, 2), 0.5, -1.5, [3, 4, 5, 6, 0, 1, 2], { room: [1.3, 0.9] }),
      // lane 2 (middle): pearls between big bubbles
      ...path('bathbead', waveF(11.0, -11.0, -2.6, 1.2, 2.5), 0.46, [3, 6, 4, 0, 2, 5, 1]),
      ...rail('bigbubble', waveF(11.0, -11.0, -2.6, 1.2, 2.5), 0.5, 1.45, 'cycle', { room: [1.6, 1.6] }),
      ...rail('bigbubble', waveF(11.0, -11.0, -2.6, 1.2, 2.5), 0.5, -1.45, [2, 3, 4, 5, 0, 1], { room: [1.6, 1.6] }),
      // the loofah rack and towel rolls
      ...grid('loofah', -6.0, 3.6, 4, 4, 1.1, 0.6, [0, 2, 4, 1, 3, 5, 2, 0, 1, 4, 5, 3, 2, 1, 0, 5]),
      ...grid('loofah', 6.0, 3.6, 4, 4, 1.1, 0.6, [5, 1, 3, 2, 0, 4, 1, 2, 3, 0, 2, 4, 1, 5, 3, 0]),
      line('towelroll', -1.2, 2.6, -1.2, 5.0, 4, 'cycle', 0), line('towelroll', 1.2, 2.6, 1.2, 5.0, 4, [3, 4, 5, 6], 0),
      carpet('bathbomb', 'bathbead', 0, 8.6, 14, 3, BG, BG, SIX, SEVEN, 1, 1),
      ...diag('soapbar', 0, 11.6, 16, 2, 0.72, 0.52, SEVEN, 0, 2),
      line('spacandle', -11.6, 13.6, -3.0, 13.6, 10), line('spacandle', 3.0, 13.6, 11.6, 13.6, 10),
      line('spabubble', -7.0, 15.2, -2.6, 15.2, 6), line('spabubble', 2.6, 15.2, 7.0, 15.2, 6),
      ...[-1, 1].map((s) => at('bathstool', s * 11.4, 15.4, s < 0 ? 0 : 3)),
    ],
  },
  {
    // CENTERPIECE: the clawfoot tub. Gold pearls nestle in three bath-bomb carpets, yellow
    // duckies swim in a crowd of every color, four towel stacks wait in the corners.
    id: 95, name: 'Clawfoot Tub', world: 'spa', arena: { w: 30, d: 40 }, time: 300, start: [0, 17.8],
    targets: [{ id: 'bathbead', n: 'all', tint: 6 }, { id: 'squeakduck', n: 'all', tint: 0 }, { id: 'towelstack', n: 'all' }, { id: 'clawtub', n: 'all' }],
    place: [
      at('clawtub', 0, -16.4, 0),
      ...[-1, 1].flatMap((s) => [at('spabench', s * 9.6, -16.8, s < 0 ? 0 : 2), at('spabucket', s * 4.6, -12.6, s < 0 ? 1 : 3)]),
      ...[[-12.4, -12.0], [12.4, -12.0], [-12.4, 9.4], [12.4, 9.4]].map(([x, z], k) => at('towelstack', x, z, [6, 1, 2, 4][k], PI / 2)),
      line('bigbubble', -9.6, -12.4, -7.0, -12.4, 2, [4, 2]), line('bigbubble', 7.0, -12.4, 9.6, -12.4, 2, [3, 5]),
      carpet('bathbomb', 'bathbead', -6.8, -7.6, 9, 5, BG, BG, SIX, SEVEN, 1, 0),
      carpet('bathbomb', 'bathbead', 6.8, -7.6, 9, 5, BG, BG, SIX, SEVEN, 1, 4, 2),
      line('towelroll', -11.0, -3.4, 11.0, -3.4, 10, 'cycle', 0),
      ...diag('spabubble', 0, -4.8, 26, 1, 0.8, 0.5, SIX, 0, 1), ...diag('spabubble', 0, -2.0, 26, 1, 0.8, 0.5, [3, 4, 5, 0, 1, 2], 0, 1),
      // the duck pond: two crowds of duckies in six colors
      ...grid('squeakduck', -6.4, 0.2, 8, 4, 0.66, 0.5, [0, 3, 5, 1, 4, 2, 3, 1, 2, 5, 0, 4, 1, 5, 2, 3, 4, 0, 5, 2, 1, 3, 0, 4, 2, 1, 3, 4, 5, 0, 1, 2]),
      ...grid('squeakduck', 6.4, 0.2, 8, 4, 0.66, 0.5, [4, 2, 1, 0, 3, 5, 2, 4, 1, 3, 5, 2, 0, 1, 4, 3, 5, 1, 3, 4, 0, 2, 5, 1, 3, 0, 2, 5, 4, 1, 0, 3]),
      at('spabucket', 0, 0.2, 0), ring('spacandle', 0, 0.2, 10, 1.45, 'cycle'),
      ...[-1, 1].flatMap((s) => [at('bathstool', s * 12.6, 1.2, s < 0 ? 1 : 2), line('lotion', s * 12.8, -6.6, s * 12.8, -2.6, 4)]),
      ...[-1, 1].map((s) => line('towelroll', s * 5.0, 4.4, s * 11.0, 4.4, 6, 'cycle', 0)),
      carpet('bathbomb', 'bathbead', 0, 7.8, 16, 3, BG, BG, SIX, SEVEN, 1, 2),
      ...[-1, 1].map((s) => grid('loofah', s * 11.6, 6.4, 2, 2, 1.0, 0.55, 'cycle', 0)),
      ...diag('soapbar', 0, 11.2, 18, 2, 0.72, 0.52, SEVEN, 0, 3),
      ...diag('spabubble', 0, 13.0, 20, 2, 0.56, 0.5, SIX, 0, 2),
      line('spacandle', -12.4, 14.8, -3.2, 14.8, 11), line('spacandle', 3.2, 14.8, 12.4, 14.8, 11),
      ...[-1, 1].map((s) => line('squeakduck', s * 3.0, 16.6, s * 7.4, 16.6, 6, s < 0 ? [2, 0, 4, 1, 5, 3] : [5, 3, 0, 2, 4, 1], 0)),
      ...[-1, 1].map((s) => at('spabucket', s * 11.6, 17.0, s < 0 ? 4 : 1)),
    ],
  },

  // ======================================================== PUMPKIN PATCH
  {
    // Chestnut acorns tucked between fallen leaves of seven colors; red apples in rows of
    // five colors; three apple baskets are the little gate.
    id: 96, name: 'Acorn Hunt', world: 'pumpkin', arena: { w: 22, d: 30 }, time: 170, start: [0, 12.8],
    targets: [{ id: 'acorn', n: 'all', tint: 1 }, { id: 'orchardapple', n: 'all', tint: 0 }, { id: 'applebasket', n: 'all' }],
    place: [
      carpet('autumnleaf', 'acorn', -5.3, -10.6, 8, 5, BG, BG, SEVEN, SIX, 1, 0),
      carpet('autumnleaf', 'acorn', 5.3, -10.6, 8, 5, BG, BG, SEVEN, SIX, 1, 2, 2),
      carpet('autumnleaf', 'acorn', 0, -3.6, 10, 5, BG, BG, SEVEN, SIX, 1, 4, 3),
      ...[[-8.8, -5.2], [8.8, -5.2], [0, -13.2]].map(([x, z], k) => at('applebasket', x, z, k)),
      ...[-1, 1].map((s) => line('patchpumpkin', s * 9.0, -1.6, s * 9.0, 2.6, 3, 'cycle')),
      line('orchardapple', -6.6, 1.0, 6.6, 1.0, 13, [0, 2, 1, 3, 4]),
      line('orchardapple', -6.0, 2.3, 6.0, 2.3, 12, [3, 1, 4, 2, 0]),
      ...diag('minigourd', 0, 4.2, 12, 2, 0.64, 0.64, SIX, 0, 2),
      line('patchgourd', -7.2, 6.2, 7.2, 6.2, 17),
      carpet('autumnleaf', 'acorn', 0, 8.6, 12, 3, BG, BG, SEVEN, SIX, 1, 1, 2),
      ...[-1, 1].map((s) => line('cornear', s * 3.2, 11.6, s * 9.2, 11.6, 6, 'cycle', 0)),
      ...[-1, 1].map((s) => line('orchardapple', s * 6.0, 13.4, s * 9.2, 13.4, 4, s < 0 ? [1, 0, 2, 3] : [2, 3, 0, 1])),
    ],
  },
  {
    // The crimson leaves are targets: one color in seven, in big leaf piles (with acorns
    // tucked in the gaps). Little gourds circle two hay rolls, the hay rolls are the gate.
    id: 97, name: 'Leaf Pile', world: 'pumpkin', arena: { w: 24, d: 32 }, time: 180, start: [0, 13.8],
    targets: [{ id: 'autumnleaf', n: 'all', tint: 4 }, { id: 'minigourd', n: 'all' }, { id: 'hayroll', n: 'all' }],
    place: [
      ...[[-6.0, -11.4, 1], [6.0, -11.4, 3], [0, -4.4, 2], [-6.4, 2.6, 4], [6.4, 2.6, 1]].map(([x, z, sh], k) => carpet('autumnleaf', 'acorn', x, z, k === 2 ? 10 : 8, 5, BG, BG, SEVEN, SIX, 2, k, sh)),
      ...[[-10.2, -5.0], [10.2, -5.0], [0, -14.4]].map(([x, z]) => at('hayroll', x, z, 0)),
      ...[[-10.2, -5.0], [10.2, -5.0]].map(([x, z]) => ring('minigourd', x, z, 0, 1.6)),
      at('bigpumpkin', 0, 2.4, 0), ring('minigourd', 0, 2.4, 12, 1.75, 'cycle'),
      ...[-1, 1].map((s) => at('scarebuddy', s * 10.2, 0.6, s < 0 ? 0 : 3)),
      ...diag('orchardapple', 0, 6.8, 14, 2, 0.64, 0.64, FIVE, 0, 2),
      line('patchgourd', -9.8, 8.6, 9.8, 8.6, 22),
      carpet('autumnleaf', 'acorn', 0, 10.8, 14, 3, BG, BG, SEVEN, SIX, 2, 3, 2),
      ...[-1, 1].map((s) => line('minigourd', s * 3.0, 13.4, s * 9.6, 13.4, 10)),
      ...[-1, 1].map((s) => line('cornear', s * 3.8, 14.8, s * 9.2, 14.8, 6, 'cycle', 0)),
    ],
  },
  {
    // Pumpkin rows: lanes between rows of BIG pumpkins (too big until late). Red little
    // gourds sit in the lanes among gourds of six colors; white pumpkins hide in the rows.
    // The two pumpkin carts are the gate.
    id: 98, name: 'Pumpkin Rows', world: 'pumpkin', arena: { w: 26, d: 34 }, time: 210, start: [0, 14.8],
    targets: [{ id: 'minigourd', n: 'all', tint: 3 }, { id: 'patchpumpkin', n: 'all', tint: 1 }, { id: 'pumpkincart', n: 'all' }],
    place: [
      at('pumpkincart', -8.6, -15.0, 0), at('pumpkincart', 8.6, 6.0, 1),
      // three rows of big pumpkins with small pumpkins between them; gourd lanes between rows
      ...[-11.6, -5.6, 0.4].flatMap((z, r) => [
        ...line('bigpumpkin', -10.0, z, 10.0, z, 6, r % 2 ? [0, 5, 1, 4, 0, 2] : [2, 0, 4, 1, 5, 0]),
        ...line('patchpumpkin', -8.0, z, 8.0, z, 5, r === 0 ? [1, 0, 1, 3, 5] : r === 1 ? [4, 1, 0, 2, 1] : [1, 5, 2, 1, 0]),
      ]),
      ...[-8.6, -2.6].flatMap((z, r) => [
        ...path('minigourd', waveF(-11.0, 11.0, z, 0.45, 3, r * PI), 0.62, r ? [3, 0, 5, 1, 2, 4, 0, 3, 2] : [0, 2, 3, 4, 1, 5, 3, 2]),
      ]),
      at('scarebuddy', 0, -15.0, 2), ...[-1, 1].map((s) => line('applebasket', s * 3.0, -15.0, s * 5.6, -15.0, 2)),
      ...[-1, 1].map((s) => line('hayroll', s * 11.0, -15.2, s * 11.0, -13.4, 1)),
      line('minigourd', -10.8, 3.2, 6.4, 3.2, 26, [5, 3, 1, 0, 2, 4, 3]),
      ...diag('autumnleaf', -3.4, 5.6, 16, 3, BG, BG, SEVEN, 0, 2),
      carpet('autumnleaf', 'acorn', -3.4, 9.2, 16, 3, BG, BG, SEVEN, SIX, 1, 0, 3),
      ...diag('orchardapple', 0, 11.8, 18, 2, 0.64, 0.64, FIVE, 0, 2),
      ...[-1, 1].map((s) => line('patchgourd', s * 3.0, 14.0, s * 11.2, 14.0, 13)),
      ...[-1, 1].map((s) => line('cornear', s * 9.6, 10.0, s * 9.6, 10.0, 1, 'cycle', 0)),
      at('patchpumpkin', 10.6, 15.2, 1), at('patchpumpkin', -10.6, 15.2, 1),
    ],
  },
  {
    // A corn maze: a winding lane of apples between hay-roll walls; the yellow apples on it
    // are targets (one in five). Purple corn hides in the corn piles, scarecrows stand
    // guard in the corners, and the hay wagon is the big late gate.
    id: 99, name: 'Corn Maze', world: 'pumpkin', arena: { w: 26, d: 36 }, time: 260, start: [0, 15.8],
    targets: [{ id: 'orchardapple', n: 'all', tint: 2 }, { id: 'cornear', n: 'all', tint: 3 }, { id: 'scarebuddy', n: 'all' }, { id: 'haywagon', n: 'all' }],
    place: [
      at('haywagon', 0, -15.6, 0),
      ...path('orchardapple', vwaveF(11.6, -12.4, 0, 5.0, 1.25), 0.64, [0, 2, 1, 3, 4, 1, 0, 3]),
      ...rail('hayroll', vwaveF(11.6, -12.4, 0, 5.0, 1.25), 0.5, 1.75, [0, 1, 2, 3], { room: [1.2, 1.2], zmin: -13.4, zmax: 12.0 }),
      ...rail('hayroll', vwaveF(11.6, -12.4, 0, 5.0, 1.25), 0.5, -1.75, [2, 3, 0, 1], { room: [1.2, 1.2], zmin: -13.4, zmax: 12.0 }),
      ...[[-11.2, -15.6], [11.2, -15.6], [-11.2, 6.6], [11.2, 6.6]].map(([x, z], k) => at('scarebuddy', x, z, k)),
      // corn piles at the sides
      ...[-1, 1].map((s) => diag('cornear', s * 10.2, -9.0, 2, 8, 1.0, 0.42, FIVE, 0, s < 0 ? 2 : 3)),
      ...[-1, 1].map((s) => diag('cornear', s * 10.2, 0.6, 2, 8, 1.0, 0.42, FIVE, 0, s < 0 ? 1 : 4)),
      ...[-1, 1].map((s) => line('minigourd', s * 11.8, -12.6, s * 11.8, 3.8, 0)),
      ...[-1, 1].flatMap((s) => [at('applebasket', s * 5.4, -15.4, s < 0 ? 0 : 2), at('pumpkincart', s * 8.95, -12.0, s < 0 ? 2 : 3)]),
      carpet('autumnleaf', 'acorn', 0, 13.6, 16, 2, BG, BG, SEVEN, SIX, 1, 1, 2),
      ...[-1, 1].map((s) => line('patchgourd', s * 3.4, 15.6, s * 11.0, 15.6, 13)),
      ...diag('cornear', 0, 9.6 + 4.6, 0, 0, 1, 1, FIVE),
      ...[-1, 1].map((s) => diag('minigourd', s * 9.6, 10.4, 5, 3, 0.64, 0.64, SIX, 0, 2)),
    ],
  },
  {
    // CENTERPIECE: the prize pumpkin with its blue ribbon. Red acorns nestle in leaf piles
    // round the patch, apple baskets and pumpkin carts are dotted to the far corners.
    id: 100, name: 'Prize Pumpkin', world: 'pumpkin', arena: { w: 30, d: 40 }, time: 300, start: [0, 17.8],
    targets: [{ id: 'acorn', n: 'all', tint: 4 }, { id: 'applebasket', n: 'all' }, { id: 'pumpkincart', n: 'all' }, { id: 'prizepumpkin', n: 'all' }],
    place: [
      at('prizepumpkin', 0, -15.2, 0),
      ...[-1, 1].flatMap((s) => [at('haywagon', s * 9.4, -16.6, s < 0 ? 0 : 1), at('pumpkincart', s * 11.6, -11.6, s < 0 ? 3 : 2, PI / 2)]),
      ...[-1, 1].flatMap((s) => [at('bigpumpkin', s * 5.2, -11.0, s < 0 ? 0 : 1), at('hayroll', s * 8.0, -11.2, 0)]),
      carpet('autumnleaf', 'acorn', -7.0, -6.4, 10, 5, BG, BG, SEVEN, SIX, 1, 0, 2),
      carpet('autumnleaf', 'acorn', 7.0, -6.4, 10, 5, BG, BG, SEVEN, SIX, 1, 3, 3),
      ...diag('orchardapple', 0, -9.0, 5, 3, 0.64, 0.64, FIVE, 0, 2),
      at('bigpumpkin', 0, -2.0, 2), ring('minigourd', 0, -2.0, 12, 1.75, 'cycle'),
      ...[-1, 1].flatMap((s) => [at('applebasket', s * 12.8, -2.4, s < 0 ? 0 : 1), at('scarebuddy', s * 9.6, -1.6, s < 0 ? 1 : 4)]),
      carpet('autumnleaf', 'acorn', -7.0, 2.8, 10, 4, BG, BG, SEVEN, SIX, 1, 2, 1),
      carpet('autumnleaf', 'acorn', 7.0, 2.8, 10, 4, BG, BG, SEVEN, SIX, 1, 5, 2),
      ...[-1, 1].map((s) => line('patchpumpkin', s * 2.0, 1.6, s * 2.0, 4.6, 3, 'cycle')),
      ...[-1, 1].map((s) => line('hayroll', s * 12.8, 1.8, s * 12.8, 5.8, 2)),
      ...diag('cornear', 0, 7.4, 14, 2, 1.0, 0.45, FIVE, 0, 2),
      ...[-1, 1].map((s) => at('applebasket', s * 12.4, 8.2, s < 0 ? 2 : 3)),
      ...diag('minigourd', 0, 9.8, 20, 2, 0.64, 0.64, SIX, 0, 2),
      carpet('autumnleaf', 'acorn', 0, 12.4, 20, 3, BG, BG, SEVEN, SIX, 1, 1, 2),
      line('patchgourd', -12.6, 14.8, -3.0, 14.8, 14), line('patchgourd', 3.0, 14.8, 12.6, 14.8, 14),
      ...[-1, 1].map((s) => line('orchardapple', s * 3.2, 16.4, s * 8.0, 16.4, 7)),
      ...[-1, 1].map((s) => at('applebasket', s * 11.8, 17.2, s < 0 ? 4 : 0)),
    ],
  },

  // ======================================================== HOLIDAY MORNING
  {
    // Blue baubles tucked between little presents in eight wrapping colors; candy canes in
    // rows, toy drums, and three gift stacks as the gate.
    id: 101, name: 'Bauble Box', world: 'holiday', arena: { w: 22, d: 30 }, time: 170, start: [0, 12.8],
    targets: [{ id: 'bauble', n: 'all', tint: 2 }, { id: 'minicane', n: 'all' }, { id: 'giftstack', n: 'all' }],
    place: [
      carpet('giftbox', 'bauble', -5.2, -10.8, 7, 5, GB, GB, EIGHT, SEVEN, 1, 0),
      carpet('giftbox', 'bauble', 5.2, -10.8, 7, 5, GB, GB, EIGHT, SEVEN, 1, 3, 3),
      carpet('giftbox', 'bauble', 0, -3.6, 9, 4, GB, GB, EIGHT, SEVEN, 1, 5, 2),
      ...[[-8.8, -4.0], [8.8, -4.0], [0, -13.4]].map(([x, z], k) => at('giftstack', x, z, [0, 2, 5][k])),
      ...[-1, 1].map((s) => line('minicane', s * 2.0, 0.6, s * 8.6, 0.6, 12, SIX, 0)),
      ...[-1, 1].map((s) => line('minicane', s * 2.0, 1.4, s * 8.6, 1.4, 12, [3, 4, 5, 0, 1, 2], 0)),
      ...[-1, 1].map((s) => line('toydrum', s * 3.0, 3.2, s * 8.6, 3.2, 6)),
      line('stocking', -1.0, 2.8, 1.0, 2.8, 2, 'cycle', 0),
      ...diag('giftbow', 0, 5.2, 16, 2, 0.6, 0.54, SEVEN, 0, 3),
      carpet('giftbox', 'bauble', 0, 8.4, 11, 3, GB, GB, EIGHT, SEVEN, 1, 2, 2),
      ...[-1, 1].map((s) => line('nutsoldier', s * 2.8, 11.4, s * 9.2, 11.4, 12, 'cycle')),
      ...[-1, 1].map((s) => line('minicane', s * 6.0, 13.4, s * 9.4, 13.4, 6, SIX, 0)),
    ],
  },
  {
    // A ribbon road winds between walls of BIG presents; the pink bows on it are targets
    // (one in seven). Toy soldiers stand in lines; the two toy sleds are the gate.
    id: 102, name: 'Ribbon Road', world: 'holiday', arena: { w: 24, d: 32 }, time: 180, start: [0, 13.8],
    targets: [{ id: 'giftbow', n: 'all', tint: 6 }, { id: 'nutsoldier', n: 'all' }, { id: 'toysled', n: 'all' }],
    place: [
      ...path('giftbow', LANE102, 0.56, [0, 6, 1, 2, 3, 6, 4, 5, 0, 2, 1, 4, 3, 5]),
      ...rail('bigbox', LANE102, 0.5, 2.15, EIGHT, { room: [1.4, 1.4], zmin: -13.6, zmax: 10.6 }),
      ...rail('bigbox', LANE102, 0.5, -2.15, [4, 5, 6, 7, 0, 1, 2, 3], { room: [1.4, 1.4], zmin: -13.6, zmax: 10.6 }),
      at('toysled', -9.6, -14.0, 0), at('toysled', 9.6, 2.0, 2),
      ...[-1, 1].map((s) => line('nutsoldier', s * 10.4, -11.0, s * 10.4, -1.0, 15)),
      ...[-1, 1].map((s) => line('nutsoldier', s * 9.6, -11.0, s * 9.6, -1.0, 15, [3, 4, 5, 0, 1, 2])),
      ...[-1, 1].map((s) => line('toydrum', s * 10.2, 4.0, s * 10.2, 8.0, 4)),
      line('wreath', -9.8, 1.2, -9.8, 1.2, 1),
      ...[-1, 1].map((s) => diag('giftbox', s * 6.4, 12.2, 6, 2, GB, GB, EIGHT, 0, 3)),
      ...[-1, 1].map((s) => line('giftbow', s * 3.2, 14.4, s * 9.6, 14.4, 12)),
      ...[-1, 1].map((s) => line('minicane', s * 7.6, 10.0, s * 7.6, 6.0, 9, SIX, 0)),
    ],
  },
  {
    // A toy-soldier parade in six coat colors: the purple coats are targets. Stockings are
    // laid out by the hearth rug; two gift sleighs are the big late gate.
    id: 103, name: 'Toy Parade', world: 'holiday', arena: { w: 26, d: 34 }, time: 210, start: [0, 14.8],
    targets: [{ id: 'nutsoldier', n: 'all', tint: 3 }, { id: 'stocking', n: 'all' }, { id: 'giftsleigh', n: 'all' }],
    place: [
      at('giftsleigh', -8.2, -15.0, 0), at('giftsleigh', 8.2, 4.6, 1),
      ...[[-5.0, -10.6, 1], [5.0, -10.6, 2], [0, -4.4, 3], [-6.0, 2.0, 4]].map(([x, z, sh]) => diag('nutsoldier', x, z, 10, 6, 0.62, 0.62, SIX, 0, sh)),
      ...[[-5.0, -10.6], [5.0, -10.6], [0, -4.4], [-6.0, 2.0]].map(([x, z], k) => nestle('bauble', x, z, 10, 6, 0.62, 0.62, SEVEN, 3, k)),
      line('stocking', 2.0, -15.2, 6.0, -15.2, 6, FESTIVE6(), 0),
      ...[-1, 1].map((s) => line('stocking', s * 10.8, -9.0, s * 10.8, -1.0, 9, FESTIVE6(), PI / 2)),
      ...[-1, 1].map((s) => at('bigbox', s * 9.0, -4.6, s < 0 ? 0 : 3)),
      ...[-1, 1].map((s) => line('toydrum', s * 7.6, -14.0, s * 10.8, -14.0, 0)),
      line('wreath', 1.6, 1.4, 4.6, 1.4, 2), line('toysled', 3.0, -0.6, 3.0, -0.6, 1),
      ...diag('giftbox', 0, 7.6, 16, 2, GB, GB, EIGHT, 0, 3),
      ...diag('minicane', 0, 10.2, 18, 2, 0.58, 0.4, SIX, 0, 2),
      ...[-1, 1].map((s) => line('nutsoldier', s * 2.6, 12.4, s * 10.6, 12.4, 17, [0, 1, 2, 4, 5])),
      ...[-1, 1].map((s) => line('bauble', s * 3.0, 14.2, s * 9.4, 14.2, 14)),
    ],
  },
  {
    // Gold candy canes in a cane pile of six colors; wreaths and big red presents in the
    // middle; two gift sleighs as the late gate.
    id: 104, name: 'Stocking Stuffers', world: 'holiday', arena: { w: 28, d: 36 }, time: 220, start: [0, 15.8],
    targets: [{ id: 'minicane', n: 'all', tint: 3 }, { id: 'wreath', n: 'all' }, { id: 'bigbox', n: 'all', tint: 0 }, { id: 'giftsleigh', n: 'all' }],
    place: [
      at('giftsleigh', -9.0, -16.0, 2), at('giftsleigh', 9.0, -16.0, 3),
      ...[[-6.4, -11.0, 1], [6.4, -11.0, 2], [-6.4, -3.6, 4], [6.4, -3.6, 5]].map(([x, z, sh]) => diag('minicane', x, z, 9, 8, 0.84, 0.62, SIX, 0, sh)),
      ...[[-6.4, -11.0], [6.4, -11.0], [-6.4, -3.6], [6.4, -3.6]].map(([x, z], k) => nestle('bauble', x, z, 9, 8, 0.84, 0.62, SEVEN, 2, k)),
      ...[[-12.0, -11.0], [12.0, -11.0], [-12.0, -3.6], [12.0, -3.6], [0, -7.4]].map(([x, z], k) => at('wreath', x, z, k)),
      line('bigbox', -1.4, -14.2, 1.4, -14.2, 2, [0, 2]),
      ...grid('bigbox', 0, 2.0, 5, 1, 2.0, 2.0, [3, 0, 5, 1, 0]),
      ...[-1, 1].map((s) => at('bigbox', s * 12.0, 3.4, s < 0 ? 0 : 6)),
      ...[-1, 1].map((s) => ring('bauble', s * 6.0, 5.2, 0, 1)),
      ...diag('stocking', 0, 5.4, 12, 1, 0.9, 0.9, SIX, 0, 1),
      carpet('giftbox', 'bauble', 0, 8.8, 15, 3, GB, GB, EIGHT, SEVEN, 1, 1, 2),
      ...diag('minicane', 0, 11.8, 20, 2, 0.6, 0.42, SIX, 0, 2),
      ...[-1, 1].map((s) => line('toydrum', s * 3.2, 13.8, s * 11.6, 13.8, 10)),
      ...[-1, 1].map((s) => line('giftbow', s * 4.0, 15.6, s * 11.6, 15.6, 13)),
      ...[-1, 1].map((s) => at('giftstack', s * 12.2, 9.0, s < 0 ? 4 : 6)),
    ],
  },
  {
    // CENTERPIECE: the holiday tree. Red baubles nestle among little presents, gold
    // presents hide in rows of eight colors, three gift sleighs and the tree come last.
    id: 105, name: 'Holiday Tree', world: 'holiday', arena: { w: 30, d: 40 }, time: 300, start: [0, 17.8],
    targets: [{ id: 'bauble', n: 'all', tint: 0 }, { id: 'giftbox', n: 'all', tint: 3 }, { id: 'giftsleigh', n: 'all' }, { id: 'holidaytree', n: 'all' }],
    place: [
      at('holidaytree', 0, -15.2, 0),
      ...[-1, 1].flatMap((s) => [at('giftsleigh', s * 9.8, -16.6, s < 0 ? 0 : 1), at('giftstack', s * 5.0, -11.4, s < 0 ? 0 : 4), at('bigbox', s * 12.6, -12.0, s < 0 ? 5 : 2)]),
      at('giftsleigh', 0, 4.4, 2),
      carpet('giftbox', 'bauble', -7.2, -6.6, 9, 5, GB, GB, EIGHT, SEVEN, 1, 0),
      carpet('giftbox', 'bauble', 7.2, -6.6, 9, 5, GB, GB, EIGHT, SEVEN, 1, 4, 3),
      ...diag('nutsoldier', 0, -10.4, 6, 2, 0.5, 0.5, SIX, 0, 2),
      ...[-1, 1].map((s) => grid('toysled', s * 11.6, -1.4, 1, 2, 1.0, 1.4, 'cycle')),
      ...[-1, 1].map((s) => line('wreath', s * 4.6, -0.8, s * 8.0, -0.8, 2)),
      ...[-1, 1].map((s) => line('stocking', s * 4.4, 1.6, s * 8.4, 1.6, 5, SIX, 0)),
      ...[-1, 1].map((s) => line('toydrum', s * 4.6, 3.6, s * 12.6, 3.6, 0)),
      carpet('giftbox', 'bauble', -7.0, 7.4, 9, 4, GB, GB, EIGHT, SEVEN, 1, 2, 2),
      carpet('giftbox', 'bauble', 7.0, 7.4, 9, 4, GB, GB, EIGHT, SEVEN, 1, 6, 1),
      ...diag('minicane', 0, 11.4, 22, 2, 0.6, 0.42, SIX, 0, 2),
      ...diag('giftbow', 0, 13.2, 22, 2, 0.6, 0.54, SEVEN, 0, 3),
      ...[-1, 1].map((s) => line('nutsoldier', s * 3.0, 15.2, s * 12.4, 15.2, 19, 'cycle')),
      ...[-1, 1].map((s) => line('giftbox', s * 6.4, 16.8, s * 12.4, 16.8, 8, [3, 0, 1, 2, 4, 5, 6, 7])),
    ],
  },
];
function FESTIVE6() { return SIX; }

export const LEVELS = LIST.map((L) => ({ ...L, place: L.place.flat().filter((op) => op.op !== 'line' && op.op !== 'ring' || op.n > 0) }));

// Per-level tuning merged into difficulty.js / pars.js by allLevels.js:
//   times: CHALLENGE seconds, grow: CHALLENGE growth multiplier (default 0.6),
//   pars: CHALLENGE [3-star, 2-star], relaxedPars: Easy-mode [3-star, 2-star].
export const TUNING = {
  // Measured 2026-10-05 with validate_cli: B = slower of two CHALLENGE bot clears, E = Easy clear.
  // times = ceil5(1.32 * B + 6); pars = [ceil5(B + 3), ceil5(1.15 * B + 5)]; relaxedPars = [ceil5(2.2E + 15), ceil5(3.4E + 25)].
  times: { 91: 55, 92: 80, 93: 75, 94: 80, 95: 90, 96: 55, 97: 70, 98: 110, 99: 90, 100: 85, 101: 60, 102: 85, 103: 65, 104: 75, 105: 85 },
  // TIGHT SQUEEZE growth: 0.55 on every board, a touch more on the finales (centerpiece gate).
  grow: { 91: 0.55, 92: 0.55, 93: 0.55, 94: 0.55, 95: 0.57, 96: 0.55, 97: 0.55, 98: 0.55, 99: 0.55, 100: 0.57, 101: 0.55, 102: 0.55, 103: 0.55, 104: 0.55, 105: 0.58 },
  pars: { 91: [40, 45], 92: [60, 70], 93: [55, 65], 94: [60, 70], 95: [65, 75], 96: [40, 50], 97: [50, 60], 98: [80, 95], 99: [65, 80], 100: [65, 75], 101: [45, 55], 102: [65, 75], 103: [50, 60], 104: [55, 65], 105: [60, 75] },
  relaxedPars: { 91: [65, 100], 92: [110, 170], 93: [105, 165], 94: [105, 165], 95: [120, 190], 96: [80, 120], 97: [95, 145], 98: [125, 195], 99: [135, 210], 100: [105, 165], 101: [75, 120], 102: [120, 185], 103: [80, 120], 104: [105, 165], 105: [115, 180] },
};
