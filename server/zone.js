// Uma zona do mundo: mapa, entidades, monstros, eventos agendados e envio de estado.
import { generateMap } from '../shared/mapgen.js';
import { buildMap, encodeLayer } from '../shared/tiles.js';
import { canStand, nearestFree } from '../shared/collision.js';
import { MONSTERS } from '../shared/data/monsters.js';
import { npcsInZone } from '../shared/data/npcs.js';
import { VIEW_RADIUS } from '../shared/constants.js';
import { Monster, NpcEntity } from './entities/monster.js';
import { updateMonster } from './systems/ai.js';
import { tickStatuses } from './systems/effects.js';
import { dealDamage } from './systems/combat.js';
import { updateAutoAttack } from './systems/skills.js';
import { rand } from '../shared/rng.js';

export class Zone {
  constructor(world, def) {
    this.world = world;
    this.def = def;
    this.id = def.id;
    const m = generateMap(def);
    this.map = buildMap(m.w, m.h, m.tiles, m.objs, m.structures);
    this.payload = { id: def.id, w: m.w, h: m.h, t: encodeLayer(m.tiles), o: encodeLayer(m.objs), st: m.structures };
    this.entities = new Map();
    this.players = new Set();
    this.monsters = [];
    this.events = [];
    this.spawners = (def.spawns || []).map((s) => ({ ...s, pending: [] }));
    for (const n of npcsInZone(def.id)) this.addEntity(new NpcEntity(this, n));
    for (const sp of this.spawners) for (let i = 0; i < sp.n; i++) this.spawnFrom(sp);
    this.lastDot = 0;
  }

  // ---------------------------------------------------------------- entidades
  addEntity(e) {
    this.entities.set(e.id, e);
  }

  removeEntity(e) {
    this.entities.delete(e.id);
  }

  addMonster(m) {
    this.monsters.push(m);
    this.addEntity(m);
  }

  spawnFrom(sp) {
    const def = MONSTERS[sp.m];
    let x = sp.x + 0.5, y = sp.y + 0.5;
    for (let i = 0; i < 40; i++) {
      const ang = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * sp.r;
      const px = sp.x + 0.5 + Math.cos(ang) * d, py = sp.y + 0.5 + Math.sin(ang) * d;
      if (canStand(this.map, px, py, 0.4)) { x = px; y = py; break; }
    }
    const p = nearestFree(this.map, x, y, 0.35);
    const lvl = rand.int(def.lvl[0], def.lvl[1]);
    const m = new Monster(this, def, lvl, p.x, p.y, sp);
    this.addMonster(m);
    return m;
  }

  onMonsterDeath(m, silent = false) {
    if (m.spawner) {
      const t = (m.def.respawn || (22 + Math.random() * 14)) * 1000;
      m.spawner.pending.push(Date.now() + t);
    }
    // o corpo fica visível por um instante
    this.schedule(silent ? 0 : 1600, () => {
      this.removeEntity(m);
      const i = this.monsters.indexOf(m);
      if (i >= 0) this.monsters.splice(i, 1);
    });
  }

  addGroundItem(gi) {
    this.addEntity(gi);
  }

  addPlayer(p, x, y) {
    p.zone = this;
    p.x = x; p.y = y;
    const fixed = nearestFree(this.map, x, y, 0.3);
    p.x = fixed.x; p.y = fixed.y;
    p.known.clear();
    this.players.add(p);
    this.addEntity(p);
  }

  removePlayer(p) {
    this.players.delete(p);
    this.removeEntity(p);
    for (const m of this.monsters) {
      if (m.threat.delete(p.id) && m.target === p) m.target = null;
    }
  }

  // Entidades que podem lutar (jogadores e monstros vivos).
  * combatants() {
    for (const p of this.players) if (p.alive) yield p;
    for (const m of this.monsters) if (m.alive) yield m;
  }

  // ---------------------------------------------------------------- eventos
  schedule(ms, fn) {
    this.events.push({ at: Date.now() + ms, fn });
  }

