// node docs/season7/tune.cjs --easy easy.json run1.json run2.json ... -> TUNING times/pars/relaxedPars
// B = the slowest CHALLENGE bot clear over all runs given (at least two).
const path = require('path'), args = process.argv.slice(2), load = (f) => require(path.resolve(f));
const ei = args.indexOf('--easy'), easy = ei >= 0 ? load(args.splice(ei, 2)[1]) : null, runs = args.map(load);
const c5 = (v) => Math.ceil(v / 5) * 5, times = {}, pars = {}, relaxedPars = {};
for (const r of runs[0]) {
  const B = Math.max(...runs.map((x) => x.find((y) => y.id === r.id).used));
  times[r.id] = Math.max(30, c5(1.32 * B + 6)); pars[r.id] = [c5(B + 3), c5(1.15 * B + 5)];
  if (easy) { const E = easy.find((x) => x.id === r.id).used; relaxedPars[r.id] = [c5(2.2 * E + 15), c5(3.4 * E + 25)]; }
}
const fmt = (o) => `{ ${Object.entries(o).map(([k, v]) => `${k}: ${JSON.stringify(v).replace(/,/g, ', ')}`).join(', ')} }`;
console.log(`  times: ${fmt(times)},\n  pars: ${fmt(pars)},\n  relaxedPars: ${fmt(relaxedPars)},`);
