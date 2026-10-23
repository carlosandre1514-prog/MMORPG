// Prédios montados com as peças modulares do Medieval Village MegaKit (Quaternius, CC0).
// As peças vêm de /village/village.glb (gerado por tools/village/convert.mjs), em centímetros, numa grade
// de 2 m: paredes de 200 × 312 com a face externa para +Z, telhados com a cumeeira ao longo de Z.
// Cada construção vira uma lista de peças posicionadas; a cidade inteira é desenhada com um BatchedMesh
// por material (a geometria de cada peça existe uma vez só e o recorte é feito peça por peça).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { doorIndex } from '/shared/citygen.js';
import { medieval } from './medieval.js';
import { interiorFor } from './interiors.js';
import { registerDecor } from './decor.js';

const BASE = '/village/';
const MOD = 200; // módulo da grade, em cm
const FLOOR = 300; // altura de um andar, em cm
const TEXTURED = {
  Plaster: { normal: true }, UnevenBrick: { normal: true }, Brick: { normal: true }, RoundTiles: { normal: true, rough: 0.75 },
  RockTrim: { normal: true }, WoodTrim: { normal: true }, Vine: { png: true },
};
const DOOR_OPEN = 1.5; // rad: a folha gira para dentro da casa
const FACE_ROT = { s: 0, n: Math.PI, e: Math.PI / 2, w: -Math.PI / 2 };
const UP = new THREE.Vector3(0, 1, 0);

