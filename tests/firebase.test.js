// Login pelo Firebase Authentication: conferência do token (server/firebase.js) e a entrada pelo servidor (mensagem fblogin).
// Os tokens são gerados aqui com uma chave de teste; o certificado e a chave de tests/fixtures são só para teste (não valem em lugar nenhum).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createVerifier, fetchGoogleCerts, AuthError } from '../server/firebase.js';
import { bootServer, Bot } from './helpers.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = 'projeto-teste';
const NOW = 1_800_000_000;
const clock = () => NOW;

const pair = () => crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const KEY_A = pair(), KEY_B = pair();

function sign(payload, { key = KEY_A.privateKey, kid = 'kidA', alg = 'RS256', raw = null } = {}) {
  const b = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const data = `${b({ alg, kid, typ: 'JWT' })}.${b(payload)}`;
  return `${data}.${raw ?? crypto.sign('RSA-SHA256', Buffer.from(data), key).toString('base64url')}`;
}
const claims = (extra = {}) => ({
  iss: `https://securetoken.google.com/${PROJECT}`, aud: PROJECT, auth_time: NOW - 100, iat: NOW - 60, exp: NOW + 3000, sub: 'uidAbC123',
  email: 'heroi@exemplo.com', email_verified: true, firebase: { sign_in_provider: 'password', identities: {} }, ...extra,
});
function verifier(keys = { kidA: KEY_A.publicKey }) {
  const calls = { n: 0 };
  const v = createVerifier({ projectId: PROJECT, clock, fetchKeys: async () => { calls.n++; return { keys: new Map(Object.entries(keys)), ttl: 3600 }; } });
  return { v, calls };
}

test('token válido: devolve uid, e-mail, provedor e confirmação de e-mail', async () => {
  const { v, calls } = verifier();
  const who = await v.verify(sign(claims()));
  assert.deepEqual(who, { uid: 'uidAbC123', email: 'heroi@exemplo.com', emailVerified: true, name: null, provider: 'password' });
  const g = await v.verify(sign(claims({ sub: 'g1', name: 'Fulana', email_verified: false, firebase: { sign_in_provider: 'google.com' } })));
  assert.equal(g.provider, 'google.com');
  assert.equal(g.name, 'Fulana');
  assert.equal(g.emailVerified, false);
  assert.equal(calls.n, 1, 'as chaves ficam em cache');
});

test('token inválido é recusado: expirado, projeto errado, assinatura falsa, algoritmo trocado, campos ruins', async () => {
  const { v } = verifier();
  const rejects = async (token, code, why) => {
    await assert.rejects(() => v.verify(token), (e) => e instanceof AuthError && e.code === code, why);
  };
  await rejects(sign(claims({ exp: NOW - 1 })), 'expired', 'expirado');
  await rejects(sign(claims({ exp: NOW })), 'expired', 'expira agora');
  await rejects(sign(claims({ aud: 'outro-projeto' })), 'invalid', 'projeto (aud) errado');
  await rejects(sign(claims({ iss: 'https://securetoken.google.com/outro-projeto' })), 'invalid', 'emissor errado');
  await rejects(sign(claims({ iss: 'https://accounts.google.com' })), 'invalid', 'emissor de outro tipo de token');
  await rejects(sign(claims(), { key: KEY_B.privateKey }), 'invalid', 'assinada por outra chave');
  await rejects(sign(claims(), { alg: 'none', raw: '' }), 'invalid', 'alg none');
  await rejects(sign(claims(), { alg: 'HS256' }), 'invalid', 'HS256');
  await rejects(sign(claims({ sub: '' })), 'invalid', 'uid vazio');
  await rejects(sign(claims({ sub: 'x'.repeat(129) })), 'invalid', 'uid enorme');
  await rejects(sign(claims({ sub: 123 })), 'invalid', 'uid não é texto');
  await rejects(sign(claims({ iat: NOW + 3600 })), 'invalid', 'emitido no futuro');
  await rejects(sign(claims({ auth_time: NOW + 3600 })), 'invalid', 'autenticado no futuro');
  await rejects(sign(claims({ exp: 'amanhã' })), 'invalid', 'exp não numérico');
  const ok = sign(claims());
  const [h, p, s] = ok.split('.');
  await rejects(`${h}.${Buffer.from(JSON.stringify({ ...claims(), sub: 'outro' })).toString('base64url')}.${s}`, 'invalid', 'corpo adulterado');
  await rejects(`${h}.${p}`, 'invalid', 'sem assinatura');
  await rejects('lixo', 'invalid', 'não é JWT');
  await rejects('a.b.c', 'invalid', 'base64 inútil');
  await rejects('x'.repeat(9000), 'invalid', 'grande demais');
  await rejects(undefined, 'invalid', 'sem token');
  await rejects({ t: 1 }, 'invalid', 'objeto no lugar do texto');
});

