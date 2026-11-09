"use client";

// Frogger escrito desde cero (SPEC 12): no hay codigo de referencia ni assets,
// todo se dibuja con primitivas de canvas. Tablero de 20x15 celdas de 36 px
// (4:3, llena la pantalla CRT): fila 0 meta con 5 nenufares, 1-5 rio, 6 isla,
// 7-11 carretera, 12 arcen y 13-14 salida. El sapo salta una celda por tecla;
// sobre troncos y tortugas su columna pasa a ser continua y se deja arrastrar.
// La pausa llega por prop (P y Escape la piden con onPauseToggle) y
// puntuacion/vidas/nivel se notifican por callback en lugar de pintarse: el
// canvas no dibuja HUD ni overlays de PAUSA o fin de partida.
// La skin (NEON, RETRO o CLASICO) llega por prop y se lee en cada frame.

import { useEffect, useRef } from "react";
import { playSfx, type Sfx } from "@/lib/audio";
import type { Skin } from "@/lib/skins";

interface FroggerGameProps {
  paused: boolean;
  skin: Skin;
  onScoreChange: (score: number) => void;
  onLivesChange: (lives: number) => void; // empieza en 3
  onLevelChange: (level: number) => void;
  onPauseToggle: () => void; // teclas P y Escape
  onGameOver: (finalScore: number) => void;
}

type Callbacks = Omit<FroggerGameProps, "paused" | "skin">;

// ── Constantes ────────────────────────────────────────────────────────────────
const COLS = 20;
const ROWS = 15;
const CELL = 36;
const CANVAS_W = COLS * CELL; // 720
const CANVAS_H = ROWS * CELL; // 540

const START_COL = 9;
const START_ROW = 14;
const START_LIVES = 3;
const HOP_MS = 100; // duracion de la animacion de salto (y cooldown entre saltos)

const POINTS_PER_ROW = 10;
const POINTS_PER_HOME = 50;
const POINTS_PER_ROUND = 200;

const SPEED_FACTOR = 1.15; // cada ronda completada
const MAX_SPEED_MULT = 2.5;

const HOME_ROW = 0;
const HOME_COLS = [1, 5, 9, 13, 17]; // huecos de 2 celdas separados por agua
const HOME_WIDTH = 2;

const isRiver = (row: number) => row >= 1 && row <= 5;
const isRoad = (row: number) => row >= 7 && row <= 11;

// ── Skins ─────────────────────────────────────────────────────────────────────
// `glow` es el shadowBlur de sapo, vehiculos y nenufares (0 = sin glow),
// `topEdge` la franja clara de RETRO sobre cada bloque (null = sin franja),
// `waves` y `roadLine` las lineas del agua y de la carretera (null = sin ellas)
// y `vehicles` el color de cada carril de carretera, por fila.
interface Palette {
  water: string;
  waves: string | null;
  asphalt: string;
  roadLine: string | null;
  grass: string;
  grassEdge: string;
  log: string;
  logDark: string;
  turtle: string;
  shell: string;
  pad: string;
  padFilled: string;
  frog: string;
  eye: string;
  pupil: string;
  headlight: string;
  vehicles: Record<number, string>;
  glow: number;
  topEdge: string | null;
}

