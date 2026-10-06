import { build } from 'esbuild';
import path from 'node:path'; import os from 'node:os'; import fs from 'node:fs'; import { pathToFileURL, fileURLToPath } from 'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const out=path.join(os.tmpdir(),'fv5.mjs');
await build({stdin:{contents:`export {PROPS} from './src/game/props.js'; import './src/game/props_wave5.js'; export {LEVELS} from './src/game/levels_wave5.js';`,resolveDir:ROOT,loader:'js'},bundle:true,format:'esm',platform:'node',outfile:out,logLevel:'error'});
const M=await import(pathToFileURL(out).href);
const want=process.argv.slice(2).map(Number);
for(const L of M.LEVELS){ if(want.length&&!want.includes(L.id))continue;
 const isT=(id,t)=>L.targets.some(x=>x.id===id&&(x.tint===undefined||x.tint===t));
 const by={}; let n=0;
 const cnt=(op)=>({grid:op.cols*op.rows,ring:op.n,line:op.n,at:1}[op.op]);
 for(const op of L.place){ const c=cnt(op); n+=c; const v=M.PROPS[op.id].value*c; if(op.op==='at'&&isT(op.id,op.tint))continue; by[op.id]=(by[op.id]||0)+v;}
 console.log(L.id, n, Object.entries(by).sort((a,b)=>b[1]-a[1]).map(([k,v])=>k+':'+v).join(' '));
}
