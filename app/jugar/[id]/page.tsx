import { notFound } from "next/navigation";
import GamePlayer from "@/components/player";
import { getGame } from "@/lib/supabase/games";

export async function generateMetadata({ params }: PageProps<"/jugar/[id]">) {
  const { id } = await params;
  const game = await getGame(id);
  if (!game) return { title: "Juego no encontrado · Arcade Vault" };
  return { title: `Jugando a ${game.title} · Arcade Vault` };
}

export default async function PlayPage({ params }: PageProps<"/jugar/[id]">) {
  const { id } = await params;
  const game = await getGame(id);
  if (!game) notFound();

  return <GamePlayer game={game} />;
}
