// MASTER MODE (Kyle 2026-10-05: "You were a weak challenge for her. Give her tons more to do.")
// Every level gets a much harder second life once it has been cleared normally:
//   - a much tighter timer (MASTER_TIMES below),
//   - no helpers (Magnet / Freeze / Grow are hidden),
//   - no "+30 seconds" offer when time runs out,
//   - CHALLENGE growth always (never Easy-mode growth, even with Easy mode on).
// A win earns a crown for that level; the best Master time is kept separately.
import { TIMES, levelSetup } from './difficulty.js';

const ceil5 = (x) => Math.ceil(x / 5 - 1e-9) * 5;
// Master seconds from two measured CHALLENGE bot clears (TIGHT, 10/06: Amanda beat Master easily):
// the faster clear uses ~88% of the timer, and the timer is never shorter than the slower clear + 1 s.
export const masterFromBot = (Bbest, Bslow = Bbest) => Math.max(20, Math.ceil(Bbest / 0.88 - 1e-9), Math.ceil(Bslow + 1));
// Any level without a measured value (new seasons before they are measured): 80% of its CHALLENGE timer.
export const masterFallback = (level) => Math.max(25, ceil5(0.8 * (TIMES[level.id] ?? level.time)));

// Seconds per level, MASTER (tightened 10/06): masterFromBot(fastest, slowest) over 5 bot clears per
// level (2 CHALLENGE + 4 Master validator runs), +3 s over any Master timer the bot lost at, never
// above the old timer; L38/39/86/93 lost a confirmation run at the new value and keep their old one.
// Total Master time -12.5%; fastest bot clear uses a median 85% of the timer (was 72%). Levels in MASTER_RAISED needed more time for the careful
// bot to win inside the Master timer (validate_cli --master) and were raised by hand.
// MASTER_RAISED = { id: the formula value before raising }.
// MASTER_TIMES:BEGIN (written by tools/measure_master.mjs --write)
export const MASTER_TIMES = { 1: 23, 2: 21, 3: 20, 4: 23, 5: 58, 6: 22, 7: 33, 8: 36, 9: 42, 10: 53, 11: 40, 12: 62, 13: 32, 14: 46, 15: 57, 16: 30, 17: 50, 18: 49, 19: 57, 20: 45, 21: 52, 22: 43, 23: 36, 24: 37, 25: 50, 26: 41, 27: 39, 28: 41, 29: 37, 30: 59, 31: 45, 32: 78, 33: 27, 34: 60, 35: 56, 36: 49, 37: 43, 38: 50, 39: 70, 40: 65, 41: 28, 42: 52, 43: 52, 44: 31, 45: 72, 46: 47, 47: 52, 48: 54, 49: 54, 50: 68, 51: 45, 52: 76, 53: 64, 54: 54, 55: 80, 56: 37, 57: 44, 58: 51, 59: 42, 60: 79, 61: 54, 62: 51, 63: 53, 64: 47, 65: 85, 66: 52, 67: 75, 68: 64, 69: 49, 70: 80, 71: 60, 72: 70, 73: 54, 74: 53, 75: 90, 76: 59, 77: 46, 78: 56, 79: 72, 80: 66, 81: 54, 82: 69, 83: 44, 84: 58, 85: 69, 86: 55, 87: 52, 88: 54, 89: 61, 90: 68, 91: 30, 92: 59, 93: 65, 94: 59, 95: 59, 96: 37, 97: 48, 98: 82, 99: 64, 100: 64, 101: 42, 102: 62, 103: 48, 104: 56, 105: 60, 106: 42, 107: 53, 108: 65, 109: 46, 110: 55, 111: 49, 112: 46, 113: 67, 114: 71, 115: 67, 116: 61, 117: 58, 118: 68, 119: 57, 120: 71 };
export const MASTER_RAISED = {};
// MASTER_TIMES:END

export function masterTime(level) {
  return MASTER_TIMES[level.id] ?? masterFallback(level);
}
// Round options for a Master run: CHALLENGE growth, the Master timer.
export function masterSetup(level) {
  const s = levelSetup(level, false);
  return { ...s, timeScale: masterTime(level) / level.time };
}
