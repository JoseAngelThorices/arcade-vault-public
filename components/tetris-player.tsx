"use client";

// Reproductor de Tetris. Misma maquetacion que components/player.tsx (HUD,
// CRT y modal de fin de partida), con el canvas del juego en lugar de la
// arena de relleno. Es cliente entero porque `ssr: false` solo se admite en
// Client Components, y el canvas no existe en el servidor.
//
// Al guardar, la puntuacion se inserta en la tabla `scores` de Supabase (SPEC 07).
// Solo se guarda con sesion y firmada con el alias de la cuenta (SPEC 14).
// Tetris no tiene vidas: LINEAS ocupa su hueco en el HUD.
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
import SoundToggle from "@/components/sound-toggle";
import { useGameAudio, useSoundOn } from "@/lib/use-sound";
import { createClient } from "@/lib/supabase/client";
import type { GameRow } from "@/lib/supabase/types";

const TetrisGame = dynamic(() => import("@/components/games/tetris-game"), {
  ssr: false,
});

// Teclas del motor para cada boton del gamepad. El D-pad arriba queda libre:
// A ya rota, y B hace la caida instantanea.
const KEY_MAP: KeyMap = {
  down: "ArrowDown",
  left: "ArrowLeft",
  right: "ArrowRight",
  a: "ArrowUp",
  b: "Space",
};

type SaveStatus = "idle" | "saving" | "saved" | "error";

export default function TetrisPlayer({ game }: { game: GameRow }) {
  const { user, username, ready, saveScore } = useSession();
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [level, setLevel] = useState(1);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);

  // Sonido (SPEC 16): efectos al cambiar el estado que notifica el motor.
  // Las bajadas por reinicio no suenan (ver la tabla de eventos del spec).
  useGameAudio();
  // Mover, girar, golpes, caídas, encajes y líneas los suena el motor del juego.
  useSoundOn(level, "levelup", "up", !over);
  useSoundOn(paused, "pause", "change", !over);
  useSoundOn(over, "gameover", "up");
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
    setLines(0);
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
            <div className="l">Líneas</div>
            <div className="v">{lines.toLocaleString("es-ES")}</div>
          </div>
          <div className="hud-stat level">
            <div className="l">Nivel</div>
            <div className="v">{String(level).padStart(2, "0")}</div>
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
          <SoundToggle />
          <Link className="btn ghost" href={`/juego/${game.id}`}>
            SALIR
          </Link>
        </div>
      </div>

      <div className="crt">
        <div className="crt-screen">
          <TetrisGame
            key={run}
            paused={paused || over}
            skin={skin}
            onScoreChange={setScore}
            onLinesChange={setLines}
            onLevelChange={setLevel}
            onPauseToggle={() => setPaused((p) => !p)}
            onGameOver={(finalScore) => {
              setScore(finalScore);
              openGameOver();
            }}
          />
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
          <span>← → MOVER · ↑ ROTAR · ESPACIO SOLTAR · P PAUSA · M SONIDO</span>
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

      {/* El HUD se oculta en móvil: el silencio vive bajo el gamepad (SPEC 16). */}
      <div className="sound-mobile md:hidden">
        <SoundToggle />
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
