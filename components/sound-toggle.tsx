"use client";

// Botón de silencio de los reproductores (SPEC 16). El estado es global y se
// recuerda entre visitas; la tecla M hace lo mismo (useGameAudio).

import { unlockAudio } from "@/lib/audio";
import { useMuted } from "@/lib/use-sound";

export default function SoundToggle({ className = "" }: { className?: string }) {
  const [muted, toggle] = useMuted();
  return (
    <button
      type="button"
      className={"btn ghost sound-toggle " + (muted ? "is-muted " : "") + className}
      aria-pressed={!muted}
      title="Sonido (tecla M)"
      onClick={() => {
        unlockAudio();
        toggle();
      }}
    >
      <span aria-hidden="true">♪</span> SONIDO {muted ? "OFF" : "ON"}
    </button>
  );
}
