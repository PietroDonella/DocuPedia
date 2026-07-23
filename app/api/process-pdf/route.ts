import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { structureDocument } from "@/lib/structure";
import { saveDocument } from "@/lib/documents";
import { getCurrentUser } from "@/lib/auth";
import { titleFromPdfName } from "@/lib/pdf-title";
import type { ProcessStreamEvent } from "@/lib/types";

// A extração de PDF e o processamento por IA (map-reduce em PDFs grandes)
// podem levar tempo. Usamos o runtime Node.js (pdf-parse não roda em Edge) e
// pedimos um tempo máximo alto.
// OBS.: na Vercel, maxDuration efetivo depende do plano (Hobby limita a 60s;
// Pro permite até 300s). Localmente não há limite.
export const runtime = "nodejs";
export const maxDuration = 300;

// Limite defensivo de texto (caracteres). ~500k cobre com folga PDFs de
// 100+ páginas. Acima disso truncamos para conter custo/latência.
const MAX_CHARS = 500_000;

export async function POST(req: Request) {
  // ---- 0) Autenticação ----------------------------------------------------
  // O documento é vinculado ao usuário logado. Sem sessão, recusamos.
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "Você precisa estar autenticado para enviar um PDF." },
      { status: 401 },
    );
  }
  const userId = user.id;

  // ---- 1) Validação + extração de texto ----------------------------------
  // Erros aqui retornam JSON com o status apropriado (a resposta ainda não
  // virou stream). O streaming só começa quando temos texto válido.
  let text = "";
  let fileName = "";
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "Nenhum arquivo enviado no campo 'file'." },
        { status: 400 },
      );
    }
    if (file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "O arquivo precisa ser um PDF." },
        { status: 400 },
      );
    }
    fileName = file.name;

    // Import dinâmico evita que o Next tente resolver o pacote em build time.
    const pdfParse = (await import("pdf-parse")).default;
    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = await pdfParse(buffer);

    const rawText = parsed.text?.trim() ?? "";
    if (rawText.length < 50) {
      return NextResponse.json(
        {
          error:
            "Não foi possível extrair texto suficiente do PDF. Ele pode ser um PDF de imagens (escaneado) sem camada de texto.",
        },
        { status: 422 },
      );
    }
    text = rawText.slice(0, MAX_CHARS);
  } catch (err) {
    console.error("Erro ao ler o PDF:", err);
    return NextResponse.json(
      { error: "Não foi possível ler o arquivo PDF." },
      { status: 400 },
    );
  }

  // ---- 2) Streaming (NDJSON) do progresso + resultado final ---------------
  // Docs pequenos usam 1 chamada; PDFs grandes usam map-reduce (chunking),
  // preservando o texto ORIGINAL/LITERAL. Ver lib/structure.ts.
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: ProcessStreamEvent) => {
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      };

      try {
        const id = randomUUID();
        let data = await structureDocument(text, {
          onProgress: (progress) => send({ type: "progress", ...progress }),
        });

        const fromFile = titleFromPdfName(fileName);
        if (fromFile) data = { ...data, title: fromFile };

        // Persiste no Supabase vinculado ao usuário (best-effort). Se falhar,
        // o front-end ainda exibe via sessionStorage nesta sessão.
        await saveDocument(id, userId, data);

        send({ type: "done", id, data });
      } catch (err) {
        console.error("Erro ao estruturar o PDF:", err);
        send({ type: "error", error: "Erro ao processar o conteúdo do PDF." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      // Evita buffering em proxies (ex.: nginx) para o progresso fluir.
      "X-Accel-Buffering": "no",
    },
  });
}
