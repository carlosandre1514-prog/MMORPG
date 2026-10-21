// Zonas do mundo. Coordenadas em tiles. Os mapas externos são gerados
// proceduralmente (shared/mapgen.js) garantindo áreas livres nos pontos de interesse.
import { T, O } from '../tiles.js';

export const ZONES = {
  town: {
    id: 'town', name: 'Vila de Alvorada', levels: 'Zona Segura', safe: true, w: 64, h: 48,
    gen: { type: 'town', seed: 7 },
    spawn: { x: 30.5, y: 18.5 },
    ambient: '#000000', night: 0.55, music: 'town',
    portals: [
      { x: 62, y: 22, w: 2, h: 4, to: 'fields', tx: 4.5, ty: 45.5, label: 'Campos Verdejantes' },
      { x: 18, y: 0, w: 4, h: 2, to: 'arena', tx: 20.5, ty: 34.5, label: 'Arena de Sangue' },
    ],
    desc: 'O último refúgio dos homens à beira da Névoa Cinzenta.',
  },

  fields: {
    id: 'fields', name: 'Campos Verdejantes', levels: 'Níveis 1–7', w: 110, h: 90,
    spawn: { x: 6.5, y: 45.5 },
    night: 0.6, music: 'fields',
    portals: [
      { x: 0, y: 43, w: 2, h: 5, to: 'town', tx: 59.5, ty: 23.5, label: 'Vila de Alvorada' },
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
        { id: 'w', x: 4, y: 12, r: 4 },
      ],
      links: [['s', 'camp'], ['camp', 'bats'], ['bats', 'skel'], ['skel', 'arch'], ['arch', 'golem'],
        ['golem', 'boss'], ['skel', 'w'], ['camp', 'golem'], ['arch', 'boss']],
      features: [
        { type: 'camp', x: 50, y: 72, mine: true },
        { type: 'torches', every: 9 },
        { type: 'ring', x: 78, y: 13, r: 8, obj: O.CRYSTAL, gap: 's' },
      ],
    },
    spawns: [
      { m: 'bat', n: 12, x: 20, y: 68, r: 10 },
      { m: 'skeleton', n: 14, x: 26, y: 40, r: 10 },
      { m: 'skeleton_archer', n: 8, x: 50, y: 34, r: 8 },
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
      ],
      links: [['e', 'camp'], ['camp', 'cult'], ['camp', 'mural'], ['mural', 'approach'], ['approach', 'wraith'],
        ['approach', 'sanct'], ['cult', 'knight'], ['knight', 'sanct'], ['wraith', 'sanct']],
      features: [
        { type: 'camp', x: 88, y: 50, tents: true, banners: true },
        { type: 'sanctuary', x: 22, y: 50, r: 10 },
      ],
    },
    spawns: [
      { m: 'cultist', n: 14, x: 66, y: 26, r: 10 },
      { m: 'cultist', n: 5, x: 47, y: 50, r: 5 },
      { m: 'wraith', n: 12, x: 44, y: 73, r: 11 },
      { m: 'ash_knight', n: 9, x: 34, y: 28, r: 9 },
      { m: 'morvath', n: 1, x: 22, y: 53, r: 1 },
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
      { x: 18, y: 38, w: 4, h: 2, to: 'town', tx: 19.5, ty: 5.5, label: 'Vila de Alvorada' },
    ],
  },
};

export const ZONE_ORDER = ['town', 'fields', 'forest', 'mines', 'ruins', 'arena'];

export function isSafeAt(zone, x, y) {
  if (zone.safe) return true;
  if (!zone.safeRects) return false;
  return zone.safeRects.some((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
}

export function portalAt(zone, x, y) {
  const tx = Math.floor(x), ty = Math.floor(y);
  return zone.portals.find((p) => tx >= p.x && tx < p.x + p.w && ty >= p.y && ty < p.y + p.h) || null;
}
