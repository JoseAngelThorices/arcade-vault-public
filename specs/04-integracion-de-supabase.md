# SPEC 04 — Integración de Supabase

> **Estado:** Aprobado
> **Depende de:** SPEC 03
> **Fecha:** 2026-09-23
> **Objetivo:** Instalar y configurar el cliente de Supabase (navegador + servidor) como
> infraestructura base para specs futuros de autenticación, base de datos y tiempo real.

---

## Alcance

**Entra:**

- Instalar `@supabase/supabase-js` y `@supabase/ssr`.
- Crear `lib/supabase/client.ts` — cliente de navegador para componentes `"use client"`.
- Crear `lib/supabase/server.ts` — cliente de servidor para Server Components y Route Handlers.
- Añadir `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` a `specs/.env.template`
  y a `.env.local` (raíz del proyecto) como valores vacíos (el desarrollador los rellena a mano).

**Fuera de alcance (para specs futuros):**

- Creación de tablas o esquema en Supabase.
- Conectar la pantalla `/acceso` existente con Supabase Auth.
- Cualquier uso real del cliente en componentes o páginas existentes.
- Tiempo real (Realtime), Edge Functions y Storage — quedan para specs futuros.
- `SUPABASE_SERVICE_ROLE_KEY` — se añadirá cuando un spec lo requiera.

---

## Modelo de datos

No se introduce ningún modelo de datos persistente en este spec. Los clientes de Supabase
son utilidades de configuración, no estructuras de datos.

---

## Plan de implementación

1. **Instalar dependencias** — `npm install @supabase/supabase-js @supabase/ssr`.
   Verificación: ambos paquetes aparecen en `dependencies` de `package.json`.

2. **Añadir variables de entorno** — añadir a `.env.local` (raíz del proyecto) y a
   `specs/.env.template` (la plantilla existente de SPEC 03; no crear otra en la raíz):

   ```
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
   ```

   Verificación: ambos archivos contienen las dos claves (vacías en `.env.local`,
   con un comentario que las explique en `specs/.env.template`).

3. **Crear `lib/supabase/client.ts`** — cliente de navegador con `createBrowserClient`
   de `@supabase/ssr`:

   ```ts
   import { createBrowserClient } from '@supabase/ssr';

   export const createClient = () =>
     createBrowserClient(
       process.env.NEXT_PUBLIC_SUPABASE_URL!,
       process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
     );
   ```

   Verificación: el archivo existe y TypeScript no reporta errores.

4. **Crear `lib/supabase/server.ts`** — cliente de servidor con `createServerClient`
   de `@supabase/ssr`, leyendo y escribiendo cookies vía `next/headers`:

   ```ts
   import { createServerClient } from '@supabase/ssr';
   import { cookies } from 'next/headers';

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
   ```

   `setAll` va envuelto en `try/catch` porque en Next 16 `cookieStore.set()` solo está
   permitido en Server Actions y Route Handlers; en un Server Component lanza una excepción.

   Verificación: el archivo existe y TypeScript no reporta errores.

5. **Verificación final** — `npm run build` termina sin errores
   de compilación ni de tipos relacionados con los nuevos archivos.

---

## Criterios de aceptación

- [ ] `@supabase/supabase-js` y `@supabase/ssr` aparecen en `dependencies` de `package.json`.
- [ ] `.env.local` contiene `NEXT_PUBLIC_SUPABASE_URL=` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=`.
- [ ] `specs/.env.template` contiene las mismas dos claves, vacías y con un comentario que las explique.
- [ ] No existe un `.env.template` nuevo en la raíz del proyecto.
- [ ] `lib/supabase/client.ts` existe y exporta `createClient` usando `createBrowserClient`.
- [ ] `lib/supabase/server.ts` existe y exporta `createClient` async usando `createServerClient`.
- [ ] En `lib/supabase/server.ts`, el cuerpo de `setAll` está envuelto en `try/catch`.
- [ ] `npm run build` completa sin errores de TypeScript relacionados con los nuevos archivos.
- [ ] Ninguna página o componente existente se rompe tras la integración.

---

## Decisiones

- **Sí:** `@supabase/ssr` en lugar de instanciar `createClient` de `@supabase/supabase-js`
  directamente. El paquete `@supabase/ssr` maneja cookies y sesión correctamente en Next.js App Router;
  usar el cliente básico requeriría refactorizar cuando llegue el spec de Auth.

- **Sí:** Dos archivos separados (`client.ts` y `server.ts`) en lugar de uno universal.
  Next.js App Router tiene contextos de ejecución distintos (navegador y servidor); un solo
  cliente que intente cubrir ambos rompe en uno de los dos contextos.

- **Sí:** `try/catch` en `setAll` del cliente de servidor. Es el patrón de la plantilla oficial
  de Supabase: sin él, el primer refresco de sesión dentro de un Server Component rompe
  la página en cuanto llegue el spec de Auth.

- **Sí:** `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` en lugar de `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
  Es el nombre de las claves publicables actuales de Supabase (`sb_publishable_…`), que
  sustituyen a la clave `anon` antigua.

- **No:** `SUPABASE_SERVICE_ROLE_KEY` en este spec. Solo se añade cuando un spec concreto
  lo requiera; incluirla ahora sería infraestructura sin uso.

- **No:** Crear tablas o esquema en Supabase. El objetivo de este spec es únicamente la
  conexión base; el modelo de datos se define spec a spec según la funcionalidad.

- **No:** Conectar `/acceso` en este spec. La autenticación real merece su propio spec con
  flujo, estados de error y redirecciones definidos explícitamente.
