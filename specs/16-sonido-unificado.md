# SPEC 16 — Sonido unificado en los juegos

> **Estado:** Aprobado
> **Depende de:** 05-asteroids-game · 07-tetris-game · 08-arkanoid-game · 09-snake-game · 10-mobile-touch-controls · 12-frogger-game
> **Fecha:** 2026-11-09
> **Objetivo:** Dar efectos de sonido sintetizados a los cinco juegos con un módulo
> común `lib/audio.ts` y un botón de silencio que se recuerda entre visitas.

---

## Punto de partida (verificado el 2026-11-09)

| Juego | Sonido hoy |
|---|---|
| Asteroids, Tetris, Snake, Frogger | Ninguno. |
| Arkanoid | Dos MP3 (`public/games/arkanoid/ball-bounce.mp3`, `break-sound.mp3`) con `new Audio()` en el motor (`components/games/arkanoid-game.tsx:299-306`). No se pueden silenciar. |

Todos los reproductores reciben del motor callbacks de estado:

| Reproductor | Callbacks |
|---|---|
| `asteroids-player.tsx` | `onScoreChange`, `onLivesChange`, `onLevelChange`, `onPauseToggle`, `onGameOver` |
| `tetris-player.tsx` | `onScoreChange`, `onLinesChange`, `onLevelChange`, `onPauseToggle`, `onGameOver` |
| `arkanoid-player.tsx` | `onScoreChange`, `onLivesChange`, `onComboChange`, `onPauseToggle`, `onGameOver` |
| `snake-player.tsx` | `onScoreChange`, `onLengthChange`, `onLevelChange`, `onPauseToggle`, `onGameOver` |
| `frogger-player.tsx` | `onScoreChange`, `onLivesChange`, `onLevelChange`, `onPauseToggle`, `onGameOver` |

---

## Alcance

**Entra:**

- `lib/audio.ts` (nuevo):
  - Un `AudioContext` compartido, creado en el primer gesto del usuario.
  - Efectos sintetizados con osciladores, sin ficheros nuevos.
  - Reproducción de muestras (los MP3 de Arkanoid).
  - Volumen maestro y silencio global.
- `lib/use-sound.ts` (nuevo): hooks de React para el estado de silencio y para
  disparar efectos cuando sube un contador.
- `components/sound-toggle.tsx` (nuevo): botón SONIDO ON / OFF.
- Los cinco reproductores `components/<id>-player.tsx`:
  - Disparan efectos desde los callbacks que ya reciben.
  - Muestran el botón de silencio en el HUD (escritorio) y bajo el gamepad (móvil).
  - Atajo de teclado `M` para silenciar.
- `components/games/arkanoid-game.tsx`: sus dos MP3 pasan por `lib/audio.ts`, así que
  respetan el silencio y el volumen.
- Motores de Asteroids, Tetris y Frogger (ampliación, ver `Decisiones`): llaman a
  `playSfx` en sus propios eventos (disparo, explosiones, motor del cohete, mover,
  girar, caídas, saltos, chapuzones, atropellos…).
- `app/globals.css`: estilos del botón.
- `CLAUDE.md`: el patrón de sonido para juegos futuros.

**Fuera:**

- Música de fondo.
- Control de volumen con deslizador (solo hay encendido y apagado).
- Sonidos propios en los motores de Snake y Arkanoid más allá de los actuales (girar
  la serpiente, rebote en la pala con efecto sintetizado…).
- Ficheros de audio nuevos.
- Sonido en páginas que no son juegos (navegación, botones del menú).
- Un agente `@sound-designer`: se decide cuando haya un juego nuevo que lo necesite.

---

## Modelo de datos

### Efectos (`lib/audio.ts`)

```ts
export type Sfx =
  | "score"     // sube la puntuación
  | "eat"       // Snake: crece
  | "line"      // Tetris: líneas completadas
  | "hit"       // se pierde una vida
  | "levelup"   // sube el nivel
  | "pause"     // pausa o reanuda
  | "gameover"; // fin de partida
```

Cada efecto es una receta de oscilador: forma de onda, frecuencias, duración y
envolvente. Ninguna pasa de 700 ms.

API pública:

| Función | Qué hace |
|---|---|
| `playSfx(sfx: Sfx)` | Suena el efecto. Sin efecto si está silenciado o el contexto no existe. Un mismo efecto no se repite en menos de 60 ms. |
| `playSample(url: string)` | Suena un fichero de audio (se descarga y se guarda en caché la primera vez). Respeta el silencio. |
| `unlockAudio()` | Crea o reanuda el `AudioContext`. Se llama desde el primer `keydown` o `pointerdown`. |
| `isMuted()` / `setMuted(muted)` | Lee y cambia el silencio global. |

