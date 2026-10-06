"use client";

// Port de references/templates/nav.jsx. El estado activo sale de la ruta actual
// en vez del objeto de ruta que el prototipo llevaba por props.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "@/lib/session";

/** La biblioteca sigue marcada mientras se navega por un juego concreto. */
function isLibrary(pathname: string) {
  return pathname === "/juegos" || pathname.startsWith("/juego") || pathname.startsWith("/jugar");
}

export default function Nav() {
  const pathname = usePathname() || "";
  const { user, username, ready, signOut } = useSession();
  const [open, setOpen] = useState(false);

  const homeActive = pathname === "/inicio";
  const libraryActive = isLibrary(pathname);
  const hallActive = pathname === "/salon";
  const aboutActive = pathname === "/acerca-de";
  const accessActive = pathname === "/acceso";
  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // Hasta que Supabase entrega la sesion inicial se muestra el estado sin
  // sesion, que es tambien lo que renderiza el servidor.
  const signedIn = ready && user !== null;

  return (
    <>
      <nav className="av-nav">
        <Link className="logo" href="/inicio" aria-label="Arcade Vault, ir al inicio">
          <div className="logo-mark" aria-hidden="true" />
          <div className="logo-text neon-cyan">
            ARCADE <span className="neon-magenta">VAULT</span>
          </div>
        </Link>

        <div className="links">
          <Link className={homeActive ? "active" : ""} href="/inicio" aria-current={homeActive ? "page" : undefined}>
            Inicio
          </Link>
          <Link className={libraryActive ? "active" : ""} href="/juegos" aria-current={libraryActive ? "page" : undefined}>
            Biblioteca
          </Link>
          <Link className={hallActive ? "active" : ""} href="/salon" aria-current={hallActive ? "page" : undefined}>
            Salón de la Fama
          </Link>
          <Link className={aboutActive ? "active" : ""} href="/acerca-de" aria-current={aboutActive ? "page" : undefined}>
            contáctanos
          </Link>
        </div>

        <div className="spacer" />

        <div className="coin-counter">
          <span className="coin" aria-hidden="true" />
          <span>CRÉDITOS · 03</span>
        </div>

        {signedIn ? (
          <div className="nav-user">
            <Link className="nav-user-id" href="/acceso" aria-label={`Tu cuenta: ${username}`}>
              <span className="av-avatar" aria-hidden="true">
                {username?.charAt(0)}
              </span>
              <span className="nav-user-name">{username}</span>
            </Link>
            <button className="btn ghost nav-signout" onClick={() => void signOut()}>
              CERRAR SESIÓN
            </button>
          </div>
        ) : (
          <Link className="btn auth-btn" href="/acceso">
            Iniciar Sesión
          </Link>
        )}

        <button
          className="btn ghost hamburger"
          onClick={() => setOpen(true)}
          aria-label="Abrir menú"
          aria-expanded={open}
          aria-controls="av-menu"
        >
          ≡
        </button>
      </nav>

      <div className={"av-mobile-backdrop" + (open ? " open" : "")} onClick={close} aria-hidden="true" />

      <aside id="av-menu" className={"av-mobile-panel" + (open ? " open" : "")} inert={!open}>
        <div className="pixel neon-cyan" style={{ fontSize: 11, marginBottom: 16 }}>
          MENÚ
        </div>
        <Link className={homeActive ? "active" : ""} href="/inicio" onClick={close}>
          Inicio
        </Link>
        <Link className={libraryActive ? "active" : ""} href="/juegos" onClick={close}>
          Biblioteca
        </Link>
        <Link className={hallActive ? "active" : ""} href="/salon" onClick={close}>
          Salón de la Fama
        </Link>
        <Link className={aboutActive ? "active" : ""} href="/acerca-de" onClick={close}>
          Acerca de
        </Link>
        <Link className={accessActive ? "active" : ""} href="/acceso" onClick={close}>
          {signedIn ? "Cuenta" : "Iniciar Sesión"}
        </Link>
        {signedIn && (
          <button
            className="panel-action"
            onClick={() => {
              close();
              void signOut();
            }}
          >
            Cerrar sesión
          </button>
        )}
        <div style={{ flex: 1 }} />
        <div className="pixel" style={{ fontSize: 9, color: "var(--ink-faint)", letterSpacing: "0.16em" }}>
          CRÉDITOS · 03
        </div>
      </aside>
    </>
  );
}
