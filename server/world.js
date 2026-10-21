// O mundo: zonas, jogadores online, laço principal e progressão.
import { ZONES } from '../shared/data/zones.js';
import { CLASSES } from '../shared/data/classes.js';
import { ITEMS } from '../shared/data/items.js';
import { TICK_RATE, MAX_LEVEL, POINTS_PER_LEVEL, DAY_LENGTH, INV_SIZE, STASH_SIZE } from '../shared/constants.js';
import { xpToNext, computeStats } from '../shared/formulas.js';
import { createItem } from '../shared/itemgen.js';
import { Zone } from './zone.js';
import { Player } from './entities/player.js';
import { addItem, newInventory } from './systems/inventory.js';
import { statusList } from './systems/effects.js';
import { handleGameMessage } from './handlers.js';
import { Social } from './social.js';

export class World {
  constructor(db, opts = {}) {
    this.db = db;
    this.dev = !!opts.dev;
    this.xpRate = opts.xpRate || 1;
    this.idCounter = 1;
    this.zones = new Map();
    for (const def of Object.values(ZONES)) this.zones.set(def.id, new Zone(this, def));
    this.players = new Map();
    this.byName = new Map();
    this.sessionsByAccount = new Map();
    this.social = new Social(this);
    this.trades = true;
    this.tickCount = 0;
    this.lastTick = Date.now();
    this.started = Date.now();
    this.rankCache = null;
  }

  nextId() { return this.idCounter++; }

  start() {
    this.timer = setInterval(() => this.tick(), 1000 / TICK_RATE);
    this.saveTimer = setInterval(() => this.saveAll(), 60000);
    this.saveTimer.unref();
  }

  stop() {
    clearInterval(this.timer);
    clearInterval(this.saveTimer);
    this.saveAll();
  }

  worldTime() {
    // segundos dentro do ciclo de dia (0 = meia-noite). Começa de manhã.
    return ((Date.now() - this.started) / 1000 + DAY_LENGTH * 0.3) % DAY_LENGTH;
  }

  saveAll() {
    for (const p of this.players.values()) p.syncChar();
    try { this.db.save(); } catch (e) { console.error('[world] falha ao salvar', e); }
  }

  // ---------------------------------------------------------------- laço
  tick() {
    const now = Date.now();
    const dt = Math.min(0.2, (now - this.lastTick) / 1000);
    this.lastTick = now;
    this.tickCount++;
    for (const z of this.zones.values()) {
      try { z.update(now, dt); } catch (e) { console.error('[world] erro na zona', z.id, e); }
    }
    for (const z of this.zones.values()) {
      if (z.players.size) z.sendSnapshots(now);
    }
    for (const p of this.players.values()) this.flush(p, now);
    if (this.tickCount % TICK_RATE === 0) this.social.tickSecond(now);
    if (this.tickCount % (TICK_RATE * 30) === 0) {
      const t = this.worldTime();
      for (const p of this.players.values()) p.send({ t: 'time', w: t, len: DAY_LENGTH });
    }
  }

  // Envia ao cliente as partes do estado que mudaram.
  flush(p, now) {
    const ch = p.char;
    if (p.dirty.me) {
      p.dirty.me = false;
      const me = {
        t: 'me', hp: Math.round(p.hp), mp: Math.round(p.mp), mhp: p.stats.maxHp, mmp: p.stats.maxMp,
        xp: ch.xp, nx: xpToNext(ch.level), lv: ch.level, g: ch.gold, pts: ch.points,
      };
      const key = JSON.stringify(me);
      if (key !== p.lastMe) { p.lastMe = key; p.send(me); }
    }
    if (p.dirty.stats) { p.dirty.stats = false; p.send({ t: 'stats', s: p.stats }); }
    if (p.dirty.inv) { p.dirty.inv = false; p.send({ t: 'inv', l: ch.inv }); }
    if (p.dirty.equip) { p.dirty.equip = false; p.send({ t: 'eqp', e: ch.equip }); }
    if (p.dirty.quests) { p.dirty.quests = false; p.send({ t: 'quests', a: ch.quests.active, d: ch.quests.done }); }
    if (p.dirty.stash) { p.dirty.stash = false; p.send({ t: 'stash', l: ch.stash }); }
    if (p.dirty.statuses || p.flagsDirty) {
      p.dirty.statuses = false;
      p.flagsDirty = false;
      p.send({ t: 'sts', l: statusList(p, now) });
    }
  }

