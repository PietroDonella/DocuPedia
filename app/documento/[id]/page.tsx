import DocumentLoader from "./DocumentLoader";

// -----------------------------------------------------------------------
// Página do documento: /documento/[id]
//
// A exibição usa o armazenamento local do navegador (sessionStorage),
// preenchido logo após o upload. Não há banco de dados envolvido.
// -----------------------------------------------------------------------

export default function DocumentoPage({
  params,
}: {
  params: { id: string };
}) {
  return <DocumentLoader id={params.id} />;
}
