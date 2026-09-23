import type { Metadata } from "next";
import HallOfFame from "@/components/hall-of-fame";
import { getGames } from "@/lib/supabase/games";
import { getTopScores } from "@/lib/supabase/scores";

export const metadata: Metadata = {
  title: "Salón de la Fama · Arcade Vault",
  description: "Las mejores puntuaciones de cada juego del Vault.",
};

/** Filas de cada pestaña: podio + tabla. */
const HALL_SIZE = 12;

export default async function HallPage() {
  const games = await getGames();
  // La primera pestaña llega renderizada desde el servidor; el resto las pide
  // el cliente al cambiar de pestaña.
  const initialScores = games.length > 0 ? await getTopScores(games[0].id, HALL_SIZE) : [];

  return <HallOfFame games={games} initialScores={initialScores} limit={HALL_SIZE} />;
}
