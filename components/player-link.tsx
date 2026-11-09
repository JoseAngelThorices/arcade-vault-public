// Alias de una fila de ranking (SPEC 15): con cuenta, mini avatar y enlace al
// perfil; sin perfil (filas antiguas o cuenta borrada), texto plano.

import Link from "next/link";
import PlayerAvatar from "@/components/player-avatar";
import type { ScoreRow } from "@/lib/supabase/types";

type Props = { row: Pick<ScoreRow, "player_name" | "profiles"> };

export default function PlayerLink({ row }: Props) {
  const profile = row.profiles;
  if (!profile) return <>{row.player_name}</>;

  return (
    <Link className="player-link" href={`/jugador/${profile.username}`}>
      <PlayerAvatar avatar={profile.avatar} name={profile.username} size="sm" />
      <span>{profile.username}</span>
    </Link>
  );
}
