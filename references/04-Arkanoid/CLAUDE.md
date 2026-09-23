# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Proyecto

Juego de Arkanoid/Breakout con HTML, CSS y JavaScript "vanilla" (sin framework ni build). Según el README, también se va a añadir la parte de quién puede jugar, pero todavía no está implementada.

Estado de las specs: SPEC 01 (MVP), SPEC 02 (geometría y efectos visuales) y SPEC 03 (bloques duros, aceleración y combo) están en `Implementado`.

No hay `package.json`, bundler, linter ni tests. Para ejecutarlo, sirve la raíz del proyecto con `python3 -m http.server` y abre `http://localhost:8000`. Con `file://` no funciona, porque el spritesheet se copia a un canvas. Las pruebas son manuales, contra los criterios de aceptación de la spec correspondiente.

## Arquitectura

- `index.html` carga, como scripts clásicos y en este orden, `assets/spritesheet.js` y `game.js`. Todo comparte el ámbito global. El canvas es de 1000×700 (`CANVAS_W`/`CANVAS_H`).
- `game.js` contiene el juego completo: constantes, un objeto `state` con una máquina de estados en `state.status` (`serve` → `playing` ⇄ `paused` → `gameover`/`win`), entrada por teclado, `update(dt, now)` y `draw(now)`.
- El bucle usa `requestAnimationFrame`. Las velocidades van en px/s y se multiplican por `dt`, que tiene un tope `MAX_DT = 1/45` para que la bola acelerada no atraviese bloques. El juego arranca dentro de `loadSpritesheet`.
- Los sprites nativos se dibujan escalados (bloques de 64×32, muro de 7×12 centrado con `BRICKS_OFFSET_X`/`BRICKS_OFFSET_Y`).
- Controles: flechas o `A`/`D` mueven la pala, `Espacio` saca, `P`/`Escape` pausan, `Enter` reinicia en `gameover`/`win`.

### Invariantes que fijan las specs

Estas convenciones vienen de las specs y valen para todo lo que se añada:

- Velocidades en px/s, siempre multiplicadas por `dt`. Origen de coordenadas arriba a la izquierda.
- Los ciclos de vida con duración (explosiones, partículas, textos flotantes) se calculan con `now - startTime`, no con contadores de frames.
- Orden de dibujado en `drawField`: bloques → explosiones → partículas → estela → pala → bola → textos flotantes; después `drawHud()` y `drawOverlay()`.
- Todo bloque de dibujado que toque `ctx.globalAlpha` o `ctx.globalCompositeOperation` los restaura a `1` y `'source-over'` al terminar.
- Cada bloque es `{ x, y, color, hits, points, alive, damaged }`. `hits` son impactos restantes; `alive` es lo que mira la condición de victoria; `damaged` marca el gris ya golpeado.
- La velocidad efectiva de la bola es `BALL_SPEED * state.speedMult`; al cambiar `speedMult` se renormaliza `(vx, vy)` solo si el módulo es mayor que 0.
- `state.bricksBroken` cuenta bloques destruidos (no impactos) y alimenta la aceleración. `state.combo` se resetea al rebotar en la pala y al reiniciar la partida.

## Flujo de trabajo: spec-driven

El desarrollo sigue el método spec-driven con dos skills de proyecto (`.claude/skills/`, instaladas desde `Klerith/fernando-skills` y fijadas en `skills-lock.json`). Solo las invoca el usuario:

- `/spec <descripción>`: diseña una spec haciendo preguntas y la guarda en `specs/NN-slug.md` con estado `Borrador`. No escribe código. La primera vez también crea `specs/.spec-config.yml` (`AutoCreateBranch: true`).
- `/spec-impl <NN-slug>`: implementa una spec solo si su estado significa "Aprobado". Crea la rama `spec-NN-slug` y avanza paso a paso, parando para revisar los diffs.

Las specs son el contrato: no metas funcionalidades que queden fuera del alcance de la spec activa. El cambio de estado a `Aprobado` lo hace el humano, nunca el agente.

### Estructura de una spec

Las specs de este repo están **en español** y usan esta forma. La referencia completa está en `.claude/skills/spec/template.md`; lo de aquí es lo que hay que respetar para que una spec nueva encaje con las existentes.

