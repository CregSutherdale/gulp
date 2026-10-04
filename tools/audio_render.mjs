// Render every Gulp! sound through the REAL src/engine/audio.js in headless Chrome
// (OfflineAudioContext), write WAVs, and print a level table. Also verifies the music
// runtime path end to end: lazy fetch of music/<id>.m4a, decode, loop seams as the
// browser actually plays them, crossfade smoothness, compressor makeup compensation and
// worst-case headroom.
//
//   node tools/audio_render.mjs [outDir]        (default: <tmp>/gulp_audio_sfx)
//
// Headless: the browser never opens a window. It is killed (whole tree) on exit.
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const LIVE = argv.includes('--live') ? argv[argv.indexOf('--live') + 1] : null;
const OUT = path.resolve(argv.find((a, i) => !a.startsWith('--') && argv[i - 1] !== '--live') || path.join(os.tmpdir(), 'gulp_audio_sfx'));
fs.mkdirSync(OUT, { recursive: true });

// ------------------------------------------------------------------ the in-page harness
const PAGE = `<!doctype html><meta charset="utf-8"><title>audio test</title><script type="module">
import { Audio, CREDITS, MUSIC_KEYS, materialOf } from '/src/engine/audio.js';
const SR = 48000;
const seeded = (s) => () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
function fresh(ctx, opts = {}) {
  const au = new Audio();
  au.rng = seeded(opts.seed || 7);
  au.attach(ctx, opts);
  au.setMusic(false);                 // SFX tests run dry unless a test wants music
  au.playMusic(opts.key || 'bakery'); // sets the SFX key (C) without loading audio
  return au;
}
function stats(buf, from = 0) {
  let pk = 0, ss = 0;
  const n = buf.length, i0 = Math.floor(from * SR);
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let i = i0; i < n; i++) { const a = Math.abs(d[i]); if (a > pk) pk = a; ss += d[i] * d[i]; }
  }
  return { peak: pk, rms: Math.sqrt(ss / ((n - i0) * buf.numberOfChannels)) };
}
function b64(buf, from = 0) {
  const i0 = Math.floor(from * SR), n = buf.length - i0, inter = new Float32Array(n * 2);
  const L = buf.getChannelData(0), R = buf.getChannelData(buf.numberOfChannels > 1 ? 1 : 0);
  for (let i = 0; i < n; i++) { inter[2 * i] = L[i0 + i]; inter[2 * i + 1] = R[i0 + i]; }
  const u8 = new Uint8Array(inter.buffer);
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(s);
}
// events: [[t, fn, ...args]] ; fn is an Audio method name, or a function(au)
// Chrome's DynamicsCompressor starts with its detector at 0 and fades in over its release
// time, so every test event is placed after a WARM second of silence.
const WARM = 0.6;
async function renderEvents(dur, events, opts = {}) {
  events = events.map((e) => [e[0] + WARM, ...e.slice(1)]);
  dur += WARM;
  const ctx = new OfflineAudioContext(2, Math.ceil(SR * dur), SR);
  const au = fresh(ctx, opts);
  const q = 128 / SR, groups = new Map();
  for (const ev of events) {
    const tq = Math.round(ev[0] / q) * q;
    if (!groups.has(tq)) groups.set(tq, []);
    groups.get(tq).push(ev);
  }
  const call = (ev) => (typeof ev[1] === 'function' ? ev[1](au) : au[ev[1]](...ev.slice(2)));
  for (const [tq, evs] of groups) {
    if (tq <= 0) evs.forEach(call);
    else ctx.suspend(tq).then(() => { evs.forEach(call); ctx.resume(); });
  }
  return ctx.startRendering();
}
window.__sfx = async (name, dur, events, wav) => {
  const buf = await renderEvents(dur, events);
  const raw = await renderEvents(dur, events, { noLimiter: true });
  const s = stats(buf, WARM - 0.01), r = stats(raw, WARM - 0.01);
  return { name, peak: s.peak, rms: s.rms, rawPeak: r.peak, wav: wav ? b64(buf, WARM - 0.05) : null };
};
// Unity check: a -30 dBFS tone through each bus (below every threshold) must come out
// at exactly its designed level (makeup gain compensated).
window.__unity = async () => {
  const out = {};
  for (const bus of ['sfxIn', 'musicBus']) {
    const ctx = new OfflineAudioContext(2, SR, SR);
    const au = new Audio(); au.attach(ctx); au.setMusic(true);
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = 1000; g.gain.value = Math.pow(10, -30 / 20);
    o.connect(g); g.connect(au[bus]); o.start(0);
    const b = await ctx.startRendering();
    const d = b.getChannelData(0); let pk = 0;
    for (let i = SR / 2; i < SR; i++) pk = Math.max(pk, Math.abs(d[i]));
    out[bus] = 20 * Math.log10(pk);
  }
  return out;
};
// Music: lazy-load every track via the real playMusic path, check decoded length,
// render across the loop seam and measure the click metric.
window.__music = async () => {
  const res = [];
  const ids = [...new Set(Object.values(MUSIC_KEYS))];
  for (const id of ids) {
    const probeCtx = new OfflineAudioContext(2, SR, SR);
    const au = new Audio(); au.attach(probeCtx);
    const t0 = performance.now();
    const buf = await au._loadTrack(id);
    const ms = performance.now() - t0;
    const info = { id, ok: !!buf, decodeMs: Math.round(ms) };
    if (!buf) { res.push(info); continue; }
    info.duration = buf.duration;
    // loop seam: start 1.5 s before loopEnd, render 3 s
    const ctx = new OfflineAudioContext(2, SR * 3, SR);
    const au2 = new Audio(); au2.attach(ctx);
    au2.decoded.set(id, buf);
    au2.setMusic(true);
    au2.playMusic(id);
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    const tr = au2.track;
    if (!tr) { info.err = 'no track started'; res.push(info); continue; }
    // restart the source just before the seam, at full level (no fade)
    tr.src.stop(0); tr.g.gain.cancelScheduledValues(0); tr.g.gain.value = 1;
    const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true;
    s.loopStart = tr.src.loopStart; s.loopEnd = tr.src.loopEnd;
    s.connect(tr.g); s.start(0, s.loopEnd - 1.5);
    info.loopStart = s.loopStart; info.loopEnd = s.loopEnd;
    const out = await ctx.startRendering();
    const d = out.getChannelData(0), e = out.getChannelData(1);
    const seam = Math.round(1.5 * SR);
    const d2 = new Float32Array(d.length);
    for (let i = 1; i < d.length - 1; i++) d2[i] = Math.abs(d[i + 1] - 2 * d[i] + d[i - 1]) + Math.abs(e[i + 1] - 2 * e[i] + e[i - 1]);
    let seamMax = 0;
    for (let i = seam - 96; i < seam + 96; i++) seamMax = Math.max(seamMax, d2[i]);
    const sorted = Array.from(d2.subarray(2000, d2.length - 2000)).sort((a, b) => a - b);
    info.click = seamMax / sorted[Math.floor(sorted.length * 0.999)];
    // RMS just before vs just after the seam (level continuity)
    const rms = (a, b) => { let ss = 0; for (let i = a; i < b; i++) ss += d[i] * d[i] + e[i] * e[i]; return Math.sqrt(ss / (2 * (b - a))); };
    info.jumpDb = 20 * Math.log10(rms(seam, seam + 4800) / rms(seam - 4800, seam));
    res.push(info);
  }
  return res;
};
// Crossfade: two stationary noise 'tracks' (equal RMS, uncorrelated) stand in for menu and
// bakery so the equal-power law is measurable: the sum must stay flat through the fade.
window.__xfade = async () => {
  const ctx = new OfflineAudioContext(2, SR * 6, SR);
  const au = new Audio(); au.rng = seeded(3); au.attach(ctx); au.setMusic(true);
  const mk = (seed) => { const b = ctx.createBuffer(2, SR * 8, SR), r = seeded(seed); for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] = (r() * 2 - 1) * 0.1; } return b; };
  au.decoded.set('peaceful_village', mk(11)); au.decoded.set('lively_city', mk(12));
  au.playMusic('menu');
  await new Promise((r) => setTimeout(r, 0)); await new Promise((r) => setTimeout(r, 0));
  ctx.suspend(2.0).then(async () => {
    au.playMusic('bakery');
    await new Promise((r) => setTimeout(r, 0)); await new Promise((r) => setTimeout(r, 0));
    ctx.resume();
  });
  const b = await ctx.startRendering();
  const d = b.getChannelData(0), e = b.getChannelData(1), env = [];
  for (let s = 0; s + 2400 <= d.length; s += 2400) { let ss = 0; for (let i = s; i < s + 2400; i++) ss += d[i] * d[i] + e[i] * e[i]; env.push(10 * Math.log10(ss / 4800 + 1e-12)); }
  return { env, keyAfter: au.root, track: au.track && au.track.id };
};
window.__materials = (ids) => Object.fromEntries(ids.map((id) => [id, materialOf({ id })]));
window.__credits = CREDITS;
window.__ready = true;
</script>`;

