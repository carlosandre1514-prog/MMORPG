// Altares de viagem: cada portal é um altar, descobre-se chegando perto e viaja-se entre os descobertos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Database } from '../server/db.js';
import { World } from '../server/world.js';
import { ZONES, portalAt } from '../shared/data/zones.js';
import { altarList, altarById, altarsIn, altarNear, travelFee, backfillAltars, ALTAR_RANGE } from '../shared/altars.js';
import { discoverAltars } from '../server/systems/altars.js';
import { canStand } from '../shared/collision.js';

function boot() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aethra-altar-'));
  const world = new World(new Database(dir), { quiet: true });
  const join = (name = 'Viajante') => {
    const sent = [];
    const ch = world.newCharacter(name, 'warrior', 0, 0);
    const p = world.enterWorld({ send: (m) => sent.push(m) }, ch);
    return { p, ch, sent };
  };
  return { world, join, done: () => { world.stop(); fs.rmSync(dir, { recursive: true, force: true }); } };
}
const put = (p, x, y) => { p.x = x; p.y = y; p.altarCheck = 0; };

test('todo portal é um altar e a chegada fica fora da área que transporta', () => {
  const total = Object.values(ZONES).reduce((n, z) => n + z.portals.length, 0);
  assert.equal(altarList().length, total);
  for (const a of altarList()) {
    assert.equal(altarById(a.id), a);
    assert.ok(altarsIn(a.zone).includes(a));
    const z = ZONES[a.zone];
    assert.equal(portalAt(z, a.arrive.x, a.arrive.y), null, `${a.id}: chegada dentro do portal`);
    assert.ok(Math.hypot(a.arrive.x - a.x, a.arrive.y - a.y) < ALTAR_RANGE, `${a.id}: chegada longe do altar`);
  }
  assert.equal(altarNear('fields', 108.5, 22.5).id, 'fields:1');
  assert.equal(altarNear('fields', 60, 60), null);
});

test('chegar perto do altar o descobre; quem já passou por dois lados da passagem ganha o altar de graça', () => {
  const { join, done } = boot();
  const { p, ch, sent } = join();
  const before = ch.altars.length;
  put(p, 100, 46); // a 10 tiles do altar da cidade para os campos
  discoverAltars(p);
  assert.equal(ch.altars.length, before);
  put(p, 106, 46.5);
  discoverAltars(p);
  assert.ok(ch.altars.includes('town:0'));
  assert.ok(sent.some((m) => m.t === 'altar' && m.id === 'town:0'));
  // personagem antigo: conhece os dois lados, então o altar vale
  assert.deepEqual(backfillAltars(['town', 'fields']).sort(), ['fields:0', 'town:0']);
  assert.deepEqual(backfillAltars(['town']), []);
  done();
});

test('viajar: só para altar descoberto, de graça ao lado de um altar, com taxa longe dele, com intervalo e sem sair do reino', () => {
  const { world, join, done } = boot();
  const { p, ch, sent } = join();
  const go = (id) => world.handle(p, { t: 'atp', id });
  const errs = () => sent.filter((m) => m.t === 'msg' && m.k === 'err').map((m) => m.m);
  go('fields:1');
  assert.equal(p.zone.id, 'town');
  assert.ok(errs().some((m) => /descobriu/.test(m)));

  // descobre os altares da cidade e dos campos
  ch.altars.push('fields:1', 'town:0');
  // de dentro da cidade, longe de qualquer altar: paga a taxa
  put(p, 56, 20);
  ch.gold = 5;
  go('fields:1');
  assert.equal(p.zone.id, 'town', 'sem ouro não viaja');
  assert.ok(errs().some((m) => /custa/.test(m)));
  ch.gold = 100;
  go('fields:1');
  assert.equal(p.zone.id, 'fields');
  assert.equal(ch.gold, 100 - travelFee(1));
  assert.ok(Math.hypot(p.x - altarById('fields:1').x, p.y - altarById('fields:1').y) < 6);
  assert.ok(canStand(p.zone.map, p.x, p.y), 'chegou numa posição livre');

  // intervalo entre viagens
  go('town:0');
  assert.equal(p.zone.id, 'fields');
  assert.ok(errs().some((m) => /recompondo/.test(m)));
  p.altarCd = 0;
  // ao lado de um altar a viagem é grátis
  ch.altars.push('fields:0');
  const gold = ch.gold;
  put(p, 107, 22);
  go('fields:0');
  assert.equal(p.zone.id, 'fields');
  assert.equal(ch.gold, gold);
  assert.ok(Math.hypot(p.x - altarById('fields:0').x, p.y - altarById('fields:0').y) < 6);

  // não vale em combate, nem entre reinos
  p.altarCd = 0;
  p.combatUntil = Date.now() + 5000;
  go('town:0');
  assert.equal(p.zone.id, 'fields');
  p.combatUntil = 0;
  const far = altarList().find((a) => a.kingdom !== 'alvorada');
  ch.altars.push(far.id);
  go(far.id);
  assert.notEqual(p.zone.def.kingdom, far.kingdom);
  assert.ok(errs().some((m) => /mesmo reino/.test(m)));
  done();
});

test('o cliente acende os altares descobertos e o mapa lista a viagem rápida', () => {
  const read = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
  const world3d = read('client/js/three/world3d.js'), game = read('client/js/game.js'), win = read('client/js/ui/windows.js'), altar = read('client/js/three/altar3d.js');
  assert.match(world3d, /new Altar\(p, here, border\)/);
  assert.match(world3d, /setAltars\(ids, instant = true\)/);
  assert.match(game, /case 'altar': this\.onAltar\(m\.id\)/);
  assert.match(game, /setAltars\(me\.altars, true\)/);
  assert.match(win, /t: 'atp', id: a\.id/);
  assert.match(altar, /export class Altar/);
  assert.match(read('server/handlers.js'), /atp\(world, p, msg\) \{ travelToAltar/);
});
