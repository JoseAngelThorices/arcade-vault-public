"use client";

// Port de GameCard (references/templates/biblioteca.jsx).
// En el prototipo la tarjeta era un div con onClick y el boton JUGAR paraba la
// propagacion. Aqui la tarjeta entera es el enlace, asi que JUGAR es un span con
// aspecto de boton: un unico destino, un unico tab stop y HTML valido.

import Link from "next/link";
import { useRef } from "react";
import type { Game } from "@/lib/games";

/** Los colores que no tienen variante propia de boton usan el cian por defecto. */
function buttonVariant(color: Game["color"]) {
  return color === "magenta" || color === "yellow" ? ` ${color}` : "";
}

export default function GameCard({ game }: { game: Game }) {
  const cardRef = useRef<HTMLAnchorElement>(null);

  const onMouseMove = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const el = cardRef.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `translateY(-6px) rotateX(${-py * 6}deg) rotateY(${px * 8}deg)`;
  };

  const resetTilt = () => {
    const el = cardRef.current;
    if (el) el.style.transform = "";
  };

  return (
    <Link
      ref={cardRef}
      className="card"
      href={`/juego/${game.id}`}
      onMouseMove={onMouseMove}
      onMouseLeave={resetTilt}
      onBlur={resetTilt}
    >
      <div className="cover">
        <div className={"cover-bg " + game.cover} aria-hidden="true" />
        <div className="label">{game.cat}</div>
      </div>
      <div className="meta">
        <div className="title">{game.title}</div>
        <div className="desc">{game.short}</div>
        <div className="row">
          <div className="score-badge">
            <span>MEJOR PUNTUACIÓN</span>
            <b>{game.best.toLocaleString("es-ES")}</b>
          </div>
          <span className={"btn" + buttonVariant(game.color)}>JUGAR</span>
        </div>
      </div>
    </Link>
  );
}
