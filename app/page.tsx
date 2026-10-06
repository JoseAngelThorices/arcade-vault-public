// La home vive en /inicio. Esta raiz solo redirige alli para que nadie caiga
// en un 404 al entrar por la URL pelada.
//
// Es un redirect 307 (temporal) a proposito: si algun dia la landing vuelve a
// la raiz, un 308 se habria quedado cacheado en los navegadores.
//
// Excepcion: los enlaces de correo de Supabase. Sin Redirect URLs configuradas,
// Supabase los manda a la Site URL (esta raiz) con `?code=…`, o con `?error=…`
// si el enlace caduco. Se reenvian al callback de acceso para no perderlos.

import { redirect } from "next/navigation";

export default async function Page({ searchParams }: PageProps<"/">) {
  const { code, error } = await searchParams;

  if (typeof code === "string" && code) {
    redirect(`/acceso/callback?code=${encodeURIComponent(code)}`);
  }
  if (error) redirect("/acceso?error=enlace");

  redirect("/inicio");
}
