// Callback de Supabase Auth (SPEC 13): un solo punto de entrada para
// la confirmación de correo y la recuperación de contraseña.
//
//   ?code=…                  flujo PKCE (enlaces de correo por defecto)
//   ?token_hash=…&type=…     plantillas de correo con token_hash; sirve aunque
//                            el enlace se abra en otro navegador
//   ?next=/ruta              destino tras crear la sesión
//
// Sin Redirect URLs configuradas en Supabase, los enlaces de correo caen en la
// Site URL (`/?code=…`) sin `next`; la raíz los reenvía aquí. En ese caso el
// destino sale de cómo se creó la sesión: si fue un enlace de recuperación
// (método `recovery` en el claim `amr`), a /acceso/nueva-clave; si no, a /juegos.
//
// Cualquier fallo vuelve a /acceso?error=enlace, que muestra el aviso.

import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const DEFAULT_NEXT = "/juegos";
const RECOVERY_NEXT = "/acceso/nueva-clave";

const OTP_TYPES: readonly EmailOtpType[] = [
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
];

/** Solo rutas relativas del propio sitio: `//otro.com` o `https://…` no. */
function safeNext(next: string | null): string | null {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\")
    ? next
    : null;
}

/** El claim `amr` viene como lista de métodos o de objetos `{ method, timestamp }`. */
function isRecovery(amr: unknown): boolean {
  return (
    Array.isArray(amr) &&
    amr.some((entry) => (typeof entry === "string" ? entry : entry?.method) === "recovery")
  );
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
  let accessToken: string | null = null;

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) accessToken = data.session.access_token;
  } else if (tokenHash && isOtpType(type)) {
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) accessToken = data.session?.access_token ?? null;
  }

  if (!accessToken) {
    return NextResponse.redirect(new URL("/acceso?error=enlace", request.url));
  }

  let destination = next;
  if (!destination) {
    const { data } = await supabase.auth.getClaims(accessToken);
    destination = type === "recovery" || isRecovery(data?.claims.amr) ? RECOVERY_NEXT : DEFAULT_NEXT;
  }

  return NextResponse.redirect(new URL(destination, request.url));
}
