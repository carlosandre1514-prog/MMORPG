// Efeitos sonoros sintetizados e música ambiente procedural (sem arquivos de áudio).
class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.sfxGain = null;
    this.musicGain = null;
    this.enabled = load('sfx', true);
    this.musicOn = load('music', true);
    this.theme = null;
    this.musicTimer = null;
    this.last = {};
  }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.6;
    this.master.connect(this.ctx.destination);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = this.enabled ? 0.5 : 0;
    this.sfxGain.connect(this.master);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = this.musicOn ? 0.16 : 0;
    this.musicGain.connect(this.master);
    const len = this.ctx.sampleRate;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    if (this.theme) this.startMusic(this.theme);
  }

  setSfx(on) { this.enabled = on; save('sfx', on); if (this.sfxGain) this.sfxGain.gain.value = on ? 0.5 : 0; }
  setMusic(on) { this.musicOn = on; save('music', on); if (this.musicGain) this.musicGain.gain.value = on ? 0.16 : 0; }

  tone(freq, dur, { type = 'sine', vol = 0.3, attack = 0.005, slide = 0, delay = 0, dest } = {}) {
    const c = this.ctx;
    const t0 = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(dest || this.sfxGain);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }

  noiseBurst(dur, { freq = 1200, q = 1, vol = 0.3, type = 'bandpass', slide = 0, delay = 0 } = {}) {
    const c = this.ctx;
    const t0 = c.currentTime + delay;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    const f = c.createBiquadFilter();
    f.type = type; f.frequency.setValueAtTime(freq, t0); f.Q.value = q;
    if (slide) f.frequency.exponentialRampToValueAtTime(freq * slide, t0 + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(this.sfxGain);
    src.start(t0, Math.random() * 0.5); src.stop(t0 + dur + 0.05);
  }

  play(name, vol = 1) {
    if (!this.ctx || !this.enabled) return;
    const now = performance.now();
    if (this.last[name] && now - this.last[name] < 40) return; // evita empilhar o mesmo som
    this.last[name] = now;
    const v = (x) => x * vol;
    switch (name) {
      case 'hit': this.noiseBurst(0.12, { freq: 900, q: 0.8, vol: v(0.35) }); this.tone(110, 0.1, { type: 'square', vol: v(0.12), slide: 0.5 }); break;
      case 'crit': this.noiseBurst(0.2, { freq: 1500, q: 0.6, vol: v(0.45) }); this.tone(220, 0.18, { type: 'sawtooth', vol: v(0.15), slide: 0.4 }); break;
      case 'swing': this.noiseBurst(0.15, { freq: 2500, q: 2, vol: v(0.18), slide: 0.3 }); break;
      case 'arrow': this.noiseBurst(0.1, { freq: 4000, q: 4, vol: v(0.15), slide: 0.5 }); this.tone(900, 0.06, { type: 'triangle', vol: v(0.06), slide: 0.6 }); break;
      case 'fire': this.noiseBurst(0.35, { freq: 600, q: 0.5, vol: v(0.3), type: 'lowpass', slide: 3 }); break;
      case 'frost': this.tone(1200, 0.25, { type: 'triangle', vol: v(0.12), slide: 1.6 }); this.noiseBurst(0.2, { freq: 6000, q: 3, vol: v(0.08) }); break;
      case 'magic': this.tone(440, 0.25, { type: 'sine', vol: v(0.15), slide: 2 }); this.tone(660, 0.2, { type: 'sine', vol: v(0.08), slide: 1.5, delay: 0.05 }); break;
      case 'holy': [523, 659, 784].forEach((f, i) => this.tone(f, 0.35, { type: 'sine', vol: v(0.09), delay: i * 0.04 })); break;
      case 'heal': [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.4, { type: 'sine', vol: v(0.08), delay: i * 0.06 })); break;
      case 'explosion': this.noiseBurst(0.6, { freq: 300, q: 0.4, vol: v(0.5), type: 'lowpass', slide: 0.3 }); this.tone(60, 0.5, { type: 'sine', vol: v(0.3), slide: 0.5 }); break;
      case 'stomp': this.tone(50, 0.5, { type: 'sine', vol: v(0.5), slide: 0.6 }); this.noiseBurst(0.4, { freq: 200, q: 0.5, vol: v(0.4), type: 'lowpass' }); break;
      case 'warn': this.tone(300, 0.15, { type: 'square', vol: v(0.06) }); break;
      case 'buff': this.tone(330, 0.4, { type: 'triangle', vol: v(0.1), slide: 2 }); break;
      case 'levelup': [392, 523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.5, { type: 'triangle', vol: v(0.12), delay: i * 0.09 })); break;
      case 'quest': [523, 659, 784].forEach((f, i) => this.tone(f, 0.6, { type: 'sine', vol: v(0.12), delay: i * 0.12 })); this.tone(1046, 0.8, { type: 'sine', vol: v(0.1), delay: 0.36 }); break;
      case 'pickup': this.tone(880, 0.08, { type: 'square', vol: v(0.06) }); this.tone(1320, 0.1, { type: 'square', vol: v(0.05), delay: 0.06 }); break;
      case 'coin': this.tone(1500, 0.08, { type: 'square', vol: v(0.05) }); this.tone(2000, 0.15, { type: 'square', vol: v(0.05), delay: 0.07 }); break;
      case 'click': this.tone(600, 0.04, { type: 'square', vol: v(0.04) }); break;
      case 'error': this.tone(180, 0.15, { type: 'sawtooth', vol: v(0.06) }); break;
      case 'death': [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.5, { type: 'triangle', vol: v(0.12), delay: i * 0.18 })); break;
      case 'monsterdie': this.tone(300, 0.3, { type: 'sawtooth', vol: v(0.07), slide: 0.3 }); break;
      case 'aggro': this.tone(200, 0.12, { type: 'sawtooth', vol: v(0.05), slide: 1.5 }); break;
      case 'portal': this.tone(220, 0.8, { type: 'sine', vol: v(0.15), slide: 4 }); this.tone(330, 0.8, { type: 'sine', vol: v(0.1), slide: 3 }); break;
      case 'enhance_ok': [660, 880, 1320].forEach((f, i) => this.tone(f, 0.3, { type: 'triangle', vol: v(0.12), delay: i * 0.08 })); break;
      case 'enhance_fail': this.noiseBurst(0.3, { freq: 2000, q: 1, vol: v(0.3) }); this.tone(200, 0.4, { type: 'sawtooth', vol: v(0.1), slide: 0.5 }); break;
      case 'whisper': this.tone(1200, 0.1, { type: 'sine', vol: v(0.06) }); break;
      default: break;
    }
  }

  // ---------------------------------------------------------------- música
  startMusic(theme) {
    this.theme = theme;
    if (!this.ctx) return;
    clearInterval(this.musicTimer);
    const THEMES = {
      town: { root: 261.63, scale: [0, 2, 4, 7, 9], prog: [0, 5, 3, 4], tempo: 2.6, wave: 'triangle' },
      fields: { root: 293.66, scale: [0, 2, 4, 7, 9], prog: [0, 3, 4, 0], tempo: 2.4, wave: 'triangle' },
      forest: { root: 220, scale: [0, 2, 3, 7, 8], prog: [0, 5, 3, 6], tempo: 3, wave: 'sine' },
      mines: { root: 146.83, scale: [0, 1, 3, 7, 8], prog: [0, 1, 0, 5], tempo: 3.4, wave: 'sine' },
      ruins: { root: 174.61, scale: [0, 1, 3, 6, 7], prog: [0, 6, 5, 1], tempo: 3.2, wave: 'sawtooth' },
      arena: { root: 196, scale: [0, 3, 5, 7, 10], prog: [0, 3, 5, 3], tempo: 1.8, wave: 'square' },
    };
    const th = THEMES[theme] || THEMES.town;
    let bar = 0;
    const playBar = () => {
      if (!this.musicOn) return;
      const c = this.ctx;
      const chordRoot = th.root * Math.pow(2, [0, 2, 3, 5, 7, 8, 10][th.prog[bar % th.prog.length] % 7] / 12) / 2;
      // pad
      for (const iv of [0, 7, 12]) {
        const o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
        o.type = th.wave; o.frequency.value = chordRoot * Math.pow(2, iv / 12);
        f.type = 'lowpass'; f.frequency.value = 900;
        const t0 = c.currentTime;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.linearRampToValueAtTime(0.05, t0 + th.tempo * 0.4);
        g.gain.linearRampToValueAtTime(0.0001, t0 + th.tempo * 1.05);
        o.connect(f); f.connect(g); g.connect(this.musicGain);
        o.start(t0); o.stop(t0 + th.tempo * 1.1);
      }
      // melodia esparsa
      const notes = 4;
      for (let i = 0; i < notes; i++) {
        if (Math.random() < 0.45) continue;
        const deg = th.scale[Math.floor(Math.random() * th.scale.length)];
        const oct = Math.random() < 0.3 ? 2 : 1;
        this.tone(th.root * Math.pow(2, deg / 12) * oct, th.tempo / notes * 1.6, { type: 'sine', vol: 0.06, attack: 0.02, delay: (i * th.tempo) / notes, dest: this.musicGain });
      }
      bar++;
    };
    playBar();
    this.musicTimer = setInterval(playBar, th.tempo * 1000);
  }
}

function load(k, def) {
  try { const v = localStorage.getItem('aethra_' + k); return v == null ? def : v === '1'; } catch { return def; }
}
function save(k, v) {
  try { localStorage.setItem('aethra_' + k, v ? '1' : '0'); } catch { /* ignorado */ }
}

export const audio = new AudioEngine();
