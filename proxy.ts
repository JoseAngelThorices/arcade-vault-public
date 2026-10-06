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

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
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
