// Prop catalog. Each prop: geometry (base at y=0, re-centered on its collider),
// a collider, `fit` = the smallest hole DIAMETER it can physically drop through
// (its footprint's circumscribed diameter), `value` = growth/points, and `tints`
// = palette for the TINT parts. Sizes are in meters-ish; a person is 0.9 tall.
import { box, cyl, cone, ball, roof, windows, merge, TINT } from './geo.js';

const SKIN = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac];
const WIN = 0xbfe3f2, WIN_D = 0x5d7f99, TIRE = 0x2b2b30, METAL = 0x9aa3ad, WOOD = 0x9b6b43;

const P = {};
export function def(id, o) { P[id] = { id, label: id[0].toUpperCase() + id.slice(1), ...o }; }

// ---------- tiny (fits a starting hole) ----------
def('person', {
  col: { t: 'capsule', r: 0.17, h: 0.9 }, fit: 0.36, value: 1, mass: 0.6, walker: true,
  tints: [0xff5d73, 0x4f9dff, 0xffc93c, 0x6ad48a, 0xb07cff, 0xff8a3d, 0xffffff, 0x3ec7c2],
  build: (v) => [
    box(0.12, 0.42, 0.13, 0x3b3f58, -0.07, 0, 0), box(0.12, 0.42, 0.13, 0x3b3f58, 0.07, 0, 0),
    cyl(0.15, 0.17, 0.32, TINT, 0, 0.4, 0, 7),
    ball(0.13, SKIN[v % SKIN.length], 0, 0.7, 0, 1),
    ball(0.135, [0x3a2a1e, 0x1c1c1c, 0xd9a441, 0x8a4b2a][v % 4], 0, 0.76, -0.015, 1, 0.75),
  ], variants: 5,
});
def('cone', {
  col: { t: 'cyl', r: 0.17, h: 0.5 }, fit: 0.36, value: 1, mass: 0.3,
  build: () => [box(0.36, 0.05, 0.36, 0xff7a1a), cone(0.15, 0.45, 0xff7a1a, 0, 0.05), cyl(0.09, 0.105, 0.08, 0xffffff, 0, 0.2, 0, 8)],
});
def('hydrant', {
  col: { t: 'cyl', r: 0.15, h: 0.55 }, fit: 0.32, value: 1, mass: 0.8,
  build: () => [cyl(0.12, 0.14, 0.42, 0xe23b3b), ball(0.12, 0xe23b3b, 0, 0.36, 0, 1, 0.8), cyl(0.05, 0.05, 0.32, 0xc22e2e, 0, 0.28, 0, 6, 0, Math.PI / 2)],
});
def('bin', {
  col: { t: 'cyl', r: 0.2, h: 0.6 }, fit: 0.42, value: 1, mass: 0.5,
  tints: [0x3a8f5c, 0x5a6b7b, 0x2f74c0],
  build: () => [cyl(0.2, 0.17, 0.55, TINT), cyl(0.22, 0.22, 0.06, 0x2d3640, 0, 0.55)],
});
def('pot', {
  col: { t: 'cyl', r: 0.2, h: 0.55 }, fit: 0.42, value: 1, mass: 0.4,
  tints: [0xff6fa8, 0xffd23f, 0xff5a4f, 0xb57bff, 0xffffff],
  build: () => [cyl(0.2, 0.15, 0.3, 0xc8734a), ball(0.13, TINT, -0.06, 0.28, 0.03), ball(0.12, TINT, 0.08, 0.3, -0.05), ball(0.15, 0x3e9b4f, 0, 0.24, 0, 0, 0.6)],
});
def('mailbox', {
  col: { t: 'box', w: 0.4, h: 0.95, d: 0.45 }, fit: 0.6, value: 2, mass: 0.6,
  build: () => [box(0.08, 0.5, 0.08, 0x2f3540), box(0.4, 0.45, 0.45, 0x2d6ad9, 0, 0.5), cyl(0.2, 0.2, 0.45, 0x2d6ad9, 0, 0.95, 0, 10, Math.PI / 2)],
});
def('sign', {
  col: { t: 'cyl', r: 0.12, h: 1.7 }, fit: 0.3, value: 1, mass: 0.4,
  build: () => [cyl(0.03, 0.03, 1.3, METAL), cyl(0.24, 0.24, 0.04, 0xe2373f, 0, 1.45, 0, 8, Math.PI / 2), cyl(0.18, 0.18, 0.05, 0xffffff, 0, 1.45, 0.005, 8, Math.PI / 2)],
});
def('lamp', {
  col: { t: 'cyl', r: 0.13, h: 2.8 }, fit: 0.3, value: 2, mass: 0.8,
  build: () => [cyl(0.12, 0.14, 0.15, 0x3a4250), cyl(0.04, 0.05, 2.5, 0x3a4250, 0, 0.15), box(0.5, 0.05, 0.08, 0x3a4250, 0.2, 2.6), box(0.22, 0.12, 0.22, 0xfff2b0, 0.42, 2.48)],
});
def('bush', {
  col: { t: 'ball', r: 0.4 }, fit: 0.78, value: 2, mass: 0.5,
  tints: [0x4caf50, 0x3f9b46, 0x5cbf5a, 0x2f8a46],
  build: () => [ball(0.4, TINT, 0, 0, 0, 1, 0.85), ball(0.25, TINT, 0.22, 0.15, 0.1, 1), ball(0.22, TINT, -0.2, 0.18, -0.12, 1)],
});
def('flowerbed', {
  col: { t: 'box', w: 0.9, h: 0.35, d: 0.45 }, fit: 1.0, value: 2, mass: 0.6,
  tints: [0xff6fa8, 0xffd23f, 0xff5a4f, 0xb57bff],
  build: () => {
    const p = [box(0.9, 0.22, 0.45, 0x8a5a3c), box(0.82, 0.04, 0.37, 0x5a3b28, 0, 0.2)];
    for (let i = 0; i < 4; i++) p.push(ball(0.09, TINT, -0.3 + i * 0.2, 0.22, (i % 2 ? 0.08 : -0.08), 0));
    return p;
  },
});

