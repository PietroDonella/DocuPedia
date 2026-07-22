"use client";

import { useEffect, useState } from "react";
import type { DocumentListItem } from "@/lib/documents";
import AppSidebar from "./AppSidebar";
import TopSearchBar from "./TopSearchBar";
import { SearchProvider } from "./search-context";

const COLLAPSE_KEY = "docupedia-sidebar-collapsed";

interface AppShellProps {
  userEmail: string;
  documents: DocumentListItem[];
  children: React.ReactNode;
}

/**
 * Casca da área logada:
 * - Barra lateral SEMPRE visível (colapsável) — Home, PDFs, usuário + tema.
 * - Barra de busca centralizada no topo.
 * - Conteúdo principal (upload ou PDF categorizado) ocupa o restante.
 */
export default function AppShell({
  userEmail,
  documents,
  children,
}: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);

  // Restaura a preferência de colapso após montar (evita mismatch de SSR).
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      // ignore
    }
  }, []);

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  }

  return (
    <SearchProvider>
      {/* h-screen + overflow-hidden: só a coluna da direita rola. */}
      <div className="flex h-screen overflow-hidden">
        <AppSidebar
          userEmail={userEmail}
          documents={documents}
          collapsed={collapsed}
          onToggle={toggle}
        />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <TopSearchBar />
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            {children}
          </div>
        </div>
      </div>
    </SearchProvider>
  );
}
