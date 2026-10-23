// Opções > Gráficos: capacidade do aparelho, perfis (Automática … Ultra), ajustes individuais ao vivo,
// medidor de FPS e teste de desempenho. Os valores moram em device.js; o motor 3D aplica as mudanças na hora.
import { h } from './dom.js';
import {
  GFX_FIELDS, PRESET_ORDER, PRESET_NAMES, PRESET_DESC, deviceProfile, gfxState, setGfxPreset, setGfxOption, setGfxAdapt, resetGfx,
  needsReload, quality, showFps, setShowFps,
} from '../device.js';

const BENCH_SECONDS = 6;
let bench = { running: false, p: 0, result: null }; // sobrevive a trocas de aba e a redesenhos do painel

// Compara a média medida com o alvo (limite de quadros ou 60) e sugere subir/descer um perfil
function advise(res) {
  const g = gfxState(), q = quality();
  const target = q.fps || 60;
  const i = PRESET_ORDER.indexOf(g.base);
  const lower = PRESET_ORDER[i - 1], higher = PRESET_ORDER[i + 1];
  const r = res.avg / target;
  if (r < 0.75 || res.low < target * 0.4) {
    return { tone: 'bad', text: lower ? `Pesado para este aparelho. Sugestão: perfil ${PRESET_NAMES[lower]}.` : 'Pesado, e já está no perfil mais leve. Reduza resolução e distância de visão à mão.', suggest: lower };
  }
  if (r >= 0.93 && res.low >= target * 0.6) {
    if (q.fps && q.fps <= 30) return { tone: 'ok', text: `Estável nos ${q.fps} FPS do limite escolhido.` };
    return higher
      ? { tone: 'good', text: `Sobrou desempenho! Você pode tentar o perfil ${PRESET_NAMES[higher]}.`, suggest: higher }
      : { tone: 'good', text: 'Perfeito: rodando liso no perfil mais alto.' };
  }
  return { tone: 'ok', text: 'Bom: dá para jogar bem neste perfil.' };
}

