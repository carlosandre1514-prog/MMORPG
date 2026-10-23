// Missões: a campanha principal "A Chama Partida", missões secundárias e contratos repetíveis.
// Objetivos: kill (target: id ou lista de ids), collect (item), talk (npc), pvp (abates na arena)
// {name} é substituído pelo nome do personagem no cliente.

export const QUESTS = {
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
      '— FIM DA CAMPANHA —\nContinue sua jornada: contratos no Quadro, chefes, equipamentos lendários e a Arena de Sangue esperam por você.',
    objectives: [{ type: 'talk', npc: 'thalric' }],
    rewards: { xp: 6000, gold: 1000, items: [['u_flame_amulet', 1]] },
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
};

export function questTargets(obj) {
  return Array.isArray(obj.target) ? obj.target : [obj.target];
}
