// Gulp Season 4: 15 levels, ids 61-75, 5 per world (tea, florist, library). This is the
// BRAIN TEASER season (Amanda beat all 60, Season 3 included). Harder by READING and
// CHOOSING, not just by size:
//   - three target types on most boards (four on the finales), so the list itself is busy,
//   - color targets hide among 7-8 look-alike tints (rose next to blush, blue next to
//     periwinkle...) in jittered, mixed fields: no tidy color rows to sweep,
//   - the same prop comes small and big (cuppa/bigcuppa, posy/bigposy, book/bigbook) and
//     only ONE size is on the list: the other size is a decoy that looks exactly the same,
//   - targets are threaded through decoy fields and parked in opposite corners, so the
//     route she plans from the intro overview matters,
//   - growth 0.6 (0.55 where the margin allows): the big pieces only fit after a real meal.
// Fair-hard: tools/check_levels.mjs keeps 30% spare filler at each board's growth, and the
// validator must clear every board with a careful bot AND an erratic "human" driver.
// Only grid/ring/line/at ops; every pattern expands to plain `at` ops (deterministic rng).
const TAU = Math.PI * 2, PI = Math.PI;
const r3 = (v) => Math.round(v * 1000) / 1000;

// ------------------------------------------------------------------ plain ops
// Footprint diameters (prop fit) so the patterns below never put two things in contact.
const FIT = { sugarcube: 0.42, teaspoon: 0.64, petitfour: 0.51, meringue: 0.4, teasandwich: 0.65, creamjug: 0.56, cuppa: 0.84, bigcuppa: 1.94, tinyteapot: 1.0, cakestand: 1.5, tieredtray: 1.8, teachair: 1.84, teatable: 2.8, teatrolley: 2.95, teapothouse: 5.2, petal: 0.34, rosebud: 0.65, seedpacket: 0.6, posy: 0.6, bigposy: 1.56, ribbonroll: 0.6, florcan: 0.99, bouquet: 0.8, vase: 0.54, flowerbucket: 1.1, flowercrate: 1.94, flowershelf: 2.6, potbench: 3.31, flowercart: 5.19, bookmark: 0.52, pencil: 0.65, inkpot: 0.4, book: 0.86, bigbook: 1.98, bookstack: 1.29, readlamp: 0.9, globe: 1.0, cushion: 1.2, footstool: 1.5, readchair: 3.11, bookcart: 2.68, bookcase: 5.13 };
// Everything placed so far on the board being written (fields steer clear of it).
let CUR = [];
const begin = () => { CUR = []; return []; };
const at = (id, x, z, tint = 0, rot = 0) => { CUR.push([x, z, (FIT[id] || 1) / 2]); return { op: 'at', id, x: r3(x), z: r3(z), tint, rot: r3(rot) }; };
const clear = (x, z, r, gap = 0.13) => CUR.every(([px, pz, pr]) => Math.hypot(px - x, pz - z) >= pr + r + gap);
const tintOf = (tint, i) => (Array.isArray(tint) ? tint[i % tint.length] : typeof tint === 'number' ? tint : i);
function line(id, x0, z0, x1, z1, n, tint = 'cycle', rot) {
  return Array.from({ length: n }, (_, i) => { const t = n === 1 ? 0.5 : i / (n - 1); return at(id, x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, tintOf(tint, i), rot ?? 0); });
}
function ring(id, x, z, n, r, tint = 'cycle', phase = 0, rot) {
  return Array.from({ length: n }, (_, i) => { const a = phase + (i / n) * TAU; return at(id, x + Math.cos(a) * r, z + Math.sin(a) * r, tintOf(tint, i), rot ?? PI / 2 - a); });
}

// ------------------------------------------------------------------ brain-teaser patterns
// Seeded rng so every board is the same every time.
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// Jittered field: a cols x rows lattice (spacing gx, gz) around (cx, cz), each point nudged
// by up to `jit`, skipping points inside any `avoid` disc [x, z, r]. pick(R, i, x, z)
// returns [id, tint] (or null to leave a gap). Spacing must exceed the largest fit + 0.1 +
// 2*jit, so nothing ever touches; box props get a random turn.
function field(seed, cx, cz, cols, rows, gx, gz, pick, { jit = 0.1, avoid = [], turn = true, pad = 0.13 } = {}) {
  const R = rng(seed), out = [];
  let i = 0;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x = cx + (c - (cols - 1) / 2) * gx + (R() * 2 - 1) * jit, z = cz + (r - (rows - 1) / 2) * gz + (R() * 2 - 1) * jit;
    const a = R() * TAU;
    if (avoid.some(([ax, az, ar]) => Math.hypot(x - ax, z - az) < ar)) continue;
    const p = pick(R, i++, x, z);
    if (!p) continue;
    const rr = (FIT[p[0]] || 1) / 2;
    // jittered spot first, then the plain lattice spot, else leave a gap
    if (clear(x, z, rr, pad)) out.push(at(p[0], x, z, p[1], turn ? a : 0));
    else {
      const x0 = cx + (c - (cols - 1) / 2) * gx, z0 = cz + (r - (rows - 1) / 2) * gz;
      if (clear(x0, z0, rr, pad)) out.push(at(p[0], x0, z0, p[1], turn ? a : 0));
    }
  }
  return out;
}
// Tint picker: the target tint with probability pT, else one of its look-alikes (weighted
// toward the near neighbours `near`), else any other tint.
const lookalike = (target, n, near, pT = 0.16, pNear = 0.5) => (R) => {
  const u = R();
  if (u < pT) return target;
  if (u < pT + pNear) return near[Math.floor(R() * near.length)];
  let t; do t = Math.floor(R() * n); while (t === target);
  return t;
};
// Weighted id pick: [[id, weight, tintFn|number], ...]
const mix = (list) => (R) => {
  const tot = list.reduce((s, l) => s + l[1], 0);
  let u = R() * tot;
  for (const [id, w, t] of list) { if ((u -= w) <= 0) return [id, typeof t === 'function' ? t(R) : t ?? Math.floor(R() * 4)]; }
  const [id, , t] = list[list.length - 1];
  return [id, typeof t === 'function' ? t(R) : t ?? 0];
};
const anyT = (n) => (R) => Math.floor(R() * n);
const startAvoid = (z, w = 2.1) => [0, z, w];
// Last pass on every board: a loose lattice over the whole arena that fills the open
// cloth between the set pieces (keeping `pad` of breathing room round them), so the board
// reads full like a real table, and adds the filler the big pieces need.
const fill = (seed, L, g, pick, pad = 0.45) => {
  const cols = Math.floor((L.w - 3.6) / g) + 1, rows = Math.floor((L.d - 3.6) / g) + 1;
  return field(seed, 0, 0, cols, rows, g, g, pick, { jit: 0.12, pad, avoid: [startAvoid(L.d / 2 - 2.2, 2.2)] });
};

