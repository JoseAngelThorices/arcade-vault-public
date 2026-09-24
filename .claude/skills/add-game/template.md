# Template de spec para un nuevo juego en Arcade Vault

Este archivo es el molde que el skill `/add-game` usa al generar specs. Cada sección muestra su propósito y un ejemplo con placeholders. **No copiar verbatim** — los placeholders `{{VARIABLE}}` se reemplazan con los valores reales del juego.

Placeholders disponibles:

| Placeholder               | Descripción                                            |
| ------------------------- | ------------------------------------------------------ |
| `{{NN}}`                  | Número secuencial del spec (ej. `07`)                  |
| `{{ID}}`                  | Slug del juego, kebab-case (ej. `tetris`)              |
| `{{TITLE}}`               | Nombre del juego en mayúsculas (ej. `TETRIS`)          |
| `{{COMPONENT_NAME}}`      | PascalCase del componente React (ej. `TetrisGame`); archivo `components/games/{{ID}}-game.tsx` |
| `{{CAT}}`                 | Categoría: `ARCADE`, `PUZZLE` o `SHOOTER`              |
| `{{COVER}}`               | Clase CSS de cover (ej. `cover-rocas`)                 |
| `{{COLOR}}`               | Color de acento: `cyan`, `magenta`, `yellow` o `green` |
| `{{SHORT}}`               | Descripción corta (≤ 50 caracteres)                    |
| `{{LONG}}`                | Descripción larga (2-3 frases)                         |
| `{{CANVAS_W}}`            | Ancho del canvas en px (ej. `800`)                     |
| `{{CANVAS_H}}`            | Alto del canvas en px (ej. `600`)                      |
| `{{CONTROLS}}`            | Lista de teclas y sus acciones                         |
| `{{GAME_OVER_CONDITION}}` | Condición que termina la partida                       |
| `{{HUD_FIELDS}}`          | Campos expuestos al HUD React (score, lives, level…)   |
| `{{TOP_N}}`               | Tamaño del leaderboard (por defecto `10`)              |
| `{{SOURCE_NOTE}}`         | Nota sobre origen del juego (reference o desde cero)   |

---

## Cabecera

```markdown
# SPEC {{NN}} — Integración del juego {{TITLE}}

> **Estado:** Borrador
> **Depende de:** 06-games-table-leaderboard-supabase
> **Fecha:** YYYY-MM-DD
> **Objetivo:** Integrar {{TITLE}} como juego jugable en Arcade Vault, adaptando su canvas a React y conectando el leaderboard de Supabase.
```

---

## Alcance

```markdown
## Alcance

**Entra:**

- Insertar la fila `{{ID}}` en la tabla `games` de Supabase (seed manual via SQL).
- Crear `components/games/{{ID}}-game.tsx` — componente React que encapsula el canvas
  y el game loop. Acepta props: `paused`, `onScoreChange`, {{HUD_CALLBACKS}}`onGameOver`.
- Crear `app/jugar/{{ID}}/page.tsx` — play-page específica (Server Component): lee el juego
  con `getGame('{{ID}}')` de `lib/supabase/games.ts` y renderiza el reproductor.
- Crear `components/{{ID}}-player.tsx` — reproductor `"use client"`: gestiona el estado
  ({{HUD_FIELDS}}, pausa, game over) y pasa callbacks al componente canvas.
- Wiring del modal de game over: pre-rellenar nombre desde `localStorage.getItem('av_player_name')`;
  al confirmar, guardar nombre en localStorage e insertar score en la tabla `scores` vía cliente browser.
- Botón de pausa de la plataforma pasa el flag `paused` al componente canvas, que congela el game loop.
- Eliminar el overlay "GAME OVER" del canvas — el modal React de la plataforma lo reemplaza.
- El canvas deja de dibujar {{HUD_FIELDS}}; el HUD React de la plataforma es el único que
  muestra esos valores. El canvas solo conserva indicadores sin equivalente en el HUD React
  (ej. cuenta atrás de power-ups), si los hay.

**Fuera de alcance:**

- Crear las tablas `games` o `scores` en Supabase — ya existen (spec 06).
- Supabase Auth — `user_id` se almacena como `null` en todos los scores.
- Cambios de RLS — las políticas abiertas de SPEC 06 (SELECT en `games` y `scores`, INSERT en
  `scores`) ya cubren el juego nuevo; endurecerlas es un spec futuro de seguridad.
- Realtime — el leaderboard no se actualiza en vivo; solo al cargar la página.
- Paginación del leaderboard — se muestran los top {{TOP_N}} fijos.
- Controles táctiles o mobile.
- Actualización automática de `best` y `plays` en la tabla `games` — campos estáticos.
```

