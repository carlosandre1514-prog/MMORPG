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
    id: 'w_cry', cls: 'warrior', name: 'Grito de Guerra', lvl: 8, mp: 15, cd: 18, range: 0,
    target: 'self', radius: 4.5, dur: 6, dr: 0.3, tauntDur: 4,
    desc: 'Provoca todos os inimigos próximos, forçando-os a atacar você, e reduz o dano recebido em 30% por 6s.',
    icon: { sym: 'shout', c1: '#f39c12', c2: '#7e5109' },
  },
  w_charge: {
    id: 'w_charge', cls: 'warrior', name: 'Investida de Escudo', lvl: 18, mp: 12, cd: 12, range: 9,
    target: 'enemy', mult: 1.3, stun: 1.5,
    desc: 'Avança até o alvo, causando 130% do Poder e atordoando por 1,5s.',
    icon: { sym: 'charge', c1: '#d35400', c2: '#6e2c00' },
  },
  w_whirl: {
    id: 'w_whirl', cls: 'warrior', name: 'Redemoinho', lvl: 32, mp: 20, cd: 8, range: 0,
    target: 'self', radius: 2.8, mult: 1.7,
    desc: 'Gira com a arma, causando 170% do Poder a todos os inimigos ao redor.',
    icon: { sym: 'whirl', c1: '#bdc3c7', c2: '#566573' },
  },
  w_wall: {
    id: 'w_wall', cls: 'warrior', name: 'Muralha de Aço', lvl: 50, mp: 30, cd: 50, range: 0,
    target: 'self', dur: 10, dr: 0.45, regen: 0.02,
    desc: 'Firma o escudo por 10s: recebe 45% menos dano e recupera 2% da vida máxima por segundo.',
    icon: { sym: 'faith', c1: '#aed6f1', c2: '#1f618d' },
  },
  w_exec: {
    id: 'w_exec', cls: 'warrior', name: 'Execução', lvl: 65, mp: 25, cd: 14, range: 2.0,
    target: 'enemy', mult: 3.0, execMult: 6.0, execPct: 0.3,
    desc: 'Golpe final: 300% do Poder, ou 600% se o alvo estiver abaixo de 30% de vida.',
    icon: { sym: 'exec', c1: '#e8eef5', c2: '#1b2733' },
  },

  // ---------------- Berserker ----------------
  b_cleave: {
    id: 'b_cleave', cls: 'berserker', name: 'Golpe Ceifador', lvl: 1, mp: 8, cd: 4, range: 2.0,
    target: 'enemy', mult: 1.5, splash: 0.6, splashR: 2.2,
    desc: 'Um talho largo do machado: 150% do Poder no alvo e 60% nos inimigos ao redor dele.',
    icon: { sym: 'cleave', c1: '#f5b041', c2: '#6e2c00' },
  },
  b_rend: {
    id: 'b_rend', cls: 'berserker', name: 'Dilacerar', lvl: 8, mp: 12, cd: 9, range: 2.0,
    target: 'enemy', mult: 1.0, bleed: 0.3, bleedDur: 6,
    desc: 'Rasga o alvo: 100% do Poder e sangramento de 30% do Poder por segundo durante 6s.',
    icon: { sym: 'rend', c1: '#e74c3c', c2: '#641e16' },
  },
  b_leap: {
    id: 'b_leap', cls: 'berserker', name: 'Salto Selvagem', lvl: 18, mp: 14, cd: 12, range: 9,
    target: 'enemy', mult: 1.4, radius: 2.4, slow: 0.4, slowDur: 2.5,
    desc: 'Salta sobre o alvo e esmaga o chão: 140% do Poder a todos em volta do ponto de pouso, com lentidão de 40% por 2,5s.',
    icon: { sym: 'leap', c1: '#f39c12', c2: '#7e5109' },
  },
  b_frenzy: {
    id: 'b_frenzy', cls: 'berserker', name: 'Frenesi', lvl: 32, mp: 20, cd: 30, range: 0,
    target: 'self', dur: 10, power: 0.25, haste: 30, defPenalty: 0.2,
    desc: 'Entra em frenesi por 10s: +25% de Poder e +30% de velocidade de ataque, mas recebe 20% mais dano.',
    icon: { sym: 'frenzy', c1: '#ff5733', c2: '#7b241c' },
  },
  b_roar: {
    id: 'b_roar', cls: 'berserker', name: 'Rugido Sanguinário', lvl: 50, mp: 25, cd: 20, range: 0,
    target: 'self', radius: 4.5, mult: 1.2, healPct: 0.06, maxHeals: 5,
    desc: 'Um urro que racha o ar: 120% do Poder a todos em volta e recupera 6% da vida máxima por inimigo atingido (até 5).',
    icon: { sym: 'roar', c1: '#ffb347', c2: '#922b21' },
  },
  b_massacre: {
    id: 'b_massacre', cls: 'berserker', name: 'Massacre', lvl: 65, mp: 40, cd: 90, range: 0,
    target: 'self', dur: 15, power: 0.5, lifesteal: 25, speed: 0.2,
    desc: 'Perde o controle por 15s: +50% de Poder, +25% de roubo de vida e +20% de velocidade de movimento.',
    icon: { sym: 'massacre', c1: '#ff2d2d', c2: '#3b0a0a' },
  },

  // ---------------- Assassino ----------------
  a_stab: {
    id: 'a_stab', cls: 'assassin', name: 'Estocada', lvl: 1, mp: 8, cd: 3, range: 1.8,
    target: 'enemy', mult: 1.4, critBonus: 20,
    desc: 'Golpe rápido com a adaga: 140% do Poder e +20% de chance de crítico.',
    icon: { sym: 'stab', c1: '#d7bde2', c2: '#4a235a' },
  },
  a_backstab: {
    id: 'a_backstab', cls: 'assassin', name: 'Golpe nas Costas', lvl: 8, mp: 12, cd: 8, range: 1.8,
    target: 'enemy', mult: 2.0, bonusMult: 3.2,
    desc: 'Causa 200% do Poder, ou 320% se o alvo estiver atacando outra pessoa, atordoado ou lento.',
    icon: { sym: 'backstab', c1: '#e8daef', c2: '#6c3483' },
  },
  a_venom: {
    id: 'a_venom', cls: 'assassin', name: 'Lâmina Envenenada', lvl: 18, mp: 14, cd: 10, range: 1.8,
    target: 'enemy', mult: 1.0, poison: 0.35, poisonDur: 6,
    desc: 'Corta o alvo: 100% do Poder e veneno de 35% do Poder por segundo durante 6s.',
    icon: { sym: 'venom', c1: '#a3e635', c2: '#1f3d0a' },
  },
  a_shadow: {
    id: 'a_shadow', cls: 'assassin', name: 'Passo Sombrio', lvl: 32, mp: 18, cd: 14, range: 8,
    target: 'enemy', mult: 1.7, critBonus: 100,
    desc: 'Some e surge atrás do alvo, golpeando com 170% do Poder. O golpe sempre é crítico.',
    icon: { sym: 'shadow', c1: '#c39bd3', c2: '#1b0a2c' },
  },
  a_smoke: {
    id: 'a_smoke', cls: 'assassin', name: 'Bomba de Fumaça', lvl: 50, mp: 25, cd: 30, range: 0,
    target: 'self', radius: 4, slow: 0.5, slowDur: 3, dur: 5, dr: 0.35, speed: 0.25,
    desc: 'Solta fumaça: inimigos em volta ficam 50% mais lentos por 3s e esquecem parte da raiva contra você. Você recebe 35% menos dano e anda 25% mais rápido por 5s.',
    icon: { sym: 'smoke', c1: '#bdc3c7', c2: '#2c3e50' },
  },
  a_flurry: {
    id: 'a_flurry', cls: 'assassin', name: 'Dança das Lâminas', lvl: 65, mp: 40, cd: 25, range: 0,
    target: 'self', radius: 2.8, mult: 0.9, hits: 4, interval: 0.25,
    desc: 'Gira entre as lâminas: 4 golpes de 90% do Poder em todos os inimigos ao redor.',
    icon: { sym: 'flurry', c1: '#f5b7b1', c2: '#7b241c' },
  },

  // ---------------- Mago ----------------
  m_fire: {
    id: 'm_fire', cls: 'mage', name: 'Bola de Fogo', lvl: 1, mp: 10, cd: 3, range: 8.5,
    target: 'enemy', mult: 1.8, burn: 0.15, burnDur: 4, proj: 'fire', speed: 14,
    desc: 'Lança uma bola de fogo: 180% do Poder e queimadura de 15% do Poder por segundo durante 4s.',
    icon: { sym: 'fire', c1: '#ff9f1a', c2: '#c0392b' },
  },
  m_frost: {
    id: 'm_frost', cls: 'mage', name: 'Lança de Gelo', lvl: 8, mp: 12, cd: 6, range: 8.5,
    target: 'enemy', mult: 1.5, slow: 0.5, slowDur: 3, proj: 'frost', speed: 16,
    desc: 'Dispara uma lança de gelo: 150% do Poder e reduz a velocidade do alvo em 50% por 3s.',
    icon: { sym: 'frost', c1: '#aee8ff', c2: '#2874a6' },
  },
  m_shield: {
    id: 'm_shield', cls: 'mage', name: 'Escudo Arcano', lvl: 18, mp: 25, cd: 20, range: 0,
    target: 'self', dur: 10,
    desc: 'Cria um escudo que absorve 25 + 3×Inteligência + 6×Nível de dano por 10s.',
    icon: { sym: 'shield', c1: '#a569bd', c2: '#4a235a' },
  },
  m_meteor: {
    id: 'm_meteor', cls: 'mage', name: 'Chuva de Meteoros', lvl: 32, mp: 35, cd: 14, range: 10,
    target: 'ground', radius: 3, delay: 1.0, mult: 2.6, burn: 0.12, burnDur: 3,
    desc: 'Invoca meteoros na área alvo: após 1s causa 260% do Poder a todos os inimigos e os queima.',
    icon: { sym: 'meteor', c1: '#ff6f00', c2: '#4e1d00' },
  },
  m_blink: {
    id: 'm_blink', cls: 'mage', name: 'Teleporte', lvl: 50, mp: 15, cd: 10, range: 7,
    target: 'dir',
    desc: 'Teleporta você até 7 tiles na direção do cursor e remove lentidão e enraizamento.',
    icon: { sym: 'blink', c1: '#d2b4de', c2: '#5b2c6f' },
  },
  m_nova: {
    id: 'm_nova', cls: 'mage', name: 'Nova Glacial', lvl: 65, mp: 45, cd: 22, range: 0,
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
    id: 'r_poison', cls: 'ranger', name: 'Flecha Venenosa', lvl: 8, mp: 12, cd: 8, range: 9,
    target: 'enemy', mult: 0.8, poison: 0.35, poisonDur: 6, proj: 'poison', speed: 20,
    desc: 'Flecha envenenada: 80% do Poder e veneno de 35% do Poder por segundo durante 6s.',
    icon: { sym: 'poison', c1: '#a3e635', c2: '#3f6212' },
  },
  r_roll: {
    id: 'r_roll', cls: 'ranger', name: 'Rolamento', lvl: 18, mp: 10, cd: 9, range: 4.5,
    target: 'dir', invuln: 0.5,
    desc: 'Rola até 4,5 tiles na direção do cursor, ficando invulnerável por 0,5s e removendo lentidão.',
    icon: { sym: 'roll', c1: '#f7dc6f', c2: '#7d6608' },
  },
  r_rain: {
    id: 'r_rain', cls: 'ranger', name: 'Chuva de Flechas', lvl: 32, mp: 25, cd: 12, range: 10,
    target: 'ground', radius: 3, pulses: 3, interval: 0.5, mult: 0.9, slow: 0.35, slowDur: 2,
    desc: 'Uma saraivada cai na área em 3 ondas, cada uma causando 90% do Poder e lentidão.',
    icon: { sym: 'rain', c1: '#7dcea0', c2: '#1d8348' },
  },
  r_hawk: {
    id: 'r_hawk', cls: 'ranger', name: 'Olho de Falcão', lvl: 50, mp: 20, cd: 40, range: 0,
    target: 'self', dur: 10, crit: 30, haste: 40,
    desc: 'Foco absoluto por 10s: +30% de chance de crítico e +40% de velocidade de ataque.',
    icon: { sym: 'eye', c1: '#f4d03f', c2: '#9a7d0a' },
  },
  r_multi: {
    id: 'r_multi', cls: 'ranger', name: 'Tiro Múltiplo', lvl: 65, mp: 30, cd: 10, range: 9,
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
    id: 'c_heal', cls: 'cleric', name: 'Cura', lvl: 4, mp: 15, cd: 3, range: 9,
    target: 'ally', heal: 1.8, healFlat: 25,
    desc: 'Restaura 25 + 180% do Poder em vida do aliado alvo (ou em você).',
    icon: { sym: 'heal', c1: '#abebc6', c2: '#1e8449' },
  },
  c_bless: {
    id: 'c_bless', cls: 'cleric', name: 'Bênção', lvl: 18, mp: 25, cd: 30, range: 0,
    target: 'self', radius: 10, dur: 30, def: 0.2, regen: 0.01,
    desc: 'Abençoa você e os membros do grupo próximos por 30s: +20% de Defesa e regeneração de 1% da vida por segundo.',
    icon: { sym: 'bless', c1: '#fdebd0', c2: '#ca6f1e' },
  },
  c_consec: {
    id: 'c_consec', cls: 'cleric', name: 'Consagração', lvl: 32, mp: 30, cd: 15, range: 9,
    target: 'ground', radius: 3.2, dur: 5, mult: 0.6, heal: 0.4,
    desc: 'Consagra o chão por 5s: a cada segundo causa 60% do Poder aos inimigos e cura aliados em 40% do Poder.',
    icon: { sym: 'consec', c1: '#f9e79f', c2: '#b9770e' },
  },
  c_faith: {
    id: 'c_faith', cls: 'cleric', name: 'Escudo da Fé', lvl: 50, mp: 30, cd: 25, range: 9,
    target: 'ally', dur: 10, shieldMult: 2.5, shieldFlat: 60,
    desc: 'Protege o aliado alvo (ou você) com um escudo que absorve 60 + 250% do Poder por 10s.',
    icon: { sym: 'faith', c1: '#fcf3cf', c2: '#d4ac0d' },
  },
  c_grace: {
    id: 'c_grace', cls: 'cleric', name: 'Graça Divina', lvl: 65, mp: 50, cd: 60, range: 0,
    target: 'self', radius: 9, healPct: 0.4, revivePct: 0.3,
    desc: 'Cura todos os aliados próximos em 40% da vida máxima e ressuscita aliados caídos com 30% de vida.',
    icon: { sym: 'grace', c1: '#ffffff', c2: '#f5b041' },
  },
};

export function skillsForClass(cls) {
  return Object.values(SKILLS).filter((s) => s.cls === cls);
}
