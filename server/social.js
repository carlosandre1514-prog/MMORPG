// Chat, grupos, clãs, comércio entre jogadores e comandos.
import { PARTY_MAX, GUILD_COST, CHAT } from '../shared/constants.js';
import { ITEMS } from '../shared/data/items.js';
import { ZONES } from '../shared/data/zones.js';
import { MONSTERS } from '../shared/data/monsters.js';
import { CLASSES } from '../shared/data/classes.js';
import { createItem, itemName } from '../shared/itemgen.js';
import { xpToNext } from '../shared/formulas.js';
import { addItem, freeSlots, validSlot } from './systems/inventory.js';
import { dealDamage } from './systems/combat.js';

let partySeq = 1;
const GUILD_NAME_RE = /^[A-Za-zÀ-ÿ0-9 ]{3,16}$/;

function clean(text, max = 200) {
  return String(text ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max);
}

export class Social {
  constructor(world) {
    this.world = world;
    this.parties = new Map();
  }

  get db() { return this.world.db; }

  find(name) {
    return this.world.byName.get(String(name || '').toLowerCase()) || null;
  }

  onLogin(p) {
    const g = this.guildOf(p);
    if (g) {
      this.guildMsg(g, `${p.name} entrou no jogo.`, p);
      this.sendGuild(p);
    }
  }

  onLogout(p) {
    this.cancelTrade(p, `${p.name} desconectou.`);
    if (p.party) this.leaveParty(p, true);
    const g = this.guildOf(p);
    if (g) this.guildMsg(g, `${p.name} saiu do jogo.`, p);
  }

  onZoneChange(p) {
    this.cancelTrade(p, 'O comércio foi cancelado.');
  }

  tickSecond() {
    for (const party of this.parties.values()) this.sendParty(party, true);
  }

  // ================================================================ chat
  chat(p, msg) {
    let text = clean(msg.m);
    if (!text) return;
    const now = Date.now();
    // anti-spam: rajada de até 4 mensagens, recarrega 1 a cada 1,5s
    p.chatBurst = Math.max(0, p.chatBurst - (now - p.lastChat) / 1500);
    p.lastChat = now;
    if (p.chatBurst >= 4) return p.err('Calma! Você está enviando mensagens rápido demais.');
    p.chatBurst++;
    if (text.startsWith('/')) return this.command(p, text);
    this.say(p, CHAT.ZONE, text);
  }

  say(p, channel, text, target = null) {
    const msg = { t: 'chat', c: channel, f: p.name, m: text, cls: p.cls };
    switch (channel) {
      case CHAT.ZONE:
        for (const q of p.zone.players) q.send(msg);
        p.zone.fx({ k: 'bb', id: p.id, m: text }, p.x, p.y);
        break;
      case CHAT.WORLD:
        for (const q of this.world.players.values()) q.send(msg);
        break;
      case CHAT.PARTY:
        if (!p.party) return p.err('Você não está em um grupo.');
        for (const id of p.party.members) this.world.players.get(id)?.send(msg);
        break;
      case CHAT.GUILD: {
        const g = this.guildOf(p);
        if (!g) return p.err('Você não pertence a um clã.');
        for (const name of g.members) this.find(name)?.send(msg);
        break;
      }
      case CHAT.WHISPER: {
        const q = this.find(target);
        if (!q) return p.err(`${target} não está online.`);
        q.send({ ...msg, to: q.name });
        p.send({ ...msg, to: q.name, out: true });
        q.replyTo = p.name;
        break;
      }
      default: break;
    }
  }

