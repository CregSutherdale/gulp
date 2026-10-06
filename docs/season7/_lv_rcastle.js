
  // ======================================================== FAIRY CASTLE
  {
    // PRECISION TINY TARGETS: ruby gems (beside look-alike ROSE gems) are tucked between
    // giant gems she cannot eat yet. Gold crowns in color runs, chests in far corners.
    id: 116, name: 'Gem Vault', world: 'castle', arena: { w: 24, d: 32 }, time: 170, start: [0, 13.8],
    targets: [{ id: 'gem', n: 'all', tint: 0 }, { id: 'crown', n: 'all', tint: 0 }, { id: 'chest', n: 'all' }, { id: 'potion', n: 'all', tint: 1 }],
    place: [
      ...[[-6.0, -10.6], [6.0, -10.6], [0, -5.0], [-6.0, 0.6], [6.0, 0.6]].flatMap(([x, z], k) => [
        at('chest', x, z, k % 5),
        ring('biggem', x, z, 4, 1.75, [[0, 5, 0, 5], [5, 0, 6, 0], [0, 5, 4, 5], [5, 3, 0, 5], [6, 0, 5, 0]][k], 0),
        ring('gem', x, z, 4, 1.75, [[0, 5, 1, 0], [5, 0, 2, 5], [6, 0, 5, 3], [0, 4, 5, 0], [5, 0, 0, 2]][k], 0).map((o) => ({ ...o, x: r3(x + (o.x - x) * 0.75 * Math.SQRT1_2 - (o.z - z) * 0.75 * Math.SQRT1_2), z: r3(z + (o.x - x) * 0.75 * Math.SQRT1_2 + (o.z - z) * 0.75 * Math.SQRT1_2) })),
      ]),
      at('chest', -9.6, -14.2, 1), at('chest', 9.6, 7.6, 3),
      ...mirror((s) => diag('crown', s * 9.2, -6.0, 3, 6, 0.6, 0.6, P5, 0, 2)),
      ...diag('potion', 0, -14.2, 12, 2, 0.55, 0.55, P5, 0, 2),
      ...diag('crown', 0, 4.4, 14, 2, 0.6, 0.6, P5, 0, 3),
      ...diag('gem', 0, 6.2, 18, 2, 0.48, 0.48, P7, 0, 2),
      line('towerblock', -8.0, 8.2, 8.0, 8.2, 9),
      ...diag('potion', 0, 10.0, 16, 2, 0.55, 0.55, P5, 0, 2),
      ...mirror((s) => line('tinyshield', s * 2.4, 12.0, s * 8.0, 12.0, 8, 'cycle', 0)),
      ...mirror((s) => grid('gem', s * 4.0, 13.4, 5, 2, 0.48, 0.48, [5, 1, 3, 6, 4, 2, 5, 3, 1, 4])),
      ...mirror((s) => grid('wand', s * 9.6, 13.6, 2, 3, 0.8, 0.4, 'cycle')),
    ],
  },
  {
    // Knights drill in color ranks (blue among purple and green), purple shields hang in
    // diagonal runs, yellow wands hide among pink ones, four thrones in far corners.
    id: 117, name: 'Knight School', world: 'castle', arena: { w: 24, d: 34 }, time: 180, start: [0, 14.8],
    targets: [{ id: 'toyknight', n: 'all', tint: 1 }, { id: 'tinyshield', n: 'all', tint: 3 }, { id: 'wand', n: 'all', tint: 0 }, { id: 'throne', n: 'all' }],
    place: [
      at('throne', -9.6, -15.0, 0), at('throne', 9.6, -6.4, 1), at('throne', -9.6, 2.4, 3), at('throne', 9.6, 12.8, 4),
      ...diag('toyknight', 0, -12.4, 9, 4, 0.85, 0.85, [3, 1, 2, 0, 1, 4], 0, 2),
      ...mirror((s) => [at('dragonplush', s * 6.6, -6.4, s < 0 ? 0 : 2, 0), ring('wand', s * 6.6, -6.4, 8, 1.9, s < 0 ? [0, 1, 0, 3, 1, 0, 4, 1] : [1, 0, 1, 2, 0, 1, 3, 0])]),
      ...diag('tinyshield', 0, -6.4, 4, 4, 0.6, 0.6, P5, 0, 2),
      ...mirror((s) => line('chest', s * 10.0, -12.2, s * 10.0, -9.0, 3, 'cycle', PI / 2)),
      ...diag('tinyshield', 0, -1.0, 16, 2, 0.6, 0.45, P5, 0, 3),
      ...mirror((s) => [at('biggem', s * 6.0, 2.4, s < 0 ? 1 : 4), ringCam('toyknight', s * 6.0, 2.4, 7, 1.75, s < 0 ? [1, 3, 0, 1, 2, 3, 4] : [3, 1, 4, 2, 1, 0, 3])]),
      line('towerblock', -2.6, 2.4, 2.6, 2.4, 4),
      ...diag('wand', 0, 5.8, 12, 2, 0.8, 0.4, P5, 0, 2),
      ...diag('potion', 0, 7.6, 16, 2, 0.55, 0.55, P5, 0, 1),
      line('toyknight', -9.0, 9.4, 9.0, 9.4, 13, [0, 1, 3, 2, 4, 3, 1, 0, 2, 3, 4, 1, 3], 0),
      ...diag('crown', 0, 11.2, 14, 2, 0.6, 0.6, P5, 0, 2),
      ...mirror((s) => line('gem', s * 2.2, 13.4, s * 7.0, 13.4, 9)),
      ...mirror((s) => line('gem', s * 2.2, 15.2, s * 7.0, 15.2, 9)),
    ],
  },
  {
    // TWO-STAGE GATE: green dragon plushies (purple and blue look-alikes all round) open
    // stage one; two fairy carriages in opposite corners need most of the garden.
    // Aqua gems hide among emerald ones in the flower beds.
    id: 118, name: 'Dragon Garden', world: 'castle', arena: { w: 26, d: 36 }, time: 210, start: [0, 15.8],
    targets: [{ id: 'dragonplush', n: 'all', tint: 0 }, { id: 'gem', n: 'all', tint: 6 }, { id: 'towerblock', n: 'all', tint: 2 }, { id: 'carriage', n: 'all' }],
    place: [
      at('carriage', -9.8, -15.6, 0, 0), at('carriage', 9.8, 8.2, 3, 0),
      ...[[-3.6, -14.8], [3.6, -14.8], [9.6, -14.6], [-9.6, -9.2], [-3.4, -9.4], [3.4, -9.4], [9.6, -9.2]].map(([x, z], k) => at('dragonplush', x, z, [1, 0, 3, 0, 2, 1, 0][k], 0)),
      ...mirror((s) => [at('fairytower', s * 6.6, -3.4, s < 0 ? 1 : 3), ring('gem', s * 6.6, -3.4, 14, 1.8, s < 0 ? [6, 2, 2, 6, 1, 2, 6, 5, 2, 6, 3, 2, 6, 2] : [2, 6, 2, 4, 6, 2, 2, 6, 0, 2, 6, 3, 2, 6])]),
      ...diag('towerblock', 0, -3.4, 3, 3, 1.05, 1.05, PASTEL5, 0, 2),
      ...mirror((s) => line('towerblock', s * 11.2, -6.0, s * 11.2, 1.6, 7, [2, 1, 3, 0, 2, 4, 3])),
      ...diag('gem', 0, 1.6, 20, 2, 0.48, 0.48, [2, 6, 1, 6, 2, 5, 2], 0, 2),
      ...mirror((s) => [at('throne', s * 3.0, 4.4, s < 0 ? 2 : 1), at('biggem', s * 6.4, 4.4, s < 0 ? 6 : 2), at('chest', s * 9.2, 4.4, s < 0 ? 2 : 0, 0)]),
      at('potion', 0, 4.4, 2),
      ...diag('crown', 0, 6.6, 12, 2, 0.6, 0.6, P5, 0, 2),
      line('toyknight', -10.4, 8.4, 5.4, 8.4, 12, 'cycle', 0),
      line('tinyshield', -10.4, 10.0, 5.6, 10.0, 15, 'cycle', 0),
      ...diag('potion', 0, 11.6, 20, 2, 0.55, 0.55, P5, 0, 2),
      line('towerblock', -9.0, 13.4, 9.0, 13.4, 13, [2, 0, 4, 1, 2, 3, 0, 2, 1, 4, 2, 3, 0]),
      ...mirror((s) => line('gem', s * 2.2, 15.0, s * 6.6, 15.0, 9, 'cycle')),
      ...mirror((s) => grid('wand', s * 9.6, 15.4, 2, 3, 0.8, 0.4, 'cycle')),
    ],
  },
  {
    // SCARCE FILLER + OPPOSITE CORNERS: a royal parade of carriages (the pink ones are
    // the target, look-alike lilac ones beside them), fairy towers at the four corners.
    // There is only just enough on the road to grow for the carriages.
    id: 119, name: 'Royal Parade', world: 'castle', arena: { w: 26, d: 36 }, time: 210, start: [0, 15.8],
    targets: [{ id: 'carriage', n: 'all', tint: 0 }, { id: 'fairytower', n: 'all' }, { id: 'crown', n: 'all', tint: 2 }, { id: 'toyknight', n: 'all', tint: 4 }],
    place: [
      at('fairytower', -10.4, -15.4, 1), at('fairytower', 10.4, -15.4, 3), at('fairytower', -10.4, 4.6, 2), at('fairytower', 10.4, 4.6, 4),
      line('carriage', -6.0, -15.0, 6.0, -15.0, 3, [0, 1, 4], 0),
      ...mirror((s) => at('carriage', s * 9.6, -5.4, s < 0 ? 1 : 0, 0)),
      ...path('toyknight', (t) => [-7.0 + 14.0 * t, -10.4 + 0.6 * Math.sin(t * TAU)], 0.9, [4, 0, 1, 4, 2, 3, 0, 4, 1]),
      ...diag('crown', 0, -6.0, 8, 3, 0.6, 0.6, [2, 3, 0, 1, 4], 0, 2),
      ...mirror((s) => [at('dragonplush', s * 4.4, -1.0, s < 0 ? 2 : 4, 0), at('throne', s * 10.2, -1.0, s < 0 ? 0 : 2)]),
      ...diag('tinyshield', 0, 1.6, 12, 2, 0.6, 0.45, P5, 0, 2),
      ...diag('crown', 0, 9.0, 12, 2, 0.6, 0.6, [2, 3, 1, 0, 4], 0, 1),
      line('toyknight', -6.0, 10.8, 6.0, 10.8, 9, [4, 0, 3, 4, 1, 2, 4, 0, 3], 0),
      ...mirror((s) => line('potion', s * 2.4, 13.4, s * 7.0, 13.4, 8)),
      ...mirror((s) => grid('gem', s * 9.6, 14.8, 3, 2, 0.48, 0.48, 'cycle')),
      ...mirror((s) => line('gem', s * 2.2, 15.0, s * 6.2, 15.0, 7)),
    ],
  },
  {
    // THE GRAND FINALE: the pastel castle, the last level of the game. Four fairy towers
    // stand at the far corners of the grounds, amethysts hide among lilac look-alikes,
    // blue knights in every rank. The castle needs nearly the whole board eaten first.
    id: 120, name: 'Pastel Castle', world: 'castle', arena: { w: 32, d: 42 }, time: 300, start: [0, 18.8],
    targets: [{ id: 'castle', n: 'all' }, { id: 'fairytower', n: 'all' }, { id: 'gem', n: 'all', tint: 4 }, { id: 'toyknight', n: 'all', tint: 1 }],
    place: [
      at('castle', 0, -16.6, 0),
      ...mirror((s) => [at('fairytower', s * 13.2, -18.2, s < 0 ? 1 : 3), at('fairytower', s * 13.2, 8.4, s < 0 ? 2 : 0)]),
      ...mirror((s) => [at('gatehouse', s * 7.4, -10.6, s < 0 ? 0 : 1), at('carriage', s * 8.0, -16.6, s < 0 ? 4 : 2, 0), at('throne', s * 13.4, -12.6, s < 0 ? 1 : 3)]),
      at('gatehouse', 0, -5.0, 2),
      ...mirror((s) => [at('dragonplush', s * 5.6, -6.6, s < 0 ? 0 : 3, 0), at('biggem', s * 10.4, -6.0, s < 0 ? 4 : 1), at('chest', s * 13.4, -7.2, s < 0 ? 1 : 2, PI / 2)]),
      ...mirror((s) => ringCam('toyknight', s * 10.4, -6.0, 8, 1.55, s < 0 ? [1, 3, 0, 1, 4, 2, 1, 3] : [3, 1, 2, 4, 1, 0, 3, 1])),
      ...mirror((s) => [at('gatehouse', s * 9.4, 0.8, s < 0 ? 3 : 4), at('carriage', s * 3.4, 0.6, s < 0 ? 1 : 3, 0)]),
      ...diag('gem', 0, -1.8, 22, 2, 0.48, 0.48, [4, 5, 1, 4, 0, 3, 4, 6, 2], 0, 2),
      ...mirror((s) => [at('throne', s * 13.4, 3.6, s < 0 ? 4 : 0), at('biggem', s * 6.0, 3.8, s < 0 ? 4 : 1), at('dragonplush', s * 9.6, 4.4, s < 0 ? 1 : 2, 0), at('chest', s * 2.4, 3.8, s < 0 ? 0 : 4, 0)]),
      ...diag('towerblock', 0, 6.0, 12, 1, 1.0, 1.0, PASTEL5),
      ...mirror((s) => [at('carriage', s * 9.4, 8.4, s < 0 ? 0 : 2, 0), at('throne', s * 5.2, 8.4, s < 0 ? 3 : 1), at('biggem', s * 2.2, 8.4, s < 0 ? 5 : 4)]),
      ...diag('toyknight', 0, 10.6, 18, 2, 0.85, 0.85, [1, 3, 0, 2, 1, 4], 0, 2),
      ...mirror((s) => [at('dragonplush', s * 12.6, 11.6, s < 0 ? 4 : 0, 0), at('chest', s * 12.6, 13.4, s < 0 ? 3 : 1, 0)]),
      ...diag('crown', 0, 12.8, 20, 2, 0.6, 0.6, P5, 0, 2),
      ...diag('potion', 0, 14.6, 24, 2, 0.55, 0.55, P5, 0, 1),
      ...mirror((s) => [line('tinyshield', s * 10.0, 16.6, s * 14.0, 16.6, 7, 'cycle', 0), grid('wand', s * 12.0, 18.4, 4, 3, 0.8, 0.4, 'cycle')]),
      ...diag('gem', 0, 16.4, 16, 2, 0.48, 0.48, [4, 1, 5, 4, 3, 6, 4, 2, 0], 0, 3),
      ...mirror((s) => line('gem', s * 2.2, 18.6, s * 7.4, 18.6, 11, 'cycle')),
    ],
  },
