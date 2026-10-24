// Zahrim, a capital do Reino de Sahaar: cidade de torres de barro (os prédios em voxel de assets/voxel) no deserto,
// em volta de um oásis. Ruas de arenito formam uma grade: a Avenida do Sol (oeste-leste) cruza a Avenida das Palmeiras
// (norte-sul) na Praça do Oásis; ao leste fica o Palácio do Emir. As torres em voxel são o horizonte da cidade e são maciças;
// as duas fileiras que dão para a Avenida do Sol são casas de adobe que se pode visitar (porta, sala mobiliada e andar de cima),
// e os serviços também funcionam ao ar livre, em barracas e sob toldos, em volta da praça e da avenida.
// As coordenadas dos NPCs (shared/data/npcs.js) foram planejadas junto com este mapa.
import { T, O, OBJ_INFO } from './tiles.js';
import { mulberry32, fbm, hash2 } from './rng.js';
import { modules, doorFront } from './housegeom.js';

// Modelos de torre e a menor largura (em tiles) em que cada um cabe bem
export const VOXEL_MODELS = {
  TinyBuilding01: 3, SmallBuilding01: 4, SmallBuilding03: 4, SmallBuilding04: 4,
  TallBuilding01: 4, TallBuilding02: 4, TallBuilding03: 5, LargeBuilding01: 8,
};
// peso de cada modelo no sorteio (os altos dominam o horizonte; os pequenos e o grande dão variedade)
const MODEL_WEIGHT = {
  TinyBuilding01: 1, SmallBuilding01: 2, SmallBuilding03: 1.5, SmallBuilding04: 2,
  TallBuilding01: 2.2, TallBuilding02: 2.2, TallBuilding03: 2, LargeBuilding01: 4,
};
function pickModel(w, r) {
  const fits = Object.keys(VOXEL_MODELS).filter((m) => w >= VOXEL_MODELS[m]);
  let total = 0;
  for (const m of fits) total += MODEL_WEIGHT[m];
  let t = r * total;
  for (const m of fits) { t -= MODEL_WEIGHT[m]; if (t <= 0) return m; }
  return fits[fits.length - 1];
}

