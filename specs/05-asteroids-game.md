# SPEC 05 — Integración del juego Asteroids

> **Estado:** Implementado
> **Depende de:** 04-supabase-integration
> **Fecha:** 2026-09-23
> **Objetivo:** Integrar el juego Asteroids (canvas puro) como un nuevo juego jugable
> en la plataforma con ID `asteroids`, conectando su estado interno (puntuación, vidas, nivel,
> fin de partida) con el HUD y la interfaz React de su página de juego dedicada.

---

## Alcance

**Entra:**

- Añadir la entrada `asteroids` al array `GAMES` en `lib/games.ts`.
- Crear `components/games/asteroids-game.tsx` — componente React que encapsula el canvas
  y el bucle de juego adaptado de `references/start-games/02-asteroids/game.js`. Acepta las props
  `paused`, `onScoreChange`, `onLivesChange`, `onLevelChange` y `onGameOver`.
- El canvas deja de dibujar puntuación, nivel y vidas; solo conserva la cuenta atrás de los
  power-ups activos.
- El componente canvas notifica a React de cada cambio de estado mediante callbacks, y el HUD
  de la plataforma es el único que muestra esos valores.
- Crear `app/jugar/asteroids/page.tsx` — página de juego específica para Asteroids.
  Gestiona el estado (puntuación, vidas, nivel, pausa, fin de partida) y pasa los callbacks al componente canvas.
- El botón de pausa de la plataforma pasa el indicador `paused` al componente canvas, que congela
  el bucle de juego.
- Eliminar la capa "GAME OVER" del canvas: el modal React de la plataforma la sustituye.

**Fuera de alcance (para specs futuros):**

- Guardar puntuaciones en Supabase (spec futuro de puntuaciones).
- Añadir otros juegos canvas a la plataforma.
- Extraer un componente genérico `CanvasGame`: se hará cuando llegue el segundo juego canvas.
- Controles táctiles o versión móvil.
- El juego `rocas`: se eliminó del catálogo tras implementar este spec (Asteroids lo sustituye).

---

## Modelo de datos

Una nueva entrada en el array `GAMES` de `lib/games.ts`:

```ts
{
  id: 'asteroids',
  title: 'ASTEROIDES',
  short: 'Pulveriza rocas en gravedad cero.',
  long: 'Tu nave triangular flota en vacío absoluto. Dispara y rota para dividir rocas en fragmentos cada vez más pequeños. Supera niveles y acumula puntos antes de que los asteroides te alcancen.',
  cat: 'SHOOTER',
  cover: 'cover-rocas',
  color: 'yellow',
  best: 0,
  plays: '0',
}
```

Props del componente `AsteroidsGame`:

```ts
interface AsteroidsGameProps {
  paused: boolean;
  onScoreChange: (score: number) => void;
  onLivesChange: (lives: number) => void;
  onLevelChange: (level: number) => void;
  onGameOver: (finalScore: number) => void;
}
```

Este spec no introduce ningún modelo de datos persistente.

---

## Plan de implementación

1. **Añadir `asteroids` a `GAMES`** — agregar la entrada en `lib/games.ts`.
   Verificación: la página `/juegos` muestra la tarjeta de Asteroids.

2. **Crear `components/games/asteroids-game.tsx`** — componente `"use client"` que:
   - Renderiza un `<canvas>` de 800×600.
   - Contiene el bucle de juego completo adaptado de `game.js` (clases `Bullet`, `Asteroid`,
     `Ship`, `Particle` y funciones `update`/`draw`/`loop`).
   - Recibe la prop `paused: boolean`: si es `true`, el bucle llama a `draw()` pero no a `update()`.
   - Llama a `onScoreChange`, `onLivesChange` y `onLevelChange` cada vez que esos valores cambian
     dentro del bucle (comparando con el valor anterior antes de disparar el callback).
   - Llama a `onGameOver(score)` cuando `state` pasa a `'gameover'`, en lugar de mostrar
     la capa de fin de partida del canvas.
   - La capa "GAME OVER" y el texto "ESPACIO PARA REINICIAR" se eliminan de `draw()`.
   - `drawHUD` ya no dibuja puntuación, nivel ni vidas; solo los efectos activos de los power-ups.
   - Elimina los listeners de teclado en la función de limpieza del `useEffect`.
     Verificación: el juego arranca en `/jugar/asteroids` y se puede jugar.

