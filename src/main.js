import './game/props_cozy.js';
import { initPhysics, PhysicsWorld } from './engine/physics.js';
import { Renderer } from './engine/render.js';
import { Input } from './engine/input.js';
import * as AudioMod from './engine/audio.js';
import { Round } from './game/round.js';
import { LEVELS } from './game/levels.js';
import { loadSave, writeSave, totalStars, exportProgress, importProgress } from './game/save.js';
import { skinById, animateSkin } from './game/skins.js';
import { UI } from './ui/ui.js';
import { PROPS } from './game/props.js';
import { WORLDS } from './game/levelbuild.js';
import { buildZenLevel, zenPropsFor } from './game/zenbuild.js';
import { parFor, starsFor } from './game/pars.js';
import { Icons } from './ui/icons.js';
import { Confetti } from './ui/confetti.js';
import { Sparkles, makeProgressRing, Markers } from './engine/fx.js';

const canvas = document.getElementById('c');
const renderer = new Renderer(canvas);
const input = new Input(document.getElementById('touch'), document.getElementById('stick'));
// Every sound call goes through this guard: sound is a nicety and must never be
// able to break a frame, an event, or a button.
const audio = new Proxy(new AudioMod.Audio(), {
  get(t, k) {
    const v = t[k];
    if (typeof v !== 'function') return v;
    return (...a) => { try { return v.apply(t, a); } catch (e) { console.error('audio', k, e); return undefined; } };
  },
});
// Bridge: the per-world music keys need the new sound engine (it exports CREDITS).
// Until it lands, map them onto the two original tracks so music never goes silent.
const playMusic = (k) => audio.playMusic(AudioMod.CREDITS ? k : (k === 'menu' || k === 'zen' ? 'calm' : 'play'));
const icons = new Icons();
const ui = new UI(document.getElementById('ui'), audio, icons);
const confetti = new Confetti(document.getElementById('confetti'));
const save = loadSave();
const sparkles = new Sparkles(renderer.scene);
const markers = new Markers(renderer.scene);
audio.setSfx(save.sfx); audio.setMusic(save.music);

const RIVAL_POOL = [
  { name: 'Biscuit', color: 0xff6b6b }, { name: 'Pickles', color: 0x4dabf7 }, { name: 'Waffles', color: 0xffc21a },
  { name: 'Noodle', color: 0x40c057 }, { name: 'Peanut', color: 0xb07cff }, { name: 'Muffin', color: 0xff922b },
  { name: 'Bean', color: 0x22b8cf }, { name: 'Sprout', color: 0x94d82d },
];

let phys = null, round = null, running = false, demo = false, levelIdx = 0;
let lastZen = null;
let tickSec = -1, tooBigHints = 0, hudT = 0, helpers = null, saveDirty = false, saveT = 0;
save.eaten = save.eaten || {};

// ---------------------------------------------------------------- rounds
function newRound(opts) {
  // One physics world for the whole session; each round removes every body it made.
  // (Freeing and recreating Rapier worlds trips a wasm ownership error.)
  if (round) { const old = round; round = null; old.dispose(); }
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
  window.__game = { round, renderer, phys, save, LEVELS, startLevel, startZen, showZen };
  return round;
}

function attract() {
  demo = true; running = false;
  newRound({ kind: 'zen', mapId: 'downtown', autoSteer: true });
  round.idleT = 99;
  playMusic('menu');
}