// ---------- small ----------
def('bench', {
  col: { t: 'box', w: 1.4, h: 0.75, d: 0.5 }, fit: 1.48, value: 3, mass: 1.2,
  build: () => [
    box(0.08, 0.38, 0.4, 0x2f3540, -0.6, 0), box(0.08, 0.38, 0.4, 0x2f3540, 0.6, 0),
    box(1.4, 0.06, 0.42, WOOD, 0, 0.38), box(1.4, 0.3, 0.06, WOOD, 0, 0.44, -0.2),
  ],
});
def('bike', {
  col: { t: 'box', w: 1.1, h: 0.75, d: 0.3 }, fit: 1.15, value: 3, mass: 0.6,
  tints: [0xff4d6d, 0x2fb3ff, 0xffc021, 0x7ad36b],
  build: () => [
    cyl(0.28, 0.28, 0.05, TIRE, -0.38, 0.28, 0, 10, Math.PI / 2), cyl(0.28, 0.28, 0.05, TIRE, 0.38, 0.28, 0, 10, Math.PI / 2),
    box(0.78, 0.06, 0.05, TINT, 0, 0.45), box(0.06, 0.32, 0.05, TINT, -0.12, 0.42), box(0.22, 0.05, 0.12, 0x222222, -0.12, 0.74),
    box(0.05, 0.3, 0.05, TINT, 0.3, 0.45), box(0.05, 0.05, 0.4, 0x333333, 0.3, 0.75),
  ],
});
def('vending', {
  col: { t: 'box', w: 0.75, h: 1.5, d: 0.55 }, fit: 0.93, value: 4, mass: 2,
  tints: [0xe2373f, 0x2d6ad9, 0x1fa86b],
  build: () => [box(0.75, 1.5, 0.55, TINT), box(0.5, 0.9, 0.04, 0xe9f6ff, -0.06, 0.45, 0.28), box(0.14, 0.4, 0.04, 0x222831, 0.27, 0.7, 0.28)],
});
def('booth', {
  col: { t: 'box', w: 0.75, h: 1.9, d: 0.75 }, fit: 1.06, value: 4, mass: 1.6,
  build: () => [box(0.75, 0.15, 0.75, 0xc4202b), box(0.08, 1.6, 0.08, 0xd62832, -0.33, 0.15, 0.33), box(0.08, 1.6, 0.08, 0xd62832, 0.33, 0.15, 0.33),
    box(0.08, 1.6, 0.08, 0xd62832, -0.33, 0.15, -0.33), box(0.08, 1.6, 0.08, 0xd62832, 0.33, 0.15, -0.33),
    box(0.6, 1.3, 0.6, 0xcfeaf5, 0, 0.3), box(0.78, 0.2, 0.78, 0xc4202b, 0, 1.7)],
});
def('cart', {
  col: { t: 'box', w: 1.3, h: 1.6, d: 0.8 }, fit: 1.53, value: 5, mass: 1.5,
  tints: [0xff5a5a, 0x3fa9f5, 0x46c36b, 0xffb000],
  build: () => [
    cyl(0.18, 0.18, 0.06, TIRE, -0.35, 0.18, 0.4, 10, Math.PI / 2), cyl(0.18, 0.18, 0.06, TIRE, 0.35, 0.18, 0.4, 10, Math.PI / 2),
    box(1.2, 0.7, 0.75, 0xf4f1e8, 0, 0.2), box(1.2, 0.08, 0.75, TINT, 0, 0.88),
    box(0.04, 0.6, 0.04, 0xd9d9d9, 0, 0.95), cone(0.7, 0.3, TINT, 0, 1.3, 0, 8),
  ],
});

