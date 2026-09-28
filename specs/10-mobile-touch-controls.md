# SPEC 10 — Controles táctiles para dispositivos móviles

> **Estado:** Aprobado
> **Depende de:** 05-asteroids-game, 07-tetris-game, 08-arkanoid-game, 09-snake-game
> **Fecha:** 2026-09-28
> **Objetivo:** Añadir un gamepad virtual táctil y un layout adaptado a los cuatro juegos
> canvas (Asteroids, Tetris, Arkanoid, Snake) en pantallas < 768 px, sin tocar los motores
> de juego ni cambiar la experiencia de escritorio.

---

## Alcance

**Dentro:**

- Crear `components/mobile-gamepad.tsx`: componente `"use client"` reutilizable con D-pad
  (4 flechas), dos botones de acción (A, B), botón PAUSA y selector de skin. Solo visible
  en `< md` (< 768 px) mediante Tailwind (`md:hidden`).
- Cada pulsación despacha un `KeyboardEvent` sintético en `document` con `code` **y** `key`
  (`new KeyboardEvent("keydown", { code, key, bubbles: true })`) y su `keyup` al soltar.
  Los motores leen `e.code`, así que el `code` es obligatorio. Asteroids escucha en
  `window` (`components/games/asteroids-game.tsx:159`): el evento burbujea de `document`
  a `window` y le llega igual.
- Modificar los cuatro reproductores (`components/<id>-player.tsx`), que es donde viven
  el HUD, la pausa y la skin (las páginas `app/jugar/<id>/page.tsx` no cambian):
  - Ocultar el HUD de React (`.player-hud`: JUGADOR, PUNTUACIÓN, VIDAS/LÍNEAS/LONGITUD,
    NIVEL, selector de skin, botones PAUSA / FIN / SALIR) en `< md`.
  - Ajustar el marco CRT en `< md` para que el canvas quepa sin scroll horizontal. Los
    canvas ya escalan al ancho de `.crt-screen` (4:3); solo hay que reducir paddings y
    bordes del marco con CSS en `app/globals.css`.
  - Renderizar `<MobileGamepad>` debajo del CRT, con el `keyMap` del juego, `paused`, el
    toggle de pausa, la skin y su setter.
- Mapeo de botones por juego (códigos que los motores ya aceptan):
  - **Asteroids:** ↑ `ArrowUp` (empuje mientras se mantiene), ← `ArrowLeft`,
    → `ArrowRight` | A `Space` (disparar) | B sin acción.
  - **Tetris:** ← `ArrowLeft`, → `ArrowRight`, ↓ `ArrowDown` (caída suave) |
    A `ArrowUp` (rotar) | B `Space` (caída instantánea).
  - **Arkanoid:** ← `ArrowLeft`, → `ArrowRight` | A `Space` (lanzar bola) | B sin acción.
  - **Snake:** ↑↓←→ `ArrowUp` / `ArrowDown` / `ArrowLeft` / `ArrowRight` | A y B sin acción.
- Los botones sin tecla asignada se renderizan deshabilitados (el layout no salta entre
  juegos).

**Fuera de alcance:**

- Modificar los motores canvas (`components/games/*-game.tsx`).
- Hiperespacio en Asteroids: el motor no lo tiene; añadirlo sería otro spec.
- Soporte táctil para juegos futuros: cada spec de juego define su `keyMap`.
- Gestos swipe o joystick analógico.
- Botones FIN / SALIR en el gamepad: el jugador móvil sale con la navegación del navegador.
- Orientación landscape: solo portrait.
- Vibración háptica.
- Mostrar puntuación/vidas en móvil (el HUD se oculta entero; el modal de fin de partida
  sigue mostrando la puntuación final).

---

## Modelo de datos

No se introducen tablas nuevas. Tipos nuevos en `components/mobile-gamepad.tsx`:

```ts
import type { Skin } from "@/lib/skins";

/** `code` de KeyboardEvent (p. ej. "ArrowUp", "Space") para cada botón. */
export interface KeyMap {
  up?: string;
  down?: string;
  left?: string;
  right?: string;
  a?: string;
  b?: string;
}

interface MobileGamepadProps {
  keyMap: KeyMap;
  paused: boolean;
  disabled?: boolean; // true con la partida terminada
  onPauseToggle: () => void;
  skin: Skin;
  onSkinChange: (skin: Skin) => void;
}
```

El `key` del evento se deriva del `code` (`"Space"` → `" "`, `"ArrowUp"` → `"ArrowUp"`),
por si algún listener lo consulta.

### Mapeo de teclas (constante en cada reproductor)

```ts
// components/asteroids-player.tsx
const KEY_MAP: KeyMap = { up: "ArrowUp", left: "ArrowLeft", right: "ArrowRight", a: "Space" };

// components/tetris-player.tsx
const KEY_MAP: KeyMap = {
  down: "ArrowDown",
  left: "ArrowLeft",
  right: "ArrowRight",
  a: "ArrowUp",
  b: "Space",
};

// components/arkanoid-player.tsx
const KEY_MAP: KeyMap = { left: "ArrowLeft", right: "ArrowRight", a: "Space" };

// components/snake-player.tsx
const KEY_MAP: KeyMap = { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight" };
```

`MobileGamepad` no conoce los juegos: solo despacha lo que recibe.

---

## Plan de implementación

