// Cenário do KayKit Medieval Hexagon Pack (Kay Lousberg, CC0): prédios, árvores, pedras, muralhas e objetos.
// Todos os modelos vêm de um único GLB (gerado por tools/medieval/convert.mjs) e dividem um material com atlas.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const URL = '/kaykit/medieval/medieval.glb';

export const medieval = {
  ready: false,
  geos: new Map(),
  shared: new Set(), // geometrias do pack (não podem ser descartadas com a zona)
  material: null,

  async load(onProgress = () => {}) {
    try {
      const gltf = await new GLTFLoader().loadAsync(URL, (e) => { if (e.total) onProgress(e.loaded / e.total); });
      gltf.scene.traverse((o) => {
        if (!o.isMesh) return;
        o.geometry.computeBoundingBox();
        this.geos.set(o.name, o.geometry);
        this.shared.add(o.geometry);
        if (!this.material) this.material = o.material;
      });
      const m = this.material;
      m.userData.shared = true;
      m.roughness = 0.85;
      m.metalness = 0;
      if (m.map) { m.map.magFilter = THREE.LinearFilter; m.map.generateMipmaps = false; m.map.minFilter = THREE.LinearFilter; }
      this.ready = this.geos.size > 0;
    } catch (e) {
      console.warn('[cenário] modelos medievais indisponíveis, usando formas simples', e);
    }
    onProgress(1);
  },

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

  mesh(name, scale = 1) {
    const m = new THREE.Mesh(this.geo(name), this.material);
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
  rack: { m: ['weaponrack'], h: 1.25 },
  sack: { m: ['sack'], w: 0.75 },
  lumber: { m: ['resource_lumber'], w: 1.15 },
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
