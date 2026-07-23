/**
 * Título exibido no site a partir do nome do arquivo PDF enviado.
 */
export function titleFromPdfName(fileName?: string | null): string | null {
  if (!fileName?.trim()) return null;
  const base = fileName.trim().replace(/\.pdf$/i, "").trim();
  return base.length > 0 ? base : null;
}
