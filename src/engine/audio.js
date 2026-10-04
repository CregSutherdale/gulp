// All sound effects are synthesized here (WebAudio DSP, no samples). Eating is
// musical: each swallow in a streak plays the next note of a pentatonic scale, so a
// good run literally plays a little tune. Music: two licensed HydroGene tracks.
import musicPlayUrl from '../../assets/music_play.m4a';
import musicCalmUrl from '../../assets/music_calm.m4a';

const SCALE = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51, 1567.98, 1760.0, 2093.0];

export class Audio {
  constructor() {
    this.ctx = null; this.sfxOn = true; this.musicOn = true; this.buffers = {}; this.track = null; this.want = null;
    this.lastBonk = 0;
  }
  // Must be called from a user gesture (iOS).
  unlock() {
    if (!this.ctx) {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return;
      this.ctx = new C();
      const c = this.ctx;
      this.comp = c.createDynamicsCompressor();
      this.comp.threshold.value = -14; this.comp.knee.value = 10; this.comp.ratio.value = 4;
      this.comp.attack.value = 0.003; this.comp.release.value = 0.15;
      this.master = c.createGain(); this.master.gain.value = 0.9;
      this.sfx = c.createGain(); this.sfx.gain.value = this.sfxOn ? 0.75 : 0;
      this.music = c.createGain(); this.music.gain.value = this.musicOn ? 1 : 0;
      this.sfx.connect(this.comp); this.comp.connect(this.master);
      this.music.connect(this.master); this.master.connect(c.destination);
      // A tiny noise buffer shared by every noisy sound.
      const n = c.createBuffer(1, c.sampleRate * 0.5, c.sampleRate), d = n.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = n;
      this.load('play', musicPlayUrl); this.load('calm', musicCalmUrl);
    }
    if (this.ctx.state !== 'running') this.ctx.resume();
  }
  async load(name, url) {
    try {
      let ab;
      if (url.startsWith('data:')) {
        // Decode inline audio ourselves: some sandboxed pages block fetch() of data: URLs.
        const bin = atob(url.slice(url.indexOf(',') + 1));
        const u8 = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
        ab = u8.buffer;
      } else ab = await (await fetch(url)).arrayBuffer();
      this.buffers[name] = await this.ctx.decodeAudioData(ab);
      if (this.want === name) this.playMusic(name, true);
    } catch (e) { console.warn('music load failed', name, e); }
  }
  setSfx(on) { this.sfxOn = on; if (this.sfx) this.sfx.gain.value = on ? 0.75 : 0; }
  setMusic(on) { this.musicOn = on; if (this.music) this.music.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.1); }

  playMusic(name, force = false) {
    this.want = name;
    if (!this.ctx || !this.buffers[name]) return;
    if (this.track && this.track.name === name && !force) return;
    const c = this.ctx, now = c.currentTime;
    if (this.track) { const old = this.track; old.g.gain.setTargetAtTime(0, now, 0.25); setTimeout(() => { try { old.src.stop(); } catch (e) { /* already stopped */ } }, 1500); }
    const src = c.createBufferSource(); src.buffer = this.buffers[name]; src.loop = true;
    const g = c.createGain(); g.gain.value = 0;
    // Play track (~-14 LUFS) sits lower than the calm one (~-17) so SFX stay on top.
    g.gain.setTargetAtTime(name === 'play' ? 0.3 : 0.42, now, 0.4);
    src.connect(g); g.connect(this.music); src.start();
    this.track = { name, src, g };
  }
  stopMusic() {
    this.want = null;
    if (!this.track) return;
    const t = this.track; this.track = null;
    t.g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2);
    setTimeout(() => { try { t.src.stop(); } catch (e) { /* already stopped */ } }, 1200);
  }

  // ---- building blocks
  tone(freq, { type = 'sine', at = 0, dur = 0.18, vol = 0.3, attack = 0.004, glide = 0, glideT = 0.05, out = this.sfx } = {}) {
    const c = this.ctx; if (!c || !this.sfxOn) return;
    const t = c.currentTime + at;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq * (glide || 1), t);
    if (glide) o.frequency.exponentialRampToValueAtTime(freq, t + glideT);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g); g.connect(out);
    o.start(t); o.stop(t + dur + 0.05);
  }
  noise({ at = 0, dur = 0.06, vol = 0.15, freq = 1200, q = 1.2, type = 'bandpass' } = {}) {
    const c = this.ctx; if (!c || !this.sfxOn) return;
    const t = c.currentTime + at;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    s.connect(f); f.connect(g); g.connect(this.sfx);
    s.start(t, Math.random() * 0.3); s.stop(t + dur + 0.02);
  }

  // ---- game sounds
  pop(value, combo) {
    const i = Math.min(SCALE.length - 1, Math.max(0, combo - 1));
    let f = SCALE[i];
    if (value >= 25) f /= 4; else if (value >= 6) f /= 2;
    this.tone(f, { type: 'sine', dur: 0.2, vol: 0.28, glide: 1.5, glideT: 0.045 });
    this.tone(f * 2, { type: 'triangle', dur: 0.09, vol: 0.06 });
    this.noise({ dur: 0.035, vol: 0.06, freq: 900 + Math.random() * 500 });
    if (value >= 15) this.gulp(value);
  }
  gulp(value) {
    const k = Math.min(1, value / 120);
    this.tone(140 - k * 50, { type: 'sine', dur: 0.32 + k * 0.2, vol: 0.32, glide: 1.9, glideT: 0.22 });
    this.noise({ dur: 0.35, vol: 0.08, freq: 500, q: 0.6, type: 'lowpass' });
  }
  sizeUp() {
    [0, 2, 4, 5].forEach((n, j) => this.tone(SCALE[n] * 1, { type: 'triangle', at: j * 0.065, dur: 0.32, vol: 0.16 }));
    this.tone(SCALE[7], { type: 'sine', at: 0.26, dur: 0.6, vol: 0.12 });
  }
  target(progress) {
    const f = 1046.5 * Math.pow(2, Math.min(1, progress) * 7 / 12);
    this.tone(f, { type: 'sine', dur: 0.7, vol: 0.18 });
    this.tone(f * 2.76, { type: 'sine', dur: 0.35, vol: 0.05 });
  }
  bonk() {
    const c = this.ctx; if (!c) return;
    if (c.currentTime - this.lastBonk < 0.45) return;
    this.lastBonk = c.currentTime;
    this.tone(120, { type: 'sine', dur: 0.12, vol: 0.14, glide: 1.4, glideT: 0.05 });
  }
  tick(urgent) { this.noise({ dur: 0.03, vol: urgent ? 0.14 : 0.08, freq: urgent ? 2600 : 1900, q: 6 }); }
  tap() { this.tone(880, { type: 'sine', dur: 0.06, vol: 0.12, glide: 1.3, glideT: 0.02 }); }
  star(i) { this.tone(SCALE[4 + i * 2], { type: 'triangle', dur: 0.5, vol: 0.2 }); this.tone(SCALE[4 + i * 2] * 2, { type: 'sine', dur: 0.4, vol: 0.06, at: 0.02 }); }
  win() {
    const seq = [0, 2, 4, 5, 7];
    seq.forEach((n, j) => this.tone(SCALE[n], { type: 'triangle', at: j * 0.09, dur: 0.4, vol: 0.17 }));
    [0, 2, 4].forEach((n) => this.tone(SCALE[n + 5], { type: 'sine', at: 0.5, dur: 1.4, vol: 0.09 }));
    for (let k = 0; k < 8; k++) this.tone(2000 + Math.random() * 2000, { type: 'sine', at: 0.55 + k * 0.07, dur: 0.15, vol: 0.03 });
  }
  timeUp() { [7, 4, 2, 0].forEach((n, j) => this.tone(SCALE[n] / 2, { type: 'triangle', at: j * 0.12, dur: 0.35, vol: 0.14 })); }
  swallowedHole() { this.tone(90, { type: 'sine', dur: 0.6, vol: 0.35, glide: 2.4, glideT: 0.4 }); this.noise({ dur: 0.5, vol: 0.1, freq: 400, type: 'lowpass' }); }
}
