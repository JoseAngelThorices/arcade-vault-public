// Partida de Frogger. El juego se lee de Supabase en el servidor; el
// reproductor (HUD, canvas y modal de fin de partida) es cliente.

import { notFound } from "next/navigation";
import FroggerPlayer from "@/components/frogger-player";
import { getGame } from "@/lib/supabase/games";

export async function generateMetadata() {
  const game = await getGame("frogger");
  return { title: `Jugando a ${game?.title ?? "FROGGER"} · Arcade Vault` };
}

export default async function FroggerPlayPage() {
  const game = await getGame("frogger");
  if (!game) notFound();

  return <FroggerPlayer game={game} />;
}
