// MASTER MODE (Kyle 2026-10-05: "You were a weak challenge for her. Give her tons more to do.")
// Every level gets a much harder second life once it has been cleared normally:
//   - a much tighter timer (MASTER_TIMES below),
//   - no helpers (Magnet / Freeze / Grow are hidden),
//   - no "+30 seconds" offer when time runs out,
//   - CHALLENGE growth always (never Easy-mode growth, even with Easy mode on).
// A win earns a crown for that level; the best Master time is kept separately.
import { TIMES, levelSetup } from './difficulty.js';

const ceil5 = (x) => Math.ceil(x / 5 - 1e-9) * 5;
// Master seconds from a measured bot clear time B (the slower of two CHALLENGE validator runs).
export const masterFromBot = (B) => Math.max(25, ceil5(1.12 * B + 4));
// Any level without a measured value (new seasons before they are measured): 80% of its CHALLENGE timer.
export const masterFallback = (level) => Math.max(25, ceil5(0.8 * (TIMES[level.id] ?? level.time)));

// Seconds per level, MASTER: ceil5(1.12 * B + 4), min 25. B = the slower of two CHALLENGE bot
// clears (tools/measure_master.mjs). Levels in MASTER_RAISED needed more time for the careful
// bot to win inside the Master timer (validate_cli --master) and were raised by hand.
// MASTER_RAISED = { id: the formula value before raising }.
// MASTER_TIMES:BEGIN (written by tools/measure_master.mjs --write)
export const MASTER_TIMES = { 1: 30, 2: 30, 3: 25, 4: 30, 5: 65, 6: 30, 7: 40, 8: 45, 9: 50, 10: 65, 11: 40, 12: 75, 13: 40, 14: 55, 15: 65, 16: 35, 17: 50, 18: 65, 19: 60, 20: 55, 21: 60, 22: 50, 23: 40, 24: 45, 25: 60, 26: 45, 27: 45, 28: 50, 29: 45, 30: 65, 31: 55, 32: 80, 33: 35, 34: 65, 35: 60, 36: 50, 37: 55, 38: 50, 39: 70, 40: 70, 41: 35, 42: 65, 43: 60, 44: 40, 45: 80, 46: 50, 47: 60, 48: 65, 49: 65, 50: 75, 51: 55, 52: 85, 53: 70, 54: 60, 55: 85, 56: 45, 57: 55, 58: 65, 59: 50, 60: 90, 61: 70, 62: 60, 63: 65, 64: 50, 65: 90, 66: 65, 67: 85, 68: 65, 69: 60, 70: 90, 71: 75, 72: 85, 73: 60, 74: 70, 75: 100, 76: 70, 77: 55, 78: 60, 79: 80, 80: 75, 81: 55, 82: 75, 83: 50, 84: 65, 85: 75, 86: 55, 87: 60, 88: 60, 89: 65, 90: 70 };
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
