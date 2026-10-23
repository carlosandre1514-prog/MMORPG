// Converte os pacotes da fazenda em GLBs leves para o jogo:
//   assets/farm/farm.glb   13 construções do "LowPoly Farm Buildings" (Quaternius, CC0): cores por vértice (do .mtl)
//   assets/farm/props.glb  adereços do "Small Props Pack" (RG Poly): a paleta (atlas) vira cor por vértice
//   assets/farm/flora.glb  "HandPainted Plant Pack A" (WizP): cogumelos, flores e sinos com textura pintada (256 px, com transparência)
//   assets/farm/magic.glb  "HandPainted Magic Pack" / Magic1 (WizP): caldeirão, livros, velas, lanternas... (512 px)
// Cada peça sai com a base no chão (y = 0), centrada em x e z, em metros, com a frente para +Z.
// Uso: node tools/farm/convert.mjs <Farm_Buildings/OBJ> <SmallPropsPack/gLTF/Props> <pasta do PlantA.fbx> <pasta do Magic1.fbx> [saida]
// Requer: cd tools/village && npm install (@gltf-transform/core) e cd tools/bake && npm install (three, para ler FBX)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const { Document, NodeIO } = await import(pathToFileURL(path.join(ROOT, 'tools/village/node_modules/@gltf-transform/core/dist/index.js')).href);
const three = path.join(ROOT, 'tools/bake/node_modules/three');
globalThis.document = { createElementNS: () => ({ addEventListener() {}, removeEventListener() {}, set src(v) {}, style: {} }) };
const THREE = await import(pathToFileURL(path.join(three, 'build/three.module.js')).href);
const { FBXLoader } = await import(pathToFileURL(path.join(three, 'examples/jsm/loaders/FBXLoader.js')).href);

const [FARM, PROPS, PLANTS, MAGIC] = process.argv.slice(2, 6).map((p) => path.resolve(p || ''));
const OUT = path.resolve(process.argv[6] || path.join(ROOT, 'assets', 'farm'));
fs.mkdirSync(OUT, { recursive: true });

// Giro (em múltiplos de 90°) para a frente de cada construção ficar em +Z; ajustado olhando o resultado
const FRONT = { Barn: 0, BigBarn: 0, SmallBarn: 0, OpenBarn: 0, ChickenCoop: 0, Silo: 0, Silo_House: 0, Well: 0, WaterTower: 0, Windmill: 0, TowerWindmill: 0, Fence: 0, Fence2: 0 };
try { Object.assign(FRONT, JSON.parse(fs.readFileSync(path.join(HERE, 'front.json'), 'utf8'))); } catch { /* sem ajustes */ }

const PROP_LIST = [
  'Trough_1_A', 'Trough_1_B', 'Trough_1_C', 'Trough_2_A', 'Trough_2_B', 'Trough_3_A', 'Trough_3_B',
  'Bucket_1_A', 'Bucket_1_B', 'Pitchfork_A', 'Pitchfork_B', 'Pitchfork_C', 'Broom_A', 'Broom_B', 'Basin_A', 'Basin_B', 'Stool_A', 'Stool_B',
  'Bag_1_A', 'Bag_1_B', 'Bag_1_C', 'Bag_2_A', 'Bag_2_B', 'Bag_3_A', 'Bag_3_B', 'Wheel_A', 'Wheel_B', 'CutedWood_1_A', 'CutedWood_1_B',
  'Laundry_A', 'Laundry_B', 'Rope_1_A', 'Grinder_A', 'Grinder_B', 'SkinHang_A', 'SkinHang_B', 'PracticeTarget_1_A', 'PracticeTarget_2_A',
  'FishingRod_A', 'DriedFish_1_A', 'Cart_1_A', 'Cart_1_B', 'Cart_1_C', 'Manequin_1_A', 'Manequin_2_A', 'Hammer_1_A',
];

const lin = (c) => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };

