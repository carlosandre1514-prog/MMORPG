// Execução das habilidades de classe e do ataque básico.
import { SKILLS } from '../../shared/data/skills.js';
import { CLASSES } from '../../shared/data/classes.js';
import { GLOBAL_COOLDOWN } from '../../shared/constants.js';
import { castRay, canStand } from '../../shared/collision.js';
import { addStatus, removeStatus, hasStatus } from './effects.js';
import { dealDamage, heal, computeHit, isHostile, isFriendly, addThreat, revivePlayer, applyStun } from './combat.js';

const RANGE_TOLERANCE = 1.0;

function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

function faceTowards(p, x, y) {
  const dx = x - p.x, dy = y - p.y;
  if (Math.abs(dx) > Math.abs(dy)) p.dir = dx < 0 ? 1 : 2;
  else p.dir = dy < 0 ? 3 : 0;
}

function hostilesAround(zone, p, x, y, r) {
  const out = [];
  for (const e of zone.combatants()) {
    if (e === p || !e.alive) continue;
    if (Math.hypot(e.x - x, e.y - y) <= r + (e.isMonster && e.def.size > 1.5 ? 0.6 : 0) && isHostile(zone, p, e)) out.push(e);
  }
  return out;
}

function friendsAround(zone, p, x, y, r, includeDead = false) {
  const out = [];
  for (const q of zone.players) {
    if (!includeDead && !q.alive) continue;
    if (Math.hypot(q.x - x, q.y - y) <= r && isFriendly(zone, p, q)) out.push(q);
  }
  return out;
}

// Golpe/projétil com dano adiado conforme o tempo de viagem.
function strike(zone, p, tgt, mult, opts = {}) {
  const speed = opts.speed || 0;
  const apply = () => {
    if (!tgt.alive || tgt.zone !== zone && tgt.isPlayer) return;
    if (!zone.entities.has(tgt.id)) return;
    const { dmg, crit } = computeHit(p, tgt, mult, opts);
    dealDamage(zone, p, tgt, dmg, { crit, magic: opts.magic, threatMult: opts.threatMult });
    if (opts.after && tgt.alive) opts.after(tgt);
  };
  if (speed > 0) {
    const t = Math.round((dist(p, tgt) / speed) * 1000);
    zone.fx({ k: 'pr', a: p.id, b: tgt.id, s: opts.proj, t }, p.x, p.y);
    zone.schedule(t, apply);
  } else {
    zone.fx({ k: 'sw', id: p.id, b: tgt.id, s: opts.swing || 'slash' }, p.x, p.y);
    apply();
  }
}

function resolveEnemy(zone, p, id, range) {
  const t = zone.entities.get(id);
  if (!t || !t.alive || !isHostile(zone, p, t)) return { err: 'Alvo inválido.' };
  if (dist(p, t) > range + RANGE_TOLERANCE + (t.isMonster && t.def.size > 1.5 ? 0.8 : 0)) return { err: 'Fora de alcance.' };
  return { t };
}

function clampPoint(p, x, y, range) {
  const dx = x - p.x, dy = y - p.y;
  const d = Math.hypot(dx, dy);
  if (d <= range) return { x, y };
  return { x: p.x + (dx / d) * range, y: p.y + (dy / d) * range };
}

function teleportPlayer(zone, p, x, y, style) {
  zone.fx({ k: 'ds', id: p.id, x0: p.x, y0: p.y, x, y, s: style }, p.x, p.y);
  p.x = x; p.y = y;
  p.posSeq++;
  p.send({ t: 'pos', x, y, s: p.posSeq });
  p.lastMoveAt = Date.now();
}

// ---------------------------------------------------------------- efeitos por habilidade

