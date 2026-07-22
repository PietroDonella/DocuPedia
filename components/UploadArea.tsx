"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { extractPdfText } from "@/lib/pdf-client";
import { CHUNK_SIZE, SINGLE_PASS_LIMIT, chunkText } from "@/lib/chunk";
import type { MappedTopic, ProcessPdfResponse, StructureProgress } from "@/lib/types";

type Status = "idle" | "dragging" | "uploading" | "error";

/** Concorrência de chamadas MAP no cliente (cada uma = 1 função Vercel). */
const CLIENT_MAP_CONCURRENCY = 2;
/** Limite defensivo de caracteres enviados à IA. */
const MAX_CHARS = 500_000;

export default function UploadArea() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [fileName, setFileName] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [progress, setProgress] = useState<StructureProgress | null>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setErrorMsg(null);

      if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
        setStatus("error");
        setErrorMsg("Por favor, envie um arquivo no formato PDF.");
        return;
      }

      setFileName(file.name);
      setProgress({ phase: "extracting", current: 0, total: 0 });
      setStatus("uploading");

      try {
        // 1) Extração no navegador — evita o limite de ~4,5 MB do body na Vercel.
        const rawText = await extractPdfText(file, (current, total) => {
          setProgress({ phase: "extracting", current, total });
        });

        if (rawText.length < 50) {
          throw new Error(
            "Não foi possível extrair texto suficiente do PDF. Ele pode ser um PDF de imagens (escaneado) sem camada de texto.",
          );
        }

        const text = rawText.slice(0, MAX_CHARS);
        let result: ProcessPdfResponse;

        if (text.length <= SINGLE_PASS_LIMIT) {
          // 2a) Documento pequeno: uma única chamada.
          setProgress({ phase: "analyzing" });
          result = await postJson<ProcessPdfResponse>("/api/process-reduce", {
            mode: "analyze",
            text,
          });
        } else {
          // 2b) Documento grande: map-reduce em várias invocações curtas.
          const chunks = chunkText(text, CHUNK_SIZE);
          setProgress({ phase: "mapping", current: 0, total: chunks.length });

          const mapped = await mapChunksWithConcurrency(
            chunks,
            CLIENT_MAP_CONCURRENCY,
            (current, total) =>
              setProgress({ phase: "mapping", current, total }),
          );

          if (mapped.length === 0) {
            throw new Error(
              "A IA não conseguiu extrair tópicos deste documento. Tente outro PDF.",
            );
          }

          setProgress({ phase: "reducing" });
          result = await postJson<ProcessPdfResponse>("/api/process-reduce", {
            mode: "reduce",
            topics: mapped,
          });
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

  const percent =
    (progress?.phase === "mapping" || progress?.phase === "extracting") &&
    progress.total
      ? Math.min(99, Math.round(((progress.current ?? 0) / progress.total) * 100))
      : null;

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

              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-surface-border dark:bg-white/10">
                {percent !== null ? (
                  <div
                    className="h-full rounded-full bg-accent transition-all duration-500 ease-out"
                    style={{ width: `${percent}%` }}
                  />
                ) : (
                  <div className="h-full w-full animate-pulse rounded-full bg-accent/70" />
                )}
              </div>

              {percent !== null && (
                <p className="mt-1.5 text-right text-xs text-ink-muted dark:text-zinc-500">
                  {percent}%
                </p>
              )}

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

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data.error ?? `Falha na requisição (${res.status}).`);
  }
  return data;
}

async function mapChunksWithConcurrency(
  chunks: string[],
  limit: number,
  onProgress: (current: number, total: number) => void,
): Promise<MappedTopic[]> {
  const results = new Array<MappedTopic[]>(chunks.length);
  let cursor = 0;
  let completed = 0;

  async function worker() {
    while (cursor < chunks.length) {
      const index = cursor++;
      const res = await postJson<{ topics: MappedTopic[] }>("/api/process-map", {
        chunk: chunks[index],
      });
      results[index] = res.topics ?? [];
      completed++;
      onProgress(completed, chunks.length);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, chunks.length) }, () => worker()),
  );
  return results.flat();
}

function progressLabel(progress: StructureProgress | null): string {
  if (!progress) return "Preparando…";
  switch (progress.phase) {
    case "extracting":
      return progress.total
        ? `Lendo o PDF… (página ${progress.current ?? 0} de ${progress.total})`
        : "Lendo o PDF…";
    case "analyzing":
      return "Analisando o documento…";
    case "mapping":
      return `Categorizando o conteúdo… (parte ${progress.current ?? 0} de ${
        progress.total ?? 0
      })`;
    case "reducing":
      return "Consolidando as categorias…";
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
