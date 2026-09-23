// Los juegos y las puntuaciones viven en Supabase (SPEC 06): ver
// `lib/supabase/types.ts`. Aquí solo quedan constantes de la interfaz.

export const CATS = [
  "TODOS",
  "ARCADE",
  "PUZZLE",
  "SHOOTER",
  "VERSUS",
] as const satisfies readonly string[];
