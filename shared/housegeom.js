// Geometria das casas que se pode visitar. Cada casa do mapa vira uma sala com paredes finas (retângulos de colisão
// menores que um tile) e um vão na porta; por dentro o chão é livre. O cliente monta as paredes na mesma grade de 2 m
// (village.js), então as medidas daqui seguem as peças: a parede ocupa 31,4 cm para dentro da linha do módulo e
// 9,2 cm para fora; o vão da porta tem 130 cm (a moldura cobre até ±70 cm).
import { addBlocker } from './collision.js';

// Largura da fachada em tiles e número de módulos de 2 m (o cliente monta as paredes nessa grade)
export const frontWidth = (st) => (st.face === 'e' || st.face === 'w' ? st.h : st.w);
export const modules = (st) => Math.max(2, Math.floor(frontWidth(st) / 2));
const NO_DOOR = new Set(['keeptower', 'belltower', 'market', 'voxel']); // construções maciças: sem porta nem interior

export const WALL_IN = 0.314; // m: da linha do módulo para dentro (face interna da parede)
export const DOOR_HALF = 0.7; // m: meia largura do vão da porta nos retângulos de colisão

// Módulo da fachada onde fica a porta (-1 se a construção não tem porta); o mesmo valor vale no cliente
export function doorIndex(st) {
  if (NO_DOOR.has(st.type)) return -1;
  return st.door ?? Math.floor((modules(st) - 1) / 2);
}

// Tiles de rua logo em frente à porta (o módulo de 2 m da porta), em coordenadas do mapa
export function doorFront(st) {
  const i = doorIndex(st);
  if (i < 0) return [];
  const pad = (frontWidth(st) - modules(st) * 2) / 2;
  const u0 = pad + i * 2, u1 = u0 + 2; // intervalo ao longo da fachada, a partir da esquerda de quem olha de fora
  const span = (a, b) => { const lo = Math.floor(Math.min(a, b) + 1e-6), hi = Math.ceil(Math.max(a, b) - 1e-6); const r = []; for (let t = lo; t < hi; t++) r.push(t); return r; };
  switch (st.face) {
    case 'n': return span(st.x + st.w - u1, st.x + st.w - u0).map((x) => [x, st.y - 1]);
    case 'e': return span(st.y + st.h - u1, st.y + st.h - u0).map((y) => [st.x + st.w, y]);
    case 'w': return span(st.y + u0, st.y + u1).map((y) => [st.x - 1, y]);
    default: return span(st.x + u0, st.x + u1).map((x) => [x, st.y + st.h]);
  }
}

// Direção (passo de tile) de fora para dentro, perpendicular à fachada
const INWARD = { s: [0, -1], n: [0, 1], e: [-1, 0], w: [1, 0] };

// Geometria de uma casa em coordenadas do mapa (tiles); null se não tem porta.
export function houseGeom(st) {
  const di = doorIndex(st);
  if (di < 0) return null;
  const side = st.face === 'e' || st.face === 'w';
  const fw = side ? st.h : st.w, fd = side ? st.w : st.h;
  const nx = modules(st), nz = Math.max(2, Math.floor(fd / 2));
  const W = nx * 2, D = nz * 2, FX = fw / 2, FZ = fd / 2;
  const cx = st.x + st.w / 2, cy = st.y + st.h / 2;
  // referencial local (x para a direita de quem olha de fora, z para a rua) -> mapa
  const toWorld = (lx, lz) => {
    switch (st.face) {
      case 'n': return [cx - lx, cy - lz];
      case 'e': return [cx + lz, cy - lx];
      case 'w': return [cx - lz, cy + lx];
      default: return [cx + lx, cy + lz];
    }
  };
  const rect = (lx0, lz0, lx1, lz1) => {
    const a = toWorld(lx0, lz0), b = toWorld(lx1, lz1);
    return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])];
  };
  const xc = -nx + 1 + 2 * di; // centro da porta (m, local)
  const rects = [
    rect(-FX, D / 2 - WALL_IN, xc - DOOR_HALF, FZ),
    rect(xc + DOOR_HALF, D / 2 - WALL_IN, FX, FZ),
    rect(-FX, -FZ, FX, -D / 2 + WALL_IN),
    rect(-FX, -FZ, -W / 2 + WALL_IN, FZ),
    rect(W / 2 - WALL_IN, -FZ, FX, FZ),
  ];
  return {
    st, seed: st.seed, nx, nz, W, D, rects,
    inner: rect(-W / 2 + WALL_IN, -D / 2 + WALL_IN, W / 2 - WALL_IN, D / 2 - WALL_IN),
    line: rect(-W / 2, -D / 2, W / 2, D / 2), // a linha das paredes (para saber se o jogador está dentro)
    foot: [st.x, st.y, st.x + st.w, st.y + st.h],
    door: toWorld(xc, D / 2), // centro do vão, na parede
    inward: INWARD[st.face || 's'],
    toWorld,
  };
}

