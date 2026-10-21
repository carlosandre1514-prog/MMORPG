// Dano, cura, ameaça, mortes, experiência e saque.
import { rollDamage, monsterXp, xpLevelMod, deathXpPenalty } from '../../shared/formulas.js';
import { createItem, rollRarity, randomEquipmentBase } from '../../shared/itemgen.js';
import { ITEMS } from '../../shared/data/items.js';
import { CLASS_LIST } from '../../shared/data/classes.js';
import { COMBAT_TIMEOUT } from '../../shared/constants.js';
import { isSafeAt } from '../../shared/data/zones.js';
import { addStatus, hasStatus, removeStatus, clearStatuses } from './effects.js';
import { onKill, onPvpKill, needsQuestItem } from './quests.js';
import { addItem } from './inventory.js';
import { GroundItem } from '../entities/monster.js';
import { rand } from '../../shared/rng.js';

// Pode "a" causar dano em "b"?
export function isHostile(zone, a, b) {
  if (!a || !b || a === b || !b.alive) return false;
  if (a.isMonster && b.isPlayer) return !b.inSafeArea();
  if (a.isPlayer && b.isMonster) return true;
  if (a.isPlayer && b.isPlayer) {
    if (!zone.def.pvp) return false;
    if (isSafeAt(zone.def, a.x, a.y) || isSafeAt(zone.def, b.x, b.y)) return false;
    if (a.party && a.party === b.party) return false;
    if (a.char.guild && a.char.guild === b.char.guild) return false;
    return true;
  }
  return false;
}

export function isFriendly(zone, a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.isPlayer && b.isPlayer) return !zone.def.pvp || (a.party && a.party === b.party) || (a.char.guild && a.char.guild === b.char.guild) || isSafeAt(zone.def, b.x, b.y);
  if (a.isMonster && b.isMonster) return true;
  return false;
}

export function attackerStats(src) {
  if (src.isPlayer) return { power: src.stats.power, lvl: src.level, crit: src.stats.crit, critMult: src.stats.critMult };
  return { power: src.power, lvl: src.lvl, crit: src.crit, critMult: 1.5 };
}

export function targetDefense(tgt) {
  return tgt.isPlayer ? tgt.stats.def : tgt.defense;
}

// Calcula dano de um ataque/habilidade (ainda sem aplicar).
export function computeHit(src, tgt, mult, opts = {}) {
  const a = attackerStats(src);
  let dmg = rollDamage(a.power, mult, targetDefense(tgt), a.lvl);
  const critChance = a.crit + (opts.critBonus || 0);
  const crit = !opts.noCrit && Math.random() * 100 < critChance;
  if (crit) dmg *= a.critMult;
  if (opts.holy && tgt.isMonster && (tgt.def.undead || tgt.def.voidborn)) dmg *= 1.5;
  // JxJ: dano reduzido para combates mais longos
  if (src.isPlayer && tgt.isPlayer) dmg *= 0.6;
  return { dmg, crit };
}

export function addThreat(m, p, amount) {
  if (!m.isMonster || !p || !p.isPlayer) return;
  m.threat.set(p.id, (m.threat.get(p.id) || 0) + amount);
  if (!m.tagOwner) m.tagOwner = p.id;
  if (m.state !== 'chase' && m.state !== 'return') {
    m.state = 'chase';
    m.target = p;
    // monstros próximos do mesmo tipo ajudam (bando)
    if (!m.def.boss) {
      for (const o of m.zone.monsters) {
        if (o !== m && o.alive && o.state === 'idle' && o.def.id === m.def.id && Math.hypot(o.x - m.x, o.y - m.y) < 5) {
          o.threat.set(p.id, 1);
          o.state = 'chase';
          o.target = p;
        }
      }
    }
  }
}

