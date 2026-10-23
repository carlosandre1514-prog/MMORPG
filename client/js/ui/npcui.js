// Interação com NPCs: diálogo e missões, loja, criação, aprimoramento, baú e viagem.
import { QUESTS } from '/shared/data/quests.js';
import { ITEMS, isEquipment } from '/shared/data/items.js';
import { RECIPES, recipesFor } from '/shared/data/recipes.js';
import { ZONES, ZONE_ORDER } from '/shared/data/zones.js';
import { KINGDOMS } from '/shared/data/kingdoms.js';
import { EQUIP_SLOTS, SLOT_NAMES, NPC_RANGE, RARITY } from '/shared/constants.js';
import { itemName, itemStats, rarityColor, sellPrice } from '/shared/itemgen.js';
import { enhanceChance, enhanceCost, MAX_PLUS } from '/shared/formulas.js';
import { h, clear, esc, fmt } from './dom.js';
import { slotEl } from './itemview.js';
import { drawNpc, itemIcon } from '../sprites.js';
import { canAccept, almostAvailable, isComplete, progress, need, countItem } from '../questlogic.js';
import { objText, rewardsEl, fill } from './windows.js';
import { audio } from '../audio.js';
import { charSprites, NPC_SPRITES } from '../charsprites.js';

export const npcMixin = {
  buildNpcWindows(W) {
    W('npc', 'Diálogo', { w: 470, pos: { x: 14, y: 110 }, onClose: () => { this.npcOpen = null; this.game.dialogNpc = null; } });
    const svcPos = () => ({ x: Math.min(500, Math.max(10, window.innerWidth - 850)), y: 100 });
    W('shop', 'Loja', { w: 420, pos: svcPos });
    W('craft', 'Criação', { w: 480, pos: svcPos });
    W('enhance', 'Aprimoramento', { w: 460, pos: svcPos });
    W('stash', 'Baú', { w: 380, pos: svcPos });
    W('teleport', 'Pedra do Caminho', { w: 340, pos: svcPos });
    // fecha diálogos ao se afastar
    if (this.npcTimer) return;
    this.npcTimer = setInterval(() => {
      if (!this.npcOpen || !this.game) return;
      const n = this.npcOpen;
      if (!this.game.zone || n.zone !== this.game.zone.id || Math.hypot(this.me.x - n.x, this.me.y - n.y) > NPC_RANGE + 2.5) this.closeNpcWindows();
    }, 400);
  },

  closeNpcWindows() {
    for (const id of ['npc', 'shop', 'craft', 'enhance', 'stash', 'teleport']) this.wins[id]?.close();
    this.npcOpen = null;
  },

  openNpc(npc) {
    audio.play('click');
    this.closeNpcWindows();
    this.npcOpen = npc;
    this.npcView = { mode: 'main' };
    this.talkIdx = 0;
    this.renderNpc();
    this.wins.npc.open();
    // atalhos diretos
    if (npc.services.includes('stash')) this.openService('stash');
  },

  npcHeader(npc) {
    const cv = h('canvas', { width: 128, height: 128, class: 'npc-portrait' });
    const ctx = cv.getContext('2d');
    const g = ctx.createRadialGradient(64, 54, 6, 64, 64, 80);
    g.addColorStop(0, '#3b4b66'); g.addColorStop(1, '#121620');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
    if (charSprites.has(NPC_SPRITES[npc.id])) {
      ctx.drawImage(charSprites.portrait(NPC_SPRITES[npc.id], 128, 0, 2.6), 0, 30);
      return h('div', { class: 'npc-head' }, cv, h('div', {}, h('div', { class: 'npc-name' }, npc.name), npc.title ? h('div', { class: 'npc-title' }, npc.title) : null));
    }
    const big = npc.look.type === 'board' || npc.look.type === 'altar' || npc.look.type === 'lore';
    ctx.setTransform(big ? 2.6 : 3, 0, 0, big ? 2.6 : 3, 64, big ? 118 : 150);
    drawNpc(ctx, 0, 0, npc, performance.now() / 1000, { lit: npc.id === 'altar' && this.game.questDone('ms19') });
    return h('div', { class: 'npc-head' }, cv, h('div', {}, h('div', { class: 'npc-name' }, npc.name), npc.title ? h('div', { class: 'npc-title' }, npc.title) : null));
  },

  renderNpc() {
    const npc = this.npcOpen;
    if (!npc) return;
    const me = this.me;
    const body = clear(this.wins.npc.body);
    this.wins.npc.setTitle(npc.name);
    body.appendChild(this.npcHeader(npc));
    const v = this.npcView;
    const opts = h('div', { class: 'npc-opts' });
    const opt = (label, fn, cls = '') => opts.appendChild(h('div', { class: 'npc-opt ' + cls, onclick: () => { audio.play('click'); fn(); } }, label));
    const back = () => { this.npcView = { mode: 'main' }; this.renderNpc(); };

    if (v.mode === 'main') {
      body.appendChild(h('div', { class: 'npc-text' }, fill(npc.greeting, me)));
      const qs = Object.values(QUESTS);
      for (const q of qs) if (q.turnIn === npc.id && me.quests.active[q.id] && isComplete(me, q)) opt(`✔ ${q.name}`, () => { this.npcView = { mode: 'turnin', q: q.id }; this.renderNpc(); }, 'q-done');
      for (const q of qs) if (q.giver === npc.id && canAccept(me, q)) opt(`${q.repeatable ? '↻' : '!'} ${q.name}${q.main || q.saga ? '  ★' : ''}`, () => { this.npcView = { mode: 'offer', q: q.id }; this.renderNpc(); }, q.repeatable ? 'q-rep' : 'q-new');
      for (const q of qs) if (q.turnIn === npc.id && me.quests.active[q.id] && !isComplete(me, q)) opt(`… ${q.name} (em andamento)`, () => { this.npcView = { mode: 'progress', q: q.id }; this.renderNpc(); }, 'q-prog');
      for (const q of qs) if (q.giver === npc.id && almostAvailable(me, q)) opts.appendChild(h('div', { class: 'npc-opt disabled' }, `🔒 ${q.name} (requer nível ${q.lvl})`));
      const S = npc.services;
      if (S.includes('shop')) opt('🛒 Comprar e vender', () => this.openService('shop'), 'svc');
      if (S.includes('craft')) opt(npc.craft === 'smith' ? '⚒ Forjar' : '⚗ Alquimia', () => this.openService('craft'), 'svc');
      if (S.includes('enhance')) opt('✦ Aprimorar equipamento', () => this.openService('enhance'), 'svc');
      if (S.includes('stash')) opt('🗝 Abrir baú', () => this.openService('stash'), 'svc');
      if (S.includes('teleport')) opt('🌀 Viajar', () => this.openService('teleport'), 'svc');
      if (S.includes('ranking')) opt('🏆 Quadro de Honra', () => this.openWin('ranking'), 'svc');
      if (npc.talk && npc.talk.length) opt(S.includes('lore') ? '📖 Ler inscrições' : '💬 Conversar', () => { this.npcView = { mode: 'talk' }; this.talkIdx = 0; this.renderNpc(); });
      opt('Até logo.', () => this.closeNpcWindows(), 'bye');
    } else if (v.mode === 'talk') {
      const line = npc.talk[this.talkIdx % npc.talk.length];
      body.appendChild(h('div', { class: 'npc-text' }, fill(line, me)));
      if (this.talkIdx < npc.talk.length - 1) opt('Continue...', () => { this.talkIdx++; this.renderNpc(); });
      opt('Voltar', back, 'bye');
    } else {
      const q = QUESTS[v.q];
      body.appendChild(h('div', { class: 'npc-qtitle' }, q.name, q.act ? h('small', {}, `  ${q.act}`) : null));
      if (v.mode === 'offer') {
        body.append(h('div', { class: 'npc-text' }, fill(q.offer, me)),
          h('div', { class: 'ql-sub' }, 'Objetivos'),
          ...q.objectives.map((o) => h('div', { class: 'ql-obj' }, `◦ ${objText(o)}${o.type === 'talk' ? '' : ` (${need(o)})`}`)),
          h('div', { class: 'ql-sub' }, 'Recompensas'), rewardsEl(q.rewards));
        opt('Aceitar missão', () => { this.send({ t: 'qa', q: q.id }); this.npcView = { mode: 'main' }; setTimeout(() => this.renderNpc(), 150); }, 'q-new');
        opt('Agora não.', back, 'bye');
      } else if (v.mode === 'progress') {
        body.append(h('div', { class: 'npc-text' }, fill(q.progress, me)),
          ...q.objectives.map((o, i) => { const p = progress(me, q, i), n = need(o); return h('div', { class: 'ql-obj' + (p >= n ? ' ok' : '') }, `${p >= n ? '✔' : '◦'} ${objText(o)}${o.type === 'talk' ? '' : `: ${p}/${n}`}`); }));
        opt('Voltar', back, 'bye');
      } else if (v.mode === 'turnin') {
        body.append(h('div', { class: 'npc-text' }, fill(q.complete, me)), h('div', { class: 'ql-sub' }, 'Recompensas'), rewardsEl(q.rewards));
        opt('Concluir missão', () => { this.send({ t: 'qc', q: q.id }); this.npcView = { mode: 'main' }; setTimeout(() => this.renderNpc(), 200); }, 'q-done');
        opt('Voltar', back, 'bye');
      }
    }
    body.appendChild(opts);
  },

  openService(id) {
    const w = this.wins[id];
    const npc = this.npcOpen;
    if (!w || !npc) return;
    for (const o of ['shop', 'craft', 'enhance', 'stash', 'teleport']) if (o !== id) this.wins[o]?.close();
    if (id === 'stash') this.send({ t: 'stash', op: 'open', n: npc.id });
    const render = this['render' + id[0].toUpperCase() + id.slice(1)];
    render.call(this);
    w.open();
    if (id === 'shop' || id === 'stash' || id === 'enhance' || id === 'craft') {
      this.openWin('inventory');
    }
  },

  // ================================================================ loja
  renderShop() {
    const npc = this.npcOpen;
    if (!npc || !npc.shop) return;
    const w = this.wins.shop;
    w.setTitle(`Loja — ${npc.name}`);
    const body = clear(w.body);
    const me = this.me;
    const list = h('div', { class: 'shop-list' });
    for (const id of npc.shop) {
      const base = ITEMS[id];
      const item = { id, q: 1, r: 0 };
      const qty = base.stack ? h('input', { class: 'inp qty', type: 'number', min: '1', max: '99', value: '1' }) : null;
      if (qty) qty.addEventListener('keydown', (e) => e.stopPropagation());
      const afford = me.gold >= base.price;
      list.appendChild(h('div', { class: 'shop-row' },
        slotEl(item, { me, price: base.price }),
        h('div', { class: 'shop-info' },
          h('div', { style: { color: rarityColor(item) } }, base.name),
          h('div', { class: 'small ' + (base.lvl > me.level ? 'bad' : 'muted') }, base.lvl > 1 ? `Nível ${base.lvl}` : base.desc || '')),
        h('span', { class: 'gold ' + (afford ? '' : 'bad') }, fmt(base.price)),
        qty,
        h('button', { class: 'btn tiny', onclick: () => this.send({ t: 'buy', n: npc.id, i: id, q: qty ? parseInt(qty.value, 10) || 1 : 1 }) }, 'Comprar')));
    }
    const junk = me.inv.map((it, i) => ({ it, i })).filter(({ it }) => it && isEquipment(ITEMS[it.id]) && !(it.r > 0) && !it.p);
    body.append(list, h('div', { class: 'muted small' }, 'Para vender: clique com o botão direito em um item do inventário.'));
    if (junk.length) body.append(h('button', {
        class: 'btn ghost small', onclick: () => this.confirm(`Vender ${junk.length} equipamento(s) comum(ns) por ${junk.reduce((a, { it }) => a + sellPrice(it), 0)} ouro?`, () => {
          for (const { i } of junk) this.send({ t: 'sell', slot: i, n: npc.id });
        }, { yes: 'Vender' }),
      }, `Vender equipamentos comuns (${junk.length})`));
  },

  // ================================================================ criação
  renderCraft() {
    const npc = this.npcOpen;
    if (!npc || !npc.craft) return;
    const w = this.wins.craft;
    w.setTitle(npc.craft === 'smith' ? `Forja — ${npc.name}` : `Alquimia — ${npc.name}`);
    const body = clear(w.body);
    const me = this.me;
    for (const r of recipesFor(npc.craft)) {
      const okLvl = me.level >= r.lvl;
      let ok = okLvl && me.gold >= r.gold;
      const mats = h('div', { class: 'mats' });
      for (const [id, n] of r.mats) {
        const have = countItem(me.inv, id);
        if (have < n) ok = false;
        const m = h('span', { class: 'mat ' + (have >= n ? 'ok' : 'bad'), 'data-tip': `<b>${esc(ITEMS[id].name)}</b><div class="tt-desc">${esc(ITEMS[id].desc || '')}</div>` }, h('img', { src: itemIcon(id, 18) }), `${have}/${n}`);
        mats.appendChild(m);
      }
      mats.appendChild(h('span', { class: 'mat ' + (me.gold >= r.gold ? 'ok' : 'bad') }, h('span', { class: 'gold' }, '● '), String(r.gold)));
      let resultEl;
      if (r.result.id) resultEl = slotEl({ id: r.result.id, q: r.result.qty, r: 0 }, { me, compare: false });
      else {
        resultEl = h('div', { class: 'slot gear-result', 'data-tip': `<b>${esc(r.name)}</b><div class="tt-desc">Cria um equipamento aleatório de nível ${[0, 1, 5, 10, 15, 20, 25][r.result.tier] || ''} com raridade mínima ${RARITY[r.result.minRarity].name}${r.result.gear === 'weapon' ? ' (arma da sua classe)' : ''}.</div>` }, '?');
        resultEl.style.borderColor = RARITY[r.result.minRarity].color;
      }
      body.appendChild(h('div', { class: 'craft-row' + (okLvl ? '' : ' locked') },
        resultEl,
        h('div', { class: 'craft-info' }, h('div', {}, r.name, okLvl ? null : h('small', { class: 'bad' }, `  (nível ${r.lvl})`)), mats),
        h('button', { class: 'btn tiny', disabled: ok ? null : true, onclick: () => this.send({ t: 'craft', n: npc.id, r: r.id }) }, 'Criar')));
    }
  },

  // ================================================================ aprimoramento
  renderEnhance() {
    const npc = this.npcOpen;
    if (!npc) return;
    const body = clear(this.wins.enhance.body);
    const me = this.me;
    const list = h('div', { class: 'inv-grid enh-list' });
    const entries = [];
    for (const s of EQUIP_SLOTS) if (me.equip[s]) entries.push({ src: 'eq', slot: s, it: me.equip[s] });
    me.inv.forEach((it, i) => { if (it && isEquipment(ITEMS[it.id])) entries.push({ src: 'inv', slot: i, it }); });
    const sel = this.enhSel && entries.find((e) => e.it.u === this.enhSel) || entries[0];
    for (const e of entries) {
      const el = slotEl(e.it, { me, compare: false, cls: e === sel ? 'sel' : '' });
      if (e.src === 'eq') el.appendChild(h('span', { class: 'slot-eq' }, 'E'));
      el.addEventListener('click', () => { this.enhSel = e.it.u; this.renderEnhance(); });
      list.appendChild(el);
    }
    body.appendChild(h('div', { class: 'muted small' }, 'Escolha um equipamento (E = equipado):'));
    body.appendChild(list);
    if (!sel) { body.appendChild(h('div', { class: 'muted' }, 'Você não tem equipamentos.')); return; }
    const it = sel.it;
    const p = it.p || 0;
    const det = h('div', { class: 'enh-detail' });
    det.appendChild(h('div', { class: 'enh-name', style: { color: rarityColor(it) } }, itemName(it)));
    if (p >= MAX_PLUS) {
      det.appendChild(h('div', { class: 'gold' }, 'Aprimoramento máximo alcançado!'));
    } else {
      const cost = enhanceCost(it);
      const chance = enhanceChance(p);
      const cur = itemStats(it), next = itemStats({ ...it, p: p + 1 });
      const stones = countItem(me.inv, 'enh_stone');
      const lines = [];
      if (cur.dmg) lines.push(`Dano: ${cur.dmg} → <b class="up">${next.dmg}</b>`);
      if (cur.def) lines.push(`Armadura: ${cur.def} → <b class="up">${next.def}</b>`);
      for (const k of Object.keys(next)) if (k !== 'dmg' && k !== 'def' && next[k] !== cur[k]) lines.push(`${k.toUpperCase()}: ${cur[k] || 0} → <b class="up">${next[k]}</b>`);
      det.append(
        h('div', { class: 'enh-arrow' }, `+${p}  ➜  +${p + 1}`),
        h('div', { class: 'small', html: lines.join('<br>') }),
        h('div', { class: 'enh-chance ' + (chance >= 0.8 ? 'ok' : chance >= 0.5 ? 'mid' : 'bad') }, `Chance de sucesso: ${Math.round(chance * 100)}%`),
        h('div', {}, h('span', { class: (me.gold >= cost.gold ? '' : 'bad') }, `Custo: ${fmt(cost.gold)} ouro`), ' · ',
          h('span', { class: stones >= cost.stones ? '' : 'bad' }, h('img', { src: itemIcon('enh_stone', 16), style: { verticalAlign: 'middle' } }), ` ${stones}/${cost.stones} pedra(s)`)),
        p >= 5 ? h('div', { class: 'bad small' }, '⚠ Em caso de falha, o item perde 1 nível de aprimoramento.') : h('div', { class: 'muted small' }, 'Falhas abaixo de +5 não causam perda.'),
        h('button', { class: 'btn', disabled: me.gold >= cost.gold && stones >= cost.stones ? null : true, onclick: () => this.send({ t: 'enh', n: npc.id, src: sel.src, slot: sel.slot }) }, 'Aprimorar'));
    }
    body.appendChild(det);
    body.appendChild(h('div', { class: 'muted small' }, 'Pedras de Aprimoramento: compre com Brunhilda, forje com materiais ou obtenha de chefes.'));
  },

  onEnhanceResult(m) {
    if (m.ok) this.toast(`Sucesso! ${m.n}`, 'good');
    else this.toast(m.down ? `Falhou... o item caiu para +${m.p}.` : 'Falhou! Nada foi perdido além dos materiais.', 'err');
    this.renderEnhance();
  },

  // ================================================================ baú
  renderStash() {
    const npc = this.npcOpen;
    const body = clear(this.wins.stash.body);
    const me = this.me;
    const grid = h('div', { class: 'inv-grid stash' });
    (me.stash || []).forEach((it, i) => {
      const el = slotEl(it, { me, hint: 'Clique para retirar' });
      el.setAttribute('draggable', it ? 'true' : 'false');
      el.addEventListener('dragstart', (e) => e.dataTransfer.setData('text/plain', 'stash:' + i));
      el.addEventListener('dragover', (e) => e.preventDefault());
      el.addEventListener('drop', (e) => {
        e.preventDefault();
        const d = e.dataTransfer.getData('text/plain');
        if (d.startsWith('inv:') && npc) this.send({ t: 'stash', op: 'put', slot: Number(d.slice(4)), n: npc.id });
      });
      if (it && npc) el.addEventListener('click', () => this.send({ t: 'stash', op: 'take', slot: i, n: npc.id }));
      grid.appendChild(el);
    });
    body.append(grid, h('div', { class: 'muted small' }, 'Clique para retirar. Botão direito no inventário para guardar.'));
  },

  // ================================================================ viagem
  renderTeleport() {
    const npc = this.npcOpen;
    const body = clear(this.wins.teleport.body);
    const me = this.me;
    const here = this.game.zone.def.kingdom;
    body.appendChild(h('div', { class: 'muted small' }, `Destinos descobertos no ${KINGDOMS[here].name}:`));
    for (const id of ZONE_ORDER) {
      const z = ZONES[id];
      if (z.kingdom !== here) continue; // as pedras só levam a lugares do mesmo reino: a fronteira se atravessa a pé
      const known = me.visited.includes(id);
      const atZone = this.game.zone.id === id;
      body.appendChild(h('div', { class: 'tp-row' + (known ? '' : ' unknown') },
        h('div', {}, h('b', {}, known ? z.name : '??? (não descoberto)'), h('div', { class: 'small muted' }, z.levels)),
        known && !atZone ? h('button', { class: 'btn tiny', onclick: () => { this.send({ t: 'tp', n: npc.id, z: id }); this.closeNpcWindows(); } }, 'Viajar') : atZone ? h('small', { class: 'muted' }, 'você está aqui') : null));
    }
  },
};
