// Production build for web hosting (GitHub Pages):
//   dist/index.html            small shell (inline CSS + loading screen)
//   dist/game.<hash>.js        the whole game (three + rapier wasm + code), cached forever
//   dist/music/*               lazy-loaded per world (from public/)
//   dist/sw.js                 offline + instant relaunch (network-first for the page)
//   dist/manifest + icons      Add to Home Screen as a full-screen app
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// Until the cozy content exists, ship the starter levels (same fallback as dev).
const STUB = { 'props_cozy.js': 'export {};', 'levels.js': "export { LEVELS } from './levels_starter.js';" };
const stubs = { name: 'content-stubs', setup(b) {
  b.onResolve({ filter: /(props_cozy|levels)\.js$/ }, (a) => {
    const f = path.resolve(a.resolveDir, a.path);
    if (fs.existsSync(f)) return null;
    return { path: f, namespace: 'stub' };
  });
  b.onLoad({ filter: /.*/, namespace: 'stub' }, (a) => ({ contents: STUB[path.basename(a.path)], resolveDir: path.dirname(a.path), loader: 'js' }));
} };
for (const f of ['src/game/props_cozy.js', 'src/game/levels.js']) if (!fs.existsSync(f)) console.log(`note: ${f} missing, using starter content`);

const res = await esbuild.build({
  entryPoints: ['src/main.js'], bundle: true, minify: true, format: 'iife', target: ['es2020', 'safari15'],
  loader: { '.m4a': 'dataurl' }, write: false, legalComments: 'none', plugins: [stubs],
  define: { 'process.env.NODE_ENV': '"production"' },
});
const js = res.outputFiles[0].text;
const css = fs.readFileSync('src/ui/style.css', 'utf8');
// The hash covers the page CSS too, so a style-only change still ships a new worker.
const hash = crypto.createHash('sha1').update(js).update(css).digest('hex').slice(0, 10);
const jsName = `game.${hash}.js`;

// Empty dist/ (not delete it: a local test server may be serving from it).
fs.mkdirSync('dist', { recursive: true });
for (const f of fs.readdirSync('dist')) fs.rmSync(`dist/${f}`, { recursive: true, force: true });
fs.writeFileSync(`dist/${jsName}`, js);
if (fs.existsSync('public')) fs.cpSync('public', 'dist', { recursive: true }); // music etc.
for (const f of ['icon-180.png', 'icon-512.png']) fs.copyFileSync(`assets/icons/${f}`, `dist/${f}`);

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">
<title>Gulp!</title>
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Gulp!">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="theme-color" content="#ff9cc6">
<link rel="apple-touch-icon" href="icon-180.png">
<link rel="icon" href="icon-180.png">
<link rel="manifest" href="manifest.webmanifest">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&display=swap" media="print" onload="this.media='all'">
<style>${css}</style>
</head><body>
<canvas id="c"></canvas>
<div id="touch"></div>
<div id="stick"><div></div></div>
<div id="ui"></div>
<canvas id="confetti"></canvas>
<div id="loading" class="loading"><div class="hole"></div><p>Getting hungry…</p></div>
<script>window.__GULP_BUILD='${hash}';</script>
<script>function gulpLoadFailed(){var l=document.getElementById('loading');if(l){l.innerHTML='<div class="hole"></div><p>Couldn't load the game.<br>Tap to try again.</p>';l.onclick=function(){location.reload();};}}</script>
<script src="${jsName}" defer onerror="gulpLoadFailed()"></script>
</body></html>
`;
fs.writeFileSync('dist/index.html', html);
fs.writeFileSync('dist/manifest.webmanifest', JSON.stringify({
  name: 'Gulp!', short_name: 'Gulp!', start_url: './', scope: './', display: 'fullscreen', orientation: 'portrait',
  background_color: '#ffd6e7', theme_color: '#ff9cc6',
  icons: [{ src: 'icon-180.png', sizes: '180x180', type: 'image/png' }, { src: 'icon-512.png', sizes: '512x512', type: 'image/png' }],
}, null, 1));

// Service worker. The page is network-first, so updates arrive the moment she's
// online. The hashed game file is cache-first (a name never changes content).
// Music and icons are served from cache and refreshed in the background. Old
// caches are dropped on activate.
const sw = `const V='gulp-${hash}';
const CORE=['./','./${jsName}','./manifest.webmanifest','./icon-180.png'];
// Install caches the page and its game file TOGETHER, so the cached pair always matches.
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()));});
// Only ever delete this game's old caches (the github.io domain is shared).
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('gulp-')&&k!==V).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{
  const r=e.request; if(r.method!=='GET') return;
  const u=new URL(r.url); if(u.origin!==location.origin) return;
  if(r.mode==='navigate'){
    // Fresh page when the network answers quickly; otherwise the cached page (the
    // cached page always has its matching game file cached alongside it).
    e.respondWith((async()=>{
      const cached=await caches.match('./');
      const net=fetch(r).catch(()=>null);
      if(!cached){const res=await net;return res||new Response('<p style="font:20px system-ui;padding:40px">You are offline. Connect once to download Gulp!</p>',{headers:{'Content-Type':'text/html'}});}
      const res=await Promise.race([net,new Promise(ok=>setTimeout(()=>ok(null),3000))]);
      return (res&&res.ok)?res:cached;
    })());
    return;
  }
  if(/^game\.[0-9a-f]+\.js$/.test(u.pathname.slice(u.pathname.lastIndexOf('/')+1))){
    e.respondWith(caches.match(r).then(m=>m||fetch(r).then(res=>{if(res.ok){const c=res.clone();caches.open(V).then(x=>x.put(r,c));}return res;})));
    return;
  }
  e.respondWith(caches.open(V).then(c=>c.match(r).then(m=>{const net=fetch(r).then(res=>{if(res.ok)c.put(r,res.clone());return res;}).catch(()=>m);return m||net;})));
});
`;
fs.writeFileSync('dist/sw.js', sw);
fs.writeFileSync('dist/.nojekyll', '');
const mb = (f) => (fs.statSync(f).size / 1024 / 1024).toFixed(2);
console.log(`dist/${jsName} ${mb(`dist/${jsName}`)} MB, index.html ${(fs.statSync('dist/index.html').size / 1024).toFixed(0)} KB`);
const music = fs.existsSync('dist/music') ? fs.readdirSync('dist/music') : [];
console.log(`music files: ${music.length}`);
