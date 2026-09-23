# SPEC 03 — Bloques duros, aceleración de la bola y combo de puntuación

> **Estado:** Implementado
> **Depende de:** SPEC 01
> **Fecha:** 2026-09-21
> **Objetivo:** Dar curva de dificultad y profundidad de puntuación al juego con una fila de bloques grises de dos golpes, una bola que acelera según avanza la partida y un multiplicador de combo que premia romper varios bloques sin tocar la pala.

## Por qué existe esta spec

Hoy la partida es plana: todos los bloques caen de un golpe, la bola va a 400 px/s del primer al último segundo, y cada bloque vale 10 puntos hagas lo que hagas. No hay nada que el jugador pueda hacer mejor o peor más allá de no fallar.

Las tres mecánicas de esta spec atacan eso por separado y son acumulativas: los grises dan un objetivo que cuesta, la aceleración hace que el final sea más tenso que el principio, y el combo recompensa colar la bola por encima del muro.

Esta spec es **independiente de la SPEC 02**. Toca la física y la puntuación; la 02 toca solo el dibujado. Se pueden implementar en cualquier orden.

## Alcance

**Entra:**

- Séptima fila de bloques grises encima de  las seis de color: el muro pasa de 6×12 = 72 a 7×12 = 84 bloques.
- Los bloques grises aguantan 2 impactos; los de color siguen cayendo de uno.
- Un gris dañado se dibuja con su propio sprite aclarado: se vuelve a pintar encima de sí mismo en modo `lighter` con alpha `GRAY_DAMAGED_LIGHTEN`.
- Un gris destruido vale 20 puntos base; los de color siguen valiendo 10. Los puntos se suman solo al destruirlo del todo.
- Aceleración progresiva: +4 % de velocidad cada 8 bloques destruidos, con tope de 1,6× la velocidad base.
- `MAX_DT` baja de 1/30 a 1/45 para que la bola acelerada no atraviese bloques.
- La velocidad acumulada **no** se pierde al perder una vida; solo vuelve a la base al reiniciar la partida.
- Combo: el bloque número N de la cadena vale su puntuación base × N, con tope ×8.
- La cadena se resetea al rebotar en la pala y al reiniciar la partida.
- El HUD muestra `×N` junto a los puntos solo cuando el multiplicador es ×2 o más.

**Fuera de alcance (para futuras specs):**

- Spin de la pala (que el movimiento de la pala añada `vx` a la bola).
- Reset de la velocidad al perder una vida.
- Bloques de 3 o más golpes.
- Power-ups que caen de los bloques rotos.
- Varios niveles o niveles definidos con matriz.
- Récord en localStorage.
- Cualquier efecto visual nuevo (partículas, sacudida, textos flotantes): eso es la SPEC 02.
- Sonido distinto para el golpe que no destruye un bloque gris.

## Modelo de datos

```js
// Sustituye a BRICK_ROWS_COLORS y a BRICK_POINTS (game.js)
const BRICK_ROWS = [
  { color: 'gray',    hits: 2, points: 20 },
  { color: 'red',     hits: 1, points: 10 },
  { color: 'yellow',  hits: 1, points: 10 },
  { color: 'cyan',    hits: 1, points: 10 },
  { color: 'magenta', hits: 1, points: 10 },
  { color: 'hotpink', hits: 1, points: 10 },
  { color: 'green',   hits: 1, points: 10 },
];

const GRAY_DAMAGED_LIGHTEN = 0.45;  // cuánto se aclara el gris tras el primer golpe

// Aceleración
const BALL_SPEED_STEP = 0.04;       // +4 % por escalón
const BALL_SPEED_EVERY = 8;         // bloques destruidos por escalón
const BALL_SPEED_MAX_MULT = 1.6;    // tope: 400 → 640 px/s

// Combo
const COMBO_MAX = 8;                // tope del multiplicador

// Cambia de valor
const MAX_DT = 1 / 45;              // antes 1/30; protege contra el tunneling

// Estructura de cada bloque en state.bricks
// { x, y, color, hits, points, alive, damaged }
//   color   — sprite del bloque; no cambia en toda la partida
//   damaged — true cuando un gris ha recibido un golpe: se dibuja más claro
//   hits   — impactos que le quedan; alive pasa a false cuando llega a 0
//   points — puntuación base, antes de aplicar el multiplicador de combo

// Estado nuevo dentro de `state`
const state = {
  // ...lo que ya existe en SPEC 01...
  bricksBroken: 0,   // bloques destruidos en la partida; alimenta la aceleración
  speedMult: 1,      // multiplicador de velocidad actual, entre 1 y BALL_SPEED_MAX_MULT
  combo: 0,          // bloques de la cadena actual; el multiplicador es min(combo, COMBO_MAX)
};
```

Convenciones:

- `hits` cuenta impactos restantes, no recibidos. Un bloque de color nace con `hits: 1`.
- `bricksBroken` cuenta bloques **destruidos**, no impactos. Golpear un gris sin romperlo no lo incrementa.
- La velocidad efectiva de la bola es `BALL_SPEED * state.speedMult`. Al cambiar `speedMult` se renormaliza el vector `(vx, vy)` para conservar la dirección.
- El multiplicador que se aplica a un bloque es el valor de `combo` **después** de incrementarlo: el primer bloque de una cadena vale ×1.

