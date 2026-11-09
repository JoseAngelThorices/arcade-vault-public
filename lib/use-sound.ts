"use client";

// Hooks de sonido para los reproductores de juegos (SPEC 16).

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { isMuted, playSfx, setMuted, subscribeMuted, unlockAudio, type Sfx } from "@/lib/audio";

const getServerMuted = () => false;

/**
 * Estado de silencio global y su conmutador. En el servidor y durante la
 * hidratación vale "con sonido": sin desajustes aunque esté silenciado.
 */
export function useMuted(): [boolean, () => void] {
  const muted = useSyncExternalStore(subscribeMuted, isMuted, getServerMuted);
  const toggle = useCallback(() => setMuted(!isMuted()), []);
  return [muted, toggle];
}

/**
 * Prepara el audio de un reproductor: desbloquea el AudioContext en el primer
 * gesto y conmuta el silencio con la tecla M (fuera de campos de texto).
 */
export function useGameAudio(): void {
  useEffect(() => {
    const onGesture = () => unlockAudio();
    const onKeyDown = (e: KeyboardEvent) => {
      unlockAudio();
      if (e.code !== "KeyM" || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      setMuted(!isMuted());
    };
    window.addEventListener("pointerdown", onGesture);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);
}

type Direction = "up" | "down" | "change";

/**
 * Suena `sfx` cuando `value` cambia respecto al render anterior en la dirección
 * indicada. El primer render nunca suena; con `enabled` en false tampoco (se
 * actualiza el valor de referencia igualmente).
 */
export function useSoundOn<T extends number | boolean>(
  value: T,
  sfx: Sfx,
  direction: Direction,
  enabled = true,
): void {
  const prev = useRef(value);
  useEffect(() => {
    const before = prev.current;
    prev.current = value;
    if (!enabled || before === value) return;
    const rose = Number(value) > Number(before);
    if (direction === "change" || (direction === "up" && rose) || (direction === "down" && !rose)) {
      playSfx(sfx);
    }
  }, [value, sfx, direction, enabled]);
}
