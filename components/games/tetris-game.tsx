"use client";

// Tetris (references/03-tetris/game.js) dentro de un componente React.
// La mecanica es la del original (7 piezas estandar, wall kicks, ghost,
// soft/hard drop, puntuacion clasica por nivel); los cambios son: skin Retro
// fija, nivel inicial 1, la pausa llega por prop (P y Escape la piden con
// onPauseToggle), puntuacion/lineas/nivel se notifican por callback en lugar de
// pintarse, y no hay records, menus ni overlays: los pone la plataforma.

import { useEffect, useRef } from "react";

interface TetrisGameProps {
  paused: boolean;
  onScoreChange: (score: number) => void;
  onLinesChange: (lines: number) => void;
  onLevelChange: (level: number) => void;
  onPauseToggle: () => void; // teclas P y Escape
  onGameOver: (finalScore: number) => void;
}

type Callbacks = Omit<TetrisGameProps, "paused">;

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;
const W = COLS * BLOCK; // 300
const H = ROWS * BLOCK; // 600
const NEXT_SIZE = 120;
const NEXT_BLOCK = 30;

const PIECES: number[][][] = [
  [],
  [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]], // I
  [[2, 2], [2, 2]], // O
  [[0, 3, 0], [3, 3, 3], [0, 0, 0]], // T
  [[0, 4, 4], [4, 4, 0], [0, 0, 0]], // S
  [[5, 5, 0], [0, 5, 5], [0, 0, 0]], // Z
  [[6, 0, 0], [6, 6, 6], [0, 0, 0]], // J
  [[0, 0, 7], [7, 7, 7], [0, 0, 0]], // L
];

const LINE_SCORES = [0, 100, 300, 500, 800];
const DROP_BASE_MS = 700; // intervalo de caida en nivel 1 (el original usaba 1000)
const DROP_LEVEL_FACTOR = 0.85; // cada nivel multiplica el intervalo por este factor
const DROP_MIN_MS = 60;
const GAME_KEYS = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space", "KeyX"];

// Skin Retro del original con los colores del tema oscuro.
const COLORS = [
  "",
  "#4dd0e1",
  "#ffd54f",
  "#ba68c8",
  "#81c784",
  "#e57373",
  "#90caf9",
  "#ffb74d",
];
const BOARD_BG = "#1a1a25";
const GRID_COLOR = "#22222e";
const GHOST_ALPHA = 0.2;

export default function TetrisGame({ paused, ...callbacks }: TetrisGameProps) {
  const boardRef = useRef<HTMLCanvasElement>(null);
  const nextRef = useRef<HTMLCanvasElement>(null);
  const pausedRef = useRef(paused);
  const callbacksRef = useRef<Callbacks>(callbacks);

  useEffect(() => {
    pausedRef.current = paused;
    callbacksRef.current = callbacks;
  });

  useEffect(() => {
    const board = boardRef.current;
    const next = nextRef.current;
    if (!board || !next) return;
    return startGame(board, next, pausedRef, callbacksRef);
  }, []);

  return (
    <div className="absolute inset-0 flex items-center justify-center gap-4 p-4">
      <canvas
        ref={boardRef}
        width={W}
        height={H}
        className="block h-full w-auto"
        aria-label="Tetris: flechas para mover, arriba o X para rotar, abajo para bajar, espacio para soltar"
      />
      <div className="flex flex-col items-center gap-2 self-start pt-2">
        <span className="font-(family-name:--pixel) text-[10px] tracking-widest text-(--ink-dim)">
          SIGUIENTE
        </span>
        <canvas
          ref={nextRef}
          width={NEXT_SIZE}
          height={NEXT_SIZE}
          className="block h-auto w-20 sm:w-28"
          aria-label="Siguiente pieza"
        />
      </div>
    </div>
  );
}

interface Piece {
  shape: number[][];
  x: number;
  y: number;
}