// ---------- vehicles / medium ----------
function carParts(len, wid, tall, cabinLen, extra = []) {
  return [
    box(len, tall * 0.45, wid, TINT, 0, 0.16),
    box(cabinLen, tall * 0.42, wid * 0.86, TINT, -len * 0.06, 0.16 + tall * 0.45),
    box(cabinLen * 1.02, tall * 0.3, wid * 0.88, WIN_D, -len * 0.06, 0.18 + tall * 0.47),
    box(0.06, tall * 0.14, wid * 0.7, 0xfff3c4, len / 2, 0.3), box(0.06, tall * 0.12, wid * 0.7, 0xd7263d, -len / 2, 0.32),
    ...[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([a, b]) => cyl(0.2, 0.2, 0.14, TIRE, a * len * 0.32, 0.2, b * wid * 0.45, 10, Math.PI / 2)),
    ...extra,
  ];
}
def('car', {
  col: { t: 'box', w: 2.1, h: 0.85, d: 1.0 }, fit: 2.33, value: 6, mass: 3, driver: true,
  tints: [0xff4d5a, 0x2f7df6, 0xf7f7f2, 0x2a2d34, 0x2ec27e, 0xffb020, 0x8e5cf6, 0x1fb6c9],
  build: () => carParts(2.1, 1.0, 0.85, 1.15),
});
def('taxi', {
  col: { t: 'box', w: 2.1, h: 0.95, d: 1.0 }, fit: 2.33, value: 7, mass: 3, driver: true,
  tints: [0xffc61a],
  build: () => carParts(2.1, 1.0, 0.85, 1.15, [box(0.4, 0.14, 0.2, 0x222222, -0.12, 0.86)]),
});
def('van', {
  col: { t: 'box', w: 2.6, h: 1.35, d: 1.15 }, fit: 2.85, value: 10, mass: 4.5, driver: true,
  tints: [0xf7f7f2, 0x2f7df6, 0xff8a3d, 0x9aa3ad],
  build: () => [
    box(2.6, 1.15, 1.15, TINT, 0, 0.2), box(0.06, 0.4, 1.0, WIN_D, 1.3, 0.85), box(0.5, 0.4, 1.17, WIN_D, 0.95, 0.85),
    ...[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([a, b]) => cyl(0.23, 0.23, 0.15, TIRE, a * 0.85, 0.23, b * 0.52, 10, Math.PI / 2)),
  ],
});
def('shelter', {
  col: { t: 'box', w: 2.4, h: 1.9, d: 0.9 }, fit: 2.56, value: 8, mass: 3,
  build: () => [
    box(0.08, 1.8, 0.08, METAL, -1.1, 0, -0.35), box(0.08, 1.8, 0.08, METAL, 1.1, 0, -0.35),
    box(2.3, 1.5, 0.04, 0xcde8f4, 0, 0.2, -0.38), box(2.5, 0.08, 0.95, 0x2f6fd6, 0, 1.8), box(1.6, 0.08, 0.35, WOOD, 0, 0.45, -0.2),
  ],
});
def('tree', {
  col: { t: 'cyl', r: 0.8, h: 3.0 }, fit: 1.7, value: 6, mass: 2,
  tints: [0x58b947, 0x4aa63f, 0x69c25a, 0x3d9a48],
  build: () => [cyl(0.13, 0.18, 1.3, 0x7a5233), ball(0.8, TINT, 0, 1.1, 0, 1, 0.9), ball(0.55, TINT, 0.3, 1.9, 0.1, 1)],
});
def('pine', {
  col: { t: 'cyl', r: 0.75, h: 3.4 }, fit: 1.6, value: 6, mass: 2,
  tints: [0x2e8b57, 0x3a9a5f, 0x267a4b],
  build: () => [cyl(0.12, 0.15, 0.7, 0x6d4a2d), cone(0.8, 1.4, TINT, 0, 0.6, 0, 8), cone(0.62, 1.2, TINT, 0, 1.35, 0, 8), cone(0.42, 1.0, TINT, 0, 2.1, 0, 8)],
});
def('kiosk', {
  col: { t: 'box', w: 1.9, h: 2.3, d: 1.6 }, fit: 2.5, value: 10, mass: 4,
  tints: [0xff6f61, 0x48b8e8, 0xffc93c, 0x7ccf6a],
  build: () => [box(1.8, 1.9, 1.5, 0xfaf3e3), box(1.2, 0.6, 0.04, 0x2a2f38, 0, 0.9, 0.76), box(1.95, 0.12, 1.65, TINT, 0, 1.9), cone(1.25, 0.5, TINT, 0, 2.0, 0, 4)],
});
def('fountain', {
  col: { t: 'cyl', r: 1.5, h: 1.6 }, fit: 3.0, value: 14, mass: 6,
  build: () => [cyl(1.5, 1.55, 0.45, 0xd9d4c7, 0, 0, 0, 14), cyl(1.32, 1.32, 0.06, 0x5cc8f0, 0, 0.4, 0, 14), cyl(0.18, 0.25, 1.0, 0xd9d4c7, 0, 0.4), cyl(0.6, 0.45, 0.15, 0xd9d4c7, 0, 1.2, 0, 12), ball(0.22, 0x8fdcf7, 0, 1.3, 0, 1)],
});
def('bus', {
  col: { t: 'box', w: 4.6, h: 1.75, d: 1.4 }, fit: 4.8, value: 22, mass: 9, driver: true,
  tints: [0xffc21a, 0xe8423c, 0x2f7df6, 0x2ec27e],
  build: () => [
    box(4.6, 1.5, 1.4, TINT, 0, 0.25), box(4.62, 0.45, 1.42, WIN, -0.1, 1.0), box(0.04, 0.6, 1.2, WIN, 2.31, 0.85),
    box(4.62, 0.08, 1.42, 0xffffff, 0, 0.62),
    ...[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([a, b]) => cyl(0.3, 0.3, 0.16, TIRE, a * 1.5, 0.3, b * 0.66, 10, Math.PI / 2)),
  ],
});
def('truck', {
  col: { t: 'box', w: 4.0, h: 1.9, d: 1.45 }, fit: 4.25, value: 20, mass: 9, driver: true,
  tints: [0xf7f7f2, 0xe8423c, 0x2f7df6, 0xff8a3d],
  build: () => [
    box(1.1, 1.3, 1.4, TINT, 1.45, 0.3), box(0.06, 0.5, 1.2, WIN_D, 2.0, 0.95),
    box(2.8, 1.6, 1.45, 0xeeeeee, -0.5, 0.3),
    ...[[-1, -1], [-1, 1], [0.3, -1], [0.3, 1], [1.2, -1], [1.2, 1]].map(([a, b]) => cyl(0.3, 0.3, 0.16, TIRE, a * 1.3, 0.3, b * 0.66, 10, Math.PI / 2)),
  ],
});

