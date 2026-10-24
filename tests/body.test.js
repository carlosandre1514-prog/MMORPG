// Corpo de adulto: escolhido na criação, guardado no personagem e mostrado aos outros jogadores.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Database } from '../server/db.js';
import { World } from '../server/world.js';

const read = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');

test('o corpo escolhido fica no personagem e vai para todos os jogadores na entidade e na lista de personagens', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aethra-body-'));
  const world = new World(new Database(dir), {});
  const session = { send() {} };
  const padrao = world.newCharacter('Padrao', 'warrior', 1, 0);
  const adulto = world.newCharacter('Adulta', 'assassin', 1, 0, 1);
  assert.equal(padrao.body, 0);
  assert.equal(adulto.body, 1);
  assert.equal(world.enterWorld(session, padrao).full().bd, 0);
  assert.equal(world.enterWorld(session, adulto).full().bd, 1);
  // saves antigos não têm o campo: contam como corpo padrão
  const velho = world.newCharacter('Velho', 'mage', 1, 0);
  delete velho.body;
  assert.equal(world.enterWorld(session, velho).full().bd, 0);
  world.stop();
  fs.rmSync(dir, { recursive: true, force: true });
});

test('o cliente desenha o corpo de adulto: ossos reescalados sem as trilhas de escala das animações, e escolha na criação', () => {
  const chars = read('client/js/three/characters.js');
  assert.match(chars, /function adultProportions\(model\)/);
  assert.match(chars, /!t\.name\.endsWith\('\.scale'\)/);
  assert.match(chars, /create\(key, opts = \{\}\)/);
  assert.match(read('client/js/three/engine.js'), /characters\.create\(e\.cls, \{ adult: !!e\.bd \}\)/);
  const main = read('client/js/main.js');
  assert.match(main, /t: 'create', name: name\.value\.trim\(\), cls, skin, hair, body/);
  assert.match(main, /portrait3d\(/);
  assert.match(read('server/session.js'), /const body = msg\.body \? 1 : 0/);
});
