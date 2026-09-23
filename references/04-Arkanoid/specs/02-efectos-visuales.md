# SPEC 02 — Geometría coherente y efectos visuales de impacto

> **Estado:** Implementado
> **Depende de:** SPEC 01
> **Fecha:** 2026-09-21
> **Objetivo:** Terminar de cuadrar la geometría del campo de juego y añadir tres efectos visuales al romper un bloque (estela de la bola, partículas de escombros y puntos flotantes).

## Por qué existe esta spec

El juego arrastraba tres incoherencias de geometría heredadas de retoques manuales posteriores a la SPEC 01. El commit `f4a828e` resolvió las dos primeras y quedan dos pendientes:

- ~~`index.html` declaraba `width="1000"` mientras `game.js` usaba `CANVAS_W = 900`~~. Resuelto en `f4a828e`: ambos valen 1000.
- ~~`PADDLE_Y = 550` con `CANVAS_H = 700` dejaba 150 px muertos bajo la pala~~. Resuelto en `f4a828e`: la pala está en 600 y quedan 76 px, que se consideran margen de muerte aceptable.
- **`BRICKS_OFFSET_X = 115`** cuando la fórmula del comentario de esa misma línea, `(1000 - 12 * 64) / 2`, da 116. El muro queda 1 px descentrado: 115 px de margen a la izquierda y 117 a la derecha.
- **El subtítulo "Pulsa Espacio" sigue clavado en `y = 420`** (`game.js:362`), un valor heredado del canvas de 600 de alto. Con el campo actual de 700 queda descolgado de la pala.

Los efectos de esta spec dependen de saber dónde están los bordes reales, así que lo que queda de geometría se arregla primero.

## Alcance

**Entra:**

- `BRICKS_OFFSET_X` pasa de 115 a 116 para que el muro quede centrado.
- El subtítulo de `serve` se posiciona en relación a `PADDLE_Y` en vez de en `y = 420` fijo.
- Estela de la bola: las últimas 8 posiciones dibujadas con alpha decreciente.
- Partículas de escombros: 8 cuadraditos del color del bloque con velocidad inicial y gravedad.
- Texto flotante `+10` que sube y se desvanece sobre el bloque destruido.
- Limpieza de los tres estados nuevos en `resetGame()`.

**Fuera de alcance (para futuras specs):**

- Sacudida de pantalla al destruir un bloque. Entró en la versión original de esta spec, se implementó y se retiró el 2026-09-21 a petición del usuario (ver Decisiones).
- Cambiar `CANVAS_W`, `CANVAS_H` o `PADDLE_Y`: la geometría de 1000×700 con la pala en 600 se da por buena.
- Fuente pixel externa (Press Start 2P) o cualquier dependencia de Google Fonts.
- Fondo con degradado, rejilla o estrellas; el canvas sigue con `background: #000`.
- Flash de color en el bloque golpeado.
- Escalado ("punch") de la pala al rebotar.
- Power-ups que caen de los bloques.
- Varios niveles o niveles definidos con matriz.
- Récord en localStorage.
- Cualquier cambio de física o de puntuación: eso es la SPEC 03.
- Canvas responsive o adaptación a móvil.

## Modelo de datos

```js
// Constante que cambia de valor (game.js)
const BRICKS_OFFSET_X = 116;     // (1000 - 12 * 64) / 2; antes 115

// Constantes nuevas
const TRAIL_LENGTH = 8;          // posiciones guardadas de la bola
const TRAIL_MAX_ALPHA = 0.35;    // alpha de la posición más reciente de la estela

const PARTICLES_PER_BRICK = 8;
const PARTICLE_SIZE = 6;         // px, cuadrado
const PARTICLE_LIFE = 500;       // ms
const PARTICLE_SPEED = 180;      // px/s, módulo de la velocidad inicial
const PARTICLE_GRAVITY = 600;    // px/s²

const FLOAT_TEXT_LIFE = 700;     // ms
const FLOAT_TEXT_RISE = 40;      // px que sube antes de desaparecer

// Color CSS por color de bloque, para dibujar las partículas
const PARTICLE_COLORS = {
  red: '#e2402c',
  yellow: '#e6d43c',
  cyan: '#3cc8e6',
  magenta: '#c83ce6',
  hotpink: '#e63c96',
  green: '#5ce63c',
  gray: '#9e9e9e',
};

// Estado nuevo dentro de `state`
const state = {
  // ...lo que ya existe en SPEC 01...
  trail: [],          // [ { x, y } ], la posición 0 es la más reciente
  particles: [],      // [ { x, y, vx, vy, color, startTime } ]
  floatingTexts: [],  // [ { x, y, text, startTime } ]
};
```

