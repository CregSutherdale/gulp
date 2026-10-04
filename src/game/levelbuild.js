// Turns a level definition (placement ops) into spawns, and paints themed floors.
import * as THREE from 'three';
import { PROPS } from './props.js';
import { rng } from './maps.js';
import { buildBackdrop } from './backdrops.js';

export function buildLevel(level) {
  const R = rng(level.id * 1009 + 7);
  const spawns = [];
  const tintOf = (op, i) => {
    const prop = PROPS[op.id];
    const n = prop.tints ? prop.tints.length : 1;
    if (op.tint === 'cycle') return i % n;
    if (op.tint === 'random') return Math.floor(R() * n);
    return typeof op.tint === 'number' ? op.tint % n : 0;
  };
  const push = (op, i, x, z, rot) => spawns.push({
    id: op.id, x, z, rot: rot ?? (op.rot ?? (R() - 0.5) * 0.5), tint: tintOf(op, i), variant: Math.floor(R() * 8),
  });
  for (const op of level.place) {
    if (!PROPS[op.id]) { console.warn('unknown prop', op.id); continue; }
    switch (op.op) {
      case 'at': push(op, 0, op.x, op.z, op.rot ?? 0); break;
      case 'grid': {
        let i = 0;
        for (let r = 0; r < op.rows; r++) for (let c = 0; c < op.cols; c++) {
          const gx = op.gapX ?? op.gap, gz = op.gapZ ?? op.gap;
          push(op, i++, op.x + (c - (op.cols - 1) / 2) * gx, op.z + (r - (op.rows - 1) / 2) * gz, op.rot ?? 0);
        }
        break;
      }
      case 'ring':
        for (let i = 0; i < op.n; i++) {
          const a = (i / op.n) * Math.PI * 2 + (op.phase || 0);
          push(op, i, op.x + Math.cos(a) * op.r, op.z + Math.sin(a) * op.r, op.rot ?? (Math.PI / 2 - a));
        }
        break;
      case 'line':
        for (let i = 0; i < op.n; i++) {
          const t = op.n === 1 ? 0.5 : i / (op.n - 1);
          push(op, i, op.x0 + (op.x1 - op.x0) * t, op.z0 + (op.z1 - op.z0) * t, op.rot ?? 0);
        }
        break;
      case 'pile': {
        const rad = PROPS[op.id].fit / 2;
        const placed = [];
        for (let i = 0; i < op.n; i++) {
          for (let tries = 0; tries < 30; tries++) {
            const a = R() * Math.PI * 2, d = Math.sqrt(R()) * op.spread;
            const x = op.x + Math.cos(a) * d, z = op.z + Math.sin(a) * d;
            if (placed.every(([px, pz]) => Math.hypot(px - x, pz - z) > rad * 2 + 0.05)) {
              placed.push([x, z]); push(op, i, x, z, R() * Math.PI * 2); break;
            }
          }
        }
        break;
      }
    }
  }
  return { spawns, flats: [], size: { w: level.arena.w, d: level.arena.d } };
}

// ---------------------------------------------------------------- floors
function canvasTex(w, h, draw, repeat = 1) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  t.repeat.set(repeat, repeat);
  return t;
}
function noise(x, w, h, a, base) {
  const img = x.getImageData(0, 0, w, h), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * a; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  x.putImageData(img, 0, 0);
}

