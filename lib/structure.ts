import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";
import {
  encyclopediaSchema,
  type Encyclopedia,
  type Topic,
} from "@/lib/schema";
import type { StructureProgress, MappedTopic } from "@/lib/types";
import { CHUNK_SIZE, SINGLE_PASS_LIMIT, chunkText } from "@/lib/chunk";
import { withRateLimitRetry } from "@/lib/ai-retry";

export { CHUNK_SIZE, SINGLE_PASS_LIMIT, chunkText } from "@/lib/chunk";
export type { MappedTopic } from "@/lib/types";

/**
 * Estruturação do documento (texto do PDF -> enciclopédia categorizada).
 *
 * Para suporte a PDFs grandes na Vercel, o cliente orquestra:
 *   extract (browser) → /api/process-map (por chunk) → /api/process-reduce
 *
 * Este módulo ainda expõe `structureDocument` (single-request) para uso
 * local/servidor, e as funções `mapChunkTopics` / `reduceMappedTopics` /
 * `analyzeDocument` usadas pelas rotas de API.
 */

const MODEL = "gemini-2.5-flash";

// Nº máximo de chamadas MAP simultâneas no caminho single-request.
// 1 evita estourar rate limit da API do Gemini.
const MAP_CONCURRENCY = 1;

// Regras de comportamento reutilizadas nos prompts.
export interface StructureOptions {
  onProgress?: (progress: StructureProgress) => void;
}

const VERBATIM_RULE =
  "REGRA ABSOLUTA (conteúdo): o campo content de cada tópico deve ser o " +
  "texto ORIGINAL, transcrito LITERALMENTE (verbatim) do documento — a " +
  "cópia INTEGRAL daquela seção. É PROIBIDO reescrever, parafrasear, " +
  "resumir, encurtar, condensar ou 'melhorar' o texto. É PROIBIDO omitir " +
  "parágrafos, frases, listas ou exemplos. A única edição permitida é " +
  "corrigir artefatos da extração do PDF (quebras de linha no meio de " +
  "frases, hifenização e espaços duplicados). Não invente nada.";

const INDEX_IGNORE_RULE =
  "REGRA (índice): NÃO use o índice/sumário/table of contents como fonte " +
  "de tópicos ou categorias. Pule linhas que sejam só título + pontilhados " +
  "+ número de página, ou seções rotuladas 'Índice'/'Sumário'/'Contents'. " +
  "IMPORTANTE: isso NÃO significa devolver zero tópicos. Se o trecho tiver " +
  "conteúdo do corpo do documento (parágrafos, explicações, práticas), " +
  "EXTRAIA esses tópicos normalmente. Só omita as linhas de navegação.";

const CATEGORY_RULE =
  "REGRA DE CATEGORIZAÇÃO (abrangência): use POUCAS categorias AMPLAS e " +
  "temáticas (em geral 4–10 no documento inteiro). É PROIBIDO fragmentar " +
  "em categorias quase iguais ou muito específicas. Exemplos do que NÃO " +
  "fazer: 'Tameana - Fundamentos', 'Tameana - Introdução', 'Tameana - " +
  "Conceitos', 'Fundamentos da Tameana' e 'Conceitos Fundamentais' como " +
  "categorias separadas — isso deve ser UMA só (ex.: 'Fundamentos'). " +
  "Também é PROIBIDO criar uma categoria por nível/capítulo/seção do " +
  "índice (ex.: 'Nível I', 'Nível II', 'Nível I - Aplicações'). Una " +
  "sinônimos, variações de nome e subtemas próximos sob o mesmo rótulo " +
  "abrangente. Prefira nomes curtos e gerais ('Fundamentos', 'Práticas', " +
  "'Técnicas de Cura') em vez de nomes longos com hífens e subtítulos. " +
  "Nunca crie categorias como 'Estrutura do Documento', 'Índice' ou " +
  "'Informações do Curso' só porque o PDF tem sumário ou capa. Cada " +
  "trecho aparece em uma só categoria.";

const LANGUAGE_RULE =
  "Responda sempre no mesmo idioma predominante do documento.";

