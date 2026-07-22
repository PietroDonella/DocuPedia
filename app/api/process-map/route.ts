import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { mapChunkTopics } from "@/lib/structure";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/process-map
 * Processa UM chunk de texto (passo MAP do map-reduce).
 * Chamadas curtas — compatível com o limite de tempo da Vercel Hobby.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  try {
    const body = (await req.json()) as { chunk?: string };
    const chunk = body.chunk?.trim() ?? "";
    if (chunk.length < 20) {
      return NextResponse.json(
        { error: "Chunk de texto inválido ou muito curto." },
        { status: 400 },
      );
    }

    const topics = await mapChunkTopics(chunk);
    return NextResponse.json({ topics });
  } catch (err) {
    console.error("Erro em /api/process-map:", err);
    return NextResponse.json(
      { error: "Falha ao mapear o trecho do documento." },
      { status: 500 },
    );
  }
}
