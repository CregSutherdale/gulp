// Dev page: one world's arena + backdrop scenery, seen exactly like the game camera.
//   /backdrop.html?world=beach&w=18&d=26&dist=15
// Params:
//   world  bakery|picnic|playroom|garden|beach|kitchen
//   w, d   arena size (default 18 x 26)
//   at     start (default: [0, d/2-3]) | far | near | left | right | center | farleft | farright
//   hx, hz explicit look point (overrides `at`)
//   r      hole radius (default 0.5). Without `dist`, the camera distance comes from the
//          game's own camTarget() formula for that radius (incl. the 70%-of-board minimum).
//   at=overview | overview_end   the level intro / outro framing
//   dist   camera distance override (the brief's "15" start view and "40" big-hole view)
//   t      freeze animation at this time in seconds (default: live)
//   props  0 hides the sample arena props   stats 0 hides the overlay
import * as THREE from 'three';
import { Renderer, patchGround, patchProps, makeHoleMesh, holeUniform } from '../engine/render.js';
import { buildArena, WORLDS } from '../game/levelbuild.js';
import { rng } from '../game/maps.js';

const q = new URLSearchParams(location.search);
const world = WORLDS[q.get('world')] ? q.get('world') : 'bakery';
const W = +(q.get('w') || 18), D = +(q.get('d') || 26);
const r = +(q.get('r') || 0.5);
const statsEl = document.getElementById('stats');
if (q.get('stats') === '0') statsEl.className = 'off';

const renderer = new Renderer(document.getElementById('c'));
// Pin the canvas to a phone-sized viewport (headless windows can be wider than asked).
const VW = +(q.get('vw') || 390), VH = +(q.get('vh') || 844), DPR = +(q.get('dpr') || 1);
renderer.resize = function () {
  this.r.setPixelRatio(DPR); this.r.setSize(VW, VH, false);
  this.r.domElement.style.cssText = `position:absolute;left:0;top:0;width:${VW}px;height:${VH}px`;
  this.camera.aspect = VW / VH; this.camera.updateProjectionMatrix();
};
renderer.resize();
const theme = WORLDS[world];
renderer.setTheme(theme);
const root = new THREE.Group();
renderer.scene.add(root);

const t0 = performance.now();
const def = buildArena(world, { w: W, d: D }, root, patchGround);
const buildMs = performance.now() - t0;
const backdrop = def.backdrop;
// ?hide=gulls,clouds hides backdrop meshes by name (debugging).
const hide = (q.get('hide') || '').split(',').filter(Boolean);
root.traverse((m) => { if (m.isMesh && hide.includes(m.name)) m.visible = false; });

// Look point.
const AT = {
  start: [0, D / 2 - 3], far: [0, -D / 2 + 1], near: [0, D / 2 - 0.6], center: [0, 0],
  left: [-W / 2 + 0.6, 0], right: [W / 2 - 0.6, 0], farleft: [-W / 2 + 1, -D / 2 + 1], farright: [W / 2 - 1, -D / 2 + 1],
  nearleft: [-W / 2 + 1, D / 2 - 1], nearright: [W / 2 - 1, D / 2 - 1],
};
let [hx, hz] = AT[q.get('at')] || AT.start;
if (q.has('hx')) hx = +q.get('hx');
if (q.has('hz')) hz = +q.get('hz');

const holeX = hx, holeZ = hz;

// Camera exactly like Round.camTarget(): levels keep >= 70% of the board width in view;
// at=overview / overview_end reproduce the intro and end-of-level framing (pitch 62).
const cam = renderer.camera;
let dist = +(q.get('dist') || 0);
const tanV = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)), tanHfull = tanV * cam.aspect;
let pitchDeg = 56;
const ov = q.get('at') === 'overview' || q.get('at') === 'overview_end';
if (ov) {
  dist = dist || Math.max((W / 2 + 1.5) / tanHfull, (D * 0.5 + 1.5) / tanV * 0.62) * 1.05;
  pitchDeg = 62; hx = 0; hz = q.get('at') === 'overview' ? D * 0.3 : 0;
} else if (!dist) {
  const share = THREE.MathUtils.lerp(0.23, 0.15, Math.min(1, (r - 0.5) / 6));
  const tanH = tanV * Math.min(cam.aspect, 1.1);
  const minD = (W * 0.7 / 2) / tanH;
  dist = Math.max(minD, r / (share * tanH));
}
const pitch = THREE.MathUtils.degToRad(pitchDeg);
cam.position.set(hx, dist * Math.sin(pitch), hz + dist * Math.cos(pitch));
cam.lookAt(hx, 0, hz);
renderer.followSun(hx, hz);
renderer.setShadowSpan(Math.max(18, cam.position.y * 1.1));