const PALETTES: Record<Skin, Palette> = {
  neon: {
    water: "#041a33",
    waves: "rgba(0, 245, 255, 0.08)",
    asphalt: "#15151f", // --bg-3
    roadLine: "rgba(245, 255, 0, 0.35)",
    grass: "#0c3318",
    grassEdge: "#155a2a",
    log: "#7a4a1f",
    logDark: "#4e2d10",
    turtle: "#2e9e4f",
    shell: "#1b6b33",
    pad: "#1f9e4a",
    padFilled: "#ffc400",
    frog: "#00ff88", // --green
    eye: "#eafff0",
    pupil: "#0a0a0f",
    headlight: "#ffffff",
    // --magenta, --cyan, --yellow
    vehicles: { 7: "#ff006e", 8: "#00f5ff", 9: "#f5ff00", 10: "#00f5ff", 11: "#ff006e" },
    glow: 12,
    topEdge: null,
  },
  // CRT de 8 bits: bloques solidos, paleta corta, sin glow y con luz cenital.
  retro: {
    water: "#1b2a6b",
    waves: "#24378a",
    asphalt: "#1a1d2e",
    roadLine: "#6b6f86",
    grass: "#2d6b2f",
    grassEdge: "#3f8f41",
    log: "#a0622d",
    logDark: "#6b3d17",
    turtle: "#d04848",
    shell: "#8a2a2a",
    pad: "#3fae4a",
    padFilled: "#f0c020",
    frog: "#5ce65c",
    eye: "#ffffff",
    pupil: "#000000",
    headlight: "#fff6a0",
    vehicles: { 7: "#e84a8a", 8: "#4ac8e8", 9: "#f0e040", 10: "#e8e8e8", 11: "#e8904a" },
    glow: 0,
    topEdge: "rgba(255, 255, 255, 0.35)",
  },
  // El arcade de 1981: rio azul marino, carretera negra, aceras moradas y
  // tortugas rojas.
  clasico: {
    water: "#000047",
    waves: null,
    asphalt: "#000000",
    roadLine: null,
    grass: "#6a2c91",
    grassEdge: "#8b45b5",
    log: "#8b4513",
    logDark: "#5a2d0c",
    turtle: "#e02020",
    shell: "#8a0f0f",
    pad: "#00a800",
    padFilled: "#e8e800",
    frog: "#39d339",
    eye: "#ffe000",
    pupil: "#000000",
    headlight: "#ffff80",
    vehicles: { 7: "#e8e8e8", 8: "#ff5fd2", 9: "#e8e800", 10: "#e8e8e8", 11: "#00c8ff" },
    glow: 0,
    topEdge: null,
  },
};

// ── Carriles ──────────────────────────────────────────────────────────────────
type Dir = "up" | "down" | "left" | "right";
type LaneKind = "road" | "river";
type Variant = "log" | "turtles" | "truck" | "car";

type LaneEntity = {
  x: number; // posicion en pixeles, no en celdas
  widthCells: number;
};

type Lane = {
  row: number; // 1..5 rio, 7..11 carretera
  kind: LaneKind;
  variant: Variant;
  dir: 1 | -1;
  baseSpeed: number; // px/s en nivel 1
  spanPx: number; // longitud del circuito de reciclado
  entities: LaneEntity[];
};

type LaneSpec = {
  row: number;
  variant: Variant;
  dir: 1 | -1;
  speed: number;
  width: number; // celdas
  spacing: number; // celdas entre el inicio de una entidad y el de la siguiente
};

// Tabla de carriles del spec (velocidades base en nivel 1).
const LANE_SPECS: LaneSpec[] = [
  { row: 1, variant: "log", dir: -1, speed: 60, width: 3, spacing: 5 },
  { row: 2, variant: "turtles", dir: 1, speed: 50, width: 2, spacing: 6 },
  { row: 3, variant: "log", dir: -1, speed: 75, width: 2, spacing: 5 },
  { row: 4, variant: "turtles", dir: 1, speed: 55, width: 3, spacing: 7 },
  { row: 5, variant: "log", dir: -1, speed: 65, width: 3, spacing: 6 },
  { row: 7, variant: "truck", dir: 1, speed: 50, width: 2, spacing: 7 },
  { row: 8, variant: "car", dir: -1, speed: 65, width: 1, spacing: 5 },
  { row: 9, variant: "car", dir: 1, speed: 95, width: 1, spacing: 4 },
  { row: 10, variant: "truck", dir: -1, speed: 55, width: 2, spacing: 6 },
  { row: 11, variant: "car", dir: 1, speed: 70, width: 1, spacing: 5 },
];