export function dealDamage(zone, src, tgt, amount, opts = {}) {
  if (!tgt || !tgt.alive) return 0;
  const now = Date.now();
  if (hasStatus(tgt, 'invuln') || (tgt.isMonster && tgt.state === 'return')) {
    zone.fx({ k: 'mi', id: tgt.id, t: 'Imune' }, tgt.x, tgt.y);
    return 0;
  }
  if (tgt.isPlayer && !opts.dot && !opts.noDodge && Math.random() * 100 < tgt.stats.dodge) {
    zone.fx({ k: 'mi', id: tgt.id, t: 'Esquiva' }, tgt.x, tgt.y);
    return 0;
  }
  let dmg = amount;
  const dr = tgt.isPlayer ? tgt.mods.dr : tgt.dr;
  if (dr) dmg *= 1 - dr;
  dmg = Math.max(1, Math.round(dmg));
  // escudos absorvem
  let absorbed = 0;
  for (const s of tgt.statuses) {
    if (s.type !== 'shield' || dmg <= 0) continue;
    const take = Math.min(s.amount, dmg);
    s.amount -= take;
    dmg -= take;
    absorbed += take;
    if (s.amount <= 0) s.until = 0;
  }
  if (absorbed) removeStatus(tgt, (s) => s.type === 'shield' && s.amount <= 0);
  tgt.hp -= dmg;
  zone.fx({ k: 'd', id: tgt.id, v: dmg, c: opts.crit ? 1 : 0, h: opts.dot ? 'o' : (opts.magic ? 'm' : 'p'), ab: absorbed || undefined, s: src ? src.id : 0 }, tgt.x, tgt.y);
  if (src) src.combatUntil = now + COMBAT_TIMEOUT * 1000;
  tgt.combatUntil = now + COMBAT_TIMEOUT * 1000;
  if (tgt.isMonster && src && src.isPlayer) addThreat(tgt, src, (dmg + absorbed) * (opts.threatMult || 1));
  if (tgt.isPlayer && tgt.casting && tgt.casting.interruptible) {
    tgt.casting = null;
    tgt.send({ t: 'castEnd', ok: false });
    tgt.err('Concentração interrompida!');
  }
  if (src && src.alive && src.isPlayer && !opts.dot && src.stats.lifesteal > 0 && dmg > 0) {
    heal(zone, src, src, (dmg * src.stats.lifesteal) / 100, { silent: true });
  }
  if (src && src.alive && src.isMonster && opts.drain) {
    heal(zone, src, src, dmg * opts.drain, { silent: false });
  }
  if (tgt.isPlayer) tgt.dirty.me = true;
  if (tgt.hp <= 0) {
    tgt.hp = 0;
    if (tgt.isMonster) killMonster(zone, tgt, src);
    else killPlayer(zone, tgt, src);
  }
  return dmg;
}

export function heal(zone, src, tgt, amount, opts = {}) {
  if (!tgt || !tgt.alive) return 0;
  const max = tgt.isPlayer ? tgt.stats.maxHp : tgt.maxHp;
  const v = Math.max(0, Math.min(Math.round(amount), max - tgt.hp));
  tgt.hp += v;
  if (tgt.isPlayer) tgt.dirty.me = true;
  if (!opts.silent && v > 0) zone.fx({ k: 'h', id: tgt.id, v }, tgt.x, tgt.y);
  // cura gera ameaça nos monstros que estão lutando contra o curado
  if (src && src.isPlayer && v > 0 && tgt.isPlayer) {
    for (const m of zone.monsters) {
      if (m.alive && m.threat.has(tgt.id)) addThreat(m, src, v * 0.5);
    }
    src.combatUntil = Math.max(src.combatUntil, tgt.combatUntil);
  }
  return v;
}

// ---------------------------------------------------------------- mortes