---

## Modelo de datos

```markdown
## Modelo de datos

### Seed en Supabase — tabla `games`

Ejecutar en el SQL Editor de Supabase:

\`\`\`sql
INSERT INTO games (id, title, short, long, cat, cover, color)
VALUES (
'{{ID}}', '{{TITLE}}', '{{SHORT}}',
'{{LONG}}',
'{{CAT}}', '{{COVER}}', '{{COLOR}}'
);
\`\`\`

### Props del componente `{{COMPONENT_NAME}}`

\`\`\`ts
interface {{COMPONENT_NAME}}Props {
paused: boolean;
onScoreChange: (score: number) => void;
// Añadir o quitar según {{HUD_FIELDS}}:
onLivesChange: (lives: number) => void;
onLevelChange: (level: number) => void;
onGameOver: (finalScore: number) => void;
}
\`\`\`

No se introducen nuevas tablas ni tipos TypeScript — se reutilizan `GameRow` y `ScoreRow`
de `lib/supabase/types.ts`.
```

---

## Plan de implementación

```markdown
## Plan de implementación

1. **Seed en Supabase** — ejecutar el INSERT de la fila `{{ID}}` en el SQL Editor de Supabase.
   Verificación: la card de {{TITLE}} aparece en `/juegos`.

2. **Crear `components/games/{{ID}}-game.tsx`** — componente `"use client"` que:
   - Renderiza un `<canvas>` de {{CANVAS_W}}×{{CANVAS_H}}.
   - Contiene el game loop completo {{SOURCE_NOTE}}.
   - Recibe prop `paused: boolean` — si es `true`, el loop llama a `draw()` pero no a `update()`.
   - Llama `onScoreChange`, {{HUD_CALLBACKS_LIST}} cada vez que esos valores cambian
     dentro del loop (comparando con el valor anterior antes de disparar el callback).
   - Llama `onGameOver(score)` cuando el juego llega a su condición de fin: {{GAME_OVER_CONDITION}}.
   - El overlay canvas "GAME OVER" se elimina del `draw()`.
   - El HUD del canvas deja de dibujar {{HUD_FIELDS}}; solo conserva indicadores sin
     equivalente en el HUD React, si los hay.
   - Limpia los event listeners de teclado en el `return` del `useEffect`.
     Verificación: el juego arranca en `/jugar/{{ID}}` y es jugable con {{CONTROLS}}.

3. **Crear `app/jugar/{{ID}}/page.tsx` y `components/{{ID}}-player.tsx`**:
   - `page.tsx` es Server Component: `getGame('{{ID}}')`, `notFound()` si no existe,
     `generateMetadata` con el título, y renderiza `<{{COMPONENT_NAME}}Player game={game} />`.
   - `{{ID}}-player.tsx` es `"use client"` e importa `{{COMPONENT_NAME}}` con
     `dynamic(..., { ssr: false })` (solo se admite en Client Components).
   - Estado local: `score`, {{HUD_STATE_VARS}}, `paused`, `over`, `name`, `saveStatus`, `run`.
   - Al abrir el modal de game over, lee el nombre con `readPlayerName()` de `lib/player-name.ts`
     y pre-rellena el campo `name`.
   - Al confirmar, inserta en `scores` con `createClient()` de `lib/supabase/client.ts`:
     `{ game_id: '{{ID}}', player_name: name, score, user_id: null }`. Si Supabase confirma,
     persiste el nombre con `writePlayerName()` y registra la marca con `saveScore()` de `useSession()`.
   - `saveStatus` (`idle` | `saving` | `saved` | `error`) deshabilita el botón mientras guarda y
     después; si falla, muestra error y permite reintentar.
   - Reutiliza el mismo layout visual (HUD React + CRT + modal game over) que
     `app/jugar/asteroids/page.tsx` + `components/asteroids-player.tsx`.
     Verificación: el HUD React muestra los valores en tiempo real; tras una partida el score
     aparece en `/juego/{{ID}}` y en `/salon` al recargar.

4. **Verificación final** — `npm run build` completa sin errores de TypeScript.
   Ninguna ruta existente devuelve 500.
```

---

## Criterios de aceptación

