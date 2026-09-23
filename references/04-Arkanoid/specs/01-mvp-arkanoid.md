# SPEC 01 — MVP jugable de Arkanoid

> **Estado:** Implementado
> **Depende de:** —
> **Fecha:** 2026-09-16
> **Objetivo:** Un Arkanoid jugable en el navegador con una pala controlada por teclado, una bola y un muro de bloques que se rompen, con vidas, puntuación, pausa, sonidos y explosiones.

## Alcance

**Entra:**

- Aplanar `assets/assets/*` en `assets/` para que funcione la ruta que ya usa `spritesheet.js`.
- `index.html`, `style.css` y `game.js` en la raíz del proyecto, cargados como scripts clásicos (sin módulos ES).
- Canvas fijo de 800×600 con los sprites escalados.
- Muro de 6 filas × 12 columnas de bloques de 64×32, una fila por color.
- Pala de 120×24 controlada solo por teclado (←/→ o A/D).
- Bola de 32×32 que espera pegada a la pala y sale al pulsar Espacio.
- Rebote en la pala con un ángulo que depende del punto de impacto.
- Rebote en las paredes izquierda, derecha y superior.
- Bloques que se rompen de un golpe y suman 10 puntos cada uno.
- 3 vidas, pantalla de Game Over, pantalla de Victoria y reinicio con Enter.
- HUD con puntos y vidas.
- Pausa y reanudación con P o Esc.
- Sonidos `ball-bounce.mp3` (pala y paredes) y `break-sound.mp3` (bloque roto).
- Animación de explosión con `EXPLOSION_FRAMES` al romper un bloque.

**Fuera de alcance (para futuras specs):**

- Control con ratón o táctil.
- Varios niveles o niveles definidos con matriz.
- Bloques grises o bloques de varios golpes.
- Aceleración progresiva de la bola.
- Power-ups.
- Récords o persistencia (localStorage).
- Sistema de usuarios o de "quién puede jugar" (mencionado en el README).
- Adaptación a móvil o canvas responsive.

## Modelo de datos

```js
// Constantes (game.js)
const CANVAS_W = 800;
const CANVAS_H = 600;

const BRICK_W = 64;
const BRICK_H = 32;
const BRICK_COLS = 12;
const BRICK_ROWS_COLORS = [ 'red', 'yellow', 'cyan', 'magenta', 'hotpink', 'green' ];
const BRICKS_OFFSET_X = 16;   // (800 - 12 * 64) / 2
const BRICKS_OFFSET_Y = 80;   // espacio para el HUD
const BRICK_POINTS = 10;

const PADDLE_W = 120;
const PADDLE_H = 24;
const PADDLE_Y = 550;
const PADDLE_SPEED = 480;     // px/s

const BALL_SIZE = 32;
const BALL_SPEED = 360;       // px/s, constante
const MAX_BOUNCE_ANGLE = Math.PI / 3; // 60°

const INITIAL_LIVES = 3;
const MAX_DT = 1 / 30;        // tope de delta time, en segundos

// Estado de la partida
const state = {
  status: 'serve',            // 'serve' | 'playing' | 'paused' | 'gameover' | 'win'
  score: 0,
  lives: INITIAL_LIVES,
  paddle: { x: 340, y: PADDLE_Y, w: PADDLE_W, h: PADDLE_H },
  ball: { x: 0, y: 0, vx: 0, vy: 0, size: BALL_SIZE },
  bricks: [ /* { x, y, color, alive } */ ],
  explosions: [ /* { x, y, color, startTime } */ ],
};

// Entrada
const keys = { left: false, right: false };
```

Convenciones:

- Coordenadas con origen arriba a la izquierda. `x, y` es la esquina superior izquierda de cada entidad.
- Velocidades en px/s, multiplicadas por `dt` (segundos) en cada frame.
- Colisiones AABB (rectángulo contra rectángulo).
- Dibujo mediante `drawSprite(ctx, 'paddle' | 'ball' | 'block_<color>', …)` y `drawFrame(ctx, frame, …)` de `assets/spritesheet.js`.

## Plan de implementación

