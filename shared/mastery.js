// Maestria: depois do nível máximo o XP vira níveis de maestria, sem teto. Cada nível dá 1 ponto para gastar nos atributos abaixo.
// Arquivo sem dependências para as fórmulas de atributos (shared/formulas.js) poderem usá-lo sem ciclos de importação.
export const MASTERY_STATS = {
  power: { name: 'Poder', desc: '+0,4% de Poder por grau', per: 0.004, max: 50, fmt: 'pct' },
  hp: { name: 'Vitalidade', desc: '+0,5% de vida máxima por grau', per: 0.005, max: 50, fmt: 'pct' },
  def: { name: 'Resistência', desc: '+0,5% de Defesa por grau', per: 0.005, max: 40, fmt: 'pct' },
  crit: { name: 'Precisão', desc: '+0,12 de chance de crítico por grau', per: 0.12, max: 50, fmt: 'num' },
  haste: { name: 'Fúria', desc: '+0,2 de velocidade de ataque por grau', per: 0.2, max: 40, fmt: 'num' },
  lifesteal: { name: 'Sede de Sangue', desc: '+0,04% de roubo de vida por grau', per: 0.04, max: 30, fmt: 'num' },
  speed: { name: 'Pés Ligeiros', desc: '+0,2% de velocidade de movimento por grau', per: 0.002, max: 20, fmt: 'pct' },
  gold: { name: 'Faro para Ouro', desc: '+0,8% de ouro encontrado por grau', per: 0.008, max: 50, fmt: 'pct' },
  xp: { name: 'Estudo', desc: '+0,6% de experiência de maestria por grau', per: 0.006, max: 50, fmt: 'pct' },
};
export const MASTERY_KEYS = Object.keys(MASTERY_STATS);
export const MASTERY_TOTAL_POINTS = MASTERY_KEYS.reduce((a, k) => a + MASTERY_STATS[k].max, 0);

// XP para ir do nível de maestria n para n+1 (cresce devagar: o primeiro leva umas poucas horas, os últimos meses)
export const masteryNext = (n) => 150000 + 4500 * n;

export function masterySpent(ranks) {
  let s = 0;
  for (const k of MASTERY_KEYS) s += (ranks && ranks[k]) || 0;
  return s;
}
// bônus somados dos graus gastos
export function masteryBonus(ranks) {
  const out = {};
  for (const k of MASTERY_KEYS) out[k] = ((ranks && ranks[k]) || 0) * MASTERY_STATS[k].per;
  return out;
}
export const respecCost = (spent) => 2000 + 150 * spent;

