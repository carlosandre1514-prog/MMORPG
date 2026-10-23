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

function weakDevice() {
  const cores = navigator.hardwareConcurrency || 8;
  const mem = navigator.deviceMemory || 8;
  return cores <= 4 || mem <= 4;
}

// Qualidade: 'auto' | 'high' | 'low'. No automático, celulares e aparelhos fracos usam o modo leve.
export function qualityMode() { return ls.get('quality', 'auto'); }

export function quality() {
  const m = qualityMode();
  const low = m === 'low' || (m === 'auto' && (isTouchDevice() || weakDevice()));
  return low
    ? { low: true, dprMax: 1.25, antialias: false, shadows: false, shadowMap: 1024, groundRes: 0.5, lights: 3, cullR: 10, lodR: 6, particles: 700, farMul: 0.8 }
    : { low: false, dprMax: 1.6, antialias: true, shadows: true, shadowMap: 2048, groundRes: 0.75, lights: 6, cullR: 14, lodR: 8, particles: 1600, farMul: 1 };
}
