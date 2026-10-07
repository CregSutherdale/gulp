// Measures Master Mode timers from two CHALLENGE validator runs and (optionally) writes them
// into src/game/master.js, then proves them with the Master validator.
//   node tools/measure_master.mjs                      measure every level, print the table
//   node tools/measure_master.mjs --ids 61,62,63       only these levels
//   node tools/measure_master.mjs --write              also write MASTER_TIMES (merged: other ids kept)
//   node tools/measure_master.mjs --verify-only [--ids ..]  skip measuring: verify (and raise) the table as it is
//   node tools/measure_master.mjs --write --verify     then run validate_cli --master on those ids and
//                                                      raise any failing level by --step s (default 3) until it passes
//                                                      (up to --rounds, default 6); raised ids are recorded
//                                                      in MASTER_RAISED with their formula value
//   node tools/measure_master.mjs --from a.json,b.json reuse two existing CHALLENGE validate_cli --json
//                                                      results instead of running the validator twice
// Master seconds (TIGHT, 10/06: Amanda found Master easy) = max(20, ceil(Bbest / 0.88), ceil(Bslow + 1)):
// the FASTER bot clear uses ~88% of the timer (85-90% band), never less time than the slower clear.
// Headless only (validate_cli never opens a window). Exit 0 = table written/printed (and, with
// --verify, every measured level passes Master).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const argv = process.argv.slice(2);
const arg = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const IDS = arg('--ids'), VERIFY_ONLY = argv.includes('--verify-only');
const WRITE = argv.includes('--write') || VERIFY_ONLY, VERIFY = argv.includes('--verify') || VERIFY_ONLY;
const ROUNDS = Number(arg('--rounds') || 8), STEP = Number(arg('--step') || 3), FROM = arg('--from');
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..');
const MASTER_JS = path.join(root, 'src/game/master.js');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gulp-measure-'));
const ceil5 = (x) => Math.ceil(x / 5 - 1e-9) * 5;
const masterFromBot = (Bbest, Bslow) => Math.max(20, Math.ceil(Bbest / 0.88 - 1e-9), Math.ceil(Bslow + 1));

function validate(extra, jsonFile) {
  return new Promise((resolve) => {
    const args = [path.join(root, 'tools/validate_cli.mjs'), '--json', jsonFile, '--timeout', arg('--timeout') || '3600', ...extra];
    const ch = spawn(process.execPath, args, { cwd: root, stdio: ['ignore', 'pipe', 'inherit'] });
    let out = '';
    ch.stdout.on('data', (d) => { out += d; });
    ch.on('close', (code) => {
      let res = null; try { res = JSON.parse(fs.readFileSync(jsonFile, 'utf8')); } catch (e) { res = null; }
      resolve({ code, out, res });
    });
  });
}

// Reads the current tables out of master.js (plain object literals of numbers).
function readTables() {
  const src = fs.readFileSync(MASTER_JS, 'utf8');
  const grab = (name) => { const m = src.match(new RegExp(`export const ${name} = (\\{[^}]*\\});`)); return m ? Function(`return ${m[1]}`)() : {}; };
  return { times: grab('MASTER_TIMES'), raised: grab('MASTER_RAISED') };
}
function writeTables(times, raised) {
  const src = fs.readFileSync(MASTER_JS, 'utf8');
  const lit = (o) => `{ ${Object.keys(o).map(Number).sort((a, b) => a - b).map((k) => `${k}: ${o[k]}`).join(', ')} }`.replace('{  }', '{}');
  const block = `// MASTER_TIMES:BEGIN (written by tools/measure_master.mjs --write)\nexport const MASTER_TIMES = ${lit(times)};\nexport const MASTER_RAISED = ${lit(raised)};\n// MASTER_TIMES:END`;
  const next = src.replace(/\/\/ MASTER_TIMES:BEGIN[\s\S]*?\/\/ MASTER_TIMES:END/, block);
  if (next === src && !src.includes(block)) throw new Error('MASTER_TIMES markers not found in master.js');
  fs.writeFileSync(MASTER_JS, next);
}


