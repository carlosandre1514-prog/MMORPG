// Peças de decoração das casas que não existem nos packs e foram montadas aqui, só com formas simples e
// texturas desenhadas na hora: lareira de pedra com toras e brasas, tapetes tecidos, bancos de igreja e balcão.
// Entram no mesmo mecanismo das peças do Medieval Village (nome -> geometrias por material), então a cidade inteira
// continua sendo um BatchedMesh por material.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const TILE = 90; // cm de parede por repetição da textura

// Caixa em cm com UVs proporcionais ao tamanho (a textura não estica)
function box(w, h, d, x, y, z) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const scale = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    for (let i = 0; i < 4; i++) {
      const k = f * 4 + i;
      uv.setXY(k, uv.getX(k) * scale[f][0] / TILE, uv.getY(k) * scale[f][1] / TILE);
    }
  }
  g.translate(x, y, z);
  return g;
}

// Tora deitada ao longo de X (ou de Z), raio r e comprimento len
function log(r, len, x, y, z, alongZ = false, tilt = 0) {
  const g = new THREE.CylinderGeometry(r, r * 0.92, len, 9, 1);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2, uv.getY(i) * len / 30);
  g.rotateZ(Math.PI / 2);
  if (alongZ) g.rotateY(Math.PI / 2);
  if (tilt) g.rotateY(tilt);
  g.translate(x, y, z);
  return g;
}

const merge = (list) => mergeGeometries(list, false);

// Lareira encostada na parede (origem no centro da face traseira, no chão; a frente é +Z)
function hearthPieces() {
  const stone = merge([
    box(170, 8, 66, 0, 4, 33), // soleira
    box(30, 150, 48, -57, 83, 24), box(30, 150, 48, 57, 83, 24), // montantes
    box(144, 34, 48, 0, 137, 24), // verga
    box(176, 8, 62, 0, 158, 31), // prateleira da lareira
    box(124, 134, 36, 0, 229, 18), // corpo da chaminé até o teto
  ]);
  const soot = merge([
    box(84, 112, 4, 0, 64, 2.5), box(4, 112, 40, -40, 64, 22), box(4, 112, 40, 40, 64, 22),
    box(84, 4, 40, 0, 118, 22), box(84, 2, 40, 0, 9, 22),
  ]);
  const logs = merge([log(7, 58, 0, 17, 18), log(6.5, 54, 2, 17, 31), log(6, 50, 0, 27, 24, true)]);
  const ember = merge([box(58, 3, 34, 0, 10.5, 25)]);
  return [{ key: 'UnevenBrick', geo: stone }, { key: 'Soot', geo: soot }, { key: 'Log', geo: logs }, { key: 'Ember', geo: ember }];
}

// Banco de igreja de 200 cm, encosto atrás (+Z): quem senta olha para -Z
function pewPieces() {
  const g = merge([
    box(200, 5, 40, 0, 45, 0), // assento
    box(200, 38, 4, 0, 72, 18), // encosto
    box(5, 48, 38, -95, 24, 0), box(5, 48, 38, 95, 24, 0), // laterais
    box(5, 86, 6, -98, 43, 18), box(5, 86, 6, 98, 43, 18),
    box(190, 4, 8, 0, 16, -14), // apoio para os pés
  ]);
  return [{ key: 'FurnWood', geo: g }];
}

// Balcão de 200 cm de comprimento (frente +Z)
function counterPieces() {
  const body = merge([
    box(200, 94, 52, 0, 47, 0),
    box(208, 7, 64, 0, 97, 6), // tampo que sobra um pouco
    box(200, 6, 6, 0, 3, 28), // rodapé
  ]);
  return [{ key: 'FurnWood', geo: body }];
}

// Estante de livros (origem no centro da face traseira, no chão; 120 × 34 × 205 cm)
function bookcasePieces() {
  const frame = [
    box(5, 205, 34, -57.5, 102.5, 17), box(5, 205, 34, 57.5, 102.5, 17), // laterais
    box(120, 7, 34, 0, 201.5, 17), box(112, 8, 30, 0, 4, 17), // topo e rodapé
    box(110, 193, 2, 0, 104, 1), // fundo
  ];
  const quads = [];
  const rows = [14, 56, 98, 140, 175];
  for (let i = 0; i < rows.length; i++) {
    frame.push(box(110, 3, 30, 0, rows[i] - 1.5 + (i === 0 ? 8 : 0) * 0, 17)); // prateleiras
  }
  for (let i = 0; i < rows.length; i++) {
    const hgt = i === rows.length - 1 ? 24 : 36;
    const q = new THREE.PlaneGeometry(106, hgt);
    const uv = q.attributes.uv;
    for (let k = 0; k < 4; k++) { const u = uv.getX(k); uv.setXY(k, i % 2 ? 1 - u : u, uv.getY(k)); }
    q.translate(0, rows[i] + hgt / 2, 24);
    quads.push(q);
  }
  return [{ key: 'FurnWood', geo: merge(frame) }, { key: 'Books', geo: merge(quads) }];
}

