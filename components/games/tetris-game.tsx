"use client";

// Tetris (references/start-games/03-tetris/game.js) dentro de un componente React.
// La mecanica es la del original (7 piezas estandar, wall kicks, ghost,
// soft/hard drop, puntuacion clasica por nivel); los cambios son: tres skins
// (NEON, RETRO y CLASICO) elegidas por prop, nivel inicial 1, la pausa llega por prop (P y Escape la piden con
// onPauseToggle), puntuacion/lineas/nivel se notifican por callback en lugar de
// pintarse, y no hay records, menus ni overlays: los pone la plataforma.

import { useEffect, useRef } from "react";
import { playSfx } from "@/lib/audio";
import type { Skin } from "@/lib/skins";

interface TetrisGameProps {
  paused: boolean;
  skin: Skin;
  onScoreChange: (score: number) => void;
  onLinesChange: (lines: number) => void;
  onLevelChange: (level: number) => void;
  onPauseToggle: () => void; // teclas P y Escape
  onGameOver: (finalScore: number) => void;
}

type Callbacks = Omit<TetrisGameProps, "paused" | "skin">;

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

// Paleta y estilo de bloque de cada skin. `pieces` va indexado por tipo de
// pieza (1..7 = I O T S Z J L); `grid` null = sin rejilla.
//   glow   → NEON: relleno con shadowBlur, fantasma como contorno brillante
//   flat   → RETRO: bloque plano con franja clara arriba, fantasma translucido
//   bevel  → CLASICO: bloque biselado claro/oscuro, fantasma como contorno blanco
interface Palette {
  boardBg: string;
  grid: string | null;
  pieces: string[];
  block: "glow" | "flat" | "bevel";
}

const PALETTES: Record<Skin, Palette> = {
  neon: {
    boardBg: "#0a0a0f",
    grid: "rgba(0,245,255,0.10)",
    pieces: ["", "#00f5ff", "#f5ff00", "#ff006e", "#00ff88", "#ff2b4d", "#2e6bff", "#ff8c00"],
    block: "glow",
  },
  // La skin Retro del original con los colores del tema oscuro.
  retro: {
    boardBg: "#1a1a25",
    grid: "#22222e",
    pieces: ["", "#4dd0e1", "#ffd54f", "#ba68c8", "#81c784", "#e57373", "#90caf9", "#ffb74d"],
    block: "flat",
  },
  clasico: {
    boardBg: "#000000",
    grid: null,
    pieces: ["", "#00f0f0", "#f0f000", "#a000f0", "#00f000", "#f00000", "#0000f0", "#f0a000"],
    block: "bevel",
  },
};

const GHOST_ALPHA = 0.2;

// Margen alrededor del sprite para que el glow no se recorte.
const SPRITE_PAD = 20;

