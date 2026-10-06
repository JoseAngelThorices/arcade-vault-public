"use client";

// Sesion de Supabase Auth (SPEC 13) y registro local de puntuaciones.
//
// La sesion vive en las cookies que gestiona @supabase/ssr; aqui solo se
// escucha onAuthStateChange, cuyo primer evento (INITIAL_SESSION) hidrata el
// estado. Hasta entonces `ready` es false y se muestra el estado sin sesion,
// que es tambien lo que renderiza el servidor.
//
// El registro de puntuaciones (`av_scores`) sigue en localStorage y se lee con
// useSyncExternalStore: en el servidor y durante la hidratacion devuelve el
// snapshot vacio, y React vuelve a renderizar con el valor real ya en cliente.

import type { Session as AuthSession, User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";

const SCORES_KEY = "av_scores";

export type ScoreEntry = {
  game: string;
  score: number;
  name: string;
  at: number;
};

export type Session = {
  user: User | null;
  session: AuthSession | null;
  /** Alias normalizado (mayusculas, 10 caracteres); null sin sesion. */
  username: string | null;
  /** false en servidor y hasta recibir INITIAL_SESSION de Supabase. */
  ready: boolean;
  signOut: () => Promise<void>;
  saveScore: (entry: Omit<ScoreEntry, "at">) => void;
  bestScoreFor: (gameId: string) => ScoreEntry | null;
};

/** El nombre de jugador siempre en mayusculas y de 10 caracteres como maximo. */
export function normalizeName(name: string): string {
  return name.toUpperCase().slice(0, 10);
}

/**
 * Alias del usuario. Los registros por correo lo guardan en
 * `user_metadata.username`; los de OAuth no, asi que se cae al login de
 * GitHub, al nombre de Google o a la parte local del correo.
 */
function deriveUsername(user: User): string {
  const meta = user.user_metadata ?? {};
  const raw = [meta.username, meta.user_name, meta.full_name, meta.name, user.email?.split("@")[0]].find(
    (value): value is string => typeof value === "string" && value.trim() !== "",
  );
  return normalizeName((raw ?? "PLAYER").trim());
}

// ===== almacen externo sobre localStorage (av_scores) =====

type Listener = () => void;
const listeners = new Set<Listener>();

function subscribe(onChange: Listener) {
  listeners.add(onChange);
  // "storage" solo llega desde otras pestañas; los cambios propios los avisa emit().
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function emit() {
  for (const listener of listeners) listener();
}

function readRaw(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    // localStorage bloqueado (navegacion privada): se trabaja sin persistencia.
    return null;
  }
}

function writeRaw(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Sin persistencia; el emit posterior mantiene la interfaz coherente.
  }
  emit();
}

// useSyncExternalStore exige que el snapshot sea estable entre renders, asi que
// solo se vuelve a parsear cuando cambia la cadena guardada.
const NO_SCORES: ScoreEntry[] = [];

let scoresRaw: string | null = null;
let scoresValue: ScoreEntry[] = NO_SCORES;

function getScoresSnapshot(): ScoreEntry[] {
  const raw = readRaw(SCORES_KEY);
  if (raw !== scoresRaw) {
    scoresRaw = raw;
    try {
      const parsed = raw ? JSON.parse(raw) : null;
      scoresValue = Array.isArray(parsed) ? (parsed as ScoreEntry[]) : NO_SCORES;
    } catch {
      scoresValue = NO_SCORES;
    }
  }
  return scoresValue;
}

const getNoScores = () => NO_SCORES;

// ===== contexto =====

const SessionContext = createContext<Session | null>(null);

type AuthState = { session: AuthSession | null; ready: boolean };

export function SessionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [auth, setAuth] = useState<AuthState>({ session: null, ready: false });
  const scores = useSyncExternalStore(subscribe, getScoresSnapshot, getNoScores);

  // El cliente se crea dentro del efecto: solo existe en el navegador. Cubre
  // login, logout, refresco de token y cambios del usuario (USER_UPDATED).
  useEffect(() => {
    const {
      data: { subscription },
    } = createClient().auth.onAuthStateChange((_event, session) => {
      setAuth({ session, ready: true });
    });
    return () => subscription.unsubscribe();
  }, []);

  const signOut = useCallback(async () => {
    await createClient().auth.signOut();
    // Los Server Components ya renderizados vuelven a pedirse sin sesion.
    router.refresh();
  }, [router]);

  const saveScore = useCallback((entry: Omit<ScoreEntry, "at">) => {
    const full: ScoreEntry = { ...entry, at: Date.now() };
    writeRaw(SCORES_KEY, JSON.stringify([...getScoresSnapshot(), full]));
  }, []);

  const bestScoreFor = useCallback(
    (gameId: string) =>
      scores
        .filter((s) => s.game === gameId)
        .reduce<ScoreEntry | null>((best, s) => (!best || s.score > best.score ? s : best), null),
    [scores],
  );

  const value = useMemo<Session>(() => {
    const user = auth.session?.user ?? null;
    return {
      user,
      session: auth.session,
      username: user ? deriveUsername(user) : null,
      ready: auth.ready,
      signOut,
      saveScore,
      bestScoreFor,
    };
  }, [auth, signOut, saveScore, bestScoreFor]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession debe usarse dentro de <SessionProvider>");
  return ctx;
}
