"use client";

// Acceso (references/templates/auth.jsx). No hay autenticacion real: el
// formulario acepta cualquier cosa y fabrica un usuario, igual que el prototipo.

import { useRouter } from "next/navigation";
import { useState } from "react";
import { normalizeName, useSession } from "@/lib/session";

type Tab = "in" | "up";

export default function AuthForm() {
  const router = useRouter();
  const { signIn } = useSession();
  const [tab, setTab] = useState<Tab>("in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    signIn({ name: normalizeName(name || "PLAYER1") });
    router.push("/");
  };

  const enterAsGuest = () => {
    signIn(null);
    router.push("/");
  };

  return (
    <div className="auth-card">
      <div className="auth-header">
        <div className="mark" aria-hidden="true" />
        <h2 className="neon-cyan">ARCADE VAULT</h2>
        <div className="sub">ACCESO AL SISTEMA · v2.6</div>
      </div>

      <div className="auth-tabs">
        <button className={tab === "in" ? "on" : ""} onClick={() => setTab("in")} aria-pressed={tab === "in"}>
          INICIAR SESIÓN
        </button>
        <button className={tab === "up" ? "on" : ""} onClick={() => setTab("up")} aria-pressed={tab === "up"}>
          CREAR CUENTA
        </button>
      </div>

      <form onSubmit={submit}>
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

        {tab === "up" && (
          <div className="field slide-in">
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
        )}

        <div className="field">
          <label htmlFor="av-pass">Contraseña</label>
          <input
            id="av-pass"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete={tab === "in" ? "current-password" : "new-password"}
          />
        </div>

        <button className="btn lg auth-submit" type="submit">
          {tab === "in" ? "ENTRAR AL VAULT" : "CREAR Y JUGAR"}
        </button>
      </form>

      <button className="btn ghost auth-guest" onClick={enterAsGuest}>
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