  // ---------------------------------------------------------------- personagens
  newCharacter(name, cls, skin, hair) {
    const c = CLASSES[cls];
    const town = ZONES.town;
    const ch = {
      name, cls, skin, hair, level: 1, xp: 0, gold: 25,
      alloc: { str: 0, dex: 0, int: 0, vit: 0 }, points: 0,
      hp: 1, mp: 1, zone: 'town', x: town.spawn.x, y: town.spawn.y,
      inv: newInventory(INV_SIZE), equip: {}, stash: newInventory(STASH_SIZE),
      quests: { active: {}, done: {} }, visited: ['town'], flags: {}, title: null, guild: null,
      record: { kills: 0, bossKills: 0, pvpKills: 0, deaths: 0 }, buffs: [],
      created: Date.now(), lastSeen: Date.now(), playTime: 0,
    };
    for (const s of c.startItems) {
      const [id, q] = s.split(':');
      const it = createItem(id, { qty: Number(q) || 1 });
      const base = ITEMS[id];
      if (base.slot && !ch.equip[base.slot]) ch.equip[base.slot] = it;
      else addItem(ch.inv, it);
    }
    addItem(ch.inv, createItem('scroll_return', { qty: 2 }));
    const st = computeStats(ch);
    ch.hp = st.maxHp;
    ch.mp = st.maxMp;
    return ch;
  }

  // Garante campos de versões antigas do save.
  migrateChar(ch) {
    ch.alloc ||= { str: 0, dex: 0, int: 0, vit: 0 };
    ch.points ??= 0;
    ch.inv ||= newInventory(INV_SIZE);
    while (ch.inv.length < INV_SIZE) ch.inv.push(null);
    ch.stash ||= newInventory(STASH_SIZE);
    while (ch.stash.length < STASH_SIZE) ch.stash.push(null);
    ch.equip ||= {};
    ch.quests ||= { active: {}, done: {} };
    ch.visited ||= ['town'];
    ch.flags ||= {};
    ch.record ||= { kills: 0, bossKills: 0, pvpKills: 0, deaths: 0 };
    ch.buffs ||= [];
    if (!this.zones.has(ch.zone)) { ch.zone = 'town'; ch.x = ZONES.town.spawn.x; ch.y = ZONES.town.spawn.y; }
    if (ch.guild && !this.db.guilds[ch.guild.toLowerCase()]) ch.guild = null;
  }

  enterWorld(session, ch) {
    this.migrateChar(ch);
    const p = new Player(this, session, ch);
    this.players.set(p.id, p);
    this.byName.set(ch.name.toLowerCase(), p);
    let zone = this.zones.get(ch.zone);
    let x = ch.x, y = ch.y;
    // personagens mortos voltam vivos na vila
    if (p.dead) {
      p.dead = false;
      p.hp = Math.round(p.stats.maxHp * 0.5);
      zone = this.zones.get('town');
      x = ZONES.town.spawn.x; y = ZONES.town.spawn.y;
    }
    // a arena não guarda posição
    if (zone.def.pvp) { zone = this.zones.get('town'); x = ZONES.town.spawn.x; y = ZONES.town.spawn.y; }
    zone.addPlayer(p, x, y);
    this.sendWorld(p, true);
    this.social.onLogin(p);
    console.log(`[world] ${ch.name} entrou (${this.players.size} online)`);
    return p;
  }

  leaveWorld(p) {
    if (!this.players.has(p.id)) return;
    this.social.onLogout(p);
    p.syncChar();
    if (p.zone) p.zone.removePlayer(p);
    this.players.delete(p.id);
    this.byName.delete(p.name.toLowerCase());
    this.db.markDirty();
    console.log(`[world] ${p.name} saiu (${this.players.size} online)`);
  }

