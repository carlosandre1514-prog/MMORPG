// Casas visitáveis da capital: entrar pela porta, paredes finas que seguram o jogador, caminhos até dentro e para fora.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ZONES } from '../shared/data/zones.js';
import { generateMap } from '../shared/mapgen.js';
import { buildMap } from '../shared/tiles.js';
import { canStand, moveWithCollision, nearestFree, addBlocker } from '../shared/collision.js';
import { findPath } from '../shared/pathfinding.js';
import { roomAt } from '../shared/housegeom.js';

const m = generateMap(ZONES.town);
const map = buildMap(m.w, m.h, m.tiles, m.objs, m.structures);
const R = 0.28; // um pouco menor que o corpo do jogador no servidor

// Anda em linha reta até (tx, ty) deslizando nas paredes; devolve onde parou
function walk(x, y, tx, ty) {
  for (let i = 0; i < 600; i++) {
    const dx = tx - x, dy = ty - y, d = Math.hypot(dx, dy);
    if (d < 0.08) return { x, y, reached: true };
    const s = Math.min(0.12, d);
    const r = moveWithCollision(map, x, y, dx / d * s, dy / d * s, R);
    if (Math.abs(r.x - x) + Math.abs(r.y - y) < 1e-6) break;
    x = r.x; y = r.y;
  }
  return { x, y, reached: false };
}
const center = (g) => [(g.inner[0] + g.inner[2]) / 2, (g.inner[1] + g.inner[3]) / 2];
const outside = (g, dist) => [g.door[0] - g.inward[0] * dist, g.door[1] - g.inward[1] * dist];

test('todas as construções com porta viram casas visitáveis', () => {
  const doors = map.structures.filter((s) => s.kind === 'house' && !['keeptower', 'belltower', 'market', 'voxel'].includes(s.type));
  assert.equal(map.rooms.length, doors.length);
  assert.ok(map.rooms.length > 100);
});

test('de fora da porta até o centro de cada casa a pé, com colisão', () => {
  for (const g of map.rooms) {
    const [ox, oy] = outside(g, 0.5);
    assert.ok(canStand(map, ox, oy, R), `rua livre na frente de ${g.st.type} ${g.st.x},${g.st.y}`);
    let r = walk(ox, oy, g.door[0], g.door[1]);
    assert.ok(r.reached, `porta de ${g.st.type} ${g.st.x},${g.st.y}`);
    r = walk(r.x, r.y, g.door[0] + g.inward[0], g.door[1] + g.inward[1]);
    const [cx, cy] = center(g);
    r = walk(r.x, r.y, cx, cy);
    assert.ok(r.reached, `sala de ${g.st.type} ${g.st.x},${g.st.y}`);
  }
});

test('as paredes seguram o jogador por dentro e por fora', () => {
  for (const g of map.rooms) {
    const [cx, cy] = center(g);
    // do centro para o fundo (sentido da entrada) e para os lados: nunca passa da linha das paredes
    const dirs = [[g.inward[0], g.inward[1]], [-g.inward[1], g.inward[0]], [g.inward[1], -g.inward[0]]];
    for (const [dx, dy] of dirs) {
      const r = walk(cx, cy, cx + dx * 20, cy + dy * 20);
      const l = g.line;
      assert.ok(r.x > l[0] - 0.4 && r.x < l[2] + 0.4 && r.y > l[1] - 0.4 && r.y < l[3] + 0.4, `vazou ${g.st.type} ${g.st.x},${g.st.y}`);
    }
  }
});

// ponto na rua em frente à fachada, longe da porta (o lado da casa com mais espaço)
function farFromDoor(g) {
  const ax = -g.inward[1], ay = g.inward[0]; // ao longo da fachada
  const [cx, cy] = center(g);
  const lat = (g.door[0] - cx) * ax + (g.door[1] - cy) * ay;
  const half = g.W / 2 - 0.8;
  const off = Math.abs(-half - lat) > Math.abs(half - lat) ? -half : half;
  if (Math.abs(off - lat) < 1.6) return null;
  const base = [g.door[0] + ax * (off - lat), g.door[1] + ay * (off - lat)];
  return { out: [base[0] - g.inward[0] * 0.6, base[1] - g.inward[1] * 0.6], wall: base };
}

