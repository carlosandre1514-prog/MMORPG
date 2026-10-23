// Cenário dos packs KayKit (Kay Lousberg, CC0): Medieval Hexagon (árvores, pedras, montanhas, objetos),
// Resource Bits (minérios, barras, tecidos, madeira, ouro) e Dungeon (pilares, tochas, baús, velas, mesas,
// estandartes), Fantasy Weapons Bits (espadas, machados, martelos, lanças, escudos) e RPG Tools Bits (bigorna,
// pedra de amolar, picaretas, serras, lanternas, diários). Cada pack é um GLB gerado por
// tools/medieval/convert.mjs, com todos os modelos dividindo um material com atlas.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { lite } from './lite.js';

// Packs convertidos por tools/medieval/convert.mjs; cada um tem o próprio atlas
const PACKS = ['/kaykit/medieval/medieval.glb', '/kaykit/resources/resources.glb', '/kaykit/dungeon/dungeon.glb',
  '/kaykit/weaponbits/weaponbits.glb', '/kaykit/tools/tools.glb',
  // fazenda (tools/farm/convert.mjs): construções (Quaternius), adereços (RG Poly), plantas e magia (WizP; texturas pintadas à mão)
  '/farm/farm.glb', '/farm/props.glb', '/farm/flora.glb', '/farm/magic.glb'];

export const medieval = {
  ready: false,
  geos: new Map(),
  mats: new Map(), // nome do modelo -> material do pack (atlas)
  shared: new Set(), // geometrias dos packs (não podem ser descartadas com a zona)
  material: null,

  async load(onProgress = () => {}) {
    const prog = PACKS.map(() => 0);
    await Promise.all(PACKS.map(async (url, i) => {
      try {
        const gltf = await new GLTFLoader().loadAsync(url, (e) => { if (e.total) { prog[i] = e.loaded / e.total; onProgress(prog.reduce((a, b) => a + b, 0) / PACKS.length); } });
        // cada malha pode ter o próprio material (os packs pintados à mão têm uma textura por tipo); nos outros packs todos dividem um só
        const gltfMats = new Set();
        gltf.scene.traverse((o) => {
          if (!o.isMesh) return;
          o.geometry.computeBoundingBox();
          gltfMats.add(o.material);
          this.geos.set(o.name, o.geometry);
          this.mats.set(o.name, o.material);
          this.shared.add(o.geometry);
        });
        const swap = new Map();
        for (const gm of gltfMats) {
          const mat = lite(gm);
          swap.set(gm, mat);
          mat.userData.shared = true;
          mat.roughness = 0.85;
          mat.metalness = 0;
          if (mat.map) { mat.map.magFilter = THREE.LinearFilter; mat.map.generateMipmaps = false; mat.map.minFilter = THREE.LinearFilter; }
          // o brilho dos cogumelos é um cartão transparente que soma luz
          if (gm.name === 'Glow') { mat.blending = THREE.AdditiveBlending; mat.depthWrite = false; mat.transparent = true; mat.fog = true; }
          if (i === 0 && !this.material) this.material = mat;
        }
        for (const k of [...this.mats.keys()]) if (swap.has(this.mats.get(k))) this.mats.set(k, swap.get(this.mats.get(k)));
      } catch (e) {
        console.warn('[cenário] pack indisponível, usando formas simples:', url, e);
      }
    }));
    this.ready = this.geos.size > 0;
    onProgress(1);
  },

  mat(name) { return this.mats.get(name) || this.material; },
  // partes de um modelo dividido por material (nomes "prefixo~material"), como as construções da fazenda
  parts(prefix) { return [...this.geos.keys()].filter((n) => n.startsWith(prefix + '~')); },
  has(name) { return this.ready && this.geos.has(name); },
  geo(name) { return this.geos.get(name); },
  size(name) { return this.geos.get(name).boundingBox.getSize(new THREE.Vector3()); },

  // Escala que faz o modelo caber em (w × d) tiles com altura máxima h (qualquer limite pode ser omitido).
  fit(name, w, d, h) {
    const s = this.size(name);
    let k = Infinity;
    if (w) k = Math.min(k, w / s.x);
    if (d) k = Math.min(k, d / s.z);
    if (h) k = Math.min(k, h / s.y);
    return k;
  },

  // Matriz de um modelo escalado por k, girado (rot em Y, deitado em X se lay, inclinado em Z por tilt), com o centro da
  // caixa em (x, z) e a base em y, no referencial de quem chama (tiles nos objetos do mapa, cm nas casas).
  placed(name, k, x, y, z, rot = 0, lay = false, tilt = 0) {
    const q = new THREE.Quaternion().multiplyQuaternions(
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rot),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), tilt)).multiply(
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), lay ? -Math.PI / 2 : 0));
    const sc = new THREE.Vector3(k, k, k);
    const box = this.geo(name).boundingBox.clone().applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(), q, sc));
    const c = box.getCenter(new THREE.Vector3());
    return new THREE.Matrix4().compose(new THREE.Vector3(x - c.x, y - box.min.y, z - c.z), q, sc);
  },

  mesh(name, scale = 1) {
    const m = new THREE.Mesh(this.geo(name), this.mat(name));
    m.scale.setScalar(scale);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  },
};

