// Lógica de missões no cliente (espelha o servidor para mostrar progresso e marcadores).
import { QUESTS } from '/shared/data/quests.js';

export function countItem(inv, id) {
  let n = 0;
  for (const it of inv || []) if (it && it.id === id) n += it.q || 1;
  return n;
}

export function canAccept(me, q) {
  const st = me.quests;
  if (!st) return false;
  if (st.active[q.id]) return false;
  if (!q.repeatable && st.done[q.id]) return false;
  if (me.level < q.lvl) return false;
  for (const p of q.prereq || []) if (!st.done[p]) return false;
  return true;
}

// Disponível em breve (pré-requisitos ok, falta nível)
export function almostAvailable(me, q) {
  const st = me.quests;
  if (!st || st.active[q.id] || (!q.repeatable && st.done[q.id])) return false;
  for (const p of q.prereq || []) if (!st.done[p]) return false;
  return me.level < q.lvl;
}

export function progress(me, q, i) {
  const o = q.objectives[i];
  if (o.type === 'collect') return Math.min(o.count, countItem(me.inv, o.item));
  const a = me.quests?.active[q.id];
  return a ? (a.k[i] || 0) : 0;
}

export function need(o) { return o.count || 1; }

export function isComplete(me, q) {
  if (!me.quests?.active[q.id]) return false;
  return q.objectives.every((o, i) => progress(me, q, i) >= need(o));
}

export function activeQuests(me) {
  return Object.keys(me.quests?.active || {}).map((id) => QUESTS[id]).filter(Boolean);
}
