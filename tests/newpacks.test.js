// Prédios em voxel, zumbis e céu HDR: dados do jogo coerentes com os arquivos de assets.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ZONES } from '../shared/data/zones.js';
import { MONSTERS } from '../shared/data/monsters.js';
import { QUESTS } from '../shared/data/quests.js';
import { generateMap } from '../shared/mapgen.js';
import { buildMap } from '../shared/tiles.js';
import { doorIndex } from '../shared/housegeom.js';
import { canStand } from '../shared/collision.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// lê o JSON de um .glb (cabeçalho de 12 bytes + bloco JSON)
function glbJson(file) {
  const b = fs.readFileSync(path.join(ROOT, file));
  assert.equal(b.toString('latin1', 0, 4), 'glTF', file);
  const len = b.readUInt32LE(12);
  assert.equal(b.toString('latin1', 16, 20), 'JSON');
  return JSON.parse(b.toString('utf8', 20, 20 + len));
}

const town = generateMap(ZONES.zahrim);
const map = buildMap(town.w, town.h, town.tiles, town.objs, town.structures);
const voxels = town.structures.filter((s) => s.type === 'voxel');

test('o GLB dos prédios em voxel tem todos os modelos usados por Zahrim, cada um com sua versão @lod', () => {
  const names = new Set(glbJson('assets/voxel/voxel.glb').nodes.map((n) => n.name));
  assert.ok(voxels.length >= 60);
  for (const st of voxels) {
    assert.ok(names.has(st.model), `modelo ${st.model}`);
    assert.ok(names.has(st.model + '@lod'), `lod de ${st.model}`);
  }
  assert.equal(new Set(voxels.map((s) => s.model)).size, 8, 'os oito modelos em uso');
  assert.ok(voxels.some((s) => s.label === 'Palácio do Emir'));
});

test('as torres em voxel são construções maciças: sem porta, sem interior e bloqueando a área toda', () => {
  assert.equal((map.rooms || []).length, 0);
  for (const st of voxels) {
    assert.equal(st.kind, 'house');
    assert.equal(doorIndex(st), -1);
    for (let y = st.y; y < st.y + st.h; y++) for (let x = st.x; x < st.x + st.w; x++) assert.ok(!canStand(map, x + 0.5, y + 0.5, 0.28), `${st.model} ${x},${y} livre`);
  }
});

test('as torres de Zahrim não se sobrepõem e a capital de Alvorada não tem nenhuma', () => {
  for (const a of voxels) for (const b of voxels) {
    if (a === b) continue;
    const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    assert.ok(!overlap, `${a.model}@${a.x},${a.y} sobrepõe ${b.model}@${b.x},${b.y}`);
  }
  const alvorada = generateMap(ZONES.town);
  assert.equal(alvorada.structures.filter((s) => s.type === 'voxel').length, 0);
  assert.equal(alvorada.structures.filter((s) => s.kind === 'house' && s.type === 'house').length, 116);
});

test('zumbis: monstros, spawns nas Ruínas e contrato no quadro', () => {
  for (const id of ['zombie', 'zombie_brute']) {
    const m = MONSTERS[id];
    assert.ok(m, id);
    assert.equal(m.id, id);
    assert.ok(m.undead && m.lvl[0] >= 18 && m.lvl[1] <= 26);
    assert.ok(ZONES.ruins.spawns.some((s) => s.m === id), `${id} nas Ruínas`);
  }
  const q = QUESTS.rb_zombie;
  assert.ok(q.repeatable && q.giver === 'board');
  for (const o of q.objectives) for (const t of [].concat(o.target)) assert.ok(MONSTERS[t], t);
});

test('arquivos do zumbi e do céu estão no repositório', () => {
  for (const f of ['zombie', 'zombie_idle', 'zombie_run', 'zombie_jump']) assert.ok(fs.statSync(path.join(ROOT, 'assets/brackeys/zombie', f + '.glb')).size > 10000, f);
  const names = new Set();
  for (const f of ['zombie_idle', 'zombie_run', 'zombie_jump']) for (const a of glbJson(`assets/brackeys/zombie/${f}.glb`).animations) names.add(a.name);
  for (const n of ['Idle', 'Run', 'jump']) assert.ok(names.has(n), `clipe ${n}`);
  const hdr = fs.readFileSync(path.join(ROOT, 'assets/brackeys/sky/sky.hdr'));
  assert.ok(hdr.toString('latin1', 0, 10).startsWith('#?RADIANCE'));
  assert.ok(hdr.length < 400000, 'céu pequeno');
});
