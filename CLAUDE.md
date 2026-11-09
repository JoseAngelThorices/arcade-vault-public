# CLAUDE.md

Este fichero orienta a Claude Code (claude.ai/code) cuando trabaja con el código de este repositorio.

@AGENTS.md

## Proyecto

**Arcade Vault** — plataforma de juegos online donde los jugadores compiten por las puntuaciones más altas (ver `README.md`). La app Next.js es un producto funcional: todas las pantallas del prototipo están portadas, hay varios juegos canvas jugables, y los juegos y las clasificaciones viven en Supabase. La lista de juegos implementados (ID, título, categoría, descripción breve, color) está en `references/implemented-games.md`: léela en lugar de suponer qué juegos existen.

Todos los textos de la interfaz están en español y los números se formatean con `toLocaleString("es-ES")`. Mantén en español los textos nuevos de la interfaz; los comentarios del código del repo también están en español.

## Comandos

```bash
npm run dev      # servidor de desarrollo (Turbopack)
npm run build    # build de producción (Turbopack)
npm start        # sirve el build de producción
npm run lint     # ESLint flat config mediante la CLI de ESLint
npx tsc --noEmit # comprobación de tipos (no hay alias en scripts)
npx next typegen # regenera los tipos de rutas tras añadir/renombrar rutas
```

El servidor de desarrollo se abre desde la IP de la LAN (`192.168.0.x` o `192.168.18.x`), así que `next.config.ts` define `allowedDevOrigins: ["192.168.0.*", "192.168.18.*"]`. Sin eso, Next bloquea sus recursos de desarrollo para ese origen y React nunca hidrata: no lo quites. El mismo fichero añade en todas las rutas los headers `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy` y `X-DNS-Prefetch-Control` (SPEC 14); CSP y HSTS quedan pendientes.

No hay test runner configurado: no existe script de test, framework ni fichero de test en el repo. Añadir uno es una decisión del proyecto; confirma la elección con el usuario primero.

## Flujo de trabajo guiado por specs

Cada funcionalidad pasa por un spec en `specs/NN-<slug>.md` (en español, con cabecera `Estado`, `Depende de`, `Fecha`, `Objetivo`). Estados: `Borrador` → `Aprobado` → `Implementado`. El commit de cierre de cada spec es `docs: mark SPEC NN as implemented`, y los specs registran las desviaciones del plan en su sección `Decisiones`.

| Spec | Contenido |
|---|---|
| 01 | MVP: las cinco pantallas del prototipo portadas (biblioteca, detalle, reproductor, acceso, salón) |
| 02 | Landing en `/inicio`; biblioteca movida a `/juegos`; `/` redirige (307) a `/inicio` |
| 03 | `/acerca-de` + formulario de contacto que envía correo con Resend (`app/api/contact/route.ts`) |
| 04 | Clientes de Supabase para navegador y servidor |
| 05 | Juego canvas Asteroids |
| 06 | Tablas `games` y `scores` en Supabase; clasificaciones reales |
| 07–09 | Juegos canvas Tetris, Arkanoid y Snake |
| 10 | Controles táctiles en móvil: gamepad virtual (`components/mobile-gamepad.tsx`) en los reproductores de los cuatro juegos |
| 13 | Supabase Auth: correo + contraseña (sin OAuth), confirmación de correo y recuperación de contraseña; `user_id` en `scores` |
| 14 | Seguridad: solo se guardan puntuaciones con sesión y firmadas con el alias, política de contraseña robusta (`lib/password.ts`), headers HTTP y `proxy.ts` protege `/acceso/nueva-clave` |
| 15 | Perfil de jugador: tabla `profiles` (alias único + avatar pixel), página pública `/jugador/[alias]`, editar perfil en `/acceso` y alias enlazados en los rankings |
| 16 | Sonido unificado: efectos sintetizados con WebAudio (`lib/audio.ts`, osciladores + ruido filtrado) en reproductores y motores, botón SONIDO y tecla `M` en los cinco reproductores; el silencio se recuerda en `av_muted` |

Skills del proyecto (en `.claude/skills/`; `spec` y `spec-impl` son symlinks a `.agents/skills/`, registrados en `skills-lock.json`):

