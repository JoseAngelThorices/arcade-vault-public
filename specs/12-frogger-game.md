# SPEC 12 — Integración del juego Frogger (motor y clasificación)

> **Estado:** Implementado
> **Depende de:** 06-games-table-leaderboard-supabase
> **Fecha:** 2026-09-28
> **Objetivo:** Crear desde cero Frogger como juego jugable con ID `frogger`: un sapo que cruza
> una carretera con tráfico y un río con troncos y tortugas hasta llegar a los nenúfares de la
> otra orilla, conectando puntuación, vidas, nivel y fin de partida con el HUD React de su
> página de juego y con el leaderboard de Supabase. Introduce además la categoría `MAZE` en el
> esquema de la plataforma.

---

## Alcance

**Entra:**

- Ampliar la unión `GameRow["cat"]` en `lib/supabase/types.ts` y el array `CATS` de
  `lib/games.ts` con el valor `"MAZE"`, la primera categoría del catálogo fuera de
  `ARCADE`/`PUZZLE`/`SHOOTER`.
- Insertar la fila `frogger` en la tabla `games` de Supabase (seed manual vía SQL) con
  `cat = 'MAZE'`.
- Crear `components/games/frogger-game.tsx`: componente React que encapsula el canvas
  (720×540, cuadrícula de 20×15 celdas de 36 px) y el bucle de juego, escrito desde cero
  porque no hay código de referencia ni assets en `references/`. Acepta las props `paused`,
  `onScoreChange`, `onLivesChange`, `onLevelChange`, `onPauseToggle` y `onGameOver`.
- Mecánica:
  - El tablero tiene 15 filas (0 arriba, 14 abajo): fila 0 = meta (5 nenúfares), filas 1–5 =
    río (5 carriles con troncos y tortugas), fila 6 = isla central segura, filas 7–11 =
    carretera (5 carriles con coches y camiones), fila 12 = arcén seguro, filas 13–14 = zona
    de salida (césped), con el sapo apareciendo centrado en la fila 14.
  - El sapo salta una celda por pulsación de flecha o WASD (movimiento discreto, no continuo);
    se ignora la repetición automática de tecla (`event.repeat`) y un salto no se admite hasta
    que termina la animación del anterior (~100 ms).
  - En la carretera, coches y camiones se desplazan en horizontal a velocidad constante por
    carril, cada carril con su propio sentido; el sapo muere si su celda se solapa con un
    vehículo.
  - En el río, cada carril mueve troncos o grupos de tortugas a velocidad constante; si el sapo
    aterriza sobre uno, se desplaza con él en horizontal (posición continua, no discreta)
    mientras dure el contacto; si el sapo está en una fila de río sin nada debajo, o si el
    tronco/tortuga lo arrastra fuera del borde del tablero, el sapo muere (se ahoga).
  - La fila de meta tiene 5 huecos de nenúfar de 2 celdas de ancho, separados por agua; el
    sapo solo sobrevive si aterriza exactamente sobre un hueco libre. Aterrizar en agua o sobre
    un hueco ya ocupado también mata al sapo.
  - Al ocupar un hueco de nenúfar, el sapo respawnea en la fila de salida y el hueco queda
    marcado como relleno el resto de la ronda.
  - Al rellenar los 5 huecos, la ronda se completa: se suma el bono de ronda, los 5 huecos se
    vacían, el nivel sube uno y la velocidad de todos los carriles aumenta; la puntuación y las
    vidas no se reinician.
  - Puntuación: `10` puntos por cada fila de progreso nuevo alcanzada en la vida actual (solo
    cuenta el avance, no retroceder); `50` puntos por cada nenúfar ocupado; `200` puntos de bono
    al completar la ronda (rellenar los 5 huecos).
  - Vidas: el sapo empieza con 3. Cada muerte (coche, ahogo, nenúfar inválido) resta una vida y
    respawnea al sapo en la fila de salida, conservando puntuación, nivel y huecos ya rellenos.
    Al llegar a 0 vidas, termina la partida.
  - Progresión: cada ronda completada multiplica la velocidad base de todos los carriles por
    `1.15`, con un tope de `2.5×` la velocidad base.
