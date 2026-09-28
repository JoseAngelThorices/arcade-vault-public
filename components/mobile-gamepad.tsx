"use client";

// Gamepad virtual de los reproductores en móvil (SPEC 10): D-pad, botones A/B,
// pausa, fin de partida y selector de skin. No conoce los juegos: cada botón despacha en
// `document` el KeyboardEvent sintético de su `code` (keydown al pulsar, keyup
// al soltar), y los listeners de teclado de los motores lo tratan como una
// tecla real. Solo se ve por debajo de `md`. Estilos: .gamepad de globals.css.

import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import type { Skin } from "@/lib/skins";
import SkinPicker from "@/components/skin-picker";

/** `code` de KeyboardEvent (p. ej. "ArrowUp", "Space") para cada botón. */
export interface KeyMap {
  up?: string;
  down?: string;
  left?: string;
  right?: string;
  a?: string;
  b?: string;
}

interface MobileGamepadProps {
  keyMap: KeyMap;
  paused: boolean;
  disabled?: boolean; // true con la partida terminada
  onPauseToggle: () => void;
  onEnd: () => void; // FIN: termina la partida y abre el modal, como en escritorio
  skin: Skin;
  onSkinChange: (skin: Skin) => void;
}

/** `key` equivalente a un `code`, por si algún listener lo consulta. */
function keyFor(code: string): string {
  if (code === "Space") return " ";
  if (/^Key[A-Z]$/.test(code)) return code.slice(3).toLowerCase();
  return code;
}

function dispatchKey(type: "keydown" | "keyup", code: string) {
  document.dispatchEvent(new KeyboardEvent(type, { code, key: keyFor(code), bubbles: true, cancelable: true }));
}

/**
 * Botón del gamepad que mantiene su tecla pulsada mientras dura el toque.
 * Un único keydown por pulsación (sin autorrepetición) y siempre su keyup:
 * al soltar, al cancelarse el toque, al deshabilitarse o al desmontarse.
 */
function PadButton({
  code,
  disabled,
  className,
  label,
  children,
}: {
  code?: string;
  disabled: boolean;
  className: string;
  label: string;
  children: ReactNode;
}) {
  const [pressed, setPressed] = useState(false);
  // Tecla que está pulsada ahora mismo, para soltar exactamente esa.
  const held = useRef<string | null>(null);
  const inactive = disabled || !code;

  const release = () => {
    if (held.current === null) return;
    dispatchKey("keyup", held.current);
    held.current = null;
    setPressed(false);
  };

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (disabled || !code || held.current !== null) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    held.current = code;
    setPressed(true);
    dispatchKey("keydown", code);
  };

  // Si el botón se deshabilita con la tecla pulsada (fin de partida), o el
  // reproductor se desmonta, la tecla no puede quedarse "pegada".
  useEffect(() => {
    if (inactive) release();
  });
  useEffect(() => release, []);

  return (
    <button
      type="button"
      className={className}
      aria-label={label}
      disabled={inactive}
      data-pressed={pressed || undefined}
      onPointerDown={onPointerDown}
      onPointerUp={release}
      onPointerCancel={release}
      onPointerLeave={release}
      onLostPointerCapture={release}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
    </button>
  );
}

/** Flecha del D-pad; `rotate` en grados, 0 = arriba. */
function Arrow({ rotate }: { rotate: number }) {
  return (
    <svg viewBox="0 0 12 12" width="14" height="14" aria-hidden="true" style={{ transform: `rotate(${rotate}deg)` }}>
      <path d="M6 2 L11 9 H1 Z" fill="currentColor" />
    </svg>
  );
}

export default function MobileGamepad({
  keyMap,
  paused,
  disabled = false,
  onPauseToggle,
  onEnd,
  skin,
  onSkinChange,
}: MobileGamepadProps) {
  return (
    <div className="gamepad md:hidden">
      <div className="gamepad-controls">
        <div className="dpad">
          <PadButton code={keyMap.up} disabled={disabled} className="dpad-btn up" label="Arriba">
            <Arrow rotate={0} />
          </PadButton>
          <PadButton code={keyMap.left} disabled={disabled} className="dpad-btn left" label="Izquierda">
            <Arrow rotate={-90} />
          </PadButton>
          <span className="dpad-hub" aria-hidden="true" />
          <PadButton code={keyMap.right} disabled={disabled} className="dpad-btn right" label="Derecha">
            <Arrow rotate={90} />
          </PadButton>
          <PadButton code={keyMap.down} disabled={disabled} className="dpad-btn down" label="Abajo">
            <Arrow rotate={180} />
          </PadButton>
        </div>

        <div className="face-btns">
          <PadButton code={keyMap.b} disabled={disabled} className="face-btn b" label="Botón B">
            B
          </PadButton>
          <PadButton code={keyMap.a} disabled={disabled} className="face-btn a" label="Botón A">
            A
          </PadButton>
        </div>
      </div>

      <div className="gamepad-system">
        <div className="gamepad-actions">
          <button type="button" className="btn yellow" onClick={onPauseToggle} disabled={disabled}>
            {paused ? "REANUDAR" : "PAUSA"}
          </button>
          <button type="button" className="btn magenta" onClick={onEnd} disabled={disabled}>
            FIN
          </button>
        </div>
        <SkinPicker skin={skin} onChange={onSkinChange} />
      </div>
    </div>
  );
}
