// Altar de viagem: plataforma de pedra, dois pilares com um arco, runas e um cristal flutuante. Fica sobre a área do portal.
// Tudo é desenhado aqui (geometria própria e texturas pintadas em canvas), sem depender de nenhum pacote de arte, então
// funciona em qualquer reino. Apagado (cinza) até o jogador descobrir o altar; depois as runas acendem.
import * as THREE from 'three';
import { Builder } from './castle3d.js';
import { lite } from './lite.js';

const TEX = 2; // metros por repetição da textura de pedra (a mesma escala do Builder)

// cores por reino; a passagem para outro reino brilha em violeta
const THEMES = {
  alvorada: { glow: 0x5dade2, spark: 0xaed6f1, stone: 0xc3c9d4, trim: 0x8b94a6 },
  sahaar: { glow: 0xffc34d, spark: 0xffe9a0, stone: 0xe6d0a2, trim: 0xb8935a },
  border: { glow: 0xb48cff, spark: 0xe2d4ff, stone: 0xc3c9d4, trim: 0x8b94a6 },
};

let shared = null;
function sharedTextures() {
  if (shared) return shared;
  // pedra: blocos com juntas e pontinhos, em tons de cinza (a cor do reino vem da cor do material)
  const stone = document.createElement('canvas');
  stone.width = stone.height = 256;
  let c = stone.getContext('2d');
  c.fillStyle = '#9a9a9a'; c.fillRect(0, 0, 256, 256);
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let row = 0; row < 8; row++) {
    const y = row * 32, off = row % 2 ? 32 : 0;
    for (let col = -1; col < 5; col++) {
      const x = col * 64 + off, v = 150 + Math.floor(rnd() * 70);
      c.fillStyle = `rgb(${v},${v},${v + 4})`; c.fillRect(x + 1, y + 1, 62, 30);
    }
  }
  for (let i = 0; i < 1400; i++) { const v = rnd() > 0.5 ? 255 : 0; c.fillStyle = `rgba(${v},${v},${v},${0.04 + rnd() * 0.07})`; c.fillRect(rnd() * 256, rnd() * 256, 1 + rnd() * 2, 1 + rnd() * 2); }
  c.strokeStyle = 'rgba(40,40,48,0.85)'; c.lineWidth = 2;
  for (let row = 0; row <= 8; row++) { c.beginPath(); c.moveTo(0, row * 32); c.lineTo(256, row * 32); c.stroke(); }
  for (let row = 0; row < 8; row++) { const off = row % 2 ? 32 : 0; for (let col = -1; col < 5; col++) { c.beginPath(); c.moveTo(col * 64 + off, row * 32); c.lineTo(col * 64 + off, row * 32 + 32); c.stroke(); } }
  const stoneTex = new THREE.CanvasTexture(stone);
  stoneTex.wrapS = stoneTex.wrapT = THREE.RepeatWrapping;
  stoneTex.colorSpace = THREE.SRGBColorSpace;
  stoneTex.anisotropy = 4;

  // círculo de runas (círculos concêntricos, símbolos e pontas) para o chão
  const ring = document.createElement('canvas');
  ring.width = ring.height = 256;
  c = ring.getContext('2d');
  c.translate(128, 128);
  c.strokeStyle = '#fff'; c.fillStyle = '#fff'; c.lineCap = 'round';
  for (const [r, w] of [[122, 4], [104, 2], [64, 2]]) { c.lineWidth = w; c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.stroke(); }
  for (let i = 0; i < 12; i++) {
    c.save(); c.rotate((i / 12) * Math.PI * 2);
    c.lineWidth = 3;
    c.beginPath(); c.moveTo(0, -112); c.lineTo(0, -92); c.moveTo(-7, -102); c.lineTo(7, -96); c.moveTo(7, -102); c.lineTo(-7, -96); c.stroke();
    c.restore();
  }
  c.lineWidth = 3;
  for (let k = 0; k < 2; k++) { c.save(); c.rotate(k * Math.PI / 4); c.strokeRect(-46, -46, 92, 92); c.restore(); }
  c.beginPath(); c.arc(0, 0, 14, 0, Math.PI * 2); c.stroke();
  const ringTex = new THREE.CanvasTexture(ring);
  ringTex.colorSpace = THREE.SRGBColorSpace;

  // cortina do portal: faixas verticais suaves que sobem
  const veil = document.createElement('canvas');
  veil.width = 64; veil.height = 128;
  c = veil.getContext('2d');
  const img = c.createImageData(64, 128);
  for (let y = 0; y < 128; y++) {
    for (let x = 0; x < 64; x++) {
      const edge = Math.sin((x / 63) * Math.PI);
      const streak = 0.5 + 0.5 * Math.sin(x * 0.55 + Math.sin(y * 0.09) * 3 + y * 0.03);
      const a = Math.max(0, edge * (0.25 + 0.75 * streak) * (0.5 + 0.5 * Math.sin((y / 127) * Math.PI * 2 - 1.2)));
      const i = (y * 64 + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = Math.floor(a * 255);
    }
  }
  c.putImageData(img, 0, 0);
  const veilTex = new THREE.CanvasTexture(veil);
  veilTex.wrapS = veilTex.wrapT = THREE.RepeatWrapping;

  // brilho redondo e suave (chão e centelhas)
  const gl = document.createElement('canvas');
  gl.width = gl.height = 64;
  c = gl.getContext('2d');
  const gr = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = gr; c.fillRect(0, 0, 64, 64);
  const glowTex = new THREE.CanvasTexture(gl);

  shared = { stoneTex, ringTex, veilTex, glowTex };
  return shared;
}

