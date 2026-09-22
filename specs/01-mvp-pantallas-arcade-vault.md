# SPEC 01 — MVP visual: las cinco pantallas de Arcade Vault

> **Estado:** Implementado
> **Depende de:** —
> **Fecha:** 2026-09-22
> **Objetivo:** Portar a Next.js App Router las cinco pantallas del prototipo de `references/templates/` (biblioteca, detalle, reproductor, acceso y salón de la fama) como MVP puramente visual, sin ningún juego real ni backend.

---

## Por qué existe este spec

El proyecto Next.js está en estado scaffold: `app/page.tsx` sigue siendo el contenido por defecto de create-next-app. El producto ya está diseñado y funcionando en `references/templates/`, un prototipo React 18 UMD sin build.

Dos trabajos ya están hechos y este spec los da por buenos:

- `app/layout.tsx` ya carga las fuentes con `next/font` (Press Start 2P, JetBrains Mono, Courier Prime), fija la metadata en español y monta `.av-bg`, `.av-noise` y `.av-root`.
- `app/globals.css` (1002 líneas) ya contiene el port completo de `references/templates/styles.css` dentro de `@layer components`, con los tokens neón en `:root` y expuestos a Tailwind en `@theme inline`.

Por tanto el trabajo restante es de componentes y rutas, no de estilos. Este spec no reescribe CSS.

Nota de corrección: `CLAUDE.md` dice que `GAMES` tiene nueve entradas. Tiene **ocho**. El dato correcto es ocho.

---

## Alcance

**Dentro:**

- Cinco rutas reales del App Router: `/` (biblioteca), `/juego/[id]` (detalle), `/jugar/[id]` (reproductor), `/acceso` (autenticación) y `/salon` (salón de la fama).
- `Nav` y `footer` montados una sola vez en `app/layout.tsx`, incluido el panel lateral móvil con su backdrop.
- Port tipado de `references/templates/data.jsx` a TypeScript: los 8 juegos, las 5 categorías y la función `seededScores`.
- Biblioteca: héroe, buscador por nombre, chips de categoría, grid de tarjetas con efecto tilt 3D y estado vacío «NO HAY RESULTADOS».
- Detalle: portada, etiquetas, descripción larga, tira de estadísticas, botones de acción y leaderboard lateral de 10 filas.
- Reproductor: HUD estático (jugador, puntuación, vidas, nivel), arena CRT decorativa, pausa con overlay y modal de fin de juego con guardado de puntuación. Ningún valor cambia solo.
- Acceso: tarjeta con pestañas «INICIAR SESIÓN» / «CREAR CUENTA», campos, entrada como invitado y botones sociales decorativos.
- Salón de la fama: pestañas por juego, podio de tres puestos, tabla de 12 filas y fila «▸ TU MEJOR MARCA» leída de las puntuaciones guardadas.
- Sesión de usuario en cliente sobre `localStorage`, con las claves `av_user` y `av_scores` del prototipo.
- Toda la copia de interfaz en español y los números formateados con `toLocaleString("es-ES")`.

**Fuera de alcance (para specs futuros):**

- Implementar cualquier juego real. Ninguno de los 8 títulos será jugable.
- Simular la partida. El HUD no se autoincrementa: no hay temporizadores, ni bucle de juego, ni puntuación que suba sola.
- Backend, base de datos o API. No hay rutas de API en este spec.
- Autenticación real. El formulario de acceso fabrica un usuario con lo que se teclee, igual que el prototipo.
- Login social con Google y GitHub. Los botones se renderizan pero no hacen nada.
- El contador «CRÉDITOS · 03» del Nav es un valor fijo decorativo; no hay economía de créditos.
- Runner de tests y tests automatizados. Es decisión de tooling aparte.
- Reescribir el CSS portado como utilidades Tailwind.
- Server Actions, cookies de sesión y renderizado de sesión en servidor.
- Internacionalización. La aplicación es solo en español.

---

## Modelo de datos

Todo el modelo vive en dos archivos nuevos bajo `lib/`.

### `lib/games.ts`

