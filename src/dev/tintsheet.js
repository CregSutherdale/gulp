// Dev page: every tint of each prop, BEFORE (old look: tint colored the whole prop) next to
// AFTER (the game's real patchProps material: tint only on TINT parts).
//   /tintsheet.html?ids=cuppa,posy   one row per prop: [before tints] | [after tints]
//   ?from=0&n=8                      a page of the tinted-prop list (all prop files)
//   ?pitch=56 ?yaw=-0.5 ?cell=2.4 ?w=1600
import '../game/allLevels.js';
import * as THREE from 'three';
import { PROPS, buildGeometry } from '../game/props.js';
import { patchProps } from '../engine/render.js';

const q = new URLSearchParams(location.search);
const all = Object.keys(PROPS).filter((id) => PROPS[id].tints);
const from = +(q.get('from') || 0), n = +(q.get('n') || 8);
const ids = q.get('ids') ? q.get('ids').split(',').filter((id) => PROPS[id]) : all.slice(from, from + n);
window.__tinted = all;
const maxT = Math.max(...ids.map((id) => PROPS[id].tints.length));
const cell = +(q.get('cell') || 2.4), gap = 1.2, label = 2.6, rowH = cell * 1.3;
const cols = Math.max(maxT, 8) * 2;
const widthU = label + cols * cell + gap, heightU = ids.length * rowH;
const W = +(q.get('w') || 1600), H = Math.round(W * heightU / widthU);
const r = new THREE.WebGLRenderer({ canvas: document.getElementById('c'), antialias: true, preserveDrawingBuffer: true });
r.setPixelRatio(1); r.setSize(W, H, false);
document.body.style.height = H + 'px';
r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf4f1ec);
scene.add(new THREE.HemisphereLight(0xe8f6ff, 0x9fc28f, 1.9));
const sun = new THREE.DirectionalLight(0xfff4e0, 2.4); sun.position.set(22, 48, 14); sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
Object.assign(sun.shadow.camera, { left: -widthU, right: widthU, top: widthU, bottom: -widthU, far: 200 });
scene.add(sun);
const before = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 38, specular: 0x2a2a2a });
const after = patchProps(new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 38, specular: 0x2a2a2a }));
const floor = new THREE.Mesh(new THREE.PlaneGeometry(widthU + 40, heightU + 40).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0xe9e2d8 }));
floor.position.y = -0.001; floor.receiveShadow = true; scene.add(floor);
const yaw = +(q.get('yaw') ?? -0.4);
const x0 = -widthU / 2 + label;
const labs = [];
ids.forEach((id, row) => {
  const p = PROPS[id];
  const z = (row - (ids.length - 1) / 2) * rowH;
  const geo = buildGeometry(p, 0); geo.computeBoundingBox();
  const bb = geo.boundingBox, size = Math.max(bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z);
  const k = (cell * 0.78) / size;
  labs.push({ text: `${id} (${p.tints.length})`, x: -widthU / 2 + 0.1, z });
  for (const [side, mat] of [[0, before], [1, after]]) {
    const m = new THREE.InstancedMesh(geo, mat, p.tints.length);
    p.tints.forEach((t, i) => {
      const x = x0 + (side * (Math.max(maxT, 8) * cell + gap)) + (i + 0.5) * cell;
      m.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(x, -bb.min.y * k, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0)), new THREE.Vector3(k, k, k)));
      m.setColorAt(i, new THREE.Color(t));
    });
    m.castShadow = true; m.receiveShadow = true; scene.add(m);
  }
});
const pitch = THREE.MathUtils.degToRad(+(q.get('pitch') || 50));
const cam = new THREE.OrthographicCamera(-widthU / 2, widthU / 2, heightU / 2, -heightU / 2, -100, 200);
// Orthographic, tilted: compensate the vertical squash so rows stay one cell tall.
cam.position.set(0, Math.sin(pitch) * 50, Math.cos(pitch) * 50); cam.lookAt(0, 0, 0);
cam.top = heightU / 2 * Math.sin(pitch) + 0.6; cam.bottom = -heightU / 2 * Math.sin(pitch) - 0.2; cam.updateProjectionMatrix();
const H2 = Math.round(W * (cam.top - cam.bottom) / widthU); r.setSize(W, H2, false);
const dpr = devicePixelRatio || 1, cv = r.domElement;
cv.style.width = W / dpr + 'px'; cv.style.height = H2 / dpr + 'px';
r.render(scene, cam);
const v = new THREE.Vector3();
for (const l of labs) {
  v.set(l.x, 0, l.z).project(cam);
  const d = document.createElement('div'); d.className = 'lab'; d.textContent = l.text;
  d.style.left = ((v.x + 1) / 2 * W / dpr) + 'px'; d.style.top = ((1 - v.y) / 2 * H2 / dpr - 8) + 'px'; document.body.append(d);
}
for (const [t, s] of [['BEFORE (old)', 0], ['AFTER (fixed)', 1]]) {
  v.set(x0 + s * (Math.max(maxT, 8) * cell + gap) + 0.2, 0, -heightU / 2).project(cam);
  const d = document.createElement('div'); d.className = 'lab'; d.textContent = t; d.style.left = ((v.x + 1) / 2 * W / dpr) + 'px'; d.style.top = '2px'; document.body.append(d);
}
window.__H = H2 / dpr;
document.title = 'tintsheet ready';
