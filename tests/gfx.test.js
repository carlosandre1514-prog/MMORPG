// Gráficos do cliente (device.js): detecção da capacidade do aparelho, perfis, ajustes pessoais e migração das preferências antigas.
import { test } from 'node:test';
import assert from 'node:assert/strict';

// O módulo é feito para o navegador: aqui ele recebe um navegador de mentira, novo a cada teste (o cache do módulo é por URL).
let n = 0;
function def(name, value) { Object.defineProperty(globalThis, name, { value, configurable: true, writable: true }); }
async function boot({ gpu = '', cores = 8, mem = 8, touch = false, prefs = {}, w = 1280, h = 720, dpr = 1 } = {}) {
  const store = new Map(Object.entries(prefs).map(([k, v]) => ['aethra_' + k, v]));
  def('localStorage', { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) });
  def('navigator', { hardwareConcurrency: cores, deviceMemory: mem, maxTouchPoints: touch ? 5 : 0 });
  def('screen', { width: w, height: h });
  def('window', { innerWidth: w, innerHeight: h, devicePixelRatio: dpr, matchMedia: () => ({ matches: touch }), ontouchstart: touch ? null : undefined });
  const gl = {
    RENDERER: 1, MAX_TEXTURE_SIZE: 2,
    getExtension: (name) => (name === 'WEBGL_debug_renderer_info' ? { UNMASKED_RENDERER_WEBGL: 9 } : name === 'WEBGL_lose_context' ? { loseContext() {} } : null),
    getParameter: (p) => (p === 9 || p === 1 ? gpu : 4096),
  };
  def('document', { createElement: () => ({ getContext: () => gl }) });
  const dev = await import(`../client/js/device.js?t=${++n}`);
  return { dev, store };
}

test('a placa de vídeo e o aparelho definem o perfil sugerido', async () => {
  const cases = [
    // [placa, opções, perfil esperado]
    ['ANGLE (Qualcomm, Adreno (TM) 650, OpenGL ES 3.2)', { touch: true }, 'medio'],
    ['ANGLE (Qualcomm, Adreno (TM) 506, OpenGL ES 3.2)', { touch: true }, 'baixo'],
    ['ANGLE (Qualcomm, Adreno (TM) 610, OpenGL ES 3.2)', { touch: true }, 'baixo'],
    ['ANGLE (ARM, Mali-G52 MC2, OpenGL ES 3.2)', { touch: true }, 'baixo'],
    ['ANGLE (ARM, Mali-G78, OpenGL ES 3.2)', { touch: true }, 'medio'],
    ['ANGLE (ARM, Mali-T830, OpenGL ES 3.2)', { touch: true }, 'baixo'],
    ['Apple GPU', { touch: true }, 'medio'],
    ['ANGLE (Qualcomm, Adreno (TM) 740, OpenGL ES 3.2)', { touch: true, cores: 4 }, 'baixo'], // processador fraco segura
    ['ANGLE (Qualcomm, Adreno (TM) 740, OpenGL ES 3.2)', { touch: true, mem: 2 }, 'baixo'],
    ['ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Direct3D11 vs_5_0 ps_5_0, D3D11)', {}, 'ultra'],
    ['ANGLE (NVIDIA, NVIDIA GeForce RTX 2060 Direct3D11, D3D11)', {}, 'alto'],
    ['ANGLE (NVIDIA, NVIDIA GeForce GTX 1060 Direct3D11, D3D11)', {}, 'alto'],
    ['ANGLE (NVIDIA, NVIDIA GeForce GT 710 Direct3D11, D3D11)', {}, 'medio'],
    ['ANGLE (AMD, AMD Radeon RX 6600 Direct3D11, D3D11)', {}, 'ultra'],
    ['ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11, D3D11)', {}, 'medio'],
    ['ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11, D3D11)', {}, 'alto'],
    ['ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11, D3D11)', { cores: 2 }, 'baixo'],
    ['ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11, D3D11)', { mem: 4 }, 'medio'],
    ['ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)', {}, 'minimo'],
    ['llvmpipe (LLVM 15.0.7, 256 bits)', {}, 'minimo'],
    ['', {}, 'medio'], // não identificada: assume média
    ['', { touch: true }, 'baixo'],
  ];
  for (const [gpu, opts, want] of cases) {
    const { dev } = await boot({ gpu, ...opts });
    assert.equal(dev.deviceProfile().suggested, want, `${gpu} ${JSON.stringify(opts)}`);
  }
});

