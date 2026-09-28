# SPEC — Frogger: peligros temáticos y moscas de bonus

> **Estado:** Borrador
> **Depende de:** 06-games-table-leaderboard-supabase, 01-frogger-core
> **Fecha:** 2026-09-28
> **Objetivo:** Añadir tres variaciones temáticas sobre el motor base de Frogger — tortugas que
> se sumergen, un peligro temporal que ocupa nenúfares y moscas de bonus — para dar más
> variedad e imprevisibilidad a partir de niveles intermedios sin cambiar la estructura de
> puntuación, vidas ni la interfaz de props del componente.

---

## Alcance

**Entra:**

- **Tortugas que se sumergen:** en los carriles de río con tortugas (filas 2 y 4), cada grupo
  de tortugas alterna entre flotando y sumergido en un ciclo periódico. Antes de sumergirse
  parpadea durante un aviso corto. Mientras está sumergido, no sirve de apoyo: si el sapo está
  encima, se ahoga igual que si no hubiera nada.
- **Nenúfar con peligro temporal:** a partir del nivel 3, uno de los huecos de nenúfar vacíos de
  la fila de meta se ocupa periódicamente por una serpiente. Aterrizar sobre un hueco con
  serpiente mata al sapo igual que aterrizar en agua. La serpiente permanece un tiempo fijo y
  luego se traslada a otro hueco vacío al azar (o desaparece un tiempo si no queda ninguno
  libre). Nunca ocupa un hueco ya relleno por el jugador.
- **Moscas de bonus:** aparecen al azar sobre la isla central o el arcén (filas seguras 6 o 12),
  con intervalo aleatorio entre apariciones. El sapo que salta sobre una mosca la atrapa y
  suma puntos extra; si no la atrapa a tiempo, desaparece sola.
- Todo el comportamiento nuevo vive dentro de `components/games/frogger-game.tsx`: no se añaden
  props nuevas al componente ni cambia `FroggerGameProps`. Los puntos de las moscas se notifican
  con el mismo `onScoreChange` que ya existe.
- Aspecto:
  - Tortuga sumergida: se dibuja más oscura y sin el brillo de neón mientras dura la inmersión;
    el aviso previo es un parpadeo rápido de opacidad.
  - Serpiente en nenúfar: silueta ondulada en un tono distinto (magenta) sobre el hueco
    afectado, claramente diferenciable de un nenúfar libre u ocupado por el jugador.
  - Mosca: punto pequeño amarillo con un ligero movimiento errático, con glow tenue.

**Fuera de alcance:**

- Cambios en `FroggerGameProps`, en el HUD React o en la tabla `games`/`scores`.
- Temporizador global o modo contrarreloj: no forma parte de este spec.
- Vidas extra, power-ups permanentes o multiplicadores de puntuación duraderos.
- Sonidos para los eventos nuevos (sumersión, serpiente, mosca atrapada).
- Controles táctiles, ratón o mobile.
- Supabase Auth, cambios de RLS y Realtime: fuera de alcance como en el spec 01.
- Ajustar la dificultad base (velocidades de carriles) definida en el spec 01.
- Dificultad configurable por el jugador (elegir a partir de qué nivel aparece la serpiente,
  frecuencia de sumersión, etc.): los valores son fijos, definidos en este spec.

---

## Modelo de datos

No hay cambios en Supabase ni en `lib/supabase/types.ts`. No se añaden ni modifican props del
componente `FroggerGame` (siguen siendo las de `01-frogger-core.md`). Se amplía únicamente el
estado interno del bucle definido en el spec 01:

```ts
type TurtleLaneState = {
  diving: boolean;
  warning: boolean; // true durante el aviso previo a sumergirse
  cycleStart: number; // timestamp del inicio del ciclo actual
};

type SnakeHazard = {
  slotIndex: number; // índice en homeSlots, siempre un hueco no relleno
  since: number; // timestamp desde el que ocupa ese hueco
} | null;

type Fly = {
  col: number;
  row: 6 | 12; // solo isla central o arcén
  spawnedAt: number;
} | null;

const hazardState = {
  turtleLanes: {} as Record<number, TurtleLaneState>, // clave: fila (2, 4)
  snake: null as SnakeHazard,
  fly: null as Fly,
  nextFlyAt: 0, // timestamp del próximo intento de aparición
};
```

Constantes:

