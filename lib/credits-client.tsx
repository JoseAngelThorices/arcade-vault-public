"use client";

// Creditos diarios en el cliente (SPEC 02, ampliacion). El servidor manda:
// aqui solo se consulta y se pide gastar (app/api/credits/route.ts).
//
// - CreditsProvider/useCredits(): saldo para el Nav; se relee al cambiar la
//   sesion (iniciar o cerrar sesion cambia de invitado a ilimitado).
// - useCreditGate(): lo usan los reproductores. Cada partida tiene un runId;
//   el juego no se monta hasta que el servidor confirma el cobro de ese runId.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { CreditsResponse } from "@/app/api/credits/route";
import { useSession } from "@/lib/session";

type Credits = {
  /** false hasta la primera respuesta del servidor. */
  ready: boolean;
  unlimited: boolean;
  left: number;
  resetsAt: string | null;
  /** Gasta un credito para `runId`; null si fallo la peticion. */
  spend: (runId: string) => Promise<CreditsResponse | null>;
};

const CreditsContext = createContext<Credits | null>(null);

export function CreditsProvider({ children }: { children: ReactNode }) {
  const { user, ready: sessionReady } = useSession();
  const userId = user?.id ?? null;
  const [state, setState] = useState<Omit<Credits, "spend">>({
    ready: false,
    unlimited: false,
    left: 0,
    resetsAt: null,
  });

  // GET y POST se cruzan al abrir un juego: el GET puede salir con la cookie
  // de antes del cobro y llegar despues. Un GET solo se aplica si no habia
  // ningun cobro en marcha al enviarlo ni empezo otro mientras tanto.
  const posts = useRef(0); // cobros iniciados
  const inFlight = useRef(0); // cobros sin respuesta
  const apply = useCallback((r: CreditsResponse) => {
    setState({ ready: true, unlimited: r.unlimited, left: r.left, resetsAt: r.resetsAt });
  }, []);

  // Saldo inicial y cada vez que cambia la sesion.
  useEffect(() => {
    if (!sessionReady) return;
    let alive = true;
    const postsAtSend = posts.current;
    const busyAtSend = inFlight.current > 0;
    fetch("/api/credits", { cache: "no-store" })
      .then((res) => (res.ok ? (res.json() as Promise<CreditsResponse>) : null))
      .then((r) => {
        if (alive && r && !busyAtSend && posts.current === postsAtSend) apply(r);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [sessionReady, userId, apply]);

  const spend = useCallback(
    async (runId: string) => {
      const mySeq = ++posts.current;
      inFlight.current++;
      try {
        const res = await fetch("/api/credits", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ runId }),
        });
        if (!res.ok) return null;
        const r = (await res.json()) as CreditsResponse;
        // Entre cobros manda el ultimo iniciado.
        if (mySeq === posts.current) apply(r);
        return r;
      } catch {
        return null;
      } finally {
        inFlight.current--;
      }
    },
    [apply],
  );

  const value = useMemo(() => ({ ...state, spend }), [state, spend]);
  return <CreditsContext.Provider value={value}>{children}</CreditsContext.Provider>;
}

export function useCredits(): Credits {
  const ctx = useContext(CreditsContext);
  if (!ctx) throw new Error("useCredits() necesita <CreditsProvider>");
  return ctx;
}

export type GateStatus = "pending" | "ok" | "empty" | "error";

export type CreditGate = {
  status: GateStatus;
  /** Id de la partida en curso: cambia con cada newRun(). */
  runId: string;
  /** Partida nueva (JUGAR DE NUEVO): otro runId, otro credito. */
  newRun: () => void;
  /** Reintenta el cobro del mismo runId tras un error de red. */
  retry: () => void;
};

const newRunId = () => crypto.randomUUID();

export function useCreditGate(): CreditGate {
  const { spend } = useCredits();
  const { user, ready: sessionReady } = useSession();
  const userId = user?.id ?? null;
  // No se pinta en ningun sitio, asi que no importa que el servidor genere otro.
  const [runId, setRunId] = useState(newRunId);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ runId: string; status: GateStatus } | null>(null);

  // Cobra la partida. Se repite al cambiar la sesion: quien estaba sin
  // creditos y entra con su cuenta juega sin recargar.
  useEffect(() => {
    if (!sessionReady) return;
    let alive = true;
    spend(runId).then((r) => {
      if (!alive) return;
      setResult({ runId, status: r === null ? "error" : r.ok ? "ok" : "empty" });
    });
    return () => {
      alive = false;
    };
  }, [runId, sessionReady, userId, attempt, spend]);

  const status: GateStatus = result && result.runId === runId ? result.status : "pending";

  const newRun = useCallback(() => setRunId(newRunId()), []);
  const retry = useCallback(() => setAttempt((a) => a + 1), []);

  return { status, runId, newRun, retry };
}
