// Inteligência artificial dos monstros e mecânicas de chefes.
import { MONSTERS } from '../../shared/data/monsters.js';
import { lineClear, moveWithCollision, castRay, canStand } from '../../shared/collision.js';
import { findPath } from '../../shared/pathfinding.js';
import { addStatus, hasStatus } from './effects.js';
import { dealDamage, computeHit, isHostile, heal, applyStun } from './combat.js';
import { Monster } from '../entities/monster.js';

function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

function setDir(m, dx, dy) {
  if (Math.abs(dx) > Math.abs(dy)) m.dir = dx < 0 ? 1 : 2;
  else if (dy !== 0) m.dir = dy < 0 ? 3 : 0;
}

function moveToward(zone, m, tx, ty, speed, dt, now) {
  const step = speed * dt;
  const d = Math.hypot(tx - m.x, ty - m.y);
  if (d < 0.05) return;
  let gx = tx, gy = ty;
  if (!lineClear(zone.map, m.x, m.y, tx, ty, 0.3)) {
    const moved = m.pathTarget ? Math.hypot(m.pathTarget.x - tx, m.pathTarget.y - ty) : 99;
    if (!m.path || now - m.pathAt > 900 || moved > 2) {
      m.path = findPath(zone.map, m.x, m.y, tx, ty, 1200);
      m.pathAt = now;
      m.pathTarget = { x: tx, y: ty };
    }
    if (m.path && m.path.length) {
      while (m.path.length && Math.hypot(m.path[0].x - m.x, m.path[0].y - m.y) < 0.25) m.path.shift();
      if (m.path.length) { gx = m.path[0].x; gy = m.path[0].y; }
    }
  } else {
    m.path = null;
  }
  const gd = Math.hypot(gx - m.x, gy - m.y) || 1;
  const s = Math.min(step, gd);
  const dx = ((gx - m.x) / gd) * s, dy = ((gy - m.y) / gd) * s;
  const r = moveWithCollision(zone.map, m.x, m.y, dx, dy, 0.3);
  setDir(m, r.x - m.x, r.y - m.y);
  m.x = r.x; m.y = r.y;
}

function separate(zone, m) {
  for (const o of zone.monsters) {
    if (o === m || !o.alive) continue;
    const dx = m.x - o.x, dy = m.y - o.y;
    const d = Math.hypot(dx, dy);
    const minD = 0.55 + (m.def.size + o.def.size - 2) * 0.25;
    if (d > 0.001 && d < minD) {
      const push = (minD - d) * 0.3;
      const nx = m.x + (dx / d) * push, ny = m.y + (dy / d) * push;
      if (canStand(zone.map, nx, ny, 0.3)) { m.x = nx; m.y = ny; }
    }
  }
}

export function resetMonster(zone, m) {
  m.state = 'return';
  m.returnStart = Date.now();
  m.threat.clear();
  m.target = null;
  m.tagOwner = null;
  m.windup = null;
  m.statuses = [];
  m.path = null;
  if (m.def.boss) {
    m.triggered.clear();
    m.enraged = false;
    m.hasteBonus = 0;
    for (const s of m.summons) if (s.alive) { s.dead = true; s.deathAt = Date.now(); zone.onMonsterDeath(s, true); }
    m.summons = [];
  }
  m.recalc();
}

function pickTarget(zone, m, now) {
  if (m.target && now < m.tauntUntil && m.target.alive && m.target.zone === zone && isHostile(zone, m, m.target)) return m.target;
  let best = null, bestV = -1;
  for (const [pid, v] of m.threat) {
    const p = zone.world.players.get(pid);
    if (!p || p.zone !== zone || !p.alive || !isHostile(zone, m, p) || dist(p, m) > 30) { m.threat.delete(pid); continue; }
    // troca de alvo só com 10% a mais de ameaça (evita "pingue-pongue")
    const bonus = p === m.target ? 1.1 : 1;
    if (v * bonus > bestV) { bestV = v * bonus; best = p; }
  }
  return best;
}

function yell(zone, m, text) {
  if (!text) return;
  zone.chatAll({ t: 'chat', c: 'grito', f: m.def.name, m: text });
  zone.fx({ k: 'ab', id: m.id, n: text.length > 40 ? '!' : text }, m.x, m.y);
}

function abilityReady(m, a, now) {
  return now >= (m.abilityCd[a.type + (a.name || '')] || 0);
}

function useAbility(m, a, now) {
  m.abilityCd[a.type + (a.name || '')] = now + a.cd * 1000;
}

function hpPct(m) { return m.hp / m.maxHp; }

function playersNear(zone, x, y, r) {
  const out = [];
  for (const p of zone.players) {
    if (p.alive && Math.hypot(p.x - x, p.y - y) <= r + 0.3) out.push(p);
  }
  return out;
}

