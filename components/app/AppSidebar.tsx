"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { DocumentListItem } from "@/lib/documents";
import ThemeToggle from "@/components/ThemeToggle";

interface AppSidebarProps {
  userEmail: string;
  documents: DocumentListItem[];
  collapsed: boolean;
  onToggle: () => void;
}

/**
 * Barra lateral sempre visível (área logada):
 * - Topo: marca + botão para expandir/retrair.
 * - Home: leva à área de upload de novos PDFs.
 * - Lista dos PDFs já categorizados pelo usuário.
 * - Rodapé: usuário logado, modo noturno e sair.
 */
export default function AppSidebar({
  userEmail,
  documents,
  collapsed,
  onToggle,
}: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  const isHome = pathname === "/";

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await createClient().auth.signOut();
      router.push("/login");
      router.refresh();
    } catch {
      setSigningOut(false);
    }
  }

  return (
    <aside
      className={[
        // h-full (pai tem h-screen): a barra ocupa a altura da viewport e
        // não rola junto com o conteúdo do PDF.
        "flex h-full shrink-0 flex-col border-r border-surface-border bg-surface-subtle transition-[width] duration-200 dark:border-white/10 dark:bg-zinc-900",
        collapsed ? "w-16" : "w-72",
      ].join(" ")}
    >
      {/* Marca + toggle */}
      <div className="flex h-16 items-center gap-2 border-b border-surface-border px-3 dark:border-white/10">
        {!collapsed && (
          <Link
            href="/"
            className="flex min-w-0 flex-1 items-center gap-2 font-semibold text-ink dark:text-zinc-100"
          >
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-accent text-sm text-white">
              D
            </span>
            <span className="truncate">DocuPedia</span>
          </Link>
        )}
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? "Expandir barra lateral" : "Retrair barra lateral"}
          title={collapsed ? "Expandir" : "Retrair"}
          className={[
            "grid h-9 w-9 shrink-0 place-items-center rounded-md text-ink-soft transition hover:bg-white hover:text-ink dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-zinc-100",
            collapsed ? "mx-auto" : "",
          ].join(" ")}
        >
          <ChevronIcon open={!collapsed} />
        </button>
      </div>

      {/* Home / novo PDF */}
      <div className="px-3 pt-4">
        <Link
          href="/"
          title="Início — enviar novo PDF"
          className={[
            "flex items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium transition",
            collapsed ? "justify-center" : "",
            isHome
              ? "bg-accent-soft text-accent dark:bg-accent/20 dark:text-indigo-300"
              : "text-ink-soft hover:bg-white hover:text-ink dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-zinc-100",
          ].join(" ")}
        >
          <HomeIcon />
          {!collapsed && <span>Início</span>}
        </Link>
      </div>

      {/* Lista de PDFs do usuário */}
      <div className="mt-4 min-h-0 flex-1 overflow-y-auto px-3">
        {!collapsed && (
          <p className="px-2.5 pb-2 text-xs font-semibold uppercase tracking-wider text-ink-muted dark:text-zinc-500">
            Seus PDFs
          </p>
        )}

        <nav className="space-y-0.5">
          {documents.length === 0 && !collapsed && (
            <p className="px-2.5 py-2 text-sm text-ink-muted dark:text-zinc-500">
              Nenhum PDF ainda. Envie um na tela inicial.
            </p>
          )}

          {documents.map((doc) => {
            const href = `/documento/${doc.id}`;
            const isActive = pathname === href;
            return (
              <Link
                key={doc.id}
                href={href}
                title={doc.title}
                className={[
                  "flex items-center gap-3 rounded-md px-2.5 py-2 text-sm transition",
                  collapsed ? "justify-center" : "",
                  isActive
                    ? "bg-accent-soft font-medium text-accent dark:bg-accent/20 dark:text-indigo-300"
                    : "text-ink-soft hover:bg-white hover:text-ink dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-zinc-100",
                ].join(" ")}
              >
                <DocIcon />
                {!collapsed && <span className="truncate">{doc.title}</span>}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Rodapé: usuário + tema + sair */}
      <div className="border-t border-surface-border p-3 dark:border-white/10">
        {collapsed ? (
          <div className="flex flex-col items-center gap-2">
            <span
              title={userEmail}
              className="grid h-9 w-9 place-items-center rounded-full bg-accent/15 text-sm font-medium uppercase text-accent dark:bg-accent/25 dark:text-indigo-200"
            >
              {userEmail.charAt(0)}
            </span>
            <ThemeToggle compact />
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              aria-label="Sair"
              title="Sair"
              className="grid h-9 w-9 place-items-center rounded-md text-ink-soft transition hover:bg-white hover:text-ink disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-zinc-100"
            >
              <LogoutIcon />
            </button>
          </div>
        ) : (
          <div className="space-y-1">
            <div className="flex items-center gap-2 rounded-md px-2 py-1.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent/15 text-sm font-medium uppercase text-accent dark:bg-accent/25 dark:text-indigo-200">
                {userEmail.charAt(0)}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-ink dark:text-zinc-200">
                {userEmail}
              </span>
              <button
                type="button"
                onClick={handleSignOut}
                disabled={signingOut}
                aria-label="Sair"
                title="Sair"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-ink-muted transition hover:bg-white hover:text-ink disabled:opacity-50 dark:text-zinc-500 dark:hover:bg-white/5 dark:hover:text-zinc-100"
              >
                <LogoutIcon />
              </button>
            </div>
            <ThemeToggle />
          </div>
        )}
      </div>
    </aside>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={["h-5 w-5 transition-transform", open ? "" : "rotate-180"].join(
        " ",
      )}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg
      className="h-5 w-5 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 10.5L12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
    </svg>
  );
}

function DocIcon() {
  return (
    <svg
      className="h-5 w-5 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z" />
      <path d="M14 3v5h5M9 13h6M9 17h6" />
    </svg>
  );
}

function LogoutIcon() {
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
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
      <path d="M16 17l5-5-5-5M21 12H9" />
    </svg>
  );
}
