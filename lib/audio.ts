// Sonido común de los juegos (SPEC 16). Un solo AudioContext para toda la app,
// creado en el primer gesto del usuario (los navegadores no dejan sonar nada
// antes). Los efectos se sintetizan con osciladores y ruido filtrado; los
// motores disparan los suyos (disparo, giro, salto…) y los reproductores los
// genéricos desde los callbacks. Las muestras (MP3 de
// Arkanoid) se descargan una vez y se reutilizan. Todo pasa por un GainNode
// maestro, así que el silencio global afecta a ambos.
//
// El silencio se recuerda en localStorage (`av_muted`) y se expone como
// almacén externo para useSyncExternalStore (ver lib/use-sound.ts).

export type Sfx =
  // Genéricos (los dispara el reproductor desde los callbacks)
  | "score" | "eat" | "line" | "hit" | "levelup" | "pause" | "gameover"
  // Asteroids
  | "laser" | "explodeL" | "explodeM" | "explodeS" | "shipExplode" | "shield" | "powerup"
  // Tetris
  | "move" | "rotate" | "bump" | "soft" | "harddrop" | "lock" | "tetris"
  // Frogger
  | "hop" | "splash" | "squash" | "home";

/** Sonidos continuos: suenan mientras estén activos (`setLoop`). */
export type Loop = "thrust";

const MASTER_VOLUME = 0.35;
/** Un mismo efecto no se repite antes de este intervalo (ráfagas de callbacks). */
const MIN_GAP_MS = 60;
const MUTED_KEY = "av_muted";

type Note = {
  /** Frecuencia inicial en Hz. */
  freq: number;
  /** Frecuencia final (glissando); si falta, la nota es fija. */
  to?: number;
  /** Duración en segundos. */
  dur: number;
};

/** Notas seguidas de un oscilador. `at`: retardo en segundos desde el inicio del efecto. */
type ToneLayer = { kind: "tone"; wave: OscillatorType; notes: Note[]; gain?: number; at?: number };
/** Ráfaga de ruido blanco filtrado: explosiones, golpes, agua. */
type NoiseLayer = {
  kind: "noise";
  dur: number;
  filter: BiquadFilterType;
  /** Frecuencia de corte inicial y final del filtro (barrido). */
  from: number;
  to: number;
  q?: number;
  gain?: number;
  at?: number;
};
type Layer = ToneLayer | NoiseLayer;

const tone = (wave: OscillatorType, notes: Note[], gain?: number, at?: number): ToneLayer => ({ kind: "tone", wave, notes, gain, at });
const seq = (freqs: number[], dur: number) => freqs.map((freq) => ({ freq, dur }));
const noise = (
  dur: number, filter: BiquadFilterType, from: number, to: number, gain?: number, q?: number, at?: number,
): NoiseLayer => ({ kind: "noise", dur, filter, from, to, gain, q, at });

