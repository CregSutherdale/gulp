// Content checker for Gulp's props + levels, both seasons:
//   Season 1: props_cozy.js (80 props)  + levels.js        (30 levels, ids 1-30)
//   Season 2: props_wave2.js            + levels_wave2.js  (15 levels, ids 31-45)
//   Season 3: props_wave3.js            + levels_wave3.js  (15 levels, ids 46-60)
//
//   node tools/check_levels.mjs           everything
//   node tools/check_levels.mjs --props   props only (both packs)
//   node tools/check_levels.mjs --s1      Season 1 props + levels only
//   node tools/check_levels.mjs --s2      Season 2 props + levels only
//   node tools/check_levels.mjs --s3      Season 3 props + levels only
//
// Bundles the real game modules with esbuild (so the ESM sources run in node as-is) and
// places every level with the ENGINE's own buildLevel(), so what is checked is exactly
// what the game spawns. Prop ids are checked for collisions across ALL prop files.
// Exits non-zero on any failure.
import { build } from 'esbuild';
import * as DIFF from '../src/game/difficulty.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROPS_ONLY = process.argv.includes('--props');
const SFLAG = [1, 2, 3, 4, 5, 6, 7].find((n) => process.argv.includes(`--s${n}`));
const WANT = SFLAG ? [SFLAG] : [1, 2, 3, 4, 5, 6, 7];
const CLEAR = 0.1;            // min gap between colliders
const EDGE = 1.0;             // min distance from arena edge
const START_CLEAR = 1.0;      // min gap between the start hole (r 0.5) and any object
const R0 = 0.5, GROW = 0.0436, FIT = 0.9;

const PACKS = [
  { name: 'cozy', season: 1, file: 'src/game/props_cozy.js' },
  { name: 'wave2', season: 2, file: 'src/game/props_wave2.js' },
  { name: 'wave3', season: 3, file: 'src/game/props_wave3.js' },
  { name: 'wave4', season: 4, file: 'src/game/props_wave4.js' },
  { name: 'wave5', season: 5, file: 'src/game/props_wave5.js' },
  { name: 'wave6', season: 6, file: 'src/game/props_wave6.js' },
  { name: 'wave7', season: 7, file: 'src/game/props_wave7.js' },
];
const SEASONS = [
  { season: 1, file: 'src/game/levels.js', count: 30, firstId: 1, margin: 1.4, // filler must reach the largest target with 40% to spare
    worlds: ['bakery', 'picnic', 'playroom', 'garden', 'beach', 'kitchen'] },
  { season: 2, file: 'src/game/levels_wave2.js', count: 15, firstId: 31, margin: 1.5, // ...and 50% in Season 2
    worlds: ['candy', 'farm', 'snow'], pack: 'wave2',
    // Season 2 house rules (she has mastered Season 1)
    arena: { w: [20, 30], d: [28, 40] }, time: [120, 300], types: [2, 3], tintFrom: 32,
    ops: ['grid', 'ring', 'line', 'at'], centerpiece: { every: 5, minFit: 5 } },
  // Season 3 is the CHALLENGE season: margins are computed at CHALLENGE growth (the
  // player's hole grows at 0.75x, difficulty.js), so the filler must carry 40% spare value
  // even at the slower growth. Same house rules as Season 2.
  { season: 3, file: 'src/game/levels_wave3.js', count: 15, firstId: 46, margin: 1.4, grow: 0.75,
    worlds: ['craft', 'fair', 'space'], pack: 'wave3',
    arena: { w: [20, 30], d: [28, 40] }, time: [120, 300], types: [2, 3], tintFrom: 46,
    ops: ['grid', 'ring', 'line', 'at'], centerpiece: { every: 5, minFit: 5 } },
  // Seasons 4-7: the EXPERT seasons (Amanda beat all 60). Same house rules as Season 3;
  // growth per level comes from each file's TUNING.grow (merged below). A season whose
  // file has no levels yet is skipped.
  ...[[4, 61, ['tea', 'florist', 'library']], [5, 76, ['pets', 'aquarium', 'music']], [6, 91, ['spa', 'pumpkin', 'holiday']], [7, 106, ['pizza', 'dino', 'castle']]].map(([season, firstId, worlds]) => (
    { season, file: `src/game/levels_wave${season}.js`, count: 15, firstId, margin: 1.3, worlds, pack: `wave${season}`, optional: true,
      arena: { w: [20, 32], d: [28, 42] }, time: [120, 300], types: [2, 4], tintFrom: firstId,
      ops: ['grid', 'ring', 'line', 'at'], centerpiece: { every: 5, minFit: 5 } })),
];