```ts
const TURTLE_DIVE_CYCLE_MS = 4000; // flota 4 s
const TURTLE_DIVE_DURATION_MS = 1500; // sumergida 1,5 s
const TURTLE_DIVE_WARNING_MS = 1000; // parpadeo 1 s antes de sumergirse

const SNAKE_MIN_LEVEL = 3;
const SNAKE_OCCUPY_MS = 6000; // tiempo que ocupa un hueco antes de trasladarse
const SNAKE_RELOCATE_CHECK_MS = 500; // frecuencia de comprobación de huecos libres

const FLY_MIN_INTERVAL_MS = 8000;
const FLY_MAX_INTERVAL_MS = 12000;
const FLY_LIFETIME_MS = 4000; // desaparece sola si no se atrapa
const FLY_POINTS = 200;
```

---

## Plan de implementación

1. **Tortugas que se sumergen.**
   - En `components/games/frogger-game.tsx`, añadir `hazardState.turtleLanes` con una entrada
     por cada fila de tortugas (2 y 4), inicializada a `diving: false, warning: false,
     cycleStart: 0`.
   - En cada `tick`, actualizar el ciclo de cada fila: tras `TURTLE_DIVE_CYCLE_MS -
     TURTLE_DIVE_WARNING_MS` flotando, activar `warning: true`; tras `TURTLE_DIVE_CYCLE_MS`,
     pasar a `diving: true` durante `TURTLE_DIVE_DURATION_MS`; al terminar, volver a flotar y
     reiniciar `cycleStart`.
   - En `updateRiding`, si el sapo está sobre una entidad de una fila con `diving: true`, tratarla
     como si no hubiera nada debajo (dispara la muerte por ahogo del spec 01).
   - En `drawLanes`, dibujar las tortugas de esas filas más oscuras y sin glow mientras
     `diving`, y con parpadeo de opacidad mientras `warning`.
   Verificación: en una partida en `/jugar/frogger`, las tortugas de las filas 2 y 4 parpadean,
   se sumergen y el sapo se ahoga si está encima durante la inmersión.

2. **Nenúfar con peligro temporal.**
   - Al alcanzar `level >= SNAKE_MIN_LEVEL` (incluyendo al empezar ya en un nivel superior tras
     rondas completadas), activar la comprobación de la serpiente en cada `tick`.
   - Cada `SNAKE_RELOCATE_CHECK_MS`, si no hay serpiente activa o si `since` supera
     `SNAKE_OCCUPY_MS`, mover la serpiente a un hueco vacío al azar entre los `homeSlots` con
     `filled: false`; si no hay ninguno libre, `hazardState.snake = null` hasta que se libere uno.
   - En `tryHop`, al aterrizar en la fila de meta, si el hueco de destino coincide con
     `hazardState.snake?.slotIndex`, resolver como muerte (mismo camino que aterrizar en agua),
     en vez de como nenúfar libre.
   - En `resetRound` (al completar los 5 huecos), poner `hazardState.snake = null`: el ciclo
     empieza de cero en la siguiente ronda.
   - En `drawHomeRow`, dibujar la silueta de serpiente sobre el hueco afectado.
   Verificación: a partir del nivel 3, un hueco vacío muestra periódicamente la serpiente;
   aterrizar ahí mata al sapo; nunca aparece sobre un hueco ya relleno.

3. **Moscas de bonus.**
   - Programar `hazardState.nextFlyAt` en la inicialización y tras cada aparición, con un
     intervalo aleatorio entre `FLY_MIN_INTERVAL_MS` y `FLY_MAX_INTERVAL_MS`.
   - Cuando `now >= nextFlyAt` y no hay mosca activa, crear una `Fly` en una columna aleatoria de
     la fila 6 o la fila 12 (al azar entre las dos).
   - Si `now - fly.spawnedAt > FLY_LIFETIME_MS`, eliminar la mosca sin puntuar y reprogramar
     `nextFlyAt`.
   - En `tryHop`, si el sapo aterriza en la celda de la mosca activa, sumar `FLY_POINTS` vía
     `onScoreChange` (delta adicional sobre la puntuación ya calculada por el spec 01), eliminar
     la mosca y reprogramar `nextFlyAt`.
   - En `drawLanes` (o un `drawFly` dedicado), dibujar el punto amarillo con glow sobre la fila
     segura correspondiente.
   Verificación: las moscas aparecen con intervalo variable solo sobre filas seguras, otorgan
   200 puntos al atraparlas y desaparecen solas si se ignoran.

4. **Verificación final.** `npm run build` completa sin errores de TypeScript. Una partida
   completa de varias rondas en `/jugar/frogger` muestra los tres comportamientos sin romper la
   mecánica base del spec 01 (colisiones de carretera, arrastre de troncos, relleno de
   nenúfares, progresión de nivel).

---

## Criterios de aceptación

- [ ] Las tortugas de las filas 2 y 4 alternan entre flotar y sumergirse en un ciclo continuo
      durante toda la partida.