function areaHit(zone, m, x, y, a) {
  for (const p of playersNear(zone, x, y, a.radius)) {
    if (!isHostile(zone, m, p)) continue;
    const { dmg, crit } = computeHit(m, p, a.mult);
    dealDamage(zone, m, p, dmg, { crit, noDodge: true, magic: true });
    if (!p.alive) continue;
    const now = Date.now();
    if (a.stun) applyStun(p, a.stun, now);
    if (a.poison) addStatus(p, { id: 'poison_m' + m.id, type: 'poison', dps: m.power * a.poison, dur: a.poisonDur, src: m.id, name: 'Veneno' }, now);
    if (a.burn) addStatus(p, { id: 'burn_m' + m.id, type: 'burn', dps: m.power * a.burn, dur: a.burnDur, src: m.id, name: 'Queimadura' }, now);
  }
}

function randomPointNear(zone, x, y, r) {
  for (let i = 0; i < 20; i++) {
    const ang = Math.random() * Math.PI * 2, d = Math.random() * r;
    const px = x + Math.cos(ang) * d, py = y + Math.sin(ang) * d;
    if (canStand(zone.map, px, py, 0.35)) return { x: px, y: py };
  }
  return { x, y };
}

// Tenta usar uma habilidade especial; retorna true se o monstro está ocupado (canalizando).
function tryAbilities(zone, m, tgt, now) {
  const def = m.def;
  if (!def.abilities) return false;
  const d = dist(m, tgt);
  for (const a of def.abilities) {
    switch (a.type) {
      case 'summon': {
        for (const th of a.at) {
          const key = 'summon' + a.m + th;
          if (hpPct(m) <= th && !m.triggered.has(key)) {
            m.triggered.add(key);
            yell(zone, m, a.yell);
            const sdef = MONSTERS[a.m];
            for (let i = 0; i < a.n; i++) {
              const pt = randomPointNear(zone, m.x, m.y, 3);
              const s = new Monster(zone, sdef, sdef.lvl[0], pt.x, pt.y, null);
              s.master = m;
              s.summoned = true;
              s.home = { ...m.home };
              for (const pid of m.threat.keys()) s.threat.set(pid, 1);
              s.state = 'chase';
              s.target = tgt;
              zone.addMonster(s);
              zone.fx({ k: 'sp', id: s.id, x: pt.x, y: pt.y }, pt.x, pt.y);
              m.summons.push(s);
            }
          }
        }
        break;
      }
      case 'enrage':
        if (!m.enraged && hpPct(m) <= a.at) {
          m.enraged = true;
          m.hasteBonus = a.haste;
          m.recalc();
          yell(zone, m, a.yell);
          zone.fx({ k: 'bf', id: m.id, s: 'enrage' }, m.x, m.y);
        }
        break;
      case 'harden':
        if (hpPct(m) <= a.at && abilityReady(m, a, now)) {
          useAbility(m, a, now);
          addStatus(m, { id: 'harden', type: 'dr', value: a.dr, dur: a.dur, name: a.statusName || 'Pele de Cristal' }, now);
          yell(zone, m, a.yell);
          zone.fx({ k: 'bf', id: m.id, s: 'harden' }, m.x, m.y);
        }
        break;
      case 'blink':
        for (const th of a.at) {
          const key = 'blink' + th;
          if (hpPct(m) <= th && !m.triggered.has(key)) {
            m.triggered.add(key);
            const pt = randomPointNear(zone, m.home.x, m.home.y, 7);
            zone.fx({ k: 'ds', id: m.id, x0: m.x, y0: m.y, x: pt.x, y: pt.y, s: 'void' }, m.x, m.y);
            m.x = pt.x; m.y = pt.y;
            yell(zone, m, a.yell);
            m.nextAttack = now + 800;
            return true;
          }
        }
        break;
      case 'healAlly': {
        if (!abilityReady(m, a, now)) break;
        let best = null;
        for (const o of zone.monsters) {
          if (!o.alive || dist(o, m) > a.radius) continue;
          if (hpPct(o) < 0.7 && (!best || hpPct(o) < hpPct(best))) best = o;
        }
        if (best) {
          useAbility(m, a, now);
          zone.fx({ k: 'pr', a: m.id, b: best.id, s: 'heal', t: 400 }, m.x, m.y);
          zone.fx({ k: 'ab', id: m.id, n: 'Cura Goblin' }, m.x, m.y);
          zone.schedule(400, () => { if (best.alive) heal(zone, m, best, best.maxHp * a.pct); });
          m.windup = { at: now + 600, fn: () => {} };
          return true;
        }
        break;
      }
      case 'root':
        if (abilityReady(m, a, now) && d <= a.range) {
          useAbility(m, a, now);
          const style = a.style || (def.id === 'ent' ? 'roots' : 'web');
          const label = a.name || (style === 'web' ? 'Teia' : 'Raízes');
          zone.fx({ k: 'pr', a: m.id, b: tgt.id, s: style, t: 450 }, m.x, m.y);
          zone.fx({ k: 'ab', id: m.id, n: label }, m.x, m.y);
          zone.schedule(450, () => {
            if (!tgt.alive || tgt.zone !== zone) return;
            addStatus(tgt, { id: 'root_m', type: 'root', dur: a.dur, name: a.status || (style === 'web' ? 'Preso na Teia' : 'Enraizado') });
            if (a.mult) { const { dmg } = computeHit(m, tgt, a.mult); dealDamage(zone, m, tgt, dmg, { noDodge: true }); }
          });
          m.windup = { at: now + 500, fn: () => {} };
          return true;
        }
        break;
      case 'stomp':
        if (abilityReady(m, a, now) && d <= a.radius + 1) {
          useAbility(m, a, now);
          const ms = a.delay * 1000;
          zone.fx({ k: 'tg', x: m.x, y: m.y, r: a.radius, t: ms, s: a.style || 'stomp' }, m.x, m.y);
          zone.fx({ k: 'ab', id: m.id, n: a.name || 'Pisotear' }, m.x, m.y);
          const x = m.x, y = m.y;
          m.windup = {
            at: now + ms,
            fn: () => {
              zone.fx({ k: 'ao', x, y, r: a.radius, s: a.style || 'stomp' }, x, y);
              areaHit(zone, m, x, y, a);
            },
          };
          return true;
        }
        break;
      case 'charge':
        if (abilityReady(m, a, now) && d >= 2.5 && d <= a.range) {
          useAbility(m, a, now);
          const ms = a.delay * 1000;
          const px = tgt.x, py = tgt.y;
          zone.fx({ k: 'tg', x: px, y: py, r: a.radius, t: ms, s: 'charge', fx: m.x, fy: m.y }, px, py);
          zone.fx({ k: 'ab', id: m.id, n: 'Investida' }, m.x, m.y);
          setDir(m, px - m.x, py - m.y);
          m.windup = {
            at: now + ms,
            fn: () => {
              const end = castRay(zone.map, m.x, m.y, px - m.x, py - m.y, Math.hypot(px - m.x, py - m.y), 0.3);
              zone.fx({ k: 'ds', id: m.id, x0: m.x, y0: m.y, x: end.x, y: end.y, s: 'charge' }, m.x, m.y);
              m.x = end.x; m.y = end.y;
              areaHit(zone, m, end.x, end.y, a);
            },
          };
          return true;
        }
        break;
      case 'pools':
        if (abilityReady(m, a, now)) {
          useAbility(m, a, now);
          const ms = a.delay * 1000;
          const targets = [];
          for (const pid of m.threat.keys()) {
            const p = zone.world.players.get(pid);
            if (p && p.zone === zone && p.alive && dist(p, m) < 18) targets.push(p);
          }
          if (!targets.length) targets.push(tgt);
          zone.fx({ k: 'ab', id: m.id, n: a.name || 'Veneno' }, m.x, m.y);
          for (const p of targets.slice(0, 5)) {
            const x = p.x, y = p.y;
            zone.fx({ k: 'tg', x, y, r: a.radius, t: ms, s: a.style || 'poison' }, x, y);
            zone.schedule(ms, () => {
              if (!m.alive) return;
              zone.fx({ k: 'ao', x, y, r: a.radius, s: a.style || 'poison' }, x, y);
              areaHit(zone, m, x, y, a);
            });
          }
        }
        break;
      case 'meteors':
        if (hpPct(m) <= a.phase && abilityReady(m, a, now)) {
          useAbility(m, a, now);
          const ms = a.delay * 1000;
          zone.fx({ k: 'ab', id: m.id, n: a.name }, m.x, m.y);
          for (let i = 0; i < a.count; i++) {
            const pt = i < 2 && tgt ? { x: tgt.x + (Math.random() - 0.5) * 2, y: tgt.y + (Math.random() - 0.5) * 2 } : randomPointNear(zone, m.x, m.y, a.spread);
            const delay = ms + i * 120;
            zone.fx({ k: 'tg', x: pt.x, y: pt.y, r: a.radius, t: delay, s: a.style || 'fire' }, pt.x, pt.y);
            zone.schedule(delay, () => {
              if (!m.alive) return;
              zone.fx({ k: 'ao', x: pt.x, y: pt.y, r: a.radius, s: a.style || 'meteor' }, pt.x, pt.y);
              areaHit(zone, m, pt.x, pt.y, a);
            });
          }
        }
        break;
      default: break;
    }
  }
  return false;
}

