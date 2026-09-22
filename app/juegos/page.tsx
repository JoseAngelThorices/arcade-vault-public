import type { Metadata } from "next";
import GameLibrary from "@/components/game-library";

export const metadata: Metadata = {
  title: "Biblioteca · Arcade Vault",
  description: "Los ocho juegos del Vault. Filtra por categoría o busca por nombre.",
};

export default function GamesPage() {
  return (
    <div className="fade-in">
      <section className="av-hero">
        <h1 className="flicker">ARCADE VAULT</h1>
        <div className="sub">
          INSERTA UNA MONEDA PARA JUGAR <span className="blink">_</span>
        </div>
      </section>

      <GameLibrary />
    </div>
  );
}
