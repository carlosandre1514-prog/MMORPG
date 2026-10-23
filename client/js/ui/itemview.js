// Exibição de itens: slots com ícone e tooltips detalhados com comparação.
import { ITEMS, isEquipment } from '/shared/data/items.js';
import { CLASSES } from '/shared/data/classes.js';
import { RARITY, SLOT_NAMES, STAT_NAMES, PERCENT_STATS } from '/shared/constants.js';
import { itemName, itemStats, sellPrice, rarityColor } from '/shared/itemgen.js';
import { itemIcon } from '../sprites.js';
import { h, esc } from './dom.js';
import { ico } from './icons.js';

const TYPE_NAMES = { weapon: 'Arma', armor: 'Armadura', accessory: 'Acessório', consumable: 'Consumível', material: 'Material', quest: 'Item de missão' };
const STAT_ORDER = ['str', 'dex', 'int', 'vit', 'hp', 'mp', 'power', 'def', 'crit', 'haste', 'lifesteal', 'speed'];

export function slotEl(item, opts = {}) {
  const el = h('div', { class: 'slot' + (opts.cls ? ' ' + opts.cls : '') });
  if (opts.empty && !item) el.appendChild(h('span', { class: 'slot-empty' }, ico(opts.empty))); // opts.empty = nome de um ícone
  if (item) {
    const base = ITEMS[item.id];
    el.appendChild(h('img', { src: itemIcon(item.id), draggable: 'false', alt: '' }));
    el.style.borderColor = rarityColor(item);
    if ((item.r || 0) >= 2) el.style.boxShadow = `inset 0 0 8px ${rarityColor(item)}`;
    if (item.q > 1) el.appendChild(h('span', { class: 'slot-qty' }, String(item.q)));
    if (item.p > 0) el.appendChild(h('span', { class: 'slot-plus' }, '+' + item.p));
    if (opts.me && base && base.lvl > opts.me.level) el.classList.add('slot-locked');
    if (opts.me && base && base.cls && base.cls !== opts.me.cls) el.classList.add('slot-locked');
    el.dataset.tip = '1';
    el._tip = () => itemTooltip(item, opts);
  }
  return el;
}

export function statLine(k, v, diff) {
  const name = STAT_NAMES[k] || k;
  const pct = PERCENT_STATS.has(k) ? '%' : '';
  let d = '';
  if (diff) d = ` <span class="${diff > 0 ? 'up' : 'down'}">(${diff > 0 ? '+' : ''}${diff}${pct})</span>`;
  return `<div class="tt-stat">+${v}${pct} ${esc(name)}${d}</div>`;
}

export function itemTooltip(item, opts = {}) {
  const base = ITEMS[item.id];
  if (!base) return '';
  const me = opts.me;
  const col = rarityColor(item);
  let html = `<div class="tt-name" style="color:${col}">${esc(itemName(item))}</div>`;
  const parts = [];
  if (isEquipment(base)) parts.push(base.unique ? 'Lendário Único' : RARITY[item.r || 0].name);
  parts.push(TYPE_NAMES[base.type] || base.type);
  if (base.slot) parts.push(SLOT_NAMES[base.slot]);
  html += `<div class="tt-sub">${parts.join(' · ')}</div>`;
  if (isEquipment(base)) {
    const st = itemStats(item);
    let cmp = null;
    if (opts.compare !== false && me && me.equip && base.slot) {
      const eq = me.equip[base.slot];
      if (eq && eq.u !== item.u) cmp = itemStats(eq);
    }
    const diff = (k) => (cmp ? (st[k] || 0) - (cmp[k] || 0) : 0);
    if (st.dmg) html += `<div class="tt-main">Dano da arma: <b>${st.dmg}</b>${cmp ? diffSpan(diff('dmg')) : ''}</div>`;
    if (st.def) html += `<div class="tt-main">Armadura: <b>${st.def}</b>${cmp ? diffSpan(diff('def')) : ''}</div>`;
    for (const k of STAT_ORDER) if (st[k]) html += statLine(k, st[k], cmp ? diff(k) : 0);
    if (cmp) {
      const lost = STAT_ORDER.filter((k) => cmp[k] && !st[k]);
      for (const k of lost) html += `<div class="tt-stat down">−${cmp[k]}${PERCENT_STATS.has(k) ? '%' : ''} ${STAT_NAMES[k]}</div>`;
      html += '<div class="tt-cmp">Comparado ao equipado</div>';
    }
    if (item.p) html += `<div class="tt-plus">Aprimorado +${item.p}</div>`;
  }
  if (base.use) {
    if (base.use.hp) html += `<div class="tt-use">Usar: restaura ${base.use.hp} de vida</div>`;
    if (base.use.mp) html += `<div class="tt-use">Usar: restaura ${base.use.mp} de mana</div>`;
  }
  if (base.desc) html += `<div class="tt-desc">${esc(base.desc)}</div>`;
  if (base.lvl > 1 || base.cls) {
    const okL = !me || me.level >= base.lvl;
    const okC = !base.cls || !me || me.cls === base.cls;
    if (base.lvl > 1) html += `<div class="tt-req ${okL ? '' : 'bad'}">Requer nível ${base.lvl}</div>`;
    if (base.cls) html += `<div class="tt-req ${okC ? '' : 'bad'}">Classe: ${CLASSES[base.cls].name}</div>`;
  }
  if (opts.price != null) html += `<div class="tt-price">Preço: <span class="gold">${opts.price}</span> ouro</div>`;
  else if (base.type !== 'quest') html += `<div class="tt-price">Venda: <span class="gold">${sellPrice(item) * (item.q || 1)}</span> ouro</div>`;
  if (opts.hint) html += `<div class="tt-hint">${opts.hint}</div>`;
  return html;
}

function diffSpan(d) {
  if (!d) return '';
  return ` <span class="${d > 0 ? 'up' : 'down'}">(${d > 0 ? '+' : ''}${d})</span>`;
}

// Tooltip global que segue o mouse
export class Tooltip {
  constructor() {
    this.el = h('div', { id: 'tooltip' });
    document.body.appendChild(this.el);
    document.addEventListener('mouseover', (e) => {
      const t = e.target.closest ? e.target.closest('[data-tip]') : null;
      if (!t) { this.hide(); return; }
      const content = t._tip ? t._tip() : t.getAttribute('data-tip');
      if (!content || content === '1') { this.hide(); return; }
      this.el.innerHTML = content;
      this.el.style.display = 'block';
      this.move(e);
    });
    document.addEventListener('mousemove', (e) => { if (this.el.style.display === 'block') this.move(e); });
    document.addEventListener('mousedown', () => this.hide());
  }

  move(e) {
    const r = this.el.getBoundingClientRect();
    let x = e.clientX + 16, y = e.clientY + 14;
    if (x + r.width > window.innerWidth - 4) x = e.clientX - r.width - 12;
    if (y + r.height > window.innerHeight - 4) y = window.innerHeight - r.height - 4;
    this.el.style.left = x + 'px';
    this.el.style.top = Math.max(4, y) + 'px';
  }

  hide() { this.el.style.display = 'none'; }
}

export { TYPE_NAMES };