  command(p, text) {
    const [cmdRaw, ...rest] = text.slice(1).split(/\s+/);
    const cmd = cmdRaw.toLowerCase();
    const arg = rest.join(' ');
    switch (cmd) {
      case 'm': case 'mundo': case 'w': if (cmd === 'w' && rest.length > 1 && this.find(rest[0])) return this.say(p, CHAT.WHISPER, rest.slice(1).join(' '), rest[0]); return arg && this.say(p, CHAT.WORLD, arg);
      case 'g': case 'grupo': case 'p': return arg && this.say(p, CHAT.PARTY, arg);
      case 'c': case 'cla': case 'clã':
        if (['criar', 'convidar', 'sair', 'expulsar', 'info', 'aceitar', 'recusar', 'lider'].includes((rest[0] || '').toLowerCase())) {
          return this.guild(p, { op: rest[0].toLowerCase(), name: rest.slice(1).join(' ') });
        }
        return arg && this.say(p, CHAT.GUILD, arg);
      case 's': case 'sussurrar': case 'whisper': case 'pm':
        if (rest.length < 2) return p.err('Uso: /s nome mensagem');
        return this.say(p, CHAT.WHISPER, rest.slice(1).join(' '), rest[0]);
      case 'r': case 'responder':
        if (!p.replyTo) return p.err('Ninguém sussurrou para você ainda.');
        return arg && this.say(p, CHAT.WHISPER, arg, p.replyTo);
      case 'convidar': case 'invite': return this.party(p, { op: 'invite', name: rest[0] });
      case 'sairgrupo': return this.party(p, { op: 'leave' });
      case 'negociar': case 'trade': return this.trade(p, { op: 'req', name: rest[0] });
      case 'quem': case 'who': {
        const list = [...this.world.players.values()].map((q) => `${q.name} (${CLASSES[q.cls].name} ${q.level}, ${q.zone.def.name})`);
        return p.send({ t: 'chat', c: CHAT.SYSTEM, m: `Online (${list.length}): ${list.join(', ')}` });
      }
      case 'ajuda': case 'help': case '?':
        return p.send({
          t: 'chat', c: CHAT.SYSTEM, m: 'Comandos: /m (mundo), /g (grupo), /c (clã), /s nome msg (sussurro), /r (responder), /convidar nome, /sairgrupo, ' +
            '/negociar nome, /quem, /c criar Nome, /c convidar nome, /c sair, /c info, /onde' + (this.world.dev ? ' | DEV: /nivel N, /ouro N, /item id [qtd], /ir zona, /xp N, /curar, /tp x y, /matar, /ids' : ''),
        });
      case 'onde':
        return p.send({ t: 'chat', c: CHAT.SYSTEM, m: `${p.zone.def.name} (${p.x.toFixed(1)}, ${p.y.toFixed(1)})` });
      default:
        if (this.world.dev && this.devCommand(p, cmd, rest)) return;
        return p.err('Comando desconhecido. Digite /ajuda.');
    }
  }

  devCommand(p, cmd, args) {
    const w = this.world;
    switch (cmd) {
      case 'nivel': {
        const lvl = Math.max(1, Math.min(30, parseInt(args[0], 10) || 1));
        while (p.char.level < lvl) w.giveXp(p, xpToNext(p.char.level) - p.char.xp + 1);
        return true;
      }
      case 'xp': w.giveXp(p, parseInt(args[0], 10) || 100); return true;
      case 'ouro': w.giveGold(p, parseInt(args[0], 10) || 1000); return true;
      case 'item': {
        const id = args[0];
        if (!ITEMS[id]) { p.err('Item inexistente. Veja /ids'); return true; }
        const it = createItem(id, { qty: parseInt(args[1], 10) || 1, rarity: parseInt(args[2], 10) || 0 });
        if (addItem(p.char.inv, it)) p.dirty.inv = p.dirty.quests = true; else p.err('Inventário cheio.');
        return true;
      }
      case 'ids':
        p.send({ t: 'chat', c: CHAT.SYSTEM, m: 'Itens: ' + Object.keys(ITEMS).join(', ') });
        p.send({ t: 'chat', c: CHAT.SYSTEM, m: 'Zonas: ' + Object.keys(ZONES).join(', ') + ' | Monstros: ' + Object.keys(MONSTERS).join(', ') });
        return true;
      case 'ir': {
        const z = ZONES[args[0]];
        if (!z) { p.err('Zona inexistente: ' + Object.keys(ZONES).join(', ')); return true; }
        w.transfer(p, z.id, z.spawn.x, z.spawn.y);
        return true;
      }
      case 'tp': {
        const x = parseFloat(args[0]), y = parseFloat(args[1]);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return true;
        const pt = p.zone.safePoint(x, y);
        p.x = pt.x; p.y = pt.y; p.posSeq++;
        p.send({ t: 'pos', x: p.x, y: p.y, s: p.posSeq });
        return true;
      }
      case 'curar':
        p.hp = p.stats.maxHp; p.mp = p.stats.maxMp; p.dirty.me = true; p.cd = {};
        return true;
      case 'matar': {
        const t = p.zone.entities.get(p.attackTarget);
        if (t && t.isMonster) dealDamage(p.zone, p, t, t.hp + 1, {});
        return true;
      }
      default: return false;
    }
  }