- Carriles (velocidades base en nivel 1, en píxeles/segundo, sentido `+1` derecha / `-1`
  izquierda):

  | Fila | Tipo             | Sentido | Velocidad | Ancho entidad | Espaciado |
  |------|------------------|---------|-----------|----------------|-----------|
  | 1    | Tronco           | -1      | 60        | 3 celdas       | 5 celdas  |
  | 2    | Tortugas (x2)    | +1      | 50        | 2 celdas       | 6 celdas  |
  | 3    | Tronco           | -1      | 75        | 2 celdas       | 5 celdas  |
  | 4    | Tortugas (x3)    | +1      | 55        | 3 celdas       | 7 celdas  |
  | 5    | Tronco           | -1      | 65        | 3 celdas       | 6 celdas  |
  | 7    | Camión           | +1      | 50        | 2 celdas       | 7 celdas  |
  | 8    | Coche            | -1      | 65        | 1 celda        | 5 celdas  |
  | 9    | Coche            | +1      | 95        | 1 celda        | 4 celdas  |
  | 10   | Camión           | -1      | 55        | 2 celdas       | 6 celdas  |
  | 11   | Coche            | +1      | 70        | 1 celda        | 5 celdas  |

  Cada carril recicla sus entidades por el borde opuesto al salir de pantalla (scroll
  infinito).
- Aspecto:
  - Sapo: bloques de neón `--green` con glow, con ojos, que rota para mirar en la dirección de
    su último salto válido.
  - Carretera: asfalto oscuro con líneas discontinuas; coches y camiones en rectángulos de
    neón (`--cyan`, `--magenta`, `--yellow`) con un par de faros.
  - Río: agua azul oscura; troncos en rectángulos marrones; tortugas en círculos verdes
    agrupados.
  - Isla central y arcén: franjas de césped, sin peligros.
  - Meta: agua con 5 nenúfares (círculos verdes); un nenúfar ocupado cambia de tono (dorado) y
    muestra un icono de sapo pequeño en el centro.
  - Todo el canvas se dibuja con `imageSmoothingEnabled = false`, sin assets externos: no hay
    pixel art de referencia para Frogger en `references/source-assets/`, así que coches,
    camiones, troncos, tortugas y el sapo se dibujan con primitivas de canvas (rectángulos,
    círculos, polígonos), igual que Tetris (SPEC 07).
- Controles:
  - Flechas y WASD saltan una celda en esa dirección.
  - El sapo puede moverse en las 4 direcciones (no solo hacia delante), pero solo el avance neto
    hacia la meta puntúa.
- El canvas mantiene su resolución interna de 720×540 y se escala por CSS
  (`max-width: 100%` con `aspect-ratio: 4 / 3`): llena la pantalla CRT de la plataforma, que
  también es 4:3, sin bandas laterales.
- Crear `app/jugar/frogger/page.tsx`: play-page específica (Server Component) que lee el juego
  con `getGame('frogger')` de `lib/supabase/games.ts` y renderiza el reproductor.
- Crear `components/frogger-player.tsx`: reproductor `"use client"` que gestiona el estado
  (puntuación, vidas, nivel, pausa y fin de partida) y pasa callbacks al componente canvas. El
  HUD React muestra JUGADOR, PUNTUACIÓN, VIDAS y NIVEL (sin sustituciones: Frogger tiene vidas
  de forma nativa).
- Las teclas `P` y `Escape` conmutan la pausa de la plataforma vía `onPauseToggle`. El botón
  "PAUSA" pasa el flag `paused` al componente, que congela el bucle (los vehículos, troncos y
  tortugas dejan de moverse; las teclas de salto se ignoran).
- Modal de fin de partida: el nombre se pre-rellena con `readPlayerName()`. Al confirmar, se
  inserta la puntuación en `scores` vía cliente browser y se persiste el nombre con
  `writePlayerName()`.
- El canvas no dibuja puntuación, vidas ni nivel, ni ningún overlay de GAME OVER o PAUSA.
- Añadir la clase `cover-frogger` a `app/globals.css`.
- Añadir la fila de `frogger` a `references/implemented-games.md`.

**Fuera de alcance:**

- Crear las tablas `games` o `scores` en Supabase: ya existen (spec 06).
- Supabase Auth: `user_id` se almacena como `null` en todos los scores.
- Cambios de RLS: las políticas abiertas de SPEC 06 (SELECT en `games` y `scores`, INSERT en
  `scores`) ya cubren el juego nuevo. Endurecerlas es un spec futuro de seguridad.
