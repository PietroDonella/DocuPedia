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
      "Conteúdo COMPLETO e fiel do tópico, preservando a essência original " +
        "do texto extraído. NÃO resuma agressivamente: mantenha detalhes " +
        "importantes, exemplos, listas, passos, medidas, números e a " +
        "terminologia original do documento. Reescreva apenas o mínimo " +
        "necessário para organizar e dar clareza, sem perder informação. " +
        "Prefira vários parágrafos a um resumo curto. Se o trecho original " +
        "tiver instruções ou receitas, reproduza os passos na íntegra.",
    ),
});

export const categorySchema = z.object({
  name: z
    .string()
    .describe("Nome da categoria (ex: 'Entradas', 'Sobremesas', 'Instalação')."),
  description: z
    .string()
    .describe("Uma frase resumindo do que trata esta categoria.")
    .optional(),
  topics: z
    .array(topicSchema)
    .describe("Lista de tópicos pertencentes a esta categoria."),
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
      "Lista de categorias que agrupam logicamente os tópicos do documento.",
    ),
});

// Tipos inferidos — reutilizados em todo o app.
export type Topic = z.infer<typeof topicSchema>;
export type Category = z.infer<typeof categorySchema>;
export type Encyclopedia = z.infer<typeof encyclopediaSchema>;
