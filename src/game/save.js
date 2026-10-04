const KEY = 'gulp.save.v1';
// contentV 2 = the 30 cozy levels. Saves from the starter-level build (contentV
// missing) had stars on placeholder levels that reused ids 1-3, so those reset.
const CONTENT_V = 2;
const DEFAULT = {
  stars: {}, best: {}, eaten: {}, skin: 'blossom', sfx: true, music: true, autoSteer: true, relaxed: false,
  zenBest: 0, raceWins: 0, name: 'Amanda', seenHelp: false, seenHelpers: false, contentV: CONTENT_V,
};

export function loadSave() {
  let s;
  try { s = { ...DEFAULT, ...(JSON.parse(localStorage.getItem(KEY)) || {}) }; } catch (e) { s = { ...DEFAULT }; }
  if (s.contentV !== CONTENT_V) { s.stars = {}; s.best = {}; s.contentV = CONTENT_V; writeSave(s); }
  return s;
}
export function writeSave(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* private mode: progress lives for this session only */ }
}
export const totalStars = (s) => Object.values(s.stars).reduce((a, b) => a + b, 0);
