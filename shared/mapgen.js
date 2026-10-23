// Geração procedural dos mapas das zonas (executada no servidor; o cliente recebe as camadas).
import { T, O, TILE_INFO, OBJ_INFO, isRock } from './tiles.js';
import { mulberry32, fbm, hash2 } from './rng.js';
import { NPCS } from './data/npcs.js';
import { buildCapital } from './citygen.js';
import { buildDesertCity } from './desertgen.js';
import { farmLayout } from './farm.js';

class Grid {
  constructor(w, h, base) {
    this.w = w; this.h = h;
    this.tiles = new Uint8Array(w * h).fill(base);
    this.objs = new Uint8Array(w * h);
    this.pathMask = new Uint8Array(w * h);
    this.lockMask = new Uint8Array(w * h); // áreas que não recebem obstáculos
    this.structures = [];
  }
  in(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  i(x, y) { return y * this.w + x; }
  t(x, y) { return this.in(x, y) ? this.tiles[this.i(x, y)] : -1; }
  o(x, y) { return this.in(x, y) ? this.objs[this.i(x, y)] : -1; }
  setT(x, y, t) { if (this.in(x, y)) this.tiles[this.i(x, y)] = t; }
  setO(x, y, o) { if (this.in(x, y)) this.objs[this.i(x, y)] = o; }
  walkable(x, y) {
    if (!this.in(x, y)) return false;
    const i = this.i(x, y);
    return TILE_INFO[this.tiles[i]].walk && !OBJ_INFO[this.objs[i]].block;
  }
  free(x, y) {
    // pode receber um objeto?
    if (!this.in(x, y)) return false;
    const i = this.i(x, y);
    return TILE_INFO[this.tiles[i]].walk && this.objs[i] === 0 && !this.pathMask[i] && !this.lockMask[i];
  }
  disc(cx, cy, r, fn) {
    const r2 = r * r;
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const d2 = (x - cx) * (x - cx) + (y - cy) * (y - cy);
        if (d2 <= r2 && this.in(x, y)) fn(x, y, Math.sqrt(d2));
      }
    }
  }
  rect(x0, y0, w, h, fn) {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (this.in(x, y)) fn(x, y);
  }
}

export function generateMap(zone) {
  const g = zone.gen;
  let grid;
  if (g.type === 'town') grid = genTown(zone);
  else if (g.type === 'cave') grid = genCave(zone);
  else if (g.type === 'arena') grid = genArena(zone);
  else if (g.type === 'desertcity') grid = genDesertCity(zone);
  else grid = genOutdoor(zone);
  clearNpcSpots(grid, zone);
  ensureConnectivity(grid, zone);
  return { w: grid.w, h: grid.h, tiles: grid.tiles, objs: grid.objs, structures: grid.structures };
}

// ---------------------------------------------------------------- utilidades

function clearNpcSpots(grid, zone) {
  for (const n of Object.values(NPCS)) {
    if (n.zone !== zone.id) continue;
    const nx = Math.floor(n.x), ny = Math.floor(n.y);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const x = nx + dx, y = ny + dy;
        if (!grid.in(x, y)) continue;
        if (grid.o(x, y) === O.BUILDING) continue;
        if (OBJ_INFO[grid.o(x, y)].block) grid.setO(x, y, 0);
        if (!TILE_INFO[grid.t(x, y)].walk) grid.setT(x, y, zone.gen.path ?? T.GRASS);
      }
    }
  }
}

// Tiles caminháveis que não se conectam ao ponto de entrada viram obstáculo.
function ensureConnectivity(grid, zone) {
  const { w, h } = grid;
  const seen = new Uint8Array(w * h);
  const sx = Math.floor(zone.spawn.x), sy = Math.floor(zone.spawn.y);
  const stack = [grid.i(sx, sy)];
  seen[stack[0]] = 1;
  while (stack.length) {
    const k = stack.pop();
    const x = k % w, y = (k - x) / w;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (!grid.in(nx, ny)) continue;
      const nk = grid.i(nx, ny);
      if (seen[nk] || !grid.walkable(nx, ny)) continue;
      seen[nk] = 1;
      stack.push(nk);
    }
  }
  const wallFill = zone.gen.type === 'cave' || zone.gen.type === 'arena';
  const wallTile = zone.gen.wall ?? T.CAVEWALL;
  const filler = wallFill ? null : (zone.gen.border ? zone.gen.border[0] : O.TREE);
  for (let k = 0; k < w * h; k++) {
    const x = k % w, y = (k - x) / w;
    if (!seen[k] && grid.walkable(x, y)) {
      if (filler == null) { grid.tiles[k] = wallTile; grid.objs[k] = 0; }
      else grid.objs[k] = filler;
    }
  }
}

