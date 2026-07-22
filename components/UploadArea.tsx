"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  ProcessPdfResponse,
  ProcessStreamEvent,
  StructureProgress,
} from "@/lib/types";

type Status = "idle" | "dragging" | "uploading" | "error";

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

      if (file.type !== "application/pdf") {
        setStatus("error");
        setErrorMsg("Por favor, envie um arquivo no formato PDF.");
        return;
      }

      setFileName(file.name);
      setProgress(null);
      setStatus("uploading");

      try {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("/api/process-pdf", {
          method: "POST",
          body: formData,
        });

        // Erros de validação/extração vêm como JSON (status != 2xx).
        if (!res.ok) {
          const { error } = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(error ?? "Falha ao processar o PDF.");
        }
        if (!res.body) throw new Error("Resposta sem corpo.");

        // Sucesso: a resposta é um stream NDJSON (um evento por linha).
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let result: ProcessPdfResponse | null = null;

        const handleLine = (line: string) => {
          const trimmed = line.trim();
          if (!trimmed) return;
          const event = JSON.parse(trimmed) as ProcessStreamEvent;

          if (event.type === "progress") {
            setProgress({
              phase: event.phase,
              current: event.current,
              total: event.total,
            });
          } else if (event.type === "error") {
            throw new Error(event.error);
          } else if (event.type === "done") {
            result = { id: event.id, data: event.data };
          }
        };

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let newlineIndex: number;
          while ((newlineIndex = buffer.indexOf("\n")) >= 0) {
            const line = buffer.slice(0, newlineIndex);
            buffer = buffer.slice(newlineIndex + 1);
            handleLine(line);
          }
        }
        // Processa qualquer resto sem quebra de linha final.
        if (buffer.trim()) handleLine(buffer);

        if (!result) throw new Error("Processamento não concluído.");
        const finalResult = result as ProcessPdfResponse;

        // Armazenamento local: a página do documento lê daqui para exibir
        // o resultado sem reprocessar o PDF.
        try {
          sessionStorage.setItem(
            `docupedia:${finalResult.id}`,
            JSON.stringify(finalResult.data),
          );
        } catch {
          // sessionStorage pode falhar (modo privado / cota).
        }

        // Atualiza os Server Components (lista de PDFs na barra lateral) e
        // navega para o documento recém-criado.
        router.push(`/documento/${finalResult.id}`);
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

  // Percentual determinístico apenas na fase de mapeamento; nas demais fases
  // a barra é "indeterminada" (animada).
  const percent =
    progress?.phase === "mapping" && progress.total
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

              {/* Barra de progresso */}
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

/** Texto amigável para cada fase do processamento. */
function progressLabel(progress: StructureProgress | null): string {
  if (!progress) return "Enviando e lendo o PDF…";
  switch (progress.phase) {
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