// ------------------------------------------------------------------ static server
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.m4a': 'audio/mp4', '.html': 'text/html', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (u === '/__audio_test.html') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(PAGE); }
  let f = u.startsWith('/music/') ? path.join(ROOT, 'public', u) : path.join(ROOT, u);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const PORT = server.address().port;

// ------------------------------------------------------------------ headless chrome via CDP
const CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
];
const exe = CANDIDATES.find((p) => fs.existsSync(p));
if (!exe) { console.error('no Chrome/Edge found'); process.exit(2); }
// Sweep temp profiles left by earlier runs (Windows can hold a lock briefly after exit).
for (const d of fs.readdirSync(os.tmpdir()).filter((x) => x.startsWith('gulp-audio-chrome-'))) {
  try { fs.rmSync(path.join(os.tmpdir(), d), { recursive: true, force: true }); } catch (e) { /* still locked: next run */ }
}
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'gulp-audio-chrome-'));
const chrome = spawn(exe, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--autoplay-policy=no-user-gesture-required',
  '--disable-gpu', '--mute-audio', '--disable-component-update', '--disable-background-networking',
  '--disable-extensions', '--disable-sync', '--no-pings', '--disable-default-apps', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
const chromeExited = new Promise((r) => chrome.once('exit', r));
// Kill the whole browser tree, wait for it to really exit, then remove the temp profile.
async function shutdown() {
  killChrome();
  await Promise.race([chromeExited, new Promise((r) => setTimeout(r, 5000))]);
  try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 40, retryDelay: 200 }); } catch (e) { console.warn(`note: temp profile still locked (${e.code}); the next run sweeps it`); }
}
const killChrome = () => {
  try { if (process.platform === 'win32') execSync(`taskkill /PID ${chrome.pid} /T /F`, { stdio: 'ignore' }); else chrome.kill('SIGKILL'); } catch (e) { /* gone */ }
};
process.on('exit', killChrome);
process.on('SIGINT', () => process.exit(130));