- [ ] Antes de sumergirse, las tortugas parpadean durante `TURTLE_DIVE_WARNING_MS`.
- [ ] El sapo se ahoga si está sobre una tortuga sumergida, igual que si no hubiera nada.
- [ ] El sapo no se ahoga por estar sobre una tortuga que flota, incluida durante el parpadeo de
      aviso.
- [ ] A partir del nivel 3, un hueco de nenúfar vacío muestra periódicamente una serpiente.
- [ ] La serpiente nunca ocupa un hueco ya relleno por el jugador.
- [ ] Aterrizar sobre un hueco con serpiente resta una vida, igual que aterrizar en agua.
- [ ] La serpiente se traslada a otro hueco vacío al azar tras `SNAKE_OCCUPY_MS`, o desaparece
      temporalmente si no queda ningún hueco libre.
- [ ] Al completar una ronda (rellenar los 5 huecos), la serpiente desaparece y el ciclo
      recomienza en la siguiente ronda.
- [ ] En niveles 1 y 2 no aparece ninguna serpiente.
- [ ] Las moscas aparecen solo sobre la isla central (fila 6) o el arcén (fila 12), nunca sobre
      río, carretera o meta.
- [ ] El intervalo entre apariciones de mosca varía entre `FLY_MIN_INTERVAL_MS` y
      `FLY_MAX_INTERVAL_MS`.
- [ ] Atrapar una mosca suma 200 puntos al HUD de puntuación en tiempo real.
- [ ] Una mosca no atrapada desaparece sola tras `FLY_LIFETIME_MS` sin sumar puntos.
- [ ] Nunca hay más de una mosca activa a la vez.
- [ ] Ninguno de los tres comportamientos añade props nuevas a `FroggerGameProps` ni cambia el
      HUD React (sigue mostrando solo JUGADOR, PUNTUACIÓN, VIDAS y NIVEL).
- [ ] La mecánica base del spec 01 (colisiones de carretera, arrastre de troncos y tortugas que
      flotan, relleno de nenúfares libres, progresión de nivel) sigue funcionando sin
      regresiones.
- [ ] `npm run build` completa sin errores de TypeScript.
- [ ] Ninguna ruta existente devuelve 500.

---

## Decisiones

- **Sí: sin props nuevas.** Razón: los tres comportamientos son variaciones internas del motor
  que se notifican con los callbacks que ya existen (`onScoreChange` para las moscas, el resto
  reutiliza el flujo de muerte del spec 01); mantener la interfaz estable evita tocar
  `frogger-player.tsx`.

- **Sí: tortugas que se sumergen en las filas 2 y 4, troncos siempre seguros.** Razón: si todo
  el río fuera inseguro por temporadas la partida sería punitiva en exceso; alternar solo las
  filas de tortugas conserva una ruta segura predecible en los troncos.

- **Sí: aviso de parpadeo antes de sumergirse.** Razón: sin aviso, la sumersión sería un
  castigo por mala suerte más que por mal cálculo; el parpadeo da al jugador información para
  reaccionar, igual que el original de arcade.

- **Sí: serpiente a partir del nivel 3, no desde el nivel 1.** Razón: las primeras rondas ya
  presentan la mecánica base (tráfico, río, nenúfares); introducir un peligro extra en la meta
  desde el principio penalizaría el aprendizaje.

- **No: la serpiente puede ocupar un hueco ya relleno.** Razón: quitaría progreso ya ganado sin
  que el jugador pueda hacer nada al respecto, lo que se siente injusto.

- **Sí: moscas solo en filas seguras (isla central y arcén).** Razón: son un bono de riesgo bajo
  que premia la exploración lateral sin obligar a cruzar tráfico o río fuera de turno.

- **Sí: 200 puntos por mosca, fijo.** Razón: es mayor que un nenúfar (50) pero menor que el bono
  de ronda (200 es igual, intencionadamente competitivo con completar objetivos, sin eclipsar
  la recompensa principal del juego).

- **No: vidas extra o power-ups permanentes.** Razón: mantener la partida centrada en esquivar y
  cronometrar saltos, sin introducir inventario ni estados persistentes entre vidas.

- **No: sonidos para estos eventos.** Razón: el spec 01 tampoco los tiene; se deja para un spec
  de audio futuro que cubra todo el juego a la vez.

- **No: temporizador ni modo contrarreloj.** Razón: mezclar presión de tiempo global con los
  peligros temáticos de este spec complicaría el ajuste de dificultad; queda como posible spec
  futuro independiente.

- **No: dificultad configurable por el jugador.** Razón: los valores fijos (ciclos de tortuga,
  nivel mínimo de la serpiente, intervalo de moscas) ya están calibrados en este spec; exponerlos
  como opción añadiría UI sin que el usuario lo haya pedido.
