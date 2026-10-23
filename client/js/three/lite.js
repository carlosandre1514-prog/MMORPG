// Modo leve (celulares fracos): materiais PBR (MeshStandardMaterial) viram MeshLambertMaterial, que só calcula luz difusa.
// Cada luz de ponto custa bem menos por pixel e não há reflexo especular nem mapa de normais.
import * as THREE from 'three';
import { quality } from '../device.js';

const cache = new Map();

// Devolve uma versão leve do material (a mesma instância para o mesmo material); fora do modo leve devolve o original.
export function lite(m) {
  if (!m || !m.isMeshStandardMaterial || !quality().low) return m;
  let l = cache.get(m);
  if (l) return l;
  l = new THREE.MeshLambertMaterial({
    name: m.name, color: m.color, map: m.map, vertexColors: m.vertexColors, flatShading: m.flatShading,
    transparent: m.transparent, opacity: m.opacity, alphaTest: m.alphaTest, side: m.side, depthWrite: m.depthWrite,
    emissive: m.emissive, emissiveIntensity: m.emissiveIntensity, emissiveMap: m.emissiveMap,
    polygonOffset: m.polygonOffset, polygonOffsetFactor: m.polygonOffsetFactor, polygonOffsetUnits: m.polygonOffsetUnits,
  });
  l.userData = { ...m.userData };
  cache.set(m, l);
  return l;
}
