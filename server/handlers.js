// Tratamento das mensagens de jogo enviadas pelo cliente.
import { ITEMS, isEquipment } from '../shared/data/items.js';
import { NPCS } from '../shared/data/npcs.js';
import { RECIPES } from '../shared/data/recipes.js';
import { ZONES, portalAt, hubOf, kingdomOf } from '../shared/data/zones.js';
import { QUESTS } from '../shared/data/quests.js';
import { MAX_STACK, NPC_RANGE, PICKUP_RANGE, PLAYER_RADIUS, EQUIP_SLOTS } from '../shared/constants.js';
import { canStand, lineClear } from '../shared/collision.js';
import { canEquip, enhanceChance, enhanceCost, enhanceFailDowngrade, MAX_PLUS } from '../shared/formulas.js';
import { createItem, itemName, sellPrice, rollRarity } from '../shared/itemgen.js';
import { rand } from '../shared/rng.js';
import { useSkill } from './systems/skills.js';
import { addStatus, hasStatus } from './systems/effects.js';
import { heal, isHostile, revivePlayer } from './systems/combat.js';
import { addItem, removeItem, countItem, validSlot, canAddAll } from './systems/inventory.js';
import { discoverAltars, travelToAltar } from './systems/altars.js';
import { acceptQuest, turnInQuest, abandonQuest, onTalk } from './systems/quests.js';

const WEAPON_PREFIX = { warrior: 'w', berserker: 'b', mage: 'm', ranger: 'r', cleric: 'c' };

function nearNpcWith(p, npcId, service) {
  const n = NPCS[npcId];
  if (!n || !p.zone || n.zone !== p.zone.id) return null;
  if (service && !n.services.includes(service)) return null;
  if (Math.hypot(p.x - n.x, p.y - n.y) > NPC_RANGE + 1) return null;
  return n;
}

function num(v, def = 0) {
  return Number.isFinite(v) ? v : def;
}

// Mensagens que alteram o inventário cancelam um comércio em andamento.
const INV_MUTATING = new Set(['use', 'eq', 'uneq', 'mvi', 'drop', 'split', 'sell', 'craft', 'enh', 'stash', 'buy']);

export function handleGameMessage(world, p, msg) {
  const h = HANDLERS[msg.t];
  if (!h) return;
  if (p.trade && INV_MUTATING.has(msg.t) && !(msg.t === 'stash' && msg.op === 'open')) {
    world.cancelTrade(p, 'O comércio foi cancelado porque seu inventário mudou.');
  }
  h(world, p, msg);
}

