/**
 * Utilitários de chunking compartilhados entre cliente e servidor.
 * (Sem dependências de IA — seguro para importar no browser.)
 */

/** Docs até este tamanho (caracteres) usam 1 chamada só. */
export const SINGLE_PASS_LIMIT = 45_000;

/**
 * Tamanho de cada chunk no map-reduce.
 * Mantido moderado: a IA precisa devolver o texto verbatim no JSON;
 * chunks grandes (>10–12k) estouram o limite de saída do modelo (DP-MAP-OUTPUT).
 */
export const CHUNK_SIZE = 6_000;

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
