# Aethra: A Chama Partida — Documento de Design

## 1. Visão

MMORPG 3D de fantasia sombria com câmera orbital em terceira pessoa, jogado no navegador. Sessões curtas e diretas: entrar, receber uma missão, caçar, evoluir, enfrentar chefes em grupo. O mundo é compartilhado e persistente; o servidor é a autoridade sobre combate, itens e progresso.

## 2. História

### O mundo
Por mil anos a **Chama Primordial**, trazida por Aurelion de além das estrelas, ardeu no Santuário de Lúmen e manteve a **Névoa Cinzenta** — o hálito do Vazio — longe de Aethra. A **Ordem dos Guardiões** a protegia.

### A queda
**Morvath**, Sumo-Guardião da Ordem, passou a ouvir o Vazio. Convencido de que a Chama estava morrendo e de que só fundindo-se ao Vazio poderia salvar o mundo, ele a extinguiu e partiu-a em três **Brasas**:
- **Brasa da Vida** — entregue a Vexa, druida da Floresta Sussurrante, transformada na rainha-aranha **Vex'ara**.
- **Brasa da Terra** — enterrada no peito de **Kragmor**, o golem guardião das minas anãs.
- **Brasa do Espírito** — guardada pelo próprio Morvath, agora o **Rei Cinzento**, no trono de Lúmen.

Quando a Chama se partiu, centelhas caíram do céu e despertaram os **Portadores** — o jogador é um deles.

### Campanha (20 missões)
| Ato | Região | Arco |
|---|---|---|
| I — O Despertar | Alvorada, Campos | Thalric explica a profecia; Bran e Lyra testam o Portador; o eremita Osric revela as "âncoras" da Névoa; derrota de Presa-de-Ferro. |
| II — A Floresta | Floresta Sussurrante | Sylvara descobre que a irmã Vexa virou Vex'ara; goblins e aranhas; a irmã é libertada e a Brasa da Vida recuperada. |
| III — As Profundezas | Minas de Ferro Negro | Durgan e os mineiros transformados em esqueletos; a chave rúnica; Kragmor libertado, Brasa da Terra recuperada. |
| IV — O Rei Cinzento | Ruínas de Cinza | A Última Vigília de Elira; os cultistas Velados e o arrependido Irmão Cael; os cavaleiros caídos; batalha final contra Morvath. |
| Epílogo | Santuário, Alvorada | As três Brasas reacendem a Chama no Altar; o jogador recebe o título **Portador da Chama** e o Coração da Chama. |

Cada Brasa concede bônus permanente: Vida +10% vida, Terra +10% defesa, Espírito +10% poder.

Missões secundárias (gato do Pip, fazendeiro, ervas, forja, xamãs, ents, morcegos, purificação, arena) e **Contratos** repetíveis no Quadro mantêm o jogo após a campanha. Pedras de Memória espalhadas contam a história do mundo.

## 3. Classes

| Classe | Papel | Atributo | Habilidades (nível) |
|---|---|---|---|
| Guerreiro | tanque / corpo a corpo | Força | Golpe Poderoso (1), Grito de Guerra — provoca (3), Investida — atordoa (6), Redemoinho (10), Fúria do Titã (15), Execução (20) |
| Mago | dano mágico / controle | Inteligência | Bola de Fogo (1), Lança de Gelo (3), Escudo Arcano (6), Chuva de Meteoros (10), Teleporte (15), Nova Glacial (20) |
| Arqueiro | dano à distância | Destreza | Tiro Certeiro (1), Flecha Venenosa (3), Rolamento — invulnerável (6), Chuva de Flechas (10), Olho de Falcão (15), Tiro Múltiplo (20) |
| Clérigo | cura / suporte | Inteligência | Luz Sagrada — +50% contra mortos-vivos (1), Cura (2), Bênção (6), Consagração (10), Escudo da Fé (15), Graça Divina — cura em área e ressuscita (20) |

A cada nível: crescimento automático por classe + **3 pontos livres** (Força, Destreza, Inteligência, Vitalidade). Nível máximo 30.

## 4. Fórmulas principais

