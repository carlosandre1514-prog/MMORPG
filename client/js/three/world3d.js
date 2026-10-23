// Construção da cena 3D de uma zona: chão, líquidos, paredes, objetos, construções e portais.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { T, O, isRock } from '/shared/tiles.js';
import { TILE } from '/shared/constants.js';
import { addBlocker } from '/shared/collision.js';
import { hash2 } from '/shared/rng.js';
import { medieval, OBJECT_MODELS, structurePlan } from './medieval.js';
import { applySeeThrough } from './seethrough.js';
import { village, villagePlan } from './village.js';
import { voxel } from './voxel.js';
import { quality, bootQuality } from '../device.js';
import { lite } from './lite.js';
import { buildFortifications, bannerSpots, WALL_H } from './castle3d.js';
import { OceanWater } from './ocean.js';
import { Farm } from './animals.js';
import { Altar } from './altar3d.js';
import { ZONES } from '/shared/data/zones.js';
import { altarId } from '/shared/altars.js';

const CHUNK = 16;
// A fazenda usa as texturas das construções da cidade (Medieval Village MegaKit) para ter cara de vila medieval: por material do modelo
// original (RoofBlack = telhado, LightRed = paredes, DarkRed = tábuas, White = molduras, Brown = madeiramento, Grey = pedra...),
// [textura da cidade, tom que multiplica a textura]. Os modelos têm UVs por projeção em caixa (tools/farm/convert.mjs).
const FARM_TEX = {
  _: { RoofBlack: ['RoundTiles', 0xffffff], DarkRed: ['WoodTrim', 0x7d5b3d], LightRed: ['Plaster', 0xe8d3a8], White: ['WoodTrim', 0xd2b88c], Brown: ['WoodTrim', 0xa98358], DarkBrown: ['WoodTrim', 0x6a4a30] },
  Silo: { DarkRed: ['UnevenBrick', 0xe6c9a6], LightRed: ['Brick', 0xe6c4aa], White: ['RoundTiles', 0xffffff], Grey: ['UnevenBrick', 0xdcd2c4] },
  Silo_House: { DarkRed: ['UnevenBrick', 0xe6c9a6], LightRed: ['Plaster', 0xe8d3a8], Grey: ['RoundTiles', 0xffffff], DarkGrey: ['UnevenBrick', 0xb0a898] },
  TowerWindmill: { Grey: ['UnevenBrick', 0xffffff], DarkGrey: ['UnevenBrick', 0xb8b0a0], LightBrown: ['WoodTrim', 0xc9a878] },
  WaterTower: { Grey: ['WoodTrim', 0x8a6c48] },
  Well: { Grey: ['UnevenBrick', 0xffffff], DarkGrey: ['UnevenBrick', 0xb0a898], LightRed: ['RoundTiles', 0xffffff], White: ['Plaster', 0xe8d3a8] },
};
// plantas pintadas à mão por zona: p = chance por tile de grama, h = altura em tiles
const FLORA = {
  forest: { p: 0.08, h: 0.7, kinds: ['flora_Mushroom1', 'flora_Mushroom2', 'flora_Mushroom3', 'flora_Bell1', 'flora_Bell2', 'flora_Bell3'] },
  fields: { p: 0.035, h: 0.55, kinds: ['flora_Flower1', 'flora_Flower2', 'flora_Flower3', 'flora_Bell2'] },
};
const GROUND_RES = bootQuality().groundRes; // pixels de textura por pixel de mundo 2D (32 px por tile)

// ------------------------------------------------------------------ geometrias com cor por vértice
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3();

function P(geo, color, pos = [0, 0, 0], rot = [0, 0, 0], scl = [1, 1, 1]) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  _m.compose(_v.set(...pos), _q.setFromEuler(_e.set(...rot)), _s.set(...scl));
  g.applyMatrix4(_m);
  const c = new THREE.Color(color);
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

const G = {
  box: (w, h, d) => new THREE.BoxGeometry(w, h, d),
  cyl: (rt, rb, h, s = 7) => new THREE.CylinderGeometry(rt, rb, h, s),
  cone: (r, h, s = 7) => new THREE.ConeGeometry(r, h, s),
  ico: (r, d = 0) => new THREE.IcosahedronGeometry(r, d),
  dodeca: (r) => new THREE.DodecahedronGeometry(r, 0),
  octa: (r) => new THREE.OctahedronGeometry(r, 0),
  sphere: (r, w = 8, h = 6) => new THREE.SphereGeometry(r, w, h),
  torus: (r, t) => new THREE.TorusGeometry(r, t, 6, 12),
};

function merge(parts) { return mergeGeometries(parts, false); }

