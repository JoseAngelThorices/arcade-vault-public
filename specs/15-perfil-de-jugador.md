# SPEC 15 — Perfil de jugador: página pública, alias único y avatar

> **Estado:** Aprobado
> **Depende de:** 06-games-table-leaderboard-supabase · 13-supabase-auth · 14-security-rls-password-headers
> **Fecha:** 2026-11-09
> **Objetivo:** Dar a cada cuenta un perfil en una tabla `profiles` (alias único y
> avatar pixel), una página pública `/jugador/[alias]` con sus marcas, y permitir
> editar el alias y el avatar desde `/acceso`.

---

## Punto de partida (verificado el 2026-11-09)

| Punto | Estado |
|---|---|
| Alias | Solo en `user_metadata.username` de Supabase Auth. No es único y no se puede buscar por alias. |
| Avatar | Círculo con la inicial del alias (`components/nav.tsx:76`, `components/auth-form.tsx:52`). |
| Firma de puntuaciones | El trigger `scores_set_player_name` (SPEC 14) copia el alias del JWT en `scores.player_name`. |
| Rankings | `/juego/[id]` y `/salon` muestran `player_name` como texto plano, una fila por partida. |
| Datos | 1 cuenta (alias `NEO PLAYER`, con espacio) y 5 filas en `scores`, ninguna de invitado. |

---

## Alcance

**Entra:**

- **Supabase (migración vía MCP):** tabla `public.profiles`, relleno de las cuentas
  actuales, trigger que crea el perfil al registrarse, FK de `scores.user_id` a
  `profiles`, cambio de `scores_set_player_name` para leer el alias de `profiles` y
  tres funciones RPC: `username_available`, `update_profile` y `get_player_stats`.
- `public/avatars/<id>.svg` (nuevo): 12 avatares pixel art originales.
- `lib/avatars.ts` (nuevo): lista de ids de avatar con su etiqueta y el avatar por defecto.
- `lib/username.ts` (nuevo): regla del alias (regex, mensaje de error y saneado).
- `components/player-avatar.tsx` (nuevo): pinta un avatar por id, en tres tamaños.
- `components/avatar-picker.tsx` (nuevo): rejilla de selección de avatar.
- `lib/session.tsx`: carga el perfil (`username`, `avatar`) desde `profiles` y expone
  `avatar` y `refreshProfile()`.
- `components/nav.tsx`: el avatar elegido sustituye a la inicial.
- `components/auth-form.tsx`:
  - El registro valida el alias con la regla nueva, comprueba si está libre e incluye
    el selector de avatar.
  - La vista de cuenta añade "VER MI PERFIL" y el formulario "EDITAR PERFIL".
- `components/profile-editor.tsx` (nuevo): formulario de alias y avatar de la vista de cuenta.
- `lib/supabase/profiles.ts` (nuevo): `getProfileByUsername`, `getPlayerStats` y
  `getRecentScores`.
- `app/jugador/[alias]/page.tsx` y `app/jugador/[alias]/not-found.tsx` (nuevos):
  página pública del perfil.
- `app/juego/[id]/page.tsx`, `components/hall-of-fame.tsx` y
  `lib/supabase/scores.ts`: las filas con cuenta muestran mini avatar y el alias
  enlaza al perfil.
- `lib/supabase/types.ts`: tipo `ProfileRow` y relación `profiles` en `ScoreRow`.
- `app/globals.css`: estilos del perfil, del selector de avatar y de los avatares.
- `CLAUDE.md`: rutas, tabla `profiles`, RPC y sesión.

**Fuera:**

- Subir imágenes de avatar (Supabase Storage).
- Límite de frecuencia para cambiar el alias.
- Redirección del alias antiguo al nuevo: tras un cambio, la URL vieja da 404.
- Cambiar el correo o borrar la cuenta.
- Perfil con biografía, país, enlaces u otros campos.
- Logros, rankings por periodo y avisos en tiempo real (specs 16 y 17 de la hoja de ruta).
- Migrar "TU MEJOR MARCA" del salón (registro local `av_scores`) a `profiles`.
- OAuth.

---

## Modelo de datos