// ------------------------------------------------------------------ tint names (for reading)
// sugarcube / petitfour / meringue (TEA7): 0 rose, 1 blush, 2 peach, 3 apricot, 4 lilac, 5 sky, 6 mint
// cuppa / bigcuppa / tinyteapot (CUP8): 0 pink, 1 coral, 2 butter, 3 mint, 4 blue, 5 periwinkle, 6 lilac, 7 teal
// petal / rosebud / posy / bigposy / bouquet / flowerbucket / flowercrate (FLO8):
//   0 red, 1 pink, 2 blush, 3 orange, 4 yellow, 5 white, 6 purple, 7 periwinkle
// bookmark / book / bigbook / bookstack (BOOK8): 0 red, 1 terracotta, 2 blue, 3 teal, 4 green, 5 purple, 6 mustard, 7 pink
// pencil: 0 yellow, 1 pink, 2 blue, 3 mint, 4 lilac, 5 orange
const TINY_TEA = (seedT = anyT(7)) => mix([['sugarcube', 3, seedT], ['meringue', 3, anyT(7)], ['petitfour', 2, anyT(7)]]);

const LIST = [
  // ======================================================== TEA PARTY
  {
    // Sugar cubes in seven pastel tints spill across the cloth; only the BLUSH ones count
    // (rose and peach sit right next to them). Little teacups wait in the far corners and
    // teaspoons line the sides; the big cups are decoys.
    id: 61, name: 'Sugar Bowl', world: 'tea', arena: { w: 24, d: 30 }, time: 200, start: [0, 12.8],
    targets: [{ id: 'sugarcube', n: 'all', tint: 1 }, { id: 'cuppa', n: 'all' }, { id: 'teaspoon', n: 'all' }],
    place: [
      ...begin(),
      ...[[-8.4, -12.2], [8.4, -12.2], [-9.4, 2.2], [9.4, -4.0], [-3.4, -12.4], [3.4, -12.4]].map(([x, z], k) => at('cuppa', x, z, [0, 4, 2, 5, 6, 3][k])),
      ...line('bigcuppa', -7.0, -8.6, 7.0, -8.6, 4, [4, 0, 5, 1], 0),
      ...field(611, 0, -2.0, 16, 9, 0.72, 0.72, mix([['sugarcube', 7, lookalike(1, 7, [0, 2], 0.18, 0.5)], ['meringue', 2, anyT(7)]]), { avoid: [[-9.4, 2.2, 1.0]] }),
      ...[-1, 1].map((s) => line('teaspoon', s * 10.2, -10.0, s * 10.2, -5.6, 5, [0, 1, 2, 3, 4], PI / 2)),
      ...[-1, 1].map((s) => line('teaspoon', s * 7.6, 4.4, s * 3.0, 4.4, 5, [2, 0, 4, 1, 3], 0)),
      ...ring('sugarcube', 0, -12.0, 8, 0.9, [1, 0, 2, 1, 3, 0, 1, 2]), at('tinyteapot', 0, -12.0, 4),
      ...field(612, 0, 7.6, 16, 3, 0.72, 0.72, TINY_TEA(lookalike(1, 7, [0, 2], 0.2, 0.5))),
      ...field(613, 0, 11.4, 9, 3, 0.72, 0.72, mix([['meringue', 3, anyT(7)], ['petitfour', 2, anyT(7)], ['sugarcube', 2, lookalike(1, 7, [0, 2], 0.2, 0.5)]]), { avoid: [startAvoid(12.8)] }),
      ...[-1, 1].flatMap((s) => [at('creamjug', s * 9.2, 9.6, 0), at('creamjug', s * 9.2, 12.0, 2), at('teasandwich', s * 7.6, 12.4, 1, 0.3 * s)]),
      at('cuppa', 5.0, 13.4, 7), at('cuppa', -5.0, 13.4, 1),
      ...fill(619, { w: 24, d: 30 }, 1.5, TINY_TEA(lookalike(1, 7, [0, 2], 0.08, 0.5))),
    ],
  },
  {
    // BIG CUP, little cup: the five BIG teacups are the target and the board is full of
    // little cups in the same colors (decoys, and good food). Lilac petits fours hide among
    // rose, blush and sky ones; sandwiches sit in pairs by the cups.
    id: 62, name: 'Big Cup, Little Cup', world: 'tea', arena: { w: 24, d: 32 }, time: 220, start: [0, 13.8],
    targets: [{ id: 'bigcuppa', n: 'all' }, { id: 'petitfour', n: 'all', tint: 4 }, { id: 'teasandwich', n: 'all' }],
    place: [
      ...begin(),
      at('bigcuppa', -8.6, -13.0, 0), at('bigcuppa', 8.6, -13.0, 5), at('bigcuppa', 0, -6.0, 3), at('bigcuppa', -9.0, 1.0, 6), at('bigcuppa', 9.0, 4.0, 2),
      ...ring('cuppa', 0, -6.0, 7, 2.3, [0, 5, 1, 6, 2, 7, 4]),
      ...field(621, 0, -12.0, 9, 3, 1.05, 1.05, mix([['cuppa', 1, anyT(8)]]), { avoid: [[-8.6, -13.0, 1.9], [8.6, -13.0, 1.9]] }),
      ...field(622, -4.2, -1.0, 7, 5, 0.75, 0.75, mix([['petitfour', 6, lookalike(4, 7, [5, 0, 1], 0.2, 0.5)], ['sugarcube', 2, anyT(7)]])),
      ...field(623, 4.4, 0.0, 7, 5, 0.75, 0.75, mix([['petitfour', 6, lookalike(4, 7, [5, 0, 1], 0.2, 0.5)], ['meringue', 2, anyT(7)]]), { avoid: [[9.0, 4.0, 1.9]] }),
      ...[[-6.4, -9.0], [6.4, -9.0], [-2.6, 4.6], [6.0, 7.2], [-9.4, 6.2], [9.6, -5.6]].flatMap(([x, z], k) => [at('teasandwich', x - 0.45, z, k % 4, 0.4), at('teasandwich', x + 0.45, z, (k + 1) % 4, -0.4 + PI)]),
      ...line('cuppa', -9.8, -9.0, -9.8, -3.0, 5, [4, 5, 6, 0, 1], 0), ...line('cuppa', 9.8, -9.6, 9.8, -7.0, 2, [2, 3], 0),
      ...field(624, 0, 9.6, 16, 3, 0.74, 0.74, TINY_TEA(), { avoid: [[6.0, 7.2, 1.2], [9.0, 4.0, 1.9]] }),
      ...field(625, 0, 13.0, 12, 2, 0.74, 0.74, TINY_TEA(), { avoid: [startAvoid(13.8)] }),
      ...[-1, 1].map((s) => at('petitfour', s * 9.8, 13.2, 4)),
      ...[-1, 1].map((s) => at('tinyteapot', s * 5.6, 4.4, s < 0 ? 3 : 6)),
      ...fill(629, { w: 24, d: 32 }, 1.5, mix([['cuppa', 2, anyT(8)], ['sugarcube', 3, anyT(7)], ['meringue', 3, anyT(7)]])),
    ],
  },
  {
    // A meringue maze: winding lanes of meringues in every pastel, the APRICOT ones are on
    // the list (peach and butter-yellow are the look-alikes). Little teapots sit at the
    // lane ends; cream jugs guard the far corners.
    id: 63, name: 'Meringue Maze', world: 'tea', arena: { w: 26, d: 32 }, time: 220, start: [0, 13.8],
    targets: [{ id: 'meringue', n: 'all', tint: 3 }, { id: 'tinyteapot', n: 'all' }, { id: 'creamjug', n: 'all' }],
    place: [
      ...begin(),
      // lanes: three S-curves of meringues with decoy sugar between
      ...[-9.0, -3.0, 3.0, 9.0].flatMap((z, k) => field(631 + k, (k % 2 ? 1 : -1) * 1.4, z, 26, 2, 0.66, 0.66, mix([['meringue', 5, lookalike(3, 7, [2, 0], 0.15, 0.55)], ['sugarcube', 1, anyT(7)]]), { jit: 0.08, avoid: [[(k % 2 ? -1 : 1) * 10.2, z, 1.4]] })),
      ...[-9.0, -3.0, 3.0, 9.0].map((z, k) => at('tinyteapot', (k % 2 ? -1 : 1) * 10.6, z, [0, 4, 6, 2][k])),
      ...[-6.0, 0.0, 6.0].flatMap((z, k) => line('teaspoon', -10.0, z, 10.0, z, 15, [0, 1, 2, 3, 4], 0)),
      ...[[-10.6, -13.6, 0], [10.6, -13.6, 1], [-10.6, 13.6, 2], [10.6, 13.0, 3], [0, -13.6, 2]].map(([x, z, t]) => at('creamjug', x, z, t)),
      ...line('petitfour', -8.4, -13.6, -2.0, -13.6, 9, [0, 1, 2, 3, 4, 5, 6]), ...line('petitfour', 2.0, -13.6, 8.4, -13.6, 9, [6, 5, 4, 2, 1, 0, 3]),
      ...line('tinyteapot', -6.0, -11.6, 6.0, -11.6, 3, [5, 7, 1], 0),
      ...field(635, 0, 12.0, 14, 3, 0.7, 0.7, TINY_TEA(), { avoid: [startAvoid(13.8)] }),
      ...[-1, 1].map((s) => at('cuppa', s * 7.4, 12.8, s < 0 ? 0 : 5)),
      ...fill(639, { w: 26, d: 32 }, 1.5, mix([['sugarcube', 3, anyT(7)], ['petitfour', 2, anyT(7)], ['meringue', 2, lookalike(3, 7, [2, 0], 0.08, 0.5)]])),
    ],
  },
  {
    // GROWTH GATE: two tiered trays in opposite corners and cake stands round the cloth.
    // ROSE petits fours hide among blush and peach ones; little teapots and cups are food.
    id: 64, name: 'Tiered Treats', world: 'tea', arena: { w: 26, d: 34 }, time: 240, start: [0, 14.8],
    targets: [{ id: 'tieredtray', n: 'all' }, { id: 'cakestand', n: 'all' }, { id: 'petitfour', n: 'all', tint: 0 }],
    place: [
      ...begin(),
      at('tieredtray', -9.6, -14.0, 0), at('tieredtray', 9.6, 6.0, 2),
      at('cakestand', 9.6, -13.8, 1), at('cakestand', -9.8, 0.6, 3), at('cakestand', 0, -4.4, 0), at('cakestand', 2.0, 9.6, 4),
      ...ring('cuppa', 0, -4.4, 8, 1.9, [0, 1, 2, 3, 4, 5, 6, 7]),
      ...ring('meringue', -9.6, -14.0, 9, 1.55, anyTArr(9, 7, 1)),
      ...field(641, 0, -11.2, 16, 4, 0.75, 0.75, mix([['petitfour', 6, lookalike(0, 7, [1, 2], 0.16, 0.6)], ['sugarcube', 2, anyT(7)]]), { avoid: [[-9.6, -14.0, 2.1], [9.6, -13.8, 1.6]] }),
      ...field(642, -5.6, 2.6, 8, 6, 0.75, 0.75, mix([['petitfour', 5, lookalike(0, 7, [1, 2], 0.15, 0.6)], ['meringue', 2, anyT(7)]]), { avoid: [[-9.8, 0.6, 1.7]] }),
      ...field(643, 6.2, -2.2, 6, 6, 0.75, 0.75, mix([['sugarcube', 3, anyT(7)], ['petitfour', 4, lookalike(0, 7, [1, 2], 0.12, 0.6)]])),
      ...[-1, 1].flatMap((s) => [at('tinyteapot', s * 4.8, -7.6, s < 0 ? 0 : 5), at('creamjug', s * 11.0, -7.0, s < 0 ? 1 : 3)]),
      ...line('cuppa', -10.6, 4.4, -10.6, 9.6, 5, [1, 3, 5, 7, 2], 0),
      ...line('teaspoon', -7.6, 7.4, -2.0, 7.4, 6, [0, 1, 2, 3, 4], 0.3),
      ...field(644, 0, 12.0, 16, 3, 0.74, 0.74, TINY_TEA(), { avoid: [startAvoid(14.8), [2.0, 9.6, 1.3], [9.6, 6.0, 2.0]] }),
      ...[-1, 1].map((s) => line('teasandwich', s * 7.0, 14.6, s * 11.0, 14.6, 4, [0, 1, 2, 3], 0)),
      ...fill(649, { w: 26, d: 34 }, 1.5, mix([['cuppa', 2, anyT(8)], ['meringue', 3, anyT(7)], ['petitfour', 2, lookalike(0, 7, [1, 2], 0.08, 0.6)], ['teasandwich', 1, anyT(4)]])),
    ],
  },
  {
    // CENTERPIECE: the Teapot Cottage at the top of the lawn. PERIWINKLE teacups hide
    // among blue and lilac ones; tea tables and tea trolleys sit in opposite corners.
    id: 65, name: 'Teapot Cottage', world: 'tea', arena: { w: 30, d: 40 }, time: 300, start: [0, 17.8],
    targets: [{ id: 'cuppa', n: 'all', tint: 5 }, { id: 'teatable', n: 'all' }, { id: 'teatrolley', n: 'all' }, { id: 'teapothouse', n: 'all' }],
    place: [
      ...begin(),
      at('teapothouse', 0, -15.6, 0),
      at('teatable', -10.8, -16.0, 0), at('teatable', 10.8, 3.0, 2), at('teatable', -10.8, 8.6, 4),
      at('teatrolley', 10.4, -16.6, 1, 0), at('teatrolley', -10.6, -4.8, 3, PI / 2),
      ...[-1, 1].flatMap((s) => [at('bigcuppa', s * 5.4, -11.4, s < 0 ? 4 : 6), at('teachair', s * 7.6, -8.4, s < 0 ? 1 : 3), at('cakestand', s * 3.6, -8.2, s < 0 ? 0 : 2)]),
      at('tieredtray', 0, -1.6, 1), ...ring('cuppa', 0, -1.6, 9, 1.85, [5, 4, 6, 3, 5, 0, 7, 4, 6]),
      ...field(651, 0, -5.6, 22, 3, 0.74, 0.74, TINY_TEA(), { avoid: [[-10.6, -4.8, 2.0], [-3.6, -8.2, 1.2], [3.6, -8.2, 1.2]] }),
      ...field(652, 4.8, 2.6, 10, 6, 0.95, 0.95, mix([['cuppa', 4, lookalike(5, 8, [4, 6], 0.18, 0.6)], ['petitfour', 3, anyT(7)]]), { avoid: [[0, -1.6, 2.9], [10.8, 3.0, 2.1]] }),
      ...field(653, -5.0, 2.6, 8, 5, 0.95, 0.95, mix([['cuppa', 4, lookalike(5, 8, [4, 6], 0.18, 0.6)], ['sugarcube', 3, anyT(7)]]), { avoid: [[0, -1.6, 2.9], [-10.6, -4.8, 2.0]] }),
      ...[-1, 1].flatMap((s) => [at('bigcuppa', s * 4.4, 8.8, s < 0 ? 5 : 4), at('tinyteapot', s * 7.4, 8.8, s < 0 ? 5 : 1), at('teachair', s * 1.6, 8.8, 2)]),
      ...line('teasandwich', -12.6, -11.6, -12.6, -7.6, 6, [0, 1, 2, 3], 0), ...line('teasandwich', 12.6, -11.6, 12.6, -0.4, 13, [3, 2, 1, 0], 0),
      ...line('creamjug', -8.0, -12.6, -6.4, -12.6, 2, [0, 1]), ...line('creamjug', 6.4, -12.6, 8.0, -12.6, 2, [2, 3]),
      ...field(654, 0, 12.6, 26, 4, 0.74, 0.74, TINY_TEA(), { avoid: [[-10.8, 8.6, 2.0], startAvoid(17.8)] }),
      ...field(655, 0, 16.2, 22, 2, 0.74, 0.74, mix([['meringue', 3, anyT(7)], ['sugarcube', 3, anyT(7)], ['cuppa', 1, lookalike(5, 8, [4, 6], 0.2, 0.6)]]), { avoid: [startAvoid(17.8)] }),
      ...[-1, 1].flatMap((s) => [at('creamjug', s * 13.4, 12.0, 0), at('creamjug', s * 13.4, 14.0, 1), at('teaspoon', s * 13.2, 17.6, 3, PI / 2)]),
      ...[-1, 1].map((s) => at('cuppa', s * 13.2, -18.4, 5)),
      ...fill(659, { w: 30, d: 40 }, 1.8, mix([['cuppa', 2, lookalike(5, 8, [4, 6], 0.08, 0.6)], ['meringue', 3, anyT(7)], ['petitfour', 3, anyT(7)], ['teasandwich', 1, anyT(4)], ['tinyteapot', 1, anyT(8)]])),
    ],
  },

  // ======================================================== FLOWER SHOP
  {
    // Petals swept into drifts of eight colors; the PINK ones count (red and blush beside
    // them). Seed packets on the counter shelves, ribbon rolls in the corners.
    id: 66, name: 'Petal Sweep', world: 'florist', arena: { w: 24, d: 30 }, time: 200, start: [0, 12.8],
    targets: [{ id: 'petal', n: 'all', tint: 1 }, { id: 'seedpacket', n: 'all' }, { id: 'ribbonroll', n: 'all' }],
    place: [
      ...begin(),
      ...field(661, -4.0, -8.4, 11, 8, 0.6, 0.6, mix([['petal', 1, lookalike(1, 8, [0, 2], 0.18, 0.55)]]), { jit: 0.08 }),
      ...field(662, 5.0, 1.0, 10, 8, 0.6, 0.6, mix([['petal', 1, lookalike(1, 8, [0, 2], 0.18, 0.55)]]), { jit: 0.08 }),
      ...field(663, -4.6, 4.2, 8, 5, 0.6, 0.6, mix([['petal', 1, lookalike(1, 8, [0, 2], 0.16, 0.55)]]), { jit: 0.08 }),
      ...[-1, 1].map((s) => line('seedpacket', s * 10.2, -12.6, s * 10.2, -2.0, 9, [0, 1, 2, 3, 4], PI / 2)),
      ...line('seedpacket', 2.4, -12.8, 9.0, -12.8, 7, [4, 3, 2, 1, 0], 0),
      ...[[-10.0, 12.4, 0], [10.0, 12.4, 3], [9.4, -6.4, 2], [-9.6, 1.8, 4], [0, -13.0, 5], [5.6, -6.2, 1]].map(([x, z, t]) => at('ribbonroll', x, z, t)),
      ...line('posy', 0.8, -5.0, 0.8, 5.6, 9, [0, 2, 4, 6, 1, 3, 5, 7, 0]),
      ...ring('rosebud', 8.6, 8.4, 7, 1.2, [0, 1, 2, 3, 4, 5, 6]), at('vase', 8.6, 8.4, 0),
      ...field(664, 0, 9.4, 14, 2, 0.72, 0.72, mix([['petal', 3, lookalike(1, 8, [0, 2], 0.2, 0.5)], ['seedpacket', 1, anyT(5)], ['ribbonroll', 1, anyT(6)]]), { avoid: [[8.6, 8.4, 2.0]] }),
      ...field(665, -0.6, 12.0, 11, 3, 0.72, 0.72, mix([['petal', 3, anyT(8)], ['posy', 1, anyT(8)]]), { avoid: [startAvoid(12.8)] }),
      ...fill(669, { w: 24, d: 30 }, 1.5, mix([['petal', 3, lookalike(1, 8, [0, 2], 0.08, 0.5)], ['posy', 1, anyT(8)], ['rosebud', 1, anyT(8)]])),
    ],
  },
  {
    // LITTLE pots on the list, PURPLE ones only (periwinkle and pink are the look-alikes),
    // while big pots in the same colors stand guard. Watering cans and vases fill the rest.
    id: 67, name: 'Little Pots, Big Pots', world: 'florist', arena: { w: 24, d: 32 }, time: 220, start: [0, 13.8],
    targets: [{ id: 'posy', n: 'all', tint: 6 }, { id: 'florcan', n: 'all' }, { id: 'vase', n: 'all' }],
    place: [
      ...begin(),
      ...field(671, 0, -10.6, 7, 3, 2.2, 1.9, mix([['bigposy', 1, lookalike(6, 8, [7, 1], 0.3, 0.6)]]), { jit: 0.1 }),
      ...field(672, 0, -3.6, 14, 6, 0.78, 0.78, mix([['posy', 5, lookalike(6, 8, [7, 1], 0.18, 0.55)], ['petal', 2, anyT(8)]])),
      ...[-1, 1].flatMap((s) => [at('florcan', s * 10.0, -13.8, s < 0 ? 0 : 2, 0), at('florcan', s * 10.0, 2.8, s < 0 ? 3 : 1, 0)]),
      ...[-1, 1].map((s) => line('vase', s * 10.4, -8.0, s * 10.4, -1.0, 6, s < 0 ? [0, 1, 2, 3, 4, 5] : [5, 4, 3, 2, 1, 0])),
      ...field(673, 0, 4.6, 7, 2, 2.2, 1.9, mix([['bigposy', 1, lookalike(6, 8, [7, 1], 0.3, 0.6)]])),
      ...field(674, 0, 8.6, 15, 3, 0.78, 0.78, mix([['posy', 4, lookalike(6, 8, [7, 1], 0.18, 0.55)], ['seedpacket', 2, anyT(5)], ['ribbonroll', 2, anyT(6)]])),
      ...field(675, 0, 12.4, 12, 2, 0.78, 0.78, mix([['petal', 3, anyT(8)], ['seedpacket', 1, anyT(5)]]), { avoid: [startAvoid(13.8)] }),
      ...[-1, 1].map((s) => at('vase', s * 10.4, 13.6, s < 0 ? 2 : 4)),
      at('florcan', 0, -14.0, 4, 0),
      ...fill(679, { w: 24, d: 32 }, 1.5, mix([['posy', 2, lookalike(6, 8, [7, 1], 0.08, 0.6)], ['petal', 3, anyT(8)], ['seedpacket', 1, anyT(5)]])),
    ],
  },
  {
    // The bouquet counter: BLUSH bouquets among pink and white ones, RED rosebuds strewn
    // between buds of every color, and flower buckets at the four corners.
    id: 68, name: 'Bouquet Counter', world: 'florist', arena: { w: 26, d: 34 }, time: 240, start: [0, 14.8],
    targets: [{ id: 'bouquet', n: 'all', tint: 2 }, { id: 'rosebud', n: 'all', tint: 0 }, { id: 'flowerbucket', n: 'all' }],
    place: [
      ...begin(),
      ...[[-10.6, -15.0, 0], [10.6, -15.0, 4], [-10.6, 8.6, 6], [10.6, 2.0, 1], [0, -8.0, 5]].map(([x, z, t]) => at('flowerbucket', x, z, t)),
      ...ring('bouquet', 0, -8.0, 8, 1.7, [2, 1, 5, 2, 0, 1, 7, 5]),
      ...field(681, 0, -13.0, 14, 3, 0.95, 0.95, mix([['bouquet', 3, lookalike(2, 8, [1, 5], 0.15, 0.6)], ['rosebud', 2, lookalike(0, 8, [1, 3], 0.15, 0.6)]]), { avoid: [[-10.6, -15.0, 1.6], [10.6, -15.0, 1.6], [0, -8.0, 2.8]] }),
      ...field(682, -5.0, -1.6, 9, 6, 0.85, 0.85, mix([['rosebud', 4, lookalike(0, 8, [1, 3], 0.18, 0.5)], ['petal', 3, anyT(8)], ['bouquet', 1, lookalike(2, 8, [1, 5], 0.2, 0.6)]]), { avoid: [[0, -8.0, 2.8]] }),
      ...field(683, 5.4, -1.4, 7, 5, 0.85, 0.85, mix([['posy', 3, anyT(8)], ['rosebud', 3, lookalike(0, 8, [1, 3], 0.18, 0.5)]]), { avoid: [[10.6, 2.0, 1.6], [0, -8.0, 2.8]] }),
      ...[-1, 1].map((s) => line('vase', s * 2.0, 3.4, s * 8.0, 3.4, 7, [0, 1, 2, 3, 4, 5])),
      ...field(684, 0, 6.6, 18, 2, 0.85, 0.85, mix([['bouquet', 2, lookalike(2, 8, [1, 5], 0.18, 0.6)], ['ribbonroll', 2, anyT(6)], ['seedpacket', 2, anyT(5)]]), { avoid: [[-10.6, 8.6, 1.6]] }),
      ...field(685, 0, 10.6, 18, 3, 0.75, 0.75, mix([['petal', 3, anyT(8)], ['rosebud', 2, lookalike(0, 8, [1, 3], 0.15, 0.5)], ['seedpacket', 1, anyT(5)]]), { avoid: [[-10.6, 8.6, 1.6]] }),
      ...field(686, 0, 13.6, 14, 2, 0.75, 0.75, mix([['petal', 3, anyT(8)], ['posy', 1, anyT(8)]]), { avoid: [startAvoid(14.8)] }),
      ...[-1, 1].map((s) => at('florcan', s * 10.6, 14.6, s < 0 ? 0 : 3, 0)),
      ...fill(689, { w: 26, d: 34 }, 1.5, mix([['petal', 3, anyT(8)], ['rosebud', 2, lookalike(0, 8, [1, 3], 0.08, 0.5)], ['posy', 2, anyT(8)]])),
    ],
  },
  {
    // GROWTH GATE: flower shelves in opposite corners, crates down the middle, and the BIG
    // YELLOW pots are the target this time (little yellow pots are just food).
    id: 69, name: 'Shelf Life', world: 'florist', arena: { w: 26, d: 36 }, time: 240, start: [0, 15.8],
    targets: [{ id: 'flowershelf', n: 'all' }, { id: 'bigposy', n: 'all', tint: 4 }, { id: 'flowercrate', n: 'all' }],
    place: [
      ...begin(),
      at('flowershelf', -9.4, -15.6, 0), at('flowershelf', 9.4, 7.4, 2),
      ...[[-3.2, -10.6], [3.2, -10.6], [0, -4.0], [-8.6, 1.6]].map(([x, z], k) => at('flowercrate', x, z, k * 2, 0)),
      ...field(691, 6.2, -12.6, 4, 4, 2.0, 2.0, mix([['bigposy', 1, lookalike(4, 8, [3, 5], 0.3, 0.6)]]), { avoid: [[3.2, -10.6, 2.2]] }),
      ...field(692, -6.0, -6.6, 4, 2, 2.0, 2.0, mix([['bigposy', 1, lookalike(4, 8, [3, 5], 0.3, 0.6)]])),
      ...field(693, 5.2, -1.4, 5, 4, 1.9, 1.9, mix([['bigposy', 2, lookalike(4, 8, [3, 5], 0.3, 0.6)], ['posy', 1, 4]]), { avoid: [[0, -4.0, 2.1]] }),
      ...field(694, -3.6, 4.6, 11, 4, 0.78, 0.78, mix([['posy', 4, lookalike(4, 8, [3, 5], 0.3, 0.5)], ['petal', 2, anyT(8)], ['seedpacket', 1, anyT(5)]]), { avoid: [[-8.6, 1.6, 2.0]] }),
      ...field(695, 0, 10.2, 18, 3, 0.8, 0.8, mix([['posy', 3, anyT(8)], ['rosebud', 2, anyT(8)], ['ribbonroll', 1, anyT(6)]]), { avoid: [[9.4, 7.4, 2.2]] }),
      ...field(696, 0, 14.2, 16, 2, 0.75, 0.75, mix([['petal', 3, anyT(8)], ['seedpacket', 1, anyT(5)]]), { avoid: [startAvoid(15.8)] }),
      ...[-1, 1].map((s) => line('flowerbucket', s * 11.0, -8.0, s * 11.0, -2.0, 4, [0, 3, 5, 7])),
      ...[-1, 1].map((s) => line('vase', s * 0.5, -15.8, s * 2.0, -15.8, 3, [0, 1, 2])),
      ...line('florcan', -11.0, 7.0, -11.0, 15.4, 6, [0, 1, 2, 3, 4], 0),
      at('bigposy', 11.0, 15.0, 4), at('bigposy', -11.0, -12.0, 3),
      ...fill(699, { w: 26, d: 36 }, 1.5, mix([['posy', 3, anyT(8)], ['petal', 2, anyT(8)], ['bouquet', 1, anyT(8)], ['seedpacket', 1, anyT(5)]])),
    ],
  },
  {
    // CENTERPIECE: the Flower Cart up top, potting benches in opposite corners, flower
    // buckets round the shop and PERIWINKLE bouquets hidden among purple and blue ones.
    id: 70, name: 'Flower Cart', world: 'florist', arena: { w: 30, d: 40 }, time: 300, start: [0, 17.8],
    targets: [{ id: 'bouquet', n: 'all', tint: 7 }, { id: 'flowerbucket', n: 'all' }, { id: 'potbench', n: 'all' }, { id: 'flowercart', n: 'all' }],
    place: [
      ...begin(),
      at('flowercart', 0, -16.2, 0, 0),
      at('potbench', -10.6, -16.2, 0, 0), at('potbench', 10.8, 4.6, 2, PI / 2),
      ...[-1, 1].flatMap((s) => [at('flowershelf', s * 10.6, -10.4, s < 0 ? 1 : 3, 0), at('flowercrate', s * 5.4, -11.6, s < 0 ? 0 : 4, 0), at('bigposy', s * 2.0, -11.6, s < 0 ? 6 : 7)]),
      ...[[-12.4, -4.0, 0], [5.8, -6.6, 3], [-5.8, -6.6, 5], [-12.4, 10.4, 6], [12.4, 12.4, 1], [0, 2.0, 4]].map(([x, z, t]) => at('flowerbucket', x, z, t)),
      ...ring('bouquet', 0, 2.0, 8, 1.7, [7, 6, 2, 7, 1, 6, 5, 4]),
      ...field(701, 0, -7.0, 14, 3, 0.85, 0.85, mix([['rosebud', 3, anyT(8)], ['posy', 3, anyT(8)], ['bouquet', 1, lookalike(7, 8, [6, 1], 0.2, 0.6)]]), { avoid: [[5.8, -6.6, 1.5], [-5.8, -6.6, 1.5]] }),
      ...field(702, -6.0, 2.4, 8, 7, 0.95, 0.95, mix([['bouquet', 4, lookalike(7, 8, [6, 4], 0.16, 0.6)], ['posy', 3, anyT(8)]]), { avoid: [[0, 2.0, 2.8], [-12.4, -4.0, 1.5]] }),
      ...field(703, 5.4, 0.0, 6, 6, 0.95, 0.95, mix([['bouquet', 4, lookalike(7, 8, [6, 4], 0.16, 0.6)], ['seedpacket', 2, anyT(5)]]), { avoid: [[0, 2.0, 2.8], [10.8, 4.6, 2.2]] }),
      ...[-1, 1].flatMap((s) => [at('bigposy', s * 6.4, 8.6, s < 0 ? 1 : 2), at('florcan', s * 3.6, 8.6, s < 0 ? 0 : 4, 0), at('flowercrate', s * 10.0, 9.2, 2, PI / 2)]),
      ...field(704, 0, 12.6, 22, 3, 0.8, 0.8, mix([['petal', 3, anyT(8)], ['posy', 2, anyT(8)], ['bouquet', 1, lookalike(7, 8, [6, 4], 0.2, 0.6)]]), { avoid: [[-12.4, 10.4, 1.5], [12.4, 12.4, 1.5]] }),
      ...field(705, 0, 16.4, 22, 3, 0.75, 0.75, mix([['petal', 4, anyT(8)], ['seedpacket', 1, anyT(5)], ['ribbonroll', 1, anyT(6)]]), { avoid: [startAvoid(17.8)] }),
      ...[-1, 1].map((s) => line('vase', s * 13.4, -8.0, s * 13.4, -1.0, 6, [0, 1, 2, 3, 4, 5])),
      ...[-1, 1].map((s) => at('bouquet', s * 13.4, -18.4, 7)),
      ...fill(709, { w: 30, d: 40 }, 1.8, mix([['posy', 3, anyT(8)], ['petal', 2, anyT(8)], ['rosebud', 2, anyT(8)], ['bouquet', 1, lookalike(7, 8, [6, 4], 0.1, 0.6)], ['florcan', 1, anyT(5)]])),
    ],
  },

  // ======================================================== COZY LIBRARY
  {
    // Bookmarks scattered like fallen leaves: the TEAL ones (blue and green right next to
    // them) count. Pencils in pots of a dozen, ink bottles along the far wall.
    id: 71, name: 'Lost Bookmarks', world: 'library', arena: { w: 24, d: 30 }, time: 200, start: [0, 12.8],
    targets: [{ id: 'bookmark', n: 'all', tint: 3 }, { id: 'pencil', n: 'all' }, { id: 'inkpot', n: 'all' }],
    place: [
      ...begin(),
      ...field(711, 0, -6.4, 18, 8, 0.66, 0.66, mix([['bookmark', 1, lookalike(3, 8, [2, 4], 0.16, 0.55)]]), { jit: 0.08, avoid: [[0, -6.4, 1.6]] }),
      at('globe', 0, -6.4, 1),
      ...line('inkpot', -9.0, -13.0, 9.0, -13.0, 13, [0, 1, 2, 3]),
      ...[-1, 1].map((s) => line('pencil', s * 10.2, -10.6, s * 10.2, 2.0, 15, [0, 1, 2, 3, 4, 5], PI / 2)),
      ...field(712, 0, 2.6, 14, 5, 0.75, 0.75, mix([['bookmark', 3, lookalike(3, 8, [2, 4], 0.18, 0.5)], ['book', 2, anyT(8)], ['inkpot', 1, anyT(4)]]), { avoid: [[-6.0, 2.6, 1.5], [6.0, 2.6, 1.5]] }),
      ...[-1, 1].map((s) => at('readlamp', s * 6.0, 2.6, s < 0 ? 0 : 3)),
      ...field(713, 0, 8.8, 15, 2, 0.75, 0.75, mix([['book', 2, anyT(8)], ['pencil', 2, anyT(6)], ['bookmark', 2, lookalike(3, 8, [2, 4], 0.2, 0.5)]])),
      ...field(714, 0, 11.6, 10, 3, 0.7, 0.7, mix([['bookmark', 3, anyT(8)], ['inkpot', 1, anyT(4)]]), { avoid: [startAvoid(12.8)] }),
      ...[-1, 1].flatMap((s) => [at('inkpot', s * 9.8, 12.6, 3), at('bookstack', s * 9.0, 7.0, s < 0 ? 1 : 4, 0)]),
      ...fill(719, { w: 24, d: 30 }, 1.5, mix([['bookmark', 3, lookalike(3, 8, [2, 4], 0.08, 0.5)], ['book', 2, anyT(8)]])),
    ],
  },
  {
    // LITTLE books on the list, MUSTARD ones only (terracotta and pink look close); big
    // books in all eight colors are decoys. Reading lamps and globes at the corners.
    id: 72, name: 'Small Print', world: 'library', arena: { w: 24, d: 32 }, time: 220, start: [0, 13.8],
    targets: [{ id: 'book', n: 'all', tint: 6 }, { id: 'readlamp', n: 'all' }, { id: 'globe', n: 'all' }],
    place: [
      ...begin(),
      ...field(721, 0, -11.2, 6, 3, 2.3, 2.1, mix([['bigbook', 1, lookalike(6, 8, [1, 7], 0.3, 0.5)]]), { jit: 0.08 }),
      ...field(722, 0, -3.4, 12, 6, 1.0, 0.95, mix([['book', 5, lookalike(6, 8, [1, 7, 0], 0.16, 0.55)], ['bookmark', 1, anyT(8)]])),
      ...[[-10.2, -14.2, 0], [10.2, -14.2, 1], [-10.2, 1.6, 2], [10.2, -5.0, 3], [3.0, 5.8, 4]].map(([x, z, t]) => at('readlamp', x, z, t)),
      ...[[10.2, 1.6, 0], [-10.2, -6.6, 1], [-5.0, 5.8, 2], [0, -14.4, 3]].map(([x, z, t]) => at('globe', x, z, t)),
      ...field(723, 0, 3.0, 6, 1, 2.3, 2.1, mix([['bigbook', 1, lookalike(6, 8, [1, 7], 0.3, 0.5)]])),
      ...field(724, 0, 8.6, 13, 3, 0.98, 0.95, mix([['book', 3, lookalike(6, 8, [1, 7, 0], 0.16, 0.55)], ['pencil', 2, anyT(6)], ['inkpot', 1, anyT(4)]]), { avoid: [[3.0, 5.8, 1.0], [-5.0, 5.8, 1.1]] }),
      ...field(725, 0, 12.4, 12, 2, 0.75, 0.75, mix([['bookmark', 3, anyT(8)], ['inkpot', 1, anyT(4)]]), { avoid: [startAvoid(13.8)] }),
      ...[-1, 1].map((s) => at('book', s * 10.2, 13.0, 6, 0.2)),
      ...fill(729, { w: 24, d: 32 }, 1.5, mix([['book', 2, lookalike(6, 8, [1, 7, 0], 0.08, 0.55)], ['bookmark', 3, anyT(8)], ['inkpot', 1, anyT(4)]])),
    ],
  },
  {
    // BIG books on the list this time, RED ones only (pink and terracotta look close);
    // little books are just food. Floor cushions and footstools make a reading nook.
    id: 73, name: 'Reading Nook', world: 'library', arena: { w: 26, d: 34 }, time: 240, start: [0, 14.8],
    targets: [{ id: 'bigbook', n: 'all', tint: 0 }, { id: 'cushion', n: 'all' }, { id: 'footstool', n: 'all' }],
    place: [
      ...begin(),
      ...field(731, -5.4, -11.8, 4, 4, 2.3, 2.1, mix([['bigbook', 1, lookalike(0, 8, [7, 1], 0.28, 0.6)]])),
      ...field(732, 6.6, 0.4, 3, 4, 2.3, 2.1, mix([['bigbook', 1, lookalike(0, 8, [7, 1], 0.28, 0.6)]])),
      ...[[6.6, -13.6, 0], [10.6, -13.6, 2], [-10.6, 1.0, 4], [0, -5.0, 1], [-4.4, 8.0, 3]].map(([x, z, t]) => at('footstool', x, z, t, 0)),
      ...ring('cushion', 0, -5.0, 6, 2.2, [0, 1, 2, 3, 4, 5], PI / 6, 0),
      ...[[8.4, -8.6, 2], [-10.6, -4.4, 5], [10.6, 8.6, 1]].map(([x, z, t]) => at('cushion', x, z, t)),
      ...field(733, -4.2, 2.0, 9, 5, 0.98, 0.98, mix([['book', 4, lookalike(0, 8, [7, 1], 0.25, 0.5)], ['pencil', 2, anyT(6)]]), { avoid: [[-10.6, 1.0, 1.6], [0, -5.0, 3.6]] }),
      ...field(734, 6.6, -8.0, 5, 3, 0.98, 0.98, mix([['book', 3, anyT(8)], ['inkpot', 2, anyT(4)]]), { avoid: [[8.4, -8.6, 1.4]] }),
      ...field(735, 0, 10.8, 17, 3, 0.85, 0.85, mix([['bookmark', 3, anyT(8)], ['book', 2, anyT(8)], ['pencil', 2, anyT(6)]]), { avoid: [[-4.4, 8.0, 1.4], [10.6, 8.6, 1.4]] }),
      ...field(736, 0, 13.8, 13, 2, 0.75, 0.75, mix([['bookmark', 3, anyT(8)], ['inkpot', 1, anyT(4)]]), { avoid: [startAvoid(14.8)] }),
      ...[-1, 1].map((s) => line('readlamp', s * 11.2, -12.0, s * 11.2, -9.0, 3, [0, 1, 2])),
      ...line('globe', -10.8, 5.0, -10.8, 7.4, 3, [0, 1, 2]),
      at('bigbook', 10.6, 13.6, 0, 0.2),
      ...fill(739, { w: 26, d: 34 }, 1.5, mix([['book', 3, anyT(8)], ['bookmark', 2, anyT(8)], ['pencil', 2, anyT(6)], ['globe', 1, anyT(4)]])),
    ],
  },
  {
    // GROWTH GATE: two reading chairs in opposite corners and book carts on the other two;
    // LILAC pencils hide among pink and blue ones in the pencil drifts.
    id: 74, name: 'Quiet Corner', world: 'library', arena: { w: 26, d: 36 }, time: 260, start: [0, 15.8],
    targets: [{ id: 'readchair', n: 'all' }, { id: 'bookcart', n: 'all' }, { id: 'pencil', n: 'all', tint: 4 }],
    place: [
      ...begin(),
      at('readchair', -9.6, -15.2, 0, 0), at('readchair', 9.4, 6.6, 3, 0),
      at('bookcart', 9.2, -15.6, 1, 0), at('bookcart', -9.0, 2.0, 2, 0),
      ...[-1, 1].flatMap((s) => [at('footstool', s * 4.8, -14.6, s < 0 ? 0 : 2, 0), at('bigbook', s * 2.0, -10.4, s < 0 ? 3 : 5, 0.3)]),
      ...field(741, 0, -6.4, 16, 5, 0.8, 0.8, mix([['pencil', 5, lookalike(4, 6, [1, 2], 0.16, 0.6)], ['bookmark', 2, anyT(8)]])),
      ...field(742, 4.4, 0.6, 9, 6, 0.8, 0.8, mix([['pencil', 4, lookalike(4, 6, [1, 2], 0.16, 0.6)], ['inkpot', 1, anyT(4)], ['book', 2, anyT(8)]])),
      ...[-1, 1].flatMap((s) => [at('cushion', s * 11.0, -10.0, s < 0 ? 1 : 4), at('globe', s * 11.2, -6.6, s < 0 ? 0 : 2), at('readlamp', s * 11.2, -3.6, s < 0 ? 4 : 1)]),
      ...line('bookstack', -9.6, 6.6, -3.0, 6.6, 4, [0, 2, 4, 6], 0),
      ...field(743, -1.4, 10.4, 16, 3, 0.8, 0.8, mix([['pencil', 3, lookalike(4, 6, [1, 2], 0.14, 0.6)], ['book', 2, anyT(8)], ['bookmark', 2, anyT(8)]]), { avoid: [[9.4, 6.6, 2.0]] }),
      ...field(744, 0, 14.2, 15, 2, 0.75, 0.75, mix([['bookmark', 3, anyT(8)], ['inkpot', 1, anyT(4)], ['pencil', 1, anyT(6)]]), { avoid: [startAvoid(15.8)] }),
      at('footstool', 10.2, 13.6, 3, 0), at('cushion', -10.6, 14.0, 5),
      ...[-1, 1].map((s) => at('pencil', s * 11.0, 16.4, 4, 0)),
      ...fill(749, { w: 26, d: 36 }, 1.5, mix([['pencil', 2, lookalike(4, 6, [1, 2], 0.08, 0.6)], ['bookmark', 2, anyT(8)], ['book', 2, anyT(8)], ['inkpot', 1, anyT(4)]])),
    ],
  },
  {
    // CENTERPIECE: the Grand Bookcase. PURPLE books hide among blue and pink ones in every
    // pile; book stacks and reading chairs sit in opposite corners of the reading room.
    id: 75, name: 'Grand Bookcase', world: 'library', arena: { w: 32, d: 42 }, time: 300, start: [0, 18.8],
    targets: [{ id: 'book', n: 'all', tint: 5 }, { id: 'bookstack', n: 'all' }, { id: 'readchair', n: 'all' }, { id: 'bookcase', n: 'all' }],
    place: [
      ...begin(),
      at('bookcase', 0, -18.2, 0, 0),
      at('readchair', -12.4, -17.4, 0, 0), at('readchair', 12.6, 4.2, 4, 0), at('readchair', -12.4, 11.0, 1, 0),
      ...[-1, 1].flatMap((s) => [at('bookcart', s * 6.2, -13.6, s < 0 ? 0 : 3, 0), at('footstool', s * 10.4, -12.6, s < 0 ? 1 : 3, 0), at('bigbook', s * 2.4, -13.2, s < 0 ? 5 : 2, 0)]),
      at('bookcart', 12.0, -17.6, 2, 0),
      ...[[-13.2, -7.0, 0], [8.2, -8.6, 2], [-6.4, -1.4, 5], [13.4, -2.4, 7], [0, 6.4, 4], [13.2, 17.6, 1], [-13.4, 4.0, 6]].map(([x, z, t]) => at('bookstack', x, z, t, 0)),
      ...field(751, -2.0, -8.8, 15, 4, 0.98, 0.98, mix([['book', 4, lookalike(5, 8, [2, 7], 0.16, 0.6)], ['pencil', 2, anyT(6)], ['cushion', 0, 0]]), { avoid: [[8.2, -8.6, 1.4]] }),
      ...field(752, 4.2, -1.2, 11, 6, 0.98, 0.98, mix([['book', 4, lookalike(5, 8, [2, 7], 0.16, 0.6)], ['bookmark', 2, anyT(8)]]), { avoid: [[-6.4, -1.4, 1.4], [13.4, -2.4, 1.4], [12.6, 4.2, 2.3]] }),
      ...field(753, -9.0, 0.8, 5, 6, 0.98, 0.98, mix([['book', 3, lookalike(5, 8, [2, 7], 0.18, 0.6)], ['inkpot', 2, anyT(4)]]), { avoid: [[-6.4, -1.4, 1.4], [-13.2, -7.0, 1.4], [-13.4, 4.0, 1.4]] }),
      ...[-1, 1].flatMap((s) => [at('globe', s * 4.4, 6.4, s < 0 ? 0 : 3), at('readlamp', s * 7.4, 6.4, s < 0 ? 2 : 4), at('cushion', s * 10.2, 7.6, s < 0 ? 0 : 3)]),
      ...field(754, 1.2, 12.0, 24, 4, 0.86, 0.86, mix([['bookmark', 3, anyT(8)], ['pencil', 2, anyT(6)], ['book', 2, lookalike(5, 8, [2, 7], 0.18, 0.6)]]), { avoid: [[-12.4, 11.0, 2.3]] }),
      ...field(755, 0, 16.8, 26, 3, 0.75, 0.75, mix([['bookmark', 3, anyT(8)], ['inkpot', 2, anyT(4)]]), { avoid: [startAvoid(18.8), [13.2, 17.6, 1.4]] }),
      ...[-1, 1].map((s) => at('book', s * 14.2, -19.2, 5, 0.3)),
      ...fill(759, { w: 32, d: 42 }, 1.8, mix([['book', 3, lookalike(5, 8, [2, 7], 0.08, 0.6)], ['bookmark', 2, anyT(8)], ['pencil', 2, anyT(6)], ['inkpot', 1, anyT(4)], ['readlamp', 1, anyT(5)]])),
    ],
  },
];
// A fixed tint list with the target tint `t` sprinkled in (rings round a tray).
function anyTArr(n, nt, t) { const R = rng(n * 31 + t); return Array.from({ length: n }, (_, i) => (i % 3 === 1 ? t : Math.floor(R() * nt))); }

