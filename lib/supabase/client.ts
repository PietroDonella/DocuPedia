import { createBrowserClient } from "@supabase/ssr";

/**
 * Cliente Supabase para uso no NAVEGADOR (Client Components). Usado nas
 * telas de login/cadastro e para encerrar a sessão (sign out). A sessão
 * é sincronizada com os cookies lidos pelo servidor.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
