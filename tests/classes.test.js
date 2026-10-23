// Classes jogáveis: cada uma tem armas, habilidades que funcionam, visual em 3D e sprites para as telas de personagem.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Database } from '../server/db.js';
import { World } from '../server/world.js';
import { Monster } from '../server/entities/monster.js';
import { CLASSES, CLASS_LIST } from '../shared/data/classes.js';
import { SKILLS, skillsForClass } from '../shared/data/skills.js';
import { ITEMS } from '../shared/data/items.js';
import { MONSTERS } from '../shared/data/monsters.js';
import { computeStats } from '../shared/formulas.js';

const read = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');

test('cada classe tem as 7 armas, seis habilidades suas e uma arma lendária', () => {
  for (const id of CLASS_LIST) {
    const c = CLASSES[id];
    assert.equal(c.id, id);
    assert.equal(c.skills.length, 6, id);
    assert.deepEqual(skillsForClass(id).map((s) => s.id).sort(), [...c.skills].sort(), id);
    for (const s of c.skills) assert.equal(SKILLS[s].cls, id);
    const prefix = c.startItems[0].split('_')[0];
    for (let t = 1; t <= 7; t++) assert.equal(ITEMS[`${prefix}_weapon_${t}`]?.cls, id, `${id} arma ${t}`);
    assert.equal(ITEMS[`u_${id}_legend`]?.cls, id);
  }
  assert.deepEqual(CLASS_LIST, ['warrior', 'berserker', 'assassin', 'mage', 'ranger', 'cleric']);
});

test('o Guerreiro é o cavaleiro de espada e escudo, o Berserker usa machado e o Clérigo não usa espada nem escudo', () => {
  const chars = read('client/js/three/characters.js');
  assert.match(chars, /warrior: \{ model: 'Knight', right: 'sword_1handed', left: 'shield_badge_color' \}/);
  assert.match(chars, /berserker: \{ model: 'Barbarian', right: 'axe_2handed' \}/);
  const cleric = chars.match(/\n  cleric: \{([^}]*)\}/)[1];
  assert.ok(!/sword|shield|Knight/.test(cleric), cleric);
  assert.match(cleric, /@mace/);
  assert.match(chars, /assassin: \{ model: 'Rogue_Hooded', right: 'dagger', left: 'dagger'/); // o Assassino usa duas adagas
  assert.equal(ITEMS.a_weapon_1.icon.shape, 'dagger');
  // o Clérigo mantém a cor de pele: só as roupas são recoloridas (por matiz), nada de desbotar o modelo todo
  assert.match(cleric, /recolor: 'cleric'/);
  assert.ok(!/\bsat:|bright:|tint:/.test(cleric), 'sem filtro que desbote a pele');
  assert.match(ITEMS.b_weapon_1.name, /Machad/);
  assert.equal(ITEMS.b_weapon_1.icon.shape, 'axe');
  // sprites das telas de personagem: um por classe
  const manifest = JSON.parse(read('client/assets/sprites/manifest.json'));
  for (const id of CLASS_LIST) assert.ok(manifest.sprites[id], `sprite de ${id}`);
  assert.ok(fs.existsSync(new URL('../client/assets/sprites/berserker.webp', import.meta.url)));
});

test('todas as habilidades de todas as classes executam no servidor', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aethra-cls-'));
  const world = new World(new Database(dir), { quiet: true });
  try {
    for (const id of CLASS_LIST) {
      const ch = world.newCharacter('Teste' + id.slice(0, 3), id, 0, 0);
      const p = world.enterWorld({ send: () => {} }, ch);
      while (ch.level < 30) world.giveXp(p, 1e7);
      world.transfer(p, 'fields', 30.5, 45.5);
      const def = Object.values(MONSTERS).find((m) => !m.boss);
      const mobs = [0, 1, 2].map((i) => { const m = new Monster(p.zone, def, 5, p.x + 1.2 + i * 0.4, p.y + (i - 1) * 0.5); m.hp = m.maxHp = 1e6; p.zone.addMonster(m); return m; });
      assert.ok(computeStats(ch).power > 0);
      for (const sid of CLASSES[id].skills) {
        const sk = SKILLS[sid];
        p.mp = p.stats.maxMp; p.cd = {}; p.gcd = 0; p.combatUntil = 0; p.x = 30.5; p.y = 45.5; p.statuses = [];
        const before = p.mp;
        world.handle(p, { t: 'sk', s: sid, id: sk.target === 'ally' ? p.id : mobs[0].id, x: mobs[0].x, y: mobs[0].y });
        assert.ok((p.cd[sid] || 0) > Date.now(), `${sid} não executou`);
        assert.ok(p.mp < before || sk.mp === 0, `${sid} não gastou mana`);
      }
    }
  } finally { world.stop(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('habilidades do Berserker: sangramento, frenesi e massacre mudam os atributos', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aethra-bsk-'));
  const world = new World(new Database(dir), { quiet: true });
  try {
    const ch = world.newCharacter('Furia', 'berserker', 0, 0);
    const p = world.enterWorld({ send: () => {} }, ch);
    while (ch.level < 30) world.giveXp(p, 1e7);
    world.transfer(p, 'fields', 30.5, 45.5);
    const base = { power: p.stats.power, def: p.stats.def, haste: p.stats.haste };
    p.mp = p.stats.maxMp; p.cd = {}; p.gcd = 0;
    world.handle(p, { t: 'sk', s: 'b_frenzy' });
    assert.ok(p.stats.power > base.power, 'frenesi dá poder');
    assert.ok(p.stats.haste > base.haste, 'frenesi dá velocidade de ataque');
    assert.ok(p.stats.def < base.def, 'frenesi tira defesa');
    p.gcd = 0;
    world.handle(p, { t: 'sk', s: 'b_massacre' });
    assert.ok(p.stats.lifesteal >= 25, 'massacre dá roubo de vida');
    assert.ok(p.stats.speed > 4.6, 'massacre dá velocidade');
  } finally { world.stop(); fs.rmSync(dir, { recursive: true, force: true }); }
});
