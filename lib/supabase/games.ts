// Lecturas de juegos desde Server Components (SPEC 06).

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { GameRow } from "@/lib/supabase/types";

/** Juego con su mejor puntuación, calculada desde `scores` (0 si no hay). */
export type GameWithBest = GameRow & { best: number };

/** Todos los juegos, en orden de alta. */
export async function getGames(): Promise<GameRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("games")
    .select("*")
    .order("created_at", { ascending: true })
    .returns<GameRow[]>();

  if (error) throw new Error(`No se pudieron cargar los juegos: ${error.message}`);
  return data;
}

/**
 * Un juego por id, o `null` si no existe. Con `cache`, `generateMetadata` y la
 * página comparten la misma consulta dentro de una petición.
 */
export const getGame = cache(async (id: string): Promise<GameRow | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("games")
    .select("*")
    .eq("id", id)
    .maybeSingle<GameRow>();

  if (error) throw new Error(`No se pudo cargar el juego ${id}: ${error.message}`);
  return data;
});

/**
 * Todos los juegos con su `best`. PostgREST no expone agregados por defecto,
 * así que se pide el score más alto de cada juego en paralelo: una consulta
 * por juego, que el índice (game_id, score desc) resuelve sin recorrer la tabla.
 */
export async function getGamesWithBest(): Promise<GameWithBest[]> {
  const games = await getGames();
  const supabase = await createClient();

  return Promise.all(
    games.map(async (game) => {
      const { data, error } = await supabase
        .from("scores")
        .select("score")
        .eq("game_id", game.id)
        .order("score", { ascending: false })
        .limit(1)
        .maybeSingle<{ score: number }>();

      if (error) throw new Error(`No se pudo cargar el récord de ${game.id}: ${error.message}`);
      return { ...game, best: data?.score ?? 0 };
    }),
  );
}
