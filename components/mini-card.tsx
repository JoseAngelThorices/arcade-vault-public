// Port de MiniCard de references/templates/home-about/home-about/home.jsx.
//
// Es la tarjeta reducida del rail de la landing, distinta de GameCard: solo
// portada, titulo y categoria, sin tilt 3D, descripcion, insignia ni boton.
// El onClick del prototipo se convierte aqui en un Link, asi que no necesita
// ser un componente cliente.

import Link from "next/link";
import type { Game } from "@/lib/games";

export default function MiniCard({ game }: { game: Game }) {
  return (
    <Link className="mini-card" href={`/juego/${game.id}`}>
      <div className="mini-cover">
        <div className={"cover-bg " + game.cover} aria-hidden="true" />
      </div>
      <div className="mini-meta">
        <div className="mini-title">{game.title}</div>
        <div className="mini-cat">{game.cat}</div>
      </div>
    </Link>
  );
}
