// Mundo em estrela: Alvorada no centro com portões para todas as regiões, coordenadas do mapa-múndi, cripta selada e regiões novas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Database } from '../server/db.js';
import { World } from '../server/world.js';
import { ZONES, ZONE_ORDER, portalSealed, dangerWarning } from '../shared/data/zones.js';
import { KINGDOMS } from '../shared/data/kingdoms.js';
import { MONSTERS } from '../shared/data/monsters.js';
import { NPCS } from '../shared/data/npcs.js';
import { generateMap } from '../shared/mapgen.js';
import { T } from '../shared/tiles.js';
import { MAX_LEVEL } from '../shared/constants.js';

const read = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');

function boot() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aethra-world-'));
  const world = new World(new Database(dir), { quiet: true });
  const sent = [];
  const ch = world.newCharacter('Viajante', 'warrior', 0, 0);
  const p = world.enterWorld({ send: (m) => sent.push(m) }, ch);
  return { world, p, ch, sent, done: () => { world.stop(); fs.rmSync(dir, { recursive: true, force: true }); } };
}

// as regiões a que se chega por portais, a partir de uma
function reach(from) {
  const seen = new Set([from]);
  const q = [from];
  while (q.length) for (const p of ZONES[q.shift()].portals) if (!seen.has(p.to)) { seen.add(p.to); q.push(p.to); }
  return seen;
}

test('Alvorada é o centro: cada portão leva a uma região diferente e todas as regiões do reino são alcançáveis', () => {
  const exits = ZONES.town.portals.map((p) => p.to).sort();
  assert.deepEqual(exits, ['arena', 'fields', 'peaks', 'swamp', 'undercroft']);
  // os quatro portões ficam um em cada lado da muralha
  const side = (p) => (p.x === 0 ? 'oeste' : p.y === 0 ? 'norte' : p.x >= ZONES.town.w - 3 ? 'leste' : p.y >= ZONES.town.h - 3 ? 'sul' : 'dentro');
  const sides = ZONES.town.portals.filter((p) => p.to !== 'undercroft').map(side).sort();
  assert.deepEqual(sides, ['leste', 'norte', 'oeste', 'sul']);
  const all = reach('town');
  for (const id of ZONE_ORDER) assert.ok(all.has(id), `${id} não é alcançável a partir da capital`);
  // as regiões novas pertencem ao reino de Alvorada
  for (const id of ['swamp', 'catacombs', 'peaks', 'citadel', 'undercroft']) assert.ok(KINGDOMS.alvorada.zones.includes(id) && ZONES[id].kingdom === 'alvorada', id);
  // toda ligação tem volta
  for (const z of Object.values(ZONES)) for (const p of z.portals) assert.ok(ZONES[p.to].portals.some((q) => q.to === z.id), `${p.to} volta para ${z.id}`);
});

test('mapa-múndi: toda região tem posição, sem sobreposição, e regiões ligadas por portão ficam encostadas', () => {
  const list = Object.values(ZONES);
  for (const z of list) assert.ok(z.world && Number.isFinite(z.world.x) && Number.isFinite(z.world.y), `${z.id} sem posição`);
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const a = list[i], b = list[j];
    const overlap = a.world.x < b.world.x + b.w && b.world.x < a.world.x + a.w && a.world.y < b.world.y + b.h && b.world.y < a.world.y + a.h;
    assert.ok(!overlap, `${a.id} e ${b.id} se sobrepõem no mapa-múndi`);
  }
  // as pontas dos portões de duas regiões vizinhas ficam a poucos tiles uma da outra (a cripta e a Estrada do Sol são ligações desenhadas)
  const loose = new Set(['town>undercroft', 'undercroft>town', 'ruins>dunes', 'dunes>ruins', 'town>arena', 'arena>town']);
  const c = (z, p) => ({ x: z.world.x + p.x + p.w / 2, y: z.world.y + p.y + p.h / 2 });
  for (const z of list) for (const p of z.portals) {
    if (loose.has(`${z.id}>${p.to}`)) continue;
    const to = ZONES[p.to], back = to.portals.find((q) => q.to === z.id);
    const A = c(z, p), B = c(to, back);
    assert.ok(Math.hypot(A.x - B.x, A.y - B.y) <= 14, `${z.id} -> ${p.to}: portões a ${Math.hypot(A.x - B.x, A.y - B.y).toFixed(1)} tiles no mapa-múndi`);
  }
});

