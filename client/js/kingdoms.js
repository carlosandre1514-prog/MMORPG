// Recursos de arte por reino. O cliente só baixa e monta o que o reino onde o jogador está precisa:
// Alvorada usa as peças modulares do Medieval Village (prédios com interior); Sahaar usa as torres em voxel e armas próprias (cimitarras, espada e escudo dourados).
// Ao atravessar a fronteira, o jogo mostra uma tela de travessia enquanto o pacote do novo reino chega.
// Os pacotes de reinos já visitados ficam em memória (voltar é instantâneo); a cena da zona é sempre descartada ao sair dela.
import { KINGDOMS } from '/shared/data/kingdoms.js';
import { village } from './three/village.js';
import { voxel } from './three/voxel.js';
import { arms } from './three/arms.js';

const PACKS = { village, voxel, arms };
const loads = new Map(); // nome do pacote -> promessa de carga (uma só por pacote)

export function kingdomReady(id) {
  return (KINGDOMS[id]?.assets || []).every((name) => PACKS[name].ready || loads.get(name)?.done);
}

// Carrega os pacotes do reino; onProgress recebe 0..1. Nunca rejeita: pacote que falha cai nos modelos simples do cenário.
export function loadKingdom(id, onProgress = () => {}) {
  const names = KINGDOMS[id]?.assets || [];
  const prog = Object.fromEntries(names.map((n) => [n, PACKS[n].ready ? 1 : 0]));
  const report = () => onProgress(names.length ? Object.values(prog).reduce((a, b) => a + b, 0) / names.length : 1);
  return Promise.all(names.map((name) => {
    if (!loads.has(name)) {
      const entry = { done: false };
      entry.promise = Promise.resolve(PACKS[name].load((p) => { prog[name] = p; report(); })).catch(() => {}).then(() => { entry.done = true; });
      loads.set(name, entry);
    }
    return loads.get(name).promise.then(() => { prog[name] = 1; report(); });
  })).then(() => {});
}
