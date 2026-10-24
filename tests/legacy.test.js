// Legado: feitos, maestria depois do nível 30, bestiário e desafios do dia e da semana.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Database } from '../server/db.js';
import { World } from '../server/world.js';
import { Monster } from '../server/entities/monster.js';
import { dealDamage, computeHit } from '../server/systems/combat.js';
import { bestiaryMult, legacyPayload, checkAchievements, refreshChallenges } from '../server/systems/legacy.js';
import { MONSTERS } from '../shared/data/monsters.js';
import { computeStats } from '../shared/formulas.js';
import { MAX_LEVEL } from '../shared/constants.js';
import {
  ACHIEVEMENTS, ACH_BY_ID, counterValue, makeChallenges, dayIndex, weekIndex, dayEnds, weekEnds, bestiaryRank, bestiaryBonus, BESTIARY_LIST,
  MASTERY_STATS, masteryNext, masteryBonus, respecCost, gloryRank, gloryOf, COUNTER_NAMES,
} from '../shared/data/legacy.js';

const read = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');

function boot(cls = 'warrior') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aethra-leg-'));
  const world = new World(new Database(dir), { quiet: true });
  const sent = [];
  const ch = world.newCharacter('Legado', cls, 0, 0);
  const p = world.enterWorld({ send: (m) => sent.push(m) }, ch);
  return { world, p, ch, sent, done: () => { world.stop(); fs.rmSync(dir, { recursive: true, force: true }); } };
}
const flush = (world, p) => { p.legSendAt = 0; p.dirty.legacy = true; world.flush(p, Date.now()); };

test('os feitos são bem formados: ids únicos, metas crescentes, contadores conhecidos e recompensas', () => {
  assert.ok(ACHIEVEMENTS.length >= 90, `${ACHIEVEMENTS.length} feitos`);
  assert.equal(new Set(ACHIEVEMENTS.map((a) => a.id)).size, ACHIEVEMENTS.length);
  const known = new Set(Object.keys(COUNTER_NAMES));
  const byCounter = {};
  for (const a of ACHIEVEMENTS) {
    const key = a.counter.includes(':') ? a.counter.split(':')[0] + ':' : a.counter;
    assert.ok(known.has(a.counter) || ['bst:', 'qd:'].includes(key), `${a.id}: contador ${a.counter}`);
    assert.ok(a.goal > 0 && a.pts > 0 && a.name && a.desc, a.id);
    (byCounter[a.counter] ||= []).push(a);
  }
  for (const [c, list] of Object.entries(byCounter)) for (let i = 1; i < list.length; i++) assert.ok(list[i].goal > list[i - 1].goal, `${c}: metas devem crescer`);
  // a campanha, a saga e cada chefe têm o seu feito
  assert.ok(ACH_BY_ID.campaign && ACH_BY_ID.saga_sahaar && ACH_BY_ID.slay_morvath);
  for (const m of Object.values(MONSTERS)) if (m.boss) assert.ok(ACH_BY_ID[`slay_${m.id}`], m.id);
  // dá para chegar nas metas mais altas: elas são de horas, meses e anos, não de uma tarde
  assert.ok(ACH_BY_ID.kills6.goal >= 50000 && ACH_BY_ID.hours6.goal >= 5000 && ACH_BY_ID.mast7.goal >= 300);
  assert.equal(gloryRank(0).name, 'Recruta');
  assert.ok(gloryRank(99999).next === null);
});

test('maestria: fórmulas e o custo cresce devagar para durar anos', () => {
  assert.equal(Object.keys(MASTERY_STATS).length, 9);
  assert.ok(masteryNext(100) > masteryNext(0));
  // gastar todos os graus de poder dá +20%
  assert.ok(Math.abs(masteryBonus({ power: 50 }).power - 0.2) < 1e-9);
  const base = { cls: 'warrior', level: MAX_LEVEL, alloc: { str: 0, dex: 0, int: 0, vit: 0 }, equip: {}, flags: {} };
  const a = computeStats(base), b = computeStats({ ...base, mastery: { ranks: { power: 50, hp: 50, def: 40, crit: 50, haste: 40, lifesteal: 30, speed: 20 } } });
  assert.ok(b.power > a.power * 1.19 && b.maxHp > a.maxHp * 1.24 && b.def > a.def * 1.19);
  assert.ok(b.crit - a.crit >= 5.9 && b.haste - a.haste >= 7.9 && b.lifesteal - a.lifesteal >= 1.19 && b.speed > a.speed);
  assert.ok(respecCost(100) > respecCost(10));
});

