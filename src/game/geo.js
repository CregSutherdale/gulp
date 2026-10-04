// Low-poly geometry helpers. Every prop is built from a few primitives with baked
// vertex colors, merged into one BufferGeometry so a prop type is one InstancedMesh.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

const _c = new THREE.Color();

// TINT marks a part that takes the per-instance color (car bodies, shirts, roofs);
// every other part keeps its baked color. The shader reads `tmask` to tell them apart.
export const TINT = null;

function paint(geo, hex) {
  geo = geo.index ? geo.toNonIndexed() : geo;
  const tint = hex === TINT;
  _c.set(tint ? 0xffffff : hex);
  const n = geo.attributes.position.count;
  const col = new Float32Array(n * 3);
  const mask = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b;
    mask[i] = tint ? 1 : 0;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('tmask', new THREE.BufferAttribute(mask, 1));
  if (geo.attributes.uv) geo.deleteAttribute('uv');
  return geo;
}

// Each helper places a primitive with its BASE at y (not its center), which is how
// props are easiest to author: "a 0.8-tall box sitting on the ground".
export function box(w, h, d, color, x = 0, y = 0, z = 0, ry = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (ry) g.rotateY(ry);
  g.translate(x, y + h / 2, z);
  return paint(g, color);
}
export function cyl(rTop, rBot, h, color, x = 0, y = 0, z = 0, seg = 8, rx = 0, rz = 0) {
  const g = new THREE.CylinderGeometry(rTop, rBot, h, seg);
  if (rx || rz) { g.rotateX(rx); g.rotateZ(rz); g.translate(x, y, z); }
  else g.translate(x, y + h / 2, z);
  return paint(g, color);
}
export function cone(r, h, color, x = 0, y = 0, z = 0, seg = 8) {
  const g = new THREE.ConeGeometry(r, h, seg);
  g.translate(x, y + h / 2, z);
  return paint(g, color);
}
export function ball(r, color, x = 0, y = 0, z = 0, detail = 1, sy = 1) {
  const g = new THREE.IcosahedronGeometry(r, detail);
  if (sy !== 1) g.scale(1, sy, 1);
  g.translate(x, y + r * sy, z);
  return paint(g, color);
}
// Gable roof: a triangular prism spanning w (x) by d (z), ridge along z.
export function roof(w, h, d, color, x = 0, y = 0, z = 0) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, h); s.lineTo(-w / 2, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false });
  g.translate(x, y, z - d / 2);
  return paint(g, color);
}
// A row of window panes on one face of a box-shaped building.
export function windows(w, h, d, floors, cols, color, y0 = 0, inset = 0.02) {
  const parts = [];
  const fh = h / floors;
  const pw = (w / cols) * 0.5, ph = fh * 0.45;
  for (let f = 0; f < floors; f++) {
    const y = y0 + f * fh + fh * 0.3;
    for (let c = 0; c < cols; c++) {
      const x = -w / 2 + (c + 0.5) * (w / cols);
      parts.push(box(pw, ph, 0.04, color, x, y, d / 2 + inset));
      parts.push(box(pw, ph, 0.04, color, x, y, -d / 2 - inset));
    }
    const rows = Math.max(1, Math.round(cols * d / w));
    const pd = (d / rows) * 0.5;
    for (let c = 0; c < rows; c++) {
      const z = -d / 2 + (c + 0.5) * (d / rows);
      parts.push(box(0.04, ph, pd, color, w / 2 + inset, y, z));
      parts.push(box(0.04, ph, pd, color, -w / 2 - inset, y, z));
    }
  }
  return parts;
}

// Rounded box (toy-like, soft highlights). Base at y.
export function rbox(w, h, d, color, x = 0, y = 0, z = 0, radius = 0.08, ry = 0) {
  const r = Math.min(radius, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001);
  const g = new RoundedBoxGeometry(w, h, d, 2, r);
  if (ry) g.rotateY(ry);
  g.translate(x, y + h / 2, z);
  return paint(g, color);
}
// Torus lying flat (donut rings, tyres, life buoys). Center height y.
export function torus(R, tube, color, x = 0, y = 0, z = 0, rx = Math.PI / 2, seg = 16) {
  const g = new THREE.TorusGeometry(R, tube, 8, seg);
  g.rotateX(rx);
  g.translate(x, y, z);
  return paint(g, color);
}
// Capsule standing up, base at y.
export function capsule(r, len, color, x = 0, y = 0, z = 0, rz = 0) {
  const g = new THREE.CapsuleGeometry(r, len, 4, 10);
  if (rz) { g.rotateZ(rz); g.translate(x, y, z); } else g.translate(x, y + len / 2 + r, z);
  return paint(g, color);
}
// Any geometry you built yourself (lathe, extrude...), painted.
export function custom(geo, color) { return paint(geo, color); }

// Primitives keep their own normals: boxes stay crisp, balls and rounded boxes stay
// smooth, which reads as soft plastic toys under the Phong highlight.
export function merge(parts) {
  const g = mergeGeometries(parts.flat(), false);
  g.computeBoundingSphere();
  return g;
}
