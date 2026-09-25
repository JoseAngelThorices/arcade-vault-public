# Sugerencias de juegos — To-Do

> Mantenido por el agente `game-planner`. No editar manualmente sin avisar al agente.

## 🟡 Sugeridos (pendientes de decisión)

| ID               | Título            | Categoría  | Color  | Descripción breve                                                                            | Justificación                                                                                         | Fecha      |
| ---------------- | ----------------- | ---------- | ------ | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ---------- |
| `frogger`        | FROGGER           | MAZE       | lime   | Cruza la carretera y el río sin convertirte en papilla.                                      | Añade categoría MAZE ausente; lógica de cuadrícula simple, colisiones por celda, sin físicas.         | 2026-05-20 |
| `pacman`         | PAC-MAN           | MAZE       | yellow | Come todos los puntos del laberinto huyendo de 4 fantasmas.                                  | Segunda cobertura de MAZE con IA de fantasmas clásica; canvas 2D con tilemaps es bien conocido.       | 2026-05-20 |
| `dig-dug`        | DIG DUG           | MAZE       | orange | Excava túneles bajo tierra para inflar y reventar monstruos subterráneos.                    | Terreno destructible como grid de celdas booleanas; dos tipos de enemigos, factibilidad alta.         | 2026-05-20 |
| `space-invaders` | SPACE INVADERS    | SHOOTER    | green  | Destruye oleadas de alienígenas antes de que lleguen a la Tierra.                            | Shooter icónico; grid de enemigos con movimiento uniforme, escudos destructibles, factibilidad alta.  | 2026-05-20 |
| `galaga`         | GALAGA            | SHOOTER    | purple | Repele formaciones enemigas que se lanzan en picado sobre tu nave.                           | Shooter con patrones de vuelo Bezier; más dinámico que Space Invaders, factibilidad media.            | 2026-05-20 |
| `pong`           | PONG              | SPORTS     | blue   | Golpea la pelota más rápido de lo que tu rival puede reaccionar.                             | Incorpora categoría SPORTS; es el juego más simple del canon arcade, implementación en <200 líneas.   | 2026-05-20 |
| `ice-hockey`     | ICE HOCKEY        | SPORTS     | cyan   | Controla tu equipo en una pista helada y marca más goles que el rival en 90 segundos.        | Cubre SPORTS con multi-sprite; lógica de posesión del disco, factibilidad media.                      | 2026-05-20 |
| `tennis`         | TENNIS            | SPORTS     | lime   | Devuelve cada golpe con precisión de ángulo antes de que la pelota bote dos veces.           | Variante de SPORTS con pseudo-perspectiva 3D; más profundidad visual que Pong, factibilidad media.    | 2026-05-20 |
| `kong`           | DONKEY KONG       | PLATFORMER | red    | Sube escaleras y salta barriles rodantes para rescatar a la princesa en la cima.             | Introduce categoría PLATFORMER; física de salto + plataformas, factibilidad media.                    | 2026-05-20 |
| `minesweeper`    | MINESWEEPER       | STRATEGY   | gray   | Despeja el campo de minas usando lógica antes de pisar una.                                  | Introduce STRATEGY; grid simple, flood-fill, pura lógica de tablero, factibilidad alta.               | 2026-05-20 |
| `battleship`     | BATTLESHIP        | STRATEGY   | navy   | Hunde la flota enemiga antes de que destruyan la tuya.                                       | Segunda cobertura STRATEGY; dos grids, IA hunting-mode, factibilidad media.                           | 2026-05-20 |
| `2048`           | 2048              | PUZZLE     | amber  | Desliza y fusiona fichas hasta alcanzar el número 2048.                                      | Puzzle moderno icónico; grid 4×4, animaciones de merge simples, factibilidad alta.                    | 2026-05-20 |
| `sokoban`        | SOKOBAN           | PUZZLE     | brown  | Empuja cajas hacia sus marcadores sin quedar atrapado.                                       | Puzzle clásico; tilemap estático, movimiento discreto por celdas, sistema de undo, factibilidad alta. | 2026-05-20 |
| `columns`        | COLUMNS           | PUZZLE     | violet | Alinea 3 joyas del mismo color en columnas que caen sin parar.                               | Variante de Tetris con detección en 4 direcciones; sin rotaciones complejas, factibilidad alta.       | 2026-05-20 |
| `road-fighter`   | ROAD FIGHTER      | RACING     | red    | Rebasa coches rivales y gestiona el combustible hasta llegar a la meta.                      | Introduce categoría RACING con scroll vertical top-down; patrón familiar a Snake, factibilidad alta.  | 2026-05-20 |
| `out-run`        | OUT RUN           | RACING     | pink   | Conduce tu Ferrari por carreteras ramificadas antes de que el tiempo expire.                 | Racing pseudo-3D icónico; trapezoides en canvas 2D, factibilidad media.                               | 2026-05-20 |
| `pole-position`  | POLE POSITION     | RACING     | silver | Clasifica en pole y gana la carrera en un circuito de Fórmula 1 retro.                       | Racing pseudo-3D + IA de rivales; más complejo que Road Fighter, factibilidad media.                  | 2026-05-20 |
| `karate-champ`   | KARATE CHAMP      | FIGHTING   | gold   | Ejecuta técnicas de karate precisas para puntuar antes de que el árbitro detenga el combate. | Introduce FIGHTING; sistema de poses por combinación de teclas, factibilidad alta.                    | 2026-05-20 |
| `street-fighter` | STREET FIGHTER II | FIGHTING   | red    | Elige tu luchador y derrota al oponente con combos antes de que acabe el tiempo.             | Fighting icónico; hitboxes por frame + combos, más complejo, factibilidad media.                      | 2026-05-20 |
| `simon`          | SIMON              | RHYTHM     | indigo | Repite secuencias de luces y sonido cada vez más largas sin fallar un solo paso.              | Introduce RHYTHM, ausente por completo del catálogo y del to-do; mecánica de memoria por color/sonido, sin físicas ni colisiones, factibilidad muy alta. | 2026-09-25 |
| `q-bert`         | Q*BERT             | PLATFORMER | teal   | Salta entre cubos isométricos y cambia su color antes de que los enemigos te alcancen.        | Refuerza PLATFORMER (solo `kong` antes); salto en grid isométrico muy reconocible, factibilidad media.| 2026-09-25 |
| `bomberman`      | BOMBERMAN          | MAZE       | rose   | Coloca bombas estratégicas para abrir camino y eliminar enemigos sin quedar atrapado en la explosión. | Cuarta variante de MAZE pero con mecánica de explosiones en cadena muy distinta a las ya sugeridas; clásico muy reconocible.                              | 2026-09-25 |
| `centipede`       | CENTIPEDE          | SHOOTER    | emerald | Dispara al ciempiés que serpentea entre setas antes de que te alcance.                       | Shooter de campo fijo con setas destructibles y enemigo que se fragmenta; muy distinto a Asteroids, factibilidad alta. | 2026-09-25 |
| `missile-command` | MISSILE COMMAND    | SHOOTER    | orange  | Traza misiles interceptores y salva tus ciudades del bombardeo.                              | Shooter de puntería/trayectoria en vez de nave; solo líneas y círculos de explosión, factibilidad alta. | 2026-09-25 |
| `robotron-2084`   | ROBOTRON 2084      | SHOOTER    | fuchsia | Rescata humanos y sobrevive oleadas de robots que llegan desde todas direcciones.            | Esquema twin-stick (mover y disparar por separado) no cubierto; riesgo: decenas de entidades a 60 fps. | 2026-09-25 |
| `pengo`           | PENGO              | ARCADE     | sky     | Empuja bloques de hielo para aplastar a los Sno-Bees antes de que te atrapen.                | Empuje de bloques en grid, distinto a Snake/Arkanoid; colisiones por celda, factibilidad alta.        | 2026-09-25 |
| `crazy-climber`   | CRAZY CLIMBER      | ARCADE     | amber   | Escala un rascacielos esquivando macetas y ventanas mientras el tiempo corre.                | Control de escalada único; riesgo: mapear el control de dos manos al teclado.                         | 2026-09-25 |
| `bubble-bobble`   | BUBBLE BOBBLE      | PLATFORMER | sky     | Atrapa enemigos en burbujas y revienta para limpiar cada pantalla de un salto.               | PLATFORMER de pantalla fija con mecánica propia de atrapar y reventar; muy reconocible.               | 2026-09-25 |
| `lode-runner`     | LODE RUNNER        | PLATFORMER | amber   | Cava el suelo bajo los guardias y recoge todo el oro antes de escapar por las escaleras.     | Grid de tiles con escaleras y agujeros temporales; IA de guardias simple, factibilidad alta.          | 2026-09-25 |
| `burger-time`     | BURGER TIME        | PLATFORMER | orange  | Camina sobre los ingredientes para dejarlos caer y aplastar a los villanos que te persiguen. | Plataformas + apilado en cascada, mecánica muy distinta al resto; icono de los 80.                    | 2026-09-25 |
| `wizard-of-wor`   | WIZARD OF WOR      | MAZE       | violet  | Dispara a los monstruos del calabozo antes de que ellos te vean primero.                     | MAZE con disparo y visibilidad restringida; riesgo: line-of-sight por pasillos.                       | 2026-09-25 |
| `amidar`          | AMIDAR             | MAZE       | fuchsia | Pinta cada tramo del laberinto de rejilla antes de que los guardianes te atrapen.            | MAZE sobre retícula de líneas que rellena celdas al cerrarlas; distinto a comer puntos, factibilidad alta. | 2026-09-25 |
| `excitebike`      | EXCITEBIKE         | RACING     | orange  | Esquiva baches y salta rampas de tierra sin fundir el motor.                                 | RACING de vista lateral sin tráfico ni IA compleja; solo física de salto y sobrecalentamiento.        | 2026-09-25 |
| `spy-hunter`      | SPY HUNTER         | RACING     | blue    | Esquiva el tráfico y dispara a los coches enemigos en la autopista sin fin.                  | RACING cenital con combate; scroll vertical infinito, más contenido y balanceo que Road Fighter.      | 2026-09-25 |
| `track-field`     | TRACK & FIELD      | SPORTS     | lime    | Machaca el teclado para correr, saltar y lanzar más lejos que nadie.                         | SPORTS multievento por pulsación y timing, sin IA ni física de balón; factibilidad alta.              | 2026-09-25 |
| `soccer`          | SOCCER ARCADE      | SPORTS     | teal    | Controla a tu equipo y marca el gol decisivo antes de que pite el árbitro.                   | SPORTS de equipo en vista cenital; riesgo: física del balón e IA de compañeros y rivales.             | 2026-09-25 |
| `punch-out`       | PUNCH-OUT!!        | FIGHTING   | red     | Esquiva, bloquea y castiga los patrones del rival hasta noquearlo.                           | FIGHTING por patrones telegrafiados y ventanas de reacción; mucho más simple que un motor de combos.  | 2026-09-25 |
| `taiko`           | TAIKO DRUM MASTER  | RHYTHM     | red     | Golpea el tambor al ritmo exacto de cada nota antes de que se te escape.                     | RHYTHM de timing real (Simon es memoria); notas hacia zona de impacto fija, riesgo: sincronía de audio. | 2026-09-25 |
| `dance-revolution`| DANCE DANCE REVOLUTION | RHYTHM | fuchsia | Pisa las flechas al compás exacto antes de que se te escape el ritmo.                        | RHYTHM en cuatro carriles; reutiliza el patrón de piezas cayendo, riesgo: desfase audio/flechas.      | 2026-09-25 |
| `reversi`         | REVERSI            | STRATEGY   | emerald | Voltea las fichas del rival y domina el tablero antes de que se llene.                       | STRATEGY de tablero por turnos; grid 8×8 trivial, riesgo: IA minimax con poda alfa-beta.              | 2026-09-25 |
| `rampart`         | RAMPART            | STRATEGY   | stone   | Repara tus murallas y bombardea al enemigo antes de que caiga tu fortaleza.                  | STRATEGY con fases de construcción y artillería; riesgo: flood-fill para validar murallas cerradas.   | 2026-09-25 |
| `picross`         | PICROSS            | PUZZLE     | slate   | Descifra las pistas numéricas y rellena la cuadrícula sin marcar una casilla de más.         | PUZZLE de deducción pura, distinto a Tetris/2048/Sokoban; riesgo: tableros con solución única.        | 2026-09-25 |

## 🟢 Aceptados / en desarrollo

| ID  | Título | Spec | Fecha aceptado |
| --- | ------ | ---- | -------------- |

## ✅ Implementados

| ID          | Título    | Categoría | Fecha |
| ----------- | --------- | --------- | ----- |
| `asteroids` | ASTEROIDS | SHOOTER   | —     |
| `tetris`    | TETRIS    | PUZZLE    | —     |
| `arkanoid`  | ARKANOID  | ARCADE    | —     |
| `snake`     | SNAKE     | ARCADE    | —     |

## ❌ Descartados

| ID  | Título | Motivo | Fecha |
| --- | ------ | ------ | ----- |
