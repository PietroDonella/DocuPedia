import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DocuPedia — Sua enciclopédia a partir de PDFs",
  description:
    "Envie um PDF extenso e transforme-o em uma enciclopédia categorizada e navegável com IA.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        {/*
          Aplica o tema ANTES da hidratação para evitar "flash" de tema
          errado. Lê a preferência salva ou cai no esquema do sistema.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                try {
                  var stored = localStorage.getItem('docupedia-theme');
                  var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  if (stored === 'dark' || (!stored && prefersDark)) {
                    document.documentElement.classList.add('dark');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-screen bg-surface font-sans text-ink antialiased transition-colors dark:bg-zinc-950 dark:text-zinc-100">
        {children}
      </body>
    </html>
  );
}
