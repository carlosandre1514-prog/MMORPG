// Converte packs KayKit (CC0) em um único GLB compacto por pack, com todas as peças dividindo um atlas reduzido.
//   node tools/medieval/convert.mjs <pasta-extraída-do-pack> [folha.png] [--pack=medieval|resources|dungeon]
//   medieval  -> assets/kaykit/medieval/medieval.glb   (KayKit Medieval Hexagon Pack, FBX)
//   resources -> assets/kaykit/resources/resources.glb (KayKit Resource Bits, glTF)
//   dungeon   -> assets/kaykit/dungeon/dungeon.glb     (KayKit Dungeon Remastered, FBX)
// Requer o three em tools/bake/node_modules (cd tools/bake && npm install) e Playwright com Chromium.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const PACK = (process.argv.find((a) => a.startsWith('--pack=')) || '--pack=medieval').slice(7);
const SRC = path.resolve(args[0] || '');
const SHEET = args[1];
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/node-tools/node_modules/playwright')); }

// Peças usadas pelo jogo em cada pack
const PACKS = {
  medieval: {
    dir: 'Assets/fbx', ext: '.fbx', atlas: 'Textures/hexagons_medieval.png', out: 'medieval', skip: /waterless/,
    keep: [
  // vila
  'building_castle_blue', 'building_tower_A_blue', 'building_blacksmith_blue', 'building_market_blue', 'building_barracks_yellow',
  'building_tavern_red', 'building_well_blue', 'building_church_blue', 'building_windmill_blue', 'building_mine_blue',
  'building_home_A_red', 'building_home_A_green', 'building_home_A_yellow', 'building_home_B_blue', 'building_home_B_green', 'building_home_B_yellow',
  // ruínas, muralhas e portões
  'building_destroyed', 'building_scaffolding', 'building_stage_A', 'building_stage_B', 'building_stage_C', 'building_tower_base_blue', 'building_grain',
  'wall_straight', 'wall_straight_gate', 'fence_stone_straight', 'fence_wood_straight',
  // natureza
  'tree_single_A', 'tree_single_B', 'tree_single_A_cut', 'tree_single_B_cut',
  'trees_A_large', 'trees_A_medium', 'trees_A_small', 'trees_B_large', 'trees_B_medium', 'trees_B_small',
  'rock_single_A', 'rock_single_B', 'rock_single_C', 'rock_single_D', 'rock_single_E',
  'mountain_A', 'mountain_B', 'mountain_C', 'mountain_A_grass_trees', 'mountain_B_grass_trees', 'mountain_C_grass_trees',
  'waterlily_A', 'waterlily_B', 'waterplant_A', 'waterplant_B', 'waterplant_C',
  // objetos
  'barrel', 'crate_A_big', 'crate_B_big', 'crate_A_small', 'crate_long_A', 'crate_long_B', 'crate_long_C', 'crate_open', 'sack',
  'bucket_water', 'bucket_arrows', 'resource_lumber', 'resource_stone', 'wheelbarrow', 'weaponrack', 'target', 'ladder', 'pallet',
  'flag_blue', 'flag_red',
],
  },
  resources: {
    dir: 'Assets/gltf', ext: '.gltf', atlas: 'Textures/resource_bits_texture.png', out: 'resources', flipY: false,
    keep: [
      'Iron_Nuggets', 'Iron_Nugget_Large', 'Copper_Nugget_Large', 'Silver_Nugget_Large', 'Gold_Nugget_Large', 'Gold_Nuggets',
      'Gold_Bars', 'Gold_Bars_Stack_Small', 'Gold_Bars_Stack_Medium', 'Iron_Bars_Stack_Small', 'Iron_Bars_Stack_Medium',
      'Copper_Bars_Stack_Small', 'Silver_Bars_Stack_Small', 'Stone_Chunks_Small', 'Stone_Chunks_Large',
      'Stone_Bricks_Stack_Small', 'Stone_Bricks_Stack_Medium', 'Textiles_Stack_Small', 'Textiles_Stack_Large_Colored', 'Textiles_A',
      'Wood_Log_Stack', 'Wood_Planks_Stack_Small', 'Wood_Planks_Stack_Medium', 'Pallet_Wood_Covered_A',
    ],
  },
};
PACKS.dungeon = {
  dir: 'fbx', ext: '.fbx', atlas: 'textures/dungeon_texture.png', out: 'dungeon',
  keep: process.env.ALL ? null : [
    'pillar', 'pillar_decorated', 'column', 'rubble_half', 'torch_lit', 'chest', 'chest_gold', 'coin_stack_large', 'coin_stack_medium',
    'candle_triple', 'candle_melted', 'shelf_small_candles', 'keg_decorated', 'barrel_small_stack', 'barrel_large_decorated',
    'table_medium_tablecloth_decorated_B', 'table_small_decorated_A', 'table_long_decorated_A',
    'banner_triple_blue', 'banner_shield_blue', 'banner_patternA_blue', 'banner_patternC_red', 'banner_shield_red',
    'sword_shield', 'sword_shield_gold', 'crates_stacked', 'box_stacked',
  ],
};
const cfg = PACKS[PACK];
if (!cfg) { console.error('Pack desconhecido:', PACK); process.exit(1); }
const OUT = path.join(ROOT, 'assets', 'kaykit', cfg.out);
const TEX_SIZE = 128; // os atlas KayKit são faixas em gradiente: 128px não perde nada visível

