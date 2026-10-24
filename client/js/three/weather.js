// Clima em partículas em volta do jogador: neve (Picos Gelados e Cidadela de Gelo), cinzas (Ruínas de Cinza) e esporos que
// flutuam (Pântano das Brumas). Uma só nuvem de pontos que acompanha a câmera, com poucos centenas de pontos.
import * as THREE from 'three';
import { quality } from '../device.js';

const Q = quality();
const SPAN = 26; // metade do lado da caixa de partículas (em tiles)
const HEIGHT = 15;

const KINDS = {
  snow: { color: 0xffffff, size: 0.17, opacity: 0.9, fall: [1.1, 1.9], sway: 0.6, additive: false, count: 650 },
  ash: { color: 0xc9b9a8, size: 0.13, opacity: 0.7, fall: [0.5, 1.1], sway: 0.9, additive: false, count: 380 },
  spores: { color: 0x9dffb0, size: 0.14, opacity: 0.75, fall: [-0.25, 0.15], sway: 0.5, additive: true, count: 260 },
};

let dotTex = null;
function dot() {
  if (dotTex) return dotTex;
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.5, 'rgba(255,255,255,0.7)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 32, 32);
  dotTex = new THREE.CanvasTexture(c);
  return dotTex;
}

// qual clima a zona tem (ou null)
export function weatherOf(def) {
  if (def.snow) return 'snow';
  if (def.ash) return 'ash';
  if (def.fog) return 'spores';
  return null;
}

export class Weather {
  constructor(kind) {
    const k = KINDS[kind];
    this.kind = kind;
    this.k = k;
    const n = Math.round(k.count * (Q.low ? 0.45 : 1));
    this.n = n;
    this.pos = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3);
    this.phase = new Float32Array(n);
    for (let i = 0; i < n; i++) this.respawn(i, true);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    const mat = new THREE.PointsMaterial({
      color: k.color, size: k.size * 4, map: dot(), transparent: true, opacity: k.opacity, depthWrite: false, sizeAttenuation: true,
      blending: k.additive ? THREE.AdditiveBlending : THREE.NormalBlending, fog: false,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    this.cx = 0; this.cz = 0;
  }

  // posição relativa à caixa (0..2*SPAN em x/z)
  respawn(i, anywhere) {
    const k = this.k;
    this.pos[i * 3] = Math.random() * SPAN * 2;
    this.pos[i * 3 + 1] = anywhere ? Math.random() * HEIGHT : (k.fall[0] > 0 ? HEIGHT : 0.2);
    this.pos[i * 3 + 2] = Math.random() * SPAN * 2;
    this.vel[i * 3 + 1] = -(k.fall[0] + Math.random() * (k.fall[1] - k.fall[0]));
    this.phase[i] = Math.random() * 6.28;
  }

  update(dt, px, pz, t) {
    const k = this.k;
    const p = this.pos, v = this.vel;
    // a caixa segue o jogador; as partículas ficam fixas no mundo e dão a volta ao sair da caixa
    const ox = px - SPAN, oz = pz - SPAN;
    for (let i = 0; i < this.n; i++) {
      const j = i * 3;
      p[j + 1] += v[j + 1] * dt;
      p[j] += Math.sin(t * 0.9 + this.phase[i]) * k.sway * dt;
      p[j + 2] += Math.cos(t * 0.7 + this.phase[i] * 1.3) * k.sway * dt * 0.8;
      if (p[j + 1] < 0 || p[j + 1] > HEIGHT + 1) this.respawn(i, false);
      // laço dentro da caixa que acompanha o jogador
      if (p[j] < 0) p[j] += SPAN * 2; else if (p[j] > SPAN * 2) p[j] -= SPAN * 2;
      if (p[j + 2] < 0) p[j + 2] += SPAN * 2; else if (p[j + 2] > SPAN * 2) p[j + 2] -= SPAN * 2;
    }
    this.points.position.set(ox, 0, oz);
    this.points.geometry.attributes.position.needsUpdate = true;
  }

  dispose() {
    this.points.geometry.dispose();
    this.points.material.dispose();
  }
}