const IMPL = {
  w_strike(zone, p, sk, t) {
    strike(zone, p, t, sk.mult, { swing: 'heavy' });
  },
  w_cry(zone, p, sk) {
    const now = Date.now();
    for (const m of hostilesAround(zone, p, p.x, p.y, sk.radius)) {
      if (!m.isMonster) continue;
      let top = 0;
      for (const v of m.threat.values()) top = Math.max(top, v);
      addThreat(m, p, top + 50 + p.stats.power * 2);
      m.target = p;
      m.state = 'chase';
      m.tauntUntil = now + sk.tauntDur * 1000;
    }
    addStatus(p, { id: 'w_cry', type: 'dr', value: sk.dr, dur: sk.dur, name: 'Grito de Guerra' }, now);
    zone.fx({ k: 'ao', x: p.x, y: p.y, r: sk.radius, s: 'shout' }, p.x, p.y);
  },
  w_charge(zone, p, sk, t) {
    const d = dist(p, t);
    const reach = Math.max(0, d - 1.1);
    const end = castRay(zone.map, p.x, p.y, t.x - p.x, t.y - p.y, reach, 0.3);
    teleportPlayer(zone, p, end.x, end.y, 'charge');
    const now = Date.now();
    strike(zone, p, t, sk.mult, {
      swing: 'heavy',
      after: (tg) => applyStun(tg, sk.stun, now),
    });
  },
  w_whirl(zone, p, sk) {
    zone.fx({ k: 'ao', x: p.x, y: p.y, r: sk.radius, s: 'whirl', id: p.id }, p.x, p.y);
    for (const e of hostilesAround(zone, p, p.x, p.y, sk.radius)) {
      const { dmg, crit } = computeHit(p, e, sk.mult);
      dealDamage(zone, p, e, dmg, { crit });
    }
  },
  w_wall(zone, p, sk) {
    addStatus(p, { id: 'w_wall', type: 'dr', value: sk.dr, dur: sk.dur, name: 'Muralha de Aço' });
    addStatus(p, { id: 'w_wall_regen', type: 'buff', mods: { regenPct: sk.regen }, dur: sk.dur, name: 'Muralha de Aço' });
    zone.fx({ k: 'bf', id: p.id, s: 'steel' }, p.x, p.y);
  },
  w_exec(zone, p, sk, t) {
    const maxHp = t.isPlayer ? t.stats.maxHp : t.maxHp;
    const mult = t.hp / maxHp < sk.execPct ? sk.execMult : sk.mult;
    strike(zone, p, t, mult, { swing: 'exec' });
  },

  b_cleave(zone, p, sk, t) {
    strike(zone, p, t, sk.mult, { swing: 'heavy' });
    zone.fx({ k: 'ao', x: t.x, y: t.y, r: sk.splashR, s: 'stomp' }, t.x, t.y);
    for (const e of hostilesAround(zone, p, t.x, t.y, sk.splashR)) {
      if (e === t) continue;
      const { dmg, crit } = computeHit(p, e, sk.splash);
      dealDamage(zone, p, e, dmg, { crit });
    }
  },
  b_rend(zone, p, sk, t) {
    strike(zone, p, t, sk.mult, {
      swing: 'claw',
      after: (tg) => addStatus(tg, { id: 'bleed_' + p.id, type: 'poison', dps: p.stats.power * sk.bleed, dur: sk.bleedDur, src: p.id, name: 'Sangramento' }),
    });
  },
  b_leap(zone, p, sk, t) {
    const reach = Math.max(0, dist(p, t) - 0.9);
    const end = castRay(zone.map, p.x, p.y, t.x - p.x, t.y - p.y, reach, 0.3);
    teleportPlayer(zone, p, end.x, end.y, 'charge');
    zone.fx({ k: 'ao', x: end.x, y: end.y, r: sk.radius, s: 'stomp' }, end.x, end.y);
    for (const e of hostilesAround(zone, p, end.x, end.y, sk.radius)) {
      const { dmg, crit } = computeHit(p, e, sk.mult);
      dealDamage(zone, p, e, dmg, { crit });
      if (e.alive) addStatus(e, { id: 'slow_leap', type: 'slow', value: sk.slow, dur: sk.slowDur, name: 'Esmagado' });
    }
  },
  b_frenzy(zone, p, sk) {
    addStatus(p, { id: 'b_frenzy', type: 'buff', mods: { power: sk.power, haste: sk.haste, def: -sk.defPenalty }, dur: sk.dur, name: 'Frenesi' });
    zone.fx({ k: 'bf', id: p.id, s: 'fury' }, p.x, p.y);
  },
  b_roar(zone, p, sk) {
    zone.fx({ k: 'ao', x: p.x, y: p.y, r: sk.radius, s: 'shout' }, p.x, p.y);
    let hit = 0;
    for (const e of hostilesAround(zone, p, p.x, p.y, sk.radius)) {
      const { dmg, crit } = computeHit(p, e, sk.mult);
      dealDamage(zone, p, e, dmg, { crit });
      if (hit < sk.maxHeals) { hit++; heal(zone, p, p, p.stats.maxHp * sk.healPct); }
    }
  },
  b_massacre(zone, p, sk) {
    addStatus(p, { id: 'b_massacre', type: 'buff', mods: { power: sk.power, lifesteal: sk.lifesteal, speed: sk.speed }, dur: sk.dur, name: 'Massacre' });
    zone.fx({ k: 'bf', id: p.id, s: 'fury' }, p.x, p.y);
  },

  m_fire(zone, p, sk, t) {
    strike(zone, p, t, sk.mult, {
      speed: sk.speed, proj: 'fire', magic: true,
      after: (tg) => addStatus(tg, { id: 'burn_' + p.id, type: 'burn', dps: p.stats.power * sk.burn, dur: sk.burnDur, src: p.id, name: 'Queimadura' }),
    });
  },
  m_frost(zone, p, sk, t) {
    strike(zone, p, t, sk.mult, {
      speed: sk.speed, proj: 'frost', magic: true,
      after: (tg) => addStatus(tg, { id: 'slow_frost', type: 'slow', value: sk.slow, dur: sk.slowDur, name: 'Congelado' }),
    });
  },
  m_shield(zone, p, sk) {
    const amount = Math.round(25 + p.stats.int * 3 + p.level * 6);
    addStatus(p, { id: 'm_shield', type: 'shield', amount, dur: sk.dur, name: 'Escudo Arcano' });
    zone.fx({ k: 'bf', id: p.id, s: 'arcane' }, p.x, p.y);
  },
  m_meteor(zone, p, sk, t, msg) {
    const pt = clampPoint(p, msg.x, msg.y, sk.range);
    const ms = sk.delay * 1000;
    zone.fx({ k: 'tg', x: pt.x, y: pt.y, r: sk.radius, t: ms, s: 'meteor', f: 1 }, pt.x, pt.y);
    zone.schedule(ms, () => {
      zone.fx({ k: 'ao', x: pt.x, y: pt.y, r: sk.radius, s: 'meteor' }, pt.x, pt.y);
      if (!p.zone || p.zone !== zone) return;
      for (const e of hostilesAround(zone, p, pt.x, pt.y, sk.radius)) {
        const { dmg, crit } = computeHit(p, e, sk.mult);
        dealDamage(zone, p, e, dmg, { crit, magic: true });
        if (e.alive) addStatus(e, { id: 'burn_' + p.id, type: 'burn', dps: p.stats.power * sk.burn, dur: sk.burnDur, src: p.id, name: 'Queimadura' });
      }
    });
  },
  m_blink(zone, p, sk, t, msg) {
    const end = castRay(zone.map, p.x, p.y, msg.x - p.x, msg.y - p.y, Math.min(sk.range, Math.hypot(msg.x - p.x, msg.y - p.y)), 0.3);
    removeStatus(p, (s) => s.type === 'slow' || s.type === 'root');
    teleportPlayer(zone, p, end.x, end.y, 'blink');
  },
  m_nova(zone, p, sk) {
    zone.fx({ k: 'ao', x: p.x, y: p.y, r: sk.radius, s: 'frostnova' }, p.x, p.y);
    for (const e of hostilesAround(zone, p, p.x, p.y, sk.radius)) {
      const { dmg, crit } = computeHit(p, e, sk.mult);
      dealDamage(zone, p, e, dmg, { crit, magic: true });
      if (e.alive) addStatus(e, { id: 'root_nova', type: 'root', dur: sk.root, name: 'Congelado' });
    }
  },

  r_aimed(zone, p, sk, t) {
    strike(zone, p, t, sk.mult, { speed: sk.speed, proj: 'arrow_big', critBonus: sk.critBonus });
  },
  r_poison(zone, p, sk, t) {
    strike(zone, p, t, sk.mult, {
      speed: sk.speed, proj: 'poison',
      after: (tg) => addStatus(tg, { id: 'poison_' + p.id, type: 'poison', dps: p.stats.power * sk.poison, dur: sk.poisonDur, src: p.id, name: 'Veneno' }),
    });
  },
  r_roll(zone, p, sk, t, msg) {
    const end = castRay(zone.map, p.x, p.y, msg.x - p.x, msg.y - p.y, sk.range, 0.3);
    removeStatus(p, (s) => s.type === 'slow' || s.type === 'root');
    addStatus(p, { id: 'r_roll', type: 'invuln', dur: sk.invuln, name: 'Rolamento' });
    teleportPlayer(zone, p, end.x, end.y, 'roll');
  },
  r_rain(zone, p, sk, t, msg) {
    const pt = clampPoint(p, msg.x, msg.y, sk.range);
    zone.fx({ k: 'ar', x: pt.x, y: pt.y, r: sk.radius, t: sk.pulses * sk.interval * 1000 + 300, s: 'arrows' }, pt.x, pt.y);
    for (let i = 0; i < sk.pulses; i++) {
      zone.schedule(300 + i * sk.interval * 1000, () => {
        if (!p.zone || p.zone !== zone) return;
        for (const e of hostilesAround(zone, p, pt.x, pt.y, sk.radius)) {
          const { dmg, crit } = computeHit(p, e, sk.mult);
          dealDamage(zone, p, e, dmg, { crit });
          if (e.alive) addStatus(e, { id: 'slow_rain', type: 'slow', value: sk.slow, dur: sk.slowDur, name: 'Lentidão' });
        }
      });
    }
  },
  r_hawk(zone, p, sk) {
    addStatus(p, { id: 'r_hawk', type: 'buff', mods: { crit: sk.crit, haste: sk.haste }, dur: sk.dur, name: 'Olho de Falcão' });
    zone.fx({ k: 'bf', id: p.id, s: 'hawk' }, p.x, p.y);
  },
  r_multi(zone, p, sk, t) {
    const targets = [t, ...hostilesAround(zone, p, t.x, t.y, sk.radius).filter((e) => e !== t)].slice(0, sk.maxTargets);
    for (const e of targets) strike(zone, p, e, sk.mult, { speed: sk.speed, proj: 'arrow' });
  },

  c_smite(zone, p, sk, t) {
    strike(zone, p, t, sk.mult, { speed: sk.speed, proj: 'holy', magic: true, holy: true });
  },
  c_heal(zone, p, sk, t) {
    const amount = sk.healFlat + p.stats.power * sk.heal;
    heal(zone, p, t, amount);
    zone.fx({ k: 'bf', id: t.id, s: 'heal' }, t.x, t.y);
  },
  c_bless(zone, p, sk) {
    const targets = friendsAround(zone, p, p.x, p.y, sk.radius).filter((q) => q === p || (p.party && q.party === p.party));
    for (const q of targets) {
      addStatus(q, { id: 'c_bless', type: 'buff', mods: { def: sk.def, regenPct: sk.regen }, dur: sk.dur, name: 'Bênção' });
      zone.fx({ k: 'bf', id: q.id, s: 'bless' }, q.x, q.y);
    }
  },
  c_consec(zone, p, sk, t, msg) {
    const pt = clampPoint(p, msg.x, msg.y, sk.range);
    zone.fx({ k: 'ar', x: pt.x, y: pt.y, r: sk.radius, t: sk.dur * 1000, s: 'consec' }, pt.x, pt.y);
    for (let i = 1; i <= sk.dur; i++) {
      zone.schedule(i * 1000 - 500, () => {
        if (!p.zone || p.zone !== zone) return;
        for (const e of hostilesAround(zone, p, pt.x, pt.y, sk.radius)) {
          const { dmg, crit } = computeHit(p, e, sk.mult, { holy: true });
          dealDamage(zone, p, e, dmg, { crit, magic: true });
        }
        for (const q of friendsAround(zone, p, pt.x, pt.y, sk.radius)) heal(zone, p, q, p.stats.power * sk.heal);
      });
    }
  },
  c_faith(zone, p, sk, t) {
    const amount = Math.round(sk.shieldFlat + p.stats.power * sk.shieldMult);
    addStatus(t, { id: 'c_faith', type: 'shield', amount, dur: sk.dur, name: 'Escudo da Fé' });
    zone.fx({ k: 'bf', id: t.id, s: 'faith' }, t.x, t.y);
  },
  c_grace(zone, p, sk) {
    zone.fx({ k: 'ao', x: p.x, y: p.y, r: sk.radius, s: 'grace' }, p.x, p.y);
    for (const q of friendsAround(zone, p, p.x, p.y, sk.radius, true)) {
      if (q.dead) revivePlayer(zone, q, sk.revivePct);
      else heal(zone, p, q, q.stats.maxHp * sk.healPct);
    }
  },
};

