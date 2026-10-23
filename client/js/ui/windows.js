// Janelas do jogo: inventário, personagem, habilidades, missões, mapa, social, clã, ranking, ajuda e opções.
import { CLASSES } from '/shared/data/classes.js';
import { SKILLS } from '/shared/data/skills.js';
import { ITEMS, isEquipment } from '/shared/data/items.js';
import { QUESTS } from '/shared/data/quests.js';
import { NPCS } from '/shared/data/npcs.js';
import { ZONES, ZONE_ORDER } from '/shared/data/zones.js';
import { KINGDOMS, KINGDOM_ORDER } from '/shared/data/kingdoms.js';
import { MONSTERS } from '/shared/data/monsters.js';
import { EQUIP_SLOTS, SLOT_NAMES, STAT_NAMES, GUILD_COST, TILE } from '/shared/constants.js';
import { itemName, sellPrice } from '/shared/itemgen.js';
import { h, clear, esc, Win, fmt } from './dom.js';
import { slotEl } from './itemview.js';
import { skillIcon, drawHumanoid, playerLook } from '../sprites.js';
import { audio } from '../audio.js';
import { themeMusic } from '../music.js';
import { touchUiMode } from '../device.js';
import { graphicsPanel } from './gfxpanel.js';
import { charSprites } from '../charsprites.js';
import { progress, need, isComplete } from '../questlogic.js';

const SLOT_ICONS = { weapon: '⚔', head: '⛑', chest: '👕', legs: '👖', feet: '👢', ring: '💍', amulet: '📿' };

