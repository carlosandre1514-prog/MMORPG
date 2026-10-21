// Prédios montados com as peças modulares do Medieval Village MegaKit (Quaternius, CC0).
// As peças vêm de /village/village.glb (gerado por tools/village/convert.mjs), em centímetros, numa grade
// de 2 m: paredes de 200 × 312 com a face externa para +Z, telhados com a cumeeira ao longo de Z.
// Cada prédio é montado em módulos e depois unido em uma malha por material (poucas chamadas de desenho).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const BASE = '/village/';
const MOD = 200; // módulo da grade, em cm
const FLOOR = 300; // altura de um andar, em cm
const TEXTURED = {
  Plaster: { normal: true }, UnevenBrick: { normal: true }, Brick: { normal: true }, RoundTiles: { normal: true, rough: 0.75 },
  RockTrim: { normal: true }, WoodTrim: { normal: true }, Vine: { png: true },
};

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
    const jobs = Object.entries(TEXTURED).map(async ([key, o]) => {
      const map = await load(`${key}_color.${o.png ? 'png' : 'jpg'}`, true);
      const normalMap = o.normal ? await load(`${key}_normal.jpg`, false) : null;
      const m = new THREE.MeshStandardMaterial({ name: key, map, normalMap, roughness: o.rough ?? 0.92, metalness: 0 });
      if (key === 'Vine') { m.alphaTest = 0.5; m.side = THREE.DoubleSide; m.color.set(0x5f9a3c); }
      this.mats[key] = m;
    });
    await Promise.all(jobs);
    // vidro das janelas: acende à noite (emissiveIntensity é ajustada pela cena)
    this.mats.WindowGlass = new THREE.MeshStandardMaterial({ name: 'WindowGlass', color: 0x9cc0d6, roughness: 0.15, metalness: 0.2, emissive: 0xffc35a, emissiveIntensity: 0 });
    for (const m of Object.values(this.mats)) m.userData.shared = true;
  },

  has(name) { return this.ready && this.pieces.has(name); },

  // Monta um prédio a partir de uma especificação (ver PLANS); devolve um THREE.Group em metros.
  build(spec) {
    const acc = new Map(); // material -> geometrias já transformadas
    const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1);
    const add = (name, x, y, z, rot = 0) => {
      const parts = this.pieces.get(name);
      if (!parts) return;
      mtx.compose(new THREE.Vector3(x, y, z), q.setFromAxisAngle(up, rot), one);
      for (const p of parts) {
        const key = this.mats[p.key] ? p.key : 'WoodTrim';
        if (!acc.has(key)) acc.set(key, []);
        acc.get(key).push(p.geo.clone().applyMatrix4(mtx));
      }
    };
    const rnd = mulberry(spec.seed || 1);
    const W = spec.nx * MOD, D = spec.nz * MOD;
    // lados: posição de cada módulo e rotação (a face externa da peça aponta para +Z local)
    const sides = [
      { n: spec.nx, rot: 0, at: (i) => [-W / 2 + MOD / 2 + i * MOD, D / 2], front: true },
      { n: spec.nx, rot: Math.PI, at: (i) => [W / 2 - MOD / 2 - i * MOD, -D / 2] },
      { n: spec.nz, rot: -Math.PI / 2, at: (i) => [-W / 2, -D / 2 + MOD / 2 + i * MOD] },
      { n: spec.nz, rot: Math.PI / 2, at: (i) => [W / 2, D / 2 - MOD / 2 - i * MOD] },
    ];
    const doorAt = spec.door ?? Math.floor((spec.nx - 1) / 2);
    spec.floors.forEach((style, f) => {
      const y = f * FLOOR;
      const pre = style === 'stone' ? 'Wall_UnevenBrick_' : 'Wall_Plaster_';
      sides.forEach((side, si) => {
        for (let i = 0; i < side.n; i++) {
          const [x, z] = side.at(i);
          if (f === 0 && side.front && i === doorAt && !spec.market) {
            const round = spec.doorStyle !== 'flat';
            add(pre + (round ? 'Door_Round' : 'Door_Flat'), x, y, z, side.rot);
            add(spec.doorPiece || (round ? 'Door_1_Round' : 'Door_1_Flat'), x - 56, y, z - 2, side.rot);
            continue;
          }
          if (spec.market && f === 0 && si !== 1) { add('Wall_Arch', x, y, z, side.rot); continue; }
          const r = rnd();
          const windowy = side.front || r < (spec.windows ?? 0.6);
          if (!windowy) {
            add(style === 'plaster' && r > 0.85 ? 'Wall_Plaster_WoodGrid' : style === 'plaster' && r > 0.75 ? (i % 2 ? 'Wall_Plaster_Straight_L' : 'Wall_Plaster_Straight_R') : pre + 'Straight', x, y, z, side.rot);
            continue;
          }
          const kind = spec.thin ? 'Thin_Round' : r < 0.45 ? 'Wide_Round' : 'Wide_Flat';
          add(pre + 'Window_' + kind, x, y, z, side.rot);
          add({ Thin_Round: 'Window_Thin_Round1', Wide_Round: 'Window_Wide_Round1', Wide_Flat: 'Window_Wide_Flat1' }[kind], x, y, z, side.rot);
          if (spec.shutters && rnd() < 0.6) add('WindowShutters_' + kind + '_Open', x, y, z, side.rot);
        }
      });
      // postes nos cantos cobrem as emendas
      for (const [cx, cz] of [[-W / 2, -D / 2], [W / 2, -D / 2], [-W / 2, D / 2], [W / 2, D / 2]]) add('Corner_Exterior_Wood', cx, y, cz);
    });
    // telhado de telhas com as empenas nas pontas
    const top = spec.floors.length * FLOOR;
    const along = W >= D; // cumeeira ao longo de X?
    const span = Math.min(W, D) / 100, len = Math.max(W, D) / 100;
    const roof = `Roof_RoundTiles_${span}x${len}`;
    add(roof, 0, top, 0, along ? Math.PI / 2 : 0);
    const gable = `Roof_Front_Brick${span}`;
    if (along) { add(gable, -W / 2, top, 0, -Math.PI / 2); add(gable, W / 2, top, 0, Math.PI / 2); }
    else { add(gable, 0, top, D / 2, 0); add(gable, 0, top, -D / 2, Math.PI); }
    // chaminés no meio da água de trás
    const ridge = this.ridge(roof);
    for (let c = 0; c < (spec.chimneys || 0); c++) {
      const off = (c === 0 ? 1 : -1) * (Math.max(W, D) / 2 - MOD * 0.75);
      const back = -Math.min(W, D) / 4;
      const [cx, cz] = along ? [off, back] : [back, off];
      add(spec.chimneyPiece || 'Prop_Chimney2', cx, top + ridge * 0.5 + 100 - 300, cz);
    }
    // trepadeiras sob o beiral
    for (let v = 0; v < (spec.vines || 0); v++) {
      const side = sides[v % 2 === 0 ? 0 : 2 + (v % 4 === 1 ? 0 : 1)];
      const i = Math.floor(rnd() * side.n);
      const [x, z] = side.at(i);
      const dir = new THREE.Vector3(Math.sin(side.rot), 0, Math.cos(side.rot));
      add(['Prop_Vine1', 'Prop_Vine2', 'Prop_Vine4'][v % 3], x + dir.x * 12 + (rnd() - 0.5) * 60 * Math.cos(side.rot), top - 20 - rnd() * 40, z + dir.z * 12, side.rot);
    }
    const g = new THREE.Group();
    for (const [key, geos] of acc) {
      const geo = mergeGeometries(geos, false);
      geo.computeBoundingSphere();
      const m = new THREE.Mesh(geo, this.mats[key]);
      m.castShadow = key !== 'Vine' && key !== 'WindowGlass';
      m.receiveShadow = true;
      g.add(m);
      for (const gg of geos) gg.dispose();
    }
    g.scale.setScalar(0.01); // cm -> m (1 tile = 1 m)
    return g;
  },

  ridge(name) {
    const parts = this.pieces.get(name);
    let maxY = 0;
    for (const p of parts || []) { if (!p.geo.boundingBox) p.geo.computeBoundingBox(); maxY = Math.max(maxY, p.geo.boundingBox.max.y); }
    return maxY;
  },
};

