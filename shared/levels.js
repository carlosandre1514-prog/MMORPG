// Escala de níveis. O jogo vai do nível 1 ao MAX_LEVEL (100), mas o equilíbrio de combate (vida, dano, defesa,
// atributos, itens e XP) foi afinado numa escala menor, de 1 a BASE_CAP. O "nível efetivo" converte um nível
// de hoje para essa escala, assim os números de combate seguem a mesma curva e só o rótulo do nível muda.
import { MAX_LEVEL } from './constants.js';

export const BASE_CAP = 30;
export const LEVEL_RATIO = (MAX_LEVEL - 1) / (BASE_CAP - 1);   // níveis de hoje que cabem em um nível da escala interna

// nível mostrado -> nível efetivo (fracionário), de 1 a BASE_CAP
export const evLevel = (lvl) => 1 + (lvl - 1) / LEVEL_RATIO;

// nível efetivo (ou nível da escala antiga) -> nível mostrado
export const lvlFromEv = (ev) => Math.round(1 + (ev - 1) * LEVEL_RATIO);

// quantos níveis de hoje equivalem a n níveis da escala interna (janelas de nível: "até 8 níveis acima" etc.)
export const lvSpan = (n) => Math.round(n * LEVEL_RATIO);
