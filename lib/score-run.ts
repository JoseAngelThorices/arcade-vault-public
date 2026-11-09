"use client";

// Partidas firmadas en el servidor (SEC-01 del informe de seguridad).
//
// Con sesión, cada partida cobrada abre una fila en `game_runs` con la RPC
// `start_run`, y la puntuación solo se guarda cerrándola con `submit_score`:
// una puntuación por partida, con tope por juego y un máximo de puntos por
// segundo desde que empezó. El INSERT directo en `scores` ya no existe.

import { useCallback, useEffect, useState } from "react";
import type { CreditGate } from "@/lib/credits-client";
import { useSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/client";

/** Motivo de un guardado rechazado: el modal elige el texto con él. */
export type SubmitError = "rejected" | "network";

export type ScoreRun = {
  /** Guarda la puntuación de la partida en curso; null si se guardó. */
  submit: (score: number) => Promise<SubmitError | null>;
};

export function useScoreRun(gameId: string, gate: CreditGate): ScoreRun {
  const { user } = useSession();
  const userId = user?.id ?? null;
  // `key` = runId de los créditos al que pertenece la partida del servidor.
  const [run, setRun] = useState<{ key: string; id: string | null } | null>(null);

  useEffect(() => {
    if (gate.status !== "ok" || !userId) return;
    let alive = true;
    const key = gate.runId;
    createClient()
      .rpc("start_run", { p_game: gameId })
      .then(({ data, error }) => {
        if (alive) setRun({ key, id: error ? null : (data as string) });
      });
    return () => {
      alive = false;
    };
  }, [gate.status, gate.runId, userId, gameId]);

  const runId = run && run.key === gate.runId ? run.id : null;

  const submit = useCallback(
    async (score: number): Promise<SubmitError | null> => {
      // Sin partida abierta (p. ej. sesión iniciada a mitad de partida) no hay
      // nada que cerrar: el servidor la rechazaría igual.
      if (!runId) return "rejected";
      const { error } = await createClient().rpc("submit_score", { p_run: runId, p_score: score });
      if (!error) return null;
      return error.code === "P0001" ? "rejected" : "network";
    },
    [runId],
  );

  return { submit };
}