function basicAttack(zone, m, tgt, now) {
  m.nextAttack = now + m.atkInterval * 1000;
  setDir(m, tgt.x - m.x, tgt.y - m.y);
  const def = m.def;
  const onHit = () => {
    if (!tgt.alive || tgt.zone !== zone || !m.alive) return;
    const { dmg, crit } = computeHit(m, tgt, 1);
    const drain = def.abilities?.find((a) => a.type === 'drain');
    const done = dealDamage(zone, m, tgt, dmg, { crit, drain: drain ? drain.pct : 0 });
    const ph = def.abilities?.find((a) => a.type === 'poisonHit');
    if (ph && done > 0 && tgt.alive && Math.random() < ph.chance) {
      addStatus(tgt, { id: 'poison_m' + m.id, type: 'poison', dps: m.power * ph.dps, dur: ph.dur, src: m.id, name: 'Veneno' });
    }
  };
  if (def.proj) {
    const t = Math.round((dist(m, tgt) / 11) * 1000);
    zone.fx({ k: 'pr', a: m.id, b: tgt.id, s: def.proj, t }, m.x, m.y);
    zone.schedule(t, onHit);
  } else {
    zone.fx({ k: 'sw', id: m.id, b: tgt.id, s: 'claw' }, m.x, m.y);
    onHit();
  }
}