  // ================================================================ grupos
  party(p, msg) {
    switch (msg.op) {
      case 'invite': {
        const q = this.find(msg.name);
        if (!q || q === p) return p.err('Jogador não encontrado.');
        if (q.party) return p.err(`${q.name} já está em um grupo.`);
        if (p.party && p.party.leader !== p.id) return p.err('Apenas o líder pode convidar.');
        if (p.party && p.party.members.length >= PARTY_MAX) return p.err('O grupo está cheio.');
        q.invites.party = { from: p.id, at: Date.now() };
        q.send({ t: 'invite', k: 'party', f: p.name });
        p.msg(`Convite de grupo enviado para ${q.name}.`);
        break;
      }
      case 'accept': {
        const inv = p.invites.party;
        delete p.invites.party;
        if (!inv || Date.now() - inv.at > 60000) return p.err('O convite expirou.');
        const from = this.world.players.get(inv.from);
        if (!from) return p.err('O jogador não está mais online.');
        if (p.party) return p.err('Você já está em um grupo.');
        let party = from.party;
        if (!party) {
          party = { id: partySeq++, leader: from.id, members: [from.id] };
          this.parties.set(party.id, party);
          from.party = party;
          from.ver++;
        }
        if (party.members.length >= PARTY_MAX) return p.err('O grupo está cheio.');
        party.members.push(p.id);
        p.party = party;
        p.ver++;
        this.partyMsg(party, `${p.name} entrou no grupo.`);
        this.sendParty(party);
        break;
      }
      case 'decline': {
        const inv = p.invites.party;
        delete p.invites.party;
        const from = inv && this.world.players.get(inv.from);
        if (from) from.msg(`${p.name} recusou o convite de grupo.`, 'warn');
        break;
      }
      case 'leave': if (p.party) this.leaveParty(p); break;
      case 'kick': {
        const party = p.party;
        if (!party || party.leader !== p.id) return;
        const q = this.find(msg.name);
        if (q && q.party === party && q !== p) { q.msg('Você foi removido do grupo.', 'warn'); this.leaveParty(q); }
        break;
      }
      case 'lead': {
        const party = p.party;
        if (!party || party.leader !== p.id) return;
        const q = this.find(msg.name);
        if (q && q.party === party) { party.leader = q.id; this.partyMsg(party, `${q.name} agora é o líder do grupo.`); this.sendParty(party); }
        break;
      }
      default: break;
    }
  }

  leaveParty(p, silent = false) {
    const party = p.party;
    if (!party) return;
    party.members = party.members.filter((id) => id !== p.id);
    p.party = null;
    p.ver++;
    p.send({ t: 'party', none: true });
    if (!silent) p.msg('Você saiu do grupo.');
    if (party.members.length <= 1) {
      for (const id of party.members) {
        const q = this.world.players.get(id);
        if (q) { q.party = null; q.ver++; q.send({ t: 'party', none: true }); q.msg('O grupo foi desfeito.'); }
      }
      this.parties.delete(party.id);
      return;
    }
    if (party.leader === p.id) party.leader = party.members[0];
    this.partyMsg(party, `${p.name} saiu do grupo.`);
    this.sendParty(party);
  }

  partyMsg(party, text) {
    for (const id of party.members) this.world.players.get(id)?.send({ t: 'chat', c: CHAT.PARTY, m: text });
  }

  sendParty(party) {
    const members = party.members.map((id) => this.world.players.get(id)).filter(Boolean).map((q) => ({
      id: q.id, n: q.name, c: q.cls, l: q.level, hp: Math.round(q.hp), mhp: q.stats.maxHp, mp: Math.round(q.mp), mmp: q.stats.maxMp,
      z: q.zone ? q.zone.id : null, x: Math.round(q.x), y: Math.round(q.y), d: q.dead ? 1 : 0,
    }));
    for (const id of party.members) this.world.players.get(id)?.send({ t: 'party', leader: party.leader, m: members });
  }

  // ================================================================ clãs
  guildOf(p) {
    return p.char.guild ? this.db.guilds[p.char.guild.toLowerCase()] || null : null;
  }

  guildMsg(g, text, except = null) {
    for (const name of g.members) {
      const q = this.find(name);
      if (q && q !== except) q.send({ t: 'chat', c: CHAT.GUILD, m: text });
    }
  }

  sendGuild(p) {
    const g = this.guildOf(p);
    if (!g) return p.send({ t: 'guild', none: true });
    const members = g.members.map((name) => {
      const ch = this.db.charByName(name);
      const on = this.find(name);
      return { n: name, l: ch ? ch.level : 0, c: ch ? ch.cls : 'warrior', on: !!on, z: on ? on.zone.def.name : null };
    });
    p.send({ t: 'guild', name: g.name, leader: g.leader, m: members });
  }

  refreshGuild(g) {
    for (const name of g.members) { const q = this.find(name); if (q) { this.sendGuild(q); q.ver++; } }
  }