- **`/spec`** — escribe un spec nuevo sección a sección, con confirmación.
- **`/spec-impl NN`** — implementa un spec. `specs/.spec-config.yml` tiene `AutoCreateBranch: true`, así que crea automáticamente una rama `spec-NN-<slug>`; el trabajo se integra en `main` mediante PR.
- **`/spec-impl-game NN`** — como `/spec-impl` para un spec de juego, y al terminar encadena `@skin-designer` (auditoría de skins del juego nuevo) y `@mobile-porter` (gamepad táctil), con pausa antes de cada uno; cierra con lint + tipos.
- **`/add-game`** — para un juego jugable con clasificación (desde `references/` o nuevo): hace preguntas y escribe `specs/NN-<id>-game.md` en `Borrador`; después se ejecuta con `/spec-impl`. Sigue el patrón de SPEC 05 + SPEC 06 y nunca escribe código.
- **`supabase`** (en `.agents/skills/supabase/`) — guía de Supabase. El servidor MCP de Supabase está configurado en `.mcp.json` para la base de datos de este proyecto.
- Usa siempre **`/frontend-design`** al construir interfaces.

Agentes del proyecto (en `.claude/agents/`):

- **`@game-planner`** — planifica qué juego construir a continuación. Lee `implemented-games.md`, las carpetas reales de los juegos, `specs/` y su to-do, y propone de 1 a 3 candidatos ordenados por diversidad de categorías, factibilidad en canvas 2D y reconocimiento clásico. Nunca repite un juego que ya esté en el to-do. Su memoria persistente es `references/game-suggestions-todo.md` (Sugeridos / Aceptados / Implementados / Descartados); solo escribe ese fichero y nunca escribe código ni specs. Flujo típico: `@game-planner` → elegir candidato → `/add-game` → `/spec-impl`.
- **`@game-jam`** — a partir de un tema, diseña un juego nuevo sin hacer preguntas y escribe al menos dos specs (`01-<id>-core.md` + `02-<id>-<feature>.md`) en `specs/game-jam/<id>/`, en estado `Borrador`. Nunca escribe código. `/spec-impl` solo busca en `specs/`, así que para implementar un spec hay que promocionarlo antes a `specs/NN-<slug>.md`.
- **`@skin-designer`** — audita que cada juego implementado tenga sus tres skins (NEÓN, RETRO y CLÁSICO), con selector en el reproductor que arranca siempre en RETRO (`useSkin()` de `lib/skins.ts`, sin persistencia). Cita la evidencia con `ruta:línea`, propone paleta y estilo de dibujo para las skins que falten y mantiene la matriz en `references/game-with-themes.md`, que es el único fichero que escribe; nunca escribe código ni specs. Flujo típico: `@skin-designer` → `/spec` → `/spec-impl`.
- **`@mobile-porter`** — aplica los controles táctiles de SPEC 10 a un juego que aún no los tenga: añade `KEY_MAP` (valores `code` que el motor ya acepta, citados con `ruta:línea`), `max-md:hidden` en `.player-hud` y `<MobileGamepad>` tras el CRT. Solo edita `components/<id>-player.tsx`; nunca toca el motor, `mobile-gamepad.tsx`, `globals.css` ni otros juegos. Un juego por invocación; sin `Bash`, así que lint, tipos y build los ejecuta el usuario.
- **`@game-performance-booster`** — audita el motor canvas de un juego contra 7 patrones de rendimiento (objetos constantes fuera de `draw()`, no redibujar en pausa salvo cambio de skin, temporizadores cíclicos acotados, búsquedas precalculadas, glow de NEÓN horneado en sprites offscreen, parar el bucle al terminar, `notify()` solo con cambios) y aplica los que falten, citando `ruta:línea`. Solo edita `components/games/<id>-game.tsx`; nunca toca el reproductor, otros juegos ni `lib/`, y cada skin debe verse igual que antes. Un juego por invocación; sin `Bash`, así que lint, tipos y la prueba visual los hace el usuario.
- **`@security-auditor`** — pentest antes de producción: revisión de código de caja blanca y ataques de caja negra contra el servidor local y la API de Supabase con la clave publicable (y cuentas de bot para las pruebas con sesión). Cubre trampas en puntuaciones, RLS/RPC, auth, redirecciones abiertas, créditos, contacto, XSS, cabeceras, secretos, DoS acotado y dependencias. Solo escribe `references/security/informe-AAAA-MM-DD.md` (hallazgos con gravedad, evidencia `ruta:línea`, PoC y corrección, agrupados en specs propuestos); nunca corrige código ni modifica datos que no sean de bots, y no arranca el servidor. Flujo típico: `npm run build && npm start` → `@security-auditor` → `/spec` → `/spec-impl`.

