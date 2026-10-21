// Colisão com o mapa de tiles. Coordenadas em unidades de tile (float).

export function isBlocked(map, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= map.w || ty >= map.h) return true;
  return map.block[ty * map.w + tx] === 1;
}

export function canStand(map, x, y, r = 0.3) {
  const x0 = Math.floor(x - r), x1 = Math.floor(x + r);
  const y0 = Math.floor(y - r), y1 = Math.floor(y + r);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (isBlocked(map, tx, ty)) return false;
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
    if (r > 0 ? !canStand(map, x, y, r) : isBlocked(map, Math.floor(x), Math.floor(y))) return false;
  }
  return true;
}

// Encontra o ponto livre mais próximo (busca em espiral).
export function nearestFree(map, x, y, r = 0.3, maxRadius = 8) {
  if (canStand(map, x, y, r)) return { x, y };
  const cx = Math.floor(x), cy = Math.floor(y);
  for (let rad = 1; rad <= maxRadius; rad++) {
    for (let dy = -rad; dy <= rad; dy++) {
      for (let dx = -rad; dx <= rad; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== rad) continue;
        const px = cx + dx + 0.5, py = cy + dy + 0.5;
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
