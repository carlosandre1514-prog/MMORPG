// Banco de itens. Equipamentos comuns são gerados por níveis (tiers);
// instâncias recebem raridade e afixos aleatórios em shared/itemgen.js.

export const ITEMS = {};

function add(item) {
  ITEMS[item.id] = item;
  return item;
}

// ---------------- Armas ----------------
const WEAPON_TIERS = [1, 5, 10, 15, 20, 25, 30];
const WEAPON_NAMES = {
  warrior: ['Espada Curta', 'Espada Longa', 'Lâmina de Ferro Negro', 'Montante do Guardião', 'Lâmina Rúnica', 'Executora das Cinzas', 'Cimitarra do Sol'],
  mage: ['Cajado de Aprendiz', 'Cajado de Carvalho', 'Cajado Arcano', 'Cetro de Cristal', 'Cajado Estelar', 'Cajado do Abismo', 'Cajado de Ankh'],
  ranger: ['Arco Curto', 'Arco de Caça', 'Arco Longo', 'Arco Composto', 'Arco Élfico', 'Arco da Tempestade', 'Arco das Dunas'],
  berserker: ['Machadinha', 'Machado de Guerra', 'Machado de Ferro Negro', 'Machado do Carniceiro', 'Machado Rúnico', 'Fendedor das Cinzas', 'Machado do Sol'],
  cleric: ['Maça de Madeira', 'Maça de Ferro', 'Martelo Sagrado', 'Cetro da Aurora', 'Martelo Celestial', 'Relíquia da Chama', 'Cetro do Oásis'],
};
const WEAPON_ICON = { warrior: 'sword', berserker: 'axe', mage: 'staff', ranger: 'bow', cleric: 'mace' };
const PREFIX = { warrior: 'w', berserker: 'b', mage: 'm', ranger: 'r', cleric: 'c' };
const TIER_COLORS = ['#a0a0a0', '#b87333', '#5d6d7e', '#aab7b8', '#76d7c4', '#e74c3c', '#f4d03f'];

for (const cls of Object.keys(WEAPON_NAMES)) {
  WEAPON_TIERS.forEach((lvl, i) => {
    add({
      id: `${PREFIX[cls]}_weapon_${i + 1}`,
      name: WEAPON_NAMES[cls][i],
      type: 'weapon', slot: 'weapon', cls, lvl, tier: i + 1,
      dmg: Math.round(6 + lvl * 2.6),
      price: Math.round(20 + lvl * lvl * 8),
      icon: { shape: WEAPON_ICON[cls], c1: TIER_COLORS[i], c2: '#5a3d1e' },
    });
  });
}

// ---------------- Armaduras ----------------
const ARMOR_TIERS = [1, 6, 12, 18, 24, 30];
const ARMOR_MATS = ['Couro', 'Bronze', 'Ferro', 'Mithril', 'Dracônico', 'Solar'];
const ARMOR_MAT_COLORS = ['#8b5a2b', '#cd7f32', '#7f8c8d', '#a9cce3', '#922b21', '#f1c40f'];
const ARMOR_SLOTS = {
  head: { names: ['Capuz', 'Elmo', 'Elmo', 'Elmo', 'Elmo', 'Elmo'], mult: 0.6, icon: 'helm', hp: 1 },
  chest: { names: ['Gibão', 'Peitoral', 'Peitoral', 'Peitoral', 'Peitoral', 'Peitoral'], mult: 1.0, icon: 'chest', hp: 3 },
  legs: { names: ['Calças', 'Grevas', 'Grevas', 'Grevas', 'Grevas', 'Grevas'], mult: 0.8, icon: 'legs', hp: 2 },
  feet: { names: ['Botas', 'Botas', 'Botas', 'Botas', 'Botas', 'Botas'], mult: 0.5, icon: 'boots', hp: 1 },
};
function matSuffix(i, slotName) {
  const m = ARMOR_MATS[i];
  // "Dracônico" concorda com o substantivo
  if (m === 'Dracônico') return ['Grevas', 'Botas', 'Calças'].includes(slotName) ? 'Dracônicas' : 'Dracônico';
  if (m === 'Solar') return ['Grevas', 'Botas', 'Calças'].includes(slotName) ? 'Solares' : 'Solar';
  return `de ${m}`;
}
for (const [slot, info] of Object.entries(ARMOR_SLOTS)) {
  ARMOR_TIERS.forEach((lvl, i) => {
    const n = info.names[i];
    add({
      id: `${slot}_${i + 1}`,
      name: `${n} ${matSuffix(i, n)}`,
      type: 'armor', slot, lvl, tier: i + 1,
      def: Math.max(1, Math.round((2 + lvl * 1.1) * info.mult)),
      base: { hp: Math.round(lvl * info.hp + info.hp * 4) },
      price: Math.round(15 + lvl * lvl * 5 * info.mult),
      icon: { shape: info.icon, c1: ARMOR_MAT_COLORS[i], c2: '#2c2c2c' },
    });
  });
}

