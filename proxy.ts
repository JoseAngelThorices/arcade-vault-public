// Refresco de la sesión de Supabase en cada petición (SPEC 13).
//
// Los Server Components no pueden escribir cookies, así que el token caducado
// se renueva aquí: el cliente lee las cookies de la petición y escribe las
// nuevas tanto en la petición (para el render de esta misma petición) como en
// la respuesta (para el navegador). No protege rutas: nunca redirige.

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
  await supabase.auth.getClaims();

  return response;
}

export const config = {
  matcher: [
    // Todo salvo los recursos de Next, el favicon y ficheros con extensión
    // (sprites y sonidos de public/games/).
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.[a-zA-Z0-9]+$).*)",
  ],
};
