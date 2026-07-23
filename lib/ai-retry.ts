import { classifyAiError, ErrorCode } from "@/lib/errors";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function isRateLimited(err: unknown): boolean {
  return classifyAiError(err) === ErrorCode.MAP_RATE;
}

/**
 * Executa `fn` com retries em rate-limit (429 / quota / resource_exhausted).
 * Backoff exponencial: 2s, 5s, 12s (por padrão).
 */
export async function withRateLimitRetry<T>(
  fn: () => Promise<T>,
  options: { retries?: number; label?: string } = {},
): Promise<T> {
  const retries = options.retries ?? 3;
  const delays = [2_000, 5_000, 12_000];
  let lastErr: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isRateLimited(err) || attempt === retries) throw err;
      const wait = delays[Math.min(attempt, delays.length - 1)] ?? 12_000;
      console.warn(
        `Rate limit${options.label ? ` (${options.label})` : ""}; ` +
          `retry ${attempt + 1}/${retries} em ${wait}ms`,
      );
      await sleep(wait);
    }
  }

  throw lastErr;
}