3. **Crear `app/jugar/asteroids/page.tsx`** — página de juego específica:
   - Importa `AsteroidsGame` con `dynamic(..., { ssr: false })` para evitar errores de canvas
     en el renderizado en servidor.
   - Estado local: `score`, `lives`, `level`, `paused`, `over`, `name`, `saved`.
   - Pasa `paused` y los cuatro callbacks a `AsteroidsGame`.
   - Reutiliza la misma maquetación visual (HUD React + CRT + modal de fin de partida) que la página
     de juego genérica existente, sustituyendo el marcador de posición `div.game-arena` por el componente canvas.
     Verificación: el HUD React muestra los valores en tiempo real mientras se juega.

4. **Verificación final** — `npm run build` termina sin errores de TypeScript.

---

## Criterios de aceptación

- [x] La tarjeta de Asteroids aparece en `/juegos` con ID `asteroids`.
- [x] La ruta `/jugar/asteroids` carga sin errores de renderizado en servidor ni de TypeScript.
- [x] El canvas renderiza el juego (nave, asteroides, balas, partículas) y se puede jugar con
      el teclado (flechas + espacio).
- [x] El canvas no dibuja puntuación, nivel ni vidas (solo la cuenta atrás de los power-ups).
- [x] El HUD React de la plataforma refleja en tiempo real la puntuación, las vidas y el nivel
      del juego.
- [x] El botón "PAUSA" de la plataforma congela el bucle de juego y "REANUDAR" lo reanuda.
- [x] Al perder todas las vidas aparece el modal React de fin de partida con la puntuación final.
- [x] La capa "GAME OVER" del canvas ya no se dibuja (el modal React la sustituye).
- [x] El botón "JUGAR DE NUEVO" del modal reinicia la partida desde cero.
- [x] `npm run build` termina sin errores relacionados con los archivos nuevos.
- [x] La página de juego genérica `/jugar/[id]` y el resto de rutas existentes no se rompen.

---

## Decisiones

- **Sí: un solo HUD, el de la plataforma** — puntuación, nivel y vidas solo se muestran en el
  HUD React; el canvas conserva únicamente la cuenta atrás de los power-ups, que no tiene
  equivalente fuera. Razón: el usuario no quiere esos datos duplicados sobre la pantalla
  de juego (cambio posterior a la implementación, 2026-09-23). La plataforma sigue recibiendo
  los valores por callbacks para integraciones futuras (Supabase, récords, etc.).

- **Sí: callbacks como interfaz de comunicación** — el componente canvas llama a
  `onScoreChange`, `onLivesChange`, `onLevelChange` y `onGameOver` cuando el estado cambia.
  Razón: desacoplamiento limpio; el juego no sabe nada de React ni de la plataforma.

- **Sí: `dynamic(..., { ssr: false })`** — el componente canvas se carga solo en el cliente.
  Razón: `canvas` y `requestAnimationFrame` no existen en el entorno Node.js donde Next.js renderiza en servidor.

- **Sí: página de juego específica `app/jugar/asteroids/page.tsx`** — en lugar de
  modificar la ruta genérica `jugar/[id]`. Razón: evita condicionales en la ruta genérica
  y mantiene cada juego aislado; el App Router de Next.js da prioridad a las rutas estáticas sobre
  las dinámicas.

- **No: componente genérico `CanvasGame`** — se extraerá cuando llegue el segundo juego canvas.
  Razón: YAGNI; generalizar ahora sería abstraer sin un caso de uso confirmado.

- **No: controles de pausa dentro del canvas** — la plataforma controla la pausa mediante una prop.
  Razón: coherencia con el resto de juegos de la plataforma.

---

## Notas de implementación

Cambios acordados después de la implementación (2026-09-24), sin spec propio:

- **Cambio de nivel limpio.** Al pasar de nivel desaparecen los power-ups sin recoger y se
  cortan los efectos activos (TRIPLE, LENTO, TURBO, ESCUDO). Los cinco tipos vuelven a caer
  al destruir las rocas del nivel nuevo. Puntuación y vidas se conservan.
- **Dificultad por nivel.** Además de los asteroides extra (`3 + nivel`), su velocidad sube
  un 10 % por nivel con tope ×1,8 (`LEVEL_SPEED_STEP` y `LEVEL_SPEED_MAX` en
  `components/games/asteroids-game.tsx`).
