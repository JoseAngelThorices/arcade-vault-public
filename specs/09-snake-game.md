# SPEC 09 — Integración del juego Snake

> **Estado:** Aprobado
> **Depende de:** 06-games-table-leaderboard-supabase
> **Fecha:** 2026-09-24
> **Objetivo:** Crear desde cero Snake como juego jugable con ID `snake`, con frutas en pixel
> art de `references/source-assets/snake-assets/`, conectando puntuación, longitud, nivel y
> fin de partida con el HUD React de su página de juego y con el leaderboard de Supabase.

---

## Alcance

**Entra:**

- Insertar la fila `snake` en la tabla `games` de Supabase (seed manual vía SQL).
- Copiar `references/source-assets/snake-assets/fruits.png` a `public/games/snake/fruits.png`.
- Crear `components/games/snake-game.tsx`: componente React que encapsula el canvas
  (720×540, cuadrícula de 24×18 celdas de 30 px) y el bucle de juego, escrito desde cero
  porque no hay código de referencia. Acepta las props `paused`, `onScoreChange`,
  `onLengthChange`, `onLevelChange`, `onPauseToggle` y `onGameOver`.
- Mecánica:
  - La serpiente empieza con 3 celdas, en el centro y mirando a la derecha.
  - Se queda quieta hasta la primera tecla de dirección.
  - Avanza una celda por paso.
  - Cada fruta suma `10 × nivel` y alarga la serpiente una celda.
  - Se sube de nivel cada 5 frutas.
  - Un paso dura 150 ms en el nivel 1 y un 10 % menos en cada nivel, con un mínimo de 60 ms.
- Fin de partida:
  - Al chocar contra la pared.
  - Al morderse la cola.
  - Si no queda ninguna celda libre para la siguiente fruta.
- Frutas: cada fruta nueva es una de las 22 de la fila de pixel art de `fruits.png`, elegida
  al azar. Aparece en una celda libre, también al azar.
- Aspecto:
  - La serpiente se dibuja con bloques de neón `--green` con glow, y la cabeza es más clara
    y lleva ojos.
  - El fondo lleva una cuadrícula tenue.
  - Mientras la serpiente espera, el canvas muestra el aviso "Pulsa una dirección".
- Controles:
  - Flechas y WASD cambian de dirección.
  - Se ignora el giro de 180°.
  - Los giros se encolan, con un máximo de 2 por paso.
- El canvas mantiene su resolución interna de 720×540 y se escala por CSS
  (`max-width: 100%` con `aspect-ratio: 4 / 3`): llena la pantalla CRT de la plataforma,
  que también es 4:3, sin bandas laterales.
- Crear `app/jugar/snake/page.tsx`: play-page específica (Server Component) que lee el juego
  con `getGame('snake')` de `lib/supabase/games.ts` y renderiza el reproductor.
- Crear `components/snake-player.tsx`: reproductor `"use client"` que gestiona el estado
  (puntuación, longitud, nivel, pausa y fin de partida) y pasa callbacks al componente canvas.
  El HUD React muestra JUGADOR, PUNTUACIÓN, LONGITUD y NIVEL (LONGITUD ocupa el hueco de
  VIDAS).
- Las teclas `P` y `Escape` conmutan la pausa de la plataforma vía `onPauseToggle`. El botón
  "PAUSA" pasa el flag `paused` al componente, que congela el bucle.
- Modal de fin de partida: el nombre se pre-rellena con `readPlayerName()`. Al confirmar, se
  inserta la puntuación en `scores` vía cliente browser y se persiste el nombre con
  `writePlayerName()`.
- El canvas no dibuja puntuación, longitud ni nivel, ni ningún overlay de GAME OVER o PAUSA.

**Fuera de alcance:**

- Crear las tablas `games` o `scores` en Supabase: ya existen (spec 06).
- Supabase Auth: `user_id` se almacena como `null` en todos los scores.
- Cambios de RLS: las políticas abiertas de SPEC 06 (SELECT en `games` y `scores`, INSERT en
  `scores`) ya cubren el juego nuevo. Endurecerlas es un spec futuro de seguridad.