test('o perfil descreve o aparelho para a tela de opções', async () => {
  const { dev } = await boot({ gpu: 'ANGLE (Qualcomm, Adreno (TM) 650, OpenGL ES 3.2)', touch: true, w: 800, h: 360, dpr: 3 });
  const p = dev.deviceProfile();
  assert.equal(p.kind, 'Celular');
  assert.equal(p.screen, '2400×1080');
  assert.equal(p.gpu, 'Qualcomm, Adreno (TM) 650, OpenGL ES 3.2');
  assert.equal(p.software, false);
  assert.equal((await boot({ touch: true, w: 1024, h: 768 })).dev.deviceProfile().kind, 'Tablet');
  assert.equal((await boot({ gpu: 'SwiftShader' })).dev.deviceProfile().software, true);
});

test('cada perfil traz valores coerentes e mais pesados a cada degrau', async () => {
  const { dev } = await boot();
  const Q = dev.quality();
  const seen = [];
  for (const k of dev.PRESET_ORDER) {
    dev.setGfxPreset(k);
    seen.push({ ...Q });
  }
  const key = (name) => seen.map((q) => q[name]);
  const nondecreasing = (a) => a.every((v, i) => i === 0 || v >= a[i - 1]);
  for (const name of ['dprMax', 'lights', 'cullR', 'lodR', 'innerR', 'farMul', 'particles', 'shadowMap', 'groundRes']) assert.ok(nondecreasing(key(name)), name);
  assert.deepEqual(key('shadows'), [false, false, true, true, true]);
  assert.deepEqual(key('pbr'), [false, false, false, true, true]);
  assert.deepEqual(key('fuse'), [true, true, false, false, false]);
  assert.equal(seen[4].pixels, Infinity);
  assert.ok(seen[0].pixels < seen[2].pixels);
  assert.deepEqual(key('fps'), [30, 60, 60, 0, 0].map((v, i) => (i === 1 ? seen[1].fps : v)));
});

test('quality() devolve sempre o mesmo objeto, atualizado no lugar', async () => {
  const { dev } = await boot({ gpu: 'NVIDIA GeForce RTX 3060' });
  const Q = dev.quality();
  assert.equal(Q, dev.quality());
  let called = 0;
  dev.onGfxChange(() => called++);
  assert.equal(Q.shadows, true); // Ultra: sombras ligadas
  dev.setGfxPreset('minimo');
  assert.equal(Q, dev.quality());
  assert.equal(Q.shadows, false);
  assert.equal(Q.cullR, 5);
  assert.equal(called, 1);
});

test('ajustes pessoais valem sobre o perfil, voltam ao perfil quando iguais e ignoram valores inválidos', async () => {
  const { dev, store } = await boot({ gpu: 'Intel(R) UHD Graphics 620' }); // Médio
  const g0 = dev.gfxState();
  assert.equal(g0.preset, 'auto');
  assert.equal(g0.base, 'medio');
  assert.equal(g0.adapt, true);
  assert.equal(g0.custom, false);
  dev.setGfxOption('shadows', 4096);
  dev.setGfxOption('lights', 8);
  dev.setGfxOption('res', 99); // inválido
  dev.setGfxOption('aa', 'sim'); // inválido
  dev.setGfxOption('naoexiste', 1);
  let g = dev.gfxState();
  assert.deepEqual(g.over, { shadows: 4096, lights: 8 });
  assert.equal(g.custom, true);
  assert.equal(dev.quality().shadowMap, 4096);
  assert.equal(dev.quality().lights, 8);
  assert.equal(dev.quality().fuse, false);
  assert.deepEqual(JSON.parse(store.get('aethra_gfx')).o, { shadows: 4096, lights: 8 });
  dev.setGfxOption('shadows', 1024); // igual ao do perfil Médio: deixa de ser ajuste pessoal
  assert.deepEqual(dev.gfxState().over, { lights: 8 });
  dev.setGfxPreset('alto'); // escolher perfil desfaz os ajustes
  g = dev.gfxState();
  assert.equal(g.custom, false);
  assert.equal(g.preset, 'alto');
  assert.equal(g.adapt, false); // perfil escolhido à mão não rebaixa sozinho
  dev.setGfxAdapt(true);
  assert.equal(dev.quality().adapt, true);
});

