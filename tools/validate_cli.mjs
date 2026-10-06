// Headless level validator: bundles src/dev/validate.js, serves it, runs it in headless
// Edge/Chrome, prints the PASS/FAIL log and exits 0 only if every level passes.
//   node tools/validate_cli.mjs                  every level, CHALLENGE
//   node tools/validate_cli.mjs --ids 61,62      only these level ids
//   node tools/validate_cli.mjs --easy           Relaxed setting
//   node tools/validate_cli.mjs --json out.json  also write the results array
// No window ever opens. The browser tree is killed on every exit path, and a hard
// deadline (--timeout secs, default 1500) ends runaway runs.
import * as esbuild from 'esbuild';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, execSync } from 'node:child_process';

const argv = process.argv.slice(2);
const arg = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const IDS = arg('--ids'), EASY = argv.includes('--easy'), JSON_OUT = arg('--json');
const TIMEOUT = Number(arg('--timeout') || 1500) * 1000;
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..');
const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gulp-validate-'));

await esbuild.build({ entryPoints: [path.join(root, 'src/dev/validate.js')], bundle: true, format: 'iife', outfile: path.join(outDir, 'validate.js'), loader: { '.m4a': 'dataurl' }, logLevel: 'error' });
fs.writeFileSync(path.join(outDir, 'validate.html'), fs.readFileSync(path.join(root, 'validate.html'), 'utf8').replace('<script type="module" src="/src/dev/validate.js"></script>', '<script src="validate.js"></script>'));

const server = http.createServer((req, res) => {
  const p = path.join(outDir, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(outDir) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': p.endsWith('.html') ? 'text/html' : p.endsWith('.js') ? 'text/javascript' : 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const PORT = server.address().port;

const exe = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => fs.existsSync(p));
if (!exe) { console.error('no Edge/Chrome found'); process.exit(2); }
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'gulp-validate-edge-'));
const browser = spawn(exe, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--mute-audio', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
  '--disable-extensions', '--disable-sync', '--disable-component-update', '--disable-background-networking', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
let done = false;
function cleanup() {
  if (done) return; done = true;
  try { execSync(`taskkill /PID ${browser.pid} /T /F`, { stdio: 'ignore' }); } catch (e) { /* gone */ }
  try { server.close(); } catch (e) { /* closed */ }
  for (const d of [profile, outDir]) { try { fs.rmSync(d, { recursive: true, force: true, maxRetries: 20, retryDelay: 200 }); } catch (e) { /* locked: harmless */ } }
}
process.on('exit', cleanup);
process.on('SIGINT', () => process.exit(130));
process.on('SIGTERM', () => process.exit(143));
setTimeout(() => { console.error(`TIMEOUT after ${TIMEOUT / 1000}s`); process.exit(3); }, TIMEOUT).unref();

const wsUrl = await new Promise((resolve, reject) => {
  let buf = '';
  const to = setTimeout(() => reject(new Error('browser did not start')), 20000);
  browser.stderr.on('data', (d) => { buf += d; const m = buf.match(/DevTools listening on (ws:\/\/\S+)/); if (m) { clearTimeout(to); resolve(m[1]); } });
});
const q = new URLSearchParams(); if (IDS) q.set('ids', IDS); if (EASY) q.set('easy', '1');
const dbg = new URL(wsUrl).port;
const tab = await (await fetch(`http://127.0.0.1:${dbg}/json/new?http://127.0.0.1:${PORT}/validate.html?${q}`, { method: 'PUT' })).json();
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let id = 0; const pending = new Map();
ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
const evaluate = (expression) => new Promise((r) => { const i = ++id; pending.set(i, (m) => r(m.result?.result?.value)); ws.send(JSON.stringify({ id: i, method: 'Runtime.evaluate', params: { expression, returnByValue: true } })); });

let printed = 0;
for (;;) {
  await new Promise((r) => setTimeout(r, 1500));
  const s = await evaluate(`({ title: document.title, out: document.getElementById('out')?.textContent || '' })`);
  if (!s) continue;
  const lines = s.out.split('\n');
  for (; printed < lines.length - 1; printed++) console.log(lines[printed]);
  if (/^(ALL PASS|FAIL|ERROR)/.test(s.title)) {
    console.log(lines.slice(printed).join('\n'));
    if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify(await evaluate('window.__results || null'), null, 1));
    console.log(`RESULT ${s.title}`);
    process.exit(s.title === 'ALL PASS' ? 0 : 1);
  }
}
