// Migração única dos saves da escala antiga de níveis (1 a 30) para a atual (1 a MAX_LEVEL).
// O personagem fica no mesmo ponto do caminho: o nível e o XP dentro dele são convertidos juntos;
// pontos de atributo (já gastos ou guardados), itens, missões e maestria não mudam.
import { MAX_LEVEL } from '../shared/constants.js';
import { BASE_CAP, LEVEL_RATIO } from '../shared/levels.js';
import { xpToNext } from '../shared/formulas.js';

export const LEVEL_SCALE = 2; // 1 = níveis de 1 a 30, 2 = níveis de 1 a 100

const oldXpToNext = (l) => Math.round(40 * l * l + 60 * l);

export function migrateLevelScale(ch) {
  const old = Math.max(1, Math.min(BASE_CAP, ch.level || 1));
  if (old >= BASE_CAP) {
    ch.level = MAX_LEVEL;
    ch.xp = 0;
    return;
  }
  const pos = old + Math.max(0, Math.min(0.999, (ch.xp || 0) / oldXpToNext(old))); // posição fracionária na escala antiga
  const real = 1 + (pos - 1) * LEVEL_RATIO;
  const level = Math.min(MAX_LEVEL - 1, Math.floor(real + 1e-9));
  ch.level = level;
  ch.xp = Math.round((real - level) * xpToNext(level));
}

// Converte todos os personagens de um banco que ainda está na escala antiga. Devolve quantos foram convertidos.
export function migrateDatabaseLevels(data) {
  if (data.levelScale === LEVEL_SCALE) return 0;
  let n = 0;
  for (const ch of Object.values(data.chars || {})) { migrateLevelScale(ch); n++; }
  data.levelScale = LEVEL_SCALE;
  return n;
}
