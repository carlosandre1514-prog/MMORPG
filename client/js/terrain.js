// Renderização do terreno (em blocos pré-desenhados) e dos objetos do cenário.
import { T, O, OBJ_INFO } from '/shared/tiles.js';
import { TILE } from '/shared/constants.js';
import { hash2 } from '/shared/rng.js';
import { shade, rgba, rr, circle, ellipse, shadow } from './sprites.js';

const CHUNK = 16;

const BASE = {
  [T.GRASS]: '#5a9a3e', [T.DARKGRASS]: '#447d33', [T.DIRT]: '#9a7650', [T.SAND]: '#d9c48d',
  [T.WATER]: '#3b7fc4', [T.DEEP]: '#2a5f9e', [T.STONE]: '#8e8e8e', [T.WOOD]: '#8b6a42',
  [T.CAVE]: '#4d4540', [T.ASH]: '#5d5652', [T.LAVA]: '#d9541e', [T.BRIDGE]: '#3b7fc4',
  [T.CAVEWALL]: '#2e2925', [T.MUD]: '#594a3a', [T.COBBLE]: '#8f8a83', [T.RUIN]: '#9b9184',
  [T.VOID]: '#000000', [T.ARENA]: '#c7a46a',
};

// Prioridade para bordas orgânicas: tiles de prioridade maior "invadem" os vizinhos.
const PRIORITY = {
  [T.WATER]: 0, [T.DEEP]: 0, [T.LAVA]: 0, [T.BRIDGE]: 1, [T.SAND]: 2, [T.MUD]: 3, [T.ASH]: 4,
  [T.DIRT]: 5, [T.COBBLE]: 3, [T.RUIN]: 3, [T.ARENA]: 2, [T.GRASS]: 7, [T.DARKGRASS]: 8,
  [T.CAVE]: 2, [T.CAVEWALL]: 9, [T.STONE]: 3, [T.WOOD]: 3, [T.VOID]: 10,
};
const BLEEDS = new Set([T.GRASS, T.DARKGRASS, T.SAND, T.DIRT, T.ASH, T.MUD]);
const LIQUID = new Set([T.WATER, T.DEEP, T.LAVA]);

export class Terrain {
  constructor(zone) {
    this.zone = zone;
    this.map = zone.map;
    this.chunks = new Map();
    this.scale = 1;
    this.objCache = new Map();
    this.structCache = new Map();
    this.order = [];
    this.lights = [];
    this.tallObjects = [];
    this.buildObjectLists();
  }

  setScale(s) {
    if (Math.abs(s - this.scale) > 0.01) {
      this.scale = s;
      this.chunks.clear();
      this.objCache.clear();
      this.structCache.clear();
      this.order = [];
    }
  }

  tile(x, y) {
    const m = this.map;
    if (x < 0 || y < 0 || x >= m.w || y >= m.h) return T.VOID;
    return m.tiles[y * m.w + x];
  }

  obj(x, y) {
    const m = this.map;
    if (x < 0 || y < 0 || x >= m.w || y >= m.h) return 0;
    return m.objs[y * m.w + x];
  }

  buildObjectLists() {
    const m = this.map;
    for (let y = 0; y < m.h; y++) {
      for (let x = 0; x < m.w; x++) {
        const o = m.objs[y * m.w + x];
        if (!o) continue;
        const info = OBJ_INFO[o];
        if (info.light) this.lights.push({ x: x + 0.5, y: y + 0.5, r: info.light, o });
        if (info.tall) this.tallObjects.push({ x, y, o, v: hash2(x, y, 99) });
      }
      for (let x = 0; x < m.w; x++) {
        if (m.tiles[y * m.w + x] === T.LAVA && hash2(x, y, 5) < 0.15) this.lights.push({ x: x + 0.5, y: y + 0.5, r: 3, lava: true });
      }
    }
    // fonte ocupa 3x3; desenhada uma vez
    this.tallObjects = this.tallObjects.filter((t) => {
      if (t.o !== O.FOUNTAIN) return true;
      return this.obj(t.x - 1, t.y) !== O.FOUNTAIN && this.obj(t.x, t.y - 1) !== O.FOUNTAIN;
    });
  }

  // ---------------------------------------------------------------- chão
  getChunk(cx, cy) {
    const key = cx + ',' + cy;
    let c = this.chunks.get(key);
    if (c) return c;
    const px = CHUNK * TILE;
    const k = this.scale;
    const cv = document.createElement('canvas');
    cv.width = Math.ceil(px * k);
    cv.height = Math.ceil(px * k);
    const ctx = cv.getContext('2d');
    ctx.scale(k, k);
    this.drawChunk(ctx, cx, cy);
    c = cv;
    this.chunks.set(key, c);
    this.order.push(key);
    if (this.order.length > 28) this.chunks.delete(this.order.shift());
    return c;
  }

