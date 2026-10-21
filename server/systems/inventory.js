// Inventário, equipamento e baú.
import { ITEMS } from '../../shared/data/items.js';
import { MAX_STACK, INV_SIZE } from '../../shared/constants.js';
import { createItem } from '../../shared/itemgen.js';

export function countItem(list, id) {
  let n = 0;
  for (const it of list) if (it && it.id === id) n += it.q || 1;
  return n;
}

export function freeSlots(list) {
  let n = 0;
  for (const it of list) if (!it) n++;
  return n;
}

// Quantos espaços uma lista de itens precisa (considerando pilhas existentes).
function slotsNeeded(list, items) {
  const sim = list.map((it) => (it ? { id: it.id, q: it.q || 1 } : null));
  let needed = 0;
  for (const item of items) {
    const base = ITEMS[item.id];
    if (base && base.stack) {
      let q = item.q || 1;
      for (const s of sim) {
        if (q <= 0) break;
        if (s && s.id === item.id && s.q < MAX_STACK) {
          const add = Math.min(q, MAX_STACK - s.q);
          s.q += add; q -= add;
        }
      }
      while (q > 0) { needed++; sim.push({ id: item.id, q: Math.min(q, MAX_STACK) }); q -= MAX_STACK; }
    } else {
      needed++;
    }
  }
  return needed;
}

export function canAddAll(list, items) {
  return slotsNeeded(list, items) <= freeSlots(list);
}

// Adiciona um item (tudo ou nada). Retorna true se coube.
export function addItem(list, item) {
  const base = ITEMS[item.id];
  if (!base) return false;
  if (!canAddAll(list, [item])) return false;
  if (base.stack) {
    let q = item.q || 1;
    for (const s of list) {
      if (q <= 0) break;
      if (s && s.id === item.id && (s.q || 1) < MAX_STACK) {
        const add = Math.min(q, MAX_STACK - (s.q || 1));
        s.q = (s.q || 1) + add;
        q -= add;
      }
    }
    while (q > 0) {
      const idx = list.indexOf(null);
      const n = Math.min(q, MAX_STACK);
      list[idx] = createItem(item.id, { qty: n });
      q -= n;
    }
    return true;
  }
  const idx = list.indexOf(null);
  list[idx] = item;
  return true;
}

export function removeItem(list, id, qty) {
  if (countItem(list, id) < qty) return false;
  for (let i = list.length - 1; i >= 0 && qty > 0; i--) {
    const it = list[i];
    if (!it || it.id !== id) continue;
    const q = it.q || 1;
    if (q <= qty) { list[i] = null; qty -= q; } else { it.q = q - qty; qty = 0; }
  }
  return true;
}

export function newInventory(size = INV_SIZE) {
  return new Array(size).fill(null);
}

export function validSlot(list, slot) {
  return Number.isInteger(slot) && slot >= 0 && slot < list.length;
}
