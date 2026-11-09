// Bots que juegan de verdad en un navegador (Playwright + Chromium sin ventana).
// Cada bot: inicia sesion en /acceso, abre /jugar/<id>, comprueba que el HUD
// muestra su alias, prueba PAUSA/REANUDAR, juega pulsando teclas hasta morir (o
// pulsa FIN al agotar el tiempo), guarda desde el modal y comprueba en Supabase
// que la fila llego con su puntuacion y su alias. Al final visita su perfil.
// Recoge errores de consola, excepciones de la pagina y respuestas HTTP >= 400.
// Deja un informe JSON en bot-reports/ y sale con codigo 1 si hubo problemas.
//
// Necesita el servidor en marcha (npm run dev o npm start).
//
//   npm run bots:jugar -- --bots=3 --partidas=1 --juegos=snake,tetris --max=60 [--ver]
//   [--url=http://localhost:3000]

import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import {
  adminClient, anonClient, BOT_PASSWORD, fail, fmt, GAMES, listBots, parseArgs, pool,
} from "./common.mjs";

const args = parseArgs({ bots: 3, partidas: 1, max: 60, url: "http://localhost:3000" });
const BASE = String(args.url).replace(/\/$/, "");
const nBots = Number(args.bots);
const perGame = Number(args.partidas);
const maxMs = Number(args.max) * 1000;
const games = args.juegos ? String(args.juegos).split(",").map((g) => g.trim()) : GAMES;
const unknown = games.filter((g) => !GAMES.includes(g));
if (unknown.length) fail(`Juegos desconocidos: ${unknown.join(", ")}. Validos: ${GAMES.join(", ")}`);

try {
  const res = await fetch(`${BASE}/inicio`);
  if (!res.ok) fail(`${BASE}/inicio respondio ${res.status}.`);
} catch {
  fail(`No hay servidor en ${BASE}. Arrancalo con npm run dev (o pasa --url=...).`);
}

const bots = (await listBots(adminClient())).slice(0, nBots);
if (bots.length < nBots) {
  fail(`Hay ${bots.length} bots y pediste ${nBots}. Crea mas con: npm run bots:crear -- --n=${nBots}`);
}

// ── Estrategias: una accion por llamada, sin leer el canvas ────────────────
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

async function hold(page, key, ms) {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
}

const PERP = {
  ArrowUp: ["ArrowLeft", "ArrowRight"], ArrowDown: ["ArrowLeft", "ArrowRight"],
  ArrowLeft: ["ArrowUp", "ArrowDown"], ArrowRight: ["ArrowUp", "ArrowDown"],
};

const STRATEGIES = {
  asteroids: async (page) => {
    const r = Math.random();
    if (r < 0.35) await hold(page, pick(["ArrowLeft", "ArrowRight"]), rnd(80, 350));
    else if (r < 0.5) await hold(page, "ArrowUp", rnd(100, 300));
    else {
      await page.keyboard.press("Space");
      await page.waitForTimeout(rnd(60, 150));
    }
  },
  tetris: async (page) => {
    const rotations = Math.floor(rnd(0, 4));
    for (let k = 0; k < rotations; k++) await page.keyboard.press("ArrowUp");
    const dir = pick(["ArrowLeft", "ArrowRight"]);
    const moves = Math.floor(rnd(0, 6));
    for (let k = 0; k < moves; k++) await page.keyboard.press(dir);
    await page.waitForTimeout(rnd(100, 400));
    await page.keyboard.press("Space");
  },
  arkanoid: async (page) => {
    await page.keyboard.press("Space"); // saca la bola si esta esperando
    await hold(page, pick(["ArrowLeft", "ArrowRight"]), rnd(100, 450));
  },
  snake: async (page, state) => {
    state.dir = pick(PERP[state.dir ?? "ArrowRight"]);
    await page.keyboard.press(state.dir);
    await page.waitForTimeout(rnd(150, 700));
  },
  frogger: async (page) => {
    const r = Math.random();
    await page.keyboard.press(r < 0.65 ? "ArrowUp" : r < 0.9 ? pick(["ArrowLeft", "ArrowRight"]) : "ArrowDown");
    await page.waitForTimeout(rnd(150, 500));
  },
};

// ── Una partida ────────────────────────────────────────────────────────────
const parseNum = (text) => Number(String(text).replace(/\D/g, "")) || 0;

