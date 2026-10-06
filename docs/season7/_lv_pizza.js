
// ------------------------------------------------------------------ tint names (for reading)
// pepperoni: 0 red, 1 orange, 2 pink, 3 brown, 4 maroon      olive: 0 black, 1 green, 2 purple, 3 drab
// mushslice: 0 white, 1 tan, 2 brown, 3 pink                 basil: 0 green, 1 light, 2 dark, 3 lime
// cheese / cheesewheel: 0 yellow, 1 orange, 2 cream, 3 pale  doughball: 0 cream, 1 golden, 2 ivory, 3 brown
// tomato: 0 red, 1 orange, 2 yellow, 3 green                 sodacup: 0 red, 1 blue, 2 green, 3 purple, 4 orange
// pizzaslice / wholepizza: 0 pepperoni, 1 pepper, 2 mushroom, 3 pineapple, 4 olive
// rollingpin: 0 pink, 1 blue, 2 mint, 3 yellow, 4 lilac     pizzabox: 0 red, 1 blue, 2 green, 3 yellow
// scooter: 0 red, 1 blue, 2 green, 3 yellow, 4 pink         pizzaoven: 0 brick, 1 rose, 2 sand, 3 slate
// dinoegg / bigegg / nest: 0 mint, 1 pink, 2 blue, 3 yellow, 4 lilac, 5 peach, 6 white
// babydino / stego / longneck: 0 green, 1 blue, 2 pink, 3 orange, 4 purple, 5 yellow
// toybone: 0 ivory, 1 cream, 2 blush, 3 ice               ammonite: 0 tan, 1 stone, 2 coral, 3 slate
// brush / sandbucket: 0 red, 1 blue, 2 yellow, 3 green, 4 purple    shovel / digcart: 0 red, 1 blue, 2 yellow, 3 green, 4 purple
// fossiltile: 0 sand, 1 lilac, 2 coral, 3 sage   sandpile: 0 gold, 1 peach, 2 pale   digtent: 0 red, 1 blue, 2 green, 3 orange
// gem / biggem: 0 ruby, 1 sapphire, 2 emerald, 3 topaz, 4 amethyst, 5 rose, 6 aqua
// crown: 0 gold, 1 silver, 2 rose gold, 3 pink, 4 lilac      wand: 0 yellow, 1 pink, 2 blue, 3 purple, 4 green
// tinyshield: 0 red, 1 blue, 2 green, 3 purple, 4 orange      potion: 0 pink, 1 blue, 2 green, 3 purple, 4 orange
// toyknight: 0 red, 1 blue, 2 green, 3 purple, 4 orange       chest: 0 red, 1 blue, 2 green, 3 purple, 4 orange
// towerblock / carriage / fairytower / gatehouse: 0 pink, 1 lilac, 2 mint, 3 sky, 4 butter
// throne: 0 pink, 1 blue, 2 mint, 3 purple, 4 coral   dragonplush: 0 green, 1 purple, 2 pink, 3 blue, 4 orange
const PASTEL5 = [0, 1, 2, 3, 4], P5 = [0, 1, 2, 3, 4], P4 = [0, 1, 2, 3], P7 = [0, 1, 2, 3, 4, 5, 6], P6 = [0, 1, 2, 3, 4, 5];
const mirror = (f) => [-1, 1].flatMap((s) => [f(s)].flat());

