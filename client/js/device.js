// Detecção de aparelho e qualidade gráfica: celulares e máquinas fracas ganham configurações mais leves.
const ls = {
  get(k, d) { try { return localStorage.getItem('aethra_' + k) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('aethra_' + k, v); } catch { /* ignorado */ } },
};

export const prefs = ls;

export function isTouchDevice() {
  try {
    return (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) || (navigator.maxTouchPoints > 0 && 'ontouchstart' in window);
  } catch { return false; }
}

// controles de toque: 'auto' (só em telas de toque), 'on' ou 'off'
export function touchUiMode() { return ls.get('touchui', 'auto'); }
export function touchUiEnabled() {
  const m = touchUiMode();
  return m === 'on' || (m === 'auto' && isTouchDevice());
}

export function weakDevice() {
  const cores = navigator.hardwareConcurrency || 8;
  const mem = navigator.deviceMemory || 8;
  return cores <= 4 || mem <= 4;
}

// Qualidade: 'auto' | 'high' | 'low'. No automático, celulares e aparelhos fracos usam o modo leve.
export function qualityMode() { return ls.get('quality', 'auto'); }

export function quality() {
  const m = qualityMode();
  const low = m === 'low' || (m === 'auto' && (isTouchDevice() || weakDevice()));
  if (!low) return { low: false, dprMax: 1.6, antialias: true, shadows: true, shadowMap: 2048, groundRes: 0.75, lights: 6, cullR: 14, lodR: 8, innerR: 8, particles: 1600, farMul: 1, pixels: Infinity };
  const q = { low: true, dprMax: 1.25, antialias: false, shadows: false, shadowMap: 1024, groundRes: 0.5, lights: 2, cullR: 7, lodR: 6, innerR: 3, particles: 450, farMul: 0.7, pixels: 520000 };
  // "muito leve": o jogo ligou sozinho depois de medir que nem o modo leve chegava aos 24 quadros por segundo
  if (ls.get('ultra', '0') === '1') Object.assign(q, { dprMax: 1, cullR: 5, lodR: 4, innerR: 2, particles: 250, farMul: 0.55, pixels: 380000 });
  return q;
}
