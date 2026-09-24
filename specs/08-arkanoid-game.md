# SPEC 08 — Integración del juego Arkanoid

> **Estado:** Aprobado
> **Depende de:** 06-games-table-leaderboard-supabase
> **Fecha:** 2026-09-24
> **Objetivo:** Integrar Arkanoid (`references/start-games/04-Arkanoid/game.js`) como juego jugable con ID
> `arkanoid`, conectando puntuación, vidas, combo y fin de partida con el HUD React de su
> página de juego y con el leaderboard de Supabase.

---

## Alcance

**Entra:**

- Insertar la fila `arkanoid` en la tabla `games` de Supabase (seed manual vía SQL).
- Copiar los assets del original a `public/games/arkanoid/`: `spritesheet-breakout.png`,
  `ball-bounce.mp3` y `break-sound.mp3`.
- Crear `components/games/arkanoid-game.tsx`: componente React que encapsula el canvas
  (1000×700) y el bucle de juego adaptado de `references/start-games/04-Arkanoid/game.js` y
  `assets/spritesheet.js`. Acepta las props `paused`, `onScoreChange`, `onLivesChange`,
  `onComboChange`, `onPauseToggle` y `onGameOver`.
- Conservar la mecánica del original: muro de 7×12, fila gris de 2 golpes (20 puntos), filas
  de color de 1 golpe (10 puntos), combo sin tocar la pala con tope ×8, aceleración del 4 %
  cada 8 bloques destruidos (tope 1,6×), rebote angular en la pala (hasta 60°), 3 vidas y
  sonidos de rebote y rotura.
- Conservar los efectos visuales: explosiones por sprite, escombros con gravedad, estela de
  la bola y puntos flotantes.
- Al romper todos los bloques se regenera el muro y la bola vuelve a la pala en estado de
  saque. Se conservan la puntuación, las vidas y la velocidad acumulada.
- El canvas mantiene su resolución interna de 1000×700 y se escala por CSS
  (`max-width: 100%` con `aspect-ratio`) en ventanas estrechas.
- Crear `app/jugar/arkanoid/page.tsx`: play-page específica (Server Component) que lee el
  juego con `getGame('arkanoid')` de `lib/supabase/games.ts` y renderiza el reproductor.
- Crear `components/arkanoid-player.tsx`: reproductor `"use client"` que gestiona el estado
  (puntuación, vidas, combo, pausa, fin de partida) y pasa callbacks al componente canvas.
  El HUD React muestra JUGADOR, PUNTUACIÓN, VIDAS y COMBO (COMBO ocupa el hueco de NIVEL).
- Las teclas `P` y `Escape` conmutan la pausa de la plataforma vía `onPauseToggle`. El botón
  "PAUSA" pasa el flag `paused` al componente, que congela el bucle.
- Modal de fin de partida: nombre pre-rellenado con `readPlayerName()`. Al confirmar, se
  inserta en `scores` vía cliente browser y se persiste el nombre con `writePlayerName()`.
- El canvas deja de dibujar `drawHud()` (PUNTOS, ×N, VIDAS) y los overlays PAUSA, GAME OVER
  y ¡VICTORIA!. Solo conserva el aviso "Pulsa Espacio" del estado de saque.

**Fuera de alcance:**

- Crear las tablas `games` o `scores` en Supabase: ya existen (spec 06).
- Supabase Auth: `user_id` se almacena como `null` en todos los scores.
- Cambios de RLS: las políticas abiertas de SPEC 06 (SELECT en `games` y `scores`, INSERT en
  `scores`) ya cubren el juego nuevo. Endurecerlas es un spec futuro de seguridad.
- Realtime: el leaderboard no se actualiza en vivo, solo al cargar la página.
- Paginación del leaderboard: se muestran los top 10 fijos.
- Controles táctiles, ratón o mobile.
- Actualización automática de `best` y `plays` en la tabla `games`.
- Extras que el original deja pendientes: power-ups, varios niveles o niveles con matriz y
  récord local en `localStorage`.
- La tecla `Enter` para reiniciar: la sustituye el botón "JUGAR DE NUEVO" del modal.
- Una cover nueva: se reutiliza `cover-bricks`, que ya existe en `app/globals.css`.

---

## Modelo de datos

### Seed en Supabase: tabla `games`

Ejecutar en el SQL Editor de Supabase:

