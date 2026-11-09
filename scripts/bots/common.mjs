// Utilidades compartidas por los bots de prueba (scripts/bots/*.mjs).
//
// Los bots son cuentas reales de Supabase Auth marcadas para poder borrarlas:
// correo bot-NNN@arcade-bots.test y alias BOT_<NOMBRE><NN>. Se crean con la
// clave secreta (correo ya confirmado), pero juegan y guardan puntuaciones con
// su propia sesion y la clave publica, igual que un jugador en el navegador,
// asi que pasan por RLS y por el trigger de `scores`.
//
// Nunca importar desde la app: la clave secreta solo existe en estos scripts.

import { createClient } from "@supabase/supabase-js";
import { AVATARS } from "../../lib/avatars.ts";
import { USERNAME_RE } from "../../lib/username.ts";

try {
  process.loadEnvFile(".env.local");
} catch {
  // Sin .env.local: valen las variables del entorno.
}

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

export const BOT_DOMAIN = "arcade-bots.test";
// Cumple la politica de lib/password.ts: minuscula, mayuscula, digito y simbolo.
export const BOT_PASSWORD = process.env.BOT_PASSWORD || "Bot-Vault-2026!";

export const GAMES = ["asteroids", "tetris", "arkanoid", "snake", "frogger"];

// Nombres de hasta 4 letras: BOT_ + nombre + 2 digitos caben en los 10 del alias.
const NAMES = [
  "NOVA", "ACE", "ZAP", "PIXL", "BYTE", "NEON", "VOLT", "KAI", "RAY", "JET",
  "ORB", "FUZZ", "GLIT", "DASH", "MAX", "LUX", "ECHO", "BLIP", "ROXY", "TANK",
];

export function fail(msg) {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

if (!SUPABASE_URL || !PUBLISHABLE_KEY) {
  fail("Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY en .env.local.");
}

/** Argumentos `--clave=valor` y `--flag` a un objeto. */
export function parseArgs(defaults = {}) {
  const out = { ...defaults };
  for (const arg of process.argv.slice(2)) {
    const m = arg.match(/^--([^=]+)(?:=(.*))?$/);
    if (!m) continue;
    const [, key, value] = m;
    out[key] = value === undefined ? true : value;
  }
  return out;
}

export function botEmail(i) {
  return `bot-${String(i).padStart(3, "0")}@${BOT_DOMAIN}`;
}

export function botAlias(i) {
  const name = NAMES[(i - 1) % NAMES.length];
  const num = String(Math.floor((i - 1) / NAMES.length) + 1).padStart(2, "0");
  const alias = `BOT_${name}${num}`;
  if (!USERNAME_RE.test(alias)) throw new Error(`Alias de bot no valido: ${alias}`);
  return alias;
}

export function botAvatar(i) {
  return AVATARS[(i * 7) % AVATARS.length].id;
}

/** Habilidad estable por bot (0.4–2.2): multiplica sus puntuaciones. */
export function botSkill(i) {
  const x = Math.sin(i * 12.9898) * 43758.5453;
  return 0.4 + (x - Math.floor(x)) * 1.8;
}

export function isBotEmail(email) {
  return typeof email === "string" && email.endsWith(`@${BOT_DOMAIN}`);
}

export function botIndex(email) {
  const m = email.match(/^bot-(\d+)@/);
  return m ? Number(m[1]) : NaN;
}

const NO_PERSIST = { auth: { persistSession: false, autoRefreshToken: false } };

/** Cliente con la clave secreta: solo para crear y borrar cuentas de bots. */
export function adminClient() {
  if (!SECRET_KEY) {
    fail(
      "Falta SUPABASE_SECRET_KEY en .env.local.\n" +
        "  Copiala de Supabase → Project Settings → API Keys → Secret keys.",
    );
  }
  return createClient(SUPABASE_URL, SECRET_KEY, NO_PERSIST);
}

/** Cliente anonimo con la clave publica, como un navegador sin sesion. */
export function anonClient() {
  return createClient(SUPABASE_URL, PUBLISHABLE_KEY, NO_PERSIST);
}

/** Cliente con la sesion del bot (clave publica + login), como el navegador. */
export async function botClient(email) {
  const client = anonClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password: BOT_PASSWORD });
  if (error) throw new Error(`login de ${email}: ${error.message}`);
  return { client, user: data.user };
}

/** Todas las cuentas de bots existentes, ordenadas por indice. */
export async function listBots(admin) {
  const bots = [];
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) fail(`No se pudieron listar los usuarios: ${error.message}`);
    bots.push(...data.users.filter((u) => isBotEmail(u.email)));
    if (data.users.length < 1000) break;
  }
  return bots.sort((a, b) => botIndex(a.email) - botIndex(b.email));
}

/** Ejecuta `fn` sobre `items` con como mucho `limit` tareas a la vez. */
export async function pool(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const idx = next++;
      results[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return results;
}

export function fmt(n) {
  return Number(n).toLocaleString("es-ES");
}
