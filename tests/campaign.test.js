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
  // campanha principal (Atos I a VIII) e a saga de Sahaar juntas, na ordem em que as dependências liberam cada missão:
  // o Ato VIII só abre depois da saga, que reúne o quinto selo
  const main = Object.values(QUESTS).filter((q) => q.main);
  const saga = Object.values(QUESTS).filter((q) => q.saga === 'sahaar');
  assert.equal(saga.length, 8);
  const all = [...main, ...saga];
  const order = [];
  const got = new Set();
  while (order.length < all.length) {
    const q = all.find((x) => !got.has(x.id) && (x.prereq || []).every((r) => got.has(r)));
    assert.ok(q, 'alguma missão ficou sem como ser liberada');
    got.add(q.id); order.push(q);
  }
  run(order);
  assert.ok(ch.flags.brasa_vida && ch.flags.brasa_terra && ch.flags.brasa_espirito);
  for (const f of ['selo_brejo', 'selo_afogados', 'selo_geada', 'selo_inverno', 'selo_sol', 'cripta_aberta']) assert.ok(ch.flags[f], `bandeira ${f}`);
  assert.ok(ch.titles.includes('Portador da Chama'));
  assert.equal(ch.title, 'Selador do Faminto');
  assert.ok(ch.inv.some((it) => it && it.id === 'u_flame_amulet'));
  assert.ok(saga.every((q) => ch.quests.done[q.id]));
  assert.ok(world.zones.has('zahrim') && world.zones.has('tombs'), 'a saga passa pelas zonas de Sahaar');
  for (const z of ['swamp', 'catacombs', 'peaks', 'citadel', 'undercroft']) assert.ok(world.zones.has(z), `a campanha passa por ${z}`);
  world.stop();
  fs.rmSync(dir, { recursive: true, force: true });
});
