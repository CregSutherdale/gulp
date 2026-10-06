
// ============================================================== PIZZA PARLOR
// The board is a marble counter top in a little pizza parlor: honey wood round the
// marble, the counter drops to a red-and-cream tiled floor, a brick wall at the back
// with a chalk menu, pendant lamps and shelves; toppings, jars and boxes on the counter.
function PIZZA(K) {
  const { hw, hd, ns } = K;
  const FL = -8, TOP = 22;
  const X0 = hw + 0.5, Z0 = hd + 0.5, TX = hw + 9.5, TZN = hd + 5 + 2 * ns, TZF = -(hd + 10);
  const BZ = -(hd + 14), RX = hw + 15;
  K.floorY = FL; K.shadow = 0x5a3a26;
  const G = K.glossy, M = K.matte, U = K.under;
  const EDGE = 0xb5784a, BRICKS = [0xd9714e, 0xcf6646, 0xe07d58, 0xc95f40];

  // counter top (wood) round the marble, an edge and a red-painted front down to the floor
  const top = [
    rectXZ(-TX, TX, Z0, TZN, 0, 0xffffff, 10, 2), rectXZ(-TX, TX, TZF, -Z0, 0, 0xffffff, 10, 3),
    rectXZ(X0, TX, -Z0, Z0, 0, 0xffffff, 3, 10), rectXZ(-TX, -X0, -Z0, Z0, 0, 0xffffff, 3, 10),
  ];
  recolor(top, (x, y, z, c) => c.multiplyScalar(0.86 + 0.14 * smooth(TX, TX - 3, Math.abs(x)) * smooth(TZN, TZN - 2, z)));
  K.meshes.push(texMesh(top, planksTex(K.R, 30, 48, 66), 13, { patched: true, name: 'counter' }));
  U.push(rbox(2 * TX + 0.2, 0.9, 1.1, EDGE, 0, -0.91, TZN - 0.5, 0.3), rbox(2 * TX + 0.2, 0.9, 1.1, EDGE, 0, -0.91, TZF + 0.5, 0.3));
  for (const s of [-1, 1]) U.push(rbox(1.1, 0.9, TZN - TZF, EDGE, s * (TX - 0.5), -0.91, (TZN + TZF) / 2, 0.3));
  const front = boxS(2 * TX - 1, -0.9 - FL, 0.6, 0xc8553d, 0, FL, TZN - 0.9, 8, 4, 1);
  shadeY(front, FL, -1, 0.7, 1.0);
  U.push(front);
  for (let i = 0; i < 6; i++) U.push(box(0.12, -1.2 - FL - 0.6, 0.1, 0xfff0d4, -TX + 1.5 + i * ((2 * TX - 3) / 5), FL + 0.3, TZN - 0.58));
  U.push(box(2 * TX - 1, 0.3, 0.2, 0xfff0d4, 0, -1.6, TZN - 0.55), box(2 * TX - 1, 0.6, 0.7, 0x6a3a2a, 0, FL, TZN - 0.6));

  // red-and-cream tiled floor and the brick back wall with a cream band
  K.meshes.push(texMesh([rectXZ(-RX, RX, BZ, hd + 70, FL, 0xffffff)], checkerTex(K.R, '#f2d9c4', '#e05a4a'), 4, { name: 'floor' }));
  K.blob(0, FL + 0.08, TZN + 0.4, TX + 0.5, 1.2, 0.5);
  const wall = boxS(2 * RX + 2, TOP - FL, 1, BRICKS[0], 0, FL, BZ - 0.5, 24, 30, 1);
  recolor(wall, (x, y, z, c) => {
    const row = Math.floor((y - FL) / 0.75), col = Math.floor((x + RX + (row % 2) * 0.8) / 1.6);
    c.set(BRICKS[(row * 7 + col * 3) % 4]); c.multiplyScalar(0.8 + 0.22 * clamp01((y - FL) / (TOP - FL)));
  });
  M.push(wall, box(2 * RX, 3.2, 0.3, 0xfff0d4, 0, FL, BZ + 0.15));
  G.push(box(2 * RX, 0.3, 0.45, 0x6a3a2a, 0, FL + 3.2, BZ + 0.22));
  for (const s of [-1, 1]) {
    const sw = boxS(1, TOP - FL, hd + 30 - BZ, 0xf3e3cf, s * (RX + 0.5), FL, (hd + 30 + BZ) / 2, 1, 8, 1);
    shadeY(sw, FL, TOP, 0.74, 0.96);
    M.push(sw, box(0.3, 3.2, hd + 30 - BZ, 0xc8553d, s * (RX - 0.15), FL, (hd + 30 + BZ) / 2));
  }
  // chalk menu board, a round clock and two shelves of jars and pizza boxes
  const mw = Math.min(10, hw * 0.85);
  G.push(rbox(mw + 0.8, 5.2, 0.3, 0x8a5a36, 0, 3.6, BZ + 0.2, 0.15), box(mw, 4.4, 0.1, 0x2f3a36, 0, 4.0, BZ + 0.4));
  K.lit.push(...[0, 1, 2, 3].map((i) => box(mw * (0.55 - i * 0.07), 0.16, 0.02, 0xf4f1e8, -mw * 0.12, 7.4 - i * 0.9, BZ + 0.46)));
  K.lit.push(...[0, 1, 2, 3].map((i) => box(0.7, 0.16, 0.02, 0xffd36e, mw * 0.36, 7.4 - i * 0.9, BZ + 0.46)));
  K.lit.push(disc(0.45, 0xff7a6a, mw * 0.36, 0, 0, 12).rotateX(PI / 2).translate(0, 4.4, BZ + 0.47));
  const ck = mw / 2 + 3.2;
  G.push(cyl(1.3, 1.3, 0.25, 0xfff6e8, ck, 0, BZ + 0.2, 20, PI / 2).translate(0, 9.4, 0), torus(1.3, 0.12, 0xc8553d, ck, 9.4, BZ + 0.35, 0, 20));
  G.push(box(0.12, 0.8, 0.05, INK, ck, 9.4, BZ + 0.36), box(0.6, 0.12, 0.05, INK, ck + 0.25, 9.4, BZ + 0.36));
  for (const s of [-1, 1]) {
    const sx = s * (mw / 2 + 4.6);
    for (const sy of [4.2, 7.4]) {
      G.push(box(5.4, 0.25, 1.4, 0xb5784a, sx, sy, BZ + 0.75));
      if (sy < 5) for (let i = 0; i < 4; i++) K.add([cyl(0.45, 0.45, 1.2, 0xe8f4ff, 0, 0, 0, 12), cyl(0.48, 0.48, 0.25, K.pick([0xe0403a, 0xffd23f, 0x5fd16a]), 0, 1.2, 0, 12), cyl(0.38, 0.38, 0.8, K.pick([0xfff3d6, 0xe8473c, 0x7bc96f, 0xffd8a0]), 0, 0.1, 0, 10)], sx - 1.8 + i * 1.2, sy + 0.25, BZ + 0.75);
      else for (let i = 0; i < 3; i++) K.add([rbox(1.5, 0.3, 1.2, i % 2 ? 0xfff6e8 : 0xe05a4a, 0, 0, 0, 0.04), rbox(1.5, 0.3, 1.2, i % 2 ? 0xe05a4a : 0xfff6e8, 0, 0.32, 0, 0.04)], sx - 1.6 + i * 1.6, sy + 0.25, BZ + 0.75);
    }
  }
  // pendant lamps over the counter, glowing warm
  const LZ = -(hd + 4.5);
  for (const lx of [-hw * 0.55, 0, hw * 0.55]) {
    G.push(rod([lx, TOP, LZ], [lx, 9.6, LZ], 0.04, 0.04, INK, 4), lathe([[0.15, 0], [1.1, -0.9], [1.15, -1.05], [0.15, -0.35]], 0xc8553d, 16, lx, 9.6, LZ));
    K.lit.push(ballC(0.32, 0xfff1c4, lx, 8.6, LZ, 1));
    K.halos.push([lx, 8.5, LZ + 0.5, 2.4, 1.8, 0.4, 0xffc46b, true]);
  }

  // on the counter, far side: a tomato-can tower, a flour bin, a basil pot, stacked boxes
  const cans = [[0, 0, 0], [1.25, 0, 0], [0.62, 1.5, 0]];
  const can = (lab) => [cyl(0.6, 0.6, 1.4, 0xd8dee6, 0, 0, 0, 14), cyl(0.62, 0.62, 0.8, lab, 0, 0.3, 0, 14), cyl(0.62, 0.62, 0.12, 0xfff6e8, 0, 0.52, 0, 14), ballC(0.22, 0xe0403a, 0, 0.75, 0.55, 1)];
  const cx0 = -(hw * 0.6 + 1.5), cz0 = -(hd + 4.6);
  cans.forEach(([dx, dy]) => K.add(can(0xe8473c), cx0 + dx, dy, cz0));
  K.blob(cx0 + 0.6, 0.02, cz0, 2.0, 1.2, 0.4);
  K.add([lathe([[0, 0], [1.0, 0], [1.1, 1.8], [0, 1.8]], 0xfaf3e6, 16), lathe([[0, 0], [1.15, 0], [1.1, 0.25], [0.3, 0.5], [0, 0.5]], 0xc8553d, 16, 0, 1.8), ballC(0.2, 0xc8553d, 0, 2.5, 0, 1)], hw * 0.2 + 1.5, 0, -(hd + 4.2));
  K.blob(hw * 0.2 + 1.5, 0.02, -(hd + 4.2), 1.5, 1.4, 0.4);
  const basil = [lathe([[0, 0], [0.7, 0], [0.9, 1.0], [0, 1.0]], 0xd9714e, 12)];
  for (let i = 0; i < 9; i++) { const a = i * 2.4, d = 0.2 + (i % 3) * 0.22; basil.push(egg(0.35, 0.12, 0.22, 0x3fae4a, Math.cos(a) * d, 1.2 + (i % 2) * 0.25, Math.sin(a) * d, 8, 4)); }
  K.add(shadeY(basil, 0, 1.6, 0.75, 1.1), hw * 0.62 + 2.5, 0, -(hd + 5.4));
  K.blob(hw * 0.62 + 2.5, 0.02, -(hd + 5.4), 1.3, 1.2, 0.4);
  K.add([rbox(2.4, 0.4, 2.4, 0xe05a4a, 0, 0, 0, 0.06), rbox(2.4, 0.4, 2.4, 0xfff6e8, 0.05, 0.42, 0, 0.06), rbox(2.4, 0.4, 2.4, 0xe05a4a, -0.04, 0.84, 0, 0.06), disc(0.7, 0xffd23f, 0, 1.25, 0, 14)], -(hw * 0.15 + 1), 0, -(hd + 6.6), 0.15);
  K.blob(-(hw * 0.15 + 1), 0.02, -(hd + 6.6), 1.9, 1.9, 0.4);

  // the sides: a big pizza on a board with a cutter wheel; a cheese block and grater
  const pz = (r) => {
    const p = [lathe([[0, 0], [r, 0], [r + 0.1, 0.15], [r - 0.1, 0.25], [0, 0.18]], 0xe2a95e, 24), disc(r - 0.15, 0xe8473c, 0, 0.2, 0, 24), disc(r - 0.3, 0xffe9a6, 0, 0.22, 0, 24)];
    for (let i = 0; i < 12; i++) { const a = i * 2.4, d = (r - 0.6) * Math.sqrt((i + 0.5) / 12); p.push(disc(0.22, i % 3 ? 0xe0403a : 0x3fae4a, Math.cos(a) * d, 0.24, Math.sin(a) * d, 10)); }
    return p;
  };
  const bx = -(hw + 4.8);
  K.add([cyl(2.6, 2.6, 0.2, 0xd39a5e, 0, 0, 0, 24), box(1.2, 0.2, 0.6, 0xd39a5e, 2.9, 0, 0), ...put(pz(2.2), 0, 0.2, 0)], bx, 0, hd * 0.35, 0.3);
  K.blob(bx, 0.02, hd * 0.35, 2.9, 2.8, 0.42);
  K.add([cyl(0.8, 0.8, 0.12, 0xdfe6ef, 0, 0.6, 0, 18, PI / 2), cyl(0.2, 0.2, 0.3, INK, 0, 0.6, 0, 8, PI / 2), rod([0, 0.6, 0], [1.6, 0.4, 0], 0.15, 0.15, 0xc8553d, 8)], bx + 1.0, 0, -hd * 0.25, -0.5);
  K.blob(bx + 1.6, 0.02, -hd * 0.25, 1.6, 0.8, 0.3, -0.5);
  const gx = hw + 4.6;
  K.add([box(2.4, 1.4, 1.6, 0xffd23f, 0, 0, 0), box(0.8, 1.4, 1.6, 0xffe680, 1.6, 0, 0, 0.3)], gx, 0, hd * 0.25, -0.2);
  K.blob(gx + 0.5, 0.02, hd * 0.25, 2.2, 1.4, 0.4, -0.2);
  K.add([box(1.4, 2.6, 0.9, 0xdfe6ef, 0, 0, 0), box(1.0, 0.3, 0.2, INK, 0, 2.6, 0)], gx + 0.4, 0, -hd * 0.35, 0.3);
  K.blob(gx + 0.4, 0.02, -hd * 0.35, 1.2, 0.9, 0.4);
  K.add([cyl(0.9, 1.1, 1.2, 0xfaf3e6, 0, 0, 0, 14), egg(0.8, 0.4, 0.8, 0xfffaf2, 0, 1.2, 0, 12, 6)], gx + 1.4, 0, -hd * 0.8);
  K.blob(gx + 1.4, 0.02, -hd * 0.8, 1.4, 1.3, 0.4);
  for (const [x, z] of [[-(hw + 3.2), -hd * 0.7], [hw + 3.2, hd * 0.65]]) K.add([cyl(0.7, 0.7, 0.9, 0xe8f4ff, 0, 0, 0, 12), cyl(0.72, 0.72, 0.2, 0xc8553d, 0, 0.9, 0, 12), cyl(0.6, 0.6, 0.6, 0x9a5a3a, 0, 0.1, 0, 10)], x, 0, z);

  // near strip (seen at every start): flat flour dust, basil leaves, a pizza cutter
  const nz = (hd + 1.2 + TZN) / 2, dots = [];
  for (let i = 0; i < 40; i++) dots.push([K.rnd(-hw - 3, hw + 3), 0.015, K.rnd(hd + 1.2, TZN - 1.1), K.rnd(0.2, 0.7), 0xfdf8ef, 8, 1, K.rnd(0.6, 1)]);
  for (let i = 0; i < 10; i++) dots.push([K.rnd(-hw, hw), 0.03, K.rnd(hd + 1.4, TZN - 1.2), 0.22, 0x3fae4a, 6, 1.8, 1, K.R() * PI]);
  K.flat.push(discBatch(dots));
  K.add([cyl(0.6, 0.6, 0.08, 0xdfe6ef, 0, 0, 0, 16), rod([0, 0.08, 0], [1.6, 0.12, 0.3], 0.12, 0.12, 0xc8553d, 8)], -hw * 0.5, 0, nz, 0.4, ns);
  K.add(pz(1.1), hw * 0.5, 0, nz, 0, ns);
  K.blob(hw * 0.5, 0.02, nz, 1.3 * ns, 1.3 * ns, 0.3);
}
function checkerTex(R, a, b) {
  return canvasTex(128, (x, s) => {
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { x.fillStyle = (i + j) % 2 ? a : b; x.fillRect(i * s / 2, j * s / 2, s / 2, s / 2); }
    x.strokeStyle = 'rgba(255,255,255,0.4)'; x.lineWidth = 2;
    for (let k = 0; k <= 2; k++) { x.beginPath(); x.moveTo(k * s / 2, 0); x.lineTo(k * s / 2, s); x.stroke(); x.beginPath(); x.moveTo(0, k * s / 2); x.lineTo(s, k * s / 2); x.stroke(); }
    speckle(x, s, R, 6);
  });
}