test('chave desconhecida: busca de novo uma vez e não deixa ninguém forçar downloads em série', async () => {
  const { v, calls } = verifier();
  await v.verify(sign(claims()));
  assert.equal(calls.n, 1);
  const stranger = sign(claims(), { kid: 'kidX' });
  await assert.rejects(() => v.verify(stranger), (e) => e.code === 'invalid');
  assert.equal(calls.n, 1, 'dentro de 20 s não busca de novo (relógio parado)');
  // a chave rodou: o Google passa a publicar kidB; com o relógio andando, a busca acontece e o token vale
  let now = NOW;
  const keys = { kidA: KEY_A.publicKey };
  let n = 0;
  const v2 = createVerifier({ projectId: PROJECT, clock: () => now, fetchKeys: async () => { n++; return { keys: new Map(Object.entries(keys)), ttl: 3600 }; } });
  await v2.verify(sign(claims()));
  keys.kidB = KEY_B.publicKey;
  now += 30;
  const who = await v2.verify(sign(claims({ iat: now - 10, exp: now + 3000 }), { key: KEY_B.privateKey, kid: 'kidB' }));
  assert.equal(who.uid, 'uidAbC123');
  assert.equal(n, 2);
});

test('Google fora do ar: sem chaves guardadas dá erro de indisponível; com chaves antigas continua funcionando', async () => {
  const down = createVerifier({ projectId: PROJECT, clock, fetchKeys: async () => { throw new Error('rede'); } });
  await assert.rejects(() => down.verify(sign(claims())), (e) => e.code === 'unavailable');
  let now = NOW, fail = false;
  const v = createVerifier({ projectId: PROJECT, clock: () => now, fetchKeys: async () => { if (fail) throw new Error('rede'); return { keys: new Map([['kidA', KEY_A.publicKey]]), ttl: 120 }; } });
  await v.verify(sign(claims()));
  fail = true; now += 500; // as chaves venceram e a busca falha
  const who = await v.verify(sign(claims({ iat: now - 10, exp: now + 3000 })));
  assert.equal(who.uid, 'uidAbC123');
});

test('certificados do Google (X.509 em PEM) viram chaves públicas e o max-age vira o prazo', async () => {
  const pem = fs.readFileSync(path.join(HERE, 'fixtures/firebase-test-cert.pem'), 'utf8');
  const priv = crypto.createPrivateKey(fs.readFileSync(path.join(HERE, 'fixtures/firebase-test-key.pem')));
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ kidCert: pem }), { status: 200, headers: { 'cache-control': 'public, max-age=19000, must-revalidate', 'content-type': 'application/json' } });
  try {
    const r = await fetchGoogleCerts();
    assert.equal(r.ttl, 19000);
    assert.ok(r.keys.has('kidCert'));
    const v = createVerifier({ projectId: PROJECT, clock, fetchKeys: fetchGoogleCerts });
    assert.equal((await v.verify(sign(claims(), { key: priv, kid: 'kidCert' }))).uid, 'uidAbC123');
    globalThis.fetch = async () => new Response('erro', { status: 503 });
    await assert.rejects(() => fetchGoogleCerts(), /HTTP 503/);
  } finally { globalThis.fetch = realFetch; }
});

// ---------------------------------------------------------------- pelo servidor
async function withServer(opts, fn) {
  const { v } = verifier();
  const srv = await bootServer({ firebase: v, ...opts });
  try { await fn(srv); } finally { await srv.close(); }
}
const tokenFor = (uid, extra = {}) => sign(claims({ sub: uid, email: `${uid}@exemplo.com`, ...extra }));

test('fblogin: cria a conta no primeiro acesso, guarda os personagens e separa uma pessoa da outra', async () => {
  await withServer({}, async (srv) => {
    // o relógio do verificador é fixo em NOW; o servidor usa o mesmo
    const a = new Bot(srv.port); await a.connect();
    const hello = await (async () => { a.send({ t: 'hello' }); return a.waitType('hello'); })();
    assert.equal(hello.fb, true);
    a.send({ t: 'fblogin', token: tokenFor('ana') });
    const c1 = await a.wait((m) => m.t === 'chars' || m.t === 'err');
    assert.equal(c1.t, 'chars');
    assert.equal(c1.user, 'ana@exemplo.com');
    assert.deepEqual(c1.list, []);
    const id = await a.createAndEnter('Anabela');
    assert.ok(id);
    a.close();
    await new Promise((r) => setTimeout(r, 150));
    // mesma pessoa de novo: os personagens estão lá
    const a2 = new Bot(srv.port); await a2.connect();
    a2.send({ t: 'fblogin', token: tokenFor('ana') });
    const c2 = await a2.wait((m) => m.t === 'chars');
    assert.equal(c2.list.length, 1);
    assert.equal(c2.list[0].name, 'Anabela');
    // outra pessoa: lista vazia
    const b = new Bot(srv.port); await b.connect();
    b.send({ t: 'fblogin', token: tokenFor('beto') });
    assert.deepEqual((await b.wait((m) => m.t === 'chars')).list, []);
    assert.equal(Object.keys(srv.db.data.accounts).filter((k) => k.startsWith('fb:')).length, 2);
    a2.close(); b.close();
  });
});

