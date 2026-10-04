import './game/props_cozy.js';
import { initPhysics, PhysicsWorld } from './engine/physics.js';
import { Renderer } from './engine/render.js';
import { Input } from './engine/input.js';
import { Audio } from './engine/audio.js';
import { Round } from './game/round.js';
import { LEVELS } from './game/levels.js';
import { loadSave, writeSave, totalStars } from './game/save.js';
import { skinById, animateSkin } from './game/skins.js';
import { UI } from './ui/ui.js';
import { Icons } from './ui/icons.js';
import { Confetti } from './ui/confetti.js';
import { Sparkles, makeProgressRing } from './engine/fx.js';

const canvas = document.getElementById('c');
const renderer = new Renderer(canvas);
const input = new Input(document.getElementById('touch'), document.getElementById('stick'));
const audio = new Audio();
const icons = new Icons();
const ui = new UI(document.getElementById('ui'), audio, icons);
const confetti = new Confetti(document.getElementById('confetti'));
const save = loadSave();
const sparkles = new Sparkles(renderer.scene);
audio.setSfx(save.sfx); audio.setMusic(save.music);

const RIVAL_POOL = [
  { name: 'Biscuit', color: 0xff6b6b }, { name: 'Pickles', color: 0x4dabf7 }, { name: 'Waffles', color: 0xffc21a },
  { name: 'Noodle', color: 0x40c057 }, { name: 'Peanut', color: 0xb07cff }, { name: 'Muffin', color: 0xff922b },
  { name: 'Bean', color: 0x22b8cf }, { name: 'Sprout', color: 0x94d82d },
];

let phys = null, round = null, running = false, demo = false, levelIdx = 0;
let tickSec = -1, tooBigHints = 0, hudT = 0;

// ---------------------------------------------------------------- rounds
function newRound(opts) {
  // One physics world for the whole session; each round removes every body it made.
  // (Freeing and recreating Rapier worlds trips a wasm ownership error.)
  if (round) round.dispose();
  if (!phys) phys = new PhysicsWorld();
  ui.hideHud();
  const skin = skinById(save.skin);
  round = new Round({
    phys, renderer, playerName: save.name, playerColor: skin.color, events, ...opts,
  });
  round.skin = skin;
  round.ringFx = makeProgressRing(skin.color);
  round.player.mesh.add(round.ringFx);
  tickSec = -1; tooBigHints = 0;
  window.__game = { round, renderer, phys, save, LEVELS };
  return round;
}

function attract() {
  demo = true; running = false;
  newRound({ kind: 'zen', mapId: 'downtown', autoSteer: true });
  round.idleT = 99;
  audio.playMusic('calm');
}

function startLevel(i) {
  demo = false; running = false; levelIdx = i;
  const level = LEVELS[i];
  newRound({ kind: 'level', level });
  audio.playMusic('play');
  ui.intro({
    level, index: i, targets: round.targets,
    onGo: () => { ui.clear(); ui.hudLevel(round, pause); begin(); },
    onBack: () => showMap(),
  });
}
function startZen() {
  demo = false;
  newRound({ kind: 'zen', mapId: 'downtown', autoSteer: save.autoSteer });
  audio.playMusic('calm');
  ui.clear(); ui.hudZen(round, pause);
  running = true; input.enabled = true;
  ui.hint(save.autoSteer ? 'Drag anywhere to steer · let go and it drifts on its own' : 'Drag anywhere to steer', 3200);
}
function startRace() {
  demo = false; running = false;
  const rivals = [...RIVAL_POOL].sort(() => Math.random() - 0.5).slice(0, 5).map((r, i) => ({ ...r, skill: 0.55 + i * 0.09 }));
  newRound({ kind: 'race', mapId: 'downtown', rivals });
  audio.playMusic('play');
  ui.clear(); ui.hudRace(round, pause);
  begin();
}
function begin() {
  input.enabled = true;
  ui.countdown(() => { running = true; });
  if (!save.seenHelp) { save.seenHelp = true; writeSave(save); setTimeout(() => ui.hint('Drag anywhere to move your hole', 2800), 2600); }
}

