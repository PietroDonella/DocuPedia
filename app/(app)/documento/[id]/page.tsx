import EncyclopediaShell from "@/components/EncyclopediaShell";
import { getDocument } from "@/lib/documents";
import DocumentLoader from "./DocumentLoader";

// Sempre renderiza sob demanda (depende do id da requisição / do banco).
export const dynamic = "force-dynamic";

// -----------------------------------------------------------------------
// Página do documento: /documento/[id]
//
// 1) Tenta buscar o documento do usuário no Supabase (RLS garante que só
//    o dono acessa).
// 2) Se não encontrar (ex.: acabou de processar e o cache local é mais
//    rápido), cai para o DocumentLoader, que lê do sessionStorage.
// -----------------------------------------------------------------------
export default async function DocumentoPage({
  params,
}: {
  params: { id: string };
}) {
  const data = await getDocument(params.id);

  if (data) {
    return <EncyclopediaShell data={data} />;
  }

  return <DocumentLoader id={params.id} />;
}
