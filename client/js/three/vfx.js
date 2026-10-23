// Efeitos de habilidades em shader (impacto, golpe, projétil, áreas, explosão, escudo, cura, estados).
// Os shaders são portes para GLSL/Three.js dos pacotes "Binbun VFX Vol. 2" (Hit FX, Battle FX, Elemental Magic FX, Dark Magic FX,
// Status FX e Explosion FX) de Binbun3D — bun3d.com — licença CC0 (veja assets/vfx/LICENSE.txt). Os originais são para a Godot e
// usam texturas de ruído; aqui o ruído é calculado no próprio shader. Níveis (Opções > Gráficos > Efeitos de habilidades):
// 0 = efeitos simples de antes, 1 = shaders nas habilidades, 2 = completo (camadas extras, fumaça e auras de estado).
import * as THREE from 'three';
import { quality } from '../device.js';

const Q = quality();
export const vfxTime = { value: 0 };

// ------------------------------------------------------------------ paletas (principal, secundária, terciária)
const PAL = {
  fire: ['#ffc040', '#ff6a1a', '#8f1a0c'], ash: ['#ffc880', '#d9731a', '#4a2318'], meteor: ['#ffd060', '#ff5a14', '#7d1608'],
  frost: ['#b8f0ff', '#3fb4f0', '#1b4c8c'], frostnova: ['#c4f4ff', '#40b0ff', '#17407f'],
  arcane: ['#e6b8ff', '#a040e0', '#4a1a73'], shadow: ['#c890f0', '#6a2c91', '#1b0a2c'], void: ['#d890ff', '#8222c9', '#10031c'],
  holy: ['#fff0a0', '#ffc830', '#b8860b'], grace: ['#fff0a0', '#ffc830', '#b8860b'], consec: ['#ffe680', '#f9a825', '#8a5a00'],
  bless: ['#ffe0b0', '#ff9a2a', '#8a4a00'], faith: ['#fff0a0', '#fbc02d', '#9a6a00'], hawk: ['#ffe680', '#f9a825', '#8a5a00'],
  poison: ['#c8ff50', '#5fa012', '#1f3d0a'], heal: ['#b0ffc8', '#34d070', '#12663a'], elixir: ['#ffb0d0', '#ec407a', '#7a1236'],
  stomp: ['#e8d0a0', '#a47a48', '#4a3320'], rock: ['#dccab0', '#8d6e63', '#3e2c22'], charge: ['#ffb088', '#e8501a', '#701a08'],
  shout: ['#ffe080', '#ff9a14', '#7a3a00'], whirl: ['#e8eef4', '#9fb4c4', '#3b4a58'], fury: ['#ff9a78', '#e53935', '#6a0f10'],
  enrage: ['#ff7a70', '#d32f2f', '#5a0a0a'], harden: ['#c8b8ff', '#7e57c2', '#2b1a6a'], arcane_shield: ['#e8c0ff', '#9c27b0', '#3a0f55'],
  blink: ['#e8b8ff', '#9a30c0', '#3a0f55'], roll: ['#ffe680', '#d4b000', '#6a5500'], web: ['#f0f0f0', '#a8b0b8', '#5a636b'],
  roots: ['#c8b498', '#6a4a30', '#2a1a10'], arrows: ['#e0d0bc', '#8a6a4c', '#3a2a1c'], slash: ['#f4fbff', '#8fd0ff', '#25405a'],
  heavy: ['#ffe8a0', '#ff9a30', '#6a3000'], exec: ['#ffe8a0', '#ff7a1a', '#6a2000'], claw: ['#ffc0b0', '#e53935', '#5a1010'],
  hit: ['#fff0c0', '#ff9a30', '#a03010'],
};
const colorCache = new Map();
function col(hex) { let c = colorCache.get(hex); if (!c) { c = new THREE.Color(hex); colorCache.set(hex, c); } return c; }
export function palette(style, fallback = 'hit') {
  const p = PAL[style] || PAL[fallback];
  return [col(p[0]), col(p[1]), col(p[2])];
}
// a partir de uma cor solta (cor do monstro, por exemplo): principal clara, secundária a própria cor
export function paletteFromColor(hex) {
  const c = new THREE.Color(hex);
  return [new THREE.Color(0xffffff).lerp(c, 0.25), c, c.clone().multiplyScalar(0.35)];
}

