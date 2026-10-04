// Freezes the level validator into a static bundle (.validate/) so ongoing edits
// on the dev server can't reload it mid-run. Serve .validate/ and open validate.html.
import * as esbuild from 'esbuild';
import fs from 'node:fs';
fs.mkdirSync('.validate', { recursive: true });
await esbuild.build({ entryPoints: ['src/dev/validate.js'], bundle: true, format: 'iife', outfile: '.validate/validate.js', loader: { '.m4a': 'dataurl' }, logLevel: 'error' });
fs.writeFileSync('.validate/validate.html', fs.readFileSync('validate.html', 'utf8').replace('<script type="module" src="/src/dev/validate.js"></script>', '<script src="validate.js"></script>'));
console.log('validator bundle ready');