## Plan de implementación

1. **Muro de 7 filas con dureza.** Sustituir `BRICK_ROWS_COLORS` por `BRICK_ROWS` y actualizar `createBricks()` para que cada bloque nazca con `color`, `hits`, `points` y `alive`. Prueba manual: se ven 7 filas, la de arriba gris, y el juego funciona igual que antes salvo que los grises no se rompen al primer golpe (todavía no cambian de aspecto).
2. **Daño visible del gris.** En la colisión, decrementar `hits`; si queda por encima de 0, asignar `brick.damaged = true` y salir sin sumar puntos ni marcar `alive = false`. En `drawField()`, un bloque `damaged` se pinta dos veces: la segunda con `globalCompositeOperation = 'lighter'` y `globalAlpha = GRAY_DAMAGED_LIGHTEN`, restaurando después ambos valores. Prueba manual: el primer golpe deja el bloque gris más claro que los intactos y el segundo lo destruye sumando 20 puntos.
3. **Separar golpe de destrucción.** Extraer `hitBrick(brick, now)` de `breakBrick()`: `hitBrick` gestiona el daño y llama a `breakBrick` solo cuando `hits` llega a 0. `breakBrick` incrementa `state.bricksBroken`, suma puntos, encola la explosión, suena y comprueba la victoria. Prueba manual: los 84 bloques destruidos llevan a la pantalla de Victoria.
4. **Aceleración de la bola.** Bajar `MAX_DT` a 1/45. En `breakBrick()`, recalcular `speedMult = Math.min(1 + Math.floor(bricksBroken / BALL_SPEED_EVERY) * BALL_SPEED_STEP, BALL_SPEED_MAX_MULT)` y, si ha cambiado, renormalizar `(vx, vy)` a `BALL_SPEED * speedMult`. `launchBall()` usa también la velocidad efectiva. Prueba manual: tras 8 bloques la bola va perceptiblemente más rápida, y tras unos 96 deja de acelerar.
5. **Velocidad persistente entre vidas.** `loseLife()` no toca `speedMult`; `resetGame()` lo deja a 1 junto con `bricksBroken`. Prueba manual: perder una vida con la bola rápida la relanza igual de rápida, y pulsar Enter en Game Over la devuelve a 400 px/s.
6. **Combo.** Incrementar `state.combo` en `breakBrick()` y sumar `brick.points * Math.min(state.combo, COMBO_MAX)`. Ponerlo a 0 en `collidePaddle()` y en `resetGame()`. Prueba manual: tres bloques seguidos sin tocar la pala suman 10, 20 y 30; después de rebotar en la pala el siguiente vuelve a sumar 10.
7. **Combo en el HUD.** En `drawHud()`, dibujar `×N` a la derecha del marcador de puntos solo si `Math.min(state.combo, COMBO_MAX) >= 2`. Prueba manual: el indicador aparece al segundo bloque de una cadena y desaparece al rebotar en la pala.

## Criterios de aceptación

- [ ] El muro tiene 7 filas × 12 columnas: una gris arriba y debajo red, yellow, cyan, magenta, hotpink y green.
- [ ] Un bloque gris no desaparece al primer impacto: se queda en pantalla, gris pero más claro que los que siguen intactos.
- [ ] El primer impacto sobre un gris no suma ningún punto.
- [ ] El segundo impacto sobre un gris lo destruye y suma 20 puntos base.
- [ ] Un bloque de color sigue destruyéndose al primer impacto y sumando 10 puntos base.
- [ ] La bola rebota igual contra un gris dañado que contra cualquier otro bloque.
- [ ] Destruir los 84 bloques lleva a la pantalla de Victoria.
- [ ] Tras destruir 8 bloques la bola se mueve más rápido que al empezar.
- [ ] La velocidad deja de subir una vez alcanzado 1,6× (640 px/s) y no crece más por muchos bloques que se rompan.
- [ ] Perder una vida relanza la bola a la velocidad acumulada, no a 400 px/s.
- [ ] Pulsar Enter en Game Over o en Victoria devuelve la bola a 400 px/s y el contador de bloques destruidos a 0.
- [ ] Con la bola a velocidad máxima y sin cambiar de pestaña, la bola no atraviesa ningún bloque.
- [ ] Romper tres bloques seguidos sin tocar la pala suma 10, 20 y 30 puntos, en ese orden.
- [ ] Rebotar en la pala hace que el siguiente bloque vuelva a valer su puntuación base.
- [ ] Una cadena de más de 8 bloques no supera el multiplicador ×8.
- [ ] El indicador `×N` aparece en el HUD a partir del segundo bloque de una cadena y desaparece al rebotar en la pala.
- [ ] Con multiplicador ×1 el HUD no muestra ningún indicador de combo.
- [ ] Un gris destruido como cuarto bloque de una cadena suma 80 puntos (20 × 4).
- [ ] La consola no muestra errores durante una partida completa.