// Geometria de cada tipo de objeto do mapa (feita uma única vez).
const objGeoCache = new Map();
function objectGeometry(o) {
  if (objGeoCache.has(o)) return objGeoCache.get(o);
  let geo = null;
  switch (o) {
    case O.TREE:
      geo = merge([
        P(G.cyl(0.09, 0.13, 0.9), 0x6d4c41, [0, 0.45, 0]),
        P(G.ico(0.5), 0x2e7d32, [0, 1.15, 0]),
        P(G.ico(0.38), 0x388e3c, [-0.25, 1.0, 0.12]),
        P(G.ico(0.36), 0x33691e, [0.24, 1.05, -0.1]),
        P(G.ico(0.3), 0x43a047, [0.05, 1.5, 0.02]),
      ]);
      break;
    case O.BIGTREE:
      geo = merge([
        P(G.cyl(0.16, 0.26, 1.4), 0x4e342e, [0, 0.7, 0]),
        P(G.ico(0.8), 0x1e5631, [0, 1.85, 0]),
        P(G.ico(0.55), 0x23673a, [-0.5, 1.55, 0.2]),
        P(G.ico(0.55), 0x1b4d2c, [0.5, 1.6, -0.15]),
        P(G.ico(0.45), 0x2a7a44, [0.1, 2.4, 0]),
      ]);
      break;
    case O.PINE:
      geo = merge([
        P(G.cyl(0.07, 0.1, 0.5), 0x5d4037, [0, 0.25, 0]),
        P(G.cone(0.55, 0.8), 0x1b5e20, [0, 0.8, 0]),
        P(G.cone(0.43, 0.7), 0x226b2a, [0, 1.25, 0]),
        P(G.cone(0.3, 0.6), 0x2e7d32, [0, 1.65, 0]),
      ]);
      break;
    case O.DEADTREE:
      geo = merge([
        P(G.cyl(0.07, 0.12, 1.2), 0x4a3f3a, [0, 0.6, 0]),
        P(G.cyl(0.03, 0.05, 0.6), 0x4a3f3a, [-0.2, 1.15, 0], [0, 0, 0.9]),
        P(G.cyl(0.03, 0.05, 0.55), 0x4a3f3a, [0.2, 1.25, 0.05], [0.2, 0, -0.8]),
        P(G.cyl(0.02, 0.04, 0.4), 0x4a3f3a, [0.02, 1.4, -0.12], [-0.6, 0, 0]),
      ]);
      break;
    case O.ROCK:
      geo = merge([P(G.dodeca(0.42), 0x8a8a8a, [0, 0.22, 0], [0.3, 0.6, 0], [1, 0.7, 0.9]), P(G.dodeca(0.22), 0x7a7a7a, [0.28, 0.1, 0.18], [0.2, 0, 0.5])]);
      break;
    case O.BUSH:
      geo = merge([P(G.ico(0.3), 0x2f7a3a, [-0.17, 0.25, 0]), P(G.ico(0.3), 0x3d8b37, [0.17, 0.25, 0.02]), P(G.ico(0.32), 0x358a40, [0, 0.38, -0.05])]);
      break;
    case O.CRYSTAL:
      geo = merge([P(G.octa(0.2), 0xb57edc, [0, 0.45, 0], [0, 0, 0], [0.8, 2.3, 0.8]), P(G.octa(0.14), 0x9b59b6, [-0.2, 0.25, 0.08], [0, 0, 0.4], [0.8, 2, 0.8]), P(G.octa(0.12), 0xd2b4de, [0.2, 0.22, -0.05], [0, 0, -0.4], [0.8, 1.8, 0.8])]);
      break;
    case O.STALAG:
      geo = merge([P(G.cone(0.28, 1.2, 6), 0x5a514a, [0, 0.6, 0]), P(G.cone(0.15, 0.6, 6), 0x6d6259, [0.22, 0.3, 0.1])]);
      break;
    case O.PILLAR:
      geo = merge([P(G.box(0.6, 0.18, 0.6), 0xb0a899, [0, 0.09, 0]), P(G.cyl(0.2, 0.22, 1.9, 10), 0xc8c0b0, [0, 1.1, 0]), P(G.box(0.62, 0.18, 0.62), 0xb0a899, [0, 2.1, 0])]);
      break;
    case O.BROKENPILLAR:
      geo = merge([P(G.box(0.6, 0.18, 0.6), 0x9d9585, [0, 0.09, 0]), P(G.cyl(0.2, 0.22, 0.9, 10), 0xb5ad9d, [0, 0.62, 0]), P(G.dodeca(0.16), 0x8d8575, [0.4, 0.1, 0.25])]);
      break;
    case O.FENCE:
      geo = merge([P(G.box(0.1, 0.6, 0.1), 0x8d6e63, [0, 0.3, 0]), P(G.box(1.0, 0.07, 0.05), 0x795548, [0, 0.42, 0]), P(G.box(1.0, 0.07, 0.05), 0x795548, [0, 0.22, 0])]);
      break;
    case O.TORCH:
      geo = merge([P(G.cyl(0.04, 0.05, 1.0, 5), 0x4e342e, [0, 0.5, 0]), P(G.cyl(0.1, 0.06, 0.12, 6), 0x795548, [0, 1.02, 0])]);
      break;
    case O.LAMP:
      geo = merge([P(G.cyl(0.04, 0.06, 1.5, 6), 0x2c3e50, [0, 0.75, 0]), P(G.box(0.24, 0.05, 0.24), 0x34495e, [0, 1.75, 0]), P(G.box(0.2, 0.22, 0.2), 0xf9e79f, [0, 1.62, 0]), P(G.box(0.3, 0.06, 0.3), 0x2c3e50, [0, 0.03, 0])]);
      break;
    case O.WELL:
      geo = merge([P(G.cyl(0.5, 0.52, 0.45, 10), 0x7f8c8d, [0, 0.22, 0]), P(G.cyl(0.38, 0.38, 0.46, 10), 0x1b2631, [0, 0.24, 0]), P(G.box(0.07, 1.1, 0.07), 0x5d4037, [-0.45, 0.8, 0]), P(G.box(0.07, 1.1, 0.07), 0x5d4037, [0.45, 0.8, 0]), P(G.cone(0.75, 0.45, 4), 0x8d6e63, [0, 1.5, 0], [0, Math.PI / 4, 0])]);
      break;
    case O.TENT:
      geo = merge([P(G.cone(0.85, 1.15, 4), 0xeeeeee, [0, 0.57, 0], [0, Math.PI / 4, 0]), P(G.box(0.35, 0.55, 0.05), 0x1b1b1b, [0, 0.27, 0.42]), P(G.cyl(0.03, 0.03, 0.3, 4), 0x5d4037, [0, 1.25, 0])]);
      break;
    case O.SIGN:
      geo = merge([P(G.box(0.08, 0.9, 0.08), 0x5d4037, [0, 0.45, 0]), P(G.box(0.7, 0.32, 0.06), 0x8d6e63, [0, 0.9, 0.04])]);
      break;
    case O.BARREL:
      geo = merge([P(G.cyl(0.26, 0.26, 0.6, 10), 0x7b4a2a, [0, 0.3, 0]), P(G.cyl(0.27, 0.27, 0.05, 10), 0x3e2723, [0, 0.15, 0]), P(G.cyl(0.27, 0.27, 0.05, 10), 0x3e2723, [0, 0.45, 0])]);
      break;
    case O.CRATE:
      geo = merge([P(G.box(0.55, 0.5, 0.55), 0xa0784a, [0, 0.25, 0]), P(G.box(0.58, 0.06, 0.58), 0x6e4b2a, [0, 0.5, 0]), P(G.box(0.06, 0.5, 0.58), 0x6e4b2a, [0.25, 0.25, 0])]);
      break;
    case O.GRAVE:
      geo = merge([P(G.box(0.38, 0.55, 0.1), 0x7f8c8d, [0, 0.27, 0]), P(G.cyl(0.19, 0.19, 0.1, 8, 1), 0x7f8c8d, [0, 0.55, 0], [Math.PI / 2, 0, 0]), P(G.box(0.4, 0.08, 0.6), 0x4a5d3a, [0, 0.04, 0.32])]);
      break;
    case O.STALL:
      geo = merge([
        P(G.box(1.0, 0.45, 0.5), 0x8d6e63, [0, 0.23, 0]),
        P(G.box(0.06, 1.3, 0.06), 0x5d4037, [-0.48, 0.65, -0.22]), P(G.box(0.06, 1.3, 0.06), 0x5d4037, [0.48, 0.65, -0.22]),
        ...[0, 1, 2, 3, 4].map((i) => P(G.box(0.22, 0.05, 0.75), i % 2 ? 0xecf0f1 : 0xc0392b, [-0.44 + i * 0.22, 1.32, 0.05], [0.25, 0, 0])),
        P(G.sphere(0.07), 0xe74c3c, [-0.3, 0.5, 0.05]), P(G.sphere(0.07), 0xf39c12, [-0.1, 0.5, 0.05]), P(G.sphere(0.07), 0x27ae60, [0.1, 0.5, 0.05]), P(G.sphere(0.07), 0x8e44ad, [0.3, 0.5, 0.05]),
      ]);
      break;
    case O.BANNER:
      geo = merge([P(G.cyl(0.03, 0.04, 1.8, 5), 0x5d4037, [0, 0.9, 0]), P(G.box(0.45, 0.75, 0.03), 0xdddddd, [0.24, 1.35, 0]), P(G.sphere(0.06), 0xf4d03f, [0, 1.82, 0])]);
      break;
    case O.CART:
      geo = merge([P(G.box(0.95, 0.35, 0.55), 0x6e4b2a, [0, 0.45, 0]), P(G.cyl(0.22, 0.22, 0.08, 10), 0x3e2723, [-0.3, 0.22, 0.3], [Math.PI / 2, 0, 0]), P(G.cyl(0.22, 0.22, 0.08, 10), 0x3e2723, [0.3, 0.22, 0.3], [Math.PI / 2, 0, 0]), P(G.cyl(0.22, 0.22, 0.08, 10), 0x3e2723, [-0.3, 0.22, -0.3], [Math.PI / 2, 0, 0]), P(G.cyl(0.22, 0.22, 0.08, 10), 0x3e2723, [0.3, 0.22, -0.3], [Math.PI / 2, 0, 0]), P(G.dodeca(0.15), 0x34495e, [-0.2, 0.68, 0]), P(G.dodeca(0.15), 0x4d5d6e, [0.15, 0.68, 0.05])]);
      break;
    case O.ORE:
      geo = merge([P(G.dodeca(0.4), 0x4d4540, [0, 0.25, 0], [0.4, 0.2, 0], [1, 0.75, 1]), P(G.box(0.08, 0.06, 0.08), 0xd4ac0d, [0.15, 0.45, 0.2]), P(G.box(0.07, 0.05, 0.07), 0xd4ac0d, [-0.2, 0.35, 0.22]), P(G.box(0.08, 0.06, 0.08), 0xd4ac0d, [0.05, 0.5, -0.1])]);
      break;
    case O.BRAZIER:
      geo = merge([P(G.cyl(0.06, 0.08, 0.55, 6), 0x4d4d4d, [0, 0.28, 0]), P(G.cyl(0.3, 0.16, 0.18, 8), 0x5d5d5d, [0, 0.62, 0]), P(G.cyl(0.22, 0.22, 0.05, 8), 0x2b1a12, [0, 0.69, 0])]);
      break;
    case O.HAY:
      geo = merge([P(G.cyl(0.3, 0.3, 0.75, 10), 0xd4ac0d, [0, 0.3, 0], [0, 0, Math.PI / 2]), P(G.cyl(0.31, 0.31, 0.06, 10), 0x9a7d0a, [0, 0.3, 0], [0, 0, Math.PI / 2])]);
      break;
    case O.STATUE:
      geo = merge([P(G.box(0.8, 0.35, 0.8), 0x95a5a6, [0, 0.17, 0]), P(G.cyl(0.18, 0.28, 1.1, 8), 0xbdc3c7, [0, 0.9, 0]), P(G.sphere(0.2), 0xbdc3c7, [0, 1.6, 0]), P(G.cyl(0.03, 0.03, 1.2, 5), 0xaab7b8, [0.3, 1.2, 0.05]), P(G.sphere(0.08), 0xf7dc6f, [0.3, 1.85, 0.05])]);
      break;
    case O.FOUNTAIN:
      geo = merge([P(G.cyl(1.35, 1.45, 0.4, 16), 0x9e9e9e, [0, 0.2, 0]), P(G.cyl(1.15, 1.15, 0.41, 16), 0x3b7fc4, [0, 0.21, 0]), P(G.cyl(0.15, 0.2, 1.1, 8), 0xb0b0b0, [0, 0.75, 0]), P(G.cyl(0.45, 0.2, 0.18, 10), 0xbdbdbd, [0, 1.3, 0]), P(G.cyl(0.36, 0.36, 0.19, 10), 0x5dade2, [0, 1.31, 0])]);
      break;
    case O.CACTUS:
      geo = merge([
        P(G.cyl(0.13, 0.16, 1.2, 8), 0x4f8f3d, [0, 0.6, 0]), P(G.sphere(0.13, 8, 6), 0x5aa044, [0, 1.2, 0]),
        P(G.cyl(0.07, 0.07, 0.34, 6), 0x4f8f3d, [0.22, 0.62, 0], [0, 0, Math.PI / 2]), P(G.cyl(0.07, 0.08, 0.42, 6), 0x4f8f3d, [0.38, 0.82, 0]), P(G.sphere(0.075, 6, 5), 0x5aa044, [0.38, 1.04, 0]),
        P(G.cyl(0.06, 0.06, 0.28, 6), 0x4f8f3d, [-0.19, 0.8, 0.02], [0, 0, Math.PI / 2]), P(G.cyl(0.06, 0.07, 0.34, 6), 0x4f8f3d, [-0.32, 0.97, 0.02]), P(G.sphere(0.065, 6, 5), 0x5aa044, [-0.32, 1.15, 0.02]),
        P(G.sphere(0.05, 5, 4), 0xe84393, [0.02, 1.32, 0.03]),
      ]);
      break;
    case O.PALM: {
      const parts = [];
      for (let i = 0; i < 4; i++) parts.push(P(G.cyl(0.1 - i * 0.012, 0.115 - i * 0.012, 0.55, 7), 0x8a6a3a, [i * 0.06, 0.27 + i * 0.52, 0], [0, 0, -i * 0.05]));
      const cx = 0.24, cy = 2.2;
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2, droop = 0.35 + (k % 2) * 0.25;
        parts.push(P(G.box(1.0, 0.035, 0.26), k % 2 ? 0x3f8f3a : 0x4aa043, [cx + Math.cos(a) * 0.42, cy - droop * 0.2, Math.sin(a) * 0.42], [0, -a, -droop]));
      }
      parts.push(P(G.sphere(0.07, 5, 4), 0x5a3d1e, [cx + 0.07, cy - 0.12, 0.06]), P(G.sphere(0.07, 5, 4), 0x5a3d1e, [cx - 0.05, cy - 0.14, -0.06]));
      geo = merge(parts);
      break;
    }
    case O.OBELISK:
      geo = merge([
        P(G.box(0.8, 0.18, 0.8), 0x9c8456, [0, 0.09, 0]),
        P(G.box(0.58, 0.9, 0.58), 0xc9a56a, [0, 0.63, 0]), P(G.box(0.46, 0.9, 0.46), 0xcfae72, [0, 1.53, 0]), P(G.box(0.36, 0.6, 0.36), 0xc9a56a, [0, 2.28, 0]),
        P(G.cone(0.27, 0.42, 4), 0xf4d03f, [0, 2.79, 0], [0, Math.PI / 4, 0]),
        ...[0, 1, 2, 3].flatMap((i) => [P(G.box(0.07, 0.2, 0.02), 0xffd54f, [(i % 2 - 0.5) * 0.18, 0.5 + i * 0.4, 0.3]), P(G.box(0.2, 0.05, 0.02), 0xffd54f, [0, 0.74 + i * 0.38, 0.3])]),
      ]);
      break;
    case O.SARCOPHAGUS:
      geo = merge([
        P(G.box(0.6, 0.38, 1.0), 0xb89b6a, [0, 0.19, 0]), P(G.box(0.68, 0.16, 1.08), 0xc9aa72, [0, 0.46, 0]),
        P(G.box(0.14, 0.03, 0.9), 0xf4d03f, [0, 0.56, 0]), P(G.cyl(0.2, 0.22, 0.1, 10), 0xf4d03f, [0, 0.56, 0.4], [Math.PI / 2, 0, 0]),
        P(G.box(0.62, 0.04, 0.06), 0x6e5a3c, [0, 0.3, 0.2]), P(G.box(0.62, 0.04, 0.06), 0x6e5a3c, [0, 0.3, -0.2]),
      ]);
      break;
    case O.URN:
      geo = merge([
        P(G.cyl(0.13, 0.17, 0.12, 8), 0x9c4a2a, [0, 0.06, 0]), P(G.sphere(0.27, 9, 7), 0xa9532e, [0, 0.36, 0], [0, 0, 0], [1, 1.1, 1]),
        P(G.cyl(0.29, 0.29, 0.05, 9), 0xf4d03f, [0, 0.4, 0]), P(G.cyl(0.1, 0.15, 0.2, 8), 0xa9532e, [0, 0.74, 0]), P(G.cyl(0.15, 0.11, 0.06, 8), 0x8c3f22, [0, 0.87, 0]),
      ]);
      break;
    default: break;
  }
  objGeoCache.set(o, geo);
  return geo;
}

