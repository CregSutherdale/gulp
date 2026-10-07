import { PROPS, buildGeometry } from '../src/game/props.js';
import '../src/game/props_cozy.js'; import '../src/game/props_wave2.js'; import '../src/game/props_wave3.js'; import '../src/game/props_wave4.js';
import * as THREE from 'three';
const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
const rows = [];
for (const id in PROPS) {
  const p = PROPS[id]; if (!p.tints) continue;
  const nv = p.variants || 1; let worst = 1, file = '';
  for (let v = 0; v < nv; v++) {
    const g = buildGeometry(p, v); const pos = g.attributes.position, m = g.attributes.tmask;
    let tot = 0, tin = 0;
    const idx = g.index;
    const n = idx ? idx.count : pos.count;
    for (let i = 0; i < n; i += 3) {
      const i0 = idx ? idx.getX(i) : i, i1 = idx ? idx.getX(i + 1) : i + 1, i2 = idx ? idx.getX(i + 2) : i + 2;
      a.fromBufferAttribute(pos, i0); b.fromBufferAttribute(pos, i1); c.fromBufferAttribute(pos, i2);
      const ar = b.clone().sub(a).cross(c.clone().sub(a)).length() / 2;
      tot += ar; tin += ar * (m.getX(i0) + m.getX(i1) + m.getX(i2)) / 3;
    }
    worst = Math.min(worst, tin / tot);
  }
  rows.push([id, p.tints.length, nv, +(worst * 100).toFixed(1)]);
}
rows.sort((x, y) => x[3] - y[3]);
for (const r of rows) console.log(r.join('\t'));
