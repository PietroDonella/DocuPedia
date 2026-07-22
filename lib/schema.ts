import { z } from "zod";

/**
 * Schema Zod compartilhado entre o backend (para forçar a saída do
 * `generateObject`) e o frontend (para tipagem forte da enciclopédia).
 *
 * A IA é obrigada a devolver EXATAMENTE esta estrutura, o que torna a
 * renderização da interface previsível e segura.
 */

export const topicSchema = z.object({
  title: z.string().describe("Título curto e descritivo do tópico."),
  summary: z
    .string()
    .describe(
      "Conteúdo ORIGINAL e LITERAL do tópico. Transcreva o texto EXATAMENTE " +
        "como aparece no documento — NÃO reescreva, NÃO parafraseie e NÃO " +
        "resuma. Apenas copie o(s) trecho(s) correspondente(s), corrigindo " +
        "somente artefatos da extração do PDF (quebras de linha no meio de " +
        "frases, palavras hifenizadas e espaços duplicados). Preserve 100% " +
        "das palavras, frases, exemplos, listas, passos, medidas, números e " +
        "a terminologia originais.",
    ),
});

export const categorySchema = z.object({
  name: z
    .string()
    .describe(
      "Nome da categoria — um tema abrangente que agrupa vários tópicos " +
        "relacionados (ex.: 'Entradas', 'Sobremesas', 'Instalação').",
    ),
  description: z
    .string()
    .describe("Uma frase resumindo do que trata esta categoria.")
    .optional(),
  topics: z
    .array(topicSchema)
    .describe(
      "Tópicos pertencentes a esta categoria. Tópicos semelhantes ou " +
        "duplicados devem ser mesclados em um único tópico, não repetidos.",
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
      "Categorias que agrupam logicamente os tópicos por afinidade temática. " +
        "Prefira poucas categorias abrangentes e bem definidas a muitas " +
        "categorias pequenas e fragmentadas. Cada tópico deve pertencer à " +
        "categoria mais adequada, sem duplicação entre categorias.",
    ),
});

// Tipos inferidos — reutilizados em todo o app.
export type Topic = z.infer<typeof topicSchema>;
export type Category = z.infer<typeof categorySchema>;
export type Encyclopedia = z.infer<typeof encyclopediaSchema>;
