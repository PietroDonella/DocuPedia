import { createAdminClient, createClient } from "@/lib/supabase/server";
import type { Encyclopedia } from "@/lib/schema";

/**
 * Camada de persistência dos documentos processados (tabela `documents`).
 *
 * Os documentos são POR USUÁRIO:
 * - Leitura (getDocument / listUserDocuments) usa o cliente com a sessão do
 *   usuário; o RLS garante que cada um só enxergue os próprios documentos.
 * - Gravação (saveDocument) usa o cliente ADMIN e grava explicitamente o
 *   `user_id`, pois roda dentro do stream da rota (sem acesso aos cookies).
 *
 * ⚠️ Módulo de uso SOMENTE no servidor.
 */

/** Item enxuto para listar os PDFs do usuário na barra lateral. */
export interface DocumentListItem {
  id: string;
  title: string;
  created_at: string;
}

/** Persiste um documento vinculado ao usuário. Retorna `true` se salvou. */
export async function saveDocument(
  id: string,
  userId: string,
  data: Encyclopedia,
): Promise<boolean> {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("documents").insert({
      id,
      user_id: userId,
      title: data.title,
      content_json: data,
    });

    if (error) {
      console.error("Erro ao salvar documento no Supabase:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Falha ao salvar documento:", err);
    return false;
  }
}

/** Busca um documento do usuário autenticado. `null` se não encontrado. */
export async function getDocument(id: string): Promise<Encyclopedia | null> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("documents")
      .select("content_json")
      .eq("id", id)
      .maybeSingle();

    if (error || !data) return null;
    return data.content_json as Encyclopedia;
  } catch (err) {
    console.error("Falha ao buscar documento:", err);
    return null;
  }
}

/** Lista os documentos do usuário autenticado (mais recentes primeiro). */
export async function listUserDocuments(): Promise<DocumentListItem[]> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("documents")
      .select("id, title, created_at")
      .order("created_at", { ascending: false });

    if (error || !data) return [];
    return data as DocumentListItem[];
  } catch (err) {
    console.error("Falha ao listar documentos:", err);
    return [];
  }
}

/** Remove um documento do usuário autenticado. Retorna `true` se apagou. */
export async function deleteDocument(id: string): Promise<boolean> {
  try {
    const supabase = createClient();
    const { error } = await supabase.from("documents").delete().eq("id", id);
    if (error) {
      console.error("Erro ao deletar documento:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Falha ao deletar documento:", err);
    return false;
  }
}
