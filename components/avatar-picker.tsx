"use client";

// Rejilla para elegir avatar (SPEC 15): registro y edición del perfil. Son
// radios nativos, así que se navega con flechas y lo anuncia el lector de pantalla.

import Image from "next/image";
import { AVATARS, avatarSrc, type AvatarId } from "@/lib/avatars";

type Props = {
  /** Prefijo para el `name` del grupo de radios (único por formulario). */
  name: string;
  value: AvatarId;
  onChange: (id: AvatarId) => void;
  disabled?: boolean;
};

export default function AvatarPicker({ name, value, onChange, disabled = false }: Props) {
  return (
    <fieldset className="avatar-picker" disabled={disabled}>
      <legend>Avatar</legend>
      <div className="avatar-grid">
        {AVATARS.map((a) => (
          <label key={a.id} className="avatar-option" title={a.label}>
            <input
              type="radio"
              name={`${name}-avatar`}
              value={a.id}
              checked={a.id === value}
              onChange={() => onChange(a.id)}
            />
            <Image src={avatarSrc(a.id)} alt={a.label} width={36} height={36} unoptimized />
          </label>
        ))}
      </div>
    </fieldset>
  );
}
