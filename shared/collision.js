// Colisão com o mapa de tiles. Coordenadas em unidades de tile (float).

export function isBlocked(map, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= map.w || ty >= map.h) return true;
  return map.block[ty * map.w + tx] === 1;
}

// Tile que o A* não atravessa: bloqueado, ou terreno de casa fora da área interna (margem do terreno)
export function isSolid(map, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= map.w || ty >= map.h) return true;
  const i = ty * map.w + tx;
  return map.block[i] === 1 || (map.fp !== undefined && map.fp[i] !== 0 && map.inside[i] === 0);
}

// Retângulos finos (paredes de casas, móveis): guardados por tile em map.rt. Contra eles o corpo é menor
// que o quadrado da colisão com tiles, para a porta não ficar apertada.
const RECT_R = 0.18;

// Registra um retângulo [x0, y0, x1, y1] (unidades de tile) que bloqueia a passagem.
export function addBlocker(map, x0, y0, x1, y1) {
  if (!map.rt) map.rt = new Map();
  const r = [x0, y0, x1, y1];
  const tx0 = Math.max(0, Math.floor(x0)), tx1 = Math.min(map.w - 1, Math.ceil(x1) - 1);
  const ty0 = Math.max(0, Math.floor(y0)), ty1 = Math.min(map.h - 1, Math.ceil(y1) - 1);
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      const k = ty * map.w + tx;
      const list = map.rt.get(k);
      if (list) list.push(r); else map.rt.set(k, [r]);
    }
  }
}

export function canStand(map, x, y, r = 0.3) {
  const x0 = Math.floor(x - r), x1 = Math.floor(x + r);
  const y0 = Math.floor(y - r), y1 = Math.floor(y + r);
  const rt = map.rt, rr = r < RECT_R ? r : RECT_R;
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (isBlocked(map, tx, ty)) return false;
      const list = rt && rt.get(ty * map.w + tx);
      if (list) for (const b of list) if (x + rr > b[0] && x - rr < b[2] && y + rr > b[1] && y - rr < b[3]) return false;
    }
  }
  return true;
}

// Move com deslizamento nos eixos. Passos pequenos evitam atravessar paredes.
export function moveWithCollision(map, x, y, dx, dy, r = 0.3) {
  const dist = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(dist / 0.2));
  const sx = dx / steps, sy = dy / steps;
  for (let i = 0; i < steps; i++) {
    if (sx !== 0 && canStand(map, x + sx, y, r)) x += sx;
    if (sy !== 0 && canStand(map, x, y + sy, r)) y += sy;
  }
  return { x, y };
}

// Verifica se o segmento entre dois pontos está livre (amostragem).
export function lineClear(map, x0, y0, x1, y1, r = 0) {
  const dist = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.max(1, Math.ceil(dist / 0.25));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
    if (!canStand(map, x, y, r)) return false;
  }
  return true;
}

// Encontra o ponto livre mais próximo (busca em espiral); só entra numa casa quem já estava nela.
export function nearestFree(map, x, y, r = 0.3, maxRadius = 8) {
  if (canStand(map, x, y, r)) return { x, y };
  const cx = Math.floor(x), cy = Math.floor(y);
  const room = (px, py) => (map.inside ? map.inside[Math.floor(py) * map.w + Math.floor(px)] || 0 : 0);
  const mine = map.inside && x >= 0 && y >= 0 && x < map.w && y < map.h ? room(x, y) : 0;
  for (let rad = 1; rad <= maxRadius; rad++) {
    for (let dy = -rad; dy <= rad; dy++) {
      for (let dx = -rad; dx <= rad; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== rad) continue;
        const px = cx + dx + 0.5, py = cy + dy + 0.5;
        if (px >= 0 && py >= 0 && px < map.w && py < map.h && room(px, py) !== mine) continue;
        if (canStand(map, px, py, r)) return { x: px, y: py };
      }
    }
  }
  return { x, y };
}

// Dash: avança na direção até bater em algo; retorna posição final.
export function castRay(map, x, y, dirX, dirY, maxDist, r = 0.3) {
  const len = Math.hypot(dirX, dirY) || 1;
  const ux = dirX / len, uy = dirY / len;
  let cx = x, cy = y;
  const step = 0.2;
  for (let d = step; d <= maxDist + 1e-6; d += step) {
    const nx = x + ux * d, ny = y + uy * d;
    if (!canStand(map, nx, ny, r)) break;
    cx = nx; cy = ny;
  }
  return { x: cx, y: cy };
}