// variação de cor por instância
function instanceTint(o, v) {
  const c = new THREE.Color(1, 1, 1);
  if (o === O.TENT) return c.set([0xc0392b, 0xd68910, 0x7d6608, 0x566573][Math.floor(v * 4) % 4]);
  if (o === O.BANNER) return c.set(v > 0.5 ? 0xb03a2e : 0x2e4a9e);
  const k = 0.85 + v * 0.3;
  return c.setRGB(k, k, k);
}

// textura radial para brilhos e chamas
let glowTex = null;
export function glowTexture() {
  if (glowTex) return glowTex;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,0.6)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(cv);
  return glowTex;
}

const OBJECT_MODEL_KEY = {
  [O.TREE]: 'tree', [O.PINE]: 'pine', [O.BIGTREE]: 'bigtree', [O.ROCK]: 'rock', [O.BARREL]: 'barrel',
  [O.CRATE]: 'crate', [O.WELL]: 'well', [O.CART]: 'cart', [O.BANNER]: 'banner',
  [O.TARGET]: 'target', [O.RACK]: 'rack', [O.ANVIL]: 'anvil', [O.TOOLS]: 'tools', [O.LANTERN]: 'lantern', [O.SACK]: 'sack', [O.LUMBER]: 'lumber', [O.ORE]: 'ore',
  [O.BARS]: 'bars', [O.CLOTH]: 'cloth', [O.PLANKS]: 'planks', [O.BRICKS]: 'bricks', [O.GOLD]: 'gold',
  [O.PILLAR]: 'pillar', [O.BROKENPILLAR]: 'brokenpillar', [O.TORCH]: 'torch', [O.CHEST]: 'chest', [O.TABLE]: 'table',
  [O.KEG]: 'keg', [O.CANDLE]: 'candle',
};
const NATURE = new Set([O.TREE, O.PINE, O.BIGTREE, O.ROCK]);

// Cenário além das bordas do mapa (só visual): florestas e montanhas para o horizonte não ficar vazio
const SCENERY = {
  town: { near: ['trees_A_large', 'trees_B_large', 'trees_A_medium', 'trees_B_medium'], far: ['mountain_A_grass_trees', 'mountain_B_grass_trees', 'mountain_C_grass_trees'] },
  fields: { near: ['trees_A_medium', 'trees_B_medium', 'trees_A_small', 'trees_B_large'], far: ['mountain_A_grass_trees', 'mountain_B_grass_trees', 'mountain_C_grass_trees'] },
  forest: { near: ['trees_A_large', 'trees_B_large', 'trees_A_large', 'trees_B_medium'], far: ['mountain_A_grass_trees', 'mountain_C_grass_trees', 'trees_A_large'] },
  ruins: { near: ['rock_single_E', 'rock_single_C', 'rock_single_D', 'building_destroyed'], far: ['mountain_A', 'mountain_B', 'mountain_C'] },
};

