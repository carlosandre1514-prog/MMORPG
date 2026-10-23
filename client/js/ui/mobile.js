// Controles de toque: direcional virtual flutuante (qualquer ponto da metade esquerda), botões de ação grandes,
// atalhos de menu, chat, missões e câmera. Em telas de toque o corpo da página ganha a classe "touch-ui" e o CSS
// reorganiza o HUD (barra de habilidades vira uma grade de botões no canto direito).
import { h } from './dom.js';
import { touchUiEnabled, prefs } from '../device.js';
import { enterLandscape } from '../orientation.js';

const STICK_R = 58; // raio do direcional em px

export class MobileControls {
  constructor(ui) {
    this.ui = ui;
    this.build();
    this.apply(touchUiEnabled());
  }

  get game() { return this.ui.game; }

  build() {
    const R = this.ui.root;
    // área do direcional: metade esquerda de baixo; o polegar cria a base onde tocar
    this.base = h('div', { class: 'js-base' }, h('div', { class: 'js-knob' }));
    this.zone = h('div', { id: 'stickzone', class: 'mob' }, this.base);
    this.bindStick();
    // botões de ação
    const act = (cls, label, fn, hold) => {
      const b = h('button', { class: 'mob-btn ' + cls }, label);
      const up = () => { b.classList.remove('down'); this.release(b); };
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); b.classList.add('down'); fn(); if (hold) this.hold(b, fn); });
      b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up);
      return b;
    };
    this.btnAttack = act('attack', '⚔', () => this.game?.attackNearest(), true);
    this.btnInteract = act('interact', '💬', () => this.game?.interactNearest());
    this.btnTarget = act('target', '🎯', () => this.game?.cycleTarget());
    this.btnCam = act('cam', '👁', () => this.game?.ui.toast(CAM_LABEL[this.game.renderer.cycleCam()], 'info'));
    R.appendChild(h('div', { id: 'mob-actions', class: 'mob' }, this.btnCam, this.btnTarget, this.btnInteract, this.btnAttack));
    // atalhos do topo: missões, chat, menu, tela cheia
    const top = (icon, cls, fn) => h('button', { class: 'mob-top ' + cls, onclick: fn }, icon);
    this.topBar = h('div', { id: 'mob-top', class: 'mob' },
      top('⛶', 'fs', () => this.fullscreen()),
      top('📜', 'tr', () => this.toggleClass('show-tracker')),
      top('💬', 'ch', () => this.game?.ui.chatInput.focus()),
      top('☰', 'mn', () => this.toggleClass('show-menu')));
    R.append(this.zone, this.topBar);
    // fechar menu ao escolher uma janela
    const mb = R.querySelector('#menubar');
    if (mb) mb.addEventListener('click', () => document.body.classList.remove('show-menu'));
  }

  toggleClass(c) {
    const on = !document.body.classList.contains(c);
    for (const k of ['show-tracker', 'show-menu']) document.body.classList.remove(k);
    if (on) document.body.classList.add(c);
  }

  fullscreen() {
    const el = document.documentElement;
    try {
      if (document.fullscreenElement) document.exitFullscreen();
      else enterLandscape();
    } catch { /* o navegador pode negar */ }
  }

  // botão de ataque: segurar repete (usa a habilidade 1 assim que o alvo aparece)
  hold(b, fn) {
    this.release(b);
    b._hold = setInterval(fn, 450);
  }
  release(b) { if (b._hold) { clearInterval(b._hold); b._hold = null; } }

  // direcional virtual com ponteiros (um dedo por vez; o outro dedo gira a câmera ou toca nos botões)
  bindStick() {
    const z = this.zone;
    let id = null, ox = 0, oy = 0;
    const set = (x, y) => { const st = this.game?.input.stick; if (st) { st.x = x; st.y = y; } };
    const move = (e) => {
      if (e.pointerId !== id) return;
      let dx = e.clientX - ox, dy = e.clientY - oy;
      const len = Math.hypot(dx, dy);
      if (len > STICK_R) { dx = dx / len * STICK_R; dy = dy / len * STICK_R; }
      this.base.firstChild.style.transform = `translate(${dx}px, ${dy}px)`;
      set(dx / STICK_R, dy / STICK_R);
    };
    const end = (e) => {
      if (e.pointerId !== id) return;
      id = null;
      this.base.classList.remove('on');
      this.base.firstChild.style.transform = '';
      set(0, 0);
    };
    z.addEventListener('pointerdown', (e) => {
      if (id !== null) return;
      id = e.pointerId; ox = e.clientX; oy = e.clientY;
      try { z.setPointerCapture(id); } catch { /* ponteiro sintético (testes) */ }
      this.base.style.left = ox + 'px'; this.base.style.top = oy + 'px';
      this.base.classList.add('on');
      e.preventDefault();
    });
    z.addEventListener('pointermove', move);
    z.addEventListener('pointerup', end);
    z.addEventListener('pointercancel', end);
  }

  apply(on) {
    document.body.classList.toggle('touch-ui', !!on);
    if (!on) for (const k of ['show-tracker', 'show-menu']) document.body.classList.remove(k);
    const st = this.game?.input.stick;
    if (st) { st.x = 0; st.y = 0; }
  }

  set(mode) {
    prefs.set('touchui', mode);
    this.apply(touchUiEnabled());
  }
}

const CAM_LABEL = { far: 'Câmera: 3ª pessoa (longe)', near: 'Câmera: 3ª pessoa (perto)', first: 'Câmera: 1ª pessoa' };
