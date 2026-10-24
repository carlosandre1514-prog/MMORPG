// Todas as habilidades de todas as classes: cada uma precisa sair (gasta mana, entra em recarga) e fazer algo visível no mundo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Database } from '../server/db.js';
import { World } from '../server/world.js';
import { SKILLS } from '../shared/data/skills.js';
import { CLASSES } from '../shared/data/classes.js';
import { MAX_LEVEL } from '../shared/constants.js';
import { useSkill } from '../server/systems/skills.js';

const read = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');

function boot(cls) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aethra-skills-'));
  const world = new World(new Database(dir), { quiet: true });
  const sent = [];
  const ch = world.newCharacter('Teste' + cls, cls, 0, 0);
  ch.level = MAX_LEVEL;
  const p = world.enterWorld({ send: (m) => sent.push(m) }, ch);
  world.transfer(p, 'fields', 50, 40);
  return { world, p, ch, sent, done: () => { world.stop(); fs.rmSync(dir, { recursive: true, force: true }); } };
}

for (const cls of Object.keys(CLASSES)) {
  test(`habilidades de ${CLASSES[cls].name}: todas saem e fazem efeito`, () => {
    const { world, p, sent, done } = boot(cls);
    const zone = p.zone;
    assert.equal(zone.id, 'fields');
    for (const sid of CLASSES[cls].skills) {
      const sk = SKILLS[sid];
      assert.equal(sk.cls, cls, `${sid} pertence à classe`);
      // um alvo parado e resistente, ao lado do jogador
      const mon = zone.monsters.find((m) => m.alive && m.def.id === 'wolf');
      mon.hp = mon.maxHp = 1e7;
      mon.x = 52; mon.y = 40; mon.home = { x: 52, y: 40 }; mon.state = 'idle'; mon.target = null; mon.statuses = [];
      p.x = 50.8; p.y = 40; p.hp = Math.round(p.stats.maxHp * 0.5);
      p.mp = p.stats.maxMp; p.cd = {}; p.gcd = 0; p.casting = null;
      p.statuses = [];
      const before = { mhp: mon.hp, ms: mon.statuses.length, ps: p.statuses.length, php: p.hp, x: p.x, y: p.y, mp: p.mp };
      const err0 = sent.filter((m) => m.t === 'msg' && m.k === 'err').length;
      useSkill(world, p, { t: 'sk', s: sid, id: mon.id, x: 52, y: 40 });
      const errs = sent.filter((m) => m.t === 'msg' && m.k === 'err').slice(err0).map((m) => m.m);
      assert.deepEqual(errs, [], `${sid} deu erro: ${errs.join(' | ')}`);
      assert.ok((p.cd[sid] || 0) > Date.now(), `${sid} não entrou em recarga`);
      assert.ok(p.mp < before.mp, `${sid} não gastou mana`);
      zone.update(Date.now() + 3000, 0.05); // deixa os golpes e projéteis com atraso acontecerem
      const changed = mon.hp < before.mhp || mon.statuses.length !== before.ms || p.statuses.length !== before.ps || p.hp !== before.php
        || Math.hypot(p.x - before.x, p.y - before.y) > 0.3 || mon.threat.size > 0;
      assert.ok(changed, `${sid} (${sk.name}) não alterou nada no mundo (monstro ${mon.hp}/${before.mhp}, jogador ${p.x.toFixed(1)},${p.y.toFixed(1)} hp ${p.hp}/${before.php}, vivo=${mon.alive})`);
    }
    done();
  });
}

test('o cliente segura a habilidade quando o alvo está um pouco longe ou o intervalo global ainda corre', () => {
  const game = read('client/js/game.js');
  assert.match(game, /skillReach\(sk, t\)/);
  assert.match(game, /alvo fora de alcance, aproximando/);
  assert.match(game, /this\.buffered = \{ id: sk\.id/);
  // andar com o teclado não cancela a habilidade que espera o alvo chegar ao alcance
  assert.match(game, /this\.action\.type !== 'attack' && this\.action\.type !== 'skill'\) this\.action = null/);
});
