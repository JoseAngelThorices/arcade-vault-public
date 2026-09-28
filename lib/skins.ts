"use client";

// Skins de los juegos canvas. Cada juego dibuja las tres; el reproductor elige
// una. No se recuerda entre visitas: cada vez que se entra en un juego arranca
// en RETRO, y el cambio del selector solo dura mientras se esta en el.

import { useState } from "react";

export type Skin = "neon" | "retro" | "clasico";

export const SKINS: { id: Skin; label: string }[] = [
  { id: "neon", label: "NEÓN" },
  { id: "retro", label: "RETRO" },
  { id: "clasico", label: "CLÁSICO" },
];

export const DEFAULT_SKIN: Skin = "retro";

/**
 * Skin activa del juego y su setter. Empieza siempre en `DEFAULT_SKIN` al
 * montar el reproductor, igual en servidor y cliente (sin desajuste de
 * hidratacion).
 */
export function useSkin(): [Skin, (skin: Skin) => void] {
  return useState<Skin>(DEFAULT_SKIN);
}