/**
 * Crea un carril con entidades equiespaciadas en un circuito cerrado. El
 * circuito mide un numero entero de periodos y al menos el ancho del tablero
 * mas una entidad, asi el reciclado por el borde opuesto nunca se ve.
 */
function makeLane(s: LaneSpec): Lane {
  const count = Math.ceil((COLS + s.width) / s.spacing);
  const offset = (s.row * 3) % s.spacing; // desfase para que los carriles no se alineen
  return {
    row: s.row,
    kind: s.variant === "log" || s.variant === "turtles" ? "river" : "road",
    variant: s.variant,
    dir: s.dir,
    baseSpeed: s.speed,
    spanPx: count * s.spacing * CELL,
    entities: Array.from({ length: count }, (_, i) => ({
      x: (i * s.spacing + offset) * CELL,
      widthCells: s.width,
    })),
  };
}

type HomeSlot = { col: number; widthCells: number; filled: boolean };

const KEY_DIR: Record<string, Dir> = {
  ArrowUp: "up",
  KeyW: "up",
  ArrowDown: "down",
  KeyS: "down",
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
};

const ANGLE: Record<Dir, number> = {
  up: 0,
  right: Math.PI / 2,
  down: Math.PI,
  left: -Math.PI / 2,
};

// Margen alrededor del sprite para que el glow no se recorte.
const SPRITE_PAD = 20;

