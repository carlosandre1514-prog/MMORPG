// Altares de viagem: descobrir ao chegar perto e viajar entre os descobertos (regras em shared/altars.js).
import { altarsIn, altarById, altarNear, ALTAR_RANGE, ALTAR_COOLDOWN_MS, travelFee } from '../../shared/altars.js';
import { ZONES, kingdomOf } from '../../shared/data/zones.js';

// chamado ao andar e ao entrar numa zona: quem passa a menos de ALTAR_RANGE de um altar o descobre
export function discoverAltars(p, now = Date.now()) {
  if (!p.zone || now - p.altarCheck < 300) return;
  p.altarCheck = now;
  const ch = p.char;
  for (const a of altarsIn(p.zone.id)) {
    if (ch.altars.includes(a.id)) continue;
    if (Math.hypot(a.x - p.x, a.y - p.y) > ALTAR_RANGE) continue;
    ch.altars.push(a.id);
    p.send({ t: 'altar', id: a.id });
    p.world.db.markDirty();
  }
}

// Viagem pelo mapa: de graça ao lado de outro altar, com taxa em ouro de qualquer outro lugar
export function travelToAltar(world, p, id) {
  const a = altarById(String(id));
  const ch = p.char;
  if (!a || a.pvp || ZONES[a.zone].pvp) return;
  if (!ch.altars.includes(a.id)) return p.err('Você ainda não descobriu este altar.');
  if (p.dead || !p.zone) return;
  if (p.zone.def.pvp) return p.err('Não é possível viajar de dentro da Arena.');
  if (kingdomOf(a.zone) !== p.zone.def.kingdom) return p.err('Os altares só levam a lugares do mesmo reino. Atravesse a fronteira a pé.');
  if (p.inCombat()) return p.err('Não é possível viajar em combate.');
  const here = altarNear(p.zone.id, p.x, p.y);
  if (here && here.id === a.id) return p.err('Você já está neste altar.');
  const now = Date.now();
  if (now < p.altarCd) return p.err(`Os altares ainda estão se recompondo (${Math.ceil((p.altarCd - now) / 1000)}s).`);
  const fee = here ? 0 : travelFee(ch.level);
  if (ch.gold < fee) return p.err(`Viajar de longe de um altar custa ${fee} de ouro.`);
  if (fee) { ch.gold -= fee; p.dirty.me = true; }
  p.altarCd = now + ALTAR_COOLDOWN_MS;
  p.send({ t: 'msg', m: fee ? `Você pagou ${fee} de ouro e atravessou o altar.` : 'Você atravessou o altar.', k: 'good' });
  world.transfer(p, a.zone, a.arrive.x, a.arrive.y);
}
