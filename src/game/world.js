// Spawns a map's props into physics + instanced meshes and keeps them in sync.
import * as THREE from 'three';
import { PROPS, buildGeometry, colliderHalfHeight } from './props.js';
import { patchProps, patchGround } from '../engine/render.js';
import { OBJ_ON_GROUND } from '../engine/physics.js';
import { buildArena } from './levelbuild.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

export class World {
  constructor(phys, scene, map, theme) {
    this.phys = phys; this.scene = scene; this.theme = theme;
    this.objects = []; this.byHandle = new Map();
    this.meshes = new Map();
    this.size = map.size;
    this.root = new THREE.Group();
    scene.add(this.root);
    // Phong gives the soft plastic-toy highlight; cheap enough for phones.
    this.propMat = patchProps(new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 38, specular: 0x2a2a2a }));
    if (map.world) { this.worldDef = buildArena(map.world, map.size, this.root, patchGround); this.backdrop = this.worldDef.backdrop; }
    else this.buildGround(map.flats);
    this.spawnAll(map.spawns);
    this.totalValue = this.objects.reduce((s, o) => s + o.prop.value, 0);
    this.eatenValue = 0;
  }

  buildGround(flats) {
    const t = this.theme;
    const gm = patchGround(new THREE.MeshLambertMaterial({ color: t.grass }));
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 600).rotateX(-Math.PI / 2), gm);
    ground.receiveShadow = true;
    this.root.add(ground);
    // All painted flats (roads, lots, sidewalks, markings) in one merged mesh.
    const pos = [], col = [], c = new THREE.Color();
    for (const f of flats) {
      c.set(f.color);
      const x0 = f.x - f.w / 2, x1 = f.x + f.w / 2, z0 = f.z - f.d / 2, z1 = f.z + f.d / 2, y = f.y;
      pos.push(x0, y, z0, x0, y, z1, x1, y, z1, x0, y, z0, x1, y, z1, x1, y, z0);
      for (let i = 0; i < 6; i++) col.push(c.r, c.g, c.b);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    const fm = patchGround(new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
    const flat = new THREE.Mesh(g, fm);
    flat.receiveShadow = true;
    this.root.add(flat);
    // Low hedge border so the map edge reads as a place, not a cliff.
    const half = this.size.w / 2 + 1.2;
    const hedge = new THREE.MeshLambertMaterial({ color: t.hedge });
    for (const [x, z, w, d] of [[0, -half, half * 2 + 2.4, 1.2], [0, half, half * 2 + 2.4, 1.2], [-half, 0, 1.2, half * 2], [half, 0, 1.2, half * 2]]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 1.1, d), hedge);
      m.position.set(x, 0.55, z); m.castShadow = true; m.receiveShadow = true;
      this.root.add(m);
    }
  }

  spawnAll(spawns) {
    // Count instances per prop/variant so each gets exactly one InstancedMesh.
    const counts = new Map();
    for (const s of spawns) {
      const prop = PROPS[s.id];
      const v = prop.variants ? s.variant % prop.variants : 0;
      s.key = `${s.id}:${v}`; s.v = v;
      counts.set(s.key, (counts.get(s.key) || 0) + 1);
    }
    for (const [key, n] of counts) {
      const [id, v] = key.split(':');
      const mesh = new THREE.InstancedMesh(buildGeometry(PROPS[id], +v), this.propMat, n);
      mesh.castShadow = true; mesh.receiveShadow = true;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      mesh.userData.next = 0;
      this.meshes.set(key, mesh);
      this.root.add(mesh);
    }
    const col = new THREE.Color();
    for (const s of spawns) {
      const prop = PROPS[s.id];
      const hh = colliderHalfHeight(prop.col);
      const { body, collider } = this.phys.createObject(prop, s.x, hh + 0.002, s.z, s.rot);
      const mesh = this.meshes.get(s.key);
      const slot = mesh.userData.next++;
      const tints = prop.tints;
      const tintIdx = tints ? (s.tint ?? s.variant) % tints.length : 0;
      col.set(tints ? tints[tintIdx] : 0xffffff);
      mesh.setColorAt(slot, col);
      const o = {
        prop, body, collider, mesh, slot, hh, ring: -1, captured: -1, eaten: false, tint: tintIdx,
        path: s.path ? { ...s.path } : null, locked: false, home: [s.x, s.z], rot0: s.rot,
      };
      // People and vehicles stay upright until a hole gets them.
      if (prop.walker || prop.driver) { body.lockRotations(true, false); o.locked = true; }
      this.objects.push(o);
      this.byHandle.set(collider.handle, o);
      this.writeMatrix(o);
    }
    for (const m of this.meshes.values()) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
  }

  writeMatrix(o) {
    const t = o.body.translation(), r = o.body.rotation();
    if (o.lastPos) { o.lastPos[0] = t.x; o.lastPos[1] = t.z; } else o.lastPos = [t.x, t.z];
    _p.set(t.x, t.y, t.z); _q.set(r.x, r.y, r.z, r.w);
    if (o.popT > 0) { const k = 1 - o.popT / 0.4; const e = 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2); _s.setScalar(Math.max(0.01, e)); }
    // Shrink a little as it sinks down the shaft: reads as being swallowed.
    if (t.y < 0) _s.multiplyScalar(Math.max(0.45, 1 + t.y * 0.09));
    _m.compose(_p, _q, _s);
    _s.setScalar(1);
    o.mesh.setMatrixAt(o.slot, _m);
  }

  // Sync awake bodies into their instance slots.
  sync(dt = 0) {
    const dirty = new Set();
    for (const o of this.objects) {
      if (o.eaten) continue;
      if (o.popT > 0) { o.popT = Math.max(0, o.popT - dt); this.writeMatrix(o); dirty.add(o.mesh); continue; }
      if (o.body.isSleeping()) continue;
      this.writeMatrix(o);
      dirty.add(o.mesh);
    }
    for (const m of dirty) m.instanceMatrix.needsUpdate = true;
  }

  eat(o) {
    o.eaten = true;
    o.mesh.setMatrixAt(o.slot, ZERO);
    o.mesh.instanceMatrix.needsUpdate = true;
    this.byHandle.delete(o.collider.handle);
    this.phys.remove(o.body);
    this.eatenValue += o.prop.value;
  }

  // Bring an eaten object back at its home spot with a little pop-in (Zen boards).
  revive(o) {
    const { body, collider } = this.phys.createObject(o.prop, o.home[0], o.hh + 0.002, o.home[1], o.rot0 || 0);
    o.body = body; o.collider = collider;
    o.eaten = false; o.ring = -1; o.captured = -1; o.locked = false; o.popT = 0.4;
    if (o.prop.walker || o.prop.driver) { body.lockRotations(true, false); o.locked = true; }
    this.byHandle.set(collider.handle, o);
    this.eatenValue = Math.max(0, this.eatenValue - o.prop.value);
    this.writeMatrix(o);
    o.mesh.instanceMatrix.needsUpdate = true;
  }

  setOnGround(o) {
    if (o.ring === -1) return;
    o.ring = -1;
    o.collider.setCollisionGroups(OBJ_ON_GROUND);
  }
}
