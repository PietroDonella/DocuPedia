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
  phase: "extracting" | "analyzing" | "mapping" | "reducing";
  /** Passo atual (páginas na extração, ou chunks no mapeamento). */
  current?: number;
  /** Total de passos da fase atual. */
  total?: number;
}

/** Tópico bruto do passo MAP (antes do reduce). */
export interface MappedTopic {
  title: string;
  category: string;
  content: string;
}

/**
 * Eventos enviados pela rota POST /api/process-pdf no formato NDJSON
 * (um JSON por linha), permitindo exibir uma barra de progresso.
 */
export type ProcessStreamEvent =
  | ({ type: "progress" } & StructureProgress)
  | { type: "done"; id: string; data: Encyclopedia }
  | { type: "error"; error: string };
