// Checks the save migration with a fake localStorage: node tools/save_test.mjs
const store = {};
globalThis.localStorage = { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = v; }, removeItem: (k) => { delete store[k]; } };
const { loadSave, exportProgress, importProgress, resetLevels, restoreLevels, hasLevelBackup, totalCrowns } = await import('../src/game/save.js');
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

// 6) Master Mode (2026-10-05): a save from before crowns keeps everything and gets empty crown tables
store['gulp.save.v1'] = JSON.stringify({ stars: { 1: 3, 2: 2 }, best: { 1: 20, 2: 33 }, eaten: { donut: 9 }, skin: 'mint', relaxed: true, contentV: 3 });
s = loadSave();
check('pre-Master save keeps stars/best/book/settings', s.stars[1] === 3 && s.stars[2] === 2 && s.best[2] === 33 && s.eaten.donut === 9 && s.skin === 'mint' && s.relaxed === true, s.stars);
check('pre-Master save gets empty crowns + masterBest', JSON.stringify(s.crowns) === '{}' && JSON.stringify(s.masterBest) === '{}' && totalCrowns(s) === 0, { crowns: s.crowns, masterBest: s.masterBest });
// 7) crowns round-trip through writeSave/loadSave
store['gulp.save.v1'] = JSON.stringify({ stars: { 1: 3 }, best: { 1: 20 }, crowns: { 1: 1, 7: 1 }, masterBest: { 1: 18.5, 7: 40 }, contentV: 3 });
s = loadSave();
check('crowns + masterBest load', totalCrowns(s) === 2 && s.masterBest[7] === 40, { crowns: s.crowns, masterBest: s.masterBest });
// 8) Start over clears crowns + Master best times; Bring back restores them (merging anything earned since)
resetLevels(s);
check('Start over clears crowns + masterBest', totalCrowns(s) === 0 && JSON.stringify(s.masterBest) === '{}' && JSON.stringify(s.stars) === '{}' && hasLevelBackup(), { crowns: s.crowns });
s.crowns[3] = 1; s.masterBest[3] = 30; s.masterBest[1] = 17;
const ok8 = restoreLevels(s);
check('Bring back restores crowns + masterBest (merge, fastest kept)', ok8 && s.crowns[1] && s.crowns[7] && s.crowns[3] && s.masterBest[1] === 17 && s.masterBest[7] === 40 && s.masterBest[3] === 30 && s.stars[1] === 3, { crowns: s.crowns, masterBest: s.masterBest });
// 9) progress codes carry crowns; an old code without them still imports
const c1 = { stars: { 2: 1 }, best: {}, crowns: { 2: 1 }, masterBest: { 2: 50 }, eaten: {} };
const c2 = { stars: {}, best: {}, crowns: { 4: 1 }, masterBest: { 2: 60, 4: 33 }, eaten: {} };
importProgress(c2, exportProgress(c1));
check('transfer merges crowns + masterBest', c2.crowns[2] && c2.crowns[4] && c2.masterBest[2] === 50 && c2.masterBest[4] === 33, { crowns: c2.crowns, masterBest: c2.masterBest });
const old = 'GULP-' + Buffer.from(JSON.stringify({ g: 1, stars: { 9: 2 }, best: { 9: 50 } })).toString('base64');
const c3 = { stars: {}, best: {}, crowns: { 1: 1 }, masterBest: { 1: 20 }, eaten: {} };
importProgress(c3, old);
check('old progress code (no crowns) imports, crowns kept', c3.stars[9] === 2 && c3.crowns[1] === 1 && c3.masterBest[1] === 20, c3);
process.exit(fail ? 1 : 0);