const LIST = [
  // ======================================================== PIZZA PARLOR
  {
    // Four topping trays with the colors running diagonally (red pepperoni beside maroon
    // and orange, purple olives beside black), cream cheese among pale yellow, and four
    // rolling pins in four different corners.
    id: 106, name: 'Topping Line', world: 'pizza', arena: { w: 24, d: 32 }, time: 170, start: [0, 13.8],
    targets: [{ id: 'pepperoni', n: 'all', tint: 0 }, { id: 'olive', n: 'all', tint: 2 }, { id: 'cheese', n: 'all', tint: 2 }, { id: 'rollingpin', n: 'all' }],
    place: [
      ...mirror((s) => diag('pepperoni', s * 7.4, -11.6, 6, 5, 0.52, 0.52, P5, 0, s < 0 ? 2 : 3)),
      ...mirror((s) => diag('olive', s * 7.4, -4.0, 6, 4, 0.44, 0.44, P4, 0, s < 0 ? 1 : 3)),
      at('wholepizza', 0, -9.0, 0), ring('pizzaslice', 0, -9.0, 8, 2.0, [0, 3, 1, 4, 2, 0, 1, 3]),
      at('rollingpin', -9.6, -14.4, 0), at('rollingpin', 9.6, -0.6, 2), at('rollingpin', -9.6, 6.6, 1), at('rollingpin', 9.6, 14.2, 3),
      ...diag('cheese', 0, -3.8, 8, 3, 0.62, 0.5, P4, 0, 1),
      ...diag('cheese', 0, 1.2, 12, 2, 0.62, 0.5, P4, 0, 2),
      at('cheesewheel', -5.4, 1.2, 2), at('cheesewheel', 5.4, 1.2, 3),
      line('basil', -10.4, 3.6, 10.4, 3.6, 21),
      line('tomato', -6.6, 5.4, 6.6, 5.4, 12),
      line('sodacup', -7.6, 7.6, 7.6, 7.6, 9),
      line('mushslice', -6.0, 9.4, 6.0, 9.4, 13),
      ...diag('pepperoni', 0, 11.2, 10, 2, 0.52, 0.52, P5, 0, 2),
      ...mirror((s) => line('olive', s * 2.4, 12.8, s * 5.6, 12.8, 8, [2, 0, 1, 3, 2, 1, 0, 3])),
      ...mirror((s) => grid('doughball', s * 8.6, 12.0, 3, 3, 0.8)),
      ...mirror((s) => line('mushslice', s * 10.4, -12.0, s * 10.4, -3.0, 10)),
    ],
  },
  {
    // Green-pepper slices hide in four slice fans round GREEN whole pizzas (too big to eat
    // early). Purple soda and yellow tomatoes sit in diagonal color runs; four pizza boxes
    // wait in far corners.
    id: 107, name: 'Slice Shop', world: 'pizza', arena: { w: 24, d: 34 }, time: 180, start: [0, 14.8],
    targets: [{ id: 'pizzaslice', n: 'all', tint: 1 }, { id: 'sodacup', n: 'all', tint: 3 }, { id: 'tomato', n: 'all', tint: 2 }, { id: 'pizzabox', n: 'all' }],
    place: [
      ...[[-6.0, -11.0], [6.0, -11.0], [-6.0, -2.4], [6.0, -2.4]].flatMap(([x, z], k) => [
        at('wholepizza', x, z, 1),
        ring('pizzaslice', x, z, 7, 2.05, [[1, 0, 2, 3, 4, 0, 2], [0, 3, 1, 2, 4, 3, 0], [4, 2, 0, 1, 3, 2, 4], [2, 4, 3, 0, 1, 4, 3]][k]),
      ]),
      at('pizzabox', -9.6, -15.2, 0), at('pizzabox', 9.6, -6.8, 1), at('pizzabox', -9.6, 6.0, 2), at('pizzabox', 9.6, 14.6, 3),
      ...diag('tomato', 0, -6.7, 4, 3, 0.95, 0.95, P4, 0, 1),
      ...diag('tomato', 0, -15.0, 8, 2, 0.95, 0.95, P4, 0, 3),
      ...mirror((s) => line('flour', s * 10.4, -12.4, s * 10.4, -9.2, 2, 'cycle', 0)),
      ...mirror((s) => line('pepperoni', s * 10.4, -4.4, s * 10.4, 2.6, 13)),
      ...diag('sodacup', 0, 2.6, 12, 2, 0.75, 0.75, P5, 0, 2),
      ...diag('cheese', 0, 5.2, 14, 2, 0.62, 0.5, P4, 0, 1),
      line('pizzaslice', -7.0, 7.4, 7.0, 7.4, 8, [3, 1, 0, 4, 2, 1, 3, 0], 0),
      line('basil', -9.0, 9.2, 9.0, 9.2, 19),
      line('mushslice', -8.0, 10.8, 8.0, 10.8, 17),
      ...diag('olive', 0, 12.4, 12, 2, 0.44, 0.44, P4, 0, 1),
      ...mirror((s) => line('pepperoni', s * 2.4, 13.6, s * 6.4, 13.6, 8)),
      ...mirror((s) => grid('doughball', s * 8.4, 12.2, 3, 2, 0.8)),
    ],
  },
  {
    // TWO-STAGE GATE: orange cheese wheels need half the board, then two delivery scooters
    // in opposite corners need most of it. Ivory dough balls hide among cream ones.
    id: 108, name: 'Dough Station', world: 'pizza', arena: { w: 26, d: 36 }, time: 210, start: [0, 15.8],
    targets: [{ id: 'doughball', n: 'all', tint: 2 }, { id: 'flour', n: 'all' }, { id: 'cheesewheel', n: 'all', tint: 1 }, { id: 'scooter', n: 'all' }],
    place: [
      at('scooter', -10.0, -15.8, 0), at('scooter', 10.0, 9.8, 1),
      ...mirror((s) => diag('doughball', s * 7.0, -12.6, 5, 4, 0.82, 0.82, P4, 0, s < 0 ? 1 : 3)),
      at('flour', 0, -13.4, 0), at('flour', 0, -4.6, 1), at('flour', -10.6, -1.0, 2), at('flour', 10.6, -5.6, 3),
      ring('cheesewheel', 0, -4.6, 6, 2.6, [1, 0, 2, 3, 1, 2]),
      ring('mushslice', 0, -4.6, 18, 4.3, 'cycle'),
      ...mirror((s) => [at('cheesewheel', s * 8.4, -6.0, s < 0 ? 3 : 1), at('wholepizza', s * 8.4, -2.0, s < 0 ? 0 : 3)]),
      ...mirror((s) => line('rollingpin', s * 4.6, -9.6, s * 9.6, -9.6, 2, 'cycle', 0)),
      ...mirror((s) => line('basil', s * 11.0, -14.0, s * 11.0, -10.6, 5)),
      ...diag('doughball', 0, 1.6, 12, 2, 0.82, 0.82, P4, 0, 1),
      line('tomato', -10.4, 3.6, 10.4, 3.6, 17),
      ...mirror((s) => [at('pizzabox', s * 9.6, 6.0, s < 0 ? 0 : 2), at('cheesewheel', s * 5.6, 6.0, s < 0 ? 0 : 1)]),
      ...diag('cheese', 0, 6.0, 6, 2, 0.62, 0.5, P4, 0, 1),
      line('pizzaslice', -8.0, 8.4, 6.0, 8.4, 8, 'cycle', 0),
      line('sodacup', -9.6, 10.2, 7.0, 10.2, 12),
      line('mushslice', -8.4, 11.8, 8.4, 11.8, 17),
      ...diag('pepperoni', 0, 13.4, 14, 2, 0.52, 0.52, P5, 0, 2),
      ...mirror((s) => line('olive', s * 2.4, 14.9, s * 6.4, 14.9, 9)),
      ...mirror((s) => grid('doughball', s * 9.6, 14.2, 3, 2, 0.82, 0.82, [0, 1, 3])),
    ],
  },
  {
    // SCARCE FILLER + OPPOSITE CORNERS: the red scooters wait in two far corners with
    // look-alike decoy scooters in between; pizza boxes stack along both sides. The food
    // on the board only just covers the scooters.
    id: 109, name: 'Rush Hour', world: 'pizza', arena: { w: 26, d: 36 }, time: 200, start: [0, 15.8],
    targets: [{ id: 'scooter', n: 'all', tint: 0 }, { id: 'pizzabox', n: 'all' }, { id: 'basil', n: 'all', tint: 0 }, { id: 'mushslice', n: 'all', tint: 1 }],
    place: [
      at('scooter', -9.8, -15.8, 0), at('scooter', 9.8, 2.4, 0), at('scooter', -9.8, 2.4, 1),
      ...mirror((s) => line('pizzabox', s * 10.4, -11.6, s * 10.4, -2.4, 4, 'cycle')),
      ...[[-4.4, -13.6], [4.4, -7.0]].flatMap(([x, z], k) => [at('wholepizza', x, z, k ? 2 : 1), ring('mushslice', x, z, 12, 1.65, [1, 3, 0, 2, 3, 1, 2, 0, 3, 2, 0, 1])]),
      ...[[4.4, -13.6], [-4.4, -7.0]].flatMap(([x, z]) => [at('cheesewheel', x, z, 2), ring('basil', x, z, 9, 1.7, [0, 1, 3, 2, 1, 3, 0, 2, 3], 0)]),
      ...diag('basil', 0, 1.8, 14, 2, 0.62, 0.42, P4, 0, 1),
      ...diag('mushslice', 0, 4.6, 16, 2, 0.56, 0.56, P4, 0, 3),
      ...mirror((s) => at('pizzabox', s * 10.4, 8.2, s < 0 ? 3 : 1)),
      ...diag('olive', 0, 12.6, 6, 2, 0.44, 0.44, P4, 0, 1),
      ...mirror((s) => line('pepperoni', s * 2.4, 15.1, s * 6.4, 15.1, 8)),
    ],
  },
  {
    // CENTERPIECE: the brick pizza oven at the back of the parlor. Pineapple pizzas sit
    // among look-alike slices, red pepperoni hides in color runs, and boxes are stacked
    // in all four corners. The oven needs nearly everything else eaten first.
    id: 110, name: 'Brick Oven', world: 'pizza', arena: { w: 30, d: 40 }, time: 270, start: [0, 17.8],
    targets: [{ id: 'pizzaoven', n: 'all' }, { id: 'wholepizza', n: 'all', tint: 3 }, { id: 'pepperoni', n: 'all', tint: 0 }, { id: 'pizzabox', n: 'all' }],
    place: [
      at('pizzaoven', 0, -15.6, 0),
      ...mirror((s) => [at('scooter', s * 9.4, -17.6, s < 0 ? 1 : 2), at('pizzabox', s * 12.6, -17.4, s < 0 ? 0 : 1), at('pizzabox', s * 12.6, 15.6, s < 0 ? 2 : 3)]),
      ...mirror((s) => line('rollingpin', s * 4.0, -12.2, s * 11.0, -12.2, 3, 'cycle', 0)),
      ...mirror((s) => diag('pepperoni', s * 9.6, -14.6, 6, 3, 0.52, 0.52, P5, 0, s < 0 ? 2 : 3)),
      // two pizza tables: pizzas ringed by slices (pineapple ones among them)
      ...[[-6.4, -6.8], [6.4, -6.8], [0, -1.6]].flatMap(([x, z], k) => [
        at('wholepizza', x, z, [3, 0, 1][k]), ring('pizzaslice', x, z, 7, 2.05, [[3, 0, 1, 3, 2, 4, 0], [1, 3, 4, 0, 3, 2, 1], [2, 4, 3, 0, 1, 3, 4]][k]),
      ]),
      ...mirror((s) => [at('wholepizza', s * 12.4, -6.8, s < 0 ? 2 : 3), at('cheesewheel', s * 12.4, -10.0, s < 0 ? 0 : 1), at('cheesewheel', s * 12.4, -3.6, s < 0 ? 3 : 2)]),
      ...mirror((s) => [at('scooter', s * 8.6, 3.4, s < 0 ? 3 : 4), at('wholepizza', s * 12.4, 0.0, s < 0 ? 3 : 4)]),
      ...diag('cheese', 0, 2.4, 6, 2, 0.62, 0.5, P4, 0, 1),
      ...mirror((s) => line('pizzabox', s * 3.6, 5.0, s * 7.2, 5.0, 3, 'cycle')),
      ...diag('tomato', 0, 7.0, 16, 2, 0.95, 0.95, P4, 0, 1),
      ...mirror((s) => [at('pizzabox', s * 12.6, 7.6, s < 0 ? 1 : 0), at('rollingpin', s * 12.4, 4.4, s < 0 ? 4 : 0, PI / 2)]),
      ...diag('pepperoni', 0, 9.4, 18, 2, 0.52, 0.52, P5, 0, 2),
      ...mirror((s) => [at('wholepizza', s * 4.6, 11.8, s < 0 ? 4 : 3), at('cheesewheel', s * 8.6, 11.6, s < 0 ? 2 : 0), at('scooter', s * 12.2, 11.6, s < 0 ? 3 : 2)]),
      at('pizzaslice', 0, 11.8, 3),
      line('basil', -11.0, 13.8, 11.0, 13.8, 23),
      line('sodacup', -11.0, 15.4, -3.4, 15.4, 9), line('sodacup', 3.4, 15.4, 11.0, 15.4, 9),
      ...diag('olive', 0, 15.2, 10, 2, 0.44, 0.44, P4, 0, 1),
      ...mirror((s) => line('mushslice', s * 2.6, 18.0, s * 8.0, 18.0, 10)),
      ...mirror((s) => grid('doughball', s * 9.6, 17.0, 3, 2, 0.82)),
    ],
  },
