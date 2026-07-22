"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "docupedia-theme";

/**
 * Slider (switch) de modo escuro. Alterna a classe `.dark` no <html>,
 * persiste a escolha em localStorage e reflete o estado atual.
 *
 * O tema inicial é aplicado por um script inline no layout (evita flash),
 * então aqui apenas sincronizamos o estado do controle após montar.
 */
export default function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
    setMounted(true);
  }, []);

  function toggle() {
    const root = document.documentElement;
    const next = !root.classList.contains("dark");
    root.classList.toggle("dark", next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
    } catch {
      // ignore (modo privado)
    }
    setIsDark(next);
  }

  // Versão compacta (somente ícone) para a barra lateral colapsada.
  if (compact) {
    return (
      <button
        type="button"
        role="switch"
        aria-checked={mounted ? isDark : undefined}
        aria-label="Alternar modo escuro"
        title={isDark ? "Modo escuro" : "Modo claro"}
        onClick={toggle}
        className="grid h-9 w-9 place-items-center rounded-md text-ink-soft transition hover:bg-white hover:text-ink dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-zinc-100"
      >
        {isDark ? <MoonIcon /> : <SunIcon />}
      </button>
    );
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={mounted ? isDark : undefined}
      aria-label="Alternar modo escuro"
      onClick={toggle}
      className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-2 text-sm text-ink-soft transition hover:bg-white dark:text-zinc-400 dark:hover:bg-white/5"
    >
      <span className="flex items-center gap-2">
        {isDark ? <MoonIcon /> : <SunIcon />}
        {isDark ? "Modo escuro" : "Modo claro"}
      </span>

      <span
        className={[
          "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
          isDark ? "bg-accent" : "bg-surface-border",
        ].join(" ")}
      >
        <span
          className={[
            "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
            isDark ? "translate-x-4" : "translate-x-0.5",
          ].join(" ")}
        />
      </span>
    </button>
  );
}

function SunIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  );
}
