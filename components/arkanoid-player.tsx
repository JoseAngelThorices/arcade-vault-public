"use client";

// Reproductor de Arkanoid. Misma maquetacion que components/player.tsx (HUD,
// CRT y modal de fin de partida), con el canvas del juego en lugar de la
// arena de relleno. Es cliente entero porque `ssr: false` solo se admite en
// Client Components, y el canvas no existe en el servidor.
//
// Al guardar, la puntuacion se inserta en la tabla `scores` de Supabase y el
// nombre se recuerda en `av_player_name` para la siguiente partida (SPEC 08).
// Arkanoid no tiene niveles: COMBO ocupa su hueco en el HUD.

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";
import { readPlayerName, writePlayerName } from "@/lib/player-name";
import { normalizeName, useSession } from "@/lib/session";
import { useSkin } from "@/lib/skins";
import SkinPicker from "@/components/skin-picker";
import { createClient } from "@/lib/supabase/client";
import type { GameRow } from "@/lib/supabase/types";

const ArkanoidGame = dynamic(() => import("@/components/games/arkanoid-game"), {
  ssr: false,
});

type SaveStatus = "idle" | "saving" | "saved" | "error";

const INITIAL_LIVES = 3;

export default function ArkanoidPlayer({ game }: { game: GameRow }) {
  const { user, ready, saveScore } = useSession();
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(INITIAL_LIVES);
  const [combo, setCombo] = useState(0);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  // null mientras no haya nombre recordado ni editado, para que siga el nombre
  // de la sesion cuando esta se termina de leer.
  const [name, setName] = useState<string | null>(null);
  // Cambiarla remonta el canvas: partida nueva desde cero.
  const [run, setRun] = useState(0);
  // Cambiarla no remonta el canvas: el motor la lee en cada frame. Sin nada
  // guardado, el juego arranca con su aspecto original.
  const [skin, setSkin] = useSkin(game.id, "clasico");

  const playerName = ready && user ? user.name : "INVITADO";
  const scoreName = name ?? playerName;
  const locked = saveStatus === "saving" || saveStatus === "saved";

  /** Abre el modal con el nombre de la ultima puntuacion guardada, si lo hay. */
  const openGameOver = () => {
    const remembered = readPlayerName();
    if (remembered) setName(normalizeName(remembered));
    setOver(true);
  };

  const save = async () => {
    const playerNameToSave = scoreName.trim();
    if (!playerNameToSave || locked) return;
    setSaveStatus("saving");

    const { error } = await createClient()
      .from("scores")
      .insert({ game_id: game.id, player_name: playerNameToSave, score, user_id: null });

    if (error) {
      setSaveStatus("error");
      return;
    }
    writePlayerName(playerNameToSave);
    // Registro local de la sesion: alimenta "TU MEJOR MARCA" del Salón.
    saveScore({ game: game.id, score, name: playerNameToSave });
    setSaveStatus("saved");
  };

  const restart = () => {
    setScore(0);
    setLives(INITIAL_LIVES);
    setCombo(0);
    setOver(false);
    setSaveStatus("idle");
    setPaused(false);
    setRun((r) => r + 1);
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
            <div className="v">{score.toLocaleString("es-ES")}</div>
          </div>
          <div className="hud-stat lives">
            <div className="l">Vidas</div>
            <div className="v">{"♥ ".repeat(Math.max(0, lives)).trim() || "—"}</div>
          </div>
          <div className="hud-stat level">
            <div className="l">Combo</div>
            <div className="v">{combo >= 2 ? `×${combo}` : "—"}</div>
          </div>
        </div>

        <div className="hud-actions">
          <SkinPicker skin={skin} onChange={setSkin} />
          <button className="btn yellow" onClick={() => setPaused((p) => !p)} disabled={over}>
            {paused ? "REANUDAR" : "PAUSA"}
          </button>
          <button className="btn magenta" onClick={openGameOver} disabled={over}>
            FIN
          </button>
          <Link className="btn ghost" href={`/juego/${game.id}`}>
            SALIR
          </Link>
        </div>
      </div>

      <div className="crt">
        <div className="crt-screen">
          {/* La pantalla es 4:3 y el canvas 10:7: se centra con bandas arriba y abajo. */}
          <div className="absolute inset-0 flex items-center justify-center">
            <ArkanoidGame
              key={run}
              paused={paused || over}
              skin={skin}
              onScoreChange={setScore}
              onLivesChange={setLives}
              onComboChange={setCombo}
              onPauseToggle={() => setPaused((p) => !p)}
              onGameOver={(finalScore) => {
                setScore(finalScore);
                openGameOver();
              }}
            />
          </div>
          {paused && !over && (
            <div className="crt-content crt-pause">
              <div>
                <div className="pixel neon-yellow">EN PAUSA</div>
                <div className="pause-hint">PULSA REANUDAR O P PARA CONTINUAR</div>
              </div>
            </div>
          )}
        </div>
        <div className="crt-bottom">
          <span className="led">SEÑAL OK</span>
          <span>{game.title} · CRT-83 · 60 HZ</span>
          <span>← → MOVER · ESPACIO SACAR · P PAUSA</span>
        </div>
      </div>

      {over && (
        <div className="modal-bd">
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="av-over-title">
            <h2 id="av-over-title">FIN DEL JUEGO</h2>
            <div className="final-label">PUNTUACIÓN FINAL</div>
            <div className="final">{score.toLocaleString("es-ES")}</div>

            {saveStatus === "saved" ? (
              <div className="toast-saved" role="status">
                ▸ PUNTUACIÓN GUARDADA_
              </div>
            ) : (
              <>
                <div className="input-row">
                  <input
                    value={scoreName}
                    onChange={(e) => setName(normalizeName(e.target.value))}
                    placeholder="TUS INICIALES"
                    aria-label="Nombre para la tabla de puntuaciones"
                    disabled={locked}
                  />
                  <button
                    className="btn yellow"
                    onClick={() => void save()}
                    disabled={locked || !scoreName.trim()}
                  >
                    {saveStatus === "saving" ? "GUARDANDO…" : "GUARDAR PUNTUACIÓN"}
                  </button>
                </div>
                {saveStatus === "error" && (
                  <p className="save-error" role="alert">
                    No se pudo guardar la puntuación. Comprueba tu conexión y vuelve a intentarlo.
                  </p>
                )}
              </>
            )}

            <div className="actions">
              <button className="btn" onClick={restart}>
                JUGAR DE NUEVO
              </button>
              <Link className="btn magenta" href="/juegos">
                VOLVER AL VAULT
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
