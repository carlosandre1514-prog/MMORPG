// Água realista: porte para o three.js atual do shader "ocean" de Jérémy Bouny (MIT, https://github.com/jbouny/ocean).
// O original se baseia no espelho plano de Slayvin, na água de Stemkoski e nos slides de Jonas Wagner (http://29a.ch/slides/2012/webglwater).
// Copyright (c) 2013 Jérémy Bouny; o texto da licença MIT está em client/assets/water/LICENSE.txt.
//
// A água mistura três coisas, como no original: o reflexo (um espelho plano que desenha a cena de novo, de cabeça para baixo, ou,
// nos perfis mais fracos, só o céu), o brilho do sol (especular) e a cor do corpo d'água, com a fração de reflexo crescendo em
// ângulos rasos (Fresnel). Quatro leituras do mapa de normais andando em velocidades e escalas diferentes dão as ondas.
// Acréscimos do jogo: profundidade (raso/fundo) e margem por vértice, transparência, névoa da zona e noite.
import * as THREE from 'three';

const NORMALS_URL = '/assets/water/waternormals.jpg';

// Uma só textura de normais para todas as águas. Até o arquivo chegar vale um mapa liso (128 = vetor zero: água parada), sem piscar em preto.
const normalUniform = { value: Object.assign(new THREE.DataTexture(new Uint8Array([128, 128, 128, 255]), 1, 1), { needsUpdate: true }) };
let normalsRequested = false;
function loadNormals() {
  if (normalsRequested) return;
  normalsRequested = true;
  new THREE.TextureLoader().load(NORMALS_URL, (tex) => {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 4;
    normalUniform.value = tex; // o uniform é um objeto compartilhado por todas as águas
  }, undefined, (e) => console.warn('[água] mapa de normais indisponível', e));
}

const VS = `
uniform mat4 textureMatrix;
attribute float aDeep;
attribute float aShore;
varying vec4 mirrorCoord;
varying vec3 worldPosition;
varying float vDeep;
varying float vShore;
#include <fog_pars_vertex>
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  worldPosition = wp.xyz;
  mirrorCoord = textureMatrix * wp;
  vDeep = aDeep;
  vShore = aShore;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const FS = `
uniform sampler2D mirrorSampler;
uniform sampler2D normalSampler;
uniform float time;
uniform float noiseScale;
uniform float distortionScale;
uniform float uWave;
uniform float uReflect;
uniform float uRf0;
uniform vec3 uTint;
uniform float uAlphaShallow;
uniform float uAlphaDeep;
uniform vec3 sunColor;
uniform vec3 sunDirection;
uniform vec3 waterColor;
uniform vec3 deepColor;
uniform vec3 uSkyHorizon;
uniform vec3 uSkyZenith;
varying vec4 mirrorCoord;
varying vec3 worldPosition;
varying float vDeep;
varying float vShore;
#include <common>
#include <fog_pars_fragment>

// quatro leituras do mapa de normais em escalas e velocidades diferentes (as mesmas contas do original)
vec3 getNoise(in vec2 uv) {
  vec2 uv0 = uv / (103.0 * noiseScale) + vec2(time / 17.0, time / 29.0);
  vec2 uv1 = uv / (107.0 * noiseScale) - vec2(time / -19.0, time / 31.0);
  vec4 noise = texture2D(normalSampler, uv0) + texture2D(normalSampler, uv1);
  #ifdef NOISE4
  vec2 uv2 = uv / (vec2(8907.0, 9803.0) * noiseScale) + vec2(time / 101.0, time / 97.0);
  vec2 uv3 = uv / (vec2(1091.0, 1027.0) * noiseScale) - vec2(time / 109.0, time / -113.0);
  noise += texture2D(normalSampler, uv2) + texture2D(normalSampler, uv3);
  return noise.xyz * 0.5 - 1.0;
  #else
  return noise.xyz - 1.0;
  #endif
}