// ---------- buildings ----------
def('house', {
  col: { t: 'box', w: 3.0, h: 3.6, d: 3.0 }, fit: 4.25, value: 30, mass: 14,
  tints: [0xf6e7c8, 0xcfe8f7, 0xf7d1d1, 0xd8f0cf, 0xfff3b0],
  build: (v) => [
    box(3.0, 2.2, 3.0, TINT), roof(3.4, 1.4, 3.3, [0xc8553d, 0x4a6fa5, 0x6b4f3a, 0x8c3b5e][v % 4], 0, 2.2, 0),
    box(0.6, 1.1, 0.05, 0x7b4a2b, 0, 0, 1.52), ...windows(3.0, 2.2, 3.0, 1, 2, WIN, 0.25).slice(1),
    box(0.35, 0.8, 0.35, 0xa6503b, 0.8, 2.8, 0.6),
  ], variants: 4,
});
def('shop', {
  col: { t: 'box', w: 4.0, h: 3.4, d: 3.4 }, fit: 5.24, value: 42, mass: 18,
  tints: [0xff8fab, 0x7bd3ea, 0xffd166, 0x95e1a0, 0xcdb4ff],
  build: () => [
    box(4.0, 3.2, 3.4, 0xf4efe6), box(4.06, 0.18, 3.46, 0xd9d2c3, 0, 3.2),
    box(3.0, 1.3, 0.05, WIN, 0, 0.3, 1.71), box(4.1, 0.12, 0.9, TINT, 0, 1.75, 2.1),
    box(4.1, 0.5, 0.06, TINT, 0, 2.2, 1.73), ...windows(4.0, 3.2, 3.4, 1, 3, WIN, 1.9).filter((_, i) => i % 2),
  ],
});
def('apartment', {
  col: { t: 'box', w: 5.0, h: 8.4, d: 5.0 }, fit: 7.07, value: 95, mass: 45,
  tints: [0xf2c6a0, 0xc9d6e3, 0xe8b4bc, 0xd5e8c8, 0xf1e3b3],
  build: () => [
    box(5.0, 8.0, 5.0, TINT), box(5.2, 0.4, 5.2, 0xe9e4da, 0, 8.0),
    ...windows(5.0, 8.0, 5.0, 4, 3, WIN, 0), box(1.2, 1.4, 0.06, 0x5b4636, 0, 0, 2.53),
  ],
});
def('office', {
  col: { t: 'box', w: 5.5, h: 13.0, d: 5.5 }, fit: 7.78, value: 160, mass: 80,
  tints: [0x9fd3f0, 0xa8e6cf, 0xc3b8f5, 0x8fb8de],
  build: () => {
    const p = [box(5.5, 12.4, 5.5, 0xdfe6ee), box(5.7, 0.6, 5.7, 0xc8d0da, 0, 12.4), box(1.6, 0.8, 1.6, 0x9aa3ad, 1.2, 13.0, -1.2)];
    for (let f = 0; f < 6; f++) {
      p.push(box(5.56, 1.3, 5.56, TINT, 0, 0.9 + f * 1.9));
    }
    return p;
  },
});
def('tower', {
  col: { t: 'box', w: 7.0, h: 21.0, d: 7.0 }, fit: 9.9, value: 320, mass: 160,
  tints: [0x7fb2e5, 0x87d4c2, 0xa5a8f0],
  build: () => {
    const p = [box(7.0, 18, 7.0, 0xe6ebf1), box(5.2, 2.4, 5.2, 0xd2d9e2, 0, 18), cyl(0.08, 0.08, 0.9, METAL, 0, 20.4), ball(0.16, 0xff4d4d, 0, 20.9, 0, 0)];
    for (let f = 0; f < 9; f++) p.push(box(7.06, 1.25, 7.06, TINT, 0, 0.8 + f * 1.95));
    return p;
  },
});

export const PROPS = P;

// Collider center height and the half-height used for the "fully swallowed" test.
export function colliderHalfHeight(col) {
  if (col.t === 'ball') return col.r;
  return col.h / 2;
}

// Color-target props whose tinted parts are too small to read at phone size (tint audit 10/06:
// 364 tinted props rendered before/after the tint-mask fix; every other color target read fine).
const TINT_FLOOR = { snowman: 0.4, candycane: 0.45, wheelbarrow: 0.55, wand: 0.6, nest: 0.75 };

// Build the geometry for a prop, re-centered so the body origin = collider center.
export function buildGeometry(prop, variant = 0) {
  const g = merge(prop.build(variant));
  g.translate(0, -colliderHalfHeight(prop.col), 0);
  // tintFloor (0..1): every part takes at least this much of the instance tint. For color-target
  // props whose TINT parts are too small to read at phone size once the tint mask works (10/06).
  const f = TINT_FLOOR[prop.id] ?? prop.tintFloor;
  if (f && g.attributes.tmask) { const m = g.attributes.tmask; for (let i = 0; i < m.count; i++) m.setX(i, Math.max(m.getX(i), f)); }
  g.computeBoundingSphere();
  return g;
}
