# Aethra: A Chama Partida

Um **MMORPG 2D multiplayer para navegador**, feito do zero: servidor autoritativo em Node.js (sem nenhuma dependência), mundo persistente, combate em tempo real, 4 classes, 6 regiões, 20 missões de campanha com história completa, chefes com mecânicas, itens com raridade e afixos aleatórios, aprimoramento, criação, grupos, clãs, comércio entre jogadores, arena JxJ e ranking.

Os personagens jogáveis, vários NPCs e inimigos humanoides usam os modelos 3D **KayKit Adventurers 2.0** (CC0), pré-renderizados em spritesheets animadas. O restante da arte (mapas, monstros, objetos, ícones, efeitos) e todo o áudio são gerados por código.

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

## O que existe no jogo

- **História**: a campanha "A Chama Partida" em 4 atos + epílogo (20 missões), com diálogos, reviravoltas e final; missões secundárias, contratos repetíveis e pedras de memória com lore.
- **Classes**: Guerreiro, Mago, Arqueiro e Clérigo, cada uma com 6 habilidades (provocar, investida, meteoros, teleporte, chuva de flechas, cura, ressurreição...).
- **Mundo**: Vila de Alvorada (segura), Campos Verdejantes, Floresta Sussurrante, Minas de Ferro Negro, Ruínas de Cinza e Arena de Sangue — mapas procedurais determinísticos, ciclo dia/noite e iluminação dinâmica.
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
client/   jogo no navegador (Canvas 2D, interface, áudio procedural)
assets/kaykit/   modelos 3D originais KayKit (CC0)
tools/bake/      gera as spritesheets a partir dos modelos 3D (Three.js + Chromium)
docs/GAME_DESIGN.md   documento de design: história, mecânicas e fórmulas
```

### Regerar os sprites dos personagens

```bash
cd tools/bake && npm install && node bake.mjs
```

## Créditos

- Personagens 3D: **KayKit Adventurers 2.0** por Kay Lousberg — www.kaylousberg.com (licença CC0).
- Fontes: Cinzel e Alegreya Sans (Google Fonts).
