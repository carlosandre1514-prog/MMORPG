// Cena de abertura das telas de login, personagens e criação: o Santuário de Lúmen ao entardecer. A Chama Partida arde sobre um altar
// em ruínas e as três Brasas (Vida, Terra e Espírito) giram em volta dela; ao fundo, montanhas, a silhueta do castelo de Alvorada,
// névoa baixa, cinzas e brasas no ar. A câmera dá uma volta lenta e acompanha o mouse/toque. Usa os modelos do cenário (KayKit) e os
// shaders de vfx.js; é desenhada no canvas #backdrop e destruída ao entrar no jogo (libera a placa de vídeo para o mundo).
// Nos perfis fracos (efeitos Simples) a cena é mais simples: sem névoa em shader, menos luzes e partículas, 30 quadros por segundo.
import * as THREE from 'three';
import { quality } from '../device.js';
import { medieval } from './medieval.js';
import { lite } from './lite.js';
import { fxMaterial, vfxTime, palette, geoFlat, geoColumn, geoComet, quadMesh, meshOf } from './vfx.js';
import { glowTexture } from './world3d.js';
import { fbm, mulberry32 } from '/shared/rng.js';

const Q = quality();

const SKY_VS = `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const SKY_FS = `
uniform float uTime; varying vec3 vDir;
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y); }
void main(){
  float y = vDir.y;
  vec3 top = vec3(0.012, 0.02, 0.07), mid = vec3(0.09, 0.06, 0.17), hor = vec3(0.62, 0.24, 0.1);
  float t = clamp(y, 0.0, 1.0);
  vec3 c = mix(hor, mid, smoothstep(0.0, 0.22, t));
  c = mix(c, top, smoothstep(0.18, 0.8, t));
  vec3 hz = normalize(vec3(vDir.x, 0.0001, vDir.z));
  float toCastle = max(dot(hz, normalize(vec3(-0.35, 0.0, -1.0))), 0.0);
  c += vec3(0.55, 0.2, 0.05) * pow(toCastle, 4.0) * exp(-abs(y) * 5.5) * 0.9;
  // estrelas
  vec2 sp = vDir.xz / (abs(y) + 0.25) * 55.0;
  float hs = h21(floor(sp));
  float star = step(0.992, hs) * smoothstep(0.08, 0.5, y) * (0.55 + 0.45 * sin(uTime * 1.7 + hs * 60.0));
  c += vec3(0.85, 0.9, 1.0) * star * 0.9;
  // lua
  vec3 md = normalize(vec3(0.5, 0.36, -0.78));
  float m = dot(vDir, md);
  c += vec3(0.8, 0.86, 1.0) * smoothstep(0.9988, 0.9994, m);
  c += vec3(0.22, 0.28, 0.5) * pow(max(m, 0.0), 80.0) * 0.55;
  // nuvens fininhas
  vec2 cp = vDir.xz / (y + 0.35) * 1.6 + vec2(uTime * 0.01, 0.0);
  float cl = smoothstep(0.52, 0.85, vn(cp * 2.0) * 0.6 + vn(cp * 5.0) * 0.4) * smoothstep(0.02, 0.2, y) * (1.0 - smoothstep(0.3, 0.7, y));
  c = mix(c, vec3(0.2, 0.12, 0.2) + hor * 0.25, cl * 0.55);
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const rng = mulberry32(2024);
const R = (a, b) => a + rng() * (b - a);
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// altura do terreno: plataforma plana em volta do altar, colinas ao redor e uma colina maior onde fica o castelo
const CASTLE = { x: -24, z: -52 };
function groundY(x, z) {
  const r = Math.hypot(x, z);
  const hills = (fbm(x * 0.045, z * 0.045, 11, 3) - 0.45) * 7;
  const flat = 1 - smooth(5, 15, r);
  const hill = 7 * Math.exp(-((x - CASTLE.x) ** 2 + (z - CASTLE.z) ** 2) / 260);
  return hills * (1 - flat) + hill + (r < 5.2 ? 0.25 * (1 - smooth(3.8, 5.2, r)) : 0);
}

function groundMesh(level) {
  const SIZE = 150, N = level >= 2 ? 96 : 56;
  const g = new THREE.PlaneGeometry(SIZE, SIZE, N, N).rotateX(-Math.PI / 2);
  const pos = g.attributes.position, col = new Float32Array(pos.count * 3), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const y = groundY(x, z);
    pos.setY(i, y);
    const r = Math.hypot(x, z);
    const n = fbm(x * 0.12, z * 0.12, 5, 2);
    c.setRGB(0.1 + n * 0.1, 0.1 + n * 0.12, 0.09 + n * 0.08);                      // terra escura e cinzas
    c.lerp(new THREE.Color(0.08, 0.15, 0.1), smooth(0.45, 0.8, fbm(x * 0.05, z * 0.05, 9, 2)) * 0.8); // manchas de musgo
    c.lerp(new THREE.Color(0.3, 0.28, 0.32), (1 - smooth(3.6, 5.4, r)) * 0.9);     // pedra do altar
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return new THREE.Mesh(g, lite(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 })));
}

