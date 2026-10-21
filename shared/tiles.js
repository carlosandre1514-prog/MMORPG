// Tipos de terreno (camada de chão) e objetos (camada superior).

export const T = {
  GRASS: 0, DIRT: 1, SAND: 2, WATER: 3, DEEP: 4, STONE: 5, WOOD: 6,
  CAVE: 7, ASH: 8, LAVA: 9, BRIDGE: 10, DARKGRASS: 11, CAVEWALL: 12,
  MUD: 13, COBBLE: 14, RUIN: 15, VOID: 16, ARENA: 17,
};

export const TILE_INFO = [];
TILE_INFO[T.GRASS] = { name: 'grama', walk: true };
TILE_INFO[T.DIRT] = { name: 'terra', walk: true };
TILE_INFO[T.SAND] = { name: 'areia', walk: true };
TILE_INFO[T.WATER] = { name: 'água', walk: false };
TILE_INFO[T.DEEP] = { name: 'água funda', walk: false };
TILE_INFO[T.STONE] = { name: 'pedra', walk: true };
TILE_INFO[T.WOOD] = { name: 'madeira', walk: true };
TILE_INFO[T.CAVE] = { name: 'caverna', walk: true };
TILE_INFO[T.ASH] = { name: 'cinzas', walk: true };
TILE_INFO[T.LAVA] = { name: 'lava', walk: false };
TILE_INFO[T.BRIDGE] = { name: 'ponte', walk: true };
TILE_INFO[T.DARKGRASS] = { name: 'grama escura', walk: true };
TILE_INFO[T.CAVEWALL] = { name: 'rocha', walk: false };
TILE_INFO[T.MUD] = { name: 'lama', walk: true };
TILE_INFO[T.COBBLE] = { name: 'calçamento', walk: true };
TILE_INFO[T.RUIN] = { name: 'piso antigo', walk: true };
TILE_INFO[T.VOID] = { name: 'vazio', walk: false };
TILE_INFO[T.ARENA] = { name: 'areia da arena', walk: true };

export const O = {
  NONE: 0, TREE: 1, PINE: 2, DEADTREE: 3, ROCK: 4, BUSH: 5, FLOWERS: 6,
  MUSHROOM: 7, CRYSTAL: 8, STALAG: 9, PILLAR: 10, BROKENPILLAR: 11,
  RUBBLE: 12, FENCE: 13, TORCH: 14, LAMP: 15, FOUNTAIN: 16, WELL: 17,
  BUILDING: 18, TENT: 19, SIGN: 20, BARREL: 21, CRATE: 22, GRAVE: 23,
  ALTAR: 24, STALL: 25, BONES: 26, WEB: 27, BIGTREE: 28, REEDS: 29,
  STATUE: 30, BANNER: 31, CART: 32, ORE: 33, BRAZIER: 34, HAY: 35,
  WALL: 36, TARGET: 37, RACK: 38, SACK: 39, LUMBER: 40,
  BARS: 41, CLOTH: 42, PLANKS: 43, BRICKS: 44, GOLD: 45,
};

// block: impede passagem; tall: desenhado ordenado por profundidade junto às entidades;
// light: raio de luz à noite (em tiles).
export const OBJ_INFO = [];
OBJ_INFO[O.NONE] = { block: false };
OBJ_INFO[O.TREE] = { block: true, tall: true };
OBJ_INFO[O.PINE] = { block: true, tall: true };
OBJ_INFO[O.DEADTREE] = { block: true, tall: true };
OBJ_INFO[O.ROCK] = { block: true, tall: true };
OBJ_INFO[O.BUSH] = { block: true, tall: true };
OBJ_INFO[O.FLOWERS] = { block: false };
OBJ_INFO[O.MUSHROOM] = { block: false };
OBJ_INFO[O.CRYSTAL] = { block: true, tall: true, light: 3 };
OBJ_INFO[O.STALAG] = { block: true, tall: true };
OBJ_INFO[O.PILLAR] = { block: true, tall: true };
OBJ_INFO[O.BROKENPILLAR] = { block: true, tall: true };
OBJ_INFO[O.RUBBLE] = { block: false };
OBJ_INFO[O.FENCE] = { block: true, tall: true };
OBJ_INFO[O.TORCH] = { block: true, tall: true, light: 5 };
OBJ_INFO[O.LAMP] = { block: true, tall: true, light: 6 };
OBJ_INFO[O.FOUNTAIN] = { block: true, tall: true };
OBJ_INFO[O.WELL] = { block: true, tall: true };
OBJ_INFO[O.BUILDING] = { block: true };
OBJ_INFO[O.TENT] = { block: true, tall: true };
OBJ_INFO[O.SIGN] = { block: true, tall: true };
OBJ_INFO[O.BARREL] = { block: true, tall: true };
OBJ_INFO[O.CRATE] = { block: true, tall: true };
OBJ_INFO[O.GRAVE] = { block: true, tall: true };
OBJ_INFO[O.ALTAR] = { block: true, tall: true, light: 4 };
OBJ_INFO[O.STALL] = { block: true, tall: true };
OBJ_INFO[O.BONES] = { block: false };
OBJ_INFO[O.WEB] = { block: false };
OBJ_INFO[O.BIGTREE] = { block: true, tall: true };
OBJ_INFO[O.REEDS] = { block: false };
OBJ_INFO[O.STATUE] = { block: true, tall: true };
OBJ_INFO[O.BANNER] = { block: true, tall: true };
OBJ_INFO[O.CART] = { block: true, tall: true };
OBJ_INFO[O.ORE] = { block: true, tall: true };
OBJ_INFO[O.BRAZIER] = { block: true, tall: true, light: 5 };
OBJ_INFO[O.HAY] = { block: true, tall: true };
// muralhas e torres: a forma 3D vem das estruturas do mapa (kind 'wall'/'tower')
OBJ_INFO[O.WALL] = { block: true };
OBJ_INFO[O.TARGET] = { block: true, tall: true };
OBJ_INFO[O.RACK] = { block: true, tall: true };
OBJ_INFO[O.SACK] = { block: true, tall: true };
OBJ_INFO[O.LUMBER] = { block: true, tall: true };
// mercadorias e tesouros (barras de metal, tecidos, tábuas, tijolos, ouro)
for (const o of [O.BARS, O.CLOTH, O.PLANKS, O.BRICKS, O.GOLD]) OBJ_INFO[o] = { block: true, tall: true };

export function encodeLayer(arr) {
  // Cada valor (0-90) vira um caractere imprimível.
  let s = '';
  for (let i = 0; i < arr.length; i++) s += String.fromCharCode(35 + arr[i]);
  return s;
}

export function decodeLayer(str) {
  const arr = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) arr[i] = str.charCodeAt(i) - 35;
  return arr;
}

// Monta o objeto de mapa usado pela colisão a partir das camadas.
export function buildMap(w, h, tiles, objs, structures = []) {
  const block = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const ti = TILE_INFO[tiles[i]];
    const oi = OBJ_INFO[objs[i]];
    block[i] = (!ti || !ti.walk || (oi && oi.block)) ? 1 : 0;
  }
  return { w, h, tiles, objs, block, structures };
}
