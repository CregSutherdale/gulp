// Dev-only: if the content files aren't written yet, serve stand-ins so the engine
// can be tested. Production builds (build.mjs) always use the real files.
import fs from 'node:fs';
import path from 'node:path';

const STUBS = {
  'props_cozy.js': 'export {};',
  'levels.js': "export { LEVELS } from '/src/game/levels_starter.js';",
  'props_wave2.js': 'export {};',
  'levels_wave2.js': 'export const LEVELS = [];',
  'props_wave3.js': 'export {};',
  'levels_wave3.js': 'export const LEVELS = [];',
};

export default {
  plugins: [{
    name: 'content-stubs',
    resolveId(source, importer) {
      if (!importer) return null;
      const file = path.resolve(path.dirname(importer), source);
      const base = path.basename(file);
      if (STUBS[base] && !fs.existsSync(file)) return '\0stub:' + base;
      return null;
    },
    load(id) { return id.startsWith('\0stub:') ? STUBS[id.slice(6)] : null; },
  }],
  server: { watch: { ignored: ['**/tools/**'] } },
};
