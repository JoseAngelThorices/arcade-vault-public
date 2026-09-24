"use client";

// Arkanoid (references/start-games/04-Arkanoid/game.js + assets/spritesheet.js) dentro de un
// componente React. La mecanica y los efectos son los del original (muro 7x12,
// grises de 2 golpes, combo x8, aceleracion progresiva, explosiones, escombros,
// estela y puntos flotantes); los cambios son: la pausa llega por prop (P y
// Escape la piden con onPauseToggle), puntuacion/vidas/combo se notifican por
// callback en lugar de pintarse, al vaciar el muro sale uno nuevo en vez de
// ¡VICTORIA!, y no hay overlays PAUSA/GAME OVER ni Enter para reiniciar: los
// pone la plataforma. Solo queda en el canvas el aviso "Pulsa Espacio".

import { useEffect, useRef } from "react";

interface ArkanoidGameProps {
  paused: boolean;
  onScoreChange: (score: number) => void;
  onLivesChange: (lives: number) => void;
  onComboChange: (mult: number) => void; // comboMult(): 0..8
  onPauseToggle: () => void; // teclas P y Escape
  onGameOver: (finalScore: number) => void;
}

type Callbacks = Omit<ArkanoidGameProps, "paused">;

const ASSETS = "/games/arkanoid";

// ── Constantes del original ───────────────────────────────────────────────────
const CANVAS_W = 1000;
const CANVAS_H = 700;

type BrickColor = "gray" | "red" | "yellow" | "cyan" | "magenta" | "hotpink" | "green";

const BRICK_W = 64;
const BRICK_H = 32;
const BRICK_COLS = 12;
const BRICK_ROWS: { color: BrickColor; hits: number; points: number }[] = [
  { color: "gray", hits: 2, points: 20 },
  { color: "red", hits: 1, points: 10 },
  { color: "yellow", hits: 1, points: 10 },
  { color: "cyan", hits: 1, points: 10 },
  { color: "magenta", hits: 1, points: 10 },
  { color: "hotpink", hits: 1, points: 10 },
  { color: "green", hits: 1, points: 10 },
];
const GRAY_DAMAGED_LIGHTEN = 0.45; // cuanto se aclara el gris tras el primer golpe
const BRICKS_OFFSET_X = 116; // (1000 - 12 * 64) / 2
const BRICKS_OFFSET_Y = 100;

const PADDLE_W = 90;
const PADDLE_H = 24;
const PADDLE_Y = 600;
const PADDLE_SPEED = 400; // px/s

const BALL_SIZE = 20;
const BALL_SPEED = 400; // px/s, velocidad base antes de acelerar
const BALL_SPEED_STEP = 0.04; // +4 % por escalon
const BALL_SPEED_EVERY = 8; // bloques destruidos por escalon
const BALL_SPEED_MAX_MULT = 1.6; // tope: 400 -> 640 px/s

const COMBO_MAX = 8;
const MAX_BOUNCE_ANGLE = Math.PI / 3; // 60 grados

const INITIAL_LIVES = 3;
const MAX_DT = 1 / 45; // tope de delta time, en segundos; protege contra el tunneling

const EXPLOSION_FRAME_COUNT = 4;

const TRAIL_LENGTH = 8;
const TRAIL_MAX_ALPHA = 0.35;

const PARTICLES_PER_BRICK = 8;
const PARTICLE_SIZE = 6;
const PARTICLE_LIFE = 500; // ms
const PARTICLE_SPEED = 180; // px/s
const PARTICLE_GRAVITY = 600; // px/s²

const PARTICLE_COLORS: Record<BrickColor, string> = {
  red: "#e2402c",
  yellow: "#e6d43c",
  cyan: "#3cc8e6",
  magenta: "#c83ce6",
  hotpink: "#e63c96",
  green: "#5ce63c",
  gray: "#9e9e9e",
};

const FLOAT_TEXT_LIFE = 700; // ms
const FLOAT_TEXT_RISE = 40; // px

const GAME_KEYS = ["ArrowLeft", "ArrowRight", "KeyA", "KeyD", "Space"];

