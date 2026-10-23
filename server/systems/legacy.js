// Legado do personagem no servidor: contadores, feitos, maestria, bestiário e desafios do dia/semana. As regras e os números
// ficam em shared/data/legacy.js; aqui só se guarda, confere e avisa o jogador.
import {
  ACHIEVEMENTS, counterValue, gloryOf, bestiaryBonus, masteryNext, masterySpent, masteryBonus, MASTERY_STATS, respecCost,
  dayIndex, weekIndex, dayEnds, weekEnds, makeChallenges,
} from '../../shared/data/legacy.js';
import { MAX_LEVEL } from '../../shared/constants.js';
import { xpToNext } from '../../shared/formulas.js';

const SEND_EVERY = 4000; // ms entre dois envios do legado enquanto o jogador está jogando

// Campos do personagem (também para saves antigos)
export function ensureLegacy(ch) {
  ch.stats ||= {};
  ch.ach ||= {};
  ch.titles ||= [];
  ch.bestiary ||= {};
  ch.mastery ||= { xp: 0, level: 0, ranks: {} };
  ch.mastery.ranks ||= {};
  ch.chal ||= { d: null, w: null };
  if (ch.title && !ch.titles.includes(ch.title)) ch.titles.push(ch.title);
}

// marca que há novidade para conferir e enviar
export function touch(p) { if (p && p.dirty) p.dirty.legacy = true; }

// soma a um contador de ch.stats
export function bump(p, key, n = 1) {
  if (!(n > 0)) return;
  const s = p.char.stats;
  s[key] = (s[key] || 0) + n;
  p.dirty.legacy = true;
}

// abate de um monstro: contadores e bestiário (criaturas invocadas por chefes não contam)
export function onMonsterKilled(p, def, inGroup, summoned) {
  if (!summoned) {
    p.char.bestiary[def.id] = (p.char.bestiary[def.id] || 0) + 1;
    if (inGroup) bump(p, 'group');
  }
  p.dirty.legacy = true;
}

// dano extra contra a espécie, pelo que o jogador já estudou dela
export function bestiaryMult(p, def) {
  return 1 + bestiaryBonus((p.char.bestiary && p.char.bestiary[def.id]) || 0);
}

// ---------------------------------------------------------------- maestria
export function masteryPoints(ch) { return ch.mastery.level - masterySpent(ch.mastery.ranks); }

// XP de maestria (o que passa do nível máximo); devolve quantos níveis subiu
export function addMasteryXp(p, amount) {
  const ch = p.char, m = ch.mastery;
  const gain = Math.max(0, Math.round(amount * (1 + masteryBonus(m.ranks).xp)));
  if (!gain) return 0;
  m.xp += gain;
  let up = 0;
  while (m.xp >= masteryNext(m.level)) { m.xp -= masteryNext(m.level); m.level++; up++; }
  if (up) {
    p.send({ t: 'mlvl', lv: m.level });
    p.msg(`Maestria ${m.level}! Você ganhou ${up} ponto${up > 1 ? 's' : ''} de maestria (tecla N).`, 'good');
    p.zone && p.zone.fx({ k: 'lv', id: p.id }, p.x, p.y);
  }
  p.dirty.legacy = true;
  return up;
}

export function spendMastery(world, p, k, n) {
  const st = MASTERY_STATS[k];
  const ch = p.char;
  if (!st) return;
  n = Math.floor(n) || 1;
  const have = ch.mastery.ranks[k] || 0;
  n = Math.min(n, st.max - have, masteryPoints(ch));
  if (n <= 0) return p.err(have >= st.max ? 'Este atributo já está no máximo.' : 'Você não tem pontos de maestria.');
  ch.mastery.ranks[k] = have + n;
  p.recalc();
  p.dirty.me = p.dirty.stats = p.dirty.legacy = true;
}

export function resetMastery(world, p) {
  const ch = p.char;
  const spent = masterySpent(ch.mastery.ranks);
  if (!spent) return;
  const cost = respecCost(spent);
  if (ch.gold < cost) return p.err(`Redistribuir a maestria custa ${cost} de ouro.`);
  ch.gold -= cost;
  ch.mastery.ranks = {};
  p.recalc();
  p.dirty.me = p.dirty.stats = p.dirty.legacy = true;
  p.msg('Pontos de maestria redistribuídos.', 'good');
}

// ---------------------------------------------------------------- feitos e títulos
function unlock(world, p, a) {
  const ch = p.char;
  ch.ach[a.id] = Date.now();
  if (a.gold) { ch.gold += a.gold; p.dirty.me = true; }
  if (a.mxp && ch.level >= MAX_LEVEL) addMasteryXp(p, a.mxp);
  else if (a.mxp) world.giveXp(p, Math.round(xpToNext(ch.level) * 0.25));
  if (a.title && !ch.titles.includes(a.title)) {
    ch.titles.push(a.title);
    if (!ch.title) { ch.title = a.title; p.ver++; }
  }
  p.send({ t: 'ach', id: a.id });
  if (a.pts >= 100) world.broadcastSystem(`${p.name} conquistou o feito «${a.name}»!`, 'epic');
  return a;
}