// Caminho de custo mínimo (Dijkstra/A*) entre dois pontos; retorna lista de tiles.
function costPath(grid, ax, ay, bx, by, costFn) {
  const { w, h } = grid;
  const n = w * h;
  const dist = new Float32Array(n).fill(Infinity);
  const prev = new Int32Array(n).fill(-1);
  const heap = [];
  const push = (k, f) => {
    heap.push([f, k]);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p][0] <= heap[i][0]) break;
      [heap[p], heap[i]] = [heap[i], heap[p]]; i = p;
    }
  };
  const pop = () => {
    const top = heap[0], last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]]; i = m;
      }
    }
    return top;
  };
  const s = grid.i(ax, ay), goal = grid.i(bx, by);
  dist[s] = 0;
  push(s, 0);
  while (heap.length) {
    const [, k] = pop();
    if (k === goal) break;
    const x = k % w, y = (k - x) / w;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 1 || ny < 1 || nx >= w - 1 || ny >= h - 1) {
        if (!(nx === bx && ny === by)) continue;
      }
      const nk = ny * w + nx;
      const nd = dist[k] + costFn(nx, ny);
      if (nd < dist[nk]) {
        dist[nk] = nd; prev[nk] = k;
        push(nk, nd + (Math.abs(nx - bx) + Math.abs(ny - by)) * 0.9);
      }
    }
  }
  const out = [];
  let k = goal;
  while (k !== -1 && k !== s) { out.push(k); k = prev[k]; }
  out.push(s);
  return out.reverse().map((k) => ({ x: k % w, y: Math.floor(k / w) }));
}

function poiMap(g) {
  const m = {};
  for (const p of g.pois) m[p.id] = p;
  return m;
}

function pickObj(list, x, y, seed) {
  return list[Math.floor(hash2(x, y, seed + 77) * list.length)];
}

function clearArea(grid, cx, cy, r, tile) {
  grid.disc(cx, cy, r, (x, y) => {
    if (tile != null && !TILE_INFO[grid.t(x, y)].walk) grid.setT(x, y, tile);
    grid.setO(x, y, 0);
    grid.lockMask[grid.i(x, y)] = 1;
  });
  // borda suave: remove parte dos obstáculos ao redor
  grid.disc(cx, cy, r + 2.5, (x, y, d) => {
    if (d > r && OBJ_INFO[grid.o(x, y)].block && hash2(x, y, 5) < 0.6) grid.setO(x, y, 0);
  });
}

function clearPortals(grid, zone, tile) {
  for (const p of zone.portals) {
    grid.rect(p.x - 3, p.y - 3, p.w + 6, p.h + 6, (x, y) => {
      if (!TILE_INFO[grid.t(x, y)].walk) grid.setT(x, y, tile);
      grid.setO(x, y, 0);
      grid.lockMask[grid.i(x, y)] = 1;
    });
  }
}

// ---------------------------------------------------------------- exterior