  drawChunk(ctx, cx, cy) {
    const x0 = cx * CHUNK, y0 = cy * CHUNK;
    // camada base
    for (let ty = -1; ty <= CHUNK; ty++) {
      for (let tx = -1; tx <= CHUNK; tx++) {
        const X = x0 + tx, Y = y0 + ty;
        if (tx < 0 || ty < 0 || tx >= CHUNK || ty >= CHUNK) continue;
        this.drawTileBase(ctx, tx * TILE, ty * TILE, this.tile(X, Y), X, Y);
      }
    }
    // bordas orgânicas
    for (let ty = 0; ty < CHUNK; ty++) {
      for (let tx = 0; tx < CHUNK; tx++) {
        const X = x0 + tx, Y = y0 + ty;
        const t = this.tile(X, Y);
        const pt = PRIORITY[t] ?? 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const n = this.tile(X + dx, Y + dy);
          if (n === t || !BLEEDS.has(n) || (PRIORITY[n] ?? 0) <= pt) continue;
          this.bleed(ctx, tx * TILE, ty * TILE, dx, dy, n, X, Y);
        }
      }
    }
    // espuma nas margens / paredes de caverna
    for (let ty = 0; ty < CHUNK; ty++) {
      for (let tx = 0; tx < CHUNK; tx++) {
        const X = x0 + tx, Y = y0 + ty;
        const t = this.tile(X, Y);
        if (LIQUID.has(t)) this.shore(ctx, tx * TILE, ty * TILE, t, X, Y);
        if (t === T.CAVEWALL) this.caveWall(ctx, tx * TILE, ty * TILE, X, Y);
        if (t === T.BRIDGE) this.bridge(ctx, tx * TILE, ty * TILE, X, Y);
      }
    }
    // decoração rasteira
    for (let ty = 0; ty < CHUNK; ty++) {
      for (let tx = 0; tx < CHUNK; tx++) {
        const X = x0 + tx, Y = y0 + ty;
        const o = this.obj(X, Y);
        if (o && !OBJ_INFO[o].tall && o !== O.BUILDING) this.drawDecor(ctx, tx * TILE, ty * TILE, o, X, Y);
      }
    }
  }

  drawTileBase(ctx, px, py, t, X, Y) {
    const h = hash2(X, Y, 1);
    let base = BASE[t] || '#000';
    if (t === T.GRASS || t === T.DARKGRASS) base = shade(base, (h - 0.5) * 0.08);
    ctx.fillStyle = base;
    ctx.fillRect(px, py, TILE, TILE);
    switch (t) {
      case T.GRASS:
      case T.DARKGRASS: {
        const dark = shade(base, -0.1), light = shade(base, 0.1);
        for (let i = 0; i < 5; i++) {
          const gx = px + hash2(X, Y, 10 + i) * 29, gy = py + hash2(X, Y, 20 + i) * 28;
          ctx.fillStyle = i % 2 ? dark : light;
          ctx.fillRect(gx, gy, 1, 3);
          ctx.fillRect(gx + 2, gy + 1, 1, 2);
        }
        if (hash2(X, Y, 33) < 0.12) {
          ctx.fillStyle = shade(base, 0.06);
          ellipse(ctx, px + 8 + hash2(X, Y, 34) * 16, py + 8 + hash2(X, Y, 35) * 16, 7, 4, ctx.fillStyle);
        }
        break;
      }
      case T.DIRT:
      case T.MUD:
        for (let i = 0; i < 5; i++) {
          ctx.fillStyle = i % 2 ? shade(base, -0.2) : shade(base, 0.15);
          ellipse(ctx, px + hash2(X, Y, 30 + i) * 28 + 2, py + hash2(X, Y, 40 + i) * 28 + 2, 1.6, 1.1, ctx.fillStyle);
        }
        break;
      case T.SAND:
      case T.ARENA:
        for (let i = 0; i < 6; i++) {
          ctx.fillStyle = shade(base, (hash2(X, Y, 50 + i) - 0.5) * 0.25);
          ctx.fillRect(px + hash2(X, Y, 60 + i) * 30, py + hash2(X, Y, 70 + i) * 30, 1.5, 1.5);
        }
        break;
      case T.WATER:
      case T.DEEP:
      case T.BRIDGE:
        ctx.strokeStyle = shade(BASE[T.WATER], 0.18);
        ctx.lineWidth = 1;
        for (let i = 0; i < 2; i++) {
          const wx = px + hash2(X, Y, 80 + i) * 22, wy = py + 6 + hash2(X, Y, 90 + i) * 20;
          ctx.beginPath(); ctx.moveTo(wx, wy); ctx.quadraticCurveTo(wx + 4, wy - 2, wx + 8, wy); ctx.stroke();
        }
        break;
      case T.LAVA: {
        const g = ctx.createRadialGradient(px + 16, py + 16, 2, px + 16, py + 16, 22);
        g.addColorStop(0, '#ffb347'); g.addColorStop(1, '#c0391b');
        ctx.fillStyle = g; ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = 'rgba(80,20,10,0.5)';
        for (let i = 0; i < 3; i++) ellipse(ctx, px + hash2(X, Y, 100 + i) * 28 + 2, py + hash2(X, Y, 110 + i) * 28 + 2, 3, 2, 'rgba(90,25,10,0.45)');
        break;
      }
      case T.STONE: {
        // lajes quadradas (pátios e praças): bem diferentes das pedras irregulares do calçamento
        ctx.fillStyle = shade(base, -0.34);
        ctx.fillRect(px, py, TILE, TILE);
        for (let r = 0; r < 2; r++) {
          for (let c = 0; c < 2; c++) {
            const sx = px + c * 16, sy = py + r * 16;
            ctx.fillStyle = shade(base, 0.06 + (hash2(X * 2 + c, Y * 2 + r, 3) - 0.5) * 0.14);
            ctx.fillRect(sx + 1, sy + 1, 14, 14);
            ctx.fillStyle = shade(base, 0.2);
            ctx.fillRect(sx + 1, sy + 1, 14, 1); ctx.fillRect(sx + 1, sy + 1, 1, 14);
          }
        }
        break;
      }
      case T.COBBLE: {
        ctx.fillStyle = shade(base, -0.25);
        ctx.fillRect(px, py, TILE, TILE);
        const off = (Y % 2) * 8;
        for (let r = 0; r < 2; r++) {
          for (let c = -1; c < 2; c++) {
            const sx = px + c * 16 + off + (r ? 8 : 0), sy = py + r * 16;
            const col = shade(base, (hash2(X * 3 + c, Y * 3 + r, 3) - 0.5) * 0.2);
            ctx.fillStyle = col;
            rr(ctx, Math.max(px, sx + 1), sy + 1, Math.min(14, px + TILE - sx - 1), 14, 3); ctx.fill();
          }
        }
        break;
      }
      case T.RUIN: {
        ctx.fillStyle = shade(base, -0.3);
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = shade(base, (h - 0.5) * 0.2);
        ctx.fillRect(px + 1, py + 1, TILE - 2, TILE - 2);
        if (h < 0.35) {
          ctx.strokeStyle = shade(base, -0.4); ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(px + 4, py + 6); ctx.lineTo(px + 14, py + 14); ctx.lineTo(px + 12, py + 26); ctx.stroke();
        }
        break;
      }
      case T.CAVE:
        for (let i = 0; i < 6; i++) {
          ctx.fillStyle = i % 2 ? shade(base, -0.2) : shade(base, 0.1);
          ctx.fillRect(px + hash2(X, Y, 120 + i) * 30, py + hash2(X, Y, 130 + i) * 30, 2, 2);
        }
        break;
      case T.ASH:
        for (let i = 0; i < 6; i++) {
          ctx.fillStyle = i === 0 && h < 0.3 ? '#e67e22' : shade(base, (hash2(X, Y, 140 + i) - 0.5) * 0.3);
          ctx.fillRect(px + hash2(X, Y, 150 + i) * 30, py + hash2(X, Y, 160 + i) * 30, 2, 1.5);
        }
        break;
      case T.WOOD:
        ctx.fillStyle = shade(base, -0.25);
        for (let i = 1; i < 4; i++) ctx.fillRect(px, py + i * 8, TILE, 1);
        break;
      default: break;
    }
  }

  bleed(ctx, px, py, dx, dy, n, X, Y) {
    const col = BASE[n];
    ctx.fillStyle = shade(col, (hash2(X + dx, Y + dy, 1) - 0.5) * 0.08);
    for (let i = 0; i < 5; i++) {
      const t = (i + 0.5) / 5 + (hash2(X, Y, 200 + i + dx * 7 + dy * 13) - 0.5) * 0.12;
      const depth = 2 + hash2(X, Y, 210 + i + dx * 3 + dy * 5) * 5;
      let cx, cy;
      if (dx !== 0) { cx = dx > 0 ? px + TILE : px; cy = py + t * TILE; }
      else { cx = px + t * TILE; cy = dy > 0 ? py + TILE : py; }
      circle(ctx, cx, cy, depth + 1, ctx.fillStyle);
    }
  }

  shore(ctx, px, py, t, X, Y) {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = this.tile(X + dx, Y + dy);
      if (LIQUID.has(n) || n === T.BRIDGE || n === T.VOID) continue;
      const foam = t === T.LAVA ? 'rgba(255,220,120,0.55)' : 'rgba(230,245,255,0.55)';
      ctx.fillStyle = foam;
      if (dx === 1) ctx.fillRect(px + TILE - 3, py, 3, TILE);
      if (dx === -1) ctx.fillRect(px, py, 3, TILE);
      if (dy === 1) ctx.fillRect(px, py + TILE - 3, TILE, 3);
      if (dy === -1) ctx.fillRect(px, py, TILE, 3);
    }
  }

  caveWall(ctx, px, py, X, Y) {
    const below = this.tile(X, Y + 1);
    ctx.fillStyle = '#3a342f';
    for (let i = 0; i < 4; i++) ellipse(ctx, px + hash2(X, Y, 300 + i) * 30, py + hash2(X, Y, 310 + i) * 30, 4, 3, i % 2 ? '#38322d' : '#26211e');
    if (below !== T.CAVEWALL && below !== T.VOID) {
      // face frontal da rocha
      const g = ctx.createLinearGradient(0, py + 14, 0, py + TILE);
      g.addColorStop(0, '#4a423b'); g.addColorStop(1, '#2a2420');
      ctx.fillStyle = g;
      ctx.fillRect(px, py + 14, TILE, TILE - 14);
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(px, py + 13, TILE, 2);
    }
    const above = this.tile(X, Y - 1);
    if (above !== T.CAVEWALL && above !== T.VOID) {
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(px, py, TILE, 3);
    }
  }

  bridge(ctx, px, py, X, Y) {
    const horiz = LIQUID.has(this.tile(X, Y - 1)) || this.tile(X, Y - 1) === T.BRIDGE ? false : true;
    const vert = !horiz;
    ctx.fillStyle = '#8b6a42';
    if (vert || LIQUID.has(this.tile(X - 1, Y)) === false) {
      for (let i = 0; i < 4; i++) { ctx.fillStyle = i % 2 ? '#7d5d38' : '#94724a'; ctx.fillRect(px, py + i * 8, TILE, 7); }
    } else {
      for (let i = 0; i < 4; i++) { ctx.fillStyle = i % 2 ? '#7d5d38' : '#94724a'; ctx.fillRect(px + i * 8, py, 7, TILE); }
    }
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(px, py + TILE - 2, TILE, 2);
  }

  drawDecor(ctx, px, py, o, X, Y) {
    const h = (i) => hash2(X, Y, 400 + i);
    switch (o) {
      case O.FLOWERS: {
        const cols = ['#f1948a', '#f7dc6f', '#ffffff', '#bb8fce', '#85c1e9'];
        for (let i = 0; i < 5; i++) {
          const fx = px + 4 + h(i) * 24, fy = py + 4 + h(i + 10) * 24;
          ctx.fillStyle = '#2e6b2a'; ctx.fillRect(fx, fy, 1, 3);
          circle(ctx, fx + 0.5, fy, 1.8, cols[Math.floor(h(i + 20) * cols.length)]);
        }
        break;
      }
      case O.MUSHROOM:
        for (let i = 0; i < 2; i++) {
          const fx = px + 6 + h(i) * 18, fy = py + 10 + h(i + 5) * 14;
          ctx.fillStyle = '#f5eef8'; ctx.fillRect(fx - 1, fy, 2, 4);
          ellipse(ctx, fx, fy, 4, 2.5, h(i + 9) < 0.5 ? '#c0392b' : '#a569bd');
          circle(ctx, fx - 1.5, fy - 0.5, 0.7, '#fff');
        }
        break;
      case O.RUBBLE:
        for (let i = 0; i < 4; i++) {
          const fx = px + 4 + h(i) * 24, fy = py + 4 + h(i + 10) * 24;
          ellipse(ctx, fx, fy, 2.5 + h(i + 3) * 2, 1.8 + h(i + 4), shade('#7f7a72', (h(i + 6) - 0.5) * 0.4));
        }
        break;
      case O.BONES:
        ctx.strokeStyle = '#e5e1d8'; ctx.lineWidth = 2; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(px + 8, py + 20); ctx.lineTo(px + 20, py + 14); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(px + 14, py + 24); ctx.lineTo(px + 24, py + 22); ctx.stroke();
        circle(ctx, px + 22, py + 10, 3.5, '#e5e1d8');
        ctx.fillStyle = '#333'; ctx.fillRect(px + 20.5, py + 9, 1.2, 1.2); ctx.fillRect(px + 22.5, py + 9, 1.2, 1.2);
        break;
      case O.WEB:
        ctx.strokeStyle = 'rgba(230,230,230,0.55)'; ctx.lineWidth = 0.8;
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          ctx.beginPath(); ctx.moveTo(px + 16, py + 16); ctx.lineTo(px + 16 + Math.cos(a) * 15, py + 16 + Math.sin(a) * 15); ctx.stroke();
        }
        for (let r = 4; r < 15; r += 4) { ctx.beginPath(); ctx.arc(px + 16, py + 16, r, 0, Math.PI * 2); ctx.stroke(); }
        break;
      case O.REEDS:
        ctx.strokeStyle = '#5d7d2a'; ctx.lineWidth = 1.5;
        for (let i = 0; i < 6; i++) {
          const fx = px + 4 + h(i) * 24, fy = py + 26;
          ctx.beginPath(); ctx.moveTo(fx, fy); ctx.quadraticCurveTo(fx + (h(i + 3) - 0.5) * 6, fy - 10, fx + (h(i + 5) - 0.5) * 8, fy - 18 - h(i + 8) * 6); ctx.stroke();
          if (i % 2) { ctx.fillStyle = '#6e4b2a'; ctx.fillRect(fx + (h(i + 5) - 0.5) * 8 - 1, fy - 22 - h(i + 8) * 6, 2.5, 6); }
        }
        break;
      default: break;
    }
  }

  drawGround(ctx, camX, camY, viewW, viewH, k) {
    // camX/camY: canto superior esquerdo em pixels de mundo
    const cpx = CHUNK * TILE;
    const c0 = Math.floor(camX / cpx), c1 = Math.floor((camX + viewW) / cpx);
    const r0 = Math.floor(camY / cpx), r1 = Math.floor((camY + viewH) / cpx);
    const maxC = Math.ceil(this.map.w / CHUNK) - 1, maxR = Math.ceil(this.map.h / CHUNK) - 1;
    for (let cy = r0; cy <= r1; cy++) {
      for (let cx = c0; cx <= c1; cx++) {
        if (cx < 0 || cy < 0 || cx > maxC || cy > maxR) continue;
        const cv = this.getChunk(cx, cy);
        ctx.drawImage(cv, cx * cpx, cy * cpx, cpx, cpx);
      }
    }
  }

  // Brilho animado sobre água e lava visíveis.
  drawLiquidAnim(ctx, x0, y0, x1, y1, t) {
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const tt = this.tile(x, y);
        if (tt === T.WATER || tt === T.DEEP) {
          const h = hash2(x, y, 7);
          const a = (Math.sin(t * 1.5 + h * 12) + 1) * 0.07;
          ctx.fillStyle = `rgba(255,255,255,${a})`;
          ctx.fillRect(x * TILE + h * 20, y * TILE + 8 + Math.sin(t + h * 6) * 3, 10, 1.5);
        } else if (tt === T.LAVA) {
          const h = hash2(x, y, 8);
          const a = (Math.sin(t * 2 + h * 10) + 1) * 0.15;
          ctx.fillStyle = `rgba(255,230,120,${a})`;
          ctx.beginPath(); ctx.arc(x * TILE + 8 + h * 16, y * TILE + 8 + hash2(x, y, 9) * 16, 3 + a * 6, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
  }

  // ---------------------------------------------------------------- objetos altos
  objectSprite(o, v, X, Y) {
    // sprites estáticos em cache (sem animação)
    const key = o + ':' + Math.floor(v * 4) + (o === O.FENCE ? ':' + this.fenceMask(X, Y) : '');
    let c = this.objCache.get(key);
    if (c) return c;
    const k = this.scale;
    const W = 96, H = 128; // área do sprite em px de mundo, âncora em (48, 112)
    const cv = document.createElement('canvas');
    cv.width = Math.ceil(W * k); cv.height = Math.ceil(H * k);
    const ctx = cv.getContext('2d');
    ctx.scale(k, k);
    ctx.translate(48, 112);
    drawStaticObject(ctx, o, Math.floor(v * 4) / 4, this.fenceMask(X, Y));
    c = { cv, W, H };
    this.objCache.set(key, c);
    return c;
  }

  fenceMask(X, Y) {
    let m = 0;
    if (this.obj(X - 1, Y) === O.FENCE) m |= 1;
    if (this.obj(X + 1, Y) === O.FENCE) m |= 2;
    if (this.obj(X, Y - 1) === O.FENCE) m |= 4;
    if (this.obj(X, Y + 1) === O.FENCE) m |= 8;
    return m;
  }

  drawObject(ctx, ob, t) {
    const px = ob.x * TILE + 16, py = ob.y * TILE + 26;
    if (ob.o === O.FOUNTAIN) { drawFountain(ctx, ob.x * TILE + 48, ob.y * TILE + 88, t); return; }
    const s = this.objectSprite(ob.o, ob.v, ob.x, ob.y);
    ctx.drawImage(s.cv, px - 48, py - 112, s.W, s.H);
    // partes animadas
    switch (ob.o) {
      case O.TORCH: flame(ctx, px, py - 26, 1, t + ob.v * 10); break;
      case O.LAMP: lampGlow(ctx, px, py - 34, t + ob.v * 5); break;
      case O.BRAZIER: flame(ctx, px, py - 14, 1.6, t + ob.v * 10); break;
      case O.CRYSTAL: {
        const a = 0.25 + Math.sin(t * 2 + ob.v * 9) * 0.15;
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        circle(ctx, px, py - 14, 12, `rgba(165,105,189,${a})`);
        ctx.restore();
        break;
      }
      case O.ALTAR: break;
      case O.BANNER: break;
      default: break;
    }
  }

  // ---------------------------------------------------------------- construções
  structureSprite(st) {
    const key = st.x + ',' + st.y;
    let c = this.structCache.get(key);
    if (c) return c;
    const k = this.scale;
    const W = st.w * TILE + 16, H = st.h * TILE + 40;
    const cv = document.createElement('canvas');
    cv.width = Math.ceil(W * k); cv.height = Math.ceil(H * k);
    const ctx = cv.getContext('2d');
    ctx.scale(k, k);
    ctx.translate(8, 32);
    drawBuilding(ctx, st);
    c = { cv, W, H };
    this.structCache.set(key, c);
    return c;
  }

  drawStructure(ctx, st) {
    const s = this.structureSprite(st);
    ctx.drawImage(s.cv, st.x * TILE - 8, st.y * TILE - 32, s.W, s.H);
  }
}

// ------------------------------------------------------------------ desenhos estáticos de objetos
function drawStaticObject(ctx, o, v, fence) {
  switch (o) {
    case O.TREE: {
      shadow(ctx, 0, 0, 16, 6, 0.3);
      ctx.fillStyle = '#5d4037'; ctx.fillRect(-3, -18, 6, 18);
      ctx.fillStyle = '#4e342e'; ctx.fillRect(-3, -18, 2, 18);
      const base = ['#2e7d32', '#388e3c', '#33691e', '#2e6b2a'][Math.floor(v * 4) % 4];
      const blobs = [[0, -34, 14], [-10, -28, 10], [10, -28, 10], [-6, -42, 10], [7, -42, 9], [0, -48, 8]];
      for (const [x, y, r] of blobs) circle(ctx, x, y + 2, r, shade(base, -0.3));
      for (const [x, y, r] of blobs) circle(ctx, x, y, r, base);
      for (const [x, y, r] of blobs.slice(3)) circle(ctx, x - 2, y - 2, r * 0.6, shade(base, 0.15));
      if (v > 0.6) { circle(ctx, -6, -30, 1.6, '#e74c3c'); circle(ctx, 5, -38, 1.6, '#e74c3c'); circle(ctx, 8, -27, 1.6, '#e74c3c'); }
      break;
    }
    case O.BIGTREE: {
      shadow(ctx, 0, 0, 22, 8, 0.3);
      ctx.fillStyle = '#4e342e'; ctx.fillRect(-5, -26, 10, 26);
      ctx.fillStyle = '#3e2723'; ctx.beginPath(); ctx.moveTo(-5, 0); ctx.lineTo(-11, 2); ctx.lineTo(-5, -6); ctx.fill(); ctx.beginPath(); ctx.moveTo(5, 0); ctx.lineTo(11, 2); ctx.lineTo(5, -6); ctx.fill();
      const base = '#1e5631';
      const blobs = [[0, -46, 20], [-16, -38, 14], [16, -38, 14], [-10, -60, 14], [10, -60, 13], [0, -70, 11]];
      for (const [x, y, r] of blobs) circle(ctx, x, y + 3, r, shade(base, -0.35));
      for (const [x, y, r] of blobs) circle(ctx, x, y, r, base);
      for (const [x, y, r] of blobs.slice(2)) circle(ctx, x - 3, y - 3, r * 0.55, shade(base, 0.18));
      break;
    }
    case O.PINE: {
      shadow(ctx, 0, 0, 13, 5, 0.3);
      ctx.fillStyle = '#4e342e'; ctx.fillRect(-2.5, -12, 5, 12);
      const base = v > 0.5 ? '#1b5e20' : '#245e2b';
      for (let i = 0; i < 4; i++) {
        const y = -10 - i * 11, w = 15 - i * 3;
        ctx.fillStyle = shade(base, -0.25);
        ctx.beginPath(); ctx.moveTo(-w, y + 2); ctx.lineTo(0, y - 16); ctx.lineTo(w, y + 2); ctx.closePath(); ctx.fill();
        ctx.fillStyle = base;
        ctx.beginPath(); ctx.moveTo(-w + 2, y); ctx.lineTo(0, y - 16); ctx.lineTo(w - 4, y); ctx.closePath(); ctx.fill();
      }
      break;
    }
    case O.DEADTREE: {
      shadow(ctx, 0, 0, 10, 4, 0.25);
      ctx.strokeStyle = '#4a3f3a'; ctx.lineCap = 'round';
      ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(1, -28); ctx.stroke();
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(1, -18); ctx.lineTo(-10, -30); ctx.lineTo(-13, -38); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(1, -24); ctx.lineTo(10, -34); ctx.lineTo(15, -36); ctx.stroke();
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(1, -28); ctx.lineTo(-2, -42); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-10, -30); ctx.lineTo(-4, -36); ctx.stroke();
      break;
    }
    case O.ROCK: {
      shadow(ctx, 0, 0, 13, 5, 0.3);
      const c = v > 0.5 ? '#8a8a8a' : '#7d7568';
      ctx.fillStyle = shade(c, -0.25);
      ctx.beginPath(); ctx.moveTo(-13, 0); ctx.lineTo(-11, -12); ctx.lineTo(-3, -18); ctx.lineTo(8, -16); ctx.lineTo(13, -6); ctx.lineTo(12, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.moveTo(-11, -12); ctx.lineTo(-3, -18); ctx.lineTo(8, -16); ctx.lineTo(4, -8); ctx.lineTo(-8, -6); ctx.closePath(); ctx.fill();
      ctx.fillStyle = shade(c, 0.25); ctx.fillRect(-4, -15, 6, 2);
      if (v > 0.7) { ctx.fillStyle = '#558b2f'; ellipse(ctx, -6, -11, 4, 2, '#558b2f'); }
      break;
    }
    case O.BUSH: {
      shadow(ctx, 0, 0, 12, 4, 0.25);
      const c = v > 0.5 ? '#3d8b37' : '#2f7a3a';
      for (const [x, y, r] of [[-6, -7, 7], [6, -7, 7], [0, -12, 8]]) circle(ctx, x, y + 1.5, r, shade(c, -0.3));
      for (const [x, y, r] of [[-6, -7, 7], [6, -7, 7], [0, -12, 8]]) circle(ctx, x, y, r, c);
      circle(ctx, -2, -14, 3, shade(c, 0.2));
      if (v > 0.75) { circle(ctx, -5, -9, 1.5, '#f1c40f'); circle(ctx, 4, -12, 1.5, '#f1c40f'); }
      break;
    }
    case O.CRYSTAL: {
      shadow(ctx, 0, 0, 10, 4, 0.3);
      const c = '#a569bd';
      ctx.fillStyle = shade(c, -0.2);
      ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(-10, -14); ctx.lineTo(-5, -22); ctx.lineTo(-2, -10); ctx.lineTo(-2, 0); ctx.fill();
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.moveTo(-3, 0); ctx.lineTo(-3, -20); ctx.lineTo(2, -30); ctx.lineTo(6, -20); ctx.lineTo(5, 0); ctx.fill();
      ctx.fillStyle = shade(c, 0.3);
      ctx.beginPath(); ctx.moveTo(4, 0); ctx.lineTo(7, -12); ctx.lineTo(11, -15); ctx.lineTo(10, 0); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(0, -24, 1.5, 14);
      break;
    }
    case O.STALAG: {
      shadow(ctx, 0, 0, 9, 3.5, 0.3);
      ctx.fillStyle = '#5a514a';
      ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(-2, -28 - v * 8); ctx.lineTo(3, -20); ctx.lineTo(9, 0); ctx.fill();
      ctx.fillStyle = '#6d6259';
      ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(-2, -28 - v * 8); ctx.lineTo(-2, 0); ctx.fill();
      break;
    }
    case O.PILLAR: {
      shadow(ctx, 0, 0, 11, 4, 0.3);
      ctx.fillStyle = '#b0a899'; ctx.fillRect(-8, -6, 16, 6);
      ctx.fillStyle = '#c8c0b0'; ctx.fillRect(-6, -50, 12, 44);
      ctx.fillStyle = '#a69e8f'; for (let i = -4; i <= 4; i += 4) ctx.fillRect(i - 0.5, -48, 1.2, 40);
      ctx.fillStyle = '#b0a899'; ctx.fillRect(-9, -56, 18, 7);
      break;
    }
    case O.BROKENPILLAR: {
      shadow(ctx, 0, 0, 11, 4, 0.3);
      ctx.fillStyle = '#9d9585'; ctx.fillRect(-8, -6, 16, 6);
      ctx.fillStyle = '#b5ad9d';
      ctx.beginPath(); ctx.moveTo(-6, -6); ctx.lineTo(-6, -24 - v * 10); ctx.lineTo(0, -20 - v * 6); ctx.lineTo(6, -28 - v * 8); ctx.lineTo(6, -6); ctx.fill();
      ctx.fillStyle = '#8d8575'; ellipse(ctx, 12, -2, 5, 3, '#8d8575');
      break;
    }
    case O.FENCE: {
      shadow(ctx, 0, 0, 12, 3, 0.15);
      ctx.fillStyle = '#8d6e63';
      ctx.fillRect(-2, -16, 4, 16);
      ctx.fillStyle = '#795548';
      if (fence & 1) { ctx.fillRect(-16, -13, 16, 3); ctx.fillRect(-16, -7, 16, 3); }
      if (fence & 2) { ctx.fillRect(0, -13, 16, 3); ctx.fillRect(0, -7, 16, 3); }
      if (fence & 4) { ctx.fillRect(-1.5, -40, 3, 26); }
      if (!(fence & 3) && !(fence & 12)) { ctx.fillRect(-8, -12, 16, 3); }
      ctx.fillStyle = '#a1887f'; ctx.fillRect(-2, -17, 4, 2);
      break;
    }
    case O.TORCH: {
      ctx.fillStyle = '#4e342e'; ctx.fillRect(-1.5, -26, 3, 26);
      ctx.fillStyle = '#795548'; ctx.fillRect(-3, -28, 6, 4);
      break;
    }
    case O.LAMP: {
      shadow(ctx, 0, 0, 6, 2.5, 0.25);
      ctx.fillStyle = '#2c3e50'; ctx.fillRect(-1.5, -36, 3, 36); ctx.fillRect(-4, -2, 8, 2);
      ctx.fillStyle = '#34495e'; ctx.fillRect(-5, -42, 10, 3); ctx.fillRect(-4, -32, 8, 2);
      ctx.fillStyle = '#f9e79f'; ctx.fillRect(-3.5, -39, 7, 7);
      break;
    }
    case O.WELL: {
      shadow(ctx, 0, 0, 15, 5, 0.3);
      ctx.fillStyle = '#7f8c8d'; ellipse(ctx, 0, -6, 13, 7, '#7f8c8d');
      ctx.fillStyle = '#2c3e50'; ellipse(ctx, 0, -8, 9, 4.5, '#1b2631');
      ctx.fillStyle = '#5d4037'; ctx.fillRect(-12, -34, 3, 28); ctx.fillRect(9, -34, 3, 28);
      ctx.fillStyle = '#8d6e63'; ctx.beginPath(); ctx.moveTo(-16, -32); ctx.lineTo(0, -42); ctx.lineTo(16, -32); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#a1887f'; ctx.fillRect(-9, -26, 18, 2);
      break;
    }
    case O.TENT: {
      shadow(ctx, 0, 0, 22, 6, 0.3);
      const c = ['#c0392b', '#d68910', '#7d6608', '#566573'][Math.floor(v * 4) % 4];
      ctx.fillStyle = shade(c, -0.25);
      ctx.beginPath(); ctx.moveTo(-22, 0); ctx.lineTo(0, -30); ctx.lineTo(22, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.moveTo(-22, 0); ctx.lineTo(0, -30); ctx.lineTo(4, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#1b1b1b'; ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(0, -16); ctx.lineTo(6, 0); ctx.fill();
      ctx.fillStyle = '#5d4037'; ctx.fillRect(-1, -34, 2, 6);
      break;
    }
    case O.SIGN: {
      shadow(ctx, 0, 0, 7, 3, 0.25);
      ctx.fillStyle = '#5d4037'; ctx.fillRect(-1.5, -24, 3, 24);
      ctx.fillStyle = '#8d6e63'; rr(ctx, -12, -28, 24, 11, 2); ctx.fill();
      ctx.fillStyle = '#4e342e'; ctx.fillRect(-8, -24, 16, 1.5); ctx.fillRect(-8, -21, 11, 1.5);
      break;
    }
    case O.BARREL: {
      shadow(ctx, 0, 0, 9, 3.5, 0.3);
      ctx.fillStyle = '#7b4a2a'; rr(ctx, -8, -20, 16, 20, 5); ctx.fill();
      ctx.fillStyle = '#5d3a1e'; ctx.fillRect(-8, -16, 16, 2); ctx.fillRect(-8, -6, 16, 2);
      ellipse(ctx, 0, -20, 8, 3, '#8d5a34');
      break;
    }
    case O.CRATE: {
      shadow(ctx, 0, 0, 10, 3.5, 0.3);
      ctx.fillStyle = '#a0784a'; ctx.fillRect(-10, -18, 20, 18);
      ctx.strokeStyle = '#6e4b2a'; ctx.lineWidth = 2; ctx.strokeRect(-9, -17, 18, 16);
      ctx.beginPath(); ctx.moveTo(-9, -17); ctx.lineTo(9, -1); ctx.stroke();
      ctx.fillStyle = '#b8905e'; ctx.fillRect(-10, -20, 20, 3);
      break;
    }
    case O.GRAVE: {
      shadow(ctx, 0, 0, 9, 3, 0.3);
      ctx.fillStyle = '#7f8c8d';
      ctx.beginPath(); ctx.moveTo(-7, 0); ctx.lineTo(-7, -14); ctx.arc(0, -14, 7, Math.PI, 0); ctx.lineTo(7, 0); ctx.fill();
      ctx.fillStyle = '#566573'; ctx.fillRect(-1, -18, 2, 9); ctx.fillRect(-4, -15, 8, 2);
      ctx.fillStyle = '#5d6d4a'; ellipse(ctx, 0, 1, 9, 2.5, '#4a5d3a');
      break;
    }
    case O.STALL: {
      shadow(ctx, 0, 0, 18, 5, 0.3);
      ctx.fillStyle = '#8d6e63'; ctx.fillRect(-16, -14, 32, 14);
      ctx.fillStyle = '#5d4037'; ctx.fillRect(-16, -36, 3, 24); ctx.fillRect(13, -36, 3, 24);
      for (let i = 0; i < 6; i++) { ctx.fillStyle = i % 2 ? '#ecf0f1' : '#c0392b'; ctx.fillRect(-18 + i * 6, -40, 6, 8); }
      for (let i = 0; i < 4; i++) circle(ctx, -10 + i * 7, -16, 3, ['#e74c3c', '#f39c12', '#27ae60', '#8e44ad'][i]);
      break;
    }
    case O.BANNER: {
      shadow(ctx, 0, 0, 6, 2.5, 0.25);
      ctx.fillStyle = '#5d4037'; ctx.fillRect(-1.5, -46, 3, 46);
      ctx.fillStyle = v > 0.5 ? '#922b21' : '#1f3a93';
      ctx.beginPath(); ctx.moveTo(1.5, -44); ctx.lineTo(16, -44); ctx.lineTo(16, -22); ctx.lineTo(9, -26); ctx.lineTo(1.5, -22); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#f4d03f'; circle(ctx, 9, -36, 3, '#f4d03f');
      break;
    }
    case O.CART: {
      shadow(ctx, 0, 0, 16, 5, 0.3);
      ctx.fillStyle = '#6e4b2a'; ctx.fillRect(-15, -18, 30, 11);
      ctx.fillStyle = '#8d6e63'; ctx.fillRect(-15, -20, 30, 3);
      ctx.fillStyle = '#4e342e'; circle(ctx, -9, -5, 5, '#3e2723'); circle(ctx, 9, -5, 5, '#3e2723');
      ctx.fillStyle = '#8d8d8d'; circle(ctx, -9, -5, 1.5, '#888'); circle(ctx, 9, -5, 1.5, '#888');
      ctx.fillStyle = '#34495e'; for (let i = 0; i < 4; i++) ellipse(ctx, -9 + i * 6, -21, 4, 3, i % 2 ? '#2c3e50' : '#4d5d6e');
      break;
    }
    case O.ORE: {
      shadow(ctx, 0, 0, 12, 4, 0.3);
      ctx.fillStyle = '#4d4540';
      ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(-9, -14); ctx.lineTo(2, -18); ctx.lineTo(12, -9); ctx.lineTo(11, 0); ctx.closePath(); ctx.fill();
      for (const [x, y] of [[-5, -10], [3, -12], [6, -5], [-2, -5]]) { ctx.fillStyle = '#c9a227'; ctx.fillRect(x, y, 3, 2); }
      break;
    }
    case O.BRAZIER: {
      shadow(ctx, 0, 0, 9, 3.5, 0.3);
      ctx.fillStyle = '#4d4d4d'; ctx.fillRect(-2, -10, 4, 10); ctx.fillRect(-7, -1, 14, 2);
      ctx.fillStyle = '#5d5d5d'; ctx.beginPath(); ctx.moveTo(-10, -14); ctx.lineTo(10, -14); ctx.lineTo(6, -8); ctx.lineTo(-6, -8); ctx.closePath(); ctx.fill();
      break;
    }
    case O.HAY: {
      shadow(ctx, 0, 0, 13, 4, 0.25);
      ctx.fillStyle = '#d4ac0d'; rr(ctx, -13, -16, 26, 16, 4); ctx.fill();
      ctx.strokeStyle = '#b7950b'; ctx.lineWidth = 1;
      for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(-11 + i * 4, -15); ctx.lineTo(-12 + i * 4, -1); ctx.stroke(); }
      ctx.fillStyle = '#7e5109'; ctx.fillRect(-13, -9, 26, 2);
      break;
    }
    case O.STATUE: {
      shadow(ctx, 0, 0, 14, 5, 0.3);
      ctx.fillStyle = '#95a5a6'; ctx.fillRect(-12, -10, 24, 10);
      ctx.fillStyle = '#aab7b8'; ctx.fillRect(-10, -12, 20, 3);
      ctx.fillStyle = '#bdc3c7';
      ctx.beginPath(); ctx.moveTo(-7, -12); ctx.lineTo(-6, -38); ctx.lineTo(6, -38); ctx.lineTo(7, -12); ctx.fill();
      circle(ctx, 0, -44, 6, '#bdc3c7');
      ctx.fillStyle = '#aab7b8'; ctx.fillRect(7, -52, 2.5, 36);
      ctx.fillStyle = '#ffd54f'; circle(ctx, 8.2, -54, 3, '#f7dc6f');
      break;
    }
    default: break;
  }
}

function flame(ctx, x, y, s, t) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const f = Math.sin(t * 12) * 0.15 + Math.sin(t * 7.3) * 0.1;
  const g = ctx.createRadialGradient(x, y, 1, x, y, 14 * s);
  g.addColorStop(0, 'rgba(255,200,80,0.45)'); g.addColorStop(1, 'rgba(255,120,20,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 14 * s, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ff7b00';
  ctx.beginPath(); ctx.moveTo(x - 4 * s, y + 2); ctx.quadraticCurveTo(x - 3 * s, y - 8 * s * (1 + f), x, y - 12 * s * (1 + f)); ctx.quadraticCurveTo(x + 3 * s, y - 8 * s, x + 4 * s, y + 2); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#ffe066';
  ctx.beginPath(); ctx.moveTo(x - 2 * s, y + 1); ctx.quadraticCurveTo(x - 1 * s, y - 5 * s, x, y - 7 * s * (1 - f)); ctx.quadraticCurveTo(x + 1.5 * s, y - 4 * s, x + 2 * s, y + 1); ctx.closePath(); ctx.fill();
  ctx.restore();
}

function lampGlow(ctx, x, y, t) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const a = 0.25 + Math.sin(t * 3) * 0.04;
  const g = ctx.createRadialGradient(x, y, 1, x, y, 16);
  g.addColorStop(0, `rgba(255,230,140,${a + 0.2})`); g.addColorStop(1, 'rgba(255,200,80,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 16, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawFountain(ctx, x, y, t) {
  shadow(ctx, x, y - 26, 44, 16, 0.25);
  ctx.fillStyle = '#9e9e9e'; ellipse(ctx, x, y - 30, 44, 22, '#8d8d8d');
  ellipse(ctx, x, y - 32, 40, 19, '#a7a7a7');
  ellipse(ctx, x, y - 32, 34, 15, '#3b7fc4');
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  for (let i = 0; i < 4; i++) {
    const r = ((t * 12 + i * 9) % 34);
    ctx.strokeStyle = `rgba(255,255,255,${0.35 * (1 - r / 34)})`;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(x, y - 32, r, r * 0.44, 0, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.fillStyle = '#b0b0b0'; ctx.fillRect(x - 5, y - 62, 10, 30);
  ellipse(ctx, x, y - 62, 14, 5, '#bdbdbd');
  ctx.fillStyle = 'rgba(150,200,255,0.75)';
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + t;
    const ph = (t * 2 + i / 6) % 1;
    const dx = Math.cos(a) * (6 + ph * 16), dy = -64 + ph * 30 - Math.sin(ph * Math.PI) * 14;
    circle(ctx, x + dx, y + dy, 1.8, 'rgba(170,215,255,0.8)');
  }
  ellipse(ctx, x, y - 66, 4, 6 + Math.sin(t * 6), 'rgba(190,225,255,0.7)');
}

// ------------------------------------------------------------------ construções
function drawBuilding(ctx, st) {
  const W = st.w * TILE, H = st.h * TILE;
  const wallH = Math.min(52, H * 0.45);
  const roofH = H - wallH;
  const wallTop = H - wallH;
  const stone = st.kind === 'temple' || st.kind === 'bank';
  // sombra
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(4, H - 4, W, 8);
  // paredes
  const wall = stone ? '#c9c2b4' : '#d7c3a1';
  ctx.fillStyle = wall;
  ctx.fillRect(0, wallTop, W, wallH);
  if (stone) {
    ctx.fillStyle = shade(wall, -0.12);
    for (let y = wallTop + 6; y < H; y += 10) {
      for (let x = ((y / 10) % 2) * 10; x < W; x += 20) ctx.fillRect(x, y, 18, 1.2);
    }
  } else {
    ctx.fillStyle = '#6e4b2a';
    ctx.fillRect(0, wallTop, W, 4);
    for (let x = 0; x <= W; x += 32) ctx.fillRect(Math.min(W - 4, x), wallTop, 4, wallH);
    ctx.fillRect(0, H - 4, W, 4);
    ctx.fillStyle = 'rgba(0,0,0,0.06)';
    ctx.fillRect(0, wallTop + wallH / 2, W, 2);
  }
  // janelas
  const winY = wallTop + 12;
  for (let x = 20; x < W - 30; x += 56) {
    if (Math.abs(x + 9 - W / 2) < 26) continue;
    ctx.fillStyle = '#4e342e'; ctx.fillRect(x - 2, winY - 2, 22, 20);
    ctx.fillStyle = '#f9e79f'; ctx.fillRect(x, winY, 18, 16);
    ctx.fillStyle = '#4e342e'; ctx.fillRect(x + 8, winY, 2, 16); ctx.fillRect(x, winY + 7, 18, 2);
  }
  // porta
  const dw = st.kind === 'temple' ? 26 : 20, dh = Math.min(34, wallH - 8);
  const dx = W / 2 - dw / 2, dy = H - dh;
  ctx.fillStyle = '#3e2723';
  rr(ctx, dx - 3, dy - 3, dw + 6, dh + 3, 3); ctx.fill();
  ctx.fillStyle = '#6d4c41';
  rr(ctx, dx, dy, dw, dh, 3); ctx.fill();
  ctx.fillStyle = '#4e342e'; ctx.fillRect(dx + dw / 2 - 0.75, dy + 2, 1.5, dh - 2);
  circle(ctx, dx + dw - 5, dy + dh / 2, 1.5, '#f4d03f');
  // telhado
  const roof = st.roof || '#8e3b2e';
  const over = 8;
  ctx.fillStyle = shade(roof, -0.35);
  ctx.beginPath();
  ctx.moveTo(-over, wallTop + 4);
  ctx.lineTo(W + over, wallTop + 4);
  ctx.lineTo(W - 6, -24);
  ctx.lineTo(6, -24);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = roof;
  ctx.beginPath();
  ctx.moveTo(-over + 2, wallTop);
  ctx.lineTo(W + over - 2, wallTop);
  ctx.lineTo(W - 8, -22);
  ctx.lineTo(8, -22);
  ctx.closePath(); ctx.fill();
  // telhas
  ctx.strokeStyle = shade(roof, -0.2); ctx.lineWidth = 1.5;
  const rows = Math.floor((wallTop + 22) / 9);
  for (let i = 1; i < rows; i++) {
    const y = -22 + i * 9;
    const f = (y + 22) / (wallTop + 22);
    const xl = 8 - f * (8 + over - 2), xr = W - 8 + f * (8 + over - 2);
    ctx.beginPath(); ctx.moveTo(xl, y); ctx.lineTo(xr, y); ctx.stroke();
  }
  ctx.fillStyle = shade(roof, 0.2);
  ctx.fillRect(8, -24, W - 16, 4);
  // chaminé ou torre
  if (st.kind === 'smithy' || st.kind === 'tavern' || st.kind === 'house') {
    ctx.fillStyle = '#7f6a5c'; ctx.fillRect(W * 0.72, -34, 10, 20);
    ctx.fillStyle = '#5d4e44'; ctx.fillRect(W * 0.72 - 1, -36, 12, 4);
  }
  if (st.kind === 'temple') {
    ctx.fillStyle = '#d5d0c4'; ctx.fillRect(W / 2 - 10, -40, 20, 22);
    ctx.fillStyle = shade(roof, 0.1);
    ctx.beginPath(); ctx.moveTo(W / 2 - 14, -38); ctx.lineTo(W / 2, -58); ctx.lineTo(W / 2 + 14, -38); ctx.fill();
    ctx.fillStyle = '#f4d03f'; circle(ctx, W / 2, -29, 4, '#f7dc6f');
  }
  // placa
  if (st.label) {
    ctx.font = 'bold 9px Georgia, serif';
    const tw = ctx.measureText(st.label).width + 12;
    const sx = W / 2 - tw / 2, sy = wallTop - 6;
    ctx.fillStyle = '#4e342e'; rr(ctx, sx - 1, sy - 1, tw + 2, 14, 3); ctx.fill();
    ctx.fillStyle = '#8d6e63'; rr(ctx, sx, sy, tw, 12, 3); ctx.fill();
    ctx.fillStyle = '#fdf2e9'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(st.label, W / 2, sy + 6.5);
  }
}

export function minimapColor(t, o) {
  if (o === O.BUILDING) return '#7b5e3b';
  if (o && OBJ_INFO[o].block) {
    if (o === O.TREE || o === O.PINE || o === O.BIGTREE || o === O.BUSH) return '#24502a';
    return '#5a5550';
  }
  const map = {
    [T.GRASS]: '#5a9a3e', [T.DARKGRASS]: '#447d33', [T.DIRT]: '#a5835a', [T.SAND]: '#d9c48d', [T.WATER]: '#3b7fc4',
    [T.DEEP]: '#2a5f9e', [T.CAVE]: '#6d635b', [T.CAVEWALL]: '#221e1b', [T.ASH]: '#6b6460', [T.LAVA]: '#e25822',
    [T.BRIDGE]: '#8b6a42', [T.MUD]: '#594a3a', [T.COBBLE]: '#a39e96', [T.RUIN]: '#a99f92', [T.ARENA]: '#c7a46a',
    [T.STONE]: '#8e8e8e', [T.WOOD]: '#8b6a42', [T.VOID]: '#000',
  };
  return map[t] || '#000';
}

export { rgba };