// silhueta de montanhas distantes (faixa com o topo em ruído), pintada na cor da névoa para sumir no horizonte
function ridge(z, amp, base, color, seed) {
  const N = 140, W = 420;
  const pos = [], idx = [];
  for (let i = 0; i <= N; i++) {
    const x = -W / 2 + (i / N) * W;
    const h = base + (fbm(x * 0.012, seed, seed, 4) - 0.35) * amp + Math.abs(Math.sin(x * 0.021 + seed)) * amp * 0.25;
    pos.push(x, -20, z, x, h, z);
    if (i < N) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, fog: true, side: THREE.DoubleSide }));
}

const stoneMat = () => lite(new THREE.MeshStandardMaterial({ color: 0x4a4650, roughness: 0.95, metalness: 0 }));

function makeParticles(n, spread, height, tex, size, additive) {
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), seed = new Float32Array(n);
  for (let i = 0; i < n; i++) { seed[i] = rng(); }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = new THREE.Points(g, new THREE.PointsMaterial({ size, map: tex, vertexColors: true, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, sizeAttenuation: true, fog: false }));
  m.frustumCulled = false;
  return { m, pos, col, seed, n, spread, height };
}

function build(level, scene, camera) {
  const parts = []; // { update(t, dt) }
  const tex = glowTexture();
  const fire = palette('fire');

  // céu e luzes
  const sky = new THREE.Mesh(new THREE.SphereGeometry(300, 24, 16), new THREE.ShaderMaterial({ uniforms: { uTime: vfxTime }, vertexShader: SKY_VS, fragmentShader: SKY_FS, side: THREE.BackSide, depthWrite: false, fog: false }));
  sky.renderOrder = -10;
  scene.add(sky);
  parts.push({ update: () => sky.position.copy(camera.position) });
  scene.fog = new THREE.FogExp2(0x2b1b31, level >= 1 ? 0.013 : 0.016);
  scene.add(new THREE.HemisphereLight(0x6c7cc0, 0x2c1a14, 0.7));
  const moon = new THREE.DirectionalLight(0x9db8ff, 0.8);
  moon.position.set(35, 26, -50);
  scene.add(moon);

  // terreno e cordilheiras
  scene.add(groundMesh(level));
  const ridges = [[-95, 38, 14, 0x1d1730, 3], [-130, 55, 26, 0x16122a, 7], [-175, 80, 40, 0x110e24, 13]];
  for (const [z, amp, base, color, seed] of ridges.slice(0, level >= 1 ? 3 : 2)) scene.add(ridge(z, amp, base, color, seed));

  // altar: pedestal de pedra, colunas quebradas e tochas
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.45, 0.55, 20), stoneMat());
  ped.position.set(0, 0.52, 0);
  scene.add(ped);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.05, 0.12, 20), new THREE.MeshStandardMaterial({ color: 0x1a1214, roughness: 1, emissive: 0x401408, emissiveIntensity: 1 }));
  cap.position.set(0, 0.84, 0);
  scene.add(cap);

  // chama central
  const flame = new THREE.Group();
  flame.position.set(0, 0.9, 0);
  scene.add(flame);
  const core = quadMesh(fxMaterial('flare', { uA: fire[0], uB: fire[1], uEmis: 1.2, uStreaks: 5, uId: 1.3 }), 4.4);
  core.position.y = 1.7;
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xff7a24, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.55, fog: false }));
  halo.scale.setScalar(9);
  halo.position.y = 1.7;
  flame.add(core, halo);
  let beam = null, floorGlow = null;
  if (level >= 1) {
    beam = meshOf(geoColumn(), fxMaterial('lift', { uA: fire[0], uB: fire[1], uEmis: 1.1 }));
    beam.scale.set(0.8, 4.2, 0.8);
    floorGlow = meshOf(geoFlat(), fxMaterial('ground', { uA: fire[1], uB: fire[2], uEmis: 1.0, uCurve: 1.2 }, { offset: -2 }), 28);
    floorGlow.scale.setScalar(7);
    floorGlow.position.y = 0.05;
    flame.add(beam, floorGlow);
  }
  const fl = new THREE.PointLight(0xff8c3a, 95, 26, 2);
  fl.position.set(0, 2.9, 0);
  scene.add(fl);
  parts.push({
    update(t) {
      const k = 0.85 + Math.sin(t * 7.1) * 0.07 + Math.sin(t * 13.3 + 1.7) * 0.05 + Math.sin(t * 2.3) * 0.05;
      fl.intensity = 95 * k;
      halo.material.opacity = 0.5 * k;
      core.material.uniforms.uLife.value = Math.min(1, 0.85 * k);
      core.material.uniforms.uId.value = t * 0.35;
      if (beam) beam.material.uniforms.uLife.value = Math.min(1, 0.9 * k);
      if (floorGlow) floorGlow.material.uniforms.uLife.value = 0.6 * k;
    },
  });

  // as três Brasas: Vida (verde), Terra (âmbar) e Espírito (violeta), em órbitas inclinadas, cada uma com cauda de cometa
  const ember = (pal, radius, speed, tilt, phase) => {
    const g = new THREE.Group();
    const flare = quadMesh(fxMaterial('flare', { uA: pal[1], uB: pal[2], uEmis: 1.5, uStreaks: 4, uId: phase }), 2.0);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8), new THREE.MeshBasicMaterial({ color: pal[0].clone().lerp(pal[1], 0.5), fog: false }));
    g.add(flare, dot);
    let tail = null;
    if (level >= 1) {
      tail = meshOf(geoComet(), fxMaterial('proj', { uA: pal[0].clone().lerp(pal[1], 0.5), uB: pal[1], uC: pal[2], uEmis: 0.8 }));
      tail.scale.set(1.0, 1.0, 1.7);
      g.add(tail);
    }
    let light = null;
    if (level >= 2) { light = new THREE.PointLight(pal[1], 7, 7, 2); g.add(light); }
    scene.add(g);
    const rot = new THREE.Euler(tilt[0], tilt[1], tilt[2]);
    const at = (a, out) => out.set(Math.cos(a) * radius, 0, Math.sin(a) * radius).applyEuler(rot).add(new THREE.Vector3(0, 2.6, 0));
    const p0 = new THREE.Vector3(), p1 = new THREE.Vector3();
    parts.push({
      update(t) {
        const a = phase + t * speed;
        at(a, p0); at(a + Math.sign(speed) * 0.06, p1);
        g.position.copy(p0);
        if (tail) { tail.lookAt(p1.x, p1.y, p1.z); }
        flare.material.uniforms.uId.value = t * 0.5 + phase;
        flare.material.uniforms.uLife.value = 0.85 + Math.sin(t * 5 + phase * 3) * 0.15;
      },
    });
  };
  ember(palette('heal'), 2.6, 0.62, [0.55, 0, 0.1], 0);
  ember(palette('holy'), 2.9, -0.5, [-0.5, 0, 0.75], 2.1);
  ember(palette('arcane'), 3.2, 0.4, [0.2, 0, -0.95], 4.2);

  // brasas subindo da chama e cinzas à deriva
  const embers = makeParticles(level >= 2 ? 130 : level === 1 ? 80 : 40, 3.4, 9, tex, 0.2, true);
  const ash = makeParticles(level >= 2 ? 120 : level === 1 ? 70 : 30, 26, 14, tex, 0.12, false);
  scene.add(embers.m, ash.m);
  const tmp = new THREE.Color();
  parts.push({
    update(t) {
      for (let i = 0; i < embers.n; i++) {
        const s = embers.seed[i], life = ((t * (0.07 + s * 0.08) + s * 7) % 1);
        const a = s * 91.7 + t * (0.1 + s * 0.2);
        const rad = embers.spread * (0.15 + 0.85 * s) * (0.4 + life * 0.8);
        embers.pos[i * 3] = Math.cos(a) * rad + Math.sin(t * 0.6 + s * 20) * 0.4 * life;
        embers.pos[i * 3 + 1] = 1.4 + life * embers.height;
        embers.pos[i * 3 + 2] = Math.sin(a) * rad;
        tmp.setRGB(1.0, 0.45 + s * 0.35, 0.12).multiplyScalar(Math.sin(life * Math.PI) * 0.9);
        embers.col[i * 3] = tmp.r; embers.col[i * 3 + 1] = tmp.g; embers.col[i * 3 + 2] = tmp.b;
      }
      embers.m.geometry.attributes.position.needsUpdate = true;
      embers.m.geometry.attributes.color.needsUpdate = true;
      for (let i = 0; i < ash.n; i++) {
        const s = ash.seed[i], life = ((t * (0.012 + s * 0.012) + s * 13) % 1);
        ash.pos[i * 3] = (s * 2 - 1) * ash.spread + Math.sin(t * 0.3 + s * 40) * 1.5 + life * 5;
        ash.pos[i * 3 + 1] = ash.height * (1 - life) + 0.2;
        ash.pos[i * 3 + 2] = (((s * 7.31) % 1) * 2 - 1) * ash.spread * 0.8 - 4 + Math.cos(t * 0.25 + s * 30) * 1.2;
        const f = Math.sin(life * Math.PI) * 0.55;
        ash.col[i * 3] = 0.5 * f; ash.col[i * 3 + 1] = 0.47 * f; ash.col[i * 3 + 2] = 0.52 * f;
      }
      ash.m.geometry.attributes.position.needsUpdate = true;
      ash.m.geometry.attributes.color.needsUpdate = true;
    },
  });

  // névoa baixa em movimento
  if (level >= 1) {
    const mists = [[0.35, 110, 0.24, [0.02, 0.008]], [1.0, 90, 0.18, [-0.015, 0.012]], [2.0, 70, 0.12, [0.01, -0.01]]];
    for (const [y, size, life, drift] of mists.slice(0, level >= 2 ? 3 : 2)) {
      const m = meshOf(geoFlat(), fxMaterial('mist', { uA: new THREE.Color(0.25, 0.2, 0.32), uLife: life, uScale: 5, uDrift: new THREE.Vector2(...drift) }), 20);
      m.scale.setScalar(size);
      m.position.y = y;
      scene.add(m);
    }
  }

  // modelos do cenário (KayKit): entram assim que o pacote termina de carregar
  let modelsDone = false;
  const addModels = () => {
    modelsDone = true;
    const place = (name, x, z, h, rot = 0, extra = {}) => {
      if (!medieval.has(name)) return null;
      const k = medieval.fit(name, extra.w, extra.d, h);
      const m = medieval.mesh(name, k);
      const box = medieval.geo(name).boundingBox;
      const y = groundY(x, z) - box.min.y * k + (extra.dy || 0);
      const holder = new THREE.Group();
      holder.add(m);
      m.position.set(-(box.min.x + box.max.x) / 2 * k, 0, -(box.min.z + box.max.z) / 2 * k);
      holder.position.set(x, y, z);
      holder.rotation.y = rot;
      scene.add(holder);
      return holder;
    };
    // altar
    const ring = [['pillar', 2.9], ['column', 1.5], ['pillar_decorated', 2.9], ['column', 1.2], ['pillar', 2.5], ['column', 1.7], ['pillar', 3.0], ['rubble_half', 0.7]];
    // as colunas não ficam entre a câmera e a chama (a câmera passa pelo lado de +Z)
    ring.forEach(([n, h], i) => { const a = (i / ring.length) * Math.PI * 2 + 0.3; if (a > 0.9 && a < 2.9) return; place(n, Math.cos(a) * 4.6, Math.sin(a) * 4.6, h, R(0, 6)); });
    for (let i = 0; i < 7; i++) { const a = R(0, 6.28), d = R(2.4, 6.4); if (a > 1.0 && a < 2.8 && d < 5) continue; place('rubble_half', Math.cos(a) * d, Math.sin(a) * d, R(0.35, 0.7), R(0, 6)); }
    // tochas em volta
    for (let i = 0; i < 3; i++) {
      const a = 0.9 + i * 2.1, x = Math.cos(a) * 6.3, z = Math.sin(a) * 6.3;
      if (!place('torch_lit', x, z, 1.5, 0)) continue;
      const f = quadMesh(fxMaterial('flare', { uA: fire[0], uB: fire[1], uEmis: 1.0, uStreaks: 4, uId: i }), 1.1);
      f.position.set(x, groundY(x, z) + 1.35, z);
      scene.add(f);
      parts.push({ update: (t) => { f.material.uniforms.uLife.value = 0.8 + Math.sin(t * 9 + i * 2) * 0.15; f.material.uniforms.uId.value = t * 0.4 + i; } });
    }
    // castelo de Alvorada ao longe, com luzes nas janelas
    place('building_castle_blue', CASTLE.x, CASTLE.z, 17, 0.5);
    place('building_tower_A_blue', CASTLE.x + 11, CASTLE.z + 4, 11, 0.2);
    place('building_tower_A_blue', CASTLE.x - 12, CASTLE.z + 5, 9, 0.9);
    place('building_windmill_blue', CASTLE.x + 22, CASTLE.z + 9, 9, 0.4);
    for (let i = 0; i < 6; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xffb24a, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.9, fog: false }));
      s.scale.setScalar(0.7 + (i % 3) * 0.25);
      s.material.opacity = 0.65;
      s.position.set(CASTLE.x + R(-5, 5), groundY(CASTLE.x, CASTLE.z) + R(5, 11), CASTLE.z + 6.5);
      scene.add(s);
    }
    // montanhas
    const mount = ['mountain_A', 'mountain_B', 'mountain_C'];
    for (let i = 0; i < (level >= 1 ? 9 : 5); i++) {
      const x = -90 + i * 24 + R(-6, 6), z = -88 - R(0, 14);
      place(mount[i % 3], x, z, R(22, 34), R(0, 6), { dy: -3 });
    }
    // árvores e pedras (instanciadas)
    const trees = ['trees_A_large', 'trees_B_large', 'trees_A_medium', 'trees_B_medium'];
    const nTrees = level >= 2 ? 70 : level === 1 ? 40 : 22;
    const per = {};
    for (let i = 0; i < nTrees; i++) {
      const side = i % 5 === 0; // algumas nas laterais, bem afastadas; o resto atrás do altar
      const a = side ? (i % 2 ? R(-0.25, 0.3) : R(2.85, 3.4)) : R(Math.PI * 1.08, Math.PI * 1.92), d = side ? R(26, 44) : R(15, 62);
      const x = Math.cos(a) * d, z = Math.sin(a) * d - 4;
      if (Math.hypot(x - CASTLE.x, z - CASTLE.z) < 14) continue;
      const name = trees[i % trees.length];
      (per[name] ||= []).push([x, z]);
    }
    for (const [i, name] of ['rock_single_A', 'rock_single_B', 'rock_single_C'].entries()) for (let j = 0; j < 8; j++) { const a = R(Math.PI * 1.05, Math.PI * 1.95), d = R(8, 40); (per[name] ||= []).push([Math.cos(a) * d, Math.sin(a) * d]); }
    for (const [name, list] of Object.entries(per)) {
      if (!medieval.has(name)) continue;
      const im = new THREE.InstancedMesh(medieval.geo(name), medieval.mat(name), list.length);
      const dark = new THREE.Color();
      list.forEach(([x, z], i) => {
        const h = name.startsWith('rock') ? R(0.7, 1.6) : R(3.2, 6.5);
        const k = medieval.fit(name, 0, 0, h);
        im.setMatrixAt(i, medieval.placed(name, k, x, groundY(x, z), z, R(0, 6.28)));
        im.setColorAt(i, dark.setRGB(0.55 + R(0, 0.2), 0.6 + R(0, 0.2), 0.75 + R(0, 0.2))); // tom frio de entardecer
      });
      im.frustumCulled = false;
      scene.add(im);
    }
  };
  parts.push({ update: () => { if (!modelsDone && medieval.ready) addModels(); } });
  return parts;
}

