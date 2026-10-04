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
  { id: 'sugar', name: 'Sugar', color: 0xff7ac8, need: 100, anim: 'candy' },
  { id: 'aurora', name: 'Aurora', color: 0x5fe3c0, need: 115, anim: 'aurora' },
  { id: 'love', name: 'Sweetheart', color: 0xff4f7b, need: 130, anim: 'heart' },
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
  } else if (skin.anim === 'candy') {
    _c.set(Math.floor(t * 2.2) % 2 ? 0xff7ac8 : 0x7fe3c5);
    u.rimMat.color.copy(_c); u.haloMat.color.copy(_c);
  } else if (skin.anim === 'aurora') {
    _c.setHSL(0.42 + Math.sin(t * 0.6) * 0.12, 0.75, 0.6);
    u.rimMat.color.copy(_c); u.haloMat.color.copy(_c);
  } else if (skin.anim === 'heart') {
    const beat = Math.pow(Math.max(0, Math.sin(t * 7.5)), 8) + Math.pow(Math.max(0, Math.sin(t * 7.5 - 1.2)), 8) * 0.6;
    _c.setHSL(0.96, 0.85, 0.55 + beat * 0.2);
    u.rimMat.color.copy(_c); u.haloMat.color.copy(_c);
    u.haloMat.opacity = 0.45 + beat * 0.5;
  } else if (skin.anim === 'shine') {
    _c.setHSL(0.12, 0.95, 0.55 + Math.max(0, Math.sin(t * 2.2)) * 0.25);
    u.rimMat.color.copy(_c); u.haloMat.color.copy(_c);
  }
}
