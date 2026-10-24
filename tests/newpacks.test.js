// Prédios em voxel, zumbis e céu HDR: dados do jogo coerentes com os arquivos de assets.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ZONES } from '../shared/data/zones.js';
import { KINGDOMS } from '../shared/data/kingdoms.js';
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
  // só as casas de adobe da Avenida do Sol têm interior; nenhuma torre em voxel vira sala
  assert.equal((map.rooms || []).filter((g) => g.st.type === 'voxel').length, 0);
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
    assert.ok(m.undead && m.lvl[0] >= ZONES.ruins.lvl[0] && m.lvl[1] <= ZONES.ruins.lvl[1]);
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

test('armas de Sahaar: toda arma pedida em characters.js existe no KayKit ou em assets/weapons, e o reino baixa o pacote', () => {
  const src = fs.readFileSync(path.join(ROOT, 'client/js/three/characters.js'), 'utf8');
  const kaykit = new Set(fs.readdirSync(path.join(ROOT, 'assets/kaykit/weapons')).filter((f) => f.endsWith('.gltf')).map((f) => f.replace('.gltf', '')));
  const extra = new Set(glbJson('assets/weapons/weapons.glb').nodes.map((n) => n.name));
  const used = new Set([...src.matchAll(/\b(?:right|left): '([A-Za-z0-9_]+)'/g)].map((m) => m[1]));
  assert.ok(used.size > 10);
  for (const w of used) assert.ok(kaykit.has(w) || extra.has(w), `arma ${w} sem modelo`);
  for (const w of ['Scimitar', 'Falchion', 'Sword_Golden', 'Shield_Celtic_Golden', 'Hammer_Double']) assert.ok(used.has(w), `${w} em uso`);
  // o saque de nível 30 (Solar) usa modelos do pacote
  const eng = fs.readFileSync(path.join(ROOT, 'client/js/three/engine.js'), 'utf8');
  for (const w of eng.match(/LOOT_SOLAR = \{([^}]*)\}/)[1].matchAll(/'([A-Za-z_]+)'/g)) assert.ok(extra.has(w[1]), `saque ${w[1]}`);
  // Sahaar carrega o pacote de armas junto com as torres; Alvorada não
  assert.ok(KINGDOMS.sahaar.assets.includes('arms'));
  assert.ok(!KINGDOMS.alvorada.assets.includes('arms'));
  // a licença CC BY exige o crédito: README e ajuda do jogo citam o autor
  for (const f of ['README.md', 'client/js/ui/windows.js']) assert.match(fs.readFileSync(path.join(ROOT, f), 'utf8'), /Alstra Infinite/, f);
  assert.match(fs.readFileSync(path.join(ROOT, 'assets/weapons/LICENSE.txt'), 'utf8'), /CC BY 4\.0/);
});

test('Zahrim: as casas de adobe da Avenida do Sol são visitáveis e a rua em frente às portas está livre', () => {
  const houses = town.structures.filter((s) => s.kind === 'house' && s.type !== 'voxel');
  assert.ok(houses.length >= 24, 'casas de adobe suficientes');
  assert.equal(map.rooms.length, houses.length);
  for (const st of houses) assert.equal(st.style, 'sand');
  for (const g of map.rooms) {
    const [ox, oy] = [g.door[0] - g.inward[0] * 0.6, g.door[1] - g.inward[1] * 0.6];
    assert.ok(canStand(map, ox, oy, 0.28), `a frente da porta de ${g.st.type} ${g.st.x},${g.st.y} está livre`);
  }
  const labels = houses.filter((s) => s.label).map((s) => s.label).sort();
  assert.deepEqual(labels, ['Casa das Essências', 'Forja de Dahmir', 'Taverna do Oásis']);
  // o reino de Sahaar carrega o pacote da vila (paredes, porta e telhado das casas) além das torres
  assert.ok(KINGDOMS.sahaar.assets.includes('village'));
});