- Realtime: el leaderboard no se actualiza en vivo, solo al cargar la página.
- Paginación del leaderboard: se muestran los top 10 fijos.
- Ratón.
- Actualización automática de `best` y `plays` en la tabla `games`.
- Tortugas que se sumergen, peligros temporales en los nenúfares (serpiente/caimán) y moscas de
  bonus: quedan para un spec futuro.
- Temporizador por vida o modo contrarreloj: la partida no tiene límite de tiempo en este spec.
- Sonidos: no hay assets de audio para Frogger en este spec.
- Assets de imagen: todo el arte se dibuja con primitivas de canvas, sin sprites.

---

## Modelo de datos

### Ampliación de tipos existentes

En `lib/supabase/types.ts`:

```ts
export interface GameRow {
  // ...
  cat: "ARCADE" | "PUZZLE" | "SHOOTER" | "MAZE";
  // ...
}
```

En `lib/games.ts`:

```ts
export const CATS = [
  "TODOS",
  "ARCADE",
  "PUZZLE",
  "SHOOTER",
  "VERSUS",
  "MAZE",
] as const satisfies readonly string[];
```

### Seed en Supabase: tabla `games`

Ejecutar en el SQL Editor de Supabase:

```sql
INSERT INTO games (id, title, short, long, cat, cover, color)
VALUES (
  'frogger', 'FROGGER', 'Cruza la carretera y el río sin convertirte en papilla.',
  'Guía al sapo esquivando coches y saltando entre troncos y tortugas hasta llegar a los nenúfares de la otra orilla. Cada ronda completa sube el nivel y acelera todo el tráfico y la corriente. Un despiste con un coche o un chapuzón sin tronco cuesta una vida.',
  'MAZE', 'cover-frogger', 'green'
);
```

### Props del componente `FroggerGame`

```ts
interface FroggerGameProps {
  paused: boolean;
  onScoreChange: (score: number) => void;
  onLivesChange: (lives: number) => void; // empieza en 3
  onLevelChange: (level: number) => void;
  onPauseToggle: () => void; // teclas P y Escape
  onGameOver: (finalScore: number) => void;
}
```

### Estado interno del bucle

```ts
type Dir = "up" | "down" | "left" | "right";

type LaneKind = "road" | "river";

type LaneEntity = {
  x: number; // posición en píxeles, no en celdas
  widthCells: number;
};

type Lane = {
  row: number; // 1..5 río, 7..11 carretera
  kind: LaneKind;
  dir: 1 | -1;
  baseSpeed: number; // px/s en nivel 1, ver tabla de carriles
  entities: LaneEntity[];
};

type HomeSlot = { col: number; widthCells: number; filled: boolean };

const state = {
  frog: {
    col: 9, // float cuando va sobre un tronco/tortuga, entero en el resto de filas
    row: 14,
    facing: "up" as Dir,
    ridingEntity: null as LaneEntity | null,
  },
  lanes: [] as Lane[], // 10 carriles: filas 1-5 río, 7-11 carretera
  homeSlots: [] as HomeSlot[], // 5 huecos en la fila 0
  bestRowThisLife: 14, // fila más alta alcanzada desde el último respawn (menor = más avance)
  score: 0,
  lives: 3,
  level: 1,
  lastHopAt: 0, // timestamp del último salto, para el cooldown de animación
  speedMult: 1, // 1.15^(nivel-1), tope 2.5
};
```

No se introducen tablas nuevas. Se reutilizan `ScoreRow` de `lib/supabase/types.ts`, y
`GameRow` se amplía solo en el campo `cat` (ver arriba).

---

## Plan de implementación

1. **Ampliar el esquema y sembrar Supabase.**
   - Añadir `"MAZE"` a la unión `cat` en `lib/supabase/types.ts`.
   - Añadir `"MAZE"` al array `CATS` de `lib/games.ts`.
   - Ejecutar el INSERT de la fila `frogger` en el SQL Editor de Supabase.
   Verificación: `/juegos` permite filtrar por MAZE y la card de FROGGER aparece; `/juego/frogger`
   carga su detalle.