### Tabla `public.profiles`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` PK | FK a `auth.users(id)` `on delete cascade` |
| `username` | `text not null unique` | `CHECK (username ~ '^[A-Z0-9_]{3,10}$')` |
| `avatar` | `text not null default 'robot'` | `CHECK` contra los 12 ids de avatar |
| `created_at` | `timestamptz not null default now()` | "Miembro desde" |

- El alias se guarda siempre en mayúsculas, así que `unique` ya lo hace único sin
  distinguir mayúsculas.
- RLS activo. `SELECT` público para `anon` y `authenticated`.
- Sin políticas de `INSERT`, `UPDATE` ni `DELETE`. Se revocan esos permisos y
  `TRUNCATE` a `anon` y `authenticated`. Solo escriben los triggers y las funciones
  `security definer`.

### Ids de avatar

`robot`, `alien`, `calavera`, `gato`, `rana`, `cohete`, `corazon`, `joystick`,
`moneda`, `rayo`, `dragon`, `buho`. Son diseños propios en rejilla de 12×12 con los
colores neón del tema. Ninguno copia sprites de juegos existentes.

### Regla del alias

```ts
// lib/username.ts
export const USERNAME_RE = /^[A-Z0-9_]{3,10}$/;
// Saneado: mayúsculas, espacios a "_", fuera lo que no sea A-Z 0-9 _, corte a 10.
```

La base de datos aplica la misma regla con el `CHECK`.

### Relleno de cuentas actuales

Cada usuario de `auth.users` recibe su perfil con el alias actual saneado
(`NEO PLAYER` → `NEO_PLAYER`) y el avatar `robot`. Si el alias saneado choca o tiene
menos de 3 caracteres, se usa `PLAYER` + 4 dígitos. El `player_name` de sus filas de
`scores` se actualiza al alias nuevo.

### Trigger `on_auth_user_created`

`AFTER INSERT ON auth.users`, función `handle_new_user()` (`security definer`,
`search_path = ''`). Crea el perfil con `username` y `avatar` de
`raw_user_meta_data`. Si el alias no cumple la regla o ya existe, usa `PLAYER` + 4
dígitos. Si el avatar no es válido, usa `robot`. Nunca hace fallar el registro.

### FK nueva en `scores`

`scores.user_id` gana una segunda FK a `profiles(id)` `on delete set null`. La FK a
`auth.users` se mantiene. PostgREST la usa para el embed
`scores.select("*, profiles(username, avatar)")`.

### Trigger `scores_set_player_name` (cambio)

Lee `profiles.username` de `auth.uid()` en lugar del JWT. Si no hay perfil, usa
`PLAYER`. Así el alias firmado no depende de un token desactualizado tras un cambio.

### Funciones RPC

| Función | Tipo | Permiso | Qué hace |
|---|---|---|---|
| `username_available(name text) → boolean` | `security definer`, `stable` | `anon`, `authenticated` | `true` si el alias cumple la regla y nadie lo usa (o lo usa quien llama). |
| `update_profile(new_username text, new_avatar text) → profiles` | `security definer` | `authenticated` | Valida, actualiza el perfil de `auth.uid()` y renombra `player_name` en todas sus filas de `scores`. Una sola transacción. Error `username_taken` o `username_invalid` / `avatar_invalid`. |
| `get_player_stats(p_user uuid) → table(game_id text, best int, rank int, plays int)` | `security invoker`, `stable` | `anon`, `authenticated` | Por cada juego con partidas del jugador: mejor marca, puesto de esa fila en el ranking y número de partidas. |

El puesto se calcula como en los rankings: una fila por partida, orden `score desc`,
`created_at asc`. Es 1 + las filas del juego que van antes de su mejor fila.

### Tipos (`lib/supabase/types.ts`)

```ts
export interface ProfileRow {
  id: string;
  username: string;
  avatar: AvatarId;
  created_at: string;
}
// ScoreRow gana: profiles: { username: string; avatar: AvatarId } | null
```

### Sesión (`lib/session.tsx`)

`Session` gana `avatar: AvatarId | null` y `refreshProfile(): Promise<void>`.
`username` sale de `profiles`. Hasta que llega el perfil, se usa el alias derivado
actual como reserva.

