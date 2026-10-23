// Logotipo AETHRA em relevo: letras próprias desenhadas em SVG (sem fonte), com lateral extrudada, bisel de luz, brilho que
// passa de tempos em tempos e uma chama no vão de cada A (o jogo é "A Chama Partida"). Uma só definição de gradientes e filtros
// fica escondida na página; cada logotipo só referencia essas definições.
import { h } from './dom.js';

// letras em uma grade de 120 de altura (largura própria); os A têm o vão em forma de chama
const LETTERS = [
  { d: 'M0 120 L36 0 H64 L100 120 H74 L66 94 H34 L26 120 Z', w: 100, flame: [50, 36, 74] },
  { d: 'M0 0 H92 L82 22 H26 V50 H76 L70 70 H26 V98 H82 L92 120 H0 Z', w: 92 },
  { d: 'M0 0 H100 L90 24 H62 V120 H38 V24 H10 Z', w: 100 },
  { d: 'M0 0 H26 V46 H74 V0 H100 V120 H74 V70 H26 V120 H0 Z', w: 100 },
  { d: 'M0 0 H62 C90 0 98 20 98 38 C98 56 88 66 72 70 L102 120 H72 L48 74 H26 V120 H0 Z M26 22 V52 H58 C68 52 72 46 72 37 C72 28 68 22 58 22 Z', w: 102, rule: 'evenodd' },
  { d: 'M0 120 L36 0 H64 L100 120 H74 L66 94 H34 L26 120 Z', w: 100, flame: [50, 36, 74] },
];
const GAP = 16, DEPTH = 9;
const W = LETTERS.reduce((a, l) => a + l.w, 0) + GAP * (LETTERS.length - 1);

// chama do vão do A: gota com ponta em cima, centrada em cx entre y0 e y1
const flame = (cx, y0, y1) => {
  const h2 = y1 - y0, w2 = h2 * 0.36;
  return `M${cx} ${y0} C${cx + w2 * 0.9} ${y0 + h2 * 0.32} ${cx + w2} ${y0 + h2 * 0.62} ${cx + w2 * 0.55} ${y1 - 3} Q${cx} ${y1 + 3} ${cx - w2 * 0.55} ${y1 - 3} C${cx - w2} ${y0 + h2 * 0.62} ${cx - w2 * 0.9} ${y0 + h2 * 0.32} ${cx} ${y0} Z`;
};

function shapes() {
  let x = 0, letters = '', flames = '';
  for (const l of LETTERS) {
    const f = l.flame ? flame(l.flame[0], l.flame[1] + 14, l.flame[2] + 12) : null;
    // o vão em forma de chama é recortado da letra (evenodd) e a chama é desenhada por cima
    letters += `<path transform="translate(${x} 0)" fill-rule="evenodd" d="${l.d}${f ? ' ' + f : ''}"/>`;
    if (f) flames += `<g transform="translate(${x} 0)"><path class="aw-flame" d="${f}"/></g>`; // a animação usa o transform do próprio caminho, então o deslocamento fica no grupo
    x += l.w + GAP;
  }
  return { letters, flames };
}

let defsReady = false, uid = 0;
function ensureDefs() {
  if (defsReady || document.getElementById('aw-defs')) { defsReady = true; return; }
  defsReady = true;
  const holder = document.createElement('div');
  holder.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  holder.innerHTML = `<svg id="aw-defs" width="0" height="0" aria-hidden="true"><defs>
    <linearGradient id="aw-gold" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fffbe6"/><stop offset=".22" stop-color="#ffe08a"/><stop offset=".48" stop-color="#f2a62d"/>
      <stop offset=".52" stop-color="#b26a12"/><stop offset=".78" stop-color="#e8962a"/><stop offset="1" stop-color="#ffe9a8"/>
    </linearGradient>
    <linearGradient id="aw-side" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9a5410"/><stop offset="1" stop-color="#2a1204"/></linearGradient>
    <linearGradient id="aw-fire" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff7c0"/><stop offset=".45" stop-color="#ffb52e"/><stop offset="1" stop-color="#e2410f"/></linearGradient>
    <linearGradient id="aw-sweep" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".85"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <filter id="aw-relief" x="-5%" y="-10%" width="110%" height="125%" color-interpolation-filters="sRGB">
      <feGaussianBlur in="SourceAlpha" stdDeviation="2.6" result="blur"/>
      <feSpecularLighting in="blur" surfaceScale="7" specularConstant="1.25" specularExponent="26" lighting-color="#fff4cc" result="spec"><fePointLight x="-120" y="-160" z="240"/></feSpecularLighting>
      <feComposite in="spec" in2="SourceAlpha" operator="in" result="specIn"/>
      <feDiffuseLighting in="blur" surfaceScale="5" diffuseConstant="1.05" lighting-color="#ffffff" result="diff"><feDistantLight azimuth="235" elevation="52"/></feDiffuseLighting>
      <feComposite in="diff" in2="SourceAlpha" operator="in" result="diffIn"/>
      <feBlend in="SourceGraphic" in2="diffIn" mode="multiply" result="shaded"/>
      <feComposite in="shaded" in2="specIn" operator="arithmetic" k1="0" k2="1" k3="1" k4="0"/>
    </filter>
    <filter id="aw-glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3.4"/></filter>
  </defs></svg>`;
  document.body.appendChild(holder);
}

// logotipo pronto para colocar na tela (a largura vem do CSS da classe .aw, que pode ser trocada por contêiner)
export function logoMark(cls = '') {
  ensureDefs();
  const { letters, flames } = shapes();
  const clip = 'aw-clip-' + (++uid);
  const H = 120 + DEPTH + 8;
  let ext = '';
  for (let i = DEPTH; i >= 1; i--) ext += `<g transform="translate(${(i * 0.55).toFixed(2)} ${i})" fill="url(#aw-side)">${letters}</g>`;
  const svg = `<svg class="aw-svg" viewBox="-10 -8 ${W + 28} ${H + 8}" role="img" aria-label="Aethra">
    <defs><clipPath id="${clip}"><g>${letters}</g></clipPath></defs>
    <g class="aw-ext">${ext}</g>
    <g class="aw-face" filter="url(#aw-relief)"><g fill="url(#aw-gold)">${letters}</g></g>
    <g fill="none" stroke="#fff3c4" stroke-width="1.1" stroke-opacity=".75" stroke-linejoin="round">${letters}</g>
    <g class="aw-fires"><g filter="url(#aw-glow)" opacity=".9" fill="#ff9a1c">${flames}</g><g fill="url(#aw-fire)">${flames}</g></g>
    <g clip-path="url(#${clip})"><rect class="aw-sweep" x="-80" y="-10" width="60" height="${H + 20}" fill="url(#aw-sweep)"/></g>
  </svg>`;
  return h('div', { class: 'aw' + (cls ? ' ' + cls : ''), html: svg });
}
