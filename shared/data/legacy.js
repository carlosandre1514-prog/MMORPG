// Legado: o que mantém o personagem crescendo depois da campanha e do nível máximo (feitos, maestria, bestiário e desafios).
// Tudo aqui é dado e fórmula pura, usado pelo servidor (que guarda e confere) e pelo cliente (que mostra).
//   estatísticas   ch.stats        contadores que só crescem (ouro ganho, missões, saques raros...)
//   feitos         ch.ach          { id: data } — conquistas em degraus (10, 100, 1 000... até dezenas de milhares)
//   títulos        ch.titles       nomes desbloqueados por feitos; ch.title é o que está em uso
//   maestria       ch.mastery      { xp, level, ranks } — depois do nível 100 o XP vira níveis de maestria, sem teto
//   bestiário      ch.bestiary     { monstro: abates } — cada espécie dá dano extra contra ela
//   desafios       ch.chal         { d, w } — três do dia e dois da semana, sorteados e guardados no personagem
import { MONSTERS } from './monsters.js';
import { QUESTS } from './quests.js';
import { ZONE_ORDER } from './zones.js';
import { MAX_LEVEL } from '../constants.js';
import { evLevel, lvSpan } from '../levels.js';

// ---------------------------------------------------------------- contadores
// Os quatro primeiros já existiam em ch.record; os demais ficam em ch.stats. Chaves com ":" são consultas:
// bst:<monstro> abates da espécie, qd:<missão> vezes que a missão foi entregue.
const RECORD = { kills: 'kills', bossKills: 'bossKills', pvpKills: 'pvpKills', deaths: 'deaths' };

export const COUNTER_NAMES = {
  kills: 'Monstros derrotados', bossKills: 'Chefes derrotados', pvpKills: 'Duelos vencidos na Arena', deaths: 'Quedas',
  gold: 'Ouro ganho', quests: 'Missões entregues', rare: 'Saques raros ou melhores', legend: 'Saques lendários', crafted: 'Itens criados',
  enhanced: 'Aprimoramentos bem-sucedidos', potions: 'Poções usadas', casts: 'Habilidades usadas', damage: 'Dano causado', group: 'Monstros derrotados em grupo',
  trades: 'Trocas feitas', zones: 'Regiões descobertas', altars: 'Altares descobertos', hours: 'Horas de jogo', mastery: 'Nível de maestria', level: 'Nível', species: 'Espécies estudadas',
};

export function counterValue(ch, key) {
  if (!ch) return 0;
  if (RECORD[key]) return (ch.record && ch.record[RECORD[key]]) || 0;
  switch (key) {
    case 'zones': return (ch.visited || []).length;
    case 'altars': return (ch.altars || []).length;
    case 'hours': return Math.floor((ch.playTime || 0) / 3600);
    case 'mastery': return (ch.mastery && ch.mastery.level) || 0;
    case 'level': return ch.level || 1;
    case 'species': return Object.values(ch.bestiary || {}).filter((n) => n >= SPECIES_STUDIED).length;
    default: break;
  }
  if (key.startsWith('bst:')) return (ch.bestiary && ch.bestiary[key.slice(4)]) || 0;
  if (key.startsWith('qd:')) return (ch.quests && ch.quests.done && ch.quests.done[key.slice(3)]) || 0;
  return (ch.stats && ch.stats[key]) || 0;
}

// ---------------------------------------------------------------- bestiário
export const SPECIES_STUDIED = 100; // abates para a espécie contar como "estudada"
export const BESTIARY_STEPS = [10, 50, 250, 1000, 5000]; // abates que dão cada degrau de conhecimento
export const BESTIARY_BONUS = [0.02, 0.02, 0.03, 0.03, 0.05]; // dano extra de cada degrau contra a espécie (soma até +15%)

export function bestiaryRank(kills) {
  let n = 0;
  for (const s of BESTIARY_STEPS) if (kills >= s) n++;
  return n;
}
export function bestiaryBonus(kills) {
  let b = 0;
  for (let i = 0; i < bestiaryRank(kills); i++) b += BESTIARY_BONUS[i];
  return b;
}
// espécies do bestiário: todo monstro do jogo (as criaturas só invocadas por chefes não contam)
export const BESTIARY_LIST = Object.values(MONSTERS).filter((m) => !m.summon).map((m) => m.id);

