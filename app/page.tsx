import UploadArea from "@/components/UploadArea";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 py-16">
      <div className="mb-10 text-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent dark:bg-accent/20 dark:text-indigo-300">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          Powered by Gemini
        </span>
        <h1 className="mt-5 text-4xl font-semibold tracking-tight text-ink sm:text-5xl dark:text-zinc-100">
          DocuPedia
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-lg leading-relaxed text-ink-soft dark:text-zinc-400">
          Envie um PDF extenso — um livro técnico, um manual ou um livro de
          receitas — e receba uma enciclopédia categorizada e navegável,
          organizada automaticamente por IA.
        </p>
      </div>

      <div className="flex w-full flex-col items-center">
        <UploadArea />
        <p className="mt-6 text-center text-xs text-ink-muted dark:text-zinc-500">
          Seus arquivos são processados apenas para extrair o texto e gerar a
          estrutura. Formatos suportados: PDF com camada de texto.
        </p>
      </div>
    </main>
  );
}
