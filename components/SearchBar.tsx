"use client";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  documentTitle: string;
}

/**
 * Barra de pesquisa fixa no topo da tela. Filtra tópicos/categorias
 * em tempo real (a lógica de filtro vive no shell da enciclopédia).
 */
export default function SearchBar({
  value,
  onChange,
  documentTitle,
}: SearchBarProps) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-surface-border bg-surface/90 px-6 backdrop-blur dark:border-white/10 dark:bg-zinc-950/90">
      <a
        href="/"
        className="flex shrink-0 items-center gap-2 font-semibold text-ink dark:text-zinc-100"
        title="Voltar para a página inicial"
      >
        <span className="grid h-7 w-7 place-items-center rounded-md bg-accent text-sm text-white">
          D
        </span>
        <span className="hidden sm:inline">DocuPedia</span>
      </a>

      <div className="relative mx-auto w-full max-w-xl">
        <SearchIcon />
        <input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Pesquisar em "${documentTitle}"…`}
          className="w-full rounded-lg border border-surface-border bg-surface-subtle py-2 pl-10 pr-4 text-sm text-ink outline-none transition placeholder:text-ink-muted focus:border-accent focus:bg-white focus:ring-2 focus:ring-accent/20 dark:border-white/10 dark:bg-white/5 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:bg-white/10"
        />
      </div>

      <div className="hidden w-24 shrink-0 sm:block" aria-hidden="true" />
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