export function updateMonster(zone, m, now, dt) {
  if (m.dead) return;
  if (hasStatus(m, 'stun')) return;
  if (m.windup) {
    if (now >= m.windup.at) {
      const w = m.windup;
      m.windup = null;
      w.fn();
    }
    return;
  }
  const rooted = hasStatus(m, 'root');
  if (m.state === 'return') {
    moveToward(zone, m, m.home.x, m.home.y, m.def.speed * 1.6, dt, now);
    m.hp = Math.min(m.maxHp, m.hp + m.maxHp * 0.25 * dt);
    if (dist(m, m.home) < 0.5 || now - (m.returnStart || 0) > 8000) {
      m.x = m.home.x; m.y = m.home.y;
      m.state = 'idle';
      m.hp = m.maxHp;
      m.nextWander = now + 3000 + Math.random() * 4000;
    }
    return;
  }
  if (m.state === 'idle') {
    if (now >= m.nextThink) {
      m.nextThink = now + 400;
      if (m.def.aggro > 0) {
        let best = null, bestD = m.def.aggro;
        for (const p of zone.players) {
          if (!p.alive || !isHostile(zone, m, p)) continue;
          // monstros muito mais fracos ignoram jogadores fortes
          if (!m.def.boss && p.level >= m.lvl + 8) continue;
          const d = dist(p, m);
          if (d < bestD) { bestD = d; best = p; }
        }
        if (best) {
          m.threat.set(best.id, 1);
          m.state = 'chase';
          m.target = best;
          zone.fx({ k: 'ag', id: m.id }, m.x, m.y);
        }
      }
    }
    if (m.state === 'idle' && !rooted) {
      if (now >= m.nextWander) {
        m.nextWander = now + 3000 + Math.random() * 6000;
        const pt = randomPointNear(zone, m.home.x, m.home.y, 4);
        m.wanderTo = pt;
      }
      if (m.wanderTo) {
        moveToward(zone, m, m.wanderTo.x, m.wanderTo.y, m.def.speed * 0.4, dt, now);
        if (Math.hypot(m.wanderTo.x - m.x, m.wanderTo.y - m.y) < 0.2) m.wanderTo = null;
      }
    }
    return;
  }
  // perseguição
  const tgt = pickTarget(zone, m, now);
  m.target = tgt;
  if (!tgt) { resetMonster(zone, m); return; }
  const leash = m.def.leash || 16;
  if (dist(m, m.home) > leash && !m.master) { resetMonster(zone, m); return; }
  if (m.master && (!m.master.alive || dist(m, m.master.home) > (m.master.def.leash || 20) + 4)) {
    m.dead = true; m.deathAt = now; zone.onMonsterDeath(m, true); return;
  }
  if (tryAbilities(zone, m, tgt, now)) return;
  const d = dist(m, tgt);
  const reach = m.def.atkRange + (m.def.size > 1.5 ? 0.6 : 0);
  if (d > reach * 0.92) {
    if (!rooted) moveToward(zone, m, tgt.x, tgt.y, m.speed, dt, now);
  } else if (now >= m.nextAttack) {
    basicAttack(zone, m, tgt, now);
  } else {
    setDir(m, tgt.x - m.x, tgt.y - m.y);
  }
  separate(zone, m);
}
