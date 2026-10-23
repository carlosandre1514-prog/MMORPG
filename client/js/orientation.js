// Mantém o jogo na horizontal. Navegadores só deixam travar a orientação em tela cheia e depois de um toque do jogador,
// então o primeiro toque (em telas de toque) entra em tela cheia e trava; instalado na tela inicial, o manifesto já pede
// "landscape". Se o aparelho não deixar travar (iPhone, por exemplo), um aviso cobre a tela enquanto estiver em pé.
import { isTouchDevice } from './device.js';

function lock() {
  try {
    const p = screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape');
    if (p && p.catch) p.catch(() => {});
  } catch { /* sem suporte */ }
}

// precisa ser chamada de dentro de um toque/clique
export function enterLandscape() {
  const el = document.documentElement;
  const req = el.requestFullscreen || el.webkitRequestFullscreen;
  if (document.fullscreenElement || document.webkitFullscreenElement || !req) { lock(); return; }
  try {
    const p = req.call(el, { navigationUI: 'hide' });
    if (p && p.then) p.then(lock, lock); else lock();
  } catch { lock(); }
}

export function setupLandscape() {
  if (!isTouchDevice()) return;
  document.body.classList.add('is-touch');
  lock(); // funciona se já estiver em tela cheia ou instalado
  // aviso para quando o aparelho está em pé e não deixou travar
  const ov = document.createElement('div');
  ov.id = 'rotate-overlay';
  ov.innerHTML = '<div class="ro-phone"><i></i></div><b>Gire o celular para a horizontal</b>'
    + '<small>O jogo só funciona deitado.</small><button type="button">Tela cheia (travar na horizontal)</button>';
  ov.querySelector('button').addEventListener('click', enterLandscape);
  document.body.appendChild(ov);
  // o primeiro toque do jogador liga a tela cheia e a trava (uma vez só; depois o botão de tela cheia e o aviso fazem isso)
  const first = () => { enterLandscape(); window.removeEventListener('pointerup', first, true); window.removeEventListener('click', first, true); };
  window.addEventListener('pointerup', first, true);
  window.addEventListener('click', first, true);
  document.addEventListener('fullscreenchange', lock);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) lock(); });
}
