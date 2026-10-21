// Testes de ponta a ponta com bots conectados ao servidor real.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { bootServer, Bot, sleep } from './helpers.js';
import { NPCS } from '../shared/data/npcs.js';

let srv;
before(async () => { srv = await bootServer(); });
after(async () => { await srv.close(); });

test('registro, login, criação de personagem e entrada no mundo', async () => {
  const bot = new Bot(srv.port);
  await bot.connect();
  bot.send({ t: 'hello' });
  const hello = await bot.waitType('hello');
  assert.equal(hello.v, 1);
  const chars = await bot.login('tester1');
  assert.equal(chars.t, 'chars');
  assert.equal(chars.list.length, 0);
  await bot.createAndEnter('Heroi', 'warrior');
  assert.equal(bot.zone, 'town');
  const snap = await bot.waitType('s');
  assert.ok(snap.n.some((e) => e.k === 'n' && e.n === 'thalric'), 'Thalric deve estar visível');
  // nome duplicado
  const bot2 = new Bot(srv.port);
  await bot2.connect();
  await bot2.login('tester2');
  bot2.send({ t: 'create', name: 'heroi', cls: 'mage' });
  const e = await bot2.waitType('err');
  assert.match(e.m, /Já existe/);
  // senha errada
  const bot3 = new Bot(srv.port);
  await bot3.connect();
  const bad = await bot3.login('tester1', 'errada', false);
  assert.equal(bad.t, 'err');
  bot.close(); bot2.close(); bot3.close();
});

test('missão inicial, combate, experiência e saque', async () => {
  const bot = new Bot(srv.port);
  await bot.connect();
  await bot.login('quester');
  await bot.createAndEnter('Lutador', 'warrior');
  // aceita a primeira missão com Thalric
  const th = NPCS.thalric;
  await bot.walkTo(th.x, th.y + 1.5);
  bot.send({ t: 'qa', q: 'ms1' });
  await bot.wait((m) => m.t === 'quests' && m.a.ms1);
  // fala com Bran para cumprir o objetivo e entregar
  bot.chat(`/tp ${NPCS.bran.x} ${NPCS.bran.y + 1}`);
  await bot.waitType('pos');
  bot.send({ t: 'talk', n: 'bran' });
  await bot.wait((m) => m.t === 'quests' && m.a.ms1 && m.a.ms1.k[0] === 1);
  bot.send({ t: 'qc', q: 'ms1' });
  await bot.wait((m) => m.t === 'qdone' && m.q === 'ms1');
  bot.send({ t: 'qa', q: 'ms2' });
  await bot.wait((m) => m.t === 'quests' && m.a.ms2);

  // vai aos campos e ataca uma gosma
  bot.chat('/ir fields');
  await bot.waitType('world');
  bot.chat('/tp 22 26');
  await bot.waitType('pos');
  await sleep(300);
  const slime = [...bot.entities.values()].filter((e) => e.k === 'm' && e.m === 'slime')
    .sort((a, b) => Math.hypot(a.x - bot.x, a.y - bot.y) - Math.hypot(b.x - bot.x, b.y - bot.y))[0];
  assert.ok(slime, 'deve existir uma gosma por perto');
  const xpBefore = bot.state.me ? bot.state.me.xp : 0;
  let killed = false;
  for (let i = 0; i < 80 && !killed; i++) {
    const s = bot.entities.get(slime.id);
    if (!s || s.f & 1) { killed = true; break; }
    const d = Math.hypot(s.x - bot.x, s.y - bot.y);
    if (d > 1.4) {
      const step = Math.min(d - 1.0, 0.22);
      bot.x += ((s.x - bot.x) / d) * step; bot.y += ((s.y - bot.y) / d) * step;
      bot.send({ t: 'mv', x: bot.x, y: bot.y, d: 0, s: bot.posSeq });
    } else {
      bot.send({ t: 'atk', id: slime.id });
      bot.send({ t: 'sk', s: 'w_strike', id: slime.id });
    }
    await sleep(100);
  }
  assert.ok(killed, 'a gosma deveria morrer');
  const prog = await bot.wait((m) => m.t === 'qprog' && m.m.startsWith('Prova'));
  assert.match(prog.m, /1\/6/);
  await sleep(200);
  assert.ok(bot.state.me.xp > xpBefore, 'deve ganhar XP');
  bot.close();
});

test('grupo, chat e comércio entre jogadores', async () => {
  const a = new Bot(srv.port), b = new Bot(srv.port);
  await a.connect(); await b.connect();
  await a.login('partyA'); await b.login('partyB');
  await a.createAndEnter('Alfa', 'cleric');
  await b.createAndEnter('Beta', 'ranger');
  a.chat('/convidar Beta');
  const inv = await b.wait((m) => m.t === 'invite' && m.k === 'party');
  assert.equal(inv.f, 'Alfa');
  b.send({ t: 'party', op: 'accept' });
  const party = await a.wait((m) => m.t === 'party' && m.m && m.m.length === 2);
  assert.equal(party.m.length, 2);
  a.chat('/g olá grupo');
  const gm = await b.wait((m) => m.t === 'chat' && m.c === 'grupo' && m.f === 'Alfa');
  assert.equal(gm.m, 'olá grupo');
  // comércio: Alfa dá ouro para Beta
  a.chat('/ouro 500');
  await sleep(100);
  a.send({ t: 'trade', op: 'req', name: 'Beta' });
  await b.wait((m) => m.t === 'invite' && m.k === 'trade');
  b.send({ t: 'trade', op: 'accept' });
  await a.wait((m) => m.t === 'trade' && m.with === 'Beta');
  a.send({ t: 'trade', op: 'gold', gold: 200 });
  await sleep(100);
  a.send({ t: 'trade', op: 'ok' });
  b.send({ t: 'trade', op: 'ok' });
  await b.wait((m) => m.t === 'trade' && m.closed);
  await sleep(150);
  assert.equal(b.state.me.g, 25 + 200);
  a.close(); b.close();
});

test('mecânicas de chefe: Presa-de-Ferro usa habilidades', async () => {
  const bot = new Bot(srv.port);
  await bot.connect();
  await bot.login('bosser');
  await bot.createAndEnter('Tanque', 'warrior');
  bot.chat('/nivel 12');
  await sleep(200);
  bot.chat('/ir fields');
  await bot.waitType('world');
  bot.chat('/tp 90 78');
  await bot.waitType('pos');
  await sleep(400);
  const boss = [...bot.entities.values()].find((e) => e.k === 'm' && e.m === 'boar_boss');
  assert.ok(boss, 'chefe deve existir');
  bot.send({ t: 'atk', id: boss.id });
  // o chefe deve usar uma habilidade telegrafada em poucos segundos
  const tg = await bot.wait((m) => m.t === 'fx' && m.l.some((e) => e.k === 'tg' || e.k === 'ab'), 15000);
  assert.ok(tg);
  bot.close();
});