function genOutdoor(zone) {
  const g = zone.gen;
  const { w, h } = zone;
  const seed = g.seed;
  const rng = mulberry32(seed);
  const grid = new Grid(w, h, g.base);
  const liquid = g.water && g.water.lava ? T.LAVA : T.WATER;

  // terreno base + líquidos
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const n = fbm(x * 0.07, y * 0.07, seed, 3);
      if (n > 0.56) grid.setT(x, y, g.alt);
      if (g.water) {
        const wn = fbm(x * g.water.scale, y * g.water.scale, seed + 50, 4);
        if (wn > g.water.thr) grid.setT(x, y, (liquid === T.WATER && wn > g.water.thr + 0.06) ? T.DEEP : liquid);
        else if (g.water.sand && wn > g.water.thr - 0.025) grid.setT(x, y, T.SAND);
      }
    }
  }
  // florestas por ruído
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!TILE_INFO[grid.t(x, y)].walk) continue;
      const fn = fbm(x * g.forest.scale, y * g.forest.scale, seed + 100, 3);
      if (fn > g.forest.thr && (fn > g.forest.thr + 0.07 || hash2(x, y, seed) < 0.55)) {
        grid.setO(x, y, pickObj(g.forest.objs, x, y, seed));
      }
    }
  }
  // objetos espalhados
  for (const s of g.scatter || []) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (grid.free(x, y) && rng() < s.p) grid.setO(x, y, s.o);
      }
    }
  }
  // borda do mapa
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = Math.min(x, y, w - 1 - x, h - 1 - y);
      if (d < 2 || (d === 2 && hash2(x, y, seed + 3) < 0.5)) {
        if (!TILE_INFO[grid.t(x, y)].walk) grid.setT(x, y, g.base);
        grid.setO(x, y, pickObj(g.border, x, y, seed + 9));
      }
    }
  }
  const pois = poiMap(g);
  for (const p of g.pois) clearArea(grid, p.x, p.y, p.r, g.base);
  clearPortals(grid, zone, g.path);

  // estradas
  const costFn = (x, y) => {
    const t = grid.t(x, y);
    let c = 1 + fbm(x * 0.15, y * 0.15, seed + 200, 2) * 4;
    if (t === T.WATER || t === T.DEEP || t === T.LAVA) c += 7;
    if (OBJ_INFO[grid.o(x, y)].block) c += 1.5;
    if (grid.pathMask[grid.i(x, y)]) c *= 0.4; // reaproveita estradas existentes
    return c;
  };
  for (const [a, b] of g.links) {
    const pa = pois[a], pb = pois[b];
    const path = costPath(grid, pa.x, pa.y, pb.x, pb.y, costFn);
    stampPath(grid, path, g.path, 1.0, 2.0);
  }
  // portais conectam ao caminho mais próximo via POI de borda (já ligados pelos links)
  for (const p of zone.portals) {
    grid.rect(p.x, p.y, p.w, p.h, (x, y) => grid.setT(x, y, g.path));
  }

  applyFeatures(grid, zone, rng);
  decorate(grid, g, rng);
  return grid;
}

function stampPath(grid, path, tile, rTile, rClear) {
  for (const { x, y } of path) {
    grid.disc(x, y, rClear, (px, py) => {
      const t = grid.t(px, py);
      if (OBJ_INFO[grid.o(px, py)].block) grid.setO(px, py, 0);
      if (isRock(t)) grid.setT(px, py, tile);
    });
    grid.disc(x, y, rTile, (px, py) => {
      const t = grid.t(px, py);
      if (t === T.WATER || t === T.DEEP || t === T.LAVA) grid.setT(px, py, T.BRIDGE);
      else if (t !== T.BRIDGE) grid.setT(px, py, tile);
      grid.pathMask[grid.i(px, py)] = 1;
      grid.setO(px, py, 0);
    });
  }
}

function decorate(grid, g, rng) {
  const { w, h } = grid;
  for (const d of g.decor || []) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (!grid.free(x, y)) continue;
        let p = d.p;
        if (d.nearWater) {
          let near = false;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const t = grid.t(x + dx, y + dy);
            if (t === T.WATER || t === T.DEEP) near = true;
          }
          if (near) p = d.nearWater;
        }
        if (p > 0 && rng() < p) grid.setO(x, y, d.o);
      }
    }
  }
}

