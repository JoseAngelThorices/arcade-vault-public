// Tipos manuales de las tablas `games` y `scores` de Supabase (SPEC 06).
// Si cambia el esquema en Supabase, actualizar aquí a mano.

import type { AvatarId } from "@/lib/avatars";

export interface GameRow {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: "ARCADE" | "PUZZLE" | "SHOOTER" | "MAZE";
  /** Clase CSS de la portada: "cover-rocas", … */
  cover: string;
  /** Variante de color del botón JUGAR. */
  color: "cyan" | "magenta" | "yellow" | "green";
  /** Tope de puntuación que acepta `submit_score` (SEC-01). */
  max_score: number;
  /** Puntos por segundo máximos desde `start_run` que acepta `submit_score`. */
  max_points_per_sec: number;
  created_at: string;
}

/** Perfil público de una cuenta (SPEC 15). Solo lo escriben triggers y RPC. */
export interface ProfileRow {
  /** = `auth.users.id`. */
  id: string;
  /** Alias único: `^[A-Z0-9_]{3,10}$`. */
  username: string;
  avatar: AvatarId;
  created_at: string;
}

export interface ScoreRow {
  id: string;
  game_id: string;
  player_name: string;
  score: number;
  /** FK a `auth.users` si la partida se guardó con sesión; null para invitados (SPEC 13). */
  user_id: string | null;
  created_at: string;
  /**
   * Perfil del autor, pedido con `select("*, profiles(username, avatar)")`
   * (SPEC 15). Solo en las lecturas de rankings; null en filas sin cuenta.
   */
  profiles?: Pick<ProfileRow, "username" | "avatar"> | null;
}

/** Fila de la RPC `get_player_stats` (SPEC 15). */
export interface PlayerStatRow {
  game_id: string;
  best: number;
  /** Puesto de su mejor fila: una fila por partida, como los rankings. */
  rank: number;
  plays: number;
}

/** Partida reciente del perfil, con el título del juego embebido. */
export type RecentScoreRow = Pick<ScoreRow, "id" | "game_id" | "score" | "created_at"> & {
  games: Pick<GameRow, "title"> | null;
};

/**
 * Fila de la RPC `get_leaderboard` (Salón de la Fama): la mejor marca de cada
 * jugador, con su perfil aplanado y `total` = jugadores distintos del juego.
 */
export interface LeaderboardRpcRow extends Omit<ScoreRow, "profiles"> {
  username: string | null;
  avatar: ProfileRow["avatar"] | null;
  total: number;
}
