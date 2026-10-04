// Bundles the whole game (code, physics wasm, music) into ONE html file that opens
// from a link on a phone. Output: dist/gulp.html (artifact body: no <html>/<head>).
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

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
  loader: { '.m4a': 'dataurl' }, write: false, plugins: [stubs], legalComments: 'none', define: { 'process.env.NODE_ENV': '"production"' },
});
let js = res.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = fs.readFileSync('src/ui/style.css', 'utf8');
const html = `<title>Gulp!</title>
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="theme-color" content="#ff9cc6">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&display=swap">
<style>${css}</style>
<canvas id="c"></canvas>
<div id="touch"></div>
<div id="stick"><div></div></div>
<div id="ui"></div>
<canvas id="confetti"></canvas>
<div id="loading" class="loading"><div class="hole"></div><p>Getting hungry…</p></div>
<script>${js}</script>
`;
fs.mkdirSync('dist', { recursive: true });
fs.writeFileSync('dist/gulp.html', html);
console.log(`dist/gulp.html ${(html.length / 1024 / 1024).toFixed(2)} MB`);

// Full standalone page for web hosting (GitHub Pages), installable to the home screen.
const page = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">
<meta name="apple-mobile-web-app-title" content="Gulp!">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<link rel="apple-touch-icon" href="icon-180.png">
<link rel="icon" href="icon-180.png">
<link rel="manifest" href="manifest.webmanifest">
${html}</head><body></body></html>`.replace('</head><body></body></html>', '');
fs.writeFileSync('dist/index.html', page.replace(/<canvas id="c">/, '</head><body><canvas id="c">') + '</body></html>');
fs.writeFileSync('dist/manifest.webmanifest', JSON.stringify({
  name: 'Gulp!', short_name: 'Gulp!', start_url: './', display: 'fullscreen', orientation: 'portrait',
  background_color: '#ffd6e7', theme_color: '#ff9cc6', icons: [{ src: 'icon-180.png', sizes: '180x180', type: 'image/png' }, { src: 'icon-512.png', sizes: '512x512', type: 'image/png' }],
}, null, 1));
console.log('dist/index.html + manifest written');
