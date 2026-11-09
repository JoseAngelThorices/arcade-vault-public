// Refresco de la sesión de Supabase en cada petición (SPEC 13).
//
// Los Server Components no pueden escribir cookies, así que el token caducado
// se renueva aquí: el cliente lee las cookies de la petición y escribe las
// nuevas tanto en la petición (para el render de esta misma petición) como en
// la respuesta (para el navegador).
//
// La unica ruta que exige sesion es /acceso/nueva-clave (SPEC 14): sin ella,
// el enlace de recuperacion no era valido o ha caducado. Es una comprobacion
// optimista; la proteccion real de los datos es RLS en Supabase.
//
// Ademas pone la Content-Security-Policy con un nonce nuevo por peticion
// (SEC-03 del informe de seguridad). Next lee el nonce de la cabecera CSP de
// la peticion y lo pone en sus <script>; 'strict-dynamic' deja cargar los
// chunks que esos scripts piden. Con nonce no puede haber paginas estaticas:
// el layout raiz fuerza el renderizado dinamico con connection().

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** CSP de la app. Los estilos llevan 'unsafe-inline' por los atributos style de React. */
function contentSecurityPolicy(nonce: string, https: boolean): string {
  const isDev = process.env.NODE_ENV === "development";
  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  return [
    "default-src 'self'",
    // En desarrollo React usa eval para reconstruir las trazas de error.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    // next/font sirve las fuentes de Google desde el propio dominio.
    "font-src 'self'",
    `connect-src 'self' ${supabase} ${supabase.replace(/^http/, "ws")}`,
    "media-src 'self' blob: data:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    // Solo bajo https: sobre http (npm start en local o por la IP de la red)
    // subiria los chunks a https y la pagina no cargaria.
    ...(https ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const https =
    request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
  const csp = contentSecurityPolicy(nonce, https);

  // Sigue con la peticion (y las cookies que haya refrescado Supabase) mas el
  // nonce, y devuelve la CSP al navegador.
  const forward = () => {
    const headers = new Headers(request.headers);
    headers.set("x-nonce", nonce);
    headers.set("Content-Security-Policy", csp);
    const res = NextResponse.next({ request: { headers } });
    res.headers.set("Content-Security-Policy", csp);
    return res;
  };

  let response = forward();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = forward();
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Valida el JWT y, si ha caducado, lo refresca: eso dispara setAll.
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims && request.nextUrl.pathname === "/acceso/nueva-clave") {
    const url = request.nextUrl.clone();
    url.pathname = "/acceso";
    url.search = "?error=enlace";
    const redirect = NextResponse.redirect(url);
    // Conserva las cookies que haya escrito el refresco de sesion.
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }

  return response;
}

export const config = {
  matcher: [
    // Todo salvo los recursos de Next, el favicon y ficheros con extensión
    // (sprites y sonidos de public/games/).
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.[a-zA-Z0-9]+$).*)",
  ],
};
