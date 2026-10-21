// Converte o Medieval Village MegaKit (Quaternius, CC0) em assets/village/: village.glb (geometria das
// peças, uma malha por material) e textures/*.jpg (texturas reduzidas).
// Uso: node tools/village/convert.mjs <pasta-com-os-fbx-e-texturas> [folha.png]
// Requer o three em tools/bake/node_modules (cd tools/bake && npm install) e Playwright com Chromium.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = path.resolve(process.argv[2] || '');
const SHEET = process.argv[3];
const OUT = path.join(ROOT, 'assets', 'village');
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/node-tools/node_modules/playwright')); }

// Texturas usadas pelo jogo: [arquivo no pack, tamanho, PNG com transparência?]
const TEXTURES = {
  Plaster: { color: 'T_Plaster_BaseColor.png', normal: 'T_Plaster_Normal.png' },
  UnevenBrick: { color: 'T_UnevenBrick_BaseColor.png', normal: 'T_UnevenBrick_Normal.png' },
  Brick: { color: 'T_Brick_BaseColor.png', normal: 'T_Brick_Normal.png' },
  RoundTiles: { color: 'T_RoundTiles_BaseColor.png', normal: 'T_RoundTiles_Normal.png' },
  RockTrim: { color: 'T_RockTrim_BaseColor.png', normal: 'T_RockTrim_Normal.png' },
  WoodTrim: { color: 'T_WoodTrim_BaseColor.png', normal: 'T_WoodTrim_Normal.png' },
  Vine: { color: 'T_VineLeaf.png', png: true },
};
const TEX_SIZE = 512;

// Peças usadas pelo montador de prédios (client/js/three/village.js)
const KEEP = [
  'Wall_UnevenBrick_Straight', 'Wall_UnevenBrick_Door_Round', 'Wall_UnevenBrick_Door_Flat', 'Wall_UnevenBrick_Window_Wide_Round',
  'Wall_UnevenBrick_Window_Wide_Flat', 'Wall_UnevenBrick_Window_Thin_Round',
  'Wall_Plaster_Straight', 'Wall_Plaster_Straight_L', 'Wall_Plaster_Straight_R', 'Wall_Plaster_WoodGrid', 'Wall_Plaster_Door_Round',
  'Wall_Plaster_Door_Flat', 'Wall_Plaster_Window_Wide_Round', 'Wall_Plaster_Window_Wide_Flat', 'Wall_Plaster_Window_Thin_Round', 'Wall_Arch',
  'Corner_Exterior_Wood', 'Door_1_Round', 'Door_1_Flat',
  'Window_Wide_Round1', 'Window_Wide_Flat1', 'Window_Thin_Round1',
  'WindowShutters_Wide_Round_Open', 'WindowShutters_Wide_Flat_Open', 'WindowShutters_Thin_Round_Open',
  'Roof_RoundTiles_4x4', 'Roof_RoundTiles_4x6', 'Roof_RoundTiles_6x6', 'Roof_RoundTiles_6x8', 'Roof_RoundTiles_6x10',
  'Roof_RoundTiles_8x10', 'Roof_RoundTiles_8x12', 'Roof_RoundTiles_8x14',
  'Roof_Front_Brick4', 'Roof_Front_Brick6', 'Roof_Front_Brick8',
  'Prop_Chimney', 'Prop_Chimney2', 'Prop_Vine1', 'Prop_Vine2', 'Prop_Vine4',
];
const all = fs.readdirSync(SRC).filter((f) => f.toLowerCase().endsWith('.fbx')).sort();
if (!all.length) { console.error('Nenhum .fbx em', SRC); process.exit(1); }
const only = process.env.PIECES ? new RegExp(process.env.PIECES) : null;
const files = only ? all.filter((f) => only.test(f)) : KEEP.map((k) => k + '.fbx').filter((f) => all.includes(f) || console.warn('Peça não encontrada no pack:', f));

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.fbx': 'application/octet-stream' };
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  const [base, rel] = url.startsWith('/src/') ? [SRC, url.slice(5)] : [ROOT, url];
  const p = path.normalize(path.join(base, rel));
  if (!p.startsWith(base) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(p).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage();
page.on('console', (m) => console.log('[página]', m.text()));
page.on('pageerror', (e) => console.error('[erro]', e.message));
await page.goto(`http://127.0.0.1:${server.address().port}/tools/village/convert.html`);
await page.waitForFunction(() => window.convertReady === true, null, { timeout: 30000 });
console.log(`Convertendo ${files.length} peças...`);
const result = await page.evaluate(([f]) => window.runConvert(f), [files]);
fs.mkdirSync(path.join(OUT, 'textures'), { recursive: true });
const glb = Buffer.from(result.glb, 'base64');
fs.writeFileSync(path.join(OUT, 'village.glb'), glb);
fs.writeFileSync(path.join(OUT, 'pieces.json'), JSON.stringify({ materials: result.matInfo, pieces: result.pieces }, null, 1));
console.log(`village.glb: ${(glb.length / 1024).toFixed(0)} KB`);
for (const [key, t] of Object.entries(TEXTURES)) {
  for (const kind of ['color', 'normal']) {
    if (!t[kind]) continue;
    const png = !!t.png;
    const data = await page.evaluate(([f, s, p]) => window.shrinkTexture(f, s, p), [t[kind], TEX_SIZE, png]);
    const out = path.join(OUT, 'textures', `${key}_${kind}.${png ? 'png' : 'jpg'}`);
    fs.writeFileSync(out, Buffer.from(data.split(',')[1], 'base64'));
  }
}
console.log('Texturas salvas em', path.join(OUT, 'textures'));
if (SHEET) {
  const names = Object.keys(result.pieces);
  const tex = Object.fromEntries(Object.entries(TEXTURES).map(([k, t]) => [k, t.color]));
  const png = await page.evaluate(([n, t]) => window.contactSheet(n, Math.min(10, n.length), 200, t), [names, tex]);
  fs.writeFileSync(SHEET, Buffer.from(png.split(',')[1], 'base64'));
  console.log('Folha de contato:', SHEET);
}
await browser.close();
server.close();
