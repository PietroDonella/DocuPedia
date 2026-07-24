/**
 * URL pública canônica do app (sem barra no final).
 * Preferir NEXT_PUBLIC_SITE_URL para e-mails do Supabase não apontarem
 * para deploys temporários da Vercel (que geram DEPLOYMENT_NOT_FOUND).
 */
export function getSiteUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;

  if (typeof window !== "undefined" && window.location?.origin) {
    const origin = window.location.origin;
    // Evita URLs de deployment efêmeras (*.vercel.app com hash do deploy).
    if (
      origin.includes(".vercel.app") &&
      !origin.includes("docupedia-alpha.vercel.app")
    ) {
      return "https://docupedia-alpha.vercel.app";
    }
    return origin;
  }

  return "https://docupedia-alpha.vercel.app";
}
