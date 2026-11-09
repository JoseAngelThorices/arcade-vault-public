// Port de MiniCard de references/templates/home-about/home-about/home.jsx.
//
// Es la tarjeta reducida del rail de la landing, distinta de GameCard: solo
// portada, titulo y categoria, sin tilt 3D, descripcion, insignia ni boton.
// Es solo de muestra: no enlaza al juego (el prototipo navegaba al detalle con
// onClick). Para jugar estan JUGAR SIN REGISTRARTE al final de la landing y la Biblioteca.

import type { GameRow } from "@/lib/supabase/types";

export default function MiniCard({ game }: { game: GameRow }) {
  return (
    <div className="mini-card">
      <div className="mini-cover">
        <div className={"cover-bg " + game.cover} aria-hidden="true" />
      </div>
      <div className="mini-meta">
        <div className="mini-title">{game.title}</div>
        <div className="mini-cat">{game.cat}</div>
      </div>
    </div>
  );
}