// Objetos do mapa substituídos por modelos do pack: variantes e tamanho (altura ou largura em tiles)
export const OBJECT_MODELS = {
  tree: { m: ['tree_single_B'], h: 2.6 },
  pine: { m: ['tree_single_A'], h: 2.9 },
  bigtree: { m: ['tree_single_B'], h: 3.8 },
  rock: { m: ['rock_single_A', 'rock_single_B', 'rock_single_C', 'rock_single_D', 'rock_single_E'], w: 0.95 },
  barrel: { m: ['barrel'], h: 0.78 },
  crate: { m: ['crate_A_big', 'crate_B_big'], h: 0.72 },
  well: { m: ['building_well_blue'], w: 1.35 },
  cart: { m: ['wheelbarrow'], w: 1.1 },
  banner: { m: ['flag_blue', 'flag_red'], h: 1.75 },
  target: { m: ['target'], h: 1.45 },
  // suporte de armas com armas de verdade penduradas (extras em tiles: dx/dz lateral, y altura, h tamanho)
  rack: {
    m: ['weaponrack'], h: 1.25,
    extras: [
      { m: 'sword_B', dx: -0.28, y: 0.38, dz: 0.02, h: 0.8, rot: 0, tilt: 0.12 },
      { m: 'axe_A', dx: 0.0, y: 0.42, dz: 0.02, h: 0.7, rot: 0, tilt: -0.05 },
      { m: 'spear_A', dx: 0.3, y: 0.12, dz: 0.0, h: 1.5, rot: 0, tilt: 0.08 },
    ],
  },
  anvil: { m: ['anvil'], w: 0.95, extras: [{ m: 'hammer', dx: 0.12, y: 0.47, dz: 0.0, h: 0.34, rot: 0.9, lay: true }, { m: 'tongs', dx: -0.2, y: 0.47, dz: 0.06, h: 0.3, rot: 2.2, lay: true }] },
  tools: { m: ['pickaxe', 'shovel', 'saw', 'mallet', 'handplane'], h: 0.62, lay: true },
  lantern: { m: ['lantern'], h: 0.55, flame: 0.3, flameSize: 0.9 },
  sack: { m: ['sack'], w: 0.75 },
  lumber: { m: ['resource_lumber'], w: 1.15 },
  // veio de minério: pepita grande sobre um monte de pedras (ferro é o mais comum, ouro o mais raro)
  ore: { m: ['Iron_Nugget_Large', 'Iron_Nugget_Large', 'Copper_Nugget_Large', 'Silver_Nugget_Large', 'Gold_Nugget_Large'], h: 0.85, base: { m: 'Stone_Chunks_Large', w: 0.95 } },
  bars: { m: ['Iron_Bars_Stack_Small', 'Iron_Bars_Stack_Medium', 'Copper_Bars_Stack_Small', 'Silver_Bars_Stack_Small'], w: 0.8 },
  cloth: { m: ['Textiles_Stack_Large_Colored', 'Textiles_Stack_Small', 'Textiles_A'], w: 0.95 },
  planks: { m: ['Wood_Planks_Stack_Medium', 'Wood_Planks_Stack_Small', 'Wood_Log_Stack'], w: 1.1 },
  bricks: { m: ['Stone_Bricks_Stack_Small', 'Stone_Bricks_Stack_Medium'], w: 1.0 },
  gold: { m: ['Gold_Bars_Stack_Medium', 'coin_stack_large', 'Gold_Bars', 'coin_stack_medium', 'Gold_Nuggets'], w: 0.8 },
  pillar: { m: ['pillar', 'pillar', 'pillar_decorated'], h: 2.7 },
  brokenpillar: { m: ['column', 'rubble_half'], w: 0.95 },
  torch: { m: ['torch_lit'], h: 1.15, flame: 1.02 },
  chest: { m: ['chest_gold', 'chest'], w: 0.9 },
  table: { m: ['table_medium_tablecloth_decorated_B', 'table_long_decorated_A', 'table_small_decorated_A'], w: 1.45 },
  keg: { m: ['keg_decorated', 'barrel_small_stack', 'barrel_large_decorated'], w: 0.95 },
  candle: { m: ['candle_triple', 'candle_melted', 'shelf_small_candles'], h: 0.45, flame: 0.48, flameSize: 0.45 },
};