// The player's hole.
const hole = makeHoleMesh(new THREE.Color(theme.accent).getHex());
hole.scale.setScalar(r);
hole.position.set(holeX, 0, holeZ);
renderer.scene.add(hole);
holeUniform.value[0].set(holeX, holeZ, r, 1);

// Backdrop stats: every mesh the backdrop added to root (root.children[0] is the arena group).
function backdropStats() {
  let calls = 0, tris = 0;
  const rows = [];
  root.children.slice(1).forEach((o) => o.traverse((m) => {
    if (!m.isMesh || !m.visible) return;
    const g = m.geometry;
    const n = (g.index ? g.index.count : g.attributes.position.count) / 3;
    calls++; tris += n;
    rows.push(`${(m.name || m.material.type).padEnd(14)} ${String(Math.round(n)).padStart(6)}`);
  }));
  return { calls, tris: Math.round(tris), rows };
}

// Sample props so the arena reads like a real level (optional, best effort).
async function addProps() {
  if (q.get('props') === '0') return;
  try {
    const cozy = await import('../game/props_cozy.js');
    const { PROPS, buildGeometry, colliderHalfHeight } = await import('../game/props.js');
    const ids = (cozy.COZY_WORLDS?.[world] || []).filter((id) => PROPS[id] && PROPS[id].fit <= 2.6);
    if (!ids.length) return;
    const R = rng(4242);
    const mat = patchProps(new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 38, specular: 0x2a2a2a }));
    const spots = [];
    const gap = 1.7;
    for (let z = -D / 2 + 1.5; z <= D / 2 - 1.5; z += gap) {
      for (let x = -W / 2 + 1.5; x <= W / 2 - 1.5; x += gap) {
        const px = x + (R() - 0.5) * 0.8, pz = z + (R() - 0.5) * 0.8;
        if (Math.hypot(px - holeX, pz - holeZ) < r + 1.2) continue;
        if (R() < 0.45) continue;
        spots.push([px, pz]);
      }
    }
    const by = new Map();
    for (const s of spots) {
      const sizeBias = Math.floor(Math.pow(R(), 1.8) * ids.length);
      const id = ids[sizeBias];
      if (!by.has(id)) by.set(id, []);
      by.get(id).push(s);
    }
    const m4 = new THREE.Matrix4(), col = new THREE.Color();
    for (const [id, list] of by) {
      const p = PROPS[id];
      const mesh = new THREE.InstancedMesh(buildGeometry(p, 0), mat, list.length);
      list.forEach(([x, z], i) => {
        m4.makeRotationY(R() * Math.PI * 2).setPosition(x, colliderHalfHeight(p.col), z);
        mesh.setMatrixAt(i, m4);
        col.set(p.tints ? p.tints[i % p.tints.length] : 0xffffff);
        mesh.setColorAt(i, col);
      });
      mesh.castShadow = true; mesh.receiveShadow = true;
      renderer.scene.add(mesh);
    }
  } catch (e) { console.warn('props unavailable', e); }
}

const fixedT = q.has('t') ? +q.get('t') : null;
let frames = 0;
function frame(now) {
  const t = fixedT ?? now / 1000;
  backdrop?.update?.(t);
  renderer.render();
  frames++;
  if (frames === 2) {
    const s = backdropStats();
    const info = renderer.r.info.render;
    statsEl.textContent = `${innerWidth}x${innerHeight} ${world} ${W}x${D} d=${dist.toFixed(1)} r=${r} at=(${hx.toFixed(1)},${hz.toFixed(1)})\n`
      + `backdrop: ${s.calls} calls, ${s.tris} tris, build ${buildMs.toFixed(0)}ms\n`
      + `frame: ${info.calls} calls, ${info.triangles} tris\n` + s.rows.join('\n');
    document.title = 'backdrop ready';
  }
  // A frozen time only needs a few frames (keeps headless captures fast). The last one is
  // copied into an <img> right after drawing so headless screenshots never catch a
  // cleared WebGL buffer.
  if (fixedT === null || frames < 4) requestAnimationFrame(frame);
  else {
    const img = new Image();
    img.src = renderer.r.domElement.toDataURL('image/png');
    img.style.cssText = `position:absolute;left:0;top:0;width:${VW}px;height:${VH}px`;
    document.body.insertBefore(img, statsEl);
  }
}
addProps().then(() => requestAnimationFrame(frame));
