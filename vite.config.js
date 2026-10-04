// Dev-only: if the content files aren't written yet, serve stand-ins so the engine
// can be tested. Production builds (build.mjs) always use the real files.
import fs from 'node:fs';
import path from 'node:path';

const STUBS = {
  'props_cozy.js': 'export {};',
  'levels.js': `export const LEVELS = [{
    id: 1, name: 'Test Street', world: 'picnic', arena: { w: 18, d: 26 }, time: 90, start: [0, 10],
    targets: [{ id: 'car', n: 'all' }, { id: 'bench', n: 2 }],
    place: [
      { op: 'grid', id: 'person', x: 0, z: 4, cols: 6, rows: 3, gap: 0.9, tint: 'cycle' },
      { op: 'line', id: 'cone', x0: -6, z0: 7, x1: 6, z1: 7, n: 9 },
      { op: 'pile', id: 'hydrant', x: -5, z: 0, n: 8, spread: 2 },
      { op: 'pile', id: 'pot', x: 5, z: 0, n: 8, spread: 2, tint: 'random' },
      { op: 'line', id: 'bench', x0: -4, z0: -3, x1: 4, z1: -3, n: 3 },
      { op: 'ring', id: 'bush', x: 0, z: -7, n: 8, r: 3 },
      { op: 'grid', id: 'car', x: 0, z: -9, cols: 2, rows: 1, gap: 3, rot: 1.57 },
    ],
  }];`,
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