Implementa los specs paso a paso: termina un paso, para y pregunta antes del siguiente.

## Arquitectura

### Rutas (`app/`)

| Ruta | Qué es |
|---|---|
| `/` | `redirect("/inicio")`; si llega `?code` (enlace de correo que Supabase manda a la Site URL) lo reenvía a `/acceso/callback`, y `?error` a `/acceso?error=enlace` |
| `/inicio` | Landing. ACTIVIDAD EN VIVO es real: últimas 7 puntuaciones (`getRecentActivity`) y top 5 de puntos sumados hoy en `Europe/Madrid` (RPC `get_top_players_today`), ambos en `lib/supabase/activity.ts` |
| `/juegos` | Cuadrícula de la biblioteca (`components/game-library.tsx`), juegos + mejor puntuación desde Supabase |
| `/juego/[id]` | Detalle del juego + top 10 de la clasificación (Server Component, con su propio `not-found.tsx`) |
| `/jugar/[id]` | Reproductor estático genérico (`components/player.tsx`) para juegos sin implementación real |
| `/jugar/<id>` (estática) | Una ruta estática por juego implementado (listados en `references/implemented-games.md`); tiene prioridad sobre `[id]` y monta el juego canvas real |
| `/salon` | Salón de la fama: una fila por jugador con su mejor marca (RPC `get_leaderboard`), 10 filas a la vista con scroll propio que carga páginas de 25. La primera pestaña se renderiza en el servidor, las demás se piden desde el navegador |
| `/acceso` | Acceso con Supabase Auth (`components/auth-form.tsx`): login, registro y recuperar contraseña (sin OAuth); con sesión muestra la cuenta. Lee `?error=enlace` |
| `GET /acceso/callback` | Route Handler: convierte `code` (PKCE) o `token_hash` en sesión y redirige a `next` (solo rutas relativas). Sin `next`, decide por el claim `amr`: `recovery` → `/acceso/nueva-clave`, si no `/juegos` |
| `/acceso/nueva-clave` | Formulario de contraseña nueva tras el enlace de recuperación (`components/new-password-form.tsx`) |
| `/jugador/[alias]` | Perfil público (Server Component, con su propio `not-found.tsx`): avatar, miembro desde, mejor marca y puesto por juego, últimas 10 partidas. El alias se busca en mayúsculas |
| `/acerca-de` | Página "acerca de" con formulario de contacto |
| `POST /api/contact` | Endpoint de Resend: campo honeypot, límite de peticiones por IP y después validación (`lib/contact.ts`) |
| `GET`/`POST /api/credits` | Créditos diarios de invitado (SPEC 02, ampliación): `GET` da el saldo y `POST { runId }` cobra una partida (idempotente por `runId`). Con sesión, ilimitado |

`app/layout.tsx` carga las fuentes con `next/font/google` (Press Start 2P, JetBrains Mono, Courier Prime) y envuelve todo en `<SessionProvider>` + `<Nav>`.

### Datos

