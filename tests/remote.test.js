// Persistência remota (Supabase/PostgREST): um servidor "novo", com disco vazio, recupera contas e personagens.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { bootServer, Bot, sleep } from './helpers.js';

// Simula o PostgREST do Supabase: GET filtra por id, POST faz upsert
function fakeSupabase() {
  const rows = new Map();
  const server = http.createServer((req, res) => {
    if (req.headers.apikey !== 'chave-teste' || req.headers.authorization !== 'Bearer chave-teste') { res.writeHead(401); res.end('{}'); return; }
    const url = new URL(req.url, 'http://x');
    if (req.method === 'GET') {
      const id = (url.searchParams.get('id') || '').replace(/^eq\./, '');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(rows.has(id) ? [{ data: rows.get(id) }] : []));
      return;
    }
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      for (const r of JSON.parse(body)) rows.set(r.id, r.data);
      res.writeHead(201); res.end();
    });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ rows, url: `http://127.0.0.1:${server.address().port}`, close: () => server.close() })));
}

test('estado salvo no Supabase sobrevive a um servidor novo com disco vazio', async () => {
  const sb = await fakeSupabase();
  const remote = { url: sb.url, key: 'chave-teste' };
  const a = await bootServer({ remote });
  const bot = new Bot(a.port);
  await bot.connect();
  await bot.login('remota');
  await bot.createAndEnter('Nuvem', 'mage');
  bot.chat('/ouro 321');
  await sleep(300);
  bot.close();
  await sleep(300);
  await a.close(); // salva e espera o envio remoto
  assert.ok(sb.rows.get('world'), 'o estado foi enviado ao Supabase');
  assert.ok(sb.rows.get('world').accounts.remota);

  const b = await bootServer({ remote }); // outro diretório, vazio
  const again = new Bot(b.port);
  await again.connect();
  const chars = await again.login('remota', 'senha123', false);
  assert.equal(chars.list[0].name, 'Nuvem');
  again.send({ t: 'enter', id: chars.list[0].id });
  const w = await again.waitType('world');
  assert.equal(w.you.char.gold, 25 + 321);
  again.close();
  await b.close();
  sb.close();
});

test('chave errada: o servidor se recusa a subir em vez de começar vazio e apagar os dados', async () => {
  const sb = await fakeSupabase();
  await assert.rejects(() => bootServer({ remote: { url: sb.url, key: 'errada' } }), /401/);
  sb.close();
});