Port tipado de `references/templates/data.jsx`. Sin cambios en los valores.

```ts
export type GameCategory = "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";
export type GameColor = "cyan" | "magenta" | "yellow" | "green";

export type Game = {
  id: string;        // "bloque-buster", "caida", "serpentina", …
  title: string;     // "BLOQUE BUSTER"
  short: string;     // texto de la tarjeta
  long: string;      // texto del detalle
  cat: GameCategory;
  cover: string;     // clase CSS: "cover-bricks", "cover-snake", …
  color: GameColor;  // variante del botón JUGAR
  best: number;
  plays: string;     // ya formateado: "12.4K"
};

export type ScoreRow = {
  rank: number;
  name: string;
  score: number;
  date: string;      // "DD/MM/2026"
};

export const GAMES: Game[];                    // 8 entradas, en el orden del prototipo
export const CATS: readonly string[];          // ["TODOS", "ARCADE", "PUZZLE", "SHOOTER", "VERSUS"]
export const PLAYERS: readonly string[];       // 18 alias
export function seededScores(seed: number, count?: number): ScoreRow[];
export function getGame(id: string): Game | undefined;
```

`seededScores` conserva exactamente el LCG del prototipo (`s = (s * 9301 + 49297) % 233280`), el mismo orden de llamadas a `rand()` y el mismo `count` por defecto de 12. La salida debe ser idéntica a la del prototipo para la misma semilla.

Semillas en uso, heredadas del prototipo:

- Detalle: `seededScores(id.length * 17 + 3, 10)`.
- Salón: `seededScores(tabId.length * 23 + 7, 12)`.

### `lib/session.tsx`

Sesión y registro de puntuaciones en cliente.

```ts
export type SessionUser = { name: string };           // clave localStorage "av_user"

export type ScoreEntry = {
  game: string;    // Game["id"]
  score: number;
  name: string;
  at: number;      // Date.now()
};                                                    // clave localStorage "av_scores", array

export type Session = {
  user: SessionUser | null;
  ready: boolean;                                     // false hasta leer localStorage
  signIn(user: SessionUser | null): void;
  signOut(): void;
  saveScore(entry: Omit<ScoreEntry, "at">): void;
  bestScoreFor(gameId: string): ScoreEntry | null;    // la entrada de mayor score
};
```

Convenciones:

- El nombre de usuario siempre en mayúsculas, recortado a 10 caracteres.
- `ready` arranca en `false` y pasa a `true` dentro de un `useEffect`. Nada que dependa de `localStorage` se renderiza antes, para evitar desajuste de hidratación.
- Toda lectura y escritura de `localStorage` va envuelta en `try/catch`. Si falla, la sesión queda en memoria y la aplicación sigue funcionando.
- No hay versionado de esquema: se reutilizan las claves del prototipo tal cual.

---

## Plan de implementación

Cada paso deja el proyecto compilando y navegable.

1. **`lib/games.ts`.** Portar `data.jsx` a TypeScript con los tipos de arriba. Prueba manual: `npx tsc --noEmit` pasa.

2. **`lib/session.tsx`.** Crear `SessionProvider` y el hook `useSession` con `user`, `ready`, `signIn`, `signOut`, `saveScore` y `bestScoreFor`. Archivo cliente (`"use client"`).

3. **`components/nav.tsx`.** Port de `nav.jsx` como componente cliente. Usa `usePathname` para el estado activo: `/` y `/juego/*` y `/jugar/*` activan «Biblioteca»; `/salon` activa «Salón de la Fama». Enlaces con `next/link`. Panel móvil y backdrop con `useState`. El botón de sesión muestra `user.name ▾` y llama a `signOut`, o lleva a `/acceso` si no hay usuario.

4. **Cablear `app/layout.tsx`.** Envolver en `SessionProvider`, montar `<Nav />`, `<main className="av-main">{children}</main>` y el `<footer>` con el texto `© 2026 ARCADE VAULT · HECHO CON PIXELES Y NEÓN · v2.6.0`. Prueba manual: `npm run dev` muestra la barra superior y el pie en la página scaffold.

