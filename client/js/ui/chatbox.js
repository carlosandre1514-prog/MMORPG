// Caixa de chat móvel: arraste pela barra de título (mouse ou dedo), redimensione pelo canto e recolha para ficar só a barra.
// Posição, tamanho e estado ficam salvos no navegador (um conjunto para telas de toque e outro para o computador).
import { h } from './dom.js';
import { isTouchDevice, prefs } from '../device.js';

const MIN_W = 200, MIN_H = 90;

export function chatBox(log, input) {
  const key = isTouchDevice() ? 'chat_touch' : 'chat';
  let st = {}; // x, y (canto de cima à esquerda), w, h, min; o que faltar vem do CSS
  try { const j = JSON.parse(prefs.get(key, '')); if (j && typeof j === 'object') st = j; } catch { /* sem posição salva */ }
  const save = () => prefs.set(key, JSON.stringify(st));

  const title = h('span', { class: 'ch-title' }, '💬 Chat');
  const fold = h('button', { title: 'Recolher / abrir o chat' }, '▾');
  const reset = h('button', { title: 'Voltar ao lugar e ao tamanho originais' }, '↺');
  const head = h('div', { id: 'chat-head', title: 'Arraste para mover o chat' }, title, fold, reset);
  const grip = h('div', { id: 'chat-grip', title: 'Arraste para mudar o tamanho' });
  const box = h('div', { id: 'chat', class: 'frame' }, head, log, h('div', { id: 'chat-bar' }, input, grip));

  const num = (v) => typeof v === 'number' && Number.isFinite(v);
  // mantém a caixa dentro da tela (a janela pode ter ficado menor, ou a posição veio de outra tela)
  function clamp() {
    if (num(st.w)) st.w = Math.max(MIN_W, Math.min(st.w, window.innerWidth - 8));
    if (num(st.h)) st.h = Math.max(MIN_H, Math.min(st.h, window.innerHeight - 8));
    if (num(st.x) && num(st.y)) {
      // a caixa inteira fica na tela (escondida no celular, sem tamanho medido, só a barra precisa aparecer)
      const bw = box.offsetWidth || Math.min(st.w || MIN_W, 120), bh = box.offsetHeight || 30;
      st.x = Math.max(0, Math.min(st.x, window.innerWidth - bw));
      st.y = Math.max(0, Math.min(st.y, window.innerHeight - bh));
    }
  }
  function apply() {
    clamp();
    const moved = num(st.x) && num(st.y);
    box.style.left = moved ? st.x + 'px' : '';
    box.style.top = moved ? st.y + 'px' : '';
    box.style.bottom = moved ? 'auto' : '';
    box.style.width = num(st.w) ? st.w + 'px' : '';
    box.style.height = num(st.h) ? st.h + 'px' : '';
    box.classList.toggle('min', !!st.min);
    fold.textContent = st.min ? '▴' : '▾';
    if (!st.min) { unread = 0; title.textContent = '💬 Chat'; }
  }
  // passa a posicionar pelo canto de cima, mantendo onde a caixa está agora
  function pin() {
    if (num(st.x) && num(st.y)) return;
    const r = box.getBoundingClientRect();
    st.x = r.left; st.y = r.top;
  }

  // mensagens novas com o chat recolhido viram um contador na barra
  let unread = 0;
  new MutationObserver((list) => {
    if (!st.min) return;
    for (const m of list) unread += m.addedNodes.length;
    title.textContent = unread ? `💬 Chat (${unread})` : '💬 Chat';
  }).observe(log, { childList: true });

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

  fold.addEventListener('click', () => { st.min = !st.min; if (st.min) pin(); apply(); save(); });
  const home = () => { st = {}; apply(); save(); };
  reset.addEventListener('click', home);
  head.addEventListener('dblclick', (e) => { if (!e.target.closest('button')) home(); });
  // quem começa a digitar (Enter) com o chat recolhido vê a caixa abrir
  input.addEventListener('focus', () => { if (st.min) { st.min = false; apply(); save(); } });
  window.addEventListener('resize', apply);

  apply();
  return box;
}