// ---------------------------------------------------------------------------
// Ponto de entrada
// ---------------------------------------------------------------------------
export async function structureDocument(
  text: string,
  options: StructureOptions = {},
): Promise<Encyclopedia> {
  if (text.length <= SINGLE_PASS_LIMIT) {
    return singlePass(text, options);
  }
  return mapReduce(text, options);
}

// ---------------------------------------------------------------------------
// Caminho rápido: 1 chamada (docs pequenos)
// ---------------------------------------------------------------------------
async function singlePass(
  text: string,
  { onProgress }: StructureOptions,
): Promise<Encyclopedia> {
  onProgress?.({ phase: "analyzing" });
  return analyzeDocument(text);
}

/**
 * Classifica um documento pequeno em uma única chamada à IA.
 * Exportado para a rota `/api/process-analyze` (Vercel: 1 invocação curta).
 */
export async function analyzeDocument(text: string): Promise<Encyclopedia> {
  const { object } = await withRateLimitRetry(
    () =>
      generateObject({
        model: google(MODEL),
        schema: encyclopediaSchema,
        system:
          "Você é um BIBLIOTECÁRIO/CLASSIFICADOR. Seu único trabalho é ORGANIZAR " +
          "e CATEGORIZAR o texto de um documento — nunca reescrevê-lo.\n\n" +
          VERBATIM_RULE +
          "\n\n" +
          INDEX_IGNORE_RULE +
          "\n\n" +
          CATEGORY_RULE +
          "\n\nMescle tópicos duplicados concatenando o texto original (sem " +
          "resumir). Evite uma categoria genérica de 'diversos'.\n\n" +
          LANGUAGE_RULE,
        prompt:
          "Classifique e agrupe o texto a seguir, extraído de um documento PDF, " +
          "na estrutura solicitada, transcrevendo o conteúdo LITERALMENTE. " +
          "Ignore índice/sumário se houver.\n\n" +
          "---INÍCIO DO DOCUMENTO---\n" +
          text +
          "\n---FIM DO DOCUMENTO---",
      }),
    { label: "analyze" },
  );
  return object;
}

// ---------------------------------------------------------------------------
// Map-reduce (docs grandes)
// ---------------------------------------------------------------------------

// Schema do passo MAP: tópicos com conteúdo verbatim + categoria sugerida.
const mapSchema = z.object({
  topics: z
    .array(
      z.object({
        title: z.string().describe("Título curto e descritivo do tópico."),
        category: z
          .string()
          .describe(
            "Categoria temática AMPLA sugerida (ex.: 'Fundamentos', " +
              "'Práticas', 'Sobremesas'). Evite nomes hiper-específicos ou " +
              "variações quase iguais de outras categorias.",
          ),
        content: z
          .string()
          .describe(
            "Cópia INTEGRAL e LITERAL do texto deste tópico no trecho " +
              "(sem resumir, encurtar, parafrasear ou omitir frases).",
          ),
      }),
    )
    .describe("Tópicos identificados NESTE trecho do documento."),
});

// Schema do passo REDUCE: taxonomia global referenciando tópicos por id.
const reduceSchema = z.object({
  title: z.string().describe("Título geral do documento."),
  description: z
    .string()
    .describe("Breve descrição (1-2 frases) do documento como um todo."),
  categories: z
    .array(
      z.object({
        name: z.string().describe("Nome da categoria (tema abrangente)."),
        topicIds: z
          .array(z.string())
          .describe("IDs dos tópicos (do catálogo) que pertencem à categoria."),
      }),
    )
    .describe(
      "Taxonomia GLOBAL com POUCAS categorias AMPLAS (em geral 4–10). " +
        "Una sinônimos e subtemas próximos numa só categoria; não fragmente " +
        "por capítulo/nível/índice. Cada tópico em uma única categoria. " +
        "Descarte tópicos que sejam só linhas de índice/sumário.",
    ),
});

interface CatalogEntry {
  id: string;
  title: string;
  category: string;
}

