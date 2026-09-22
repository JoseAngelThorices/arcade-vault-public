// Se muestra cuando el id de la ruta no corresponde a ningun juego del catalogo.

import Link from "next/link";

export default function GameNotFound() {
  return (
    <div className="fade-in">
      <section className="av-hero">
        <h1 className="flicker">404</h1>
        <div className="sub">
          CARTUCHO NO ENCONTRADO <span className="blink">_</span>
        </div>
      </section>

      <div className="av-grid">
        <div className="av-empty">
          <div className="pixel">ESTE JUEGO NO ESTÁ EN EL VAULT</div>
          <div>Revisa el enlace o vuelve a la biblioteca para ver los 8 juegos disponibles.</div>
          <Link className="btn lg" href="/juegos">
            VOLVER AL VAULT
          </Link>
        </div>
      </div>
    </div>
  );
}
