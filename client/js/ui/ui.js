// Interface do jogo: HUD, chat, notificações e coordenação das janelas.
import { TILE, F, RARITY, CHAT } from '/shared/constants.js';
import { CLASSES } from '/shared/data/classes.js';
import { SKILLS } from '/shared/data/skills.js';
import { ITEMS } from '/shared/data/items.js';
import { MONSTERS } from '/shared/data/monsters.js';
import { NPCS } from '/shared/data/npcs.js';
import { QUESTS } from '/shared/data/quests.js';
import { ZONES, hubOf } from '/shared/data/zones.js';
import { KINGDOMS } from '/shared/data/kingdoms.js';
import { h, clear, esc, Win, fmt } from './dom.js';
import { Tooltip, slotEl } from './itemview.js';
import { skillIcon, itemIcon, drawHumanoid, playerLook } from '../sprites.js';
import { minimapColor } from '../terrain.js';
import { audio } from '../audio.js';
import { charSprites } from '../charsprites.js';
import { activeQuests, progress, need, isComplete } from '../questlogic.js';
import { windowsMixin } from './windows.js';
import { npcMixin } from './npcui.js';
import { legacyMixin } from './legacyui.js';
import { worldMapMixin } from './worldmap.js';
import { ico, icoHTML, STATUS_ICON } from './icons.js';
import { MobileControls } from './mobile.js';
import { chatBox } from './chatbox.js';
import { MapArt } from '../mapart.js';
import { quality } from '../device.js';

const CHANNEL_NAMES = { zona: 'Zona', mundo: 'Mundo', grupo: 'Grupo', cla: 'Clã', sussurro: 'Sussurro', sistema: 'Sistema', grito: 'Grito', npc: 'NPC' };

export class UI {
  constructor(root, net) {
    this.root = root;
    this.net = net;
    this.game = null;
    this.tooltip = new Tooltip();
    this.wins = {};
    this.lastMini = 0; this.lastMiniMap = 0;
    this.chatHistory = [];
    this.build();
  }

  get me() { return this.game.me; }

  send(obj) { this.net.send(obj); }

