// Cena de abertura das telas de login, personagens e criação: um acampamento ao entardecer. Um cavaleiro descansa ao lado da
// fogueira, com um estandarte, caixas e uma árvore enorme ao fundo; do outro lado do rio o castelo de Alvorada brilha no alto de um
// penhasco, com cachoeiras, e o sol se põe atrás das montanhas. A câmera quase não se mexe (balanço leve e paralaxe do mouse/toque).
// Usa os modelos do cenário (KayKit) e os shaders de vfx.js; é desenhada no canvas #backdrop e destruída ao entrar no jogo.
// Nos perfis fracos (efeitos Simples) a cena é mais simples: sem névoa nem água em shader, menos luzes e partículas, 30 quadros por segundo.
import * as THREE from 'three';
import { quality } from '../device.js';
import { medieval } from './medieval.js';
import { characters } from './characters.js';
import { lite } from './lite.js';
import { fxMaterial, vfxTime, palette, quadMesh, meshOf, geoFlat } from './vfx.js';
import { glowTexture } from './world3d.js';
import { OceanWater, planeChunk } from './ocean.js';
import { fbm, mulberry32 } from '/shared/rng.js';

const Q = quality();

// onde fica cada coisa (x para a direita, z para longe da câmera)
const FIRE = { x: -1.7, z: -0.95 };
const HERO = { x: -2.6, z: 0.4 };
const CASTLE = { x: 23, z: -42, top: 10, r: 12 }; // platô do castelo (altura, raio plano)
const RIVER = [[-30, -34], [-10, -26], [-2, -19], [5, -12.5], [14, -8], [28, -4.5], [50, 0], [80, 8]]; // curso do rio
const LAKE = { x: CASTLE.x, z: -20.5, r: 5.5 }; // lago aos pés do penhasco, onde caem as cachoeiras
const SUN = new THREE.Vector3(0.62, 0.22, -0.75).normalize();

