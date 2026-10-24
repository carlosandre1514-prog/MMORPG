// Testes unitários da lógica compartilhada.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { xpToNext, computeStats, monsterStats, enhanceChance, enhanceCost, xpLevelMod } from '../shared/formulas.js';
import { createItem, itemStats, itemName, sellPrice, rollRarity } from '../shared/itemgen.js';
import { ITEMS } from '../shared/data/items.js';
import { QUESTS } from '../shared/data/quests.js';
import { NPCS } from '../shared/data/npcs.js';
import { MONSTERS } from '../shared/data/monsters.js';
import { RECIPES } from '../shared/data/recipes.js';
import { SKILLS } from '../shared/data/skills.js';
import { CLASSES } from '../shared/data/classes.js';
import { ZONES } from '../shared/data/zones.js';
import { generateMap } from '../shared/mapgen.js';
import { buildMap, encodeLayer, decodeLayer } from '../shared/tiles.js';
import { canStand } from '../shared/collision.js';
import { findPath } from '../shared/pathfinding.js';
import { mulberry32 } from '../shared/rng.js';
import { addItem, removeItem, countItem, newInventory, canAddAll } from '../server/systems/inventory.js';

test('curva de experiência cresce e termina no nível máximo', () => {
  for (let l = 1; l < 30; l++) assert.ok(xpToNext(l + 1) > xpToNext(l) || l + 1 === 30);
  assert.equal(xpToNext(30), 0);
  assert.ok(xpLevelMod(20, 5) < xpLevelMod(5, 5));
});

test('atributos derivados respondem a equipamento e pontos', () => {
  const base = { cls: 'warrior', level: 10, alloc: { str: 0, dex: 0, int: 0, vit: 0 }, equip: {}, flags: {} };
  const a = computeStats(base);
  const b = computeStats({ ...base, alloc: { str: 10, dex: 0, int: 0, vit: 10 }, equip: { weapon: createItem('w_weapon_3') } });
  assert.ok(b.power > a.power);
  assert.ok(b.maxHp > a.maxHp);
  const c = computeStats({ ...base, flags: { brasa_vida: true } });
  assert.equal(c.maxHp, Math.round(a.maxHp * 1.1));
});

test('itens: raridade, afixos, aprimoramento e preço', () => {
  const rng = mulberry32(5);
  const it = createItem('chest_3', { rarity: 3, rng });
  assert.equal(Object.keys(it.a).length, 3);
  const s0 = itemStats(it).def;
  it.p = 5;
  assert.ok(itemStats(it).def > s0);
  assert.match(itemName(it), /\+5$/);
  assert.ok(sellPrice(it) > 0);
  const u = createItem('u_boar_tusk');
  assert.equal(u.r, 4);
  assert.equal(enhanceChance(0), 1);
  assert.ok(enhanceCost(it).gold > 0);
  for (let i = 0; i < 200; i++) assert.ok(rollRarity(rng, 2) >= 1);
});

test('inventário empilha, remove e respeita capacidade', () => {
  const inv = newInventory(3);
  assert.ok(addItem(inv, createItem('pot_hp_1', { qty: 60 })));
  assert.ok(addItem(inv, createItem('pot_hp_1', { qty: 60 })));
  assert.equal(countItem(inv, 'pot_hp_1'), 120);
  assert.equal(inv.filter(Boolean).length, 2);
  assert.ok(addItem(inv, createItem('w_weapon_1')));
  assert.ok(!addItem(inv, createItem('w_weapon_1')));
  assert.ok(!canAddAll(inv, [{ id: 'mat_slime', q: 1 }]));
  assert.ok(removeItem(inv, 'pot_hp_1', 100));
  assert.equal(countItem(inv, 'pot_hp_1'), 20);
});

test('dados consistentes: missões, NPCs, receitas, habilidades', () => {
  for (const q of Object.values(QUESTS)) {
    assert.ok(NPCS[q.giver], `giver de ${q.id}`);
    assert.ok(NPCS[q.turnIn], `turnIn de ${q.id}`);
    for (const p of q.prereq || []) assert.ok(QUESTS[p], `prereq ${p}`);
    for (const o of q.objectives) {
      if (o.type === 'kill') for (const t of [].concat(o.target)) assert.ok(MONSTERS[t], `monstro ${t}`);
      if (o.type === 'collect') assert.ok(ITEMS[o.item], `item ${o.item}`);
      if (o.type === 'talk') assert.ok(NPCS[o.npc], `npc ${o.npc}`);
    }
    for (const [id] of q.rewards.items || []) assert.ok(ITEMS[id], `recompensa ${id}`);
  }
  for (const n of Object.values(NPCS)) for (const id of n.shop || []) assert.ok(ITEMS[id], `loja ${id}`);
  for (const r of Object.values(RECIPES)) for (const [id] of r.mats) assert.ok(ITEMS[id], `receita ${id}`);
  for (const c of Object.values(CLASSES)) {
    assert.equal(c.skills.length, 6);
    for (const s of c.skills) assert.equal(SKILLS[s].cls, c.id);
  }
  for (const m of Object.values(MONSTERS)) {
    for (const d of m.drops || []) assert.ok(ITEMS[d.id], `drop ${d.id}`);
    for (const d of m.questDrops || []) assert.ok(QUESTS[d.quest] && ITEMS[d.id]);
  }
  // a campanha principal é uma cadeia contínua
  const main = Object.values(QUESTS).filter((q) => q.main);
  assert.equal(main.length, 54);
  // cada missão principal (menos a primeira) depende de uma anterior da campanha
  for (const q of main.slice(1)) assert.ok((q.prereq || []).some((p) => QUESTS[p].main), `${q.id} sem elo com a campanha`);
  // os chefes das regiões novas entregam o selo da missão certa
  for (const [m, q] of [['nhaga', 'ms29'], ['valdric', 'ms36'], ['vargnar', 'ms42'], ['kaelisa', 'ms46'], ['nyxthar', 'ms53']]) {
    assert.ok(MONSTERS[m].questDrops.some((d) => d.quest === q && d.chance === 1), `${m} dá o item de ${q}`);
  }
});

test('mapas: gerados, conectados e com NPCs/portais acessíveis', () => {
  for (const z of Object.values(ZONES)) {
    const m = generateMap(z);
    const map = buildMap(m.w, m.h, decodeLayer(encodeLayer(m.tiles)), m.objs, m.structures);
    assert.ok(canStand(map, z.spawn.x, z.spawn.y), `spawn de ${z.id}`);
    for (const n of Object.values(NPCS).filter((x) => x.zone === z.id)) {
      assert.ok(findPath(map, z.spawn.x, z.spawn.y, n.x, n.y, 30000), `caminho até ${n.id}`);
    }
    for (const p of z.portals) assert.ok(findPath(map, z.spawn.x, z.spawn.y, p.x + p.w / 2, p.y + p.h / 2, 30000), `portal ${z.id}->${p.to}`);
    // determinístico
    const m2 = generateMap(z);
    assert.deepEqual(m2.tiles, m.tiles);
  }
});

test('monstros escalam com o nível', () => {
  const a = monsterStats(MONSTERS.goblin, 6), b = monsterStats(MONSTERS.goblin, 8);
  assert.ok(b.maxHp > a.maxHp && b.power > a.power);
});
