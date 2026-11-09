// Creditos diarios de los invitados (SPEC 02, ampliacion).
//
// GET  → cuantos quedan, sin gastar.
// POST { runId } → gasta 1 credito para una partida nueva. Idempotente por
//      runId: el doble montaje de React o un reintento no cobran dos veces.
//
// Con sesion de Supabase no se gasta nada (unlimited). El cobro va aqui y no
// en proxy.ts porque los prefetch de <Link> pedirian /jugar/<id> sin jugar.

import { cookies } from "next/headers";
import {
  CREDITS_COOKIE,
  DAILY_CREDITS,
  isRunId,
  nextMadridMidnight,
  readCredits,
  signCredits,
} from "@/lib/credits";
import { createClient } from "@/lib/supabase/server";

export type CreditsResponse = {
  ok: boolean;
  unlimited: boolean;
  left: number;
  /** Proximas 00:00 de Europe/Madrid, en ISO. */
  resetsAt: string;
};

const NO_STORE = { "Cache-Control": "no-store" };

async function signedIn(): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return !!data?.claims;
}

export async function GET() {
  const now = new Date();
  const resetsAt = nextMadridMidnight(now).toISOString();
  if (await signedIn()) {
    return Response.json({ ok: true, unlimited: true, left: DAILY_CREDITS, resetsAt } satisfies CreditsResponse, {
      headers: NO_STORE,
    });
  }
  const state = readCredits((await cookies()).get(CREDITS_COOKIE)?.value, now);
  return Response.json(
    { ok: state.used < DAILY_CREDITS, unlimited: false, left: DAILY_CREDITS - state.used, resetsAt } satisfies CreditsResponse,
    { headers: NO_STORE },
  );
}

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const runId = (body as { runId?: unknown } | null)?.runId;
  if (!isRunId(runId)) {
    return Response.json({ error: "runId no valido" }, { status: 400, headers: NO_STORE });
  }

  const now = new Date();
  const midnight = nextMadridMidnight(now);
  const resetsAt = midnight.toISOString();
  if (await signedIn()) {
    return Response.json({ ok: true, unlimited: true, left: DAILY_CREDITS, resetsAt } satisfies CreditsResponse, {
      headers: NO_STORE,
    });
  }

  const store = await cookies();
  const state = readCredits(store.get(CREDITS_COOKIE)?.value, now);

  // La misma partida ya se cobro: no se vuelve a gastar.
  if (state.lastRun === runId) {
    return Response.json(
      { ok: true, unlimited: false, left: DAILY_CREDITS - state.used, resetsAt } satisfies CreditsResponse,
      { headers: NO_STORE },
    );
  }
  if (state.used >= DAILY_CREDITS) {
    return Response.json({ ok: false, unlimited: false, left: 0, resetsAt } satisfies CreditsResponse, {
      headers: NO_STORE,
    });
  }

  const used = state.used + 1;
  store.set(CREDITS_COOKIE, signCredits({ day: state.day, used, lastRun: runId }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: midnight,
  });
  return Response.json({ ok: true, unlimited: false, left: DAILY_CREDITS - used, resetsAt } satisfies CreditsResponse, {
    headers: NO_STORE,
  });
}
