// DOM screens and HUD. Pure presentation: main.js owns state and passes callbacks.
import { SKINS, cssColor } from '../game/skins.js';
import { WORLDS } from '../game/levelbuild.js';
import { PROPS } from '../game/props.js';
import { Vector3 } from 'three';

const _v = new Vector3();

const $ = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const fmt = (s) => { s = Math.ceil(s); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

// Helper (booster) buttons: hand-drawn SVG icons so they're crisp at any size.
export const HELPERS = [
  { id: 'magnet', name: 'Magnet', svg: '<svg viewBox="0 0 40 40"><path d="M9 8h7v13a4 4 0 0 0 8 0V8h7v13a11 11 0 0 1-22 0z" fill="#ff5a6e"/><rect x="9" y="8" width="7" height="6" fill="#e9eef5"/><rect x="24" y="8" width="7" height="6" fill="#e9eef5"/></svg>' },
  { id: 'freeze', name: 'Freeze', svg: '<svg viewBox="0 0 40 40"><g stroke="#48b8ff" stroke-width="3.4" stroke-linecap="round"><path d="M20 5v30M7 12.5l26 15M7 27.5l26-15"/><path d="M15 7l5 4 5-4M15 33l5-4 5 4"/></g></svg>' },
  { id: 'grow', name: 'Grow', svg: '<svg viewBox="0 0 40 40"><ellipse cx="20" cy="29" rx="15" ry="7" fill="#2b2141"/><ellipse cx="20" cy="29" rx="15" ry="7" fill="none" stroke="#2fd39a" stroke-width="3"/><path d="M20 4l8 9h-5v9h-6v-9h-5z" fill="#2fd39a"/></svg>' },
];

export class UI {
  constructor(root, audio, icons) {
    this.root = root; this.audio = audio; this.icons = icons;
    this.screen = $('<div class="layer"></div>'); this.hud = $('<div class="layer"></div>'); this.fx = $('<div class="layer"></div>');
    root.append(this.hud, this.fx, this.screen);
    this.labels = new Map();
    this.hintT = 0;
  }
  // Panels get a soft open/close sound (optional chaining: sound is never required).
  clear(silent = false) {
    if (!silent && this.screen.querySelector('.panel')) this.audio.uiClose?.();
    this.screen.innerHTML = '';
  }
  show(el) {
    this.clear(true);
    this.screen.append(el);
    if (el.querySelector('.panel')) this.audio.uiOpen?.();
    this.focusFirst(el);
    return el;
  }
  focusFirst(el) { const b = el.querySelector('[data-focus]') || el.querySelector('.btn'); if (b && matchMedia('(pointer:fine)').matches) b.focus({ preventScroll: true }); }
  on(el, sel, fn) {
    el.querySelectorAll(sel).forEach((b) => b.addEventListener('click', (e) => {
      e.stopPropagation();
      fn(b, e);
      try { this.audio.tap(); } catch (err) { /* sound is optional */ }
    }));
  }

  // ------------------------------------------------------------ title
  title({ name, onPlay, onZen, onRace, onSkins, onSettings, onBook, onLevels, nextLabel }) {
    const el = $(`<div class="screen">
      <div class="logo">
        <svg width="120" height="70" viewBox="0 0 120 70" aria-hidden="true"><ellipse cx="60" cy="38" rx="56" ry="28" fill="#ff5fa2"/><ellipse cx="60" cy="38" rx="46" ry="21" fill="#1a1030"/><ellipse cx="60" cy="42" rx="34" ry="13" fill="#000"/></svg>
        <h1>Gulp!</h1>
        <div class="for">made with love for <b>${name}</b></div>
      </div>
      <div class="title-menu col">
        <button class="btn" data-a="play" data-focus>▶ ${nextLabel || 'Play'}</button>
        <button class="btn ghost small" data-a="levels">All levels</button>
        <div class="row" style="flex-wrap:nowrap">
          <button class="btn mint small" data-a="zen" style="flex:1">Zen</button>
          <button class="btn sky small" data-a="race" style="flex:1">Race</button>
        </div>
        <div class="title-foot">
          <button class="btn ghost small" data-a="book">Gulp Book</button>
          <button class="btn ghost small" data-a="skins">Holes</button>
          <button class="btn ghost small round" data-a="settings" aria-label="Settings">⚙</button>
        </div>
      </div></div>`);
    this.on(el, '[data-a=play]', onPlay); this.on(el, '[data-a=levels]', onLevels || onPlay); this.on(el, '[data-a=zen]', onZen); this.on(el, '[data-a=race]', onRace);
    this.on(el, '[data-a=skins]', onSkins); this.on(el, '[data-a=settings]', onSettings); this.on(el, '[data-a=book]', onBook);
    return this.show(el);
  }

  // ------------------------------------------------------------ level map
  levelMap({ levels, save, stars, onPick, onBack }) {
    const byWorld = [];
    for (const l of levels) { let w = byWorld.find((x) => x.world === l.world); if (!w) byWorld.push(w = { world: l.world, list: [] }); w.list.push(l); }
    const unlockedUpTo = (() => { let i = 0; while (i < levels.length && save.stars[levels[i].id]) i++; return i; })();
    const el = $(`<div class="screen" style="background:linear-gradient(180deg,#ff9cc6,#ffd59e)">
      <div class="maptop"><button class="btn ghost round" data-a="back" aria-label="Back">‹</button><h2>Levels</h2><div class="starcount">★ ${stars}</div></div>
      ${byWorld.map((w, wi) => {
        const W = WORLDS[w.world];
        const season2 = w.list[0].id >= 31 && (wi === 0 || byWorld[wi - 1].list[0].id < 31);
        const ic = w.list[0].targets[0];
        const got = w.list.reduce((a, l) => a + (save.stars[l.id] || 0), 0);
        return `${season2 ? '<div class="season">✨ Season 2 ✨</div>' : ''}<div class="world" style="--wc:${W.accent}"><h3><img class="wicon"  alt="" src="${this.icons.get(ic.id, ic.tint ?? 0)}">${W.label}<span class="wstars">★ ${got}/${w.list.length * 3}</span></h3><div class="lvls">
          ${w.list.map((l) => {
            const idx = levels.indexOf(l), got = save.stars[l.id] || 0, locked = idx > unlockedUpTo;
            const st = got ? '★'.repeat(got) + '☆'.repeat(3 - got) : '';
            return `<button class="lvl${locked ? ' locked' : ''}${idx === unlockedUpTo ? ' next' : ''}" data-l="${idx}" ${locked ? 'disabled' : ''} ${idx === unlockedUpTo ? 'data-focus' : ''}>${locked ? '🔒' : idx + 1}<span class="st">${st}</span></button>`;
          }).join('')}</div></div>`;
      }).join('')}
      <div style="height:20px;flex:none"></div></div>`);
    this.on(el, '[data-a=back]', onBack);
    this.on(el, '.lvl:not(.locked)', (b) => onPick(+b.dataset.l));
    this.show(el);
    const next = el.querySelector('.lvl.next');
    if (next) next.scrollIntoView({ block: 'center' });
    return el;
  }

  chips(targets, small = false) {
    return targets.map((t, i) => `<div class="chip" data-t="${i}"><img alt="${PROPS[t.id].label}" src="${this.icons.get(t.id, t.tint ?? 0)}"><span class="n">${small ? t.need - t.got : t.need}</span></div>`).join('');
  }
  intro({ level, index, targets, time, par, onGo, onBack }) {
    const W = WORLDS[level.world];
    const el = $(`<div class="screen intro">
      <div class="panel" style="--c:${W.accent};--cd:rgba(0,0,0,.25)">
        <div class="ribbon">Level ${index + 1}</div>
        <h2 style="margin-top:14px">${level.name}</h2>
        <div class="sub">Swallow all of these!</div>
        <div class="targets">${this.chips(targets)}</div>
        <div class="sub introtime">⏱ ${fmt(time ?? level.time)}${par ? `<span class="par">★★★ under ${fmt(par)}</span>` : ''}</div>
        <div class="col"><button class="btn mint" data-a="go" data-focus>Let's go!</button>
        <button class="btn ghost small" data-a="back">Back to levels</button></div>
      </div></div>`);
    this.on(el, '[data-a=go]', onGo); this.on(el, '[data-a=back]', onBack);
    return this.show(el);
  }

  // ------------------------------------------------------------ HUD
  hudLevel(round, onPause, helpers, onHelper) {
    this.hud.innerHTML = '';
    const el = $(`<div class="layer">
      <div class="hud"><div class="tchips">${this.chips(round.targets, true)}</div><button class="btn ghost round pause" aria-label="Pause">❚❚</button></div>
      <div class="timer">${fmt(round.left)}</div>
      <div class="helpers">${HELPERS.map((h) => `<button class="helper" data-h="${h.id}" aria-label="${h.name}" ${helpers[h.id] ? '' : 'disabled'}>${h.svg}<span class="hn">${h.name}</span><b>${helpers[h.id] || 0}</b></button>`).join('')}</div></div>`);
    el.querySelector('.pause').addEventListener('click', (e) => { e.stopPropagation(); this.audio.tap(); onPause(); });
    el.querySelectorAll('.helper').forEach((b) => b.addEventListener('click', (e) => {
      e.stopPropagation();
      if (b.disabled) return;
      const left = onHelper(b.dataset.h);
      b.querySelector('b').textContent = left;
      if (!left) b.disabled = true;
      b.classList.remove('fire'); void b.offsetWidth; b.classList.add('fire');
    }));
    // The helper buttons sit over the play area: don't let a tap on them start steering.
    el.querySelectorAll('.helper').forEach((b) => b.addEventListener('pointerdown', (e) => e.stopPropagation()));
    this.hud.append(el);
    this.hudEls = { timer: el.querySelector('.timer'), chips: [...el.querySelectorAll('.chip')] };
  }
  hudZen(round, onPause) {
    this.hud.innerHTML = '';
    const el = $(`<div class="layer"><div class="hud"><button class="btn ghost round pause" aria-label="Pause" style="margin-left:auto">❚❚</button></div>
      <div class="meter"><i></i><span>0% eaten</span></div>
      <div class="sizebar">Size <span class="lv">1</span><div class="bar"><i></i></div></div></div>`);
    el.querySelector('.pause').addEventListener('click', (e) => { e.stopPropagation(); this.audio.tap(); onPause(); });
    this.hud.append(el);
    this.hudEls = { meter: el.querySelector('.meter i'), meterT: el.querySelector('.meter span'), lv: el.querySelector('.lv'), bar: el.querySelector('.sizebar i') };
  }
  hudRace(round, onPause) {
    this.hud.innerHTML = '';
    const el = $(`<div class="layer"><div class="hud"><div class="board"></div><button class="btn ghost round pause" aria-label="Pause">❚❚</button></div>
      <div class="timer">${fmt(round.left)}</div></div>`);
    el.querySelector('.pause').addEventListener('click', (e) => { e.stopPropagation(); this.audio.tap(); onPause(); });
    this.hud.append(el);
    this.hudEls = { timer: el.querySelector('.timer'), board: el.querySelector('.board') };
  }
  hideHud() { this.hud.innerHTML = ''; this.hudEls = null; for (const l of this.labels.values()) l.remove(); this.labels.clear(); }

  updateHud(round, cam) {
    const e = this.hudEls; if (!e) return;
    const set = (el, key, v, fn) => { if (el[key] !== v) { el[key] = v; fn(v); } };
    if (e.timer) {
      set(e.timer, '_t', fmt(round.left), (v) => { e.timer.textContent = v; });
      const frozen = round.boost && round.boost.freezeT > 0;
      e.timer.classList.toggle('frozen', !!frozen);
      e.timer.classList.toggle('low', !frozen && round.left <= 10 && round.kind === 'level');
    }
    if (e.meter) {
      const p = Math.min(100, Math.floor(round.progress() * 100));
      set(e.meter, '_p', p, (v) => { e.meter.style.width = v + '%'; e.meterT.textContent = `${v}% eaten`; });
      const h = round.player, lv = round.sizeLevel(h);
      set(e.lv, '_v', lv, (v) => { e.lv.textContent = v; });
      const lo = 0.5 * Math.pow(1.22, lv - 1), hi = lo * 1.22;
      set(e.bar, '_w', Math.round(Math.min(100, ((h.target - lo) / (hi - lo)) * 100)), (v) => { e.bar.style.width = v + '%'; });
    }
    if (e.board) {
      const st = round.standings().slice(0, 5);
      const html = st.map((h) => `<div class="${h.isPlayer ? 'me' : ''}"><i style="background:${cssColor(h.color)}"></i>${h.name}<b>${Math.round(h.score)}</b></div>`).join('');
      set(e.board, '_h', html, (v) => { e.board.innerHTML = v; });
      // name tags over every hole
      for (const h of round.holes) {
        let l = this.labels.get(h);
        if (!l) { l = $(`<div class="label">${h.name}</div>`); this.fx.append(l); this.labels.set(h, l); }
        const p = this.project(cam, h.x, 0, h.z + h.rShown + 0.2);
        l.style.display = h.alive && p ? '' : 'none';
        if (p) { l.style.left = p[0] + 'px'; l.style.top = p[1] + 'px'; }
      }
    }
  }
  targetHit(i, tg) {
    const c = this.hudEls?.chips?.[i]; if (!c) return;
    c.querySelector('.n').textContent = Math.max(0, tg.need - tg.got);
    c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump');
    if (tg.got >= tg.need) c.classList.add('done');
  }

  // ------------------------------------------------------------ effects
  project(cam, x, y, z) {
    _v.set(x, y, z).project(cam);
    if (_v.z > 1) return null;
    return [(_v.x + 1) / 2 * innerWidth, (1 - _v.y) / 2 * innerHeight];
  }
  popText(cam, x, z, text, size = 26, color = '#fff') {
    const p = this.project(cam, x, 0.3, z); if (!p) return;
    const el = $(`<div class="pop" style="left:${p[0]}px;top:${p[1]}px;font-size:${size}px;color:${color}">${text}</div>`);
    this.fx.append(el); setTimeout(() => el.remove(), 800);
  }
  banner(text, color = 'var(--pink-d)') {
    const el = $(`<div class="banner" style="--c:${color}">${text}</div>`);
    this.fx.append(el); setTimeout(() => el.remove(), 1400);
  }
  hint(text, ms = 2200) {
    if (this.hintEl) this.hintEl.remove();
    const el = this.hintEl = $(`<div class="hint">${text}</div>`);
    this.fx.append(el);
    setTimeout(() => { el.style.opacity = 0; setTimeout(() => el.remove(), 450); }, ms);
  }
  countdown(onDone) {
    const el = $('<div class="count"></div>'); this.fx.append(el);
    const seq = ['3', '2', '1', 'Go!']; let i = 0;
    const step = () => {
      if (i >= seq.length) { el.remove(); return; }
      el.innerHTML = `<span>${seq[i]}</span>`;
      if (i < 3) this.audio.tick(false); else { this.audio.sizeUp(); onDone(); }
      i++; setTimeout(step, i === 4 ? 700 : 620);
    };
    step();
  }

  // ------------------------------------------------------------ menus
  pause({ onResume, onRestart, onQuit, save, onToggle }) {
    const el = $(`<div class="screen dim"><div class="panel"><h2>Paused</h2><div class="sub">Take your time ♡</div>
      ${this.toggles(save)}
      <div class="col" style="margin-top:14px"><button class="btn mint" data-a="resume" data-focus>Keep playing</button>
      <button class="btn sun small" data-a="restart">Start over</button><button class="btn ghost small" data-a="quit">Quit</button></div></div></div>`);
    this.on(el, '[data-a=resume]', onResume); this.on(el, '[data-a=restart]', onRestart); this.on(el, '[data-a=quit]', onQuit);
    this.bindToggles(el, onToggle);
    return this.show(el);
  }
  toggles(save, zenOption = false) {
    return `<div style="text-align:left">
      <div class="toggle">Sound effects <button class="switch ${save.sfx ? 'on' : ''}" data-k="sfx" aria-label="Sound effects"></button></div>
      <div class="toggle">Music <button class="switch ${save.music ? 'on' : ''}" data-k="music" aria-label="Music"></button></div>
      <div class="toggle">Easy mode (longer timers, faster growing) <button class="switch ${save.relaxed ? 'on' : ''}" data-k="relaxed" aria-label="Easy mode"></button></div>
      ${zenOption ? `<div class="toggle">Auto-steer in Zen <button class="switch ${save.autoSteer ? 'on' : ''}" data-k="autoSteer" aria-label="Auto-steer"></button></div>` : ''}
    </div>`;
  }
  bindToggles(el, onToggle) {
    el.querySelectorAll('.switch').forEach((s) => s.addEventListener('click', (e) => {
      e.stopPropagation(); s.classList.toggle('on'); this.audio.tap(); onToggle(s.dataset.k, s.classList.contains('on'));
    }));
  }
  settings({ save, onToggle, onBack, credits, onExport, onImport, onReset, onRestore, canRestore }) {
    const el = $(`<div class="screen dim"><div class="panel"><h2>Settings</h2>
      ${this.toggles(save, true)}
      <div class="xfer"><div class="sub" style="margin:10px 0 8px">Moving to the Home Screen app or a new phone?</div>
        <div class="row" style="flex-wrap:nowrap"><button class="btn sky small" data-a="export" style="flex:1">Copy my progress</button><button class="btn ghost small" data-a="import" style="flex:1">Paste progress</button></div>
        <textarea class="code hidden" id="xfercode" rows="3" spellcheck="false" aria-label="Progress code"></textarea>
        <div class="xmsg"></div></div>
      <div class="xfer"><div class="sub" style="margin:12px 0 8px">Want to play every level again from the start?</div>
        <div class="row" style="flex-wrap:nowrap"><button class="btn small" data-a="reset" style="flex:1">Start over</button>${canRestore ? '<button class="btn ghost small" data-a="restore" style="flex:1">Bring back my old stars</button>' : ''}</div>
        <div class="rmsg"></div></div>
      <div class="credits">${String(credits || 'Music by HydroGene.').replace(/&/g, '&amp;').replace(/</g, '&lt;').split('\n').join('<br>')}<br>Made with love for Amanda by Creg.</div>
      <div class="col" style="margin-top:16px"><button class="btn mint" data-a="back" data-focus>Done</button></div></div></div>`);
    this.bindToggles(el, onToggle); this.on(el, '[data-a=back]', onBack);
    const box = el.querySelector('#xfercode'), msg = el.querySelector('.xmsg');
    this.on(el, '[data-a=export]', async () => {
      const code = onExport();
      box.classList.remove('hidden'); box.value = code; box.readOnly = true;
      try { await navigator.clipboard.writeText(code); msg.textContent = 'Copied! Open Gulp where you want it, then Settings → Paste progress.'; }
      catch (e) { box.focus(); box.select(); msg.textContent = 'Select the code above and copy it.'; }
    });
    this.on(el, '[data-a=import]', () => {
      if (box.classList.contains('hidden') || box.readOnly) {
        box.classList.remove('hidden'); box.readOnly = false; box.value = ''; box.placeholder = 'Paste the GULP-… code here, then tap Paste progress again';
        box.focus(); msg.textContent = ''; return;
      }
      try { onImport(box.value); msg.textContent = 'Progress added! ♡'; } catch (e) { msg.textContent = "That code didn't work. Copy it again and paste the whole thing."; }
    });
    // Start over: two taps (the first one just asks), so it can't happen by accident.
    const rmsg = el.querySelector('.rmsg'); let armed = 0;
    this.on(el, '[data-a=reset]', (b) => {
      if (Date.now() - armed > 5000) { armed = Date.now(); b.textContent = 'Tap again to clear my stars'; rmsg.textContent = 'This clears your level stars and best times. Your Gulp Book and hole colors stay.'; return; }
      armed = 0; onReset(); b.textContent = 'Start over'; rmsg.textContent = 'Fresh start! Level 1 is ready. Changed your mind? Tap Bring back my old stars.';
      if (!el.querySelector('[data-a=restore]')) {
        const r = document.createElement('button'); r.className = 'btn ghost small'; r.dataset.a = 'restore'; r.style.flex = '1'; r.textContent = 'Bring back my old stars';
        b.parentElement.appendChild(r);
        r.addEventListener('click', () => { if (onRestore()) { r.remove(); rmsg.textContent = 'Your old stars are back.'; } });
      }
    });
    this.on(el, '[data-a=restore]', (b) => { if (onRestore()) { b.remove(); rmsg.textContent = 'Your old stars are back.'; } });
    return this.show(el);
  }
  skins({ save, stars, onPick, onBack }) {
    const el = $(`<div class="screen dim"><div class="panel"><h2>Holes</h2><div class="sub">Earn stars to unlock more · ★ ${stars}</div>
      <div class="skins">${SKINS.map((s) => {
        const locked = stars < s.need;
        const sc = s.anim === 'rainbow' ? 'conic-gradient(#ff5fa2,#ffc93c,#2fd39a,#48b8ff,#8c6cff,#ff5fa2)' : cssColor(s.color);
        return `<button class="skin${save.skin === s.id ? ' sel' : ''}${locked ? ' locked' : ''}" data-s="${s.id}" ${locked ? 'disabled' : ''}>
          <div class="dot" style="--sc:${sc};${s.anim === 'rainbow' ? `background:radial-gradient(circle,#1a1030 54%,transparent 57%),${sc};-webkit-mask:radial-gradient(circle,#000 74%,transparent 77%);mask:radial-gradient(circle,#000 74%,transparent 77%)` : ''}"></div>
          ${s.name}${locked ? `<small>★ ${s.need}</small>` : ''}</button>`;
      }).join('')}</div>
      <button class="btn mint" data-a="back" data-focus>Done</button></div></div>`);
    this.on(el, '.skin:not(.locked)', (b) => { el.querySelectorAll('.skin').forEach((x) => x.classList.remove('sel')); b.classList.add('sel'); onPick(b.dataset.s); });
    this.on(el, '[data-a=back]', onBack);
    return this.show(el);
  }
  levelWin({ level, index, stars, best, last, time, ate, newBest, onNext, onRetry, onMap }) {
    const el = $(`<div class="screen dim"><div class="panel"><div class="ribbon" style="--c:var(--mint);--cd:var(--mint-d)">Level ${index + 1}</div>
      <h2 style="margin-top:14px">Yummy!</h2><div class="sub">${level.name} cleared</div>
      <div class="stars"><span>★</span><span>★</span><span>★</span></div>
      <div class="stat"><span>Time</span><b>${fmt(time || 0)}${newBest ? ' <em class="nb">New best!</em>' : ''}</b></div>
      <div class="stat" style="margin-bottom:14px"><span>Swallowed</span><b>${ate || 0} things</b></div>
      <div class="col">${last ? '<div class="sub">You finished every level! ♡</div>' : '<button class="btn mint" data-a="next" data-focus>Next level</button>'}
      <div class="row" style="flex-wrap:nowrap"><button class="btn sun small" data-a="retry" style="flex:1">Replay</button><button class="btn ghost small" data-a="map" style="flex:1">Levels</button></div></div></div></div>`);
    if (!last) this.on(el, '[data-a=next]', onNext);
    this.on(el, '[data-a=retry]', onRetry); this.on(el, '[data-a=map]', onMap);
    this.show(el);
    const sp = el.querySelectorAll('.stars span');
    sp.forEach((s, i) => setTimeout(() => { s.classList.add(i < stars ? 'on' : 'off'); if (i < stars) this.audio.star(i); }, 450 + i * 330));
    void best;
    return el;
  }
  timeUp({ round, onMore, onRetry, onMap }) {
    const left = round.targets.reduce((a, t) => a + Math.max(0, t.need - t.got), 0);
    const el = $(`<div class="screen dim"><div class="panel"><h2>Time's up!</h2>
      <div class="sub">So close! Just ${left} more to go.</div>
      <div class="targets" style="margin-bottom:16px">${this.chips(round.targets, true)}</div>
      <div class="col"><button class="btn mint" data-a="more" data-focus>+30 seconds</button>
      <div class="row" style="flex-wrap:nowrap"><button class="btn sun small" data-a="retry" style="flex:1">Try again</button><button class="btn ghost small" data-a="map" style="flex:1">Levels</button></div></div></div></div>`);
    el.querySelectorAll('.chip').forEach((c, i) => { const t = round.targets[i]; if (t.got >= t.need) c.classList.add('done'); });
    this.on(el, '[data-a=more]', onMore); this.on(el, '[data-a=retry]', onRetry); this.on(el, '[data-a=map]', onMap);
    return this.show(el);
  }
  raceEnd({ round, onAgain, onHome }) {
    const st = round.standings(); const place = st.indexOf(round.player) + 1;
    const words = ['1st', '2nd', '3rd', '4th', '5th', '6th'];
    const el = $(`<div class="screen dim"><div class="panel"><h2>${place === 1 ? 'You won!' : `${words[place - 1]} place`}</h2>
      <div class="sub">${place === 1 ? 'Biggest hole in town ♡' : 'So close! One more?'}</div>
      <div class="ranks">${st.map((h, i) => `<div class="${h.isPlayer ? 'me' : ''}">${i + 1}. <i style="background:${cssColor(h.color)}"></i>${h.name}<b>${Math.round(h.score)}</b></div>`).join('')}</div>
      <div class="col" style="margin-top:16px"><button class="btn mint" data-a="again" data-focus>Race again</button><button class="btn ghost small" data-a="home">Home</button></div></div></div>`);
    this.on(el, '[data-a=again]', onAgain); this.on(el, '[data-a=home]', onHome);
    return this.show(el);
  }
  zenEnd({ round, onAgain, onHome }) {
    const el = $(`<div class="screen dim"><div class="panel"><h2>Town cleared!</h2><div class="sub">You swallowed the whole town ♡</div>
      <div class="stat"><span>Eaten</span><b>${Math.round(round.progress() * 100)}%</b></div>
      <div class="stat"><span>Time</span><b>${fmt(round.time)}</b></div>
      <div class="col" style="margin-top:16px"><button class="btn mint" data-a="again" data-focus>New town</button><button class="btn ghost small" data-a="home">Home</button></div></div></div>`);
    this.on(el, '[data-a=again]', onAgain); this.on(el, '[data-a=home]', onHome);
    return this.show(el);
  }

  // ------------------------------------------------------------ Gulp Book (collection)
  book({ groups, eaten, onBack }) {
    const all = groups.flatMap((g) => g.ids);
    const found = all.filter((id) => eaten[id]).length;
    const total = Object.values(eaten).reduce((a, b) => a + b, 0);
    const el = $(`<div class="screen" style="background:linear-gradient(180deg,#b9a6ff,#ffc2dc)">
      <div class="maptop"><button class="btn ghost round" data-a="back" aria-label="Back">‹</button><h2>Gulp Book</h2><div class="starcount">${found}/${all.length}</div></div>
      <div class="world" style="text-align:center;font-weight:600">You've swallowed <b>${total.toLocaleString()}</b> things so far ♡</div>
      ${groups.map((g) => `<div class="world" style="--wc:${g.color}"><h3><i></i>${g.label}<span style="margin-left:auto;font-size:15px;color:var(--ink2)">${g.ids.filter((id) => eaten[id]).length}/${g.ids.length}</span></h3>
        <div class="bookgrid">${g.ids.map((id) => {
          const n = eaten[id] || 0;
          return `<div class="bk${n ? '' : ' unknown'}"><img alt="" src="${this.icons.get(id, 0)}"><span>${n ? PROPS[id].label : '???'}</span>${n ? `<b>×${n}</b>` : ''}</div>`;
        }).join('')}</div></div>`).join('')}
      <div style="height:20px;flex:none"></div></div>`);
    this.on(el, '[data-a=back]', onBack);
    return this.show(el);
  }
  toastNew(id) {
    const el = $(`<div class="toast"><img alt="" src="${this.icons.get(id, 0)}"><div><small>New in your Gulp Book!</small>${PROPS[id].label}</div></div>`);
    this.fx.append(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 500); }, 2200);
  }

  // ------------------------------------------------------------ Zen place picker
  zenPicker({ places, autoSteer, onPick, onToggle, onBack }) {
    const el = $(`<div class="screen" style="background:linear-gradient(180deg,#8fe3c3,#c9f2ff)">
      <div class="maptop"><button class="btn ghost round" data-a="back" aria-label="Back">‹</button><h2>Zen</h2><div style="width:52px"></div></div>
      <div class="world" style="text-align:center;font-weight:600">No timer, no rush. Things come back after you eat them ♡
        <div class="toggle" style="justify-content:center;gap:12px;font-size:17px">Auto-steer when I let go <button class="switch ${autoSteer ? 'on' : ''}" data-k="autoSteer" aria-label="Auto-steer"></button></div></div>
      <div class="places">${places.map((p, i) => `<button class="place${p.locked ? ' locked' : ''}" data-p="${i}" ${p.locked ? 'disabled' : ''} style="--wc:${p.accent}">
          <img alt="" src="${p.icon}"><span>${p.label}</span>${p.locked ? '<small>Unlock by playing levels</small>' : ''}</button>`).join('')}</div>
      <div style="height:20px;flex:none"></div></div>`);
    this.on(el, '[data-a=back]', onBack);
    this.on(el, '.place:not(.locked)', (b) => onPick(places[+b.dataset.p]));
    this.bindToggles(el, onToggle);
    return this.show(el);
  }

  // First-ever play: a little finger draws a loop to show "drag anywhere".
  fingerHint() {
    const el = $(`<div class="finger"><svg viewBox="0 0 64 64" width="64" height="64"><circle cx="22" cy="18" r="10" fill="rgba(255,255,255,.55)"/><path d="M22 18v26c0 6 4 12 12 12h4c8 0 12-6 12-12V34c0-3-2-5-5-5s-5 2-5 5v-4c0-3-2-5-5-5s-5 2-5 5v-4c0-3-2-5-5-5s-4 2-4 5V18c0-3-2-5-5-5s-4 2-4 5z" fill="#fff" stroke="#2b2141" stroke-width="3" stroke-linejoin="round"/></svg><div>Drag anywhere to move</div></div>`);
    this.fx.append(el);
    return () => { el.classList.add('out'); setTimeout(() => el.remove(), 400); };
  }
}