test('anti-serrilhado, materiais e textura do chão pedem recarregar; o resto não', async () => {
  const { dev } = await boot({ gpu: 'Intel(R) UHD Graphics 620' });
  assert.equal(dev.needsReload(), false);
  dev.setGfxOption('shadows', 0);
  dev.setGfxOption('res', 0.75);
  dev.setGfxOption('view', 4);
  assert.equal(dev.needsReload(), false);
  const boot0 = dev.bootQuality();
  dev.setGfxOption('pbr', true);
  assert.equal(dev.needsReload(), true);
  assert.equal(dev.bootQuality(), boot0); // o cenário já carregado não muda no meio do caminho
  assert.equal(dev.bootQuality().pbr, false);
  dev.setGfxOption('pbr', false);
  assert.equal(dev.needsReload(), false);
  dev.setGfxOption('ground', 1);
  assert.equal(dev.needsReload(), true);
});

test('o perfil automático desce um degrau por vez, lembra e nunca sobe além do sugerido', async () => {
  const { dev, store } = await boot({ gpu: 'NVIDIA GeForce RTX 2060' }); // Alto
  assert.equal(dev.gfxState().base, 'alto');
  assert.equal(dev.lowerAutoPreset(), 'medio');
  assert.equal(dev.gfxState().base, 'medio');
  assert.equal(store.get('aethra_autotier'), 'medio');
  assert.equal(dev.lowerAutoPreset(), 'baixo');
  assert.equal(dev.lowerAutoPreset(), 'minimo');
  assert.equal(dev.lowerAutoPreset(), null); // já no mínimo
  // perfil escolhido à mão não é rebaixado sozinho
  dev.setGfxPreset('ultra');
  assert.equal(dev.lowerAutoPreset(), null);
  // detectar de novo esquece o rebaixamento
  dev.resetGfx();
  assert.equal(store.get('aethra_autotier'), '');
  assert.equal(dev.gfxState().base, 'alto');
  // (cada boot() troca o navegador de mentira, então estes ficam por último)
  // noutra sessão o jogo começa no degrau lembrado
  const again = await boot({ gpu: 'NVIDIA GeForce RTX 2060', prefs: { autotier: 'baixo' } });
  assert.equal(again.dev.gfxState().base, 'baixo');
  // aparelho melhorou (ou o valor guardado é maior que o sugerido): fica no sugerido
  const better = await boot({ gpu: 'Intel(R) UHD Graphics 620', prefs: { autotier: 'ultra' } });
  assert.equal(better.dev.gfxState().base, 'medio');
});

test('preferências da versão anterior são migradas', async () => {
  const gfx = async (prefs, gpu = 'Intel(R) UHD Graphics 620') => (await boot({ gpu, prefs })).dev.gfxState();
  let g = await gfx({ quality: 'high' });
  assert.deepEqual([g.preset, g.base], ['alto', 'alto']);
  g = await gfx({ quality: 'high', shadows: '0' });
  assert.equal(g.cfg.shadows, 0);
  assert.deepEqual(g.over, { shadows: 0 });
  g = await gfx({ quality: 'low' });
  assert.equal(g.preset, 'baixo');
  g = await gfx({ quality: 'low', ultra: '1' });
  assert.equal(g.preset, 'minimo');
  g = await gfx({ quality: 'auto', ultra: '1' });
  assert.deepEqual([g.preset, g.base], ['auto', 'minimo']); // o jogo tinha rebaixado sozinho
  g = await gfx({ quality: 'auto', shadows: '1' }, 'Adreno (TM) 506');
  assert.equal(g.cfg.shadows > 0, true);
});

test('preferência nova corrompida ou fora da lista não derruba nada', async () => {
  let g = (await boot({ prefs: { gfx: 'lixo{' } })).dev.gfxState();
  assert.equal(g.preset, 'auto');
  g = (await boot({ prefs: { gfx: JSON.stringify({ p: 'zzz', o: { res: 7, shadows: 2048, aa: 'x', foo: 1 }, a: 'x' }) } })).dev.gfxState();
  assert.equal(g.preset, 'auto');
  assert.deepEqual(g.over, { shadows: 2048 });
  assert.equal(g.adapt, true);
});