2. **Crear `components/games/frogger-game.tsx`**, un componente `"use client"` que:
   - Renderiza un `<canvas>` de 720×540 con `imageSmoothingEnabled = false`, escalado por CSS
     con `max-width: 100%` y `aspect-ratio: 4 / 3`.
   - Inicializa los 10 carriles con la tabla de velocidades, sentidos y espaciados definida en
     el alcance, y los 5 huecos de nenúfar de la fila 0.
   - Contiene el bucle completo escrito desde cero:
     - `resetLife`: coloca al sapo en `(9, 14)`, `bestRowThisLife = 14`, sin tocar
       `score`, `lives`, `level` ni `homeSlots`.
     - `resetRound`: vacía `homeSlots`, sube `level`, recalcula `speedMult` (tope 2,5×) y llama
       a `resetLife`.
     - `tryHop(dir)`: calcula la celda destino, la clampa a `0..19` en columnas, y según la fila
       destino resuelve el resultado (avanzar, morir contra vehículo, ahogarse, ocupar nenúfar,
       morir en agua de meta).
     - `updateLanes(dt)`: mueve cada entidad según `dir × baseSpeed × speedMult × dt`, reciclando
       por el borde opuesto.
     - `updateRiding(dt)`: si el sapo está en una fila de río, arrastra su columna con la
       velocidad del tronco/tortuga que lo sostiene; si no hay ninguno debajo, o la columna sale
       de `0..19`, dispara la muerte por ahogo.
     - `checkRoadCollision()`: si el sapo está en una fila de carretera y su celda se solapa con
       algún vehículo, dispara la muerte.
     - `onDeath()`: `lives -= 1`; si `lives > 0`, llama a `resetLife()`; si `lives === 0`, llama
       a `onLivesChange(0)` y después a `onGameOver(score)`, y detiene el bucle.
     - `drawLanes`, `drawFrog`, `drawHomeRow`.
   - Recibe la prop `paused: boolean`: si es `true`, `updateLanes`, `updateRiding` y los saltos
     se congelan, pero `draw()` sigue pintando el último estado.
   - Llama a `onScoreChange`, `onLivesChange` y `onLevelChange` cuando esos valores cambian,
     comparando con el valor anterior antes de disparar el callback.
   - Llama a `onPauseToggle()` al pulsar `P` o `Escape`.
   - No dibuja puntuación, vidas ni nivel, ni overlays de GAME OVER o PAUSA.
   - Registra `keydown` en `document` con `preventDefault` en flechas y WASD, ignorando
     `event.repeat`. Lo elimina junto con `cancelAnimationFrame` en el `return` del
     `useEffect`.
   Verificación: el juego arranca en `/jugar/frogger` y es jugable con las flechas y WASD; morir
   contra un coche, ahogarse y completar la meta 5 veces funcionan como se describe.

3. **Crear `app/jugar/frogger/page.tsx` y `components/frogger-player.tsx`**:
   - `page.tsx` es Server Component: `getGame('frogger')`, `notFound()` si no existe,
     `generateMetadata` con el título, y renderiza `<FroggerPlayer game={game} />`.
   - `frogger-player.tsx` es `"use client"` e importa `FroggerGame` con
     `dynamic(..., { ssr: false })` (solo se admite en Client Components).
   - Estado local: `score`, `lives`, `level`, `paused`, `over`, `name`, `saveStatus`, `run`.
   - HUD React: JUGADOR, PUNTUACIÓN, VIDAS y NIVEL, con números en `toLocaleString("es-ES")`.
   - Al abrir el modal de fin de partida, lee el nombre con `readPlayerName()` de
     `lib/player-name.ts` y pre-rellena el campo `name`.
   - Al confirmar, inserta en `scores` con `createClient()` de `lib/supabase/client.ts`:
     `{ game_id: 'frogger', player_name: name, score, user_id: null }`. Si Supabase confirma,
     persiste el nombre con `writePlayerName()` y registra la marca con `saveScore()` de
     `useSession()`.
   - `saveStatus` (`idle` | `saving` | `saved` | `error`) deshabilita el botón mientras guarda
     y después. Si falla, muestra error y permite reintentar.
   - "JUGAR DE NUEVO" reinicia el estado e incrementa `run` para remontar el canvas.
   - Reutiliza la misma maquetación (HUD React + CRT + modal de fin de partida) que
     `components/snake-player.tsx`.
   Verificación: el HUD React muestra los valores en tiempo real. Tras una partida, el score
   aparece en `/juego/frogger` y en `/salon` al recargar.