// Recetas: las capas de un efecto empiezan a la vez salvo que lleven `at`. Ninguna pasa de 700 ms.
const RECIPES: Record<Sfx, Layer[]> = {
  score: [tone("square", [{ freq: 880, to: 1320, dur: 0.06 }], 0.5)],
  eat: [tone("square", [{ freq: 660, dur: 0.05 }, { freq: 990, dur: 0.06 }], 0.55)],
  line: [tone("triangle", seq([523, 659, 784, 1047], 0.06)), noise(0.2, "highpass", 6000, 2000, 0.25)],
  hit: [tone("sawtooth", [{ freq: 220, to: 70, dur: 0.28 }], 0.7)],
  levelup: [tone("square", seq([392, 523, 659, 784, 1047], 0.07), 0.45)],
  pause: [tone("triangle", [{ freq: 660, dur: 0.07 }, { freq: 440, dur: 0.09 }])],
  gameover: [tone("triangle", seq([392, 330, 262, 196], 0.15))],

  laser: [tone("square", [{ freq: 1400, to: 220, dur: 0.12 }], 0.3)],
  explodeL: [noise(0.65, "lowpass", 900, 60, 1), tone("sine", [{ freq: 90, to: 35, dur: 0.45 }], 0.8)],
  explodeM: [noise(0.42, "lowpass", 1500, 100, 0.9), tone("sine", [{ freq: 130, to: 50, dur: 0.28 }], 0.6)],
  explodeS: [noise(0.22, "lowpass", 2800, 300, 0.8)],
  shipExplode: [noise(0.7, "lowpass", 2000, 50, 1), tone("sawtooth", [{ freq: 320, to: 40, dur: 0.6 }], 0.5)],
  shield: [tone("triangle", [{ freq: 300, to: 1200, dur: 0.16 }], 0.5), noise(0.12, "highpass", 3000, 6000, 0.3)],
  powerup: [tone("square", seq([660, 880, 1320, 1760], 0.05), 0.4)],

  move: [tone("square", [{ freq: 320, dur: 0.025 }], 0.22)],
  rotate: [tone("triangle", [{ freq: 620, to: 940, dur: 0.05 }], 0.45), noise(0.03, "bandpass", 4000, 4000, 0.2, 2)],
  bump: [tone("sine", [{ freq: 130, to: 90, dur: 0.06 }], 0.5)],
  soft: [tone("square", [{ freq: 240, dur: 0.02 }], 0.14)],
  harddrop: [noise(0.14, "lowpass", 4000, 250, 0.7), tone("sine", [{ freq: 170, to: 45, dur: 0.2 }], 0.9)],
  lock: [tone("sine", [{ freq: 150, to: 70, dur: 0.08 }], 0.6), noise(0.05, "bandpass", 900, 600, 0.35, 1.5)],
  tetris: [
    tone("square", seq([523, 659, 784, 1047, 1319, 1568], 0.06), 0.4),
    tone("triangle", seq([262, 330, 392, 523, 659, 784], 0.06), 0.4),
    noise(0.4, "highpass", 7000, 2500, 0.25),
  ],

  hop: [tone("square", [{ freq: 260, to: 560, dur: 0.07 }], 0.32)],
  // Agua: "plop" de entrada, chapoteo de ruido que se apaga hacia grave,
  // salpicadura aguda y tres burbujas que suben ("blup-blup-blup").
  splash: [
    tone("sine", [{ freq: 700, to: 140, dur: 0.09 }], 0.6),
    noise(0.5, "bandpass", 1800, 450, 0.95, 0.9),
    noise(0.3, "highpass", 5000, 2200, 0.3, 0.7, 0.02),
    tone("sine", [{ freq: 300, to: 760, dur: 0.05 }], 0.45, 0.28),
    tone("sine", [{ freq: 360, to: 900, dur: 0.04 }], 0.4, 0.38),
    tone("sine", [{ freq: 280, to: 680, dur: 0.05 }], 0.35, 0.47),
  ],
  // Atropello: choque. Golpe seco de ruido ancho con bombo grave, chapa
  // metálica (dos tonos inarmónicos) y cristales que caen.
  squash: [
    noise(0.35, "lowpass", 7000, 180, 1, 0.7),
    tone("sine", [{ freq: 150, to: 40, dur: 0.28 }], 1),
    tone("square", [{ freq: 1850, to: 1250, dur: 0.09 }], 0.18),
    tone("square", [{ freq: 2730, to: 2100, dur: 0.12 }], 0.14),
    noise(0.12, "bandpass", 1400, 900, 0.5, 3, 0.03),
    noise(0.3, "highpass", 8000, 5000, 0.3, 0.7, 0.08),
  ],
  home: [tone("triangle", seq([784, 988, 1175, 1568], 0.07), 0.6)],
};

// ===== contexto =====

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;

/**
 * Crea o reanuda el AudioContext. Hay que llamarla dentro de un manejador de
 * gesto (keydown, pointerdown): Safari solo lo reanuda ahí.
 */
export function unlockAudio(): void {
  if (typeof window === "undefined") return;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    ctx = new Ctor();
    master = ctx.createGain();
    master.connect(ctx.destination);
    applyVolume();
  }
  if (ctx.state === "suspended") void ctx.resume().catch(() => {});
}

function ready(): { ctx: AudioContext; master: GainNode } | null {
  if (!ctx || !master || ctx.state !== "running" || isMuted()) return null;
  return { ctx, master };
}

