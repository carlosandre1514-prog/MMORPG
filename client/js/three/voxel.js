// Prédios em voxel (MagicaVoxel): as torres de barro de Zahrim, a capital do Reino de Sahaar (carregados só ao entrar no reino).
// O GLB (assets/voxel/voxel.glb, gerado por tools/voxel/convert.mjs) traz cada prédio completo e uma versão @lod bem
// simplificada para quando está longe. São construções maciças: o servidor as trata como paredes (sem porta nem interior).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { lite } from './lite.js';
import { quality } from '../device.js';

const MAX_H = 12; // altura máxima de uma torre, em tiles (a estrutura pode pedir outra em st.maxH)
const MAX_SCALE = 1.6; // nenhum modelo cresce mais que isso, mesmo cabendo na área
const FACE_ROT = { s: 0, n: Math.PI, e: Math.PI / 2, w: -Math.PI / 2 };

export const voxel = {
  ready: false,
  models: new Map(), // nome -> { geo, lod, size }
  shared: new Set(), // geometrias que não podem ser descartadas junto com a zona
  mat: null,

  async load(onProgress = () => {}) {
    try {
      const gltf = await new GLTFLoader().loadAsync('/voxel/voxel.glb', (e) => { if (e.total) onProgress(e.loaded / e.total); });
      const geos = new Map();
      gltf.scene.traverse((o) => {
        if (!o.isMesh) return;
        o.geometry.computeBoundingBox();
        geos.set(o.name, o.geometry);
        this.shared.add(o.geometry);
      });
      for (const [name, geo] of geos) {
        if (name.endsWith('@lod')) continue;
        this.models.set(name, { geo, lod: geos.get(name + '@lod') || geo, size: geo.boundingBox.getSize(new THREE.Vector3()) });
      }
      // cores vêm dos vértices; nos perfis leves vira Lambert (lite)
      this.mat = lite(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 }));
      this.mat.userData.shared = true;
      this.ready = this.models.size > 0;
    } catch (e) {
      console.warn('[cenário] prédios em voxel indisponíveis', e);
    }
    onProgress(1);
  },

  has(name) { return this.ready && this.models.has(name); },

  // Monta as torres das estruturas `list` ({ x, y, w, h, face, model }); update(px, pz) liga a versão certa conforme a distância
  build(list) {
    const group = new THREE.Group();
    const items = [];
    for (const st of list) {
      const mod = this.models.get(st.model) || this.models.values().next().value;
      const side = st.face === 'e' || st.face === 'w';
      const W = side ? st.h : st.w, D = side ? st.w : st.h;
      // cabe na área da construção (sem encostar nos vizinhos) e não passa da altura máxima
      const s = Math.min((W - 0.6) / mod.size.x, (D - 0.3) / mod.size.z, (st.maxH || MAX_H) / mod.size.y, st.maxScale || MAX_SCALE);
      const x = st.x + st.w / 2, z = st.y + st.h / 2;
      const make = (geo) => {
        const m = new THREE.Mesh(geo, this.mat);
        m.scale.setScalar(s);
        m.rotation.y = FACE_ROT[st.face || 's'];
        m.position.set(x, 0, z);
        m.castShadow = true;
        m.receiveShadow = true;
        m.visible = false;
        group.add(m);
        return m;
      };
      items.push({ x, z, full: make(mod.geo), far: mod.lod === mod.geo ? null : make(mod.lod), state: -1 });
    }
    const self = {
      group,
      lastX: 1e9, lastZ: 1e9, lastT: 0,
      // 0 = escondida, 1 = versão simplificada, 2 = completa; as distâncias seguem a distância de visão dos gráficos
      update(px, pz, force = false) {
        const now = performance.now();
        if (!force && (now - self.lastT < 250 || (Math.abs(px - self.lastX) < 0.5 && Math.abs(pz - self.lastZ) < 0.5))) return;
        self.lastT = now; self.lastX = px; self.lastZ = pz;
        const Q = quality();
        const full2 = (Q.lodR * 1.5 + 6) ** 2, far2 = (34 + Q.cullR * 2) ** 2;
        for (const it of items) {
          const d2 = (it.x - px) ** 2 + (it.z - pz) ** 2;
          const state = d2 < full2 || !it.far ? (d2 < far2 ? 2 : 0) : d2 < far2 ? 1 : 0;
          if (state === it.state) continue;
          it.state = state;
          it.full.visible = state === 2;
          if (it.far) it.far.visible = state === 1;
        }
      },
    };
    return self;
  },
};
