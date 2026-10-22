// Guia de missões: descobre para onde cada missão manda o jogador, calcula a rota (inclusive passando por portais
// de outras zonas) e mantém o caminho que o 3D desenha no chão e o jogador segue sozinho ao tocar em "Ir".
import { ZONES } from '/shared/data/zones.js';
import { NPCS } from '/shared/data/npcs.js';
import { MONSTERS } from '/shared/data/monsters.js';
import { QUESTS, questTargets } from '/shared/data/quests.js';
import { findPath } from '/shared/pathfinding.js';
import { progress, need, isComplete } from './questlogic.js';

// Zonas vizinhas (via portais) e o portal usado para ir de uma a outra
function portalTo(from, to) {
  const p = ZONES[from].portals.find((x) => x.to === to);
  return p ? { x: p.x + p.w / 2, y: p.y + p.h / 2, label: p.label || ZONES[to].name } : null;
}

// Próxima zona no menor caminho de `from` até `to` (busca em largura)
export function nextZone(from, to) {
  if (from === to) return null;
  const prev = { [from]: null };
  const queue = [from];
  while (queue.length) {
    const z = queue.shift();
    for (const p of ZONES[z].portals) {
      if (p.to in prev) continue;
      prev[p.to] = z;
      if (p.to === to) {
        let cur = to;
        while (prev[cur] !== from) cur = prev[cur];
        return cur;
      }
      queue.push(p.to);
    }
  }
  return null;
}

export function zoneDistance(from, to) {
  let d = 0, cur = from;
  while (cur && cur !== to && d < 12) { cur = nextZone(cur, to); d++; }
  return cur === to ? d : 99;
}

// Monstros que dão o item (soltam ou como item de missão)
function droppersOf(item) {
  const out = [];
  for (const m of Object.values(MONSTERS)) {
    if ((m.drops || []).some((d) => d.id === item) || (m.questDrops || []).some((d) => d.id === item)) out.push(m.id);
  }
  return out;
}

// Pontos de caça dos monstros indicados: [{ zone, x, y, r, m }]
function huntSpots(monsterIds) {
  const spots = [];
  for (const z of Object.values(ZONES)) for (const s of z.spawns || []) if (monsterIds.includes(s.m)) spots.push({ zone: z.id, x: s.x, y: s.y, r: s.r || 6, m: s.m });
  return spots;
}

// Destino de uma missão: { zone, x, y, label, kind: 'npc'|'hunt'|'pvp', npc?, r }
export function questDestination(game, q) {
  const me = game.me;
  const here = game.zone.id;
  const npcDest = (id, why) => {
    const n = NPCS[id];
    return { zone: n.zone, x: n.x, y: n.y, label: `${n.name}${why ? ' · ' + why : ''}`, kind: 'npc', npc: id, r: 2.6 };
  };
  if (isComplete(me, q)) return npcDest(q.turnIn, 'entregar');
  for (let i = 0; i < q.objectives.length; i++) {
    const o = q.objectives[i];
    if (progress(me, q, i) >= need(o)) continue;
    if (o.type === 'talk') return npcDest(o.npc, 'conversar');
    let spots = [];
    let what = '';
    if (o.type === 'kill') { const ids = questTargets(o); spots = huntSpots(ids); what = MONSTERS[ids[0]]?.name || 'inimigos'; }
    else if (o.type === 'collect') { spots = huntSpots(droppersOf(o.item)); what = 'caçar'; }
    else if (o.type === 'pvp') return { zone: 'arena', x: ZONES.arena.spawn.x, y: ZONES.arena.spawn.y, label: 'Arena de Sangue', kind: 'pvp', r: 6 };
    if (!spots.length) continue;
    // o ponto mais próximo: na zona atual pela distância, nas outras pelo número de portais
    spots.sort((a, b) => {
      const da = a.zone === here ? Math.hypot(a.x - me.x, a.y - me.y) : 1000 + zoneDistance(here, a.zone) * 500;
      const db = b.zone === here ? Math.hypot(b.x - me.x, b.y - me.y) : 1000 + zoneDistance(here, b.zone) * 500;
      return da - db;
    });
    const s = spots[0];
    return { zone: s.zone, x: s.x, y: s.y, label: what, kind: 'hunt', r: Math.max(4, s.r * 0.7) };
  }
  return npcDest(q.turnIn, 'entregar');
}

