"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { extractPdfText } from "@/lib/pdf-client";
import { CHUNK_SIZE, SINGLE_PASS_LIMIT, chunkText } from "@/lib/chunk";
import { ErrorCode, formatError } from "@/lib/errors";
import type {
  MappedTopic,
  ProcessPdfResponse,
  StructureProgress,
} from "@/lib/types";

type Status = "idle" | "dragging" | "uploading" | "error";

/** Concorrência de chamadas MAP no cliente (cada uma = 1 função Vercel). */
const CLIENT_MAP_CONCURRENCY = 1;
/** Pausa entre chunks MAP para reduzir rate limit da API. */
const MAP_CHUNK_DELAY_MS = 1_500;
/** Pausa antes do reduce/analyze final (cota esfria após o MAP). */
const PRE_REDUCE_DELAY_MS = 2_000;
/** Limite defensivo de caracteres enviados à IA. */
const MAX_CHARS = 500_000;

/** Pesos das fases no percentual global (somam 100). */
const PHASE_WEIGHT = {
  extracting: 12,
  ai: 76, // mapping ou analyzing
  reducing: 12,
} as const;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function UploadArea() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [fileName, setFileName] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [progress, setProgress] = useState<StructureProgress | null>(null);
  /** Sub-progresso 0–1 dentro de analyzing/reducing (chamada única à IA). */
  const [softFrac, setSoftFrac] = useState(0);
  const softStartRef = useRef<number | null>(null);

  // Sobe o percentual suavemente enquanto a IA trabalha (analyze/reduce
  // ou dentro de um trecho do map ainda sem resposta).
  useEffect(() => {
    const mappingInFlight =
      progress?.phase === "mapping" &&
      (progress.total ?? 0) > 0 &&
      (progress.current ?? 0) < (progress.total ?? 0);
    const needsSoft =
      progress?.phase === "analyzing" ||
      progress?.phase === "reducing" ||
      mappingInFlight;

    if (!needsSoft) {
      softStartRef.current = null;
      setSoftFrac(0);
      return;
    }

    // Reinicia a curva a cada novo trecho do MAP.
    softStartRef.current = Date.now();
    const started = softStartRef.current;
    const tick = () => {
      const elapsed = Date.now() - started;
      // Analyze/reduce: sobe ao longo de ~1 min. Map (por trecho): mais rápido.
      const tau = progress?.phase === "mapping" ? 14_000 : 28_000;
      const frac = 1 - Math.exp(-elapsed / tau);
      setSoftFrac(Math.min(0.92, frac));
    };
    tick();
    const id = window.setInterval(tick, 350);
    return () => window.clearInterval(id);
  }, [progress?.phase, progress?.current, progress?.total]);

  const handleFile = useCallback(
    async (file: File) => {
      setErrorMsg(null);

      if (
        file.type !== "application/pdf" &&
        !file.name.toLowerCase().endsWith(".pdf")
      ) {
        setStatus("error");
        setErrorMsg("Por favor, envie um arquivo no formato PDF.");
        return;
      }

      setFileName(file.name);
      setProgress({ phase: "extracting", current: 0, total: 0 });
      setStatus("uploading");

      try {
        const rawText = await extractPdfText(file, (current, total) => {
          setProgress({ phase: "extracting", current, total });
        });

        if (rawText.length < 50) {
          throw new Error(
            formatError(
              "Não foi possível extrair texto suficiente do PDF. Ele pode ser um PDF de imagens (escaneado) sem camada de texto.",
              ErrorCode.EXTRACT_EMPTY,
            ),
          );
        }

        const text = rawText.slice(0, MAX_CHARS);
        let result: ProcessPdfResponse;

        if (text.length <= SINGLE_PASS_LIMIT) {
          setProgress({ phase: "analyzing" });
          result = await postJson<ProcessPdfResponse>("/api/process-reduce", {
            mode: "analyze",
            text,
            fileName: file.name,
          });
        } else {
          const chunks = chunkText(text, CHUNK_SIZE);
          setProgress({
            phase: "mapping",
            current: 0,
            total: chunks.length,
          });

          const { topics: mapped, failedChunks } =
            await mapChunksWithConcurrency(
              chunks,
              CLIENT_MAP_CONCURRENCY,
              (current, total) =>
                setProgress({ phase: "mapping", current, total }),
            );

          if (mapped.length === 0) {
            if (failedChunks === chunks.length) {
              throw new Error(
                formatError(
                  "Falha ao processar os trechos do documento. Tente novamente em instantes.",
                  ErrorCode.MAP_FAIL,
                ),
              );
            }
            console.warn(
              "MAP sem tópicos; fallback para analyze no início do texto.",
            );
            setProgress({ phase: "analyzing" });
            result = await postJson<ProcessPdfResponse>("/api/process-reduce", {
              mode: "analyze",
              text: text.slice(0, SINGLE_PASS_LIMIT),
              fileName: file.name,
            });
          } else {
            await sleep(PRE_REDUCE_DELAY_MS);
            setProgress({ phase: "reducing" });
            result = await postJson<ProcessPdfResponse>("/api/process-reduce", {
              mode: "reduce",
              topics: mapped,
              fileName: file.name,
            });
          }
        }

        try {
          sessionStorage.setItem(
            `docupedia:${result.id}`,
            JSON.stringify(result.data),
          );
        } catch {
          // ignore
        }

        router.push(`/documento/${result.id}`);
        router.refresh();
      } catch (err) {
        setStatus("error");
        setProgress(null);
        setErrorMsg(
          err instanceof Error ? err.message : "Erro inesperado no upload.",
        );
      }
    },
    [router],
  );

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setStatus("idle");
      const file = e.dataTransfer.files?.[0];
      if (file) void handleFile(file);
    },
    [handleFile],
  );

  const isBusy = status === "uploading";
  const percent = computeOverallPercent(progress, softFrac);

  return (
    <div className="w-full max-w-xl">
      <div
        role="button"
        tabIndex={0}
        aria-label="Área para enviar PDF"
        onClick={() => !isBusy && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !isBusy) {
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!isBusy) setStatus("dragging");
        }}
        onDragLeave={() => !isBusy && setStatus("idle")}
        onDrop={onDrop}
        className={[
          "group flex cursor-pointer flex-col items-center justify-center gap-4",
          "rounded-2xl border-2 border-dashed px-8 py-16 text-center transition",
          status === "dragging"
            ? "border-accent bg-accent-soft dark:bg-accent/20"
            : "border-surface-border bg-surface-subtle hover:border-accent/60 hover:bg-white dark:border-white/15 dark:bg-white/5 dark:hover:bg-white/10",
          isBusy && "pointer-events-none opacity-90",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />

        {isBusy ? (
          <div className="flex w-full max-w-sm flex-col items-center gap-4">
            <Spinner />
            <div className="w-full">
              <p className="text-center font-medium text-ink dark:text-zinc-100">
                {progressLabel(progress)}
              </p>

              <div
                className="mt-3 h-2 w-full overflow-hidden rounded-full bg-surface-border dark:bg-white/10"
                role="progressbar"
                aria-valuenow={percent}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="h-full rounded-full bg-accent transition-[width] duration-500 ease-out"
                  style={{ width: `${percent}%` }}
                />
              </div>

              <p className="mt-1.5 text-right text-xs tabular-nums text-ink-muted dark:text-zinc-500">
                {percent}%
              </p>

              {fileName && (
                <p className="mt-2 truncate text-center text-xs text-ink-muted dark:text-zinc-500">
                  {fileName}
                </p>
              )}
            </div>
          </div>
        ) : (
          <>
            <UploadIcon />
            <div>
              <p className="text-lg font-medium text-ink dark:text-zinc-100">
                Arraste e solte seu PDF aqui
              </p>
              <p className="mt-1 text-sm text-ink-muted dark:text-zinc-400">
                ou{" "}
                <span className="font-medium text-accent underline-offset-2 group-hover:underline">
                  clique para selecionar
                </span>{" "}
                um arquivo
              </p>
              <p className="mt-3 text-xs text-ink-muted dark:text-zinc-500">
                Arquivos grandes (dezenas de MB) são ok — o texto é extraído no
                seu navegador antes do envio.
              </p>
            </div>
          </>
        )}
      </div>

      {errorMsg && (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
          {errorMsg}
        </p>
      )}
    </div>
  );
}

