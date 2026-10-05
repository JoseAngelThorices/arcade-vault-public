# SPEC 13 — Autenticación con Supabase Auth

> **Estado:** Borrador
> **Depende de:** 04-integracion-de-supabase · 06-games-table-leaderboard-supabase
> **Fecha:** 2026-10-05
> **Objetivo:** Conectar la pantalla de acceso existente (`/acceso`) con Supabase Auth
> (correo + contraseña, OAuth con Google y GitHub), sustituir la sesión falsa `av_user`
> de `lib/session.tsx` por el usuario real de Supabase y añadir los flujos de
> verificación de correo y recuperación de contraseña. Las puntuaciones guardadas por
> usuarios autenticados pasan a llevar su `user_id`.

---

## Alcance

**Entra:**

- `lib/session.tsx` — migración del contexto: `SessionProvider`/`useSession` exponen el
  `User` y la `Session` de Supabase en lugar de `{ name }` de localStorage. Se conservan
  el nombre del hook, `ready`, `saveScore` y `bestScoreFor` (registro local `av_scores`).
- `proxy.ts` (nuevo, raíz del repo) — refresca las cookies de sesión de Supabase en cada
  petición. No protege rutas.
- `app/acceso/callback/route.ts` (nuevo) — Route Handler que convierte el `code` (OAuth y
  enlaces de correo) o el `token_hash` en una sesión y redirige.
- `app/acceso/nueva-clave/page.tsx` (nuevo) — formulario para fijar la contraseña nueva
  tras pulsar el enlace de recuperación.
- `components/auth-form.tsx` y `app/acceso/page.tsx` — los formularios de iniciar sesión,
  crear cuenta y "¿olvidaste tu contraseña?" llaman a Supabase Auth. Se conserva el
  layout del prototipo; cambian la lógica, el campo de usuario del login (pasa a ser
  correo) y los mensajes inline. Con sesión activa, `/acceso` muestra el estado de la
  cuenta y "CERRAR SESIÓN".
- `components/nav.tsx` — con sesión: avatar con la inicial, alias y botón
  "CERRAR SESIÓN" (escritorio y panel móvil). Sin sesión: el enlace "Iniciar Sesión"
  actual.
- Reproductores `components/{asteroids,tetris,arkanoid,snake,frogger}-player.tsx` —
  el nombre del modal de fin de partida se pre-rellena con el alias del usuario
  autenticado y el `insert` en `scores` envía `user_id`. `components/player.tsx`
  (reproductor estático, no escribe en Supabase) solo se adapta al nuevo contexto.
- `app/globals.css` — estilos de mensajes del formulario, vista de confirmación y avatar
  del nav; se elimina `.auth-guest`.
- Configuración de Supabase (dashboard, manual): proveedores Email, Google y GitHub y
  URLs de redirección.
- `CLAUDE.md` y `lib/supabase/types.ts` — documentar el nuevo modelo de sesión.

**Fuera:**

- Cambios en las políticas RLS de `scores` (ya activas y abiertas desde SPEC 06) y FK de
  `scores.user_id` hacia `auth.users` — quedan para un spec de seguridad.
- Edición de perfil (cambiar alias, avatar real, correo) — spec futuro.
- Gestión de sesiones múltiples / dispositivos.
- Protección de rutas: todas siguen accesibles sin sesión. `proxy.ts` solo refresca
  la sesión.
- Magic link y OTP por SMS.
- Pasar el usuario desde el servidor al primer render (evitar el parpadeo
  "sin sesión → con sesión" al hidratar): se mantiene el comportamiento actual.
- Migrar el registro local `av_scores` a Supabase: "TU MEJOR MARCA" del salón sigue
  siendo local.

---

## Modelo de datos

No se crean tablas ni se cambia el esquema. Estado actual verificado (2026-10-05):
`scores` tiene RLS con `SELECT` e `INSERT` abiertos a `anon` y `authenticated`; sus
únicas restricciones son la PK y la FK `game_id → games(id)`; `user_id` es `uuid`
nullable sin FK.

