// A fazenda dos Campos Verdejantes: onde ficam as construções, os currais, os animais e os adereços. Usado pelo gerador de mapas
// (mapgen.js, que bloqueia as construções, levanta as cercas e abre a lagoa) e entregue ao cliente como "estruturas" do mapa
// (kind 'farm', 'farmprop' e 'pen'), que desenha os modelos de assets/farm e faz os animais andarem dentro dos currais.
// Coordenadas em tiles. Todas as construções têm a frente para o norte (a estrada), os currais ficam atrás delas.

// Tamanho (largura × profundidade, em tiles) que cada construção ocupa e bloqueia
export const FARM_FOOT = {
  TowerWindmill: [5, 4], Silo_House: [4, 3], Silo: [3, 3], BigBarn: [5, 6], Barn: [5, 6], SmallBarn: [4, 4], OpenBarn: [4, 4],
  WaterTower: [2, 2], Windmill: [3, 2], Well: [2, 2], ChickenCoop: [2, 2],
};

// Animais por espécie que o cliente sabe desenhar (client/js/three/animals.js)
export const FARM_ANIMALS = ['cow', 'bull', 'horse', 'pig', 'sheep', 'chicken', 'rooster', 'duck', 'goose'];

export function farmLayout() {
  const b = (model, x, y, face = 'n') => ({ model, x, y, w: FARM_FOOT[model][0], h: FARM_FOOT[model][1], face });
  const buildings = [
    b('TowerWindmill', 20, 76), b('Silo_House', 26, 76), b('Silo', 30, 76), b('BigBarn', 34, 76), b('SmallBarn', 46, 77),
    b('Well', 42, 79, 's'), b('WaterTower', 50, 78), b('ChickenCoop', 39, 82, 's'),
  ];
  // gate: lado da cerca ('n' | 's' | 'e' | 'w'), coordenada do primeiro tile do portão e quantos tiles abre
  const pens = [
    { id: 'pasto', x: 8, y: 62, w: 21, h: 9, gate: { side: 's', at: 17, n: 2 }, animals: [['cow', 3], ['bull', 1], ['horse', 2]] },
    { id: 'porcos', x: 20, y: 82, w: 7, h: 4, gate: { side: 'n', at: 22, n: 2 }, animals: [['pig', 3]] },
    { id: 'ovelhas', x: 28, y: 82, w: 9, h: 4, gate: { side: 'n', at: 30, n: 2 }, animals: [['sheep', 5]] },
    { id: 'aves', x: 38, y: 81, w: 12, h: 5, gate: { side: 'n', at: 44, n: 2 }, animals: [['chicken', 5], ['rooster', 1], ['duck', 3], ['goose', 3]], pond: { x: 44, y: 83, w: 4, h: 2 } },
  ];
  // adereços (tiles, centro; rot em radianos; s = escala em tiles por metro, 0,8 por padrão)
  const props = [
    ['Trough_1_A', 12, 63.4, 1.57], ['Trough_2_A', 22, 69.4, 1.57], ['Trough_1_B', 26.5, 66, 0], ['Bag_1_A', 19.6, 69.4, 0.3], ['Bag_3_A', 15.2, 69.3, 1.1], ['Wheel_A', 9.6, 63.2, 0.4], ['CutedWood_1_A', 25.4, 63.6, 0],
    ['Pitchfork_B', 27.8, 64.6, 0.2], ['Bucket_1_A', 10.4, 68.6, 0.5],
    ['Cart_1_A', 41.6, 77.6, 0.15], ['Pitchfork_A', 33.4, 77, 0], ['Pitchfork_C', 25.2, 76.6, 0.1], ['Broom_A', 30.2, 79.6, 0.1],
    ['Bucket_1_B', 44.2, 80.4, 1.2], ['Basin_A', 25.6, 80.8, 0.4], ['Stool_A', 27.4, 80.6, 0.2], ['CutedWood_1_B', 23.6, 80.8, 0.6],
    ['Bag_1_B', 34.6, 74.9, 0.2], ['Bag_1_C', 36.4, 75, 1.2], ['Bag_2_A', 35.5, 75.3, 0.5], ['Laundry_A', 28.2, 74.9, 0], ['Grinder_A', 21.4, 74.8, 0.3],
    ['Trough_3_A', 32.5, 83.5, 0], ['Trough_1_C', 23.5, 83.4, 0], ['Basin_B', 41.8, 84.2, 0.6], ['Hammer_1_A', 24.2, 81.4, 0.8], ['Rope_1_A', 37.4, 77.2, 0],
    ['Manequin_1_A', 43, 72, 0.2],
  ].map(([m, x, y, rot]) => ({ m, x, y, rot }));
  const yard = { x: 19, y: 75, w: 31, h: 7 }; // terra batida em volta das construções
  return { buildings, pens, props, yard };
}

// Retângulo interno (onde os animais andam) de um curral
export const penInner = (p) => ({ x: p.x + 1, y: p.y + 1, w: p.w - 2, h: p.h - 2 });
