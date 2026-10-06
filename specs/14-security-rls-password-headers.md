# SPEC 14 — Seguridad: puntuaciones solo con cuenta, contraseña robusta y headers HTTP

> **Estado:** Implementado
> **Depende de:** 04-integracion-de-supabase · 06-games-table-leaderboard-supabase · 13-supabase-auth
> **Fecha:** 2026-10-06
> **Objetivo:** Aplicar el checklist de `references/security/checklist.md`: solo los
> usuarios autenticados guardan puntuaciones (y siempre a su nombre), la contraseña
> exige la misma política en el cliente que en Supabase Auth, se resuelven los avisos
> del asesor de seguridad de Supabase, Next.js envía headers de seguridad y el proxy
> protege la ruta de contraseña nueva.

---

## Punto de partida (verificado el 2026-10-06)

| Punto del checklist | Estado |
|---|---|
| RLS en `games` y `scores` | Ya activo. `games`: SELECT público. `scores`: SELECT público e INSERT `"scores: inserción pública"` para `anon, authenticated` con `user_id is null or user_id = auth.uid()` |
| Contraseña mínima 8 | Ya configurado en Supabase Auth (8 caracteres + minúsculas, mayúsculas, dígitos y símbolos). El código sigue con `PASSWORD_MIN = 6` (`components/auth-form.tsx:20`, `components/new-password-form.tsx:12`) |
| Leaked password protection | Desactivado. **No disponible:** es del plan Pro y el proyecto está en Free |
| Max signup rate | Sin revisar (no se ve por MCP) |
| Headers de seguridad | `next.config.ts` no define `headers` |
| Asesor: `rls_auto_enable()` | `anon` y `authenticated` tienen `EXECUTE` (avisos 0028 y 0029) |

Datos en `scores`: 12 filas, 11 de invitados (`user_id is null`), ninguna con
`score < 0` ni con `player_name` fuera de 1–10 caracteres.

---

## Alcance

**Entra:**

- **Supabase (migración vía MCP):** sustituir la política de INSERT de `scores` por una
  solo para `authenticated` con `user_id = auth.uid()`; quitar `INSERT` a `anon`;
  restricciones `CHECK` en `score` y `player_name`; trigger que fija `player_name` al
  alias de la cuenta; revocar `EXECUTE` de `rls_auto_enable()`.
- **Supabase Auth (Dashboard, manual):** límite de registros e inicios de sesión por IP.
- `lib/password.ts` (nuevo): política de contraseña compartida (regex + mensaje).
- `components/auth-form.tsx` y `components/new-password-form.tsx`: validar con esa
  política antes de llamar a Supabase y traducir `weak_password` con los requisitos
  reales.
- Reproductores `components/{asteroids,tetris,arkanoid,snake,frogger}-player.tsx`:
  sin sesión, el modal de fin de partida invita a iniciar sesión en lugar de guardar;
  con sesión, el nombre es el alias de la cuenta y no se edita.
- `lib/player-name.ts`: se elimina (ya no hay nombre libre que recordar).
- `next.config.ts`: headers de seguridad en todas las rutas.
- `proxy.ts`: sin sesión, `/acceso/nueva-clave` redirige a `/acceso?error=enlace`.
- `CLAUDE.md`: actualizar RLS, proxy y localStorage.

**Fuera:**

- Validar que una puntuación sea **legítima** (que salga de una partida real). Los
  juegos corren en el navegador, así que un usuario autenticado puede llamar a la API
  con cualquier `score`. Evitarlo exige validar la partida en el servidor (replay,
  firma de sesión de juego…): queda para un spec futuro. Este spec garantiza quién
  firma cada puntuación, no que sea real. Ver "Pendiente".
- Leaked password protection (plan Pro). Alternativa gratuita en "Pendiente".
- Content-Security-Policy y HSTS: necesitan inventariar orígenes externos (Supabase,
  Resend, Google Fonts) y HSTS es difícil de revertir en el dominio. Spec propio;
  enfoque en "Pendiente".
- Conservar la puntuación de una partida jugada sin sesión tras iniciar sesión: se
  pierde. El aviso aparece solo al final de la partida, no antes de jugar.
- Borrar o reasignar las 11 puntuaciones históricas de invitados: siguen visibles.
- CAPTCHA en registro.
- Edición de perfil / cambio de alias.

---

## Modelo de datos

No se crean tablas. Cambios sobre `public.scores`:

### Políticas RLS

| Operación | Rol | Condición |
|---|---|---|
| SELECT | anon, authenticated | `true` (sin cambios) |
| INSERT | authenticated | `user_id = (select auth.uid())` |

`user_id is null` deja de ser válido en el INSERT (`null = uid` no es cierto), así que
un invitado o una petición sin JWT no puede insertar. Sin políticas de UPDATE/DELETE
(sin cambios). `games` no cambia.

