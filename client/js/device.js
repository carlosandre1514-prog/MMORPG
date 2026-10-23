// Detecção de aparelho e qualidade gráfica.
// O jogo mede a capacidade do celular/PC (placa de vídeo, núcleos, memória, tela), escolhe um perfil (Mínimo … Ultra) e deixa
// o jogador ajustar cada item em Opções > Gráficos. As escolhas ficam em localStorage ('aethra_gfx') e `quality()` devolve
// sempre o MESMO objeto, atualizado no lugar, para o motor 3D ler os valores novos sem recarregar.
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

// ------------------------------------------------------------------ capacidade do aparelho
let gpuCache = null;
// Nome da placa de vídeo (via um contexto WebGL descartável, solto logo em seguida).
export function gpuInfo() {
  if (gpuCache) return gpuCache;
  let renderer = '', maxTex = 0;
  try {
    const gl = document.createElement('canvas').getContext('webgl2') || document.createElement('canvas').getContext('webgl');
    if (gl) {
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      renderer = String((ext && gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) || gl.getParameter(gl.RENDERER) || '');
      maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 0;
      const lose = gl.getExtension('WEBGL_lose_context');
      if (lose) lose.loseContext();
    }
  } catch { /* sem WebGL: o jogo nem abre, mas a detecção não pode quebrar */ }
  gpuCache = { renderer, maxTex };
  return gpuCache;
}

// 0 software · 1 fraca · 2 média · 3 boa · 4 muito boa · 5 topo de linha (estimativa pelo nome da placa)
function gpuTier(name) {
  const s = name.toLowerCase();
  if (!s) return 2;
  if (/swiftshader|llvmpipe|softpipe|software|basic render|microsoft basic/.test(s)) return 0;
  let m;
  if ((m = s.match(/adreno[^\d]*(\d{3})/))) { const n = +m[1]; return n < 540 ? 1 : n < 600 ? 2 : n < 618 ? 1 : n < 640 ? 2 : n < 730 ? 3 : 4; }
  if ((m = s.match(/mali-?g(\d+)/))) { const n = +m[1]; return n <= 52 ? 1 : n <= 72 ? 2 : n <= 78 ? 3 : 4; }
  if (/mali|powervr|videocore|vivante/.test(s)) return /bxm|bxt|cxt|dxt/.test(s) ? 3 : 1;
  if (/apple/.test(s)) return /\bm\d|pro|max|ultra/.test(s) ? 4 : 3;
  if (/rtx\s*[345]0|rx\s*[67]\d{3}/.test(s)) return 5;
  if (/rtx|gtx\s*16|rx\s*[45]\d{2,3}|radeon pro|arc\b/.test(s)) return 4;
  if (/geforce|nvidia/.test(s)) return /\bgt\s*\d|gtx\s*(10[0-4]\d|[4-7]\d\d)\b|mx\s*[12]\d\d/.test(s) ? 2 : 3; // GT 710/1030, GTX 750 e MX são fracas
  if (/iris\(r\) xe|iris xe|iris plus|vega|radeon\(tm\) graphics|radeon graphics/.test(s)) return 3;
  if (/intel|uhd|hd graphics|radeon/.test(s)) return 2;
  return 2;
}

export const TIER_NAMES = ['Muito baixa', 'Baixa', 'Média', 'Alta', 'Muito alta', 'Excelente'];

let profile = null;
export function deviceProfile() {
  if (profile) return profile;
  const touch = isTouchDevice();
  const cores = navigator.hardwareConcurrency || 0;
  const mem = navigator.deviceMemory || 0;
  const gpu = gpuInfo();
  const dpr = window.devicePixelRatio || 1;
  let tier = gpuTier(gpu.renderer);
  // a placa manda, mas pouco processador/memória seguram o jogo (simulação, rede, coleta de lixo)
  if (cores && cores <= 2) tier = Math.min(tier, 1);
  else if (cores && cores <= 4) tier = Math.min(tier, touch ? 1 : 3);
  if (mem && mem <= 2) tier = Math.min(tier, 1);
  else if (mem && mem <= 4) tier = Math.min(tier, touch ? 1 : 2);
  const short = Math.min(window.innerWidth, window.innerHeight);
  const kind = !touch ? 'Computador' : short >= 600 ? 'Tablet' : 'Celular';
  // celulares e tablets esquentam e gastam bateria: o automático pára em "Médio" (o jogador pode subir)
  const auto = touch ? ['minimo', 'baixo', 'baixo', 'medio', 'medio', 'medio'] : ['minimo', 'baixo', 'medio', 'alto', 'alto', 'ultra'];
  profile = {
    kind, touch, cores, mem, tier, tierName: TIER_NAMES[tier],
    gpu: gpu.renderer.replace(/^ANGLE \((.*)\)$/, '$1') || 'não identificada',
    software: tier === 0 && !!gpu.renderer,
    screen: `${Math.round(screen.width * dpr)}×${Math.round(screen.height * dpr)}`,
    dpr: Math.round(dpr * 100) / 100,
    suggested: auto[tier],
  };
  return profile;
}

