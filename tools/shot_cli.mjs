// Headless screenshot of any page (no window ever opens): opens a URL in headless
// Edge/Chrome, waits, optionally runs JS steps, and saves PNG(s).
//   node tools/shot_cli.mjs --url http://127.0.0.1:5251/ --out shot.png
//     [--w 390 --h 844]            viewport (default iPhone 390x844, DPR 2)
//     [--wait 6]                   seconds to wait after load
//     [--js "window.__game.startLevel(60)"] [--then 4]   run JS, wait, shoot (repeatable pairs)
// Every --js/--then pair adds one more shot: out.png, out_1.png, out_2.png ...
// The browser tree is killed on every exit path; hard deadline --timeout (default 180 s).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, execSync } from 'node:child_process';

const argv = process.argv.slice(2);
const one = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const all = (k) => argv.flatMap((a, i) => (a === k ? [argv[i + 1]] : []));
const URL_ = one('--url'), OUT = one('--out', 'shot.png');
const W = +one('--w', 390), H = +one('--h', 844), WAIT = +one('--wait', 6), TIMEOUT = +one('--timeout', 180) * 1000;
const JS = all('--js'), THEN = all('--then').map(Number);
if (!URL_) { console.error('need --url'); process.exit(2); }

const exe = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => fs.existsSync(p));
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'gulp-shot-edge-'));
const browser = spawn(exe, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check',
  '--mute-audio', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-extensions', '--disable-sync', '--disable-component-update',
  '--disable-background-networking', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
let done = false;
function cleanup() {
  if (done) return; done = true;
  try { execSync(`taskkill /PID ${browser.pid} /T /F`, { stdio: 'ignore' }); } catch (e) { /* gone */ }
  try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 20, retryDelay: 200 }); } catch (e) { /* locked */ }
}
process.on('exit', cleanup);
process.on('SIGINT', () => process.exit(130));
setTimeout(() => { console.error('TIMEOUT'); process.exit(3); }, TIMEOUT).unref();

const wsUrl = await new Promise((resolve, reject) => {
  let buf = ''; const to = setTimeout(() => reject(new Error('browser did not start')), 20000);
  browser.stderr.on('data', (d) => { buf += d; const m = buf.match(/DevTools listening on (ws:\/\/\S+)/); if (m) { clearTimeout(to); resolve(m[1]); } });
});
const tab = await (await fetch(`http://127.0.0.1:${new URL(wsUrl).port}/json/new?about:blank`, { method: 'PUT' })).json();
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let id = 0; const pending = new Map(); const errs = [];
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === 'Runtime.exceptionThrown') { const d = m.params.exceptionDetails; errs.push(`${d.exception?.description || d.text} @ ${d.url || d.scriptId}:${d.lineNumber}:${d.columnNumber}`); }
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errs.push(m.params.args.map((a) => a.value ?? a.description).join(' '));
});
const cdp = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const sleep = (s) => new Promise((r) => setTimeout(r, s * 1000));
await cdp('Runtime.enable');
await cdp('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 2, mobile: true });
await cdp('Emulation.setTouchEmulationEnabled', { enabled: true });
await cdp('Page.enable');
await cdp('Page.navigate', { url: URL_ });
await sleep(WAIT);
const shoot = async (file) => {
  const r = await cdp('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(file, Buffer.from(r.result.data, 'base64'));
  console.log('saved', file);
};
await shoot(OUT);
for (let k = 0; k < JS.length; k++) {
  const r = await cdp('Runtime.evaluate', { expression: JS[k], awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) errs.push('js: ' + (r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text));
  else if (r.result?.result?.value !== undefined) console.log('js ->', JSON.stringify(r.result.result.value).slice(0, 300));
  await sleep(THEN[k] ?? 3);
  await shoot(OUT.replace(/\.png$/, `_${k + 1}.png`));
}
console.log(errs.length ? `PAGE ERRORS (${errs.length}):\n` + errs.slice(0, 10).join('\n') : 'no page errors');
process.exit(errs.length ? 1 : 0);
