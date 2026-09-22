"use client";

// Salon de la Fama (references/templates/salon.jsx). Las puntuaciones son
// simuladas y deterministas: la misma pestaña siempre da la misma tabla.

import Link from "next/link";
import { useMemo, useState } from "react";
import { GAMES, getGame, seededScores } from "@/lib/games";
import { useSession } from "@/lib/session";

/** Las fechas de la tabla van en DD/MM/AAAA, como las simuladas. */
function formatDate(at: number) {
  const d = new Date(at);
  return [
    String(d.getDate()).padStart(2, "0"),
    String(d.getMonth() + 1).padStart(2, "0"),
    d.getFullYear(),
  ].join("/");
}

export default function HallOfFame() {
  const [tab, setTab] = useState(GAMES[0].id);
  const rows = useMemo(() => seededScores(tab.length * 23 + 7, 12), [tab]);
  const { user, ready, bestScoreFor } = useSession();

  const [champion, runnerUp, third] = rows;

  // Solo hay fila propia si esta sesion guardo alguna puntuacion en este juego.
  const best = ready && user ? bestScoreFor(tab) : null;
  const yourRank = best ? rows.filter((r) => r.score > best.score).length + 1 : 0;
  const tabTitle = getGame(tab)?.title ?? "";

  return (
    <div className="av-hall fade-in">
      <div className="hall-head">
        <h1>SALÓN DE LA FAMA</h1>
        <p className="pixel">LOS NOMBRES QUE NUNCA SE BORRAN DE LA PANTALLA</p>
      </div>

      <div className="hall-tabs">
        {GAMES.map((game) => (
          <button
            key={game.id}
            className={"chip" + (tab === game.id ? " active" : "")}
            onClick={() => setTab(game.id)}
            aria-pressed={tab === game.id}
          >
            {game.title}
          </button>
        ))}
      </div>

      <div className="podium">
        <div className="podium-slot silver">
          <div className="rank-num">02</div>
          <div className="name">{runnerUp.name}</div>
          <div className="score">{runnerUp.score.toLocaleString("es-ES")}</div>
          <div className="date">{runnerUp.date}</div>
        </div>
        <div className="podium-slot gold">
          <div className="crown">CAMPEÓN</div>
          <div className="rank-num">01</div>
          <div className="name">{champion.name}</div>
          <div className="score">{champion.score.toLocaleString("es-ES")}</div>
          <div className="date">{champion.date}</div>
        </div>
        <div className="podium-slot bronze">
          <div className="rank-num">03</div>
          <div className="name">{third.name}</div>
          <div className="score">{third.score.toLocaleString("es-ES")}</div>
          <div className="date">{third.date}</div>
        </div>
      </div>

      <div className="hall-table">
        <div className="th">
          <div>RANGO</div>
          <div>JUGADOR</div>
          <div>PUNTUACIÓN</div>
          <div>FECHA</div>
        </div>
        {rows.map((row, i) => (
          <div
            key={row.name + i}
            className={"tr" + (i < 3 ? ` top${i + 1}` : "")}
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <div className="rk">#{String(row.rank).padStart(2, "0")}</div>
            <div className="pl">{row.name}</div>
            <div className="sc">{row.score.toLocaleString("es-ES")}</div>
            <div className="dt">{row.date}</div>
          </div>
        ))}

        {best && (
          <>
            <div className="tr you-label">▸ TU MEJOR MARCA EN {tabTitle}</div>
            <div className="tr you" style={{ animationDelay: `${rows.length * 50 + 50}ms` }}>
              <div className="rk">#{String(yourRank).padStart(2, "0")}</div>
              <div className="pl">{best.name}</div>
              <div className="sc">{best.score.toLocaleString("es-ES")}</div>
              <div className="dt">{formatDate(best.at)}</div>
            </div>
          </>
        )}
      </div>

      <div className="hall-back">
        <Link className="btn lg" href="/juegos">
          VOLVER A LA BIBLIOTECA
        </Link>
      </div>
    </div>
  );
}