4. **Añadir la clase `cover-frogger` en `app/globals.css`**, en la sección de coberturas de
   juego, con carriles de carretera y nenúfares verdes, coherente con el resto de `cover-*`:

   ```css
   .cover-frogger { background: linear-gradient(180deg, #001f2a 0 40%, #0a2f18 40% 100%); }
   .cover-frogger::after {
     content: "";
     position: absolute; inset: 0;
     background:
       repeating-linear-gradient(90deg, transparent 0 18%, rgba(245,255,0,0.5) 18% 20%,
         transparent 20% 38%, rgba(245,255,0,0.5) 38% 40%, transparent 40% 100%) 0 62%/100% 3px,
       radial-gradient(circle at 20% 20%, var(--green) 0 10px, transparent 11px),
       radial-gradient(circle at 45% 15%, var(--green) 0 10px, transparent 11px),
       radial-gradient(circle at 70% 22%, var(--green) 0 10px, transparent 11px),
       radial-gradient(circle at 88% 15%, var(--green) 0 10px, transparent 11px);
     background-repeat: no-repeat;
     filter: drop-shadow(0 0 6px rgba(0,255,136,0.5));
   }
   ```

   Verificación: la card de FROGGER en `/juegos` muestra la nueva cobertura, sin heredar
   `cover-rana` (clase ya existente pero sin relación con el `id` `frogger`).

5. **Añadir la fila de `frogger` a `references/implemented-games.md`** con los mismos datos
   que la fila de `games` (`frogger`, FROGGER, MAZE, la frase `short`, `green`).
   Verificación: la tabla del fichero incluye la nueva fila.

6. **Verificación final.** `npm run build` completa sin errores de TypeScript.
   Ninguna ruta existente devuelve 500.

---

## Criterios de aceptación

- [ ] `lib/supabase/types.ts` incluye `"MAZE"` en la unión `GameRow["cat"]`.
- [ ] `lib/games.ts` incluye `"MAZE"` en `CATS`.
- [ ] La card de FROGGER aparece en `/juegos` con la cover `cover-frogger`, el acento verde y
      puede filtrarse por la categoría MAZE.
- [ ] `/juego/frogger` carga con los datos reales del juego y el leaderboard top 10.
- [ ] `/jugar/frogger` carga sin errores de SSR ni de TypeScript.
- [ ] El canvas renderiza las 15 filas descritas (meta, río, isla, carretera, arcén, salida)
      con el sapo centrado en la fila de salida.
- [ ] El tablero llena la pantalla CRT, sin bandas negras a los lados.
- [ ] En una ventana más estrecha que 720 px, el canvas se escala sin desbordar ni deformarse.
- [ ] El juego es jugable con las flechas y con WASD; cada pulsación mueve al sapo una celda.
- [ ] Las flechas y WASD no hacen scroll de la página durante la partida.
- [ ] Mantener pulsada una tecla no produce varios saltos por fotograma.
- [ ] Chocar con un coche o un camión en la carretera resta una vida.
- [ ] Quedarse en una fila de río sin tronco ni tortuga debajo resta una vida.
- [ ] Subirse a un tronco o una tortuga arrastra al sapo con su movimiento.
- [ ] Ser arrastrado fuera del borde del tablero por un tronco o una tortuga resta una vida.
- [ ] Aterrizar en un hueco de nenúfar libre lo marca como ocupado, suma 50 puntos y respawnea
      al sapo en la fila de salida.
- [ ] Aterrizar en agua o en un nenúfar ya ocupado resta una vida.
- [ ] Avanzar a una fila nunca alcanzada en la vida actual suma 10 puntos por fila de progreso.
- [ ] Retroceder no resta puntos.
- [ ] Rellenar los 5 nenúfares suma el bono de 200 puntos, vacía los huecos, sube el nivel y
      acelera todos los carriles (tope 2,5× la velocidad base).
- [ ] Al perder una vida con vidas restantes, el sapo respawnea sin perder puntuación, nivel ni
      huecos ya rellenos.