export const village = {
  ready: false,
  pieces: new Map(), // nome -> [{ key, geo }]
  centers: new Map(), // casa -> centro no mapa (para o LOD por distância)
  mats: {},

  async load(onProgress = () => {}) {
    try {
      const gltf = await new GLTFLoader().loadAsync(BASE + 'village.glb', (e) => { if (e.total) onProgress(0.8 * e.loaded / e.total); });
      for (const grp of gltf.scene.children) {
        const parts = [];
        grp.traverse((o) => { if (o.isMesh) parts.push({ key: o.material.name, geo: o.geometry }); });
        if (parts.length) this.pieces.set(grp.name, parts);
      }
      this.roofs = [...this.pieces.keys()].map((n) => /^Roof_RoundTiles_(\d+)x(\d+)$/.exec(n)).filter(Boolean).map((m) => ({ name: m[0], span: +m[1], len: +m[2] }));
      await this.makeMaterials();
      this.ready = this.pieces.size > 0;
    } catch (e) {
      console.warn('[cenário] prédios modulares indisponíveis', e);
    }
    onProgress(1);
  },

  async makeMaterials() {
    const tl = new THREE.TextureLoader();
    const load = (file, color) => tl.loadAsync(BASE + 'textures/' + file).then((t) => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = 4;
      if (color) t.colorSpace = THREE.SRGBColorSpace;
      return t;
    });
    await Promise.all(Object.entries(TEXTURED).map(async ([key, o]) => {
      const map = await load(`${key}_color.${o.png ? 'png' : 'jpg'}`, true);
      const normalMap = o.normal ? await load(`${key}_normal.jpg`, false) : null;
      const m = new THREE.MeshStandardMaterial({ name: key, map, normalMap, roughness: o.rough ?? 0.92, metalness: 0 });
      if (key === 'Vine') { m.alphaTest = 0.5; m.side = THREE.DoubleSide; m.color.set(0x5f9a3c); }
      this.mats[key] = m;
    }));
    // vidro das janelas: acende à noite (emissiveIntensity é ajustada pela cena)
    this.mats.WindowGlass = new THREE.MeshStandardMaterial({ name: 'WindowGlass', color: 0x9cc0d6, roughness: 0.15, metalness: 0.2, emissive: 0xffc35a, emissiveIntensity: 0 });
    registerDecor(this);
    for (const m of Object.values(this.mats)) m.userData.shared = true;
  },

  has(name) { return this.ready && this.pieces.has(name); },

  isSharedTexture(t) {
    return Object.values(this.mats).some((m) => m.map === t || m.normalMap === t);
  },

  // Matriz base de uma construção do mapa: centro do terreno, fachada virada para st.face, cm -> m.
  baseMatrix(st) {
    return new THREE.Matrix4().compose(
      new THREE.Vector3(st.x + st.w / 2, 0, st.y + st.h / 2),
      new THREE.Quaternion().setFromAxisAngle(UP, FACE_ROT[st.face || 's']),
      new THREE.Vector3(0.01, 0.01, 0.01));
  },

  // Acrescenta a `out` as peças da construção descrita por `spec` ({ name, m } com m já no mundo).
  // props (opcional): recebe os móveis { m, matrix } da casa; st: estrutura do mapa (tipo da casa);
  // meta (opcional): recebe flames (posições no mundo) e colliders (caixas de móveis em tiles) do térreo.
  // Cada peça leva o número da casa (bid) e se some quando o jogador está dentro (hide: telhado e andares de cima).
  place(spec, base, out, props = null, st = null, meta = null) {
    const local = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1);
    let hideNow = false, innerNow = false; // innerNow: piso, teto e decoração (só aparecem de perto)
    const bid = st ? st.seed || 0 : 0;
    if (bid) this.centers.set(bid, [base.elements[12], base.elements[14], st.w / 2, st.h / 2]);
    const add = (name, x, y, z, rot = 0, scale = null, depth = 0, leaf = false) => {
      if (!this.pieces.has(name)) return;
      // depth: recuo em cm ao longo da normal da parede (negativo = para dentro)
      const pos = new THREE.Vector3(x + Math.sin(rot) * depth, y, z + Math.cos(rot) * depth);
      local.compose(pos, q.setFromAxisAngle(UP, rot), scale || one);
      const pl = { name, m: base.clone().multiply(local), bid, hide: hideNow, inner: innerNow };
      if (leaf) pl.leaf = { base, pos, rot, scale: scale.clone() }; // folha da porta: gira em volta da dobradiça
      out.push(pl);
      // peças pesadas têm uma irmã simplificada (@lod) para os prédios distantes
      if (!leaf && bid && this.pieces.has(name + '@lod')) { pl.det = true; out.push({ name: name + '@lod', m: pl.m, bid, hide: hideNow, lod: true }); }
    };
    const rnd = mulberry(spec.seed || 1);
    const W = spec.nx * MOD, D = spec.nz * MOD;
    // lados: posição de cada módulo e rotação (a face externa da peça aponta para +Z local)
    const sides = [
      { n: spec.nx, rot: 0, at: (i) => [-W / 2 + MOD / 2 + i * MOD, D / 2], front: true },
      { n: spec.nx, rot: Math.PI, at: (i) => [W / 2 - MOD / 2 - i * MOD, -D / 2], back: true },
      { n: spec.nz, rot: -Math.PI / 2, at: (i) => [-W / 2, -D / 2 + MOD / 2 + i * MOD] },
      { n: spec.nz, rot: Math.PI / 2, at: (i) => [W / 2, D / 2 - MOD / 2 - i * MOD] },
    ];
    const doorAt = spec.noDoor ? -1 : spec.door ?? Math.floor((spec.nx - 1) / 2);
    spec.floors.forEach((style, f) => {
      hideNow = f >= 1;
      const y = f * FLOOR;
      const pre = style === 'stone' ? 'Wall_UnevenBrick_' : 'Wall_Plaster_';
      sides.forEach((side) => {
        for (let i = 0; i < side.n; i++) {
          const [x, z] = side.at(i);
          if (f === 0 && side.front && i === doorAt) {
            const round = spec.doorStyle !== 'flat';
            add(pre + (round ? 'Door_Round' : 'Door_Flat'), x, y, z, side.rot);
            // a porta é esticada para preencher o vão da parede (130 cm de largura) e a moldura cobre as bordas
            const sx = 136 / 112, sy = round ? 248 / 232 : 218 / 210;
            const dx = -51.4 * sx;
            const door = round ? 'Door_1_Round' : 'Door_1_Flat';
            const c = Math.cos(side.rot), sn = Math.sin(side.rot);
            add(door, x + dx * c, y - 3.4 * sy, z - dx * sn, side.rot, new THREE.Vector3(sx, sy, 1), -2, true);
            add(`DoorFrame_${round ? 'Round' : 'Flat'}_${style === 'stone' ? 'Brick' : 'WoodDark'}`, x, y, z, side.rot);
            continue;
          }
          if (spec.market && f === 0 && !side.back) { add('Wall_Arch', x, y, z, side.rot); continue; }
          const r = rnd();
          // fachada com janelas; fundos e laterais mais fechados (economiza geometria nos becos)
          const chance = side.front ? 0.9 : side.back ? (spec.windows ?? 0.6) * 0.5 : spec.windows ?? 0.6;
          if (r >= chance) {
            add(style === 'plaster' && r > 0.9 ? 'Wall_Plaster_WoodGrid' : style === 'plaster' && r > 0.75 ? (i % 2 ? 'Wall_Plaster_Straight_L' : 'Wall_Plaster_Straight_R') : pre + 'Straight', x, y, z, side.rot);
            continue;
          }
          const kind = spec.thin ? 'Thin_Round' : side.front && rnd() < 0.5 ? 'Wide_Round' : 'Wide_Flat';
          add(pre + 'Window_' + kind, x, y, z, side.rot);
          add({ Thin_Round: 'Window_Thin_Round1', Wide_Round: 'Window_Wide_Round1', Wide_Flat: 'Window_Wide_Flat1' }[kind], x, y, z, side.rot);
          if (spec.shutters && side.front && rnd() < 0.6) add('WindowShutters_' + kind + '_Open', x, y, z, side.rot);
        }
      });
      // postes nos cantos cobrem as emendas
      for (const [cx, cz] of [[-W / 2, -D / 2], [W / 2, -D / 2], [-W / 2, D / 2], [W / 2, D / 2]]) add('Corner_Exterior_Wood', cx, y, cz);
    });
    hideNow = false;
    // pisos de cada andar, teto e mobília (o térreo é visitável; a câmera também passa por dentro)
    if (props && st) {
      innerNow = true;
      const inter = interiorFor(spec, st);
      inter.floorPieces.forEach((piece, f) => {
        if (!piece) return;
        hideNow = f >= 1;
        for (let i = 0; i < spec.nx; i++) for (let j = 0; j < spec.nz; j++) add(piece, -W / 2 + 100 + i * MOD, f * FLOOR + 2, -D / 2 + 100 + j * MOD);
      });
      if (inter.floorPieces[0]) {
        // teto do último andar (visto de dentro, em primeira pessoa)
        hideNow = true;
        for (let i = 0; i < spec.nx; i++) for (let j = 0; j < spec.nz; j++) add(inter.ceiling, -W / 2 + 100 + i * MOD, spec.floors.length * FLOOR - 5, -D / 2 + 100 + j * MOD);
      }
      for (const d of inter.decor) {
        hideNow = d.y > 150;
        add(d.name, d.x, d.y, d.z, d.rot, d.s ? new THREE.Vector3(d.s[0], d.s[1], d.s[2]) : null);
      }
      innerNow = false;
      for (const p of inter.props) {
        if (!medieval.has(p.m)) continue;
        props.push({ m: p.m, bid, up: p.y > 150, matrix: base.clone().multiply(medieval.placed(p.m, p.k, p.x, p.y, p.z, p.rot, p.lay, p.tilt)) });
      }
      if (meta) {
        const pa = new THREE.Vector3(), pb = new THREE.Vector3();
        (meta.flames ||= []).push(...inter.flames.map((f) => new THREE.Vector3(f.x, f.y, f.z).applyMatrix4(base)));
        (meta.colliders ||= []).push(...inter.solids.map((b) => {
          pa.set(b[0], 0, b[1]).applyMatrix4(base); pb.set(b[2], 0, b[3]).applyMatrix4(base);
          return [Math.min(pa.x, pb.x), Math.min(pa.z, pb.z), Math.max(pa.x, pb.x), Math.max(pa.z, pb.z)];
        }));
      }
    }
    hideNow = true;
    // telhado de telhas com as empenas nas pontas
    const top = spec.floors.length * FLOOR;
    const along = W > D; // cumeeira ao longo de X?
    const span = Math.min(W, D) / 100, len = Math.max(W, D) / 100;
    const roof = this.pickRoof(span, len);
    if (roof) {
      add(roof.name, 0, top, 0, along ? Math.PI / 2 : 0, new THREE.Vector3(span / roof.span, 1, len / roof.len));
      const gable = `Roof_Front_Brick${span}`;
      if (along) { add(gable, -W / 2, top, 0, -Math.PI / 2); add(gable, W / 2, top, 0, Math.PI / 2); }
      else { add(gable, 0, top, D / 2, 0); add(gable, 0, top, -D / 2, Math.PI); }
      // chaminés no meio da água de trás
      const ridge = this.ridge(roof.name);
      for (let c = 0; c < (spec.chimneys || 0); c++) {
        const off = (c === 0 ? 1 : -1) * (Math.max(W, D) / 2 - MOD * 0.75);
        const back = -Math.min(W, D) / 4;
        const [cx, cz] = along ? [off, back] : [back, off];
        add(spec.chimneyPiece || 'Prop_Chimney2', cx, top + ridge * 0.5 + 100 - 300, cz);
      }
    }
    // trepadeiras sob o beiral da fachada e das laterais
    for (let v = 0; v < (spec.vines || 0); v++) {
      const side = sides[v % 2 === 0 ? 0 : 2 + (v % 4 === 1 ? 0 : 1)];
      const i = Math.floor(rnd() * side.n);
      const [x, z] = side.at(i);
      const dir = new THREE.Vector3(Math.sin(side.rot), 0, Math.cos(side.rot));
      add(['Prop_Vine1', 'Prop_Vine2', 'Prop_Vine4'][v % 3], x + dir.x * 12 + (rnd() - 0.5) * 60 * Math.cos(side.rot), top - 20 - rnd() * 40, z + dir.z * 12, side.rot);
    }
    return out;
  },

  // Telhado do tamanho exato ou o mais próximo (esticado para caber)
  pickRoof(span, len) {
    let best = null, bestD = Infinity;
    for (const r of this.roofs || []) {
      const d = Math.abs(r.span - span) * 10 + Math.abs(r.len - len);
      if (d < bestD) { bestD = d; best = r; }
    }
    return best;
  },

  // Junta as peças posicionadas em um BatchedMesh por material, em blocos de 28 × 28 tiles: cada bloco tem a própria esfera de corte,
  // então o que está fora da tela nem entra na conta de visibilidade por instância.
  batch(placements) {
    const CH = 28;
    const chunks = new Map();
    for (const pl of placements) {
      const c = this.centers.get(pl.bid);
      const key = c ? Math.floor(c[0] / CH) + ',' + Math.floor(c[1] / CH) : 'x';
      const l = chunks.get(key);
      if (l) l.push(pl); else chunks.set(key, [pl]);
    }
    const top = new THREE.Group(), bld = new Map(), leaves = new Map();
    for (const list of chunks.values()) {
      const g = this.batchOne(list);
      top.add(g);
      for (const [k, v] of g.userData.bld) bld.set(k, v);
      for (const [k, v] of g.userData.leaves) leaves.set(k, v);
    }
    top.userData.bld = bld; top.userData.leaves = leaves;
    return top;
  },

  batchOne(placements) {
    const byKey = new Map(); // material -> { geos: Map(geo -> id), list: [[geo, matriz]] }
    for (const pl of placements) {
      const { name, m } = pl;
      for (const p of this.pieces.get(name) || []) {
        const key = this.mats[p.key] ? p.key : 'WoodTrim';
        let e = byKey.get(key);
        if (!e) byKey.set(key, (e = { geos: new Map(), list: [] }));
        e.geos.set(p.geo, -1);
        e.list.push([p.geo, m, pl]);
      }
    }
    const g = new THREE.Group();
    // por casa: instâncias que somem por dentro (telhado e andares de cima) ou trocam de detalhe com a distância, e folhas de porta
    const bld = new Map(), leaves = new Map();
    const keep = (map, id, v) => { const l = map.get(id); if (l) l.push(v); else map.set(id, [v]); };
    const state = (id) => { let b = bld.get(id); if (!b) bld.set(id, (b = { hidden: false, far: false, entries: [] })); return b; };
    g.userData.bld = bld; g.userData.leaves = leaves;
    for (const [key, e] of byKey) {
      let nv = 0, ni = 0;
      for (const geo of e.geos.keys()) { nv += geo.attributes.position.count; ni += geo.index.count; }
      const bm = new THREE.BatchedMesh(e.list.length, nv, ni, this.mats[key]);
      bm.sortObjects = false;
      for (const geo of e.geos.keys()) e.geos.set(geo, bm.addGeometry(geo));
      for (const [geo, m, pl] of e.list) {
        const id = bm.addInstance(e.geos.get(geo));
        bm.setMatrixAt(id, m);
        if (pl.bid && (pl.hide || pl.det || pl.lod || pl.inner)) state(pl.bid).entries.push({ bm, id, hide: !!pl.hide, kind: pl.lod ? 2 : pl.det ? 1 : pl.inner ? 3 : 0, vis: true });
        if (pl.bid && pl.leaf) keep(leaves, pl.bid, { bm, id, leaf: pl.leaf });
      }
      bm.castShadow = key !== 'Vine' && key !== 'WindowGlass';
      bm.receiveShadow = true;
      g.add(bm);
    }
    for (const b of bld.values()) this.applyState(b); // começa com o detalhe alto e as versões simples escondidas
    return g;
  },

  // Visibilidade de cada instância de uma casa: telhado/andares de cima somem por dentro, e o detalhe vira simples de longe
  applyState(b) {
    for (const e of b.entries) {
      const vis = (e.kind === 2 ? b.far : e.kind === 1 || e.kind === 3 ? !b.far : true) && !(e.hide && b.hidden);
      if (vis !== e.vis) { e.bm.setVisibleAt(e.id, vis); e.vis = vis; }
    }
  },

  // Troca o detalhe das casas conforme a distância ao jogador (histerese de 2 tiles para não piscar)
  updateLod(batchGroup, px, pz, r) {
    const bld = batchGroup.userData.bld;
    if (!bld) return;
    for (const [id, b] of bld) {
      const c = this.centers.get(id);
      if (!c) continue;
      const d = Math.hypot(Math.max(0, Math.abs(c[0] - px) - c[2]), Math.max(0, Math.abs(c[1] - pz) - c[3])); // distância até o retângulo do prédio
      const far = b.far ? d > r - 2 : d > r + 2;
      if (far !== b.far) { b.far = far; this.applyState(b); }
    }
  },

  // Móveis em um BatchedMesh por atlas (material). Cada instância some quando está longe do jogador (cull):
  // os interiores só aparecem de perto, o que mantém a cidade inteira leve.
  propMeshes(props) {
    const g = new THREE.Group();
    const byMat = new Map();
    for (const p of props) {
      const mat = medieval.mat(p.m);
      if (!byMat.has(mat)) byMat.set(mat, []);
      byMat.get(mat).push(p);
    }
    g.userData.items = [];
    for (const [mat, list] of byMat) {
      const geos = new Map();
      let nv = 0, ni = 0;
      for (const p of list) {
        if (geos.has(p.m)) continue;
        const geo = medieval.geo(p.m);
        geos.set(p.m, -1);
        nv += geo.attributes.position.count;
        ni += geo.index.count;
      }
      const bm = new THREE.BatchedMesh(list.length, nv, ni, mat);
      bm.sortObjects = false;
      bm.receiveShadow = true;
      for (const name of geos.keys()) geos.set(name, bm.addGeometry(medieval.geo(name)));
      const items = [];
      for (const p of list) {
        const id = bm.addInstance(geos.get(p.m));
        bm.setMatrixAt(id, p.matrix);
        items.push({ id, x: p.matrix.elements[12], z: p.matrix.elements[14], on: true, bid: p.bid, up: p.up });
      }
      g.userData.items.push({ bm, items });
      g.add(bm);
    }
    return g;
  },

  // Mostra só os móveis a até r tiles de (px, pz)
  cullProps(group, px, pz, r = 22) {
    const r2 = r * r, hidden = group.userData.hidden || 0;
    for (const { bm, items } of group.userData.items || []) {
      for (const it of items) {
        // por dentro de uma casa os móveis dos andares de cima também somem
        const on = (it.x - px) * (it.x - px) + (it.z - pz) * (it.z - pz) < r2 && !(it.up && it.bid === hidden);
        if (on !== it.on) { bm.setVisibleAt(it.id, on); it.on = on; }
      }
    }
  },

  // Esconde (ou mostra) o telhado e os andares de cima da casa `bid` (o jogador está dentro dela)
  setHidden(batchGroup, propGroup, bid, hidden) {
    const b = batchGroup.userData.bld.get(bid);
    if (b) { b.hidden = hidden; this.applyState(b); }
    if (propGroup) propGroup.userData.hidden = hidden ? bid : 0;
  },

  // Porta aberta (em radianos) de cada casa: abre quando o jogador chega perto e fecha quando se afasta
  updateDoors(batchGroup, rooms, px, py, dt) {
    const leaves = batchGroup.userData.leaves;
    if (!leaves || !rooms) return;
    const m = new THREE.Matrix4(), l = new THREE.Matrix4(), q = new THREE.Quaternion();
    for (const g of rooms) {
      const dx = g.door[0] - px, dy = g.door[1] - py, d2 = dx * dx + dy * dy;
      const cur = g.ang || 0;
      if (d2 > 144 && cur === 0) continue;
      const want = d2 < 8.4 ? DOOR_OPEN : 0;
      if (Math.abs(want - cur) < 1e-3) continue;
      const next = cur + Math.sign(want - cur) * Math.min(Math.abs(want - cur), dt * 3.4);
      g.ang = next;
      for (const { bm, id, leaf } of leaves.get(g.seed) || []) {
        l.compose(leaf.pos, q.setFromAxisAngle(UP, leaf.rot + next), leaf.scale);
        bm.setMatrixAt(id, m.copy(leaf.base).multiply(l));
      }
    }
  },

  // Uma construção isolada (prévia/ferramentas), centrada na origem, em metros.
  build(spec, st = null) {
    const base = new THREE.Matrix4().makeScale(0.01, 0.01, 0.01);
    const props = [];
    const g = this.batch(this.place(spec, base, [], props, st));
    if (props.length) g.add(this.propMeshes(props));
    return g;
  },

  ridge(name) {
    let maxY = 0;
    for (const p of this.pieces.get(name) || []) { if (!p.geo.boundingBox) p.geo.computeBoundingBox(); maxY = Math.max(maxY, p.geo.boundingBox.max.y); }
    return maxY;
  },
};

