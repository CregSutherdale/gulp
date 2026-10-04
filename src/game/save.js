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
// "Start over" (Kyle 2026-10-04: she blasted through 43 levels before the game got harder).
// Clears level stars + best times so every level is fresh and unlocks in order again.
// Keeps the Gulp Book, hole colors, Zen/race records and settings. The old stars are kept
// in a backup so "Bring back my old stars" can undo it.
const BACKUP_KEY = 'gulp.save.backup';
export function resetLevels(s) {
  try { localStorage.setItem(BACKUP_KEY, JSON.stringify({ stars: s.stars, best: s.best })); } catch (e) { /* private mode */ }
  s.stars = {}; s.best = {};
}
export function hasLevelBackup() {
  try { return !!localStorage.getItem(BACKUP_KEY); } catch (e) { return false; }
}
export function restoreLevels(s) {
  let b = null;
  try { b = JSON.parse(localStorage.getItem(BACKUP_KEY)); } catch (e) { b = null; }
  if (!b) return false;
  // merge, so anything earned since the reset is kept too
  for (const [id, n] of Object.entries(b.stars || {})) s.stars[id] = Math.max(s.stars[id] || 0, n | 0);
  for (const [id, t] of Object.entries(b.best || {})) if (typeof t === 'number') s.best[id] = s.best[id] === undefined ? t : Math.min(s.best[id], t);
  try { localStorage.removeItem(BACKUP_KEY); } catch (e) { /* ignore */ }
  return true;
}
export const totalStars = (s) => Object.values(s.stars).reduce((a, b) => a + b, 0);

// Progress transfer between Safari and the Home Screen app (iOS keeps them apart),
// or to a new phone. The code is plain base64 JSON of the progress fields.
const PROGRESS_KEYS = ['stars', 'best', 'eaten', 'skin', 'raceWins', 'zenBest', 'seenHelp', 'seenHelpers'];
export function exportProgress(s) {
  const o = { g: 1 };
  for (const k of PROGRESS_KEYS) o[k] = s[k];
  return 'GULP-' + btoa(unescape(encodeURIComponent(JSON.stringify(o))));
}
// Merge never loses anything: best stars, fastest times, biggest counts.
export function importProgress(s, code) {
  const txt = String(code || '').trim().replace(/^GULP-/, '');
  const o = JSON.parse(decodeURIComponent(escape(atob(txt))));
  if (!o || o.g !== 1 || typeof o.stars !== 'object') throw new Error('not a Gulp progress code');
  for (const [id, n] of Object.entries(o.stars || {})) s.stars[id] = Math.max(s.stars[id] || 0, n | 0);
  s.best = s.best || {};
  for (const [id, t] of Object.entries(o.best || {})) if (typeof t === 'number') s.best[id] = s.best[id] === undefined ? t : Math.min(s.best[id], t);
  s.eaten = s.eaten || {};
  for (const [id, n] of Object.entries(o.eaten || {})) s.eaten[id] = Math.max(s.eaten[id] || 0, n | 0);
  if (o.skin) s.skin = o.skin;
  s.raceWins = Math.max(s.raceWins || 0, o.raceWins | 0);
  s.zenBest = Math.max(s.zenBest || 0, o.zenBest | 0);
  s.seenHelp = s.seenHelp || !!o.seenHelp; s.seenHelpers = s.seenHelpers || !!o.seenHelpers;
  return s;
}