// ---------------------------------------------------------------- maestria (definições em shared/mastery.js, sem dependências, para as fórmulas)
export { MASTERY_STATS, MASTERY_KEYS, MASTERY_TOTAL_POINTS, masteryNext, masterySpent, masteryBonus, respecCost } from '../mastery.js';

// ---------------------------------------------------------------- feitos
export const ACH_CATS = {
  combat: 'Combate', hunt: 'Caçadas', quest: 'Missões', explore: 'Exploração', craft: 'Ofícios e riquezas', social: 'Sociedade', mastery: 'Maestria e tempo',
};

const PTS = [5, 10, 20, 35, 60, 100, 150];
const GOLD = [50, 150, 500, 1500, 5000, 15000, 40000];
const MXP = [0, 0, 5000, 20000, 60000, 150000, 300000];
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

export const ACHIEVEMENTS = [];
const add = (a) => ACHIEVEMENTS.push({ pts: 10, gold: 0, mxp: 0, ...a });

// uma família de feitos em degraus: a mesma meta crescendo
function family(cat, key, counter, goals, names, desc, titles = {}) {
  goals.forEach((goal, i) => add({ id: `${key}${i + 1}`, cat, counter, goal, name: names[i] || `${names[0]} ${ROMAN[i]}`, desc: desc(goal), pts: PTS[i], gold: GOLD[i], mxp: MXP[i], title: titles[i] || null }));
}

family('hunt', 'kills', 'kills', [10, 100, 500, 2500, 10000, 50000],
  ['Primeiro Sangue', 'Caçador', 'Caçador Veterano', 'Terror da Névoa', 'Flagelo do Vazio', 'Lenda Viva'], (n) => `Derrote ${n.toLocaleString('pt-BR')} monstros.`, { 3: 'Terror da Névoa', 4: 'Flagelo do Vazio', 5: 'Lenda Viva' });
family('hunt', 'boss', 'bossKills', [1, 5, 25, 100, 500],
  ['Matador de Gigantes', 'Caçador de Lendas', 'Algoz de Chefes', 'Quebrador de Reis', 'Fim dos Tempos'], (n) => `Derrote ${n.toLocaleString('pt-BR')} chefe${n > 1 ? 's' : ''}.`, { 2: 'Algoz de Chefes', 3: 'Quebrador de Reis', 4: 'Fim dos Tempos' });
family('combat', 'pvp', 'pvpKills', [1, 10, 50, 250, 1000],
  ['Sangue na Areia', 'Gladiador', 'Campeão da Arena', 'Senhor da Arena', 'Imbatível'], (n) => `Vença ${n.toLocaleString('pt-BR')} duelo${n > 1 ? 's' : ''} na Arena.`, { 2: 'Campeão da Arena', 3: 'Senhor da Arena', 4: 'Imbatível' });
family('combat', 'dmg', 'damage', [10000, 250000, 5000000, 100000000],
  ['Mão Pesada', 'Força Destruidora', 'Cataclismo', 'Quebra-Mundos'], (n) => `Cause ${n.toLocaleString('pt-BR')} de dano no total.`, { 3: 'Quebra-Mundos' });
family('combat', 'cast', 'casts', [100, 1000, 10000, 100000],
  ['Aprendiz de Combate', 'Mestre das Habilidades', 'Virtuose', 'Mil Golpes'], (n) => `Use habilidades ${n.toLocaleString('pt-BR')} vezes.`, { 3: 'Mil Golpes' });
family('combat', 'group', 'group', [50, 500, 5000],
  ['Em Boa Companhia', 'Irmão de Armas', 'Lenda do Grupo'], (n) => `Derrote ${n.toLocaleString('pt-BR')} monstros em grupo.`, { 2: 'Lenda do Grupo' });
family('quest', 'quest', 'quests', [1, 10, 30, 100, 500, 2000],
  ['Primeiro Chamado', 'Mensageiro', 'Herói do Povo', 'Guardião de Aethra', 'Voz da Chama', 'Lenda dos Contratos'], (n) => `Entregue ${n.toLocaleString('pt-BR')} missões.`, { 3: 'Guardião de Aethra', 4: 'Voz da Chama', 5: 'Lenda dos Contratos' });
family('explore', 'zones', 'zones', [2, 4, 6, 9, 12, 14],
  ['Passos Largos', 'Viajante', 'Andarilho', 'Cartógrafo', 'Desbravador', 'Senhor dos Mapas'], (n) => `Descubra ${n} regiões.`, { 3: 'Cartógrafo', 5: 'Senhor dos Mapas' });
