"use client";

// Acceso (references/templates/auth.jsx). No hay autenticacion real: el
// formulario acepta cualquier cosa y fabrica un usuario, igual que el prototipo.
//
// Las pestañas NO usan estado de React: son dos radios ocultos con sus labels.
// El CSS (:checked y :has) decide que formulario se ve, asi que cambiar de
// pestaña funciona aunque la pagina todavia no haya hidratado.

import { useRouter } from "next/navigation";
import { useState } from "react";
import { normalizeName, useSession } from "@/lib/session";

const ALIAS_MAX = 10;



export default function AuthForm() {
  const router = useRouter();
  const { signIn } = useSession();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [terms, setTerms] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    signIn({ name: normalizeName(name || "PLAYER1") });
    router.push("/juegos");
  };

  return (
    <div className="auth-card">
      {/* Los radios van primero: el CSS los usa como interruptor de sus hermanos. */}
      <input className="auth-switch" type="radio" name="av-tab" id="av-tab-in" defaultChecked />
      <input className="auth-switch" type="radio" name="av-tab" id="av-tab-up" />

      <div className="auth-header">
        <div className="mark" aria-hidden="true" />
        <h2>ARCADE VAULT</h2>
        <div className="sub">
          <span className="only-in">ACCESO AL SISTEMA · v2.6</span>
          <span className="only-up">NUEVA FICHA · JUGADOR 2</span>
        </div>
      </div>

      <div className="auth-tabs">
        <label htmlFor="av-tab-in">INICIAR SESIÓN</label>
        <label htmlFor="av-tab-up">CREAR CUENTA</label>
      </div>

      <form className="auth-panel only-in" onSubmit={submit}>
        <div className="field">
          <label htmlFor="av-user">Usuario</label>
          <input
            id="av-user"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="px_kai"
            autoComplete="username"
          />
        </div>

        <div className="field">
          <label htmlFor="av-pass">Contraseña</label>
          <input
            id="av-pass"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
          />
        </div>

        <button className="btn lg auth-submit" type="submit">
          ENTRAR AL VAULT
        </button>
      </form>

      <form className="auth-panel only-up" onSubmit={submit}>
        <div className="field">
          <div className="field-head">
            <label htmlFor="av-alias">Alias de jugador</label>
            <span className="field-count">
              {name.length}/{ALIAS_MAX}
            </span>
          </div>
          <input
            id="av-alias"
            value={name}
            maxLength={ALIAS_MAX}
            onChange={(e) => setName(e.target.value)}
            placeholder="PX_KAI"
            autoComplete="username"
          />
          <p className="field-hint">Así aparecerás en el Salón de la Fama.</p>
        </div>

        <div className="field">
          <label htmlFor="av-email">Correo electrónico</label>
          <input
            id="av-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jugador@vault.gg"
            autoComplete="email"
          />
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="av-pass-up">Contraseña</label>
            <input
              id="av-pass-up"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
            />
          </div>
          <div className="field">
            <label htmlFor="av-pass-repeat">Repítela</label>
            <input
              id="av-pass-repeat"
              type="password"
              value={repeat}
              onChange={(e) => setRepeat(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
            />
          </div>
        </div>

        <label className="auth-check">
          <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
          <span>Acepto las normas del salón arcade</span>
        </label>

        <button className="btn lg magenta auth-submit" type="submit">
          CREAR Y JUGAR
        </button>
      </form>

      <button className="btn ghost auth-guest" type="button" onClick={() => { signIn(null); router.push("/juegos"); }}>
        JUGAR COMO INVITADO
      </button>

      <div className="auth-divider">O CONTINÚA CON</div>
      <div className="social">
        <button className="btn ghost" type="button">
          ◆ GOOGLE
        </button>
        <button className="btn ghost" type="button">
          ▣ GITHUB
        </button>
      </div>

      <div className="auth-terms">AL ENTRAR ACEPTAS LOS TÉRMINOS DEL SALÓN ARCADE</div>
    </div>
  );
}