function applyFeatures(grid, zone, rng) {
  for (const f of zone.gen.features || []) {
    const place = (x, y, o) => { if (grid.free(x, y)) grid.setO(x, y, o); };
    const placeForce = (x, y, o) => {
      if (grid.in(x, y) && TILE_INFO[grid.t(x, y)].walk && !grid.pathMask[grid.i(x, y)]) grid.setO(x, y, o);
    };
    switch (f.type) {
      case 'farm': {
        grid.rect(f.x, f.y, f.w, f.h, (x, y) => {
          if (grid.pathMask[grid.i(x, y)]) return;
          const edge = x === f.x || y === f.y || x === f.x + f.w - 1 || y === f.y + f.h - 1;
          grid.setO(x, y, 0);
          if (edge) {
            // portão no meio da cerca inferior
            if (!(y === f.y + f.h - 1 && Math.abs(x - (f.x + (f.w >> 1))) <= 1)) grid.setO(x, y, O.FENCE);
          } else {
            grid.setT(x, y, (y - f.y) % 2 === 0 ? T.DIRT : T.DARKGRASS);
            grid.lockMask[grid.i(x, y)] = 1;
          }
        });
        placeForce(f.x - 1, f.y + 1, O.HAY);
        placeForce(f.x - 1, f.y + 3, O.HAY);
        placeForce(f.x + f.w, f.y + 2, O.CART);
        placeForce(f.x + f.w, f.y + 5, O.TOOLS);
        break;
      }
      case 'farmstead': { // a fazenda: construções, currais com cerca e portão, lagoa das aves e terra batida em volta (shared/farm.js)
        const L = farmLayout();
        const lock = (x, y) => { if (grid.in(x, y)) grid.lockMask[grid.i(x, y)] = 1; };
        const clear = (x, y) => { if (grid.in(x, y)) { grid.setO(x, y, 0); lock(x, y); } };
        grid.rect(L.yard.x, L.yard.y, L.yard.w, L.yard.h, (x, y) => { if (TILE_INFO[grid.t(x, y)].walk && !grid.pathMask[grid.i(x, y)]) { grid.setT(x, y, T.DIRT); clear(x, y); } });
        for (const b of L.buildings) {
          grid.rect(b.x, b.y, b.w, b.h, (x, y) => { grid.setT(x, y, T.DIRT); grid.setO(x, y, O.BUILDING); lock(x, y); });
          grid.structures.push({ kind: 'farm', model: b.model, x: b.x, y: b.y, w: b.w, h: b.h, face: b.face });
        }
        for (const p of L.pens) {
          grid.rect(p.x, p.y, p.w, p.h, (x, y) => {
            const edge = x === p.x || y === p.y || x === p.x + p.w - 1 || y === p.y + p.h - 1;
            const gate = p.gate.side === 'n' || p.gate.side === 's'
              ? y === (p.gate.side === 'n' ? p.y : p.y + p.h - 1) && x >= p.gate.at && x < p.gate.at + p.gate.n
              : x === (p.gate.side === 'w' ? p.x : p.x + p.w - 1) && y >= p.gate.at && y < p.gate.at + p.gate.n;
            lock(x, y);
            if (grid.o(x, y) === O.BUILDING) return;
            grid.setO(x, y, edge && !gate ? O.FENCE : 0);
            if (!edge) grid.setT(x, y, (x + y) % 5 === 0 ? T.DARKGRASS : T.GRASS);
            else if (gate) grid.setT(x, y, T.DIRT);
          });
          if (p.pond) grid.rect(p.pond.x, p.pond.y, p.pond.w, p.pond.h, (x, y) => { grid.setT(x, y, T.WATER); grid.setO(x, y, 0); });
          grid.structures.push({ kind: 'pen', x: p.x, y: p.y, w: p.w, h: p.h, animals: p.animals, pond: p.pond || null });
        }
        for (const p of L.props) grid.structures.push({ kind: 'farmprop', m: p.m, x: p.x, y: p.y, rot: p.rot });
        break;
      }
      case 'shrine': {
        grid.disc(f.x, f.y, f.r, (x, y) => { grid.setT(x, y, T.RUIN); });
        for (let a = 0; a < 6; a++) {
          const ang = (a / 6) * Math.PI * 2 + Math.PI / 6;
          placeForce(Math.round(f.x + Math.cos(ang) * f.r), Math.round(f.y + Math.sin(ang) * f.r), a % 2 ? O.BROKENPILLAR : O.PILLAR);
        }
        placeForce(f.x, f.y + 1, O.STATUE);
        break;
      }
      case 'sanctuary': {
        grid.disc(f.x, f.y, f.r + 0.5, (x, y) => { grid.setT(x, y, T.RUIN); grid.lockMask[grid.i(x, y)] = 1; });
        const steps = 28;
        for (let a = 0; a < steps; a++) {
          const ang = (a / steps) * Math.PI * 2;
          const ca = Math.cos(ang), sa = Math.sin(ang);
          // aberturas nas quatro direções
          if (Math.abs(ca) > 0.93 || Math.abs(sa) > 0.93) continue;
          const x = Math.round(f.x + ca * f.r), y = Math.round(f.y + sa * f.r);
          if (grid.in(x, y)) { grid.setO(x, y, a % 3 === 0 ? O.BROKENPILLAR : O.PILLAR); }
        }
        for (const [dx, dy] of [[-6, -6], [6, -6], [-6, 6], [6, 6]]) grid.setO(f.x + dx, f.y + dy, O.BRAZIER);
        // velas acesas pelos cultistas em volta do círculo
        for (let a = 0; a < 12; a++) {
          const ang = (a / 12) * Math.PI * 2 + 0.26;
          const x = Math.round(f.x + Math.cos(ang) * (f.r - 2)), y = Math.round(f.y + Math.sin(ang) * (f.r - 2));
          if (grid.o(x, y) === 0) grid.setO(x, y, O.CANDLE);
        }
        break;
      }
      case 'ring': {
        const steps = Math.round(f.r * 6.5);
        const gapAng = { w: Math.PI, e: 0, n: -Math.PI / 2, s: Math.PI / 2 }[f.gap] ?? Math.PI;
        for (let a = 0; a < steps; a++) {
          const ang = (a / steps) * Math.PI * 2;
          let diff = Math.abs(ang - ((gapAng + Math.PI * 2) % (Math.PI * 2)));
          diff = Math.min(diff, Math.PI * 2 - diff);
          if (diff < 0.55) continue;
          const x = Math.round(f.x + Math.cos(ang) * f.r), y = Math.round(f.y + Math.sin(ang) * f.r);
          placeForce(x, y, f.obj);
        }
        break;
      }
      case 'pond': {
        grid.disc(f.x, f.y, f.r + 1.2, (x, y, d) => {
          if (grid.pathMask[grid.i(x, y)]) return;
          grid.setO(x, y, 0);
          if (d <= f.r) grid.setT(x, y, d < f.r - 1.2 ? T.DEEP : T.WATER);
          else if (hash2(x, y, 4) < 0.5) grid.setO(x, y, O.REEDS);
        });
        break;
      }
      case 'camp': {
        placeForce(f.x, f.y, O.BRAZIER);
        if (f.tents) { placeForce(f.x - 6, f.y - 4, O.TENT); placeForce(f.x + 6, f.y - 4, O.TENT); placeForce(f.x - 6, f.y + 4, O.TENT); }
        if (f.banners) { placeForce(f.x - 3, f.y - 5, O.BANNER); placeForce(f.x + 3, f.y - 5, O.BANNER); }
        if (f.mine) {
          placeForce(f.x - 5, f.y + 2, O.CART); placeForce(f.x + 6, f.y - 2, O.CART);
          placeForce(f.x - 4, f.y - 3, O.TORCH); placeForce(f.x + 4, f.y - 3, O.TORCH);
          // produção da mina: barras, tijolos e madeira de escoramento
          placeForce(f.x - 6, f.y - 1, O.BARS); placeForce(f.x + 7, f.y + 1, O.BRICKS);
          placeForce(f.x - 2, f.y - 5, O.PLANKS); placeForce(f.x + 2, f.y - 5, O.ORE);
          placeForce(f.x + 3, f.y - 5, O.TOOLS); placeForce(f.x - 3, f.y - 4, O.LANTERN); placeForce(f.x + 5, f.y + 5, O.ANVIL);
        }
        placeForce(f.x - 3, f.y + 3, O.CRATE); placeForce(f.x + 4, f.y + 3, O.CRATE);
        if (!f.mine) { placeForce(f.x + 2, f.y + 4, O.LANTERN); placeForce(f.x - 2, f.y - 3, O.RACK); }
        placeForce(f.x + 5, f.y + 3, O.BARREL); placeForce(f.x - 4, f.y + 3, O.BARREL);
        break;
      }
      case 'treasure': {
        // tesouro acumulado em volta do covil de um chefe
        for (let i = 0; i < f.n; i++) {
          const ang = rng() * Math.PI * 2, d = f.r * (0.6 + rng() * 0.4);
          const x = Math.round(f.x + Math.cos(ang) * d), y = Math.round(f.y + Math.sin(ang) * d);
          if (grid.o(x, y) === 0) placeForce(x, y, i === 0 ? O.CHEST : i % 3 === 2 ? O.ORE : O.GOLD);
        }
        break;
      }
      case 'oasis': {
        // lagoa com palmeiras e juncos em volta (Reino de Sahaar)
        grid.disc(f.x, f.y, f.r + 2.5, (x, y, d) => {
          if (grid.pathMask[grid.i(x, y)]) return;
          grid.setO(x, y, 0);
          if (d <= f.r) grid.setT(x, y, d < f.r - 1.3 ? T.DEEP : T.WATER);
          else { grid.setT(x, y, T.SAND); if (hash2(x, y, 6) < 0.35) grid.setO(x, y, O.REEDS); }
        });
        for (let a = 0; a < 8; a++) {
          const ang = (a / 8) * Math.PI * 2 + 0.4;
          placeForce(Math.round(f.x + Math.cos(ang) * (f.r + 1.8)), Math.round(f.y + Math.sin(ang) * (f.r + 1.8)), O.PALM);
        }
        break;
      }
      case 'sarcophagi': {
        // sarcófagos e urnas nas câmaras das tumbas
        for (let i = 0; i < f.n; i++) {
          const ang = rng() * Math.PI * 2, d = f.r * (0.5 + rng() * 0.5);
          placeForce(Math.round(f.x + Math.cos(ang) * d), Math.round(f.y + Math.sin(ang) * d), i % 3 === 2 ? O.URN : O.SARCOPHAGUS);
        }
        break;
      }
      case 'tombgate': {
        // vestíbulo das tumbas: braseiros, urnas e colunas em volta da sacerdotisa
        placeForce(f.x - 3, f.y - 3, O.BRAZIER); placeForce(f.x + 3, f.y - 3, O.BRAZIER);
        placeForce(f.x - 6, f.y, O.URN); placeForce(f.x + 6, f.y, O.URN);
        placeForce(f.x - 5, f.y + 3, O.PILLAR); placeForce(f.x + 5, f.y + 3, O.PILLAR);
        break;
      }
      case 'gobcamp': {
        placeForce(f.x, f.y, O.BRAZIER);
        for (let a = 0; a < 5; a++) {
          const ang = (a / 5) * Math.PI * 2 + 0.3;
          placeForce(Math.round(f.x + Math.cos(ang) * 6), Math.round(f.y + Math.sin(ang) * 6), O.TENT);
        }
        for (let i = 0; i < 8; i++) place(f.x + rng.int(-8, 8), f.y + rng.int(-8, 8), i % 2 ? O.BONES : O.CRATE);
        break;
      }
      case 'webs': {
        for (let i = 0; i < f.n; i++) {
          const ang = rng() * Math.PI * 2, d = Math.sqrt(rng()) * f.r;
          const x = Math.round(f.x + Math.cos(ang) * d), y = Math.round(f.y + Math.sin(ang) * d);
          if (grid.in(x, y) && TILE_INFO[grid.t(x, y)].walk && grid.o(x, y) === 0) grid.setO(x, y, (f.bones && i % 3 === 0) ? O.BONES : O.WEB);
        }
        break;
      }
      case 'torches': {
        // tochas ao lado dos túneis
        for (let y = 2; y < grid.h - 2; y += 1) {
          for (let x = 2; x < grid.w - 2; x += 1) {
            if (!grid.pathMask[grid.i(x, y)]) continue;
            if (hash2(x, y, 31) > 1 / f.every / 2) continue;
            for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) {
              const tx = x + dx, ty = y + dy;
              if (grid.free(tx, ty)) {
                const nearWall = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => isRock(grid.t(tx + a, ty + b)));
                if (nearWall) { grid.setO(tx, ty, O.TORCH); break; }
              }
            }
          }
        }
        break;
      }
      default: break;
    }
  }
}

