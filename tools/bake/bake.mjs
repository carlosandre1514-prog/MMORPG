// Gera as spritesheets dos personagens KayKit (assets/kaykit) em client/assets/sprites.
// Uso: cd tools/bake && npm install && node bake.mjs
// Requer Playwright com Chromium (npx playwright install chromium) — o Three.js renderiza via WebGL.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = path.join(ROOT, 'client', 'assets', 'sprites');
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/node-tools/node_modules/playwright')); }

// Personagem 3D -> chave usada no jogo
export const CONFIGS = [
  { key: 'warrior', model: 'Barbarian', right: 'axe_2handed' },
  { key: 'mage', model: 'Mage', right: 'staff' },
  { key: 'ranger', model: 'Ranger', left: 'bow_withString' },
  { key: 'cleric', model: 'Knight', right: 'sword_1handed', left: 'shield_badge_color' },
  { key: 'rogue', model: 'Rogue', right: 'dagger', left: 'dagger' },
  { key: 'hooded', model: 'Rogue_Hooded', right: 'dagger' },
  { key: 'cultist', model: 'Rogue_Hooded', right: 'wand', left: 'spellbook_open', filter: 'hue-rotate(150deg) saturate(0.9) brightness(0.75)' },
  { key: 'ashknight', model: 'Knight', right: 'sword_1handed', left: 'shield_badge_color', filter: 'grayscale(0.7) brightness(0.5) sepia(0.5) hue-rotate(-25deg) contrast(1.2)' },
];

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const p = path.normalize(path.join(ROOT, decodeURIComponent(req.url.split('?')[0])));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage();
page.on('console', (m) => console.log('[página]', m.text()));
page.on('pageerror', (e) => console.error('[erro]', e.message));
await page.goto(`http://127.0.0.1:${port}/tools/bake/bake.html`);
await page.waitForFunction(() => window.bakeReady === true, null, { timeout: 30000 });
const only = process.argv.slice(2);
const configs = only.length ? CONFIGS.filter((c) => only.includes(c.key)) : CONFIGS;
console.log('Renderizando', configs.map((c) => c.key).join(', '), '...');
const result = await page.evaluate(([cfgs]) => window.runBake(cfgs, '/assets/kaykit'), [configs]);
fs.mkdirSync(OUT, { recursive: true });
const manifestPath = path.join(OUT, 'manifest.json');
const manifest = fs.existsSync(manifestPath) && only.length ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : { sprites: {} };
Object.assign(manifest, { frame: result.frame, anchorX: result.anchorX, anchorY: result.anchorY, dirs: result.dirs });
for (const [key, s] of Object.entries(result.sprites)) {
  fs.writeFileSync(path.join(OUT, key + '.webp'), Buffer.from(s.png.split(',')[1], 'base64'));
  manifest.sprites[key] = { file: key + '.webp', anims: s.anims };
  console.log('  ✔', key);
}
manifest.credit = 'Personagens: KayKit Adventurers 2.0 por Kay Lousberg (www.kaylousberg.com), licença CC0.';
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
await browser.close();
server.close();
console.log('Spritesheets salvas em', OUT);
