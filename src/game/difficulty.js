// Level difficulty (Amanda 2026-10-04: "not even a challenge", "the 3.5 min time is waaaay
// too much", she was on level 43 of 45). Default = CHALLENGE: the hole grows slower, so more
// of the board must be eaten before the big pieces fit, and every timer is cut to about twice
// a measured good run (TIMES, filled from the validator's bot clear times at CHALLENGE growth).
// Settings > "Relaxed timers" restores the original easy feel: normal growth, long timers.
// Round 2 (Amanda 10/04 "more difficult still"): growth 0.6x on most boards. Boards whose
// biggest target needs most of the filler keep enough growth to stay winnable with 30% food to
// spare: g = max(0.6, 1.3 * need / filler) from tools/check_levels.mjs.
export const CHALLENGE_GROW = 0.6;
export const GROW_BY_LEVEL = { 5: 0.62, 10: 0.69, 15: 0.72, 20: 0.78, 35: 0.81, 40: 0.83, 45: 0.83, 49: 0.64, 50: 0.64, 54: 0.65, 55: 0.69, 59: 0.64, 60: 0.69 };
// Seconds per level, CHALLENGE (round 2): ceil5(1.45 * bot clear + 8), min 30, bot clear = slower of two runs (bot clears measured at
// CHALLENGE growth by validate.html, 2026-10-04).
export const TIMES = { 1: 40, 2: 40, 3: 30, 4: 50, 5: 85, 6: 40, 7: 55, 8: 55, 9: 65, 10: 85, 11: 55, 12: 115, 13: 55, 14: 80, 15: 90, 16: 50, 17: 75, 18: 90, 19: 85, 20: 75, 21: 80, 22: 65, 23: 55, 24: 60, 25: 75, 26: 65, 27: 65, 28: 70, 29: 60, 30: 85, 31: 65, 32: 110, 33: 45, 34: 95, 35: 85, 36: 75, 37: 65, 38: 65, 39: 80, 40: 90, 41: 45, 42: 70, 43: 80, 44: 50, 45: 105, 46: 65, 47: 70, 48: 85, 49: 85, 50: 100, 51: 75, 52: 110, 53: 100, 54: 80, 55: 110, 56: 60, 57: 70, 58: 75, 59: 65, 60: 115 };
// Star pars [3-star under, 2-star under], CHALLENGE (round 2): ceil5(1.1t + 3) / ceil5(1.25t + 5).
export const CHALLENGE_PARS = { 1: [30,35], 2: [25,30], 3: [15,20], 4: [35,40], 5: [65,75], 6: [25,30], 7: [40,45], 8: [40,45], 9: [45,55], 10: [60,70], 11: [40,45], 12: [85,95], 13: [40,45], 14: [50,60], 15: [65,75], 16: [35,40], 17: [55,65], 18: [65,75], 19: [60,70], 20: [55,60], 21: [60,70], 22: [45,55], 23: [40,50], 24: [40,50], 25: [55,65], 26: [45,55], 27: [45,55], 28: [50,60], 29: [40,50], 30: [65,75], 31: [50,55], 32: [80,90], 33: [30,35], 34: [70,80], 35: [60,70], 36: [55,60], 37: [45,55], 38: [45,55], 39: [60,65], 40: [65,80], 41: [35,40], 42: [50,55], 43: [60,70], 44: [35,40], 45: [75,90], 46: [50,55], 47: [50,55], 48: [60,70], 49: [60,70], 50: [75,85], 51: [50,55], 52: [80,95], 53: [70,85], 54: [60,70], 55: [80,95], 56: [40,50], 57: [50,60], 58: [55,65], 59: [45,55], 60: [85,100] };

export function levelSetup(level, relaxed) {
  if (relaxed) return { growMul: 1, timeScale: 1.6 };
  const t = TIMES[level.id];
  return { growMul: GROW_BY_LEVEL[level.id] ?? CHALLENGE_GROW, timeScale: t ? t / level.time : 1 };
}
