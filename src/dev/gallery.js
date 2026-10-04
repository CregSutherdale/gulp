// Dev page: every prop on a turntable grid under the game's lighting, labelled.
// ?only=bakery,picnic filters by id prefix list; ?ids=donut,cake shows exactly those.
import '../game/props_cozy.js';
import * as THREE from 'three';
import { PROPS, buildGeometry } from '../game/props.js';
import { patchProps } from '../engine/render.js';

const q = new URLSearchParams(location.search);
let ids = Object.keys(PROPS);
if (q.get('ids')) ids = q.get('ids').split(',');
const cols = +(q.get('cols') || 6);
const cell = +(q.get('cell') || Math.min(4, Math.max(...ids.map((i) => PROPS[i]?.fit || 1)) * 1.15 + 0.5));
const r = new THREE.WebGLRenderer({ canvas: document.getElementById('c'), antialias: true, preserveDrawingBuffer: true });
r.setPixelRatio(1);
r.shadowMap.enabled = true;
const W = innerWidth || 1280, H = innerHeight || 800;
r.setSize(W, H, false);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xfff3f8);
scene.add(new THREE.HemisphereLight(0xfff3f8, 0xf1c6d6, 1.9));
const sun = new THREE.DirectionalLight(0xfff4e0, 2.4); sun.position.set(20, 40, 14); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, far: 120 });
scene.add(sun);
const mat = patchProps(new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 38, specular: 0x2a2a2a }));
const rows = Math.ceil(ids.length / cols);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(cols * cell + 4, rows * cell + 4).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0xffe3ee }));
floor.receiveShadow = true; scene.add(floor);
const labels = [];
ids.forEach((id, i) => {
  const p = PROPS[id]; if (!p) return;
  const c = i % cols, rr = Math.floor(i / cols);
  const x = (c - (cols - 1) / 2) * cell, z = (rr - (rows - 1) / 2) * cell;
  const n = p.tints ? p.tints.length : 1;
  const m = new THREE.InstancedMesh(buildGeometry(p, 0), mat, 1);
  const hh = p.col.t === 'ball' ? p.col.r : p.col.h / 2;
  m.setMatrixAt(0, new THREE.Matrix4().makeRotationY(-0.5).setPosition(x, hh, z));
  m.setColorAt(0, new THREE.Color(p.tints ? p.tints[(+q.get('tint') || 0) % n] : 0xffffff));
  m.castShadow = true; m.receiveShadow = true; scene.add(m);
  labels.push({ id, x, z, fit: p.fit, value: p.value });
});
floor.position.set(0, 0, 0);
const cam = new THREE.PerspectiveCamera(30, W / H, 0.5, 400);
const span = Math.max(cols, rows) * cell;
const aspect = W / H; const k = Math.max(cols * cell / aspect, rows * cell) * 1.15;
cam.position.set(0, k * 1.55, k * 1.15); cam.lookAt(0, 0, 0);
r.render(scene, cam);
const v = new THREE.Vector3();
for (const l of labels) {
  v.set(l.x, 0, l.z + cell * 0.42).project(cam);
  const d = document.createElement('div');
  d.className = 'lab'; d.textContent = `${l.id} f${l.fit} v${l.value}`;
  d.style.left = ((v.x + 1) / 2 * W) + 'px'; d.style.top = ((1 - v.y) / 2 * H) + 'px';
  document.body.append(d);
}
document.title = 'gallery ready';