family('explore', 'altars', 'altars', [1, 4, 8, 14, 25],
  ['Primeira Passagem', 'Viajante dos Altares', 'Senhor das Passagens', 'Caminhante das Chamas', 'Rosa dos Ventos'], (n) => `Descubra ${n} altar${n > 1 ? 'es' : ''} de viagem.`, { 3: 'Caminhante das Chamas', 4: 'Rosa dos Ventos' });
family('craft', 'gold', 'gold', [1000, 10000, 100000, 1000000, 10000000],
  ['Bolso Cheio', 'Mercador', 'Barão', 'Magnata', 'Senhor do Ouro'], (n) => `Ganhe ${n.toLocaleString('pt-BR')} de ouro.`, { 3: 'Magnata', 4: 'Senhor do Ouro' });
family('craft', 'rare', 'rare', [1, 10, 50, 250, 1000],
  ['Olho para Tesouros', 'Garimpeiro', 'Colecionador', 'Mestre dos Saques', 'Rei dos Tesouros'], (n) => `Encontre ${n.toLocaleString('pt-BR')} itens raros ou melhores.`, { 4: 'Rei dos Tesouros' });
family('craft', 'legend', 'legend', [1, 3, 10, 25],
  ['Luz Lendária', 'Sorte da Chama', 'Escolhido dos Reis', 'Tesouro Vivo'], (n) => `Encontre ${n} ite${n > 1 ? 'ns' : 'm'} lendário${n > 1 ? 's' : ''}.`, { 3: 'Tesouro Vivo' });
family('craft', 'craft', 'crafted', [1, 10, 50, 250, 1000],
  ['Mãos de Artesão', 'Ferreiro', 'Mestre Artesão', 'Forja Viva', 'Lenda da Forja'], (n) => `Crie ${n.toLocaleString('pt-BR')} itens nas oficinas.`, { 3: 'Forja Viva', 4: 'Lenda da Forja' });
family('craft', 'enh', 'enhanced', [1, 10, 50, 200, 1000],
  ['Primeira Centelha', 'Aprimorador', 'Mestre do Martelo', 'Alma da Forja', 'Coração de Aço'], (n) => `Aprimore equipamentos com sucesso ${n.toLocaleString('pt-BR')} vezes.`, { 3: 'Alma da Forja', 4: 'Coração de Aço' });
family('craft', 'pot', 'potions', [10, 100, 1000, 10000],
  ['Gole de Coragem', 'Sede de Vida', 'Alquimista Itinerante', 'Rio de Poções'], (n) => `Use ${n.toLocaleString('pt-BR')} poções.`, { 3: 'Rio de Poções' });
family('social', 'trade', 'trades', [1, 10, 50, 250],
  ['Primeira Troca', 'Negociante', 'Comerciante Justo', 'Voz do Mercado'], (n) => `Conclua ${n} troca${n > 1 ? 's' : ''} com outros jogadores.`, { 3: 'Voz do Mercado' });
family('social', 'dead', 'deaths', [1, 25, 100, 500],
  ['Primeira Queda', 'Teimoso', 'Persistente', 'Imortal de Teimosia'], (n) => `Caia em combate ${n.toLocaleString('pt-BR')} ${n > 1 ? 'vezes' : 'vez'}.`, { 3: 'Imortal de Teimosia' });
family('mastery', 'hours', 'hours', [1, 10, 50, 200, 1000, 5000],
  ['Recém-chegado', 'Frequentador', 'Morador de Aethra', 'Veterano do Reino', 'Eterno', 'Guardião dos Anos'], (n) => `Jogue por ${n.toLocaleString('pt-BR')} hora${n > 1 ? 's' : ''}.`, { 3: 'Veterano do Reino', 4: 'Eterno', 5: 'Guardião dos Anos' });
family('mastery', 'mast', 'mastery', [1, 10, 25, 50, 100, 200, 300],
  ['Além do Limite', 'Maestria Crescente', 'Mestre das Brasas', 'Sábio da Chama', 'Mestre Supremo', 'Ascendente', 'Transcendido'], (n) => `Alcance o nível de maestria ${n}.`, { 3: 'Sábio da Chama', 4: 'Mestre Supremo', 5: 'Ascendente', 6: 'Transcendido' });
