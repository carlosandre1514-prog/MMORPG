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
  // os primeiros níveis são curtos: um nível a mais também conta como XP ganho
  const progress = (me) => (me ? me.lv * 1e9 + me.xp : 0);
  const xpBefore = progress(bot.state.me);
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
  assert.ok(progress(bot.state.me) > xpBefore, 'deve ganhar XP');
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

test('loja, criação, aprimoramento, baú e viagem', async () => {
  const bot = new Bot(srv.port);
  await bot.connect();
  await bot.login('crafter');
  await bot.createAndEnter('Artesao', 'mage');
  bot.chat('/ouro 3000');
  bot.chat('/nivel 20');
  await sleep(200);
  // compra com Otto
  bot.chat(`/tp ${NPCS.otto.x} ${NPCS.otto.y + 1.5}`);
  await bot.waitType('pos');
  bot.send({ t: 'buy', n: 'otto', i: 'pot_mp_1', q: 4 });
  await bot.wait((m) => m.t === 'inv' && m.l.some((it) => it && it.id === 'pot_mp_1' && it.q >= 9));
  // alquimia com Fenwick
  bot.chat('/item mat_slime 2'); bot.chat('/item mat_herb 1');
  bot.chat(`/tp ${NPCS.fenwick.x} ${NPCS.fenwick.y + 1.5}`);
  await bot.waitType('pos');
  bot.send({ t: 'craft', n: 'fenwick', r: 'r_pot_hp_2' });
  const cr = await bot.waitType('crafted');
  assert.equal(cr.i, 'pot_hp_2');
  // aprimoramento com Brunhilda (+1 nunca falha)
  bot.chat('/item enh_stone 2');
  bot.chat(`/tp ${NPCS.brunhilda.x} ${NPCS.brunhilda.y + 1.5}`);
  await bot.waitType('pos');
  bot.send({ t: 'enh', n: 'brunhilda', src: 'eq', slot: 'weapon' });
  const en = await bot.waitType('enhres');
  assert.ok(en.ok);
  assert.equal(en.p, 1);
  // baú com Marta
  bot.chat(`/tp ${NPCS.marta.x} ${NPCS.marta.y + 1.5}`);
  await bot.waitType('pos');
  await sleep(150);
  const slot = bot.state.inv.findIndex((it) => it && it.id === 'scroll_return');
  bot.send({ t: 'stash', n: 'marta', op: 'put', slot });
  await bot.wait((m) => m.t === 'stash' && m.l.some((it) => it && it.id === 'scroll_return'));
  // viagem: só destinos visitados
  bot.chat(`/tp ${NPCS.ilyas.x} ${NPCS.ilyas.y + 1.5}`);
  await bot.waitType('pos');
  bot.send({ t: 'tp', n: 'ilyas', z: 'forest' });
  const err = await bot.wait((m) => m.t === 'msg' && m.k === 'err');
  assert.match(err.m, /descobriu/);
  bot.close();
});

test('morte, penalidade e renascimento na vila', async () => {
  const bot = new Bot(srv.port);
  await bot.connect();
  await bot.login('dier');
  await bot.createAndEnter('Fragil', 'mage');
  bot.chat('/ir ruins');
  await bot.waitType('world');
  bot.chat('/tp 66 26');
  const dead = await bot.waitType('dead', 30000);
  assert.ok(dead);
  bot.send({ t: 'resp' });
  const w = await bot.waitType('world');
  assert.equal(w.zone.id, 'town');
  bot.close();
});

test('clã: fundar, convidar e conversar', async () => {
  const a = new Bot(srv.port), b = new Bot(srv.port);
  await a.connect(); await b.connect();
  await a.login('guildA'); await b.login('guildB');
  await a.createAndEnter('Lider', 'warrior');
  await b.createAndEnter('Membro', 'ranger');
  a.chat('/ouro 1000');
  await sleep(100);
  a.send({ t: 'guild', op: 'create', name: 'Lobos de Prata' });
  await a.wait((m) => m.t === 'guild' && m.name === 'Lobos de Prata');
  a.send({ t: 'guild', op: 'invite', name: 'Membro' });
  await b.wait((m) => m.t === 'invite' && m.k === 'guild');
  b.send({ t: 'guild', op: 'accept' });
  await b.wait((m) => m.t === 'guild' && m.m && m.m.length === 2);
  a.chat('/c bem-vindo');
  const msg = await b.wait((m) => m.t === 'chat' && m.c === 'cla' && m.f === 'Lider');
  assert.equal(msg.m, 'bem-vindo');
  a.close(); b.close();
});

test('persistência: o personagem volta com o progresso', async () => {
  const bot = new Bot(srv.port);
  await bot.connect();
  await bot.login('persist');
  await bot.createAndEnter('Memoria', 'cleric');
  bot.chat('/nivel 7');
  bot.chat('/ouro 777');
  await sleep(300);
  bot.close();
  await sleep(300);
  const again = new Bot(srv.port);
  await again.connect();
  const chars = await again.login('persist', 'senha123', false);
  assert.equal(chars.list[0].level, 7);
  again.send({ t: 'enter', id: chars.list[0].id });
  const w = await again.waitType('world');
  assert.equal(w.you.char.gold, 25 + 777);
  again.close();
});

test('servidor de arquivos: caminho com byte nulo é recusado sem derrubar o servidor e o gzip funciona', async () => {
  const http = await import('node:http');
  const get = (path, headers = {}) => new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: srv.port, path, headers }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.on('error', reject);
    req.end();
  });
  assert.equal((await get('/%00')).status, 400);
  assert.equal((await get('/shared/%00')).status, 400);
  const page = await get('/', { 'accept-encoding': 'gzip' });
  assert.equal(page.status, 200);
  assert.equal(page.headers['content-encoding'], 'gzip');
  const again = await get('/', { 'if-none-match': page.headers.etag });
  assert.equal(again.status, 304);
  assert.equal((await get('/kaykit/medieval/medieval.glb')).status, 200);
  assert.equal((await get('/nao-existe.png')).status, 404);
});