// ============================================================== DINO DIG
// A toy dig site in a sunny jungle clearing: a sand apron with rope posts round the dig,
// palms and ferns, big round boulders, a striped tent and a toy volcano far behind, and
// a friendly longneck statue peeking over the trees.
function DINO(K) {
  const { hw, hd, ns } = K;
  K.shadow = 0x5a6a3a;
  const G = K.glossy, M = K.matte;
  const X0 = hw + 0.5, Z0 = hd + 0.5, SB = 3.2, SX = X0 + SB, SZ = Z0 + SB;
  const dots = [];
  // sand apron round the dig (flat), with a rope fence on posts
  K.flat.push(rectXZ(-SX, SX, Z0, SZ, 0.02, 0xe6c58e), rectXZ(-SX, SX, -SZ, -Z0, 0.02, 0xe6c58e), rectXZ(X0, SX, -Z0, Z0, 0.02, 0xe6c58e), rectXZ(-SX, -X0, -Z0, Z0, 0.02, 0xe6c58e));
  for (let i = 0; i < 160; i++) { const [x, z] = K.around(0.6, SB - 0.3, SB - 0.3); dots.push([x, 0.03, z, K.rnd(0.08, 0.2), K.pick([0xd4ad72, 0xf0d6a0, 0xc99a60]), 5]); }
  // jungle grass beyond, darker patches and little flowers
  for (let i = 0; i < 50; i++) { const [x, z] = K.around(SB + 1.5, 30, 20); dots.push([x, 0.01 + (i % 3) * 0.01, z, K.rnd(1.6, 4.2), K.pick([0x7cc25e, 0x8fcf6a, 0x6fb655, 0x9ad877]), 12, 1, K.rnd(0.6, 1), K.R() * PI]); }
  for (let i = 0; i < 90; i++) { const [x, z] = K.around(SB + 1.2, 26, 18); dots.push([x, 0.08, z, 0.14, K.pick([0xffffff, 0xffe066, 0xff9fc8]), 5]); }
  const ropePosts = [];
  const RX = SX - 0.6, RZ = SZ - 0.6, nx = Math.max(4, Math.round(RX / 3.2)), nzp = Math.max(4, Math.round(RZ / 3.2));
  for (let i = -nx; i <= nx; i++) ropePosts.push([(i / nx) * RX, -RZ]);
  for (let j = -nzp + 1; j < nzp; j++) ropePosts.push([-RX, (j / nzp) * RZ], [RX, (j / nzp) * RZ]);
  for (const [x, z] of ropePosts) { G.push(cyl(0.16, 0.18, 1.2, 0xb07a4a, x, 0, z, 6), ballC(0.2, 0xff7a5a, x, 1.3, z, 0)); K.blob(x, 0.03, z, 0.35, 0.35, 0.3); }
  for (let i = -nx; i < nx; i++) swag(G, [(i / nx) * RX, 1.05, -RZ], [((i + 1) / nx) * RX, 1.05, -RZ], 0.25, 0xfff0c8, 0.04, 4);
  for (const s of [-1, 1]) for (let j = -nzp + 1; j < nzp - 1; j++) swag(G, [s * RX, 1.05, (j / nzp) * RZ], [s * RX, 1.05, ((j + 1) / nzp) * RZ], 0.25, 0xfff0c8, 0.04, 4);

  // the toy volcano and a longneck statue far behind; palms and boulders round the clearing
  const vz = -(hd + 30), vx = -Math.min(hw * 0.4, 6);
  const vol = [lathe([[16, 0], [12, 5], [7.5, 11], [4.2, 15.5], [3.2, 16.3], [2.4, 15.8]], 0xa8735a, 20)];
  shadeY(vol, 0, 16, 0.7, 1.08);
  for (const a of [0.2, -0.6, 0.9]) vol.push(rod([Math.sin(a) * 3, 16, Math.cos(a) * 3], [Math.sin(a) * 11, 6, Math.cos(a) * 11], 0.9, 1.4, 0xff7a2e, 6));
  vol.push(egg(2.8, 0.8, 2.8, 0xffb03a, 0, 16.2, 0, 12, 5), egg(3.6, 2.4, 3.0, 0xfffaf4, 1.0, 20, -0.5, 10, 6), egg(2.6, 1.8, 2.2, 0xfffaf4, 3.8, 22.6, -1.0, 10, 6));
  K.add(vol, vx, 0, vz);
  K.halos.push([vx, 16.5, vz + 4, 5, 2.4, 0.35, 0xff9a3a, true]);
  const ln = [egg(3.4, 2.2, 2.2, 0x7bd99a, 0, 5.4, 0, 14, 8), rod([2.2, 6.0, 0], [5.2, 12.5, 0], 1.1, 0.7, 0x7bd99a, 10), egg(1.4, 0.95, 1.0, 0x7bd99a, 5.7, 13.0, 0, 12, 8), rod([-2.8, 5.6, 0], [-6.8, 1.8, 0], 1.0, 0.25, 0x7bd99a, 8)];
  for (const [x, z] of [[-1.6, -1.0], [-1.6, 1.0], [1.6, -1.0], [1.6, 1.0]]) ln.push(cyl(0.75, 0.8, 3.6, 0x7bd99a, x, 0, z, 10));
  for (const [x, y] of [[-1.2, 7.3], [0.6, 7.5], [-2.4, 6.6]]) ln.push(egg(0.6, 0.3, 0.6, 0xc8f0d4, x, y, 0.8, 8, 4));
  ln.push(ballC(0.16, INK, 6.4, 13.3, 0.85, 1), ballC(0.16, INK, 6.4, 13.3, -0.85, 1));
  K.add(shadeY(ln, 0, 14, 0.75, 1.08), Math.max(hw * 0.55, 6) + 4, 0, -(hd + 15), -0.5);
  K.blob(Math.max(hw * 0.55, 6) + 4, 0.03, -(hd + 15), 5.5, 3.5, 0.4, -0.5);
  const palm = (h, lean) => {
    const p = [];
    for (let i = 0; i < 6; i++) { const t0 = i / 6, t1 = (i + 1) / 6; p.push(rod([lean * t0 * t0 * h, t0 * h, 0], [lean * t1 * t1 * h, t1 * h, 0], 0.42 - t0 * 0.15, 0.4 - t1 * 0.15, i % 2 ? 0xb07a4a : 0x9a6a3e, 7)); }
    const tx = lean * h;
    for (let i = 0; i < 7; i++) { const a = (i / 7) * TAU; p.push(egg(2.6, 0.18, 0.7, i % 2 ? 0x4fb84a : 0x3fa648, tx + Math.cos(a) * 2.0, h - 0.4, Math.sin(a) * 2.0, 8, 4).rotateY(0)); }
    for (const p2 of p.slice(6)) { p2.computeBoundingBox(); }
    p.push(ballC(0.45, 0x8a5a2a, tx + 0.3, h - 0.5, 0.2, 1), ballC(0.45, 0x8a5a2a, tx - 0.2, h - 0.6, -0.35, 1));
    return p;
  };
  const spots = [[-(hw + 8), -(hd + 6), 13, 0.12], [-(hw + 6.5), hd * 0.1, 10, -0.1], [hw + 7, -(hd + 4), 12, -0.1], [hw + 8.5, hd * 0.3, 9, 0.1], [-(hw + 12), -(hd * 0.5), 11, 0.08], [hw + 12, -hd * 0.6, 11, -0.08], [-hw * 0.2, -(hd + 11), 12, 0.05], [hw * 0.3 + 3, -(hd + 8), 9, -0.06]];
  for (const [x, z, h, l] of spots) { K.add(palm(h, l), x, 0, z, K.R() * TAU); K.blob(x, 0.03, z, 2.4, 2.4, 0.38); }
  for (let i = 0; i < 14; i++) {
    const [x, z] = K.around(SB + 2.5, 16, 6);
    if (z > hd + SB + 3) continue;
    const r = K.rnd(1.0, 2.4);
    K.add(shadeY([egg(r, r * 0.7, r * 0.9, K.pick([0xb8ada0, 0xa89c90, 0xc4b8aa]), 0, r * 0.45, 0, 10, 6)], 0, r * 1.2, 0.72, 1.08), x, 0, z, K.R() * TAU);
    K.blob(x, 0.03, z, r * 1.2, r * 1.0, 0.35);
  }
  for (let i = 0; i < 26; i++) {
    const [x, z] = K.around(SB + 1.6, 20, 4);
    const f = [];
    for (let k = 0; k < 6; k++) { const a = (k / 6) * TAU + K.R(); f.push(egg(1.0, 0.12, 0.3, K.pick([0x4fb84a, 0x5fc85a, 0x3fa648]), Math.cos(a) * 0.8, 0.6, Math.sin(a) * 0.8, 6, 3)); }
    K.add(f, x, 0, z, K.R() * TAU, K.rnd(0.8, 1.4));
  }
  // a striped dig tent on the left, crates and a sieve on the right (outside the posts)
  const tx = -(SX + 5.5), tz = -hd * 0.45;
  const roof = new THREE.ConeGeometry(4.2, 2.4, 4, 1).rotateY(PI / 4).translate(0, 5.6, 0);
  const rp = [];
  { const g = roof.toNonIndexed(), P = g.attributes.position; for (let i = 0; i < P.count; i += 3) { const cxm = (P.getX(i) + P.getX(i + 1) + P.getX(i + 2)) / 3, czm = (P.getZ(i) + P.getZ(i + 1) + P.getZ(i + 2)) / 3; rp.push(Math.floor(((Math.atan2(cxm, czm) + PI) / TAU) * 16) % 2); } }
  K.add([custom(roof, 0xff7a6a), ...[[-2.6, -2.6], [2.6, -2.6], [-2.6, 2.6], [2.6, 2.6]].map(([x, z]) => cyl(0.12, 0.12, 4.4, 0xb07a4a, x, 0, z, 6)), rbox(3.0, 1.0, 1.6, 0xd39a5e, 0, 0, 0, 0.06), box(1.6, 0.05, 1.0, 0xfff3d0, 0, 1.0, 0)], tx, 0, tz, 0.3);
  K.blob(tx, 0.03, tz, 3.8, 3.8, 0.4);
  const cx = SX + 4.6;
  K.add([rbox(1.6, 1.2, 1.4, 0xb07a4a, 0, 0, 0, 0.06), rbox(1.3, 1.0, 1.2, 0xd39a5e, 0.2, 1.2, 0, 0.06), cyl(1.0, 1.0, 0.3, 0xd39a5e, 2.2, 0, 0.6, 16), egg(0.8, 0.2, 0.8, 0xe6c58e, 2.2, 0.32, 0.6, 10, 4)], cx, 0, -hd * 0.1, -0.3);
  K.blob(cx + 0.8, 0.03, -hd * 0.1, 2.4, 1.6, 0.4);

  // near side (low): toy buckets and a shovel on the sand, bones and pebbles
  const nz = hd + SB + 2.4 * ns;
  K.add([lathe([[0, 0], [0.5, 0], [0.62, 0.9], [0, 0.9]], 0xff7a8a, 12), torus(0.62, 0.05, 0xff9fb0, 0, 0.9, 0)], -hw * 0.45, 0, nz, 0, ns);
  K.add([lathe([[0, 0], [0.5, 0], [0.62, 0.9], [0, 0.9]], 0x5cc8ff, 12), torus(0.62, 0.05, 0x8fd8ff, 0, 0.9, 0)], hw * 0.55, 0, nz + 0.8, 0, ns);
  K.add([rod([0, 0.08, 0], [1.6, 0.08, 0], 0.07, 0.07, 0xffd23f, 6), box(0.8, 0.08, 0.7, 0xffd23f, 1.9, 0.04, 0)], -hw * 0.1, 0, nz + 1.4, 0.4, ns);
  for (const [x, z] of [[-hw * 0.45, nz], [hw * 0.55, nz + 0.8]]) K.blob(x, 0.03, z, 0.8 * ns, 0.8 * ns, 0.3);
  for (let i = 0; i < 8; i++) K.add([rod([-0.35, 0.08, 0], [0.35, 0.08, 0], 0.07, 0.07, 0xfff4dc, 6), ballC(0.1, 0xfff4dc, -0.4, 0.1, 0.06, 0), ballC(0.1, 0xfff4dc, -0.4, 0.1, -0.06, 0), ballC(0.1, 0xfff4dc, 0.4, 0.1, 0.06, 0), ballC(0.1, 0xfff4dc, 0.4, 0.1, -0.06, 0)], K.rnd(-hw - 6, hw + 6), 0, K.rnd(hd + SB + 1.5, hd + SB + 12), K.R() * TAU);
  K.flat.push(discBatch(dots));
  cloudLayer(K, [[-20, 26, -(hd + 40), 4], [6, 30, -(hd + 46), 5], [26, 24, -(hd + 38), 3.6], [-34, 22, -(hd + 30), 3.4]], 60);
}