/**
 * Extrai tópicos de UM chunk de texto (passo MAP).
 * Usado pela rota `/api/process-map` — uma invocação curta na Vercel.
 *
 * Em falha por saída truncada/schema, tenta de novo com metade do chunk
 * e une os resultados (mitiga DP-MAP-OUTPUT em apostilas densas).
 */
export async function mapChunkTopics(chunk: string): Promise<MappedTopic[]> {
  const input = chunk.slice(0, CHUNK_SIZE);
  try {
    return await mapChunkOnce(input);
  } catch (err) {
    // Chunk ainda grande ou saída truncada → divide e tenta de novo (em série).
    if (input.length < 800) throw err;
    const mid = Math.floor(input.length / 2);
    const left = input.slice(0, mid);
    const right = input.slice(mid);
    const a = await mapChunkOnce(left).catch(() => [] as MappedTopic[]);
    const b = await mapChunkOnce(right).catch(() => [] as MappedTopic[]);
    const merged = [...a, ...b];
    if (merged.length === 0) throw err;
    return merged;
  }
}

async function mapChunkOnce(chunk: string): Promise<MappedTopic[]> {
  const { object } = await withRateLimitRetry(
    () =>
      generateObject({
        model: google(MODEL),
        schema: mapSchema,
        system:
          "Você extrai tópicos de UM TRECHO de um documento maior. " +
          VERBATIM_RULE +
          "\n\n" +
          INDEX_IGNORE_RULE +
          "\n\nCubra TODO o conteúdo substantivo do trecho: não pule seções. " +
          "Para cada tópico, forneça título, categoria AMPLA (nome curto) e " +
          "content com o texto COMPLETO daquela parte. Prefira menos tópicos " +
          "com texto longo e íntegro a muitos tópicos curtos/resumidos. " +
          "Só devolva lista vazia se o trecho inteiro for exclusivamente " +
          "índice/sumário. " +
          LANGUAGE_RULE,
        prompt:
          "Extraia os tópicos deste trecho com texto LITERAL e completo " +
          "(pule só linhas de índice).\n\n" +
          "---INÍCIO DO TRECHO---\n" +
          chunk +
          "\n---FIM DO TRECHO---",
      }),
    { label: "map" },
  );
  return object.topics.filter(
    (t) => !looksLikeIndexEntry(t.title, t.category),
  );
}

/**
 * Consolida tópicos mapeados em uma enciclopédia global (passo REDUCE).
 * Usado pela rota `/api/process-reduce`.
 */
export async function reduceMappedTopics(
  mapped: MappedTopic[],
): Promise<Encyclopedia> {
  const topicsById = new Map<string, Topic>();
  const catalog: CatalogEntry[] = [];
  mapped.forEach((t, i) => {
    const id = `t${i}`;
    topicsById.set(id, { title: t.title, content: t.content });
    catalog.push({ id, title: t.title, category: t.category });
  });

  if (catalog.length === 0) {
    return {
      title: "Documento",
      description: "Não foi possível extrair tópicos do conteúdo enviado.",
      categories: [],
    };
  }

  try {
    const { object: reduced } = await withRateLimitRetry(
      () =>
        generateObject({
          model: google(MODEL),
          schema: reduceSchema,
          system:
            "Você organiza um catálogo de tópicos em uma taxonomia GLOBAL " +
            "coerente.\n\n" +
            CATEGORY_RULE +
            "\n\n" +
            "Descarte tópicos que claramente sejam só linhas de índice/sumário " +
            "(título + página, pontilhados, 'Índice', 'Estrutura do Documento'). " +
            "Não os coloque em nenhuma categoria.\n\n" +
            "Use apenas os IDs fornecidos; não invente IDs. " +
            LANGUAGE_RULE,
          prompt:
            "Catálogo de tópicos (id | título | categoria sugerida). Defina o " +
            "título/descrição do documento e agrupe os tópicos em POUCAS " +
            "categorias AMPLAS (una sinônimos e subtemas). Ignore itens de " +
            "índice. Referencie os IDs.\n\n" +
            catalog
              .map((c) => `${c.id} | ${c.title} | ${c.category}`)
              .join("\n"),
        }),
      { label: "reduce" },
    );
    return assembleFromReduced(reduced, catalog, topicsById);
  } catch (err) {
    console.error("Falha no REDUCE; usando categorias sugeridas:", err);
    return assembleFromSuggested(catalog, topicsById);
  }
}