// ------------------------------------------------------------------ PNG (ler, reduzir e gravar)
function readPng(buf) { // RGB/RGBA de 8 bits sem entrelaçamento -> { w, h, data RGBA }
  let p = 8, w = 0, h = 0, ct = 0; const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString('latin1', p + 4, p + 8);
    if (type === 'IHDR') { w = buf.readUInt32BE(p + 8); h = buf.readUInt32BE(p + 12); ct = buf[p + 17]; if (buf[p + 16] !== 8 || buf[p + 20]) throw new Error('PNG não suportado (só 8 bits sem entrelaçamento)'); }
    if (type === 'IDAT') idat.push(buf.subarray(p + 8, p + 8 + len));
    p += 12 + len;
  }
  if (ct !== 2 && ct !== 6) throw new Error('PNG não suportado (tipo de cor ' + ct + ')');
  const bpp = ct === 6 ? 4 : 3;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * bpp, px = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) {
    const ft = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const v = raw[y * (stride + 1) + 1 + x];
      const a = x >= bpp ? px[y * stride + x - bpp] : 0, up = y ? px[(y - 1) * stride + x] : 0, c = x >= bpp && y ? px[(y - 1) * stride + x - bpp] : 0;
      const pa = Math.abs(up - c), pb = Math.abs(a - c), pc = Math.abs(a + up - 2 * c);
      const pred = ft === 0 ? 0 : ft === 1 ? a : ft === 2 ? up : ft === 3 ? (a + up) >> 1 : (pa <= pb && pa <= pc ? a : pb <= pc ? up : c);
      px[y * stride + x] = (v + pred) & 255;
    }
  }
  if (bpp === 4) return { w, h, data: px };
  const rgba = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) { rgba[i * 4] = px[i * 3]; rgba[i * 4 + 1] = px[i * 3 + 1]; rgba[i * 4 + 2] = px[i * 3 + 2]; rgba[i * 4 + 3] = 255; }
  return { w, h, data: rgba };
}
function downscale(img, size) { // filtro de caixa; a cor é ponderada pela transparência para as bordas não escurecerem
  const f = img.w / size, out = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let r = 0, g = 0, b = 0, a = 0, n = 0;
    for (let j = 0; j < f; j++) for (let i = 0; i < f; i++) {
      const o = ((Math.floor(y * f) + j) * img.w + Math.floor(x * f) + i) * 4, al = img.data[o + 3];
      r += img.data[o] * al; g += img.data[o + 1] * al; b += img.data[o + 2] * al; a += al; n++;
    }
    const o = (y * size + x) * 4;
    if (a > 0) { out[o] = r / a; out[o + 1] = g / a; out[o + 2] = b / a; }
    out[o + 3] = a / n;
  }
  return { w: size, h: size, data: out };
}
const crcTable = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function encodePng({ w, h, data }) {
  const chunk = (type, body) => { const len = Buffer.alloc(4); len.writeUInt32BE(body.length); const td = Buffer.concat([Buffer.from(type, 'latin1'), body]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  const rows = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { rows[y * (w * 4 + 1)] = 0; data.copy(rows, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(rows, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// ------------------------------------------------------------------ geometria
// m = { pos, nor, col?, uv?, idx }; põe a base em y = 0, centra em x e z e gira de 90° em 90° em torno de Y
function normalize(m, quarter = 0, scale = 1) {
  const c = Math.round(Math.cos(quarter * Math.PI / 2)), s = Math.round(Math.sin(quarter * Math.PI / 2));
  for (let i = 0; i < m.pos.length; i += 3) {
    const x = m.pos[i], z = m.pos[i + 2];
    m.pos[i] = (x * c + z * s) * scale; m.pos[i + 2] = (-x * s + z * c) * scale; m.pos[i + 1] *= scale;
    const nx = m.nor[i], nz = m.nor[i + 2];
    m.nor[i] = nx * c + nz * s; m.nor[i + 2] = -nx * s + nz * c;
  }
  const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  for (let i = 0; i < m.pos.length; i += 3) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], m.pos[i + k]); mx[k] = Math.max(mx[k], m.pos[i + k]); }
  const cx = (mn[0] + mx[0]) / 2, cz = (mn[2] + mx[2]) / 2;
  for (let i = 0; i < m.pos.length; i += 3) { m.pos[i] -= cx; m.pos[i + 1] -= mn[1]; m.pos[i + 2] -= cz; }
  return [mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]];
}

function parseObj(file) { // OBJ + MTL: um vértice por (posição, normal, material); cor = Kd (o Blender grava em linear)
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
  const v = [], vn = [], map = new Map(), pos = [], nor = [], col = [], idx = [], tmat = [];
  let material = null;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const t = line.trim().split(/\s+/);
    if (t[0] === 'v') v.push(t.slice(1, 4).map(Number));
    else if (t[0] === 'vn') vn.push(t.slice(1, 4).map(Number));
    else if (t[0] === 'usemtl') material = t[1];
    else if (t[0] === 'f') {
      const f = t.slice(1).map((s) => s.split('/').map((n) => (n ? parseInt(n, 10) - 1 : -1)));
      for (let i = 1; i + 1 < f.length; i++) for (const [vi, , ni] of [f[0], f[i], f[i + 1]]) {
        const k = `${vi}/${ni}/${material}`;
        let id = map.get(k);
        if (id == null) { id = pos.length / 3; map.set(k, id); pos.push(...v[vi]); nor.push(...(ni >= 0 ? vn[ni] : [0, 1, 0])); col.push(...(mtl[material] || [0.8, 0.8, 0.8])); }
        idx.push(id);
      }
      if (f.length >= 3) for (let i = 1; i + 1 < f.length; i++) tmat.push(material);
    }
  }
  return { pos: new Float32Array(pos), nor: new Float32Array(nor), col: new Float32Array(col), idx: new Uint32Array(idx), tmat };
}

const sizes = {};
function addVertexColored(doc, buffer, scene, mat, name, m) {
  const prim = doc.createPrimitive().setMaterial(mat)
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(m.pos).setBuffer(buffer))
    .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(m.nor).setBuffer(buffer))
    .setAttribute('COLOR_0', doc.createAccessor().setType('VEC3').setArray(m.col).setBuffer(buffer))
    .setIndices(doc.createAccessor().setType('SCALAR').setArray(m.idx).setBuffer(buffer));
  scene.addChild(doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(prim)));
}
async function save(doc, file, rows) {
  await new NodeIO().write(path.join(OUT, file), doc);
  console.log(rows.join('\n'));
  console.log('gravado', file, (fs.statSync(path.join(OUT, file)).size / 1024).toFixed(0) + ' KB\n');
}

