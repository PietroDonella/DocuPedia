import { createClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

/**
 * Retorna o usuário autenticado (ou `null`) no servidor. Usa `getUser()`,
 * que valida o token junto ao Supabase — seguro para proteger páginas.
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  } catch {
    return null;
  }
}
