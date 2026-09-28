"use client";

// Selector de skin de los reproductores: un desplegable NEÓN / RETRO / CLÁSICO
// que ocupa un hueco mas del HUD, con su etiqueta como las demas estadisticas.
// Estilos: .hud-stat.skin y .skin-select de globals.css.

import { useId } from "react";
import { SKINS, type Skin } from "@/lib/skins";

export default function SkinPicker({ skin, onChange }: { skin: Skin; onChange: (skin: Skin) => void }) {
  const id = useId();
  return (
    <div className="hud-stat skin">
      <label className="l" htmlFor={id}>
        Skin
      </label>
      <select
        id={id}
        className="skin-select"
        value={skin}
        onChange={(e) => onChange(e.target.value as Skin)}
      >
        {SKINS.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </select>
    </div>
  );
}
