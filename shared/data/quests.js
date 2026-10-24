// Missões: a campanha principal "A Chama Partida", missões secundárias e contratos repetíveis.
// Objetivos: kill (target: id ou lista de ids), collect (item), talk (npc), pvp (abates na arena)
// main: campanha principal "A Chama Partida" · saga: campanha de um reino (ex.: 'sahaar') · repeatable: contrato do quadro
// {name} é substituído pelo nome do personagem no cliente.

export const QUESTS = {
  // ===================== REINO DE SAHAAR — AS AREIAS ARDENTES =====================
  sa1: {
    id: 'sa1', saga: 'sahaar', act: 'Sahaar', name: 'O Chamado das Areias', giver: 'thalric', turnIn: 'soraya', lvl: 24, prereq: ['ms20'],
    desc: 'Atravesse a Estrada do Sol (norte das Ruínas de Cinza) até Zahrim e fale com a Emira Soraya, no Palácio do Emir.',
    offer: 'Portador, a Chama voltou a arder, mas a luz que ela acendeu chegou mais longe do que eu esperava.\n\n' +
      'Hoje de manhã um mensageiro de Sahaar, o reino das areias ao norte das Ruínas de Cinza, chegou sem fôlego às nossas portas. ' +
      'A Emira Soraya pede ajuda. A Névoa chegou ao deserto, e lá não há Guardiões para enfrentá-la.\n\n' +
      'Siga para as Ruínas de Cinza e procure o portal ao norte: é a Estrada do Sol. Zahrim fica depois das dunas. ' +
      'Leve poções e água, {name}. E boas botas.',
    progress: 'A Estrada do Sol começa ao norte das Ruínas de Cinza. Zahrim e o Palácio do Emir ficam do outro lado das dunas.',
    complete: 'Então a luz da Chama é verdade. Meus batedores falaram, mas eu precisava ver com meus próprios olhos.\n\n' +
      'Seja bem-vindo a Zahrim, Portador. Aqui, as torres são de barro, mas a promessa é de pedra: ninguém neste reino vai se curvar à Névoa.',
    objectives: [{ type: 'talk', npc: 'soraya' }],
    rewards: { xp: 8000, gold: 800, items: [['pot_hp_4', 3]] },
  },
  sa2: {
    id: 'sa2', saga: 'sahaar', act: 'Sahaar', name: 'Odres Roubados', giver: 'soraya', turnIn: 'karim', lvl: 24, prereq: ['sa1'],
    desc: 'Recupere os odres de água roubados dos Bandidos das Dunas e leve-os a Karim, no acampamento beduíno, a oeste das dunas.',
    offer: 'A água de Zahrim vem do Oásis de Karim, no meio das dunas, e as caravanas que a levavam foram saqueadas. ' +
      'Bandidos das Dunas roubam os odres e vendem aos poços secos por dez vezes o preço.\n\n' +
      'Karim, o chefe dos beduínos, sabe onde eles se escondem. Ajude-o: elimine oito bandidos e recupere quatro odres. ' +
      'Sem água, o reino não dura uma semana.',
    progress: 'Os bandidos se escondem a nordeste do acampamento de Karim. Quatro odres e oito bandidos.',
    complete: 'Água! Água fria e doce do oásis! (Karim bebe um gole e fecha os olhos.)\n\n' +
      'Você tem a bênção das areias, Portador. Mas os bandidos são o menor dos nossos problemas.',
    objectives: [{ type: 'kill', target: 'sand_bandit', count: 8 }, { type: 'collect', item: 'q_water_flask', count: 4 }],
    rewards: { xp: 18000, gold: 1500, items: [['pot_hp_4', 3], ['elixir_speed', 1]] },
  },
  sa3: {
    id: 'sa3', saga: 'sahaar', act: 'Sahaar', name: 'Ninhos Dourados', giver: 'karim', turnIn: 'karim', lvl: 25, prereq: ['sa2'],
    desc: 'Destrua os Escorpiões Dourados no centro das dunas e traga cinco ovos do ninho.',
    offer: 'Os escorpiões sempre existiram, mas nunca vi tantos. Cada ninho rende dez ninhadas por estação, e a Névoa os faz crescer em semanas.\n\n' +
      'Preciso que você mate dez escorpiões e traga cinco dos ovos dourados que eles carregam. ' +
      'Com eles, a minha curandeira prepara um antídoto contra o veneno. Mantenha distância da cauda: uma picada e você sente o sol dentro das veias.',
    progress: 'Os escorpiões patrulham o centro das dunas, entre o acampamento e a estrada para Zahrim.',
    complete: 'Estes ovos... brilham como brasas. (Karim os guarda com cuidado.)\n\n' +
      'Com isso nossa curandeira salva duas dúzias de vidas por semana. Você ganhou um lugar em minha tenda para sempre.',
    objectives: [{ type: 'kill', target: 'scorpion', count: 10 }, { type: 'collect', item: 'q_nest_egg', count: 5 }],
    rewards: { xp: 22000, gold: 1800, items: [['enh_stone', 1], ['pot_mp_3', 4]] },
  },
  sa4: {
    id: 'sa4', saga: 'sahaar', act: 'Sahaar', name: 'A Sede dos Poços', giver: 'karim', turnIn: 'soraya', lvl: 26, prereq: ['sa3'],
    desc: 'Derrote os Feiticeiros das Dunas e os Golens de Arenito, depois fale com a Emira Soraya, em Zahrim.',
    offer: 'Os poços não estão secando por acaso, Portador. Há feiticeiros nas dunas que queimam a água do subsolo para alimentar rituais, ' +
      'e golens de arenito que guardam as fendas por onde eles descem.\n\n' +
      'Mate seis feiticeiros e quatro golens. Depois leve a notícia à Emira. Ela vai querer saber que não é só o sol que está matando o reino.',
    progress: 'Os feiticeiros rondam as ruínas ao leste das dunas. Os golens guardam as fendas.',
    complete: 'Então são mesmo feiticeiros... Agora entendo por que o poço do obelisco secou tão rápido.\n\n' +
      'Obrigada, {name}. Mas ainda falta o pior: a mãe de todos os ninhos. Ela está no coração das dunas.',
    objectives: [{ type: 'kill', target: 'dune_sorcerer', count: 6 }, { type: 'kill', target: 'sand_golem', count: 4 }],
    rewards: { xp: 26000, gold: 2200, items: [['pot_hp_4', 4], ['enh_stone', 1]] },
  },
  sa5: {
    id: 'sa5', saga: 'sahaar', act: 'Sahaar', name: 'A Rainha das Areias', giver: 'soraya', turnIn: 'soraya', lvl: 27, prereq: ['sa4'],
    desc: 'Derrote Skorvax, a Rainha das Areias, no covil a sudeste das dunas, e traga o Ferrão-Selo.',
    offer: 'Todos os ninhos respondem a uma única escorpiã: Skorvax, a Rainha das Areias. Meus avós já a chamavam de lenda; hoje ela é do tamanho de um palácio.\n\n' +
      'Enquanto ela viver, as caravanas não passam e Zahrim não come. Vá ao covil dela, a sudeste das dunas, e derrote-a. ' +
      'Traga o Ferrão-Selo, o selo de cera que ela carrega na cauda: é a prova.\n\n' +
      'Ela chama as filhas quando está ferida e carrega com a força de uma avalanche. Leve aliados.',
    progress: 'O covil de Skorvax é um círculo de rochas a sudeste das dunas. Traga o Ferrão-Selo.',
    complete: '(A Emira segura o selo à luz do sol.)\n\n' +
      'Está feito. Pela primeira vez em um ano, as caravanas vão cruzar as dunas sem medo. Zahrim lhe deve a vida de muita gente, Portador.\n\n' +
      'Mas o sono dos reis-sol... isso é outro assunto. Procure a sacerdotisa Nefer, nas tumbas ao norte.',
    objectives: [{ type: 'kill', target: 'scorpion_queen', count: 1 }, { type: 'collect', item: 'q_stinger_seal', count: 1 }],
    rewards: { xp: 40000, gold: 3500, items: [['enh_stone', 2], ['pot_hp_4', 5]] },
  },
  sa6: {
    id: 'sa6', saga: 'sahaar', act: 'Sahaar', name: 'O Sono dos Reis', giver: 'soraya', turnIn: 'nefer', lvl: 28, prereq: ['sa5'],
    desc: 'Cruze o portão norte de Zahrim até as Tumbas dos Reis-Sol e fale com a Sacerdotisa Nefer.',
    offer: 'Meus ancestrais dormem sob a cidade, mas as tumbas ficam ao norte, no deserto fundo. A última sacerdotisa do Culto do Sol, Nefer, ainda vigia a entrada.\n\n' +
      'À noite, os passos sob o palácio ficaram mais altos. Não ouso entrar lá sozinha. Vá até ela e descubra o que está acontecendo, {name}.',
    progress: 'O portão norte de Zahrim leva às Tumbas dos Reis-Sol. Nefer espera na entrada.',
    complete: 'Soraya me falou de você. Você é quem acendeu a Chama?\n\n' +
      'Então sabe o que é manter uma promessa depois que o mundo esqueceu por que a fez. Entre. Os reis precisam ser lembrados do que juraram.',
    objectives: [{ type: 'talk', npc: 'nefer' }],
    rewards: { xp: 14000, gold: 1500, items: [['pot_mp_3', 5]] },
  },
  sa7: {
    id: 'sa7', saga: 'sahaar', act: 'Sahaar', name: 'As Tábuas Solares', giver: 'nefer', turnIn: 'nefer', lvl: 28, prereq: ['sa6'],
    desc: 'Destrua as Múmias Reais e os Guardiões Dourados e recupere quatro Tábuas Solares.',
    offer: 'Os selos que mantêm os reis dormindo foram arrancados dos sarcófagos pelos próprios servos, enlouquecidos pela Névoa. ' +
      'Nas mãos das múmias e dos guardiões, as Tábuas Solares são armas. Nas minhas, são a cura.\n\n' +
      'Destrua oito múmias e seis guardiões, e traga-me quatro tábuas. Eles foram homens bons. Peça perdão enquanto os liberta.',
    progress: 'As múmias vagam pelas salas centrais e os guardiões, pelas criptas laterais.',
    complete: '(Nefer encaixa as tábuas em um nicho de ouro e todas se acendem.)\n\n' +
      'Dá para ouvir. O sono dos reis voltou, mais fundo. Só falta o último: Amun-Kheb, o mais antigo, o mais orgulhoso. O sono dele não volta sozinho.',
    objectives: [{ type: 'kill', target: 'mummy', count: 8 }, { type: 'kill', target: 'tomb_guard', count: 6 }, { type: 'collect', item: 'q_sun_tablet', count: 4 }],
    rewards: { xp: 35000, gold: 3000, items: [['enh_stone', 2], ['pot_hp_4', 5]] },
  },
  sa8: {
    id: 'sa8', saga: 'sahaar', act: 'Sahaar', name: 'O Rei-Sol', giver: 'nefer', turnIn: 'soraya', lvl: 29, prereq: ['sa7'],
    desc: 'Derrote Amun-Kheb, o Rei-Sol, na câmara real ao norte das Tumbas, e leve a notícia à Emira Soraya.',
    offer: 'Amun-Kheb foi o rei que fundou Zahrim. Quando a Névoa chegou, ele jurou "guardar o reino para sempre" e se enterrou vivo para cumprir a promessa. ' +
      'A Névoa torceu as palavras: agora ele acredita que guardar é impedir que qualquer um entre ou saia.\n\n' +
      'A câmara real fica ao norte, depois das criptas. Ele vai invocar os servos, chamar fogo do céu e, perto do fim, vai arder com a fúria do próprio sol.\n\n' +
      'Não o odeie, Portador. Liberte-o. E leve a última tábua à Emira: ela precisa saber que o sono dele terminou.',
    progress: 'A câmara real fica no norte das Tumbas. Reúna aliados e leve poções de sobra.',
    complete: '(Soraya segura a tábua dourada contra o peito.)\n\n' +
      'Ele descansou. Depois de tantos anos, ele descansou. (Ela fecha os olhos.)\n\n' +
      'Sahaar lhe deve tudo, {name}. O Reino das Areias nunca vai esquecer o Portador que acendeu o sol de novo.',
    objectives: [{ type: 'kill', target: 'sun_king', count: 1 }, { type: 'collect', item: 'q_sun_tablet', count: 1 }],
    rewards: { xp: 60000, gold: 8000, items: [['enh_stone', 3], ['pot_hp_4', 5], ['mat_scarab', 3]] },
  },

  // ===================== ATO I — O DESPERTAR =====================
  ms1: {
    id: 'ms1', main: true, act: 'Ato I', name: 'O Despertar', giver: 'thalric', turnIn: 'bran', lvl: 1,
    desc: 'Thalric pediu que você se apresente à Capitã Bran, no Portão Leste da cidade.',
    offer: 'Calma, calma. Respire. Você dormiu por três dias depois que a luz caiu do céu e atravessou seu peito.\n\n' +
      'Sei que está confuso, {name}, então serei direto: há um mês, a Chama Primordial que ardia no Santuário de Lúmen foi extinta. ' +
      'Morvath, o Sumo-Guardião da minha Ordem, a partiu em três Brasas e as entregou a criaturas da Névoa.\n\n' +
      'Quando a Chama se partiu, centelhas se espalharam por Aethra. Uma delas escolheu você. Isso faz de você um Portador — alguém capaz de carregar a luz.\n\n' +
      'Mas um Portador sem treino é apenas uma vela ao vento. Procure a Capitã Bran, no portão leste. Ela vai testar do que você é capaz.',
    progress: 'A Capitã Bran está no Portão Leste da cidade. Siga a rua do comércio, a leste da Praça da Chama.',
    complete: 'Então você é o tal Portador de quem Thalric tanto fala? Hm. Parece meio... comum. Sem ofensa.\n\nVamos ver se essa centelha serve para alguma coisa além de brilhar no escuro.',
    objectives: [{ type: 'talk', npc: 'bran' }],
    rewards: { xp: 60, gold: 10, items: [['pot_hp_1', 3]] },
  },
  ms2: {
    id: 'ms2', main: true, act: 'Ato I', name: 'Prova de Valor', giver: 'bran', turnIn: 'bran', lvl: 1, prereq: ['ms1'],
    desc: 'Elimine as Gosmas Verdes que infestam os Campos Verdejantes, a leste da cidade.',
    offer: 'As Gosmas Verdes se multiplicaram como praga desde que a Névoa chegou. Elas entopem os poços e corroem as cercas.\n\n' +
      'Saia pelo portão leste e elimine seis delas nos Campos Verdejantes. Se voltar inteiro, conversamos de verdade.\n\n' +
      'Dica de quem já enterrou muitos recrutas: clique em um inimigo para atacá-lo e use suas habilidades com as teclas 1 a 6.',
    progress: 'Seis gosmas. Não é tão difícil assim. Ou é?',
    complete: 'Ha! Voltou coberto de gosma, mas voltou. Talvez Thalric esteja certo sobre você.\n\nPegue isto. Você vai precisar.',
    objectives: [{ type: 'kill', target: ['slime', 'slime_red'], count: 6 }],
    rewards: { xp: 180, gold: 30, items: [['pot_hp_1', 3], ['legs_1', 1]] },
  },
  ms3: {
    id: 'ms3', main: true, act: 'Ato I', name: 'Uivos ao Entardecer', giver: 'lyra', turnIn: 'lyra', lvl: 3, prereq: ['ms2'],
    desc: 'Cace Lobos Cinzentos ao norte dos Campos e traga suas peles para Lyra.',
    offer: 'A capitã me disse que você é bom com... seja lá o que for isso que você usa.\n\n' +
      'Os lobos do norte dos campos ficaram loucos. Atacaram a carroça do Otto ontem e quase levaram o cavalo. ' +
      'Preciso que você abata seis deles e me traga quatro peles. Vou usá-las para estudar o que a Névoa está fazendo com eles.\n\n' +
      'E cuidado: lobos caçam em bando. Se um uivar, os outros vêm.',
    progress: 'Ainda ouço os uivos daqui. Seis lobos e quatro peles, Portador.',
    complete: 'Olhe estas peles... estão acinzentadas por dentro, como se a Névoa tivesse se misturado ao sangue deles.\n\n' +
      'Isso é pior do que eu imaginava. Thalric precisa saber disso. Fale com ele.',
    objectives: [{ type: 'kill', target: 'wolf', count: 6 }, { type: 'collect', item: 'mat_pelt', count: 4 }],
    rewards: { xp: 420, gold: 50, items: [['feet_1', 1]] },
  },
  ms4: {
    id: 'ms4', main: true, act: 'Ato I', name: 'O Eremita da Colina', giver: 'thalric', turnIn: 'osric', lvl: 4, prereq: ['ms3'],
    desc: 'Encontre Osric, o Eremita, em seu santuário a sudeste dos Campos Verdejantes.',
    offer: 'Sangue cinza... então a Névoa já não apenas cerca as criaturas. Ela as transforma por dentro.\n\n' +
      'Há um homem que entende disso melhor do que eu: Osric, um antigo erudito da Ordem que preferiu a solidão às nossas regras. ' +
      'Ele vive em um velho santuário no leste dos Campos Verdejantes.\n\n' +
      'Leve a ele minhas saudações. E, {name}... ele pode ser rabugento. Não leve para o lado pessoal.',
    progress: 'O santuário de Osric fica a sudeste dos Campos, depois da plantação de Gustavo.',
    complete: 'Thalric te mandou? Aquele velho teimoso ainda está vivo? Hah!\n\n' +
      'Sim, sim, sinto a centelha em você. É fraca, mas é verdadeira. Sente-se, Portador. Temos muito o que conversar.',
    objectives: [{ type: 'talk', npc: 'osric' }],
    rewards: { xp: 300, gold: 20 },
  },
  ms5: {
    id: 'ms5', main: true, act: 'Ato I', name: 'Presa-de-Ferro', giver: 'osric', turnIn: 'osric', lvl: 5, prereq: ['ms4'],
    desc: 'Derrote Presa-de-Ferro, o Javali Ancião, em sua toca no extremo sudeste dos Campos.',
    offer: 'A Névoa precisa de âncoras para se espalhar — criaturas poderosas que ela corrompe primeiro e usa como farol.\n\n' +
      'Nestes campos, a âncora é Presa-de-Ferro, o Javali Ancião. Ele guardava estas colinas desde antes de existir Alvorada. ' +
      'Agora, ele espalha a corrupção por onde passa.\n\n' +
      'Derrote-o, e a Névoa perderá força aqui. Ele vive no círculo de pedras a sudeste. Não vá sozinho se não estiver pronto: ' +
      'quando ele bater as patas no chão, saia de perto. E quando ele mirar em você, saia do caminho!',
    progress: 'Presa-de-Ferro ainda vive. Posso sentir a Névoa pulsando a partir da toca dele.',
    complete: 'Sinto... sinto o ar mais leve. Muito bem, Portador. O velho guardião finalmente descansa.\n\n' +
      'Mas o que vi enquanto você lutava me preocupa. A Névoa não vem daqui. Ela vem do leste... da Floresta Sussurrante.',
    objectives: [{ type: 'kill', target: 'boar_boss', count: 1 }],
    rewards: { xp: 900, gold: 120, items: [['pot_hp_2', 3], ['enh_stone', 1]] },
  },
  ms6: {
    id: 'ms6', main: true, act: 'Ato II', name: 'A Floresta Sussurrante', giver: 'osric', turnIn: 'sylvara', lvl: 6, prereq: ['ms5'],
    desc: 'Leve a carta de Osric até a druida Sylvara, no acampamento da Floresta Sussurrante (portal a nordeste dos Campos).',
    offer: 'Há muito tempo, duas irmãs druidas guardavam a Floresta Sussurrante: Sylvara e Vexa. ' +
      'Há um mês, Vexa desapareceu. Na mesma noite em que a Chama se apagou.\n\n' +
      'Não acredito em coincidências, Portador. Leve esta carta a Sylvara. Ela está no acampamento da Guarda, logo depois da entrada da floresta, ' +
      'atravessando o portal a nordeste destes campos.\n\nE {name}... prepare o coração. Acho que sei o que aconteceu com Vexa.',
    progress: 'Sylvara está no acampamento na entrada da floresta. O portal fica a nordeste dos Campos.',
    complete: 'Uma carta de Osric? Ele nunca escreve, a menos que...\n\n(Sylvara lê em silêncio. Suas mãos tremem.)\n\n' +
      'Ele acha que Vexa está viva. E que ela é a âncora da Névoa nesta floresta. Que as árvores tenham piedade... eu também senti, mas não queria acreditar.',
    objectives: [{ type: 'talk', npc: 'sylvara' }],
    rewards: { xp: 600, gold: 40 },
    startItems: [['q_letter', 1]], consumeOnComplete: ['q_letter'],
  },
  ms7: {
    id: 'ms7', main: true, act: 'Ato II', name: 'Saqueadores Verdes', giver: 'kael', turnIn: 'kael', lvl: 6, prereq: ['ms6'],
    desc: 'Derrote goblins e recupere os suprimentos roubados da Cidade de Alvorada.',
    offer: 'Antes de pensar em rainhas e névoas, temos um problema mais imediato: goblins.\n\n' +
      'Eles roubaram metade dos suprimentos que Alvorada mandou para este acampamento. Sem comida e remédios, não aguentamos uma semana.\n\n' +
      'O acampamento goblin fica a nordeste daqui. Elimine oito deles e recupere cinco caixas de suprimentos. Os xamãs também carregam caixas — e sabem curar os outros, então derrube-os primeiro.',
    progress: 'Oito goblins, cinco caixas. Os suprimentos não vão voltar sozinhos.',
    complete: 'Comida! Remédios! Você salvou este acampamento, Portador. Os homens vão brindar ao seu nome esta noite.',
    objectives: [{ type: 'kill', target: ['goblin', 'goblin_shaman'], count: 8 }, { type: 'collect', item: 'q_supplies', count: 5 }],
    rewards: { xp: 1400, gold: 150, items: [['pot_hp_2', 4]] },
  },
  ms8: {
    id: 'ms8', main: true, act: 'Ato II', name: 'Teias da Corrupção', giver: 'sylvara', turnIn: 'sylvara', lvl: 8, prereq: ['ms7'],
    desc: 'Elimine Aranhas Tecelãs no sul da floresta e traga seda para Sylvara.',
    offer: 'Desde que Vexa sumiu, aranhas gigantes surgiram no sul da floresta. Elas tecem teias cinzentas que sufocam as árvores.\n\n' +
      'Preciso da seda delas. Com ela, posso preparar um ritual para rastrear a origem da corrupção — e confirmar meus piores medos.\n\n' +
      'Elimine oito aranhas e traga cinco porções de seda. Cuidado com as presas: o veneno delas queima por dentro.',
    progress: 'A seda, Portador. Preciso saber a verdade.',
    complete: '(Sylvara tece a seda entre os dedos e sussurra palavras antigas. Os fios se acendem em verde... e depois apodrecem em cinza.)\n\n' +
      'É ela. É Vexa. A Névoa a transformou na rainha dessas aranhas. Minha irmã... ela guarda um fragmento da Chama dentro de si.',
    objectives: [{ type: 'kill', target: 'spider', count: 8 }, { type: 'collect', item: 'mat_silk', count: 5 }],
    rewards: { xp: 2000, gold: 180, items: [['enh_stone', 1]] },
  },
  ms9: {
    id: 'ms9', main: true, act: 'Ato II', name: 'A Rainha Tecelã', giver: 'sylvara', turnIn: 'sylvara', lvl: 10, prereq: ['ms8'],
    desc: "Derrote Vex'ara, a Rainha Tecelã, em seu covil no extremo sudeste da floresta, e recupere a Brasa da Vida.",
    offer: 'Não existe cura para o que fizeram com ela. Eu tentei. Por um mês inteiro, eu tentei.\n\n' +
      "O que resta de Vexa agora se chama Vex'ara. Ela guarda a Brasa da Vida, um dos três fragmentos da Chama. " +
      'Enquanto ela viver, a floresta continuará morrendo.\n\n' +
      'Liberte-a, {name}. Por favor. O covil fica no extremo sudeste, depois do ninho das aranhas. ' +
      'Ela vai chamar os filhotes quando estiver ferida, e cuspir veneno no chão sob seus pés. Não fique parado.',
    progress: "Vex'ara ainda vive. As árvores choram a cada noite.",
    complete: '(Quando você entrega a Brasa, ela pulsa em verde e o rosto de Sylvara se ilumina.)\n\n' +
      'Eu ouvi a voz dela. No fim, quando a Névoa a deixou... ela disse meu nome. Ela lembrou de mim.\n\n' +
      'Obrigada, Portador. A Brasa da Vida agora arde em você também — sinto que sua vitalidade cresceu. Leve a notícia a Thalric.',
    objectives: [{ type: 'kill', target: 'vexara', count: 1 }, { type: 'collect', item: 'q_brasa_vida', count: 1 }],
    rewards: { xp: 4000, gold: 350, flag: 'brasa_vida', items: [['pot_hp_2', 5]] },
  },

  // ===================== ATO III — AS PROFUNDEZAS =====================
  ms10: {
    id: 'ms10', main: true, act: 'Ato III', name: 'Ecos da Vitória', giver: 'sylvara', turnIn: 'thalric', lvl: 11, prereq: ['ms9'],
    desc: 'Volte à Cidade de Alvorada e conte a Thalric sobre a Brasa da Vida.',
    offer: 'Thalric precisa saber que a primeira Brasa foi recuperada. Use uma Pedra do Caminho para voltar à cidade mais rápido.',
    progress: 'Thalric espera por você em Alvorada.',
    complete: 'A Brasa da Vida... posso senti-la em você, {name}. Quente como o primeiro sol da primavera.\n\n' +
      'Vexa era uma boa alma. Que a floresta guarde sua memória.\n\nMas não há tempo para luto. Restam duas Brasas.',
    objectives: [{ type: 'talk', npc: 'thalric' }],
    rewards: { xp: 1200, gold: 50 },
  },
  ms11: {
    id: 'ms11', main: true, act: 'Ato III', name: 'As Minas de Ferro Negro', giver: 'thalric', turnIn: 'durgan', lvl: 11, prereq: ['ms10'],
    desc: 'Atravesse o portal ao norte da Floresta Sussurrante e encontre Durgan Barba-de-Ferro nas Minas de Ferro Negro.',
    offer: 'Os anões das Minas de Ferro Negro pararam de mandar minério para Alvorada há semanas. Mandei mensageiros. Nenhum voltou.\n\n' +
      'Temo que a segunda Brasa esteja lá embaixo. Os anões tinham um guardião antigo, um golem chamado Kragmor. ' +
      'Se Morvath corrompeu Vexa, por que não corromperia Kragmor também?\n\n' +
      'A entrada das minas fica ao norte da Floresta Sussurrante. Procure Durgan Barba-de-Ferro, o mestre minerador.',
    progress: 'As Minas de Ferro Negro ficam além do portal no extremo norte da floresta.',
    complete: 'Um Portador! Hah! E eu que já tinha perdido a esperança!\n\nSente-se, sente-se. Tenho cerveja ruim e notícias piores.',
    objectives: [{ type: 'talk', npc: 'durgan' }],
    rewards: { xp: 1600, gold: 80 },
  },
  ms12: {
    id: 'ms12', main: true, act: 'Ato III', name: 'Mineiros Perdidos', giver: 'durgan', turnIn: 'durgan', lvl: 12, prereq: ['ms11'],
    desc: 'Derrote os esqueletos nos túneis oeste e recupere as plaquetas dos mineiros desaparecidos.',
    offer: 'Quarenta mineiros. Quarenta! Desceram para a galeria oeste e nunca mais subiram. ' +
      'Agora, os túneis estão cheios de esqueletos usando os capacetes deles.\n\n' +
      'Eu sei o que são, Portador. São eles. Meus mineiros.\n\n' +
      'Dê descanso a eles. Destrua dez esqueletos e me traga seis plaquetas de identificação. Cada nome merece ser gravado na Pedra dos Mortos.',
    progress: 'Cada plaqueta é um amigo que não voltou para casa.',
    complete: '(Durgan passa os dedos sobre os nomes gravados, um por um.)\n\nBorin... Kili... Dwalin, o velho... Obrigado, Portador. Agora eles podem descansar.',
    objectives: [{ type: 'kill', target: ['skeleton', 'skeleton_archer', 'skeleton_guard'], count: 10 }, { type: 'collect', item: 'q_miner_tag', count: 6 }],
    rewards: { xp: 4200, gold: 400, items: [['pot_hp_3', 3]] },
  },
  ms13: {
    id: 'ms13', main: true, act: 'Ato III', name: 'Pedra e Sombra', giver: 'durgan', turnIn: 'durgan', lvl: 14, prereq: ['ms12'],
    desc: 'Destrua os Golens de Pedra no salão leste e traga Minério de Ferro Negro para Durgan.',
    offer: 'Os golens menores, aqueles que meu povo construiu para carregar minério, também enlouqueceram. ' +
      'Estão bloqueando o caminho para o salão onde Kragmor dorme.\n\n' +
      'Destrua seis deles e traga cinco Minérios de Ferro Negro dos corpos. Com o minério, forjo uma chave para abrir o salão de Kragmor.',
    progress: 'Seis golens e cinco minérios. Golens são lentos, mas batem como uma avalanche.',
    complete: 'Bom minério, bom! (Durgan martela algo na bigorna por longos minutos.)\n\nPronto. A chave rúnica do Salão do Coração. Agora vem a parte difícil.',
    objectives: [{ type: 'kill', target: 'golem', count: 6 }, { type: 'collect', item: 'mat_ore', count: 5 }],
    rewards: { xp: 5500, gold: 450, items: [['enh_stone', 2]] },
  },
  ms14: {
    id: 'ms14', main: true, act: 'Ato III', name: 'O Coração da Montanha', giver: 'durgan', turnIn: 'durgan', lvl: 16, prereq: ['ms13'],
    desc: 'Derrote Kragmor, o Coração da Montanha, no salão ao norte das minas, e recupere a Brasa da Terra.',
    offer: 'Kragmor foi forjado por meu bisavô, Thrain Barba-de-Ferro. Por séculos, nos protegeu de tudo. ' +
      'Agora, uma luz laranja pulsa em seu peito, e ele mata qualquer um que se aproxime.\n\n' +
      'É a Brasa da Terra. Morvath a enterrou no coração dele.\n\n' +
      'Quando ele bater no chão, CORRA para longe — o terremoto quebra ossos. E quando ele se cobrir de cristais, guarde suas forças: nada o fere direito nesse estado.\n\n' +
      'Liberte-o, Portador. E traga a Brasa de volta.',
    progress: 'O Salão do Coração fica no extremo norte das minas.',
    complete: '(Durgan segura um pedaço do núcleo de Kragmor, agora frio e silencioso.)\n\n' +
      'Descanse, velho amigo. Sua vigília terminou.\n\nA Brasa da Terra é sua, Portador. Sinto que sua pele já está mais dura que pedra.',
    objectives: [{ type: 'kill', target: 'kragmor', count: 1 }, { type: 'collect', item: 'q_brasa_terra', count: 1 }],
    rewards: { xp: 9000, gold: 800, flag: 'brasa_terra', items: [['pot_hp_3', 5]] },
  },

  // ===================== ATO IV — O REI CINZENTO =====================
  ms15: {
    id: 'ms15', main: true, act: 'Ato IV', name: 'A Última Vigília', giver: 'durgan', turnIn: 'elira', lvl: 17, prereq: ['ms14'],
    desc: 'Atravesse o túnel a oeste das minas até as Ruínas de Cinza e encontre a Comandante Elira.',
    offer: 'O túnel oeste das minas leva até as Ruínas de Cinza — o que restou do Santuário de Lúmen.\n\n' +
      'Dizem que alguns cavaleiros da Última Vigília ainda resistem por lá, comandados por uma tal Elira. ' +
      'Se Morvath guarda a última Brasa, é lá que ela está.\n\nVá, Portador. E que suas armas nunca enferrujem.',
    progress: 'O túnel para as Ruínas fica no extremo oeste das minas.',
    complete: 'Um Portador com duas Brasas... Thalric não estava delirando, afinal.\n\n' +
      'Sou Elira, comandante do que restou da Última Vigília. Bem-vindo ao fim do mundo.',
    objectives: [{ type: 'talk', npc: 'elira' }],
    rewards: { xp: 4000, gold: 150 },
  },
  ms16: {
    id: 'ms16', main: true, act: 'Ato IV', name: 'Os Velados', giver: 'elira', turnIn: 'elira', lvl: 18, prereq: ['ms15'],
    desc: 'Derrote os Cultistas Velados ao norte das Ruínas e recolha seus sigilos.',
    offer: 'Os Velados são os seguidores de Morvath. Gente comum que ele convenceu de que o Vazio traria a imortalidade.\n\n' +
      'Eles mantêm uma barreira de Névoa ao redor do Santuário com rituais constantes. Cada um carrega um sigilo que alimenta a barreira.\n\n' +
      'Derrote dez cultistas e traga seis sigilos. Sem eles, a barreira cai.',
    progress: 'A barreira ainda está de pé. Precisamos de mais sigilos.',
    complete: '(Elira esmaga os sigilos sob a bota. Ao longe, a Névoa que cobre o Santuário estremece.)\n\nEstá enfraquecendo. Mais um empurrão e a entrada estará aberta.',
    objectives: [{ type: 'kill', target: 'cultist', count: 10 }, { type: 'collect', item: 'q_sigil', count: 6 }],
    rewards: { xp: 11000, gold: 900, items: [['pot_hp_3', 4]] },
  },
  ms17: {
    id: 'ms17', main: true, act: 'Ato IV', name: 'Os Caídos de Lúmen', giver: 'elira', turnIn: 'elira', lvl: 20, prereq: ['ms16'],
    desc: 'Liberte as almas dos Espectros Cinzentos e dos Cavaleiros das Cinzas.',
    offer: 'Os Espectros ao sul eram os sacerdotes de Lúmen. Os Cavaleiros das Cinzas ao noroeste... eram meus irmãos de armas.\n\n' +
      'Morvath os ergueu dos mortos para guardar seu trono. Não posso pedir aos meus homens que matem os próprios irmãos. Mas posso pedir a você.\n\n' +
      'Liberte oito espectros e quatro cavaleiros. Que suas almas encontrem a luz.',
    progress: 'Eles ainda vagam pelas ruínas. Presos entre a vida e o Vazio.',
    complete: 'Senti quando eles partiram. Como um peso saindo dos meus ombros.\n\nObrigada, {name}. Agora não há mais nada entre você e Morvath.',
    objectives: [{ type: 'kill', target: 'wraith', count: 8 }, { type: 'kill', target: 'ash_knight', count: 4 }],
    rewards: { xp: 15000, gold: 1100, items: [['enh_stone', 2], ['pot_hp_4', 3]] },
  },
  ms18: {
    id: 'ms18', main: true, act: 'Ato IV', name: 'O Rei Cinzento', giver: 'elira', turnIn: 'elira', lvl: 22, prereq: ['ms17'],
    desc: 'Enfrente Morvath, o Rei Cinzento, no Santuário de Lúmen a oeste das Ruínas, e recupere a Brasa do Espírito.',
    offer: 'Chegou a hora, Portador.\n\nMorvath está no Santuário, a oeste. Ele guarda a Brasa do Espírito, a última. ' +
      'Ele é mais forte que Vex\'ara e Kragmor juntos. Vai chamar os Velados e os mortos para lutar ao lado dele. ' +
      'Vai fazer chover cinzas em chamas. E quando estiver perto do fim, vai se tornar ainda mais perigoso.\n\n' +
      'Não vá sozinho. Reúna aliados. E quando a Nova do Vazio vier, corra o mais longe que puder.\n\n' +
      'Que a Chama guie seus passos.',
    progress: 'Morvath ainda está sentado no trono de Aurelion. Reúna seus aliados.',
    complete: '(Elira olha para a Brasa do Espírito em suas mãos por um longo momento.)\n\n' +
      'Ele está morto. Depois de tudo... ele está realmente morto.\n\n' +
      'Agora, {name}, você carrega as três Brasas. Leve-as ao Altar da Chama, no coração do Santuário. Reacenda a luz de Aethra.',
    objectives: [{ type: 'kill', target: 'morvath', count: 1 }, { type: 'collect', item: 'q_brasa_espirito', count: 1 }],
    rewards: { xp: 30000, gold: 3000, flag: 'brasa_espirito' },
  },
  ms19: {
    id: 'ms19', main: true, act: 'Epílogo', name: 'Reacender a Chama', giver: 'elira', turnIn: 'altar', lvl: 22, prereq: ['ms18'],
    desc: 'Leve as três Brasas ao Altar da Chama, no Santuário de Lúmen.',
    offer: 'O altar fica no centro do Santuário, logo acima de onde Morvath caiu. Vá, Portador. Aethra espera por você.',
    progress: 'O Altar da Chama fica no coração do Santuário, a oeste.',
    complete: 'Você ergue as mãos sobre o altar. As três Brasas — Vida, Terra e Espírito — saem do seu peito como pássaros de luz.\n\n' +
      'Elas giram, se tocam, se fundem. Por um instante, o mundo inteiro fica em silêncio.\n\n' +
      'E então a Chama Primordial ruge de volta à vida.\n\n' +
      'A luz varre as Ruínas de Cinza. A Névoa recua, gritando. Ao longe, na Cidade de Alvorada, os sinos começam a tocar sozinhos.\n\n' +
      'Você é, agora e para sempre, um Portador da Chama.',
    objectives: [{ type: 'talk', npc: 'altar' }],
    rewards: { xp: 10000, gold: 500, title: 'Portador da Chama' },
  },
  ms20: {
    id: 'ms20', main: true, act: 'Epílogo', name: 'Alvorada', giver: 'altar', turnIn: 'thalric', lvl: 22, prereq: ['ms19'],
    desc: 'Volte à Cidade de Alvorada e fale com Thalric.',
    offer: 'Uma voz antiga ecoa da Chama: "Volte para casa, Portador. Há alguém esperando por você."',
    progress: 'Thalric espera por você em Alvorada.',
    complete: '(Thalric está de pé na praça, olhando para o leste, onde o céu finalmente está azul.)\n\n' +
      'Eu vi a luz, {name}. Do outro lado do mundo, eu vi.\n\n' +
      'Morvath acreditava que a Chama estava morrendo. Mas a Chama nunca precisou de um guardião perfeito. Precisava de alguém disposto a carregá-la.\n\n' +
      'Isto pertencia a Aurelion. Agora, é seu. O Vazio não esquece, Portador... mas enquanto você viver, a luz terá um defensor.\n\n' +
      '(Ao longe, na Capela da Chama, um sino toca uma única vez. Não há ninguém na corda. Thalric franze a testa e não diz nada.)\n\n' +
      'Continue sua jornada: contratos no Quadro, chefes, equipamentos lendários e a Arena de Sangue esperam por você. E, quando puder, me procure outra vez. Tenho a impressão de que a história ainda não acabou.',
    objectives: [{ type: 'talk', npc: 'thalric' }],
    rewards: { xp: 6000, gold: 1000, items: [['u_flame_amulet', 1]] },
  },

  // ===================== ATO V — A SOMBRA SOB A CHAMA (Alvorada e Pântano das Brumas) =====================
  ms21: {
    id: 'ms21', main: true, act: 'Ato V', name: 'Sinos Sem Badalo', giver: 'thalric', turnIn: 'ysolde', lvl: 22, prereq: ['ms20'],
    desc: 'Os sinos de Alvorada tocam sozinhos à noite. Thalric pediu que você procure a Arquivista Ysolde, no pátio do castelo.',
    offer: 'Você ouviu, não ouviu? Os sinos da Capela da Chama. Tocam à noite, sem ninguém na corda. Três vezes esta semana.\n\n' +
      'Pensei que fosse a Chama reacendendo e o bronze ressoando com ela. Mas o bronze não ressoa assim, {name}. Não com esse ritmo. É um chamado.\n\n' +
      'Há uma pessoa nesta cidade que leu mais que eu sobre o que dorme sob Alvorada: Ysolde, a Arquivista. Ela fica no pátio do castelo, aqui perto. ' +
      'Diga que eu pedi. Ela vai fingir que não quer falar. Insista.',
    progress: 'Ysolde está no pátio do castelo, perto de mim. Ela não costuma sair de lá.',
    complete: 'Thalric te mandou? Ah, o velho teimoso. Entre, entre, mas não toque nos rolos.\n\n' +
      'Os sinos, sim. Eu os ouvi. E não, não é a Chama. Sente-se, Portador. O que vou contar vai custar o seu sono.',
    objectives: [{ type: 'talk', npc: 'ysolde' }],
    rewards: { xp: 6000, gold: 400, items: [['pot_hp_4', 3]] },
  },
  ms22: {
    id: 'ms22', main: true, act: 'Ato V', name: 'O Que Dorme Embaixo', giver: 'ysolde', turnIn: 'anselmo', lvl: 22, prereq: ['ms21'],
    desc: 'Ysolde quer que você veja a laje selada no fundo do cemitério, a sudeste da cidade, e fale com o Irmão Anselmo.',
    offer: 'Todo mundo acha que a Chama Primordial é a coisa mais antiga de Aethra. Não é. É a segunda.\n\n' +
      'Antes de Aurelion acendê-la, houve outra coisa aqui: o Faminto. Não um deus, não um demônio. Uma fome. Aurelion não a destruiu, não conseguiu. Prendeu-a sob o primeiro santuário, ' +
      'e sobre esse santuário construiu uma cidade para que ninguém esquecesse de vigiá-lo. Esta cidade, {name}. Alvorada.\n\n' +
      'A entrada está no fundo do cemitério, sob uma laje com cinco selos. Irmão Anselmo cuida dela. Vá vê-la com os próprios olhos.',
    progress: 'A laje fica no fundo do cemitério, a sudeste, perto da Capela da Chama. Anselmo está lá.',
    complete: 'Ysolde mandou você? Então ela finalmente decidiu falar.\n\n(Anselmo aponta a laje. Cinco discos de metal, um em cada ponta de uma estrela, e todos eles trincados.)\n\n' +
      'Estavam inteiros no mês passado. Agora cada um tem uma rachadura. Quando o último partir, a laje se abre sozinha.',
    objectives: [{ type: 'talk', npc: 'anselmo' }],
    rewards: { xp: 7000, gold: 450 },
  },
  ms23: {
    id: 'ms23', main: true, act: 'Ato V', name: 'Rumo ao Pântano', giver: 'anselmo', turnIn: 'garrett', lvl: 22, prereq: ['ms22'],
    desc: 'Atravesse o Portão Oeste de Alvorada até o Pântano das Brumas e encontre Garrett Pé-de-Lodo, no acampamento dos caçadores.',
    offer: 'Os discos são os Selos de Aurelion. Cinco guardiões receberam um cada, e cada guardião levou o seu para longe de Alvorada, para que nenhuma mão só pudesse abrir a laje.\n\n' +
      'Os registros de Ysolde dizem onde. O primeiro está a oeste, no Pântano das Brumas. O Portão Oeste da cidade foi fechado por vinte anos; abri-o esta manhã.\n\n' +
      'Procure Garrett Pé-de-Lodo, o chefe dos caçadores. Se há alguém vivo que sabe andar naquele lodo, é ele. Pise onde ele pisar, {name}.',
    progress: 'Siga a rua do comércio até o Portão Oeste. O acampamento de Garrett fica logo depois da entrada do pântano.',
    complete: 'Alguém de Alvorada? Pelas lamas! Pensei que ninguém mais lembrasse deste buraco.\n\n(Garrett olha o brasão em seu peito e muda a expressão.)\n\nUm Portador. Então é verdade. Bom. Eu preciso de ajuda, e não é pouca.',
    objectives: [{ type: 'talk', npc: 'garrett' }],
    rewards: { xp: 7000, gold: 450 },
  },
  ms24: {
    id: 'ms24', main: true, act: 'Ato V', name: 'Sapos do Tamanho de Bois', giver: 'garrett', turnIn: 'garrett', lvl: 22, prereq: ['ms23'],
    desc: 'Derrote os Sapos-Boi do Brejo no norte do pântano e traga cinco glândulas para o antídoto de Garrett.',
    offer: 'Primeiro, o básico. Os sapos engordaram. Dez vezes o tamanho de um ano atrás. Comem tudo que se mexe, inclusive meus rapazes.\n\n' +
      'Cada um tem uma glândula no pescoço. Bem preparada, vira antídoto contra o veneno do brejo, e sem antídoto ninguém caminha aqui mais que um dia. ' +
      'Mate dez, traga cinco glândulas. Eles ficam na lagoa ao norte. Cuidado com o salto: se ele bater, você sente.',
    progress: 'A lagoa dos sapos fica ao norte do acampamento. Dez sapos, cinco glândulas.',
    complete: '(Garrett cheira uma glândula e faz uma careta.)\n\nPerfeitas. Vou ferver isto hoje à noite. Com o antídoto, meus homens aguentam uma semana a mais.\n\nVocê tem estômago, Portador.',
    objectives: [{ type: 'kill', target: 'bog_toad', count: 10 }, { type: 'collect', item: 'q_toad_gland', count: 5 }],
    rewards: { xp: 10000, gold: 700, items: [['pot_hp_4', 3], ['enh_stone', 1]] },
  },
  ms25: {
    id: 'ms25', main: true, act: 'Ato V', name: 'A Herbanária', giver: 'garrett', turnIn: 'zelia', lvl: 23, prereq: ['ms24'],
    desc: 'Procure Madre Zélia, a herbanária do brejo, na torre afundada a sudoeste do pântano.',
    offer: 'Você perguntou do Selo. Eu sei de uma única pessoa que conhece o brejo mais que eu: Madre Zélia. Vive numa torre antiga, afundada até a cintura, a sudoeste.\n\n' +
      'Ela não gosta de gente. Gosta menos ainda de armas. Leve as mãos à vista e diga que o Garrett manda lembranças. Ou que eu estou devendo. Qualquer uma das duas funciona.',
    progress: 'A torre de Madre Zélia fica a sudoeste, num círculo de colunas quebradas.',
    complete: 'O Garrett te mandou? Hm. Pelo menos limpou os pés antes de entrar.\n\n(Zélia olha para você por um tempo longo demais.)\n\nVocê carrega o fogo. Dá para sentir daqui. Sente. O brejo não vai gostar, mas vai respeitar.',
    objectives: [{ type: 'talk', npc: 'zelia' }],
    rewards: { xp: 6000, gold: 400 },
  },
  ms26: {
    id: 'ms26', main: true, act: 'Ato V', name: 'Luzes que Enganam', giver: 'zelia', turnIn: 'zelia', lvl: 23, prereq: ['ms25'],
    desc: 'Destrua os Fogos-Fátuos do centro do pântano e traga quatro lanternas verdes para Madre Zélia.',
    offer: 'O Selo está na ilha ao sul, mas ninguém chega lá: as luzes do bosque do meio levam os viajantes para dentro do lodo. Cada luz é uma lanterna que alguém carregou.\n\n' +
      'Mate doze delas e traga quatro lanternas inteiras. Eu as uso para acender um caminho de volta. Uma luz verdadeira contra uma falsa.\n\n' +
      'Não siga nenhuma que não tenha sido você a acender, {name}.',
    progress: 'Os fogos-fátuos estão no bosque do meio, ao leste daqui. Quatro lanternas inteiras.',
    complete: '(Zélia acende uma das lanternas com a ponta do dedo. A luz fica dourada.)\n\nVeja. Ela era de uma menina. Perdeu-se aos nove anos. Agora pode voltar para casa.\n\nObrigada. É a primeira coisa boa que faço em muito tempo.',
    objectives: [{ type: 'kill', target: 'wisp', count: 12 }, { type: 'collect', item: 'q_wisp_lantern', count: 4 }],
    rewards: { xp: 12000, gold: 800, items: [['pot_mp_3', 4]] },
  },
  ms27: {
    id: 'ms27', main: true, act: 'Ato V', name: 'Panelas que Não Esfriam', giver: 'zelia', turnIn: 'zelia', lvl: 24, prereq: ['ms26'],
    desc: 'Derrote as Bruxas do Brejo na choupana a noroeste e recolha cinco amuletos.',
    offer: 'Nem todo mundo que fugiu para o brejo fugiu direito. Há mulheres na choupana a noroeste que aprenderam com a Névoa. As panelas delas nunca esfriam, e o que cozinham ali sobe pela lama.\n\n' +
      'Eram minhas alunas, {name}. Não as odeio. Só preciso que parem. Traga cinco dos amuletos que usam para cozinhar. Sem eles, a Névoa solta o fio.\n\n' +
      'Mate oito. Elas vão prender seus pés com lama e curar umas às outras. Derrube a que cura primeiro.',
    progress: 'A choupana das bruxas fica a noroeste, depois do bosque dos fogos-fátuos.',
    complete: '(Zélia pega os amuletos um a um e os joga numa panela. Fumaça cinza sobe e se desfaz.)\n\nPronto. Agora são só mulheres cansadas, em algum lugar, esperando que eu perdoe. Talvez perdoe.',
    objectives: [{ type: 'kill', target: 'bog_witch', count: 8 }, { type: 'collect', item: 'q_hag_charm', count: 5 }],
    rewards: { xp: 14000, gold: 900, items: [['enh_stone', 1], ['pot_hp_4', 3]] },
  },
  ms28: {
    id: 'ms28', main: true, act: 'Ato V', name: 'Medalhões', giver: 'garrett', turnIn: 'garrett', lvl: 24, prereq: ['ms27'],
    desc: 'Dê descanso aos Afogados do sudeste do pântano e recolha seis medalhões para devolvê-los às famílias.',
    offer: 'Os afogados voltaram do fundo, Portador. Meus próprios pais estão entre eles, aposto, e eu não consigo olhar a cara de nenhum.\n\n' +
      'Todos têm um medalhão no pescoço, com o retrato de quem esperava por eles. Quero os medalhões de volta. Devolvo ao menos o que posso: a lembrança.\n\n' +
      'Doze afogados, seis medalhões. Eles ficam ao sudeste, no cemitério de lama. Não demore: a ilha do Selo é logo depois.',
    progress: 'O cemitério dos afogados fica ao sudeste. Seis medalhões, Portador.',
    complete: '(Garrett abre um medalhão. Dentro, o retrato de uma mulher sorrindo.)\n\nMinha mãe. Eu jurava que era ela.\n\n(Fecha o medalhão devagar.)\n\nObrigado. Agora eu sei que descansou.',
    objectives: [{ type: 'kill', target: 'drowned', count: 12 }, { type: 'collect', item: 'q_drowned_locket', count: 6 }],
    rewards: { xp: 15000, gold: 1000, items: [['pot_hp_4', 4], ['elixir_def', 1]] },
  },
  ms29: {
    id: 'ms29', main: true, act: 'Ato V', name: 'Nhaga, a Mãe-do-Brejo', giver: 'zelia', turnIn: 'ysolde', lvl: 25, prereq: ['ms28'],
    desc: 'Derrote Nhaga na ilha ao sul do pântano e leve o Selo do Brejo à Arquivista Ysolde, em Alvorada.',
    offer: 'É hora, {name}. A ilha ao sul é dela. Nhaga é a mãe de tudo que vive no brejo, e a Névoa a encheu de fome.\n\n' +
      'Ela salta, e onde cai o chão afunda. Cospe lodo fervente em círculos, e quando chama os girinos é porque está com medo. Quando inchar o papo, corra.\n\n' +
      'Traga o Selo do Brejo a Ysolde. E diga a ela que o brejo está livre, ou quase. Diga que a mãe não tinha culpa.',
    progress: 'Nhaga está na ilha ao sul do pântano. O Selo deve ser levado a Ysolde, em Alvorada.',
    complete: '(Ysolde pega o disco de bronze verde com as duas mãos e o deposita num nicho de vidro.)\n\nO primeiro. Um de cinco. Dá para sentir o peso, não é? Não é bronze. É a promessa de uma criatura que ficou onde mandaram.\n\nDescanse um pouco, Portador. O próximo fica embaixo d\'água.',
    objectives: [{ type: 'kill', target: 'nhaga', count: 1 }, { type: 'collect', item: 'q_seal_brejo', count: 1 }],
    rewards: { xp: 40000, gold: 3000, flag: 'selo_brejo', items: [['enh_stone', 2], ['pot_hp_4', 4]] },
  },

  // ===================== ATO VI — AS ÁGUAS MORTAS (Catacumbas Afogadas) =====================
  ms30: {
    id: 'ms30', main: true, act: 'Ato VI', name: 'A Descida', giver: 'ysolde', turnIn: 'beatriz', lvl: 25, prereq: ['ms29'],
    desc: 'Atravesse o Pântano das Brumas até a saída sul e desça às Catacumbas Afogadas. Procure a Irmã Beatriz.',
    offer: 'O segundo selo é das Águas Mortas. Os registros dizem que a Ordem enterrou seu último comandante nas catacumbas sob o pântano, com o disco no peito, e que a água entrou antes da porta fechar.\n\n' +
      'Há uma sacerdotisa lá embaixo, Beatriz, que entrou para enterrar o mestre dela e nunca saiu. Se ainda vive, é a única que sabe o caminho.\n\n' +
      'Atravesse o pântano outra vez, {name}. A saída fica ao sul, depois da ilha de Nhaga.',
    progress: 'As Catacumbas ficam ao sul do Pântano das Brumas. A Irmã Beatriz espera no acampamento da entrada.',
    complete: 'Quem é? Fale baixo, e fale rápido.\n\n(Beatriz vê o brasão e deixa cair o cajado.)\n\nA Chama. Depois de sete anos, a Chama desceu aqui. Que a Ordem me perdoe, eu achei que era o fim.',
    objectives: [{ type: 'talk', npc: 'beatriz' }],
    rewards: { xp: 9000, gold: 600 },
  },
  ms31: {
    id: 'ms31', main: true, act: 'Ato VI', name: 'A Lápide do Comandante', giver: 'beatriz', turnIn: 'beatriz', lvl: 25, prereq: ['ms30'],
    desc: 'Leia a lápide do Comandante Valdric, na entrada das catacumbas, e volte a falar com a Irmã Beatriz.',
    offer: 'Antes de descer, leia a lápide do comandante. Está ao lado do acampamento, meio afundada.\n\n' +
      'Não é para rezar. É para você saber quem vai enfrentar. Eu o conheci, {name}. Valdric era o homem mais teimoso e mais gentil que a Ordem teve. ' +
      'Se você for lutar com ele, lute sabendo que ele ainda está lá dentro.',
    progress: 'A lápide fica perto do acampamento, ao sul da pedra do caminho.',
    complete: 'Leu? "NÃO POSSO." Foi ele mesmo quem escreveu, com a própria espada, quando a água chegou aos joelhos.\n\nAgora sabe. Vamos limpar o caminho até ele, com cuidado e com respeito.',
    objectives: [{ type: 'talk', npc: 'tablet_catacombs' }],
    rewards: { xp: 6000, gold: 400 },
  },
  ms32: {
    id: 'ms32', main: true, act: 'Ato VI', name: 'Nomes Apagados', giver: 'beatriz', turnIn: 'beatriz', lvl: 25, prereq: ['ms31'],
    desc: 'Derrote os Esqueletos Afogados da nave oeste e traga seis insígnias da Ordem.',
    offer: 'Os cavaleiros da Ordem ainda vagam pela nave oeste. Cada um carrega uma insígnia de bronze com o brasão. Os nomes se apagaram com a água, mas as insígnias ainda dizem de que fileira eram.\n\n' +
      'Preciso de seis. Vou limpá-las e gravar de novo os nomes, nem que seja a pedido de um fantasma. Mate doze deles, {name}. Quanto mais gentil for, menos eles sofrem.',
    progress: 'A nave oeste fica ao sudoeste do acampamento. Seis insígnias.',
    complete: '(Beatriz mergulha uma insígnia numa tigela e esfrega devagar.)\n\n"Tomás". "Ilse". "Orvin, o pequeno".\n\nObrigada. Agora eles têm nome de novo.',
    objectives: [{ type: 'kill', target: 'drowned_skeleton', count: 12 }, { type: 'collect', item: 'q_order_badge', count: 6 }],
    rewards: { xp: 16000, gold: 1100, items: [['pot_hp_4', 3], ['enh_stone', 1]] },
  },
  ms33: {
    id: 'ms33', main: true, act: 'Ato VI', name: 'O Ossário', giver: 'beatriz', turnIn: 'beatriz', lvl: 26, prereq: ['ms32'],
    desc: 'Destrua os Carniçais do ossário leste e traga três chaves de osso.',
    offer: 'A passagem para o fundo está fechada por três portões de osso. As chaves estão no ossário leste, nas mãos de quem tentou saquear as criptas e nunca saiu: os carniçais.\n\n' +
      'São rápidos e se alimentam do que sobrou de você. Mate dez, traga três chaves. Evite lutar cercado, {name}. Eles sempre vêm em bando.',
    progress: 'O ossário fica a leste. Três chaves de osso.',
    complete: '(As chaves de osso se encaixam nos portões com um estalo úmido. Um corredor se abre, descendo.)\n\nÉ por aqui que eles passam. E é por aqui que você vai.',
    objectives: [{ type: 'kill', target: 'ghoul', count: 10 }, { type: 'collect', item: 'q_ossuary_key', count: 3 }],
    rewards: { xp: 18000, gold: 1200, items: [['pot_hp_4', 3], ['enh_stone', 1]] },
  },
  ms34: {
    id: 'ms34', main: true, act: 'Ato VI', name: 'Hinos Fúnebres', giver: 'beatriz', turnIn: 'beatriz', lvl: 26, prereq: ['ms33'],
    desc: 'Derrote os Sacerdotes Ossudos do centro das catacumbas e recupere quatro tomos de ritos.',
    offer: 'Os sacerdotes eram meus irmãos. Continuaram os ritos depois de morrer, mas agora cantam para os mortos errados, e cada hino levanta mais um cavaleiro.\n\n' +
      'Preciso dos tomos onde escrevem. Se eu quebrar a sequência, os hinos param. Mate oito sacerdotes e traga quatro tomos. Eles curam uns aos outros: derrube os curandeiros primeiro.',
    progress: 'Os sacerdotes ficam no centro das catacumbas. Quatro tomos.',
    complete: '(Beatriz folheia os tomos e deixa um deles cair. Duas letras diferentes: a primeira, serena; a segunda, quebrada.)\n\nTerminaram o hino com a letra errada. É isso que nos mata. Obrigada, {name}. Agora, só os guardiões.',
    objectives: [{ type: 'kill', target: 'bone_priest', count: 8 }, { type: 'collect', item: 'q_necro_tome', count: 4 }],
    rewards: { xp: 18000, gold: 1200, items: [['pot_mp_3', 5], ['enh_stone', 1]] },
  },
  ms35: {
    id: 'ms35', main: true, act: 'Ato VI', name: 'Os Últimos Guardas', giver: 'beatriz', turnIn: 'beatriz', lvl: 26, prereq: ['ms34'],
    desc: 'Derrote os Guardiões da Cripta nas câmaras sul e traga cinco sigilos de ferro.',
    offer: 'A porta do rei está lacrada por cinco sigilos. Cada um está no peito de um guardião das câmaras sul, que juraram não deixar ninguém passar. Nem os vivos que querem entrar, nem os mortos que querem sair.\n\n' +
      'Seis guardiões, cinco sigilos. Eles se cobrem com os escudos quando feridos. Espere o escudo cair para bater.',
    progress: 'As câmaras sul ficam depois do ossário. Cinco sigilos de guardião.',
    complete: '(Beatriz pressiona os sigilos na porta e a pedra afunda, abrindo um corredor úmido.)\n\nÉ a última porta, {name}. Depois dela, só Valdric. Respire fundo. E depois, respire mais.',
    objectives: [{ type: 'kill', target: 'crypt_warden', count: 6 }, { type: 'collect', item: 'q_warden_sigil', count: 5 }],
    rewards: { xp: 20000, gold: 1400, items: [['pot_hp_4', 4], ['enh_stone', 2]] },
  },
  ms36: {
    id: 'ms36', main: true, act: 'Ato VI', name: 'O Rei Afogado', giver: 'beatriz', turnIn: 'ysolde', lvl: 27, prereq: ['ms35'],
    desc: 'Derrote Valdric, o Rei Afogado, na câmara do fundo das catacumbas e leve o Selo das Águas Mortas a Ysolde, em Alvorada.',
    offer: 'Ele está no fundo, onde a água é mais alta. Ele vai chamar os cavaleiros, depois os guardiões. Vai invocar a maré e, no fim, vai tentar afogar o próprio mundo.\n\n' +
      'Não o odeie. Quando ele cair, diga: "Pode ir". É só o que ele quer ouvir desde o dia em que escreveu NÃO POSSO.\n\n' +
      'Leve o selo a Ysolde. Diga que a Ordem cumpriu a promessa. Tarde, mas cumpriu.',
    progress: 'Valdric aguarda na câmara do fundo. O Selo das Águas Mortas deve ser levado a Ysolde, em Alvorada.',
    complete: '(Ysolde encaixa o disco azul ao lado do verde, e os dois se acendem num tom de aquário.)\n\nDois. A Ordem cumpriu a promessa, Portador. Eu vou escrever isso nos registros com a minha melhor letra.\n\nO próximo é do norte. E é frio.',
    objectives: [{ type: 'kill', target: 'valdric', count: 1 }, { type: 'collect', item: 'q_seal_afogados', count: 1 }],
    rewards: { xp: 50000, gold: 4000, flag: 'selo_afogados', items: [['enh_stone', 2], ['pot_hp_4', 5]] },
  },

  // ===================== ATO VII — O INVERNO ETERNO (Picos Gelados e Cidadela de Gelo) =====================
  ms37: {
    id: 'ms37', main: true, act: 'Ato VII', name: 'Rumo ao Norte', giver: 'ysolde', turnIn: 'hjalmar', lvl: 27, prereq: ['ms36'],
    desc: 'Cruze o Portão Norte de Alvorada até os Picos Gelados e encontre o Capitão Hjalmar, no acampamento da expedição.',
    offer: 'O terceiro selo ficou com um lobo, {name}. Parece piada, mas não é. Vargnar, o guardião dos picos, era o animal mais antigo de Aethra, e a Ordem confiou nele porque nenhum homem aguentaria o frio por tanto tempo.\n\n' +
      'O Portão Norte também foi aberto esta manhã. Uma expedição boreal está acampada logo na entrada, sob o comando do Capitão Hjalmar. Procure-o. Leve roupa quente, ou pelo menos uma boa desculpa.',
    progress: 'Siga o Portão Norte, no bairro nordeste de Alvorada. O acampamento de Hjalmar está na entrada dos picos.',
    complete: 'Mais um? Pensei que ninguém mais viria. Entre, entre, mas deixe a porta como a encontrou.\n\n(Hjalmar vê o brasão e ri alto.)\n\nUm Portador! Por Ymir, o pessoal da expedição vai chorar de alegria.',
    objectives: [{ type: 'talk', npc: 'hjalmar' }],
    rewards: { xp: 10000, gold: 700 },
  },
  ms38: {
    id: 'ms38', main: true, act: 'Ato VII', name: 'A Passagem Norte', giver: 'hjalmar', turnIn: 'hjalmar', lvl: 27, prereq: ['ms37'],
    desc: 'Leia o Marco da Passagem Norte, ao sul do acampamento, e volte a falar com o Capitão Hjalmar.',
    offer: 'Antes de sair, passe no marco da passagem, a coluna coberta de gelo ao sul do acampamento. É um bom ponto de partida e um péssimo lugar para morrer.\n\n' +
      'Leia a inscrição. Ela diz que só entra quem for convidado. A boa notícia é que a Chama conta como convite.',
    progress: 'O marco fica logo ao sul do acampamento, perto da pedra do caminho.',
    complete: 'Leu tudo? Então sabe o que os que vieram antes escreveram: "não vão por aqui". Eles também sabiam.\n\nBom. Vamos ver o que você consegue fazer com o que sobrou do inverno.',
    objectives: [{ type: 'talk', npc: 'stone_peaks' }],
    rewards: { xp: 6000, gold: 400 },
  },
  ms39: {
    id: 'ms39', main: true, act: 'Ato VII', name: 'Lobos de Geada', giver: 'hjalmar', turnIn: 'hjalmar', lvl: 27, prereq: ['ms38'],
    desc: 'Derrote os Lobos-de-Gelo da encosta oeste e traga seis presas de geada.',
    offer: 'Vargnar tem uma matilha. Eles eram guardas; hoje caçam os que passam. Já perdemos dois homens para eles.\n\n' +
      'Os lobos do oeste ficam na encosta, entre o acampamento e o rio de gelo. Mate doze e traga seis presas de geada. Vou fazer pontas de lança com elas.\n\n' +
      'Não luta em campo aberto, {name}. Eles saltam. Fique perto de uma rocha.',
    progress: 'A matilha fica na encosta oeste. Seis presas de geada.',
    complete: '(Hjalmar segura uma presa e a gira na luz.)\n\nFria como o coração do inverno. Obrigado, Portador. Hoje meus homens dormem com a lança afiada.',
    objectives: [{ type: 'kill', target: 'frost_wolf', count: 12 }, { type: 'collect', item: 'q_frost_fang', count: 6 }],
    rewards: { xp: 18000, gold: 1200, items: [['pot_hp_4', 3], ['enh_stone', 1]] },
  },
  ms40: {
    id: 'ms40', main: true, act: 'Ato VII', name: 'O Rastro do Yeti', giver: 'hjalmar', turnIn: 'hjalmar', lvl: 27, prereq: ['ms39'],
    desc: 'Derrote os Yetis do desfiladeiro leste e traga três chifres.',
    offer: 'Os yetis. Eram lenda de caçador, até a semana passada. Agora há um em cada desfiladeiro, e batem tão forte que o chão congela onde pisam.\n\n' +
      'O leste está tomado por eles. Mate oito e traga três chifres. Com os chifres, eu faço sinais que carregam o som por vales inteiros. Preciso falar com o resto do mundo, {name}.',
    progress: 'Os yetis rondam o desfiladeiro leste. Três chifres.',
    complete: '(Hjalmar sopra num dos chifres. O som sobe pelas montanhas e demora quase um minuto para morrer.)\n\nOuviu? Isso chega até Alvorada. Se alguém ouvir, saberá que ainda estamos vivos.',
    objectives: [{ type: 'kill', target: 'yeti', count: 8 }, { type: 'collect', item: 'q_yeti_horn', count: 3 }],
    rewards: { xp: 20000, gold: 1300, items: [['pot_hp_4', 3], ['elixir_str', 1]] },
  },
  ms41: {
    id: 'ms41', main: true, act: 'Ato VII', name: 'O Círculo do Norte', giver: 'hjalmar', turnIn: 'hjalmar', lvl: 28, prereq: ['ms40'],
    desc: 'Derrote os Corvos de Geada e os Xamãs do Gelo no norte dos picos e traga runas e penas.',
    offer: 'Os últimos magos do Círculo do Norte moram no alto dos picos, ao noroeste. Estão vivos, mas mudaram: escolheram o frio, e o frio escolheu de volta.\n\n' +
      'Eles têm runas que acendem, e os corvos carregam penas que mostram a direção da passagem. Preciso de cinco de cada. Mate dez corvos e seis xamãs.\n\n' +
      'Os xamãs prendem os pés no gelo. Leve algo para quebrar o gelo, ou um amigo.',
    progress: 'Os corvos estão ao nordeste, os xamãs ao noroeste. Cinco penas, cinco runas.',
    complete: '(Hjalmar alinha as runas na neve. Elas se acendem em azul e apontam para o norte, como uma bússola.)\n\nÉ o caminho para a Cidadela. Mas antes, o lobo.',
    objectives: [{ type: 'kill', target: 'frost_raven', count: 10 }, { type: 'kill', target: 'frost_mage', count: 6 }, { type: 'collect', item: 'q_raven_feather', count: 5 }, { type: 'collect', item: 'q_frost_rune', count: 5 }],
    rewards: { xp: 22000, gold: 1400, items: [['pot_mp_3', 5], ['enh_stone', 1]] },
  },
  ms42: {
    id: 'ms42', main: true, act: 'Ato VII', name: 'Vargnar, o Lobo do Inverno', giver: 'hjalmar', turnIn: 'ysolde', lvl: 28, prereq: ['ms41'],
    desc: 'Derrote Vargnar no covil a noroeste dos picos e leve o Selo da Geada à Arquivista Ysolde, em Alvorada.',
    offer: 'É ali. Noroeste, atrás do círculo de rochas. Vargnar nunca saiu dali desde que a Névoa chegou.\n\n' +
      'Ele investe de longe, uiva e a nevasca cai, chama a matilha e, no fim, ataca como a própria tempestade. Quando investir, desvie para o lado, não para trás.\n\n' +
      'Leve o selo a Ysolde. E diga a ela que o lobo guardou o que prometeu. Só esqueceu para quem.',
    progress: 'O covil fica a noroeste, atrás do círculo de rochas. O Selo da Geada deve ir para Ysolde, em Alvorada.',
    complete: '(Ysolde coloca o terceiro disco ao lado dos outros dois. A luz muda de cor, fria e prateada.)\n\nTrês. Faltam dois. O próximo está num castelo congelado e quem o guarda era a melhor aluna de Aurelion.\n\nA Cidadela fica depois dos Picos, ao norte. Runa vai te receber.',
    objectives: [{ type: 'kill', target: 'vargnar', count: 1 }, { type: 'collect', item: 'q_seal_geada', count: 1 }],
    rewards: { xp: 55000, gold: 4500, flag: 'selo_geada', items: [['enh_stone', 2], ['pot_hp_4', 5]] },
  },
  ms43: {
    id: 'ms43', main: true, act: 'Ato VII', name: 'O Portão de Gelo', giver: 'ysolde', turnIn: 'runa', lvl: 28, prereq: ['ms42'],
    desc: 'Cruze os Picos Gelados até a Cidadela de Gelo e encontre Runa, a vidente do Círculo do Norte, junto ao portão.',
    offer: 'O quarto selo está na Cidadela de Gelo, a fortaleza boreal da Ordem. Foi construída num dia, dizem, por um mago que não queria perder tempo com pedra.\n\n' +
      'Quem guarda o selo é Kaelisa, a melhor aluna de Aurelion. Há uma vidente do Círculo do Norte, Runa, ainda viva junto ao portão. Fale com ela primeiro. Kaelisa não gosta de visitas, nem de pressa.',
    progress: 'O portal da Cidadela fica ao norte dos Picos Gelados. Runa espera no pátio de entrada.',
    complete: 'Você chegou. Eu vi sua luz da muralha, ontem à noite. É a primeira vez em dez anos que enxergo uma cor aqui.\n\nEntre devagar, {name}. A Cidadela não perdoa passos largos.',
    objectives: [{ type: 'talk', npc: 'runa' }],
    rewards: { xp: 12000, gold: 800 },
  },
  ms44: {
    id: 'ms44', main: true, act: 'Ato VII', name: 'Juramentos Congelados', giver: 'runa', turnIn: 'runa', lvl: 28, prereq: ['ms43'],
    desc: 'Derrote os Cavaleiros Congelados do pátio e da biblioteca e traga seis juramentos.',
    offer: 'Os cavaleiros da Ordem do Norte congelaram em formação no dia em que a Névoa chegou. O gelo os mantém de pé. A Rainha os mantém em marcha.\n\n' +
      'Cada um tem um pergaminho de juramento no peitoral, intacto, porque a tinta congelou antes da água. Traga-me seis. Vou lê-los em voz alta para os outros, e quem sabe isso os faça se lembrar de quem foram.',
    progress: 'Os cavaleiros ficam no pátio oeste e na biblioteca. Seis juramentos.',
    complete: '(Runa lê um dos pergaminhos com a voz quebrada: "Juro guardar a Chama e quem a carrega, até o último frio.")\n\nÉ o que eles prometeram. É o que eles ainda querem cumprir. Obrigada, {name}.',
    objectives: [{ type: 'kill', target: 'frozen_knight', count: 10 }, { type: 'collect', item: 'q_knight_oath', count: 6 }],
    rewards: { xp: 24000, gold: 1600, items: [['pot_hp_4', 4], ['enh_stone', 2]] },
  },
  ms45: {
    id: 'ms45', main: true, act: 'Ato VII', name: 'Corações de Gelo', giver: 'runa', turnIn: 'runa', lvl: 29, prereq: ['ms44'],
    desc: 'Derrote os Golens de Gelo e os Espectros Glaciais dos salões leste e traga quatro núcleos.',
    offer: 'A porta do trono responde ao calor. O gelo dos golens e o frio dos espectros se alimentam do mesmo coração: pequenos núcleos que pulsam devagar.\n\n' +
      'Se eu os reunir, derreto a porta por um minuto. Mate seis golens e dez espectros, e traga quatro núcleos. Os espectros drenam vida, então não deixe nenhum encostar demais.',
    progress: 'Golens e espectros ficam nos salões leste e central. Quatro núcleos de gelo vivo.',
    complete: '(Runa une os núcleos num único bloco. O gelo sobre a grande porta do trono racha e vira vapor.)\n\nPronto. Um minuto. É o tempo que você terá.\n\nAvance, {name}. Não deixe que ela termine antes de você.',
    objectives: [{ type: 'kill', target: 'ice_golem', count: 6 }, { type: 'kill', target: 'frost_wraith', count: 10 }, { type: 'collect', item: 'q_frost_core', count: 4 }],
    rewards: { xp: 26000, gold: 1800, items: [['pot_hp_4', 4], ['pot_mp_3', 5]] },
  },
  ms46: {
    id: 'ms46', main: true, act: 'Ato VII', name: 'A Rainha Gélida', giver: 'runa', turnIn: 'ysolde', lvl: 29, prereq: ['ms45'],
    desc: 'Derrote Kaelisa, a Rainha Gélida, no salão do trono ao norte da Cidadela, e leve o Selo do Inverno a Ysolde, em Alvorada.',
    offer: 'Ela está no trono. Foi lá que prendeu o selo no peito, para o Faminto não o tomar.\n\n' +
      'Vai chamar os espectros, depois os cavaleiros. Vai fazer chover estilhaços, e quando estiver perto do fim, vai tentar congelar o mundo inteiro por um instante. Corra para longe quando o chão ficar branco.\n\n' +
      'Quando ela cair, diga que Runa lembrou. É tudo que ela quer ouvir.',
    progress: 'O salão do trono fica ao norte da Cidadela. O Selo do Inverno deve ir para Ysolde, em Alvorada.',
    complete: '(Ysolde junta o quarto disco aos outros. Um halo azul-claro percorre os quatro, e a luz do aposento diminui, como se algo tivesse inspirado.)\n\nQuatro. E o quinto é o que eu mais temia. O Selo do Sol está em Sahaar, com o rei que se enterrou vivo.\n\nVocê já ajudou aquele reino, {name}? Se sim, Nefer já sabe quem você é.',
    objectives: [{ type: 'kill', target: 'kaelisa', count: 1 }, { type: 'collect', item: 'q_seal_inverno', count: 1 }],
    rewards: { xp: 60000, gold: 5500, flag: 'selo_inverno', items: [['enh_stone', 3], ['pot_hp_4', 5]] },
  },

  // ===================== ATO VIII — O FAMINTO (Sahaar, Alvorada e Cripta da Chama Primeva) =====================
  ms47: {
    id: 'ms47', main: true, act: 'Ato VIII', name: 'O Quinto Selo', giver: 'ysolde', turnIn: 'nefer', lvl: 29, prereq: ['ms46', 'sa8'],
    desc: 'Volte às Ruínas de Cinza, cruze a Estrada do Sol até Zahrim e vá às Tumbas dos Reis-Sol falar com a Sacerdotisa Nefer.',
    offer: 'O último selo é o mais velho: o disco do sol, que Aurelion entregou ao rei de Sahaar. Amun-Kheb o guardou no próprio túmulo.\n\n' +
      'Você libertou o rei, não libertou? Então ele não vai impedir que o selo volte. Mas a sacerdotisa Nefer ainda o vigia. Fale com ela nas tumbas, ao norte de Zahrim.\n\n' +
      'É a viagem mais longa de toda a campanha, {name}. Use os altares. É para isso que existem.',
    progress: 'Nefer espera na entrada das Tumbas dos Reis-Sol, ao norte de Zahrim, no Reino de Sahaar.',
    complete: 'Eu sabia que viria. Os reis sussurraram seu nome na noite em que o sol não se pôs.\n\n(Nefer abre uma câmara lateral, onde um disco dourado repousa sobre uma almofada de linho.)\n\nÉ o selo. O último dos cinco. Leve-o a quem de direito.',
    objectives: [{ type: 'talk', npc: 'nefer' }],
    rewards: { xp: 14000, gold: 1000 },
  },
  ms48: {
    id: 'ms48', main: true, act: 'Ato VIII', name: 'O Disco Dourado', giver: 'nefer', turnIn: 'ysolde', lvl: 29, prereq: ['ms47'],
    desc: 'Leve o Selo do Sol a Ysolde, em Alvorada.',
    offer: 'Leve o disco dourado a Ysolde. A viagem é longa. Se encontrar bandidos pelo caminho, não os mate: eles têm famílias.\n\n' +
      'E {name}... diga a Soraya que a sacerdotisa lembra dela com carinho.',
    progress: 'Ysolde está em Alvorada, no pátio do castelo.',
    complete: '(Ysolde recebe o disco dourado com as duas mãos e o coloca no centro dos outros quatro. Os cinco discos se acendem ao mesmo tempo e um som grave atravessa o castelo.)\n\nCinco. Pela primeira vez em mil anos, os cinco selos estão juntos.\n\nE agora vem a pior parte, Portador. Juntos, eles abrem a laje. Eu precisava que fossem levados até lá por alguém que pudesse atravessá-la.',
    objectives: [{ type: 'talk', npc: 'ysolde' }],
    startItems: [['q_sun_tablet', 1]], consumeOnComplete: ['q_sun_tablet'],
    rewards: { xp: 14000, gold: 1000, flag: 'selo_sol', items: [['pot_hp_4', 5]] },
  },
  ms49: {
    id: 'ms49', main: true, act: 'Ato VIII', name: 'A Laje se Abre', giver: 'ysolde', turnIn: 'anselmo', lvl: 29, prereq: ['ms48'],
    desc: 'Leve os cinco selos à laje no fundo do cemitério e fale com o Irmão Anselmo.',
    offer: 'Anselmo está esperando. Os selos não precisam de você para abrir a laje, mas precisam de um Portador para atravessá-la, ou nada vai impedir que o Faminto saia antes da hora.\n\n' +
      'Vá ao cemitério, {name}. Eu os enviei com um corvo à frente. A laje já deve estar brilhando.',
    progress: 'O cemitério fica a sudeste. Anselmo guarda a laje.',
    complete: '(A laje do cemitério brilha em cinco cores. Uma rachadura de luz sobe do meio e se alarga, revelando uma escada de pedra que desce para o escuro.)\n\nAbriu. Pelos deuses, abriu.\n\nDesça, {name}. Eu fico aqui, rezando para que a escada ainda esteja aí quando você subir.',
    objectives: [{ type: 'talk', npc: 'anselmo' }],
    rewards: { xp: 16000, gold: 1200, flag: 'cripta_aberta', items: [['pot_hp_4', 5], ['pot_mp_3', 5]] },
  },
  ms50: {
    id: 'ms50', main: true, act: 'Ato VIII', name: 'O Eco de Aurelion', giver: 'anselmo', turnIn: 'echo_aurelion', lvl: 29, prereq: ['ms49'],
    desc: 'Desça pela cripta selada do cemitério até a Cripta da Chama Primeva e fale com o Eco de Aurelion.',
    offer: 'A escada leva ao primeiro santuário. Dizem que Aurelion deixou algo de si lá embaixo, uma lembrança que espera por quem vier.\n\n' +
      'Leve poções, flechas, aliados e a coragem que você tem. Que a Chama o proteja, {name}. E se não proteger, que ao menos ilumine.',
    progress: 'A entrada da Cripta fica na laje do fundo do cemitério. O Eco de Aurelion espera no pé da escada.',
    complete: 'Eu esperei, Portador. Não por muito tempo: o tempo, aqui embaixo, é outra coisa.\n\n(O eco de um homem alto e de manto branco se materializa diante de você, o contorno ainda pingando luz.)\n\nVocê trouxe os cinco selos, sem saber que eram cinco. Isso me diz tudo que preciso saber sobre você.',
    objectives: [{ type: 'talk', npc: 'echo_aurelion' }],
    rewards: { xp: 14000, gold: 1000 },
  },
  ms51: {
    id: 'ms51', main: true, act: 'Ato VIII', name: 'Fome com Forma', giver: 'echo_aurelion', turnIn: 'echo_aurelion', lvl: 29, prereq: ['ms50'],
    desc: 'Derrote os Espreitadores do Vazio nas alas oeste e centro da cripta e recolha seis cacos de sombra.',
    offer: 'O Faminto não tem corpo. Tem fome, e a fome toma forma em quem ele devorou. Os espreitadores são essas formas: sombras de quem passou por aqui e nunca saiu.\n\n' +
      'Preciso de cacos da sombra deles para forjar a ponta que vai atravessar o Faminto. Mate doze, traga seis cacos. Eles drenam a vida, {name}. Seja rápido.',
    progress: 'Os espreitadores rondam as alas oeste e centro da cripta. Seis cacos de sombra.',
    complete: '(O eco de Aurelion molda os cacos na palma da mão. Eles pulsam e se encaixam numa ponta de lança sem cabo, feita de escuridão e luz ao mesmo tempo.)\n\nIsto atravessa a fome. Só falta quem a carregue até o coração do Faminto.',
    objectives: [{ type: 'kill', target: 'void_stalker', count: 12 }, { type: 'collect', item: 'q_void_shard', count: 6 }],
    rewards: { xp: 28000, gold: 2000, items: [['pot_hp_4', 5], ['enh_stone', 2]] },
  },
  ms52: {
    id: 'ms52', main: true, act: 'Ato VIII', name: 'Os Vigias Esquecidos', giver: 'echo_aurelion', turnIn: 'echo_aurelion', lvl: 30, prereq: ['ms51'],
    desc: 'Derrote os Cavaleiros do Vazio e os Guardiões Caídos da ala leste e recolha cinco sigilos.',
    offer: 'Eu enterrei aqui os cavaleiros mais leais da Ordem, para vigiar o selo. Vigiaram tempo demais. A fome os tomou, um a um, mas cada um guarda no peito o sigilo de Lúmen, que ainda se acende perto da Chama.\n\n' +
      'Preciso de cinco sigilos. Mate oito cavaleiros e oito guardiões. Eles vão cair de pé, {name}, e é assim que estão em paz.',
    progress: 'Os cavaleiros e os guardiões ficam na ala leste. Cinco sigilos.',
    complete: '(Aurelion pousa os sigilos sobre a lança sombria. A escuridão da lâmina ganha um fio de ouro.)\n\nOs vigias descansam. Obrigado, Portador. É a última coisa que eu podia pedir por eles.',
    objectives: [{ type: 'kill', target: 'void_knight', count: 8 }, { type: 'kill', target: 'fallen_keeper', count: 8 }, { type: 'collect', item: 'q_keeper_seal', count: 5 }],
    rewards: { xp: 30000, gold: 2200, items: [['pot_hp_4', 5], ['enh_stone', 2]] },
  },
  ms53: {
    id: 'ms53', main: true, act: 'Ato VIII', name: 'O Faminto', giver: 'echo_aurelion', turnIn: 'echo_aurelion', lvl: 30, prereq: ['ms52'],
    desc: 'Derrote Nyxthar, o Faminto, no santuário ao norte da cripta e recolha o Coração do Faminto.',
    offer: 'Chegou a hora. Ele está no centro do santuário, onde a Chama primeva ardeu pela primeira vez. Vai chamar as sombras, depois os vigias que eu enterrei. Vai absorver a luz e vai tentar devorar o próprio chão. Perto do fim, a fome vira desespero.\n\n' +
      'Ele fala a verdade, {name}. Não o escute. Não porque minta, mas porque a verdade é a arma dele.\n\n' +
      'Traga o coração que sobrar. Não pode ficar aqui.',
    progress: 'O Faminto está no santuário, ao norte da cripta. Reúna seus aliados.',
    complete: '(O eco de Aurelion estende as mãos para o coração do Faminto, agora frio e silencioso, e o aperta contra o peito. A luz se acende ao redor dele.)\n\nObrigado. Mil anos esperando que alguém terminasse o que eu não consegui.\n\nVá, {name}. Suba. A cidade está esperando por você.',
    objectives: [{ type: 'kill', target: 'nyxthar', count: 1 }, { type: 'collect', item: 'q_faminto_heart', count: 1 }],
    rewards: { xp: 120000, gold: 12000, items: [['enh_stone', 4], ['pot_hp_4', 5], ['mat_ember', 2]] },
  },
  ms54: {
    id: 'ms54', main: true, act: 'Epílogo', name: 'Aurora', giver: 'echo_aurelion', turnIn: 'thalric', lvl: 30, prereq: ['ms53'],
    desc: 'Suba pela escada da cripta e fale com Thalric em Alvorada.',
    offer: 'Suba. Suas mãos ainda brilham, e a luz terá que voltar para quem a espera lá em cima.\n\n' +
      'Eu não vou subir. Fui feito para ficar. Mas diga a Thalric... diga que Aurelion pede desculpas por ter demorado.',
    progress: 'Thalric espera por você em Alvorada.',
    complete: '(Thalric está no pátio do castelo, olhando para o sul, onde o cemitério brilha em ouro.)\n\n' +
      'Os sinos pararam, {name}. Pela primeira vez em um mês, o silêncio. Eu vi a luz subir da laje. Vi.\n\n' +
      'Aurelion sempre disse que a Chama precisava de alguém disposto a carregá-la. Nunca disse que alguém precisaria carregá-la para sempre. Agora você sabe, e o mundo também.\n\n' +
      'Obrigado, Portador. Em nome da Ordem, de Alvorada, de Aethra.\n\n— FIM DA CAMPANHA PRINCIPAL —\nO mundo continua: contratos, relíquias e chefes lendários esperam por você.',
    objectives: [{ type: 'talk', npc: 'thalric' }],
    rewards: { xp: 40000, gold: 8000, title: 'Selador do Faminto', titleMsg: 'selou o Faminto sob Alvorada e tornou-se um', items: [['enh_stone', 5], ['elixir_xp', 3]] },
  },

  // ===================== MISSÕES SECUNDÁRIAS =====================
  sq_cat: {
    id: 'sq_cat', name: 'O Gato do Pip', giver: 'pip', turnIn: 'pip', lvl: 1,
    desc: 'Encontre Bigodes, o gato de Pip, que fugiu para os Campos Verdejantes (perto da lagoa a sudoeste).',
    offer: 'Você viu o Bigodes? Ele é laranja, gordo e muito mal-humorado! Ele fugiu pelo portão ontem e mamãe disse que eu não posso sair da cidade.\n\n' +
      'Acho que ele foi para o sudoeste dos campos, perto da água. Ele adora caçar sapos. Por favor, vê se ele está bem?',
    progress: 'Achou o Bigodes? Ele gosta de água... mesmo dizendo que não.',
    complete: 'Ele está bem?! Que alívio! Ele sempre volta quando fica com fome mesmo...\n\nToma, é tudo que eu tenho. Era pra comprar doce, mas você merece mais!',
    objectives: [{ type: 'talk', npc: 'bigodes' }],
    rewards: { xp: 150, gold: 25, items: [['pot_hp_1', 2]] },
  },
  sq_farm: {
    id: 'sq_farm', name: 'Pragas na Plantação', giver: 'gustavo', turnIn: 'gustavo', lvl: 4,
    desc: 'Afaste os Javalis Selvagens da plantação de Gustavo e traga presas como prova.',
    offer: 'Esses javalis aparecem toda noite e reviram tudo! Minhas abóboras, meu milho, até as cenouras da minha esposa!\n\n' +
      'Abata oito deles e me traga quatro presas. Vou pendurá-las na cerca para assustar os outros.\n\n' +
      'Eles são mansos até você bater neles. Depois disso... bem, corra.',
    progress: 'Ainda vejo marcas de cascos na plantação toda manhã.',
    complete: 'Olha só isso! Quatro presas enormes! Os outros vão pensar duas vezes antes de voltar.\n\nAqui, pelo seu trabalho. E leve umas abóboras... não? Tudo bem, mais para mim.',
    objectives: [{ type: 'kill', target: 'boar', count: 8 }, { type: 'collect', item: 'mat_tusk', count: 4 }],
    rewards: { xp: 650, gold: 90, items: [['head_1', 1]] },
  },
  sq_herbs: {
    id: 'sq_herbs', name: 'Ervas para Fenwick', giver: 'fenwick', turnIn: 'fenwick', lvl: 3,
    desc: 'Colete Ervas Lunares (deixadas por criaturas dos Campos e da Floresta) para o alquimista Fenwick.',
    offer: 'Meu estoque de Erva Lunar acabou! Sem ela, não consigo fazer nem uma poção decente.\n\n' +
      'Os animais dos campos e da floresta vivem comendo as ervas — às vezes você encontra algumas com eles. Me traga cinco e eu te ensino o valor da alquimia.',
    progress: 'Cinco Ervas Lunares, por favor. Os lobos e javalis costumam ter algumas.',
    complete: 'Perfeitas! Frescas, cheirosas... ah, a alquimia!\n\nTome estas poções. E lembre-se: posso transformar materiais em poções e elixires. É só me trazer os ingredientes.',
    objectives: [{ type: 'collect', item: 'mat_herb', count: 5 }],
    rewards: { xp: 450, gold: 40, items: [['pot_mp_2', 3], ['pot_hp_2', 2]] },
  },
  sq_smith: {
    id: 'sq_smith', name: 'O Ofício da Forja', giver: 'brunhilda', turnIn: 'brunhilda', lvl: 5,
    desc: 'Traga Peles de Lobo e Presas de Javali para Brunhilda aprender a forjar Pedras de Aprimoramento.',
    offer: 'Quer ficar mais forte? Não basta matar bichos — precisa de bom equipamento, bem aprimorado.\n\n' +
      'Me traga três Peles de Lobo e duas Presas de Javali. Vou te mostrar como faço Pedras de Aprimoramento, e te dou algumas de presente.',
    progress: 'Três peles e duas presas. Nem mais, nem menos.',
    complete: 'Ótimo material! Veja: misturo a gordura da pele com o pó da presa, aqueço na forja... e pronto!\n\n' +
      'Leve estas pedras. Clique em "Aprimorar" quando falar comigo para fortalecer seus equipamentos. Até +4 nunca falha... depois, é sorte.',
    objectives: [{ type: 'collect', item: 'mat_pelt', count: 3 }, { type: 'collect', item: 'mat_tusk', count: 2 }],
    rewards: { xp: 500, gold: 30, items: [['enh_stone', 3]] },
  },
  sq_shaman: {
    id: 'sq_shaman', name: 'Silenciar os Tambores', giver: 'kael', turnIn: 'kael', lvl: 7, prereq: ['ms6'],
    desc: 'Derrote os Goblins Xamãs que conduzem rituais no nordeste da floresta.',
    offer: 'Está ouvindo esses tambores? São os xamãs goblins, fazendo rituais para a Névoa. Cada noite que tocam, mais goblins aparecem.\n\n' +
      'Silencie seis xamãs. Eles ficam a leste do acampamento goblin.',
    progress: 'Os tambores continuam. Seis xamãs, Portador.',
    complete: 'Silêncio... finalmente. Você não tem ideia de como isso ajuda o moral dos homens.',
    objectives: [{ type: 'kill', target: 'goblin_shaman', count: 6 }],
    rewards: { xp: 1500, gold: 140, items: [['pot_mp_2', 3]] },
  },
  sq_ent: {
    id: 'sq_ent', name: 'Raízes Podres', giver: 'sylvara', turnIn: 'sylvara', lvl: 10, prereq: ['ms7'],
    desc: 'Liberte os Ents Corrompidos no bosque a leste e traga cascas para Sylvara.',
    offer: 'Os Ents eram os anciãos da floresta. Agora, a Névoa apodrece suas raízes e eles atacam tudo que se move.\n\n' +
      'Liberte cinco deles e traga três Cascas Corrompidas. Vou usá-las para curar as árvores jovens.',
    progress: 'Os anciãos ainda sofrem no bosque a leste.',
    complete: 'Estas cascas ainda guardam memória... Vou plantá-las no solo puro. Talvez algo bom brote delas.',
    objectives: [{ type: 'kill', target: 'ent', count: 5 }, { type: 'collect', item: 'mat_bark', count: 3 }],
    rewards: { xp: 2600, gold: 220, items: [['elixir_def', 1]] },
  },
  sq_bats: {
    id: 'sq_bats', name: 'Asas na Escuridão', giver: 'greta', turnIn: 'greta', lvl: 12, prereq: ['ms11'],
    desc: 'Vingue os mineiros da galeria leste eliminando os Morcegos das Cavernas.',
    offer: 'Eles vieram aos milhares. Mordiam, guinchavam, apagavam as tochas. Meus amigos corriam no escuro e caíam nos poços.\n\n' +
      'Mate dez daqueles morcegos e me traga cinco asas. Quero pendurar na entrada da mina para que todos se lembrem.',
    progress: 'Ainda ouço os guinchos à noite.',
    complete: '(Greta segura as asas com as mãos trêmulas.)\n\nNão traz ninguém de volta. Mas ajuda. Obrigada, Portador.',
    objectives: [{ type: 'kill', target: 'bat', count: 10 }, { type: 'collect', item: 'mat_wing', count: 5 }],
    rewards: { xp: 3800, gold: 300, items: [['pot_hp_3', 2]] },
  },
  sq_essence: {
    id: 'sq_essence', name: 'Purificação', giver: 'cael', turnIn: 'cael', lvl: 18, prereq: ['ms15'],
    desc: 'Traga Essências do Vazio para o Irmão Cael purificar.',
    offer: 'Cada Essência do Vazio é um pedaço de alma que Morvath roubou. Se eu puder purificá-las, talvez essas almas encontrem paz.\n\n' +
      'Traga-me seis essências. Os cultistas e espectros as carregam.',
    progress: 'Seis essências. Cada uma é uma alma esperando.',
    complete: '(Cael segura as essências e reza baixinho. Elas brilham, ficam brancas e se dissolvem no ar.)\n\nEstão livres. Tome, isto vai te ajudar a aprender mais rápido.',
    objectives: [{ type: 'collect', item: 'mat_essence', count: 6 }],
    rewards: { xp: 9000, gold: 600, items: [['elixir_xp', 2]] },
  },
  sq_arena: {
    id: 'sq_arena', name: 'Sangue na Areia', giver: 'rurik', turnIn: 'rurik', lvl: 5,
    desc: 'Derrote três outros jogadores na Arena de Sangue.',
    offer: 'Quer provar seu valor contra adversários de verdade? Monstros são previsíveis. Gente, não.\n\n' +
      'Derrote três oponentes na arena e terá meu respeito. E um pouco do meu ouro.',
    progress: 'Três vitórias, guerreiro. A areia está esperando.',
    complete: 'Ha! Você luta bem. A multidão vai gritar seu nome... se houvesse multidão. Pegue seu prêmio.',
    objectives: [{ type: 'pvp', count: 3 }],
    rewards: { xp: 2000, gold: 500, items: [['elixir_str', 2]] },
  },

  // ----- Peregrinação: as Pedras de Memória de todo o mundo -----
  sq_pilgrim1: {
    id: 'sq_pilgrim1', name: 'Peregrino da Memória I', giver: 'ysolde', turnIn: 'ysolde', lvl: 22, prereq: ['ms21'],
    desc: 'Leia as Pedras de Memória de Alvorada, dos Campos, da Floresta, das Minas, das Ruínas e do Pântano das Brumas.',
    offer: 'Aurelion deixou pedras de memória em cada lugar que a Ordem protegeu. Mal se lê metade delas, mas as que sobraram contam a mesma história por ângulos diferentes.\n\n' +
      'Quero que você as leia, {name}. O marco do Portão Norte, a Estátua de Aurelion, a pedra dos Campos, a Árvore-Mãe da Floresta, a placa das Minas, o Mural das Ruínas e o marco dos Afogados no Pântano. ' +
      'Não pelo que dizem: por onde estão. Quem lê todas as sete entende por que a roda de Alvorada tem cinco raios.',
    progress: 'Sete pedras: Portão Norte, Estátua de Aurelion, Campos, Floresta, Minas, Ruínas e Pântano.',
    complete: '(Ysolde risca sete pontos num mapa e os liga com um fio vermelho. Uma roda de cinco raios aparece.)\n\nVeja. A cidade é o centro, as pedras são os raios. Você acaba de caminhar a roda inteira, Portador. Poucos podem dizer isso.',
    objectives: [{ type: 'talk', npc: 'way_town_n' }, { type: 'talk', npc: 'statue' }, { type: 'talk', npc: 'stone_fields' }, { type: 'talk', npc: 'tree_mother' },
      { type: 'talk', npc: 'plaque_mines' }, { type: 'talk', npc: 'mural' }, { type: 'talk', npc: 'stone_swamp' }],
    rewards: { xp: 18000, gold: 1500, items: [['elixir_xp', 2], ['enh_stone', 1]] },
  },
  sq_pilgrim2: {
    id: 'sq_pilgrim2', name: 'Peregrino da Memória II', giver: 'ysolde', turnIn: 'ysolde', lvl: 26, prereq: ['sq_pilgrim1', 'ms36'],
    desc: 'Leia as Pedras de Memória do deserto, das Catacumbas, dos Picos e da Cidadela de Gelo.',
    offer: 'Faltam as pedras do outro lado: as de Sahaar e as do norte. Quatro delas, mais as que pertencem às catacumbas e à Cidadela.\n\n' +
      'O Marco da Estrada do Sol nas Dunas, o Obelisco do Oásis em Zahrim, a lápide do comandante nas Catacumbas, o marco da Passagem Norte nos Picos e o friso da Cidadela de Gelo. ' +
      'É uma volta enorme, Portador. Mas quem a completa leva consigo o título que a Ordem dava a quem lia o mundo todo.',
    progress: 'Cinco pedras: Dunas, Zahrim, Catacumbas, Picos e Cidadela.',
    complete: '(Ysolde fecha o livro e coloca a mão no seu ombro.)\n\nNinguém, nem na Ordem, completou a roda inteira em vida. Eu mesma só li metade. Você leu tudo.\n\nQue o título lhe sirva. Peregrino da Memória.',
    objectives: [{ type: 'talk', npc: 'stone_dunes' }, { type: 'talk', npc: 'obelisk_zahrim' }, { type: 'talk', npc: 'tablet_catacombs' }, { type: 'talk', npc: 'stone_peaks' }, { type: 'talk', npc: 'frieze_citadel' }],
    rewards: { xp: 40000, gold: 4000, title: 'Peregrino da Memória', titleMsg: 'completou a roda das Pedras de Memória e tornou-se um', items: [['elixir_xp', 3], ['enh_stone', 2]] },
  },

  // ----- Pântano das Brumas -----
  sq_swamp_boots: {
    id: 'sq_swamp_boots', name: 'Botas à Prova de Lodo', giver: 'garrett', turnIn: 'garrett', lvl: 22, prereq: ['ms24'],
    desc: 'Traga oito couros de Sapo-Boi para Garrett fazer botas para os caçadores.',
    offer: 'O couro do sapo-boi é a única coisa que aguenta a lama do brejo mais de uma semana. Mande-me oito, que eu faço botas para os rapazes que sobraram.',
    progress: 'Oito couros de Sapo-Boi. Eles andam em volta da lagoa ao norte.',
    complete: 'Perfeito. Botas novas para todos! Agora, só falta dizer aos rapazes que não podem usar para fugir de sapo.',
    objectives: [{ type: 'collect', item: 'mat_toadskin', count: 8 }],
    rewards: { xp: 9000, gold: 700, items: [['elixir_speed', 2], ['pot_hp_4', 2]] },
  },
  sq_swamp_essence: {
    id: 'sq_swamp_essence', name: 'Luz em Frascos', giver: 'zelia', turnIn: 'zelia', lvl: 23, prereq: ['ms26'],
    desc: 'Traga cinco essências de Fogo-Fátuo para a Madre Zélia.',
    offer: 'Uma essência de fogo-fátuo, bem fechada, ilumina uma sala por um ano sem esquentar nada. Tenho vários doentes que não suportam o fogo. Traga-me cinco.',
    progress: 'Cinco essências de Fogo-Fátuo. As luzes do bosque do meio as carregam.',
    complete: 'Tão lindas. Agora as camas dos doentes terão luz sem fogo, e eles dormirão mais tranquilos.',
    objectives: [{ type: 'collect', item: 'mat_wisp', count: 5 }],
    rewards: { xp: 10000, gold: 800, items: [['pot_mp_3', 4], ['elixir_def', 1]] },
  },

  // ----- Catacumbas Afogadas -----
  sq_cat_dust: {
    id: 'sq_cat_dust', name: 'Pó para os Mortos', giver: 'beatriz', turnIn: 'beatriz', lvl: 25, prereq: ['ms31'],
    desc: 'Recolha oito pós de ossário para a Irmã Beatriz consagrar o chão das catacumbas.',
    offer: 'O pó de ossário, misturado com água benta, fecha a boca de um morto inquieto. Preciso de oito punhados. Servem os que carniçais e esqueletos deixam cair.',
    progress: 'Oito punhados de Pó de Ossário.',
    complete: '(Beatriz espalha o pó num círculo ao redor do acampamento. A água no chão recua alguns centímetros.)\n\nVeja. Já ajuda. Obrigada, {name}.',
    objectives: [{ type: 'collect', item: 'mat_gravedust', count: 8 }],
    rewards: { xp: 14000, gold: 1000, items: [['pot_hp_4', 3], ['enh_stone', 1]] },
  },
  sq_cat_ghouls: {
    id: 'sq_cat_ghouls', name: 'Fome nos Corredores', giver: 'beatriz', turnIn: 'beatriz', lvl: 26, prereq: ['ms33'],
    desc: 'Destrua catorze Carniçais que rondam o acampamento da Irmã Beatriz.',
    offer: 'Os carniçais se multiplicam depressa, e quando passam de vinte, já não consigo dormir. Elimine catorze, {name}, e deixe o acampamento respirar.',
    progress: 'Catorze carniçais, nos corredores leste.',
    complete: 'O silêncio voltou. Que bom ter alguém que sabe lutar sem esquecer de quem eram.',
    objectives: [{ type: 'kill', target: 'ghoul', count: 14 }],
    rewards: { xp: 16000, gold: 1100, items: [['pot_hp_4', 3]] },
  },

  // ----- Picos Gelados -----
  sq_peaks_pelts: {
    id: 'sq_peaks_pelts', name: 'Casacos para a Expedição', giver: 'hjalmar', turnIn: 'hjalmar', lvl: 27, prereq: ['ms38'],
    desc: 'Traga oito peles de geada para o Capitão Hjalmar fazer casacos para a expedição.',
    offer: 'Meus homens estão congelando dentro das próprias roupas. Peles de geada seguram o frio melhor que qualquer lã. Traga oito, e eu pago em ouro e em casacos.',
    progress: 'Oito peles de geada. Lobos-de-Gelo e Yetis as carregam.',
    complete: 'Agora sim! Esses casacos aguentam um inverno inteiro. Obrigado, Portador.',
    objectives: [{ type: 'collect', item: 'mat_frostpelt', count: 8 }],
    rewards: { xp: 16000, gold: 1200, items: [['elixir_def', 2], ['pot_hp_4', 3]] },
  },
  sq_peaks_golems: {
    id: 'sq_peaks_golems', name: 'Sentinelas do Passo', giver: 'hjalmar', turnIn: 'hjalmar', lvl: 27, prereq: ['ms40'],
    desc: 'Destrua seis Golens de Gelo que bloqueiam a passagem do norte.',
    offer: 'Existem seis golens de gelo parados no meio da passagem. Parados não, esperando. Se eu tentar passar, acordam. Elimine-os, e abrimos o caminho para a Cidadela.',
    progress: 'Seis golens de gelo, perto do santuário central.',
    complete: 'A passagem está livre. Não sei o que seria de nós sem você.',
    objectives: [{ type: 'kill', target: 'ice_golem', count: 6 }],
    rewards: { xp: 17000, gold: 1200, items: [['enh_stone', 1], ['pot_hp_4', 3]] },
  },

  // ----- Cidadela de Gelo -----
  sq_cit_shards: {
    id: 'sq_cit_shards', name: 'Cristais para a Vidente', giver: 'runa', turnIn: 'runa', lvl: 28, prereq: ['ms43'],
    desc: 'Traga oito estilhas de gelo eterno para Runa reforçar as runas do portão.',
    offer: 'As runas do portão enfraquecem toda noite. Um pouco de gelo eterno fresco as reanima. Traga-me oito estilhas, e eu mantenho a entrada segura até você voltar.',
    progress: 'Oito estilhas de gelo eterno. Todo gelo desta região as carrega.',
    complete: '(Runa embute as estilhas nas runas do portão. Elas brilham em azul.)\n\nVeja. O portão aguenta mais uma noite.',
    objectives: [{ type: 'collect', item: 'mat_frost', count: 8 }],
    rewards: { xp: 20000, gold: 1400, items: [['enh_stone', 1], ['pot_mp_3', 5]] },
  },

  // ----- Cripta da Chama Primeva -----
  sq_under_shards: {
    id: 'sq_under_shards', name: 'Escuridão em Pedaços', giver: 'echo_aurelion', turnIn: 'echo_aurelion', lvl: 29, prereq: ['ms50'],
    desc: 'Recolha seis fragmentos do Vazio para o Eco de Aurelion.',
    offer: 'Posso aprender com a escuridão se a estudar de perto. Traga-me seis fragmentos que as criaturas daqui deixam cair, e eu lhe conto como se vence uma fome.',
    progress: 'Seis fragmentos do Vazio. As criaturas da cripta os carregam.',
    complete: '(O eco gira um fragmento na mão e o devolve a você.)\n\nUma fome só vence outra se estiver cheia. Esse é o segredo, {name}. Nunca lute com fome.',
    objectives: [{ type: 'collect', item: 'mat_voidshard', count: 6 }],
    rewards: { xp: 25000, gold: 1800, items: [['elixir_xp', 2], ['enh_stone', 2]] },
  },

  // ===================== CONTRATOS REPETÍVEIS (Quadro) =====================
  rb_slime: {
    id: 'rb_slime', repeatable: true, name: 'Contrato: Gosmas', giver: 'board', turnIn: 'board', lvl: 1,
    desc: 'Elimine 12 gosmas nos Campos Verdejantes.',
    offer: 'CARTAZ: "Gosmas entupindo os poços de novo. Pagamos por cada dúzia eliminada. — Guarda de Alvorada"',
    progress: 'O contrato ainda está em aberto.', complete: 'Recompensa paga pela Guarda de Alvorada.',
    objectives: [{ type: 'kill', target: ['slime', 'slime_red'], count: 12 }],
    rewards: { xp: 260, gold: 35 },
  },
  rb_wolf: {
    id: 'rb_wolf', repeatable: true, name: 'Contrato: Matilha', giver: 'board', turnIn: 'board', lvl: 3,
    desc: 'Elimine 10 Lobos Cinzentos nos Campos Verdejantes.',
    offer: 'CARTAZ: "Lobos atacando viajantes na estrada leste. Recompensa por cada dez abatidos."',
    progress: 'O contrato ainda está em aberto.', complete: 'Recompensa paga pela Guarda de Alvorada.',
    objectives: [{ type: 'kill', target: 'wolf', count: 10 }],
    rewards: { xp: 650, gold: 60 },
  },
  rb_goblin: {
    id: 'rb_goblin', repeatable: true, name: 'Contrato: Goblins', giver: 'board', turnIn: 'board', lvl: 6,
    desc: 'Elimine 12 goblins na Floresta Sussurrante.',
    offer: 'CARTAZ: "Goblins saqueando caravanas. A Guarda paga por cada dúzia de orelhas verdes."',
    progress: 'O contrato ainda está em aberto.', complete: 'Recompensa paga pela Guarda de Alvorada.',
    objectives: [{ type: 'kill', target: ['goblin', 'goblin_shaman'], count: 12 }],
    rewards: { xp: 1700, gold: 120 },
  },
  rb_spider: {
    id: 'rb_spider', repeatable: true, name: 'Contrato: Aracnídeos', giver: 'board', turnIn: 'board', lvl: 8,
    desc: 'Elimine 10 Aranhas Tecelãs na Floresta Sussurrante.',
    offer: 'CARTAZ: "Aranhas gigantes avistadas perto da estrada da floresta. Recompensa generosa."',
    progress: 'O contrato ainda está em aberto.', complete: 'Recompensa paga pela Guarda de Alvorada.',
    objectives: [{ type: 'kill', target: 'spider', count: 10 }],
    rewards: { xp: 2400, gold: 160 },
  },
  rb_skeleton: {
    id: 'rb_skeleton', repeatable: true, name: 'Contrato: Mortos-Vivos', giver: 'board', turnIn: 'board', lvl: 12,
    desc: 'Destrua 12 esqueletos nas Minas de Ferro Negro.',
    offer: 'CARTAZ: "Os anões pagam em ouro por cada morto-vivo destruído nas minas. — Durgan B. F."',
    progress: 'O contrato ainda está em aberto.', complete: 'Recompensa paga pelos anões de Ferro Negro.',
    objectives: [{ type: 'kill', target: ['skeleton', 'skeleton_archer', 'skeleton_guard'], count: 12 }],
    rewards: { xp: 5200, gold: 300 },
  },
  rb_golem: {
    id: 'rb_golem', repeatable: true, name: 'Contrato: Golens', giver: 'board', turnIn: 'board', lvl: 15,
    desc: 'Destrua 8 Golens de Pedra nas Minas de Ferro Negro.',
    offer: 'CARTAZ: "Golens descontrolados bloqueando túneis. Os anões pagam bem."',
    progress: 'O contrato ainda está em aberto.', complete: 'Recompensa paga pelos anões de Ferro Negro.',
    objectives: [{ type: 'kill', target: 'golem', count: 8 }],
    rewards: { xp: 7000, gold: 380, items: [['mat_crystal', 1]] },
  },
  rb_cultist: {
    id: 'rb_cultist', repeatable: true, name: 'Contrato: Velados', giver: 'board', turnIn: 'board', lvl: 18,
    desc: 'Derrote 12 Cultistas Velados nas Ruínas de Cinza.',
    offer: 'CARTAZ: "Os Velados continuam seus rituais. A Última Vigília paga por cada cultista derrotado."',
    progress: 'O contrato ainda está em aberto.', complete: 'Recompensa paga pela Última Vigília.',
    objectives: [{ type: 'kill', target: 'cultist', count: 12 }],
    rewards: { xp: 11000, gold: 600 },
  },
  rb_zombie: {
    id: 'rb_zombie', repeatable: true, name: 'Contrato: Mortos Famintos', giver: 'board', turnIn: 'board', lvl: 19,
    desc: 'Destrua 14 Zumbis das Cinzas ou Brutamontes Putrefatos nas Ruínas de Cinza.',
    offer: 'CARTAZ: "Os soldados caídos de Lúmen vagam pelas ruínas, ao sul do acampamento. A Última Vigília paga por cada um que descansar de vez."',
    progress: 'O contrato ainda está em aberto.', complete: 'Recompensa paga pela Última Vigília.',
    objectives: [{ type: 'kill', target: ['zombie', 'zombie_brute'], count: 14 }],
    rewards: { xp: 15000, gold: 800 },
  },
  rb_scorpion: {
    id: 'rb_scorpion', repeatable: true, name: 'Contrato: Ninhos de Sahaar', giver: 'board_sahaar', turnIn: 'board_sahaar', lvl: 24,
    desc: 'Elimine 14 Escorpiões Dourados nas Dunas Ardentes.',
    offer: 'CARTAZ: "O emir paga por cada ferrão trazido a Zahrim. Os ninhos crescem mais rápido que a guarda consegue limpá-los."',
    progress: 'O contrato ainda está em aberto.', complete: 'Recompensa paga pelo tesouro do emir.',
    objectives: [{ type: 'kill', target: 'scorpion', count: 14 }],
    rewards: { xp: 16000, gold: 900, items: [['mat_chitin', 2]] },
  },
  rb_sahaar_bandits: {
    id: 'rb_sahaar_bandits', repeatable: true, name: 'Contrato: Saqueadores', giver: 'board_sahaar', turnIn: 'board_sahaar', lvl: 25,
    desc: 'Derrote 12 Bandidos das Dunas e 6 Feiticeiros das Dunas.',
    offer: 'CARTAZ: "Caravanas atacadas na Estrada do Sol. A Guarda do Emir paga bem a quem a mantiver aberta."',
    progress: 'O contrato ainda está em aberto.', complete: 'Recompensa paga pela Guarda do Emir.',
    objectives: [{ type: 'kill', target: 'sand_bandit', count: 12 }, { type: 'kill', target: 'dune_sorcerer', count: 6 }],
    rewards: { xp: 24000, gold: 1400, items: [['pot_hp_4', 2]] },
  },
  rb_mummy: {
    id: 'rb_mummy', repeatable: true, name: 'Contrato: Sono Inquieto', giver: 'board_sahaar', turnIn: 'board_sahaar', lvl: 28,
    desc: 'Destrua 14 Múmias Reais e 8 Guardiões Dourados nas Tumbas dos Reis-Sol.',
    offer: 'CARTAZ: "A sacerdotisa Nefer pede reforços para as tumbas. O emir dobra a recompensa por cada servo libertado."',
    progress: 'O contrato ainda está em aberto.', complete: 'Recompensa paga pelo emir e pelo Culto do Sol.',
    objectives: [{ type: 'kill', target: 'mummy', count: 14 }, { type: 'kill', target: 'tomb_guard', count: 8 }],
    rewards: { xp: 34000, gold: 2200, items: [['enh_stone', 1]] },
  },
  rb_sahaar_bosses: {
    id: 'rb_sahaar_bosses', repeatable: true, name: 'Contrato: Lendas de Sahaar', giver: 'board_sahaar', turnIn: 'board_sahaar', lvl: 30,
    desc: 'Derrote Skorvax e Amun-Kheb novamente.',
    offer: 'CARTAZ: "A Névoa insiste em reerguer os guardiões e as rainhas do deserto. Recompensa máxima para quem derrotar os dois."',
    progress: 'O contrato ainda está em aberto.', complete: 'Recompensa máxima paga pelo emir.',
    objectives: [{ type: 'kill', target: 'scorpion_queen', count: 1 }, { type: 'kill', target: 'sun_king', count: 1 }],
    rewards: { xp: 60000, gold: 5000, items: [['enh_stone', 3], ['mat_scarab', 2]] },
  },
  rb_knight: {
    id: 'rb_knight', repeatable: true, name: 'Contrato: Cavaleiros Caídos', giver: 'board', turnIn: 'board', lvl: 21,
    desc: 'Derrote 8 Cavaleiros das Cinzas e 8 Espectros nas Ruínas de Cinza.',
    offer: 'CARTAZ: "Os mortos de Lúmen não descansam. A Última Vigília precisa de ajuda."',
    progress: 'O contrato ainda está em aberto.', complete: 'Recompensa paga pela Última Vigília.',
    objectives: [{ type: 'kill', target: 'ash_knight', count: 8 }, { type: 'kill', target: 'wraith', count: 8 }],
    rewards: { xp: 20000, gold: 1000, items: [['enh_stone', 1]] },
  },
  rb_bosses: {
    id: 'rb_bosses', repeatable: true, name: 'Contrato: Caçador de Lendas', giver: 'board', turnIn: 'board', lvl: 20,
    desc: "Derrote Presa-de-Ferro, Vex'ara e Kragmor novamente.",
    offer: 'CARTAZ: "A Névoa insiste em reerguer os antigos guardiões corrompidos. Recompensa máxima para quem derrotar os três."',
    progress: 'O contrato ainda está em aberto.', complete: 'Recompensa máxima paga pela Guarda de Alvorada.',
    objectives: [{ type: 'kill', target: 'boar_boss', count: 1 }, { type: 'kill', target: 'vexara', count: 1 }, { type: 'kill', target: 'kragmor', count: 1 }],
    rewards: { xp: 25000, gold: 2000, items: [['enh_stone', 3], ['mat_ember', 1]] },
  },
  rb_bog: {
    id: 'rb_bog', repeatable: true, name: 'Contrato: Brejo Limpo', giver: 'board', turnIn: 'board', lvl: 22,
    desc: 'Elimine 14 Sapos-Boi e 10 Afogados no Pântano das Brumas.',
    offer: 'CARTAZ: "O brejo a oeste volta a engordar. A Guarda paga por sapo e por afogado. Traga a prova, não o cheiro. — Garrett P. L."',
    progress: 'O contrato ainda está em aberto.', complete: 'Recompensa paga pela Guarda de Alvorada.',
    objectives: [{ type: 'kill', target: 'bog_toad', count: 14 }, { type: 'kill', target: 'drowned', count: 10 }],
    rewards: { xp: 18000, gold: 1000, items: [['mat_toadskin', 2]] },
  },
  rb_witches: {
    id: 'rb_witches', repeatable: true, name: 'Contrato: Luzes e Bruxas', giver: 'board', turnIn: 'board', lvl: 23,
    desc: 'Derrote 10 Fogos-Fátuos e 8 Bruxas do Brejo no Pântano das Brumas.',
    offer: 'CARTAZ: "Luzes falsas no brejo, panelas que não esfriam. Madre Zélia e a Guarda pagam o dobro por ambas."',
    progress: 'O contrato ainda está em aberto.', complete: 'Recompensa paga pela Guarda e por Madre Zélia.',
    objectives: [{ type: 'kill', target: 'wisp', count: 10 }, { type: 'kill', target: 'bog_witch', count: 8 }],
    rewards: { xp: 20000, gold: 1100, items: [['mat_wisp', 2]] },
  },
  rb_catacombs: {
    id: 'rb_catacombs', repeatable: true, name: 'Contrato: Mortos da Ordem', giver: 'board', turnIn: 'board', lvl: 25,
    desc: 'Destrua 12 Esqueletos Afogados e 10 Carniçais nas Catacumbas Afogadas.',
    offer: 'CARTAZ: "Os mortos das catacumbas não descansam. A Irmã Beatriz e a Guarda pagam por cada um que descansar de vez."',
    progress: 'O contrato ainda está em aberto.', complete: 'Recompensa paga pela Guarda e pela Irmã Beatriz.',
    objectives: [{ type: 'kill', target: 'drowned_skeleton', count: 12 }, { type: 'kill', target: 'ghoul', count: 10 }],
    rewards: { xp: 24000, gold: 1300, items: [['mat_gravedust', 2]] },
  },
  rb_priests: {
    id: 'rb_priests', repeatable: true, name: 'Contrato: Hinos Interrompidos', giver: 'board', turnIn: 'board', lvl: 26,
    desc: 'Derrote 8 Sacerdotes Ossudos e 6 Guardiões da Cripta nas Catacumbas Afogadas.',
    offer: 'CARTAZ: "Os hinos recomeçaram nas catacumbas. Interrompam-nos. Recompensa generosa."',
    progress: 'O contrato ainda está em aberto.', complete: 'Recompensa paga pela Guarda de Alvorada.',
    objectives: [{ type: 'kill', target: 'bone_priest', count: 8 }, { type: 'kill', target: 'crypt_warden', count: 6 }],
    rewards: { xp: 28000, gold: 1500, items: [['enh_stone', 1]] },
  },
  rb_frost: {
    id: 'rb_frost', repeatable: true, name: 'Contrato: Matilha Branca', giver: 'board', turnIn: 'board', lvl: 22,
    desc: 'Elimine 14 Lobos-de-Gelo e 10 Corvos de Geada nos Picos Gelados.',
    offer: 'CARTAZ: "Lobos e corvos de geada atacam a estrada norte. A expedição de Hjalmar precisa de passagem livre."',
    progress: 'O contrato ainda está em aberto.', complete: 'Recompensa paga pela Guarda e pela Expedição Boreal.',
    objectives: [{ type: 'kill', target: 'frost_wolf', count: 14 }, { type: 'kill', target: 'frost_raven', count: 10 }],
    rewards: { xp: 20000, gold: 1100, items: [['mat_frostpelt', 2]] },
  },
  rb_yeti: {
    id: 'rb_yeti', repeatable: true, name: 'Contrato: Gigantes da Neve', giver: 'board', turnIn: 'board', lvl: 24,
    desc: 'Derrote 8 Yetis, 8 Xamãs do Gelo e 6 Golens de Gelo nos Picos Gelados.',
    offer: 'CARTAZ: "Yetis, xamãs e golens de gelo bloqueiam as passagens. A Expedição Boreal paga em ouro e em favores."',
    progress: 'O contrato ainda está em aberto.', complete: 'Recompensa paga pela Expedição Boreal.',
    objectives: [{ type: 'kill', target: 'yeti', count: 8 }, { type: 'kill', target: 'frost_mage', count: 8 }, { type: 'kill', target: 'ice_golem', count: 6 }],
    rewards: { xp: 26000, gold: 1400, items: [['mat_frost', 2]] },
  },
  rb_citadel: {
    id: 'rb_citadel', repeatable: true, name: 'Contrato: Salões Congelados', giver: 'board', turnIn: 'board', lvl: 27,
    desc: 'Derrote 10 Cavaleiros Congelados e 10 Espectros Glaciais na Cidadela de Gelo.',
    offer: 'CARTAZ: "A Cidadela de Gelo ainda guarda cavaleiros e espectros. Runa, a vidente, paga por cada alma libertada."',
    progress: 'O contrato ainda está em aberto.', complete: 'Recompensa paga por Runa e pela Guarda.',
    objectives: [{ type: 'kill', target: 'frozen_knight', count: 10 }, { type: 'kill', target: 'frost_wraith', count: 10 }],
    rewards: { xp: 32000, gold: 1800, items: [['mat_frost', 3], ['enh_stone', 1]] },
  },
  rb_void: {
    id: 'rb_void', repeatable: true, name: 'Contrato: Fome Sem Fim', giver: 'board', turnIn: 'board', lvl: 29,
    desc: 'Destrua 12 Espreitadores, 8 Cavaleiros do Vazio e 6 Guardiões Caídos na Cripta da Chama Primeva.',
    offer: 'CARTAZ: "A fome sob Alvorada se renova. A Ordem e a Guarda pagam o preço máximo por cada sombra desfeita."',
    progress: 'O contrato ainda está em aberto.', complete: 'Recompensa paga pela Ordem dos Guardiões.',
    objectives: [{ type: 'kill', target: 'void_stalker', count: 12 }, { type: 'kill', target: 'void_knight', count: 8 }, { type: 'kill', target: 'fallen_keeper', count: 6 }],
    rewards: { xp: 40000, gold: 2400, items: [['mat_voidshard', 2], ['enh_stone', 2]] },
  },
  rb_bosses2: {
    id: 'rb_bosses2', repeatable: true, name: 'Contrato: Os Quatro Guardiões', giver: 'board', turnIn: 'board', lvl: 29,
    desc: 'Derrote Nhaga, Valdric, Vargnar e Kaelisa novamente.',
    offer: 'CARTAZ: "Os guardiões dos selos insistem em voltar. Recompensa máxima para quem derrotar os quatro."',
    progress: 'O contrato ainda está em aberto.', complete: 'Recompensa máxima paga pela Guarda de Alvorada.',
    objectives: [{ type: 'kill', target: 'nhaga', count: 1 }, { type: 'kill', target: 'valdric', count: 1 }, { type: 'kill', target: 'vargnar', count: 1 }, { type: 'kill', target: 'kaelisa', count: 1 }],
    rewards: { xp: 70000, gold: 5000, items: [['enh_stone', 3], ['mat_ember', 1]] },
  },
  rb_faminto: {
    id: 'rb_faminto', repeatable: true, name: 'Contrato: O Faminto', giver: 'board', turnIn: 'board', lvl: 30,
    desc: 'Derrote Nyxthar, o Faminto, novamente.',
    offer: 'CARTAZ: "A fome não morre. Recompensa suprema para quem a calar de novo."',
    progress: 'O contrato ainda está em aberto.', complete: 'Recompensa suprema paga pela Ordem.',
    objectives: [{ type: 'kill', target: 'nyxthar', count: 1 }],
    rewards: { xp: 90000, gold: 7000, items: [['enh_stone', 4], ['mat_ember', 2]] },
  },
};

export function questTargets(obj) {
  return Array.isArray(obj.target) ? obj.target : [obj.target];
}
