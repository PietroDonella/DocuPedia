/**
 * Extração de texto de PDF no NAVEGADOR (pdf.js).
 *
 * Necessário porque a Vercel limita o body das Serverless Functions a ~4,5 MB.
 * PDFs grandes (ex.: 47 MB) nunca chegam à API — então extraímos o texto
 * localmente e enviamos apenas o texto (muito menor) para categorização.
 */

export async function extractPdfText(
  file: File,
  onProgress?: (current: number, total: number) => void,
): Promise<string> {
  const pdfjs = await import("pdfjs-dist");

  // Worker via CDN, alinhado à versão do pacote instalado.
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data }).promise;
  const parts: string[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const line = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (line) parts.push(line);
    onProgress?.(pageNum, pdf.numPages);
  }

  return parts.join("\n\n").trim();
}