// ------------------------------------------------------------------ GLSL
const COMMON = `
#define PI 3.14159265359
#define TAU 6.28318530718
uniform float uTime;
varying vec2 vUv;
varying vec3 vN;
varying vec3 vV;
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y);
}
float noi(vec2 p){ return 0.5 * vn(p) + 0.3 * vn(p * 2.07 + vec2(5.2, 1.3)) + 0.2 * vn(p * 4.31 + vec2(9.7, 3.1)); }
float ovl(float b, float s){ return mix(2.0 * b * s, 1.0 - 2.0 * (1.0 - b) * (1.0 - s), step(0.5, b)); }
vec3 hueShift(vec3 c, float s){ const vec3 g = vec3(0.57735); vec3 pr = g * dot(g, c); vec3 U = c - pr; vec3 V = cross(g, U); return U * cos(s * TAU) + V * sin(s * TAU) + pr; }
// ruído em coordenadas polares sem emenda no ângulo: a, r, escala angular, deslocamento radial/tempo
float pnoi(float a, float r, float k, vec2 off){ return noi(vec2(cos(a), sin(a)) * k + vec2(r * k + off.x, off.y)); }
`;
const TAIL = `
vec4 shade();
void main(){
  gl_FragColor = shade();
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

// vértices: malha normal (com deslocamento opcional), quadrado que olha para a câmera e quadrado com giro
const VERT_MESH = (disp = '') => `
varying vec2 vUv; varying vec3 vN; varying vec3 vV;
uniform float uTime;
#define PI 3.14159265359
#define TAU 6.28318530718
void main(){
  vUv = uv;
  vec3 pos = position; vec3 nrm = normal;
  ${disp}
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  vN = normalize(normalMatrix * nrm);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;
const VERT_BILL = `
varying vec2 vUv; varying vec3 vN; varying vec3 vV;
uniform float uRot;
void main(){
  vUv = uv;
  vec4 c = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  vec2 s = vec2(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz));
  float cs = cos(uRot), sn = sin(uRot);
  vec2 p = vec2(position.x * cs - position.y * sn, position.x * sn + position.y * cs) * s;
  c.xy += p;
  vN = vec3(0.0, 0.0, 1.0); vV = vec3(0.0, 0.0, 1.0);
  gl_Position = projectionMatrix * c;
}`;

const FRAG = {
  // ---- Hit FX: estrela de quatro pontas, brilho, anel de impacto, raios e cortes
  star: `
uniform vec3 uA; uniform vec3 uB; uniform float uEmis; uniform float uLife; uniform float uShape;
vec4 shade(){
  vec2 u = abs(vUv * 2.0 - 1.0);
  float d = max(uLife, 0.001);
  float v = clamp(pow(u.x, uShape * d) + pow(u.y, uShape * d), 0.0, 2.0);
  v = 1.0 - smoothstep(0.85, 0.95, v);
  return vec4(mix(uB, uA, v) * uEmis, v);
}`,
  flare: `
uniform vec3 uA; uniform vec3 uB; uniform float uEmis; uniform float uLife; uniform float uStreaks; uniform float uId;
vec4 shade(){
  vec2 c = vUv - 0.5;
  float r = length(c) * 2.0;
  float flare = pow(max(1.0 - r, 0.0), 5.0) * 0.9;
  float ang = atan(c.x, c.y);
  float st = pow(cos((ang + uId) * uStreaks) * 0.5 + 0.5, 16.0) * (sin((ang + uId) * 12.0) * 0.5 + 0.5) * max(1.0 - r, 0.0);
  float v = max(ovl(flare, st), flare * 0.5);
  v *= 0.5 + (sin((ang + uId) * 5.0 + uId) * 0.5 + 0.5) * 0.5;
  v = smoothstep(0.05, 0.555, v);
  return vec4(mix(uB, uA, v) * uEmis, v * uLife);
}`,
  ring: `
uniform vec3 uA; uniform vec3 uB; uniform float uEmis; uniform float uGrow; uniform float uStreaks; uniform float uLife;
vec4 shade(){
  vec2 cu = vUv * 2.0 - 1.0;
  float radius = length(cu);
  float ang = atan(cu.x, cu.y);
  float f = uGrow * 4.0 - 1.0;
  float off = abs(sin(ang * (uStreaks * 0.5) + uTime)) * radius + sin(ang * 10.0) * radius * 0.1;
  radius += off * 0.5;
  float v = 1.0 - abs(radius * 2.0 - f);
  v *= pow(max(1.0 - radius, 0.0), 0.1);
  v = smoothstep(0.25, 0.755, v);
  return vec4(mix(uB, uA, v) * uEmis, v * uLife);
}`,
  streaks: `
uniform vec3 uA; uniform vec3 uB; uniform float uEmis; uniform float uLife;
uniform float uS1; uniform float uS2; uniform float uFade; uniform float uThick; uniform float uCenter; uniform float uFadeR;
vec4 shade(){
  vec2 c = vUv - 0.5;
  float ang = atan(c.x, c.y);
  float radius = length(c) * 2.0;
  float s1 = sin(ang * uS1 + PI + uTime * 2.0), s2 = sin(ang * uS2 - PI - uTime * 2.0);
  float v = ovl(s1, s2);
  v -= (1.0 - radius) * uFade;
  v *= 1.0 - (radius - v * uThick);
  float mask = max(1.0 - radius, 0.0);
  v = min(v * mask, mask);
  v = smoothstep(0.1, 1.0, v);
  v *= pow(clamp((radius - uCenter) / max(uFadeR - uCenter, 0.001), 0.0, 1.0), 4.0);
  return vec4(mix(uB, uA, v) * uEmis, v * uLife);
}`,
  flash: `
uniform vec3 uA; uniform vec3 uB; uniform float uEmis; uniform float uF; uniform float uPinch; uniform float uId;
vec4 shade(){
  float f = max(uF, 0.001);
  vec2 su = (1.0 - vUv - vec2(0.5, 0.0)) * vec2(2.0, 1.0);
  float r = length(su);
  float grad = pow(max(1.0 - vUv.y, 0.0), 0.5) * 2.0;
  r /= (1.0 - uPinch) + grad * uPinch;
  float n = noi((vUv + vec2(0.0, f) + uId / PI) * vec2(2.4, 0.8) * 3.0);
  float shape = (r - n * 0.5) * 2.0;
  float v = 1.0 - abs(shape * 2.0 - (f * 4.0 - 1.0));
  v *= clamp(1.0 - shape * shape * shape, 0.0, 1.0) * grad;
  v *= pow(f, 0.1) * min(vUv.y * 8.0, 1.0);
  v = smoothstep(0.15, 0.36, v);
  return vec4(mix(uB, uA, v) * uEmis, v);
}`,
  // ---- Battle FX: golpe de arma em arco
  swing: `
uniform vec3 uA; uniform vec3 uB; uniform vec3 uC; uniform float uEmis; uniform float uF; uniform float uCenter;
uniform float uEdgePos; uniform float uEdgeHard; uniform float uNShape;
vec4 shade(){
  vec2 cu = vUv * 2.0 - 1.0;
  float radius = length(cu);
  float ang = atan(cu.x, cu.y);
  float factor = uF * TAU - PI;
  float shapeMask = max(sin(ang + factor), 0.0);
  float baseMask = max(sin(ang), 0.0);
  float colorMask = clamp((1.0 - sin(ang / 2.0 + factor / 2.0)) * 3.0, 0.0, 1.0);
  float shape = clamp((radius - 0.2) / (0.8 - (1.0 - uCenter)), 0.0, 1.0) - clamp((radius - uCenter) / (1.0 - uCenter), 0.0, 1.0);
  float wave = sin((radius * TAU - uTime) * 6.0) * 0.5 + 0.5;
  shape = pow(max(shape - wave * 0.1, 0.0), 3.0);
  float n = pow(pnoi(ang, radius * 0.5, 1.3, vec2(uTime * 0.5, 0.0)), uNShape);
  float v = ovl(shape, n);
  v = (v - (1.0 - shapeMask) * 0.5) * shapeMask * baseMask;
  v = clamp(v - uEdgePos, 0.0, 1.0);
  vec3 c = mix(uC, mix(uB, uA, v), colorMask);
  return vec4(c * uEmis, clamp(v / max(1.0 - uEdgeHard, 0.05), 0.0, 1.0));
}`,
  // ---- Elemental Magic FX: projétil, área no chão, coluna de chamas e chama de lançamento
  proj: `
uniform vec3 uA; uniform vec3 uB; uniform vec3 uC; uniform float uEmis; uniform float uGrow; uniform float uCurve;
uniform float uWScale; uniform float uWOff; uniform float uWSpeed; uniform float uWNoise; uniform float uWDetail; uniform float uWTwist; uniform float uNCurve;
float waveF(vec2 uv, float offset){
  float xw = sin(uv.x * TAU * uWDetail + uv.y * TAU * uWTwist) * 0.2;
  float ty = fract((uv.y * 2.0 - uTime * uWSpeed) * uWScale + offset * uWNoise + xw);
  return min(ty / uWOff, (1.0 - ty) / (1.0 - uWOff));
}
vec4 shade(){
  float n = 1.0 - noi(vUv * vec2(3.0, 1.5) + vec2(uTime * 0.5, 0.0));
  float w = pow(max(waveF(vUv, n), 0.0), uNCurve);
  float fade = max(((1.0 - vUv.y) + w * 0.1) - 0.4, 0.0);
  fade = smoothstep(1.0 - uGrow, 0.5 + (1.0 - uGrow) * 0.5, fade);
  vec3 tail = mix(uC, uB, w);
  vec3 c = mix(tail, uA, pow(fade, uCurve));
  return vec4(c * uEmis, smoothstep(0.0, 1.01, fade));
}`,
  ground: `
uniform vec3 uA; uniform vec3 uB; uniform float uEmis; uniform float uGrow; uniform float uCurve; uniform float uEdgeH; uniform float uEdgeP; uniform float uLife;
vec4 shade(){
  vec2 c = vUv - 0.5;
  float r = length(c) * 2.0;
  float g = pow(clamp(1.0 - r, 0.0, 1.0) * uGrow, 0.65);
  float ang = atan(c.y, c.x);
  float n = pnoi(ang, r * 0.5, 1.4, vec2(-uTime * 0.35, uTime * 0.12));
  g = mix(ovl(g, n), g, 0.5);
  float v = mix(g, floor(g * 3.0) / 3.0, uEdgeH);
  vec3 col = mix(uB, uA, pow(clamp(v, 0.0, 1.0), uCurve));
  float a = smoothstep(uEdgeH * uEdgeP, 1.01 - uEdgeH * (1.0 - uEdgeP), g);
  return vec4(col * uEmis, a * uLife);
}`,
  column: `
uniform vec3 uA; uniform vec3 uB; uniform vec3 uC; uniform float uEmis; uniform float uGrow; uniform float uCurve; uniform float uShape;
uniform float uEdgeH; uniform float uEdgeP; uniform float uLife;
vec4 shade(){
  float wx = sin((vUv.x + uTime * 0.1) * PI * 12.0) * 0.5 + 0.5;
  vec2 nuv = vec2(vUv.x * 4.0 + uTime * 0.1, vUv.y * 2.0 - uTime * 0.3);
  float n = noi(nuv), n2 = noi(nuv * 2.0);
  n = pow(ovl(n, n2), uShape);
  float gradient = (vUv.y * 2.0) - (1.0 - uGrow);
  float m1 = (gradient - wx * 0.1) * 2.0 - 1.0;
  float w1 = sin(m1 * 8.0 + uTime * 20.0) * 0.5 + 0.5;
  float v1 = smoothstep(0.2, 1.0, ovl(clamp(m1, 0.0, 1.0), max(n - w1 * wx * 0.5, 0.0)));
  float m2 = (gradient - wx * 0.1) * 2.0 - 0.6;
  float w2 = sin(m2 * 8.0 + uTime * 20.0) * 0.5 + 0.5;
  float v2 = smoothstep(0.2, 1.0, ovl(clamp(m2, 0.0, 1.0), max(n - w2 * wx * 0.5, 0.0)));
  float a = max(max(v1, v2), pow(max(gradient, 0.0), 3.0));
  a = smoothstep(uEdgeH * uEdgeP, 1.01 - uEdgeH * (1.0 - uEdgeP), a);
  vec3 l1 = mix(uB, uA, v1);
  vec3 l2 = mix(uC, uB, pow(v2, uCurve));
  vec3 c = mix(l2, l1, v1);
  return vec4(c * uEmis, a * uLife);
}`,
  cast: `
uniform vec3 uA; uniform vec3 uB; uniform float uEmis; uniform float uGrow; uniform float uCurve; uniform float uLife;
vec4 shade(){
  float n = noi(vec2(vUv.x * 5.0, vUv.y * 2.0) + vec2(uTime * 0.1, uTime * 0.6));
  float fg = max(vUv.y * 4.0 - 3.0, 0.0);
  float wave = max(sin((fg + (uGrow - 0.5) * 2.0) * PI) * fg, 0.0);
  float v = smoothstep(0.2, 0.8, n * wave);
  v *= cos(vUv.x * TAU * 4.0) * 0.5 + 0.5;
  float glow = pow(max((vUv.y - 0.8) / 0.2, 0.0), 2.0) * max(sin(uGrow * PI * 1.5), 0.0);
  vec3 c = mix(uB, uA, pow(v, uCurve)) + uA * min(glow * 20.0, 1.0);
  float a = min(v + glow, 1.0);
  return vec4(c * uEmis, smoothstep(0.0, 1.01, a) * uLife);
}`,
  // ---- Dark Magic FX: esfera do vazio, núcleo escuro, vórtice, anel e chão sombrio
  voidball: `
uniform vec3 uA; uniform vec3 uB; uniform float uEmis; uniform float uDecay; uniform vec2 uScroll;
vec4 shade(){
  float fres = max(dot(vV, vN), 0.0);
  float n = noi(vUv * vec2(4.0, 2.0) + vec2(sin(uTime), cos(uTime)) * uScroll.y);
  float mask = sin(vUv.y * PI);
  float v = fres + pow(n, 8.0) * 4.0 * mask;
  vec3 c = mix(uB, uA, clamp(v, 0.0, 1.5));
  return vec4(c * uEmis, max(fres - uDecay, 0.0));
}`,
  voidcore: `
uniform float uDecay;
vec4 shade(){ float fres = max(dot(vV, vN), 0.0); return vec4(vec3(0.0), max(fres - uDecay, 0.0)); }`,
  vortex: `
uniform vec3 uA; uniform vec3 uB; uniform float uEmis; uniform float uDecay; uniform float uWaveF; uniform float uSpeed; uniform float uLife;
vec4 shade(){
  vec2 cu = vUv * 2.0 - 1.0;
  float radius = length(cu);
  float ang = atan(cu.x, cu.y);
  float wave = sin(radius * uWaveF - uTime * 2.0) + sin(radius * (uWaveF / 5.0 * 9.0) - uTime * 2.0);
  float streaks = sin(ang * 5.0 + uTime) * 0.5 + 0.5;
  float n = pnoi(ang + radius * 2.0, radius * 0.5, 1.3, vec2(-uTime * 0.2 * uSpeed, 0.0)) ;
  n += wave * 0.05;
  float v = n + pow(1.0 - radius, 4.0) * 1.5;
  v *= sqrt(max(1.0 - radius, 0.0));
  v -= streaks * 0.2;
  v = smoothstep(0.0, 1.0, v);
  v = ovl(v, pow(v, 2.0));
  v = max(v - uDecay - 0.05, 0.0);
  return vec4(mix(uB, uA, v) * 2.0 * uEmis, clamp(v, 0.0, 1.0) * uLife);
}`,
  darkring: `
uniform vec3 uA; uniform vec3 uB; uniform float uEmis; uniform float uDecay; uniform float uLife;
vec4 shade(){
  vec2 cu = vUv * 2.0 - 1.0;
  float radius = length(cu);
  float ang = atan(cu.x, cu.y);
  float n = pnoi(ang, radius * 0.5, 1.6, vec2(-uTime * 0.2, 0.0));
  float mask = pow(1.0 - min(abs(radius * 2.0 - 1.0), 1.0), 8.0);
  float v = max(ovl(mask, n) - 0.05, 0.0);
  v = clamp(v - uDecay, 0.0, 1.0);
  return vec4(mix(uB, uA, v) * uEmis, v * uLife);
}`,
  darkfloor: `
uniform float uDecay; uniform float uLife;
vec4 shade(){
  vec2 cu = vUv * 2.0 - 1.0;
  float radius = length(cu);
  float ang = atan(cu.x, cu.y);
  float wave = sin(radius * 5.0 - uTime * 2.0) + sin(radius * 9.0 - uTime * 2.0);
  float streaks = sin(ang * 5.0 + uTime) * 0.5 + 0.5;
  float n = pnoi(ang, radius * 0.5, 1.4, vec2(-uTime * 0.2, 0.0)) + wave * 0.03;
  float v = n + pow(1.0 - radius, 4.0) * 2.0;
  v *= sqrt(max(1.0 - radius, 0.0));
  v = smoothstep(0.0, 1.0, v - streaks * 0.2);
  v = max(v - 0.05, 0.0);
  return vec4(vec3(0.0), clamp(v - uDecay, 0.0, 1.0) * 0.85 * uLife);
}`,
  lift: `
uniform vec3 uA; uniform vec3 uB; uniform float uEmis; uniform float uDecay; uniform float uLife;
vec4 shade(){
  float yy = vUv.y; // 1 na base da coluna, 0 no topo
  float wave = sin(yy * TAU * 2.5 - uTime) * (1.0 - yy);
  float n = noi((vUv + vec2(wave * 0.05, 0.0)) * vec2(4.0, 2.0) + vec2(0.0, uTime * 0.4));
  float v = clamp(n * yy * 1.2 + pow(yy, 4.0), 0.0, 1.0);
  v = clamp(pow(v, 2.0) - uDecay, 0.0, 1.0);
  float side = pow(abs(dot(vV, vN)), 2.2); // bordas da coluna somem: sem "tubo" visível
  return vec4(mix(uB, uA, v) * uEmis, v * uLife * side);
}`,
  // ---- Explosion FX
  explsphere: `
uniform vec3 uA; uniform vec3 uB; uniform float uEmis; uniform float uDecay;
vec4 shade(){
  vec2 nuv = vUv * vec2(6.0, 3.5) + vec2(-0.25, 0.35) * uTime; nuv.x += nuv.y * 0.5;
  float n = smoothstep(0.22, 0.82, noi(nuv));
  float n2 = noi(nuv * 2.3 + 3.1);
  float fres = clamp(dot(vV, vN), 0.0, 1.0);
  float v = n * 0.7 + n2 * 0.25 + fres * 0.3;
  if (v - uDecay < 0.2) discard;
  float heat = smoothstep(0.1, 0.95, v - uDecay * 0.6 + (n - 0.5) * 0.5);
  vec3 c = mix(uB * 0.7, uA, heat) * mix(0.5, 1.0, fres);
  return vec4(c * uEmis, 1.0);
}`,
  explring: `
uniform vec3 uA; uniform vec3 uB; uniform float uEmis; uniform float uDecay;
vec4 shade(){
  float mask = 1.0 - abs(vUv.y * 4.0 - 1.0);
  float n = noi(vUv * vec2(8.0, 2.0) + vec2(0.0, uTime * 0.2));
  float v = max(mask - (1.0 - n) - uDecay, 0.0);
  vec3 c = gl_FrontFacing ? uA : uB;
  return vec4(c * uEmis, clamp(v * 2.0, 0.0, 1.0));
}`,
  smoke: `
uniform vec3 uA; uniform vec3 uC; uniform float uLife; uniform float uSeed;
vec4 shade(){
  vec2 c = vUv * 2.0 - 1.0;
  float r = length(c);
  float n = noi((vUv + uSeed) * 3.0 + vec2(uTime * 0.05, -uTime * 0.12));
  float v = n * 1.3 - (1.0 - uLife) * 1.1 - pow(r, 3.0) * 0.9;
  vec3 col = mix(uC, uA, smoothstep(0.2, 0.7, n)) ;
  return vec4(col, clamp(v * 1.6, 0.0, 1.0));
}`,
  // névoa baixa em movimento (cena de abertura)
  mist: `
uniform vec3 uA; uniform float uLife; uniform float uScale; uniform vec2 uDrift;
vec4 shade(){
  vec2 p = vUv * uScale + uDrift * uTime;
  float n = noi(p) * 0.6 + noi(p * 2.3 + 7.0) * 0.4;
  float d = length(vUv - 0.5) * 2.0;
  float a = smoothstep(0.38, 0.82, n) * (1.0 - smoothstep(0.45, 1.0, d)) * uLife;
  return vec4(uA, a);
}`,
  // ---- Battle FX: escudo (casca com fresnel e superfície em ruído)
  shell: `
uniform vec3 uA; uniform vec3 uB; uniform float uEmis; uniform float uDecay;
vec4 shade(){
  float fres = 1.0 - clamp(dot(vV, vN), 0.0, 1.0);
  float v = smoothstep(0.0, 1.0, fres);
  return vec4(mix(uB, uA, v) * uEmis, max(v - uDecay, 0.0));
}`,
  shield: `
uniform vec3 uA; uniform vec3 uB; uniform vec3 uC; uniform float uEmis; uniform float uDecay;
vec2 suv(vec2 uv){ uv = uv * vec2(4.0, 3.0) + vec2(-0.2, 0.4) * uTime; uv.x += uv.y; return uv; }
vec4 shade(){
  vec2 uv = suv(vUv);
  float n = ovl(noi(uv), noi(uv * 2.0));
  float p1 = smoothstep(0.5, 1.0, n) * 0.5, p2 = pow(smoothstep(0.0, 0.5, n), 1.5) * 0.5;
  float fres = pow(1.0 - clamp(dot(vV, vN), 0.0, 1.0), 3.0);
  float wave = sin(suv(vUv).x * TAU * 4.0 + uTime * 4.0) * 0.4 + 0.6;
  float v = (p1 + p2) * wave + fres;
  vec3 c = mix(uC, uB, smoothstep(0.0, 0.2, v));
  c = mix(c, uA, smoothstep(0.0, 1.0, v));
  float a = clamp((n + 1.0) - uDecay * 2.0, 0.0, 1.0);
  if (a < 0.5) discard;
  return vec4(c * uEmis, 0.55);
}`,
  // ---- Status FX: partículas pequenas (cura, gelo, bolha, sono, ruído) e aura
  plus: `
uniform vec3 uA; uniform vec3 uB; uniform float uEmis; uniform float uLife; uniform float uRand;
vec4 shade(){
  vec2 c = vUv * 2.0 - 1.0;
  float shape = step(0.7, max(1.0 - abs(c.x), 1.0 - abs(c.y)));
  vec3 col = hueShift(mix(uB, uA, 1.0 - vUv.y), (uRand - 0.5) * 0.1);
  return vec4(col * uEmis, shape * uLife);
}`,
  crystal: `
uniform vec3 uA; uniform vec3 uB; uniform float uEmis; uniform float uLife; uniform float uRand;
vec4 shade(){
  vec2 c = vUv * 2.0 - 1.0;
  float r = length(c);
  float ang = atan(c.x, c.y);
  float circle = max(1.0 - r, 0.0);
  float branches = pow(sin(r * PI * (3.0 + floor(uRand * 5.0))) * 0.5 + 0.5, 10.0) * circle;
  float st = cos(ang * (5.0 + floor(uRand * 3.0))) + pow(max(1.0 - r, 0.0), 4.0) * 4.0 + branches * 3.0;
  st = step(1.0, st * uLife);
  vec3 col = hueShift(mix(uB, uA, 1.0 - vUv.y), (uRand - 0.5) * 0.1);
  return vec4(col * uEmis, st);
}`,
  bubble: `
uniform vec3 uA; uniform vec3 uB; uniform float uEmis; uniform float uLife; uniform float uRand; uniform float uWarp;
vec4 shade(){
  vec2 c = vUv - 0.5;
  float ang = atan(c.x, c.y);
  float wave = cos((ang + uTime) * (3.0 + floor(uRand * 4.0))) + sin((ang - uTime) * (3.0 + floor(fract(uRand * 7.0) * 4.0)));
  float r = length(vUv * 2.0 - 1.0);
  float sr = r + wave * uWarp * r;
  float shape = max((0.2 + (pow(sr, 4.0) / 0.8) * 0.8) * step(sr, 0.8) - (1.0 - uLife), 0.0);
  float shine = pow(max(1.0 - (length(vUv * 2.0 - 0.7) + 0.8) - (1.0 - uLife), 0.0), 0.5) * step(sr, 0.8);
  shape += shine;
  vec3 col = hueShift(mix(uB, uA, shape), (uRand - 0.5) * 0.1);
  return vec4(col * uEmis, clamp((shape - 0.2) / 0.8, 0.0, 1.0));
}`,
  sleep: `
uniform vec3 uA; uniform vec3 uB; uniform float uEmis; uniform float uLife; uniform float uRand;
vec4 shade(){
  vec2 c = vUv * 2.0 - 1.0;
  float diag = 1.0 - abs(c.x + c.y);
  float shape = max(max(0.0, abs(c.y)), diag) - (1.0 - uLife);
  shape = step(0.5, shape);
  vec3 col = hueShift(mix(uB, uA, 1.0 - vUv.y), (uRand - 0.5) * 0.1);
  return vec4(col * uEmis, shape);
}`,
  puff: `
uniform vec3 uA; uniform vec3 uB; uniform float uEmis; uniform float uLife; uniform float uRand;
vec4 shade(){
  float n = noi((vUv + uRand) * 1.3 + vec2(uTime * 0.1, uTime * 0.4));
  float shape = smoothstep(0.15, 0.7, (1.0 - length(vUv * 2.0 - 1.0)) * n * 2.2);
  vec3 col = mix(uB, uA, n);
  return vec4(col * uEmis, shape * uLife);
}`,
};

// ------------------------------------------------------------------ materiais
const BLEND = { add: THREE.AdditiveBlending, mix: THREE.NormalBlending };
// vert: 'bill' | 'mesh' | string (deslocamento extra); blend: 'add' | 'mix'
const C = 'c'; // marca um uniform de cor nas especificações
const SPECS = {
  star: { vert: 'bill', blend: 'add', u: { uA: C, uB: C, uEmis: 1.4, uLife: 1, uShape: 0.6, uRot: 0 } },
  flare: { vert: 'bill', blend: 'add', u: { uA: C, uB: C, uEmis: 1.2, uLife: 1, uStreaks: 4, uId: 0, uRot: 0 } },
  ring: { vert: 'bill', blend: 'add', u: { uA: C, uB: C, uEmis: 1.3, uGrow: 0.5, uStreaks: 7, uLife: 1, uRot: 0 } },
  streaks: { vert: 'bill', blend: 'add', u: { uA: C, uB: C, uEmis: 1.6, uLife: 1, uS1: 7, uS2: 15, uFade: 0.72, uThick: 0, uCenter: 0, uFadeR: 0.39, uRot: 0 } },
  flash: { vert: 'bill', blend: 'add', u: { uA: C, uB: C, uEmis: 1.5, uF: 0.5, uPinch: 0.4, uId: 0, uRot: 0 } },
  swing: { vert: 'mesh', blend: 'add', u: { uA: C, uB: C, uC: C, uEmis: 1.4, uF: 0.5, uCenter: 0.9, uEdgePos: 0.1, uEdgeHard: 0.8, uNShape: 1 } },
  proj: { vert: 'mesh', blend: 'add', u: { uA: C, uB: C, uC: C, uEmis: 1.5, uGrow: 1, uCurve: 4, uWScale: 2, uWOff: 0.6, uWSpeed: 1, uWNoise: 0.6, uWDetail: 3, uWTwist: 2, uNCurve: 1 } },
  ground: { vert: 'mesh', blend: 'add', u: { uA: C, uB: C, uEmis: 1.4, uGrow: 1, uCurve: 1, uEdgeH: 0, uEdgeP: 0.2, uLife: 1 } },
  column: { vert: 'mesh', blend: 'add', u: { uA: C, uB: C, uC: C, uEmis: 1.4, uGrow: 1, uCurve: 1, uShape: 1, uEdgeH: 0, uEdgeP: 0.2, uLife: 1 } },
  cast: { vert: 'mesh', blend: 'add', u: { uA: C, uB: C, uEmis: 1.5, uGrow: 0.5, uCurve: 1, uLife: 1 } },
  voidball: {
    vert: `float wobble = sin(uv.x * TAU * 2.0 - uTime * 4.0) * sin(uv.y * TAU * 2.0 + uTime * 4.0) * sin(uv.x * TAU * 4.0 - uTime) * sin(uv.y * TAU * 4.0 + uTime);
           pos += nrm * wobble * 0.5 * 0.45 * pow(sin(uv.y * PI), 0.5);`,
    blend: 'mix', u: { uA: C, uB: C, uEmis: 1.6, uDecay: 0, uScroll: new THREE.Vector2(0, 0.2) },
  },
  voidcore: { vert: 'mesh', blend: 'mix', u: { uDecay: 0 } },
  vortex: { vert: 'mesh', blend: 'add', u: { uA: C, uB: C, uEmis: 1.2, uDecay: 0, uWaveF: 5, uSpeed: 1, uLife: 1 } },
  darkring: { vert: 'mesh', blend: 'add', u: { uA: C, uB: C, uEmis: 1.4, uDecay: 0, uLife: 1 } },
  darkfloor: { vert: 'mesh', blend: 'mix', u: { uDecay: 0, uLife: 1 } },
  lift: { vert: 'mesh', blend: 'add', u: { uA: C, uB: C, uEmis: 1.4, uDecay: 0, uLife: 1 } },
  explsphere: { vert: 'mesh', blend: 'mix', u: { uA: C, uB: C, uEmis: 1.5, uDecay: 0 } },
  explring: { vert: 'mesh', blend: 'add', u: { uA: C, uB: C, uEmis: 1.5, uDecay: 0 } },
  smoke: { vert: 'bill', blend: 'mix', u: { uA: C, uC: C, uLife: 1, uSeed: 0, uRot: 0 } },
  mist: { vert: 'mesh', blend: 'mix', u: { uA: C, uLife: 1, uScale: 4, uDrift: new THREE.Vector2(0.02, 0.01) } },
  shell: { vert: 'mesh', blend: 'add', u: { uA: C, uB: C, uEmis: 1.4, uDecay: 0 } },
  shield: { vert: 'mesh', blend: 'add', u: { uA: C, uB: C, uC: C, uEmis: 1.3, uDecay: 0 } },
  plus: { vert: 'bill', blend: 'add', u: { uA: C, uB: C, uEmis: 1.4, uLife: 1, uRand: 0, uRot: 0 } },
  crystal: { vert: 'bill', blend: 'add', u: { uA: C, uB: C, uEmis: 1.4, uLife: 1, uRand: 0, uRot: 0 } },
  bubble: { vert: 'bill', blend: 'add', u: { uA: C, uB: C, uEmis: 1.3, uLife: 1, uRand: 0, uWarp: 0.03, uRot: 0 } },
  sleep: { vert: 'bill', blend: 'add', u: { uA: C, uB: C, uEmis: 1.4, uLife: 1, uRand: 0, uRot: 0 } },
  puff: { vert: 'bill', blend: 'add', u: { uA: C, uB: C, uEmis: 1.2, uLife: 1, uRand: 0, uRot: 0 } },
};
const programs = {};
// vals: valores dos uniforms (cores como THREE.Color); cada material tem os seus uniforms, mas o relógio é um só
export function fxMaterial(name, vals = {}, opts = {}) {
  const sp = SPECS[name];
  if (!sp) throw new Error('vfx: shader desconhecido ' + name);
  if (!programs[name]) {
    const vs = sp.vert === 'bill' ? VERT_BILL : VERT_MESH(sp.vert === 'mesh' ? '' : sp.vert);
    programs[name] = { vs, fs: COMMON + FRAG[name] + TAIL };
  }
  const uniforms = { uTime: vfxTime };
  for (const [k, d] of Object.entries(sp.u)) uniforms[k] = { value: d && d.isVector2 ? d.clone() : (d === C ? new THREE.Color(1, 1, 1) : d) };
  for (const [k, v] of Object.entries(vals)) {
    if (!uniforms[k]) uniforms[k] = { value: v };
    else if (uniforms[k].value && uniforms[k].value.isColor) uniforms[k].value.copy(v.isColor ? v : new THREE.Color(v));
    else uniforms[k].value = v;
  }
  const m = new THREE.ShaderMaterial({
    uniforms, vertexShader: programs[name].vs, fragmentShader: programs[name].fs,
    transparent: true, depthWrite: false, depthTest: opts.depthTest ?? true, side: opts.side ?? THREE.DoubleSide,
    blending: BLEND[opts.blend || sp.blend], fog: false,
  });
  if (opts.offset) { m.polygonOffset = true; m.polygonOffsetFactor = opts.offset; m.polygonOffsetUnits = opts.offset; }
  return m;
}

// ------------------------------------------------------------------ geometrias compartilhadas (UV como na Godot: v = 0 no topo)
const GEO = {};
function flipV(g) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i)); return g; }
function shared(name, make) {
  if (!GEO[name]) { const g = flipV(make()); g.userData.shared = true; GEO[name] = g; }
  return GEO[name];
}
export const geoQuad = () => shared('quad', () => new THREE.PlaneGeometry(1, 1));
export const geoFlat = () => shared('flat', () => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2));
export const geoSphere = () => shared('sphere', () => new THREE.SphereGeometry(1, 22, 14));
export const geoColumn = () => shared('column', () => new THREE.CylinderGeometry(1, 1, 1, 28, 1, true).translate(0, 0.5, 0));
// projétil: cabeça redonda em +Z (v = 0) e cauda afilada
export const geoComet = () => {
  if (!GEO.comet) {
    const pts = [];
    const N = 14;
    for (let i = 0; i <= N; i++) {
      const v = i / N;
      const r = v < 0.18 ? 0.17 * Math.sin((v / 0.18) * Math.PI / 2 + 0.0001) : 0.17 * (1 - ((v - 0.18) / 0.82) * 0.82);
      pts.push(new THREE.Vector2(Math.max(r, 0.0001), -v * 1.5));
    }
    const g = new THREE.LatheGeometry(pts, 16).rotateX(Math.PI / 2); // eixo Y negativo vira +Z
    g.userData.shared = true;
    GEO.comet = g;
  }
  return GEO.comet;
};

