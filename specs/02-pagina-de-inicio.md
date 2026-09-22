# SPEC 02 — Página de inicio (landing) en la raíz

> **Estado:** Implementado
> **Depende de:** SPEC 01
> **Fecha:** 2026-09-22
> **Objetivo:** Portar la landing de `references/templates/home-about/` a la ruta `/` y mover la biblioteca de juegos a `/juegos`, de modo que al cargar la aplicación aparezca la página de inicio.

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

## Lo que **no** entra en este spec

- La pantalla «Acerca de» y su formulario de contacto.
- Datos reales o en tiempo real en «ACTIVIDAD EN VIVO» y «TOP JUGADORES · HOY».
- Cualquier forma de cobro detrás de la sección de precios.
- Los estilos GAMEPAD y sus variantes de tema.
- Preguntas frecuentes desplegables.
- Redirección de `/` a `/juegos`, `sitemap.ts` y `robots.txt`.
- Runner de tests.

Cada uno de estos puntos, si llega, va en su propio spec.
