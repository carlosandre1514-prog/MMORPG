# Aethra: A Chama Partida

Um **MMORPG 3D multiplayer para navegador**, feito do zero: servidor autoritativo em Node.js (sem nenhuma dependência), mundo persistente, combate em tempo real, 4 classes, 6 regiões, 20 missões de campanha com história completa, chefes com mecânicas, itens com raridade e afixos aleatórios, aprimoramento, criação, grupos, clãs, comércio entre jogadores, arena JxJ e ranking.

O mundo é renderizado em **3D com Three.js** (câmera orbital, sombras, ciclo dia/noite, luzes dinâmicas, partículas). Personagens, NPCs e inimigos humanoides são os modelos animados **KayKit Adventurers 2.0**; os mortos-vivos (esqueletos mineiros, arqueiros, guardas e espectros) usam o **KayKit Skeletons**; a capital murada é montada peça por peça (paredes de pedra e enxaimel, portas, janelas que acendem à noite, telhados de telha, chaminés, trepadeiras) com o **Medieval Village MegaKit** da Quaternius, mais muralhas, torres e portões gerados por código; árvores, pedras, montanhas e objetos vêm do **KayKit Medieval Hexagon Pack**; minérios, barras, tecidos e madeira do **KayKit Resource Bits**; pilares, tochas, baús, velas, mesas e estandartes do **KayKit Dungeon** (todos CC0). Criaturas, efeitos, ícones e todo o áudio são gerados por código.

## Como jogar (2 minutos)

Requisito: **Node.js 18+**.

```bash
npm start
```

Abra **http://localhost:3000**, crie uma conta e um personagem. Para jogar com amigos na mesma rede, eles acessam `http://SEU_IP:3000`. Para testar multiplayer sozinho, abra outra aba anônima com outra conta.

### Modo de teste (recomendado para conhecer todo o conteúdo rápido)

```bash
npm run dev        # DEV=1 e XP 3x
```

No modo DEV, use no chat:

| Comando | Efeito |
|---|---|
| `/nivel 20` | sobe para o nível 20 |
| `/ouro 5000` | ganha ouro |
| `/item id [qtd] [raridade 0-4]` | cria um item (`/ids` lista todos) |
| `/ir forest` | viaja para uma zona (`town fields forest mines ruins arena`) |
| `/tp x y` | teleporta dentro da zona |
| `/curar`, `/matar` | cura total / mata o alvo |

Variáveis: `PORT` (padrão 3000), `DATA_DIR` (padrão `./save`), `XP_RATE`, `DEV=1`.

Desempenho: o jogo precisa de WebGL. Se rodar lento, ele reduz a resolução e desliga as sombras sozinho; dá para ligar/desligar as sombras em **Opções**.

## Controles

| Ação | Tecla |
|---|---|
| Andar | WASD / setas, ou clique no chão |
| Atacar / conversar / pegar item | clique no inimigo, NPC ou item |
| Habilidades | 1 – 6 (área e movimento miram no cursor) |
| Poções | Q (vida) · R (mana) |
| Próximo alvo | Tab |
| Interagir com o mais próximo | F / Espaço |
| Janelas | I inventário · C personagem · K habilidades · J missões · M mapa · P grupo · G clã · O ranking · H ajuda |
| Chat | Enter (`/m` mundo, `/g` grupo, `/c` clã, `/s nome` sussurro, `/quem`, `/ajuda`) |
| Opções de jogador | botão direito sobre outro jogador (grupo, comércio, sussurro) |
| Zoom | roda do mouse |
| Girar / inclinar câmera | arrastar com o botão direito (ou do meio) |

## O que existe no jogo