async function load(entry, tag) {
  const out = path.join(os.tmpdir(), `gulp_check_${tag}_${process.pid}.mjs`);
  await build({ stdin: { contents: entry, resolveDir: ROOT, loader: 'js' }, bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
  try { return await import(pathToFileURL(out).href); } finally { fs.rmSync(out, { force: true }); }
}

const fails = [];
const fail = (where, msg) => fails.push(`${where}: ${msg}`);
const warns = [];
const pad = (s, n) => String(s).padEnd(n);
const lpad = (s, n) => String(s).padStart(n);
const exists = (f) => fs.existsSync(path.join(ROOT, f));

// ------------------------------------------------------------------ load
const city = await load(`export { PROPS } from './src/game/props.js';`, 'city');
const cityIds = new Set(Object.keys(city.PROPS));
for (const p of PACKS) if (!exists(p.file)) fail(`pack ${p.name}`, `${p.file} is missing`);
const seasons = SEASONS.filter((s) => WANT.includes(s.season));
if (!PROPS_ONLY) for (const s of seasons) if (!exists(s.file)) fail(`season ${s.season}`, `${s.file} is missing`);
const M = await load(`
  export { PROPS, buildGeometry, colliderHalfHeight } from './src/game/props.js';
  ${PACKS.filter((p) => exists(p.file)).map((p) => `import './${p.file}';`).join('\n')}
  ${PROPS_ONLY ? '' : `export { buildLevel } from './src/game/levelbuild.js';
  ${seasons.filter((s) => exists(s.file)).map((s) => `export { LEVELS as LEVELS_S${s.season} } from './${s.file}';`).join('\n')}
  ${seasons.filter((s) => s.season >= 4 && exists(s.file)).map((s) => `export { TUNING as TUNING_S${s.season} } from './${s.file}';`).join('\n')}`}
`, 'all');
const { PROPS, buildGeometry, colliderHalfHeight } = M;
// Seasons 4+ carry their own CHALLENGE growth (TUNING.grow); check at that growth.
for (const s of seasons) if (M[`TUNING_S${s.season}`]) Object.assign(DIFF.GROW_BY_LEVEL, M[`TUNING_S${s.season}`].grow);

// ------------------------------------------------------------------ prop ids (all files)
// A def() with an id that already exists silently overwrites the earlier prop, so every
// id must be unique across props.js (city), props_cozy.js and props_wave2.js.
const packIds = {};
const owner = new Map([...cityIds].map((id) => [id, 'props.js (city)']));
for (const p of PACKS) {
  if (!exists(p.file)) { packIds[p.name] = []; continue; }
  const src = fs.readFileSync(path.join(ROOT, p.file), 'utf8');
  const ids = [...src.matchAll(/def\('([a-z0-9_]+)'/g)].map((m) => m[1]);
  packIds[p.name] = ids;
  for (const id of ids) {
    if (owner.has(id)) fail(`prop ${id}`, `id defined twice (${owner.get(id)} and ${p.file}); the later def overwrites the earlier`);
    else owner.set(id, p.file);
  }
}

// ------------------------------------------------------------------ props
const fitOf = (c) => (c.t === 'box' ? Math.hypot(c.w, c.d) : 2 * c.r);
function checkProps(pack) {
  const rows = [];
  for (const id of packIds[pack.name]) {
    const p = PROPS[id], c = p.col, where = `prop ${id}`;
    if (!p.label) fail(where, 'missing label');
    if (!p.tints || p.tints.length < 2) fail(where, 'needs >= 2 tints');
    if (p.walker || p.driver) fail(where, 'content props stay static (no walker/driver)');
    const want = fitOf(c);
    if (Math.abs(p.fit - want) > 0.02) fail(where, `fit ${p.fit} but collider says ${want.toFixed(2)}`);
    const base = Math.max(1, 1.6 * p.fit * p.fit);
    if (p.value < Math.max(1, Math.floor(base * 0.7)) || p.value > Math.ceil(base * 1.3)) fail(where, `value ${p.value} outside 1.6*fit^2 +-30% (${base.toFixed(1)})`);
    if (!(p.mass >= 0.15)) fail(where, `mass ${p.mass} < 0.15`);
    let g;
    try { g = buildGeometry(p, 0); } catch (e) { fail(where, `build threw: ${e.message}`); continue; }
    const pos = g.attributes.position, tris = pos.count / 3;
    const budget = p.fit >= 2.5 ? 2500 : 1500;
    if (tris > budget) fail(where, `${tris} triangles > ${budget}`);
    const hh = colliderHalfHeight(c);
    let minY = Infinity, maxY = -Infinity, maxX = 0, maxZ = 0, maxR = 0, bad = false;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      if (!Number.isFinite(x + y + z)) bad = true;
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      maxX = Math.max(maxX, Math.abs(x)); maxZ = Math.max(maxZ, Math.abs(z)); maxR = Math.max(maxR, Math.hypot(x, z));
    }
    if (bad) fail(where, 'NaN vertex');
    const tm = g.attributes.tmask;
    let tinted = 0;
    for (let i = 0; i < tm.count; i++) if (tm.getX(i) > 0) tinted++;
    if (p.tints && !tinted) fail(where, 'has tints but no TINT part');
    const notes = [];
    if (Math.abs(minY + hh) > 0.025) notes.push(`base ${(minY + hh).toFixed(3)} off the ground`);
    const topTol = Math.max(0.06, 0.12 * 2 * hh);
    if (maxY > hh + 0.06 || maxY < hh - topTol) notes.push(`top ${(maxY + hh).toFixed(2)} vs collider h ${(2 * hh).toFixed(2)}`);
    if (c.t === 'box') {
      if (maxX > c.w / 2 + 0.04 || maxX < c.w / 2 - Math.max(0.05, 0.1 * c.w)) notes.push(`width ${(2 * maxX).toFixed(2)} vs w ${c.w}`);
      if (maxZ > c.d / 2 + 0.04 || maxZ < c.d / 2 - Math.max(0.05, 0.1 * c.d)) notes.push(`depth ${(2 * maxZ).toFixed(2)} vs d ${c.d}`);
    } else if (maxR > c.r + 0.04 || maxR < c.r - Math.max(0.05, 0.12 * c.r)) notes.push(`radius ${maxR.toFixed(2)} vs r ${c.r}`);
    for (const n of notes) fail(where, `collider does not hug the mesh: ${n}`);
    rows.push({ id, fit: p.fit, value: p.value, tris, ok: notes.length === 0, dims: `${(2 * maxX).toFixed(2)}x${(maxY - minY).toFixed(2)}x${(2 * maxZ).toFixed(2)}` });
  }
  console.log(`\nPROPS (${rows.length} ${pack.name} props)`);
  console.log(`${pad('id', 16)}${lpad('fit', 6)}${lpad('value', 7)}${lpad('tris', 7)}  mesh w x h x d`);
  for (const r of rows) console.log(`${pad(r.id, 16)}${lpad(r.fit.toFixed(2), 6)}${lpad(r.value, 7)}${lpad(r.tris, 7)}  ${r.dims}${r.ok ? '' : '  <-- mismatch'}`);
}
for (const pack of PACKS) if (WANT.includes(pack.season)) checkProps(pack);

// ------------------------------------------------------------------ levels
const opCount = (op) => ({ grid: (op.cols || 0) * (op.rows || 0), ring: op.n, line: op.n, pile: op.n, at: 1 }[op.op] ?? -1);
const needFor = (f, g = GROW) => Math.max(0, ((f * f) / (4 * FIT * FIT) - R0 * R0) / g);

// footprint: {x, z, c, s, hx, hz} rectangle or {x, z, r} circle
const foot = (prop, x, z, rot) => {
  const c = prop.col;
  if (c.t === 'box') return { x, z, rect: true, c: Math.cos(rot), s: Math.sin(rot), hx: c.w / 2, hz: c.d / 2 };
  return { x, z, r: c.r };
};
// world-axis half extents of a footprint
const ext = (f) => (f.rect ? [Math.abs(f.c) * f.hx + Math.abs(f.s) * f.hz, Math.abs(f.s) * f.hx + Math.abs(f.c) * f.hz] : [f.r, f.r]);
// local axes for a rotation about Y: local x -> (cos, -sin), local z -> (sin, cos)
const axes = (f) => [[f.c, -f.s], [f.s, f.c]];
function gap(a, b) {
  if (!a.rect && !b.rect) return Math.hypot(a.x - b.x, a.z - b.z) - a.r - b.r;
  if (a.rect && !b.rect) return gap(b, a);
  if (!a.rect && b.rect) {
    const [ux, uz] = axes(b), dx = a.x - b.x, dz = a.z - b.z;
    const lx = dx * ux[0] + dz * ux[1], lz = dx * uz[0] + dz * uz[1];
    const qx = Math.max(Math.abs(lx) - b.hx, 0), qz = Math.max(Math.abs(lz) - b.hz, 0);
    if (qx === 0 && qz === 0) return -1;
    return Math.hypot(qx, qz) - a.r;
  }
  // rect-rect: largest separation along the four SAT axes (a safe lower bound)
  let best = -Infinity;
  for (const ax of [...axes(a), ...axes(b)]) {
    const proj = (f) => {
      const [ux, uz] = axes(f), cx = f.x * ax[0] + f.z * ax[1];
      const r = f.hx * Math.abs(ux[0] * ax[0] + ux[1] * ax[1]) + f.hz * Math.abs(uz[0] * ax[0] + uz[1] * ax[1]);
      return [cx - r, cx + r];
    };
    const [a0, a1] = proj(a), [b0, b1] = proj(b);
    best = Math.max(best, Math.max(b0 - a1, a0 - b1));
  }
  return best;
}

function checkSeason(S) {
  const LEVELS = M[`LEVELS_S${S.season}`];
  if (!LEVELS) return;
  if (S.optional && !LEVELS.length) { console.log(`season ${S.season}: not built yet (skipped)`); return; }
  const { buildLevel } = M;
  if (LEVELS.length !== S.count) fail(`season ${S.season}`, `expected ${S.count} levels, got ${LEVELS.length}`);
  const rows = [];
  const used = new Set();
  LEVELS.forEach((L, li) => {
    const where = `L${L.id} ${L.name}`;
    const id = S.firstId + li, perWorld = S.count / S.worlds.length;
    if (L.id !== id) fail(where, `id should be ${id}`);
    if (L.world !== S.worlds[Math.floor(li / perWorld)]) fail(where, `world ${L.world}, expected ${S.worlds[Math.floor(li / perWorld)]}`);
    for (const op of L.place) { if (!PROPS[op.id]) fail(where, `unknown prop id ${op.id}`); else used.add(op.id); }
    for (const t of L.targets) {
      if (!PROPS[t.id]) fail(where, `unknown target id ${t.id}`);
      else if (t.tint !== undefined && (!Number.isInteger(t.tint) || t.tint < 0 || t.tint >= (PROPS[t.id].tints || [0]).length)) fail(where, `target ${t.id} tint ${t.tint} out of range`);
    }
    // Season 2 house rules
    if (S.arena) {
      const { w, d } = L.arena;
      if (w < S.arena.w[0] || w > S.arena.w[1] || d < S.arena.d[0] || d > S.arena.d[1]) fail(where, `arena ${w}x${d} outside ${S.arena.w[0]}x${S.arena.d[0]}..${S.arena.w[1]}x${S.arena.d[1]}`);
      if (L.time < S.time[0] || L.time > S.time[1]) fail(where, `time ${L.time}s outside ${S.time[0]}-${S.time[1]}s`);
      const kinds = new Set(L.targets.map((t) => t.id)).size;
      if (kinds < S.types[0] || kinds > S.types[1]) fail(where, `${kinds} target types, want ${S.types[0]}-${S.types[1]}`);
      if (L.id >= S.tintFrom && !L.targets.some((t) => t.tint !== undefined)) fail(where, 'needs a color-specific (tint) target');
      for (const op of L.place) if (!S.ops.includes(op.op)) { fail(where, `op '${op.op}' not allowed (use ${S.ops.join('/')})`); break; }
      const big = Math.max(...L.targets.map((t) => PROPS[t.id]?.fit || 0));
      if ((li + 1) % S.centerpiece.every === 0 && big < S.centerpiece.minFit) fail(where, `every ${S.centerpiece.every}th level needs a big centerpiece target (largest fit ${big.toFixed(2)} < ${S.centerpiece.minFit})`);
    }
    if (fails.some((f) => f.startsWith(where))) return;

    const spawns = buildLevel(L).spawns;
    const expected = L.place.reduce((s, op) => s + opCount(op), 0);
    if (spawns.length !== expected) { fail(where, `placer made ${spawns.length} objects, ops ask for ${expected} (a pile ran out of room?)`); return; }
    // tag each spawn with its op (the placer emits ops in order)
    let k = 0;
    const objs = [];
    L.place.forEach((op, oi) => { for (let i = 0; i < opCount(op); i++, k++) { const s = spawns[k]; const prop = PROPS[s.id]; objs.push({ ...s, prop, oi, f: foot(prop, s.x, s.z, s.rot) }); } });

    // bounds
    const hw = L.arena.w / 2 - EDGE, hd = L.arena.d / 2 - EDGE;
    for (const o of objs) {
      const [ex, ez] = ext(o.f);
      if (Math.abs(o.x) + ex > hw + 1e-6 || Math.abs(o.z) + ez > hd + 1e-6) { fail(where, `${o.id} at (${o.x.toFixed(2)}, ${o.z.toFixed(2)}) is within ${EDGE} of the arena edge`); break; }
    }
    // start clear
    const [sx, sz] = L.start;
    for (const o of objs) {
      const g = gap({ x: sx, z: sz, r: R0 }, o.f);
      if (g < START_CLEAR) { fail(where, `start (${sx}, ${sz}) is ${g.toFixed(2)} from ${o.id}`); break; }
    }
    if (Math.abs(sx) > L.arena.w / 2 - 1.5 || Math.abs(sz) > L.arena.d / 2 - 1.5) fail(where, 'start too close to the edge');
    // overlaps (broad phase on a grid)
    const cell = 3, buckets = new Map();
    let overlaps = 0;
    objs.forEach((o, i) => {
      const [ex, ez] = ext(o.f), cand = new Set(), keys = [];
      for (let gx = Math.floor((o.x - ex - CLEAR) / cell); gx <= Math.floor((o.x + ex + CLEAR) / cell); gx++)
        for (let gz = Math.floor((o.z - ez - CLEAR) / cell); gz <= Math.floor((o.z + ez + CLEAR) / cell); gz++) {
          const key = gx * 100000 + gz;
          keys.push(key);
          for (const j of buckets.get(key) || []) cand.add(j);
        }
      for (const j of cand) {
        const g = gap(o.f, objs[j].f);
        if (g < CLEAR) { overlaps++; if (overlaps <= 3) fail(where, `${o.id}#${i} (${o.x.toFixed(2)}, ${o.z.toFixed(2)}) and ${objs[j].id}#${j} (${objs[j].x.toFixed(2)}, ${objs[j].z.toFixed(2)}) are ${g.toFixed(3)} apart (< ${CLEAR})`); }
      }
      for (const key of keys) { const list = buckets.get(key) || []; list.push(i); buckets.set(key, list); }
    });
    if (overlaps > 3) fail(where, `...${overlaps} overlapping pairs in total`);
    // piles: other groups must stay out of each pile's disc, so a change in the placer's
    // random sequence can never push a pile item into a neighbour.
    L.place.forEach((op, oi) => {
      if (op.op !== 'pile') return;
      const R = op.spread + PROPS[op.id].fit / 2 + CLEAR;
      for (const o of objs) if (o.oi !== oi && gap({ x: op.x, z: op.z, r: R }, o.f) < 0) { fail(where, `${o.id} intrudes on the ${op.id} pile disc at (${op.x}, ${op.z})`); break; }
    });

    // targets + solvability
    const isT = (o) => L.targets.some((t) => t.id === o.id && (t.tint === undefined || t.tint === o.tint));
    let maxFit = 0, tcount = 0;
    const tdesc = [];
    for (const t of L.targets) {
      const m = objs.filter((o) => o.id === t.id && (t.tint === undefined || o.tint === t.tint));
      if (!m.length) fail(where, `target ${t.id}${t.tint !== undefined ? ` tint ${t.tint}` : ''} has no objects`);
      if (t.n !== 'all' && m.length < t.n) fail(where, `target ${t.id} wants ${t.n}, only ${m.length} placed`);
      tcount += t.n === 'all' ? m.length : t.n;
      maxFit = Math.max(maxFit, PROPS[t.id].fit);
      tdesc.push(`${t.n === 'all' ? m.length : t.n} ${t.id}${t.tint !== undefined ? `/${t.tint}` : ''}`);
    }
    // Default difficulty is CHALLENGE (src/game/difficulty.js): check every board at the growth
    // the player really gets there, with 30% spare filler (the table was built to that margin).
    const G = GROW * (DIFF.GROW_BY_LEVEL[L.id] ?? DIFF.CHALLENGE_GROW);
    const margin = 1.29;
    const fill = objs.filter((o) => !isT(o)).sort((a, b) => a.prop.fit - b.prop.fit);
    let mass = 0, r = R0, idx = 0;
    while (idx < fill.length && fill[idx].prop.fit <= FIT * 2 * r) { mass += fill[idx].prop.value; r = Math.sqrt(R0 * R0 + G * mass); idx++; }
    const need = needFor(maxFit, G);
    const ratio = need > 0 ? mass / need : Infinity;
    if (ratio < margin) fail(where, `filler reaches value ${mass}, largest target (fit ${maxFit}) needs ${need.toFixed(0)} x ${margin}`);
    // whole-level greedy: everything should be edible eventually (soft)
    const all = [...objs].sort((a, b) => a.prop.fit - b.prop.fit);
    let m2 = 0, r2 = R0, j2 = 0;
    while (j2 < all.length && all[j2].prop.fit <= FIT * 2 * r2) { m2 += all[j2].prop.value; r2 = Math.sqrt(R0 * R0 + G * m2); j2++; }
    if (j2 < all.length) warns.push(`${where}: ${all.length - j2} objects never become edible (largest ${all[all.length - 1].id})`);
    // starter ladder near the start
    const near = objs.filter((o) => o.prop.fit <= FIT * 2 * R0 && Math.hypot(o.x - sx, o.z - sz) < 6).length;
    if (near < 6) fail(where, `only ${near} starter-size objects within 6 of the start`);
    // timer: roughly 1 s per object you must eat plus 25 s to roam (soft)
    let needMass = 0, eatN = 0;
    for (const o of fill) { if (needMass >= need) break; needMass += o.prop.value; eatN++; }
    const est = eatN + tcount;
    if (L.time < est * 0.9 + 25) warns.push(`${where}: time ${L.time}s may be tight for ~${est} required eats`);
    rows.push({ L, n: objs.length, tdesc: tdesc.join(', '), maxFit, need, mass, ratio, est, near });
  });
  // Season 2: every new prop must appear in a level (that is how it reaches the Gulp Book)
  if (S.pack && LEVELS.length) for (const id of packIds[S.pack] || []) if (!used.has(id)) fail(`season ${S.season}`, `prop ${id} is not used by any level`);

  console.log(`\nLEVELS (season ${S.season}: ${LEVELS.length})`);
  console.log(`${lpad('#', 3)} ${pad('name', 22)}${pad('world', 9)}${pad('arena', 7)}${lpad('time', 5)}${lpad('objs', 5)}  ${pad('targets', 40)}${lpad('maxFit', 7)}${lpad('need', 6)}${lpad('filler', 7)}${lpad('x', 6)}`);
  for (const r of rows) {
    const L = r.L;
    console.log(`${lpad(L.id, 3)} ${pad(L.name, 22)}${pad(L.world, 9)}${pad(`${L.arena.w}x${L.arena.d}`, 7)}${lpad(L.time, 5)}${lpad(r.n, 5)}  ${pad(r.tdesc, 40)}${lpad(r.maxFit.toFixed(2), 7)}${lpad(r.need.toFixed(0), 6)}${lpad(r.mass, 7)}${lpad(r.ratio === Infinity ? '-' : r.ratio.toFixed(2), 6)}`);
  }
}
if (!PROPS_ONLY) for (const S of seasons) checkSeason(S);

if (warns.length) { console.log(`\nWARNINGS (${warns.length})`); for (const w of warns) console.log('  ' + w); }
if (fails.length) {
  console.log(`\nFAILED (${fails.length})`);
  for (const f of fails) console.log('  ' + f);
  process.exit(1);
}
console.log('\nALL CHECKS PASSED');
