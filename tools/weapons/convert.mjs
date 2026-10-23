// Junta armas de dois pacotes em um GLB só (assets/weapons/weapons.glb), com cores por vértice e um material único:
//   - Medieval Weapons Pack, de Quaternius (CC0): .obj + .mtl (cores por material)
//   - PolyPack Medieval Swords, de Alstra Infinite (CC BY 4.0): .fbx com um atlas PNG, que aqui vira cor por vértice
// Cada arma sai com o cabo na origem, a lâmina/haste ao longo de +Y e a espessura em Z (como as armas KayKit do jogo), na
// escala das armas KayKit (comprimento alvo em LEN, em unidades do personagem).
// Uso: node tools/weapons/convert.mjs <pasta-OBJ-do-Quaternius> <pasta-do-PolyPack> [saida.glb]
// Requer: cd tools/village && npm install (@gltf-transform/core) e cd tools/bake && npm install (three, para ler FBX)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const { Document, NodeIO } = await import(pathToFileURL(path.join(ROOT, 'tools/village/node_modules/@gltf-transform/core/dist/index.js')).href);
const three = path.join(ROOT, 'tools/bake/node_modules/three');
globalThis.document = { createElementNS: () => ({ addEventListener() {}, removeEventListener() {}, set src(v) {}, style: {} }) }; // o FBXLoader só quer carregar a textura
const { FBXLoader } = await import(pathToFileURL(path.join(three, 'examples/jsm/loaders/FBXLoader.js')).href);

const QUAT = path.resolve(process.argv[2] || '');
const POLY = path.resolve(process.argv[3] || '');
const OUT = path.resolve(process.argv[4] || path.join(ROOT, 'assets', 'weapons', 'weapons.glb'));

// nome no jogo -> [arquivo, comprimento alvo (ponta, em unidades do personagem)]
// (só as armas que o jogo usa: cimitarras dos bandidos e do loot Solar, espada e escudo dourados dos guardiões, martelos, arco)
const QUAT_LIST = {
  Sword_Golden: ['Sword_Golden', 1.45], Shield_Celtic_Golden: ['Shield_Celtic_Golden', 0.55], Dagger_2: ['Dagger_2', 1.05],
  Hammer_Small: ['Hammer_Small', 1.1], Hammer_Double: ['Hammer_Double', 1.3], Bow_Golden: ['Bow_Golden', 1.0],
};
const POLY_LIST = { Scimitar: ['Sword_Scimitar', 1.45], Falchion: ['Sword_Falchion', 1.4] };

const lin = (c) => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };

function readPng(file) { // RGB/RGBA de 8 bits sem entrelaçamento
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
  return { w, h, bpp, data: out };
}

// OBJ + MTL: um vértice por (posição, normal, material); cor = Kd do material (o Blender grava em linear)
function parseObj(file) {
  const mtl = {};
  const mtlFile = file.replace(/\.obj$/i, '.mtl');
  if (fs.existsSync(mtlFile)) {
    let cur = null;
    for (const line of fs.readFileSync(mtlFile, 'utf8').split('\n')) {
      const t = line.trim().split(/\s+/);
      if (t[0] === 'newmtl') cur = mtl[t[1]] = [0.8, 0.8, 0.8];
      else if (t[0] === 'Kd' && cur) { cur[0] = +t[1]; cur[1] = +t[2]; cur[2] = +t[3]; }
    }
  }
  const v = [], vn = [], map = new Map(), pos = [], nor = [], col = [], idx = [];
  let material = null;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const t = line.trim().split(/\s+/);
    if (t[0] === 'v') v.push(t.slice(1, 4).map(Number));
    else if (t[0] === 'vn') vn.push(t.slice(1, 4).map(Number));
    else if (t[0] === 'usemtl') material = t[1];
    else if (t[0] === 'f') {
      const f = t.slice(1).map((s) => s.split('/').map((n) => (n ? parseInt(n, 10) - 1 : -1)));
      for (let i = 1; i + 1 < f.length; i++) {
        for (const [vi, , ni] of [f[0], f[i], f[i + 1]]) {
          const k = `${vi}/${ni}/${material}`;
          let id = map.get(k);
          if (id == null) {
            id = pos.length / 3; map.set(k, id);
            pos.push(...v[vi]); nor.push(...(ni >= 0 ? vn[ni] : [0, 1, 0]));
            col.push(...(mtl[material] || [0.8, 0.8, 0.8]));
          }
          idx.push(id);
        }
      }
    }
  }
  return { pos: new Float32Array(pos), nor: new Float32Array(nor), col: new Float32Array(col), idx: new Uint32Array(idx) };
}

// FBX com atlas: a cor de cada vértice é a do atlas no UV dele
function parseFbx(file, atlas) {
  const buf = fs.readFileSync(file);
  const root = new FBXLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '');
  let mesh = null;
  root.traverse((o) => { if (o.isMesh && !mesh) mesh = o; });
  const g = mesh.geometry;
  const P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv;
  const pos = new Float32Array(P.array), nor = new Float32Array(N.array), col = new Float32Array(P.count * 3);
  for (let i = 0; i < P.count; i++) {
    const x = Math.min(atlas.w - 1, Math.max(0, Math.floor(U.getX(i) * atlas.w)));
    const y = Math.min(atlas.h - 1, Math.max(0, Math.floor((1 - U.getY(i)) * atlas.h)));
    const o = (y * atlas.w + x) * atlas.bpp;
    col[i * 3] = lin(atlas.data[o]); col[i * 3 + 1] = lin(atlas.data[o + 1]); col[i * 3 + 2] = lin(atlas.data[o + 2]);
  }
  const idx = g.index ? new Uint32Array(g.index.array) : Uint32Array.from({ length: P.count }, (_, i) => i);
  return { pos, nor, col, idx };
}

const doc = new Document();
const buffer = doc.createBuffer();
const scene = doc.createScene('weapons');
const mat = doc.createMaterial('weapons').setBaseColorFactor([1, 1, 1, 1]).setRoughnessFactor(0.55).setMetallicFactor(0.25);
const rows = [];
function emit(name, m, len) {
  let maxY = -1e9;
  for (let i = 1; i < m.pos.length; i += 3) maxY = Math.max(maxY, m.pos[i]);
  const k = len / maxY;
  for (let i = 0; i < m.pos.length; i++) m.pos[i] *= k;
  const prim = doc.createPrimitive().setMaterial(mat)
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(m.pos).setBuffer(buffer))
    .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(m.nor).setBuffer(buffer))
    .setAttribute('COLOR_0', doc.createAccessor().setType('VEC3').setArray(m.col).setBuffer(buffer))
    .setIndices(doc.createAccessor().setType('SCALAR').setArray(m.idx).setBuffer(buffer));
  scene.addChild(doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(prim)));
  rows.push(`${name.padEnd(22)} ${m.idx.length / 3} triângulos, escala ${k.toFixed(3)}`);
}
for (const [name, [file, len]] of Object.entries(QUAT_LIST)) emit(name, parseObj(path.join(QUAT, file + '.obj')), len);
const atlas = readPng(path.join(POLY, 'PolyPack-MedievalSwords.png'));
for (const [name, [file, len]] of Object.entries(POLY_LIST)) emit(name, parseFbx(path.join(POLY, file + '.fbx'), atlas), len);
fs.mkdirSync(path.dirname(OUT), { recursive: true });
await new NodeIO().write(OUT, doc);
console.log(rows.join('\n'));
console.log('gravado', OUT, (fs.statSync(OUT).size / 1024).toFixed(0) + ' KB');