1. **Aplanar assets.** Mover `assets/assets/spritesheet.js`, `spritesheet-breakout.png` y `sounds/` a `assets/`. Borrar `assets/assets/` junto con los `.DS_Store`. Comprobación: `ls assets/` muestra `spritesheet.js`, `spritesheet-breakout.png` y `sounds/`.
2. **Esqueleto.** Crear `index.html` (canvas `#game` de 800×600, carga `assets/spritesheet.js` y después `game.js`), `style.css` (fondo oscuro y canvas centrado) y `game.js`. `game.js` tiene un bucle con `requestAnimationFrame`, calcula `dt` con el tope `MAX_DT` y arranca dentro de `loadSpritesheet`. Prueba manual: se ve un canvas negro sin errores en consola.
3. **Muro de bloques.** Función `createBricks()` que llena `state.bricks` (6×12) y dibuja los bloques vivos con `drawSprite`. Prueba manual: se ven 6 filas de colores centradas.
4. **Pala.** Listeners de `keydown`/`keyup` para ←/→ y A/D sobre `keys`. La pala se mueve a `PADDLE_SPEED` y queda limitada al canvas. Prueba manual: la pala se mueve y no se sale.
5. **Bola y saque.** En estado `serve` la bola sigue a la pala, centrada encima. Espacio la lanza hacia arriba y pasa a `playing`. Rebota en las paredes izquierda, derecha y superior. Si cae por debajo de `CANVAS_H`, vuelve a `serve` (todavía sin restar vidas). Prueba manual: saque, rebotes en paredes y reaparición al caer.
6. **Rebote en la pala.** Colisión bola–pala solo si `vy > 0`. El offset relativo del impacto, en `[-1, 1]`, da `angle = offset * MAX_BOUNCE_ANGLE`; entonces `vx = BALL_SPEED * sin(angle)` y `vy = -BALL_SPEED * cos(angle)`. Prueba manual: en el centro sale vertical y en los extremos, inclinada.
7. **Colisión con bloques.** Como máximo un bloque por frame. Se marca `alive = false`, se suman `BRICK_POINTS` y la bola rebota invirtiendo el eje de menor solapamiento. Prueba manual: los bloques desaparecen y la bola rebota bien por arriba, abajo y los lados.
8. **Vidas, fin de partida y HUD.** Al caer la bola se resta una vida: con 0 vidas pasa a `gameover` y si no, vuelve a `serve`. Sin bloques vivos pasa a `win`. Enter en `gameover` o `win` reinicia (`score`, `lives`, bloques y estado `serve`). El HUD muestra `PUNTOS: N` a la izquierda y `VIDAS: N` a la derecha, en la franja superior. Además hay textos superpuestos para `serve` ("Pulsa Espacio"), `gameover` y `win` ("Pulsa Enter para reiniciar"). Prueba manual: perder 3 vidas lleva a Game Over y Enter reinicia.
9. **Pausa.** P o Esc alterna entre `playing` y `paused`. En `paused` no se actualiza la física y se muestra "PAUSA". Prueba manual: la bola se congela y se reanuda.
10. **Sonidos.** Cargar `assets/sounds/ball-bounce.mp3` y `assets/sounds/break-sound.mp3` con `Audio`, y reproducir un `cloneNode()` para que los sonidos se puedan solapar. El rebote suena en la pala y las paredes; la rotura, al romper un bloque. Prueba manual: se oyen los sonidos y no hay errores.
11. **Explosiones.** Al romper un bloque se añade `{ x, y, color, startTime }` a `state.explosions`. El frame que se dibuja es `Math.floor((now - startTime) / EXPLOSION_DURATION)` y la explosión se elimina tras el frame 4. Prueba manual: se ve la animación en la posición del bloque roto.
12. **Documentación.** Actualizar las rutas de assets en `CLAUDE.md` (quitar la nota de `assets/assets/`) y añadir cómo se ejecuta el juego.

## Criterios de aceptación