// ---------------- Acessórios ----------------
const ACC_TIERS = [1, 8, 16, 24, 30];
const RING_NAMES = ['Anel de Cobre', 'Anel de Prata', 'Anel de Ouro', 'Anel Rúnico', 'Anel do Sol'];
const AMULET_NAMES = ['Amuleto de Osso', 'Amuleto de Prata', 'Amuleto de Jade', 'Amuleto Rúnico', 'Escaravelho Sagrado'];
const ACC_COLORS = ['#b87333', '#d5dbdb', '#f4d03f', '#5dade2', '#f5b041'];
ACC_TIERS.forEach((lvl, i) => {
  add({
    id: `ring_${i + 1}`, name: RING_NAMES[i], type: 'accessory', slot: 'ring', lvl, tier: i + 1,
    base: { power: Math.round(2 + lvl * 0.7) },
    price: Math.round(40 + lvl * lvl * 7),
    icon: { shape: 'ring', c1: ACC_COLORS[i], c2: '#c0392b' },
  });
  add({
    id: `amulet_${i + 1}`, name: AMULET_NAMES[i], type: 'accessory', slot: 'amulet', lvl, tier: i + 1,
    base: { hp: Math.round(15 + lvl * 7) },
    price: Math.round(40 + lvl * lvl * 7),
    icon: { shape: 'amulet', c1: ACC_COLORS[i], c2: '#16a085' },
  });
});