export function quadMesh(mat, size, billboard = true) {
  const m = new THREE.Mesh(billboard ? geoQuad() : geoFlat(), mat);
  m.scale.setScalar(size);
  m.frustumCulled = false;
  m.renderOrder = 30;
  return m;
}
export function meshOf(geo, mat, order = 30) { const m = new THREE.Mesh(geo, mat); m.frustumCulled = false; m.renderOrder = order; return m; }
const ease = (t) => 1 - (1 - t) * (1 - t);
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ------------------------------------------------------------------ efeitos
// Cada construtor devolve { obj, update(t, now) }; t vai de 0 a 1 na duração do efeito.
function hitEffect(pal, crit) {
  const [a, b] = pal;
  const g = new THREE.Group();
  const star = quadMesh(fxMaterial('star', { uA: a, uB: b, uEmis: 0.95, uShape: 0.6 }), crit ? 1.3 : 0.8);
  const flare = quadMesh(fxMaterial('flare', { uA: a, uB: b, uEmis: 0.8, uId: Math.random() * 6 }), crit ? 1.8 : 1.15);
  const streaks = quadMesh(fxMaterial('streaks', { uA: a, uB: b, uEmis: 1.1 }), crit ? 2.1 : 1.3);
  const ring = quadMesh(fxMaterial('ring', { uA: a, uB: b, uEmis: 0.85 }), crit ? 1.6 : 0.95);
  g.add(flare, streaks, ring, star);
  const slashes = [];
  if (crit) {
    for (let i = 0; i < 2; i++) {
      const s = quadMesh(fxMaterial('flash', { uA: b, uB: pal[2], uEmis: 1.3, uId: i * 3 + Math.random() * 4 }), 1.5);
      s.material.uniforms.uRot.value = i * 2.2 + Math.random() * 1.2;
      slashes.push(s); g.add(s);
    }
  }
  return {
    obj: g,
    update(t) {
      const life = Math.pow(1 - t, 0.8);
      star.material.uniforms.uLife.value = Math.max(0.02, Math.min(1, life * 1.4));
      flare.material.uniforms.uLife.value = Math.pow(1 - t, 2);
      streaks.material.uniforms.uLife.value = Math.pow(1 - t, 1.5);
      ring.material.uniforms.uGrow.value = Math.min(1, ease(t) * 0.9 + 0.05);
      ring.material.uniforms.uLife.value = 1 - t * t;
      star.rotation.z = 0;
      for (const s of slashes) s.material.uniforms.uF.value = 0.05 + ease(t) * 0.9;
    },
  };
}

