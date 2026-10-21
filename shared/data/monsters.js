// Bestiário de Aethra. hp/dmg/def são multiplicadores sobre a curva base por nível.
// aggro: alcance de percepção (0 = passivo até ser atacado).

export const MONSTERS = {
  // ---------- Campos Verdejantes ----------
  slime: {
    id: 'slime', name: 'Gosma Verde', lvl: [1, 2], hp: 0.7, dmg: 0.55, def: 0.5,
    speed: 1.8, aggro: 0, atkRange: 1.1, atkInterval: 1.8, sprite: 'slime', color: '#58d68d', size: 0.8,
    gold: [1, 3], equipChance: 0.05,
    drops: [{ id: 'mat_slime', chance: 0.5 }, { id: 'pot_hp_1', chance: 0.06 }],
    lore: 'Gelatina animada pela Névoa Cinzenta. Inofensiva sozinha, irritante em bando.',
  },
  slime_red: {
    id: 'slime_red', name: 'Gosma Rubra', lvl: [2, 3], hp: 0.8, dmg: 0.7, def: 0.6,
    speed: 2.0, aggro: 4, atkRange: 1.1, atkInterval: 1.7, sprite: 'slime', color: '#ec7063', size: 0.85,
    gold: [2, 4], equipChance: 0.06,
    drops: [{ id: 'mat_slime', chance: 0.5 }, { id: 'pot_hp_1', chance: 0.08 }],
  },
  wolf: {
    id: 'wolf', name: 'Lobo Cinzento', lvl: [3, 5], hp: 0.9, dmg: 0.8, def: 0.8,
    speed: 3.6, aggro: 5.5, atkRange: 1.3, atkInterval: 1.4, sprite: 'wolf', color: '#85929e', size: 1,
    gold: [2, 6], equipChance: 0.07,
    drops: [{ id: 'mat_pelt', chance: 0.45 }, { id: 'mat_herb', chance: 0.08 }],
    lore: 'Os lobos das colinas ficaram mais ferozes desde que a Névoa chegou. Seus olhos brilham em cinza.',
  },
  boar: {
    id: 'boar', name: 'Javali Selvagem', lvl: [4, 6], hp: 1.2, dmg: 0.85, def: 1.0,
    speed: 3.0, aggro: 0, atkRange: 1.3, atkInterval: 1.6, sprite: 'boar', color: '#795548', size: 1.05,
    gold: [3, 8], equipChance: 0.08,
    drops: [{ id: 'mat_tusk', chance: 0.45 }, { id: 'mat_herb', chance: 0.1 }],
    abilities: [{ type: 'charge', cd: 9, range: 6, mult: 1.4, delay: 0.7, radius: 1.3 }],
  },
  boar_boss: {
    id: 'boar_boss', name: 'Presa-de-Ferro', title: 'O Javali Ancião', lvl: [7, 7], hp: 9, dmg: 1.15, def: 1.4,
    speed: 3.2, aggro: 7, atkRange: 1.8, atkInterval: 1.7, sprite: 'boar', color: '#4e342e', size: 1.9,
    boss: true, respawn: 180, leash: 18, xpMult: 8,
    gold: [40, 80], equipDrops: 2, uniqueDrop: { id: 'u_boar_tusk', chance: 0.3 },
    drops: [{ id: 'mat_tusk', chance: 1, qty: [2, 4] }, { id: 'pot_hp_2', chance: 0.5, qty: [1, 3] }, { id: 'enh_stone', chance: 0.25 }],
    abilities: [
      { type: 'stomp', cd: 9, radius: 3.2, delay: 1.3, mult: 1.6, stun: 1.0 },
      { type: 'charge', cd: 7, range: 9, mult: 1.8, delay: 1.0, radius: 1.8, stun: 0.8 },
      { type: 'enrage', at: 0.3, haste: 0.5, yell: 'Presa-de-Ferro bufa e seus olhos ficam vermelhos de fúria!' },
    ],
    lore: 'O guardião ancestral das colinas, corrompido pela Névoa. Suas presas foram revestidas de ferro por caçadores que nunca voltaram.',
  },

  // ---------- Floresta Sussurrante ----------
  goblin: {
    id: 'goblin', name: 'Goblin Saqueador', lvl: [6, 8], hp: 1.0, dmg: 0.95, def: 0.9,
    speed: 3.3, aggro: 6, atkRange: 1.2, atkInterval: 1.3, sprite: 'goblin', color: '#7dcea0', size: 0.85,
    gold: [4, 10], equipChance: 0.09,
    drops: [{ id: 'mat_cloth', chance: 0.4 }, { id: 'pot_hp_1', chance: 0.08 }],
    questDrops: [{ id: 'q_supplies', chance: 0.5, quest: 'ms7' }],
  },
  goblin_shaman: {
    id: 'goblin_shaman', name: 'Goblin Xamã', lvl: [7, 9], hp: 0.8, dmg: 1.0, def: 0.7,
    speed: 3.0, aggro: 7, atkRange: 6, atkInterval: 2.0, proj: 'shadow', sprite: 'goblin_shaman', color: '#52be80', size: 0.85,
    gold: [5, 12], equipChance: 0.1,
    drops: [{ id: 'mat_cloth', chance: 0.3 }, { id: 'mat_herb', chance: 0.25 }, { id: 'pot_mp_1', chance: 0.1 }],
    questDrops: [{ id: 'q_supplies', chance: 0.5, quest: 'ms7' }],
    abilities: [{ type: 'healAlly', cd: 8, radius: 7, pct: 0.25 }],
  },
  spider: {
    id: 'spider', name: 'Aranha Tecelã', lvl: [8, 10], hp: 1.0, dmg: 1.0, def: 0.9,
    speed: 3.6, aggro: 5, atkRange: 1.3, atkInterval: 1.4, sprite: 'spider', color: '#6c3483', size: 1,
    gold: [5, 12], equipChance: 0.09,
    drops: [{ id: 'mat_silk', chance: 0.5 }, { id: 'mat_herb', chance: 0.1 }],
    abilities: [{ type: 'poisonHit', chance: 0.3, dps: 0.25, dur: 4 }],
  },
  ent: {
    id: 'ent', name: 'Ent Corrompido', lvl: [10, 12], hp: 2.0, dmg: 1.2, def: 1.3,
    speed: 2.0, aggro: 4, atkRange: 1.8, atkInterval: 2.0, sprite: 'ent', color: '#5d4037', size: 1.6,
    gold: [8, 18], equipChance: 0.14,
    drops: [{ id: 'mat_bark', chance: 0.55 }, { id: 'mat_herb', chance: 0.3 }],
    abilities: [{ type: 'root', cd: 10, range: 6, dur: 2 }],
    lore: 'Antigos protetores da floresta. A Névoa apodreceu suas raízes e suas mentes.',
  },
  spiderling: {
    id: 'spiderling', name: 'Filhote de Tecelã', lvl: [11, 11], hp: 0.35, dmg: 0.6, def: 0.5,
    speed: 4.0, aggro: 15, atkRange: 1.1, atkInterval: 1.1, sprite: 'spider', color: '#a569bd', size: 0.55,
    gold: [0, 1], equipChance: 0, summon: true, xpMult: 0.3, drops: [],
  },
  vexara: {
    id: 'vexara', name: "Vex'ara", title: 'A Rainha Tecelã', lvl: [13, 13], hp: 12, dmg: 1.2, def: 1.3,
    speed: 3.0, aggro: 8, atkRange: 2.0, atkInterval: 1.6, sprite: 'spider_queen', color: '#4a235a', size: 2.4,
    boss: true, respawn: 240, leash: 20, xpMult: 10,
    gold: [100, 180], equipDrops: 2, uniqueDrop: { id: 'u_vexara_crown', chance: 0.3 },
    drops: [{ id: 'mat_silk', chance: 1, qty: [3, 6] }, { id: 'enh_stone', chance: 0.4 }, { id: 'mat_ember', chance: 0.15 }],
    questDrops: [{ id: 'q_brasa_vida', chance: 1, quest: 'ms9' }],
    abilities: [
      { type: 'root', cd: 9, range: 9, dur: 2, mult: 0.8 },
      { type: 'pools', cd: 11, radius: 1.8, delay: 1.3, mult: 1.3, poison: 0.2, poisonDur: 4 },
      { type: 'stomp', cd: 14, radius: 4, delay: 1.6, mult: 1.5, poison: 0.25, poisonDur: 5, name: 'Nova Venenosa' },
      { type: 'summon', at: [0.75, 0.5, 0.25], m: 'spiderling', n: 3, yell: 'Meus filhos... devorem-nos!' },
    ],
    lore: 'Outrora a druida Vexa, irmã de Sylvara. Morvath a transformou em uma rainha-aranha e lhe confiou a Brasa da Vida.',
  },

  // ---------- Minas de Ferro Negro ----------
  bat: {
    id: 'bat', name: 'Morcego das Cavernas', lvl: [12, 13], hp: 0.7, dmg: 0.9, def: 0.6,
    speed: 4.4, aggro: 7, atkRange: 1.2, atkInterval: 1.2, sprite: 'bat', color: '#5d6d7e', size: 0.8, flying: true,
    gold: [6, 14], equipChance: 0.08,
    drops: [{ id: 'mat_wing', chance: 0.45 }],
  },
  skeleton: {
    id: 'skeleton', name: 'Esqueleto Mineiro', lvl: [13, 15], hp: 1.1, dmg: 1.0, def: 1.1,
    speed: 3.0, aggro: 6, atkRange: 1.4, atkInterval: 1.5, sprite: 'skeleton', color: '#f2f3f4', size: 1, undead: true,
    gold: [8, 18], equipChance: 0.1,
    drops: [{ id: 'mat_bone', chance: 0.45 }, { id: 'mat_ore', chance: 0.1 }],
    questDrops: [{ id: 'q_miner_tag', chance: 0.45, quest: 'ms12' }],
  },
  skeleton_archer: {
    id: 'skeleton_archer', name: 'Esqueleto Arqueiro', lvl: [14, 16], hp: 0.85, dmg: 1.0, def: 0.9,
    speed: 2.8, aggro: 8, atkRange: 7, atkInterval: 1.9, proj: 'arrow', sprite: 'skeleton_archer', color: '#e5e7e9', size: 1, undead: true,
    gold: [8, 18], equipChance: 0.1,
    drops: [{ id: 'mat_bone', chance: 0.4 }],
    questDrops: [{ id: 'q_miner_tag', chance: 0.4, quest: 'ms12' }],
  },
  golem: {
    id: 'golem', name: 'Golem de Pedra', lvl: [16, 17], hp: 2.1, dmg: 1.25, def: 2.0,
    speed: 2.1, aggro: 4, atkRange: 1.8, atkInterval: 2.1, sprite: 'golem', color: '#7f8c8d', size: 1.5,
    gold: [12, 25], equipChance: 0.14,
    drops: [{ id: 'mat_ore', chance: 0.6, qty: [1, 2] }, { id: 'mat_crystal', chance: 0.25 }],
    abilities: [{ type: 'stomp', cd: 12, radius: 2.5, delay: 1.2, mult: 1.3, stun: 0.8 }],
  },
  kragmor: {
    id: 'kragmor', name: 'Kragmor', title: 'O Coração da Montanha', lvl: [19, 19], hp: 12, dmg: 1.3, def: 1.6,
    speed: 2.4, aggro: 8, atkRange: 2.4, atkInterval: 2.0, sprite: 'golem_boss', color: '#566573', size: 2.8,
    boss: true, respawn: 240, leash: 20, xpMult: 12,
    gold: [200, 350], equipDrops: 3, uniqueDrop: { id: 'u_kragmor_heart', chance: 0.3 },
    drops: [{ id: 'mat_ore', chance: 1, qty: [4, 7] }, { id: 'mat_crystal', chance: 1, qty: [2, 3] }, { id: 'enh_stone', chance: 0.6 }, { id: 'mat_ember', chance: 0.25 }],
    questDrops: [{ id: 'q_brasa_terra', chance: 1, quest: 'ms14' }],
    abilities: [
      { type: 'stomp', cd: 13, radius: 5.5, delay: 2.0, mult: 2.0, stun: 1.5, name: 'Terremoto' },
      { type: 'pools', cd: 8, radius: 2.2, delay: 1.5, mult: 1.6, name: 'Pedregulho', style: 'rock' },
      { type: 'harden', at: 0.5, cd: 22, dr: 0.6, dur: 6, yell: 'A pele de Kragmor se cobre de cristais!' },
      { type: 'enrage', at: 0.25, haste: 0.6, yell: 'KRAGMOR... NÃO... CAIRÁ!' },
    ],
    lore: 'Um golem colossal construído pelos anões para proteger as minas. Morvath enterrou a Brasa da Terra em seu peito.',
  },

  // ---------- Ruínas de Cinza ----------
  cultist: {
    id: 'cultist', name: 'Cultista Velado', lvl: [18, 20], hp: 1.0, dmg: 1.1, def: 1.0,
    speed: 3.0, aggro: 7, atkRange: 6, atkInterval: 1.9, proj: 'shadow', sprite: 'cultist', color: '#4a235a', size: 1, voidborn: true,
    gold: [12, 25], equipChance: 0.12,
    drops: [{ id: 'mat_essence', chance: 0.3 }, { id: 'pot_mp_2', chance: 0.1 }],
    questDrops: [{ id: 'q_sigil', chance: 0.5, quest: 'ms16' }],
    abilities: [{ type: 'pools', cd: 12, radius: 1.6, delay: 1.4, mult: 1.2, style: 'void' }],
  },
  wraith: {
    id: 'wraith', name: 'Espectro Cinzento', lvl: [20, 22], hp: 1.1, dmg: 1.1, def: 0.9,
    speed: 3.4, aggro: 6, atkRange: 1.4, atkInterval: 1.5, sprite: 'wraith', color: '#aab7b8', size: 1.1, undead: true, flying: true,
    gold: [14, 28], equipChance: 0.12,
    drops: [{ id: 'mat_essence', chance: 0.4 }],
    abilities: [{ type: 'drain', pct: 0.5 }],
  },
  ash_knight: {
    id: 'ash_knight', name: 'Cavaleiro das Cinzas', lvl: [22, 24], hp: 1.7, dmg: 1.3, def: 1.6,
    speed: 2.8, aggro: 6, atkRange: 1.8, atkInterval: 1.8, sprite: 'ash_knight', color: '#2c3e50', size: 1.3, voidborn: true,
    gold: [20, 40], equipChance: 0.16,
    drops: [{ id: 'mat_ash', chance: 0.5 }, { id: 'mat_essence', chance: 0.15 }, { id: 'enh_stone', chance: 0.03 }],
    abilities: [{ type: 'stomp', cd: 9, radius: 2.4, delay: 1.0, mult: 1.6, name: 'Golpe Giratório', burn: 0.15, burnDur: 3 }],
  },
  morvath: {
    id: 'morvath', name: 'Morvath', title: 'O Rei Cinzento', lvl: [26, 26], hp: 20, dmg: 1.35, def: 1.5,
    speed: 3.0, aggro: 10, atkRange: 7, atkInterval: 2.0, proj: 'ash', sprite: 'morvath', color: '#5d6d7e', size: 2.4,
    boss: true, respawn: 300, leash: 24, xpMult: 16, voidborn: true, flying: true,
    gold: [600, 1000], equipDrops: 4, uniqueDrop: { id: 'u_ashen_crown', chance: 0.3 },
    legendWeapon: 0.5,
    drops: [{ id: 'mat_ember', chance: 1, qty: [1, 2] }, { id: 'enh_stone', chance: 1, qty: [1, 2] }, { id: 'mat_essence', chance: 1, qty: [3, 5] }],
    questDrops: [{ id: 'q_brasa_espirito', chance: 1, quest: 'ms18' }],
    abilities: [
      { type: 'pools', cd: 8, radius: 2.2, delay: 1.4, mult: 1.6, burn: 0.15, burnDur: 3, name: 'Círculos de Cinza', style: 'fire' },
      { type: 'summon', at: [0.7], m: 'cultist', n: 3, yell: 'Velados! Defendam seu rei!' },
      { type: 'summon', at: [0.4], m: 'wraith', n: 3, yell: 'Os mortos de Lúmen servem a mim agora!' },
      { type: 'blink', at: [0.6, 0.3], yell: 'Vocês lutam contra o inevitável. O Vazio já venceu.' },
      { type: 'stomp', cd: 16, radius: 6.5, delay: 2.4, mult: 2.4, name: 'Nova do Vazio', style: 'void' },
      { type: 'meteors', cd: 7, phase: 0.3, count: 7, spread: 9, radius: 2, delay: 1.5, mult: 1.6, name: 'Chuva de Cinzas' },
      { type: 'enrage', at: 0.3, haste: 0.5, yell: 'Se eu não posso ter a Chama, NINGUÉM TERÁ!' },
    ],
    lore: 'O Sumo-Guardião que traiu a Ordem. Acreditava que a Chama estava morrendo e que só fundindo-se ao Vazio poderia salvar Aethra. Estava errado.',
  },
};

export function monsterLevelRange(id) {
  const m = MONSTERS[id];
  return m ? m.lvl : [1, 1];
}