// ------------------------------------------------------------------ perfis e ajustes
export const PRESET_ORDER = ['minimo', 'baixo', 'medio', 'alto', 'ultra'];
export const PRESET_NAMES = { minimo: 'Mínimo', baixo: 'Baixo', medio: 'Médio', alto: 'Alto', ultra: 'Ultra' };
export const PRESET_DESC = {
  minimo: 'Aparelhos bem fracos: alcance curto, sem sombras, resolução reduzida e 30 quadros por segundo.',
  baixo: 'Celulares simples: sem sombras, materiais leves, alcance curto e poucas luzes.',
  medio: 'Equilibrado: sombras suaves, 4 luzes dinâmicas e alcance médio.',
  alto: 'Computadores bons e celulares top: sombras nítidas, materiais realistas e anti-serrilhado.',
  ultra: 'Máximo de detalhe: resolução alta, sombras 4K, alcance máximo e muitos efeitos. Exige boa placa de vídeo.',
};

// res: resolução interna do 3D (multiplicador da tela, nunca acima do pixel ratio do aparelho) · pixels: teto de pixels por quadro (0 = sem teto)
// shadows: tamanho do mapa de sombra (0 = sem sombras) · view: distância de visão (0–4) · fx: máximo de partículas
// lights: luzes dinâmicas (tochas, fogo, magias) · fps: limite de quadros (0 = sem limite) · ground: textura do chão
// vfx: efeitos de habilidades em shader (0 = simples, 1 = shaders, 2 = completo com fumaça, camadas extras e auras de estado)
const PRESETS = {
  minimo: { res: 1, pixels: 380000, shadows: 0, aa: false, view: 0, pbr: false, fx: 250, vfx: 0, lights: 2, fps: 30, ground: 0.5 },
  baixo: { res: 1.25, pixels: 520000, shadows: 0, aa: false, view: 1, pbr: false, fx: 450, vfx: 0, lights: 2, fps: weakDevice() ? 30 : 60, ground: 0.5 },
  medio: { res: 1.5, pixels: 900000, shadows: 1024, aa: false, view: 2, pbr: false, fx: 900, vfx: 1, lights: 4, fps: 60, ground: 0.75 },
  alto: { res: 1.5, pixels: 0, shadows: 2048, aa: true, view: 3, pbr: true, fx: 1600, vfx: 2, lights: 6, fps: 0, ground: 0.75 },
  ultra: { res: 2, pixels: 0, shadows: 4096, aa: true, view: 4, pbr: true, fx: 3000, vfx: 2, lights: 8, fps: 0, ground: 1 },
};

// alcance por nível de "distância de visão": objetos, detalhe dos prédios, interiores e névoa
const VIEW = [
  { cullR: 5, lodR: 4, innerR: 2, farMul: 0.55 },
  { cullR: 7, lodR: 6, innerR: 3, farMul: 0.7 },
  { cullR: 10, lodR: 7, innerR: 5, farMul: 0.85 },
  { cullR: 14, lodR: 8, innerR: 8, farMul: 1 },
  { cullR: 20, lodR: 12, innerR: 12, farMul: 1.25 },
];

