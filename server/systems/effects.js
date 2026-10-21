// Efeitos de status (buffs, debuffs, danos ao longo do tempo) aplicados a jogadores e monstros.
import { F } from '../../shared/constants.js';

// Tipos que alteram atributos e exigem recálculo.
const STAT_TYPES = new Set(['buff', 'slow', 'dr', 'haste']);

export function addStatus(ent, st, now = Date.now()) {
  if (!ent.alive) return;
  if (ent.isMonster && ent.def.boss && (st.type === 'stun' || st.type === 'root')) {
    // chefes resistem a controle: duração reduzida
    st.dur = st.dur * 0.35;
  }
  st.until = now + st.dur * 1000;
  if (st.dps) st.next = now + 1000;
  const idx = ent.statuses.findIndex((s) => s.id === st.id);
  if (idx >= 0) ent.statuses[idx] = st;
  else ent.statuses.push(st);
  if (STAT_TYPES.has(st.type)) ent.recalc();
  ent.flagsDirty = true;
}

export function removeStatus(ent, pred) {
  const before = ent.statuses.length;
  let needRecalc = false;
  ent.statuses = ent.statuses.filter((s) => {
    if (pred(s)) { if (STAT_TYPES.has(s.type)) needRecalc = true; return false; }
    return true;
  });
  if (needRecalc) ent.recalc();
  return before !== ent.statuses.length;
}

export function hasStatus(ent, type) {
  for (const s of ent.statuses) if (s.type === type) return true;
  return false;
}

export function clearStatuses(ent, keepPersistent = true) {
  ent.statuses = keepPersistent ? ent.statuses.filter((s) => s.persist) : [];
  ent.recalc();
}

// Modificadores agregados para computeStats / atributos de monstros.
export function statusMods(ent) {
  const m = { power: 0, def: 0, crit: 0, haste: 0, lifesteal: 0, speed: 0, slow: 0, dr: 0, xp: 0, regenPct: 0 };
  for (const s of ent.statuses) {
    if (s.type === 'slow') m.slow = Math.max(m.slow, s.value);
    else if (s.type === 'dr') m.dr = Math.max(m.dr, s.value);
    else if (s.type === 'buff' && s.mods) {
      for (const [k, v] of Object.entries(s.mods)) m[k] = (m[k] || 0) + v;
    }
  }
  m.dr = Math.min(0.8, m.dr);
  m.slow = Math.min(0.8, m.slow);
  return m;
}

export function statusFlags(ent) {
  let f = 0;
  for (const s of ent.statuses) {
    switch (s.type) {
      case 'stun': f |= F.STUN; break;
      case 'root': f |= F.ROOT; break;
      case 'slow': f |= F.SLOW; break;
      case 'burn': f |= F.BURN; break;
      case 'poison': f |= F.POISON; break;
      case 'shield': f |= F.SHIELD; break;
      case 'invuln': f |= F.INVULN; break;
      case 'buff': f |= s.debuff ? F.DEBUFF : F.BUFF; if (s.mods && s.mods.regenPct) f |= F.REGEN; break;
      case 'dr': f |= F.BUFF; break;
      default: break;
    }
  }
  return f;
}

// Atualiza efeitos: expira e aplica danos periódicos. onDot(ent, status) aplica o dano.
export function tickStatuses(ent, now, onDot) {
  if (!ent.statuses.length) return;
  let expired = false, needRecalc = false;
  for (const s of ent.statuses) {
    if (s.dps && now >= s.next && now <= s.until + 50) {
      s.next += 1000;
      onDot(ent, s);
      if (!ent.alive) return;
    }
    if (s.regenPct && now >= (s.nextRegen || 0)) {
      s.nextRegen = now + 1000;
    }
    if (now >= s.until) {
      expired = true;
      if (STAT_TYPES.has(s.type)) needRecalc = true;
    }
  }
  if (expired) {
    ent.statuses = ent.statuses.filter((s) => now < s.until);
    if (needRecalc) ent.recalc();
    ent.flagsDirty = true;
  }
}

export function statusList(ent, now = Date.now()) {
  // Lista compacta para o cliente exibir ícones de efeitos
  return ent.statuses.map((s) => ({ id: s.id, t: s.type, r: Math.max(0, Math.round((s.until - now) / 100) / 10), n: s.name || null }));
}