/** Percentual global 0–99 a partir da fase + progresso interno. */
function computeOverallPercent(
  progress: StructureProgress | null,
  softFrac: number,
): number {
  if (!progress) return 0;
  const { phase, current = 0, total = 0 } = progress;
  const extractEnd = PHASE_WEIGHT.extracting;
  const aiEnd = extractEnd + PHASE_WEIGHT.ai;

  if (phase === "extracting") {
    const frac = total > 0 ? Math.min(1, current / total) : 0.15;
    return Math.max(1, Math.round(frac * extractEnd));
  }

  if (phase === "mapping") {
    // Trechos concluídos + fração do trecho em andamento (softFrac).
    const base = total > 0 ? Math.min(1, current / total) : 0;
    const step = total > 0 && current < total ? (softFrac * 0.9) / total : 0;
    return Math.round(extractEnd + Math.min(1, base + step) * PHASE_WEIGHT.ai);
  }

  if (phase === "analyzing") {
    return Math.round(extractEnd + softFrac * PHASE_WEIGHT.ai);
  }

  if (phase === "reducing") {
    return Math.round(aiEnd + softFrac * PHASE_WEIGHT.reducing);
  }

  return extractEnd;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const maxAttempts = 4;
  const delays = [0, 2_000, 5_000, 12_000];
  let lastErr: Error | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (delays[attempt]) await sleep(delays[attempt]);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as T & {
        error?: string;
        code?: string;
      };
      if (!res.ok) {
        const msg =
          data.error ??
          formatError(
            `Falha na requisição (${res.status}).`,
            ErrorCode.NETWORK,
          );
        const err = new Error(msg);
        if (
          data.code === ErrorCode.MAP_RATE ||
          msg.includes(ErrorCode.MAP_RATE)
        ) {
          lastErr = err;
          continue;
        }
        throw err;
      }
      return data;
    } catch (err) {
      if (err instanceof Error && /\[[A-Z0-9-]+\]/.test(err.message)) {
        if (err.message.includes(ErrorCode.MAP_RATE)) {
          lastErr = err;
          continue;
        }
        throw err;
      }
      throw new Error(
        formatError(
          err instanceof Error ? err.message : "Falha de rede.",
          ErrorCode.NETWORK,
        ),
      );
    }
  }

  throw (
    lastErr ??
    new Error(
      formatError(
        "Limite de uso da IA atingido. Aguarde um minuto e tente novamente.",
        ErrorCode.MAP_RATE,
      ),
    )
  );
}

