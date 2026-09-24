"use client";

// Snake escrito desde cero (SPEC 09): no hay codigo de referencia, solo los
// sprites de fruta de references/source-assets/snake-assets/. Tablero de 24x18
// celdas de 30 px (4:3, llena la pantalla CRT); la serpiente espera a la primera tecla de direccion y
// avanza por pasos discretos que se acortan con el nivel. La pausa llega por
// prop (P y Escape la piden con onPauseToggle) y puntuacion/longitud/nivel se
// notifican por callback en lugar de pintarse. Solo queda en el canvas el
// aviso "Pulsa una dirección"; PAUSA y fin de partida los pone la plataforma.

import { useEffect, useRef } from "react";

interface SnakeGameProps {
  paused: boolean;
  onScoreChange: (score: number) => void;
  onLengthChange: (length: number) => void; // celdas de la serpiente, empieza en 3
  onLevelChange: (level: number) => void;
  onPauseToggle: () => void; // teclas P y Escape
  onGameOver: (finalScore: number) => void;
}

type Callbacks = Omit<SnakeGameProps, "paused">;

const ASSETS = "/games/snake";

// ── Constantes ────────────────────────────────────────────────────────────────
const COLS = 24;
const ROWS = 18;
const CELL = 30;
const CANVAS_W = COLS * CELL; // 720
const CANVAS_H = ROWS * CELL; // 540

const BASE_STEP_MS = 150;
const MIN_STEP_MS = 60;
const STEP_FACTOR = 0.9; // cada nivel, un 10 % mas rapido
const FRUITS_PER_LEVEL = 5;
const POINTS_PER_FRUIT = 10;
const START_LENGTH = 3;
const MAX_QUEUED_TURNS = 2;

const FRUIT_SIZE = CELL - 4; // 26 px de alto, 2 px de margen

const COLOR_BG = "#0a0a0f"; // --bg
const COLOR_GRID = "rgba(0, 255, 136, 0.07)";
const COLOR_BODY = "#00ff88"; // --green
const COLOR_HEAD = "#9dffd0";
const COLOR_EYE = "#0a0a0f";

// Recortes de la fila de pixel art de fruits.png (sprites.js, y=136, h=160).
const FRUITS = {
  banana: { x: 34, y: 136, w: 110, h: 160 },
  orange: { x: 186, y: 136, w: 150, h: 160 },
  grape: { x: 378, y: 136, w: 110, h: 160 },
  garlic: { x: 540, y: 136, w: 130, h: 160 },
  eggplant: { x: 712, y: 136, w: 130, h: 160 },
  strawberry: { x: 894, y: 136, w: 110, h: 160 },
  cherry: { x: 1066, y: 136, w: 110, h: 160 },
  carrot: { x: 1228, y: 136, w: 130, h: 160 },
  mushroom: { x: 1400, y: 136, w: 130, h: 160 },
  broccoli: { x: 1582, y: 136, w: 110, h: 160 },
  watermelon: { x: 1734, y: 136, w: 150, h: 160 },
  pepper: { x: 1906, y: 136, w: 150, h: 160 },
  kiwi: { x: 2068, y: 136, w: 170, h: 160 },
  lemon: { x: 2250, y: 136, w: 140, h: 160 },
  peach: { x: 2432, y: 136, w: 130, h: 160 },
  peanut: { x: 2604, y: 136, w: 130, h: 160 },
  apple: { x: 2786, y: 136, w: 110, h: 160 },
  tomato: { x: 2948, y: 136, w: 130, h: 160 },
  berries: { x: 3110, y: 136, w: 150, h: 160 },
  grapes2: { x: 3302, y: 136, w: 110, h: 160 },
  pineapple: { x: 3454, y: 136, w: 150, h: 160 },
  melon: { x: 3637, y: 136, w: 130, h: 160 },
} as const;

type FruitName = keyof typeof FRUITS;
const FRUIT_NAMES = Object.keys(FRUITS) as FruitName[];

type Cell = { x: number; y: number }; // x 0..23, y 0..17, origen arriba a la izquierda
type Dir = "up" | "down" | "left" | "right";

const DELTA: Record<Dir, Cell> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const OPPOSITE: Record<Dir, Dir> = { up: "down", down: "up", left: "right", right: "left" };

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