// ── Spritesheet (assets/spritesheet.js) ───────────────────────────────────────
interface Frame {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

const explosionRow = (sy: number): Frame[] =>
  [256, 288, 320, 352].map((sx) => ({ sx, sy, sw: 32, sh: 16 }));

const EXPLOSION_FRAMES: Record<BrickColor, Frame[]> = {
  red: explosionRow(176),
  cyan: explosionRow(192),
  green: explosionRow(208),
  magenta: explosionRow(224),
  yellow: explosionRow(240),
  hotpink: explosionRow(256),
  gray: explosionRow(176),
};

const EXPLOSION_DURATION = 150; // ms por frame

const SPRITES = {
  paddle: { sx: 32, sy: 112, sw: 162, sh: 14 },
  ball: { sx: 32, sy: 32, sw: 16, sh: 16 },
  blocks: {
    gray: { sx: 32, sy: 288, sw: 32, sh: 16 },
    red: { sx: 32, sy: 176, sw: 32, sh: 16 },
    yellow: { sx: 32, sy: 240, sw: 32, sh: 16 },
    cyan: { sx: 32, sy: 192, sw: 32, sh: 16 },
    magenta: { sx: 32, sy: 224, sw: 32, sh: 16 },
    hotpink: { sx: 32, sy: 256, sw: 32, sh: 16 },
    green: { sx: 32, sy: 208, sw: 32, sh: 16 },
  } satisfies Record<BrickColor, Frame>,
};

export default function ArkanoidGame({ paused, ...callbacks }: ArkanoidGameProps) {
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
      className="block aspect-[1000/700] h-auto w-full max-w-full bg-black [image-rendering:pixelated]"
      aria-label="Arkanoid: flechas o A y D para mover la pala, espacio para sacar"
    />
  );
}

type GameStatus = "serve" | "playing" | "gameover";