family('mastery', 'species', 'species', [1, 5, 15, BESTIARY_LIST.length],
  ['Estudioso', 'Naturalista', 'Grande Naturalista', 'Enciclopédia Viva'], (n) => `Estude ${n} espécie${n > 1 ? 's' : ''} (${SPECIES_STUDIED} abates de cada).`, { 3: 'Enciclopédia Viva' });

// marcos de nível
for (const [lv, name, title] of [[30, 'Chama Crescente', null], [65, 'Chama Forte', null], [MAX_LEVEL, 'Portador Completo', 'Portador Completo']]) {
  add({ id: `level${lv}`, cat: 'mastery', counter: 'level', goal: lv, name, desc: `Alcance o nível ${lv}.`, pts: lv >= MAX_LEVEL ? 60 : 15, gold: Math.round(lv * 15), mxp: 0, title });
}
// campanha e saga
const mainQuests = Object.values(QUESTS).filter((q) => q.main);
const sagaQuests = Object.values(QUESTS).filter((q) => q.saga === 'sahaar');
if (QUESTS.ms20) add({ id: 'campaign', cat: 'quest', counter: 'qd:ms20', goal: 1, name: 'A Chama Reacendida', desc: 'Reacenda a Chama Primordial (Atos I a IV da campanha principal).', pts: 100, gold: 5000, mxp: 0, title: 'Portador da Chama' });
if (mainQuests.length && mainQuests[mainQuests.length - 1].id !== 'ms20') add({ id: 'campaign2', cat: 'quest', counter: `qd:${mainQuests[mainQuests.length - 1].id}`, goal: 1, name: 'Alvorada Selada', desc: 'Conclua a campanha principal de Aethra: reúna os cinco selos e sele o Faminto sob a capital.', pts: 150, gold: 10000, mxp: 0, title: 'Selador do Faminto' });
if (sagaQuests.length) add({ id: 'saga_sahaar', cat: 'quest', counter: `qd:${sagaQuests[sagaQuests.length - 1].id}`, goal: 1, name: 'Sol Sobre as Dunas', desc: 'Conclua a saga do Reino de Sahaar.', pts: 100, gold: 5000, mxp: 0, title: 'Senhor das Dunas' });
// cada chefe tem o seu feito
for (const m of Object.values(MONSTERS)) {
  if (m.boss) add({ id: `slay_${m.id}`, cat: 'hunt', counter: `bst:${m.id}`, goal: 1, name: `Matador de ${m.name}`, desc: `Derrote ${m.name}, ${m.title}.`, pts: 25, gold: 1000, mxp: 10000, title: null });
}

export const ACH_BY_ID = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));
export const TOTAL_GLORY = ACHIEVEMENTS.reduce((a, b) => a + b.pts, 0);

export function gloryOf(ch) {
  let g = (ch && ch.stats && ch.stats.glory) || 0; // Glória extra vinda dos desafios

  for (const id of Object.keys((ch && ch.ach) || {})) g += (ACH_BY_ID[id] && ACH_BY_ID[id].pts) || 0;
  return g;
}

// patentes da Glória: quem tem mais feitos sobe de patente
export const GLORY_RANKS = [
  [0, 'Recruta'], [40, 'Aventureiro'], [150, 'Veterano'], [400, 'Herói'], [900, 'Campeão'], [1800, 'Lenda'], [3200, 'Mito'], [5000, 'Eterno'],
];
export function gloryRank(g) {
  let r = GLORY_RANKS[0], next = null;
  for (let i = 0; i < GLORY_RANKS.length; i++) if (g >= GLORY_RANKS[i][0]) { r = GLORY_RANKS[i]; next = GLORY_RANKS[i + 1] || null; }
  return { name: r[1], from: r[0], next: next ? next[0] : null };
}

// ---------------------------------------------------------------- desafios do dia e da semana
// Cada modelo: contador, metas possíveis, texto. Os de espécie (bst:) escolhem um monstro da faixa de nível do jogador.
const DAY = 86400000;
export const dayIndex = (now = Date.now()) => Math.floor(now / DAY);
// semanas começam na segunda-feira (1º de janeiro de 1970 foi quinta)
export const weekIndex = (now = Date.now()) => Math.floor((now / DAY + 3) / 7);
export const dayEnds = (idx) => (idx + 1) * DAY;
export const weekEnds = (idx) => (idx * 7 - 3 + 7) * DAY;

