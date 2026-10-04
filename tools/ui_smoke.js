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
  await click('[data-a=reset]', 'settings: Start over (asks first)');
  steps.push((JSON.stringify(JSON.parse(localStorage.getItem('gulp.save.v1')).stars) === starsBefore ? 'ok   ' : 'MISS ') + 'first tap did not clear anything');
  await click('[data-a=reset]', 'settings: Start over (confirm)');
  steps.push((Object.keys(JSON.parse(localStorage.getItem('gulp.save.v1')).stars).length === 0 ? 'ok   ' : 'MISS ') + 'stars cleared');
  await click('[data-a=restore]', 'settings: Bring back my old stars');
  steps.push((JSON.stringify(JSON.parse(localStorage.getItem('gulp.save.v1')).stars) === starsBefore ? 'ok   ' : 'MISS ') + 'old stars restored');
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
