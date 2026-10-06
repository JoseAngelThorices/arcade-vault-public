"use client";

// Reproductor de Snake. Misma maquetacion que components/player.tsx (HUD,
// CRT y modal de fin de partida), con el canvas del juego en lugar de la
// arena de relleno. Es cliente entero porque `ssr: false` solo se admite en
// Client Components, y el canvas no existe en el servidor.
//
// Al guardar, la puntuacion se inserta en la tabla `scores` de Supabase (SPEC 09).
// Solo se guarda con sesion y firmada con el alias de la cuenta (SPEC 14).
// Snake no tiene vidas: LONGITUD ocupa su hueco en el HUD.
//
// En movil (< md) el HUD se oculta y el juego se maneja con el gamepad virtual
// de debajo del CRT (SPEC 10).

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";
import { useSession } from "@/lib/session";
import { useSkin } from "@/lib/skins";
import SkinPicker from "@/components/skin-picker";
import MobileGamepad, { type KeyMap } from "@/components/mobile-gamepad";
import { createClient } from "@/lib/supabase/client";
import type { GameRow } from "@/lib/supabase/types";

const SnakeGame = dynamic(() => import("@/components/games/snake-game"), {
  ssr: false,
});

// Teclas del motor para cada boton del gamepad; A y B no tienen accion en
// Snake. El motor ya impide el giro de 180 grados.
const KEY_MAP: KeyMap = { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight" };

type SaveStatus = "idle" | "saving" | "saved" | "error";

const INITIAL_LENGTH = 3;

export default function SnakePlayer({ game }: { game: GameRow }) {
  const { user, username, ready, saveScore } = useSession();
  const [score, setScore] = useState(0);
  const [length, setLength] = useState(INITIAL_LENGTH);
  const [level, setLevel] = useState(1);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  // Cambiarla remonta el canvas: partida nueva desde cero.
  const [run, setRun] = useState(0);
  // Cambiarla no remonta el canvas: el motor la lee en cada frame. Sin nada
  // guardado, el juego arranca con su aspecto original.
  const [skin, setSkin] = useSkin();

  const playerName = ready && username ? username : "INVITADO";
  const locked = saveStatus === "saving" || saveStatus === "saved";

  const openGameOver = () => setOver(true);

  const save = async () => {
    // RLS solo admite inserciones con sesion y a nombre propio (SPEC 14).
    if (!user || !username || locked) return;
    setSaveStatus("saving");

    const { error } = await createClient()
      .from("scores")
      .insert({ game_id: game.id, player_name: username, score, user_id: user.id });

    if (error) {
      setSaveStatus("error");
      return;
    }
    // Registro local de la sesion: alimenta "TU MEJOR MARCA" del Salón.
    saveScore({ game: game.id, score, name: username });
    setSaveStatus("saved");
  };

  const restart = () => {
    setScore(0);
    setLength(INITIAL_LENGTH);
    setLevel(1);
    setOver(false);
    setSaveStatus("idle");
    setPaused(false);
    setRun((r) => r + 1);
  };

  return (
    <div className="av-player fade-in">
      <div className="player-hud max-md:hidden">
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
            <div className="l">Longitud</div>
            <div className="v">{length.toLocaleString("es-ES")}</div>
          </div>
          <div className="hud-stat level">
            <div className="l">Nivel</div>
            <div className="v">{level.toLocaleString("es-ES")}</div>
          </div>
          <SkinPicker skin={skin} onChange={setSkin} />
        </div>

        <div className="hud-actions">
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
          {/* La pantalla y el canvas son 4:3: el tablero la llena entera. */}
          <div className="absolute inset-0 flex items-center justify-center">
            <SnakeGame
              key={run}
              paused={paused || over}
              skin={skin}
              onScoreChange={setScore}
              onLengthChange={setLength}
              onLevelChange={setLevel}
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
          <span>FLECHAS / WASD MOVER · P PAUSA</span>
        </div>
      </div>

      <MobileGamepad
        keyMap={KEY_MAP}
        paused={paused}
        disabled={over}
        onPauseToggle={() => setPaused((p) => !p)}
        onEnd={openGameOver}
        skin={skin}
        onSkinChange={setSkin}
      />

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
            ) : !ready ? null : user ? (
              <>
                <div className="input-row">
                  <div className="save-as">
                    {username}
                  </div>
                  <button className="btn yellow" onClick={() => void save()} disabled={locked}>
                    {saveStatus === "saving" ? "GUARDANDO…" : "GUARDAR PUNTUACIÓN"}
                  </button>
                </div>
                {saveStatus === "error" && (
                  <p className="save-error" role="alert">
                    No se pudo guardar la puntuación. Comprueba tu conexión y vuelve a intentarlo.
                  </p>
                )}
              </>
            ) : (
              <div className="save-login">
                <p>Inicia sesión para guardar tu puntuación en la clasificación.</p>
                <Link className="btn yellow" href="/acceso">
                  INICIAR SESIÓN
                </Link>
              </div>
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
