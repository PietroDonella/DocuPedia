import type { Encyclopedia } from "./schema";

/** Resposta da rota POST /api/process-pdf. */
export interface ProcessPdfResponse {
  /** Identificador gerado para o documento (usado na URL /documento/[id]). */
  id: string;
  /** O objeto estruturado devolvido pela IA (schema `Encyclopedia`). */
  data: Encyclopedia;
}