test('regiões novas: níveis, chefes, climas e terrenos próprios', () => {
  const boss = { swamp: 'nhaga', catacombs: 'valdric', peaks: 'vargnar', citadel: 'kaelisa', undercroft: 'nyxthar' };
  for (const [zid, bid] of Object.entries(boss)) {
    const z = ZONES[zid];
    assert.ok(z.spawns.some((s) => s.m === bid && s.n === 1), `${zid} tem o chefe ${bid}`);
    for (const s of z.spawns) assert.ok(MONSTERS[s.m], `${zid}: ${s.m}`);
    assert.ok(z.lvl && z.lvl[0] <= z.lvl[1] && z.lvl[1] <= MAX_LEVEL, `${zid} níveis`);
    const mlv = z.spawns.map((s) => MONSTERS[s.m].lvl[0]);
    assert.ok(Math.min(...mlv) >= z.lvl[0] - 1 && Math.max(...mlv) <= z.lvl[1] + 1, `${zid}: monstros dentro da faixa ${z.lvl}`);
    assert.ok(Object.values(NPCS).some((n) => n.zone === zid && n.services.includes('teleport')), `${zid} tem Pedra do Caminho`);
  }
  // picos e cidadela são de neve e gelo; o pântano é de lama
  const count = (id, t) => { const m = generateMap(ZONES[id]); return m.tiles.filter((x) => x === t).length; };
  assert.ok(count('peaks', T.SNOW) > 2000 && count('peaks', T.ICE) > 100);
  assert.ok(count('citadel', T.ICE) > 1500);
  assert.ok(count('swamp', T.MUD) > 1500);
  assert.ok(ZONES.peaks.snow && ZONES.citadel.snow && ZONES.swamp.fog);
});

test('cripta selada: o portal só deixa passar quem abriu o selo e o aviso de perigo vale só longe do nível da região', () => {
  const crypt = ZONES.town.portals.find((p) => p.to === 'undercroft');
  assert.ok(portalSealed({ flags: {} }, crypt));
  assert.equal(portalSealed({ flags: { cripta_aberta: true } }, crypt), null);
  assert.equal(portalSealed({ flags: {} }, ZONES.town.portals[0]), null);
  assert.ok(dangerWarning('citadel', 10));
  assert.equal(dangerWarning('citadel', 80), null);
  assert.equal(dangerWarning('town', 1), null);
  assert.equal(dangerWarning('fields', 1), null);

  const { world, p, ch, sent, done } = boot();
  const walkInto = () => {
    p.x = crypt.x + crypt.w / 2; p.y = crypt.y - 0.1; p.portalLock = 0; p.lastMoveAt = Date.now() - 1000;
    world.handle(p, { t: 'mv', x: crypt.x + crypt.w / 2, y: crypt.y + 0.3, s: p.posSeq, d: 0 });
  };
  walkInto();
  assert.equal(p.zone.id, 'town', 'selada: não atravessa');
  assert.ok(sent.some((m) => m.t === 'msg' && m.k === 'err' && /selo/.test(m.m)));
  ch.flags.cripta_aberta = true;
  p.zone.id === 'town' && walkInto();
  assert.equal(p.zone.id, 'undercroft', 'aberta: atravessa');
  done();
});

test('o portão norte e o portão oeste de Alvorada têm torres, rua e estrutura de portão', () => {
  const m = generateMap(ZONES.town);
  const gates = new Set(m.structures.filter((s) => s.kind === 'gate').map((s) => s.dir));
  assert.deepEqual([...gates].sort(), ['e', 'n', 's', 'w']);
  for (const [zid, to] of [['peaks', 'town'], ['swamp', 'town']]) assert.ok(ZONES[zid].portals.some((p) => p.to === to));
});

test('mapa-múndi no cliente: abas, miniaturas, névoa e destino da missão', () => {
  const win = read('client/js/ui/windows.js'), wm = read('client/js/ui/worldmap.js'), ui = read('client/js/ui/ui.js');
  assert.match(win, /renderMapWorld\(pane\)/);
  assert.match(win, /\['world', 'Mundo'\], \['local', 'Região'\]/);
  assert.match(win, /drawWorldMap\(\) \{\s*if \(this\.mapTab === 'world'\) this\.drawGlobalMap\(\)/);
  assert.match(ui, /worldMapMixin/);
  assert.match(wm, /generateMap\(z\)/);
  assert.match(wm, /portalSealed\(g\.me, p\)/);
  assert.match(wm, /g\.guide/);
  assert.match(wm, /compass\(/);
  const eng = read('client/js/three/engine.js');
  for (const id of ['swamp', 'catacombs', 'peaks', 'citadel', 'undercroft']) assert.match(eng, new RegExp(`${id}: \\{ day:`));
  assert.match(read('client/js/audio.js'), /swamp:.*\n.*crypt:.*\n.*frost:.*\n.*void:/);
});