- **História**: a campanha "A Chama Partida" em 4 atos + epílogo (20 missões), com diálogos, reviravoltas e final; missões secundárias, contratos repetíveis e pedras de memória com lore.
- **Classes**: Guerreiro, Mago, Arqueiro e Clérigo, cada uma com 6 habilidades (provocar, investida, meteoros, teleporte, chuva de flechas, cura, ressurreição...).
- **Mundo**: Cidade de Alvorada (capital murada e segura, com castelo, mercado, bairros e becos), Campos Verdejantes, Floresta Sussurrante, Minas de Ferro Negro, Ruínas de Cinza e Arena de Sangue — mapas procedurais determinísticos, ciclo dia/noite e iluminação dinâmica.
- **Combate**: alvo + auto-ataque, projéteis, áreas, críticos, esquiva, escudos, venenos, queimaduras, lentidão, atordoamento, ameaça (aggro), monstros em bando e com coleira.
- **Chefes**: Presa-de-Ferro, Vex'ara, Kragmor e Morvath (3 fases), com ataques telegrafados no chão, invocações, fúria e teleporte.
- **Itens**: 5 raridades, afixos aleatórios, lendários únicos, aprimoramento +1 a +10 com risco, forja e alquimia, loja, baú.
- **Social**: grupos (XP e saque compartilhados), clãs, chat com canais, comércio seguro em duas etapas, arena JxJ e ranking.
- **Persistência**: contas com senha (scrypt), personagens salvos em `save/world.json` automaticamente.

## Testes

```bash
npm test
```

Cobre fórmulas, itens, inventário, consistência dos dados, geração e conectividade dos mapas, a campanha inteira e cenários de ponta a ponta com bots via WebSocket (login, missão, combate, grupo, comércio, chefe, loja, forja, aprimoramento, baú, morte/renascimento, clã e persistência).

## Estrutura

```
server/   servidor (WebSocket próprio, mundo, zonas, IA, combate, missões, social)
shared/   dados e regras usados pelos dois lados (classes, itens, monstros, missões, mapas)
client/   jogo no navegador (Three.js em client/vendor, cena 3D em client/js/three, interface, áudio procedural)
assets/kaykit/   modelos 3D KayKit (CC0): personagens (aventureiros e esqueletos), armas e animações; medieval/, resources/ e dungeon/ com os GLB do cenário
assets/village/  peças modulares e texturas do Medieval Village MegaKit (CC0) para os prédios
tools/bake/      gera os retratos 2D dos personagens a partir dos modelos 3D (Three.js + Chromium)
tools/medieval/  converte os packs KayKit Medieval Hexagon, Resource Bits e Dungeon em GLB compactos para o jogo
tools/village/   converte o Medieval Village MegaKit (FBX + texturas) em assets/village
docs/GAME_DESIGN.md   documento de design: história, mecânicas e fórmulas
```

### Regerar os retratos e o cenário

```bash
cd tools/bake && npm install && node bake.mjs                     # retratos dos personagens
node tools/medieval/convert.mjs <pasta-do-pack> [folha.png] --pack=medieval|resources|dungeon   # natureza, recursos e masmorra
node tools/village/convert.mjs <pasta-com-fbx-e-texturas>          # peças dos prédios
```

## Créditos

- Personagens 3D: **KayKit Adventurers 2.0** por Kay Lousberg — www.kaylousberg.com (licença CC0).
- Cenário 3D: **KayKit Medieval Hexagon Pack**, **Resource Bits**, **Dungeon** e **Skeletons** por Kay Lousberg — www.kaylousberg.com (licença CC0).
- Prédios: **Medieval Village MegaKit** por Quaternius — quaternius.com (licença CC0).
- Motor 3D: **Three.js** (licença MIT).
- Fontes: Cinzel e Alegreya Sans (Google Fonts).

## Capturas

![Pátio do castelo, onde o herói desperta](docs/screenshots/vila.png)
![A capital murada vista de cima](docs/screenshots/cidade-alto.png)
![Mercado](docs/screenshots/mercado.png)
![Praça da Chama à noite, com as janelas acesas](docs/screenshots/noite.png)
![Diálogo de missão](docs/screenshots/dialogo.png)
![Combate nos Campos](docs/screenshots/combate.png)
![Floresta Sussurrante](docs/screenshots/floresta.png)