// vetor normal de um quadrilátero e a ordem dos vértices que o deixa virado para `want`
function face(b, a, p, q, r, s, want, uv) {
  const A = new THREE.Vector3(...p), B = new THREE.Vector3(...q), C = new THREE.Vector3(...r);
  const n = new THREE.Vector3().subVectors(B, A).cross(new THREE.Vector3().subVectors(C, A));
  const w = new THREE.Vector3(...want);
  if (n.dot(w) >= 0) b.quad(p, q, r, s, want, uv);
  else b.quad(p, s, r, q, want, [uv[0], uv[3], uv[2], uv[1]]);
}

// tronco de pirâmide (coluna que afina para cima) com o centro em (cx, cz)
function column(b, cx, cz, a0, a1, y0, y1) {
  const bot = [[cx - a0, cz - a0], [cx + a0, cz - a0], [cx + a0, cz + a0], [cx - a0, cz + a0]];
  const top = [[cx - a1, cz - a1], [cx + a1, cz - a1], [cx + a1, cz + a1], [cx - a1, cz + a1]];
  const h = y1 - y0, slope = (a0 - a1) / h;
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    const p0 = [bot[i][0], y0, bot[i][1]], p1 = [bot[j][0], y0, bot[j][1]], p2 = [top[j][0], y1, top[j][1]], p3 = [top[i][0], y1, top[i][1]];
    const mx = (bot[i][0] + bot[j][0]) / 2 - cx, mz = (bot[i][1] + bot[j][1]) / 2 - cz;
    const len = Math.hypot(mx, mz) || 1;
    const want = new THREE.Vector3(mx / len, slope, mz / len).normalize().toArray();
    const u = (v) => v / TEX;
    face(b, 0, p0, p1, p2, p3, want, [[u(p0[0] + p0[2]), u(y0)], [u(p1[0] + p1[2]), u(y0)], [u(p2[0] + p2[2]), u(y1)], [u(p3[0] + p3[2]), u(y1)]]);
  }
  face(b, 0, [top[0][0], y1, top[0][1]], [top[1][0], y1, top[1][1]], [top[2][0], y1, top[2][1]], [top[3][0], y1, top[3][1]], [0, 1, 0],
    [[0, 0], [a1 * 2 / TEX, 0], [a1 * 2 / TEX, a1 * 2 / TEX], [0, a1 * 2 / TEX]]);
}