- XP para o próximo nível: `40·N² + 60·N`; XP de monstro: `10 + 7·N + 0,9·N²`, ajustado pela diferença de nível.
- Vida: `base + vidaPorNível·(N−1) + 8·VIT + itens`; Mana: `base + manaPorNível·(N−1) + 4·INT + itens`.
- Poder: `dano da arma + 1,2·atributo principal + bônus`.
- Defesa: `armadura + 0,6·VIT`. Redução de dano: `DEF / (DEF + 40 + 8·nível do atacante)`.
- Crítico: `5% + 0,12%·DES` (×1,6). Esquiva até 15%. Celeridade reduz o intervalo de ataque.
- Monstros: vida `(35 + 18N + 1,6N²)·mult`, poder `(5 + 3N + 0,06N²)·mult`.
- Morte fora da arena: perde 4% da XP do nível (não perde nível). Arena: sem penalidade, dano JxJ reduzido em 40%.

## 5. Itens e economia

- Raridades: Comum, Incomum (1 afixo), Raro (2), Épico (3), Lendário (4). Afixos: atributos, vida, mana, poder, defesa, crítico, celeridade, roubo de vida, velocidade.
- Lendários únicos dos chefes (Presa de Ferro, Coroa da Tecelã, Coração de Kragmor, Coroa Cinzenta, armas lendárias de Morvath) e o Coração da Chama da campanha.
- Aprimoramento na ferreira (+1 a +10): chance 100%→20%, custo em ouro + Pedras de Aprimoramento; falha a partir de +5 reduz um nível.
- Forja (pedras, armas e armaduras com raridade mínima) e Alquimia (poções, elixires de poder/defesa/velocidade/XP, pergaminhos).
- Saque no chão pertence por 30s a quem marcou o monstro (e seu grupo); depois fica livre; some em 90s.

## 6. Mundo e IA

- Zonas geradas proceduralmente (ruído + caminhos de custo mínimo + verificação de conectividade), determinísticas por semente.
- Monstros: perambulam, percebem jogadores, chamam o bando, perseguem com A*, voltam para casa ao passar da coleira (curando-se), escolhem alvo pela tabela de ameaça.
- Casas visitáveis: cada construção com porta da capital (125) tem paredes finas de colisão e um vão na porta (`shared/housegeom.js`); o servidor valida o movimento contra elas, então não dá para atravessar parede. O A* só entra e sai pela porta. No cliente, os móveis também são sólidos. A porta abre quando o jogador chega perto; por dentro, na 3ª pessoa, o telhado e os andares de cima somem (e as paredes do lado da câmera ficam baixas); em 1ª pessoa aparece o teto. Só o térreo é visitável.
- Interiores (`client/js/three/interiors.js`): cada tipo de construção tem uma planta própria (casa de moradores, ferraria, alquimia, taverna, cofre, salão do castelo, quartel, arsenal, casa da guarda, capela). Os móveis vêm dos packs KayKit; só o que não existia nos packs foi montado em código (`decor.js`: lareira de pedra com fogo, tapetes tecidos, estante de livros, armário, bancos de igreja e balcão). Um posicionador evita sobreposição e mantém livre o caminho da porta.
- Mapa 2D detalhado (`client/js/mapart.js`): cada zona é pintada uma vez, em fatias, numa imagem de até 10 px por tile — terreno com textura e transições suaves, relevo (altura sintética + sombreado com luz do noroeste, penhascos nas cavernas), sombras projetadas, água com espuma, ruas de pedra, casas vistas de cima (telhado de duas águas, chaminé, fachada, porta com degrau), muralhas com ameias, torres, portões, árvores, rochas e objetos pequenos. O minimapa e a janela de mapa só recortam a imagem e desenham os marcadores por cima.
- Chefes: habilidades com aviso no chão (pisada, investida, poças, chuva de meteoros, nova do Vazio), invocações por limiar de vida, fúria, endurecimento e teleporte; reaparecem após alguns minutos.

## 7. Social

Chat por zona, mundo, grupo, clã e sussurro; grupos de até 4 (XP com bônus de 15% por membro, ouro e progresso de caça compartilhados); clãs persistentes; comércio com confirmação dupla que cancela se algo mudar; arena todos-contra-todos com saguão seguro e ranking (nível, chefes, arena).

