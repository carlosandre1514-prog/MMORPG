-- Rode uma vez no Supabase: SQL Editor > New query > Run
create table if not exists game_state (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- Só o servidor do jogo (chave service_role) acessa a tabela; nenhuma política = ninguém mais lê as contas
alter table game_state enable row level security;