function cometProjectile(style) {
  const pal = palette(style, 'fire');
  const dark = style === 'arcane' || style === 'shadow' || style === 'void';
  const g = new THREE.Group();
  const parts = [];
  if (dark) {
    // esfera do vazio com núcleo escuro e um rastro de fiapos
    const ball = meshOf(geoSphere(), fxMaterial('voidball', { uA: pal[1], uB: pal[2], uEmis: 1.5 }, { side: THREE.FrontSide }));
    ball.scale.setScalar(0.3);
    const core = meshOf(geoSphere(), fxMaterial('voidcore', {}, { side: THREE.FrontSide }), 31);
    core.scale.setScalar(0.15);
    const tail = meshOf(geoComet(), fxMaterial('proj', { uA: pal[0], uB: pal[1], uC: pal[2], uEmis: 0.8, uCurve: 3 }));
    tail.position.z = -0.05; tail.scale.set(0.9, 0.9, 1.2);
    g.add(tail, ball, core);
    parts.push(ball);
  } else {
    const comet = meshOf(geoComet(), fxMaterial('proj', { uA: pal[0].clone().lerp(pal[1], 0.45), uB: pal[1], uC: pal[2], uEmis: 0.75 }));
    comet.scale.set(1.1, 1.1, 1.25);
    g.add(comet);
  }
  const head = quadMesh(fxMaterial('flare', { uA: pal[0].clone().lerp(pal[1], 0.4), uB: pal[1], uEmis: 0.55, uStreaks: 4, uId: Math.random() * 6 }), 0.65);
  g.add(head);
  return {
    obj: g, positioned: true,
    update(t, now) { head.material.uniforms.uId.value = now / 400; },
  };
}

