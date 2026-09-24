# Arkanoid

Juego de Arkanoid/Breakout hecho con HTML, CSS y JavaScript "vanilla": sin framework, sin bundler y sin dependencias. Todo se dibuja sobre un `<canvas>` de 1000×700 con sprites de un único spritesheet.

## Cómo jugar

El proyecto necesita servirse por HTTP: abrir `index.html` con `file://` rompe la carga del spritesheet, porque la imagen se copia a un canvas.

```bash
python3 -m http.server
```

Después, abre <http://localhost:8000>.

### Controles

| Tecla              | Acción                                     |
| ------------------ | ------------------------------------------ |
| `←` / `→`, `A` / `D` | Mover la pala                              |
| `Espacio`          | Sacar la bola                              |
| `P` / `Escape`     | Pausar y reanudar                          |
| `Enter`            | Reiniciar tras `GAME OVER` o `¡VICTORIA!`  |

## Mecánicas

- **Muro:** 7 filas × 12 columnas. Seis filas de color y una fila gris arriba del todo.
- **Bloques duros:** los grises aguantan 2 impactos. Tras el primero se dibujan más claros; solo puntúan al destruirse.
- **Puntuación:** 10 puntos los bloques de color, 20 los grises.
- **Combo:** romper bloques sin tocar la pala encadena un multiplicador (el bloque N de la cadena vale su base × N, con tope ×8). El rebote en la pala corta la cadena. El HUD muestra `×N` a partir de ×2.
- **Aceleración:** la bola gana un 4 % de velocidad cada 8 bloques destruidos, hasta 1,6× la base. La velocidad acumulada no se pierde al perder una vida, solo al reiniciar la partida.
- **Rebote en la pala:** el ángulo de salida depende del punto de impacto, hasta 60° respecto a la vertical.
- **Vidas:** 3. Se muestran como bolas en el HUD.
- **Efectos:** explosión por sprite al romper un bloque, escombros con gravedad, estela de la bola y puntos flotantes que suben y se desvanecen. Sonidos de rebote y de rotura.

## Estructura del proyecto

```
index.html                 canvas y carga de scripts
style.css                  centrado del canvas y pixelado
game.js                    el juego completo: estado, update, draw y bucle
assets/spritesheet.js      SPRITES, EXPLOSION_FRAMES, loadSpritesheet, drawSprite, drawFrame
assets/spritesheet-breakout.png
assets/sounds/             ball-bounce.mp3, break-sound.mp3
specs/                     las specs del proyecto
.claude/skills/            skills /spec y /spec-impl
```

`index.html` carga `assets/spritesheet.js` y `game.js` como scripts clásicos, en ese orden, y todo comparte el ámbito global. El bucle usa `requestAnimationFrame`; las velocidades van en px/s y se multiplican por `dt`, con un tope `MAX_DT` que evita que la bola atraviese bloques.

## Desarrollo: spec-driven

Cada funcionalidad se define primero en una spec dentro de `specs/`, y solo después se implementa. La spec es el contrato: nada que quede fuera de su alcance entra en esa iteración.

- `/spec <descripción>` diseña la spec haciendo preguntas y la guarda como `specs/NN-slug.md` en estado `Borrador`.
- El paso a `Aprobado` lo hace una persona, nunca el agente.
- `/spec-impl <NN-slug>` implementa una spec aprobada en la rama `spec-NN-slug`, paso a paso.

Las skills viven en `.claude/skills/`, vienen de `Klerith/fernando-skills` y están fijadas en `skills-lock.json`. La estructura que siguen las specs está documentada en `CLAUDE.md`.

### Specs

| Spec                                          | Contenido                                                              | Estado        |
| --------------------------------------------- | ---------------------------------------------------------------------- | ------------- |
| `01-mvp-arkanoid`                             | MVP jugable: pala, bola, muro, vidas, puntuación, pausa, sonidos       | Implementado  |
| `02-efectos-visuales`                         | Geometría del campo y efectos de impacto (estela, escombros, puntos)   | Implementado  |
| `03-bloques-duros-velocidad-y-combo`          | Fila gris de 2 golpes, aceleración progresiva y combo de puntuación    | Implementado  |

## Pendiente

Lo que se ha dejado fuera de las specs hechas hasta ahora y necesitaría su propia spec:

- Control de quién puede jugar (usuarios).
- Power-ups que caen de los bloques.
- Varios niveles o niveles definidos con matriz.
- Récord persistente en `localStorage`.
- Control con ratón o táctil, y versión móvil con canvas responsive.

## Pruebas

No hay tests automáticos ni linter. La verificación es manual, contra los criterios de aceptación de la spec correspondiente.