```sql
INSERT INTO games (id, title, short, long, cat, cover, color)
VALUES (
  'arkanoid', 'ARKANOID', 'Rebota la bola y revienta el muro de neón.',
  'Mueve la pala y rebota la bola para romper un muro de 7 filas. Los bloques grises aguantan dos golpes. Encadena roturas sin tocar la pala para multiplicar los puntos hasta ×8, pero cuidado: la bola acelera cada 8 bloques.',
  'ARCADE', 'cover-bricks', 'cyan'
);
```

### Props del componente `ArkanoidGame`

```ts
interface ArkanoidGameProps {
  paused: boolean;
  onScoreChange: (score: number) => void;
  onLivesChange: (lives: number) => void;
  onComboChange: (mult: number) => void; // comboMult(): 0..8
  onPauseToggle: () => void; // teclas P y Escape
  onGameOver: (finalScore: number) => void;
}
```

### Assets

```
public/games/arkanoid/spritesheet-breakout.png
public/games/arkanoid/ball-bounce.mp3
public/games/arkanoid/break-sound.mp3
```

Convenciones:

- Las rutas de los assets son absolutas (`/games/arkanoid/...`), no relativas al HTML como
  en el original.
- `SPRITES`, `EXPLOSION_FRAMES` y `EXPLOSION_DURATION` se portan tal cual a constantes
  TypeScript dentro de `components/games/arkanoid-game.tsx`.
- Se conservan las invariantes del original: velocidades en px/s multiplicadas por `dt`, con
  tope `MAX_DT = 1/45`, y ciclos de vida calculados con `now - startTime`.
- El HUD React muestra el combo como `×N` cuando `mult >= 2` y como `—` en otro caso.

No se introducen tablas ni tipos TypeScript compartidos nuevos. Se reutilizan `GameRow` y
`ScoreRow` de `lib/supabase/types.ts`.

---

## Plan de implementación

1. **Seed en Supabase y assets.** Ejecutar el INSERT de la fila `arkanoid` en el SQL Editor
   de Supabase. Copiar `spritesheet-breakout.png`, `ball-bounce.mp3` y `break-sound.mp3` de
   `references/start-games/04-Arkanoid/assets/` a `public/games/arkanoid/`.
   Verificación: la card de ARKANOID aparece en `/juegos`, `/juego/arkanoid` carga su detalle
   y `/games/arkanoid/spritesheet-breakout.png` responde 200.

2. **Crear `components/games/arkanoid-game.tsx`**, un componente `"use client"` que:
   - Renderiza un `<canvas>` de 1000×700 con `imageSmoothingEnabled = false`, escalado por CSS
     con `max-width: 100%` y `aspect-ratio: 1000 / 700`.
   - Carga el spritesheet desde `/games/arkanoid/spritesheet-breakout.png` y arranca el
     bucle cuando termina (como `loadSpritesheet`). Los sonidos se crean con `new Audio()`
     sobre `/games/arkanoid/*.mp3`.
   - Contiene el bucle completo adaptado de `references/start-games/04-Arkanoid/game.js` (`createBricks`,
     `resetGame`, `launchBall`, `updatePaddle`, `updateBall`, `collidePaddle`,
     `collideBricks`, `hitBrick`, `breakBrick`, `updateBallSpeed`, `loseLife`, partículas,
     explosiones, textos flotantes y `drawField`).
   - Al vaciar el muro, `breakBrick` llama a `createBricks()`, recoloca la bola en la pala y
     pasa a `serve`, sin tocar `score`, `lives`, `speedMult` ni `bricksBroken`.
   - Recibe la prop `paused: boolean`: si es `true`, el bucle sigue llamando a `draw()` pero no
     a `update()`, y las teclas de juego se ignoran.
   - Llama a `onScoreChange`, `onLivesChange` y `onComboChange` cuando esos valores cambian,
     comparando con el valor anterior antes de disparar el callback.
   - Llama a `onPauseToggle()` al pulsar `P` o `Escape`.
   - Llama a `onGameOver(score)` cuando `lives` llega a 0 y detiene el bucle.
   - Elimina `drawHud()` y los overlays PAUSA, GAME OVER y ¡VICTORIA!. `drawOverlay` solo
     conserva el aviso "Pulsa Espacio" en estado `serve`. Se elimina el manejo de `Enter`.
   - Registra `keydown` y `keyup` en `document` (como el original) con `preventDefault` en
     flechas y Espacio. Los elimina junto con `cancelAnimationFrame` en el `return` del
     `useEffect`.
   Verificación: el juego arranca en `/jugar/arkanoid` y es jugable con ←/→, A/D y Espacio.

