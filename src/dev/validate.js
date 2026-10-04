// Dev harness: plays every level with the game's own steering AI and checks
// (1) nothing overlaps or explodes at spawn, (2) every target is clearable,
// (3) it clears with time to spare (a casual player is slower than the bot).
import '../game/props_cozy.js';
import { initPhysics, PhysicsWorld } from '../engine/physics.js';
import { Renderer } from '../engine/render.js';
import { Round } from '../game/round.js';
import { LEVELS } from '../game/levels.js';

const out = document.getElementById('out');
const log = (s) => { out.textContent += s + '\n'; };

async function run() {
  await initPhysics();
  const renderer = new Renderer(document.getElementById('c'));
  const phys = new PhysicsWorld();
  const results = [];
  let round = null;
  for (let i = 0; i < LEVELS.length; i++) {
    const L = LEVELS[i];
    if (round) round.dispose();
    let won = false;
    round = new Round({ phys, renderer, kind: 'level', level: L, playerName: 'Bot', playerColor: 0xff5fa2, events: { finished: (r, why) => { won = why === 'win'; } } });
    // spawn sanity: how far did anything move while settling?
    let maxMove = 0, lost = 0, worst = '';
    for (const o of round.world.objects) {
      if (o.eaten) { lost++; continue; }
      const t = o.body.translation();
      const m = Math.hypot(t.x - o.home[0], t.z - o.home[1]);
      if (m > maxMove) { maxMove = m; worst = o.prop.id; }
    }
    const p = round.player;
    let steps = 0;
    const limit = Math.ceil(L.time * 60);
    while (!round.over && !round.paused && steps < limit) {
      round.think(p, 1 / 60);
      round.update(1 / 60, { x: p.ai.ix, z: p.ai.iz });
      steps++;
    }
    const used = steps / 60;
    const tg = round.targets.map((t) => `${t.id}${t.tint !== undefined ? '#' + t.tint : ''} ${t.got}/${t.need}`).join(', ');
    const stuck = round.world.objects.filter((o) => !o.eaten && o.captured >= 0).length;
    const ok = won && used <= L.time * 0.75 && maxMove < 0.6 && lost === 0;
    results.push({ id: L.id, name: L.name, won, used: +used.toFixed(1), time: L.time, frac: +(used / L.time).toFixed(2), objs: round.world.objects.length, maxMove: +maxMove.toFixed(2), worst, lost, stuck, finalR: +p.r.toFixed(2), ok });
    log(`${ok ? 'PASS' : 'FAIL'}  L${String(L.id).padStart(2)} ${L.name.padEnd(22)} ${won ? 'won' : 'LOST'} in ${used.toFixed(1)}s / ${L.time}s  objs ${round.world.objects.length}  spawnMove ${maxMove.toFixed(2)}(${worst}) lost ${lost} stuck ${stuck}  r ${p.r.toFixed(2)}  [${tg}]`);
    await new Promise((r) => setTimeout(r, 0));
  }
  const fails = results.filter((r) => !r.ok).length;
  log(`\n${results.length - fails}/${results.length} levels pass`);
  window.__results = results;
  document.title = fails ? `FAIL ${fails}` : 'ALL PASS';
}
run().catch((e) => { log('ERROR ' + e.stack); document.title = 'ERROR'; });
