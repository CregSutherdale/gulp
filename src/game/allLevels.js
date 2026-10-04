// Every level in play order: Season 1 (levels.js), Season 2 (levels_wave2.js), then
// Season 3 (levels_wave3.js). Importing the prop files here registers their props before
// any level builds.
import './props_cozy.js';
import './props_wave2.js';
import './props_wave3.js';
import { LEVELS as SEASON1 } from './levels.js';
import { LEVELS as SEASON2 } from './levels_wave2.js';
import { LEVELS as SEASON3 } from './levels_wave3.js';

export const LEVELS = [...SEASON1, ...SEASON2, ...SEASON3];
