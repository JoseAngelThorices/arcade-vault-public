// Cliente de Supabase para el servidor: Server Components y Route Handlers.
//
// La sesión viaja en cookies, que se leen y escriben con `cookies()` de
// next/headers (asíncrono en Next 16). Cada petición crea su propio cliente:
// no se comparte entre peticiones.

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const createClient = async () => {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Llamado desde un Server Component: ahí las cookies son de solo
            // lectura. Se ignora; el refresco de sesión lo hará el proxy
            // cuando llegue el spec de Auth.
          }
        },
      },
    },
  );
};
