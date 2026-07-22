import { redirect } from "next/navigation";
import AppShell from "@/components/app/AppShell";
import { getCurrentUser } from "@/lib/auth";
import { listUserDocuments } from "@/lib/documents";

// A lista de PDFs e o usuário dependem da sessão → sempre dinâmico.
export const dynamic = "force-dynamic";

/**
 * Layout da área logada. Garante a autenticação (redireciona para /login
 * se não houver sessão) e monta a casca com a barra lateral sempre visível.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const documents = await listUserDocuments();
  const email = user.email ?? "Usuário";

  return (
    <AppShell userEmail={email} documents={documents}>
      {children}
    </AppShell>
  );
}