## 8. Arquitetura técnica

- Servidor Node.js sem dependências: HTTP estático + WebSocket (RFC 6455) próprio, laço a 20 ticks/s, envio de estado incremental por área de interesse, persistência JSON atômica, senhas com scrypt, limites de taxa.
- Movimento previsto no cliente e validado no servidor (velocidade, colisão, linha livre); correções e teleportes com número de sequência.
- Cliente: Three.js (WebGL) com chão em blocos texturizados, modelos KayKit animados por esqueleto, construções e natureza instanciadas, sombras, céu e névoa por zona com ciclo dia/noite, luzes dinâmicas, partículas, transparência do cenário em volta do jogador, rótulos 2D projetados sobre a cena, interpolação de entidades, interface em DOM e áudio sintetizado por WebAudio. Os gráficos se adaptam ao aparelho: a capacidade (GPU, núcleos, memória, tela) escolhe um perfil Mínimo→Ultra, o jogador ajusta cada item ao vivo em Opções > Gráficos (resolução, sombras, distância de visão, partículas, luzes, limite de FPS, medidor de FPS e teste de desempenho) e o ajuste automático reduz a qualidade sozinho em máquinas lentas.
- Personagens KayKit (CC0) carregados como modelos GLB animados por esqueleto (`client/js/three/characters.js`: idle, andar, correr, atacar, conjurar, ferido, morrer, surgir); a ferramenta `tools/bake` gera só os retratos 2D usados na interface. O cenário vem dos packs KayKit Medieval Hexagon, Resource Bits e Dungeon e do Medieval Village MegaKit, convertidos por `tools/medieval` e `tools/village`.

## Reinos e o Reino de Sahaar
- Reinos: `shared/data/kingdoms.js` define cada reino (capital, pacotes de arte e zonas); `zones.js` marca cada zona com seu reino e exporta `kingdomOf` e `hubOf` (capital: zona e ponto de renascimento). O mundo é uma só grade de portais, mas só o reino com jogadores existe na memória: `World.zone(id)` cria a zona sob demanda, `sweepKingdoms()` (1 vez por segundo) descarta o reino que ficou vazio por `kingdomGraceMs` (`KINGDOM_GRACE_MS`, 90 s) e `/status` lista as zonas carregadas. Todo o progresso vive no personagem (`quests`, `visited`, inventário), então descarregar um reino não perde nada; os monstros e chefes do reino voltam do zero quando alguém retorna.
- Travessia: portais entre reinos (Ruínas ↔ Dunas Ardentes) são portais comuns; o cliente (`client/js/kingdoms.js`) baixa os pacotes do reino de destino enquanto segura as mensagens do servidor (`Game.held`) e mostra `#kingdom-transition`; ao chegar aparece o letreiro do reino. Retorno e renascimento usam a capital do reino (`hubOf`); Pedras do Caminho (`tp`) só viajam dentro do reino (o `/ir` do modo DEV vai a qualquer zona); o mapa-múndi e o diário agrupam por reino (a saga de Sahaar tem seção própria).
- Reino de Sahaar (deserto): `zahrim` (cidade, `shared/desertgen.js`), `dunes` (ao ar livre, sementes e características próprias: acampamento, oásis, abrigo de bandidos, santuário, anel de pedras e tesouro) e `tombs` (caverna com piso e muros de arenito, portão, sarcófagos e tochas). Tiles novos: `DUNE`, `SANDSTONE`, `TOMBFLOOR`, `TOMBWALL`; objetos novos: cacto, palmeira, obelisco, sarcófago, urna e arbusto seco. Monstros: escorpião, bandido, feiticeiro, golem de arenito, múmia, guardião dourado e os chefes Skorvax e Amun-Kheb. Missões: saga `sa1`–`sa8` (campo `saga: 'sahaar'`, fora das 20 da campanha) e 4 contratos repetíveis no quadro de Zahrim.
- Zahrim: as torres são estruturas `{ kind: 'house', type: 'voxel', model, maxH, maxScale }`; `NO_DOOR` em `shared/housegeom.js` inclui `voxel` (sem porta, sem sala, área toda bloqueada), então os NPCs ficam ao ar livre. O cliente (`client/js/three/voxel.js`) desenha cada torre com o GLB de `assets/voxel/` (gerado por `tools/voxel/convert.mjs`), em escala que cabe na área e na altura pedida; versão completa perto, `@lod` (12% dos triângulos) até 34 + 2 × alcance dos objetos e escondida além disso.