// ------------------------------------------------------------------ 1. construções (Quaternius)
// Cada construção sai em partes, uma por material do .mtl original (telhado, paredes, madeiramento, pedra...), com UVs por projeção em
// caixa. O jogo põe nelas as texturas das construções da cidade (telha, reboco, madeira, pedra: client/js/three/world3d.js, FARM_TEX).
// Metros por repetição da textura de cada material: tem de bater com o que a cidade usa (a escala dos UVs é fixada aqui).
const UV_METERS = { RoofBlack: 2.2, DarkRed: 1.6, LightRed: 2.4, White: 1.6, Brown: 1.6, Grey: 2.4, DarkGrey: 2.4, LightBrown: 1.8, DarkBrown: 1.6, Black: 2 };
function splitParts(m) {
  const parts = new Map();
  for (let t = 0; t < m.tmat.length; t++) {
    const name = m.tmat[t] || 'None';
    let p = parts.get(name);
    if (!p) parts.set(name, (p = { map: new Map(), pos: [], nor: [], col: [], uv: [], idx: [] }));
    for (let k = 0; k < 3; k++) {
      const vi = m.idx[t * 3 + k];
      let id = p.map.get(vi);
      if (id == null) {
        id = p.pos.length / 3; p.map.set(vi, id);
        const x = m.pos[vi * 3], y = m.pos[vi * 3 + 1], z = m.pos[vi * 3 + 2], nx = m.nor[vi * 3], ny = m.nor[vi * 3 + 1], nz = m.nor[vi * 3 + 2];
        p.pos.push(x, y, z); p.nor.push(nx, ny, nz); p.col.push(m.col[vi * 3], m.col[vi * 3 + 1], m.col[vi * 3 + 2]);
        const S = UV_METERS[name] || 2, ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz);
        if (ay >= ax && ay >= az) p.uv.push(x / S, z / S); else if (ax >= az) p.uv.push(z / S, -y / S); else p.uv.push(x / S, -y / S);
      }
      p.idx.push(id);
    }
  }
  return [...parts].map(([name, p]) => ({ name, m: { pos: new Float32Array(p.pos), nor: new Float32Array(p.nor), col: new Float32Array(p.col), uv: new Float32Array(p.uv), idx: new Uint32Array(p.idx) } }));
}
{
  const doc = new Document(), buffer = doc.createBuffer(), scene = doc.createScene('farm');
  const mat = doc.createMaterial('farm').setBaseColorFactor([1, 1, 1, 1]).setRoughnessFactor(0.9).setMetallicFactor(0);
  const rows = [];
  for (const f of fs.readdirSync(FARM).filter((n) => n.endsWith('.obj')).sort()) {
    const name = f.replace('.obj', '');
    const m = parseObj(path.join(FARM, f));
    const sz = normalize(m, FRONT[name] || 0);
    sizes['farm_' + name] = sz.map((v) => +v.toFixed(2));
    const parts = splitParts(m);
    for (const { name: mtl, m: pm } of parts) {
      const prim = doc.createPrimitive().setMaterial(mat)
        .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(pm.pos).setBuffer(buffer))
        .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(pm.nor).setBuffer(buffer))
        .setAttribute('COLOR_0', doc.createAccessor().setType('VEC3').setArray(pm.col).setBuffer(buffer))
        .setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(pm.uv).setBuffer(buffer))
        .setIndices(doc.createAccessor().setType('SCALAR').setArray(pm.idx).setBuffer(buffer));
      const node = `farm_${name}~${mtl}`;
      scene.addChild(doc.createNode(node).setMesh(doc.createMesh(node).addPrimitive(prim)));
    }
    rows.push(`farm_${name.padEnd(14)} ${m.idx.length / 3} triângulos em ${parts.length} partes (${parts.map((p) => p.name).join(', ')})  ${sz.map((v) => v.toFixed(1)).join(' x ')} m`);
  }
  await save(doc, 'farm.glb', rows);
}

