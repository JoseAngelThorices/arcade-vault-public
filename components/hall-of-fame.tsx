"use client";

// Salon de la Fama (references/templates/salon.jsx). La primera pagina de la
// primera pestaña llega del servidor; al cambiar de pestaña se piden a Supabase
// las mejores puntuaciones de ese juego desde el navegador (SPEC 06).
//
// Una fila por jugador con su mejor marca (RPC `get_leaderboard`), no una por
// partida. La tabla muestra a todos los jugadores dentro de un contenedor con
// scroll propio (unas 10 filas a la vista): se cargan por paginas de
// `pageSize` al acercarse a su final (IntersectionObserver con ese contenedor
// como raiz), y el boton CARGAR MAS hace lo mismo si el observador no salta.

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import LeaderboardEmpty from "@/components/leaderboard-empty";
import PlayerLink from "@/components/player-link";
import { formatScoreDate } from "@/lib/format";
import { useSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/client";
import { fetchLeaderboard, fetchLeaderboardRank } from "@/lib/supabase/leaderboard";
import type { GameRow, ScoreRow } from "@/lib/supabase/types";

type Props = {
  games: GameRow[];
  initialScores: ScoreRow[];
  initialTotal: number;
  pageSize: number;
};
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
      <div className="name">{row ? <PlayerLink row={row} /> : "???"}</div>
      <div className="score">{row ? row.score.toLocaleString("es-ES") : "—"}</div>
      <div className="date">{row ? formatScoreDate(row.created_at) : "PUESTO LIBRE"}</div>
    </div>
  );
}