- Realtime: el leaderboard no se actualiza en vivo, solo al cargar la página.
- Paginación del leaderboard: se muestran los top 10 fijos.
- Controles táctiles, ratón o mobile.
- Actualización automática de `best` y `plays` en la tabla `games`.
- Valor distinto por tipo de fruta, frutas especiales o temporales, obstáculos y modo con
  bordes atravesables.
- Las filas vectorial y realista de `fruits.png`.
- Sonidos: no hay assets de audio para Snake.
- Una cover nueva: se reutiliza `cover-snake`, que ya existe en `app/globals.css`.

---

## Modelo de datos

### Seed en Supabase: tabla `games`

Ejecutar en el SQL Editor de Supabase:

```sql
INSERT INTO games (id, title, short, long, cat, cover, color)
VALUES (
  'snake', 'SNAKE', 'Come fruta, crece y no te muerdas la cola.',
  'Guía a la serpiente por la cuadrícula y devora cada fruta que aparece. Cada bocado la alarga y la hace más veloz. Un movimiento en falso y se devora a sí misma.',
  'ARCADE', 'cover-snake', 'green'
);
```

### Props del componente `SnakeGame`

```ts
interface SnakeGameProps {
  paused: boolean;
  onScoreChange: (score: number) => void;
  onLengthChange: (length: number) => void; // celdas de la serpiente, empieza en 3
  onLevelChange: (level: number) => void;
  onPauseToggle: () => void; // teclas P y Escape
  onGameOver: (finalScore: number) => void;
}
```

### Estado interno del bucle

```ts
type Cell = { x: number; y: number }; // x 0..23, y 0..17, origen arriba a la izquierda
type Dir = "up" | "down" | "left" | "right";

const state = {
  snake: [] as Cell[], // snake[0] es la cabeza
  dir: "right" as Dir,
  queue: [] as Dir[], // giros pendientes, máx. 2
  food: null as { cell: Cell; sprite: FruitName } | null,
  score: 0,
  level: 1,
  eaten: 0, // frutas comidas; nivel = 1 + floor(eaten / 5)
  started: false, // false hasta la primera tecla de dirección
  lastStep: 0, // timestamp del último paso
};
```

### Assets

```
public/games/snake/fruits.png
```

Convenciones:

- La ruta del asset es absoluta (`/games/snake/fruits.png`).
- Las constantes `FRUITS` (los 22 recortes `{ x, y, w, h }` de la fila de pixel art,
  `y = 136`, `h = 160`) se portan desde `sprites.js` a una constante TypeScript dentro de
  `components/games/snake-game.tsx`.
- Cada fruta se dibuja dentro de su celda de 30 px:
  - Se escala manteniendo su proporción para caber en 26 px de alto, con 2 px de margen.
  - Se centra en horizontal.
  - Se dibuja con `imageSmoothingEnabled = false`.
- Constantes: `COLS = 24`, `ROWS = 18`, `CELL = 30`, `BASE_STEP_MS = 150`, `MIN_STEP_MS = 60`,
  `STEP_FACTOR = 0.9`, `FRUITS_PER_LEVEL = 5`, `POINTS_PER_FRUIT = 10`.
- Duración de paso: `max(MIN_STEP_MS, BASE_STEP_MS × STEP_FACTOR^(nivel − 1))`.
- El movimiento es por pasos discretos: el bucle `requestAnimationFrame` avanza la
  serpiente cuando `now − lastStep ≥ duración de paso`.
- Al comer, la cola no se recorta en ese paso.
- Al comprobar la colisión con la cola, la última celda cuenta como libre si ese paso no se
  come fruta, porque la cola se mueve a la vez que la cabeza.

No se introducen tablas ni tipos TypeScript compartidos nuevos. Se reutilizan `GameRow` y
`ScoreRow` de `lib/supabase/types.ts`.

---

## Plan de implementación

1. **Seed en Supabase y assets.** Ejecutar el INSERT de la fila `snake` en el SQL Editor de
   Supabase. Copiar `references/source-assets/snake-assets/fruits.png` a
   `public/games/snake/fruits.png`.
   Verificación: la card de SNAKE aparece en `/juegos` con `cover-snake`, `/juego/snake`
   carga su detalle y `/games/snake/fruits.png` responde 200.

