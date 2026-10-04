// Rapier world + the trick that makes a moving hole physically real.
//
// The ground is a static slab. Each hole carries its own "ring": a solid annulus
// (top at y=0) with an open shaft in the middle, built from convex wedges. Objects
// near a hole that are small enough stop colliding with the ground and collide
// with that hole's ring instead, so the shaft is a real opening: things teeter on
// the rim, tip in and tumble down. Everything else keeps standing on the ground.
import RAPIER from '@dimforge/rapier3d-compat';

export let R = null;
export async function initPhysics() { await RAPIER.init(); R = RAPIER; }

export const GROUND_BIT = 1 << 0;
export const OBJ_BIT = 1 << 1;
export const ringBit = (k) => 1 << (2 + k); // up to 14 holes
export const groups = (member, filter) => ((member & 0xffff) << 16) | (filter & 0xffff);

export const OBJ_ON_GROUND = groups(OBJ_BIT, GROUND_BIT | OBJ_BIT);
export const objOnRing = (k) => groups(OBJ_BIT, ringBit(k) | OBJ_BIT);

const WEDGES = 28;

export class PhysicsWorld {
  constructor() {
    this.world = new R.World({ x: 0, y: -24, z: 0 });
    this.world.timestep = 1 / 60;
    this.world.numSolverIterations = 4;
    const gb = this.world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(0, -5, 0));
    this.world.createCollider(
      R.ColliderDesc.cuboid(400, 5, 400).setCollisionGroups(groups(GROUND_BIT, OBJ_BIT)).setFriction(0.8), gb);
  }
  step() { this.world.step(); }

  // A ring is a fixed body we TELEPORT each frame (setTranslation) instead of
  // driving kinematically: a kinematic body would carry everything resting on it
  // along with the hole through friction.
  createRing(k) {
    const body = this.world.createRigidBody(R.RigidBodyDesc.fixed());
    return { k, body, colliders: [], r: 0 };
  }
  rebuildRing(ring, r, depth) {
    for (const c of ring.colliders) this.world.removeCollider(c, false);
    ring.colliders.length = 0;
    const rOut = r + 7.5;
    const g = groups(ringBit(ring.k), OBJ_BIT);
    for (let i = 0; i < WEDGES; i++) {
      const a0 = (i / WEDGES) * Math.PI * 2, a1 = ((i + 1) / WEDGES) * Math.PI * 2;
      // Inner points sit exactly on the circle; the chord between them bulges a hair
      // into the opening, so push the inner radius out by the sagitta to keep the
      // physical opening >= r everywhere.
      const ri = r / Math.cos(Math.PI / WEDGES);
      const pts = new Float32Array([
        Math.cos(a0) * ri, 0, Math.sin(a0) * ri, Math.cos(a1) * ri, 0, Math.sin(a1) * ri,
        Math.cos(a0) * rOut, 0, Math.sin(a0) * rOut, Math.cos(a1) * rOut, 0, Math.sin(a1) * rOut,
        Math.cos(a0) * ri, -depth, Math.sin(a0) * ri, Math.cos(a1) * ri, -depth, Math.sin(a1) * ri,
        Math.cos(a0) * rOut, -depth, Math.sin(a0) * rOut, Math.cos(a1) * rOut, -depth, Math.sin(a1) * rOut,
      ]);
      const desc = R.ColliderDesc.convexHull(pts);
      desc.setCollisionGroups(g).setFriction(0.6);
      ring.colliders.push(this.world.createCollider(desc, ring.body));
    }
    ring.r = r;
  }
  moveRing(ring, x, z) { ring.body.setTranslation({ x, y: 0, z }, true); }

  createObject(prop, x, y, z, rotY) {
    const half = Math.sin(rotY / 2), cos = Math.cos(rotY / 2);
    const bd = R.RigidBodyDesc.dynamic().setTranslation(x, y, z).setRotation({ x: 0, y: half, z: 0, w: cos })
      .setLinearDamping(0.05).setAngularDamping(0.25).setCanSleep(true).setCcdEnabled(prop.col.t === 'capsule');
    const body = this.world.createRigidBody(bd);
    const c = prop.col;
    let cd;
    if (c.t === 'box') cd = R.ColliderDesc.cuboid(c.w / 2, c.h / 2, c.d / 2);
    else if (c.t === 'cyl') cd = R.ColliderDesc.cylinder(c.h / 2, c.r);
    else if (c.t === 'ball') cd = R.ColliderDesc.ball(c.r);
    else cd = R.ColliderDesc.capsule(Math.max(0.01, c.h / 2 - c.r), c.r);
    cd.setMass(prop.mass).setFriction(0.7).setRestitution(0.05).setCollisionGroups(OBJ_ON_GROUND);
    const collider = this.world.createCollider(cd, body);
    body.sleep();
    return { body, collider };
  }
  remove(body) { this.world.removeRigidBody(body); }
}