/** Un segundo de ruido blanco, generado una vez y reutilizado por todos los efectos. */
function getNoise(c: AudioContext): AudioBuffer {
  if (!noiseBuffer) {
    noiseBuffer = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  return noiseBuffer;
}

/** Envolvente: ataque de 5 ms y caída exponencial, sin chasquidos. */
function envelope(c: AudioContext, t: number, dur: number, peak: number): GainNode {
  const env = c.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(peak, t + 0.005);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  return env;
}

function playTone(c: AudioContext, out: AudioNode, layer: ToneLayer, start: number) {
  const peak = layer.gain ?? 0.6;
  let t = start;
  for (const note of layer.notes) {
    const osc = c.createOscillator();
    osc.type = layer.wave;
    osc.frequency.setValueAtTime(note.freq, t);
    if (note.to) osc.frequency.exponentialRampToValueAtTime(note.to, t + note.dur);
    osc.connect(envelope(c, t, note.dur, peak)).connect(out);
    osc.start(t);
    osc.stop(t + note.dur + 0.02);
    t += note.dur;
  }
}

function playNoise(c: AudioContext, out: AudioNode, layer: NoiseLayer, t: number) {
  const src = c.createBufferSource();
  src.buffer = getNoise(c);
  const filter = c.createBiquadFilter();
  filter.type = layer.filter;
  filter.Q.value = layer.q ?? 0.8;
  filter.frequency.setValueAtTime(layer.from, t);
  filter.frequency.exponentialRampToValueAtTime(layer.to, t + layer.dur);
  src.connect(filter).connect(envelope(c, t, layer.dur, layer.gain ?? 0.7)).connect(out);
  // Empieza en un punto al azar del buffer: dos explosiones seguidas no suenan idénticas.
  src.start(t, Math.random() * 0.5);
  src.stop(t + layer.dur + 0.02);
}

const lastPlayed = new Map<Sfx, number>();

export function playSfx(sfx: Sfx): void {
  const audio = ready();
  if (!audio) return;

  const now = performance.now();
  if (now - (lastPlayed.get(sfx) ?? -Infinity) < MIN_GAP_MS) return;
  lastPlayed.set(sfx, now);

  const t = audio.ctx.currentTime;
  for (const layer of RECIPES[sfx]) {
    const start = t + (layer.at ?? 0);
    if (layer.kind === "tone") playTone(audio.ctx, audio.master, layer, start);
    else playNoise(audio.ctx, audio.master, layer, start);
  }
}

// ===== sonidos continuos =====

type LoopNodes = { src: AudioBufferSourceNode; gain: GainNode };
const loops = new Map<Loop, LoopNodes>();

/** Motor del cohete: ruido grave en bucle con un temblor lento del filtro. */
function startThrust(c: AudioContext, out: AudioNode): LoopNodes {
  const src = c.createBufferSource();
  src.buffer = getNoise(c);
  src.loop = true;
  const filter = c.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 520;
  filter.Q.value = 1.2;
  const lfo = c.createOscillator();
  const lfoDepth = c.createGain();
  lfo.frequency.value = 9;
  lfoDepth.gain.value = 140;
  lfo.connect(lfoDepth).connect(filter.frequency);
  lfo.start();
  src.addEventListener("ended", () => lfo.stop());
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.0001, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.55, c.currentTime + 0.06);
  src.connect(filter).connect(gain).connect(out);
  src.start();
  return { src, gain };
}

/**
 * Enciende o apaga un sonido continuo. Es idempotente: se puede llamar en cada
 * frame con el estado actual. Al apagar se desvanece en 80 ms.
 */
export function setLoop(loop: Loop, on: boolean): void {
  const current = loops.get(loop);
  if (!on) {
    if (!current || !ctx) return;
    loops.delete(loop);
    const t = ctx.currentTime;
    current.gain.gain.cancelScheduledValues(t);
    current.gain.gain.setValueAtTime(Math.max(current.gain.gain.value, 0.0001), t);
    current.gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    current.src.stop(t + 0.1);
    return;
  }
  if (current) return;
  const audio = ready();
  if (!audio) return;
  loops.set(loop, startThrust(audio.ctx, audio.master));
}

// ===== muestras =====

const buffers = new Map<string, Promise<AudioBuffer | null>>();

function loadSample(c: AudioContext, url: string): Promise<AudioBuffer | null> {
  let buffer = buffers.get(url);
  if (!buffer) {
    buffer = fetch(url)
      .then((res) => (res.ok ? res.arrayBuffer() : Promise.reject(new Error(String(res.status)))))
      .then((data) => c.decodeAudioData(data))
      .catch(() => null);
    buffers.set(url, buffer);
  }
  return buffer;
}

/** Suena un fichero de audio (descargado y decodificado solo la primera vez). */
export function playSample(url: string): void {
  const audio = ready();
  if (!audio) return;
  void loadSample(audio.ctx, url).then((buffer) => {
    // El silencio puede haber llegado mientras se descargaba.
    if (!buffer || isMuted()) return;
    const src = audio.ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(audio.master);
    src.start();
  });
}

/** Descarga por adelantado una muestra (si el contexto ya existe). */
export function preloadSample(url: string): void {
  if (ctx) void loadSample(ctx, url);
}

// ===== silencio (almacén externo) =====

type Listener = () => void;
const listeners = new Set<Listener>();
/** Respaldo en memoria si localStorage está bloqueado (navegación privada). */
let memoryMuted = false;

export function isMuted(): boolean {
  try {
    return localStorage.getItem(MUTED_KEY) === "1";
  } catch {
    return memoryMuted;
  }
}

export function setMuted(muted: boolean): void {
  memoryMuted = muted;
  try {
    if (muted) localStorage.setItem(MUTED_KEY, "1");
    else localStorage.removeItem(MUTED_KEY);
  } catch {
    // Sin persistencia: el respaldo en memoria mantiene el estado de la visita.
  }
  applyVolume();
  for (const listener of listeners) listener();
}

export function subscribeMuted(onChange: Listener): () => void {
  listeners.add(onChange);
  // "storage" llega cuando se cambia en otra pestaña.
  const onStorage = (e: StorageEvent) => {
    if (e.key === MUTED_KEY) {
      applyVolume();
      onChange();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

function applyVolume() {
  // Silenciar también corta lo que ya está sonando.
  if (master && ctx) master.gain.setValueAtTime(isMuted() ? 0 : MASTER_VOLUME, ctx.currentTime);
}