// Marca no mapa as casas visitáveis: o terreno deixa de bloquear (as paredes finas assumem), `fp` guarda a casa
// de cada tile do terreno, `inside` os tiles de dentro (o A* só entra por eles) e `doorEdge` as passagens
// de fora para dentro pela porta.
export function applyHouses(map) {
  const rooms = [];
  for (const st of map.structures || []) if (st.kind === 'house') { const g = houseGeom(st); if (g) rooms.push(g); }
  if (!rooms.length) return map;
  const { w, h } = map;
  const n = w * h;
  map.rooms = rooms;
  map.fp = new Uint16Array(n);
  map.inside = new Uint16Array(n);
  map.rt = new Map();
  map.doorEdge = new Set();
  const inRect = (r, x, y) => x > r[0] && x < r[2] && y > r[1] && y < r[3];
  rooms.forEach((g, i) => {
    g.id = i + 1;
    const [fx0, fy0, fx1, fy1] = g.foot;
    for (let y = fy0; y < fy1; y++) for (let x = fx0; x < fx1; x++) {
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const k = y * w + x;
      map.fp[k] = g.id;
      map.block[k] = 0;
      if (inRect(g.inner, x + 0.5, y + 0.5)) map.inside[k] = g.id;
    }
    for (const r of g.rects) addBlocker(map, r[0], r[1], r[2], r[3]);
    // passagens pela porta: da rua para o primeiro tile de dentro (tiles de margem no caminho também liberam)
    const [ix, iy] = g.inward;
    const along = g.st.face === 'e' || g.st.face === 'w' ? 1 : 0; // eixo ao longo da fachada
    for (const [fx, fy] of doorFront(g.st)) {
      // só os tiles alinhados com o vão (o módulo de 2 m pode cobrir 3 tiles em casas de largura ímpar)
      if (Math.abs((along ? fy : fx) + 0.5 - g.door[along]) > 0.55) continue;
      const path = [];
      let ok = false;
      for (let s = 1; s <= 3; s++) {
        const tx = fx + ix * s, ty = fy + iy * s;
        if (tx < 0 || ty < 0 || tx >= w || ty >= h) break;
        path.push(ty * w + tx);
        if (map.inside[ty * w + tx] === g.id) { ok = true; break; }
      }
      if (!ok) continue;
      for (const k of path) map.inside[k] = g.id;
      const from = fy * w + fx;
      map.doorEdge.add(from + ':' + path[0]);
      map.doorEdge.add(path[0] + ':' + from);
    }
  });
  return map;
}

// Casa (da lista map.rooms) em que o ponto está; `slack` > 0 estica a linha das paredes (histerese ao sair).
export function roomAt(map, x, y, slack = 0) {
  if (!map.fp) return null;
  const tx = Math.floor(x), ty = Math.floor(y);
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const px = tx + dx, py = ty + dy;
    if (px < 0 || py < 0 || px >= map.w || py >= map.h) continue;
    const id = map.fp[py * map.w + px];
    if (!id) continue;
    const l = map.rooms[id - 1].line;
    if (x > l[0] - slack && x < l[2] + slack && y > l[1] - slack && y < l[3] + slack) return map.rooms[id - 1];
  }
  return null;
}
