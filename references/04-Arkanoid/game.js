// Constantes
const CANVAS_W = 1000;
const CANVAS_H = 700;

const BRICK_W = 64;
const BRICK_H = 32;
const BRICK_COLS = 12;
const BRICK_ROWS = [
  { color: 'gray',    hits: 2, points: 20 },
  { color: 'red',     hits: 1, points: 10 },
  { color: 'yellow',  hits: 1, points: 10 },
  { color: 'cyan',    hits: 1, points: 10 },
  { color: 'magenta', hits: 1, points: 10 },
  { color: 'hotpink', hits: 1, points: 10 },
  { color: 'green',   hits: 1, points: 10 },
];
const GRAY_DAMAGED_LIGHTEN = 0.45; // cuánto se aclara el gris tras el primer golpe
const BRICKS_OFFSET_X = 116;   // (1000 - 12 * 64) / 2
const BRICKS_OFFSET_Y = 100;   // espacio para el HUD

const PADDLE_W = 90;
const PADDLE_H = 24;
const PADDLE_Y = 600;
const PADDLE_SPEED = 400;     // px/

const BALL_SIZE = 20;
const BALL_SPEED = 400;       // px/s, velocidad base antes de acelerar
const BALL_SPEED_STEP = 0.04;      // +4 % por escalón
const BALL_SPEED_EVERY = 8;        // bloques destruidos por escalón
const BALL_SPEED_MAX_MULT = 1.6;   // tope: 400 → 640 px/s

const COMBO_MAX = 8;               // tope del multiplicador de combo
const MAX_BOUNCE_ANGLE = Math.PI / 3; // 60°

const INITIAL_LIVES = 3;
const MAX_DT = 1 / 45;        // tope de delta time, en segundos; protege contra el tunneling

const EXPLOSION_FRAME_COUNT = 4;

const TRAIL_LENGTH = 8;       // posiciones guardadas de la bola
const TRAIL_MAX_ALPHA = 0.35; // alpha de la posición más reciente de la estela

const PARTICLES_PER_BRICK = 8;
const PARTICLE_SIZE = 6;      // px, cuadrado
const PARTICLE_LIFE = 500;    // ms
const PARTICLE_SPEED = 180;   // px/s, módulo de la velocidad inicial
const PARTICLE_GRAVITY = 600; // px/s²

// Color CSS por color de bloque, para dibujar las partículas
const PARTICLE_COLORS = {
  red: '#e2402c',
  yellow: '#e6d43c',
  cyan: '#3cc8e6',
  magenta: '#c83ce6',
  hotpink: '#e63c96',
  green: '#5ce63c',
  gray: '#9e9e9e',
};

const FLOAT_TEXT_LIFE = 700;  // ms
const FLOAT_TEXT_RISE = 40;   // px que sube antes de desaparecer

const HUD_LIFE_SIZE = 20;     // tamaño de cada bola del contador de vidas
const HUD_LIFE_GAP = 6;       // separación entre bolas

// Canvas
const canvas = document.getElementById( 'game' );
const ctx = canvas.getContext( '2d' );
ctx.imageSmoothingEnabled = false;

// Estado de la partida
const state = {
  status: 'serve',            // 'serve' | 'playing' | 'paused' | 'gameover' | 'win'
  score: 0,
  lives: INITIAL_LIVES,
  paddle: { x: ( CANVAS_W - PADDLE_W ) / 2, y: PADDLE_Y, w: PADDLE_W, h: PADDLE_H },
  ball: { x: 0, y: 0, vx: 0, vy: 0, size: BALL_SIZE },
  bricks: [],
  explosions: [],
  trail: [],                  // [ { x, y } ], la posición 0 es la más reciente
  bricksBroken: 0,            // bloques destruidos; alimenta la aceleración
  speedMult: 1,               // multiplicador de velocidad, entre 1 y BALL_SPEED_MAX_MULT
  combo: 0,                   // bloques de la cadena actual
  particles: [],              // [ { x, y, vx, vy, color, startTime } ]
  floatingTexts: [],          // [ { x, y, text, startTime } ]
};

// Entrada
const keys = { left: false, right: false };

// Sonidos
const sounds = {
  bounce: new Audio( 'assets/sounds/ball-bounce.mp3' ),
  break: new Audio( 'assets/sounds/break-sound.mp3' ),
};

function playSound( audio ) {
  const s = audio.cloneNode();
  s.play().catch( () => {} );
}

// Inicialización
function createBricks() {
  const bricks = [];
  BRICK_ROWS.forEach( ( row, i ) => {
    for ( let col = 0; col < BRICK_COLS; col++ ) {
      bricks.push( {
        x: BRICKS_OFFSET_X + col * BRICK_W,
        y: BRICKS_OFFSET_Y + i * BRICK_H,
        color: row.color,
        hits: row.hits,
        points: row.points,
        alive: true,
        damaged: false,         // un gris tocado una vez se dibuja más claro
      } );
    }
  } );
  return bricks;
}

