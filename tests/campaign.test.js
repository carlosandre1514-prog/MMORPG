// Percorre a campanha principal inteira usando o mundo real do servidor (sem rede).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Database } from '../server/db.js';
import { World } from '../server/world.js';
import { QUESTS, questTargets } from '../shared/data/quests.js';
import { NPCS } from '../shared/data/npcs.js';
import { createItem } from '../shared/itemgen.js';
import { addItem } from '../server/systems/inventory.js';
import { acceptQuest, turnInQuest, onKill, onTalk } from '../server/systems/quests.js';

test('a campanha "A Chama Partida" e a saga de Sahaar podem ser concluídas do início ao fim', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aethra-camp-'));
  const world = new World(new Database(dir), {});
  const sent = [];
  const session = { send: (m) => sent.push(m) };
  const ch = world.newCharacter('Heroi', 'warrior', 0, 0);
  const p = world.enterWorld(session, ch);
  const goTo = (npcId) => {
    const n = NPCS[npcId];
    if (p.zone.id !== n.zone) world.transfer(p, n.zone, n.x, n.y + 1);
    p.x = n.x; p.y = n.y + 1;
  };
  const run = (chain) => {
  for (const q of chain) {
    while (ch.level < q.lvl) world.giveXp(p, 1e6);
    goTo(q.giver);
    acceptQuest(p, q.id);
    assert.ok(ch.quests.active[q.id], `aceitar ${q.id}: ${JSON.stringify(sent.filter((m) => m.k === 'err').slice(-1))}`);
    q.objectives.forEach((o) => {
      if (o.type === 'kill') for (let i = 0; i < o.count; i++) onKill(p, questTargets(o)[0]);
      if (o.type === 'collect') addItem(ch.inv, createItem(o.item, { qty: o.count }));
      if (o.type === 'talk') { goTo(o.npc); onTalk(p, o.npc); }
    });
    goTo(q.turnIn);
    turnInQuest(world, p, q.id);
    assert.ok(ch.quests.done[q.id], `entregar ${q.id}: ${JSON.stringify(sent.filter((m) => m.k === 'err').slice(-1))}`);
  }
  };
  run(Object.values(QUESTS).filter((q) => q.main));
  assert.ok(ch.flags.brasa_vida && ch.flags.brasa_terra && ch.flags.brasa_espirito);
  assert.equal(ch.title, 'Portador da Chama');
  assert.ok(ch.inv.some((it) => it && it.id === 'u_flame_amulet'));
  // depois da campanha principal, a saga do Reino de Sahaar (Zahrim, Dunas Ardentes e Tumbas dos Reis-Sol)
  const saga = Object.values(QUESTS).filter((q) => q.saga === 'sahaar');
  assert.equal(saga.length, 8);
  run(saga);
  assert.ok(saga.every((q) => ch.quests.done[q.id]));
  assert.ok(world.zones.has('zahrim') && world.zones.has('tombs'), 'a saga passa pelas zonas de Sahaar');
  world.stop();
  fs.rmSync(dir, { recursive: true, force: true });
});
