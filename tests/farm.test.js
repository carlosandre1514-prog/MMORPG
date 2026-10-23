// Fazenda dos Campos Verdejantes: layout, mapa gerado (bloqueios, cercas, portões), modelos dos pacotes convertidos e animais.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { farmLayout, FARM_FOOT, FARM_ANIMALS, penInner } from '../shared/farm.js';
import { generateMap } from '../shared/mapgen.js';
import { buildMap } from '../shared/tiles.js';
import { T, O } from '../shared/tiles.js';
import { ZONES } from '../shared/data/zones.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
function glbNames(file) { // nomes dos nós de um GLB (lê o JSON do cabeçalho)
  const b = fs.readFileSync(path.join(ROOT, file));
  const len = b.readUInt32LE(12);
  return new Set(JSON.parse(b.subarray(20, 20 + len).toString('utf8')).nodes.map((n) => n.name));
}
const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

test('o layout da fazenda cabe no mapa, sem construções ou currais sobrepostos', () => {
  const L = farmLayout();
  const z = ZONES.fields;
  const items = [...L.buildings.map((b) => ({ ...b, id: b.model })), ...L.pens.map((p) => ({ ...p, id: p.id }))];
  for (const it of items) assert.ok(it.x >= 2 && it.y >= 2 && it.x + it.w <= z.w - 2 && it.y + it.h <= z.h - 2, `${it.id} dentro do mapa`);
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    const a = items[i], b = items[j];
    // a única sobreposição permitida: o galinheiro e a lagoa ficam dentro do curral das aves; a cerca do curral das aves encosta no celeiro
    if (a.id === 'aves' && b.model === 'ChickenCoop') continue;
    if (b.id === 'aves' && a.model === 'ChickenCoop') continue;
    if (overlap(a, b)) {
      const o = { x: Math.max(a.x, b.x), y: Math.max(a.y, b.y), x2: Math.min(a.x + a.w, b.x + b.w), y2: Math.min(a.y + a.h, b.y + b.h) };
      assert.ok((o.x2 - o.x) * (o.y2 - o.y) <= 1, `${a.id} e ${b.id} se sobrepõem em mais de um tile`);
    }
  }
  for (const b of L.buildings) assert.deepEqual([b.w, b.h], FARM_FOOT[b.model]);
  // todos os bichos que o jogador pediu existem em algum curral
  const kinds = new Set(L.pens.flatMap((p) => p.animals.map(([k]) => k)));
  for (const k of ['chicken', 'rooster', 'duck', 'goose', 'pig', 'sheep', 'cow', 'bull', 'horse']) assert.ok(kinds.has(k), k);
  for (const k of kinds) assert.ok(FARM_ANIMALS.includes(k), k);
  for (const p of L.pens) { const r = penInner(p); assert.ok(r.w >= 3 && r.h >= 2, p.id); }
});

test('o mapa dos Campos tem a fazenda: construções bloqueiam, cercas têm portão e o curral é alcançável', () => {
  const m = generateMap(ZONES.fields);
  const map = buildMap(m.w, m.h, m.tiles, m.objs, m.structures);
  const kinds = {};
  for (const s of m.structures) kinds[s.kind] = (kinds[s.kind] || 0) + 1;
  assert.equal(kinds.farm, 8);
  assert.equal(kinds.pen, 4);
  assert.ok(kinds.farmprop >= 20);
  for (const s of m.structures.filter((x) => x.kind === 'farm')) {
    for (let y = s.y; y < s.y + s.h; y++) for (let x = s.x; x < s.x + s.w; x++) assert.equal(map.block[y * m.w + x], 1, `${s.model} bloqueia ${x},${y}`);
  }
  // busca em largura a partir do ponto de entrada da zona: todos os currais (dentro das cercas) são alcançáveis a pé
  const seen = new Uint8Array(m.w * m.h), q = [];
  const sx = Math.floor(ZONES.fields.spawn.x), sy = Math.floor(ZONES.fields.spawn.y);
  seen[sy * m.w + sx] = 1; q.push([sx, sy]);
  while (q.length) {
    const [x, y] = q.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= m.w || ny >= m.h || seen[ny * m.w + nx] || map.block[ny * m.w + nx]) continue;
      seen[ny * m.w + nx] = 1; q.push([nx, ny]);
    }
  }
  for (const p of m.structures.filter((x) => x.kind === 'pen')) {
    const r = penInner(p);
    let free = 0, reached = 0;
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (!map.block[y * m.w + x]) { free++; if (seen[y * m.w + x]) reached++; }
    assert.ok(free > 0 && reached === free, `curral ${p.animals.map((a) => a[0]).join(',')}: ${reached}/${free} tiles alcançáveis`);
    let fences = 0;
    for (let x = p.x; x < p.x + p.w; x++) for (const y of [p.y, p.y + p.h - 1]) if (m.objs[y * m.w + x] === O.FENCE) fences++;
    assert.ok(fences > p.w, 'cerca no contorno');
  }
  const pond = m.structures.find((s) => s.kind === 'pen' && s.pond).pond;
  assert.equal(m.tiles[pond.y * m.w + pond.x], T.WATER);
});

test('os modelos usados pela fazenda existem nos GLBs convertidos (tools/farm/convert.mjs)', () => {
  const farm = glbNames('assets/farm/farm.glb'), props = glbNames('assets/farm/props.glb'), flora = glbNames('assets/farm/flora.glb'), magic = glbNames('assets/farm/magic.glb');
  const L = farmLayout();
  for (const b of L.buildings) assert.ok(farm.has('farm_' + b.model), b.model);
  for (const p of L.props) assert.ok(props.has('prop_' + p.m), p.m);
  const world = read('client/js/three/world3d.js');
  for (const n of world.match(/flora_[A-Za-z0-9]+/g)) assert.ok(flora.has(n), n);
  for (const n of read('client/js/three/interiors.js').match(/magic_[A-Za-z0-9]+/g)) assert.ok(magic.has(n), n);
  // a licença de cada pacote está registrada, inclusive o que não deu para confirmar
  const lic = read('assets/farm/LICENSE.txt');
  for (const k of ['Quaternius', 'CC0', 'RG Poly', 'WizP', 'CONFIRME']) assert.ok(lic.includes(k), k);
  assert.match(read('docs/LICENCAS.md'), /RG Poly/);
  assert.match(read('docs/LICENCAS.md'), /WizP/);
});

test('o cliente liga a fazenda: pacotes carregados, construções, adereços, animais e plantas', () => {
  const medieval = read('client/js/three/medieval.js'), world = read('client/js/three/world3d.js'), animals = read('client/js/three/animals.js');
  for (const f of ['farm', 'props', 'flora', 'magic']) assert.ok(medieval.includes(`/farm/${f}.glb`), f);
  assert.match(read('server/main.js'), /prefix: '\/farm\/'/);
  assert.match(world, /buildFarm\(\)/);
  assert.match(world, /new Farm\(this\.zone\)/);
  assert.match(world, /buildFlora\(\)/);
  for (const k of FARM_ANIMALS) assert.ok(new RegExp(`\\b${k}\\(`).test(animals), 'espécie ' + k);
  assert.match(animals, /export class Farm/);
});