// ---------------------------------------------------------------- caverna

function genCave(zone) {
  const g = zone.gen;
  const { w, h } = zone;
  const rng = mulberry32(g.seed);
  const grid = new Grid(w, h, g.base);
  let wall = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const edge = x < 2 || y < 2 || x >= w - 2 || y >= h - 2;
      wall[y * w + x] = edge || rng() < g.fill ? 1 : 0;
    }
  }
  for (let it = 0; it < 5; it++) {
    const next = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h || wall[ny * w + nx]) n++;
          }
        }
        const edge = x < 2 || y < 2 || x >= w - 2 || y >= h - 2;
        next[y * w + x] = edge || n >= 5 || (it < 2 && n <= 1) ? 1 : 0;
      }
    }
    wall = next;
  }
  for (let k = 0; k < w * h; k++) if (wall[k]) grid.tiles[k] = g.wall;

  const pois = poiMap(g);
  for (const p of g.pois) clearArea(grid, p.x, p.y, p.r, g.base);
  clearPortals(grid, zone, g.base);
  // portais no limite do mapa precisam atravessar a parede da borda
  for (const p of zone.portals) grid.rect(p.x, p.y, p.w, p.h, (x, y) => { grid.setT(x, y, g.base); grid.setO(x, y, 0); });

  const costFn = (x, y) => {
    let c = 1 + fbm(x * 0.2, y * 0.2, g.seed + 9, 2) * 3;
    if (grid.t(x, y) === g.wall) c += 3;
    if (grid.pathMask[grid.i(x, y)]) c *= 0.4;
    return c;
  };
  for (const [a, b] of g.links) {
    const pa = pois[a], pb = pois[b];
    const path = costPath(grid, pa.x, pa.y, pb.x, pb.y, costFn);
    stampPath(grid, path, g.path, 1.2, 1.9);
  }
  for (const s of g.scatter || []) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (grid.free(x, y) && rng() < s.p) grid.setO(x, y, s.o);
      }
    }
  }
  applyFeatures(grid, zone, rng);
  decorate(grid, g, rng);
  return grid;
}

