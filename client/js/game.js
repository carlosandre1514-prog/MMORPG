// Estado do jogo no cliente: rede, simulação local do jogador, interpolação e ações.
import { TILE, F, PLAYER_RADIUS, NPC_RANGE, PICKUP_RANGE } from '/shared/constants.js';
import { SKILLS } from '/shared/data/skills.js';
import { CLASSES } from '/shared/data/classes.js';
import { QUESTS } from '/shared/data/quests.js';
import { ZONES, isSafeAt } from '/shared/data/zones.js';
import { MONSTERS } from '/shared/data/monsters.js';
import { ITEMS } from '/shared/data/items.js';
import { NPCS } from '/shared/data/npcs.js';
import { buildMap, decodeLayer } from '/shared/tiles.js';
import { moveWithCollision, canStand } from '/shared/collision.js';
import { findPath } from '/shared/pathfinding.js';
import { itemName } from '/shared/itemgen.js';
import { Terrain } from './terrain.js';
import { Renderer } from './render.js';
import { Effects } from './fx.js';
import { Input } from './input.js';
import { audio } from './audio.js';
import { canAccept, isComplete } from './questlogic.js';

const INTERP_DELAY = 110;

export class Game {
  constructor(net, canvas, ui) {
    this.net = net;
    this.ui = ui;
    this.canvas = canvas;
    this.entities = new Map();
    this.me = { id: 0, x: 0, y: 0, posSeq: 0, hp: 1, mp: 1, mhp: 1, mmp: 1, level: 1, xp: 0, nx: 100, gold: 0, points: 0, stats: null, statuses: [], inv: [], equip: {}, stash: [], quests: { active: {}, done: {} }, visited: [], flags: {} };
    this.zone = null;
    this.terrain = null;
    this.zoom = Math.max(1.15, Math.min(2.2, window.innerWidth / (34 * TILE)));
    this.fx = new Effects(this);
    this.input = new Input(canvas);
    this.renderer = new Renderer(canvas, this);
    this.target = null;
    this.hover = null;
    this.cooldowns = {};
    this.gcd = { end: 0, dur: 400 };
    this.potCd = { hp: { end: 0, dur: 1 }, mp: { end: 0, dur: 1 } };
    this.path = null;
    this.action = null;
    this.lastSend = 0;
    this.sent = { x: 0, y: 0, d: 0 };
    this.offsets = [];
    this.serverOffset = 0;
    this.party = null;
    this.guild = null;
    this.trade = null;
    this.timeBase = { w: 400, len: 1200, at: performance.now() };
    this.shake = 0;
    this.showItemNames = false;
    this.markerCache = new Map();
    this.markerVer = 0;
    this.running = false;
    this.lastFrame = performance.now();
    this.dialogNpc = null;
    this.lastAtkSent = 0;
    this.offNet = net.on((m) => this.onMessage(m));
    this.bindInput();
  }