async function playOne(page, bot, game, { testPause }) {
  const r = { bot: bot.alias, game, problems: [] };
  const t0 = Date.now();
  const res = await page.goto(`${BASE}/jugar/${game}`);
  if (!res?.ok()) r.problems.push(`/jugar/${game} respondio ${res?.status()}`);
  await page.locator("canvas").first().waitFor({ state: "visible", timeout: 20000 });
  r.loadMs = Date.now() - t0;

  // El HUD debe mostrar el alias de la cuenta, no INVITADO.
  const hudName = page.locator(".hud-stat.player .v");
  try {
    await page.waitForFunction(
      (alias) => document.querySelector(".hud-stat.player .v")?.textContent === alias,
      bot.alias,
      { timeout: 10000 },
    );
  } catch {
    r.problems.push(`el HUD muestra "${await hudName.textContent()}" en vez de ${bot.alias}`);
  }

  if (testPause) {
    await page.getByRole("button", { name: "PAUSA", exact: true }).click();
    if (!(await page.locator(".crt-pause").isVisible())) r.problems.push("PAUSA no muestra EN PAUSA");
    await page.getByRole("button", { name: "REANUDAR", exact: true }).click();
    if (await page.locator(".crt-pause").isVisible()) r.problems.push("REANUDAR no quita EN PAUSA");
    // Que Espacio no vuelva a pulsar el boton con foco.
    await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur());
  }

  const modal = page.locator("#av-over-title");
  const state = {};
  const tPlay = Date.now();
  let actions = 0;
  while (!(await modal.isVisible())) {
    if (Date.now() - tPlay > maxMs) {
      r.endedBy = "FIN";
      await page.getByRole("button", { name: "FIN", exact: true }).click();
      break;
    }
    await STRATEGIES[game](page, state);
    actions++;
  }
  r.endedBy ??= "muerte";
  await modal.waitFor({ timeout: 5000 });
  r.playMs = Date.now() - tPlay;
  r.actions = actions;

  r.score = parseNum(await page.locator(".modal .final").textContent());
  const hudScore = parseNum(await page.locator(".hud-stat").nth(1).locator(".v").textContent());
  if (hudScore !== r.score) r.problems.push(`HUD ${hudScore} ≠ modal ${r.score}`);

  const saveBtn = page.getByRole("button", { name: "GUARDAR PUNTUACIÓN" });
  if (!(await saveBtn.isVisible())) {
    r.problems.push("el modal no ofrece GUARDAR PUNTUACIÓN con sesion iniciada");
    return r;
  }
  const tSave = Date.now();
  await saveBtn.click();
  const outcome = await Promise.race([
    page.locator(".toast-saved").waitFor({ timeout: 15000 }).then(() => "ok"),
    page.locator(".save-error").waitFor({ timeout: 15000 }).then(() => "error"),
  ]).catch(() => "timeout");
  r.saveMs = Date.now() - tSave;
  r.saved = outcome === "ok";
  if (!r.saved) r.problems.push(`guardar termino en ${outcome}`);

  // La fila debe estar en Supabase con la puntuacion y el alias correctos.
  if (r.saved) {
    const { data, error } = await anonClient()
      .from("scores")
      .select("score, player_name")
      .eq("user_id", bot.id)
      .eq("game_id", game)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) r.problems.push(`no se encuentra la fila en scores (${error?.message ?? "sin fila"})`);
    else if (data.score !== r.score || data.player_name !== bot.alias) {
      r.problems.push(`fila en BD (${data.player_name}, ${data.score}) ≠ partida (${bot.alias}, ${r.score})`);
    }
  }
  return r;
}

// ── Un bot ─────────────────────────────────────────────────────────────────
const errors = [];