// Especificação de cada construção da vila (nx/nz em módulos de 2 m, andares de baixo para cima).
// props: objetos do KayKit em volta/dentro do prédio, em metros a partir do centro do terreno.
export function villagePlan(st, index) {
  const nx = Math.max(2, Math.floor(st.w / 2)), nz = Math.max(2, Math.floor(st.h / 2));
  const W = st.w, D = st.h;
  const base = { nx, nz, seed: 17 + index * 31 };
  const front = D / 2 - 0.45;
  switch (st.label) {
    case 'Salão dos Guardiões':
      return { ...base, floors: ['stone', 'stone', 'plaster'], chimneys: 2, vines: 5, windows: 0.8, shutters: true,
        props: [{ m: 'flag_blue', x: -1.6, z: D / 2 + 0.3, h: 2.4 }, { m: 'flag_blue', x: 1.6, z: D / 2 + 0.3, h: 2.4 }] };
    case 'Ferraria':
      return { ...base, floors: ['stone'], doorStyle: 'flat', chimneys: 2, chimneyPiece: 'Prop_Chimney', windows: 0.4,
        props: [{ m: 'weaponrack', x: W / 2 - 0.5, z: front - 0.2, h: 1.1 }, { m: 'resource_stone', x: W / 2 - 0.6, z: front - 1.4, w: 0.9 }, { m: 'barrel', x: 1.4, z: front, h: 0.78 }] };
    case 'Alquimia':
      return { ...base, floors: ['stone', 'plaster'], chimneys: 1, vines: 3, shutters: true,
        props: [{ m: 'crate_open', x: W / 2 - 0.6, z: front, h: 0.7 }, { m: 'bucket_water', x: -W / 2 + 0.5, z: front, h: 0.45 }] };
    case 'Mercado':
      return { ...base, floors: ['plaster'], market: true,
        props: [{ m: 'crate_long_A', x: -2, z: 0.6, w: 1.5 }, { m: 'crate_long_B', x: 0, z: 0.6, w: 1.5 }, { m: 'crate_long_C', x: 2, z: 0.6, w: 1.5 },
          { m: 'barrel', x: -3, z: -1.5, h: 0.8 }, { m: 'sack', x: 2.8, z: -1.6, w: 0.7 }, { m: 'crate_A_big', x: 1.8, z: -1.7, h: 0.75 }] };
    case 'Cofre':
      return { ...base, floors: ['stone', 'stone'], doorStyle: 'flat', thin: true, windows: 0.5,
        props: [{ m: 'crate_B_big', x: W / 2 - 0.6, z: front, h: 0.75 }] };
    case 'Taverna do Javali Dourado':
      return { ...base, floors: ['stone', 'plaster'], chimneys: 2, vines: 2, shutters: true, windows: 0.8,
        props: [{ m: 'barrel', x: W / 2 - 0.55, z: front, h: 0.8 }, { m: 'barrel', x: W / 2 - 0.55, z: front - 0.9, h: 0.8 }, { m: 'barrel', x: -W / 2 + 0.55, z: front, h: 0.8 }] };
    default: {
      const side = index % 2 ? 1 : -1;
      const extra = [{ m: 'barrel', h: 0.78 }, { m: 'crate_A_big', h: 0.72 }, { m: 'resource_lumber', w: 1.1 }][(index * 7) % 3];
      return { ...base, floors: index % 2 ? ['stone', 'plaster'] : ['plaster'], chimneys: 1, vines: index % 3 === 0 ? 2 : 0, shutters: index % 2 === 0,
        props: [{ ...extra, x: side * (W / 2 - 0.5), z: front + 0.1 }] };
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