// Primeira missão ativa (campanha primeiro) que tem destino
export function defaultQuest(me) {
  const act = Object.keys(me.quests?.active || {}).map((id) => QUESTS[id]).filter(Boolean);
  act.sort((a, b) => (b.main ? 1 : 0) - (a.main ? 1 : 0));
  return act[0] || null;
}

// Estado do guia no jogo: destino, ponto intermediário (portal), caminho e distância restante
export class Guide {
  constructor(game) {
    this.game = game;
    this.questId = null;
    this.auto = false;
    this.dest = null;
    this.wp = null; // ponto para onde andar agora (destino ou portal)
    this.path = []; // pontos [{x, y}] do caminho até wp
    this.ver = 0; // muda quando o caminho muda (o 3D refaz as setas)
    this.dist = 0;
    this.nextAt = 0;
    this.arrived = false;
    this.off = false; // o jogador desligou o guia (não volta a escolher uma missão sozinho)
  }

  get active() { return !!this.questId; }

  track(questId, auto = false) {
    this.off = false;
    this.questId = questId;
    this.auto = auto;
    this.arrived = false;
    this.nextAt = 0;
    this.update(performance.now(), true);
  }

  // parar a pedido do jogador (off) ou porque a missão acabou
  stop(byUser = true) {
    this.off = byUser;
    this.questId = null; this.auto = false; this.dest = null; this.wp = null; this.path = []; this.ver++;
    if (this.game.path && byUser) this.game.path = null;
    this.game.ui.onGuide?.();
  }

  setAuto(on) {
    if (this.auto === on) return;
    this.auto = on;
    if (!on && this.game.path) this.game.path = null;
    this.game.ui.onGuide?.();
  }

  update(now, force = false) {
    const g = this.game;
    if (!g.zone) return;
    if (!this.questId) {
      // sem missão acompanhada: acompanha a principal (só a seta no chão, sem andar sozinho)
      if (!this.off && now >= this.nextAt) {
        this.nextAt = now + 1000;
        const q = defaultQuest(g.me);
        if (q) this.track(q.id, false);
      }
      return;
    }
    const q = QUESTS[this.questId];
    if (!q || !g.me.quests?.active[this.questId]) { this.stop(false); return; }
    if (!force && now < this.nextAt) return;
    this.nextAt = now + 700;
    const me = g.me;
    const dest = questDestination(g, q);
    const here = g.zone.id;
    let wp;
    if (dest.zone === here) wp = { x: dest.x, y: dest.y, label: dest.label, portal: false };
    else {
      const nz = nextZone(here, dest.zone);
      const p = nz && portalTo(here, nz);
      wp = p ? { x: p.x, y: p.y, label: `Portal: ${p.label}`, portal: true } : null;
    }
    const changed = !this.dest || this.dest.label !== dest.label || this.dest.zone !== dest.zone;
    this.dest = dest;
    this.wp = wp;
    if (!wp) { this.path = []; this.dist = 0; this.ver++; return; }
    const path = findPath(g.zone.map, me.x, me.y, wp.x, wp.y, 14000) || [];
    this.path = path;
    this.dist = path.length ? pathLength(me, path) : Math.hypot(wp.x - me.x, wp.y - me.y);
    this.ver++;
    if (changed) { this.arrived = false; g.ui.onGuide?.(); }
    // chegada: o NPC abre o diálogo; a região de caça só para de andar
    const d = Math.hypot(dest.x - me.x, dest.y - me.y);
    if (dest.zone === here && d <= dest.r) {
      if (!this.arrived) {
        this.arrived = true;
        if (this.auto) {
          this.auto = false; g.path = null;
          if (dest.kind === 'npc') {
            const e = [...g.entities.values()].find((x) => x.k === 'n' && x.n === dest.npc);
            if (e) { g.target = e.id; g.action = { type: 'npc', id: e.id }; }
          } else g.ui.toast(`Você chegou: ${dest.label}.`, 'info');
          g.ui.onGuide?.();
        }
      }
      return;
    }
    this.arrived = false;
    // andar sozinho: o jogo segue g.path; só refaz quando ele acabou ou o destino mudou
    if (this.auto && path.length && !g.keyMoving && (!g.path || !g.path.length || force || changed)) g.path = path.map((p) => ({ x: p.x, y: p.y }));
  }
}

function pathLength(me, path) {
  let len = 0, px = me.x, py = me.y;
  for (const p of path) { len += Math.hypot(p.x - px, p.y - py); px = p.x; py = p.y; }
  return len;
}