3. **Crear `app/jugar/arkanoid/page.tsx` y `components/arkanoid-player.tsx`**:
   - `page.tsx` es Server Component: `getGame('arkanoid')`, `notFound()` si no existe,
     `generateMetadata` con el título, y renderiza `<ArkanoidPlayer game={game} />`.
   - `arkanoid-player.tsx` es `"use client"` e importa `ArkanoidGame` con
     `dynamic(..., { ssr: false })` (solo se admite en Client Components).
   - Estado local: `score`, `lives`, `combo`, `paused`, `over`, `name`, `saveStatus`, `run`.
   - HUD React: JUGADOR, PUNTUACIÓN, VIDAS y COMBO, con números en `toLocaleString("es-ES")`.
   - Al abrir el modal de fin de partida, lee el nombre con `readPlayerName()` de
     `lib/player-name.ts` y pre-rellena el campo `name`.
   - Al confirmar, inserta en `scores` con `createClient()` de `lib/supabase/client.ts`:
     `{ game_id: 'arkanoid', player_name: name, score, user_id: null }`. Si Supabase
     confirma, persiste el nombre con `writePlayerName()` y registra la marca con
     `saveScore()` de `useSession()`.
   - `saveStatus` (`idle` | `saving` | `saved` | `error`) deshabilita el botón mientras guarda
     y después. Si falla, muestra error y permite reintentar.
   - "JUGAR DE NUEVO" reinicia el estado e incrementa `run` para remontar el canvas.
   - Reutiliza la misma maquetación (HUD React + CRT + modal de fin de partida) que
     `app/jugar/asteroids/page.tsx` + `components/asteroids-player.tsx`.
   Verificación: el HUD React muestra los valores en tiempo real. Tras una partida, el score
   aparece en `/juego/arkanoid` y en `/salon` al recargar.

4. **Verificación final.** `npm run build` completa sin errores de TypeScript.
   Ninguna ruta existente devuelve 500.

---

## Criterios de aceptación

- [ ] La card de ARKANOID aparece en `/juegos` con la cover `cover-bricks`.
- [ ] `/juego/arkanoid` carga con los datos reales del juego y el leaderboard top 10.
- [ ] `/jugar/arkanoid` carga sin errores de SSR ni de TypeScript.
- [ ] El canvas renderiza el muro de 7×12 con los sprites del spritesheet, sin suavizado.
- [ ] En una ventana más estrecha que 1000 px, el canvas se escala sin desbordar ni deformarse.
- [ ] El juego es jugable con ←/→ y A/D (mover la pala) y Espacio (sacar la bola).
- [ ] Las flechas y Espacio no hacen scroll de la página durante la partida.
- [ ] Los bloques grises necesitan 2 impactos, se aclaran tras el primero y suman 20 puntos.
- [ ] Los bloques de color suman 10 puntos, multiplicados por el combo (tope ×8).
- [ ] Rebotar en la pala reinicia el combo.
- [ ] La bola acelera un 4 % cada 8 bloques destruidos, hasta 1,6× la velocidad base.
- [ ] Se ven explosiones, escombros, estela de la bola y puntos flotantes al romper bloques.
- [ ] Suenan el rebote y la rotura.
- [ ] Al romper todos los bloques aparece un muro nuevo, la bola vuelve a la pala y se
      conservan la puntuación, las vidas y la velocidad.
- [ ] El canvas no dibuja PUNTOS, ×N, VIDAS ni los overlays PAUSA, GAME OVER o ¡VICTORIA!.
- [ ] El canvas muestra "Pulsa Espacio" mientras la bola espera en la pala.
- [ ] El HUD React refleja en tiempo real la puntuación, las vidas y el combo (`×N` desde ×2,
      `—` por debajo).
- [ ] El botón "PAUSA" congela el bucle; "REANUDAR" lo reanuda.
- [ ] `P` y `Escape` conmutan la pausa de la plataforma igual que el botón.
- [ ] `Enter` no hace nada.
- [ ] Al perder la tercera vida, aparece el modal React de fin de partida con la puntuación
      final.
- [ ] El botón "JUGAR DE NUEVO" reinicia la partida desde cero (3 vidas, muro completo,
      velocidad base).
- [ ] Al abrir el modal, el nombre se pre-rellena con `av_player_name` de localStorage si existe.
- [ ] Al confirmar, el score se inserta en Supabase y el nombre se persiste en localStorage.
- [ ] El botón "GUARDAR PUNTUACIÓN" queda deshabilitado mientras guarda y después (sin doble
      inserción). Si falla, se muestra error y se puede reintentar.