### Silencio persistente

- Clave de `localStorage`: `av_muted`, con valor `"1"` (silenciado) o ausente (con sonido).
- Por defecto hay sonido.
- Se lee con `useSyncExternalStore`, como `av_scores`. En el servidor y durante la
  hidratación vale "con sonido", así que no hay desajuste.
- Si `localStorage` está bloqueado, el silencio funciona pero no se recuerda.

### Volumen

Volumen maestro fijo de `0.35` en un `GainNode` común.

### Eventos por juego

Cada reproductor dispara efectos al **subir** un contador respecto al valor anterior.
Las bajadas (reinicio a 0) no suenan.

| Evento | Asteroids | Tetris | Arkanoid | Snake | Frogger |
|---|---|---|---|---|---|
| Sube la puntuación | `score` | — | — (ya suena `break`) | — (suena `eat`) | `score` |
| Sube líneas / longitud | — | `line` | — | `eat` | — |
| Baja una vida | `hit` | — | `hit` | — | `hit` |
| Sube el nivel | `levelup` | `levelup` | — | `levelup` | `levelup` |
| Pausa / reanudar | `pause` | `pause` | `pause` | `pause` | `pause` |
| Fin de partida | `gameover` | `gameover` | `gameover` | `gameover` | `gameover` |

Tetris no tiene sonido de puntuación porque la bajada rápida suma puntos en cada fila
y sería ruido. Arkanoid ya tiene sus MP3 de rebote y rotura.

> **Actualizado en la implementación:** en Asteroids, Tetris y Frogger la tabla
> anterior queda solo con `levelup`, `pause` y `gameover` en el reproductor. Sus
> puntos, vidas y líneas los suena el motor con efectos propios (tabla siguiente).

### Efectos de los motores (ampliación)

| Juego | Evento | Efecto |
|---|---|---|
| Asteroids | Disparo | `laser` |
| Asteroids | Roca grande / mediana / pequeña destruida | `explodeL` / `explodeM` / `explodeS` |
| Asteroids | Nave destruida | `shipExplode` |
| Asteroids | El escudo absorbe un choque | `shield` |
| Asteroids | Recoger power-up | `powerup` |
| Asteroids | Acelerar (mientras se mantiene ↑) | bucle `thrust` (ruido grave con temblor) |
| Tetris | Mover a un lado | `move` (o `bump` contra el borde) |
| Tetris | Girar | `rotate` (o `bump` si no cabe) |
| Tetris | Bajada suave | `soft` por fila |
| Tetris | Caída rápida | `harddrop` |
| Tetris | Encajar sin línea | `lock` |
| Tetris | 1–3 líneas / 4 líneas | `line` / `tetris` |
| Frogger | Salto | `hop` |
| Frogger | Ahogarse o caer al agua | `splash`: "plop", chapoteo, salpicadura y tres burbujas que suben |
| Frogger | Atropello | `squash`: choque (golpe seco, chapa metálica y cristales) |
| Frogger | Llegar a un nenúfar | `home` |

Los efectos de explosión, golpe y agua usan ruido blanco filtrado (`BiquadFilter`
con barrido), además de osciladores. `setLoop(loop, on)` enciende y apaga sonidos
continuos; es idempotente y se llama en cada frame.

---

## Plan de implementación

1. **Motor de audio.** `lib/audio.ts` con el contexto compartido, las 7 recetas,
   `playSfx`, `playSample`, `unlockAudio` y el silencio. Sin uso todavía.
2. **Hooks y botón.**
   - `lib/use-sound.ts`:
     - `useMuted()` devuelve `[muted, toggle]` con `useSyncExternalStore`.
     - `useRiseSound(sfx)` devuelve una función que recibe el valor nuevo y suena si sube.
     - Registra el desbloqueo en el primer gesto y el atajo `M`.
   - `components/sound-toggle.tsx`.
   - Estilos en `app/globals.css`.
3. **Snake** como juego piloto: efectos de la tabla, botón en el HUD y bajo el gamepad.
   Prueba manual: comer suena, perder suena, `M` silencia, recargar conserva el silencio.
4. **Asteroids, Tetris y Frogger**: lo mismo que en Snake.
5. **Arkanoid**:
   - El motor cambia `new Audio()` por `playSample()`.
   - El reproductor añade `hit`, `pause`, `gameover` y el botón.
6. **Documentación.** `CLAUDE.md`: sección del patrón de sonido para juegos nuevos.

---

## Criterios de aceptación