function startLevel(i) {
  demo = false; running = false; levelIdx = i;
  const level = LEVELS[i];
  newRound({ kind: 'level', level, timeScale: save.relaxed ? 1.6 : 1 });
  playMusic(level.world);
  helpers = { magnet: 1, freeze: 1, grow: 1 };
  ui.intro({
    level, index: i, targets: round.targets, time: round.duration, par: parFor(level)[0],
    onGo: () => {
      ui.clear(); round.endOverview(); ui.hudLevel(round, pause, helpers, useHelper); begin();
      if (i === 1 && !save.seenHelpers) { save.seenHelpers = true; writeSave(save); setTimeout(() => ui.hint('Stuck? Tap a helper at the bottom ♡', 3000), 4200); }
    },
    onBack: () => showMap(),
  });
}
function startZen(place) {
  demo = false;
  if (place && place.world) {
    newRound({ kind: 'zenworld', level: buildZenLevel(place.world, LEVELS), autoSteer: save.autoSteer });
    playMusic(place.world);
  } else {
    newRound({ kind: 'zen', mapId: 'downtown', autoSteer: save.autoSteer });
    playMusic('zen');
  }
  lastZen = place;
  ui.clear(); ui.hudZen(round, pause);
  running = true; input.enabled = true;
  ui.hint(save.autoSteer ? 'Drag anywhere to steer · let go and it drifts on its own' : 'Drag anywhere to steer', 3200);
}
function startRace() {
  demo = false; running = false;
  const rivals = [...RIVAL_POOL].sort(() => Math.random() - 0.5).slice(0, 5).map((r, i) => ({ ...r, skill: 0.55 + i * 0.09 }));
  newRound({ kind: 'race', mapId: 'downtown', rivals });
  playMusic('race');
  ui.clear(); ui.hudRace(round, pause);
  begin();
}
function begin() {
  input.enabled = true;
  audio.levelStart?.();
  ui.countdown(() => { running = true; });
  if (!save.seenHelp) {
    save.seenHelp = true; writeSave(save);
    setTimeout(() => {
      const hide = ui.fingerHint();
      const t0 = performance.now();
      const watch = () => { if (Math.hypot(input.x, input.z) > 0.2 || performance.now() - t0 > 9000 || !running) hide(); else requestAnimationFrame(watch); };
      watch();
    }, 2700);
  }
}

function useHelper(id) {
  if (!running || !helpers[id]) return helpers[id] || 0;
  helpers[id]--;
  round.useBooster(id);
  const p = round.player;
  if (id === 'magnet') { audio.boosterMagnet?.(); ui.banner('Magnet!', '#d93f6a'); }
  if (id === 'freeze') { audio.boosterFreeze?.(); ui.banner('Time freeze!', '#2a8fd6'); }
  if (id === 'grow') { audio.boosterGrow?.(); ui.banner('Bigger!', '#1fa877'); sparkles.burst(p.x, p.z, p.rShown, 30, 1.6); }
  return helpers[id];
}

