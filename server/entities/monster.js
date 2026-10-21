// Monstros, NPCs e itens no chão.
import { monsterStats } from '../../shared/formulas.js';
import { statusMods, statusFlags } from '../systems/effects.js';
import { F } from '../../shared/constants.js';

export class Monster {
  constructor(zone, def, lvl, x, y, spawner = null) {
    this.zone = zone;
    this.id = zone.world.nextId();
    this.kind = 'm';
    this.isMonster = true;
    this.isPlayer = false;
    this.def = def;
    this.lvl = lvl;
    this.level = lvl;
    this.name = def.name;
    const s = monsterStats(def, lvl);
    this.maxHp = s.maxHp;
    this.hp = s.maxHp;
    this.basePower = s.power;
    this.baseDef = s.def;
    this.crit = s.crit;
    this.x = x;
    this.y = y;
    this.home = { x, y };
    this.dir = 0;
    this.statuses = [];
    this.threat = new Map();
    this.target = null;
    this.state = 'idle';
    const now = Date.now();
    this.nextThink = now + Math.random() * 500;
    this.nextWander = now + 2000 + Math.random() * 5000;
    this.wanderTo = null;
    this.path = null;
    this.pathAt = 0;
    this.nextAttack = now;
    this.abilityCd = {};
    for (const a of def.abilities || []) if (a.cd) this.abilityCd[a.type + (a.name || '')] = now + a.cd * 500;
    this.triggered = new Set();
    this.windup = null;
    this.tagOwner = null;
    this.dead = false;
    this.deathAt = 0;
    this.summons = [];
    this.master = null;
    this.spawner = spawner;
    this.combatUntil = 0;
    this.hasteBonus = 0;
    this.enraged = false;
    this.tauntUntil = 0;
    this.ver = 1;
    this.flagsDirty = true;
    this.radius = 0.35;
    this.recalc();
  }

  get alive() { return !this.dead; }

  recalc() {
    const m = statusMods(this);
    this.power = this.basePower * (1 + m.power);
    this.defense = this.baseDef * (1 + m.def);
    this.dr = m.dr;
    this.speed = this.def.speed * (1 - m.slow) * (this.enraged ? 1.25 : 1);
    this.atkInterval = this.def.atkInterval / (1 + this.hasteBonus);
  }

  full() {
    return { id: this.id, k: 'm', m: this.def.id, lv: this.lvl, x: this.x, y: this.y, hp: Math.round(this.hp), mhp: this.maxHp };
  }

  flags() {
    let f = statusFlags(this);
    if (this.dead) f |= F.DEAD;
    if (this.windup) f |= F.CAST;
    if (this.state === 'chase') f |= F.COMBAT;
    return f;
  }

  upd() {
    return [this.id, Math.round(this.x * 100), Math.round(this.y * 100), Math.max(0, Math.round(this.hp)), this.maxHp, this.dir, this.flags()];
  }
}

export class NpcEntity {
  constructor(zone, npcDef) {
    this.id = zone.world.nextId();
    this.kind = 'n';
    this.npc = npcDef;
    this.x = npcDef.x;
    this.y = npcDef.y;
    this.ver = 1;
    this.alive = true;
    this.statuses = [];
  }
  full() { return { id: this.id, k: 'n', n: this.npc.id, x: this.x, y: this.y }; }
  upd() { return [this.id, Math.round(this.x * 100), Math.round(this.y * 100), 0, 0, 0, 0]; }
}

export class GroundItem {
  constructor(zone, item, x, y, owners, now = Date.now()) {
    this.id = zone.world.nextId();
    this.kind = 'i';
    this.item = item;
    this.x = x;
    this.y = y;
    this.owners = owners; // ids de jogadores com prioridade
    this.freeAt = now + 30000;
    this.expireAt = now + 90000;
    this.ver = 1;
    this.alive = true;
    this.statuses = [];
  }
  full() {
    return {
      id: this.id, k: 'i', i: this.item.id, r: this.item.r || 0, q: this.item.q || 1, x: this.x, y: this.y,
      o: this.owners, fa: this.freeAt,
    };
  }
  upd() { return [this.id, Math.round(this.x * 100), Math.round(this.y * 100), 0, 0, 0, 0]; }
}
