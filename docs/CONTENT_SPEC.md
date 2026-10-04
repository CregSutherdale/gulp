# Gulp: content spec (props + levels)

Gulp is a private gift game for Kyle's wife Amanda. She plays "Hole It 3D" on her iPhone. You steer a hole that
swallows objects smaller than itself and grows; each level has a target list ("eat all the donuts") and a
generous timer. It is a phone-first web game (Three.js + Rapier). Mechanics are cloned; names, art and text must be
original, all art is code-built geometry, and nothing is AI-generated media.

## Props: `src/game/props_cozy.js`

```js
import { def } from './props.js';
import { box, rbox, cyl, cone, ball, torus, capsule, roof, custom, TINT } from './geo.js';
def('donut', { label: 'Donut', col: {...}, fit, value, mass, tints: [...], build: (variant) => [parts...] });
```

- **Geometry helpers.** All helpers live in `geo.js`, and every part sits with its BASE at `y` unless noted.
  - `box`, `rbox` (rounded, toy-like; prefer it for soft objects), `cyl(rTop, rBot, h, color, x, y, z, seg, rx, rz)`,
    `cone`, `ball(r, color, x, y, z, detail, scaleY)`, `torus(R, tube, color, x, yCenter, z)` and
    `capsule(r, len, color, x, y, z)`.
  - A color of `TINT` takes the per-instance color from `tints`, which is how one prop comes in red, blue and so on.
    Use a few TINT parts per prop; baked colors are fine for details.
  - Use enough segments for smooth rounded shapes (cyl seg 12-16, ball detail 2 for food), but stay reasonable:
    a prop is drawn hundreds of times. Aim for well under 1,500 triangles per prop.
- **Collider `col`.** One shape, centered on the prop: `{t:'box',w,h,d}`, `{t:'cyl',r,h}`, `{t:'ball',r}` or
  `{t:'capsule',r,h}`. It must hug the visible shape: no floating, no sinking.
- **`fit`.** The smallest hole DIAMETER the prop can drop through: the footprint's circumscribed diameter. That is
  `sqrt(w*w+d*d)` for a box and `2r` for cyl, ball and capsule. The game lets an object fall in when
  `fit <= 0.9 * 2 * holeRadius`. The hole starts at radius 0.5, so the first things eaten need `fit <= 0.9`.
- **`value`.** Growth and points. Use `max(1, round(1.6 * fit * fit))`, give or take 30%. Then roughly 10 eaten
  things of one size let you eat things 1.5x that size.
- **`mass`.** About `0.4 * volume`, minimum 0.15. Lighter things tumble more.
- **`label`.** The singular display name used in target lists ("Cupcake").
- **Scale.** 1 unit is about a "hole-start" size. Tiny props (candy, grape, sprinkle, berry) are 0.25-0.6 fit.
  Small (donut, cupcake, apple, toy block, rubber duck) are 0.6-1.2. Medium (cake, watermelon, teddy bear, toy
  truck, flower pot, beach ball) are 1.2-2.5. Large (layer cake tower, picnic basket, armchair, doll house,
  sandcastle, tractor) are 2.5-5. Huge level centerpieces (giant gingerbread house, carousel, play castle) are
  5-8.
- **Look.** Glossy, cute, rounded toy and food style with bright pastel palettes. They should be readable from
  above at phone size, so give each a strong silhouette and colors.
- **What to make.** At least 48 new props across these worlds:
  - bakery/sweets: donut, cupcake, macaron, cookie, croissant, cake slice, layer cake, lollipop, candy, gumdrop,
    ice cream cone, sprinkle
  - picnic/fruit: apple, orange, banana, grapes, strawberry, watermelon (+slice), cherry, lemon, juice box, sandwich,
    picnic basket, blanket roll
  - playroom/toys: toy block, ball, rubber duck, teddy bear, toy car, toy train car, stacking rings, rocket, robot,
    crayon, dollhouse, rocking horse
  - garden: flower, tulip, pot plant, mushroom, garden gnome, watering can, birdhouse, bench, fountain (garden),
    hedge cube
  - beach: shell, starfish, beach ball, bucket, spade, sandcastle, umbrella (closed), surfboard, crab, life ring,
    deck chair, lifeguard tower
  - kitchen: cup, mug, plate stack, bottle, jar, teapot, toaster, pan, fruit bowl
