"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useSearch } from "./search-context";

/**
 * Barra de pesquisa CENTRALIZADA no topo da página.
 * Filtra o documento aberto (via SearchContext). Fora de uma página de
 * documento, fica desabilitada.
 */
export default function TopSearchBar() {
  const { search, setSearch } = useSearch();
  const pathname = usePathname();
  const onDocument = pathname.startsWith("/documento/");

  // Limpa a busca ao trocar de página (evita filtro “preso” em outro PDF).
  useEffect(() => {
    setSearch("");
  }, [pathname, setSearch]);

  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-center border-b border-surface-border bg-surface/90 px-6 backdrop-blur dark:border-white/10 dark:bg-zinc-950/90">
      <div className="relative w-full max-w-xl">
        <SearchIcon />
        <input
          type="search"
          value={onDocument ? search : ""}
          disabled={!onDocument}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={
            onDocument
              ? "Pesquisar neste documento…"
              : "Abra um PDF para pesquisar dentro dele"
          }
          className="w-full rounded-lg border border-surface-border bg-surface-subtle py-2.5 pl-10 pr-4 text-center text-sm text-ink outline-none transition placeholder:text-center placeholder:text-ink-muted focus:border-accent focus:bg-white focus:text-left focus:ring-2 focus:ring-accent/20 focus:placeholder:text-left disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:bg-white/10"
        />
      </div>
    </header>
  );
}

function SearchIcon() {
  return (
    <svg
      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}
