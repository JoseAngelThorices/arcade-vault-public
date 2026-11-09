// ACTIVIDAD EN VIVO de la landing: últimas puntuaciones y top del día, leídas
// de Supabase en cada petición (la página ya es dinámica por las cookies).

import { createClient } from "@/lib/supabase/server";
import type { GameRow, ProfileRow, ScoreRow } from "@/lib/supabase/types";

export type RecentActivityRow = Pick<ScoreRow, "id" | "player_name" | "score" | "created_at"> & {
  games: Pick<GameRow, "title" | "color"> | null;
  profiles: Pick<ProfileRow, "username"> | null;
};

export type TopTodayRow = {
  user_id: string | null;
  player_name: string;
  username: string | null;
  total: number;
};

/** Las `limit` puntuaciones guardadas más recientes, de cualquier juego. */
export async function getRecentActivity(limit: number): Promise<RecentActivityRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("scores")
    .select("id, player_name, score, created_at, games(title, color), profiles(username)")
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<RecentActivityRow[]>();

  if (error) throw new Error(`No se pudo cargar la actividad reciente: ${error.message}`);
  return data;
}

/** Jugadores con más puntos sumados hoy (día de Europe/Madrid), RPC `get_top_players_today`. */
export async function getTopPlayersToday(limit: number): Promise<TopTodayRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_top_players_today", { p_limit: limit });

  if (error) throw new Error(`No se pudo cargar el top de hoy: ${error.message}`);
  // Los tipos de la base de datos se escriben a mano: la RPC devuelve filas sin tipar.
  return ((data ?? []) as TopTodayRow[]).map((r) => ({ ...r, total: Number(r.total) }));
}
