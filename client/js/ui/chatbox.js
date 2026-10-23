// Caixa de chat: um balão pequeno e translúcido logo abaixo do cartão do jogador (vida/mana) que só mostra as últimas linhas.
// Ao clicar nele (ou apertar Enter) abre no tamanho normal, com barra de título para arrastar, canto para redimensionar e o
// campo de digitar; ao sair do campo (enviar, Esc ou clicar no jogo) volta a ser o balão. Posição e tamanho do chat aberto ficam
// salvos no navegador (um conjunto para telas de toque e outro para o computador).
import { h } from './dom.js';
import { isTouchDevice, prefs } from '../device.js';

const MIN_W = 200, MIN_H = 90;
const ABOVE = ['hud-player', 'hud-statuses', 'hud-party']; // o balão fica abaixo destes cartões

export function chatBox(log, input) {
  const key = isTouchDevice() ? 'chat_touch' : 'chat';
  let st = {}; // x, y (canto de cima à esquerda), w, h; o que faltar vem do CSS
  try { const j = JSON.parse(prefs.get(key, '')); if (j && typeof j === 'object') st = { x: j.x, y: j.y, w: j.w, h: j.h }; } catch { /* sem posição salva */ }
  const save = () => prefs.set(key, JSON.stringify(st));

  const reset = h('button', { title: 'Voltar ao lugar e ao tamanho originais' }, '↺');
  const head = h('div', { id: 'chat-head', title: 'Arraste para mover o chat' }, h('span', { class: 'ch-title' }, '💬 Chat'), reset);
  const grip = h('div', { id: 'chat-grip', title: 'Arraste para mudar o tamanho' });
  // tabindex -1: clicar no histórico mantém o foco dentro da caixa (e ela aberta)
  const box = h('div', { id: 'chat', class: 'frame', tabindex: '-1' }, head, log, h('div', { id: 'chat-bar' }, input, grip));

  let open = false;
  const num = (v) => typeof v === 'number' && Number.isFinite(v);

  // sem posição salva o balão acompanha o fim dos cartões do jogador (buffs e grupo aparecem e somem)
  function homeTop() {
    let bottom = 0;
    for (const id of ABOVE) {
      const el = document.getElementById(id);
      if (!el || el.style.display === 'none') continue;
      const r = el.getBoundingClientRect();
      if (r.height > 0) bottom = Math.max(bottom, r.bottom);
    }
    return (bottom || 100) + 6;
  }

  function apply() {
    // tamanho: só o chat aberto usa o tamanho salvo; o balão tem o dele no CSS
    if (open && num(st.w)) st.w = Math.max(MIN_W, Math.min(st.w, window.innerWidth - 8));
    if (open && num(st.h)) st.h = Math.max(MIN_H, Math.min(st.h, window.innerHeight - 8));
    box.style.width = open && num(st.w) ? st.w + 'px' : '';
    box.style.height = open && num(st.h) ? st.h + 'px' : '';
    box.style.bottom = 'auto';
    if (num(st.x) && num(st.y)) {
      // a caixa inteira fica na tela
      const bw = box.offsetWidth || MIN_W, bh = box.offsetHeight || 40;
      st.x = Math.max(0, Math.min(st.x, window.innerWidth - bw));
      st.y = Math.max(0, Math.min(st.y, window.innerHeight - bh));
      box.style.left = st.x + 'px';
      box.style.top = st.y + 'px';
    } else {
      box.style.left = '';
      box.style.top = homeTop() + 'px';
    }
  }
  // passa a posicionar pelo canto de cima, mantendo onde a caixa está agora
  function pin() {
    if (num(st.x) && num(st.y)) return;
    const r = box.getBoundingClientRect();
    st.x = r.left; st.y = r.top;
  }

  function setOpen(on) {
    if (on === open) return;
    open = on;
    box.classList.toggle('open', on);
    apply();
    log.scrollTop = log.scrollHeight;
    if (on) save(); // abrir pode ter empurrado a caixa para dentro da tela
  }

  box.addEventListener('click', () => { if (!open) { setOpen(true); input.focus(); } });
  input.addEventListener('focus', () => setOpen(true));
  box.addEventListener('focusout', (e) => {
    if (drag || size) return;
    if (e.relatedTarget && box.contains(e.relatedTarget)) return;
    setOpen(false);
  });

  // arrastar pela barra
  let drag = null;
  head.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    pin();
    drag = { dx: e.clientX - st.x, dy: e.clientY - st.y };
    head.setPointerCapture(e.pointerId);
    head.classList.add('grab');
    e.preventDefault();
  });
  head.addEventListener('pointermove', (e) => { if (drag) { st.x = e.clientX - drag.dx; st.y = e.clientY - drag.dy; apply(); } });
  const endDrag = () => { if (drag) { drag = null; head.classList.remove('grab'); save(); } };
  head.addEventListener('pointerup', endDrag);
  head.addEventListener('pointercancel', endDrag);

  // redimensionar pelo canto de baixo à direita
  let size = null;
  grip.addEventListener('pointerdown', (e) => {
    pin();
    const r = box.getBoundingClientRect();
    size = { x: e.clientX, y: e.clientY, w: r.width, h: r.height };
    grip.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  grip.addEventListener('pointermove', (e) => {
    if (!size) return;
    st.w = Math.min(size.w + e.clientX - size.x, window.innerWidth - st.x - 4);
    st.h = Math.min(size.h + e.clientY - size.y, window.innerHeight - st.y - 4);
    apply();
  });
  const endSize = () => { if (size) { size = null; save(); } };
  grip.addEventListener('pointerup', endSize);
  grip.addEventListener('pointercancel', endSize);

  const home = () => { st = {}; apply(); save(); };
  reset.addEventListener('click', home);
  head.addEventListener('dblclick', (e) => { if (!e.target.closest('button')) home(); });
  window.addEventListener('resize', apply);
  setInterval(() => { if (!(num(st.x) && num(st.y))) box.style.top = homeTop() + 'px'; }, 500);

  apply();
  return box;
}
