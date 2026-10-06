"use client";

// Nueva contraseña tras el enlace de recuperacion (SPEC 13). El callback ya
// cambio el codigo del correo por una sesion, asi que aqui basta con
// updateUser. Sin sesion, el enlace no era valido o ha caducado.

import Link from "next/link";
import { useState } from "react";
import { isStrongPassword, PASSWORD_RULES } from "@/lib/password";
import { useSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/client";

export default function NewPasswordForm() {
  const { session, ready } = useSession();
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!isStrongPassword(password)) return setError(PASSWORD_RULES);
    if (password !== repeat) return setError("Las contraseñas no coinciden.");

    setBusy(true);
    setError(null);
    const { error } = await createClient().auth.updateUser({ password });
    setBusy(false);

    if (error) {
      setError(
        error.code === "same_password"
          ? "La contraseña nueva debe ser distinta de la anterior."
          : error.code === "weak_password"
            ? PASSWORD_RULES
            : "No se pudo cambiar la contraseña. Pide un enlace nuevo y vuelve a intentarlo.",
      );
      return;
    }
    setDone(true);
  };

  if (done) {
    return (
      <div className="auth-card">
        <div className="auth-notice" role="status">
          <h2>CONTRASEÑA ACTUALIZADA</h2>
          <p>Ya puedes entrar al Vault con tu contraseña nueva.</p>
        </div>
        <Link className="btn lg auth-submit" href="/juegos">
          IR A LA BIBLIOTECA
        </Link>
      </div>
    );
  }

  if (ready && !session) {
    return (
      <div className="auth-card">
        <div className="auth-notice" role="alert">
          <h2>ENLACE NO VÁLIDO</h2>
          <p>El enlace no es válido o ha caducado. Pide uno nuevo desde el acceso.</p>
        </div>
        <Link className="btn lg auth-submit" href="/acceso">
          VOLVER AL ACCESO
        </Link>
      </div>
    );
  }

  return (
    <div className="auth-card">
      <div className="auth-header">
        <div className="mark" aria-hidden="true" />
        <h2>ARCADE VAULT</h2>
        <div className="sub">NUEVA CONTRASEÑA</div>
      </div>

      <form className="auth-panel" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="av-new-pass">Nueva contraseña</label>
          <input
            id="av-new-pass"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="new-password"
          />
        </div>

        <div className="field">
          <label htmlFor="av-new-pass-repeat">Repítela</label>
          <input
            id="av-new-pass-repeat"
            type="password"
            value={repeat}
            onChange={(e) => setRepeat(e.target.value)}
            placeholder="••••••••"
            autoComplete="new-password"
          />
        </div>

        {error && (
          <p className="auth-msg" role="alert">
            {error}
          </p>
        )}

        <button className="btn lg auth-submit" type="submit" disabled={busy || !ready}>
          {busy ? "GUARDANDO…" : "GUARDAR CONTRASEÑA"}
        </button>
      </form>
    </div>
  );
}