// ---------------------------------------------------------------- events from the round
const events = {
  ate(h, o, t) {
    const near = Math.abs(h.x - round.player.x) < 20 && Math.abs(h.z - round.player.z) < 26;
    if (near) sparkles.burst(h.x, h.z, h.rShown, h.isPlayer ? 7 + Math.min(14, o.prop.value) : 4, Math.min(2.2, 0.7 + h.rShown * 0.25));
    if (demo) return;
    if (h.isPlayer) {
      audio.pop(o.prop.value, h.combo);
      if (h.combo >= 5 && h.combo % 5 === 0) ui.popText(renderer.camera, h.x, h.z - h.rShown - 0.6, `Combo x${h.combo}!`, 30, '#ff8fc4');
      const big = o.prop.value >= 15;
      ui.popText(renderer.camera, t.x, t.z, `+${o.prop.value}`, big ? 34 : 24, big ? '#ffd23f' : '#fff');
      if (big) round.shake = 0.25;
    }
  },
  sizeUp(h) {
    if (demo || !h.isPlayer) return;
    audio.sizeUp();
    if (round.ringFx) round.ringFx.material.uniforms.uFlash.value = 1;
    sparkles.burst(h.x, h.z, h.rShown, 26, Math.min(2.4, 1 + h.rShown * 0.3));
    ui.banner(['Bigger!', 'Yum!', 'Growing!', 'Hungry!', 'Huge!'][Math.floor(Math.random() * 5)]);
    round.shake = 0.15;
  },
  target(i, tg) {
    ui.targetHit(i, tg);
    audio.target(tg.got / tg.need);
  },
  tooBig() {
    if (demo || tooBigHints >= 2 || round.time < 2) return;
    audio.bonk();
    if (round.lastTooBig && round.time - round.lastTooBig < 6) return;
    round.lastTooBig = round.time; tooBigHints++;
    ui.hint('Too big for now! Eat smaller things first', 2000);
  },
  holeEaten(a, b) {
    if (b.isPlayer) { audio.swallowedHole(); ui.banner(`${a.name} got you!`, '#5b4f78'); }
    else if (a.isPlayer) { audio.swallowedHole(); ui.banner(`You ate ${b.name}!`); round.shake = 0.3; }
  },
  timeUp(r) {
    running = false; audio.timeUp(); ui.hideHud();
    ui.timeUp({
      round: r,
      onMore: () => { ui.clear(); ui.hudLevel(r, pause); r.addTime(30); running = true; },
      onRetry: () => startLevel(levelIdx),
      onMap: () => showMap(),
    });
  },
  finished(r, why) {
    running = false;
    if (demo) { attract(); return; }
    ui.hideHud();
    if (r.kind === 'level' && why === 'win') {
      const frac = r.left / r.duration;
      let stars = frac >= 0.4 ? 3 : frac >= 0.15 ? 2 : 1;
      if (r.usedExtra) stars = 1;
      const id = r.level.id;
      save.stars[id] = Math.max(save.stars[id] || 0, stars);
      writeSave(save);
      audio.win(); confetti.burst();
      setTimeout(() => ui.levelWin({
        level: r.level, index: levelIdx, stars, last: levelIdx >= LEVELS.length - 1,
        onNext: () => startLevel(levelIdx + 1), onRetry: () => startLevel(levelIdx), onMap: () => showMap(),
      }), 700);
    } else if (r.kind === 'race') {
      const won = r.standings()[0] === r.player;
      if (won) { save.raceWins++; writeSave(save); audio.win(); confetti.burst(); } else audio.timeUp();
      ui.raceEnd({ round: r, onAgain: startRace, onHome: home });
    } else if (r.kind === 'zen') {
      save.zenBest = Math.max(save.zenBest, 100); writeSave(save);
      audio.win(); confetti.burst();
      ui.zenEnd({ round: r, onAgain: startZen, onHome: home });
    }
  },
};

// ---------------------------------------------------------------- screens
function pause() {
  if (!running) return;
  running = false;
  ui.pause({
    save,
    onResume: () => { ui.clear(); running = true; },
    onRestart: () => { if (round.kind === 'level') startLevel(levelIdx); else if (round.kind === 'race') startRace(); else startZen(); },
    onQuit: () => (round.kind === 'level' ? showMap() : home()),
    onToggle: toggle,
  });
}
function toggle(k, on) {
  save[k] = on; writeSave(save);
  if (k === 'sfx') audio.setSfx(on);
  if (k === 'music') audio.setMusic(on);
  if (k === 'autoSteer' && round && round.kind === 'zen' && !demo) round.autoSteer = on;
}
function home() {
  input.enabled = false;
  if (!demo) attract();
  ui.hideHud();
  ui.title({
    name: save.name,
    onPlay: () => showMap(),
    onZen: startZen,
    onRace: startRace,
    onSkins: () => ui.skins({ save, stars: totalStars(save), onPick: (id) => { save.skin = id; writeSave(save); recolorPlayer(); }, onBack: home }),
    onSettings: () => ui.settings({ save, onToggle: toggle, onBack: home }),
  });
}
function showMap() {
  input.enabled = false; running = false;
  if (!demo) attract();
  ui.hideHud();
  ui.levelMap({ levels: LEVELS, save, stars: totalStars(save), onPick: startLevel, onBack: home });
}
function recolorPlayer() {
  if (!round) return;
  const s = skinById(save.skin); round.skin = s;
  const u = round.player.mesh.userData;
  u.rimMat.color.set(s.color); u.haloMat.color.set(s.color);
}