- **Supabase** (`lib/supabase/`): `server.ts` (`createClient()` asíncrono sobre `cookies()`) para Server Components y Route Handlers; `client.ts` para código `"use client"`. Las lecturas están en `games.ts` (`getGames`, `getGame` envuelto en `cache` de React, `getGamesWithBest`), `scores.ts` (`getTopScores`, `countScores`) y `profiles.ts` (`getProfileByUsername` con `cache`, `getPlayerStats`, `getRecentScores`). Los tipos de fila de `types.ts` (`GameRow`, `ScoreRow`, `ProfileRow`, `PlayerStatRow`, `RecentScoreRow`) están **escritos a mano**: actualízalos cuando cambie el esquema.
- Tablas: `games` (`id` slug PK, `title`, `short`, `long`, `cat`, `cover` clase CSS, `color`) y `scores` (`game_id`, `player_name`, `score`, `user_id`: FK a `auth.users` con `on delete set null`, `null` en las filas históricas de invitados). RLS activo: `SELECT` público en ambas; `INSERT` en `scores` solo para `authenticated` con `user_id = auth.uid()` (`anon` no tiene permiso de `INSERT`); sin `UPDATE`/`DELETE`. Además, la migración `scores_revoke_unused_privileges` (solo en el historial de Supabase, no hay carpeta de migraciones en el repo) deja en `scores` únicamente los permisos de tabla `SELECT` para `anon` y `SELECT`+`INSERT` para `authenticated`: se revocaron `UPDATE`, `DELETE`, `TRUNCATE` (RLS no lo cubre), `REFERENCES` y `TRIGGER`. En `scores`, el trigger `scores_set_player_name` sobrescribe `player_name` con el alias de `profiles` del usuario (`PLAYER` si no hay perfil; SPEC 15) y hay `CHECK` de `score >= 0` y `player_name` de 1–10 caracteres (SPEC 14). La función `rls_auto_enable()` (event trigger `ensure_rls`, activa RLS en tablas nuevas de `public`) se conserva sin `EXECUTE` para `anon`/`authenticated`. Los agregados de PostgREST están desactivados, así que la "mejor puntuación" es una consulta `order score desc limit 1` por juego.
- **Perfiles** (SPEC 15): tabla `profiles` (`id` = `auth.users.id` con `on delete cascade`, `username` único `^[A-Z0-9_]{3,10}$`, `avatar` validado por `is_valid_avatar()`, `created_at`). RLS con `SELECT` público y ninguna escritura desde el cliente: solo escriben el trigger `on_auth_user_created` (`handle_new_user()`: crea el perfil con `username`/`avatar` de `raw_user_meta_data`; si el alias no vale o está ocupado pone `PLAYER` + 4 dígitos y nunca hace fallar el registro) y la RPC `update_profile(new_username, new_avatar)` (`security definer`, solo `authenticated`; renombra también `player_name` en las filas propias de `scores`; errores `username_taken`/`username_invalid`/`avatar_invalid`; aviso 0029 del asesor aceptado). RPC de lectura: `username_available(name)` (anon + authenticated, `true` si el alias es propio) y `get_player_stats(p_user)` (mejor marca, puesto por fila y partidas por juego), y para el Salón `get_leaderboard(p_game, p_offset, p_limit)` (mejor marca por jugador: por `user_id`, o por `player_name` en filas de invitado; columna `total` = jugadores distintos) y `get_leaderboard_rank(p_game, p_score)` (`security invoker`, anon + authenticated; helpers en `lib/supabase/leaderboard.ts`), y para la landing `get_top_players_today(p_limit)` (misma agrupación por jugador, suma de los puntos de hoy). `scores.user_id` tiene una segunda FK a `profiles(id)` para el embed `select("*, profiles(username, avatar)")` de los rankings. Los 12 avatares son `public/avatars/<id>.svg`; la lista vive en `lib/avatars.ts` **y** en `is_valid_avatar()`: añadir uno exige tocar los dos. La regla del alias está en `lib/username.ts` y en el `CHECK` de la tabla.
- **Sesión** (SPEC 13): `lib/session.tsx` (`SessionProvider`/`useSession()`) escucha `onAuthStateChange` de Supabase y expone `user`, `session`, `username` y `avatar` (leídos de `profiles`; mientras carga, `username` es el alias derivado de `user_metadata` saneado y `avatar` es `null`), `ready` (false hasta `INITIAL_SESSION`), `signOut` y `refreshProfile()` (tras editar el perfil). La sesión vive en cookies de `@supabase/ssr` y `proxy.ts` la refresca en cada petición; la única ruta que protege es `/acceso/nueva-clave` (sin sesión → `/acceso?error=enlace`). La política de contraseña (8 caracteres con minúscula, mayúscula, dígito y símbolo de la lista de Supabase) está en `lib/password.ts` y se valida en el registro y en la contraseña nueva, igual que en Supabase Auth.
- **Créditos de invitado** (SPEC 02, ampliación): 10 partidas al día sin cuenta, que se recargan a las 00:00 `Europe/Madrid`. El gasto está en la cookie `httpOnly` `av_credits`, firmada con HMAC usando `CREDITS_SECRET` (`lib/credits.ts`, solo servidor). En el cliente, `CreditsProvider`/`useCredits()` (para el Nav) y `useCreditGate()` (para los reproductores) están en `lib/credits-client.tsx`; los reproductores no montan el canvas hasta que la partida está cobrada (`components/credit-gate.tsx`). Un juego nuevo debe usar el mismo patrón.
- **localStorage** (solo cliente): `lib/audio.ts` guarda el silencio de los juegos en `av_muted` (`"1"` o ausente). `lib/session.tsx` guarda además un registro local de puntuaciones `av_scores` (alimenta "TU MEJOR MARCA" en el salón), leído con `useSyncExternalStore` para evitar desajustes de hidratación.
- `lib/games.ts` solo guarda constantes de la interfaz (`CATS`); `lib/format.ts` formatea fechas como `DD/MM/AAAA` con la zona fija `Europe/Madrid` para que servidor y navegador coincidan.
- Variables de entorno: plantilla en `specs/.env.template` (copiar a `.env.local`). `RESEND_API_KEY` (vacía → modo simulación), `CONTACT_TO`, `RESEND_FROM` y `CREDITS_SECRET` (16+ caracteres, firma de `av_credits`) son solo de servidor; `SUPABASE_SECRET_KEY` solo la usan los scripts de `scripts/bots`; `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` son públicas.