interface Brick {
  x: number;
  y: number;
  color: BrickColor;
  hits: number;
  points: number;
  alive: boolean;
  damaged: boolean; // un gris tocado una vez se dibuja mas claro
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Arranca el juego sobre el canvas y devuelve la funcion de limpieza. */
function startGame(
  canvas: HTMLCanvasElement,
  pausedRef: { current: boolean },
  callbacksRef: { current: Callbacks },
): () => void {
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;

  // ── Assets ──────────────────────────────────────────────────────────────────
  let sheet: HTMLImageElement | null = null;
  const sounds = {
    bounce: new Audio(`${ASSETS}/ball-bounce.mp3`),
    break: new Audio(`${ASSETS}/break-sound.mp3`),
  };

  function playSound(audio: HTMLAudioElement) {
    const s = audio.cloneNode() as HTMLAudioElement;
    s.play().catch(() => {});
  }

  function drawFrame(frame: Frame, x: number, y: number, w: number, h: number) {
    if (!sheet) return;
    ctx.drawImage(sheet, frame.sx, frame.sy, frame.sw, frame.sh, x, y, w, h);
  }

  // ── Estado ──────────────────────────────────────────────────────────────────
  const state = {
    status: "serve" as GameStatus,
    score: 0,
    lives: INITIAL_LIVES,
    paddle: { x: (CANVAS_W - PADDLE_W) / 2, y: PADDLE_Y, w: PADDLE_W, h: PADDLE_H },
    ball: { x: 0, y: 0, vx: 0, vy: 0, size: BALL_SIZE },
    bricks: [] as Brick[],
    explosions: [] as { x: number; y: number; color: BrickColor; startTime: number }[],
    trail: [] as { x: number; y: number }[], // la posicion 0 es la mas reciente
    bricksBroken: 0, // bloques destruidos; alimenta la aceleracion
    speedMult: 1, // entre 1 y BALL_SPEED_MAX_MULT
    combo: 0, // bloques de la cadena actual
    particles: [] as { x: number; y: number; vx: number; vy: number; color: BrickColor; startTime: number }[],
    floatingTexts: [] as { x: number; y: number; text: string; startTime: number }[],
  };

  const keys = { left: false, right: false };

  // ── Inicializacion ──────────────────────────────────────────────────────────
  function createBricks(): Brick[] {
    const bricks: Brick[] = [];
    BRICK_ROWS.forEach((row, i) => {
      for (let col = 0; col < BRICK_COLS; col++) {
        bricks.push({
          x: BRICKS_OFFSET_X + col * BRICK_W,
          y: BRICKS_OFFSET_Y + i * BRICK_H,
          color: row.color,
          hits: row.hits,
          points: row.points,
          alive: true,
          damaged: false,
        });
      }
    });
    return bricks;
  }

  function comboMult() {
    return Math.min(state.combo, COMBO_MAX);
  }

  function ballSpeed() {
    return BALL_SPEED * state.speedMult;
  }

  function updateBallSpeed() {
    const mult = Math.min(
      1 + Math.floor(state.bricksBroken / BALL_SPEED_EVERY) * BALL_SPEED_STEP,
      BALL_SPEED_MAX_MULT,
    );
    if (mult === state.speedMult) return;

    state.speedMult = mult;

    // Renormalizar conservando la direccion; en 'serve' la fija launchBall()
    const { ball } = state;
    const mod = Math.hypot(ball.vx, ball.vy);
    if (mod === 0) return;

    const scale = ballSpeed() / mod;
    ball.vx *= scale;
    ball.vy *= scale;
  }

  function placeBallOnPaddle() {
    const { paddle, ball } = state;
    ball.x = paddle.x + (paddle.w - ball.size) / 2;
    ball.y = paddle.y - ball.size;
    ball.vx = 0;
    ball.vy = 0;
    state.trail.length = 0;
  }

  function launchBall() {
    state.ball.vx = 0;
    state.ball.vy = -ballSpeed();
    state.status = "playing";
  }

  // ── Actualizacion ───────────────────────────────────────────────────────────
  function update(dt: number, now: number) {
    updateExplosions(now);
    updateParticles(dt, now);
    updateFloatingTexts(now);

    if (state.status === "gameover") return;

    updatePaddle(dt);

    if (state.status === "serve") {
      placeBallOnPaddle();
      return;
    }

    updateBall(dt, now);
  }

  function updatePaddle(dt: number) {
    const { paddle } = state;
    const dir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    paddle.x += dir * PADDLE_SPEED * dt;
    paddle.x = Math.max(0, Math.min(CANVAS_W - paddle.w, paddle.x));
  }

  function updateBall(dt: number, now: number) {
    const { ball } = state;

    state.trail.unshift({ x: ball.x, y: ball.y });
    if (state.trail.length > TRAIL_LENGTH) state.trail.length = TRAIL_LENGTH;

    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    // Paredes
    if (ball.x < 0) {
      ball.x = 0;
      ball.vx = Math.abs(ball.vx);
      playSound(sounds.bounce);
    } else if (ball.x + ball.size > CANVAS_W) {
      ball.x = CANVAS_W - ball.size;
      ball.vx = -Math.abs(ball.vx);
      playSound(sounds.bounce);
    }
    if (ball.y < 0) {
      ball.y = 0;
      ball.vy = Math.abs(ball.vy);
      playSound(sounds.bounce);
    }

    // Caida
    if (ball.y > CANVAS_H) {
      loseLife();
      return;
    }

    collidePaddle();
    collideBricks(now);
  }

  function intersects(a: Rect, b: Rect) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function ballRect(): Rect {
    const { ball } = state;
    return { x: ball.x, y: ball.y, w: ball.size, h: ball.size };
  }

  function collidePaddle() {
    const { ball, paddle } = state;
    if (ball.vy <= 0 || !intersects(ballRect(), paddle)) return;

    const ballCenter = ball.x + ball.size / 2;
    const paddleCenter = paddle.x + paddle.w / 2;
    const maxOffset = (paddle.w + ball.size) / 2;
    const offset = Math.max(-1, Math.min(1, (ballCenter - paddleCenter) / maxOffset));
    const angle = offset * MAX_BOUNCE_ANGLE;

    ball.vx = ballSpeed() * Math.sin(angle);
    ball.vy = -ballSpeed() * Math.cos(angle);
    ball.y = paddle.y - ball.size;
    state.combo = 0;
    playSound(sounds.bounce);
  }

  function collideBricks(now: number) {
    const { ball } = state;
    const rect = ballRect();

    for (const brick of state.bricks) {
      if (!brick.alive) continue;
      const brickRect = { x: brick.x, y: brick.y, w: BRICK_W, h: BRICK_H };
      if (!intersects(rect, brickRect)) continue;

      const overlapX = Math.min(rect.x + rect.w, brickRect.x + brickRect.w) - Math.max(rect.x, brickRect.x);
      const overlapY = Math.min(rect.y + rect.h, brickRect.y + brickRect.h) - Math.max(rect.y, brickRect.y);
      const ballCenterX = ball.x + ball.size / 2;
      const ballCenterY = ball.y + ball.size / 2;

      if (overlapX < overlapY) {
        if (ballCenterX < brick.x + BRICK_W / 2) {
          ball.x -= overlapX;
          ball.vx = -Math.abs(ball.vx);
        } else {
          ball.x += overlapX;
          ball.vx = Math.abs(ball.vx);
        }
      } else if (ballCenterY < brick.y + BRICK_H / 2) {
        ball.y -= overlapY;
        ball.vy = -Math.abs(ball.vy);
      } else {
        ball.y += overlapY;
        ball.vy = Math.abs(ball.vy);
      }

      hitBrick(brick, now);
      break; // como maximo un bloque por frame
    }
  }

  function hitBrick(brick: Brick, now: number) {
    brick.hits--;

    // Un gris danado sigue vivo: se dibuja mas claro y no puntua todavia
    if (brick.hits > 0) {
      brick.damaged = true;
      return;
    }

    breakBrick(brick, now);
  }

  function breakBrick(brick: Brick, now: number) {
    brick.alive = false;
    state.bricksBroken++;
    updateBallSpeed();

    state.combo++;
    const points = brick.points * comboMult();
    state.score += points;
    state.explosions.push({ x: brick.x, y: brick.y, color: brick.color, startTime: now });
    spawnParticles(brick, now);
    state.floatingTexts.push({
      x: brick.x + BRICK_W / 2,
      y: brick.y,
      text: `+${points}`,
      startTime: now,
    });
    playSound(sounds.break);

    // Muro vacio: sale uno nuevo; puntuacion, vidas y velocidad se conservan
    if (state.bricks.every((b) => !b.alive)) {
      state.bricks = createBricks();
      state.status = "serve";
      placeBallOnPaddle();
    }
  }

  function loseLife() {
    state.lives--;
    if (state.lives <= 0) {
      state.status = "gameover";
      state.trail.length = 0;
    } else {
      state.status = "serve";
      placeBallOnPaddle();
    }
  }

  function spawnParticles(brick: Brick, now: number) {
    const cx = brick.x + BRICK_W / 2 - PARTICLE_SIZE / 2;
    const cy = brick.y + BRICK_H / 2 - PARTICLE_SIZE / 2;

    for (let i = 0; i < PARTICLES_PER_BRICK; i++) {
      const angle = Math.random() * Math.PI * 2;
      state.particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * PARTICLE_SPEED,
        vy: Math.sin(angle) * PARTICLE_SPEED,
        color: brick.color,
        startTime: now,
      });
    }
  }

  function updateParticles(dt: number, now: number) {
    for (const p of state.particles) {
      p.vy += PARTICLE_GRAVITY * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    state.particles = state.particles.filter((p) => now - p.startTime < PARTICLE_LIFE);
  }

  function updateFloatingTexts(now: number) {
    state.floatingTexts = state.floatingTexts.filter((ft) => now - ft.startTime < FLOAT_TEXT_LIFE);
  }

  function updateExplosions(now: number) {
    state.explosions = state.explosions.filter(
      (ex) => Math.floor((now - ex.startTime) / EXPLOSION_DURATION) < EXPLOSION_FRAME_COUNT,
    );
  }

  // ── Dibujo ──────────────────────────────────────────────────────────────────
  function draw(now: number) {
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    drawField(now);
    drawOverlay();
  }

  function drawField(now: number) {
    for (const brick of state.bricks) {
      if (!brick.alive) continue;
      const sprite = SPRITES.blocks[brick.color];
      drawFrame(sprite, brick.x, brick.y, BRICK_W, BRICK_H);

      // El bloque danado se suma a si mismo para aclararse sin tenir el fondo
      if (!brick.damaged) continue;
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = GRAY_DAMAGED_LIGHTEN;
      drawFrame(sprite, brick.x, brick.y, BRICK_W, BRICK_H);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    }

    for (const ex of state.explosions) {
      const idx = Math.floor((now - ex.startTime) / EXPLOSION_DURATION);
      const frame = EXPLOSION_FRAMES[ex.color][idx];
      if (frame) drawFrame(frame, ex.x, ex.y, BRICK_W, BRICK_H);
    }

    // Escombros del bloque roto
    for (const p of state.particles) {
      ctx.globalAlpha = Math.max(0, 1 - (now - p.startTime) / PARTICLE_LIFE);
      ctx.fillStyle = PARTICLE_COLORS[p.color];
      ctx.fillRect(p.x, p.y, PARTICLE_SIZE, PARTICLE_SIZE);
    }
    ctx.globalAlpha = 1;

    const { paddle, ball } = state;

    // Estela de la bola, de la posicion mas reciente a la mas antigua
    for (let i = 0; i < state.trail.length; i++) {
      const t = state.trail[i];
      ctx.globalAlpha = TRAIL_MAX_ALPHA * (1 - i / TRAIL_LENGTH);
      drawFrame(SPRITES.ball, t.x, t.y, ball.size, ball.size);
    }
    ctx.globalAlpha = 1;

    drawFrame(SPRITES.paddle, paddle.x, paddle.y, paddle.w, paddle.h);
    if (state.status !== "gameover") {
      drawFrame(SPRITES.ball, ball.x, ball.y, ball.size, ball.size);
    }

    // Puntos que suben y se desvanecen sobre el bloque roto
    ctx.fillStyle = "#fff";
    ctx.font = "bold 18px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const ft of state.floatingTexts) {
      const progress = (now - ft.startTime) / FLOAT_TEXT_LIFE;
      ctx.globalAlpha = Math.max(0, 1 - progress);
      ctx.fillText(ft.text, ft.x, ft.y - FLOAT_TEXT_RISE * progress);
    }
    ctx.globalAlpha = 1;
  }

  // Solo el aviso de saque: PAUSA y fin de partida los muestra la plataforma.
  function drawOverlay() {
    if (state.status !== "serve") return;
    ctx.fillStyle = "#fff";
    ctx.font = "bold 22px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Pulsa Espacio", CANVAS_W / 2, PADDLE_Y - 60);
  }

  // ── Notificacion a React ────────────────────────────────────────────────────
  let lastScore = NaN;
  let lastLives = NaN;
  let lastCombo = NaN;
  let overReported = false;

  function notify() {
    const cb = callbacksRef.current;
    const mult = comboMult();
    if (state.score !== lastScore) cb.onScoreChange((lastScore = state.score));
    if (state.lives !== lastLives) cb.onLivesChange((lastLives = state.lives));
    if (mult !== lastCombo) cb.onComboChange((lastCombo = mult));
    if (state.status === "gameover" && !overReported) {
      overReported = true;
      cancelAnimationFrame(frame);
      cb.onGameOver(state.score);
    }
  }

  // ── Input ───────────────────────────────────────────────────────────────────
  // Sin esto, el preventDefault se tragaria los espacios del campo de nombre
  // del modal de fin de partida.
  const isEditable = (t: EventTarget | null) =>
    t instanceof HTMLElement &&
    (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName));

  const onKeyDown = (e: KeyboardEvent) => {
    if (isEditable(e.target) || state.status === "gameover") return;
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
      case "KeyA":
        keys.left = true;
        break;
      case "ArrowRight":
      case "KeyD":
        keys.right = true;
        break;
      case "Space":
        if (state.status === "serve") launchBall();
        break;
    }
  };

  // Soltar se atiende siempre, tambien en pausa, para que la pala no se quede
  // moviendose al reanudar.
  const onKeyUp = (e: KeyboardEvent) => {
    if (isEditable(e.target)) return;
    switch (e.code) {
      case "ArrowLeft":
      case "KeyA":
        keys.left = false;
        break;
      case "ArrowRight":
      case "KeyD":
        keys.right = false;
        break;
    }
    if (GAME_KEYS.includes(e.code)) e.preventDefault();
  };

  document.addEventListener("keydown", onKeyDown);
  document.addEventListener("keyup", onKeyUp);

  // ── Bucle principal ─────────────────────────────────────────────────────────
  let lastTime = 0;
  let frame = 0;
  let disposed = false;

  function loop(now: number) {
    const dt = Math.min((now - lastTime) / 1000, MAX_DT);
    lastTime = now;

    if (!pausedRef.current) update(dt, now);
    draw(now);
    notify();

    if (state.status !== "gameover") frame = requestAnimationFrame(loop);
  }

  // El juego arranca cuando el spritesheet esta cargado (como loadSpritesheet).
  state.bricks = createBricks();
  placeBallOnPaddle();

  const img = new Image();
  img.onload = () => {
    if (disposed) return;
    sheet = img;
    frame = requestAnimationFrame((now) => {
      lastTime = now;
      loop(now);
    });
  };
  img.onerror = () => console.error("No se pudo cargar el spritesheet de Arkanoid");
  img.src = `${ASSETS}/spritesheet-breakout.png`;

  return () => {
    disposed = true;
    cancelAnimationFrame(frame);
    document.removeEventListener("keydown", onKeyDown);
    document.removeEventListener("keyup", onKeyUp);
  };
}
