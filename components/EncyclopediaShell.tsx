"use client";

import { useMemo, useState } from "react";
import type { Category, Encyclopedia } from "@/lib/schema";
import { useSearch } from "./app/search-context";
import CategoryNav from "./CategoryNav";
import ContentView from "./ContentView";

interface EncyclopediaShellProps {
  data: Encyclopedia;
}

/**
 * Exibe um documento processado: navegação de categorias (coluna
 * secundária) + conteúdo principal. A busca vem da barra global no topo
 * (SearchContext), então aqui apenas filtramos/destacamos o resultado.
 */
export default function EncyclopediaShell({ data }: EncyclopediaShellProps) {
  const { search } = useSearch();
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
            topic.content.toLowerCase().includes(term),
        );

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
    <div className="flex h-full min-h-0 flex-1 overflow-hidden">
      <CategoryNav
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
  );
}
