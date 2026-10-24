// Constantes compartilhadas entre cliente e servidor.

export const GAME_NAME = 'Aethra: A Chama Partida';
export const GAME_VERSION = '1.0.0'; // igual ao version do package.json (um teste confere)
export const PROTOCOL_VERSION = 1;

export const TILE = 32;              // pixels por tile no zoom 1
export const TICK_RATE = 20;         // ticks de simulação por segundo
export const VIEW_RADIUS = 24;       // raio (em tiles) de entidades enviadas ao cliente
export const MAX_LEVEL = 100;
export const INV_SIZE = 30;
export const STASH_SIZE = 40;
export const PARTY_MAX = 4;
export const PLAYER_RADIUS = 0.3;
export const MAX_STACK = 99;
export const POINTS_PER_LEVEL = 1;
export const GLOBAL_COOLDOWN = 0.4;  // segundos entre habilidades
export const PICKUP_RANGE = 2.2;
export const NPC_RANGE = 4.5;
export const LOOT_PRIVATE_TIME = 30; // segundos que o saque pertence ao dono
export const LOOT_EXPIRE_TIME = 90;
export const COMBAT_TIMEOUT = 5;     // segundos sem dano para sair de combate
export const DAY_LENGTH = 20 * 60;   // um ciclo dia/noite em segundos
export const GUILD_COST = 500;
export const MAX_CHARS = 4;

export const RARITY = [
  { id: 0, name: 'Comum', color: '#d8d8d8' },
  { id: 1, name: 'Incomum', color: '#5fdc5f' },
  { id: 2, name: 'Raro', color: '#4fa3ff' },
  { id: 3, name: 'Épico', color: '#c060ff' },
  { id: 4, name: 'Lendário', color: '#ff9a1f' },
];

export const EQUIP_SLOTS = ['weapon', 'head', 'chest', 'legs', 'feet', 'ring', 'amulet'];
export const SLOT_NAMES = {
  weapon: 'Arma', head: 'Cabeça', chest: 'Peito', legs: 'Pernas',
  feet: 'Pés', ring: 'Anel', amulet: 'Amuleto',
};

export const STAT_NAMES = {
  str: 'Força', dex: 'Destreza', int: 'Inteligência', vit: 'Vitalidade',
  hp: 'Vida', mp: 'Mana', power: 'Poder', def: 'Defesa', crit: 'Crítico',
  speed: 'Velocidade', lifesteal: 'Roubo de Vida', haste: 'Celeridade',
};
// Estatísticas expressas em porcentagem nas descrições.
export const PERCENT_STATS = new Set(['crit', 'speed', 'lifesteal', 'haste']);

// Bits de estado enviados nas atualizações de entidades.
export const F = {
  DEAD: 1, STUN: 2, SLOW: 4, BURN: 8, POISON: 16, SHIELD: 32,
  BUFF: 64, COMBAT: 128, CAST: 256, ROOT: 512, INVULN: 1024, PVP: 2048,
  DEBUFF: 4096, REGEN: 8192,
};

export const DIRS = { DOWN: 0, LEFT: 1, RIGHT: 2, UP: 3 };

export const CHAT = {
  ZONE: 'zona', WORLD: 'mundo', PARTY: 'grupo', GUILD: 'cla',
  WHISPER: 'sussurro', SYSTEM: 'sistema', YELL: 'grito', NPC: 'npc',
};