```markdown
## Criterios de aceptación

- [ ] La card de {{TITLE}} aparece en `/juegos`.
- [ ] `/juego/{{ID}}` carga con los datos reales del juego y el leaderboard top {{TOP_N}}.
- [ ] `/jugar/{{ID}}` carga sin errores de SSR ni de TypeScript.
- [ ] El canvas renderiza el juego y es jugable con {{CONTROLS}}.
- [ ] El canvas ya no dibuja {{HUD_FIELDS}}.
- [ ] El HUD React de la plataforma refleja en tiempo real los valores de {{HUD_FIELDS}}.
- [ ] El botón "PAUSA" congela el game loop; "REANUDAR" lo reanuda.
- [ ] Al terminar la partida, aparece el modal React de game over con la puntuación final.
- [ ] El overlay "GAME OVER" del canvas ya no se dibuja (el modal React lo reemplaza).
- [ ] El botón "JUGAR DE NUEVO" reinicia la partida desde cero.
- [ ] Al abrir el modal, el campo de nombre se pre-rellena con `av_player_name` de localStorage si existe.
- [ ] Al confirmar, el score se inserta en Supabase y el nombre se persiste en localStorage.
- [ ] El botón "GUARDAR PUNTUACIÓN" se deshabilita tras el primer envío (sin doble inserción).
- [ ] El score guardado aparece en `/juego/{{ID}}` y en `/salon` al recargar.
- [ ] Cuando no hay scores, el leaderboard muestra "Sé el primero en entrar al salón de la fama".
- [ ] `/salon` muestra un tab para {{TITLE}}.
- [ ] `npm run build` completa sin errores de TypeScript.
- [ ] Ninguna ruta existente devuelve 500.
```

---

## Decisiones

```markdown
## Decisiones

- **Sí: un solo HUD, el de la plataforma** — {{HUD_FIELDS}} solo se muestran en el HUD React;
  el canvas conserva únicamente indicadores sin equivalente fuera. Razón: no se quieren datos
  duplicados sobre la pantalla de juego (mismo criterio que SPEC 05). La plataforma sigue
  recibiendo los valores por callbacks para integraciones futuras.

- **Sí: Callbacks como interfaz de comunicación** — el componente canvas llama a
  `onScoreChange`, {{HUD_CALLBACKS_LIST}}, `onGameOver` cuando el estado cambia.
  Razón: desacoplamiento limpio; el juego no sabe nada de React ni de la plataforma.

- **Sí: `dynamic(..., { ssr: false })`** — el componente canvas se carga solo en cliente.
  Razón: `canvas` y `requestAnimationFrame` no existen en el entorno Node.js de Next.js SSR.

- **Sí: Play-page específica `app/jugar/{{ID}}/page.tsx` + `components/{{ID}}-player.tsx`** — en lugar de modificar la ruta
  genérica `app/jugar/[id]`. Razón: evita condicionales en la ruta genérica; Next.js App Router
  da prioridad a rutas estáticas sobre dinámicas.

- **Sí: Un único spec combinado (juego + leaderboard)** — las tablas `games` y `scores` ya
  existen; solo se añade la fila del juego y el wiring. Separarlos no aportaría valor visible.

- **No: Crear tablas nuevas por juego** — se reutilizan `games` y `scores` del spec 06.
  Razón: el modelo es suficientemente genérico para cualquier juego con score numérico.

- **No: Cambios de RLS en este spec** — se reutilizan las políticas abiertas de SPEC 06
  (SELECT público en `games` y `scores`, INSERT público en `scores`).
  Razón: se endurecen en el spec futuro de seguridad.

- **No: Realtime en leaderboards** — los scores se ven al recargar.
  Razón: la complejidad de subscriptions no aporta valor mientras haya pocos jugadores activos.

- **No: Componente genérico `CanvasGame`** — cada juego tiene su componente propio.
  Razón: YAGNI; generalizar ahora sería abstraer sin caso de uso suficientemente confirmado.
```

---

## Reglas globales del documento generado

- **Nombres concretos.** Si se menciona una función, dar su nombre real. Si se menciona un archivo, dar su ruta relativa completa.
- **Sin TODOs.** Una decisión pendiente se documenta como decisión con `?` y razón de aplazamiento.
- **Sin código ejecutable largo.** El spec describe; el código lo escribe `/spec-impl`. Snippets cortos para ilustrar estructuras de datos son válidos; funciones completas no.
- **Markdown estándar.** Debe renderizar en GitHub sin extensiones.
