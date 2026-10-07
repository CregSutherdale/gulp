import { PROPS } from '../src/game/props.js';
import '../src/game/props_cozy.js'; import '../src/game/props_wave2.js'; import '../src/game/props_wave3.js'; import '../src/game/props_wave4.js';
const mod = await import('../src/game/allLevels.js');
const L = mod.ALL_LEVELS || mod.LEVELS || mod.default || Object.values(mod).find(Array.isArray);
const by = {};
L.forEach((lv, i) => { if (i >= 75) return; for (const t of lv.targets || []) if (t.tint !== undefined) (by[t.id] ||= []).push(`L${i + 1}:t${t.tint}`); });
for (const [id, a] of Object.entries(by)) console.log(id, PROPS[id]?.tints?.length, a.join(' '));
console.log('levels', L.length);
