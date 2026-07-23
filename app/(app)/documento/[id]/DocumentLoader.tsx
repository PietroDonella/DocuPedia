"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Encyclopedia } from "@/lib/schema";
import { normalizeEncyclopedia } from "@/lib/schema";
import EncyclopediaShell from "@/components/EncyclopediaShell";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; data: Encyclopedia }
  | { status: "not-found" };

/**
 * Fallback de carregamento: quando o documento não veio do Supabase,
 * tenta o sessionStorage (útil logo após o processamento, antes de o
 * banco refletir a escrita). Sem cache local → não encontrado.
 */
export default function DocumentLoader({ id }: { id: string }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    try {
      const cached = sessionStorage.getItem(`docupedia:${id}`);
      if (cached) {
        setState({
          status: "ready",
          data: normalizeEncyclopedia(JSON.parse(cached)),
        });
        return;
      }
    } catch {
      // ignore
    }

    setState({ status: "not-found" });
  }, [id]);

  if (state.status === "loading") {
    return (
      <div className="grid h-full flex-1 place-items-center px-6 text-center">
        <p className="text-ink-muted dark:text-zinc-500">
          Carregando documento…
        </p>
      </div>
    );
  }

  if (state.status === "not-found") {
    return (
      <div className="grid h-full flex-1 place-items-center px-6 text-center">
        <div className="max-w-md">
          <h1 className="text-2xl font-semibold text-ink dark:text-zinc-100">
            Documento não encontrado
          </h1>
          <p className="mt-3 text-ink-soft dark:text-zinc-400">
            Não foi possível carregar este documento. Ele pode pertencer a
            outra conta ou ainda não ter sido salvo. Envie o PDF novamente para
            visualizá-lo.
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
