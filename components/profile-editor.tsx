"use client";

// Editar alias y avatar desde la vista de cuenta de /acceso (SPEC 15). La RPC
// `update_profile` valida, guarda y renombra las puntuaciones propias.

import { useRouter } from "next/navigation";
import { useState } from "react";
import AvatarPicker from "@/components/avatar-picker";
import type { AvatarId } from "@/lib/avatars";
import { useSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/client";
import { isValidUsername, normalizeUsername, USERNAME_HINT } from "@/lib/username";

const ALIAS_MAX = 10;

/** Errores que lanza `update_profile` con RAISE EXCEPTION. */
const PROFILE_ERRORS: Record<string, string> = {
  username_taken: "Ese alias ya está en uso.",
  username_invalid: `Alias no válido. ${USERNAME_HINT}`,
  avatar_invalid: "Elige uno de los avatares de la lista.",
};

type Message = { kind: "ok" | "error"; text: string } | null;

type Props = { username: string; avatar: AvatarId };

export default function ProfileEditor({ username, avatar }: Props) {
  const router = useRouter();
  const { refreshProfile } = useSession();
  const [alias, setAlias] = useState(username);
  const [choice, setChoice] = useState<AvatarId>(avatar);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message>(null);

  const next = normalizeUsername(alias);
  const unchanged = next === username && choice === avatar;

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || unchanged) return;
    if (!isValidUsername(alias)) {
      setMessage({ kind: "error", text: `Alias no válido. ${USERNAME_HINT}` });
      return;
    }

    setBusy(true);
    setMessage(null);
    void (async () => {
      try {
        const { error } = await createClient().rpc("update_profile", {
          new_username: next,
          new_avatar: choice,
        });
        if (error) {
          setMessage({
            kind: "error",
            text: PROFILE_ERRORS[error.message] ?? "No se pudo guardar el perfil. Vuelve a intentarlo.",
          });
          return;
        }
        await refreshProfile();
        // Rankings y perfiles ya renderizados en el servidor llevan el alias viejo.
        router.refresh();
        setMessage({ kind: "ok", text: "Perfil actualizado." });
      } finally {
        setBusy(false);
      }
    })();
  };

  return (
    <form className="auth-panel profile-editor" onSubmit={save} noValidate>
      <h3>EDITAR PERFIL</h3>
      <div className="field">
        <div className="field-head">
          <label htmlFor="av-profile-alias">Alias de jugador</label>
          <span className="field-count">
            {alias.length}/{ALIAS_MAX}
          </span>
        </div>
        <input
          id="av-profile-alias"
          value={alias}
          maxLength={ALIAS_MAX}
          onChange={(e) => {
            setAlias(e.target.value.toUpperCase());
            setMessage(null);
          }}
          autoComplete="username"
          spellCheck={false}
        />
        <p className="field-hint">
          {USERNAME_HINT} Tus puntuaciones pasan al alias nuevo y el enlace antiguo deja de funcionar.
        </p>
      </div>

      <AvatarPicker
        name="av-profile"
        value={choice}
        onChange={(id) => {
          setChoice(id);
          setMessage(null);
        }}
        disabled={busy}
      />

      {message && (
        <p className={message.kind === "ok" ? "auth-msg ok" : "auth-msg"} role={message.kind === "ok" ? "status" : "alert"}>
          {message.text}
        </p>
      )}

      <button className="btn lg auth-submit" type="submit" disabled={busy || unchanged}>
        {busy ? "GUARDANDO…" : "GUARDAR CAMBIOS"}
      </button>
    </form>
  );
}