### `scores.user_id`

Se empieza a poblar con `user.id` al guardar una puntuación con sesión activa; los
invitados siguen guardando `null`. El comentario de `ScoreRow.user_id` en
`lib/supabase/types.ts` pasa de "siempre null" a "id de `auth.users` si la partida se
guardó con sesión; null para invitados".

### `useSession()` — nueva forma

```ts
import type { Session as AuthSession, User } from "@supabase/supabase-js";

export type Session = {
  user: User | null;
  session: AuthSession | null;
  /** Alias normalizado (mayúsculas, 10 caracteres); null sin sesión. */
  username: string | null;
  /** false en servidor y hasta recibir INITIAL_SESSION de Supabase. */
  ready: boolean;
  signOut: () => Promise<void>;
  saveScore: (entry: Omit<ScoreEntry, "at">) => void;
  bestScoreFor: (gameId: string) => ScoreEntry | null;
};
```

- Desaparece `signIn`: el acceso lo gestiona Supabase desde `auth-form.tsx`.
- La clave `av_user` se elimina del código; la sesión vive en las cookies de
  `@supabase/ssr`. `av_scores` y `av_player_name` se mantienen.
- `username` se deriva siempre que haya usuario, para que los usuarios de OAuth
  (sin alias propio) también tengan uno:
  `user_metadata.username ?? user_metadata.user_name (GitHub) ?? user_metadata.full_name ?? user_metadata.name ?? parte local del email`,
  pasado por `normalizeName`.

### `user_metadata` al registrarse

```ts
supabase.auth.signUp({
  email,
  password,
  options: {
    data: { username: normalizeName(alias.trim()) },
    emailRedirectTo: `${location.origin}/acceso/callback?next=/juegos`,
  },
});
```

---

## Plan de implementación

1. **Configurar Supabase (manual, en el dashboard)**
   - Authentication → Providers → Email: activado, "Confirm email" ON.
   - Google y GitHub: crear las apps OAuth con callback
     `https://<project-ref>.supabase.co/auth/v1/callback`, activar ambos proveedores y
     pegar Client ID y Secret.
   - Authentication → URL Configuration → Site URL: `http://localhost:3000`.
     Redirect URLs: `http://localhost:3000/**` y `http://192.168.0.*:3000/**` (el
     servidor de desarrollo se abre desde la LAN). En producción, añadir el dominio real.
   - Verificación: los tres proveedores aparecen como "Enabled".

2. **`proxy.ts` de refresco de sesión**
   Leer antes `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`.
   Crea un `createServerClient` sobre las cookies de `request`/`response` y llama a
   `supabase.auth.getClaims()` para que caduque o refresque el token. `matcher` que
   excluya `_next/static`, `_next/image`, `favicon.ico` y ficheros con extensión
   (sprites de `public/games/`). Nunca redirige. Actualizar el comentario del `catch`
   de `lib/supabase/server.ts`, que hoy dice que el proxy llegará con este spec.
   Verificación: `npm run build` lista el proxy; las páginas siguen cargando sin sesión.

3. **Migrar `lib/session.tsx`**
   - Quitar `USER_KEY`, `getUserSnapshot`, `signIn` y la cabecera que dice que no hay
     backend.
   - `user`/`session`/`ready` en estado de React, alimentados por
     `supabase.auth.onAuthStateChange` (su primer evento, `INITIAL_SESSION`, hidrata el
     estado inicial y pone `ready = true`); desuscribir al desmontar. Un solo cliente
     del navegador por provider.
   - `username` derivado como se describe en el modelo de datos.
   - `signOut` llama a `supabase.auth.signOut()` y después a `router.refresh()`.
   - `av_scores` sigue con `useSyncExternalStore` como ahora.
   - Ajustar `lib/player-name.ts` (su comentario cita `av_user`).
   Verificación: `useSession().user` es el `User` tras iniciar sesión y `null` tras
   cerrarla; `grep -rn av_user app components lib` no devuelve nada.