5. **`components/game-card.tsx`.** Port de `GameCard` como componente cliente: portada, etiqueta de categoría, título, descripción corta, insignia de mejor puntuación y botón JUGAR. El efecto tilt en `onMouseMove` y su reseteo en `onMouseLeave`. Toda la tarjeta enlaza a `/juego/[id]`.

6. **`app/page.tsx` — Biblioteca.** Sustituir el scaffold. Héroe con `ARCADE VAULT` e `INSERTA UNA MONEDA PARA JUGAR`. Componente cliente con `useState` para búsqueda y categoría, y `useMemo` para el filtrado. Estado vacío con el bloque «NO HAY RESULTADOS». Prueba manual: buscar «serp» deja una tarjeta; el chip PUZZLE deja una.

7. **`app/juego/[id]/page.tsx` — Detalle.** Server Component que hace `const { id } = await params`, busca el juego y llama a `notFound()` si no existe. Renderiza portada, etiquetas, descripción larga, tira de estadísticas y leaderboard de 10 filas con las tres primeras destacadas. Botón «▶ JUGAR AHORA» enlaza a `/jugar/[id]` y «VOLVER AL VAULT» a `/`.

8. **`app/juego/[id]/not-found.tsx`.** Pantalla de juego inexistente, con el mismo lenguaje visual y un enlace de vuelta a `/`.

9. **`app/jugar/[id]/page.tsx` + `components/player.tsx` — Reproductor.** La página resuelve `params` y pasa el juego al componente cliente. El HUD tiene cuatro campos con valores fijos: `Jugador` (el de la sesión o `INVITADO`), `Puntuación` en `0`, `Vidas` en `♥ ♥ ♥` y `Nivel` en `01`. Ningún valor se autoincrementa: no hay `setInterval` ni bucle de juego. Debajo, la arena CRT decorativa y la barra inferior `SEÑAL OK · {título} · CRT-83 · 60 HZ · CARGA · 1MB`. PAUSA muestra el overlay «EN PAUSA» y cambia su etiqueta a REANUDAR. SALIR vuelve a `/juego/[id]`.

10. **Modal de fin de juego.** Lo abre el botón FIN. Muestra la puntuación final (`0`), un campo de nombre (mayúsculas, máximo 10 caracteres) y «GUARDAR PUNTUACIÓN», que llama a `saveScore` y cambia a la confirmación «▸ PUNTUACIÓN GUARDADA_». «JUGAR DE NUEVO» cierra el modal y devuelve el HUD a su estado inicial; «VOLVER AL VAULT» va a `/`.

11. **`app/acceso/page.tsx` — Acceso.** Componente cliente. Pestañas «INICIAR SESIÓN» y «CREAR CUENTA»; la segunda añade el campo de correo con la animación `slide-in`. Enviar llama a `signIn({ name })` con el usuario en mayúsculas recortado a 10, o `PLAYER1` si está vacío, y navega a `/` con `router.push`. «JUGAR COMO INVITADO» llama a `signIn(null)` y navega a `/`. Los botones sociales quedan inertes.

12. **`app/salon/page.tsx` — Salón de la fama.** Componente cliente. Pestañas con los 8 juegos, podio de 3 puestos en el orden plata–oro–bronce y tabla de 12 filas con retraso de animación de 50 ms por fila.

13. **Fila «TU MEJOR MARCA».** En el salón, si hay usuario y `bestScoreFor(tabId)` devuelve algo, añadir la etiqueta `▸ TU MEJOR MARCA EN {título}` y la fila con el rango calculado sobre las 12 filas simuladas, la puntuación real y la fecha de la entrada en `DD/MM/AAAA`. Sin usuario o sin marca, no se renderiza nada.

14. **Limpieza final.** Eliminar los restos del scaffold que ya no se usan (`public/next.svg`, `public/vercel.svg` y demás assets por defecto). Ejecutar `npx next typegen`, `npm run lint` y `npm run build`.

---

## Criterios de aceptación

**Compilación y tipos**

