"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Mode = "signin" | "signup";

/**
 * Tela de autenticação (e-mail/senha) via Supabase Auth.
 * - Entrar: signInWithPassword → redireciona para a home.
 * - Cadastrar: signUp → entra direto (se e-mail não exige confirmação) ou
 *   mostra aviso para confirmar o e-mail.
 */
export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    const supabase = createClient();

    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        router.push("/");
        router.refresh();
        return;
      }

      // signup
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;

      // Se o projeto exige confirmação de e-mail, não há sessão ainda.
      if (data.session) {
        router.push("/");
        router.refresh();
      } else {
        setInfo(
          "Conta criada! Verifique seu e-mail para confirmar o cadastro e depois faça login.",
        );
        setMode("signin");
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? traduzErro(err.message)
          : "Não foi possível autenticar. Tente novamente.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-accent text-lg font-semibold text-white">
            D
          </span>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-ink dark:text-zinc-100">
            {mode === "signin" ? "Entrar no DocuPedia" : "Criar sua conta"}
          </h1>
          <p className="mt-2 text-sm text-ink-soft dark:text-zinc-400">
            {mode === "signin"
              ? "Acesse seus PDFs categorizados."
              : "Comece a organizar seus PDFs com IA."}
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl border border-surface-border bg-surface-subtle p-6 dark:border-white/10 dark:bg-zinc-900"
        >
          <div>
            <label
              htmlFor="email"
              className="mb-1.5 block text-sm font-medium text-ink dark:text-zinc-200"
            >
              E-mail
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-surface-border bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 dark:border-white/10 dark:bg-white/5 dark:text-zinc-100"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block text-sm font-medium text-ink dark:text-zinc-200"
            >
              Senha
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              autoComplete={
                mode === "signin" ? "current-password" : "new-password"
              }
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-surface-border bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 dark:border-white/10 dark:bg-white/5 dark:text-zinc-100"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
              {error}
            </p>
          )}
          {info && (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
              {info}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition hover:bg-accent/90 disabled:opacity-60"
          >
            {loading
              ? "Aguarde…"
              : mode === "signin"
                ? "Entrar"
                : "Criar conta"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-ink-soft dark:text-zinc-400">
          {mode === "signin" ? "Ainda não tem conta?" : "Já tem uma conta?"}{" "}
          <button
            type="button"
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError(null);
              setInfo(null);
            }}
            className="font-medium text-accent hover:underline"
          >
            {mode === "signin" ? "Cadastre-se" : "Entrar"}
          </button>
        </p>
      </div>
    </main>
  );
}

/** Mensagens de erro comuns do Supabase → português amigável. */
function traduzErro(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("invalid login credentials"))
    return "E-mail ou senha incorretos.";
  if (m.includes("user already registered"))
    return "Este e-mail já está cadastrado. Faça login.";
  if (m.includes("password should be at least"))
    return "A senha deve ter pelo menos 6 caracteres.";
  if (m.includes("email not confirmed"))
    return "Confirme seu e-mail antes de entrar.";
  return msg;
}