4. **`app/acceso/callback/route.ts`**
   `GET` que lee `code`, `token_hash`, `type` y `next` de los search params:
   - con `code` → `exchangeCodeForSession(code)` (OAuth y enlaces de correo PKCE);
   - con `token_hash` + `type` → `verifyOtp({ token_hash, type })`;
   - `next` solo se acepta si es una ruta relativa (empieza por `/` y no por `//`);
     por defecto `/juegos`;
   - si falta todo o Supabase devuelve error → redirige a `/acceso?error=enlace`.
   Usa el cliente de `lib/supabase/server.ts` (en un Route Handler las cookies se
   pueden escribir).
   Verificación: el enlace del correo de confirmación lleva a `/juegos` con sesión.

5. **`components/auth-form.tsx` + `app/acceso/page.tsx`**
   - Las pestañas siguen siendo radios + CSS. Los inputs siguen sin atributo `name`, para
     que un envío antes de hidratar no ponga la contraseña en la URL.
   - **INICIAR SESIÓN**: el campo "Usuario" pasa a "Correo electrónico" (`type="email"`).
     `signInWithPassword({ email, password })`; error → mensaje inline
     (`role="alert"`); éxito → `router.push("/juegos")` + `router.refresh()`.
   - **CREAR CUENTA**: validación en cliente antes de llamar a Supabase (alias no vacío,
     contraseña de 6 caracteres como mínimo, "Repítela" igual, casilla de normas
     marcada). `signUp` como en el modelo de datos. Error → mensaje inline. Éxito sin
     sesión → la tarjeta muestra "REVISA TU CORREO para confirmar tu cuenta" sin
     redirigir. Si Supabase devolviera sesión (confirmación desactivada) → igual que el
     login.
   - **¿Olvidaste tu contraseña?**: botón bajo el formulario de login que muestra un
     mini-formulario de correo y llama a
     `resetPasswordForEmail(email, { redirectTo: `${location.origin}/acceso/callback?next=/acceso/nueva-clave` })`.
     Éxito → "Te hemos enviado un enlace de recuperación" (también si el correo no
     existe: no se revela qué cuentas hay).
   - **GOOGLE / GITHUB**: `signInWithOAuth({ provider, options: { redirectTo: `${location.origin}/acceso/callback?next=/juegos` } })`.
   - Errores de Supabase traducidos al español por `code`
     (`invalid_credentials`, `email_not_confirmed`, `user_already_exists`,
     `weak_password`, `over_email_send_rate_limit`) con un mensaje genérico por defecto.
     `/acceso?error=enlace` muestra "El enlace no es válido o ha caducado".
   - Eliminar "JUGAR COMO INVITADO" y su clase `.auth-guest`; actualizar la
     `description` de la metadata de `/acceso`, que lo menciona.
   - Con sesión activa, `/acceso` muestra "SESIÓN INICIADA COMO <ALIAS>", "IR A LA
     BIBLIOTECA" y "CERRAR SESIÓN" en lugar de los formularios.
   - Usar `/frontend-design` para los estados nuevos, con los tokens existentes.
   Verificación: credenciales buenas → `/juegos` con sesión; malas → mensaje sin crash;
   registro → mensaje "Revisa tu correo".

6. **`app/acceso/nueva-clave/page.tsx`**
   Página (Server Component que monta un formulario cliente) con "Nueva contraseña" +
   "Repítela". El callback ya creó la sesión de recuperación; si al montar no hay sesión,
   muestra "El enlace no es válido o ha caducado" y un enlace a `/acceso`. Al enviar,
   `supabase.auth.updateUser({ password })`; éxito → "Contraseña actualizada" + enlace a
   `/juegos`.
   Verificación: el enlace del correo de recuperación llega aquí, permite cambiar la
   contraseña y la nueva funciona al iniciar sesión.