  guild(p, msg) {
    const ch = p.char;
    switch (msg.op) {
      case 'info': return this.sendGuild(p);
      case 'criar': case 'create': {
        const name = clean(msg.name, 16);
        if (ch.guild) return p.err('Você já pertence a um clã.');
        if (!GUILD_NAME_RE.test(name)) return p.err('Nome de clã inválido (3 a 16 letras ou números).');
        if (this.db.guilds[name.toLowerCase()]) return p.err('Já existe um clã com esse nome.');
        if (ch.gold < GUILD_COST) return p.err(`Fundar um clã custa ${GUILD_COST} de ouro.`);
        ch.gold -= GUILD_COST;
        this.db.guilds[name.toLowerCase()] = { name, leader: p.name, members: [p.name], created: Date.now() };
        ch.guild = name;
        p.ver++;
        p.dirty.me = true;
        this.db.markDirty();
        this.world.broadcastSystem(`${p.name} fundou o clã <${name}>!`, 'good');
        return this.sendGuild(p);
      }
      case 'convidar': case 'invite': {
        const g = this.guildOf(p);
        if (!g) return p.err('Você não pertence a um clã.');
        if (g.leader !== p.name) return p.err('Apenas o líder pode convidar.');
        const q = this.find(msg.name);
        if (!q) return p.err('Jogador não encontrado.');
        if (q.char.guild) return p.err(`${q.name} já pertence a um clã.`);
        if (g.members.length >= 50) return p.err('O clã está cheio.');
        q.invites.guild = { name: g.name, from: p.name, at: Date.now() };
        q.send({ t: 'invite', k: 'guild', f: p.name, g: g.name });
        return p.msg(`Convite de clã enviado para ${q.name}.`);
      }
      case 'aceitar': case 'accept': {
        const inv = p.invites.guild;
        delete p.invites.guild;
        if (!inv || Date.now() - inv.at > 120000) return p.err('O convite expirou.');
        const g = this.db.guilds[inv.name.toLowerCase()];
        if (!g || ch.guild) return;
        g.members.push(p.name);
        ch.guild = g.name;
        this.db.markDirty();
        this.guildMsg(g, `${p.name} entrou no clã!`);
        return this.refreshGuild(g);
      }
      case 'recusar': case 'decline': delete p.invites.guild; return;
      case 'sair': case 'leave': {
        const g = this.guildOf(p);
        if (!g) return;
        g.members = g.members.filter((n) => n !== p.name);
        ch.guild = null;
        p.ver++;
        p.send({ t: 'guild', none: true });
        if (!g.members.length) {
          delete this.db.guilds[g.name.toLowerCase()];
          p.msg(`O clã <${g.name}> foi dissolvido.`);
        } else {
          if (g.leader === p.name) g.leader = g.members[0];
          this.guildMsg(g, `${p.name} saiu do clã. Líder: ${g.leader}.`);
          this.refreshGuild(g);
        }
        this.db.markDirty();
        return;
      }
      case 'expulsar': case 'kick': {
        const g = this.guildOf(p);
        if (!g || g.leader !== p.name) return p.err('Apenas o líder pode expulsar.');
        const target = g.members.find((n) => n.toLowerCase() === String(msg.name || '').toLowerCase());
        if (!target || target === p.name) return;
        g.members = g.members.filter((n) => n !== target);
        const tch = this.db.charByName(target);
        if (tch) tch.guild = null;
        const q = this.find(target);
        if (q) { q.ver++; q.send({ t: 'guild', none: true }); q.msg(`Você foi expulso do clã <${g.name}>.`, 'warn'); }
        this.guildMsg(g, `${target} foi expulso do clã.`);
        this.refreshGuild(g);
        this.db.markDirty();
        return;
      }
      case 'lider': {
        const g = this.guildOf(p);
        if (!g || g.leader !== p.name) return;
        const target = g.members.find((n) => n.toLowerCase() === String(msg.name || '').toLowerCase());
        if (!target) return;
        g.leader = target;
        this.guildMsg(g, `${target} agora lidera o clã.`);
        this.refreshGuild(g);
        this.db.markDirty();
        return;
      }
      default: return;
    }
  }

