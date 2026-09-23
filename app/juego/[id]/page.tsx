// Detalle de un juego (references/templates/detalle.jsx).
// Es Server Component: juego y top 10 salen de Supabase en cada peticion.

import Link from "next/link";
import { notFound } from "next/navigation";
import LeaderboardEmpty from "@/components/leaderboard-empty";
import { formatScoreDate } from "@/lib/format";
import { getGame } from "@/lib/supabase/games";
import { countScores, getTopScores } from "@/lib/supabase/scores";

export async function generateMetadata({ params }: PageProps<"/juego/[id]">) {
  const { id } = await params;
  const game = await getGame(id);
  if (!game) return { title: "Juego no encontrado · Arcade Vault" };
  return { title: `${game.title} · Arcade Vault`, description: game.short };
}

export default async function GameDetailPage({ params }: PageProps<"/juego/[id]">) {
  const { id } = await params;
  const game = await getGame(id);
  if (!game) notFound();

  const [scores, plays] = await Promise.all([getTopScores(id, 10), countScores(id)]);
  // Los scores llegan ordenados de mayor a menor: el primero es el récord.
  const best = scores[0]?.score ?? 0;

  return (
    <div className="av-detail fade-in">
      <div>
        <div className="detail-cover">
          <div className={"cover-bg " + game.cover} aria-hidden="true" />
        </div>

        <div className="detail-info">
          <div className="detail-tags">
            <span>{game.cat}</span>
            <span>1 JUGADOR</span>
            <span>TECLADO / TÁCTIL</span>
            <span>RETRO 1985</span>
          </div>
          <h2 className="neon-cyan">{game.title}</h2>
          <p>{game.long}</p>

          <div className="stat-strip">
            <div>
              <div className="l">Partidas</div>
              <div className="v">{plays.toLocaleString("es-ES")}</div>
            </div>
            <div>
              <div className="l">Mejor global</div>
              <div className="v magenta">{best.toLocaleString("es-ES")}</div>
            </div>
            <div>
              <div className="l">Dificultad</div>
              <div className="v yellow">★ ★ ★ ☆ ☆</div>
            </div>
          </div>

          <div className="detail-actions">
            <Link className="btn xl pulse" href={`/jugar/${game.id}`}>
              ▶ JUGAR AHORA
            </Link>
            <Link className="btn ghost lg" href="/juegos">
              VOLVER AL VAULT
            </Link>
          </div>
        </div>
      </div>

      <aside>
        <div className="leaderboard">
          <h3>MEJORES PUNTUACIONES</h3>
          {scores.length === 0 && <LeaderboardEmpty gameId={game.id} />}
          {scores.map((row, i) => (
            <div
              key={row.id}
              className={"lb-row" + (i < 3 ? ` top${i + 1}` : "")}
            >
              <div className="rk">#{String(i + 1).padStart(2, "0")}</div>
              <div className="pl">
                {row.player_name}
                <div className="date">{formatScoreDate(row.created_at)}</div>
              </div>
              <div className="sc">{row.score.toLocaleString("es-ES")}</div>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