const SKY_VS = `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const NOISE = `
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y); }`;
const SKY_FS = `
uniform float uTime; uniform vec3 uSun; varying vec3 vDir;
${NOISE}
void main(){
  float y = vDir.y;
  vec3 zen = vec3(0.02, 0.06, 0.2), mid = vec3(0.1, 0.22, 0.5), low = vec3(0.42, 0.42, 0.66), hor = vec3(0.95, 0.52, 0.22);
  float t = clamp(y, 0.0, 1.0);
  vec3 c = mix(hor, low, smoothstep(0.0, 0.12, t));
  c = mix(c, mid, smoothstep(0.08, 0.4, t));
  c = mix(c, zen, smoothstep(0.35, 0.95, t));
  float sd = max(dot(vDir, uSun), 0.0);
  c += vec3(1.0, 0.5, 0.14) * pow(sd, 4.0) * 1.3 * exp(-max(y, 0.0) * 2.0);
  c += vec3(1.0, 0.72, 0.38) * pow(sd, 36.0) * 1.0;
  c += vec3(1.0, 0.93, 0.75) * smoothstep(0.9992, 0.9997, sd) * 3.0;
  // estrelas no alto
  vec2 sp = vDir.xz / (abs(y) + 0.3) * 60.0;
  float hs = h21(floor(sp));
  c += vec3(0.85, 0.9, 1.0) * step(0.993, hs) * smoothstep(0.3, 0.8, y) * (0.5 + 0.5 * sin(uTime * 1.6 + hs * 60.0)) * 0.8;
  // nuvens alongadas, acesas pelo sol de um lado
  vec2 cp = vec2(vDir.x, vDir.z) / (y + 0.28) * vec2(0.9, 2.2) + vec2(uTime * 0.006, 0.0);
  float cl = smoothstep(0.5, 0.82, vn(cp * 1.6) * 0.62 + vn(cp * 4.2) * 0.38) * smoothstep(0.03, 0.18, y) * (1.0 - smoothstep(0.4, 0.8, y));
  vec3 cc = mix(vec3(0.16, 0.2, 0.42), vec3(1.0, 0.62, 0.3), pow(sd, 1.6));
  c = mix(c, cc, cl * 0.75);
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const FALL_VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FALL_FS = `
uniform float uTime; varying vec2 vUv;
${NOISE}
void main(){
  float edge = smoothstep(0.0, 0.22, vUv.x) * smoothstep(1.0, 0.78, vUv.x);
  float s = vn(vec2(vUv.x * 14.0, vUv.y * 5.0 + uTime * 1.9)) * 0.6 + vn(vec2(vUv.x * 30.0, vUv.y * 9.0 + uTime * 2.7)) * 0.4;
  float a = edge * smoothstep(0.0, 0.1, vUv.y) * (0.45 + s * 0.55);
  float foam = smoothstep(0.82, 1.0, vUv.y) * (0.5 + 0.5 * vn(vUv * 24.0 + uTime));
  vec3 col = mix(vec3(0.7, 0.82, 0.95), vec3(1.0, 0.95, 0.88), s) + foam * 0.2;
  gl_FragColor = vec4(col * 0.9, clamp(a + foam * edge, 0.0, 1.0) * 0.85);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const FLAME_VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FLAME_FS = `
uniform float uTime; uniform float uSeed; uniform float uLife; varying vec2 vUv;
${NOISE}
void main(){
  float y = vUv.y;
  float n = vn(vec2(vUv.x * 3.0 + uSeed, y * 2.2 - uTime * 2.6)) * 0.65 + vn(vec2(vUv.x * 7.0 - uSeed, y * 4.5 - uTime * 4.2)) * 0.35;
  float w = (1.0 - y) * 0.5 * (0.55 + 0.9 * n);
  float d = abs(vUv.x - 0.5 + (n - 0.5) * 0.22 * y);
  float shape = smoothstep(w, w * 0.15, d) * smoothstep(0.0, 0.07, y) * (1.0 - smoothstep(0.45 + 0.4 * n, 1.0, y));
  float heat = clamp(shape * 1.5 - y * 0.55, 0.0, 1.0);
  vec3 col = mix(vec3(0.85, 0.12, 0.02), vec3(1.0, 0.5, 0.08), smoothstep(0.0, 0.45, heat));
  col = mix(col, vec3(1.0, 0.82, 0.38), smoothstep(0.6, 1.0, heat));
  gl_FragColor = vec4(col * 1.05, shape * uLife);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// estandarte: pano azul com borda dourada e uma chama, pendurado numa barra no alto de um mastro
function bannerTexture() {
  const cv = document.createElement('canvas');
  cv.width = 128; cv.height = 300;
  const c = cv.getContext('2d');
  const g = c.createLinearGradient(0, 0, 0, 300);
  g.addColorStop(0, '#2b4a9a'); g.addColorStop(1, '#14275c');
  c.fillStyle = g;
  c.beginPath(); c.moveTo(0, 0); c.lineTo(128, 0); c.lineTo(128, 278); c.lineTo(64, 300); c.lineTo(0, 278); c.closePath(); c.fill();
  c.strokeStyle = '#e8b64c'; c.lineWidth = 7;
  c.beginPath(); c.moveTo(4, 4); c.lineTo(124, 4); c.lineTo(124, 272); c.lineTo(64, 292); c.lineTo(4, 272); c.closePath(); c.stroke();
  c.fillStyle = '#ffcb5e';
  c.beginPath(); c.moveTo(64, 70); c.bezierCurveTo(98, 118, 104, 150, 84, 184); c.bezierCurveTo(80, 164, 70, 156, 64, 150); c.bezierCurveTo(58, 156, 48, 164, 44, 184); c.bezierCurveTo(24, 150, 30, 118, 64, 70); c.fill();
  c.fillStyle = '#fff1b8';
  c.beginPath(); c.moveTo(64, 124); c.bezierCurveTo(78, 148, 78, 164, 64, 180); c.bezierCurveTo(50, 164, 50, 148, 64, 124); c.fill();
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const rng = mulberry32(2024);
const R = (a, b) => a + rng() * (b - a);
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// distância de (x, z) à água (rio em poligonal e lago)
function riverDist(x, z) {
  let best = Math.max(0, Math.hypot(x - LAKE.x, (z - LAKE.z) * 0.8) - LAKE.r);
  for (let i = 0; i < RIVER.length - 1; i++) {
    const [ax, az] = RIVER[i], [bx, bz] = RIVER[i + 1];
    const dx = bx - ax, dz = bz - az, t = Math.min(1, Math.max(0, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    best = Math.min(best, Math.hypot(x - (ax + dx * t), z - (az + dz * t)));
  }
  return best;
}
// altura do terreno: campina plana no acampamento, colinas, o platô do castelo (penhasco) e o leito do rio (a água fica em y = 0)
function groundY(x, z) {
  const camp = smooth(5, 20, Math.hypot(x - FIRE.x, z - FIRE.z));
  const hills = 0.45 + Math.max(0, fbm(x * 0.045, z * 0.045, 11, 3) - 0.34) * 9 * camp;
  const p = 1 - smooth(CASTLE.r, CASTLE.r + 5.5, Math.hypot(x - CASTLE.x, (z - CASTLE.z) * 0.9));
  const y = hills * (1 - p) + (CASTLE.top + fbm(x * 0.2, z * 0.2, 5, 2) * 0.8) * p;
  const bank = smooth(1.8, 6.5, riverDist(x, z)); // 0 no leito, 1 fora do rio
  return (y * bank + -1.1 * (1 - bank)) * (1 - p) + y * p;
}

function groundMesh(level) {
  const W = 190, D = 130, CX = 20, CZ = -36;
  const nx = level >= 2 ? 150 : 90, nz = level >= 2 ? 100 : 62;
  const g = new THREE.PlaneGeometry(W, D, nx, nz).rotateX(-Math.PI / 2).translate(CX, 0, CZ);
  const pos = g.attributes.position, col = new Float32Array(pos.count * 3), c = new THREE.Color();
  const rock = new THREE.Color(0.5, 0.42, 0.38), dirt = new THREE.Color(0.24, 0.16, 0.1), mud = new THREE.Color(0.16, 0.14, 0.1);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const y = groundY(x, z);
    pos.setY(i, y);
    const slope = Math.hypot(groundY(x + 1, z) - y, groundY(x, z + 1) - y);
    const n = fbm(x * 0.12, z * 0.12, 5, 2);
    c.setRGB(0.07 + n * 0.09, 0.2 + n * 0.16, 0.07 + n * 0.05); // campina
    c.lerp(new THREE.Color(0.14, 0.22, 0.09), smooth(0.45, 0.8, fbm(x * 0.05, z * 0.05, 9, 2)) * 0.7); // trechos mais claros
    c.lerp(dirt, (1 - smooth(1.2, 3.4, Math.hypot(x - FIRE.x, z - FIRE.z))) * 0.9); // terra batida em volta da fogueira
    c.lerp(mud, 1 - smooth(0.0, 0.6, y - 0.05)); // margem molhada
    c.lerp(rock, smooth(0.55, 1.1, slope) * smooth(1.5, 4.5, y) * 0.95); // penhasco (só no alto: as margens do rio ficam de terra)
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return new THREE.Mesh(g, lite(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 })));
}

// silhueta de montanhas distantes (faixa com o topo em ruído), pintada na cor da névoa para sumir no horizonte
function ridge(z, amp, base, color, seed, x0 = 0) {
  const N = 140, W = 460;
  const pos = [], idx = [];
  for (let i = 0; i <= N; i++) {
    const x = x0 - W / 2 + (i / N) * W;
    const h = base + (fbm(x * 0.012, seed, seed, 4) - 0.35) * amp + Math.abs(Math.sin(x * 0.021 + seed)) * amp * 0.25;
    pos.push(x, -20, z, x, h, z);
    if (i < N) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, fog: true, side: THREE.DoubleSide }));
}

function makeParticles(n, tex, size, additive) {
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), seed = new Float32Array(n);
  for (let i = 0; i < n; i++) { seed[i] = rng(); }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = new THREE.Points(g, new THREE.PointsMaterial({ size, map: tex, vertexColors: true, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, sizeAttenuation: true, fog: false }));
  m.frustumCulled = false;
  return { m, pos, col, seed, n };
}