// ---------------- Lendários únicos ----------------
add({
  id: 'u_boar_tusk', name: 'Presa de Ferro', type: 'accessory', slot: 'amulet', lvl: 6, unique: true,
  base: { hp: 70 }, fixed: { str: 5, vit: 6, def: 5, power: 4 }, price: 600,
  desc: 'Arrancada do Javali Ancião. Ainda pulsa com sua teimosia.',
  icon: { shape: 'tusk', c1: '#f0e6d2', c2: '#7f8c8d' },
});
add({
  id: 'u_vexara_crown', name: 'Coroa da Tecelã', type: 'armor', slot: 'head', lvl: 12, unique: true,
  def: 12, base: { hp: 40 }, fixed: { int: 9, dex: 9, crit: 4, mp: 50 }, price: 1500,
  desc: 'Fios de seda e prata. Vex\'ara a usava antes de esquecer o próprio nome.',
  icon: { shape: 'crown', c1: '#bb8fce', c2: '#4a235a' },
});
add({
  id: 'u_kragmor_heart', name: 'Coração de Kragmor', type: 'accessory', slot: 'amulet', lvl: 18, unique: true,
  base: { hp: 160 }, fixed: { vit: 16, def: 18, str: 8 }, price: 3000,
  desc: 'Uma pedra viva entalhada pelos anões. Bate devagar, como uma montanha que respira.',
  icon: { shape: 'heart', c1: '#e67e22', c2: '#6e2c00' },
});
add({
  id: 'u_ashen_crown', name: 'Coroa Cinzenta', type: 'armor', slot: 'head', lvl: 25, unique: true,
  def: 30, base: { hp: 120 }, fixed: { str: 12, dex: 12, int: 12, vit: 12, power: 15, crit: 5 }, price: 8000,
  desc: 'A coroa de Morvath. Sussurra promessas que você prefere não ouvir.',
  icon: { shape: 'crown', c1: '#7b7d7d', c2: '#c0392b' },
});
add({
  id: 'u_flame_amulet', name: 'Coração da Chama', type: 'accessory', slot: 'amulet', lvl: 20, unique: true,
  base: { hp: 250 }, fixed: { str: 10, dex: 10, int: 10, vit: 10, lifesteal: 3, speed: 5 }, price: 10000,
  desc: 'Uma centelha da Chama Primordial reacendida. Concedida apenas aos Portadores.',
  icon: { shape: 'brasa', c1: '#ffd54f', c2: '#ff6f00' },
});
add({
  id: 'u_scorpion_sting', name: 'Ferrão da Rainha', type: 'accessory', slot: 'ring', lvl: 28, unique: true,
  base: { power: 30 }, fixed: { dex: 14, crit: 8, haste: 6, speed: 4 }, price: 9000,
  desc: 'O ferrão de Skorvax, ainda pingando veneno dourado. Cada golpe encontra o ponto fraco.',
  icon: { shape: 'tusk', c1: '#e59866', c2: '#6e2c00' },
});
add({
  id: 'u_sun_crown', name: 'Coroa do Rei-Sol', type: 'armor', slot: 'head', lvl: 30, unique: true,
  def: 38, base: { hp: 160 }, fixed: { str: 14, dex: 14, int: 14, vit: 14, power: 18, crit: 6, mp: 100 }, price: 15000,
  desc: 'O ouro de Amun-Kheb nunca esfriou. Quem a usa sente o sol nascer dentro do peito.',
  icon: { shape: 'crown', c1: '#f4d03f', c2: '#e67e22' },
});
add({
  id: 'u_pharaoh_scarab', name: 'Escaravelho de Amun-Kheb', type: 'accessory', slot: 'amulet', lvl: 30, unique: true,
  base: { hp: 320 }, fixed: { vit: 14, def: 20, int: 12, lifesteal: 4, speed: 6 }, price: 14000,
  desc: 'Um escaravelho de ouro que guardava o coração do rei. Ainda bate, devagar, no ritmo das dunas.',
  icon: { shape: 'brasa', c1: '#f5b041', c2: '#1e8449' },
});
const LEGEND_WEAPONS = {
  warrior: ['Lâmina da Aurora', { str: 18, vit: 10, crit: 6, lifesteal: 4 }],
  berserker: ['Machado do Alvorecer', { str: 22, dex: 6, crit: 9, lifesteal: 6 }],
  mage: ['Cajado da Chama Eterna', { int: 20, mp: 120, crit: 7, haste: 8 }],
  ranger: ['Arco do Alvorecer', { dex: 20, crit: 10, haste: 10 }],
  cleric: ['Martelo de Lúmen', { int: 18, vit: 12, hp: 150, mp: 80 }],
};
for (const [cls, [name, fixed]] of Object.entries(LEGEND_WEAPONS)) {
  add({
    id: `u_${cls}_legend`, name, type: 'weapon', slot: 'weapon', cls, lvl: 25, unique: true,
    dmg: 92, fixed, price: 12000,
    desc: 'Forjada na luz da Chama Primordial, tomada de Morvath em sua queda.',
    icon: { shape: WEAPON_ICON[cls], c1: '#ffd54f', c2: '#ff6f00' },
  });
}

// ---------------- Consumíveis ----------------
const pot = (id, name, lvl, use, price, c1, desc) =>
  add({ id, name, type: 'consumable', lvl, stack: true, use, price, icon: { shape: 'potion', c1, c2: '#ecf0f1' }, desc });
