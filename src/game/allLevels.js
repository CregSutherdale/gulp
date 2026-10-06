// Every level in play order: Season 1 (levels.js), Season 2 (levels_wave2.js), Season 3
// (levels_wave3.js), then Seasons 4-7 (levels_wave4..7.js). Importing the prop files here
// registers their props before any level builds. Seasons 4+ are self-contained: each brings
// its props, levels + tuning (timers, growth, pars) and worlds (floor, scenery, music), and
// this file registers them into the shared tables.
import './props_cozy.js';
import './props_wave2.js';
import './props_wave3.js';
import './props_wave4.js';
import './props_wave5.js';
import './props_wave6.js';
import './props_wave7.js';
import { LEVELS as SEASON1 } from './levels.js';
import { LEVELS as SEASON2 } from './levels_wave2.js';
import { LEVELS as SEASON3 } from './levels_wave3.js';
import * as S4 from './levels_wave4.js';
import * as S5 from './levels_wave5.js';
import * as S6 from './levels_wave6.js';
import * as S7 from './levels_wave7.js';
import * as W4 from './worlds_wave4.js';
import * as W5 from './worlds_wave5.js';
import * as W6 from './worlds_wave6.js';
import * as W7 from './worlds_wave7.js';
import { WORLDS } from './levelbuild.js';
import { registerBackdrops } from './backdrops.js';
import { registerMusicKeys } from '../engine/audio.js';
import { TIMES, GROW_BY_LEVEL, CHALLENGE_PARS } from './difficulty.js';
import { PARS } from './pars.js';

for (const W of [W4, W5, W6, W7]) {
  Object.assign(WORLDS, W.WORLDS);
  registerBackdrops(W.BACKDROPS);
  registerMusicKeys(W.MUSIC);
}
for (const S of [S4, S5, S6, S7]) {
  const t = S.TUNING || {};
  Object.assign(TIMES, t.times); Object.assign(GROW_BY_LEVEL, t.grow);
  Object.assign(CHALLENGE_PARS, t.pars); Object.assign(PARS, t.relaxedPars);
}

export const LEVELS = [...SEASON1, ...SEASON2, ...SEASON3, ...S4.LEVELS, ...S5.LEVELS, ...S6.LEVELS, ...S7.LEVELS];
