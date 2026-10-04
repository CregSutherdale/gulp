// Content checker for Gulp's cozy props + 30 levels.
//   node tools/check_levels.mjs           props + levels
//   node tools/check_levels.mjs --props   props only
// Bundles the real game modules with esbuild (the repo is "type": "commonjs", so the
// ESM sources can't be imported directly) and places every level with the ENGINE's own
// buildLevel(), so what is checked is exactly what the game spawns.
// Exits non-zero on any failure.
import { build } from 'esbuild';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROPS_ONLY = process.argv.includes('--props');
const CLEAR = 0.1;            // min gap between colliders
const EDGE = 1.0;             // min distance from arena edge
const START_CLEAR = 1.0;      // min gap between the start hole (r 0.5) and any object
const R0 = 0.5, GROW = 0.0436, FIT = 0.9;
const MARGIN = 1.4;           // filler value must reach the largest target with 40% to spare

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

// ------------------------------------------------------------------ props
const city = await load(`export { PROPS } from './src/game/props.js';`, 'city');
const cityIds = new Set(Object.keys(city.PROPS));
const M = await load(`
  export { PROPS, buildGeometry, colliderHalfHeight } from './src/game/props.js';
  export { COZY_WORLDS } from './src/game/props_cozy.js';
  ${PROPS_ONLY ? '' : `export { LEVELS } from './src/game/levels.js';
  export { buildLevel } from './src/game/levelbuild.js';`}
`, 'all');
const { PROPS, buildGeometry, colliderHalfHeight } = M;

