"use client";

// Reproductor (references/templates/reproductor.jsx), sin juego y sin partida
// simulada: el HUD es estatico. El prototipo subia la puntuacion con un
// setInterval; aqui no hay temporizadores de ningun tipo.

import Link from "next/link";
import { useState } from "react";
import type { Game } from "@/lib/games";
import { normalizeName, useSession } from "@/lib/session";

const SCORE = 0;
const LIVES = 3;
const LEVEL = 1;

export default function GamePlayer({ game }: { game: Game }) {
  const { user, ready, saveScore } = useSession();
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const [saved, setSaved] = useState(false);
  // null mientras nadie edite el campo, para que siga el nombre de la sesion
  // cuando esta se termina de leer.
  const [typedName, setTypedName] = useState<string | null>(null);

  const playerName = ready && user ? user.name : "INVITADO";
  const scoreName = typedName ?? playerName;

  const restart = () => {
    setOver(false);
    setSaved(false);
    setPaused(false);
  };

  return (
    <div className="av-player fade-in">
      <div className="player-hud">
        <div className="hud-stats">
          <div className="hud-stat player">
            <div className="l">Jugador</div>
            <div className="v">{playerName}</div>
          </div>
          <div className="hud-stat">
            <div className="l">Puntuación</div>
            <div className="v">{SCORE.toLocaleString("es-ES")}</div>
          </div>
          <div className="hud-stat lives">
            <div className="l">Vidas</div>
            <div className="v">{"♥ ".repeat(LIVES).trim()}</div>
          </div>
          <div className="hud-stat level">
            <div className="l">Nivel</div>
            <div className="v">{String(LEVEL).padStart(2, "0")}</div>
          </div>
        </div>

        <div className="hud-actions">
          <button className="btn yellow" onClick={() => setPaused((p) => !p)}>
            {paused ? "REANUDAR" : "PAUSA"}
          </button>
          <button className="btn magenta" onClick={() => setOver(true)}>
            FIN
          </button>
          <Link className="btn ghost" href={`/juego/${game.id}`}>
            SALIR
          </Link>
        </div>
      </div>

      <div className="crt">
        <div className="crt-screen">
          <div className="game-arena" aria-hidden="true">
            <div className="grid-floor" />
            <div className="enemy e1" />
            <div className="enemy e2" />
            <div className="enemy e3" />
            <div className="player-ship" />
          </div>
          {paused && (
            <div className="crt-content crt-pause">
              <div>
                <div className="pixel neon-yellow">EN PAUSA</div>
                <div className="pause-hint">PULSA REANUDAR PARA CONTINUAR</div>
              </div>
            </div>
          )}
        </div>
        <div className="crt-bottom">
          <span className="led">SEÑAL OK</span>
          <span>{game.title} · CRT-83 · 60 HZ</span>
          <span>CARGA · 1MB</span>
        </div>
      </div>

      {over && (
        <div className="modal-bd">
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="av-over-title">
            <h2 id="av-over-title">FIN DEL JUEGO</h2>
            <div className="final-label">PUNTUACIÓN FINAL</div>
            <div className="final">{SCORE.toLocaleString("es-ES")}</div>

            {saved ? (
              <div className="toast-saved">▸ PUNTUACIÓN GUARDADA_</div>
            ) : (
              <div className="input-row">
                <input
                  value={scoreName}
                  onChange={(e) => setTypedName(normalizeName(e.target.value))}
                  placeholder="TUS INICIALES"
                  aria-label="Nombre para la tabla de puntuaciones"
                />
                <button
                  className="btn yellow"
                  onClick={() => {
                    saveScore({ game: game.id, score: SCORE, name: scoreName });
                    setSaved(true);
                  }}
                >
                  GUARDAR PUNTUACIÓN
                </button>
              </div>
            )}

            <div className="actions">
              <button className="btn" onClick={restart}>
                JUGAR DE NUEVO
              </button>
              <Link className="btn magenta" href="/">
                VOLVER AL VAULT
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
