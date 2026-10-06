// UI smoke test: drives the REAL buttons through every screen and result path.
// Run in the browser on a built page (paste into the console / javascript tool).
// Returns { pass, steps, errs }. Lesson from the +30s blocker: never call game APIs
// directly for UI paths; click what Amanda would click.
(async () => {
  const errs = [];
  const oe = console.error;
  console.error = (...a) => { errs.push(a.map((x) => String(x?.message || x)).join(' ').slice(0, 200)); oe(...a); };
  addEventListener('error', (e) => errs.push('E:' + e.message));
  const steps = [];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const q = (s) => document.querySelector(s);
  const waitFor = async (sel, ms = 6000) => { const t = performance.now(); while (performance.now() - t < ms) { const e = q(sel); if (e) return e; await sleep(60); } return null; };
  const click = async (sel, label) => {
    const el = await waitFor(sel);
    steps.push((el ? 'ok   ' : 'MISS ') + label);
    if (el) { el.click(); await sleep(250); }
    return !!el;
  };
  const G = () => window.__game;
  const autopilotWin = async (maxSec = 120) => {
    const R = G().round, p = R.player; let n = 0;
    while (!R.over && n < 60 * maxSec) { R.think(p, 1 / 60); R.update(1 / 60, { x: p.ai.ix, z: p.ai.iz }); n++; }
    return R.over;
  };
  const forceTimeUp = () => { const R = G().round; R.time = R.duration + 0.01; R.update(1 / 60, { x: 0, z: 0 }); };

  while (q('#loading')) await sleep(100);
  // 1) title -> level -> pause paths
  await click('[data-a=play]', 'title: Play (next level)');
  await click('[data-a=go]', "intro: Let's go");
  await sleep(2600);
  steps.push((document.querySelectorAll('.helper').length === 3 ? 'ok   ' : 'MISS ') + 'hud: 3 helpers');
  await click('.helper[data-h=magnet]', 'hud: Magnet');
  await click('.hud .pause', 'hud: Pause');
  await click('[data-a=resume]', 'pause: Keep playing');
  await click('.hud .pause', 'hud: Pause again');
  await click('[data-a=restart]', 'pause: Start over');
  await click('[data-a=go]', "intro: Let's go (restart)");
  await sleep(2600);
  // 2) time up -> +30 -> time up -> try again
  forceTimeUp(); await sleep(300);
  await click('[data-a=more]', 'timeUp: +30 seconds');
  steps.push((q('.hud') && q('.helper') && !G().round.paused ? 'ok   ' : 'MISS ') + 'after +30: HUD + helpers + running');
  forceTimeUp(); await sleep(300);
  await click('[data-a=retry]', 'timeUp: Try again');
  await click('[data-a=back]', 'intro: Back to levels');
  await click('.lvl:not(.locked)', 'map: pick a level');
  await click('[data-a=go]', "intro: Let's go");
  await sleep(2600);
  // 3) win -> next level / replay / levels
  steps.push(((await autopilotWin()) ? 'ok   ' : 'MISS ') + 'level won by autopilot');
  await click('[data-a=next], [data-a=retry]', 'win: Next level (or Replay on last)');
  await click('[data-a=back]', 'intro: Back to levels');
  await click('[data-a=back]', 'map: Back to title');
  // 3b) MASTER MODE (crowns): toggle, Master intro, Master time-up (no +30 s), Master win.
  //     Easy mode is switched ON first: Master must still use the Master timer + CHALLENGE growth.
  const okIf = (c, label) => steps.push((c ? 'ok   ' : 'MISS ') + label);
  const saved = () => JSON.parse(localStorage.getItem('gulp.save.v1') || '{}');
  await click('[data-a=settings]', 'title: Settings (turn Easy mode on)');
  if (!q('.switch[data-k=relaxed]')?.classList.contains('on')) await click('.switch[data-k=relaxed]', 'settings: Easy mode ON');
  okIf(saved().relaxed === true, 'Easy mode is on');
  await click('[data-a=back]', 'settings: Done');
  okIf(/\d/.test(q('[data-a=master] .ccount')?.textContent || ''), 'title: Master button shows crown total');
  await click('[data-a=master]', 'title: Master');
  okIf(!!q('.mastermap') && !!q('.mtab.on[data-a=mode-master]'), 'map opens on the Master tab');
  await click('[data-a=mode-levels]', 'map: Levels tab');
  okIf(!q('.mastermap') && !!q('.mtab.on[data-a=mode-levels]') && !!q('.lvl .st'), 'map: normal levels showing');
  okIf(document.querySelectorAll('.world h3 .wcrowns').length > 0, 'map: world headers show crowns');
  await click('[data-a=mode-master]', 'map: Master tab');
  okIf(!!q('.mastermap') && q('.maptop h2')?.textContent === 'Master', 'map: Master levels showing');
  await click('.mastermap .lvl:not(.locked)', 'master map: pick a cleared level');
  okIf(/Master/.test(q('.intro .ribbon')?.textContent || '') && !!q('.intro.master'), 'intro says Master');
  const mT = () => G().masterTime(G().round.level);
  okIf(G().round.master === true && Math.abs(G().round.duration - mT()) < 0.6, `round uses the Master timer (${G().round.duration}s)`);
  okIf((q('.introtime')?.textContent || '').includes(`${Math.floor(mT() / 60)}:${String(mT() % 60).padStart(2, '0')}`), 'intro shows the Master timer');
  okIf(G().round.player.growMul < 1, `CHALLENGE growth even in Easy mode (growMul ${G().round.player.growMul})`);
  await click('[data-a=go]', "master intro: Let's go");
  await sleep(2600);
  okIf(document.querySelectorAll('.helper').length === 0 && !q('.helpers'), 'master hud: no helpers');
  okIf(!!q('.timer.mtimer'), 'master hud: Master timer');
  await click('.hud .pause', 'master: Pause');
  await click('[data-a=restart]', 'master pause: Start over');
  okIf(!!q('.intro.master'), 'master restart keeps Master');
  await click('[data-a=go]', "master intro: Let's go (restart)");
  await sleep(2600);
  forceTimeUp(); await sleep(300);
  okIf(!q('[data-a=more]') && /So close/.test(q('.panel h2')?.textContent || ''), 'master time up: "So close", no +30 seconds');
  await click('[data-a=retry]', 'master time up: Try again');
  okIf(!!q('.intro.master'), 'try again keeps Master');
  await click('[data-a=go]', "master intro: Let's go (again)");
  await sleep(2600);
  const mid = G().round.level.id;
  okIf(await autopilotWin(), 'master level won by autopilot');
  await waitFor('.bigcrown');
  okIf(/Crown earned/.test(q('.panel h2')?.textContent || ''), 'master win: "Crown earned!"');
  okIf(saved().crowns?.[mid] === 1 && typeof saved().masterBest?.[mid] === 'number', `crown + Master best saved for L${mid}`);
  okIf(saved().best?.[mid] === undefined || typeof saved().best[mid] === 'number', 'normal best untouched by Master');
  await click('[data-a=map]', 'master win: Levels');
  okIf(!!q('.mastermap .lvl.crowned') && /[1-9]/.test(q('.starcount')?.textContent || ''), 'master map: crowned level + crown count');
  await click('[data-a=mode-levels]', 'map: back to Levels tab');
  okIf(!!q('.lvl .cr'), 'levels map: crown badge on the crowned level');
  await click('[data-a=back]', 'map: Back to title');
  okIf(/[1-9]/.test(q('[data-a=master] .ccount')?.textContent || ''), 'title: crown total counts the new crown');
  await click('[data-a=settings]', 'title: Settings (Easy mode off)');
  if (q('.switch[data-k=relaxed]')?.classList.contains('on')) await click('.switch[data-k=relaxed]', 'settings: Easy mode OFF');
  await click('[data-a=back]', 'settings: Done');
  // 4) zen
  await click('[data-a=zen]', 'title: Zen');
  await click('.place:not(.locked)', 'zen: pick first place');
  await sleep(500);
  await click('.hud .pause', 'zen: Pause');
  await click('[data-a=quit]', 'zen pause: Quit');
  // 5) race
  await click('[data-a=race]', 'title: Race');
  await sleep(2600);
  await click('.hud .pause', 'race: Pause');
  await click('[data-a=quit]', 'race pause: Quit');
  // 6) book, holes, settings + progress copy/paste
  await click('[data-a=book]', 'title: Gulp Book');
  await click('[data-a=back]', 'book: Back');
  await click('[data-a=skins]', 'title: Holes');
  await click('.skin:not(.locked)', 'holes: pick');
  await click('[data-a=back]', 'holes: Done');
  await click('[data-a=settings]', 'title: Settings');
  await click('.switch[data-k=relaxed]', 'settings: Relaxed toggle');
  await click('.switch[data-k=relaxed]', 'settings: Relaxed toggle back');
  // Start over: first tap only asks, second clears, then Bring back restores (Kyle 10/04)
  const starsBefore = JSON.stringify(JSON.parse(localStorage.getItem('gulp.save.v1') || '{}').stars || {});
  const crownsBefore = JSON.stringify(JSON.parse(localStorage.getItem('gulp.save.v1') || '{}').crowns || {});
  const mbestBefore = JSON.stringify(JSON.parse(localStorage.getItem('gulp.save.v1') || '{}').masterBest || {});
  await click('[data-a=reset]', 'settings: Start over (asks first)');
  steps.push((JSON.stringify(JSON.parse(localStorage.getItem('gulp.save.v1')).stars) === starsBefore ? 'ok   ' : 'MISS ') + 'first tap did not clear anything');
  await click('[data-a=reset]', 'settings: Start over (confirm)');
  steps.push((Object.keys(JSON.parse(localStorage.getItem('gulp.save.v1')).stars).length === 0 ? 'ok   ' : 'MISS ') + 'stars cleared');
  steps.push((crownsBefore !== '{}' && Object.keys(JSON.parse(localStorage.getItem('gulp.save.v1')).crowns).length === 0 && Object.keys(JSON.parse(localStorage.getItem('gulp.save.v1')).masterBest).length === 0 ? 'ok   ' : 'MISS ') + 'crowns + Master best times cleared');
  await click('[data-a=restore]', 'settings: Bring back my old stars');
  steps.push((JSON.stringify(JSON.parse(localStorage.getItem('gulp.save.v1')).stars) === starsBefore ? 'ok   ' : 'MISS ') + 'old stars restored');
  steps.push((JSON.stringify(JSON.parse(localStorage.getItem('gulp.save.v1')).crowns) === crownsBefore && JSON.stringify(JSON.parse(localStorage.getItem('gulp.save.v1')).masterBest) === mbestBefore ? 'ok   ' : 'MISS ') + 'old crowns + Master best times restored');
  await click('[data-a=export]', 'settings: Copy my progress');
  const code = q('#xfercode')?.value || '';
  steps.push((code.startsWith('GULP-') ? 'ok   ' : 'MISS ') + 'progress code produced');
  await click('[data-a=import]', 'settings: Paste progress (open box)');
  const box = q('#xfercode'); if (box) box.value = code;
  await click('[data-a=import]', 'settings: Paste progress (apply)');
  steps.push((/added/.test(q('.xmsg')?.textContent || '') ? 'ok   ' : 'MISS ') + 'progress import message');
  await click('[data-a=back]', 'settings: Done');
  steps.push((q('[data-a=play]') ? 'ok   ' : 'MISS ') + 'back on title screen');
  console.error = oe;
  const pass = steps.every((s) => s.startsWith('ok')) && errs.length === 0;
  return JSON.stringify({ pass, steps, errs });
})();