const HANDLERS = {
  ping(world, p, msg) {
    p.send({ t: 'pong', c: msg.c, ts: Date.now() });
  },

  // ---------------------------------------------------------------- movimento
  mv(world, p, msg) {
    const zone = p.zone;
    if (!zone || msg.s !== p.posSeq) return;
    const x = num(msg.x, p.x), y = num(msg.y, p.y);
    const now = Date.now();
    const correct = () => {
      p.posSeq++;
      p.send({ t: 'pos', x: p.x, y: p.y, s: p.posSeq });
    };
    if (p.dead || hasStatus(p, 'stun') || hasStatus(p, 'root')) {
      if (Math.hypot(x - p.x, y - p.y) > 0.05) correct();
      return;
    }
    const elapsed = Math.min(1, Math.max(0.05, (now - p.lastMoveAt) / 1000));
    const maxDist = p.stats.speed * elapsed * 1.4 + 0.4;
    const d = Math.hypot(x - p.x, y - p.y);
    if (d > maxDist || !canStand(zone.map, x, y, PLAYER_RADIUS - 0.02) || (d > 0.5 && !lineClear(zone.map, p.x, p.y, x, y, 0.2))) {
      correct();
      return;
    }
    if (d > 0.01 && p.casting && p.casting.interruptible) {
      p.casting = null;
      p.send({ t: 'castEnd', ok: false });
      p.err('Movimento interrompeu a concentração.');
    }
    p.x = x; p.y = y;
    if (Number.isInteger(msg.d) && msg.d >= 0 && msg.d <= 3) p.dir = msg.d;
    p.lastMoveAt = now;
    discoverAltars(p, now);
    if (now > p.portalLock) {
      const portal = portalAt(zone.def, x, y);
      if (portal) world.transfer(p, portal.to, portal.tx, portal.ty);
    }
  },

  atk(world, p, msg) {
    if (msg.id == null) { p.attackTarget = null; return; }
    const t = p.zone && p.zone.entities.get(msg.id);
    if (t && t.alive && isHostile(p.zone, p, t)) p.attackTarget = t.id;
  },

  sk(world, p, msg) {
    useSkill(world, p, msg);
  },

  resp(world, p) {
    if (!p.dead) return;
    const zone = p.zone;
    if (zone.def.pvp) {
      const pt = rand.pick(zone.def.pvpRespawn);
      p.dead = false;
      p.hp = p.stats.maxHp;
      p.mp = p.stats.maxMp;
      p.x = pt.x; p.y = pt.y;
      p.posSeq++;
      p.send({ t: 'pos', x: p.x, y: p.y, s: p.posSeq });
      p.send({ t: 'alive' });
      p.dirty.me = true;
      return;
    }
    p.dead = false;
    p.hp = Math.round(p.stats.maxHp * 0.5);
    p.mp = Math.round(p.stats.maxMp * 0.5);
    p.dirty.me = true;
    p.send({ t: 'alive' });
    const hub = hubOf(zone.id); // renasce na capital do reino onde morreu
    world.transfer(p, hub.zone, hub.x, hub.y);
  },

  // ---------------------------------------------------------------- NPCs e missões
  talk(world, p, msg) {
    const n = nearNpcWith(p, msg.n);
    if (!n) return;
    onTalk(p, n.id);
  },
  qa(world, p, msg) { if (QUESTS[msg.q]) acceptQuest(p, msg.q); },
  qc(world, p, msg) { if (QUESTS[msg.q]) turnInQuest(world, p, msg.q); },
  qx(world, p, msg) { if (QUESTS[msg.q]) abandonQuest(p, msg.q); },

  // ---------------------------------------------------------------- itens
  use(world, p, msg) {
    const inv = p.char.inv;
    if (!validSlot(inv, msg.slot) || !inv[msg.slot]) return;
    const it = inv[msg.slot];
    const base = ITEMS[it.id];
    if (isEquipment(base)) { HANDLERS.eq(world, p, msg); return; }
    if (base.type !== 'consumable' || !base.use) return;
    if (p.dead) return;
    const now = Date.now();
    const u = base.use;
    if (base.lvl > p.level) return p.err(`Requer nível ${base.lvl}.`);
    if (u.hp) {
      if (now < p.potCd.hp) return p.err('Poções de vida em recarga.');
      if (p.hp >= p.stats.maxHp) return p.err('Sua vida já está cheia.');
      p.potCd.hp = now + 8000;
      heal(p.zone, p, p, u.hp);
      p.send({ t: 'pcd', k: 'hp', d: 8000 });
    } else if (u.mp) {
      if (now < p.potCd.mp) return p.err('Poções de mana em recarga.');
      if (p.mp >= p.stats.maxMp) return p.err('Sua mana já está cheia.');
      p.potCd.mp = now + 8000;
      p.mp = Math.min(p.stats.maxMp, p.mp + u.mp);
      p.zone.fx({ k: 'mp', id: p.id, v: u.mp }, p.x, p.y);
      p.send({ t: 'pcd', k: 'mp', d: 8000 });
    } else if (u.recall) {
      const hub = hubOf(p.zone.id);
      if (p.zone.id === hub.zone) return p.err('Você já está na capital do reino.');
      if (p.casting) return;
      p.casting = {
        until: now + 3000, interruptible: true, name: base.name,
        done: () => {
          if (!removeItem(p.char.inv, it.id, 1)) return;
          p.dirty.inv = true;
          world.transfer(p, hub.zone, hub.x, hub.y);
        },
      };
      p.send({ t: 'cast', d: 3000, n: base.name });
      return; // item consumido ao concluir
    } else if (u.buff) {
      const b = u.buff;
      const mods = {};
      for (const k of ['power', 'def', 'xp', 'speed']) if (b[k]) mods[k] = b[k];
      addStatus(p, { id: b.id, type: 'buff', mods, dur: b.dur, name: base.name, persist: true });
      p.zone.fx({ k: 'bf', id: p.id, s: 'elixir' }, p.x, p.y);
    }
    if (it.q > 1) it.q--; else inv[msg.slot] = null;
    p.dirty.inv = true;
    p.dirty.me = true;
  },

  eq(world, p, msg) {
    const inv = p.char.inv;
    if (!validSlot(inv, msg.slot) || !inv[msg.slot]) return;
    const it = inv[msg.slot];
    const base = ITEMS[it.id];
    if (!isEquipment(base)) return;
    const why = canEquip(p.char, it);
    if (why) return p.err(why);
    const prev = p.char.equip[base.slot] || null;
    p.char.equip[base.slot] = it;
    inv[msg.slot] = prev;
    p.recalc();
    p.ver++;
    p.dirty.inv = p.dirty.equip = p.dirty.me = true;
  },

  uneq(world, p, msg) {
    if (!EQUIP_SLOTS.includes(msg.s)) return;
    const it = p.char.equip[msg.s];
    if (!it) return;
    const idx = p.char.inv.indexOf(null);
    if (idx < 0) return p.err('Inventário cheio.');
    p.char.inv[idx] = it;
    delete p.char.equip[msg.s];
    p.recalc();
    p.ver++;
    p.dirty.inv = p.dirty.equip = p.dirty.me = true;
  },

  mvi(world, p, msg) {
    const inv = p.char.inv;
    if (!validSlot(inv, msg.a) || !validSlot(inv, msg.b) || msg.a === msg.b) return;
    const A = inv[msg.a], B = inv[msg.b];
    if (A && B && A.id === B.id && ITEMS[A.id].stack) {
      const move = Math.min(A.q, MAX_STACK - B.q);
      B.q += move; A.q -= move;
      if (A.q <= 0) inv[msg.a] = null;
    } else {
      inv[msg.a] = B; inv[msg.b] = A;
    }
    p.dirty.inv = true;
  },

  drop(world, p, msg) {
    const inv = p.char.inv;
    if (!validSlot(inv, msg.slot) || !inv[msg.slot]) return;
    if (p.trade) return p.err('Termine o comércio antes.');
    const it = inv[msg.slot];
    inv[msg.slot] = null;
    p.dirty.inv = p.dirty.quests = true;
    p.msg(`Você descartou: ${itemName(it)}`, 'warn');
  },

  split(world, p, msg) {
    const inv = p.char.inv;
    if (!validSlot(inv, msg.slot) || !inv[msg.slot]) return;
    const it = inv[msg.slot];
    const n = Math.floor(num(msg.n));
    if (!ITEMS[it.id].stack || n < 1 || n >= it.q) return;
    const idx = inv.indexOf(null);
    if (idx < 0) return p.err('Inventário cheio.');
    it.q -= n;
    inv[idx] = createItem(it.id, { qty: n });
    p.dirty.inv = true;
  },

  pick(world, p, msg) {
    const zone = p.zone;
    const gi = zone && zone.entities.get(msg.id);
    if (!gi || gi.kind !== 'i' || p.dead) return;
    if (Math.hypot(gi.x - p.x, gi.y - p.y) > PICKUP_RANGE + 0.5) return p.err('Muito longe.');
    if (Date.now() < gi.freeAt && !gi.owners.includes(p.id)) return p.err('Este saque pertence a outro jogador.');
    if (!addItem(p.char.inv, gi.item)) return p.err('Inventário cheio.');
    zone.removeEntity(gi);
    p.dirty.inv = p.dirty.quests = true;
    p.send({ t: 'loot', i: gi.item.id, q: gi.item.q || 1, r: gi.item.r || 0, n: itemName(gi.item) });
    if ((gi.item.r || 0) >= 3) {
      world.broadcastSystem(`${p.name} encontrou ${itemName(gi.item)}!`, (gi.item.r >= 4) ? 'epic' : 'good');
    }
  },

  stat(world, p, msg) {
    const s = msg.s;
    if (!['str', 'dex', 'int', 'vit'].includes(s)) return;
    const n = Math.min(p.char.points, Math.max(1, Math.floor(num(msg.n, 1))));
    if (n <= 0 || p.char.points <= 0) return;
    p.char.alloc[s] += n;
    p.char.points -= n;
    p.recalc();
    p.dirty.me = true;
  },

  // ---------------------------------------------------------------- serviços
  buy(world, p, msg) {
    const n = nearNpcWith(p, msg.n, 'shop');
    if (!n || !n.shop.includes(msg.i)) return;
    const base = ITEMS[msg.i];
    const q = base.stack ? Math.max(1, Math.min(MAX_STACK, Math.floor(num(msg.q, 1)))) : 1;
    const cost = base.price * q;
    if (p.char.gold < cost) return p.err('Ouro insuficiente.');
    const item = createItem(base.id, { qty: q });
    if (!addItem(p.char.inv, item)) return p.err('Inventário cheio.');
    p.char.gold -= cost;
    p.dirty.inv = p.dirty.me = p.dirty.quests = true;
    p.send({ t: 'sfx', s: 'coin' });
  },

  sell(world, p, msg) {
    const n = nearNpcWith(p, msg.n, 'shop');
    if (!n) return;
    const inv = p.char.inv;
    if (!validSlot(inv, msg.slot) || !inv[msg.slot]) return;
    const it = inv[msg.slot];
    const price = sellPrice(it);
    if (!price) return p.err('Este item não pode ser vendido.');
    const total = price * (it.q || 1);
    inv[msg.slot] = null;
    p.char.gold += total;
    p.dirty.inv = p.dirty.me = p.dirty.quests = true;
    p.msg(`Vendido: ${itemName(it)}${it.q > 1 ? ' x' + it.q : ''} por ${total} de ouro.`);
    p.send({ t: 'sfx', s: 'coin' });
  },

  craft(world, p, msg) {
    const r = RECIPES[msg.r];
    if (!r) return;
    const n = nearNpcWith(p, msg.n, 'craft');
    if (!n || n.craft !== r.station) return;
    if (p.level < r.lvl) return p.err(`Requer nível ${r.lvl}.`);
    for (const [id, q] of r.mats) if (countItem(p.char.inv, id) < q) return p.err('Materiais insuficientes.');
    if (p.char.gold < r.gold) return p.err('Ouro insuficiente.');
    let result;
    if (r.result.id) {
      result = createItem(r.result.id, { qty: r.result.qty });
    } else {
      let baseId;
      const tier = r.result.tier;
      if (r.result.gear === 'armor') baseId = `${rand.pick(['head', 'chest', 'legs', 'feet'])}_${tier}`;
      else if (r.result.gear === 'weapon') baseId = `${WEAPON_PREFIX[p.cls]}_weapon_${tier}`;
      else baseId = `${rand.pick(['ring', 'amulet'])}_${tier}`;
      result = createItem(baseId, { rarity: Math.max(r.result.minRarity || 0, rollRarity(rand, 1)) });
    }
    // simula consumo para checar espaço
    const sim = p.char.inv.map((it) => (it ? { ...it } : null));
    for (const [id, q] of r.mats) removeItem(sim, id, q);
    if (!canAddAll(sim, [result])) return p.err('Inventário cheio.');
    for (const [id, q] of r.mats) removeItem(p.char.inv, id, q);
    p.char.gold -= r.gold;
    addItem(p.char.inv, result);
    p.dirty.inv = p.dirty.me = p.dirty.quests = true;
    p.send({ t: 'crafted', i: result.id, r: result.r || 0, n: itemName(result), q: result.q || 1 });
  },

  enh(world, p, msg) {
    const n = nearNpcWith(p, msg.n, 'enhance');
    if (!n) return;
    let item;
    if (msg.src === 'eq') item = EQUIP_SLOTS.includes(msg.slot) ? p.char.equip[msg.slot] : null;
    else item = validSlot(p.char.inv, msg.slot) ? p.char.inv[msg.slot] : null;
    if (!item || !isEquipment(ITEMS[item.id])) return p.err('Escolha um equipamento.');
    const plus = item.p || 0;
    if (plus >= MAX_PLUS) return p.err('Este item já está no aprimoramento máximo.');
    const cost = enhanceCost(item);
    if (p.char.gold < cost.gold) return p.err('Ouro insuficiente.');
    if (countItem(p.char.inv, 'enh_stone') < cost.stones) return p.err(`Você precisa de ${cost.stones} Pedra(s) de Aprimoramento.`);
    p.char.gold -= cost.gold;
    removeItem(p.char.inv, 'enh_stone', cost.stones);
    const ok = Math.random() < enhanceChance(plus);
    if (ok) {
      item.p = plus + 1;
      p.send({ t: 'enhres', ok: true, p: item.p, n: itemName(item) });
      if (item.p >= 8) world.broadcastSystem(`${p.name} aprimorou ${itemName(item)}!`, 'good');
    } else {
      const down = enhanceFailDowngrade(plus);
      if (down) item.p = plus - 1;
      p.send({ t: 'enhres', ok: false, p: item.p || 0, down, n: itemName(item) });
    }
    if (msg.src === 'eq') { p.recalc(); p.ver++; p.dirty.equip = true; }
    p.dirty.inv = p.dirty.me = true;
  },

  stash(world, p, msg) {
    const n = nearNpcWith(p, msg.n, 'stash');
    if (!n) return;
    const ch = p.char;
    if (msg.op === 'open') { p.dirty.stash = true; return; }
    if (msg.op === 'put') {
      if (!validSlot(ch.inv, msg.slot) || !ch.inv[msg.slot]) return;
      const it = ch.inv[msg.slot];
      if (!addItem(ch.stash, it)) return p.err('Baú cheio.');
      ch.inv[msg.slot] = null;
    } else if (msg.op === 'take') {
      if (!validSlot(ch.stash, msg.slot) || !ch.stash[msg.slot]) return;
      const it = ch.stash[msg.slot];
      if (!addItem(ch.inv, it)) return p.err('Inventário cheio.');
      ch.stash[msg.slot] = null;
    }
    p.dirty.inv = p.dirty.stash = p.dirty.quests = true;
  },

  tp(world, p, msg) {
    const n = nearNpcWith(p, msg.n, 'teleport');
    if (!n) return;
    const z = ZONES[msg.z];
    if (!z || !p.char.visited.includes(z.id)) return p.err('Você ainda não descobriu este lugar.');
    if (z.id === p.zone.id) return;
    if (kingdomOf(z.id) !== p.zone.def.kingdom) return p.err('As Pedras do Caminho só levam a lugares do mesmo reino. Atravesse a fronteira a pé.');
    if (p.inCombat()) return p.err('Não é possível viajar em combate.');
    // chega ao lado do mago do portal da zona (na capital, Ilyas, na Praça da Chama)
    const ws = Object.values(NPCS).find((x) => x.zone === z.id && x.services.includes('teleport'));
    const dest = ws ? { x: ws.x, y: ws.y + 1.5 } : z.spawn;
    world.transfer(p, z.id, dest.x, dest.y);
  },

  atp(world, p, msg) { travelToAltar(world, p, msg.id); },

  rank(world, p) {
    p.send({ t: 'rank', d: world.ranking() });
  },

  chat(world, p, msg) { world.social.chat(p, msg); },
  party(world, p, msg) { world.social.party(p, msg); },
  guild(world, p, msg) { world.social.guild(p, msg); },
  trade(world, p, msg) { world.social.trade(p, msg); },
};

export { revivePlayer };