// ---------------------------------------------------------------- gamepad menu navigation
function padMenus() {
  const b = input.padButton();
  const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
  const p = pads[0];
  if (running) { if (b === 'start') pause(); return; }
  if (!b && !p) return;
  const btns = [...document.querySelectorAll('#ui .screen button:not([disabled])')];
  if (!btns.length) return;
  let i = btns.indexOf(document.activeElement);
  const ay = p ? (p.axes[1] || 0) + (p.buttons[13]?.pressed ? 1 : 0) - (p.buttons[12]?.pressed ? 1 : 0) : 0;
  const ax = p ? (p.axes[0] || 0) + (p.buttons[15]?.pressed ? 1 : 0) - (p.buttons[14]?.pressed ? 1 : 0) : 0;
  const now = performance.now();
  if ((Math.abs(ay) > 0.6 || Math.abs(ax) > 0.6) && now - (padMenus.t || 0) > 220) {
    padMenus.t = now;
    i = i < 0 ? 0 : (i + ((ay > 0.6 || ax > 0.6) ? 1 : -1) + btns.length) % btns.length;
    btns[i].focus();
  }
  if (b === 'a') (i >= 0 ? btns[i] : btns[0]).click();
  if (b === 'b') document.querySelector('#ui .screen [data-a=back], #ui .screen [data-a=quit], #ui .screen [data-a=map], #ui .screen [data-a=home]')?.click();
}

// ---------------------------------------------------------------- loop
let last = performance.now();
function frame(now) {
  const dt = Math.min(1 / 30, (now - last) / 1000); last = now;
  if (round) {
    if (running) round.update(dt, input.poll());
    else if (demo) round.update(dt, { x: 0, z: 0 });
    round.shake = Math.max(0, (round.shake || 0) - dt * 1.2);
    if (round.skin) animateSkin(round.skin, round.player.mesh, now / 1000);
    if (round.ringFx) {
      const p = round.player, lv = round.sizeLevel(p), lo = 0.5 * Math.pow(1.22, lv - 1);
      const u = round.ringFx.material.uniforms;
      u.uProg.value += (Math.min(1, Math.max(0, (p.target - lo) / (lo * 0.22))) - u.uProg.value) * Math.min(1, dt * 8);
      u.uFlash.value = Math.max(0, u.uFlash.value - dt * 2.5);
      u.uColor.value.copy(p.mesh.userData.rimMat.color);
    }
    sparkles.update(dt);
    if (running) {
      hudT -= dt;
      if (hudT <= 0 || round.kind !== 'race') { ui.updateHud(round, renderer.camera); hudT = 0.2; }
      if (round.kind === 'level' && round.left <= 10) {
        const s = Math.ceil(round.left);
        if (s !== tickSec) { tickSec = s; audio.tick(s <= 5); }
      }
    }
  }
  padMenus();
  confetti.update(dt);
  if (running || demo) renderer.watchPerf(Math.min(0.1, (now - (frame.prev || now)) / 1000));
  frame.prev = now;
  renderer.render();
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------- boot
async function boot() {
  const loading = document.getElementById('loading');
  await initPhysics();
  attract();
  requestAnimationFrame(frame);
  home();
  loading.style.opacity = 0; setTimeout(() => loading.remove(), 600);
  // iOS: audio can only start inside a user gesture.
  const unlock = () => { audio.unlock(); if (audio.want) audio.playMusic(audio.want); };
  addEventListener('pointerdown', unlock, { capture: true });
  addEventListener('keydown', unlock, { capture: true });
  document.addEventListener('visibilitychange', () => { if (document.hidden && running) pause(); });
}
boot().catch((e) => {
  console.error(e);
  document.getElementById('loading').innerHTML = `<p>Something went wrong loading the game.<br><small>${e.message}</small></p>`;
});