  sendWorld(p, first = false) {
    const ch = p.char;
    const z = p.zone;
    if (!ch.visited.includes(z.id)) {
      ch.visited.push(z.id);
      p.send({ t: 'msg', m: `Nova Pedra do Caminho registrada: ${z.def.name}`, k: 'good' });
    }
    p.send({
      t: 'world', first, zone: z.payload, time: this.worldTime(), len: DAY_LENGTH, dev: this.dev,
      you: {
        id: p.id, name: p.name, cls: p.cls, x: p.x, y: p.y, s: p.posSeq, char: {
          level: ch.level, xp: ch.xp, gold: ch.gold, points: ch.points, alloc: ch.alloc, inv: ch.inv, equip: ch.equip,
          stash: ch.stash, quests: ch.quests, visited: ch.visited, flags: ch.flags, title: ch.title, guild: ch.guild,
          skin: ch.skin, hair: ch.hair, record: ch.record,
        },
        hp: Math.round(p.hp), mp: Math.round(p.mp), dead: p.dead,
      },
    });
    p.dirty.me = p.dirty.stats = p.dirty.statuses = true;
    p.lastMe = '';
    p.lastMoveAt = Date.now();
  }

  transfer(p, zoneId, x, y) {
    const to = this.zones.get(zoneId);
    if (!to || !p.zone) return;
    this.social.onZoneChange(p);
    p.zone.removePlayer(p);
    p.attackTarget = null;
    p.casting = null;
    p.posSeq++;
    to.addPlayer(p, x, y);
    p.portalLock = Date.now() + 1500;
    this.sendWorld(p);
  }

  // ---------------------------------------------------------------- progressão
  giveXp(p, amount, fromQuest = false) {
    const ch = p.char;
    if (ch.level >= MAX_LEVEL) return;
    let v = amount * (1 + (p.mods.xp || 0));
    if (fromQuest) v *= this.xpRate;
    v = Math.max(1, Math.round(v));
    ch.xp += v;
    p.fxQueue.push({ k: 'xp', v });
    let leveled = false;
    while (ch.level < MAX_LEVEL && ch.xp >= xpToNext(ch.level)) {
      ch.xp -= xpToNext(ch.level);
      ch.level++;
      ch.points += POINTS_PER_LEVEL;
      leveled = true;
    }
    if (ch.level >= MAX_LEVEL) ch.xp = 0;
    if (leveled) {
      p.recalc();
      p.hp = p.stats.maxHp;
      p.mp = p.stats.maxMp;
      p.ver++;
      p.zone.fx({ k: 'lv', id: p.id }, p.x, p.y);
      p.send({ t: 'lvl', lv: ch.level });
      if (ch.level % 5 === 0 || ch.level === MAX_LEVEL) this.broadcastSystem(`${p.name} alcançou o nível ${ch.level}!`, 'good');
      if (p.party) this.social.sendParty(p.party);
    }
    p.dirty.me = true;
    this.db.markDirty();
  }

  giveGold(p, amount, fromKill = false) {
    if (amount <= 0) return;
    p.char.gold += Math.round(amount);
    p.dirty.me = true;
    if (fromKill) p.fxQueue.push({ k: 'gd', v: Math.round(amount) });
  }

  broadcastSystem(text, kind = 'info') {
    const msg = { t: 'chat', c: 'sistema', m: text, k: kind };
    for (const p of this.players.values()) p.send(msg);
  }

  handle(p, msg) {
    handleGameMessage(this, p, msg);
  }

  // ---------------------------------------------------------------- ranking
  ranking() {
    const now = Date.now();
    if (this.rankCache && now - this.rankCache.at < 15000) return this.rankCache.data;
    for (const p of this.players.values()) p.syncChar();
    const chars = this.db.allChars();
    const map = (c) => ({ n: c.name, c: c.cls, l: c.level, g: c.guild || null, t: c.title || null });
    const data = {
      level: [...chars].sort((a, b) => b.level - a.level || b.xp - a.xp).slice(0, 10).map(map),
      pvp: [...chars].filter((c) => c.record?.pvpKills).sort((a, b) => b.record.pvpKills - a.record.pvpKills).slice(0, 10).map((c) => ({ ...map(c), v: c.record.pvpKills })),
      boss: [...chars].filter((c) => c.record?.bossKills).sort((a, b) => b.record.bossKills - a.record.bossKills).slice(0, 10).map((c) => ({ ...map(c), v: c.record.bossKills })),
    };
    this.rankCache = { at: now, data };
    return data;
  }

  cancelTrade(p, reason) {
    this.social.cancelTrade(p, reason);
  }
}
