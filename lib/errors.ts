/**
 * Códigos de erro estáveis para diagnóstico no front e nos logs.
 * Formato exibido: "Mensagem [CODE]"
 */

export const ErrorCode = {
  UNAUTH: "DP-UNAUTH",
  BAD_CHUNK: "DP-BAD-CHUNK",
  MAP_FAIL: "DP-MAP-FAIL",
  MAP_TIMEOUT: "DP-MAP-TIMEOUT",
  MAP_OUTPUT: "DP-MAP-OUTPUT",
  MAP_RATE: "DP-MAP-RATE",
  REDUCE_FAIL: "DP-REDUCE-FAIL",
  ANALYZE_FAIL: "DP-ANALYZE-FAIL",
  EXTRACT_EMPTY: "DP-EXTRACT-EMPTY",
  DELETE_FAIL: "DP-DELETE-FAIL",
  BAD_REQUEST: "DP-BAD-REQUEST",
  NETWORK: "DP-NETWORK",
} as const;

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];

export function formatError(message: string, code: ErrorCodeValue): string {
  return `${message} [${code}]`;
}

/** Classifica erros conhecidos da IA / rede para um código. */
export function classifyAiError(err: unknown): ErrorCodeValue {
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  if (msg.includes("timeout") || msg.includes("timed out") || msg.includes("deadline")) {
    return ErrorCode.MAP_TIMEOUT;
  }
  if (
    msg.includes("rate") ||
    msg.includes("429") ||
    msg.includes("resource_exhausted") ||
    msg.includes("quota")
  ) {
    return ErrorCode.MAP_RATE;
  }
  if (
    msg.includes("schema") ||
    msg.includes("no object") ||
    msg.includes("could not parse") ||
    msg.includes("incomplete") ||
    msg.includes("max tokens") ||
    msg.includes("finish reason") ||
    msg.includes("length") ||
    msg.includes("truncated") ||
    msg.includes("token")
  ) {
    return ErrorCode.MAP_OUTPUT;
  }
  return ErrorCode.MAP_FAIL;
}

/** Remapeia códigos genéricos de IA para analyze/reduce. */
export function classifyStageError(
  err: unknown,
  stage: "analyze" | "reduce",
): ErrorCodeValue {
  const ai = classifyAiError(err);
  if (
    ai === ErrorCode.MAP_TIMEOUT ||
    ai === ErrorCode.MAP_RATE ||
    ai === ErrorCode.MAP_OUTPUT
  ) {
    return ai;
  }
  return stage === "analyze" ? ErrorCode.ANALYZE_FAIL : ErrorCode.REDUCE_FAIL;
}
