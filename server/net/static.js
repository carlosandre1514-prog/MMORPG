// Servidor de arquivos estáticos para o cliente e o código compartilhado.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { pipeline } from 'node:stream';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.bin': 'application/octet-stream',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

// Tipos que valem a pena comprimir (os modelos 3D e o Three.js encolhem bastante com gzip)
const COMPRESSIBLE = new Set(['.html', '.js', '.mjs', '.css', '.json', '.glb', '.gltf', '.bin', '.svg']);
const gzCache = new Map(); // arquivo -> { mtimeMs, size, data }

function gzipped(file, st, cb) {
  const c = gzCache.get(file);
  if (c && c.mtimeMs === st.mtimeMs && c.size === st.size) { cb(null, c.data); return; }
  fs.readFile(file, (err, raw) => {
    if (err) { cb(err); return; }
    zlib.gzip(raw, { level: 6 }, (err2, data) => {
      if (err2) { cb(err2); return; }
      gzCache.set(file, { mtimeMs: st.mtimeMs, size: st.size, data });
      cb(null, data);
    });
  });
}

export function createStaticHandler(mounts) {
  // mounts: [{ prefix: '/shared/', dir: '/abs/shared' }, { prefix: '/', dir: '/abs/client' }]
  return (req, res) => {
    let urlPath;
    try {
      urlPath = decodeURIComponent(req.url.split('?')[0]);
    } catch {
      res.writeHead(400); res.end(); return true;
    }
    // bytes nulos fariam fs.stat lançar e derrubar o servidor
    if (urlPath.includes('\0')) { res.writeHead(400); res.end(); return true; }
    for (const m of mounts) {
      if (!urlPath.startsWith(m.prefix)) continue;
      let rel = urlPath.slice(m.prefix.length);
      if (rel === '' || rel.endsWith('/')) rel += 'index.html';
      const file = path.normalize(path.join(m.dir, rel));
      if (!file.startsWith(m.dir)) { res.writeHead(403); res.end(); return true; }
      fs.stat(file, (err, st) => {
        if (err || !st.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('Não encontrado'); return; }
        const type = MIME[path.extname(file)] || 'application/octet-stream';
        const etag = `W/"${st.size.toString(36)}-${Math.floor(st.mtimeMs).toString(36)}"`;
        if (req.headers['if-none-match'] === etag) { res.writeHead(304, { ETag: etag, 'Cache-Control': 'no-cache' }); res.end(); return; }
        const head = { 'Content-Type': type, 'Cache-Control': 'no-cache', ETag: etag };
        const gz = COMPRESSIBLE.has(path.extname(file)) && st.size > 1024 && /\bgzip\b/.test(req.headers['accept-encoding'] || '');
        if (!gz) {
          res.writeHead(200, { ...head, 'Content-Length': st.size });
          if (req.method === 'HEAD') { res.end(); return; }
          // pipeline fecha o arquivo se o cliente abortar o download no meio
          pipeline(fs.createReadStream(file), res, () => {});
          return;
        }
        gzipped(file, st, (e, data) => {
          if (e) { res.writeHead(500); res.end(); return; }
          res.writeHead(200, { ...head, 'Content-Encoding': 'gzip', 'Content-Length': data.length, Vary: 'Accept-Encoding' });
          res.end(req.method === 'HEAD' ? undefined : data);
        });
      });
      return true;
    }
    return false;
  };
}