/** Arranca el juego sobre los dos canvas y devuelve la funcion de limpieza. */
function startGame(
  boardCanvas: HTMLCanvasElement,
  nextCanvas: HTMLCanvasElement,
  pausedRef: { current: boolean },
  callbacksRef: { current: Callbacks },
): () => void {
  const ctx = boardCanvas.getContext("2d")!;
  const nextCtx = nextCanvas.getContext("2d")!;

  // ── Estado ──────────────────────────────────────────────────────────────────
  const board: number[][] = Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
  let score = 0;
  let lines = 0;
  let level = 1;
  let dropInterval = intervalForLevel(level);
  let dropAccum = 0;
  let gameOver = false;
  let current: Piece = randomPiece();
  let next: Piece = randomPiece();

  // Caida: 700 ms en nivel 1 y un 15 % mas rapida en cada nivel, con suelo de 60 ms.
  function intervalForLevel(lv: number) {
    return Math.max(DROP_MIN_MS, DROP_BASE_MS * Math.pow(DROP_LEVEL_FACTOR, lv - 1));
  }

  function randomPiece(): Piece {
    const type = Math.floor(Math.random() * 7) + 1;
    const shape = PIECES[type].map((row) => [...row]);
    return { shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
  }

  // ── Mecanica ────────────────────────────────────────────────────────────────
  function collide(shape: number[][], ox: number, oy: number) {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        const nx = ox + c;
        const ny = oy + r;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
        if (ny >= 0 && board[ny][nx]) return true;
      }
    }
    return false;
  }

  function rotateCW(shape: number[][]) {
    const rows = shape.length;
    const cols = shape[0].length;
    const result = Array.from({ length: cols }, () => new Array<number>(rows).fill(0));
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) result[c][rows - 1 - r] = shape[r][c];
    return result;
  }

  function tryRotate() {
    const rotated = rotateCW(current.shape);
    for (const kick of [0, -1, 1, -2, 2]) {
      if (!collide(rotated, current.x + kick, current.y)) {
        current.shape = rotated;
        current.x += kick;
        return;
      }
    }
  }

  function merge() {
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        if (current.shape[r][c]) board[current.y + r][current.x + c] = current.shape[r][c];
  }

  function clearLines() {
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (board[r].every((v) => v !== 0)) {
        board.splice(r, 1);
        board.unshift(new Array(COLS).fill(0));
        cleared++;
        r++;
      }
    }
    if (cleared) {
      lines += cleared;
      score += (LINE_SCORES[cleared] || 0) * level;
      level = Math.floor(lines / 10) + 1;
      dropInterval = intervalForLevel(level);
    }
  }

  function ghostY() {
    let gy = current.y;
    while (!collide(current.shape, current.x, gy + 1)) gy++;
    return gy;
  }

  function hardDrop() {
    const gy = ghostY();
    score += (gy - current.y) * 2;
    current.y = gy;
    lockPiece();
  }

  function softDrop() {
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
      score += 1;
    } else {
      lockPiece();
    }
  }

  function lockPiece() {
    merge();
    clearLines();
    spawn();
  }

  function spawn() {
    current = next;
    next = randomPiece();
    if (collide(current.shape, current.x, current.y)) gameOver = true;
    drawNext();
  }

  // ── Dibujo (skin Retro) ─────────────────────────────────────────────────────
  function drawBlock(c: CanvasRenderingContext2D, x: number, y: number, size: number, color: string, alpha = 1) {
    c.save();
    c.globalAlpha = alpha;
    c.fillStyle = color;
    c.fillRect(x + 1, y + 1, size - 2, size - 2);
    c.fillStyle = "rgba(255,255,255,0.12)"; // highlight
    c.fillRect(x + 1, y + 1, size - 2, 4);
    c.restore();
  }

  function drawCell(c: CanvasRenderingContext2D, col: number, row: number, colorIndex: number, size: number, alpha?: number) {
    if (!colorIndex) return;
    drawBlock(c, col * size, row * size, size, COLORS[colorIndex], alpha);
  }

  function drawGrid() {
    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 0.5;
    for (let c = 1; c < COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(c * BLOCK, 0);
      ctx.lineTo(c * BLOCK, H);
      ctx.stroke();
    }
    for (let r = 1; r < ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * BLOCK);
      ctx.lineTo(W, r * BLOCK);
      ctx.stroke();
    }
  }

  function draw() {
    ctx.fillStyle = BOARD_BG;
    ctx.fillRect(0, 0, W, H);
    drawGrid();

    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) drawCell(ctx, c, r, board[r][c], BLOCK);

    // En game over la ultima pieza ya esta fusionada; la nueva (que colisiona) no se pinta.
    if (gameOver) return;

    const gy = ghostY();
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        if (current.shape[r][c]) drawCell(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, GHOST_ALPHA);

    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        drawCell(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
  }

  function drawNext() {
    nextCtx.fillStyle = BOARD_BG;
    nextCtx.fillRect(0, 0, NEXT_SIZE, NEXT_SIZE);
    const shape = next.shape;
    const offX = Math.floor((4 - shape[0].length) / 2);
    const offY = Math.floor((4 - shape.length) / 2);
    for (let r = 0; r < shape.length; r++)
      for (let c = 0; c < shape[r].length; c++) drawCell(nextCtx, offX + c, offY + r, shape[r][c], NEXT_BLOCK);
  }

  // ── Notificacion a React ────────────────────────────────────────────────────
  let lastScore = NaN;
  let lastLines = NaN;
  let lastLevel = NaN;
  let overReported = false;

  function notify() {
    const cb = callbacksRef.current;
    if (score !== lastScore) cb.onScoreChange((lastScore = score));
    if (lines !== lastLines) cb.onLinesChange((lastLines = lines));
    if (level !== lastLevel) cb.onLevelChange((lastLevel = level));
    if (gameOver && !overReported) {
      overReported = true;
      cancelAnimationFrame(frame);
      cb.onGameOver(score);
    }
  }

  // ── Input ───────────────────────────────────────────────────────────────────
  // Sin esto, el preventDefault se tragaria los espacios del campo de nombre
  // del modal de fin de partida.
  const isEditable = (t: EventTarget | null) =>
    t instanceof HTMLElement &&
    (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName));

  const onKeyDown = (e: KeyboardEvent) => {
    if (isEditable(e.target) || gameOver) return;
    if (e.code === "KeyP" || e.code === "Escape") {
      e.preventDefault();
      if (!e.repeat) callbacksRef.current.onPauseToggle();
      return;
    }
    if (!GAME_KEYS.includes(e.code)) return;
    // Evita el scroll y que Espacio active el boton de la plataforma con foco.
    e.preventDefault();
    if (pausedRef.current) return;
    switch (e.code) {
      case "ArrowLeft":
        if (!collide(current.shape, current.x - 1, current.y)) current.x--;
        break;
      case "ArrowRight":
        if (!collide(current.shape, current.x + 1, current.y)) current.x++;
        break;
      case "ArrowDown":
        softDrop();
        break;
      case "ArrowUp":
      case "KeyX":
        tryRotate();
        break;
      case "Space":
        hardDrop();
        break;
    }
    draw();
    notify();
  };

  const onKeyUp = (e: KeyboardEvent) => {
    if (isEditable(e.target)) return;
    if (GAME_KEYS.includes(e.code)) e.preventDefault();
  };

  document.addEventListener("keydown", onKeyDown);
  document.addEventListener("keyup", onKeyUp);

  // ── Bucle principal ─────────────────────────────────────────────────────────
  let lastTime: number | null = null;
  let frame = 0;

  function loop(ts: number) {
    const dt = lastTime === null ? 0 : ts - lastTime;
    lastTime = ts;
    if (!pausedRef.current) {
      dropAccum += dt;
      if (dropAccum >= dropInterval) {
        dropAccum = 0;
        if (!collide(current.shape, current.x, current.y + 1)) current.y++;
        else lockPiece();
      }
    }
    draw();
    notify();
    if (!gameOver) frame = requestAnimationFrame(loop);
  }

  drawNext();
  draw();
  notify();
  frame = requestAnimationFrame(loop);

  return () => {
    cancelAnimationFrame(frame);
    document.removeEventListener("keydown", onKeyDown);
    document.removeEventListener("keyup", onKeyUp);
  };
}
