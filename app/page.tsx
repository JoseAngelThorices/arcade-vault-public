// La home vive en /inicio. Esta raiz solo redirige alli para que nadie caiga
// en un 404 al entrar por la URL pelada.
//
// Es un redirect 307 (temporal) a proposito: si algun dia la landing vuelve a
// la raiz, un 308 se habria quedado cacheado en los navegadores.

import { redirect } from "next/navigation";

export default function Page() {
  redirect("/inicio");
}
