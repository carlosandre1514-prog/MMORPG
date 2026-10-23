// Reinos de Aethra. Cada reino é um conjunto de zonas ligadas por portais; reinos vizinhos se ligam por uma estrada (um portal
// entre as zonas de fronteira). O servidor só mantém na memória as zonas dos reinos onde há jogadores (e as descarrega depois
// de um tempo vazias); o cliente só carrega os recursos do reino em que o jogador está. O progresso (missões, itens, pedras
// descobertas) é do personagem e continua salvo quando ele muda de reino.
//   hub: zona-capital (retorno, ressurreição e pergaminho de retorno levam para lá)
//   assets: pacotes de arte que o cliente baixa ao entrar (client/js/kingdoms.js)

export const KINGDOMS = {
  alvorada: {
    id: 'alvorada', name: 'Reino de Alvorada', hub: 'town', theme: 'temperado', assets: ['village'],
    zones: ['town', 'fields', 'forest', 'mines', 'ruins', 'arena'],
    desc: 'O último reino dos homens, cercado pela Névoa Cinzenta. Sua capital, Alvorada, guarda a Chama reacesa.',
  },
  sahaar: {
    id: 'sahaar', name: 'Reino de Sahaar', hub: 'zahrim', theme: 'deserto', assets: ['voxel', 'arms'],
    zones: ['zahrim', 'dunes', 'tombs'],
    desc: 'O reino das areias ardentes, de torres de barro e tumbas de reis-sol, ao norte das Ruínas de Cinza.',
  },
};

export const KINGDOM_ORDER = ['alvorada', 'sahaar'];