function resetGame() {
  state.status = 'serve';
  state.score = 0;
  state.lives = INITIAL_LIVES;
  state.paddle.x = ( CANVAS_W - PADDLE_W ) / 2;
  state.bricks = createBricks();
  state.bricksBroken = 0;
  state.speedMult = 1;
  state.combo = 0;
  state.explosions = [];
  state.particles = [];
  state.floatingTexts = [];
  placeBallOnPaddle();
}

function comboMult() {
  return Math.min( state.combo, COMBO_MAX );
}

function ballSpeed() {
  return BALL_SPEED * state.speedMult;
}

function updateBallSpeed() {
  const mult = Math.min(
    1 + Math.floor( state.bricksBroken / BALL_SPEED_EVERY ) * BALL_SPEED_STEP,
    BALL_SPEED_MAX_MULT
  );
  if ( mult === state.speedMult ) return;

  state.speedMult = mult;

  // Renormalizar conservando la dirección; en 'serve' la fija launchBall()
  const { ball } = state;
  const mod = Math.hypot( ball.vx, ball.vy );
  if ( mod === 0 ) return;

  const scale = ballSpeed() / mod;
  ball.vx *= scale;
  ball.vy *= scale;
}

function placeBallOnPaddle() {
  const { paddle, ball } = state;
  ball.x = paddle.x + ( paddle.w - ball.size ) / 2;
  ball.y = paddle.y - ball.size;
  ball.vx = 0;
  ball.vy = 0;
  state.trail.length = 0;
}

function launchBall() {
  state.ball.vx = 0;
  state.ball.vy = -ballSpeed();
  state.status = 'playing';
}

// Teclado
document.addEventListener( 'keydown', e => {
  switch ( e.code ) {
    case 'ArrowLeft':
    case 'KeyA':
      keys.left = true;
      e.preventDefault();
      break;
    case 'ArrowRight':
    case 'KeyD':
      keys.right = true;
      e.preventDefault();
      break;
    case 'Space':
      e.preventDefault();
      if ( state.status === 'serve' ) launchBall();
      break;
    case 'Enter':
      if ( state.status === 'gameover' || state.status === 'win' ) resetGame();
      break;
    case 'KeyP':
    case 'Escape':
      if ( state.status === 'playing' ) state.status = 'paused';
      else if ( state.status === 'paused' ) state.status = 'playing';
      break;
  }
} );

document.addEventListener( 'keyup', e => {
  switch ( e.code ) {
    case 'ArrowLeft':
    case 'KeyA':
      keys.left = false;
      break;
    case 'ArrowRight':
    case 'KeyD':
      keys.right = false;
      break;
  }
} );

// Actualización
function update( dt, now ) {
  updateExplosions( now );
  updateParticles( dt, now );
  updateFloatingTexts( now );

  if ( state.status !== 'serve' && state.status !== 'playing' ) return;

  updatePaddle( dt );

  if ( state.status === 'serve' ) {
    placeBallOnPaddle();
    return;
  }

  updateBall( dt, now );
}

function updatePaddle( dt ) {
  const { paddle } = state;
  const dir = ( keys.right ? 1 : 0 ) - ( keys.left ? 1 : 0 );
  paddle.x += dir * PADDLE_SPEED * dt;
  paddle.x = Math.max( 0, Math.min( CANVAS_W - paddle.w, paddle.x ) );
}

function updateBall( dt, now ) {
  const { ball } = state;

  state.trail.unshift( { x: ball.x, y: ball.y } );
  if ( state.trail.length > TRAIL_LENGTH ) state.trail.length = TRAIL_LENGTH;

  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;

  // Paredes
  if ( ball.x < 0 ) {
    ball.x = 0;
    ball.vx = Math.abs( ball.vx );
    playSound( sounds.bounce );
  } else if ( ball.x + ball.size > CANVAS_W ) {
    ball.x = CANVAS_W - ball.size;
    ball.vx = -Math.abs( ball.vx );
    playSound( sounds.bounce );
  }
  if ( ball.y < 0 ) {
    ball.y = 0;
    ball.vy = Math.abs( ball.vy );
    playSound( sounds.bounce );
  }

  // Caída
  if ( ball.y > CANVAS_H ) {
    loseLife();
    return;
  }

  collidePaddle();
  collideBricks( now );
}

function intersects( a, b ) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function ballRect() {
  const { ball } = state;
  return { x: ball.x, y: ball.y, w: ball.size, h: ball.size };
}

