// Formatos de la interfaz compartidos por servidor y cliente.

const SCORE_DATE = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  // Zona fija: servidor y navegador formatean igual la misma fecha.
  timeZone: "Europe/Madrid",
});

/** `created_at` de Supabase → "DD/MM/AAAA". */
export const formatScoreDate = (iso: string) => SCORE_DATE.format(new Date(iso));

/** "hace 2 min", "hace 3 h", "hace 5 días" desde `iso` hasta `now` (ms). */
export function timeAgo(iso: string, now: number): string {
  const min = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
  if (min < 1) return "ahora mismo";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? "hace 1 día" : `hace ${d} días`;
}
