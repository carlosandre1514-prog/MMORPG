// Retrato 3D de uma classe, para as telas de criação e de escolha de personagem. Os retratos prontos (charsprites) só existem
// para o corpo padrão; o corpo de adulto é desenhado aqui, ao vivo, num renderizador pequeno e compartilhado.
import * as THREE from 'three';
import { characters } from './characters.js';

let rt = null;

function setup() {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x556070, 1.5));
  const sun = new THREE.DirectionalLight(0xfff0d8, 2.2);
  sun.position.set(2.5, 4, 3.5);
  scene.add(sun);
  const camera = new THREE.PerspectiveCamera(24, 1, 0.1, 30);
  camera.position.set(0, 0.95, 5.2);
  camera.lookAt(0, 0.78, 0);
  return { renderer, scene, camera };
}

// Devolve um canvas size x size com o personagem parado, virado para dir (0 a 3, uma volta em passos de 90 graus), ou null
// se os modelos 3D ainda não carregaram. face: só o rosto e os ombros (retrato do painel do personagem).
export function portrait3d(cls, adult, size = 200, dir = 0, face = false) {
  if (!characters.ready || !characters.has(cls)) return null;
  try {
    rt ||= setup();
    const { renderer, scene, camera } = rt;
    renderer.setSize(size, size, false);
    if (face) { camera.position.set(0, 1.22, 1.75); camera.lookAt(0, 1.17, 0); } else { camera.position.set(0, 0.95, 5.2); camera.lookAt(0, 0.78, 0); }
    const actor = characters.create(cls, { adult });
    actor.root.rotation.y = -dir * Math.PI / 2;
    actor.update(0.3, { now: performance.now(), moving: false, speed: 0 });
    scene.add(actor.root);
    renderer.render(scene, camera);
    scene.remove(actor.root);
    for (const m of actor.mats) m.dispose();
    const cv = document.createElement('canvas');
    cv.width = renderer.domElement.width; cv.height = renderer.domElement.height;
    cv.getContext('2d').drawImage(renderer.domElement, 0, 0);
    return cv;
  } catch (e) {
    console.warn('[retrato] sem retrato 3D', e);
    return null;
  }
}
