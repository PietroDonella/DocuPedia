import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { deleteDocument } from "@/lib/documents";

export const runtime = "nodejs";

/** DELETE /api/documents?id=<uuid> — remove um PDF do usuário logado. */
export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const id = new URL(req.url).searchParams.get("id")?.trim();
  if (!id) {
    return NextResponse.json(
      { error: "Parâmetro 'id' é obrigatório." },
      { status: 400 },
    );
  }

  const ok = await deleteDocument(id);
  if (!ok) {
    return NextResponse.json(
      { error: "Não foi possível excluir o documento." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
