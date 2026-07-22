"use client";

import { createContext, useContext, useState } from "react";

interface SearchContextValue {
  search: string;
  setSearch: (value: string) => void;
}

const SearchContext = createContext<SearchContextValue | null>(null);

/**
 * Provê o termo de busca global (barra no topo) para toda a área logada.
 * Assim a barra de pesquisa vive no topo da página (app shell) enquanto o
 * conteúdo do documento (EncyclopediaShell) apenas consome o termo.
 */
export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [search, setSearch] = useState("");
  return (
    <SearchContext.Provider value={{ search, setSearch }}>
      {children}
    </SearchContext.Provider>
  );
}

/**
 * Hook para ler/alterar a busca. Fora do provider retorna um valor inerte
 * (evita quebrar componentes usados isoladamente).
 */
export function useSearch(): SearchContextValue {
  const ctx = useContext(SearchContext);
  if (!ctx) return { search: "", setSearch: () => {} };
  return ctx;
}