  fx(ev, x, y) {
    for (const p of this.players) {
      if (Math.abs(p.x - x) <= VIEW_RADIUS + 4 && Math.abs(p.y - y) <= VIEW_RADIUS + 4) p.fxQueue.push(ev);
    }
  }

  chatAll(msg) {
    for (const p of this.players) p.send(msg);
  }

  // ---------------------------------------------------------------- simulação
  update(now, dt) {
    // eventos agendados
    if (this.events.length) {
      const due = [];
      this.events = this.events.filter((e) => (e.at <= now ? (due.push(e), false) : true));
      for (const e of due) {
        try { e.fn(); } catch (err) { console.error('[zone] erro em evento', err); }
      }
    }
    // respawn
    for (const sp of this.spawners) {
      if (!sp.pending.length) continue;
      const ready = sp.pending.filter((t) => t <= now);
      if (!ready.length) continue;
      sp.pending = sp.pending.filter((t) => t > now);
      for (let i = 0; i < ready.length; i++) {
        const m = this.spawnFrom(sp);
        if (m.def.boss) this.world.broadcastSystem(`${m.def.name}, ${m.def.title}, despertou em ${this.def.name}...`, 'boss');
      }
    }
    // a IA só roda com jogadores na zona (economiza CPU); efeitos sempre
    const active = this.players.size > 0;
    const onDot = (ent, s) => {
      const src = this.entities.get(s.src) || this.world.players.get(s.src) || null;
      dealDamage(this, src && src.alive ? src : null, ent, s.dps, { dot: true, noDodge: true, magic: true });
    };
    for (const m of this.monsters) {
      if (m.dead) continue;
      tickStatuses(m, now, onDot);
      if (active) updateMonster(this, m, now, dt);
    }
    for (const p of this.players) {
      tickStatuses(p, now, onDot);
      if (p.dead) continue;
      // regeneração a cada segundo
      if (now >= p.regenAt) {
        p.regenAt = now + 1000;
        const combat = p.inCombat(now);
        const st = p.stats;
        let hpGain = combat ? st.hpRegen * 0.4 : st.hpRegen + st.maxHp * 0.02;
        if (p.mods.regenPct) hpGain += st.maxHp * p.mods.regenPct;
        const mpGain = combat ? st.mpRegen : st.mpRegen * 2 + st.maxMp * 0.015;
        if (p.hp < st.maxHp) { p.hp = Math.min(st.maxHp, p.hp + hpGain); p.dirty.me = true; }
        if (p.mp < st.maxMp) { p.mp = Math.min(st.maxMp, p.mp + mpGain); p.dirty.me = true; }
      }
      if (p.casting && now >= p.casting.until) {
        const c = p.casting;
        p.casting = null;
        p.send({ t: 'castEnd', ok: true });
        c.done();
      }
      updateAutoAttack(this, p, now);
    }
    // itens no chão expiram
    for (const e of this.entities.values()) {
      if (e.kind === 'i' && now >= e.expireAt) this.removeEntity(e);
    }
  }

  // ---------------------------------------------------------------- rede
  sendSnapshots(now) {
    for (const p of this.players) {
      const n = [], u = [], r = [];
      const seen = new Set();
      for (const e of this.entities.values()) {
        if (e !== p && (Math.abs(e.x - p.x) > VIEW_RADIUS || Math.abs(e.y - p.y) > VIEW_RADIUS)) continue;
        seen.add(e.id);
        let k = p.known.get(e.id);
        if (!k || k.ver !== e.ver) {
          n.push(e.full());
          k = { ver: e.ver, last: '' };
          p.known.set(e.id, k);
        }
        const arr = e.upd();
        const key = arr.join(',');
        if (key !== k.last) { u.push(arr); k.last = key; }
      }
      for (const id of p.known.keys()) {
        if (!seen.has(id)) { r.push(id); p.known.delete(id); }
      }
      if (n.length || u.length || r.length) p.send({ t: 's', ts: now, n, u, r });
      if (p.fxQueue.length) {
        p.send({ t: 'fx', l: p.fxQueue });
        p.fxQueue = [];
      }
    }
  }

  // Ponto de chegada seguro.
  safePoint(x, y) {
    return nearestFree(this.map, x, y, 0.3);
  }
}