---

## Plan de implementación

1. **Migración en Supabase** (`apply_migration`, nombre `profiles_player_profile`).
   Crea `profiles`, RLS y permisos, relleno, trigger de alta, FK en `scores`, cambio
   de `scores_set_player_name` y las tres RPC. La app sigue igual: aún no lee
   `profiles`.
   Verificación:
   - `NEO_PLAYER` existe en `profiles` y sus 5 filas de `scores` llevan ese `player_name`.
   - Como `anon`: `INSERT`/`UPDATE` en `profiles` → error de permisos.
   - `username_available('NEO_PLAYER')` → `false`; `username_available('a b')` → `false`.
   - `get_advisors(security)` sin avisos nuevos.
2. **Avatares.** `public/avatars/*.svg`, `lib/avatars.ts`, `lib/username.ts` y
   `components/player-avatar.tsx`. Sin uso todavía.
3. **Sesión y nav.** `lib/session.tsx` lee el perfil y expone `avatar` y
   `refreshProfile()`. `components/nav.tsx` y la vista de cuenta de `/acceso` pintan
   el avatar. Prueba: al iniciar sesión, el nav muestra `robot` y el alias `NEO_PLAYER`.
4. **Registro.** `components/avatar-picker.tsx`. El formulario de crear cuenta valida
   el alias con `USERNAME_RE` y consulta `username_available` antes de llamar a
   `signUp`. Envía `username` y `avatar` en `options.data`. Prueba: alias con espacio
   o ya usado → error inline sin petición a `signUp`.
5. **Editar perfil.** `components/profile-editor.tsx` en la vista de cuenta de
   `/acceso`. Llama a `update_profile` y después a `refreshProfile()`. Traduce
   `username_taken` / `username_invalid` a mensajes en español. Prueba: cambiar alias y
   avatar; el nav se actualiza sin recargar.
6. **Página pública.** `lib/supabase/profiles.ts`, `app/jugador/[alias]/page.tsx` y
   `not-found.tsx`.
   - Cabecera: avatar grande, alias, "Miembro desde" y partidas totales.
   - Tarjeta por juego con partidas: mejor marca, puesto y enlace al juego.
   - Últimas 10 partidas: juego, puntuación y fecha.
   - El parámetro se pasa a mayúsculas. Un alias inexistente da 404.
   - Enlace "VER MI PERFIL" en la vista de cuenta.
7. **Rankings.** `getTopScores` y la consulta del salón piden
   `*, profiles(username, avatar)`. En `/juego/[id]` y `/salon` (tabla y podio), las
   filas con perfil muestran mini avatar y el alias enlaza a `/jugador/<alias>`. Las
   filas sin perfil siguen como texto.
8. **Tipos y documentación.** `lib/supabase/types.ts` (si no se hizo en los pasos
   anteriores) y `CLAUDE.md`.

---

## Criterios de aceptación

- [x] `profiles` existe con RLS: lectura pública y ninguna escritura directa desde el cliente.
- [x] La cuenta actual tiene perfil `NEO_PLAYER` y sus puntuaciones muestran ese alias.
- [ ] Crear cuenta con un alias ya usado o fuera de `^[A-Z0-9_]{3,10}$` muestra error
      inline y no llama a `signUp`.
- [x] Una cuenta nueva aparece en `profiles` con el alias y el avatar elegidos.
- [x] Si el trigger de alta recibe un alias ocupado (carrera), el registro no falla y
      el perfil queda como `PLAYER` + 4 dígitos.
- [ ] El nav muestra el avatar elegido en escritorio y en el panel móvil.
- [ ] Cambiar el alias en `/acceso` renombra todas las filas propias de `scores`, y el
      nav y los rankings muestran el alias nuevo.
- [ ] Cambiar a un alias ocupado muestra "Ese alias ya está en uso." y no cambia nada.
- [x] Una puntuación guardada justo después de cambiar el alias se firma con el alias nuevo.
- [x] `/jugador/NEO_PLAYER` y `/jugador/neo_player` muestran el mismo perfil.
- [x] `/jugador/NOEXISTE` devuelve 404 con la página `not-found` propia.
- [x] El perfil muestra la mejor marca y el puesto por juego, y ese puesto coincide con
      la posición en `/juego/[id]` cuando está en el top 10.
