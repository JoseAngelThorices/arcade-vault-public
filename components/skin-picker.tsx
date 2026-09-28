"use client";

// Selector de skin de los reproductores: NEÓN / RETRO / CLÁSICO, con el activo
// marcado por aria-pressed. Los estilos son .skin-picker/.skin-opt de globals.css.

import { SKINS, type Skin } from "@/lib/skins";

export default function SkinPicker({ skin, onChange }: { skin: Skin; onChange: (skin: Skin) => void }) {
  return (
    <div className="skin-picker" role="group" aria-label="Tema del juego">
      {SKINS.map((s) => (
        <button
          key={s.id}
          className={`skin-opt skin-${s.id}`}
          aria-pressed={skin === s.id}
          onClick={() => onChange(s.id)}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}