void main() {
  vec3 worldToEye = cameraPosition - worldPosition;
  float dist = length(worldToEye);
  vec3 eyeDirection = worldToEye / dist;

  // normal da superfície: o plano da água (+Y) inclinado pelo ruído
  vec3 noise = getNoise(worldPosition.xz);
  vec3 n = normalize(vec3(noise.x * uWave, 1.0, noise.y * uWave));

  // sol: brilho especular e luz difusa (sunLight do original)
  vec3 reflection = normalize(reflect(-sunDirection, n));
  float direction = max(0.0, dot(eyeDirection, reflection));
  vec3 specularLight = pow(direction, 100.0) * sunColor * 2.0;
  vec3 diffuseLight = max(dot(sunDirection, n), 0.0) * sunColor * 0.5;

  // reflexo: espelho plano distorcido pelas ondas ou, sem espelho, o céu na direção refletida
  vec2 distortion = n.xz * (0.001 + 1.0 / dist) * distortionScale;
  #ifdef MIRROR
  vec3 reflectionSample = texture2D(mirrorSampler, mirrorCoord.xy / mirrorCoord.w + distortion).rgb;
  #else
  vec3 rd = reflect(-eyeDirection, n);
  rd.y = abs(rd.y);
  vec3 reflectionSample = mix(uSkyHorizon, uSkyZenith, smoothstep(0.0, 0.8, rd.y));
  reflectionSample += sunColor * pow(max(dot(rd, sunDirection), 0.0), 48.0) * 0.45;
  #endif

  // Fresnel e cor do corpo d'água
  float theta = max(dot(eyeDirection, n), 0.0);
  float reflectance = uRf0 + (1.0 - uRf0) * pow(1.0 - theta, 3.0);
  reflectionSample *= uReflect * uTint;
  vec3 body = mix(waterColor, deepColor, vDeep);
  vec3 scatter = max(0.0, dot(n, eyeDirection)) * body;
  vec3 albedo = mix(sunColor * diffuseLight * 0.3 + scatter, vec3(0.1) + reflectionSample * 0.9 + reflectionSample * specularLight, reflectance);

  // raso é mais transparente que fundo; perto da margem a água some devagar
  float alpha = mix(uAlphaShallow, uAlphaDeep, vDeep);
  alpha = clamp(alpha + reflectance * 0.25, 0.0, 1.0) * (1.0 - 0.8 * vShore);
  gl_FragColor = vec4(albedo, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

// ------------------------------------------------------------------ espelho plano (reflexo)
const _v2 = new THREE.Vector2(), _fwd = new THREE.Vector3(), _look = new THREE.Vector3(), _up = new THREE.Vector3(), _rot = new THREE.Matrix4();
const _q = new THREE.Vector4(), _frustum = new THREE.Frustum(), _pv = new THREE.Matrix4();

// Desenha a cena vista por uma câmera espelhada no plano y = nível da água (técnica do espelho plano com corte oblíquo)
class PlanarMirror {
  constructor() {
    this.camera = new THREE.PerspectiveCamera();
    this.matrix = new THREE.Matrix4();
    this.plane = new THREE.Plane();
    this.clip = new THREE.Vector4();
    this.rt = null;
  }

  // metade da resolução da tela (no máximo 1024): o reflexo é borrado pelas ondas de qualquer jeito
  fit(renderer) {
    renderer.getDrawingBufferSize(_v2);
    const w = Math.min(1024, Math.max(128, Math.round(_v2.x * 0.5))), h = Math.min(1024, Math.max(128, Math.round(_v2.y * 0.5)));
    if (!this.rt) {
      const hdr = renderer.extensions.has('EXT_color_buffer_half_float') || renderer.extensions.has('EXT_color_buffer_float');
      this.rt = new THREE.WebGLRenderTarget(w, h, { type: hdr ? THREE.HalfFloatType : THREE.UnsignedByteType });
    } else if (this.rt.width !== w || this.rt.height !== h) this.rt.setSize(w, h);
  }

  render(renderer, scene, camera, y, hide) {
    const cp = camera.matrixWorld.elements;
    if (cp[13] <= y + 0.05) return false; // câmera embaixo da água: não há o que refletir
    this.fit(renderer);
    const cam = this.camera;
    // posição, alvo e "cima" da câmera refletidos no plano
    _rot.extractRotation(camera.matrixWorld);
    _fwd.set(0, 0, -1).applyMatrix4(_rot);
    _look.set(cp[12] + _fwd.x, cp[13] + _fwd.y, cp[14] + _fwd.z);
    cam.position.set(cp[12], 2 * y - cp[13], cp[14]);
    _up.set(0, 1, 0).applyMatrix4(_rot);
    cam.up.set(_up.x, -_up.y, _up.z);
    cam.lookAt(_look.x, 2 * y - _look.y, _look.z);
    cam.far = camera.far;
    cam.updateMatrixWorld();
    cam.projectionMatrix.copy(camera.projectionMatrix);
    // matriz que leva um ponto do mundo às coordenadas da textura do reflexo
    this.matrix.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
    this.matrix.multiply(cam.projectionMatrix);
    this.matrix.multiply(cam.matrixWorldInverse);
    // corte oblíquo: nada abaixo do plano da água entra no reflexo (http://www.terathon.com/lengyel/Lengyel-Oblique.pdf)
    this.plane.setFromNormalAndCoplanarPoint(_up.set(0, 1, 0), _look.set(0, y, 0));
    this.plane.applyMatrix4(cam.matrixWorldInverse);
    this.clip.set(this.plane.normal.x, this.plane.normal.y, this.plane.normal.z, this.plane.constant);
    const p = cam.projectionMatrix.elements;
    _q.x = (Math.sign(this.clip.x) + p[8]) / p[0];
    _q.y = (Math.sign(this.clip.y) + p[9]) / p[5];
    _q.z = -1;
    _q.w = (1 + p[10]) / p[14];
    this.clip.multiplyScalar(2 / this.clip.dot(_q));
    p[2] = this.clip.x;
    p[6] = this.clip.y;
    p[10] = this.clip.z + 1 - 0.003;
    p[14] = this.clip.w;
    // desenha
    const prevTarget = renderer.getRenderTarget(), prevShadow = renderer.shadowMap.autoUpdate, prevXr = renderer.xr.enabled;
    hide.visible = false;
    renderer.xr.enabled = false;
    renderer.shadowMap.autoUpdate = false; // as sombras já foram feitas no quadro principal
    renderer.setRenderTarget(this.rt);
    renderer.render(scene, cam);
    renderer.setRenderTarget(prevTarget);
    renderer.shadowMap.autoUpdate = prevShadow;
    renderer.xr.enabled = prevXr;
    hide.visible = true;
    return true;
  }

  dispose() { if (this.rt) this.rt.dispose(); this.rt = null; }
}

// ------------------------------------------------------------------ a água
// chunks: [{ geometry (posições locais com y = 0, atributos aDeep e aShore), box (Box3 em mundo) }]; a água fica em y = nível.
// opções: mirror (reflexo de verdade), taps4 (4 leituras do mapa de normais), alpha [raso, fundo], cores (THREE.Color, lineares)
export class OceanWater {
  constructor({ chunks, y = 0.05, mirror = false, taps4 = true, alpha = [0.7, 0.92], wave = 0.9, noiseScale = 0.05, distortion = 3, reflect = 1, rf0 = 0.22, tint = 0xffffff, mirrorWanted = null,
    waterColor = 0x2a7fa6, deepColor = 0x0e3a63, sunDir = new THREE.Vector3(-14, 26, 10) } = {}) {
    loadNormals();
    this.y = y;
    this.chunks = chunks;
    this.group = new THREE.Group();
    this.group.position.y = y;
    this.group.renderOrder = 4;
    this.mirror = mirror ? new PlanarMirror() : null;
    this.mirrorWanted = mirrorWanted; // função: false desliga o reflexo na hora (o ajuste automático de gráficos baixa o perfil durante o jogo)
    this.mirrorOn = !!mirror;
    this.base = { water: new THREE.Color(waterColor), deep: new THREE.Color(deepColor), sun: new THREE.Color(0xfff1d6) };
    const defines = {};
    if (mirror) defines.MIRROR = 1;
    if (taps4) defines.NOISE4 = 1;
    this.material = new THREE.ShaderMaterial({
      defines,
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
        time: { value: 0 }, noiseScale: { value: noiseScale }, distortionScale: { value: distortion }, uWave: { value: wave }, uReflect: { value: reflect }, uRf0: { value: rf0 }, uTint: { value: new THREE.Color(tint) },
        uAlphaShallow: { value: alpha[0] }, uAlphaDeep: { value: alpha[1] },
        sunColor: { value: new THREE.Color(0xfff1d6) }, sunDirection: { value: new THREE.Vector3().copy(sunDir).normalize() },
        waterColor: { value: new THREE.Color(waterColor) }, deepColor: { value: new THREE.Color(deepColor) },
        uSkyHorizon: { value: new THREE.Color(0x9fd0f0) }, uSkyZenith: { value: new THREE.Color(0x4a86c8) },
        textureMatrix: { value: new THREE.Matrix4() }, mirrorSampler: { value: null }, normalSampler: { value: null },
      }]),
      vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, fog: true,
    });
    this.material.uniforms.normalSampler = normalUniform; // compartilhado: troca sozinho quando o arquivo chega
    this.meshes = chunks.map(({ geometry }) => {
      const m = new THREE.Mesh(geometry, this.material);
      m.frustumCulled = true;
      m.renderOrder = 4;
      this.group.add(m);
      return m;
    });
    this._tmpColor = new THREE.Color();
  }

  // t: segundos; env: { dark (0 dia … 1 noite), sky (Color do céu/névoa), sunDir (Vector3 para o sol), sunColor (Color) }
  update(t, env = {}) {
    const u = this.material.uniforms, dark = env.dark || 0;
    u.time.value = t;
    if (env.sunDir) u.sunDirection.value.copy(env.sunDir).normalize();
    // de noite a água escurece e o sol vira luz de lua
    u.sunColor.value.copy(env.sunColor || this.base.sun).multiplyScalar(1 - 0.78 * dark);
    const k = 1 - 0.7 * dark;
    u.waterColor.value.copy(this.base.water).multiplyScalar(k);
    u.deepColor.value.copy(this.base.deep).multiplyScalar(k);
    if (env.sky) {
      u.uSkyHorizon.value.copy(env.sky);
      u.uSkyZenith.value.copy(env.sky).multiply(this._tmpColor.setRGB(0.55, 0.72, 1.0)); // zênite mais azul que o horizonte
    }
  }

  // Chamar antes de desenhar o quadro: refaz o espelho só se algum pedaço de água aparece na tela
  prepare(renderer, scene, camera) {
    if (!this.mirror) return;
    const want = !this.mirrorWanted || this.mirrorWanted();
    if (want !== this.mirrorOn) { // liga ou desliga o reflexo (recompila o shader uma vez)
      this.mirrorOn = want;
      if (want) this.material.defines.MIRROR = 1; else { delete this.material.defines.MIRROR; this.mirror.dispose(); }
      this.material.needsUpdate = true;
    }
    if (!this.mirrorOn) return;
    camera.updateMatrixWorld();
    _pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    _frustum.setFromProjectionMatrix(_pv);
    let seen = false;
    for (const c of this.chunks) if (_frustum.intersectsBox(c.box)) { seen = true; break; }
    if (!seen) return;
    if (this.mirror.render(renderer, scene, camera, this.y, this.group)) {
      this.material.uniforms.textureMatrix.value.copy(this.mirror.matrix);
      this.material.uniforms.mirrorSampler.value = this.mirror.rt.texture;
    }
  }

  dispose() {
    for (const c of this.chunks) c.geometry.dispose();
    this.material.dispose();
    if (this.mirror) this.mirror.dispose();
  }
}

// Geometria de um retângulo de água (cena de abertura): um plano com raso/margem constantes
export function planeChunk(w, d, cx, cz, y, deep = 0.7, shore = 0) {
  const geometry = new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2).translate(cx, 0, cz);
  const n = geometry.attributes.position.count;
  geometry.setAttribute('aDeep', new THREE.BufferAttribute(new Float32Array(n).fill(deep), 1));
  geometry.setAttribute('aShore', new THREE.BufferAttribute(new Float32Array(n).fill(shore), 1));
  return { geometry, box: new THREE.Box3(new THREE.Vector3(cx - w / 2, y - 0.2, cz - d / 2), new THREE.Vector3(cx + w / 2, y + 0.2, cz + d / 2)) };
}
