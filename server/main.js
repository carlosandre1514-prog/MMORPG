// Ponto de entrada do servidor: HTTP (cliente estático) + WebSocket (jogo).
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WSServer } from './net/websocket.js';
import { createStaticHandler } from './net/static.js';
import { Database } from './db.js';
import { World } from './world.js';
import { Session } from './session.js';
import { GAME_NAME } from '../shared/constants.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function startServer(opts = {}) {
  const port = opts.port ?? Number(process.env.PORT || 3000);
  const dataDir = opts.dataDir ?? process.env.DATA_DIR ?? path.join(ROOT, 'save');
  const dev = opts.dev ?? (process.env.DEV === '1' || process.env.DEV === 'true');
  const xpRate = opts.xpRate ?? Number(process.env.XP_RATE || 1);
  const db = new Database(dataDir);
  const world = new World(db, { dev, xpRate });
  const serveStatic = createStaticHandler([
    { prefix: '/shared/', dir: path.join(ROOT, 'shared') },
    { prefix: '/kaykit/', dir: path.join(ROOT, 'assets', 'kaykit') },
    { prefix: '/village/', dir: path.join(ROOT, 'assets', 'village') },
    { prefix: '/', dir: path.join(ROOT, 'client') },
  ]);
  const server = http.createServer((req, res) => {
    if (req.url === '/status') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ online: world.players.size, uptime: Math.round((Date.now() - world.started) / 1000) }));
      return;
    }
    if (!serveStatic(req, res)) { res.writeHead(404); res.end(); }
  });
  const wss = new WSServer(server, { path: '/ws' });
  wss.on('connection', (conn) => new Session(world, conn));
  world.start();
  return new Promise((resolve) => {
    server.listen(port, opts.host ?? '0.0.0.0', () => {
      const actual = server.address().port;
      if (!opts.quiet) {
        console.log(`\n  ${GAME_NAME}`);
        console.log(`  Servidor rodando em http://localhost:${actual}`);
        console.log(`  Dados salvos em ${dataDir}`);
        console.log(`  Modo DEV: ${dev ? 'ATIVADO (comandos /nivel, /ouro, /item, /ir...)' : 'desativado'} | Taxa de XP: ${xpRate}x\n`);
      }
      resolve({
        port: actual, world, db, server,
        close: () => new Promise((r) => { world.stop(); wss.close(); server.close(() => r()); setTimeout(r, 500); }),
      });
    });
  });
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const srv = await startServer();
  const shutdown = async () => {
    console.log('\n[server] salvando e encerrando...');
    await srv.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