const DAILY_MODELS = [
  { counter: 'kills', goals: [40, 70, 110], text: (n) => `Derrote ${n} monstros.` },
  { counter: 'quests', goals: [2, 3, 4], text: (n) => `Entregue ${n} missões.` },
  { counter: 'gold', goals: [1200, 2500, 5000], text: (n) => `Ganhe ${n.toLocaleString('pt-BR')} de ouro.` },
  { counter: 'potions', goals: [4, 8], text: (n) => `Use ${n} poções.` },
  { counter: 'casts', goals: [80, 150, 250], text: (n) => `Use habilidades ${n} vezes.` },
  { counter: 'rare', goals: [1, 2], text: (n) => `Encontre ${n} item${n > 1 ? 'ns' : ''} raro${n > 1 ? 's' : ''} ou melhor${n > 1 ? 'es' : ''}.` },
  { counter: 'crafted', goals: [1, 3], text: (n) => `Crie ${n} item${n > 1 ? 'ns' : ''} em uma oficina.` },
  { counter: 'enhanced', goals: [1, 2], text: (n) => `Aprimore equipamentos com sucesso ${n} ${n > 1 ? 'vezes' : 'vez'}.` },
  { species: true, goals: [25, 40, 60], text: (n, m) => `Derrote ${n}× ${m.name}.` },
  { species: true, goals: [25, 40, 60], text: (n, m) => `Derrote ${n}× ${m.name}.` },
];
const WEEKLY_MODELS = [
  { counter: 'kills', goals: [400, 700, 1000], text: (n) => `Derrote ${n} monstros.` },
  { counter: 'bossKills', goals: [3, 5, 8], text: (n) => `Derrote ${n} chefes.` },
  { counter: 'quests', goals: [10, 15, 20], text: (n) => `Entregue ${n} missões.` },
  { counter: 'gold', goals: [15000, 30000, 60000], text: (n) => `Ganhe ${n.toLocaleString('pt-BR')} de ouro.` },
  { counter: 'crafted', goals: [8, 15], text: (n) => `Crie ${n} itens em oficinas.` },
  { counter: 'enhanced', goals: [5, 10], text: (n) => `Aprimore equipamentos com sucesso ${n} vezes.` },
  { counter: 'rare', goals: [6, 12], text: (n) => `Encontre ${n} itens raros ou melhores.` },
  { counter: 'group', goals: [150, 300], text: (n) => `Derrote ${n} monstros em grupo.` },
];

// sorteio com semente (o mesmo período e personagem sempre dão a mesma lista)
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
const pick = (r, list) => list[Math.floor(r() * list.length)];

// Gera os desafios de um período. kind: 'd' (dia) ou 'w' (semana); idx: índice do período; level: nível do jogador;
// salt: número do personagem (para cada um ter uma lista própria). Devolve [{ id, counter, target, text, rw }].
export function makeChallenges(kind, idx, level, salt = 0) {
  const r = rng(idx * 2654435761 + salt * 40503 + (kind === 'd' ? 1 : 7));
  const models = kind === 'd' ? DAILY_MODELS : WEEKLY_MODELS;
  const count = kind === 'd' ? 3 : 2;
  const bag = [...models];
  const out = [];
  while (out.length < count && bag.length) {
    const mod = bag.splice(Math.floor(r() * bag.length), 1)[0];
    let counter = mod.counter, mon = null;
    if (mod.species) {
      const near = Object.values(MONSTERS).filter((m) => !m.boss && m.lvl[0] <= level + lvSpan(2) && m.lvl[1] >= level - lvSpan(8));
      if (!near.length) continue;
      mon = pick(r, near);
      counter = `bst:${mon.id}`;
    }
    // metas maiores para quem já é forte; nunca passam das opções do modelo
    const gi = Math.min(mod.goals.length - 1, Math.floor(r() * mod.goals.length));
    const target = mod.goals[gi];
    const tier = kind === 'd' ? 1 : 3;
    out.push({
      id: `${kind}${idx}_${out.length}`, counter, target, text: mod.text(target, mon),
      rw: { xp: 0.18 * tier, mxp: 40000 * tier * (1 + gi * 0.25), gold: Math.round((15 + evLevel(level) * 6) * tier * (1 + gi * 0.25)), pts: kind === 'd' ? 2 : 6 },
    });
  }
  return out;
}
