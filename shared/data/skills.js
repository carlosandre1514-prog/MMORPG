// Habilidades de classe. Os efeitos são executados no servidor (server/systems/skills.js);
// aqui ficam os números e textos usados pelos dois lados.
// target: enemy (inimigo alvo), ally (aliado alvo ou você), self, ground (posição do cursor), dir (direção do cursor)

export const SKILLS = {
  // ---------------- Guerreiro ----------------
  w_strike: {
    id: 'w_strike', cls: 'warrior', name: 'Golpe Poderoso', lvl: 1, mp: 8, cd: 5, range: 2.0,
    target: 'enemy', mult: 2.1,
    desc: 'Um golpe brutal que causa 210% do seu Poder.',
    icon: { sym: 'sword', c1: '#e74c3c', c2: '#7b241c' },
  },
  w_cry: {
    id: 'w_cry', cls: 'warrior', name: 'Grito de Guerra', lvl: 3, mp: 15, cd: 18, range: 0,
    target: 'self', radius: 4.5, dur: 6, dr: 0.3, tauntDur: 4,
    desc: 'Provoca todos os inimigos próximos, forçando-os a atacar você, e reduz o dano recebido em 30% por 6s.',
    icon: { sym: 'shout', c1: '#f39c12', c2: '#7e5109' },
  },
  w_charge: {
    id: 'w_charge', cls: 'warrior', name: 'Investida', lvl: 6, mp: 12, cd: 12, range: 9,
    target: 'enemy', mult: 1.3, stun: 1.5,
    desc: 'Avança até o alvo, causando 130% do Poder e atordoando por 1,5s.',
    icon: { sym: 'charge', c1: '#d35400', c2: '#6e2c00' },
  },
  w_whirl: {
    id: 'w_whirl', cls: 'warrior', name: 'Redemoinho', lvl: 10, mp: 20, cd: 8, range: 0,
    target: 'self', radius: 2.8, mult: 1.7,
    desc: 'Gira com a arma, causando 170% do Poder a todos os inimigos ao redor.',
    icon: { sym: 'whirl', c1: '#bdc3c7', c2: '#566573' },
  },
  w_titan: {
    id: 'w_titan', cls: 'warrior', name: 'Fúria do Titã', lvl: 15, mp: 30, cd: 60, range: 0,
    target: 'self', dur: 12, power: 0.4, lifesteal: 15,
    desc: 'Entra em fúria por 12s: +40% de Poder e 15% de roubo de vida.',
    icon: { sym: 'fury', c1: '#ff5733', c2: '#900c3f' },
  },
  w_exec: {
    id: 'w_exec', cls: 'warrior', name: 'Execução', lvl: 20, mp: 25, cd: 14, range: 2.0,
    target: 'enemy', mult: 3.0, execMult: 6.0, execPct: 0.3,
    desc: 'Golpe final: 300% do Poder, ou 600% se o alvo estiver abaixo de 30% de vida.',
    icon: { sym: 'axe', c1: '#922b21', c2: '#1b0907' },
  },

  // ---------------- Mago ----------------
  m_fire: {
    id: 'm_fire', cls: 'mage', name: 'Bola de Fogo', lvl: 1, mp: 10, cd: 3, range: 8.5,
    target: 'enemy', mult: 1.8, burn: 0.15, burnDur: 4, proj: 'fire', speed: 14,
    desc: 'Lança uma bola de fogo: 180% do Poder e queimadura de 15% do Poder por segundo durante 4s.',
    icon: { sym: 'fire', c1: '#ff9f1a', c2: '#c0392b' },
  },
  m_frost: {
    id: 'm_frost', cls: 'mage', name: 'Lança de Gelo', lvl: 3, mp: 12, cd: 6, range: 8.5,
    target: 'enemy', mult: 1.5, slow: 0.5, slowDur: 3, proj: 'frost', speed: 16,
    desc: 'Dispara uma lança de gelo: 150% do Poder e reduz a velocidade do alvo em 50% por 3s.',
    icon: { sym: 'frost', c1: '#aee8ff', c2: '#2874a6' },
  },
  m_shield: {
    id: 'm_shield', cls: 'mage', name: 'Escudo Arcano', lvl: 6, mp: 25, cd: 20, range: 0,
    target: 'self', dur: 10,
    desc: 'Cria um escudo que absorve 25 + 3×Inteligência + 6×Nível de dano por 10s.',
    icon: { sym: 'shield', c1: '#a569bd', c2: '#4a235a' },
  },
  m_meteor: {
    id: 'm_meteor', cls: 'mage', name: 'Chuva de Meteoros', lvl: 10, mp: 35, cd: 14, range: 10,
    target: 'ground', radius: 3, delay: 1.0, mult: 2.6, burn: 0.12, burnDur: 3,
    desc: 'Invoca meteoros na área alvo: após 1s causa 260% do Poder a todos os inimigos e os queima.',
    icon: { sym: 'meteor', c1: '#ff6f00', c2: '#4e1d00' },
  },
  m_blink: {
    id: 'm_blink', cls: 'mage', name: 'Teleporte', lvl: 15, mp: 15, cd: 10, range: 7,
    target: 'dir',
    desc: 'Teleporta você até 7 tiles na direção do cursor e remove lentidão e enraizamento.',
    icon: { sym: 'blink', c1: '#d2b4de', c2: '#5b2c6f' },
  },
  m_nova: {
    id: 'm_nova', cls: 'mage', name: 'Nova Glacial', lvl: 20, mp: 45, cd: 22, range: 0,
    target: 'self', radius: 4, mult: 2.4, root: 2.5,
    desc: 'Explosão de gelo ao seu redor: 240% do Poder e congela os inimigos no lugar por 2,5s.',
    icon: { sym: 'nova', c1: '#e8f8ff', c2: '#1f618d' },
  },

  // ---------------- Arqueiro ----------------
  r_aimed: {
    id: 'r_aimed', cls: 'ranger', name: 'Tiro Certeiro', lvl: 1, mp: 8, cd: 4, range: 9,
    target: 'enemy', mult: 2.0, critBonus: 25, proj: 'arrow', speed: 22,
    desc: 'Um disparo preciso: 200% do Poder com +25% de chance de crítico.',
    icon: { sym: 'arrow', c1: '#58d68d', c2: '#145a32' },
  },
  r_poison: {
    id: 'r_poison', cls: 'ranger', name: 'Flecha Venenosa', lvl: 3, mp: 12, cd: 8, range: 9,
    target: 'enemy', mult: 0.8, poison: 0.35, poisonDur: 6, proj: 'poison', speed: 20,
    desc: 'Flecha envenenada: 80% do Poder e veneno de 35% do Poder por segundo durante 6s.',
    icon: { sym: 'poison', c1: '#a3e635', c2: '#3f6212' },
  },
  r_roll: {
    id: 'r_roll', cls: 'ranger', name: 'Rolamento', lvl: 6, mp: 10, cd: 9, range: 4.5,
    target: 'dir', invuln: 0.5,
    desc: 'Rola até 4,5 tiles na direção do cursor, ficando invulnerável por 0,5s e removendo lentidão.',
    icon: { sym: 'roll', c1: '#f7dc6f', c2: '#7d6608' },
  },
  r_rain: {
    id: 'r_rain', cls: 'ranger', name: 'Chuva de Flechas', lvl: 10, mp: 25, cd: 12, range: 10,
    target: 'ground', radius: 3, pulses: 3, interval: 0.5, mult: 0.9, slow: 0.35, slowDur: 2,
    desc: 'Uma saraivada cai na área em 3 ondas, cada uma causando 90% do Poder e lentidão.',
    icon: { sym: 'rain', c1: '#7dcea0', c2: '#1d8348' },
  },
  r_hawk: {
    id: 'r_hawk', cls: 'ranger', name: 'Olho de Falcão', lvl: 15, mp: 20, cd: 40, range: 0,
    target: 'self', dur: 10, crit: 30, haste: 40,
    desc: 'Foco absoluto por 10s: +30% de chance de crítico e +40% de velocidade de ataque.',
    icon: { sym: 'eye', c1: '#f4d03f', c2: '#9a7d0a' },
  },
  r_multi: {
    id: 'r_multi', cls: 'ranger', name: 'Tiro Múltiplo', lvl: 20, mp: 30, cd: 10, range: 9,
    target: 'enemy', radius: 4.5, maxTargets: 6, mult: 1.6, proj: 'arrow', speed: 22,
    desc: 'Dispara contra o alvo e até 5 inimigos próximos a ele, causando 160% do Poder em cada.',
    icon: { sym: 'multi', c1: '#82e0aa', c2: '#0b5345' },
  },

  // ---------------- Clérigo ----------------
  c_smite: {
    id: 'c_smite', cls: 'cleric', name: 'Luz Sagrada', lvl: 1, mp: 8, cd: 2.5, range: 8,
    target: 'enemy', mult: 1.6, proj: 'holy', speed: 15,
    desc: 'Um raio de luz que causa 160% do Poder. Causa 50% a mais contra mortos-vivos e servos do Vazio.',
    icon: { sym: 'sun', c1: '#fff3a0', c2: '#b7950b' },
  },
  c_heal: {
    id: 'c_heal', cls: 'cleric', name: 'Cura', lvl: 2, mp: 15, cd: 3, range: 9,
    target: 'ally', heal: 1.8, healFlat: 25,
    desc: 'Restaura 25 + 180% do Poder em vida do aliado alvo (ou em você).',
    icon: { sym: 'heal', c1: '#abebc6', c2: '#1e8449' },
  },
  c_bless: {
    id: 'c_bless', cls: 'cleric', name: 'Bênção', lvl: 6, mp: 25, cd: 30, range: 0,
    target: 'self', radius: 10, dur: 30, def: 0.2, regen: 0.01,
    desc: 'Abençoa você e os membros do grupo próximos por 30s: +20% de Defesa e regeneração de 1% da vida por segundo.',
    icon: { sym: 'bless', c1: '#fdebd0', c2: '#ca6f1e' },
  },
  c_consec: {
    id: 'c_consec', cls: 'cleric', name: 'Consagração', lvl: 10, mp: 30, cd: 15, range: 9,
    target: 'ground', radius: 3.2, dur: 5, mult: 0.6, heal: 0.4,
    desc: 'Consagra o chão por 5s: a cada segundo causa 60% do Poder aos inimigos e cura aliados em 40% do Poder.',
    icon: { sym: 'consec', c1: '#f9e79f', c2: '#b9770e' },
  },
  c_faith: {
    id: 'c_faith', cls: 'cleric', name: 'Escudo da Fé', lvl: 15, mp: 30, cd: 25, range: 9,
    target: 'ally', dur: 10, shieldMult: 2.5, shieldFlat: 60,
    desc: 'Protege o aliado alvo (ou você) com um escudo que absorve 60 + 250% do Poder por 10s.',
    icon: { sym: 'faith', c1: '#fcf3cf', c2: '#d4ac0d' },
  },
  c_grace: {
    id: 'c_grace', cls: 'cleric', name: 'Graça Divina', lvl: 20, mp: 50, cd: 60, range: 0,
    target: 'self', radius: 9, healPct: 0.4, revivePct: 0.3,
    desc: 'Cura todos os aliados próximos em 40% da vida máxima e ressuscita aliados caídos com 30% de vida.',
    icon: { sym: 'grace', c1: '#ffffff', c2: '#f5b041' },
  },
};

export function skillsForClass(cls) {
  return Object.values(SKILLS).filter((s) => s.cls === cls);
}