async function mapChunksWithConcurrency(
  chunks: string[],
  limit: number,
  onProgress: (current: number, total: number) => void,
): Promise<{ topics: MappedTopic[]; failedChunks: number }> {
  const results = new Array<MappedTopic[]>(chunks.length);
  let cursor = 0;
  let completed = 0;
  let failedChunks = 0;

  async function worker() {
    while (cursor < chunks.length) {
      const index = cursor++;
      if (index > 0) await sleep(MAP_CHUNK_DELAY_MS);
      // Atualiza rótulo com o trecho em andamento (antes da resposta).
      onProgress(completed, chunks.length);
      try {
        const res = await postJson<{ topics: MappedTopic[] }>(
          "/api/process-map",
          { chunk: chunks[index] },
        );
        results[index] = res.topics ?? [];
      } catch (err) {
        console.warn("Chunk ignorado após falha no MAP:", index, err);
        results[index] = [];
        failedChunks++;
      }
      completed++;
      onProgress(completed, chunks.length);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, chunks.length) }, () => worker()),
  );
  return { topics: results.flat(), failedChunks };
}

function progressLabel(progress: StructureProgress | null): string {
  if (!progress) return "Preparando…";
  switch (progress.phase) {
    case "extracting":
      return progress.total
        ? `Lendo o PDF… (página ${progress.current ?? 0} de ${progress.total})`
        : "Lendo o PDF…";
    case "analyzing":
      return "A IA está analisando o documento…";
    case "mapping": {
      const total = progress.total ?? 0;
      const done = progress.current ?? 0;
      const working = Math.min(total, done + 1);
      return total
        ? `A IA está categorizando… (trecho ${working} de ${total})`
        : "A IA está categorizando…";
    }
    case "reducing":
      return "A IA está consolidando as categorias…";
    default:
      return "Processando…";
  }
}

function UploadIcon() {
  return (
    <svg
      className="h-10 w-10 text-ink-muted transition group-hover:text-accent"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 16V4m0 0l-4 4m4-4l4 4" />
      <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg
      className="h-8 w-8 animate-spin text-accent"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );
}
