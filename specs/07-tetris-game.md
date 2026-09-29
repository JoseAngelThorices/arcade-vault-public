# SPEC 07 — Integración del juego Tetris

> **Estado:** Implementado
> **Depende de:** 06-games-table-leaderboard-supabase
> **Fecha:** 2026-09-24
> **Objetivo:** Integrar Tetris (`references/start-games/03-tetris/game.js`) como juego jugable con ID
> `tetris`, conectando puntuación, líneas, nivel y fin de partida con el HUD React de su
> página de juego y con el leaderboard de Supabase.

---

## Alcance

**Entra:**

- Insertar la fila `tetris` en la tabla `games` de Supabase (seed manual vía SQL).
- Crear `components/games/tetris-game.tsx` — componente React que encapsula el tablero
  (canvas 300×600), la vista previa de la siguiente pieza (canvas lateral 120×120) y el bucle
  de juego adaptado de `references/start-games/03-tetris/game.js`. Acepta las props `paused`,
  `onScoreChange`, `onLinesChange`, `onLevelChange`, `onPauseToggle` y `onGameOver`.
- Conservar la mecánica del original: tablero 10×20, las 7 piezas estándar (sin la tuerca),
  rotación con wall kicks, soft drop, hard drop, pieza fantasma, puntuación
  `[0, 100, 300, 500, 800] × nivel` y nivel cada 10 líneas. La caída es más rápida que en el
  original: `max(60, 700 × 0,85^(nivel − 1))` ms (cambio acordado en la implementación,
  2026-09-24).
- Skin fija Retro; el resto de skins y el selector no se portan.
- Crear `app/jugar/tetris/page.tsx` — play-page específica (Server Component): lee el juego
  con `getGame('tetris')` de `lib/supabase/games.ts` y renderiza el reproductor.
- Crear `components/tetris-player.tsx` — reproductor `"use client"`: gestiona el estado
  (puntuación, líneas, nivel, pausa, fin de partida) y pasa callbacks al componente canvas.
  El HUD React muestra JUGADOR, PUNTUACIÓN, LÍNEAS y NIVEL (LÍNEAS ocupa el hueco de VIDAS).
- Las teclas `P` y `Escape` conmutan la pausa de la plataforma vía `onPauseToggle`; el botón
  "PAUSA" pasa el flag `paused` al componente, que congela el bucle.
- Modal de fin de partida: nombre pre-rellenado con `readPlayerName()`; al confirmar,
  inserción en `scores` vía cliente browser y persistencia del nombre con `writePlayerName()`.
- Los valores de puntuación, líneas y nivel solo se muestran en el HUD React; el canvas no
  los dibuja (en el original ya eran HTML).

**Fuera de alcance:**

- Crear las tablas `games` o `scores` en Supabase — ya existen (spec 06).
- Supabase Auth — `user_id` se almacena como `null` en todos los scores.
- Cambios de RLS — las políticas abiertas de SPEC 06 (SELECT en `games` y `scores`, INSERT en
  `scores`) ya cubren el juego nuevo; endurecerlas es un spec futuro de seguridad.
- Realtime — el leaderboard no se actualiza en vivo; solo al cargar la página.
- Paginación del leaderboard — se muestran los top 10 fijos.
- Controles táctiles o mobile.
- Actualización automática de `best` y `plays` en la tabla `games`.
- Extras del original que no se portan: récords locales top 5, combo y líneas máximas,
  selector de skins, selector de nivel inicial (siempre nivel 1), menú de pausa propio,
  tema claro/oscuro, pantalla de inicio y overlay HTML de game over.

---

## Modelo de datos

### Seed en Supabase — tabla `games`

Ejecutar en el SQL Editor de Supabase:

```sql
INSERT INTO games (id, title, short, long, cat, cover, color)
VALUES (
  'tetris', 'TETRIS', 'Apila piezas antes de que el techo te aplaste.',
  'Encaja las piezas que caen y completa líneas para hacerlas desaparecer. Cada 10 líneas subes de nivel y la caída se acelera.',
  'PUZZLE', 'cover-tetro', 'magenta'
);
```

### Props del componente `TetrisGame`

```ts
interface TetrisGameProps {
  paused: boolean;
  onScoreChange: (score: number) => void;
  onLinesChange: (lines: number) => void;
  onLevelChange: (level: number) => void;
  onPauseToggle: () => void; // teclas P y Escape
  onGameOver: (finalScore: number) => void;
}
```

