// Sistema de missões: aceitar, progredir, entregar e abandonar.
import { QUESTS, questTargets } from '../../shared/data/quests.js';
import { NPCS } from '../../shared/data/npcs.js';
import { ITEMS } from '../../shared/data/items.js';
import { MONSTERS } from '../../shared/data/monsters.js';
import { NPC_RANGE } from '../../shared/constants.js';
import { createItem } from '../../shared/itemgen.js';
import { countItem, addItem, removeItem, canAddAll } from './inventory.js';
import { bump } from './legacy.js';

export function questState(ch) {
  if (!ch.quests) ch.quests = { active: {}, done: {} };
  return ch.quests;
}

export function canAccept(ch, q) {
  const st = questState(ch);
  if (st.active[q.id]) return 'Você já está nesta missão.';
  if (!q.repeatable && st.done[q.id]) return 'Missão já concluída.';
  if (ch.level < q.lvl) return `Requer nível ${q.lvl}.`;
  for (const pre of q.prereq || []) if (!st.done[pre]) return 'Você ainda não está pronto para esta missão.';
  if (Object.keys(st.active).length >= 25) return 'Seu diário de missões está cheio.';
  return null;
}

export function objectiveProgress(ch, q, i) {
  const o = q.objectives[i];
  if (o.type === 'collect') return Math.min(o.count, countItem(ch.inv, o.item));
  const a = questState(ch).active[q.id];
  return a ? (a.k[i] || 0) : 0;
}

export function objectiveNeed(o) {
  return o.count || 1;
}

export function isComplete(ch, q) {
  if (!questState(ch).active[q.id]) return false;
  return q.objectives.every((o, i) => objectiveProgress(ch, q, i) >= objectiveNeed(o));
}

function nearNpc(p, npcId) {
  const n = NPCS[npcId];
  if (!n || !p.zone || n.zone !== p.zone.id) return false;
  return Math.hypot(p.x - n.x, p.y - n.y) <= NPC_RANGE + 1;
}

export function acceptQuest(p, qid) {
  const q = QUESTS[qid];
  if (!q) return;
  if (!nearNpc(p, q.giver)) return p.err('Aproxime-se de quem oferece a missão.');
  const why = canAccept(p.char, q);
  if (why) return p.err(why);
  if (q.startItems && !canAddAll(p.char.inv, q.startItems.map(([id, n]) => ({ id, q: n })))) {
    return p.err('Inventário cheio.');
  }
  questState(p.char).active[q.id] = { k: q.objectives.map(() => 0), at: Date.now() };
  for (const [id, n] of q.startItems || []) addItem(p.char.inv, createItem(id, { qty: n }));
  p.dirty.inv = true;
  p.dirty.quests = true;
  p.msg(`Missão aceita: ${q.name}`, 'quest');
  // objetivos de conversa com o próprio NPC atual já contam
  onTalk(p, q.giver, true);
}

export function abandonQuest(p, qid) {
  const st = questState(p.char);
  const q = QUESTS[qid];
  if (!st.active[qid] || !q) return;
  delete st.active[qid];
  for (const [id] of q.startItems || []) {
    const n = countItem(p.char.inv, id);
    if (n) removeItem(p.char.inv, id, n);
  }
  p.dirty.inv = true;
  p.dirty.quests = true;
  p.msg(`Missão abandonada: ${q.name}`, 'warn');
}

