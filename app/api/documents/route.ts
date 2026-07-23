import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { deleteDocument } from "@/lib/documents";
import { ErrorCode, formatError } from "@/lib/errors";

export const runtime = "nodejs";

/** DELETE /api/documents?id=<uuid> — remove um PDF do usuário logado. */
export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      {
        error: formatError("Não autenticado.", ErrorCode.UNAUTH),
        code: ErrorCode.UNAUTH,
      },
      { status: 401 },
    );
  }

  const id = new URL(req.url).searchParams.get("id")?.trim();
  if (!id) {
    return NextResponse.json(
      {
        error: formatError(
          "Parâmetro 'id' é obrigatório.",
          ErrorCode.BAD_REQUEST,
        ),
        code: ErrorCode.BAD_REQUEST,
      },
      { status: 400 },
    );
  }

  const ok = await deleteDocument(id);
  if (!ok) {
    return NextResponse.json(
      {
        error: formatError(
          "Não foi possível excluir o documento.",
          ErrorCode.DELETE_FAIL,
        ),
        code: ErrorCode.DELETE_FAIL,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
