# SPEC 02 — Página de inicio (landing) en la raíz

> **Estado:** Implementado
> **Depende de:** SPEC 01
> **Fecha:** 2026-09-22
> **Objetivo:** Portar la landing de `references/templates/home-about/` a la ruta `/` y mover la biblioteca de juegos a `/juegos`, de modo que al cargar la aplicación aparezca la página de inicio.

> **Nota (2026-11-09):** la landing ha cambiado desde que se implementó este spec: ACTIVIDAD EN VIVO usa datos reales, ya no hay sección de precios y han cambiado los botones. El plan y los criterios de abajo describen el port original; lo que ya no aplica está en [Cambios posteriores](#cambios-posteriores-2026-11-09). Los créditos diarios para invitados están en [Ampliación: créditos diarios para invitados](#ampliación-créditos-diarios-para-invitados).

---

## Por qué existe este spec

SPEC 01 dejó `/` ocupado por la biblioteca (`app/page.tsx` → `components/game-library.tsx`). El prototipo de `references/templates/home-about/home-about/` añade una pantalla que no existía en el prototipo original: una landing comercial con héroe, ventajas, avance de juegos, estadísticas, actividad simulada, precios y llamada final a la acción.

Su `nav.jsx` también cambia: añade los enlaces **Inicio** y **Acerca de**, y el logo deja de llevar a la biblioteca para llevar a la home.

Este spec porta **solo la home**. «Acerca de» (`about.jsx`, con su formulario de contacto y su terminal VAULT-OS) tiene sus propias decisiones y va en un spec aparte; por eso su enlace del Nav tampoco se añade aquí.

### Qué hay en la carpeta de referencia

| Archivo | Qué aporta a este spec |
| --- | --- |
| `home.jsx` (338 líneas) | La pantalla completa: `Home`, `FloatingSilhouettes`, `MiniCard`, `FeatureIcon`, `useReveal`. Es la fuente de verdad. |
| `nav.jsx` (50 líneas) | Nav con los enlaces `Inicio` y `Acerca de`, y el logo apuntando a `home`. |
| `styles.css` (1744 líneas) | Es el `references/templates/styles.css` (950 líneas) **más** cinco bloques nuevos. Solo tres se usan aquí. |
| `about.jsx` | **Fuera de alcance.** Spec futuro. |
| `arcade-vault-standalone.html` | Empaquetado autoejecutable de toda la app (1,4 MB de blobs en base64). No se toca. |

### Bloques nuevos de `styles.css`

| Bloque | Líneas | Decisión |
| --- | --- | --- |
| HOME PAGE | 930–1070 | Se copia. `.reveal` se reescribe al copiarla (ver paso 5); `.reveal.in` se descarta. |
| ABOUT PAGE | 1071–1150 | No se copia. Va con el spec de «Acerca de». |
| GAMEPAD | 1151–1509 | No se copia. Estilos de un mando con D-pad y botones A/B que ningún `.jsx` de esta carpeta usa. |
| Theme variants | 1510–1620 | No se copia. Variantes de color del mismo mando inexistente. |
| ACTIVITY | 1621–1671 | Se copia. Ticker y tabla de top jugadores. |
| PRICING | 1672–1725 | Se copia. De 1726 al final son reglas del stylesheet original (`.fade-in`, `.spinner`…) que SPEC 01 ya portó. |

Total a copiar: ~265 líneas. Total descartado: ~470 líneas de CSS muerto.

---

## Alcance

**Dentro:**

- Nueva ruta `/` con la landing completa: héroe, `// 01 ¿POR QUÉ ARCADE VAULT?`, `// 02 JUEGOS DISPONIBLES AHORA`, banda de estadísticas, `// 03 ACTIVIDAD EN VIVO`, `// 04 PRECIOS` y llamada final.
- Mudanza de la biblioteca de `/` a `/juegos`, sin cambios en su contenido.
- Reapuntado de los seis enlaces que hoy van a `/` y que significan «volver al grid de juegos».
- Enlace **Inicio** en el Nav (barra y panel móvil), con el estado activo recalculado.
- Copia de los bloques HOME PAGE, ACTIVITY y PRICING a `app/globals.css`.
- Animación de entrada por scroll en CSS puro, sin JavaScript: las secciones son visibles siempre y la animación es una mejora opcional.
- Siluetas pixel flotantes (8 SVG) e iconos pixel de las tarjetas de ventajas (4 SVG), portados tal cual.
- Toda la copia en español y los números con `toLocaleString("es-ES")`.

**Fuera de alcance (para specs futuros):**

- La pantalla «Acerca de» y su formulario de contacto (`about.jsx`), y su enlace en el Nav.
- Los estilos GAMEPAD y sus variantes de tema.
- Datos reales en «ACTIVIDAD EN VIVO» y «TOP JUGADORES · HOY». Son listas fijas escritas a mano.
- Backend, API o WebSocket que alimente la actividad. Nada es «en vivo» de verdad.
- Pasarela de pago o planes de pago detrás de la sección de precios. Es una sección informativa: el plan cuesta 0 €.
- Acordeón interactivo en las preguntas frecuentes. Las tres van abiertas, como en el prototipo.
- Redirección de `/` antigua a `/juegos`. Quien tenga la URL guardada aterriza en la home, que es correcto.
- `sitemap.ts`, `robots.txt` y metadata por ruta.
- Runner de tests.

---

## Modelo de datos

**Este spec no introduce estructuras persistentes.** No toca `localStorage`, ni `av_user`, ni `av_scores`, ni `lib/session.tsx`.

Lo único que introduce son cuatro constantes de presentación, declaradas en el módulo de la página (fuera del componente) y tipadas en el propio archivo:

```ts
// app/page.tsx — datos literales de la landing, no derivados de GAMES
type Feature = { icon: FeatureIconKind; title: string; desc: string; color: NeonColor };
// FeatureIconKind = "GAMEPAD" | "FREE" | "TROPHY" | "ROCKET", exportado por components/home-icons.tsx
// NeonColor       = "cyan" | "magenta" | "yellow" | "green"
type Stat    = { n: string; u: string; s: string };
type Tick    = { player: string; game: string; score: number; when: string; color: "cyan" | "magenta" | "yellow" | "green" };
type TopRow  = { rank: number; player: string; score: number };

const FEATURES: Feature[];  // 4 entradas
const STATS: Stat[];        // 3 entradas
const TICKER: Tick[];       // 7 entradas
const TOP_TODAY: TopRow[];  // 5 entradas
```

Valores heredados del prototipo sin cambios, con una única corrección:

- `STATS[0]` pasa de `{ n: "12+", u: "JUEGOS", s: "Y CONTANDO" }` a `{ n: "8", u: "JUEGOS", s: "Y CONTANDO" }`. El prototipo anunciaba 12 juegos y `lib/games.ts` tiene 8. Es una constante escrita a mano, no `GAMES.length`.
- El rail de juegos sí sale de datos reales: `GAMES.slice(0, 6)`, igual que el prototipo.

---

## Plan de implementación

Cada paso deja el proyecto compilando y navegable.

1. **CSS.** Copiar a `app/globals.css`, dentro de `@layer components` y al final del bloque portado, las líneas 930–1070 (HOME PAGE), 1621–1671 (ACTIVITY) y 1672–1725 (PRICING) de `references/templates/home-about/home-about/styles.css`. Sin reescribir a utilidades Tailwind. Añadir `@keyframes bounce`, `float`, `tickin` y `pulse-led` si no están ya. Prueba manual: `npm run dev` arranca y la biblioteca se ve igual que antes.

2. **Mover la biblioteca.** Crear `app/juegos/page.tsx` con el contenido actual de `app/page.tsx` (héroe `ARCADE VAULT` + `<GameLibrary />`), renombrando el componente a `GamesPage`. `components/game-library.tsx` no se toca. Prueba manual: `/juegos` muestra las 8 tarjetas y `/` sigue mostrando la biblioteca duplicada; se resuelve en el paso 6.

3. **Reapuntar enlaces.** Cambiar `/` por `/juegos` en los seis sitios donde significa «volver al grid»:
   - `app/juego/[id]/not-found.tsx:19`
   - `app/juego/[id]/page.tsx:63` («VOLVER AL VAULT»)
   - `components/player.tsx:127` («VOLVER AL VAULT» del modal de fin)
   - `components/hall-of-fame.tsx:109`
   - `components/auth-form.tsx:30` (`router.push` tras iniciar sesión)
   - `components/auth-form.tsx:148` («JUGAR COMO INVITADO»)

4. **Nav.** Añadir el enlace `Inicio` antes de `Biblioteca`, en la barra y en el panel móvil. Redefinir los activos: `isHome = pathname === "/"`; `isLibrary = pathname === "/juegos" || pathname.startsWith("/juego") || pathname.startsWith("/jugar")`. El logo mantiene `href="/"` pero su `aria-label` pasa a «Arcade Vault, ir al inicio». No se añade «Acerca de».

5. **Animación de entrada, en CSS.** La clase `.reveal` del prototipo se reescribe al copiarla: en vez de `opacity: 0` a la espera de que JavaScript añada `.in`, la sección es **visible siempre** y la animación se declara con scroll-driven animations dentro de `@supports (animation-timeline: view())`.

   ```css
   .reveal { opacity: 1; transform: none; }

   @supports (animation-timeline: view()) {
     .reveal {
       animation: reveal-in linear both;
       animation-timeline: view();
       animation-range: entry 0% entry 50%;
     }
   }
   ```

   El fotograma `reveal-in` va de `opacity: 0; translateY(24px)` a visible, es decir la misma animación que hacía el prototipo. Bajo `prefers-reduced-motion: reduce` se anula con `animation: none`. No hay componente `Reveal` ni `IntersectionObserver`: las secciones llevan la clase directamente y la página no contiene ningún componente cliente.

6. **`app/page.tsx` — la home.** Server Component que sustituye el contenido actual. Estructura, en orden:
   - `<section className="home-hero">` con `<FloatingSilhouettes />`, el eyebrow `▸ INSERTA UNA MONEDA_`, el título en tres líneas (`EL ARCADE` / `CLÁSICO ESTÁ` / `DE VUELTA`), el subtítulo, los dos CTA (`▶ EXPLORAR JUEGOS` → `/juegos`, `✦ CREAR CUENTA` → `/acceso`) y el indicador `DESLIZA ▼`.
   - `// 01` ¿POR QUÉ ARCADE VAULT? con las 4 tarjetas de `FEATURES` y su `transitionDelay` escalonado de 80 ms.
   - `// 02` JUEGOS DISPONIBLES AHORA con `GAMES.slice(0, 6)` en `MiniCard` y el botón `VER TODOS LOS JUEGOS →` a `/juegos`.
   - Banda `home-stats` con las 3 entradas de `STATS`.
   - `// 03` ACTIVIDAD EN VIVO con las dos tarjetas: ticker de `TICKER` (7 filas, `animationDelay` de 60 ms por fila) y `TOP JUGADORES · HOY` con las 5 filas de `TOP_TODAY`, la barra `tp-fill` al `100 - i*16` % y el enlace `VER SALÓN →` a `/salon`.
   - `// 04` PRECIOS con la tarjeta `JUGADOR VAULT` ($0 / SIEMPRE, 6 ventajas, botón `EMPEZAR GRATIS →` a `/acceso`, sello `FREE PLAY`) y las 3 preguntas frecuentes.
   - `home-final` con `¿LISTO PARA JUGAR?` y `INSERTAR MONEDA →` a `/juegos`.

   Todos los `onClick={() => navigate(...)}` del prototipo se convierten en `<Link>`. Las seis secciones posteriores al héroe llevan la clase `reveal` junto a la suya (`<section className="reveal home-section">`).

7. **`components/home-icons.tsx`.** Port de `FloatingSilhouettes` (8 SVG: fantasma, invasor, cangrejo, disparo, ovni, moneda, corazón y cruceta) y `FeatureIcon` (`GAMEPAD`, `FREE`, `TROPHY`, `ROCKET`). Son SVG estáticos: Server Components, sin `"use client"`. `strokeWidth` y `viewBox` en camelCase de JSX; `aria-hidden="true"` en el contenedor de siluetas.

8. **`components/mini-card.tsx`.** Tarjeta reducida del rail: `<Link href={`/juego/${game.id}`} className="mini-card">` con `mini-cover` (`div.cover-bg` + la clase de portada del juego), `mini-title` y `mini-cat`. Es distinta de `components/game-card.tsx`, que se queda intacta.

9. **Metadata.** `app/page.tsx` exporta `metadata` con el título de la landing; `app/juegos/page.tsx` exporta el suyo («Biblioteca · Arcade Vault»). El `title` global de `app/layout.tsx` no cambia.

10. **Verificación final.** `npx next typegen`, `npm run lint`, `npx tsc --noEmit` y `npm run build`. Recorrer las seis rutas en el navegador comprobando el checklist de abajo.

---

## Criterios de aceptación

**Compilación y tipos**

- [ ] `npm run build` termina sin errores.
- [ ] `npm run lint` termina sin errores.
- [ ] `npx tsc --noEmit` termina sin errores.
- [ ] La consola del navegador no muestra errores ni avisos de hidratación en `/` ni en `/juegos`.

**Rutas**

- [ ] `/` muestra la landing, no el grid de juegos.
- [ ] `/juegos` muestra el héroe `ARCADE VAULT` y las 8 tarjetas, igual que antes de este spec.
- [ ] `/juego/serpentina`, `/jugar/serpentina`, `/acceso` y `/salon` siguen funcionando sin cambios visuales.
- [ ] Ningún enlace de la aplicación apunta a `/` esperando encontrar el grid: `grep -rn 'href="/"' app components` solo devuelve el logo y el enlace «Inicio» del Nav.

**Nav**

- [ ] El Nav muestra tres enlaces: Inicio, Biblioteca y Salón de la Fama. No aparece «Acerca de».
- [ ] En `/` está activo «Inicio» y no «Biblioteca».
- [ ] En `/juegos`, `/juego/caida` y `/jugar/caida` está activo «Biblioteca» y no «Inicio».
- [ ] El panel móvil (por debajo de 860 px) incluye también «Inicio».
- [ ] El logo lleva a `/`.

**Héroe**

- [ ] El título aparece en tres líneas: `EL ARCADE` en blanco, `CLÁSICO ESTÁ` en degradado cian y `DE VUELTA` en degradado magenta.
- [ ] Se ven 8 siluetas pixel flotando con animación `float`, sin capturar clics (`pointer-events: none`).
- [ ] `▶ EXPLORAR JUEGOS` lleva a `/juegos` y `✦ CREAR CUENTA` a `/acceso`.

**Secciones**

- [ ] Los kickers se leen `// 01`, `// 02`, `// 03` y `// 04` en ese orden.
- [ ] La sección de ventajas muestra 4 tarjetas, cada una con su icono pixel y su color (cian, amarillo, magenta, verde).
- [ ] El rail muestra exactamente 6 juegos, los 6 primeros de `GAMES`, cada uno con su portada CSS.
- [ ] Pulsar una minicard lleva a `/juego/[id]` de ese juego.
- [ ] `VER TODOS LOS JUEGOS →` lleva a `/juegos`.
- [ ] Las estadísticas se leen `8 / JUEGOS / Y CONTANDO`, `MILES / DE PARTIDAS / JUGADAS CADA DÍA` y `GLOBAL / RANKING / COMPITE CON EL MUNDO`. En ningún sitio aparece «12+».
- [ ] El ticker muestra 7 filas; la primera es `NEONFOX ▸ Caída +184.220 hace 2 min`.
- [ ] El top del día muestra 5 filas, con la #01 en dorado, la #02 en plata y la #03 en bronce, y barras decrecientes.
- [ ] `VER SALÓN →` lleva a `/salon`.
- [ ] La tarjeta de precios muestra `$0 / SIEMPRE`, 6 ventajas con `✔` y el sello `FREE PLAY`; `EMPEZAR GRATIS →` lleva a `/acceso`.
- [ ] Se muestran las 3 preguntas frecuentes con su respuesta visible, sin desplegable.
- [ ] `INSERTAR MONEDA →` del cierre lleva a `/juegos`.

**Animación de entrada**

- [ ] **Con JavaScript desactivado en el navegador, `/` muestra las seis secciones completas.** Este criterio manda sobre los demás de este bloque.
- [ ] En un navegador con soporte de `animation-timeline`, las secciones se animan al entrar en el viewport con el scroll.
- [ ] En un navegador sin ese soporte, las secciones se ven desde el principio, sin efecto de entrada y sin quedar ocultas.
- [ ] Con `prefers-reduced-motion: reduce` activo, todas las secciones son visibles y no se animan.
- [ ] `grep -rn "use client" app/page.tsx components/home-icons.tsx components/mini-card.tsx` no devuelve nada: la portada no tiene componentes cliente.

**Idioma y formato**

- [ ] Toda la copia visible está en español, con acentos correctos.
- [ ] Las puntuaciones del ticker y del top usan separador de miles `.` (formato es-ES).

---

## Decisiones

- **Sí:** la home en `/` y la biblioteca en `/juegos`. Era el objetivo explícito: que la landing sea lo que aparece al cargar la aplicación.
- **No:** dejar la home en `/inicio`. Hubiera sido lo menos invasivo, pero entonces la landing no sería la primera pantalla.
- **Sí:** `/juegos` en plural, decisión del usuario. Convive sin conflicto con `/juego/[id]`, que es otro segmento del App Router.
- **No:** renombrar `/juego/[id]` para alejarlo de `/juegos`. Ya está implementado y enlazado; el parecido es solo visual para quien lea el árbol de archivos.
- **No:** redirigir `/` → `/juegos` para las URL antiguas. La home es una landing legítima para quien llega a la raíz; una redirección la haría inalcanzable.
- **Sí:** «VOLVER AL VAULT» y el destino tras iniciar sesión apuntan a `/juegos`. «El Vault» es el grid de juegos, y tras autenticarte quieres aterrizar donde se juega, no en la portada comercial.
- **Sí:** Server Component para la página, sin ningún componente cliente. La landing es contenido estático: es lo que más gana con renderizado en servidor.
- **No:** `IntersectionObserver` en un componente cliente para la animación de entrada. Se probó y se descartó: hacía que **la visibilidad del contenido dependiera de que se ejecutara JavaScript**, y al no dispararse el observador la portada se quedaba en el héroe con las seis secciones presentes en el HTML pero a `opacity: 0`. Ningún contenido debe depender de JavaScript para verse.
- **No:** `"use client"` en toda la página, como en el prototipo. Mandaría al cliente ~300 líneas de JSX que no lo necesitan.
- **No:** animaciones CSS disparadas al cargar la página. Las secciones de más abajo se animarían fuera de la vista y el efecto se perdería. Las scroll-driven animations no tienen ese problema: van atadas a la posición de scroll, no al reloj.
- **Sí:** guardar la animación tras `@supports (animation-timeline: view())`. En un navegador que no la soporte, las secciones se ven sin efecto de entrada. Se degrada a contenido visible, nunca a contenido oculto.
- **Sí:** datos literales en actividad, top del día y estadísticas. SPEC 01 ya asume datos simulados en toda la aplicación; la landing es el sitio donde menos daño hace.
- **No:** derivar el ticker de `seededScores`. Perdería los textos «hace 2 min» y los nombres elegidos, y no aportaría veracidad: seguirían siendo datos inventados.
- **Sí:** corregir «12+ JUEGOS» a «8». El prototipo prometía una cifra que la aplicación no tiene.
- **Sí:** copiar solo los tres bloques de CSS que usa la home. GAMEPAD y sus variantes de tema (~470 líneas) pertenecen a una feature de mando que ningún archivo de esta carpeta renderiza.
- **No:** reescribir el CSS nuevo a utilidades Tailwind. Misma razón que en SPEC 01: los degradados con `background-clip: text`, las siluetas flotantes y los `keyframes` no ganan nada.
- **Sí:** «Acerca de» fuera de este spec, enlace incluido. Añadir el enlace sin la ruta dejaría un 404 alcanzable desde el Nav.
- **Sí:** `MiniCard` como componente propio en vez de reutilizar `GameCard`. Son dos tarjetas distintas: `GameCard` tiene tilt 3D, descripción, insignia y botón; `MiniCard` es portada y dos líneas.

---

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Quedan enlaces apuntando a `/` esperando el grid, y el usuario aterriza en la landing sin darse cuenta de que «volver» ya no funciona | El paso 3 enumera los seis archivos y línea exactos, y hay un criterio de aceptación que lo verifica con `grep`. |
| Contenido invisible si la animación no llega a ejecutarse | Eliminado de raíz: `.reveal` parte de `opacity: 1`. El estado oculto solo existe dentro de los fotogramas de la animación, y solo cuando el navegador la soporta. |
| Doble padding horizontal: `.av-main` ya tiene el suyo y `.home-section` añade `padding: 0 32px` con su propio `max-width` | Se revisa en el navegador al cerrar el paso 6; si hace falta, la home se saca del ancho de `.av-main` en lugar de tocar el CSS portado. |
| `.home-hero` usa `min-height: calc(100vh - 60px)` asumiendo un Nav de 60 px | Se verifica contra la altura real de `.av-nav` en `globals.css` al copiar el bloque. |
| Colisión de nombres de `@keyframes` entre el CSS nuevo y el ya portado (`float`, `bounce`, `pulse-led`) | Al copiar, se comprueba si cada `@keyframes` ya existe en `globals.css`; si existe con otra definición, el nuevo se renombra con sufijo `-home`. |
| `transitionDelay` escalonado en tarjetas y estadísticas que no se aprecia, porque la opacidad la controla el `.reveal` del padre | Es el comportamiento del prototipo. Se porta igual; no se intenta mejorarlo en este spec. |

---

## Cambios posteriores (2026-11-09)

Cambios hechos sin spec propio a petición del usuario (PR #28). Sustituyen a lo que dicen el plan y los criterios de aceptación de arriba en estos puntos:

| Parte de la landing | Antes (este spec) | Ahora |
| --- | --- | --- |
| Botones del héroe | `▶ EXPLORAR JUEGOS` y `✦ CREAR CUENTA` | Ninguno. El héroe ya no tiene `min-height: calc(100vh - 60px)`: mide lo que su contenido (`padding: 96px 32px 24px`) y la primera sección sube a `margin-top: 40px`. En móvil (≤ 720 px) las siluetas pasan a 40 px y `opacity: 0.28` para no tapar el texto. |
| `MiniCard` del rail | `<Link>` a `/juego/[id]` | `<div>` de muestra, sin enlace, sin cursor de mano ni elevación al pasar el ratón. |
| Botón bajo el rail | `VER TODOS LOS JUEGOS →` a `/juegos` | Eliminado. |
| Ticker de ACTIVIDAD EN VIVO | 7 filas literales de `TICKER` | Las 7 puntuaciones más recientes de `scores` (`getRecentActivity` en `lib/supabase/activity.ts`), con el título y el color del juego, y «hace N min / h / días» calculado en el servidor (`timeAgo` de `lib/format.ts`). El alias enlaza a `/jugador/[alias]` si la fila tiene perfil. |
| TOP JUGADORES · HOY | 5 filas literales de `TOP_TODAY`, barra al `100 - i*16` % | Los 5 jugadores con más puntos **sumados** hoy, contando el día con la zona `Europe/Madrid` (RPC `get_top_players_today`). Agrupa por `user_id`, o por `player_name` en las filas de invitado. La barra es proporcional al primero. |
| Sin datos | — | Mensaje `.activity-empty` en lugar de las filas: «Todavía no hay partidas guardadas…» / «Nadie ha puntuado hoy todavía…». |
| `// 04 PRECIOS` | Tarjeta `JUGADOR VAULT` y 3 preguntas frecuentes | Eliminada, con su bloque de CSS PRICING. |
| Cierre | `INSERTAR MONEDA →` a `/juegos` | `JUGAR SIN REGISTRARTE →` a `/juegos` y `CREAR CUENTA` a `/acceso?registro`, que abre directamente la pestaña de registro. Lo hace la prop `startOnSignUp` de `AuthForm`; sin el parámetro, `/acceso` sigue abriendo ENTRAR. Texto: «Gratis. Juega como invitado o crea tu cuenta para guardar tus puntuaciones en el ranking.» |

**Criterios de aceptación que ya no aplican:** `▶ EXPLORAR JUEGOS…`, «Pulsar una minicard lleva a `/juego/[id]`», `VER TODOS LOS JUEGOS →…`, «Los kickers se leen… `// 04`» (ahora llegan a `// 03`), «El ticker muestra 7 filas; la primera es `NEONFOX…`», «barras decrecientes», la tarjeta de precios, las 3 preguntas frecuentes e `INSERTAR MONEDA →`.

**Siguen valiendo:** la landing es un Server Component sin `"use client"`, y con JavaScript desactivado se ven todas las secciones, también la actividad, porque se renderiza en el servidor.

**Base de datos:** migración `top_players_today` (solo en el historial de Supabase): función `get_top_players_today(p_limit)` (`security invoker`, `search_path = ''`, `EXECUTE` para `anon` y `authenticated`, límite entre 1 y 20) e índice `scores (created_at desc)`.

### Decisiones de estos cambios

- **Sí:** puntos **sumados** del día para el top, porque es lo que sugería el diseño con sus cifras de seis dígitos. Mezcla juegos de escalas distintas (Asteroids pesa más que Snake). Si se quiere otra métrica, como la mejor partida del día, basta con cambiar la RPC.
- **Sí:** calcular «hace N min» en el servidor en cada petición. La página ya es dinámica porque `createClient()` lee las cookies, y así no hace falta un componente cliente.
- **No:** actualización en tiempo real (Realtime o sondeo). «En vivo» significa «al cargar la página».
- **Sí:** quitar los CTA del héroe y `VER TODOS LOS JUEGOS`. Para jugar o registrarse quedan los botones del cierre y el Nav.
- **Sí:** reemplazar `INSERTAR MONEDA` por `JUGAR SIN REGISTRARTE`, porque llevaba al mismo sitio.

---

## Ampliación: créditos diarios para invitados

> **Estado:** Implementado
> **Fecha:** 2026-11-09
> **Objetivo:** Dar valor a la moneda: quien juega sin registrarse tiene **10 créditos al día** y cada partida gasta uno. Puede probar los juegos, pero no jugar sin límite, y su puntuación no se guarda. Con cuenta se juega sin límite.

### Comportamiento

- **Invitado** (sin sesión de Supabase):
  - Empieza cada día con 10 créditos. El día se cuenta en `Europe/Madrid` y los créditos se recargan a las 00:00 de esa zona, no 24 h después de la primera partida.
  - **Cada partida gasta 1 crédito:** entrar en `/jugar/<id>`, pulsar JUGAR DE NUEVO o recargar la página del juego.
  - Ejemplo: entra en Snake (quedan 9) y luego en Tetris (quedan 8).
  - Con 0 créditos, el reproductor no arranca el juego y muestra un modal.
- **Con cuenta:** no gasta créditos y juega sin límite. El Nav muestra `CRÉDITOS · ∞`.
- **La puntuación de un invitado no se guarda** (ya es así desde SPEC 14). El modal de fin de partida invita a iniciar sesión y ahora también dice cuántos créditos quedan.
- **Nav:** `CRÉDITOS · NN` muestra los créditos reales que quedan, en lugar del `03` fijo, en la barra y en el panel móvil. Mientras carga muestra `CRÉDITOS · --`.

### Modelo de datos

**Sin base de datos.** Una cookie firmada por el servidor:

| Campo | Valor |
| --- | --- |
| Nombre | `av_credits` |
| Contenido | `<día AAAA-MM-DD>.<usados 0–10>.<últimoRunId>.<firma>` |
| Firma | HMAC-SHA256 de los tres primeros campos con `CREDITS_SECRET` (variable nueva, solo de servidor, en `specs/.env.template`). |
| Opciones | `httpOnly`, `secure` en producción, `sameSite: "lax"`, `path: "/"`. Caduca a las 00:00 de `Europe/Madrid` del día siguiente. |

**Reglas de lectura de la cookie:**
- Si no hay cookie, la firma no cuadra o el día no es hoy, se cuenta como 0 créditos usados.
- Manipular la cookie no da créditos de más: como mucho la invalida, y eso equivale a empezar el día.
- **Constante:** `DAILY_CREDITS = 10`, en `lib/credits.ts`, junto con las funciones de firmar, verificar y calcular el día.

### API

`app/api/credits/route.ts`, Route Handler. Los Server Components no pueden escribir cookies; un Route Handler sí.

**`GET /api/credits`** → `{ unlimited: boolean, left: number, resetsAt: string }`
- Solo lee, no gasta.
- Con sesión devuelve `unlimited: true`.

**`POST /api/credits`** con cuerpo `{ runId: string }` → `{ ok: boolean, unlimited: boolean, left: number, resetsAt: string }`
- Con sesión: `ok: true` sin tocar nada.
- Sin sesión y con créditos: gasta 1, reescribe la cookie y devuelve `ok: true`.
- Sin créditos: devuelve `ok: false` y no toca la cookie.
- **Idempotente por `runId`:** si llega el mismo `runId` que el último cobrado, no vuelve a cobrar. El reproductor genera un `runId` por partida (`crypto.randomUUID()` al montar y en cada JUGAR DE NUEVO), así que el doble montaje de React en desarrollo o un reintento de red no gastan dos créditos.

La sesión se comprueba con `createClient()` de `lib/supabase/server.ts` y `auth.getClaims()`, igual que en `proxy.ts`.

### Cliente

- **`lib/credits-client.tsx`:** `CreditsProvider` y `useCredits()` → `{ ready, unlimited, left, spend(runId) }`.
  - Se monta dentro de `SessionProvider` en `app/layout.tsx`.
  - Llama a `GET` al cargar y otra vez cuando cambia la sesión (login o logout).
  - `spend` llama a `POST` y actualiza `left`.
- **Reproductores de los cinco juegos** (`components/<id>-player.tsx`): el canvas no se monta hasta que `spend(runId)` devuelve `ok`.
  - Mientras tanto el CRT muestra `INSERTANDO MONEDA…`.
  - Con `ok: false` muestra el modal **SIN CRÉDITOS**: «Has gastado tus 10 partidas gratis de hoy. Vuelven a las 00:00.», con los botones `CREAR CUENTA` (`/acceso?registro`) e `INICIAR SESIÓN` (`/acceso`) y el enlace `VOLVER AL VAULT`.
  - JUGAR DE NUEVO genera un `runId` nuevo y vuelve a pasar por `spend`.
  - La lógica común va en un hook (`useCreditGate()`) para no repetirla en cinco ficheros.
- **El reproductor genérico** `/jugar/[id]` (juegos sin implementación) no gasta créditos.

### Plan de implementación

1. **`lib/credits.ts`:**
   - `DAILY_CREDITS`.
   - `madridDay(now)` y `nextMadridMidnight(now)`.
   - `signCredits` y `readCredits` con `node:crypto` (`createHmac`, `timingSafeEqual`).
   - Añadir `CREDITS_SECRET` a `specs/.env.template`.
2. **`app/api/credits/route.ts`:** `GET` y `POST` según la sección API.
3. **`lib/credits-client.tsx`:** `CreditsProvider` y `useCredits()`; montarlo en `app/layout.tsx`.
4. **`components/nav.tsx`:** sustituir los dos `CRÉDITOS · 03` por el valor de `useCredits()`.
5. **`useCreditGate()`:** aplicarlo en los cinco reproductores, con el estado `INSERTANDO MONEDA…`, el modal SIN CRÉDITOS y el `runId` nuevo en cada reinicio.
6. **Modal de fin de partida del invitado:** añadir «Te quedan N créditos hoy».
7. **Verificación:**
   - `npm run lint`, `npx tsc --noEmit` y `npm run build`.
   - Prueba con Playwright como invitado: 10 partidas entre varios juegos y JUGAR DE NUEVO; la 11.ª muestra SIN CRÉDITOS.
   - Prueba con un bot con sesión: juega más de 10 sin límite.

### Criterios de aceptación

- [ ] Un invitado nuevo ve `CRÉDITOS · 10` en el Nav.
- [ ] Entrar en Snake deja 9 y entrar después en Tetris deja 8; JUGAR DE NUEVO gasta otro.
- [ ] Recargar la página del juego gasta un crédito. El doble montaje de desarrollo no gasta dos.
- [ ] Con 0 créditos, `/jugar/<id>` no arranca el juego y muestra SIN CRÉDITOS con `CREAR CUENTA` e `INICIAR SESIÓN`.
- [ ] Editar o borrar la cookie `av_credits` a mano nunca da más de 10 créditos en el mismo día.
- [ ] A las 00:00 de `Europe/Madrid` el invitado vuelve a tener 10.
- [ ] Con sesión iniciada: `CRÉDITOS · ∞`, no se gasta nada y se puede jugar más de 10 partidas.
- [ ] Al iniciar sesión estando a 0, se puede jugar sin recargar; al cerrar sesión se vuelve a los créditos del invitado.
- [ ] La puntuación de un invitado sigue sin guardarse, y el modal de fin muestra los créditos que quedan.
- [ ] `/jugar/[id]` (reproductor genérico) no gasta créditos.
- [ ] Lint, tipos y build sin errores; sin avisos de hidratación.

### Decisiones

- **Sí:** cookie firmada en lugar de `localStorage`. No se puede editar a mano para darse créditos, y no necesita base de datos.
- **No:** guardar los créditos en Supabase por IP. Una IP compartida (casa, instituto) repartiría los 10 créditos entre varias personas, y obligaría a guardar IPs, que son datos personales.
- **Aceptado:** borrar las cookies o abrir una ventana privada da 10 créditos nuevos. Sin cuenta no hay forma razonable de identificar a alguien. El objetivo es que jugar sin límite cueste un esfuerzo y que registrarse sea lo cómodo, no impedirlo por completo.
- **Sí:** cada partida gasta un crédito, también JUGAR DE NUEVO. Si no, con un crédito se jugaría sin fin sin salir de la página.
- **Sí:** cobrar desde un Route Handler llamado por el reproductor, no en `proxy.ts` al pedir `/jugar/<id>`. Los prefetch de `<Link>` y las peticiones RSC gastarían créditos sin que nadie jugase.
- **Sí:** idempotencia por `runId`, por el doble montaje de React en desarrollo y por los reintentos.
- **Sí:** recarga a medianoche de `Europe/Madrid`, la misma zona que usa la app para las fechas (`lib/format.ts`).

#### Desviaciones al implementar

- **Componentes:** el overlay `INSERTANDO MONEDA…` y el modal **SIN CRÉDITOS** van en `components/credit-gate.tsx`, junto con `CreditsLeft` para el modal de fin.
  - `CreditGateOverlay` se pinta dentro del CRT.
  - `NoCreditsModal` va fuera del CRT, junto al modal de fin.
  - `useCreditGate()` está en `lib/credits-client.tsx`.
- **Error de red:** si `POST` falla por la red, el CRT muestra «NO SE PUDIERON COMPROBAR TUS CRÉDITOS» con un botón REINTENTAR, que repite el mismo `runId` y por tanto no cobra dos veces. Además, sin partida cobrada están desactivados PAUSA, FIN y el gamepad.
- **Lecturas y cobros cruzados:** al abrir un juego, el `POST` del reproductor sale antes que el `GET` del provider, porque los efectos de los hijos se ejecutan primero. El `GET` viaja con la cookie anterior al cobro y su respuesta llegaba después, devolviendo el Nav a 10.
  - Ahora un `GET` solo se aplica si no había ningún cobro en marcha al enviarlo ni empezó otro mientras tanto.
  - Entre varios cobros, manda el último iniciado.
- **`runId`:** se genera con `useState(crypto.randomUUID)`. No se pinta, así que el que se genera en el servidor no causa desajustes de hidratación.
- **`CREDITS_SECRET`:** se generó un valor aleatorio en `.env.local`. Sin él, `/api/credits` responde 500 y el reproductor muestra REINTENTAR.

#### Verificación

Prueba con Playwright como invitado en un contexto de navegador nuevo:

| Paso | Nav |
| --- | --- |
| Inicio | 10 |
| Snake | 9 |
| Tetris | 8 |
| FIN | modal «Te quedan 8 créditos hoy» |
| JUGAR DE NUEVO | 7 |
| Recargar | 6 |
| Seis juegos más | 0 |

- La 11.ª partida muestra SIN CRÉDITOS, sin canvas y con FIN desactivado.
- Al iniciar sesión con un bot: `∞` y 3 partidas más.
- Al cerrar sesión: vuelve a `00`.
- Con `curl`: repetir el `runId` no cobra, la 11.ª devuelve `ok: false`, una cookie manipulada vale lo mismo que no tener cookie y un `runId` inválido da 400.
- `npx tsc --noEmit`, `npm run lint` (solo los avisos que ya había en `references/`) y `npm run build` sin errores.
- No se probó el criterio «iniciar sesión estando a 0 y jugar sin recargar» en la misma página: el código vuelve a cobrar al cambiar la sesión, pero la prueba inició sesión en `/acceso` y volvió a entrar al juego.

### Riesgos

| Riesgo | Mitigación |
| --- | --- |
| `CREDITS_SECRET` sin definir en producción | `lib/credits.ts` lanza un error claro al firmar si falta; se añade a la plantilla de variables y al despliegue. |
| Los bots Playwright de invitado (`scripts/bots`) se quedan sin créditos | `bots:jugar` juega con sesión iniciada, así que no le afecta. Las pruebas como invitado empiezan con un contexto de navegador nuevo, que trae 10 créditos. |
| Un invitado pierde el crédito si cierra la pestaña nada más entrar | Es el comportamiento pedido: entrar a jugar gasta el crédito. |
| Diferencia de reloj entre servidor y navegador | El día lo calcula siempre el servidor; el cliente solo muestra `resetsAt`. |

---

## Lo que **no** entra en este spec

- La pantalla «Acerca de» y su formulario de contacto.
- ~~Datos reales o en tiempo real en «ACTIVIDAD EN VIVO» y «TOP JUGADORES · HOY».~~ Los datos reales llegaron el 2026-11-09 (ver Cambios posteriores); el tiempo real sigue fuera.
- ~~Cualquier forma de cobro detrás de la sección de precios.~~ La sección se eliminó el 2026-11-09.
- Los estilos GAMEPAD y sus variantes de tema.
- Preguntas frecuentes desplegables.
- Redirección de `/` a `/juegos`, `sitemap.ts` y `robots.txt`.
- Runner de tests.

Cada uno de estos puntos, si llega, va en su propio spec.