async function mapReduce(
  text: string,
  { onProgress }: StructureOptions,
): Promise<Encyclopedia> {
  const chunks = chunkText(text, CHUNK_SIZE);
  const total = chunks.length;
  let completed = 0;

  // ---- MAP (paralelo, concorrência limitada) ----
  onProgress?.({ phase: "mapping", current: 0, total });
  const mapResults = await mapWithConcurrency(
    chunks,
    MAP_CONCURRENCY,
    async (chunk) => {
      try {
        return await mapChunkTopics(chunk);
      } catch (err) {
        console.error("Falha ao processar um chunk (ignorado):", err);
        return [];
      } finally {
        completed++;
        onProgress?.({ phase: "mapping", current: completed, total });
      }
    },
  );

  const mapped = mapResults.flat();

  // Sem tópicos extraídos: cai para o caminho simples com o início do texto.
  if (mapped.length === 0) {
    return singlePass(text.slice(0, SINGLE_PASS_LIMIT), { onProgress });
  }

  // ---- REDUCE ----
  onProgress?.({ phase: "reducing" });
  return reduceMappedTopics(mapped);
}

function assembleFromReduced(
  reduced: z.infer<typeof reduceSchema>,
  catalog: CatalogEntry[],
  topicsById: Map<string, Topic>,
): Encyclopedia {
  const used = new Set<string>();
  const categories = reduced.categories
    .map((c) => {
      const topics: Topic[] = [];
      for (const id of c.topicIds) {
        if (topicsById.has(id) && !used.has(id)) {
          used.add(id);
          topics.push(topicsById.get(id)!);
        }
      }
      return { name: c.name, topics };
    })
    .filter((c) => c.topics.length > 0);

  // Tópicos omitidos no REDUCE (ex.: índice) não voltam como categorias
  // novas — só entram se já existir uma categoria com o mesmo nome.
  const leftovers = catalog.filter((c) => !used.has(c.id));
  for (const entry of leftovers) {
    if (looksLikeIndexEntry(entry.title, entry.category)) continue;
    const existing = categories.find(
      (c) => normalizeName(c.name) === normalizeName(entry.category),
    );
    if (existing) existing.topics.push(topicsById.get(entry.id)!);
  }

  return {
    title: reduced.title,
    description: reduced.description,
    categories,
  };
}

// Fallback determinístico: agrupa pelos nomes de categoria sugeridos no MAP.
function assembleFromSuggested(
  catalog: CatalogEntry[],
  topicsById: Map<string, Topic>,
): Encyclopedia {
  const byCategory = new Map<string, { name: string; topics: Topic[] }>();
  for (const entry of catalog) {
    if (looksLikeIndexEntry(entry.title, entry.category)) continue;
    const key = normalizeName(entry.category);
    if (!byCategory.has(key)) {
      byCategory.set(key, { name: entry.category, topics: [] });
    }
    byCategory.get(key)!.topics.push(topicsById.get(entry.id)!);
  }
  return {
    title: "Documento",
    description: "Conteúdo categorizado a partir do PDF enviado.",
    categories: [...byCategory.values()],
  };
}

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/** Heurística: título/categoria que parecem vir do índice/sumário do PDF. */
function looksLikeIndexEntry(title: string, category: string): boolean {
  const blob = normalizeName(`${title} ${category}`);
  if (
    /\b(indice|sumario|table of contents|estrutura do documento)\b/.test(blob)
  ) {
    return true;
  }
  // "Título ...... 42" típico de sumário com leader dots.
  if (/\.{3,}\s*\d+\s*$/.test(title.trim())) return true;
  return false;
}

/** Executa `fn` sobre `items` com no máximo `limit` execuções simultâneas. */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index], index);
    }
  }

  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}