async function runBot(browser, user) {
  // El alias real es el de `profiles` (el trigger puede haberlo cambiado).
  const { data: prof } = await anonClient().from("profiles").select("username").eq("id", user.id).maybeSingle();
  const alias = prof?.username ?? user.user_metadata?.username ?? user.email;
  const bot = { id: user.id, email: user.email, alias };
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  let where = "acceso";
  const log = (kind, text) => errors.push({ bot: alias, where, kind, text: text.slice(0, 300) });
  page.on("console", (m) => m.type() === "error" && log("consola", m.text()));
  page.on("pageerror", (e) => log("excepcion", e.message));
  page.on("response", (res) => res.status() >= 400 && log(`HTTP ${res.status()}`, res.url()));
  page.on("requestfailed", (req) => {
    const f = req.failure()?.errorText ?? "";
    if (!f.includes("ERR_ABORTED")) log("red", `${req.url()} ${f}`);
  });

  const results = [];
  const botInfo = { alias, problems: [] };
  try {
    const t0 = Date.now();
    await page.goto(`${BASE}/acceso`);
    await page.locator("form.only-in input[type=email]").fill(user.email);
    await page.locator("form.only-in input[type=password]").fill(BOT_PASSWORD);
    await page.locator("form.only-in button[type=submit]").click();
    await page.getByRole("button", { name: "CERRAR SESIÓN" }).first().waitFor({ timeout: 20000 });
    botInfo.loginMs = Date.now() - t0;

    let first = true;
    for (const game of games) {
      for (let k = 0; k < perGame; k++) {
        where = game;
        try {
          const r = await playOne(page, bot, game, { testPause: first });
          results.push(r);
          console.log(
            `  ${r.problems.length ? "⚠" : "✔"} ${alias.padEnd(10)} ${game.padEnd(9)} ${fmt(r.score).padStart(7)} pts` +
              ` · ${(r.playMs / 1000).toFixed(0)} s (${r.endedBy})${r.problems.length ? ` · ${r.problems.join("; ")}` : ""}`,
          );
        } catch (e) {
          results.push({ bot: alias, game, problems: [`la partida fallo: ${e.message.split("\n")[0]}`] });
          console.log(`  ✖ ${alias.padEnd(10)} ${game.padEnd(9)} ${e.message.split("\n")[0]}`);
        }
        first = false;
      }
    }

    where = "perfil";
    const res = await page.goto(`${BASE}/jugador/${alias}`);
    if (!res?.ok()) botInfo.problems.push(`/jugador/${alias} respondio ${res?.status()}`);
    else if (!(await page.getByText(alias).first().isVisible())) botInfo.problems.push("el perfil no muestra el alias");
  } catch (e) {
    botInfo.problems.push(`${where}: ${e.message.split("\n")[0]}`);
    console.log(`  ✖ ${alias} ${where}: ${e.message.split("\n")[0]}`);
  } finally {
    await context.close();
  }
  return { botInfo, results };
}

// ── Ejecucion e informe ────────────────────────────────────────────────────
console.log(`${nBots} bots × ${games.length} juegos × ${perGame} partidas contra ${BASE}\n`);
const browser = await chromium.launch({ headless: !args.ver, slowMo: args.ver ? 30 : 0 });
const tStart = Date.now();
const perBot = await pool(bots, nBots, (u) => runBot(browser, u));
await browser.close();

const results = perBot.flatMap((b) => b.results);
const botProblems = perBot.flatMap((b) => b.botInfo.problems.map((p) => `${b.botInfo.alias}: ${p}`));

const summary = games.map((game) => {
  const rs = results.filter((r) => r.game === game && r.score !== undefined);
  const scores = rs.map((r) => r.score);
  return {
    game,
    partidas: rs.length,
    guardadas: rs.filter((r) => r.saved).length,
    media: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
    max: scores.length ? Math.max(...scores) : 0,
    duracionMediaS: rs.length ? Math.round(rs.reduce((a, r) => a + r.playMs, 0) / rs.length / 1000) : 0,
    cargaMediaMs: rs.length ? Math.round(rs.reduce((a, r) => a + r.loadMs, 0) / rs.length) : 0,
    guardadoMedioMs: rs.length ? Math.round(rs.reduce((a, r) => a + (r.saveMs ?? 0), 0) / rs.length) : 0,
  };
});

// Errores agrupados por texto para que se lean de un vistazo.
const grouped = Object.values(
  errors.reduce((acc, e) => {
    const k = `${e.kind}|${e.where}|${e.text}`;
    acc[k] ??= { kind: e.kind, where: e.where, text: e.text, veces: 0, bots: new Set() };
    acc[k].veces++;
    acc[k].bots.add(e.bot);
    return acc;
  }, {}),
).map((e) => ({ ...e, bots: [...e.bots] }));

console.log("\nResumen por juego:");
console.table(summary);
if (grouped.length) {
  console.log(`Errores del navegador (${grouped.length} distintos):`);
  for (const e of grouped) console.log(`  [${e.kind}] ${e.where} ×${e.veces}: ${e.text}`);
}
const problems = [...botProblems, ...results.flatMap((r) => r.problems.map((p) => `${r.bot} ${r.game}: ${p}`))];
if (problems.length) {
  console.log(`\n⚠ ${problems.length} problemas:`);
  for (const p of problems) console.log(`  - ${p}`);
}

mkdirSync("bot-reports", { recursive: true });
const file = `bot-reports/partidas-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
writeFileSync(
  file,
  JSON.stringify(
    { fecha: new Date().toISOString(), base: BASE, duracionS: Math.round((Date.now() - tStart) / 1000), summary, problems, errores: grouped, bots: perBot.map((b) => b.botInfo), partidas: results },
    null,
    2,
  ),
);
console.log(`\nInforme: ${file}`);
if (problems.length || grouped.length) process.exit(1);
