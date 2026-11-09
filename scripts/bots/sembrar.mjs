// Rellena `scores` con partidas simuladas de los bots, rapido y sin navegador.
// Cada bot inicia sesion con la clave publica e inserta sus filas como lo hace
// el reproductor (RLS + trigger de alias), con puntuaciones aleatorias segun su
// habilidad y el juego. Despues prueba que la base de datos rechaza lo que debe
// rechazar (SPEC 14) y sale con codigo 1 si algo falla.
//
//   npm run bots:sembrar -- --partidas=10 [--bots=5] [--sin-comprobaciones]

import {
  anonClient, botClient, botIndex, botSkill, adminClient, fail, fmt, GAMES, listBots,
  parseArgs, pool,
} from "./common.mjs";

const args = parseArgs({ partidas: 8 });
const perBot = Number(args.partidas);
if (!Number.isInteger(perBot) || perBot < 1 || perBot > 200) {
  fail("--partidas debe ser un entero entre 1 y 200.");
}

// Mediana aproximada de una partida normal y multiplo de los puntos de cada juego.
const PROFILE = {
  asteroids: { median: 6000, step: 20 },
  tetris: { median: 8000, step: 10 },
  arkanoid: { median: 2500, step: 10 },
  snake: { median: 400, step: 10 },
  frogger: { median: 1500, step: 10 },
};

function randomScore(game, skill) {
  const { median, step } = PROFILE[game];
  // Log-normal: muchas partidas flojas y alguna muy buena.
  const u = Math.random() || 1e-9;
  const v = Math.random();
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  const raw = median * skill * Math.exp(0.7 * z);
  return Math.max(0, Math.round(raw / step) * step);
}

const admin = adminClient();
let bots = await listBots(admin);
if (args.bots) bots = bots.slice(0, Number(args.bots));
if (!bots.length) fail("No hay bots. Crea algunos antes con: npm run bots:crear -- --n=12");

console.log(`Sembrando ${perBot} partidas por bot con ${bots.length} bots…`);

const problems = [];
let inserted = 0;

const sessions = await pool(bots, 5, async (bot) => {
  try {
    const session = await botClient(bot.email);
    const skill = botSkill(botIndex(bot.email));
    // Cada bot tiene 2–5 juegos favoritos y reparte sus partidas entre ellos.
    const favs = [...GAMES].sort(() => Math.random() - 0.5).slice(0, 2 + Math.floor(Math.random() * 4));
    const rows = Array.from({ length: perBot }, () => {
      const game_id = favs[Math.floor(Math.random() * favs.length)];
      return { game_id, player_name: "BOT", score: randomScore(game_id, skill), user_id: session.user.id };
    });
    const { error } = await session.client.from("scores").insert(rows);
    if (error) problems.push(`${bot.email}: insercion rechazada (${error.message})`);
    else inserted += rows.length;
    return session;
  } catch (e) {
    problems.push(String(e.message ?? e));
    return null;
  }
});

console.log(`✔ ${fmt(inserted)} puntuaciones insertadas`);

// ── Comprobaciones de seguridad ────────────────────────────────────────────
const checks = [];

async function check(name, fn) {
  try {
    const result = await fn();
    checks.push({ name, ok: result === true, detail: result === true ? "" : String(result) });
  } catch (e) {
    checks.push({ name, ok: false, detail: String(e.message ?? e) });
  }
}

const live = sessions.filter(Boolean);
if (!args["sin-comprobaciones"] && live.length >= 2) {
  const [a, b] = live;
  const { data: profA } = await admin.from("profiles").select("username").eq("id", a.user.id).single();

  await check("El alias lo pone el trigger, no el cliente", async () => {
    const { data, error } = await a.client
      .from("scores")
      .insert({ game_id: "snake", player_name: "HACKER", score: 10, user_id: a.user.id })
      .select("player_name")
      .single();
    if (error) return `insercion rechazada: ${error.message}`;
    return data.player_name === profA.username || `se guardo como ${data.player_name}`;
  });

  await check("No se puede guardar a nombre de otro usuario", async () => {
    const { error } = await a.client
      .from("scores")
      .insert({ game_id: "snake", player_name: "X", score: 10, user_id: b.user.id });
    return !!error || "se acepto una fila con el user_id de otro bot";
  });

  await check("Sin sesion no se puede guardar", async () => {
    const { error } = await anonClient()
      .from("scores")
      .insert({ game_id: "snake", player_name: "ANON", score: 10, user_id: null });
    return !!error || "anon pudo insertar";
  });

  await check("Puntuacion negativa rechazada", async () => {
    const { error } = await a.client
      .from("scores")
      .insert({ game_id: "snake", player_name: "X", score: -50, user_id: a.user.id });
    return !!error || "se acepto score < 0";
  });

  await check("Juego inexistente rechazado", async () => {
    const { error } = await a.client
      .from("scores")
      .insert({ game_id: "no-existe", player_name: "X", score: 10, user_id: a.user.id });
    return !!error || "se acepto un game_id que no esta en games";
  });

  await check("No se pueden editar puntuaciones propias", async () => {
    const { data, error } = await a.client
      .from("scores")
      .update({ score: 999999 })
      .eq("user_id", a.user.id)
      .select("id");
    return !!error || data.length === 0 || `se modificaron ${data.length} filas`;
  });

  await check("No se pueden borrar puntuaciones propias", async () => {
    const { data, error } = await a.client.from("scores").delete().eq("user_id", a.user.id).select("id");
    return !!error || data.length === 0 || `se borraron ${data.length} filas`;
  });

  await check("No se puede escribir en profiles desde el cliente", async () => {
    const { data, error } = await a.client
      .from("profiles")
      .update({ username: "BOT_PWNED" })
      .eq("id", a.user.id)
      .select("id");
    return !!error || data.length === 0 || "se cambio el alias saltandose update_profile";
  });

  await check("update_profile rechaza un alias ocupado", async () => {
    const { data: profB } = await admin.from("profiles").select("username").eq("id", b.user.id).single();
    const { error } = await a.client.rpc("update_profile", { new_username: profB.username, new_avatar: "robot" });
    return /username_taken/.test(error?.message ?? "") || `respuesta: ${error?.message ?? "aceptado"}`;
  });

  console.log("\nComprobaciones:");
  for (const c of checks) console.log(`  ${c.ok ? "✔" : "✖"} ${c.name}${c.detail ? ` — ${c.detail}` : ""}`);
}

const failed = checks.filter((c) => !c.ok);
if (problems.length) {
  console.log(`\n⚠ ${problems.length} problemas:`);
  for (const p of problems) console.log(`  - ${p}`);
}
if (problems.length || failed.length) process.exit(1);
