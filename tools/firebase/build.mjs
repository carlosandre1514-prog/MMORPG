// Gera client/vendor/firebase/firebase-auth.js (módulo ES minificado) a partir do SDK oficial do Firebase.
//   cd tools/firebase && npm install && node build.mjs
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '..', '..', 'client', 'vendor', 'firebase');
fs.mkdirSync(OUT, { recursive: true });
const r = await build({
  entryPoints: [path.join(HERE, 'entry.js')],
  bundle: true, format: 'esm', minify: true, target: 'es2020', platform: 'browser',
  outfile: path.join(OUT, 'firebase-auth.js'), legalComments: 'none', metafile: true, logLevel: 'warning',
  define: { 'process.env.NODE_ENV': '"production"' },
});
const pkg = JSON.parse(fs.readFileSync(path.join(HERE, 'node_modules', 'firebase', 'package.json'), 'utf8'));
// (client/vendor/firebase/LICENSE guarda o texto da Apache-2.0; o pacote npm não traz o arquivo)
fs.writeFileSync(path.join(OUT, 'VERSION.txt'), `Firebase JS SDK ${pkg.version} (Apache-2.0), módulos app e auth, empacotado por tools/firebase/build.mjs\n`);
console.log('gravado', path.join(OUT, 'firebase-auth.js'), (fs.statSync(path.join(OUT, 'firebase-auth.js')).size / 1024).toFixed(0) + ' KB, firebase ' + pkg.version);