  // ------------------------------------------------------------------ construção do HUD
  build() {
    const R = this.root;
    clear(R);
    // quadro do jogador
    this.portrait = h('canvas', { width: 96, height: 96, class: 'pf-portrait' });
    this.pfName = h('div', { class: 'pf-name' });
    this.hpBar = bar('hp');
    this.mpBar = bar('mp');
    this.pfGold = h('div', { class: 'pf-gold' });
    R.appendChild(h('div', { id: 'hud-player', class: 'frame' }, this.portrait, h('div', { class: 'pf-info' }, this.pfName, this.hpBar.el, this.mpBar.el, this.pfGold)));
    this.statusBox = h('div', { id: 'hud-statuses' });
    R.appendChild(this.statusBox);
    // alvo
    this.tgName = h('div', { class: 'tg-name' });
    this.tgBar = bar('hp');
    this.tgInfo = h('div', { class: 'tg-info' });
    this.tgEl = h('div', { id: 'hud-target', class: 'frame', style: { display: 'none' } }, this.tgName, this.tgBar.el, this.tgInfo);
    R.appendChild(this.tgEl);
    this.partyEl = h('div', { id: 'hud-party' });
    R.appendChild(this.partyEl);
    // minimapa
    this.mmZone = h('div', { class: 'mm-zone' });
    this.mmDpr = Math.min(2, window.devicePixelRatio || 1);
    this.mmCanvas = h('canvas', { width: Math.round(180 * this.mmDpr), height: Math.round(180 * this.mmDpr) });
    this.mmInfo = h('div', { class: 'mm-info' });
    this.mmNorth = false;
    try { this.mmNorth = localStorage.getItem('aethra_mm_north') === '1'; } catch { /* sem armazenamento */ }
    this.mmLock = h('button', { class: 'mm-lock', type: 'button' });
    const lockLabel = () => { this.mmLock.textContent = this.mmNorth ? 'N' : '⟳'; this.mmLock.title = this.mmNorth ? 'Norte fixo em cima (clique para girar com a câmera)' : 'Girando com a câmera (clique para travar o norte em cima)'; };
    lockLabel();
    this.mmLock.addEventListener('click', (e) => {
      e.stopPropagation();
      this.mmNorth = !this.mmNorth; lockLabel();
      try { localStorage.setItem('aethra_mm_north', this.mmNorth ? '1' : '0'); } catch { /* sem armazenamento */ }
      this.drawMinimap();
    });
    R.appendChild(h('div', { id: 'minimap' }, this.mmZone, h('div', { class: 'mm-disc' }, this.mmCanvas, this.mmLock), this.mmInfo));
    this.mmCanvas.addEventListener('click', () => this.toggle('map'));
    this.mmSpan = 34; // tiles na largura do minimapa
    this.mmCanvas.addEventListener('wheel', (e) => { e.preventDefault(); this.mmSpan = Math.max(18, Math.min(90, this.mmSpan * (e.deltaY < 0 ? 0.87 : 1.15))); this.drawMinimap(); }, { passive: false });
    // rastreador de missões
    this.tracker = h('div', { id: 'tracker' });
    R.appendChild(this.tracker);
    // barra do guia de missão: destino, distância e botões Ir / Parar
    this.guideLabel = h('span', { class: 'gb-label' });
    this.guideDist = h('span', { class: 'gb-dist' });
    this.guideGo = h('button', { class: 'gb-btn go', onclick: () => this.guideToggleAuto() });
    this.guideGo.innerHTML = icoHTML('play') + ' Ir';
    this.guideBar = h('div', { id: 'guidebar', style: { display: 'none' } },
      h('span', { class: 'gb-pin' }, ico('pin')), h('div', { class: 'gb-text' }, this.guideLabel, this.guideDist), this.guideGo,
      h('button', { class: 'gb-btn', title: 'Ocultar a sinalização', onclick: () => this.game.guide.stop(true) }, ico('close')));
    R.appendChild(this.guideBar);
    // chat
    this.chatLog = h('div', { id: 'chat-log' });
    this.chatInput = h('input', { id: 'chat-input', maxlength: 200, placeholder: 'Enter para conversar · /ajuda para comandos', autocomplete: 'off' });
    this.chatInput.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        const v = this.chatInput.value.trim();
        if (v) { this.send({ t: 'chat', m: v }); this.chatHistory.push(v); }
        this.chatHistory.idx = this.chatHistory.length;
        this.chatInput.value = '';
        this.chatInput.blur();
      } else if (e.key === 'Escape') this.chatInput.blur();
      else if (e.key === 'ArrowUp' && this.chatHistory.length) {
        this.chatHistory.idx = Math.max(0, (this.chatHistory.idx ?? this.chatHistory.length) - 1);
        this.chatInput.value = this.chatHistory[this.chatHistory.idx];
      }
    });
    R.appendChild(chatBox(this.chatLog, this.chatInput));
    // barra inferior
    this.xpFill = h('div', { class: 'fill' });
    this.xpText = h('span');
    this.skillSlots = [];
    const sb = h('div', { id: 'skillbar' });
    for (let i = 0; i < 6; i++) {
      const s = this.skillSlot(String(i + 1), () => this.game.useSkillIndex(i));
      this.skillSlots.push(s);
      sb.appendChild(s.el);
    }
    sb.appendChild(h('div', { class: 'sb-sep' }));
    this.potSlots = { hp: this.skillSlot('Q', () => this.game.usePotion('hp')), mp: this.skillSlot('R', () => this.game.usePotion('mp')) };
    sb.append(this.potSlots.hp.el, this.potSlots.mp.el);
    R.appendChild(h('div', { id: 'bottom' }, sb, h('div', { id: 'xpbar' }, this.xpFill, this.xpText)));
    // menu
    const menu = [
      ['inventory', 'Inventário', 'I', 'bag'], ['character', 'Personagem', 'C', 'armor'], ['skills', 'Habilidades', 'K', 'skills'],
      ['quests', 'Missões', 'J', 'quests'], ['map', 'Mapa', 'M', 'map'], ['social', 'Grupo', 'P', 'group'], ['guild', 'Clã', 'G', 'guild'],
      ['legacy', 'Legado', 'N', 'legacy'], ['ranking', 'Ranking', 'O', 'ranking'], ['help', 'Ajuda', 'H', 'help'], ['options', 'Opções', 'Esc', 'gear'],
    ];
    const mb = h('div', { id: 'menubar' });
    for (const [id, name, key, icon] of menu) {
      mb.appendChild(h('button', { class: 'mb-btn', 'data-tip': `${esc(name)} <span class="key">${key}</span>`, onclick: () => { audio.init(); this.toggle(id); } }, ico(icon)));
    }
    R.appendChild(mb);
    this.toasts = h('div', { id: 'toasts' });
    this.banner = h('div', { id: 'banner' });
    this.castEl = h('div', { id: 'castbar', style: { display: 'none' } }, h('div', { class: 'fill' }), h('span'));
    this.deathEl = h('div', { id: 'death', style: { display: 'none' } });
    this.invitesEl = h('div', { id: 'invites' });
    this.lootEl = h('div', { id: 'lootlog' });
    R.append(this.toasts, this.banner, this.castEl, this.deathEl, this.invitesEl, this.lootEl);
    this.menuEl = null;
    this.buildWindows();
    this.mobile = new MobileControls(this);
  }

  skillSlot(key, onclick) {
    const img = h('img', { alt: '', draggable: 'false' });
    const cd = h('div', { class: 'sk-cd' });
    const cdText = h('span', { class: 'sk-cdtext' });
    const qty = h('span', { class: 'sk-qty' });
    const el = h('div', { class: 'sk-slot', onclick: () => { audio.init(); onclick(); } }, img, cd, cdText, qty, h('span', { class: 'sk-key' }, key));
    el.dataset.tip = '1';
    return { el, img, cd, cdText, qty };
  }

  // ------------------------------------------------------------------ eventos do jogo
  onWorld(first, zoneChanged) {
    const me = this.me;
    const def = this.game.zone.def;
    this.buildMinimap();
    this.refreshSkillbar();
    this.drawPortrait();
    this.onMe(); this.onInventory(); this.onEquip(); this.onQuests(); this.onStatuses();
    this.closeNpcWindows();
    if (zoneChanged) {
      // ao cruzar a fronteira de um reino o aviso traz o nome do reino
      const king = KINGDOMS[def.kingdom];
      if (this.lastKingdom && this.lastKingdom !== def.kingdom && king) this.showBanner(king.name, `${def.name} · ${def.levels}`, 'kingdom');
      else this.showBanner(def.name, def.levels);
    }
    this.lastKingdom = def.kingdom;
    if (first) {
      this.chatMsg({ c: 'sistema', m: `Bem-vindo a Aethra, ${me.name}! Pressione H para ver os controles.` });
      if (me.level === 1 && !Object.keys(me.quests.done).length && !Object.keys(me.quests.active).length) this.showIntro();
    }
    this.hideDeath();
    if (me.dead) this.showDeath({});
  }

  onMe() {
    const me = this.me;
    const cls = CLASSES[me.cls];
    this.pfName.innerHTML = `${esc(me.name)} <span class="pf-lvl">Nv ${me.level} ${cls ? cls.name : ''}</span>`;
    this.hpBar.set(me.hp, me.mhp);
    this.mpBar.set(me.mp, me.mmp);
    this.pfGold.innerHTML = `${icoHTML('coin')} ${fmt(me.gold)} ouro` + (me.points ? ` · <span class="pts">${me.points} ponto(s)!</span>` : '');
    const pct = me.nx ? me.xp / me.nx : 1;
    this.xpFill.style.width = (pct * 100).toFixed(2) + '%';
    this.xpText.textContent = me.nx ? `Nível ${me.level} — ${fmt(me.xp)} / ${fmt(me.nx)} XP (${(pct * 100).toFixed(1)}%)` : `Nível ${me.level} (máximo)`;
    if (this.wins.character?.isOpen) this.renderCharacter();
    if (this.wins.skills?.isOpen) this.renderSkills();
    this.refreshSkillbar();
  }

  onStats() {
    if (this.wins.character?.isOpen) this.renderCharacter();
  }

  onInventory() {
    if (this.wins.inventory?.isOpen) this.renderInventory();
    if (this.wins.shop?.isOpen) this.renderShop();
    if (this.wins.craft?.isOpen) this.renderCraft();
    if (this.wins.enhance?.isOpen) this.renderEnhance();
    if (this.wins.stash?.isOpen) this.renderStash();
    this.renderTracker();
    this.refreshPotions();
    if (this.wins.quests?.isOpen) this.renderQuests();
  }

  onEquip() {
    if (this.wins.character?.isOpen) this.renderCharacter();
    if (this.wins.inventory?.isOpen) this.renderInventory();
    if (this.wins.enhance?.isOpen) this.renderEnhance();
    this.drawPortrait();
  }

  onQuests() {
    this.renderTracker();
    if (this.wins.quests?.isOpen) this.renderQuests();
    if (this.wins.npc?.isOpen && this.npcOpen) this.renderNpc();
  }

  onStash() { if (this.wins.stash?.isOpen) this.renderStash(); }

  onStatuses() {
    const box = clear(this.statusBox);
    for (const s of this.me.statuses) {
      const good = ['buff', 'shield', 'dr', 'invuln'].includes(s.t);
      const el = h('div', { class: 'status ' + (good ? 'good' : 'bad') }, ico(STATUS_ICON[s.t] || 'dot'), h('small', {}));
      el.dataset.tip = `<b>${esc(s.n || s.id)}</b>`;
      el._st = s;
      box.appendChild(el);
    }
  }

  onParty() {
    const box = clear(this.partyEl);
    const p = this.game.party;
    if (p) {
      for (const m of p.m) {
        if (m.id === this.me.id) continue;
        const b = bar('hp'); b.set(m.hp, m.mhp);
        const mb = bar('mp'); mb.set(m.mp, m.mmp);
        const el = h('div', { class: 'party-member frame' + (m.d ? ' dead' : '') },
          h('div', { class: 'pm-name' }, m.id === p.leader ? ico('crown', 'sm') : null, m.n, h('small', {}, ` Nv ${m.l} ${CLASSES[m.c].name}`)),
          b.el, mb.el,
          m.z !== this.game.zone.id ? h('div', { class: 'pm-zone' }, ZONES[m.z]?.name || '') : null);
        el.addEventListener('click', () => { if (this.game.entities.has(m.id)) this.game.target = m.id; });
        box.appendChild(el);
      }
    }
    if (this.wins.social?.isOpen) this.renderSocial();
  }

  onGuild() { if (this.wins.guild?.isOpen) this.renderGuild(); }

  onCast() {
    const c = this.me.casting;
    this.castEl.style.display = c ? 'block' : 'none';
    if (c) this.castEl.querySelector('span').textContent = c.name;
  }

  // ------------------------------------------------------------------ barra de habilidades
  refreshSkillbar() {
    if (!this.game || !this.me.cls) return;
    const cls = CLASSES[this.me.cls];
    cls.skills.forEach((id, i) => {
      const sk = SKILLS[id];
      const s = this.skillSlots[i];
      s.img.src = skillIcon(sk);
      s.el.classList.toggle('locked', this.me.level < sk.lvl);
      s.el.classList.toggle('nomana', this.me.mp < sk.mp && this.me.level >= sk.lvl);
      s.el._tip = () => `<div class="tt-name" style="color:#f7dc6f">${esc(sk.name)}</div><div class="tt-sub">${sk.mp} mana · recarga ${sk.cd}s${sk.range ? ' · alcance ' + sk.range : ''}</div><div class="tt-desc">${esc(sk.desc)}</div>${this.me.level < sk.lvl ? `<div class="tt-req bad">Desbloqueia no nível ${sk.lvl}</div>` : ''}<div class="tt-hint">Tecla ${i + 1}${sk.target === 'ground' || sk.target === 'dir' ? ' · mira no cursor do mouse' : ''}</div>`;
      s.qty.textContent = this.me.level < sk.lvl ? 'Nv' + sk.lvl : '';
    });
    this.refreshPotions();
  }

  refreshPotions() {
    if (!this.game) return;
    for (const kind of ['hp', 'mp']) {
      const s = this.potSlots[kind];
      let best = null, total = 0;
      for (const it of this.me.inv) {
        if (!it) continue;
        const b = ITEMS[it.id];
        if (b.type === 'consumable' && b.use && b.use[kind] && b.lvl <= this.me.level) {
          total += it.q || 1;
          if (!best || b.lvl > ITEMS[best.id].lvl) best = it;
        }
      }
      s.img.src = itemIcon(best ? best.id : kind === 'hp' ? 'pot_hp_1' : 'pot_mp_1');
      s.el.classList.toggle('locked', !best);
      s.qty.textContent = total ? String(total) : '0';
      s.el._tip = () => `<b>${kind === 'hp' ? 'Poção de vida' : 'Poção de mana'}</b><div class="tt-desc">Usa a melhor poção disponível (${total}).</div>`;
    }
  }

  flashSkill(id) {
    const cls = CLASSES[this.me.cls];
    const i = cls.skills.indexOf(id);
    if (i < 0) return;
    const el = this.skillSlots[i].el;
    el.classList.remove('flash');
    void el.offsetWidth;
    el.classList.add('flash');
  }

  // chamada a cada quadro
  frame() {
    const g = this.game;
    if (!g || !g.zone) return;
    const now = performance.now();
    const cls = CLASSES[this.me.cls];
    if (cls) {
      cls.skills.forEach((id, i) => {
        const c = g.cooldowns[id];
        let rem = 0, dur = 1;
        if (c && c.end > now) { rem = c.end - now; dur = c.dur; }
        if (g.gcd.end > now && g.gcd.end - now > rem) { rem = g.gcd.end - now; dur = g.gcd.dur; }
        setCd(this.skillSlots[i], rem, dur);
      });
    }
    for (const k of ['hp', 'mp']) {
      const c = g.potCd[k];
      setCd(this.potSlots[k], c.end > now ? c.end - now : 0, c.dur);
    }
    // alvo
    const t = g.entities.get(g.target);
    if (t && t.k !== 'i') {
      this.tgEl.style.display = 'block';
      let name = '', info = '', col = '#fff';
      if (t.k === 'm') {
        const d = MONSTERS[t.m];
        name = d.name; col = d.boss ? '#ff9a1f' : '#ff7675';
        info = `Nível ${t.lv}${d.boss ? ' · CHEFE' : ''}`;
      } else if (t.k === 'p') {
        name = t.nm; col = g.isHostile(t) ? '#ff7675' : '#82e0aa';
        info = `Nível ${t.lv} ${CLASSES[t.cls].name}${t.g ? ' · <' + t.g + '>' : ''}`;
      } else if (t.k === 'n') {
        const n = NPCS[t.n];
        name = n.name; col = '#f9e79f'; info = n.title || '';
      }
      const flags = [];
      if (t.f & F.STUN) flags.push('stun'); if (t.f & F.ROOT) flags.push('root'); if (t.f & F.SLOW) flags.push('snow');
      if (t.f & F.BURN) flags.push('flame'); if (t.f & F.POISON) flags.push('skull'); if (t.f & F.SHIELD) flags.push('shield'); if (t.f & F.BUFF) flags.push('up');
      if (t.f & F.CAST) flags.push('warn');
      this.tgName.style.color = col;
      this.tgName.textContent = name;
      this.tgInfo.innerHTML = esc(info) + (flags.length ? ' ' + flags.map((f) => icoHTML(f)).join('') : '');
      if (t.k === 'n') this.tgBar.el.style.display = 'none';
      else { this.tgBar.el.style.display = ''; this.tgBar.set(t.hp, t.mhp); }
    } else this.tgEl.style.display = 'none';
    // status
    for (const el of this.statusBox.children) {
      const s = el._st;
      const rem = Math.max(0, (s.end - now) / 1000);
      el.lastChild.textContent = rem >= 60 ? Math.ceil(rem / 60) + 'm' : rem.toFixed(0) + 's';
    }
    // conjuração
    const c = this.me.casting;
    if (c) this.castEl.firstChild.style.width = Math.min(100, ((now - c.start) / c.dur) * 100) + '%';
    // o minimapa é redesenhado a cada ~30 quadros por segundo para a seta e o giro acompanharem o personagem sem atraso
    if (now - this.lastMiniMap > (quality().low ? 66 : 33)) { this.lastMiniMap = now; this.drawMinimap(); }
    if (now - this.lastMini > (quality().low ? 200 : 100)) {
      this.lastMini = now;
      this.updateGuideBar();
      if (this.wins.map?.isOpen && this.mapCv) this.drawWorldMap();
    }
    if (this.deathEl.style.display !== 'none' && this.deathAt) {
      const left = Math.max(0, 3 - (now - this.deathAt) / 1000);
      const btn = this.deathEl.querySelector('button');
      if (btn) { btn.disabled = left > 0; btn.textContent = left > 0 ? `Aguarde ${left.toFixed(0)}s` : this.deathBtnText; }
    }
    this.hpBar.set(this.me.hp, this.me.mhp);
  }

  // ------------------------------------------------------------------ retrato e minimapa
  drawPortrait() {
    const cv = this.portrait;
    const ctx = cv.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, 96, 96);
    const g = ctx.createRadialGradient(48, 40, 6, 48, 48, 60);
    g.addColorStop(0, '#3a4a6b'); g.addColorStop(1, '#10141f');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 96, 96);
    const me = this.me;
    if (charSprites.has(me.cls)) {
      // retrato: aproxima o rosto do modelo
      ctx.drawImage(charSprites.portrait(me.cls, 96, 0, 2.6), 0, 22);
      return;
    }
    const app = {};
    for (const [slot, it] of Object.entries(me.equip || {})) if (it) app[slot[0]] = it.id;
    const look = playerLook({ cls: me.cls, sk: me.skin, hr: me.hair, app });
    ctx.setTransform(2.6, 0, 0, 2.6, 48, 128);
    drawHumanoid(ctx, 0, 0, { ...look, dir: 0 });
  }

  buildMinimap() {
    const z = this.game.zone;
    const cv = document.createElement('canvas');
    cv.width = z.w * 2; cv.height = z.h * 2;
    const ctx = cv.getContext('2d');
    for (let y = 0; y < z.h; y++) {
      for (let x = 0; x < z.w; x++) {
        const i = y * z.w + x;
        ctx.fillStyle = minimapColor(z.map.tiles[i], z.map.objs[i]);
        ctx.fillRect(x * 2, y * 2, 2, 2);
      }
    }
    this.mmImage = cv;
    // mapa detalhado com relevo, pintado aos poucos (até ficar pronto vale o desenho simples acima)
    if (this.mapArt) this.mapArt.cancel();
    this.mapArt = new MapArt(z, Math.max(6, Math.min(10, Math.floor(1600 / Math.max(z.w, z.h)))));
    this.mapArt.start(() => { if (this.wins.map?.isOpen) this.drawWorldMap(); });
    this.mmZone.textContent = z.def.name;
    if (this.wins.map?.isOpen) this.renderMap();
  }

  // Minimapa redondo com o jogador no centro. Por padrão gira com a câmera (o que está à frente no jogo fica no alto do círculo),
  // então a seta e o caminho andado sempre batem com o que se vê; o botão N trava o norte em cima.
  drawMinimap() {
    const g = this.game;
    const z = g.zone;
    if (!this.mmImage) return;
    const ctx = this.mmCanvas.getContext('2d');
    const S = 180, R = S / 2, me = g.me;
    const dark = g.renderer.darkness();
    const art = this.mapArt && this.mapArt.ready ? this.mapArt : null;
    const span = Math.min(this.mmSpan, Math.max(z.w, z.h) * 1.1);
    const scale = S / span, half = span / 2;
    const rot = this.mmNorth ? 0 : g.renderer.yaw || 0; // giro da tela: a frente da câmera fica para cima
    const cos = Math.cos(rot), sin = Math.sin(rot);
    // mundo -> círculo (tiles em volta do jogador, girados)
    const P = (x, y) => { const dx = x - me.x, dy = y - me.y; return [R + (dx * cos - dy * sin) * scale, R + (dx * sin + dy * cos) * scale]; };
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.mmCanvas.width, this.mmCanvas.height);
    ctx.setTransform(this.mmDpr, 0, 0, this.mmDpr, 0, 0);
    ctx.save();
    ctx.beginPath(); ctx.arc(R, R, R, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = '#0b1018'; ctx.fillRect(0, 0, S, S);
    // só a parte do mapa que cabe no círculo (o resto da zona nem é copiado)
    const x0 = Math.max(0, me.x - half), x1 = Math.min(z.w, me.x + half), y0 = Math.max(0, me.y - half), y1 = Math.min(z.h, me.y + half);
    if (x1 > x0 && y1 > y0) {
      ctx.save();
      ctx.translate(R, R); ctx.rotate(rot); ctx.scale(scale, scale); ctx.translate(-me.x, -me.y);
      ctx.imageSmoothingEnabled = !!art;
      if (art) { ctx.imageSmoothingQuality = 'high'; ctx.drawImage(art.canvas, x0 * art.S, y0 * art.S, (x1 - x0) * art.S, (y1 - y0) * art.S, x0, y0, x1 - x0, y1 - y0); }
      else ctx.drawImage(this.mmImage, x0 * 2, y0 * 2, (x1 - x0) * 2, (y1 - y0) * 2, x0, y0, x1 - x0, y1 - y0);
      ctx.restore();
    }
    if (dark > 0.1) { ctx.fillStyle = `rgba(5,8,25,${dark * 0.5})`; ctx.fillRect(0, 0, S, S); }
    // cone de visão da câmera
    const cone = ctx.createRadialGradient(R, R, 4, R, R, R * 0.8);
    cone.addColorStop(0, 'rgba(255,255,255,0.28)'); cone.addColorStop(1, 'rgba(255,255,255,0)');
    const yaw = g.renderer.yaw || 0, fx = -Math.sin(yaw), fy = -Math.cos(yaw); // para onde a câmera olha no mundo
    const camA = Math.atan2(fx * sin + fy * cos, fx * cos - fy * sin); // e na tela do minimapa (para cima quando o mapa gira com ela)
    ctx.fillStyle = cone;
    ctx.beginPath(); ctx.moveTo(R, R); ctx.arc(R, R, R * 0.8, camA - 0.62, camA + 0.62); ctx.closePath(); ctx.fill();
    const inside = (px, py, m = 3) => (px - R) * (px - R) + (py - R) * (py - R) < (R - m) * (R - m);
    // portais: um losango azul no lugar do altar
    for (const p of z.def.portals) {
      const [px, py] = P(p.x + p.w / 2, p.y + p.h / 2);
      if (!inside(px, py, 4)) continue;
      ctx.fillStyle = '#5dade2'; ctx.strokeStyle = '#0b1018'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(px, py - 5); ctx.lineTo(px + 4, py); ctx.lineTo(px, py + 5); ctx.lineTo(px - 4, py); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    for (const e of g.entities.values()) {
      const [px, py] = P(e.rx, e.ry);
      if (!inside(px, py)) continue;
      if (e.k === 'm' && !(e.f & F.DEAD)) {
        const boss = MONSTERS[e.m].boss;
        ctx.fillStyle = boss ? '#ff9a1f' : '#e74c3c';
        ctx.fillRect(px - (boss ? 3 : 1.5), py - (boss ? 3 : 1.5), boss ? 6 : 3, boss ? 6 : 3);
      } else if (e.k === 'n') {
        const mark = g.questMarker(e.n);
        ctx.fillStyle = '#f7dc6f';
        ctx.fillRect(px - 2, py - 2, 4, 4);
        if (mark) { ctx.font = 'bold 11px sans-serif'; ctx.fillStyle = mark.c; ctx.fillText(mark.s, px + 3, py - 2); }
      } else if (e.k === 'p' && e.id !== me.id) {
        const party = g.party && g.party.m.some((m) => m.id === e.id);
        ctx.fillStyle = party ? '#2ecc71' : '#85c1e9';
        ctx.beginPath(); ctx.arc(px, py, 2.5, 0, Math.PI * 2); ctx.fill();
      } else if (e.k === 'i' && (e.r || 0) >= 2) {
        ctx.fillStyle = RARITY[e.r].color; ctx.fillRect(px - 1, py - 1, 2, 2);
      }
    }
    const gd = g.guide;
    if (gd.active && gd.wp) {
      if (gd.path.length) {
        ctx.save();
        ctx.strokeStyle = gd.wp.portal ? '#5dade2' : '#ffd34d'; ctx.lineWidth = 2; ctx.setLineDash([4, 3]);
        ctx.beginPath(); ctx.moveTo(R, R);
        for (const p of gd.path) { const [qx, qy] = P(p.x, p.y); ctx.lineTo(qx, qy); }
        ctx.stroke();
        ctx.restore();
      }
      // destino: se estiver fora do círculo, o marcador gruda na borda
      let [dx2, dy2] = P(gd.wp.x, gd.wp.y);
      const out = !inside(dx2, dy2, 8);
      if (out) { const a = Math.atan2(dy2 - R, dx2 - R); dx2 = R + Math.cos(a) * (R - 8); dy2 = R + Math.sin(a) * (R - 8); }
      const pulse = 4.5 + Math.sin(performance.now() / 220) * 1.5;
      ctx.fillStyle = gd.wp.portal ? '#5dade2' : '#ffd34d'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(dx2, dy2, out ? 5 : pulse, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    // jogador: a seta aponta para onde o personagem anda/olha de verdade (ângulo contínuo, não os 4 lados)
    ctx.translate(R, R);
    ctx.rotate(Math.PI - (me.facing || 0) + rot);
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(5, 5); ctx.lineTo(0, 2.5); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
    // bússola na borda: N (vermelho), L, S, O, girando junto com o mapa
    ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const [ch, wx, wy, col] of [['N', 0, -1, '#ff6b5a'], ['L', 1, 0, '#e8d9b0'], ['S', 0, 1, '#e8d9b0'], ['O', -1, 0, '#e8d9b0']]) {
      const px = R + (wx * cos - wy * sin) * (R - 9), py = R + (wx * sin + wy * cos) * (R - 9);
      ctx.fillStyle = 'rgba(8,10,18,0.7)'; ctx.beginPath(); ctx.arc(px, py, 6.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = col; ctx.fillText(ch, px, py + 0.5);
    }
    ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
    const tday = g.dayTime();
    const hours = Math.floor(tday * 24), mins = Math.floor((tday * 24 - hours) * 60);
    const icon = icoHTML(tday > 0.25 && tday < 0.8 ? 'sun' : 'moon');
    const info = `${Math.floor(me.x)}, ${Math.floor(me.y)} · ${icon} ${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')} · ${this.net.latency}ms`;
    if (info !== this.mmInfoText) this.mmInfo.innerHTML = this.mmInfoText = info;
  }

  // ------------------------------------------------------------------ rastreador
  renderTracker() {
    const box = clear(this.tracker);
    const qs = activeQuests(this.me).sort((a, b) => ((b.main || b.saga) ? 1 : 0) - ((a.main || a.saga) ? 1 : 0)).slice(0, 5);
    if (!qs.length) {
      box.appendChild(h('div', { class: 'tr-empty' }, 'Procure NPCs com ', h('b', { class: 'gold' }, '!'), ' para receber missões.'));
      return;
    }
    for (const q of qs) {
      const done = isComplete(this.me, q);
      const tracked = this.game.guide.questId === q.id;
      const go = h('button', {
        class: 'tr-go' + (tracked && this.game.guide.auto ? ' on' : ''), title: 'Ir até o local da missão (anda sozinho)',
        onclick: (ev) => { ev.stopPropagation(); this.goToQuest(q.id); },
      }, ico('pin'), ' Ir');
      const el = h('div', { class: 'tr-quest' + (done ? ' done' : '') + (tracked ? ' tracked' : '') },
        h('div', { class: 'tr-head' }, h('div', { class: 'tr-name' }, ico((q.main || q.saga) ? 'star' : q.repeatable ? 'loop' : 'dot', 'sm'), ' ' + q.name), go));
      if (done) el.appendChild(h('div', { class: 'tr-obj ok' }, `Volte para ${NPCS[q.turnIn].name}`));
      else {
        q.objectives.forEach((o, i) => {
          const p = progress(this.me, q, i), n = need(o);
          el.appendChild(h('div', { class: 'tr-obj' + (p >= n ? ' ok' : '') }, objectiveText(o) + (o.type === 'talk' ? '' : ` ${p}/${n}`)));
        });
      }
      el.addEventListener('click', () => { this.game.guide.track(q.id, false); this.renderTracker(); });
      box.appendChild(el);
    }
  }

  // ------------------------------------------------------------------ guia de missão
  goToQuest(id) {
    const g = this.game.guide;
    if (g.questId === id && g.auto) { g.setAuto(false); this.game.path = null; return; }
    g.track(id, true);
    audio.play('click');
    this.onGuide();
  }

  guideToggleAuto() {
    const g = this.game.guide;
    if (!g.questId) return;
    if (g.auto) { g.setAuto(false); this.game.path = null; } else g.track(g.questId, true);
    this.onGuide();
  }

  onGuide() {
    this.renderTracker();
    this.updateGuideBar();
    if (this.wins.quests?.isOpen) this.renderQuests();
  }

  updateGuideBar() {
    const gd = this.game.guide;
    const show = gd.active && gd.dest;
    this.guideBar.style.display = show ? 'flex' : 'none';
    if (!show) return;
    const where = gd.dest.zone !== this.game.zone.id ? ` · ${ZONES[gd.dest.zone].name}` : '';
    this.guideLabel.textContent = (gd.wp?.portal ? gd.wp.label : gd.dest.label) + where;
    this.guideDist.textContent = gd.arrived ? 'Você chegou' : `${Math.round(gd.dist)} m`;
    this.guideGo.innerHTML = gd.auto ? icoHTML('stop') + ' Parar' : icoHTML('play') + ' Ir';
    this.guideGo.classList.toggle('on', gd.auto);
  }

  // ------------------------------------------------------------------ chat e avisos
  chatMsg(m) {
    const log = this.chatLog;
    const ch = m.c || 'sistema';
    const line = h('div', { class: 'chat-line ch-' + ch + (m.k ? ' k-' + m.k : '') });
    if (ch !== 'sistema') line.appendChild(h('span', { class: 'chat-ch' }, `[${CHANNEL_NAMES[ch] || ch}] `));
    if (m.f) {
      const nm = h('span', { class: 'chat-from' + (m.cls ? ' c-' + m.cls : '') }, m.out ? `Para ${m.to}: ` : `${m.f}: `);
      if (ch !== 'grito') nm.addEventListener('click', () => { this.chatInput.value = `/s ${m.out ? m.to : m.f} `; this.chatInput.focus(); });
      line.appendChild(nm);
    }
    line.appendChild(h('span', { class: 'chat-text' }, m.m));
    const atBottom = log.scrollTop + log.clientHeight >= log.scrollHeight - 30;
    log.appendChild(line);
    while (log.children.length > 150) log.removeChild(log.firstChild);
    if (atBottom) log.scrollTop = log.scrollHeight;
    if (ch === 'grito') this.toast(`${m.f}: ${m.m}`, 'yell');
  }

  toast(text, kind = 'info') {
    // evita repetir a mesma mensagem em sequência
    const now = performance.now();
    if (this.lastToast && this.lastToast.text === text && now - this.lastToast.at < 1500) return;
    this.lastToast = { text, at: now };
    const el = h('div', { class: 'toast t-' + kind }, text);
    this.toasts.appendChild(el);
    while (this.toasts.children.length > 5) this.toasts.removeChild(this.toasts.firstChild);
    setTimeout(() => el.classList.add('out'), kind === 'err' ? 2200 : 3500);
    setTimeout(() => el.remove(), kind === 'err' ? 2700 : 4000);
  }

  // Tela de travessia entre reinos (enquanto os recursos do reino novo são baixados)
  showTransition(title, text) {
    this.hideTransition();
    this.transEl = h('div', { id: 'kingdom-transition' },
      h('div', { class: 'kt-label' }, 'Atravessando a fronteira'),
      h('div', { class: 'kt-title relief', 'data-t': title }, title),
      h('div', { class: 'kt-text' }, text || ''),
      h('div', { class: 'load-bar' }, this.transFill = h('div')));
    document.body.appendChild(this.transEl);
  }

  transitionProgress(p) { if (this.transFill) this.transFill.style.width = Math.round(p * 100) + '%'; }

  hideTransition() {
    if (this.transEl) { this.transEl.remove(); this.transEl = null; this.transFill = null; }
  }

  // aviso de altar descoberto (e atualiza o mapa se estiver aberto, para mostrar o botão de viagem)
  altarFound(a) {
    if (!a) return;
    this.showBanner('Altar descoberto', a.name, 'altar');
    this.toast('Abra o Mapa (M) para viajar entre os altares descobertos.', 'good');
    if (this.wins.map?.isOpen) this.renderMap();
  }

  showBanner(title, sub, kind = 'zone') {
    const b = this.banner;
    b.className = 'show b-' + kind;
    b.innerHTML = `<div class="bn-title relief" data-t="${esc(title)}">${esc(title)}</div>${sub ? `<div class="bn-sub">${esc(sub)}</div>` : ''}`;
    clearTimeout(this.bannerTimer);
    this.bannerTimer = setTimeout(() => { b.className = ''; }, 3200);
  }

  levelUp(lv) {
    this.showBanner(`Nível ${lv}!`, `Você recebeu pontos de atributo. Abra o Personagem (C).`, 'level');
    const cls = CLASSES[this.me.cls];
    for (const id of cls.skills) {
      const sk = SKILLS[id];
      if (sk.lvl === lv) { this.toast(`Nova habilidade: ${sk.name}!`, 'good'); this.chatMsg({ c: 'sistema', m: `Você aprendeu ${sk.name}: ${sk.desc}`, k: 'good' }); }
    }
  }

  questCompleted(qid) {
    const q = QUESTS[qid];
    if (!q) return;
    this.showBanner('Missão concluída', q.name, 'quest');
    const r = q.rewards;
    const parts = [];
    if (r.xp) parts.push(`${fmt(r.xp * (this.game.dev ? 1 : 1))} XP`);
    if (r.gold) parts.push(`${fmt(r.gold)} ouro`);
    for (const [id, n] of r.items || []) parts.push(`${ITEMS[id].name}${n > 1 ? ' x' + n : ''}`);
    if (r.flag) parts.push('Bênção de uma Brasa!');
    if (r.title) parts.push(`Título: ${r.title}`);
    this.chatMsg({ c: 'sistema', m: `Recompensa — ${parts.join(', ')}`, k: 'good' });
  }

  lootNotice(m) {
    const base = ITEMS[m.i];
    if (!base) return;
    const col = base.type === 'quest' ? '#f1c40f' : RARITY[m.r || 0].color;
    const el = h('div', { class: 'loot-line' }, h('img', { src: itemIcon(m.i, 20) }), h('span', { style: { color: col } }, (m.n || base.name) + (m.q > 1 ? ` x${m.q}` : '')));
    this.lootEl.appendChild(el);
    while (this.lootEl.children.length > 6) this.lootEl.removeChild(this.lootEl.firstChild);
    setTimeout(() => el.classList.add('out'), 3500);
    setTimeout(() => el.remove(), 4200);
  }

  // ------------------------------------------------------------------ morte, convites, menus
  showDeath(m) {
    const pvp = this.game.zone.def.pvp;
    this.deathAt = performance.now();
    this.deathBtnText = pvp ? 'Voltar à luta' : 'Renascer em ' + ZONES[hubOf(this.game.zone.id).zone].name;
    clear(this.deathEl).append(
      h('div', { class: 'death-title' }, 'Você caiu'),
      h('div', { class: 'death-sub' }, m.by ? `Derrotado por ${m.by}` : 'A Névoa reclama mais uma alma...'),
      h('div', { class: 'death-tip' }, pvp ? 'Na arena não há penalidade.' : 'Você perdeu um pouco de experiência. Um Clérigo aliado pode ressuscitá-lo com Graça Divina.'),
      h('button', { class: 'btn big', onclick: () => this.send({ t: 'resp' }) }, this.deathBtnText),
    );
    this.deathEl.style.display = 'flex';
  }

  hideDeath() { this.deathEl.style.display = 'none'; }

  showInvite(m) {
    const kinds = {
      party: [`${m.f} convidou você para um grupo.`, (ok) => this.send({ t: 'party', op: ok ? 'accept' : 'decline' })],
      guild: [`${m.f} convidou você para o clã <${m.g}>.`, (ok) => this.send({ t: 'guild', op: ok ? 'accept' : 'decline' })],
      trade: [`${m.f} quer negociar com você.`, (ok) => this.send({ t: 'trade', op: ok ? 'accept' : 'decline' })],
    };
    const [text, fn] = kinds[m.k];
    const el = h('div', { class: 'invite frame' }, h('div', {}, text),
      h('div', { class: 'row' },
        h('button', { class: 'btn', onclick: () => { fn(true); el.remove(); } }, 'Aceitar'),
        h('button', { class: 'btn ghost', onclick: () => { fn(false); el.remove(); } }, 'Recusar')));
    this.invitesEl.appendChild(el);
    setTimeout(() => el.remove(), 30000);
  }

  playerMenu(e, x, y) {
    this.closeMenus();
    const items = [
      ['Sussurrar', () => { this.chatInput.value = `/s ${e.nm} `; this.chatInput.focus(); }],
      ['Convidar para grupo', () => this.send({ t: 'party', op: 'invite', name: e.nm })],
      ['Negociar', () => this.send({ t: 'trade', op: 'req', name: e.nm })],
    ];
    if (this.game.guild && this.game.guild.leader === this.me.name && !e.g) items.push(['Convidar para o clã', () => this.send({ t: 'guild', op: 'invite', name: e.nm })]);
    if (this.game.party && this.game.party.leader === this.me.id && this.game.party.m.some((m) => m.id === e.id)) {
      items.push(['Remover do grupo', () => this.send({ t: 'party', op: 'kick', name: e.nm })]);
      items.push(['Tornar líder', () => this.send({ t: 'party', op: 'lead', name: e.nm })]);
    }
    this.contextMenu(e.nm, items, x, y);
  }

  contextMenu(title, items, x, y) {
    this.closeMenus();
    const el = h('div', { class: 'ctx-menu frame' }, title ? h('div', { class: 'ctx-title' }, title) : null,
      ...items.map(([label, fn, cls]) => h('div', { class: 'ctx-item ' + (cls || ''), onclick: () => { this.closeMenus(); fn(); } }, label)));
    document.body.appendChild(el);
    const r = el.getBoundingClientRect();
    el.style.left = Math.min(x, window.innerWidth - r.width - 4) + 'px';
    el.style.top = Math.min(y, window.innerHeight - r.height - 4) + 'px';
    this.menuEl = el;
    setTimeout(() => {
      const off = (ev) => { if (!el.contains(ev.target)) { this.closeMenus(); document.removeEventListener('mousedown', off); } };
      document.addEventListener('mousedown', off);
    }, 0);
  }

  closeMenus() {
    if (this.menuEl) { this.menuEl.remove(); this.menuEl = null; }
  }

  confirm(text, onYes, opts = {}) {
    const ov = h('div', { class: 'modal-bg' });
    const input = opts.input ? h('input', { class: 'inp', placeholder: opts.placeholder || '', value: opts.value || '' }) : null;
    const box = h('div', { class: 'modal frame' }, h('div', { class: 'modal-text', html: text }), input,
      h('div', { class: 'row' },
        h('button', { class: 'btn', onclick: () => { ov.remove(); onYes(input ? input.value : true); } }, opts.yes || 'Confirmar'),
        h('button', { class: 'btn ghost', onclick: () => ov.remove() }, 'Cancelar')));
    ov.appendChild(box);
    document.body.appendChild(ov);
    if (input) { input.focus(); input.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') { ov.remove(); onYes(input.value); } }); }
  }

  fatal(text) {
    const ov = h('div', { class: 'modal-bg' }, h('div', { class: 'modal frame' }, h('div', { class: 'modal-text' }, text), h('button', { class: 'btn', onclick: () => location.reload() }, 'Recarregar')));
    document.body.appendChild(ov);
  }

  typing() {
    const a = document.activeElement;
    return a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA');
  }

  // teclas de interface; retorna true se consumida
  handleKey(k) {
    const map = { i: 'inventory', b: 'inventory', c: 'character', k: 'skills', j: 'quests', l: 'quests', m: 'map', p: 'social', g: 'guild', n: 'legacy', o: 'ranking', h: 'help' };
    if (k === 'Enter') { this.chatInput.focus(); return true; }
    if (k === 'Escape') {
      if (this.menuEl) { this.closeMenus(); return true; }
      const open = Object.values(this.wins).filter((w) => w.isOpen).sort((a, b) => (+b.el.style.zIndex) - (+a.el.style.zIndex));
      if (open.length) { open[0].close(); return true; }
      if (this.game.target) return false;
      this.toggle('options');
      return true;
    }
    if (k === '/') { this.chatInput.value = '/'; this.chatInput.focus(); return true; }
    if (map[k]) { this.toggle(map[k]); return true; }
    return false;
  }

  toggle(id) {
    const w = this.wins[id];
    if (!w) return;
    audio.play('click');
    if (w.isOpen) w.close(); else this.openWin(id);
  }

  openWin(id) {
    const w = this.wins[id];
    if (!w) return;
    const render = this['render' + id[0].toUpperCase() + id.slice(1)];
    if (render) render.call(this);
    w.open();
    if (id === 'ranking') this.send({ t: 'rank' });
    if (id === 'legacy') this.send({ t: 'leg' });
    if (id === 'guild') this.send({ t: 'guild', op: 'info' });
  }
}

function bar(kind) {
  const fill = h('div', { class: 'fill' });
  const text = h('span');
  const el = h('div', { class: 'bar bar-' + kind }, fill, text);
  let last = '';
  return {
    el,
    set(v, max) {
      const key = Math.round(v) + '/' + max;
      if (key === last) return;
      last = key;
      fill.style.width = Math.max(0, Math.min(100, (v / Math.max(1, max)) * 100)) + '%';
      text.textContent = `${Math.max(0, Math.round(v))} / ${max}`;
    },
  };
}

function setCd(slot, rem, dur) {
  if (rem > 0) {
    const pct = Math.min(1, rem / dur) * 100;
    slot.cd.style.background = `conic-gradient(rgba(0,0,0,0.72) ${pct}%, rgba(0,0,0,0) ${pct}%)`;
    slot.cd.style.display = 'block';
    slot.cdText.textContent = rem > 1000 ? Math.ceil(rem / 1000) : '';
  } else if (slot.cd.style.display !== 'none') {
    slot.cd.style.display = 'none';
    slot.cdText.textContent = '';
  }
}

export function objectiveText(o) {
  switch (o.type) {
    case 'kill': {
      const ids = Array.isArray(o.target) ? o.target : [o.target];
      const names = [...new Set(ids.map((id) => MONSTERS[id].name))];
      return `Derrotar ${names.join(' / ')}`;
    }
    case 'collect': return `Obter ${ITEMS[o.item].name}`;
    case 'talk': return `Falar com ${NPCS[o.npc].name}`;
    case 'pvp': return 'Vencer duelos na Arena';
    default: return '?';
  }
}

Object.assign(UI.prototype, windowsMixin, npcMixin, legacyMixin, worldMapMixin);
export { CHAT };