7. **`components/nav.tsx`**
   - Con sesión (`ready && user`): avatar (cuadro pixel con la inicial de `username`,
     tokens neón), el alias y botón "CERRAR SESIÓN" que llama a `signOut()`. Sustituye
     al botón actual `{user.name} ▾`, que cerraba sesión sin decirlo.
   - Panel móvil: el enlace "Cuenta" lleva a `/acceso` (que ahora muestra la cuenta) y
     se añade "CERRAR SESIÓN".
   - Sin sesión: el enlace "Iniciar Sesión" actual.
   Verificación: tras el login el nav muestra avatar y alias; tras cerrar sesión vuelve
   el enlace.

8. **Reproductores**
   En los cinco `components/<id>-player.tsx`:
   - `playerName = ready && username ? username : "INVITADO"` (HUD).
   - Al abrir el modal de fin de partida: con sesión, el nombre se pre-rellena con
     `username`; sin sesión, con `readPlayerName()` como ahora. El campo sigue editable.
   - `insert({ ..., user_id: user?.id ?? null })`.
   - `writePlayerName` y `saveScore` se mantienen.
   En `components/player.tsx`, solo el cambio de `user.name` a `username`.
   `components/hall-of-fame.tsx` no cambia (usa `ready && user`), pero se comprueba
   que compila.
   Verificación: con sesión, el modal muestra el alias y la fila guardada tiene
   `user_id`; como invitado, `user_id` es `null`.

9. **Documentación y verificación final**
   - `CLAUDE.md`: tabla de rutas (`/acceso`, `/acceso/callback`,
     `/acceso/nueva-clave`), sección Datos (sesión real en cookies, sin `av_user`),
     `proxy.ts` ya existe, fila del spec 13 en la tabla de specs.
   - `npm run lint`, `npx tsc --noEmit` y `npm run build` sin errores; ninguna ruta
     existente devuelve 500.

---

## Criterios de aceptación

- [ ] Los proveedores Email, Google y GitHub están habilitados en Supabase y las Redirect URLs incluyen localhost y la LAN.
- [ ] `proxy.ts` refresca la sesión y nunca redirige.
- [ ] `GET /acceso/callback` convierte `code` o `token_hash` en sesión y redirige a `next` (por defecto `/juegos`); un `next` absoluto se ignora.
- [ ] `useSession()` expone `user: User | null`, `session`, `username`, `ready`, `signOut`, `saveScore` y `bestScoreFor`.
- [ ] No queda ninguna referencia a `av_user` en `app/`, `components/` ni `lib/`.
- [ ] Login con correo y contraseña correctos lleva a `/juegos` con sesión.
- [ ] Login con credenciales incorrectas muestra un mensaje inline en español, sin crash.
- [ ] Registro válido muestra "Revisa tu correo" sin redirigir; registro inválido (contraseñas distintas, normas sin aceptar) no llama a Supabase.
- [ ] El enlace de confirmación activa la sesión.
- [ ] "¿Olvidaste tu contraseña?" envía el correo y muestra la confirmación.
- [ ] `/acceso/nueva-clave` permite cambiar la contraseña y la nueva funciona.
- [ ] Los botones GOOGLE y GITHUB inician la redirección al proveedor.
- [ ] El botón "JUGAR COMO INVITADO" ya no existe.
- [ ] Con sesión, `/acceso` muestra la cuenta y "CERRAR SESIÓN".
- [ ] El nav muestra avatar + alias + "CERRAR SESIÓN" con sesión, y "Iniciar Sesión" sin ella.
- [ ] Un usuario de OAuth sin alias propio tiene `username` derivado y no vacío.
- [ ] En los cinco reproductores, el modal pre-rellena el alias del usuario autenticado.
- [ ] Los scores de usuarios autenticados tienen `user_id`; los de invitados, `null`.
- [ ] `npm run lint`, `npx tsc --noEmit` y `npm run build` terminan sin errores.

---

## Decisiones