function bakeGlowSprite(w: number, h: number, paint: (c: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement("canvas");
  canvas.width = w + SPRITE_PAD * 2;
  canvas.height = h + SPRITE_PAD * 2;
  const c = canvas.getContext("2d")!;
  c.translate(SPRITE_PAD, SPRITE_PAD);
  paint(c);
  return canvas;
}

export default function TetrisGame({ paused, skin, ...callbacks }: TetrisGameProps) {
  const boardRef = useRef<HTMLCanvasElement>(null);
  const nextRef = useRef<HTMLCanvasElement>(null);
  const pausedRef = useRef(paused);
  const skinRef = useRef(skin);
  const callbacksRef = useRef<Callbacks>(callbacks);

  useEffect(() => {
    pausedRef.current = paused;
    skinRef.current = skin;
    callbacksRef.current = callbacks;
  });

  useEffect(() => {
    const board = boardRef.current;
    const next = nextRef.current;
    if (!board || !next) return;
    return startGame(board, next, pausedRef, skinRef, callbacksRef);
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
  skinRef: { current: Skin },
  callbacksRef: { current: Callbacks },
): () => void {
  const ctx = boardCanvas.getContext("2d")!;
  const nextCtx = nextCanvas.getContext("2d")!;
  const pal = () => PALETTES[skinRef.current];

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

  /** true si la pieza ha podido girar (con o sin desplazamiento lateral). */
  function tryRotate(): boolean {
    const rotated = rotateCW(current.shape);
    for (const kick of [0, -1, 1, -2, 2]) {
      if (!collide(rotated, current.x + kick, current.y)) {
        current.shape = rotated;
        current.x += kick;
        return true;
      }
    }
    return false;
  }

  /** Mueve la pieza en horizontal; suena el paso o el golpe contra el borde (SPEC 16). */
  function shift(dx: number) {
    if (collide(current.shape, current.x + dx, current.y)) {
      playSfx("bump");
      return;
    }
    current.x += dx;
    playSfx("move");
  }

  function merge() {
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        if (current.shape[r][c]) board[current.y + r][current.x + c] = current.shape[r][c];
  }

  /** Borra las líneas completas y devuelve cuántas eran. */
  function clearLines(): number {
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
    return cleared;
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
    playSfx("harddrop");
    lockPiece(false);
  }

  function softDrop() {
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
      score += 1;
      playSfx("soft");
    } else {
      lockPiece();
    }
  }

  /** Fija la pieza. Suena el tetris, la línea o el golpe de encaje (la caída rápida ya trae el suyo). */
  function lockPiece(thud = true) {
    merge();
    const cleared = clearLines();
    if (cleared === 4) playSfx("tetris");
    else if (cleared > 0) playSfx("line");
    else if (thud) playSfx("lock");
    spawn();
  }

  function spawn() {
    current = next;
    next = randomPiece();
    if (collide(current.shape, current.x, current.y)) gameOver = true;
    drawNext();
  }

  // ── Dibujo ──────────────────────────────────────────────────────────────────
  // Sprites con glow de NEON, horneados la primera vez que se usa cada variante.
  const glowSprites = new Map<string, HTMLCanvasElement>();
  const glowSprite = (key: string, w: number, h: number, paint: (c: CanvasRenderingContext2D) => void) => {
    let s = glowSprites.get(key);
    if (!s) glowSprites.set(key, (s = bakeGlowSprite(w, h, paint)));
    return s;
  };

  function drawBlock(c: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
    const style = pal().block;
    if (style === "glow") {
      const sprite = glowSprite(`block:${color}:${size}`, size, size, (s) => {
        s.fillStyle = color;
        s.shadowColor = color;
        s.shadowBlur = 10;
        s.fillRect(2, 2, size - 4, size - 4);
      });
      c.drawImage(sprite, x - SPRITE_PAD, y - SPRITE_PAD);
      return;
    }
    c.save();
    c.fillStyle = color;

    if (style === "flat") {
      c.fillRect(x + 1, y + 1, size - 2, size - 2);
      c.fillStyle = "rgba(255,255,255,0.12)"; // highlight
      c.fillRect(x + 1, y + 1, size - 2, 4);
    } else {
      // Bisel: luz arriba a la izquierda, sombra abajo a la derecha
      const b = Math.max(2, Math.round(size / 10));
      c.fillRect(x, y, size, size);
      c.fillStyle = "rgba(255,255,255,0.55)";
      c.fillRect(x, y, size, b);
      c.fillRect(x, y, b, size);
      c.fillStyle = "rgba(0,0,0,0.45)";
      c.fillRect(x, y + size - b, size, b);
      c.fillRect(x + size - b, y, b, size);
    }
    c.restore();
  }

  // La pieza fantasma: contorno en NEON y CLASICO, bloque translucido en RETRO.
  function drawGhostBlock(x: number, y: number, color: string) {
    const style = pal().block;
    ctx.save();
    if (style === "flat") {
      ctx.globalAlpha = GHOST_ALPHA;
      ctx.fillStyle = color;
      ctx.fillRect(x + 1, y + 1, BLOCK - 2, BLOCK - 2);
    } else if (style === "glow") {
      ctx.globalAlpha = 0.45;
      const sprite = glowSprite(`ghost:${color}`, BLOCK, BLOCK, (s) => {
        s.strokeStyle = color;
        s.shadowColor = color;
        s.shadowBlur = 6;
        s.lineWidth = 1.5;
        s.strokeRect(3.5, 3.5, BLOCK - 7, BLOCK - 7);
      });
      ctx.drawImage(sprite, x - SPRITE_PAD, y - SPRITE_PAD);
    } else {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 1.5, y + 1.5, BLOCK - 3, BLOCK - 3);
    }
    ctx.restore();
  }

  function drawCell(c: CanvasRenderingContext2D, col: number, row: number, colorIndex: number, size: number) {
    if (!colorIndex) return;
    drawBlock(c, col * size, row * size, size, pal().pieces[colorIndex]);
  }

  function drawGrid() {
    const grid = pal().grid;
    if (!grid) return;
    ctx.strokeStyle = grid;
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
    // El panel de siguiente pieza tambien se repinta, para seguir los cambios de skin.
    drawNext();
    ctx.fillStyle = pal().boardBg;
    ctx.fillRect(0, 0, W, H);
    drawGrid();

    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) drawCell(ctx, c, r, board[r][c], BLOCK);

    // En game over la ultima pieza ya esta fusionada; la nueva (que colisiona) no se pinta.
    if (gameOver) return;

    const gy = ghostY();
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        if (current.shape[r][c])
          drawGhostBlock((current.x + c) * BLOCK, (gy + r) * BLOCK, pal().pieces[current.shape[r][c]]);

    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        drawCell(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
  }

  function drawNext() {
    nextCtx.fillStyle = pal().boardBg;
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
        shift(-1);
        break;
      case "ArrowRight":
        shift(1);
        break;
      case "ArrowDown":
        softDrop();
        break;
      case "ArrowUp":
      case "KeyX":
        playSfx(tryRotate() ? "rotate" : "bump");
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
  // Skin del ultimo frame pintado en pausa: mientras no cambie, el canvas
  // congelado sigue valiendo y no hace falta repintarlo.
  let pausedSkin: Skin | null = null;

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
    if (pausedRef.current) {
      if (pausedSkin !== skinRef.current) {
        draw();
        pausedSkin = skinRef.current;
      }
    } else {
      pausedSkin = null;
      draw();
    }
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
