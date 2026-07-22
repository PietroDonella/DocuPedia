/**
 * Utilitários de chunking compartilhados entre cliente e servidor.
 * (Sem dependências de IA — seguro para importar no browser.)
 */

/** Docs até este tamanho (caracteres) usam 1 chamada só. */
export const SINGLE_PASS_LIMIT = 45_000;

/** Tamanho de cada chunk no modo map-reduce. */
export const CHUNK_SIZE = 18_000;

/** Divide o texto em chunks <= size, respeitando limites de parágrafo. */
export function chunkText(text: string, size: number): string[] {
  const paragraphs = text.split(/\n\s*\n/);
  const chunks: string[] = [];
  let current = "";

  const flush = () => {
    if (current.trim()) chunks.push(current);
    current = "";
  };

  for (const paragraph of paragraphs) {
    if (paragraph.length > size) {
      flush();
      for (let i = 0; i < paragraph.length; i += size) {
        chunks.push(paragraph.slice(i, i + size));
      }
      continue;
    }
    if (current.length + paragraph.length + 2 > size && current.length > 0) {
      flush();
    }
    current += (current ? "\n\n" : "") + paragraph;
  }
  flush();

  return chunks;
}