export function turnInQuest(world, p, qid) {
  const q = QUESTS[qid];
  if (!q) return;
  if (!nearNpc(p, q.turnIn)) return p.err('Aproxime-se de quem recebe a missão.');
  if (!isComplete(p.char, q)) return p.err('Os objetivos ainda não foram cumpridos.');
  const rewardItems = (q.rewards.items || []).map(([id, n]) => ({ id, q: n }));
  // simula a remoção dos itens coletados antes de checar espaço
  const inv = p.char.inv.map((it) => (it ? { ...it } : null));
  for (const o of q.objectives) if (o.type === 'collect') removeItem(inv, o.item, o.count);
  for (const id of q.consumeOnComplete || []) { const n = countItem(inv, id); if (n) removeItem(inv, id, n); }
  if (!canAddAll(inv, rewardItems)) return p.err('Libere espaço no inventário para receber a recompensa.');
  for (const o of q.objectives) if (o.type === 'collect') removeItem(p.char.inv, o.item, o.count);
  for (const id of q.consumeOnComplete || []) { const n = countItem(p.char.inv, id); if (n) removeItem(p.char.inv, id, n); }
  const st = questState(p.char);
  delete st.active[q.id];
  st.done[q.id] = (st.done[q.id] || 0) + 1;
  const r = q.rewards;
  for (const it of rewardItems) {
    const base = ITEMS[it.id];
    const inst = createItem(it.id, { qty: it.q, rarity: base && !base.stack ? 1 : 0 });
    addItem(p.char.inv, inst);
  }
  if (r.gold) world.giveGold(p, r.gold);
  if (r.flag) {
    p.char.flags = p.char.flags || {};
    p.char.flags[r.flag] = true;
    p.recalc();
  }
  if (r.title) {
    p.char.titles ||= [];
    if (!p.char.titles.includes(r.title)) p.char.titles.push(r.title);
    p.char.title = r.title;
    p.ver++;
    p.dirty.legacy = true;
    world.broadcastSystem(`${p.name} ${r.titleMsg || 'reacendeu a Chama Primordial e tornou-se um'} ${r.title}!`, 'epic');
  }
  p.dirty.inv = true;
  p.dirty.quests = true;
  p.send({ t: 'qdone', q: q.id });
  bump(p, 'quests');
  p.msg(`Missão concluída: ${q.name}`, 'quest');
  if (r.xp) world.giveXp(p, r.xp, true);
}

export function onKill(p, monsterId) {
  const st = questState(p.char);
  for (const qid of Object.keys(st.active)) {
    const q = QUESTS[qid];
    if (!q) continue;
    q.objectives.forEach((o, i) => {
      if (o.type !== 'kill' || !questTargets(o).includes(monsterId)) return;
      const a = st.active[qid];
      if ((a.k[i] || 0) >= o.count) return;
      a.k[i] = (a.k[i] || 0) + 1;
      p.dirty.quests = true;
      const mname = questTargets(o).length > 1 ? 'Inimigos' : MONSTERS[monsterId].name;
      p.send({ t: 'qprog', m: `${q.name}: ${mname} ${a.k[i]}/${o.count}` });
    });
  }
}

export function onPvpKill(p) {
  const st = questState(p.char);
  for (const qid of Object.keys(st.active)) {
    const q = QUESTS[qid];
    q.objectives.forEach((o, i) => {
      if (o.type !== 'pvp') return;
      const a = st.active[qid];
      if ((a.k[i] || 0) >= o.count) return;
      a.k[i] = (a.k[i] || 0) + 1;
      p.dirty.quests = true;
      p.send({ t: 'qprog', m: `${q.name}: Vitórias ${a.k[i]}/${o.count}` });
    });
  }
}

export function onTalk(p, npcId, silent = false) {
  if (!nearNpc(p, npcId)) return;
  const st = questState(p.char);
  for (const qid of Object.keys(st.active)) {
    const q = QUESTS[qid];
    q.objectives.forEach((o, i) => {
      if (o.type !== 'talk' || o.npc !== npcId) return;
      const a = st.active[qid];
      if (a.k[i] >= 1) return;
      a.k[i] = 1;
      p.dirty.quests = true;
      if (!silent) p.send({ t: 'qprog', m: `${q.name}: objetivo cumprido` });
    });
  }
}

// Itens de missão que este jogador ainda precisa (para saque pessoal).
export function needsQuestItem(ch, itemId, questId) {
  const st = questState(ch);
  if (!st.active[questId]) return false;
  const q = QUESTS[questId];
  const o = q.objectives.find((ob) => ob.type === 'collect' && ob.item === itemId);
  if (!o) return false;
  return countItem(ch.inv, itemId) < o.count;
}
