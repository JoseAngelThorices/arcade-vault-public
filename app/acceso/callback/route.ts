// Callback de Supabase Auth (SPEC 13): un solo punto de entrada para OAuth,
// la confirmación de correo y la recuperación de contraseña.
//
//   ?code=…                  flujo PKCE (OAuth y enlaces de correo por defecto)
//   ?token_hash=…&type=…     plantillas de correo con token_hash; sirve aunque
//                            el enlace se abra en otro navegador
//   ?next=/ruta              destino tras crear la sesión (por defecto /juegos)
//
// Cualquier fallo vuelve a /acceso?error=enlace, que muestra el aviso.

import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const DEFAULT_NEXT = "/juegos";

const OTP_TYPES: readonly EmailOtpType[] = [
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
];

/** Solo rutas relativas del propio sitio: `//otro.com` o `https://…` no. */
function safeNext(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\")
    ? next
    : DEFAULT_NEXT;
}

function isOtpType(type: string | null): type is EmailOtpType {
  return OTP_TYPES.includes(type as EmailOtpType);
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = safeNext(searchParams.get("next"));

  // En un Route Handler las cookies se pueden escribir: la sesión queda guardada.
  const supabase = await createClient();
  let ok = false;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  } else if (tokenHash && isOtpType(type)) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    ok = !error;
  }

  return NextResponse.redirect(new URL(ok ? next : "/acceso?error=enlace", request.url));
}
