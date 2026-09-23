// Tipos manuales de las tablas `games` y `scores` de Supabase (SPEC 06).
// Si cambia el esquema en Supabase, actualizar aquí a mano.

export interface GameRow {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: "ARCADE" | "PUZZLE" | "SHOOTER";
  /** Clase CSS de la portada: "cover-rocas", … */
  cover: string;
  /** Variante de color del botón JUGAR. */
  color: "cyan" | "magenta" | "yellow" | "green";
  created_at: string;
}

export interface ScoreRow {
  id: string;
  game_id: string;
  player_name: string;
  score: number;
  /** Siempre null hasta el spec de Supabase Auth. */
  user_id: string | null;
  created_at: string;
}
