// Renders little 3/4-view portraits of props for target lists, from the real geometry.
import * as THREE from 'three';
import { PROPS, buildGeometry } from '../game/props.js';
import { patchProps } from '../engine/render.js';

const BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

export class Icons {
  constructor() {
    this.cache = new Map();
    this.size = 128;
    this.r = null;
  }
  ensure() {
    if (this.r) return;
    const cv = document.createElement('canvas');
    this.r = new THREE.WebGLRenderer({ canvas: cv, alpha: true, antialias: true, preserveDrawingBuffer: true });
    this.r.setSize(this.size, this.size, false);
    this.scene = new THREE.Scene();
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xb0a8c0, 2.2));
    const d = new THREE.DirectionalLight(0xffffff, 2.2); d.position.set(3, 6, 4); this.scene.add(d);
    this.cam = new THREE.PerspectiveCamera(30, 1, 0.05, 200);
    this.mat = patchProps(new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 38, specular: 0x2a2a2a }));
  }
  get(id, tint = 0) {
    const key = `${id}:${tint}`;
    if (this.cache.has(key)) return this.cache.get(key);
    // Icons are a nicety: if the icon renderer can't run (iOS dropped its WebGL
    // context, out of memory...) show a blank image and try again next time.
    try { return this.render(id, tint, key); } catch (e) { console.error('icon', e); this.r = null; return BLANK; }
  }
  render(id, tint, key) {
    this.ensure();
    if (this.r.getContext().isContextLost()) { this.r = null; return BLANK; }
    const prop = PROPS[id];
    const geo = buildGeometry(prop, 0);
    const mesh = new THREE.InstancedMesh(geo, this.mat, 1);
    mesh.setMatrixAt(0, new THREE.Matrix4());
    mesh.setColorAt(0, new THREE.Color(prop.tints ? prop.tints[tint % prop.tints.length] : 0xffffff));
    this.scene.add(mesh);
    geo.computeBoundingSphere();
    const bs = geo.boundingSphere;
    const dist = bs.radius / Math.sin(THREE.MathUtils.degToRad(15)) * 1.02;
    this.cam.position.set(bs.center.x + dist * 0.55, bs.center.y + dist * 0.62, bs.center.z + dist * 0.56);
    this.cam.lookAt(bs.center);
    this.r.setClearColor(0x000000, 0);
    this.r.render(this.scene, this.cam);
    const url = this.r.domElement.toDataURL('image/png');
    this.scene.remove(mesh); geo.dispose();
    this.cache.set(key, url);
    return url;
  }
}
