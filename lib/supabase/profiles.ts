// Lecturas del perfil de jugador desde Server Components (SPEC 15).

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { PlayerStatRow, ProfileRow, RecentScoreRow } from "@/lib/supabase/types";
import { normalizeUsername } from "@/lib/username";

/**
 * Perfil por alias (sin distinguir mayúsculas), o `null` si no existe. Con
 * `cache`, `generateMetadata` y la página comparten la consulta.
 */
export const getProfileByUsername = cache(async (alias: string): Promise<ProfileRow | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", normalizeUsername(alias))
    .maybeSingle<ProfileRow>();

  if (error) throw new Error(`No se pudo cargar el perfil ${alias}: ${error.message}`);
  return data;
});

/** Por juego jugado: mejor marca, su puesto en el ranking y partidas (RPC `get_player_stats`). */
export async function getPlayerStats(userId: string): Promise<PlayerStatRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_player_stats", { p_user: userId });

  if (error) throw new Error(`No se pudieron cargar las estadísticas: ${error.message}`);
  // Cliente sin tipos generados: la forma de la fila es la de la RPC.
  return (data ?? []) as PlayerStatRow[];
}

/** Las `limit` partidas más recientes del jugador, con el título del juego. */
export async function getRecentScores(userId: string, limit: number): Promise<RecentScoreRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("scores")
    .select("id, game_id, score, created_at, games(title)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<RecentScoreRow[]>();

  if (error) throw new Error(`No se pudieron cargar las últimas partidas: ${error.message}`);
  return data;
}
