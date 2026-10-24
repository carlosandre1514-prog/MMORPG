// A fazenda dos Campos Verdejantes: onde ficam as construções, os currais, os animais e os adereços. Usado pelo gerador de mapas
// (mapgen.js, que bloqueia as construções, levanta as cercas e abre a lagoa) e entregue ao cliente como "estruturas" do mapa
// (kind 'farm', 'farmprop' e 'pen'), que desenha os modelos de assets/farm e faz os animais andarem dentro dos currais.
// Coordenadas em tiles. Todas as construções têm a frente para o norte (a estrada), os currais ficam atrás delas.

// Tamanho (largura × profundidade, em tiles) que cada construção ocupa e bloqueia
export const FARM_FOOT = {
  TowerWindmill: [5, 4], Silo: [3, 3], WaterTower: [2, 2], Well: [2, 2], ChickenCoop: [2, 2],
  // construções que se pode visitar: montadas com as peças da vila (paredes, porta e telhado) e mobiliadas por dentro
  BigBarn: [7, 6], SmallBarn: [6, 5], Farmhouse: [6, 5],
};

// Construções visitáveis da fazenda: tipo do interior (client/js/three/interiors.js), nome na placa e cor das paredes (village.js)
export const FARM_ENTER = {
  BigBarn: { type: 'barn', label: 'Celeiro Grande', style: 'barn' },
  SmallBarn: { type: 'barn', label: 'Celeiro Pequeno', style: 'barn' },
  Farmhouse: { type: 'farmhouse', label: 'Casa da Fazenda', style: 'barn' },
};

// Animais por espécie que o cliente sabe desenhar (client/js/three/animals.js)
export const FARM_ANIMALS = ['cow', 'bull', 'horse', 'pig', 'sheep', 'chicken', 'rooster', 'duck', 'goose'];

const ENTER = (b) => !!FARM_ENTER[b.model];

export function farmLayout() {
  const b = (model, x, y, face = 'n') => ({ model, x, y, w: FARM_FOOT[model][0], h: FARM_FOOT[model][1], face });
  const buildings = [
    b('TowerWindmill', 16, 76), b('Silo', 21, 76), b('Farmhouse', 24, 76), b('BigBarn', 31, 76), b('SmallBarn', 40, 76),
    b('WaterTower', 49, 76), b('Well', 49, 78, 's'), b('ChickenCoop', 39, 82, 's'),
  ];
  // gate: lado da cerca ('n' | 's' | 'e' | 'w'), coordenada do primeiro tile do portão e quantos tiles abre
  const pens = [
    { id: 'pasto', x: 8, y: 62, w: 21, h: 9, gate: { side: 's', at: 17, n: 2 }, animals: [['cow', 3], ['bull', 1], ['horse', 2]] },
    { id: 'porcos', x: 20, y: 82, w: 7, h: 4, gate: { side: 'n', at: 22, n: 2 }, animals: [['pig', 3]] },
    { id: 'ovelhas', x: 28, y: 82, w: 9, h: 4, gate: { side: 'n', at: 29, n: 2 }, animals: [['sheep', 5]] },
    { id: 'aves', x: 38, y: 81, w: 12, h: 5, gate: { side: 'n', at: 46, n: 2 }, animals: [['chicken', 5], ['rooster', 1], ['duck', 3], ['goose', 3]], pond: { x: 44, y: 83, w: 4, h: 2 } },
  ];
  // adereços (tiles, centro; rot em radianos; s = escala em tiles por metro, 0,8 por padrão)
  const raw = [
    ['Trough_1_A', 12, 63.4, 1.57], ['Trough_2_A', 22, 69.4, 1.57], ['Trough_1_B', 26.5, 66, 0], ['Bag_1_A', 19.6, 69.4, 0.3], ['Bag_3_A', 15.2, 69.3, 1.1], ['Wheel_A', 9.6, 63.2, 0.4], ['CutedWood_1_A', 25.4, 63.6, 0],
    ['Pitchfork_B', 27.8, 64.6, 0.2], ['Bucket_1_A', 10.4, 68.6, 0.5],
    ['Cart_1_A', 38.6, 78.4, 0.15], ['Pitchfork_A', 30.2, 77, 0], ['Pitchfork_C', 23.2, 77.4, 0.1], ['Broom_A', 46.4, 79.6, 0.1],
    ['Bucket_1_B', 49.6, 80.2, 1.2], ['Basin_A', 25.6, 81.4, 0.4], ['Stool_A', 29.4, 81.2, 0.2], ['CutedWood_1_B', 23.6, 81.2, 0.6],
    ['Bag_1_B', 30.6, 75.4, 0.2], ['Bag_1_C', 38.4, 75.3, 1.2], ['Bag_2_A', 39.2, 75.6, 0.5], ['Laundry_A', 29.4, 79.4, 0], ['Grinder_A', 21.4, 74.8, 0.3],
    ['Trough_3_A', 32.5, 83.5, 0], ['Trough_1_C', 23.5, 83.4, 0], ['Basin_B', 41.8, 84.2, 0.6], ['Hammer_1_A', 24.2, 81.8, 0.8], ['Rope_1_A', 37.4, 79.2, 0],
    ['Manequin_1_A', 46, 74.4, 0.2],
  ];
  // o que cairia em cima de uma construção ou na frente de uma porta vai para a faixa de terra ao norte, entre as portas
  const spots = [];
  for (let x = 17.5; x < 50; x += 1.9) {
    const inFront = buildings.some((bd) => ENTER(bd) && Math.abs(x - (bd.x + bd.w / 2)) < 1.9);
    if (!inFront) spots.push(x);
  }
  let si = 0;
  const props = raw.map(([m, x, y, rot]) => {
    const hit = buildings.some((bd) => x > bd.x - 0.3 && x < bd.x + bd.w + 0.3 && y > bd.y - 0.3 && y < bd.y + bd.h + 0.3);
    return hit ? { m, x: spots[si++ % spots.length], y: 74.5, rot } : { m, x, y, rot };
  });
  const yard = { x: 15, y: 74, w: 37, h: 8 }; // terra batida em volta das construções
  return { buildings, pens, props, yard };
}

// Retângulo interno (onde os animais andam) de um curral
export const penInner = (p) => ({ x: p.x + 1, y: p.y + 1, w: p.w - 2, h: p.h - 2 });