No se introducen tablas ni tipos TypeScript nuevos. Se reutilizan `GameRow` y `ScoreRow`
de `lib/supabase/types.ts`.

---

## Plan de implementación

1. **Seed en Supabase** — ejecutar el INSERT de la fila `tetris` en el SQL Editor de Supabase.
   Verificación: la card de TETRIS aparece en `/juegos` y `/juego/tetris` carga su detalle.

2. **Crear `components/games/tetris-game.tsx`** — componente `"use client"` que:
   - Renderiza el tablero `<canvas>` de 300×600 y, a su lado, el `<canvas>` de vista previa
     de 120×120.
   - Contiene el bucle completo adaptado de `references/start-games/03-tetris/game.js` (`collide`,
     `rotateCW`, `tryRotate`, `clearLines`, `ghostY`, `hardDrop`, `softDrop`, `lockPiece`,
     `spawn`, `draw`, `drawNext`), con la skin Retro fija y nivel inicial 1.
   - Recibe la prop `paused: boolean`: si es `true`, el bucle no avanza la caída y las teclas
     de juego se ignoran.
   - Llama `onScoreChange`, `onLinesChange` y `onLevelChange` cuando esos valores cambian,
     comparando con el valor anterior antes de disparar el callback.
   - Llama `onPauseToggle()` al pulsar `P` o `Escape`.
   - Llama `onGameOver(score)` cuando la pieza nueva colisiona al aparecer (`spawn`), y
     detiene el bucle.
   - No dibuja puntuación, líneas ni nivel en el canvas, ni ningún overlay de game over.
   - Registra `keydown` y `keyup` en `document` (como el original) con `preventDefault` en las
     teclas de juego, y los elimina junto con `cancelAnimationFrame` en el `return` del
     `useEffect`.
   Verificación: el juego arranca en `/jugar/tetris` y es jugable con ←/→, ↑/X, ↓ y Espacio.

3. **Crear `app/jugar/tetris/page.tsx` y `components/tetris-player.tsx`**:
   - `page.tsx` es Server Component: `getGame('tetris')`, `notFound()` si no existe,
     `generateMetadata` con el título, y renderiza `<TetrisPlayer game={game} />`.
   - `tetris-player.tsx` es `"use client"` e importa `TetrisGame` con
     `dynamic(..., { ssr: false })` (solo se admite en Client Components).
   - Estado local: `score`, `lines`, `level`, `paused`, `over`, `name`, `saveStatus`, `run`.
   - HUD React: JUGADOR, PUNTUACIÓN, LÍNEAS y NIVEL, con números en `toLocaleString("es-ES")`.
   - Al abrir el modal de fin de partida, lee el nombre con `readPlayerName()` de
     `lib/player-name.ts` y pre-rellena el campo `name`.
   - Al confirmar, inserta en `scores` con `createClient()` de `lib/supabase/client.ts`:
     `{ game_id: 'tetris', player_name: name, score, user_id: null }`. Si Supabase confirma,
     persiste el nombre con `writePlayerName()` y registra la marca con `saveScore()` de
     `useSession()`.
   - `saveStatus` (`idle` | `saving` | `saved` | `error`) deshabilita el botón mientras guarda
     y después; si falla, muestra error y permite reintentar.
   - "JUGAR DE NUEVO" reinicia el estado e incrementa `run` para remontar el canvas.
   - Reutiliza la misma maquetación (HUD React + CRT + modal de fin de partida) que
     `app/jugar/asteroids/page.tsx` + `components/asteroids-player.tsx`.
   Verificación: el HUD React muestra los valores en tiempo real; tras una partida el score
   aparece en `/juego/tetris` y en `/salon` al recargar.

4. **Verificación final** — `npm run build` completa sin errores de TypeScript.
   Ninguna ruta existente devuelve 500.

---

## Criterios de aceptación

- [ ] La card de TETRIS aparece en `/juegos`.
- [ ] `/juego/tetris` carga con los datos reales del juego y el leaderboard top 10.
- [ ] `/jugar/tetris` carga sin errores de SSR ni de TypeScript.
- [ ] El tablero 300×600 y la vista previa 120×120 se renderizan con la skin Retro.
- [ ] El juego es jugable con ←/→ (mover), ↑/X (rotar), ↓ (soft drop) y Espacio (hard drop).
- [ ] Las flechas y Espacio no hacen scroll de la página durante la partida.
- [ ] Aparecen solo las 7 piezas estándar (nunca la tuerca); funcionan la pieza fantasma y los
      wall kicks.