pot('pot_hp_1', 'Poção de Vida Menor', 1, { hp: 70 }, 15, '#e74c3c', 'Restaura 70 de vida.');
pot('pot_hp_2', 'Poção de Vida', 8, { hp: 200 }, 45, '#c0392b', 'Restaura 200 de vida.');
pot('pot_hp_3', 'Poção de Vida Maior', 15, { hp: 450 }, 110, '#922b21', 'Restaura 450 de vida.');
pot('pot_hp_4', 'Poção de Vida Suprema', 22, { hp: 900 }, 240, '#641e16', 'Restaura 900 de vida.');
pot('pot_mp_1', 'Poção de Mana Menor', 1, { mp: 50 }, 15, '#3498db', 'Restaura 50 de mana.');
pot('pot_mp_2', 'Poção de Mana', 8, { mp: 130 }, 45, '#2471a3', 'Restaura 130 de mana.');
pot('pot_mp_3', 'Poção de Mana Maior', 15, { mp: 300 }, 110, '#1a5276', 'Restaura 300 de mana.');
add({
  id: 'scroll_return', name: 'Pergaminho de Retorno', type: 'consumable', lvl: 1, stack: true,
  use: { recall: true }, price: 30, desc: 'Após 3s de concentração, transporta você para a capital do reino onde está (Alvorada ou Zahrim). Interrompido por dano ou movimento.',
  icon: { shape: 'scroll', c1: '#f5e6c8', c2: '#2e86c1' },
});
const elixir = (id, name, buff, price, c1, desc) =>
  add({ id, name, type: 'consumable', lvl: 1, stack: true, use: { buff }, price, icon: { shape: 'elixir', c1, c2: '#f4d03f' }, desc });
elixir('elixir_str', 'Elixir do Gigante', { id: 'elixir_power', power: 0.15, dur: 600 }, 150, '#e67e22', '+15% de Poder por 10 minutos.');
elixir('elixir_def', 'Elixir da Pedra', { id: 'elixir_def', def: 0.2, dur: 600 }, 150, '#7f8c8d', '+20% de Defesa por 10 minutos.');
elixir('elixir_xp', 'Tônico da Sabedoria', { id: 'elixir_xp', xp: 0.25, dur: 900 }, 250, '#8e44ad', '+25% de experiência por 15 minutos.');
elixir('elixir_speed', 'Infusão do Vento', { id: 'elixir_speed', speed: 0.15, dur: 600 }, 120, '#48c9b0', '+15% de velocidade de movimento por 10 minutos.');

// ---------------- Materiais ----------------
const mat = (id, name, price, shape, c1, desc) =>
  add({ id, name, type: 'material', lvl: 1, stack: true, price, icon: { shape, c1, c2: '#222' }, desc });
