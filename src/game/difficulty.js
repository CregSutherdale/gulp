// Level difficulty (Amanda 2026-10-04: "not even a challenge", "the 3.5 min time is waaaay
// too much", she was on level 43 of 45). Default = CHALLENGE: the hole grows slower, so more
// of the board must be eaten before the big pieces fit, and every timer is cut to about twice
// a measured good run (TIMES, filled from the validator's bot clear times at CHALLENGE growth).
// Settings > "Relaxed timers" restores the original easy feel: normal growth, long timers.
export const CHALLENGE_GROW = 0.75;
// Seconds per level, CHALLENGE: ceil5(1.7 * bot clear + 10), min 35 (bot clears measured at
// CHALLENGE growth by validate.html, 2026-10-04).
export const TIMES = { 1: 45, 2: 45, 3: 35, 4: 45, 5: 85, 6: 55, 7: 60, 8: 65, 9: 70, 10: 85, 11: 70, 12: 110, 13: 60, 14: 75, 15: 95, 16: 55, 17: 80, 18: 70, 19: 85, 20: 85, 21: 90, 22: 75, 23: 60, 24: 60, 25: 75, 26: 65, 27: 65, 28: 65, 29: 65, 30: 80, 31: 60, 32: 115, 33: 50, 34: 75, 35: 105, 36: 80, 37: 70, 38: 70, 39: 85, 40: 110, 41: 55, 42: 75, 43: 80, 44: 60, 45: 130,
  // Season 3 (2026-10-04): the slower of two full validator runs at CHALLENGE growth.
  46: 75, 47: 85, 48: 90, 49: 85, 50: 115, 51: 70, 52: 115, 53: 105, 54: 90, 55: 135, 56: 65, 57: 85, 58: 90, 59: 75, 60: 130 };
// Star pars [3-star under, 2-star under], CHALLENGE: ceil5(1.3t + 5) / ceil5(1.55t + 8).
export const CHALLENGE_PARS = { 1: [30,40], 2: [30,40], 3: [20,25], 4: [35,40], 5: [65,80], 6: [40,50], 7: [45,55], 8: [45,55], 9: [50,60], 10: [65,80], 11: [45,55], 12: [85,100], 13: [40,50], 14: [55,70], 15: [70,85], 16: [40,50], 17: [55,65], 18: [50,65], 19: [65,80], 20: [65,75], 21: [70,80], 22: [55,65], 23: [40,50], 24: [45,55], 25: [55,70], 26: [45,55], 27: [50,60], 28: [50,60], 29: [50,60], 30: [60,75], 31: [45,55], 32: [85,105], 33: [35,45], 34: [55,65], 35: [80,95], 36: [55,70], 37: [55,65], 38: [50,65], 39: [65,75], 40: [85,100], 41: [40,50], 42: [55,70], 43: [60,75], 44: [40,50], 45: [95,115],
  46: [55,70], 47: [65,75], 48: [65,80], 49: [65,75], 50: [85,100], 51: [50,65], 52: [85,105], 53: [75,95], 54: [65,80], 55: [105,125], 56: [50,60], 57: [60,75], 58: [65,80], 59: [55,65], 60: [95,115] };

export function levelSetup(level, relaxed) {
  if (relaxed) return { growMul: 1, timeScale: 1.6 };
  const t = TIMES[level.id];
  return { growMul: CHALLENGE_GROW, timeScale: t ? t / level.time : 1 };
}