// ---------------------------------------------------------------- events from the round
const events = {
  ate(h, o, t) {
    const near = Math.abs(h.x - round.player.x) < 20 && Math.abs(h.z - round.player.z) < 26;
    if (near) sparkles.burst(h.x, h.z, h.rShown, h.isPlayer ? 7 + Math.min(14, o.prop.value) : 4, Math.min(2.2, 0.7 + h.rShown * 0.25));
    if (demo) return;
    if (h.isPlayer) {
      audio.pop(o.prop, h.combo);
      const id = o.prop.id, first = !save.eaten[id];
      save.eaten[id] = (save.eaten[id] || 0) + 1; saveDirty = true;
      if (first) { ui.toastNew(id); audio.reward?.(); }
      if (h.combo >= 5 && h.combo % 5 === 0) ui.popText(renderer.camera, h.x, h.z - h.rShown - 0.6, `Combo x${h.combo}!`, 30, '#ff8fc4');
      const big = o.prop.value >= 15;
      ui.popText(renderer.camera, t.x, t.z, `+${o.prop.value}`, big ? 34 : 24, big ? '#ffd23f' : '#fff');
      if (big) round.shake = 0.25;
    }
  },
  sizeUp(h, lv) {
    if (demo || !h.isPlayer) return;
    audio.sizeUp();
    if (round.ringFx) round.ringFx.material.uniforms.uFlash.value = 1;
    sparkles.burst(h.x, h.z, h.rShown, 26, Math.min(2.4, 1 + h.rShown * 0.3));
    const words = ['', '', 'Yum!', 'Bigger!', 'Growing!', 'Hungry!', 'Huge!', 'Huge!', 'Enormous!', 'Enormous!', 'Gigantic!'];
    ui.banner(words[Math.min(words.length - 1, lv)] || 'Gigantic!');
    round.shake = 0.15;
  },
  target(i, tg) {
    ui.targetHit(i, tg);
    audio.target(tg.got / tg.need);
  },
  lastOne() {
    audio.lastOne?.();
    ui.hint('Just one more!', 1800);
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
      onMore: () => { ui.clear(); ui.hudLevel(r, pause, helpers, useHelper); r.addTime(30); running = true; },
      onRetry: () => startLevel(levelIdx),
      onMap: () => showMap(),
    });
  },
  finished(r, why) {
    running = false;
    if (demo) { attract(); return; }
    ui.hideHud();
    writeSave(save); saveDirty = false;
    if (r.kind === 'level' && why === 'win') r.celebrate();
    if (r.kind === 'level' && why === 'win') {
      const stars = starsFor(r.level, r.playTime());
      const id = r.level.id;
      save.stars[id] = Math.max(save.stars[id] || 0, stars);
      save.best = save.best || {};
      const tUsed = r.playTime(), newBest = save.best[id] !== undefined && tUsed < save.best[id];
      if (save.best[id] === undefined || tUsed < save.best[id]) save.best[id] = tUsed;
      writeSave(save);
      audio.win(); confetti.burst();
      setTimeout(() => ui.levelWin({
        level: r.level, index: levelIdx, stars, last: levelIdx >= LEVELS.length - 1, time: tUsed, ate: r.eatenCount || 0, newBest,
        onNext: () => startLevel(levelIdx + 1), onRetry: () => startLevel(levelIdx), onMap: () => showMap(),
      }), 700);
    } else if (r.kind === 'race') {
      const won = r.standings()[0] === r.player;
      if (won) { save.raceWins++; writeSave(save); audio.win(); confetti.burst(); } else audio.timeUp();
      ui.raceEnd({ round: r, onAgain: startRace, onHome: home });
    } else if (r.kind === 'zen') {
      save.zenBest = Math.max(save.zenBest, 100); writeSave(save);
      audio.win(); confetti.burst();
      ui.zenEnd({ round: r, onAgain: () => startZen(lastZen), onHome: home });
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
    onRestart: () => { if (round.kind === 'level') startLevel(levelIdx); else if (round.kind === 'race') startRace(); else startZen(lastZen); },
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
  const next = Math.min(unlockedIndex(), LEVELS.length - 1);
  ui.title({
    name: save.name,
    nextLabel: unlockedIndex() >= LEVELS.length ? 'Play' : `Level ${next + 1}`,
    onPlay: () => (unlockedIndex() >= LEVELS.length ? showMap() : startLevel(next)),
    onLevels: () => showMap(),
    onZen: showZen,
    onRace: startRace,
    onSkins: () => ui.skins({ save, stars: totalStars(save), onPick: (id) => { save.skin = id; writeSave(save); recolorPlayer(); }, onBack: home }),
    onSettings: () => ui.settings({
      save, onToggle: toggle, onBack: home, credits: AudioMod.CREDITS,
      onExport: () => exportProgress(save),
      onImport: (code) => { importProgress(save, code); writeSave(save); recolorPlayer(); },
    }),
    onBook: () => ui.book({ groups: bookGroups(), eaten: save.eaten, onBack: home }),
  });
}
// Gulp Book pages: one per world (props in the order its levels introduce them),
// then the town (Zen City / Race).
function bookGroups() {
  const seen = new Set(), groups = [];
  for (const L of LEVELS) {
    let g = groups.find((x) => x.world === L.world);
    if (!g) groups.push(g = { world: L.world, label: WORLDS[L.world].label, color: WORLDS[L.world].accent, ids: [] });
    for (const op of L.place) if (PROPS[op.id] && !seen.has(op.id)) { seen.add(op.id); g.ids.push(op.id); }
  }
  const town = ['person', 'cone', 'hydrant', 'bin', 'pot', 'mailbox', 'sign', 'lamp', 'bush', 'flowerbed', 'bench', 'bike', 'vending', 'booth', 'cart',
    'car', 'taxi', 'van', 'shelter', 'tree', 'pine', 'kiosk', 'fountain', 'bus', 'truck', 'house', 'shop', 'apartment', 'office', 'tower'].filter((id) => !seen.has(id));
  groups.push({ world: 'town', label: 'Sunny Town', color: '#5b8def', ids: town });
  return groups;
}
function unlockedIndex() { let i = 0; while (i < LEVELS.length && save.stars[LEVELS[i].id]) i++; return i; }
function showZen() {
  const reach = unlockedIndex();
  const worlds = [];
  LEVELS.forEach((L, i) => { if (!worlds.find((w) => w.world === L.world)) worlds.push({ world: L.world, first: i }); });
  const places = [{ world: null, label: 'Sunny Town', accent: '#5b8def', icon: icons.get('bus', 0), locked: false }]
    .concat(worlds.map((w) => {
      const ids = zenPropsFor(w.world, LEVELS);
      return { world: w.world, label: WORLDS[w.world].label, accent: WORLDS[w.world].accent, icon: icons.get(ids[Math.floor(ids.length / 2)] || ids[0], 0), locked: w.first > reach || ids.length < 3 };
    }));
  ui.zenPicker({ places, autoSteer: save.autoSteer, onPick: startZen, onToggle: toggle, onBack: home });
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
  requestAnimationFrame(frame);
  try { step(now); } catch (e) { console.error(e); }
}
function step(now) {
  const dt = Math.min(1 / 30, (now - last) / 1000); last = now;
  if (round) {
    if (running) round.update(dt, input.poll());
    else if (demo) round.update(dt, { x: 0, z: 0 });
    else round.idle(dt);
    if (running && round.boost.magnetT > 0) {
      round.magFx = (round.magFx || 0) - dt;
      if (round.magFx <= 0) { round.magFx = 0.09; const p = round.player; sparkles.burst(p.x, p.z, p.rShown * 1.6, 3, 0.6); }
    }
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
    try { round.world.backdrop?.update?.(now / 1000); } catch (e) { console.error('backdrop', e); round.world.backdrop = null; }
    // Bouncing arrows over the last few targets so stragglers are easy to find.
    if (running && round.kind === 'level') {
      round.markT = (round.markT || 0) - dt;
      if (round.markT <= 0) { round.markT = 0.25; round.left5 = round.leftovers(); }
      const show = round.left5 && (round.left5.length <= 4 || round.left / round.duration < 0.3) ? round.left5.slice(0, 8) : [];
      markers.update(show, now / 1000);
    } else markers.update([], 0);
    if (running) {
      hudT -= dt;
      ui.updateHud(round, renderer.camera); // cheap now: DOM only changes when a value does
      if (round.kind === 'level' && round.left <= 10) {
        const s = Math.ceil(round.left);
        if (s !== tickSec) { tickSec = s; audio.tick(s <= 5); }
      }
    }
  }
  padMenus();
  confetti.update(dt);
  saveT -= dt;
  if (saveDirty && saveT <= 0) { writeSave(save); saveDirty = false; saveT = 3; }
  if (running || demo) renderer.watchPerf(Math.min(0.1, (now - (frame.prev || now)) / 1000));
  frame.prev = now;
  renderer.render();
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
  for (const ev of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown']) addEventListener(ev, unlock, { capture: true });
  // Ask the browser to keep her progress (Safari can clear site data after 7 idle days).
  navigator.storage?.persist?.().catch?.(() => {});
  document.addEventListener('visibilitychange', () => { if (document.hidden) { if (running) pause(); if (saveDirty) { writeSave(save); saveDirty = false; } } });
  // Offline + instant relaunch on the real site (not the dev server).
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
}
boot().catch((e) => {
  console.error(e);
  document.getElementById('loading').innerHTML = `<p>Something went wrong loading the game.<br><small>${e.message}</small></p>`;
});
