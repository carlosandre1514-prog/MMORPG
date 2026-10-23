// Peças visuais da tela de login: cartão dourado com cantos, abas, campos com ícone, botão de entrada, avisos e o botão de
// configurações. Só desenho; quem decide o que acontece é main.js. Estilos em style.css (prefixo lg-).
import { h } from './dom.js';
import { audio } from '../audio.js';
import { themeMusic } from '../music.js';
import { PRESET_ORDER, PRESET_NAMES, gfxState, setGfxPreset } from '../device.js';
import { GAME_VERSION } from '/shared/constants.js';
import { FIREBASE_CONFIG } from '/shared/firebase.js';
import { logoMark } from './logo.js';
import { ico } from './icons.js';

// Ícones próprios (24x24, preenchidos com a cor do texto); o "G" do Google segue as cores oficiais da marca
const ICONS = {
  user: '<circle cx="12" cy="8" r="4.2"/><path d="M3.8 21a8.2 8.2 0 0 1 16.4 0z"/>',
  userPlus: '<circle cx="9.5" cy="8" r="4"/><path d="M1.5 21a8 8 0 0 1 16 0z"/><path d="M19 5.5v6M16 8.5h6" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>',
  mail: '<path d="M3 5.5h18a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1zm1.3 2 7.7 5.6 7.7-5.6z"/>',
  lock: '<path d="M6 10V8a6 6 0 0 1 12 0v2h1a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V11a1 1 0 0 1 1-1zm2.2 0h7.6V8a3.8 3.8 0 0 0-7.6 0z"/>',
  eye: '<path d="M12 5C6.5 5 2.4 8.6 1 12c1.4 3.4 5.5 7 11 7s9.6-3.6 11-7c-1.4-3.4-5.5-7-11-7zm0 11.2a4.2 4.2 0 1 1 0-8.4 4.2 4.2 0 0 1 0 8.4zm0-2.2a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/>',
  eyeOff: '<path d="M12 5C6.5 5 2.4 8.6 1 12c.9 2.1 2.6 4.1 4.8 5.4l-1.9 1.9 1.4 1.4L20.3 5.2l-1.4-1.4-2.3 2.3A11 11 0 0 0 12 5zm0 3.8c.5 0 1 .1 1.4.3l-5.1 5.1A4.2 4.2 0 0 1 12 8.8zM7.8 17.7l1.6-1.6a4.2 4.2 0 0 0 5.7-5.7l2.1-2.1c1.9 1.2 3.4 3 4.2 4.7-1.4 3.4-5.5 7-11 7-.9 0-1.8-.1-2.6-.3z"/>',
  gear: '<path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>',
  crest: '<path d="M12 1.5l2.6 7.900L22.500 12l-7.900 2.600L12 22.500l-2.600-7.900L1.500 12l7.900-2.600z"/><circle cx="12" cy="12" r="2.600" fill="#0a0d16"/>',
  google: '<svg viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.500c3.540 0 6.710 1.220 9.210 3.600l6.850-6.850C35.900 2.380 30.470 0 24 0 14.620 0 6.510 5.380 2.560 13.220l7.980 6.190C12.430 13.720 17.740 9.500 24 9.500z"/><path fill="#4285F4" d="M46.980 24.550c0-1.570-.15-3.090-.38-4.550H24v9.020h12.940c-.58 2.960-2.260 5.480-4.780 7.180l7.730 6c4.510-4.180 7.090-10.360 7.090-17.650z"/><path fill="#FBBC05" d="M10.530 28.590c-.48-1.450-.76-2.990-.76-4.590s.27-3.140.76-4.590l-7.980-6.190C.92 16.460 0 20.120 0 24c0 3.880.92 7.540 2.560 10.780l7.970-6.190z"/><path fill="#34A853" d="M24 48c6.480 0 11.930-2.130 15.890-5.810l-7.730-6c-2.150 1.450-4.920 2.300-8.160 2.300-6.260 0-11.570-4.220-13.470-9.910l-7.980 6.190C6.510 42.620 14.620 48 24 48z"/></svg>',
};

export function icon(name, cls = '') {
  const raw = ICONS[name];
  return h('span', { class: 'lg-ic' + (cls ? ' ' + cls : ''), 'aria-hidden': 'true', html: raw.startsWith('<svg') ? raw : `<svg viewBox="0 0 24 24" fill="currentColor">${raw}</svg>` });
}

// campo de texto com ícone à esquerda e, se quiser, um botão à direita (olho da senha)
export function lgField(iconName, input, trailing) {
  return h('div', { class: 'lg-field' }, icon(iconName), input, trailing || null);
}

// botão do olho: mostra e esconde o texto da senha
export function peekButton(...inputs) {
  const b = h('button', { class: 'lg-peek', type: 'button', 'aria-label': 'Mostrar senha', title: 'Mostrar senha' }, icon('eyeOff'));
  b.addEventListener('click', () => {
    const show = inputs[0].type === 'password';
    for (const i of inputs) i.type = show ? 'text' : 'password';
    b.replaceChildren(icon(show ? 'eye' : 'eyeOff'));
    b.setAttribute('aria-label', show ? 'Esconder senha' : 'Mostrar senha');
    b.title = show ? 'Esconder senha' : 'Mostrar senha';
  });
  return b;
}

