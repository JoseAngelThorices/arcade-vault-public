import type { Metadata } from "next";
import HallOfFame from "@/components/hall-of-fame";
import { getGames } from "@/lib/supabase/games";
import { fetchLeaderboard, type LeaderboardPage } from "@/lib/supabase/leaderboard";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Salón de la Fama · Arcade Vault",
  description: "Las mejores puntuaciones de cada juego del Vault.",
};

/** Jugadores por página: la primera llega del servidor y el scroll de la tabla pide las siguientes. */
const PAGE_SIZE = 25;

export default async function HallPage() {
  const games = await getGames();
  // La primera pagina de la primera pestaña llega renderizada desde el
  // servidor; el resto de paginas y pestañas las pide el cliente.
  const first: LeaderboardPage =
    games.length > 0
      ? await fetchLeaderboard(await createClient(), games[0].id, 0, PAGE_SIZE)
      : { rows: [], total: 0 };

  return (
    <HallOfFame
      games={games}
      initialScores={first.rows}
      initialTotal={first.total ?? 0}
      pageSize={PAGE_SIZE}
    />
  );
}