- [x] El perfil muestra las últimas 10 partidas, de la más reciente a la más antigua.
- [x] En `/juego/[id]` y `/salon`, los alias con cuenta enlazan al perfil y llevan mini avatar.
- [x] La página de perfil se ve completa sin JavaScript.
- [x] Lint, tipos y build sin errores.

---

## Decisiones

- **Sí: tabla `profiles`.** Es lo único que permite buscar por alias y garantizar
  unicidad. `user_metadata` no es único y no se lee de otros usuarios sin service role.
- **Sí: `profiles` es la fuente del alias.** El trigger de `scores` y la sesión leen de
  ahí. `user_metadata.username` queda solo como dato inicial del registro.
- **No: sincronizar `user_metadata` al editar.** Obligaría a refrescar el JWT y no
  aporta nada si nadie lo lee ya.
- **Sí: renombrar las puntuaciones antiguas** al cambiar el alias, dentro de
  `update_profile`. Las lecturas de rankings no cambian.
- **No: join en cada lectura para el alias.** Se descartó para el nombre. El embed de
  `profiles` sí se usa, pero solo para el avatar y el enlace.
- **Sí: alias `^[A-Z0-9_]{3,10}$`.** Da URLs limpias. Se mantiene el límite de 10 de
  `scores_player_name_length`.
- **Sí: 12 avatares SVG en `public/avatars/`** con solo el id en la base de datos. Sin
  subidas, Storage ni moderación.
- **Sí: el trigger de alta nunca falla.** Un error en él rompe `signUp` con un mensaje
  genérico de Supabase. La comprobación previa con `username_available` da el error
  bonito; el trigger solo cubre la carrera.
- **Sí: puesto por fila, no por jugador.** Coincide con cómo se ven los rankings hoy
  (una fila por partida).
- **Sí: `get_player_stats` como RPC.** Una consulta en lugar de dos por juego.
- **Sí: editar en `/acceso`.** Ya es la pantalla de cuenta. La página pública queda
  solo de lectura y no hay que proteger rutas nuevas en `proxy.ts`.
- **No: límite de cambios de alias.** En una LAN entre conocidos no compensa.
- **No: redirigir alias antiguos.** Necesitaría historial de alias.

### Desviaciones durante la implementación

- **`username_available` es `security invoker`, no `security definer`.** `profiles`
  ya es legible por `anon`, así que no necesita privilegios extra. Así evita el aviso
  0028 del asesor.
- **Funciones auxiliares nuevas:** `is_valid_avatar(text)` (usada por el `CHECK` y las
  funciones), `sanitize_username(text)` y `pick_free_username(text, uuid)` (relleno y
  trigger de alta; sin `EXECUTE` para `anon`/`authenticated`).
- **Aviso 0029 del asesor aceptado** para `update_profile`: tiene que ser
  `security definer` para renombrar las filas de `scores`, donde los clientes no
  tienen `UPDATE`. Es el único aviso nuevo.

---

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Carrera: dos registros con el mismo alias a la vez | El trigger usa `PLAYER` + 4 dígitos. El usuario lo cambia luego en `/acceso`. |
| Enlaces viejos a `/jugador/<alias>` tras un cambio | Dan 404. Aceptado. |
| `update_profile` es `security definer` y escribe en `scores` | Solo toca filas con `user_id = auth.uid()`. `search_path = ''`. `EXECUTE` solo para `authenticated`. |
| La segunda FK de `scores.user_id` confunde el embed | `auth.users` no está expuesto en PostgREST, así que solo hay una relación visible. Se comprueba en el paso 7. |
| SVG en `next/image` | Se usa `unoptimized` para no activar `dangerouslyAllowSVG`. |

---

## Lo que **no** entra en este spec

- Subida de imágenes de avatar.
- Límite de cambios de alias y redirección de alias antiguos.
- Cambio de correo y borrado de cuenta.
- Logros, rankings por periodo y avisos en tiempo real.
- OAuth.

Cada uno de estos puntos, si llega, va en su propio spec.