function collidePaddle() {
  const { ball, paddle } = state;
  if ( ball.vy <= 0 || !intersects( ballRect(), paddle ) ) return;

  const ballCenter = ball.x + ball.size / 2;
  const paddleCenter = paddle.x + paddle.w / 2;
  const maxOffset = ( paddle.w + ball.size ) / 2;
  const offset = Math.max( -1, Math.min( 1, ( ballCenter - paddleCenter ) / maxOffset ) );
  const angle = offset * MAX_BOUNCE_ANGLE;

  ball.vx = ballSpeed() * Math.sin( angle );
  ball.vy = -ballSpeed() * Math.cos( angle );
  ball.y = paddle.y - ball.size;
  state.combo = 0;
  playSound( sounds.bounce );
}

function collideBricks( now ) {
  const { ball } = state;
  const rect = ballRect();

  for ( const brick of state.bricks ) {
    if ( !brick.alive ) continue;
    const brickRect = { x: brick.x, y: brick.y, w: BRICK_W, h: BRICK_H };
    if ( !intersects( rect, brickRect ) ) continue;

    const overlapX = Math.min( rect.x + rect.w, brickRect.x + brickRect.w ) - Math.max( rect.x, brickRect.x );
    const overlapY = Math.min( rect.y + rect.h, brickRect.y + brickRect.h ) - Math.max( rect.y, brickRect.y );
    const ballCenterX = ball.x + ball.size / 2;
    const ballCenterY = ball.y + ball.size / 2;

    if ( overlapX < overlapY ) {
      if ( ballCenterX < brick.x + BRICK_W / 2 ) {
        ball.x -= overlapX;
        ball.vx = -Math.abs( ball.vx );
      } else {
        ball.x += overlapX;
        ball.vx = Math.abs( ball.vx );
      }
    } else {
      if ( ballCenterY < brick.y + BRICK_H / 2 ) {
        ball.y -= overlapY;
        ball.vy = -Math.abs( ball.vy );
      } else {
        ball.y += overlapY;
        ball.vy = Math.abs( ball.vy );
      }
    }

    hitBrick( brick, now );
    break; // como máximo un bloque por frame
  }
}

function hitBrick( brick, now ) {
  brick.hits--;

  // Un gris dañado sigue vivo: se dibuja más claro y no puntúa todavía
  if ( brick.hits > 0 ) {
    brick.damaged = true;
    return;
  }

  breakBrick( brick, now );
}

function breakBrick( brick, now ) {
  brick.alive = false;
  state.bricksBroken++;
  updateBallSpeed();

  state.combo++;
  const points = brick.points * comboMult();
  state.score += points;
  state.explosions.push( { x: brick.x, y: brick.y, color: brick.color, startTime: now } );
  spawnParticles( brick, now );
  state.floatingTexts.push( {
    x: brick.x + BRICK_W / 2,
    y: brick.y,
    text: `+${ points }`,
    startTime: now,
  } );
  playSound( sounds.break );

  if ( state.bricks.every( b => !b.alive ) ) state.status = 'win';
}

function loseLife() {
  state.lives--;
  if ( state.lives <= 0 ) {
    state.status = 'gameover';
    state.trail.length = 0;
  } else {
    state.status = 'serve';
    placeBallOnPaddle();
  }
}

function spawnParticles( brick, now ) {
  const cx = brick.x + BRICK_W / 2 - PARTICLE_SIZE / 2;
  const cy = brick.y + BRICK_H / 2 - PARTICLE_SIZE / 2;

  for ( let i = 0; i < PARTICLES_PER_BRICK; i++ ) {
    const angle = Math.random() * Math.PI * 2;
    state.particles.push( {
      x: cx,
      y: cy,
      vx: Math.cos( angle ) * PARTICLE_SPEED,
      vy: Math.sin( angle ) * PARTICLE_SPEED,
      color: brick.color,
      startTime: now,
    } );
  }
}