test('fblogin: token ruim é recusado, tentativas demais bloqueiam e o login antigo não alcança contas do Firebase', async () => {
  await withServer({}, async (srv) => {
    const bot = new Bot(srv.port); await bot.connect();
    bot.send({ t: 'fblogin', token: 'lixo' });
    assert.match((await bot.wait((m) => m.t === 'err')).m, /Login inválido/);
    bot.send({ t: 'fblogin', token: sign(claims({ exp: NOW - 5 })) });
    assert.match((await bot.wait((m) => m.t === 'err')).m, /expirou/);
    bot.send({ t: 'fblogin' });
    await bot.wait((m) => m.t === 'err');
    // conta do Firebase não tem senha: tentar o login antigo com o nome interno não pode derrubar o servidor nem entrar
    const ok = new Bot(srv.port); await ok.connect();
    ok.send({ t: 'fblogin', token: tokenFor('carla') });
    await ok.wait((m) => m.t === 'chars');
    const key = Object.keys(srv.db.data.accounts).find((k) => k.startsWith('fb:'));
    assert.ok(key);
    const legacy = new Bot(srv.port); await legacy.connect();
    legacy.send({ t: 'login', user: key, pass: 'qualquer' });
    assert.match((await legacy.wait((m) => m.t === 'err')).m, /incorretos/);
    // limite de tentativas ruins por conexão
    for (let i = 0; i < 8; i++) { bot.send({ t: 'fblogin', token: 'x' }); await bot.wait((m) => m.t === 'err'); }
    bot.send({ t: 'fblogin', token: tokenFor('dora') });
    assert.match((await bot.wait((m) => m.t === 'err')).m, /Muitas tentativas/);
    ok.close(); legacy.close(); bot.close();
  });
});

test('o login antigo (usuário e senha) continua funcionando ao lado do Firebase', async () => {
  await withServer({}, async (srv) => {
    const bot = new Bot(srv.port); await bot.connect();
    const r = await bot.login('veterano');
    assert.equal(r.t, 'chars');
    assert.equal(r.user, 'veterano');
    bot.close();
  });
});

test('FIREBASE_REQUIRE_VERIFIED: e-mail e senha só entram com o e-mail confirmado; Google entra sempre', async () => {
  await withServer({ requireVerifiedEmail: true }, async (srv) => {
    const bot = new Bot(srv.port); await bot.connect();
    bot.send({ t: 'fblogin', token: tokenFor('erica', { email_verified: false }) });
    assert.match((await bot.wait((m) => m.t === 'err')).m, /Confirme seu e-mail/);
    bot.send({ t: 'fblogin', token: tokenFor('erica', { email_verified: true }) });
    assert.equal((await bot.wait((m) => m.t === 'chars')).list.length, 0);
    const g = new Bot(srv.port); await g.connect();
    g.send({ t: 'fblogin', token: tokenFor('gabi', { email_verified: false, firebase: { sign_in_provider: 'google.com' } }) });
    await g.wait((m) => m.t === 'chars');
    bot.close(); g.close();
  });
});

test('com o Firebase ligado fora do modo DEV, criar conta por usuário e senha é recusado; contas antigas ainda entram', async () => {
  await withServer({ dev: false }, async (srv) => {
    srv.db.data.accounts.veterano = { username: 'veterano', chars: [], created: 1 };
    const bot = new Bot(srv.port); await bot.connect();
    bot.send({ t: 'register', user: 'intruso', pass: 'senha123' });
    assert.match((await bot.wait((m) => m.t === 'err')).m, /e-mail ou o Google/);
    assert.equal(srv.db.data.accounts.intruso, undefined);
    bot.send({ t: 'hello' });
    const hello = await bot.waitType('hello');
    assert.equal(hello.fb, true);
    assert.equal(hello.dev, false);
    bot.close();
  });
});

test('com o Firebase desligado no servidor, fblogin explica e o hello avisa o cliente', async () => {
  const srv = await bootServer({ firebase: false });
  try {
    const bot = new Bot(srv.port); await bot.connect();
    bot.send({ t: 'hello' });
    assert.equal((await bot.waitType('hello')).fb, false);
    bot.send({ t: 'fblogin', token: 'x' });
    assert.match((await bot.wait((m) => m.t === 'err')).m, /não está disponível/);
    bot.close();
  } finally { await srv.close(); }
});