export default function SnakeGame({ paused, ...callbacks }: SnakeGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pausedRef = useRef(paused);
  const callbacksRef = useRef<Callbacks>(callbacks);

  useEffect(() => {
    pausedRef.current = paused;
    callbacksRef.current = callbacks;
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    return startGame(canvas, pausedRef, callbacksRef);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_W}
      height={CANVAS_H}
      className="block aspect-[4/3] h-auto w-full max-w-full bg-black [image-rendering:pixelated]"
      aria-label="Snake: flechas o WASD para cambiar de dirección"
    />
  );
}

/** Arranca el juego sobre el canvas y devuelve la funcion de limpieza. */
function startGame(
  canvas: HTMLCanvasElement,
  pausedRef: { current: boolean },
  callbacksRef: { current: Callbacks },
): () => void {
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;

  let sheet: HTMLImageElement | null = null;

  const state = {
    snake: [] as Cell[], // snake[0] es la cabeza
    dir: "right" as Dir,
    queue: [] as Dir[], // giros pendientes, max. 2
    food: null as { cell: Cell; sprite: FruitName } | null,
    score: 0,
    level: 1,
    eaten: 0, // frutas comidas; nivel = 1 + floor(eaten / 5)
    started: false, // false hasta la primera tecla de direccion
    over: false,
    lastStep: 0, // timestamp del ultimo paso
  };

  // ── Logica ──────────────────────────────────────────────────────────────────
  function resetGame() {
    const cx = Math.floor(COLS / 2);
    const cy = Math.floor(ROWS / 2);
    state.snake = Array.from({ length: START_LENGTH }, (_, i) => ({ x: cx - i, y: cy }));
    state.dir = "right";
    state.queue = [];
    state.score = 0;
    state.level = 1;
    state.eaten = 0;
    state.started = false;
    state.over = false;
    spawnFruit();
  }

  /** Coloca una fruta al azar en una celda libre. Devuelve false si no queda ninguna. */
  function spawnFruit(): boolean {
    const occupied = new Set(state.snake.map((c) => c.y * COLS + c.x));
    const free: Cell[] = [];
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (!occupied.has(y * COLS + x)) free.push({ x, y });
      }
    }
    if (free.length === 0) {
      state.food = null;
      return false;
    }
    state.food = {
      cell: free[Math.floor(Math.random() * free.length)],
      sprite: FRUIT_NAMES[Math.floor(Math.random() * FRUIT_NAMES.length)],
    };
    return true;
  }

  const stepMs = () =>
    Math.max(MIN_STEP_MS, BASE_STEP_MS * STEP_FACTOR ** (state.level - 1));

  function step() {
    state.dir = state.queue.shift() ?? state.dir;
    const head = state.snake[0];
    const next = { x: head.x + DELTA[state.dir].x, y: head.y + DELTA[state.dir].y };

    if (next.x < 0 || next.x >= COLS || next.y < 0 || next.y >= ROWS) {
      state.over = true;
      return;
    }

    const food = state.food;
    const eating = food !== null && food.cell.x === next.x && food.cell.y === next.y;
    // Si no come, la cola se mueve a la vez que la cabeza: su celda cuenta como libre.
    const body = eating ? state.snake : state.snake.slice(0, -1);
    if (body.some((c) => c.x === next.x && c.y === next.y)) {
      state.over = true;
      return;
    }

    state.snake.unshift(next);
    if (!eating) {
      state.snake.pop();
      return;
    }

    state.score += POINTS_PER_FRUIT * state.level;
    state.eaten++;
    state.level = 1 + Math.floor(state.eaten / FRUITS_PER_LEVEL);
    if (!spawnFruit()) state.over = true;
  }

  // ── Dibujo ──────────────────────────────────────────────────────────────────
  function drawGrid() {
    ctx.fillStyle = COLOR_BG;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.strokeStyle = COLOR_GRID;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 1; i < COLS; i++) {
      const x = i * CELL + 0.5;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, CANVAS_H);
    }
    for (let i = 1; i < ROWS; i++) {
      const y = i * CELL + 0.5;
      ctx.moveTo(0, y);
      ctx.lineTo(CANVAS_W, y);
    }
    ctx.stroke();
  }

  function drawFruit() {
    if (!state.food || !sheet) return;
    const src = FRUITS[state.food.sprite];
    const h = FRUIT_SIZE;
    const w = Math.round((src.w * h) / src.h);
    const x = state.food.cell.x * CELL + Math.round((CELL - w) / 2);
    const y = state.food.cell.y * CELL + (CELL - h) / 2;
    ctx.drawImage(sheet, src.x, src.y, src.w, src.h, x, y, w, h);
  }

  function drawSnake() {
    ctx.save();
    ctx.shadowColor = COLOR_BODY;
    ctx.shadowBlur = 12;
    for (let i = state.snake.length - 1; i >= 0; i--) {
      const c = state.snake[i];
      ctx.fillStyle = i === 0 ? COLOR_HEAD : COLOR_BODY;
      ctx.fillRect(c.x * CELL + 2, c.y * CELL + 2, CELL - 4, CELL - 4);
    }
    ctx.restore();

    // Ojos: dos cuadritos hacia la direccion de avance.
    const head = state.snake[0];
    const d = DELTA[state.dir];
    const cx = head.x * CELL + CELL / 2;
    const cy = head.y * CELL + CELL / 2;
    const eye = 5;
    const ahead = 5;
    const side = 6;
    ctx.fillStyle = COLOR_EYE;
    for (const s of [-1, 1]) {
      const ex = cx + d.x * ahead + (d.y !== 0 ? s * side : 0);
      const ey = cy + d.y * ahead + (d.x !== 0 ? s * side : 0);
      ctx.fillRect(Math.round(ex - eye / 2), Math.round(ey - eye / 2), eye, eye);
    }
  }

  // Solo el aviso de espera: PAUSA y fin de partida los muestra la plataforma.
  function drawOverlay() {
    if (state.started || state.over) return;
    ctx.fillStyle = "#fff";
    ctx.font = "bold 22px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Pulsa una dirección", CANVAS_W / 2, CANVAS_H / 2 - 3 * CELL);
  }

  function draw() {
    drawGrid();
    drawFruit();
    drawSnake();
    drawOverlay();
  }

  // ── Notificacion a React ────────────────────────────────────────────────────
  let lastScore = NaN;
  let lastLength = NaN;
  let lastLevel = NaN;
  let overReported = false;

  function notify() {
    const cb = callbacksRef.current;
    if (state.score !== lastScore) cb.onScoreChange((lastScore = state.score));
    if (state.snake.length !== lastLength) cb.onLengthChange((lastLength = state.snake.length));
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
    if (pausedRef.current) return;

    if (!state.started) {
      // Arranca con cualquier direccion salvo la de 180 grados (hacia el cuerpo).
      if (dir === OPPOSITE[state.dir]) return;
      state.started = true;
      state.lastStep = performance.now();
      if (dir !== state.dir) state.queue.push(dir);
      return;
    }

    // Se compara con el ultimo giro encolado, no con la direccion actual, para
    // que dos giros rapidos en el mismo paso se apliquen ambos y en orden.
    const last = state.queue.at(-1) ?? state.dir;
    if (dir === last || dir === OPPOSITE[last]) return;
    if (state.queue.length < MAX_QUEUED_TURNS) state.queue.push(dir);
  };

  document.addEventListener("keydown", onKeyDown);

  // ── Bucle principal ─────────────────────────────────────────────────────────
  let frame = 0;
  let wasPaused = false;
  let disposed = false;

  function loop(now: number) {
    if (pausedRef.current) {
      wasPaused = true;
    } else {
      // Al reanudar se reinicia el reloj del paso para que la serpiente no salte.
      if (wasPaused) {
        wasPaused = false;
        state.lastStep = now;
      }
      if (state.started && now - state.lastStep >= stepMs()) {
        state.lastStep = now;
        step();
      }
    }

    draw();
    notify();

    if (!state.over) frame = requestAnimationFrame(loop);
  }

  resetGame();

  // El juego arranca cuando la hoja de frutas esta cargada.
  const img = new Image();
  img.onload = () => {
    if (disposed) return;
    sheet = img;
    frame = requestAnimationFrame(loop);
  };
  img.onerror = () => console.error("No se pudo cargar la hoja de frutas de Snake");
  img.src = `${ASSETS}/fruits.png`;

  return () => {
    disposed = true;
    cancelAnimationFrame(frame);
    document.removeEventListener("keydown", onKeyDown);
  };
}
