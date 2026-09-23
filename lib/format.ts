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
