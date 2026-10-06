
  // ======================================================== DINO DIG
  {
    // Egg clutches round four nests: pink eggs hide among PEACH ones (and a big pink egg
    // decoy). Fossil shells sit in two opposite corners; orange baby dinos parade.
    id: 111, name: 'Egg Hunt', world: 'dino', arena: { w: 24, d: 32 }, time: 170, start: [0, 13.8],
    targets: [{ id: 'dinoegg', n: 'all', tint: 1 }, { id: 'ammonite', n: 'all' }, { id: 'brush', n: 'all', tint: 2 }, { id: 'babydino', n: 'all', tint: 3 }],
    place: [
      ...[[-6.0, -11.0], [6.0, -11.0], [-6.0, -3.4], [6.0, -3.4]].flatMap(([x, z], k) => [
        at('nest', x, z, [5, 1, 0, 2][k]),
        ...ringCam('dinoegg', x, z, 10, 1.75, [[1, 5, 0, 5, 2, 1, 3, 5, 4, 6], [5, 2, 1, 6, 5, 4, 1, 0, 5, 3], [6, 5, 3, 1, 0, 5, 2, 4, 1, 5], [5, 1, 4, 5, 6, 2, 5, 1, 0, 3]][k], 0.3),
      ]),
      at('bigegg', 0, -7.2, 1), at('bigegg', 0, -13.6, 5),
      grid('ammonite', -9.4, -13.8, 3, 3, 0.64, 0.64, 'cycle'), grid('ammonite', 9.4, 6.4, 3, 3, 0.64, 0.64, 'cycle'),
      ...mirror((s) => line('toybone', s * 10.2, -10.0, s * 10.2, 2.0, 11, 'cycle', PI / 2)),
      ...diag('brush', 0, 0.6, 10, 2, 0.8, 0.34, P5, 0, 2),
      line('babydino', -8.0, 3.2, 8.0, 3.2, 9, [3, 0, 5, 3, 1, 2, 3, 4, 0], 0),
      ...diag('dinoegg', 0, 5.2, 16, 2, 0.6, 0.6, [1, 5, 0, 2, 3, 4, 6], 0, 2),
      line('sandbucket', -8.0, 7.2, 6.0, 7.2, 8),
      line('shovel', -9.0, 8.8, 9.0, 8.8, 8, 'cycle', 0),
      line('fossiltile', -6.0, 10.6, 6.0, 10.6, 6, 'cycle', 0),
      ...mirror((s) => line('toybone', s * 2.4, 12.6, s * 6.4, 12.6, 6, 'cycle', 0)),
      ...mirror((s) => grid('ammonite', s * 9.0, 12.8, 2, 3, 0.64, 0.64, 'cycle')),
      line('brush', -1.6, 11.8, 1.6, 11.8, 4, [0, 2, 4, 1], 0),
    ],
  },
  {
    // A toy skeleton laid out in bones: cream bones hide among ivory and blush ones.
    // Blue shovels mix with four other colors; two stegos guard opposite corners.
    id: 112, name: 'Bone Yard', world: 'dino', arena: { w: 24, d: 34 }, time: 180, start: [0, 14.8],
    targets: [{ id: 'toybone', n: 'all', tint: 1 }, { id: 'fossiltile', n: 'all' }, { id: 'shovel', n: 'all', tint: 1 }, { id: 'stego', n: 'all' }],
    place: [
      // the skeleton: a spine curve with rib pairs
      ...path('toybone', (t) => [-7.0 + 14.0 * t, -8.0 - 2.6 * Math.sin(t * PI)], 0.72, [0, 2, 1, 0, 3, 2, 0, 1, 2, 3], { face: 'along' }),
      ...[-4.2, -2.4, -0.6, 1.2, 3.0, 4.8].flatMap((x, i) => {
        const z0 = -8.0 - 2.6 * Math.sin(((x + 7) / 14) * PI);
        return [-1, 1].flatMap((s) => [at('toybone', x, z0 + s * 1.0, [2, 1, 0, 3][(i + (s > 0 ? 1 : 0)) % 4], PI / 2), at('toybone', x, z0 + s * 1.75, [0, 3, 1, 2][(i + (s > 0 ? 2 : 0)) % 4], PI / 2)]);
      }),
      at('fossiltile', -8.6, -8.0, 0), at('fossiltile', 8.6, -8.0, 1),
      at('stego', -9.0, -15.0, 0, 0), at('stego', 9.0, 4.2, 2, 0),
      at('fossiltile', 9.6, -15.0, 2), at('fossiltile', -9.6, 4.2, 3),
      ...diag('ammonite', 0, -14.6, 12, 2, 0.6, 0.6, P4, 0, 1),
      ...diag('shovel', 0, -2.0, 4, 4, 1.3, 0.5, P5, 0, 2),
      ...mirror((s) => [at('bigegg', s * 6.0, -2.0, s < 0 ? 1 : 3), ring('dinoegg', s * 6.0, -2.0, 10, 1.4, 'cycle')]),
      ...mirror((s) => line('sandbucket', s * 10.2, -12.4, s * 10.2, -2.4, 8)),
      ...diag('toybone', 0, 1.6, 12, 2, 0.7, 0.36, P4, 0, 1),
      line('babydino', -6.0, 3.6, 6.0, 3.6, 7, 'cycle', 0),
      line('shovel', -9.0, 6.0, 9.0, 6.0, 8, [2, 1, 0, 4, 3, 1, 2, 0], 0),
      line('brush', -9.4, 7.6, 9.4, 7.6, 16, 'cycle', 0),
      line('dinoegg', -9.0, 9.0, 9.0, 9.0, 25),
      ...mirror((s) => line('fossiltile', s * 3.0, 10.8, s * 9.6, 10.8, 4, 'cycle', 0)),
      ...diag('toybone', 0, 12.6, 8, 2, 0.7, 0.36, P4, 0, 2),
      ...mirror((s) => line('ammonite', s * 2.6, 14.4, s * 8.6, 14.4, 10)),
    ],
  },
  {
    // TWO-STAGE GATE: a mint nest among blue look-alike nests opens stage one; two dig
    // tents in opposite corners need most of the dig. Pink baby dinos hide in a crowd.
    id: 113, name: 'Nest Watch', world: 'dino', arena: { w: 26, d: 36 }, time: 210, start: [0, 15.8],
    targets: [{ id: 'nest', n: 'all', tint: 0 }, { id: 'babydino', n: 'all', tint: 2 }, { id: 'sandbucket', n: 'all', tint: 4 }, { id: 'digtent', n: 'all' }],
    place: [
      at('digtent', -9.6, -15.0, 0), at('digtent', 9.6, 8.6, 2),
      ...[[-3.0, -13.4], [3.0, -13.4], [9.6, -13.6], [-9.6, -6.2], [-3.0, -6.6], [3.0, -6.6], [9.6, -6.2]].map(([x, z], k) => at('nest', x, z, [2, 0, 2, 0, 2, 2, 0][k])),
      ...mirror((s) => ringCam('babydino', s * 6.0, -10.0, 6, 1.7, s < 0 ? [2, 1, 0, 2, 4, 3] : [4, 2, 3, 0, 2, 1])),
      ...diag('sandbucket', 0, -2.4, 12, 2, 0.9, 0.9, P5, 0, 2),
      ...mirror((s) => [at('sandpile', s * 9.6, -1.6, s < 0 ? 0 : 1), at('stego', s * 9.4, 1.6, s < 0 ? 1 : 3, 0)]),
      ...mirror((s) => [at('digcart', s * 4.6, 1.4, s < 0 ? 0 : 3, 0), at('bigegg', s * 1.4, 1.4, s < 0 ? 4 : 2)]),
      ...diag('dinoegg', 0, 4.0, 18, 2, 0.6, 0.6, P7, 0, 2),
      line('babydino', -10.4, 6.0, 4.4, 6.0, 9, [0, 2, 1, 4, 2, 3, 5, 2, 1], 0),
      line('shovel', -10.0, 7.8, 4.4, 7.8, 7, 'cycle', 0),
      line('fossiltile', -10.4, 9.6, 4.6, 9.6, 8, 'cycle', 0),
      ...diag('ammonite', 0, 11.4, 18, 2, 0.6, 0.6, P4, 0, 1),
      line('sandbucket', -10.0, 13.2, 10.0, 13.2, 13, [0, 4, 1, 2, 4, 3, 0, 1, 4, 2, 3, 4, 1]),
      ...mirror((s) => line('toybone', s * 2.4, 14.8, s * 7.4, 14.8, 7, 'cycle', 0)),
      ...mirror((s) => grid('dinoegg', s * 10.0, 15.2, 3, 2, 0.6, 0.6, 'cycle')),
      ...mirror((s) => line('brush', s * 11.4, -12.0, s * 11.4, -9.0, 5, 'cycle', PI / 2)),
    ],
  },
  {
    // SCARCE FILLER + OPPOSITE CORNERS: two toy longnecks in far corners, yellow dig carts
    // among look-alike carts, mint eggs among blue ones. Just enough food for the longnecks.
    id: 114, name: 'Dig Site', world: 'dino', arena: { w: 26, d: 36 }, time: 210, start: [0, 15.8],
    targets: [{ id: 'longneck', n: 'all' }, { id: 'digcart', n: 'all', tint: 2 }, { id: 'dinoegg', n: 'all', tint: 0 }, { id: 'fossiltile', n: 'all', tint: 2 }],
    place: [
      at('longneck', -8.6, -15.6, 1, 0), at('longneck', 8.6, 6.6, 4, 0),
      at('digtent', 8.8, -14.8, 3), at('digtent', -9.0, 6.0, 1),
      ...[[-4.0, -10.6], [3.6, -9.2], [-9.6, -5.4], [9.6, -1.8], [0.4, -4.6], [-3.6, 2.2]].map(([x, z], k) => at('digcart', x, z, [2, 0, 1, 2, 4, 3][k], 0)),
      ...mirror((s) => [at('stego', s * 9.4, -9.6, s < 0 ? 0 : 5, 0), at('sandpile', s * 5.2, -1.6, s < 0 ? 2 : 0)]),
      ...[[-1.0, -14.4], [-9.8, -0.2], [5.2, 2.4], [9.8, -5.8]].map(([x, z], k) => at('fossiltile', x, z, [2, 0, 2, 1][k])),
      ...mirror((s) => ring('dinoegg', s * 3.4, -14.0, 7, 1.1, s < 0 ? [0, 2, 0, 6, 2, 4, 2] : [2, 0, 2, 3, 2, 0, 1])),
      ...diag('dinoegg', 0, -7.0, 8, 2, 0.6, 0.6, [0, 2, 6, 1], 0, 1),
      ...diag('fossiltile', 0, 5.2, 6, 1, 1.4, 1.4, [0, 2, 3, 1, 0, 3]),
      ...diag('dinoegg', 0, 7.6, 14, 2, 0.6, 0.6, [0, 2, 5, 3, 4, 2, 6], 0, 3),
      line('shovel', -7.4, 9.6, 7.4, 9.6, 6, 'cycle', 0),
      line('babydino', -6.0, 11.2, 6.0, 11.2, 7, 'cycle', 0),
      ...diag('ammonite', 0, 12.8, 14, 2, 0.6, 0.6, P4, 0, 1),
      ...mirror((s) => line('toybone', s * 2.4, 14.8, s * 7.4, 14.8, 7, 'cycle', 0)),
      ...mirror((s) => grid('brush', s * 10.0, 13.6, 2, 4, 0.8, 0.36, 'cycle')),
    ],
  },
  {
    // CENTERPIECE: the volcano play set at the back of the dig. Peach eggs hide among
    // pink ones, green babies in every herd, stegos in all four corners.
    id: 115, name: 'Volcano Day', world: 'dino', arena: { w: 30, d: 40 }, time: 270, start: [0, 17.8],
    targets: [{ id: 'volcano', n: 'all' }, { id: 'dinoegg', n: 'all', tint: 5 }, { id: 'babydino', n: 'all', tint: 0 }, { id: 'stego', n: 'all' }],
    place: [
      at('volcano', 0, -14.8, 0),
      ...mirror((s) => [at('stego', s * 12.2, -18.0, s < 0 ? 1 : 2, 0), at('stego', s * 12.2, 17.2, s < 0 ? 4 : 3, 0)]),
      ...mirror((s) => [at('longneck', s * 7.2, -18.0, s < 0 ? 0 : 3, 0), at('digtent', s * 11.6, -12.6, s < 0 ? 0 : 2)]),
      at('digtent', 0, -7.0, 1),
      ...mirror((s) => [at('nest', s * 5.0, -7.4, s < 0 ? 5 : 1), ringCam('dinoegg', s * 5.0, -7.4, 9, 1.65, s < 0 ? [5, 1, 0, 5, 1, 2, 5, 1, 3] : [1, 5, 4, 1, 5, 6, 1, 5, 2])]),
      ...mirror((s) => [at('longneck', s * 11.4, -6.4, s < 0 ? 5 : 1, 0), at('digcart', s * 11.6, -2.4, s < 0 ? 1 : 4, 0)]),
      ...mirror((s) => [at('sandpile', s * 7.8, -2.4, s < 0 ? 0 : 2), at('bigegg', s * 4.8, -2.6, s < 0 ? 1 : 5), at('bigegg', s * 2.2, -2.6, s < 0 ? 5 : 1)]),
      ...diag('babydino', 0, 0.4, 14, 1, 1.0, 1.0, [0, 2, 3, 1, 0, 4, 5]),
      ...mirror((s) => [at('nest', s * 12.2, 3.0, s < 0 ? 0 : 3), at('digcart', s * 8.8, 3.2, s < 0 ? 2 : 0, 0), at('fossiltile', s * 5.6, 3.0, s < 0 ? 0 : 3), at('stego', s * 2.0, 3.2, s < 0 ? 0 : 5, 0)]),
      ...diag('dinoegg', 0, 5.6, 22, 2, 0.6, 0.6, [5, 1, 0, 2, 3, 4, 6], 0, 2),
      ...mirror((s) => [at('sandpile', s * 12.2, 7.6, s < 0 ? 1 : 0), at('nest', s * 8.6, 7.6, s < 0 ? 2 : 4), at('bigegg', s * 5.4, 7.6, s < 0 ? 3 : 0), at('fossiltile', s * 2.4, 7.6, s < 0 ? 1 : 2)]),
      line('shovel', -12.0, 9.8, 12.0, 9.8, 12, 'cycle', 0),
      line('babydino', -12.0, 11.4, 12.0, 11.4, 13, [0, 3, 1, 4, 0, 2, 5, 3, 0, 1, 4, 2, 0], 0),
      ...diag('sandbucket', 0, 13.2, 22, 1, 1.0, 1.0, P5),
      ...diag('ammonite', 0, 14.8, 16, 2, 0.6, 0.6, P4, 0, 1),
      ...mirror((s) => [line('toybone', s * 2.4, 16.6, s * 6.4, 16.6, 6, 'cycle', 0), grid('brush', s * 8.4, 17.2, 2, 3, 0.8, 0.36, 'cycle')]),
      ...mirror((s) => line('dinoegg', s * 2.0, 18.2, s * 5.6, 18.2, 7, [1, 5, 0, 2, 5, 1, 3])),
    ],
  },