// ============================================================== FAIRY CASTLE
// A fairy-tale courtyard: a stone path round the board, hedges and flower beds, round
// pastel trees, a big pastel castle on the hill behind with towers and flags, a rainbow,
// soft clouds; little lanterns and flowers on the near side.
function CASTLE(K) {
  const { hw, hd, ns } = K;
  K.shadow = 0x4a6a4a;
  const G = K.glossy;
  const X0 = hw + 0.5, Z0 = hd + 0.5, PB = 2.6, PX = X0 + PB, PZ = Z0 + PB;
  const dots = [], STONE = [0xf3eefc, 0xe9e2f7, 0xfaf6ff, 0xe2dbf2];
  K.flat.push(rectXZ(-PX, PX, Z0, PZ, 0.02, 0xd8cfe8), rectXZ(-PX, PX, -PZ, -Z0, 0.02, 0xd8cfe8), rectXZ(X0, PX, -Z0, Z0, 0.02, 0xd8cfe8), rectXZ(-PX, -X0, -Z0, Z0, 0.02, 0xd8cfe8));
  for (let z = -PZ + 0.5, row = 0; z < PZ; z += 0.95, row++) for (let x = -PX + 0.5 + (row % 2) * 0.47; x < PX; x += 0.95) {
    if (Math.abs(x) < X0 + 0.1 && Math.abs(z) < Z0 + 0.1) continue;
    dots.push([x, 0.03, z, K.rnd(0.36, 0.42), K.pick(STONE), 6, 1, 1, K.R()]);
  }
  for (let i = 0; i < 46; i++) { const [x, z] = K.around(PB + 2, 30, 18); dots.push([x, 0.01 + (i % 4) * 0.01, z, K.rnd(1.6, 4.0), K.pick([0x9fdc8f, 0xa9e39a, 0x93d184, 0xb3e8a4]), 12, 1, K.rnd(0.6, 1), K.R() * PI]); }
  for (let i = 0; i < 140; i++) { const [x, z] = K.around(PB + 1.2, 26, 18); dots.push([x, 0.09, z, 0.13, K.pick([0xffffff, 0xffd6ec, 0xfff2a8, 0xd9c6ff]), 5]); }
  // hedge walls down both sides with pastel flower beds and topiary balls
  const HX = PX + 1.6;
  for (const s of [-1, 1]) {
    const hz0 = -(hd + 8), hz1 = hd + 4;
    const hedge = [];
    for (let z = hz0; z < hz1; z += 1.6) hedge.push(rbox(1.4, 1.6, 1.7, 0x5fbf5a, s * HX, 0, z + 0.8, 0.5));
    K.add(shadeY(hedge, 0, 1.6, 0.7, 1.1));
    for (let z = hz0 + 3; z < hz1; z += 6) {
      K.add(shadeY([cyl(0.25, 0.3, 1.0, 0xb07a4a, 0, 0, 0, 6), ballC(1.1, 0x6fcf6a, 0, 2.0, 0, 1), ballC(0.7, 0x6fcf6a, 0, 3.2, 0, 1)], 0, 3.9, 0.7, 1.1), s * (HX + 2.2), 0, z);
      K.blob(s * (HX + 2.2), 0.03, z, 1.2, 1.2, 0.35);
    }
    for (let z = hz0 + 1; z < hz1; z += 3.2) K.add(flowerClump(K, 0.9, K.pick(FLOWER)), s * (HX + 0.1) - s * 1.4, 0, z);
  }
  // the castle on the hill behind (big pastel scenery, far side)
  const cz = -(hd + 34);
  K.add(shadeY([dome(30, 6, 12, 0x93d184, 0, 0, 0, 24, 6)], 0, 6, 0.8, 1.1), 0, 0, cz + 2);
  const C2 = [], WALL = 0xfff6fb, ROOFS = [0xff9cc6, 0xb9a0ff, 0x9fd2ff, 0x8fe3c4];
  C2.push(box(18, 8, 6, WALL, 0, 5, 0));
  for (let i = 0; i < 12; i++) C2.push(box(0.9, 1.0, 0.9, WALL, -8.2 + i * 1.5, 13, 2.6));
  C2.push(box(8, 10, 5, WALL, 0, 5, -2), cone(5.4, 6, ROOFS[0], 0, 15, -2, 4).rotateY(0));
  for (const [x, z, h, r, k] of [[-9.5, 2, 13, 2.2, 1], [9.5, 2, 13, 2.2, 2], [-5.5, -3, 17, 1.8, 3], [5.5, -3, 17, 1.8, 2], [0, -4, 22, 1.6, 0]]) {
    C2.push(cyl(r, r * 1.05, h, WALL, x, 5, z, 14), cone(r * 1.35, r * 2.6, ROOFS[k], x, 5 + h, z, 14));
    C2.push(rod([x, 5 + h + r * 2.6, z], [x, 5 + h + r * 2.6 + 1.6, z], 0.08, 0.08, 0x8a5a36, 4), box(1.4, 0.7, 0.05, ROOFS[(k + 1) % 4], x + 0.7, 5 + h + r * 2.6 + 0.9, z));
    for (let w = 0; w < 2; w++) C2.push(box(0.6, 1.0, 0.1, 0xffe9a8, x, 5 + h * (0.35 + w * 0.3), z + r + 0.02));
  }
  C2.push(box(3.2, 4.2, 0.2, 0x8a6aa8, 0, 5, 3.05), cyl(1.6, 1.6, 0.2, 0x8a6aa8, 0, 9.2, 3.05, 14, PI / 2));
  for (let i = 0; i < 5; i++) C2.push(box(0.9, 1.6, 0.1, 0xffe9a8, -6 + i * 3, 9.6, 3.05));
  K.add(shadeY(C2, 5, 30, 0.85, 1.05), 0, 0, cz + 2);
  K.halos.push([0, 12, cz + 6, 12, 6, 0.18, 0xfff0ff, true]);
  // rainbow arc behind it
  const RB = [0xff9cc6, 0xffc79a, 0xfff0a0, 0xb8f0c0, 0x9fd2ff, 0xc9b2ff];
  RB.forEach((c, i) => K.lit.push(custom(new THREE.TorusGeometry(34 - i * 1.6, 0.8, 4, 40, PI).translate(0, 0, cz - 14), c)));
  // round pastel trees on the far side and sides
  const TREES = [0xff9cc6, 0xc9b2ff, 0x8fe3c4, 0x9fd2ff, 0x7cc95e];
  for (let i = 0; i < 18; i++) {
    const [x, z] = K.around(PB + 6, 22, -4);
    if (z > hd - 2 || Math.abs(x) < HX + 4 && z > -(hd + 6)) continue;
    if (!K.free(x, z, 3)) continue;
    K.claim(x, z, 3);
    const h = K.rnd(6, 10);
    K.add(roundTree(K, h, K.rnd(2.0, 2.8), K.pick(TREES), 0xb07a4a), x, 0, z);
    K.blob(x, 0.03, z, 2.6, 2.4, 0.38);
  }
  // near side (low): a stone lantern pair, flower beds, little crowns of stones
  const nz = hd + PB + 2.6 * ns;
  for (const s of [-1, 1]) {
    K.add([cyl(0.5, 0.6, 0.3, 0xe9e2f7, 0, 0, 0, 8), cyl(0.2, 0.25, 0.8, 0xe9e2f7, 0, 0.3, 0, 8), box(0.8, 0.6, 0.8, 0xfaf6ff, 0, 1.1, 0), cone(0.7, 0.5, 0xb9a0ff, 0, 1.7, 0, 4)], s * hw * 0.55, 0, nz, 0, ns);
    K.lit.push(box(0.5, 0.35, 0.82, 0xfff1c4, s * hw * 0.55, 1.2 * ns, nz));
    K.blob(s * hw * 0.55, 0.03, nz, 0.8 * ns, 0.8 * ns, 0.3);
  }
  for (const [x, z] of [[-hw * 0.85, nz + 1.5], [-hw * 0.15, nz + 2.4], [hw * 0.15, nz + 3.2], [hw * 0.85, nz + 1.2], [-hw * 0.5, nz + 5], [hw * 0.45, nz + 6]]) K.add(flowerClump(K, 0.9, K.pick(FLOWER)), x, 0, z, K.R() * TAU);
  K.flat.push(discBatch(dots));
  cloudLayer(K, [[-22, 24, -(hd + 30), 4], [8, 30, -(hd + 44), 5], [28, 22, -(hd + 34), 3.5], [-36, 20, -(hd + 24), 3.2]], 60, [0xffffff, 0xffeaf6, 0xf0eaff]);
}
