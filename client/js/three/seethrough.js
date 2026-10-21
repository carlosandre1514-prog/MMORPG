// "Janela" em volta do jogador: árvores, prédios e paredes que ficam entre a câmera e o personagem
// somem num pontilhado suave dentro de um círculo na tela, para o jogador nunca ficar escondido.
import * as THREE from 'three';

export const seeThrough = {
  uniforms: {
    uSeePos: { value: new THREE.Vector2(-1e4, -1e4) }, // centro do círculo, em pixels do framebuffer
    uSeeDepth: { value: 0 }, // profundidade (0..1) do jogador: só some o que está na frente dele
    uSeeRadius: { value: 0 },
  },
};

const HEADER = `uniform vec2 uSeePos;
uniform float uSeeDepth;
uniform float uSeeRadius;
void main() {
  if (uSeeRadius > 0.0 && gl_FragCoord.z < uSeeDepth) {
    float d = distance(gl_FragCoord.xy, uSeePos) / uSeeRadius;
    float keep = smoothstep(0.45, 1.0, d);
    float noise = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
    if (keep < 0.999 && noise > keep * 0.92 + 0.08) discard;
  }
`;

export function applySeeThrough(mat) {
  if (!mat || mat.userData.seeThrough) return mat;
  mat.userData.seeThrough = true;
  const prev = mat.onBeforeCompile;
  const prevKey = mat.customProgramCacheKey.bind(mat);
  mat.onBeforeCompile = (shader, renderer) => {
    if (prev) prev.call(mat, shader, renderer);
    Object.assign(shader.uniforms, seeThrough.uniforms);
    shader.fragmentShader = shader.fragmentShader.replace('void main() {', HEADER);
  };
  mat.customProgramCacheKey = () => prevKey() + '|see';
  mat.needsUpdate = true;
  return mat;
}

const _p = new THREE.Vector3(), _q = new THREE.Vector3(), _d = new THREE.Vector3();

// Atualiza o círculo a partir da posição do jogador (x, z no mundo) e da câmera.
export function updateSeeThrough(camera, x, z, W, H, dpr) {
  const u = seeThrough.uniforms;
  _p.set(x, 0.8, z);
  // ponto um pouco à frente do jogador, na direção da câmera: o que está colado nele não some
  _d.copy(camera.position).sub(_p).normalize();
  _q.copy(_p).addScaledVector(_d, 1.1).project(camera);
  u.uSeeDepth.value = _q.z * 0.5 + 0.5;
  const c = _p.clone().project(camera);
  const top = _p.clone().setY(1.8).project(camera);
  u.uSeePos.value.set((c.x + 1) / 2 * W * dpr, (c.y + 1) / 2 * H * dpr);
  u.uSeeRadius.value = Math.abs(top.y - c.y) / 2 * H * dpr * 3.4;
}
