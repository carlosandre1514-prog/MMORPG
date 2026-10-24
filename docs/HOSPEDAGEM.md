# Colocar o jogo online de graça (Render + Supabase)

O Render roda o servidor do jogo e o Supabase guarda as contas e personagens (o disco do plano gratuito do Render é
apagado a cada reinício). Tudo no plano gratuito, sem cartão de crédito.

## 1. Supabase (guarda os dados)
1. Crie uma conta em https://supabase.com e um projeto novo (anote a senha do banco, mas o jogo não a usa).
2. Abra **SQL Editor → New query**, cole o conteúdo de `docs/supabase.sql` e clique em **Run**.
3. Abra **Project Settings → API** e copie:
   - **Project URL** (algo como `https://abcd1234.supabase.co`);
   - a chave **service_role** (clique em *Reveal*). Ela é secreta: fica só no Render, nunca no código nem no navegador.

## 2. Render (roda o jogo)
1. Suba o projeto para um repositório seu no GitHub (o código já está em `carlosandre1514-prog/mmorpg`, branch `ccr-97daa776-v2h8gc`).
2. Em https://render.com crie uma conta, clique em **New + → Blueprint** e escolha o repositório e o branch.
3. O Render lê o `render.yaml` e pede dois valores: cole `SUPABASE_URL` e `SUPABASE_KEY` (a service_role).
4. Clique em **Apply**. Em alguns minutos o jogo fica em `https://aethra.onrender.com` (o nome pode variar).

No log deve aparecer `Dados salvos em /... + Supabase`. Se a chave estiver errada, o servidor **se recusa a subir** (de propósito:
ele não começa vazio para não apagar os dados que já existem).

## 2b. Login do Firebase no endereço do Render
O login do jogo é o Firebase Authentication e só aceita endereços autorizados. Depois que o Render der o endereço do jogo:
1. Firebase → **Authentication → Configurações → Domínios autorizados → Adicionar domínio**: `aethra.onrender.com` (o seu endereço, sem `https://`).
2. Em **Método de login**, confirme que **E-mail/senha** (e **Google**, se for usar) estão ativos.
3. No seu computador: `node tools/firebase/check.mjs aethra.onrender.com` mostra o que ainda falta.
O servidor não precisa de chave nenhuma do Firebase (só lê os certificados públicos do Google). Outras variáveis opcionais: `FIREBASE_REQUIRE_VERIFIED=1` (só entra quem confirmou o e-mail) e `FIREBASE_PROJECT_ID` (outro projeto).

## 3. Manter acordado
O plano gratuito do Render põe o serviço para dormir após 15 minutos sem visitas, e acordar leva cerca de um minuto.
Para evitar, crie um monitor gratuito em https://uptimerobot.com do tipo **HTTP(s)** apontando para
`https://SEU-SERVICO.onrender.com/status`, com intervalo de 5 minutos. O plano gratuito do Render tem 750 horas por mês,
o suficiente para um serviço ligado o mês inteiro.

## Limites e cuidados
- O Supabase gratuito dá 500 MB de banco; o jogo usa uma linha pequena (algumas centenas de KB com muitos jogadores).
- Projetos gratuitos do Supabase pausam depois de 1 semana sem uso; como o jogo grava a cada poucos segundos enquanto há
  jogadores, isso só acontece se ninguém jogar por uma semana (basta reativar no painel).
- Se o servidor reiniciar, até alguns segundos de progresso podem se perder; o resto volta do Supabase.
- **O personagem some depois de criar a conta?** Sem `SUPABASE_URL` e `SUPABASE_KEY` no Render, o disco é apagado a cada reinício (o plano gratuito dorme sem visitas e reinicia a cada publicação). O login do Firebase continua valendo, mas o personagem, que fica no servidor, desaparece. Com isso faltando, o jogo mostra uma faixa vermelha de aviso na tela inicial e `/status` devolve `"durable": false`.
- Faça uma cópia do JSON de vez em quando (Table Editor → game_state → coluna `data`).
- **Nunca** ligue `DEV=1` em produção: libera comandos como `/nivel` e `/ouro` para qualquer jogador.

## Outras opções
- Máquina virtual sempre ligada e gratuita (Oracle Cloud *Always Free*, Google Cloud *e2-micro*): `npm start` direto, com
  disco persistente e sem Supabase, mas com mais configuração.
- Variáveis aceitas pelo servidor: `PORT`, `DATA_DIR`, `XP_RATE`, `DEV`, `SUPABASE_URL`, `SUPABASE_KEY`, `SUPABASE_TABLE`.