mat('mat_slime', 'Gosma Viscosa', 3, 'slime', '#58d68d', 'Gelatina pegajosa de uma Gosma Verde. Usada em poções.');
mat('mat_pelt', 'Pele de Lobo', 5, 'pelt', '#95a5a6', 'Pele grossa e quente.');
mat('mat_tusk', 'Presa de Javali', 6, 'tusk', '#f0e6d2', 'Dura como pedra.');
mat('mat_herb', 'Erva Lunar', 6, 'herb', '#76d7c4', 'Floresce apenas sob o luar. Base de muitas poções.');
mat('mat_cloth', 'Retalho Goblin', 6, 'cloth', '#a04000', 'Pano sujo e remendado.');
mat('mat_silk', 'Seda de Aranha', 9, 'silk', '#ecf0f1', 'Fio resistente e brilhante.');
mat('mat_bark', 'Casca Corrompida', 10, 'bark', '#6e2c00', 'Casca de um Ent tocado pela Névoa.');
mat('mat_wing', 'Asa de Morcego', 10, 'wing', '#5d6d7e', 'Membrana fina e escura.');
mat('mat_bone', 'Osso Antigo', 12, 'bone', '#f5eef8', 'Restos de um mineiro amaldiçoado.');
mat('mat_ore', 'Minério de Ferro Negro', 15, 'ore', '#34495e', 'Metal escuro das profundezas.');
mat('mat_crystal', 'Cristal Sombrio', 20, 'crystal', '#8e44ad', 'Vibra com uma energia fria.');
mat('mat_essence', 'Essência do Vazio', 25, 'essence', '#5b2c6f', 'Fumaça que não se dissipa.');
mat('mat_ash', 'Cinza Ardente', 25, 'ash', '#e74c3c', 'Brasa que se recusa a esfriar.');
mat('mat_venom', 'Veneno de Escorpião', 28, 'essence', '#e59866', 'Gota dourada e viscosa. Alquimistas pagam bem por ela.');
mat('mat_chitin', 'Quitina Dourada', 30, 'bark', '#d4a017', 'Carapaça de escorpião gigante, dura como metal.');
mat('mat_linen', 'Linho Embalsamado', 30, 'cloth', '#e8dcc0', 'Faixas de múmia ainda impregnadas de resinas antigas.');
mat('mat_scarab', 'Escaravelho de Ouro', 40, 'gem', '#f5b041', 'Amuleto de ouro maciço que os reis-sol levavam para o além.');
mat('mat_ember', 'Fagulha da Chama', 120, 'ember', '#f7dc6f', 'Um fragmento minúsculo da Chama Primordial. Raríssimo.');
add({
  id: 'enh_stone', name: 'Pedra de Aprimoramento', type: 'material', lvl: 1, stack: true, price: 250,
  desc: 'Usada pela ferreira para aprimorar equipamentos.',
  icon: { shape: 'gem', c1: '#5dade2', c2: '#f4d03f' },
});

// ---------------- Itens de missão ----------------
const qi = (id, name, shape, c1, desc) =>
  add({ id, name, type: 'quest', lvl: 1, stack: true, price: 0, icon: { shape, c1, c2: '#f1c40f' }, desc });
qi('q_supplies', 'Suprimentos Roubados', 'sack', '#ca6f1e', 'Caixas de comida e remédios roubadas da cidade.');
qi('q_miner_tag', 'Plaqueta de Mineiro', 'tag', '#d4ac0d', 'Uma plaqueta de identificação com um nome gravado.');
qi('q_sigil', 'Sigilo Velado', 'sigil', '#7d3c98', 'O símbolo dos Velados: um olho fechado envolto em névoa.');
qi('q_brasa_vida', 'Brasa da Vida', 'brasa', '#58d68d', 'Um fragmento verde e quente da Chama Primordial.');
qi('q_brasa_terra', 'Brasa da Terra', 'brasa', '#e67e22', 'Um fragmento âmbar e pesado da Chama Primordial.');
qi('q_brasa_espirito', 'Brasa do Espírito', 'brasa', '#85c1e9', 'Um fragmento azul e etéreo da Chama Primordial.');
qi('q_nest_egg', 'Ovo Dourado', 'gem', '#f5b041', 'Um ovo de escorpião, quente ao toque e brilhante como uma brasa.');
qi('q_water_flask', 'Odre do Oásis', 'sack', '#5dade2', 'Um odre de couro, cheio da água fria e doce do Oásis de Karim.');
qi('q_sun_tablet', 'Tábua Solar', 'sigil', '#f4d03f', 'Uma tábua de ouro com glifos do sol: o selo que mantém os reis dormindo.');
qi('q_stinger_seal', 'Selo do Ninho', 'tag', '#c0392b', 'Um selo de cera vermelha arrancado de um escorpião carregador de mensagens.');
qi('q_letter', 'Carta Selada de Osric', 'scroll', '#f5e6c8', 'Uma carta selada com cera verde, endereçada à druida Sylvara.');

export function getItem(id) {
  return ITEMS[id];
}

export function isEquipment(base) {
  return base && (base.type === 'weapon' || base.type === 'armor' || base.type === 'accessory');
}
