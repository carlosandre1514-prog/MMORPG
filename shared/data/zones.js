// Zonas do mundo. Coordenadas em tiles. Os mapas externos são gerados
// proceduralmente (shared/mapgen.js) garantindo áreas livres nos pontos de interesse.
import { T, O } from '../tiles.js';
import { KINGDOMS, KINGDOM_ORDER } from './kingdoms.js';

export const ZONES = {
  town: {
    id: 'town', name: 'Cidade de Alvorada', levels: 'Zona Segura', safe: true, w: 112, h: 96,
    gen: { type: 'town', seed: 7 },
    spawn: { x: 56.5, y: 19.5 },
    ambient: '#000000', night: 0.55, music: 'town',
    portals: [
      { x: 110, y: 45, w: 2, h: 4, to: 'fields', tx: 4.5, ty: 45.5, label: 'Campos Verdejantes' },
      { x: 55, y: 94, w: 3, h: 2, to: 'arena', tx: 20.5, ty: 34.5, label: 'Arena de Sangue' },
    ],
    desc: 'A capital murada, último refúgio dos homens à beira da Névoa Cinzenta.',
  },

  fields: {
    id: 'fields', name: 'Campos Verdejantes', levels: 'Níveis 1–7', w: 110, h: 90,
    spawn: { x: 6.5, y: 45.5 },
    night: 0.6, music: 'fields',
    portals: [
      { x: 0, y: 43, w: 2, h: 5, to: 'town', tx: 107.5, ty: 46.5, label: 'Cidade de Alvorada' },
      { x: 108, y: 20, w: 2, h: 5, to: 'forest', tx: 5.5, ty: 50.5, label: 'Floresta Sussurrante' },
    ],
    gen: {
      type: 'outdoor', seed: 1337, base: T.GRASS, alt: T.DARKGRASS, path: T.DIRT,
      border: [O.TREE, O.TREE, O.PINE],
      water: { scale: 0.045, thr: 0.74, sand: true },
      forest: { scale: 0.08, thr: 0.62, objs: [O.TREE, O.TREE, O.BUSH, O.PINE] },
      scatter: [{ o: O.ROCK, p: 0.006 }, { o: O.BUSH, p: 0.008 }],
      decor: [{ o: O.FLOWERS, p: 0.05 }, { o: O.MUSHROOM, p: 0.004 }, { o: O.REEDS, p: 0.0, nearWater: 0.35 }],
      pois: [
        { id: 'w', x: 4, y: 45, r: 5 },
        { id: 'cross', x: 36, y: 45, r: 6 },
        { id: 'slimes', x: 22, y: 26, r: 11 },
        { id: 'slimes2', x: 26, y: 60, r: 7 },
        { id: 'wolves', x: 58, y: 20, r: 10 },
        { id: 'farm', x: 42, y: 72, r: 9 },
        { id: 'cat', x: 16, y: 73, r: 4 },
        { id: 'hermit', x: 76, y: 58, r: 6 },
        { id: 'boss', x: 92, y: 78, r: 8 },
        { id: 'e', x: 105, y: 22, r: 5 },
      ],
      links: [['w', 'cross'], ['cross', 'slimes'], ['cross', 'slimes2'], ['cross', 'wolves'], ['wolves', 'e'],
        ['cross', 'farm'], ['farm', 'cat'], ['cross', 'hermit'], ['hermit', 'boss'], ['hermit', 'e']],
      features: [
        { type: 'farm', x: 39, y: 69, w: 9, h: 7 },
        { type: 'shrine', x: 76, y: 58, r: 4 },
        { type: 'ring', x: 92, y: 78, r: 7, obj: O.ROCK, gap: 'w' },
        { type: 'pond', x: 13, y: 76, r: 3 },
        { type: 'camp', x: 8, y: 43 },
      ],
    },
    spawns: [
      { m: 'slime', n: 16, x: 22, y: 26, r: 11 },
      { m: 'slime_red', n: 8, x: 26, y: 60, r: 7 },
      { m: 'wolf', n: 14, x: 58, y: 21, r: 11 },
      { m: 'boar', n: 12, x: 50, y: 70, r: 11 },
      { m: 'boar_boss', n: 1, x: 92, y: 78, r: 1 },
    ],
  },

  forest: {
    id: 'forest', name: 'Floresta Sussurrante', levels: 'Níveis 6–13', w: 110, h: 100,
    spawn: { x: 6.5, y: 50.5 },
    night: 0.7, tint: 'rgba(20,60,30,0.10)', music: 'forest',
    portals: [
      { x: 0, y: 48, w: 2, h: 5, to: 'fields', tx: 104.5, ty: 22.5, label: 'Campos Verdejantes' },
      { x: 99, y: 0, w: 5, h: 2, to: 'mines', tx: 50.5, ty: 84.5, label: 'Minas de Ferro Negro' },
    ],
    gen: {
      type: 'outdoor', seed: 4242, base: T.DARKGRASS, alt: T.GRASS, path: T.DIRT,
      border: [O.PINE, O.TREE, O.BIGTREE],
      water: { scale: 0.05, thr: 0.78, sand: false },
      forest: { scale: 0.1, thr: 0.52, objs: [O.TREE, O.PINE, O.BIGTREE, O.TREE, O.BUSH] },
      scatter: [{ o: O.ROCK, p: 0.004 }, { o: O.BUSH, p: 0.01 }, { o: O.DEADTREE, p: 0.002 }],
      decor: [{ o: O.MUSHROOM, p: 0.025 }, { o: O.FLOWERS, p: 0.012 }, { o: O.REEDS, p: 0, nearWater: 0.4 }],
      pois: [
        { id: 'w', x: 4, y: 50, r: 5 },
        { id: 'camp', x: 24, y: 50, r: 8 },
        { id: 'gob', x: 54, y: 30, r: 10 },
        { id: 'shaman', x: 75, y: 22, r: 7 },
        { id: 'spider', x: 58, y: 74, r: 10 },
        { id: 'ent', x: 84, y: 54, r: 9 },
        { id: 'queen', x: 89, y: 87, r: 9 },
        { id: 'n', x: 101, y: 4, r: 5 },
      ],
      links: [['w', 'camp'], ['camp', 'gob'], ['gob', 'shaman'], ['shaman', 'n'], ['camp', 'spider'],
        ['spider', 'queen'], ['gob', 'ent'], ['ent', 'queen'], ['ent', 'n']],
      features: [
        { type: 'camp', x: 24, y: 50, tents: true },
        { type: 'gobcamp', x: 54, y: 30 },
        { type: 'webs', x: 58, y: 74, r: 9, n: 30 },
        { type: 'webs', x: 89, y: 87, r: 8, n: 26, bones: true },
      ],
    },
    spawns: [
      { m: 'goblin', n: 14, x: 54, y: 31, r: 10 },
      { m: 'goblin_shaman', n: 7, x: 75, y: 22, r: 7 },
      { m: 'spider', n: 14, x: 58, y: 74, r: 10 },
      { m: 'ent', n: 8, x: 84, y: 54, r: 9 },
      { m: 'vexara', n: 1, x: 89, y: 88, r: 1 },
    ],
  },

  mines: {
    id: 'mines', name: 'Minas de Ferro Negro', levels: 'Níveis 12–19', w: 100, h: 90, dark: true,
    spawn: { x: 50.5, y: 84.5 },
    night: 0.85, alwaysDark: 0.55, music: 'mines',
    portals: [
      { x: 48, y: 88, w: 4, h: 2, to: 'forest', tx: 101.5, ty: 5.5, label: 'Floresta Sussurrante' },
      { x: 0, y: 10, w: 2, h: 5, to: 'ruins', tx: 104.5, ty: 50.5, label: 'Ruínas de Cinza' },
    ],
    gen: {
      type: 'cave', seed: 9001, base: T.CAVE, wall: T.CAVEWALL, path: T.CAVE,
      fill: 0.53,
      scatter: [{ o: O.STALAG, p: 0.012 }, { o: O.CRYSTAL, p: 0.004 }, { o: O.ORE, p: 0.004 }],
      decor: [{ o: O.RUBBLE, p: 0.02 }, { o: O.BONES, p: 0.006 }],
      pois: [
        { id: 's', x: 50, y: 85, r: 4 },
        { id: 'camp', x: 50, y: 72, r: 7 },
        { id: 'bats', x: 20, y: 68, r: 10 },
        { id: 'skel', x: 26, y: 40, r: 10 },
        { id: 'arch', x: 50, y: 34, r: 8 },
        { id: 'golem', x: 78, y: 44, r: 10 },
        { id: 'boss', x: 78, y: 13, r: 10 },
        { id: 'guard', x: 62, y: 24, r: 6 },
        { id: 'w', x: 4, y: 12, r: 4 },
      ],
      links: [['s', 'camp'], ['camp', 'bats'], ['bats', 'skel'], ['skel', 'arch'], ['arch', 'golem'],
        ['golem', 'boss'], ['skel', 'w'], ['camp', 'golem'], ['arch', 'guard'], ['guard', 'boss']],
      features: [
        { type: 'camp', x: 50, y: 72, mine: true },
        { type: 'torches', every: 9 },
        { type: 'ring', x: 78, y: 13, r: 8, obj: O.CRYSTAL, gap: 's' },
        { type: 'treasure', x: 78, y: 13, r: 6, n: 10 },
      ],
    },
    spawns: [
      { m: 'bat', n: 12, x: 20, y: 68, r: 10 },
      { m: 'skeleton', n: 14, x: 26, y: 40, r: 10 },
      { m: 'skeleton_archer', n: 8, x: 50, y: 34, r: 8 },
      { m: 'skeleton_guard', n: 6, x: 62, y: 24, r: 5 },
      { m: 'golem', n: 9, x: 78, y: 45, r: 10 },
      { m: 'kragmor', n: 1, x: 78, y: 12, r: 1 },
    ],
  },

  ruins: {
    id: 'ruins', name: 'Ruínas de Cinza', levels: 'Níveis 18–26', w: 110, h: 100,
    spawn: { x: 104.5, y: 50.5 },
    night: 0.7, tint: 'rgba(80,30,20,0.12)', music: 'ruins', ash: true,
    portals: [
      { x: 108, y: 48, w: 2, h: 5, to: 'mines', tx: 5.5, ty: 12.5, label: 'Minas de Ferro Negro' },
      { x: 50, y: 0, w: 5, h: 2, to: 'dunes', tx: 4.5, ty: 70.5, label: 'Estrada do Sol (Reino de Sahaar)' },
    ],
    gen: {
      type: 'outdoor', seed: 666, base: T.ASH, alt: T.MUD, path: T.RUIN,
      border: [O.DEADTREE, O.ROCK, O.BROKENPILLAR],
      water: { scale: 0.05, thr: 0.76, lava: true },
      forest: { scale: 0.09, thr: 0.6, objs: [O.DEADTREE, O.ROCK, O.BROKENPILLAR, O.DEADTREE, O.RUBBLE] },
      scatter: [{ o: O.BROKENPILLAR, p: 0.004 }, { o: O.DEADTREE, p: 0.006 }],
      decor: [{ o: O.RUBBLE, p: 0.03 }, { o: O.BONES, p: 0.008 }],
      pois: [
        { id: 'e', x: 105, y: 50, r: 5 },
        { id: 'camp', x: 88, y: 50, r: 8 },
        { id: 'cult', x: 66, y: 26, r: 10 },
        { id: 'wraith', x: 44, y: 73, r: 11 },
        { id: 'knight', x: 34, y: 28, r: 9 },
        { id: 'mural', x: 60, y: 52, r: 4 },
        { id: 'approach', x: 47, y: 50, r: 6 },
        { id: 'sanct', x: 22, y: 50, r: 11 },
        { id: 'north', x: 52, y: 5, r: 4 },
      ],
      links: [['e', 'camp'], ['camp', 'cult'], ['camp', 'mural'], ['mural', 'approach'], ['approach', 'wraith'],
        ['approach', 'sanct'], ['cult', 'knight'], ['knight', 'sanct'], ['wraith', 'sanct'], ['north', 'cult']],
      features: [
        { type: 'camp', x: 88, y: 50, tents: true, banners: true },
        { type: 'sanctuary', x: 22, y: 50, r: 10 },
      ],
    },
    spawns: [
      { m: 'cultist', n: 14, x: 66, y: 26, r: 10 },
      { m: 'cultist', n: 5, x: 47, y: 50, r: 5 },
      { m: 'wraith', n: 12, x: 44, y: 73, r: 11 },
      { m: 'zombie', n: 14, x: 72, y: 70, r: 10 },
      { m: 'zombie_brute', n: 5, x: 78, y: 82, r: 6 },
      { m: 'ash_knight', n: 9, x: 34, y: 28, r: 9 },
      { m: 'morvath', n: 1, x: 22, y: 53, r: 1 },
    ],
  },

  // ======================= Reino de Sahaar =======================
  zahrim: {
    id: 'zahrim', name: 'Zahrim, Cidade das Torres', levels: 'Zona Segura', safe: true, w: 110, h: 80,
    gen: { type: 'desertcity', seed: 5150 },
    spawn: { x: 52.5, y: 46.5 },
    night: 0.5, music: 'desert', ambient: '#000000',
    portals: [
      { x: 0, y: 36, w: 2, h: 9, to: 'dunes', tx: 126.5, ty: 44.5, label: 'Dunas Ardentes' },
      { x: 52, y: 0, w: 7, h: 2, to: 'tombs', tx: 55.5, ty: 94.5, label: 'Tumbas dos Reis-Sol' },
    ],
    desc: 'A capital de Sahaar: torres de barro e voxel em volta de um oásis, onde o sol nunca se põe sem pedir licença.',
  },

  dunes: {
    id: 'dunes', name: 'Dunas Ardentes', levels: 'Níveis 24–28', w: 130, h: 100,
    spawn: { x: 6.5, y: 70.5 },
    night: 0.45, tint: 'rgba(255,170,60,0.08)', music: 'desert',
    portals: [
      { x: 0, y: 68, w: 2, h: 5, to: 'ruins', tx: 52.5, ty: 4.5, label: 'Ruínas de Cinza' },
      { x: 128, y: 42, w: 2, h: 5, to: 'zahrim', tx: 4.5, ty: 40.5, label: 'Zahrim' },
    ],
    gen: {
      type: 'outdoor', seed: 8128, base: T.SAND, alt: T.DUNE, path: T.DIRT,
      border: [O.CACTUS, O.ROCK, O.DEADTREE, O.ROCK],
      water: { scale: 0.055, thr: 0.81, sand: true },
      forest: { scale: 0.09, thr: 0.6, objs: [O.CACTUS, O.ROCK, O.DEADTREE, O.CACTUS, O.ROCK] },
      scatter: [{ o: O.ROCK, p: 0.005 }, { o: O.CACTUS, p: 0.012 }, { o: O.PALM, p: 0.0008 }],
      decor: [{ o: O.DRYBUSH, p: 0.05 }, { o: O.BONES, p: 0.006 }, { o: O.RUBBLE, p: 0.008 }, { o: O.REEDS, p: 0, nearWater: 0.4 }],
      pois: [
        { id: 'w', x: 5, y: 70, r: 5 },
        { id: 'camp', x: 24, y: 68, r: 9 },
        { id: 'bandit', x: 60, y: 24, r: 9 },
        { id: 'scorp', x: 52, y: 54, r: 11 },
        { id: 'sorc', x: 96, y: 22, r: 9 },
        { id: 'golem', x: 88, y: 60, r: 9 },
        { id: 'shrine', x: 70, y: 76, r: 6 },
        { id: 'boss', x: 108, y: 82, r: 9 },
        { id: 'e', x: 125, y: 44, r: 5 },
      ],
      links: [['w', 'camp'], ['camp', 'bandit'], ['camp', 'scorp'], ['scorp', 'golem'], ['bandit', 'sorc'], ['sorc', 'e'],
        ['golem', 'e'], ['scorp', 'shrine'], ['shrine', 'boss'], ['golem', 'boss']],
      features: [
        { type: 'camp', x: 24, y: 68, tents: true },
        { type: 'oasis', x: 30, y: 62, r: 4 },
        { type: 'gobcamp', x: 60, y: 24 },
        { type: 'shrine', x: 70, y: 76, r: 4 },
        { type: 'ring', x: 108, y: 82, r: 8, obj: O.ROCK, gap: 'w' },
        { type: 'treasure', x: 108, y: 82, r: 6, n: 10 },
      ],
    },
    spawns: [
      { m: 'sand_bandit', n: 14, x: 60, y: 24, r: 10 },
      { m: 'scorpion', n: 16, x: 52, y: 54, r: 12 },
      { m: 'dune_sorcerer', n: 8, x: 96, y: 22, r: 9 },
      { m: 'sand_golem', n: 8, x: 88, y: 60, r: 10 },
      { m: 'scorpion', n: 6, x: 70, y: 76, r: 8 },
      { m: 'scorpion_queen', n: 1, x: 108, y: 82, r: 1 },
    ],
  },

  tombs: {
    id: 'tombs', name: 'Tumbas dos Reis-Sol', levels: 'Níveis 28–30', w: 110, h: 100, dark: true,
    spawn: { x: 55.5, y: 92.5 },
    night: 0.9, alwaysDark: 0.5, music: 'ruins',
    portals: [
      { x: 52, y: 97, w: 7, h: 3, to: 'zahrim', tx: 55.5, ty: 4.5, label: 'Zahrim' },
    ],
    gen: {
      type: 'cave', seed: 3003, base: T.TOMBFLOOR, wall: T.TOMBWALL, path: T.TOMBFLOOR,
      fill: 0.5,
      scatter: [{ o: O.PILLAR, p: 0.004 }, { o: O.BROKENPILLAR, p: 0.004 }, { o: O.URN, p: 0.003 }],
      decor: [{ o: O.RUBBLE, p: 0.02 }, { o: O.BONES, p: 0.01 }],
      pois: [
        { id: 's', x: 55, y: 92, r: 5 },
        { id: 'hall', x: 55, y: 74, r: 9 },
        { id: 'cryptw', x: 22, y: 60, r: 9 },
        { id: 'crypte', x: 88, y: 60, r: 9 },
        { id: 'guards', x: 55, y: 48, r: 9 },
        { id: 'vault', x: 25, y: 28, r: 8 },
        { id: 'boss', x: 55, y: 14, r: 11 },
      ],
      links: [['s', 'hall'], ['hall', 'cryptw'], ['hall', 'crypte'], ['hall', 'guards'], ['cryptw', 'vault'],
        ['crypte', 'guards'], ['guards', 'boss'], ['vault', 'boss'], ['cryptw', 'guards']],
      features: [
        { type: 'tombgate', x: 55, y: 88 },
        { type: 'torches', every: 8 },
        { type: 'sarcophagi', x: 55, y: 14, r: 9, n: 8 },
        { type: 'sarcophagi', x: 22, y: 60, r: 6, n: 4 },
        { type: 'sarcophagi', x: 88, y: 60, r: 6, n: 4 },
        { type: 'treasure', x: 55, y: 14, r: 7, n: 12 },
      ],
    },
    spawns: [
      { m: 'mummy', n: 10, x: 55, y: 74, r: 9 },
      { m: 'mummy', n: 8, x: 22, y: 60, r: 8 },
      { m: 'tomb_guard', n: 7, x: 88, y: 60, r: 8 },
      { m: 'tomb_guard', n: 6, x: 55, y: 48, r: 8 },
      { m: 'mummy', n: 6, x: 25, y: 28, r: 7 },
      { m: 'sun_king', n: 1, x: 55, y: 14, r: 1 },
    ],
  },

  arena: {
    id: 'arena', name: 'Arena de Sangue', levels: 'JxJ — Todos contra todos', w: 40, h: 40, pvp: true,
    gen: { type: 'arena', seed: 3 },
    spawn: { x: 20.5, y: 34.5 },
    pvpRespawn: [{ x: 10.5, y: 10.5 }, { x: 29.5, y: 10.5 }, { x: 10.5, y: 24.5 }, { x: 29.5, y: 24.5 }, { x: 20.5, y: 8.5 }],
    safeRects: [{ x: 0, y: 32, w: 40, h: 8 }],
    night: 0.5, music: 'arena',
    portals: [
      { x: 18, y: 38, w: 4, h: 2, to: 'town', tx: 56.5, ty: 90.5, label: 'Cidade de Alvorada' },
    ],
  },
};

// zona -> reino (as listas de zonas de cada reino ficam em kingdoms.js)
for (const k of Object.values(KINGDOMS)) for (const id of k.zones) if (ZONES[id]) ZONES[id].kingdom = k.id;

export const ZONE_ORDER = KINGDOM_ORDER.flatMap((k) => KINGDOMS[k].zones).filter((id) => ZONES[id]);

export const kingdomOf = (zoneId) => ZONES[zoneId]?.kingdom || 'alvorada';

// capital do reino da zona: onde o jogador reaparece e para onde o pergaminho de retorno leva
export function hubOf(zoneId) {
  const hub = ZONES[KINGDOMS[kingdomOf(zoneId)].hub];
  return { zone: hub.id, x: hub.spawn.x, y: hub.spawn.y };
}

export function isSafeAt(zone, x, y) {
  if (zone.safe) return true;
  if (!zone.safeRects) return false;
  return zone.safeRects.some((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
}

export function portalAt(zone, x, y) {
  const tx = Math.floor(x), ty = Math.floor(y);
  return zone.portals.find((p) => tx >= p.x && tx < p.x + p.w && ty >= p.y && ty < p.y + p.h) || null;
}