export const LEVELS = LIST.map((L) => ({ ...L, place: L.place.flat() }));

// Per-level tuning (filled from validator runs; see the brief):
//   times: CHALLENGE seconds = ceil5(1.4 * B + 6), B = slower bot clear of two CHALLENGE runs
//   grow: CHALLENGE growth multiplier (default 0.6)
//   pars: CHALLENGE [3-star, 2-star] = [ceil5(B + 3), ceil5(1.15B + 5)]
//   relaxedPars: Easy [3-star, 2-star] = [ceil5(2.2E + 15), ceil5(3.4E + 25)], E = Easy bot clear
export const TUNING = {
  grow: { 61: 0.55, 62: 0.55, 63: 0.55, 64: 0.55, 65: 0.55, 66: 0.55, 67: 0.55, 68: 0.55, 69: 0.55, 70: 0.55, 71: 0.55, 72: 0.55, 73: 0.55, 74: 0.55, 75: 0.55 },
  // measured 2026-10-05: B = slower of two CHALLENGE runs at the growth above, E = Easy run
  times: { 61: 95, 62: 75, 63: 70, 64: 80, 65: 120, 66: 75, 67: 115, 68: 85, 69: 70, 70: 110, 71: 90, 72: 105, 73: 80, 74: 80, 75: 120 },
  pars: { 61: [65, 80], 62: [50, 60], 63: [50, 60], 64: [55, 65], 65: [85, 100], 66: [55, 65], 67: [85, 95], 68: [60, 70], 69: [50, 60], 70: [80, 90], 71: [65, 75], 72: [75, 85], 73: [55, 65], 74: [55, 65], 75: [85, 100] },
  relaxedPars: { 61: [100, 155], 62: [105, 160], 63: [105, 160], 64: [100, 150], 65: [120, 185], 66: [95, 150], 67: [135, 210], 68: [100, 155], 69: [85, 135], 70: [145, 225], 71: [115, 175], 72: [120, 185], 73: [90, 140], 74: [95, 150], 75: [150, 230] },
};
