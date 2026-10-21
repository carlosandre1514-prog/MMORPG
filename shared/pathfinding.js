// A* em grade com 8 direções (sem cortar quinas).
import { isBlocked, lineClear } from './collision.js';

class MinHeap {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  push(node, f) {
    const a = this.a;
    a.push([f, node]);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p][0] <= a[i][0]) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop() {
    const a = this.a;
    const top = a[0];
    const last = a.pop();
    if (a.length > 0) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top[1];
  }
}

const NEIGH = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, 1.4142], [1, -1, 1.4142], [-1, 1, 1.4142], [-1, -1, 1.4142],
];

// Retorna lista de pontos (centros de tiles) do início ao destino, ou null.
export function findPath(map, sx, sy, gx, gy, maxNodes = 4000) {
  const w = map.w;
  const startX = Math.floor(sx), startY = Math.floor(sy);
  let goalX = Math.floor(gx), goalY = Math.floor(gy);
  if (isBlocked(map, goalX, goalY)) {
    // procura tile livre adjacente ao destino
    let found = false;
    for (let r = 1; r <= 2 && !found; r++) {
      for (let dy = -r; dy <= r && !found; dy++) {
        for (let dx = -r; dx <= r && !found; dx++) {
          if (!isBlocked(map, goalX + dx, goalY + dy)) { goalX += dx; goalY += dy; found = true; }
        }
      }
    }
    if (!found) return null;
  }
  if (startX === goalX && startY === goalY) return [{ x: gx, y: gy }];
  const startK = startY * w + startX, goalK = goalY * w + goalX;
  const g = new Map([[startK, 0]]);
  const came = new Map();
  const closed = new Set();
  const open = new MinHeap();
  const hfn = (x, y) => {
    const dx = Math.abs(x - goalX), dy = Math.abs(y - goalY);
    return Math.max(dx, dy) + 0.4142 * Math.min(dx, dy);
  };
  open.push(startK, hfn(startX, startY));
  let expanded = 0;
  let bestK = startK, bestH = Infinity;
  while (open.size) {
    const k = open.pop();
    if (closed.has(k)) continue;
    closed.add(k);
    if (k === goalK) { bestK = k; break; }
    const x = k % w, y = (k - x) / w;
    const h = hfn(x, y);
    if (h < bestH) { bestH = h; bestK = k; }
    if (++expanded > maxNodes) break;
    const gk = g.get(k);
    for (const [dx, dy, cost] of NEIGH) {
      const nx = x + dx, ny = y + dy;
      if (isBlocked(map, nx, ny)) continue;
      if (dx !== 0 && dy !== 0 && (isBlocked(map, x + dx, y) || isBlocked(map, x, y + dy))) continue;
      const nk = ny * w + nx;
      if (closed.has(nk)) continue;
      const ng = gk + cost;
      if (ng < (g.get(nk) ?? Infinity)) {
        g.set(nk, ng);
        came.set(nk, k);
        open.push(nk, ng + hfn(nx, ny));
      }
    }
  }
  if (bestK === startK) return null;
  const path = [];
  let k = bestK;
  while (k !== startK) {
    const x = k % w, y = (k - x) / w;
    path.push({ x: x + 0.5, y: y + 0.5 });
    k = came.get(k);
  }
  path.reverse();
  if (bestK === goalK && path.length) path[path.length - 1] = { x: gx, y: gy };
  return smoothPath(map, sx, sy, path);
}

// Remove pontos intermediários quando há linha livre.
export function smoothPath(map, sx, sy, path) {
  if (path.length < 3) return path;
  const out = [];
  let cx = sx, cy = sy, i = 0;
  while (i < path.length) {
    let j = path.length - 1;
    while (j > i && !lineClear(map, cx, cy, path[j].x, path[j].y, 0.32)) j--;
    out.push(path[j]);
    cx = path[j].x; cy = path[j].y;
    i = j + 1;
  }
  return out;
}
