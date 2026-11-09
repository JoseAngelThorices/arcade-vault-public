"use client";

// Piezas de los reproductores para los creditos de invitado (SPEC 02,
// ampliacion). La logica vive en useCreditGate() de lib/credits-client.tsx.

import Link from "next/link";
import { useCredits, type CreditGate } from "@/lib/credits-client";

/** Dentro de .crt-screen: tapa la pantalla mientras se cobra o si fallo la red. */
export function CreditGateOverlay({ gate }: { gate: CreditGate }) {
  if (gate.status === "pending") {
    return (
      <div className="crt-content crt-pause" role="status">
        <div className="pixel neon-yellow">
          INSERTANDO MONEDA<span className="blink">…</span>
        </div>
      </div>
    );
  }
  if (gate.status === "error") {
    return (
      <div className="crt-content crt-pause" role="alert">
        <div>
          <div className="pause-hint">NO SE PUDIERON COMPROBAR TUS CRÉDITOS</div>
          <button className="btn yellow credit-retry" onClick={gate.retry}>
            REINTENTAR
          </button>
        </div>
      </div>
    );
  }
  return null;
}

/** Modal SIN CRÉDITOS: el invitado ha gastado las partidas de hoy. */
export function NoCreditsModal({ gate }: { gate: CreditGate }) {
  if (gate.status !== "empty") return null;
  return (
    <div className="modal-bd">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="av-nocredits-title">
        <h2 id="av-nocredits-title">SIN CRÉDITOS</h2>
        <p className="no-credits-text">
          Has gastado tus 10 partidas gratis de hoy. Vuelven a las 00:00.
          <br />
          Con una cuenta juegas sin límite y tus puntuaciones entran en el ranking.
        </p>
        <div className="actions">
          <Link className="btn magenta" href="/acceso?registro">
            CREAR CUENTA
          </Link>
          <Link className="btn yellow" href="/acceso">
            INICIAR SESIÓN
          </Link>
        </div>
        <Link className="no-credits-back" href="/juegos">
          VOLVER AL VAULT
        </Link>
      </div>
    </div>
  );
}

/** "Te quedan N créditos hoy", para el modal de fin del invitado. */
export function CreditsLeft() {
  const { ready, unlimited, left } = useCredits();
  if (!ready || unlimited) return null;
  return (
    <p className="credits-left">
      {left === 0
        ? "No te quedan créditos hoy."
        : `Te ${left === 1 ? "queda" : "quedan"} ${left.toLocaleString("es-ES")} ${left === 1 ? "crédito" : "créditos"} hoy.`}
    </p>
  );
}
