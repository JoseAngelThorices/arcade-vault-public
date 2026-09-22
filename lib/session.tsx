"use client";

// Sesion y registro de puntuaciones en cliente. Sin backend: todo vive en
// localStorage, con las mismas claves que el prototipo.
//
// localStorage es un almacen externo a React, asi que se lee con
// useSyncExternalStore: en el servidor y durante la hidratacion devuelve el
// snapshot vacio, y React vuelve a renderizar con el valor real ya en cliente.
// Asi no hay desajuste de hidratacion ni setState dentro de un efecto.

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";
import type { ReactNode } from "react";

const USER_KEY = "av_user";
const SCORES_KEY = "av_scores";

export type SessionUser = { name: string };

export type ScoreEntry = {
  game: string;
  score: number;
  name: string;
  at: number;
};

export type Session = {
  user: SessionUser | null;
  /** false en servidor y durante la hidratacion; true una vez leido localStorage. */
  ready: boolean;
  signIn: (user: SessionUser | null) => void;
  signOut: () => void;
  saveScore: (entry: Omit<ScoreEntry, "at">) => void;
  bestScoreFor: (gameId: string) => ScoreEntry | null;
};

/** El nombre de jugador siempre en mayusculas y de 10 caracteres como maximo. */
export function normalizeName(name: string): string {
  return name.toUpperCase().slice(0, 10);
}

// ===== almacen externo sobre localStorage =====

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

function writeRaw(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Sin persistencia; el emit posterior mantiene la interfaz coherente.
  }
  emit();
}

// useSyncExternalStore exige que el snapshot sea estable entre renders, asi que
// solo se vuelve a parsear cuando cambia la cadena guardada.
const NO_SCORES: ScoreEntry[] = [];

let userRaw: string | null = null;
let userValue: SessionUser | null = null;

function getUserSnapshot(): SessionUser | null {
  const raw = readRaw(USER_KEY);
  if (raw !== userRaw) {
    userRaw = raw;
    try {
      const parsed = raw ? (JSON.parse(raw) as SessionUser | null) : null;
      userValue = parsed?.name ? { name: parsed.name } : null;
    } catch {
      userValue = null;
    }
  }
  return userValue;
}

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

const getNullUser = () => null;
const getNoScores = () => NO_SCORES;
const getTrue = () => true;
const getFalse = () => false;

// ===== contexto =====

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const user = useSyncExternalStore(subscribe, getUserSnapshot, getNullUser);
  const scores = useSyncExternalStore(subscribe, getScoresSnapshot, getNoScores);
  const ready = useSyncExternalStore(subscribe, getTrue, getFalse);

  const signIn = useCallback((next: SessionUser | null) => {
    writeRaw(USER_KEY, next ? JSON.stringify(next) : null);
  }, []);

  const signOut = useCallback(() => signIn(null), [signIn]);

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

  const value = useMemo<Session>(
    () => ({ user, ready, signIn, signOut, saveScore, bestScoreFor }),
    [user, ready, signIn, signOut, saveScore, bestScoreFor],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession debe usarse dentro de <SessionProvider>");
  return ctx;
}