## Zumbis e céu (pacote do Brackeys)
- Zumbis (`zombie`, `zombie_brute`): modelo do Kenney com as animações Idle/Run/jump do pacote do Brackeys (`ZombieActor` em `characters.js`); sem clipes de andar, atacar ou morrer, o andar é a corrida em câmera lenta, o ataque é o pulo e a morte é uma queda para trás feita por código.
- Céu HDR: `assets/brackeys/sky/sky.hdr` (256×128, sol cortado) vira o `scene.environment` só nos perfis com materiais realistas; a intensidade acompanha o ciclo dia/noite.

## Efeitos de habilidades em shader e armas de Sahaar
- Efeitos (`client/js/three/vfx.js`): portes em GLSL dos shaders CC0 dos pacotes Binbun VFX (Hit, Battle, Elemental, Dark, Status e Explosion FX). As texturas de ruído da Godot viraram ruído de valor calculado no shader (`noi`, `pnoi` para coordenadas polares sem emenda). O `Effects3D` (fx3d.js) chama `vfx.build(e)` para cada evento `proj`, `swing`, `aoe`, `area`, `buff` e `falling`; se devolver verdadeiro o visual é do VFX (`e.v.update(t, now)`), senão cai nos efeitos simples antigos (flechas, teias e o nível Simples). `fx.hit()` (acerto) e `fx.heal()` (sinais de mais) são chamados por `game.js`. O nível vem de `quality().vfx` (0/1/2), por perfil e ajustável em Opções > Gráficos.
- Paletas por estilo de habilidade em `PAL` (principal, secundária, terciária); estilos novos sem paleta usam a de `hit`. Todos os materiais compartilham o relógio `vfxTime`; as geometrias são compartilhadas (`userData.shared`) e só os materiais são descartados com o efeito.
- Armas de Sahaar (`client/js/three/arms.js`, `assets/weapons/weapons.glb`, `tools/weapons/convert.mjs`): carregadas junto com o reino (`kingdoms.assets = ['voxel', 'arms']`). Entram nas mãos de bandidos das dunas (cimitarra e falcata), guardiões dourados (espada e escudo dourados) e do ferreiro Dahmir (martelo), e no saque de armas de nível 30 (cimitarra, arco dourado, martelo) quando o reino já carregou.
- Licenças de tudo o que é de terceiros: `docs/LICENCAS.md`.

## Telas iniciais: cena de abertura e música
- `client/js/three/title.js` desenha no canvas `#backdrop` (um renderer WebGL próprio, criado em `title.start()` e destruído em `title.stop()` ao entrar no jogo). Cena: céu em shader (gradiente de entardecer, estrelas, lua, nuvens), terreno com plataforma plana no altar e colina do castelo (`groundY`), 3 cordilheiras em faixa, modelos KayKit (colunas, tochas, castelo, torres, moinho, montanhas, árvores e pedras instanciadas), chama central com a coluna `lift` e o brilho `flare` de `vfx.js`, as três Brasas em órbitas inclinadas (cometas `proj`), névoa `mist`, brasas e cinzas em `Points`. O nível (0/1/2) vem de `quality().vfx`: 0 corta névoa, cometas, luzes das Brasas e reduz partículas e quadros (30 FPS).
- A câmera orbita o altar (`yaw` oscila ±0,55 rad) e `setViewOffset` desloca a chama para a direita, para o painel de login não cobri-la. Sem WebGL, `startBackdrop()` (main.js) usa o fundo 2D antigo.
- `client/js/music.js` (`menuMusic`) toca `/music/theme.(mp3|ogg|m4a|wav)`; se o arquivo não existir, o botão de som não aparece. Só começa depois de um gesto do jogador, com entrada/saída suaves e suavização das pontas da faixa para a repetição não "pular". `show()` liga (`setMenu(true)`) e `enterGame()` desliga.
