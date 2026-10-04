// Checks the save migration with a fake localStorage: node tools/save_test.mjs
const store = {};
globalThis.localStorage = { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = v; } };
const { loadSave, exportProgress, importProgress } = await import('../src/game/save.js');
let fail = 0;
const check = (name, ok, got) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${JSON.stringify(got)}`); if (!ok) fail++; };

// 1) save from the starter-level build: placeholder stars reset, everything else kept
store['gulp.save.v1'] = JSON.stringify({ stars: { 1: 3, 2: 2 }, skin: 'mint', seenHelp: true });
let s = loadSave();
check('old save: stars reset, skin + help kept', Object.keys(s.stars).length === 0 && s.skin === 'mint' && s.seenHelp === true && s.contentV === 3, { stars: s.stars, skin: s.skin });
check('old save: migration persisted', JSON.parse(store['gulp.save.v1']).contentV === 3, JSON.parse(store['gulp.save.v1']).contentV);
// 2) a save from the masked-migration build (v2): placeholder stars 1-3 + a real win
//    on level 2 (has a best time) and level 5 -> keep only 2 and 5
store['gulp.save.v1'] = JSON.stringify({ stars: { 1: 3, 2: 2, 3: 1, 5: 2 }, best: { 2: 40.1, 5: 88 }, contentV: 2 });
s = loadSave();
check('v2 save keeps only real stars', !s.stars[1] && s.stars[2] === 2 && !s.stars[3] && s.stars[5] === 2 && s.best[5] === 88, s.stars);
// 2b) a current save is left alone
store['gulp.save.v1'] = JSON.stringify({ stars: { 1: 3, 4: 1 }, best: { 1: 20 }, contentV: 3 });
s = loadSave();
check('v3 save untouched', s.stars[1] === 3 && s.stars[4] === 1, s.stars);
// 3) fresh install
delete store['gulp.save.v1'];
s = loadSave();
check('fresh save', Object.keys(s.stars).length === 0 && s.contentV === 3 && s.name === 'Amanda', { stars: s.stars, name: s.name });
// 4) corrupt data never crashes
store['gulp.save.v1'] = '{not json';
s = loadSave();
check('corrupt save falls back to defaults', s.contentV === 3, s.contentV);
// 5) progress transfer: export from one save, merge into another without losing anything
const a = { stars: { 1: 3, 2: 1 }, best: { 1: 30, 2: 90 }, eaten: { donut: 40, cake: 2 }, skin: 'mint', raceWins: 2, zenBest: 0 };
const b = { stars: { 2: 3, 4: 2 }, best: { 2: 60, 4: 70 }, eaten: { donut: 10, apple: 5 }, skin: 'blossom', raceWins: 0, zenBest: 100 };
const code = exportProgress(a);
importProgress(b, code);
check('transfer merges stars (max)', b.stars[1] === 3 && b.stars[2] === 3 && b.stars[4] === 2, b.stars);
check('transfer merges best times (min)', b.best[1] === 30 && b.best[2] === 60 && b.best[4] === 70, b.best);
check('transfer merges book counts (max)', b.eaten.donut === 40 && b.eaten.cake === 2 && b.eaten.apple === 5, b.eaten);
check('transfer keeps skin + wins', b.skin === 'mint' && b.raceWins === 2 && b.zenBest === 100, { skin: b.skin, raceWins: b.raceWins });
let threw = false; try { importProgress(b, 'GULP-not-a-real-code'); } catch (e) { threw = true; }
check('bad code is rejected, save untouched', threw && b.stars[1] === 3, threw);
process.exit(fail ? 1 : 0);
