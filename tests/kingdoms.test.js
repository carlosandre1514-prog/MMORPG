// Reinos: o servidor só mantém na memória as zonas dos reinos onde há jogadores e o progresso do personagem continua salvo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Database } from '../server/db.js';
import { World } from '../server/world.js';
import { ZONES, ZONE_ORDER, kingdomOf, hubOf } from '../shared/data/zones.js';
import { KINGDOMS, KINGDOM_ORDER } from '../shared/data/kingdoms.js';
import { NPCS } from '../shared/data/npcs.js';

function boot(grace = 50) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aethra-king-'));
  const world = new World(new Database(dir), { quiet: true, kingdomGraceMs: grace });
  const join = (name) => {
    const sent = [];
    const ch = world.newCharacter(name, 'warrior', 0, 0);
    const p = world.enterWorld({ send: (m) => sent.push(m) }, ch);
    return { p, ch, sent };
  };
  return { world, join, done: () => { world.stop(); fs.rmSync(dir, { recursive: true, force: true }); } };
}

test('cada zona pertence a um reino e cada reino tem uma capital', () => {
  for (const k of KINGDOM_ORDER) {
    const K = KINGDOMS[k];
    assert.ok(ZONES[K.hub], `capital de ${k}`);
    assert.equal(kingdomOf(K.hub), k);
    for (const id of K.zones) { assert.ok(ZONES[id], id); assert.equal(ZONES[id].kingdom, k); }
  }
  for (const z of Object.values(ZONES)) assert.ok(KINGDOMS[z.kingdom], `reino de ${z.id}`);
  assert.deepEqual([...ZONE_ORDER].sort(), Object.keys(ZONES).sort());
  assert.equal(hubOf('mines').zone, 'town');
  assert.equal(hubOf('dunes').zone, 'zahrim');
  assert.equal(hubOf('tombs').zone, 'zahrim');
});

test('os reinos se ligam por portais nos dois sentidos e cada portal chega a um lugar válido', () => {
  for (const z of Object.values(ZONES)) for (const p of z.portals) {
    const to = ZONES[p.to];
    assert.ok(to, `${z.id} -> ${p.to}`);
    assert.ok(p.tx > 0 && p.tx < to.w && p.ty > 0 && p.ty < to.h, `chegada em ${p.to}`);
    assert.ok(to.portals.some((q) => q.to === z.id), `${p.to} volta para ${z.id}`);
  }
  // a fronteira entre Alvorada e Sahaar é a Estrada do Sol (Ruínas de Cinza <-> Dunas Ardentes)
  assert.ok(ZONES.ruins.portals.some((p) => p.to === 'dunes'));
  assert.ok(ZONES.dunes.portals.some((p) => p.to === 'ruins'));
});

test('o servidor começa sem zonas e carrega só o que o jogador visita', () => {
  const { world, join, done } = boot();
  assert.equal(world.zones.size, 0);
  const { p } = join('Ana');
  assert.deepEqual([...world.zones.keys()], ['town']);
  world.transfer(p, 'fields', 4.5, 45.5);
  assert.deepEqual([...world.zones.keys()].sort(), ['fields', 'town']);
  assert.ok(world.zone('fields').monsters.length > 30, 'monstros povoados na carga');
  done();
});

test('um reino sem jogadores é descarregado depois da espera; o outro continua', () => {
  const { world, join, done } = boot(100);
  const a = join('Ana');
  const b = join('Beto');
  world.transfer(b.p, 'dunes', 6.5, 70.5);
  assert.deepEqual([...world.loadedKingdoms().keys()].sort(), ['alvorada', 'sahaar']);
  const t0 = Date.now();
  // Beto sai do reino de Sahaar (volta pela estrada) e some do jogo
  world.leaveWorld(b.p);
  world.sweepKingdoms(t0);            // marca o instante em que ficou vazio
  assert.ok(world.zones.has('dunes'), 'ainda dentro do prazo');
  world.sweepKingdoms(t0 + 50);
  assert.ok(world.zones.has('dunes'));
  world.sweepKingdoms(t0 + 150);      // passou do prazo
  assert.ok(!world.zones.has('dunes'), 'Sahaar descarregado');
  assert.ok(world.zones.has('town'), 'Alvorada segue carregada (Ana está lá)');
  // Ana vai para Sahaar: o reino é gerado de novo, igual, com os monstros no lugar
  world.transfer(a.p, 'dunes', 6.5, 70.5);
  assert.ok(world.zones.has('dunes'));
  assert.ok(world.zone('dunes').monsters.some((m) => m.def.id === 'scorpion_queen'));
  // agora Alvorada ficou vazia: também sai da memória
  world.sweepKingdoms(t0 + 200);
  world.sweepKingdoms(t0 + 400);
  assert.ok(!world.zones.has('town') && !world.zones.has('fields'));
  assert.ok(world.zones.has('dunes'));
  done();
});

test('o progresso do personagem fica salvo quando o reino é descarregado e volta com ele', () => {
  const { world, join, done } = boot(10);
  const a = join('Ana');
  a.ch.quests.active.ms3 = { prog: [2, 1] };
  a.ch.quests.done.ms1 = true;
  world.transfer(a.p, 'dunes', 6.5, 70.5);
  assert.ok(a.ch.visited.includes('dunes'));
  const t0 = Date.now();
  world.sweepKingdoms(t0); world.sweepKingdoms(t0 + 50);
  assert.ok(!world.zones.has('town'), 'Alvorada descarregada enquanto Ana está em Sahaar');
  world.transfer(a.p, 'ruins', 52.5, 4.5);
  assert.ok(world.zones.has('ruins'), 'Alvorada carregada de novo ao voltar');
  assert.deepEqual(a.ch.quests.active.ms3, { prog: [2, 1] });
  assert.equal(a.ch.quests.done.ms1, true);
  assert.ok(a.ch.visited.includes('town') && a.ch.visited.includes('dunes'));
  done();
});

test('quem reentra no jogo volta ao reino onde estava; quem morre renasce na capital do reino', () => {
  const { world, join, done } = boot();
  const a = join('Ana');
  world.transfer(a.p, 'tombs', 55.5, 90.5);
  a.p.syncChar();
  assert.equal(a.ch.zone, 'tombs');
  world.leaveWorld(a.p);
  const again = world.enterWorld({ send: () => {} }, a.ch);
  assert.equal(again.zone.id, 'tombs');
  // morto em Sahaar, renasce em Zahrim (e não em Alvorada)
  again.dead = true;
  world.handle(again, { t: 'resp' });
  assert.equal(again.zone.id, 'zahrim');
  done();
});

test('a Pedra do Caminho só leva a lugares do mesmo reino', () => {
  const { world, join, done } = boot();
  const a = join('Ana');
  world.transfer(a.p, 'zahrim', 52.5, 46.5);
  a.ch.visited.push('dunes', 'tombs');
  const way = NPCS.way_zahrim;
  a.p.x = way.x; a.p.y = way.y + 1;
  world.handle(a.p, { t: 'tp', n: 'way_zahrim', z: 'town' });
  assert.equal(a.p.zone.id, 'zahrim', 'Alvorada fica do outro lado da fronteira');
  assert.ok(a.sent.some((m) => m.t === 'err' || m.k === 'err'));
  a.p.x = way.x; a.p.y = way.y + 1;
  world.handle(a.p, { t: 'tp', n: 'way_zahrim', z: 'dunes' });
  assert.equal(a.p.zone.id, 'dunes');
  done();
});
