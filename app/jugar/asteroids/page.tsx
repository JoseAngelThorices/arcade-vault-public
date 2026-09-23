// Partida de Asteroids. El juego se lee de Supabase en el servidor; el
// reproductor (HUD, canvas y modal de fin de partida) es cliente.

import { notFound } from "next/navigation";
import AsteroidsPlayer from "@/components/asteroids-player";
import { getGame } from "@/lib/supabase/games";

export async function generateMetadata() {
  const game = await getGame("asteroids");
  return { title: `Jugando a ${game?.title ?? "ASTEROIDS"} · Arcade Vault` };
}

export default async function AsteroidsPlayPage() {
  const game = await getGame("asteroids");
  if (!game) notFound();

  return <AsteroidsPlayer game={game} />;
}
