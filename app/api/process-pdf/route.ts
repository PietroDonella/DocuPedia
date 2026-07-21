import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { encyclopediaSchema } from "@/lib/schema";
import type { ProcessPdfResponse } from "@/lib/types";

// A extração de PDF e a chamada à IA podem levar tempo: usamos o runtime
// Node.js (pdf-parse não roda em Edge) e ampliamos o tempo máximo.
export const runtime = "nodejs";
export const maxDuration = 60;

// Limite defensivo de texto enviado à IA. Livros muito grandes podem
// estourar o contexto do modelo — aqui truncamos para manter o custo e a
// latência sob controle. Ajuste conforme sua necessidade / plano.
const MAX_CHARS = 120_000;

export async function POST(req: Request) {
  try {
    // 1) Recebe o arquivo enviado via multipart/form-data.
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

    // 2) EXTRAÇÃO DE TEXTO com pdf-parse.
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

    const text = rawText.slice(0, MAX_CHARS);

    // 3) CATEGORIZAÇÃO ESTRUTURADA com o Vercel AI SDK + Gemini.
    // O `schema` (Zod) força a IA a devolver exatamente o formato esperado.
    const { object } = await generateObject({
      model: google("gemini-2.5-flash"),
      schema: encyclopediaSchema,
      system:
        "Você é um editor especialista em organizar conhecimento SEM perder " +
        "conteúdo. Sua tarefa é reestruturar o texto bruto de um documento em " +
        "uma enciclopédia navegável: identifique um título geral, agrupe o " +
        "conteúdo em categorias temáticas coerentes e, dentro de cada " +
        "categoria, crie tópicos. REGRA MAIS IMPORTANTE: preserve a essência " +
        "e os detalhes ORIGINAIS do documento. NÃO faça resumos curtos — o " +
        "campo de conteúdo de cada tópico deve manter exemplos, listas, " +
        "passos, quantidades, números, definições e a terminologia original. " +
        "Você está reorganizando e categorizando o texto, não condensando-o. " +
        "É melhor pecar por conteúdo demais do que de menos. " +
        "Responda sempre no mesmo idioma predominante do documento.",
      prompt:
        "Reorganize o texto a seguir, extraído de um documento PDF, na " +
        "estrutura solicitada, mantendo o conteúdo original o mais completo " +
        "possível dentro de cada tópico.\n\n---INÍCIO DO DOCUMENTO---\n" +
        text +
        "\n---FIM DO DOCUMENTO---",
    });

    // 4) RESPOSTA.
    // Geramos um id único e devolvemos o objeto completo. A persistência é
    // feita no cliente (sessionStorage) — nenhum banco de dados é usado.
    const response: ProcessPdfResponse = {
      id: randomUUID(),
      data: object,
    };
    return NextResponse.json(response, { status: 200 });
  } catch (err) {
    console.error("Erro no processamento do PDF:", err);
    return NextResponse.json(
      { error: "Erro interno ao processar o PDF." },
      { status: 500 },
    );
  }
}