- [ ] El score guardado aparece en `/juego/arkanoid` y en `/salon` al recargar.
- [ ] Cuando no hay scores, el leaderboard muestra "Sé el primero en entrar al salón de la fama".
- [ ] `/salon` muestra una pestaña para ARKANOID.
- [ ] Al salir de `/jugar/arkanoid`, no quedan listeners de teclado ni bucle activos.
- [ ] `npm run build` completa sin errores de TypeScript.
- [ ] Ninguna ruta existente devuelve 500.

---

## Decisiones

- **Sí: un solo HUD, el de la plataforma.** Puntuación, vidas y combo solo se muestran en el
  HUD React. Razón: mismo criterio que SPEC 05 y SPEC 07, sin datos duplicados sobre la
  pantalla de juego.

- **Sí: COMBO sustituye a NIVEL en el HUD.** Arkanoid no tiene niveles. Razón: el combo es el
  indicador que el original dibujaba junto a la puntuación, y así sale del canvas.

- **Sí: conservar "Pulsa Espacio" en el canvas.** Razón: no tiene equivalente en el HUD React
  y sin él no se entiende que la bola espera el saque.

- **Sí: muro nuevo al vaciarlo, sin fin por victoria.** Se conservan puntuación, vidas y
  velocidad. Razón: la partida solo acaba al perder las 3 vidas, así el leaderboard premia
  aguantar y no hay tope de puntuación.

- **No: fin de partida con ¡VICTORIA!.** Razón: cortaría la puntuación en un máximo práctico
  y obligaría a un segundo tipo de modal.

- **Sí: resolución interna de 1000×700 escalada por CSS.** Razón: la física y las
  colisiones del original no cambian, y el canvas no desborda en ventanas estrechas.

- **Sí: `P` y `Escape` conmutan la pausa de la plataforma (`onPauseToggle`).** Razón: se
  conserva el atajo del original sin duplicar el estado de pausa; la fuente de verdad es React
  (mismo criterio que SPEC 07).

- **No: `Enter` para reiniciar.** Razón: el botón "JUGAR DE NUEVO" del modal ya cubre el
  reinicio.

- **Sí: assets en `public/games/arkanoid/`, sonidos incluidos.** Razón: Next.js sirve
  `public/` de forma estática. Una carpeta por juego evita colisiones de nombres.

- **Sí: `SPRITES` y `EXPLOSION_FRAMES` portados dentro del componente.** Razón: solo los usa
  Arkanoid; un módulo compartido sería abstraer sin segundo caso de uso.

- **Sí: mecánica y efectos completos del original.** Razón: forman el juego tal como se
  terminó en sus SPEC 01 a 03; recortarlos empobrecería la versión de la plataforma.

- **Sí: callbacks como interfaz de comunicación.** El componente canvas llama a
  `onScoreChange`, `onLivesChange`, `onComboChange`, `onPauseToggle` y `onGameOver`.
  Razón: desacoplamiento limpio; el juego no sabe nada de Supabase ni de la plataforma.

- **Sí: `dynamic(..., { ssr: false })` en `components/arkanoid-player.tsx`.** Razón: `canvas`,
  `Audio` y `requestAnimationFrame` no existen en el servidor, y `ssr: false` solo se admite
  en Client Components.

- **Sí: play-page específica `app/jugar/arkanoid/page.tsx` + `components/arkanoid-player.tsx`**
  en lugar de modificar `app/jugar/[id]`. Razón: evita condicionales en la ruta genérica; la
  ruta estática tiene prioridad sobre la dinámica.

- **Sí: reutilizar `cover-bricks`.** Razón: ya existe en `app/globals.css` y representa un
  muro de bloques.

- **No: crear tablas nuevas.** Se reutilizan `games` y `scores` del spec 06.
  Razón: el modelo es genérico para cualquier juego con score numérico.

- **No: cambios de RLS en este spec.** Se reutilizan las políticas abiertas de SPEC 06.
  Razón: se endurecen en el spec futuro de seguridad.

- **No: realtime en leaderboards.** Los scores se ven al recargar. Razón: la complejidad de
  subscriptions no aporta valor con pocos jugadores activos.

- **No: componente genérico `CanvasGame`.** Cada juego tiene su componente propio.
  Razón: YAGNI; los tres juegos difieren en HUD, entrada y assets.