export function checkAchievements(world, p) {
  const ch = p.char;
  const got = [];
  for (const a of ACHIEVEMENTS) {
    if (ch.ach[a.id]) continue;
    if (counterValue(ch, a.counter) >= a.goal) got.push(unlock(world, p, a));
  }
  if (!got.length) return;
  if (got.length <= 3) for (const a of got) p.msg(`Feito conquistado: ${a.name} (+${a.pts} Glória)`, 'good');
  else p.msg(`${got.length} feitos conquistados (+${got.reduce((s, a) => s + a.pts, 0)} Glória). Veja o Legado (tecla N).`, 'good');
  p.dirty.legacy = true;
}

export function setTitle(p, v) {
  const ch = p.char;
  if (v === null || v === '') ch.title = null;
  else if (typeof v === 'string' && ch.titles.includes(v)) ch.title = v;
  else return;
  p.ver++;
  p.dirty.legacy = true;
  p.dirty.me = true;
}

// ---------------------------------------------------------------- desafios
function seedOf(name) { let h = 7; for (const c of String(name)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; }

// garante os desafios do dia e da semana; troca a lista quando o período virou
export function refreshChallenges(p, now = Date.now()) {
  const ch = p.char;
  for (const kind of ['d', 'w']) {
    const idx = kind === 'd' ? dayIndex(now) : weekIndex(now);
    const cur = ch.chal[kind];
    if (cur && cur.idx === idx) continue;
    const list = makeChallenges(kind, idx, ch.level, seedOf(ch.name));
    const base = {};
    for (const c of list) base[c.counter] = counterValue(ch, c.counter);
    ch.chal[kind] = { idx, list, base, claimed: list.map(() => false) };
    p.dirty.legacy = true;
  }
}

export function challengeProgress(ch, kind, i) {
  const c = ch.chal[kind];
  if (!c || !c.list[i]) return 0;
  return Math.max(0, counterValue(ch, c.list[i].counter) - (c.base[c.list[i].counter] || 0));
}

export function claimChallenge(world, p, kind, i) {
  if (kind !== 'd' && kind !== 'w') return;
  refreshChallenges(p);
  const ch = p.char, c = ch.chal[kind];
  const ch1 = c && c.list[i];
  if (!ch1) return;
  if (c.claimed[i]) return p.err('Você já recebeu esta recompensa.');
  if (challengeProgress(ch, kind, i) < ch1.target) return p.err('Este desafio ainda não foi cumprido.');
  c.claimed[i] = true;
  const rw = ch1.rw;
  if (rw.gold) { ch.gold += rw.gold; p.dirty.me = true; }
  if (ch.level >= MAX_LEVEL) addMasteryXp(p, rw.mxp);
  else world.giveXp(p, Math.round(xpToNext(ch.level) * rw.xp), true);
  if (rw.pts) ch.stats.glory = (ch.stats.glory || 0) + rw.pts;
  p.msg(`Desafio cumprido: ${ch1.text} (+${rw.gold} de ouro, +${rw.pts} Glória)`, 'quest');
  p.send({ t: 'sfx', s: 'coin' });
  p.dirty.legacy = true;
}

// ---------------------------------------------------------------- envio ao cliente
// Valores de todos os contadores que a tela precisa (os de espécie e de missão vêm dentro de `bs` e `cv`)
export function legacyPayload(p, now = Date.now()) {
  const ch = p.char;
  refreshChallenges(p, now);
  const cv = {};
  const need = (k) => { if (!k.startsWith('bst:') && !(k in cv)) cv[k] = counterValue(ch, k); };
  for (const a of ACHIEVEMENTS) need(a.counter);
  for (const kind of ['d', 'w']) for (const c of ch.chal[kind].list) need(c.counter);
  for (const k of ['kills', 'bossKills', 'pvpKills', 'deaths', 'zones', 'altars']) need(k);
  const chal = {};
  for (const kind of ['d', 'w']) {
    const c = ch.chal[kind];
    chal[kind] = { ends: kind === 'd' ? dayEnds(c.idx) : weekEnds(c.idx), list: c.list.map((x, i) => ({ ...x, got: Math.min(x.target, challengeProgress(ch, kind, i)), done: !!c.claimed[i] })) };
  }
  return {
    t: 'leg', cv, ac: Object.keys(ch.ach), ti: ch.titles, title: ch.title || null, gl: gloryOf(ch),
    ma: { xp: ch.mastery.xp, lv: ch.mastery.level, ranks: ch.mastery.ranks, next: masteryNext(ch.mastery.level) },
    bs: ch.bestiary, ch: chal, ts: now,
  };
}

// chamado a cada quadro do servidor para cada jogador (barato): confere os feitos e envia o legado, no máximo a cada SEND_EVERY ms
export function flushLegacy(world, p, now) {
  if (!p.dirty.legacy) return;
  if (now < p.legSendAt) return;
  p.dirty.legacy = false;
  p.legSendAt = now + SEND_EVERY;
  checkAchievements(world, p);
  p.send(legacyPayload(p, now));
}
