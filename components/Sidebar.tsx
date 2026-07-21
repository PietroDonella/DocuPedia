"use client";

import type { Category } from "@/lib/schema";
import ThemeToggle from "./ThemeToggle";

interface SidebarProps {
  documentTitle: string;
  categories: Category[];
  activeCategory: string | null;
  onSelectCategory: (name: string) => void;
}

/**
 * Menu lateral com as categorias geradas pela IA. Clicar em uma categoria
 * atualiza o conteúdo principal (estado controlado pelo shell). No rodapé
 * fica o slider de modo escuro.
 */
export default function Sidebar({
  documentTitle,
  categories,
  activeCategory,
  onSelectCategory,
}: SidebarProps) {
  return (
    <aside className="hidden w-64 shrink-0 border-r border-surface-border bg-surface-subtle md:flex md:flex-col dark:border-white/10 dark:bg-zinc-900">
      <div className="sticky top-16 flex max-h-[calc(100vh-4rem)] flex-col">
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <p className="px-2 text-xs font-semibold uppercase tracking-wider text-ink-muted dark:text-zinc-500">
            Categorias
          </p>

          <nav className="mt-3 space-y-0.5">
            {categories.length === 0 && (
              <p className="px-2 py-2 text-sm text-ink-muted dark:text-zinc-500">
                Nenhuma categoria encontrada.
              </p>
            )}

            {categories.map((category) => {
              const isActive = category.name === activeCategory;
              return (
                <button
                  key={category.name}
                  onClick={() => onSelectCategory(category.name)}
                  className={[
                    "flex w-full items-center justify-between gap-2 rounded-md px-2 py-2 text-left text-sm transition",
                    isActive
                      ? "bg-accent-soft font-medium text-accent dark:bg-accent/20 dark:text-indigo-300"
                      : "text-ink-soft hover:bg-white hover:text-ink dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-zinc-100",
                  ].join(" ")}
                >
                  <span className="truncate">{category.name}</span>
                  <span
                    className={[
                      "shrink-0 rounded-full px-1.5 text-xs",
                      isActive
                        ? "bg-accent/10 text-accent dark:bg-accent/30 dark:text-indigo-200"
                        : "bg-surface-border text-ink-muted dark:bg-white/10 dark:text-zinc-400",
                    ].join(" ")}
                  >
                    {category.topics.length}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="border-t border-surface-border p-3 dark:border-white/10">
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}
