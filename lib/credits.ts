// Creditos diarios de los invitados (SPEC 02, ampliacion). Solo servidor
// (usa node:crypto y CREDITS_SECRET; no importar desde componentes cliente).
//
// Sin cuenta se juegan DAILY_CREDITS partidas al dia; el dia se cuenta en
// Europe/Madrid, como las fechas de la app (lib/format.ts). El gasto vive en
// la cookie `av_credits`, firmada con HMAC para que no se pueda editar:
//
//   <dia AAAA-MM-DD>.<usados>.<ultimo runId>.<firma>
//
// Una cookie ausente, de otro dia o con firma invalida cuenta como 0 usados:
// tocarla nunca da mas creditos de los del dia.

// Falla el build si un componente cliente importa este modulo (CREDITS_SECRET).
import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

export const DAILY_CREDITS = 10;
export const CREDITS_COOKIE = "av_credits";

const ZONE = "Europe/Madrid";
const RUN_ID_RE = /^[A-Za-z0-9-]{8,64}$/;

export type CreditState = { day: string; used: number; lastRun: string };

const DAY_FORMAT = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const WALL_FORMAT = new Intl.DateTimeFormat("en-US", {
  timeZone: ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/** Dia de Madrid como "AAAA-MM-DD" (en-CA ya formatea asi). */
export function madridDay(now: Date): string {
  return DAY_FORMAT.format(now);
}

/** Diferencia en ms entre la hora de pared de Madrid y UTC en el instante `ts`. */
function madridOffset(ts: number): number {
  const p = Object.fromEntries(WALL_FORMAT.formatToParts(new Date(ts)).map((x) => [x.type, x.value]));
  const wall = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return wall - Math.floor(ts / 1000) * 1000;
}

/** Proximas 00:00 de Madrid despues de `now` (tiene en cuenta el horario de verano). */
export function nextMadridMidnight(now: Date): Date {
  const [y, m, d] = madridDay(now).split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d + 1); // 00:00 del dia siguiente, como si fuera UTC
  let ts = guess - madridOffset(guess);
  ts = guess - madridOffset(ts); // segunda pasada por si el cambio de hora cae en medio
  return new Date(ts);
}

export function isRunId(value: unknown): value is string {
  return typeof value === "string" && RUN_ID_RE.test(value);
}

function secret(): string {
  const s = process.env.CREDITS_SECRET;
  if (!s || s.length < 16) {
    throw new Error("Falta CREDITS_SECRET (16+ caracteres) en el entorno: los creditos no se pueden firmar.");
  }
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function signCredits(state: CreditState): string {
  const payload = `${state.day}.${state.used}.${state.lastRun}`;
  return `${payload}.${sign(payload)}`;
}

/** Estado de hoy segun la cookie; sin cookie valida de hoy, 0 usados. */
export function readCredits(cookie: string | undefined, now: Date): CreditState {
  const today = madridDay(now);
  const empty: CreditState = { day: today, used: 0, lastRun: "" };
  if (!cookie) return empty;

  const parts = cookie.split(".");
  if (parts.length !== 4) return empty;
  const [day, usedRaw, lastRun, sig] = parts;
  const expected = Buffer.from(sign(`${day}.${usedRaw}.${lastRun}`));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return empty;

  const used = Number(usedRaw);
  if (day !== today || !Number.isInteger(used) || used < 0) return empty;
  return { day, used: Math.min(used, DAILY_CREDITS), lastRun };
}
