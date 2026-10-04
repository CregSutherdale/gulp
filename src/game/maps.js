// Hand-authored maps. Each character is one 8x8 cell:
//   = - | +  roads (any of them; orientation is inferred from neighbours)
//   h house   s shop    a apartment   o office   T tower
//   p park    f fountain plaza   k parking   m market   b bus stop   g garden
// Lots are decorated by deterministic rules (seeded), so a map always looks the same.
export const CELL = 8;

export const MAPS = {
  downtown: {
    name: 'Sunny Town',
    theme: 'day',
    rows: [
      '+===+===+===+',
      '|hhp|smm|oaT|',
      '|hgp|sfs|aoa|',
      '+===+===+===+',
      '|kpp|ffs|Tob|',
      '|hph|pfm|oaa|',
      '+===+===+===+',
      '|hhb|sks|pTo|',
      '|ghh|mfp|aop|',
      '+===+===+===+',
      '|php|pgp|hah|',
      '|hgh|hsh|bhh|',
      '+===+===+===+',
    ],
  },
};

// Tiny seeded RNG so decoration is stable per map.
export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

const ROAD = new Set(['=', '-', '|', '+']);

// Returns { spawns: [{id, x, z, rot, variant, tint?, path?}], flats: [{x,z,w,d,color,y}], size }
export function buildMap(mapId, theme) {
  const m = MAPS[mapId];
  const rows = m.rows;
  const H = rows.length, W = rows[0].length;
  const size = { w: W * CELL, d: H * CELL };
  const ox = -size.w / 2, oz = -size.d / 2;
  const R = rng(mapId.length * 7919 + 17);
  const spawns = [], flats = [];
  const isRoad = (cx, cz) => cz >= 0 && cz < H && cx >= 0 && cx < W && ROAD.has(rows[cz][cx]);
  const cellCenter = (cx, cz) => [ox + cx * CELL + CELL / 2, oz + cz * CELL + CELL / 2];
  const add = (id, x, z, rot = R() * Math.PI * 2, extra = {}) => spawns.push({ id, x, z, rot, variant: Math.floor(R() * 8), ...extra });
  const jitter = (a) => (R() - 0.5) * a;

  // Block perimeters for walkers and drivers: each block is the rectangle of lot cells
  // between road lines. People loop on the sidewalk ring, cars loop on the lane ring.
  const blocks = [];
  for (let cz = 0; cz < H; cz++) for (let cx = 0; cx < W; cx++) {
    if (isRoad(cx, cz)) continue;
    if (!isRoad(cx - 1, cz) || !isRoad(cx, cz - 1)) continue; // top-left lot of a block
    let ex = cx; while (!isRoad(ex + 1, cz)) ex++;
    let ez = cz; while (!isRoad(cx, ez + 1)) ez++;
    blocks.push({ x0: ox + cx * CELL, z0: oz + cz * CELL, x1: ox + (ex + 1) * CELL, z1: oz + (ez + 1) * CELL });
  }
  const ringPath = (b, off) => [
    [b.x0 - off, b.z0 - off], [b.x1 + off, b.z0 - off], [b.x1 + off, b.z1 + off], [b.x0 - off, b.z1 + off],
  ];

  // ---------- ground flats ----------
  for (let cz = 0; cz < H; cz++) for (let cx = 0; cx < W; cx++) {
    const [x, z] = cellCenter(cx, cz);
    const ch = rows[cz][cx];
    if (ROAD.has(ch)) {
      flats.push({ x, z, w: CELL, d: CELL, color: theme.asphalt, y: 0.01 });
      const h = isRoad(cx - 1, cz) || isRoad(cx + 1, cz);
      const v = isRoad(cx, cz - 1) || isRoad(cx, cz + 1);
      const cross = h && v;
      if (!cross) {
        // centre dashes
        for (let i = 0; i < 2; i++) {
          const t = -CELL / 4 + i * CELL / 2;
          if (h) flats.push({ x: x + t, z, w: 1.6, d: 0.16, color: theme.lane, y: 0.02 });
          else flats.push({ x, z: z + t, w: 0.16, d: 1.6, color: theme.lane, y: 0.02 });
        }
      } else {
        // crosswalk stripes on the four approaches
        for (let i = -2; i <= 2; i++) {
          flats.push({ x: x + i * 0.9, z: z - CELL / 2 + 0.7, w: 0.45, d: 1.2, color: theme.zebra, y: 0.02 });
          flats.push({ x: x + i * 0.9, z: z + CELL / 2 - 0.7, w: 0.45, d: 1.2, color: theme.zebra, y: 0.02 });
          flats.push({ x: x - CELL / 2 + 0.7, z: z + i * 0.9, w: 1.2, d: 0.45, color: theme.zebra, y: 0.02 });
          flats.push({ x: x + CELL / 2 - 0.7, z: z + i * 0.9, w: 1.2, d: 0.45, color: theme.zebra, y: 0.02 });
        }
      }
      continue;
    }
    const base = { p: theme.park, f: theme.plaza, k: theme.lot, m: theme.plaza, g: theme.park, b: theme.plaza }[ch] || theme.yard;
    flats.push({ x, z, w: CELL, d: CELL, color: base, y: 0.012 });
    // sidewalk strips along any road edge
    const sw = 1.1;
    if (isRoad(cx - 1, cz)) flats.push({ x: x - CELL / 2 + sw / 2, z, w: sw, d: CELL, color: theme.sidewalk, y: 0.022 });
    if (isRoad(cx + 1, cz)) flats.push({ x: x + CELL / 2 - sw / 2, z, w: sw, d: CELL, color: theme.sidewalk, y: 0.022 });
    if (isRoad(cx, cz - 1)) flats.push({ x, z: z - CELL / 2 + sw / 2, w: CELL, d: sw, color: theme.sidewalk, y: 0.022 });
    if (isRoad(cx, cz + 1)) flats.push({ x, z: z + CELL / 2 - sw / 2, w: CELL, d: sw, color: theme.sidewalk, y: 0.022 });
    if (ch === 'k') for (let i = -1; i <= 1; i++) flats.push({ x: x + i * 2.4, z, w: 0.12, d: 5.2, color: theme.lane, y: 0.024 });
    if (ch === 'f') flats.push({ x, z, w: 5.6, d: 5.6, color: theme.plaza2, y: 0.02 });
  }

  // ---------- lot decoration ----------
  const faceRoad = (cx, cz) => {
    if (isRoad(cx, cz + 1)) return 0; if (isRoad(cx, cz - 1)) return Math.PI;
    if (isRoad(cx + 1, cz)) return Math.PI / 2; return -Math.PI / 2;
  };
  const corners = (x, z, n, ids, inset = 2.9) => {
    const cs = [[-1, -1], [1, -1], [1, 1], [-1, 1]].sort(() => R() - 0.5).slice(0, n);
    cs.forEach(([a, b]) => add(ids[Math.floor(R() * ids.length)], x + a * inset + jitter(0.4), z + b * inset + jitter(0.4)));
  };
  for (let cz = 0; cz < H; cz++) for (let cx = 0; cx < W; cx++) {
    const ch = rows[cz][cx];
    if (ROAD.has(ch)) continue;
    const [x, z] = cellCenter(cx, cz);
    const face = faceRoad(cx, cz);
    switch (ch) {
      case 'h':
        add('house', x + jitter(0.6), z + jitter(0.6), face);
        corners(x, z, 2, ['bush', 'tree', 'pot', 'flowerbed']);
        if (R() < 0.6) add('mailbox', x + Math.sin(face) * 2.6 + 1.6, z + Math.cos(face) * 2.6, face);
        if (R() < 0.5) add('person', x + jitter(5), z + jitter(5));
        break;
      case 's':
        add('shop', x, z, face);
        add(R() < 0.5 ? 'bike' : 'bench', x + Math.sin(face) * 3.0 + jitter(2), z + Math.cos(face) * 3.0, face + Math.PI / 2);
        corners(x, z, 2, ['pot', 'pot', 'bin', 'vending'], 3.1);
        for (let i = 0; i < 2; i++) add('person', x + jitter(6), z + jitter(6));
        break;
      case 'a':
        add('apartment', x, z, face);
        corners(x, z, 3, ['bush', 'bin', 'bike', 'tree'], 3.3);
        break;
      case 'o':
        add('office', x, z, face);
        corners(x, z, 2, ['flowerbed', 'bench', 'pot'], 3.4);
        break;
      case 'T':
        add('tower', x, z, face);
        break;
      case 'p': case 'g': {
        const n = ch === 'p' ? 3 : 2;
        for (let i = 0; i < n; i++) add(R() < 0.35 ? 'pine' : 'tree', x + jitter(5.5), z + jitter(5.5));
        for (let i = 0; i < 3; i++) add(ch === 'g' ? 'flowerbed' : 'bush', x + jitter(6), z + jitter(6));
        if (R() < 0.7) add('bench', x + jitter(4), z + jitter(4));
        if (ch === 'p' && R() < 0.4) add('cart', x + jitter(3), z + jitter(3));
        for (let i = 0; i < 3; i++) add('person', x + jitter(6), z + jitter(6));
        if (ch === 'g') for (let i = 0; i < 4; i++) add('pot', x + jitter(6), z + jitter(6));
        break;
      }
      case 'f':
        add('fountain', x, z, 0);
        for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; add('bench', x + Math.cos(a) * 3.0, z + Math.sin(a) * 3.0, -a + Math.PI / 2); }
        for (let i = 0; i < 5; i++) add('person', x + jitter(7), z + jitter(7));
        corners(x, z, 2, ['pot', 'lamp', 'kiosk'], 3.4);
        break;
      case 'k':
        for (let i = -1; i <= 1; i += 2) for (let j = -1; j <= 1; j += 2) if (R() < 0.85)
          add(R() < 0.15 ? 'van' : R() < 0.15 ? 'taxi' : 'car', x + i * 1.2, z + j * 1.6, Math.PI / 2 + (R() < 0.5 ? 0 : Math.PI));
        for (let i = 0; i < 3; i++) add('cone', x + jitter(6), z + 3.4 * (R() < 0.5 ? -1 : 1));
        break;
      case 'm':
        for (let i = 0; i < 3; i++) add(R() < 0.5 ? 'cart' : 'kiosk', x + jitter(4.5), z + jitter(4.5));
        for (let i = 0; i < 4; i++) add('person', x + jitter(6.5), z + jitter(6.5));
        add('booth', x + 3.0 * (R() < 0.5 ? -1 : 1), z + 3.0, face);
        add('vending', x - 3.0, z - 3.0 * (R() < 0.5 ? -1 : 1), face);
        break;
      case 'b':
        add('shelter', x + Math.sin(face) * 2.4, z + Math.cos(face) * 2.4, face);
        add(R() < 0.5 ? 'bus' : 'truck', x - Math.cos(face) * 0.4, z + Math.sin(face) * 0.4, face + Math.PI / 2);
        for (let i = 0; i < 3; i++) add('person', x + jitter(5), z + jitter(5));
        add('sign', x + jitter(5), z + jitter(5));
        break;
    }
  }

  // ---------- street furniture along sidewalks + traffic ----------
  for (const b of blocks) {
    const sidewalk = ringPath(b, -0.55); // negative = inside the block, on the sidewalk strip
    // lamps, hydrants, bins, signs dotted along the ring
    for (let e = 0; e < 4; e++) {
      const [ax, az] = sidewalk[e], [bx, bz] = sidewalk[(e + 1) % 4];
      const len = Math.hypot(bx - ax, bz - az);
      const n = Math.floor(len / 5.5);
      for (let i = 1; i < n; i++) {
        const t = i / n;
        const px = ax + (bx - ax) * t, pz = az + (bz - az) * t;
        const roll = R();
        const id = roll < 0.4 ? 'lamp' : roll < 0.55 ? 'hydrant' : roll < 0.72 ? 'bin' : roll < 0.8 ? 'sign' : roll < 0.9 ? 'cone' : 'pot';
        add(id, px + jitter(0.3), pz + jitter(0.3));
      }
    }
    const walkers = 3 + Math.floor(R() * 3);
    for (let i = 0; i < walkers; i++) {
      const e = Math.floor(R() * 4), t = R();
      const [ax, az] = sidewalk[e], [bx, bz] = sidewalk[(e + 1) % 4];
      const dir = R() < 0.5 ? 1 : -1;
      add('person', ax + (bx - ax) * t, az + (bz - az) * t, 0, { path: { pts: sidewalk, seg: e, dir, speed: 1.1 + R() * 0.5 } });
    }
    // cars circling the block in the lane nearest to it (traffic drives on the right)
    const lane = ringPath(b, 2.2);
    const cars = 1 + Math.floor(R() * 2);
    for (let i = 0; i < cars; i++) {
      const e = Math.floor(R() * 4), t = 0.2 + R() * 0.6;
      const [ax, az] = lane[e], [bx, bz] = lane[(e + 1) % 4];
      const roll = R();
      const id = roll < 0.12 ? 'bus' : roll < 0.25 ? 'taxi' : roll < 0.35 ? 'van' : roll < 0.42 ? 'truck' : 'car';
      add(id, ax + (bx - ax) * t, az + (bz - az) * t, 0, { path: { pts: lane, seg: e, dir: 1, speed: 3.2 + R() * 1.4 } });
    }
  }
  return { spawns, flats, size };
}
