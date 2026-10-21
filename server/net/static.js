// Servidor de arquivos estáticos para o cliente e o código compartilhado.
import fs from 'node:fs';
import path from 'node:path';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

export function createStaticHandler(mounts) {
  // mounts: [{ prefix: '/shared/', dir: '/abs/shared' }, { prefix: '/', dir: '/abs/client' }]
  return (req, res) => {
    let urlPath;
    try {
      urlPath = decodeURIComponent(req.url.split('?')[0]);
    } catch {
      res.writeHead(400); res.end(); return true;
    }
    for (const m of mounts) {
      if (!urlPath.startsWith(m.prefix)) continue;
      let rel = urlPath.slice(m.prefix.length);
      if (rel === '' || rel.endsWith('/')) rel += 'index.html';
      const file = path.normalize(path.join(m.dir, rel));
      if (!file.startsWith(m.dir)) { res.writeHead(403); res.end(); return true; }
      fs.stat(file, (err, st) => {
        if (err || !st.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('Não encontrado'); return; }
        res.writeHead(200, {
          'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
          'Content-Length': st.size,
          'Cache-Control': 'no-cache',
        });
        if (req.method === 'HEAD') { res.end(); return; }
        fs.createReadStream(file).pipe(res);
      });
      return true;
    }
    return false;
  };
}