1. **Crear `components/mobile-gamepad.tsx`** y sus estilos en `app/globals.css`
   - Layout: fila superior con el D-pad en cruz a la izquierda y A/B a la derecha; fila
     inferior con PAUSA/REANUDAR y el selector de skin, reutilizando
     `components/skin-picker.tsx`.
   - Eventos con Pointer Events: `onPointerDown` despacha `keydown`; `onPointerUp`,
     `onPointerCancel` y `onPointerLeave` despachan `keyup` (necesario para el empuje
     continuo de Asteroids y para no dejar teclas "pegadas"). Se usa
     `setPointerCapture` y `touch-action: none` en los botones, y `user-select: none`,
     para evitar scroll, zoom por doble toque y el clic emulado tras el toque.
   - Un botón mantenido no se autorrepite: se despacha un único `keydown` hasta soltar,
     igual que Asteroids espera (`justPressed` ignora la autorrepetición).
   - Contenedor con `md:hidden`; en escritorio no existe visualmente.
   - Verificación: en DevTools con viewport 390 px el gamepad aparece; un listener
     temporal en `document` registra `keydown`/`keyup` con el `code` correcto.

2. **Adaptar `components/asteroids-player.tsx`**
   - Añadir `max-md:hidden` (o clase equivalente en `globals.css`) al `.player-hud`.
   - Reglas `@media (max-width: 767px)` para compactar `.crt` / `.crt-bottom` sin scroll
     horizontal.
   - Renderizar `<MobileGamepad keyMap={KEY_MAP} … />` debajo del CRT, con
     `disabled={over}`.
   - Verificación: en 390 px el HUD desaparece, el canvas cabe, ↑ mantenido da empuje
     continuo y A dispara.

3. **Adaptar `components/tetris-player.tsx`** — igual que el paso 2.
   - Verificación: ←/→ mueven, ↓ baja, A rota y B hace caída instantánea.

4. **Adaptar `components/arkanoid-player.tsx`** — igual que el paso 2.
   - Verificación: ←/→ mueven la paleta mientras se mantienen y A lanza la bola.

5. **Adaptar `components/snake-player.tsx`** — igual que el paso 2.
   - Verificación: el D-pad cambia de dirección y la serpiente no invierte 180°.

6. **Verificación final** — `npm run lint`, `npx tsc --noEmit` y `npm run build` sin
   errores. En escritorio (≥ 768 px) el HUD, el teclado y el ratón funcionan igual que
   antes.

---

## Criterios de aceptación

- [ ] `MobileGamepad` no se ve en viewports ≥ 768 px (escritorio sin cambios).
- [ ] En < 768 px el HUD React está oculto en los cuatro juegos.
- [ ] El canvas cabe en un viewport de 360 px sin scroll horizontal.
- [ ] El gamepad aparece debajo del CRT en los cuatro juegos en móvil.
- [ ] Asteroids: ← → rotan, ↑ da empuje continuo mientras se mantiene y A dispara.
- [ ] Tetris: ← → mueven, ↓ baja, A rota y B hace caída instantánea.
- [ ] Arkanoid: ← → mueven la paleta y A lanza la bola.
- [ ] Snake: el D-pad cambia de dirección sin permitir giros de 180°.
- [ ] Los botones sin acción se ven deshabilitados.
- [ ] Soltar un botón (o arrastrar el dedo fuera) nunca deja una tecla pulsada.
- [ ] Tocar los botones no hace scroll ni zoom de la página.
- [ ] PAUSA del gamepad pausa y reanuda en los cuatro juegos; con la partida terminada el
      gamepad está deshabilitado.
- [ ] El selector de skin del gamepad cambia la skin del juego activo.
- [ ] En escritorio, HUD, teclado y ratón funcionan igual que antes.
- [ ] `npm run lint`, `npx tsc --noEmit` y `npm run build` completan sin errores.
- [ ] Ninguna ruta existente devuelve 500.

---

## Decisiones

- **Sí: `KeyboardEvent` sintético con `code`.** El gamepad despacha eventos de teclado en
  `document` en lugar de añadir props a los motores. Los motores leen `e.code`, así que el
  evento lleva `code` (y `key` derivado). Cero cambios en los cuatro componentes canvas.
- **Sí: Pointer Events en vez de `onTouchStart` + `onMouseDown`.** Usar ambos dispara dos
  veces en móviles (el navegador emula el clic tras el toque); Pointer Events cubre toque
  y ratón con un solo manejador.
- **Sí: D-pad visual + 2 botones**, en lugar de swipe o joystick: más precisión para
  pulsaciones discretas.
- **Sí: `md` (768 px) como breakpoint**, estándar de Tailwind.
- **Sí: PAUSA y selector de skin en el gamepad**; FIN y SALIR se excluyen para simplificar.
- **Sí: reutilizar `SkinPicker`** en lugar de duplicar el selector.
- **Sí: cambios en `components/<id>-player.tsx`**, no en `app/jugar/<id>/page.tsx`: el
  HUD y el estado de pausa/skin viven en los reproductores.
- **No: hiperespacio en Asteroids.** El motor no lo implementa y añadirlo tocaría el
  motor; el botón B queda sin acción.
- **Sí: Tetris B = `Space`**, que es la caída instantánea real del motor
  (`components/games/tetris-game.tsx:421`); el D-pad ↑ no se asigna para no duplicar la
  rotación de A.
- **Sí: Snake con flechas.** El motor acepta flechas y WASD por igual; se usan flechas por
  coherencia con los demás juegos.
- **No: modificar los motores canvas**, ni soporte landscape, ni juegos futuros en este
  spec.
