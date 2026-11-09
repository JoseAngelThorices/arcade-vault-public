// Se muestra cuando el alias de la ruta no corresponde a ningún perfil.

import Link from "next/link";

export default function PlayerNotFound() {
  return (
    <div className="fade-in">
      <section className="av-hero">
        <h1 className="flicker">404</h1>
        <div className="sub">
          JUGADOR NO ENCONTRADO <span className="blink">_</span>
        </div>
      </section>

      <div className="av-grid">
        <div className="av-empty">
          <div className="pixel">ESE ALIAS NO ESTÁ EN EL VAULT</div>
          <div>Puede que haya cambiado de alias. Búscalo en el Salón de la Fama.</div>
          <Link className="btn lg" href="/salon">
            IR AL SALÓN
          </Link>
        </div>
      </div>
    </div>
  );
}
