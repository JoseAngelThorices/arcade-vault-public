"use client";

// Filtros y rejilla de la biblioteca (references/templates/biblioteca.jsx).
// El estado vive en cliente: el filtrado es instantaneo al teclear y la URL no
// cambia, igual que en el prototipo.

import { useMemo, useState } from "react";
import GameCard from "@/components/game-card";
import { CATS, GAMES } from "@/lib/games";

// Orden alfabetico solo en la biblioteca: el orden de GAMES lo usan el inicio
// (primeros 6) y la pestaña por defecto del Salón de la Fama.
const SORTED_GAMES = [...GAMES].sort((a, b) => a.title.localeCompare(b.title, "es"));

export default function GameLibrary() {
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<string>("TODOS");

  const filtered = useMemo(() => {
    const needle = query.toLowerCase();
    return SORTED_GAMES.filter(
      (g) => (cat === "TODOS" || g.cat === cat) && g.title.toLowerCase().includes(needle),
    );
  }, [query, cat]);

  return (
    <>
      <div className="av-filters">
        <div className="av-search">
          <span className="ico" aria-hidden="true">
            ⌕
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar un juego por nombre…"
            aria-label="Buscar un juego por nombre"
          />
        </div>
        <div className="av-chips">
          {CATS.map((c) => (
            <button
              key={c}
              className={"chip" + (cat === c ? " active" : "")}
              onClick={() => setCat(c)}
              aria-pressed={cat === c}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="av-grid">
        {filtered.map((game) => (
          <GameCard key={game.id} game={game} />
        ))}
        {filtered.length === 0 && (
          <div className="av-empty">
            <div className="pixel">NO HAY RESULTADOS</div>
            <div>Intenta otra búsqueda o categoría.</div>
          </div>
        )}
      </div>
    </>
  );
}