function swingEffect(e, fx) {
  const pal = palette(e.style === 'claw' ? 'claw' : e.style === 'heavy' || e.style === 'exec' ? 'heavy' : 'slash');
  const heavy = e.style === 'heavy' || e.style === 'exec';
  const mat = fxMaterial('swing', { uA: pal[0], uB: pal[1], uC: pal[2], uEmis: 1.7, uCenter: heavy ? 0.85 : 0.9 }, { depthTest: false });
  const m = meshOf(geoFlat(), mat, 40);
  m.scale.setScalar(heavy ? 4.6 : 3.8);
  const mirror = (e.id || 0) % 2 ? -1 : 1;
  const g = new THREE.Group();
  g.add(m);
  return {
    obj: g,
    update(t) {
      const a = fx.game.entities.get(e.id);
      if (!a) return;
      const tg = e.target != null ? fx.game.entities.get(e.target) : null;
      const ang = tg ? Math.atan2(tg.rx - a.rx, tg.ry - a.ry) : (a.facing || 0);
      g.position.set(a.rx + Math.sin(ang) * 0.25, 0.65, a.ry + Math.cos(ang) * 0.25);
      g.rotation.y = ang + Math.PI;
      m.scale.x = Math.abs(m.scale.x) * mirror;
      mat.uniforms.uF.value = 0.12 + ease(t) * 0.82;
    },
  };
}

