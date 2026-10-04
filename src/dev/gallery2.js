// Dev page: Season 2 props under the game's lighting.
//   /gallery2.html                      every Season 2 prop, one per cell
//   ?ids=chick,cow                      exactly those (Season 1 ids work too)
//   ?world=farm                         one world's props
//   ?tints=1                            one row per prop, one column per tint
//   ?norm=1                             scale every prop to fill its cell (detail check)
//   ?pitch=56                           camera pitch in degrees (56 = game, 90 = top-down)
//   ?yaw=-0.5                           prop turn (radians)
//   ?cols=6  ?labels=0  ?w=1280&h=900
//   ?bug=1                              render with the engine's current patchProps (its tmask
//                                       replace never matches, so the tint colors every part);
//                                       default is the intended TINT-parts-only look
import '../game/props_cozy.js';
import { WAVE2_WORLDS as W2 } from '../game/props_wave2.js';
import { WAVE3_WORLDS } from '../game/props_wave3.js';
// ?s=3 (or a Season 3 world) shows the Season 3 pack
const WAVE2_WORLDS = new URLSearchParams(location.search).get('s') === '3' ? WAVE3_WORLDS : { ...W2, ...WAVE3_WORLDS };
import * as THREE from 'three';
import { PROPS, buildGeometry, colliderHalfHeight } from '../game/props.js';
import { patchProps } from '../engine/render.js';

const q = new URLSearchParams(location.search);
let ids = q.get('ids') ? q.get('ids').split(',') : q.get('world') ? WAVE2_WORLDS[q.get('world')] : Object.values(WAVE2_WORLDS).flat();
ids = ids.filter((id) => PROPS[id]);
const tintRows = q.get('tints') === '1', norm = q.get('norm') === '1';
const cells = [];
if (tintRows) ids.forEach((id, r) => (PROPS[id].tints || [0]).forEach((_, t) => cells.push({ id, t, c: t, r })));
else { const cols = +(q.get('cols') || 6); ids.forEach((id, i) => cells.push({ id, t: +(q.get('tint') || 0), c: i % cols, r: Math.floor(i / cols) })); }
const ncols = Math.max(...cells.map((c) => c.c)) + 1, nrows = Math.max(...cells.map((c) => c.r)) + 1;
const cell = +(q.get('cell') || (norm ? 2.2 : Math.min(7, Math.max(...ids.map((i) => PROPS[i].fit)) * 1.12 + 0.5)));
const W = +(q.get('w') || innerWidth || 1280), H = +(q.get('h') || innerHeight || 900);
const r = new THREE.WebGLRenderer({ canvas: document.getElementById('c'), antialias: true, preserveDrawingBuffer: true });
r.setPixelRatio(1); r.setSize(W, H, false);
r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color(q.get('bg') ? +('0x' + q.get('bg')) : 0xf4f1ec);
scene.add(new THREE.HemisphereLight(0xf6fbff, 0xcfc8d8, 1.9));
const sun = new THREE.DirectionalLight(0xfff4e0, 2.4); sun.position.set(22, 48, 14); sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
const span = Math.max(ncols, nrows) * cell;
Object.assign(sun.shadow.camera, { left: -span, right: span, top: span, bottom: -span, far: 200 });
scene.add(sun);
// Intended prop shading: only TINT parts (tmask = 1) take the instance color.
function patchTint(m) {
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float tmask;')
      .replace('#include <color_vertex>', THREE.ShaderChunk.color_vertex.replace('vColor.xyz *= instanceColor.xyz;', 'vColor.xyz *= mix(vec3(1.0), instanceColor.xyz, tmask);'));
  };
  m.customProgramCacheKey = () => 'props-tint-dev';
  return m;
}
const mat = (q.get('bug') === '1' ? patchProps : patchTint)(new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 38, specular: 0x2a2a2a }));
const floor = new THREE.Mesh(new THREE.PlaneGeometry(ncols * cell + 40, nrows * cell + 40).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: q.get('floor') ? +('0x' + q.get('floor')) : 0xe9e2d8 }));
floor.receiveShadow = true; scene.add(floor);
const yaw = +(q.get('yaw') ?? 0);
const labels = [];
for (const { id, t, c, r: rr } of cells) {
  const p = PROPS[id];
  const x = (c - (ncols - 1) / 2) * cell, z = (rr - (nrows - 1) / 2) * cell;
  const m = new THREE.InstancedMesh(buildGeometry(p, 0), mat, 1);
  const k = norm ? (cell * 0.8) / Math.max(p.fit, 0.4) : 1;
  m.setMatrixAt(0, new THREE.Matrix4().compose(new THREE.Vector3(x, colliderHalfHeight(p.col) * k, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0)), new THREE.Vector3(k, k, k)));
  m.setColorAt(0, new THREE.Color(p.tints ? p.tints[t % p.tints.length] : 0xffffff));
  m.castShadow = true; m.receiveShadow = true; scene.add(m);
  labels.push({ text: tintRows ? (t === 0 ? `${id} f${p.fit} v${p.value}` : `${t}`) : `${id} f${p.fit} v${p.value}`, x, z });
}
const pitch = THREE.MathUtils.degToRad(+(q.get('pitch') || 56));
const cam = new THREE.PerspectiveCamera(30, W / H, 0.5, 600);
const k = Math.max((ncols * cell) / (W / H), nrows * cell) * 1.2;
const dist = k / (2 * Math.tan(THREE.MathUtils.degToRad(15)));
cam.position.set(0, Math.sin(pitch) * dist, Math.cos(pitch) * dist); cam.lookAt(0, 0, 0);
r.render(scene, cam);
if (q.get('labels') !== '0') {
  const v = new THREE.Vector3();
  for (const l of labels) {
    v.set(l.x, 0, l.z + cell * 0.45).project(cam);
    const d = document.createElement('div');
    d.className = 'lab'; d.textContent = l.text;
    d.style.left = ((v.x + 1) / 2 * W) + 'px'; d.style.top = ((1 - v.y) / 2 * H) + 'px';
    document.body.append(d);
  }
}
document.title = 'gallery2 ready';
