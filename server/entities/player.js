// Jogador conectado: estado em tempo real em volta do personagem persistente (char).
import { computeStats } from '../../shared/formulas.js';
import { statusMods, statusFlags } from '../systems/effects.js';
import { F, EQUIP_SLOTS } from '../../shared/constants.js';
import { isSafeAt } from '../../shared/data/zones.js';

export class Player {
  constructor(world, session, char) {
    this.world = world;
    this.session = session;
    this.char = char;
    this.id = world.nextId();
    this.kind = 'p';
    this.isPlayer = true;
    this.isMonster = false;
    this.name = char.name;
    this.cls = char.cls;
    this.zone = null;
    this.x = char.x;
    this.y = char.y;
    this.dir = 0;
    this.hp = char.hp;
    this.mp = char.mp;
    this.dead = char.hp <= 0;
    this.statuses = [];
    const now = Date.now();
    for (const b of char.buffs || []) {
      if (b.remain > 0) this.statuses.push({ ...b.st, until: now + b.remain, persist: true });
    }
    this.cd = {};
    this.gcd = 0;
    this.potCd = { hp: 0, mp: 0 };
    this.attackTarget = null;
    this.target = null;
    this.nextAttack = 0;
    this.combatUntil = 0;
    this.casting = null;
    this.party = null;
    this.trade = null;
    this.invites = {};
    this.known = new Map();
    this.fxQueue = [];
    this.posSeq = 1;
    this.lastMoveAt = now;
    this.portalLock = 0;
    this.altarCheck = 0; // última vez que procurou altares por perto
    this.altarCd = 0; // até quando não pode viajar de novo
    this.ver = 1;
    this.lastChat = 0;
    this.chatBurst = 0;
    this.replyTo = null;
    this.regenAt = now + 1000;
    this.flagsDirty = true;
    this.dirty = { me: true, stats: true, inv: true, equip: true, quests: true, stash: false, statuses: true };
    this.lastMe = '';
    this.loginAt = now;
    this.recalc();
  }

  get alive() { return !this.dead; }
  get level() { return this.char.level; }

  recalc() {
    this.mods = statusMods(this);
    this.stats = computeStats(this.char, this.mods);
    if (this.hp > this.stats.maxHp) this.hp = this.stats.maxHp;
    if (this.mp > this.stats.maxMp) this.mp = this.stats.maxMp;
    this.dirty.stats = true;
    this.dirty.statuses = true;
  }

  send(obj) {
    this.session.send(obj);
  }

  msg(text, kind = 'info') {
    this.send({ t: 'msg', m: text, k: kind });
  }

  err(text) {
    this.send({ t: 'msg', m: text, k: 'err' });
  }

  inCombat(now = Date.now()) {
    return now < this.combatUntil;
  }

  inSafeArea() {
    return !this.zone || isSafeAt(this.zone.def, this.x, this.y);
  }

  appearance() {
    const e = this.char.equip;
    const a = {};
    for (const s of EQUIP_SLOTS) if (e[s]) a[s[0]] = e[s].id;
    if (e.weapon && e.weapon.p >= 7) a.glow = e.weapon.p;
    return a;
  }

  full() {
    const ch = this.char;
    return {
      id: this.id, k: 'p', nm: this.name, cls: this.cls, lv: ch.level, sk: ch.skin, hr: ch.hair,
      g: ch.guild || null, ti: ch.title || null, x: this.x, y: this.y, hp: Math.round(this.hp), mhp: this.stats.maxHp,
      app: this.appearance(), pa: this.party ? this.party.id : 0,
    };
  }

  flags() {
    let f = statusFlags(this);
    if (this.dead) f |= F.DEAD;
    if (this.inCombat()) f |= F.COMBAT;
    if (this.casting) f |= F.CAST;
    if (this.zone && this.zone.def.pvp && !this.inSafeArea()) f |= F.PVP;
    return f;
  }

  upd() {
    return [this.id, Math.round(this.x * 100), Math.round(this.y * 100), Math.round(this.hp), this.stats.maxHp, this.dir, this.flags()];
  }

  // Sincroniza o estado em tempo real de volta ao registro persistente.
  syncChar() {
    const ch = this.char;
    ch.hp = Math.round(this.hp);
    ch.mp = Math.round(this.mp);
    if (this.zone) {
      ch.zone = this.zone.id;
      ch.x = Math.round(this.x * 100) / 100;
      ch.y = Math.round(this.y * 100) / 100;
    }
    const now = Date.now();
    ch.buffs = this.statuses.filter((s) => s.persist && s.until > now).map((s) => {
      const st = { ...s };
      delete st.until;
      return { st, remain: s.until - now };
    });
    ch.playTime = (ch.playTime || 0) + Math.round((now - this.loginAt) / 1000);
    this.loginAt = now;
    ch.lastSeen = now;
  }
}
