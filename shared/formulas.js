// Fórmulas de progressão e combate (compartilhadas para o cliente exibir os mesmos números).
import { CLASSES } from './data/classes.js';
import { ITEMS } from './data/items.js';
import { itemStats } from './itemgen.js';
import { MAX_LEVEL, EQUIP_SLOTS } from './constants.js';
import { masteryBonus } from './mastery.js';
import { evLevel, LEVEL_RATIO } from './levels.js';

// Os números de combate seguem a escala interna (ver levels.js): um nível de hoje vale uma fração de um nível antigo.
// XP_HARDER deixa o caminho até o nível máximo um pouco mais longo do que era na escala antiga.
export const XP_HARDER = 1.15;

// A curva antiga cobrava 40n² + 60n para ir do nível n ao n+1, em degraus inteiros. Esta é a mesma curva em passos mais finos:
// a derivada do XP acumulado dessa curva (f(e) - f'(e)/2, com f = 40e² + 60e) medida no meio de cada degrau, que passa pelos
// mesmos pontos acumulados, só que dividida entre os níveis de hoje.
export function xpToNext(lvl) {
  if (lvl >= MAX_LEVEL) return 0;
  const e = evLevel(lvl) + 0.5 / LEVEL_RATIO;
  return Math.max(1, Math.round(XP_HARDER * (40 * e * e + 20 * e - 30) / LEVEL_RATIO));
}

// XP que um nível valeria na escala antiga: base das recompensas dadas como "fração de um nível" e da penalidade de morte.
export function xpStep(lvl) {
  return xpToNext(lvl) * LEVEL_RATIO;
}

export function monsterXp(lvl) {
  const ev = evLevel(lvl);
  return Math.round(10 + 7 * ev + 0.9 * ev * ev);
}

// Modificador de XP pela diferença de nível (monstros fracos dão pouco).
export function xpLevelMod(playerLvl, monLvl) {
  const d = evLevel(monLvl) - evLevel(playerLvl);
  if (d >= 0) return 1 + Math.min(5, d) * 0.1;
  if (d >= -2) return 1;
  if (d >= -4) return 0.6;
  if (d >= -6) return 0.3;
  return 0.1;
}

export function monsterStats(def, level) {
  const lvl = evLevel(level);
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
  const lvl = evLevel(ch.level);
  const g = {};
  for (const slot of EQUIP_SLOTS) {
    const it = ch.equip && ch.equip[slot];
    if (!it) continue;
    const st = itemStats(it);
    for (const [k, v] of Object.entries(st)) g[k] = (g[k] || 0) + v;
  }
  const attr = {};
  for (const k of ['str', 'dex', 'int', 'vit']) {
    attr[k] = Math.round(cls.base[k] + cls.growth[k] * (lvl - 1)) + ((ch.alloc && ch.alloc[k]) || 0) + (g[k] || 0);
  }
  const flags = ch.flags || {};
  const mb = masteryBonus(ch.mastery && ch.mastery.ranks); // graus gastos em maestria
  let maxHp = cls.baseHp + cls.hpPerLvl * (lvl - 1) + attr.vit * 8 + (g.hp || 0);
  if (flags.brasa_vida) maxHp *= 1.1;
  maxHp *= 1 + mb.hp;
  const maxMp = cls.baseMp + cls.mpPerLvl * (lvl - 1) + attr.int * 4 + (g.mp || 0);
  const weaponDmg = g.dmg || 3;
  const primary = attr[cls.primary];
  let power = weaponDmg + primary * 1.2 + (g.power || 0);
  if (flags.brasa_espirito) power *= 1.1;
  power *= 1 + (mods.power || 0) + mb.power;
  let def = (g.def || 0) + attr.vit * 0.6;
  if (flags.brasa_terra) def *= 1.1;
  def *= 1 + (mods.def || 0) + mb.def;
  const crit = Math.min(75, 5 + attr.dex * 0.12 + (g.crit || 0) + (mods.crit || 0) + mb.crit);
  const haste = Math.min(80, attr.dex * 0.15 + (g.haste || 0) + (mods.haste || 0) + mb.haste);
  const speedPct = Math.min(40, (g.speed || 0) + (mods.speed || 0) * 100 + mb.speed * 100);
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
    lifesteal: Math.min(30, (g.lifesteal || 0) + (mods.lifesteal || 0) + mb.lifesteal),
    hpRegen: 0.5 + attr.vit * 0.06,
    mpRegen: 0.8 + attr.int * 0.05,
    weaponDmg,
  };
}

// Redução de dano pela defesa (escala com o nível do atacante).
export function damageReduction(def, attackerLvl) {
  return def / (def + 40 + 8 * evLevel(attackerLvl));
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
    gold: Math.round(60 * (p + 1) * (1 + evLevel(base.lvl) / 8)),
    stones: Math.ceil((p + 1) / 3),
  };
}
// A partir de +5 uma falha reduz o nível de aprimoramento.
export function enhanceFailDowngrade(plus) {
  return plus >= 5;
}

export function deathXpPenalty(lvl) {
  return Math.floor(xpStep(lvl) * 0.04);
}