// Campos do painel de Gráficos (reload: só vale depois de recarregar a página)
export const GFX_FIELDS = [
  { key: 'res', label: 'Resolução do 3D', hint: 'Menor = mais rápido e mais borrado.', opts: [[0.5, 'Muito baixa (0,5×)'], [0.75, 'Baixa (0,75×)'], [1, 'Normal (1×)'], [1.25, 'Boa (1,25×)'], [1.5, 'Alta (1,5×)'], [2, 'Muito alta (2×)']] },
  { key: 'pixels', label: 'Limite de pixels', hint: 'Teto por quadro; ajuda em telas grandes.', opts: [[380000, 'Mínimo (0,4 MP)'], [520000, 'Baixo (0,5 MP)'], [900000, 'Médio (0,9 MP)'], [1500000, 'Alto (1,5 MP)'], [2100000, 'Full HD (2 MP)'], [0, 'Sem limite']] },
  { key: 'shadows', label: 'Sombras', hint: 'Um dos itens mais pesados.', opts: [[0, 'Desligadas'], [1024, 'Baixa'], [2048, 'Média'], [4096, 'Alta']] },
  { key: 'view', label: 'Distância de visão', hint: 'Alcance de objetos, prédios e névoa.', opts: [[0, 'Muito curta'], [1, 'Curta'], [2, 'Média'], [3, 'Longa'], [4, 'Máxima']] },
  { key: 'fx', label: 'Partículas e efeitos', hint: 'Fogo, magias, faíscas.', opts: [[250, 'Mínimas'], [450, 'Baixas'], [900, 'Médias'], [1600, 'Altas'], [3000, 'Máximas']] },
  { key: 'vfx', label: 'Efeitos de habilidades', hint: 'Golpes, magias, explosões e escudos em shader.', opts: [[0, 'Simples'], [1, 'Bonitos'], [2, 'Completos']] },
  { key: 'lights', label: 'Luzes dinâmicas', hint: 'Tochas, fogo e magias que iluminam.', opts: [[0, 'Nenhuma'], [2, '2 luzes'], [4, '4 luzes'], [6, '6 luzes'], [8, '8 luzes']] },
  { key: 'fps', label: 'Limite de quadros', hint: '30 poupa bateria e esquenta menos.', opts: [[30, '30 FPS'], [60, '60 FPS'], [0, 'Sem limite']] },
  { key: 'aa', label: 'Anti-serrilhado', hint: 'Suaviza as bordas.', bool: true, reload: true },
  { key: 'pbr', label: 'Materiais realistas', hint: 'Relevo e brilho nas texturas.', bool: true, reload: true },
  { key: 'ground', label: 'Textura do chão', hint: 'Nitidez do terreno.', reload: true, opts: [[0.5, 'Baixa'], [0.75, 'Média'], [1, 'Alta']] },
];
const FIELD = Object.fromEntries(GFX_FIELDS.map((f) => [f.key, f]));
const RELOAD_KEYS = GFX_FIELDS.filter((f) => f.reload).map((f) => f.key);

function validValue(key, v) {
  const f = FIELD[key];
  if (!f) return false;
  return f.bool ? typeof v === 'boolean' : f.opts.some(([x]) => x === v);
}
function cleanOverrides(o, base) {
  const out = {};
  if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) if (validValue(k, v) && v !== base[k]) out[k] = v;
  return out;
}

// ------------------------------------------------------------------ estado salvo
let state = null; // { p: 'auto' | perfil, o: ajustes que diferem do perfil, a: ajuste automático (undefined = padrão do perfil) }

function autoPreset() {
  const suggested = deviceProfile().suggested;
  const t = ls.get('autotier', '');
  // o jogo rebaixou o perfil sozinho depois de medir quadros lentos (e nunca sobe além do sugerido)
  return PRESETS[t] && PRESET_ORDER.indexOf(t) < PRESET_ORDER.indexOf(suggested) ? t : suggested;
}
function baseName() { return state.p === 'auto' ? autoPreset() : state.p; }

function load() {
  try {
    const j = JSON.parse(ls.get('gfx', ''));
    if (j && typeof j === 'object') {
      const p = j.p === 'auto' || PRESETS[j.p] ? j.p : 'auto';
      state = { p, o: {}, a: typeof j.a === 'boolean' ? j.a : undefined };
      state.o = cleanOverrides(j.o, PRESETS[baseName()]);
      return;
    }
  } catch { /* sem preferência nova: migra as antigas */ }
  // preferências da versão anterior (aethra_quality / aethra_ultra / aethra_shadows)
  const q = ls.get('quality', 'auto');
  const ultra = ls.get('ultra', '0') === '1';
  state = { p: q === 'high' ? 'alto' : q === 'low' ? (ultra ? 'minimo' : 'baixo') : 'auto', o: {} };
  if (q === 'auto' && ultra) ls.set('autotier', 'minimo');
  const sh = ls.get('shadows', null);
  if (sh === '0') state.o.shadows = 0;
  else if (sh === '1' && !PRESETS[baseName()].shadows) state.o.shadows = 1024;
  save();
}
function save() { ls.set('gfx', JSON.stringify(state)); }
function ensure() { if (!state) load(); return state; }