// Especificação de cada construção do mapa (nx/nz em módulos de 2 m na orientação da fachada).
export function villagePlan(st) {
  const side = st.face === 'e' || st.face === 'w';
  const W = side ? st.h : st.w, D = side ? st.w : st.h;
  const nx = Math.max(2, Math.floor(W / 2)), nz = Math.max(2, Math.floor(D / 2));
  const rnd = mulberry((st.seed || 1) * 977 + 13);
  // a porta vem do mapa (o gerador deixa livre a rua em frente a ela)
  const base = { nx, nz, seed: (st.seed || 1) * 31 + 17, door: Math.max(0, doorIndex(st)) };
  const stacked = (n, ground = 'stone', upper = 'plaster') => Array.from({ length: n || 1 }, (_, i) => (i === 0 ? ground : upper));
  switch (st.type) {
    case 'keep': return { ...base, floors: stacked(st.floors, 'stone', 'stone'), chimneys: 2, vines: 5, windows: 0.9, shutters: true };
    case 'keeptower': return { ...base, floors: stacked(st.floors, 'stone', 'stone'), noDoor: true, thin: true, windows: 0.5 };
    case 'belltower': return { ...base, floors: stacked(st.floors, 'stone', 'stone'), noDoor: true, thin: true, windows: 0.5, vines: 2 };
    case 'barracks': return { ...base, floors: stacked(st.floors), doorStyle: 'flat', chimneys: 1, windows: 0.7 };
    case 'armory': return { ...base, floors: stacked(st.floors, 'stone', 'stone'), doorStyle: 'flat', thin: true, windows: 0.5 };
    case 'smithy': return { ...base, floors: stacked(st.floors), doorStyle: 'flat', chimneys: 2, chimneyPiece: 'Prop_Chimney', windows: 0.4 };
    case 'alchemy': return { ...base, floors: stacked(st.floors), chimneys: 1, vines: 3, shutters: true };
    case 'bank': return { ...base, floors: stacked(st.floors, 'stone', 'stone'), doorStyle: 'flat', thin: true, windows: 0.5 };
    case 'tavern': return { ...base, floors: stacked(st.floors), chimneys: 2, vines: 2, shutters: true, windows: 0.8 };
    case 'guardhouse': return { ...base, floors: stacked(st.floors, 'stone', 'stone'), doorStyle: 'flat', thin: true, windows: 0.5 };
    case 'chapel': return { ...base, floors: stacked(st.floors, 'stone', 'stone'), thin: true, windows: 0.8, vines: 3 };
    case 'market': return { ...base, floors: ['plaster'], market: true };
    default: {
      const ground = rnd() < 0.55 ? 'stone' : 'plaster';
      return {
        ...base, floors: stacked(st.floors || 1, ground, 'plaster'),
        doorStyle: rnd() < 0.5 ? 'flat' : 'round', chimneys: rnd() < 0.65 ? 1 : 0, vines: rnd() < 0.3 ? 2 : 0,
        shutters: rnd() < 0.5, windows: 0.45 + rnd() * 0.3,
      };
    }
  }
}

function mulberry(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
