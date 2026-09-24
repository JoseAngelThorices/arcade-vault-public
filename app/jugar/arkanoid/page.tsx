// Partida de Arkanoid. El juego se lee de Supabase en el servidor; el
// reproductor (HUD, canvas y modal de fin de partida) es cliente.

import { notFound } from "next/navigation";
import ArkanoidPlayer from "@/components/arkanoid-player";
import { getGame } from "@/lib/supabase/games";

export async function generateMetadata() {
  const game = await getGame("arkanoid");
  return { title: `Jugando a ${game?.title ?? "ARKANOID"} · Arcade Vault` };
}

export default async function ArkanoidPlayPage() {
  const game = await getGame("arkanoid");
  if (!game) notFound();

  return <ArkanoidPlayer game={game} />;
}
