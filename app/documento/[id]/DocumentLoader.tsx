"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Encyclopedia } from "@/lib/schema";
import EncyclopediaShell from "@/components/EncyclopediaShell";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; data: Encyclopedia }
  | { status: "not-found" };

/**
 * Carrega o documento processado para exibição.
 *
 * Lê do sessionStorage o objeto que a `UploadArea` salvou logo após o
 * processamento pela IA. Não há banco de dados: se não houver dado em
 * cache nesta sessão, o documento é considerado não encontrado.
 */
export default function DocumentLoader({ id }: { id: string }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    try {
      const cached = sessionStorage.getItem(`docupedia:${id}`);
      if (cached) {
        setState({ status: "ready", data: JSON.parse(cached) as Encyclopedia });
        return;
      }
    } catch {
      // ignore
    }

    // Sem cache local nesta sessão → considerar não encontrado.
    setState({ status: "not-found" });
  }, [id]);

  if (state.status === "loading") {
    return (
      <div className="grid min-h-screen place-items-center px-6 text-center">
        <p className="text-ink-muted dark:text-zinc-500">
          Carregando documento…
        </p>
      </div>
    );
  }

  if (state.status === "not-found") {
    return (
      <div className="grid min-h-screen place-items-center px-6 text-center">
        <div className="max-w-md">
          <h1 className="text-2xl font-semibold text-ink dark:text-zinc-100">
            Documento não encontrado
          </h1>
          <p className="mt-3 text-ink-soft dark:text-zinc-400">
            Os dados deste documento não estão disponíveis nesta sessão. Como o
            resultado fica salvo apenas localmente no navegador, envie o PDF
            novamente para visualizá-lo.
          </p>
          <Link
            href="/"
            className="mt-6 inline-block rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white transition hover:bg-accent/90"
          >
            Enviar um PDF
          </Link>
        </div>
      </div>
    );
  }

  return <EncyclopediaShell data={state.data} />;
}