test('bestiário: degraus de conhecimento viram dano extra contra a espécie', () => {
  assert.equal(bestiaryRank(9), 0);
  assert.equal(bestiaryRank(10), 1);
  assert.equal(bestiaryRank(5000), 5);
  assert.ok(Math.abs(bestiaryBonus(5000) - 0.15) < 1e-9);
  assert.equal(BESTIARY_LIST.length, Object.values(MONSTERS).filter((m) => !m.summon).length);
  assert.ok(BESTIARY_LIST.length >= 50 && BESTIARY_LIST.includes('nyxthar') && !BESTIARY_LIST.includes('toadling'));
});

test('desafios: sorteio estável, recompensas e período', () => {
  const idx = dayIndex(1_700_000_000_000);
  assert.deepEqual(makeChallenges('d', idx, 20, 5), makeChallenges('d', idx, 20, 5));
  assert.equal(makeChallenges('d', idx, 20, 5).length, 3);
  assert.equal(makeChallenges('w', weekIndex(1_700_000_000_000), 20, 5).length, 2);
  assert.notDeepEqual(makeChallenges('d', idx, 20, 5), makeChallenges('d', idx + 1, 20, 5));
  for (const c of makeChallenges('d', idx, 25, 9)) assert.ok(c.target > 0 && c.rw.gold > 0 && c.text);
  assert.ok(dayEnds(idx) > 1_700_000_000_000 && dayEnds(idx) - 86400000 <= 1_700_000_000_000);
  assert.ok(weekEnds(weekIndex(1_700_000_000_000)) > 1_700_000_000_000);
});

test('no servidor: abates alimentam bestiário, contadores e feitos; o título é escolhido pelo jogador', () => {
  const { world, p, ch, sent, done } = boot();
  try {
    world.transfer(p, 'fields', 30.5, 45.5);
    const def = MONSTERS.slime;
    for (let i = 0; i < 10; i++) {
      const m = new Monster(p.zone, def, 3, p.x + 1, p.y);
      p.zone.addMonster(m);
      dealDamage(p.zone, p, m, 1e6);
    }
    assert.equal(ch.record.kills, 10);
    assert.equal(ch.bestiary.slime, 10);
    flush(world, p);
    assert.ok(ch.ach.kills1, 'Primeiro Sangue');
    assert.ok(sent.some((m) => m.t === 'ach' && m.id === 'kills1'));
    assert.ok(ch.stats.damage > 0 && ch.stats.gold > 0);
    // dano extra contra a espécie estudada
    ch.bestiary.slime = 1000;
    assert.ok(bestiaryMult(p, def) > 1.09);
    ch.bestiary.slime = 0;
    assert.equal(bestiaryMult(p, def), 1);
    // título
    ch.titles.push('Terror da Névoa');
    world.handle(p, { t: 'title', v: 'Terror da Névoa' });
    assert.equal(ch.title, 'Terror da Névoa');
    world.handle(p, { t: 'title', v: 'Título Inventado' });
    assert.equal(ch.title, 'Terror da Névoa', 'só vale título conquistado');
    world.handle(p, { t: 'title', v: null });
    assert.equal(ch.title, null);
    // o payload tem tudo que a janela mostra
    const d = legacyPayload(p);
    assert.equal(d.t, 'leg');
    assert.ok(d.ac.includes('kills1') && d.cv.kills === 10 && d.bs.slime === 0 + (ch.bestiary.slime || 0) && d.gl >= 5);
    assert.equal(d.ch.d.list.length, 3);
    assert.equal(d.ch.w.list.length, 2);
  } finally { done(); }
});

test('no servidor: no nível máximo o XP vira maestria, que se gasta, se refaz e vale nas fórmulas', () => {
  const { world, p, ch, sent, done } = boot();
  try {
    while (ch.level < MAX_LEVEL) world.giveXp(p, 1e7);
    assert.equal(ch.mastery.level, 0);
    const before = p.stats.power;
    world.giveXp(p, masteryNext(0) + 10);
    assert.equal(ch.mastery.level, 1);
    assert.equal(ch.xp, 0, 'o XP comum não acumula no nível máximo');
    assert.ok(sent.some((m) => m.t === 'mlvl' && m.lv === 1));
    world.handle(p, { t: 'ma', op: 'rank', k: 'power', n: 5 }); // só há 1 ponto
    assert.equal(ch.mastery.ranks.power, 1);
    ch.mastery.level = 60; // com mais pontos o efeito aparece nos números
    world.handle(p, { t: 'ma', op: 'rank', k: 'power', n: 60 }); // o máximo do atributo é 50
    assert.equal(ch.mastery.ranks.power, 50);
    assert.ok(p.stats.power >= Math.round(before * 1.19), 'o poder sobe na hora');
    ch.mastery.level = 1;
    ch.mastery.ranks = { power: 1 };
    world.handle(p, { t: 'ma', op: 'rank', k: 'inventado', n: 1 });
    assert.equal(ch.mastery.ranks.inventado, undefined);
    // redistribuir custa ouro
    ch.gold = 0;
    world.handle(p, { t: 'ma', op: 'reset' });
    assert.equal(ch.mastery.ranks.power, 1, 'sem ouro não redistribui');
    ch.gold = 1e6;
    world.handle(p, { t: 'ma', op: 'reset' });
    assert.deepEqual(ch.mastery.ranks, {});
    assert.equal(ch.gold, 1e6 - respecCost(1));
    // bônus de ouro da maestria
    ch.mastery.ranks.gold = 50;
    const g0 = ch.gold;
    world.giveGold(p, 1000);
    assert.equal(ch.gold - g0, 1400);
    // XP de maestria sobe com o atributo Estudo
    ch.mastery.ranks.xp = 50;
    const m0 = ch.mastery.xp;
    world.giveXp(p, 1000);
    assert.equal(ch.mastery.xp - m0, 1300);
    // nível de maestria vira feito
    ch.mastery.level = 10;
    checkAchievements(world, p);
    assert.ok(ch.ach.mast1 && ch.ach.mast2);
  } finally { done(); }
});

