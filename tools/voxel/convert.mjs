// Converte os prédios em voxel (MagicaVoxel .obj + paleta .png de 256×1) em assets/voxel/voxel.glb.
// Cada prédio vira dois nós do GLB, <nome> (completo) e <nome>@lod (bem simplificado, para quando está longe), com cores por
// vértice (a paleta é lida e aplicada aos vértices), base no chão (y = 0), centrado em X e em Z e com a fachada voltada
// para +Z. Todos usam o mesmo material, para o jogo desenhar tudo com uma cor/material só.
// Uso: node tools/voxel/convert.mjs <pasta-com-os-.obj-e-.png> [saida.glb]
// Requer: cd tools/village && npm install (usa @gltf-transform/core e meshoptimizer de lá)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const nm = path.join(ROOT, 'tools', 'village', 'node_modules');
const { Document, NodeIO } = await import(pathToFileURL(path.join(nm, '@gltf-transform/core/dist/index.js')).href);
const { MeshoptSimplifier } = await import(pathToFileURL(path.join(nm, 'meshoptimizer/index.js')).href);

const SRC = path.resolve(process.argv[2] || '');
const OUT = path.resolve(process.argv[3] || path.join(ROOT, 'assets', 'voxel', 'voxel.glb'));
const files = fs.readdirSync(SRC).filter((f) => f.toLowerCase().endsWith('.obj')).sort();
if (!files.length) { console.error('Nenhum .obj em', SRC); process.exit(1); }

// PNG de 1 linha (paleta): RGBA/RGB de 8 bits sem entrelaçamento
function readPalette(file) {
  const b = fs.readFileSync(file);
  let p = 8, w = 0, h = 0, ct = 0; const idat = [];
  while (p < b.length) {
    const len = b.readUInt32BE(p), type = b.toString('latin1', p + 4, p + 8);
    if (type === 'IHDR') { w = b.readUInt32BE(p + 8); h = b.readUInt32BE(p + 12); ct = b[p + 17]; }
    if (type === 'IDAT') idat.push(b.subarray(p + 8, p + 8 + len));
    p += 12 + len;
  }
  const bpp = ct === 6 ? 4 : 3;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * bpp, out = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) {
    const ft = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const v = raw[y * (stride + 1) + 1 + x];
      const a = x >= bpp ? out[y * stride + x - bpp] : 0, up = y ? out[(y - 1) * stride + x] : 0, c = x >= bpp && y ? out[(y - 1) * stride + x - bpp] : 0;
      const pa = Math.abs(up - c), pb = Math.abs(a - c), pc = Math.abs(a + up - 2 * c);
      const pred = ft === 0 ? 0 : ft === 1 ? a : ft === 2 ? up : ft === 3 ? (a + up) >> 1 : (pa <= pb && pa <= pc ? a : pb <= pc ? up : c);
      out[y * stride + x] = (v + pred) & 255;
    }
  }
  const pal = [];
  for (let x = 0; x < w; x++) pal.push([out[x * bpp], out[x * bpp + 1], out[x * bpp + 2]]);
  return pal;
}
const lin = (c) => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };

function parseObj(file, pal) {
  const v = [], vt = [], vn = [], tris = [];
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const t = line.trim().split(/\s+/);
    if (t[0] === 'v') v.push(t.slice(1, 4).map(Number));
    else if (t[0] === 'vt') vt.push(t.slice(1, 3).map(Number));
    else if (t[0] === 'vn') vn.push(t.slice(1, 4).map(Number));
    else if (t[0] === 'f') {
      const f = t.slice(1).map((s) => s.split('/').map((n) => (n ? parseInt(n, 10) - 1 : -1)));
      for (let i = 1; i + 1 < f.length; i++) tris.push([f[0], f[i], f[i + 1]]);
    }
  }
  // vértices únicos por (posição, normal, cor da paleta)
  const map = new Map(), pos = [], nor = [], col = [], idx = [];
  const colorOf = (ti) => { const u = ti >= 0 ? vt[ti][0] : 0; return Math.max(0, Math.min(pal.length - 1, Math.floor(u * pal.length))); };
  for (const tri of tris) {
    for (const [vi, ti, ni] of tri) {
      const ci = colorOf(ti), k = `${vi}/${ni}/${ci}`;
      let id = map.get(k);
      if (id == null) {
        id = pos.length / 3; map.set(k, id);
        pos.push(...v[vi]); nor.push(...(ni >= 0 ? vn[ni] : [0, 1, 0]));
        const c = pal[ci]; col.push(lin(c[0]), lin(c[1]), lin(c[2]));
      }
      idx.push(id);
    }
  }
  return { pos: new Float32Array(pos), nor: new Float32Array(nor), col: new Float32Array(col), idx: new Uint32Array(idx) };
}

await MeshoptSimplifier.ready;
const doc = new Document();
const buffer = doc.createBuffer();
const scene = doc.createScene('voxel');
const mat = doc.createMaterial('voxel').setBaseColorFactor([1, 1, 1, 1]).setRoughnessFactor(0.95).setMetallicFactor(0);
const rows = [];
for (const f of files) {
  const base = f.replace(/\.obj$/i, '');
  const pngFile = path.join(SRC, base + '.png');
  const m = parseObj(path.join(SRC, f), readPalette(pngFile));
  // base no chão e centrada: tira o mínimo em y e o centro em x/z
  let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  for (let i = 0; i < m.pos.length; i += 3) for (let a = 0; a < 3; a++) { mn[a] = Math.min(mn[a], m.pos[i + a]); mx[a] = Math.max(mx[a], m.pos[i + a]); }
  for (let i = 0; i < m.pos.length; i += 3) { m.pos[i] -= (mn[0] + mx[0]) / 2; m.pos[i + 1] -= mn[1]; m.pos[i + 2] -= (mn[2] + mx[2]) / 2; }
  const before = m.idx.length / 3;
  // versão de longe: a silhueta e as cores principais bastam (erro relativo maior, cor entra no custo da simplificação)
  const lodTarget = Math.max(300, Math.floor((m.idx.length * 0.12) / 3)) * 3;
  const [lod] = MeshoptSimplifier.simplifyWithAttributes(m.idx, m.pos, 3, m.col, 3, [0.02, 0.02, 0.02], null, lodTarget, 0.06, ['Permissive', 'Prune']);
  const make = (name, indices) => {
    const prim = doc.createPrimitive().setMaterial(mat)
      .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(m.pos).setBuffer(buffer))
      .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(m.nor).setBuffer(buffer))
      .setAttribute('COLOR_0', doc.createAccessor().setType('VEC3').setArray(m.col).setBuffer(buffer))
      .setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(indices)).setBuffer(buffer));
    scene.addChild(doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(prim)));
  };
  make(base, m.idx);
  make(base + '@lod', lod);
  rows.push(`${base}: ${(mx[0] - mn[0]).toFixed(1)} × ${(mx[1] - mn[1]).toFixed(1)} × ${(mx[2] - mn[2]).toFixed(1)}  ${before} triângulos, @lod ${lod.length / 3}`);
}
fs.mkdirSync(path.dirname(OUT), { recursive: true });
await new NodeIO().write(OUT, doc);
console.log(rows.join('\n'));
console.log('gravado', OUT, (fs.statSync(OUT).size / 1024).toFixed(0) + ' KB');
