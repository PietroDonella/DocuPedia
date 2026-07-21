"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ProcessPdfResponse } from "@/lib/types";

type Status = "idle" | "dragging" | "uploading" | "error";

export default function UploadArea() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [fileName, setFileName] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setErrorMsg(null);

      if (file.type !== "application/pdf") {
        setStatus("error");
        setErrorMsg("Por favor, envie um arquivo no formato PDF.");
        return;
      }

      setFileName(file.name);
      setStatus("uploading");

      try {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("/api/process-pdf", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const { error } = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(error ?? "Falha ao processar o PDF.");
        }

        const result = (await res.json()) as ProcessPdfResponse;

        // Armazenamento local: a página do documento lê daqui para exibir
        // o resultado sem reprocessar o PDF.
        try {
          sessionStorage.setItem(
            `docupedia:${result.id}`,
            JSON.stringify(result.data),
          );
        } catch {
          // sessionStorage pode falhar (modo privado / cota).
        }

        router.push(`/documento/${result.id}`);
      } catch (err) {
        setStatus("error");
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
          isBusy && "pointer-events-none opacity-70",
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
          <>
            <Spinner />
            <div>
              <p className="font-medium text-ink dark:text-zinc-100">
                Analisando o documento…
              </p>
              <p className="mt-1 text-sm text-ink-muted dark:text-zinc-400">
                Extraindo o texto e organizando com IA. Isso pode levar alguns
                segundos.
              </p>
              {fileName && (
                <p className="mt-2 text-xs text-ink-muted dark:text-zinc-500">
                  {fileName}
                </p>
              )}
            </div>
          </>
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
