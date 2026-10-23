// Altares de viagem. Cada portal de uma zona é um altar: quem chega perto o descobre e, depois disso, pode viajar
// para ele a partir do mapa (de graça se estiver ao lado de outro altar; com uma taxa em ouro de qualquer outro lugar).
import { ZONES, ZONE_ORDER } from './data/zones.js';

export const ALTAR_RANGE = 7; // tiles do centro do altar: descobre e conta como "ao lado do altar"
export const ALTAR_COOLDOWN_MS = 12000; // intervalo entre duas viagens
export const altarId = (zone, i) => `${zone}:${i}`;

// ouro cobrado ao viajar longe de um altar; cresce com o nível para continuar fazendo diferença no fim do jogo
export const travelFee = (level) => 30 + level * 10;

let cache = null;

function build() {
  const list = [];
  const byId = new Map();
  for (const zid of ZONE_ORDER) {
    const z = ZONES[zid];
    z.portals.forEach((p, i) => {
      // chegada no altar: o ponto onde o portal vizinho deixa quem vem de lá (fica ao lado do altar, fora da área que transporta)
      const back = ZONES[p.to] && ZONES[p.to].portals.find((q) => q.to === zid);
      const a = {
        id: altarId(zid, i), zone: zid, i, kingdom: z.kingdom, to: p.to, label: p.label,
        name: `${z.name}: rumo a ${p.label}`,
        x: p.x + p.w / 2, y: p.y + p.h / 2, w: p.w, h: p.h,
        arrive: back ? { x: back.tx, y: back.ty } : { x: z.spawn.x, y: z.spawn.y },
        pvp: !!z.pvp, // altares da Arena não são destino de viagem
      };
      list.push(a);
      byId.set(a.id, a);
    });
  }
  return { list, byId, byZone: Object.fromEntries(ZONE_ORDER.map((id) => [id, list.filter((a) => a.zone === id)])) };
}

const all = () => cache || (cache = build());
export const altarList = () => all().list;
export const altarById = (id) => all().byId.get(id) || null;
export const altarsIn = (zoneId) => all().byZone[zoneId] || [];

// altar mais próximo dentro do alcance (ou null)
export function altarNear(zoneId, x, y, range = ALTAR_RANGE) {
  let best = null, bd = range * range;
  for (const a of altarsIn(zoneId)) {
    const d = (a.x - x) * (a.x - x) + (a.y - y) * (a.y - y);
    if (d <= bd) { bd = d; best = a; }
  }
  return best;
}

// altares de personagens antigos (que ainda não tinham a lista): vale quem já conheceu os dois lados da passagem
export function backfillAltars(visited) {
  const out = [];
  for (const a of altarList()) if (visited.includes(a.zone) && visited.includes(a.to)) out.push(a.id);
  return out;
}
