// Janela do Legado (tecla N): feitos, maestria, bestiário e desafios do dia e da semana. Os números vêm do servidor
// (mensagem `leg`); as definições e fórmulas são as de shared/data/legacy.js.
import { MONSTERS } from '/shared/data/monsters.js';
import { MAX_LEVEL } from '/shared/constants.js';
import {
  ACHIEVEMENTS, ACH_CATS, gloryRank, BESTIARY_LIST, BESTIARY_STEPS, bestiaryRank, bestiaryBonus,
  MASTERY_STATS, MASTERY_KEYS, masterySpent, respecCost, SPECIES_STUDIED,
} from '/shared/data/legacy.js';
import { h, clear, fmt } from './dom.js';
import { audio } from '../audio.js';

const pct = (v, d = 1) => `${(v * 100).toFixed(d).replace('.', ',')}%`;
const TIER_COLORS = ['#b08d57', '#c0c4cc', '#f1c40f', '#5dade2', '#c060ff', '#ff9a1f', '#ff5a5a'];

function progressBar(v, max, cls = '') {
  const w = Math.max(0, Math.min(100, (v / Math.max(1, max)) * 100));
  return h('div', { class: 'lc-bar ' + cls }, h('div', { class: 'lc-fill', style: { width: w + '%' } }));
}
function timeLeft(ms) {
  const s = Math.max(0, Math.floor(ms / 1000)), d = Math.floor(s / 86400), hh = Math.floor((s % 86400) / 3600), mm = Math.floor((s % 3600) / 60);
  return d ? `${d}d ${hh}h` : `${hh}h ${String(mm).padStart(2, '0')}min`;
}

