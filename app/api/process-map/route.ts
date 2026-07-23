import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { mapChunkTopics } from "@/lib/structure";
import { ErrorCode, classifyAiError, formatError } from "@/lib/errors";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * POST /api/process-map
 * Processa UM chunk de texto (passo MAP do map-reduce).
 */
export async function POST(req: Request) {
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

  try {
    const body = (await req.json()) as { chunk?: string };
    const chunk = body.chunk?.trim() ?? "";
    if (chunk.length < 20) {
      return NextResponse.json(
        {
          error: formatError(
            "Chunk de texto inválido ou muito curto.",
            ErrorCode.BAD_CHUNK,
          ),
          code: ErrorCode.BAD_CHUNK,
        },
        { status: 400 },
      );
    }

    const topics = await mapChunkTopics(chunk);
    return NextResponse.json({ topics });
  } catch (err) {
    const code = classifyAiError(err);
    const detail = err instanceof Error ? err.message : "erro desconhecido";
    console.error("Erro em /api/process-map:", code, detail);
    return NextResponse.json(
      {
        error: formatError(
          "Falha ao mapear o trecho do documento.",
          code,
        ),
        code,
        detail,
      },
      { status: 500 },
    );
  }
}
