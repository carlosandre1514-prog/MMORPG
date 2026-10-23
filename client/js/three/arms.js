// Armas extras do Reino de Sahaar (assets/weapons/weapons.glb, gerado por tools/weapons/convert.mjs): cimitarras, espada e escudo
// dourados, martelos e arco. Vêm de dois pacotes (Quaternius, CC0, e PolyPack Medieval Swords de Alstra Infinite, CC BY 4.0: veja
// assets/weapons/LICENSE.txt) e só são baixadas ao entrar no reino. Cada arma sai com o cabo na origem e a lâmina em +Y, como as
// armas KayKit, então entram nas mãos dos personagens do mesmo jeito; o saque no chão usa a mesma interface do `medieval`.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { lite } from './lite.js';

export const arms = {
  ready: false,
  geos: new Map(),
  shared: new Set(),
  material: null,

  async load(onProgress = () => {}) {
    try {
      const gltf = await new GLTFLoader().loadAsync('/weapons/weapons.glb', (e) => { if (e.total) onProgress(e.loaded / e.total); });
      let mat = null;
      gltf.scene.traverse((o) => {
        if (!o.isMesh) return;
        o.geometry.computeBoundingBox();
        this.geos.set(o.name, o.geometry);
        this.shared.add(o.geometry);
        mat ||= o.material;
      });
      if (mat) {
        this.material = lite(mat);
        this.material.userData.shared = true;
      }
      this.ready = this.geos.size > 0;
    } catch (e) {
      console.warn('[armas] armas de Sahaar indisponíveis', e);
    }
    onProgress(1);
  },

  has(name) { return this.ready && this.geos.has(name); },
  geo(name) { return this.geos.get(name); },
  size(name) { return this.geos.get(name).boundingBox.getSize(new THREE.Vector3()); },
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
    return m;
  },
  // arma na mão de um personagem: novo grupo com a malha (o material é trocado pelo `applyTint` de quem chama)
  held(name) {
    if (!this.has(name)) return null;
    const g = new THREE.Group();
    const m = new THREE.Mesh(this.geo(name), this.material);
    m.castShadow = true;
    g.add(m);
    return g;
  },
};