Cabecera: título `# SPEC NN — Título corto` y metadatos en blockquote, sin tablas:

```markdown
# SPEC 04 — Título corto y descriptivo

> **Estado:** Borrador
> **Depende de:** SPEC 01
> **Fecha:** YYYY-MM-DD
> **Objetivo:** Una sola frase. Si hacen falta dos, la funcionalidad es demasiado grande.
```

Secciones, en este orden y con estos títulos:

1. `## Por qué existe esta spec` — opcional; solo si hay decisiones no obvias. La SPEC 01 no la tiene; la 02 y la 03 sí.
2. `## Alcance` — obligatorio, con los dos subbloques **Entra:** y **Fuera de alcance (para futuras specs):**.
3. `## Modelo de datos` — constantes y estructuras reales en un bloque `js`, seguidas de una lista de "Convenciones". Si no hay datos nuevos, decirlo explícitamente.
4. `## Plan de implementación` — pasos numerados, cada uno dejando el juego ejecutable y siendo commiteable por separado.
5. `## Criterios de aceptación` — checklist `- [ ]` de afirmaciones verificables con sí o no.
6. `## Decisiones` — lista de **Sí:** / **No:**, cada una con su motivo.
7. `## Riesgos` — opcional; tabla de dos columnas `| Riesgo | Mitigación |`.
8. `## Lo que **no** entra en esta spec` — repetición final de lo excluido, cerrando con una frase del tipo "Cada una de esas cosas, si llega a hacerse, va en su propia spec".

Estados válidos, en español: `Borrador`, `En revisión`, `Aprobado`, `Implementado`, `Obsoleto`.

Reglas de redacción: una idea por frase, nombres concretos (`game.js`, `state.combo`, no "el módulo del juego"), sin TODOs, sin funciones completas dentro de la spec (solo fragmentos que ilustren estructuras) y markdown estándar.

### Convenciones de las specs existentes

- Numeración correlativa con dos dígitos y slug en kebab-case: `specs/03-bloques-duros-velocidad-y-combo.md`.
- Cuando dos specs tocan las mismas funciones de `game.js`, se implementan en secuencia sobre la misma base, no en ramas paralelas (así se hizo con la 02 y la 03).
- Lo que se saca del alcance a mitad de camino se anota con fecha en la sección final (ejemplo: la sacudida de pantalla, retirada de la SPEC 02 el 2026-09-21).
- Excluido de forma recurrente y pendiente de spec propia: power-ups, varios niveles, récord en localStorage, usuarios y control de quién puede jugar, y versión móvil o canvas responsive.

## Assets (`assets/`)

- `spritesheet.js` define globales sin módulos ES, así que se carga con un `<script>` clásico:
  - `SPRITES`: `paddle`, `ball` y `blocks.{gray,red,yellow,cyan,magenta,hotpink,green}`, con recortes `{sx, sy, sw, sh}`.
  - `EXPLOSION_FRAMES[color]`: 4 frames por color. `EXPLOSION_DURATION = 150` (ms).
  - `loadSpritesheet(cb)`: carga el PNG una sola vez y encola los callbacks hasta que termina.
  - `drawSprite(ctx, name, x, y, w, h)`: acepta `'paddle'`, `'ball'` o `'block_<color>'`.
  - `drawFrame(ctx, frame, x, y, w, h)`: dibuja un frame suelto, por ejemplo de una explosión.
  - Si la imagen no ha cargado, las dos funciones de dibujo no hacen nada.
- `spritesheet.js` carga la imagen con la ruta relativa `'assets/spritesheet-breakout.png'`, que se resuelve respecto al HTML. Por eso `index.html` debe estar en la raíz.
- `EXPLOSION_DURATION` se interpreta como milisegundos por frame.
- `sounds/`: `ball-bounce.mp3` y `break-sound.mp3`.

## Git

Repositorio propio en esta carpeta (rama principal `main`), con remoto `origin` en https://github.com/JoseAngelThorices/arkanoid (privado). Cada spec se implementa en su rama `spec-NN-slug`. El directorio home del usuario también es un repositorio git, pero este proyecto no depende de él.
