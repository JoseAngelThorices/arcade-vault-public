# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

**Arcade Vault** — an online gaming platform where players compete for high scores (see `README.md`). The Next.js app is a working product: every screen of the prototype is ported, several canvas games are playable, and games and leaderboards live in Supabase. The list of implemented games (ID, title, category, short description, color) lives in `references/implemented-games.md` — read it instead of assuming which games exist.

All UI copy is in Spanish, and numbers are formatted with `toLocaleString("es-ES")`. Keep new UI text Spanish; code comments in the repo are Spanish too.

## Commands

```bash
npm run dev      # dev server (Turbopack)
npm run build    # production build (Turbopack)
npm start        # serve the production build
npm run lint     # ESLint flat config via the ESLint CLI
npx tsc --noEmit # typecheck (no script alias exists)
npx next typegen # regenerate route types after adding/renaming routes
```

The dev server is opened from the LAN IP (`192.168.0.x`), so `next.config.ts` sets `allowedDevOrigins: ["192.168.0.*"]`. Without it Next blocks its dev resources for that origin and React never hydrates — don't remove it.

No test runner is configured — there is no test script, framework, or test file in the repo. Adding one is a project decision; confirm the choice with the user first.

## Spec-driven workflow

Every feature goes through a spec in `specs/NN-<slug>.md` (Spanish, header block with `Estado`, `Depende de`, `Fecha`, `Objetivo`). States: `Borrador` → `Aprobado` → `Implementado`. The closing commit of each spec is `docs: mark SPEC NN as implemented`, and specs record deviations from the plan in their `Decisiones` section.

| Spec | Content |
|---|---|
| 01 | MVP: the five prototype screens ported (biblioteca, detalle, reproductor, acceso, salón) |
| 02 | Landing at `/inicio`; library moved to `/juegos`; `/` redirects (307) to `/inicio` |
| 03 | `/acerca-de` + contact form sending mail through Resend (`app/api/contact/route.ts`) |
| 04 | Supabase clients for browser and server |
| 05 | Asteroids canvas game |
| 06 | `games` and `scores` tables in Supabase; real leaderboards |
| 07–09 | Tetris, Arkanoid, Snake canvas games |

Project skills (in `.claude/skills/`; `spec` and `spec-impl` are symlinks into `.agents/skills/`, tracked by `skills-lock.json`):

- **`/spec`** — writes a new spec section by section, with confirmation.
- **`/spec-impl NN`** — implements a spec. `specs/.spec-config.yml` has `AutoCreateBranch: true`, so it creates a `spec-NN-<slug>` branch automatically; work is merged to `main` via PR.
- **`/add-game`** — for a playable game with leaderboard (from `references/` or new): asks questions and writes `specs/NN-<id>-game.md` in `Borrador`, then run it with `/spec-impl`. It follows the SPEC 05 + SPEC 06 pattern and never writes code.
- **`supabase`** (in `.agents/skills/supabase/`) — Supabase guidance. The Supabase MCP server is configured in `.mcp.json` for this project's database.
- Always use **`/frontend-design`** when building user interfaces.

Implement specs one step at a time: finish a step, stop, and ask before the next one.

## Architecture

### Routes (`app/`)

| Route | What it is |
|---|---|
| `/` | `redirect("/inicio")` |
| `/inicio` | Landing page |
| `/juegos` | Library grid (`components/game-library.tsx`), games + best score from Supabase |
| `/juego/[id]` | Game detail + top 10 leaderboard (Server Component, has its own `not-found.tsx`) |
| `/jugar/[id]` | Generic static player (`components/player.tsx`) for games without a real implementation |
| `/jugar/<id>` (static) | One static route per implemented game (listed in `references/implemented-games.md`); takes precedence over `[id]` and mounts the real canvas game |
| `/salon` | Hall of fame: first tab rendered on the server, other tabs fetched from the browser |
| `/acceso` | Auth screen — fake login, stores a nick in localStorage |
| `/acerca-de` | About page with contact form |
| `POST /api/contact` | Resend endpoint: honeypot field, per-IP rate limit, then validation (`lib/contact.ts`) |

`app/layout.tsx` loads fonts with `next/font/google` (Press Start 2P, JetBrains Mono, Courier Prime) and wraps everything in `<SessionProvider>` + `<Nav>`.

### Data

