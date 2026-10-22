// Interiores das casas: pisos, mobília e decoração de cada andar. Tudo no referencial da construção (centro na
// origem, frente/porta para +Z, centímetros), o mesmo usado por village.js. O térreo é visitável: o jogador entra pela
// porta, então os móveis ficam encostados nas paredes, o caminho da porta fica livre e cada móvel de chão devolve
// uma caixa de colisão. Móveis dos packs KayKit (Dungeon, RPG Tools Bits, Fantasy Weapons Bits); lareira, tapetes,
// bancos de igreja, balcão, estante de livros e armário foram montados em decor.js.
import { medieval } from './medieval.js';

const mulberry = (a) => () => {
  a |= 0; a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const WALL_IN = 31.4; // da linha do módulo à face interna da parede (cm)
const GAP = 3; // folga entre o móvel e a parede
// Os móveis do pack são grandes demais para os personagens (1,45 m): escala única para a mobília
const FURN = 0.7;
const TABLE_TOP = Math.round(100 * FURN); // altura do tampo das mesas simples
const PI = Math.PI;

// Peças montadas em decor.js: footprint (w × d) e deslocamento do centro até a origem da peça, ao longo de +Z
const DECOR = {
  Hearth: { w: 170, d: 66, h: 296, oz: 33, back: true },
  Bookcase: { w: 120, d: 34, h: 205, oz: 17, back: true },
  Cupboard: { w: 110, d: 48, h: 100, oz: 24, back: true },
  Pew: { w: 200, d: 40, h: 110, oz: 0 },
  Counter: { w: 208, d: 64, h: 100, oz: 0 },
};

// Altura (cm) dos modelos dos outros packs, que vêm em metros e não em centímetros como os do Dungeon
const DEFAULT_H = {
  anvil: 66, grindstone: 90, hammer: 34, tongs: 36, pickaxe: 80, shovel: 110, saw: 40, handplane: 14, mallet: 32, lantern: 34, rope_bundle_A: 14, rope_bundle_B: 12,
  bucket_metal: 38, file: 28, chisel: 26, axe: 55, journal_open: 14, journal_closed: 16, compass_base: 10, magnifying_glass: 24, knife: 26, scissors: 22, torch: 60,
  wrench_A: 26, drafting_compass: 22, trowel: 28, handdrill: 30, screwdriver_A_long: 24,
  sword_A: 92, sword_B: 86, sword_C: 90, sword_D: 100, sword_E: 96, axe_A: 70, axe_B: 78, axe_C: 74, hammer_A: 70, hammer_B: 74, hammer_C: 78, spear_A: 170, halberd: 180,
  shield_A: 64, shield_B: 62, shield_C: 66, dagger_A: 32, dagger_B: 34, staff_A: 150, staff_B: 160, bow_A_withString: 110, bow_B_withString: 118, wand_A: 38, arrow_A: 70,
  Iron_Bars_Stack_Small: 26, Iron_Bars_Stack_Medium: 52, Gold_Bars_Stack_Small: 26, Gold_Bars_Stack_Medium: 52, Gold_Bars: 28, Copper_Bars_Stack_Small: 26, Silver_Bars_Stack_Small: 26,
  Wood_Log_Stack: 46, Wood_Planks_Stack_Small: 20, Wood_Planks_Stack_Medium: 34, Textiles_Stack_Small: 40, Textiles_Stack_Large_Colored: 46, Textiles_A: 18, Stone_Bricks_Stack_Small: 22,
  weaponrack: 120, bucket_water: 40, bucket_arrows: 62, sack: 55, crate_A_small: 45, crate_A_big: 62, crate_open: 52, wheelbarrow: 60, ladder: 200, barrel: 78, resource_lumber: 40,
};

// Tamanho nativo de um modelo no referencial dos móveis (cm nos packs Dungeon; os demais packs usam `h`)
function sizeOf(name, h) {
  h = h || DEFAULT_H[name];
  if (DECOR[name]) { const d = DECOR[name]; return { w: d.w, d: d.d, h: d.h, k: 1, decor: d }; }
  const s = medieval.size(name);
  const k = h ? h / s.y : FURN;
  return { w: s.x * k, d: s.z * k, h: s.y * k, k };
}
const has = (m) => !!DECOR[m] || medieval.has(m);

class Room {
  // W × D: tamanho do prédio nos módulos (cm); doorX: centro da porta na fachada (cm)
  constructor(W, D, rnd, doorX) {
    this.IX = W / 2 - WALL_IN; this.IZ = D / 2 - WALL_IN; this.rnd = rnd;
    this.props = []; this.decor = []; this.occ = []; this.flames = []; this.rejects = [];
    // entrada: o vão da porta e dois metros à frente dele ficam livres
    this.doorX = doorX;
    this.keep = [[doorX - 95, this.IZ - 165, doorX + 95, this.IZ + 40]];
  }

  box(cx, cz, w, d, rot) {
    const q = Math.abs(Math.sin(rot)) > 0.7;
    const hw = (q ? d : w) / 2, hd = (q ? w : d) / 2;
    return [cx - hw, cz - hd, cx + hw, cz + hd];
  }

  free(b, pad = 0) {
    const m = 2;
    if (b[0] < -this.IX + m - 4 || b[2] > this.IX - m + 4 || b[1] < -this.IZ + m - 4 || b[3] > this.IZ - m + 4) return false;
    for (const k of this.keep) if (b[0] < k[2] + pad && b[2] > k[0] - pad && b[1] < k[3] + pad && b[3] > k[1] - pad) return false;
    for (const o of this.occ) if (b[0] < o[2] - 3 + 0 && b[2] > o[0] + 3 && b[1] < o[3] - 3 && b[3] > o[1] + 3) return false;
    return true;
  }

  // Móvel de chão no centro (cx, cz). Devolve o objeto colocado ou null se não coube.
  put(m, cx, cz, rot = 0, opts = {}) {
    if (!has(m)) return null;
    const sz = sizeOf(m, opts.h);
    const b = this.box(cx, cz, sz.w, sz.d, rot);
    if (!opts.free && !this.free(b)) { if (!opts.quiet) this.rejects.push(`${m}@${Math.round(cx)},${Math.round(cz)}`); return null; }
    const out = { m, x: cx, z: cz, rot, w: sz.w, d: sz.d, h: sz.h, k: sz.k, box: b };
    if (sz.decor) {
      const o = sz.decor;
      this.decor.push({ name: m, x: cx - Math.sin(rot) * o.oz, z: cz - Math.cos(rot) * o.oz, y: opts.y || 0, rot, s: opts.s || null, box: o.nosolid ? null : b });
      if (m === 'Hearth') this.flames.push({ x: cx - Math.sin(rot) * (o.oz - 10), y: 34, z: cz - Math.cos(rot) * (o.oz - 10) });
    } else {
      const solid = !opts.y && !opts.lay && sz.h >= 30 && !opts.soft;
      this.props.push({ m, x: cx, y: opts.y || 0, z: cz, rot, k: sz.k, lay: !!opts.lay, tilt: opts.tilt || 0, box: solid ? b : null });
    }
    if (!opts.free) this.occ.push(b);
    return out;
  }

  // Encostado numa parede ('back' | 'front' | 'left' | 'right'), no ponto t ao longo dela. along: lado comprido junto à parede.
  at(wall, t, m, opts = {}) {
    if (!has(m)) return null;
    const sz = sizeOf(m, opts.h);
    const along = opts.along && !sz.decor; // as peças de decoração já nascem com as costas para a parede
    const dep = along ? sz.w : sz.d; // profundidade em relação à parede
    const gap = opts.gap0 ?? GAP;
    const turn = along ? (opts.flip ? PI / 2 : -PI / 2) : 0;
    let x, z, rot;
    switch (wall) {
      case 'back': x = t; z = -this.IZ + gap + dep / 2; rot = 0; break;
      case 'front': x = t; z = this.IZ - gap - dep / 2; rot = PI; break;
      case 'left': x = -this.IX + gap + dep / 2; z = t; rot = PI / 2; break;
      default: x = this.IX - gap - dep / 2; z = t; rot = -PI / 2;
    }
    const r = this.put(m, x, z, rot + turn, opts);
    if (r) for (const on of opts.on || []) this.onTop(on, r.x, r.z, r.rot, opts.y ? opts.y + r.h : r.h);
    return r;
  }

  // Pendurado na parede, a y cm do chão (não ocupa o chão)
  hang(wall, t, m, y, opts = {}) {
    if (!has(m)) return null;
    const sz = sizeOf(m, opts.h);
    const gap = opts.gap0 ?? 1;
    let x, z, rot;
    switch (wall) {
      case 'back': x = t; z = -this.IZ + gap + sz.d / 2; rot = 0; break;
      case 'front': x = t; z = this.IZ - gap - sz.d / 2; rot = PI; break;
      case 'left': x = -this.IX + gap + sz.d / 2; z = t; rot = PI / 2; break;
      default: x = this.IX - gap - sz.d / 2; z = t; rot = -PI / 2;
    }
    // nada sobre o vão da porta
    if (wall === 'front' && Math.abs(x - this.doorX) < 70 + sz.w / 2) return null;
    const r = this.put(m, x, z, rot, { ...opts, free: true, y });
    if (r) for (const on of opts.on || []) this.onTop(on, r.x, r.z, r.rot, y + (opts.top ?? 6));
    return r;
  }

  // Fila sequencial encostada numa parede; os itens que não cabem são pulados
  line(wall, items, { from, to, gap = 10 } = {}) {
    const T = wall === 'back' || wall === 'front' ? this.IX : this.IZ;
    let cur = from ?? -T + 2;
    const end = to ?? T - 2;
    const placed = [];
    for (const it of items) {
      if (!it || !has(it.m)) continue;
      const sz = sizeOf(it.m, it.h);
      const wd = it.along && !sz.decor ? sz.d : sz.w; // largura ao longo da parede
      let t = cur + wd / 2, r = null;
      while (t + wd / 2 <= end + 0.5) {
        r = this.at(wall, t, it.m, { ...it, quiet: true });
        if (r) break;
        t += 6;
      }
      if (!r) { this.rejects.push(`${it.m} (fila ${wall})`); continue; }
      cur = t + wd / 2 + (it.gap ?? gap);
      placed.push(r);
    }
    return placed;
  }

  // objeto sobre um móvel: deslocado do centro dele (dx ao longo da peça, dz para a frente)
  onTop(on, cx, cz, rot, top) {
    if (!has(on.m)) return;
    const c = Math.cos(rot), s = Math.sin(rot);
    const dx = on.dx || 0, dz = on.dz || 0;
    this.put(on.m, cx + dx * c + dz * s, cz - dx * s + dz * c, rot + (on.rot || 0), { h: on.h, lay: on.lay, tilt: on.tilt, free: true, y: (on.y ?? top) + 1, soft: true });
  }

  // Mesa com cadeiras (ou bancos) ao redor; devolve null se não couber. orient 0: mesa mais larga em X.
  tableSet(name, cx, cz, { chairs = 2, stool = false, rot = 0, on = [], skip = [], chairModel } = {}) {
    if (!has(name)) return null;
    const sz = sizeOf(name);
    const chair = chairModel || (stool ? 'stool' : 'chair');
    const cs = has(chair) ? sizeOf(chair) : { w: 52, d: 52 };
    const ex = Math.abs(Math.sin(rot)) > 0.7 ? sz.d : sz.w, ez = Math.abs(Math.sin(rot)) > 0.7 ? sz.w : sz.d;
    const alongX = ex >= ez; // cadeiras nos lados compridos
    const per = Math.max(1, Math.ceil(chairs / 2));
    const len = alongX ? ex : ez, wid = alongX ? ez : ex;
    const reach = wid / 2 + cs.d - 14;
    const bb = alongX ? [cx - len / 2, cz - reach, cx + len / 2, cz + reach] : [cx - reach, cz - len / 2, cx + reach, cz + len / 2];
    if (!this.free(bb)) { this.rejects.push(`tableSet ${name}@${Math.round(cx)},${Math.round(cz)}`); return null; }
    const t = this.put(name, cx, cz, rot, { free: true });
    this.occ.push(bb);
    this.props[this.props.length - 1].box = this.box(cx, cz, sz.w, sz.d, rot); // só a mesa bloqueia; as cadeiras são vazadas
    let n = 0;
    for (let side = 0; side < 2 && n < chairs; side++) {
      for (let i = 0; i < per && n < chairs; i++, n++) {
        const off = ((i + 0.5) / per - 0.5) * len * (per > 1 ? 0.78 : 0);
        const dist = wid / 2 + cs.d / 2 - 8;
        const sgn = side ? 1 : -1;
        if (skip.includes(n)) continue;
        if (alongX) this.put(chair, cx + off, cz + sgn * dist, side ? PI : 0, { free: true, soft: true });
        else this.put(chair, cx + sgn * dist, cz + off, side ? -PI / 2 : PI / 2, { free: true, soft: true });
      }
    }
    for (const o of on) this.onTop(o, cx, cz, rot, (o.y ?? TABLE_TOP) - 1);
    return t;
  }

  // Tenta mesas com cadeiras nos pontos candidatos até colocar `max`; devolve quantas coube
  tables(spots, max, make) {
    let n = 0;
    for (const [x, z] of spots) {
      if (n >= max) break;
      const o = make(n);
      if (this.tableSet(o.name, x, z, o)) n++;
    }
    return n;
  }

  rug(name, cx, cz, rot = 0, s = 1) {
    this.decor.push({ name, x: cx, z: cz, y: 0, rot, s: [s, 1, s], box: null });
  }
}

const pick = (r, list) => list[Math.floor(r() * list.length) % list.length];
const sw = (m, extra = {}) => ({ m, ...extra });

const BEDS = ['bed_frame', 'bed_decorated'];
const BOTTLES = ['bottle_A_green', 'bottle_B_brown', 'bottle_C_green', 'bottle_A_labeled_brown'];
const bottlesOn = (r) => [{ m: pick(r, BOTTLES), dx: -34, dz: 4 }, { m: pick(r, BOTTLES), dx: -4, dz: -6 }, r() < 0.5 ? { m: 'candle_thin_lit', dx: 30, dz: 6 } : { m: pick(r, BOTTLES), dx: 30, dz: 4 }];
const dinnerOn = (r) => [{ m: 'candle_lit', dx: -26 }, { m: 'plate_food_A', dx: 20, dz: 6 }, ...(r() < 0.5 ? [{ m: 'bottle_A_green', dx: 36, dz: -14 }] : [])];
const shelfBottles = (r, n = 3) => Array.from({ length: n }, (_, i) => ({ m: pick(r, BOTTLES), dx: -48 + i * (96 / Math.max(1, n - 1)), dz: 0 }));
// armas no suporte (em cm; dx ao longo do suporte, y altura)
const RACK_ARMS = [
  { m: 'sword_B', dx: -34, y: 42, dz: 3, tilt: 0.12 }, { m: 'axe_A', dx: 0, y: 48, dz: 3, tilt: -0.05 }, { m: 'spear_A', dx: 36, y: 14, dz: 0, tilt: 0.08 },
];

// Quarto: cama no canto do fundo ao longo de uma parede, baú no pé
function bedCorner(r, room, wall, { double = false, chest = true } = {}) {
  const model = double ? 'bed_decorated' : pick(r, BEDS);
  const bed = room.at(wall, -room.IZ + 4 + sizeOf(model).d / 2, model, { along: true, flip: wall === 'right', gap0: 2 });
  if (bed && chest) room.at(wall, -room.IZ + 4 + bed.d + 8 + 31, pick(r, ['trunk_medium_A', 'chest']), { gap0: 2 });
  return bed;
}

// Camas em fila ao longo de uma parede (quartel): cama, baú no pé, cama...
function bunks(r, room, wall, from, to, n) {
  let cur = from;
  for (let i = 0; i < n; i++) {
    const bed = room.at(wall, cur + 105, 'bed_frame', { along: true, flip: wall === 'right', gap0: 2 });
    if (!bed) break;
    cur += bed.d + 4;
    room.at(wall, cur + 24, 'trunk_small_A', { gap0: 2 });
    cur += 54;
  }
}

// Canto de dormir e de comer nas sobras de um salão grande (ferraria, alquimia...)
function living(r, room, wall) {
  bedCorner(r, room, wall, { chest: true });
  const sb = wall === 'left' ? 1 : -1;
  room.tables([[sb * (room.IX - 170), 90], [sb * (room.IX - 170), 40], [sb * (room.IX - 230), 120], [sb * (room.IX - 130), 140]], 1, () => ({ name: 'table_small', chairs: 2, stool: r() < 0.5, on: dinnerOn(r) }));
  room.at(wall === 'left' ? 'left' : 'right', room.IZ - 130, 'Cupboard', { on: [{ m: 'plate_stack', dx: -25, h: 22 }] });
  room.rug('Rug_' + pick(r, 'ABCD'), sb * (room.IX - 150), 70, 0, 0.9);
}

const THEMES = {
  // Casa de moradores: cama, lareira, mesa de jantar, estante, baús, tapete e velas
  house(r, room, spec, f) {
    const { IX, IZ } = room;
    const wide = IX > 230, deep = IZ > 230;
    const left = r() < 0.5;
    const A = left ? 'left' : 'right', B = left ? 'right' : 'left';
    const bx = (u) => (left ? -IX + u : IX - u); // posição na parede do fundo a partir do canto da cama
    if (f > 0) {
      // andares de cima: quartos
      bedCorner(r, room, A, { double: wide && r() < 0.4 });
      if (wide) room.at(B, -IZ + 90, pick(r, BEDS), { along: true, flip: B === 'right', gap0: 2 });
      room.at('back', bx(210), 'Bookcase', {});
      room.tableSet('table_small', 0, 20, { chairs: 1, on: [{ m: 'candle_thin_lit' }] });
      room.rug('Rug_' + pick(r, 'ABCD'), 0, 40, 0, 0.8);
      return;
    }
    const bed = bedCorner(r, room, A, { double: wide && deep && r() < 0.5 });
    const bedW = bed ? bed.w : 105;
    // parede do fundo: lareira ao lado da cama, estante de livros depois
    const hu = bedW + 12 + 85;
    room.at('back', bx(hu), 'Hearth', {});
    const after = hu + 85 + 8;
    if (IX * 2 - after > 130) room.at('back', bx(after + 60), 'Bookcase', {});
    // parede oposta: armário de cozinha; no meio, a mesa de jantar com cadeiras sobre um tapete
    const sb = left ? 1 : -1; // sinal de x do lado oposto à cama
    room.at(B, -IZ + (wide ? 30 : 70), 'Cupboard', { on: [{ m: 'plate_stack', dx: -25, h: 22 }, { m: 'bottle_B_brown', dx: 28 }] });
    const spots = wide ? [[sb * 100, 30], [sb * 100, 0], [sb * 60, 50], [0, 30], [sb * 150, 60], [sb * 100, 70]] : [[sb * 40, 50], [sb * 30, 20], [0, 30], [sb * 50, 0], [0, 60]];
    room.tables(spots, 1, () => ({ name: wide ? pick(r, ['table_medium', 'table_small']) : 'table_small', chairs: wide ? 4 : 2, stool: r() < 0.4, on: dinnerOn(r) }));
    const t = room.props.find((p) => p.m.startsWith('table_'));
    room.rug('Rug_' + pick(r, 'ABCD'), t ? t.x : sb * 60, t ? t.z : 20, r() < 0.5 ? 0 : PI, wide ? 1.15 : 0.85);
    // parede da frente (ao lado da porta): barris, caixas, balde
    room.line('front', [sw('barrel_small', { gap: 8 }), sw('box_small'), sw('bucket_metal', { gap: 6 }), sw('barrel_small')], { from: -IX, to: room.keep[0][0] });
    room.line('front', [sw('crates_stacked'), sw('barrel_small')].slice(0, r() < 0.5 ? 1 : 2), { from: room.keep[0][2], to: IX });
    // enfeites de parede
    room.hang('back', bx(hu + 200), 'torch_mounted', 140);
    if (wide) room.hang(B, 90, 'torch_mounted', 140);
    room.hang(A, IZ - 60, 'torch_mounted', 140);
  },

  // Ferraria: forja com bigorna, bancada de ferramentas, pedra de amolar, armas e barras de ferro
  smithy(r, room, spec, f) {
    if (f > 0) return THEMES.house(r, room, spec, f);
    const { IX, IZ } = room;
    const sx = r() < 0.5 ? -1 : 1;
    const fx = sx * (IX - 120);
    room.at('back', fx, 'Hearth', {});
    room.flames[room.flames.length - 1].y = 40;
    room.put('anvil', fx - sx * 10, -IZ + 66 + 85, 0.2 * sx, { h: 66, on: [{ m: 'hammer', dx: 12, dz: 2, rot: 0.9, lay: true }, { m: 'tongs', dx: -14, dz: -4, rot: 2.2, lay: true }] });
    room.put('bucket_water', fx + sx * 105, -IZ + 50, 0.5, { h: 40 });
    room.put('Iron_Bars_Stack_Medium', fx - sx * 120, -IZ + 40, 0.3, {});
    // armas e escudos pendurados nas paredes
    const wall = ['sword_B', 'shield_B', 'axe_A', 'sword_D', 'shield_A', 'sword_C'];
    wall.forEach((m, i) => room.hang('back', -sx * (IX - 70 - i * 85), m, m.startsWith('shield') ? 110 : 118, { gap0: 2 }));
    // bancada de trabalho com ferramentas
    room.at(sx > 0 ? 'right' : 'left', -IZ + 66 + 130, 'table_medium', { along: false, on: [{ m: 'pickaxe', dx: -30, lay: true, rot: 0.3 }, { m: 'saw', dx: 30, dz: 8, lay: true, rot: 1.2 }, { m: 'file', dx: 10, dz: -20, lay: true, rot: 0.6 }, { m: 'mallet', dx: -4, dz: 24, lay: true }] });
    room.at(sx > 0 ? 'right' : 'left', IZ - 190, 'weaponrack', { on: RACK_ARMS });
    living(r, room, sx > 0 ? 'left' : 'right');
    room.put('grindstone', sx * (IX - 90), IZ - 60, sx > 0 ? -PI / 2 : PI / 2, {});
    room.tables([[-sx * 60, 0], [-sx * 60, 30], [-sx * 140, 20]], 1, () => ({ name: 'table_medium', chairs: 0, on: [{ m: 'pickaxe', dx: -34, dz: 10, lay: true, rot: 0.4 }, { m: 'axe', dx: 20, dz: -14, lay: true, rot: 1.9 }, { m: 'Iron_Bars_Stack_Small', dx: 40, dz: 20 }, { m: 'chisel', dx: -4, dz: 24, lay: true, rot: 0.2 }] }));
    room.line('front', [sw('sack'), sw('sack'), sw('Wood_Log_Stack')], { from: room.keep[0][2], to: IX });
    room.hang('back', 0, 'torch_mounted', 150);
    room.hang('left', 0, 'torch_mounted', 150);
    room.hang('right', 0, 'torch_mounted', 150);
  },

  // Alquimia: estantes de poções nas paredes, mesa de trabalho, livros e lareira
  alchemy(r, room, spec, f) {
    if (f > 0) return THEMES.house(r, room, spec, f);
    const { IX, IZ } = room;
    room.rug('Rug_B', 0, 20, 0, 1.15);
    room.at('back', -IX + 70, 'Bookcase', {});
    room.at('back', IX - 90, 'Hearth', {});
    room.at('back', -IX + 200, 'Cupboard', { on: [{ m: 'bottle_C_green', dx: -30 }, { m: 'bottle_B_brown', dx: 30 }] });
    for (let i = 0; i < 3; i++) {
      room.hang('left', -IZ + 80 + i * 150, 'shelf_large', 105 + (i % 2) * 40, { on: shelfBottles(r, 3), top: 7, gap0: 1 });
      room.hang('right', -IZ + 80 + i * 150, 'shelf_large', 105 + ((i + 1) % 2) * 40, { on: shelfBottles(r, 3), top: 7, gap0: 1 });
    }
    // mesa de trabalho central
    room.tables([[0, 10], [-130, 10], [130, 10], [0, -20], [-200, 40], [200, 40]], 1, () => ({ name: 'table_medium', chairs: 2, stool: true, on: [...bottlesOn(r), { m: 'journal_open', dx: 0, dz: 22 }, { m: 'magnifying_glass', dx: 44, dz: 20, lay: true, rot: 0.5 }, { m: 'candle_lit', dx: 50, dz: -20 }] }));
    room.line('front', [sw('barrel_small'), sw('sack'), sw('bucket_metal')], { from: -IX, to: room.keep[0][0] });
    room.line('front', [sw('crates_stacked'), sw('box_small')], { from: room.keep[0][2], to: IX });
    room.line('left', [sw('chest')], { from: IZ - 220, to: IZ });
    room.hang('back', -40, 'torch_mounted', 150);
    room.hang('front', room.keep[0][0] - 60, 'torch_mounted', 150);
  },

  // Taverna: balcão com barris atrás, mesas com bancos, lareira, estantes de garrafas e candelabros
  tavern(r, room, spec, f) {
    if (f > 0) return THEMES.house(r, room, spec, f);
    const { IX, IZ } = room;
    // balcão em L: ocupa a esquerda do fundo
    const sx = r() < 0.5 ? -1 : 1;
    const bar = (t) => room.put('Counter', t, -IZ + 190, 0, {});
    const c1 = bar(sx * (IX - 125));
    if (c1) { room.onTop({ m: 'plate_stack', dx: -50, h: 22 }, c1.x, c1.z, 0, 100); room.onTop({ m: 'bottle_A_labeled_brown', dx: 10 }, c1.x, c1.z, 0, 100); room.onTop({ m: 'candle_lit', dx: 60 }, c1.x, c1.z, 0, 100); }
    const c2 = bar(sx * (IX - 125 - 215));
    if (c2) { room.onTop({ m: 'plate_food_A', dx: -30 }, c2.x, c2.z, 0, 100); room.onTop({ m: 'bottle_B_brown', dx: 40 }, c2.x, c2.z, 0, 100); }
    // atrás do balcão: barris e prateleiras de garrafas
    room.at('back', sx * (IX - 130), 'keg_decorated', {});
    room.at('back', sx * (IX - 130 - 255), 'barrel_large', {});
    room.at('back', sx * (IX - 130 - 255 - 140), 'barrel_small_stack', {});
    for (let i = 0; i < 3; i++) room.hang('back', sx * (IX - 90 - i * 190) + sx * -0, 'shelf_large', 130 + (i % 2) * 18, { on: shelfBottles(r, 3), top: 7, gap0: 1 });
    // lareira na parede lateral oposta ao balcão
    room.at(sx > 0 ? 'left' : 'right', 0, 'Hearth', { along: true, flip: sx < 0 });
    room.rug('Rug_D', -sx * 90, 70, 0, 1.3);
    // salão: mesas com bancos
    const spots = [];
    for (const z of [95, 120]) for (const x of [-250, -100, 50, 200, 330, 0, 150]) spots.push([x, z], [-x, z]);
    room.tables(spots, 3, (i) => ({ name: i % 2 ? 'table_medium' : 'table_medium_decorated_A', chairs: 4, stool: true, on: i % 2 ? dinnerOn(r) : [] }));
    const small = [];
    for (const z of [90, 130, 60]) for (const x of [-260, -170, -60, 40, 130, 220, 300, 340]) small.push([x, z]);
    room.tables(small, 3, () => ({ name: 'table_small', chairs: 2, stool: true, on: [{ m: 'candle_lit' }, { m: pick(r, BOTTLES), dx: 18 }] }));
    room.line('front', [sw('barrel_small'), sw('box_small')], { from: -IX, to: room.keep[0][0] });
    room.line('front', [sw('crates_stacked'), sw('barrel_small')], { from: room.keep[0][2], to: IX });
    room.hang('left', -80, 'torch_mounted', 150); room.hang('right', -80, 'torch_mounted', 150); room.hang('left', 150, 'banner_patternC_red', 40); room.hang('right', 150, 'banner_patternC_red', 40);
  },

  // Cofre: balcão dos atendentes, cofres e moedas ao fundo, mesa de espera e livros-caixa
  bank(r, room, spec, f) {
    if (f > 0) return THEMES.house(r, room, spec, f);
    const { IX, IZ } = room;
    room.rug('Runner', (room.keep[0][0] + room.keep[0][2]) / 2, IZ - 190, PI / 2, 1);
    // balcão de ponta a ponta, com abertura no meio
    const cz = -40;
    for (const t of [-IX + 125, -IX + 125 + 215, IX - 125, IX - 125 - 215]) room.put('Counter', t, cz, 0, {});
    room.onTop({ m: 'journal_open', dx: 0, h: 16 }, -IX + 125, cz, 0, 100); room.onTop({ m: 'coin_stack_small', dx: 20 }, -IX + 125 + 215, cz, 0, 100);
    room.onTop({ m: 'candle_lit', dx: -40 }, IX - 125, cz, 0, 100); room.onTop({ m: 'coin_stack_small', dx: 10 }, IX - 125 - 215, cz, 0, 100);
    // cofre ao fundo
    room.line('back', [sw('chest_gold'), sw('trunk_large_A'), sw('chest_gold'), sw('chest'), sw('chest_gold')], { from: -IX + 4, to: IX - 4, gap: 14 });
    room.put('Gold_Bars_Stack_Medium', -IX + 70, -IZ + 190, 0, {});
    room.put('coin_stack_large', IX - 70, -IZ + 190, 0, {});
    room.at('left', -IZ + 270, 'Bookcase', { along: true, flip: false });
    room.at('right', -IZ + 270, 'Bookcase', { along: true, flip: true });
    room.hang('back', 0, 'keyring_hanging', 150);
    room.hang('back', -IX + 200, 'banner_shield_blue', 40); room.hang('back', IX - 200, 'banner_shield_blue', 40);
    // espera
    room.tableSet('table_small', -IX + 160, IZ - 120, { chairs: 2, on: [{ m: 'candle_thin_lit' }] });
    room.line('front', [sw('barrel_small'), sw('box_large')], { from: room.keep[0][2], to: IX });
    room.hang('left', 100, 'torch_mounted', 150); room.hang('right', 100, 'torch_mounted', 150);
  },

  // Salão dos Guardiões: tapete real, mesas compridas, estandartes, lareiras e a mesa do comando ao fundo
  keep(r, room, spec, f) {
    const { IX, IZ } = room;
    if (f > 0) {
      room.at('left', -IZ + 200, 'bed_decorated', { along: true });
      room.at('right', -IZ + 200, 'bed_decorated', { along: true, flip: true });
      room.at('back', 0, 'Bookcase', {});
      room.tableSet('table_medium', 0, 60, { chairs: 2, on: [{ m: 'journal_open', dx: 0, h: 16 }, { m: 'candle_thin_lit', dx: 40 }] });
      room.rug('Rug_D', 0, 60, 0, 1.3);
      return;
    }
    // passadeira vermelha da porta ao estrado
    const cx = (room.keep[0][0] + room.keep[0][2]) / 2;
    for (let z = IZ - 150; z > -IZ + 60; z -= 300) room.rug('Runner', cx, z, PI / 2, 1);
    // lareiras nas duas paredes laterais e estandartes entre elas
    room.at('left', -IZ + 250, 'Hearth', { along: true });
    room.at('right', -IZ + 250, 'Hearth', { along: true, flip: true });
    for (const wall of ['left', 'right']) {
      room.hang(wall, 0, 'banner_blue', 60, { gap0: 2 });
      room.hang(wall, IZ - 170, 'banner_patternA_blue', 60, { gap0: 2 });
      room.hang(wall, -IZ + 40, 'sword_shield_gold', 140, { gap0: 2 });
    }
    // mesas compridas dos guardiões, uma de cada lado do tapete
    for (const sx of [-1, 1]) room.tableSet('table_long_tablecloth', cx + sx * 230, 20, { chairs: 6, rot: PI / 2, on: [{ m: 'candle_lit', dx: -90 }, { m: 'plate_food_A', dx: -20, dz: 10 }, { m: 'bottle_A_green', dx: 40 }, { m: 'plate_stack', dx: 100, h: 20 }, { m: 'candle_lit', dx: 120 }] });
    // estrado de comando ao fundo: mesa com mapa, cadeiras altas e baús
    room.tableSet('table_medium_decorated_A', cx, -IZ + 120, { chairs: 2, chairModel: 'chair' });
    room.hang('back', cx - 330, 'banner_triple_blue', 40, { gap0: 2 });
    room.hang('back', cx + 330, 'banner_triple_blue', 40, { gap0: 2 });
    room.at('back', cx + 480, 'chest_gold', {});
    room.at('back', cx - 480, 'chest', {});
    room.line('front', [sw('barrel_large'), sw('barrel_small')], { from: -IX, to: room.keep[0][0] });
    room.line('front', [sw('crates_stacked'), sw('barrel_large')], { from: room.keep[0][2], to: IX });
    room.hang('back', cx - 150, 'torch_mounted', 150); room.hang('back', cx + 150, 'torch_mounted', 150);
    room.hang('front', -IX + 200, 'torch_mounted', 150); room.hang('front', IX - 200, 'torch_mounted', 150);
  },

  // Quartel: fileiras de camas com baús, mesa de refeição, suporte de armas e lareira
  barracks(r, room, spec, f) {
    const { IX, IZ } = room;
    if (f > 0) {
      bunks(r, room, 'left', -IZ + 4, IZ - 60, 2); bunks(r, room, 'right', -IZ + 4, IZ - 60, 2);
      room.tableSet('table_small', 0, 20, { chairs: 2, stool: true, on: [{ m: 'candle_lit' }] });
      return;
    }
    bunks(r, room, 'left', -IZ + 4, IZ - 60, 3);
    bunks(r, room, 'right', -IZ + 4, IZ - 60, 3);
    room.at('back', 0, 'Hearth', {});
    room.rug('Rug_C', 0, 10, 0, 1.0);
    room.tables([[0, 40], [0, 20], [0, 0], [0, 60]], 1, () => ({ name: 'table_medium', chairs: 4, stool: true, on: [{ m: 'candle_lit', dx: -26 }, { m: 'plate_stack', dx: 30, h: 20 }, { m: 'bottle_B_brown', dx: 5, dz: 20 }] }));
    room.line('front', [sw('weaponrack', { on: RACK_ARMS })], { from: -IX, to: room.keep[0][0] });
    room.line('front', [sw('weaponrack', { on: RACK_ARMS })], { from: room.keep[0][2], to: IX });
    room.hang('back', -IX + 230, 'banner_patternC_red', 40, { gap0: 2 }); room.hang('back', IX - 230, 'banner_patternC_red', 40, { gap0: 2 });
    room.hang('left', 0, 'torch_mounted', 150); room.hang('right', 0, 'torch_mounted', 150);
  },

  // Arsenal: suportes cheios de armas, escudos nas paredes, barris de flechas e caixas
  armory(r, room, spec, f) {
    const { IX, IZ } = room;
    if (f > 0) return THEMES.barracks(r, room, spec, f);
    room.at('back', -IX + 110, 'weaponrack', { on: RACK_ARMS });
    room.at('back', 0, 'weaponrack', { on: RACK_ARMS });
    room.at('back', IX - 110, 'weaponrack', { on: RACK_ARMS });
    room.at('left', -IZ + 200, 'weaponrack', { along: false, on: RACK_ARMS });
    room.at('right', -IZ + 200, 'weaponrack', { on: RACK_ARMS });
    room.line('left', [sw('bucket_arrows'), sw('crates_stacked'), sw('chest')], { from: 0, to: IZ - 40 });
    room.line('right', [sw('barrel_small_stack'), sw('bucket_arrows'), sw('crates_stacked')], { from: 0, to: IZ - 40 });
    ['shield_A', 'shield_B', 'shield_C', 'shield_B', 'shield_A'].forEach((m, i) => room.hang('back', -IX + 40 + (i + 0.5) * ((IX * 2 - 80) / 5), m, 150, { gap0: 2 }));
    room.hang('left', -IZ + 70, 'sword_shield', 160, { gap0: 2 }); room.hang('right', -IZ + 70, 'sword_shield', 160, { gap0: 2 });
    room.tables([[0, 40], [0, 70], [0, 10]], 1, () => ({ name: 'table_medium', chairs: 2, stool: true, on: [{ m: 'sword_C', dx: -20, lay: true, rot: 0.3 }, { m: 'dagger_A', dx: 30, dz: 8, lay: true, rot: 1.1 }, { m: 'candle_lit', dx: 55 }] }));
    room.put('target', IX - 90, IZ - 120, -PI / 2 - 0.3, { h: 135 });
    room.hang('left', 90, 'torch_mounted', 150); room.hang('right', 90, 'torch_mounted', 150);
  },

  // Casa da Guarda: sala de plantão com mesa de mapas, camas, armas e lareira
  guardhouse(r, room, spec, f) {
    const { IX, IZ } = room;
    if (f > 0) return THEMES.barracks(r, room, spec, f);
    room.at('back', IX - 100, 'Hearth', {});
    room.at('back', -IX + 90, 'weaponrack', { on: RACK_ARMS });
    bunks(r, room, 'left', -IZ + 4, IZ - 40, 2);
    room.at('right', -IZ + 80, 'Cupboard', { on: [{ m: 'plate_stack', dx: -20, h: 22 }] });
    room.rug('Rug_C', 20, 60, 0, 1.1);
    room.tables([[40, 60], [40, 30], [0, 40], [60, 90], [-20, 70]], 1, () => ({ name: 'table_medium', chairs: 4, stool: true, on: [{ m: 'journal_open', dx: 0, dz: 18 }, { m: 'candle_lit', dx: -40 }, { m: 'plate_stack', dx: 40, h: 20 }] }));
    room.line('right', [sw('chest'), sw('barrel_small')], { from: 40, to: IZ - 80 });
    room.hang('back', 0, 'banner_shield_red', 50, { gap0: 2 });
    room.hang('left', 100, 'torch_mounted', 150); room.hang('right', 100, 'torch_mounted', 150);
    room.line('front', [sw('barrel_small'), sw('crates_stacked')], { from: room.keep[0][2], to: IX });
  },

  // Capela: altar com velas e estandartes ao fundo, bancos em duas colunas e tapete no corredor
  chapel(r, room, spec, f) {
    const { IX, IZ } = room;
    if (f > 0) return THEMES.house(r, room, spec, f);
    const cx = (room.keep[0][0] + room.keep[0][2]) / 2;
    // altar
    room.put('table_long_tablecloth', cx, -IZ + 90, PI / 2, { free: true });
    room.occ.push(room.box(cx, -IZ + 90, 140, 280, PI / 2));
    room.props[room.props.length - 1].box = room.box(cx, -IZ + 90, 140, 280, PI / 2);
    room.onTop({ m: 'candle_triple', dx: -100, h: 62 }, cx, -IZ + 90, PI / 2, 70);
    room.onTop({ m: 'candle_triple', dx: 100, h: 62 }, cx, -IZ + 90, PI / 2, 70);
    room.onTop({ m: 'journal_open', dx: 0, h: 16 }, cx, -IZ + 90, PI / 2, 70);
    room.hang('back', cx, 'banner_shield_blue', 40, { gap0: 2 });
    room.hang('back', cx - 220, 'banner_blue', 40, { gap0: 2 }); room.hang('back', cx + 220, 'banner_blue', 40, { gap0: 2 });
    // corredor central e bancos
    for (let z = IZ - 150; z > -IZ + 200; z -= 300) room.rug('Runner', cx, z, PI / 2, 1);
    const rows = Math.floor((IZ * 2 - 330) / 100);
    for (let i = 0; i < rows; i++) {
      for (const sx of [-1, 1]) for (const off of [150, 150 + 215]) {
        const x = cx + sx * off;
        if (Math.abs(x) > IX - 100) continue;
        room.put('Pew', x, -IZ + 260 + i * 100, 0, {});
      }
    }
    room.put('Bookcase', -IX + 20, 0, PI / 2, {});
    room.hang('left', 0, 'torch_mounted', 150); room.hang('right', 0, 'torch_mounted', 150);
    room.hang('left', IZ - 100, 'candle_triple', 100); room.hang('right', IZ - 100, 'candle_triple', 100);
  },
};

export function interiorFor(spec, st) {
  const rnd = mulberry((spec.seed || 1) * 7919 + 3);
  const W = spec.nx * 200, D = spec.nz * 200;
  const doorX = -W / 2 + 100 + (spec.door ?? Math.floor((spec.nx - 1) / 2)) * 200;
  const props = [], decor = [], flames = [], solids = [], rejects = [];
  const type = st.type || 'house';
  const floorPieces = spec.floors.map((style, f) => {
    if (spec.market || W < 250 || D < 250) return null;
    const room = new Room(W, D, rnd, doorX);
    const theme = THEMES[type] || THEMES.house;
    if (!/tower/.test(type)) theme(rnd, room, spec, f);
    const y0 = f * 300 + 3;
    for (const p of room.props) { props.push({ ...p, y: p.y + y0 }); if (f === 0 && p.box) solids.push(p.box); }
    for (const d of room.decor) { decor.push({ ...d, y: d.y + f * 300 + (d.name.startsWith('Rug') || d.name === 'Runner' ? 3.6 : 3) }); if (f === 0 && d.box) solids.push(d.box); }
    if (f === 0) rejects.push(...room.rejects); // o que não coube (só para depuração)
    if (f === 0) for (const fl of room.flames) flames.push({ ...fl, y: fl.y + 3 });
    if (type === 'tavern' || type === 'bank' || type === 'keep' || type === 'chapel') return f === 0 ? 'Floor_UnevenBrick' : 'Floor_WoodDark';
    if (type === 'smithy' || type === 'armory') return 'Floor_UnevenBrick';
    if (f === 0 && style === 'stone') return rnd() < 0.5 ? 'Floor_WoodDark' : 'Floor_UnevenBrick';
    return rnd() < 0.5 ? 'Floor_WoodLight' : 'Floor_WoodDark';
  });
  return { floorPieces, props, decor, flames, solids, ceiling: 'Floor_WoodDark', doorX, rejects };
}
