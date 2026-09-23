"use client";

// Salon de la Fama (references/templates/salon.jsx). La primera pestaña llega
// del servidor; al cambiar de pestaña se piden a Supabase las mejores
// puntuaciones de ese juego desde el navegador (SPEC 06).

import Link from "next/link";
import { useRef, useState } from "react";
import LeaderboardEmpty from "@/components/leaderboard-empty";
import { formatScoreDate } from "@/lib/format";
import { useSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/client";
import type { GameRow, ScoreRow } from "@/lib/supabase/types";

type Props = { games: GameRow[]; initialScores: ScoreRow[]; limit: number };
type Status = "idle" | "loading" | "error";

/** Las fechas de la tabla van en DD/MM/AAAA. */
function formatDate(at: number) {
  const d = new Date(at);
  return [
    String(d.getDate()).padStart(2, "0"),
    String(d.getMonth() + 1).padStart(2, "0"),
    d.getFullYear(),
  ].join("/");
}

/** Un puesto del podio; sin puntuación queda libre. */
function PodiumSlot({ row, rank }: { row: ScoreRow | undefined; rank: 1 | 2 | 3 }) {
  const medal = rank === 1 ? "gold" : rank === 2 ? "silver" : "bronze";
  return (
    <div className={"podium-slot " + medal}>
      {rank === 1 && <div className="crown">CAMPEÓN</div>}
      <div className="rank-num">{String(rank).padStart(2, "0")}</div>
      <div className="name">{row?.player_name ?? "???"}</div>
      <div className="score">{row ? row.score.toLocaleString("es-ES") : "—"}</div>
      <div className="date">{row ? formatScoreDate(row.created_at) : "PUESTO LIBRE"}</div>
    </div>
  );
}

export default function HallOfFame({ games, initialScores, limit }: Props) {
  const [tab, setTab] = useState(games[0]?.id ?? "");
  const [rows, setRows] = useState(initialScores);
  const [status, setStatus] = useState<Status>("idle");
  // Solo cuenta la respuesta de la ultima pestaña pedida: si el usuario cambia
  // rapido, las respuestas que llegan tarde se descartan.
  const requestId = useRef(0);
  const { user, ready, bestScoreFor } = useSession();

  const load = async (gameId: string) => {
    const id = ++requestId.current;
    setStatus("loading");

    const { data, error } = await createClient()
      .from("scores")
      .select("*")
      .eq("game_id", gameId)
      .order("score", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(limit)
      .returns<ScoreRow[]>();

    if (id !== requestId.current) return;
    if (error) {
      setStatus("error");
      return;
    }
    setRows(data);
    setStatus("idle");
  };

  const selectTab = (gameId: string) => {
    if (gameId === tab && status !== "error") return;
    setTab(gameId);
    void load(gameId);
  };

  const [champion, runnerUp, third] = rows;

  // Solo hay fila propia si esta sesion guardo alguna puntuacion en este juego.
  const best = ready && user ? bestScoreFor(tab) : null;
  const yourRank = best ? rows.filter((r) => r.score > best.score).length + 1 : 0;
  const tabTitle = games.find((g) => g.id === tab)?.title ?? "";
  const loading = status === "loading";

  return (
    <div className="av-hall fade-in">
      <div className="hall-head">
        <h1>SALÓN DE LA FAMA</h1>
        <p className="pixel">LOS NOMBRES QUE NUNCA SE BORRAN DE LA PANTALLA</p>
      </div>

      {games.length === 0 ? (
        <div className="hall-table">
          <div className="lb-empty">
            <p>Todavía no hay juegos en el Vault.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="hall-tabs">
            {games.map((game) => (
              <button
                key={game.id}
                className={"chip" + (tab === game.id ? " active" : "")}
                onClick={() => selectTab(game.id)}
                aria-pressed={tab === game.id}
              >
                {game.title}
              </button>
            ))}
          </div>

          {status === "error" ? (
            <div className="hall-table">
              <div className="lb-empty">
                <p>No se pudieron cargar las puntuaciones de {tabTitle}.</p>
                <button className="btn" onClick={() => void load(tab)}>
                  REINTENTAR
                </button>
              </div>
            </div>
          ) : (
            <div className={"hall-board" + (loading ? " is-loading" : "")} aria-busy={loading}>
              {rows.length > 0 && (
                <div className="podium">
                  <PodiumSlot row={runnerUp} rank={2} />
                  <PodiumSlot row={champion} rank={1} />
                  <PodiumSlot row={third} rank={3} />
                </div>
              )}

              <div className="hall-table">
                {rows.length === 0 ? (
                  <LeaderboardEmpty gameId={tab} />
                ) : (
                  <>
                    <div className="th">
                      <div>RANGO</div>
                      <div>JUGADOR</div>
                      <div>PUNTUACIÓN</div>
                      <div>FECHA</div>
                    </div>
                    {rows.map((row, i) => (
                      <div
                        key={row.id}
                        className={"tr" + (i < 3 ? ` top${i + 1}` : "")}
                        style={{ animationDelay: `${i * 50}ms` }}
                      >
                        <div className="rk">#{String(i + 1).padStart(2, "0")}</div>
                        <div className="pl">{row.player_name}</div>
                        <div className="sc">{row.score.toLocaleString("es-ES")}</div>
                        <div className="dt">{formatScoreDate(row.created_at)}</div>
                      </div>
                    ))}
                  </>
                )}

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
            </div>
          )}
        </>
      )}

      <div className="hall-back">
        <Link className="btn lg" href="/juegos">
          VOLVER A LA BIBLIOTECA
        </Link>
      </div>
    </div>
  );
}
