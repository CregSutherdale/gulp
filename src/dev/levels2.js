// Dev page: preview one Season 2 level exactly as the game builds it (Round -> buildLevel ->
// World, physics settle, the level-intro overview camera), or framed straight from above.
//   /levels2.html?id=31                 intro overview (pitch 62, portrait-aware framing)
//   ?view=top                           orthographic top-down of the whole arena
//   ?view=play&hx=0&hz=5&r=1.2          the gameplay camera over a spot with a given hole radius
//   ?mark=1                             ring every target object (top view)
//   ?bug=1                              the engine's current shader (tint colors every part)
//   ?w=390&h=844                        canvas size (phone portrait by default)
import '../game/props_cozy.js';
import '../game/props_wave2.js';
import * as THREE from 'three';
import { LEVELS } from '../game/levels_wave2.js';
import { initPhysics, PhysicsWorld } from '../engine/physics.js';
import { Renderer } from '../engine/render.js';
import { Round } from '../game/round.js';

const q = new URLSearchParams(location.search);
const W = +(q.get('w') || 390), H = +(q.get('h') || 844);
const fixTint = (m) => {
  m.onBeforeCompile = ((orig) => (sh, r) => {
    orig(sh, r);
    sh.vertexShader = sh.vertexShader.replace('#include <color_vertex>',
      THREE.ShaderChunk.color_vertex.replace('vColor.xyz *= instanceColor.xyz;', 'vColor.xyz *= mix(vec3(1.0), instanceColor.xyz, tmask);'));
  })(m.onBeforeCompile);
  m.customProgramCacheKey = () => 'props-tint-dev';
  m.needsUpdate = true;
};

async function run() {
  await initPhysics();
  const canvas = document.getElementById('c');
  const renderer = new Renderer(canvas);
  renderer.resize = function () {
    this.r.setPixelRatio(1); this.r.setSize(W, H, false);
    this.r.domElement.style.cssText = `position:absolute;left:0;top:0;width:${W}px;height:${H}px`;
    this.camera.aspect = W / H; this.camera.updateProjectionMatrix();
  };
  renderer.resize();
  const L = LEVELS.find((l) => l.id === +(q.get('id') || 31)) || LEVELS[0];
  const phys = new PhysicsWorld();
  const round = new Round({ phys, renderer, kind: 'level', level: L, playerName: 'Preview', playerColor: 0xff5fa2, events: {} });
  if (q.get('bug') !== '1') fixTint(round.world.propMat);
  // how far did anything move while settling? (an overlap would have pushed it)
  let maxMove = 0, worst = '';
  for (const o of round.world.objects) {
    if (o.eaten) { worst += ` LOST:${o.prop.id}`; continue; }
    const t = o.body.translation(), m = Math.hypot(t.x - o.home[0], t.z - o.home[1]);
    if (m > maxMove) { maxMove = m; worst = o.prop.id; }
  }
  // ?view=play: the gameplay camera at the start (or at ?hx=&hz=), hole radius ?r=
  if (q.get('view') === 'play') {
    round.overview = false;
    const p = round.player;
    if (q.has('hx')) p.place(+q.get('hx'), +q.get('hz'));
    if (q.has('r')) { p.mass = (Math.pow(+q.get('r'), 2) - 0.25) / 0.0436; p.applyRadius(true); }
    round.snapCamera();
  }
  round.idle(0);
  let cam = renderer.camera;
  if (q.get('view') === 'top') {
    const a = W / H, hw = L.arena.w / 2 + 1.2, hd = L.arena.d / 2 + 1.2, s = Math.max(hw, hd * a);
    cam = new THREE.OrthographicCamera(-s, s, s / a, -s / a, 0.1, 200);
    cam.position.set(0, 80, 0.001); cam.lookAt(0, 0, 0);
    renderer.followSun(0, 0); renderer.setShadowSpan(Math.max(hw, hd) + 4);
    if (q.get('mark') === '1') {
      const ringMat = new THREE.MeshBasicMaterial({ color: 0xff0044 });
      for (const o of round.world.objects) {
        if (!round.targets.some((t) => t.match(o))) continue;
        const r = o.prop.fit / 2 + 0.12, m = new THREE.Mesh(new THREE.RingGeometry(r, r + 0.09, 24).rotateX(-Math.PI / 2), ringMat);
        const t = o.body.translation(); m.position.set(t.x, 6, t.z); renderer.scene.add(m);
      }
    }
  }
  renderer.r.render(renderer.scene, cam);
  const info = document.getElementById('info');
  info.textContent = `L${L.id} ${L.name}  ${L.arena.w}x${L.arena.d}  objs ${round.world.objects.length}  settle max move ${maxMove.toFixed(2)} (${worst})  targets ${round.targets.map((t) => `${t.need} ${t.id}${t.tint !== undefined ? '#' + t.tint : ''}`).join(', ')}`;
  if (q.get('info') === '0') info.style.display = 'none';
  window.__preview = { maxMove, worst, n: round.world.objects.length };
  document.title = 'levels2 ready';
}
run().catch((e) => { document.getElementById('info').textContent = 'ERROR ' + e.stack; document.title = 'ERROR'; });