function killMonster(zone, m, killer) {
  const world = zone.world;
  m.dead = true;
  m.deathAt = Date.now();
  m.windup = null;
  m.statuses = [];
  m.flagsDirty = true;
  zone.onMonsterDeath(m);
  for (const s of m.summons) if (s.alive) { s.dead = true; s.deathAt = Date.now(); zone.onMonsterDeath(s); }

  let owner = zone.world.players.get(m.tagOwner);
  if (!owner || owner.zone !== zone) owner = killer && killer.isPlayer && killer.zone === zone ? killer : null;
  if (!owner) return;
  // participantes: grupo do dono no mesmo mapa, por perto
  let parts = [owner];
  if (owner.party) {
    parts = owner.party.members
      .map((id) => world.players.get(id))
      .filter((p) => p && p.zone === zone && Math.hypot(p.x - m.x, p.y - m.y) < 40);
  }
  const def = m.def;
  const baseXp = monsterXp(m.lvl) * (def.xpMult || 1) * world.xpRate;
  const n = parts.length;
  const share = n > 1 ? (1 + 0.15 * (n - 1)) / n : 1;
  const goldTotal = rand.int(def.gold[0], def.gold[1]) * (1 + m.lvl * 0.05);
  for (const p of parts) {
    const xp = baseXp * share * xpLevelMod(p.level, m.lvl);
    if (p.alive) world.giveXp(p, Math.max(1, Math.round(xp)));
    const g = Math.floor(goldTotal / n);
    if (g > 0) world.giveGold(p, g, true);
    p.char.record.kills++;
    if (def.boss) p.char.record.bossKills++;
    onKill(p, def.id);
    // itens de missão vão direto para o inventário de quem precisa
    for (const qd of def.questDrops || []) {
      if (needsQuestItem(p.char, qd.id, qd.quest) && Math.random() < qd.chance) {
        if (addItem(p.char.inv, createItem(qd.id))) {
          p.dirty.inv = true;
          p.dirty.quests = true;
          p.send({ t: 'loot', i: qd.id, q: 1 });
        } else p.err('Inventário cheio! Item de missão perdido.');
      }
    }
  }
  if (def.boss) {
    world.broadcastSystem(`${owner.party ? 'O grupo de ' : ''}${owner.name} derrotou ${def.name}, ${def.title}!`, 'boss');
  }
  // saque no chão (criaturas invocadas não deixam itens)
  if (m.summoned) return;
  const drops = [];
  const luck = def.boss ? 2 : 0;
  for (const d of def.drops || []) {
    if (Math.random() < d.chance) {
      const q = d.qty ? rand.int(d.qty[0], d.qty[1]) : 1;
      drops.push(createItem(d.id, { qty: q }));
    }
  }
  const cls = owner.cls;
  const equipRolls = def.equipDrops || (Math.random() < (def.equipChance || 0) ? 1 : 0);
  for (let i = 0; i < equipRolls; i++) {
    const base = randomEquipmentBase(m.lvl, rand, cls);
    if (base) drops.push(createItem(base.id, { rarity: rollRarity(rand, luck) }));
  }
  if (def.uniqueDrop && Math.random() < def.uniqueDrop.chance) drops.push(createItem(def.uniqueDrop.id));
  if (def.legendWeapon && Math.random() < def.legendWeapon) {
    const clsPick = Math.random() < 0.6 ? cls : rand.pick(CLASS_LIST);
    drops.push(createItem(`u_${clsPick}_legend`));
  }
  const owners = parts.map((p) => p.id);
  drops.forEach((it, i) => {
    const ang = (i / Math.max(1, drops.length)) * Math.PI * 2 + Math.random();
    const r = drops.length > 1 ? 0.6 + Math.random() * 0.6 : 0.2;
    zone.addGroundItem(new GroundItem(zone, it, m.x + Math.cos(ang) * r, m.y + Math.sin(ang) * r, owners));
  });
}

function killPlayer(zone, p, killer) {
  const world = zone.world;
  p.dead = true;
  p.hp = 0;
  p.casting = null;
  p.attackTarget = null;
  clearStatuses(p, true);
  p.char.record.deaths++;
  for (const m of zone.monsters) {
    if (m.threat.delete(p.id) && m.target === p) m.target = null;
  }
  const pvp = killer && killer.isPlayer;
  if (pvp) {
    killer.char.record.pvpKills++;
    onPvpKill(killer);
    zone.chatAll({ t: 'chat', c: 'sistema', m: `⚔ ${killer.name} derrotou ${p.name} na arena!` });
  } else if (!zone.def.pvp) {
    const loss = Math.min(p.char.xp, deathXpPenalty(p.level));
    p.char.xp -= loss;
    if (loss > 0) p.msg(`Você perdeu ${loss} de experiência.`, 'warn');
  }
  if (world.trades) world.cancelTrade(p, 'O comércio foi cancelado.');
  p.dirty.me = true;
  p.send({ t: 'dead', by: killer ? killer.name : null, pvp: !!zone.def.pvp });
}

export function revivePlayer(zone, p, pct) {
  if (!p.dead) return;
  p.dead = false;
  p.hp = Math.max(1, Math.round(p.stats.maxHp * pct));
  p.mp = Math.max(p.mp, Math.round(p.stats.maxMp * pct));
  p.dirty.me = true;
  zone.fx({ k: 'rv', id: p.id }, p.x, p.y);
  p.send({ t: 'alive' });
}

export function applyStun(tgt, dur, now) {
  addStatus(tgt, { id: 'stun', type: 'stun', dur }, now);
  if (tgt.isPlayer && tgt.casting) {
    tgt.casting = null;
    tgt.send({ t: 'castEnd', ok: false });
  }
}

export { ITEMS };