test('no servidor: desafios do dia contam o que veio depois da lista e pagam uma vez só', () => {
  const { world, p, ch, sent, done } = boot();
  try {
    refreshChallenges(p);
    const c = ch.chal.d;
    assert.equal(c.list.length, 3);
    const first = c.list[0];
    world.handle(p, { t: 'chal', p: 'd', i: 0 });
    assert.ok(sent.some((m) => m.t === 'msg' && m.k === 'err' && /ainda não/.test(m.m)), 'não paga antes de cumprir');
    // cumpre o primeiro: soma ao contador o que a meta pede
    if (first.counter.startsWith('bst:')) ch.bestiary[first.counter.slice(4)] = (ch.bestiary[first.counter.slice(4)] || 0) + first.target;
    else if (['kills', 'bossKills'].includes(first.counter)) ch.record[first.counter] += first.target;
    else ch.stats[first.counter] = (ch.stats[first.counter] || 0) + first.target;
    const gold = ch.gold, glory = ch.stats.glory || 0;
    world.handle(p, { t: 'chal', p: 'd', i: 0 });
    assert.equal(ch.chal.d.claimed[0], true);
    assert.ok(ch.gold >= gold + first.rw.gold && (ch.stats.glory || 0) === glory + first.rw.pts);
    const g2 = ch.gold;
    world.handle(p, { t: 'chal', p: 'd', i: 0 });
    assert.equal(ch.gold, g2, 'não paga duas vezes');
    // virou o dia: lista nova
    ch.chal.d.idx -= 1;
    refreshChallenges(p);
    assert.equal(ch.chal.d.idx, dayIndex());
    assert.deepEqual(ch.chal.d.claimed, [false, false, false]);
  } finally { done(); }
});

test('personagem antigo (sem legado) é atualizado ao entrar', () => {
  const { world, p, ch, done } = boot();
  try {
    for (const k of ['stats', 'ach', 'titles', 'mastery', 'bestiary', 'chal']) delete ch[k];
    ch.title = 'Portador da Chama';
    world.migrateChar(ch);
    assert.deepEqual(ch.titles, ['Portador da Chama']);
    assert.equal(ch.mastery.level, 0);
    assert.ok(ch.stats && ch.ach && ch.bestiary && ch.chal);
    assert.equal(counterValue(ch, 'zones'), ch.visited.length);
    assert.equal(gloryOf(ch), 0);
  } finally { done(); }
});

test('o cliente tem a janela do Legado ligada ao menu, à tecla N e às mensagens do servidor', () => {
  const ui = read('client/js/ui/ui.js'), game = read('client/js/game.js'), win = read('client/js/ui/windows.js'), leg = read('client/js/ui/legacyui.js'), h = read('server/handlers.js');
  assert.match(ui, /\['legacy', 'Legado', 'N'/);
  assert.match(ui, /n: 'legacy'/);
  assert.match(ui, /send\(\{ t: 'leg' \}\)/);
  assert.match(win, /buildLegacyWindow\(W\)/);
  assert.match(game, /case 'leg': this\.ui\.onLegacy\(m\)/);
  assert.match(game, /case 'ach':/);
  assert.match(leg, /legFeitos[\s\S]*legMaestria[\s\S]*legBestiario[\s\S]*legDesafios/);
  assert.match(leg, /t: 'ma', op: 'rank'/);
  assert.match(leg, /t: 'chal', p: kind/);
  for (const k of ['leg(world, p)', 'ma(world, p, msg)', 'title(world, p, msg)', 'chal(world, p, msg)']) assert.ok(h.includes(k), k);
});
