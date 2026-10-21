// Visibilidade do jogador no meio da cena 3D:
//  1. "janela": tudo que fica entre a câmera e o personagem some num pontilhado dentro de um círculo na tela;
//  2. corte de andares: do lado da câmera, perto do jogador, andares de cima e telhados somem (como num
//     diorama), então ruas estreitas e becos continuam legíveis;
//  3. o que encosta na câmera também some, em vez de tapar a tela.
import * as THREE from 'three';

export const seeThrough = {
  uniforms: {
    uSeePos: { value: new THREE.Vector2(-1e4, -1e4) }, // centro do círculo, em pixels do framebuffer
    uSeeDepth: { value: 0 }, // profundidade (0..1) do jogador: só some o que está na frente dele
    uSeeRadius: { value: 0 },
    uCamWorld: { value: new THREE.Matrix4() },
    uPlayer: { value: new THREE.Vector3(-1e4, 0, -1e4) },
    uCamDir: { value: new THREE.Vector2(0, 1) }, // direção horizontal jogador -> câmera
    uCutR: { value: 8.5 }, // raio do corte de andares (m)
    uCutH: { value: 2.9 }, // altura a partir da qual corta (acima do térreo)
    uNearFade: { value: 5.5 }, // distância da câmera em que começa a sumir
  },
};

const HEADER = `uniform vec2 uSeePos;
uniform float uSeeDepth;
uniform float uSeeRadius;
uniform mat4 uCamWorld;
uniform vec3 uPlayer;
uniform vec2 uCamDir;
uniform float uCutR;
uniform float uCutH;
uniform float uNearFade;
void main() {
  {
    float noise = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
    float keep = 1.0;
    if (uSeeRadius > 0.0 && gl_FragCoord.z < uSeeDepth) {
      keep = min(keep, smoothstep(0.45, 1.0, distance(gl_FragCoord.xy, uSeePos) / uSeeRadius));
    }
    vec3 wp = (uCamWorld * vec4(-vViewPosition, 1.0)).xyz;
    vec2 rel = wp.xz - uPlayer.xz;
    if (wp.y > uCutH && dot(rel, uCamDir) > -1.5) {
      keep = min(keep, smoothstep(uCutR - 2.5, uCutR, length(rel)));
    }
    keep = min(keep, smoothstep(uNearFade * 0.55, uNearFade, length(vViewPosition)));
    if (keep < 0.999 && noise >= keep) discard;
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
  mat.customProgramCacheKey = () => prevKey() + '|see2';
  mat.needsUpdate = true;
  return mat;
}

const _p = new THREE.Vector3(), _q = new THREE.Vector3(), _d = new THREE.Vector3();

// Atualiza a janela e o corte a partir da posição do jogador (x, z no mundo) e da câmera.
export function updateSeeThrough(camera, x, z, W, H, dpr, dist = 15) {
  const u = seeThrough.uniforms;
  camera.updateMatrixWorld();
  _p.set(x, 0.8, z);
  // ponto um pouco à frente do jogador, na direção da câmera: o que está colado nele não some
  _d.copy(camera.position).sub(_p).normalize();
  _q.copy(_p).addScaledVector(_d, 1.1).project(camera);
  u.uSeeDepth.value = _q.z * 0.5 + 0.5;
  const c = _p.clone().project(camera);
  const top = _p.clone().setY(1.8).project(camera);
  u.uSeePos.value.set((c.x + 1) / 2 * W * dpr, (c.y + 1) / 2 * H * dpr);
  u.uSeeRadius.value = Math.abs(top.y - c.y) / 2 * H * dpr * 3.4;
  u.uCamWorld.value.copy(camera.matrixWorld);
  u.uPlayer.value.set(x, 0, z);
  u.uCamDir.value.set(camera.position.x - x, camera.position.z - z).normalize();
  u.uNearFade.value = Math.max(4, dist * 0.6);
}
