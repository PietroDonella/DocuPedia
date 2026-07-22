-- =====================================================================
-- DocuPedia — Tabela `documents` (enciclopédias por usuário)
--
-- Como usar:
--   1. Abra seu projeto no Supabase.
--   2. Vá em "SQL Editor" > "New query".
--   3. Cole este script e clique em "Run".
--
-- Autenticação: use e-mail/senha (Authentication > Providers > Email).
-- Para testar sem confirmar e-mail, desative "Confirm email" em
-- Authentication > Providers > Email (ambiente de desenvolvimento).
-- =====================================================================

-- Necessário para gen_random_uuid() (normalmente já habilitado).
create extension if not exists "pgcrypto";

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  -- Dono do documento. Cada usuário só vê os próprios (ver RLS abaixo).
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  -- Objeto estruturado devolvido pela IA (schema `Encyclopedia`):
  -- { title, description, categories: [{ name, description, topics: [...] }] }
  content_json jsonb not null,
  created_at timestamptz not null default now()
);

-- Caso a tabela já existisse SEM a coluna user_id (versão anterior):
alter table public.documents
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

create index if not exists documents_user_id_idx
  on public.documents (user_id, created_at desc);

-- ---------------------------------------------------------------------
-- Row Level Security (RLS) — isolamento por usuário
-- ---------------------------------------------------------------------
alter table public.documents enable row level security;

drop policy if exists "documents_select_own" on public.documents;
create policy "documents_select_own"
  on public.documents
  for select
  using (auth.uid() = user_id);

drop policy if exists "documents_insert_own" on public.documents;
create policy "documents_insert_own"
  on public.documents
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "documents_delete_own" on public.documents;
create policy "documents_delete_own"
  on public.documents
  for delete
  using (auth.uid() = user_id);

-- OBS.: a gravação feita pela aplicação usa a SERVICE ROLE KEY (ignora o
-- RLS) e informa o user_id explicitamente. As policies acima protegem
-- qualquer acesso feito diretamente com a anon key (ex.: pelo navegador).
