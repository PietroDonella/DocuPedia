import { z } from "zod";

/**
 * Schema Zod compartilhado entre o backend (para forçar a saída do
 * `generateObject`) e o frontend (para tipagem forte da enciclopédia).
 *
 * A IA é obrigada a devolver EXATAMENTE esta estrutura, o que torna a
 * renderização da interface previsível e segura.
 *
 * O campo do tópico se chama `content` (não `summary`) para não induzir a
 * IA a resumir. Documentos antigos podem ter `summary` — normalize no load.
 */

const VERBATIM_CONTENT_DESC =
  "Texto ORIGINAL e LITERAL do tópico — cópia integral do(s) trecho(s) do " +
  "documento. É PROIBIDO resumir, encurtar, parafrasear, reescrever ou " +
  "omitir frases. Preserve 100% das palavras, listas, passos, números e " +
  "terminologia. Só corrija artefatos de extração do PDF (quebras no meio " +
  "de frases, hifenização, espaços duplicados).";

export const topicSchema = z.object({
  title: z.string().describe("Título curto e descritivo do tópico."),
  content: z.string().describe(VERBATIM_CONTENT_DESC),
});

export const categorySchema = z.object({
  name: z
    .string()
    .describe(
      "Nome CURTO e ABRANGENTE da categoria (ex.: 'Fundamentos', " +
        "'Práticas', 'Sobremesas'). Proibido fragmentar em variações " +
        "quase iguais ou nomes longos com hífens/subtítulos " +
        "(ex.: não use 'Tameana - Nível I - Aplicações').",
    ),
  description: z
    .string()
    .describe("Uma frase resumindo do que trata esta categoria.")
    .optional(),
  topics: z
    .array(topicSchema)
    .describe(
      "Tópicos desta categoria. Se unir tópicos duplicados, CONCATENE os " +
        "textos originais na íntegra — nunca resuma ao mesclar. Não inclua " +
        "linhas de índice/sumário.",
    ),
});

export const encyclopediaSchema = z.object({
  title: z
    .string()
    .describe("Título geral do documento, inferido a partir do conteúdo."),
  description: z
    .string()
    .describe("Uma breve descrição (1-2 frases) do documento como um todo."),
  categories: z
    .array(categorySchema)
    .describe(
      "Poucas categorias AMPLAS (em geral 4–10) por afinidade temática. " +
        "Una sinônimos e subtemas próximos; não fragmente por capítulo, " +
        "nível ou item do índice. Sem categorias de 'Índice'/'Estrutura do " +
        "Documento'. Cada tópico em uma só categoria, sem duplicação.",
    ),
});

// Tipos inferidos — reutilizados em todo o app.
export type Topic = z.infer<typeof topicSchema>;
export type Category = z.infer<typeof categorySchema>;
export type Encyclopedia = z.infer<typeof encyclopediaSchema>;

/** Compat: docs antigos gravavam o texto em `summary`. */
export function normalizeEncyclopedia(data: unknown): Encyclopedia {
  const raw = data as {
    title?: string;
    description?: string;
    categories?: Array<{
      name: string;
      description?: string;
      topics?: Array<{ title?: string; content?: string; summary?: string }>;
    }>;
  };

  return {
    title: raw.title ?? "Documento",
    description: raw.description ?? "",
    categories: (raw.categories ?? []).map((c) => ({
      name: c.name,
      description: c.description,
      topics: (c.topics ?? []).map((t) => ({
        title: t.title ?? "",
        content: t.content ?? t.summary ?? "",
      })),
    })),
  };
}
