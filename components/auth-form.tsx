"use client";

// Acceso (references/templates/auth.jsx) conectado a Supabase Auth (SPEC 13):
// correo + contraseña, registro con confirmacion por correo y recuperacion de
// contraseña. Sin proveedores OAuth.
//
// Las pestañas NO usan estado de React: son dos radios ocultos con sus labels.
// El CSS (:checked y :has) decide que formulario se ve, asi que cambiar de
// pestaña funciona aunque la pagina todavia no haya hidratado. Los inputs no
// llevan `name`: un envio antes de hidratar no pone la contraseña en la URL.

import type { AuthError } from "@supabase/supabase-js";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import AvatarPicker from "@/components/avatar-picker";
import PlayerAvatar from "@/components/player-avatar";
import ProfileEditor from "@/components/profile-editor";
import { DEFAULT_AVATAR, type AvatarId } from "@/lib/avatars";
import { isStrongPassword, PASSWORD_RULES } from "@/lib/password";
import { useSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/client";
import { isValidUsername, normalizeUsername, USERNAME_HINT } from "@/lib/username";

const ALIAS_MAX = 10;

/** Mensajes en español para los codigos de error de Supabase Auth. */
const AUTH_ERRORS: Record<string, string> = {
  invalid_credentials: "Correo o contraseña incorrectos.",
  email_not_confirmed: "Confirma tu correo antes de entrar: busca el enlace en tu bandeja.",
  user_already_exists: "Ya hay una cuenta con ese correo. Inicia sesión.",
  weak_password: PASSWORD_RULES,
  over_email_send_rate_limit: "Se han enviado demasiados correos. Espera unos minutos y vuelve a probar.",
};

function authErrorMessage(error: AuthError): string {
  return (error.code && AUTH_ERRORS[error.code]) || "No se pudo completar la operación. Vuelve a intentarlo.";
}

/** Vuelta de los enlaces de correo, siempre al origen actual (localhost o LAN). */
function callbackUrl(next: string) {
  return `${window.location.origin}/acceso/callback?next=${encodeURIComponent(next)}`;
}

type View = "forms" | "reset" | "notice";
type Notice = { title: string; text: string };
type Place = "in" | "up" | "reset";
type FormError = { place: Place; text: string } | null;

export default function AuthForm({
  linkError = false,
  startOnSignUp = false,
}: {
  linkError?: boolean;
  /** Arranca en la pestaña CREAR CUENTA en lugar de ENTRAR. */
  startOnSignUp?: boolean;
}) {
  const { user, username, avatar, ready, signOut } = useSession();

  if (ready && user) {
    return (
      <div className="auth-card">
        <div className="auth-account">
          <PlayerAvatar avatar={avatar} name={username} size="lg" />
          <p className="auth-account-label">Sesión iniciada como</p>
          <h2>{username}</h2>
          {user.email && <p className="auth-account-email">{user.email}</p>}
        </div>
        {/* `avatar` solo llega con el perfil cargado: hasta entonces el alias es provisional. */}
        {avatar && username && (
          <>
            <Link className="btn lg auth-submit" href={`/jugador/${username}`}>
              VER MI PERFIL
            </Link>
            <ProfileEditor username={username} avatar={avatar} />
          </>
        )}
        <Link className="btn ghost auth-secondary" href="/juegos">
          IR A LA BIBLIOTECA
        </Link>
        <button className="btn ghost auth-secondary" type="button" onClick={() => void signOut()}>
          CERRAR SESIÓN
        </button>
      </div>
    );
  }

  return <SignedOutCard linkError={linkError} startOnSignUp={startOnSignUp} />;
}

function SignedOutCard({ linkError, startOnSignUp }: { linkError: boolean; startOnSignUp: boolean }) {
  const router = useRouter();
  const [view, setView] = useState<View>("forms");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [error, setError] = useState<FormError>(
    linkError ? { place: "in", text: "El enlace no es válido o ha caducado. Pide uno nuevo." } : null,
  );
  const [busy, setBusy] = useState(false);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [alias, setAlias] = useState("");
  const [avatar, setAvatar] = useState<AvatarId>(DEFAULT_AVATAR);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [terms, setTerms] = useState(false);
  const [resetEmail, setResetEmail] = useState("");

  const enterVault = () => {
    router.push("/inicio");
    router.refresh();
  };

  const showNotice = (next: Notice) => {
    setNotice(next);
    setView("notice");
  };

  /** Envuelve cada llamada a Supabase: un solo envio a la vez y el error limpio. */
  const run = async (task: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await task();
    } finally {
      setBusy(false);
    }
  };

  const signIn = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const { error } = await createClient().auth.signInWithPassword({
        email: loginEmail.trim(),
        password: loginPassword,
      });
      if (error) setError({ place: "in", text: authErrorMessage(error) });
      else enterVault();
    });
  };

  const signUp = (e: React.FormEvent) => {
    e.preventDefault();
    const fail = (text: string) => setError({ place: "up", text });
    if (!alias.trim()) return fail("Elige un alias de jugador.");
    if (!isValidUsername(alias)) return fail(`Alias no válido. ${USERNAME_HINT}`);
    if (!email.trim()) return fail("Escribe tu correo electrónico.");
    if (!isStrongPassword(password)) return fail(PASSWORD_RULES);
    if (password !== repeat) return fail("Las contraseñas no coinciden.");
    if (!terms) return fail("Acepta las normas del salón para crear la cuenta.");

    void run(async () => {
      const supabase = createClient();
      const username = normalizeUsername(alias);
      // Comprobacion previa: el trigger de alta nunca falla y, si el alias
      // estuviera ocupado, pondria PLAYER + 4 digitos sin avisar (SPEC 15).
      const { data: free, error: checkError } = await supabase.rpc("username_available", { name: username });
      if (checkError) return fail("No se pudo comprobar el alias. Vuelve a intentarlo.");
      if (!free) return fail("Ese alias ya está en uso.");

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { username, avatar },
          emailRedirectTo: callbackUrl("/inicio"),
        },
      });
      if (error) return fail(authErrorMessage(error));
      // Con la confirmacion por correo desactivada, Supabase ya devuelve sesion.
      if (data.session) return enterVault();
      showNotice({
        title: "REVISA TU CORREO",
        text: `Hemos enviado un enlace a ${email.trim()}. Ábrelo para confirmar tu cuenta y entrar al Vault.`,
      });
    });
  };

  const sendReset = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const { error } = await createClient().auth.resetPasswordForEmail(resetEmail.trim(), {
        redirectTo: callbackUrl("/acceso/nueva-clave"),
      });
      if (error) return setError({ place: "reset", text: authErrorMessage(error) });
      // Mismo mensaje exista o no la cuenta: no se revela que correos estan dados de alta.
      showNotice({
        title: "ENLACE ENVIADO",
        text: `Si ${resetEmail.trim()} tiene cuenta, te hemos enviado un enlace de recuperación.`,
      });
    });
  };

  const openReset = () => {
    setResetEmail(loginEmail);
    setError(null);
    setView("reset");
  };

  const backToForms = () => {
    setError(null);
    setView("forms");
  };

  const message = (place: Place) =>
    error?.place === place ? (
      <p className="auth-msg" role="alert">
        {error.text}
      </p>
    ) : null;

  if (view === "notice" && notice) {
    return (
      <div className="auth-card">
        <div className="auth-notice" role="status">
          <h2>{notice.title}</h2>
          <p>{notice.text}</p>
        </div>
        <button className="btn ghost auth-secondary" type="button" onClick={backToForms}>
          VOLVER AL ACCESO
        </button>
      </div>
    );
  }

  if (view === "reset") {
    return (
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark" aria-hidden="true" />
          <h2>ARCADE VAULT</h2>
          <div className="sub">RECUPERAR CONTRASEÑA</div>
        </div>

        <form className="auth-panel" onSubmit={sendReset}>
          <p className="field-hint auth-intro">
            Escribe el correo de tu cuenta y te enviaremos un enlace para elegir una contraseña nueva.
          </p>
          <div className="field">
            <label htmlFor="av-reset-email">Correo electrónico</label>
            <input
              id="av-reset-email"
              type="email"
              required
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              placeholder="jugador@vault.gg"
              autoComplete="email"
            />
          </div>
          {message("reset")}
          <button className="btn lg auth-submit" type="submit" disabled={busy}>
            {busy ? "ENVIANDO…" : "ENVIAR ENLACE"}
          </button>
        </form>

        <button className="btn ghost auth-secondary" type="button" onClick={backToForms}>
          VOLVER AL ACCESO
        </button>
      </div>
    );
  }

  return (
    <div className="auth-card">
      {/* Los radios van primero: el CSS los usa como interruptor de sus hermanos. */}
      <input className="auth-switch" type="radio" name="av-tab" id="av-tab-in" defaultChecked={!startOnSignUp} />
      <input className="auth-switch" type="radio" name="av-tab" id="av-tab-up" defaultChecked={startOnSignUp} />

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

      <form className="auth-panel only-in" onSubmit={signIn}>
        <div className="field">
          <label htmlFor="av-user">Correo electrónico</label>
          <input
            id="av-user"
            type="email"
            required
            value={loginEmail}
            onChange={(e) => setLoginEmail(e.target.value)}
            placeholder="jugador@vault.gg"
            autoComplete="email"
          />
        </div>

        <div className="field">
          <label htmlFor="av-pass">Contraseña</label>
          <input
            id="av-pass"
            type="password"
            required
            value={loginPassword}
            onChange={(e) => setLoginPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
          />
        </div>

        {message("in")}

        <button className="btn lg auth-submit" type="submit" disabled={busy}>
          {busy ? "ENTRANDO…" : "ENTRAR AL VAULT"}
        </button>

        <button className="auth-link" type="button" onClick={openReset}>
          ¿Olvidaste tu contraseña?
        </button>
      </form>

      <form className="auth-panel only-up" onSubmit={signUp} noValidate>
        <div className="field">
          <div className="field-head">
            <label htmlFor="av-alias">Alias de jugador</label>
            <span className="field-count">
              {alias.length}/{ALIAS_MAX}
            </span>
          </div>
          <input
            id="av-alias"
            value={alias}
            maxLength={ALIAS_MAX}
            onChange={(e) => setAlias(e.target.value.toUpperCase())}
            placeholder="PX_KAI"
            autoComplete="username"
            spellCheck={false}
          />
          <p className="field-hint">Así aparecerás en el Salón de la Fama. {USERNAME_HINT}</p>
        </div>

        <AvatarPicker name="av-signup" value={avatar} onChange={setAvatar} disabled={busy} />

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

        {message("up")}

        <button className="btn lg magenta auth-submit" type="submit" disabled={busy}>
          {busy ? "CREANDO…" : "CREAR Y JUGAR"}
        </button>
      </form>

      <div className="auth-terms">AL ENTRAR ACEPTAS LOS TÉRMINOS DEL SALÓN ARCADE</div>
    </div>
  );
}
