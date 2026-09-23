# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Clon de Asteroids en HTML5 Canvas puro. Sin dependencias, sin bundler, sin build, sin tests, sin package.json. Todo el código vive en `claude-asteroids-main/` (3 archivos: `index.html`, `game.js`, `favicon.svg`).

Comentarios, HUD y textos de UI están en español; mantén ese idioma al añadir código.

## Ejecutar

```bash
cd claude-asteroids-main
npx serve .        # http://localhost:3000
```

O abrir `index.html` directamente en el navegador (no hay módulos ES ni fetch, así que `file://` funciona).

No hay lint ni suite de tests. La verificación es manual: cargar la página y jugar.

## Arquitectura (`game.js`)

Un solo script en modo `'use strict'`, sin módulos ni exports. Se ejecuta de arriba abajo y arranca con `initGame(); requestAnimationFrame(loop);` al final del archivo. `canvas`, `ctx`, `W` (800) y `H` (600) son globales; `W`/`H` están duplicados a mano con los atributos `width`/`height` del `<canvas>` en `index.html` — si cambias uno, cambia el otro.

**Bucle**: `loop(ts)` → `update(dt)` → `draw()`. `dt` está en segundos y capado a `0.05` para que un tab en segundo plano no teletransporte entidades. Todas las magnitudes (velocidad, empuje, cooldowns, TTL) son por segundo y se multiplican por `dt`; no uses constantes por frame.

**Entidades**: `Bullet`, `Asteroid`, `Ship`, `Particle` son clases con la misma interfaz informal — `update(dt)`, `draw()` y una bandera `dead`. Se guardan en los arrays globales `bullets`, `asteroids`, `particles` más el singleton `ship`. El patrón de borrado es marcar `dead = true` durante la resolución de colisiones y luego reasignar el array con `.filter(e => !e.dead)` en `update()`; nada se elimina in situ mientras se itera. Una entidad nueva sigue este contrato sin más.

**Espacio toroidal**: `wrap(v, max)` se aplica a las posiciones de `Ship`, `Bullet` y `Asteroid` (no a `Particle`, que muere antes por TTL). Las colisiones usan `dist()` euclídeo sin tener en cuenta el envolvimiento, así que dos cuerpos en bordes opuestos no chocan — es una limitación conocida, no un bug que arreglar a medias.

**Máquina de estados**: la global `state` vale `'playing' | 'dead' | 'gameover'`, y `update()` hace early-return por cada rama antes de la lógica de juego. En `'dead'` solo avanzan asteroides y partículas mientras corre `deadTimer` (2 s); en `'gameover'` solo partículas y se espera `Space` para reiniciar con `initGame()`.

**Input**: `keys` es estado sostenido (rotar, propulsar); `justPressed` + el consumidor `pressed(code)` es edge-triggered de un solo uso (disparar, reiniciar). `pressed()` limpia la bandera al leerla, así que llámalo una sola vez por frame y por tecla.

**Tablas por tamaño**: `RADII`, `SPEEDS` y `POINTS` están indexadas por `size` 1–3 con el índice 0 como relleno. `Asteroid.split()` devuelve dos asteroides de `size - 1` y `[]` en el tamaño 1. Cualquier tamaño nuevo exige actualizar las tres tablas a la vez.

**Progresión**: `nextLevel()` se dispara cuando `asteroids.length === 0`, incrementa `level` y hace spawn de `3 + level` asteroides grandes. `spawnAsteroids()` rechaza posiciones a menos de 130 px del centro para no matar a la nave al reaparecer.

**Render**: todo es vectorial con `ctx` (stroke blanco sobre fondo negro), sin sprites ni imágenes. Cada `draw()` que rota o traslada envuelve su dibujo en `ctx.save()`/`ctx.restore()`.

## Discrepancia README

`claude-asteroids-main/README.md` menciona power-ups y un tipo de asteroide "estrella fugaz" que **no existen** en `game.js`. Si implementas esas funciones, el README ya las describe; si no, no lo tomes como documentación del comportamiento actual.