### Restricciones

- `scores_score_non_negative`: `CHECK (score >= 0)`.
- `scores_player_name_length`: `CHECK (char_length(player_name) between 1 and 10)`
  (el mismo límite que `normalizeName`).

### Trigger `scores_set_player_name`

`BEFORE INSERT` sobre `scores`: sobrescribe `player_name` con el alias derivado del
JWT, con la misma prioridad que `lib/session.tsx` (`username`, `user_name`,
`full_name`, `name`, parte local del correo), en mayúsculas y cortado a 10. Así nadie
firma con un nombre que no es el suyo aunque llame a la API a mano.

### Función `rls_auto_enable()`

**Se conserva.** La usa el event trigger `ensure_rls` (`ddl_command_end`) para activar
RLS en toda tabla nueva de `public`; un `DROP` fallaría por la dependencia y con
`CASCADE` se perdería esa protección. Se revoca `EXECUTE` a `PUBLIC`, `anon` y
`authenticated`, lo que cierra los dos avisos del asesor (el event trigger se ejecuta
igual).

### Política de contraseña (frontend)

Igual que la configurada en Supabase Auth: mínimo 8 caracteres, con al menos una
minúscula, una mayúscula, un dígito y un símbolo **de la lista de Supabase**
(`` !@#$%^&*()_+-=[]{};'\:"|<>?,./`~ ``). No vale `[^A-Za-z\d]`: aceptaría `ñ`, `é` o
un espacio como símbolo y Supabase rechazaría después la contraseña.

```ts
const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};'\\:"|<>?,./`~]).{8,}$/;
```

---

## Plan de implementación

1. **Migración en Supabase** (`apply_migration`, nombre `scores_authenticated_only`)

   ```sql
   -- INSERT solo con cuenta y a nombre propio
   DROP POLICY "scores: inserción pública" ON public.scores;
   CREATE POLICY "scores: inserción del propio usuario"
     ON public.scores FOR INSERT
     TO authenticated
     WITH CHECK (user_id = (select auth.uid()));
   REVOKE INSERT ON public.scores FROM anon;

   -- Valores imposibles
   ALTER TABLE public.scores
     ADD CONSTRAINT scores_score_non_negative CHECK (score >= 0),
     ADD CONSTRAINT scores_player_name_length CHECK (char_length(player_name) BETWEEN 1 AND 10);

   -- El nombre firmado es siempre el alias de la cuenta
   CREATE FUNCTION public.scores_set_player_name()
   RETURNS trigger
   LANGUAGE plpgsql
   SET search_path = ''
   AS $$
   DECLARE
     meta jsonb := auth.jwt() -> 'user_metadata';
   BEGIN
     NEW.player_name := upper(left(trim(coalesce(
       nullif(meta ->> 'username', ''),
       nullif(meta ->> 'user_name', ''),
       nullif(meta ->> 'full_name', ''),
       nullif(meta ->> 'name', ''),
       nullif(split_part(auth.jwt() ->> 'email', '@', 1), ''),
       'PLAYER'
     )), 10));
     RETURN NEW;
   END;
   $$;
   REVOKE EXECUTE ON FUNCTION public.scores_set_player_name() FROM PUBLIC, anon, authenticated;

   CREATE TRIGGER scores_set_player_name
     BEFORE INSERT ON public.scores
     FOR EACH ROW EXECUTE FUNCTION public.scores_set_player_name();

   -- Avisos 0028/0029 del asesor
   REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
   ```

   Verificación:
   - `get_advisors(security)` ya no muestra `rls_auto_enable` (queda solo el aviso de
     leaked password, aceptado).
   - Como `anon`: `INSERT` en `scores` → error de permisos/RLS.
   - Como `authenticated` con `user_id` de otro usuario o `null` → error de RLS.
   - Como `authenticated` con su `user_id` y `player_name = 'OTRO'` → la fila queda
     con su alias.
   - `score = -1` → viola `scores_score_non_negative`.

2. **Supabase Auth (Dashboard, manual)**
   - Authentication → Rate Limits → *sign-ups and sign-ins*: bajar el límite por IP
     (por defecto 30 cada 5 minutos) a un valor razonable para un arcade, p. ej. 10.
   - Confirmar que siguen puestos los 8 caracteres y "Lowercase, uppercase letters,
     digits and symbols".
   - Leaked password protection: no se activa (plan Free). Se anota en `Decisiones`.

   Verificación: el panel muestra los valores; el asesor solo marca leaked password.

3. **Política de contraseña en los formularios**
   - `lib/password.ts`: exporta `PASSWORD_MIN = 8`, `PASSWORD_REGEX`,
     `PASSWORD_RULES` (el texto: _"La contraseña debe tener mínimo 8 caracteres e
     incluir mayúsculas, minúsculas, números y símbolos (!@#$%…)."_) e
     `isStrongPassword(pw)`.
   - `components/auth-form.tsx` (registro) y `components/new-password-form.tsx`:
     sustituir la comprobación de longitud por `isStrongPassword`; si falla, error
     inline con `PASSWORD_RULES` y no se llama a Supabase. El mensaje de
     `weak_password` pasa a ser también `PASSWORD_RULES`.
   - El login no valida la política (delega en Supabase).

   Verificación: `abc` y `Contraseña1` → error inline sin petición de red;
   `Abc123!@` → se envía.

4. **Reproductores: guardar solo con sesión** (los cinco `*-player.tsx`)
   - Con sesión: el modal muestra el alias como texto fijo (no `input`) y el botón
     GUARDAR PUNTUACIÓN; el `insert` envía `user_id: user.id` y `player_name: username`.
   - Sin sesión: en lugar del campo y el botón, un aviso
     _"Inicia sesión para guardar tu puntuación en la clasificación."_ con un enlace
     INICIAR SESIÓN a `/acceso`.
   - Mientras `ready` es `false`, no se muestra ninguna de las dos variantes de
     guardado (evita parpadeo).
   - Se quitan `readPlayerName`/`writePlayerName`, el estado `name` y se elimina
     `lib/player-name.ts`. `saveScore` (registro local `av_scores`) se mantiene.

   Verificación: sin sesión, terminar partida → aviso y enlace; con sesión → guarda y
   aparece en `/juego/<id>` con el alias.

5. **Headers de seguridad** (`next.config.ts`)

   ```ts
   const securityHeaders = [
     { key: "X-Content-Type-Options", value: "nosniff" },
     { key: "X-Frame-Options", value: "DENY" },
     { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
     { key: "X-DNS-Prefetch-Control", value: "off" },
   ];

   // dentro de nextConfig
   headers: async () => [{ source: "/(.*)", headers: securityHeaders }],
   ```

   Sin tocar `allowedDevOrigins`. Leer antes la guía de `headers` en
   `node_modules/next/dist/docs/`.

   Verificación: `curl -I http://localhost:3000/inicio` muestra los cuatro headers.

6. **Proteger `/acceso/nueva-clave` en `proxy.ts`**
   - Tras `getClaims()`, si no hay claims y la ruta es `/acceso/nueva-clave`,
     redirigir a `/acceso?error=enlace` copiando las cookies de `response` en la
     redirección (para no perder un refresco de sesión).
   - Es la única ruta que necesita sesión: biblioteca, detalle, reproductores, salón
     y acerca de son públicos; `/acceso` ya muestra la cuenta si hay sesión. La rama
     "sin sesión" de `NewPasswordForm` se mantiene como respaldo.
   - Leer antes `node_modules/next/dist/docs/01-app/01-getting-started/proxy.md`.
   - Actualizar el comentario de cabecera de `proxy.ts` ("No protege rutas").

   Verificación: en ventana privada, `/acceso/nueva-clave` → `/acceso?error=enlace`
   con el mensaje de enlace caducado; el flujo de recuperación por correo sigue
   llegando al formulario.

7. **Documentación y verificación final**
   - `CLAUDE.md`: RLS de `scores` (solo `authenticated`, trigger de alias, `CHECK`),
     `proxy.ts` protege `/acceso/nueva-clave`, fuera `av_player_name`, tabla de specs.
   - `npm run lint`, `npx tsc --noEmit`, `npm run build` sin errores.

---

## Criterios de aceptación

- [x] Un invitado (rol `anon`) no puede insertar en `scores`.
- [x] Un usuario autenticado solo inserta con `user_id = auth.uid()`; `null` u otro
      `user_id` se rechazan.
- [x] `player_name` de una fila nueva es siempre el alias de la cuenta.
- [x] `score < 0` y nombres fuera de 1–10 caracteres se rechazan.
- [x] `games` sigue sin ninguna escritura posible desde el cliente.
- [x] El asesor de seguridad no muestra avisos de `rls_auto_enable()`, y el event
      trigger `ensure_rls` sigue existiendo.
- [x] Rate limit de sign-ups/sign-ins configurado en el Dashboard.
- [x] Registro y contraseña nueva rechazan en el cliente lo que Supabase rechazaría
      (incluido `Contraseña1`), sin petición de red; `Abc123!@` pasa.
- [x] Sin sesión, el fin de partida invita a iniciar sesión y no ofrece guardar.
- [x] Con sesión, se guarda con el alias fijo y aparece en la clasificación.
- [x] Las respuestas HTTP llevan `X-Content-Type-Options`, `X-Frame-Options`,
      `Referrer-Policy` y `X-DNS-Prefetch-Control`.
- [x] `/acceso/nueva-clave` sin sesión redirige a `/acceso?error=enlace`.
- [x] Lint, tipos y build sin errores.

---

## Decisiones

- **Puntuaciones solo con cuenta.** Se cierra el INSERT de invitados: cualquiera podía
  publicar cualquier puntuación con cualquier nombre. Las 11 filas históricas de
  invitados se conservan.
- **El nombre lo pone la base de datos, no el cliente.** El trigger fija
  `player_name` desde el JWT; la UI solo lo muestra. Limitación: el usuario puede
  cambiar su `user_metadata.username` con `updateUser`, así que el alias es suyo pero
  no único. La unicidad llegará con una tabla `profiles`.
- **No se valida la legitimidad del `score`.** Ver "Fuera".
- **`rls_auto_enable()` se conserva y se le quita `EXECUTE`**, en lugar del `DROP`
  del borrador anterior: el `DROP` rompía (o, con `CASCADE`, eliminaba) el event
  trigger que activa RLS en tablas nuevas.
- **Leaked password protection no se activa:** requiere plan Pro.
- **Rate limit de sign-ups y sign-ins: 10 por IP cada 5 minutos** (por defecto 30),
  configurado en el Dashboard el 2026-10-06.
- **El regex usa la lista de símbolos de Supabase**, no "cualquier no alfanumérico",
  para que cliente y servidor acepten exactamente lo mismo.
- **La validación se aplica también a la contraseña nueva** (recuperación), no solo al
  registro: Supabase exige la misma política en `updateUser`.
- **Proxy: solo `/acceso/nueva-clave`.** No hay más páginas privadas; la protección real
  de los datos es RLS, no el proxy.
- **CSP y HSTS fuera** (spec propio).

---

## Riesgos

- **Usuarios con contraseñas antiguas de 6–7 caracteres:** pueden seguir entrando
  (el login no valida la política); se les exigirá la nueva al cambiarla.
- **Partida sin sesión:** la puntuación se pierde al ir a iniciar sesión. Aceptado.
- **`X-Frame-Options: DENY`:** impide incrustar la app en iframes, también en
  herramientas de vista previa. Aceptado.
- **Trigger y `auth.jwt()`:** si en el futuro se inserta en `scores` desde el
  servidor con la clave de servicio, `auth.jwt()` será `null` y el nombre quedará
  `PLAYER`. Hoy no hay inserciones desde servidor.

---

## Pendiente

Lo que este spec deja abierto, con el enfoque previsto para cada punto. Nada de esto
está implementado.

### 1. Content-Security-Policy y HSTS

Es lo siguiente que conviene hacer: protege bastante y es concreto. Necesita su propio
spec porque, si la CSP sale mal, rompe la app sin avisar (scripts bloqueados, React
sin hidratar).

- **Orígenes a permitir:** Supabase (`connect-src` para REST y Auth; `wss://` solo si
  algún día se usa Realtime, hoy no) y nada más en el navegador. Resend solo se llama
  desde el servidor y Google Fonts se autoaloja con `next/font`, así que no necesitan entrada.
- **Scripts inline de Next:** la CSP necesita un `nonce` por petición generado en
  `proxy.ts` (ver la guía de CSP en `node_modules/next/dist/docs/`).
- **Despliegue gradual:** primero `Content-Security-Policy-Report-Only`; se pasa a
  `Content-Security-Policy` cuando no haya violaciones.
- **HSTS:** solo tiene efecto en producción con HTTPS. Empezar con un `max-age` corto
  y sin `preload`, que es difícil de revertir en el dominio.

### 2. Contraseñas filtradas

Leaked password protection de Supabase es del plan Pro. Alternativa gratuita: consultar
la API de rangos de Have I Been Pwned con k-anonimato (solo se envían los 5 primeros
caracteres del hash SHA-1, nunca la contraseña).

- Iría en `lib/password.ts`, junto a la política actual, y se aplicaría en el registro
  y en la contraseña nueva.
- **Limitación:** se comprueba en la app, no en Supabase Auth, así que quien llame
  directamente a la API de Auth se la salta. Cubre el uso normal de la web.
- Es un cambio pequeño: puede hacerse sin spec propio, anotándolo en `Decisiones`.

### 3. Puntuaciones inventadas

Un usuario con cuenta puede enviar a mano la cifra que quiera, porque los juegos corren
en el navegador. Hay dos niveles de solución:

- **Validación real:** que el servidor vuelva a jugar la partida a partir de las teclas
  pulsadas y una semilla. Supone tocar los motores de los cinco juegos.
- **Mitigación barata:** una Edge Function que firme el inicio de cada partida y
  rechace puntuaciones imposibles para el tiempo jugado, más un límite de envíos por
  usuario. No elimina el fraude, pero sí que sea trivial.

Queda para cuando la clasificación importe de verdad; necesitaría spec propio.
