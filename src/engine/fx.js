// Cheap 3D juice: a pooled burst of little candy-colored bits that pop out of the
// rim when something drops in. One InstancedMesh, CPU-integrated, no allocations.
import * as THREE from 'three';

const N = 240;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
const COLORS = [0xff5fa2, 0xffc93c, 0x2fd39a, 0x48b8ff, 0x8c6cff, 0xffffff];

export class Sparkles {
  constructor(scene) {
    const geo = new THREE.OctahedronGeometry(0.09, 0);
    this.mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff }), N);
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.p = Array.from({ length: N }, () => ({ life: 0 }));
    this.next = 0;
    const c = new THREE.Color();
    for (let i = 0; i < N; i++) { this.mesh.setColorAt(i, c.set(COLORS[i % COLORS.length])); this.mesh.setMatrixAt(i, _m.makeScale(0, 0, 0)); }
    scene.add(this.mesh);
  }
  burst(x, z, r, n = 10, scale = 1) {
    for (let i = 0; i < n; i++) {
      const p = this.p[this.next]; this.next = (this.next + 1) % N;
      const a = Math.random() * Math.PI * 2;
      p.x = x + Math.cos(a) * r * 0.9; p.y = 0.15; p.z = z + Math.sin(a) * r * 0.9;
      const sp = (1.5 + Math.random() * 2.5) * scale;
      p.vx = Math.cos(a) * sp; p.vz = Math.sin(a) * sp; p.vy = (3 + Math.random() * 3) * scale;
      p.life = p.max = 0.55 + Math.random() * 0.35; p.rot = Math.random() * 6; p.s = (0.7 + Math.random() * 0.8) * scale;
    }
  }
  update(dt) {
    let any = false;
    for (let i = 0; i < N; i++) {
      const p = this.p[i];
      if (p.life <= 0) continue;
      any = true;
      p.life -= dt;
      if (p.life <= 0) { this.mesh.setMatrixAt(i, _m.makeScale(0, 0, 0)); continue; }
      p.vy -= 14 * dt; p.x += p.vx * dt; p.y = Math.max(0.05, p.y + p.vy * dt); p.z += p.vz * dt; p.rot += dt * 8;
      const k = Math.min(1, p.life / p.max * 1.6) * p.s;
      _q.setFromEuler(_e.set(p.rot, p.rot * 0.7, 0));
      this.mesh.setMatrixAt(i, _m.compose(_p.set(p.x, p.y, p.z), _q, _s.set(k, k, k)));
    }
    if (any || this.dirty) { this.mesh.instanceMatrix.needsUpdate = true; this.dirty = any; }
  }
  dispose(scene) { scene.remove(this.mesh); }
}

// A thin arc around the rim that fills as the hole approaches its next size.
export function makeProgressRing(color) {
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uProg: { value: 0 }, uColor: { value: new THREE.Color(color) }, uFlash: { value: 0 } },
    vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform float uProg; uniform vec3 uColor; uniform float uFlash; varying vec2 vP;
      void main(){
        float a = atan(vP.x, vP.y) / 6.2831853 + 0.5;
        float on = step(a, uProg);
        vec3 c = mix(vec3(1.0), uColor, on);
        gl_FragColor = vec4(mix(c, vec3(1.0), uFlash), mix(0.35, 0.95, on));
      }`,
  });
  const g = new THREE.RingGeometry(1.1, 1.2, 72, 1);
  const m = new THREE.Mesh(g, mat);
  m.rotation.x = -Math.PI / 2; m.position.y = 0.03;
  return m;
}

// Bouncing arrows hovering over specific objects (the last few level targets).
export class Markers {
  constructor(scene) {
    const g = new THREE.ConeGeometry(0.32, 0.6, 12); g.rotateX(Math.PI); g.translate(0, 0.3, 0);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffd23f });
    const outline = new THREE.MeshBasicMaterial({ color: 0x2b2141, side: THREE.BackSide });
    this.list = Array.from({ length: 8 }, () => {
      const m = new THREE.Group();
      const a = new THREE.Mesh(g, mat), o = new THREE.Mesh(g, outline);
      o.scale.setScalar(1.18); o.position.y = -0.04;
      m.add(o, a); m.visible = false; scene.add(m);
      return m;
    });
  }
  update(objs, t) {
    this.list.forEach((m, i) => {
      const o = objs[i];
      if (!o || !o.lastPos) { m.visible = false; return; }
      const y = o.hh * 2 + 0.6 + Math.abs(Math.sin(t * 4 + i)) * 0.45;
      const s = Math.max(1, o.hh * 0.9);
      m.visible = true; m.position.set(o.lastPos[0], y, o.lastPos[1]); m.scale.setScalar(s); m.rotation.y = t * 2;
    });
  }
}
