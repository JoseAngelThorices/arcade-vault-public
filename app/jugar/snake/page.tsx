// Partida de Snake. El juego se lee de Supabase en el servidor; el
// reproductor (HUD, canvas y modal de fin de partida) es cliente.

import { notFound } from "next/navigation";
import SnakePlayer from "@/components/snake-player";
import { getGame } from "@/lib/supabase/games";

export async function generateMetadata() {
  const game = await getGame("snake");
  return { title: `Jugando a ${game?.title ?? "SNAKE"} · Arcade Vault` };
}

export default async function SnakePlayPage() {
  const game = await getGame("snake");
  if (!game) notFound();

  return <SnakePlayer game={game} />;
}