// Armário de cozinha com portas e gavetas (origem no centro da face traseira; 110 × 48 × 100 cm)
function cupboardPieces() {
  const wood = merge([
    box(108, 80, 44, 0, 44, 24), // corpo
    box(114, 6, 48, 0, 87, 24), // tampo
    box(50, 66, 3, -26, 42, 47.5), box(50, 66, 3, 26, 42, 47.5), // portas
    box(104, 10, 3, 0, 80, 47.5), // faixa das gavetas
    box(108, 6, 40, 0, 3, 24), // rodapé
  ]);
  const metal = merge([box(3, 14, 3, -6, 44, 50), box(3, 14, 3, 6, 44, 50), box(14, 3, 3, 0, 80, 50)]);
  return [{ key: 'FurnWood', geo: wood }, { key: 'Soot', geo: metal }];
}

// Lombada de livros: canvas com fileiras de livros de cores e alturas variadas (fundo transparente)
function booksTexture() {
  const cv = document.createElement('canvas');
  cv.width = 424; cv.height = 144;
  const c = cv.getContext('2d');
  const cols = ['#7a2e2e', '#2f4b6e', '#3e5d3a', '#6b4a2b', '#8a6d2f', '#4d3a5c', '#8b8574', '#2e4a4a', '#a0522d'];
  let x = 2;
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  while (x < 418) {
    const w = 10 + Math.floor(rnd() * 16), h = 100 + Math.floor(rnd() * 40);
    if (rnd() < 0.08) { x += 22; continue; } // vão
    const col = cols[Math.floor(rnd() * cols.length)];
    c.fillStyle = col; c.fillRect(x, 144 - h, w, h);
    c.fillStyle = 'rgba(0,0,0,0.28)'; c.fillRect(x + w - 2, 144 - h, 2, h);
    c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillRect(x, 144 - h, 2, h);
    c.fillStyle = '#d4b06a'; c.fillRect(x + 1, 144 - h + 10, w - 3, 3); c.fillRect(x + 1, 144 - h + h * 0.6, w - 3, 2);
    x += w + 1;
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// ---- tapetes -------------------------------------------------------------------------------------------------
const RUGS = {
  // [fundo, borda, desenho, detalhe]
  A: ['#8c2f2a', '#d8b86a', '#e4d2a0', '#3d1816'],
  B: ['#2c4a75', '#d9c9a0', '#a9c0dd', '#13243d'],
  C: ['#3d5f35', '#c9a45a', '#d8d0a0', '#1c3018'],
  D: ['#7a2c33', '#c4a24d', '#e9dcb0', '#2e0f13'],
};

function rugTexture(v, wpx, hpx) {
  const [bg, edge, motif, dark] = RUGS[v];
  const cv = document.createElement('canvas');
  cv.width = wpx; cv.height = hpx;
  const c = cv.getContext('2d');
  const fr = 14; // franja
  c.fillStyle = '#e8dcc0';
  c.fillRect(0, 0, wpx, hpx);
  // franjas nas pontas curtas (esquerda/direita)
  c.strokeStyle = '#d3c39b'; c.lineWidth = 2;
  for (let y = 2; y < hpx; y += 5) { c.beginPath(); c.moveTo(0, y); c.lineTo(fr, y); c.moveTo(wpx - fr, y); c.lineTo(wpx, y); c.stroke(); }
  const x0 = fr, w = wpx - fr * 2;
  c.fillStyle = bg; c.fillRect(x0, 0, w, hpx);
  // bordas
  const band = (inset, thick, col) => { c.strokeStyle = col; c.lineWidth = thick; c.strokeRect(x0 + inset, inset, w - inset * 2, hpx - inset * 2); };
  band(3, 6, edge); band(14, 3, dark); band(22, 2, motif);
  // faixa de losangos entre as bordas
  c.fillStyle = motif;
  const step = 16;
  for (let x = x0 + 30; x < x0 + w - 30; x += step) for (const y of [8, hpx - 8]) { c.beginPath(); c.moveTo(x, y - 4); c.lineTo(x + 4, y); c.lineTo(x, y + 4); c.lineTo(x - 4, y); c.closePath(); c.fill(); }
  for (let y = 30; y < hpx - 30; y += step) for (const x of [x0 + 8, x0 + w - 8]) { c.beginPath(); c.moveTo(x, y - 4); c.lineTo(x + 4, y); c.lineTo(x, y + 4); c.lineTo(x - 4, y); c.closePath(); c.fill(); }
  // campo central: medalhão e cantos
  const cx = wpx / 2, cy = hpx / 2, R = Math.min(w, hpx) * 0.3;
  c.fillStyle = dark;
  c.beginPath(); c.ellipse(cx, cy, R * 1.35, R, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = edge;
  c.beginPath(); c.moveTo(cx - R * 1.2, cy); c.lineTo(cx, cy - R * 0.9); c.lineTo(cx + R * 1.2, cy); c.lineTo(cx, cy + R * 0.9); c.closePath(); c.fill();
  c.fillStyle = bg;
  c.beginPath(); c.moveTo(cx - R * 0.75, cy); c.lineTo(cx, cy - R * 0.55); c.lineTo(cx + R * 0.75, cy); c.lineTo(cx, cy + R * 0.55); c.closePath(); c.fill();
  c.fillStyle = motif;
  c.beginPath(); c.arc(cx, cy, R * 0.18, 0, Math.PI * 2); c.fill();
  for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const px = cx + sx * (w * 0.33), py = cy + sy * (hpx * 0.28);
    c.fillStyle = dark; c.beginPath(); c.arc(px, py, 9, 0, Math.PI * 2); c.fill();
    c.fillStyle = motif; c.beginPath(); c.arc(px, py, 4.5, 0, Math.PI * 2); c.fill();
  }
  // trama: linhas finas de tecido e ruído leve
  c.globalAlpha = 0.07; c.fillStyle = '#000';
  for (let y = 0; y < hpx; y += 2) c.fillRect(x0, y, w, 1);
  c.globalAlpha = 0.05;
  for (let i = 0; i < 900; i++) { c.fillStyle = Math.random() < 0.5 ? '#000' : '#fff'; c.fillRect(x0 + Math.random() * w, Math.random() * hpx, 2, 2); }
  c.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// Registra em `village` as peças e materiais de decoração. Tapetes: Rug_A..Rug_D (180 × 120 cm) e Runner (300 × 90 cm, comprido em X).
export function registerDecor(village) {
  const pieces = village.pieces, mats = village.mats;
  pieces.set('Hearth', hearthPieces());
  pieces.set('Pew', pewPieces());
  pieces.set('Counter', counterPieces());
  pieces.set('Bookcase', bookcasePieces());
  pieces.set('Cupboard', cupboardPieces());
  mats.Books = new THREE.MeshStandardMaterial({ name: 'Books', map: booksTexture(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9 });
  mats.FurnWood = new THREE.MeshStandardMaterial({ name: 'FurnWood', color: 0xa86a3e, roughness: 0.9 });
  mats.Soot = new THREE.MeshStandardMaterial({ name: 'Soot', color: 0x16120f, roughness: 1 });
  mats.Log = new THREE.MeshStandardMaterial({ name: 'Log', color: 0x5a3b22, roughness: 0.95 });
  mats.Ember = new THREE.MeshStandardMaterial({ name: 'Ember', color: 0x3a1608, emissive: 0xff6a1a, emissiveIntensity: 1.6, roughness: 1 });
  const rugGeo = (w, d) => new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2);
  for (const v of Object.keys(RUGS)) {
    const key = 'Rug' + v;
    mats[key] = new THREE.MeshStandardMaterial({ name: key, map: rugTexture(v, 288, 192), roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    pieces.set('Rug_' + v, [{ key, geo: rugGeo(180, 120) }]);
  }
  // passadeira longa e estreita (corredor do salão)
  mats.RugRunner = new THREE.MeshStandardMaterial({ name: 'RugRunner', map: rugTexture('A', 320, 96), roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  pieces.set('Runner', [{ key: 'RugRunner', geo: rugGeo(300, 90) }]);
}
