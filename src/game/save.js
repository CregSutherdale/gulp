const KEY = 'gulp.save.v1';
// contentV 3 = the 30 cozy levels. Saves from the starter-level build had stars on
// placeholder levels that reused ids 1-3. Real stars on the new levels always come
// with a best time (save.best), placeholder stars never do, so the migration keeps
// exactly the stars that have a best time. (v2 was a build whose migration check
// was masked by defaults; it may hold placeholder stars too, so it migrates again.)
const CONTENT_V = 3;
const DEFAULT = {
  stars: {}, best: {}, eaten: {}, skin: 'blossom', sfx: true, music: true, autoSteer: true, relaxed: false,
  zenBest: 0, raceWins: 0, name: 'Amanda', seenHelp: false, seenHelpers: false, contentV: CONTENT_V,
};

export function loadSave() {
  let raw = null;
  try { raw = JSON.parse(localStorage.getItem(KEY)); } catch (e) { raw = null; }
  if (!raw) return { ...DEFAULT };
  const s = { ...DEFAULT, ...raw };
  // Check the STORED version (the defaults above would mask a missing one).
  if (raw.contentV !== CONTENT_V) {
    const best = raw.best || {};
    s.stars = Object.fromEntries(Object.entries(raw.stars || {}).filter(([id]) => best[id] !== undefined));
    s.best = { ...best };
    s.contentV = CONTENT_V;
    writeSave(s);
  }
  return s;
}
export function writeSave(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* private mode: progress lives for this session only */ }
}
export const totalStars = (s) => Object.values(s.stars).reduce((a, b) => a + b, 0);