// ---------------------------------------------------------------- arena

function genArena(zone) {
  const { w, h } = zone;
  const grid = new Grid(w, h, T.CAVEWALL);
  const cx = 20, cy = 17, r = 15;
  grid.disc(cx, cy, r, (x, y) => grid.setT(x, y, T.ARENA));
  // saguão seguro
  grid.rect(12, 31, 16, 9, (x, y) => grid.setT(x, y, T.COBBLE));
  grid.rect(17, 29, 6, 3, (x, y) => grid.setT(x, y, T.ARENA));
  for (const [x, y] of [[13, 10], [27, 10], [20, 17], [13, 23], [27, 23], [20, 6]]) {
    if (!(x === 20 && y === 17)) grid.setO(x, y, O.PILLAR);
  }
  grid.setO(20, 17, O.STATUE);
  for (let a = 0; a < 12; a++) {
    const ang = (a / 12) * Math.PI * 2;
    const x = Math.round(cx + Math.cos(ang) * (r - 1)), y = Math.round(cy + Math.sin(ang) * (r - 1));
    if (y < 28) grid.setO(x, y, a % 2 ? O.BANNER : O.BRAZIER);
  }
  grid.setO(12, 31, O.BRAZIER); grid.setO(27, 31, O.BRAZIER);
  grid.setO(13, 38, O.BARREL); grid.setO(26, 38, O.CRATE);
  // suportes de armas e bigorna no saguão dos gladiadores
  for (const [x, y] of [[14, 33], [25, 33], [14, 36], [25, 36]]) grid.setO(x, y, O.RACK);
  grid.setO(19, 37, O.ANVIL); grid.setO(21, 37, O.TOOLS);
  for (const p of zone.portals) grid.rect(p.x, p.y, p.w, p.h, (x, y) => grid.setT(x, y, T.COBBLE));
  return grid;
}

// ---------------------------------------------------------------- vila

function genTown(zone) {
  const grid = new Grid(zone.w, zone.h, T.GRASS);
  buildCapital(grid, zone);
  return grid;
}

// ---------------------------------------------------------------- cidade do deserto

function genDesertCity(zone) {
  const grid = new Grid(zone.w, zone.h, T.SAND);
  buildDesertCity(grid, zone);
  return grid;
}
