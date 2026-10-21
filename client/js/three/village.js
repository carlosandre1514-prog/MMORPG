// Prédios montados com as peças modulares do Medieval Village MegaKit (Quaternius, CC0).
// As peças vêm de /village/village.glb (gerado por tools/village/convert.mjs), em centímetros, numa grade
// de 2 m: paredes de 200 × 312 com a face externa para +Z, telhados com a cumeeira ao longo de Z.
// Cada construção vira uma lista de peças posicionadas; a cidade inteira é desenhada com um BatchedMesh
// por material (a geometria de cada peça existe uma vez só e o recorte é feito peça por peça).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const BASE = '/village/';
const MOD = 200; // módulo da grade, em cm
const FLOOR = 300; // altura de um andar, em cm
const TEXTURED = {
  Plaster: { normal: true }, UnevenBrick: { normal: true }, Brick: { normal: true }, RoundTiles: { normal: true, rough: 0.75 },
  RockTrim: { normal: true }, WoodTrim: { normal: true }, Vine: { png: true },
};
const FACE_ROT = { s: 0, n: Math.PI, e: Math.PI / 2, w: -Math.PI / 2 };
const UP = new THREE.Vector3(0, 1, 0);

export const village = {
  ready: false,
  pieces: new Map(), // nome -> [{ key, geo }]
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
    for (const m of Object.values(this.mats)) m.userData.shared = true;
  },

  has(name) { return this.ready && this.pieces.has(name); },

  // Matriz base de uma construção do mapa: centro do terreno, fachada virada para st.face, cm -> m.
  baseMatrix(st) {
    return new THREE.Matrix4().compose(
      new THREE.Vector3(st.x + st.w / 2, 0, st.y + st.h / 2),
      new THREE.Quaternion().setFromAxisAngle(UP, FACE_ROT[st.face || 's']),
      new THREE.Vector3(0.01, 0.01, 0.01));
  },

  // Acrescenta a `out` as peças da construção descrita por `spec` ({ name, m } com m já no mundo).
  place(spec, base, out) {
    const local = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1);
    const add = (name, x, y, z, rot = 0, scale = null) => {
      if (!this.pieces.has(name)) return;
      local.compose(new THREE.Vector3(x, y, z), q.setFromAxisAngle(UP, rot), scale || one);
      out.push({ name, m: base.clone().multiply(local) });
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
      const y = f * FLOOR;
      const pre = style === 'stone' ? 'Wall_UnevenBrick_' : 'Wall_Plaster_';
      sides.forEach((side) => {
        for (let i = 0; i < side.n; i++) {
          const [x, z] = side.at(i);
          if (f === 0 && side.front && i === doorAt) {
            const round = spec.doorStyle !== 'flat';
            add(pre + (round ? 'Door_Round' : 'Door_Flat'), x, y, z, side.rot);
            add(round ? 'Door_1_Round' : 'Door_1_Flat', x - 56, y, z - 2, side.rot);
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

  // Junta as peças posicionadas em um BatchedMesh por material.
  batch(placements) {
    const byKey = new Map(); // material -> { geos: Map(geo -> id), list: [[geo, matriz]] }
    for (const { name, m } of placements) {
      for (const p of this.pieces.get(name) || []) {
        const key = this.mats[p.key] ? p.key : 'WoodTrim';
        let e = byKey.get(key);
        if (!e) byKey.set(key, (e = { geos: new Map(), list: [] }));
        e.geos.set(p.geo, -1);
        e.list.push([p.geo, m]);
      }
    }
    const g = new THREE.Group();
    for (const [key, e] of byKey) {
      let nv = 0, ni = 0;
      for (const geo of e.geos.keys()) { nv += geo.attributes.position.count; ni += geo.index.count; }
      const bm = new THREE.BatchedMesh(e.list.length, nv, ni, this.mats[key]);
      bm.sortObjects = false;
      for (const geo of e.geos.keys()) e.geos.set(geo, bm.addGeometry(geo));
      for (const [geo, m] of e.list) bm.setMatrixAt(bm.addInstance(e.geos.get(geo)), m);
      bm.castShadow = key !== 'Vine' && key !== 'WindowGlass';
      bm.receiveShadow = true;
      g.add(bm);
    }
    return g;
  },

  // Uma construção isolada (prévia/ferramentas), centrada na origem, em metros.
  build(spec) {
    const base = new THREE.Matrix4().makeScale(0.01, 0.01, 0.01);
    return this.batch(this.place(spec, base, []));
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
  const base = { nx, nz, seed: (st.seed || 1) * 31 + 17 };
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
        ...base, floors: stacked(st.floors || 1, ground, 'plaster'), door: Math.floor(rnd() * nx),
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
