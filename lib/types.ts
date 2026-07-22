import type { Encyclopedia } from "./schema";

/** Resposta (final) do processamento de um PDF. */
export interface ProcessPdfResponse {
  /** Identificador gerado para o documento (usado na URL /documento/[id]). */
  id: string;
  /** O objeto estruturado devolvido pela IA (schema `Encyclopedia`). */
  data: Encyclopedia;
}

/** Progresso emitido durante a estruturação do documento. */
export interface StructureProgress {
  phase: "analyzing" | "mapping" | "reducing";
  /** Chunks já processados (apenas na fase 'mapping'). */
  current?: number;
  /** Total de chunks (apenas na fase 'mapping'). */
  total?: number;
}

/**
 * Eventos enviados pela rota POST /api/process-pdf no formato NDJSON
 * (um JSON por linha), permitindo exibir uma barra de progresso.
 */
export type ProcessStreamEvent =
  | ({ type: "progress" } & StructureProgress)
  | { type: "done"; id: string; data: Encyclopedia }
  | { type: "error"; error: string };