- [ ] Al llegar a 0 vidas, `onLivesChange(0)` se dispara antes que `onGameOver(score)`.
- [ ] El canvas no dibuja puntuación, vidas ni nivel, ni overlays de GAME OVER o PAUSA.
- [ ] El HUD React refleja en tiempo real la puntuación, las vidas y el nivel.
- [ ] El botón "PAUSA" congela vehículos, troncos, tortugas y saltos.
- [ ] "REANUDAR" continúa sin que ningún vehículo o tronco dé un salto brusco.
- [ ] `P` y `Escape` conmutan la pausa de la plataforma igual que el botón.
- [ ] Al terminar la partida, aparece el modal React de fin de partida con la puntuación final.
- [ ] El botón "JUGAR DE NUEVO" reinicia la partida desde cero (3 vidas, nivel 1, huecos vacíos,
      puntuación 0).
- [ ] Al abrir el modal, el nombre se pre-rellena con `av_player_name` de localStorage si existe.
- [ ] Al confirmar, el score se inserta en Supabase y el nombre se persiste en localStorage.
- [ ] El botón "GUARDAR PUNTUACIÓN" queda deshabilitado mientras guarda y después (sin doble
      inserción). Si falla, se muestra error y se puede reintentar.
- [ ] El score guardado aparece en `/juego/frogger` y en `/salon` al recargar.
- [ ] Cuando no hay scores, el leaderboard muestra "Sé el primero en entrar al salón de la fama".
- [ ] `/salon` muestra una pestaña para FROGGER.
- [ ] Al salir de `/jugar/frogger`, no quedan listeners de teclado ni bucle activos.
- [ ] `npm run build` completa sin errores de TypeScript.
- [ ] Ninguna ruta existente devuelve 500.

---

## Decisiones

- **Sí: introducir la categoría `MAZE`.** Razón: Frogger no encaja en `ARCADE`, `PUZZLE` ni
  `SHOOTER`; el tema lo pedía tal cual estaba anotado en `references/game-suggestions-todo.md`.

- **Sí: reutilizar el `id` `frogger` del to-do de `@game-planner`.** Razón: ya estaba sugerido
  con ese `id`, categoría MAZE, color green y la misma frase `short`; reutilizarlo evita
  duplicar la entrada.

- **Sí: juego escrito desde cero, sin assets de imagen.** No hay código de referencia en
  `references/` ni pixel art para Frogger. Razón: todo el arte (sapo, coches, troncos,
  tortugas) es geometría simple que se lee bien con primitivas de canvas, igual que Tetris
  (SPEC 07).

- **Sí: tablero de 20×15 celdas de 36 px (720×540) escalado por CSS.** Razón: mismo criterio de
  4:3 que Snake (SPEC 09) y Arkanoid (SPEC 08): llena la pantalla CRT sin bandas y dimensiona
  con margen suficiente para 5 carriles de río, 5 de carretera y las zonas seguras.

- **Sí: vidas nativas, sin sustitución en el HUD.** A diferencia de Snake o Tetris, Frogger
  tiene vidas de forma clásica, así que el HUD base (JUGADOR, PUNTUACIÓN, VIDAS, NIVEL) no
  necesita adaptarse.

- **Sí: 3 vidas.** Razón: es el número clásico del arcade original y da margen para aprender los
  patrones de tráfico y corriente sin alargar la partida en exceso.

- **Sí: progresión por rondas (rellenar los 5 nenúfares) en vez de por tiempo o puntuación.**
  Razón: es la estructura original de Frogger y encaja con el patrón de nivel de Snake
  (aceleración progresiva con tope) sin introducir un sistema nuevo.

- **Sí: solo el avance neto puntúa (10 × fila nueva).** Razón: evita que el jugador farmee
  puntos moviéndose arriba y abajo sin arriesgarse a cruzar.

- **No: temporizador por vida o modo contrarreloj en este spec.** Razón: se deja como feature
  independiente en un spec futuro para no mezclar dos sistemas de presión
  distintos (tráfico + reloj) en la primera versión jugable.

- **No: tortugas que se sumergen, nenúfares con peligro temporal ni moscas de bonus en este
  spec.** Razón: son variaciones sobre la mecánica base; quedan para un spec futuro para
  mantener el alcance de este spec en "cruzar es posible y letal".

- **Sí: reciclado infinito de carriles (wrap por el borde opuesto).** Razón: es el
  comportamiento estándar del género y evita comprobar bordes especiales para el spawn de
  entidades.

