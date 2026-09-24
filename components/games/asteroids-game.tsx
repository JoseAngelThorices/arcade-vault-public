"use client";

// Asteroids (references/start-games/02-asteroids/game.js) dentro de un componente React.
// El bucle es el del original; los cambios son: la pausa llega por prop, cada
// cambio de puntuacion/vidas/nivel se notifica por callback, y ni esos valores
// ni la capa "GAME OVER" se dibujan en el canvas: los muestran el HUD y el
// modal de la plataforma (reiniciar ya no es ESPACIO: se remonta el componente).

import { useEffect, useRef } from "react";

interface AsteroidsGameProps {
  paused: boolean;
  onScoreChange: (score: number) => void;
  onLivesChange: (lives: number) => void;
  onLevelChange: (level: number) => void;
  onGameOver: (finalScore: number) => void;
}

type Callbacks = Omit<AsteroidsGameProps, "paused">;

const W = 800;
const H = 600;

export default function AsteroidsGame({ paused, ...callbacks }: AsteroidsGameProps) {
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
      width={W}
      height={H}
      className="block h-auto w-full bg-black"
      aria-label="Asteroids: flechas para girar y acelerar, espacio para disparar"
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

  // ── Input ───────────────────────────────────────────────────────────────────

  const keys: Record<string, boolean> = {}; // estado sostenido: true mientras la tecla siga pulsada
  const justPressed: Record<string, boolean> = {}; // edge-triggered: lo consume pressed() una sola vez

  // Teclas cuyo comportamiento por defecto del navegador (scroll) estorba
  const BLOCKED = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"];

  // Sin esto, el preventDefault se tragaria los espacios del campo de nombre
  // del modal de fin de partida.
  const isEditable = (t: EventTarget | null) =>
    t instanceof HTMLElement &&
    (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName));

  const onKeyDown = (e: KeyboardEvent) => {
    if (isEditable(e.target)) return;
    if (BLOCKED.includes(e.code)) e.preventDefault();
    if (!keys[e.code]) justPressed[e.code] = true; // ignora la autorrepetición
    keys[e.code] = true;
  };

  const onKeyUp = (e: KeyboardEvent) => {
    if (isEditable(e.target)) return;
    if (BLOCKED.includes(e.code)) e.preventDefault();
    keys[e.code] = false;
  };

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  function pressed(code: string) {
    const val = justPressed[code];
    justPressed[code] = false;
    return val;
  }

  // ── Utils ───────────────────────────────────────────────────────────────────
  const wrap = (v: number, max: number) => ((v % max) + max) % max;
  const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.hypot(a.x - b.x, a.y - b.y);
  const rand = (min: number, max: number) => min + Math.random() * (max - min);
  const randInt = (min: number, max: number) => Math.floor(rand(min, max + 1));

  // ── Bullet ──────────────────────────────────────────────────────────────────
  class Bullet {
    x: number;
    y: number;
    vx: number;
    vy: number;
    ttl = 1.1;
    radius = 2;
    dead = false;

    constructor(x: number, y: number, angle: number) {
      this.x = x;
      this.y = y;
      const SPEED = 520;
      this.vx = Math.cos(angle) * SPEED;
      this.vy = Math.sin(angle) * SPEED;
    }

    update(dt: number) {
      this.x = wrap(this.x + this.vx * dt, W);
      this.y = wrap(this.y + this.vy * dt, H);
      this.ttl -= dt;
      if (this.ttl <= 0) this.dead = true;
    }

    draw() {
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ── Asteroid ────────────────────────────────────────────────────────────────
  const RADII = [0, 16, 30, 50]; // por tamaño 1, 2, 3
  const SPEEDS = [0, 85, 55, 32]; // velocidad base por tamaño
  const POINTS = [0, 100, 50, 20]; // puntos por tamaño
  const LEVEL_SPEED_STEP = 0.1; // +10 % de velocidad de asteroides por nivel
  const LEVEL_SPEED_MAX = 1.8; // tope del multiplicador (nivel 9 en adelante)

  // Multiplicador de velocidad de los asteroides según el nivel actual.
  const levelSpeed = () => Math.min(1 + (level - 1) * LEVEL_SPEED_STEP, LEVEL_SPEED_MAX);

  class Asteroid {
    x: number;
    y: number;
    size: number;
    radius: number;
    dead = false;
    vx: number;
    vy: number;
    rotSpeed: number;
    rot: number;
    verts: [number, number][] = [];

    constructor(x: number, y: number, size = 3) {
      this.x = x;
      this.y = y;
      this.size = size;
      this.radius = RADII[size];

      const angle = rand(0, Math.PI * 2);
      const speed = (SPEEDS[size] + rand(-15, 15)) * levelSpeed();
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
      this.rotSpeed = rand(-1.2, 1.2);
      this.rot = rand(0, Math.PI * 2);

      // Polígono irregular
      const n = randInt(8, 13);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const r = this.radius * rand(0.6, 1.0);
        this.verts.push([Math.cos(a) * r, Math.sin(a) * r]);
      }
    }

    update(dt: number) {
      this.x = wrap(this.x + this.vx * dt, W);
      this.y = wrap(this.y + this.vy * dt, H);
      this.rot += this.rotSpeed * dt;
    }

    split(): Asteroid[] {
      if (this.size <= 1) return [];
      return [
        new Asteroid(this.x, this.y, this.size - 1),
        new Asteroid(this.x, this.y, this.size - 1),
      ];
    }

    draw() {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rot);
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.5;
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(this.verts[0][0], this.verts[0][1]);
      for (let i = 1; i < this.verts.length; i++) ctx.lineTo(this.verts[i][0], this.verts[i][1]);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }
  }

  // ── PowerUps ────────────────────────────────────────────────────────────────
  const TRIPLE_SPREAD = 0.22; // rad entre balas del abanico
  const DROP_CHANCE = 0.2; // probabilidad base por asteroide destruido
  const SLOW_FACTOR = 0.5; // los asteroides se mueven a la mitad
  const BOOST_THRUST = 2.2; // multiplicador de aceleración (y de velocidad máx.)
  const BOOST_ROT = 1.25; // multiplicador de giro con el propulsor mejorado

  // Catálogo de tipos. `duration` 0 = efecto instantáneo al recogerlo.
  // Cada ronda cae uno de cada tipo, en orden aleatorio.
  const POWERUP_TYPES = {
    triple: { duration: 10, color: "#4dd8ff", label: "TRIPLE" },
    slow: { duration: 6, color: "#b07dff", label: "LENTO" },
    boost: { duration: 8, color: "#9dff5c", label: "TURBO" },
    shield: { duration: 5, color: "#ffd24d", label: "ESCUDO" },
    bomb: { duration: 0, color: "#ff5c4d", label: "BOMBA" },
  };
  type PowerUpType = keyof typeof POWERUP_TYPES;
  type EffectType = Exclude<PowerUpType, "bomb">;

  // Baraja in situ (Fisher-Yates)
  function shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = randInt(0, i);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // Destrucciones que quedan por delante en un asteroide y toda su descendencia:
  // tamaño 1 → 1, tamaño 2 → 3, tamaño 3 → 7.
  const killsFor = (size: number) => Math.pow(2, size) - 1;

  class PowerUp {
    x: number;
    y: number;
    type: PowerUpType;
    vx: number;
    vy: number;
    radius = 13;
    ttl = 16; // desaparece si nadie lo recoge
    rot = 0;
    dead = false;

    constructor(x: number, y: number, type: PowerUpType) {
      this.x = x;
      this.y = y;
      this.type = type;
      const angle = rand(0, Math.PI * 2);
      const speed = rand(18, 38);
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
    }

    update(dt: number) {
      this.x = wrap(this.x + this.vx * dt, W);
      this.y = wrap(this.y + this.vy * dt, H);
      this.rot += 1.6 * dt;
      this.ttl -= dt;
      if (this.ttl <= 0) this.dead = true;
    }

    draw() {
      // Parpadea en los últimos 3 s antes de expirar
      if (this.ttl < 3 && Math.floor(this.ttl * 8) % 2 === 0) return;

      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.strokeStyle = POWERUP_TYPES[this.type].color;
      ctx.fillStyle = POWERUP_TYPES[this.type].color;
      ctx.lineWidth = 1.5;
      ctx.lineJoin = "round";

      // Anillo pulsante
      const r = this.radius + Math.sin(this.rot * 3) * 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();

      ctx.rotate(this.rot);
      this.drawIcon();
      ctx.restore();
    }

    drawIcon() {
      if (this.type === "triple") {
        // Tres trazos en abanico
        for (const a of [-TRIPLE_SPREAD * 2, 0, TRIPLE_SPREAD * 2]) {
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * 2, Math.sin(a) * 2);
          ctx.lineTo(Math.cos(a) * 8, Math.sin(a) * 8);
          ctx.stroke();
        }
        return;
      }

      if (this.type === "slow") {
        // Reloj: esfera con dos agujas
        ctx.beginPath();
        ctx.arc(0, 0, 7, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -5);
        ctx.moveTo(0, 0);
        ctx.lineTo(4, 1);
        ctx.stroke();
        return;
      }

      if (this.type === "shield") {
        // Broquel: arco cerrado por una base recta
        ctx.beginPath();
        ctx.arc(0, 0, 7, Math.PI * 0.15, Math.PI * 0.85);
        ctx.closePath();
        ctx.stroke();
        return;
      }

      if (this.type === "boost") {
        // Doble galón apuntando al frente
        for (const dx of [-4, 1]) {
          ctx.beginPath();
          ctx.moveTo(dx, -6);
          ctx.lineTo(dx + 5, 0);
          ctx.lineTo(dx, 6);
          ctx.stroke();
        }
        return;
      }

      // bomb: núcleo sólido con estallido radial
      ctx.beginPath();
      ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
      ctx.fill();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 5.5, Math.sin(a) * 5.5);
        ctx.lineTo(Math.cos(a) * 9.5, Math.sin(a) * 9.5);
        ctx.stroke();
      }
    }
  }

  // ── Ship ────────────────────────────────────────────────────────────────────
  class Ship {
    x = 0;
    y = 0;
    angle = 0;
    vx = 0;
    vy = 0;
    radius = 12;
    thrusting = false;
    invincible = 0;
    shootCooldown = 0;
    dead = false;

    constructor() {
      this.reset();
    }

    reset() {
      this.x = W / 2;
      this.y = H / 2;
      this.angle = -Math.PI / 2;
      this.vx = 0;
      this.vy = 0;
      this.radius = 12;
      this.thrusting = false;
      this.invincible = 3;
      this.shootCooldown = 0;
      this.dead = false;
    }

    update(dt: number) {
      if (this.dead) return;
      if (this.invincible > 0) this.invincible -= dt;
      if (this.shootCooldown > 0) this.shootCooldown -= dt;

      // Con TURBO sube la aceleración (y con ella la velocidad máxima, porque el
      // tope lo marca el equilibrio entre empuje y rozamiento) y el giro.
      const boost = effects.boost > 0;
      const ROT = 3.5 * (boost ? BOOST_ROT : 1); // rad/s
      const THRUST = 260 * (boost ? BOOST_THRUST : 1); // px/s²
      const DRAG = 0.987;

      if (keys["ArrowLeft"]) this.angle -= ROT * dt;
      if (keys["ArrowRight"]) this.angle += ROT * dt;

      this.thrusting = !!keys["ArrowUp"];
      if (this.thrusting) {
        this.vx += Math.cos(this.angle) * THRUST * dt;
        this.vy += Math.sin(this.angle) * THRUST * dt;
      }

      this.vx *= DRAG;
      this.vy *= DRAG;
      this.x = wrap(this.x + this.vx * dt, W);
      this.y = wrap(this.y + this.vy * dt, H);
    }

    tryShoot(): Bullet[] {
      if (this.shootCooldown > 0 || this.dead) return [];
      this.shootCooldown = 0.2;
      const NOSE = 21;
      const ox = this.x + Math.cos(this.angle) * NOSE;
      const oy = this.y + Math.sin(this.angle) * NOSE;
      if (effects.triple > 0) {
        return [-TRIPLE_SPREAD, 0, TRIPLE_SPREAD].map(
          (off) => new Bullet(ox, oy, this.angle + off),
        );
      }
      return [new Bullet(ox, oy, this.angle)];
    }

    draw() {
      if (this.dead) return;
      // Parpadeo durante invencibilidad de reaparición
      if (this.invincible > 0 && Math.floor(this.invincible * 8) % 2 === 0) return;

      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle);
      // El casco toma el color del TURBO mientras dura
      ctx.strokeStyle = effects.boost > 0 ? POWERUP_TYPES.boost.color : "#fff";
      ctx.lineWidth = 1.5;
      ctx.lineJoin = "round";

      // Silueta clásica: triángulo con muesca trasera
      ctx.beginPath();
      ctx.moveTo(20, 0); // nariz
      ctx.lineTo(-12, -9); // ala izquierda
      ctx.lineTo(-7, 0); // muesca trasera
      ctx.lineTo(-12, 9); // ala derecha
      ctx.closePath();
      ctx.stroke();

      // Llama del propulsor
      if (this.thrusting && Math.random() > 0.35) {
        const len = effects.boost > 0 ? rand(14, 26) : rand(6, 14);
        ctx.beginPath();
        ctx.moveTo(-8, -4);
        ctx.lineTo(-8 - len, 0);
        ctx.lineTo(-8, 4);
        ctx.strokeStyle = "rgba(255, 130, 0, 0.85)";
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  // ── Partículas (explosión) ──────────────────────────────────────────────────
  class Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    ttl: number;
    dead = false;

    constructor(x: number, y: number) {
      this.x = x;
      this.y = y;
      const angle = rand(0, Math.PI * 2);
      const speed = rand(30, 130);
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
      this.life = rand(0.4, 1.1);
      this.ttl = this.life;
    }

    update(dt: number) {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.ttl -= dt;
      if (this.ttl <= 0) this.dead = true;
    }

    draw() {
      const alpha = this.ttl / this.life;
      ctx.strokeStyle = `rgba(255,255,255,${alpha.toFixed(2)})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(this.x - this.vx * 0.05, this.y - this.vy * 0.05);
      ctx.stroke();
    }
  }

  // ── Estado del juego ────────────────────────────────────────────────────────
  let ship: Ship;
  let bullets: Bullet[];
  let asteroids: Asteroid[];
  let particles: Particle[];
  let powerups: PowerUp[];
  let pendingDrops: PowerUpType[]; // tipos que aún tienen que caer en esta ronda (uno de cada)
  let pendingKills: number; // destrucciones que quedan en el nivel (garantiza las caídas)
  let effects: Record<EffectType, number>; // segundos restantes de cada efecto temporal
  let flash: number; // destello blanco de la bomba
  let score: number;
  let lives: number;
  let level: number;
  let state: "playing" | "dead" | "gameover";
  let deadTimer = 0;

  function clearEffects() {
    effects = { triple: 0, slow: 0, boost: 0, shield: 0 };
  }

  // Los asteroides van a cámara lenta mientras dure el efecto; la nave no.
  const asteroidTimeScale = () => (effects.slow > 0 ? SLOW_FACTOR : 1);

  function spawnAsteroids(count: number) {
    const SAFE_DIST = 130;
    for (let i = 0; i < count; i++) {
      let x: number, y: number;
      do {
        x = rand(0, W);
        y = rand(0, H);
      } while (Math.hypot(x - W / 2, y - H / 2) < SAFE_DIST);
      asteroids.push(new Asteroid(x, y, 3));
    }
    // Arranque de ronda: vuelven a estar pendientes los cinco tipos, en orden
    // aleatorio, y se recuentan las destrucciones que quedan para garantizarlos.
    pendingDrops = shuffle(Object.keys(POWERUP_TYPES) as PowerUpType[]);
    pendingKills = count * killsFor(3);
  }

  function initGame() {
    ship = new Ship();
    bullets = [];
    asteroids = [];
    particles = [];
    powerups = [];
    clearEffects();
    flash = 0;
    score = 0;
    lives = 3;
    level = 1;
    state = "playing";
    spawnAsteroids(4);
  }

  function nextLevel() {
    level++;
    bullets = [];
    particles = [];
    // Nivel limpio: desaparecen los power-ups sin recoger y se cortan los
    // efectos activos. spawnAsteroids() vuelve a dejar pendientes los cinco
    // tipos, que caen de nuevo al destruir las rocas del nivel nuevo.
    powerups = [];
    clearEffects();
    ship.reset();
    spawnAsteroids(3 + level);
  }

  function explode(x: number, y: number, count = 8) {
    for (let i = 0; i < count; i++) particles.push(new Particle(x, y));
  }

  // Aplica el efecto de un power-up recogido: temporal o instantáneo.
  function applyPowerUp(type: PowerUpType) {
    if (type !== "bomb") {
      effects[type] = POWERUP_TYPES[type].duration; // recogerlo de nuevo reinicia el contador
      return;
    }
    // bomb: arrasa con todos los asteroides visibles en ese instante, sin partirlos
    const restos = asteroids.slice();
    for (const a of restos) {
      score += POINTS[a.size];
      explode(a.x, a.y, a.size * 5);
    }
    asteroids = [];
    flash = 0.3;

    // Al vaciar la pantalla ya no quedan destrucciones que suelten lo pendiente,
    // así que los tipos que faltaban por caer esta ronda aparecen ahora.
    while (pendingDrops.length > 0) {
      const a = restos[pendingDrops.length % restos.length];
      const x = a ? a.x : rand(0, W);
      const y = a ? a.y : rand(0, H);
      powerups.push(new PowerUp(x, y, pendingDrops.shift()!));
    }
  }

  function killShip() {
    explode(ship.x, ship.y, 14);
    clearEffects(); // morir corta los efectos activos
    ship.dead = true;
    lives--;
    if (lives <= 0) {
      state = "gameover";
    } else {
      state = "dead";
      deadTimer = 2;
    }
  }

  // ── Update ──────────────────────────────────────────────────────────────────
  function update(dt: number) {
    if (flash > 0) flash = Math.max(0, flash - dt); // se apaga en cualquier estado

    // Sin reinicio con ESPACIO: lo gestiona el modal de la plataforma.
    if (state === "gameover") {
      particles.forEach((p) => p.update(dt));
      particles = particles.filter((p) => !p.dead);
      return;
    }

    if (state === "dead") {
      deadTimer -= dt;
      particles.forEach((p) => p.update(dt));
      particles = particles.filter((p) => !p.dead);
      asteroids.forEach((a) => a.update(dt * asteroidTimeScale()));
      powerups.forEach((p) => p.update(dt));
      powerups = powerups.filter((p) => !p.dead);
      if (deadTimer <= 0) {
        state = "playing";
        ship.reset();
      }
      return;
    }

    // Disparar
    if (pressed("Space")) {
      bullets.push(...ship.tryShoot());
    }

    // Contadores de los efectos temporales
    for (const k of Object.keys(effects) as EffectType[])
      if (effects[k] > 0) effects[k] = Math.max(0, effects[k] - dt);

    ship.update(dt);
    bullets.forEach((b) => b.update(dt));
    asteroids.forEach((a) => a.update(dt * asteroidTimeScale()));
    particles.forEach((p) => p.update(dt));
    powerups.forEach((p) => p.update(dt));

    bullets = bullets.filter((b) => !b.dead);
    particles = particles.filter((p) => !p.dead);
    powerups = powerups.filter((p) => !p.dead);

    // Bala vs asteroide
    const newAsteroids: Asteroid[] = [];
    for (const b of bullets) {
      for (const a of asteroids) {
        if (!a.dead && !b.dead && dist(b, a) < a.radius) {
          b.dead = true;
          a.dead = true;
          score += POINTS[a.size];
          explode(a.x, a.y, a.size * 5);
          newAsteroids.push(...a.split());
          // Suelta como mucho un power-up por destrucción, en el orden barajado
          // de la ronda. La probabilidad crece según se agotan las destrucciones
          // que quedan, así que los cinco tipos salen sí o sí antes de acabarla.
          pendingKills--;
          if (pendingDrops.length > 0) {
            const chance = Math.max(DROP_CHANCE, pendingDrops.length / Math.max(pendingKills, 1));
            if (Math.random() < chance) powerups.push(new PowerUp(a.x, a.y, pendingDrops.shift()!));
          }
        }
      }
    }
    asteroids = asteroids.filter((a) => !a.dead).concat(newAsteroids);
    bullets = bullets.filter((b) => !b.dead);

    // Nave vs power-up
    for (const p of powerups) {
      if (!ship.dead && dist(ship, p) < ship.radius + p.radius) {
        p.dead = true;
        applyPowerUp(p.type);
      }
    }
    powerups = powerups.filter((p) => !p.dead);

    // Nave vs asteroide
    if (ship.invincible <= 0) {
      for (const a of asteroids) {
        if (dist(ship, a) < ship.radius + a.radius * 0.82) {
          if (effects.shield > 0) {
            // El escudo absorbe este impacto y se consume: el asteroide se
            // desintegra sin partirse (sus trozos matarían a bocajarro) y la
            // nave queda invulnerable un instante para poder salir de ahí.
            effects.shield = 0;
            a.dead = true;
            score += POINTS[a.size];
            explode(a.x, a.y, a.size * 5);
            ship.invincible = 1.2;
            flash = 0.12;
          } else {
            killShip();
          }
          break;
        }
      }
      asteroids = asteroids.filter((a) => !a.dead);
    }

    // Nivel completado
    if (asteroids.length === 0) nextLevel();
  }

  // ── Draw ────────────────────────────────────────────────────────────────────
  // Círculo de energía alrededor de la nave mientras el escudo aguante
  function drawShield() {
    if (effects.shield <= 0 || ship.dead) return;
    // Parpadea en el último segundo y medio para avisar de que se agota
    if (effects.shield < 1.5 && Math.floor(effects.shield * 10) % 2 === 0) return;

    const t = performance.now() / 1000;
    ctx.save();
    ctx.translate(ship.x, ship.y);
    ctx.strokeStyle = POWERUP_TYPES.shield.color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, ship.radius + 8 + Math.sin(t * 6) * 1.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Puntuación, nivel y vidas solo se muestran en el HUD de la plataforma; en
  // el canvas quedan únicamente los efectos activos con su cuenta atrás.
  function drawHUD() {
    ctx.font = "14px monospace";
    ctx.textAlign = "center";
    let row = 0;
    for (const type of Object.keys(effects) as EffectType[]) {
      if (effects[type] <= 0) continue;
      ctx.fillStyle = POWERUP_TYPES[type].color;
      ctx.fillText(`${POWERUP_TYPES[type].label} ${effects[type].toFixed(1)}s`, W / 2, 26 + row * 18);
      row++;
    }
  }

  function draw() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);

    particles.forEach((p) => p.draw());
    asteroids.forEach((a) => a.draw());
    powerups.forEach((p) => p.draw());
    bullets.forEach((b) => b.draw());
    ship.draw();
    drawShield();

    // Destello de la bomba, se desvanece con su temporizador
    if (flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${((flash / 0.3) * 0.55).toFixed(2)})`;
      ctx.fillRect(0, 0, W, H);
    }

    drawHUD();
  }

  // ── Avisos a React ──────────────────────────────────────────────────────────
  // NaN fuerza el primer aviso, para que la plataforma arranque con los
  // valores reales del juego.
  let lastScore = NaN;
  let lastLives = NaN;
  let lastLevel = NaN;
  let overReported = false;

  function notify() {
    const cb = callbacksRef.current;
    if (score !== lastScore) cb.onScoreChange((lastScore = score));
    if (lives !== lastLives) cb.onLivesChange((lastLives = lives));
    if (level !== lastLevel) cb.onLevelChange((lastLevel = level));
    if (state === "gameover" && !overReported) {
      overReported = true;
      cb.onGameOver(score);
    }
  }

  // ── Loop principal ──────────────────────────────────────────────────────────
  let lastTime: number | null = null;
  let frame = 0;

  function loop(ts: number) {
    const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
    lastTime = ts;
    if (pausedRef.current) {
      // Lo pulsado durante la pausa no debe dispararse al reanudar
      for (const k of Object.keys(justPressed)) justPressed[k] = false;
    } else {
      update(dt);
      notify();
    }
    draw();
    frame = requestAnimationFrame(loop);
  }

  initGame();
  frame = requestAnimationFrame(loop);

  return () => {
    cancelAnimationFrame(frame);
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
  };
}