// ---------------------------------------------------------------- entrada

export function useSkill(world, p, msg) {
  const sk = SKILLS[msg.s];
  const zone = p.zone;
  if (!sk || !zone || sk.cls !== p.cls) return;
  if (p.dead) return;
  if (p.level < sk.lvl) return p.err(`Requer nível ${sk.lvl}.`);
  if (zone.def.safe) return p.err('Você não pode usar habilidades de combate na cidade.');
  if (hasStatus(p, 'stun')) return p.err('Você está atordoado!');
  const now = Date.now();
  if ((p.cd[sk.id] || 0) > now + 50) return p.err('Habilidade em recarga.');
  if (p.gcd > now + 50) return;
  if (p.mp < sk.mp) return p.err('Mana insuficiente.');
  if (p.casting) { p.casting = null; p.send({ t: 'castEnd', ok: false }); }

  let t = null;
  if (sk.target === 'enemy') {
    const r = resolveEnemy(zone, p, msg.id, sk.range);
    if (r.err) return p.err(r.err);
    t = r.t;
    if ((sk.id === 'w_charge' || sk.id === 'b_leap') && hasStatus(p, 'root')) return p.err('Você está enraizado!');
    faceTowards(p, t.x, t.y);
    p.attackTarget = t.id;
  } else if (sk.target === 'ally') {
    t = zone.entities.get(msg.id);
    if (!t || !t.isPlayer || !t.alive || !isFriendly(zone, p, t) || dist(p, t) > sk.range + RANGE_TOLERANCE) t = p;
  } else if (sk.target === 'ground' || sk.target === 'dir') {
    if (!Number.isFinite(msg.x) || !Number.isFinite(msg.y)) return;
    faceTowards(p, msg.x, msg.y);
  }
  IMPL[sk.id](zone, p, sk, t, msg);
  p.mp -= sk.mp;
  p.cd[sk.id] = now + sk.cd * 1000;
  p.gcd = now + GLOBAL_COOLDOWN * 1000;
  p.dirty.me = true;
  p.send({ t: 'cd', s: sk.id, d: sk.cd * 1000, g: GLOBAL_COOLDOWN * 1000 });
  zone.fx({ k: 'cs', id: p.id, s: sk.id }, p.x, p.y);
  if (sk.target === 'enemy' || sk.target === 'ground' || sk.id === 'w_cry' || sk.id === 'w_whirl' || sk.id === 'm_nova' || sk.id === 'b_roar') {
    p.combatUntil = Math.max(p.combatUntil, now + 3000);
  }
}

// Ataque básico automático (chamado a cada tick).
export function updateAutoAttack(zone, p, now) {
  if (!p.attackTarget || p.dead || p.casting) return;
  const t = zone.entities.get(p.attackTarget);
  if (!t || !t.alive || !isHostile(zone, p, t)) { p.attackTarget = null; return; }
  if (now < p.nextAttack) return;
  if (hasStatus(p, 'stun')) return;
  const cls = CLASSES[p.cls];
  const range = p.stats.atkRange + 0.6 + (t.isMonster && t.def.size > 1.5 ? 0.8 : 0);
  if (dist(p, t) > range) return;
  faceTowards(p, t.x, t.y);
  p.nextAttack = now + p.stats.atkInterval * 1000;
  if (cls.projectile) {
    strike(zone, p, t, 1, { speed: 14, proj: cls.projectile, magic: p.cls === 'mage' || p.cls === 'cleric', holy: p.cls === 'cleric' });
  } else {
    strike(zone, p, t, 1, { swing: 'slash' });
  }
  p.combatUntil = Math.max(p.combatUntil, now + 3000);
}

export { canStand };