// área de efeito: chão + coluna (conforme o estilo), com explosão nos estilos de fogo e impacto
const EXPLOSIVE = new Set(['meteor', 'fire', 'ash', 'stomp', 'rock', 'charge']);
const DARK_AREA = new Set(['void', 'shadow']);
const PILLAR = new Set(['grace', 'consec', 'holy', 'bless', 'faith', 'frostnova', 'poison']);
function aoeEffect(e) {
  const style = e.style || 'fire';
  const pal = palette(style, 'fire');
  const r = e.r || 2;
  const g = new THREE.Group();
  g.position.set(e.x, 0.04, e.y);
  const parts = [];
  const full = Q.vfx >= 2;
  const add = (o, upd) => { g.add(o); parts.push(upd); return o; };
  if (EXPLOSIVE.has(style)) {
    const dusty = style === 'stomp' || style === 'rock' || style === 'charge';
    // marca no chão (queimada ou poeira) e flash de luz
    const ground = meshOf(geoFlat(), fxMaterial('ground', { uA: pal[1], uB: pal[2], uEmis: 0.9, uCurve: 1.3 }, { offset: -2, blend: 'mix' }), 28);
    ground.scale.setScalar(r * 2.2);
    add(ground, (t) => { ground.material.uniforms.uLife.value = 0.8 * Math.min(1, t * 10) * (1 - sstep(0.35, 1, t)); ground.material.uniforms.uGrow.value = 0.8 + t * 0.3; });
    const core = quadMesh(fxMaterial('flare', { uA: pal[0], uB: pal[1], uEmis: 0.9, uStreaks: 5, uId: Math.random() * 5 }), r * 2);
    core.position.y = 0.6;
    add(core, (t) => { core.material.uniforms.uLife.value = Math.pow(1 - sstep(0, 0.5, t), 1.5); core.scale.setScalar(r * (1.5 + t * 1.5)); });
    const ring = meshOf(geoColumn(), fxMaterial('explring', { uA: pal[0], uB: pal[1], uEmis: 1.2 }));
    add(ring, (t) => { const k = r * (0.3 + ease(t) * 1.05); ring.scale.set(k, r * 0.6, k); ring.material.uniforms.uDecay.value = sstep(0.1, 1, t) * 0.9; });
    if (!dusty) {
      const sph = meshOf(geoSphere(), fxMaterial('explsphere', { uA: pal[0], uB: pal[1], uEmis: 1.05 }, { side: THREE.FrontSide }));
      add(sph, (t) => { const k = r * (0.14 + ease(Math.min(1, t * 1.4)) * 0.4); sph.scale.setScalar(k); sph.position.y = k * 0.6; sph.material.uniforms.uDecay.value = sstep(0.0, 0.75, t) * 1.1; });
    }
    const n = dusty ? 7 : full ? 5 : 0;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random();
      const sm = quadMesh(fxMaterial('smoke', { uA: new THREE.Color(dusty ? '#cdb48c' : '#6a5a4c'), uC: new THREE.Color(dusty ? '#8a7250' : '#2a201a'), uSeed: Math.random() * 9 }), r * 1.2);
      sm.renderOrder = 26;
      const dir = [Math.cos(a), Math.sin(a)];
      add(sm, (t) => {
        const k = ease(t);
        sm.position.set(dir[0] * r * 0.65 * k, 0.4 + k * 1.1, dir[1] * r * 0.65 * k);
        sm.scale.setScalar(r * (0.7 + k * 0.8));
        sm.material.uniforms.uLife.value = 1 - sstep(0.15, 1, t);
      });
    }
    e.dur = Math.max(e.dur || 600, 1100);
  } else if (DARK_AREA.has(style)) {
    const floor = meshOf(geoFlat(), fxMaterial('darkfloor', {}, { offset: -2 }), 26);
    floor.scale.setScalar(r * 2.3);
    add(floor, (t) => { floor.material.uniforms.uLife.value = Math.min(1, t * 6) * (1 - sstep(0.7, 1, t)); });
    const vortex = meshOf(geoFlat(), fxMaterial('vortex', { uA: pal[1], uB: pal[2], uEmis: 0.7, uWaveF: 5 }, { offset: -3 }), 29);
    vortex.scale.setScalar(r * 2.1);
    vortex.position.y = 0.02;
    add(vortex, (t) => { vortex.material.uniforms.uLife.value = Math.min(1, t * 5) * (1 - sstep(0.75, 1, t)); });
    const ring = meshOf(geoFlat(), fxMaterial('darkring', { uA: pal[0], uB: pal[1], uEmis: 1.1 }, { offset: -4 }), 31);
    add(ring, (t) => { ring.scale.setScalar(r * (0.6 + ease(t) * 1.6)); ring.material.uniforms.uDecay.value = sstep(0.2, 1, t) * 0.8; });
    if (full) {
      const lift = meshOf(geoColumn(), fxMaterial('lift', { uA: pal[0], uB: pal[1], uEmis: 1.0 }));
      lift.scale.set(r * 0.55, 2.4, r * 0.55);
      add(lift, (t) => { lift.material.uniforms.uLife.value = Math.min(1, t * 5) * (1 - sstep(0.6, 1, t)); });
    }
    e.dur = Math.max(e.dur || 600, 1000);
  } else {
    // magias de chão (gelo, luz, veneno, giro, grito...): disco colorido, onda e, nas de luz/gelo/veneno, coluna
    const ground = meshOf(geoFlat(), fxMaterial('ground', { uA: pal[1], uB: pal[2], uEmis: 1.0, uCurve: 1.2 }, { offset: -2, blend: 'mix' }), 28);
    ground.scale.setScalar(r * 2.1);
    add(ground, (t) => { ground.material.uniforms.uLife.value = 0.75 * Math.min(1, t * 6) * (1 - sstep(0.55, 1, t)); ground.material.uniforms.uGrow.value = 0.8 + t * 0.3; });
    const ring = meshOf(geoFlat(), fxMaterial('darkring', { uA: pal[0], uB: pal[1], uEmis: 1.2 }, { offset: -4 }), 31);
    add(ring, (t) => { ring.scale.setScalar(r * (0.5 + ease(t) * 1.7)); ring.material.uniforms.uDecay.value = sstep(0.25, 1, t) * 0.85; });
    if (PILLAR.has(style) && full) {
      const lift = meshOf(geoColumn(), fxMaterial('lift', { uA: pal[0], uB: pal[1], uEmis: 1.0 }));
      lift.scale.set(r * 0.7, 2.0, r * 0.7);
      add(lift, (t) => { lift.material.uniforms.uLife.value = Math.min(1, t * 6) * (1 - sstep(0.6, 1, t)); });
    }
  }
  return { obj: g, update(t, now) { for (const u of parts) u(t, now); } };
}

