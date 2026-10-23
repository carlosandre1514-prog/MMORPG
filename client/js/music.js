// Música tema do jogo: toca assets/music/theme.(mp3|ogg|m4a|wav) em repetição infinita nas telas de menu e durante o jogo, e some
// (com saída suave) enquanto o jogador está em combate, voltando alguns segundos depois que a luta acaba. Sem arquivo na pasta, nada
// acontece: o botão de som nem aparece e a música ambiente gerada por código (audio.js) continua como antes. Com a faixa disponível
// ela substitui essa música ambiente.
// Repetição: dois elementos de áudio se revezam; nos últimos segundos da faixa o próximo entra do começo e os dois se misturam
// (curva de potência igual), então não há silêncio nem "pulo" entre uma volta e outra.
// Os navegadores só liberam áudio depois de um toque ou tecla: a música começa no primeiro gesto do jogador.
import { audio } from './audio.js';

const FILES = ['theme.mp3', 'theme.ogg', 'theme.m4a', 'theme.wav'];
const MAX = 0.55;          // volume máximo da música
const XF = 5;              // s: mistura entre o fim de uma volta e o começo da próxima
const UP = 2200;           // ms: entrada suave (menu, fim de combate)
const DOWN = 1400;         // ms: saída suave (desligar, trocar de tela)
const DOWN_COMBAT = 900;   // ms: saída ao entrar em combate
const BACK_DELAY = 2500;   // ms depois do fim do combate até a música voltar

export const themeMusic = {
  els: [], cur: 0, nxt: null, ok: false, btn: null, screen: null, unlocked: false, tried: 0, timer: 0,
  level: 0, combat: false, holdUntil: 0, last: 0,

  // a opção "Música" (Opções) e o botão de som das telas de menu controlam a mesma preferência de audio.js
  get muted() { return !audio.musicOn; },

  init() {
    if (this.els.length || typeof Audio === 'undefined') return;
    const make = (file) => {
      const a = new Audio('/music/' + file);
      a.preload = 'auto';
      a.volume = 0;
      return a;
    };
    const load = () => {
      const a = make(FILES[this.tried]);
      this.els = [a];
      a.addEventListener('canplaythrough', () => {
        if (this.els[0] !== a || this.ok) return;
        this.els.push(make(FILES[this.tried])); // segundo elemento para a mistura da repetição (vem do cache do navegador)
        this.ok = true;
        audio.ambientOff = true; // a faixa substitui a música ambiente gerada por código
        this.makeButton();
        this.start();
        this.sync();
      }, { once: true });
      a.addEventListener('error', () => { if (this.els[0] === a && !this.ok && ++this.tried < FILES.length) load(); }); // 404: tenta o próximo formato
      a.load();
    };
    load();
    const unlock = () => {
      this.unlocked = true;
      for (const ev of ['pointerdown', 'keydown', 'touchstart']) window.removeEventListener(ev, unlock, true);
      // iOS: cada elemento precisa começar a tocar dentro de um gesto; o segundo é "aquecido" aqui
      const b = this.els[1];
      if (b) b.play().then(() => { b.pause(); b.currentTime = 0; }).catch(() => {});
      this.sync();
    };
    for (const ev of ['pointerdown', 'keydown', 'touchstart']) window.addEventListener(ev, unlock, true);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { this.level = 0; this.pauseAll(); } else this.sync();
    });
  },

  makeButton() {
    const b = document.createElement('button');
    b.id = 'music-btn';
    b.type = 'button';
    b.addEventListener('click', () => { audio.setMusic(!audio.musicOn); this.unlocked = true; this.sync(); });
    document.body.appendChild(b);
    this.btn = b;
  },

  // telas: 'menu' (login, personagens) ou 'game' (dentro do mundo)
  setScreen(name) {
    this.screen = name;
    this.sync();
  },

  // chamada a cada quadro do jogo com a bandeira de combate do jogador
  setCombat(on) {
    if (on) this.holdUntil = performance.now() + BACK_DELAY;
    this.combat = on;
  },

  start() {
    if (this.timer) return;
    this.last = performance.now();
    this.timer = setInterval(() => this.tick(), 80);
  },

  sync() {
    if (this.btn) {
      this.btn.style.display = this.ok && this.screen === 'menu' ? 'flex' : 'none';
      this.btn.textContent = this.muted ? '🔇' : '🔊';
      this.btn.title = this.muted ? 'Ligar a música' : 'Desligar a música';
    }
    if (this.ok) this.start();
  },

  pauseAll() { for (const e of this.els) e.pause(); this.nxt = null; },

  tick() {
    const now = performance.now(), dt = Math.min(250, now - this.last); // travadas (carregar zona) não pulam a rampa de volume
    this.last = now;
    const cur = this.els[this.cur];
    if (!cur) return;
    const inCombat = this.combat || now < this.holdUntil;
    const want = !!this.screen && !this.muted && this.unlocked && !document.hidden && !inCombat;
    // rampa do volume geral
    if (want) this.level = Math.min(1, this.level + dt / UP);
    else this.level = Math.max(0, this.level - dt / (this.combat ? DOWN_COMBAT : DOWN));
    if (!want && this.level <= 0) { if (!cur.paused || (this.nxt && !this.nxt.paused)) this.pauseAll(); return; }
    if (want && cur.paused) cur.play().catch(() => { this.unlocked = false; }); // ainda sem gesto: espera o próximo toque
    // repetição: perto do fim a outra volta entra do começo; quando a atual acaba, os papéis se invertem
    const dur = cur.duration;
    if (Number.isFinite(dur) && dur > XF * 2) {
      if (!this.nxt && cur.currentTime >= dur - XF && !cur.paused) {
        const nx = this.els[1 - this.cur];
        nx.currentTime = 0;
        nx._in = true;
        nx.play().catch(() => {});
        this.nxt = nx;
      }
      if (this.nxt && (cur.ended || cur.currentTime >= dur - 0.06)) {
        cur.pause(); cur.currentTime = 0;
        this.cur = 1 - this.cur;
        this.nxt = null;
      }
    }
    for (const e of this.els) {
      const p = e.currentTime, d = e.duration;
      const fin = e._in && p < XF ? Math.sin((p / XF) * Math.PI / 2) : 1;
      const fout = Number.isFinite(d) && p > d - XF ? Math.cos(Math.min(1, (p - (d - XF)) / XF) * Math.PI / 2) : 1;
      e.volume = Math.max(0, Math.min(1, MAX * this.level * fin * fout));
    }
  },
};