// meia-coroa de pedra (o arco) com centro em (0, yc), raios r0 (dentro) e r1 (fora) e espessura d
function arch(b, yc, r0, r1, d, seg = 16) {
  const P = (r, t, z) => [Math.cos(t) * r, yc + Math.sin(t) * r, z];
  for (let i = 0; i < seg; i++) {
    const t0 = (i / seg) * Math.PI, t1 = ((i + 1) / seg) * Math.PI, tm = (t0 + t1) / 2;
    const u = (v) => v / TEX;
    for (const z of [d / 2, -d / 2]) {
      const o0 = P(r1, t0, z), o1 = P(r1, t1, z), i1 = P(r0, t1, z), i0 = P(r0, t0, z);
      face(b, 0, o0, o1, i1, i0, [0, 0, z > 0 ? 1 : -1], [[u(o0[0]), u(o0[1])], [u(o1[0]), u(o1[1])], [u(i1[0]), u(i1[1])], [u(i0[0]), u(i0[1])]]);
    }
    const arcOut = (r1 * (t1 - t0)) / TEX, arcIn = (r0 * (t1 - t0)) / TEX, off = (i * arcOut) % 4;
    face(b, 0, P(r1, t0, -d / 2), P(r1, t1, -d / 2), P(r1, t1, d / 2), P(r1, t0, d / 2), [Math.cos(tm), Math.sin(tm), 0], [[off, 0], [off + arcOut, 0], [off + arcOut, d / TEX], [off, d / TEX]]);
    face(b, 0, P(r0, t0, -d / 2), P(r0, t1, -d / 2), P(r0, t1, d / 2), P(r0, t0, d / 2), [-Math.cos(tm), -Math.sin(tm), 0], [[off, 0], [off + arcIn, 0], [off + arcIn, d / TEX], [off, d / TEX]]);
  }
}

export class Altar {
  // portal: { x, y, w, h }; kingdom: reino da zona; border: a passagem leva a outro reino
  constructor(portal, kingdom, border) {
    const th = border ? THEMES.border : THEMES[kingdom] || THEMES.alvorada;
    const tex = sharedTextures();
    const horiz = portal.w >= portal.h;
    const L = Math.max(portal.w, portal.h);
    const S = Math.max(3.2, Math.min(4.2, L)); // vão entre os pilares
    this.span = S;
    this.lit = 0; this.target = 0;
    this.group = new THREE.Group();
    const root = new THREE.Group(); // referencial do altar: o vão corre pelo eixo X e a frente olha para +Z
    root.rotation.y = horiz ? 0 : Math.PI / 2;
    this.group.add(root);

    const stone = new Builder(), trim = new Builder();
    const PW = 0.4; // meia largura do pilar
    const yA = 2.3; // altura em que o arco nasce
    // base em dois degraus
    trim.box(-S / 2 - 1.15, 0, -1.35, S / 2 + 1.15, 0.16, 1.35);
    stone.box(-S / 2 - 0.8, 0.16, -1.0, S / 2 + 0.8, 0.3, 1.0);
    // pilares: soco, fuste afinando, capitel
    for (const sx of [-1, 1]) {
      const cx = sx * (S / 2 + PW);
      trim.box(cx - PW - 0.12, 0.3, -PW - 0.12, cx + PW + 0.12, 0.62, PW + 0.12);
      column(stone, cx, 0, PW, PW * 0.82, 0.62, yA - 0.2);
      trim.box(cx - PW - 0.1, yA - 0.2, -PW - 0.1, cx + PW + 0.1, yA + 0.05, PW + 0.1);
    }
    // arco e pedra-chave
    arch(stone, yA + 0.05, S / 2, S / 2 + PW * 2, PW * 1.7);
    trim.box(-0.34, yA + 0.05 + S / 2 - 0.02, -PW * 1.7 / 2 - 0.1, 0.34, yA + 0.05 + S / 2 + PW * 2 + 0.12, PW * 1.7 / 2 + 0.1);
    // dois braseiros nas pontas da frente da base
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const bx = sx * (S / 2 + 0.6), bz = sz * 1.0;
      column(trim, bx, bz, 0.17, 0.12, 0.3, 0.78);
      trim.box(bx - 0.24, 0.78, bz - 0.24, bx + 0.24, 0.88, bz + 0.24);
    }
    const stoneMat = lite(new THREE.MeshStandardMaterial({ map: tex.stoneTex, color: th.stone, roughness: 0.95, metalness: 0 }));
    const trimMat = lite(new THREE.MeshStandardMaterial({ map: tex.stoneTex, color: th.trim, roughness: 0.95, metalness: 0 }));
    root.add(stone.mesh(stoneMat), trim.mesh(trimMat));
    this.mats = { stoneMat, trimMat };