// cachoeira: faixa que desce pelo penhasco seguindo o relevo, de (x0, z0) para fora do centro do platô
function waterfall(angle, width, level) {
  const dir = new THREE.Vector2(Math.sin(angle), Math.cos(angle)); // para onde o penhasco "olha"
  const steps = 22, pos = [], uv = [], idx = [];
  const r0 = CASTLE.r + 0.2, r1 = CASTLE.r + 6.2;
  const side = new THREE.Vector2(dir.y, -dir.x);
  for (let i = 0; i <= steps; i++) {
    const r = r0 + (r1 - r0) * (i / steps);
    const cx = CASTLE.x + dir.x * r, cz = CASTLE.z + dir.y * r / 0.9;
    for (const [k, sgn] of [[0, -1], [1, 1]]) {
      const x = cx + side.x * sgn * width / 2, z = cz + side.y * sgn * width / 2;
      pos.push(x + dir.x * 0.18, groundY(x, z) + 0.12, z + dir.y * 0.18);
      uv.push(k, i / steps);
    }
    if (i < steps) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  const m = new THREE.Mesh(g, level >= 1
    ? new THREE.ShaderMaterial({ uniforms: { uTime: vfxTime }, vertexShader: FALL_VS, fragmentShader: FALL_FS, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false })
    : new THREE.MeshBasicMaterial({ color: 0xcfe0f2, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false, fog: false }));
  m.renderOrder = 5;
  m.frustumCulled = false;
  return m;
}

function build(level, scene, camera) {
  const parts = []; // { update(t, dt), dispose() }
  const tex = glowTexture();
  const fire = palette('fire');
  const fogColor = new THREE.Color(0.4, 0.43, 0.62);

  // céu, névoa e luzes
  const sky = new THREE.Mesh(new THREE.SphereGeometry(300, 24, 16), new THREE.ShaderMaterial({ uniforms: { uTime: vfxTime, uSun: { value: SUN } }, vertexShader: SKY_VS, fragmentShader: SKY_FS, side: THREE.BackSide, depthWrite: false, fog: false }));
  sky.renderOrder = -10;
  scene.add(sky);
  parts.push({ update: () => sky.position.copy(camera.position) });
  scene.fog = new THREE.FogExp2(fogColor, level >= 1 ? 0.0085 : 0.011);
  scene.add(new THREE.HemisphereLight(0x86a6ff, 0x4a3426, 0.9));
  const sun = new THREE.DirectionalLight(0xffa862, 2.3);
  sun.position.copy(SUN).multiplyScalar(60);
  scene.add(sun);
  const fillL = new THREE.DirectionalLight(0xffb070, 1.1); // luz dourada do entardecer batendo de frente no castelo
  fillL.position.set(26, 12, 18);
  scene.add(fillL);

  // terreno, rio e montanhas
  scene.add(groundMesh(level));
  // água: o shader "ocean" (ocean.js); com a água em "Com reflexo" a cena é desenhada de novo, de cabeça para baixo
  {
    const ocean = new OceanWater({ chunks: [planeChunk(420, 260, 20, -70, 0, 0.75, 0)], y: 0, mirror: Q.water >= 2, taps4: Q.water >= 1, mirrorWanted: () => Q.water >= 2, alpha: [1, 1], wave: 0.7, noiseScale: 0.07, distortion: 4,
      reflect: 0.62, rf0: 0.08, tint: 0x5f9bff, waterColor: 0x1f84b4, deepColor: 0x0a3f78, sunDir: SUN });
    ocean.group.renderOrder = -1;
    scene.add(ocean.group);
    const env = { sky: new THREE.Color(0.3, 0.33, 0.55), sunColor: new THREE.Color(1.0, 0.62, 0.3), sunDir: SUN };
    parts.push({ update: (t) => ocean.update(t, env), prepare: (renderer, sc, cam) => ocean.prepare(renderer, sc, cam), dispose: () => ocean.dispose() });
  }
  const ridges = [[-82, 20, 8, 0x3b4a82, 3, -20], [-118, 34, 14, 0x303c72, 7, 20], [-165, 50, 22, 0x27315f, 13, 0]];
  for (const [z, amp, base, color, seed, x0] of ridges.slice(0, level >= 1 ? 3 : 2)) scene.add(ridge(z, amp, base, color, seed, x0));

  // cachoeiras que descem do platô do castelo até o rio
  const falls = level >= 1 ? [[-0.75, 2.4], [-0.3, 3.6], [0.32, 2.2]] : []; // sem shader (perfis fracos) elas ficariam como lençóis brancos: ficam de fora
  for (const [ang, w] of falls) scene.add(waterfall(ang, w, level));

  // fogueira: toras em pé, pedras em volta, três línguas de fogo, brilho e luz que treme
  const camp = new THREE.Group();
  camp.position.set(FIRE.x, groundY(FIRE.x, FIRE.z), FIRE.z);
  scene.add(camp);
  const bark = lite(new THREE.MeshStandardMaterial({ color: 0x3b2514, roughness: 1 }));
  const char = lite(new THREE.MeshStandardMaterial({ color: 0x120a06, roughness: 1, emissive: 0x8a2a06, emissiveIntensity: 0.9 }));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.3, log = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.72, 6), i % 3 === 0 ? char : bark);
    log.position.set(Math.cos(a) * 0.2, 0.26, Math.sin(a) * 0.2);
    log.rotation.set(Math.sin(a) * 1.0, 0, -Math.cos(a) * 1.0);
    camp.add(log);
  }
  const stoneM = lite(new THREE.MeshStandardMaterial({ color: 0x5b5560, roughness: 1 }));
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2, st = new THREE.Mesh(new THREE.DodecahedronGeometry(0.15 + (i % 3) * 0.03, 0), stoneM);
    st.position.set(Math.cos(a) * 0.62, 0.07, Math.sin(a) * 0.62);
    st.scale.y = 0.7;
    st.rotation.set(i, i * 2, 0);
    camp.add(st);
  }
  const flames = [];
  const flameGeo = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
  for (const [w, hgt, rot, id, dx, dz] of [[1.4, 2.3, 0, 1.3, 0, 0], [1.25, 2.0, 1.05, 3.1, 0.05, -0.05], [1.2, 1.9, 2.1, 5.2, -0.06, 0.04], [0.75, 1.3, 0.5, 7.7, 0.14, 0.1]]) {
    const q = new THREE.Mesh(flameGeo, new THREE.ShaderMaterial({ uniforms: { uTime: vfxTime, uSeed: { value: id }, uLife: { value: 1 } }, vertexShader: FLAME_VS, fragmentShader: FLAME_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
    q.scale.set(w, hgt, 1);
    q.position.set(dx, 0.12, dz);
    q.rotation.y = rot;
    q.renderOrder = 6;
    camp.add(q);
    flames.push([q, id, hgt]);
  }
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xff7a24, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.6, fog: false }));
  halo.scale.setScalar(6.5);
  halo.position.y = 0.9;
  camp.add(halo);
  const fl = new THREE.PointLight(0xff8a3a, 9, 12, 2);
  fl.position.set(0, 1.5, 0.4);
  camp.add(fl);
  parts.push({
    update(t) {
      const k = 0.86 + Math.sin(t * 7.3) * 0.07 + Math.sin(t * 13.1 + 1.7) * 0.05 + Math.sin(t * 2.3) * 0.04;
      fl.intensity = 9 * k;
      halo.material.opacity = 0.55 * k;
      for (const [q, id, hgt] of flames) { q.material.uniforms.uLife.value = Math.min(1, 0.95 * k); q.scale.y = hgt * (1 + Math.sin(t * 9 + id * 3) * 0.08 + Math.sin(t * 5.3 + id) * 0.05); }
    },
  });

  // brasas subindo da fogueira e cinzas à deriva
  const embers = makeParticles(level >= 2 ? 110 : level === 1 ? 70 : 34, tex, 0.1, true);
  const ash = makeParticles(level >= 2 ? 90 : level === 1 ? 55 : 24, tex, 0.07, false);
  scene.add(embers.m, ash.m);
  const tmp = new THREE.Color();
  parts.push({
    update(t) {
      for (let i = 0; i < embers.n; i++) {
        const s = embers.seed[i], life = ((t * (0.08 + s * 0.09) + s * 7) % 1);
        const a = s * 91.7 + t * (0.1 + s * 0.2), rad = (0.1 + 0.9 * s) * (0.3 + life * 1.2);
        embers.pos[i * 3] = FIRE.x + Math.cos(a) * rad + Math.sin(t * 0.6 + s * 20) * 0.5 * life + life * 0.6;
        embers.pos[i * 3 + 1] = 1.0 + life * 7;
        embers.pos[i * 3 + 2] = FIRE.z + Math.sin(a) * rad;
        tmp.setRGB(1.0, 0.45 + s * 0.35, 0.12).multiplyScalar(Math.sin(life * Math.PI) * 1.1);
        embers.col[i * 3] = tmp.r; embers.col[i * 3 + 1] = tmp.g; embers.col[i * 3 + 2] = tmp.b;
      }
      embers.m.geometry.attributes.position.needsUpdate = true;
      embers.m.geometry.attributes.color.needsUpdate = true;
      for (let i = 0; i < ash.n; i++) {
        const s = ash.seed[i], life = ((t * (0.014 + s * 0.014) + s * 13) % 1);
        ash.pos[i * 3] = -6 + s * 22 + Math.sin(t * 0.3 + s * 40) * 1.2 + life * 3;
        ash.pos[i * 3 + 1] = 0.5 + (((s * 5.7) % 1)) * 6 + life * 1.5;
        ash.pos[i * 3 + 2] = -16 + (((s * 7.31) % 1)) * 13 + Math.cos(t * 0.25 + s * 30) * 1.0;
        const f = Math.sin(life * Math.PI) * 0.55;
        ash.col[i * 3] = 0.85 * f; ash.col[i * 3 + 1] = 0.6 * f; ash.col[i * 3 + 2] = 0.4 * f;
      }
      ash.m.geometry.attributes.position.needsUpdate = true;
      ash.m.geometry.attributes.color.needsUpdate = true;
    },
  });

  // névoa baixa sobre o vale do rio
  if (level >= 1) {
    const mists = [[0.35, 150, 0.07, [0.02, 0.008], 12], [1.2, 120, 0.05, [-0.015, 0.012], -28]];
    for (const [y, size, life, drift, z] of mists.slice(0, level >= 2 ? 2 : 1)) {
      const m = meshOf(geoFlat(), fxMaterial('mist', { uA: new THREE.Color(0.55, 0.45, 0.55), uLife: life, uScale: 5, uDrift: new THREE.Vector2(...drift) }), 20);
      m.scale.setScalar(size);
      m.position.set(20, y, z);
      scene.add(m);
    }
  }

  // o cavaleiro: entra quando os personagens terminam de carregar
  let hero = null;
  parts.push({
    update(t, dt) {
      if (!hero && characters.ready && characters.has('hero_camp')) {
        hero = characters.create('hero_camp');
        hero.root.scale.setScalar(1.45);
        hero.root.position.set(HERO.x, groundY(HERO.x, HERO.z), HERO.z);
        hero.root.rotation.y = 2.85; // de costas para a câmera, olhando para o fogo e o castelo
        hero.root.traverse((o) => { if (o.isMesh && o.geometry) o.geometry.userData.shared = true; });
        scene.add(hero.root);
      }
      if (hero) hero.update(dt, { now: performance.now(), moving: false, speed: 0 });
    },
    dispose() { if (hero) hero.dispose(); },
  });

  // tufos de grama espalhados pela campina (só nos perfis melhores)
  if (level >= 1) {
    const n = level >= 2 ? 900 : 450;
    const blade = new THREE.ConeGeometry(0.022, 0.15, 3).translate(0, 0.075, 0);
    const grass = new THREE.InstancedMesh(blade, lite(new THREE.MeshStandardMaterial({ roughness: 1 })), n);
    const m4 = new THREE.Matrix4(), col = new THREE.Color();
    let k = 0;
    for (let i = 0; i < n * 3 && k < n; i++) {
      const x = R(-9, 9), z = R(-12, 1);
      if (Math.hypot(x - FIRE.x, z - FIRE.z) < 1.1 || riverDist(x, z) < 4 || groundY(x, z) < 0.2) continue;
      m4.compose(new THREE.Vector3(x, groundY(x, z) - 0.02, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(R(-0.2, 0.2), R(0, 6.28), R(-0.2, 0.2))), new THREE.Vector3(1, R(0.6, 1.5), 1));
      grass.setMatrixAt(k, m4);
      grass.setColorAt(k, col.setRGB(0.05 + R(0, 0.07), 0.15 + R(0, 0.14), 0.04 + R(0, 0.04)));
      k++;
    }
    grass.count = k;
    grass.frustumCulled = false;
    scene.add(grass);
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
    const windows = (x, z, y0, w, hgt, n, op = 0.7) => {
      for (let i = 0; i < n; i++) {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xffb24a, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: op, fog: false }));
        s.scale.setScalar(0.8 + (i % 3) * 0.3);
        s.position.set(x + R(-w, w), y0 + R(0, hgt), z);
        scene.add(s);
      }
    };
    // acampamento: estandarte, caixas, barris e a árvore enorme que enquadra a cena
    {
      const bx = -4.5, bz = -3.2, by = groundY(bx, bz);
      const wood = lite(new THREE.MeshStandardMaterial({ color: 0x4a3018, roughness: 1 }));
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 4.4, 6), wood);
      pole.position.set(bx, by + 2.2, bz);
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.5, 6), wood);
      bar.rotation.z = Math.PI / 2;
      bar.position.set(bx + 0.7, by + 4.0, bz);
      const cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 2.7), new THREE.MeshStandardMaterial({ map: bannerTexture(), side: THREE.DoubleSide, roughness: 1, emissive: 0x112244, emissiveIntensity: 0.35 }));
      cloth.position.set(bx + 0.7, by + 2.62, bz + 0.03);
      cloth.rotation.y = 0.12;
      scene.add(pole, bar, cloth);
    }
    place('crate_A_big', -3.65, -2.6, 1.0, 0.4);
    place('crate_B_big', -4.4, -3.1, 0.85, -0.3);
    place('barrel', -3.0, -3.4, 1.0, 1.2);
    place('sack', -3.7, -1.2, 0.5, 0.8);
    place('tree_single_A', -6.6, -6.5, 9, 0.5);
    place('tree_single_A', -8.6, -4.2, 11.5, 2.1);
    place('tree_single_A', -7.6, -10, 10, 1.1);
    // castelo de Alvorada no platô, com torres, moinho e janelas acesas
    const top = CASTLE.top;
    place('building_castle_blue', CASTLE.x, CASTLE.z, 23, 0.1);
    place('building_tower_A_blue', CASTLE.x + 9.5, CASTLE.z + 3.5, 13, 0.2);
    place('building_tower_A_blue', CASTLE.x - 9.5, CASTLE.z + 3, 11, 0.9);
    place('building_tower_A_blue', CASTLE.x + 4.5, CASTLE.z - 6, 14, 0.5);
    place('building_windmill_blue', CASTLE.x - 6.5, CASTLE.z + 9.5, 7, 0.4);
    windows(CASTLE.x, CASTLE.z + 7, top + 3, 4, 12, level >= 1 ? 12 : 6, 0.75);
    windows(CASTLE.x + 9.5, CASTLE.z + 6, top + 3, 1, 8, 4, 0.75);
    // casinhas acesas na margem do rio, do lado do castelo
    const homes = ['building_home_A_yellow', 'building_home_B_blue', 'building_home_A_red', 'building_home_B_yellow', 'building_home_A_green'];
    for (let i = 0; i < (level >= 1 ? 8 : 4); i++) {
      const x = 9 + i * 4.3 + R(-1, 1), z = -13 - R(0, 2.5);
      if (groundY(x, z) < 0.3 || riverDist(x, z) < 3.2 || Math.hypot(x - CASTLE.x, (z - CASTLE.z) * 0.9) < CASTLE.r + 6) continue;
      if (place(homes[i % homes.length], x, z, 2.6, R(-0.3, 0.3))) windows(x, z + 1.2, groundY(x, z) + 0.8, 0.5, 0.9, 2, 0.9);
    }
    // árvores e pedras (instanciadas): colinas à esquerda, margens do rio e pedras grandes de frente
    const trees = ['trees_A_large', 'trees_B_large', 'trees_A_medium', 'trees_B_medium'];
    const nTrees = level >= 2 ? 90 : level === 1 ? 55 : 26;
    const per = {};
    for (let i = 0; i < nTrees; i++) {
      const left = i % 3 !== 0;
      const x = left ? R(-26, -6) : R(22, 52), z = left ? R(-34, -4) : R(-9, 2);
      if (riverDist(x, z) < 6 || Math.hypot(x - CASTLE.x, z - CASTLE.z) < CASTLE.r + 9) continue;
      if (left && x > -9 && z > -8) continue; // sem árvores na frente do acampamento
      (per[trees[i % trees.length]] ||= []).push([x, z, 1]);
    }
    for (const name of ['rock_single_A', 'rock_single_B', 'rock_single_C']) {
      for (let j = 0; j < 5; j++) (per[name] ||= []).push([R(-12, -2.5), R(-18, -5), 1]);
    }
    for (const [name, list] of Object.entries(per)) {
      if (!medieval.has(name)) continue;
      const im = new THREE.InstancedMesh(medieval.geo(name), medieval.mat(name), list.length);
      const dark = new THREE.Color();
      list.forEach(([x, z, big], i) => {
        const h = name.startsWith('rock') ? R(0.7, 1.5) * big : R(3.4, 6.8);
        const k = medieval.fit(name, 0, 0, h);
        im.setMatrixAt(i, medieval.placed(name, k, x, groundY(x, z) - 0.05, z, R(0, 6.28)));
        im.setColorAt(i, dark.setRGB(0.5 + R(0, 0.2), 0.58 + R(0, 0.2), 0.7 + R(0, 0.2))); // tom frio de entardecer
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
  get debug() { return cur; }, // só para inspecionar a cena pelo console

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
    renderer.toneMappingExposure = 1.0;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1, 0.3, 700);
    const parts = build(level, scene, camera);
    const state = { x: 0, y: 0, tx: 0, ty: 0, raf: 0, last: 0, t0: performance.now(), canvas, renderer };
    let sized = null;
    const resize = () => {
      const w = window.innerWidth, h = window.innerHeight;
      // o teclado do celular encolhe só a altura da janela: redimensionar a cena a cada quadro dessa animação pisca a tela
      // e tira o foco do campo de texto, então a cena mantém o tamanho enquanto alguém digita
      const typing = document.activeElement && /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName);
      if (typing && sized && sized.w === w) return;
      sized = { w, h };
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, level >= 2 ? 1.5 : 1));
      renderer.setSize(w, h, false);
      canvas.style.width = '100%'; canvas.style.height = '100%';
      camera.aspect = w / h;
      // o campo de visão horizontal fica o mesmo em telas mais quadradas: o cavaleiro e o castelo continuam nas laterais, fora do painel
      camera.fov = Math.min(88, Math.max(50, 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(39.7)) / camera.aspect) * 180 / Math.PI));
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
      // quase parada: balanço leve e paralaxe do mouse
      camera.position.set(Math.sin(t * 0.05) * 0.3 + state.x * 0.28, 2.35 + Math.sin(t * 0.037) * 0.07 - state.y * 0.12, 5.2 + Math.sin(t * 0.03) * 0.15);
      camera.lookAt(0.35 + state.x * 0.35, 2.15 - state.y * 0.2, -6);
      for (const p of parts) p.update(t, dt);
      for (const p of parts) if (p.prepare) p.prepare(renderer, scene, camera);
      renderer.render(scene, camera);
    };
    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', move);
    state.resize = resize; state.move = move;
    state.scene = scene; state.parts = parts;
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
    for (const p of s.parts) if (p.dispose) p.dispose();
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
