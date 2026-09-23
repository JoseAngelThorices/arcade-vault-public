// Cliente de Supabase para el navegador, para componentes "use client".
//
// Las dos variables llevan el prefijo NEXT_PUBLIC_: Next las incrusta en el
// bundle del cliente al compilar. Ver `specs/.env.template`.

import { createBrowserClient } from "@supabase/ssr";

export const createClient = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