Convenciones:

- Las velocidades de las partículas van en px/s y se multiplican por `dt`, igual que el resto del juego.
- El ciclo de vida de partículas y textos flotantes se calcula con `now - startTime`, igual que `state.explosions`.
- La estela guarda posiciones, no tiempos: se actualiza una vez por frame en estado `playing`.
- El orden de dibujado es: bloques → explosiones → partículas → estela → pala → bola → textos flotantes → HUD → overlay.

## Plan de implementación

1. **Centrar el muro.** `BRICKS_OFFSET_X = 116`. Prueba manual: el muro de 12 columnas queda con el mismo margen a izquierda y derecha.
2. **Centrar el subtítulo.** En `drawOverlay()`, sustituir el `420` fijo por `PADDLE_Y - 60`. Prueba manual: "Pulsa Espacio" aparece justo encima de la pala, tanto al empezar como tras perder una vida.
3. **Estela de la bola.** Añadir `state.trail`. En `updateBall()`, insertar la posición actual al principio del array y recortarlo a `TRAIL_LENGTH`. En `draw()`, dibujar cada posición con `drawSprite(ctx, 'ball', …)` y `ctx.globalAlpha` decreciente desde `TRAIL_MAX_ALPHA` hasta 0. Vaciar el array en `placeBallOnPaddle()`. Prueba manual: la bola deja rastro en movimiento y no lo deja cuando está pegada a la pala.
4. **Partículas de escombros.** Añadir `state.particles` y la función `spawnParticles(brick, now)`, llamada desde `breakBrick()`. Cada partícula sale del centro del bloque con un ángulo aleatorio y módulo `PARTICLE_SPEED`. En `update()`, integrar posición y aplicar `PARTICLE_GRAVITY`, y filtrar las que superen `PARTICLE_LIFE`. En `draw()`, pintarlas con `ctx.fillRect` usando `PARTICLE_COLORS[color]` y alpha decreciente. Prueba manual: al romper un bloque salen 8 cuadraditos de su color que caen y se desvanecen.
5. **Puntos flotantes.** Añadir `state.floatingTexts` y encolar `{ x, y, text: '+10', startTime }` desde `breakBrick()`, centrado en el bloque. En `update()`, filtrar los que superen `FLOAT_TEXT_LIFE`. En `draw()`, pintarlos después de la bola, subiendo hasta `FLOAT_TEXT_RISE` px y con alpha decreciente. Prueba manual: al romper un bloque sube un `+10` que se desvanece.
6. **Limpieza de estado.** `resetGame()` vacía `trail`, `particles` y `floatingTexts`. Prueba manual: pulsar Enter en Game Over con partículas en pantalla deja el campo limpio de inmediato.

## Criterios de aceptación

- [ ] El muro de 12 columnas tiene exactamente el mismo margen a izquierda y derecha (116 px a cada lado).
- [ ] La bola rebota exactamente en el borde derecho visible del canvas, sin franja negra previa.
- [ ] El texto "Pulsa Espacio" aparece justo encima de la pala, no a media pantalla.
- [ ] Con la bola en movimiento se ve una estela de hasta 8 copias que se desvanecen hacia atrás.
- [ ] Con la bola pegada a la pala en estado `serve` no se dibuja ninguna estela.
- [ ] Al romper un bloque salen 8 cuadraditos del color de ese bloque que caen con gravedad.
- [ ] Las partículas desaparecen por completo antes de 1 segundo desde la rotura.
- [ ] Al romper un bloque aparece un `+10` que sube y se desvanece sobre su posición.
- [ ] Romper varios bloques seguidos muestra varios efectos a la vez sin que ninguno cancele al anterior.
- [ ] La animación de explosión de 4 frames de la SPEC 01 sigue viéndose y no ha sido sustituida.
- [ ] Pulsar Enter en Game Over deja la pantalla sin partículas ni textos flotantes pendientes.
- [ ] La consola no muestra errores durante una partida completa.