// ------------------------------------------------------------------ 2. adereços (RG Poly): o atlas vira cor por vértice
{
  const io = new NodeIO();
  const doc = new Document(), buffer = doc.createBuffer(), scene = doc.createScene('props');
  const mat = doc.createMaterial('props').setBaseColorFactor([1, 1, 1, 1]).setRoughnessFactor(0.9).setMetallicFactor(0);
  const rows = [];
  let atlas = null;
  for (const name of PROP_LIST) {
    const src = await io.read(path.join(PROPS, name + '.glb'));
    const root = src.getRoot();
    atlas ||= readPng(Buffer.from(root.listTextures()[0].getImage()));
    const pos = [], nor = [], col = [], idx = [];
    for (const node of root.listNodes()) {
      const mesh = node.getMesh();
      if (!mesh) continue;
      const w = node.getWorldMatrix();
      for (const p of mesh.listPrimitives()) {
        const P = p.getAttribute('POSITION'), N = p.getAttribute('NORMAL'), U = p.getAttribute('TEXCOORD_0'), I = p.getIndices();
        const base = pos.length / 3, v = [0, 0, 0], n = [0, 0, 0], uv = [0, 0];
        for (let i = 0; i < P.getCount(); i++) {
          P.getElement(i, v); N.getElement(i, n); U.getElement(i, uv);
          pos.push(w[0] * v[0] + w[4] * v[1] + w[8] * v[2] + w[12], w[1] * v[0] + w[5] * v[1] + w[9] * v[2] + w[13], w[2] * v[0] + w[6] * v[1] + w[10] * v[2] + w[14]);
          nor.push(w[0] * n[0] + w[4] * n[1] + w[8] * n[2], w[1] * n[0] + w[5] * n[1] + w[9] * n[2], w[2] * n[0] + w[6] * n[1] + w[10] * n[2]);
          const x = Math.min(atlas.w - 1, Math.max(0, Math.floor(uv[0] * atlas.w))), y = Math.min(atlas.h - 1, Math.max(0, Math.floor(uv[1] * atlas.h)));
          const o = (y * atlas.w + x) * 4;
          col.push(lin(atlas.data[o]), lin(atlas.data[o + 1]), lin(atlas.data[o + 2]));
        }
        for (let i = 0; i < (I ? I.getCount() : P.getCount()); i++) idx.push(base + (I ? I.getScalar(i) : i));
      }
    }
    const m = { pos: new Float32Array(pos), nor: new Float32Array(nor), col: new Float32Array(col), idx: new Uint32Array(idx) };
    for (let i = 0; i < m.nor.length; i += 3) { const l = Math.hypot(m.nor[i], m.nor[i + 1], m.nor[i + 2]) || 1; m.nor[i] /= l; m.nor[i + 1] /= l; m.nor[i + 2] /= l; }
    const sz = normalize(m, 0);
    sizes['prop_' + name] = sz.map((v) => +v.toFixed(2));
    addVertexColored(doc, buffer, scene, mat, 'prop_' + name, m);
    rows.push(`prop_${name.padEnd(20)} ${m.idx.length / 3} triângulos  ${sz.map((v) => v.toFixed(2)).join(' x ')} m`);
  }
  await save(doc, 'props.glb', rows);
}