// Runs the Master validator on ids and raises each failing level by 5 s until it passes.
async function verify(ids, table, times, raised) {
  let todo = ids;
  for (let round = 1; round <= ROUNDS && todo.length; round++) {
    console.log(`\nverify round ${round}: validate_cli --master --ids ${todo.join(',')}`);
    const v = await validate(['--master', '--ids', todo.join(',')], path.join(tmp, `v${round}.json`));
    if (!v.res) { console.error('master validator produced no results'); process.exit(2); }
    const fails = v.res.filter((r) => !r.ok);
    for (const r of v.res) console.log(`  ${r.ok ? 'PASS' : 'FAIL'} L${r.id} ${r.won ? 'won' : 'LOST'} in ${r.used}s / ${r.time}s  frac ${r.frac}`);
    if (!fails.length) { todo = []; break; }
    for (const r of fails) {
      if (raised[r.id] === undefined) raised[r.id] = table[r.id] ?? times[r.id];
      times[r.id] = (times[r.id] ?? r.time) + STEP;
      console.log(`  raise L${r.id} -> ${times[r.id]}s`);
    }
    writeTables(times, raised);
    todo = fails.map((r) => r.id);
  }
  if (todo.length) { console.error(`STILL FAILING after ${ROUNDS} rounds: ${todo.join(',')}`); process.exit(1); }
  console.log(`\nRAISED: ${Object.keys(raised).length ? Object.entries(raised).map(([id, f]) => `L${id} ${f}->${times[id]}`).join(', ') : 'none'}`);
  console.log('every measured level passes Master');
}

if (VERIFY_ONLY) {
  const cur = readTables();
  const want = IDS ? IDS.split(',').map(Number) : Object.keys(cur.times).map(Number);
  await verify(want, {}, cur.times, cur.raised);
  process.exit(0);
}
const ids = IDS ? ['--ids', IDS] : [];
console.log(`measuring ${IDS || 'every level'}: two CHALLENGE validator runs, one after the other...`);
// One validator at a time (parallel runs pinned the CPU and skewed bot times).
const fromRun = (f) => { const res = JSON.parse(fs.readFileSync(f, 'utf8')); const want = IDS ? IDS.split(',').map(Number) : null; return { code: 0, res: want ? res.filter((x) => want.includes(x.id)) : res }; };
const a = FROM ? fromRun(FROM.split(',')[0]) : await validate(ids, path.join(tmp, 'a.json'));
const b = FROM ? fromRun(FROM.split(',')[1]) : await validate(ids, path.join(tmp, 'b.json'));
if (!a.res || !b.res) { console.error('a validator run produced no results', a.code, b.code); process.exit(2); }
const bById = new Map(b.res.map((r) => [r.id, r]));
const table = {}, rows = [];
for (const ra of a.res) {
  const rb = bById.get(ra.id); if (!rb) continue;
  const bothWon = ra.won && rb.won;
  // A run the bot did not win (a rare bot stall) says nothing about clear time: use the other run.
  const used = [ra, rb].filter((r) => r.won).map((r) => r.used);
  if (!used.length) used.push(Math.max(ra.used, rb.used));
  const B = Math.max(...used);
  table[ra.id] = masterFromBot(Math.min(...used), B);
  rows.push({ id: ra.id, name: ra.name, a: ra.used, b: rb.used, B, challenge: ra.time, master: table[ra.id], bothWon });
}
console.log('\n id  level                   botA   botB   B      CHALL  MASTER');
for (const r of rows) console.log(`${String(r.id).padStart(3)}  ${r.name.padEnd(22)} ${String(r.a).padStart(6)} ${String(r.b).padStart(6)} ${String(r.B).padStart(6)}  ${String(r.challenge).padStart(5)}  ${String(r.master).padStart(5)}  best frac ${(Math.min(r.a, r.b) / r.master).toFixed(2)}${r.bothWon ? '' : '   (bot did NOT win a CHALLENGE run: check this level)'}`);
console.log(`\nMASTER_TIMES (measured) = ${JSON.stringify(table)}`);

if (WRITE) {
  const cur = readTables();
  const times = { ...cur.times, ...table };
  const raised = { ...cur.raised };
  for (const id of Object.keys(table)) delete raised[id]; // re-measured: start from the formula again
  writeTables(times, raised);
  console.log(`wrote ${Object.keys(table).length} entries to src/game/master.js`);
  if (VERIFY) await verify(Object.keys(table).map(Number), table, times, raised);
}
try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) { /* ignore */ }
process.exit(0);