    // runas que acendem: uma faixa em cada pilar (dos dois lados) e um friso no chão do degrau
    const runes = new Builder();
    for (const sx of [-1, 1]) {
      const cx = sx * (S / 2 + PW);
      for (const sz of [-1, 1]) {
        const z = sz * (PW * 0.86), w = 0.07;
        for (let k = 0; k < 4; k++) {
          const y = 0.95 + k * 0.28;
          runes.box(cx - 0.16, y, z + (sz > 0 ? 0 : -0.02), cx + 0.16, y + w, z + (sz > 0 ? 0.02 : 0));
          if (k % 2 === 0) runes.box(cx - 0.05, y + w, z + (sz > 0 ? 0 : -0.02), cx + 0.05, y + w + 0.17, z + (sz > 0 ? 0.02 : 0));
        }
      }
    }
    this.runeMat = new THREE.MeshBasicMaterial({ color: th.glow, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false });
    const runeMesh = new THREE.Mesh(runes.mesh(this.runeMat).geometry, this.runeMat);
    root.add(runeMesh);

    // círculo de runas girando no chão da base
    this.discMat = new THREE.MeshBasicMaterial({ map: tex.ringTex, color: th.glow, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false });
    this.disc = new THREE.Mesh(new THREE.PlaneGeometry(S * 0.62, S * 0.62).rotateX(-Math.PI / 2), this.discMat);
    this.disc.position.y = 0.315;
    root.add(this.disc);