- **Supabase** (`lib/supabase/`): `server.ts` (async `createClient()` over `cookies()`) for Server Components and Route Handlers; `client.ts` for `"use client"` code. Reads live in `games.ts` (`getGames`, `getGame` wrapped in React `cache`, `getGamesWithBest`) and `scores.ts` (`getTopScores`, `countScores`). Row types in `types.ts` (`GameRow`, `ScoreRow`) are **hand-written** — update them when the schema changes.
- Tables: `games` (`id` slug PK, `title`, `short`, `long`, `cat`, `cover` CSS class, `color`) and `scores` (`game_id`, `player_name`, `score`, `user_id` always `null` until an Auth spec). RLS is on with open policies: public `SELECT` on both, public `INSERT` on `scores`, no `UPDATE`/`DELETE`. PostgREST aggregates are disabled, so "best score" is one `order score desc limit 1` query per game.
- **localStorage** (client only): `lib/session.tsx` holds the fake session `av_user` and a local score log `av_scores` (feeds "TU MEJOR MARCA" in the salón), read via `useSyncExternalStore` to avoid hydration mismatches. `lib/player-name.ts` remembers the name used to sign scores (`av_player_name`), independent of the session.
- `lib/games.ts` only keeps UI constants (`CATS`); `lib/format.ts` formats dates as `DD/MM/AAAA` with a fixed `Europe/Madrid` zone so server and browser agree.
- Env vars: template at `specs/.env.template` (copy to `.env.local`). `RESEND_API_KEY` (empty → simulation mode), `CONTACT_TO`, `RESEND_FROM` are server-only; `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are public.

### Canvas games — the pattern to follow

Each game is split in two files:

- `components/games/<id>-game.tsx` — `"use client"` canvas engine inside a `useEffect` (listeners cleaned up on unmount). It takes `paused: boolean` and reports state through callbacks (`onScoreChange`, `onLivesChange`/`onLengthChange`/…, `onLevelChange`, `onPauseToggle`, `onGameOver(finalScore)`) instead of painting a HUD or a GAME OVER overlay on the canvas.
- `components/<id>-player.tsx` — `"use client"` wrapper that loads the engine with `next/dynamic({ ssr: false })`, renders the React HUD, CRT frame, pause and game-over modal. Saving inserts a row into `scores` from the browser client, writes `av_player_name`, and calls `saveScore` for the local log. Restart remounts the canvas by bumping a `run` key.
- `app/jugar/<id>/page.tsx` — Server Component that calls `getGame("<id>")` and renders the player.
- Game assets (sprites, sounds) go in `public/games/<id>/`; the new `games` row is inserted in Supabase with the spec's SQL.
- When a game is implemented, add its row to `references/implemented-games.md` (same data as its `games` row).

## Styling

`app/globals.css` (~1550 lines) is the port of the prototype's `styles.css`: neon tokens on `:root` (`--cyan #00f5ff`, `--magenta #ff006e`, `--bg #0a0a0f`, …, `--pixel`, `--mono`), exposed to Tailwind through `@theme inline` (`bg-cyan`, `text-ink-dim`, `font-pixel`…). Components mostly use the prototype's semantic class names (`av-player`, `lb-row`, `btn xl pulse`, …) defined there, plus per-game covers (`cover-<name>`, e.g. `cover-rocas`). A new game needing a new cover adds its class here.

Nothing visible may depend on JavaScript: no content starts at `opacity: 0` waiting for a script. Entrance/scroll animations are CSS (`animation-timeline: view()` inside `@supports`), with the visible state as the base.

## `references/`

Not part of the build; source material for specs.

- `implemented-games.md` — table of the games already implemented (the source of truth for "which games exist").
- `templates/` — the original no-build prototype (`Arcade Vault.html`, React 18 UMD + Babel standalone, globals, hash routing, localStorage mocks) plus `home-about/` for the landing and about pages. It is the visual and functional spec: when porting, keep layout, copy, and tokens; re-derive the code (no globals, no prop-drilled router, no plain-CSS-only approach).
- `02-asteroids/`, `03-tetris/`, `04-Arkanoid/` — standalone canvas games (`game.js` + `index.html`) that were adapted into `components/games/`. Their own `CLAUDE.md`/`.claude/` belong to those projects, not this one.
- `source-assets/` — raw assets for games built from scratch (e.g. Snake fruit sprites).

## Stack notes that differ from older Next.js

This is **Next.js 16.3.5** with React 19.2 and Tailwind CSS v4. `AGENTS.md` (imported above) is authoritative: read the relevant page under `node_modules/next/dist/docs/` before writing framework code. Key differences from pre-16 knowledge:

- **Turbopack is the default** for both `dev` and `build`; the `--turbopack` flag is obsolete. Turbopack options live under `turbopack` in `next.config.ts`, not `webpack`. A `webpack` config makes `next build` fail unless run with `--webpack`.
- **Request APIs are async-only.** `cookies()`, `headers()`, `draftMode()`, and `params`/`searchParams` must be awaited; synchronous access was removed, not just deprecated.
- **Global route-type helpers.** `PageProps<'/route'>`, `LayoutProps<'/route'>`, and `RouteContext<'/route'>` are globally available and generated by `next typegen`; they are not imported.
- **`middleware.ts` is now `proxy.ts`** — the old convention is deprecated. (None exists yet; Supabase session refresh will need one when Auth arrives.)
- **`next lint` is gone.** Linting runs through the ESLint CLI with `eslint.config.mjs` (flat config, `eslint-config-next/core-web-vitals` + `/typescript`).
- **`ssr: false` in `next/dynamic` only works inside Client Components** — that is why the game players are client components end to end.
- PPR's `experimental_ppr` segment config and `unstable_` prefixes on stabilized APIs were removed. Caching uses `revalidateTag`/`updateTag`/`refresh` and `cacheLife`/`cacheTag`.
- Several `next/image` defaults changed — check `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md` before tuning image config.

## Conventions

- TypeScript is `strict`, path alias `@/*` maps to the repo root. `allowJs` is on and `include` is broad, so the `references/` `.jsx`/`.js` files are inside the TS program — do not add type-aware tooling that would try to check them.
- Tailwind v4 is configured through PostCSS (`postcss.config.mjs`) with no `tailwind.config` file.
- `AGENTS.md` is regenerated by `next dev`. If it shows up as an uncommitted change, commit it with the work instead of reverting it.
- The git repository root is the user's home directory, not this folder — `git status` without a path shows unrelated home-directory noise. Scope git commands to this directory (`git status .`, `git add .`).
- Commit messages use conventional prefixes (`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`) and reference the spec, e.g. `feat: integrate Snake canvas game (SPEC 09)`.
