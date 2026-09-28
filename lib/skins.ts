"use client";

// Skins de los juegos canvas. Cada juego dibuja las tres; el reproductor elige
// una y la recuerda en `av_skin_<id>`.
//
// Se lee con useSyncExternalStore, como la sesion (lib/session.tsx): en el
// servidor y durante la hidratacion vale la skin por defecto del juego, y React
// vuelve a renderizar con la guardada ya en cliente, sin desajuste de hidratacion.

import { useCallback, useSyncExternalStore } from "react";

export type Skin = "neon" | "retro" | "clasico";

export const SKINS: { id: Skin; label: string }[] = [
  { id: "neon", label: "NEÓN" },
  { id: "retro", label: "RETRO" },
  { id: "clasico", label: "CLÁSICO" },
];

export const DEFAULT_SKIN: Skin = "clasico";

const isSkin = (v: string | null): v is Skin => SKINS.some((s) => s.id === v);
const skinKey = (gameId: string) => `av_skin_${gameId}`;

type Listener = () => void;
const listeners = new Set<Listener>();

// Ultima skin elegida por juego en esta pestaña: si localStorage esta
// bloqueado, el selector sigue funcionando durante la sesion.
const memory = new Map<string, Skin>();

function subscribe(onChange: Listener) {
  listeners.add(onChange);
  // "storage" solo llega desde otras pestañas; los cambios propios los avisa setSkin.
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function readSkin(gameId: string, fallback: Skin): Skin {
  try {
    const stored = localStorage.getItem(skinKey(gameId));
    if (isSkin(stored)) return stored;
  } catch {
    // localStorage bloqueado (navegacion privada): se usa la memoria.
  }
  return memory.get(gameId) ?? fallback;
}

/**
 * Skin activa del juego y su setter, que la persiste en `av_skin_<id>`.
 * `fallback` es la skin sin nada guardado: la del aspecto original del juego.
 */
export function useSkin(gameId: string, fallback: Skin = DEFAULT_SKIN): [Skin, (skin: Skin) => void] {
  const skin = useSyncExternalStore(
    subscribe,
    () => readSkin(gameId, fallback),
    () => fallback,
  );

  const setSkin = useCallback(
    (next: Skin) => {
      memory.set(gameId, next);
      try {
        localStorage.setItem(skinKey(gameId), next);
      } catch {
        // Sin persistencia: la skin dura lo que la pestaña.
      }
      for (const listener of listeners) listener();
    },
    [gameId],
  );

  return [skin, setSkin];
}
