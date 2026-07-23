import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { saveDocument } from "@/lib/documents";
import { analyzeDocument, reduceMappedTopics } from "@/lib/structure";
import type { MappedTopic } from "@/lib/types";
import { ErrorCode, classifyStageError, formatError } from "@/lib/errors";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/process-reduce
 * - { mode: "analyze", text }
 * - { mode: "reduce", topics: MappedTopic[] }
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

  let stage: "analyze" | "reduce" = "reduce";

  try {
    const body = (await req.json()) as {
      mode?: "analyze" | "reduce";
      text?: string;
      topics?: MappedTopic[];
    };

    let data;
    if (body.mode === "analyze") {
      stage = "analyze";
      const text = body.text?.trim() ?? "";
      if (text.length < 50) {
        return NextResponse.json(
          {
            error: formatError(
              "Texto insuficiente para analisar.",
              ErrorCode.BAD_REQUEST,
            ),
            code: ErrorCode.BAD_REQUEST,
          },
          { status: 400 },
        );
      }
      data = await analyzeDocument(text);
    } else if (body.mode === "reduce") {
      stage = "reduce";
      const topics = body.topics ?? [];
      if (topics.length === 0) {
        return NextResponse.json(
          {
            error: formatError(
              "Nenhum tópico para consolidar.",
              ErrorCode.BAD_REQUEST,
            ),
            code: ErrorCode.BAD_REQUEST,
          },
          { status: 400 },
        );
      }
      data = await reduceMappedTopics(topics);
    } else {
      return NextResponse.json(
        {
          error: formatError(
            "mode deve ser 'analyze' ou 'reduce'.",
            ErrorCode.BAD_REQUEST,
          ),
          code: ErrorCode.BAD_REQUEST,
        },
        { status: 400 },
      );
    }

    const id = randomUUID();
    await saveDocument(id, user.id, data);
    return NextResponse.json({ id, data });
  } catch (err) {
    const code = classifyStageError(err, stage);
    const detail = err instanceof Error ? err.message : "erro desconhecido";
    console.error("Erro em /api/process-reduce:", code, detail);
    return NextResponse.json(
      {
        error: formatError("Falha ao consolidar o documento.", code),
        code,
        detail,
      },
      { status: 500 },
    );
  }
}
