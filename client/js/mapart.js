// Mapa 2D detalhado de uma zona, visto de cima e com relevo: terreno com textura e transições suaves, sombreado de
// colinas e penhascos, água com espuma na margem, ruas de pedra, casas com telhado de duas águas (chaminé, fachada, porta),
// muralhas com ameias, torres, árvores com copa e sombra, rochas e dezenas de objetos pequenos. A imagem é pintada uma vez por
// zona (em fatias, para não travar o jogo) e o minimapa e a janela de mapa só recortam e põem os marcadores por cima.
import { T, O, isRock } from '/shared/tiles.js';
import { hash2, valueNoise } from '/shared/rng.js';
import { houseGeom } from '/shared/housegeom.js';

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a, b, t) => `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)})`;
const rgb = (c, f = 1) => `rgb(${Math.min(255, Math.round(c[0] * f))},${Math.min(255, Math.round(c[1] * f))},${Math.min(255, Math.round(c[2] * f))})`;

// cor média de cada terreno (a base suave entre vizinhos) e quais são "construídos" (bordas nítidas)
const BASE = {
  [T.GRASS]: hex('#5f9b3f'), [T.DARKGRASS]: hex('#477f36'), [T.DIRT]: hex('#a8855d'), [T.SAND]: hex('#dcc88f'), [T.WATER]: hex('#3f86c9'),
  [T.DEEP]: hex('#2a5d9c'), [T.CAVE]: hex('#6f655c'), [T.CAVEWALL]: hex('#463e37'), [T.ASH]: hex('#6e6761'), [T.LAVA]: hex('#e25822'),
  [T.BRIDGE]: hex('#8b6a42'), [T.MUD]: hex('#5d4d3c'), [T.COBBLE]: hex('#a29d94'), [T.RUIN]: hex('#a99f92'), [T.ARENA]: hex('#c9a56b'),
  [T.STONE]: hex('#8f8d89'), [T.WOOD]: hex('#8b6a42'), [T.VOID]: hex('#000000'),
  [T.DUNE]: hex('#d3ab6b'), [T.SANDSTONE]: hex('#cdac7a'), [T.TOMBFLOOR]: hex('#8b7556'), [T.TOMBWALL]: hex('#5e4a36'),
};
const BUILT = new Set([T.COBBLE, T.STONE, T.WOOD, T.BRIDGE, T.RUIN, T.ARENA, T.SANDSTONE, T.TOMBFLOOR]);
const LIQUID = new Set([T.WATER, T.DEEP, T.LAVA]);
const ROOFS = [
  ['#c8603f', '#a04327', '#6e2a17'], ['#bf5a38', '#9a4026', '#682816'], ['#cf6f46', '#a74b2c', '#74301c'],
  ['#a26a45', '#7c4d30', '#53331f'], ['#7d8a98', '#5d6a78', '#3b4652'], ['#cdac5e', '#a58844', '#6f5a2c'],
];
const WALL_PLASTER = ['#e6d6ae', '#ddcba0', '#e9dbbb'], WALL_STONE = ['#a19b90', '#948e83', '#aaa498'];
const STONE_TYPES = new Set(['keep', 'keeptower', 'belltower', 'barracks', 'armory', 'smithy', 'bank', 'guardhouse', 'chapel']);

export class MapArt {
  constructor(zone, scale = 10) {
    this.zone = zone;
    this.S = scale;
    this.W = zone.map.w; this.H = zone.map.h;
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.W * scale; this.canvas.height = this.H * scale;
    this.ctx = this.canvas.getContext('2d');
    this.ready = false;
    this.dead = false;
  }

  // Pinta em fatias de ~14 ms; onDone é chamado ao terminar
  start(onDone) {
    this.onDone = onDone;
    this.gen = this.run();
    this.pump();
  }

  cancel() { this.dead = true; }

  pump() {
    if (this.dead) return;
    this.deadline = performance.now() + 14;
    const r = this.gen.next();
    if (r.done) { this.ready = true; if (this.onDone) this.onDone(); return; }
    setTimeout(() => this.pump(), 0);
  }

  more() { return performance.now() > this.deadline; }