// área que dura (poças, chuva de flechas): disco giratório e chamas nas bordas
function areaEffect(e) {
  const style = e.style || 'fire';
  if (style === 'arrows') return null;
  const pal = palette(style, 'fire');
  const r = e.r || 2;
  const g = new THREE.Group();
  g.position.set(e.x, 0.04, e.y);
  const ground = meshOf(geoFlat(), fxMaterial('ground', { uA: pal[1], uB: pal[2], uEmis: 0.9, uCurve: 1.2 }, { offset: -2, blend: 'mix' }), 28);
  ground.scale.setScalar(r * 2.1);
  g.add(ground);
  let col = null;
  if (Q.vfx >= 2) {
    col = meshOf(geoColumn(), fxMaterial('column', { uA: pal[0], uB: pal[1], uC: pal[2], uEmis: 1.0 }));
    col.scale.set(r * 0.9, 1.1, r * 0.9);
    g.add(col);
  }
  return {
    obj: g,
    update(t) {
      const fade = Math.min(1, (1 - t) * 4, t * 8);
      ground.material.uniforms.uLife.value = 0.7 * fade;
      if (col) col.material.uniforms.uLife.value = 0.55 * fade;
    },
  };
}

function shieldEffect(e, fx) {
  const pal = palette(e.style, 'harden');
  const g = new THREE.Group();
  const shell = meshOf(geoSphere(), fxMaterial('shell', { uA: pal[0], uB: pal[1], uEmis: 1.1 }, { side: THREE.FrontSide }));
  shell.scale.setScalar(0.85);
  g.add(shell);
  let surf = null;
  if (Q.vfx >= 2) {
    surf = meshOf(geoSphere(), fxMaterial('shield', { uA: pal[0], uB: pal[1], uC: pal[2], uEmis: 1.0 }, { side: THREE.FrontSide }), 31);
    surf.scale.setScalar(0.9);
    g.add(surf);
  }
  return {
    obj: g,
    update(t) {
      const p = fx.entPos(e.id, 0.45);
      if (p) g.position.copy(p);
      const pop = 0.55 + ease(Math.min(1, t * 4)) * 0.45;
      g.scale.setScalar(pop);
      const decay = sstep(0.55, 1, t);
      shell.material.uniforms.uDecay.value = decay;
      if (surf) surf.material.uniforms.uDecay.value = decay * 0.9;
    },
  };
}

function castEffect(e, fx) {
  const style = e.style;
  const pal = palette(style, 'shout');
  const healing = style === 'heal' || style === 'elixir' || style === 'grace';
  const g = new THREE.Group();
  const col = meshOf(geoColumn(), fxMaterial('cast', { uA: pal[0], uB: pal[1], uEmis: 2.0 }));
  col.scale.set(0.7, 1.6, 0.7);
  g.add(col);
  const pluses = [];
  if (healing) {
    const n = Q.vfx >= 2 ? 9 : 5;
    for (let i = 0; i < n; i++) {
      const p = quadMesh(fxMaterial('plus', { uA: pal[1], uB: pal[2], uEmis: 1.5, uRand: Math.random() }), 0.19 + Math.random() * 0.1);
      p.userData = { a: Math.random() * Math.PI * 2, rad: 0.25 + Math.random() * 0.3, d: Math.random() * 0.35, sp: 0.7 + Math.random() * 0.6 };
      pluses.push(p); g.add(p);
    }
  }
  return {
    obj: g,
    update(t) {
      const p = fx.entPos(e.id, 0);
      if (p) g.position.set(p.x, 0.02, p.z);
      col.material.uniforms.uGrow.value = Math.min(1, t * 1.15);
      col.material.uniforms.uLife.value = 1 - sstep(0.7, 1, t);
      for (const q of pluses) {
        const k = Math.max(0, t - q.userData.d) / (1 - q.userData.d);
        const a = q.userData.a + k * 2;
        q.position.set(Math.cos(a) * q.userData.rad, 0.15 + k * 1.5 * q.userData.sp, Math.sin(a) * q.userData.rad);
        q.material.uniforms.uLife.value = k <= 0 ? 0 : 1 - k * k;
      }
    },
  };
}

