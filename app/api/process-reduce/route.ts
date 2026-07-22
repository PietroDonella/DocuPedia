import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { saveDocument } from "@/lib/documents";
import {
  analyzeDocument,
  reduceMappedTopics,
} from "@/lib/structure";
import type { MappedTopic } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/process-reduce
 *
 * Body:
 * - { mode: "analyze", text } — documento pequeno (single-pass)
 * - { mode: "reduce", topics: MappedTopic[] } — consolida chunks do MAP
 *
 * Persiste o resultado no Supabase e devolve { id, data }.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  try {
    const body = (await req.json()) as {
      mode?: "analyze" | "reduce";
      text?: string;
      topics?: MappedTopic[];
    };

    let data;
    if (body.mode === "analyze") {
      const text = body.text?.trim() ?? "";
      if (text.length < 50) {
        return NextResponse.json(
          { error: "Texto insuficiente para analisar." },
          { status: 400 },
        );
      }
      data = await analyzeDocument(text);
    } else if (body.mode === "reduce") {
      const topics = body.topics ?? [];
      if (topics.length === 0) {
        return NextResponse.json(
          { error: "Nenhum tópico para consolidar." },
          { status: 400 },
        );
      }
      data = await reduceMappedTopics(topics);
    } else {
      return NextResponse.json(
        { error: "mode deve ser 'analyze' ou 'reduce'." },
        { status: 400 },
      );
    }

    const id = randomUUID();
    await saveDocument(id, user.id, data);
    return NextResponse.json({ id, data });
  } catch (err) {
    console.error("Erro em /api/process-reduce:", err);
    return NextResponse.json(
      { error: "Falha ao consolidar o documento." },
      { status: 500 },
    );
  }
}
