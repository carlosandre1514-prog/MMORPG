// Música de abertura: toca assets/music/theme.(mp3|ogg|m4a|wav) nas telas de login, personagens e criação, e para ao entrar no jogo
// (no mundo cada zona tem a própria música, gerada por audio.js). Sem arquivo na pasta, nada acontece e o botão de som nem aparece.
// Os navegadores só liberam áudio depois de um toque ou tecla, então a música começa no primeiro gesto do jogador, com entrada suave.
const FILES = ['theme.mp3', 'theme.ogg', 'theme.m4a', 'theme.wav'];
const MAX = 0.55; // volume máximo da música
const FADE = 1800; // ms: entrada e saída da música
const EDGE = 1.5; // s: suavização do começo e do fim da faixa, para a repetição ficar natural

const store = {
  get(k, d) { try { return localStorage.getItem('aethra_' + k) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('aethra_' + k, v); } catch { /* sem armazenamento */ } },
};

export const menuMusic = {
  el: null, btn: null, ok: false, inMenu: false, muted: store.get('music_mute', '0') === '1', unlocked: false, tried: 0, timer: 0, level: 0, goal: 0,

  init() {
    if (this.el || typeof Audio === 'undefined') return;
    const load = () => {
      const a = new Audio('/music/' + FILES[this.tried]);
      a.loop = true;
      a.preload = 'auto';
      a.volume = 0;
      a.addEventListener('canplaythrough', () => { if (this.el === a && !this.ok) { this.ok = true; this.makeButton(); this.sync(); } }, { once: true });
      a.addEventListener('error', () => { if (this.el === a && !this.ok && ++this.tried < FILES.length) load(); }); // 404: tenta o próximo formato
      this.el = a;
      a.load();
    };
    load();
    const unlock = () => {
      this.unlocked = true;
      for (const ev of ['pointerdown', 'keydown', 'touchstart']) window.removeEventListener(ev, unlock, true);
      this.sync();
    };
    for (const ev of ['pointerdown', 'keydown', 'touchstart']) window.addEventListener(ev, unlock, true);
    document.addEventListener('visibilitychange', () => this.sync());
  },

  makeButton() {
    const b = document.createElement('button');
    b.id = 'music-btn';
    b.type = 'button';
    b.addEventListener('click', () => { this.muted = !this.muted; store.set('music_mute', this.muted ? '1' : '0'); this.unlocked = true; this.sync(); });
    document.body.appendChild(b);
    this.btn = b;
  },

  // chamada pelas telas: true nos menus, false dentro do jogo
  setMenu(on) {
    this.inMenu = on;
    this.sync();
  },

  sync() {
    const a = this.el;
    if (this.btn) {
      this.btn.style.display = this.ok && this.inMenu ? 'flex' : 'none';
      this.btn.textContent = this.muted ? '🔇' : '🔊';
      this.btn.title = this.muted ? 'Ligar a música' : 'Desligar a música';
    }
    if (!a || !this.ok) return;
    const want = this.inMenu && !this.muted && this.unlocked && !document.hidden;
    if (want && a.paused) a.play().catch(() => { this.unlocked = false; }); // ainda sem gesto: espera o próximo toque
    this.goal = want ? 1 : 0;
    if (!this.timer) this.timer = setInterval(() => this.tick(), 80);
  },

  // volume = máximo × rampa de entrada/saída × suavização das pontas da faixa (a repetição não "pula")
  tick() {
    const a = this.el, step = 80 / FADE;
    this.level += Math.sign(this.goal - this.level) * Math.min(Math.abs(this.goal - this.level), step);
    const dur = Number.isFinite(a.duration) ? a.duration : 0;
    const env = dur ? Math.min(1, a.currentTime / EDGE, (dur - a.currentTime) / EDGE) : 1;
    a.volume = Math.max(0, Math.min(1, MAX * this.level * Math.max(0, env)));
    if (this.level <= 0 && this.goal === 0) { a.pause(); clearInterval(this.timer); this.timer = 0; }
  },
};
