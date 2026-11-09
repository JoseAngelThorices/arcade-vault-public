// Avatar pixel de un jugador (SPEC 15). Sin avatar (perfil aún sin cargar)
// muestra la inicial del alias, como antes. Sirve en Server y Client Components.

import Image from "next/image";
import { avatarLabel, avatarSrc, type AvatarId } from "@/lib/avatars";

type Size = "sm" | "md" | "lg" | "xl";

const PX: Record<Size, number> = { sm: 20, md: 30, lg: 56, xl: 96 };

type Props = {
  avatar: AvatarId | null;
  name: string | null;
  size?: Size;
};

export default function PlayerAvatar({ avatar, name, size = "md" }: Props) {
  const className = "av-avatar" + (size === "md" ? "" : ` ${size}`);

  if (!avatar) {
    return (
      <span className={className} aria-hidden="true">
        {name?.charAt(0)}
      </span>
    );
  }

  // El SVG se sirve tal cual: `unoptimized` evita tener que activar
  // `dangerouslyAllowSVG` en el optimizador de imágenes.
  const inner = Math.round(PX[size] * 0.8);
  return (
    <span className={className + " has-img"}>
      <Image src={avatarSrc(avatar)} alt={avatarLabel(avatar)} width={inner} height={inner} unoptimized />
    </span>
  );
}
