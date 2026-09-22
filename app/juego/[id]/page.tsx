// Detalle de un juego (references/templates/detalle.jsx).
// Es Server Component: no hay estado, solo datos derivados del id de la ruta.

import Link from "next/link";
import { notFound } from "next/navigation";
import { GAMES, getGame, seededScores } from "@/lib/games";

/** Prerenderiza los 8 juegos: el catalogo es fijo. */
export function generateStaticParams() {
  return GAMES.map((game) => ({ id: game.id }));
}

export async function generateMetadata({ params }: PageProps<"/juego/[id]">) {
  const { id } = await params;
  const game = getGame(id);
  if (!game) return { title: "Juego no encontrado · Arcade Vault" };
  return { title: `${game.title} · Arcade Vault`, description: game.short };
}

export default async function GameDetailPage({ params }: PageProps<"/juego/[id]">) {
  const { id } = await params;
  const game = getGame(id);
  if (!game) notFound();

  const scores = seededScores(id.length * 17 + 3, 10);

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
              <div className="v">{game.plays}</div>
            </div>
            <div>
              <div className="l">Mejor global</div>
              <div className="v magenta">{game.best.toLocaleString("es-ES")}</div>
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
            <Link className="btn ghost lg" href="/">
              VOLVER AL VAULT
            </Link>
          </div>
        </div>
      </div>

      <aside>
        <div className="leaderboard">
          <h3>MEJORES PUNTUACIONES</h3>
          {scores.map((row, i) => (
            <div
              key={row.name}
              className={"lb-row" + (i < 3 ? ` top${i + 1}` : "")}
            >
              <div className="rk">#{String(row.rank).padStart(2, "0")}</div>
              <div className="pl">
                {row.name}
                <div className="date">{row.date}</div>
              </div>
              <div className="sc">{row.score.toLocaleString("es-ES")}</div>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