- **Sí: rutas en español bajo `/acceso`** — `/acceso/callback` y
  `/acceso/nueva-clave` en lugar de `/auth/*`. Razón: todas las rutas del repo están en
  español y la pantalla de acceso ya vive en `/acceso`.

- **Sí: se conserva `useSession()` en `lib/session.tsx`** — en lugar de crear un
  `UserContext` nuevo. Razón: ya lo consumen el nav, el salón, el formulario y seis
  reproductores; cambiar su forma basta y evita dos fuentes de sesión.

- **Sí: `proxy.ts` solo para refrescar la sesión** — sin proteger rutas. Razón:
  `@supabase/ssr` necesita refrescar el token en el servidor; los Server Components no
  pueden escribir cookies (ver el `catch` de `lib/supabase/server.ts`).

- **Sí: verificación de correo activada (double opt-in)** — el registro no abre sesión
  hasta confirmar. Razón: evita cuentas con correos inválidos en el salón de la fama.

- **Sí: alias en `user_metadata`, derivado para OAuth** — sin tabla `profiles`. Razón:
  aquí el alias solo se muestra; una tabla de perfiles con RLS merece su propio spec.

- **Sí: recuperación de contraseña en este spec**. Razón: sin ella la autenticación
  real no se puede usar en producción.

- **Sí: un único callback para OAuth, confirmación y recuperación**, con `next`
  validado. Razón: con `@supabase/ssr` (flujo PKCE) los tres llegan como `?code=`; el
  soporte de `token_hash` cubre el caso de abrir el enlace en otro navegador si se
  cambian las plantillas de correo.

- **Sí: con sesión, el alias tiene prioridad sobre `av_player_name`** al pre-rellenar el
  modal. Razón: la puntuación queda ligada al usuario; el nombre sigue siendo editable.
  Cambia el comportamiento de SPEC 06, donde el nombre recordado ganaba.

- **Sí: después del login se va a `/juegos`** — no a `/`. Razón: es lo que hace hoy el
  formulario y `/` solo redirige a `/inicio`.

- **Sí: `redirectTo` construido con `location.origin`**. Razón: el servidor de
  desarrollo se abre desde `localhost` y desde `192.168.0.x`.

- **Sí: se elimina "JUGAR COMO INVITADO"**. Razón: con autenticación real la app ya se
  usa sin cuenta; el botón era un artefacto del mock.

- **Sí: `user_id` se puebla sin añadir FK ni tocar RLS**. Razón: la FK y las políticas se
  diseñan juntas en el spec de seguridad.

- **No: borrar la clave antigua `av_user` del localStorage de los usuarios**. Razón:
  queda huérfana e inofensiva, y limpiarla obligaría a mantener la referencia en el
  código.

- **No: edición de perfil en este spec**. Razón: amplía el alcance más allá de la
  autenticación básica.

---

## Riesgos identificados

- **`user_id` falsificable** — la política de `INSERT` de `scores` es `with check (true)`,
  así que cualquier cliente puede guardar un score con el `user_id` de otro. Mitigación:
  aceptado hasta el spec de seguridad, que debe exigir
  `user_id is null or user_id = auth.uid()`.

- **Credenciales OAuth sin configurar** — los botones de Google y GitHub devuelven error
  de Supabase. Mitigación: el paso 1 va antes de cualquier prueba de OAuth.

- **Límite del SMTP integrado de Supabase** — solo envía unos pocos correos por hora y
  solo a direcciones del equipo del proyecto. Mitigación: suficiente para desarrollo;
  para producción, configurar SMTP propio (el proyecto ya usa Resend, SPEC 03).

- **Enlace de correo abierto en otro navegador** — el flujo PKCE guarda el verificador en
  el navegador que pidió el correo; desde otro, el intercambio de `code` falla y se
  redirige a `/acceso?error=enlace`. Mitigación: cambiar las plantillas de correo a
  `token_hash`, que el callback ya acepta.

- **Redirect URLs de producción** — si el dominio real no está en la lista, OAuth y los
  enlaces de correo fallan. Mitigación: añadirlo al desplegar.