  *run() {
    const { map } = this.zone;
    this.tiles = map.tiles; this.objs = map.objs;
    this.seed = [...this.zone.id].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) | 0;
    this.makeSprites();
    this.elevation();
    yield* this.terrain();
    yield* this.hillshade();
    yield* this.shadows();
    yield* this.groundObjects();
    yield* this.standing();
  }

  t(x, y) { return x < 0 || y < 0 || x >= this.W || y >= this.H ? -1 : this.tiles[y * this.W + x]; }
  o(x, y) { return x < 0 || y < 0 || x >= this.W || y >= this.H ? 0 : this.objs[y * this.W + x]; }
  r(x, y, k = 0) { return hash2(x, y, k + this.seed); }

  // ------------------------------------------------------------------ relevo
  // altura sintética: ruído suave nas áreas abertas, rocha das cavernas bem alta, água rebaixada
  elevation() {
    const { W, H } = this;
    const flat = ['town', 'arena', 'desertcity'].includes(this.zone.def.gen.type);
    let E = new Float32Array(W * H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const t = this.tiles[y * W + x];
        let e = (valueNoise(x / 11 + 40, y / 11 + 40, this.seed) - 0.5) * 1.6 + (valueNoise(x / 4.5, y / 4.5, this.seed + 1) - 0.5) * 0.7;
        if (flat) e *= 0.22;
        if (isRock(t)) e = 1.7 + e * 0.5 + this.r(x, y, 9) * 0.5;
        else if (t === T.WATER || t === T.DEEP) e = -0.45 + e * 0.1;
        else if (t === T.LAVA) e = -0.35;
        else if (BUILT.has(t)) e *= 0.25;
        E[y * W + x] = e;
      }
    }
    for (let pass = 0; pass < 2; pass++) {
      const F = new Float32Array(W * H);
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          let s = 0, n = 0;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx, yy = y + dy;
            if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
            s += E[yy * W + xx]; n++;
          }
          F[y * W + x] = s / n;
        }
      }
      E = F;
    }
    this.E = E;
  }

  // ------------------------------------------------------------------ terreno
  *terrain() {
    const { W, H, S, ctx } = this;
    // base suave: 1 px por tile ampliado com interpolação (as transições naturais ficam macias)
    const low = document.createElement('canvas');
    low.width = W; low.height = H;
    const lctx = low.getContext('2d');
    const id = lctx.createImageData(W, H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const c = BASE[this.tiles[y * W + x]] || BASE[T.VOID];
        const v = 0.94 + this.r(x, y, 1) * 0.12;
        const k = (y * W + x) * 4;
        id.data[k] = Math.min(255, c[0] * v); id.data[k + 1] = Math.min(255, c[1] * v); id.data[k + 2] = Math.min(255, c[2] * v); id.data[k + 3] = 255;
      }
    }
    lctx.putImageData(id, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(low, 0, 0, W * S, H * S);
    yield;
    // textura de cada tile
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        this.tileDetail(x, y, this.tiles[y * W + x]);
      }
      if (this.more()) yield;
    }
    // espuma nas margens da água e brilho da lava
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const t = this.tiles[y * W + x];
        if (t !== T.WATER && t !== T.DEEP && t !== T.LAVA) continue;
        const foam = t === T.LAVA ? 'rgba(255,210,90,0.55)' : 'rgba(235,248,255,0.55)';
        ctx.fillStyle = foam;
        for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
          const n = this.t(x + dx, y + dy);
          if (n < 0 || LIQUID.has(n)) continue;
          const px = x * S, py = y * S;
          if (dy) { for (let i = 0; i < S; i += 2) ctx.fillRect(px + i, py + (dy < 0 ? 0 : S - 1) + (this.r(x + i, y, 4) < 0.5 ? 0 : dy < 0 ? 1 : -1), 2, 1); }
          else { for (let i = 0; i < S; i += 2) ctx.fillRect(px + (dx < 0 ? 0 : S - 1) + (this.r(x, y + i, 5) < 0.5 ? 0 : dx < 0 ? 1 : -1), py + i, 1, 2); }
        }
      }
      if (this.more()) yield;
    }
  }

  tileDetail(x, y, t) {
    const { S, ctx } = this;
    const px = x * S, py = y * S;
    const base = BASE[t];
    const R = (k) => this.r(x, y, k);
    const speck = (n, light, dark, k0 = 20) => {
      for (let i = 0; i < n; i++) {
        const sx = px + 1 + Math.floor(R(k0 + i * 3) * (S - 2)), sy = py + 1 + Math.floor(R(k0 + i * 3 + 1) * (S - 2));
        ctx.fillStyle = R(k0 + i * 3 + 2) < 0.5 ? light : dark;
        ctx.fillRect(sx, sy, 1, 1);
      }
    };
    switch (t) {
      case T.GRASS: case T.DARKGRASS: {
        const lit = t === T.GRASS ? 'rgba(150,205,95,0.55)' : 'rgba(110,170,80,0.5)', dk = 'rgba(30,70,25,0.4)';
        for (let i = 0; i < 6; i++) {
          const sx = px + 1 + Math.floor(R(20 + i * 3) * (S - 3)), sy = py + 2 + Math.floor(R(21 + i * 3) * (S - 3));
          ctx.fillStyle = R(22 + i * 3) < 0.5 ? lit : dk;
          ctx.fillRect(sx, sy, 1, 2); ctx.fillRect(sx + 1, sy - 1, 1, 2);
        }
        break;
      }
      case T.DIRT: speck(7, 'rgba(210,180,135,0.7)', 'rgba(110,80,50,0.55)'); if (R(40) < 0.25) { ctx.fillStyle = 'rgba(120,100,80,0.8)'; ctx.fillRect(px + 2 + Math.floor(R(41) * 5), py + 2 + Math.floor(R(42) * 5), 2, 1); } break;
      case T.SAND: speck(5, 'rgba(255,245,200,0.7)', 'rgba(170,140,80,0.4)'); if (R(43) < 0.35) { ctx.strokeStyle = 'rgba(170,140,80,0.35)'; ctx.beginPath(); ctx.arc(px + 5, py + 4 + R(44) * 3, 3, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke(); } break;
      case T.WATER: case T.DEEP:
        if (R(45) < 0.45) { ctx.strokeStyle = t === T.WATER ? 'rgba(220,240,255,0.45)' : 'rgba(150,190,235,0.35)'; ctx.lineWidth = 1; ctx.beginPath(); const wx = px + 1 + R(46) * 4, wy = py + 2 + R(47) * 6; ctx.moveTo(wx, wy); ctx.quadraticCurveTo(wx + 2, wy - 2, wx + 4, wy); ctx.stroke(); }
        break;
      case T.CAVE: speck(8, 'rgba(160,150,140,0.55)', 'rgba(40,35,30,0.5)'); if (R(48) < 0.12) { ctx.fillStyle = 'rgba(95,88,80,0.9)'; ctx.fillRect(px + 2 + Math.floor(R(49) * 5), py + 2 + Math.floor(R(50) * 5), 2, 2); } break;
      case T.CAVEWALL: case T.TOMBWALL: {
        // rocha: lascas de tons diferentes
        for (let i = 0; i < 3; i++) {
          const sx = px + R(60 + i * 4) * (S - 3), sy = py + R(61 + i * 4) * (S - 3);
          ctx.fillStyle = R(62 + i * 4) < 0.5 ? 'rgba(120,108,96,0.45)' : 'rgba(10,8,8,0.4)';
          ctx.beginPath(); ctx.moveTo(sx, sy + 2); ctx.lineTo(sx + 2 + R(63 + i * 4) * 3, sy); ctx.lineTo(sx + 3, sy + 3 + R(64 + i * 4) * 2); ctx.closePath(); ctx.fill();
        }
        break;
      }
      case T.ASH: speck(9, 'rgba(150,142,135,0.6)', 'rgba(30,25,25,0.5)'); break;
      case T.MUD: speck(5, 'rgba(110,90,70,0.6)', 'rgba(30,22,16,0.5)'); if (R(51) < 0.2) { ctx.fillStyle = 'rgba(40,32,24,0.5)'; ctx.beginPath(); ctx.ellipse(px + 5, py + 5, 2.5, 1.5, 0, 0, Math.PI * 2); ctx.fill(); } break;
      case T.LAVA:
        if (R(52) < 0.5) { ctx.strokeStyle = 'rgba(255,225,110,0.8)'; ctx.lineWidth = 1; ctx.beginPath(); const lx = px + R(53) * 6, ly = py + R(54) * 8; ctx.moveTo(lx, ly); ctx.lineTo(lx + 2 + R(55) * 3, ly + 1 + R(56) * 3); ctx.lineTo(lx + 4 + R(57) * 3, ly + R(58) * 4); ctx.stroke(); }
        break;
      case T.COBBLE: this.cobble(x, y, px, py); break;
      case T.STONE: case T.RUIN: this.slabs(x, y, px, py, t === T.RUIN); break;
      case T.WOOD: case T.BRIDGE: this.planks(x, y, px, py, t === T.BRIDGE); break;
      case T.ARENA: speck(10, 'rgba(240,215,160,0.7)', 'rgba(150,110,60,0.45)'); break;
      case T.DUNE: {
        speck(5, 'rgba(255,236,180,0.6)', 'rgba(150,105,50,0.4)');
        // crista da duna: um arco claro com sombra logo abaixo
        const cy = py + 3 + R(56) * 4;
        ctx.strokeStyle = 'rgba(255,238,190,0.55)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(px, cy); ctx.quadraticCurveTo(px + S / 2, cy - 2, px + S, cy); ctx.stroke();
        ctx.strokeStyle = 'rgba(140,95,45,0.4)'; ctx.beginPath(); ctx.moveTo(px, cy + 1.5); ctx.quadraticCurveTo(px + S / 2, cy - 0.5, px + S, cy + 1.5); ctx.stroke();
        break;
      }
      case T.SANDSTONE: case T.TOMBFLOOR: {
        const tomb = t === T.TOMBFLOOR;
        ctx.fillStyle = rgb(tomb ? hex('#8e7859') : hex('#d1b184'), 0.9 + R(3) * 0.2);
        ctx.fillRect(px, py, S, S);
        ctx.strokeStyle = tomb ? 'rgba(30,22,14,0.45)' : 'rgba(110,80,40,0.38)'; ctx.lineWidth = 1;
        ctx.strokeRect(px + 0.5, py + 0.5, S - 1, S - 1);
        ctx.beginPath(); ctx.moveTo(px + S / 2, py); ctx.lineTo(px + S / 2, py + S); ctx.moveTo(px, py + S / 2); ctx.lineTo(px + S, py + S / 2); ctx.stroke();
        ctx.fillStyle = 'rgba(255,245,215,0.16)'; ctx.fillRect(px + 1, py + 1, S / 2 - 1, 1);
        if (tomb && R(7) > 0.84) { ctx.fillStyle = 'rgba(220,175,60,0.55)'; ctx.fillRect(px + 1.5, py + S / 2 - 0.5, S - 3, 1); }
        else if (!tomb && R(7) < 0.14) { ctx.fillStyle = 'rgba(232,205,150,0.6)'; ctx.beginPath(); ctx.ellipse(px + 3 + R(8) * 4, py + 3 + R(9) * 4, 2.6, 1.3, 0, 0, Math.PI * 2); ctx.fill(); }
        break;
      }
      default: break;
    }
    // meio-fio nas bordas de pisos construídos que dão para terreno natural
    if (BUILT.has(t) && t !== T.BRIDGE) {
      ctx.fillStyle = 'rgba(40,34,28,0.5)';
      const nb = (dx, dy) => { const n = this.t(x + dx, y + dy); return n >= 0 && !BUILT.has(n) && !LIQUID.has(n) && !isRock(n); };
      if (nb(0, -1)) ctx.fillRect(px, py, S, 1);
      if (nb(0, 1)) ctx.fillRect(px, py + S - 1, S, 1);
      if (nb(-1, 0)) ctx.fillRect(px, py, 1, S);
      if (nb(1, 0)) ctx.fillRect(px + S - 1, py, 1, S);
    }
    void base;
  }

  cobble(x, y, px, py) {
    const { S, ctx } = this;
    const R = (k) => this.r(x, y, k);
    const tone = 0.92 + R(2) * 0.16;
    ctx.fillStyle = rgb(hex('#7d786f'), tone);
    ctx.fillRect(px, py, S, S);
    // duas fileiras de pedras alternadas
    const rows = [[0, 5], [5, 5]];
    rows.forEach(([ry, rh], ri) => {
      const off = (ri + x + y) % 2 ? 0 : 2;
      const cuts = [off, off + 4, off + 8];
      for (let i = 0; i < cuts.length; i++) {
        const sx0 = Math.max(0, cuts[i] - (i === 0 && off ? 2 : 0));
        const sx1 = Math.min(S, cuts[i] + (i < cuts.length - 1 ? 4 : 6));
        if (sx1 - sx0 < 2) continue;
        const v = 0.9 + R(10 + ri * 5 + i) * 0.22;
        ctx.fillStyle = rgb(hex('#aaa59b'), v * tone);
        ctx.fillRect(px + sx0 + 0.5, py + ry + 0.5, sx1 - sx0 - 1, rh - 1);
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.fillRect(px + sx0 + 0.5, py + ry + 0.5, sx1 - sx0 - 1, 1);
      }
    });
  }

  slabs(x, y, px, py, ruin) {
    const { S, ctx } = this;
    const R = (k) => this.r(x, y, k);
    const v = 0.9 + R(3) * 0.2;
    ctx.fillStyle = rgb(ruin ? hex('#a79d90') : hex('#928f8a'), v);
    ctx.fillRect(px, py, S, S);
    ctx.strokeStyle = 'rgba(30,28,25,0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(px + 0.5, py + 0.5, S - 1, S - 1);
    ctx.beginPath(); ctx.moveTo(px + S / 2, py); ctx.lineTo(px + S / 2, py + S); ctx.moveTo(px, py + S / 2); ctx.lineTo(px + S, py + S / 2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(px + 1, py + 1, S / 2 - 1, 1);
    if (ruin && R(4) < 0.3) { ctx.strokeStyle = 'rgba(30,28,25,0.55)'; ctx.beginPath(); ctx.moveTo(px + 1 + R(5) * 6, py + 1); ctx.lineTo(px + 3 + R(6) * 5, py + S - 2); ctx.stroke(); }
    if (ruin && R(7) < 0.25) { ctx.fillStyle = 'rgba(80,120,60,0.55)'; ctx.fillRect(px + 1 + Math.floor(R(8) * 5), py + 1 + Math.floor(R(9) * 5), 3, 2); }
  }

  planks(x, y, px, py, bridge) {
    const { S, ctx } = this;
    const v = 0.9 + this.r(x, y, 3) * 0.2;
    ctx.fillStyle = rgb(hex(bridge ? '#8d6b42' : '#8b6a42'), v);
    ctx.fillRect(px, py, S, S);
    ctx.fillStyle = 'rgba(40,25,10,0.5)';
    for (let i = 2; i < S; i += 3) ctx.fillRect(px, py + i, S, 1);
    ctx.fillStyle = 'rgba(255,230,170,0.15)';
    for (let i = 1; i < S; i += 3) ctx.fillRect(px, py + i, S, 1);
    ctx.fillStyle = 'rgba(30,20,10,0.6)'; ctx.fillRect(px + 1, py + 1, 1, 1); ctx.fillRect(px + S - 2, py + S - 2, 1, 1);
    if (bridge) {
      // corrimões do lado da água
      ctx.fillStyle = '#4a3320';
      for (const [dx, dy] of [[0, -1], [0, 1]]) { if (LIQUID.has(this.t(x + dx, y + dy))) ctx.fillRect(px, py + (dy < 0 ? 0 : S - 2), S, 2); }
      for (const [dx, dy] of [[-1, 0], [1, 0]]) { if (LIQUID.has(this.t(x + dx, y + dy))) ctx.fillRect(px + (dx < 0 ? 0 : S - 2), py, 2, S); }
    }
  }

  // ------------------------------------------------------------------ sombreado do relevo
  *hillshade() {
    const { W, H, S, E } = this;
    const gx = new Float32Array(W * H), gy = new Float32Array(W * H);
    const at = (x, y) => E[Math.max(0, Math.min(H - 1, y)) * W + Math.max(0, Math.min(W - 1, x))];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      gx[y * W + x] = (at(x + 1, y) - at(x - 1, y)) / 2;
      gy[y * W + x] = (at(x, y + 1) - at(x, y - 1)) / 2;
    }
    const PW = W * S, PH = H * S;
    const cv = document.createElement('canvas');
    cv.width = PW; cv.height = PH;
    const c2 = cv.getContext('2d');
    const id = c2.createImageData(PW, PH);
    const d = id.data;
    // luz vinda do noroeste
    const Lx = -0.58, Ly = -0.58, Lz = 0.57, K = 2.2;
    const ref = Lz;
    const g = (arr, x, y) => arr[Math.max(0, Math.min(H - 1, y)) * W + Math.max(0, Math.min(W - 1, x))];
    for (let py = 0; py < PH; py++) {
      const fy = py / S - 0.5, iy = Math.floor(fy), ty = fy - iy;
      for (let px = 0; px < PW; px++) {
        const fx = px / S - 0.5, ix = Math.floor(fx), tx = fx - ix;
        const gxx = (g(gx, ix, iy) * (1 - tx) + g(gx, ix + 1, iy) * tx) * (1 - ty) + (g(gx, ix, iy + 1) * (1 - tx) + g(gx, ix + 1, iy + 1) * tx) * ty;
        const gyy = (g(gy, ix, iy) * (1 - tx) + g(gy, ix + 1, iy) * tx) * (1 - ty) + (g(gy, ix, iy + 1) * (1 - tx) + g(gy, ix + 1, iy + 1) * tx) * ty;
        const nx = -gxx * K, ny = -gyy * K;
        const dot = (nx * Lx + ny * Ly + Lz) / Math.sqrt(nx * nx + ny * ny + 1);
        const diff = dot - ref;
        const k = (py * PW + px) * 4;
        if (diff < 0) { d[k] = 8; d[k + 1] = 12; d[k + 2] = 30; d[k + 3] = Math.min(150, -diff * 300); }
        else { d[k] = 255; d[k + 1] = 248; d[k + 2] = 225; d[k + 3] = Math.min(62, diff * 150); }
      }
      if ((py & 31) === 31 && this.more()) yield;
    }
    c2.putImageData(id, 0, 0);
    this.ctx.drawImage(cv, 0, 0);
  }

  // ------------------------------------------------------------------ sombras (o sol vem do noroeste)
  *shadows() {
    const { ctx, S, zone } = this;
    ctx.fillStyle = 'rgba(12,16,30,0.34)';
    const poly = (x0, y0, x1, y1, dx, dy) => {
      // casco convexo de um retângulo e o mesmo deslocado
      const pts = [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0 + dx, y0 + dy], [x1 + dx, y0 + dy], [x1 + dx, y1 + dy], [x0 + dx, y1 + dy]];
      pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
      const lo = [], up = [];
      for (const p of pts) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
      for (const p of [...pts].reverse()) { while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
      const hull = lo.slice(0, -1).concat(up.slice(0, -1));
      ctx.beginPath();
      hull.forEach(([x, y], i) => (i ? ctx.lineTo(x * S, y * S) : ctx.moveTo(x * S, y * S)));
      ctx.closePath(); ctx.fill();
    };
    for (const st of zone.structures) {
      if (st.kind === 'house') { const len = 0.35 + (st.floors || 1) * 0.42 + (/tower|voxel/.test(st.type) ? (st.type === 'voxel' ? 2 : 1.2) : 0); poly(st.x, st.y, st.x + st.w, st.y + st.h, len, len); }
      else if (st.kind === 'wall') poly(st.x, st.y, st.x + st.w, st.y + st.h, 0.9, 0.9);
      else if (st.kind === 'tower') poly(st.x, st.y, st.x + st.w, st.y + st.h, 1.5, 1.5);
    }
    yield;
    // objetos altos: elipse deslocada para sudeste
    const { W, H } = this;
    ctx.fillStyle = 'rgba(12,16,30,0.30)';
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const o = this.objs[y * W + x];
        let r = 0, len = 0;
        if (o === O.TREE || o === O.DEADTREE) { r = 0.42; len = 0.6; } else if (o === O.PINE) { r = 0.38; len = 0.75; } else if (o === O.BIGTREE) { r = 0.65; len = 0.9; }
        else if (o === O.BUSH) { r = 0.3; len = 0.18; } else if (o === O.ROCK) { r = 0.42; len = 0.3; } else if (o === O.PILLAR || o === O.STATUE) { r = 0.3; len = 0.8; }
        else if (o === O.LAMP || o === O.TORCH) { r = 0.1; len = 0.7; } else if (o === O.STALL || o === O.TENT) { r = 0.6; len = 0.35; } else if (o === O.WELL || o === O.STALAG || o === O.CRYSTAL) { r = 0.4; len = 0.35; }
        else if (o === O.GRAVE) { r = 0.2; len = 0.3; } else if (o === O.BROKENPILLAR) { r = 0.3; len = 0.3; } else if (o === O.BANNER) { r = 0.12; len = 0.7; }
        else if (o === O.PALM) { r = 0.5; len = 0.85; } else if (o === O.CACTUS) { r = 0.22; len = 0.45; } else if (o === O.OBELISK) { r = 0.26; len = 1.0; } else if (o === O.SARCOPHAGUS) { r = 0.4; len = 0.2; }
        if (!r) continue;
        ctx.beginPath();
        ctx.ellipse((x + 0.5 + len * 0.55) * S, (y + 0.55 + len * 0.45) * S, r * S * 1.05, r * S * 0.8, Math.PI / 4, 0, Math.PI * 2);
        ctx.fill();
      }
      if (this.more()) yield;
    }
  }

  // ------------------------------------------------------------------ objetos rente ao chão
  *groundObjects() {
    const { W, H, S, ctx } = this;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const o = this.objs[y * W + x];
        if (!o) continue;
        const px = x * S, py = y * S, cx = px + S / 2, cy = py + S / 2;
        const R = (k) => this.r(x, y, 70 + k);
        switch (o) {
          case O.FLOWERS:
            for (let i = 0; i < 3; i++) {
              ctx.fillStyle = ['#f4d03f', '#e57fb0', '#f7f7f7', '#c0392b', '#a58be0'][Math.floor(R(i) * 5)];
              ctx.fillRect(px + 1 + Math.floor(R(5 + i) * (S - 3)), py + 1 + Math.floor(R(9 + i) * (S - 3)), 2, 2);
            }
            break;
          case O.MUSHROOM: ctx.fillStyle = '#d9534f'; ctx.fillRect(cx - 1, cy - 1, 2, 2); ctx.fillStyle = '#f5f0e0'; ctx.fillRect(cx, cy, 1, 1); break;
          case O.RUBBLE: for (let i = 0; i < 4; i++) { ctx.fillStyle = R(i) < 0.5 ? '#8b857c' : '#5d5851'; ctx.fillRect(px + 1 + Math.floor(R(4 + i) * (S - 3)), py + 1 + Math.floor(R(8 + i) * (S - 3)), 2, 2); } break;
          case O.BONES: ctx.strokeStyle = '#e8e0cc'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(px + 2, py + 3); ctx.lineTo(px + 7, py + 6); ctx.moveTo(px + 2, py + 7); ctx.lineTo(px + 6, py + 3); ctx.stroke(); break;
          case O.WEB: ctx.strokeStyle = 'rgba(235,235,235,0.7)'; ctx.lineWidth = 1; ctx.beginPath(); for (let i = 0; i < 4; i++) { const a = i * Math.PI / 4; ctx.moveTo(cx - Math.cos(a) * 4, cy - Math.sin(a) * 4); ctx.lineTo(cx + Math.cos(a) * 4, cy + Math.sin(a) * 4); } ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy, 2.5, 0, Math.PI * 2); ctx.stroke(); break;
          case O.REEDS: ctx.strokeStyle = '#6b8e3a'; ctx.lineWidth = 1; ctx.beginPath(); for (let i = 0; i < 4; i++) { const rx = px + 2 + i * 2 + R(i); ctx.moveTo(rx, py + 8); ctx.lineTo(rx + R(4 + i) * 2 - 1, py + 2); } ctx.stroke(); ctx.fillStyle = '#7b5a2b'; ctx.fillRect(px + 4, py + 2, 1, 2); break;
          case O.FENCE: {
            const nb = (dx, dy) => this.o(x + dx, y + dy) === O.FENCE;
            ctx.strokeStyle = '#6a4727'; ctx.lineWidth = 1.5; ctx.beginPath();
            if (nb(1, 0)) { ctx.moveTo(cx, cy); ctx.lineTo(cx + S, cy); }
            if (nb(-1, 0)) { ctx.moveTo(cx, cy); ctx.lineTo(cx - S, cy); }
            if (nb(0, 1)) { ctx.moveTo(cx, cy); ctx.lineTo(cx, cy + S); }
            if (nb(0, -1)) { ctx.moveTo(cx, cy); ctx.lineTo(cx, cy - S); }
            ctx.stroke();
            ctx.fillStyle = '#4a321b'; ctx.fillRect(cx - 1.5, cy - 1.5, 3, 3);
            break;
          }
          case O.SIGN: ctx.fillStyle = '#4a321b'; ctx.fillRect(cx - 0.5, cy, 1, 3); ctx.fillStyle = '#c9a56b'; ctx.fillRect(cx - 3, cy - 3, 6, 3.5); ctx.strokeStyle = '#4a321b'; ctx.lineWidth = 1; ctx.strokeRect(cx - 3, cy - 3, 6, 3.5); break;
          case O.FOUNTAIN: this.fountain(x, y, px, py); break;
          case O.WELL: ctx.fillStyle = '#7c7770'; ctx.beginPath(); ctx.arc(cx, cy, 4.2, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#b9b4a8'; ctx.beginPath(); ctx.arc(cx, cy, 3.4, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#1d3f66'; ctx.beginPath(); ctx.arc(cx, cy, 2.2, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#6b4a2b'; ctx.fillRect(cx - 4, cy - 0.5, 8, 1); break;
          case O.GRAVE: ctx.fillStyle = '#8c9198'; ctx.fillRect(cx - 1.8, cy - 2.5, 3.6, 4.5); ctx.fillStyle = '#b4b9c0'; ctx.fillRect(cx - 1.8, cy - 2.5, 3.6, 1); ctx.fillStyle = '#5b6068'; ctx.fillRect(cx - 0.5, cy - 1.5, 1, 2); ctx.fillStyle = 'rgba(70,90,50,0.6)'; ctx.fillRect(cx - 2, cy + 2, 4, 2); break;
          case O.BARREL: case O.KEG: ctx.fillStyle = '#7a4e26'; ctx.beginPath(); ctx.arc(cx, cy, o === O.KEG ? 4.2 : 3.4, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#a06a37'; ctx.beginPath(); ctx.arc(cx - 0.5, cy - 0.5, o === O.KEG ? 3.2 : 2.5, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#3a3a3f'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.arc(cx, cy, 2, 0, Math.PI * 2); ctx.stroke(); break;
          case O.CRATE: ctx.fillStyle = '#6e4a26'; ctx.fillRect(cx - 3.2, cy - 3.2, 6.4, 6.4); ctx.fillStyle = '#9a6d3a'; ctx.fillRect(cx - 2.6, cy - 2.6, 5.2, 5.2); ctx.strokeStyle = '#5a3a1c'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(cx - 2.6, cy - 2.6); ctx.lineTo(cx + 2.6, cy + 2.6); ctx.moveTo(cx + 2.6, cy - 2.6); ctx.lineTo(cx - 2.6, cy + 2.6); ctx.stroke(); break;
          case O.SACK: ctx.fillStyle = '#c9b48a'; ctx.beginPath(); ctx.ellipse(cx, cy + 0.5, 3.2, 3.6, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#e0cfa5'; ctx.beginPath(); ctx.ellipse(cx - 0.6, cy - 0.3, 2, 2.2, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#6b5a38'; ctx.fillRect(cx - 1, cy - 3.6, 2, 1); break;
          case O.LUMBER: case O.PLANKS: for (let i = 0; i < 4; i++) { ctx.fillStyle = i % 2 ? '#b98d56' : '#a37a47'; ctx.fillRect(px + 1, py + 1 + i * 2, S - 2, 2); } ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(px + 1, py + S - 2, S - 2, 1); break;
          case O.BRICKS: for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { ctx.fillStyle = (i + j) % 2 ? '#a85c42' : '#b86b4d'; ctx.fillRect(px + 1 + j * 3, py + 2 + i * 2.5, 2.6, 2.1); } break;
          case O.CLOTH: ctx.fillStyle = ['#c0392b', '#2e86c1', '#d4ac0d', '#7d3c98', '#27ae60'][Math.floor(R(0) * 5)]; ctx.fillRect(px + 1.5, py + 2, 7, 6); ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(px + 1.5, py + 2, 7, 1.5); break;
          case O.BARS: ctx.fillStyle = '#8b97a3'; for (let i = 0; i < 3; i++) ctx.fillRect(px + 1.5, py + 2 + i * 2.2, 7, 1.8); ctx.fillStyle = '#c9d3dc'; for (let i = 0; i < 3; i++) ctx.fillRect(px + 1.5, py + 2 + i * 2.2, 7, 0.7); break;
          case O.GOLD: ctx.fillStyle = '#e0b020'; for (let i = 0; i < 3; i++) ctx.fillRect(px + 1.5, py + 2 + i * 2.2, 7, 1.8); ctx.fillStyle = '#fff1a8'; for (let i = 0; i < 3; i++) ctx.fillRect(px + 1.5, py + 2 + i * 2.2, 7, 0.7); break;
          case O.CHEST: ctx.fillStyle = '#6e4a26'; ctx.fillRect(px + 1.5, py + 2.5, 7, 5); ctx.fillStyle = '#9a6d3a'; ctx.fillRect(px + 1.5, py + 2.5, 7, 2.2); ctx.fillStyle = '#e0b020'; ctx.fillRect(cx - 0.7, py + 4, 1.4, 1.6); break;
          case O.TABLE: ctx.fillStyle = '#6e4a26'; ctx.fillRect(px + 1, py + 2, 8, 6); ctx.fillStyle = '#a77846'; ctx.fillRect(px + 1.5, py + 2.5, 7, 5); ctx.fillStyle = '#f0ece0'; ctx.beginPath(); ctx.arc(cx - 1, cy, 1.4, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#c0392b'; ctx.fillRect(cx + 1.5, cy - 1, 1.5, 1.5); break;
          case O.ANVIL: ctx.fillStyle = '#2f3238'; ctx.fillRect(px + 2, py + 3, 6, 3); ctx.fillRect(px + 3.5, py + 6, 3, 2); ctx.fillStyle = '#6d747c'; ctx.fillRect(px + 2, py + 3, 6, 1); break;
          case O.TOOLS: ctx.strokeStyle = '#7b5a35'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(px + 2, py + 8); ctx.lineTo(px + 8, py + 2); ctx.stroke(); ctx.fillStyle = '#9aa3ad'; ctx.fillRect(px + 6, py + 1.5, 3, 1.5); break;
          case O.RACK: ctx.fillStyle = '#6b4a2b'; ctx.fillRect(px + 1, py + 3, 8, 3); ctx.strokeStyle = '#c9d3dc'; ctx.lineWidth = 0.9; ctx.beginPath(); for (let i = 0; i < 3; i++) { ctx.moveTo(px + 2.5 + i * 2.5, py + 3); ctx.lineTo(px + 2.5 + i * 2.5, py + 8); } ctx.stroke(); break;
          case O.TARGET: ctx.fillStyle = '#e8dcc0'; ctx.beginPath(); ctx.arc(cx, cy, 3.6, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#c0392b'; ctx.beginPath(); ctx.arc(cx, cy, 2.4, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#e8dcc0'; ctx.beginPath(); ctx.arc(cx, cy, 1.3, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#c0392b'; ctx.fillRect(cx - 0.5, cy - 0.5, 1, 1); break;
          case O.HAY: ctx.fillStyle = '#c9a43a'; ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#e8cf6a'; ctx.lineWidth = 0.8; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(cx, cy, 1 + i, 0, Math.PI * 2); ctx.stroke(); } break;
          case O.CART: ctx.fillStyle = '#6e4a26'; ctx.fillRect(px + 1, py + 2.5, 8, 5); ctx.fillStyle = '#a77846'; ctx.fillRect(px + 1.5, py + 3, 7, 4); ctx.fillStyle = '#2a2a2a'; ctx.fillRect(px + 2, py + 1.5, 2, 1.5); ctx.fillRect(px + 2, py + 7, 2, 1.5); ctx.fillRect(px + 6.5, py + 1.5, 2, 1.5); ctx.fillRect(px + 6.5, py + 7, 2, 1.5); break;
          case O.ORE: { ctx.fillStyle = '#4e4e57'; ctx.beginPath(); ctx.ellipse(cx, cy, 4, 3.4, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = ['#d9a441', '#b7c4cf', '#8a5a3b', '#9ad0f0'][Math.floor(R(0) * 4)]; ctx.fillRect(cx - 2, cy - 1.5, 2, 2); ctx.fillRect(cx + 0.5, cy, 1.5, 1.5); break; }
          case O.ALTAR: ctx.fillStyle = '#6f6a62'; ctx.fillRect(px + 0.5, py + 2, 9, 6.5); ctx.fillStyle = '#c4beb0'; ctx.fillRect(px + 1, py + 2.5, 8, 5); ctx.fillStyle = '#e8c04a'; ctx.beginPath(); ctx.arc(cx, cy, 1.6, 0, Math.PI * 2); ctx.fill(); break;
          case O.BRAZIER: case O.TORCH: case O.LANTERN: case O.CANDLE: case O.LAMP: this.light(cx, cy, o); break;
          case O.DRYBUSH: ctx.strokeStyle = '#8a6d3b'; ctx.lineWidth = 1; ctx.beginPath(); for (let i = 0; i < 5; i++) { ctx.moveTo(cx, cy + 2); ctx.lineTo(cx + (R(i) - 0.5) * 6, cy - 1 - R(4 + i) * 3); } ctx.stroke(); ctx.fillStyle = '#a8864a'; ctx.fillRect(cx - 1, cy + 1, 2, 1.5); break;
          case O.URN: ctx.fillStyle = '#7a3a20'; ctx.beginPath(); ctx.arc(cx, cy, 3.2, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#b4623a'; ctx.beginPath(); ctx.arc(cx - 0.5, cy - 0.5, 2.5, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#e0b020'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.arc(cx, cy, 2.9, 0, Math.PI * 2); ctx.stroke(); ctx.fillStyle = '#3a1e12'; ctx.beginPath(); ctx.arc(cx, cy, 1.1, 0, Math.PI * 2); ctx.fill(); break;
          case O.SARCOPHAGUS: ctx.fillStyle = '#6b563a'; ctx.fillRect(cx - 3, cy - 4.4, 6, 9); ctx.fillStyle = '#c9aa72'; ctx.fillRect(cx - 2.5, cy - 4, 5, 8); ctx.fillStyle = '#e0b020'; ctx.fillRect(cx - 0.6, cy - 3.2, 1.2, 6.4); ctx.beginPath(); ctx.arc(cx, cy - 2.6, 1.5, 0, Math.PI * 2); ctx.fill(); break;
          case O.BANNER: ctx.fillStyle = '#4a321b'; ctx.fillRect(cx - 0.5, cy - 3, 1, 6); ctx.fillStyle = (x + y) % 2 ? '#2e5fa3' : '#b83a2e'; ctx.beginPath(); ctx.moveTo(cx + 0.5, cy - 3); ctx.lineTo(cx + 4.5, cy - 1.5); ctx.lineTo(cx + 0.5, cy + 0.2); ctx.closePath(); ctx.fill(); break;
          default: break;
        }
      }
      if (this.more()) yield;
    }
  }

  // lâmpadas, tochas, braseiros e velas: pontinho de luz com halo
  light(cx, cy, o) {
    const { ctx } = this;
    const col = o === O.BRAZIER ? '#ff8a30' : o === O.CANDLE ? '#ffe9a0' : '#ffd96b';
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, o === O.CANDLE ? 4 : 7);
    g.addColorStop(0, o === O.CANDLE ? 'rgba(255,230,150,0.5)' : 'rgba(255,200,90,0.6)'); g.addColorStop(1, 'rgba(255,200,90,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, o === O.CANDLE ? 4 : 7, 0, Math.PI * 2); ctx.fill();
    if (o === O.BRAZIER) { ctx.fillStyle = '#3a3a3f'; ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.fill(); }
    else if (o === O.LAMP || o === O.TORCH || o === O.LANTERN) { ctx.fillStyle = '#2d2f35'; ctx.beginPath(); ctx.arc(cx, cy, 1.7, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(cx, cy, o === O.CANDLE ? 1 : 1.5, 0, Math.PI * 2); ctx.fill();
  }

  // fonte: o bloco de 3 × 3 vira uma bacia de pedra com água, a peça central ganha um jorro
  fountain(x, y, px, py) {
    const { S, ctx } = this;
    const nb = (dx, dy) => this.o(x + dx, y + dy) === O.FOUNTAIN;
    ctx.fillStyle = '#6ec1e8'; ctx.fillRect(px, py, S, S);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(px + 2, py + 3, 3, 1); ctx.fillRect(px + 5, py + 6, 3, 1);
    ctx.fillStyle = '#b9b4a8';
    if (!nb(0, -1)) ctx.fillRect(px, py, S, 2);
    if (!nb(0, 1)) ctx.fillRect(px, py + S - 2, S, 2);
    if (!nb(-1, 0)) ctx.fillRect(px, py, 2, S);
    if (!nb(1, 0)) ctx.fillRect(px + S - 2, py, 2, S);
    if (nb(0, -1) && nb(0, 1) && nb(-1, 0) && nb(1, 0)) {
      const cx = px + S / 2, cy = py + S / 2;
      ctx.fillStyle = '#8d877d'; ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#c9c4b8'; ctx.beginPath(); ctx.arc(cx - 0.5, cy - 0.5, 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e8f6ff'; ctx.beginPath(); ctx.arc(cx, cy, 1.6, 0, Math.PI * 2); ctx.fill();
    }
  }

  // ------------------------------------------------------------------ construções, muralhas e vegetação (de cima para baixo)
  *standing() {
    const { zone, W, H } = this;
    const items = [];
    for (const st of zone.structures) {
      if (st.kind === 'wall') items.push({ y: st.y + st.h, f: () => this.wall(st) });
      else if (st.kind === 'gate') items.push({ y: st.y + st.h, f: () => this.gate(st) });
    }
    for (const st of zone.structures) {
      if (st.kind === 'house') items.push({ y: st.y + st.h, f: () => this.house(st) });
      else if (st.kind === 'tower') items.push({ y: st.y + st.h, f: () => this.tower(st) });
    }
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const o = this.objs[y * W + x];
        if (o === O.TREE || o === O.PINE || o === O.BIGTREE || o === O.DEADTREE || o === O.BUSH) items.push({ y: y + 1, f: () => this.tree(x, y, o) });
        else if (o === O.ROCK) items.push({ y: y + 0.8, f: () => this.rock(x, y) });
        else if (o === O.STALL) items.push({ y: y + 1, f: () => this.stall(x, y) });
        else if (o === O.TENT) items.push({ y: y + 1, f: () => this.tent(x, y) });
        else if (o === O.PILLAR || o === O.BROKENPILLAR || o === O.STATUE) items.push({ y: y + 0.8, f: () => this.pillar(x, y, o) });
        else if (o === O.STALAG) items.push({ y: y + 0.8, f: () => this.stalag(x, y) });
        else if (o === O.CRYSTAL) items.push({ y: y + 0.8, f: () => this.crystal(x, y) });
        else if (o === O.PALM || o === O.CACTUS) items.push({ y: y + 1, f: () => this.tree(x, y, o) });
        else if (o === O.OBELISK) items.push({ y: y + 0.8, f: () => this.obelisk(x, y) });
      }
    }
    // paredes, portões e torres antes das casas e das árvores; o resto na ordem de cima para baixo
    items.sort((a, b) => a.y - b.y);
    let n = 0;
    for (const it of items) { it.f(); if ((++n & 63) === 0 && this.more()) yield; }
  }

  wall(st) {
    const { S, ctx } = this;
    const x = st.x * S, y = st.y * S, w = st.w * S, h = st.h * S;
    const castle = !!st.castle;
    const base = castle ? '#b0b5be' : '#a39d92';
    ctx.fillStyle = base; ctx.fillRect(x, y, w, h);
    // fiadas de pedra
    ctx.fillStyle = 'rgba(40,36,32,0.22)';
    const long = w >= h;
    if (long) { for (let i = 3; i < h; i += 3) ctx.fillRect(x, y + i, w, 1); for (let i = 0; i < w; i += 5) for (let j = 0; j < h; j += 6) ctx.fillRect(x + i + ((j / 6) % 2) * 2.5, y + j, 1, 3); }
    else { for (let i = 3; i < w; i += 3) ctx.fillRect(x + i, y, 1, h); for (let i = 0; i < h; i += 5) for (let j = 0; j < w; j += 6) ctx.fillRect(x + j, y + i + ((j / 6) % 2) * 2.5, 3, 1); }
    // ameias nas duas bordas e luz no lado noroeste
    ctx.fillStyle = castle ? '#cfd4dc' : '#bdb7ab';
    const step = 5;
    if (long) { for (let i = 1; i < w - 3; i += step) { ctx.fillRect(x + i, y, 3, 2.2); ctx.fillRect(x + i, y + h - 2.2, 3, 2.2); } }
    else { for (let i = 1; i < h - 3; i += step) { ctx.fillRect(x, y + i, 2.2, 3); ctx.fillRect(x + w - 2.2, y + i, 2.2, 3); } }
    ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y, 1, h);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x, y + h - 1, w, 1); ctx.fillRect(x + w - 1, y, 1, h);
  }

  tower(st) {
    const { S, ctx } = this;
    const x = st.x * S, y = st.y * S, w = st.w * S, h = st.h * S;
    const castle = !!st.castle;
    ctx.fillStyle = castle ? '#aab0ba' : '#9b9589'; ctx.fillRect(x, y, w, h);
    // ameias em volta
    ctx.fillStyle = castle ? '#d2d7df' : '#c1bbaf';
    for (let i = 1; i < w - 2; i += 4) { ctx.fillRect(x + i, y, 2.6, 2.6); ctx.fillRect(x + i, y + h - 2.6, 2.6, 2.6); }
    for (let i = 1; i < h - 2; i += 4) { ctx.fillRect(x, y + i, 2.6, 2.6); ctx.fillRect(x + w - 2.6, y + i, 2.6, 2.6); }
    // cobertura em pirâmide (quatro faces com luz do noroeste)
    const m = 3, cx = x + w / 2, cy = y + h / 2;
    const roof = castle ? ['#4b73a6', '#35557f', '#233a58'] : ['#c8603f', '#a04327', '#6e2a17'];
    const face = (a, b, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.closePath(); ctx.fill(); };
    face([x + m, y + m], [x + w - m, y + m], roof[0]);
    face([x + m, y + m], [x + m, y + h - m], roof[0]);
    face([x + w - m, y + m], [x + w - m, y + h - m], roof[1]);
    face([x + m, y + h - m], [x + w - m, y + h - m], roof[2]);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x + m, y + m); ctx.moveTo(cx, cy); ctx.lineTo(x + w - m, y + m); ctx.moveTo(cx, cy); ctx.lineTo(x + w - m, y + h - m); ctx.moveTo(cx, cy); ctx.lineTo(x + m, y + h - m); ctx.stroke();
    ctx.strokeRect(x + m, y + m, w - 2 * m, h - 2 * m);
    ctx.fillStyle = '#e8d27a'; ctx.beginPath(); ctx.arc(cx, cy, 1.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y, 1, h);
  }

  // portão: dois pilares de pedra e a abertura escura com a grade levantada
  gate(st) {
    const { S, ctx } = this;
    const x = st.x * S, y = st.y * S, w = st.w * S, h = st.h * S;
    const long = w >= h;
    ctx.fillStyle = '#8a857b';
    if (long) { ctx.fillRect(x, y, 4, h); ctx.fillRect(x + w - 4, y, 4, h); } else { ctx.fillRect(x, y, w, 4); ctx.fillRect(x, y + h - 4, w, 4); }
    ctx.fillStyle = 'rgba(40,28,16,0.8)';
    if (long) ctx.fillRect(x + 4, y + h / 2 - 1, w - 8, 2); else ctx.fillRect(x + w / 2 - 1, y + 4, 2, h - 8);
    ctx.strokeStyle = '#2f3238'; ctx.lineWidth = 1; ctx.beginPath();
    if (long) { for (let i = 6; i < w - 5; i += 3) { ctx.moveTo(x + i, y + h / 2 - 3); ctx.lineTo(x + i, y + h / 2 + 3); } } else { for (let i = 6; i < h - 5; i += 3) { ctx.moveTo(x + w / 2 - 3, y + i); ctx.lineTo(x + w / 2 + 3, y + i); } }
    ctx.stroke();
  }

  // torre de adobe em voxel: terraço de areia com parapeito, parede da frente mais escura e a porta
  voxelTower(st) {
    const { S, ctx } = this;
    const x = st.x * S + 0.5, y = st.y * S + 0.5, w = st.w * S - 1, h = st.h * S - 1;
    const fh = Math.min(5, h * 0.4);
    const rh = h - fh;
    const sand = this.r(st.x, st.y, 31) < 0.5 ? ['#c7ab78', '#8d7449'] : ['#bfa36f', '#85703f'];
    ctx.fillStyle = sand[1]; ctx.fillRect(x, y + rh, w, fh);
    ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(x, y + rh, w, 0.8);
    ctx.fillStyle = sand[0]; ctx.fillRect(x, y, w, rh);
    ctx.strokeStyle = '#5a4630'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, rh - 1);
    ctx.fillStyle = 'rgba(70,40,25,0.55)'; ctx.fillRect(x + 1.5, y + 1.5, w - 3, 1);
    ctx.fillStyle = '#2f2418'; ctx.fillRect(x + w / 2 - 1.2, y + h - Math.min(3, fh - 0.5), 2.4, Math.min(3, fh - 0.5));
  }

  house(st) {
    const { S, ctx } = this;
    const k = st.seed || 1;
    const type = st.type || 'house';
    if (type === 'voxel') { this.voxelTower(st); return; }
    const stoneWall = STONE_TYPES.has(type) || (type === 'house' && this.r(st.x, st.y, 17) < 0.45);
    const wallCol = (stoneWall ? WALL_STONE : WALL_PLASTER)[k % 3];
    const tall = /tower/.test(type);
    let pal = ROOFS[Math.floor(this.r(st.x, st.y, 23) * ROOFS.length) % ROOFS.length];
    if (type === 'keep') pal = ['#4b73a6', '#35557f', '#233a58'];
    else if (type === 'chapel') pal = ['#6f7f90', '#52606f', '#37424e'];
    else if (type === 'tavern' || type === 'barracks' || type === 'guardhouse') pal = ROOFS[type === 'tavern' ? 2 : 0];
    else if (type === 'bank') pal = ['#7a8aa0', '#5a6a80', '#3b4658'];
    const x = st.x * S + 0.5, y = st.y * S + 0.5, w = st.w * S - 1, h = st.h * S - 1;
    const fh = tall ? 0 : Math.min(3.4, h * 0.3); // fachada sul visível
    const rh = h - fh;
    // paredes (fachada)
    if (fh) {
      ctx.fillStyle = wallCol; ctx.fillRect(x, y + rh, w, fh);
      ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(x, y + rh, w, 0.8);
      ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(x, y + h - 0.8, w, 0.8);
    }
    if (tall) {
      // torres: cobertura em pirâmide como a das torres das muralhas
      this.tower({ x: st.x, y: st.y, w: st.w, h: st.h, castle: type === 'keeptower' });
      return;
    }
    const hor = w >= h; // cumeeira ao longo do lado maior
    const [lit, dark, edge] = pal;
    const var1 = 0.94 + this.r(st.x, st.y, 29) * 0.12;
    const L = (c) => rgb(hex(c), var1);
    if (hor) {
      const mid = y + rh / 2;
      ctx.fillStyle = L(lit); ctx.fillRect(x, y, w, rh / 2);
      ctx.fillStyle = L(dark); ctx.fillRect(x, mid, w, rh / 2);
      ctx.fillStyle = 'rgba(0,0,0,0.17)';
      for (let i = 2.2; i < rh / 2; i += 2.2) { ctx.fillRect(x, y + i, w, 0.7); ctx.fillRect(x, mid + i, w, 0.7); }
      ctx.fillStyle = 'rgba(255,235,200,0.5)'; ctx.fillRect(x, mid - 0.5, w, 1);
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x, y + rh - 1, w, 1);
    } else {
      const mid = x + w / 2;
      ctx.fillStyle = L(lit); ctx.fillRect(x, y, w / 2, rh);
      ctx.fillStyle = L(dark); ctx.fillRect(mid, y, w / 2, rh);
      ctx.fillStyle = 'rgba(0,0,0,0.17)';
      for (let i = 2.2; i < w / 2; i += 2.2) { ctx.fillRect(x + i, y, 0.7, rh); ctx.fillRect(mid + i, y, 0.7, rh); }
      ctx.fillStyle = 'rgba(255,235,200,0.5)'; ctx.fillRect(mid - 0.5, y, 1, rh);
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x, y + rh - 1, w, 1);
    }
    ctx.strokeStyle = edge; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, rh - 1);
    // chaminé
    if (!stoneWall || type === 'smithy' || type === 'tavern') {
      const cxm = hor ? x + w * (0.2 + 0.5 * this.r(st.x, st.y, 31)) : x + w * 0.25;
      const cym = hor ? y + rh * 0.18 : y + rh * (0.2 + 0.5 * this.r(st.x, st.y, 32));
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(cxm + 1, cym + 1, 3.4, 3.4);
      ctx.fillStyle = '#7d756b'; ctx.fillRect(cxm, cym, 3.4, 3.4);
      ctx.fillStyle = '#2a2622'; ctx.fillRect(cxm + 0.8, cym + 0.8, 1.8, 1.8);
    }
    if (type === 'chapel') {
      // cruz sobre a cumeeira
      ctx.fillStyle = '#e8e2cf'; const cxx = hor ? x + w * 0.12 : x + w / 2, cyy = hor ? y + rh / 2 : y + rh * 0.12;
      ctx.fillRect(cxx - 0.6, cyy - 2.4, 1.2, 4.8); ctx.fillRect(cxx - 1.8, cyy - 1, 3.6, 1.1);
    }
    // janelas e porta na fachada sul
    if (fh) {
      ctx.fillStyle = '#5d7790';
      const nWin = Math.max(1, Math.floor(w / (S * 1.6)));
      for (let i = 0; i < nWin; i++) {
        const wx = x + (i + 0.5) * (w / nWin) - 1;
        ctx.fillRect(wx, y + rh + 0.7, 2.2, 1.6);
        ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(wx, y + rh + 0.7, 2.2, 0.5); ctx.fillStyle = '#5d7790';
      }
    }
    // porta: sempre marcada na face onde fica, com um degrau claro
    const g = houseGeom(st);
    if (g) {
      const [dx, dy] = g.door;
      const [ix, iy] = g.inward;
      const dxp = dx * S, dyp = dy * S;
      const horiz = ix === 0; // fachada ao longo de X
      const edge2 = horiz ? (iy > 0 ? st.y * S : (st.y + st.h) * S) : (ix > 0 ? st.x * S : (st.x + st.w) * S);
      const out = horiz ? -iy : -ix;
      // degrau de pedra fora da casa e a folha da porta
      ctx.fillStyle = '#d8d2c4';
      if (horiz) ctx.fillRect(dxp - 5, edge2 + (out > 0 ? 0 : -1.6), 10, 1.6); else ctx.fillRect(edge2 + (out > 0 ? 0 : -1.6), dyp - 5, 1.6, 10);
      ctx.fillStyle = '#4a2f18';
      if (horiz) ctx.fillRect(dxp - 3.2, edge2 - 1.5 + (out > 0 ? 0.4 : 0), 6.4, 2.4); else ctx.fillRect(edge2 - 1.5 + (out > 0 ? 0.4 : 0), dyp - 3.2, 2.4, 6.4);
      ctx.fillStyle = '#e0b020';
      if (horiz) ctx.fillRect(dxp + 1.6, edge2 - 0.4, 0.9, 0.9); else ctx.fillRect(edge2 - 0.4, dyp + 1.6, 0.9, 0.9);
    }
  }

  stall(x, y) {
    const { S, ctx } = this;
    const px = x * S + 0.5, py = y * S + 0.5, w = S - 1, h = S - 1;
    const c1 = (x + y) % 2 ? '#c0392b' : '#2e6fa6';
    ctx.fillStyle = '#6e4a26'; ctx.fillRect(px - 1, py + 1, w + 2, h);
    for (let i = 0; i < 6; i++) { ctx.fillStyle = i % 2 ? '#f3ecdc' : c1; ctx.fillRect(px - 1 + i * ((w + 2) / 6), py, (w + 2) / 6 + 0.3, h * 0.78); }
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(px - 1, py + h * 0.78 - 1, w + 2, 1.2);
    ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(px - 1, py, w + 2, 1);
  }

  tent(x, y) {
    const { S, ctx } = this;
    const px = x * S, py = y * S, cx = px + S / 2, cy = py + S / 2;
    ctx.fillStyle = '#c9b38a'; ctx.fillRect(px, py, S, S);
    ctx.fillStyle = '#e4d3aa'; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + S, py); ctx.lineTo(cx, cy); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#d3be94'; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, py + S); ctx.lineTo(cx, cy); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#9d8860'; ctx.beginPath(); ctx.moveTo(px + S, py); ctx.lineTo(px + S, py + S); ctx.lineTo(cx, cy); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#85714d'; ctx.beginPath(); ctx.moveTo(px, py + S); ctx.lineTo(px + S, py + S); ctx.lineTo(cx, cy); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.strokeRect(px + 0.5, py + 0.5, S - 1, S - 1);
  }

  pillar(x, y, o) {
    const { S, ctx } = this;
    const cx = (x + 0.5) * S, cy = (y + 0.5) * S;
    const broken = o === O.BROKENPILLAR;
    ctx.fillStyle = '#6d6a64'; ctx.beginPath(); ctx.arc(cx, cy, S * (broken ? 0.36 : 0.32), 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#b5b0a5'; ctx.beginPath(); ctx.arc(cx - 0.5, cy - 0.5, S * (broken ? 0.28 : 0.25), 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#d5d0c4'; ctx.beginPath(); ctx.arc(cx - 1, cy - 1, S * 0.12, 0, Math.PI * 2); ctx.fill();
    if (o === O.STATUE) { ctx.fillStyle = '#8f8a80'; ctx.fillRect(cx - 1, cy - 3, 2, 6); ctx.fillRect(cx - 2.5, cy - 1, 5, 1.5); }
  }

  // obelisco visto de cima: pirâmide dourada sobre a base de arenito, com glifos
  obelisk(x, y) {
    const { S, ctx } = this;
    const cx = (x + 0.5) * S, cy = (y + 0.5) * S, r = S * 0.34;
    ctx.fillStyle = '#7e6a46'; ctx.fillRect(cx - r - 1, cy - r - 1, r * 2 + 2, r * 2 + 2);
    ctx.fillStyle = '#c9a56a'; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    const face = (a, b, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.closePath(); ctx.fill(); };
    face([cx - r, cy - r], [cx + r, cy - r], '#f7dc6f'); face([cx - r, cy - r], [cx - r, cy + r], '#f4d03f');
    face([cx + r, cy - r], [cx + r, cy + r], '#d4ac0d'); face([cx - r, cy + r], [cx + r, cy + r], '#b7950b');
    ctx.fillStyle = '#fff3b0'; ctx.fillRect(cx - 0.6, cy - 0.6, 1.2, 1.2);
  }

  stalag(x, y) {
    const { S, ctx } = this;
    const cx = (x + 0.5) * S, cy = (y + 0.5) * S;
    ctx.fillStyle = '#4a433d'; ctx.beginPath(); ctx.moveTo(cx - 3.6, cy + 3); ctx.lineTo(cx, cy - 4); ctx.lineTo(cx + 3.6, cy + 3); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#8c8379'; ctx.beginPath(); ctx.moveTo(cx - 3.6, cy + 3); ctx.lineTo(cx, cy - 4); ctx.lineTo(cx - 0.5, cy + 3); ctx.closePath(); ctx.fill();
  }

  crystal(x, y) {
    const { S, ctx } = this;
    const cx = (x + 0.5) * S, cy = (y + 0.5) * S;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 8);
    g.addColorStop(0, 'rgba(190,120,255,0.55)'); g.addColorStop(1, 'rgba(190,120,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#7d4bb0'; ctx.beginPath(); ctx.moveTo(cx, cy - 4.5); ctx.lineTo(cx + 3, cy); ctx.lineTo(cx, cy + 4); ctx.lineTo(cx - 3, cy); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#d3aaf5'; ctx.beginPath(); ctx.moveTo(cx, cy - 4.5); ctx.lineTo(cx - 3, cy); ctx.lineTo(cx, cy); ctx.closePath(); ctx.fill();
  }

  rock(x, y) {
    const { S, ctx } = this;
    const cx = (x + 0.5) * S, cy = (y + 0.55) * S;
    const R = (k) => this.r(x, y, 80 + k);
    const n = 7, pts = [];
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + R(i) * 0.4, r = S * (0.34 + R(10 + i) * 0.14); pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.85]); }
    const path = () => { ctx.beginPath(); pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.closePath(); };
    ctx.fillStyle = '#5f5b55'; path(); ctx.fill();
    ctx.save(); path(); ctx.clip();
    ctx.fillStyle = '#9b968d'; ctx.beginPath(); ctx.ellipse(cx - 1, cy - 1, S * 0.34, S * 0.28, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#bcb7ad'; ctx.beginPath(); ctx.ellipse(cx - 1.8, cy - 1.8, S * 0.16, S * 0.12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(25,22,20,0.55)'; ctx.lineWidth = 0.8; path(); ctx.stroke();
  }

  // ------------------------------------------------------------------ árvores (sprites reaproveitados)
  makeSprites() {
    const S = this.S;
    const mk = (size, draw) => {
      const cv = document.createElement('canvas');
      cv.width = cv.height = Math.ceil(size);
      const c = cv.getContext('2d');
      c.translate(size / 2, size / 2);
      draw(c);
      return cv;
    };
    const blob = (c, r, cols, seed) => {
      // copa: círculos sobrepostos do escuro para o claro (a luz vem do noroeste)
      c.fillStyle = cols[0]; c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fill();
      for (let i = 0; i < 4; i++) {
        const a = seed * 7 + i * 1.6, d = r * 0.42;
        c.fillStyle = cols[1]; c.beginPath(); c.arc(Math.cos(a) * d - 0.6, Math.sin(a) * d - 0.6, r * 0.52, 0, Math.PI * 2); c.fill();
      }
      c.fillStyle = cols[2]; c.beginPath(); c.arc(-r * 0.28, -r * 0.3, r * 0.42, 0, Math.PI * 2); c.fill();
      c.fillStyle = cols[3];
      for (let i = 0; i < 5; i++) { const a = seed * 3 + i * 1.3; c.fillRect(Math.cos(a) * r * 0.55 - 1, Math.sin(a) * r * 0.5 - 1.2, 1.4, 1.4); }
      c.strokeStyle = 'rgba(15,40,15,0.55)'; c.lineWidth = 0.9; c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.stroke();
    };
    this.sprites = { round: [], pine: [], dead: [], bush: [], palm: [], cactus: [] };
    for (let v = 0; v < 3; v++) {
      this.sprites.round.push(mk(S * 1.5, (c) => blob(c, S * 0.62, ['#2c6a2c', '#3f8a36', '#66b04a', '#a8d77a'], v + 1)));
      this.sprites.bush.push(mk(S, (c) => blob(c, S * 0.34, ['#2f6d2a', '#43903a', '#6cb552', '#c7e59a'], v + 4)));
      this.sprites.pine.push(mk(S * 1.4, (c) => {
        const star = (r, ri, col, rot) => { c.fillStyle = col; c.beginPath(); for (let i = 0; i < 16; i++) { const a = rot + (i / 16) * Math.PI * 2, rr = i % 2 ? ri : r; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } c.closePath(); c.fill(); };
        star(S * 0.58, S * 0.22, '#1d4d2b', v * 0.2);
        star(S * 0.44, S * 0.18, '#2a6b38', 0.2 + v * 0.2);
        star(S * 0.3, S * 0.12, '#3b8a47', 0.1);
        c.fillStyle = '#7ec58a'; c.beginPath(); c.arc(-S * 0.08, -S * 0.08, S * 0.1, 0, Math.PI * 2); c.fill();
        c.strokeStyle = 'rgba(10,30,15,0.5)'; c.lineWidth = 0.7; c.beginPath(); for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2, rr = i % 2 ? S * 0.22 : S * 0.58; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } c.closePath(); c.stroke();
      }));
      // palmeira vista de cima: folhas compridas saindo do centro, com o tronco e os cocos no meio
      this.sprites.palm.push(mk(S * 2.2, (c) => {
        for (let i = 0; i < 9; i++) {
          const a = v * 0.3 + (i / 9) * Math.PI * 2, len = S * (0.85 + (i % 2) * 0.12);
          c.fillStyle = i % 2 ? '#2f7a30' : '#3f9638';
          c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(Math.cos(a - 0.22) * len * 0.6, Math.sin(a - 0.22) * len * 0.6, Math.cos(a) * len, Math.sin(a) * len); c.quadraticCurveTo(Math.cos(a + 0.22) * len * 0.6, Math.sin(a + 0.22) * len * 0.6, 0, 0); c.fill();
          c.strokeStyle = 'rgba(15,50,15,0.45)'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a) * len, Math.sin(a) * len); c.stroke();
        }
        c.fillStyle = '#7a5a2e'; c.beginPath(); c.arc(0, 0, S * 0.16, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#4a3318'; c.beginPath(); c.arc(S * 0.06, S * 0.04, S * 0.06, 0, Math.PI * 2); c.fill(); c.beginPath(); c.arc(-S * 0.05, S * 0.07, S * 0.05, 0, Math.PI * 2); c.fill();
      }));
      // cacto visto de cima: corpo redondo com dois braços
      this.sprites.cactus.push(mk(S * 1.2, (c) => {
        c.fillStyle = '#3d7a30'; c.beginPath(); c.arc(0, 0, S * 0.2, 0, Math.PI * 2); c.fill();
        for (const sx of [-1, 1]) { c.beginPath(); c.arc(sx * S * 0.3, (v - 1) * S * 0.08, S * 0.12, 0, Math.PI * 2); c.fill(); }
        c.fillStyle = '#5aa044'; c.beginPath(); c.arc(-S * 0.05, -S * 0.05, S * 0.12, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#e84393'; c.fillRect(-1, -1, 2, 2);
        c.strokeStyle = 'rgba(15,45,15,0.5)'; c.lineWidth = 0.7; c.beginPath(); c.arc(0, 0, S * 0.2, 0, Math.PI * 2); c.stroke();
      }));
      this.sprites.dead.push(mk(S * 1.2, (c) => {
        c.strokeStyle = '#4c3b2b'; c.lineWidth = 1.4; c.lineCap = 'round';
        for (let i = 0; i < 6; i++) { const a = v + i * 1.05; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a) * S * 0.5, Math.sin(a) * S * 0.5); c.stroke(); c.beginPath(); c.moveTo(Math.cos(a) * S * 0.25, Math.sin(a) * S * 0.25); c.lineTo(Math.cos(a + 0.7) * S * 0.42, Math.sin(a + 0.7) * S * 0.42); c.stroke(); }
        c.fillStyle = '#5b4733'; c.beginPath(); c.arc(0, 0, S * 0.1, 0, Math.PI * 2); c.fill();
      }));
    }
  }

  tree(x, y, o) {
    const { S, ctx } = this;
    const v = Math.floor(this.r(x, y, 90) * 3);
    const jx = (this.r(x, y, 91) - 0.5) * 2, jy = (this.r(x, y, 92) - 0.5) * 2;
    const set = o === O.PINE ? this.sprites.pine : o === O.DEADTREE ? this.sprites.dead : o === O.BUSH ? this.sprites.bush : o === O.PALM ? this.sprites.palm : o === O.CACTUS ? this.sprites.cactus : this.sprites.round;
    const spr = set[v];
    const k = o === O.BIGTREE ? 1.5 : 1;
    const cx = (x + 0.5) * S + jx, cy = (y + 0.5) * S + jy;
    ctx.drawImage(spr, cx - spr.width * k / 2, cy - spr.height * k / 2, spr.width * k, spr.height * k);
  }
}
