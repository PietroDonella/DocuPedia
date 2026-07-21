"use client";

import { useMemo, useState } from "react";
import type { Category, Encyclopedia } from "@/lib/schema";
import SearchBar from "./SearchBar";
import Sidebar from "./Sidebar";
import ContentView from "./ContentView";

interface EncyclopediaShellProps {
  data: Encyclopedia;
}

/**
 * Componente cliente que orquestra a experiência de enciclopédia:
 * barra de pesquisa (topo) + menu lateral (categorias) + conteúdo principal.
 *
 * Toda a interatividade (busca e navegação) acontece no cliente sobre o
 * objeto já processado pela IA — nenhuma nova chamada de rede é necessária.
 */
export default function EncyclopediaShell({ data }: EncyclopediaShellProps) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(
    data.categories[0]?.name ?? null,
  );

  const term = search.trim().toLowerCase();

  // Filtra as categorias/tópicos conforme o termo de busca.
  const filteredCategories = useMemo<Category[]>(() => {
    if (!term) return data.categories;

    return data.categories
      .map((category) => {
        const categoryMatches = category.name.toLowerCase().includes(term);
        const matchingTopics = category.topics.filter(
          (topic) =>
            topic.title.toLowerCase().includes(term) ||
            topic.summary.toLowerCase().includes(term),
        );

        // Se o nome da categoria bate, mantemos todos os tópicos.
        if (categoryMatches) return category;
        if (matchingTopics.length > 0)
          return { ...category, topics: matchingTopics };
        return null;
      })
      .filter((c): c is Category => c !== null);
  }, [data.categories, term]);

  // Categoria efetivamente exibida (respeitando a busca).
  const currentCategory = useMemo<Category | null>(() => {
    if (filteredCategories.length === 0) return null;
    const found = filteredCategories.find((c) => c.name === activeCategory);
    return found ?? filteredCategories[0];
  }, [filteredCategories, activeCategory]);

  const isEmptySearch = term.length > 0 && filteredCategories.length === 0;

  return (
    <div className="flex min-h-screen flex-col">
      <SearchBar
        value={search}
        onChange={setSearch}
        documentTitle={data.title}
      />

      <div className="flex flex-1">
        <Sidebar
          documentTitle={data.title}
          categories={filteredCategories}
          activeCategory={currentCategory?.name ?? null}
          onSelectCategory={setActiveCategory}
        />

        <ContentView
          documentTitle={data.title}
          documentDescription={data.description}
          category={currentCategory}
          searchTerm={search}
          isEmptySearch={isEmptySearch}
        />
      </div>
    </div>
  );
}
