// Fórmulas de progressão e combate (compartilhadas para o cliente exibir os mesmos números).
import { CLASSES } from './data/classes.js';
import { ITEMS } from './data/items.js';
import { itemStats } from './itemgen.js';
import { MAX_LEVEL, EQUIP_SLOTS } from './constants.js';

export function xpToNext(lvl) {
  if (lvl >= MAX_LEVEL) return 0;
  return Math.round(40 * lvl * lvl + 60 * lvl);
}

export function monsterXp(lvl) {
  return Math.round(10 + 7 * lvl + 0.9 * lvl * lvl);
}

// Modificador de XP pela diferença de nível (monstros fracos dão pouco).
export function xpLevelMod(playerLvl, monLvl) {
  const d = monLvl - playerLvl;
  if (d >= 0) return 1 + Math.min(5, d) * 0.1;
  if (d >= -2) return 1;
  if (d >= -4) return 0.6;
  if (d >= -6) return 0.3;
  return 0.1;
}

export function monsterStats(def, lvl) {
  return {
    maxHp: Math.round((35 + 18 * lvl + 1.6 * lvl * lvl) * (def.hp ?? 1)),
    power: (5 + 3 * lvl + 0.06 * lvl * lvl) * (def.dmg ?? 1),
    def: (2 + 2.2 * lvl) * (def.def ?? 1),
    crit: def.boss ? 8 : 5,
  };
}

// Atributos derivados de um personagem.
// mods: modificadores temporários vindos de efeitos (power%, def%, crit, haste, lifesteal, speed%)
export function computeStats(ch, mods = {}) {
  const cls = CLASSES[ch.cls];
  const lvl = ch.level;
  const g = {};
  for (const slot of EQUIP_SLOTS) {
    const it = ch.equip && ch.equip[slot];
    if (!it) continue;
    const st = itemStats(it);
    for (const [k, v] of Object.entries(st)) g[k] = (g[k] || 0) + v;
  }
  const attr = {};
  for (const k of ['str', 'dex', 'int', 'vit']) {
    attr[k] = cls.base[k] + cls.growth[k] * (lvl - 1) + ((ch.alloc && ch.alloc[k]) || 0) + (g[k] || 0);
  }
  const flags = ch.flags || {};
  let maxHp = cls.baseHp + cls.hpPerLvl * (lvl - 1) + attr.vit * 8 + (g.hp || 0);
  if (flags.brasa_vida) maxHp *= 1.1;
  const maxMp = cls.baseMp + cls.mpPerLvl * (lvl - 1) + attr.int * 4 + (g.mp || 0);
  const weaponDmg = g.dmg || 3;
  const primary = attr[cls.primary];
  let power = weaponDmg + primary * 1.2 + (g.power || 0);
  if (flags.brasa_espirito) power *= 1.1;
  power *= 1 + (mods.power || 0);
  let def = (g.def || 0) + attr.vit * 0.6;
  if (flags.brasa_terra) def *= 1.1;
  def *= 1 + (mods.def || 0);
  const crit = Math.min(75, 5 + attr.dex * 0.12 + (g.crit || 0) + (mods.crit || 0));
  const haste = Math.min(80, attr.dex * 0.15 + (g.haste || 0) + (mods.haste || 0));
  const speedPct = Math.min(40, (g.speed || 0) + (mods.speed || 0) * 100);
  return {
    ...attr,
    maxHp: Math.round(maxHp),
    maxMp: Math.round(maxMp),
    power: Math.round(power),
    def: Math.round(def),
    crit: Math.round(crit * 10) / 10,
    critMult: 1.6,
    haste: Math.round(haste),
    atkInterval: cls.atkInterval / (1 + haste / 100),
    atkRange: cls.atkRange,
    speed: 4.6 * (1 + speedPct / 100) * (mods.slow ? 1 - mods.slow : 1),
    dodge: Math.min(15, attr.dex * 0.06),
    lifesteal: Math.min(30, (g.lifesteal || 0) + (mods.lifesteal || 0)),
    hpRegen: 0.5 + attr.vit * 0.06,
    mpRegen: 0.8 + attr.int * 0.05,
    weaponDmg,
  };
}

// Redução de dano pela defesa (escala com o nível do atacante).
export function damageReduction(def, attackerLvl) {
  return def / (def + 40 + 8 * attackerLvl);
}

export function rollDamage(power, mult, targetDef, attackerLvl, rng = Math.random) {
  const raw = power * mult * (0.9 + rng() * 0.2);
  return Math.max(1, raw * (1 - damageReduction(targetDef, attackerLvl)));
}

export function canEquip(ch, item) {
  const base = ITEMS[item.id];
  if (!base || !base.slot) return 'Este item não pode ser equipado.';
  if (base.lvl > ch.level) return `Requer nível ${base.lvl}.`;
  if (base.cls && base.cls !== ch.cls) return `Apenas para ${CLASSES[base.cls].name}.`;
  return null;
}

// Aprimoramento na ferreira.
export const MAX_PLUS = 10;
export function enhanceChance(plus) {
  return [1, 0.95, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2][plus] ?? 0;
}
export function enhanceCost(item) {
  const base = ITEMS[item.id];
  const p = item.p || 0;
  return {
    gold: Math.round(60 * (p + 1) * (1 + base.lvl / 8)),
    stones: Math.ceil((p + 1) / 3),
  };
}
// A partir de +5 uma falha reduz o nível de aprimoramento.
export function enhanceFailDowngrade(plus) {
  return plus >= 5;
}

export function deathXpPenalty(lvl) {
  return Math.floor(xpToNext(lvl) * 0.04);
}
