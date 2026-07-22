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
const MAP_CONCURRENCY = 4;

// Regras de comportamento reutilizadas nos prompts.
export interface StructureOptions {
  onProgress?: (progress: StructureProgress) => void;
}

const VERBATIM_RULE =
  "REGRA ABSOLUTA (conteúdo): o texto de cada tópico deve ser o texto " +
  "ORIGINAL, transcrito LITERALMENTE (verbatim) do documento. É PROIBIDO " +
  "reescrever, parafrasear, resumir, encurtar ou 'melhorar' o texto. A única " +
  "edição permitida é corrigir artefatos da extração do PDF (quebras de linha " +
  "no meio de frases, hifenização e espaços duplicados). Não invente nada.";

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
  const { object } = await generateObject({
    model: google(MODEL),
    schema: encyclopediaSchema,
    system:
      "Você é um BIBLIOTECÁRIO/CLASSIFICADOR. Seu único trabalho é ORGANIZAR " +
      "e CATEGORIZAR o texto de um documento — nunca reescrevê-lo.\n\n" +
      VERBATIM_RULE +
      "\n\nREGRA DE CATEGORIZAÇÃO (eficiência): leia o documento inteiro, " +
      "identifique os tópicos e AGRUPE tópicos semelhantes/relacionados sob a " +
      "MESMA categoria. Mescle tópicos duplicados. Crie um número enxuto de " +
      "categorias abrangentes e coerentes (evite categorias minúsculas ou uma " +
      "categoria genérica de 'diversos'). Cada trecho aparece em uma só " +
      "categoria.\n\n" +
      LANGUAGE_RULE,
    prompt:
      "Classifique e agrupe o texto a seguir, extraído de um documento PDF, " +
      "na estrutura solicitada, transcrevendo o conteúdo LITERALMENTE.\n\n" +
      "---INÍCIO DO DOCUMENTO---\n" +
      text +
      "\n---FIM DO DOCUMENTO---",
  });
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
            "Categoria temática sugerida para este tópico (ex.: 'Sobremesas').",
          ),
        content: z
          .string()
          .describe(
            "Texto ORIGINAL e LITERAL do tópico, transcrito verbatim deste " +
              "trecho do documento (sem reescrever, parafrasear ou resumir).",
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
      "Taxonomia GLOBAL: agrupe tópicos semelhantes/relacionados na mesma " +
        "categoria. Poucas categorias abrangentes e coerentes; cada tópico em " +
        "uma única categoria.",
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
 */
export async function mapChunkTopics(chunk: string): Promise<MappedTopic[]> {
  const { object } = await generateObject({
    model: google(MODEL),
    schema: mapSchema,
    system:
      "Você extrai tópicos de UM TRECHO de um documento maior. " +
      VERBATIM_RULE +
      "\n\nPara cada tópico, forneça um título, uma categoria sugerida " +
      "e o conteúdo transcrito LITERALMENTE deste trecho. " +
      LANGUAGE_RULE,
    prompt:
      "Extraia os tópicos do trecho a seguir.\n\n---INÍCIO DO TRECHO---\n" +
      chunk +
      "\n---FIM DO TRECHO---",
  });
  return object.topics;
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
    topicsById.set(id, { title: t.title, summary: t.content });
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
    const { object: reduced } = await generateObject({
      model: google(MODEL),
      schema: reduceSchema,
      system:
        "Você organiza um catálogo de tópicos em uma taxonomia GLOBAL " +
        "coerente. Agrupe tópicos semelhantes/relacionados na mesma categoria, " +
        "una categorias equivalentes com nomes diferentes e prefira poucas " +
        "categorias abrangentes. Use os IDs fornecidos; não invente IDs. " +
        LANGUAGE_RULE,
      prompt:
        "Catálogo de tópicos (id | título | categoria sugerida). Defina o " +
        "título/descrição do documento e agrupe TODOS os tópicos em categorias " +
        "coerentes referenciando seus IDs.\n\n" +
        catalog
          .map((c) => `${c.id} | ${c.title} | ${c.category}`)
          .join("\n"),
    });
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

  const leftovers = catalog.filter((c) => !used.has(c.id));
  for (const entry of leftovers) {
    const topic = topicsById.get(entry.id)!;
    const existing = categories.find(
      (c) => normalizeName(c.name) === normalizeName(entry.category),
    );
    if (existing) existing.topics.push(topic);
    else categories.push({ name: entry.category, topics: [topic] });
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
