// Interiores das casas: pisos de madeira ou pedra em cada andar e móveis dos packs KayKit Dungeon, RPG Tools Bits
// e Fantasy Weapons Bits. Tudo no referencial da construção (centro na origem, frente para +Z, centímetros),
// o mesmo usado por village.js. Ninguém entra nas casas, mas a câmera passa por dentro e o chão não pode ser grama.
import { medieval } from './medieval.js';

const mulberry = (a) => () => {
  a |= 0; a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const INSET = 62; // da face da parede interna ao primeiro móvel (a parede entra ~31 cm no vão)
// Os móveis do pack são grandes demais para os personagens (1,45 m): escala única para a mobília
const FURN = 0.7;
const TABLE_TOP = Math.round(101 * FURN);

// Tamanho nativo de um modelo no referencial dos móveis (cm nos packs Dungeon; os demais packs usam `h`)
function sizeOf(name, h) {
  const s = medieval.size(name);
  const k = h ? h / s.y : FURN;
  return { w: s.x * k, d: s.z * k, h: s.y * k, k };
}

class Room {
  constructor(hx, hz, rnd) { this.hx = hx; this.hz = hz; this.rnd = rnd; this.props = []; }

  put(m, x, y, z, rot = 0, opts = {}) {
    if (!medieval.has(m)) return null;
    const z0 = sizeOf(m, opts.h);
    this.props.push({ m, x, y, z, rot, k: z0.k, lay: !!opts.lay, tilt: opts.tilt || 0 });
    return z0;
  }

  // Fileira de móveis encostados numa parede. wall: 'back' | 'left' | 'right'. start/end: trecho útil em cm.
  row(wall, items, start, end) {
    let cur = start;
    for (const it of items) {
      if (!medieval.has(it.m)) continue;
      const sz = sizeOf(it.m, it.h);
      const gap = it.gap ?? 14;
      if (cur + sz.w > end) break;
      const along = cur + sz.w / 2;
      const depth = INSET + sz.d / 2;
      let x, z, rot;
      if (wall === 'back') { x = along; z = -this.hz + depth; rot = 0; }
      else if (wall === 'left') { x = -this.hx + depth; z = along; rot = Math.PI / 2; }
      else { x = this.hx - depth; z = along; rot = -Math.PI / 2; }
      this.props.push({ m: it.m, x, y: it.y || 0, z, rot, k: sz.k, tilt: 0, lay: false });
      for (const on of it.on || []) this.onTop(on, x, z, rot, sz.h);
      cur += sz.w + gap;
    }
    return cur;
  }

  // objeto sobre um móvel, deslocado do centro dele (dx ao longo da peça, dz para a frente)
  onTop(on, cx, cz, rot, top) {
    const c = Math.cos(rot), s = Math.sin(rot);
    const dx = on.dx || 0, dz = on.dz || 0;
    this.put(on.m, cx + dx * c + dz * s, (on.y ?? top) + 1, cz - dx * s + dz * c, rot + (on.rot || 0), { h: on.h, lay: on.lay, tilt: on.tilt });
  }

  // mesa no centro com cadeiras e objetos
  tableSet(name, x, z, { chairs = 2, on = [], stool = false } = {}) {
    if (!medieval.has(name)) return;
    const sz = this.put(name, x, 0, z, 0);
    const chair = stool ? 'stool' : 'chair';
    const cs = medieval.has(chair) ? sizeOf(chair) : { d: 75 };
    for (let i = 0; i < chairs; i++) {
      const north = i % 2 === 0;
      const dz = (sz.d / 2 + cs.d / 2 - 6) * (north ? -1 : 1);
      const dx = chairs > 2 ? (i < 2 ? -sz.w / 4 : sz.w / 4) : 0;
      this.put(chair, x + dx, 0, z + dz, north ? 0 : Math.PI);
    }
    for (const o of on) this.onTop(o, x, z, 0, (o.y ?? TABLE_TOP) - 1);
    return sz;
  }
}

const sw = (m, h, extra = {}) => ({ m, h, ...extra });

// Conjuntos prontos de móveis por tema ---------------------------------------------------------
const BED = ['bed_frame', 'bed_decorated'];
const SHELVES = ['shelves', 'shelf_large'];
const CHESTS = ['trunk_medium_A', 'trunk_small_A', 'chest', 'box_large'];
const BARRELS = ['barrel_small', 'barrel_large', 'barrel_small_stack'];
const bottlesOn = (rnd) => [
  { m: 'bottle_A_green', dx: -30, dz: 5 }, { m: 'bottle_B_brown', dx: 5, dz: -10 }, rnd() < 0.5 ? { m: 'candle_thin_lit', dx: 40, dz: 8 } : { m: 'bottle_C_green', dx: 40, dz: 5 },
];

const THEMES = {
  house(r, room, spec, f) {
    const { hx, hz } = room;
    if (f === 0) {
      room.row('back', [{ m: r() < 0.6 ? 'shelves' : 'shelf_large' }, { m: pick(r, ['chest', 'trunk_medium_A']) }], -hx, hx);
      room.row('left', [{ m: pick(r, BED) }, { m: 'barrel_small' }], -hz + 100, hz - 60);
      room.row('right', [{ m: pick(r, CHESTS) }, { m: 'shelf_small_candles', y: 0 }], -hz + 140, hz - 120);
      if (hx >= 120 && hz >= 190) room.tableSet(pick(r, ['table_small_decorated_A', 'table_medium']), 20, 40, { chairs: hx >= 160 ? 2 : 1, on: [{ m: 'candle_lit', dx: -20 }, { m: 'plate_food_A', dx: 25, y: TABLE_TOP }] });
    } else {
      room.row('back', [{ m: pick(r, BED) }, { m: 'trunk_medium_A' }], -hx, hx);
      room.row('left', [{ m: pick(r, SHELVES) }], -hz + 90, hz - 90);
      room.row('right', [{ m: pick(r, BED) }, { m: 'chest' }], -hz + 120, hz - 100);
      if (hx >= 130) room.tableSet('table_small', 10, 60, { chairs: 1, on: [{ m: 'candle_thin_lit' }, { m: 'journal_closed', dx: 22, h: 14, lay: false }] });
    }
  },
  smithy(r, room, spec, f) {
    const { hx, hz } = room;
    if (f > 0) return THEMES.house(r, room, spec, f);
    room.row('back', [{ m: 'shelves' }, { m: 'sword_shield', y: 120, h: 0, gap: 20 }, { m: 'barrel_small', gap: 30 }], -hx, hx);
    room.row('left', [{ m: 'table_long_tablecloth', gap: 20 }], -hz + 130, hz - 60);
    room.row('right', [{ m: 'barrel_small_stack' }, { m: 'crates_stacked' }], -hz + 140, hz - 60);
    // bigorna no meio, pedra de amolar perto da parede e ferramentas
    room.put('anvil', 20, 0, 20, 0.4, { h: 62 });
    room.put('hammer', 20 + 8, 62, 20, 1.2, { h: 34, lay: true });
    room.put('grindstone', hx - 80, 0, hz - 70, -Math.PI / 2, { h: 90 });
    room.put('bucket_metal', 80, 0, 90, 0, { h: 40 });
    room.put('torch_mounted', -hx + 36, 150, 0, Math.PI / 2);
    if (medieval.has('sword_B')) { room.put('sword_B', -hx + 90, 78, -80, 0.3, { h: 80, lay: true }); room.put('tongs', -hx + 80, 100, 0, 1.0, { h: 30, lay: true }); }
  },
  alchemy(r, room, spec, f) {
    const { hx, hz } = room;
    if (f > 0) return THEMES.house(r, room, spec, f);
    room.row('back', [{ m: 'shelves', on: [] }, { m: 'shelf_small_candles' }, { m: 'barrel_small' }], -hx, hx);
    room.row('left', [{ m: 'shelf_large' }, { m: 'chest' }], -hz + 40, hz - 90);
    room.row('right', [{ m: 'table_medium_decorated_A', gap: 20 }], -hz + 160, hz - 100);
    room.tableSet('table_small', 10, 50, { chairs: 1, on: [...bottlesOn(r), { m: 'journal_open', dx: 0, dz: 22, h: 14 }] });
    for (let i = 0; i < 4; i++) room.put(['bottle_A_green', 'bottle_B_brown', 'bottle_C_green', 'bottle_A_labeled_brown'][i], -hx + 130 + i * 35, 0, -hz + 62 + 40, i, { h: 0 });
  },
  tavern(r, room, spec, f) {
    const { hx, hz } = room;
    if (f > 0) return THEMES.house(r, room, spec, f);
    room.row('back', [{ m: 'keg_decorated', gap: 30 }, { m: 'barrel_large_decorated', gap: 30 }, { m: 'shelves' }, { m: 'barrel_small_stack' }], -hx, hx);
    room.row('left', [{ m: 'table_long_decorated_A' }], -hz + 160, hz - 90);
    // mesas postas com bancos
    const n = Math.max(1, Math.floor((hx * 2 - 200) / 230));
    for (let i = 0; i < n; i++) {
      room.tableSet(i % 2 ? 'table_medium_tablecloth_decorated_B' : 'table_medium_decorated_A', -hx + 230 + i * 230, 40, { chairs: 2, stool: true, on: [{ m: 'candle_lit', dx: -25 }, { m: 'bottle_A_green', dx: 30, dz: 10 }] });
    }
    room.put('torch_mounted', hx - 36, 150, 0, -Math.PI / 2);
  },
  bank(r, room, spec, f) {
    const { hx, hz } = room;
    if (f > 0) return THEMES.house(r, room, spec, f);
    room.row('back', [{ m: 'chest_gold' }, { m: 'trunk_large_A' }, { m: 'chest_gold' }, { m: 'coin_stack_large' }], -hx, hx);
    room.row('left', [{ m: 'chest' }, { m: 'chest_gold' }], -hz + 60, hz - 90);
    room.row('right', [{ m: 'shelves' }, { m: 'box_large' }], -hz + 100, hz - 90);
    room.tableSet('table_medium_decorated_A', 10, 20, { chairs: 2, on: [{ m: 'keyring_hanging', dx: 0, h: 0 }, { m: 'coin_stack_small', dx: 40 }, { m: 'candle_lit', dx: -40 }] });
  },
  keep(r, room, spec, f) {
    const { hx, hz } = room;
    if (f === 0) {
      room.row('back', [{ m: 'banner_blue', y: 0 }, { m: 'shelf_large' }, { m: 'banner_blue' }], -hx, hx);
      room.row('left', [{ m: 'chest_gold' }, { m: 'barrel_large_decorated' }], -hz + 60, hz - 220);
      room.row('right', [{ m: 'chest' }, { m: 'sword_shield', y: 90 }], -hz + 60, hz - 220);
      room.tableSet('table_long_decorated_A', 0, 20, { chairs: 4, on: [{ m: 'candle_lit', dx: -60 }, { m: 'candle_lit', dx: 60 }, { m: 'plate_food_A', dx: 0, dz: 20 }, { m: 'journal_open', dx: 90, h: 14 }] });
    } else {
      room.row('back', [{ m: 'bed_decorated' }, { m: 'chest' }, { m: 'shelves' }], -hx, hx);
      room.row('left', [{ m: 'trunk_medium_A' }], -hz + 60, hz - 80);
      room.row('right', [{ m: 'bed_frame' }, { m: 'shelf_small_candles' }], -hz + 60, hz - 80);
      if (hx >= 200) room.tableSet('table_medium_decorated_A', 0, 90, { chairs: 2, on: [{ m: 'journal_open', dx: 0, h: 14 }, { m: 'candle_thin_lit', dx: 40 }, { m: 'compass_base', dx: -40, h: 10 }] });
    }
  },
  barracks(r, room, spec, f) {
    const { hx, hz } = room;
    room.row('back', [{ m: 'bed_frame' }, { m: 'bed_frame' }, { m: 'bed_frame' }, { m: 'bed_frame' }], -hx, hx);
    room.row('left', [{ m: 'bed_frame' }, { m: 'chest' }, { m: 'bed_frame' }], -hz + 60, hz - 60);
    room.row('right', [{ m: 'shelves' }, { m: 'crates_stacked' }, { m: 'box_large' }], -hz + 100, hz - 80);
    if (f === 0 && hx >= 130) room.tableSet('table_medium', 10, 20, { chairs: 2, stool: true, on: [{ m: 'candle_lit' }, { m: 'plate_stack', dx: 40 }] });
    room.put('sword_shield', hx - 36, 110, 0, -Math.PI / 2);
  },
  armory(r, room, spec, f) {
    const { hx, hz } = room;
    room.row('back', [{ m: 'shelves' }, { m: 'crates_stacked' }, { m: 'shelves' }], -hx, hx);
    room.row('left', [{ m: 'box_large' }, { m: 'sword_shield', y: 100 }], -hz + 40, hz - 90);
    room.row('right', [{ m: 'barrel_small_stack' }, { m: 'chest' }], -hz + 100, hz - 90);
    // armas penduradas e encostadas
    const set = [['sword_C', 140, 0.15], ['axe_B', 100, -0.1], ['spear_A', 190, 0.05], ['halberd', 200, 0.0], ['shield_B', 70, 0]];
    set.forEach(([m, h, tilt], i) => room.put(m, -hx + 100 + i * 52, 0, -hz + 70, 0, { h, tilt }));
    room.put('torch_mounted', 0, 150, hz - 36, Math.PI);
  },
  guardhouse(r, room, spec, f) { return THEMES.barracks(r, room, spec, f); },
  chapel(r, room, spec, f) {
    const { hx, hz } = room;
    if (f > 0) return THEMES.house(r, room, spec, f);
    room.row('back', [{ m: 'candle_triple', gap: 40 }, { m: 'table_medium_decorated_A', gap: 40 }, { m: 'candle_triple' }], -hx, hx);
    // bancos em duas colunas (mesas longas servem de bancos)
    for (let i = 0; i < 3; i++) {
      room.put('table_long_tablecloth', -hx / 2, 0, -hz + 330 + i * 190, Math.PI / 2, { h: 0 });
      room.put('table_long_tablecloth', hx / 2, 0, -hz + 330 + i * 190, Math.PI / 2, { h: 0 });
    }
    room.put('banner_blue', -hx + 50, 0, 0, Math.PI / 2);
    room.put('banner_blue', hx - 50, 0, 0, -Math.PI / 2);
    room.put('journal_open', 0, 102, -hz + 120, 0, { h: 14 });
  },
};
const MARKET_THEME = null;

function pick(r, list) { return list[Math.floor(r() * list.length) % list.length]; }

// Devolve { floorPieces: [nome por andar], props: [{ m, x, y, z, rot, k, lay, tilt }] } no referencial da construção
export function interiorFor(spec, st) {
  const rnd = mulberry((spec.seed || 1) * 7919 + 3);
  const W = spec.nx * 200, D = spec.nz * 200;
  const hx = W / 2 - INSET, hz = D / 2 - INSET;
  const props = [];
  const floorPieces = spec.floors.map((style, f) => {
    if (spec.market || hx < 40 || hz < 40) return null;
    const type = st.type || 'house';
    const room = new Room(hx, hz, rnd);
    const theme = (THEMES[type] || THEMES.house);
    // espaços muito pequenos ou torres não recebem mobília
    if (!/tower/.test(type)) theme(rnd, room, spec, f);
    for (const p of room.props) props.push({ ...p, y: p.y + f * 300 + 3 });
    if (type === 'tavern' || type === 'bank' || type === 'keep' || type === 'chapel') return f === 0 ? 'Floor_UnevenBrick' : 'Floor_WoodDark';
    if (type === 'smithy' || type === 'armory') return 'Floor_UnevenBrick';
    if (f === 0 && style === 'stone') return rnd() < 0.5 ? 'Floor_WoodDark' : 'Floor_UnevenBrick';
    return rnd() < 0.5 ? 'Floor_WoodLight' : 'Floor_WoodDark';
  });
  void MARKET_THEME;
  return { floorPieces, props };
}