### Juegos canvas — el patrón a seguir

Cada juego se divide en dos ficheros:

- `components/games/<id>-game.tsx` — motor canvas `"use client"` dentro de un `useEffect` (listeners limpiados al desmontar). Recibe `paused: boolean` e informa del estado mediante callbacks (`onScoreChange`, `onLivesChange`/`onLengthChange`/…, `onLevelChange`, `onPauseToggle`, `onGameOver(finalScore)`) en lugar de pintar un HUD o un overlay de GAME OVER en el canvas.
- `components/<id>-player.tsx` — envoltorio `"use client"` que carga el motor con `next/dynamic({ ssr: false })` y renderiza el HUD en React, el marco CRT, la pausa y el modal de fin de partida. Guardar solo es posible con sesión: inserta una fila en `scores` desde el cliente del navegador con `user_id` y el alias de la cuenta (fijo, no editable) y llama a `saveScore` para el registro local; sin sesión, el modal invita a iniciar sesión. Reiniciar remonta el canvas incrementando una key `run`.
- `app/jugar/<id>/page.tsx` — Server Component que llama a `getGame("<id>")` y renderiza el reproductor.
- Los assets del juego (sprites, sonidos) van en `public/games/<id>/`; la nueva fila de `games` se inserta en Supabase con el SQL del spec.
- Cuando se implementa un juego, añade su fila a `references/implemented-games.md` (mismos datos que su fila de `games`).
- **Sonido** (SPEC 16): los efectos de acción (disparo, giro, salto, explosión…) los suena el motor llamando a `playSfx(sfx)` o `setLoop(loop, on)` de `lib/audio.ts` (bucles idempotentes, apagados en la limpieza del efecto); los genéricos, el reproductor. El reproductor llama a `useGameAudio()` (desbloquea el `AudioContext` en el primer gesto y conmuta el silencio con `M`) y a `useSoundOn(estado, efecto, "up" | "down" | "change", !over)` de `lib/use-sound.ts` por cada contador que notifica el motor; los efectos (`score`, `eat`, `line`, `hit`, `levelup`, `pause`, `gameover`) son recetas de oscilador en `lib/audio.ts`. Pon `<SoundToggle />` en `.hud-actions` y otro bajo el gamepad dentro de `.sound-mobile md:hidden`. Un motor que use ficheros de audio los reproduce con `playSample(url)`, nunca con `new Audio()`, para respetar el silencio global.

## Estilos

`app/globals.css` (~1550 líneas) es el port del `styles.css` del prototipo: tokens neón en `:root` (`--cyan #00f5ff`, `--magenta #ff006e`, `--bg #0a0a0f`, …, `--pixel`, `--mono`), expuestos a Tailwind mediante `@theme inline` (`bg-cyan`, `text-ink-dim`, `font-pixel`…). Los componentes usan sobre todo las clases semánticas del prototipo (`av-player`, `lb-row`, `btn xl pulse`, …) definidas ahí, además de las portadas por juego (`cover-<nombre>`, p. ej. `cover-rocas`). Un juego nuevo que necesite portada nueva añade su clase aquí.

