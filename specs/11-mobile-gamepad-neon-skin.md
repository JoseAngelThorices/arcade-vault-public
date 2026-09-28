# SPEC 11 — Apariencia neón del gamepad móvil

> **Estado:** Aprobado
> **Depende de:** 10-mobile-touch-controls
> **Fecha:** 2026-09-28
> **Objetivo:** Rediseñar la apariencia del gamepad virtual de SPEC 10
> (`components/mobile-gamepad.tsx` + reglas `.gamepad` de `app/globals.css`) para que
> coincida con el asset de referencia `references/gamepad-assets/gamepad.html`
> (captura en `gamepad-neon.png`): carcasa oscura con halo cyan y trama de puntos,
> D-pad de teclas sueltas en relieve con gema cyan pulsante en el centro y botones
> A/B circulares con glow magenta/cyan. Se conserva toda la funcionalidad y la fila
> inferior (PAUSA/REANUDAR, FIN y selector de skin).

---

## Alcance

**Dentro:**

- Reglas `.gamepad*`, `.dpad*` y `.face-btn*` de `app/globals.css` (bloque SPEC 10).
- `components/mobile-gamepad.tsx`: solo marcado decorativo — gema dentro de `.dpad-hub`,
  anillo y letra envueltos en `<span>` dentro de A/B, flechas SVG a mayor tamaño.
- Carcasa `.gamepad`: fondo `linear-gradient(180deg, #1c1c28, #0c0c14)`, borde
  `rgba(0,245,255,0.18)`, radio 22 px, halo cyan (`box-shadow`), filo interior con
  `::before` y trama de puntos de 8×8 px con `::after` (`radial-gradient`).
- D-pad: cuatro teclas separadas (3 px) con degradado `#1a1a25 → #0a0a12`, radio 10 px,
  sombra inferior de relieve; al pulsar, `translateY(3px)` + glow cyan interior y exterior.
  Hub central con gema cyan romboidal (`clip-path`) y animación `pulse-led`.
- A/B: circulares, uno al lado del otro (B a la izquierda, A a la derecha, como el asset),
  degradado radial con brillo, borde y glow magenta (A) / cyan (B), letra en
  `var(--pixel)` con `text-shadow` de neón; al pulsar, `translateY(4px) scale(0.97)`,
  glow ampliado y anillo discontinuo visible.
- Fila inferior: mismo contenido y estructura, con separador en la línea cyan de la carcasa.

**Fuera:**

- Motores de juego, reproductores (`components/<id>-player.tsx`) y páginas `app/jugar/*`.
- La interfaz `MobileGamepadProps` y `KeyMap` no cambian.
- La lógica de `PadButton` (keydown/keyup sintéticos, captura del puntero) no cambia.
- Orientación horizontal, nuevas variantes del gamepad y skins del gamepad por juego.
- El breakpoint (`md:hidden`) y las reglas `:has(.gamepad)` de layout móvil.

---

## Modelo de datos

Sin cambios: ni tablas, ni tipos, ni props. Los colores salen de los tokens existentes
de `:root` (`--cyan`, `--magenta`, `--ink-dim`, `--ink-faint`) y `--pixel` ya está
cargada con `next/font` en `app/layout.tsx`.

---

## Plan de implementación

1. **Carcasa** — reescribir `.gamepad` en `globals.css`: degradado, borde, halo,
   `::before` (filo interior) y `::after` (trama de puntos, `pointer-events: none`);
   los hijos por encima de la trama con `position: relative; z-index: 1`.
2. **D-pad** — `.dpad` con `gap: 3px`; `.dpad-btn` con relieve y radio 10 px;
   `.dpad-btn[data-pressed]` con hundimiento y glow cyan; `.dpad-hub` con fondo radial
   y `.dpad-gem` con `@keyframes pulse-led`. En el componente, `<span className="dpad-gem">`
   dentro del hub y flechas de 20 px.
3. **A/B** — `.face-btns` en fila (`display: flex`, B y A); `.face-btn` con variables
   `--ab-mid`/`--ab-deep`/`--ab-glow` por botón; `.face-btn[data-pressed]` con
   hundimiento, glow ampliado y `.face-ring` visible. En el componente, cada botón
   contiene `<span className="face-ring" />` y `<span className="face-letter">`.
4. **Fila inferior** — separador `border-top` en `rgba(0,245,255,0.14)`; botones y
   selector sin cambios de estructura.
5. **Verificación** — `npm run lint`, `npx tsc --noEmit`, `npm run build`; revisión
   visual a 360–390 px en los cuatro juegos.

---

## Criterios de aceptación

- [ ] La carcasa muestra fondo degradado oscuro, borde y halo cyan y trama de puntos,
      como en `references/gamepad-assets/gamepad-neon.png`.
- [ ] Cada tecla del D-pad es una pieza separada con degradado, esquinas redondeadas y flecha SVG.
- [ ] Al pulsar una tecla del D-pad se hunde (`translateY(3px)`) y se ilumina en cyan.
- [ ] El hub central muestra la gema cyan pulsante.
- [ ] A y B son circulares, uno al lado del otro, con letra pixel y glow magenta (A) / cyan (B).
- [ ] Al pulsar A o B se hunden (`translateY(4px)`) con glow ampliado.
- [ ] Los botones sin tecla asignada o con la partida terminada se ven apagados.
- [ ] La fila inferior (PAUSA/REANUDAR, FIN, skin) sigue igual y encaja con la carcasa.
- [ ] `MobileGamepadProps` no cambia; ningún reproductor se modifica.
- [ ] El gamepad sigue oculto en ≥ 768 px y cabe sin scroll horizontal a 360 px.
- [ ] `npm run lint`, `npx tsc --noEmit` y `npm run build` pasan sin errores.

---

## Decisiones

- **Sí: estilos en `globals.css`, no CSS module** — el gamepad de SPEC 10 ya vive en
  el bloque `.gamepad` de `globals.css` y las reglas de layout móvil dependen de
  `:has(.gamepad)`; `@keyframes` también puede declararse ahí.
- **Sí: estado pulsado con `[data-pressed]`** — `PadButton` ya lleva un `useState`
  por botón y lo expone como `data-pressed`; no hace falta otro estado ni `:active`
  (poco fiable en táctil).
- **No: `@import` de Google Fonts** — "Press Start 2P" ya se carga con `next/font`
  y está disponible como `var(--pixel)`.
- **Sí: B en cyan** (antes amarillo en SPEC 10), para coincidir con el asset.
- **Sí: A/B en fila en vez de en diagonal**, como en el asset de referencia.
- **Tamaños fluidos** — se mantienen `--pad` y `--face` con `clamp()` de SPEC 10 en
  lugar de los px fijos del asset, para caber en 360 px.