- [x] `assets/assets/` ya no existe y `assets/spritesheet.js` carga el spritesheet sin errores.
- [x] Al servir la carpeta con `python3 -m http.server` y abrir `index.html`, la consola no muestra errores.
- [ ] El canvas mide 800×600 y aparece centrado en la página.
- [x] Se ven 6 filas × 12 columnas de bloques con los colores red, yellow, cyan, magenta, hotpink y green, de arriba abajo.
- [x] ←/→ y A/D mueven la pala, que nunca se sale del canvas.
- [x] Al empezar, la bola está sobre la pala y la sigue hasta que se pulsa Espacio.
- [x] La bola rebota en las paredes izquierda, derecha y superior.
- [x] Si la bola golpea el centro de la pala sale casi vertical, y si golpea un extremo sale con un ángulo claramente inclinado.
- [x] Cada bloque desaparece al primer golpe y suma exactamente 10 puntos al HUD.
- [x] Al caer la bola, el HUD resta una vida y la bola vuelve a esperar sobre la pala.
- [x] Al perder la tercera vida aparece la pantalla de Game Over.
- [x] Al romper los 72 bloques aparece la pantalla de Victoria.
- [x] Pulsar Enter en Game Over o en Victoria reinicia la partida con 0 puntos, 3 vidas y el muro completo.
- [x] P o Esc pausan durante la partida (la bola se congela y aparece "PAUSA"), y al pulsarlos de nuevo se reanuda.
- [x] Rebotar en la pala o en una pared reproduce `ball-bounce.mp3`.
- [x] Romper un bloque reproduce `break-sound.mp3`.
- [x] Al romper un bloque se reproduce la animación de explosión de su color en su posición.
- [x] La velocidad de la bola es la misma a 60 Hz y a 144 Hz, porque el movimiento usa `dt`.

## Decisiones

- **Sí:** aplanar `assets/assets/` en `assets/`. La ruta de `spritesheet.js` funciona sin tocar el archivo.
- **No:** cambiar la ruta dentro de `spritesheet.js`. Obliga a modificar un asset proporcionado.
- **Sí:** un único `game.js` con scripts clásicos. Es el MVP más simple y es coherente con los globales de `spritesheet.js`.
- **No:** módulos ES o varios archivos. Complejidad innecesaria para un MVP.
- **Sí:** canvas de 800×600 con sprites escalados (bloques de 64×32 y bola de 32×32).
- **No:** canvas de 448×400 con sprites nativos, porque se ve demasiado pequeño.
- **Sí:** pala de 120×24. Al 2× exacto (324×28) haría el juego trivial.
- **Sí:** control solo por teclado. El ratón queda fuera de este MVP.
- **Sí:** ángulo de rebote según el punto de impacto, con un máximo de 60°. Da control al jugador.
- **No:** reflexión simple. Sin control no hay juego.
- **Sí:** saque con la bola pegada a la pala y Espacio.
- **No:** saque automático.
- **Sí:** 3 vidas, Game Over, Victoria y reinicio con Enter.
- **Sí:** todos los bloques se rompen de un golpe y dan 10 puntos.
- **No:** dureza por color ni puntos por fila.
- **Sí:** velocidad constante de 360 px/s basada en `dt`, con un tope de `dt` de 1/30 s para evitar que la bola atraviese bloques tras un parón.
- **No:** aceleración progresiva.
- **Sí:** la pausa solo funciona desde `playing`. En `serve`, `gameover` y `win` no hace nada.
- **Sí:** `EXPLOSION_DURATION` (150) se interpreta como milisegundos por frame, así que la animación dura 600 ms en total.
- **Sí:** `cloneNode()` sobre `Audio` para que los sonidos se puedan solapar sin Web Audio API.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Abrir `index.html` con `file://` rompe la carga del spritesheet por CORS del canvas. | Documentar en `CLAUDE.md` que hay que usar `python3 -m http.server`. |
| La bola atraviesa bloques si `dt` es grande (pestaña en segundo plano). | Tope `MAX_DT = 1/30`: 12 px por frame como máximo, menos que la mitad del alto de un bloque (16 px). |
| La bola queda atrapada dentro de un bloque o de la pala tras un rebote. | Recolocar la bola fuera del objeto al resolver la colisión, además de invertir la velocidad. |
| El navegador bloquea el audio por la política de autoplay. | El primer sonido llega después de pulsar Espacio, que ya cuenta como interacción del usuario. Capturar el rechazo de `play()` para que no genere errores. |
| `EXPLOSION_DURATION` pensado como duración total (animación demasiado rápida o lenta). | Está aislado en el cálculo de un solo frame y se ajusta cambiando la fórmula. |

## Lo que **no** entra en esta spec

- Control con ratón o táctil.
- Varios niveles o editor de niveles.
- Bloques grises o de varios golpes.
- Power-ups.
- Récords o persistencia.
- Usuarios o control de quién puede jugar.
- Versión móvil.

Si alguna de estas cosas llega a hacerse, irá en su propia spec.