// Estado completo para a interface: perfil escolhido, perfil-base, ajustes pessoais e valores efetivos.
export function gfxState() {
  ensure();
  const base = baseName();
  const cfg = { ...PRESETS[base], ...state.o };
  return { preset: state.p, base, baseName: PRESET_NAMES[base], over: { ...state.o }, custom: Object.keys(state.o).length > 0, cfg, adapt: state.a ?? state.p === 'auto' };
}

// ------------------------------------------------------------------ valores usados pelo motor
const Q = {};
let booted = false, bootSig = '', boot = null;
const listeners = new Set();
const sig = (c) => RELOAD_KEYS.map((k) => c[k]).join('|');

function build() {
  const g = gfxState(), c = g.cfg;
  const v = VIEW[c.view] || VIEW[2];
  return {
    low: !c.pbr, // materiais leves (Lambert, sem mapa de normais)
    pbr: c.pbr, dprMax: c.res, antialias: c.aa, shadows: c.shadows > 0, shadowMap: c.shadows || 1024, groundRes: c.ground,
    lights: c.lights, fuse: c.lights <= 2, // com poucas luzes, uma só faz a luz do jogador e a do cômodo
    cullR: v.cullR, lodR: v.lodR, innerR: v.innerR, farMul: v.farMul, particles: c.fx, vfx: c.vfx,
    pixels: c.pixels || Infinity, fps: c.fps, adapt: g.adapt, textDpr: c.res <= 1.25 ? 1.5 : 2,
  };
}

// Sempre o mesmo objeto: quem guarda `const Q = quality()` enxerga as mudanças depois de refreshQuality().
export function quality() {
  if (!booted) {
    booted = true;
    Object.assign(Q, build());
    bootSig = sig(gfxState().cfg);
    boot = Object.freeze({ low: Q.low, pbr: Q.pbr, antialias: Q.antialias, groundRes: Q.groundRes });
  }
  return Q;
}

// Valores de quando a página abriu para o que só muda recarregando (materiais, anti-serrilhado, textura do chão):
// assim o cenário nunca mistura dois estilos se o jogador mexer nesses itens antes de recarregar.
export function bootQuality() { quality(); return boot; }

export function onGfxChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export function refreshQuality() {
  quality();
  Object.assign(Q, build());
  for (const fn of listeners) { try { fn(Q); } catch (e) { console.error('[gráficos]', e); } }
  return Q;
}

// Itens que só valem recarregando (anti-serrilhado, materiais, textura do chão) mudaram desde que a página abriu?
export function needsReload() { quality(); return sig(gfxState().cfg) !== bootSig; }

export function setGfxPreset(p) {
  ensure();
  state.p = p === 'auto' || PRESETS[p] ? p : 'auto';
  state.o = {};
  save();
  refreshQuality();
}

export function setGfxOption(key, value) {
  ensure();
  if (!validValue(key, value)) return;
  if (value === PRESETS[baseName()][key]) delete state.o[key]; else state.o[key] = value;
  save();
  refreshQuality();
}

export function setGfxAdapt(on) { ensure(); state.a = on; save(); refreshQuality(); }

// Volta ao automático e esquece o rebaixamento feito sozinho: o próximo passo é detectar o aparelho de novo.
export function resetGfx() {
  ensure();
  profile = null;
  state = { p: 'auto', o: {} };
  ls.set('autotier', '');
  save();
  refreshQuality();
}

// O jogo rebaixa o perfil automático quando mede quadros lentos; devolve o nome do novo perfil (ou null se já estava no mínimo).
export function lowerAutoPreset() {
  ensure();
  if (state.p !== 'auto') return null;
  const lower = PRESET_ORDER[PRESET_ORDER.indexOf(baseName()) - 1];
  if (!lower) return null;
  ls.set('autotier', lower);
  state.o = cleanOverrides(state.o, PRESETS[lower]);
  save();
  refreshQuality();
  return lower;
}

export function showFps() { return ls.get('showfps', '0') === '1'; }
export function setShowFps(on) { ls.set('showfps', on ? '1' : '0'); }