export const windowsMixin = {
  buildWindows() {
    const R = this.root;
    const W = (id, title, opts) => (this.wins[id] = new Win(R, id, title, opts));
    W('inventory', 'Inventário', { w: 330, pos: () => ({ x: Math.max(10, window.innerWidth - 350), y: Math.min(250, Math.max(10, window.innerHeight - 470)) }) });
    W('character', 'Personagem', { w: 520 });
    W('skills', 'Habilidades', { w: 470 });
    W('quests', 'Diário de Missões', { w: 640 });
    W('map', 'Mapa', { w: 740 });
    W('social', 'Grupo', { w: 340 });
    W('guild', 'Clã', { w: 360 });
    W('ranking', 'Quadro de Honra', { w: 420 });
    W('help', 'Ajuda — Como Jogar', { w: 600 });
    W('options', 'Opções', { w: 380 });
    W('trade', 'Comércio', { w: 520, onClose: () => { if (this.game.trade) this.send({ t: 'trade', op: 'cancel' }); } });
    this.buildNpcWindows(W);
  },

  // ================================================================ inventário
  renderInventory() {
    const me = this.me;
    const body = clear(this.wins.inventory.body);
    const grid = h('div', { class: 'inv-grid' });
    me.inv.forEach((it, i) => {
      const hint = this.inventoryHint();
      const el = slotEl(it, { me, hint });
      el.dataset.slot = i;
      el.setAttribute('draggable', it ? 'true' : 'false');
      el.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', 'inv:' + i); });
      el.addEventListener('dragover', (e) => e.preventDefault());
      el.addEventListener('drop', (e) => {
        e.preventDefault();
        const d = e.dataTransfer.getData('text/plain');
        if (d.startsWith('inv:')) this.send({ t: 'mvi', a: Number(d.slice(4)), b: i });
        else if (d.startsWith('eq:')) this.send({ t: 'uneq', s: d.slice(3) });
        else if (d.startsWith('stash:')) this.send({ t: 'stash', op: 'take', slot: Number(d.slice(6)), n: this.npcOpen?.id });
      });
      if (it) {
        el.addEventListener('contextmenu', (e) => { e.preventDefault(); this.quickItem(i); });
        el.addEventListener('click', (e) => this.itemMenu(i, e.clientX, e.clientY));
        el.addEventListener('dblclick', () => this.quickItem(i));
      }
      grid.appendChild(el);
    });
    body.append(grid,
      h('div', { class: 'inv-foot' },
        h('span', {}, h('span', { class: 'gold' }, '● '), `${fmt(me.gold)} ouro`),
        h('span', { class: 'muted' }, `${me.inv.filter(Boolean).length}/${me.inv.length}`)),
      h('div', { class: 'muted small' }, this.inventoryHint() || 'Clique: ações · Botão direito: usar/equipar · Arraste para reorganizar'));
  },

  inventoryHint() {
    if (this.game.trade) return 'Botão direito: oferecer no comércio';
    if (this.wins.shop?.isOpen) return 'Botão direito: vender';
    if (this.wins.stash?.isOpen) return 'Botão direito: guardar no baú';
    return null;
  },

  quickItem(i) {
    const it = this.me.inv[i];
    if (!it) return;
    const base = ITEMS[it.id];
    if (this.game.trade) { this.send({ t: 'trade', op: 'add', slot: i }); return; }
    if (this.wins.shop?.isOpen && this.npcOpen) { this.sellItem(i); return; }
    if (this.wins.stash?.isOpen && this.npcOpen) { this.send({ t: 'stash', op: 'put', slot: i, n: this.npcOpen.id }); return; }
    if (isEquipment(base)) this.send({ t: 'eq', slot: i });
    else if (base.type === 'consumable') this.send({ t: 'use', slot: i });
  },

  sellItem(i) {
    const it = this.me.inv[i];
    if (!it) return;
    const base = ITEMS[it.id];
    const price = sellPrice(it) * (it.q || 1);
    if (base.type === 'quest') { this.toast('Itens de missão não podem ser vendidos.', 'err'); return; }
    if ((it.r || 0) >= 2 || it.p > 0) {
      this.confirm(`Vender <b style="color:#fff">${esc(itemName(it))}</b> por <span class="gold">${price}</span> ouro?`, () => this.send({ t: 'sell', slot: i, n: this.npcOpen.id }), { yes: 'Vender' });
    } else this.send({ t: 'sell', slot: i, n: this.npcOpen.id });
  },

  itemMenu(i, x, y) {
    const it = this.me.inv[i];
    if (!it) return;
    const base = ITEMS[it.id];
    const items = [];
    if (isEquipment(base)) items.push(['Equipar', () => this.send({ t: 'eq', slot: i })]);
    if (base.type === 'consumable') items.push(['Usar', () => this.send({ t: 'use', slot: i })]);
    if (this.wins.shop?.isOpen && this.npcOpen && base.type !== 'quest') items.push([`Vender (${sellPrice(it) * (it.q || 1)} ouro)`, () => this.sellItem(i)]);
    if (this.wins.stash?.isOpen && this.npcOpen) items.push(['Guardar no baú', () => this.send({ t: 'stash', op: 'put', slot: i, n: this.npcOpen.id })]);
    if (this.game.trade && base.type !== 'quest') items.push(['Oferecer no comércio', () => this.send({ t: 'trade', op: 'add', slot: i })]);
    if (base.stack && it.q > 1) items.push(['Dividir pilha', () => this.confirm('Quantos itens separar?', (v) => this.send({ t: 'split', slot: i, n: parseInt(v, 10) || 1 }), { input: true, value: String(Math.floor(it.q / 2)), yes: 'Dividir' })]);
    items.push(['Descartar', () => this.confirm(`Destruir <b>${esc(itemName(it))}</b>${it.q > 1 ? ' x' + it.q : ''}? Esta ação não pode ser desfeita.`, () => this.send({ t: 'drop', slot: i }), { yes: 'Destruir' }), 'danger']);
    this.contextMenu(itemName(it), items, x, y);
  },

  // ================================================================ personagem
  renderCharacter() {
    const me = this.me;
    const st = me.stats;
    if (!st) return;
    const body = clear(this.wins.character.body);
    const cls = CLASSES[me.cls];
    // boneco com equipamentos
    const doll = h('div', { class: 'doll' });
    const cv = h('canvas', { width: 160, height: 200, class: 'doll-cv' });
    const ctx = cv.getContext('2d');
    const app = {};
    for (const [slot, it] of Object.entries(me.equip || {})) if (it) app[slot[0]] = it.id;
    if (charSprites.has(me.cls)) ctx.drawImage(charSprites.portrait(me.cls, 200, 0, 1.9), -20, -10);
    else {
      const look = playerLook({ cls: me.cls, sk: me.skin, hr: me.hair, app });
      ctx.setTransform(3.2, 0, 0, 3.2, 80, 185);
      drawHumanoid(ctx, 0, 0, { ...look, dir: 0 });
    }
    doll.appendChild(cv);
    for (const slot of EQUIP_SLOTS) {
      const it = me.equip[slot];
      const el = slotEl(it, { me, empty: SLOT_ICONS[slot], cls: 'eq-slot eq-' + slot, compare: false, hint: it ? 'Clique para remover' : null });
      el.title = SLOT_NAMES[slot];
      if (!it) el.dataset.tip = SLOT_NAMES[slot];
      el.setAttribute('draggable', it ? 'true' : 'false');
      el.addEventListener('dragstart', (e) => e.dataTransfer.setData('text/plain', 'eq:' + slot));
      el.addEventListener('dragover', (e) => e.preventDefault());
      el.addEventListener('drop', (e) => {
        e.preventDefault();
        const d = e.dataTransfer.getData('text/plain');
        if (d.startsWith('inv:')) this.send({ t: 'eq', slot: Number(d.slice(4)) });
      });
      if (it) el.addEventListener('click', () => this.send({ t: 'uneq', s: slot }));
      doll.appendChild(el);
    }
    // atributos
    const attrs = h('div', { class: 'attrs' });
    attrs.appendChild(h('div', { class: 'ch-title' }, `${me.name}`, h('small', {}, ` Nível ${me.level} ${cls.name}`)));
    if (me.title) attrs.appendChild(h('div', { class: 'ch-ptitle' }, `« ${me.title} »`));
    attrs.appendChild(h('div', { class: 'ch-points' + (me.points ? ' has' : '') }, `Pontos livres: ${me.points}`));
    const desc = {
      str: 'Aumenta o Poder do Guerreiro.', dex: 'Aumenta crítico, velocidade de ataque, esquiva e o Poder do Arqueiro.',
      int: 'Aumenta mana e o Poder do Mago e do Clérigo.', vit: 'Aumenta vida máxima, regeneração e defesa.',
    };
    for (const k of ['str', 'dex', 'int', 'vit']) {
      const primary = cls.primary === k;
      const row = h('div', { class: 'attr-row' + (primary ? ' primary' : '') },
        h('span', { class: 'attr-name', 'data-tip': esc(desc[k]) }, STAT_NAMES[k] + (primary ? ' ★' : '')),
        h('span', { class: 'attr-val' }, String(st[k])),
        me.points ? h('button', { class: 'btn tiny', title: 'Shift+clique: +5', onclick: (e) => this.send({ t: 'stat', s: k, n: e.shiftKey ? 5 : 1 }) }, '+') : null);
      attrs.appendChild(row);
    }
    if (me.points) {
      attrs.appendChild(h('button', {
        class: 'btn small', onclick: () => {
          const rec = cls.recommended;
          const keys = Object.keys(rec);
          let pts = me.points;
          const tot = Object.values(rec).reduce((a, b) => a + b, 0);
          for (const k of keys) {
            const n = k === keys[keys.length - 1] ? pts : Math.round((me.points * rec[k]) / tot);
            if (n > 0) this.send({ t: 'stat', s: k, n });
            pts -= n;
          }
        },
      }, 'Distribuir automaticamente'));
    }
    const der = [
      ['Vida', `${st.maxHp}`], ['Mana', `${st.maxMp}`], ['Poder', `${st.power}`], ['Defesa', `${st.def}`],
      ['Crítico', `${st.crit}%`], ['Vel. de ataque', `${st.haste}%`], ['Esquiva', `${st.dodge.toFixed(1)}%`],
      ['Roubo de vida', `${st.lifesteal}%`], ['Velocidade', `${st.speed.toFixed(2)}`], ['Regeneração', `${st.hpRegen.toFixed(1)}/s`],
    ];
    attrs.appendChild(h('div', { class: 'derived' }, ...der.map(([a, b]) => h('div', { class: 'drow' }, h('span', {}, a), h('b', {}, b)))));
    const brasas = [['brasa_vida', 'Brasa da Vida', '+10% Vida', '#58d68d'], ['brasa_terra', 'Brasa da Terra', '+10% Defesa', '#e67e22'], ['brasa_espirito', 'Brasa do Espírito', '+10% Poder', '#85c1e9']];
    attrs.appendChild(h('div', { class: 'brasas' }, ...brasas.map(([f, n, b, c]) => h('div', { class: 'brasa' + (me.flags[f] ? ' on' : ''), style: { color: me.flags[f] ? c : '' }, 'data-tip': `<b>${n}</b><br>${b}${me.flags[f] ? '' : '<br><i>Ainda não recuperada</i>'}` }, '🔥'))));
    const rec = me.record || {};
    attrs.appendChild(h('div', { class: 'muted small' }, `Monstros: ${fmt(rec.kills || 0)} · Chefes: ${rec.bossKills || 0} · Arena: ${rec.pvpKills || 0} · Mortes: ${rec.deaths || 0}`));
    body.appendChild(h('div', { class: 'char-wrap' }, doll, attrs));
  },

  // ================================================================ habilidades
  renderSkills() {
    const me = this.me;
    const body = clear(this.wins.skills.body);
    const cls = CLASSES[me.cls];
    body.appendChild(h('div', { class: 'muted' }, `${cls.name} — ${cls.role}`));
    cls.skills.forEach((id, i) => {
      const sk = SKILLS[id];
      const locked = me.level < sk.lvl;
      body.appendChild(h('div', { class: 'skill-row' + (locked ? ' locked' : '') },
        h('img', { src: skillIcon(sk, 40) }),
        h('div', { class: 'skill-info' },
          h('div', { class: 'skill-name' }, `${i + 1}. ${sk.name}`, h('small', {}, locked ? `  Nível ${sk.lvl}` : '')),
          h('div', { class: 'skill-meta' }, `${sk.mp} mana · ${sk.cd}s recarga${sk.range ? ` · alcance ${sk.range}` : ''} · ${{ enemy: 'alvo inimigo', ally: 'aliado/você', self: 'você', ground: 'área no cursor', dir: 'direção do cursor' }[sk.target]}`),
          h('div', { class: 'skill-desc' }, sk.desc))));
    });
    body.appendChild(h('div', { class: 'muted small' }, 'Ataque básico: clique em um inimigo. Habilidades de área e de movimento miram na posição do mouse.'));
  },

  // ================================================================ missões
  renderQuests() {
    const me = this.me;
    const body = clear(this.wins.quests.body);
    const active = Object.keys(me.quests.active).map((id) => QUESTS[id]).filter(Boolean);
    const list = h('div', { class: 'ql-list' });
    const groups = [['Campanha principal', (q) => q.main], ['Reino de Sahaar', (q) => q.saga === 'sahaar'], ['Missões secundárias', (q) => !q.main && !q.saga && !q.repeatable], ['Contratos', (q) => q.repeatable]];
    if (!this.selectedQuest || !me.quests.active[this.selectedQuest]) this.selectedQuest = active[0]?.id || null;
    for (const [title, pred] of groups) {
      const qs = active.filter(pred);
      if (!qs.length) continue;
      list.appendChild(h('div', { class: 'ql-group' }, title));
      for (const q of qs) {
        const done = isComplete(me, q);
        list.appendChild(h('div', {
          class: 'ql-item' + (q.id === this.selectedQuest ? ' sel' : '') + (done ? ' done' : ''),
          onclick: () => { this.selectedQuest = q.id; this.renderQuests(); },
        }, `${done ? '✔ ' : ''}${q.name}`, h('small', {}, ` (${q.lvl})`)));
      }
    }
    if (!active.length) list.appendChild(h('div', { class: 'muted' }, 'Nenhuma missão ativa. Procure NPCs com "!" amarelo.'));
    const doneCount = Object.keys(me.quests.done).length;
    list.appendChild(h('div', { class: 'muted small ql-foot' }, `Concluídas: ${doneCount}`));
    const det = h('div', { class: 'ql-detail' });
    const q = QUESTS[this.selectedQuest];
    if (q) {
      det.append(
        h('div', { class: 'ql-title' }, q.name, q.act ? h('small', {}, `  ${q.act}`) : null),
        h('div', { class: 'ql-desc' }, q.desc),
        h('div', { class: 'ql-sub' }, 'Objetivos'),
        ...q.objectives.map((o, i) => {
          const p = progress(me, q, i), n = need(o);
          return h('div', { class: 'ql-obj' + (p >= n ? ' ok' : '') }, `${p >= n ? '✔' : '◦'} ${objText(o)}${o.type === 'talk' ? '' : `: ${p}/${n}`}`);
        }),
        h('div', { class: 'ql-sub' }, 'Entregar para'),
        h('div', {}, `${NPCS[q.turnIn].name} — ${ZONES[NPCS[q.turnIn].zone].name}`),
        h('div', { class: 'ql-sub' }, 'Recompensas'),
        rewardsEl(q.rewards, this.game.dev),
        h('div', { class: 'ql-story' }, fill(q.offer, me)),
        h('div', { class: 'row' },
          h('button', { class: 'btn small', onclick: () => { this.goToQuest(q.id); this.wins.quests.close(); } }, '📍 Ir até o local'),
          h('button', { class: 'btn ghost small', onclick: () => { this.game.guide.track(q.id, false); this.onGuide(); } }, 'Mostrar caminho')),
        h('div', { class: 'row' }, h('button', { class: 'btn ghost small', onclick: () => this.confirm(`Abandonar a missão <b>${esc(q.name)}</b>?`, () => this.send({ t: 'qx', q: q.id }), { yes: 'Abandonar' }) }, 'Abandonar')));
    }
    body.appendChild(h('div', { class: 'ql-wrap' }, list, det));
  },

  // ================================================================ mapa
  // Marcadores do mapa: portais, NPCs, áreas de caça, chefes, grupo e o jogador. P projeta (x, y) do mapa em px;
  // unit é o tamanho de um tile em px (raio das áreas de caça); W, a largura do canvas (alinhamento dos nomes).
  drawMapMarkers(ctx, P, unit, W, labels = null) {
    const g = this.game;
    const z = g.zone;
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';
    // nomes dos lugares (casas e prédios especiais) sobre o telhado
    if (labels) {
      ctx.font = 'bold 10px Georgia, serif';
      for (const st of z.structures) {
        if (st.kind !== 'house' || !st.label) continue;
        let [x, y] = P(st.x + st.w / 2, st.y + st.h / 2, (st.floors || 1) * 3 + 3);
        const half = ctx.measureText(st.label).width / 2 + 3;
        x = Math.max(half, Math.min(W - half, x)); // o nome nunca sai do mapa
        ctx.fillStyle = '#fdf2e9'; ctx.strokeStyle = 'rgba(30,18,10,0.95)'; ctx.lineWidth = 3;
        ctx.strokeText(st.label, x, y); ctx.fillText(st.label, x, y);
      }
      ctx.font = 'bold 10px sans-serif';
    }
    ctx.strokeStyle = '#000';
    for (const p of z.def.portals) {
      const [x, y] = P(p.x + p.w / 2, p.y + p.h / 2);
      ctx.fillStyle = '#5dade2'; ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#d6eaf8'; ctx.lineWidth = 3;
      const ty = y < 20 ? y + 16 : y - 8;
      ctx.textAlign = x > W - 70 ? 'right' : x < 70 ? 'left' : 'center';
      const tx = x > W - 70 ? x - 6 : x < 70 ? x + 6 : x;
      ctx.strokeText(p.label, tx, ty); ctx.fillText(p.label, tx, ty);
      ctx.textAlign = 'center';
    }
    for (const n of Object.values(NPCS)) {
      if (n.zone !== z.id) continue;
      const [x, y] = P(n.x, n.y);
      const mark = g.questMarker(n.id);
      ctx.fillStyle = n.services.includes('teleport') ? '#85c1e9' : '#f7dc6f';
      ctx.fillRect(x - 2.5, y - 2.5, 5, 5);
      ctx.strokeRect(x - 2.5, y - 2.5, 5, 5);
      if (mark) { ctx.fillStyle = mark.c; ctx.lineWidth = 3; ctx.strokeText(mark.s, x + 6, y - 2); ctx.fillText(mark.s, x + 6, y - 2); }
    }
    for (const s of z.def.spawns || []) {
      const d = MONSTERS[s.m];
      const [x, y] = P(s.x, s.y);
      ctx.lineWidth = 3;
      if (d.boss) {
        ctx.fillStyle = '#ff9a1f'; ctx.font = 'bold 14px sans-serif';
        ctx.strokeText('☠', x, y + 5); ctx.fillText('☠', x, y + 5);
        ctx.font = 'bold 10px sans-serif';
        ctx.strokeText(d.name, x, y - 9); ctx.fillText(d.name, x, y - 9);
      } else {
        ctx.fillStyle = 'rgba(231,76,60,0.25)'; ctx.beginPath(); ctx.arc(x, y, s.r * unit, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fadbd8';
        ctx.strokeText(`${d.name} ${d.lvl[0]}-${d.lvl[1]}`, x, y); ctx.fillText(`${d.name} ${d.lvl[0]}-${d.lvl[1]}`, x, y);
      }
    }
    if (g.party) for (const m of g.party.m) {
      if (m.id === g.me.id || m.z !== z.id) continue;
      const [x, y] = P(m.x, m.y);
      ctx.fillStyle = '#2ecc71'; ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
    }
    const [mx, my] = P(g.me.x, g.me.y);
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(mx, my, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // rota da missão
    const gd = g.guide;
    if (gd.active && gd.wp) {
      ctx.save();
      ctx.strokeStyle = gd.wp.portal ? '#5dade2' : '#ffd34d'; ctx.lineWidth = 2.5; ctx.setLineDash([5, 4]);
      if (gd.path.length) {
        ctx.beginPath(); ctx.moveTo(mx, my);
        for (const p of gd.path) { const [qx, qy] = P(p.x, p.y); ctx.lineTo(qx, qy); }
        ctx.stroke();
      }
      ctx.restore();
      const [dx, dy] = P(gd.wp.x, gd.wp.y);
      ctx.fillStyle = gd.wp.portal ? '#5dade2' : '#ffd34d'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(dx, dy, 5 + Math.sin(performance.now() / 220) * 1.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
  },

  renderMap() {
    const g = this.game;
    const body = clear(this.wins.map.body);
    const z = g.zone;
    // mapa detalhado: arrastar move, a roda aproxima (em volta do cursor), duplo clique volta ao início
    const size = 500, dpr = Math.min(2, window.devicePixelRatio || 1);
    const cv = h('canvas', { width: Math.round(size * dpr), height: Math.round(size * dpr), class: 'map-cv', style: { width: size + 'px', height: size + 'px', imageRendering: 'auto', cursor: 'grab' } });
    this.mapCv = cv; this.mapDpr = dpr; this.mapSize = size;
    this.mapCam = { zoom: 1, cx: z.w / 2, cy: z.h / 2 };
    let drag = null;
    const view = () => {
      const side = Math.max(z.w, z.h) * 1.04 / this.mapCam.zoom;
      return { side, scale: size / side };
    };
    const clampCam = () => {
      const c = this.mapCam, { side } = view();
      c.cx = side >= z.w ? z.w / 2 : Math.max(side / 2, Math.min(z.w - side / 2, c.cx));
      c.cy = side >= z.h ? z.h / 2 : Math.max(side / 2, Math.min(z.h - side / 2, c.cy));
    };
    cv.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, cx: this.mapCam.cx, cy: this.mapCam.cy }; try { cv.setPointerCapture(e.pointerId); } catch { /* ponteiro sintético */ } cv.style.cursor = 'grabbing'; });
    cv.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const { scale } = view();
      this.mapCam.cx = drag.cx - (e.clientX - drag.x) / scale;
      this.mapCam.cy = drag.cy - (e.clientY - drag.y) / scale;
      clampCam(); this.drawWorldMap();
    });
    const end = () => { drag = null; cv.style.cursor = 'grab'; };
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
    cv.addEventListener('wheel', (e) => {
      e.preventDefault();
      const r = cv.getBoundingClientRect();
      const before = view(), c = this.mapCam;
      // ponto do mapa sob o cursor continua sob o cursor depois do zoom
      const mx = c.cx + ((e.clientX - r.left) - size / 2) / before.scale, my = c.cy + ((e.clientY - r.top) - size / 2) / before.scale;
      c.zoom = Math.max(1, Math.min(5, c.zoom * (e.deltaY < 0 ? 1.18 : 1 / 1.18)));
      const after = view();
      c.cx = mx - ((e.clientX - r.left) - size / 2) / after.scale; c.cy = my - ((e.clientY - r.top) - size / 2) / after.scale;
      clampCam(); this.drawWorldMap();
    }, { passive: false });
    cv.addEventListener('dblclick', () => { this.mapCam = { zoom: 1, cx: z.w / 2, cy: z.h / 2 }; this.drawWorldMap(); });
    const side = h('div', { class: 'map-side' }, h('div', { class: 'ql-sub' }, 'Mundo de Aethra'));
    // zonas agrupadas por reino; um reino que o personagem nunca pisou aparece como "???"
    for (const kid of KINGDOM_ORDER) {
      const K = KINGDOMS[kid];
      const kKnown = K.zones.some((id) => g.me.visited.includes(id));
      side.appendChild(h('div', { class: 'map-kingdom' + (kid === z.def.kingdom ? ' cur' : '') }, kKnown ? K.name : '??? (reino desconhecido)'));
      for (const id of K.zones) {
        const zd = ZONES[id];
        const known = g.me.visited.includes(id);
        side.appendChild(h('div', { class: 'map-zone' + (id === z.id ? ' cur' : '') + (known ? '' : ' unknown') },
          h('b', {}, known ? zd.name : '???'), h('div', { class: 'small muted' }, zd.levels)));
      }
    }
    side.appendChild(h('div', { class: 'small muted', style: { marginTop: '10px' } }, '■ amarelo: NPC · ■ azul: Pedra do Caminho · ● azul: portal · ☠ chefe'));
    side.appendChild(h('div', { class: 'small muted', style: { marginTop: '6px' } }, 'Arraste para mover · roda para aproximar · duplo clique para voltar.'));
    body.appendChild(h('div', { class: 'map-wrap' }, cv, side));
    this.drawWorldMap();
  },

  // Redesenha o mapa da janela (chamado várias vezes por segundo enquanto ela está aberta)
  drawWorldMap() {
    const g = this.game, z = g.zone, cv = this.mapCv;
    if (!cv || !cv.isConnected) return;
    const ctx = cv.getContext('2d');
    const dpr = this.mapDpr, size = this.mapSize, cam = this.mapCam;
    if (!(cam.zoom >= 1)) cam.zoom = 1;
    if (!Number.isFinite(cam.cx) || !Number.isFinite(cam.cy)) { cam.cx = z.w / 2; cam.cy = z.h / 2; }
    const art = this.mapArt && this.mapArt.ready ? this.mapArt : null;
    const side = Math.max(z.w, z.h) * 1.04 / cam.zoom, scale = size / side;
    const ox = cam.cx - side / 2, oy = cam.cy - side / 2;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0b1018'; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // só a parte do mapa que cai dentro da imagem
    const k = art ? art.S : 2;
    const src = art ? art.canvas : this.mmImage;
    const sx0 = Math.max(0, ox), sy0 = Math.max(0, oy), sx1 = Math.min(z.w, ox + side), sy1 = Math.min(z.h, oy + side);
    ctx.imageSmoothingEnabled = !!art;
    if (art) ctx.imageSmoothingQuality = 'high';
    if (sx1 > sx0 && sy1 > sy0) ctx.drawImage(src, sx0 * k, sy0 * k, (sx1 - sx0) * k, (sy1 - sy0) * k, (sx0 - ox) * scale, (sy0 - oy) * scale, (sx1 - sx0) * scale, (sy1 - sy0) * scale);
    const dark = g.renderer.darkness();
    if (dark > 0.1) { ctx.fillStyle = `rgba(5,8,25,${dark * 0.45})`; ctx.fillRect(0, 0, size, size); }
    this.drawMapMarkers(ctx, (x, y) => [(x - ox) * scale, (y - oy) * scale], scale, size, true);
  },

  // ================================================================ social / grupo
  renderSocial() {
    const g = this.game;
    const body = clear(this.wins.social.body);
    const p = g.party;
    if (p) {
      body.appendChild(h('div', { class: 'ql-sub' }, `Seu grupo (${p.m.length}/4)`));
      for (const m of p.m) {
        body.appendChild(h('div', { class: 'soc-row' },
          h('span', {}, `${m.id === p.leader ? '♛ ' : ''}${m.n}`), h('small', { class: 'muted' }, ` Nv ${m.l} ${CLASSES[m.c].name} · ${ZONES[m.z]?.name || ''}`),
          p.leader === g.me.id && m.id !== g.me.id ? h('button', { class: 'btn tiny ghost', onclick: () => this.send({ t: 'party', op: 'kick', name: m.n }) }, 'Remover') : null));
      }
      body.appendChild(h('button', { class: 'btn ghost small', onclick: () => this.send({ t: 'party', op: 'leave' }) }, 'Sair do grupo'));
    } else {
      body.appendChild(h('div', { class: 'muted' }, 'Você não está em um grupo. Grupos dividem experiência (com bônus de 15% por membro), ouro e progresso de missões de caça.'));
    }
    const inp = h('input', { class: 'inp', placeholder: 'Nome do jogador' });
    inp.addEventListener('keydown', (e) => e.stopPropagation());
    body.append(h('div', { class: 'ql-sub' }, 'Convidar'),
      h('div', { class: 'row' }, inp, h('button', { class: 'btn small', onclick: () => { if (inp.value.trim()) this.send({ t: 'party', op: 'invite', name: inp.value.trim() }); } }, 'Convidar')),
      h('div', { class: 'row' },
        h('button', { class: 'btn ghost small', onclick: () => this.send({ t: 'chat', m: '/quem' }) }, 'Quem está online?'),
        h('button', { class: 'btn ghost small', onclick: () => { if (inp.value.trim()) this.send({ t: 'trade', op: 'req', name: inp.value.trim() }); } }, 'Negociar')),
      h('div', { class: 'muted small' }, 'Dica: clique com o botão direito em um jogador para ver as opções.'));
  },

  // ================================================================ clã
  renderGuild() {
    const g = this.game;
    const body = clear(this.wins.guild.body);
    const gd = g.guild;
    if (!gd) {
      const inp = h('input', { class: 'inp', placeholder: 'Nome do clã', maxlength: 16 });
      inp.addEventListener('keydown', (e) => e.stopPropagation());
      body.append(h('div', { class: 'muted' }, 'Você não pertence a um clã. Clãs têm chat próprio (/c), aparecem no seu nome e seus membros não se atacam na arena.'),
        h('div', { class: 'ql-sub' }, `Fundar um clã (${GUILD_COST} ouro)`),
        h('div', { class: 'row' }, inp, h('button', { class: 'btn small', onclick: () => this.send({ t: 'guild', op: 'create', name: inp.value.trim() }) }, 'Fundar')));
      return;
    }
    const leader = gd.leader === g.me.name;
    body.appendChild(h('div', { class: 'guild-name' }, `<${gd.name}>`));
    body.appendChild(h('div', { class: 'muted small' }, `Líder: ${gd.leader} · ${gd.m.length} membro(s) · ${gd.m.filter((m) => m.on).length} online`));
    const list = h('div', { class: 'guild-list' });
    for (const m of gd.m.sort((a, b) => (b.on ? 1 : 0) - (a.on ? 1 : 0))) {
      list.appendChild(h('div', { class: 'soc-row' + (m.on ? '' : ' off') },
        h('span', {}, `${m.n === gd.leader ? '♛ ' : ''}${m.n}`), h('small', { class: 'muted' }, ` Nv ${m.l} ${CLASSES[m.c]?.name || ''}${m.on ? ' · ' + m.z : ' · offline'}`),
        leader && m.n !== g.me.name ? h('button', { class: 'btn tiny ghost', onclick: () => this.confirm(`Expulsar ${esc(m.n)}?`, () => this.send({ t: 'guild', op: 'kick', name: m.n })) }, 'Expulsar') : null));
    }
    body.appendChild(list);
    if (leader) {
      const inp = h('input', { class: 'inp', placeholder: 'Nome do jogador' });
      inp.addEventListener('keydown', (e) => e.stopPropagation());
      body.append(h('div', { class: 'row' }, inp, h('button', { class: 'btn small', onclick: () => this.send({ t: 'guild', op: 'invite', name: inp.value.trim() }) }, 'Convidar')));
    }
    body.appendChild(h('button', { class: 'btn ghost small', onclick: () => this.confirm('Sair do clã?', () => this.send({ t: 'guild', op: 'leave' })) }, 'Sair do clã'));
  },

  // ================================================================ ranking
  renderRanking() {
    const body = clear(this.wins.ranking.body);
    body.appendChild(h('div', { class: 'muted' }, 'Carregando...'));
  },

  onRank(d) {
    const body = clear(this.wins.ranking.body);
    const tab = this.rankTab || 'level';
    const tabs = h('div', { class: 'tabs' },
      ...[['level', 'Nível'], ['boss', 'Chefes'], ['pvp', 'Arena']].map(([id, n]) => h('button', { class: 'tab' + (tab === id ? ' on' : ''), onclick: () => { this.rankTab = id; this.onRank(d); } }, n)));
    body.appendChild(tabs);
    const rows = d[tab] || [];
    if (!rows.length) body.appendChild(h('div', { class: 'muted' }, 'Ninguém ainda. Seja o primeiro!'));
    rows.forEach((r, i) => {
      body.appendChild(h('div', { class: 'rank-row' + (r.n === this.me.name ? ' me' : '') },
        h('span', { class: 'rank-pos' }, ['🥇', '🥈', '🥉'][i] || `${i + 1}.`),
        h('span', { class: 'rank-name' }, r.n, r.g ? h('small', {}, ` <${r.g}>`) : null),
        h('span', { class: 'muted small' }, `${CLASSES[r.c].name} ${r.l}`),
        h('b', {}, tab === 'level' ? `Nv ${r.l}` : String(r.v))));
    });
  },

  // ================================================================ ajuda
  renderHelp() {
    const body = clear(this.wins.help.body);
    body.innerHTML = `
      <div class="help-cols">
        <div>
          <div class="ql-sub">Controles</div>
          <table class="keys">
            <tr><td>WASD / Setas</td><td>Andar</td></tr>
            <tr><td>Clique no chão</td><td>Ir até o ponto</td></tr>
            <tr><td>Clique no inimigo</td><td>Selecionar e atacar</td></tr>
            <tr><td>Clique no NPC</td><td>Conversar</td></tr>
            <tr><td>Botão direito em jogador</td><td>Grupo, comércio, sussurro</td></tr>
            <tr><td>1 – 6</td><td>Habilidades</td></tr>
            <tr><td>Q / R</td><td>Poção de vida / mana</td></tr>
            <tr><td>Tab</td><td>Próximo inimigo</td></tr>
            <tr><td>F / Espaço</td><td>Interagir / pegar item próximo</td></tr>
            <tr><td>Z</td><td>Mostrar nomes dos itens no chão</td></tr>
            <tr><td>Enter</td><td>Chat</td></tr>
            <tr><td>Roda do mouse</td><td>Zoom</td></tr>
            <tr><td>Botão direito (arrastar)</td><td>Girar e inclinar a câmera</td></tr>
            <tr><td>V</td><td>Alternar câmera: 3ª pessoa longe / perto / 1ª pessoa</td></tr>
            <tr><td>Toque (celular)</td><td>Direcional à esquerda, botões à direita; arraste na tela para girar, pinça para zoom</td></tr>
            <tr><td>I C K J M P G O</td><td>Inventário, Personagem, Habilidades, Missões, Mapa, Grupo, Clã, Ranking</td></tr>
            <tr><td>Esc</td><td>Fechar janela / Opções</td></tr>
          </table>
        </div>
        <div>
          <div class="ql-sub">Dicas</div>
          <ul class="tips">
            <li>Siga as missões <b class="gold">★ principais</b>: elas contam a história e levam você por todas as regiões.</li>
            <li>NPCs com <b class="gold">!</b> têm missões; <b class="gold">?</b> amarelo indica missão pronta para entregar.</li>
            <li>A cada nível você ganha 3 pontos de atributo (C). O atributo marcado com ★ aumenta seu Poder.</li>
            <li>Chefes avisam seus golpes com <b style="color:#ff6b6b">círculos vermelhos</b> no chão — saia deles!</li>
            <li>Toque nas <b style="color:#85c1e9">Pedras do Caminho</b> para viajar rapidamente entre regiões descobertas do mesmo reino.</li>
            <li>O mundo é dividido em <b class="gold">reinos</b>: só o reino onde você está é carregado. Ao atravessar a fronteira o jogo carrega o novo reino; suas missões e progresso ficam guardados, e o Pergaminho de Retorno e o renascimento levam à capital do reino atual.</li>
            <li>A Ferreira aprimora equipamentos até +10. Até +4 nunca falha; a partir de +5, uma falha reduz o nível.</li>
            <li>Morrer fora da arena custa um pouco de experiência. Use poções (Q) e recue quando necessário.</li>
            <li>Grupos ganham mais experiência total e dividem os saques.</li>
            <li>Comandos de chat: /m (mundo), /g (grupo), /c (clã), /s nome (sussurro), /quem, /ajuda.</li>
          </ul>
        </div>
      </div>
      <div class="ql-sub">A história até aqui</div>
      <div class="ql-story">Há um mês, Morvath, o Sumo-Guardião da Ordem da Chama, extinguiu a Chama Primordial do Santuário de Lúmen e a partiu em três Brasas — Vida, Terra e Espírito — entregando-as a criaturas corrompidas. Desde então, a Névoa Cinzenta avança sobre Aethra. Quando a Chama se partiu, centelhas caíram do céu e despertaram os Portadores. Você é um deles. Recupere as três Brasas e reacenda a luz.</div>
      <div class="muted small" style="margin-top:8px">Modelos 3D: KayKit Adventurers, Skeletons, Medieval Hexagon, Resource Bits, Dungeon, Weapons Bits e Tools Bits por Kay Lousberg (www.kaylousberg.com); prédios com o Medieval Village MegaKit por Quaternius (quaternius.com); as torres de Zahrim são voxels (MagicaVoxel) de monogon (Max Parata), licença CC BY-ND; cimitarras de Alstra Infinite (CC BY) e demais armas de Sahaar da Quaternius; efeitos de habilidades portados dos pacotes Binbun VFX de Binbun3D; música de abertura criada no Suno; shader da água portado do projeto ocean de Jérémy Bouny (MIT, github.com/jbouny/ocean); zumbi por Kenney (kenney.nl) e céu por Poly Haven (polyhaven.com), via pacote do Brackeys. Todos CC0.</div>
      ${this.game.dev ? '<div class="ql-sub">Modo de teste (DEV)</div><div class="muted">/nivel N · /ouro N · /item id [qtd] [raridade] · /ir zona · /tp x y · /curar · /matar · /ids</div>' : ''}`;
  },

  // ================================================================ opções
  renderOptions() {
    const body = clear(this.wins.options.body);
    const tab = this.optTab || 'geral';
    body.appendChild(h('div', { class: 'tabs' },
      ...[['geral', 'Geral'], ['graficos', 'Gráficos']].map(([id, n]) => h('button', { class: 'tab' + (tab === id ? ' on' : ''), onclick: () => { this.optTab = id; this.renderOptions(); } }, n))));
    if (tab === 'graficos') { body.appendChild(graphicsPanel(this)); return; }
    const toggle = (label, val, fn) => {
      const cb = h('input', { type: 'checkbox' });
      cb.checked = val;
      cb.addEventListener('change', () => fn(cb.checked));
      return h('label', { class: 'opt-row' }, cb, ' ', label);
    };
    const select = (label, val, opts, fn) => {
      const sel = h('select', { class: 'opt-select' }, ...opts.map(([v, n]) => h('option', { value: v }, n)));
      sel.value = val;
      sel.addEventListener('change', () => fn(sel.value));
      return h('label', { class: 'opt-row' }, label + ' ', sel);
    };
    const zoom = h('input', { type: 'range', min: '1', max: '3.6', step: '0.05', value: String(this.game.zoom) });
    zoom.addEventListener('input', () => { this.game.zoom = parseFloat(zoom.value); });
    body.append(
      toggle('Efeitos sonoros', audio.enabled, (v) => { audio.init(); audio.setSfx(v); }),
      toggle('Música (some durante os combates)', audio.musicOn, (v) => { audio.init(); audio.setMusic(v); themeMusic.sync(); if (v) audio.startMusic(this.game.zone.def.music); }),
      toggle('Mostrar nomes dos itens no chão (Z)', this.game.showItemNames, (v) => { this.game.showItemNames = v; }),
      select('Câmera (V)', this.game.renderer.camMode, [['far', '3ª pessoa · longe'], ['near', '3ª pessoa · perto'], ['first', '1ª pessoa']], (v) => this.game.renderer.setCamMode(v)),
      h('label', { class: 'opt-row' }, 'Zoom ', zoom),
      h('button', { class: 'btn small', onclick: () => { this.optTab = 'graficos'; this.renderOptions(); } }, 'Gráficos e desempenho…'),
      select('Controles de toque', touchUiMode(), [['auto', 'Automático'], ['on', 'Sempre ligados'], ['off', 'Desligados']], (v) => this.mobile.set(v)),
      h('button', { class: 'btn small', onclick: () => this.mobile.fullscreen() }, 'Tela cheia'),
      h('div', { class: 'row' },
        h('button', { class: 'btn small', onclick: () => { this.wins.options.close(); this.send({ t: 'logout' }); } }, 'Trocar personagem'),
        h('button', { class: 'btn ghost small', onclick: () => (window.aethra && window.aethra.logout ? window.aethra.logout() : location.reload()) }, 'Sair')),
      h('div', { class: 'muted small' }, `Latência: ${this.net.latency} ms`));
  },

  // ================================================================ introdução
  showIntro() {
    const me = this.me;
    const ov = h('div', { class: 'modal-bg' });
    ov.appendChild(h('div', { class: 'modal intro frame' },
      h('div', { class: 'intro-title' }, 'Aethra: A Chama Partida'),
      h('div', { class: 'ql-story', html: fill(`Por mil anos, a <b>Chama Primordial</b> ardeu no Santuário de Lúmen, mantendo a Névoa Cinzenta longe de Aethra.<br><br>
        Há um mês, <b>Morvath</b>, o Sumo-Guardião da Ordem, traiu seus irmãos: extinguiu a Chama e a partiu em três <b>Brasas</b>, entregando-as a criaturas corrompidas. Desde então, a Névoa avança, e os animais e os mortos se erguem contra os vivos.<br><br>
        Na noite em que a Chama se partiu, uma centelha caiu do céu e atravessou seu peito. Você dormiu por três dias. Agora desperta na <b>Cidade de Alvorada</b>, o último refúgio — e sente a luz ardendo dentro de você.<br><br>
        Você é um <b>Portador</b>, {name}. E Aethra precisa de você.`.replace(/\n\s*/g, ' '), me) }),
      h('div', { class: 'intro-tip' }, 'Fale com o Ancião Thalric (marcado com ', h('b', { class: 'gold' }, '!'), '), logo à sua frente, no pátio do castelo. Ande com WASD ou clicando no chão. Pressione H a qualquer momento para ver os controles.'),
      h('button', { class: 'btn big', onclick: () => { audio.init(); ov.remove(); } }, 'Começar a jornada')));
    document.body.appendChild(ov);
  },

  // ================================================================ comércio
  onTrade() {
    const t = this.game.trade;
    const w = this.wins.trade;
    w.setTitle(`Comércio com ${t.with}`);
    const body = clear(w.body);
    const mine = h('div', { class: 'trade-col' }, h('div', { class: 'ql-sub' }, 'Sua oferta' + (t.mine.ok ? ' ✔' : '')));
    const mg = h('div', { class: 'inv-grid small' });
    for (const s of t.mine.slots) {
      const it = this.me.inv[s];
      const el = slotEl(it, { me: this.me, hint: 'Clique para remover' });
      el.addEventListener('click', () => this.send({ t: 'trade', op: 'remove', slot: s }));
      mg.appendChild(el);
    }
    for (let i = t.mine.slots.length; i < 8; i++) mg.appendChild(slotEl(null));
    const gold = h('input', { class: 'inp', type: 'number', min: '0', value: String(t.mine.gold) });
    gold.addEventListener('keydown', (e) => e.stopPropagation());
    gold.addEventListener('change', () => this.send({ t: 'trade', op: 'gold', gold: parseInt(gold.value, 10) || 0 }));
    mine.append(mg, h('div', { class: 'row' }, h('span', { class: 'gold' }, 'Ouro: '), gold));
    const theirs = h('div', { class: 'trade-col' }, h('div', { class: 'ql-sub' }, `Oferta de ${t.with}` + (t.theirs.ok ? ' ✔' : '')));
    const tg = h('div', { class: 'inv-grid small' });
    for (const it of t.theirs.items) tg.appendChild(slotEl(it, { me: this.me }));
    for (let i = t.theirs.items.length; i < 8; i++) tg.appendChild(slotEl(null));
    theirs.append(tg, h('div', {}, h('span', { class: 'gold' }, 'Ouro: '), fmt(t.theirs.gold)));
    body.append(h('div', { class: 'trade-wrap' }, mine, theirs),
      h('div', { class: 'muted small' }, 'Clique com o botão direito nos itens do inventário para oferecê-los. Qualquer alteração cancela as confirmações.'),
      h('div', { class: 'row' },
        h('button', { class: 'btn', disabled: t.mine.ok ? true : null, onclick: () => this.send({ t: 'trade', op: 'ok' }) }, t.mine.ok ? 'Aguardando...' : 'Aceitar troca'),
        h('button', { class: 'btn ghost', onclick: () => this.send({ t: 'trade', op: 'cancel' }) }, 'Cancelar')));
    if (!w.isOpen) { w.open(); this.openWin('inventory'); }
  },

  closeTrade() {
    const w = this.wins.trade;
    const cb = w.onClose;
    w.onClose = null;
    w.close();
    w.onClose = cb;
  },
};

