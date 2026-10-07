import * as THREE from 'three';

export const MAX_HOLES = 8;
// Shared uniform: (x, z, r, on) per hole. Every flat ground-layer material discards
// fragments inside a hole so you can see down the shaft.
export const holeUniform = { value: Array.from({ length: MAX_HOLES }, () => new THREE.Vector4(0, 0, 0, 0)) };

export function patchGround(mat) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uHoles = holeUniform;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vGW;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGW = (modelMatrix * vec4(position, 1.0)).xz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec2 vGW;\nuniform vec4 uHoles[${MAX_HOLES}];`)
      .replace('void main() {', `void main() {
        for (int i = 0; i < ${MAX_HOLES}; i++) {
          vec4 h = uHoles[i];
          if (h.w > 0.5 && distance(vGW, h.xy) < h.z) discard;
        }`);
  };
  mat.customProgramCacheKey = () => 'ground-hole';
  return mat;
}

// Props: per-instance tint only on TINT parts (tmask), and everything darkens as it
// sinks below ground level so falling things fade into the dark of the shaft.
// { sink: false } skips the darkening (HUD icons draw props centered on y = 0).
export function patchProps(mat, { sink = true } = {}) {
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float tmask;\nvarying float vWY;')
      // Expand color_vertex here: the chunk is still an #include at this point, so a plain
      // replace on its body would never match (that bug tinted every part of every prop).
      .replace('#include <color_vertex>', THREE.ShaderChunk.color_vertex.replace('vColor.xyz *= instanceColor.xyz;', 'vColor.xyz *= mix(vec3(1.0), instanceColor.xyz, tmask);'))
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vWY = (modelMatrix * instanceMatrix * vec4(position, 1.0)).y;
        #else
          vWY = (modelMatrix * vec4(position, 1.0)).y;
        #endif`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vWY;')
      .replace('#include <dithering_fragment>', '#include <dithering_fragment>\ngl_FragColor.rgb *= clamp(1.0 + vWY * 0.32, 0.04, 1.0);');
  };
  mat.customProgramCacheKey = () => 'props-tint-mask';
  return mat;
}

export class Renderer {
  constructor(canvas) {
    const mobile = /iPhone|iPad|Android/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && innerWidth < 900);
    this.mobile = mobile;
    this.r = new THREE.WebGLRenderer({ canvas, antialias: !mobile || devicePixelRatio < 2.5, powerPreference: 'high-performance' });
    this.r.setPixelRatio(Math.min(devicePixelRatio, mobile ? 2 : 2));
    this.r.shadowMap.enabled = true;
    this.r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(46, 1, 0.5, 400);
    this.hemi = new THREE.HemisphereLight(0xe8f6ff, 0x9fc28f, 1.9);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff4e0, 2.4);
    this.sun.castShadow = true;
    const sm = mobile ? 1024 : 2048;
    this.sun.shadow.mapSize.set(sm, sm);
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.03;
    this.scene.add(this.sun, this.sun.target);
    this.setShadowSpan(24);
    this.resize();
    addEventListener('resize', () => this.resize());
  }
  setShadowSpan(s) {
    const c = this.sun.shadow.camera;
    if (Math.abs(c.right - s) < 0.5) return;
    c.left = -s; c.right = s; c.top = s; c.bottom = -s; c.near = 1; c.far = 160;
    c.updateProjectionMatrix();
  }
  setTheme(theme) {
    this.scene.background = new THREE.Color(theme.sky);
    this.scene.fog = new THREE.Fog(theme.sky, 70, 190);
    this.hemi.color.set(theme.hemiSky); this.hemi.groundColor.set(theme.hemiGround);
  }
  resize() {
    const w = innerWidth, h = innerHeight;
    this.r.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
  followSun(x, z) {
    this.sun.position.set(x + 22, 48, z + 14);
    this.sun.target.position.set(x, 0, z);
  }
  render() { this.r.render(this.scene, this.camera); }

  // Adaptive quality: if the phone can't hold ~50 fps, step down resolution, then
  // soften shadows. Never steps back up within a session (no flip-flopping).
  watchPerf(dt) {
    this._acc = (this._acc || 0) + dt; this._n = (this._n || 0) + 1;
    if (this._acc < 2) return;
    const avg = this._acc / this._n; this._acc = 0; this._n = 0;
    if (avg < 1 / 48) return;
    const pr = this.r.getPixelRatio();
    if (pr > 1.5) { this.r.setPixelRatio(1.5); this.resize(); }
    else if (pr > 1.15) { this.r.setPixelRatio(1.15); this.resize(); }
    else if (this.sun.shadow.mapSize.x > 512) { this.sun.shadow.mapSize.set(512, 512); this.sun.shadow.map?.dispose(); this.sun.shadow.map = null; }
    else if (this.r.shadowMap.enabled) { this.r.shadowMap.enabled = false; this.scene.traverse((m) => { if (m.material) m.material.needsUpdate = true; }); }
  }
}

// Hole visuals: a dark shaft (inside of a tube, gradient to black), a floor, and a
// colored rim ring with a soft halo. Unit radius; scaled by the hole's radius.
export function makeHoleMesh(color) {
  const g = new THREE.Group();
  const shaftGeo = new THREE.CylinderGeometry(1, 1, 1, 48, 12, true);
  shaftGeo.translate(0, -0.5, 0);
  const pos = shaftGeo.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const c = new THREE.Color(color);
  for (let i = 0; i < pos.count; i++) {
    const t = Math.min(1, -pos.getY(i) * 9); // 0 at the lip, black a short way down
    const k = (1 - t) * (1 - t) * 0.16;
    col[i * 3] = c.r * k; col[i * 3 + 1] = c.g * k; col[i * 3 + 2] = c.b * k;
  }
  shaftGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const shaft = new THREE.Mesh(shaftGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide }));
  const floor = new THREE.Mesh(new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x000000 }));
  floor.position.y = -1;
  const depthGroup = new THREE.Group();
  depthGroup.add(shaft, floor);
  const rimMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, depthWrite: false });
  const rim = new THREE.Mesh(new THREE.RingGeometry(1, 1.07, 64).rotateX(-Math.PI / 2), rimMat);
  rim.position.y = 0.025;
  // Halo: a radial gradient texture so the edge glows softly into the ground.
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const x = cv.getContext('2d');
  const grd = x.createRadialGradient(64, 64, 40, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,0.0)');
  grd.addColorStop(0.62, 'rgba(255,255,255,0.55)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = grd; x.fillRect(0, 0, 128, 128);
  const haloMat = new THREE.MeshBasicMaterial({ color, map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, opacity: 0.6 });
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2).rotateX(-Math.PI / 2), haloMat);
  halo.position.y = 0.02;
  g.add(depthGroup, halo, rim);
  g.userData = { depthGroup, rim, halo, rimMat, haloMat };
  return g;
}