- **Sí: el sapo puede moverse en las 4 direcciones.** Razón: retroceder para esquivar un
  vehículo o esperar a que pase un hueco en el tráfico es parte de la estrategia clásica.

- **Sí: `P` y `Escape` conmutan la pausa de la plataforma (`onPauseToggle`).** Razón: la fuente
  de verdad de la pausa es React (mismo criterio que SPEC 07, 08 y 09).

- **Sí: un solo HUD, el de la plataforma.** Puntuación, vidas y nivel solo se muestran en el HUD
  React. Razón: sin datos duplicados sobre la pantalla de juego (mismo criterio que SPEC 05).

- **No: sonidos.** Razón: no hay assets de audio para Frogger en este spec.

- **Sí: nueva clase `cover-frogger`, sin reutilizar `cover-rana`.** `app/globals.css` ya tiene
  una clase `cover-rana` sin usar, con un motivo visual parecido (franjas cian + círculo verde).
  Razón: la convención del proyecto liga la cobertura al `id` del juego (`cover-<id>`), y el
  `id` elegido es `frogger`, no `rana`; reutilizar una clase con nombre distinto rompería esa
  convención y confundiría a quien la lea más adelante.

- **Desviación: `cover-frogger` claro y retro, no el neón oscuro del plan.** El CSS del paso 4
  quedaba demasiado oscuro. Se sustituye por la escena del Frogger arcade en colores planos y
  claros: orilla verde con nichos, río azul con troncos y tortugas, mediana de arena, carretera
  gris con coches y líneas blancas, y la rana en la acera, en paleta NES. Sin `drop-shadow` neón.

- **Sí: callbacks como interfaz de comunicación.** El componente canvas llama a
  `onScoreChange`, `onLivesChange`, `onLevelChange`, `onPauseToggle` y `onGameOver`. Razón:
  desacoplamiento limpio; el juego no sabe nada de Supabase ni de la plataforma.

- **Sí: `dynamic(..., { ssr: false })` en `components/frogger-player.tsx`.** Razón: `canvas` y
  `requestAnimationFrame` no existen en el servidor, y `ssr: false` solo se admite en Client
  Components.

- **Sí: play-page específica `app/jugar/frogger/page.tsx` + `components/frogger-player.tsx`**
  en lugar de modificar `app/jugar/[id]`. Razón: evita condicionales en la ruta genérica; la
  ruta estática tiene prioridad sobre la dinámica.

- **No: crear tablas nuevas.** Se reutilizan `games` y `scores` del spec 06. Razón: el modelo es
  genérico para cualquier juego con score numérico; solo se amplía el campo `cat`.

- **No: cambios de RLS en este spec.** Se reutilizan las políticas abiertas de SPEC 06. Razón:
  se endurecen en el spec futuro de seguridad.

- **No: realtime en leaderboards.** Los scores se ven al recargar. Razón: la complejidad de
  subscriptions no aporta valor con pocos jugadores activos.

- **No: componente genérico `CanvasGame`.** Cada juego tiene su componente propio. Razón: YAGNI;
  los juegos difieren en HUD, entrada y assets.

### Desviaciones durante la implementación

- **Sí: la columna «Espaciado» de la tabla de carriles es la distancia entre el inicio de una
  entidad y el de la siguiente** (periodo), no el hueco libre entre ellas. Razón: el río queda
  cubierto al 40-60 % y se cruza con ritmo; con huecos libres quedaba al 25-37 %.
- **Sí: tres skins (NEÓN, RETRO y CLÁSICO) con selector y arranque en RETRO**, aunque el spec no
  las pedía. Razón: los otros cuatro juegos las tienen (`useSkin()` de `lib/skins.ts` +
  `SkinPicker`) y Frogger debe verse igual. NEÓN es el aspecto descrito en «Aspecto»; RETRO usa
  bloques sólidos sin glow con franja clara superior; CLÁSICO imita el arcade de 1981 (río azul
  marino, carretera negra, aceras moradas, tortugas rojas).
- **Sí: gamepad táctil en móvil (SPEC 10)**, aunque «Controles táctiles» estaba fuera de alcance.
  Razón: paridad con los otros juegos. `KEY_MAP` con las cuatro flechas, `max-md:hidden` en
  `.player-hud` y `<MobileGamepad>` tras el CRT, igual que `components/snake-player.tsx`.
