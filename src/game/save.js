const KEY = 'gulp.save.v1';
const DEFAULT = { stars: {}, skin: 'blossom', sfx: true, music: true, autoSteer: true, zenBest: 0, raceWins: 0, name: 'Amanda', seenHelp: false };

export function loadSave() {
  try { return { ...DEFAULT, ...(JSON.parse(localStorage.getItem(KEY)) || {}) }; } catch (e) { return { ...DEFAULT }; }
}
export function writeSave(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* private mode: progress lives for this session only */ }
}
export const totalStars = (s) => Object.values(s.stars).reduce((a, b) => a + b, 0);
