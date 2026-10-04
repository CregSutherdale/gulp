// Starter levels built from the town props. Used until the full cozy level set
// (levels.js) exists, so the game is playable from day one.
export const LEVELS = [
  {
    id: 1, name: 'Lunch Rush', world: 'picnic', arena: { w: 16, d: 24 }, time: 75, start: [0, 9],
    targets: [{ id: 'person', n: 'all' }],
    place: [
      { op: 'grid', id: 'person', x: 0, z: 2, cols: 6, rows: 3, gap: 0.95, tint: 'cycle' },
      { op: 'line', id: 'cone', x0: -5, z0: 6, x1: 5, z1: 6, n: 7 },
      { op: 'pile', id: 'pot', x: -4.5, z: -4, n: 6, spread: 1.6, tint: 'random' },
      { op: 'pile', id: 'hydrant', x: 4.5, z: -4, n: 6, spread: 1.6 },
      { op: 'ring', id: 'person', x: 0, z: -7, n: 8, r: 2.2, tint: 'cycle' },
      { op: 'at', id: 'bench', x: 0, z: -7, rot: 0 },
    ],
  },
  {
    id: 2, name: 'Sunday Park', world: 'garden', arena: { w: 18, d: 26 }, time: 90, start: [0, 10],
    targets: [{ id: 'bush', n: 'all' }, { id: 'bench', n: 3 }],
    place: [
      { op: 'line', id: 'cone', x0: -6, z0: 7, x1: 6, z1: 7, n: 9 },
      { op: 'grid', id: 'pot', x: -4.5, z: 3, cols: 3, rows: 2, gap: 0.9, tint: 'cycle' },
      { op: 'grid', id: 'bin', x: 4.5, z: 3, cols: 3, rows: 2, gap: 0.9, tint: 'cycle' },
      { op: 'grid', id: 'person', x: 0, z: 3, cols: 3, rows: 3, gap: 0.9, tint: 'cycle' },
      { op: 'ring', id: 'bush', x: 0, z: -5, n: 10, r: 3.2, tint: 'cycle' },
      { op: 'line', id: 'bench', x0: -5, z0: -1, x1: 5, z1: -1, n: 3 },
      { op: 'line', id: 'flowerbed', x0: -6, z0: -10, x1: 6, z1: -10, n: 6, tint: 'cycle' },
      { op: 'at', id: 'tree', x: 0, z: -5 },
    ],
  },
  {
    id: 3, name: 'Car Show', world: 'picnic', arena: { w: 20, d: 30 }, time: 120, start: [0, 12],
    targets: [{ id: 'car', n: 'all' }, { id: 'tree', n: 'all' }],
    place: [
      { op: 'grid', id: 'person', x: 0, z: 8, cols: 7, rows: 2, gap: 0.95, tint: 'cycle' },
      { op: 'line', id: 'cone', x0: -7, z0: 5.5, x1: 7, z1: 5.5, n: 11 },
      { op: 'grid', id: 'pot', x: -6, z: 2, cols: 3, rows: 3, gap: 0.9, tint: 'cycle' },
      { op: 'grid', id: 'hydrant', x: 6, z: 2, cols: 3, rows: 3, gap: 0.9 },
      { op: 'line', id: 'bench', x0: -4, z0: 1, x1: 4, z1: 1, n: 3 },
      { op: 'line', id: 'bush', x0: -6, z0: -2.5, x1: 6, z1: -2.5, n: 7, tint: 'cycle' },
      { op: 'line', id: 'vending', x0: -6, z0: -5, x1: 6, z1: -5, n: 5, tint: 'cycle' },
      { op: 'grid', id: 'car', x: 0, z: -9, cols: 3, rows: 2, gap: 3.2, gapZ: 3.0, rot: 1.5708, tint: 'cycle' },
      { op: 'line', id: 'tree', x0: -8, z0: -13, x1: 8, z1: -13, n: 5, tint: 'cycle' },
    ],
  },
];