// ------------------------------------------------------------------ controle
let cur = null;

export const title = {
  get running() { return !!cur; },

  start() {
    if (cur) return true;
    const level = Q.vfx >= 2 ? 2 : Q.vfx === 1 ? 1 : 0;
    // canvas novo a cada início: um canvas cujo contexto WebGL foi perdido não aceita outro
    const old = document.getElementById('backdrop');
    const canvas = document.createElement('canvas');
    canvas.id = 'backdrop';
    old.replaceWith(canvas);
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: level >= 2 && Q.antialias, powerPreference: level >= 2 ? 'high-performance' : 'default' });
    } catch (e) {
      console.warn('[abertura] WebGL indisponível, usando o fundo simples', e);
      return false;
    }
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(46, 1, 0.3, 700);
    const parts = build(level, scene, camera);
    const state = { x: 0, y: 0, tx: 0, ty: 0, raf: 0, last: 0, t0: performance.now(), canvas, renderer };
    const resize = () => {
      const w = window.innerWidth, h = window.innerHeight;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, level >= 2 ? 1.5 : 1));
      renderer.setSize(w, h, false);
      canvas.style.width = '100%'; canvas.style.height = '100%';
      camera.aspect = w / h;
      // a chama fica à direita do centro, para o painel de login não cobrir
      if (w > h) camera.setViewOffset(w, h, -Math.min(w * 0.3, w * 0.25 + 100), 0, w, h); else camera.clearViewOffset();
      camera.updateProjectionMatrix();
    };
    const move = (e) => {
      const p = e.touches ? e.touches[0] : e;
      state.tx = (p.clientX / window.innerWidth - 0.5) * 2;
      state.ty = (p.clientY / window.innerHeight - 0.5) * 2;
    };
    const minDt = 1000 / ((level === 0 ? 30 : Q.fps) || 60);
    const loop = (now) => {
      state.raf = requestAnimationFrame(loop);
      if (document.hidden || now - state.last < minDt - 1) return;
      const dt = Math.min(0.1, (now - state.last) / 1000 || 0.016);
      state.last = now;
      const t = (now - state.t0) / 1000;
      vfxTime.value = t % 1800;
      state.x += (state.tx - state.x) * 0.04; state.y += (state.ty - state.y) * 0.04;
      // volta lenta em torno do altar, com leve balanço e paralaxe do mouse
      const yaw = -0.35 + Math.sin(t * 0.045) * 0.55 + state.x * 0.09;
      const radius = 14.5 + Math.sin(t * 0.03) * 1.8;
      const height = 3.5 + Math.sin(t * 0.037) * 0.5 - state.y * 0.45;
      camera.position.set(Math.sin(yaw) * radius, height, Math.cos(yaw) * radius);
      camera.lookAt(0, 2.6 + state.y * -0.2, 0);
      for (const p of parts) p.update(t, dt);
      renderer.render(scene, camera);
    };
    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', move);
    state.resize = resize; state.move = move;
    state.scene = scene;
    state.raf = requestAnimationFrame(loop);
    cur = state;
    return true;
  },

  // libera tudo (ao entrar no jogo): o mundo 3D usa o próprio contexto WebGL
  stop() {
    if (!cur) return;
    const s = cur;
    cur = null;
    cancelAnimationFrame(s.raf);
    window.removeEventListener('resize', s.resize);
    window.removeEventListener('pointermove', s.move);
    s.scene.traverse((o) => {
      if (o.geometry && !o.geometry.userData.shared && !medieval.shared.has(o.geometry)) o.geometry.dispose();
      const mats = [].concat(o.material || []);
      for (const m of mats) if (!(m.userData && m.userData.shared)) m.dispose();
    });
    s.renderer.dispose();
    s.renderer.forceContextLoss();
    s.canvas.style.display = 'none';
  },
};