export function buildDesertCity(grid, zone) {
  const rng = mulberry32(zone.gen.seed);
  const S = grid.structures;
  const { w: W, h: H } = grid;
  const idx = (x, y) => grid.i(x, y);
  let towerId = 9000;

  // ------------------------------------------------------------ primitivas
  const pave = (x, y, w, h, t = T.SANDSTONE) => grid.rect(x, y, w, h, (px, py) => {
    if (grid.o(px, py) === O.BUILDING) return;
    grid.setT(px, py, t); grid.setO(px, py, 0); grid.pathMask[idx(px, py)] = 1;
  });
  const obj = (x, y, o) => { if (grid.in(x, y) && grid.o(x, y) === 0 && grid.t(x, y) !== T.WATER && grid.t(x, y) !== T.DEEP) grid.setO(x, y, o); };
  // torre: ocupa a área toda (bloqueada para quem anda) e leva o modelo e a altura que o cliente desenha
  const tower = (x, y, w, h, face, model, extra = {}) => {
    grid.rect(x, y, w, h, (px, py) => { grid.setO(px, py, O.BUILDING); grid.setT(px, py, T.SANDSTONE); grid.pathMask[idx(px, py)] = 0; });
    S.push({ kind: 'house', type: 'voxel', x, y, w, h, face, seed: towerId++, floors: 4, model, ...extra });
  };
  // casa de adobe visitável: paredes e telhado das peças da vila em cor de areia, porta voltada para a avenida
  const house = (x, y, w, h, face, extra = {}) => {
    grid.rect(x, y, w, h, (px, py) => { grid.setO(px, py, O.BUILDING); grid.setT(px, py, T.SANDSTONE); grid.pathMask[idx(px, py)] = 0; });
    const st = { kind: 'house', type: 'house', style: 'sand', x, y, w, h, face, seed: towerId++, floors: hash2(x, y, 16) < 0.45 ? 2 : 1, ...extra };
    st.door = Math.floor(hash2(x, y, 71) * modules(st));
    S.push(st);
  };
  // quintal sem prédio: areia com palmeiras, cactos e arbustos secos
  const yard = (x, y, w, h) => {
    grid.rect(x, y, w, h, (px, py) => {
      if (grid.o(px, py) === O.BUILDING) return;
      grid.setT(px, py, T.SAND);
      const r = rng();
      grid.setO(px, py, r < 0.1 ? O.PALM : r < 0.24 ? O.CACTUS : r < 0.55 ? O.DRYBUSH : 0);
    });
  };
  // viela de serviço entre duas fileiras, com tralha encostada nas paredes
  const lane = (x, y, w, h) => {
    pave(x, y, w, h, T.DIRT);
    for (let i = 2; i < w - 2; i++) {
      if (rng() > 0.07) continue;
      const py = y + (rng() < 0.5 ? 0 : h - 1);
      const r = rng();
      grid.setO(x + i, py, r < 0.3 ? O.BARREL : r < 0.55 ? O.CRATE : r < 0.75 ? O.SACK : r < 0.9 ? O.CLOTH : O.DRYBUSH);
      i += 2;
    }
  };

  // Fileira de torres de x0 a x1 (inclusive) a partir de y, profundidade d, fachada voltada para 'n' ou 's'
  const row = (x0, x1, y, d, face) => {
    let x = x0;
    while (x <= x1) {
      const left = x1 - x + 1;
      if (left < 4) { yard(x, y, left, d); break; }
      // pátio entre duas torres, de vez em quando
      if (x > x0 && left > 9 && hash2(x, y, 12) < 0.1) { yard(x, y, 3, d); x += 3; continue; }
      const r = hash2(x, y, 11);
      // de vez em quando um casarão largo (9 de frente) em vez de duas ou três torres
      let w = left >= 9 && hash2(x, y, 15) < 0.14 ? 9 : r < 0.4 ? 4 : r < 0.8 ? 5 : 6;
      if (w > left || (left - w > 0 && left - w < 4)) w = Math.min(left, 9);
      const model = pickModel(w, hash2(x, y, 13));
      tower(x, y, w, d, face, model, { maxH: 9 + Math.floor(hash2(x, y, 14) * 7) });
      x += w;
    }
  };

  // Fileira de casas de adobe (visitáveis), do mesmo jeito que as torres: larguras de 4 a 6, pátios de vez em quando
  const houseRow = (x0, x1, y, d, face) => {
    let x = x0;
    while (x <= x1) {
      const left = x1 - x + 1;
      if (left < 4) { yard(x, y, left, d); break; }
      if (x > x0 && left > 9 && hash2(x, y, 12) < 0.1) { yard(x, y, 3, d); x += 3; continue; }
      const r = hash2(x, y, 11);
      let w = r < 0.4 ? 4 : r < 0.8 ? 5 : 6;
      if (w > left || (left - w > 0 && left - w < 4)) w = Math.min(left, 9);
      house(x, y, w, d, face);
      x += w;
    }
  };

  // ------------------------------------------------------------ chão base: areia com dunas
  grid.rect(0, 0, W, H, (x, y) => grid.setT(x, y, fbm(x * 0.08, y * 0.08, zone.gen.seed, 3) > 0.56 ? T.DUNE : T.SAND));

  // ------------------------------------------------------------ ruas
  pave(3, 3, 104, 3); pave(3, 75, 104, 3);        // ruas de contorno (norte e sul)
  pave(3, 3, 3, 75); pave(104, 3, 3, 75);          // (oeste e leste)
  pave(3, 18, 104, 3); pave(3, 60, 104, 3);        // ruas dos Tintureiros e dos Ourives
  pave(3, 33, 104, 15);                            // Avenida do Sol e as calçadas dos dois lados
  pave(52, 3, 7, 75);                              // Avenida das Palmeiras
  pave(24, 3, 3, 75); pave(84, 3, 3, 75);          // ruas transversais
  pave(0, 36, 3, 9); pave(52, 0, 7, 3);            // portões: oeste (dunas) e norte (tumbas)

  // ------------------------------------------------------------ quarteirões de torres (4 faixas de 12 de altura)
  const SEG = [[6, 23], [27, 51], [59, 83], [87, 103]];
  const blocks = [[6, 'n', 's'], [21, 'n', 's'], [48, 'n', 's'], [63, 'n', 's']];
  for (const [y0, fa, fb] of blocks) {
    for (const [a, b] of SEG) {
      // as fileiras que dão para a Avenida do Sol são casas de adobe visitáveis; as outras, torres em voxel
      (y0 === 48 ? houseRow : row)(a, b, y0, 5, fa);
      lane(a, y0 + 5, b - a + 1, 2);
      (y0 === 21 ? houseRow : row)(a, b, y0 + 7, 5, fb);
    }
  }

  // ------------------------------------------------------------ Praça do Oásis
  const cx = 55, cy = 40;
  grid.disc(cx, cy, 8, (x, y) => { if (grid.o(x, y) !== O.BUILDING) { grid.setT(x, y, T.SANDSTONE); grid.setO(x, y, 0); grid.pathMask[idx(x, y)] = 1; } });
  grid.disc(cx, cy, 4.2, (x, y, d) => { grid.setT(x, y, d < 2.6 ? T.DEEP : T.WATER); grid.pathMask[idx(x, y)] = 0; });
  for (let a = 0; a < 10; a++) {
    const ang = (a / 10) * Math.PI * 2 + 0.3;
    const x = Math.round(cx + Math.cos(ang) * 4.9), y = Math.round(cy + Math.sin(ang) * 4.9);
    obj(x, y, a % 2 ? O.REEDS : O.PALM);
  }
  obj(cx, cy - 7, O.OBELISK);

  // ------------------------------------------------------------ Avenida do Sol: palmeiras, barracas e braseiros
  for (let x = 8; x < 104; x += 5) {
    if (Math.hypot(x - cx, 33 - cy) > 9) obj(x, 33, O.PALM);
    if (Math.hypot(x - cx, 47 - cy) > 9) obj(x, 47, O.PALM);
  }
  const GOODS = [O.CLOTH, O.GOLD, O.BARS, O.SACK, O.KEG, O.CRATE, O.BARREL];
  const stalls = [];
  for (const x of [30, 34, 38, 46, 64, 68, 76, 80]) { stalls.push([x, 35], [x, 45]); }
  stalls.forEach(([x, y], i) => {
    obj(x, y, O.STALL);
    obj(x + 1, y + (y < cy ? -1 : 1), GOODS[(i * 3 + x) % GOODS.length]);
  });
  for (const x of [10, 22, 34, 44, 66, 76, 90]) { obj(x, 36, O.BRAZIER); obj(x, 44, O.BRAZIER); }
  // braseiros nos cruzamentos das ruas transversais
  for (const [x, y] of [[23, 17], [27, 17], [23, 61], [27, 61], [83, 17], [87, 17], [83, 61], [87, 61], [51, 17], [59, 17], [51, 61], [59, 61]]) obj(x, y, O.BRAZIER);

  // ------------------------------------------------------------ Palácio do Emir (a leste da avenida, de frente para o oeste)
  tower(94, 34, 10, 13, 'w', 'TallBuilding03', { maxH: 20, maxScale: 2.6, label: 'Palácio do Emir', floors: 6 });
  obj(93, 36, O.BANNER); obj(93, 44, O.BANNER); obj(92, 38, O.BRAZIER); obj(92, 42, O.BRAZIER);

  // ------------------------------------------------------------ ferraria ao ar livre, na calçada
  obj(74, 35, O.ANVIL); obj(70, 35, O.RACK); obj(75, 33, O.TOOLS);

  // ------------------------------------------------------------ nomes e serviços: a forja de Dahmir e a taverna do oásis
  const houses = S.filter((st) => st.kind === 'house' && st.type === 'house');
  // a casa mais próxima de (x, y) entre as da fileira que começa em y
  const nearest = (x, y) => houses.filter((st) => st.y === y).sort((a, b) => Math.abs(a.x + a.w / 2 - x) - Math.abs(b.x + b.w / 2 - x))[0];
  const smithy = nearest(72, 28), tavern = nearest(64, 48), bazaar = nearest(40, 28);
  if (smithy) Object.assign(smithy, { type: 'smithy', label: 'Forja de Dahmir', floors: 1 });
  if (tavern) Object.assign(tavern, { type: 'tavern', label: 'Taverna do Oásis', floors: 2 });
  if (bazaar) Object.assign(bazaar, { type: 'alchemy', label: 'Casa das Essências', floors: 2 });

  // ------------------------------------------------------------ borda do mapa: palmeiras, cactos e pedras
  const edge = [O.PALM, O.CACTUS, O.ROCK, O.PALM, O.DRYBUSH];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const d = Math.min(x, y, W - 1 - x, H - 1 - y);
    if (d < 2 || (d === 2 && hash2(x, y, 3) < 0.5)) {
      if (grid.pathMask[idx(x, y)] || grid.o(x, y) === O.BUILDING) continue;
      grid.setO(x, y, edge[Math.floor(hash2(x, y, 9) * edge.length)]);
    }
  }
  // a rua em frente a cada porta fica livre de palmeiras, braseiros e barracas
  for (const st of S) {
    if (st.kind !== 'house') continue;
    // (os tiles vizinhos também: uma palmeira ao lado fecharia o trecho de rua e o gerador o encheria de árvores)
    for (const [fx, fy] of doorFront(st)) {
      for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const x = fx + dx, y = fy + dy;
        if (grid.in(x, y) && grid.o(x, y) !== O.BUILDING && OBJ_INFO[grid.o(x, y)].block) grid.setO(x, y, 0);
      }
    }
  }
  // portais: chão livre ao redor
  for (const p of zone.portals) {
    pave(p.x, p.y, p.w, p.h);
    grid.rect(p.x - 2, p.y - 2, p.w + 4, p.h + 4, (x, y) => { if (grid.o(x, y) !== O.BUILDING && OBJ_INFO[grid.o(x, y)].block) grid.setO(x, y, 0); });
  }
  return grid;
}
