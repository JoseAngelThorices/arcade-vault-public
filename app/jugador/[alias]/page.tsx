// Perfil público de un jugador (SPEC 15). Server Component: perfil, marcas por
// juego y últimas partidas salen de Supabase en cada petición, sin JavaScript.

import Link from "next/link";
import { notFound } from "next/navigation";
import PlayerAvatar from "@/components/player-avatar";
import { formatScoreDate } from "@/lib/format";
import { getGames } from "@/lib/supabase/games";
import { getPlayerStats, getProfileByUsername, getRecentScores } from "@/lib/supabase/profiles";

const RECENT = 10;

export async function generateMetadata({ params }: PageProps<"/jugador/[alias]">) {
  const { alias } = await params;
  const profile = await getProfileByUsername(decodeURIComponent(alias));
  if (!profile) return { title: "Jugador no encontrado · Arcade Vault" };
  return {
    title: `${profile.username} · Arcade Vault`,
    description: `Marcas y últimas partidas de ${profile.username} en Arcade Vault.`,
  };
}

export default async function PlayerPage({ params }: PageProps<"/jugador/[alias]">) {
  const { alias } = await params;
  const profile = await getProfileByUsername(decodeURIComponent(alias));
  if (!profile) notFound();

  const [stats, recent, games] = await Promise.all([
    getPlayerStats(profile.id),
    getRecentScores(profile.id, RECENT),
    getGames(),
  ]);
  const titles = new Map(games.map((g) => [g.id, g.title]));
  const plays = stats.reduce((sum, s) => sum + s.plays, 0);
  // Se muestran en el orden de la biblioteca, no en el alfabético de la RPC.
  const order = new Map(games.map((g, i) => [g.id, i]));
  const sorted = [...stats].sort((a, b) => (order.get(a.game_id) ?? 99) - (order.get(b.game_id) ?? 99));

  return (
    <div className="av-profile fade-in">
      <section className="profile-head">
        <PlayerAvatar avatar={profile.avatar} name={profile.username} size="xl" />
        <div className="profile-id">
          <div className="profile-label">FICHA DE JUGADOR</div>
          <h1 className="neon-cyan">{profile.username}</h1>
          <div className="stat-strip">
            <div>
              <div className="l">Miembro desde</div>
              <div className="v">{formatScoreDate(profile.created_at)}</div>
            </div>
            <div>
              <div className="l">Partidas</div>
              <div className="v magenta">{plays.toLocaleString("es-ES")}</div>
            </div>
            <div>
              <div className="l">Juegos</div>
              <div className="v yellow">{stats.length.toLocaleString("es-ES")}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="profile-section" aria-labelledby="profile-best">
        <h2 id="profile-best">MEJORES MARCAS</h2>
        {sorted.length === 0 ? (
          <div className="profile-empty">
            <p>Todavía no ha guardado ninguna partida.</p>
            <Link className="btn lg" href="/juegos">
              IR A LA BIBLIOTECA
            </Link>
          </div>
        ) : (
          <div className="profile-games">
            {sorted.map((s) => (
              <Link key={s.game_id} className="profile-game" href={`/juego/${s.game_id}`}>
                <div className="pg-title">{titles.get(s.game_id) ?? s.game_id}</div>
                <div className={"pg-rank" + (s.rank <= 3 ? ` top${s.rank}` : "")}>
                  #{String(s.rank).padStart(2, "0")}
                </div>
                <div className="pg-best">{s.best.toLocaleString("es-ES")}</div>
                <div className="pg-plays">
                  {s.plays.toLocaleString("es-ES")} {s.plays === 1 ? "partida" : "partidas"}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {recent.length > 0 && (
        <section className="profile-section" aria-labelledby="profile-recent">
          <h2 id="profile-recent">ÚLTIMAS PARTIDAS</h2>
          <div className="leaderboard">
            {recent.map((row) => (
              <div key={row.id} className="lb-row">
                <div className="rk">▸</div>
                <div className="pl">
                  <Link href={`/juego/${row.game_id}`}>{row.games?.title ?? row.game_id}</Link>
                  <div className="date">{formatScoreDate(row.created_at)}</div>
                </div>
                <div className="sc">{row.score.toLocaleString("es-ES")}</div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