/** Pinta una forma con su glow en un canvas offscreen (coordenadas locales). */
function bakeGlowSprite(w: number, h: number, paint: (c: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement("canvas");
  canvas.width = w + SPRITE_PAD * 2;
  canvas.height = h + SPRITE_PAD * 2;
  const c = canvas.getContext("2d")!;
  c.translate(SPRITE_PAD, SPRITE_PAD);
  paint(c);
  return canvas;
}

export default function FroggerGame({ paused, skin, ...callbacks }: FroggerGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pausedRef = useRef(paused);
  const skinRef = useRef(skin);
  const callbacksRef = useRef<Callbacks>(callbacks);

  useEffect(() => {
    pausedRef.current = paused;
    skinRef.current = skin;
    callbacksRef.current = callbacks;
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    return startGame(canvas, pausedRef, skinRef, callbacksRef);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_W}
      height={CANVAS_H}
      className="block aspect-[4/3] h-auto w-full max-w-full bg-black [image-rendering:pixelated]"
      aria-label="Frogger: flechas o WASD para saltar"
    />
  );
}

/** Arranca el juego sobre el canvas y devuelve la funcion de limpieza. */
function startGame(
  canvas: HTMLCanvasElement,
  pausedRef: { current: boolean },
  skinRef: { current: Skin },
  callbacksRef: { current: Callbacks },
): () => void {
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  const pal = () => PALETTES[skinRef.current];

  const state = {
    frog: {
      col: START_COL, // float cuando va sobre un tronco/tortuga, entero en el resto de filas
      row: START_ROW,
      facing: "up" as Dir,
      ridingEntity: null as LaneEntity | null,
    },
    // Origen de la animacion del ultimo salto (solo dibujo).
    hopFrom: { col: START_COL, row: START_ROW },
    lanes: LANE_SPECS.map(makeLane),
    homeSlots: HOME_COLS.map((col) => ({ col, widthCells: HOME_WIDTH, filled: false })) as HomeSlot[],
    bestRowThisLife: START_ROW, // fila mas alta alcanzada desde el ultimo respawn (menor = mas avance)
    score: 0,
    lives: START_LIVES,
    level: 1,
    lastHopAt: -Infinity, // timestamp del ultimo salto, para el cooldown de animacion
    speedMult: 1, // 1.15^(nivel-1), tope 2.5
    over: false,
  };

  // ── Logica ──────────────────────────────────────────────────────────────────
  function resetLife() {
    state.frog.col = START_COL;
    state.frog.row = START_ROW;
    state.frog.facing = "up";
    state.frog.ridingEntity = null;
    state.hopFrom = { col: START_COL, row: START_ROW };
    state.lastHopAt = -Infinity;
    state.bestRowThisLife = START_ROW;
  }

  function resetRound() {
    for (const slot of state.homeSlots) slot.filled = false;
    state.level++;
    state.speedMult = Math.min(MAX_SPEED_MULT, SPEED_FACTOR ** (state.level - 1));
    resetLife();
  }

  /** Muerte con su sonido (SPEC 16): agua o atropello. */
  function onDeath(sfx: Sfx) {
    playSfx(sfx);
    state.lives -= 1;
    if (state.lives > 0) {
      resetLife();
      return;
    }
    // notify() avisa de las 0 vidas antes que del fin de partida.
    state.over = true;
  }

  const laneAt = (row: number) => state.lanes.find((l) => l.row === row);

  /** Entidad del rio bajo el centro del sapo, o null si solo hay agua. */
  function supportAt(row: number, col: number): LaneEntity | null {
    const lane = laneAt(row);
    if (!lane) return null;
    const cx = (col + 0.5) * CELL;
    return lane.entities.find((e) => cx >= e.x && cx < e.x + e.widthCells * CELL) ?? null;
  }

  /** true si la celda del sapo se solapa con algun vehiculo de su carril. */
  function hitByVehicle(row: number, col: number): boolean {
    const lane = laneAt(row);
    if (!lane) return false;
    const left = col * CELL;
    const right = left + CELL;
    return lane.entities.some((e) => left < e.x + e.widthCells * CELL && e.x < right);
  }

  function tryHop(dir: Dir, now: number) {
    if (state.over || now - state.lastHopAt < HOP_MS) return;

    const frog = state.frog;
    let row = frog.row;
    let col = frog.col;
    if (dir === "up") row--;
    else if (dir === "down") row++;
    else if (dir === "left") col--;
    else col++;

    row = Math.min(Math.max(row, 0), ROWS - 1);
    // Fuera del rio la columna vuelve a la cuadricula.
    if (!isRiver(row)) col = Math.round(col);
    col = Math.min(Math.max(col, 0), COLS - 1);
    if (row === frog.row && col === frog.col) return; // contra el borde: no hay salto

    state.hopFrom = { col: frog.col, row: frog.row };
    state.lastHopAt = now;
    frog.row = row;
    frog.col = col;
    frog.facing = dir;
    frog.ridingEntity = null;
    playSfx("hop");

    // Resultado segun la fila destino.
    if (row === HOME_ROW) {
      const slot = state.homeSlots.find((s) => col >= s.col && col < s.col + s.widthCells);
      if (!slot || slot.filled) {
        onDeath("splash"); // agua de la meta o nenufar ya ocupado
        return;
      }
      addProgress(row);
      slot.filled = true;
      state.score += POINTS_PER_HOME;
      playSfx("home");
      if (state.homeSlots.every((s) => s.filled)) {
        state.score += POINTS_PER_ROUND;
        resetRound();
      } else {
        resetLife();
      }
      return;
    }

    if (isRiver(row)) {
      frog.ridingEntity = supportAt(row, col);
      if (!frog.ridingEntity) {
        onDeath("splash"); // se ahoga
        return;
      }
    } else if (isRoad(row) && hitByVehicle(row, col)) {
      onDeath("squash");
      return;
    }

    addProgress(row);
  }

  /** Solo puntua el avance a filas no alcanzadas en la vida actual. */
  function addProgress(row: number) {
    if (row >= state.bestRowThisLife) return;
    state.score += POINTS_PER_ROW * (state.bestRowThisLife - row);
    state.bestRowThisLife = row;
  }

  function updateLanes(dt: number) {
    for (const lane of state.lanes) {
      const dx = lane.dir * lane.baseSpeed * state.speedMult * dt;
      for (const e of lane.entities) {
        e.x += dx;
        // Reciclado por el borde opuesto (scroll infinito).
        if (lane.dir > 0 && e.x >= CANVAS_W) e.x -= lane.spanPx;
        else if (lane.dir < 0 && e.x + e.widthCells * CELL <= 0) e.x += lane.spanPx;
      }
    }
  }

  function updateRiding(dt: number) {
    const frog = state.frog;
    if (!isRiver(frog.row)) return;
    const support = supportAt(frog.row, frog.col);
    frog.ridingEntity = support;
    if (!support) {
      onDeath("splash");
      return;
    }
    const lane = laneAt(frog.row)!;
    frog.col += (lane.dir * lane.baseSpeed * state.speedMult * dt) / CELL;
    if (frog.col < 0 || frog.col > COLS - 1) onDeath("splash"); // arrastrado fuera del tablero
  }

  function checkRoadCollision() {
    const frog = state.frog;
    if (isRoad(frog.row) && hitByVehicle(frog.row, frog.col)) onDeath("squash");
  }

  // ── Dibujo ──────────────────────────────────────────────────────────────────
  // Sprites con glow de NEON, rellenados la primera vez que se dibuja cada variante.
  const glowSprites = new Map<string, HTMLCanvasElement>();
  const glowSprite = (
    key: string,
    w: number,
    h: number,
    paint: (c: CanvasRenderingContext2D) => void,
  ) => {
    let s = glowSprites.get(key);
    if (!s) glowSprites.set(key, (s = bakeGlowSprite(w, h, paint)));
    return s;
  };

  /** Rectangulo con la franja clara superior de RETRO, si la skin la tiene. */
  function block(x: number, y: number, w: number, h: number, color: string) {
    const p = pal();
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
    if (p.topEdge) {
      ctx.fillStyle = p.topEdge;
      ctx.fillRect(x, y, w, 2);
    }
  }

  function drawBackground() {
    const p = pal();
    for (let row = 0; row < ROWS; row++) {
      const y = row * CELL;
      if (row === HOME_ROW || isRiver(row)) {
        ctx.fillStyle = p.water;
        ctx.fillRect(0, y, CANVAS_W, CELL);
        if (p.waves) {
          // Ondas: dos lineas finas por fila
          ctx.fillStyle = p.waves;
          ctx.fillRect(0, y + 11, CANVAS_W, 1);
          ctx.fillRect(0, y + 25, CANVAS_W, 1);
        }
      } else if (isRoad(row)) {
        ctx.fillStyle = p.asphalt;
        ctx.fillRect(0, y, CANVAS_W, CELL);
      } else {
        // Isla central, arcen y zona de salida
        ctx.fillStyle = p.grass;
        ctx.fillRect(0, y, CANVAS_W, CELL);
        ctx.fillStyle = p.grassEdge;
        ctx.fillRect(0, y, CANVAS_W, 2);
        ctx.fillRect(0, y + CELL - 2, CANVAS_W, 2);
      }
    }

    // Lineas discontinuas entre carriles de carretera
    if (!p.roadLine) return;
    ctx.fillStyle = p.roadLine;
    for (let row = 8; row <= 11; row++) {
      const y = row * CELL - 1;
      for (let x = 0; x < CANVAS_W; x += CELL) ctx.fillRect(x + 6, y, CELL / 2, 2);
    }
  }

  function drawHomeRow() {
    const p = pal();
    for (const slot of state.homeSlots) {
      const cx = (slot.col + slot.widthCells / 2) * CELL;
      const cy = HOME_ROW * CELL + CELL / 2;
      const color = slot.filled ? p.padFilled : p.pad;
      ctx.save();
      ctx.fillStyle = color;
      if (p.glow > 0) {
        ctx.shadowColor = color;
        ctx.shadowBlur = slot.filled ? p.glow : p.glow / 2;
      }
      ctx.beginPath();
      ctx.arc(cx, cy, CELL / 2 - 3, 0.25, Math.PI * 2 - 0.25); // muesca de nenufar
      ctx.lineTo(cx, cy);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      if (slot.filled) drawFrogShape(cx, cy, 0, 0.55);
    }
  }

  function drawLanes() {
    for (const lane of state.lanes) {
      const y = lane.row * CELL;
      for (const e of lane.entities) {
        const w = e.widthCells * CELL;
        if (e.x >= CANVAS_W || e.x + w <= 0) continue;
        if (lane.variant === "log") drawLog(e.x, y, w);
        else if (lane.variant === "turtles") drawTurtles(e.x, y, e.widthCells, lane.dir);
        else drawVehicle(e.x, y, w, lane);
      }
    }
  }

  function drawLog(x: number, y: number, w: number) {
    const p = pal();
    block(x + 2, y + 6, w - 4, CELL - 12, p.log);
    ctx.fillStyle = p.logDark;
    // Vetas y extremos del tronco
    ctx.fillRect(x + 2, y + 6, 4, CELL - 12);
    ctx.fillRect(x + w - 6, y + 6, 4, CELL - 12);
    for (let vx = x + 14; vx < x + w - 10; vx += 22) ctx.fillRect(vx, y + 13, 10, 2);
    for (let vx = x + 24; vx < x + w - 10; vx += 22) ctx.fillRect(vx, y + 21, 10, 2);
  }

  function drawTurtles(x: number, y: number, count: number, dir: number) {
    const p = pal();
    for (let i = 0; i < count; i++) {
      const cx = x + i * CELL + CELL / 2;
      const cy = y + CELL / 2;
      // Cabeza hacia el sentido de avance
      ctx.fillStyle = p.turtle;
      ctx.fillRect(cx + dir * 13 - 3, cy - 3, 6, 6);
      ctx.beginPath();
      ctx.arc(cx, cy, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = p.shell;
      ctx.beginPath();
      ctx.arc(cx, cy, 8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawVehicle(x: number, y: number, w: number, lane: Lane) {
    const p = pal();
    const color = p.vehicles[lane.row];
    if (p.glow > 0) {
      // NEON: el cuerpo con glow se hornea una vez por color y ancho.
      const glow = p.glow;
      const sprite = glowSprite(`veh:${color}:${w}:${glow}`, w, CELL, (c) => {
        c.shadowColor = color;
        c.shadowBlur = glow;
        c.fillStyle = color;
        c.fillRect(3, 7, w - 6, CELL - 14);
      });
      ctx.drawImage(sprite, x - SPRITE_PAD, y - SPRITE_PAD);
    } else {
      block(x + 3, y + 7, w - 6, CELL - 14, color);
    }

    // Cabina del camion: una franja oscura separa la cabeza del remolque
    if (lane.variant === "truck") {
      ctx.fillStyle = p.asphalt;
      const sep = lane.dir > 0 ? x + w - CELL + 2 : x + CELL - 4;
      ctx.fillRect(sep, y + 7, 2, CELL - 14);
    }

    // Par de faros en el frontal
    ctx.fillStyle = p.headlight;
    const fx = lane.dir > 0 ? x + w - 7 : x + 3;
    ctx.fillRect(fx, y + 9, 4, 4);
    ctx.fillRect(fx, y + CELL - 13, 4, 4);
  }

  /** Sapo de bloques centrado en (cx, cy), mirando hacia `angle`. */
  function drawFrogShape(cx: number, cy: number, angle: number, scale: number) {
    const p = pal();
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.scale(scale, scale);

    if (p.glow > 0) {
      ctx.shadowColor = p.frog;
      ctx.shadowBlur = p.glow;
    }
    ctx.fillStyle = p.frog;
    ctx.fillRect(-15, -13, 6, 8); // patas delanteras
    ctx.fillRect(9, -13, 6, 8);
    ctx.fillRect(-15, 6, 6, 9); // patas traseras
    ctx.fillRect(9, 6, 6, 9);
    block(-10, -11, 20, 22, p.frog); // cuerpo

    ctx.shadowBlur = 0;
    ctx.fillStyle = p.eye;
    ctx.fillRect(-9, -14, 7, 7); // ojos
    ctx.fillRect(2, -14, 7, 7);
    ctx.fillStyle = p.pupil;
    ctx.fillRect(-7, -13, 3, 3);
    ctx.fillRect(4, -13, 3, 3);
    ctx.restore();
  }

  function drawFrog(now: number) {
    const frog = state.frog;
    // Interpola la posicion y da un pequeno bote durante la animacion del salto.
    const t = Math.min(1, (now - state.lastHopAt) / HOP_MS);
    const col = state.hopFrom.col + (frog.col - state.hopFrom.col) * t;
    const row = state.hopFrom.row + (frog.row - state.hopFrom.row) * t;
    const bump = 1 + 0.15 * Math.sin(Math.PI * t);
    drawFrogShape((col + 0.5) * CELL, (row + 0.5) * CELL, ANGLE[frog.facing], bump);
  }

  function draw(now: number) {
    drawBackground();
    drawHomeRow();
    drawLanes();
    drawFrog(now);
  }

  // ── Notificacion a React ────────────────────────────────────────────────────
  let lastScore = NaN;
  let lastLives = NaN;
  let lastLevel = NaN;
  let overReported = false;

  function notify() {
    const cb = callbacksRef.current;
    if (state.score !== lastScore) cb.onScoreChange((lastScore = state.score));
    if (state.lives !== lastLives) cb.onLivesChange((lastLives = state.lives));
    if (state.level !== lastLevel) cb.onLevelChange((lastLevel = state.level));
    if (state.over && !overReported) {
      overReported = true;
      cancelAnimationFrame(frame);
      cb.onGameOver(state.score);
    }
  }

  // ── Input ───────────────────────────────────────────────────────────────────
  // Sin esto, el preventDefault se tragaria las letras WASD del campo de nombre
  // del modal de fin de partida.
  const isEditable = (t: EventTarget | null) =>
    t instanceof HTMLElement &&
    (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName));

  const onKeyDown = (e: KeyboardEvent) => {
    if (isEditable(e.target) || state.over) return;
    if (e.code === "KeyP" || e.code === "Escape") {
      e.preventDefault();
      if (!e.repeat) callbacksRef.current.onPauseToggle();
      return;
    }
    const dir = KEY_DIR[e.code];
    if (!dir) return;
    // Evita el scroll de la pagina con las flechas.
    e.preventDefault();
    if (e.repeat || pausedRef.current) return;
    tryHop(dir, performance.now());
  };

  document.addEventListener("keydown", onKeyDown);

  // ── Bucle principal ─────────────────────────────────────────────────────────
  let frame = 0;
  let last = performance.now();
  // Skin del ultimo frame pintado en pausa: mientras no cambie, el canvas
  // congelado sigue valiendo y no hace falta repintarlo.
  let pausedSkin: Skin | null = null;

  function loop(now: number) {
    // Tope de 50 ms por frame: tras un cambio de pestana nada da un salto brusco.
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;

    // En pausa el tiempo no avanza; al reanudar, dt parte de cero.
    if (!pausedRef.current && !state.over) {
      updateLanes(dt);
      updateRiding(dt);
      if (!state.over) checkRoadCollision();
    }

    if (pausedRef.current) {
      if (pausedSkin !== skinRef.current) {
        draw(now);
        pausedSkin = skinRef.current;
      }
    } else {
      pausedSkin = null;
      draw(now);
    }
    notify();

    if (!state.over) frame = requestAnimationFrame(loop);
  }

  frame = requestAnimationFrame(loop);

  return () => {
    cancelAnimationFrame(frame);
    document.removeEventListener("keydown", onKeyDown);
  };
}