- [ ] `npm run build` termina sin errores.
- [ ] `npm run lint` termina sin errores.
- [ ] `npx tsc --noEmit` termina sin errores.
- [ ] La consola del navegador no muestra errores ni avisos de hidratación en ninguna de las cinco rutas.

**Navegación**

- [ ] `/`, `/juego/serpentina`, `/jugar/serpentina`, `/acceso` y `/salon` responden y renderizan su pantalla.
- [ ] `/juego/no-existe` muestra la pantalla de no encontrado, no un error.
- [ ] El Nav y el pie aparecen en las cinco rutas, y el Nav no parpadea al navegar entre ellas.
- [ ] En `/juego/serpentina` y en `/jugar/serpentina` el enlace «Biblioteca» del Nav aparece activo.
- [ ] Por debajo de 860 px de ancho el botón ≡ abre el panel lateral y el backdrop lo cierra.

**Biblioteca**

- [ ] Se muestran 8 tarjetas sin filtros aplicados.
- [ ] Escribir `caí` deja visible solo CAÍDA.
- [ ] El chip VERSUS deja visible solo DUELO PIXEL.
- [ ] Una búsqueda sin resultados muestra el bloque «NO HAY RESULTADOS».
- [ ] Pasar el ratón sobre una tarjeta la inclina, y al salir vuelve a su posición.
- [ ] Pulsar una tarjeta o su botón JUGAR lleva a `/juego/[id]`.

**Detalle**

- [ ] El leaderboard lateral muestra 10 filas y las tres primeras llevan estilo destacado.
- [ ] «Mejor global» de CAÍDA se muestra como `184.220`.
- [ ] «▶ JUGAR AHORA» lleva a `/jugar/[id]`.

**Reproductor**

- [ ] El HUD muestra los cuatro campos: Jugador, Puntuación, Vidas y Nivel.
- [ ] La puntuación se queda en `0`, las vidas en `♥ ♥ ♥` y el nivel en `01` indefinidamente.
- [ ] Ningún valor del HUD cambia solo: tras 60 segundos en la pantalla, los cuatro campos siguen igual.
- [ ] El código del reproductor no contiene `setInterval`, `setTimeout` ni `requestAnimationFrame`.
- [ ] Sin sesión el HUD muestra `INVITADO`; con sesión muestra el nombre del usuario.
- [ ] PAUSA muestra el overlay «EN PAUSA» y el botón pasa a decir REANUDAR; REANUDAR lo oculta.
- [ ] FIN abre el modal «FIN DEL JUEGO» con la puntuación final `0`.
- [ ] «GUARDAR PUNTUACIÓN» sustituye el formulario por «▸ PUNTUACIÓN GUARDADA_» y añade una entrada a `av_scores` en localStorage.
- [ ] «JUGAR DE NUEVO» cierra el modal y deja el HUD en su estado inicial.
- [ ] SALIR vuelve a `/juego/[id]`.

**Acceso**

- [ ] «CREAR CUENTA» muestra el campo de correo; «INICIAR SESIÓN» lo oculta.
- [ ] Enviar con el usuario `px_kai` deja `{"name":"PX_KAI"}` en `av_user` y navega a `/`.
- [ ] Enviar con el usuario vacío produce el nombre `PLAYER1`.
- [ ] Tras iniciar sesión, el Nav muestra el nombre y el botón cierra sesión y borra `av_user`.
- [ ] «JUGAR COMO INVITADO» navega a `/` sin dejar usuario en el Nav.

**Salón de la fama**

- [ ] El podio muestra los puestos 02, 01 y 03 en ese orden visual.
- [ ] La tabla muestra 12 filas con los rangos del #01 al #12.
- [ ] Cambiar de pestaña cambia los datos y el título de la fila de marca personal.
- [ ] Sin sesión no aparece la fila «TU MEJOR MARCA».
- [ ] Con sesión y una puntuación guardada en SERPENTINA, la pestaña SERPENTINA muestra esa puntuación real y la pestaña CAÍDA no muestra la fila.

**Idioma y formato**