2. **Crear `components/games/snake-game.tsx`**, un componente `"use client"` que:
   - Renderiza un `<canvas>` de 720×540 con `imageSmoothingEnabled = false`, escalado por CSS
     con `max-width: 100%` y `aspect-ratio: 4 / 3`.
   - Carga `/games/snake/fruits.png` y arranca el bucle cuando termina la carga.
   - Contiene el bucle completo escrito desde cero:
     - `resetGame`: serpiente de 3 celdas en el centro, mirando a la derecha.
     - `spawnFruit`: celda libre y sprite al azar.
     - `step`: consume la cola de giros, mueve la cabeza, detecta la colisión con la pared o
       la cola, come fruta, sube de nivel y recalcula la duración del paso.
     - `drawGrid`, `drawSnake` y `drawFruit`.
   - Mientras `started` es `false`, la serpiente no avanza y el canvas muestra
     "Pulsa una dirección".
   - Recibe la prop `paused: boolean`: si es `true`, el bucle sigue llamando a `draw()` pero no
     avanza pasos, y las teclas de dirección se ignoran. Al reanudar, `lastStep` se reinicia
     para que la serpiente no dé un salto.
   - Llama a `onScoreChange`, `onLengthChange` y `onLevelChange` cuando esos valores cambian,
     comparando con el valor anterior antes de disparar el callback.
   - Llama a `onPauseToggle()` al pulsar `P` o `Escape`.
   - Llama a `onGameOver(score)` y detiene el bucle en tres casos: al chocar contra la pared,
     al morderse la cola o si `spawnFruit` no encuentra una celda libre.
   - No dibuja puntuación, longitud ni nivel, ni overlays de GAME OVER o PAUSA.
   - Registra `keydown` en `document` con `preventDefault` en flechas y WASD. Lo elimina junto
     con `cancelAnimationFrame` en el `return` del `useEffect`.
   Verificación: el juego arranca en `/jugar/snake` y es jugable con las flechas y WASD.

3. **Crear `app/jugar/snake/page.tsx` y `components/snake-player.tsx`**:
   - `page.tsx` es Server Component: `getGame('snake')`, `notFound()` si no existe,
     `generateMetadata` con el título, y renderiza `<SnakePlayer game={game} />`.
   - `snake-player.tsx` es `"use client"` e importa `SnakeGame` con
     `dynamic(..., { ssr: false })` (solo se admite en Client Components).
   - Estado local: `score`, `length`, `level`, `paused`, `over`, `name`, `saveStatus`, `run`.
   - HUD React: JUGADOR, PUNTUACIÓN, LONGITUD y NIVEL, con números en `toLocaleString("es-ES")`.
   - Al abrir el modal de fin de partida, lee el nombre con `readPlayerName()` de
     `lib/player-name.ts` y pre-rellena el campo `name`.
   - Al confirmar, inserta en `scores` con `createClient()` de `lib/supabase/client.ts`:
     `{ game_id: 'snake', player_name: name, score, user_id: null }`. Si Supabase confirma,
     persiste el nombre con `writePlayerName()` y registra la marca con `saveScore()` de
     `useSession()`.
   - `saveStatus` (`idle` | `saving` | `saved` | `error`) deshabilita el botón mientras guarda
     y después. Si falla, muestra error y permite reintentar.
   - "JUGAR DE NUEVO" reinicia el estado e incrementa `run` para remontar el canvas.
   - Reutiliza la misma maquetación (HUD React + CRT + modal de fin de partida) que
     `app/jugar/arkanoid/page.tsx` + `components/arkanoid-player.tsx`.
   Verificación: el HUD React muestra los valores en tiempo real. Tras una partida, el score
   aparece en `/juego/snake` y en `/salon` al recargar.

4. **Verificación final.** `npm run build` completa sin errores de TypeScript.
   Ninguna ruta existente devuelve 500.

---

## Criterios de aceptación