export const legacyMixin = {
  buildLegacyWindow(W) {
    W('legacy', 'Legado', { w: 760 });
  },

  renderLegacy() {
    const body = clear(this.wins.legacy.body);
    if (!this.me.legacy) { body.appendChild(h('div', { class: 'muted' }, 'Carregando o seu legado...')); return; }
    this.drawLegacy();
  },

  // chegou o estado novo do servidor
  onLegacy(d) {
    this.me.legacy = d;
    this.me.title = d.title;
    if (this.wins.legacy && this.wins.legacy.isOpen) this.drawLegacy();
  },

  drawLegacy() {
    const d = this.me.legacy, me = this.me;
    const body = clear(this.wins.legacy.body);
    const tab = this.legTab || 'feitos';
    const rank = gloryRank(d.gl);
    const m = d.ma;
    const atMax = me.level >= MAX_LEVEL;
    // resumo: patente de Glória, maestria e título
    const titleSel = h('select', { class: 'lg-select lc-title', 'aria-label': 'Título' }, h('option', { value: '' }, '(sem título)'), ...d.ti.map((t) => h('option', { value: t }, t)));
    titleSel.value = d.title || '';
    titleSel.addEventListener('change', () => this.send({ t: 'title', v: titleSel.value || null }));
    body.appendChild(h('div', { class: 'lc-sum' },
      h('div', { class: 'lc-card' },
        h('div', { class: 'lc-k' }, 'Glória'),
        h('div', { class: 'lc-v' }, rank.name, h('small', {}, ` · ${fmt(d.gl)} pontos`)),
        progressBar(d.gl - rank.from, (rank.next ?? rank.from + 1) - rank.from, 'gold'),
        h('div', { class: 'lc-s' }, rank.next ? `Faltam ${fmt(rank.next - d.gl)} para a próxima patente` : 'Patente máxima')),
      h('div', { class: 'lc-card' },
        h('div', { class: 'lc-k' }, 'Maestria'),
        h('div', { class: 'lc-v' }, `Nível ${m.lv}`, h('small', {}, atMax ? ` · ${this.masteryFree(d)} ponto${this.masteryFree(d) === 1 ? '' : 's'} livre${this.masteryFree(d) === 1 ? '' : 's'}` : ` · libera no nível ${MAX_LEVEL}`)),
        progressBar(m.xp, m.next, 'blue'),
        h('div', { class: 'lc-s' }, atMax ? `${fmt(m.xp)} / ${fmt(m.next)} de XP de maestria` : 'No nível máximo todo o XP vira maestria.')),
      h('div', { class: 'lc-card' }, h('div', { class: 'lc-k' }, 'Título'), titleSel,
        h('div', { class: 'lc-s' }, `${d.ti.length} título${d.ti.length === 1 ? '' : 's'} conquistado${d.ti.length === 1 ? '' : 's'}`))));
    const tabs = [['feitos', 'Feitos'], ['maestria', 'Maestria'], ['bestiario', 'Bestiário'], ['desafios', 'Desafios']];
    body.appendChild(h('div', { class: 'tabs' }, ...tabs.map(([id, n]) => h('button', { class: 'tab' + (tab === id ? ' on' : ''), onclick: () => { this.legTab = id; this.drawLegacy(); } },
      n, id === 'maestria' && atMax && this.masteryFree(d) > 0 ? ' ●' : '', id === 'desafios' && this.claimable(d) ? ' ●' : ''))));
    const pane = h('div', { class: 'lc-pane' });
    body.appendChild(pane);
    ({ feitos: this.legFeitos, maestria: this.legMaestria, bestiario: this.legBestiario, desafios: this.legDesafios })[tab].call(this, pane, d);
  },

  masteryFree(d) { return d.ma.lv - masterySpent(d.ma.ranks); },
  claimable(d) { return ['d', 'w'].some((k) => d.ch[k].list.some((c) => !c.done && c.got >= c.target)); },

  // valor de um contador do jogador para mostrar o andamento
  legValue(d, key) {
    if (key.startsWith('bst:')) return d.bs[key.slice(4)] || 0;
    return d.cv[key] ?? 0;
  },

  // ---------------------------------------------------------------- feitos
  legFeitos(pane, d) {
    const done = new Set(d.ac);
    const cat = this.legCat || 'all';
    pane.appendChild(h('div', { class: 'lc-chips' },
      h('button', { class: 'lc-chip' + (cat === 'all' ? ' on' : ''), onclick: () => { this.legCat = 'all'; this.drawLegacy(); } }, `Todos ${done.size}/${ACHIEVEMENTS.length}`),
      ...Object.entries(ACH_CATS).map(([id, name]) => {
        const list = ACHIEVEMENTS.filter((a) => a.cat === id);
        return h('button', { class: 'lc-chip' + (cat === id ? ' on' : ''), onclick: () => { this.legCat = id; this.drawLegacy(); } }, `${name} ${list.filter((a) => done.has(a.id)).length}/${list.length}`);
      })));
    const list = ACHIEVEMENTS.filter((a) => cat === 'all' || a.cat === cat);
    // o que está perto de sair aparece primeiro; os já conquistados vão para o fim
    const rows = [...list].sort((a, b) => {
      const da = done.has(a.id), db = done.has(b.id);
      if (da !== db) return da ? 1 : -1;
      return (this.legValue(d, b.counter) / b.goal) - (this.legValue(d, a.counter) / a.goal);
    });
    for (const a of rows) {
      const v = Math.min(a.goal, this.legValue(d, a.counter)), ok = done.has(a.id);
      const tier = Math.min(TIER_COLORS.length - 1, Math.max(0, Math.floor(Math.log10(Math.max(1, a.pts)) * 2.3) - 1));
      pane.appendChild(h('div', { class: 'ach-row' + (ok ? ' done' : '') },
        h('div', { class: 'ach-medal', style: { background: ok ? TIER_COLORS[tier] : '#2a2f3a' } }, ok ? '✓' : '·'),
        h('div', { class: 'ach-main' },
          h('div', { class: 'ach-name' }, a.name, a.title ? h('small', { class: 'gold' }, `  título: ${a.title}`) : null),
          h('div', { class: 'ach-desc' }, a.desc),
          ok ? null : h('div', { class: 'ach-prog' }, progressBar(v, a.goal), h('span', {}, `${fmt(v)} / ${fmt(a.goal)}`))),
        h('div', { class: 'ach-rw' }, h('b', {}, `+${a.pts}`), h('small', {}, 'Glória'), a.gold ? h('small', {}, `${fmt(a.gold)} ouro`) : null)));
    }
  },

  // ---------------------------------------------------------------- maestria
  legMaestria(pane, d) {
    const free = this.masteryFree(d), spent = masterySpent(d.ma.ranks), atMax = this.me.level >= MAX_LEVEL;
    pane.appendChild(h('div', { class: 'lc-note' }, atMax
      ? `Todo o XP que passa do nível ${MAX_LEVEL} vira maestria. Cada nível de maestria dá 1 ponto: gaste nos atributos abaixo (as melhorias valem para sempre).`
      : `A maestria libera no nível ${MAX_LEVEL}: depois dele todo o XP que você ganhar vira níveis de maestria, sem limite.`));
    pane.appendChild(h('div', { class: 'lc-pts' }, h('b', {}, free), ' ponto', free === 1 ? '' : 's', ' livre', free === 1 ? '' : 's', h('small', { class: 'muted' }, `  ·  ${spent} gasto${spent === 1 ? '' : 's'}`)));
    for (const k of MASTERY_KEYS) {
      const st = MASTERY_STATS[k], rk = d.ma.ranks[k] || 0;
      const bonus = rk * st.per;
      const val = st.fmt === 'pct' ? `+${pct(bonus)}` : `+${(bonus).toFixed(2).replace('.', ',')}`;
      const btn = (n) => h('button', { class: 'btn tiny', disabled: free < 1 || rk >= st.max ? true : null, onclick: () => { audio.play('click'); this.send({ t: 'ma', op: 'rank', k, n }); } }, `+${n}`);
      pane.appendChild(h('div', { class: 'ma-row' },
        h('div', { class: 'ma-main' }, h('div', { class: 'ma-name' }, st.name, h('small', { class: 'muted' }, `  ${rk}/${st.max}`)), h('div', { class: 'ach-desc' }, st.desc), progressBar(rk, st.max, 'blue')),
        h('div', { class: 'ma-val' }, val),
        h('div', { class: 'ma-btns' }, btn(1), btn(5))));
    }
    pane.appendChild(h('div', { class: 'row' },
      h('button', { class: 'btn small ghost', disabled: spent ? null : true, onclick: () => this.confirm(`Redistribuir todos os <b>${spent}</b> pontos de maestria? Custa <b>${fmt(respecCost(spent))}</b> de ouro.`, () => this.send({ t: 'ma', op: 'reset' }), { yes: 'Redistribuir' }) },
        `Redistribuir pontos (${fmt(respecCost(spent))} ouro)`)));
  },

  // ---------------------------------------------------------------- bestiário
  legBestiario(pane, d) {
    const studied = BESTIARY_LIST.filter((id) => (d.bs[id] || 0) >= SPECIES_STUDIED).length;
    pane.appendChild(h('div', { class: 'lc-note' }, `Quanto mais você caça uma espécie, mais conhece suas fraquezas: ${BESTIARY_STEPS.map((n) => fmt(n)).join(', ')} abates dão degraus de dano extra contra ela (até +15%). Estudadas: ${studied}/${BESTIARY_LIST.length}.`));
    const grid = h('div', { class: 'be-grid' });
    const list = BESTIARY_LIST.map((id) => MONSTERS[id]).sort((a, b) => a.lvl[0] - b.lvl[0] || a.name.localeCompare(b.name));
    for (const mon of list) {
      const k = d.bs[mon.id] || 0, rk = bestiaryRank(k), next = BESTIARY_STEPS[rk];
      grid.appendChild(h('div', { class: 'be-card' + (k ? '' : ' unknown') + (mon.boss ? ' boss' : '') },
        h('div', { class: 'be-name' }, k ? mon.name : '???', mon.boss ? h('small', { class: 'gold' }, ' ☠ chefe') : null),
        h('div', { class: 'ach-desc' }, k ? `Nível ${mon.lvl[0]}–${mon.lvl[1]}` : 'Ainda não enfrentado'),
        k ? progressBar(k, next || BESTIARY_STEPS[BESTIARY_STEPS.length - 1], rk >= BESTIARY_STEPS.length ? 'gold' : '') : null,
        h('div', { class: 'be-meta' }, h('span', {}, `${fmt(k)} abate${k === 1 ? '' : 's'}${next ? ` · próximo: ${fmt(next)}` : ' · completo'}`), h('b', { class: 'up' }, rk ? `+${pct(bestiaryBonus(k), 0)} dano` : ''))));
    }
    pane.appendChild(grid);
  },

  // ---------------------------------------------------------------- desafios
  legDesafios(pane, d) {
    const block = (kind, title, sub) => {
      const c = d.ch[kind];
      pane.appendChild(h('div', { class: 'ql-sub' }, title, h('small', { class: 'muted' }, `   ${sub} · reinicia em ${timeLeft(c.ends - Date.now())}`)));
      c.list.forEach((x, i) => {
        const ready = !x.done && x.got >= x.target;
        pane.appendChild(h('div', { class: 'ch-row' + (x.done ? ' done' : '') + (ready ? ' ready' : '') },
          h('div', { class: 'ch-main' }, h('div', { class: 'ach-name' }, x.text), h('div', { class: 'ach-prog' }, progressBar(x.got, x.target, ready || x.done ? 'gold' : ''), h('span', {}, `${fmt(x.got)} / ${fmt(x.target)}`)),
            h('div', { class: 'ach-desc' }, `Recompensa: ${fmt(x.rw.gold)} de ouro, +${x.rw.pts} Glória e ${this.me.level >= MAX_LEVEL ? `${fmt(Math.round(x.rw.mxp))} de XP de maestria` : 'experiência'}`)),
          h('button', { class: 'btn small', disabled: ready ? null : true, onclick: () => { audio.play('click'); this.send({ t: 'chal', p: kind, i }); } }, x.done ? 'Recebido' : ready ? 'Receber' : 'Em andamento')));
      });
    };
    block('d', 'Desafios do dia', '3 por dia');
    block('w', 'Desafios da semana', '2 por semana, com recompensa maior');
    pane.appendChild(h('div', { class: 'lc-note' }, 'Os desafios contam o que você faz a partir do momento em que a lista aparece. Volte todo dia: eles trocam sozinhos.'));
  },

  // avisos
  achievementUnlocked(id) {
    const a = ACHIEVEMENTS.find((x) => x.id === id);
    if (!a) return;
    this.showBanner('Feito conquistado', a.name, 'altar');
    if (this.wins.legacy && this.wins.legacy.isOpen) this.send({ t: 'leg' });
  },
  masteryUp(lv) { this.showBanner(`Maestria ${lv}`, 'Você ganhou um ponto de maestria (tecla N)', 'level'); },
};