export function objText(o) {
  switch (o.type) {
    case 'kill': {
      const ids = Array.isArray(o.target) ? o.target : [o.target];
      return `Derrotar ${[...new Set(ids.map((id) => MONSTERS[id].name))].join(' / ')}`;
    }
    case 'collect': return `Obter ${ITEMS[o.item].name}`;
    case 'talk': return `Falar com ${NPCS[o.npc].name}`;
    case 'pvp': return 'Vencer outros jogadores na Arena';
    default: return '?';
  }
}

export function rewardsEl(r, dev) {
  const box = h('div', { class: 'rewards' });
  if (r.xp) box.appendChild(h('span', { class: 'rw xp' }, `${fmt(r.xp)} XP`));
  if (r.gold) box.appendChild(h('span', { class: 'rw gold' }, `${fmt(r.gold)} ouro`));
  for (const [id, n] of r.items || []) {
    const it = { id, q: n, r: ITEMS[id].stack ? 0 : 1 };
    const el = slotEl(it, { cls: 'mini' });
    box.appendChild(el);
  }
  if (r.flag) box.appendChild(h('span', { class: 'rw flag' }, '🔥 Bênção de uma Brasa'));
  if (r.title) box.appendChild(h('span', { class: 'rw title' }, `Título: ${r.title}`));
  return box;
}

export function fill(text, me) {
  return String(text || '').replace(/\{name\}/g, me.name || 'Portador').replace(/\{class\}/g, CLASSES[me.cls]?.name || '');
}

export { TILE };
