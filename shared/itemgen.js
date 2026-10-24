// Geração de instâncias de itens: raridade, afixos aleatórios e nomes.
import { ITEMS, isEquipment } from './data/items.js';
import { rand, uid } from './rng.js';
import { RARITY } from './constants.js';
import { evLevel } from './levels.js';

// Valor base de cada afixo em função do nível do item (na escala interna de combate, ver levels.js).
const AFFIX_DEFS = {
  str: { w: 10, v: (l) => 1 + l * 0.35 },
  dex: { w: 10, v: (l) => 1 + l * 0.35 },
  int: { w: 10, v: (l) => 1 + l * 0.35 },
  vit: { w: 10, v: (l) => 1 + l * 0.35 },
  hp: { w: 8, v: (l) => 8 + l * 4 },
  mp: { w: 6, v: (l) => 6 + l * 3 },
  power: { w: 6, v: (l) => 1 + l * 0.45 },
  def: { w: 6, v: (l) => 1 + l * 0.4 },
  crit: { w: 4, v: (l) => 1 + l * 0.08 },
  haste: { w: 3, v: (l) => 2 + l * 0.12 },
  lifesteal: { w: 2, v: (l) => 1 + l * 0.05 },
  speed: { w: 2, v: (l) => 2 + l * 0.1, slots: ['feet', 'amulet'] },
};

const SUFFIX = {
  str: 'do Touro', dex: 'da Águia', int: 'do Sábio', vit: 'do Urso', hp: 'da Vitalidade',
  mp: 'da Mente', power: 'da Ruína', def: 'da Muralha', crit: 'da Precisão',
  haste: 'do Vento', lifesteal: 'do Vampiro', speed: 'da Lebre',
};

export function rollRarity(rng = rand, luck = 0) {
  // luck: 0 normal, 1 elite, 2 chefe
  const r = rng();
  const table = [
    [0.004, 0.03, 0.12, 0.40],  // normal: lend, épico, raro, incomum
    [0.01, 0.06, 0.22, 0.55],
    [0.06, 0.25, 0.65, 1.0],    // chefe: sempre incomum ou melhor
  ][Math.min(2, luck)];
  if (r < table[0]) return 4;
  if (r < table[1]) return 3;
  if (r < table[2]) return 2;
  if (r < table[3]) return 1;
  return 0;
}

function rollAffixes(base, rarity, rng) {
  const count = Math.min(4, rarity);
  const out = {};
  const pool = Object.entries(AFFIX_DEFS).filter(([, d]) => !d.slots || d.slots.includes(base.slot));
  for (let i = 0; i < count; i++) {
    const avail = pool.filter(([k]) => !(k in out));
    let total = 0;
    for (const [, d] of avail) total += d.w;
    let pick = rng() * total;
    let key = avail[0][0];
    for (const [k, d] of avail) {
      pick -= d.w;
      if (pick <= 0) { key = k; break; }
    }
    const val = AFFIX_DEFS[key].v(evLevel(base.lvl)) * (0.6 + rng() * 0.6) * (1 + rarity * 0.1);
    out[key] = Math.max(1, Math.round(val));
  }
  return out;
}

export function createItem(baseId, opts = {}) {
  const base = ITEMS[baseId];
  if (!base) throw new Error('Item desconhecido: ' + baseId);
  const rng = opts.rng || rand;
  const item = { u: uid(), id: baseId };
  if (base.stack) {
    item.q = Math.max(1, opts.qty || 1);
    return item;
  }
  if (isEquipment(base)) {
    let r = opts.rarity ?? 0;
    if (base.unique) r = 4;
    if (opts.minRarity != null) r = Math.max(r, opts.minRarity);
    item.r = r;
    item.p = 0;
    item.a = base.unique ? {} : rollAffixes(base, r, rng);
  }
  return item;
}

// Escolhe um equipamento adequado ao nível do monstro.
export function randomEquipmentBase(lvl, rng = rand, cls = null) {
  const ev = evLevel(lvl);
  const candidates = Object.values(ITEMS).filter((b) =>
    isEquipment(b) && !b.unique && b.lvl <= lvl && evLevel(b.lvl) >= ev - 7);
  let list = candidates.length ? candidates : Object.values(ITEMS).filter((b) => isEquipment(b) && !b.unique && b.lvl <= Math.max(1, lvl));
  // Leve preferência por armas da classe de quem saqueou.
  if (cls && rng() < 0.35) {
    const own = list.filter((b) => b.type === 'weapon' && b.cls === cls);
    if (own.length) list = own;
  }
  return rng.pick ? rng.pick(list) : list[Math.floor(rng() * list.length)];
}

export function itemName(item) {
  const base = ITEMS[item.id];
  if (!base) return '???';
  let name = base.name;
  if (item.r >= 2 && !base.unique && item.a) {
    let best = null, bestV = -1;
    for (const [k, v] of Object.entries(item.a)) {
      const norm = v / AFFIX_DEFS[k].v(evLevel(base.lvl));
      if (norm > bestV) { bestV = norm; best = k; }
    }
    if (best) name += ' ' + SUFFIX[best];
  }
  if (item.p > 0) name += ` +${item.p}`;
  return name;
}

export function rarityColor(item) {
  if (!item) return RARITY[0].color;
  const base = ITEMS[item.id];
  if (base && base.type === 'quest') return '#f1c40f';
  return RARITY[item.r || 0].color;
}

// Estatísticas totais de uma instância (base + fixos + afixos, com aprimoramento).
export function itemStats(item) {
  const base = ITEMS[item.id];
  const out = {};
  if (!base) return out;
  const plus = item.p || 0;
  const mainMul = 1 + plus * 0.1;
  const subMul = 1 + plus * 0.04;
  if (base.dmg) out.dmg = Math.round(base.dmg * mainMul);
  if (base.def) out.def = Math.round(base.def * mainMul);
  const addAll = (obj) => {
    if (!obj) return;
    for (const [k, v] of Object.entries(obj)) out[k] = (out[k] || 0) + Math.round(v * subMul);
  };
  addAll(base.base);
  addAll(base.fixed);
  addAll(item.a);
  return out;
}

export function sellPrice(item) {
  const base = ITEMS[item.id];
  if (!base || base.type === 'quest') return 0;
  const r = item.r || 0, p = item.p || 0;
  return Math.max(1, Math.floor(base.price * (1 + r * 0.6) * (1 + p * 0.25) * 0.25));
}

export function buyPrice(baseId) {
  const base = ITEMS[baseId];
  return base ? base.price : 0;
}