- [ ] El canvas no dibuja puntuación, líneas ni nivel.
- [ ] El HUD React refleja en tiempo real la puntuación, las líneas y el nivel.
- [ ] La caída empieza a 700 ms en nivel 1; el nivel sube cada 10 líneas y cada nivel cae un
      15 % más rápido (mínimo 60 ms).
- [ ] El botón "PAUSA" congela el bucle; "REANUDAR" lo reanuda.
- [ ] `P` y `Escape` conmutan la pausa de la plataforma igual que el botón.
- [ ] Al chocar la pieza nueva al aparecer, se muestra el modal React de fin de partida con la
      puntuación final.
- [ ] El botón "JUGAR DE NUEVO" reinicia la partida desde cero (nivel 1, tablero vacío).
- [ ] Al abrir el modal, el nombre se pre-rellena con `av_player_name` de localStorage si existe.
- [ ] Al confirmar, el score se inserta en Supabase y el nombre se persiste en localStorage.
- [ ] El botón "GUARDAR PUNTUACIÓN" queda deshabilitado mientras guarda y después (sin doble
      inserción); si falla, se muestra error y se puede reintentar.
- [ ] El score guardado aparece en `/juego/tetris` y en `/salon` al recargar.
- [ ] Cuando no hay scores, el leaderboard muestra "Sé el primero en entrar al salón de la fama".
- [ ] `/salon` muestra una pestaña para TETRIS.
- [ ] Al salir de `/jugar/tetris`, no quedan listeners de teclado ni bucle activos.
- [ ] `npm run build` completa sin errores de TypeScript.
- [ ] Ninguna ruta existente devuelve 500.

---

## Decisiones

- **Sí: un solo HUD, el de la plataforma** — puntuación, líneas y nivel solo se muestran en el
  HUD React. Razón: mismo criterio que SPEC 05; en el original ya eran HTML, no canvas.

- **Sí: LÍNEAS sustituye a VIDAS en el HUD** — Tetris no tiene vidas. Razón: las líneas
  explican el progreso de nivel y ocupan el mismo hueco de la maquetación.

- **Sí: vista previa en un canvas lateral dentro del componente** — como en el original.
  Razón: no requiere callback nuevo ni cambiar el tamaño del tablero.

- **Sí: `P` y `Escape` conmutan la pausa de la plataforma (`onPauseToggle`)** — Razón: se
  conserva el atajo del original sin duplicar el estado de pausa; la fuente de verdad es React.

- **Sí: callbacks como interfaz de comunicación** — el componente canvas llama a
  `onScoreChange`, `onLinesChange`, `onLevelChange`, `onPauseToggle` y `onGameOver`.
  Razón: desacoplamiento limpio; el juego no sabe nada de Supabase ni de la plataforma.

- **Sí: `dynamic(..., { ssr: false })` en `components/tetris-player.tsx`** — Razón: `canvas`
  y `requestAnimationFrame` no existen en el servidor, y `ssr: false` solo se admite en
  Client Components.

- **Sí: play-page específica `app/jugar/tetris/page.tsx` + `components/tetris-player.tsx`** —
  en lugar de modificar `app/jugar/[id]`. Razón: evita condicionales en la ruta genérica; la
  ruta estática tiene prioridad sobre la dinámica.

- **No: la tuerca (pieza N gris, anillo de 8 celdas)** — solo las 7 piezas estándar.
  Razón: el usuario la descartó tras probarla en el navegador (cambio durante la
  implementación, 2026-09-24).

- **Sí: skin Retro fija** — Razón: elegida por el usuario; el selector de skins no se porta.

- **No: récords locales, selector de nivel inicial, menú de pausa propio, tema claro/oscuro
  ni pantalla de inicio** — Razón: la plataforma ya cubre leaderboard, pausa, reinicio y tema;
  la partida empieza al cargar en nivel 1.

- **No: crear tablas nuevas** — se reutilizan `games` y `scores` del spec 06.
  Razón: el modelo es genérico para cualquier juego con score numérico.

- **No: cambios de RLS en este spec** — se reutilizan las políticas abiertas de SPEC 06.
  Razón: se endurecen en el spec futuro de seguridad.

- **No: realtime en leaderboards** — los scores se ven al recargar. Razón: la complejidad de
  subscriptions no aporta valor con pocos jugadores activos.

- **No: componente genérico `CanvasGame`** — cada juego tiene su componente propio.
  Razón: YAGNI; con dos juegos aún no hay patrón común suficiente para abstraer.