Nada visible puede depender de JavaScript: ningún contenido parte de `opacity: 0` esperando a un script. Las animaciones de entrada/scroll son CSS (`animation-timeline: view()` dentro de `@supports`), con el estado visible como base.

## `references/`

No forma parte del build; es material de partida para los specs.

- `implemented-games.md` — tabla de los juegos ya implementados (la fuente de verdad de "qué juegos existen").
- `game-suggestions-todo.md` — to-do de juegos propuestos por `@game-planner` (Sugeridos / Aceptados / Implementados / Descartados). Lo mantiene el agente; las filas se mueven, nunca se borran.
- `templates/` — el prototipo original sin build (`Arcade Vault.html`, React 18 UMD + Babel standalone, globales, enrutado por hash, mocks en localStorage) más `home-about/` para la landing y la página "acerca de". Es la especificación visual y funcional: al portar, conserva layout, textos y tokens; rehace el código (sin globales, sin router pasado por props, sin enfoque solo de CSS plano).
- `start-games/` — `02-asteroids/`, `03-tetris/`, `04-Arkanoid/`: juegos canvas independientes (`game.js` + `index.html`) que se adaptaron en `components/games/`. Sus propios `CLAUDE.md`/`.claude/` pertenecen a esos proyectos, no a este.
- `source-assets/` — assets en bruto para juegos creados desde cero (p. ej. los sprites de fruta de Snake).

## Diferencias del stack respecto a Next.js antiguo

Esto es **Next.js 16.3.5** con React 19.2 y Tailwind CSS v4. `AGENTS.md` (importado arriba) manda: lee la página correspondiente en `node_modules/next/dist/docs/` antes de escribir código del framework. Diferencias clave respecto a lo anterior a la 16:

- **Turbopack es el predeterminado** tanto en `dev` como en `build`; el flag `--turbopack` está obsoleto. Las opciones de Turbopack van en `turbopack` dentro de `next.config.ts`, no en `webpack`. Una configuración `webpack` hace fallar `next build` salvo que se ejecute con `--webpack`.
- **Las Request APIs son solo asíncronas.** `cookies()`, `headers()`, `draftMode()` y `params`/`searchParams` deben esperarse con `await`; el acceso síncrono se eliminó, no solo se desaconsejó.
- **Helpers globales de tipos de ruta.** `PageProps<'/route'>`, `LayoutProps<'/route'>` y `RouteContext<'/route'>` están disponibles globalmente y los genera `next typegen`; no se importan.
- **`middleware.ts` ahora es `proxy.ts`** — la convención antigua está obsoleta. El `proxy.ts` de la raíz refresca la sesión de Supabase (SPEC 13) y protege `/acceso/nueva-clave` (SPEC 14).
- **`next lint` ya no existe.** El lint se ejecuta con la CLI de ESLint y `eslint.config.mjs` (flat config, `eslint-config-next/core-web-vitals` + `/typescript`).
- **`ssr: false` en `next/dynamic` solo funciona dentro de Client Components** — por eso los reproductores de juegos son client components de principio a fin.
- Se eliminaron la opción de segmento `experimental_ppr` de PPR y los prefijos `unstable_` de las APIs estabilizadas. La caché usa `revalidateTag`/`updateTag`/`refresh` y `cacheLife`/`cacheTag`.
- Cambiaron varios valores por defecto de `next/image` — consulta `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md` antes de ajustar la configuración de imágenes.

## Convenciones

- TypeScript es `strict` y el alias `@/*` apunta a la raíz del repo. `allowJs` está activo e `include` es amplio, así que los `.jsx`/`.js` de `references/` están dentro del programa TS: no añadas herramientas con información de tipos que intenten comprobarlos.
- Tailwind v4 se configura mediante PostCSS (`postcss.config.mjs`), sin fichero `tailwind.config`.
- `next dev` regenera `AGENTS.md`. Si aparece como cambio sin commit, inclúyelo en el commit del trabajo en lugar de revertirlo.
- La raíz del repositorio git es el directorio home del usuario, no esta carpeta: `git status` sin ruta muestra ruido ajeno del home. Limita los comandos git a este directorio (`git status .`, `git add .`).
- Los mensajes de commit usan prefijos convencionales (`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`) y citan el spec, p. ej. `feat: integrate Snake canvas game (SPEC 09)`.