- [ ] Los cinco juegos suenan en los eventos de la tabla y no suenan en los marcados con "—".
- [ ] Reiniciar la partida (puntuación a 0) no dispara ningún sonido.
- [ ] El primer sonido funciona tras la primera tecla o toque, sin aviso de autoplay
      bloqueado en la consola.
- [ ] El botón SONIDO alterna entre ON y OFF y silencia todo, incluidos los MP3 de Arkanoid.
- [ ] La tecla `M` alterna el silencio en los cinco juegos.
- [ ] El silencio se conserva al recargar y al cambiar de juego.
- [ ] En móvil, el botón de silencio está visible bajo el gamepad.
- [ ] Con `localStorage` bloqueado, el silencio funciona durante la visita sin errores.
- [ ] No hay desajustes de hidratación en la consola al cargar un reproductor.
- [ ] Ningún efecto se reproduce más de una vez en 60 ms.
- [ ] Lint, tipos y build sin errores.

---

## Decisiones

- **Sí: efectos sintetizados con WebAudio.** No añaden peso, no tienen licencia que
  revisar y suenan "chiptune", acorde al estilo arcade.
- **No: ficheros de audio nuevos.** Habría que buscarlos, licenciarlos y servirlos.
- **Sí: disparar desde los callbacks del reproductor.** No hay que tocar cuatro de los
  cinco motores. Es el mismo patrón que `@mobile-porter`, que solo edita el reproductor.
- **No: callbacks nuevos en los motores** para rotar, disparar o saltar. Mucho más
  trabajo por poco valor; queda fuera.
- **Sí: Arkanoid conserva sus MP3** pasándolos por `playSample`, para no perder su sonido actual.
- **Sí: silencio recordado en `localStorage`.** Las skins no se recuerdan, pero quien
  silencia el sonido espera que siga silenciado al volver.
- **Sí: sonido activado por defecto.** El navegador no deja sonar nada hasta el primer
  gesto, así que no hay sonido sorpresa al cargar.
- **Sí: tecla `M`.** Ninguno de los cinco juegos la usa (comprobar en el paso 3 contra
  el `KEY_MAP` de cada reproductor).
- **No: deslizador de volumen.** Encendido y apagado bastan por ahora.

### Desviaciones durante la implementación

- **`useSoundOn(valor, efecto, dirección, activo)` en lugar de `useRiseSound(sfx)`.**
  El hook observa el estado que el reproductor ya guarda (puntuación, vidas, nivel…)
  y suena al cambiar en la dirección indicada. Así no hay que envolver cada callback
  del motor y el primer render nunca suena. Con la partida terminada (`over`) no suena
  nada salvo `gameover`.
- **`preloadSample(url)`** en `lib/audio.ts`: Arkanoid descarga sus MP3 al montar si
  el contexto ya existe, para que el primer rebote no llegue tarde.
- **El pie del CRT anuncia `M SONIDO`** junto a los controles de cada juego.
- **La tecla `M` está libre** en los cinco juegos: ningún `KEY_MAP` ni motor la usa.
- **Ampliación pedida al probarlo: sonidos en los motores.** El usuario pidió más
  sonidos y más realismo en Asteroids (motor del cohete y disparo), Frogger (salto) y
  Tetris (giro de piezas y demás). Se amplía este spec en lugar de abrir otro porque
  la rama aún no estaba integrada. Los motores llaman directamente a `playSfx` /
  `setLoop` de `lib/audio.ts` (como Arkanoid con `playSample`), sin callbacks nuevos.
- **Ruido filtrado además de osciladores** para explosiones, golpes y agua: con solo
  tonos sonaban demasiado "pitido".
- **En esos tres juegos el reproductor deja de sonar puntos, vidas y líneas** para no
  duplicar lo que ya suena el motor.

---

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Algún motor ya use la tecla `M` | Se comprueba en los pasos 3–5. Si choca, se usa otra tecla y se anota en `Decisiones`. |
| Ráfagas de `onScoreChange` (varios puntos seguidos) | Límite de 60 ms por efecto en `playSfx`. |
| Safari exige reanudar el `AudioContext` dentro del gesto | `unlockAudio()` se llama en el propio manejador de `keydown`/`pointerdown`. |
| El `AudioContext` sigue vivo al salir del juego | Es uno compartido para toda la app; no se crea uno por partida. |

---

## Lo que **no** entra en este spec

- Música de fondo.
- Deslizador de volumen.
- Sonidos de eventos sin callback (rotar, disparar, saltar).
- Ficheros de audio nuevos.
- Sonido fuera de los juegos.

Cada uno de estos puntos, si llega, va en su propio spec.
