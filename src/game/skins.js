// Hole skins: rim/halo color plus an optional animated style. Unlocked by stars.
import * as THREE from 'three';

export const SKINS = [
  { id: 'blossom', name: 'Blossom', color: 0xff5fa2, need: 0 },
  { id: 'mint', name: 'Mint', color: 0x2fd39a, need: 6 },
  { id: 'sky', name: 'Sky', color: 0x48b8ff, need: 12 },
  { id: 'sunny', name: 'Sunny', color: 0xffc21a, need: 18 },
  { id: 'grape', name: 'Grape', color: 0x8c6cff, need: 26 },
  { id: 'coral', name: 'Coral', color: 0xff7a59, need: 34 },
  { id: 'rainbow', name: 'Rainbow', color: 0xff5fa2, need: 45, anim: 'rainbow' },
  { id: 'galaxy', name: 'Galaxy', color: 0x9b7bff, need: 60, anim: 'twinkle' },
  { id: 'gold', name: 'Golden', color: 0xffd54a, need: 80, anim: 'shine' },
];
export const skinById = (id) => SKINS.find((s) => s.id === id) || SKINS[0];
export const cssColor = (hex) => '#' + hex.toString(16).padStart(6, '0');

const _c = new THREE.Color();
// Called every frame for the player's hole.
export function animateSkin(skin, mesh, t) {
  const u = mesh.userData;
  if (skin.anim === 'rainbow') {
    _c.setHSL((t * 0.12) % 1, 0.85, 0.62);
    u.rimMat.color.copy(_c); u.haloMat.color.copy(_c);
  } else if (skin.anim === 'twinkle') {
    _c.setHSL(0.72 + Math.sin(t * 1.3) * 0.08, 0.8, 0.62 + Math.sin(t * 7) * 0.08);
    u.rimMat.color.copy(_c); u.haloMat.color.copy(_c);
  } else if (skin.anim === 'shine') {
    _c.setHSL(0.12, 0.95, 0.55 + Math.max(0, Math.sin(t * 2.2)) * 0.25);
    u.rimMat.color.copy(_c); u.haloMat.color.copy(_c);
  }
}
