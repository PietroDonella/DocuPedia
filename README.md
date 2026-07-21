# DocuPedia

Transforme PDFs extensos (livros técnicos, manuais, livros de receitas) em uma **enciclopédia categorizada e navegável**, gerada automaticamente por IA.

Envie um PDF → a IA extrai o texto, identifica um título, agrupa o conteúdo em **categorias** e cria **tópicos** fiéis ao original → você navega no resultado como uma documentação ou uma Wikipédia.

O resultado do processamento é guardado **localmente no navegador** (`sessionStorage`) — não há banco de dados.

## Stack

- **Next.js 14** (App Router) + **TypeScript**
- **Tailwind CSS** — design minimalista com modo claro/escuro
- **Vercel AI SDK** (`ai`) + `@ai-sdk/google` — modelo `gemini-2.5-flash`
- **`generateObject` + Zod** — saída estruturada e previsível da IA
- **`pdf-parse`** — extração de texto do PDF
- **Vercel** — deploy

## Estrutura do projeto

```
app/
  layout.tsx                     Layout raiz + estilos globais + tema (anti-flash)
  page.tsx                       Tela inicial com a Dropzone de upload
  globals.css                    Estilos base (Tailwind)
  api/process-pdf/route.ts       Extrai texto do PDF + gera a estrutura via IA
  documento/[id]/
    page.tsx                     Página do documento
    DocumentLoader.tsx           Carrega o resultado do armazenamento local
components/
  UploadArea.tsx                 Dropzone (arrastar e soltar / clicar)
  EncyclopediaShell.tsx          Orquestra busca + sidebar + conteúdo
  SearchBar.tsx                  Barra de pesquisa fixa no topo
  Sidebar.tsx                    Menu lateral com as categorias + slider de tema
  ContentView.tsx                Área principal (tópicos + destaque da busca)
  ThemeToggle.tsx                Slider de modo escuro
lib/
  schema.ts                      Schema Zod compartilhado (Encyclopedia)
  types.ts                       Tipos (ProcessPdfResponse)
```

## Como rodar

1. Instale as dependências:

```bash
npm install
```

2. Configure as variáveis de ambiente (copie e preencha):

```bash
cp .env.example .env.local
```

Preencha `GOOGLE_GENERATIVE_AI_API_KEY` (obtida em
[Google AI Studio](https://aistudio.google.com/app/apikey)).

3. Rode o servidor de desenvolvimento:

```bash
npm run dev
```

Acesse http://localhost:3000 e envie um PDF.

## Armazenamento

O resultado do processamento é salvo no `sessionStorage` do navegador logo
após o upload e lido pela página `/documento/[id]`. Isso significa que o
documento fica disponível apenas **na mesma aba/sessão** — ao fechar a aba, é
preciso reenviar o PDF. Não há banco de dados nem backend de persistência.

## Deploy na Vercel

Importe o repositório na Vercel, configure a variável de ambiente
`GOOGLE_GENERATIVE_AI_API_KEY` em *Project Settings → Environment Variables* e
faça o deploy. A rota de API usa runtime Node.js (necessário para o `pdf-parse`).

## Notas

- O texto enviado à IA é truncado (`MAX_CHARS` em `route.ts`) para controlar
  custo e latência em documentos muito grandes. Para livros inteiros,
  considere uma estratégia de *chunking* + *map-reduce*.
- PDFs escaneados (somente imagem, sem camada de texto) não terão texto
  extraível — seria necessário OCR.