const wsUrl = await new Promise((resolve, reject) => {
  let buf = '';
  const to = setTimeout(() => reject(new Error('chrome did not start')), 20000);
  chrome.stderr.on('data', (d) => {
    buf += d;
    const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
    if (m) { clearTimeout(to); resolve(m[1]); }
  });
});
const dbgPort = new URL(wsUrl).port;
const tab = await (await fetch(`http://127.0.0.1:${dbgPort}/json/new?${LIVE ? 'about:blank' : `http://127.0.0.1:${PORT}/__audio_test.html`}`, { method: 'PUT' })).json();
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let msgId = 0;
const pending = new Map();
const consoleLines = [];
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === 'Runtime.consoleAPICalled') consoleLines.push(m.params.args.map((a) => a.value ?? a.description).join(' '));
  if (m.method === 'Runtime.exceptionThrown') consoleLines.push('EXCEPTION ' + JSON.stringify(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
});
const cdp = (method, params = {}) => new Promise((r) => { const id = ++msgId; pending.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
await cdp('Runtime.enable');
const evaluate = async (expr) => {
  const r = await cdp('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text);
  return r.result.result.value;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ------------------------------------------------------------------ live mode: the real game
// Loads the running game, taps like a person (trusted input = a real user gesture), enters Zen
// and lets auto-steer eat. Proves unlock, lazy music, legacy calls and live SFX end to end.
if (LIVE) {
  let code = 0;
  try {
    await cdp('Page.enable'); await cdp('Network.enable');
    const music = [];
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data);
      if (m.method === 'Network.responseReceived' && /\/music\//.test(m.params.response.url)) music.push(`${m.params.response.status} ${m.params.response.url.replace(/^.*\/music\//, 'music/')}`);
    });
    await cdp('Page.addScriptToEvaluateOnNewDocument', { source: `
      window.__ctxs = []; window.__src = []; window.__osc = 0;
      const C = window.AudioContext;
      window.AudioContext = class extends C { constructor(...a) { super(...a); window.__ctxs.push(this); } };
      const bs = AudioBufferSourceNode.prototype.start;
      AudioBufferSourceNode.prototype.start = function (...a) {
        if (this.buffer && this.buffer.duration > 5) window.__src.push({ dur: +this.buffer.duration.toFixed(3), loop: this.loop, ls: this.loopStart, le: +this.loopEnd.toFixed(3), off: a[1] });
        return bs.apply(this, a);
      };
      const os = OscillatorNode.prototype.start;
      OscillatorNode.prototype.start = function (...a) { window.__osc++; return os.apply(this, a); };` });
    await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await cdp('Page.navigate', { url: LIVE });
    for (let i = 0; i < 80 && !(await evaluate('!!(window.__game && !document.getElementById("loading"))').catch(() => false)); i++) await sleep(250);
    const before = await evaluate('({ ctxs: window.__ctxs.length, osc: window.__osc })');
    console.log(`live: game booted; before any tap: ${before.ctxs} AudioContext(s) (iOS rule: must be 0), ${before.osc} oscillators`);
    const tap = async (x, y) => {
      await cdp('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
      await cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
    };
    await tap(20, 820); // first touch anywhere: the unlock gesture
    await sleep(3000);
    const s1 = await evaluate('({ state: window.__ctxs[0]?.state, t: window.__ctxs[0]?.currentTime, src: window.__src })');
    console.log(`live: after first tap: context ${s1.state}, clock ${s1.t?.toFixed(2)} s; music starts: ${JSON.stringify(s1.src)}`);
    console.log(`live: music requests: ${music.join(', ') || 'none'}`);
    const zen = await evaluate(`(() => { const b = [...document.querySelectorAll('#ui button')].find((x) => /zen/i.test(x.textContent)); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, label: b.textContent.trim() }; })()`);
    if (zen) {
      const o0 = await evaluate('window.__osc');
      const hit = await evaluate(`(() => { const e = document.elementFromPoint(${zen.x}, ${zen.y}); return e ? e.tagName + '.' + e.className + ' "' + (e.textContent || '').trim().slice(0, 30) + '"' : 'nothing'; })()`);
      await tap(zen.x, zen.y);
      await sleep(800);
      // The Zen button may open a setup screen first: press its start button if there is one.
      const go = await evaluate(`(() => { const bs = [...document.querySelectorAll('#ui button')]; const b = bs.find((x) => !x.disabled && x.textContent.trim().length > 2 && !/unlock|‹/i.test(x.textContent)); return { all: bs.map((x) => x.textContent.trim().slice(0, 18)), go: b ? (() => { const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, label: b.textContent.trim() }; })() : null }; })()`);
      console.log(`live: buttons on the next screen: ${JSON.stringify(go.all)}`);
      if (go.go) { await tap(go.go.x, go.go.y); console.log(`live: pressed "${go.go.label}"`); }
      await sleep(12000);
      const o1 = await evaluate('window.__osc');
      const st = await evaluate(`({ kind: window.__game?.round?.kind, eaten: window.__game?.round?.player?.score, screen: document.querySelector('#ui')?.innerText.replace(/\\s+/g, ' ').slice(0, 80) })`);
      console.log(`live: element under the tap: ${hit}; round after: ${JSON.stringify(st)}`);
      console.log(`live: tapped "${zen.label}", 12 s of Zen auto-steer: ${o1 - o0} oscillator starts (taps, pops, chimes)`);
      if (o1 - o0 < 3) { console.log('live: FAIL no SFX activity'); code = 1; }
    } else console.log('live: (no Zen button found on this screen; skipped the gameplay part)');
    const errs = consoleLines.filter((l) => /EXCEPTION|error|failed|unknown music/i.test(l));
    console.log(`live: console errors/warnings about audio: ${errs.length ? errs.join(' | ') : 'none'}`);
    if (errs.length || s1.state !== 'running' || !s1.src.length || !music.length || before.ctxs) code = 1;
  } catch (e) { console.error('LIVE ERROR', e.message); code = 1; }
  ws.close(); server.close(); await shutdown();
  console.log(`LIVE RESULT: ${code ? 'problems' : 'ok'}`);
  process.exit(code);
}
for (let i = 0; i < 100 && !(await evaluate('!!window.__ready')); i++) await new Promise((r) => setTimeout(r, 100));
if (!(await evaluate('!!window.__ready'))) { console.error('harness did not load:\n' + consoleLines.join('\n')); process.exit(3); }

// ------------------------------------------------------------------ the sound list
const P = (id, value) => JSON.stringify({ id, value });
const SFX = [
  // material pops: [name, prop, combo]
  ['pop soft daisy v1 c3', P('daisy', 1), 3], ['pop soft teddy v2 c6', P('teddy', 2), 6], ['pop soft hedge v4 c2', P('hedge', 4), 2],
  ['pop squishy donut v1 c3', P('donut', 1), 3], ['pop squishy cake v4 c6', P('cake', 4), 6], ['pop squishy layercake v13 c2', P('layercake', 13), 2],
  ['pop crunchy cookie v1 c3', P('cookie', 1), 3], ['pop crunchy croissant v2 c8', P('croissant', 2), 8], ['pop crunchy gingerhouse v45 c1', P('gingerhouse', 45), 1],
  ['pop plastic toyball v1 c3', P('toyball', 1), 3], ['pop plastic duck v2 c5', P('duck', 2), 5], ['pop plastic playcastle v42 c1', P('playcastle', 42), 1],
  ['pop wood block v1 c3', P('block', 1), 3], ['pop wood rockinghorse v4 c4', P('rockinghorse', 4), 4], ['pop wood dollhouse v18 c2', P('dollhouse', 18), 2],
  ['pop metal wateringcan v2 c3', P('wateringcan', 2), 3], ['pop metal fridge v11 c4', P('fridge', 11), 4], ['pop metal stove v26 c2', P('stove', 26), 2],
  ['pop ceramic cup v1 c3', P('cup', 1), 3], ['pop ceramic cup v1 c11', P('cup', 1), 11], ['pop ceramic teapot v3 c6', P('teapot', 3), 6], ['pop ceramic apartment v95 c1', P('apartment', 95), 1],
  ['pop fruit grape v1 c3', P('grape', 1), 3], ['pop fruit apple v1 c9', P('apple', 1), 9], ['pop fruit watermelon v6 c4', P('watermelon', 6), 4],
  ['pop person v1 c3', P('person', 1), 3], ['pop person v1 c11', P('person', 1), 11], ['pop critter crab v2 c4', P('crab', 2), 4],
  ['pop vehicle car v6 c3', P('car', 6), 3], ['pop vehicle bus v22 c2', P('bus', 22), 2], ['pop vehicle bike v3 c4', P('bike', 3), 4],
  ['pop legacy number v5 c4', '5', 4],
].map(([name, prop, combo]) => ({ name, dur: 1.4, ev: `[[0,'pop',${prop},${combo}]]` }));
const one = (name, fn, args = '', dur = 1.6) => ({ name, dur, ev: `[[0,'${fn}'${args ? ',' + args : ''}]]` });
SFX.push(
  one('gulp v30', 'gulp', '30'), one('gulp v160', 'gulp', '160'), one('sizeUp', 'sizeUp', '', 1.8),
  one('target 0.2', 'target', '0.2'), one('target 1.0', 'target', '1'),
  one('rimWobble', 'rimWobble'), one('bonk (alias)', 'bonk'), one('tick', 'tick', 'false', 0.6), one('tick urgent', 'tick', 'true', 0.6),
  one('tap', 'tap', '', 0.6), one('uiOpen', 'uiOpen', '', 0.8), one('uiClose', 'uiClose', '', 0.8),
  one('star 0', 'star', '0'), one('star 1', 'star', '1'), one('star 2', 'star', '2'),
  one('win', 'win', '', 3.2), one('timeUp', 'timeUp', '', 2.4), one('swallowedHole', 'swallowedHole', '', 2.0),
  one('levelStart', 'levelStart', '', 1.8), one('lastOne', 'lastOne', '', 1.6), one('reward', 'reward', '', 2.6),
  one('boosterMagnet', 'boosterMagnet', '', 2.0), one('boosterFreeze', 'boosterFreeze', '', 2.2), one('boosterGrow', 'boosterGrow', '', 2.2),
);
// combo run: 20 swallows, 70 ms apart (the melody climbs, then sparkles on top)
SFX.push({ name: 'combo run x20', dur: 2.6, ev: JSON.stringify(Array.from({ length: 20 }, (_, i) => [i * 0.07, 'pop', { id: 'donut', value: 1 }, i + 1])) });
// a pile: 30 swallows in the SAME instant (strum + backlog + voice cap)
SFX.push({ name: 'pile x30 same frame', dur: 1.6, ev: JSON.stringify(Array.from({ length: 30 }, (_, i) => [0, 'pop', { id: ['candy', 'cookie', 'donut', 'cup'][i % 4], value: 1 }, i + 1])) });
// worst case: big things + gulps + fanfare all at once (headroom)
SFX.push({ name: 'storm (worst case)', dur: 3.2, ev: JSON.stringify([
  [0, 'win'], [0, 'sizeUp'], [0, 'swallowedHole'], [0, 'reward'],
  ...Array.from({ length: 12 }, (_, i) => [i * 0.02, 'pop', { id: ['stove', 'bus', 'gingerhouse', 'dollhouse'][i % 4], value: 40 }, i + 1]),
]) });
// a run of Gulp Book discoveries: one fanfare, then light dings (no machine-gun fanfares)
SFX.push({ name: 'reward x6 in 3s', dur: 4.2, ev: JSON.stringify(Array.from({ length: 6 }, (_, i) => [i * 0.5, 'reward'])) });
// rate limits: rimWobble x10 over 2 s must sound only a few times
SFX.push({ name: 'rimWobble x10 in 2s', dur: 2.6, ev: JSON.stringify(Array.from({ length: 10 }, (_, i) => [i * 0.2, 'rimWobble'])) });

// ------------------------------------------------------------------ run
const dbf = (x) => (x > 0 ? 20 * Math.log10(x) : -Infinity);
function writeWav(file, b64) {
  const pcm = Buffer.from(b64, 'base64');
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8); h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(3, 20); h.writeUInt16LE(2, 22); h.writeUInt32LE(48000, 24);
  h.writeUInt32LE(48000 * 8, 28); h.writeUInt16LE(8, 32); h.writeUInt16LE(32, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  fs.writeFileSync(file, Buffer.concat([h, pcm]));
}
let fail = 0;
try {
  const unity = await evaluate('window.__unity()');
  console.log(`makeup compensation: -30 dBFS in -> sfx bus ${unity.sfxIn.toFixed(2)} dBFS (want -30.00), music bus ${unity.musicBus.toFixed(2)} dBFS (want -35.00)`);
  if (Math.abs(unity.sfxIn + 30) > 0.25 || Math.abs(unity.musicBus + 35) > 0.25) { console.log('  FAIL makeup compensation'); fail++; }

  console.log(`\nSFX peak table (post-limiter = what plays; raw = limiter bypassed). WAVs -> ${OUT}`);
  console.log(`${'sound'.padEnd(34)}${'peak dBFS'.padStart(10)}${'raw dBFS'.padStart(10)}${'rms dBFS'.padStart(10)}  verdict`);
  for (const s of SFX) {
    const r = await evaluate(`window.__sfx(${JSON.stringify(s.name)}, ${s.dur}, ${s.ev}, true)`);
    writeWav(path.join(OUT, s.name.replace(/[^a-z0-9.]+/gi, '_') + '.wav'), r.wav);
    const pk = dbf(r.peak), raw = dbf(r.rawPeak);
    const limited = raw - pk > 0.3;
    let verdict = pk > -1.0 ? 'FAIL >-1 dBFS' : limited && !s.name.startsWith('storm') ? 'limiter touched' : 'ok';
    if (!isFinite(pk)) verdict = 'SILENT';
    if (verdict !== 'ok') fail += verdict.startsWith('FAIL') || verdict === 'SILENT' ? 1 : 0;
    console.log(`${s.name.padEnd(34)}${pk.toFixed(1).padStart(10)}${raw.toFixed(1).padStart(10)}${dbf(r.rms).toFixed(1).padStart(10)}  ${verdict}`);
  }

  console.log('\nMusic runtime (real playMusic path in Chrome: lazy fetch music/<id>.m4a + decode + loop):');
  const mus = await evaluate('window.__music()');
  for (const m of mus) {
    const ok = m.ok && m.click < 2.5;
    if (!ok) fail++;
    console.log(`  ${m.id.padEnd(22)} ${m.ok ? 'decoded' : 'FAILED'} ${m.duration?.toFixed(3)}s in ${m.decodeMs} ms  loop [${m.loopStart?.toFixed(3)}, ${m.loopEnd?.toFixed(3)})  seam click ${m.click?.toFixed(2)} (<2.5)  100ms level step ${m.jumpDb?.toFixed(1)} dB (music)  ${ok ? 'ok' : 'FAIL ' + (m.err || '')}`);
  }
  const xf = await evaluate('window.__xfade()');
  // 50 ms windows: steady 1.25-1.95 s, crossfade 2.0-3.4 s, after 3.6-5.5 s
  const e = xf.env, steady = e.slice(25, 39), during = e.slice(40, 68), after = e.slice(72, 110);
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length, ref = mean(steady);
  const dip = Math.min(...during) - ref, bump = Math.max(...during) - ref;
  const xok = dip > -1.0 && bump < 1.0 && Math.abs(mean(after) - ref) < 0.5;
  if (!xok) fail++;
  console.log(`\nCrossfade menu -> bakery (equal-power; 50 ms RMS vs steady): dip ${dip.toFixed(2)} dB, bump +${bump.toFixed(2)} dB, after ${(mean(after) - ref).toFixed(2)} dB  ${xok ? 'ok' : 'FAIL'}`);
  console.log(`  SFX key after the switch = ${xf.keyAfter} (C = 0), playing = ${xf.track}`);
  const credits = await evaluate('window.__credits');
  console.log('\nCREDITS export:\n' + credits.split('\n').map((l) => '  ' + l).join('\n'));
  const mats = await evaluate(`window.__materials(${JSON.stringify(['donut', 'toycar', 'mystery_cupcake', 'tin_kettle', 'pear', 'zzz'])})`);
  console.log('\nmaterialOf fallback check: ' + JSON.stringify(mats));
  if (consoleLines.length) console.log('\nbrowser console:\n' + consoleLines.map((l) => '  ' + l).join('\n'));
} catch (e) {
  console.error('HARNESS ERROR', e.message);
  if (consoleLines.length) console.error(consoleLines.join('\n'));
  fail++;
} finally {
  ws.close(); server.close(); await shutdown();
}
console.log(`\nRESULT: ${fail ? fail + ' problem(s)' : 'all checks passed'}`);
process.exit(fail ? 1 : 0);
