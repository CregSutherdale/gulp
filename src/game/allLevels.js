// Every level in play order: Season 1 (levels.js) then Season 2 (levels_wave2.js).
// Importing the prop files here registers their props before any level builds.
import './props_cozy.js';
import './props_wave2.js';
import { LEVELS as SEASON1 } from './levels.js';
import { LEVELS as SEASON2 } from './levels_wave2.js';

export const LEVELS = [...SEASON1, ...SEASON2];
