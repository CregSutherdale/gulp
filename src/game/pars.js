// Star par times per level id: [3-star under, 2-star under] in seconds. Measured
// from the validator's bot clear time t (2026-10-04 run): 3★ = 2.2t + 15, 2★ =
// 3.4t + 25 (capped 10 s under the level's timer), rounded up to 5 s. The fail
// timer stays generous; pars are what make stars mean something.
export const PARS = {
  1: [50, 65], 2: [55, 70], 3: [40, 60], 4: [55, 90], 5: [90, 135], 6: [65, 100], 7: [75, 115], 8: [65, 100], 9: [85, 130], 10: [110, 170],
  11: [75, 115], 12: [120, 140], 13: [75, 115], 14: [110, 170], 15: [100, 155], 16: [70, 105], 17: [95, 145], 18: [95, 150], 19: [100, 155], 20: [95, 150],
  21: [95, 150], 22: [90, 140], 23: [85, 130], 24: [65, 105], 25: [85, 130], 26: [90, 140], 27: [90, 140], 28: [85, 130], 29: [80, 125], 30: [95, 150],
  // Season 2: same formula, t = the slower of two full validator runs (2026-10-04).
  31: [90, 140], 32: [135, 160], 33: [65, 105], 34: [110, 170], 35: [140, 215], 36: [105, 150], 37: [85, 130], 38: [105, 165], 39: [125, 190], 40: [115, 180],
  41: [70, 105], 42: [95, 145], 43: [125, 190], 44: [100, 155], 45: [130, 200],
};

// Starter levels (fallback content) and any level without a measured par.
export function parFor(level) {
  return PARS[level.id] || [Math.round(level.time * 0.45), Math.round(level.time * 0.75)];
}
export function starsFor(level, seconds) {
  const [p3, p2] = parFor(level);
  return seconds <= p3 ? 3 : seconds <= p2 ? 2 : 1;
}