if (!fs.existsSync(path.join(SRC, cfg.dir))) {
  console.error(`Pasta do pack inválida (esperado ${cfg.dir} dentro dela):`, SRC);
  process.exit(1);
}
const files = [];
const all = new Map();
(function walk(dir) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    if (f.isDirectory()) walk(path.join(dir, f.name));
    else if (f.name.toLowerCase().endsWith(cfg.ext) && !(cfg.skip && cfg.skip.test(dir))) {
      all.set(f.name.slice(0, -cfg.ext.length), path.relative(SRC, path.join(dir, f.name)).split(path.sep).join('/'));
    }
  }
})(path.join(SRC, cfg.dir));
for (const k of cfg.keep || [...all.keys()].sort()) {
  if (all.has(k)) files.push(all.get(k));
  else console.warn('Modelo não encontrado no pack:', k);
}

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.fbx': 'application/octet-stream', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream' };
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
await page.goto(`http://127.0.0.1:${server.address().port}/tools/medieval/convert.html`);
await page.waitForFunction(() => window.convertReady === true, null, { timeout: 30000 });
console.log(`Convertendo ${files.length} modelos...`);
const result = await page.evaluate(([f, s, a, fy]) => window.runConvert(f, s, a, fy), [files, TEX_SIZE, cfg.atlas, cfg.flipY !== false]);
fs.mkdirSync(OUT, { recursive: true });
const glb = Buffer.from(result.glb, 'base64');
fs.writeFileSync(path.join(OUT, cfg.out + '.glb'), glb);
fs.copyFileSync(path.join(SRC, 'License.txt'), path.join(OUT, 'LICENSE.txt'));
console.log(`${cfg.out}.glb: ${(glb.length / 1024).toFixed(0)} KB`);
if (SHEET) {
  const names = Object.keys(result.info);
  const front = !!process.env.FRONT;
  const pick = process.env.ONLY ? names.filter((n) => new RegExp(process.env.ONLY).test(n)) : names;
  const png = await page.evaluate(([n, f]) => window.contactSheet(n, Math.min(12, n.length), 170, f), [pick, front]);
  fs.writeFileSync(SHEET, Buffer.from(png.split(',')[1], 'base64'));
  fs.writeFileSync(SHEET.replace(/\.png$/, '.json'), JSON.stringify(result.info, null, 1));
  console.log('Folha de contato:', SHEET);
}
await browser.close();
server.close();