// ------------------------------------------------------------------ cena da zona
export class ZoneScene {
  constructor(zone, terrain, renderer) {
    this.zone = zone;
    this.terrain = terrain;
    this.group = new THREE.Group();
    this.animated = [];
    this.flames = [];
    this.altars = [];
    this.windowMat = new THREE.MeshStandardMaterial({ color: 0x5a4a2a, emissive: 0xffc861, emissiveIntensity: 0 });
    this.maxAniso = renderer.capabilities.getMaxAnisotropy();
    this.buildGround();
    this.buildLiquids();
    this.buildWalls();
    this.buildObjects();
    this.buildStructures();
    this.buildAltars();
    if (medieval.ready) { this.buildScenery(); this.buildWaterPlants(); this.buildFarm(); this.buildFlora(); }
    // tudo que é sólido e alto pode ficar transparente perto do jogador
    this.group.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if ((m.isMeshStandardMaterial || m.isMeshLambertMaterial) && !m.userData.ground && m !== this.waterMat && m !== this.lavaMat) applySeeThrough(m);
      }
    });
  }

  tile(x, y) { return this.terrain.tile(x, y); }

  // Divide uma InstancedMesh em pedaços de 12 × 12 tiles, cada um com a própria esfera de corte: o que está fora da tela
  // (ou da sombra) não é desenhado. A malha original só serviu de molde e não chega a ir para a GPU.
  addInst(inst) {
    const CH = 12;
    const groups = new Map();
    const m = new THREE.Matrix4(), col = new THREE.Color();
    const hasColor = !!inst.instanceColor;
    for (let i = 0; i < inst.count; i++) {
      inst.getMatrixAt(i, m);
      const key = Math.floor(m.elements[12] / CH) + ',' + Math.floor(m.elements[14] / CH);
      let g = groups.get(key);
      if (!g) groups.set(key, (g = []));
      g.push(i);
    }
    for (const ids of groups.values()) {
      const part = new THREE.InstancedMesh(inst.geometry, inst.material, ids.length);
      ids.forEach((id, j) => {
        inst.getMatrixAt(id, m);
        part.setMatrixAt(j, m);
        if (hasColor) { inst.getColorAt(id, col); part.setColorAt(j, col); }
      });
      part.castShadow = inst.castShadow;
      part.receiveShadow = inst.receiveShadow;
      part.computeBoundingSphere();
      part.computeBoundingBox();
      this.group.add(part);
    }
    inst.dispose();
  }

  // interiores só por perto do jogador (no máximo a cada 200 ms e quando ele se mexeu)
  cull(px, pz, force = false) {
    this.px = px; this.pz = pz;
    if (this.voxels) this.voxels.update(px, pz, force);
    if (!this.propGroup) return;
    if (this.hearthFlames) {
      const r2 = quality().cullR ** 2;
      for (const f of this.hearthFlames) {
        const on = (f.position.x - px) ** 2 + (f.position.z - pz) ** 2 < r2;
        f.visible = on;
        if (f.userData.core) f.userData.core.visible = on;
      }
    }
    const now = performance.now();
    if (!force && (now - (this.lastCull || 0) < 200 || (Math.abs(px - this.cullX) < 0.5 && Math.abs(pz - this.cullZ) < 0.5))) return;
    this.lastCull = now; this.cullX = px; this.cullZ = pz;
    village.cullProps(this.propGroup, px, pz, quality().cullR);
    if (this.cityGroup) { const Qc = quality(); village.updateLod(this.cityGroup, px, pz, Qc.lodR, Qc.innerR); }
  }

  // O jogador entrou (ou saiu) de uma casa: com a câmera de fora o telhado e os andares de cima somem
  setIndoor(room, hide) {
    if (!this.cityGroup) return;
    const bid = room && hide ? room.seed : 0;
    if (bid === (this.hiddenBid || 0)) return;
    if (this.hiddenBid) village.setHidden(this.cityGroup, this.propGroup, this.hiddenBid, false);
    if (bid) village.setHidden(this.cityGroup, this.propGroup, bid, true);
    this.hiddenBid = bid;
    this.cull(this.cullX || 0, this.cullZ || 0, true);
  }

  updateDoors(px, py, dt) {
    if (this.cityGroup) village.updateDoors(this.cityGroup, this.zone.map.rooms, px, py, dt);
  }

  buildGround() {
    const z = this.zone;
    const cw = Math.ceil(z.w / CHUNK), ch = Math.ceil(z.h / CHUNK);
    for (let cy = 0; cy < ch; cy++) {
      for (let cx = 0; cx < cw; cx++) {
        const px = CHUNK * TILE * GROUND_RES;
        const cv = document.createElement('canvas');
        cv.width = cv.height = px;
        const ctx = cv.getContext('2d');
        ctx.scale(GROUND_RES, GROUND_RES);
        this.terrain.drawChunk(ctx, cx, cy);
        const tex = new THREE.CanvasTexture(cv);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = bootQuality().low ? 1 : Math.min(8, this.maxAniso);
        // chunks de borda cobrem só os tiles que existem (o resto da textura seria o vazio preto)
        const wv = Math.min(CHUNK, z.w - cx * CHUNK), hv = Math.min(CHUNK, z.h - cy * CHUNK);
        const geo = new THREE.PlaneGeometry(wv, hv);
        const uv = geo.attributes.uv;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (wv / CHUNK), 1 - (1 - uv.getY(i)) * (hv / CHUNK));
        geo.rotateX(-Math.PI / 2);
        const m = new THREE.Mesh(geo, Object.assign(new THREE.MeshLambertMaterial({ map: tex }), { userData: { ground: true } }));
        m.position.set(cx * CHUNK + wv / 2, 0, cy * CHUNK + hv / 2);
        m.receiveShadow = true;
        this.group.add(m);
      }
    }
    // chão além das bordas
    const def = z.def;
    const outer = new THREE.Mesh(new THREE.PlaneGeometry(z.w + 120, z.h + 120).rotateX(-Math.PI / 2),
      Object.assign(new THREE.MeshLambertMaterial({ color: def.gen.type === 'cave' || def.gen.type === 'arena' ? 0x1c1916 : def.id === 'ruins' ? 0x3a3330 : 0x24401f }), { userData: { ground: true } }));
    outer.position.set(z.w / 2, -0.02, z.h / 2);
    this.group.add(outer);
  }

  quadsFor(pred, y) {
    const pos = [];
    const m = this.zone.map;
    for (let ty = 0; ty < m.h; ty++) {
      for (let tx = 0; tx < m.w; tx++) {
        if (!pred(m.tiles[ty * m.w + tx])) continue;
        pos.push(tx, y, ty, tx, y, ty + 1, tx + 1, y, ty + 1, tx, y, ty, tx + 1, y, ty + 1, tx + 1, y, ty);
      }
    }
    if (!pos.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    return g;
  }

  // Geometria da água em pedaços de 16 × 16 tiles. Cada vértice leva a profundidade (0 raso … 1 fundo) e a "margem" (fração dos
  // tiles em volta que são terra), os dois suavizados entre vizinhos, para a água ir escurecendo e sumindo devagar nas bordas.
  waterChunks(y) {
    const m = this.zone.map, CH = 16;
    const isW = (x, z) => x >= 0 && z >= 0 && x < m.w && z < m.h && (m.tiles[z * m.w + x] === T.WATER || m.tiles[z * m.w + x] === T.DEEP);
    const deepAt = (x, z) => (isW(x, z) && m.tiles[z * m.w + x] === T.DEEP ? 1 : 0);
    const vert = (vx, vz) => {
      let wet = 0, deep = 0, n = 0;
      for (const [dx, dz] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) {
        const x = vx + dx, z = vz + dz;
        if (x < 0 || z < 0 || x >= m.w || z >= m.h) continue; // fora do mapa não conta como terra
        n++;
        if (isW(x, z)) { wet++; deep += deepAt(x, z); }
      }
      return [wet ? deep / wet : 0, n ? 1 - wet / n : 0];
    };
    const out = [];
    for (let cz = 0; cz < Math.ceil(m.h / CH); cz++) {
      for (let cx = 0; cx < Math.ceil(m.w / CH); cx++) {
        const pos = [], dp = [], sh = [];
        let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
        for (let tz = cz * CH; tz < Math.min(m.h, (cz + 1) * CH); tz++) {
          for (let tx = cx * CH; tx < Math.min(m.w, (cx + 1) * CH); tx++) {
            if (!isW(tx, tz)) continue;
            for (const [a, b] of [[0, 0], [0, 1], [1, 1], [0, 0], [1, 1], [1, 0]]) {
              const [d, s] = vert(tx + a, tz + b);
              pos.push(tx + a, 0, tz + b); dp.push(d); sh.push(s);
            }
            x0 = Math.min(x0, tx); x1 = Math.max(x1, tx + 1); z0 = Math.min(z0, tz); z1 = Math.max(z1, tz + 1);
          }
        }
        if (!pos.length) continue;
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute('aDeep', new THREE.Float32BufferAttribute(dp, 1));
        g.setAttribute('aShore', new THREE.Float32BufferAttribute(sh, 1));
        g.computeBoundingSphere();
        out.push({ geometry: g, box: new THREE.Box3(new THREE.Vector3(x0, y - 0.2, z0), new THREE.Vector3(x1, y + 0.2, z1)) });
      }
    }
    return out;
  }

  buildLiquids() {
    const chunks = this.waterChunks(0.05);
    if (chunks.length) {
      // água em Opções > Gráficos: 2 = reflexo de verdade (a cena é desenhada de novo, de cabeça para baixo); 1 e 0 refletem só o céu
      const q = quality();
      this.water = new OceanWater({ chunks, y: 0.05, mirror: q.water >= 2, taps4: q.water >= 1, mirrorWanted: () => q.water >= 2 });
      this.waterMat = this.water.material;
      this.group.add(this.water.group);
    }
    const lg = this.quadsFor((t) => t === T.LAVA, 0.04);
    if (lg) {
      this.lavaMat = new THREE.MeshStandardMaterial({ color: 0xff6a1a, emissive: 0xff4500, emissiveIntensity: 1.2, transparent: true, opacity: 0.7 });
      this.group.add(new THREE.Mesh(lg, this.lavaMat));
    }
  }

  buildWalls() {
    const m = this.zone.map;
    const list = [];
    for (let ty = 0; ty < m.h; ty++) for (let tx = 0; tx < m.w; tx++) if (isRock(m.tiles[ty * m.w + tx])) list.push([tx, ty]);
    if (!list.length) return;
    const geo = new THREE.BoxGeometry(1, 1, 1);
    geo.translate(0, 0.5, 0);
    const n = geo.attributes.position.count;
    const col = new Float32Array(n * 3);
    const top = new THREE.Color(0x5a514a), side = new THREE.Color(0x3a332e);
    for (let i = 0; i < n; i++) {
      const c = geo.attributes.normal.getY(i) > 0.5 ? top : side;
      col.set([c.r, c.g, c.b], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = lite(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }));
    const inst = new THREE.InstancedMesh(geo, mat, list.length);
    const mtx = new THREE.Matrix4();
    const tint = new THREE.Color();
    list.forEach(([x, y], i) => {
      const h = 1.05 + hash2(x, y, 9) * 0.6;
      mtx.compose(_v.set(x + 0.5, 0, y + 0.5), _q.identity(), _s.set(1.001, h, 1.001));
      inst.setMatrixAt(i, mtx);
      // as paredes de arenito das tumbas são mais quentes e claras que a rocha das cavernas
      inst.setColorAt(i, m.tiles[y * m.w + x] === T.TOMBWALL ? tint.setRGB(1.6, 1.32, 0.95) : tint.setRGB(1, 1, 1));
    });
    inst.castShadow = true;
    inst.receiveShadow = true;
    this.addInst(inst);
    if (medieval.ready) this.caveRocks(list);
  }

  // Formações de pedra do pack na borda das paredes da caverna (as caixas continuam por baixo)
  caveRocks(list) {
    const m = this.zone.map;
    const floor = (x, y) => x >= 0 && y >= 0 && x < m.w && y < m.h && !isRock(m.tiles[y * m.w + x]);
    const names = ['mountain_A', 'mountain_B', 'mountain_C'].filter((n) => medieval.has(n));
    if (!names.length) return;
    const groups = new Map(names.map((n) => [n, []]));
    for (const [x, y] of list) {
      if (!(floor(x + 1, y) || floor(x - 1, y) || floor(x, y + 1) || floor(x, y - 1))) continue;
      if (hash2(x, y, 41) > 0.55) continue;
      groups.get(names[Math.floor(hash2(x, y, 42) * names.length) % names.length]).push([x, y]);
    }
    const mtx = new THREE.Matrix4();
    const up = new THREE.Vector3(0, 1, 0);
    for (const [name, pts] of groups) {
      if (!pts.length) continue;
      const base = medieval.fit(name, 1.75, 1.75);
      const inst = new THREE.InstancedMesh(medieval.geo(name), medieval.mat(name), pts.length);
      const col = new THREE.Color();
      pts.forEach(([x, y], i) => {
        const r = hash2(x, y, 43);
        const s = base * (0.8 + r * 0.45);
        mtx.compose(_v.set(x + 0.5, 0, y + 0.5), _q.setFromAxisAngle(up, r * 12), _s.set(s, s * (0.9 + r * 0.5), s));
        inst.setMatrixAt(i, mtx);
        const k = 0.5 + hash2(x, y, 44) * 0.2;
        inst.setColorAt(i, m.tiles[y * m.w + x] === T.TOMBWALL ? col.setRGB(k * 1.55, k * 1.3, k * 0.95) : col.setRGB(k * 1.05, k, k * 0.92));
      });
      inst.castShadow = true;
      inst.receiveShadow = true;
      this.addInst(inst);
    }
  }

  buildObjects() {
    const byType = new Map();
    for (const ob of this.terrain.tallObjects) {
      if (!byType.has(ob.o)) byType.set(ob.o, []);
      byType.get(ob.o).push(ob);
    }
    const stdMat = lite(new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9 }));
    const crystalMat = lite(new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.3, emissive: 0x7d3c98, emissiveIntensity: 0.9 }));
    const mtx = new THREE.Matrix4();
    for (const [o, list] of byType) {
      if (medieval.ready && OBJECT_MODEL_KEY[o] && this.packObjects(o, list)) continue;
      const geo = objectGeometry(o);
      if (!geo) continue;
      const inst = new THREE.InstancedMesh(geo, o === O.CRYSTAL ? crystalMat : stdMat, list.length);
      list.forEach((ob, i) => {
        let x = ob.x + 0.5, y = ob.y + 0.5, rot = ob.v * Math.PI * 2, s = 0.85 + ob.v * 0.3;
        if (o === O.FOUNTAIN) { x = ob.x + 1.5; y = ob.y + 1.5; rot = 0; s = 1; }
        if (o === O.FENCE) {
          const mask = this.terrain.fenceMask(ob.x, ob.y);
          rot = (mask & 3) || !(mask & 12) ? 0 : Math.PI / 2;
          s = 1;
        }
        if ([O.TENT, O.STALL, O.SIGN, O.BANNER, O.CART, O.STATUE, O.GRAVE, O.LAMP, O.TORCH, O.BRAZIER, O.WELL, O.OBELISK].includes(o)) { rot = o === O.TENT || o === O.CART ? (ob.v - 0.5) * 0.6 : 0; s = 1; }
        if (o === O.SARCOPHAGUS) { rot = ob.v > 0.5 ? Math.PI / 2 : 0; s = 1; }
        mtx.compose(_v.set(x, 0, y), _q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rot), _s.set(s, s, s));
        inst.setMatrixAt(i, mtx);
        inst.setColorAt(i, instanceTint(o, ob.v));
        // chamas e brilhos
        const flameY = { [O.TORCH]: 1.12, [O.BRAZIER]: 0.78, [O.LAMP]: 1.62 }[o];
        if (flameY) this.addFlame(x, flameY, y, o === O.LAMP ? 0xffe9a0 : 0xff9a3c, o === O.BRAZIER ? 1.3 : o === O.LAMP ? 0.7 : 0.9, o !== O.LAMP);
      });
      inst.castShadow = o !== O.FENCE;
      inst.receiveShadow = true;
      this.addInst(inst);
    }
  }

  // Objetos do mapa com modelos do pack: uma InstancedMesh por variante
  packObjects(o, list) {
    const spec = OBJECT_MODELS[OBJECT_MODEL_KEY[o]];
    const names = spec.m.filter((n) => medieval.has(n));
    if (!names.length) return false;
    // cada grupo: um modelo e as instâncias dele; "place" calcula a matriz de cada objeto do mapa
    const groups = new Map(names.map((n) => [n, { fit: spec, obs: [] }]));
    for (const ob of list) {
      const pickV = o === O.BANNER ? (ob.v > 0.5 ? 1 : 0) : Math.floor(hash2(ob.x, ob.y, 31) * names.length);
      groups.get(names[Math.min(names.length - 1, pickV)]).obs.push(ob);
    }
    if (spec.base && medieval.has(spec.base.m)) groups.set(spec.base.m, { fit: spec.base, obs: list, base: true });
    const nature = NATURE.has(o);
    const spin = nature || [O.BARREL, O.CRATE, O.ORE, O.GOLD, O.KEG, O.BROKENPILLAR, O.TOOLS].includes(o);
    const quarter = [O.BARS, O.CLOTH, O.PLANKS, O.BRICKS, O.SACK, O.LUMBER, O.CHEST, O.TABLE, O.CANDLE, O.ANVIL].includes(o);
    const col = new THREE.Color();
    const rotOf = (ob) => (spin ? ob.v * Math.PI * 2 : quarter ? Math.floor(ob.v * 4) * Math.PI / 2 : o === O.CART ? (ob.v - 0.5) * 0.8 : 0);
    const build = (name, fit, obs, matFor, tint) => {
      if (!obs.length) return;
      const k = medieval.fit(name, fit.w, fit.w, fit.h);
      const box = medieval.geo(name).boundingBox;
      const inst = new THREE.InstancedMesh(medieval.geo(name), medieval.mat(name), obs.length);
      obs.forEach((it, i) => {
        inst.setMatrixAt(i, matFor(it, k, box));
        if (tint) { const t = tint(it); inst.setColorAt(i, col.setRGB(t, t, t)); }
      });
      inst.castShadow = true;
      inst.receiveShadow = true;
      this.addInst(inst);
    };
    // matriz = translação * giro em Y * (deitar em X) * escala, com o modelo centrado no tile e apoiado no chão
    const _r = new THREE.Matrix4(), _b = new THREE.Box3(), _c = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), ex = new THREE.Vector3(1, 0, 0);
    const placeMatrix = (cx, cz, k, box, rot, lay, tilt = 0, yBase = null) => {
      const qy = new THREE.Quaternion().setFromAxisAngle(up, rot);
      const qx = new THREE.Quaternion().setFromAxisAngle(ex, lay ? -Math.PI / 2 : 0);
      const qz = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), tilt);
      const q = new THREE.Quaternion().multiplyQuaternions(qy, qz).multiply(qx);
      _r.compose(_v.set(0, 0, 0), q, _s.set(k, k, k));
      _b.copy(box).applyMatrix4(_r);
      _b.getCenter(_c);
      return new THREE.Matrix4().compose(
        new THREE.Vector3(cx - _c.x, yBase == null ? -_b.min.y : yBase - _b.min.y, cz - _c.z), q, new THREE.Vector3(k, k, k));
    };
    for (const [name, g] of groups) {
      build(name, g.fit, g.obs, (ob, k, box) => {
        const s2 = k * (nature ? 0.85 + ob.v * 0.3 : 1);
        const rot = rotOf(ob) + (g.base ? 1.3 : 0);
        return placeMatrix(ob.x + 0.5, ob.y + 0.5, s2, box, rot, !!g.fit.lay);
      }, nature ? (ob) => 0.86 + hash2(ob.x, ob.y, 77) * 0.2 : null);
    }
    // extras (armas no suporte, martelo e tenazes na bigorna): modelos próprios na mesma posição
    for (const ex2 of spec.extras || []) {
      if (!medieval.has(ex2.m)) continue;
      build(ex2.m, ex2, list, (ob, k, box) => {
        const rot = rotOf(ob) + (ex2.rot || 0) * (ex2.lay ? 1 : 0);
        const r0 = rotOf(ob);
        const dx = Math.cos(r0) * ex2.dx + Math.sin(r0) * (ex2.dz || 0), dz = -Math.sin(r0) * ex2.dx + Math.cos(r0) * (ex2.dz || 0);
        return placeMatrix(ob.x + 0.5 + dx, ob.y + 0.5 + dz, k, box, ex2.lay ? rot : r0, !!ex2.lay, ex2.tilt || 0, ex2.y);
      });
    }
    // chamas das tochas, velas e lanternas
    if (spec.flame) for (const ob of list) this.addFlame(ob.x + 0.5, spec.flame, ob.y + 0.5, 0xffb347, spec.flameSize || 0.85, true);
    return true;
  }

  // Florestas e montanhas fora do mapa, agrupadas por modelo em InstancedMesh
  buildScenery() {
    const set = SCENERY[this.zone.id];
    if (!set) return;
    const z = this.zone;
    const items = new Map();
    const put = (name, x, y, s, rot) => {
      if (!medieval.has(name)) return;
      if (!items.has(name)) items.set(name, []);
      items.get(name).push({ x, y, s, rot });
    };
    const ring = (dist, step, list, size, salt) => {
      const w = z.w + dist * 2, h = z.h + dist * 2;
      const per = 2 * (w + h);
      for (let d = 0; d < per; d += step) {
        let x, y;
        if (d < w) { x = -dist + d; y = -dist; }
        else if (d < w + h) { x = z.w + dist; y = -dist + (d - w); }
        else if (d < 2 * w + h) { x = z.w + dist - (d - w - h); y = z.h + dist; }
        else { x = -dist; y = z.h + dist - (d - 2 * w - h); }
        const r = hash2(Math.round(x * 3), Math.round(y * 3), salt);
        const name = list[Math.floor(r * list.length) % list.length];
        const jx = (hash2(Math.round(x), Math.round(y), salt + 1) - 0.5) * step * 0.6;
        const jy = (hash2(Math.round(x), Math.round(y), salt + 2) - 0.5) * step * 0.6;
        put(name, x + jx, y + jy, size * (0.85 + r * 0.35), r * Math.PI * 2);
      }
    };
    ring(3.5, 4.2, set.near, 5.2, 11);
    ring(8, 5, set.near, 5.6, 12);
    ring(16, 9, set.far, 11, 13);
    const mtx = new THREE.Matrix4();
    const up = new THREE.Vector3(0, 1, 0);
    for (const [name, list] of items) {
      const sz = medieval.size(name);
      const box = medieval.geo(name).boundingBox;
      const inst = new THREE.InstancedMesh(medieval.geo(name), medieval.mat(name), list.length);
      list.forEach((it, i) => {
        const s = it.s / Math.max(sz.x, sz.z);
        mtx.compose(_v.set(it.x, -box.min.y * s - 0.05, it.y), _q.setFromAxisAngle(up, it.rot), _s.set(s, s, s));
        inst.setMatrixAt(i, mtx);
      });
      inst.castShadow = false;
      inst.receiveShadow = true;
      this.addInst(inst);
    }
  }

  // Fazenda: construções, adereços e currais com animais (estruturas 'farm', 'farmprop' e 'pen' do mapa; layout em shared/farm.js)
  buildFarm() {
    const sts = this.zone.structures.filter((st) => st.kind === 'farm' || st.kind === 'farmprop' || st.kind === 'pen');
    if (!sts.length) return;
    this.farmMats = new Map();
    for (const st of sts) {
      if (st.kind !== 'farm') continue;
      const names = medieval.parts('farm_' + st.model);
      if (!names.length) continue;
      const box = new THREE.Box3();
      for (const n of names) box.union(medieval.geo(n).boundingBox); // as partes dividem a origem: centradas em x e z, base em y = 0
      const size = box.getSize(new THREE.Vector3());
      this.group.add(this.facing(st, (W, D) => {
        const k = Math.min(W * 0.98 / size.x, D * 0.98 / size.z), g = new THREE.Group();
        for (const n of names) {
          const mesh = new THREE.Mesh(medieval.geo(n), this.farmMaterial(st.model, n.split('~')[1], n));
          mesh.scale.setScalar(k);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          g.add(mesh);
        }
        return g;
      }));
    }
    // adereços (cada modelo é uma InstancedMesh): 0,8 tile por metro, como as construções
    const byName = new Map();
    for (const st of sts) if (st.kind === 'farmprop' && medieval.has('prop_' + st.m)) { const n = 'prop_' + st.m; (byName.get(n) || byName.set(n, []).get(n)).push(st); }
    for (const [name, list] of byName) {
      const k = 0.8, inst = new THREE.InstancedMesh(medieval.geo(name), medieval.mat(name), list.length);
      list.forEach((p, i) => inst.setMatrixAt(i, medieval.placed(name, k, p.x, 0, p.y, p.rot || 0)));
      inst.castShadow = true;
      inst.receiveShadow = true;
      this.addInst(inst);
    }
    if (sts.some((st) => st.kind === 'pen')) { this.farm = new Farm(this.zone); this.group.add(this.farm.group); }
  }

  // Material de uma parte da fazenda: a textura da cidade (telha, reboco, madeira, pedra) com o tom do material original; sem a
  // textura (cidade não carregada, ou metal e peças pretas) fica a cor por vértice do próprio modelo.
  farmMaterial(model, mtl, partName) {
    const spec = (FARM_TEX[model] && FARM_TEX[model][mtl]) || FARM_TEX._[mtl];
    const base = spec && village.ready && village.mats[spec[0]];
    if (!base) return medieval.mat(partName);
    const key = spec[0] + '|' + spec[1];
    let m = this.farmMats.get(key);
    if (!m) {
      m = base.clone();
      m.userData = {};
      m.color.set(spec[1]);
      this.farmMats.set(key, m);
    }
    return m;
  }

  // Flores, sinos e cogumelos que brilham, espalhados pela grama (plantas pintadas à mão do pacote da WizP)
  buildFlora() {
    const cfg = FLORA[this.zone.id];
    if (!cfg) return;
    const names = cfg.kinds.filter((n) => medieval.has(n));
    if (!names.length) return;
    const m = this.zone.map;
    const used = new Uint8Array(m.w * m.h); // currais e construções ficam sem plantas
    for (const st of this.zone.structures) if (st.kind === 'pen' || st.kind === 'farm') for (let y = st.y - 1; y <= st.y + st.h; y++) for (let x = st.x - 1; x <= st.x + st.w; x++) if (x >= 0 && y >= 0 && x < m.w && y < m.h) used[y * m.w + x] = 1;
    const per = new Map(names.map((n) => [n, []]));
    for (let y = 2; y < m.h - 2; y++) {
      for (let x = 2; x < m.w - 2; x++) {
        const i = y * m.w + x, t = m.tiles[i];
        if ((t !== T.GRASS && t !== T.DARKGRASS) || m.objs[i] || used[i] || hash2(x, y, 311) >= cfg.p) continue;
        per.get(names[Math.floor(hash2(x, y, 312) * names.length)]).push([x + 0.15 + hash2(x, y, 313) * 0.7, y + 0.15 + hash2(x, y, 314) * 0.7, hash2(x, y, 315)]);
      }
    }
    const up = new THREE.Vector3(0, 1, 0);
    for (const [name, list] of per) {
      if (!list.length) continue;
      const k = medieval.fit(name, 0, 0, cfg.h);
      for (const part of [name, name + '_glow']) {
        if (!medieval.has(part)) continue;
        const inst = new THREE.InstancedMesh(medieval.geo(part), medieval.mat(part), list.length);
        list.forEach(([x, z, r], j) => {
          const s = k * (0.75 + r * 0.6);
          inst.setMatrixAt(j, new THREE.Matrix4().compose(_v.set(x, 0, z), _q.setFromAxisAngle(up, r * 40), _s.set(s, s, s)));
        });
        inst.castShadow = false;
        inst.receiveShadow = false;
        this.addInst(inst);
      }
    }
  }

  // Vitórias-régias e juncos na água rasa
  buildWaterPlants() {
    const m = this.zone.map;
    const items = { waterlily_A: [], waterlily_B: [], waterplant_A: [], waterplant_B: [], waterplant_C: [] };
    const land = (x, y) => x >= 0 && y >= 0 && x < m.w && y < m.h && m.tiles[y * m.w + x] !== T.WATER && m.tiles[y * m.w + x] !== T.DEEP;
    for (let y = 0; y < m.h; y++) {
      for (let x = 0; x < m.w; x++) {
        if (m.tiles[y * m.w + x] !== T.WATER) continue;
        const r = hash2(x, y, 55);
        const shore = land(x + 1, y) || land(x - 1, y) || land(x, y + 1) || land(x, y - 1);
        if (shore && r < 0.22) items[['waterplant_A', 'waterplant_B', 'waterplant_C'][Math.floor(r * 100) % 3]].push([x, y, r]);
        else if (!shore && r < 0.12) items[r < 0.06 ? 'waterlily_A' : 'waterlily_B'].push([x, y, r]);
      }
    }
    const mtx = new THREE.Matrix4();
    const up = new THREE.Vector3(0, 1, 0);
    for (const [name, list] of Object.entries(items)) {
      if (!list.length || !medieval.has(name)) continue;
      const lily = name.startsWith('waterlily');
      const base = medieval.fit(name, lily ? 0.55 : null, lily ? 0.55 : null, lily ? null : 0.75);
      const inst = new THREE.InstancedMesh(medieval.geo(name), medieval.mat(name), list.length);
      list.forEach(([x, y, r], i) => {
        const s = base * (0.8 + r * 2);
        mtx.compose(_v.set(x + 0.2 + hash2(x, y, 56) * 0.6, lily ? 0.06 : 0, y + 0.2 + hash2(x, y, 57) * 0.6), _q.setFromAxisAngle(up, r * 60), _s.set(s, s, s));
        inst.setMatrixAt(i, mtx);
      });
      this.addInst(inst);
    }
  }

  addFlame(x, y, z, color, size, flicker, coreColor = 0xffc34d) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    sp.position.set(x, y, z);
    sp.scale.setScalar(size);
    sp.userData = { base: size, flicker, ph: Math.random() * 10 };
    this.group.add(sp);
    this.flames.push(sp);
    if (flicker) {
      const core = new THREE.Mesh(new THREE.ConeGeometry(0.07 * size, 0.28 * size, 6), new THREE.MeshBasicMaterial({ color: coreColor }));
      core.position.set(x, y + 0.05, z);
      this.group.add(core);
      sp.userData.core = core;
    }
    return sp;
  }

  buildStructures() {
    const forts = [], houses = [], voxels = [];
    for (const st of this.zone.structures) {
      if (st.kind === 'farm' || st.kind === 'farmprop' || st.kind === 'pen') continue; // a fazenda tem a própria função (buildFarm)
      if (st.kind === 'wall' || st.kind === 'tower' || st.kind === 'gate') forts.push(st);
      else if (st.type === 'voxel' && voxel.has(st.model)) voxels.push(st); // torres em voxel: modelo próprio, sem porta nem interior
      else houses.push(st);
    }
    if (voxels.length) { this.voxels = voxel.build(voxels); this.group.add(this.voxels.group); this.voxels.update(this.zone.w / 2, this.zone.h / 2, true); }
    if (forts.length) {
      this.group.add(buildFortifications(forts, this.fortMaterials(), (x, y, z, castle) => this.towerFlag(x, y, z, castle)));
      if (medieval.ready) this.wallBanners(bannerSpots(forts, { x: this.zone.w / 2, y: this.zone.h / 2 }));
    }
    if (village.ready) {
      // a cidade inteira em um BatchedMesh por material
      const placements = [], props = [], meta = {};
      for (const st of houses) village.place(villagePlan(st), village.baseMatrix(st), placements, props, st, meta);
      if (placements.length) { this.cityGroup = village.batch(placements); this.group.add(this.cityGroup); }
      // móveis são sólidos para o jogador (só no cliente: o servidor só cuida das paredes e do vão da porta)
      for (const b of meta.colliders || []) addBlocker(this.zone.map, b[0], b[1], b[2], b[3]);
      // fogo das lareiras: sprites que só aparecem perto do jogador
      this.hearthFlames = (meta.flames || []).map((v) => this.addFlame(v.x, v.y, v.z, 0xff9a3c, 1.05, true));
      if (props.length) { this.propGroup = village.propMeshes(props); this.group.add(this.propGroup); this.cull(this.terrain.map ? this.zone.w / 2 : 0, this.zone.h / 2, true); }
      for (const st of houses) if (st.label) this.group.add(this.facing(st, (W, D) => this.signboard(st.label, -W / 2 + 1.1, D / 2 + 0.15)));
    } else {
      houses.forEach((st, i) => this.group.add(this.facing(st, (W, D) => {
        const local = { ...st, x: -W / 2, y: -D / 2, w: W, h: D };
        return medieval.ready ? this.packHouse(local, i) : this.house(local);
      })));
    }
  }

  // Monta algo no referencial da fachada (largura W, profundidade D, frente para +Z) e gira para st.face
  facing(st, fn) {
    const side = st.face === 'e' || st.face === 'w';
    const W = side ? st.h : st.w, D = side ? st.w : st.h;
    const g = new THREE.Group();
    g.add(fn(W, D));
    g.rotation.y = { s: 0, n: Math.PI, e: Math.PI / 2, w: -Math.PI / 2 }[st.face || 's'];
    g.position.set(st.x + st.w / 2, 0, st.y + st.h / 2);
    return g;
  }

  fortMaterials() {
    if (village.ready) {
      return {
        stone: village.mats.UnevenBrick, roof: village.mats.RoundTiles,
        trim: lite(new THREE.MeshStandardMaterial({ map: village.mats.Brick.map, normalMap: village.mats.Brick.normalMap, color: 0xb8b2a8, roughness: 0.95 })),
        iron: lite(new THREE.MeshStandardMaterial({ color: 0x2b2a2e, roughness: 0.5, metalness: 0.6 })),
      };
    }
    return {
      stone: new THREE.MeshStandardMaterial({ color: 0x8f877c, roughness: 1 }),
      trim: new THREE.MeshStandardMaterial({ color: 0xa69e92, roughness: 1 }),
      roof: new THREE.MeshStandardMaterial({ color: 0xa8432e, roughness: 0.9 }),
      iron: new THREE.MeshStandardMaterial({ color: 0x2b2a2e, roughness: 0.5, metalness: 0.6 }),
    };
  }

  // Estandartes e escudos pendurados nas muralhas (KayKit Dungeon), instanciados por modelo
  wallBanners(spots) {
    const groups = new Map();
    for (const sp of spots) {
      const name = sp.castle ? ['banner_triple_blue', 'banner_shield_blue', 'sword_shield', 'banner_patternA_blue'][sp.i % 4] : ['banner_patternC_red', 'banner_shield_red'][sp.i % 2];
      if (!medieval.has(name)) continue;
      if (!groups.has(name)) groups.set(name, []);
      groups.get(name).push(sp);
    }
    const mtx = new THREE.Matrix4();
    const up = new THREE.Vector3(0, 1, 0);
    for (const [name, list] of groups) {
      const shield = name.startsWith('sword');
      const s = medieval.fit(name, null, null, shield ? 1.0 : 2.3);
      const box = medieval.geo(name).boundingBox;
      const inst = new THREE.InstancedMesh(medieval.geo(name), medieval.mat(name), list.length);
      list.forEach((sp, i) => {
        // topo logo abaixo das ameias, encostado na face da muralha
        const y = (shield ? WALL_H - 1.9 : WALL_H - 0.3 - (box.max.y - box.min.y) * s) - box.min.y * s;
        const off = -box.min.z * s;
        const fx = Math.sin(sp.rot), fz = Math.cos(sp.rot);
        mtx.compose(_v.set(sp.x + fx * off, y, sp.z + fz * off), _q.setFromAxisAngle(up, sp.rot), _s.set(s, s, s));
        inst.setMatrixAt(i, mtx);
      });
      inst.castShadow = true;
      inst.receiveShadow = true;
      this.addInst(inst);
    }
  }

  // bandeira no topo das torres (azul no castelo, vermelha nas muralhas)
  towerFlag(x, y, z, castle) {
    const name = castle ? 'flag_blue' : 'flag_red';
    if (!medieval.has(name)) return;
    const box = medieval.geo(name).boundingBox;
    const s = medieval.fit(name, null, null, 1.7);
    const m = medieval.mesh(name, s);
    m.position.set(x - (box.min.x + box.max.x) / 2 * s, y - 0.25, z - (box.min.z + box.max.z) / 2 * s);
    this.group.add(m);
  }

  // Construção com modelos do pack, encaixada no retângulo do mapa (a frente/porta fica para +Z)
  packHouse(st, index) {
    const g = new THREE.Group();
    const W = st.w, D = st.h;
    for (const it of structurePlan(st, index)) {
      if (!medieval.has(it.m)) continue;
      const size = medieval.size(it.m);
      const box = medieval.geo(it.m).boundingBox;
      const k = medieval.fit(it.m, it.w, it.d, it.h);
      // leve esticamento horizontal para preencher melhor o terreno
      const st2 = it.stretch || 1;
      const sx = it.w ? Math.min(it.w / size.x, k * st2) : k;
      const sz = it.d ? Math.min(it.d / size.z, k * st2) : k;
      const sy = Math.min((sx + sz) / 2, it.h ? it.h / size.y : Infinity);
      const mesh = new THREE.Mesh(medieval.geo(it.m), medieval.mat(it.m));
      mesh.scale.set(sx, sy, sz);
      mesh.position.set(it.x - (box.min.x + box.max.x) / 2 * sx, -box.min.y * sy, it.z - (box.min.z + box.max.z) / 2 * sz);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      g.add(mesh);
    }
    if (st.label) g.add(this.signboard(st.label, -W / 2 + 1.1, D / 2 + 0.15));
    g.position.set(st.x + W / 2, 0, st.y + D / 2);
    return g;
  }

  // Placa de madeira com o nome do lugar, apoiada em dois postes
  signboard(label, x, z) {
    const g = new THREE.Group();
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 128;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#4e342e'; ctx.fillRect(0, 0, 512, 128);
    ctx.fillStyle = '#8d6e63'; ctx.fillRect(10, 10, 492, 108);
    ctx.fillStyle = '#fdf2e9'; ctx.font = 'bold 50px Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, 256, 66, 480);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    const bw = 1.9, bh = bw * 128 / 512;
    const wood = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 1 });
    const board = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.06), [wood, wood, wood, wood, new THREE.MeshStandardMaterial({ map: tex }), wood]);
    board.position.y = 1.15;
    board.castShadow = true;
    g.add(board);
    for (const sx of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.3, 0.09), wood);
      post.position.set(sx * (bw / 2 - 0.12), 0.65, -0.05);
      post.castShadow = true;
      g.add(post);
    }
    g.position.set(x, 0, z);
    return g;
  }

  house(st) {
    const g = new THREE.Group();
    const W = st.w, D = st.h;
    const stone = st.kind === 'temple' || st.kind === 'bank';
    const wallH = st.kind === 'temple' ? 2.4 : 1.9;
    const wallMat = new THREE.MeshStandardMaterial({ color: stone ? 0xcfc8ba : 0xe2cfa8, roughness: 0.95, flatShading: true });
    const beamMat = new THREE.MeshStandardMaterial({ color: 0x6e4b2a, roughness: 1 });
    const roofMat = new THREE.MeshStandardMaterial({ color: st.roof || 0x8e3b2e, roughness: 0.9, flatShading: true });
    const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
    add(new THREE.BoxGeometry(W - 0.2, wallH, D - 0.2), wallMat, 0, wallH / 2, 0);
    if (!stone) {
      for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(new THREE.BoxGeometry(0.18, wallH, 0.18), beamMat, x * (W / 2 - 0.12), wallH / 2, z * (D / 2 - 0.12));
      add(new THREE.BoxGeometry(W - 0.1, 0.14, 0.08), beamMat, 0, wallH - 0.07, D / 2 - 0.08);
      add(new THREE.BoxGeometry(W - 0.1, 0.12, 0.08), beamMat, 0, wallH * 0.48, D / 2 - 0.08);
    } else {
      add(new THREE.BoxGeometry(W, 0.25, D), new THREE.MeshStandardMaterial({ color: 0xa69e8f }), 0, 0.12, 0);
    }
    // telhado de duas águas ao longo do eixo X
    const rh = Math.min(2.2, D * 0.32 + 0.5), ov = 0.35;
    const hw = W / 2 + ov, hd = D / 2 + ov;
    const v = [
      -hw, 0, hd, hw, 0, hd, hw, rh, 0, -hw, 0, hd, hw, rh, 0, -hw, rh, 0, // frente
      hw, 0, -hd, -hw, 0, -hd, -hw, rh, 0, hw, 0, -hd, -hw, rh, 0, hw, rh, 0, // fundo
    ];
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    rg.computeVertexNormals();
    const roof = new THREE.Mesh(rg, roofMat);
    roof.position.y = wallH;
    roof.castShadow = true;
    g.add(roof);
    // empenas com a cor da parede
    const gable = new THREE.BufferGeometry();
    gable.setAttribute('position', new THREE.Float32BufferAttribute([-W / 2 + 0.1, 0, D / 2 - 0.1, -W / 2 + 0.1, rh - 0.1, 0, -W / 2 + 0.1, 0, -D / 2 + 0.1, W / 2 - 0.1, 0, -D / 2 + 0.1, W / 2 - 0.1, rh - 0.1, 0, W / 2 - 0.1, 0, D / 2 - 0.1], 3));
    gable.computeVertexNormals();
    const gm = new THREE.Mesh(gable, wallMat);
    gm.position.y = wallH;
    g.add(gm);
    // porta, janelas e chaminé
    const doorW = st.kind === 'temple' ? 1.1 : 0.75;
    add(new THREE.BoxGeometry(doorW, 1.25, 0.12), new THREE.MeshStandardMaterial({ color: 0x5d4037 }), 0, 0.62, D / 2 - 0.06);
    add(new THREE.BoxGeometry(doorW + 0.2, 0.12, 0.16), beamMat, 0, 1.3, D / 2 - 0.06);
    for (let x = -W / 2 + 1; x <= W / 2 - 1; x += 1.8) {
      if (Math.abs(x) < doorW) continue;
      add(new THREE.BoxGeometry(0.55, 0.55, 0.1), this.windowMat, x, wallH * 0.62, D / 2 - 0.08);
    }
    for (let z = -D / 2 + 1.2; z <= D / 2 - 1.2; z += 2) {
      for (const sx of [-1, 1]) { const w = add(new THREE.BoxGeometry(0.1, 0.5, 0.5), this.windowMat, sx * (W / 2 - 0.08), wallH * 0.62, z); w.castShadow = false; }
    }
    if (st.kind !== 'temple' && st.kind !== 'bank') add(new THREE.BoxGeometry(0.4, 1.0, 0.4), new THREE.MeshStandardMaterial({ color: 0x7f6a5c }), W * 0.25, wallH + rh * 0.7, -D * 0.1);
    if (st.kind === 'temple') {
      add(new THREE.BoxGeometry(1.1, 1.6, 1.1), wallMat, 0, wallH + rh + 0.3, 0);
      add(new THREE.ConeGeometry(0.85, 1.2, 4), roofMat, 0, wallH + rh + 1.7, 0).rotation.y = Math.PI / 4;
      add(new THREE.SphereGeometry(0.18, 8, 6), new THREE.MeshStandardMaterial({ color: 0xf7dc6f, emissive: 0xf4d03f, emissiveIntensity: 0.6 }), 0, wallH + rh + 0.55, 0.58);
    }
    if (st.label) {
      const cv = document.createElement('canvas');
      cv.width = 512; cv.height = 96;
      const ctx = cv.getContext('2d');
      ctx.fillStyle = '#4e342e'; ctx.fillRect(0, 0, 512, 96);
      ctx.fillStyle = '#8d6e63'; ctx.fillRect(8, 8, 496, 80);
      ctx.fillStyle = '#fdf2e9'; ctx.font = 'bold 44px Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(st.label, 256, 50, 480);
      const tex = new THREE.CanvasTexture(cv);
      tex.colorSpace = THREE.SRGBColorSpace;
      const sw = Math.min(W - 0.4, 3.2);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(sw, sw * 96 / 512), new THREE.MeshStandardMaterial({ map: tex }));
      sign.position.set(0, 1.62, D / 2 + 0.02);
      g.add(sign);
    }
    g.position.set(st.x + W / 2, 0, st.y + D / 2);
    return g;
  }

  // Cada portal vira um altar de pedra com arco, runas e um cristal; começa apagado e acende quando o jogador o descobre
  buildAltars() {
    const z = this.zone, here = z.def.kingdom;
    z.def.portals.forEach((p, i) => {
      const border = !!ZONES[p.to] && ZONES[p.to].kingdom !== here;
      const altar = new Altar(p, here, border);
      altar.id = altarId(z.id, i);
      altar.group.position.set(p.x + p.w / 2, 0, p.y + p.h / 2);
      this.group.add(altar.group);
      for (const f of altar.flames) {
        const sp = this.addFlame(altar.group.position.x + f.x, f.y, altar.group.position.z + f.z, f.color, 0.8, true, f.core);
        altar.flameSprites = [...(altar.flameSprites || []), sp];
      }
      this.altars.push(altar);
    });
  }

  // ids dos altares que o jogador já descobriu (os outros ficam apagados); instant = sem animar
  setAltars(ids, instant = true) {
    for (const a of this.altars) a.setLit(ids.includes(a.id), instant);
  }

  update(t, darkness, sky, sunDir) {
    const dt = this._t === undefined ? 0 : Math.min(0.1, Math.max(0, t - this._t));
    this._t = t;
    if (this.farm && this.px !== undefined) this.farm.update(dt, t, this.px, this.pz, Math.max(10, quality().cullR * 1.8));
    for (const f of this.flames) {
      const u = f.userData;
      const k = u.flicker ? 1 + Math.sin(t * 12 + u.ph) * 0.12 + Math.sin(t * 7.3 + u.ph) * 0.08 : 1;
      f.scale.setScalar(u.base * k * (0.8 + darkness * 0.6));
      if (u.core) u.core.scale.y = k;
    }
    for (const a of this.altars) a.update(t, dt);
    this.windowMat.emissiveIntensity = darkness * 1.6;
    if (village.mats.WindowGlass) village.mats.WindowGlass.emissiveIntensity = darkness * 1.5;
    if (this.water) this.water.update(t, { dark: darkness, sky, sunDir });
    if (this.lavaMat) this.lavaMat.emissiveIntensity = 1.1 + Math.sin(t * 2) * 0.3;
  }

  // antes de desenhar o quadro: refaz o reflexo da água, se houver água na tela
  prepareWater(renderer, scene, camera) {
    if (this.water) this.water.prepare(renderer, scene, camera);
  }

  dispose() {
    if (this.water) this.water.dispose();
    this.group.traverse((o) => {
      // materiais e geometrias dos packs são compartilhados entre zonas: só os prédios unidos são descartados
      if (o.material?.userData?.shared) {
        if (o.isInstancedMesh || o.isBatchedMesh) o.dispose();
        if (o.geometry && !medieval.shared.has(o.geometry) && !voxel.shared.has(o.geometry)) o.geometry.dispose();
        return;
      }
      if (o.geometry && !objGeoCacheHas(o.geometry)) o.geometry.dispose();
      if (o.material) {
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of ms) {
          // texturas do pack de prédios são compartilhadas (a pedra das ameias reaproveita a do tijolo)
          if (m.map && m.map !== glowTex && !village.isSharedTexture(m.map)) m.map.dispose();
          if (m.normalMap && !village.isSharedTexture(m.normalMap)) m.normalMap.dispose();
          m.dispose();
        }
      }
    });
  }
}

function objGeoCacheHas(g) {
  for (const v of objGeoCache.values()) if (v === g) return true;
  return false;
}
