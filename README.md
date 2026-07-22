# DocuPedia

Transforme PDFs extensos (livros técnicos, manuais, livros de receitas) em uma **enciclopédia categorizada e navegável**, gerada automaticamente por IA.

Após o **login**, a barra lateral fica sempre visível: Home (enviar PDFs), lista dos seus PDFs categorizados, usuário + modo noturno. A barra de pesquisa fica centralizada no topo. PDFs grandes usam **map-reduce** com barra de progresso, e o resultado é salvo no **Supabase** por usuário.

## Stack

- **Next.js 14** (App Router) + **TypeScript**
- **Tailwind CSS** — design minimalista com modo claro/escuro
- **Vercel AI SDK** (`ai`) + `@ai-sdk/google` — modelo `gemini-2.5-flash`
- **`generateObject` + Zod** — saída estruturada e previsível da IA
- **`pdf-parse`** — extração de texto do PDF
- **Supabase** — autenticação (e-mail/senha) + persistência por usuário
- **Vercel** — deploy

## Estrutura do projeto

```
app/
  layout.tsx                     Layout raiz + tema (anti-flash)
  login/page.tsx                 Entrar / cadastrar (Supabase Auth)
  (app)/layout.tsx               Área logada (AppShell + sidebar)
  (app)/page.tsx                 Home: upload de PDF centralizado
  (app)/documento/[id]/         Página do documento categorizado
  api/process-pdf/route.ts       Extrai PDF + IA (stream NDJSON)
components/
  app/
    AppShell.tsx                 Casca: sidebar + busca + conteúdo
    AppSidebar.tsx               Home, PDFs, usuário, tema (colapsável)
    TopSearchBar.tsx             Pesquisa centralizada no topo
    search-context.tsx           Estado global da busca
  UploadArea.tsx                 Dropzone + progresso
  EncyclopediaShell.tsx          Categorias + conteúdo do documento
  CategoryNav.tsx                Navegação de categorias do PDF aberto
  ContentView.tsx                Tópicos + highlight da busca
  ThemeToggle.tsx                Modo claro/escuro
lib/
  auth.ts                        getCurrentUser()
  documents.ts                   save / get / list por usuário
  structure.ts                   Map-reduce + progresso
  schema.ts / types.ts
  supabase/                      client, server, middleware
middleware.ts                    Protege rotas (exige login)
supabase/schema.sql              Tabela documents + RLS por user_id
```

## Como rodar

1. `npm install`
2. Copie `.env.example` → `.env.local` e preencha:
   - `GOOGLE_GENERATIVE_AI_API_KEY`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (chave **anon/public**)
   - `SUPABASE_SERVICE_ROLE_KEY` (chave **service_role**)
3. No Supabase: rode `supabase/schema.sql` e habilite Auth (Email). Em dev,
   pode desativar "Confirm email" em Authentication → Providers → Email.
4. `npm run dev` → http://localhost:3000 → faça login → envie um PDF.

## Layout (área logada)

| Região | Conteúdo |
|--------|----------|
| **Barra lateral** | Home, lista de PDFs do usuário, usuário + modo noturno + sair. Expande/retrai. |
| **Topo** | Barra de pesquisa centralizada (ativa dentro de um documento). |
| **Centro** | Home = upload; `/documento/[id]` = conteúdo categorizado (+ CategoryNav). |

## Notas

- Sem sessão, o middleware redireciona para `/login`.
- Cada documento é vinculado a `user_id` (RLS: só o dono lê).
- PDFs grandes: `MAX_CHARS` ~500k; map-reduce automático acima do limite single-pass.
- Na Vercel Hobby, `maxDuration` da API fica limitado a ~60s.
