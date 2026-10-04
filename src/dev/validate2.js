// Dev harness for Season 2 (same checks as validate.js, Season 2 only): plays each level
// with the game's own steering AI and checks (1) nothing overlaps or explodes at spawn,
// (2) every target is clearable, (3) it clears with time to spare, and (4) an erratic
// "human" never loses a target and still clears it.
//   /validate2.html?ids=31,32     (default: all 15)     ?human=0 skips the erratic run
import '../game/props_cozy.js';
import '../game/props_wave2.js';
import { initPhysics, PhysicsWorld } from '../engine/physics.js';
import { Renderer } from '../engine/render.js';
import { Round } from '../game/round.js';
import { LEVELS } from '../game/levels_wave2.js';

const q = new URLSearchParams(location.search);
const ids = q.get('ids') ? q.get('ids').split(',').map(Number) : LEVELS.map((l) => l.id);
const out = document.getElementById('out');
const log = (s) => { out.textContent += s + '\n'; };

async function run() {
  await initPhysics();
  const renderer = new Renderer(document.getElementById('c'));
  const phys = new PhysicsWorld();
  const results = [];
  let round = null;
  for (const L of LEVELS.filter((l) => ids.includes(l.id))) {
    if (round) round.dispose();
    let won = false;
    round = new Round({ phys, renderer, kind: 'level', level: L, playerName: 'Bot', playerColor: 0xff5fa2, events: { finished: (r, why) => { won = why === 'win'; } } });
    let maxMove = 0, lost = 0, worst = '';
    for (const o of round.world.objects) {
      if (o.eaten) { lost++; continue; }
      const t = o.body.translation(), m = Math.hypot(t.x - o.home[0], t.z - o.home[1]);
      if (m > maxMove) { maxMove = m; worst = o.prop.id; }
    }
    const p = round.player, limit = Math.ceil(L.time * 60);
    let steps = 0;
    while (!round.over && !round.paused && steps < limit) { round.think(p, 1 / 60); round.update(1 / 60, { x: p.ai.ix, z: p.ai.iz }); steps++; }
    const used = steps / 60;
    const tg = round.targets.map((t) => `${t.id}${t.tint !== undefined ? '#' + t.tint : ''} ${t.got}/${t.need}`).join(', ');
    const lostBot = round.targets.reduce((n, t) => n + (t.need0 - t.need), 0);
    const r = { id: L.id, name: L.name, won, used: +used.toFixed(1), time: L.time, objs: round.world.objects.length, maxMove: +maxMove.toFixed(2), worst, lost, finalR: +p.r.toFixed(2), lostBot };
    if (q.get('human') !== '0') {
      round.dispose();
      let won2 = false;
      round = new Round({ phys, renderer, kind: 'level', level: L, playerName: 'Human', playerColor: 0xff5fa2, events: { finished: (rr, why) => { won2 = why === 'win'; } } });
      const h = round.player; let ix = 0, iz = 0, switchT = 0, s2 = 0, rnd = 12345 + L.id;
      const rand = () => ((rnd = (rnd * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
      while (!round.over && s2 < limit * 3) {
        if (round.paused) round.addTime(30);
        switchT -= 1 / 60;
        if (switchT <= 0) {
          switchT = 0.25 + rand() * 0.9;
          if (rand() < 0.55) { round.think(h, 1); ix = h.ai.ix; iz = h.ai.iz; } else { const a = rand() * Math.PI * 2; ix = Math.cos(a); iz = Math.sin(a); }
        }
        round.update(1 / 60, { x: ix, z: iz });
        s2++;
      }
      r.reclaimed = round.reclaimed || 0; r.won2 = won2; r.humanT = +(s2 / 60).toFixed(1); r.lostHuman = round.targets.reduce((n, t) => n + (t.need0 - t.need), 0);
      if (!won2) {
        // Say what is still standing so a stuck board can be fixed, not guessed at.
        const want = (o) => round.targets.some((t) => t.id === o.prop.id && (t.tint === undefined || t.tint === o.tint));
        const left = round.world.objects.filter((o) => !o.eaten && want(o)).map((o) => { const p = o.body.translation(); return `${o.prop.id}#${o.tint} fit ${o.prop.fit} at ${p.x.toFixed(1)},${p.y.toFixed(1)},${p.z.toFixed(1)}`; });
        log(`  stuck: over ${round.over} paused ${round.paused} hole r ${h.r.toFixed(2)} at ${h.x.toFixed(1)},${h.z.toFixed(1)} targets [${round.targets.map((t) => `${t.id} ${t.got}/${t.need}`).join(', ')}] left: ${left.join(' | ') || 'none'}`);
      }
    }
    r.ok = won && used <= L.time * 0.75 && maxMove < 0.6 && lost === 0 && lostBot === 0 && (r.won2 ?? true) && !r.lostHuman;
    results.push(r);
    log(`${r.ok ? 'PASS' : 'FAIL'}  L${L.id} ${L.name.padEnd(20)} bot ${won ? 'won' : 'LOST'} ${used.toFixed(1)}s/${L.time}s (${Math.round((100 * used) / L.time)}%) objs ${r.objs} spawnMove ${r.maxMove}(${worst}) lost ${lost} r ${r.finalR} [${tg}]` +
      (r.won2 !== undefined ? ` | human ${r.won2 ? 'won' : 'NOT WON'} ${r.humanT}s lost ${r.lostHuman}${r.reclaimed ? ` reclaimed ${r.reclaimed}` : ''}` : ''));
    await new Promise((res) => setTimeout(res, 0));
  }
  const fails = results.filter((x) => !x.ok).length;
  log(`\n${results.length - fails}/${results.length} levels pass`);
  window.__results = results;
  document.title = fails ? `FAIL ${fails}` : 'ALL PASS';
}
run().catch((e) => { log('ERROR ' + e.stack); document.title = 'ERROR'; });
