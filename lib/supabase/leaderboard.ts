// Salón de la Fama: mejor marca de cada jugador (RPC `get_leaderboard`).
// Sin imports de servidor: lo usan la página (servidor) y el componente (cliente).

import type { SupabaseClient } from "@supabase/supabase-js";
import type { LeaderboardRpcRow, ScoreRow } from "@/lib/supabase/types";

export type LeaderboardPage = { rows: ScoreRow[]; total: number | null };

/** Pide una página del ranking por jugador; `total` es null si la página llega vacía. */
export async function fetchLeaderboard(
  supabase: SupabaseClient,
  gameId: string,
  offset: number,
  limit: number,
): Promise<LeaderboardPage> {
  const { data: raw, error } = await supabase.rpc("get_leaderboard", {
    p_game: gameId,
    p_offset: offset,
    p_limit: limit,
  });
  if (error) throw new Error(`No se pudo cargar el ranking de ${gameId}: ${error.message}`);
  // Los tipos de la base de datos se escriben a mano (types.ts): la RPC devuelve filas sin tipar.
  const data = (raw ?? []) as LeaderboardRpcRow[];

  return {
    // Misma forma que las filas con `profiles(username, avatar)`: PlayerLink no cambia.
    rows: data.map((r) => ({
      id: r.id,
      game_id: r.game_id,
      player_name: r.player_name,
      score: r.score,
      user_id: r.user_id,
      created_at: r.created_at,
      profiles: r.username && r.avatar ? { username: r.username, avatar: r.avatar } : null,
    })),
    total: data[0]?.total ?? null,
  };
}

/** Puesto que tendría `score` entre las mejores marcas de cada jugador. */
export async function fetchLeaderboardRank(
  supabase: SupabaseClient,
  gameId: string,
  score: number,
): Promise<number> {
  const { data, error } = await supabase.rpc("get_leaderboard_rank", { p_game: gameId, p_score: score });
  if (error) throw new Error(`No se pudo calcular el puesto en ${gameId}: ${error.message}`);
  return Number(data);
}