## Decisiones

- **Sí:** una séptima fila gris encima de las seis existentes. No toca las filas de color y la dificultad sube de forma predecible.
- **No:** convertir la fila roja en gris. Habría mantenido 72 bloques pero cambia el muro que ya estaba validado en la SPEC 01.
- **Sí:** 2 golpes para el gris. Con 3 haría falta un tercer estado visual y la partida se alargaría demasiado.
- **Sí:** el gris dañado se dibuja con su propio sprite aclarado en modo `lighter`. Decidido el 2026-09-21, sustituye al sprite rojo de la versión original de esta spec: el rojo se confundía con la fila roja y no se leía como "gris tocado".
- **No:** un sprite nuevo de gris claro en el spritesheet. Crear assets queda fuera del proyecto y el aclarado sale del mismo recorte.
- **No:** dibujar el gris dañado con `ctx.globalAlpha` reducido. Se leería como medio transparente sobre el fondo negro, no como un gris más claro.
- **Sí:** el bloque conserva `color: 'gray'` y lleva un flag `damaged`. Así la explosión y las partículas del remate salen grises, que es el color real del bloque.
- **Sí:** los 20 puntos del gris se dan enteros al destruirlo. Da una recompensa clara al remate.
- **No:** 10 puntos por cada impacto. Habría hecho que el marcador reaccionara a golpes que no destruyen nada y complica la lectura del combo.
- **Sí:** la aceleración se ata a bloques destruidos, no a rebotes en la pala ni al tiempo. Es predecible y va ligada al progreso real.
- **No:** acelerar por tiempo de partida. Castiga jugar con calma independientemente de lo bien que lo hagas.
- **Sí:** tope de 1,6×. Por encima, la bola se vuelve más difícil de seguir que de devolver.
- **Sí:** `MAX_DT` baja a 1/45. A 640 px/s con el tope antiguo de 1/30 la bola avanzaría 21,3 px por frame, más de la mitad del alto de un bloque, y podría atravesarlo.
- **Sí:** la velocidad se conserva al perder una vida. Decisión explícita: el castigo por morir ya es perder la vida, y reiniciar la velocidad haría que el final de partida fuese más fácil que el medio.
- **Sí:** combo clásico que se resetea al tocar la pala. Premia colar la bola por encima del muro, que es la jugada habilidosa del género.
- **No:** bonus progresivo que solo se resetea al reiniciar. Se consideró y se descartó: sin nada que el jugador pueda hacer mal, deja de ser una mecánica.
- **Sí:** tope de combo en ×8. Sin tope, una sola cadena larga decide la partida entera.
- **Sí:** el primer bloque de la cadena vale ×1. Así la puntuación base nunca empeora respecto a la SPEC 01.
- **Sí:** el indicador de combo solo se muestra a partir de ×2. Un `×1` permanente es ruido.
- **No:** el combo no se resetea explícitamente al perder una vida. En la práctica la bola casi siempre ha tocado la pala antes de caer, así que la regla extra no aportaría nada observable.
- **No:** spin de la pala. Toca la parte más delicada de la física y merece su propia spec.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| La bola acelerada atraviesa bloques cuando `dt` se dispara. | `MAX_DT = 1/45` limita el avance a 14,2 px por frame a velocidad máxima, menos de los 16 px de media altura de un bloque. El margen es de solo 1,8 px, así que si `BALL_SPEED` vuelve a subir habrá que bajar `MAX_DT` o el tope. Hay un criterio de aceptación que lo comprueba. |
| Renormalizar `(vx, vy)` con la bola parada (`vx = vy = 0` en estado `serve`) produce `NaN`. | Solo renormalizar si el módulo actual es mayor que 0; en `serve` la velocidad la fija `launchBall()`. |
| `state.combo` se queda alto tras perder una vida y el jugador recibe puntos inflados. | El rebote en la pala lo resetea, y la bola solo puede caer después de haber pasado por la pala o directamente desde el saque, donde el combo es 0. |
| Cambiar la estructura de los bloques rompe el `state.bricks.every(b => !b.alive)` de la victoria. | El campo `alive` se mantiene con el mismo significado; solo se añade `hits` al lado. |
| La fila extra acerca el muro a la pala y reduce el margen de reacción. | El muro empieza en `BRICKS_OFFSET_Y = 100` y con 7 filas llega a y=324, muy por encima de la pala. |
| Otras specs asumen `BRICK_ROWS_COLORS` o `BRICK_POINTS`, que desaparecen. | Solo `createBricks()` y `breakBrick()` los usan hoy. La SPEC 02 no los toca. |

## Lo que **no** entra en esta spec

- Spin de la pala.
- Reset de velocidad al perder una vida.
- Bloques de 3 o más golpes.
- Efectos visuales nuevos: partículas, sacudida de pantalla, estela y textos flotantes son la SPEC 02.
- Power-ups.
- Varios niveles.
- Récord en localStorage.
- Usuarios o control de quién puede jugar.
- Versión móvil o canvas responsive.

Cada una de esas cosas, si llega a hacerse, va en su propia spec.
