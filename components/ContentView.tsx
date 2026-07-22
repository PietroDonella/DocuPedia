"use client";

import type { Category } from "@/lib/schema";

interface ContentViewProps {
  documentTitle: string;
  documentDescription?: string;
  category: Category | null;
  /** Termo de busca ativo — usado para destacar (highlight) no texto. */
  searchTerm: string;
  /** True quando a busca não retornou nenhum resultado. */
  isEmptySearch: boolean;
}

/**
 * Área principal de conteúdo. Exibe os tópicos e o conteúdo completo da
 * categoria selecionada, com tipografia pensada para leitura longa
 * (estilo doc/wiki) e destaque do termo pesquisado.
 */
export default function ContentView({
  documentTitle,
  documentDescription,
  category,
  searchTerm,
  isEmptySearch,
}: ContentViewProps) {
  const term = searchTerm.trim();

  return (
    <main className="min-h-0 min-w-0 flex-1 overflow-y-auto px-6 py-10 lg:px-12">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8 border-b border-surface-border pb-6 dark:border-white/10">
          <p className="text-xs font-medium uppercase tracking-wider text-accent">
            {documentTitle}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink dark:text-zinc-100">
            {category?.name ?? "Visão geral"}
          </h1>
          {category?.description ? (
            <p className="mt-3 text-base leading-relaxed text-ink-soft dark:text-zinc-400">
              {highlight(category.description, term)}
            </p>
          ) : (
            documentDescription && (
              <p className="mt-3 text-base leading-relaxed text-ink-soft dark:text-zinc-400">
                {highlight(documentDescription, term)}
              </p>
            )
          )}
        </header>

        {isEmptySearch ? (
          <EmptyState searchTerm={searchTerm} />
        ) : (
          <div className="space-y-10">
            {category?.topics.map((topic, index) => (
              <article
                key={`${topic.title}-${index}`}
                id={slugify(topic.title)}
                className="scroll-mt-24"
              >
                <h2 className="text-xl font-semibold text-ink dark:text-zinc-100">
                  {highlight(topic.title, term)}
                </h2>
                <div className="mt-2 space-y-3">
                  {splitParagraphs(topic.summary).map((paragraph, i) => (
                    <p
                      key={i}
                      className="leading-7 text-ink-soft dark:text-zinc-300"
                    >
                      {highlight(paragraph, term)}
                    </p>
                  ))}
                </div>
              </article>
            ))}

            {category && category.topics.length === 0 && (
              <p className="text-ink-muted dark:text-zinc-500">
                Esta categoria ainda não possui tópicos.
              </p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

function EmptyState({ searchTerm }: { searchTerm: string }) {
  return (
    <div className="rounded-xl border border-dashed border-surface-border bg-surface-subtle px-6 py-16 text-center dark:border-white/10 dark:bg-white/5">
      <p className="text-ink dark:text-zinc-100">
        Nenhum resultado para{" "}
        <span className="font-medium">&ldquo;{searchTerm}&rdquo;</span>.
      </p>
      <p className="mt-1 text-sm text-ink-muted dark:text-zinc-500">
        Tente outro termo ou limpe a busca.
      </p>
    </div>
  );
}

/**
 * Destaca todas as ocorrências de `term` em `text`, envolvendo-as em <mark>.
 * A busca é case-insensitive.
 *
 * Ao usar um grupo de captura no `split`, os índices ÍMPARES do array
 * resultante são exatamente os trechos que casaram com o termo.
 */
function highlight(text: string, term: string): React.ReactNode {
  if (!term) return text;

  // Escapa caracteres especiais de regex no termo digitado.
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));

  if (parts.length === 1) return text;

  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <mark
        key={i}
        className="rounded bg-yellow-200 px-0.5 text-ink dark:bg-yellow-500/40 dark:text-yellow-50"
      >
        {part}
      </mark>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

function splitParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}|\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
