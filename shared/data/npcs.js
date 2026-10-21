// NPCs de Aethra: posição, aparência, serviços e falas.
// services: shop, craft, enhance, stash, teleport, board (contratos), lore

export const NPCS = {
  // ======================= Vila de Alvorada =======================
  thalric: {
    id: 'thalric', name: 'Ancião Thalric', title: 'Último Guardião da Chama', zone: 'town', x: 32.5, y: 13.5,
    look: { type: 'human', skin: '#e0ac69', hair: '#e5e7e9', hairStyle: 'bald', beard: '#e5e7e9', robe: '#1f3a93', trim: '#f1c40f', staff: true },
    greeting: 'A luz da Chama ainda arde em você, Portador. Posso sentir. O que deseja saber?',
    talk: [
      'Há trinta invernos sirvo à Ordem dos Guardiões. Hoje, sou tudo o que resta dela.',
      'A Névoa Cinzenta avança um pouco a cada noite. Alvorada é o último lugar onde a luz ainda vence a escuridão.',
      'Morvath era meu irmão de juramento. Ele via coisas que nós não víamos... e o medo o consumiu.',
    ],
    services: [],
  },
  bran: {
    id: 'bran', name: 'Capitã Bran', title: 'Guarda de Alvorada', zone: 'town', x: 56.5, y: 21.5,
    look: { type: 'human', skin: '#c68642', hair: '#b03a2e', hairStyle: 'short', armor: '#7f8c8d', trim: '#c0392b', sword: true },
    greeting: 'Mantenha a guarda alta, recruta. Lá fora, a Névoa não perdoa distrações.',
    talk: [
      'Perdemos três sentinelas este mês. Os lobos não agem mais como lobos.',
      'Se precisar de poções, fale com Otto na praça. Ele cobra caro, mas nunca falha.',
    ],
    services: [],
  },
  lyra: {
    id: 'lyra', name: 'Lyra', title: 'Caçadora', zone: 'town', x: 56.5, y: 27.5,
    look: { type: 'human', skin: '#f5d0a9', hair: '#2d8a4e', hairStyle: 'long', tunic: '#1e8449', trim: '#784212', bow: true },
    greeting: 'Shh... Ouviu isso? Não? Bom. Significa que ainda estamos seguros aqui dentro.',
    talk: [
      'Cacei nessas colinas a vida toda. Nunca vi os animais tão agitados.',
      'Dizem que o Javali Ancião, Presa-de-Ferro, voltou a rondar o sudeste dos campos. Que os deuses tenham piedade de quem cruzar o caminho dele.',
    ],
    services: [],
  },
  otto: {
    id: 'otto', name: 'Otto', title: 'Mercador', zone: 'town', x: 47.5, y: 19.5,
    look: { type: 'human', skin: '#f5d0a9', hair: '#6b3e1d', hairStyle: 'short', beard: '#6b3e1d', tunic: '#d68910', trim: '#784212', hat: '#784212' },
    greeting: 'Bem-vindo, bem-vindo! Poções, pergaminhos, tudo que um aventureiro precisa para voltar vivo... ou quase!',
    talk: ['Desde que a estrada do sul fechou, minhas mercadorias chegam pela metade. E pelo dobro do preço!'],
    services: ['shop'],
    shop: ['pot_hp_1', 'pot_hp_2', 'pot_hp_3', 'pot_mp_1', 'pot_mp_2', 'pot_mp_3', 'scroll_return', 'mat_herb'],
  },
  brunhilda: {
    id: 'brunhilda', name: 'Brunhilda', title: 'Ferreira', zone: 'town', x: 12.5, y: 21.5,
    look: { type: 'human', skin: '#e0ac69', hair: '#c58b3c', hairStyle: 'braid', tunic: '#5d4037', apron: '#3e2723', hammer: true },
    greeting: 'Hah! Mais um que precisa de aço. Traga materiais e ouro, e eu faço milagres na bigorna.',
    talk: [
      'Uma arma bem aprimorada vale mais que dez armas comuns. Mas cuidado: acima de +5, o metal pode rachar.',
      'Pedras de Aprimoramento? Posso forjá-las se você me trouxer peles e presas, ou minério das minas anãs.',
    ],
    services: ['shop', 'enhance', 'craft'],
    shop: ['w_weapon_1', 'm_weapon_1', 'r_weapon_1', 'c_weapon_1', 'w_weapon_2', 'm_weapon_2', 'r_weapon_2', 'c_weapon_2',
      'head_1', 'chest_1', 'legs_1', 'feet_1', 'head_2', 'chest_2', 'legs_2', 'feet_2', 'ring_1', 'amulet_1', 'enh_stone'],
    craft: 'smith',
  },
  fenwick: {
    id: 'fenwick', name: 'Fenwick', title: 'Alquimista', zone: 'town', x: 11.5, y: 35.5,
    look: { type: 'human', skin: '#f5d0a9', hair: '#dcdcdc', hairStyle: 'wild', robe: '#6c3483', trim: '#58d68d', goggles: true },
    greeting: 'Cuidado com os frascos! Esse aí explode se olhar torto. O que posso destilar para você?',
    talk: [
      'A Erva Lunar é a base de quase tudo que faço. Cresce nos campos e na floresta, mas os bichos a comem antes de mim.',
      'Tenho uma teoria: a Névoa é feita da mesma substância que a Chama, só que... invertida. Fascinante, não?',
    ],
    services: ['shop', 'craft'],
    shop: ['pot_hp_1', 'pot_hp_2', 'pot_mp_1', 'pot_mp_2', 'elixir_speed'],
    craft: 'alchemy',
  },
  marta: {
    id: 'marta', name: 'Marta', title: 'Guardiã do Cofre', zone: 'town', x: 50.5, y: 36.5,
    look: { type: 'human', skin: '#8d5524', hair: '#2b1d0e', hairStyle: 'bun', robe: '#145a32', trim: '#f4d03f' },
    greeting: 'O cofre de Alvorada nunca foi arrombado. Nem por ladrões, nem pela Névoa. Seus pertences estarão seguros.',
    talk: ['Cada Portador tem seu próprio baú. O que você guarda aqui, só você retira.'],
    services: ['stash'],
  },
  ilyas: {
    id: 'ilyas', name: 'Ilyas', title: 'Mago do Portal', zone: 'town', x: 23.5, y: 24.5,
    look: { type: 'human', skin: '#c68642', hair: '#3c5aa8', hairStyle: 'long', robe: '#1b4f72', trim: '#85c1e9', hat: '#1b4f72', pointyHat: true, staff: true },
    greeting: 'Os caminhos entre as Pedras do Caminho estão abertos para quem já os percorreu. Para onde deseja ir?',
    talk: ['Cada Pedra do Caminho é um fragmento do antigo santuário. Elas se lembram de quem as tocou.'],
    services: ['teleport'],
  },
  pip: {
    id: 'pip', name: 'Pip', title: 'Menino Curioso', zone: 'town', x: 35.5, y: 27.5, small: true,
    look: { type: 'human', skin: '#f5d0a9', hair: '#e8d36c', hairStyle: 'messy', tunic: '#5dade2', trim: '#2874a6', small: true },
    greeting: 'Você é um Portador de verdade?! Uau! Consegue soltar fogo pelas mãos?',
    talk: ['Quando eu crescer, vou ser um Portador também! Ou um gato. Gatos dormem o dia todo.'],
    services: [],
  },
  board: {
    id: 'board', name: 'Quadro de Contratos', title: 'Caçadas Repetíveis', zone: 'town', x: 28.5, y: 19.5,
    look: { type: 'board' },
    greeting: 'Cartazes de recompensa cobrem a madeira. A Guarda de Alvorada paga bem por cada ameaça eliminada.',
    talk: [],
    services: ['board'],
  },
  statue: {
    id: 'statue', name: 'Estátua de Aurelion', title: 'Primeiro Guardião', zone: 'town', x: 32.5, y: 20.5,
    look: { type: 'lore' }, noMarker: true,
    greeting: '"Aqui jaz a memória de Aurelion, que acendeu a Chama Primordial no coração de Lúmen e jurou protegê-la até o fim dos tempos."',
    talk: [
      'Diz a lenda que Aurelion trouxe a Chama de além das estrelas, quando Aethra era apenas pedra fria e Névoa.',
      'Enquanto a Chama ardesse em Lúmen, o Vazio não poderia tocar estas terras. Mil anos de paz se seguiram.',
    ],
    services: ['lore'],
  },
  rurik: {
    id: 'rurik', name: 'Rurik', title: 'Mestre da Arena', zone: 'arena', x: 15.5, y: 35.5,
    look: { type: 'human', skin: '#8d5524', hair: '#2b1d0e', hairStyle: 'bald', beard: '#2b1d0e', armor: '#922b21', trim: '#f4d03f', axe: true },
    greeting: 'Bem-vindo à Arena de Sangue! Além daquela linha, é cada um por si. Aqui embaixo, ninguém sangra.',
    talk: [
      'Na arena não há perda de experiência. Só orgulho ferido.',
      'Os maiores campeões têm seus nomes gravados no Quadro de Honra. Quer ver?',
    ],
    services: ['ranking'],
  },

  // ======================= Campos Verdejantes =======================
  osric: {
    id: 'osric', name: 'Osric', title: 'O Eremita', zone: 'fields', x: 76.5, y: 55.5,
    look: { type: 'human', skin: '#e0ac69', hair: '#7b7d7d', hairStyle: 'wild', beard: '#7b7d7d', robe: '#6e2c00', trim: '#a04000', staff: true },
    greeting: 'Hm? Um Portador... Então a profecia era verdadeira. Sente-se. A Névoa não chega a este santuário.',
    talk: [
      'Estudo a Névoa há décadas. Ela não é apenas fumaça — ela pensa, ela deseja.',
      'Este santuário foi erguido pelos Guardiões há séculos. As pedras ainda guardam um pouco da luz de Lúmen.',
    ],
    services: [],
  },
  gustavo: {
    id: 'gustavo', name: 'Gustavo', title: 'Fazendeiro', zone: 'fields', x: 35.5, y: 67.5,
    look: { type: 'human', skin: '#c68642', hair: '#6b3e1d', hairStyle: 'short', tunic: '#a04000', trim: '#f4d03f', hat: '#d4ac0d' },
    greeting: 'Ah, graças aos céus! Alguém armado! Esses javalis estão destruindo tudo que plantei!',
    talk: ['Três gerações da minha família cultivaram esta terra. Não vou deixar uns porcos selvagens tirarem isso de mim.'],
    services: [],
  },
  bigodes: {
    id: 'bigodes', name: 'Bigodes', title: 'Gato Fugitivo', zone: 'fields', x: 16.5, y: 72.5, small: true,
    look: { type: 'cat', color: '#e67e22' },
    greeting: 'Miau? O gato laranja olha para você com desdém, depois esfrega a cabeça na sua perna.',
    talk: ['Purrrr...'],
    services: [],
  },
  stone_fields: {
    id: 'stone_fields', name: 'Marco Antigo', title: 'Pedra de Memória', zone: 'fields', x: 38.5, y: 41.5,
    look: { type: 'lore' }, noMarker: true,
    greeting: 'Uma pedra coberta de musgo. Runas antigas brilham fracamente ao seu toque.',
    talk: [
      '"Quando a Chama se partir, das cinzas despertarão os Portadores. Em seus corações arderá a centelha perdida, e por suas mãos a luz retornará."',
      'Abaixo, uma inscrição mais recente, riscada às pressas: "Morvath mentiu. A Chama não estava morrendo."',
    ],
    services: ['lore'],
  },
  way_fields: {
    id: 'way_fields', name: 'Pedra do Caminho', title: 'Teleporte', zone: 'fields', x: 8.5, y: 41.5,
    look: { type: 'waystone' }, noMarker: true,
    greeting: 'A pedra vibra com energia arcana. Você pode viajar para qualquer lugar que já visitou.',
    talk: [], services: ['teleport'],
  },

  // ======================= Floresta Sussurrante =======================
  sylvara: {
    id: 'sylvara', name: 'Sylvara', title: 'Druida da Floresta', zone: 'forest', x: 27.5, y: 46.5,
    look: { type: 'human', skin: '#f5d0a9', hair: '#d4ac0d', hairStyle: 'long', robe: '#196f3d', trim: '#a9dfbf', staff: true, leaves: true },
    greeting: 'As árvores sussurraram sobre sua chegada, Portador. Elas também sentem a dor desta floresta.',
    talk: [
      'Esta floresta era o lar de minha irmã e eu. Nós a protegíamos juntas... antes.',
      'Ouça com atenção: as árvores ainda falam. Mas agora, elas apenas gritam.',
    ],
    services: [],
  },
  kael: {
    id: 'kael', name: 'Kael', title: 'Batedor da Guarda', zone: 'forest', x: 21.5, y: 46.5,
    look: { type: 'human', skin: '#c68642', hair: '#2b1d0e', hairStyle: 'short', tunic: '#566573', trim: '#1e8449', bow: true },
    greeting: 'Mais um voluntário? Ótimo. Os goblins estão mais ousados do que nunca. Precisamos de cada espada.',
    talk: ['Mantenho este acampamento abastecido para quem enfrenta a floresta. Se precisar de suprimentos, é só pedir.'],
    services: ['shop'],
    shop: ['pot_hp_1', 'pot_hp_2', 'pot_mp_1', 'pot_mp_2', 'scroll_return'],
  },
  tree_mother: {
    id: 'tree_mother', name: 'Árvore-Mãe', title: 'Pedra de Memória', zone: 'forest', x: 31.5, y: 53.5,
    look: { type: 'lore' }, noMarker: true,
    greeting: 'Raízes antigas envolvem uma pedra gravada. Quando você toca, sente um calor suave, como uma lembrança.',
    talk: [
      '"Vexa e Sylvara, filhas da floresta, juraram guardar o bosque sagrado enquanto houvesse folhas nas árvores."',
      'Marcas de garras atravessam a inscrição. Fios de seda cinza envolvem o nome de Vexa.',
    ],
    services: ['lore'],
  },
  way_forest: {
    id: 'way_forest', name: 'Pedra do Caminho', title: 'Teleporte', zone: 'forest', x: 20.5, y: 53.5,
    look: { type: 'waystone' }, noMarker: true,
    greeting: 'A pedra vibra com energia arcana. Você pode viajar para qualquer lugar que já visitou.',
    talk: [], services: ['teleport'],
  },

  // ======================= Minas de Ferro Negro =======================
  durgan: {
    id: 'durgan', name: 'Durgan Barba-de-Ferro', title: 'Mestre Minerador', zone: 'mines', x: 48.5, y: 70.5, small: true,
    look: { type: 'dwarf', skin: '#e0ac69', hair: '#b03a2e', beard: '#b03a2e', armor: '#5d6d7e', trim: '#d4ac0d', hammer: true },
    greeting: 'Por minhas barbas! Um Portador, nas MINHAS minas? Já não era sem tempo!',
    talk: [
      'Meu povo cavou estas minas por mil anos. Agora, os túneis estão cheios de mortos que se recusam a ficar mortos.',
      'Kragmor foi construído por meu bisavô. Era nosso guardião. Ver ele assim... parte meu coração de pedra.',
    ],
    services: ['shop'],
    shop: ['pot_hp_2', 'pot_hp_3', 'pot_mp_2', 'pot_mp_3', 'scroll_return', 'head_3', 'chest_3', 'legs_3', 'feet_3',
      'w_weapon_3', 'm_weapon_3', 'r_weapon_3', 'c_weapon_3'],
  },
  greta: {
    id: 'greta', name: 'Greta', title: 'Mineira Sobrevivente', zone: 'mines', x: 53.5, y: 70.5, small: true,
    look: { type: 'dwarf', skin: '#f5d0a9', hair: '#e8d36c', beard: null, armor: '#784212', trim: '#a04000', pick: true },
    greeting: 'Fui a única que saiu da galeria leste viva. Os morcegos... eles vieram aos milhares.',
    talk: ['Ainda ouço os gritos à noite. Mas um anão não chora. Um anão se vinga.'],
    services: [],
  },
  plaque_mines: {
    id: 'plaque_mines', name: 'Placa dos Fundadores', title: 'Pedra de Memória', zone: 'mines', x: 55.5, y: 74.5,
    look: { type: 'lore' }, noMarker: true,
    greeting: 'Uma placa de bronze cravada na rocha, polida por gerações de mãos anãs.',
    talk: [
      '"Kragmor, Coração da Montanha. Forjado por Thrain Barba-de-Ferro para guardar as Minas de Ferro Negro. Que sua vigília nunca termine."',
      'Ao lado, uma marca recente: o símbolo de um olho fechado envolto em névoa.',
    ],
    services: ['lore'],
  },
  way_mines: {
    id: 'way_mines', name: 'Pedra do Caminho', title: 'Teleporte', zone: 'mines', x: 45.5, y: 74.5,
    look: { type: 'waystone' }, noMarker: true,
    greeting: 'A pedra vibra com energia arcana. Você pode viajar para qualquer lugar que já visitou.',
    talk: [], services: ['teleport'],
  },

  // ======================= Ruínas de Cinza =======================
  elira: {
    id: 'elira', name: 'Comandante Elira', title: 'A Última Vigília', zone: 'ruins', x: 86.5, y: 46.5,
    look: { type: 'human', skin: '#f5d0a9', hair: '#dcdcdc', hairStyle: 'short', armor: '#d5dbdb', trim: '#f1c40f', sword: true, cape: '#922b21' },
    greeting: 'Portador. Lúmen caiu sob nossa guarda. Não vou deixar que caia uma segunda vez.',
    talk: [
      'A Última Vigília era formada por cem cavaleiros. Restam doze. Os outros... você vai encontrá-los lá dentro, vestindo cinzas.',
      'O Santuário fica a oeste. Morvath está lá, sentado no trono que um dia foi de Aurelion.',
    ],
    services: ['shop'],
    shop: ['pot_hp_3', 'pot_hp_4', 'pot_mp_3', 'scroll_return', 'head_4', 'chest_4', 'legs_4', 'feet_4', 'ring_3', 'amulet_3'],
  },
  cael: {
    id: 'cael', name: 'Irmão Cael', title: 'Velado Arrependido', zone: 'ruins', x: 91.5, y: 46.5,
    look: { type: 'human', skin: '#e0ac69', hair: '#2b1d0e', hairStyle: 'bald', robe: '#5b2c6f', trim: '#aab7b8', hood: true },
    greeting: 'Não me olhe assim. Eu já vesti o véu, sim. Mas vi o que Morvath fez com os nossos. Agora luto do lado certo.',
    talk: [
      'Morvath nos prometeu a imortalidade. "Fundidos ao Vazio, nunca morreremos", ele dizia. Esqueceu de dizer que também nunca mais viveríamos.',
      'A Essência do Vazio que os Velados carregam pode ser purificada. Traga-a para mim.',
    ],
    services: [],
  },
  altar: {
    id: 'altar', name: 'Altar da Chama', title: 'Coração de Lúmen', zone: 'ruins', x: 22.5, y: 43.5,
    look: { type: 'altar' },
    greeting: 'O altar está frio. No centro, três cavidades em forma de chama esperam por algo.',
    talk: ['Você sente um eco distante, como uma canção esquecida, vindo das pedras.'],
    services: [],
  },
  mural: {
    id: 'mural', name: 'Mural de Lúmen', title: 'Pedra de Memória', zone: 'ruins', x: 60.5, y: 52.5,
    look: { type: 'lore' }, noMarker: true,
    greeting: 'Um mural rachado e enegrecido pelo fogo. Ainda é possível distinguir as figuras.',
    talk: [
      'A primeira cena mostra um guardião de manto cinza diante da Chama, com o rosto cheio de lágrimas.',
      'A segunda, a Chama partida em três, e três figuras recebendo os fragmentos: uma aranha, uma montanha e uma coroa.',
      'A última foi raspada da parede. Sobrou apenas uma palavra: "Perdão".',
    ],
    services: ['lore'],
  },
  way_ruins: {
    id: 'way_ruins', name: 'Pedra do Caminho', title: 'Teleporte', zone: 'ruins', x: 88.5, y: 54.5,
    look: { type: 'waystone' }, noMarker: true,
    greeting: 'A pedra vibra com energia arcana. Você pode viajar para qualquer lugar que já visitou.',
    talk: [], services: ['teleport'],
  },
  way_arena: {
    id: 'way_arena', name: 'Pedra do Caminho', title: 'Teleporte', zone: 'arena', x: 24.5, y: 35.5,
    look: { type: 'waystone' }, noMarker: true,
    greeting: 'A pedra vibra com energia arcana. Você pode viajar para qualquer lugar que já visitou.',
    talk: [], services: ['teleport'],
  },
};

export function npcsInZone(zoneId) {
  return Object.values(NPCS).filter((n) => n.zone === zoneId);
}
