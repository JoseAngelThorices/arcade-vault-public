// Avatares pixel del perfil de jugador (SPEC 15). La lista coincide con la
// función `is_valid_avatar` de Supabase: si se añade uno, hay que añadirlo en
// los dos sitios y crear `public/avatars/<id>.svg`.

export const AVATARS = [
  { id: "robot", label: "Robot" },
  { id: "alien", label: "Alien" },
  { id: "calavera", label: "Calavera" },
  { id: "gato", label: "Gato" },
  { id: "rana", label: "Rana" },
  { id: "cohete", label: "Cohete" },
  { id: "corazon", label: "Corazón" },
  { id: "joystick", label: "Joystick" },
  { id: "moneda", label: "Moneda" },
  { id: "rayo", label: "Rayo" },
  { id: "dragon", label: "Dragón" },
  { id: "buho", label: "Búho" },
] as const;

export type AvatarId = (typeof AVATARS)[number]["id"];

export const DEFAULT_AVATAR: AvatarId = "robot";

const IDS = new Set<string>(AVATARS.map((a) => a.id));

export function isAvatarId(value: unknown): value is AvatarId {
  return typeof value === "string" && IDS.has(value);
}

export function avatarSrc(id: AvatarId): string {
  return `/avatars/${id}.svg`;
}

export function avatarLabel(id: AvatarId): string {
  return AVATARS.find((a) => a.id === id)?.label ?? id;
}
