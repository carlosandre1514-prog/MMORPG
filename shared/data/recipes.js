// Receitas de criação. station: 'alchemy' (Fenwick) ou 'smith' (Brunhilda).
// result: { id, qty } para itens fixos, ou { gear: 'armor'|'weapon', tier, minRarity } para equipamento aleatório.

export const RECIPES = {
  // ---------- Alquimia ----------
  r_pot_hp_2: {
    id: 'r_pot_hp_2', station: 'alchemy', name: 'Poção de Vida', lvl: 5,
    mats: [['mat_slime', 2], ['mat_herb', 1]], gold: 10, result: { id: 'pot_hp_2', qty: 2 },
  },
  r_pot_mp_2: {
    id: 'r_pot_mp_2', station: 'alchemy', name: 'Poção de Mana', lvl: 5,
    mats: [['mat_herb', 2], ['mat_pelt', 1]], gold: 10, result: { id: 'pot_mp_2', qty: 2 },
  },
  r_pot_hp_3: {
    id: 'r_pot_hp_3', station: 'alchemy', name: 'Poção de Vida Maior', lvl: 12,
    mats: [['mat_bone', 2], ['mat_herb', 1], ['mat_silk', 1]], gold: 30, result: { id: 'pot_hp_3', qty: 2 },
  },
  r_pot_mp_3: {
    id: 'r_pot_mp_3', station: 'alchemy', name: 'Poção de Mana Maior', lvl: 12,
    mats: [['mat_crystal', 1], ['mat_wing', 2]], gold: 30, result: { id: 'pot_mp_3', qty: 2 },
  },
  r_pot_hp_4: {
    id: 'r_pot_hp_4', station: 'alchemy', name: 'Poção de Vida Suprema', lvl: 20,
    mats: [['mat_ash', 2], ['mat_essence', 1]], gold: 80, result: { id: 'pot_hp_4', qty: 2 },
  },
  r_elixir_str: {
    id: 'r_elixir_str', station: 'alchemy', name: 'Elixir do Gigante', lvl: 6,
    mats: [['mat_tusk', 3], ['mat_pelt', 2]], gold: 40, result: { id: 'elixir_str', qty: 1 },
  },
  r_elixir_def: {
    id: 'r_elixir_def', station: 'alchemy', name: 'Elixir da Pedra', lvl: 10,
    mats: [['mat_bark', 2], ['mat_silk', 2]], gold: 50, result: { id: 'elixir_def', qty: 1 },
  },
  r_elixir_speed: {
    id: 'r_elixir_speed', station: 'alchemy', name: 'Infusão do Vento', lvl: 8,
    mats: [['mat_cloth', 3], ['mat_herb', 2]], gold: 40, result: { id: 'elixir_speed', qty: 1 },
  },
  r_elixir_xp: {
    id: 'r_elixir_xp', station: 'alchemy', name: 'Tônico da Sabedoria', lvl: 14,
    mats: [['mat_crystal', 2], ['mat_herb', 2], ['mat_wing', 2]], gold: 100, result: { id: 'elixir_xp', qty: 1 },
  },
  r_scroll: {
    id: 'r_scroll', station: 'alchemy', name: 'Pergaminho de Retorno', lvl: 3,
    mats: [['mat_slime', 2], ['mat_cloth', 1]], gold: 5, result: { id: 'scroll_return', qty: 2 },
  },

  // ---------- Forja ----------
  r_stone_a: {
    id: 'r_stone_a', station: 'smith', name: 'Pedra de Aprimoramento (peles)', lvl: 4,
    mats: [['mat_pelt', 4], ['mat_tusk', 2]], gold: 60, result: { id: 'enh_stone', qty: 1 },
  },
  r_stone_b: {
    id: 'r_stone_b', station: 'smith', name: 'Pedra de Aprimoramento (minério)', lvl: 12,
    mats: [['mat_ore', 2], ['mat_crystal', 1]], gold: 80, result: { id: 'enh_stone', qty: 2 },
  },
  r_armor_2: {
    id: 'r_armor_2', station: 'smith', name: 'Forjar Armadura de Bronze', lvl: 6,
    mats: [['mat_pelt', 5], ['mat_tusk', 3]], gold: 150, result: { gear: 'armor', tier: 2, minRarity: 1 },
  },
  r_weapon_2: {
    id: 'r_weapon_2', station: 'smith', name: 'Forjar Arma (Nível 5)', lvl: 5,
    mats: [['mat_tusk', 4], ['mat_slime', 4]], gold: 150, result: { gear: 'weapon', tier: 2, minRarity: 1 },
  },
  r_armor_3: {
    id: 'r_armor_3', station: 'smith', name: 'Forjar Armadura de Ferro', lvl: 12,
    mats: [['mat_silk', 5], ['mat_bark', 3], ['mat_cloth', 4]], gold: 400, result: { gear: 'armor', tier: 3, minRarity: 1 },
  },
  r_weapon_3: {
    id: 'r_weapon_3', station: 'smith', name: 'Forjar Arma (Nível 10)', lvl: 10,
    mats: [['mat_silk', 4], ['mat_bark', 4]], gold: 400, result: { gear: 'weapon', tier: 3, minRarity: 1 },
  },
  r_weapon_4: {
    id: 'r_weapon_4', station: 'smith', name: 'Forjar Arma (Nível 15)', lvl: 15,
    mats: [['mat_ore', 5], ['mat_bone', 5], ['mat_crystal', 2]], gold: 800, result: { gear: 'weapon', tier: 4, minRarity: 2 },
  },
  r_armor_4: {
    id: 'r_armor_4', station: 'smith', name: 'Forjar Armadura de Mithril', lvl: 18,
    mats: [['mat_ore', 6], ['mat_crystal', 3], ['mat_wing', 4]], gold: 900, result: { gear: 'armor', tier: 4, minRarity: 2 },
  },
  r_weapon_5: {
    id: 'r_weapon_5', station: 'smith', name: 'Forjar Arma (Nível 20)', lvl: 20,
    mats: [['mat_essence', 5], ['mat_ash', 4], ['mat_ember', 1]], gold: 1600, result: { gear: 'weapon', tier: 5, minRarity: 2 },
  },
  r_armor_5: {
    id: 'r_armor_5', station: 'smith', name: 'Forjar Armadura Dracônica', lvl: 24,
    mats: [['mat_ash', 6], ['mat_essence', 4], ['mat_ember', 1]], gold: 2000, result: { gear: 'armor', tier: 5, minRarity: 2 },
  },
  r_ring: {
    id: 'r_ring', station: 'smith', name: 'Forjar Joia', lvl: 8,
    mats: [['mat_crystal', 2], ['mat_ore', 2]], gold: 300, result: { gear: 'jewel', tier: 2, minRarity: 1 },
  },
};

export function recipesFor(station) {
  return Object.values(RECIPES).filter((r) => r.station === station);
}