// ------------------------------------------------------------------ 3 e 4. pacotes pintados à mão (FBX + texturas, em milímetros)
async function paintedPack(dir, fbxName, textures, glbName, prefix, texSize, alphaMode) {
  const buf = fs.readFileSync(path.join(dir, fbxName));
  const root = new FBXLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '');
  root.updateMatrixWorld(true);
  const doc = new Document(), buffer = doc.createBuffer(), scene = doc.createScene(prefix);
  const mats = {};
  for (const [matName, file] of Object.entries(textures)) {
    const img = downscale(readPng(fs.readFileSync(path.join(dir, file))), texSize);
    const tex = doc.createTexture(matName).setImage(encodePng(img)).setMimeType('image/png');
    const mode = alphaMode[matName] || 'OPAQUE';
    mats[matName] = doc.createMaterial(matName).setBaseColorTexture(tex).setRoughnessFactor(1).setMetallicFactor(0).setDoubleSided(mode !== 'OPAQUE').setAlphaMode(mode);
    if (mode === 'MASK') mats[matName].setAlphaCutoff(0.4);
  }
  const rows = [];
  root.traverse((o) => {
    if (!o.isMesh || o.name.startsWith('Glow')) return; // os cartões de brilho soltos só valem junto do cogumelo (que já traz o próprio)
    const g = o.geometry, P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv;
    const list = [].concat(o.material);
    const groups = g.groups.length ? g.groups : [{ start: 0, count: g.index ? g.index.count : P.count, materialIndex: 0 }];
    const world = o.matrixWorld;
    // todas as partes do mesmo objeto compartilham o mesmo pivô, então a posição vem da caixa do objeto inteiro
    const parts = [];
    for (const gr of groups) {
      const matName = list[gr.materialIndex].name;
      if (!mats[matName]) continue;
      const map = new Map(), pos = [], nor = [], uv = [], idx = [];
      for (let i = gr.start; i < gr.start + gr.count; i++) {
        const vi = g.index ? g.index.getX(i) : i;
        let id = map.get(vi);
        if (id == null) {
          id = pos.length / 3; map.set(vi, id);
          const v = new THREE.Vector3(P.getX(vi), P.getY(vi), P.getZ(vi)).applyMatrix4(world);
          const n = new THREE.Vector3(N.getX(vi), N.getY(vi), N.getZ(vi)).transformDirection(world);
          pos.push(v.x * 0.001, v.y * 0.001, v.z * 0.001); nor.push(n.x, n.y, n.z); uv.push(U.getX(vi), 1 - U.getY(vi));
        }
        idx.push(id);
      }
      parts.push({ matName, m: { pos: new Float32Array(pos), nor: new Float32Array(nor), uv: new Float32Array(uv), idx: new Uint32Array(idx) } });
    }
    // origem comum: base e centro da caixa do objeto inteiro
    const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
    for (const { m } of parts) for (let i = 0; i < m.pos.length; i += 3) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], m.pos[i + k]); mx[k] = Math.max(mx[k], m.pos[i + k]); }
    const cx = (mn[0] + mx[0]) / 2, cz = (mn[2] + mx[2]) / 2;
    sizes[`${prefix}_${o.name}`] = mx.map((x, i) => +(x - mn[i]).toFixed(3));
    for (const { matName, m } of parts) {
      for (let i = 0; i < m.pos.length; i += 3) { m.pos[i] -= cx; m.pos[i + 1] -= mn[1]; m.pos[i + 2] -= cz; }
      const name = `${prefix}_${o.name}${matName === 'Glow' ? '_glow' : ''}`;
      const prim = doc.createPrimitive().setMaterial(mats[matName])
        .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(m.pos).setBuffer(buffer))
        .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(m.nor).setBuffer(buffer))
        .setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(m.uv).setBuffer(buffer))
        .setIndices(doc.createAccessor().setType('SCALAR').setArray(m.idx).setBuffer(buffer));
      scene.addChild(doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(prim)));
      rows.push(`${name.padEnd(22)} ${m.idx.length / 3} triângulos  material ${matName}`);
    }
  });
  await save(doc, glbName, rows);
}
await paintedPack(PLANTS, 'PlantA.fbx', { Bell: 'Bell.png', Flower: 'Flower.png', Mushroom: 'Mushroom.png', Glow: 'Glow.png' }, 'flora.glb', 'flora', 256,
  { Bell: 'MASK', Flower: 'MASK', Mushroom: 'MASK', Glow: 'BLEND' });
await paintedPack(MAGIC, 'Magic1.fbx', { Magic1: 'Magic1.png', Books: 'Books.png' }, 'magic.glb', 'magic', 512, {});
fs.writeFileSync(path.join(OUT, 'tamanhos.json'), JSON.stringify(sizes, null, 1) + '\n');
console.log('tamanhos.json gravado');