  // ================================================================ comércio
  trade(p, msg) {
    const t = p.trade;
    switch (msg.op) {
      case 'req': {
        const q = this.find(msg.name);
        if (!q || q === p) return p.err('Jogador não encontrado.');
        if (q.zone !== p.zone || Math.hypot(q.x - p.x, q.y - p.y) > 8) return p.err('Aproxime-se do jogador para negociar.');
        if (p.trade || q.trade) return p.err('Um de vocês já está negociando.');
        q.invites.trade = { from: p.id, at: Date.now() };
        q.send({ t: 'invite', k: 'trade', f: p.name });
        return p.msg(`Pedido de comércio enviado para ${q.name}.`);
      }
      case 'accept': {
        const inv = p.invites.trade;
        delete p.invites.trade;
        if (!inv || Date.now() - inv.at > 60000) return p.err('O pedido expirou.');
        const q = this.world.players.get(inv.from);
        if (!q || q.zone !== p.zone || q.trade || p.trade) return p.err('Não foi possível iniciar o comércio.');
        const trade = { a: q, b: p, offer: new Map([[q.id, { slots: [], gold: 0, ok: false }], [p.id, { slots: [], gold: 0, ok: false }]]) };
        q.trade = trade; p.trade = trade;
        return this.sendTrade(trade);
      }
      case 'decline': {
        const inv = p.invites.trade;
        delete p.invites.trade;
        const q = inv && this.world.players.get(inv.from);
        if (q) q.msg(`${p.name} recusou o comércio.`, 'warn');
        return;
      }
      default: break;
    }
    if (!t) return;
    const mine = t.offer.get(p.id);
    const resetOk = () => { for (const o of t.offer.values()) o.ok = false; };
    switch (msg.op) {
      case 'add': {
        const it = validSlot(p.char.inv, msg.slot) ? p.char.inv[msg.slot] : null;
        if (!it) return;
        if (ITEMS[it.id].type === 'quest') return p.err('Itens de missão não podem ser negociados.');
        if (mine.slots.includes(msg.slot) || mine.slots.length >= 8) return;
        mine.slots.push(msg.slot);
        resetOk();
        break;
      }
      case 'remove':
        mine.slots = mine.slots.filter((s) => s !== msg.slot);
        resetOk();
        break;
      case 'gold': {
        const g = Math.max(0, Math.min(p.char.gold, Math.floor(Number(msg.gold) || 0)));
        mine.gold = g;
        resetOk();
        break;
      }
      case 'ok':
        mine.ok = true;
        if ([...t.offer.values()].every((o) => o.ok)) return this.executeTrade(t);
        break;
      case 'cancel':
        return this.cancelTrade(p, `${p.name} cancelou o comércio.`);
      default: return;
    }
    this.sendTrade(t);
  }

  tradeItems(p, offer) {
    return offer.slots.map((s) => p.char.inv[s]).filter(Boolean);
  }

  sendTrade(t) {
    for (const [me, other] of [[t.a, t.b], [t.b, t.a]]) {
      const mo = t.offer.get(me.id), oo = t.offer.get(other.id);
      me.send({
        t: 'trade', with: other.name,
        mine: { slots: mo.slots, gold: mo.gold, ok: mo.ok },
        theirs: { items: this.tradeItems(other, oo), gold: oo.gold, ok: oo.ok },
      });
    }
  }

  executeTrade(t) {
    const { a, b } = t;
    const oa = t.offer.get(a.id), ob = t.offer.get(b.id);
    const ia = this.tradeItems(a, oa), ib = this.tradeItems(b, ob);
    if (ia.length !== oa.slots.length || ib.length !== ob.slots.length || a.char.gold < oa.gold || b.char.gold < ob.gold) {
      return this.cancelTrade(a, 'O comércio falhou: as ofertas mudaram.');
    }
    if (freeSlots(a.char.inv) + ia.length < ib.length || freeSlots(b.char.inv) + ib.length < ia.length) {
      return this.cancelTrade(a, 'O comércio falhou: inventário cheio.');
    }
    for (const s of oa.slots) a.char.inv[s] = null;
    for (const s of ob.slots) b.char.inv[s] = null;
    for (const it of ib) addItem(a.char.inv, it);
    for (const it of ia) addItem(b.char.inv, it);
    a.char.gold += ob.gold - oa.gold;
    b.char.gold += oa.gold - ob.gold;
    a.trade = b.trade = null;
    for (const p of [a, b]) {
      p.dirty.inv = p.dirty.me = p.dirty.quests = true;
      p.send({ t: 'trade', closed: true });
      p.msg('Comércio concluído!', 'good');
    }
    this.db.markDirty();
    console.log(`[trade] ${a.name} <-> ${b.name}: ${ia.map(itemName).join(', ')} | ${ib.map(itemName).join(', ')}`);
  }

  cancelTrade(p, reason) {
    const t = p.trade;
    if (!t) return;
    t.a.trade = t.b.trade = null;
    for (const q of [t.a, t.b]) {
      q.send({ t: 'trade', closed: true });
      if (reason) q.msg(reason, 'warn');
    }
  }
}
