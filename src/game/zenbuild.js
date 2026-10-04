// Zen boards: a big, calm, endless board for one world, made from that world's own
// props. Hand-tuned recipe: a grid of "plots", each holding one tidy arrangement
// (grid / ring / row / pile / single), small things near the start, bigger things
// farther away, so growing up the board feels like a journey.
import { PROPS } from './props.js';
import { rng } from './maps.js';

export const ZEN_ARENA = { w: 30, d: 44 };

export function zenPropsFor(world, levels) {
  const ids = new Set();
  for (const L of levels) if (L.world === world) for (const op of L.place) if (PROPS[op.id]) ids.add(op.id);
  return [...ids].sort((a, b) => PROPS[a].fit - PROPS[b].fit);
}

export function buildZenLevel(world, levels) {
  const ids = zenPropsFor(world, levels);
  const R = rng(world.length * 4567 + 89);
  const { w, d } = ZEN_ARENA;
  const place = [];
  const cols = 4, rows = 7, pw = w / cols, pd = (d - 4) / rows;
  const small = ids.filter((id) => PROPS[id].fit <= 1.0);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // Row 0 is nearest the start (bottom of the board, +z).
      const x = -w / 2 + (c + 0.5) * pw + (R() - 0.5) * 0.6;
      const z = d / 2 - 4 - (r + 0.5) * pd + (R() - 0.5) * 0.6;
      if (r === 0 && (c === 1 || c === 2) && R() < 0.5) continue; // breathing room at the start
      // Bias prop size by distance from the start: near = small, far = big.
      const t = Math.min(1, (r + R() * 1.5) / rows);
      const pool = ids.filter((id) => PROPS[id].fit <= 0.7 + t * 4.2 && PROPS[id].fit >= t * 1.6 - 0.3);
      const id = (pool.length ? pool : ids)[Math.floor(R() * (pool.length || ids.length))];
      const f = PROPS[id].fit, gap = f + 0.3;
      const room = Math.min(pw, pd) - 1.2;
      if (f > room * 0.55) { place.push({ op: 'at', id, x, z, rot: (R() - 0.5) * 0.6, tint: 'random' }); continue; }
      const n = Math.max(1, Math.floor(room / gap));
      const kind = R();
      if (kind < 0.4 && n >= 2) {
        place.push({ op: 'grid', id, x, z, cols: n, rows: Math.max(1, Math.min(n, Math.floor((pd - 1.2) / gap))), gap, tint: 'cycle' });
      } else if (kind < 0.65 && n >= 3) {
        const rad = room / 2 - f / 2;
        const k = Math.max(3, Math.min(14, Math.floor((2 * Math.PI * rad) / gap)));
        place.push({ op: 'ring', id, x, z, n: k, r: rad, tint: 'cycle' });
        // something small in the middle of the ring
        if (small.length && rad > 1.4) place.push({ op: 'pile', id: small[Math.floor(R() * small.length)], x, z, n: 6, spread: Math.max(0.5, rad - f / 2 - 0.6), tint: 'random' });
      } else if (kind < 0.8 && n >= 3) {
        place.push({ op: 'line', id, x0: x - room / 2 + f / 2, z0: z, x1: x + room / 2 - f / 2, z1: z, n, tint: 'cycle' });
        if (pd > gap * 2 + 1.2) place.push({ op: 'line', id, x0: x - room / 2 + f / 2, z0: z - gap, x1: x + room / 2 - f / 2, z1: z - gap, n, tint: 'cycle' });
      } else {
        place.push({ op: 'pile', id, x, z, n: Math.min(18, n * n), spread: room / 2 - f / 2, tint: 'random' });
      }
    }
  }
  // A carpet of tiny things around the start so the first minute is all snacking.
  if (small.length) {
    place.push({ op: 'pile', id: small[0], x: -4, z: d / 2 - 3, n: 10, spread: 2.2, tint: 'random' });
    place.push({ op: 'pile', id: small[Math.min(1, small.length - 1)], x: 4, z: d / 2 - 3, n: 10, spread: 2.2, tint: 'random' });
  }
  return { id: 1000 + world.length, name: 'Zen', world, arena: { ...ZEN_ARENA }, time: 0, start: [0, d / 2 - 1.5], targets: [], place };
}
