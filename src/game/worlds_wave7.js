// Season 7 worlds (GRAND FINALE): Pizza Parlor, Dino Dig and Fairy Castle.
// WORLDS: floor/sky defs (same shape as levelbuild.js WORLDS). BACKDROPS: scenery
// builders (same kit K as backdrops.js). MUSIC: world -> track key (src/engine/audio.js).

function noise(x, w, h, a) {
  const img = x.getImageData(0, 0, w, h), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * a; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  x.putImageData(img, 0, 0);
}

export const WORLDS = {
  pizza: {
    // A cool blue-gray marble counter, dusted with flour: warm toppings pop on it.
    label: 'Pizza Parlor', sky: 0xffeedd, hemiSky: 0xfff7ee, hemiGround: 0xe0c8b0, surround: 0x9c6b47, wall: 0xc8553d, accent: '#e8473c',
    tile: 5, floor: (x, w, h) => {
      x.fillStyle = '#d3e0e6'; x.fillRect(0, 0, w, h);
      for (let i = 0; i < 9; i++) {
        const g = x.createRadialGradient(Math.random() * w, Math.random() * h, 0, Math.random() * w, Math.random() * h, 60 + Math.random() * 60);
        g.addColorStop(0, 'rgba(240,246,250,.45)'); g.addColorStop(1, 'rgba(240,246,250,0)');
        x.fillStyle = g; x.fillRect(0, 0, w, h);
      }
      x.lineWidth = 1.4;
      for (let v = 0; v < 5; v++) {
        let px = Math.random() * w, py = Math.random() * h, a = Math.random() * 6.3;
        x.strokeStyle = `rgba(150,170,185,${0.25 + Math.random() * 0.2})`; x.beginPath(); x.moveTo(px, py);
        for (let k = 0; k < 30; k++) { a += (Math.random() - 0.5) * 0.6; px += Math.cos(a) * 9; py += Math.sin(a) * 9; x.lineTo(px, py); }
        x.stroke();
      }
      noise(x, w, h, 6);
      for (let i = 0; i < 160; i++) { x.fillStyle = `rgba(255,255,255,${0.25 + Math.random() * 0.35})`; x.beginPath(); x.arc(Math.random() * w, Math.random() * h, 0.8 + Math.random() * 1.6, 0, 6.3); x.fill(); }
    },
  },
  dino: {
    // Caramel dig-site sand with the string grid of a real dig: ivory bones and pastel
    // eggs read clearly on it.
    label: 'Dino Dig', sky: 0xcdeeff, hemiSky: 0xf2fbff, hemiGround: 0xd8b98a, surround: 0x8fcf6a, wall: 0xb07a4a, accent: '#ff9a3a',
    tile: 4, floor: (x, w, h) => {
      x.fillStyle = '#d9b47c'; x.fillRect(0, 0, w, h);
      noise(x, w, h, 16);
      for (let i = 0; i < 70; i++) { x.fillStyle = `rgba(${150 + Math.random() * 40},${110 + Math.random() * 30},70,.35)`; const r = 1 + Math.random() * 3; x.beginPath(); x.arc(Math.random() * w, Math.random() * h, r, 0, 6.3); x.fill(); }
      for (let i = 0; i < 4; i++) { x.strokeStyle = 'rgba(255,240,215,.22)'; x.lineWidth = 2; x.beginPath(); for (let k = 0; k <= w; k += 8) x.lineTo(k, i * h / 4 + 30 + Math.sin(k * 0.04 + i * 2) * 5); x.stroke(); }
      // the dig grid: white string with pegs at the crossings
      x.strokeStyle = 'rgba(255,255,255,.6)'; x.lineWidth = 1.5;
      x.beginPath(); x.moveTo(1, 0); x.lineTo(1, h); x.moveTo(0, 1); x.lineTo(w, 1); x.stroke();
      x.fillStyle = '#ff6f5a'; x.fillRect(0, 0, 4, 4);
    },
  },
  castle: {
    // Pale periwinkle courtyard flagstones with white grout: saturated gems pop on it.
    label: 'Fairy Castle', sky: 0xe6dcff, hemiSky: 0xfaf6ff, hemiGround: 0xc9c4ea, surround: 0x9fdc8f, wall: 0xffffff, accent: '#b58cff',
    tile: 3, floor: (x, w, h) => {
      x.fillStyle = '#f4f2ff'; x.fillRect(0, 0, w, h);
      const n = 3, s = w / n, pal = ['#d6dcf2', '#d0d4ee', '#dce0f5', '#d3d8f0', '#dad6f2'];
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        x.fillStyle = pal[(i * 2 + j * 3) % pal.length];
        const l = i * s + 4, t = j * s + 4, ww = s - 8, hh = s - 8, r = 12;
        x.beginPath(); x.moveTo(l + r, t); x.arcTo(l + ww, t, l + ww, t + hh, r); x.arcTo(l + ww, t + hh, l, t + hh, r); x.arcTo(l, t + hh, l, t, r); x.arcTo(l, t, l + ww, t, r); x.closePath(); x.fill();
      }
      noise(x, w, h, 5);
      const sp = ['#ffffff', '#fff2a8', '#ffd6ec'];
      for (let i = 0; i < 18; i++) { x.fillStyle = sp[i % 3]; x.beginPath(); const cx = Math.random() * w, cy = Math.random() * h; for (let k = 0; k <= 8; k++) { const a = k * Math.PI / 4, rr = k % 2 ? 1.2 : 3.4; x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } x.fill(); }
    },
  },
};

// ============================================================== scenery
function PIZZA(K) {}
function DINO(K) {}
function CASTLE(K) {}

export const BACKDROPS = { pizza: PIZZA, dino: DINO, castle: CASTLE };
export const MUSIC = { pizza: 'east_town', dino: 'spirits_forest', castle: 'holy_sanctuary' };