const src = fs.readFileSync(path.join(ROOT, 'src/game/props_cozy.js'), 'utf8');
const cozyIds = [...src.matchAll(/def\('([a-z0-9_]+)'/g)].map((m) => m[1]);
const seen = new Set();
for (const id of cozyIds) {
  if (cityIds.has(id)) fail(`prop ${id}`, 'id collides with a city prop (would overwrite it)');
  if (seen.has(id)) fail(`prop ${id}`, 'defined twice');
  seen.add(id);
}

const fitOf = (c) => (c.t === 'box' ? Math.hypot(c.w, c.d) : 2 * c.r);
const propRows = [];
for (const id of cozyIds) {
  const p = PROPS[id], c = p.col, where = `prop ${id}`;
  if (!p.label) fail(where, 'missing label');
  if (!p.tints || p.tints.length < 2) fail(where, 'needs >= 2 tints');
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
  const notes = [];
  if (Math.abs(minY + hh) > 0.025) notes.push(`base ${(minY + hh).toFixed(3)} off the ground`);
  const topTol = Math.max(0.06, 0.12 * 2 * hh);
  if (maxY > hh + 0.06 || maxY < hh - topTol) notes.push(`top ${(maxY + hh).toFixed(2)} vs collider h ${(2 * hh).toFixed(2)}`);
  if (c.t === 'box') {
    if (maxX > c.w / 2 + 0.04 || maxX < c.w / 2 - Math.max(0.05, 0.1 * c.w)) notes.push(`width ${(2 * maxX).toFixed(2)} vs w ${c.w}`);
    if (maxZ > c.d / 2 + 0.04 || maxZ < c.d / 2 - Math.max(0.05, 0.1 * c.d)) notes.push(`depth ${(2 * maxZ).toFixed(2)} vs d ${c.d}`);
  } else if (maxR > c.r + 0.04 || maxR < c.r - Math.max(0.05, 0.12 * c.r)) notes.push(`radius ${maxR.toFixed(2)} vs r ${c.r}`);
  for (const n of notes) fail(where, `collider does not hug the mesh: ${n}`);
  propRows.push({ id, fit: p.fit, value: p.value, tris, ok: notes.length === 0, dims: `${(2 * maxX).toFixed(2)}x${(maxY - minY).toFixed(2)}x${(2 * maxZ).toFixed(2)}` });
}

console.log(`\nPROPS (${cozyIds.length} cozy props)`);
console.log(`${pad('id', 16)}${lpad('fit', 6)}${lpad('value', 7)}${lpad('tris', 7)}  mesh w x h x d`);
for (const r of propRows) console.log(`${pad(r.id, 16)}${lpad(r.fit.toFixed(2), 6)}${lpad(r.value, 7)}${lpad(r.tris, 7)}  ${r.dims}${r.ok ? '' : '  <-- mismatch'}`);

// ------------------------------------------------------------------ levels
if (!PROPS_ONLY) {
  const { LEVELS, buildLevel } = M;
  const WORLD_ORDER = ['bakery', 'picnic', 'playroom', 'garden', 'beach', 'kitchen'];
  if (LEVELS.length !== 30) fail('levels', `expected 30 levels, got ${LEVELS.length}`);
  const opCount = (op) => ({ grid: (op.cols || 0) * (op.rows || 0), ring: op.n, line: op.n, pile: op.n, at: 1 }[op.op] ?? -1);
  const needFor = (f) => Math.max(0, ((f * f) / (4 * FIT * FIT) - R0 * R0) / GROW);

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

  const rows = [];
  LEVELS.forEach((L, li) => {
    const where = `L${L.id} ${L.name}`;
    if (L.id !== li + 1) fail(where, `id should be ${li + 1}`);
    if (L.world !== WORLD_ORDER[Math.floor(li / 5)]) fail(where, `world ${L.world}, expected ${WORLD_ORDER[Math.floor(li / 5)]}`);
    for (const op of L.place) if (!PROPS[op.id]) fail(where, `unknown prop id ${op.id}`);
    for (const t of L.targets) {
      if (!PROPS[t.id]) fail(where, `unknown target id ${t.id}`);
      else if (t.tint !== undefined && (t.tint < 0 || t.tint >= (PROPS[t.id].tints || [0]).length)) fail(where, `target ${t.id} tint ${t.tint} out of range`);
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
        if (g < CLEAR) { overlaps++; if (overlaps <= 3) fail(where, `${o.id}#${i} and ${objs[j].id}#${j} are ${g.toFixed(3)} apart (< ${CLEAR})`); }
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
    const fill = objs.filter((o) => !isT(o)).sort((a, b) => a.prop.fit - b.prop.fit);
    let mass = 0, r = R0, idx = 0;
    while (idx < fill.length && fill[idx].prop.fit <= FIT * 2 * r) { mass += fill[idx].prop.value; r = Math.sqrt(R0 * R0 + GROW * mass); idx++; }
    const need = needFor(maxFit);
    const ratio = need > 0 ? mass / need : Infinity;
    if (ratio < MARGIN) fail(where, `filler reaches value ${mass}, largest target (fit ${maxFit}) needs ${need.toFixed(0)} x ${MARGIN}`);
    // whole-level greedy: everything should be edible eventually (soft)
    const all = [...objs].sort((a, b) => a.prop.fit - b.prop.fit);
    let m2 = 0, r2 = R0, j2 = 0;
    while (j2 < all.length && all[j2].prop.fit <= FIT * 2 * r2) { m2 += all[j2].prop.value; r2 = Math.sqrt(R0 * R0 + GROW * m2); j2++; }
    if (j2 < all.length) warns.push(`${where}: ${all.length - j2} objects never become edible (largest ${all[all.length - 1].id})`);
    // starter ladder near the start
    const near = objs.filter((o) => o.prop.fit <= FIT * 2 * R0 && Math.hypot(o.x - sx, o.z - sz) < 6).length;
    if (near < 6) fail(where, `only ${near} starter-size objects within 6 of the start`);
    // timer: roughly 1 s per object you must eat plus 25 s to roam (soft)
    let needMass = 0, eatN = 0;
    for (const o of fill) { if (needMass >= need) break; needMass += o.prop.value; eatN++; }
    const est = eatN + tcount;
    if (L.time < est * 0.9 + 25) warns.push(`${where}: time ${L.time}s may be tight for ~${est} required eats`);
    rows.push({ L, n: objs.length, tdesc: tdesc.join(', '), maxFit, need, mass, ratio, est });
  });

  console.log(`\nLEVELS (${LEVELS.length})`);
  console.log(`${lpad('#', 3)} ${pad('name', 22)}${pad('world', 9)}${pad('arena', 7)}${lpad('time', 5)}${lpad('objs', 5)}  ${pad('targets', 40)}${lpad('maxFit', 7)}${lpad('need', 6)}${lpad('filler', 7)}${lpad('x', 6)}`);
  for (const r of rows) {
    const L = r.L;
    console.log(`${lpad(L.id, 3)} ${pad(L.name, 22)}${pad(L.world, 9)}${pad(`${L.arena.w}x${L.arena.d}`, 7)}${lpad(L.time, 5)}${lpad(r.n, 5)}  ${pad(r.tdesc, 40)}${lpad(r.maxFit.toFixed(2), 7)}${lpad(r.need.toFixed(0), 6)}${lpad(r.mass, 7)}${lpad(r.ratio === Infinity ? '-' : r.ratio.toFixed(2), 6)}`);
  }
}

if (warns.length) { console.log(`\nWARNINGS (${warns.length})`); for (const w of warns) console.log('  ' + w); }
if (fails.length) {
  console.log(`\nFAILED (${fails.length})`);
  for (const f of fails) console.log('  ' + f);
  process.exit(1);
}
console.log('\nALL CHECKS PASSED');