## Decisiones

- **Sí:** 1000×700 como tamaño definitivo, ya aplicado en `f4a828e`. Da un campo más ancho y evita tocar el HTML.
- **No:** bajar el canvas a 900 o volver a los 800×600 de la SPEC 01. Se descartó por preferir un campo de juego más amplio.
- **Sí:** `PADDLE_Y = 600`, el valor que ya está en el código. Manda el valor probado jugando sobre los 640 que estimé en papel. Deja 76 px bajo la pala.
- **Sí:** corregir `BRICKS_OFFSET_X` a 116. El 115 actual no cuadra con la fórmula del comentario de su propia línea y descentra el muro 1 px.
- **Sí:** el subtítulo se ancla a `PADDLE_Y`. Así no vuelve a descolgarse si el campo cambia de tamaño.
- **Sí:** la estela guarda posiciones por frame, sin tiempos. Es lo más simple y su longitud ya depende de la velocidad.
- **No:** sacudida de pantalla al romper un bloque. Se implementó en su día (3 px durante 80 ms, con el HUD y el overlay fuera del `translate`) y se retiró el 2026-09-21 a petición del usuario. Los otros tres efectos se mantienen.
- **Sí:** partículas dibujadas con `ctx.fillRect` y una tabla `PARTICLE_COLORS`. No hay sprites de escombros en el spritesheet y crear assets queda fuera.
- **No:** un sistema de partículas genérico con emisores configurables. Sobra para un solo caso de uso.
- **Sí:** el texto flotante dice `+10` fijo. La puntuación variable llega con el combo de la SPEC 03, que es independiente.
- **No:** fuente pixel externa. El proyecto no tiene hoy ninguna dependencia de red y no se va a añadir por el HUD.
- **No:** flash del bloque golpeado ni punch de la pala. Se mencionaron y se dejaron fuera para acotar la spec.
- **Sí:** mantener la explosión de sprites de la SPEC 01. Los efectos nuevos se suman a ella, no la sustituyen.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Romper muchos bloques seguidos acumula cientos de partículas y baja los FPS. | 8 partículas por bloque y 500 ms de vida: con la cadencia real de roturas no pasan de unas decenas simultáneas. Se filtran cada frame. |
| `ctx.globalAlpha` se queda a un valor bajo y el resto de la escena se dibuja translúcida. | Restaurar `globalAlpha = 1` al terminar cada bloque de dibujado con alpha. |
| `PARTICLE_COLORS` no cubre algún color de bloque futuro y las partículas salen `undefined`. | La tabla incluye ya `gray`, que hoy no se usa pero entra en la SPEC 03. |
| Esta spec y la SPEC 03 tocan las mismas funciones de `game.js` (`breakBrick`, `draw`, `resetGame`). | Implementarlas en secuencia sobre la misma base, no en ramas paralelas. |

## Lo que **no** entra en esta spec

- Cambiar el tamaño del canvas o la posición de la pala, que se dan por buenos.
- Fuente pixel externa o cualquier dependencia de Google Fonts.
- Fondo con degradado, rejilla o estrellas.
- Sacudida de pantalla: retirada del alcance el 2026-09-21.
- Flash del bloque golpeado y punch de la pala.
- Bloques de varios golpes, aceleración de la bola y combo de puntuación: eso es la SPEC 03.
- Power-ups.
- Varios niveles.
- Récord en localStorage.
- Usuarios o control de quién puede jugar.
- Versión móvil o canvas responsive.

Cada una de esas cosas, si llega a hacerse, va en su propia spec.