// Construções da vila: modelo principal (e acessórios) para cada retângulo do mapa
export function structurePlan(st, index) {
  const W = st.w, D = st.h;
  const homes = ['building_home_A_red', 'building_home_B_yellow', 'building_home_A_green', 'building_home_B_blue', 'building_home_A_yellow'];
  const main = (m, opts = {}) => ({ m, x: 0, z: 0, w: W - 0.3, d: D - 0.2, ...opts });
  switch (st.label) {
    case 'Salão dos Guardiões':
      return [main('building_castle_blue', { w: W - 3.6, h: 11 }),
        { m: 'building_tower_A_blue', x: -W / 2 + 1.1, z: 1.2, w: 2, d: 2.2 },
        { m: 'building_tower_A_blue', x: W / 2 - 1.1, z: 1.2, w: 2, d: 2.2 }];
    case 'Ferraria': return [main('building_blacksmith_blue')];
    case 'Alquimia': return [main('building_home_B_green', { stretch: 1.25 }), { m: 'barrel', x: W / 2 - 0.6, z: D / 2 - 0.6, h: 0.78 }, { m: 'crate_open', x: -W / 2 + 0.6, z: D / 2 - 0.6, h: 0.7 }];
    case 'Mercado': return [main('building_market_blue', { stretch: 1.2 })];
    case 'Cofre': return [main('building_barracks_yellow', { stretch: 1.2 })];
    case 'Taverna do Javali Dourado': return [main('building_tavern_red', { stretch: 1.2 }), { m: 'barrel', x: W / 2 - 0.6, z: D / 2 - 0.5, h: 0.78 }, { m: 'barrel', x: W / 2 - 0.6, z: D / 2 - 1.4, h: 0.78 }];
    default: {
      const m = homes[index % homes.length];
      const extra = (index * 7) % 3;
      const side = index % 2 ? 1 : -1;
      const props = [
        { m: 'barrel', x: side * (W / 2 - 0.55), z: D / 2 - 0.5, h: 0.78 },
        { m: 'crate_A_big', x: side * (W / 2 - 0.55), z: D / 2 - 0.5, h: 0.72 },
        { m: 'resource_lumber', x: side * (W / 2 - 0.7), z: D / 2 - 0.6, w: 1.1 },
      ];
      return [main(m, { stretch: 1.3 }), props[extra]];
    }
  }
}