test('de fora, andar contra a fachada longe da porta não entra na casa', () => {
  let n = 0;
  for (const g of map.rooms) {
    const p = farFromDoor(g);
    if (!p || !canStand(map, p.out[0], p.out[1], R)) continue;
    const r = walk(p.out[0], p.out[1], p.out[0] + g.inward[0] * 4, p.out[1] + g.inward[1] * 4);
    assert.ok(!roomAt(map, r.x, r.y), `atravessou a fachada de ${g.st.type} ${g.st.x},${g.st.y}`);
    n++;
  }
  assert.ok(n > 60);
});

test('o caminho do A* entra na casa e sai dela pela porta', () => {
  let tried = 0;
  for (const g of map.rooms) {
    const [ox, oy] = outside(g, 2.5);
    if (!canStand(map, ox, oy, R)) continue;
    const [cx, cy] = center(g);
    const inP = findPath(map, ox, oy, cx, cy, 6000);
    assert.ok(inP, `caminho para dentro de ${g.st.type} ${g.st.x},${g.st.y}`);
    let x = ox, y = oy;
    for (const p of inP) { const r = walk(x, y, p.x, p.y); x = r.x; y = r.y; }
    assert.ok(Math.hypot(x - cx, y - cy) < 0.5, `seguiu o caminho até a sala ${g.st.type} ${g.st.x},${g.st.y}`);
    const outP = findPath(map, cx, cy, ox, oy, 6000);
    assert.ok(outP, `caminho para fora de ${g.st.type} ${g.st.x},${g.st.y}`);
    x = cx; y = cy;
    for (const p of outP) { const r = walk(x, y, p.x, p.y); x = r.x; y = r.y; }
    assert.ok(Math.hypot(x - ox, y - oy) < 0.5, `seguiu o caminho até a rua ${g.st.type} ${g.st.x},${g.st.y}`);
    tried++;
  }
  assert.ok(tried > 100);
});

test('caminhos de rua a rua não atravessam casas e o A* nunca passa pela parede', () => {
  const a = findPath(map, 56.5, 40.5, 20.5, 47, 8000);
  assert.ok(a && a.length);
  for (const p of a) assert.ok(!roomAt(map, p.x, p.y), 'ponto do caminho dentro de uma casa');
});

test('quem reaparece junto a uma parede não troca de área (dentro/fora)', () => {
  let n = 0;
  for (const g of map.rooms) {
    const p = farFromDoor(g);
    if (!p) continue;
    const sx = p.wall[0] + g.inward[0] * 0.2, sy = p.wall[1] + g.inward[1] * 0.2;
    const r = nearestFree(map, sx, sy, 0.3);
    // quem começa num tile de dentro pode ser recolocado na mesma casa; os demais ficam sempre do lado de fora
    const mine = map.inside[Math.floor(sy) * map.w + Math.floor(sx)];
    const got = map.inside[Math.floor(r.y) * map.w + Math.floor(r.x)];
    assert.equal(got, mine, `reapareceu em outra área perto de ${g.st.type} ${g.st.x},${g.st.y}`);
    n++;
  }
  assert.ok(n > 60);
});

test('retângulos de colisão extras (móveis) bloqueiam e o resto continua livre', () => {
  const g = map.rooms.find((r) => r.st.type === 'house');
  const [cx, cy] = center(g);
  assert.ok(canStand(map, cx, cy, R));
  addBlocker(map, cx - 0.3, cy - 0.3, cx + 0.3, cy + 0.3);
  assert.ok(!canStand(map, cx, cy, R));
  assert.ok(canStand(map, cx + 1.0, cy, R));
});