- [ ] La card de SNAKE aparece en `/juegos` con la cover `cover-snake` y el acento verde.
- [ ] `/juego/snake` carga con los datos reales del juego y el leaderboard top 10.
- [ ] `/jugar/snake` carga sin errores de SSR ni de TypeScript.
- [ ] El canvas renderiza una cuadrícula de 24×18 con la serpiente de 3 celdas en el centro.
- [ ] El tablero llena la pantalla CRT, sin bandas negras a los lados.
- [ ] En una ventana más estrecha que 720 px, el canvas se escala sin desbordar ni deformarse.
- [ ] Antes de la primera tecla, la serpiente está quieta y se ve "Pulsa una dirección".
- [ ] El juego es jugable con las flechas y con WASD.
- [ ] Las flechas no hacen scroll de la página durante la partida.
- [ ] Pulsar la dirección contraria a la actual no hace nada.
- [ ] Dos giros rápidos dentro del mismo paso se aplican ambos, en orden.
- [ ] Las frutas se ven como sprites pixel art de `fruits.png`, sin suavizado ni deformación.
- [ ] Las frutas varían entre las 22 de la fila de pixel art.
- [ ] Las frutas nunca aparecen sobre la serpiente.
- [ ] Comer una fruta suma `10 × nivel` y alarga la serpiente una celda.
- [ ] Cada 5 frutas sube el nivel y la serpiente se mueve un 10 % más rápido.
- [ ] El paso empieza en 150 ms y nunca baja de 60 ms.
- [ ] Chocar contra la pared termina la partida.
- [ ] Morderse la cola termina la partida.
- [ ] Moverse a la celda que acaba de dejar la cola no termina la partida.
- [ ] El canvas no dibuja puntuación, longitud ni nivel, ni overlays de GAME OVER o PAUSA.
- [ ] El HUD React refleja en tiempo real la puntuación, la longitud y el nivel.
- [ ] El botón "PAUSA" congela el bucle.
- [ ] "REANUDAR" continúa sin que la serpiente dé un salto.
- [ ] `P` y `Escape` conmutan la pausa de la plataforma igual que el botón.
- [ ] Al terminar la partida, aparece el modal React de fin de partida con la puntuación final.
- [ ] El botón "JUGAR DE NUEVO" reinicia la partida desde cero (3 celdas, nivel 1,
      puntuación 0).
- [ ] Al abrir el modal, el nombre se pre-rellena con `av_player_name` de localStorage si existe.
- [ ] Al confirmar, el score se inserta en Supabase y el nombre se persiste en localStorage.
- [ ] El botón "GUARDAR PUNTUACIÓN" queda deshabilitado mientras guarda y después (sin doble
      inserción).
- [ ] Si falla el guardado, se muestra un error y se puede reintentar.
- [ ] El score guardado aparece en `/juego/snake` y en `/salon` al recargar.
- [ ] Cuando no hay scores, el leaderboard muestra "Sé el primero en entrar al salón de la fama".
- [ ] `/salon` muestra una pestaña para SNAKE.
- [ ] Al salir de `/jugar/snake`, no quedan listeners de teclado ni bucle activos.
- [ ] `npm run build` completa sin errores de TypeScript.
- [ ] Ninguna ruta existente devuelve 500.

---

## Decisiones

- **Sí: juego escrito desde cero.** No hay código de referencia en `references/`. Solo los
  sprites de fruta vienen de fuera. Razón: Snake es lo bastante simple como para definir su
  mecánica completa en este spec.

- **Sí: tablero de 24×18 celdas de 30 px (720×540) escalado por CSS.** Razón: las frutas se
  leen bien a 30 px, el canvas no desborda en ventanas estrechas (mismo criterio que
  SPEC 08) y, al ser 4:3, llena la pantalla CRT sin bandas.

- **No: tablero cuadrado de 20×20 (600×600).** Era el tamaño inicial del spec. Razón: en la
  pantalla CRT 4:3 dejaba bandas negras a los lados; se cambió durante la implementación a
  petición del usuario (2026-09-24).

- **Sí: chocar contra la pared mata.** Razón: es el Snake clásico y premia el control.

- **No: bordes atravesables (wrap).** Razón: descartado por el usuario. Queda como posible
  modo futuro.