  start() {
    if (this.running) return;
    this.running = true;
    const loop = (ts) => {
      if (!this.running) return;
      const dt = Math.min(0.1, (ts - this.lastFrame) / 1000);
      this.lastFrame = ts;
      this.update(dt);
      this.renderer.render(ts / 1000);
      this.ui.frame();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    this.offNet();
  }

  myEntity() { return this.entities.get(this.me.id); }

  serverNow() { return performance.now() + this.serverOffset; }

  dayTime() {
    const tb = this.timeBase;
    return (((tb.w + (performance.now() - tb.at) / 1000) % tb.len) + tb.len) % tb.len / tb.len;
  }

  questDone(id) { return !!this.me.quests?.done?.[id]; }

  // ------------------------------------------------------------------ rede
  onMessage(m) {
    const me = this.me;
    switch (m.t) {
      case 'world': this.setupWorld(m); break;
      case 's': this.onSnapshot(m); break;
      case 'fx': for (const ev of m.l) this.onFx(ev); break;
      case 'me': {
        const lvlUp = m.lv > me.level;
        Object.assign(me, { hp: m.hp, mp: m.mp, mhp: m.mhp, mmp: m.mmp, xp: m.xp, nx: m.nx, level: m.lv, gold: m.g, points: m.pts });
        if (lvlUp) this.markerVer++;
        this.ui.onMe();
        break;
      }
      case 'stats': me.stats = m.s; this.ui.onStats(); break;
      case 'inv': me.inv = m.l; this.markerVer++; this.ui.onInventory(); break;
      case 'eqp': me.equip = m.e; this.ui.onEquip(); break;
      case 'quests': me.quests = { active: m.a, done: m.d }; this.markerVer++; this.ui.onQuests(); break;
      case 'stash': me.stash = m.l; this.ui.onStash(); break;
      case 'sts': me.statuses = m.l.map((s) => ({ ...s, end: performance.now() + s.r * 1000 })); this.ui.onStatuses(); break;
      case 'cd': {
        const now = performance.now();
        this.cooldowns[m.s] = { end: now + m.d, dur: m.d };
        this.gcd = { end: now + m.g, dur: m.g };
        break;
      }
      case 'pcd': this.potCd[m.k] = { end: performance.now() + m.d, dur: m.d }; break;
      case 'pos': {
        me.x = m.x; me.y = m.y; me.posSeq = m.s;
        this.path = null;
        this.sent = { x: m.x, y: m.y, d: me.dir };
        break;
      }
      case 'dead': me.dead = true; this.action = null; this.path = null; audio.play('death'); this.ui.showDeath(m); break;
      case 'alive': me.dead = false; this.ui.hideDeath(); break;
      case 'party': this.party = m.none ? null : m; this.ui.onParty(); break;
      case 'guild': this.guild = m.none ? null : m; this.ui.onGuild(); break;
      case 'trade': if (m.closed) { this.trade = null; this.ui.closeTrade(); } else { this.trade = m; this.ui.onTrade(); } break;
      case 'invite': this.ui.showInvite(m); audio.play('whisper'); break;
      case 'chat': this.ui.chatMsg(m); if (m.c === 'sussurro' && !m.out) audio.play('whisper'); break;
      case 'msg': this.ui.toast(m.m, m.k); if (m.k === 'err') audio.play('error'); break;
      case 'err': this.ui.toast(m.m, 'err'); audio.play('error'); break;
      case 'qprog': this.ui.toast(m.m, 'progress'); audio.play('click'); break;
      case 'qdone': audio.play('quest'); this.ui.questCompleted(m.q); this.markerVer++; break;
      case 'loot': audio.play('pickup'); this.ui.lootNotice(m); break;
      case 'lvl': audio.play('levelup'); this.ui.levelUp(m.lv); this.markerVer++; break;
      case 'cast': me.casting = { start: performance.now(), dur: m.d, name: m.n }; this.ui.onCast(); break;
      case 'castEnd': me.casting = null; this.ui.onCast(); break;
      case 'time': this.timeBase = { w: m.w, len: m.len, at: performance.now() }; break;
      case 'rank': this.ui.onRank(m.d); break;
      case 'enhres': this.ui.onEnhanceResult(m); audio.play(m.ok ? 'enhance_ok' : 'enhance_fail'); break;
      case 'crafted': this.ui.toast(`Criado: ${m.n}${m.q > 1 ? ' x' + m.q : ''}`, 'good'); audio.play('enhance_ok'); break;
      case 'sfx': audio.play(m.s); break;
      case 'kick': this.ui.fatal(m.m); break;
      default: break;
    }
  }

  setupWorld(m) {
    const z = m.zone;
    const prevZone = this.zone ? this.zone.id : null;
    const tiles = decodeLayer(z.t), objs = decodeLayer(z.o);
    this.zone = { id: z.id, w: z.w, h: z.h, def: ZONES[z.id], structures: z.st, map: buildMap(z.w, z.h, tiles, objs, z.st) };
    this.terrain = new Terrain(this.zone);
    this.entities.clear();
    this.fx.list = []; this.fx.particles = [];
    this.target = null; this.hover = null; this.path = null; this.action = null;
    const me = this.me;
    const y = m.you;
    me.id = y.id; me.name = y.name; me.cls = y.cls;
    me.x = y.x; me.y = y.y; me.posSeq = y.s; me.dir = 0;
    me.hp = y.hp; me.mp = y.mp; me.dead = y.dead;
    const c = y.char;
    Object.assign(me, {
      level: c.level, xp: c.xp, gold: c.gold, points: c.points, alloc: c.alloc, inv: c.inv, equip: c.equip, stash: c.stash,
      quests: c.quests, visited: c.visited, flags: c.flags, title: c.title, guild: c.guild, skin: c.skin, hair: c.hair, record: c.record,
    });
    this.sent = { x: me.x, y: me.y, d: 0 };
    this.timeBase = { w: m.time, len: m.len, at: performance.now() };
    this.dev = m.dev;
    this.markerVer++;
    audio.startMusic(this.zone.def.music || 'town');
    if (prevZone && prevZone !== z.id) audio.play('portal');
    this.ui.onWorld(m.first, prevZone !== z.id);
  }

  onSnapshot(m) {
    const now = performance.now();
    // estimativa do relógio do servidor (menor atraso observado)
    this.offsets.push(m.ts - now);
    if (this.offsets.length > 40) this.offsets.shift();
    this.serverOffset = Math.max(...this.offsets);
    for (const full of m.n) {
      let e = this.entities.get(full.id);
      if (!e) {
        e = { ...full, rx: full.x, ry: full.y, buf: [{ t: m.ts, x: full.x, y: full.y }], phase: Math.random() * 6, dir: 0, f: 0, moving: false };
        if (e.k === 'i') e.name = null;
        this.entities.set(full.id, e);
      } else {
        Object.assign(e, full);
        e.look = null;
      }
    }
    for (const u of m.u) {
      const e = this.entities.get(u[0]);
      if (!e) continue;
      const x = u[1] / 100, y = u[2] / 100;
      const hp = u[3], f = u[6];
      if (e.hp != null && hp < e.hp && !(f & F.DEAD)) e.hurt = now;
      if (!(e.f & F.DEAD) && (f & F.DEAD)) {
        e.deathStart = now;
        if (e.k === 'm') {
          audio.play('monsterdie', 0.6);
          this.fx.burst(e.rx * TILE, e.ry * TILE - 10, 14, { color: MONSTERS[e.m].color, color2: '#ffffff', speed: 70, life: 600 });
          if (this.target === e.id) this.target = null;
        }
      }
      if ((e.f & F.DEAD) && !(f & F.DEAD)) e.deathStart = 0;
      e.hp = hp; e.mhp = u[4]; e.f = f;
      if (e.id === this.me.id) continue;
      e.dir = u[5];
      const last = e.buf[e.buf.length - 1];
      if (last && m.ts - last.t > 250) e.buf.push({ t: m.ts - 60, x: last.x, y: last.y });
      e.buf.push({ t: m.ts, x, y });
      if (e.buf.length > 14) e.buf.shift();
      e.x = x; e.y = y;
      if (Math.hypot(x - e.rx, y - e.ry) > 6) { e.rx = x; e.ry = y; e.buf = [{ t: m.ts, x, y }]; }
    }
    for (const id of m.r) {
      this.entities.delete(id);
      if (this.target === id) this.target = null;
      if (this.hover && this.hover.id === id) this.hover = null;
    }
  }

  entityHead(e) {
    return { x: e.rx * TILE, y: e.ry * TILE - this.renderer.entityHeight(e) };
  }

  onFx(ev) {
    const me = this.me;
    const now = performance.now();
    const ent = (id) => this.entities.get(id);
    const nearMe = (x, y) => Math.hypot(x - me.x, y - me.y) < 14;
    switch (ev.k) {
      case 'd': {
        const e = ent(ev.id);
        if (!e) break;
        const h = this.entityHead(e);
        const mine = ev.s === me.id, onMe = ev.id === me.id;
        const color = onMe ? '#ff5252' : ev.h === 'o' ? '#c39bd3' : mine ? (ev.c ? '#ffb142' : '#ffffff') : '#d5d8dc';
        const size = onMe ? 14 : mine ? (ev.c ? 20 : 15) : 11;
        this.fx.text(h.x, h.y, String(ev.v) + (ev.c ? '!' : ''), color, { crit: ev.c, size });
        if (ev.ab) this.fx.text(h.x, h.y + 12, `(${ev.ab} absorvido)`, '#bb8fce', { size: 9 });
        if (mine || onMe) audio.play(ev.c ? 'crit' : 'hit', onMe ? 0.8 : 1);
        if (onMe && ev.v > me.mhp * 0.15) this.shake = 6;
        if (ev.h !== 'o') this.fx.burst(e.rx * TILE, e.ry * TILE - 14, ev.c ? 8 : 4, { color: e.k === 'm' ? MONSTERS[e.m].color : '#e74c3c', color2: '#ffffff', speed: 50, life: 350 });
        break;
      }
      case 'h': {
        const e = ent(ev.id);
        if (!e) break;
        const h = this.entityHead(e);
        this.fx.text(h.x, h.y, '+' + ev.v, '#58d68d', { size: 13 });
        if (ev.id === me.id && ev.v > 5) this.fx.burst(e.rx * TILE, e.ry * TILE - 10, 6, { style: 'heal', speed: 20, up: 40, life: 600, glow: true, grav: -20 });
        break;
      }
      case 'mp': { const e = ent(ev.id); if (e) { const h = this.entityHead(e); this.fx.text(h.x, h.y, '+' + ev.v, '#5dade2', { size: 12 }); } break; }
      case 'mi': { const e = ent(ev.id); if (e) { const h = this.entityHead(e); this.fx.text(h.x, h.y, ev.t, '#bdc3c7', { size: 11 }); } break; }
      case 'pr': {
        const a = ent(ev.a);
        if (!a) break;
        this.fx.add({ kind: 'proj', fromPos: { x: a.rx * TILE, y: a.ry * TILE - 18 }, to: ev.b, style: ev.s, dur: Math.max(60, ev.t) });
        if (nearMe(a.rx, a.ry)) {
          const snd = { arrow: 'arrow', arrow_big: 'arrow', poison: 'arrow', fire: 'fire', frost: 'frost', holy: 'holy', arcane: 'magic', shadow: 'magic', ash: 'fire', heal: 'heal' }[ev.s];
          if (snd) audio.play(snd, ev.a === me.id ? 1 : 0.5);
        }
        a.atkStart = now;
        break;
      }
      case 'sw': {
        const a = ent(ev.id);
        if (!a) break;
        a.atkStart = now;
        this.fx.add({ kind: 'swing', id: ev.id, target: ev.b, style: ev.s, dur: 260 });
        if (nearMe(a.rx, a.ry)) audio.play('swing', ev.id === me.id ? 1 : 0.5);
        break;
      }
      case 'ao': {
        this.fx.add({ kind: 'aoe', x: ev.x, y: ev.y, r: ev.r, style: ev.s, id: ev.id, dur: 550, ground: true });
        this.fx.burst(ev.x * TILE, ev.y * TILE, Math.min(40, 8 + ev.r * 6), { style: ev.s, speed: ev.r * 40, life: 650, glow: ['meteor', 'fire', 'grace', 'frostnova', 'void'].includes(ev.s), up: 20 });
        if (nearMe(ev.x, ev.y)) {
          const snd = { meteor: 'explosion', fire: 'explosion', stomp: 'stomp', rock: 'stomp', void: 'explosion', frostnova: 'frost', grace: 'heal', whirl: 'swing', shout: 'buff', poison: 'hit', charge: 'stomp' }[ev.s];
          if (snd) audio.play(snd);
          if (['meteor', 'stomp', 'rock', 'void', 'fire', 'charge'].includes(ev.s)) this.shake = Math.max(this.shake, ev.s === 'void' ? 10 : 5);
        }
        break;
      }
      case 'tg':
        this.fx.add({ kind: 'tele', x: ev.x, y: ev.y, r: ev.r, dur: ev.t, style: ev.s, friendly: !!ev.f });
        if (ev.s === 'meteor' || ev.s === 'fire') this.fx.add({ kind: 'falling', x: ev.x, y: ev.y, dur: ev.t });
        if (!ev.f && Math.hypot(ev.x - me.x, ev.y - me.y) < ev.r + 1) audio.play('warn');
        break;
      case 'ar': this.fx.add({ kind: 'area', x: ev.x, y: ev.y, r: ev.r, dur: ev.t, style: ev.s }); if (ev.s === 'arrows' && nearMe(ev.x, ev.y)) audio.play('arrow'); break;
      case 'bf': this.fx.add({ kind: 'buff', id: ev.id, style: ev.s, dur: 900 }); if (ev.id === me.id) audio.play('buff'); break;
      case 'ds': this.fx.add({ kind: 'dash', x0: ev.x0, y0: ev.y0, x: ev.x, y: ev.y, style: ev.s, dur: 350 }); {
        const e = ent(ev.id);
        if (e && e.id !== me.id) { e.rx = ev.x; e.ry = ev.y; e.buf = [{ t: this.serverNow(), x: ev.x, y: ev.y }]; }
      } break;
      case 'lv': {
        this.fx.add({ kind: 'lvl', id: ev.id, dur: 1600 });
        const e = ent(ev.id);
        if (e) { const h = this.entityHead(e); this.fx.text(h.x, h.y - 10, 'NÍVEL!', '#f7dc6f', { size: 16, dur: 1800, crit: true }); this.fx.burst(e.rx * TILE, e.ry * TILE - 20, 30, { style: 'grace', speed: 90, life: 900, glow: true, up: 40 }); }
        break;
      }
      case 'rv': this.fx.add({ kind: 'rv', id: ev.id, dur: 1400 }); audio.play('heal'); break;
      case 'sp': this.fx.add({ kind: 'sp', x: ev.x, y: ev.y, dur: 900 }); break;
      case 'ab': {
        const e = ent(ev.id);
        if (e) { const h = this.entityHead(e); this.fx.text(h.x, h.y - 18, ev.n, '#ff9f43', { size: 12, vy: -12, dur: 1600 }); }
        break;
      }
      case 'ag': {
        const e = ent(ev.id);
        if (e) { const h = this.entityHead(e); this.fx.text(h.x, h.y - 6, '!', '#ff4d4d', { size: 18, vy: -10, dur: 700 }); }
        break;
      }
      case 'xp': {
        const e = this.myEntity();
        if (e) { const h = this.entityHead(e); this.fx.text(h.x + 22, h.y + 10, `+${ev.v} XP`, '#c39bd3', { size: 11, vy: -25, dur: 1400 }); }
        break;
      }
      case 'gd': {
        const e = this.myEntity();
        if (e) { const h = this.entityHead(e); this.fx.text(h.x - 22, h.y + 16, `+${ev.v} ouro`, '#f4d03f', { size: 11, vy: -25, dur: 1400 }); audio.play('coin', 0.5); }
        break;
      }
      case 'cs': {
        const sk = SKILLS[ev.s];
        const e = ent(ev.id);
        if (sk && e) {
          this.fx.burst(e.rx * TILE, e.ry * TILE - 20, 6, { color: sk.icon.c1, color2: sk.icon.c2, speed: 30, life: 400, glow: true, up: 20 });
          if (ev.id === me.id) this.ui.flashSkill(ev.s);
        }
        break;
      }
      case 'bb': {
        const e = ent(ev.id);
        if (e) e.bubble = { text: ev.m, until: performance.now() + 5000 };
        break;
      }
      default: break;
    }
  }

  // ------------------------------------------------------------------ entrada
  bindInput() {
    const inp = this.input;
    inp.on('press', (k, e) => {
      if (!this.zone) return;
      audio.init();
      if (this.ui.handleKey(k, e)) return;
      if (k >= '1' && k <= '6') { this.useSkillIndex(Number(k) - 1); return; }
      switch (k) {
        case 'q': this.usePotion('hp'); break;
        case 'r': this.usePotion('mp'); break;
        case 'Tab': this.cycleTarget(); break;
        case 'f': case ' ': this.interactNearest(); break;
        case 'z': this.showItemNames = !this.showItemNames; break;
        case 'Escape': if (this.target) this.target = null; break;
        default: break;
      }
    });
    inp.on('click', (button) => {
      if (!this.zone || this.me.dead) return;
      audio.init();
      this.ui.closeMenus();
      const e = this.hover;
      const wp = this.renderer.screenToWorld(inp.mouse.x, inp.mouse.y);
      if (button === 2 && e && e.k === 'p' && e.id !== this.me.id) { this.ui.playerMenu(e, inp.mouse.x, inp.mouse.y); return; }
      if (e) {
        if (e.k === 'm' && !(e.f & F.DEAD)) { this.target = e.id; this.action = { type: 'attack', id: e.id }; this.path = null; return; }
        if (e.k === 'n') { this.target = e.id; this.action = { type: 'npc', id: e.id }; this.path = null; return; }
        if (e.k === 'i') { this.action = { type: 'pick', id: e.id }; this.path = null; return; }
        if (e.k === 'p') {
          this.target = e.id;
          if (this.isHostile(e)) this.action = { type: 'attack', id: e.id };
          return;
        }
      }
      // mover para o ponto clicado
      this.action = null;
      this.sendAttack(null);
      const p = findPath(this.zone.map, this.me.x, this.me.y, wp.x, wp.y, 6000);
      this.path = p;
      this.fx.add({ kind: 'aoe', x: wp.x, y: wp.y, r: 0.35, style: 'whirl', dur: 400, ground: true });
    });
    inp.on('wheel', (d) => {
      this.zoom = Math.max(1, Math.min(3.2, this.zoom * (d > 0 ? 0.9 : 1.1)));
    });
  }

  isHostile(e) {
    if (!e || (e.f & F.DEAD)) return false;
    if (e.k === 'm') return true;
    if (e.k !== 'p' || e.id === this.me.id) return false;
    const def = this.zone.def;
    if (!def.pvp) return false;
    if (isSafeAt(def, e.rx, e.ry) || isSafeAt(def, this.me.x, this.me.y)) return false;
    if (this.party && this.party.m.some((m) => m.id === e.id)) return false;
    if (this.me.guild && e.g === this.me.guild) return false;
    return true;
  }

  faceDirTo(e) {
    const dx = this.me.x - e.rx, dy = this.me.y - e.ry;
    if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? 1 : 2;
    return dy < 0 ? 3 : 0;
  }

  sendAttack(id) {
    if (id === this.attackSent && performance.now() - this.lastAtkSent < 2000) return;
    this.attackSent = id;
    this.lastAtkSent = performance.now();
    this.net.send({ t: 'atk', id });
  }

  cycleTarget() {
    const me = this.me;
    const list = [...this.entities.values()].filter((e) => this.isHostile(e) && Math.hypot(e.rx - me.x, e.ry - me.y) < 16)
      .sort((a, b) => Math.hypot(a.rx - me.x, a.ry - me.y) - Math.hypot(b.rx - me.x, b.ry - me.y));
    if (!list.length) return;
    const idx = list.findIndex((e) => e.id === this.target);
    this.target = list[(idx + 1) % list.length].id;
  }

  interactNearest() {
    const me = this.me;
    let best = null, bestD = 3.5;
    for (const e of this.entities.values()) {
      if (e.k !== 'i' && e.k !== 'n') continue;
      const d = Math.hypot(e.rx - me.x, e.ry - me.y);
      if (d < bestD) { bestD = d; best = e; }
    }
    if (!best) return;
    this.action = best.k === 'i' ? { type: 'pick', id: best.id } : { type: 'npc', id: best.id };
    if (best.k === 'n') this.target = best.id;
  }

  usePotion(kind) {
    const me = this.me;
    let slot = -1, best = -1;
    me.inv.forEach((it, i) => {
      if (!it) return;
      const b = ITEMS[it.id];
      if (b.type !== 'consumable' || !b.use || !b.use[kind] || b.lvl > me.level) return;
      if (b.lvl > best) { best = b.lvl; slot = i; }
    });
    if (slot < 0) { this.ui.toast(kind === 'hp' ? 'Sem poções de vida!' : 'Sem poções de mana!', 'err'); audio.play('error'); return; }
    this.net.send({ t: 'use', slot });
  }

  skillAt(i) {
    const cls = CLASSES[this.me.cls];
    return cls ? SKILLS[cls.skills[i]] : null;
  }

  useSkillIndex(i) {
    const sk = this.skillAt(i);
    if (sk) this.useSkill(sk);
  }

  useSkill(sk) {
    const me = this.me;
    const now = performance.now();
    if (me.dead) return;
    if (this.zone.def.safe) { this.ui.toast('Você não pode lutar dentro da vila.', 'err'); return; }
    if (me.level < sk.lvl) { this.ui.toast(`${sk.name} requer nível ${sk.lvl}.`, 'err'); audio.play('error'); return; }
    const cd = this.cooldowns[sk.id];
    if (cd && cd.end > now) { this.ui.toast(`${sk.name} em recarga.`, 'err'); return; }
    if (this.gcd.end > now + 60) return;
    if (me.mp < sk.mp) { this.ui.toast('Mana insuficiente.', 'err'); audio.play('error'); return; }
    const mouse = this.renderer.screenToWorld(this.input.mouse.x, this.input.mouse.y);
    switch (sk.target) {
      case 'enemy': {
        let t = this.entities.get(this.target);
        if (!t || !this.isHostile(t)) {
          t = [...this.entities.values()].filter((e) => this.isHostile(e) && Math.hypot(e.rx - me.x, e.ry - me.y) < sk.range + 3)
            .sort((a, b) => Math.hypot(a.rx - me.x, a.ry - me.y) - Math.hypot(b.rx - me.x, b.ry - me.y))[0];
          if (!t) { this.ui.toast('Nenhum alvo.', 'err'); return; }
          this.target = t.id;
        }
        const d = Math.hypot(t.rx - me.x, t.ry - me.y);
        if (d > sk.range + 0.5) { this.action = { type: 'skill', skill: sk.id, id: t.id }; return; }
        this.net.send({ t: 'sk', s: sk.id, id: t.id });
        this.action = { type: 'attack', id: t.id };
        break;
      }
      case 'ally': {
        const t = this.entities.get(this.target);
        const id = t && t.k === 'p' && !this.isHostile(t) ? t.id : me.id;
        this.net.send({ t: 'sk', s: sk.id, id });
        break;
      }
      case 'self': this.net.send({ t: 'sk', s: sk.id }); break;
      case 'ground': {
        let p = this.input.mouse.inside ? mouse : null;
        const t = this.entities.get(this.target);
        if (!p && t) p = { x: t.rx, y: t.ry };
        if (!p) p = { x: me.x, y: me.y };
        this.net.send({ t: 'sk', s: sk.id, x: p.x, y: p.y });
        break;
      }
      case 'dir': {
        const p = this.input.mouse.inside ? mouse : { x: me.x + [0, -1, 1, 0][me.dir || 0] * 5, y: me.y + [1, 0, 0, -1][me.dir || 0] * 5 };
        this.net.send({ t: 'sk', s: sk.id, x: p.x, y: p.y });
        break;
      }
      default: break;
    }
  }

  // ------------------------------------------------------------------ marcadores de missão
  questMarker(npcId) {
    const key = npcId + ':' + this.markerVer;
    if (this.markerCache.has(key)) return this.markerCache.get(key);
    const me = this.me;
    let mark = null;
    const st = me.quests || { active: {}, done: {} };
    for (const q of Object.values(QUESTS)) {
      if (q.turnIn === npcId && st.active[q.id] && isComplete(me, q)) { mark = { s: '?', c: '#ffd34d' }; break; }
    }
    if (!mark) {
      for (const q of Object.values(QUESTS)) {
        if (st.active[q.id] && q.objectives.some((o, i) => o.type === 'talk' && o.npc === npcId && !(st.active[q.id].k[i] >= 1))) { mark = { s: '?', c: '#ffd34d' }; break; }
      }
    }
    if (!mark) {
      for (const q of Object.values(QUESTS)) {
        if (q.giver === npcId && canAccept(me, q)) { mark = { s: '!', c: q.repeatable ? '#5dade2' : '#ffd34d' }; if (!q.repeatable) break; }
      }
    }
    if (!mark) {
      for (const q of Object.values(QUESTS)) {
        if (q.turnIn === npcId && st.active[q.id]) { mark = { s: '?', c: '#aab7b8' }; break; }
      }
    }
    if (this.markerCache.size > 200) this.markerCache.clear();
    this.markerCache.set(key, mark);
    return mark;
  }

  // ------------------------------------------------------------------ atualização por quadro
  update(dt) {
    if (!this.zone) return;
    const now = performance.now();
    this.shake = Math.max(0, this.shake - dt * 30);
    this.updateHover();
    this.processAction(now);
    this.updateMovement(dt, now);
    this.interpolate(dt, now);
    this.fx.update(dt);
  }

  updateHover() {
    const inp = this.input;
    if (!inp.mouse.inside) { this.hover = null; return; }
    const wp = this.renderer.screenToWorld(inp.mouse.x, inp.mouse.y);
    let best = null, bestY = -Infinity;
    for (const e of this.entities.values()) {
      if (e.id === this.me.id) continue;
      if (e.k === 'i') {
        if (Math.hypot(wp.x - e.rx, wp.y - (e.ry - 0.25)) < 0.55 && e.ry > bestY) { best = e; bestY = e.ry + 100; }
        continue;
      }
      if ((e.f & F.DEAD) && e.k === 'm') continue;
      const h = this.renderer.entityHeight(e) / TILE;
      const w = e.k === 'm' ? Math.max(0.5, MONSTERS[e.m].size * 0.45) : 0.45;
      if (wp.x > e.rx - w && wp.x < e.rx + w && wp.y > e.ry - h && wp.y < e.ry + 0.2 && e.ry > bestY) { best = e; bestY = e.ry; }
    }
    this.hover = best;
    this.canvas.style.cursor = best ? (best.k === 'm' || this.isHostile(best) ? 'crosshair' : 'pointer') : 'default';
  }

  processAction(now) {
    const a = this.action;
    const me = this.me;
    if (!a || me.dead) return;
    const e = this.entities.get(a.id);
    if (!e || (e.k === 'm' && (e.f & F.DEAD))) {
      this.action = null;
      if (a.type === 'attack') this.sendAttack(null);
      return;
    }
    const d = Math.hypot(e.rx - me.x, e.ry - me.y);
    let range;
    if (a.type === 'attack') range = (me.stats ? me.stats.atkRange : 1.5) + (e.k === 'm' && MONSTERS[e.m].size > 1.5 ? 0.7 : 0) - 0.15;
    else if (a.type === 'skill') range = SKILLS[a.skill].range;
    else if (a.type === 'npc') range = NPC_RANGE - 1;
    else range = PICKUP_RANGE - 0.5;
    if (d > range) {
      if (!this.keyMoving) {
        if (!this.path || now - (this.pathAt || 0) > 500) {
          this.path = findPath(this.zone.map, me.x, me.y, e.rx, e.ry, 3000);
          this.pathAt = now;
        }
      }
      if (a.type === 'attack') this.sendAttack(e.id);
      return;
    }
    this.path = null;
    switch (a.type) {
      case 'attack': this.sendAttack(e.id); break;
      case 'skill':
        this.net.send({ t: 'sk', s: a.skill, id: e.id });
        this.action = { type: 'attack', id: e.id };
        break;
      case 'npc':
        this.action = null;
        this.net.send({ t: 'talk', n: e.n });
        this.dialogNpc = e.n;
        this.ui.openNpc(NPCS[e.n]);
        break;
      case 'pick':
        this.action = null;
        this.net.send({ t: 'pick', id: e.id });
        break;
      default: break;
    }
  }

  updateMovement(dt, now) {
    const me = this.me;
    const inp = this.input;
    let dx = 0, dy = 0;
    const blocked = me.dead || (this.myFlags() & (F.STUN | F.ROOT));
    if (!this.ui.typing()) {
      if (inp.down('w') || inp.down('ArrowUp')) dy -= 1;
      if (inp.down('s') || inp.down('ArrowDown')) dy += 1;
      if (inp.down('a') || inp.down('ArrowLeft')) dx -= 1;
      if (inp.down('d') || inp.down('ArrowRight')) dx += 1;
    }
    this.keyMoving = !!(dx || dy);
    if (this.keyMoving) {
      this.path = null;
      if (this.action && this.action.type !== 'attack') this.action = null;
    } else if (this.path && this.path.length) {
      const p = this.path[0];
      const ddx = p.x - me.x, ddy = p.y - me.y;
      const dd = Math.hypot(ddx, ddy);
      if (dd < 0.12) { this.path.shift(); if (!this.path.length) this.path = null; }
      else { dx = ddx / dd; dy = ddy / dd; }
    }
    let moving = false;
    if ((dx || dy) && !blocked && me.stats) {
      const len = Math.hypot(dx, dy);
      dx /= len; dy /= len;
      let step = me.stats.speed * dt;
      if (this.path && this.path.length) step = Math.min(step, Math.hypot(this.path[0].x - me.x, this.path[0].y - me.y));
      const r = moveWithCollision(this.zone.map, me.x, me.y, dx * step, dy * step, PLAYER_RADIUS);
      if (Math.hypot(r.x - me.x, r.y - me.y) > 0.0005) {
        moving = true;
        me.x = r.x; me.y = r.y;
      } else if (this.path) {
        this.path = null; // preso
      }
      if (Math.abs(dx) > Math.abs(dy)) me.dir = dx < 0 ? 1 : 2; else me.dir = dy < 0 ? 3 : 0;
    } else if (this.action && this.action.type === 'attack') {
      const t = this.entities.get(this.action.id);
      if (t) {
        const ddx = t.rx - me.x, ddy = t.ry - me.y;
        if (Math.abs(ddx) > Math.abs(ddy)) me.dir = ddx < 0 ? 1 : 2; else me.dir = ddy < 0 ? 3 : 0;
      }
    }
    this.localMoving = moving;
    const s = this.sent;
    if (now - this.lastSend > 66 && (Math.abs(me.x - s.x) > 0.01 || Math.abs(me.y - s.y) > 0.01 || s.d !== me.dir)) {
      this.lastSend = now;
      this.net.send({ t: 'mv', x: Math.round(me.x * 1000) / 1000, y: Math.round(me.y * 1000) / 1000, d: me.dir, s: me.posSeq });
      this.sent = { x: me.x, y: me.y, d: me.dir };
    }
  }

  myFlags() {
    const e = this.myEntity();
    return e ? e.f : 0;
  }

  interpolate(dt, now) {
    const rt = this.serverNow() - INTERP_DELAY;
    for (const e of this.entities.values()) {
      let nx, ny;
      if (e.id === this.me.id) {
        nx = this.me.x; ny = this.me.y;
        e.dir = this.me.dir;
      } else {
        const b = e.buf;
        if (!b.length) continue;
        if (rt <= b[0].t) { nx = b[0].x; ny = b[0].y; }
        else if (rt >= b[b.length - 1].t) { nx = b[b.length - 1].x; ny = b[b.length - 1].y; }
        else {
          let i = 0;
          while (i < b.length - 2 && b[i + 1].t < rt) i++;
          const a = b[i], c = b[i + 1];
          const k = (rt - a.t) / Math.max(1, c.t - a.t);
          nx = a.x + (c.x - a.x) * k; ny = a.y + (c.y - a.y) * k;
        }
      }
      const moved = Math.hypot(nx - e.rx, ny - e.ry);
      e.moving = moved > 0.3 * dt;
      if (e.moving) e.phase += moved * 4.2;
      e.rx = nx; e.ry = ny;
    }
  }

  // nomes de itens no chão (para rótulos)
  itemLabel(e) { return itemName({ id: e.i, r: e.r }); }

  canStandAt(x, y) { return canStand(this.zone.map, x, y, PLAYER_RADIUS); }
}