export default function HallOfFame({ games, initialScores, initialTotal, pageSize }: Props) {
  const [tab, setTab] = useState(games[0]?.id ?? "");
  const [rows, setRows] = useState(initialScores);
  const [total, setTotal] = useState(initialTotal);
  const [status, setStatus] = useState<Status>("idle");
  const [more, setMore] = useState<Status>("idle");
  // Puesto de "tu mejor marca" cuando no sale de las filas cargadas.
  const [remoteRank, setRemoteRank] = useState<{ key: string; rank: number } | null>(null);
  // Solo cuenta la respuesta de la ultima pestaña pedida: si el usuario cambia
  // rapido, las respuestas que llegan tarde se descartan.
  const requestId = useRef(0);
  const sentinel = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const { user, ready, bestScoreFor } = useSession();

  const hasMore = rows.length < total;

  const load = async (gameId: string) => {
    const id = ++requestId.current;
    setStatus("loading");
    setMore("idle");
    scroller.current?.scrollTo({ top: 0 });

    try {
      const page = await fetchLeaderboard(createClient(), gameId, 0, pageSize);
      if (id !== requestId.current) return;
      setRows(page.rows);
      setTotal(page.total ?? 0);
      setStatus("idle");
    } catch {
      if (id === requestId.current) setStatus("error");
    }
  };

  const loadMore = async () => {
    if (!hasMore || more === "loading" || status !== "idle") return;
    const id = requestId.current;
    setMore("loading");

    let page;
    try {
      page = await fetchLeaderboard(createClient(), tab, rows.length, pageSize);
    } catch {
      if (id === requestId.current) setMore("error");
      return;
    }
    if (id !== requestId.current) return; // cambio de pestaña mientras tanto

    // Si un jugador mejora su marca mientras se baja, puede repetirse o moverse:
    // se descartan los jugadores que ya estan en la tabla.
    const key = (r: ScoreRow) => r.user_id ?? `guest:${r.player_name}`;
    const seen = new Set(rows.map(key));
    const merged = [...rows, ...page.rows.filter((r) => !seen.has(key(r)))];
    setRows(merged);
    // Pagina incompleta: no hay mas, aunque el total haya cambiado.
    setTotal(page.rows.length < pageSize ? merged.length : Math.max(page.total ?? 0, merged.length));
    setMore("idle");
  };

  // El observador llama siempre a la ultima version de loadMore.
  const loadMoreRef = useRef(loadMore);
  useEffect(() => {
    loadMoreRef.current = loadMore;
  });

  // Se recrea tras cada pagina: si el final sigue a la vista del contenedor,
  // el observador nuevo salta otra vez y pide la siguiente.
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore || status !== "idle" || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) void loadMoreRef.current();
      },
      { root: scroller.current, rootMargin: "200px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, status, rows.length, tab]);

  const selectTab = (gameId: string) => {
    if (gameId === tab && status !== "error") return;
    setTab(gameId);
    void load(gameId);
  };

  const [champion, runnerUp, third] = rows;

  // Solo hay fila propia si esta sesion guardo alguna puntuacion en este juego.
  const best = ready && user ? bestScoreFor(tab) : null;
  const bestScore = best?.score ?? null;
  const lastLoaded = rows.at(-1)?.score;
  // Con todos los mejores ya cargados el puesto sale de la tabla; si no, se cuenta en Supabase.
  const localRank =
    bestScore !== null && (!hasMore || (lastLoaded !== undefined && bestScore >= lastLoaded))
      ? rows.filter((r) => r.score > bestScore).length + 1
      : null;
  const rankKey = `${tab}|${bestScore}`;
  const needsRemote = bestScore !== null && localRank === null && status === "idle";

  useEffect(() => {
    if (!needsRemote || bestScore === null) return;
    let alive = true;
    fetchLeaderboardRank(createClient(), tab, bestScore)
      .then((rank) => {
        if (alive) setRemoteRank({ key: `${tab}|${bestScore}`, rank });
      })
      .catch(() => {}); // sin puesto se muestra "#—"
    return () => {
      alive = false;
    };
  }, [needsRemote, tab, bestScore]);

  const yourRank = localRank ?? (remoteRank?.key === rankKey ? remoteRank.rank : null);
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
                {/* Fuera del scroll, arriba: siempre a la vista. */}
                {best && (
                  <>
                    <div className="tr you-label">▸ TU MEJOR MARCA EN {tabTitle}</div>
                    <div className="tr you">
                      <div className="rk">
                        {yourRank ? `#${String(yourRank).padStart(2, "0")}` : "#—"}
                      </div>
                      <div className="pl">{best.name}</div>
                      <div className="sc">{best.score.toLocaleString("es-ES")}</div>
                      <div className="dt">{formatDate(best.at)}</div>
                    </div>
                  </>
                )}

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
                    <div className="hall-scroll" ref={scroller} tabIndex={0} aria-label={`Puntuaciones de ${tabTitle}`}>
                      {rows.map((row, i) => (
                        <div
                          key={row.id}
                          className={"tr" + (i < 3 ? ` top${i + 1}` : "")}
                          // Cada pagina nueva entra escalonada desde su primera fila.
                          style={{ animationDelay: `${(i % pageSize) * 40}ms` }}
                        >
                          <div className="rk">#{String(i + 1).padStart(2, "0")}</div>
                          <div className="pl">
                            <PlayerLink row={row} />
                          </div>
                          <div className="sc">{row.score.toLocaleString("es-ES")}</div>
                          <div className="dt">{formatScoreDate(row.created_at)}</div>
                        </div>
                      ))}

                      <div className="hall-more" ref={sentinel}>
                        <span>
                          {rows.length.toLocaleString("es-ES")} DE {total.toLocaleString("es-ES")} JUGADORES
                        </span>
                        {more === "error" && (
                          <p className="save-error" role="alert">
                            No se pudieron cargar más puntuaciones.
                          </p>
                        )}
                        {hasMore && (
                          <button
                            className="btn"
                            onClick={() => void loadMore()}
                            disabled={more === "loading" || loading}
                          >
                            {more === "loading" ? "CARGANDO…" : more === "error" ? "REINTENTAR" : "CARGAR MÁS"}
                          </button>
                        )}
                      </div>
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