// abas Entrar / Criar conta: items = [{ id, icon, label }]
export function lgTabs(items, onPick) {
  const btns = new Map();
  const el = h('div', { class: 'lg-tabs', role: 'tablist' });
  for (const it of items) {
    const b = h('button', { class: 'lg-tab', type: 'button', role: 'tab', 'aria-selected': 'false' }, icon(it.icon), h('span', {}, it.label));
    b.addEventListener('click', () => onPick(it.id));
    btns.set(it.id, b);
    el.appendChild(b);
  }
  return { el, set(id) { for (const [k, b] of btns) b.setAttribute('aria-selected', String(k === id)); } };
}

// botão grande dourado, com as pontas em losango; o texto fica entre setas. Devolve { el, btn, setText }
export function lgSubmit(label) {
  const text = h('span', { class: 'lg-submit-t' }, label);
  const btn = h('button', { class: 'lg-submit', type: 'submit' }, h('span', { class: 'lg-submit-ar' }, '‹'), text, h('span', { class: 'lg-submit-ar' }, '›'));
  return { el: h('div', { class: 'lg-submit-wrap' }, btn), btn, setText(t) { text.textContent = t; } };
}

// aviso de erro (vermelho) ou de sucesso (verde) dentro do cartão
export function lgNotice() {
  const el = h('div', { class: 'lg-notice', role: 'status', 'aria-live': 'polite' });
  return {
    el,
    error(m) { el.className = 'lg-notice show error'; el.textContent = m; },
    ok(m) { el.className = 'lg-notice show success'; el.textContent = m; },
    clear() { el.className = 'lg-notice'; el.textContent = ''; },
    get text() { return el.textContent; },
  };
}

export function lgCheck(label, input) {
  return h('label', { class: 'lg-check' }, input, h('span', { class: 'lg-box', 'aria-hidden': 'true' }, ico('check')), h('span', {}, label));
}

// Cartão dourado com os quatro cantos e o losango da base
export function lgCard(...children) {
  return h('section', { class: 'lg-card', 'aria-label': 'Acesso ao Aethra' },
    h('i', { class: 'lg-corner tl' }), h('i', { class: 'lg-corner tr' }), h('i', { class: 'lg-corner bl' }), h('i', { class: 'lg-corner br' }),
    h('i', { class: 'lg-diamond' }), ...children);
}

// Painel de configurações (engrenagem do canto): sons e perfil gráfico. O perfil só vale ao recarregar, então recarrega na hora.
function settingsPanel() {
  const row = (label, checked, fn) => {
    const cb = h('input', { type: 'checkbox' });
    cb.checked = checked;
    cb.addEventListener('change', () => fn(cb.checked));
    return lgCheck(label, cb);
  };
  const sel = h('select', { class: 'lg-select', 'aria-label': 'Qualidade gráfica' },
    h('option', { value: 'auto' }, 'Automática'), ...PRESET_ORDER.map((p) => h('option', { value: p }, PRESET_NAMES[p])));
  sel.value = gfxState().preset;
  sel.addEventListener('change', () => { setGfxPreset(sel.value); location.reload(); });
  return h('div', { class: 'lg-pop', role: 'dialog', 'aria-label': 'Configurações' },
    h('div', { class: 'lg-pop-t' }, 'Configurações'),
    row('Música', audio.musicOn, (v) => { audio.init(); audio.setMusic(v); themeMusic.sync(); }),
    row('Efeitos sonoros', audio.enabled, (v) => { audio.init(); audio.setSfx(v); }),
    h('label', { class: 'lg-pop-row' }, h('span', {}, 'Qualidade gráfica'), sel),
    h('div', { class: 'lg-pop-note' }, 'Mudar a qualidade recarrega a página. Mais opções ficam dentro do jogo.'),
    h('div', { class: 'lg-pop-note' }, `Login: projeto ${FIREBASE_CONFIG.projectId} · ${location.hostname}`)); // ajuda a conferir se o site publicado tem a versão certa
}

// Tela inteira: selo do servidor (canto esquerdo), engrenagem (direito), logo, o cartão e a versão
export function loginStage(info, card) {
  const online = info && info.online > 0 ? ` · ${info.online} online` : '';
  const pop = settingsPanel();
  pop.style.display = 'none';
  const gear = h('button', { class: 'lg-gear', type: 'button', title: 'Configurações', 'aria-label': 'Configurações' }, icon('gear'));
  gear.addEventListener('click', (e) => { e.stopPropagation(); pop.style.display = pop.style.display === 'none' ? '' : 'none'; });
  document.addEventListener('click', (e) => { if (pop.isConnected && !pop.contains(e.target)) pop.style.display = 'none'; });
  return h('div', { class: 'screen lg-screen' },
    h('div', { class: 'lg-status' }, h('span', { class: 'lg-crest' }, icon('crest')),
      h('div', {}, h('div', { class: 'lg-online' }, 'Servidor Online'), h('div', { class: 'lg-world' }, 'Aethra - Mundo 1' + online))),
    h('div', { class: 'lg-top-right' }, gear, pop),
    h('div', { class: 'lg-main' },
      h('header', { class: 'lg-logo' },
        logoMark('lg'),
        h('div', { class: 'lg-subtitle' }, h('i'), h('span', {}, 'A Chama Partida'), h('i'))),
      card),
    h('div', { class: 'lg-version' }, icon('crest', 'sm'), 'v' + GAME_VERSION));
}