- Every prop needs at least 2 tint colors so color-specific targets work. Names must be original. Don't name
  real brands.

## Levels: `src/game/levels.js`

```js
export const LEVELS = [
  {
    id: 1, name: 'Sprinkle Morning', world: 'bakery',   // world: bakery|picnic|playroom|garden|beach|kitchen|city
    arena: { w: 16, d: 24 },                            // centered on 0,0. x = left/right, z = toward the camera
    time: 75,                                           // seconds. Be generous; she plays to relax
    start: [0, 9],                                      // hole start (x, z); keep it clear of objects
    targets: [{ id: 'donut', n: 'all' }, { id: 'cupcake', n: 3, tint: 1 }], // tint = index into tints (optional)
    place: [
      { op: 'grid', id: 'donut', x: 0, z: -4, cols: 4, rows: 3, gap: 1.3, tint: 'cycle' },
      { op: 'ring', id: 'cookie', x: 0, z: 4, n: 10, r: 2.5, tint: 0 },
      { op: 'pile', id: 'candy', x: -5, z: 0, n: 20, spread: 2.0, tint: 'random' },
      { op: 'line', id: 'cupcake', x0: -6, z0: 8, x1: 6, z1: 8, n: 7, tint: 'cycle' },
      { op: 'at', id: 'layercake', x: 0, z: -9, rot: 0, tint: 2 },
    ],
  },
];
```

- **Ops.**
  - `grid` / `ring` / `line` / `pile` / `at`.
  - `rot` (radians) is allowed on any op. `ring` faces outward unless `rot` is given.
  - `tint` is a number index, `'cycle'`, or `'random'` (deterministic random).
  - `pile` places randomly inside a circle of radius `spread`.
- **Write 30 levels:** 5 per world for bakery, picnic, playroom, garden, beach and kitchen, in that order, with a
  gentle difficulty curve.
  - Levels 1-3 are tiny tutorials: one target type, small counts, 14x20 arenas, about 60-90 objects.
  - Later levels have 2-3 target types (including color-specific ones), arenas up to 28x36, and up to about 350
    objects. Every 5th level has a big centerpiece target.
- **Composition matters** (this is what makes Hole It levels look good):
  - Neat, satisfying arrangements: color-sorted rows, rings, spirals, little scenes (a picnic set out on a
    blanket, a toy room with a train track loop).
  - A focal centerpiece, plus breathing room between groups so the hole can travel.
  - Nothing overlapping. Leave about 0.1 or more of clearance between colliders. The placer does not separate
    objects, and overlaps explode.
  - Keep everything inside the arena by at least 1 unit.
- **Solvability (hard rule).**
  - Before any target can be eaten, the level must contain enough smaller filler to grow the hole big enough. With
    radius `r = sqrt(0.25 + 0.0436 * mass)`, a target with fit `f` needs `r >= f / 1.8`, which means eaten value
    `>= (f*f/3.24 - 0.25) / 0.0436`.
  - Put a size ladder of fillers near the start, and enough total filler value to reach the largest target with at
    least a 40% margin.
  - Write `tools/check_levels.mjs`. It imports both modules (stub `three` if needed; or compute from your own
    data), and for every level checks the solvability math, the arena bounds, that target ids exist, that the
    start point is clear, and that colliders don't overlap (a circle approximation using fit/2 is fine). Print a
    table and exit non-zero on failure. Run it and fix everything until it passes. Print the exit code.

Don't touch any other file. When done, report the prop list (id, fit, value), the level table, and the checker
output. Keep the report under 500 words.