- **Sí: LONGITUD sustituye a VIDAS en el HUD.** Snake no tiene vidas. Razón: la longitud
  resume el progreso de la partida y ocupa el mismo hueco de la maquetación (mismo criterio
  que LÍNEAS en SPEC 07).

- **Sí: progresión por niveles.** 10 × nivel por fruta, nivel cada 5 frutas, paso de 150 ms
  que baja un 10 % por nivel hasta 60 ms. Razón: el leaderboard premia aguantar a velocidad
  alta y la puntuación no tiene tope práctico.

- **No: valor distinto por tipo de fruta.** Razón: las frutas son solo visuales. Un valor
  por tipo añadiría una regla que el jugador no puede leer en pantalla.

- **Sí: sprites de la fila de pixel art, fruta aleatoria.** Razón: `sprites.js` ya tiene sus
  recortes y encajan con la estética retro de la plataforma.

- **Sí: `FRUITS` portado dentro del componente.** Razón: solo lo usa Snake. Un módulo
  compartido sería abstraer sin segundo caso de uso.

- **Sí: la serpiente espera la primera tecla, con "Pulsa una dirección" en el canvas.**
  Razón: el jugador no pierde el primer segundo al cargar. El aviso no tiene equivalente en el
  HUD React (mismo criterio que "Pulsa Espacio" en SPEC 08).

- **Sí: cola de giros (máx. 2 por paso) e ignorar el giro de 180°.** Razón: sin cola, dos
  giros rápidos dentro de un paso se pierden o provocan una muerte injusta.

- **Sí: tablero lleno termina la partida con el modal normal.** Razón: llegar a 432 celdas es
  casi imposible y no merece un modal de victoria aparte.

- **Sí: bloques de neón `--green` con glow y cuadrícula tenue.** Razón: coherente con
  `cover-snake` y con los tokens de la plataforma.

- **Sí: `P` y `Escape` conmutan la pausa de la plataforma (`onPauseToggle`).** Razón: la
  fuente de verdad de la pausa es React (mismo criterio que SPEC 07 y SPEC 08).

- **Sí: un solo HUD, el de la plataforma.** Puntuación, longitud y nivel solo se muestran en
  el HUD React. Razón: sin datos duplicados sobre la pantalla de juego (mismo criterio que
  SPEC 05).

- **No: sonidos.** Razón: no hay assets de audio para Snake.

- **Sí: asset en `public/games/snake/`.** Razón: Next.js sirve `public/` de forma estática.
  Una carpeta por juego evita colisiones de nombres.

- **Sí: callbacks como interfaz de comunicación.** El componente canvas llama a
  `onScoreChange`, `onLengthChange`, `onLevelChange`, `onPauseToggle` y `onGameOver`.
  Razón: desacoplamiento limpio; el juego no sabe nada de Supabase ni de la plataforma.

- **Sí: `dynamic(..., { ssr: false })` en `components/snake-player.tsx`.** Razón: `canvas`,
  `Image` y `requestAnimationFrame` no existen en el servidor, y `ssr: false` solo se admite
  en Client Components.

- **Sí: play-page específica `app/jugar/snake/page.tsx` + `components/snake-player.tsx`** en
  lugar de modificar `app/jugar/[id]`. Razón: evita condicionales en la ruta genérica; la ruta
  estática tiene prioridad sobre la dinámica.

- **Sí: reutilizar `cover-snake`.** Razón: ya existe en `app/globals.css` y representa una
  serpiente con su comida.

- **No: crear tablas nuevas.** Se reutilizan `games` y `scores` del spec 06.
  Razón: el modelo es genérico para cualquier juego con score numérico.

- **No: cambios de RLS en este spec.** Se reutilizan las políticas abiertas de SPEC 06.
  Razón: se endurecen en el spec futuro de seguridad.

- **No: realtime en leaderboards.** Los scores se ven al recargar. Razón: la complejidad de
  subscriptions no aporta valor con pocos jugadores activos.

- **No: componente genérico `CanvasGame`.** Cada juego tiene su componente propio.
  Razón: YAGNI; los juegos difieren en HUD, entrada y assets.