// meteoro caindo: cabeça de fogo com cauda (o movimento vem do Effects3D)
function meteorBody() {
  const pal = palette('meteor');
  const g = new THREE.Group();
  const comet = meshOf(geoComet(), fxMaterial('proj', { uA: pal[0].clone().lerp(pal[1], 0.5), uB: pal[1], uC: pal[2], uEmis: 0.7 }));
  comet.scale.set(1.9, 1.9, 2.6);
  const head = quadMesh(fxMaterial('flare', { uA: pal[0].clone().lerp(pal[1], 0.4), uB: pal[1], uEmis: 0.6, uStreaks: 5 }), 1.9);
  g.add(comet, head);
  // a cauda aponta para o céu: oposta ao sentido da queda
  const dir = new THREE.Vector3(-3, -9, 2).normalize();
  g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
  return { obj: g, positioned: true, update() {} };
}

// partículas pequenas soltas (estados do jogador, cura)
function puffParticle(shape, pal, size, life, pos, vel, rand = Math.random()) {
  const mat = fxMaterial(shape, { uA: pal[0], uB: pal[1], uRand: rand });
  const m = quadMesh(mat, size);
  m.position.copy(pos);
  return { m, mat, vel, born: performance.now(), life, size };
}

// ------------------------------------------------------------------ gerente
const SUPPORTED = new Set(['proj', 'swing', 'aoe', 'area', 'buff', 'falling']);
const SHIELDY = new Set(['harden', 'arcane_shield']);

export class VFX {
  constructor(fx) {
    this.fx = fx;
    this.parts = []; // partículas soltas
    this.nextStatus = {};
  }

  // chamado todo quadro (mesmo sem efeitos): relógio dos shaders + partículas soltas + auras de estado
  tick(now, dt) {
    vfxTime.value = (now / 1000) % 1800;
    if (Q.vfx <= 0) { if (this.parts.length) this.clearParts(); return; }
    this.updateParts(now, dt);
    if (Q.vfx >= 2) this.statusAuras(now);
  }

  // cria o visual de um evento; devolve false para deixar o efeito simples de antes
  build(e) {
    if (Q.vfx <= 0 || !SUPPORTED.has(e.kind)) return false;
    let v = null;
    try {
      switch (e.kind) {
        case 'proj': {
          const st = e.style || '';
          if (st.startsWith('arrow') || st === 'poison' || st === 'web' || st === 'roots') return false;
          v = cometProjectile(st);
          break;
        }
        case 'swing': v = swingEffect(e, this.fx); break;
        case 'aoe': v = aoeEffect(e); break;
        case 'area': v = areaEffect(e); break;
        case 'buff':
          if (e.id === undefined) return false;
          v = SHIELDY.has(e.style) ? shieldEffect(e, this.fx) : castEffect(e, this.fx);
          break;
        case 'falling': v = meteorBody(); break;
        default: return false;
      }
    } catch (err) { console.warn('[vfx]', err); return false; }
    if (!v) return false;
    e.obj = v.obj;
    e.v = v;
    return true;
  }

  // faísca de impacto sobre uma entidade
  hit(p, opts = {}) {
    if (Q.vfx <= 0) return false;
    const pal = opts.color ? paletteFromColor(opts.color) : palette('hit');
    const v = hitEffect(pal, !!opts.crit);
    v.obj.position.set(p.x, p.h ?? 0.8, p.y);
    this.fx.add({ kind: 'vhit', obj: v.obj, v, dur: opts.crit ? 620 : 380, noBuild: true });
    return true;
  }

  // sinais de mais (cura recebida)
  heal(p) {
    if (Q.vfx <= 0) return false;
    const pal = [col(PAL.heal[1]), col(PAL.heal[2])];
    const n = Q.vfx >= 2 ? 7 : 4;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, rad = 0.15 + Math.random() * 0.35;
      this.spawnPart('plus', pal, 0.15 + Math.random() * 0.09, 900 + Math.random() * 500,
        new THREE.Vector3(p.x + Math.cos(a) * rad, (p.h ?? 0.3) + Math.random() * 0.2, p.y + Math.sin(a) * rad), new THREE.Vector3(0, 0.9 + Math.random() * 0.7, 0));
    }
    return true;
  }

  spawnPart(shape, pal, size, life, pos, vel, rand) {
    if (this.parts.length > 60) return;
    const p = puffParticle(shape, pal, size, life, pos, vel, rand);
    this.parts.push(p);
    this.fx.group.add(p.m);
  }

  updateParts(now, dt = 1 / 60) {
    const keep = [];
    for (const p of this.parts) {
      const t = (now - p.born) / p.life;
      if (t >= 1) { this.fx.group.remove(p.m); p.mat.dispose(); continue; }
      p.m.position.addScaledVector(p.vel, dt);
      p.mat.uniforms.uLife.value = 1 - t * t;
      keep.push(p);
    }
    this.parts = keep;
  }

  clearParts() {
    for (const p of this.parts) { this.fx.group.remove(p.m); p.mat.dispose(); }
    this.parts = [];
  }

  // auras do próprio jogador: veneno (bolhas), lentidão (cristais), fogo (labaredas), atordoado (Zzz), escudo/bônus (brilho)
  statusAuras(now) {
    const g = this.fx.game, me = g.me;
    if (!me || !me.statuses || !me.statuses.length) return;
    const ent = g.entities.get(me.id);
    if (!ent) return;
    const h = g.renderer.entityHeight(ent);
    const base = new THREE.Vector3(ent.rx, 0, ent.ry);
    for (const s of me.statuses) {
      const last = this.nextStatus[s.t] || 0;
      if (now < last) continue;
      const r = () => (Math.random() - 0.5) * 0.5;
      switch (s.t) {
        case 'poison':
          this.nextStatus[s.t] = now + 170;
          this.spawnPart('bubble', palette('poison'), 0.4 + Math.random() * 0.2, 1200, base.clone().add(new THREE.Vector3(r(), h * 0.2 + Math.random() * 0.3, r())), new THREE.Vector3(0, 0.55, 0));
          break;
        case 'slow':
          this.nextStatus[s.t] = now + 220;
          this.spawnPart('crystal', palette('frost'), 0.42 + Math.random() * 0.16, 1200, base.clone().add(new THREE.Vector3(r(), h * 0.3 + Math.random() * 0.5, r())), new THREE.Vector3(0, 0.2, 0));
          break;
        case 'burn':
          this.nextStatus[s.t] = now + 110;
          this.spawnPart('puff', palette('fire'), 0.8 + Math.random() * 0.3, 800, base.clone().add(new THREE.Vector3(r() * 0.8, h * 0.1 + Math.random() * 0.4, r() * 0.8)), new THREE.Vector3(0, 1.1, 0));
          break;
        case 'stun':
          this.nextStatus[s.t] = now + 520;
          this.spawnPart('sleep', [col('#fff6a8'), col('#ffd54f')], 0.42, 1400, base.clone().add(new THREE.Vector3(r() * 0.4, h * 1.02, r() * 0.4)), new THREE.Vector3(0.12, 0.35, 0));
          break;
        case 'root':
          this.nextStatus[s.t] = now + 380;
          this.spawnPart('puff', palette('roots'), 0.7, 1000, base.clone().add(new THREE.Vector3(r(), 0.1, r())), new THREE.Vector3(0, 0.25, 0));
          break;
        default: break;
      }
    }
  }

  // projéteis e quedas que o Effects3D move: o VFX só anima o visual
  isPositioned(e) { return !!(e.v && e.v.positioned); }
}