export function graphicsPanel(ui) {
  const root = h('div', { class: 'gfx' });
  const scroller = () => ui.wins.options.body;

  const draw = () => {
    const keep = scroller().scrollTop;
    root.replaceChildren(...build());
    scroller().scrollTop = keep;
  };
  const change = (fn) => { fn(); draw(); };

  function build() {
    const g = gfxState(), p = deviceProfile();
    const out = [];

    // ---- aparelho
    const meter = h('span', { class: 'gfx-meter', title: `Capacidade estimada: ${p.tierName}` }, ...[1, 2, 3, 4, 5].map((n) => h('i', { class: p.tier >= n ? 'on' : '' })));
    out.push(h('div', { class: 'gfx-dev' },
      h('div', {}, h('b', {}, p.kind), ' · capacidade ', h('b', {}, p.tierName), meter),
      h('div', { class: 'muted small' }, `Placa de vídeo: ${p.gpu}`),
      h('div', { class: 'muted small' }, `${p.cores ? p.cores + ' núcleos' : 'núcleos n/d'} · ${p.mem ? (p.mem >= 8 ? '8 GB ou mais' : p.mem + ' GB') : 'memória n/d'} · tela ${p.screen} (${p.dpr}×)`),
      p.software ? h('div', { class: 'gfx-warn' }, 'O navegador está desenhando por software (sem a placa de vídeo). Ative a aceleração de hardware nas configurações dele.') : null,
      h('div', {}, 'Recomendado: ', h('b', { class: 'gold' }, PRESET_NAMES[p.suggested]))));

    // ---- perfil
    const sel = h('select', { class: 'opt-select gfx-preset' },
      h('option', { value: 'auto' }, `Automática (${g.baseName})`),
      ...PRESET_ORDER.map((k) => h('option', { value: k }, PRESET_NAMES[k])),
      g.custom ? h('option', { value: 'custom', disabled: true }, `Personalizado (base ${g.baseName})`) : null);
    sel.value = g.custom ? 'custom' : g.preset;
    sel.addEventListener('change', () => { if (sel.value !== 'custom') change(() => setGfxPreset(sel.value)); });
    out.push(h('div', { class: 'gfx-row gfx-profile' }, h('div', { class: 'gfx-l' }, 'Perfil gráfico'), sel));
    out.push(h('div', { class: 'muted small gfx-desc' }, g.custom ? 'Você ajustou itens individualmente. Escolher um perfil desfaz os ajustes.' : PRESET_DESC[g.base]));
    out.push(h('div', { class: 'row' },
      h('button', { class: 'btn small', onclick: () => change(() => { resetGfx(); ui.toast(`Aparelho detectado de novo: perfil ${gfxState().baseName}.`, 'info'); }) }, 'Detectar de novo')));

    // ---- ajustes individuais
    out.push(h('div', { class: 'ql-sub' }, 'Ajustes'));
    for (const f of GFX_FIELDS) {
      const val = g.cfg[f.key];
      let ctl;
      if (f.bool) {
        ctl = h('input', { type: 'checkbox' });
        ctl.checked = val;
        ctl.addEventListener('change', () => change(() => setGfxOption(f.key, ctl.checked)));
      } else {
        ctl = h('select', { class: 'opt-select' }, ...f.opts.map(([v, n]) => h('option', { value: String(v) }, n)));
        ctl.value = String(val);
        ctl.addEventListener('change', () => change(() => setGfxOption(f.key, Number(ctl.value))));
      }
      out.push(h('label', { class: 'gfx-row' + (f.key in g.over ? ' mod' : '') },
        h('span', { class: 'gfx-l' }, f.label + (f.reload ? ' ↻' : ''), h('small', {}, f.hint)), ctl));
    }

    const adapt = h('input', { type: 'checkbox' });
    adapt.checked = g.adapt;
    adapt.addEventListener('change', () => change(() => setGfxAdapt(adapt.checked)));
    out.push(h('label', { class: 'gfx-row' }, h('span', { class: 'gfx-l' }, 'Ajuste automático no jogo', h('small', {}, 'Se ficar lento, baixa a qualidade sozinho.')), adapt));
    const fps = h('input', { type: 'checkbox' });
    fps.checked = showFps();
    fps.addEventListener('change', () => { setShowFps(fps.checked); ui.game.renderer.setFpsMeter(fps.checked); });
    out.push(h('label', { class: 'gfx-row' }, h('span', { class: 'gfx-l' }, 'Mostrar FPS e estatísticas', h('small', {}, 'Quadros por segundo, resolução, chamadas e triângulos.')), fps));

    // ---- teste de desempenho
    out.push(h('div', { class: 'ql-sub' }, 'Teste de desempenho'));
    const res = h('div', { class: 'gfx-bench' });
    const showResult = () => {
      if (bench.running) { res.className = 'gfx-bench'; res.textContent = `Medindo… ${Math.ceil(BENCH_SECONDS * (1 - bench.p))} s (ande pela cidade para um teste mais fiel)`; return; }
      if (!bench.result) { res.className = 'gfx-bench'; res.textContent = 'Mede os quadros por segundo por alguns segundos e diz se vale subir ou descer o perfil. Faça com o jogo aberto onde ele pesa mais (a capital).'; return; }
      const { r, a } = bench.result;
      res.className = 'gfx-bench ' + a.tone;
      res.replaceChildren(
        h('div', {}, h('b', {}, `${r.avg.toFixed(0)} FPS`), ` em média · piores momentos: ${r.low.toFixed(0)} FPS`),
        h('div', {}, a.text),
        a.suggest ? h('button', { class: 'btn small', onclick: () => change(() => setGfxPreset(a.suggest)) }, `Usar perfil ${PRESET_NAMES[a.suggest]}`) : null);
    };
    const go = h('button', { class: 'btn small', onclick: () => {
      if (bench.running) return;
      bench = { running: true, p: 0, result: null };
      go.disabled = true;
      showResult();
      ui.game.renderer.startBench(BENCH_SECONDS, (r) => {
        bench = { running: false, p: 1, result: { r, a: advise(r) } };
        go.disabled = false;
        if (res.isConnected) showResult();
      }, (p) => { bench.p = p; if (res.isConnected) showResult(); });
    } }, `Testar agora (${BENCH_SECONDS} s)`);
    go.disabled = bench.running;
    showResult();
    out.push(h('div', { class: 'row' }, go), res);

    // ---- recarregar
    if (needsReload()) {
      out.push(h('div', { class: 'gfx-reload' },
        h('div', {}, 'Os itens marcados com ↻ só valem depois de recarregar (você volta à tela de login).'),
        h('button', { class: 'btn small', onclick: () => location.reload() }, 'Recarregar agora')));
    } else {
      out.push(h('div', { class: 'muted small' }, 'Itens com ↻ pedem recarregar a página para valer.'));
    }
    return out;
  }

  draw();
  return root;
}