    // brilho no chão em volta
    this.floorMat = new THREE.MeshBasicMaterial({ map: tex.glowTex, color: th.glow, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(S + 3.2, 4.2).rotateX(-Math.PI / 2), this.floorMat);
    floor.position.y = 0.04;
    root.add(floor);

    // cortina do portal sob o arco
    const sh = new THREE.Shape();
    sh.moveTo(-S / 2, 0.3); sh.lineTo(S / 2, 0.3); sh.lineTo(S / 2, yA + 0.05); sh.absarc(0, yA + 0.05, S / 2, 0, Math.PI, false); sh.lineTo(-S / 2, 0.3);
    const vg = new THREE.ShapeGeometry(sh, 24);
    const vp = vg.attributes.position, vuv = vg.attributes.uv, top = yA + 0.05 + S / 2;
    for (let i = 0; i < vp.count; i++) vuv.setXY(i, vp.getX(i) / S + 0.5, (vp.getY(i) - 0.3) / (top - 0.3));
    this.veilMat = new THREE.MeshBasicMaterial({ map: tex.veilTex, color: th.glow, transparent: true, opacity: 0.06, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    root.add(new THREE.Mesh(vg, this.veilMat));

    // cristal flutuando sob a pedra-chave
    this.crystalMat = lite(new THREE.MeshStandardMaterial({ color: 0x1b2230, emissive: th.glow, emissiveIntensity: 0.1, roughness: 0.2, metalness: 0.1, flatShading: true }));
    this.crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.34).scale(0.7, 1.25, 0.7), this.crystalMat);
    this.crystalY = yA + 0.05 + S / 2 - 0.5;
    this.crystal.position.y = this.crystalY;
    root.add(this.crystal);
    this.crystalGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.glowTex, color: th.glow, transparent: true, opacity: 0.15, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.crystalGlow.scale.setScalar(1.6);
    this.crystalGlow.position.y = this.crystalY;
    root.add(this.crystalGlow);

    // centelhas subindo em volta do vão (só quando o altar está aceso)
    const N = 28;
    this.sparkPos = new Float32Array(N * 3);
    this.sparkSeed = Array.from({ length: N }, () => [Math.random(), Math.random(), Math.random()]);
    this.sparks = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(this.sparkPos, 3)),
      new THREE.PointsMaterial({ size: 0.16, map: tex.glowTex, color: th.spark, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true }));
    this.sparks.frustumCulled = false;
    root.add(this.sparks);

    // chamas dos braseiros, em coordenadas do grupo (o referencial do altar é girado)
    const rot = horiz ? 0 : Math.PI / 2, cr = Math.cos(rot), sr = Math.sin(rot);
    this.flames = [];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const bx = sx * (S / 2 + 0.6), bz = sz * 1.0;
      this.flames.push({ x: bx * cr + bz * sr, y: 1.05, z: -bx * sr + bz * cr, color: th.glow, core: th.spark });
    }
    this.root = root;
    this.th = th;
    this.apply();
  }

  // acende (animando) ou apaga o altar
  setLit(on, instant = false) {
    this.target = on ? 1 : 0;
    if (instant) { this.lit = this.target; this.apply(); }
  }

  apply() {
    const k = this.lit;
    this.runeMat.opacity = 0.16 + 0.84 * k;
    this.discMat.opacity = 0.22 + 0.6 * k;
    this.floorMat.opacity = 0.1 + 0.55 * k;
    this.veilMat.opacity = 0.04 + 0.3 * k;
    this.crystalMat.emissiveIntensity = 0.08 + 1.5 * k;
    this.crystalGlow.material.opacity = 0.1 + 0.6 * k;
    this.sparks.material.opacity = k * 0.9;
    this.sparks.visible = k > 0.02;
    this.stoneTint = k;
  }

  update(t, dt) {
    if (this.lit !== this.target) {
      this.lit += Math.sign(this.target - this.lit) * Math.min(Math.abs(this.target - this.lit), dt * 0.8);
      this.apply();
    }
    const pulse = 0.88 + 0.12 * Math.sin(t * 2.2 + this.group.position.x);
    this.disc.rotation.y = t * 0.35;
    this.crystal.rotation.y = t * 0.9;
    this.crystal.position.y = this.crystalY + Math.sin(t * 1.6) * 0.07;
    this.crystalGlow.position.y = this.crystal.position.y;
    this.crystalGlow.scale.setScalar(1.5 + 0.2 * Math.sin(t * 2.2));
    if (this.lit > 0.02) {
      this.runeMat.opacity = (0.16 + 0.84 * this.lit) * pulse;
      const S = this.span, pos = this.sparkPos;
      for (let i = 0; i < this.sparkSeed.length; i++) {
        const sd = this.sparkSeed[i], life = (t * (0.12 + sd[2] * 0.12) + sd[0]) % 1;
        const side = i % 2 ? 1 : -1; // metade perto de cada pilar
        pos[i * 3] = side * (S / 2 + 0.4) + (sd[1] - 0.5) * 1.2;
        pos[i * 3 + 1] = 0.4 + life * 2.8;
        pos[i * 3 + 2] = (sd[2] - 0.5) * 1.6 + Math.sin(t + sd[0] * 9) * 0.1;
      }
      this.sparks.geometry.attributes.position.needsUpdate = true;
    }
    sharedTextures().veilTex.offset.y = -t * 0.12;
  }

  dispose() {
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      const m = o.material;
      if (m && m.dispose) m.dispose();
    });
  }
}
