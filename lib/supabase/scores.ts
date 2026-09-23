// Lecturas de puntuaciones desde Server Components (SPEC 06).

import { createClient } from "@/lib/supabase/server";
import type { ScoreRow } from "@/lib/supabase/types";

/** Las `limit` mejores puntuaciones de un juego, de mayor a menor. */
export async function getTopScores(gameId: string, limit: number): Promise<ScoreRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("scores")
    .select("*")
    .eq("game_id", gameId)
    .order("score", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(limit)
    .returns<ScoreRow[]>();

  if (error) throw new Error(`No se pudieron cargar las puntuaciones de ${gameId}: ${error.message}`);
  return data;
}

/** Partidas guardadas de un juego: una fila de `scores` por partida. */
export async function countScores(gameId: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("scores")
    .select("*", { count: "exact", head: true })
    .eq("game_id", gameId);

  if (error) throw new Error(`No se pudieron contar las partidas de ${gameId}: ${error.message}`);
  return count ?? 0;
}
