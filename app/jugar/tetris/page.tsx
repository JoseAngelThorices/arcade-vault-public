// Partida de Tetris. El juego se lee de Supabase en el servidor; el
// reproductor (HUD, canvas y modal de fin de partida) es cliente.

import { notFound } from "next/navigation";
import TetrisPlayer from "@/components/tetris-player";
import { getGame } from "@/lib/supabase/games";

export async function generateMetadata() {
  const game = await getGame("tetris");
  return { title: `Jugando a ${game?.title ?? "TETRIS"} · Arcade Vault` };
}

export default async function TetrisPlayPage() {
  const game = await getGame("tetris");
  if (!game) notFound();

  return <TetrisPlayer game={game} />;
}