function updateParticles( dt, now ) {
  for ( const p of state.particles ) {
    p.vy += PARTICLE_GRAVITY * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
  state.particles = state.particles.filter( p => now - p.startTime < PARTICLE_LIFE );
}

function updateFloatingTexts( now ) {
  state.floatingTexts = state.floatingTexts.filter( ft => now - ft.startTime < FLOAT_TEXT_LIFE );
}

function updateExplosions( now ) {
  state.explosions = state.explosions.filter(
    ex => Math.floor( ( now - ex.startTime ) / EXPLOSION_DURATION ) < EXPLOSION_FRAME_COUNT
  );
}

// Dibujo
function draw( now ) {
  ctx.clearRect( 0, 0, CANVAS_W, CANVAS_H );

  drawField( now );

  drawHud();
  drawOverlay();
}

function drawField( now ) {
  for ( const brick of state.bricks ) {
    if ( !brick.alive ) continue;
    drawSprite( ctx, `block_${ brick.color }`, brick.x, brick.y, BRICK_W, BRICK_H );

    // El bloque dañado se suma a sí mismo para aclararse sin teñir el fondo
    if ( !brick.damaged ) continue;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = GRAY_DAMAGED_LIGHTEN;
    drawSprite( ctx, `block_${ brick.color }`, brick.x, brick.y, BRICK_W, BRICK_H );
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  for ( const ex of state.explosions ) {
    const idx = Math.floor( ( now - ex.startTime ) / EXPLOSION_DURATION );
    const frame = EXPLOSION_FRAMES[ ex.color ][ idx ];
    if ( frame ) drawFrame( ctx, frame, ex.x, ex.y, BRICK_W, BRICK_H );
  }

  // Escombros del bloque roto
  for ( const p of state.particles ) {
    ctx.globalAlpha = Math.max( 0, 1 - ( now - p.startTime ) / PARTICLE_LIFE );
    ctx.fillStyle = PARTICLE_COLORS[ p.color ];
    ctx.fillRect( p.x, p.y, PARTICLE_SIZE, PARTICLE_SIZE );
  }
  ctx.globalAlpha = 1;

  const { paddle, ball } = state;

  // Estela de la bola, de la posición más reciente a la más antigua
  for ( let i = 0; i < state.trail.length; i++ ) {
    const t = state.trail[ i ];
    ctx.globalAlpha = TRAIL_MAX_ALPHA * ( 1 - i / TRAIL_LENGTH );
    drawSprite( ctx, 'ball', t.x, t.y, ball.size, ball.size );
  }
  ctx.globalAlpha = 1;

  drawSprite( ctx, 'paddle', paddle.x, paddle.y, paddle.w, paddle.h );
  if ( state.status !== 'gameover' ) {
    drawSprite( ctx, 'ball', ball.x, ball.y, ball.size, ball.size );
  }

  // Puntos que suben y se desvanecen sobre el bloque roto
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 18px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for ( const ft of state.floatingTexts ) {
    const progress = ( now - ft.startTime ) / FLOAT_TEXT_LIFE;
    ctx.globalAlpha = Math.max( 0, 1 - progress );
    ctx.fillText( ft.text, ft.x, ft.y - FLOAT_TEXT_RISE * progress );
  }
  ctx.globalAlpha = 1;
}

function drawHud() {
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 22px monospace';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  const scoreText = `PUNTOS: ${ state.score }`;
  ctx.fillText( scoreText, 16, 40 );

  // El multiplicador solo se muestra cuando hay cadena de verdad
  const mult = comboMult();
  if ( mult >= 2 ) {
    ctx.fillStyle = '#e6d43c';
    ctx.fillText( `×${ mult }`, 16 + ctx.measureText( scoreText ).width + 16, 40 );
    ctx.fillStyle = '#fff';
  }

  // Vidas como bolas, de derecha a izquierda
  const livesWidth = state.lives * HUD_LIFE_SIZE + Math.max( 0, state.lives - 1 ) * HUD_LIFE_GAP;
  const livesX = CANVAS_W - 16 - livesWidth;
  for ( let i = 0; i < state.lives; i++ ) {
    const x = livesX + i * ( HUD_LIFE_SIZE + HUD_LIFE_GAP );
    drawSprite( ctx, 'ball', x, 40 - HUD_LIFE_SIZE / 2, HUD_LIFE_SIZE, HUD_LIFE_SIZE );
  }

  ctx.textAlign = 'right';
  ctx.fillText( 'VIDAS:', livesX - HUD_LIFE_GAP * 2, 40 );
}

function drawOverlay() {
  let title = '';
  let subtitle = '';

  switch ( state.status ) {
    case 'serve':
      subtitle = 'Pulsa Espacio';
      break;
    case 'paused':
      title = 'PAUSA';
      break;
    case 'gameover':
      title = 'GAME OVER';
      subtitle = 'Pulsa Enter para reiniciar';
      break;
    case 'win':
      title = '¡VICTORIA!';
      subtitle = 'Pulsa Enter para reiniciar';
      break;
    default:
      return;
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if ( title ) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect( 0, 0, CANVAS_W, CANVAS_H );
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 56px monospace';
    ctx.fillText( title, CANVAS_W / 2, CANVAS_H / 2 - 20 );
  }

  if ( subtitle ) {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 22px monospace';
    ctx.fillText( subtitle, CANVAS_W / 2, title ? CANVAS_H / 2 + 36 : PADDLE_Y - 60 );
  }
}

// Bucle principal
let lastTime = 0;

function loop( now ) {
  const dt = Math.min( ( now - lastTime ) / 1000, MAX_DT );
  lastTime = now;

  update( dt, now );
  draw( now );

  requestAnimationFrame( loop );
}

loadSpritesheet( () => {
  resetGame();
  requestAnimationFrame( now => {
    lastTime = now;
    loop( now );
  } );
} );