// Each world: the floor inside the arena (texture tile size in world units), the
// surround outside it, the wall color, sky and lighting.
export const WORLDS = {
  bakery: {
    label: 'Sweet Bakery', sky: 0xffe3ee, hemiSky: 0xfff3f8, hemiGround: 0xf1c6d6, surround: 0xf7cfdc, wall: 0xffffff, accent: '#ff7eb6',
    tile: 2, floor: (x, w, h) => {
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { x.fillStyle = (i + j) % 2 ? '#fff5f8' : '#ffd9e6'; x.fillRect(i * w / 2, j * h / 2, w / 2, h / 2); }
      noise(x, w, h, 8);
    },
  },
  picnic: {
    label: 'Picnic Park', sky: 0xcdeeff, hemiSky: 0xeefaff, hemiGround: 0xa8d48e, surround: 0x86c662, wall: 0xf4e6c8, accent: '#ff6b6b',
    tile: 4, floor: (x, w, h) => {
      for (let i = 0; i < 4; i++) { x.fillStyle = i % 2 ? '#9bd46f' : '#a8dc7c'; x.fillRect(0, i * h / 4, w, h / 4); }
      noise(x, w, h, 14);
    },
    blanket: true,
  },
  playroom: {
    label: 'Toy Room', sky: 0xe4e8ff, hemiSky: 0xf4f5ff, hemiGround: 0xc6c9ec, surround: 0xc8b49a, wall: 0xffe9a8, accent: '#6c8cff',
    tile: 3, floor: (x, w, h) => {
      x.fillStyle = '#b9d7ff'; x.fillRect(0, 0, w, h);
      x.strokeStyle = 'rgba(255,255,255,.35)'; x.lineWidth = 3;
      for (let i = 0; i < w; i += 16) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, h); x.stroke(); x.beginPath(); x.moveTo(0, i); x.lineTo(w, i); x.stroke(); }
      noise(x, w, h, 10);
    },
  },
  garden: {
    label: 'Flower Garden', sky: 0xd6f3ff, hemiSky: 0xf0fbff, hemiGround: 0x9fcf86, surround: 0x6fb453, wall: 0xb98a5c, accent: '#3fbf6f',
    tile: 3, floor: (x, w, h) => {
      x.fillStyle = '#8fd168'; x.fillRect(0, 0, w, h);
      for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(${60 + Math.random() * 40},${150 + Math.random() * 60},60,.35)`; x.fillRect(Math.random() * w, Math.random() * h, 2, 5); }
    },
  },
  beach: {
    label: 'Sunny Beach', sky: 0xbfeaff, hemiSky: 0xf2fbff, hemiGround: 0xf0d9a6, surround: 0x5cc8e8, wall: 0xffffff, accent: '#ffb547',
    tile: 4, floor: (x, w, h) => {
      x.fillStyle = '#f6dfa6'; x.fillRect(0, 0, w, h);
      noise(x, w, h, 22);
      x.strokeStyle = 'rgba(255,255,255,.25)'; x.lineWidth = 2;
      for (let i = 0; i < 6; i++) { x.beginPath(); for (let k = 0; k <= w; k += 8) x.lineTo(k, i * h / 6 + Math.sin(k * 0.05 + i) * 4); x.stroke(); }
    },
  },
  kitchen: {
    label: 'Cozy Kitchen', sky: 0xfff0dc, hemiSky: 0xfff8ee, hemiGround: 0xe6c9a3, surround: 0x9c6b47, wall: 0xf6efe4, accent: '#ff9a3c',
    tile: 4, floor: (x, w, h) => {
      const planks = 6;
      for (let i = 0; i < planks; i++) {
        const l = 62 + (i % 3) * 4;
        x.fillStyle = `hsl(30, 45%, ${l}%)`; x.fillRect(0, i * h / planks, w, h / planks - 2);
        x.fillStyle = 'rgba(120,70,30,.25)'; x.fillRect(0, (i + 1) * h / planks - 2, w, 2);
      }
      noise(x, w, h, 12);
    },
  },
};


// ---- Season 2 worlds
Object.assign(WORLDS, {
  candy: {
    label: 'Candy Land', sky: 0xffe0f3, hemiSky: 0xfff4fb, hemiGround: 0xf3c4e4, surround: 0xffc8e8, wall: 0xffffff, accent: '#ff6ec7',
    tile: 4, floor: (x, w, h) => {
      // diagonal candy stripes
      x.fillStyle = '#fff1f8'; x.fillRect(0, 0, w, h);
      x.save(); x.translate(w / 2, h / 2); x.rotate(-Math.PI / 4); x.translate(-w, -h);
      for (let i = 0; i < 12; i++) { x.fillStyle = i % 2 ? '#ffd3ec' : '#d8f5ec'; x.fillRect(i * w / 3, 0, w / 6, h * 2); }
      x.restore();
      noise(x, w, h, 6);
    },
  },
  farm: {
    label: 'Sunny Farm', sky: 0xd4f0ff, hemiSky: 0xf3fbff, hemiGround: 0xb8d38a, surround: 0x92c461, wall: 0xb07a4a, accent: '#7cc35a',
    tile: 4, floor: (x, w, h) => {
      for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#a5d66f' : '#9acd65'; x.fillRect(0, i * h / 8, w, h / 8); }
      for (let i = 0; i < 700; i++) { x.fillStyle = `rgba(${70 + Math.random() * 40},${140 + Math.random() * 50},50,.35)`; x.fillRect(Math.random() * w, Math.random() * h, 2, 4); }
    },
  },
  snow: {
    label: 'Snowy Village', sky: 0xdcefff, hemiSky: 0xf6fbff, hemiGround: 0xcfdcee, surround: 0xe9f3ff, wall: 0xffffff, accent: '#6fb7ff',
    tile: 4, floor: (x, w, h) => {
      // Soft icy blue (not pure white) so white props (snowmen, snowballs) stand out.
      x.fillStyle = '#dce9f8'; x.fillRect(0, 0, w, h);
      noise(x, w, h, 8);
      for (let i = 0; i < 260; i++) { x.fillStyle = `rgba(255,255,255,${0.35 + Math.random() * 0.4})`; const r = 1 + Math.random() * 2; x.beginPath(); x.arc(Math.random() * w, Math.random() * h, r, 0, 6.3); x.fill(); }
    },
  },
});

// Filled rounded rectangle (no ctx.roundRect: older iPhone Safari lacks it).
function rrect(x, l, t, w, h, r) {
  x.beginPath(); x.moveTo(l + r, t); x.arcTo(l + w, t, l + w, t + h, r); x.arcTo(l + w, t + h, l, t + h, r);
  x.arcTo(l, t + h, l, t, r); x.arcTo(l, t, l + w, t, r); x.closePath(); x.fill();
}
// ---- Season 3 worlds
Object.assign(WORLDS, {
  craft: {
    // A sage-green cutting mat on a craft table: buttons, yarn and spools pop on it.
    label: 'Craft Corner', sky: 0xfff0e2, hemiSky: 0xfff8f0, hemiGround: 0xd9c3a8, surround: 0xd7a46e, wall: 0xffd45e, accent: '#ff7a59',
    tile: 4, floor: (x, w, h) => {
      x.fillStyle = '#a9d9bd'; x.fillRect(0, 0, w, h);
      noise(x, w, h, 6);
      // fine grid, a bolder line every 4 cells, and ruler ticks along one edge
      x.strokeStyle = 'rgba(255,255,255,.45)'; x.lineWidth = 1;
      for (let i = 0; i <= w; i += w / 8) { x.beginPath(); x.moveTo(i + 0.5, 0); x.lineTo(i + 0.5, h); x.stroke(); x.beginPath(); x.moveTo(0, i + 0.5); x.lineTo(w, i + 0.5); x.stroke(); }
      x.strokeStyle = 'rgba(255,255,255,.75)'; x.lineWidth = 2.5;
      x.beginPath(); x.moveTo(1, 0); x.lineTo(1, h); x.moveTo(0, 1); x.lineTo(w, 1); x.stroke();
      x.fillStyle = 'rgba(255,255,255,.7)';
      for (let i = 0; i < 16; i++) x.fillRect(i * w / 16, h - (i % 2 ? 6 : 12), 2, i % 2 ? 6 : 12);
    },
  },
  fair: {
    // Lilac fairground cobbles in the late-afternoon sun: balloons and prizes pop on them.
    label: 'Fun Fair', sky: 0xffe2d4, hemiSky: 0xfff3ec, hemiGround: 0xd8c6e4, surround: 0x8fcf73, wall: 0xff6f91, accent: '#ff5d8f',
    tile: 3, floor: (x, w, h) => {
      x.fillStyle = '#bcaed6'; x.fillRect(0, 0, w, h);
      const n = 4, s = w / n;
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const ox = (j % 2) * s / 2;
        x.fillStyle = ['#d8cdea', '#d0c3e5', '#ddd3ee', '#cbbde1'][(i + j * 3) % 4];
        rrect(x, i * s + ox + 3, j * s + 3, s - 6, s - 6, 10);
        if (ox) rrect(x, ox - s + 3, j * s + 3, s - 6, s - 6, 10);
      }
      noise(x, w, h, 6);
      const conf = ['#ff6f91', '#ffd23f', '#5cc8ff', '#7be07a', '#b48cff'];
      for (let i = 0; i < 26; i++) { x.fillStyle = conf[i % 5]; x.save(); x.translate(Math.random() * w, Math.random() * h); x.rotate(Math.random() * 3); x.fillRect(-3, -1.5, 6, 3); x.restore(); }
    },
  },
  space: {
    // Pale moon dust with soft craters under a violet night sky; bright toys pop on it.
    label: 'Moon Camp', sky: 0x3a3b7c, hemiSky: 0xf2f0ff, hemiGround: 0xbab3dc, surround: 0x9d97c4, wall: 0xd7dcf0, accent: '#8a7dff',
    tile: 5, floor: (x, w, h) => {
      x.fillStyle = '#d4d0e8'; x.fillRect(0, 0, w, h);
      noise(x, w, h, 10);
      const crater = (cx, cy, r) => {
        for (const [ox, oy] of [[0, 0], [w, 0], [-w, 0], [0, h], [0, -h]]) {
          x.fillStyle = 'rgba(120,110,170,.16)'; x.beginPath(); x.arc(cx + ox, cy + oy, r, 0, 6.3); x.fill();
          x.strokeStyle = 'rgba(255,255,255,.5)'; x.lineWidth = 2; x.beginPath(); x.arc(cx + ox - 1, cy + oy - 1, r, 3.4, 5.6); x.stroke();
        }
      };
      [[40, 50, 22], [180, 70, 14], [120, 170, 30], [220, 210, 12], [60, 220, 9], [200, 140, 8]].forEach(([a, b, r]) => crater(a * w / 256, b * h / 256, r * w / 256));
    },
  },
});

export function buildArena(world, arena, root, patchGround) {
  const W = WORLDS[world];
  const g = new THREE.Group();
  const surround = new THREE.Mesh(new THREE.PlaneGeometry(600, 600).rotateX(-Math.PI / 2),
    patchGround(new THREE.MeshLambertMaterial({ color: W.surround })));
  surround.position.y = -0.002; surround.receiveShadow = true;
  const tex = canvasTex(256, 256, W.floor);
  tex.repeat.set(arena.w / W.tile, arena.d / W.tile);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(arena.w + 0.6, arena.d + 0.6).rotateX(-Math.PI / 2),
    patchGround(new THREE.MeshLambertMaterial({ map: tex })));
  floor.receiveShadow = true;
  g.add(surround, floor);
  if (W.blanket) {
    const bt = canvasTex(128, 128, (x, w, h) => {
      x.fillStyle = '#fff6f0'; x.fillRect(0, 0, w, h);
      x.fillStyle = 'rgba(232,72,85,.55)';
      for (let i = 0; i < 4; i++) { x.fillRect(i * w / 4, 0, w / 8, h); x.fillRect(0, i * h / 4, w, h / 8); }
    });
    bt.repeat.set(3, 3);
    const bw = Math.min(arena.w * 0.62, 12), bd = Math.min(arena.d * 0.5, 12);
    const bl = new THREE.Mesh(new THREE.PlaneGeometry(bw, bd).rotateX(-Math.PI / 2),
      patchGround(new THREE.MeshLambertMaterial({ map: bt, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })));
    bl.position.y = 0.01; bl.receiveShadow = true;
    g.add(bl);
  }
  // Rounded rail around the arena.
  const wallMat = new THREE.MeshPhongMaterial({ color: W.wall, shininess: 40, specular: 0x222222 });
  const hw = arena.w / 2 + 0.55, hd = arena.d / 2 + 0.55, t = 0.5, hgt = 0.7;
  for (const [x, z, w, d] of [[0, -hd, arena.w + 1.6, t], [0, hd, arena.w + 1.6, t], [-hw, 0, t, arena.d + 0.6], [hw, 0, t, arena.d + 0.6]]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, hgt, d), wallMat);
    m.position.set(x, hgt / 2, z); m.castShadow = true; m.receiveShadow = true;
    g.add(m);
  }
  root.add(g);
  // Scenery is decoration: if it ever fails, the level must still load.
  let backdrop = null;
  try { backdrop = buildBackdrop(world, arena, root); } catch (e) { console.error('backdrop', e); }
  return { ...W, backdrop };
}
