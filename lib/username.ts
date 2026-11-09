// Regla del alias (SPEC 15). La misma regla está en el CHECK
// `profiles_username_format` de Supabase y en las funciones RPC.

export const USERNAME_RE = /^[A-Z0-9_]{3,10}$/;

export const USERNAME_HINT = "De 3 a 10 caracteres: letras A-Z, números y _.";

/** Mayúsculas y sin espacios en los extremos: así se guarda en `profiles`. */
export function normalizeUsername(raw: string): string {
  return raw.trim().toUpperCase();
}

export function isValidUsername(raw: string): boolean {
  return USERNAME_RE.test(normalizeUsername(raw));
}

/** Igual que `sanitize_username` en Supabase: espacios a "_", fuera el resto, corte a 10. */
export function sanitizeUsername(raw: string): string {
  return normalizeUsername(raw)
    .replace(/ /g, "_")
    .replace(/[^A-Z0-9_]/g, "")
    .slice(0, 10);
}