- [ ] Toda la copia visible está en español, con acentos correctos.
- [ ] Todas las puntuaciones usan separador de miles `.` (formato es-ES).

---

## Decisiones

- **Sí:** rutas reales del App Router (`/`, `/juego/[id]`, `/jugar/[id]`, `/acceso`, `/salon`). Dan URLs compartibles, botón atrás funcional y permiten Server Components en el detalle.
- **No:** clonar el router del prototipo (estado `{name, id}` en `location.hash`). Es un artefacto del montaje UMD sin build, no un patrón a portar.
- **Sí:** sesión con React Context y `localStorage`, con las claves `av_user` y `av_scores`. Cero backend y reacción inmediata en Nav y salón.
- **No:** cookie de sesión con Server Actions. Más maquinaria de la que justifica un MVP puramente visual; se puede migrar cuando exista backend real.
- **Sí:** HUD estático con puntuación `0`, 3 vidas y nivel `01`. Decisión explícita del usuario: no quiere jugar a nada, así que nada debe simular una partida en curso.
- **No:** la simulación por `setInterval` del prototipo, que subía la puntuación cada 220 ms. Aparenta una partida que no existe. PAUSA y FIN siguen siendo interactivos, así que el overlay y el modal se pueden ver igual.
- **Sí:** reutilizar el CSS ya portado en `app/globals.css`. Son ~950 líneas equivalentes al prototipo, con los tokens ya expuestos a Tailwind; reescribirlas no aporta nada y arriesga desviación visual.
- **No:** traducir el CSS a utilidades Tailwind en este spec. Los efectos CRT, scanlines, gradientes de portada y keyframes no ganan nada como utilidades.
- **Sí:** conectar el guardado del modal con la fila «TU MEJOR MARCA» del salón. Sin esa conexión, guardar una puntuación no tendría ningún efecto observable.
- **No:** mezclar las puntuaciones del usuario dentro de las 12 filas simuladas y recalcular rangos. Complica el podio y no aporta al MVP visual.
- **Sí:** filtros de la biblioteca en estado cliente con `useState`. Filtrado instantáneo al teclear, igual que el prototipo.
- **No:** filtros en `searchParams`. Cada pulsación de tecla dispararía una navegación.
- **Sí:** Nav y pie en `app/layout.tsx`, incluida la pantalla de acceso. El prototipo muestra el Nav también en `auth`.
- **No:** añadir runner de tests en este spec. La verificación es `build` + `lint` + `tsc` más el checklist visual de arriba. Elegir framework es decisión de proyecto aparte.
- **Sí:** conservar el LCG de `seededScores` sin tocar. Es determinista, así que el mismo dato sale en servidor y en cliente y no hay desajuste de hidratación.

---

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Desajuste de hidratación al leer `localStorage` en el primer render | `ready` arranca en `false`; el Nav y el salón renderizan el estado sin sesión hasta que el `useEffect` confirma la lectura. |
| `localStorage` bloqueado en navegación privada | Toda lectura y escritura va en `try/catch`. La sesión queda en memoria y la aplicación sigue navegable. |
| Colisión entre las clases del CSS portado y las utilidades de Tailwind | El CSS portado vive en `@layer components`, que Tailwind ordena por debajo de las utilidades. |
| El efecto tilt manipula `style.transform` directamente | Queda encapsulado en el componente de tarjeta, con reseteo en `onMouseLeave`. `prefers-reduced-motion` ya está cubierto en `globals.css`. |

---

## Lo que **no** entra en este spec

- Ningún juego jugable. Los 8 títulos son metadatos y portadas.
- Ninguna simulación de partida. El HUD del reproductor es estático.
- Backend, base de datos, API o puntuaciones compartidas entre usuarios.
- Autenticación real y login social con Google o GitHub.
- Economía de créditos detrás del contador «CRÉDITOS · 03».
- Runner de tests y tests automatizados.
- Reescritura del CSS a utilidades Tailwind.
- Internacionalización más allá del español.

Cada uno de estos puntos, si llega, va en su propio spec.
