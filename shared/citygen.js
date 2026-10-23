// Cidade de Alvorada, a capital: cidade murada (112 × 96 tiles) com castelo ao norte, Avenida Real,
// Praça da Chama, rua do comércio entre o Portão Leste e a muralha oeste, mercado, bairro dos artesãos,
// capela com cemitério e bairros de casas geminadas com becos. As coordenadas das construções
// especiais e dos NPCs (shared/data/npcs.js) foram planejadas juntas; os quarteirões são preenchidos
// por um gerador determinístico.
import { T, O, OBJ_INFO } from './tiles.js';
import { mulberry32, hash2 } from './rng.js';
import { doorIndex, doorFront, modules } from './housegeom.js';

export { doorIndex, doorFront };

export function buildCapital(grid, zone) {
  const rng = mulberry32(zone.gen.seed);
  const S = grid.structures;
  const idx = (x, y) => grid.i(x, y);
  let houseSeed = 1;

  // ------------------------------------------------------------ primitivas
  // ruas nunca atravessam muralhas e torres
  const pave = (x, y, w, h, t = T.COBBLE) => grid.rect(x, y, w, h, (px, py) => {
    if (grid.o(px, py) === O.WALL) return;
    grid.setT(px, py, t); grid.setO(px, py, 0); grid.pathMask[idx(px, py)] = 1;
  });
  const ground = (x, y, w, h, t) => grid.rect(x, y, w, h, (px, py) => grid.setT(px, py, t));
  const obj = (x, y, o) => { if (grid.in(x, y) && grid.o(x, y) !== O.BUILDING && grid.o(x, y) !== O.WALL) grid.setO(x, y, o); };
  const wall = (x, y, w, h, extra = {}) => {
    grid.rect(x, y, w, h, (px, py) => { grid.setT(px, py, T.STONE); grid.setO(px, py, O.WALL); grid.pathMask[idx(px, py)] = 0; });
    S.push({ kind: 'wall', x, y, w, h, ...extra });
  };
  const tower = (x, y, size = 3, extra = {}) => {
    grid.rect(x, y, size, size, (px, py) => { grid.setT(px, py, T.STONE); grid.setO(px, py, O.WALL); grid.pathMask[idx(px, py)] = 0; });
    S.push({ kind: 'tower', x, y, w: size, h: size, ...extra });
  };
  const gate = (x, y, w, h, dir) => { pave(x, y, w, h); S.push({ kind: 'gate', x, y, w, h, dir }); };
  // casa: face = lado da fachada ('n', 's', 'e', 'w'); andares 1–3
  const house = (x, y, w, h, face, extra = {}) => {
    // pedra sob a casa: nada de grama aparecendo por baixo
    grid.rect(x, y, w, h, (px, py) => { grid.setO(px, py, O.BUILDING); grid.setT(px, py, T.STONE); grid.pathMask[idx(px, py)] = 0; });
    const st = { kind: 'house', type: 'house', x, y, w, h, face, seed: houseSeed++, floors: 1, ...extra };
    // casas comuns têm a porta num módulo qualquer da fachada (escolha estável, sem gastar o gerador aleatório)
    if (st.type === 'house') st.door = Math.floor(hash2(x, y, 71) * modules(st));
    S.push(st);
  };
  const floorsFor = () => { const r = rng(); return r < 0.4 ? 1 : r < 0.85 ? 2 : 3; };
  // Torres de adobe em voxel (assets/voxel): construções maciças, sem porta nem interior, que ocupam o lugar de algumas casas
  // de um quarteirão (a escolha vem de um hash da posição, então o resto da cidade continua exatamente igual).
  // O modelo (st.model) é desenhado pelo cliente (client/js/three/voxel.js) e cabe na área w × h.
  let voxelRate = 0, voxelCount = 0;
  const VOXELS = ['SmallBuilding01', 'TallBuilding01', 'TallBuilding02', 'TallBuilding03'];
  const voxel = (x, y, w, h, face) => {
    grid.rect(x, y, w, h, (px, py) => { grid.setO(px, py, O.BUILDING); grid.setT(px, py, T.STONE); grid.pathMask[idx(px, py)] = 0; });
    S.push({ kind: 'house', type: 'voxel', x, y, w, h, face, seed: 9000 + voxelCount++, floors: 4, model: VOXELS[Math.floor(hash2(x, y, 93) * VOXELS.length)] });
  };
  const lamp = (x, y) => obj(x, y, O.LAMP);
  // jardim ou quintal: grama com arbustos, flores e uma árvore de vez em quando
  const garden = (x, y, w, h) => {
    ground(x, y, w, h, T.GRASS);
    grid.rect(x, y, w, h, (px, py) => {
      if (grid.o(px, py)) return;
      const r = rng();
      grid.setO(px, py, r < 0.18 ? O.TREE : r < 0.5 ? O.BUSH : r < 0.8 ? O.FLOWERS : 0);
    });
  };
  // beco: chão de terra com tralhas encostadas numa das paredes (nunca bloqueia a passagem)
  const alley = (x, y, w, h, horizontal) => {
    pave(x, y, w, h, T.DIRT);
    const len = horizontal ? w : h;
    for (let i = 1; i < len - 1; i++) {
      if (rng() > 0.09) continue;
      const side = rng() < 0.5 ? 0 : (horizontal ? h : w) - 1;
      const px = horizontal ? x + i : x + side, py = horizontal ? y + side : y + i;
      const r = rng();
      grid.setO(px, py, r < 0.24 ? O.BARREL : r < 0.44 ? O.CRATE : r < 0.58 ? O.SACK : r < 0.7 ? O.LUMBER : r < 0.8 ? O.PLANKS : r < 0.88 ? O.CLOTH : O.LAMP);
      i += 2;
    }
  };

  // Fileira de casas geminadas de x0 a x1 (inclusive), profundidade d, fachada para 'n' ou 's'
  const row = (x0, x1, y0, d, face) => {
    let x = x0;
    while (x <= x1) {
      const left = x1 - x + 1;
      if (left < 4) { garden(x, y0, left, d); break; }
      if (x > x0 && left > 9 && rng() < 0.14) { // viela até o beco de trás
        alley(x, y0, 2, d, false);
        x += 2;
        continue;
      }
      let lw = rng() < 0.55 ? 4 : 6;
      const rest = left - lw;
      if (rest > 0 && rest < 4) lw = rest + lw <= 6 ? left : lw === 4 ? 6 : 4;
      if (lw > left) lw = left >= 6 ? 6 : 4;
      const floors = floorsFor();
      if (voxelRate && d >= 4 && hash2(x, y0, 91) < voxelRate) { houseSeed++; voxel(x, y0, lw, d, face); } else house(x, y0, lw, d, face, { floors });
      x += lw;
    }
  };

  // Bairro: faixas de quarteirões (fileira para cima, beco, fileira para baixo) separadas por ruas;
  // ruas verticais cortam o bairro. As bordas de cima e de baixo devem dar para ruas.
  const district = (x0, y0, x1, y1, opts = {}) => {
    const W = x1 - x0 + 1, H = y1 - y0 + 1;
    const nv = opts.vstreets ?? Math.floor(W / 20);
    const vs = [];
    for (let i = 1; i <= nv; i++) vs.push(x0 + Math.round((i * W) / (nv + 1)) - 1);
    const segments = [];
    let sx = x0;
    for (const v of vs) { segments.push([sx, v - 1]); sx = v + 3; }
    segments.push([sx, x1]);
    // alturas das faixas
    let k = 0;
    while ((k + 1) * 10 + k * 3 <= H) k++;
    const bands = [];
    let extra = H - (k * 10 + Math.max(0, k - 1) * 3);
    for (let i = 0; i < k; i++) {
      const a = extra >= 2 ? 6 : 4; if (a === 6) extra -= 2;
      const b = extra >= 2 ? 6 : 4; if (b === 6) extra -= 2;
      bands.push([a, b]);
    }
    let y = y0;
    if (!k) {
      // faixa estreita: uma fileira só, virada para a rua indicada
      const d = H >= 6 ? 6 : 4;
      const yy = opts.face === 'n' ? y0 : y1 - d + 1;
      for (const [a, b] of segments) row(a, b, yy, d, opts.face || 's');
      if (H > d) garden(x0, opts.face === 'n' ? y0 + d : y0, W, H - d);
    }
    bands.forEach(([a, b], i) => {
      for (const [s0, s1] of segments) row(s0, s1, y, a, 'n');
      alley(x0, y + a, W, 2, true);
      for (const [s0, s1] of segments) row(s0, s1, y + a + 2, b, 's');
      y += a + 2 + b;
      if (i < bands.length - 1) {
        pave(x0, y, W, 3);
        lamp(x0 + 2 + Math.floor(rng() * 4), y);
        y += 3;
      }
    });
    // sobra no fim: beco de serviço + uma fileira virada para a rua de baixo
    const L = y1 - y + 1;
    if (k && L >= 8) {
      const d = L - 2 >= 6 ? 6 : 4;
      alley(x0, y, W, 2, true);
      if (L - 2 - d > 0) garden(x0, y + 2, W, L - 2 - d);
      for (const [s0, s1] of segments) row(s0, s1, y1 - d + 1, d, 's');
    } else if (k && L > 0) garden(x0, y, W, L);
    for (const v of vs) {
      pave(v, y0, 3, H);
      for (let ly = y0 + 3; ly < y1; ly += 9) lamp(v, ly);
    }
  };

  // ------------------------------------------------------------ chão base
  grid.rect(0, 0, grid.w, grid.h, (x, y) => grid.setT(x, y, T.GRASS));

  // ------------------------------------------------------------ muralha da cidade
  wall(0, 0, 112, 1);
  wall(0, 95, 55, 1); gate(55, 95, 3, 1, 's'); wall(58, 95, 54, 1);
  wall(0, 1, 1, 94);
  wall(111, 1, 1, 44); gate(111, 45, 1, 4, 'e'); wall(111, 49, 1, 46);
  for (const [x, y] of [[0, 0], [109, 0], [0, 93], [109, 93], [17, 0], [92, 0], [17, 93], [35, 93], [75, 93], [92, 93],
    [0, 22], [0, 45], [0, 70], [109, 20], [109, 72], [52, 93], [58, 93], [109, 42], [109, 49]]) tower(x, y);

  // vielas junto às muralhas
  pave(3, 3, 2, 90, T.DIRT); pave(107, 3, 2, 90, T.DIRT);
  pave(3, 3, 32, 2, T.DIRT); pave(76, 3, 33, 2, T.DIRT);
  pave(3, 91, 106, 2, T.DIRT);

  // ------------------------------------------------------------ castelo
  pave(37, 1, 38, 27, T.STONE);
  const castle = { castle: true };
  wall(36, 1, 1, 27, castle); wall(75, 1, 1, 27, castle);
  wall(36, 28, 19, 1, castle); gate(55, 28, 3, 1, 's'); wall(58, 28, 18, 1, castle);
  for (const [x, y] of [[35, 0], [74, 0], [35, 27], [74, 27], [52, 27], [58, 27]]) tower(x, y, 3, { castle: true });
  pave(34, 3, 2, 34, T.DIRT); pave(76, 3, 2, 25, T.DIRT); // vielas ao longo das muralhas do castelo
  house(49, 5, 15, 8, 's', { type: 'keep', label: 'Salão dos Guardiões', floors: 3 });
  house(45, 8, 4, 4, 's', { type: 'keeptower', floors: 5 });
  house(64, 8, 4, 4, 's', { type: 'keeptower', floors: 5 });
  house(38, 13, 6, 8, 'e', { type: 'barracks', label: 'Quartel', floors: 2 });
  house(69, 13, 6, 8, 'w', { type: 'armory', label: 'Arsenal', floors: 2 });
  // pátio de treino, estandartes, braseiros e jardim do castelo
  for (const x of [40, 42, 44]) obj(x, 23, O.TARGET);
  obj(39, 25, O.RACK); obj(46, 25, O.RACK); obj(47, 22, O.BARREL); obj(42, 26, O.ANVIL); obj(44, 26, O.TOOLS); obj(51, 24, O.LANTERN); obj(62, 24, O.LANTERN);
  obj(52, 13, O.BANNER); obj(61, 13, O.BANNER);
  obj(53, 25, O.BRAZIER); obj(60, 25, O.BRAZIER); obj(50, 16, O.LAMP); obj(63, 16, O.LAMP);
  obj(67, 14, O.BARREL); obj(67, 15, O.CRATE); obj(67, 20, O.RACK);
  ground(63, 21, 11, 6, T.GRASS);
  for (const [x, y] of [[64, 22], [71, 22], [73, 25], [66, 26]]) obj(x, y, O.TREE);
  for (const [x, y] of [[68, 21], [65, 24], [70, 25], [72, 23]]) obj(x, y, O.FLOWERS);
  obj(68, 24, O.WELL);
  ground(38, 2, 10, 5, T.GRASS);
  for (const [x, y] of [[39, 3], [43, 3], [46, 4], [40, 6]]) obj(x, y, O.TREE);
  ground(65, 2, 9, 5, T.GRASS);
  for (const [x, y] of [[67, 3], [71, 3], [73, 5]]) obj(x, y, O.PINE);

  // ------------------------------------------------------------ eixos principais
  pave(54, 29, 5, 9);          // Avenida Real (castelo -> praça)
  pave(5, 36, 104, 3);         // rua norte (dos artesãos ao mercado)
  pave(1, 45, 110, 4);         // rua do comércio (muralha oeste -> Portão Leste)
  pave(5, 55, 104, 3);         // rua sul
  pave(54, 58, 5, 33);         // avenida sul até o Portão Sul
  pave(55, 91, 3, 4);
  pave(76, 27, 33, 2);         // rua atrás do cofre
  pave(44, 38, 26, 18);        // Praça da Chama
  pave(76, 39, 22, 16);        // Praça do Mercado
  for (let y = 30; y < 37; y += 3) { lamp(54, y); lamp(58, y); }
  for (const x of [8, 24, 40, 72, 100]) { lamp(x, 36); lamp(x + 6, 57); }

  // Praça da Chama, simétrica em torno do eixo da fonte (x = 56,5; y = 46,5): cruz de lajes de pedra com 3 tiles de largura,
  // anel de lajes em volta da fonte, quatro postes no anel, quatro canteiros nas diagonais e uma árvore em cada canto
  ground(55, 38, 3, 18, T.STONE); ground(44, 45, 26, 3, T.STONE);
  grid.rect(53, 43, 7, 7, (x, y) => { if (x === 53 || x === 59 || y === 43 || y === 49) grid.setT(x, y, T.STONE); });
  grid.rect(55, 45, 3, 3, (x, y) => grid.setO(x, y, O.FOUNTAIN));
  for (const [x, y] of [[45, 39], [67, 39], [45, 53], [67, 53]]) obj(x, y, O.TREE);
  for (const [x, y] of [[53, 43], [59, 43], [53, 49], [59, 49]]) lamp(x, y);
  for (const [x, y] of [[49, 43], [50, 43], [62, 43], [63, 43], [49, 49], [50, 49], [62, 49], [63, 49]]) { ground(x, y, 1, 1, T.GRASS); obj(x, y, O.FLOWERS); }
  obj(53, 38, O.BANNER); obj(59, 38, O.BANNER);

  // Mercado: duas fileiras de barracas, caixotes e sacos
  for (const x of [79, 83, 87, 91]) { obj(x, 41, O.STALL); obj(x, 52, O.STALL); }
  // terraço da taverna: mesas postas e barris de cerveja
  for (const [x, y, o] of [[95, 40, O.TABLE], [95, 43, O.TABLE], [97, 41, O.KEG], [93, 39, O.KEG], [95, 51, O.TABLE], [97, 53, O.KEG]]) obj(x, y, o);
  for (const [x, y, o] of [[80, 42, O.CLOTH], [84, 40, O.SACK], [88, 42, O.BARS], [92, 40, O.PLANKS], [90, 43, O.CLOTH],
    [80, 51, O.BRICKS], [84, 53, O.CRATE], [88, 51, O.CLOTH], [92, 53, O.PLANKS], [90, 50, O.BARS], [78, 43, O.BARREL], [94, 50, O.SACK]]) obj(x, y, o);
  lamp(77, 40); lamp(96, 40); lamp(77, 53); lamp(96, 53);

  // ------------------------------------------------------------ construções especiais
  house(34, 39, 10, 6, 's', { type: 'smithy', label: 'Ferraria', floors: 1 });
  house(30, 49, 8, 6, 'n', { type: 'alchemy', label: 'Alquimia', floors: 2 });
  house(82, 30, 10, 6, 's', { type: 'bank', label: 'Cofre', floors: 2 });
  house(98, 39, 8, 6, 's', { type: 'tavern', label: 'Taverna do Javali Dourado', floors: 2 });
  house(98, 49, 8, 6, 'n', { type: 'guardhouse', label: 'Casa da Guarda', floors: 2 });
  obj(106, 41, O.BRAZIER); obj(106, 52, O.BRAZIER); obj(105, 45, O.BANNER); obj(105, 48, O.BANNER);
  obj(35, 45, O.RACK); obj(37, 45, O.ANVIL); obj(39, 45, O.TOOLS); obj(42, 45, O.BRICKS); obj(43, 44, O.LUMBER); obj(42, 44, O.BARREL); obj(44, 44, O.TOOLS);
  obj(82, 36, O.GOLD); obj(91, 36, O.GOLD); obj(83, 36, O.CHEST); obj(90, 36, O.CHEST); // o ouro do Cofre, à vista na porta
  obj(68, 16, O.BARS); obj(68, 18, O.BARS);
  obj(29, 48, O.BARREL);

  // ------------------------------------------------------------ fileiras e bairros
  row(5, 33, 39, 6, 's');                         // artesãos ao norte da rua do comércio
  row(5, 29, 49, 6, 'n');                         // artesãos ao sul
  row(38, 43, 49, 6, 'n');
  row(70, 75, 39, 6, 's'); row(70, 75, 49, 6, 'n');
  row(37, 52, 30, 6, 's');                        // casas nobres junto ao castelo
  row(60, 75, 30, 6, 's');
  row(78, 81, 30, 6, 's'); row(92, 106, 30, 6, 's');
  voxelRate = 0.05;                               // uma torre de adobe aqui e ali
  district(5, 5, 33, 35);                         // bairro noroeste
  district(78, 5, 106, 26, { face: 's' });        // bairro nordeste
  district(5, 58, 53, 90);                        // bairro sudoeste
  voxelRate = 0.6;                                // Bairro das Torres: a maior parte do quarteirão é de torres
  district(59, 58, 85, 90);                       // bairro sudeste
  voxelRate = 0;

  // ------------------------------------------------------------ capela e cemitério
  pave(86, 58, 4, 33);
  house(91, 60, 8, 12, 'w', { type: 'chapel', label: 'Capela da Chama', floors: 2 });
  house(99, 64, 4, 4, 'w', { type: 'belltower', floors: 5 });
  garden(99, 58, 8, 6); garden(103, 64, 4, 9); garden(99, 68, 4, 5);
  ground(90, 73, 17, 18, T.GRASS);
  grid.rect(91, 75, 15, 15, (x, y) => {
    const edge = x === 91 || y === 75 || x === 105 || y === 89;
    if (edge) { if (!(x === 91 && (y === 81 || y === 82))) grid.setO(x, y, O.FENCE); }
    else if (x % 2 === 1 && y % 3 === 0) grid.setO(x, y, O.GRAVE);
    else if (rng() < 0.05) grid.setO(x, y, rng() < 0.5 ? O.PINE : O.DEADTREE);
  });
  pave(90, 81, 1, 2, T.DIRT);
  obj(89, 74, O.LAMP); obj(89, 62, O.LAMP);
  obj(90, 63, O.CANDLE); obj(90, 68, O.CANDLE); // velas na porta da capela
  grid.rect(92, 76, 13, 13, (x, y) => { if (grid.o(x, y) === O.GRAVE && rng() < 0.3) obj(x, y + 1, O.CANDLE); });

  // nenhuma porta dá para uma árvore, arbusto, poste ou caixote: limpa o que bloqueia a frente dela
  for (const st of S) {
    if (st.kind !== 'house') continue;
    for (const [x, y] of doorFront(st)) {
      if (!grid.in(x, y) || grid.o(x, y) === O.WALL || grid.o(x, y) === O.BUILDING) continue;
      if (OBJ_INFO[grid.o(x, y)].block) grid.setO(x, y, 0);
    }
  }

  // postes da rua do comércio: pares dos dois lados da rua, a cada 12 tiles, nunca na praça, no mercado nem na frente de uma porta
  const doors = new Set();
  for (const st of S) if (st.kind === 'house') for (const [x, y] of doorFront(st)) doors.add(y * grid.w + x);
  for (const x of [10, 22, 34, 72, 102]) {
    for (const y of [45, 48]) if (!doors.has(y * grid.w + x) && !grid.o(x, y)) lamp(x, y);
  }

  // portais: Portão Leste (Campos) e Portão Sul (Arena)
  for (const p of zone.portals) pave(p.x, p.y, p.w, p.h);
  return grid;
}
